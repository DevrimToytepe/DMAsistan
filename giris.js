// giris.js — giris.html ile tam eşleştirilmiş
import { supabase } from './supabase.js'

const form      = document.getElementById('loginForm')
const submitBtn = document.getElementById('submitBtn')

// ─── UI State ────────────────────────────────────────────────
function setLoading(active) {
  if (!submitBtn) return
  submitBtn.disabled = active
  const btnText    = submitBtn.querySelector('.btn-text')
  const btnSpinner = submitBtn.querySelector('.btn-spinner')
  if (btnText)    btnText.style.display    = active ? 'none'         : 'inline'
  if (btnSpinner) btnSpinner.style.display = active ? 'inline-block' : 'none'
}

function setFieldError(groupId, show) {
  const group = document.getElementById(groupId)
  if (!group) return
  show ? group.classList.add('error') : group.classList.remove('error')
}

// ─── Supabase Hata Mesajları (Türkçe) ────────────────────────
const ERROR_MAP = {
  'Invalid login credentials': 'E-posta veya şifre hatalı.',
  'Email not confirmed':       'E-postanız henüz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.',
  'Too many requests':         'Çok fazla deneme. Lütfen birkaç dakika bekleyin.',
  'User not found':            'Bu e-posta ile kayıtlı hesap bulunamadı.',
}

function parseError(error) {
  const match = Object.entries(ERROR_MAP)
    .find(([key]) => error.message?.includes(key))
  return match ? match[1] : 'Giriş yapılamadı: ' + (error.message ?? 'Bilinmeyen hata')
}

function showFormError(msg) {
  // Formdaki ilk error-msg alanını genel hata için kullan
  let globalErr = document.getElementById('globalError')
  if (!globalErr) {
    globalErr = document.createElement('div')
    globalErr.id = 'globalError'
    globalErr.style.cssText = `
      background: rgba(244,63,94,0.1);
      border: 1px solid rgba(244,63,94,0.4);
      border-radius: 10px;
      padding: 12px 16px;
      color: #f43f5e;
      font-size: 0.88rem;
      margin-bottom: 16px;
    `
    form.insertBefore(globalErr, form.firstChild)
  }
  globalErr.textContent  = '⚠️ ' + msg
  globalErr.style.display = 'block'
}

function clearGlobalError() {
  const el = document.getElementById('globalError')
  if (el) el.style.display = 'none'
}

// ─── Ana Login Fonksiyonu ─────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault()
  clearGlobalError()

  const email = document.getElementById('emailInput')?.value?.trim() ?? ''
  const pass  = document.getElementById('passInput')?.value          ?? ''

  // ── Validasyon ──
  let valid = true
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError('emailGroup', true); valid = false
  } else {
    setFieldError('emailGroup', false)
  }
  if (!pass || pass.length < 6) {
    setFieldError('passGroup', true); valid = false
  } else {
    setFieldError('passGroup', false)
  }
  if (!valid) return

  // ── Loading ──
  setLoading(true)

  // ── Supabase signIn ──
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })

  setLoading(false)

  // ── Hata ──
  if (error) return showFormError(parseError(error))

  // ── Başarı → Dashboard/Onboarding'e yönlendir ──
  if (data.session) {
    // Onboarding tamamlandı mı kontrol et
    const { data: steps } = await supabase
      .from('onboarding_steps')
      .select('completed')
      .eq('user_id', data.session.user.id)
      .eq('step', 'complete')
      .single()

    if (steps?.completed) {
      window.location.href = 'dashboard.html'
    } else {
      window.location.href = 'onboarding.html'
    }
  }
}

// ─── Event Listener ───────────────────────────────────────────
if (form) {
  form.addEventListener('submit', handleLogin)
} else {
  console.error('giris.js: #loginForm bulunamadı!')
}
