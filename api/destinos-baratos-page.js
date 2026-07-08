// api/destinos-baratos-page.js - BENETRIP DESTINOS BARATOS SSR v1.0
// Vercel Function que renderiza /destinos-baratos e /destinos-baratos/:cidade
// já com os destinos, preços e datas embutidos no HTML (server-side rendering).
//
// Roteamento (vercel.json rewrites):
//   /destinos-baratos              -> /api/destinos-baratos-page              (default: São Paulo)
//   /destinos-baratos/:cidade      -> /api/destinos-baratos-page?cidade=:cidade
//
// Regras:
// - Leitura do Supabase usa a anon key (RLS permite SELECT público na tabela
//   discovery_snapshots). A service role key é usada só no cron de escrita.
// - Sem fallback silencioso: falha no Supabase = HTTP 500 com página de erro
//   real, nunca destinos inventados.
// - /destinos-baratos/sao-paulo redireciona (301) para /destinos-baratos para
//   evitar conteúdo duplicado, já que a base já é a página de São Paulo.

import {
    CHIPS_PADRAO,
    CIDADE_PADRAO_CODIGO,
    TIPO_PADRAO,
    carregarCidades,
    encontrarCidadePorSlug,
    fetchSnapshotComVariacao,
    fmt,
    escapeHtml,
    badgeAtualizacao,
    renderCardHtml,
    renderStatsBarHtml,
    renderQuedasHtml,
    renderTripinhaPickHtml,
} from './_lib/discovery-shared.js';

