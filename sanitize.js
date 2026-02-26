/**
 * sanitize.js — DMAsistan Input Güvenliği
 * XSS koruması, input sanitizasyonu, dosya validasyonu
 */

import CONFIG from './config.js'

// ─────────────────────────────────────────────────────────────
// XSS KORUMASI
// ─────────────────────────────────────────────────────────────

/**
 * HTML özel karakterleri escape et (XSS önleme)
 * Kullanıcı metnini DOM'a yazacaksan bu fonksiyondan geçir.
 * NOT: innerHTML yerine textContent tercih et; bu sadece fallback için.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '')
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

/**
 * Kullanıcı input'unu sanitize et:
 * - Başındaki/sonundaki boşlukları kırp
 * - 0-kontrol karakterlerini sil
 * - max uzunluk uygula
 * @param {string} input
 * @param {number} [maxLength=10000]
 * @returns {string}
 */
export function sanitizeText(input, maxLength = 10000) {
    if (typeof input !== 'string') return ''
    return input
        .trim()
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // kontrol karakterleri sil
        .slice(0, maxLength)
}

/**
 * URL'yi sanitize et — sadece http/https izin ver
 * @param {string} url
 * @returns {string|null}
 */
export function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return null
    try {
        const parsed = new URL(url.trim())
        if (!['http:', 'https:'].includes(parsed.protocol)) return null
        return parsed.href
    } catch {
        return null
    }
}

/**
 * Mesaj içeriğini sanitize et (XSS + limit)
 * @param {string} content
 * @returns {string}
 */
export function sanitizeMessage(content) {
    return sanitizeText(content, 5000)
}

/**
 * Kişi notu sanitize et
 * @param {string} notes
 * @returns {string}
 */
export function sanitizeNotes(notes) {
    return sanitizeText(notes, 2000)
}

/**
 * Keyword sanitize et
 * @param {string} keyword
 * @returns {string}
 */
export function sanitizeKeyword(keyword) {
    return sanitizeText(keyword, 200)
}

// ─────────────────────────────────────────────────────────────
// DOSYA YÜKLEME VALİDASYONU
// ─────────────────────────────────────────────────────────────

/**
 * Avatar/dosya yükleme öncesi doğrulama
 * @param {File} file          - Yüklenecek dosya
 * @param {string[]} [allowedTypes] - İzin verilen MIME tipler
 * @param {number} [maxSize]   - Max byte (default: CONFIG.MAX_FILE_SIZE)
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFile(
    file,
    allowedTypes = CONFIG.ALLOWED_MIME,
    maxSize = CONFIG.MAX_FILE_SIZE
) {
    if (!file) {
        return { valid: false, error: 'Dosya seçilmedi.' }
    }

    // MIME type kontrolü (uzantı değil, gerçek MIME tipi)
    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Sadece ${allowedTypes.map(m => m.split('/')[1].toUpperCase()).join(', ')} dosyaları yüklenebilir.`
        }
    }

    // Boyut kontrolü
    if (file.size > maxSize) {
        const maxMB = Math.round(maxSize / 1024 / 1024)
        return {
            valid: false,
            error: `Dosya boyutu ${maxMB}MB'dan büyük olamaz. (Mevcut: ${(file.size / 1024 / 1024).toFixed(1)}MB)`
        }
    }

    return { valid: true }
}

/**
 * Dosya adını UUID ile yeniden adlandır (güvenli dosya adı)
 * @param {File} file
 * @returns {string}  - örn: "550e8400-e29b.webp"
 */
export function generateSafeFileName(file) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const uuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    return `${uuid}.${ext}`
}

// ─────────────────────────────────────────────────────────────
// TELEFON NUMARASI
// ─────────────────────────────────────────────────────────────

/**
 * Telefon numarası E.164 formatına dönüştür
 * Basit versiyon — libphonenumber yüklü değilse kullan
 * @param {string} phone   - Kullanıcı girişi
 * @param {string} [dialCode] - Ülke kodu (örn: '+90')
 * @returns {string|null}
 */
export function normalizePhone(phone, dialCode = '+90') {
    if (!phone) return null
    // Sadece rakam ve + bırak
    let digits = phone.replace(/[^\d+]/g, '')

    if (digits.startsWith('+')) {
        // Zaten uluslararası formatta
        return digits.length >= 10 ? digits : null
    }

    // Başındaki 0'ı kaldır (Türkiye için 05xx → +905xx)
    if (digits.startsWith('0')) digits = digits.slice(1)

    const full = `${dialCode}${digits}`
    // E.164: + ile başlamalı, min 10, max 15 rakam
    return /^\+[1-9]\d{9,14}$/.test(full) ? full : null
}

// ─────────────────────────────────────────────────────────────
// RATE LIMITING (Client-Side)
// ─────────────────────────────────────────────────────────────

/**
 * Client-side rate limiter
 * Belirli bir key için deneme sayısını takip eder.
 * Aşılırsa lockout döner ve geri sayım gösterir.
 * 
 * @example
 * const limiter = createRateLimiter('login', 5, 30000)
 * if (!limiter.check()) { showError(limiter.message()); return }
 * limiter.record()
 */
export function createRateLimiter(key, maxAttempts, lockoutMs) {
    const storageKey = `dma_rl_${key}`

    function getData() {
        try {
            return JSON.parse(localStorage.getItem(storageKey) || '{"attempts":0,"lockedUntil":0}')
        } catch {
            return { attempts: 0, lockedUntil: 0 }
        }
    }

    function setData(data) {
        localStorage.setItem(storageKey, JSON.stringify(data))
    }

    return {
        /** Denemeye izin var mı kontrol et */
        check() {
            const data = getData()
            if (data.lockedUntil && Date.now() < data.lockedUntil) return false
            // Lockout süresi geçmişse sıfırla
            if (data.lockedUntil && Date.now() >= data.lockedUntil) {
                setData({ attempts: 0, lockedUntil: 0 })
            }
            return true
        },

        /** Başarısız denemeyi kaydet */
        record() {
            const data = getData()
            data.attempts = (data.attempts || 0) + 1
            if (data.attempts >= maxAttempts) {
                data.lockedUntil = Date.now() + lockoutMs
            }
            setData(data)
        },

        /** Başarılı girişte sıfırla */
        reset() {
            localStorage.removeItem(storageKey)
        },

        /** Kalan kilit süresi (saniye) */
        remainingSeconds() {
            const data = getData()
            if (!data.lockedUntil) return 0
            return Math.max(0, Math.ceil((data.lockedUntil - Date.now()) / 1000))
        },

        /** Kullanıcıya gösterilecek mesaj */
        message() {
            const sec = this.remainingSeconds()
            return sec > 0
                ? `Çok fazla deneme. ${sec} saniye bekleyin.`
                : 'Lütfen tekrar deneyin.'
        }
    }
}

// ─────────────────────────────────────────────────────────────
// DEBOUNCE
// ─────────────────────────────────────────────────────────────

/**
 * Debounce — arama/filter inputları için
 * @param {Function} fn
 * @param {number} delay - ms (default: CONFIG.SEARCH_DEBOUNCE_MS)
 * @returns {Function}
 */
export function debounce(fn, delay = CONFIG.SEARCH_DEBOUNCE_MS) {
    let timer
    return function (...args) {
        clearTimeout(timer)
        timer = setTimeout(() => fn.apply(this, args), delay)
    }
}
