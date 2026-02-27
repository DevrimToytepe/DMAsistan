import { supabase } from './supabase.js'
import { createRateLimiter } from './sanitize.js'
import CONFIG from './config.js'

const form = document.getElementById('registerForm')
const submitBtn = document.getElementById('submitBtn')
const errorBox = document.getElementById('errorBox')
const successBox = document.getElementById('successBox')

// ── Client-side rate limiter: 5 deneme, 30 saniye kilit ──
const registerLimiter = createRateLimiter('register', CONFIG.MAX_LOGIN_ATTEMPTS, CONFIG.LOCKOUT_DURATION_MS)

let countdownInterval = null

function setLoading(active) {
  if (!submitBtn) return
  submitBtn.disabled = active
  submitBtn.setAttribute('aria-busy', active ? 'true' : 'false')
  const btnText = submitBtn.querySelector('.btn-text')
  const btnSpinner = submitBtn.querySelector('.btn-spinner')
  if (btnText) btnText.style.display = active ? 'none' : 'inline'
  if (btnSpinner) btnSpinner.style.display = active ? 'inline-block' : 'none'
}

function showError(msg) {
  if (!errorBox) return
  errorBox.textContent = '⚠️ ' + msg    // textContent — XSS-safe
  errorBox.setAttribute('role', 'alert')
  errorBox.style.display = 'block'
  if (successBox) successBox.style.display = 'none'
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function showSuccess(msg) {
  if (!successBox) return
  successBox.textContent = msg
  successBox.setAttribute('role', 'status')
  successBox.style.display = 'block'
  if (errorBox) errorBox.style.display = 'none'
}

function clearMessages() {
  if (errorBox) errorBox.style.display = 'none'
  if (successBox) successBox.style.display = 'none'
}

const ERROR_MAP = {
  'User already registered': 'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.',
  'Password should be at least': 'Şifre çok kısa, en az 8 karakter olmalı.',
  'Invalid email': 'Geçersiz e-posta adresi.',
  'Email rate limit exceeded': 'Çok fazla deneme. Lütfen birkaç dakika bekleyin.',
  'signup is disabled': 'Kayıt şu an kapalı. Lütfen daha sonra deneyin.',
}

function parseError(error) {
  const match = Object.entries(ERROR_MAP).find(([key]) => error.message?.includes(key))
  return match ? match[1] : 'Bir hata oluştu: ' + (error.message ?? 'Bilinmeyen hata')
}

function showCountdown(seconds) {
  if (countdownInterval) clearInterval(countdownInterval)
  let remaining = seconds
  showError(`Çok fazla kayıt denemesi. ${remaining} saniye bekleyin.`)

  countdownInterval = setInterval(() => {
    remaining--
    if (remaining <= 0) {
      clearInterval(countdownInterval)
      clearMessages()
    } else {
      showError(`Çok fazla kayıt denemesi. ${remaining} saniye bekleyin.`)
    }
  }, 1000)
}

async function handleFacebookSignup() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: `${CONFIG.APP_URL}/onboarding` }
  })
  if (error) showError('Facebook ile kayıt başlatılamadı: ' + error.message)
}

async function handleGoogleSignup() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${CONFIG.APP_URL}/onboarding` }
  })
  if (error) showError('Google ile kayıt başlatılamadı: ' + error.message)
}

async function handleRegister(e) {
  e.preventDefault()
  clearMessages()

  // ── Rate limit kontrolü ──
  if (!registerLimiter.check()) {
    showCountdown(registerLimiter.remainingSeconds())
    return
  }

  const email = document.getElementById('registerEmail')?.value?.trim() ?? ''
  const password = document.getElementById('passwordInput')?.value ?? ''
  const firstName = document.getElementById('firstName')?.value?.trim() ?? ''
  const lastName = document.getElementById('lastName')?.value?.trim() ?? ''

  if (!firstName) return showError('Ad alanı zorunludur.')
  if (!lastName) return showError('Soyad alanı zorunludur.')
  if (!email) return showError('E-posta adresi zorunludur.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError('Geçerli bir e-posta adresi girin.')
  if (!password) return showError('Şifre zorunludur.')
  if (password.length < 8) return showError('Şifre en az 8 karakter olmalı.')

  setLoading(true)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: `${firstName} ${lastName}`.trim() } }
  })
  setLoading(false)

  if (error) {
    registerLimiter.record()
    return showError(parseError(error))
  }

  registerLimiter.reset()

  if (data.session) {
    showSuccess('✅ Hesabınız oluşturuldu! Yönlendiriliyorsunuz...')
    setTimeout(() => { window.location.href = 'onboarding.html' }, 1200)
  } else {
    showSuccess('📧 Doğrulama e-postası gönderildi! Lütfen gelen kutunuzu kontrol edin.')
    form.reset()
  }
}

if (form) form.addEventListener('submit', handleRegister)

document.addEventListener('DOMContentLoaded', () => {
  // Kayıt sayfasında oturum var mı kontrol et
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.replace('dashboard.html')
  })

  document.querySelectorAll('.social-btn').forEach(btn => {
    const text = btn.textContent.trim()
    if (text.includes('Facebook')) btn.addEventListener('click', handleFacebookSignup)
    else if (text.includes('Google')) btn.addEventListener('click', handleGoogleSignup)
  })
})
