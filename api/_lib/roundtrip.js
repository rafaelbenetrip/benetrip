// api/_lib/roundtrip.js - ANÁLISE DE ITINERÁRIO IDA E VOLTA v1.0
//
// O engine google_flights, numa busca round_trip, devolve o preço da tarifa
// de IDA E VOLTA, mas os trechos listados costumam ser só os da IDA — a volta
// é escolhida depois, no Google Flights. Exibir isso como "itinerário
// completo" leva o usuário a achar que já tem horário de retorno definido.
//
// Esta função olha os trechos REAIS devolvidos e decide o que a interface
// pode afirmar. Nada é presumido: se a volta vier, ela é exibida.

// `origem` e `destino` aceitam código IATA ou lista de códigos (cidade
// agregada, ex.: ['GRU','CGH','VCP']).
//
// Sem saber qual é o aeroporto de destino não há como distinguir uma escala
// de um retorno usando apenas a sequência de trechos (GRU→BSB→SSA→REC→GRU
// tem BSB como escala e SSA como destino, mas ambos aparecem como
// "chegada seguida de partida"). Nesse caso a resposta é conservadora:
// não afirmamos que o itinerário está completo.
export function analisarItinerario(legs, { origem, destino } = {}) {
    const trechos = Array.isArray(legs) ? legs.filter(Boolean) : [];
    if (trechos.length === 0) {
        return { completo: false, ida: [], volta: [], motivo: 'sem_trechos', origem: null, destino: null };
    }

    const codigo = (v) => String(v || '').toUpperCase();
    const lista = (v) => (Array.isArray(v) ? v : [v]).map(codigo).filter(Boolean);
    const partida = (l) => codigo(l.departure_airport?.id ?? l.departure_airport ?? l.from);
    const chegada = (l) => codigo(l.arrival_airport?.id ?? l.arrival_airport ?? l.to);

    const origensAceitas = lista(origem);
    const destinosAceitos = lista(destino);
    const origemReal = origensAceitas.includes(partida(trechos[0]))
        ? partida(trechos[0])
        : (origensAceitas[0] || partida(trechos[0]));

    // Destino desconhecido: informa a ida e não afirma nada sobre a volta
    if (destinosAceitos.length === 0) {
        return {
            completo: false,
            ida: trechos,
            volta: [],
            motivo: 'destino_desconhecido',
            origem: origemReal,
            destino: chegada(trechos[trechos.length - 1]),
        };
    }

    const ida = [];
    const volta = [];
    let chegouAoDestino = false;
    let destinoReal = null;

    for (const leg of trechos) {
        if (!chegouAoDestino) {
            ida.push(leg);
            if (destinosAceitos.includes(chegada(leg))) {
                chegouAoDestino = true;
                destinoReal = chegada(leg);
            }
            continue;
        }
        volta.push(leg);
    }

    // Só é itinerário completo se a volta existir e terminar na origem
    const ultimoDaVolta = volta[volta.length - 1];
    const voltaTerminaNaOrigem = Boolean(ultimoDaVolta)
        && (chegada(ultimoDaVolta) === origemReal || origensAceitas.includes(chegada(ultimoDaVolta)));
    const completo = volta.length > 0 && voltaTerminaNaOrigem;

    return {
        completo,
        ida,
        volta,
        motivo: completo ? null : volta.length > 0 ? 'volta_incompleta' : 'volta_ausente',
        origem: origemReal,
        destino: destinoReal || chegada(trechos[trechos.length - 1]),
    };
}

// Textos exibidos quando a volta não vem do fornecedor. A auditoria pediu
// exatamente esta linguagem, para não vender o resultado como itinerário
// fechado.
export const TEXTOS_TARIFA_PARCIAL = {
    rotulo: 'Melhor tarifa inicial para esta combinação',
    explicacao: 'Escolha o voo de volta no Google Flights. A tarifa final pode variar conforme o retorno escolhido.',
    cta: 'Ver esta combinação no Google Flights',
};

export const TEXTOS_ITINERARIO_COMPLETO = {
    rotulo: 'Ida e volta com horários definidos',
    explicacao: 'Confirme disponibilidade antes de comprar.',
    cta: 'Ver esta combinação no Google Flights',
};

// ============================================================
// DIFERENÇA ENTRE COMBINAÇÕES
// Evita comemorar economia quando a diferença é irrelevante.
// ============================================================
export const DIFERENCA_RELEVANTE_PCT = 10;
export const DIFERENCA_RELEVANTE_MIN = 50; // em unidades da moeda, por pessoa

export function avaliarDiferenca({ maisBarato, maisCaro, paxParaPreco = 1 }) {
    if (!maisBarato || !maisCaro || maisBarato <= 0) {
        return { relevante: false, diferencaPorPessoa: 0, percentual: 0 };
    }
    const pax = Math.max(1, paxParaPreco);
    const diferenca = maisCaro - maisBarato;
    const diferencaPorPessoa = Math.round(diferenca / pax);
    const percentual = Math.round((diferenca / maisCaro) * 100);
    const relevante = percentual >= DIFERENCA_RELEVANTE_PCT && diferencaPorPessoa >= DIFERENCA_RELEVANTE_MIN;
    return { relevante, diferencaPorPessoa, percentual };
}
