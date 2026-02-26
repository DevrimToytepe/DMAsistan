/**
 * i18n.js — DMAsistan Çoklu Dil Desteği
 * Desteklenen diller: Türkçe (tr), İngilizce (en)
 * Kullanım: import { t, setLang, formatDate } from './i18n.js'
 */

// ─────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────

const translations = {
    tr: {
        // Genel
        'save': 'Kaydet',
        'cancel': 'İptal',
        'delete': 'Sil',
        'edit': 'Düzenle',
        'close': 'Kapat',
        'loading': 'Yükleniyor...',
        'error': 'Bir hata oluştu',
        'success': 'Başarılı!',
        'confirm': 'Onayla',
        'back': 'Geri',
        'next': 'Devam',
        'search': 'Ara...',
        'filter': 'Filtrele',
        'all': 'Tümü',
        'none': 'Yok',
        'yes': 'Evet',
        'no': 'Hayır',
        'retry': 'Tekrar Dene',
        'load_more': 'Daha Fazla Yükle',
        'no_data': 'Veri bulunamadı',
        'no_results': 'Sonuç bulunamadı',
        'empty_state': 'Henüz hiçbir şey yok',

        // Auth
        'login': 'Giriş Yap',
        'logout': 'Çıkış Yap',
        'register': 'Kayıt Ol',
        'email': 'E-posta',
        'password': 'Şifre',
        'forgot_password': 'Şifremi Unuttum',
        'session_expired': 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
        'session_warning': 'Oturumunuz 5 dakika içinde sona erecek.',

        // Navigation
        'dashboard': 'Gösterge Paneli',
        'conversations': 'Konuşmalar',
        'contacts': 'Kişiler',
        'automation': 'Otomasyon',
        'analytics': 'Analitik',
        'integrations': 'Entegrasyonlar',
        'billing': 'Faturalandırma',
        'settings': 'Ayarlar',

        // Dashboard
        'total_conversations': 'Toplam Konuşma',
        'monthly_messages': 'Aylık Mesaj',
        'total_contacts': 'Toplam Kişi',
        'active_platforms': 'Aktif Platform',
        'weekly_trend': 'Haftalık Trend',

        // Conversations
        'new_conversation': 'Yeni Konuşma',
        'open': 'Açık',
        'closed': 'Kapalı',
        'pending': 'Beklemede',
        'reply': 'Yanıtla',
        'mark_closed': 'Kapat',
        'unread': 'Okunmamış',

        // Contacts
        'add_contact': 'Kişi Ekle',
        'contact_name': 'Kişi Adı',
        'phone': 'Telefon',
        'status': 'Durum',
        'hot': 'Sıcak',
        'warm': 'Ilık',
        'cold': 'Soğuk',
        'customer': 'Müşteri',
        'notes': 'Notlar',

        // Errors
        'error_network': 'İnternet bağlantınızı kontrol edin.',
        'error_server': 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.',
        'error_unknown': 'Bilinmeyen bir hata oluştu.',
        'error_load': 'Veri yüklenemedi',
        'error_save': 'Kaydedilemedi',
        'error_delete': 'Silinemedi',
        'error_permission': 'Bu işlem için yetkiniz yok.',

        // Upload
        'upload_avatar': 'Fotoğraf Yükle',
        'upload_error_type': 'Sadece JPEG, PNG veya WebP dosyası yükleyebilirsiniz.',
        'upload_error_size': 'Dosya boyutu 5MB\'dan büyük olamaz.',

        // Offline
        'offline_title': 'Çevrimdışısınız',
        'offline_msg': 'İnternet bağlantınız kesildi. Bağlantı gelince otomatik devam edecek.',
        'online_restored': 'Bağlantı yeniden kuruldu.',

        // Rate limit
        'rate_limit_msg': (sec) => `Çok fazla deneme. ${sec} saniye bekleyin.`,

        // Dates
        'today': 'Bugün',
        'yesterday': 'Dün',
        'date_format': 'GG.AA.YYYY',

        // Pagination
        'page_of': (current, total) => `Sayfa ${current} / ${total}`,
        'showing': (from, to, total) => `${from}–${to} arası, toplam ${total} kayıt`,
    },

    en: {
        // General
        'save': 'Save',
        'cancel': 'Cancel',
        'delete': 'Delete',
        'edit': 'Edit',
        'close': 'Close',
        'loading': 'Loading...',
        'error': 'An error occurred',
        'success': 'Success!',
        'confirm': 'Confirm',
        'back': 'Back',
        'next': 'Next',
        'search': 'Search...',
        'filter': 'Filter',
        'all': 'All',
        'none': 'None',
        'yes': 'Yes',
        'no': 'No',
        'retry': 'Retry',
        'load_more': 'Load More',
        'no_data': 'No data found',
        'no_results': 'No results found',
        'empty_state': 'Nothing here yet',

        // Auth
        'login': 'Sign In',
        'logout': 'Sign Out',
        'register': 'Sign Up',
        'email': 'Email',
        'password': 'Password',
        'forgot_password': 'Forgot Password',
        'session_expired': 'Your session has expired. Please sign in again.',
        'session_warning': 'Your session will expire in 5 minutes.',

        // Navigation
        'dashboard': 'Dashboard',
        'conversations': 'Conversations',
        'contacts': 'Contacts',
        'automation': 'Automation',
        'analytics': 'Analytics',
        'integrations': 'Integrations',
        'billing': 'Billing',
        'settings': 'Settings',

        // Dashboard
        'total_conversations': 'Total Conversations',
        'monthly_messages': 'Monthly Messages',
        'total_contacts': 'Total Contacts',
        'active_platforms': 'Active Platforms',
        'weekly_trend': 'Weekly Trend',

        // Conversations
        'new_conversation': 'New Conversation',
        'open': 'Open',
        'closed': 'Closed',
        'pending': 'Pending',
        'reply': 'Reply',
        'mark_closed': 'Close',
        'unread': 'Unread',

        // Contacts
        'add_contact': 'Add Contact',
        'contact_name': 'Contact Name',
        'phone': 'Phone',
        'status': 'Status',
        'hot': 'Hot',
        'warm': 'Warm',
        'cold': 'Cold',
        'customer': 'Customer',
        'notes': 'Notes',

        // Errors
        'error_network': 'Please check your internet connection.',
        'error_server': 'Server error. Please try again later.',
        'error_unknown': 'An unknown error occurred.',
        'error_load': 'Failed to load data',
        'error_save': 'Failed to save',
        'error_delete': 'Failed to delete',
        'error_permission': 'You do not have permission for this action.',

        // Upload
        'upload_avatar': 'Upload Photo',
        'upload_error_type': 'Only JPEG, PNG or WebP files are allowed.',
        'upload_error_size': 'File size cannot exceed 5MB.',

        // Offline
        'offline_title': "You're Offline",
        'offline_msg': 'Internet connection lost. Will resume automatically when reconnected.',
        'online_restored': 'Connection restored.',

        // Rate limit
        'rate_limit_msg': (sec) => `Too many attempts. Please wait ${sec} seconds.`,

        // Dates
        'today': 'Today',
        'yesterday': 'Yesterday',
        'date_format': 'MM/DD/YYYY',

        // Pagination
        'page_of': (current, total) => `Page ${current} of ${total}`,
        'showing': (from, to, total) => `Showing ${from}–${to} of ${total}`,
    }
}

