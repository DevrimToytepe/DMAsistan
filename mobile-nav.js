// mobile-nav.js — Tüm dashboard sayfalarına eklenir
// <script type="module" src="mobile-nav.js"></script>

export function initMobileNav() {
  // Zaten varsa tekrar ekleme
  if (document.getElementById('mobileNavOverlay')) return

  const currentPage = window.location.pathname.split('/').pop() || 'index.html'

  const navItems = [
    { href: 'dashboard.html',     icon: '📊', label: 'Dashboard' },
    { href: 'conversations.html', icon: '💬', label: 'Konuşmalar' },
    { href: 'automation.html',    icon: '🤖', label: 'Otomasyon' },
    { href: 'contacts.html',      icon: '👥', label: 'Kişiler' },
    { href: 'analytics.html',     icon: '📈', label: 'Analitik' },
  ]

  // ── CSS Inject ──
  const style = document.createElement('style')
  style.id = 'mobile-nav-styles'
  style.textContent = `
    /* ── Hamburger Butonu ── */
    .mob-hamburger {
      display: none;
      position: fixed;
      top: 14px;
      left: 16px;
      z-index: 200;
      background: rgba(15,20,40,0.9);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      width: 42px;
      height: 42px;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      backdrop-filter: blur(12px);
      transition: all 0.2s;
    }
    .mob-hamburger:hover { background: rgba(124,58,237,0.2); border-color: rgba(124,58,237,0.4); }
    .mob-hamburger .bar {
      width: 18px; height: 2px;
      background: #fff;
      border-radius: 1px;
      transition: all 0.3s;
      display: block;
      margin: 3px 0;
    }
    .mob-hamburger.open .bar:nth-child(1) { transform: translateY(5px) rotate(45deg); }
    .mob-hamburger.open .bar:nth-child(2) { opacity: 0; }
    .mob-hamburger.open .bar:nth-child(3) { transform: translateY(-5px) rotate(-45deg); }

    /* ── Overlay ── */
    .mob-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 150;
      backdrop-filter: blur(4px);
      opacity: 0;
      transition: opacity 0.3s;
    }
    .mob-overlay.open { opacity: 1; }

    /* ── Drawer ── */
    .mob-drawer {
      position: fixed;
      top: 0; left: 0;
      width: 280px;
      height: 100vh;
      background: #0F1428;
      border-right: 1px solid rgba(255,255,255,0.08);
      z-index: 160;
      transform: translateX(-100%);
      transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
      display: flex;
      flex-direction: column;
      padding: 0 12px 24px;
    }
    .mob-drawer.open { transform: translateX(0); }

    .mob-drawer-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Sora', sans-serif;
      font-weight: 800;
      font-size: 1.2rem;
      padding: 20px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      margin-bottom: 8px;
    }

    .mob-nav-section {
      font-family: 'Sora', sans-serif;
      font-size: 0.65rem;
      font-weight: 700;
      color: rgba(255,255,255,0.22);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      padding: 12px 12px 4px;
    }

    .mob-nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      margin-bottom: 2px;
      font-size: 0.88rem;
      color: #A1A1AA;
      text-decoration: none;
      transition: all 0.2s;
    }
    .mob-nav-item:hover { background: rgba(255,255,255,0.04); color: #fff; }
    .mob-nav-item.active { background: rgba(124,58,237,0.14); color: #fff; }
    .mob-nav-icon { font-size: 1rem; width: 22px; text-align: center; }

    .mob-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 8px 0; }

    .mob-drawer-bottom { margin-top: auto; }
    .mob-user-card {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 10px 12px;
    }
    .mob-avatar {
      width: 34px; height: 34px;
      border-radius: 10px;
      background: linear-gradient(135deg,#7C3AED,#F43F75);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.85rem; flex-shrink: 0; overflow: hidden;
    }
    .mob-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 10px; }
    .mob-user-info .mob-name { font-size: 0.83rem; font-weight: 600; }
    .mob-user-info .mob-plan { font-size: 0.7rem; color: #A1A1AA; }
    .mob-logout {
      margin-left: auto; background: none; border: none;
      color: #A1A1AA; font-size: 1rem; cursor: pointer; padding: 4px;
      transition: color 0.2s;
    }
    .mob-logout:hover { color: #F43F75; }

    /* ── Bottom Tab Bar (alternatif) ── */
    .mob-bottom-bar {
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: rgba(15,20,40,0.95);
      border-top: 1px solid rgba(255,255,255,0.08);
      z-index: 100;
      padding: 8px 0 max(8px, env(safe-area-inset-bottom));
      backdrop-filter: blur(20px);
    }
    .mob-tab-list {
      display: flex;
      justify-content: space-around;
      align-items: center;
    }
    .mob-tab-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 4px 12px;
      border-radius: 10px;
      text-decoration: none;
      color: #A1A1AA;
      font-size: 0.62rem;
      font-weight: 500;
      transition: all 0.2s;
      min-width: 52px;
    }
    .mob-tab-item.active { color: #9B5CF6; }
    .mob-tab-item .tab-icon { font-size: 1.3rem; line-height: 1; }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .mob-hamburger { display: flex; }
      .mob-bottom-bar { display: block; }
      /* Ana içeriğe bottom bar padding ekle */
      .main { padding-bottom: 70px; }
    }
  `
  document.head.appendChild(style)

  // ── Hamburger Butonu ──
  const hamburger = document.createElement('button')
  hamburger.className = 'mob-hamburger'
  hamburger.id = 'mobHamburger'
  hamburger.setAttribute('aria-label', 'Menüyü Aç')
  hamburger.innerHTML = '<span class="bar"></span><span class="bar"></span><span class="bar"></span>'
  document.body.appendChild(hamburger)

  // ── Overlay ──
  const overlay = document.createElement('div')
  overlay.className = 'mob-overlay'
  overlay.id = 'mobileNavOverlay'
  document.body.appendChild(overlay)

  // ── Drawer ──
  const drawer = document.createElement('div')
  drawer.className = 'mob-drawer'
  drawer.id = 'mobileDrawer'

  const allNavItems = [
    ...navItems,
    { divider: true },
    { href: 'integrations.html', icon: '🔗', label: 'Entegrasyonlar' },
    { href: 'settings.html',     icon: '⚙️', label: 'Ayarlar' },
    { href: 'billing.html',      icon: '💳', label: 'Faturalama' },
  ]

  drawer.innerHTML = `
    <div class="mob-drawer-logo"><span>⚡</span> DMAsistan</div>
    <div class="mob-nav-section">Ana Menü</div>
    ${navItems.map(item => `
      <a class="mob-nav-item${currentPage === item.href ? ' active' : ''}" href="${item.href}">
        <span class="mob-nav-icon">${item.icon}</span>${item.label}
      </a>
    `).join('')}
    <div class="mob-divider"></div>
    <div class="mob-nav-section">Ayarlar</div>
    <a class="mob-nav-item${currentPage === 'integrations.html' ? ' active' : ''}" href="integrations.html"><span class="mob-nav-icon">🔗</span>Entegrasyonlar</a>
    <a class="mob-nav-item${currentPage === 'settings.html' ? ' active' : ''}" href="settings.html"><span class="mob-nav-icon">⚙️</span>Ayarlar</a>
    <a class="mob-nav-item${currentPage === 'billing.html' ? ' active' : ''}" href="billing.html"><span class="mob-nav-icon">💳</span>Faturalama</a>
    <div class="mob-divider"></div>
    <div class="mob-drawer-bottom">
      <div class="mob-user-card">
        <div class="mob-avatar" id="mobAvatar">?</div>
        <div class="mob-user-info">
          <div class="mob-name" id="mobName">Yükleniyor...</div>
          <div class="mob-plan" id="mobPlan">🆓 Ücretsiz Plan</div>
        </div>
        <button class="mob-logout" id="mobLogoutBtn" title="Çıkış Yap">⏻</button>
      </div>
    </div>
  `
  document.body.appendChild(drawer)

  // ── Bottom Tab Bar ──
  const bottomBar = document.createElement('nav')
  bottomBar.className = 'mob-bottom-bar'
  bottomBar.innerHTML = `
    <div class="mob-tab-list">
      ${navItems.map(item => `
        <a class="mob-tab-item${currentPage === item.href ? ' active' : ''}" href="${item.href}">
          <span class="tab-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
    </div>
  `
  document.body.appendChild(bottomBar)

  // ── Toggle Fonksiyonları ──
  function openDrawer() {
    hamburger.classList.add('open')
    overlay.style.display = 'block'
    drawer.classList.add('open')
    requestAnimationFrame(() => overlay.classList.add('open'))
    document.body.style.overflow = 'hidden'
  }

  function closeDrawer() {
    hamburger.classList.remove('open')
    overlay.classList.remove('open')
    drawer.classList.remove('open')
    document.body.style.overflow = ''
    setTimeout(() => { overlay.style.display = 'none' }, 300)
  }

  hamburger.addEventListener('click', () => {
    drawer.classList.contains('open') ? closeDrawer() : openDrawer()
  })
  overlay.addEventListener('click', closeDrawer)

  // ── Kullanıcı bilgilerini sidebar'dan al ──
  function syncUserInfo() {
    const sidebarName   = document.getElementById('sidebarName')?.textContent
    const sidebarAvatar = document.getElementById('sidebarAvatar')
    const sidebarPlan   = document.querySelector('.user-info .plan')?.textContent

    if (sidebarName && sidebarName !== 'Yükleniyor...') {
      const mobName = document.getElementById('mobName')
      const mobAvatar = document.getElementById('mobAvatar')
      const mobPlan = document.getElementById('mobPlan')
      if (mobName) mobName.textContent = sidebarName
      if (mobPlan && sidebarPlan) mobPlan.textContent = sidebarPlan

      if (mobAvatar && sidebarAvatar) {
        const img = sidebarAvatar.querySelector('img')
        if (img) {
          mobAvatar.innerHTML = `<img src="${img.src}" alt="avatar">`
        } else {
          mobAvatar.textContent = sidebarName.charAt(0).toUpperCase()
        }
      }
    }
  }

  // Biraz bekle sidebar yüklensin
  setTimeout(syncUserInfo, 800)
  // MutationObserver ile de izle
  const sidebarNameEl = document.getElementById('sidebarName')
  if (sidebarNameEl) {
    new MutationObserver(syncUserInfo).observe(sidebarNameEl, { childList: true, characterData: true, subtree: true })
  }

  // ── Logout ──
  document.getElementById('mobLogoutBtn')?.addEventListener('click', async () => {
    const { supabase } = await import('./supabase.js')
    await supabase.auth.signOut()
    localStorage.removeItem('dma_avatar')
    window.location.href = 'giris.html'
  })
}

// Otomatik başlat
initMobileNav()
