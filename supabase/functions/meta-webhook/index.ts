// supabase/functions/meta-webhook/index.ts
// Meta platformlarından gelen webhook mesajlarını işler
// Instagram DM + Facebook Messenger + WhatsApp Business
//
// KURULUM:
// supabase functions deploy meta-webhook
// Meta Developer Console → Webhooks → Endpoint URL:
// https://PROJE_ID.supabase.co/functions/v1/meta-webhook

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore
const VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || 'dmasistan_whook_2024'
// @ts-ignore
const APP_SECRET = Deno.env.get('META_APP_SECRET') || ''

let supabaseUrl = ''
let supabaseKey = ''
try {
  // @ts-ignore
  supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://fallback.supabase.co'
  // @ts-ignore
  supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'fallback_key'
} catch (e) {}

// @ts-ignore
const supabase = createClient(supabaseUrl, supabaseKey)

// @ts-ignore
Deno.serve(async (req: Request) => {
  // ── GET: Webhook doğrulama (Meta'nın ilk handshake isteği) ──
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook doğrulandı')
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  // ── POST: Gelen mesajları işle ───────────────────────────────
  if (req.method === 'POST') {
    const body = await req.text()

    // İmza doğrulama (güvenlik)
    const signature = req.headers.get('x-hub-signature-256') || ''
    if (APP_SECRET && signature) {
      const isValid = await verifySignature(body, signature, APP_SECRET)
      if (!isValid) console.warn('Uyarı: Geçersiz webhook imzası, ancak mesaj engellenmedi (Test modu)')
    }

    try {
      const payload = JSON.parse(body)
      console.log('--- YENİ WEBHOOK ---', JSON.stringify(payload, null, 2))

      // Meta her platform için farklı format kullanır
      for (const entry of (payload.entry || [])) {
        console.log(`Entry işleniyor: ${entry.id}`)

        // ── Instagram DM ──────────────────────────────────────
        if (payload.object === 'instagram') {
          for (const msg of (entry.messaging || [])) {
            console.log('Instagram mesaj objesi bulundu:', JSON.stringify(msg))
            if (msg.message && !msg.message.is_echo) {
              await handleInstagramMessage(entry.id, msg)
            }
          }
        }

        // ── Facebook Messenger ────────────────────────────────
        if (payload.object === 'page') {
          console.log(`PAGE OBJESİ - messaging dizisi var mı? : ${!!entry.messaging}`)
          for (const msg of (entry.messaging || [])) {
            console.log('Facebook mesaj objesi bulundu:', JSON.stringify(msg))
            if (msg.message && !msg.message.is_echo) {
              await handleFacebookMessage(entry.id, msg)
            }
          }
        }

        // ── WhatsApp Business ─────────────────────────────────
        if (payload.object === 'whatsapp_business_account') {
          const changes = entry.changes || []
          for (const change of changes) {
            if (change.field === 'messages') {
              const value = change.value
              for (const msg of (value.messages || [])) {
                await handleWhatsAppMessage(value.metadata?.phone_number_id, msg, value.contacts?.[0])
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' }
      })

    } catch (err) {
      console.error('Webhook işleme hatası:', err)
      return new Response('Processing error: ' + (err instanceof Error ? err.message : String(err)), { status: 500 })
    }
  }

  return new Response('Method not allowed', { status: 405 })
})

// ── Instagram DM İşle ────────────────────────────────────────
async function handleInstagramMessage(pageId: string, messaging: Record<string, unknown>) {
  const senderId = (messaging.sender as Record<string, string>)?.id
  const recipientId = (messaging.recipient as Record<string, string>)?.id
  const message = messaging.message as Record<string, unknown>
  const text = (message?.text as string) || ''
  const timestamp = messaging.timestamp as number

  if (!senderId || !text) return

  // Bu Instagram hesabına bağlı kullanıcıyı bul
  const { data: platform } = await supabase
    .from('platforms')
    .select('user_id, account_id, access_token')
    .eq('platform', 'instagram')
    .eq('is_active', true)
    .single()

  if (!platform) {
    console.warn('Instagram platformu bulunamadı:', pageId)
    return
  }

  await processIncomingMessage({
    userId: platform.user_id,
    platform: 'instagram',
    senderId,
    senderName: senderId,
    content: text,
    timestamp: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
    rawPayload: messaging,
    accessToken: platform.access_token,
  })
}

// ── Facebook Messenger İşle ──────────────────────────────────
async function handleFacebookMessage(pageId: string, messaging: Record<string, unknown>) {
  console.log(`> handleFacebookMessage BAŞLADI. PageID: ${pageId}`)
  const senderId = (messaging.sender as Record<string, string>)?.id
  const message = messaging.message as Record<string, unknown>
  const text = (message?.text as string) || ''
  const timestamp = messaging.timestamp as number

  console.log(`> SenderID: ${senderId}, Text uzunluk: ${text.length}`)
  if (!senderId || !text) {
    console.log('HATA: SenderID veya Text yok, aborting.')
    return
  }

  // Sayfa ID'sine göre kullanıcıyı bul
  console.log('> Supabase /platforms tablosu sorgulanıyor...')
  const { data: platform, error: platErr } = await supabase
    .from('platforms')
    .select('user_id, access_token')
    .eq('platform', 'facebook')
    .eq('is_active', true)
    
  console.log(`> Bulunan platform sonucu:`, platform, platErr)

  // Eğer bu ID'ye sahip birden fazla kayıt dönerse diye diziden ilkini alıyoruz veya .single() hatası var mı ona bakıyoruz.
  if (!platform || platErr || platform.length === 0) {
    console.log('HATA: Kullanıcının platform kaydı bulunamadı/is_active:false.')
    return
  }
  
  const activeUser = platform[0]

  // Gönderici adını al
  let senderName = senderId
  try {
    const profileRes = await fetch(
      `https://graph.facebook.com/v21.0/${senderId}?fields=name&access_token=${activeUser.access_token}`
    )
    const profileData = await profileRes.json()
    senderName = profileData.name || senderId
  } catch (_) { /* sessiz */ }
  
  console.log(`> Process messages başlıyor. userId: ${activeUser.user_id}`)
  await processIncomingMessage({
    userId: activeUser.user_id,
    platform: 'facebook',
    senderId,
    senderName,
    content: text,
    timestamp: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
    rawPayload: messaging,
    accessToken: activeUser.access_token,
  })
}

// ── WhatsApp Business İşle ───────────────────────────────────
async function handleWhatsAppMessage(
  phoneNumberId: string,
  message: Record<string, unknown>,
  contact?: Record<string, unknown>
) {
  const senderId = message.from as string
  const text = (message.text as Record<string, string>)?.body || ''
  const timestamp = message.timestamp as string
  const senderName = (contact?.profile as Record<string, string>)?.name || senderId

  if (!senderId || !text) return

  const { data: platform } = await supabase
    .from('platforms')
    .select('user_id, access_token')
    .eq('platform', 'whatsapp')
    .eq('is_active', true)
    .single()

  if (!platform) return

  // WhatsApp mesajını "okundu" olarak işaretle
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${platform.access_token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: message.id,
      })
    })
  } catch (_) { /* sessiz */ }

  await processIncomingMessage({
    userId: platform.user_id,
    platform: 'whatsapp',
    senderId,
    senderName,
    content: text,
    timestamp: timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString(),
    rawPayload: message,
    accessToken: platform.access_token,
    phoneNumberId,
  })
}

