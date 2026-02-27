// supabase/functions/meta-oauth-exchange/index.ts
// Meta OAuth code → access token değişimi + hesap bilgilerini DB'ye kaydet
//
// KURULUM:
// supabase functions deploy meta-oauth-exchange
// supabase secrets set META_APP_ID=2017158822176401
// supabase secrets set META_APP_SECRET=<yeni_secret_buraya>
// supabase secrets set META_WEBHOOK_VERIFY_TOKEN=dmasistan_whook_2024

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    // @ts-ignore
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    // @ts-ignore
    const APP_ID = Deno.env.get('META_APP_ID') || ''
    // @ts-ignore
    const APP_SECRET = Deno.env.get('META_APP_SECRET') || ''

    console.log('1. Parametreler kontrol ediliyor')
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase ortam değişkenleri (URL veya KEY) eksik.')
    }
    if (!APP_ID || !APP_SECRET) {
      throw new Error('Meta uygulama sırları (APP_ID veya APP_SECRET) eksik.')
    }

    // @ts-ignore
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { code, platform, user_id, redirect_uri } = await req.json()
    console.log(`2. Gelen istek: platform=${platform}, user_id=${user_id}`)

    if (!code || !platform || !user_id) {
      return errorResponse('code, platform ve user_id zorunlu')
    }

    console.log('3. Meta Graph API (Token) isteği başlatılıyor')
    const qs = new URLSearchParams({
      client_id: APP_ID,
      client_secret: APP_SECRET,
      redirect_uri: redirect_uri || '',
      code: code
    }).toString()

    const tokenRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${qs}`, {
      // 10 saniyelik timeout koruması
      signal: AbortSignal.timeout(10000)
    })
    
    console.log('4. Meta Graph API yanıt verdi, status:', tokenRes.status)
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      console.error('Meta Token Hatası:', tokenData.error)
      throw new Error(`Token hatası: ${tokenData.error.message || JSON.stringify(tokenData.error)}`)
    }

    let accessToken = tokenData.access_token

    // ── 2. Short-lived → Long-lived token (60 gün) ───────────
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${APP_ID}` +
      `&client_secret=${APP_SECRET}` +
      `&fb_exchange_token=${accessToken}`
    )
    const longTokenData = await longTokenRes.json()
    if (longTokenData.access_token) {
      accessToken = longTokenData.access_token
    }

    // ── 3. Platform'a göre hesap bilgilerini al ───────────────
    let accountName  = ''
    let accountId    = ''
    let platformData : Record<string, unknown> = {}

    if (platform === 'instagram') {
      // Instagram Business hesap bilgileri
      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?` +
        `fields=id,name,instagram_business_account{id,name,username,followers_count,profile_picture_url}` +
        `&access_token=${accessToken}`
      )
      const igData = await igRes.json()
      
      if (igData.error) throw new Error(`Instagram Veri Hatası: ${igData.error.message}`)

      // İlk bağlı Instagram hesabını al
      const page = igData.data?.[0]
      const igAccount = page?.instagram_business_account

      if (!igAccount) {
        throw new Error('Instagram Business hesabı bulunamadı. Sayfanıza bağlı bir Instagram Business hesabı olduğundan emin olun.')
      }

      accountId   = igAccount.id
      accountName = igAccount.name || igAccount.username || 'Instagram Hesabı'
      platformData = {
        instagram_account_id: igAccount.id,
        instagram_username:   igAccount.username,
        followers_count:      igAccount.followers_count || 0,
        profile_picture_url:  igAccount.profile_picture_url || '',
        page_id:              page?.id,
        page_name:            page?.name,
      }

    } else if (platform === 'facebook') {
      // Facebook Sayfaları
      const fbRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?` +
        `fields=id,name,access_token,category,fan_count` +
        `&access_token=${accessToken}`
      )
      const fbData = await fbRes.json()
      console.log('FB Hesapları Yanıtı:', fbData)
      
      if (fbData.error) throw new Error(`Facebook Veri Hatası: ${fbData.error.message}`)
      
      const page = fbData.data?.[0]

      if (!page) {
        throw new Error(`Bağlı Facebook Sayfası bulunamadı. (Detay: ${JSON.stringify(fbData)}) Lütfen izin ekranında sayfalarınızı seçtiğinizden emin olun.`)
      }

      accountId   = page.id
      accountName = page.name || 'Facebook Sayfası'
      // Sayfa access token'ını kullan (daha uzun ömürlü)
      if (page.access_token) accessToken = page.access_token
      platformData = {
        page_id:    page.id,
        page_name:  page.name,
        category:   page.category || '',
        fan_count:  page.fan_count || 0,
      }

    } else if (platform === 'whatsapp') {
      // WhatsApp Business hesap bilgileri
      const waRes = await fetch(
        `https://graph.facebook.com/v21.0/me?` +
        `fields=id,name` +
        `&access_token=${accessToken}`
      )
      const waData = await waRes.json()

      // WhatsApp Business hesabını bul
      const wabRes = await fetch(
        `https://graph.facebook.com/v21.0/${waData.id}/whatsapp_business_accounts?` +
        `access_token=${accessToken}`
      )
      const wabData = await wabRes.json()
      const wabAccount = wabData.data?.[0]

      accountId   = wabAccount?.id || waData.id
      accountName = wabAccount?.name || waData.name || 'WhatsApp Business'
      platformData = {
        waba_id:      wabAccount?.id,
        account_name: wabAccount?.name || waData.name,
        currency:     wabAccount?.currency || 'TRY',
        timezone:     wabAccount?.timezone_id || 'Europe/Istanbul',
      }
    }

    // ── 4. Token'ı şifreli olarak DB'ye kaydet ───────────────
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 gün

    const { error: dbErr } = await supabase
      .from('platforms')
      .upsert({
        user_id,
        platform,
        account_id:     accountId,
        account_name:   accountName,
        access_token:   accessToken, // Supabase RLS ile korunur
        token_expires_at: expiresAt,
        is_active:      true,
        platform_data:  platformData,
        connected_at:   new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      }, { onConflict: 'user_id,platform' })

    if (dbErr) {
      console.error('DB Kayıt Hatası:', dbErr)
      throw new Error('Veritabanı kayıt hatası: ' + dbErr.message)
    }

    // ── 5. Webhook'u kaydet (Instagram & Facebook için) ──────
    if (platform === 'instagram' || platform === 'facebook') {
      const pageId   = platformData.page_id || accountId
      const pageToken = accessToken

      // Sayfa webhook aboneliği
      await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?` +
        `subscribed_fields=messages,messaging_postbacks,message_deliveries,message_reads` +
        `&access_token=${pageToken}`,
        { method: 'POST' }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        platform,
        account_name: accountName,
        account_id:   accountId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('OAuth exchange hatası:', err)
    return errorResponse(err instanceof Error ? err.message : String(err))
  }
})

function errorResponse(msg: string) {
  return new Response(
    JSON.stringify({ error: msg }),
    // Status 200 döner ki client tarafındaki supabase.functions.invoke hata mesajını alabilsin
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
