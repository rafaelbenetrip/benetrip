// api/_lib/places.js - BENETRIP ADAPTER DE LUGARES v1.0
//
// Resolve dinamicamente, em API global de lugares, os estabelecimentos que a
// IA sugere no Roteiro. A IA organiza a viagem; a EXISTÊNCIA e o funcionamento
// dos lugares precisam de validação externa.
//
// Não existe catálogo local de atrações ou restaurantes aqui: o resolvedor
// funciona para qualquer cidade do mundo, com cache técnico por consulta.
//
// Provedor: Google Places (GOOGLE_PLACES_API_KEY | GOOGLE_API_KEY), o mesmo já
// usado em api/image-search.js para pontos turísticos.
//
// Estados possíveis para um candidato:
//   verified            encontrado, com identificador e endereço
//   partially_verified  encontrado, mas faltam dados (sem endereço/coordenada)
//   not_verified        não encontrado, ou provedor indisponível
//
// Regra: candidato `not_verified` NUNCA é exibido como recomendação
// específica. Vira sugestão de categoria/região, sem nome de estabelecimento.

import { comCache } from './external-cache.js';

const TTL_LUGAR_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias

export const STATUS_LUGAR = {
    VERIFICADO: 'verified',
    PARCIAL: 'partially_verified',
    NAO_VERIFICADO: 'not_verified',
};

export const TEXTO_HORARIO_NAO_VERIFICADO = 'Horário não verificado, confirme antes de ir.';

function chaveApi() {
    return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || null;
}

export function placesDisponivel() {
    return Boolean(chaveApi());
}

function naoVerificado(nome, motivo) {
    return {
        status: STATUS_LUGAR.NAO_VERIFICADO,
        consulta: nome,
        nomeOficial: null,
        idExterno: null,
        endereco: null,
        coordenadas: null,
        categoria: null,
        statusFuncionamento: null,
        horarioDoDia: null,
        urlMapa: null,
        verificadoEm: new Date().toISOString(),
        motivo,
    };
}

