// Testes de consistência do "mais barato" (P0 — Voos Baratos)
// A auditoria encontrou um item que era o menor preço com is_lowest falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Reproduz a consolidação do endpoint: deduplicação por par de datas
// mantendo o menor preço, ordenação e recálculo do is_lowest sobre o
// conjunto JÁ consolidado.
function consolidar(entradas) {
    const unicos = new Map();
    for (const e of entradas) {
        const key = `${e.departure}_${e.return}`;
        if (!unicos.has(key) || e.price < unicos.get(key).price) unicos.set(key, { ...e });
    }
    const sorted = Array.from(unicos.values()).sort((a, b) => a.price - b.price);
    const menor = sorted.length > 0 ? sorted[0].price : null;
    for (const e of sorted) e.is_lowest = menor !== null && e.price === menor;
    return sorted;
}

const entrada = (departure, ret, price, is_lowest_fornecedor = false) =>
    ({ departure, return: ret, price, is_lowest_fornecedor });

test('o menor preço é sempre marcado como mais barato', () => {
    const sorted = consolidar([
        entrada('2026-11-12', '2026-11-19', 1500),
        entrada('2026-12-01', '2026-12-08', 980),
        entrada('2026-10-05', '2026-10-12', 1200),
    ]);
    assert.equal(sorted[0].price, 980);
    assert.equal(sorted[0].is_lowest, true);
    assert.equal(sorted.filter(e => e.is_lowest).length, 1);
});

test('marcação do fornecedor não sobrepõe a nossa (bug da auditoria)', () => {
    const sorted = consolidar([
        // o fornecedor marcou como "lowest" um item que não é o menor do conjunto
        entrada('2026-11-12', '2026-11-19', 1500, true),
        entrada('2026-12-01', '2026-12-08', 980, false),
    ]);
    const maisBarato = sorted.find(e => e.price === 980);
    const marcadoPeloFornecedor = sorted.find(e => e.price === 1500);
    assert.equal(maisBarato.is_lowest, true, 'o menor preço precisa estar marcado');
    assert.equal(marcadoPeloFornecedor.is_lowest, false, 'não pode haver dois "mais baratos"');
});

test('empate no menor preço marca todos os empatados', () => {
    const sorted = consolidar([
        entrada('2026-11-12', '2026-11-19', 900),
        entrada('2026-11-13', '2026-11-20', 900),
        entrada('2026-11-14', '2026-11-21', 1100),
    ]);
    assert.equal(sorted.filter(e => e.is_lowest).length, 2);
    assert.ok(sorted.filter(e => e.is_lowest).every(e => e.price === 900));
});

test('deduplicação por par de datas mantém o menor preço', () => {
    const sorted = consolidar([
        entrada('2026-11-12', '2026-11-19', 1500),
        entrada('2026-11-12', '2026-11-19', 1200),
    ]);
    assert.equal(sorted.length, 1);
    assert.equal(sorted[0].price, 1200);
    assert.equal(sorted[0].is_lowest, true);
});

test('estatísticas e lista saem da mesma fonte consolidada', () => {
    const sorted = consolidar([
        entrada('2026-11-12', '2026-11-19', 1500),
        entrada('2026-12-01', '2026-12-08', 980),
        entrada('2026-10-05', '2026-10-12', 1200),
    ]);
    const precos = sorted.map(e => e.price);
    const stats = {
        cheapest: sorted[0],
        mostExpensive: sorted[sorted.length - 1],
        average: Math.round(precos.reduce((a, b) => a + b, 0) / precos.length),
        totalDates: sorted.length,
    };
    assert.equal(stats.cheapest.price, Math.min(...precos));
    assert.equal(stats.mostExpensive.price, Math.max(...precos));
    assert.equal(stats.totalDates, 3);
    assert.equal(stats.cheapest.is_lowest, true);
});

test('lista vazia não gera marcação nem quebra', () => {
    const sorted = consolidar([]);
    assert.deepEqual(sorted, []);
});

// ============================================================
// FILTROS DA LISTA — não podem esconder o que não dá para verificar
// ============================================================
function passaFiltro(item, filtro) {
    const fd = item.flight_details;
    if (filtro === 'todos') return true;
    if (!fd) return false;
    if (filtro === 'direto') return fd.stops === 0;
    if (filtro === 'max1') return fd.stops <= 1;
    if (filtro === 'curto') return fd.total_duration > 0 && fd.total_duration <= 240;
    return true;
}

test('filtro de voo direto só aceita zero escalas', () => {
    const itens = [
        { price: 900, flight_details: { stops: 0, total_duration: 120 } },
        { price: 800, flight_details: { stops: 1, total_duration: 300 } },
    ];
    const filtrados = itens.filter(i => passaFiltro(i, 'direto'));
    assert.equal(filtrados.length, 1);
    assert.equal(filtrados[0].price, 900);
});

test('item sem detalhes de voo não passa por filtro de voo', () => {
    const item = { price: 700 };
    assert.equal(passaFiltro(item, 'todos'), true);
    assert.equal(passaFiltro(item, 'direto'), false, 'não dá para afirmar que é direto');
    assert.equal(passaFiltro(item, 'curto'), false);
});

test('filtro de duração usa o dado real, não zero', () => {
    const semDuracao = { price: 700, flight_details: { stops: 0, total_duration: 0 } };
    assert.equal(passaFiltro(semDuracao, 'curto'), false, 'duração zero não é voo curto');
});
