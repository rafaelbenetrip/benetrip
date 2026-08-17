// Pedido de país/cidade em texto livre (trava determinística)
//
// O critério do prompt pede que a IA respeite "quero os EUA, menos Miami".
// Prompt não garante nada, e este módulo é a garantia: interpreta o pedido e
// aplica sobre a escolha já feita, como a trava de escalas para família.
//
// O viés destes testes é deliberado: uma exclusão errada TIRA da tela uma
// opção válida, então há tanto teste de "não confundir" quanto de "atender".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    interpretarPedido,
    aplicarPedido,
    pedidoVazio,
    destinoExcluido,
    destinoDesejado,
} from '../api/_lib/destination-requests.js';

const d = (name, country, price = 2000, stops = 0) => ({
    name, country,
    flight: { price, stops, flight_duration_minutes: 300 },
});

const POOL = [
    d('Nova York', 'Estados Unidos', 3900),
    d('Orlando', 'Estados Unidos', 3400, 1),
    d('Miami', 'Estados Unidos', 3100),
    d('Lisboa', 'Portugal', 2900, 1),
    d('Santiago', 'Chile', 2400),
];

const PAISES = ['Estados Unidos', 'Portugal', 'Chile', 'Brasil', 'Argentina', 'Reino Unido', 'Países Baixos'];
const ler = (texto, destinos = POOL) =>
    interpretarPedido(texto, { destinos, paisesConhecidos: PAISES });

// ============================================================
// LEITURA DO PEDIDO
// ============================================================

test('"quero os EUA, mas não Miami" separa o desejo da exclusão', () => {
    const p = ler('Quero ir para os EUA, mas não Miami.');
    assert.deepEqual(p.paisesDesejados, ['estados unidos']);
    assert.deepEqual(p.cidadesExcluidas, ['miami']);
});

test('o apelido do país é reconhecido tanto quanto o nome oficial', () => {
    for (const texto of ['quero ir aos EUA', 'quero ir para os Estados Unidos', 'quero conhecer os estados unidos']) {
        assert.deepEqual(ler(texto).paisesDesejados, ['estados unidos'], texto);
    }
});

test('país inteiro pode ser excluído, não só cidade', () => {
    const p = ler('Qualquer lugar, exceto Portugal');
    assert.deepEqual(p.paisesExcluidos, ['portugal']);
});

test('a exclusão vence quando o mesmo nome aparece dos dois jeitos', () => {
    const p = ler('Quero muito Miami, mas na verdade não Miami');
    assert.deepEqual(p.cidadesExcluidas, ['miami']);
    assert.deepEqual(p.cidadesDesejadas, []);
});

test('várias formas de dizer "não quero" são entendidas', () => {
    for (const texto of [
        'quero praia, exceto Miami',
        'quero praia, menos Miami',
        'quero praia, mas não Miami',
        'quero praia, nada de Miami',
        'quero praia, tirando Miami',
        'quero praia, evitar Miami',
        'quero praia sem passar por Miami',
    ]) {
        assert.deepEqual(ler(texto).cidadesExcluidas, ['miami'], texto);
    }
});

// ── precisão: o que NÃO pode virar pedido ──

test('"gastar menos" não exclui o país citado depois', () => {
    const p = ler('Quero gastar menos indo para o Chile');
    assert.deepEqual(p.paisesExcluidos, [], 'exclusão falsa do Chile');
});

test('negação distante não alcança o nome', () => {
    const p = ler('não quero gastar muito dinheiro indo para o Chile');
    assert.deepEqual(p.paisesExcluidos, []);
});

test('"não quero ir para X" não vira vontade de ir para X', () => {
    const p = ler('Não quero ir para os EUA');
    assert.deepEqual(p.paisesDesejados, [], 'leu como desejo o oposto do que foi escrito');
});

test('a vontade negada fica neutra, não vira exclusão', () => {
    // "não quero ir para os EUA" e "não quero gastar muito indo para o Chile"
    // têm a mesma cara para uma regex e significam coisas opostas: diante das
    // duas leituras, não agir é a única que não erra feio
    const p = ler('Não quero gastar muito dinheiro indo para o Chile');
    assert.deepEqual(p.paisesExcluidos, [], 'excluiu o Chile de quem quer ir ao Chile');
    assert.deepEqual(p.paisesDesejados, []);
});

test('nome citado sem pista nenhuma é ignorado', () => {
    const p = ler('Já fui para Miami em 2019');
    assert.ok(pedidoVazio(p), JSON.stringify(p));
});

test('texto sem lugar nenhum não vira pedido', () => {
    assert.ok(pedidoVazio(ler('Quero praias calmas, comida de rua e nada de frio')));
});

test('pista de outra frase não atravessa a pontuação', () => {
    const p = ler('Quero ir para o Chile. Não quero frio');
    assert.deepEqual(p.paisesDesejados, ['chile']);
    assert.deepEqual(p.paisesExcluidos, []);
});

test('nome curto demais não é procurado no texto', () => {
    const p = interpretarPedido('quero ir para o rio', {
        destinos: [d('Rio', 'Brasil')],
        paisesConhecidos: PAISES,
    });
    assert.deepEqual(p.cidadesDesejadas, []);
});

