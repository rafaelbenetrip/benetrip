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

const compartilhado = fileURLToPath(new URL('../public/assets/js/benetrip-shared-ui.js', import.meta.url));

function carregarDiscovery() {
    // A página carrega benetrip-shared-ui.js ANTES de descobrir-destinos.js,
    // então em produção window.BenetripSafe existe e é ele quem escapa e
    // filtra URLs. Sem carregá-lo aqui, os testes exercitariam só o fallback
    // interno — justamente o caminho que o navegador não usa.
    const contexto = {
        window: {},
        document: { addEventListener() {} },
        URL,
        console,
    };
    contexto.window.document = contexto.document;
    vm.createContext(contexto);
    vm.runInContext(readFileSync(compartilhado, 'utf-8'), contexto);
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
// FOTO — URL do provedor é texto não confiável, e o CONTEÚDO também
//
// A miniatura vem do provedor de destinos e ninguém confere o que ela
// mostra: já saiu foto de praia num card de Belo Horizonte. O card pode
// ilustrar; não pode afirmar que a foto retrata o lugar.
// ============================================================
test('foto do provedor entra no card', () => {
    const html = D.imagemHtml({ image: 'https://cdn.exemplo.com/lisboa.jpg', name: 'Lisboa', country: 'Portugal' }, 'top');
    assert.match(html, /src="https:\/\/cdn\.exemplo\.com\/lisboa\.jpg"/);
    assert.match(html, /loading="lazy"/);
});

test('a foto é apresentada como ilustração, não como registro do destino', () => {
    const html = D.imagemHtml({ image: 'https://cdn.exemplo.com/bh.jpg', name: 'Belo Horizonte', country: 'Brasil' }, 'top');
    assert.match(html, /alt="Imagem ilustrativa de Belo Horizonte, Brasil"/);
    assert.match(html, /destino-imagem-legenda">Foto ilustrativa</);
});

test('sem foto de terceiro não há o que ressalvar', () => {
    const html = D.imagemHtml({ image: '', name: 'Recife', country: 'Brasil' }, 'top');
    assert.ok(!html.includes('destino-imagem-legenda'), 'o avatar da Tripinha não é foto ilustrativa de lugar');
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
// ONDE FICA — o nome não identifica lugar nenhum
//
// "São Petersburgo, Estados Unidos" com aeroporto TPA é St. Petersburg, na
// Flórida, atendida pelo aeroporto de Tampa. O card não consegue explicar
// cada caso em texto; consegue entregar a coordenada que o provedor já
// devolveu.
// ============================================================
test('coordenada do provedor vira link de mapa', () => {
    const html = D.mapaHtml({
        name: 'São Petersburgo', country: 'Estados Unidos',
        coordinates: { latitude: 27.7676, longitude: -82.6403 },
    });
    assert.match(html, /27\.7676%2C-82\.6403/);
    assert.match(html, /Ver no mapa onde fica/);
    assert.match(html, /rel="noopener nofollow"/);
});

test('sem coordenada o link é busca por nome, e o rótulo diz isso', () => {
    const html = D.mapaHtml({ name: 'Lisboa', country: 'Portugal' });
    assert.match(html, /Procurar no mapa/);
    assert.match(html, /Lisboa\+Portugal|Lisboa%20Portugal/);
});

test('coordenada em array não é adivinhada', () => {
    // [lat,lon] e [lon,lat] são indistinguíveis: o link cairia no oceano.
    const html = D.mapaHtml({ name: 'Belo Horizonte', country: 'Brasil', coordinates: [-19.92, -43.94] });
    assert.match(html, /Procurar no mapa/);
    assert.ok(!html.includes('19.92'), 'array não pode virar coordenada no link');
});

test('destino sem nome nem coordenada não ganha link vazio', () => {
    assert.equal(D.mapaHtml({}), '');
});

// ============================================================
// AEROPORTO EM OUTRO PAÍS
// ============================================================
test('voo que pousa em outro país avisa no card', () => {
    const html = D.aeroportoOutroPaisHtml({
        name: 'Puerto Iguazú',
        _identidade: { aeroporto: 'IGU', paisAeroporto: 'Brasil', aeroportoEmOutroPais: true },
    });
    assert.match(html, /IGU/);
    assert.match(html, /Brasil/);
    assert.match(html, /não está no preço/);
});

test('aeroporto no mesmo país, ou não verificado, não gera aviso', () => {
    assert.equal(D.aeroportoOutroPaisHtml({ name: 'X', _identidade: { aeroportoEmOutroPais: false, paisAeroporto: 'Brasil' } }), '');
    assert.equal(D.aeroportoOutroPaisHtml({ name: 'X', _identidade: { aeroportoEmOutroPais: null, paisAeroporto: null } }), '');
    assert.equal(D.aeroportoOutroPaisHtml({ name: 'X' }), '');
});

// ============================================================
// TRECHO AÉREO — a frase aparece uma vez só
//
// A disclosure de aeroporto já abre com "Voo direto até PUJ". Uma linha
// separada com o mesmo texto era a duplicata visível no card.
// ============================================================
const voo = { name: 'Punta Cana', primary_airport: 'PUJ', flight: { stops: 0, flight_duration_minutes: 425 } };

test('trecho aéreo não é repetido quando há aeroporto', () => {
    const html = D.vooHtml(voo, 1);
    const ocorrencias = html.split('Voo direto até PUJ').length - 1;
    assert.equal(ocorrencias, 1, 'o trecho apareceu mais de uma vez no card');
});

test('duração acompanha o trecho sem repeti-lo', () => {
    const html = D.vooHtml(voo, 1);
    assert.match(html, /7h05 de voo/);
    assert.match(html, /airport-disclosure/);
});

test('sem aeroporto o trecho ganha linha própria', () => {
    const html = D.vooHtml({ name: 'X', flight: { stops: 2, flight_duration_minutes: 180 } }, 0);
    assert.match(html, /Voo com 2 paradas/);
    assert.match(html, /3h00 de voo/);
    assert.ok(!html.includes('airport-disclosure'));
});

test('voo sem duração informada não inventa tempo', () => {
    assert.equal(D.duracaoVooTxt({ flight: {} }), '');
    const html = D.vooHtml({ name: 'X', flight: { stops: 0 } }, 0);
    assert.ok(!html.includes('de voo'));
});

// ============================================================
// ÉPOCA — a ressalva não se funde ao texto
// ============================================================
test('texto sem verificação leva ressalva em linha própria', () => {
    const ui = { ...D, state: { ...D.state, sazonalidade: null } };
    const html = ui.gerarBlocoSazonalidade.call(ui, {
        name: 'Buenos Aires',
        adequacao_epoca: 'Em outubro a cidade costuma ter temperaturas amenas.',
    });
    assert.match(html, /Em outubro a cidade costuma ter temperaturas amenas\./);
    assert.match(html, /<span class="epoca-rodape">/);
    // O texto e a ressalva não podem sair na mesma frase corrida
    assert.ok(!/verificada Em outubro/.test(html), 'ressalva colou no texto');
});

test('frase descartada pela guarda do servidor não deixa o card mudo', () => {
    const ui = { ...D, state: { ...D.state, sazonalidade: null } };
    const html = ui.gerarBlocoSazonalidade.call(ui, {
        name: 'Santiago',
        adequacao_epoca: '',
        adequacao_epoca_substituta: 'As condições variam conforme o período.',
    });
    assert.match(html, /As condições variam conforme o período\./);
});

test('sem nada sobre a época o bloco fica vazio, não inventa texto', () => {
    const ui = { ...D, state: { ...D.state, sazonalidade: null } };
    const html = ui.gerarBlocoSazonalidade.call(ui, { name: 'X' });
    assert.match(html, /destino-epoca-slot/);
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
