// api/_lib/web-grounding.js - BENETRIP ADAPTER DE BUSCA COM GROUNDING v1.0
//
// Camada de adapter sobre provedores de busca na web já configurados no
// projeto. Serve para SUSTENTAR afirmações factuais com fonte: sazonalidade de
// um destino, funcionamento de uma atração, condições de um período.
//
// Provedores, nesta ordem:
//   1. Google Custom Search  (GOOGLE_API_KEY + GOOGLE_SEARCH_ENGINE_ID)
//   2. SearchAPI.io engine=google (SEARCHAPI_KEY) — já usado nas buscas de voo
//
// A interface nunca fala direto com um fornecedor: consome sempre este módulo.
// Sem provedor configurado, `buscarNaWeb` devolve lista vazia e quem chama
// OMITE a afirmação — nunca preenche a lacuna com o conhecimento do modelo.

import { comCache } from './external-cache.js';

const TTL_BUSCA_MS = 24 * 60 * 60 * 1000; // resultado de busca: 1 dia

export function groundingDisponivel() {
    return Boolean(
        (process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID)
        || process.env.SEARCHAPI_KEY
    );
}

export function provedoresDisponiveis() {
    const lista = [];
    if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) lista.push('google_custom_search');
    if (process.env.SEARCHAPI_KEY) lista.push('searchapi_google');
    return lista;
}

// ============================================================
// RESULTADO NORMALIZADO
// { titulo, trecho, url, dominio, provedor }
// ============================================================
function normalizar(item, provedor) {
    const url = item.url || item.link || '';
    let dominio = '';
    try { dominio = new URL(url).hostname.replace(/^www\./, ''); } catch { /* url inválida */ }
    return {
        titulo: String(item.titulo || item.title || '').slice(0, 300),
        trecho: String(item.trecho || item.snippet || '').slice(0, 800),
        url,
        dominio,
        provedor,
    };
}

async function buscarGoogleCustomSearch(consulta, { idioma, limite }) {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', process.env.GOOGLE_API_KEY);
    url.searchParams.set('cx', process.env.GOOGLE_SEARCH_ENGINE_ID);
    url.searchParams.set('q', consulta);
    url.searchParams.set('num', String(Math.min(limite, 10)));
    if (idioma) url.searchParams.set('hl', idioma);

    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`Google Custom Search respondeu ${resp.status}`);
    const data = await resp.json();
    return (data.items || []).map((i) => normalizar(i, 'google_custom_search'));
}

async function buscarSearchApi(consulta, { idioma, limite }) {
    const url = new URL('https://www.searchapi.io/api/v1/search');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('api_key', process.env.SEARCHAPI_KEY);
    url.searchParams.set('q', consulta);
    url.searchParams.set('num', String(Math.min(limite, 10)));
    if (idioma) url.searchParams.set('hl', idioma);

    const resp = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`SearchAPI respondeu ${resp.status}`);
    const data = await resp.json();
    return (data.organic_results || []).map((i) => normalizar(i, 'searchapi_google'));
}

// ============================================================
// BUSCA
// Tenta os provedores em ordem; o primeiro que responder ganha.
// Nunca lança: falha vira lista vazia (a decisão de omitir é de quem chama).
// ============================================================
export async function buscarNaWeb(consulta, { idioma = 'pt-BR', limite = 5 } = {}) {
    const termo = String(consulta || '').trim();
    if (!termo || !groundingDisponivel()) return [];

    return comCache(`web|${idioma}|${limite}|${termo.toLowerCase()}`, TTL_BUSCA_MS, async () => {
        for (const provedor of provedoresDisponiveis()) {
            try {
                const fn = provedor === 'google_custom_search' ? buscarGoogleCustomSearch : buscarSearchApi;
                const resultados = await fn(termo, { idioma, limite });
                if (resultados.length > 0) return resultados;
            } catch (err) {
                console.warn(`[Grounding][${provedor}] ${err.message}`);
            }
        }
        return [];
    });
}

// ============================================================
// PRIORIDADE DE FONTES
// Fontes oficiais e reconhecidas primeiro. A lista é de TIPO de domínio
// (governo, órgão de turismo, parque nacional), não de destino: não é um
// catálogo curado, é uma heurística de credibilidade que vale para qualquer
// país.
// ============================================================
const PADROES_OFICIAIS = [
    /(^|\.)gov(\.[a-z]{2})?$/i,     // gov.br, gov.uk, .gov
    /(^|\.)gob(\.[a-z]{2})?$/i,     // países hispanofalantes
    /(^|\.)gouv\.[a-z]{2}$/i,       // França
    /(^|\.)go\.[a-z]{2}$/i,         // Japão, Quênia, etc.
    /(^|\.)edu(\.[a-z]{2})?$/i,
    /^(www\.)?icmbio\./i,
    /(^|\.)un\.org$/i,
    /(^|\.)unesco\.org$/i,
    /(^|\.)noaa\.gov$/i,
    /(^|\.)metoffice\.gov\.uk$/i,
    /(^|\.)inmet\.gov\.br$/i,
];

const PADROES_TURISMO_OFICIAL = [
    /turismo/i, /tourism/i, /visit[a-z]*\./i, /embratur/i, /setur/i,
];

export function credibilidadeDaFonte(dominio) {
    const d = String(dominio || '').toLowerCase();
    if (!d) return 0;
    if (PADROES_OFICIAIS.some((re) => re.test(d))) return 3;
    if (PADROES_TURISMO_OFICIAL.some((re) => re.test(d))) return 2;
    return 1;
}

export function ordenarPorCredibilidade(resultados) {
    return [...(resultados || [])].sort(
        (a, b) => credibilidadeDaFonte(b.dominio) - credibilidadeDaFonte(a.dominio)
    );
}
