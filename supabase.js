// supabase.js — CDN versiyonu (npm gerekmez)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// ⚠️ Supabase Dashboard → Project Settings → API'den al
const SUPABASE_URL      = 'https://ohoazazkrntbdqzmjonh.supabase.co'   // buraya kendi URL'ini yaz
const SUPABASE_ANON_KEY = 'sb_publishable_uAP81oO1N5qirA38auSn4w_0hLAh68n'                          // buraya anon key'ini yaz

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,    // Token localStorage'da kalsın
    autoRefreshToken: true,  // Token otomatik yenilensin
  }
})
