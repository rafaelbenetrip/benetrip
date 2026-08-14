// Testes de completude da tarifa (P0 — Comparar Voos)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    QUOTE_TYPE,
    CELL_STATE,
    avaliarCompletudeTarifa,
    avaliarCompletudeCombinacao,
    avaliarComparabilidade,
    descreverBebes,
} from '../api/_lib/quote-completeness.js';

const tarifa = (over = {}) => ({
    price: 1000,
    trechos_ida: 1,
    trechos_volta: 0,
    itinerario_completo: false,
    booking_token: null,
    ...over,
});

// ============================================================
// CLASSIFICAÇÃO DA TARIFA
// ============================================================
test('tarifa sem trecho de volta é indicativa, não reservável', () => {
    const c = avaliarCompletudeTarifa(tarifa());
    assert.equal(c.quoteType, QUOTE_TYPE.INDICATIVE);
    assert.equal(c.hasOutboundItinerary, true);
    assert.equal(c.hasReturnItinerary, false);
    assert.equal(c.hasBookableProposal, false);
    assert.equal(c.priceIncludesReturn, false, 'sem volta definida não afirmamos que o preço cobre o retorno');
});

test('ida e volta definidas com token viram tarifa reservável', () => {
    const c = avaliarCompletudeTarifa(tarifa({
        trechos_volta: 1, itinerario_completo: true, booking_token: 'abc',
    }));
    assert.equal(c.quoteType, QUOTE_TYPE.BOOKABLE);
    assert.equal(c.hasReturnItinerary, true);
    assert.equal(c.hasBookableProposal, true);
    assert.equal(c.priceIncludesReturn, true);
});

test('token de reserva sem trecho de volta não é proposta reservável', () => {
    const c = avaliarCompletudeTarifa(tarifa({ booking_token: 'abc' }));
    assert.equal(c.hasBookableProposal, false);
    assert.equal(c.quoteType, QUOTE_TYPE.INDICATIVE);
});

test('sem trechos nenhum a completude é desconhecida', () => {
    const c = avaliarCompletudeTarifa(tarifa({ trechos_ida: 0 }));
    assert.equal(c.quoteType, QUOTE_TYPE.UNKNOWN);
});

test('busca de só ida é classificada como outbound_only', () => {
    const c = avaliarCompletudeTarifa(tarifa(), { buscaIdaEVolta: false });
    assert.equal(c.quoteType, QUOTE_TYPE.OUTBOUND_ONLY);
});

test('a data da verificação sempre acompanha a tarifa', () => {
    const c = avaliarCompletudeTarifa(tarifa());
    assert.ok(!Number.isNaN(Date.parse(c.priceVerifiedAt)));
});

// ============================================================
// CÉLULA DA MATRIZ
// ============================================================
test('célula sem voos é "sem resultado"', () => {
    const c = avaliarCompletudeCombinacao({ voos: [], melhorPreco: null });
    assert.equal(c.estado, CELL_STATE.SEM_RESULTADO);
});

test('a completude da célula é a da tarifa cujo preço é exibido', () => {
    const c = avaliarCompletudeCombinacao({
        melhorPreco: 900,
        voos: [
            tarifa({ price: 1200, trechos_volta: 1, itinerario_completo: true, booking_token: 'x' }),
            tarifa({ price: 900 }), // mais barata e incompleta: é o preço mostrado
        ],
    });
    assert.equal(c.estado, CELL_STATE.INDICATIVA);
    assert.equal(c.voosComVolta, 1);
    assert.equal(c.voosTotal, 2);
});

// ============================================================
// COMPARABILIDADE — o coração do P0
// ============================================================
const celula = (preco, quoteType) => ({ preco, quoteType });

test('não elege vencedor quando a volta não está definida', () => {
    const r = avaliarComparabilidade([
        celula(1000, QUOTE_TYPE.INDICATIVE),
        celula(1200, QUOTE_TYPE.INDICATIVE),
    ]);
    assert.equal(r.comparavel, false);
    assert.equal(r.motivo, 'tarifa_incompleta');
});

test('quatro voltas com exatamente o mesmo preço não geram vencedor', () => {
    const r = avaliarComparabilidade([
        celula(2318, QUOTE_TYPE.BOOKABLE),
        celula(2318, QUOTE_TYPE.BOOKABLE),
        celula(2318, QUOTE_TYPE.BOOKABLE),
        celula(2318, QUOTE_TYPE.BOOKABLE),
    ]);
    assert.equal(r.comparavel, false);
    assert.equal(r.motivo, 'precos_iguais');
    assert.match(r.mensagem, /diferença de preço confiável/i);
});

