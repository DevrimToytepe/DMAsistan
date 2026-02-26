import { supabase } from './supabase.js'

const form       = document.getElementById('registerForm')
const submitBtn  = document.getElementById('submitBtn')
const errorBox   = document.getElementById('errorBox')
const successBox = document.getElementById('successBox')

function setLoading(active) {
  if (!submitBtn) return
  submitBtn.disabled = active
  const btnText    = submitBtn.querySelector('.btn-text')
  const btnSpinner = submitBtn.querySelector('.btn-spinner')
  if (btnText)    btnText.style.display    = active ? 'none' : 'inline'
  if (btnSpinner) btnSpinner.style.display = active ? 'inline-block' : 'none'
}

function showError(msg) {
  if (!errorBox) return
  errorBox.textContent = '⚠️ ' + msg
  errorBox.style.display = 'block'
  if (successBox) successBox.style.display = 'none'
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function showSuccess(msg) {
  if (!successBox) return
  successBox.textContent = msg
  successBox.style.display = 'block'
  if (errorBox) errorBox.style.display = 'none'
}

function clearMessages() {
  if (errorBox)   errorBox.style.display = 'none'
  if (successBox) successBox.style.display = 'none'
}

const ERROR_MAP = {
  'User already registered':     'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.',
  'Password should be at least': 'Şifre çok kısa, en az 8 karakter olmalı.',
  'Invalid email':               'Geçersiz e-posta adresi.',
  'Email rate limit exceeded':   'Çok fazla deneme. Lütfen birkaç dakika bekleyin.',
  'signup is disabled':          'Kayıt şu an kapalı. Lütfen daha sonra deneyin.',
}

function parseError(error) {
  const match = Object.entries(ERROR_MAP).find(([key]) => error.message?.includes(key))
  return match ? match[1] : 'Bir hata oluştu: ' + (error.message ?? 'Bilinmeyen hata')
}

async function handleFacebookSignup() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: 'https://dm-asistan.vercel.app/onboarding' }
  })
  if (error) showError('Facebook ile kayıt başlatılamadı: ' + error.message)
}

async function handleGoogleSignup() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://dm-asistan.vercel.app/onboarding' }
  })
  if (error) showError('Google ile kayıt başlatılamadı: ' + error.message)
}

async function handleRegister(e) {
  e.preventDefault()
  clearMessages()

  const email     = document.getElementById('registerEmail')?.value?.trim() ?? ''
  const password  = document.getElementById('passwordInput')?.value ?? ''
  const firstName = document.getElementById('firstName')?.value?.trim() ?? ''
  const lastName  = document.getElementById('lastName')?.value?.trim() ?? ''

  if (!firstName) return showError('Ad alanı zorunludur.')
  if (!lastName)  return showError('Soyad alanı zorunludur.')
  if (!email)     return showError('E-posta adresi zorunludur.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError('Geçerli bir e-posta adresi girin.')
  if (!password)  return showError('Şifre zorunludur.')
  if (password.length < 8) return showError('Şifre en az 8 karakter olmalı.')

  setLoading(true)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: `${firstName} ${lastName}`.trim() } }
  })
  setLoading(false)

  if (error) return showError(parseError(error))

  if (data.session) {
    showSuccess('✅ Hesabınız oluşturuldu! Yönlendiriliyorsunuz...')
    setTimeout(() => { window.location.href = 'onboarding' }, 1200)
  } else {
    showSuccess('📧 Doğrulama e-postası gönderildi! Lütfen gelen kutunuzu kontrol edin.')
    form.reset()
  }
}

if (form) form.addEventListener('submit', handleRegister)

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.social-btn').forEach(btn => {
    const text = btn.textContent.trim()
    if (text.includes('Facebook')) btn.addEventListener('click', handleFacebookSignup)
    else if (text.includes('Google')) btn.addEventListener('click', handleGoogleSignup)
  })
})