// ─────────────────────────────────────────────────────────────
// CURRENT LANGUAGE STATE
// ─────────────────────────────────────────────────────────────

let currentLang = localStorage.getItem('dma_lang') ||
    navigator.language?.slice(0, 2) ||
    'tr'

// Desteklenmeyen dil → fallback 'tr'
if (!['tr', 'en'].includes(currentLang)) currentLang = 'tr'

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Çeviri fonksiyonu
 * @param {string} key  - Çeviri anahtarı
 * @param {...any} args - Dinamik parametre (fonksiyon olan anahtarlar için)
 * @returns {string}
 */
export function t(key, ...args) {
    const vocab = translations[currentLang] || translations['tr']
    const val = vocab[key] ?? translations['tr'][key] ?? key
    return typeof val === 'function' ? val(...args) : val
}

/**
 * Dili değiştir ve localStorage'a kaydet
 * @param {'tr'|'en'} lang
 */
export function setLang(lang) {
    if (!['tr', 'en'].includes(lang)) return
    currentLang = lang
    localStorage.setItem('dma_lang', lang)
    document.documentElement.lang = lang
    // Sayfayı yenile ki tüm metinler güncellensin
    window.location.reload()
}

/** Mevcut dili döndür */
export function getLang() { return currentLang }

// ─────────────────────────────────────────────────────────────
// DATE & TIMEZONE FORMATTING
// ─────────────────────────────────────────────────────────────

/**
 * Tarihi kullanıcının timezone'una göre formatla
 * @param {string|Date} dateInput - ISO string veya Date nesnesi
 * @param {string} [timezone]    - IANA timezone (örn: 'Europe/Istanbul')
 * @param {'date'|'datetime'|'time'|'relative'} [style]
 * @returns {string}
 */
export function formatDate(dateInput, timezone = null, style = 'datetime') {
    if (!dateInput) return '—'

    const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
    if (isNaN(date.getTime())) return '—'

    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    const locale = currentLang === 'tr' ? 'tr-TR' : 'en-US'

    if (style === 'relative') {
        return formatRelative(date, tz, locale)
    }

    const options = { timeZone: tz }

    if (style === 'date') {
        Object.assign(options, { day: '2-digit', month: '2-digit', year: 'numeric' })
    } else if (style === 'time') {
        Object.assign(options, { hour: '2-digit', minute: '2-digit' })
    } else {
        Object.assign(options, {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
    }

    return new Intl.DateTimeFormat(locale, options).format(date)
}

/** Göreceli zaman (bugün, dün, X gün önce) */
function formatRelative(date, tz, locale) {
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return currentLang === 'tr' ? 'Az önce' : 'Just now'
    if (diffMins < 60) return currentLang === 'tr' ? `${diffMins} dk önce` : `${diffMins}m ago`
    if (diffHours < 24) return currentLang === 'tr' ? `${diffHours} sa önce` : `${diffHours}h ago`
    if (diffDays === 1) return t('yesterday')
    if (diffDays < 7) return currentLang === 'tr' ? `${diffDays} gün önce` : `${diffDays} days ago`

    return formatDate(date, tz, 'date')
}

// Sayfa yüklenince HTML lang attribute'u ayarla
document.documentElement.lang = currentLang
