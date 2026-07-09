// api/escapadas-page.js - BENETRIP ESCAPADAS SSR v1.0
// Renderiza /escapadas e /escapadas/:cidade: viagens de fim de semana e
// feriados nacionais saindo de cada cidade, com preços por JANELA de datas
// (sex->dom rolantes + emendas de feriado), para quem não está de férias.
//
// Roteamento (vercel.json rewrites):
//   /escapadas          -> /api/escapadas-page                 (default: São Paulo)
//   /escapadas/:cidade  -> /api/escapadas-page?cidade=:cidade
//
// Mesmas regras da destinos-baratos-page: leitura via anon key, sem fallback
// silencioso (erro de Supabase = página de erro real), São Paulo na base.
// Todas as janelas vêm em UMA query; o seletor de janela troca no cliente
// sem novo fetch (dados embutidos em __ESCAPADAS_INITIAL__).

import {
    CHIPS_PADRAO,
    CIDADE_PADRAO_CODIGO,
    carregarCidades,
    encontrarCidadePorSlug,
    fmt,
    escapeHtml,
    badgeAtualizacao,
    renderCardHtml,
    renderStatsBarHtml,
    buildGoogleFlightsUrl,
} from './_lib/discovery-shared.js';
import { janelasAtivas, fetchSnapshotsEscapadas, hojeISO } from './_lib/escapadas-shared.js';
import { feriadosDoAno, proximosFeriados, janelaDoFeriado, descricaoEmenda, diffDias } from './_lib/feriados.js';

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
        console.error('[escapadas-page] Erro ao carregar lista de cidades:', err);
        return sendErrorPage(res, 500, 'Erro interno', 'Não foi possível carregar a lista de cidades agora. Tente novamente em instantes.');
    }

    if (slugParam === 'sao-paulo') {
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400');
        res.setHeader('Location', '/escapadas');
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
            `Não encontramos uma página de escapadas para "${slugParam || ''}". Veja a lista completa de cidades disponíveis em /escapadas.`
        );
    }

    const hoje = hojeISO();
    const janelas = janelasAtivas(hoje);

    let snapshotsPorJanela;
    try {
        snapshotsPorJanela = await fetchSnapshotsEscapadas(cidadeAtual.codigo, janelas);
    } catch (err) {
        console.error(`[escapadas-page] Erro ao buscar snapshots de ${cidadeAtual.codigo}:`, err);
        return sendErrorPage(res, 500, 'Erro ao buscar escapadas', 'Não conseguimos consultar os preços das escapadas agora. Tente novamente em instantes.');
    }

    // Janela ativa: ?janela=id válido, senão a primeira com dados, senão a primeira
    const janelaParam = typeof req.query.janela === 'string' ? req.query.janela : null;
    const janelasComDados = janelas.map((j) => ({ ...j, snapshot: snapshotsPorJanela.get(j.id) || null }));
    const janelaAtiva =
        janelasComDados.find((j) => j.id === janelaParam) ||
        janelasComDados.find((j) => j.snapshot) ||
        janelasComDados[0];

    const isDefault = !slugParam;
    // Link compartilhado com ?janela= ganha título/OG específicos da janela:
    // é o preview no WhatsApp que "vende" o clique dentro da conversa.
    const janelaExplicita = janelaParam && janelaAtiva?.id === janelaParam;
    const html = renderPage({ cidadeAtual, cidades, janelas: janelasComDados, janelaAtiva, hoje, isDefault, janelaExplicita });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'index, follow');
    // Snapshots mudam ~1x/dia por cidade; janelas rolam no máximo 1x/dia.
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).send(html);
}

