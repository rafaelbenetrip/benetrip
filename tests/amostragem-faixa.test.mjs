// Amostragem por faixa de orçamento (Descobrir Destinos)
//
// A lista inteira vai no prompt do ranking, então há um teto de linhas. O
// corte antigo pegava os N mais baratos: com teto de R$ 12.000 e 116
// destinos elegíveis, tudo acima de R$ 6.400 sumia ANTES de qualquer
// ordenação — justamente a ponta que o ranqueador passou a preferir.
//
// A amostragem distribui as mesmas N vagas entre as bandas de orçamento,
// sem custar um token a mais no prompt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const arquivo = fileURLToPath(new URL('../public/assets/js/descobrir-destinos.js', import.meta.url));
const compartilhado = fileURLToPath(new URL('../public/assets/js/benetrip-shared-ui.js', import.meta.url));

function carregar() {
    const ctx = { window: {}, document: { addEventListener() {} }, URL, console: { log() {} } };
    ctx.window.document = ctx.document;
    vm.createContext(ctx);
    vm.runInContext(readFileSync(compartilhado, 'utf-8'), ctx);
    vm.runInContext(`${readFileSync(arquivo, 'utf-8')}\n;globalThis.__d = BenetripDiscovery;`, ctx);
    return ctx.__d;
}

const D = carregar();

const dest = (preco, stops = 0, nome = `D${preco}`) => ({
    name: nome,
    country: 'X',
    flight: { price: preco, stops, flight_duration_minutes: 200 },
});

// 116 destinos de R$ 600 a R$ 12.100, teto de R$ 12.000
function catalogo(n = 116, passo = 100, inicio = 600) {
    return Array.from({ length: n }, (_, i) => dest(inicio + i * passo, i % 3 === 2 ? 1 : 0));
}

test('lista menor que o teto passa inteira', () => {
    const entrada = catalogo(10);
    const saida = D.amostrarPorFaixa(entrada, 12000, 60);
    assert.equal(saida.length, 10);
});

test('a amostra alcança a parte alta do orçamento', () => {
    const entrada = catalogo().filter(d => d.flight.price <= 12000);
    const saida = D.amostrarPorFaixa(entrada, 12000, 60);
    const maiorAmostrado = Math.max(...saida.map(d => d.flight.price));
    const maiorElegivel = Math.max(...entrada.map(d => d.flight.price));

    assert.equal(saida.length, 60);
    assert.ok(maiorAmostrado >= maiorElegivel * 0.95,
        `amostra parou em ${maiorAmostrado}, elegível ia até ${maiorElegivel}`);
});

test('toda banda de orçamento com candidatos ganha representante', () => {
    const entrada = catalogo().filter(d => d.flight.price <= 12000);
    const saida = D.amostrarPorFaixa(entrada, 12000, 60);

    const bandasEntrada = new Set(entrada.map(d => D.faixaDoPreco(d.flight.price, 12000)));
    const bandasSaida = new Set(saida.map(d => D.faixaDoPreco(d.flight.price, 12000)));
    for (const b of bandasEntrada) {
        assert.ok(bandasSaida.has(b), `banda ${b} ficou sem representante na amostra`);
    }
});

test('banda com poucos candidatos não desperdiça vaga', () => {
    // Banda 9 tem 2 destinos; as vagas restantes precisam ir para as outras
    const entrada = [
        ...Array.from({ length: 40 }, (_, i) => dest(1000 + i * 10)),
        dest(11000), dest(11500),
    ];
    const saida = D.amostrarPorFaixa(entrada, 12000, 20);
    assert.equal(saida.length, 20, 'o corte precisa preencher todas as vagas disponíveis');
    assert.ok(saida.some(d => d.flight.price >= 11000), 'a banda alta precisa aparecer');
});

test('dentro da mesma banda, menos escalas entra primeiro', () => {
    const entrada = [
        dest(11800, 2, 'duas escalas'),
        dest(11700, 0, 'direto'),
        dest(11600, 1, 'uma escala'),
    ];
    const saida = D.amostrarPorFaixa(entrada, 12000, 1);
    assert.equal(saida[0].name, 'direto');
});

test('sem orçamento informado a amostragem não tenta adivinhar faixas', () => {
    const entrada = catalogo(100);
    const saida = D.amostrarPorFaixa(entrada, 0, 60);
    assert.equal(saida.length, 60);
});

test('a amostra é subconjunto da entrada, sem repetições', () => {
    const entrada = catalogo().filter(d => d.flight.price <= 12000);
    const saida = D.amostrarPorFaixa(entrada, 12000, 60);

    const nomes = saida.map(d => d.name);
    assert.equal(new Set(nomes).size, nomes.length, 'nenhum destino pode aparecer duas vezes');
    for (const d of saida) {
        assert.ok(entrada.includes(d), `${d.name} não veio da entrada`);
    }
});

test('a amostra sai ordenada por preço', () => {
    const saida = D.amostrarPorFaixa(catalogo().filter(d => d.flight.price <= 12000), 12000, 60);
    // Array.from, não .map: o objeto vem do realm do vm e um array criado lá
    // tem outro Array.prototype, o que faz deepStrictEqual reprovar por
    // protótipo mesmo com os valores idênticos.
    const precos = Array.from(saida, d => d.flight.price);
    assert.deepEqual(precos, [...precos].sort((a, b) => a - b));
});

// ============================================================
// O CORTE ANTIGO FALHARIA AQUI
// ============================================================
test('o corte por preço crescente deixaria a metade cara de fora', () => {
    const entrada = catalogo().filter(d => d.flight.price <= 12000);
    const corteAntigo = entrada.slice().sort((a, b) => a.flight.price - b.flight.price).slice(0, 60);
    const maiorAntigo = Math.max(...corteAntigo.map(d => d.flight.price));
    const maiorNovo = Math.max(...D.amostrarPorFaixa(entrada, 12000, 60).map(d => d.flight.price));

    assert.ok(maiorNovo > maiorAntigo * 1.5,
        `amostragem precisa alcançar bem além do corte antigo (antigo=${maiorAntigo}, novo=${maiorNovo})`);
});
