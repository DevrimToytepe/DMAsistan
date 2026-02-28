// supabase/functions/send-message/index.ts
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
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { conv_id, content } = await req.json()
    if (!conv_id || !content) throw new Error('Eksik parametreler')

    // 1. Get the conversation
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conv_id)
      .single()

    if (!conv || convErr) throw new Error('Konuşma bulunamadı')

    // 2. Get the platform token
    const { data: platform, error: platErr } = await supabase
      .from('platforms')
      .select('access_token, platform_data')
      .eq('user_id', conv.user_id)
      .eq('platform', conv.platform)
      .eq('is_active', true)
      .single()

    if (!platform || platErr) throw new Error('Aktif platform bağlantısı yok')

    const platformId = conv.platform
    const recipientId = conv.sender_id
    const accessToken = platform.access_token

    // 3. Send message to Meta
    let metaRes;
    if (platformId === 'instagram' || platformId === 'facebook') {
      metaRes = await fetch('https://graph.facebook.com/v21.0/me/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: content },
        })
      })
    } else if (platformId === 'whatsapp') {
      const phoneNumberId = platform.platform_data?.waba_id;
      metaRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipientId,
          type: 'text',
          text: { body: content },
        })
      })
    } else {
      throw new Error('Desteklenmeyen platform: ' + platformId)
    }

    const metaData = await metaRes.json()
    console.log("META GÖNDERİM SONUCU:", metaData)
    
    // Eğer facebook bizim mesaj atmamıza izin vermediyse hata döneriz ve frontend'den görürüz
    if (metaData.error) {
       throw new Error(metaData.error.message || 'Meta hatası')
    }

    return new Response(JSON.stringify({ success: true, data: metaData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
