// db.js — Supabase veritabanı yardımcı fonksiyonları
import { supabase } from './supabase.js'

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
    action,
    platform,
    metadata
  })
}

// ── Analitik event kaydet ──
export async function trackEvent(userId, eventType, platform = null, value = null, metadata = {}) {
  await supabase.from('analytics_events').insert({
    user_id: userId,
    event_type: eventType,
    platform,
    value,
    metadata
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
  const { data, error } = await supabase
    .from('ai_settings')
    .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Konuşmaları getir ──
export async function getConversations(userId, { limit = 50, status = null } = {}) {
  let query = supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })
    .limit(limit)
  if (status) query = query.eq('status', status)
  const { data } = await query
  return data || []
}

// ── Mesajları getir ──
export async function getMessages(conversationId, { limit = 100 } = {}) {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)
  return data || []
}

// ── Kişileri getir ──
export async function getContacts(userId, { limit = 100, status = null, search = null } = {}) {
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status) query = query.eq('status', status)
  if (search) query = query.ilike('name', `%${search}%`)
  const { data } = await query
  return data || []
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

// ── Analitik eventleri getir (son 30 gün) ──
export async function getAnalytics(userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('analytics_events')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
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

  // Gün bazında grupla
  const counts = {}
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    counts[key] = 0
  }
  ;(data || []).forEach(row => {
    const key = row.created_at.slice(0, 10)
    if (key in counts) counts[key]++
  })
  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}

// ── Dashboard özet istatistikleri ──
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
    monthlyMessages:    msgRes.count ?? 0,
    totalContacts:      contactRes.count ?? 0,
    activePlatforms:    platRes.count ?? 0,
  }
}

// ── Profil upsert (onboarding için) ──
export async function upsertProfile(userId, updates) {
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
  const { data: msg, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      content,
      is_ai: isAi,
      direction: isAi ? 'outbound' : 'inbound',
    })
    .select()
    .single()
  if (error) throw error

  // Konuşmanın son mesaj zamanını güncelle
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

// ── Avatar'ı Supabase Storage'a yükle ──
export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = data.publicUrl

  // Profil tablosuna da yaz
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
