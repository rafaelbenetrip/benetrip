// api/_lib/quote-completeness.js - BENETRIP QUOTE COMPLETENESS v1.0
//
// O Comparar Voos toma uma decisão financeira: "estas datas custam menos que
// aquelas". Para poder afirmar isso é preciso que as células comparadas
// representem a MESMA coisa — o preço fechado de uma viagem de ida e volta.
//
// O engine google_flights, numa busca round_trip, devolve o preço da tarifa de
// ida e volta mas normalmente só os TRECHOS DA IDA: a volta é escolhida depois.
// Nesse estado o número é uma tarifa inicial (price insight), não uma proposta
// reservável — quatro datas de volta diferentes podem devolver exatamente o
// mesmo preço porque nenhuma delas foi realmente precificada.
//
// Este módulo classifica cada tarifa e decide o que a interface pode afirmar.
// Nada aqui inventa dado: na ausência de evidência o veredito é "não dá para
// comparar", nunca "provavelmente é igual".

// ============================================================
// TIPOS DE TARIFA
// ============================================================
export const QUOTE_TYPE = {
    // Ida e volta com os dois trechos definidos e proposta reservável
    BOOKABLE: 'bookable_round_trip',
    // Preço anunciado como ida e volta, mas sem o trecho de volta definido
    INDICATIVE: 'indicative_round_trip',
    // Só o trecho de ida foi pesquisado/devolvido
    OUTBOUND_ONLY: 'outbound_only',
    // Sem dados suficientes para dizer o que o preço representa
    UNKNOWN: 'unknown',
};

// Estado visual de cada célula da matriz
export const CELL_STATE = {
    COMPLETA: 'tarifa_completa',
    INDICATIVA: 'tarifa_indicativa',
    INSUFICIENTE: 'informacao_insuficiente',
    SEM_RESULTADO: 'sem_resultado',
};

export const TEXTOS_COMPLETUDE = {
    [QUOTE_TYPE.BOOKABLE]: {
        rotulo: 'Ida e volta com horários definidos',
        curto: 'Tarifa completa',
        explicacao: 'Preço de ida e volta com os dois trechos definidos. Confirme a disponibilidade antes de comprar.',
    },
    [QUOTE_TYPE.INDICATIVE]: {
        rotulo: 'Tarifa inicial encontrada',
        curto: 'Valor indicativo',
        explicacao: 'Valor indicativo para estas datas. A tarifa final depende do voo de volta escolhido.',
    },
    [QUOTE_TYPE.OUTBOUND_ONLY]: {
        rotulo: 'Somente o trecho de ida',
        curto: 'Só ida',
        explicacao: 'O preço encontrado cobre apenas o trecho de ida.',
    },
    [QUOTE_TYPE.UNKNOWN]: {
        rotulo: 'Informação insuficiente',
        curto: 'Sem dados suficientes',
        explicacao: 'Não recebemos dados suficientes para dizer o que este preço representa.',
    },
};

export const CTA_GOOGLE_FLIGHTS = 'Ver datas no Google Flights';

// ============================================================
// COMPLETUDE DE UMA TARIFA
//
// voo: objeto já normalizado por extractFlightDetails (compare-flights) ou
// equivalente. Espera-se:
//   itinerario_completo  -> volta veio do fornecedor e fecha na origem
//   trechos_ida / trechos_volta
//   booking_token        -> a proposta pode ser levada ao checkout
//   type                 -> 'round_trip' | 'one_way' (o que foi pesquisado)
// ============================================================
export function avaliarCompletudeTarifa(voo, { buscaIdaEVolta = true, verificadoEm = null } = {}) {
    const trechosIda = Number(voo?.trechos_ida ?? (voo?.legs?.length ? 1 : 0)) || 0;
    const trechosVolta = Number(voo?.trechos_volta ?? 0) || 0;
    const hasOutboundItinerary = trechosIda > 0;
    const hasReturnItinerary = voo?.itinerario_completo === true && trechosVolta > 0;
    // Só chamamos de reservável quando existe token de reserva E o itinerário
    // dos dois trechos: token sem volta ainda leva a uma nova escolha.
    const hasBookableProposal = Boolean(voo?.booking_token) && hasReturnItinerary;
    const priceIncludesReturn = hasReturnItinerary;

    let quoteType = QUOTE_TYPE.UNKNOWN;
    if (!hasOutboundItinerary) {
        quoteType = QUOTE_TYPE.UNKNOWN;
    } else if (!buscaIdaEVolta) {
        quoteType = QUOTE_TYPE.OUTBOUND_ONLY;
    } else if (hasReturnItinerary) {
        quoteType = QUOTE_TYPE.BOOKABLE;
    } else {
        quoteType = QUOTE_TYPE.INDICATIVE;
    }

    return {
        quoteType,
        hasOutboundItinerary,
        hasReturnItinerary,
        hasBookableProposal,
        priceIncludesReturn,
        priceVerifiedAt: verificadoEm || new Date().toISOString(),
    };
}

