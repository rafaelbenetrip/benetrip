// Testes do filtro em linguagem natural (P0 — Destinos Baratos)
// Teste de aceite da auditoria: "Praia para família, sem escalas, até R$ 1.500"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizarFiltros,
    aplicarFiltrosEstruturados,
    combinarComRelevancia,
    descreverFiltros,
} from '../api/_lib/smart-filter.js';

const dest = (nome, preco, { estilos = [], paradas = 0, intl = false, dur = 120, aeroporto = 'XXX', pais = 'Brasil', dataIda = '2026-11-12' } = {}) => ({
    nome, preco, estilos, paradas, internacional: intl,
    duracao_voo_min: dur, aeroporto, pais, data_ida: dataIda,
});

const CATALOGO = [
    dest('Maceió', 900, { estilos: ['praia', 'familia'], paradas: 0 }),
    dest('Porto Seguro', 1200, { estilos: ['praia', 'familia'], paradas: 0 }),
    dest('Fernando de Noronha', 2400, { estilos: ['praia'], paradas: 1 }),
    dest('Natal', 1100, { estilos: ['praia', 'familia'], paradas: 2 }),
    dest('Gramado', 800, { estilos: ['romantico'], paradas: 0 }),
    dest('Buenos Aires', 1400, { estilos: ['cidade'], paradas: 0, intl: true, pais: 'Argentina' }),
];

// ============================================================
// TESTE DE ACEITE DA AUDITORIA
// ============================================================
test('"praia para família, sem escalas, até R$ 1.500" respeita TODOS os critérios', () => {
    const filtros = { estilos: ['praia'], familia: true, direto: true, precoMax: 1500 };
    const indices = aplicarFiltrosEstruturados(CATALOGO, filtros);
    const nomes = indices.map(i => CATALOGO[i].nome);

    assert.deepEqual(nomes, ['Maceió', 'Porto Seguro']);
    for (const i of indices) {
        const d = CATALOGO[i];
        assert.ok(d.preco <= 1500, `${d.nome} acima do teto`);
        assert.equal(d.paradas, 0, `${d.nome} tem escala`);
        assert.ok(d.estilos.includes('praia'), `${d.nome} não é praia`);
        assert.ok(d.estilos.includes('familia'), `${d.nome} não é para família`);
    }
});

test('a IA não consegue furar os critérios objetivos', () => {
    const filtros = { estilos: ['praia'], familia: true, direto: true, precoMax: 1500 };
    // A IA "sugeriu" Noronha (R$ 2.400, 1 escala) e Natal (2 escalas)
    const indicesIA = [2, 3, 0];
    const final = combinarComRelevancia(CATALOGO, filtros, indicesIA);
    const nomes = final.map(i => CATALOGO[i].nome);

    assert.ok(!nomes.includes('Fernando de Noronha'), 'acima do teto não pode entrar');
    assert.ok(!nomes.includes('Natal'), 'com escalas não pode entrar');
    assert.equal(nomes[0], 'Maceió', 'a ordem sugerida pela IA vale entre os válidos');
});

// ============================================================
// CAMPOS ESTRUTURADOS
// ============================================================
test('filtro de preço é teto, não faixa', () => {
    const indices = aplicarFiltrosEstruturados(CATALOGO, { precoMax: 1000 });
    assert.deepEqual(indices.map(i => CATALOGO[i].nome), ['Maceió', 'Gramado']);
});

test('voo direto exige paradas igual a zero', () => {
    const indices = aplicarFiltrosEstruturados(CATALOGO, { direto: true });
    assert.ok(indices.every(i => CATALOGO[i].paradas === 0));
});

test('máximo de paradas é respeitado', () => {
    const indices = aplicarFiltrosEstruturados(CATALOGO, { maxParadas: 1 });
    assert.ok(indices.every(i => CATALOGO[i].paradas <= 1));
    assert.ok(!indices.map(i => CATALOGO[i].nome).includes('Natal'));
});

test('nacional e internacional filtram corretamente', () => {
    const nac = aplicarFiltrosEstruturados(CATALOGO, { internacional: false });
    assert.ok(nac.every(i => !CATALOGO[i].internacional));
    const intl = aplicarFiltrosEstruturados(CATALOGO, { internacional: true });
    assert.deepEqual(intl.map(i => CATALOGO[i].nome), ['Buenos Aires']);
});

