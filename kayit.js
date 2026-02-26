// kayit.js — kayit.html ile tam eşleştirilmiş
import { supabase } from './supabase.js'

// ─── HTML elementlerini al ────────────────────────────────────
const form       = document.getElementById('registerForm')
const submitBtn  = document.getElementById('submitBtn')
const errorBox   = document.getElementById('errorBox')
const successBox = document.getElementById('successBox')

// ─── UI State ────────────────────────────────────────────────
function setLoading(active) {
  if (!submitBtn) return
  submitBtn.disabled = active
  const btnText    = submitBtn.querySelector('.btn-text')
  const btnSpinner = submitBtn.querySelector('.btn-spinner')
  if (btnText)    btnText.style.display    = active ? 'none'         : 'inline'
  if (btnSpinner) btnSpinner.style.display = active ? 'inline-block' : 'none'
}

function showError(msg) {
  if (!errorBox) return
  errorBox.textContent     = '⚠️ ' + msg
  errorBox.style.display   = 'block'
  if (successBox) successBox.style.display = 'none'
  // Sayfayı hata kutusuna kaydır
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function showSuccess(msg) {
  if (!successBox) return
  successBox.textContent   = msg
  successBox.style.display = 'block'
  if (errorBox) errorBox.style.display = 'none'
}

function clearMessages() {
  if (errorBox)   errorBox.style.display   = 'none'
  if (successBox) successBox.style.display = 'none'
}

// ─── Supabase Hata Mesajları (Türkçe) ────────────────────────
const ERROR_MAP = {
  'User already registered':     'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.',
  'Password should be at least': 'Şifre çok kısa, en az 8 karakter olmalı.',
  'Invalid email':               'Geçersiz e-posta adresi.',
  'Email rate limit exceeded':   'Çok fazla deneme. Lütfen birkaç dakika bekleyin.',
  'signup is disabled':          'Kayıt şu an kapalı. Lütfen daha sonra deneyin.',
  'Unable to validate email':    'E-posta doğrulanamadı. Geçerli bir adres girin.',
}

function parseError(error) {
  const match = Object.entries(ERROR_MAP)
    .find(([key]) => error.message?.includes(key))
  return match ? match[1] : 'Bir hata oluştu: ' + (error.message ?? 'Bilinmeyen hata')
}

// ─── Ana Register Fonksiyonu ──────────────────────────────────
async function handleRegister(e) {
  e.preventDefault()
  clearMessages()

  // Form değerlerini al (kayit.html ID'leriyle eşleşiyor)
  const email     = document.getElementById('registerEmail')?.value?.trim() ?? ''
  const password  = document.getElementById('passwordInput')?.value          ?? ''
  const firstName = document.getElementById('firstName')?.value?.trim()      ?? ''
  const lastName  = document.getElementById('lastName')?.value?.trim()       ?? ''

  // ── Client-side validasyon ──
  if (!firstName) return showError('Ad alanı zorunludur.')
  if (!lastName)  return showError('Soyad alanı zorunludur.')
  if (!email) return showError('E-posta adresi zorunludur.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError('Geçerli bir e-posta adresi girin.')
  if (!password) return showError('Şifre zorunludur.')
  if (password.length < 8) return showError('Şifre en az 8 karakter olmalı.')

  // ── Loading ──
  setLoading(true)

  // ── Supabase Auth ──
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: `${firstName} ${lastName}`.trim() || email.split('@')[0],
      }
    }
  })

  setLoading(false)

  // ── Hata ──
  if (error) return showError(parseError(error))

  // ── Başarı ──
  if (data.session) {
    // E-posta doğrulama KAPALI → direkt giriş
    showSuccess('✅ Hesabınız oluşturuldu! Yönlendiriliyorsunuz...')
    setTimeout(() => { window.location.href = 'onboarding.html' }, 1200)
  } else {
    // E-posta doğrulama AÇIK → mail gönderildi
    showSuccess('📧 Doğrulama e-postası gönderildi! Lütfen gelen kutunuzu kontrol edin.')
    form.reset()
    document.getElementById('strengthWrap').style.display = 'none'
  }
}

// ─── Event Listener ───────────────────────────────────────────
if (form) {
  form.addEventListener('submit', handleRegister)
} else {
  console.error('kayit.js: #registerForm bulunamadı!')
}
