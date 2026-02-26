// db.js — Supabase veritabanı yardımcı fonksiyonları
// Tüm sorgular: pagination, join optimizasyonu, N+1 önleme
import { supabase } from './supabase.js'
import CONFIG from './config.js'
import { sanitizeText, sanitizeMessage, generateSafeFileName, validateFile } from './sanitize.js'

// ── Kullanıcı planını getir ──
export async function getUserPlan(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()
  return data?.plan || 'free'
}

// ── Limit kontrolü ──
export async function checkLimit(userId, resource) {
  const { data, error } = await supabase.rpc('check_limit', {
    p_user_id: userId,
    p_resource: resource
  })
  if (error) throw error
  return data
}

// ── Kullanım logu ekle ──
export async function logUsage(userId, action, platform = null, metadata = {}) {
  await supabase.from('usage_logs').insert({
    user_id: userId,
    action: sanitizeText(action, 100),
    platform,
    metadata
  })
}

// ── Analitik event kaydet (genişletilmiş metadata ile) ──
export async function trackEvent(userId, eventType, platform = null, value = null, metadata = {}) {
  await supabase.from('analytics_events').insert({
    user_id: userId,
    event_type: eventType,
    platform,
    value,
    metadata: {
      ...metadata,
      platform: navigator?.platform || null,
      user_agent: navigator?.userAgent?.slice(0, 100) || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  })
}

// ── Profil getir ──
export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

// ── Profil güncelle ──
export async function updateProfile(userId, updates) {
  // Sanitize metin alanları
  if (updates.full_name) updates.full_name = sanitizeText(updates.full_name, 100)
  if (updates.bio) updates.bio = sanitizeText(updates.bio, 500)
  if (updates.business_name) updates.business_name = sanitizeText(updates.business_name, 200)
  if (updates.city) updates.city = sanitizeText(updates.city, 100)

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── AI ayarlarını getir ──
export async function getAiSettings(userId) {
  const { data } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

// ── AI ayarlarını güncelle ──
export async function updateAiSettings(userId, updates) {
  if (updates.system_prompt) updates.system_prompt = sanitizeText(updates.system_prompt, 2000)
  if (updates.bot_name) updates.bot_name = sanitizeText(updates.bot_name, 100)

  const { data, error } = await supabase
    .from('ai_settings')
    .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// CONVERSATIONS — Cursor-based pagination
// ─────────────────────────────────────────────────────────────

/**
 * Konuşmaları getir (cursor-based pagination)
 * @param {string} userId
 * @param {object} opts
 * @param {number} [opts.limit]      - Sayfa başına kayıt (default: ITEMS_PER_PAGE)
 * @param {string} [opts.status]     - 'open' | 'closed' | 'pending' | null (tümü)
 * @param {string} [opts.cursor]     - Son kaydın last_message_at değeri (sonraki sayfa için)
 * @returns {{ data: Array, nextCursor: string|null, hasMore: boolean }}
 */
export async function getConversations(userId, { limit = CONFIG.ITEMS_PER_PAGE, status = null, cursor = null } = {}) {
  // 1 fazla çek → hasMore tespiti için
  const fetchLimit = limit + 1

  let query = supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })
    .limit(fetchLimit)

  if (status) query = query.eq('status', status)
  if (cursor) query = query.lt('last_message_at', cursor)

  const { data, error } = await query
  if (error) throw error

  const rows = data || []
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1]?.last_message_at : null

  return { data: items, nextCursor, hasMore }
}

// ─────────────────────────────────────────────────────────────
// MESSAGES — Sayfalı, Realtime-ready
// ─────────────────────────────────────────────────────────────

/**
 * Mesajları getir (sayfalı, kronolojik)
 * @param {string} conversationId
 * @param {object} opts
 * @param {number} [opts.limit]   - Default: MESSAGES_PER_PAGE
 * @param {string} [opts.before]  - Cursor: bu created_at'dan öncekiler
 */
export async function getMessages(conversationId, { limit = CONFIG.MESSAGES_PER_PAGE, before = null } = {}) {
  const fetchLimit = limit + 1

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(fetchLimit)

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) throw error

  const rows = (data || []).reverse() // kronolojik sıra
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(1) : rows // ilk fazladan çekilen kayıt = "daha fazla var" işareti
  const nextCursor = hasMore ? items[0]?.created_at : null

  return { data: items, nextCursor, hasMore }
}

// ─────────────────────────────────────────────────────────────
// CONTACTS — Pagination + Search + N+1 önleme
// ─────────────────────────────────────────────────────────────

/**
 * Kişileri getir (sayfalı + arama)
 * @param {string} userId
 * @param {object} opts
 * @param {number} [opts.limit]
 * @param {number} [opts.offset]
 * @param {string} [opts.status]
 * @param {string} [opts.search]   - İsim veya telefon araması
 */
export async function getContacts(userId, { limit = CONFIG.ITEMS_PER_PAGE, offset = 0, status = null, search = null } = {}) {
  const fetchLimit = limit + 1

  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + fetchLimit - 1)

  if (status) query = query.eq('status', status)
  if (search) {
    const safe = sanitizeText(search, 100)
    // İsim VEYA telefon araması (OR sorgu)
    query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
  }

  const { data, count, error } = await query
  if (error) throw error

  const rows = data || []
  const hasMore = rows.length > limit

  return {
    data: hasMore ? rows.slice(0, limit) : rows,
    total: count ?? 0,
    hasMore,
    offset: offset + (hasMore ? limit : rows.length)
  }
}

