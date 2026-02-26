// ============================================================
// auth-guard.js — Korumalı Sayfa Guard'ı (v2)
// Her korumalı HTML sayfasında: <script type="module" src="auth-guard.js"></script>
// ============================================================

import { supabase } from './supabase.js'
import { getProfile } from './db.js'

// Genel erişime açık sayfalar (guard atlar)
const PUBLIC_PAGES = ['/giris.html', '/kayit.html', '/index.html', '/']

;(async function authGuard() {
  const path = window.location.pathname

  // Public sayfadaysa guard çalışmasın
  if (PUBLIC_PAGES.some(p => path.endsWith(p))) return

  const { data: { session } } = await supabase.auth.getSession()

  // ── Oturum yok → Login'e yönlendir ──
  if (!session) {
    window.location.replace('giris.html')
    return
  }

  const user = session.user

  // ── Profil yükle ve sidebar'ı güncelle ──
  try {
    const profile = await getProfile(user.id)
    if (profile) {
      updateSidebarUI(profile, user)
      window.__dmaProfile = profile   // global erişim
      window.__dmaUser    = user
    }
  } catch (e) {
    console.warn('Profil yüklenemedi:', e)
    updateSidebarUI(null, user)
  }

  // ── Onboarding kontrolü ──
  // Onboarding tamamlanmamışsa ve şu an dashboard'daysa → onboarding'e at
  if (path.includes('dashboard.html')) {
    const { data: steps } = await supabase
      .from('onboarding_steps')
      .select('step, completed')
      .eq('user_id', user.id)

    const allDone = steps?.every(s => s.completed)
    const hasCompleteStep = steps?.find(s => s.step === 'complete' && s.completed)

    if (!hasCompleteStep && !allDone) {
      // İlk kez giriş → onboarding'e yönlendir
      // (Bunu açmak istersen aşağıdaki satırı aktif et)
      // window.location.replace('onboarding.html')
    }
  }

  // ── Auth state değişikliklerini dinle ──
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.replace('giris.html')
    }
    if (event === 'TOKEN_REFRESHED') {
      console.log('Token yenilendi')
    }
  })
})()

// ── Sidebar UI güncelle ──
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
    if (savedAvatar) {
      avatarEl.innerHTML = `<img src="${savedAvatar}" alt="avatar">`
    } else if (remoteAvatar) {
      avatarEl.innerHTML = `<img src="${remoteAvatar}" alt="avatar">`
    } else {
      avatarEl.textContent = name.charAt(0).toUpperCase()
    }
  }

  // Topbar greeting
  const greetEl = document.getElementById('topbarGreet')
  if (greetEl) {
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'
    greetEl.textContent = `${greeting}, ${name.split(' ')[0]} 👋`
  }

  const welcomeEl = document.getElementById('welcomeName')
  if (welcomeEl) welcomeEl.textContent = name.split(' ')[0]
}

// ── Logout ──
export async function handleLogout() {
  await supabase.auth.signOut()
  localStorage.removeItem('dma_avatar')
  window.location.href = 'giris.html'
}

// ── Mevcut session'ı al ──
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ── Logout butonunu otomatik bağla ──
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      await handleLogout()
    })
  }
})
