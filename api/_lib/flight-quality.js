// api/_lib/flight-quality.js - CAMADA DETERMINÍSTICA DE QUALIDADE DE VOO v1.0
// Score objetivo aplicado ANTES e DEPOIS do ranking por IA em rank-destinations.
// A IA pode explicar e desempatar, mas não pode violar os limites daqui:
//  - orçamento é TETO no FILTRO: nada acima dele entra, e nada é descartado
//    por ser barato (separarPorOrcamento);
//  - dentro do teto, o RANKING prefere quem aproveita melhor o orçamento:
//    quem informou um limite está dizendo o que aceita gastar (scoreVoo);
//  - família com crianças/bebês: penalização forte em 2+ escalas;
//  - viagem curta: penalização quando o voo consome parcela excessiva da viagem.
//
// Todas as funções são puras (sem rede/efeitos) para permitir testes unitários.

// ============================================================
// ORÇAMENTO COMO TETO
// Separa opções dentro do teto das opções acima, com diferença
// em valor absoluto e percentual. Nunca descarta por ser barato.
// ============================================================
export function separarPorOrcamento(destinos, orcamento) {
    const comPreco = (destinos || []).filter(d => (d?.flight?.price || 0) > 0);
    if (!orcamento || orcamento <= 0) {
        return { dentro: comPreco, acima: [] };
    }
    const dentro = [];
    const acima = [];
    for (const d of comPreco) {
        if (d.flight.price <= orcamento) {
            dentro.push(d);
        } else {
            acima.push({
                ...d,
                _acimaOrcamento: {
                    diferenca: Math.round(d.flight.price - orcamento),
                    percentual: Math.round(((d.flight.price - orcamento) / orcamento) * 100),
                },
            });
        }
    }
    // Acima do orçamento: as mais próximas do teto primeiro
    acima.sort((a, b) => a.flight.price - b.flight.price);
    return { dentro, acima };
}

// ============================================================
// SCORE DETERMINÍSTICO (0-100, maior = melhor)
// Considera preço, escalas, duração total, perfil dos passageiros
// e duração da viagem. Horário não entra porque o engine explore
// não retorna horários por destino.
// ============================================================
export function scoreVoo(destino, perfil = {}) {
    const flight = destino?.flight || {};
    const price = flight.price || 0;
    const stops = flight.stops || 0;
    const durMin = flight.flight_duration_minutes || 0;
    const {
        orcamento = 0,
        criancas = 0,
        bebes = 0,
        noites = 7,
    } = perfil;

    const temFamiliaPequena = (criancas || 0) > 0 || (bebes || 0) > 0;
    const viagemCurta = noites > 0 && noites <= 4;

    let score = 100;
    const penalidades = [];

    // --- Preço: quanto mais perto do teto, melhor (até 25 pts) ---
    //
    // Quem define R$ 5.000 de teto está dizendo o que aceita gastar, não
    // pedindo o mais barato possível. A versão anterior premiava a barateza
    // de forma monotônica, então uma opção pela metade do orçamento ganhava
    // ~13 pontos de vantagem só por custar menos, e o resultado vinha todo
    // da ponta barata — frustrando quem queria ver o que o próprio limite
    // compra. O teto continua sendo teto: acima dele nada entra, e isso é
    // decidido antes daqui, em separarPorOrcamento.
    if (orcamento > 0 && price > 0) {
        const razao = Math.min(price / orcamento, 1); // 0..1 dentro do teto
        const bonusPreco = Math.round(razao * 25);
        score += bonusPreco - 25; // preço no teto = 0; metade do teto ≈ -13
    }

    // --- Escalas ---
    if (stops === 1) {
        score -= temFamiliaPequena ? 12 : 6;
    } else if (stops >= 2) {
        // Família com crianças/bebês: penalização forte (regra obrigatória)
        score -= temFamiliaPequena ? 45 : 20;
        penalidades.push(temFamiliaPequena ? 'escalas_familia' : 'muitas_escalas');
    }

    // --- Duração total vs. tempo de viagem ---
    if (durMin > 0 && noites > 0) {
        const minutosViagem = noites * 24 * 60;
        // ida + volta consomem 2x a duração de um trecho
        const fracaoDeslocamento = (durMin * 2) / minutosViagem;
        if (fracaoDeslocamento > 0.25) {
            score -= 35;
            penalidades.push('voo_consome_viagem');
        } else if (fracaoDeslocamento > 0.15) {
            score -= 18;
            penalidades.push('voo_longo_para_duracao');
        } else if (fracaoDeslocamento > 0.08) {
            score -= 8;
        }
        // Viagem curta com voo longo em valor absoluto também pesa
        if (viagemCurta && durMin > 8 * 60) {
            score -= 15;
            if (!penalidades.includes('voo_consome_viagem')) penalidades.push('voo_longo_viagem_curta');
        }
    }

    // --- Duração absoluta muito alta com família ---
    if (temFamiliaPequena && durMin > 10 * 60) {
        score -= 15;
        penalidades.push('voo_longo_familia');
    }

    return {
        score: Math.max(0, Math.min(125, Math.round(score))),
        penalidades,
    };
}

// Anota cada destino com _quality = { score, penalidades } e devolve
// nova lista ordenada por score (desempate: preço).
export function ranquearPorQualidade(destinos, perfil = {}) {
    return (destinos || [])
        .map(d => ({ ...d, _quality: scoreVoo(d, perfil) }))
        .sort((a, b) =>
            (b._quality.score - a._quality.score) ||
            ((a.flight?.price || Infinity) - (b.flight?.price || Infinity))
        );
}

// ============================================================
// RESTRIÇÕES OBJETIVAS QUE A IA NÃO PODE VIOLAR
// Um destino "viola" quando tem 2+ escalas E existe alternativa
// com no máximo 1 escala e score igual ou superior no pool.
// Usado para validar o top_destino escolhido pela IA.
// ============================================================
export function violaRestricaoObjetiva(escolhido, pool, perfil = {}) {
    if (!escolhido) return false;
    const temFamiliaPequena = (perfil.criancas || 0) > 0 || (perfil.bebes || 0) > 0;
    if (!temFamiliaPequena) return false;

    const stops = escolhido.flight?.stops || 0;
    if (stops < 2) return false;

    // Existe opção com <= 1 escala e qualidade >= no pool?
    const qEscolhido = escolhido._quality || scoreVoo(escolhido, perfil);
    return (pool || []).some(d => {
        if (d === escolhido) return false;
        const s = d.flight?.stops || 0;
        if (s >= 2) return false;
        const q = d._quality || scoreVoo(d, perfil);
        return q.score >= qEscolhido.score;
    });
}

// ============================================================
// TEXTOS DE TRANSPARÊNCIA (sem rede)
// ============================================================
export function descreverPenalidades(quality) {
    const map = {
        escalas_familia: 'Voo com 2 ou mais escalas, cansativo para quem viaja com crianças',
        muitas_escalas: 'Voo com 2 ou mais escalas',
        voo_consome_viagem: 'O deslocamento consome uma parte grande da viagem',
        voo_longo_para_duracao: 'Voo relativamente longo para a duração da viagem',
        voo_longo_viagem_curta: 'Voo longo para uma viagem curta',
        voo_longo_familia: 'Voo longo para quem viaja com crianças',
    };
    return (quality?.penalidades || []).map(p => map[p]).filter(Boolean);
}
