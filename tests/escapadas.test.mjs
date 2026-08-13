// Testes de viabilidade e dados ausentes nas Escapadas (P0)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    classificarViabilidade,
    ordenarPorViabilidade,
    selecionarEFormatarDestinos,
} from '../api/_lib/escapadas-shared.js';

const janela2Noites = { id: 'fds-2026-11-06', categoria: 'fds', ida: '2026-11-06', volta: '2026-11-08', noites: 2 };

const raw = (name, price, { stops = 0, dur = 80, hotel = 0 } = {}) => ({
    name,
    country: 'Brasil',
    primary_airport: 'XXX',
    flight: { price, stops, flight_duration_minutes: dur, airport_code: 'XXX', airline_name: 'Cia' },
    avg_cost_per_night: hotel,
});

// ============================================================
// VIABILIDADE
// ============================================================
test('voo curto e direto numa escapada de 2 noites é boa opção', () => {
    const v = classificarViabilidade({ duracaoVooMin: 70, paradas: 0, noites: 2 });
    assert.equal(v.nivel, 'boa');
});

test('voo de 10h para 2 noites é inviável', () => {
    const v = classificarViabilidade({ duracaoVooMin: 600, paradas: 0, noites: 2 });
    assert.equal(v.nivel, 'inviavel');
    assert.ok(v.motivo);
});

test('voo de 20h e de 40h para 2 noites também são inviáveis', () => {
    assert.equal(classificarViabilidade({ duracaoVooMin: 1200, paradas: 1, noites: 2 }).nivel, 'inviavel');
    assert.equal(classificarViabilidade({ duracaoVooMin: 2400, paradas: 2, noites: 2 }).nivel, 'inviavel');
});

test('2 escalas numa escapada de 2 noites é inviável mesmo com voo curto', () => {
    const v = classificarViabilidade({ duracaoVooMin: 120, paradas: 2, noites: 2 });
    assert.equal(v.nivel, 'inviavel');
});

test('o mesmo voo longo passa a ser aceitável numa janela maior', () => {
    // 7h por trecho: 29% de uma janela de 2 noites, 8% de uma de 7 noites
    const curta = classificarViabilidade({ duracaoVooMin: 420, paradas: 0, noites: 2 });
    const longa = classificarViabilidade({ duracaoVooMin: 420, paradas: 0, noites: 7 });
    assert.equal(curta.nivel, 'inviavel');
    assert.notEqual(longa.nivel, 'inviavel');
});

test('sem duração de voo a viabilidade fica desconhecida (não inventa)', () => {
    const v = classificarViabilidade({ duracaoVooMin: 0, paradas: 0, noites: 2 });
    assert.equal(v.nivel, 'desconhecida');
    assert.equal(v.fracao, null);
});

// ============================================================
// ORDENAÇÃO — inviáveis nunca entre as melhores escapadas
// ============================================================
test('destino inviável não aparece entre as melhores mesmo sendo o mais barato', () => {
    const destinos = selecionarEFormatarDestinos([
        raw('Muito longe e barato', 300, { stops: 2, dur: 900 }),
        raw('Perto e direto', 700, { stops: 0, dur: 70 }),
        raw('Perto com 1 escala', 800, { stops: 1, dur: 150 }),
    ], janela2Noites);

    assert.equal(destinos[0].nome, 'Perto e direto');
    assert.equal(destinos[destinos.length - 1].nome, 'Muito longe e barato');
    assert.equal(destinos[destinos.length - 1].viabilidade.nivel, 'inviavel');
});

test('posicao é reatribuída conforme a ordem exibida', () => {
    const destinos = selecionarEFormatarDestinos([
        raw('Inviável', 300, { stops: 0, dur: 900 }),
        raw('Viável', 700, { stops: 0, dur: 70 }),
    ], janela2Noites);
    assert.deepEqual(destinos.map(d => d.posicao), [1, 2]);
});

test('ordenarPorViabilidade preserva todos os destinos (não esconde nada)', () => {
    const entrada = [
        { nome: 'A', preco: 100, viabilidade: { nivel: 'inviavel' } },
        { nome: 'B', preco: 200, viabilidade: { nivel: 'boa' } },
        { nome: 'C', preco: 300, viabilidade: { nivel: 'aceitavel' } },
    ];
    const saida = ordenarPorViabilidade(entrada);
    assert.equal(saida.length, 3);
    assert.deepEqual(saida.map(d => d.nome), ['B', 'C', 'A']);
});

// ============================================================
// DADOS AUSENTES — zero não é valor real
// ============================================================
test('hospedagem sem dado vira null, nunca R$ 0', () => {
    const [d] = selecionarEFormatarDestinos([raw('Sem hotel', 500, { hotel: 0 })], janela2Noites);
    assert.equal(d.custo_noite, null);
});

test('hospedagem com valor real é preservada', () => {
    const [d] = selecionarEFormatarDestinos([raw('Com hotel', 500, { hotel: 220 })], janela2Noites);
    assert.equal(d.custo_noite, 220);
});

test('duração de voo ausente vira null, não zero', () => {
    const [d] = selecionarEFormatarDestinos([raw('Sem duração', 500, { dur: 0 })], janela2Noites);
    assert.equal(d.duracao_voo_min, null);
    assert.equal(d.viabilidade.nivel, 'desconhecida');
});

test('destino sem preço não entra na lista', () => {
    const lista = selecionarEFormatarDestinos([raw('Sem preço', 0), raw('Com preço', 400)], janela2Noites);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].nome, 'Com preço');
});
