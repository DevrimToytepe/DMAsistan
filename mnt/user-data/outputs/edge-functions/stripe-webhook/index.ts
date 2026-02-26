// ============================================================
// supabase/functions/stripe-webhook/index.ts
// Stripe → Supabase webhook işleyici
//
// KURULUM:
// supabase functions deploy stripe-webhook
// supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
//
// Stripe Dashboard → Webhooks → Add endpoint:
// URL: https://PROJE_ID.supabase.co/functions/v1/stripe-webhook
// Events: customer.subscription.created, updated, deleted
//         invoice.payment_succeeded, invoice.payment_failed
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

// Plan eşleştirme (Stripe Price ID → plan adı)
const PRICE_TO_PLAN: Record<string, string> = {
  'price_MONTHLY_ID_BURAYA': 'pro',
  'price_YEARLY_ID_BURAYA':  'pro',
  // enterprise eklenirse buraya ekle
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret)
  } catch (err) {
    console.error('Webhook imzası geçersiz:', err.message)
    return new Response('Invalid signature', { status: 400 })
  }

  console.log('Webhook event:', event.type)

  try {
    switch (event.type) {

      // ── Abonelik oluşturuldu / güncellendi ──
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const priceId = sub.items.data[0]?.price.id
        const plan = PRICE_TO_PLAN[priceId] || 'free'
        const status = sub.status
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString()
        const periodStart = new Date(sub.current_period_start * 1000).toISOString()

        // Kullanıcıyı bul
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!profile) { console.error('Kullanıcı bulunamadı:', customerId); break }

        // Profil güncelle
        await supabase.from('profiles').update({
          plan,
          plan_expires_at: periodEnd,
          stripe_subscription_id: sub.id,
          updated_at: new Date().toISOString()
        }).eq('stripe_customer_id', customerId)

        // Subscription tablosu upsert
        await supabase.from('subscriptions').upsert({
          user_id:                profile.id,
          stripe_subscription_id: sub.id,
          stripe_customer_id:     customerId,
          plan,
          status,
          current_period_start:   periodStart,
          current_period_end:     periodEnd,
          cancel_at_period_end:   sub.cancel_at_period_end,
          updated_at: new Date().toISOString()
        }, { onConflict: 'stripe_subscription_id' })

        console.log(`✅ Plan güncellendi: ${customerId} → ${plan}`)
        break
      }

      // ── Abonelik iptal edildi ──
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string

        await supabase.from('profiles').update({
          plan: 'free',
          plan_expires_at: null,
          stripe_subscription_id: null,
          updated_at: new Date().toISOString()
        }).eq('stripe_customer_id', customerId)

        await supabase.from('subscriptions').update({
          status: 'canceled',
          updated_at: new Date().toISOString()
        }).eq('stripe_subscription_id', sub.id)

        console.log(`❌ Abonelik iptal: ${customerId}`)
        break
      }

      // ── Ödeme başarılı ──
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        console.log(`💰 Ödeme başarılı: ${customerId}`)
        break
      }

      // ── Ödeme başarısız ──
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        await supabase.from('subscriptions').update({
          status: 'past_due',
          updated_at: new Date().toISOString()
        }).eq('stripe_customer_id', customerId)

        console.warn(`⚠️ Ödeme başarısız: ${customerId}`)
        break
      }

      default:
        console.log(`Bilinmeyen event: ${event.type}`)
    }
  } catch (err) {
    console.error('Event işleme hatası:', err)
    return new Response('Event processing error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
