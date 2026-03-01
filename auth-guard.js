// auth-guard.js — Korumalı Sayfa Guard'ı (Production-ready)
import { supabase } from './supabase.js'
import { getProfile } from './db.js'
import { initSessionTimeout, trackPageView, healthCheck } from './monitor.js'
import { createRateLimiter } from './sanitize.js'

const PUBLIC_PAGES = ['giris.html', 'kayit.html', 'index.html', 'sifre-sifirla.html', 'email-dogrula.html', '']

  ; (async function authGuard() {
    const path = window.location.pathname

    if (PUBLIC_PAGES.some(p => path.endsWith(p))) return

    // ── Session kontrolü ──
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      window.location.replace('giris.html?reason=no_session')
      return
    }

    const user = session.user

    // ── Profil yükle ──
    try {
      const profile = await getProfile(user.id)
      if (profile) {
        updateSidebarUI(profile, user)
        window.__dmaProfile = profile
        window.__dmaUser = user
      }
    } catch (e) {
      console.warn('Profil yüklenemedi:', e)
      updateSidebarUI(null, user)
    }

    // ── Session timeout başlat (24 saat) ──
    initSessionTimeout()

    // ── Arka planda health check ──
    healthCheck()

    // ── Sayfa görüntüleme logu ──
    trackPageView(user.id)

    // ── Onboarding yönlendirmesi ──
    if (path.includes('dashboard.html')) {
      const { data: steps } = await supabase
        .from('onboarding_steps')
        .select('step, completed')
        .eq('user_id', user.id)

      const hasCompleteStep = steps?.find(s => s.step === 'complete' && s.completed)
      if (!hasCompleteStep) {
        // Onboarding tamamlanmamışsa yönlendir
        window.location.replace('onboarding.html')
      }
    }

    // ── Auth state değişikliklerini dinle ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        window.location.replace('giris.html')
      } else if (newSession && newSession.user.id !== user.id) {
        alert('Başka bir hesapla işlem yapıldı. Güvenliğiniz için yeniden yönlendiriliyorsunuz.')
        window.location.replace('giris.html')
      }
    })

    // ── Sayfa kapanınca subscription'ı temizle (memory leak önleme) ──
    window.addEventListener('beforeunload', () => {
      subscription?.unsubscribe?.()
    })
  })()

// ─────────────────────────────────────────────────────────────
// SIDEBAR UI GÜNCELLEME
// ─────────────────────────────────────────────────────────────

function updateSidebarUI(profile, user) {
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Kullanıcı'
  const plan = profile?.plan || 'free'

  const nameEl = document.getElementById('sidebarName')
  const planEl = document.querySelector('.user-info .plan')
  const avatarEl = document.getElementById('sidebarAvatar')

  if (nameEl) nameEl.textContent = name
  if (planEl) {
    const planLabels = { free: '🆓 Ücretsiz Plan', pro: '🚀 Pro Plan', enterprise: '🏢 Kurumsal' }
    planEl.textContent = planLabels[plan] || '🆓 Ücretsiz Plan'
  }

  if (avatarEl) {
    const savedAvatar = localStorage.getItem('dma_avatar')
    const remoteAvatar = profile?.avatar_url
    if (savedAvatar || remoteAvatar) {
      const src = savedAvatar || remoteAvatar
      // Güvenli: innerHTML yerine img element oluştur
      const img = document.createElement('img')
      img.src = src
      img.alt = 'avatar'
      img.loading = 'lazy'
      avatarEl.innerHTML = ''
      avatarEl.appendChild(img)
    } else {
      avatarEl.textContent = name.charAt(0).toUpperCase()
    }
  }

  const greetEl = document.getElementById('topbarGreet')
  if (greetEl) {
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'
    greetEl.textContent = `${greeting}, ${name.split(' ')[0]} 👋`
  }

  const welcomeEl = document.getElementById('welcomeName')
  if (welcomeEl) welcomeEl.textContent = name.split(' ')[0]
}

// ─────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────

export async function handleLogout() {
  try {
    await supabase.auth.signOut()
  } finally {
    localStorage.removeItem('dma_avatar')
    localStorage.removeItem('dma_session_start')
    window.location.href = 'giris.html'
  }
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ── Logout butonu ──
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) {
    logoutBtn.setAttribute('aria-label', 'Çıkış Yap')
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      await handleLogout()
    })
  }

  // ── "Tüm Cihazlardan Çıkış" butonu (settings sayfası) ──
  const signOutAllBtn = document.getElementById('signOutAllBtn')
  if (signOutAllBtn) {
    signOutAllBtn.addEventListener('click', async () => {
      if (!confirm('Tüm cihazlardan çıkış yapmak istediğinize emin misiniz?')) return
      const { signOutAllDevices } = await import('./db.js')
      await signOutAllDevices()
    })
  }
})