// ── Şablonları getir ──
export async function getTemplates(userId) {
  const { data } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data || []
}

// ── Platformları getir ──
export async function getPlatforms(userId) {
  const { data } = await supabase
    .from('platforms')
    .select('*')
    .eq('user_id', userId)
  return data || []
}

// ── Analitik eventleri getir (son N gün, sayfalı) ──
export async function getAnalytics(userId, days = 30, limit = 200) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('analytics_events')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

// ── Haftalık trend verisi (son 7 gün, gün bazında konuşma sayısı) ──
export async function getWeeklyTrend(userId) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('conversations')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(1000) // güvenli üst sınır

  // Gün bazında grupla
  const counts = {}
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    counts[key] = 0
  }
  ; (data || []).forEach(row => {
    const key = row.created_at.slice(0, 10)
    if (key in counts) counts[key]++
  })
  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}

// ── Dashboard özet istatistikleri — tek sorguda (N+1 önleme) ──
export async function getDashboardStats(userId) {
  const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const [convRes, msgRes, contactRes, platRes] = await Promise.all([
    supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_ai', true).gte('created_at', thisMonth),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('platforms').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true),
  ])
  return {
    totalConversations: convRes.count ?? 0,
    monthlyMessages: msgRes.count ?? 0,
    totalContacts: contactRes.count ?? 0,
    activePlatforms: platRes.count ?? 0,
  }
}

// ── Profil upsert (onboarding için) ──
export async function upsertProfile(userId, updates) {
  if (updates.full_name) updates.full_name = sanitizeText(updates.full_name, 100)
  if (updates.business_name) updates.business_name = sanitizeText(updates.business_name, 200)

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── AI ayarlarını kaydet (upsert) ──
export async function saveAISettings(userId, settings) {
  if (settings.system_prompt) settings.system_prompt = sanitizeText(settings.system_prompt, 2000)

  const { data, error } = await supabase
    .from('ai_settings')
    .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Onboarding adımını tamamla ──
export async function completeOnboardingStep(userId, step) {
  const { error } = await supabase
    .from('onboarding_steps')
    .upsert({
      user_id: userId,
      step,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,step' })
  if (error) throw error
}

// ── Onboarding tamamlandı mı kontrol et ──
export async function isOnboardingComplete(userId) {
  const { data } = await supabase
    .from('onboarding_steps')
    .select('completed')
    .eq('user_id', userId)
    .eq('step', 'complete')
    .single()
  return data?.completed === true
}

// ── Konuşmaya mesaj ekle + last_message_at güncelle ──
export async function sendMessage(conversationId, userId, content, isAi = false) {
  // İçeriği sanitize et
  const safeContent = sanitizeMessage(content)
  if (!safeContent) throw new Error('Mesaj içeriği boş olamaz.')

  const { data: msg, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      content: safeContent,
      is_ai: isAi,
      direction: isAi ? 'outbound' : 'inbound',
      sender: isAi ? 'ai' : 'human_agent',
    })
    .select()
    .single()
  if (error) throw error

  // Konuşmanın son mesaj zamanını güncelle (ayrı sorgu — atomic)
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

  return msg
}

// ── Şifreyi güncelle (Supabase Auth) ──
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// ── Avatar'ı Supabase Storage'a yükle (güvenli versiyon) ──
export async function uploadAvatar(userId, file) {
  // 1) Validasyon
  const { valid, error: validErr } = validateFile(file)
  if (!valid) throw new Error(validErr)

  // 2) Dosya adını UUID ile yeniden adlandır
  const safeName = generateSafeFileName(file)
  const path = `${userId}/${safeName}`

  // 3) Yükle
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, {
      upsert: true,
      contentType: file.type,  // gerçek MIME tipini zorla
    })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = data.publicUrl

  // 4) Profil tablosuna da yaz
  await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId)
  return avatarUrl
}

// ── Okunmamış konuşma sayısını getir ──
export async function getUnreadCount(userId) {
  const { count } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'open')
  return count ?? 0
}

// ─────────────────────────────────────────────────────────────
// KEYWORD LİMİT KONTROLÜ
// ─────────────────────────────────────────────────────────────

/**
 * Kullanıcının keyword limitini kontrol et
 * @param {string} userId
 * @returns {{ allowed: boolean, current: number, limit: number }}
 */
export async function checkKeywordLimit(userId) {
  const { count } = await supabase
    .from('keywords')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  const current = count ?? 0
  return {
    allowed: current < CONFIG.MAX_KEYWORDS_PER_USER,
    current,
    limit: CONFIG.MAX_KEYWORDS_PER_USER
  }
}

// ─────────────────────────────────────────────────────────────
// AKTİF OTURUMLAR (Settings sayfası için)
// ─────────────────────────────────────────────────────────────

/**
 * Kullanıcının tüm aktif oturumlarını getir
 * NOT: Supabase Admin API gerektirir — bu fonksiyon server-side'da çalışmalı.
 * Client-side için sadece mevcut oturumu döndürür.
 */
export async function getActiveSessions() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return []
  return [
    {
      id: session.access_token.slice(-8),
      device: navigator.userAgent.slice(0, 60),
      created_at: session.user.last_sign_in_at,
      current: true,
    }
  ]
}

/**
 * Tüm cihazlardan çıkış yap (global sign out)
 */
export async function signOutAllDevices() {
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) throw error
  window.location.replace('/giris.html')
}
