// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const vapiKey = Deno.env.get('VAPI_API_KEY') || ''

    const payload = await req.json()
    // Vapi webhook payload usually contains cost or duration in seconds.
    // Example: call_ended -> message.durationMinutes or message.durationSeconds
    
    if (payload.message && payload.message.type === 'end-of-call-report') {
      const callData = payload.message;
      const durationSeconds = callData.durationSeconds || 0;
      const minutesUsed = Math.ceil(durationSeconds / 60);

      const assistantId = callData.assistantId; // find user by assistant ID
      if(!assistantId) return new Response('No assistant ID', { status: 200 })

      // Find user
      const { data: plat } = await supabase.from('platforms').select('user_id').eq('platform', 'vapi').contains('platform_data', { vapi_assistant_id: assistantId }).single()
      if(!plat) return new Response('User not found', { status: 200 })

      const uid = plat.user_id

      // Update minute_balance
      const { data: balance } = await supabase.from('minute_balance').select('*').eq('user_id', uid).single()
      if(balance) {
          const newUsed = (balance.used_minutes || 0) + minutesUsed;
          await supabase.from('minute_balance').update({ used_minutes: newUsed }).eq('user_id', uid)

          // If minutes zero -> disable assistant
          if(newUsed >= balance.total_minutes) {
              await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
                  method: 'PATCH',
                  headers: { 'Authorization': `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: "DISABLED" }) // Deactivating it loosely
              })
              // Also deactivate the platform in DB
              await supabase.from('platforms').update({ is_active: false }).eq('user_id', uid).eq('platform', 'vapi')
          }
      }
    }

    return new Response('ok', { status: 200 })
  } catch(e) {
    return new Response(e.message, { status: 500 })
  }
})
