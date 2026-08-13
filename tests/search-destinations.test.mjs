// Testes da cobertura de buscas do Todos os Destinos (P0)
// A promessa é: resultados("todos") ⊇ resultados("nacional")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarBuscas } from '../api/search-destinations.js';

const baseParams = { departure_id: 'SAO', interests: 'popular', currency: 'BRL' };

// Origem brasileira: repare que o kgmid_continente do JSON de cidades
// (/m/06n3y) é diferente do id da tabela de continentes (/m/0dg3n1) — foi
// essa divergência que fazia "Todos" perder destinos nacionais.
const geoBR = {
    codigo_pais: 'BR',
    pais: 'Brasil',
    kgmid_pais: '/m/015fr',
    continente: 'América do Sul',
    kgmid_continente: '/m/06n3y',
};

const arrivalIds = (buscas) => buscas.map(b => b.params.arrival_id ?? null);

test('todos os escopos executam a busca GLOBAL', () => {
    for (const escopo of ['nacional', 'internacional', 'tanto_faz']) {
        assert.ok(arrivalIds(montarBuscas(baseParams, geoBR, escopo)).includes(null),
            `escopo ${escopo} sem busca global`);
    }
});

test('"todos" é superset das buscas do escopo nacional', () => {
    const nacional = new Set(arrivalIds(montarBuscas(baseParams, geoBR, 'nacional')));
    const todos = new Set(arrivalIds(montarBuscas(baseParams, geoBR, 'tanto_faz')));
    for (const id of nacional) {
        assert.ok(todos.has(id), `busca ${id} existe no nacional mas falta em "todos"`);
    }
});

test('"todos" é superset das buscas do escopo internacional', () => {
    const intl = new Set(arrivalIds(montarBuscas(baseParams, geoBR, 'internacional')));
    const todos = new Set(arrivalIds(montarBuscas(baseParams, geoBR, 'tanto_faz')));
    for (const id of intl) {
        assert.ok(todos.has(id), `busca ${id} existe no internacional mas falta em "todos"`);
    }
});

test('o continente do JSON de cidades é consultado mesmo no escopo amplo', () => {
    const todos = arrivalIds(montarBuscas(baseParams, geoBR, 'tanto_faz'));
    assert.ok(todos.includes('/m/06n3y'),
        'sem essa busca "Todos" perde os destinos que só aparecem no continente do geo');
    assert.ok(todos.includes('/m/0dg3n1'), 'o continente da estratégia continua sendo consultado');
});

test('a busca por país entra em todos os escopos', () => {
    for (const escopo of ['nacional', 'internacional', 'tanto_faz']) {
        assert.ok(arrivalIds(montarBuscas(baseParams, geoBR, escopo)).includes('/m/015fr'),
            `escopo ${escopo} sem busca por país`);
    }
});

test('nenhum arrival_id é consultado duas vezes (não desperdiça chamada)', () => {
    for (const escopo of ['nacional', 'internacional', 'tanto_faz']) {
        const ids = arrivalIds(montarBuscas(baseParams, geoBR, escopo));
        assert.equal(ids.length, new Set(ids).size, `escopo ${escopo} repete busca`);
    }
});

test('geo com continente igual ao da estratégia não gera busca duplicada', () => {
    const geoIgual = { ...geoBR, kgmid_continente: '/m/0dg3n1' };
    const ids = arrivalIds(montarBuscas(baseParams, geoIgual, 'tanto_faz'));
    assert.equal(ids.length, new Set(ids).size);
});

test('sem geo resolvido ainda existe a busca global', () => {
    const buscas = montarBuscas(baseParams, null, 'tanto_faz');
    assert.equal(buscas.length, 1);
    assert.equal(buscas[0].params.arrival_id, undefined);
});

test('os parâmetros base são preservados em cada busca', () => {
    for (const b of montarBuscas(baseParams, geoBR, 'tanto_faz')) {
        assert.equal(b.params.departure_id, 'SAO');
        assert.equal(b.params.currency, 'BRL');
        assert.ok(b.label, 'toda busca precisa de rótulo para rastrear a origem do resultado');
    }
});