test('uma célula incompleta contamina a comparação inteira', () => {
    const r = avaliarComparabilidade([
        celula(1000, QUOTE_TYPE.BOOKABLE),
        celula(1500, QUOTE_TYPE.BOOKABLE),
        celula(1200, QUOTE_TYPE.INDICATIVE),
    ]);
    assert.equal(r.comparavel, false);
    assert.equal(r.celulasComparaveis, 2);
});

test('tarifas completas e diferentes podem ser comparadas', () => {
    const r = avaliarComparabilidade([
        celula(1000, QUOTE_TYPE.BOOKABLE),
        celula(1500, QUOTE_TYPE.BOOKABLE),
    ]);
    assert.equal(r.comparavel, true);
    assert.equal(r.motivo, null);
});

test('uma combinação sozinha não é comparação', () => {
    const r = avaliarComparabilidade([celula(1000, QUOTE_TYPE.BOOKABLE)]);
    assert.equal(r.comparavel, false);
    assert.equal(r.motivo, 'combinacao_unica');
});

test('sem preço nenhum não há comparação', () => {
    const r = avaliarComparabilidade([celula(null, QUOTE_TYPE.UNKNOWN)]);
    assert.equal(r.comparavel, false);
    assert.equal(r.motivo, 'sem_precos');
});

// ============================================================
// BEBÊS — "grátis" não é regra universal
// ============================================================
test('sem bebês não há aviso', () => {
    assert.equal(descreverBebes({ bebes: 0 }), null);
});

test('bebê sem preço do fornecedor avisa que a tarifa é confirmada na reserva', () => {
    const b = descreverBebes({ bebes: 1, precoInclui: false });
    assert.equal(b.incluido, false);
    assert.match(b.aviso, /confirmad/i);
    assert.doesNotMatch(b.resumo + b.aviso, /gr[áa]tis/i, 'nunca afirmar "bebê grátis"');
});

test('bebê precificado pelo fornecedor entra no total', () => {
    const b = descreverBebes({ bebes: 2, precoInclui: true });
    assert.equal(b.incluido, true);
    assert.doesNotMatch(b.aviso, /gr[áa]tis/i);
});

// ============================================================
// FLAG DO ENRIQUECIMENTO (Comparar Voos)
//
// A SearchAPI é o provedor principal e o único obrigatório. Buscar propostas
// completas na Travelpayouts custa chamadas extras e usa a mesma credencial
// da Busca de Voos, então ligaria sozinha em produção. Passou a exigir
// opt-in explícito.
// ============================================================
const { enriquecimentoHabilitado } = await import('../api/compare-flights.js');

test('sem a variável, o enriquecimento fica desligado', () => {
    assert.equal(enriquecimentoHabilitado({}), false);
});

test('valores vazios ou negativos mantêm desligado', () => {
    for (const v of ['', ' ', '0', 'false', 'off', 'nao', 'no', 'undefined']) {
        assert.equal(enriquecimentoHabilitado({ COMPARE_FLIGHTS_ENRIQUECER: v }), false, `"${v}" não deveria ligar`);
    }
});

test('só liga com opt-in explícito', () => {
    for (const v of ['1', 'true', 'on', 'sim', 'TRUE', ' True ']) {
        assert.equal(enriquecimentoHabilitado({ COMPARE_FLIGHTS_ENRIQUECER: v }), true, `"${v}" deveria ligar`);
    }
});

test('a presença da credencial da Busca de Voos não liga o enriquecimento sozinha', () => {
    const env = { AVIASALES_TOKEN: 'tok', AVIASALES_MARKER: 'mk' };
    assert.equal(enriquecimentoHabilitado(env), false,
        'ter o token não pode virar decisão de custo tomada por omissão');
});

test('desligado, a matriz continua correta: sem vencedor em tarifa incompleta', () => {
    // É o ponto central: desligar o enriquecimento não reintroduz o problema
    // que o P0 corrigiu, só deixa de tentar resolver a tarifa incompleta.
    const r = avaliarComparabilidade([
        celula(2318, QUOTE_TYPE.INDICATIVE),
        celula(2318, QUOTE_TYPE.INDICATIVE),
    ]);
    assert.equal(r.comparavel, false);
    assert.equal(r.motivo, 'tarifa_incompleta');
});