test('país, aeroporto e período filtram', () => {
    assert.deepEqual(
        aplicarFiltrosEstruturados(CATALOGO, { pais: 'Argentina' }).map(i => CATALOGO[i].nome),
        ['Buenos Aires']
    );
    const comAeroporto = [dest('A', 500, { aeroporto: 'SSA' }), dest('B', 500, { aeroporto: 'REC' })];
    assert.deepEqual(aplicarFiltrosEstruturados(comAeroporto, { aeroporto: 'ssa' }).length, 1);
    const comData = [dest('A', 500, { dataIda: '2026-11-12' }), dest('B', 500, { dataIda: '2026-12-01' })];
    assert.deepEqual(aplicarFiltrosEstruturados(comData, { periodo: '2026-12' }).map(i => comData[i].nome), ['B']);
});

test('duração ausente não passa por filtro de duração', () => {
    const lista = [
        dest('Com duração', 500, { dur: 90 }),
        { nome: 'Sem duração', preco: 500, estilos: [], paradas: 0, duracao_voo_min: null },
    ];
    const indices = aplicarFiltrosEstruturados(lista, { duracaoMaxMin: 180 });
    assert.deepEqual(indices.map(i => lista[i].nome), ['Com duração']);
});

test('critério não informado não filtra nada', () => {
    assert.equal(aplicarFiltrosEstruturados(CATALOGO, {}).length, CATALOGO.length);
    assert.equal(aplicarFiltrosEstruturados(CATALOGO, null).length, CATALOGO.length);
});

test('valores inválidos vindos da IA são descartados', () => {
    const f = normalizarFiltros({ precoMax: 'muito', direto: 'sim', maxParadas: -1, estilos: 'praia' });
    assert.equal(f.precoMax, null);
    assert.equal(f.direto, null);
    assert.equal(f.maxParadas, null);
    assert.deepEqual(f.estilos, []);
});

// ============================================================
// INTERPRETAÇÃO MOSTRADA AO USUÁRIO
// ============================================================
test('a interpretação é legível e cobre os critérios', () => {
    const partes = descreverFiltros({ estilos: ['praia'], familia: true, direto: true, precoMax: 1500 });
    const texto = partes.join(' · ');
    assert.match(texto, /praia/);
    assert.match(texto, /família/);
    assert.match(texto, /voo direto/);
    assert.match(texto, /1\.500/);
});

test('sem critérios a interpretação fica vazia (não inventa)', () => {
    assert.deepEqual(descreverFiltros({}), []);
});

// ============================================================
// CENÁRIO DE ACEITAÇÃO DA AUDITORIA
// "praia internacional barata, sem escalas, até R$ 4.000"
// ============================================================
test('filtro "praia internacional barata, sem escalas, até R$ 4.000"', () => {
    const filtros = {
        estilos: ['praia'],
        internacional: true,
        direto: true,
        precoMax: 4000,
    };

    const destinos = [
        // 0: passa em tudo
        { nome: 'Cartagena', pais: 'Colômbia', internacional: true, estilos: ['praia'], paradas: 0, preco: 2800, aeroporto: 'CTG' },
        // 1: acima do teto
        { nome: 'Cancún', pais: 'México', internacional: true, estilos: ['praia'], paradas: 0, preco: 4300, aeroporto: 'CUN' },
        // 2: tem escala
        { nome: 'Punta Cana', pais: 'República Dominicana', internacional: true, estilos: ['praia'], paradas: 1, preco: 3200, aeroporto: 'PUJ' },
        // 3: nacional
        { nome: 'Maceió', pais: 'Brasil', internacional: false, estilos: ['praia'], paradas: 0, preco: 900, aeroporto: 'MCZ' },
        // 4: internacional e barato, mas não é praia
        { nome: 'Buenos Aires', pais: 'Argentina', internacional: true, estilos: ['cidade'], paradas: 0, preco: 1800, aeroporto: 'EZE' },
        // 5: sem dado de escalas — não pode passar por "sem escalas"
        { nome: 'Aruba', pais: 'Aruba', internacional: true, estilos: ['praia'], paradas: null, preco: 3900, aeroporto: 'AUA' },
    ];

    const indices = aplicarFiltrosEstruturados(destinos, filtros);
    assert.deepEqual(indices, [0], 'só Cartagena atende aos quatro critérios ao mesmo tempo');

    const descricao = descreverFiltros(filtros).join(' · ');
    assert.match(descricao, /praia/);
    assert.match(descricao, /somente voo direto/);
    assert.match(descricao, /4\.000/);
    assert.match(descricao, /internacionais/);
});

test('o pedido "barata" sozinho não vira teto de preço inventado', () => {
    // "barata" é vago: sem número explícito, nenhum precoMax é aplicado
    const indices = aplicarFiltrosEstruturados(
        [{ nome: 'X', preco: 9000, estilos: ['praia'], internacional: true, paradas: 0 }],
        { estilos: ['praia'], internacional: true, direto: true }
    );
    assert.deepEqual(indices, [0]);
    assert.ok(!descreverFiltros({ estilos: ['praia'] }).some(p => /até R\$/.test(p)));
});
