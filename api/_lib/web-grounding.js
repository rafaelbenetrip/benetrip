// api/_lib/web-grounding.js - BENETRIP ADAPTER DE BUSCA COM GROUNDING v1.0
//
// Camada de adapter sobre provedores de busca na web já configurados no
// projeto. Serve para SUSTENTAR afirmações factuais com fonte: sazonalidade de
// um destino, funcionamento de uma atração, condições de um período.
//
// DESLIGADO POR PADRÃO. Nenhuma busca acontece sem opt-in explícito em
// BENETRIP_GROUNDING_WEB (1, true, on ou sim).
//
// Provedor: SearchAPI.io com engine=google, a mesma credencial já usada nas
// buscas de voo. NÃO usamos token do Google aqui.
//
// A interface nunca fala direto com um fornecedor: consome sempre este módulo.
// Sem provedor habilitado, `buscarNaWeb` devolve lista vazia e quem chama
// OMITE a afirmação — nunca preenche a lacuna com o conhecimento do modelo.
//
// Com o grounding desligado, a Descoberta continua correta por outro caminho:
// api/_lib/seasonal-claims.js descarta, sem rede, qualquer frase que afirme
// fenômeno sazonal sem fonte.

import { comCache } from './external-cache.js';

const TTL_BUSCA_MS = 24 * 60 * 60 * 1000; // resultado de busca: 1 dia

// Opt-in explícito: buscar na web custa chamada por destino, então não pode
// ligar sozinho só porque a credencial de voos existe.
const VALORES_LIGADOS = new Set(['1', 'true', 'on', 'sim']);

export function groundingHabilitado(env = process.env) {
    return VALORES_LIGADOS.has(String(env.BENETRIP_GROUNDING_WEB ?? '').trim().toLowerCase());
}

export function groundingDisponivel(env = process.env) {
    return groundingHabilitado(env) && Boolean(env.SEARCHAPI_KEY);
}

export function provedoresDisponiveis(env = process.env) {
    return groundingDisponivel(env) ? ['searchapi_google'] : [];
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
        try {
            const resultados = await buscarSearchApi(termo, { idioma, limite });
            if (resultados.length > 0) return resultados;
        } catch (err) {
            console.warn(`[Grounding][searchapi_google] ${err.message}`);
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
