// api/_lib/places.js - BENETRIP ADAPTER DE LUGARES v1.0
//
// Resolve dinamicamente, em API global de lugares, os estabelecimentos que a
// IA sugere no Roteiro. A IA organiza a viagem; a EXISTÊNCIA e o funcionamento
// dos lugares precisam de validação externa.
//
// Não existe catálogo local de atrações ou restaurantes aqui: o resolvedor
// funciona para qualquer cidade do mundo, com cache técnico por consulta.
//
// DESLIGADO POR PADRÃO. Sem opt-in em ROTEIRO_VALIDAR_LUGARES, nenhuma
// chamada externa acontece e todo candidato fica `not_verified` — o que já
// produz o comportamento correto: sugestão por categoria e região, sem nome
// de estabelecimento inventado.
//
// Provedor: SearchAPI.io com engine=google_maps, a mesma credencial das
// buscas de voo. NÃO usamos token do Google aqui.
//
// A parte que mais importa desta camada NÃO depende de rede:
// ehCandidatoEspeculativo() e reconciliarCusto() são determinísticos e
// continuam valendo com o provedor desligado. É o filtro determinístico que
// mata "Café do Forte, se acessível, ou um café similar", o exemplo da
// auditoria.
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

// Opt-in explícito: uma chamada por atividade do roteiro é custo real.
const VALORES_LIGADOS = new Set(['1', 'true', 'on', 'sim']);

export function placesHabilitado(env = process.env) {
    return VALORES_LIGADOS.has(String(env.ROTEIRO_VALIDAR_LUGARES ?? '').trim().toLowerCase());
}

export function placesDisponivel(env = process.env) {
    return placesHabilitado(env) && Boolean(env.SEARCHAPI_KEY);
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
    if (!placesDisponivel()) return naoVerificado(consulta, 'provedor_indisponivel');

    const termo = [consulta, cidade, pais].filter(Boolean).join(', ');
    const cacheKey = `place|${idioma}|${termo.toLowerCase()}`;

    const base = await comCache(cacheKey, TTL_LUGAR_MS, async () => {
        try {
            const url = new URL('https://www.searchapi.io/api/v1/search');
            url.searchParams.set('engine', 'google_maps');
            url.searchParams.set('api_key', process.env.SEARCHAPI_KEY);
            url.searchParams.set('q', termo);
            url.searchParams.set('hl', idioma);

            const resp = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
            if (!resp.ok) return naoVerificado(consulta, `http_${resp.status}`);
            const data = await resp.json();
            const lugar = (data.local_results || [])[0];
            if (!lugar) return naoVerificado(consulta, 'nao_encontrado');

            const endereco = lugar.address || null;
            const coords = (lugar.gps_coordinates && lugar.gps_coordinates.latitude != null)
                ? { lat: lugar.gps_coordinates.latitude, lng: lugar.gps_coordinates.longitude }
                : null;

            return {
                status: endereco && coords ? STATUS_LUGAR.VERIFICADO : STATUS_LUGAR.PARCIAL,
                consulta,
                nomeOficial: lugar.title || consulta,
                idExterno: lugar.place_id || lugar.data_id || null,
                endereco,
                coordenadas: coords,
                categoria: lugar.type || (lugar.types || [])[0] || null,
                // Ausência de status NÃO vira "aberto"
                statusFuncionamento: lugar.business_status || null,
                // Só guardamos o quadro semanal quando o provedor o envia
                horarioSemanal: Array.isArray(lugar.operating_hours)
                    ? lugar.operating_hours
                    : (lugar.hours || null),
                urlMapa: lugar.place_id
                    ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(lugar.place_id)}`
                    : null,
                verificadoEm: new Date().toISOString(),
                fonte: 'SearchAPI Maps',
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
