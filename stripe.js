// ============================================================
// stripe.js — Stripe Ödeme Sistemi
// Supabase Edge Function üzerinden Stripe'a bağlanır
// ============================================================

import { supabase } from './supabase.js'

// ─────────────────────────────────────────
// STRIPE CHECKOUT — Ödeme başlat
// ─────────────────────────────────────────

/**
 * Stripe Checkout oturumu oluştur
 * @param {string} priceId - Stripe'taki Price ID
 * @param {'monthly'|'yearly'} interval
 */
export async function startCheckout(priceId, interval = 'monthly') {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = 'giris.html'
    return
  }

  // Yükleniyor göster
  showPaymentLoading(true)

  try {
    // Supabase Edge Function'ı çağır
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        price_id:    priceId,
        interval:    interval,
        user_id:     session.user.id,
        user_email:  session.user.email,
        success_url: `${window.location.origin}/billing.html?payment=success`,
        cancel_url:  `${window.location.origin}/billing.html?payment=canceled`,
      }
    })

    if (error) throw error
    if (!data?.url) throw new Error('Checkout URL alınamadı')

    // Stripe Checkout sayfasına yönlendir
    window.location.href = data.url

  } catch (err) {
    showPaymentLoading(false)
    showPaymentError(err.message || 'Ödeme başlatılamadı. Lütfen tekrar deneyin.')
    console.error('Checkout hatası:', err)
  }
}

/**
 * Müşteri portalını aç (abonelik yönetimi)
 */
export async function openCustomerPortal() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  showPaymentLoading(true)

  try {
    const { data, error } = await supabase.functions.invoke('create-portal-session', {
      body: {
        user_id:    session.user.id,
        return_url: `${window.location.origin}/billing.html`,
      }
    })

    if (error) throw error
    window.location.href = data.url

  } catch (err) {
    showPaymentLoading(false)
    showPaymentError('Müşteri portalı açılamadı.')
  }
}

// ─────────────────────────────────────────
// SUBSCRIPTION DURUMU
// ─────────────────────────────────────────

/**
 * Mevcut aboneliği kontrol et
 */
export async function getSubscriptionStatus() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, stripe_customer_id, stripe_subscription_id')
    .eq('id', session.user.id)
    .single()

  if (!profile) return null

  const now = new Date()
  const expiresAt = profile.plan_expires_at ? new Date(profile.plan_expires_at) : null
  const isExpired = expiresAt && expiresAt < now

  return {
    plan:       isExpired ? 'free' : (profile.plan || 'free'),
    expiresAt,
    isExpired,
    isActive:   !isExpired,
    isPro:      !isExpired && profile.plan === 'pro',
    isEnterprise: !isExpired && profile.plan === 'enterprise',
    isFree:     isExpired || profile.plan === 'free',
    stripeCustomerId: profile.stripe_customer_id,
    daysRemaining: expiresAt
      ? Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
      : null
  }
}

/**
 * Ödeme sonrası URL parametrelerini işle
 */
export function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search)
  const payment = params.get('payment')

  if (payment === 'success') {
    // URL'yi temizle
    window.history.replaceState({}, '', window.location.pathname)
    showPaymentSuccess('🎉 Ödeme başarılı! Planınız güncellendi.')

    // Profili yenile
    setTimeout(() => window.location.reload(), 2500)
  }

  if (payment === 'canceled') {
    window.history.replaceState({}, '', window.location.pathname)
    showPaymentError('Ödeme iptal edildi.')
  }
}

// ─────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────

function showPaymentLoading(show) {
  document.querySelectorAll('.btn-plan.upgrade').forEach(btn => {
    btn.disabled = show
    btn.textContent = show ? '⏳ Yükleniyor...' : '⚡ Pro\'ya Geç'
  })
}

function showPaymentError(msg) {
  showToast(msg, 'error')
}

function showPaymentSuccess(msg) {
  showToast(msg, 'success')
}

function showToast(msg, type = 'success') {
  const existing = document.getElementById('dma-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.id = 'dma-toast'
  const colors = {
    success: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', color: '#22c55e' },
    error:   { bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.3)', color: '#f43f5e' },
    warn:    { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', color: '#F59E0B' },
  }
  const c = colors[type] || colors.success
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    background: ${c.bg}; border: 1px solid ${c.border}; color: ${c.color};
    padding: 14px 20px; border-radius: 14px; font-size: 0.87rem; font-weight: 600;
    max-width: 340px; line-height: 1.4; transform: translateY(100px);
    transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
  `
  toast.textContent = msg
  document.body.appendChild(toast)
  requestAnimationFrame(() => { toast.style.transform = 'translateY(0)' })
  setTimeout(() => {
    toast.style.transform = 'translateY(100px)'
    setTimeout(() => toast.remove(), 300)
  }, 4000)
}
