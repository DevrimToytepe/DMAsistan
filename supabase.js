// supabase.js — CDN versiyonu (npm gerekmez)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm'
import CONFIG from './config.js'

/**
 * Supabase istemcisi.
 * URL ve ANON_KEY değerleri config.js → window.ENV → sabit fallback sırasıyla gelir.
 * Production'da Vercel environment variables kullan.
 */
export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,   // Token localStorage'da kalsın
    autoRefreshToken: true,   // Token otomatik yenilensin
    detectSessionInUrl: true, // OAuth callback'lerini yakala
  }
})

/**
 * Token expire olunca login sayfasına at.
 * auth-guard.js dışındaki sayfalarda da güvence sağlar.
 */
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    // Token yenilendi — session devam ediyor, işlem yok
    return
  }
  if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESH_FAILED' && !session)) {
    const publicPages = ['giris.html', 'kayit.html', 'index.html', 'sifre-sifirla.html', '']
    const isPublic = publicPages.some(p => window.location.pathname.endsWith(p))
    if (!isPublic) {
      window.location.replace('giris.html?reason=expired')
    }
  }
})
