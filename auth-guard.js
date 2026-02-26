// auth-guard.js — Korumalı Sayfa Guard'ı
import { supabase } from './supabase.js'
import { getProfile } from './db.js'

const PUBLIC_PAGES = ['/giris.html', '/kayit.html', '/index.html', '/']

;(async function authGuard() {
  const path = window.location.pathname

  if (PUBLIC_PAGES.some(p => path.endsWith(p))) return

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    window.location.replace('/giris.html')
    return
  }

  const user = session.user

  try {
    const profile = await getProfile(user.id)
    if (profile) {
      updateSidebarUI(profile, user)
      window.__dmaProfile = profile
      window.__dmaUser    = user
    }
  } catch (e) {
    console.warn('Profil yüklenemedi:', e)
    updateSidebarUI(null, user)
  }

  if (path.includes('dashboard.html')) {
    const { data: steps } = await supabase
      .from('onboarding_steps')
      .select('step, completed')
      .eq('user_id', user.id)

    const hasCompleteStep = steps?.find(s => s.step === 'complete' && s.completed)
    // Onboarding yönlendirmesini açmak istersen aşağıdaki satırı aktif et:
    // if (!hasCompleteStep) window.location.replace('/onboarding.html')
  }

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.replace('/giris.html')
    }
  })
})()

function updateSidebarUI(profile, user) {
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Kullanıcı'
  const plan = profile?.plan || 'free'

  const nameEl   = document.getElementById('sidebarName')
  const planEl   = document.querySelector('.user-info .plan')
  const avatarEl = document.getElementById('sidebarAvatar')

  if (nameEl) nameEl.textContent = name
  if (planEl) {
    const planLabels = { free: '🆓 Ücretsiz Plan', pro: '🚀 Pro Plan', enterprise: '🏢 Kurumsal' }
    planEl.textContent = planLabels[plan] || '🆓 Ücretsiz Plan'
  }

  if (avatarEl) {
    const savedAvatar  = localStorage.getItem('dma_avatar')
    const remoteAvatar = profile?.avatar_url
    if (savedAvatar) {
      avatarEl.innerHTML = `<img src="${savedAvatar}" alt="avatar">`
    } else if (remoteAvatar) {
      avatarEl.innerHTML = `<img src="${remoteAvatar}" alt="avatar">`
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

export async function handleLogout() {
  await supabase.auth.signOut()
  localStorage.removeItem('dma_avatar')
  window.location.href = '/giris.html'
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

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
