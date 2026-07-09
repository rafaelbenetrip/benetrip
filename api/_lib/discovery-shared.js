// api/_lib/discovery-shared.js - BENETRIP DISCOVERY SHARED v1.0
// Módulo compartilhado entre api/discovery.js (JSON) e api/destinos-baratos-page.js (SSR).
// Fonte única de: lista de cidades automáticas, slug<->cidade, fetch de snapshot
// no Supabase (leitura pública via RLS, usa a anon key) e helpers de formatação/HTML.
//
// A escrita de snapshots continua isolada em api/cron/update-discovery.js,
// que usa SUPABASE_SERVICE_ROLE_KEY (nunca exposta aqui).

import { readFileSync } from 'fs';
import { join } from 'path';

export const TIPO_PADRAO = 'destinos-baratos';

// Chips rápidos exibidos no topo (mesma ordem do design original)
export const CHIPS_PADRAO = ['GRU', 'GIG', 'BSB', 'CNF', 'SSA', 'REC', 'POA', 'CWB', 'FOR', 'FLN'];

// Cidade padrão quando nenhum slug é informado (mantém o comportamento atual da página)
export const CIDADE_PADRAO_CODIGO = 'GRU';

let _cidadesCache = null;

// ============================================================
// SLUGS E LISTA DE CIDADES
// ============================================================
export function slugify(nome) {
    return String(nome || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-+|-+$)/g, '');
}

export function carregarCidades() {
    if (_cidadesCache) return _cidadesCache;
    const filePath = join(process.cwd(), 'api', 'data', 'brazilian-airports.json');
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    _cidadesCache = (data.cidades || []).map((c) => ({ ...c, slug: slugify(c.nome) }));
    return _cidadesCache;
}

export function encontrarCidadePorSlug(slug) {
    const cidades = carregarCidades();
    return cidades.find((c) => c.slug === slug) || null;
}

export function encontrarCidadePorCodigo(codigo) {
    const cidades = carregarCidades();
    return cidades.find((c) => c.codigo === codigo) || null;
}

// ============================================================
// SUPABASE (leitura pública via RLS - anon key)
// ============================================================
export async function fetchSnapshot(origem, tipo = TIPO_PADRAO, data = null) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
    }

    let url = `${supabaseUrl}/rest/v1/discovery_snapshots?origem=eq.${encodeURIComponent(origem)}&tipo=eq.${encodeURIComponent(tipo)}&select=*&order=data.desc&limit=1`;
    if (data) {
        url = `${supabaseUrl}/rest/v1/discovery_snapshots?origem=eq.${encodeURIComponent(origem)}&tipo=eq.${encodeURIComponent(tipo)}&data=eq.${encodeURIComponent(data)}&select=*&limit=1`;
    }

    const response = await fetch(url, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Supabase respondeu ${response.status} ao buscar snapshot de ${origem}: ${errorText.slice(0, 300)}`);
    }

    const rows = await response.json();
    return rows.length > 0 ? rows[0] : null;
}

// Busca os N snapshots mais recentes de uma origem (hoje + histórico) em uma query só.
export async function fetchSnapshots(origem, tipo = TIPO_PADRAO, limit = 8) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
    }

    const url = `${supabaseUrl}/rest/v1/discovery_snapshots?origem=eq.${encodeURIComponent(origem)}&tipo=eq.${encodeURIComponent(tipo)}&select=*&order=data.desc&limit=${limit}`;
    const response = await fetch(url, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Supabase respondeu ${response.status} ao buscar snapshots de ${origem}: ${errorText.slice(0, 300)}`);
    }

    return response.json();
}

function chaveDestino(d) {
    return `${(d.nome || '').toLowerCase()}_${(d.pais || '').toLowerCase()}`;
}

export function calcularVariacoes(destinosHoje, destinosOntem) {
    if (!destinosOntem || destinosOntem.length === 0) {
        return destinosHoje.map((d) => ({ ...d, variacao: null }));
    }
    return calcularVariacoesHistorico(destinosHoje, [{ destinos: destinosOntem }]);
}

