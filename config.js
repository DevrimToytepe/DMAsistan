/**
 * config.js — DMAsistan Merkezi Konfigürasyon
 * Tüm sayfalar bu dosyadan import eder.
 * Hardcoded değer YOK — environment veya fallback'e güvenir.
 */

const CONFIG = {
    // ── Supabase ──────────────────────────────────────────────────
    SUPABASE_URL: window.ENV?.SUPABASE_URL || 'https://ohoazazkrntbdqzmjonh.supabase.co',
    SUPABASE_ANON_KEY: window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ob2F6YXprcm50YmRxem1qb25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTE4MTMsImV4cCI6MjA4NzQyNzgxM30.SiHM2wLrIW5DLl5Hwogf_gqP3QObEwrkA_LlPCa4qkY',

    // ── Uygulama ──────────────────────────────────────────────────
    APP_NAME: 'DMAsistan',
    APP_VERSION: '1.0.0',
    APP_URL: window.ENV?.APP_URL || 'https://dm-asistan.vercel.app',

    // ── Dosya Yükleme ──────────────────────────────────────────────
    MAX_FILE_SIZE: 5 * 1024 * 1024,   // 5 MB
    ALLOWED_MIME: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

    // ── Meta / Facebook API ────────────────────────────────────────────
    META_APP_ID: window.ENV?.META_APP_ID || '2017158822176401',

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
