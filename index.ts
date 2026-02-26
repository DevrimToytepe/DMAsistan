// ============================================================
// supabase/functions/create-checkout-session/index.ts
// Supabase Edge Function — Stripe Checkout oturumu oluştur
//
// KURULUM:
// supabase functions deploy create-checkout-session
// supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { price_id, user_id, user_email, success_url, cancel_url } = await req.json()

    // Supabase client (service role)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Mevcut Stripe customer ID'sini al
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user_id)
      .single()

    let customerId = profile?.stripe_customer_id

    // Customer yoksa oluştur
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user_email,
        metadata: { supabase_user_id: user_id }
      })
      customerId = customer.id

      // Veritabanına kaydet
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user_id)
    }

    // Checkout session oluştur
    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      payment_method_types: ['card'],
      line_items: [{
        price:    price_id,
        quantity: 1,
      }],
      mode:        'subscription',
      success_url: success_url,
      cancel_url:  cancel_url,
      metadata: {
        user_id: user_id,
      },
      subscription_data: {
        metadata: { user_id: user_id }
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'tr',
    })

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