// ============================================================
// RESOLUÇÃO DE UM CANDIDATO
// `nome` é o que a IA sugeriu; `cidade` dá o contexto geográfico.
// ============================================================
export async function resolverLugar({ nome, cidade = '', pais = '', diaDaSemana = null, idioma = 'pt-BR' }) {
    const consulta = String(nome || '').trim();
    if (!consulta) return naoVerificado(consulta, 'nome_vazio');
    const key = chaveApi();
    if (!key) return naoVerificado(consulta, 'provedor_indisponivel');

    const termo = [consulta, cidade, pais].filter(Boolean).join(', ');
    const cacheKey = `place|${idioma}|${termo.toLowerCase()}`;

    const base = await comCache(cacheKey, TTL_LUGAR_MS, async () => {
        try {
            const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
            url.searchParams.set('query', termo);
            url.searchParams.set('language', idioma);
            url.searchParams.set('key', key);

            const resp = await fetch(url.toString());
            if (!resp.ok) return naoVerificado(consulta, `http_${resp.status}`);
            const data = await resp.json();
            const lugar = (data.results || [])[0];
            if (!lugar) return naoVerificado(consulta, 'nao_encontrado');

            const temEndereco = Boolean(lugar.formatted_address);
            const temCoordenadas = Boolean(lugar.geometry?.location);

            return {
                status: temEndereco && temCoordenadas ? STATUS_LUGAR.VERIFICADO : STATUS_LUGAR.PARCIAL,
                consulta,
                nomeOficial: lugar.name || consulta,
                idExterno: lugar.place_id || null,
                endereco: lugar.formatted_address || null,
                coordenadas: temCoordenadas
                    ? { lat: lugar.geometry.location.lat, lng: lugar.geometry.location.lng }
                    : null,
                categoria: (lugar.types || [])[0] || null,
                // business_status vem do provedor; ausência NÃO vira "aberto"
                statusFuncionamento: lugar.business_status || null,
                // opening_hours.open_now é volátil e não vale para uma data
                // futura: só guardamos se o provedor mandou o horário semanal
                horarioSemanal: lugar.opening_hours?.weekday_text || null,
                urlMapa: lugar.place_id
                    ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(lugar.place_id)}`
                    : null,
                verificadoEm: new Date().toISOString(),
                fonte: 'Google Places',
            };
        } catch (err) {
            console.warn(`[Places] Falha ao resolver "${termo}": ${err.message}`);
            return naoVerificado(consulta, 'erro_rede');
        }
    });

    // Horário do dia da visita, quando o provedor forneceu o quadro semanal
    let horarioDoDia = null;
    if (base?.horarioSemanal && Number.isInteger(diaDaSemana)) {
        // weekday_text começa na segunda-feira no Places; Date.getDay() no domingo
        const indice = (diaDaSemana + 6) % 7;
        horarioDoDia = base.horarioSemanal[indice] || null;
    }

    return { ...base, horarioDoDia };
}

// ============================================================
// RESOLUÇÃO EM LOTE com limite de concorrência
// ============================================================
export async function resolverLugares(candidatos, { cidade = '', pais = '', concorrencia = 4, idioma = 'pt-BR' } = {}) {
    const lista = candidatos || [];
    const saida = new Array(lista.length);
    let cursor = 0;

    async function worker() {
        while (cursor < lista.length) {
            const i = cursor++;
            const c = lista[i];
            saida[i] = await resolverLugar({
                nome: typeof c === 'string' ? c : c?.nome,
                cidade,
                pais,
                diaDaSemana: typeof c === 'object' ? c?.diaDaSemana ?? null : null,
                idioma,
            });
        }
    }

    await Promise.all(
        Array.from({ length: Math.max(1, Math.min(concorrencia, lista.length)) }, () => worker())
    );
    return saida;
}

// ============================================================
// CANDIDATO ESPECULATIVO
//
// A auditoria pegou "Café do Forte, se acessível, ou um café similar". Texto
// assim já nasce sem compromisso com a existência do lugar: é descartado como
// nome específico antes mesmo de ir ao provedor.
// ============================================================
const PADROES_ESPECULATIVOS = [
    /\bse (acess[íi]vel|estiver aberto|houver|poss[íi]vel|dispon[íi]vel)\b/i,
    /\bou (um|uma|algum|alguma|outro|outra) .{0,30}(similar|parecid|equivalente|da regi[ãa]o)/i,
    /\b(algum|alguma|qualquer) (caf[ée]|restaurante|bar|lanchonete|loja|lugar|local)/i,
    /\b(por exemplo|tipo|como o|como a)\b.*\bou\b/i,
    /\(.*(similar|equivalente|caso esteja).*\)/i,
];

export function ehCandidatoEspeculativo(nome) {
    const t = String(nome || '');
    if (!t.trim()) return true;
    return PADROES_ESPECULATIVOS.some((re) => re.test(t));
}

// ============================================================
// SUBSTITUTO SEM ESTABELECIMENTO
// Quando não há lugar verificado, recomendamos categoria + região, sem
// inventar nome.
// ============================================================
export function sugestaoPorCategoria({ categoria = 'uma parada', regiao = '' }) {
    const onde = regiao ? ` na região ${regiao}` : ' na região';
    return `${categoria.charAt(0).toUpperCase()}${categoria.slice(1)}${onde}. Escolha uma opção aberta no momento.`;
}

// ============================================================
// COERÊNCIA DE ATRIBUTOS
//
// A auditoria encontrou locais marcados ao mesmo tempo como pagos e
// gratuitos. Aqui os atributos são reconciliados de forma determinística:
// na dúvida, o custo vira desconhecido em vez de escolher um dos dois.
// ============================================================
const SINAIS_PAGO = /\b(ingresso|entrada paga|taxa de entrada|R\$\s?\d|custa|pagar|bilhete)\b/i;
const SINAIS_GRATUITO = /\b(gratuit|de gra[çc]a|entrada franca|sem custo|livre acesso)\b/i;

export function reconciliarCusto(atividade) {
    const texto = `${atividade?.descricao || ''} ${(atividade?.tags || []).join(' ')} ${atividade?.custo || ''}`;
    const declaradoGratuito = atividade?.gratuito === true;
    const textoDizPago = SINAIS_PAGO.test(texto);
    const textoDizGratuito = SINAIS_GRATUITO.test(texto);

    // Contradição explícita: nem pago nem gratuito, custo desconhecido
    if ((declaradoGratuito || textoDizGratuito) && textoDizPago) {
        return { gratuito: null, rotulo: 'Custo não confirmado', conflito: true };
    }
    if (declaradoGratuito || textoDizGratuito) {
        return { gratuito: true, rotulo: 'Gratuito', conflito: false };
    }
    if (textoDizPago) {
        return { gratuito: false, rotulo: 'Pago', conflito: false };
    }
    return { gratuito: null, rotulo: 'Custo não confirmado', conflito: false };
}
