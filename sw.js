/**
 * sw.js — DMAsistan Service Worker
 * Strateji: Cache-first statik dosyalar, Network-first API çağrıları
 * Offline sayfası: /offline.html
 */

const CACHE_VERSION = 'dma-v1'
const OFFLINE_URL = '/offline.html'

// Önbelleğe alınacak statik dosyalar (app shell)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/main.js',
    '/offline.html',
    '/config.js',
    '/i18n.js',
    '/monitor.js',
    '/sanitize.js',
]

// ─────────────────────────────────────────────────────────────
// INSTALL — Statik dosyaları önbelleğe al
// ─────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(async (cache) => {
            // Her dosyayı ayrı ayrı dene, hata olursa atla
            await Promise.allSettled(
                STATIC_ASSETS.map(url => cache.add(url).catch(() => { }))
            )
        }).then(() => self.skipWaiting())
    )
})

// ─────────────────────────────────────────────────────────────
// ACTIVATE — Eski cache sürümlerini sil
// ─────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_VERSION)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    )
})

// ─────────────────────────────────────────────────────────────
// FETCH — İstek stratejileri
// ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Chrome extension ve non-HTTP isteklerini atla
    if (!url.protocol.startsWith('http')) return

    // Supabase API istekleri → Network-only (cache'e alma)
    if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.io')) {
        event.respondWith(fetch(request).catch(() => new Response(
            JSON.stringify({ error: 'Offline' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        )))
        return
    }

    // POST/PUT/DELETE → Network-only
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        event.respondWith(networkOnly(request))
        return
    }

    // HTML sayfaları → Network-first, offline'da offline.html
    if (request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(networkFirstWithOfflineFallback(request))
        return
    }

    // Statik dosyalar (JS, CSS, görseller) → Cache-first
    event.respondWith(cacheFirst(request))
})

// ─────────────────────────────────────────────────────────────
// STRATEJI FONKSİYONLARI
// ─────────────────────────────────────────────────────────────

async function cacheFirst(request) {
    const cached = await caches.match(request)
    if (cached) return cached

    try {
        const response = await fetch(request)
        if (response.ok) {
            const cache = await caches.open(CACHE_VERSION)
            cache.put(request, response.clone())
        }
        return response
    } catch {
        return new Response('Dosya yüklenemedi', { status: 503 })
    }
}

async function networkFirstWithOfflineFallback(request) {
    try {
        const response = await fetch(request)
        // Başarılı yanıtı cache'e al
        if (response.ok) {
            const cache = await caches.open(CACHE_VERSION)
            cache.put(request, response.clone())
        }
        return response
    } catch {
        // Cache'te var mı?
        const cached = await caches.match(request)
        if (cached) return cached

        // Offline sayfasını döndür
        const offlinePage = await caches.match(OFFLINE_URL)
        return offlinePage || new Response('<h1>Çevrimdışısınız</h1>', {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        })
    }
}

async function networkOnly(request) {
    try {
        return await fetch(request)
    } catch {
        return new Response(
            JSON.stringify({ error: 'Çevrimdışısınız. İşlem bekletiliyor.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
    }
}

// ─────────────────────────────────────────────────────────────
// BACKGROUND SYNC (bekleyen işlemleri online'a dönünce gönder)
// ─────────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
    if (event.tag === 'dma-retry-queue') {
        event.waitUntil(processRetryQueue())
    }
})

async function processRetryQueue() {
    // Bu fonksiyon ileride IndexedDB tabanlı retry kuyruğu ile genişletilebilir
    // Şimdilik tüm açık sayfaları yenile
    const clients = await self.clients.matchAll()
    clients.forEach(client => client.postMessage({ type: 'ONLINE_RETRY' }))
}
