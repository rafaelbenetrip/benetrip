// Renderização de ponta a ponta da página /escapadas.
//
// Este arquivo existe por causa de uma queda real em produção: o parâmetro de
// renderItemListJsonLd foi renomeado de `destinos` para `recomendados` e o
// corpo da função continuou lendo `destinos`. O ReferenceError só acontecia
// quando havia destino recomendado (o bloco JSON-LD é condicional), então
// nenhum teste de unidade pegou e a página inteira caiu com
// FUNCTION_INVOCATION_FAILED.
//
// A defesa é chamar o handler de verdade, com dados de verdade, e conferir o
// HTML resultante. Supabase é substituído por um stub de fetch.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.local';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'stub-anon-key';

const { janelasAtivas, hojeISO } = await import('../api/_lib/escapadas-shared.js');

const HOJE = hojeISO();
const JANELAS = janelasAtivas(HOJE);

function destino(nome, aeroporto, preco, viabilidade, janela) {
    return {
        nome,
        pais: 'Brasil',
        aeroporto,
        preco,
        moeda: 'BRL',
        duracao_voo_minutos: viabilidade.duracao,
        paradas: viabilidade.paradas,
        data_ida: janela.ida,
        data_volta: janela.volta,
        viabilidade: viabilidade.avaliacao,
    };
}

// Duas tarifas que cabem na janela e uma que não cabe: exercita a lista
// principal, a contagem, o JSON-LD e a seção fechada de uma vez só.
function linhasComDestinos() {
    return JANELAS.map((j) => ({
        origem: 'GRU',
        tipo: j.id,
        data: HOJE,
        destinos: [
            destino('Florianópolis', 'FLN', 480, {
                duracao: 70,
                paradas: 0,
                avaliacao: { nivel: 'boa', recomendavel: true, motivos: [] },
            }, j),
            destino('Salvador', 'SSA', 690, {
                duracao: 150,
                paradas: 1,
                avaliacao: { nivel: 'aceitavel', recomendavel: true, motivos: [] },
            }, j),
            destino('Lisboa', 'LIS', 3200, {
                duracao: 620,
                paradas: 1,
                avaliacao: {
                    nivel: 'inviavel',
                    recomendavel: false,
                    motivos: ['voo de 10h20 por trecho para uma janela de 2 noites'],
                },
            }, j),
        ],
    }));
}

let fetchOriginal;
let linhasAtuais = [];

before(() => {
    fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => linhasAtuais,
        text: async () => '',
    });
});

after(() => {
    globalThis.fetch = fetchOriginal;
});

async function render(query = {}) {
    const { default: handler } = await import('../api/escapadas-page.js');
    const res = {
        status_: 200,
        headers: {},
        body: '',
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
        status(c) { this.status_ = c; return this; },
        send(b) { this.body = String(b); return this; },
        end(b) { if (b !== undefined) this.body = String(b); return this; },
    };
    await handler({ method: 'GET', query, headers: {}, url: '/escapadas' }, res);
    return res;
}

// ============================================================
// A PÁGINA RENDERIZA
// ============================================================
test('página com destinos renderiza 200 e HTML completo', async () => {
    linhasAtuais = linhasComDestinos();
    const res = await render();

    assert.equal(res.status_, 200, `esperava 200, veio ${res.status_}: ${res.body.slice(0, 300)}`);
    assert.ok(res.body.startsWith('<!DOCTYPE html>'));
    assert.ok(res.body.trimEnd().endsWith('</html>'), 'HTML deve terminar fechado');
    assert.match(res.headers['content-type'], /text\/html/);
});

test('cada cidade das 30 renderiza sem estourar', async () => {
    linhasAtuais = linhasComDestinos();
    for (const slug of ['rio-de-janeiro', 'belo-horizonte', 'porto-alegre', 'recife']) {
        const res = await render({ cidade: slug });
        assert.equal(res.status_, 200, `${slug} devolveu ${res.status_}`);
    }
});

test('cada janela ativa renderiza sem estourar (fds e feriado)', async () => {
    linhasAtuais = linhasComDestinos();
    for (const janela of JANELAS) {
        const res = await render({ janela: janela.id });
        assert.equal(res.status_, 200, `janela ${janela.id} devolveu ${res.status_}`);
        assert.ok(res.body.includes('Florian'), `janela ${janela.id} perdeu os destinos`);
    }
});