const SITE_URL = 'https://benetrip.com.br';
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/favicon/web-app-manifest-512x512.png`;

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).send('Método não permitido');
    }

    const slugParam = typeof req.query.cidade === 'string' ? req.query.cidade.toLowerCase().trim() : null;

    let cidades;
    try {
        cidades = carregarCidades();
    } catch (err) {
        console.error('[destinos-baratos-page] Erro ao carregar lista de cidades:', err);
        return sendErrorPage(res, 500, 'Erro interno', 'Não foi possível carregar a lista de cidades agora. Tente novamente em instantes.');
    }

    // /destinos-baratos/sao-paulo é conteúdo duplicado da base -> redireciona
    if (slugParam === 'sao-paulo') {
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400');
        res.setHeader('Location', '/destinos-baratos');
        return res.status(301).end();
    }

    const cidadeAtual = slugParam
        ? encontrarCidadePorSlug(slugParam)
        : cidades.find((c) => c.codigo === CIDADE_PADRAO_CODIGO);

    if (!cidadeAtual) {
        return sendErrorPage(
            res,
            404,
            'Cidade não encontrada',
            `Não encontramos uma página de destinos baratos para "${slugParam || ''}". Veja a lista completa de cidades disponíveis em /destinos-baratos.`
        );
    }

    let snapshot;
    try {
        snapshot = await fetchSnapshotComVariacao(cidadeAtual.codigo, TIPO_PADRAO);
    } catch (err) {
        console.error(`[destinos-baratos-page] Erro ao buscar snapshot de ${cidadeAtual.codigo}:`, err);
        return sendErrorPage(res, 500, 'Erro ao buscar destinos', 'Não conseguimos consultar os destinos baratos agora. Tente novamente em instantes.');
    }

    const isDefault = !slugParam;
    const html = renderPage({ cidadeAtual, cidades, snapshot, isDefault });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'index, follow');
    // Dados mudam ~1x/dia por cidade (cron roda 2x/dia). CDN guarda 6h, revalida em background por até 24h.
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).send(html);
}

// ============================================================
// PÁGINA DE ERRO (404 / 500) — sem dados mockados
// ============================================================
function sendErrorPage(res, status, title, message) {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} | Benetrip</title>
<link rel="stylesheet" href="/assets/css/discovery.css">
</head>
<body>
<div class="discovery-empty" style="padding-top:80px;">
    <img src="/assets/images/tripinha/avatar-pensando.png" alt="Tripinha" onerror="this.style.display='none'">
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(message)}</p>
    <p style="margin-top:16px;"><a href="/destinos-baratos" style="color:#E87722;font-weight:600;">Ver destinos baratos</a></p>
</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', status === 404 ? 'public, max-age=300, s-maxage=3600' : 'no-store');
    return res.status(status).send(html);
}

// ============================================================
// MONTAGEM DA PÁGINA
// ============================================================
function renderPage({ cidadeAtual, cidades, snapshot, isDefault }) {
    const destinos = snapshot?.destinos || [];
    const temDestinos = destinos.length > 0;
    const canonicalPath = isDefault ? '/destinos-baratos' : `/destinos-baratos/${cidadeAtual.slug}`;
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;

    const menorPreco = temDestinos ? destinos[0].preco : null;
    const title = `Destinos Baratos Saindo de ${cidadeAtual.nome} Hoje | Benetrip`;
    const description = temDestinos
        ? `Descubra os ${destinos.length} destinos mais baratos para viajar saindo de ${cidadeAtual.nome} hoje, a partir de R$ ${fmt(menorPreco)}. Ranking atualizado diariamente com preços reais de passagens aéreas.`
        : `A Tripinha está farejando os destinos mais baratos saindo de ${cidadeAtual.nome}. Volte em breve para o ranking atualizado de passagens aéreas.`;

    const chips = montarChips(cidadeAtual, cidades);
    const badge = temDestinos ? badgeAtualizacao(snapshot.data) : null;
    const insight = temDestinos ? (snapshot.insight || null) : null;
    const tripinhaPick = temDestinos ? (snapshot.tripinha_pick || null) : null;
    const quedasHtml = temDestinos ? renderQuedasHtml(destinos) : '';
    const pickHtml = temDestinos ? renderTripinhaPickHtml(tripinhaPick, destinos) : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#E87722">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta name="robots" content="index, follow">

    <!-- Open Graph / Twitter -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Benetrip">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${DEFAULT_OG_IMAGE}">
    <meta property="og:locale" content="pt_BR">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}">

    <!-- JSON-LD -->
    <script type="application/ld+json">${jsonLdSafe(renderBreadcrumbJsonLd(cidadeAtual, isDefault, canonicalUrl))}</script>
    ${temDestinos ? `<script type="application/ld+json">${jsonLdSafe(renderItemListJsonLd(cidadeAtual, destinos, canonicalUrl, snapshot.data))}</script>` : ''}

    <!-- Supabase Config (usado pelo benetrip-auth.js para login, não para os destinos) -->
    <meta name="supabase-url" content="https://dlccjeazkpxtijevusbp.supabase.co">
    <meta name="supabase-anon-key" content="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsY2NqZWF6a3B4dGlqZXZ1c2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3Mjg3MDYsImV4cCI6MjA4NzMwNDcwNn0.lwKwqF74JrHOaghkcbysZQN8jWErVVwPnxzLG7t07QU">

    <!-- Favicons -->
    <link rel="icon" type="image/svg+xml" href="/assets/images/favicon/favicon.svg">
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/favicon/apple-touch-icon.png">

    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Montserrat:wght@400;500&display=swap" rel="stylesheet">

    <!-- Styles -->
    <link rel="stylesheet" href="/assets/css/discovery.css">

    <!-- Vercel Analytics -->
    <script>
        window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    </script>
    <script defer src="/_vercel/insights/script.js"></script>
    <script src="/assets/js/benetrip-autosave.js"></script>
</head>
<body>
    <!-- Header -->
    <div id="benetrip-header-root"></div>

    <!-- ========================================
         BLOCO 1: HERO
         ======================================== -->
    <section class="discovery-hero">
        <div class="container hero-content">
            <img src="/assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="hero-avatar"
                 onerror="this.style.display='none'">
            <h1 id="hero-title">Destinos Baratos Saindo de ${escapeHtml(cidadeAtual.nome)}</h1>
            <p class="hero-subtitle" id="hero-subtitle">
                A Tripinha farejou os voos mais baratos partindo de ${escapeHtml(cidadeAtual.nome)} (${escapeHtml(cidadeAtual.codigo)}). Preços reais, atualizados todos os dias.
            </p>

            <!-- BUSCA DE CIDADE (dentro do hero) -->
            <div class="hero-city-search">
                <div class="city-search-box" id="city-search-box">
                    <svg class="city-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <input type="text" id="city-search-input"
                           placeholder="Digite sua cidade ou código do aeroporto..."
                           autocomplete="off" maxlength="60">
                    <button class="city-search-clear" id="city-search-clear" style="display:none;" aria-label="Limpar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <!-- Dropdown de sugestões -->
                <div class="city-suggestions" id="city-suggestions" style="display:none;">
                    <!-- Preenchido via JS -->
                </div>
            </div>
        </div>
    </section>

    <!-- ========================================
         BLOCO 2: CHIPS RÁPIDOS (cidades automáticas)
         ======================================== -->
    <div class="origin-selector">
        <div class="origin-chips" id="origin-chips">
            ${renderChipsHtml(chips, cidadeAtual)}
            <button class="origin-chip origin-chip-more" id="origin-more-btn">Mais cidades</button>
        </div>
    </div>

    <!-- ========================================
         BLOCO 3: INDICADOR DE CIDADE ATIVA + BADGE
         ======================================== -->
    <div class="active-city-bar" id="active-city-bar" style="${temDestinos ? '' : 'display:none;'}">
        <div class="active-city-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span class="active-city-name" id="active-city-name">${escapeHtml(cidadeAtual.nome)} (${escapeHtml(cidadeAtual.codigo)})</span>
            <span class="active-city-badge badge-auto" id="active-city-badge">${escapeHtml(badge || '')}</span>
        </div>
        <span class="active-city-source" id="active-city-source">Dados automáticos</span>
    </div>

    <!-- ========================================
         BLOCO 3.5: TRIPINHA INSIGHT
         Pré-gerado no cron e renderizado no servidor (sem flicker, visível
         pra SEO). O JS só busca via API quando o snapshot não tem insight.
         ======================================== -->
    <div class="tripinha-insight-bar" id="tripinha-insight-bar" style="${insight ? '' : 'display:none;'}">
        <img src="/assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="insight-avatar"
             onerror="this.style.display='none'">
        <p class="insight-text" id="tripinha-insight-text">${insight ? escapeHtml(insight) : ''}</p>
    </div>

    <!-- ========================================
         BLOCO 4: FILTROS + BUSCA INTELIGENTE
         ======================================== -->
    <div class="filters-section" id="filters-section" style="${temDestinos ? '' : 'display:none;'}">
        <!-- Busca inteligente por destino -->
        <div class="smart-search-section">
            <div class="smart-search-box">
                <input type="text" id="smart-search-input"
                       placeholder="Filtrar: praia barata, natureza até 1500..."
                       autocomplete="off" maxlength="100">
                <button class="smart-search-clear" id="smart-search-clear" style="display:none;" aria-label="Limpar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <button class="smart-search-btn" id="smart-search-btn" aria-label="Buscar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </button>
            </div>
            <div class="search-feedback" id="search-feedback" style="display:none;"></div>
        </div>

        <!-- Filtros combináveis -->
        <div class="quick-filters">
            <div class="filter-row" id="filter-chips">
                <button class="filter-chip active" data-filter="todos" data-tipo="reset">Todos</button>
                <button class="filter-chip" data-filter="praia" data-tipo="estilo">Praia</button>
                <button class="filter-chip" data-filter="cidade" data-tipo="estilo">Cidade</button>
                <button class="filter-chip" data-filter="natureza" data-tipo="estilo">Natureza</button>
                <button class="filter-chip" data-filter="romantico" data-tipo="estilo">Casal</button>
                <button class="filter-chip" data-filter="familia" data-tipo="estilo">Família</button>
                <button class="filter-chip" data-filter="aventura" data-tipo="estilo">Aventura</button>
                <span class="filter-separator"></span>
                <button class="filter-chip" data-filter="nacional" data-tipo="escopo">Nacional</button>
                <button class="filter-chip" data-filter="internacional" data-tipo="escopo">Internacional</button>
                <span class="filter-separator"></span>
                <button class="filter-chip" data-filter="1000" data-tipo="preco">Até R$ 1.000</button>
                <button class="filter-chip" data-filter="2000" data-tipo="preco">Até R$ 2.000</button>
                <button class="filter-chip" data-filter="3000" data-tipo="preco">Até R$ 3.000</button>
            </div>
        </div>
    </div>

    <!-- ========================================
         BLOCO 5: STATS BAR
         ======================================== -->
    <div class="stats-bar" id="stats-bar">${renderStatsBarHtml(destinos)}</div>

    <!-- ========================================
         BLOCO 5.1: MAIORES QUEDAS DE PREÇO (vs média dos últimos dias)
         ======================================== -->
    <section class="quedas-section" id="quedas-section" style="${quedasHtml ? '' : 'display:none;'}">${quedasHtml}</section>

    <!-- ========================================
         BLOCO 5.2: ESCOLHA DA TRIPINHA (pré-gerada no cron)
         ======================================== -->
    <section class="tripinha-pick-section" id="tripinha-pick-section" style="${pickHtml ? '' : 'display:none;'}">${pickHtml}</section>

    <!-- ========================================
         BLOCO 6: LOADING STATE (só reaparece em trocas de cidade via JS)
         ======================================== -->
    <div class="discovery-loading" id="loading-state" style="display:none;">
        <div class="spinner"></div>
        <p id="loading-message">A Tripinha está buscando os destinos mais baratos...</p>
    </div>

    <!-- ========================================
         BLOCO 7: EMPTY / ERROR STATE
         ======================================== -->
    <div class="discovery-empty" id="empty-state" style="${temDestinos ? 'display:none;' : ''}">
        <img src="/assets/images/tripinha/avatar-pensando.png" alt="Tripinha"
             onerror="this.style.display='none'">
        <h3>Nenhum destino encontrado</h3>
        <p id="empty-message">Ainda não temos um snapshot de preços para ${escapeHtml(cidadeAtual.nome)}. Tente outra cidade de origem ou volte em algumas horas.</p>
    </div>

    <!-- ========================================
         BLOCO 8: CARDS DE DESTINOS
         ======================================== -->
    <main class="destinations-section" id="destinations-section" style="${temDestinos ? '' : 'display:none;'}">
        <div class="section-header">
            <h2 class="section-title" id="section-title">Top Destinos de ${escapeHtml(cidadeAtual.nome)}</h2>
            <div class="section-header-right">
                <select class="sort-select" id="sort-select" aria-label="Ordenar por">
                    <option value="preco">Menor preço</option>
                    <option value="queda">Maior queda de preço</option>
                    <option value="nome">Nome A-Z</option>
                </select>
                <span class="section-count" id="section-count">${destinos.length} destino${destinos.length !== 1 ? 's' : ''}</span>
            </div>
        </div>
        <div class="destinations-grid" id="destinations-grid">${destinos.map(renderCardHtml).join('')}</div>
    </main>

    ${renderOutrasCidadesHtml(cidades, cidadeAtual)}

    <!-- ========================================
         BLOCO 9: CTA FINAL
         ======================================== -->
    <section class="discovery-cta" id="cta-section" style="${temDestinos ? '' : 'display:none;'}">
        <img src="/assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="cta-avatar"
             onerror="this.style.display='none'">
        <h2>Quer algo mais parecido com você?</h2>
        <p>A Tripinha analisa seu perfil e encontra destinos que combinam 100% com você.</p>
        <a href="/descobrir-destinos" class="cta-button">Descobrir Meu Destino Ideal</a>
        <br>
        <a href="/voos-baratos" class="cta-button secondary">Ver Calendário de Preços</a>
    </section>

    <!-- ========================================
         SHARE FAB
         ======================================== -->
    <button class="share-fab-discovery" id="share-fab" title="Compartilhar" style="${temDestinos ? 'display:flex;' : 'display:none;'}">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
    </button>

    <!-- Footer -->
    <footer class="discovery-footer">
        Feito com amor pela Tripinha | Benetrip &copy; 2026
        <br>
        <span id="footer-update" style="font-size: 10px; opacity: 0.7;">Dados atualizados automaticamente todos os dias.</span>
    </footer>

    <!-- Dados iniciais renderizados no servidor (hidratação, evita novo fetch) -->
    <script id="discovery-initial-data" type="application/json">${jsonLdSafe({
        origemAtual: cidadeAtual.codigo,
        origemNome: cidadeAtual.nome,
        origemManual: false,
        destinos,
        dataSnapshot: snapshot?.data || null,
        insight,
        tripinhaPick,
        cidadesAutomaticas: cidades.map((c) => ({ codigo: c.codigo, nome: c.nome, estado: c.estado, regiao: c.regiao, slug: c.slug })),
    })}</script>
    <script>
        window.__DISCOVERY_INITIAL__ = JSON.parse(document.getElementById('discovery-initial-data').textContent);
    </script>

    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="/assets/js/benetrip-header.js"></script>
    <script src="/assets/js/benetrip-auth.js"></script>
    <script src="/assets/js/discovery-page.js"></script>
</body>
</html>`;
}

