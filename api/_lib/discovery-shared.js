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

export function calcularVariacoes(destinosHoje, destinosOntem) {
    if (!destinosOntem || destinosOntem.length === 0) {
        return destinosHoje.map((d) => ({ ...d, variacao: null }));
    }

    const precoOntemMap = new Map();
    for (const d of destinosOntem) {
        const key = `${(d.nome || '').toLowerCase()}_${(d.pais || '').toLowerCase()}`;
        precoOntemMap.set(key, d.preco);
    }

    return destinosHoje.map((d) => {
        const key = `${(d.nome || '').toLowerCase()}_${(d.pais || '').toLowerCase()}`;
        const precoOntem = precoOntemMap.get(key);

        let variacao = null;
        if (precoOntem && d.preco) {
            const diff = d.preco - precoOntem;
            const percentual = ((diff / precoOntem) * 100).toFixed(1);
            variacao = {
                preco_anterior: precoOntem,
                diferenca: diff,
                percentual: parseFloat(percentual),
                direcao: diff > 0 ? 'subiu' : diff < 0 ? 'desceu' : 'estavel',
            };
        }

        return { ...d, variacao };
    });
}

// Busca o snapshot mais recente de uma origem, já com variação vs. ontem calculada.
// Retorna null se não houver snapshot (cidade ainda sem dados, não é erro).
// Lança exceção se a consulta ao Supabase falhar (sem fallback silencioso).
export async function fetchSnapshotComVariacao(origem, tipo = TIPO_PADRAO) {
    const snapshot = await fetchSnapshot(origem, tipo);
    if (!snapshot) return null;

    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().split('T')[0];
    const snapshotOntem = await fetchSnapshot(origem, tipo, ontemStr);

    const destinos = calcularVariacoes(snapshot.destinos || [], snapshotOntem?.destinos || []);
    return { ...snapshot, destinos };
}

// ============================================================
// FORMATAÇÃO / ESCAPE
// ============================================================
export function fmt(valor) {
    if (!valor) return '0';
    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
// RENDER HTML (server-side, espelha discovery-page.js no client)
// ============================================================
export function renderVariacaoStatHtml(v) {
    if (!v) return '';
    if (v.direcao === 'desceu') return `<div class="stat-variation down">&darr; ${Math.abs(v.percentual)}% vs ontem</div>`;
    if (v.direcao === 'subiu') return `<div class="stat-variation up">&uarr; ${Math.abs(v.percentual)}% vs ontem</div>`;
    return `<div class="stat-variation stable">&rarr; Estável</div>`;
}

export function renderVariacaoInlineHtml(v) {
    if (!v) return '';
    if (v.direcao === 'desceu') return `<span class="dest-price-variation down">&darr; R$ ${Math.abs(v.diferenca)} vs ontem</span>`;
    if (v.direcao === 'subiu') return `<span class="dest-price-variation up">&uarr; R$ ${Math.abs(v.diferenca)} vs ontem</span>`;
    return '';
}

export function renderCardHtml(d) {
    const imgSrc = d.imagem ? escapeHtml(d.imagem) : 'assets/images/tripinha/avatar-pensando.png';
    const nome = escapeHtml(d.nome);
    const pais = escapeHtml(d.pais);
    const aeroporto = escapeHtml(d.aeroporto);
    const estilosTags = (d.estilos || [])
        .map((e) => `<span class="dest-tag">${escapeHtml(capitalizeEstilo(e))}</span>`)
        .join('');
    const variacaoHtml = renderVariacaoInlineHtml(d.variacao);
    const duracaoTexto = d.duracao_ideal ? `<strong>${d.duracao_ideal.min}-${d.duracao_ideal.max}</strong> dias` : '';
    const duracaoIdeal = d.duracao_ideal?.ideal ?? '';

    return `
        <article class="dest-card" data-aeroporto="${aeroporto}" data-nome="${nome}" data-duracao="${duracaoIdeal}">
            <div class="dest-card-inner">
                <div class="dest-image-wrapper">
                    <img class="dest-image" src="${imgSrc}" alt="${nome}" loading="lazy"
                         onerror="this.src='assets/images/tripinha/avatar-pensando.png'">
                    <span class="dest-rank">${d.posicao}</span>
                    ${d.internacional ? '<span class="dest-badge-international">Internacional</span>' : ''}
                </div>
                <div class="dest-info">
                    <div class="dest-header">
                        <h3 class="dest-name">${nome}</h3>
                        <p class="dest-country">${pais}${d.paradas > 0 ? ` &middot; ${d.paradas} parada${d.paradas > 1 ? 's' : ''}` : ' &middot; Direto'}</p>
                    </div>
                    <div class="dest-tags">${estilosTags}</div>
                    <div class="dest-footer">
                        <div class="dest-price-block">
                            <span class="dest-price-label">A partir de</span>
                            <span class="dest-price">R$ ${fmt(d.preco)}</span>
                            ${variacaoHtml}
                        </div>
                        <div class="dest-duration">${duracaoTexto}</div>
                    </div>
                </div>
            </div>
        </article>`;
}

export function renderStatsBarHtml(destinos) {
    if (!destinos || destinos.length === 0) return '';
    const maisBarato = destinos[0];
    const precos = destinos.filter((d) => d.preco > 0).map((d) => d.preco);
    const media = precos.length > 0 ? Math.round(precos.reduce((a, b) => a + b, 0) / precos.length) : 0;
    const nacionais = destinos.filter((d) => !d.internacional).length;
    const internacionais = destinos.filter((d) => d.internacional).length;

    return `
        <div class="stat-card">
            <div class="stat-label">Mais barato</div>
            <div class="stat-value">R$ ${fmt(maisBarato.preco)}</div>
            <div class="stat-detail">${escapeHtml(maisBarato.nome)}</div>
            ${renderVariacaoStatHtml(maisBarato.variacao)}
        </div>
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
