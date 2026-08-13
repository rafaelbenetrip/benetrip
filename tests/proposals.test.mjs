// Testes da consolidação de pollings da busca clássica (P0)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../public/assets/js/benetrip-proposals.js');

const term = (gate, price, url = `http://book/${gate}`) => ({
    gate_id: String(gate), gate_name: `Agência ${gate}`, price, price_rub: price * 5,
    url, original_currency: 'BRL',
});

const proposal = (sign, price, gates = [1]) => ({
    sign,
    price,
    terms_url: `http://book/${gates[0]}`,
    gate_id: String(gates[0]),
    gate_name: `Agência ${gates[0]}`,
    all_terms: gates.map(g => term(g, price)),
    segments: [{
        flights: [{
            flight_number: 'G31234', departure_airport: 'GRU', arrival_airport: 'SSA',
            departure_date: '2026-11-12', departure_time: '08:00',
            arrival_date: '2026-11-12', arrival_time: '10:30',
        }],
    }],
});

// ============================================================
// O BUG DA AUDITORIA: a melhor oferta sumia no polling seguinte
// ============================================================
test('a melhor tarifa não desaparece quando o lote seguinte não a traz', () => {
    const store = new Map();
    // Polling 1: encontrou a tarifa de R$ 1.091
    P.mergeBatch(store, [proposal('a', 1091), proposal('b', 1200)], 1000);
    // Polling 2: lote parcial de outras agências, sem a tarifa mais barata
    P.mergeBatch(store, [proposal('c', 1122), proposal('d', 1300)], 2000);

    const lista = P.toList(store);
    assert.equal(lista.length, 4, 'nada pode ser descartado por ausência no lote');
    assert.equal(lista[0].price, 1091, 'a melhor tarifa continua sendo a melhor');
});

test('a contagem só cresce ao longo dos pollings', () => {
    const store = new Map();
    const contagens = [];
    P.mergeBatch(store, [proposal('a', 1000), proposal('b', 1100)], 1000);
    contagens.push(P.toList(store).length);
    P.mergeBatch(store, [proposal('c', 1200)], 2000);
    contagens.push(P.toList(store).length);
    P.mergeBatch(store, [proposal('a', 1000)], 3000); // repetida
    contagens.push(P.toList(store).length);

    assert.deepEqual(contagens, [2, 3, 3]);
    for (let i = 1; i < contagens.length; i++) {
        assert.ok(contagens[i] >= contagens[i - 1], 'a contagem nunca pode cair');
    }
});

// ============================================================
// DEDUPLICAÇÃO E MESCLAGEM
// ============================================================
test('mesma proposta de fontes diferentes é agregada, não duplicada', () => {
    const store = new Map();
    P.mergeBatch(store, [proposal('x', 1000, [1])], 1000);
    P.mergeBatch(store, [proposal('x', 950, [2])], 2000);

    const lista = P.toList(store);
    assert.equal(lista.length, 1, 'itinerário idêntico não vira duas linhas');
    assert.equal(lista[0].all_terms.length, 2, 'as duas agências aparecem');
    assert.equal(lista[0].price, 950, 'o preço exibido é o da melhor agência');
    assert.equal(lista[0].gate_id, '2');
});

test('agência que baixou o preço atualiza a proposta', () => {
    const store = new Map();
    P.mergeBatch(store, [proposal('x', 1000, [1])], 1000);
    P.mergeBatch(store, [proposal('x', 800, [1])], 2000);
    const [p] = P.toList(store);
    assert.equal(p.all_terms.length, 1);
    assert.equal(p.price, 800);
});

test('sem sign do fornecedor, a assinatura vem do itinerário completo', () => {
    const semSign = { ...proposal('x', 1000) };
    delete semSign.sign;
    const outro = { ...proposal('y', 1000) };
    delete outro.sign;
    outro.segments = [{ flights: [{ ...proposal('y', 1000).segments[0].flights[0], departure_time: '19:00' }] }];

    assert.equal(P.signatureOf(semSign), P.signatureOf({ ...semSign }));
    assert.notEqual(P.signatureOf(semSign), P.signatureOf(outro),
        'horários diferentes = propostas diferentes');
});

test('propostas com sign diferente não são fundidas mesmo com mesmo preço', () => {
    const store = new Map();
    P.mergeBatch(store, [proposal('a', 1000), proposal('b', 1000)], 1000);
    assert.equal(P.toList(store).length, 2);
});

// ============================================================
// OFERTAS SEM LINK VÁLIDO
// ============================================================
test('proposta sem link de compra é descartada', () => {
    const store = new Map();
    const semLink = { ...proposal('z', 500), terms_url: null, all_terms: [] };
    const stats = P.mergeBatch(store, [semLink, proposal('ok', 900)], 1000);
    assert.equal(stats.skipped, 1);
    assert.equal(P.toList(store).length, 1);
    assert.equal(P.toList(store)[0].sign, 'ok');
});

test('agência sem url não entra na consolidação de preços', () => {
    const terms = P.mergeTerms(
        [term(1, 1000)],
        [{ gate_id: '2', gate_name: 'Sem link', price: 10, url: null }]
    );
    assert.equal(terms.length, 1);
    assert.equal(terms[0].price, 1000, 'preço fantasma sem link não pode virar o menor');
});

test('proposta que perdeu todas as agências válidas sai da lista', () => {
    const store = new Map();
    P.mergeBatch(store, [proposal('x', 1000, [1])], 1000);
    // fornecedor devolveu a mesma proposta já sem link (token expirado)
    const expirada = { ...proposal('x', 1000, [1]), terms_url: null, all_terms: [] };
    store.set(P.signatureOf(expirada), { ...expirada, _key: P.signatureOf(expirada) });
    assert.equal(P.toList(store).length, 0);
});

// ============================================================
// METADADOS
// ============================================================
test('primeira e última aparição são registradas', () => {
    const store = new Map();
    P.mergeBatch(store, [proposal('x', 1000)], 1000);
    P.mergeBatch(store, [proposal('x', 1000)], 5000);
    const [p] = P.toList(store);
    assert.equal(p._firstSeen, 1000);
    assert.equal(p._lastSeen, 5000);
});

test('lote vazio não quebra nem altera o acumulado', () => {
    const store = new Map();
    P.mergeBatch(store, [proposal('x', 1000)], 1000);
    const stats = P.mergeBatch(store, [], 2000);
    assert.deepEqual([stats.added, stats.updated, stats.total], [0, 0, 1]);
    assert.equal(P.toList(store).length, 1);
});
