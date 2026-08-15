// api/_lib/flight-quality.js - CAMADA DETERMINÍSTICA DE QUALIDADE DE VOO v1.0
// Score objetivo aplicado ANTES e DEPOIS do ranking por IA em rank-destinations.
// A IA pode explicar e desempatar, mas não pode violar os limites daqui:
//  - orçamento é TETO no FILTRO: nada acima dele entra, e nada é descartado
//    por ser barato (separarPorOrcamento);
//  - família com crianças/bebês: penalização forte em 2+ escalas;
//  - viagem curta: penalização quando o voo consome parcela excessiva da viagem.
//
// ORDEM DO RANKING: orçamento primeiro, logística depois.
//
// O preço não é mais um peso somado ao score, disputando pontos com escalas e
// duração — calibrar isso viraria um cabo de guerra entre números arbitrários.
// A ordenação é lexicográfica e explícita:
//
//   1º  faixa de aproveitamento do orçamento (bandas de 10% do teto)
//   2º  score de logística (escalas, duração, perfil dos passageiros)
//   3º  desempate: preço mais próximo do teto
//
// Consequência aceita e desejada: um voo com escalas que use melhor o
// orçamento fica à frente de um voo direto bem mais barato. Dentro da MESMA
// faixa de orçamento, quem decide é a logística.
//
// A exceção continua sendo família com crianças/bebês, onde
// violaRestricaoObjetiva garante voo com no máximo 1 escala como MELHOR
// DESTINO sempre que existir opção equivalente.
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
// FAIXA DE APROVEITAMENTO DO ORÇAMENTO
//
// Bandas de 10% do teto: 9 = usa de 90% a 100% do orçamento, 0 = usa
// menos de 10%. É o primeiro critério de ordenação.
//
// A banda evita que centavos decidam a ordem: entre R$ 4.500 e R$ 4.900
// num teto de R$ 5.000, ambos na faixa 9, quem decide é a logística.
//
// Sem orçamento informado devolve null, e a ordenação cai direto na
// logística.
// ============================================================
export const BANDAS_ORCAMENTO = 10;

export function faixaOrcamento(price, orcamento) {
    if (!orcamento || orcamento <= 0 || !price || price <= 0) return null;
    const razao = Math.min(price / orcamento, 1);
    return Math.min(BANDAS_ORCAMENTO - 1, Math.floor(razao * BANDAS_ORCAMENTO));
}

// ============================================================
// SCORE DE LOGÍSTICA (0-100, maior = melhor)
// Escalas, duração total, perfil dos passageiros e duração da viagem.
// Horário não entra porque o engine explore não retorna horários por
// destino. Preço NÃO entra: ele ordena antes, pela faixa de orçamento.
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

    const faixa = faixaOrcamento(price, orcamento);

    return {
        score: Math.max(0, Math.min(125, Math.round(score))),
        penalidades,
        faixaOrcamento: faixa,
        // 0..1: quanto do teto a passagem consome. Serve ao texto do card
        // e ao prompt; a ordenação usa a faixa, não este número.
        aproveitamento: orcamento > 0 && price > 0
            ? Math.min(1, price / orcamento)
            : null,
    };
}

// Anota cada destino com _quality e devolve nova lista ordenada.
//
// Orçamento primeiro: a faixa de aproveitamento manda, e só dentro da
// mesma faixa a logística decide. Um voo com escalas numa faixa superior
// fica à frente de um voo direto bem mais barato — comportamento
// pretendido, não efeito colateral.
export function ranquearPorQualidade(destinos, perfil = {}) {
    const orcamento = perfil.orcamento || 0;
    return (destinos || [])
        .map(d => ({ ...d, _quality: scoreVoo(d, perfil) }))
        .sort((a, b) => {
            const fa = a._quality.faixaOrcamento;
            const fb = b._quality.faixaOrcamento;
            if (fa !== null && fb !== null && fa !== fb) return fb - fa;

            const porScore = b._quality.score - a._quality.score;
            if (porScore !== 0) return porScore;

            const pa = a.flight?.price || 0;
            const pb = b.flight?.price || 0;
            // Com teto definido, desempata pelo que aproveita mais o
            // orçamento. Sem teto, não há o que aproveitar: o mais barato
            // é o desempate razoável.
            return orcamento > 0 ? pb - pa : (pa || Infinity) - (pb || Infinity);
        });
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