// ============================================================
// CHIPS DE ORIGEM (cidade atual + até 9 do top10 padrão)
// ============================================================
function montarChips(cidadeAtual, cidades) {
    const porCodigo = new Map(cidades.map((c) => [c.codigo, c]));
    const chipsBase = CHIPS_PADRAO.map((codigo) => porCodigo.get(codigo)).filter(Boolean);
    const semAtual = chipsBase.filter((c) => c.codigo !== cidadeAtual.codigo);
    return [cidadeAtual, ...semAtual].slice(0, 10);
}

function renderChipsHtml(chips, cidadeAtual) {
    return chips
        .map((c) => {
            const ativo = c.codigo === cidadeAtual.codigo;
            return `<a href="/destinos-baratos/${c.slug}" class="origin-chip${ativo ? ' active' : ''}" data-origin="${escapeHtml(c.codigo)}" data-name="${escapeHtml(c.nome)}"${ativo ? ' aria-current="page"' : ''}>${escapeHtml(c.nome)}</a>`;
        })
        .join('\n            ');
}

// ============================================================
// "OUTRAS CIDADES" — links crawláveis pras 30 páginas
// ============================================================
const NOME_REGIAO = {
    sudeste: 'Sudeste', sul: 'Sul', nordeste: 'Nordeste',
    'centro-oeste': 'Centro-Oeste', norte: 'Norte',
};