// ============================================================
// PÁGINA DE ERRO (404 / 500)
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
    <p style="margin-top:16px;"><a href="/escapadas" style="color:#E87722;font-weight:600;">Ver escapadas de fim de semana</a></p>
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
function renderPage({ cidadeAtual, cidades, janelas, janelaAtiva, hoje, isDefault, janelaExplicita }) {
    const destinos = janelaAtiva?.snapshot?.destinos || [];
    const temDestinos = destinos.length > 0;
    const canonicalPath = isDefault ? '/escapadas' : `/escapadas/${cidadeAtual.slug}`;
    // Canonical fica sem ?janela= (as janelas rolam; a página da cidade é o
    // conteúdo permanente). O og:url mantém a janela pro preview do link.
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const ogUrl = janelaExplicita ? `${canonicalUrl}?janela=${encodeURIComponent(janelaAtiva.id)}` : canonicalUrl;

    const menorPreco = temDestinos ? destinos[0].preco : null;
    let title = `Escapadas de Fim de Semana e Feriados Saindo de ${cidadeAtual.nome} | Benetrip`;
    let description = temDestinos
        ? `Para onde viajar no fim de semana ou no próximo feriado saindo de ${cidadeAtual.nome}? Voos de ida e volta a partir de R$ ${fmt(menorPreco)} para ${janelaAtiva.rotuloDatas}. Preços reais por data, atualizados todos os dias.`
        : `A Tripinha está farejando voos de fim de semana e feriados saindo de ${cidadeAtual.nome}. Volte em breve para ver os preços por data.`;

    if (janelaExplicita) {
        const rotuloJanela = janelaAtiva.categoria === 'feriado'
            ? `${janelaAtiva.feriado.nome} (${janelaAtiva.rotuloDatas})`
            : `Fim de semana de ${janelaAtiva.rotuloDatas}`;
        title = `${rotuloJanela}: escapadas saindo de ${cidadeAtual.nome} | Benetrip`;
        description = temDestinos
            ? `Voos de ida e volta saindo de ${cidadeAtual.nome} para ${janelaAtiva.rotuloDatas}, a partir de R$ ${fmt(menorPreco)}.${janelaAtiva.categoria === 'feriado' ? ` ${janelaAtiva.feriado.nome} ${janelaAtiva.feriado.emenda}.` : ''} Preços reais, atualizados todos os dias.`
            : `Escapadas saindo de ${cidadeAtual.nome} para ${janelaAtiva.rotuloDatas}. A Tripinha está farejando os preços — volte em breve.`;
    }

    const chips = montarChips(cidadeAtual, cidades);
    const badge = janelaAtiva?.snapshot ? badgeAtualizacao(janelaAtiva.snapshot.data) : null;
    const proximoFeriado = proximosFeriados(hoje, 1, 1)[0] || null;

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
    <meta property="og:url" content="${ogUrl}">
    <meta property="og:image" content="${DEFAULT_OG_IMAGE}">
    <meta property="og:locale" content="pt_BR">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}">

    <!-- JSON-LD -->
    <script type="application/ld+json">${jsonLdSafe(renderBreadcrumbJsonLd(cidadeAtual, isDefault, canonicalUrl))}</script>
    ${temDestinos ? `<script type="application/ld+json">${jsonLdSafe(renderItemListJsonLd(cidadeAtual, janelaAtiva, destinos, canonicalUrl))}</script>` : ''}

    <!-- Favicons -->
    <link rel="icon" type="image/svg+xml" href="/assets/images/favicon/favicon.svg">
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/favicon/apple-touch-icon.png">

    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Montserrat:wght@400;500&display=swap" rel="stylesheet">

    <!-- Styles -->
    <link rel="stylesheet" href="/assets/css/discovery.css">
    <link rel="stylesheet" href="/assets/css/escapadas.css">

    <!-- Vercel Analytics -->
    <script>
        window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    </script>
    <script defer src="/_vercel/insights/script.js"></script>
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
            <h1 id="hero-title">Escapadas de Fim de Semana Saindo de ${escapeHtml(cidadeAtual.nome)}</h1>
            <p class="hero-subtitle" id="hero-subtitle">
                Fins de semana e feriados nacionais com preço real por data, saindo de ${escapeHtml(cidadeAtual.nome)} (${escapeHtml(cidadeAtual.codigo)}). Para quem não está de férias, mas não abre mão de viajar.
            </p>

            <!-- BUSCA DE CIDADE (30 automáticas + qualquer aeroporto ao vivo) -->
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
                <div class="city-suggestions" id="city-suggestions" style="display:none;"></div>
            </div>
        </div>
    </section>

    <!-- ========================================
         BLOCO 2: CHIPS DE CIDADE (links crawláveis)
         ======================================== -->
    <div class="origin-selector">
        <div class="origin-chips" id="origin-chips">
            ${renderChipsHtml(chips, cidadeAtual)}
        </div>
    </div>

    <!-- ========================================
         BLOCO 3: BARRA DO PRÓXIMO FERIADO (gancho da emenda)
         ======================================== -->
    ${proximoFeriado ? renderFeriadoBarHtml(proximoFeriado, hoje, janelas) : ''}

    <!-- ========================================
         BLOCO 4: SELETOR DE JANELA (fds e feriados)
         ======================================== -->
    <div class="janela-selector container" id="janela-selector">
        ${janelas.map((j) => renderJanelaChipHtml(j, janelaAtiva)).join('\n        ')}
    </div>

    <!-- ========================================
         BLOCO 5: INDICADOR DA JANELA ATIVA + BADGE
         ======================================== -->
    <div class="active-city-bar" id="active-city-bar">
        <div class="active-city-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span class="active-city-name" id="janela-ativa-nome">${escapeHtml(janelaAtiva ? `${janelaAtiva.rotulo} · ${janelaAtiva.rotuloDatas}` : '')}</span>
            <span class="active-city-badge badge-auto" id="janela-ativa-badge">${escapeHtml(badge || 'Aguardando preços')}</span>
        </div>
        <span class="active-city-source">ida e volta · ${escapeHtml(cidadeAtual.nome)}</span>
    </div>

    <!-- ========================================
         BLOCO 6: FILTROS DE ESCAPADA
         ======================================== -->
    <div class="filters-section" id="filters-section" style="${temDestinos ? '' : 'display:none;'}">
        <div class="quick-filters">
            <div class="filter-row" id="filter-chips">
                <button class="filter-chip active" data-filter="todos" data-tipo="reset">Todos</button>
                <button class="filter-chip" data-filter="direto" data-tipo="voo">Voo direto</button>
                <button class="filter-chip" data-filter="curto" data-tipo="voo">Até 2h de voo</button>
                <span class="filter-separator"></span>
                <button class="filter-chip" data-filter="praia" data-tipo="estilo">Praia</button>
                <button class="filter-chip" data-filter="natureza" data-tipo="estilo">Natureza</button>
                <button class="filter-chip" data-filter="cidade" data-tipo="estilo">Cidade</button>
                <span class="filter-separator"></span>
                <button class="filter-chip" data-filter="500" data-tipo="preco">Até R$ 500</button>
                <button class="filter-chip" data-filter="1000" data-tipo="preco">Até R$ 1.000</button>
                <button class="filter-chip" data-filter="1500" data-tipo="preco">Até R$ 1.500</button>
            </div>
        </div>
    </div>

    <!-- ========================================
         BLOCO 7: STATS DA JANELA ATIVA
         ======================================== -->
    <div class="stats-bar" id="stats-bar">${renderStatsBarHtml(destinos)}</div>

    <!-- ========================================
         BLOCO 7.5: LOADING (busca ao vivo de cidade fora das 30)
         ======================================== -->
    <div class="discovery-loading" id="loading-state" style="display:none;">
        <div class="spinner"></div>
        <p id="loading-message">A Tripinha está farejando voos em tempo real...</p>
    </div>

    <!-- ========================================
         BLOCO 8: EMPTY STATE (janela sem snapshot ainda)
         ======================================== -->
    <div class="discovery-empty" id="empty-state" style="${temDestinos ? 'display:none;' : ''}">
        <img src="/assets/images/tripinha/avatar-pensando.png" alt="Tripinha"
             onerror="this.style.display='none'">
        <h3>Ainda sem preços para esta janela</h3>
        <p id="empty-message">A Tripinha atualiza os preços das escapadas duas vezes por dia. Volte em algumas horas ou escolha outra janela de datas.</p>
    </div>

    <!-- ========================================
         BLOCO 9: CARDS DE DESTINOS
         ======================================== -->
    <main class="destinations-section" id="destinations-section" style="${temDestinos ? '' : 'display:none;'}">
        <div class="section-header">
            <h2 class="section-title" id="section-title">${escapeHtml(tituloSecao(janelaAtiva, cidadeAtual))}</h2>
            <div class="section-header-right">
                <select class="sort-select" id="sort-select" aria-label="Ordenar por">
                    <option value="preco">Menor preço</option>
                    <option value="voo">Voo mais curto</option>
                    <option value="queda">Maior queda de preço</option>
                    <option value="nome">Nome A-Z</option>
                </select>
                <span class="section-count" id="section-count">${destinos.length} destino${destinos.length !== 1 ? 's' : ''}</span>
            </div>
        </div>
        <div class="destinations-grid" id="destinations-grid">${destinos.map((d) => renderCardHtml(d, { escapada: true, href: hrefDoDestino(d, cidadeAtual) })).join('')}</div>
    </main>

    <!-- ========================================
         BLOCO 10: CALENDÁRIO DE FERIADOS (crawlável, SEO)
         ======================================== -->
    ${renderCalendarioFeriadosHtml(hoje, janelas)}

    ${renderOutrasCidadesHtml(cidades, cidadeAtual)}

    <!-- ========================================
         BLOCO 11: CTA FINAL
         ======================================== -->
    <section class="discovery-cta" id="cta-section">
        <img src="/assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="cta-avatar"
             onerror="this.style.display='none'">
        <h2>Quer viajar mais dias?</h2>
        <p>Veja o ranking completo de destinos baratos saindo de ${escapeHtml(cidadeAtual.nome)}, sem prender as datas.</p>
        <a href="${isDefault ? '/destinos-baratos' : `/destinos-baratos/${escapeHtml(cidadeAtual.slug)}`}" class="cta-button">Ver Destinos Baratos</a>
        <br>
        <a href="/voos-baratos" class="cta-button secondary">Ver Calendário de Preços</a>
    </section>

    <!-- ========================================
         SHARE FAB (mensagem da janela ativa)
         ======================================== -->
    <button class="share-fab-discovery" id="share-fab" title="Compartilhar escapadas" style="${temDestinos ? 'display:flex;' : 'display:none;'}">
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
        <span style="font-size: 10px; opacity: 0.7;">Preços de ida e volta por janela de datas, atualizados automaticamente todos os dias.</span>
    </footer>

    <!-- Dados iniciais renderizados no servidor (hidratação, sem novo fetch) -->
    <script id="escapadas-initial-data" type="application/json">${jsonLdSafe({
        origemAtual: cidadeAtual.codigo,
        origemNome: cidadeAtual.nome,
        origemSlug: cidadeAtual.slug,
        janelaAtiva: janelaAtiva?.id || null,
        cidadesAutomaticas: cidades.map((c) => ({ codigo: c.codigo, nome: c.nome, estado: c.estado, regiao: c.regiao, slug: c.slug })),
        janelas: janelas.map((j) => ({
            id: j.id,
            categoria: j.categoria,
            rotulo: j.rotulo,
            rotuloDatas: j.rotuloDatas,
            ida: j.ida,
            volta: j.volta,
            noites: j.noites,
            feriado: j.feriado || null,
            dataSnapshot: j.snapshot?.data || null,
            destinos: j.snapshot?.destinos || [],
        })),
    })}</script>
    <script>
        window.__ESCAPADAS_INITIAL__ = JSON.parse(document.getElementById('escapadas-initial-data').textContent);
    </script>

    <!-- Scripts -->
    <script src="/assets/js/benetrip-header.js"></script>
    <script src="/assets/js/escapadas-page.js"></script>
