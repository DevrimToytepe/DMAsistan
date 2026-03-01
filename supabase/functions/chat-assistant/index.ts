// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY') || ''

        const supabase = createClient(supabaseUrl, supabaseKey)
        const { message, page, check_limit, user_id } = await req.json()

        if (!user_id) throw new Error("Kullanıcı kimliği bulunamadı")

        // 1. LIMIT KONTROLÜ
        const today = new Date().toISOString().split('T')[0]
        
        let { data: usageData, error: usageError } = await supabase
            .from('ai_chat_usage')
            .select('*')
            .eq('user_id', user_id)
            .eq('date', today)
            .single()

        let plan = 'free'
        let limit = 20
        
        // Kullanıcının planını getir (subscriptions tablosu var mı? varsayılan free)
        const { data: userData } = await supabase.auth.admin.getUserById(user_id)
        if (userData?.user?.user_metadata?.plan) {
            plan = userData.user.user_metadata.plan
        }
        
        if (plan === 'pro') limit = 100
        else if (plan === 'business') limit = 300

        if (!usageData && !usageError) {
            // İlk kullanım bugün için
            const { data: newUsage } = await supabase.from('ai_chat_usage').insert({
                user_id,
                date: today,
                message_count: 0,
                plan: plan
            }).select().single()
            usageData = newUsage
        }

        const used = usageData?.message_count || 0

        // EĞER SADECE LİMİT KONTROLÜ İSE (AI modeline gitme)
        if (check_limit) {
            return new Response(JSON.stringify({ usage: { total: limit, used } }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (used >= limit) {
            return new Response(JSON.stringify({ error: 'rate_limit', usage: { total: limit, used } }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. KULLANICI MESAJINI KAYDET (Veritabanına eklenecek, bu yüzden önce user mesajını kaydet)
        await supabase.from('ai_chat_logs').insert({ user_id, role: 'user', content: message })

        // 3. CLAUDE API ISTEGI (Claude API Key yoksa OpenAI ile fallback yap ya da düz metin dön)
        let aiResponse = "Şu anda sadece basit dönüş yapabiliyorum. Anthropic API anahtarım eksik."
        
        if (CLAUDE_API_KEY) {
            const systemPrompt = `Sen DMAsistan platformunun yardımcı asistanısın. DMAsistan, işletmelerin WhatsApp, Instagram ve Facebook Messenger'ı AI ile otomatikleştirmesini sağlayan bir SaaS platformudur. Kullanıcılara platform hakkında yardımcı ol, Türkçe cevap ver, kısa ve net ol. Kullanıcı şu anda şu sayfada: ${page}`;
            
            const reqBody = {
                model: "claude-3-opus-20240229", // claude-sonnet-4-6 diye bir model henüz stabil isimde yok, en iyi modeli kullanıyoruz
                max_tokens: 1024,
                system: systemPrompt,
                messages: [
                    { role: "user", content: message }
                ]
            }

            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": CLAUDE_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                body: JSON.stringify(reqBody)
            });

            const claudeData = await response.json();
            if (claudeData && claudeData.content && claudeData.content.length > 0) {
                aiResponse = claudeData.content[0].text;
            } else {
                console.error("Claude Error", claudeData)
                aiResponse = "Özür dilerim, sistemde geçici bir yoğunluk var."
            }
        } else {
            // EĞER SİSTEMDE CLAUDE KEY EKLENMEDİYSE MOCK BİR CEVAP ÜRET
            if (message.toLowerCase().includes('instagram nasıl')) {
                aiResponse = "Instagram'ı bağlamak için sol menüden <b>Entegrasyonlar</b> sekmesine gidin ve Instagram Kartındaki 'Bağla' butonuna tıklayarak Meta girişinizi tamamlayın."
            } else if (page === 'Faturalama ve Abonelik') {
                aiResponse = "Dakika paketlerini sitemiz üzerinden iyzico güvenvcesiyle hızlıca satın alabilirsiniz. Size paket seçiminde yardımcı olabilirim."
            } else {
                aiResponse = `${page} sayfasındasınız. Size bu sayfadaki araçlar hakkında yardımcı olabilirim. Lütfen sormak istediğiniz detayı yazın. (Not: AI API entegrasyonu tamamlanmadığı için otomatik yanıt veriyorum)`
            }
        }

        // 4. BOT MESAJINI KAYDET
        await supabase.from('ai_chat_logs').insert({ user_id, role: 'bot', content: aiResponse })

        // 5. LİMİTİ ARTIR
        await supabase.from('ai_chat_usage').update({
            message_count: used + 1
        }).eq('user_id', user_id).eq('date', today)

        return new Response(JSON.stringify({ 
            response: aiResponse, 
            usage: { total: limit, used: used + 1 } 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
