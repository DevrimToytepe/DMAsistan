import { supabase } from './supabase.js'
import { createRateLimiter } from './sanitize.js'
import CONFIG from './config.js'

const form = document.getElementById('loginForm')
const submitBtn = document.getElementById('submitBtn')

// ── Client-side rate limiter: 5 deneme, 30 saniye kilit ──
const loginLimiter = createRateLimiter('login', CONFIG.MAX_LOGIN_ATTEMPTS, CONFIG.LOCKOUT_DURATION_MS)

function setLoading(active) {
  if (!submitBtn) return
  submitBtn.disabled = active
  submitBtn.setAttribute('aria-busy', active ? 'true' : 'false')
  const btnText = submitBtn.querySelector('.btn-text')
  const btnSpinner = submitBtn.querySelector('.btn-spinner')
  if (btnText) btnText.style.display = active ? 'none' : 'inline'
  if (btnSpinner) btnSpinner.style.display = active ? 'inline-block' : 'none'
}

function setFieldError(groupId, show) {
  const group = document.getElementById(groupId)
  if (!group) return
  show ? group.classList.add('error') : group.classList.remove('error')
}

const ERROR_MAP = {
  'Invalid login credentials': 'E-posta veya şifre hatalı.',
  'Email not confirmed': 'E-postanız henüz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.',
  'Too many requests': 'Çok fazla deneme. Lütfen birkaç dakika bekleyin.',
  'User not found': 'Bu e-posta ile kayıtlı hesap bulunamadı.',
}

function parseError(error) {
  const match = Object.entries(ERROR_MAP).find(([key]) => error.message?.includes(key))
  return match ? match[1] : 'Giriş yapılamadı: ' + (error.message ?? 'Bilinmeyen hata')
}

function showFormError(msg) {
  let globalErr = document.getElementById('globalError')
  if (!globalErr) {
    globalErr = document.createElement('div')
    globalErr.id = 'globalError'
    globalErr.setAttribute('role', 'alert')
    globalErr.style.cssText = `background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.4);border-radius:10px;padding:12px 16px;color:#f43f5e;font-size:0.88rem;margin-bottom:16px;`
    form.insertBefore(globalErr, form.firstChild)
  }
  // textContent kullan — innerHTML XSS riski yaratır
  globalErr.textContent = '⚠️ ' + msg
  globalErr.style.display = 'block'
}

function clearGlobalError() {
  const el = document.getElementById('globalError')
  if (el) el.style.display = 'none'
}

// ── Geri sayım göstergesi ──
let countdownInterval = null
function showCountdown(seconds) {
  if (countdownInterval) clearInterval(countdownInterval)
  let remaining = seconds
  showFormError(`Çok fazla hatalı deneme. ${remaining} saniye bekleyin.`)

  countdownInterval = setInterval(() => {
    remaining--
    if (remaining <= 0) {
      clearInterval(countdownInterval)
      clearGlobalError()
    } else {
      showFormError(`Çok fazla hatalı deneme. ${remaining} saniye bekleyin.`)
    }
  }, 1000)
}

async function handleFacebookLogin() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: `${CONFIG.APP_URL}/onboarding` }
  })
  if (error) showFormError('Facebook girişi başlatılamadı: ' + error.message)
}

async function handleGoogleLogin() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${CONFIG.APP_URL}/onboarding` }
  })
  if (error) showFormError('Google girişi başlatılamadı: ' + error.message)
}

async function handleLogin(e) {
  e.preventDefault()
  clearGlobalError()

  // ── Rate limit kontrolü ──
  if (!loginLimiter.check()) {
    showCountdown(loginLimiter.remainingSeconds())
    return
  }

  const email = document.getElementById('emailInput')?.value?.trim() ?? ''
  const pass = document.getElementById('passInput')?.value ?? ''

  let valid = true
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError('emailGroup', true); valid = false
  } else { setFieldError('emailGroup', false) }
  if (!pass || pass.length < 6) {
    setFieldError('passGroup', true); valid = false
  } else { setFieldError('passGroup', false) }
  if (!valid) return

  setLoading(true)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
  setLoading(false)

  if (error) {
    loginLimiter.record()  // Başarısız denemeyi kaydet
    return showFormError(parseError(error))
  }

  // Başarılı giriş — limiti sıfırla
  loginLimiter.reset()

  if (data.session) {
    const { data: steps } = await supabase
      .from('onboarding_steps')
      .select('completed')
      .eq('user_id', data.session.user.id)
      .eq('step', 'complete')
      .single()

    window.location.href = steps?.completed ? 'dashboard.html' : 'onboarding.html'
  }
}

if (form) form.addEventListener('submit', handleLogin)

document.addEventListener('DOMContentLoaded', () => {
  // Login sayfasında session var mı kontrol et
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.replace('dashboard.html')
  })

  document.querySelectorAll('.social-btn').forEach(btn => {
    const text = btn.textContent.trim()
    if (text.includes('Facebook')) btn.addEventListener('click', handleFacebookLogin)
    else if (text.includes('Google')) btn.addEventListener('click', handleGoogleLogin)
  })

  // ?reason=timeout mesajı
  const params = new URLSearchParams(window.location.search)
  if (params.get('reason') === 'timeout') {
    showFormError('Oturumunuz sona erdi (24 saat). Lütfen tekrar giriş yapın.')
  } else if (params.get('reason') === 'expired') {
    showFormError('Oturum süresi doldu. Lütfen tekrar giriş yapın.')
  }
})