function renderOutrasCidadesHtml(cidades, cidadeAtual) {
    const porRegiao = new Map();
    for (const c of cidades) {
        const regiao = c.regiao || 'outro';
        if (!porRegiao.has(regiao)) porRegiao.set(regiao, []);
        porRegiao.get(regiao).push(c);
    }

    let grupos = '';
    for (const [regiao, lista] of porRegiao) {
        const itens = lista
            .map((c) => {
                const ativo = c.codigo === cidadeAtual.codigo;
                return `<li><a href="/destinos-baratos/${c.slug}"${ativo ? ' aria-current="page"' : ''}>${escapeHtml(c.nome)}</a></li>`;
            })
            .join('');
        grupos += `<div class="other-cities-group"><h4>${escapeHtml(NOME_REGIAO[regiao] || regiao)}</h4><ul class="other-cities-list">${itens}</ul></div>`;
    }

    return `
    <section class="other-cities">
        <details>
            <summary>Ver destinos baratos saindo de outras ${cidades.length} cidades</summary>
            <div class="other-cities-body">${grupos}</div>
        </details>
    </section>`;
}

// ============================================================
// JSON-LD
// ============================================================
function renderBreadcrumbJsonLd(cidadeAtual, isDefault, canonicalUrl) {
    const itemListElement = [
        { '@type': 'ListItem', position: 1, name: 'Benetrip', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: 'Destinos Baratos', item: SITE_URL + '/destinos-baratos' },
    ];
    if (!isDefault) {
        itemListElement.push({ '@type': 'ListItem', position: 3, name: cidadeAtual.nome, item: canonicalUrl });
    }
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement,
    };
}

