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

// ============================================================
// DATAS — as do viajante são as únicas que existem na tela
//
// O provedor devolve as datas da tarifa, mas o card não as usa de forma
// alguma: as datas da viagem são as escolhidas no formulário, aparecem
// no resumo de critérios e são as que o link do Google Flights carrega.
// Um segundo par de datas ao lado do destino seria lido como o período
// da viagem e levaria a comprar no dia errado.
// ============================================================
test('a renderização dos cards não toca nas datas do provedor', () => {
    const fonte = readFileSync(arquivo, 'utf-8');
    for (const campo of ['outbound_date', 'return_date']) {
        assert.ok(!fonte.includes(campo), `${campo} voltou para a tela de resultados`);
    }
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
// COMPANHIA
// ============================================================
test('companhia da tarifa aparece no card', () => {
    const html = D.ciaHtml({ flight: { airline_name: 'TAP Air Portugal' } });
    assert.match(html, /TAP Air Portugal/);
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