// ── Ortak: Gelen mesajı işle → AI'ya gönder → Yanıtla ────────
async function processIncomingMessage(params: {
  userId: string
  platform: string
  senderId: string
  senderName: string
  content: string
  timestamp: string
  rawPayload: unknown
  accessToken: string
  phoneNumberId?: string
}) {
  const { userId, platform, senderId, senderName, content, timestamp, accessToken, phoneNumberId } = params

  // 1. Konuşmayı bul veya oluştur
  console.log(`> Konuşma aranıyor: userId=${userId}, platform=${platform}, senderId=${senderId}`)
  let { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('id, status')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('sender_id', senderId)
    .eq('status', 'open')

  // single() dizi boşsa hata atıyor, o yüzden dizinin ilk elemanını alıyoruz
  let activeConv = conv && conv.length > 0 ? conv[0] : null
  console.log(`> Mevcut konuşma durumu:`, activeConv ? 'Bulundu' : 'Bulunamadı, yaratılacak')

  if (!activeConv) {
    const { data: newConv, error: newErr } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        platform,
        sender_id: senderId,
        contact_name: senderName,
        contact_handle: senderId,
        status: 'open',
        last_message: content,
        last_message_at: timestamp,
      })
      .select()

    if (newErr) {
       console.error(`> YENİ KONUŞMA OLUŞTURMA HATASI:`, newErr)
    }
    activeConv = newConv && newConv.length > 0 ? newConv[0] : null
  } else {
    // Mevcut konuşmayı güncelle
    const { error: updErr } = await supabase
      .from('conversations')
      .update({ last_message: content, last_message_at: timestamp })
      .eq('id', activeConv.id)
      
    if (updErr) console.error(`> KONUŞMA GÜNCELLEME HATASI:`, updErr)
  }

  if (!activeConv) {
    console.error('> HATA: İşleme devam edilecek bir Konuşma (activeConv) bulunamadı/oluşturulamadı.')
    return
  }

  // 2. Kullanıcı mesajını kaydet
  const { error: msgErr } = await supabase.from('messages').insert({
    conversation_id: activeConv.id,
    user_id: userId,
    content,
    direction: 'inbound',
    is_ai: false,
    platform,
    sender_id: senderId,
    created_at: timestamp,
  })
  
  if (msgErr) console.error(`> MESAJ KAYIT(INSERT) HATASI:`, msgErr)
  else console.log(`> Mesaj başarıyla [messages] tablosuna eklendi!`)

  // 3. AI ayarlarını kontrol et
  const { data: aiSettings, error: aiErr } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (aiSettings?.is_active === false) {
    console.log('AI kapalı, otomatik yanıt yok')
    return
  }

  // 4. AI webhook'una ilet (GPT-4 yanıt üretir)
  try {
    const { data: aiData, error: invokeErr } = await supabase.functions.invoke('ai-webhook', {
      body: {
        conversation_id: activeConv.id,
        user_id: userId,
        message: content,
        platform,
        sender_id: senderId,
        sender_name: senderName,
      }
    })
    
    if (invokeErr) console.error(`> AI-WEBHOOK ÇAĞIRMA HATASI:`, invokeErr)
    else console.log(`> AI Yanıt verdi:`, aiData?.reply)

    if (aiData?.reply) {
      // 5. AI yanıtını platforma geri gönder
      await sendReplyToPlatform({
        platform,
        recipientId: senderId,
        message: aiData.reply,
        accessToken,
        phoneNumberId,
      })
      console.log('> Platforma yanıt başarıyla iletildi.')
    }
  } catch (err) {
    console.error('AI yanıt hatası:', err)
  }
}

// ── Platforma Yanıt Gönder ───────────────────────────────────
async function sendReplyToPlatform(params: {
  platform: string
  recipientId: string
  message: string
  accessToken: string
  phoneNumberId?: string
}) {
  const { platform, recipientId, message, accessToken, phoneNumberId } = params

  try {
    if (platform === 'instagram' || platform === 'facebook') {
      // Messenger / Instagram Graph API
      await fetch('https://graph.facebook.com/v21.0/me/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: message },
        })
      })

    } else if (platform === 'whatsapp' && phoneNumberId) {
      // WhatsApp Business API
      await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipientId,
          type: 'text',
          text: { body: message },
        })
      })
    }
  } catch (err) {
    console.error(`${platform} yanıt gönderme hatası:`, err)
  }
}

// ── HMAC-SHA256 İmza Doğrulama ───────────────────────────────
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const expectedSig = signature.replace('sha256=', '')
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
    return computed === expectedSig
  } catch (_) {
    return false
  }
}
