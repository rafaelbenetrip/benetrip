/**
 * Benetrip Header Component — v2.0
 * Componente de header compartilhado entre todas as paginas.
 * Injeta automaticamente o header, sidenav e overlay.
 *
 * NOVIDADES v2.0:
 * - Header scroll-aware (transparente no topo, solido ao rolar)
 * - Dropdown rico com preview do perfil e stats
 * - Indicador de contexto/breadcrumb no fluxo de busca
 * - Suporte a notificacoes (badge)
 * - Animacoes suaves de transicao
 *
 * USO: Adicione ao <body> de qualquer pagina:
 *   <div id="benetrip-header-root"></div>
 *   <script src="assets/js/benetrip-header.js"></script>
 */

(function () {
  'use strict';

  // --- Detecta o caminho relativo correto para assets e links ---
  const BASE = (function () {
    const scripts = document.querySelectorAll('script[src*="benetrip-header"]');
    if (scripts.length) {
      const src = scripts[scripts.length - 1].getAttribute('src');
      const parts = src.split('/');
      const depth = parts.filter(p => p && p !== '.').length - 1;
      return depth > 0 ? '../'.repeat(depth - 2) : '';
    }
    return '';
  })();

  // --- Contexto da pagina atual (para breadcrumb) ---
  const PAGE_CONTEXT = (function () {
    const page = (window.location.pathname.split('/').pop() || 'index.html').replace('.html', '');
    const map = {
      'index': null,
      'descobrir-destinos': { label: 'Descobrir Destinos', icon: '&#x1F3AF;' },
      'todos-destinos': { label: 'Todos os Destinos', icon: '&#x1F30D;' },
      'voos': { label: 'Busca de Voos', icon: '&#x2708;&#xFE0F;' },
      'voos-baratos': { label: 'Voos Baratos', icon: '&#x1F4B8;' },
      'comparar-voos': { label: 'Comparar Voos', icon: '&#x1F500;' },
      'roteiro-viagem': { label: 'Planejar Roteiro', icon: '&#x1F4CB;' },
      'minha-conta': { label: 'Minha Conta', icon: '&#x1F464;' },
      'quemsomos': { label: 'Quem Somos', icon: '&#x1F3E2;' },
      'perguntasfrequentes': { label: 'FAQ', icon: '&#x2753;' },
    };
    return map[page] || null;
  })();

  // --- HTML do componente ---
  const HEADER_HTML = `
    <!-- Overlay -->
    <div class="bh-overlay" id="bh-overlay"></div>

    <!-- Side Navigation -->
    <nav class="bh-sidenav" id="bh-sidenav" aria-label="Menu de navegacao">
      <div class="bh-sidenav-header">
        <img src="${BASE}assets/images/tripinha/piscando.png"
             alt="Tripinha"
             onerror="this.style.display='none'">
        <h3>Menu Benetrip</h3>
        <p>Sua parceira de viagem!</p>
      </div>

      <div class="bh-nav-group">
        <div class="bh-nav-group-title">Ferramentas</div>
        <a href="${BASE}descobrir-destinos.html" class="bh-nav-item bh-primary-cta">
          <span class="bh-nav-icon">&#x1F3AF;</span> Descobrir meu destino!
          <span class="bh-nav-badge popular">Popular</span>
        </a>
        <a href="${BASE}todos-destinos.html" class="bh-nav-item">
          <span class="bh-nav-icon">&#x1F30D;</span> Todos os Destinos
          <span class="bh-nav-badge new">Novo</span>
        </a>
        <a href="${BASE}comparar-voos.html" class="bh-nav-item">
          <span class="bh-nav-icon">&#x1F500;</span> Comparar Voos
          <span class="bh-nav-badge new">Novo</span>
        </a>
        <a href="${BASE}voos-baratos.html" class="bh-nav-item">
          <span class="bh-nav-icon">&#x1F4B8;</span> Voos Baratos
          <span class="bh-nav-badge hot">Hot</span>
        </a>
        <a href="${BASE}voos.html" class="bh-nav-item">
          <span class="bh-nav-icon">&#x2708;&#xFE0F;</span> Busca de Voos
        </a>
        <a href="${BASE}roteiro-viagem.html" class="bh-nav-item">
          <span class="bh-nav-icon">&#x1F4CB;</span> Planejar Roteiro
        </a>
      </div>

      <div class="bh-nav-group" data-auth-show="logged-in" style="display:none">
        <div class="bh-nav-group-title">Minha Conta</div>
        <a href="${BASE}minha-conta.html" class="bh-nav-item">
          <span class="bh-nav-icon">&#x1F4CA;</span> Historico de Buscas
        </a>
        <a href="${BASE}minha-conta.html#destinos" class="bh-nav-item">
          <span class="bh-nav-icon">&#x1F4BE;</span> Destinos Salvos
        </a>
        <a href="${BASE}minha-conta.html#roteiros" class="bh-nav-item">
          <span class="bh-nav-icon">&#x1F5FA;&#xFE0F;</span> Roteiros Salvos
        </a>
      </div>

      <div class="bh-nav-group">
        <div class="bh-nav-group-title">Paginas</div>
        <a href="${BASE}index.html" class="bh-nav-item">
          <span class="bh-nav-icon">&#x1F3E0;</span> Inicio
        </a>
        <a href="${BASE}quemsomos.html" class="bh-nav-item">
          <span class="bh-nav-icon">&#x1F3E2;</span> Quem Somos
        </a>
        <a href="${BASE}perguntasfrequentes.html" class="bh-nav-item">
          <span class="bh-nav-icon">&#x2753;</span> Perguntas Frequentes
        </a>
      </div>

      <div class="bh-nav-group">
        <div class="bh-nav-group-title">Redes</div>
        <a href="https://www.instagram.com/benetrip.oficial/" class="bh-nav-item" target="_blank" rel="noopener">
          <span class="bh-nav-icon">&#x1F4F7;</span> Instagram
        </a>
      </div>

      <div class="bh-nav-group">
        <div class="bh-nav-group-title">Politicas</div>
        <a href="${BASE}termos.html" class="bh-nav-item">
          <span class="bh-nav-icon">&#x1F4DC;</span> Termos de Uso
        </a>
        <a href="${BASE}privacidade.html" class="bh-nav-item">
          <span class="bh-nav-icon">&#x1F512;</span> Privacidade
        </a>
        <a href="${BASE}cookies.html" class="bh-nav-item">
          <span class="bh-nav-icon">&#x1F36A;</span> Cookies
        </a>
      </div>
    </nav>

    <!-- Header Principal -->
    <header class="bh-header" id="bh-header">
      <div class="bh-header-inner">
        <div class="bh-header-left">
          <button class="bh-menu-btn" id="bh-menu-btn" aria-label="Abrir menu" aria-expanded="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <a href="${BASE}index.html" class="bh-logo-link" aria-label="Benetrip - pagina inicial">
            <img src="${BASE}logo1.png" alt="Benetrip" class="bh-logo">
          </a>
          ${PAGE_CONTEXT ? `<div class="bh-breadcrumb" id="bh-breadcrumb"><span class="bh-breadcrumb-sep">&#x203A;</span><span class="bh-breadcrumb-current">${PAGE_CONTEXT.label}</span></div>` : ''}
        </div>

        <nav class="bh-header-nav" aria-label="Navegacao principal">
          <a href="${BASE}descobrir-destinos.html" class="bh-nav-link">&#x1F3AF; Descobrir</a>
          <a href="${BASE}todos-destinos.html" class="bh-nav-link">&#x1F30D; Destinos</a>
          <a href="${BASE}voos.html" class="bh-nav-link">&#x2708;&#xFE0F; Voos</a>
          <a href="${BASE}roteiro-viagem.html" class="bh-nav-link">&#x1F4CB; Roteiro</a>
        </nav>

        <div class="bh-header-auth">
          <!-- Botao Login (logged-out) -->
          <button class="bh-login-btn" data-auth="login-btn" id="bh-login-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Entrar</span>
          </button>

          <!-- Menu do usuario (logged-in) -->
          <div class="bh-user-menu" data-auth="user-menu" id="bh-user-menu" style="display:none">
            <span class="bh-user-name" data-auth="user-name" id="bh-user-name"></span>
            <div class="bh-avatar-wrapper" id="bh-avatar-wrapper">
              <img class="bh-user-avatar" data-auth="user-avatar" id="bh-user-avatar" alt="Avatar do usuario">
              <div class="bh-user-initials" data-auth="user-initials" id="bh-user-initials"></div>
              <span class="bh-notification-badge" id="bh-notification-badge" style="display:none"></span>
            </div>

            <!-- Dropdown Rico -->
            <div class="bh-dropdown" id="bh-dropdown">
              <div class="bh-dropdown-profile" id="bh-dropdown-profile">
                <div class="bh-dropdown-avatar" id="bh-dropdown-avatar-wrapper">
                  <img id="bh-dropdown-avatar-img" alt="" style="display:none">
                  <div class="bh-dropdown-initials" id="bh-dropdown-initials"></div>
                </div>
                <div class="bh-dropdown-info">
                  <span class="bh-dropdown-name" id="bh-dropdown-name"></span>
                  <span class="bh-dropdown-email" id="bh-dropdown-email"></span>
                </div>
              </div>
              <div class="bh-dropdown-stats" id="bh-dropdown-stats">
                <div class="bh-stat">
                  <span class="bh-stat-value" id="bh-stat-searches">-</span>
                  <span class="bh-stat-label">Buscas</span>
                </div>
                <div class="bh-stat">
                  <span class="bh-stat-value" id="bh-stat-destinations">-</span>
                  <span class="bh-stat-label">Destinos</span>
                </div>
                <div class="bh-stat">
                  <span class="bh-stat-value" id="bh-stat-itineraries">-</span>
                  <span class="bh-stat-label">Roteiros</span>
                </div>
              </div>
              <div class="bh-dropdown-divider"></div>
              <a href="${BASE}minha-conta.html" class="bh-dropdown-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Minha Conta
              </a>
              <a href="${BASE}minha-conta.html#historico" class="bh-dropdown-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Historico
              </a>
              <a href="${BASE}minha-conta.html#destinos" class="bh-dropdown-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                Destinos Salvos
              </a>
              <a href="${BASE}minha-conta.html#roteiros" class="bh-dropdown-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Roteiros Salvos
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

  // --- CSS do componente ---
  const HEADER_CSS = `
    /* === Reset & Variaveis === */
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

    /* === Overlay === */
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

    /* === Side Navigation === */
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

    /* === Header (scroll-aware) === */
    .bh-header {
      background: linear-gradient(135deg, #E87722 0%, #FF8C42 30%, #FFB878 50%, #66C7FF 75%, #00A3E0 100%);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 20px rgba(232,119,34,0.2);
      transition: background 0.4s ease, box-shadow 0.4s ease, backdrop-filter 0.4s ease;
    }

    /* Scroll-aware: header fica mais compacto e solido ao rolar */
    .bh-header.bh-scrolled {
      box-shadow: 0 4px 30px rgba(0,0,0,0.15);
    }
    .bh-header.bh-scrolled .bh-header-inner {
      padding-top: 8px;
      padding-bottom: 8px;
    }
    .bh-header.bh-scrolled .bh-logo {
      height: 42px;
    }

    .bh-header-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      transition: padding 0.3s ease;
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
      transition: transform 0.3s ease, height 0.3s ease;
    }
    .bh-logo:hover { transform: scale(1.04); }

    /* Breadcrumb */
    .bh-breadcrumb {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: 'Montserrat', sans-serif;
      font-size: 0.75rem;
      color: rgba(255,255,255,0.8);
    }
    .bh-breadcrumb-sep {
      font-size: 1rem;
      opacity: 0.6;
    }
    .bh-breadcrumb-current {
      background: rgba(255,255,255,0.15);
      padding: 3px 10px;
      border-radius: 12px;
      font-weight: 500;
      backdrop-filter: blur(4px);
    }

    /* -- Nav links -- */
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

    /* -- Auth area -- */
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

    /* -- User menu -- */
    .bh-user-menu { display: flex; align-items: center; gap: 8px; position: relative; }
    .bh-user-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 13px; font-weight: 500;
      color: white;
      max-width: 100px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .bh-avatar-wrapper {
      position: relative;
      cursor: pointer;
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

    /* Notification Badge */
    .bh-notification-badge {
      position: absolute;
      top: -2px; right: -2px;
      min-width: 16px; height: 16px;
      background: #E53935;
      color: white;
      font-size: 10px;
      font-weight: 700;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      border: 2px solid var(--bh-orange);
      font-family: 'Poppins', sans-serif;
      animation: bh-badge-pulse 2s ease-in-out infinite;
    }
    @keyframes bh-badge-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    /* -- Rich Dropdown -- */
    .bh-dropdown {
      display: none;
      position: absolute;
      top: calc(100% + 10px); right: 0;
      background: white;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.2);
      min-width: 280px;
      z-index: 1000;
      overflow: hidden;
      transform: translateY(-8px);
      opacity: 0;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }
    .bh-dropdown.active {
      display: block;
      transform: translateY(0);
      opacity: 1;
    }

    /* Dropdown profile header */
    .bh-dropdown-profile {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: linear-gradient(135deg, rgba(232,119,34,0.06), rgba(0,163,224,0.06));
    }
    .bh-dropdown-avatar {
      width: 44px; height: 44px;
      border-radius: 50%;
      flex-shrink: 0;
      overflow: hidden;
    }
    .bh-dropdown-avatar img {
      width: 100%; height: 100%;
      object-fit: cover;
    }
    .bh-dropdown-initials {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--bh-orange), var(--bh-blue));
      color: white;
      display: flex;
      align-items: center; justify-content: center;
      font-family: 'Poppins', sans-serif;
      font-size: 18px; font-weight: 700;
    }
    .bh-dropdown-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .bh-dropdown-name {
      font-family: 'Poppins', sans-serif;
      font-size: 14px; font-weight: 600;
      color: var(--bh-dark);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bh-dropdown-email {
      font-family: 'Montserrat', sans-serif;
      font-size: 12px;
      color: var(--bh-gray-400);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* Dropdown stats */
    .bh-dropdown-stats {
      display: flex;
      justify-content: space-around;
      padding: 12px 16px;
      border-bottom: 1px solid var(--bh-gray-200);
    }
    .bh-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .bh-stat-value {
      font-family: 'Poppins', sans-serif;
      font-size: 16px; font-weight: 700;
      color: var(--bh-orange);
    }
    .bh-stat-label {
      font-family: 'Montserrat', sans-serif;
      font-size: 10px;
      color: var(--bh-gray-400);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* Dropdown items */
    .bh-dropdown-item, .bh-dropdown button {
      display: flex; align-items: center; gap: 10px;
      width: 100%;
      padding: 11px 16px;
      border: none; background: none;
      font-family: 'Montserrat', sans-serif;
      font-size: 13px;
      color: var(--bh-dark);
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s;
    }
    .bh-dropdown-item:hover, .bh-dropdown button:hover { background: var(--bh-gray-100); }
    .bh-dropdown-divider { height: 1px; background: var(--bh-gray-200); margin: 4px 0; }
    .bh-logout-btn { color: #E53935 !important; }

    /* === Responsive === */
    @media (max-width: 768px) {
      .bh-breadcrumb { display: none; }
    }

    @media (max-width: 640px) {
      .bh-header-nav { display: none; }
      .bh-login-btn span { display: none; }
      .bh-login-btn { padding: 8px 12px; }
      .bh-user-name { display: none; }
      .bh-sidenav { width: 280px; left: -280px; }
      .bh-logo { height: 44px; }
      .bh-dropdown { min-width: 260px; right: -8px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .bh-sidenav, .bh-overlay { transition-duration: 0.15s !important; }
      .bh-header, .bh-header-inner, .bh-logo { transition-duration: 0.1s !important; }
      @keyframes bh-badge-pulse { 0%, 100% { transform: scale(1); } }
    }
  `;

  // --- Injetar CSS ---
  function injectStyles() {
    if (document.getElementById('bh-styles')) return;
    const style = document.createElement('style');
    style.id = 'bh-styles';
    style.textContent = HEADER_CSS;
    document.head.appendChild(style);
  }

  // --- Injetar HTML ---
  function injectHTML() {
    const root = document.getElementById('benetrip-header-root');
    if (!root) {
      console.warn('[BenetripHeader] #benetrip-header-root nao encontrado.');
      return;
    }
    root.innerHTML = HEADER_HTML;
  }

  // --- Destacar link ativo com base na URL atual ---
  function highlightActiveLink() {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.bh-nav-link, .bh-nav-item').forEach(link => {
      const href = (link.getAttribute('href') || '').split('/').pop();
      if (href && href === current) link.classList.add('active');
    });
  }

  // --- Scroll-aware header ---
  function initScrollBehavior() {
    const header = document.getElementById('bh-header');
    if (!header) return;

    let lastScrollY = 0;
    let ticking = false;

    function onScroll() {
      lastScrollY = window.scrollY;
      if (!ticking) {
        requestAnimationFrame(() => {
          if (lastScrollY > 60) {
            header.classList.add('bh-scrolled');
          } else {
            header.classList.remove('bh-scrolled');
          }
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    // Check initial state
    onScroll();
  }

  // --- Controles do sidenav ---
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

    sidenav.querySelectorAll('.bh-nav-item').forEach(link => {
      link.addEventListener('click', () => setTimeout(closeNav, 150));
    });

    window.BenetripHeader = window.BenetripHeader || {};
    window.BenetripHeader.openNav  = openNav;
    window.BenetripHeader.closeNav = closeNav;
  }

  // --- Carregar stats do usuario para o dropdown ---
  async function loadUserStats() {
    if (typeof BenetripAuth === 'undefined') return;
    try {
      const [searches, destinations, itineraries] = await Promise.all([
        BenetripAuth.getSearchHistory(1, 0).then(r => null).catch(() => null),
        BenetripAuth.getSavedDestinations().catch(() => []),
        BenetripAuth.getSavedItineraries().catch(() => []),
      ]);

      const searchEl = document.getElementById('bh-stat-searches');
      const destEl = document.getElementById('bh-stat-destinations');
      const itinEl = document.getElementById('bh-stat-itineraries');

      if (destEl) destEl.textContent = (destinations || []).length;
      if (itinEl) itinEl.textContent = (itineraries || []).length;
      // Searches count not easily available, leave as dash or update if we get it
    } catch (e) {
      // Stats are non-critical, silently fail
    }
  }

  // --- Integracao com BenetripAuth ---
  function initAuth() {
    const loginBtn  = document.getElementById('bh-login-btn');
    const userMenu  = document.getElementById('bh-user-menu');
    const userAvatar = document.getElementById('bh-user-avatar');
    const userInitials = document.getElementById('bh-user-initials');
    const userName  = document.getElementById('bh-user-name');
    const logoutBtn = document.getElementById('bh-logout-btn');
    const dropdown  = document.getElementById('bh-dropdown');
    const avatarWrapper = document.getElementById('bh-avatar-wrapper');
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
        const email  = user?.email || '';
        userName.textContent = name;

        // Update dropdown profile
        const dropdownName = document.getElementById('bh-dropdown-name');
        const dropdownEmail = document.getElementById('bh-dropdown-email');
        const dropdownAvatarImg = document.getElementById('bh-dropdown-avatar-img');
        const dropdownInitials = document.getElementById('bh-dropdown-initials');

        if (dropdownName) dropdownName.textContent = name;
        if (dropdownEmail) dropdownEmail.textContent = email;

        if (avatar) {
          userAvatar.src = avatar;
          userAvatar.style.display = 'block';
          userInitials.style.display = 'none';
          if (dropdownAvatarImg) {
            dropdownAvatarImg.src = avatar;
            dropdownAvatarImg.style.display = 'block';
          }
          if (dropdownInitials) dropdownInitials.style.display = 'none';
        } else {
          userAvatar.style.display = 'none';
          userInitials.style.display = 'flex';
          userInitials.textContent = name.charAt(0).toUpperCase();
          if (dropdownAvatarImg) dropdownAvatarImg.style.display = 'none';
          if (dropdownInitials) {
            dropdownInitials.style.display = 'flex';
            dropdownInitials.textContent = name.charAt(0).toUpperCase();
          }
        }

        // Load stats in background
        loadUserStats();
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
    if (avatarWrapper) {
      avatarWrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
      });
    }

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

    // Escutar mudancas de auth
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

  // --- Notificacoes (API publica) ---
  function setNotificationCount(count) {
    const badge = document.getElementById('bh-notification-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // --- Bootstrap ---
  function init() {
    injectStyles();
    injectHTML();
    initNav();
    highlightActiveLink();
    initScrollBehavior();

    if (typeof BenetripAuth !== 'undefined') {
      initAuth();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initAuth, 500);
      });
    }

    // Expor API publica
    window.BenetripHeader = window.BenetripHeader || {};
    window.BenetripHeader.setNotificationCount = setNotificationCount;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