// Variação do preço de hoje vs. a MÉDIA dos snapshots anteriores (até 7 dias).
// Comparar com a média da semana é mais estável do que comparar só com ontem:
// não zera quando o lote de ontem falhou e não dispara com flutuação de 1 dia.
// Variações menores que 1% são tratadas como estáveis.
export function calcularVariacoesHistorico(destinosHoje, snapshotsAnteriores) {
    const anteriores = (snapshotsAnteriores || []).filter((s) => Array.isArray(s?.destinos) && s.destinos.length > 0);
    if (anteriores.length === 0) {
        return destinosHoje.map((d) => ({ ...d, variacao: null }));
    }

    const precosHistoricos = new Map();
    for (const snap of anteriores) {
        for (const d of snap.destinos) {
            if (!d.preco) continue;
            const key = chaveDestino(d);
            if (!precosHistoricos.has(key)) precosHistoricos.set(key, []);
            precosHistoricos.get(key).push(d.preco);
        }
    }

    return destinosHoje.map((d) => {
        const historico = precosHistoricos.get(chaveDestino(d));
        if (!historico || historico.length === 0 || !d.preco) {
            return { ...d, variacao: null };
        }

        const media = historico.reduce((a, b) => a + b, 0) / historico.length;
        const diff = Math.round(d.preco - media);
        const percentual = parseFloat(((diff / media) * 100).toFixed(1));
        const estavel = Math.abs(percentual) < 1;

        return {
            ...d,
            variacao: {
                preco_anterior: Math.round(media),
                diferenca: diff,
                percentual,
                direcao: estavel ? 'estavel' : diff > 0 ? 'subiu' : 'desceu',
                referencia: historico.length === 1 ? 'ontem' : 'media',
                dias: historico.length,
            },
        };
    });
}

// Busca o snapshot mais recente de uma origem, já com variação vs. média dos
// últimos 7 dias calculada (uma única query traz hoje + histórico).
// Retorna null se não houver snapshot (cidade ainda sem dados, não é erro).
// Lança exceção se a consulta ao Supabase falhar (sem fallback silencioso).
export async function fetchSnapshotComVariacao(origem, tipo = TIPO_PADRAO) {
    const rows = await fetchSnapshots(origem, tipo, 8);
    if (!rows || rows.length === 0) return null;

    const snapshot = rows[0];
    const anteriores = rows.slice(1);
    const destinos = calcularVariacoesHistorico(snapshot.destinos || [], anteriores);
    return { ...snapshot, destinos };
}

// ============================================================
// FORMATAÇÃO / ESCAPE
// ============================================================
export function fmt(valor) {
    if (!valor) return '0';
    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// "2026-09-12" -> "12 set" (parse manual para não depender de timezone)
export function fmtDataCurta(iso) {
    if (!iso || typeof iso !== 'string') return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d || m < 1 || m > 12) return '';
    return `${d} ${MESES_CURTOS[m - 1]}`;
}

export function fmtPeriodo(dataIda, dataVolta) {
    const ida = fmtDataCurta(dataIda);
    if (!ida) return '';
    const volta = fmtDataCurta(dataVolta);
    return volta ? `${ida} → ${volta}` : ida;
}

// Rótulo da base de comparação da variação (ontem ou média da semana)
export function labelVariacao(v) {
    return v?.referencia === 'ontem' ? 'vs ontem' : 'vs média da semana';
}

// Queda a partir deste percentual ganha destaque visual no card
export const QUEDA_DESTAQUE_PCT = 5;
// Queda mínima para entrar na seção "Maiores quedas"
export const QUEDA_SECAO_PCT = 3;

export function maioresQuedas(destinos, limite = 5) {
    return (destinos || [])
        .filter((d) => d.variacao?.direcao === 'desceu' && Math.abs(d.variacao.percentual) >= QUEDA_SECAO_PCT)
        .sort((a, b) => a.variacao.percentual - b.variacao.percentual)
        .slice(0, limite);
}

const ESTILO_LABEL = {
    romantico: 'Casal', familia: 'Família', aventura: 'Aventura',
    praia: 'Praia', natureza: 'Natureza', cidade: 'Cidade',
    nacional: 'Nacional', internacional: 'Internacional',
};

export function capitalizeEstilo(str) {
    if (!str) return '';
    return ESTILO_LABEL[str] || str.charAt(0).toUpperCase() + str.slice(1);
}