test('pedaço de palavra não conta como nome', () => {
    const p = ler('quero um lugar com clima chileno-ish', [d('Santiago', 'Chile')]);
    assert.deepEqual(p.paisesDesejados, []);
});

// ============================================================
// APLICAÇÃO SOBRE O RESULTADO DA IA
// ============================================================

const resultado = (topIdx, altIdxs = [], surpresaIdx = null) => ({
    top_destino: { ...POOL[topIdx], razao: 'ia', comentario: 'c' },
    alternativas: altIdxs.map(i => ({ ...POOL[i], razao: 'ia', comentario: 'c' })),
    surpresa: surpresaIdx === null ? null : { ...POOL[surpresaIdx], razao: 'ia', comentario: 'c' },
});

test('o destino excluído não fica no topo', () => {
    const r = resultado(2, [0, 1, 3]);
    const rel = aplicarPedido(r, POOL, ler('Quero os EUA, mas não Miami'));
    assert.notEqual(r.top_destino.name, 'Miami');
    assert.ok(rel.removidos.includes('Miami'));
});

test('o destino excluído também não sobra nas alternativas nem na surpresa', () => {
    const r = resultado(0, [2, 3], 2);
    aplicarPedido(r, POOL, ler('Quero os EUA, mas não Miami'));
    const nomes = [r.top_destino, ...r.alternativas, r.surpresa].filter(Boolean).map(x => x.name);
    assert.ok(!nomes.includes('Miami'), `Miami ficou: ${nomes.join(', ')}`);
});

test('a vaga aberta é reposta por outro destino da busca', () => {
    const r = resultado(0, [2, 3]);
    aplicarPedido(r, POOL, ler('Quero os EUA, mas não Miami'));
    assert.equal(r.alternativas.length, 2, 'a lista encolheu em vez de repor');
    assert.ok(r.alternativas.some(a => a.name === 'Orlando'));
});

test('o país pedido ganha o topo quando a IA escolheu outro', () => {
    const r = resultado(4, [0, 1, 3]);
    const rel = aplicarPedido(r, POOL, ler('Quero muito conhecer os EUA'));
    assert.equal(r.top_destino.country, 'Estados Unidos');
    assert.equal(rel.promovido, r.top_destino.name);
});

test('o antigo topo é rebaixado, não descartado', () => {
    const r = resultado(4, [0, 1, 3]);
    aplicarPedido(r, POOL, ler('Quero muito conhecer os EUA'));
    assert.ok(r.alternativas.some(a => a.name === 'Santiago'), 'Santiago sumiu da tela');
});

test('a IA que já acertou não é mexida', () => {
    const r = resultado(1, [0, 3, 4]);
    const rel = aplicarPedido(r, POOL, ler('Quero os EUA, mas não Miami'));
    assert.equal(r.top_destino.name, 'Orlando');
    assert.equal(rel.promovido, null);
});

test('pedido que a busca não alcança é relatado, não forçado', () => {
    const semEUA = [d('Lisboa', 'Portugal', 2900), d('Santiago', 'Chile', 2400)];
    const r = { top_destino: { ...semEUA[0] }, alternativas: [{ ...semEUA[1] }], surpresa: null };
    const rel = aplicarPedido(r, semEUA, ler('Quero ir aos EUA', semEUA));
    assert.deepEqual(rel.paisesSemDestino, ['estados unidos']);
    assert.equal(rel.ajustado, false);
    assert.equal(r.top_destino.name, 'Lisboa', 'mexeu num resultado que não tinha como corrigir');
});

test('nunca esvazia a tela: sem reposição, o topo continua de pé', () => {
    const soMiami = [d('Miami', 'Estados Unidos', 3100)];
    const r = { top_destino: { ...soMiami[0] }, alternativas: [], surpresa: null };
    aplicarPedido(r, soMiami, ler('Não quero Miami', soMiami));
    assert.ok(r.top_destino, 'ficou sem destino nenhum');
    assert.equal(r.top_destino.name, 'Miami');
});

test('a trava de família tem a palavra final sobre o pedido', () => {
    // Nova York é dos EUA mas está barrada; a promoção precisa respeitar isso
    const r = resultado(4, [3]);
    aplicarPedido(r, POOL, ler('Quero ir aos EUA'), {
        permitido: (dest) => dest.name !== 'Nova York',
    });
    assert.notEqual(r.top_destino.name, 'Nova York');
    assert.equal(r.top_destino.country, 'Estados Unidos', 'devia promover outro destino dos EUA');
});

test('texto sem pedido não mexe em nada', () => {
    const r = resultado(2, [0, 1]);
    const antes = JSON.stringify(r);
    const rel = aplicarPedido(r, POOL, ler('Quero praias calmas'));
    assert.equal(rel.ajustado, false);
    assert.equal(JSON.stringify(r), antes);
});

// ============================================================
// PREDICADOS
// ============================================================

test('destinoExcluido e destinoDesejado leem país e cidade', () => {
    const p = ler('Quero os EUA, mas não Miami');
    assert.equal(destinoExcluido(d('Miami', 'Estados Unidos'), p), true);
    assert.equal(destinoExcluido(d('Orlando', 'Estados Unidos'), p), false);
    assert.equal(destinoDesejado(d('Orlando', 'Estados Unidos'), p), true);
    assert.equal(destinoDesejado(d('Santiago', 'Chile'), p), false);
});