</body>
</html>`;
}

// Card leva direto ao Google Flights com as datas da janela (a pessoa vê as
// opções de voo na hora). Sem código IATA não há como montar a busca: cai no
// calendário interno de preços como antes.
function hrefDoDestino(d, cidadeAtual) {
    if (d.aeroporto && d.data_ida && d.data_volta) {
        return buildGoogleFlightsUrl(cidadeAtual.codigo, d.aeroporto, d.data_ida, d.data_volta);
    }
    const params = new URLSearchParams({ origem: cidadeAtual.codigo, destino: d.aeroporto || d.nome, nome: d.nome });
    if (d.data_ida) params.set('data_ida', d.data_ida);
    if (d.data_volta) params.set('data_volta', d.data_volta);
    return `/voos-baratos?${params.toString()}`;
}

function tituloSecao(janelaAtiva, cidadeAtual) {
    if (!janelaAtiva) return `Escapadas de ${cidadeAtual.nome}`;
    if (janelaAtiva.categoria === 'feriado') return `${janelaAtiva.feriado.nome}: escapadas de ${cidadeAtual.nome}`;
    return `${janelaAtiva.rotulo} saindo de ${cidadeAtual.nome}`;
}

// ============================================================
// CHIPS DE CIDADE (links para /escapadas/:slug)
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
            const href = c.slug === 'sao-paulo' ? '/escapadas' : `/escapadas/${c.slug}`;
            return `<a href="${href}" class="origin-chip${ativo ? ' active' : ''}" data-origin="${escapeHtml(c.codigo)}" data-name="${escapeHtml(c.nome)}"${ativo ? ' aria-current="page"' : ''}>${escapeHtml(c.nome)}</a>`;
        })
        .join('\n            ');
}

// ============================================================
// SELETOR DE JANELA
// ============================================================
function renderJanelaChipHtml(janela, janelaAtiva) {
    const ativo = janela.id === janelaAtiva?.id;
    const menorPreco = janela.snapshot?.destinos?.[0]?.preco || null;
    const feriadoClass = janela.categoria === 'feriado' ? ' janela-chip-feriado' : '';
    return `<button class="janela-chip${feriadoClass}${ativo ? ' active' : ''}" data-janela="${escapeHtml(janela.id)}"${ativo ? ' aria-current="true"' : ''}>
            <span class="janela-chip-rotulo">${janela.categoria === 'feriado' ? '&#127958;&#65039; ' : ''}${escapeHtml(janela.rotulo)}</span>
            <span class="janela-chip-datas">${escapeHtml(janela.rotuloDatas)}${janela.categoria === 'feriado' && janela.feriado.folga === 0 ? ' · sem folga' : ''}</span>
            ${menorPreco ? `<span class="janela-chip-preco">a partir de R$ ${fmt(menorPreco)}</span>` : '<span class="janela-chip-preco janela-chip-preco-vazio">em breve</span>'}
        </button>`;
}

// ============================================================
// BARRA DO PRÓXIMO FERIADO ("Faltam N dias...")
// ============================================================
function renderFeriadoBarHtml(feriado, hoje, janelas) {
    const dias = diffDias(hoje, feriado.data);
    const contagem = dias === 0 ? 'É hoje!' : dias === 1 ? 'É amanhã!' : `Faltam ${dias} dias`;
    const janelaDoFer = janelas.find((j) => j.categoria === 'feriado' && j.feriado?.nome === feriado.nome);
    const linkJanela = janelaDoFer ? `<button class="feriado-bar-link" data-janela="${escapeHtml(janelaDoFer.id)}">ver voos &rarr;</button>` : '';

    return `
    <div class="feriado-bar" id="feriado-bar">
        <span class="feriado-bar-emoji">&#128197;</span>
        <p class="feriado-bar-texto"><strong>${contagem}</strong> para ${escapeHtml(feriado.nome)} &middot; ${escapeHtml(descricaoEmenda(feriado))}</p>
        ${linkJanela}
    </div>`;
}

// ============================================================
// CALENDÁRIO DE FERIADOS DO ANO (seção crawlável de SEO)
// ============================================================
function renderCalendarioFeriadosHtml(hoje, janelas) {
    const ano = Number(hoje.slice(0, 4));
    const feriados = [...feriadosDoAno(ano), ...feriadosDoAno(ano + 1)].filter(
        (f) => diffDias(hoje, f.data) >= 0 && diffDias(hoje, f.data) <= 365
    );

    const itens = feriados
        .map((f) => {
            const j = janelaDoFeriado(f);
            const janelaViva = janelas.find((jan) => jan.id === `feriado-${f.slug}-${f.ano}`);
            const [, m, d] = f.data.split('-').map(Number);
            const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
            const acao = janelaViva
                ? `<button class="feriado-item-link" data-janela="${escapeHtml(janelaViva.id)}">ver voos &rarr;</button>`
                : `<span class="feriado-item-dias">em ${diffDias(hoje, f.data)} dias</span>`;
            return `<li class="feriado-item${janelaViva ? ' feriado-item-ativo' : ''}">
                <span class="feriado-item-data">${d} ${meses[m - 1]}${f.ano !== ano ? ` ${f.ano}` : ''}</span>
                <span class="feriado-item-info"><strong>${escapeHtml(f.nome)}</strong><span class="feriado-item-emenda">${escapeHtml(descricaoEmenda(f))}${f.oficial ? '' : ' · ponto facultativo'}</span></span>
                ${acao}
            </li>`;
        })
        .join('');

    return `
    <section class="calendario-feriados" id="calendario-feriados">
        <div class="section-header">
            <h2 class="section-title">Próximos feriados no Brasil</h2>
        </div>
        <p class="calendario-sub">Quando cai cada feriado, se vale a emenda e quantos dias de viagem rendem sem tirar férias.</p>
        <ul class="feriado-lista">${itens}</ul>
    </section>`;
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
                const href = c.slug === 'sao-paulo' ? '/escapadas' : `/escapadas/${c.slug}`;
                return `<li><a href="${href}"${ativo ? ' aria-current="page"' : ''}>${escapeHtml(c.nome)}</a></li>`;
            })
            .join('');
        grupos += `<div class="other-cities-group"><h4>${escapeHtml(NOME_REGIAO[regiao] || regiao)}</h4><ul class="other-cities-list">${itens}</ul></div>`;
    }

    return `
    <section class="other-cities">
        <details>
            <summary>Ver escapadas saindo de outras ${cidades.length} cidades</summary>
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
        { '@type': 'ListItem', position: 2, name: 'Escapadas de Fim de Semana e Feriados', item: SITE_URL + '/escapadas' },
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

function renderItemListJsonLd(cidadeAtual, janelaAtiva, destinos, canonicalUrl) {
    const top = destinos.slice(0, 20);
    const dataSnapshot = janelaAtiva.snapshot?.data || null;

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
        name: `Escapadas saindo de ${cidadeAtual.nome} · ${janelaAtiva.rotulo} (${janelaAtiva.rotuloDatas})`,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: destinos.length,
        itemListElement: top.map((d, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
                '@type': 'Offer',
                name: `${cidadeAtual.nome} → ${d.nome} (${janelaAtiva.rotuloDatas})`,
                priceCurrency: d.moeda || 'BRL',
                price: String(d.preco || 0),
                availability: 'https://schema.org/InStock',
                ...(priceValidUntil ? { priceValidUntil } : {}),
                url: canonicalUrl,
            },
        })),
    };
}

// Serializa JSON para uso seguro dentro de <script>
function jsonLdSafe(obj) {
    return JSON.stringify(obj)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
}
