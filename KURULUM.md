# DMAsistan — Kurulum & Yapılandırma Rehberi

## 📁 Dosya Yapısı

```
proje-klasörü/
├── index.html
├── giris.html
├── kayit.html
├── onboarding.html       ← YENİ
├── dashboard.html
├── conversations.html
├── automation.html
├── contacts.html
├── analytics.html
├── integrations.html
├── settings.html
├── billing.html
│
├── supabase.js           ← mevcut
├── auth-guard.js         ← YENİ (güncellendi)
├── giris.js
├── kayit.js
├── main.js
│
├── db.js                 ← YENİ  (tüm CRUD)
├── plans.js              ← YENİ  (plan/limit)
├── stripe.js             ← YENİ  (ödeme)
├── analytics.js          ← YENİ  (analytics)
│
└── supabase/
    └── functions/
        ├── create-checkout-session/index.ts
        ├── create-portal-session/index.ts
        └── stripe-webhook/index.ts
```

---

## 1️⃣ Supabase — SQL Schema

**Nerede:** Supabase Dashboard → SQL Editor

1. `supabase-schema.sql` dosyasının tüm içeriğini kopyala
2. SQL Editor'e yapıştır
3. **Run** butonuna bas
4. Hata yoksa yeşil tik görürsün ✅

---

## 2️⃣ Supabase — Auth Ayarları

**Authentication → Settings:**

| Ayar | Değer |
|------|-------|
| Site URL | `http://localhost:3000` (dev) / `https://sitenizdomain.com` (prod) |
| Redirect URLs | `http://localhost:3000/onboarding.html` |
| Email Confirm | Kapalı bırak (başlangıç için) |

**Authentication → Email Templates:**
- Welcome Email → özelleştirebilirsin (opsiyonel)

---

## 3️⃣ Supabase — Storage (Avatar için)

1. Supabase Dashboard → **Storage**
2. **New bucket** → İsim: `avatars`
3. **Public bucket**: ✅ Aktif
4. **Policies → Add policy → For full customization:**

```sql
-- avatars bucket policy
CREATE POLICY "Avatar yükle" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatar görüntüle" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Avatar güncelle" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatar sil" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 4️⃣ Stripe Kurulum

### A) Stripe Hesabı
1. https://stripe.com → Hesap aç
2. **Test Mode** aktif olsun (canlıya geçmeden)

### B) Ürün & Fiyat Oluştur
**Stripe Dashboard → Products → Add Product:**

```
Ürün 1: DMAsistan Pro
  Fiyat 1: 499₺/ay    → Price ID: price_xxx (aylık)
  Fiyat 2: 349₺/ay    → Price ID: price_yyy (yıllık, 4188₺/yıl)
```

Price ID'leri kopyala → `plans.js` içindeki şu satırları güncelle:
```js
stripe_price_id_monthly: 'price_xxx',  // ← kendi ID'ni yaz
stripe_price_id_yearly:  'price_yyy',  // ← kendi ID'ni yaz
```

### C) Stripe API Keys
**Stripe Dashboard → Developers → API Keys:**
- `Publishable key` → frontend'de gerekirse kullanılır
- `Secret key` → Supabase secret'a eklenecek

### D) Stripe Webhook
**Stripe Dashboard → Developers → Webhooks → Add endpoint:**
```
Endpoint URL: https://PROJE_ID.supabase.co/functions/v1/stripe-webhook
Events:
  ✅ customer.subscription.created
  ✅ customer.subscription.updated  
  ✅ customer.subscription.deleted
  ✅ invoice.payment_succeeded
  ✅ invoice.payment_failed
