// api/_lib/travel-viability.js - BENETRIP TRAVEL VIABILITY v1.0
//
// Regra de PRODUTO, determinística e compartilhável: "dá para ir a este lugar
// nesta janela de tempo?". A pergunta que as Escapadas precisam responder não
// é "existe tarifa para estas datas", e sim "para onde realmente dá para ir".
//
// A função olha SOMENTE dados objetivos:
//   - número de noites da janela;
//   - duração do voo por trecho;
//   - número de escalas;
//   - duração total de ida e volta;
//   - deslocamento terrestre, quando medido externamente;
//   - a existência ou ausência desses dados.
//
// Não existe lista de destinos aqui, nem nada por destino: qualquer lugar do
// mundo é avaliado pelas mesmas regras. Os limites abaixo são os parâmetros
// do produto e ficam documentados neste arquivo — mexer neles muda a régua de
// todas as ferramentas de uma vez.

// ============================================================
// PARÂMETROS DO PRODUTO
// ============================================================
export const REGRAS_VIABILIDADE = {
    // Fração máxima da janela (noites * 24h) consumida por ida + volta.
    // 12% de um fim de semana de 2 noites ≈ 2h50 de voo em cada sentido.
    fracaoBoa: 0.12,
    // Acima disso o deslocamento aéreo come parte demais da viagem.
    fracaoMaxima: 0.22,

    // Teto absoluto de duração POR TRECHO conforme o tamanho da janela.
    // Um voo de 5h para dormir duas noites fora não se sustenta, mesmo que a
    // conta de fração passasse raspando.
    duracaoMaximaPorTrechoMin: {
        2: 300,   // até 2 noites: 5h por trecho
        3: 420,   // 3 noites: 7h
        4: 600,   // 4 noites: 10h
    },
    // Janelas maiores que as listadas usam só a regra de fração.

    // Escalas: em janelas curtas cada conexão é um risco de perder o dia.
    maxEscalasJanelaCurta: 1, // até 3 noites
    noitesJanelaCurta: 3,

    // Deslocamento terrestre conhecido (aeroporto -> destino, cada sentido).
    // Só entra na conta quando foi medido por um provedor externo.
    deslocamentoMaximoMin: { 2: 120, 3: 180 },
};

export const NIVEL = {
    BOA: 'boa',
    ACEITAVEL: 'aceitavel',
    INVIAVEL: 'inviavel',
    DESCONHECIDA: 'desconhecida',
};

function tetoPorTrecho(noites) {
    const tabela = REGRAS_VIABILIDADE.duracaoMaximaPorTrechoMin;
    if (tabela[noites] !== undefined) return tabela[noites];
    const chaves = Object.keys(tabela).map(Number).sort((a, b) => a - b);
    const maiorConhecida = chaves[chaves.length - 1];
    return noites > maiorConhecida ? null : tabela[chaves[0]];
}

function tetoDeslocamento(noites) {
    const tabela = REGRAS_VIABILIDADE.deslocamentoMaximoMin;
    return tabela[noites] !== undefined ? tabela[noites] : null;
}

function fmtDuracao(min) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h === 0) return `${m}min`;
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

