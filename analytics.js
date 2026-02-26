// ============================================================
// analytics.js — Analytics & Log Sistemi
// ============================================================

import { supabase } from './supabase.js'
import { trackEvent, getWeeklyTrend, getDashboardStats, logUsage } from './db.js'

// ─────────────────────────────────────────
// EVENT TRACKING
// ─────────────────────────────────────────

/** Sayfa görüntüleme logu */
export async function trackPageView(userId, page) {
  await trackEvent(userId, 'page_view', {
    metadata: {
      page,
      referrer: document.referrer,
      userAgent: navigator.userAgent.slice(0, 100),
      timestamp: new Date().toISOString()
    }
  })
}

/** Konuşma başladı */
export async function trackConversationStarted(userId, platform, contactId) {
  await trackEvent(userId, 'conversation_started', { platform, contactId })
  await logUsage(userId, 'conversation_started', { platform })
}

/** AI mesaj gönderdi */
export async function trackAIReply(userId, platform, resolved = false) {
  await trackEvent(userId, resolved ? 'ai_resolved' : 'ai_replied', {
    platform,
    metadata: { resolved }
  })
  await logUsage(userId, 'message_sent', { platform, is_ai: true })
}

/** Dönüşüm (satış) */
export async function trackConversion(userId, platform, value, contactId) {
  await trackEvent(userId, 'conversion', {
    platform,
    contactId,
    value,
    metadata: { timestamp: new Date().toISOString() }
  })
}

/** Platform bağlandı */
export async function trackPlatformConnected(userId, platform) {
  await trackEvent(userId, 'platform_connected', { platform })
  await logUsage(userId, 'platform_connected', { platform })
}

// ─────────────────────────────────────────
// DASHBOARD İSTATİSTİKLERİ
// ─────────────────────────────────────────

/** Dashboard için tüm metrikleri yükle */
export async function loadDashboardMetrics(userId) {
  const [stats, trend] = await Promise.all([
    getDashboardStats(userId),
    getWeeklyTrend(userId)
  ])

  return { stats, trend }
}

/** Grafik verilerini işle */
export function processTrendData(trend) {
  const labels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
  const values = trend.map(d => d.count)
  const maxVal = Math.max(...values, 1)

  return {
    labels: trend.map((d, i) => {
      const date = new Date(d.date)
      const dayIdx = (date.getDay() + 6) % 7 // Mon=0
      return labels[dayIdx] || labels[i]
    }),
    values,
    // Yüzde yükseklikler (grafik için)
    percentages: values.map(v => Math.max(Math.round((v / maxVal) * 100), 4))
  }
}

/** Dashboard grafiğini güncelle */
export function updateDashboardChart(containerId, trendData) {
  const container = document.getElementById(containerId)
  if (!container) return

  const { labels, percentages } = processTrendData(trendData)

  container.innerHTML = labels.map((label, i) => `
    <div class="bar-col">
      <div class="bar" style="height:${percentages[i]}%;transition:height 0.6s ease ${i * 0.05}s"></div>
      <div class="bar-lbl">${label}</div>
    </div>
  `).join('')
}

/** Dashboard stat kartlarını güncelle */
export function updateStatCards(stats) {
  const mapping = {
    totalConversations: 'statConversations',
    monthlyMessages:    'statMessages',
    totalContacts:      'statContacts',
    activePlatforms:    'statPlatforms',
  }

  Object.entries(mapping).forEach(([key, elId]) => {
    const el = document.getElementById(elId)
    if (el && stats[key] !== undefined) {
      // Sayı animasyonu
      animateCount(el, stats[key])
    }
  })
}

/** Sayı animasyonu */
function animateCount(el, target, duration = 800) {
  const start = performance.now()
  const startVal = 0

  function update(now) {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    el.textContent = Math.round(startVal + eased * (target - startVal)).toLocaleString('tr-TR')
    if (progress < 1) requestAnimationFrame(update)
  }

  requestAnimationFrame(update)
}

// ─────────────────────────────────────────
// GELİŞMİŞ ANALİTİK SORGULARI
// ─────────────────────────────────────────

/** Son 30 günlük platform bazlı mesaj dağılımı */
export async function getPlatformDistribution(userId) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data, error } = await supabase
    .from('analytics_events')
    .select('platform')
    .eq('user_id', userId)
    .eq('event_type', 'conversation_started')
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (error) throw error

  const dist = {}
  ;(data || []).forEach(row => {
    if (row.platform) {
      dist[row.platform] = (dist[row.platform] || 0) + 1
    }
  })

  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1

  return Object.entries(dist).map(([platform, count]) => ({
    platform,
    count,
    percentage: Math.round((count / total) * 100)
  }))
}

/** AI çözüm oranı */
export async function getAIResolutionRate(userId) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data, error } = await supabase
    .from('analytics_events')
    .select('event_type')
    .eq('user_id', userId)
    .in('event_type', ['ai_replied', 'ai_resolved'])
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (error) throw error

  const replied  = (data || []).filter(d => d.event_type === 'ai_replied').length
  const resolved = (data || []).filter(d => d.event_type === 'ai_resolved').length
  const total = replied + resolved

  return {
    total,
    resolved,
    rate: total > 0 ? Math.round((resolved / total) * 100) : 0
  }
}

/** Toplam tahmini gelir */
export async function getTotalRevenue(userId) {
  const { data, error } = await supabase
    .from('analytics_events')
    .select('value')
    .eq('user_id', userId)
    .eq('event_type', 'conversion')
    .not('value', 'is', null)

  if (error) throw error

  const total = (data || []).reduce((sum, row) => sum + (row.value || 0), 0)
  return total
}

// ─────────────────────────────────────────
// REAL-TIME MESAJ DİNLEME
// ─────────────────────────────────────────

/**
 * Yeni mesajları gerçek zamanlı dinle
 * @returns unsubscribe fonksiyonu
 */
export function subscribeToMessages(userId, onNewMessage) {
  const channel = supabase
    .channel(`messages:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'messages',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('Yeni mesaj:', payload.new)
        onNewMessage(payload.new)
      }
    )
    .subscribe()

  // Unsubscribe fonksiyonunu döndür
  return () => supabase.removeChannel(channel)
}

/**
 * Konuşmaları gerçek zamanlı dinle
 */
export function subscribeToConversations(userId, onUpdate) {
  const channel = supabase
    .channel(`conversations:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'conversations',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onUpdate(payload)
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
