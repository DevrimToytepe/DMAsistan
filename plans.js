// ============================================================
// plans.js — Plan Sistemi & Limit Kontrol
// ============================================================

import { supabase } from './supabase.js'
import { checkLimit, getUserPlan, logUsage, trackEvent } from './db.js'

// ─────────────────────────────────────────
// PLAN TANIMLARI
// ─────────────────────────────────────────
export const PLANS = {
  free: {
    name: 'Ücretsiz',
    emoji: '🆓',
    limits: {
      messages:  500,
      platforms: 1,
      templates: 3,
      contacts:  100,
    },
    features: {
      ai_reply:           true,
      advanced_analytics: false,
      custom_templates:   false,
      priority_support:   false,
      api_access:         false,
      multi_platform:     false,
    },
    stripe_price_id_monthly: null,
    stripe_price_id_yearly:  null,
  },
  pro: {
    name: 'Pro',
    emoji: '🚀',
    limits: {
      messages:  10000,
      platforms: 3,
      templates: 50,
      contacts:  10000,
    },
    features: {
      ai_reply:           true,
      advanced_analytics: true,
      custom_templates:   true,
      priority_support:   true,
      api_access:         false,
      multi_platform:     true,
    },
    price_monthly: 499,
    price_yearly:  349,
    // Stripe'ta oluşturacaksın — aşağıda açıklıyorum
    stripe_price_id_monthly: 'price_MONTHLY_ID_BURAYA',
    stripe_price_id_yearly:  'price_YEARLY_ID_BURAYA',
  },
  enterprise: {
    name: 'Kurumsal',
    emoji: '🏢',
    limits: {
      messages:  999999,
      platforms: 99,
      templates: 999,
      contacts:  999999,
    },
    features: {
      ai_reply:           true,
      advanced_analytics: true,
      custom_templates:   true,
      priority_support:   true,
      api_access:         true,
      multi_platform:     true,
    },
  }
}

// ─────────────────────────────────────────
// LİMİT KONTROLÜ
// ─────────────────────────────────────────

/**
 * Bir işlem yapmadan önce limit kontrolü yap
 * @returns { allowed, current, limit, plan, upgradeNeeded }
 */
export async function canPerformAction(userId, resource) {
  try {
    const result = await checkLimit(userId, resource)
    return {
      ...result,
      upgradeNeeded: !result.allowed,
      percentUsed: Math.round((result.current / result.limit) * 100)
    }
  } catch (e) {
    console.error('Limit kontrol hatası:', e)
    // Hata durumunda izin ver (graceful degradation)
    return { allowed: true, current: 0, limit: 999, plan: 'free', upgradeNeeded: false }
  }
}

/**
 * Mesaj gönderim öncesi limit kontrolü yap
 * UI'da otomatik uyarı gösterir
 */
export async function checkMessageLimit(userId) {
  const result = await canPerformAction(userId, 'messages')

  if (!result.allowed) {
    showLimitModal({
      title: 'Mesaj Limitine Ulaştınız',
      message: `Bu ay ${result.current} / ${result.limit} mesaj kullandınız. Pro planına geçerek 10.000 mesaj/ay kullanın.`,
      resource: 'messages',
      plan: result.plan
    })
    return false
  }

  // %80'e yaklaştıysa uyar
  if (result.percentUsed >= 80) {
    showLimitWarning(`Mesaj limitinizin %${result.percentUsed}'ini kullandınız. (${result.current}/${result.limit})`)
  }

  return true
}

/**
 * Platform bağlama limit kontrolü
 */
export async function checkPlatformLimit(userId) {
  const result = await canPerformAction(userId, 'platforms')

  if (!result.allowed) {
    showLimitModal({
      title: 'Platform Limitine Ulaştınız',
      message: `${result.limit} platform bağlantısı limitine ulaştınız. Pro planında 3 platform bağlayabilirsiniz.`,
      resource: 'platforms',
      plan: result.plan
    })
    return false
  }

  return true
}

/**
 * Özellik erişim kontrolü (feature flag)
 */
export async function canUseFeature(userId, feature) {
  const plan = await getUserPlan(userId)
  const planConfig = PLANS[plan] || PLANS.free
  const allowed = planConfig.features[feature] ?? false

  if (!allowed) {
    showFeatureGateModal(feature, plan)
  }

  return allowed
}

// ─────────────────────────────────────────
// MODAL UI
// ─────────────────────────────────────────

function showLimitModal({ title, message, resource, plan }) {
  // Varsa eski modalı kaldır
  document.getElementById('dma-limit-modal')?.remove()

  const modal = document.createElement('div')
  modal.id = 'dma-limit-modal'
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
    z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;
  `
  modal.innerHTML = `
    <div style="background: #0F1428; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px;
                padding: 32px; max-width: 440px; width: 100%; box-shadow: 0 40px 80px rgba(0,0,0,0.5);">
      <div style="font-size: 2.5rem; text-align: center; margin-bottom: 16px;">⚡</div>
      <h3 style="font-family: 'Sora', sans-serif; font-size: 1.2rem; font-weight: 800;
                 text-align: center; margin-bottom: 10px; color: #fff;">${title}</h3>
      <p style="font-size: 0.87rem; color: #A1A1AA; text-align: center; margin-bottom: 24px; line-height: 1.6;">${message}</p>
      <a href="billing.html" style="display: block; width: 100%; padding: 13px;
         background: linear-gradient(135deg, #7C3AED, #F43F75); border-radius: 12px;
         color: white; font-family: 'Sora', sans-serif; font-weight: 700; font-size: 0.92rem;
         text-align: center; text-decoration: none; margin-bottom: 10px;">
        🚀 Pro'ya Geç
      </a>
      <button onclick="document.getElementById('dma-limit-modal').remove()"
        style="width: 100%; padding: 11px; background: rgba(255,255,255,0.04);
               border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
               color: #A1A1AA; font-size: 0.87rem; cursor: pointer;">
        Daha Sonra
      </button>
    </div>
  `
  document.body.appendChild(modal)
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })
}

function showFeatureGateModal(feature, currentPlan) {
  const featureNames = {
    advanced_analytics: 'Gelişmiş Analitik',
    custom_templates:   'Özel Şablonlar',
    priority_support:   'Öncelikli Destek',
    api_access:         'API Erişimi',
    multi_platform:     'Çoklu Platform',
  }
  showLimitModal({
    title: `${featureNames[feature] || feature} Pro Özelliktir`,
    message: 'Bu özelliği kullanmak için Pro planına geçmeniz gerekmektedir.',
    resource: feature,
    plan: currentPlan
  })
}

function showLimitWarning(message) {
  const existing = document.getElementById('dma-limit-warn')
  if (existing) existing.remove()

  const warn = document.createElement('div')
  warn.id = 'dma-limit-warn'
  warn.style.cssText = `
    position: fixed; top: 80px; right: 20px; z-index: 9998;
    background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3);
    border-radius: 12px; padding: 12px 16px; max-width: 320px;
    font-size: 0.82rem; color: #F59E0B; line-height: 1.4;
  `
  warn.innerHTML = `⚠️ ${message} <a href="billing.html" style="color: #7C3AED; font-weight: 700;">Yükselt →</a>`
  document.body.appendChild(warn)
  setTimeout(() => warn.remove(), 6000)
}