test('página sem nenhum snapshot ainda renderiza 200 com estado vazio', async () => {
    linhasAtuais = [];
    const res = await render();

    assert.equal(res.status_, 200);
    assert.ok(res.body.includes('Ainda sem preços para esta janela'));
});

// ============================================================
// JSON-LD (onde estava o bug)
// ============================================================
test('o ItemList do JSON-LD conta e lista só os destinos recomendados', async () => {
    linhasAtuais = linhasComDestinos();
    const res = await render();

    const bloco = /<script type="application\/ld\+json">(\{\\u0022@context[^<]*ItemList[^<]*)<\/script>/.exec(res.body)
        || /<script type="application\/ld\+json">([^<]*ItemList[^<]*)<\/script>/.exec(res.body);
    assert.ok(bloco, 'a página com destinos deve emitir o JSON-LD de ItemList');

    const json = JSON.parse(bloco[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'));
    assert.equal(json['@type'], 'ItemList');
    // Lisboa é inviável para a janela: fica fora do JSON-LD e da contagem.
    assert.equal(json.numberOfItems, 2);
    assert.equal(json.itemListElement.length, 2);
    const nomes = json.itemListElement.map((i) => i.item.name).join(' ');
    assert.ok(nomes.includes('Florian'));
    assert.ok(!nomes.includes('Lisboa'), 'destino inviável não pode entrar no ItemList');
});

// ============================================================
// SEPARAÇÃO ENTRE RECOMENDADOS E NÃO RECOMENDADOS NA PÁGINA
// ============================================================
test('destino inviável sai da contagem principal e aparece na seção fechada', async () => {
    linhasAtuais = linhasComDestinos();
    const res = await render();

    assert.ok(res.body.includes('>2 destinos'), 'a contagem principal deve ignorar o inviável');
    assert.ok(res.body.includes('1 fora'));
    assert.ok(res.body.includes('nao-recomendados-section'));
    assert.ok(res.body.includes('Lisboa'), 'o inviável continua visível na seção fechada');
    assert.ok(res.body.includes('Voo de 10h20 por trecho'), 'o motivo da exclusão deve ser exibido');
});

test('sem nenhum destino inviável a seção fechada não é renderizada', async () => {
    linhasAtuais = JANELAS.map((j) => ({
        origem: 'GRU',
        tipo: j.id,
        data: HOJE,
        destinos: [
            destino('Florianópolis', 'FLN', 480, {
                duracao: 70,
                paradas: 0,
                avaliacao: { nivel: 'boa', recomendavel: true, motivos: [] },
            }, j),
        ],
    }));
    const res = await render();

    assert.equal(res.status_, 200);
    assert.ok(!res.body.includes('nao-recomendados-section'));
});

// ============================================================
// DADOS EMBUTIDOS PARA O CLIENTE
// ============================================================
test('__ESCAPADAS_INITIAL__ é JSON válido com todas as janelas', async () => {
    linhasAtuais = linhasComDestinos();
    const res = await render();

    const bloco = /<script id="escapadas-initial-data" type="application\/json">([\s\S]*?)<\/script>/.exec(res.body);
    assert.ok(bloco, 'os dados iniciais devem estar embutidos na página');

    const dados = JSON.parse(bloco[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'));
    assert.equal(dados.origemAtual, 'GRU');
    assert.equal(dados.janelas.length, JANELAS.length);
    assert.ok(dados.janelas.every((j) => j.destinos.length === 3), 'a hidratação recebe a lista completa');
});

// ============================================================
// ERROS
// ============================================================
test('cidade inexistente devolve 404, não 500', async () => {
    linhasAtuais = linhasComDestinos();
    const res = await render({ cidade: 'cidade-que-nao-existe' });

    assert.equal(res.status_, 404);
    assert.ok(res.body.includes('Cidade não encontrada'));
});

test('falha do Supabase vira página de erro 500, não crash da function', async () => {
    const anterior = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => 'indisponível' });
    try {
        const res = await render();
        assert.equal(res.status_, 500);
        assert.ok(res.body.includes('Erro ao buscar escapadas'));
    } finally {
        globalThis.fetch = anterior;
    }
});
