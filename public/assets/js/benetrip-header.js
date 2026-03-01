/**
 * Benetrip Header Component — v1.0
 * Componente de header compartilhado entre todas as páginas.
 * Injeta automaticamente o header, sidenav e overlay.
 *
 * USO: Adicione ao <body> de qualquer página:
 *   <div id="benetrip-header-root"></div>
 *   <script src="assets/js/benetrip-header.js"></script>
 */

(function () {
  'use strict';

  // ─── Detecta o caminho relativo correto para assets e links ───
  // Funciona tanto na raiz (/page.html) quanto em subpastas (/en/page.html)
  const BASE = (function () {
    const scripts = document.querySelectorAll('script[src*="benetrip-header"]');
    if (scripts.length) {
      // assets/js/benetrip-header.js → sobe dois níveis
      const src = scripts[scripts.length - 1].getAttribute('src');
      const parts = src.split('/');
      // Remove filename + js + assets
      const depth = parts.filter(p => p && p !== '.').length - 1;
      return depth > 0 ? '../'.repeat(depth - 2) : '';
    }
    return '';
  })();

  // ─── HTML do componente ───────────────────────────────────────
  const HEADER_HTML = `
    <!-- Overlay -->
    <div class="bh-overlay" id="bh-overlay"></div>

    <!-- Side Navigation -->
    <nav class="bh-sidenav" id="bh-sidenav" aria-label="Menu de navegação">
      <div class="bh-sidenav-header">
        <img src="${BASE}assets/images/tripinha/piscando.png"
             alt="Tripinha"
             onerror="this.style.display='none'">
        <h3>Menu Benetrip</h3>
        <p>Sua parceira de viagem! 🐾</p>
      </div>

      <div class="bh-nav-group">
        <div class="bh-nav-group-title">🚀 Ferramentas</div>
        <a href="${BASE}descobrir-destinos.html" class="bh-nav-item bh-primary-cta">
          <span class="bh-nav-icon">🎯</span> Descobrir meu destino!
          <span class="bh-nav-badge popular">Popular</span>
        </a>
        <a href="${BASE}todos-destinos.html" class="bh-nav-item">
          <span class="bh-nav-icon">🌍</span> Todos os Destinos
          <span class="bh-nav-badge new">Novo</span>
        </a>
        <a href="${BASE}comparar-voos.html" class="bh-nav-item">
          <span class="bh-nav-icon">🔀</span> Comparar Voos
          <span class="bh-nav-badge new">Novo</span>
        </a>
        <a href="${BASE}voos-baratos.html" class="bh-nav-item">
          <span class="bh-nav-icon">💸</span> Voos Baratos
          <span class="bh-nav-badge hot">Hot</span>
        </a>
        <a href="${BASE}voos.html" class="bh-nav-item">
          <span class="bh-nav-icon">✈️</span> Busca de Voos
        </a>
        <a href="${BASE}roteiro-viagem.html" class="bh-nav-item">
          <span class="bh-nav-icon">📋</span> Planejar Roteiro
        </a>
      </div>

      <div class="bh-nav-group" data-auth-show="logged-in" style="display:none">
        <div class="bh-nav-group-title">👤 Minha Conta</div>
        <a href="${BASE}minha-conta.html" class="bh-nav-item">
          <span class="bh-nav-icon">📊</span> Histórico de Buscas
        </a>
        <a href="${BASE}minha-conta.html#destinos" class="bh-nav-item">
          <span class="bh-nav-icon">💾</span> Destinos Salvos
        </a>
        <a href="${BASE}minha-conta.html#roteiros" class="bh-nav-item">
          <span class="bh-nav-icon">🗺️</span> Roteiros Salvos
        </a>
      </div>

      <div class="bh-nav-group">
        <div class="bh-nav-group-title">🧭 Páginas</div>
        <a href="${BASE}index.html" class="bh-nav-item">
          <span class="bh-nav-icon">🏠</span> Início
        </a>
        <a href="${BASE}quemsomos.html" class="bh-nav-item">
          <span class="bh-nav-icon">🏢</span> Quem Somos
        </a>
        <a href="${BASE}perguntasfrequentes.html" class="bh-nav-item">
          <span class="bh-nav-icon">❓</span> Perguntas Frequentes
        </a>
      </div>

      <div class="bh-nav-group">
        <div class="bh-nav-group-title">📱 Redes</div>
        <a href="https://www.instagram.com/benetrip.oficial/" class="bh-nav-item" target="_blank" rel="noopener">
          <span class="bh-nav-icon">📷</span> Instagram
        </a>
      </div>

      <div class="bh-nav-group">
        <div class="bh-nav-group-title">📋 Políticas</div>
        <a href="${BASE}termos.html" class="bh-nav-item">
          <span class="bh-nav-icon">📜</span> Termos de Uso
        </a>
        <a href="${BASE}privacidade.html" class="bh-nav-item">
          <span class="bh-nav-icon">🔒</span> Privacidade
        </a>
        <a href="${BASE}cookies.html" class="bh-nav-item">
          <span class="bh-nav-icon">🍪</span> Cookies
        </a>
      </div>
    </nav>

    <!-- Header Principal -->
    <header class="bh-header">
      <div class="bh-header-inner">
        <div class="bh-header-left">
          <button class="bh-menu-btn" id="bh-menu-btn" aria-label="Abrir menu" aria-expanded="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <a href="${BASE}index.html" class="bh-logo-link" aria-label="Benetrip - página inicial">
            <img src="${BASE}logo1.png" alt="Benetrip" class="bh-logo">
          </a>
        </div>

        <nav class="bh-header-nav" aria-label="Navegação principal">
          <a href="${BASE}descobrir-destinos.html" class="bh-nav-link">🎯 Descobrir</a>
          <a href="${BASE}todos-destinos.html" class="bh-nav-link">🌍 Destinos</a>
          <a href="${BASE}voos.html" class="bh-nav-link">✈️ Voos</a>
          <a href="${BASE}roteiro-viagem.html" class="bh-nav-link">📋 Roteiro</a>
        </nav>

        <div class="bh-header-auth">
          <!-- Botão Login (logged-out) -->
          <button class="bh-login-btn" data-auth="login-btn" id="bh-login-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Entrar</span>
          </button>

          <!-- Menu do usuário (logged-in) -->
          <div class="bh-user-menu" data-auth="user-menu" id="bh-user-menu" style="display:none">
            <span class="bh-user-name" data-auth="user-name" id="bh-user-name"></span>
            <img class="bh-user-avatar" data-auth="user-avatar" id="bh-user-avatar" alt="Avatar do usuário">
            <div class="bh-user-initials" data-auth="user-initials" id="bh-user-initials"></div>
            <div class="bh-dropdown" id="bh-dropdown">
              <a href="${BASE}minha-conta.html">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Minha Conta
              </a>
              <a href="${BASE}minha-conta.html#historico">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Histórico
              </a>
              <a href="${BASE}minha-conta.html#destinos">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                Destinos Salvos
              </a>
              <div class="bh-dropdown-divider"></div>
              <button class="bh-logout-btn" data-auth="logout-btn" id="bh-logout-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;

  // ─── CSS do componente ────────────────────────────────────────
  const HEADER_CSS = `
    /* ═══ Reset & Variáveis ═══════════════════════════════════════ */
    :root {
      --bh-orange:       #E87722;
      --bh-orange-dark:  #D06A1D;
      --bh-blue:         #00A3E0;
      --bh-white:        #FFFFFF;
      --bh-dark:         #21272A;
      --bh-gray-100:     #F5F5F5;
      --bh-gray-200:     #E8E8E8;
      --bh-gray-400:     #9E9E9E;
      --bh-transition:   0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* ═══ Overlay ════════════════════════════════════════════════ */
    .bh-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      z-index: 999;
      backdrop-filter: blur(3px);
    }
    .bh-overlay.active { opacity: 1; visibility: visible; }

    /* ═══ Side Navigation ════════════════════════════════════════ */
    .bh-sidenav {
      position: fixed;
      top: 0; left: -320px;
      width: 310px;
      height: 100vh;
      background: var(--bh-white);
      box-shadow: 5px 0 30px rgba(0,0,0,0.12);
      transition: left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }
    .bh-sidenav.open { left: 0; }

    .bh-sidenav-header {
      background: linear-gradient(135deg, var(--bh-orange), var(--bh-blue));
      color: white;
      padding: 28px 22px;
      text-align: center;
    }
    .bh-sidenav-header img {
      width: 50px; height: 50px;
      border-radius: 50%;
      border: 3px solid white;
      margin-bottom: 10px;
    }
    .bh-sidenav-header h3 {
      font-family: 'Poppins', sans-serif;
      font-size: 1.1rem; font-weight: 700;
    }
    .bh-sidenav-header p { font-size: 0.82rem; opacity: 0.9; margin-top: 4px; }

    .bh-nav-group {
      padding: 8px 0;
      border-bottom: 1px solid var(--bh-gray-200);
    }
    .bh-nav-group:last-child { border: none; }

    .bh-nav-group-title {
      font-family: 'Poppins', sans-serif;
      font-size: 0.75rem; font-weight: 600;
      color: var(--bh-orange);
      padding: 14px 22px 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .bh-nav-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 13px 22px;
      color: var(--bh-dark);
      text-decoration: none;
      font-family: 'Montserrat', 'Poppins', sans-serif;
      font-size: 0.92rem; font-weight: 500;
      transition: var(--bh-transition);
      border-left: 3px solid transparent;
    }
    .bh-nav-item:hover {
      background: var(--bh-gray-100);
      color: var(--bh-orange);
      border-left-color: var(--bh-orange);
      padding-left: 26px;
    }
    .bh-nav-icon { font-size: 1.1rem; width: 22px; text-align: center; }

    .bh-primary-cta {
      background: linear-gradient(135deg, var(--bh-orange), #FF9A47);
      color: white !important;
      margin: 12px 16px;
      border-radius: 12px;
      border-left: none !important;
      font-weight: 600;
      box-shadow: 0 4px 16px rgba(232,119,34,0.3);
    }
    .bh-primary-cta:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(232,119,34,0.4) !important;
      padding-left: 22px !important;
      color: white !important;
    }

    .bh-nav-badge {
      font-size: 0.6rem;
      padding: 2px 7px;
      border-radius: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-left: auto;
    }
    .bh-nav-badge.popular { background: #DCFCE7; color: #15803D; }
    .bh-nav-badge.new     { background: #DBEAFE; color: #1D4ED8; }
    .bh-nav-badge.hot     { background: #FEE2E2; color: #DC2626; }

    /* ═══ Header ═════════════════════════════════════════════════ */
    .bh-header {
      background: linear-gradient(135deg, #E87722 0%, #FF8C42 30%, #FFB878 50%, #66C7FF 75%, #00A3E0 100%);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 20px rgba(232,119,34,0.2);
    }

    .bh-header-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .bh-header-left { display: flex; align-items: center; gap: 12px; }

    .bh-menu-btn {
      background: rgba(255,255,255,0.18);
      border: 1.5px solid rgba(255,255,255,0.25);
      border-radius: 10px;
      padding: 10px;
      cursor: pointer;
      transition: var(--bh-transition);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .bh-menu-btn:hover { background: rgba(255,255,255,0.28); }
    .bh-menu-btn svg { width: 22px; height: 22px; stroke: white; }

    .bh-logo-link { display: flex; align-items: center; }
    .bh-logo {
      height: 52px;
      width: auto;
      border-radius: 8px;
      transition: transform 0.3s ease;
    }
    .bh-logo:hover { transform: scale(1.04); }

    /* ── Nav links ── */
    .bh-header-nav { display: flex; gap: 4px; }
    .bh-nav-link {
      color: rgba(255,255,255,0.85);
      text-decoration: none;
      font-family: 'Montserrat', 'Poppins', sans-serif;
      font-size: 0.8rem; font-weight: 500;
      padding: 6px 12px;
      border-radius: 20px;
      transition: var(--bh-transition);
      white-space: nowrap;
    }
    .bh-nav-link:hover { background: rgba(255,255,255,0.18); color: white; }
    .bh-nav-link.active { background: rgba(255,255,255,0.25); color: white; font-weight: 600; }

    /* ── Auth area ── */
    .bh-header-auth { display: flex; align-items: center; gap: 8px; margin-left: 8px; }

    .bh-login-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 16px;
      background: rgba(255,255,255,0.22);
      color: white;
      border: 1.5px solid rgba(255,255,255,0.35);
      border-radius: 20px;
      font-family: 'Poppins', 'Montserrat', sans-serif;
      font-size: 13px; font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
      backdrop-filter: blur(8px);
    }
    .bh-login-btn:hover { background: rgba(255,255,255,0.35); transform: scale(1.02); }
    .bh-login-btn svg { width: 16px; height: 16px; }

    /* ── User menu ── */
    .bh-user-menu { display: flex; align-items: center; gap: 8px; position: relative; }
    .bh-user-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 13px; font-weight: 500;
      color: white;
      max-width: 100px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bh-user-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid rgba(255,255,255,0.6);
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .bh-user-avatar:hover { border-color: white; }
    .bh-user-initials {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      color: white;
      display: none;
      align-items: center; justify-content: center;
      font-family: 'Poppins', sans-serif;
      font-size: 14px; font-weight: 700;
      cursor: pointer;
      border: 2px solid rgba(255,255,255,0.5);
      backdrop-filter: blur(8px);
    }

    .bh-dropdown {
      display: none;
      position: absolute;
      top: calc(100% + 10px); right: 0;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.18);
      min-width: 210px;
      z-index: 1000;
      overflow: hidden;
    }
    .bh-dropdown.active { display: block; }
    .bh-dropdown a, .bh-dropdown button {
      display: flex; align-items: center; gap: 10px;
      width: 100%;
      padding: 12px 16px;
      border: none; background: none;
      font-family: 'Montserrat', sans-serif;
      font-size: 13px;
      color: var(--bh-dark);
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s;
    }
    .bh-dropdown a:hover, .bh-dropdown button:hover { background: var(--bh-gray-100); }
    .bh-dropdown-divider { height: 1px; background: var(--bh-gray-200); margin: 4px 0; }
    .bh-logout-btn { color: #E53935 !important; }

    /* ═══ Responsive ════════════════════════════════════════════ */
    @media (max-width: 640px) {
      .bh-header-nav { display: none; }
      .bh-login-btn span { display: none; }
      .bh-login-btn { padding: 8px 12px; }
      .bh-user-name { display: none; }
      .bh-sidenav { width: 280px; left: -280px; }
      .bh-logo { height: 44px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .bh-sidenav, .bh-overlay { transition-duration: 0.15s !important; }
    }
  `;

  // ─── Injetar CSS ──────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('bh-styles')) return;
    const style = document.createElement('style');
    style.id = 'bh-styles';
    style.textContent = HEADER_CSS;
    document.head.appendChild(style);
  }

  // ─── Injetar HTML ─────────────────────────────────────────────
  function injectHTML() {
    const root = document.getElementById('benetrip-header-root');
    if (!root) {
      console.warn('[BenetripHeader] #benetrip-header-root não encontrado.');
      return;
    }
    root.innerHTML = HEADER_HTML;
  }

  // ─── Destacar link ativo com base na URL atual ────────────────
  function highlightActiveLink() {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.bh-nav-link, .bh-nav-item').forEach(link => {
      const href = (link.getAttribute('href') || '').split('/').pop();
      if (href && href === current) link.classList.add('active');
    });
  }

  // ─── Controles do sidenav ─────────────────────────────────────
  function initNav() {
    const sidenav  = document.getElementById('bh-sidenav');
    const overlay  = document.getElementById('bh-overlay');
    const menuBtn  = document.getElementById('bh-menu-btn');
    if (!sidenav || !overlay || !menuBtn) return;

    function openNav() {
      sidenav.classList.add('open');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      menuBtn.setAttribute('aria-expanded', 'true');
    }
    function closeNav() {
      sidenav.classList.remove('open');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      menuBtn.setAttribute('aria-expanded', 'false');
    }

    menuBtn.addEventListener('click', () =>
      sidenav.classList.contains('open') ? closeNav() : openNav()
    );
    overlay.addEventListener('click', closeNav);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });

    // Fechar ao clicar em links do sidenav (SPA-friendly)
    sidenav.querySelectorAll('.bh-nav-item').forEach(link => {
      link.addEventListener('click', () => setTimeout(closeNav, 150));
    });

    // Expor globalmente para compatibilidade com código existente
    window.BenetripHeader = window.BenetripHeader || {};
    window.BenetripHeader.openNav  = openNav;
    window.BenetripHeader.closeNav = closeNav;
  }

  // ─── Integração com BenetripAuth ─────────────────────────────
  function initAuth() {
    const loginBtn  = document.getElementById('bh-login-btn');
    const userMenu  = document.getElementById('bh-user-menu');
    const userAvatar = document.getElementById('bh-user-avatar');
    const userInitials = document.getElementById('bh-user-initials');
    const userName  = document.getElementById('bh-user-name');
    const logoutBtn = document.getElementById('bh-logout-btn');
    const dropdown  = document.getElementById('bh-dropdown');
    const userMenuContainer = document.getElementById('bh-user-menu');

    if (!loginBtn) return;

    function showUser(user) {
      loginBtn.style.display = 'none';
      userMenu.style.display = 'flex';

      // Mostrar grupos "logged-in" no sidenav
      document.querySelectorAll('[data-auth-show="logged-in"]').forEach(el => {
        el.style.display = '';
      });

      if (typeof BenetripAuth !== 'undefined') {
        const name   = BenetripAuth.getUserDisplayName();
        const avatar = BenetripAuth.getUserAvatar();
        userName.textContent = name;

        if (avatar) {
          userAvatar.src = avatar;
          userAvatar.style.display = 'block';
          userInitials.style.display = 'none';
        } else {
          userAvatar.style.display = 'none';
          userInitials.style.display = 'flex';
          userInitials.textContent = name.charAt(0).toUpperCase();
        }
      }
    }

    function showLogin() {
      loginBtn.style.display = 'flex';
      userMenu.style.display = 'none';
      document.querySelectorAll('[data-auth-show="logged-in"]').forEach(el => {
        el.style.display = 'none';
      });
    }

    // Toggle dropdown
    [userAvatar, userInitials].forEach(el => {
      el.addEventListener('click', () => dropdown.classList.toggle('active'));
    });

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', e => {
      if (dropdown && !userMenuContainer.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });

    // Logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (typeof BenetripAuth !== 'undefined') {
          try { await BenetripAuth.signOut(); } catch (e) { /* ignore */ }
        }
        window.location.href = BASE + 'index.html';
      });
    }

    // Login modal
    loginBtn.addEventListener('click', () => {
      if (typeof BenetripLoginModal !== 'undefined') {
        BenetripLoginModal.open();
      } else {
        window.location.href = BASE + 'index.html';
      }
    });

    // Escutar mudanças de auth
    if (typeof BenetripAuth !== 'undefined') {
      BenetripAuth.onAuthChange((event, user) => {
        user ? showUser(user) : showLogin();
      });
      // Estado inicial
      setTimeout(() => {
        const user = BenetripAuth.getUser?.();
        user ? showUser(user) : showLogin();
      }, 300);
    }
  }

  // ─── Bootstrap ───────────────────────────────────────────────
  function init() {
    injectStyles();
    injectHTML();
    initNav();
    highlightActiveLink();

    // Auth pode carregar depois — aguarda scripts externos
    if (typeof BenetripAuth !== 'undefined') {
      initAuth();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        // Tenta novamente após todos os scripts carregarem
        setTimeout(initAuth, 500);
      });
    }
  }

  // Roda assim que possível
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