// ============================================================
// COMPLETUDE DE UMA COMBINAÇÃO (célula da matriz)
// A completude da célula é a da tarifa cujo PREÇO é exibido (a mais barata).
// ============================================================
export function avaliarCompletudeCombinacao(combinacao, opts = {}) {
    const voos = Array.isArray(combinacao?.voos) ? combinacao.voos : [];
    if (combinacao?.error || voos.length === 0 || combinacao?.melhorPreco == null) {
        return {
            estado: CELL_STATE.SEM_RESULTADO,
            quoteType: QUOTE_TYPE.UNKNOWN,
            hasOutboundItinerary: false,
            hasReturnItinerary: false,
            hasBookableProposal: false,
            priceIncludesReturn: false,
            priceVerifiedAt: null,
            voosComVolta: 0,
            voosTotal: voos.length,
        };
    }

    const representativo = voos.reduce(
        (menor, v) => (menor == null || (v.price || Infinity) < (menor.price || Infinity) ? v : menor),
        null
    );
    const completude = avaliarCompletudeTarifa(representativo, opts);
    const voosComVolta = voos.filter((v) => v.itinerario_completo === true).length;

    let estado = CELL_STATE.INSUFICIENTE;
    if (completude.quoteType === QUOTE_TYPE.BOOKABLE) estado = CELL_STATE.COMPLETA;
    else if (completude.quoteType === QUOTE_TYPE.INDICATIVE) estado = CELL_STATE.INDICATIVA;

    return { ...completude, estado, voosComVolta, voosTotal: voos.length };
}

// ============================================================
// A MATRIZ PODE ELEGER UM VENCEDOR?
//
// Condições cumulativas:
//   1. pelo menos 2 células com preço;
//   2. TODAS as células com preço são tarifas completas (bookable);
//   3. os preços não são todos iguais (empate geral = sem evidência de
//      diferença; foi exatamente o cenário observado na auditoria).
// ============================================================
export function avaliarComparabilidade(celulas) {
    const comPreco = (celulas || []).filter((c) => c && c.preco != null && c.preco > 0);

    if (comPreco.length === 0) {
        return { comparavel: false, motivo: 'sem_precos', mensagem: 'Nenhuma combinação retornou preço.', celulasComparaveis: 0 };
    }
    if (comPreco.length < 2) {
        return {
            comparavel: false,
            motivo: 'combinacao_unica',
            mensagem: 'Só uma combinação retornou preço, não há comparação possível.',
            celulasComparaveis: comPreco.length,
        };
    }

    const incompletas = comPreco.filter((c) => c.quoteType !== QUOTE_TYPE.BOOKABLE);
    if (incompletas.length > 0) {
        return {
            comparavel: false,
            motivo: 'tarifa_incompleta',
            mensagem: 'A tarifa final depende do voo de volta escolhido. Os valores abaixo são indicativos para estas datas.',
            celulasComparaveis: comPreco.length - incompletas.length,
        };
    }

    const precos = comPreco.map((c) => Math.round(c.preco));
    const todosIguais = precos.every((p) => p === precos[0]);
    if (todosIguais) {
        return {
            comparavel: false,
            motivo: 'precos_iguais',
            mensagem: 'Não encontramos diferença de preço confiável entre estas combinações.',
            celulasComparaveis: comPreco.length,
        };
    }

    return { comparavel: true, motivo: null, mensagem: null, celulasComparaveis: comPreco.length };
}

// ============================================================
// BEBÊS
// Não existe "bebê grátis" universal: a política é da companhia e do mercado.
// Quando o fornecedor precifica o bebê, o valor entra no total; quando não,
// dizemos que taxas e impostos serão confirmados na reserva.
// ============================================================
export function descreverBebes({ bebes = 0, precoInclui = false } = {}) {
    const n = Math.max(0, parseInt(bebes, 10) || 0);
    if (n === 0) return null;
    const plural = n > 1 ? 's' : '';
    if (precoInclui) {
        return {
            incluido: true,
            resumo: `${n} bebê${plural} de colo incluído${plural} no preço`,
            aviso: 'O valor já considera o bebê de colo conforme a tarifa do fornecedor.',
        };
    }
    return {
        incluido: false,
        resumo: `${n} bebê${plural} de colo`,
        aviso: `Não recebemos o preço do bebê de colo nesta busca. Possíveis tarifas e impostos serão confirmados na reserva.`,
    };
}
