// Testes do módulo compartilhado de links externos (P2 — aeroportos agregados)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const links = require('../public/assets/js/benetrip-flight-links.js');

// Decodifica o tfs para conferir quais aeroportos foram realmente codificados
function airportsInUrl(url) {
    const tfs = new URL(url).searchParams.get('tfs');
    const raw = Buffer.from(tfs.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1');
    return raw.match(/[A-Z]{3}/g) || [];
}

test('aeroporto real da tarifa vence a lista da cidade agregada', () => {
    const sao = { code: '/m/022pfm', isCityCode: true, aeroportosIncluidos: ['GRU', 'CGH', 'VCP'] };
    const { codes, resolvido } = links.resolveAirports(sao, 'VCP');
    assert.deepEqual(codes, ['VCP']);
    assert.equal(resolvido, 'tarifa');
});

test('sem aeroporto real, usa TODOS os aeroportos do grupo (não só o primeiro)', () => {
    const sao = { code: '/m/022pfm', isCityCode: true, aeroportosIncluidos: ['GRU', 'CGH', 'VCP'] };
    const { codes, resolvido } = links.resolveAirports(sao, null);
    assert.deepEqual(codes, ['GRU', 'CGH', 'VCP']);
    assert.equal(resolvido, 'grupo');
});

test('aeroporto único é preservado', () => {
    const { codes, resolvido } = links.resolveAirports({ code: 'SSA' }, null);
    assert.deepEqual(codes, ['SSA']);
    assert.equal(resolvido, 'unico');
});

test('CTA de tarifa de VCP não abre GRU', () => {
    const url = links.buildUrl({
        origins: 'VCP', destinations: 'SSA',
        departDate: '2026-11-12', returnDate: '2026-11-19',
    });
    const airports = airportsInUrl(url);
    assert.ok(airports.includes('VCP'));
    assert.ok(!airports.includes('GRU'));
});

test('origem agregada codifica os três aeroportos de São Paulo', () => {
    const url = links.buildUrl({
        origins: ['GRU', 'CGH', 'VCP'], destinations: 'SSA',
        departDate: '2026-11-12', returnDate: '2026-11-19',
    });
    const airports = airportsInUrl(url);
    for (const code of ['GRU', 'CGH', 'VCP', 'SSA']) {
        assert.ok(airports.includes(code), `faltou ${code}`);
    }
});

test('passageiros vão no tfu e datas na URL válida', () => {
    const url = links.buildUrl({
        origins: 'GRU', destinations: 'SSA',
        departDate: '2026-11-12', returnDate: '2026-11-19',
        adults: 2, children: 2, infants: 0, currency: 'BRL',
    });
    const parsed = new URL(url);
    assert.equal(parsed.hostname, 'www.google.com');
    assert.ok(parsed.searchParams.get('tfu'));
    assert.equal(parsed.searchParams.get('curr'), 'BRL');
});

test('só ida (sem returnDate) gera URL válida', () => {
    const url = links.buildUrl({ origins: 'GRU', destinations: 'SSA', departDate: '2026-11-12' });
    assert.ok(url);
    assert.ok(airportsInUrl(url).includes('SSA'));
});

test('entrada inválida devolve null em vez de link quebrado', () => {
    assert.equal(links.buildUrl({ origins: '', destinations: 'SSA', departDate: '2026-11-12' }), null);
    assert.equal(links.buildUrl({ origins: 'GRU', destinations: 'SSA', departDate: '' }), null);
    assert.deepEqual(links.resolveAirports({ code: '/m/022pfm' }, null).codes, []);
});
