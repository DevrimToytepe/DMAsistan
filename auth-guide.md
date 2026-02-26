# DMAsistan — Supabase Auth Flow (Vanilla JS)

## Kurulum

```bash
npm install @supabase/supabase-js
```

---

## 1. Supabase Client (`supabase.js`)

```js
// supabase.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://PROJE_ID.supabase.co'   // .env'den al
const SUPABASE_ANON_KEY = 'eyJ...'                     // .env'den al

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,       // Token localStorage'da saklansın
    autoRefreshToken: true,     // Token otomatik yenilensin
  }
})
```

> ⚠️ Gerçek projede bu değerleri `.env` dosyasına koy, koda yazma.

---

## 2. `handleRegister` Fonksiyonu (`kayit.js`)

```js
// kayit.js
import { supabase } from './supabase.js'

const form        = document.getElementById('registerForm')
const submitBtn   = document.getElementById('submitBtn')
const errorBox    = document.getElementById('errorBox')      // hata alanı
const successBox  = document.getElementById('successBox')    // başarı alanı

// --- State yönetimi ---
function setLoading(isLoading) {
  submitBtn.disabled = isLoading
  submitBtn.querySelector('.btn-text').style.display    = isLoading ? 'none'         : 'inline'
  submitBtn.querySelector('.btn-spinner').style.display = isLoading ? 'inline-block' : 'none'
}

function showError(message) {
  errorBox.textContent = message
  errorBox.style.display = 'block'
  successBox.style.display = 'none'
}

function clearMessages() {
  errorBox.style.display   = 'none'
  successBox.style.display = 'none'
}

// --- Ana register fonksiyonu ---
async function handleRegister(e) {
  e.preventDefault()
  clearMessages()

  const email    = form.querySelector('input[type="email"]').value.trim()
  const password = form.querySelector('input[type="password"]').value

  // ---- Client-side validasyon ----
  if (!email || !password) {
    return showError('E-posta ve şifre zorunludur.')
  }
  if (password.length < 8) {
    return showError('Şifre en az 8 karakter olmalı.')
  }

  // ---- Loading başlat ----
  setLoading(true)

  // ---- Supabase Auth ile kayıt ----
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Kullanıcı metadata ekleyebilirsin
      data: {
        full_name: form.querySelector('#firstName')?.value + ' ' + form.querySelector('#lastName')?.value
      }
    }
  })

  setLoading(false)

  // ---- Hata yönetimi ----
  if (error) {
    // Supabase hata kodlarını Türkçeye çevir
    const errorMessages = {
      'User already registered':          'Bu e-posta adresi zaten kayıtlı.',
      'Password should be at least 6':    'Şifre çok kısa.',
      'Invalid email':                    'Geçersiz e-posta adresi.',
      'Email rate limit exceeded':        'Çok fazla deneme. Lütfen bekleyin.',
    }
    const msg = Object.entries(errorMessages)
      .find(([key]) => error.message.includes(key))?.[1]
      ?? 'Bir hata oluştu. Lütfen tekrar deneyin.'

    return showError(msg)
  }

  // ---- Başarı ----
  // Supabase e-posta doğrulama aktifse: data.user var ama session yok
  // Doğrulama kapalıysa: data.session içinde JWT gelir
  if (data.session) {
    // Direkt login → onboarding'e yönlendir
    window.location.href = '/onboarding.html'
  } else {
    // E-posta doğrulama bekleniyor
    successBox.textContent = '📧 Doğrulama e-postası gönderildi! Lütfen e-postanızı kontrol edin.'
    successBox.style.display = 'block'
    form.reset()
  }
}

form.addEventListener('submit', handleRegister)
```

---

## 3. HTML — Hata/Başarı Kutuları (`kayit.html`)

Formuna şu iki elementi ekle:

```html
<!-- Hata kutusu -->
<div id="errorBox" style="display:none;
  background: rgba(244,63,94,0.1);
  border: 1px solid rgba(244,63,94,0.4);
  border-radius: 10px;
  padding: 12px 16px;
  color: #f43f5e;
  font-size: 0.88rem;
  margin-bottom: 16px;">
</div>

<!-- Başarı kutusu -->
<div id="successBox" style="display:none;
  background: rgba(34,197,94,0.1);
  border: 1px solid rgba(34,197,94,0.4);
  border-radius: 10px;
  padding: 12px 16px;
  color: #22c55e;
  font-size: 0.88rem;
  margin-bottom: 16px;">
</div>
```

Form submit butonuna spinner ekle (zaten varsa kontrol et):

```html
<button type="submit" class="btn-submit" id="submitBtn">
  <span class="btn-text">Ücretsiz Hesap Oluştur →</span>
  <span class="btn-spinner" style="display:none"></span>
</button>
```

---

## 4. Supabase Dashboard Ayarları

Supabase panelinde şunları kontrol et:

| Ayar | Nerede | Değer |
|------|--------|-------|
| E-posta doğrulama | Auth → Settings → Email | İstediğine göre aç/kapat |
| Site URL | Auth → URL Configuration | `http://localhost:3000` (dev) |
| Redirect URL | Auth → URL Configuration | `http://localhost:3000/onboarding.html` |
| bcrypt hashleme | Otomatik | Supabase hallediyor ✅ |
| JWT | Otomatik | Supabase hallediyor ✅ |
| httpOnly Cookie | Otomatik (SSR mode) | Vanilla JS'de localStorage kullanır |

> 💡 Vanilla JS'de Supabase, token'ı `localStorage`'a yazar. httpOnly cookie **sadece server-side** (Next.js/SvelteKit SSR) ile mümkündür. Vanilla JS için bu yeterince güvenlidir — XSS'e karşı Content Security Policy ekle.

---

## 5. Auth State Dinleme (tüm sayfalarda)

```js
// Her sayfada çalışması için main.js veya ayrı bir auth-guard.js'e ekle
import { supabase } from './supabase.js'

// Kullanıcı giriş yapmışsa korumalı sayfalara erişsin
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('Kullanıcı giriş yaptı:', session.user.email)
  }
  if (event === 'SIGNED_OUT') {
    // Korumalı sayfadaysak login'e yönlendir
    const korumaluSayfalar = ['/onboarding.html', '/dashboard.html']
    if (korumaluSayfalar.includes(window.location.pathname)) {
      window.location.href = '/giris.html'
    }
  }
})

// Sayfa yüklenince session kontrolü
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
```

---

## 6. Onboarding Sayfası (`onboarding.html`) — Auth Guard

```js
// onboarding.js — sayfa yüklenince auth kontrolü
import { supabase } from './supabase.js'

(async function() {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    // Giriş yapmamış → login'e at
    window.location.href = '/giris.html'
    return
  }

  // Giriş yapmış → kullanıcıyı karşıla
  document.getElementById('userName').textContent =
    session.user.user_metadata?.full_name ?? session.user.email
})()
```

---

## 7. Logout

```js
async function handleLogout() {
  await supabase.auth.signOut()
  window.location.href = '/giris.html'
}
```

---

## Güvenlik Checklist

- [x] Şifre hashleme → Supabase bcrypt ile otomatik hallediyor
- [x] JWT oluşturma → Supabase otomatik hallediyor
- [x] Token yenileme → `autoRefreshToken: true` ile aktif
- [x] Email zaten varsa hata → Supabase "User already registered" döner
- [x] Client-side validasyon → `handleRegister` içinde yapıldı
- [x] Loading state → `setLoading()` ile yönetiliyor
- [x] Türkçe hata mesajları → `errorMessages` map'i ile çevriliyor
- [ ] Content Security Policy → `index.html` `<head>`'ine ekle (XSS koruması)
- [ ] HTTPS → Production'da zorunlu
- [ ] Rate limiting → Supabase Dashboard'da Auth rate limit ayarla
