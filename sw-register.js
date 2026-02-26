/**
 * sw-register.js — Service Worker Kayıt
 * Her sayfanın <body> kapanışından önce <script src="sw-register.js"></script> olarak ekle
 */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then(reg => {
                console.log('[SW] Kayıt başarılı, scope:', reg.scope)

                // Yeni bir SW aktif olunca kullanıcıya bildir
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing
                    newWorker?.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateBanner()
                        }
                    })
                })
            })
            .catch(err => console.warn('[SW] Kayıt başarısız:', err))
    })

    // Service Worker'dan gelen mesajları dinle (online retry vb.)
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'ONLINE_RETRY') {
            window.location.reload()
        }
    })
}

function showUpdateBanner() {
    if (document.getElementById('dma-update-banner')) return

    const banner = document.createElement('div')
    banner.id = 'dma-update-banner'
    banner.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:99999;
    background:linear-gradient(135deg,#6366f1,#8b5cf6);
    color:#fff;padding:14px 18px;border-radius:12px;
    font-size:13px;font-family:system-ui,sans-serif;
    box-shadow:0 8px 32px rgba(99,102,241,0.4);
    display:flex;align-items:center;gap:12px;
  `
    banner.innerHTML = `
    <span>🚀 Yeni güncelleme mevcut!</span>
    <button onclick="window.location.reload()" style="
      background:rgba(255,255,255,0.2);border:none;color:#fff;
      padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;
    " aria-label="Sayfayı yenile ve güncelle">Yenile</button>
    <button onclick="this.parentElement.remove()" style="
      background:none;border:none;color:rgba(255,255,255,0.7);
      cursor:pointer;font-size:18px;padding:0;line-height:1;
    " aria-label="Kapat">×</button>
  `
    document.body.appendChild(banner)
}
