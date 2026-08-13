// Testes da classificação do Vai e Vem (P0)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarClassificador, classificarViabilidadeViagem, AMPLITUDE_MINIMA_PCT } from '../api/vai-e-vem.js';

test('classificação usa a distribuição das semanas pesquisadas', () => {
    const precos = [600, 700, 800, 900, 1000, 1100, 1200, 1500];
    const c = criarClassificador(precos);
    assert.equal(c.fonte, 'semanas_pesquisadas');
    assert.match(c.referencia, /semanas pesquisadas/);
    assert.equal(c.classificar(600), 'barato');
    assert.equal(c.classificar(900), 'normal');
    assert.equal(c.classificar(1500), 'caro');
});

test('a faixa do Google entra como contexto, não como critério', () => {
    const precos = [600, 700, 800, 900, 1000, 1100, 1200, 1500];
    const c = criarClassificador(precos, [1400, 2000]);
    assert.equal(c.fonte, 'semanas_pesquisadas', 'a base continua sendo o que medimos');
    assert.deepEqual(c.faixaGoogle, { low: 1400, high: 2000 });
    // Pela faixa do Google TODAS as semanas seriam "baratas" (todas abaixo de
    // R$ 1.400); pela distribuição medida, a mais cara é "cara".
    assert.equal(c.classificar(1500), 'caro');
    assert.equal(c.classificar(600), 'barato');
});

test('preços semelhantes não viram barato x caro', () => {
    const precos = [1000, 1020, 1040, 1050];
    const c = criarClassificador(precos);
    assert.equal(c.precosSemelhantes, true);
    assert.equal(c.classificar(1000), 'normal');
    assert.equal(c.classificar(1050), 'normal');
    assert.match(c.referencia, /semelhantes/);
});

test('amplitude no limite ativa a classificação', () => {
    // amplitude exatamente no corte configurado
    const maior = 1000;
    const menor = Math.round(maior * (1 - AMPLITUDE_MINIMA_PCT / 100)) - 1;
    const c = criarClassificador([menor, 900, 950, maior]);
    assert.equal(c.precosSemelhantes, false);
});

test('lista vazia não quebra e não classifica nada', () => {
    const c = criarClassificador([]);
    assert.equal(c.classificar(100), 'normal');
    assert.equal(c.faixa, null);
});

test('uma única semana pesquisada não vira "barata"', () => {
    const c = criarClassificador([850]);
    assert.equal(c.precosSemelhantes, true, 'sem distribuição não há comparação');
    assert.equal(c.classificar(850), 'normal');
});

// ============================================================
// VIABILIDADE
// ============================================================
test('viagem de 2 noites com 12h de voo e 2 conexões é inviável', () => {
    const v = classificarViabilidadeViagem({
        noites: 2,
        flight_details: { total_duration: 720, stops: 2 },
    });
    assert.equal(v.nivel, 'inviavel');
    assert.ok(v.motivo);
});

test('voo direto e curto para 2 noites é boa opção', () => {
    const v = classificarViabilidadeViagem({
        noites: 2,
        flight_details: { total_duration: 120, stops: 0 },
    });
    assert.equal(v.nivel, 'boa');
});

test('sem detalhes de voo a viabilidade fica desconhecida', () => {
    assert.equal(classificarViabilidadeViagem({ noites: 3 }).nivel, 'desconhecida');
    assert.equal(classificarViabilidadeViagem({ noites: 0, flight_details: { total_duration: 100 } }).nivel, 'desconhecida');
});

test('a mesma duração é aceitável numa viagem mais longa', () => {
    const curta = classificarViabilidadeViagem({ noites: 2, flight_details: { total_duration: 800, stops: 1 } });
    const longa = classificarViabilidadeViagem({ noites: 7, flight_details: { total_duration: 800, stops: 1 } });
    assert.equal(curta.nivel, 'inviavel');
    assert.equal(longa.nivel, 'aceitavel');
});
