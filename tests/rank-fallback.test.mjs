// Fallback determinístico do ranking (sem LLM)
//
// A ordenação passou a colocar o orçamento antes da logística, então a
// primeira posição da lista pode ser um voo com 2 ou mais escalas. No
// caminho com IA, violaRestricaoObjetiva valida a escolha do modelo. No
// fallback não existe escolha para validar: o topo saía direto de
// selected[0], e uma família com crianças receberia como MELHOR DESTINO
// exatamente o que a trava existe para impedir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankByQuality } from '../api/rank-destinations.js';
import { ranquearPorQualidade } from '../api/_lib/flight-quality.js';

const dest = (name, price, stops = 0, durMin = 120, country = 'Brasil') => ({
    name,
    country,
    primary_airport: name.slice(0, 3).toUpperCase(),
    flight: { price, stops, flight_duration_minutes: durMin },
});

test('fallback com crianças não entrega 2 escalas como melhor destino', () => {
    const familia = { orcamento: 5000, criancas: 2, bebes: 0, noites: 7 };
    const destinos = [
        dest('Escalas caro', 4800, 2, 800, 'Chile'),
        dest('Direto medio', 3200, 0, 200, 'Argentina'),
        dest('Direto barato', 1500, 0, 150, 'Uruguai'),
    ];
    const ordenados = ranquearPorQualidade(destinos, familia);
    assert.equal(ordenados[0].name, 'Escalas caro', 'a ordenação segue o orçamento');

    const r = rankByQuality(ordenados, familia.orcamento, familia);
    assert.equal(r.top_destino.flight.stops === 2, false,
        `melhor destino não pode ter 2 escalas para família: veio ${r.top_destino.name}`);
});

test('a opção rebaixada continua na lista, não é descartada', () => {
    const familia = { orcamento: 5000, criancas: 1, bebes: 0, noites: 7 };
    const ordenados = ranquearPorQualidade([
        dest('Escalas caro', 4800, 2, 800, 'Chile'),
        dest('Direto medio', 3200, 0, 200, 'Argentina'),
    ], familia);

    const r = rankByQuality(ordenados, familia.orcamento, familia);
    const exibidos = [r.top_destino, ...(r.alternativas || []), r.surpresa].filter(Boolean);
    assert.ok(exibidos.some(d => d.name === 'Escalas caro'),
        'rebaixar não é remover: a opção precisa seguir visível');
});

test('sem crianças o fallback respeita o orçamento primeiro', () => {
    const adulto = { orcamento: 5000, criancas: 0, bebes: 0, noites: 7 };
    const ordenados = ranquearPorQualidade([
        dest('Escalas caro', 4800, 2, 800, 'Chile'),
        dest('Direto barato', 1500, 0, 150, 'Uruguai'),
    ], adulto);

    const r = rankByQuality(ordenados, adulto.orcamento, adulto);
    assert.equal(r.top_destino.name, 'Escalas caro');
});

test('fallback sem orçamento informado não quebra', () => {
    const perfil = { noites: 7 };
    const ordenados = ranquearPorQualidade([
        dest('A', 900, 0, 120),
        dest('B', 1800, 1, 300, 'Peru'),
    ], perfil);
    const r = rankByQuality(ordenados, 0, perfil);
    assert.ok(r.top_destino, 'precisa devolver um melhor destino');
    assert.equal(r._model, 'fallback_quality');
});
