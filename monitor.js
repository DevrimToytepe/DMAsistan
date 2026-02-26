/**
 * monitor.js — DMAsistan Global Monitoring & Error Tracking
 * 
 * Sağlar:
 *  - Global JS hata yakalama (window.onerror, unhandledrejection)
 *  - Hataları analytics_events tablosuna loglama
 *  - Kullanıcıya "Bir şeyler ters gitti" mesajı + otomatik refresh
 *  - Online/Offline bağlantı banner'ı
 *  - Supabase health check (ping)
 *  - Session timeout yönetimi (24 saat)
 *  - Sayfa açılışında page_view eventi
 */

import { supabase } from './supabase.js'

// ─────────────────────────────────────────────────────────────
// HATA LOGLAMA
// ─────────────────────────────────────────────────────────────

/**
 * Hatayı analytics_events tablosuna yazar.
 * Kritik self-fail senaryosunu önlemek için try/catch içinde.
 */
async function logError(errorData) {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        const userId = session?.user?.id

        await supabase.from('analytics_events').insert({
            user_id: userId || null,
            event_type: 'error_occurred',
            platform: null,
            metadata: {
                ...errorData,
                url: window.location.href,
                user_agent: navigator.userAgent.slice(0, 150),
                timestamp: new Date().toISOString(),
            }
        })
    } catch (_) {
        // Loglama başarısız olsa da uygulamayı engelleme
    }
}

// ── Kritik hata sayacı (sonsuz refresh döngüsü önleme) ──
let criticalErrorCount = 0
const MAX_AUTO_REFRESH = 2

function showCriticalErrorBanner(message) {
    // Daha önce gösterilmişse tekrar gösterme
    if (document.getElementById('dma-critical-error')) return

    const banner = document.createElement('div')
    banner.id = 'dma-critical-error'
    banner.setAttribute('role', 'alert')
    banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:99999;
    background:linear-gradient(135deg,#dc2626,#b91c1c);
    color:#fff;padding:16px 24px;text-align:center;
    font-family:system-ui,sans-serif;font-size:14px;
    box-shadow:0 4px 20px rgba(0,0,0,0.4);
  `
    let countdown = 3
    banner.textContent = `⚠️ ${message} — ${countdown} saniye içinde yenileniyor...`

    document.body.prepend(banner)

    const interval = setInterval(() => {
        countdown--
        if (countdown > 0) {
            banner.textContent = `⚠️ ${message} — ${countdown} saniye içinde yenileniyor...`
        } else {
            clearInterval(interval)
            window.location.reload()
        }
    }, 1000)
}

// ─────────────────────────────────────────────────────────────
// GLOBAL HATA HANDLER'LARI
// ─────────────────────────────────────────────────────────────

window.onerror = function (msg, src, line, col, error) {
    // Script kaynaklı küçük hatalar için sessiz log
    const isCritical = src && !src.includes('extension') && !src.includes('chrome')

    logError({
        type: 'js_error',
        message: String(msg).slice(0, 500),
        source: String(src || '').slice(0, 200),
        line,
        col,
        stack: error?.stack?.slice(0, 1000)
    })

    if (isCritical) {
        criticalErrorCount++
        if (criticalErrorCount <= MAX_AUTO_REFRESH) {
            showCriticalErrorBanner('Bir şeyler ters gitti')
        }
    }

    return false // tarayıcının varsayılan hata işlemesini engelleme
}

window.onunhandledrejection = function (event) {
    logError({
        type: 'unhandled_rejection',
        message: String(event.reason?.message || event.reason || 'Unhandled rejection').slice(0, 500),
        stack: event.reason?.stack?.slice(0, 1000)
    })
}

// ─────────────────────────────────────────────────────────────
// ONLINE / OFFLINE BANNER
// ─────────────────────────────────────────────────────────────

function createOfflineBanner() {
    if (document.getElementById('dma-offline-banner')) return

    const banner = document.createElement('div')
    banner.id = 'dma-offline-banner'
    banner.setAttribute('role', 'alert')
    banner.setAttribute('aria-live', 'polite')
    banner.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:#1e293b;border:1px solid rgba(255,255,255,0.1);
    color:#f1f5f9;padding:12px 20px;border-radius:12px;
    font-family:system-ui,sans-serif;font-size:13px;
    display:flex;align-items:center;gap:10px;z-index:99998;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
    animation:slideUp 0.3s ease;
  `
    banner.innerHTML = `
    <span style="font-size:16px">📡</span>
    <span>İnternet bağlantınız kesildi. Otomatik olarak yeniden bağlanılacak.</span>
  `

    // Animasyon keyframe
    if (!document.getElementById('dma-offline-style')) {
        const style = document.createElement('style')
        style.id = 'dma-offline-style'
        style.textContent = `
      @keyframes slideUp {
        from { opacity:0; transform:translateX(-50%) translateY(20px); }
        to   { opacity:1; transform:translateX(-50%) translateY(0); }
      }
    `
        document.head.appendChild(style)
    }

    document.body.appendChild(banner)
}

function removeOfflineBanner() {
    const banner = document.getElementById('dma-offline-banner')
    if (!banner) return

    banner.style.background = '#166534'
    banner.innerHTML = `<span style="font-size:16px">✅</span><span>Bağlantı yeniden kuruldu.</span>`

    setTimeout(() => banner.remove(), 2500)
}

window.addEventListener('offline', createOfflineBanner)
window.addEventListener('online', removeOfflineBanner)

// Sayfa açılışında zaten offline ise banner'ı göster
if (!navigator.onLine) createOfflineBanner()

// ─────────────────────────────────────────────────────────────
// SUPABASE HEALTH CHECK (sessiz ping)
// ─────────────────────────────────────────────────────────────

export async function healthCheck() {
    try {
        // profiles tablosuna head sorgu — 0 veri çeker, sadece bağlantıyı test eder
        const { error } = await supabase
            .from('profiles')
            .select('id', { head: true, count: 'exact' })
            .limit(1)

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows — bu beklenen bir durum, hata değil
            createOfflineBanner()
            return false
        }
        return true
    } catch {
        createOfflineBanner()
        return false
    }
}

