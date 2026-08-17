// O filtro de destinos contra o texto livre (Descobrir Destinos)
//
// "Apenas nacionais" é filtro rígido aplicado na busca; "quero ir aos EUA" é
// texto livre, que só pesa no ranqueador. Quando os dois se contradizem o
// texto perde sempre — e perdia calado: a pessoa recebia destinos brasileiros
// sem nada dizer que a própria resposta dela, dois campos acima, tinha
// anulado o pedido.
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

const CIDADES = [
    { cidade: 'São Paulo', pais: 'Brasil' },
    { cidade: 'Miami', pais: 'Estados Unidos' },
    { cidade: 'Lisboa', pais: 'Portugal' },
    { cidade: 'Santiago', pais: 'Chile' },
    { cidade: 'Londres', pais: 'Reino Unido' },
];

function detectar(escopoDestino, observacoes, paisOrigem = 'Brasil') {
    D.state.cidadesData = CIDADES;
    D.state.paisesConhecidos = null;
    D.state.formData = { escopoDestino, observacoes, origem: { country: paisOrigem } };
    return D.detectarContradicaoEscopo();
}

test('"apenas nacionais" + pedido de país estrangeiro é contradição', () => {
    const c = detectar('nacional', 'Quero muito ir para os EUA');
    assert.ok(c, 'contradição não detectada');
    assert.equal(c.tipo, 'nacional');
    assert.deepEqual([...c.paises], ['Estados Unidos']);
});

test('"apenas internacionais" + pedido do próprio país é contradição', () => {
    const c = detectar('internacional', 'Queria conhecer o Brasil de norte a sul');
    assert.ok(c);
    assert.equal(c.tipo, 'internacional');
    assert.deepEqual([...c.paises], ['Brasil']);
});

test('"tanto faz" nunca contradiz nada', () => {
    assert.equal(detectar('tanto_faz', 'Quero muito ir para os EUA'), null);
});

test('escopo nacional com pedido do próprio país não é contradição', () => {
    assert.equal(detectar('nacional', 'Quero conhecer o Brasil'), null);
});

test('escopo internacional com pedido de país estrangeiro não é contradição', () => {
    assert.equal(detectar('internacional', 'Quero muito ir para os EUA'), null);
});

test('recusar um país não é pedir para ir nele', () => {
    assert.equal(detectar('nacional', 'Não quero ir para os EUA'), null);
});

test('texto sem país nenhum não dispara aviso', () => {
    assert.equal(detectar('nacional', 'Quero praias calmas e comida de rua'), null);
});

test('texto vazio não dispara aviso', () => {
    assert.equal(detectar('nacional', ''), null);
});

test('"gastar menos" continua não virando pedido de lugar', () => {
    assert.equal(detectar('nacional', 'Quero gastar menos possível'), null);
});

test('mais de um país estrangeiro é relatado inteiro', () => {
    const c = detectar('nacional', 'Quero conhecer Portugal, e queria muito o Chile também');
    assert.ok(c);
    assert.deepEqual([...c.paises].sort(), ['Chile', 'Portugal']);
});

test('origem sem país não quebra a detecção', () => {
    const c = detectar('nacional', 'Quero muito ir para os EUA', '');
    assert.ok(c, 'sem país de origem, todo país citado é estrangeiro');
    assert.deepEqual([...c.paises], ['Estados Unidos']);
});

test('o apelido do país também dispara o aviso', () => {
    assert.ok(detectar('nacional', 'quero ir pra Inglaterra'));
});
