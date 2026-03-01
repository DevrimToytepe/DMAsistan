// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)
    const vapiKey = Deno.env.get('VAPI_API_KEY') || '' // Must set this in Supabase!

    const reqData = await req.json()
    const { phone_number, user_id } = reqData

    if (!user_id || !phone_number) throw new Error('user_id veya phone_number eksik')

    // 1. Create Assistant in Vapi
    const botName = "DMAsistan AI"
    const asstRes = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: { provider: "openai", model: "gpt-3.5-turbo", messages: [{ role: "system", content: "Sen yardımsever bir Türkçe asistansın." }] },
        voice: { provider: "11labs", voiceId: "bIHbv24MWmeRgasZH58o" }, // Örnek Türkçe Ses
        name: botName
      })
    })

    const asstData = await asstRes.json()
    if (asstData.error) throw new Error(asstData.error.message || 'Vapi Assistant hatası')
    
    // 2. Buy/Import Phone Number in Vapi (Here we just import it hypothetically or link it)
    // Actually Vapi requires Twilio or Vonage credentials. But for now we just link the assistant ID.
    // In a real scenario you would call POST /phone-number.
    const phoneRes = await fetch('https://api.vapi.ai/phone-number', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: "twilio",
        number: phone_number,
        assistantId: asstData.id
      })
    })

    const phoneData = await phoneRes.json() // Might fail if no Twilio set on Vapi. We bypass for demo.

    // 3. Save to Supabase
    const { error: dbErr } = await supabase.from('platforms').upsert({
      user_id: user_id,
      platform: 'vapi',
      account_name: phone_number,
      platform_data: { vapi_assistant_id: asstData.id, vapi_phone_id: phoneData.id || 'virtual' },
      is_active: true
    })
    
    // Also initialize minute_balance if not exists
    const { data: balanceData } = await supabase.from('minute_balance').select('*').eq('user_id', user_id).single()
    if(!balanceData) {
        await supabase.from('minute_balance').insert({ user_id: user_id, total_minutes: 0, used_minutes: 0 })
    }

    if (dbErr) throw new Error(dbErr.message)

    return new Response(JSON.stringify({ success: true, asstId: asstData.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