// ─────────────────────────────────────────────────────────────
// PAGE VIEW & SESSION TRACKING
// ─────────────────────────────────────────────────────────────

/**
 * Sayfa açılışında page_view eventi kaydet
 * @param {string} userId
 */
export async function trackPageView(userId) {
    if (!userId) return
    try {
        await supabase.from('analytics_events').insert({
            user_id: userId,
            event_type: 'page_view',
            metadata: {
                page: window.location.pathname,
                referrer: document.referrer.slice(0, 200),
                user_agent: navigator.userAgent.slice(0, 150),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                timestamp: new Date().toISOString(),
            }
        })
    } catch (_) { /* sessiz hata */ }
}

/**
 * Feature kullanım eventi kaydet
 * @param {string} userId
 * @param {string} feature  - örn: 'automation_created', 'contact_added'
 * @param {object} [meta]
 */
export async function trackFeatureUsed(userId, feature, meta = {}) {
    if (!userId) return
    try {
        await supabase.from('analytics_events').insert({
            user_id: userId,
            event_type: 'feature_used',
            metadata: {
                feature,
                platform: navigator.platform,
                user_agent: navigator.userAgent.slice(0, 100),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                ...meta,
            }
        })
    } catch (_) { /* sessiz hata */ }
}

// ─────────────────────────────────────────────────────────────
// SESSION TIMEOUT (24 SAAT)
// ─────────────────────────────────────────────────────────────

const SESSION_KEY = 'dma_session_start'
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000  // 24 saat (ms)
const WARN_BEFORE = 5 * 60 * 1000        //  5 dakika önceden uyar

export function initSessionTimeout() {
    const stored = localStorage.getItem(SESSION_KEY)
    const sessionStart = stored ? parseInt(stored, 10) : Date.now()

    if (!stored) localStorage.setItem(SESSION_KEY, sessionStart)

    const elapsed = Date.now() - sessionStart
    const remaining = SESSION_TIMEOUT - elapsed

    if (remaining <= 0) {
        // Zaten süresi dolmuş
        _doSessionLogout()
        return
    }

    // 5 dakika kala uyarı
    if (remaining > WARN_BEFORE) {
        setTimeout(showSessionWarning, remaining - WARN_BEFORE)
    } else {
        showSessionWarning()
    }

    // Tam süre dolunca logout
    setTimeout(_doSessionLogout, remaining)
}

function showSessionWarning() {
    if (document.getElementById('dma-session-warn')) return

    const warn = document.createElement('div')
    warn.id = 'dma-session-warn'
    warn.setAttribute('role', 'alert')
    warn.style.cssText = `
    position:fixed;top:16px;right:16px;z-index:99997;
    background:#92400e;border:1px solid #d97706;
    color:#fef3c7;padding:14px 18px;border-radius:10px;
    font-size:13px;font-family:system-ui,sans-serif;
    max-width:300px;box-shadow:0 4px 20px rgba(0,0,0,0.3);
  `
    warn.innerHTML = `
    ⏰ <strong>Oturum sona eriyor</strong><br>
    <small>5 dakika içinde otomatik çıkış yapılacak.</small>
    <button onclick="this.parentElement.remove()" style="
      margin-top:8px;display:block;background:rgba(255,255,255,0.2);
      border:none;color:inherit;padding:4px 10px;border-radius:6px;
      cursor:pointer;font-size:12px;
    ">Tamam</button>
  `
    document.body.appendChild(warn)

    setTimeout(() => warn?.remove(), 60000)
}

/** Oturumu sonlandır ve giriş sayfasına yönlendir */
async function _doSessionLogout() {
    localStorage.removeItem(SESSION_KEY)
    try {
        await supabase.auth.signOut()
    } catch (_) { }
    window.location.replace('/giris.html?reason=timeout')
}

/** Kullanıcı aktif işlem yapınca session timer'ı sıfırla */
export function resetSessionTimer() {
    localStorage.setItem(SESSION_KEY, Date.now())
}

// Kullanıcı aktivitesinde timer'ı sıfırla
;['click', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, () => resetSessionTimer(), { passive: true })
})