// ============================================================
// AVALIAÇÃO
//
// entrada: {
//   noites,                 // tamanho da janela
//   duracaoVooMin,          // duração POR TRECHO (o que os fornecedores dão)
//   paradas,                // escalas por trecho
//   duracaoTotalIdaVoltaMin // opcional: quando o fornecedor dá o total
//   deslocamentoTerrestreMin// opcional: medido externamente
// }
//
// saída: { nivel, fracao, motivo, motivos[], recomendavel }
// `recomendavel` é o que decide se o resultado entra na lista principal.
// Viabilidade desconhecida NUNCA vira "boa" — fica de fora do topo, mas
// também não é acusada de inviável.
// ============================================================
export function avaliarViabilidade({
    noites,
    duracaoVooMin,
    paradas,
    duracaoTotalIdaVoltaMin = null,
    deslocamentoTerrestreMin = null,
} = {}) {
    const n = Number(noites) || 0;
    const porTrecho = Number(duracaoVooMin) || 0;
    const escalas = Number.isFinite(Number(paradas)) ? Number(paradas) : null;

    if (n <= 0 || (porTrecho <= 0 && !duracaoTotalIdaVoltaMin)) {
        return {
            nivel: NIVEL.DESCONHECIDA,
            fracao: null,
            motivo: null,
            motivos: ['Duração do voo não informada pelo fornecedor'],
            recomendavel: false,
        };
    }

    const totalAereo = Number(duracaoTotalIdaVoltaMin) > 0
        ? Number(duracaoTotalIdaVoltaMin)
        : porTrecho * 2;
    const totalTerrestre = Number(deslocamentoTerrestreMin) > 0 ? Number(deslocamentoTerrestreMin) * 2 : 0;
    const minutosJanela = n * 24 * 60;
    const fracao = (totalAereo + totalTerrestre) / minutosJanela;

    const motivos = [];

    // 1. Escalas demais numa janela curta
    if (escalas !== null && n <= REGRAS_VIABILIDADE.noitesJanelaCurta && escalas > REGRAS_VIABILIDADE.maxEscalasJanelaCurta) {
        motivos.push(`${escalas} escalas para uma janela de ${n} noite${n > 1 ? 's' : ''}`);
    }

    // 2. Trecho longo demais para a janela
    const teto = tetoPorTrecho(n);
    const trechoEstimado = porTrecho > 0 ? porTrecho : Math.round(totalAereo / 2);
    if (teto !== null && trechoEstimado > teto) {
        motivos.push(`voo de ${fmtDuracao(trechoEstimado)} por trecho para uma janela de ${n} noite${n > 1 ? 's' : ''}`);
    }

    // 3. Deslocamento aéreo + terrestre consumindo parcela excessiva
    if (fracao > REGRAS_VIABILIDADE.fracaoMaxima) {
        motivos.push(`o deslocamento consome ${Math.round(fracao * 100)}% da viagem`);
    }

    // 4. Deslocamento terrestre conhecido acima do tolerável
    const tetoTerra = tetoDeslocamento(n);
    if (tetoTerra !== null && Number(deslocamentoTerrestreMin) > tetoTerra) {
        motivos.push(`${fmtDuracao(Number(deslocamentoTerrestreMin))} de deslocamento terrestre a partir do aeroporto`);
    }

    if (motivos.length > 0) {
        return {
            nivel: NIVEL.INVIAVEL,
            fracao,
            motivo: motivos[0],
            motivos,
            recomendavel: false,
        };
    }

    if (fracao > REGRAS_VIABILIDADE.fracaoBoa || (escalas || 0) >= 1) {
        return { nivel: NIVEL.ACEITAVEL, fracao, motivo: null, motivos: [], recomendavel: true };
    }

    return { nivel: NIVEL.BOA, fracao, motivo: null, motivos: [], recomendavel: true };
}

// ============================================================
// SEPARAÇÃO DA LISTA
// Resultados não recomendáveis saem da lista principal e vão para uma seção
// fechada, com o motivo explícito. O total principal conta só os
// recomendáveis.
// ============================================================
export const TITULO_SECAO_NAO_RECOMENDADOS = 'Tarifas que não cabem bem nesta janela';

export function separarPorViabilidade(destinos) {
    const recomendados = [];
    const naoRecomendados = [];
    for (const d of destinos || []) {
        const nivel = d?.viabilidade?.nivel;
        const recomendavel = d?.viabilidade?.recomendavel;
        // Compatível com snapshots antigos, que só tinham `nivel`
        const ok = recomendavel !== undefined
            ? recomendavel === true
            : nivel === NIVEL.BOA || nivel === NIVEL.ACEITAVEL;
        (ok ? recomendados : naoRecomendados).push(d);
    }
    return {
        recomendados: recomendados.map((d, i) => ({ ...d, posicao: i + 1 })),
        naoRecomendados,
        totalRecomendados: recomendados.length,
        totalNaoRecomendados: naoRecomendados.length,
    };
}

// Frase curta do porquê, para exibir dentro da seção fechada.
export function motivoLegivel(viabilidade) {
    if (!viabilidade) return 'Sem dados suficientes sobre o voo';
    if (viabilidade.nivel === NIVEL.DESCONHECIDA) {
        return 'Duração do voo não informada, não dá para avaliar se cabe na janela';
    }
    const lista = viabilidade.motivos?.length ? viabilidade.motivos : [viabilidade.motivo].filter(Boolean);
    if (lista.length === 0) return '';
    return lista.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(' · ');
}
