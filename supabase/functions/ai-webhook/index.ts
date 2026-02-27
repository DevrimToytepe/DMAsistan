// supabase/functions/ai-webhook/index.ts
// Platform'dan gelen mesajı OpenAI GPT-4'e gönderir, yanıtı DB'ye yazar
//
// KURULUM:
// supabase functions deploy ai-webhook
// supabase secrets set OPENAI_API_KEY=sk-xxx

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
const supabase = createClient(
  // @ts-ignore
  Deno.env.get('SUPABASE_URL') || '',
  // @ts-ignore
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

// ─── GPT-4 Yanıt Üret ───────────────────────────────────────
async function generateAIReply(
  userMessage: string,
  aiSettings: Record<string, string>,
  conversationHistory: { role: string; content: string }[]
): Promise<string> {
  // @ts-ignore
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) throw new Error('OPENAI_API_KEY secret eksik. (Lütfen Supabase Dashboard -> Edge Functions -> Secrets kısmına OPENAI_API_KEY ekleyin.)')

  const systemPrompt = buildSystemPrompt(aiSettings)

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // Son 10 mesaj (context window)
    { role: 'user', content: userMessage },
  ]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Maliyet optimizasyonu için mini; gpt-4o da kullanılabilir
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API hatası: ${err}`)
  }

  const data = await res.json()
  return data.choices[0]?.message?.content?.trim() || 'Üzgünüm, şu an yanıt veremiyorum.'
}

// ─── Sistem Promptu Oluştur ──────────────────────────────────
function buildSystemPrompt(settings: Record<string, string>): string {
  const businessName = settings?.business_name || 'İşletme'
  const tone = settings?.tone || 'professional'
  const language = settings?.language || 'tr'
  const customPrompt = settings?.custom_prompt || ''

  const toneMap: Record<string, string> = {
    professional: 'Profesyonel ve nazik bir dil kullan.',
    friendly:     'Samimi ve sıcak bir dil kullan, emoji kullanabilirsin.',
    formal:       'Resmi ve kurumsal bir az kullan.',
    casual:       'Günlük ve rahat bir dil kullan.',
  }

  return `Sen ${businessName} adlı işletmenin müşteri hizmetleri AI asistanısın.
Dil: ${language === 'tr' ? 'Türkçe' : 'İngilizce'}
Ton: ${toneMap[tone] || toneMap.professional}
Görevin: Müşteri sorularını yanıtlamak, ürün/hizmet bilgisi vermek, satışa yönlendirmek.
Kısa ve öz cevaplar ver. 2-3 cümleyi geçme.
${customPrompt ? `\nEk Talimatlar: ${customPrompt}` : ''}
Eğer sormak istediğin bir şey varsa sadece 1 soru sor.
Asla uydurma bilgi verme; bilmiyorsan "Bu konuda size daha iyi yardımcı olmak için sizi ekibimizle buluşturayım." de.`
}

// ─── Ana Handler ─────────────────────────────────────────────
// @ts-ignore
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const {
      conversation_id,
      user_id,
      message,        // Gelen kullanıcı mesajı
      platform,       // 'instagram' | 'whatsapp' | 'facebook' | 'tiktok'
      sender_id,      // Platform'daki gönderici ID
      sender_name,    // Gönderici adı (opsiyonel)
    } = await req.json()

    if (!conversation_id || !user_id || !message) {
      return new Response(JSON.stringify({ error: 'conversation_id, user_id ve message zorunlu' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. AI ayarlarını getir
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('user_id', user_id)
      .single()

    // AI kapalıysa işlemi durdur
    if (aiSettings && aiSettings.is_active === false) {
      return new Response(JSON.stringify({ skipped: true, reason: 'AI kapalı' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Konuşmayı getir / oluştur
    let convId = conversation_id
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, status')
      .eq('id', convId)
      .single()

    if (!conv) {
      // Yeni konuşma oluştur
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          user_id,
          platform,
          sender_id,
          sender_name: sender_name || sender_id,
          status: 'open',
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single()
      convId = newConv?.id
    }

    // 3. Kullanıcı mesajını DB'ye kaydet
    await supabase.from('messages').insert({
      conversation_id: convId,
      user_id,
      content: message,
      direction: 'inbound',
      is_ai: false,
      platform,
      sender_id,
    })

    // 4. Son 10 mesajı geçmiş olarak al
    const { data: history } = await supabase
      .from('messages')
      .select('content, direction, is_ai')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(10)

    const conversationHistory = (history || [])
      .reverse()
      .map((m: any) => ({
        role: m.direction === 'outbound' ? 'assistant' : 'user',
        content: m.content,
      }))

    // 5. GPT-4 ile yanıt üret
    const aiReply = await generateAIReply(message, aiSettings || {}, conversationHistory)

    // 6. AI yanıtını DB'ye kaydet
    const { data: savedReply } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        user_id,
        content: aiReply,
        direction: 'outbound',
        is_ai: true,
        platform,
      })
      .select()
      .single()

    // 7. Konuşmanın son mesaj zamanını güncelle
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', convId)

    // 8. Kullanım logu
    await supabase.from('usage_logs').insert({
      user_id,
      action: 'ai_reply',
      platform,
      metadata: { conversation_id: convId, message_length: message.length },
    })

    // 9. Analytics event
    await supabase.from('analytics_events').insert({
      user_id,
      event_type: 'ai_replied',
      platform,
    })

    return new Response(
      JSON.stringify({
        success: true,
        reply: aiReply,
        message_id: savedReply?.id,
        conversation_id: convId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('AI webhook hatası:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
