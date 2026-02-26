/**
 * config.js — DMAsistan Merkezi Konfigürasyon
 * Tüm sayfalar bu dosyadan import eder.
 * Hardcoded değer YOK — environment veya fallback'e güvenir.
 */

const CONFIG = {
    // ── Supabase ──────────────────────────────────────────────────
    SUPABASE_URL: window.ENV?.SUPABASE_URL || 'https://ohoazazkrntbdqzmjonh.supabase.co',
    SUPABASE_ANON_KEY: window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQwNjA3OTM0LCJleHAiOjIwNTYxODM5MzR9.Lh_YFhR-Jp_vG9L5HwogF_gqP3QObEwrkA_LIPCa4qkY',

    // ── Uygulama ──────────────────────────────────────────────────
    APP_NAME: 'DMAsistan',
    APP_VERSION: '1.0.0',
    APP_URL: window.ENV?.APP_URL || 'https://dm-asistan.vercel.app',

    // ── Dosya Yükleme ──────────────────────────────────────────────
    MAX_FILE_SIZE: 5 * 1024 * 1024,   // 5 MB
    ALLOWED_MIME: ['image/jpeg', 'image/png', 'image/webp'],

    // ── Pagination ────────────────────────────────────────────────
    ITEMS_PER_PAGE: 20,
    MESSAGES_PER_PAGE: 50,

    // ── Rate Limiting ────────────────────────────────────────────
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MS: 30 * 1000,      // 30 saniye
    MAX_KEYWORDS_PER_USER: 100,

    // ── Session ──────────────────────────────────────────────────
    SESSION_TIMEOUT_MS: 24 * 60 * 60 * 1000, // 24 saat

    // ── Debounce ──────────────────────────────────────────────────
    SEARCH_DEBOUNCE_MS: 300,

    // ── i18n ──────────────────────────────────────────────────────
    DEFAULT_LANGUAGE: 'tr',
    SUPPORTED_LANGS: ['tr', 'en'],
}

// Dondur — yanlışlıkla üzerine yazılmasın
Object.freeze(CONFIG)

export default CONFIG
