// Testes do enriquecimento do card em /descobrir-destinos
//
// Foto, datas da tarifa e companhia aérea já vinham do provedor e eram
// descartadas na renderização. Estes testes cobrem o que o card não pode
// errar: URL de terceiro não pode virar HTML executável, e uma tarifa em
// datas diferentes das pedidas precisa aparecer como tal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const arquivo = fileURLToPath(new URL('../public/assets/js/descobrir-destinos.js', import.meta.url));

function carregarDiscovery() {
    // O arquivo é um script de navegador: registra um listener no final e
    // depende de `window`. Um contexto mínimo basta para os helpers puros.
    const contexto = {
        window: {},
        document: { addEventListener() {} },
        console,
    };
    contexto.window.document = contexto.document;
    vm.createContext(contexto);
    vm.runInContext(`${readFileSync(arquivo, 'utf-8')}\n;globalThis.__discovery = BenetripDiscovery;`, contexto);
    return contexto.__discovery;
}

const D = carregarDiscovery();

function comDatasPedidas(ida, volta) {
    return { ...D, state: { ...D.state, formData: { ...D.state.formData, dataIda: ida, dataVolta: volta } } };
}

// ============================================================
// DATAS — as do viajante são as únicas que aparecem
//
// O provedor devolve as datas da tarifa, mas elas NÃO vão para o card:
// um segundo par de datas ao lado do destino é lido como o período da
// viagem e leva a comprar no dia errado. Quando a tarifa vem de outros
// dias, o que fica em dúvida é o preço, e é só disso que o aviso trata.
// ============================================================
test('card nunca exibe as datas devolvidas pelo provedor', () => {
    const ui = comDatasPedidas('2026-03-15', '2026-03-22');
    const html = ui.avisoPrecoOutrasDatasHtml.call(ui, { outbound_date: '2026-03-17', return_date: '2026-03-24' });
    for (const marca of ['17', '24', 'mar', '2026-03-17', '2026-03-24']) {
        assert.ok(!html.includes(marca), `data da tarifa vazou para o card: ${marca}`);
    }
});

test('tarifa nas datas pedidas não gera aviso nenhum', () => {
    const ui = comDatasPedidas('2026-03-15', '2026-03-22');
    assert.equal(ui.avisoPrecoOutrasDatasHtml.call(ui, { outbound_date: '2026-03-15', return_date: '2026-03-22' }), '');
});

test('tarifa de outros dias marca o preço como aproximado', () => {
    const ui = comDatasPedidas('2026-03-15', '2026-03-22');
    const soIda = ui.avisoPrecoOutrasDatasHtml.call(ui, { outbound_date: '2026-03-17', return_date: '2026-03-22' });
    const soVolta = ui.avisoPrecoOutrasDatasHtml.call(ui, { outbound_date: '2026-03-15', return_date: '2026-03-24' });
    for (const html of [soIda, soVolta]) {
        assert.match(html, /Preço aproximado/);
        assert.match(html, /destino-preco-aviso/);
    }
});

test('destino sem datas do provedor não gera aviso', () => {
    const ui = comDatasPedidas('2026-03-15', '2026-03-22');
    assert.equal(ui.avisoPrecoOutrasDatasHtml.call(ui, { outbound_date: null, return_date: null }), '');
    assert.equal(ui.avisoPrecoOutrasDatasHtml.call(ui, {}), '');
});

test('sem datas no formulário não se inventa divergência', () => {
    const ui = comDatasPedidas(null, null);
    assert.equal(ui.avisoPrecoOutrasDatasHtml.call(ui, { outbound_date: '2026-03-17', return_date: '2026-03-24' }), '');
});

// ============================================================
// FOTO — URL do provedor é texto não confiável
// ============================================================
test('foto do provedor entra no card', () => {
    const html = D.imagemHtml({ image: 'https://cdn.exemplo.com/lisboa.jpg', name: 'Lisboa', country: 'Portugal' }, 'top');
    assert.match(html, /src="https:\/\/cdn\.exemplo\.com\/lisboa\.jpg"/);
    assert.match(html, /alt="Lisboa, Portugal"/);
    assert.match(html, /loading="lazy"/);
});

test('destino sem foto cai no avatar da Tripinha', () => {
    const html = D.imagemHtml({ image: '', name: 'Recife', country: 'Brasil' }, 'alternativa');
    assert.match(html, /avatar-pensando\.png/);
    assert.match(html, /destino-imagem-fallback/);
});

test('URL com esquema perigoso nunca chega ao src', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html;base64,PHN2Zz4=', 'http://inseguro.exemplo/x.jpg']) {
        const html = D.imagemHtml({ image: url, name: 'X', country: 'Y' }, 'top');
        assert.ok(!html.includes(url), `esquema não confiável vazou no src: ${url}`);
        assert.match(html, /avatar-pensando\.png/);
    }
});

test('nome do destino é escapado no alt', () => {
    const html = D.imagemHtml({ image: '', name: '"><script>alert(1)</script>', country: '' }, 'top');
    assert.ok(!html.includes('<script>'), 'nome do provedor não pode fechar o atributo');
});

// ============================================================
// COMPANHIA — rótulo fala da cotação, não do itinerário inteiro
// ============================================================
test('companhia da tarifa aparece rotulada como cotação', () => {
    const html = D.ciaHtml({ flight: { airline_name: 'TAP Air Portugal' } });
    assert.match(html, /Cotação com TAP Air Portugal/);
});

test('sem companhia informada o bloco some', () => {
    assert.equal(D.ciaHtml({ flight: { airline_name: '' } }), '');
    assert.equal(D.ciaHtml({ flight: {} }), '');
    assert.equal(D.ciaHtml({}), '');
});

test('nome de companhia é escapado', () => {
    const html = D.ciaHtml({ flight: { airline_name: '<img src=x onerror=alert(1)>' } });
    assert.ok(!html.includes('<img'), 'nome do provedor não pode virar tag');
});