function renderItemListJsonLd(cidadeAtual, destinos, canonicalUrl, dataSnapshot) {
    const top = destinos.slice(0, 20);

    // Preços são atualizados diariamente pelo cron: a oferta vale até o dia
    // seguinte à data do snapshot.
    let priceValidUntil = null;
    if (dataSnapshot) {
        const validade = new Date(dataSnapshot + 'T12:00:00Z');
        if (!Number.isNaN(validade.getTime())) {
            validade.setUTCDate(validade.getUTCDate() + 1);
            priceValidUntil = validade.toISOString().split('T')[0];
        }
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `Destinos baratos saindo de ${cidadeAtual.nome}`,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: destinos.length,
        itemListElement: top.map((d, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
                '@type': 'Offer',
                name: `${cidadeAtual.nome} → ${d.nome}`,
                priceCurrency: d.moeda || 'BRL',
                price: String(d.preco || 0),
                availability: 'https://schema.org/InStock',
                ...(priceValidUntil ? { priceValidUntil } : {}),
                url: canonicalUrl,
            },
        })),
    };
}

// Serializa JSON para uso seguro dentro de <script>, evitando que um valor
// vindo dos dados (ex.: nome de destino) feche a tag prematuramente.
function jsonLdSafe(obj) {
    return JSON.stringify(obj)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
}
