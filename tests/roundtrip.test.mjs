// Testes da transparência ida/volta (P0 — Comparar Voos)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisarItinerario, avaliarDiferenca } from '../api/_lib/roundtrip.js';

const leg = (from, to) => ({
    departure_airport: { id: from },
    arrival_airport: { id: to },
});

// ============================================================
// DETECÇÃO DO TRECHO DE VOLTA
// ============================================================
test('só ida: não é itinerário completo', () => {
    const r = analisarItinerario([leg('GRU', 'SSA')], { origem: 'GRU', destino: 'SSA' });
    assert.equal(r.completo, false);
    assert.equal(r.motivo, 'volta_ausente');
    assert.equal(r.ida.length, 1);
    assert.equal(r.volta.length, 0);
});

test('ida com escala e sem volta continua incompleto', () => {
    const r = analisarItinerario([leg('GRU', 'BSB'), leg('BSB', 'SSA')], { origem: 'GRU', destino: 'SSA' });
    assert.equal(r.completo, false);
    assert.equal(r.ida.length, 2);
});

test('ida e volta completas são reconhecidas', () => {
    const r = analisarItinerario(
        [leg('GRU', 'SSA'), leg('SSA', 'GRU')],
        { origem: 'GRU', destino: 'SSA' }
    );
    assert.equal(r.completo, true);
    assert.equal(r.ida.length, 1);
    assert.equal(r.volta.length, 1);
    assert.equal(r.motivo, null);
});

test('ida e volta com escalas dos dois lados', () => {
    const r = analisarItinerario(
        [leg('GRU', 'BSB'), leg('BSB', 'SSA'), leg('SSA', 'REC'), leg('REC', 'GRU')],
        { origem: 'GRU', destino: 'SSA' }
    );
    assert.equal(r.completo, true);
    assert.equal(r.ida.length, 2);
    assert.equal(r.volta.length, 2);
});

test('volta que não retorna à origem não é itinerário completo', () => {
    const r = analisarItinerario(
        [leg('GRU', 'SSA'), leg('SSA', 'REC')],
        { origem: 'GRU', destino: 'SSA' }
    );
    assert.equal(r.completo, false);
    assert.equal(r.motivo, 'volta_incompleta');
});

test('sem trechos não afirma nada', () => {
    const r = analisarItinerario([], { origem: 'GRU', destino: 'SSA' });
    assert.equal(r.completo, false);
    assert.equal(r.motivo, 'sem_trechos');
});

test('aeroporto real da tarifa é preservado (VCP, não GRU)', () => {
    const r = analisarItinerario([leg('VCP', 'SSA')], { destino: 'SSA' });
    assert.equal(r.origem, 'VCP');
    assert.equal(r.destino, 'SSA');
});

test('cidade agregada: aceita qualquer aeroporto do grupo', () => {
    const r = analisarItinerario(
        [leg('CGH', 'SSA'), leg('SSA', 'VCP')],
        { origem: ['GRU', 'CGH', 'VCP'], destino: 'SSA' }
    );
    assert.equal(r.completo, true, 'sair de CGH e voltar em VCP ainda é ida e volta de São Paulo');
    assert.equal(r.origem, 'CGH');
});

test('destino desconhecido não afirma itinerário completo', () => {
    // Sem o destino não dá para distinguir escala de retorno
    const r = analisarItinerario([leg('CGH', 'SSA'), leg('SSA', 'CGH')], {});
    assert.equal(r.completo, false);
    assert.equal(r.motivo, 'destino_desconhecido');
});

// ============================================================
// DIFERENÇA ENTRE COMBINAÇÕES
// ============================================================
test('diferença pequena não vira comemoração', () => {
    const d = avaliarDiferenca({ maisBarato: 1000, maisCaro: 1050, paxParaPreco: 1 });
    assert.equal(d.relevante, false);
    assert.equal(d.diferencaPorPessoa, 50);
});

test('diferença grande é relevante', () => {
    const d = avaliarDiferenca({ maisBarato: 1000, maisCaro: 1500, paxParaPreco: 1 });
    assert.equal(d.relevante, true);
    assert.equal(d.percentual, 33);
});

test('diferença é avaliada POR PESSOA na família', () => {
    // R$ 200 no total para 4 pessoas = R$ 50/pessoa: percentual baixo também
    const d = avaliarDiferenca({ maisBarato: 4000, maisCaro: 4200, paxParaPreco: 4 });
    assert.equal(d.diferencaPorPessoa, 50);
    assert.equal(d.relevante, false, 'menos de 10% não é economia relevante');
});

test('percentual alto mas centavos por pessoa não é relevante', () => {
    const d = avaliarDiferenca({ maisBarato: 100, maisCaro: 140, paxParaPreco: 4 });
    assert.equal(d.percentual >= 10, true);
    assert.equal(d.relevante, false, 'R$ 10 por pessoa não justifica mudar a viagem');
});

test('dados ausentes não geram afirmação', () => {
    assert.equal(avaliarDiferenca({ maisBarato: 0, maisCaro: 100 }).relevante, false);
    assert.equal(avaliarDiferenca({}).relevante, false);
});