export function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Badge "Atualizado hoje" / "Atualizado ontem" / "Há N dias"
export function badgeAtualizacao(dataSnapshot) {
    if (!dataSnapshot) return 'Dados automáticos';
    const dataObj = new Date(dataSnapshot + 'T12:00:00');
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    const diffDias = Math.round((hoje - dataObj) / (1000 * 60 * 60 * 24));
    if (diffDias === 0) return 'Atualizado hoje';
    if (diffDias === 1) return 'Atualizado ontem';
    return `Há ${diffDias} dias`;
}

// ============================================================
// GOOGLE FLIGHTS URL (server-side)
// Mesmo encoding tfs/tfu (protobuf em base64url) já usado no client em
// descobrir-destinos.js e comparar-voos.js: abre direto nos resultados
// de ida e volta com as datas preenchidas.
// ============================================================
function protoVarint(value) {
    const bytes = [];
    let v = value >>> 0;
    while (v > 0x7f) { bytes.push((v & 0x7f) | 0x80); v >>>= 7; }
    bytes.push(v & 0x7f);
    return bytes;
}
function protoVarintField(fieldNumber, value) {
    return [...protoVarint((fieldNumber << 3) | 0), ...protoVarint(value)];
}
function protoStringField(fieldNumber, str) {
    const encoded = Array.from(Buffer.from(str, 'utf-8'));
    return [...protoVarint((fieldNumber << 3) | 2), ...protoVarint(encoded.length), ...encoded];
}
function protoMessageField(fieldNumber, messageBytes) {
    return [...protoVarint((fieldNumber << 3) | 2), ...protoVarint(messageBytes.length), ...messageBytes];
}
function toBase64Url(bytes) {
    return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function buildAirport(iataCode) {
    return [...protoVarintField(1, 1), ...protoStringField(2, iataCode)];
}
function buildFlightLeg(date, originIata, destIata) {
    return [
        ...protoStringField(2, date),
        ...protoMessageField(13, buildAirport(originIata)),
        ...protoMessageField(14, buildAirport(destIata)),
    ];
}

export function buildGoogleFlightsUrl(originIata, destIata, departDate, returnDate) {
    const tfs = toBase64Url([
        ...protoVarintField(1, 28),
        ...protoVarintField(2, 2),
        ...protoMessageField(3, buildFlightLeg(departDate, originIata, destIata)),
        ...protoMessageField(3, buildFlightLeg(returnDate, destIata, originIata)),
        ...protoVarintField(14, 1),
    ]);
    const tfu = toBase64Url(protoMessageField(2, [
        ...protoVarintField(1, 1),
        ...protoVarintField(2, 0),
        ...protoVarintField(3, 0),
    ]));
    const params = new URLSearchParams();
    params.set('tfs', tfs);
    params.set('tfu', tfu);
    params.set('curr', 'BRL');
    params.set('hl', 'pt-BR');
    params.set('gl', 'br');
    return `https://www.google.com/travel/flights/search?${params.toString()}`;
}

// ============================================================
// RENDER HTML (server-side, espelha discovery-page.js no client)
// ============================================================
export function renderVariacaoStatHtml(v) {
    if (!v) return '';
    if (v.direcao === 'desceu') return `<div class="stat-variation down">&darr; ${Math.abs(v.percentual)}% ${labelVariacao(v)}</div>`;
    if (v.direcao === 'subiu') return `<div class="stat-variation up">&uarr; ${Math.abs(v.percentual)}% ${labelVariacao(v)}</div>`;
    return `<div class="stat-variation stable">&rarr; Estável</div>`;
}

export function renderVariacaoInlineHtml(v) {
    if (!v) return '';
    if (v.direcao === 'desceu') return `<span class="dest-price-variation down">&darr; R$ ${fmt(Math.abs(v.diferenca))} ${labelVariacao(v)}</span>`;
    if (v.direcao === 'subiu') return `<span class="dest-price-variation up">&uarr; R$ ${fmt(Math.abs(v.diferenca))} ${labelVariacao(v)}</span>`;
    return '';
}

// Linha "📅 12 set → 19 set" com as datas reais consultadas para o preço do card
export function renderDatasCardHtml(d) {
    const periodo = fmtPeriodo(d.data_ida, d.data_volta);
    if (!periodo) return '';
    return `<div class="dest-dates" title="Preço encontrado para essas datas — outras datas podem variar">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>${escapeHtml(periodo).replace('→', '&rarr;')}</span>
                    </div>`;
}

// opts.escapada: card de /escapadas — preço é de ida e volta em datas fixas
// e a duração é em noites (min === max).
// opts.href: card vira um <a target="_blank"> (link real, imune a bloqueio
// de popup) em vez de <article> clicável via JS.
// Proteção contra .map(renderCardHtml), que passa o índice como 2º argumento.
export function renderCardHtml(d, opts) {
    const { escapada = false, href = null } = (opts && typeof opts === 'object') ? opts : {};
    const imgSrc = d.imagem ? escapeHtml(d.imagem) : 'assets/images/tripinha/avatar-pensando.png';
    const nome = escapeHtml(d.nome);
    const pais = escapeHtml(d.pais);
    const aeroporto = escapeHtml(d.aeroporto);
    const estilosTags = (d.estilos || [])
        .map((e) => `<span class="dest-tag">${escapeHtml(capitalizeEstilo(e))}</span>`)
        .join('');
    const variacaoHtml = renderVariacaoInlineHtml(d.variacao);
    const datasHtml = renderDatasCardHtml(d);
    const labelPreco = escapada ? 'Ida e volta' : 'A partir de';
    const noites = d.duracao_ideal?.min ?? 0;
    const duracaoTexto = !d.duracao_ideal ? ''
        : escapada
            ? `<strong>${noites}</strong> noite${noites !== 1 ? 's' : ''}`
            : `<strong>${d.duracao_ideal.min}-${d.duracao_ideal.max}</strong> dias`;
    const duracaoIdeal = d.duracao_ideal?.ideal ?? '';
    const quedaDestaque = d.variacao?.direcao === 'desceu' && Math.abs(d.variacao.percentual) >= QUEDA_DESTAQUE_PCT
        ? `<span class="dest-badge-drop">&darr; ${Math.abs(d.variacao.percentual)}%</span>`
        : '';

    const tagAbre = href
        ? `<a class="dest-card" href="${escapeHtml(href)}" target="_blank" rel="noopener nofollow"`
        : '<article class="dest-card"';
    const tagFecha = href ? '</a>' : '</article>';

    return `
        ${tagAbre} data-aeroporto="${aeroporto}" data-nome="${nome}" data-duracao="${duracaoIdeal}" data-ida="${escapeHtml(d.data_ida || '')}" data-volta="${escapeHtml(d.data_volta || '')}">
            <div class="dest-card-inner">
                <div class="dest-image-wrapper">
                    <img class="dest-image" src="${imgSrc}" alt="${nome}" loading="lazy"
                         onerror="this.src='assets/images/tripinha/avatar-pensando.png'">
                    <span class="dest-rank">${d.posicao}</span>
                    ${quedaDestaque}
                    ${d.internacional ? '<span class="dest-badge-international">Internacional</span>' : ''}
                    ${escapada ? `<button class="dest-share-btn" data-share-nome="${nome}" title="Compartilhar ${nome}" aria-label="Compartilhar ${nome}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>` : ''}
                </div>
                <div class="dest-info">
                    <div class="dest-header">
                        <h3 class="dest-name">${nome}</h3>
                        <p class="dest-country">${pais}${d.paradas > 0 ? ` &middot; ${d.paradas} parada${d.paradas > 1 ? 's' : ''}` : ' &middot; Direto'}</p>
                    </div>
                    <div class="dest-tags">${estilosTags}</div>
                    ${datasHtml}
                    <div class="dest-footer">
                        <div class="dest-price-block">
                            <span class="dest-price-label">${labelPreco}</span>
                            <span class="dest-price">R$ ${fmt(d.preco)}</span>
                            ${variacaoHtml}
                        </div>
                        <div class="dest-duration">${duracaoTexto}</div>
                    </div>
                </div>
            </div>
        ${tagFecha}`;
}

export function renderStatsBarHtml(destinos) {
    if (!destinos || destinos.length === 0) return '';
    const maisBarato = destinos[0];
    const precos = destinos.filter((d) => d.preco > 0).map((d) => d.preco);
    const media = precos.length > 0 ? Math.round(precos.reduce((a, b) => a + b, 0) / precos.length) : 0;
    const nacionais = destinos.filter((d) => !d.internacional).length;
    const internacionais = destinos.filter((d) => d.internacional).length;
    const maiorQueda = maioresQuedas(destinos, 1)[0];

    const maiorQuedaHtml = maiorQueda ? `
        <div class="stat-card stat-card-drop">
            <div class="stat-label">Maior queda</div>
            <div class="stat-value stat-value-drop">&darr; ${Math.abs(maiorQueda.variacao.percentual)}%</div>
            <div class="stat-detail">${escapeHtml(maiorQueda.nome)} &middot; agora R$ ${fmt(maiorQueda.preco)}</div>
        </div>` : '';

    return `
        <div class="stat-card">
            <div class="stat-label">Mais barato</div>
            <div class="stat-value">R$ ${fmt(maisBarato.preco)}</div>
            <div class="stat-detail">${escapeHtml(maisBarato.nome)}</div>
            ${renderVariacaoStatHtml(maisBarato.variacao)}
        </div>${maiorQuedaHtml}
        <div class="stat-card">
            <div class="stat-label">Preço médio</div>
            <div class="stat-value">R$ ${fmt(media)}</div>
            <div class="stat-detail">${destinos.length} destinos</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Nacionais</div>
            <div class="stat-value">${nacionais}</div>
            <div class="stat-detail">destinos</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Internacionais</div>
            <div class="stat-value">${internacionais}</div>
            <div class="stat-detail">destinos</div>
        </div>`;
}

// ============================================================
// SEÇÃO "MAIORES QUEDAS" — destinos que mais baixaram de preço
// ============================================================
export function renderQuedasHtml(destinos) {
    const quedas = maioresQuedas(destinos, 5);
    if (quedas.length === 0) return '';

    const cards = quedas
        .map((d) => {
            const periodo = fmtPeriodo(d.data_ida, d.data_volta);
            return `
            <button class="queda-card" data-aeroporto="${escapeHtml(d.aeroporto)}" data-nome="${escapeHtml(d.nome)}" data-duracao="${d.duracao_ideal?.ideal ?? ''}" data-ida="${escapeHtml(d.data_ida || '')}" data-volta="${escapeHtml(d.data_volta || '')}">
                <span class="queda-badge">&darr; ${Math.abs(d.variacao.percentual)}%</span>
                <span class="queda-nome">${escapeHtml(d.nome)}</span>
                <span class="queda-precos"><s>R$ ${fmt(d.variacao.preco_anterior)}</s> <strong>R$ ${fmt(d.preco)}</strong></span>
                ${periodo ? `<span class="queda-datas">${escapeHtml(periodo).replace('→', '&rarr;')}</span>` : ''}
            </button>`;
        })
        .join('');

    return `
        <div class="quedas-header">
            <h2 class="quedas-title">&#128293; Maiores quedas de preço</h2>
            <span class="quedas-sub">comparado à média dos últimos dias</span>
        </div>
        <div class="quedas-row">${cards}</div>`;
}

// ============================================================
// "ESCOLHA DA TRIPINHA" — destaque editorial pré-gerado no cron
// ============================================================
export function renderTripinhaPickHtml(pick, destinos) {
    if (!pick || !pick.nome) return '';
    const dest = (destinos || []).find((d) => (d.nome || '').toLowerCase() === pick.nome.toLowerCase());
    if (!dest) return '';

    const periodo = fmtPeriodo(dest.data_ida, dest.data_volta);
    return `
        <div class="tripinha-pick-card" data-aeroporto="${escapeHtml(dest.aeroporto)}" data-nome="${escapeHtml(dest.nome)}" data-duracao="${dest.duracao_ideal?.ideal ?? ''}" data-ida="${escapeHtml(dest.data_ida || '')}" data-volta="${escapeHtml(dest.data_volta || '')}">
            <img src="/assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="pick-avatar" onerror="this.style.display='none'">
            <div class="pick-content">
                <span class="pick-label">&#128062; Escolha da Tripinha</span>
                <span class="pick-destino">${escapeHtml(dest.nome)} &middot; <strong>R$ ${fmt(dest.preco)}</strong>${periodo ? ` <span class="pick-datas">(${escapeHtml(periodo).replace('→', '&rarr;')})</span>` : ''}</span>
                ${pick.motivo ? `<span class="pick-motivo">${escapeHtml(pick.motivo)}</span>` : ''}
            </div>
            <span class="pick-arrow">&rarr;</span>
        </div>`;
}