```
**Webhook Secret** → kopyala

---

## 5️⃣ Supabase Edge Functions

### Supabase CLI Kur:
```bash
npm install -g supabase
supabase login
supabase link --project-ref PROJE_ID
```

### Secrets Ekle:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Fonksiyonları Deploy Et:
```bash
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook
```

### Test Et:
```bash
# Stripe test kartı: 4242 4242 4242 4242
# Tarih: herhangi gelecek tarih, CVC: herhangi 3 hane
```

---

## 6️⃣ HTML Sayfalarına Script Ekle

Her korumalı sayfanın `</body>` öncesine ekle:

```html
<!-- Tüm dashboard sayfalarına -->
<script type="module" src="auth-guard.js"></script>
```

### Dashboard istatistiklerini gerçek veriye bağla:

`dashboard.html` içindeki script bölümüne ekle:
```html
<script type="module">
  import { loadDashboardMetrics, updateDashboardChart, updateStatCards } from './analytics.js'
  import { getSession } from './auth-guard.js'

  const session = await getSession()
  if (session) {
    const { stats, trend } = await loadDashboardMetrics(session.user.id)
    updateStatCards(stats)
    updateDashboardChart('chartArea', trend)
  }
</script>
```

### Billing sayfasına Stripe bağla:

`billing.html` içine ekle:
```html
<script type="module">
  import { startCheckout, openCustomerPortal, handlePaymentReturn, getSubscriptionStatus } from './stripe.js'
  import { PLANS } from './plans.js'

  // Sayfa yüklenince ödeme dönüşünü kontrol et
  handlePaymentReturn()

  // Abonelik durumunu kontrol et
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    const status = await getSubscriptionStatus()
    if (status?.isPro) {
      // Pro kullanıcı UI'ı güncelle
    }
  }

  // Butonlara bağla
  document.querySelectorAll('.btn-plan.upgrade').forEach(btn => {
    btn.addEventListener('click', () => {
      const priceId = PLANS.pro.stripe_price_id_monthly
      startCheckout(priceId, 'monthly')
    })
  })
</script>
```

### Mesaj gönderiminde limit kontrolü:

`conversations.html` içinde mesaj gönderme butonuna ekle:
```html
<script type="module">
  import { checkMessageLimit } from './plans.js'
  
  document.querySelector('.send-btn')?.addEventListener('click', async () => {
    const session = await getSession()
    const allowed = await checkMessageLimit(session.user.id)
    if (!allowed) return  // Modal otomatik gösterilir
    
    // Mesaj gönder...
  })
</script>
```

---

## 7️⃣ Onboarding Akışı

`kayit.js` içinde başarılı kayıt sonrası:
```js
// Kayıt başarılı → direkt onboarding'e yönlendir
if (data.session) {
  window.location.href = 'onboarding.html'
}
```

Bu zaten mevcut kodda var. Sadece `onboarding.html`'i proje klasörüne koy.

---

## 8️⃣ Üretim (Production) Checklist

- [ ] Supabase URL konfigürasyonunu güncelle (localhost → domain)
- [ ] Stripe → Test Mode → **Live Mode** geç
- [ ] `supabase.js` içindeki URL ve key'leri `.env` dosyasından al
- [ ] HTTPS zorunlu (Stripe HTTPS gerektirir)
- [ ] Email doğrulamayı aç (Auth Settings)
- [ ] Rate limiting kontrol et (Auth → Rate Limits)
- [ ] Stripe Radar kuralları ayarla (fraud önleme)
- [ ] Error monitoring ekle (Sentry vb.)

---

## 🔑 Özet — Ne Yapman Gerekiyor

| Adım | Platform | Süre |
|------|----------|------|
| SQL schema çalıştır | Supabase | 2 dk |
| Storage bucket oluştur | Supabase | 3 dk |
| Stripe ürün oluştur | Stripe | 5 dk |
| Stripe webhook ekle | Stripe | 3 dk |
| Supabase CLI kur | Terminal | 5 dk |
| Secrets set et | Terminal | 2 dk |
| Edge functions deploy | Terminal | 5 dk |
| Price ID'leri güncelle | plans.js | 1 dk |
| Dosyaları projeye ekle | VS Code | 5 dk |

**Toplam: ~31 dakika** 🚀
