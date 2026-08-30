// O selo "Curadoria da Tripinha" e o modelo de reserva da cascata
//
// Dois acoplamentos frouxos deixaram a Descoberta afirmando coisas que não
// sustentava, e nenhum dos dois aparecia em teste:
//
// 1. O selo comparava o marcador de fallback com a string 'fallback_price',
//    que a API deixou de emitir quando o fallback virou 'fallback_quality'.
//    Resultado: o selo apareceu em toda busca, inclusive nas semanas em que
//    a cota da Cerebras estava estourada e nenhum modelo rodou.
// 2. O modelo de reserva da cascata (`zai-glm-4.7`) foi arquivado pelo
//    provedor e respondia 404. A cascata tinha dois nomes e uma chance só.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const paginaJs = fileURLToPath(new URL('../public/assets/js/descobrir-destinos.js', import.meta.url));
const compartilhado = fileURLToPath(new URL('../public/assets/js/benetrip-shared-ui.js', import.meta.url));
const rankApi = fileURLToPath(new URL('../api/rank-destinations.js', import.meta.url));

function carregarDiscovery() {
    const contexto = { window: {}, document: { addEventListener() {} }, URL, console };
    contexto.window.document = contexto.document;
    vm.createContext(contexto);
    vm.runInContext(readFileSync(compartilhado, 'utf-8'), contexto);
    vm.runInContext(`${readFileSync(paginaJs, 'utf-8')}\n;globalThis.__discovery = BenetripDiscovery;`, contexto);
    return contexto.__discovery;
}

const D = carregarDiscovery();

// ============================================================
// O SELO SÓ APARECE QUANDO A IA RANQUEOU
// ============================================================
test('o selo de curadoria não aparece quando um modelo de verdade não rodou', () => {
    for (const marcador of ['fallback_quality', 'fallback_price', 'fallback', null, undefined, '']) {
        assert.equal(D.houveCuradoria(marcador), false,
            `o selo apareceria com _model = ${JSON.stringify(marcador)}`);
    }
});

test('o selo aparece quando um modelo ranqueou', () => {
    for (const modelo of ['gpt-oss-120b', 'gemma-4-31b']) {
        assert.equal(D.houveCuradoria(modelo), true, `o selo sumiu com _model = ${modelo}`);
    }
});

// ============================================================
// O TESTE QUE TERIA PEGO A REGRESSÃO
//
// Não basta testar os marcadores que conhecemos hoje: o bug nasceu quando a
// API trocou o nome do seu e a tela ficou comparando com o antigo. Aqui os
// marcadores saem do CÓDIGO da API, então renomear um sem ensinar a tela a
// reconhecê-lo quebra o teste.
// ============================================================
test('todo marcador de fallback emitido pela API é reconhecido pela tela', () => {
    const fonte = readFileSync(rankApi, 'utf-8');
    const marcadores = [...fonte.matchAll(/_model:\s*'([^']+)'/g)].map(m => m[1]);

    assert.ok(marcadores.length > 0, 'nenhum marcador literal encontrado em rank-destinations.js');
    for (const marcador of marcadores) {
        assert.equal(D.houveCuradoria(marcador), false,
            `a API emite _model = '${marcador}' sem IA, mas a tela exibiria o selo de curadoria`);
    }
});

// ============================================================
// A CASCATA PRECISA DE DOIS MODELOS DIFERENTES E VIVOS
// ============================================================
test('nenhum arquivo ainda aponta para o modelo arquivado', () => {
    const arquivos = [
        '../api/rank-destinations.js',
        '../api/_lib/tripinha-shared.js',
        '../api/_lib/seasonality.js',
        '../api/cron/update-discovery.js',
        '../api/discovery-smart-filter.js',
        '../api/vai-e-vem.js',
        '../api/generate-itinerary.js',
        '../api/itinerary-generator.js',
        '../api/recommendations.js',
    ];
    for (const rel of arquivos) {
        const fonte = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8');
        const codigo = fonte
            .split('\n')
            .filter(l => !l.trim().startsWith('//'))
            .join('\n');
        assert.ok(!codigo.includes('zai-glm'),
            `${rel} ainda usa zai-glm, arquivado pelo provedor (HTTP 404)`);
    }
});

test('o thinking fica desligado no modelo de reserva, não no principal', () => {
    const fonte = readFileSync(rankApi, 'utf-8');
    assert.match(fonte, /reasoning_effort: model === MODELO_FALLBACK \? 'none' : 'low'/,
        'o modelo de reserva é o mais caro por token: ele não pode raciocinar');
});

// ============================================================
// A QUEDA PARA O DETERMINÍSTICO PRECISA DIZER POR QUÊ
//
// Foi a ausência disso que deixou uma cota estourada passar despercebida:
// a resposta vinha com _model preenchido e nada indicava a falha.
// ============================================================
test('o fallback do ranking carrega o motivo da queda', () => {
    const fonte = readFileSync(rankApi, 'utf-8');
    assert.match(fonte, /const respostaDeterministica = \(lista = destinosQualidade, motivo = null\)/,
        'respostaDeterministica precisa aceitar o motivo');
    assert.match(fonte, /_motivo: motivo/, 'o motivo precisa chegar na resposta');
    assert.ok(fonte.includes("respostaDeterministica(destinosQualidade, 'CEREBRAS_KEY não configurada')"),
        'chave ausente é o motivo mais provável e precisa ser nomeado');
    assert.match(fonte, /errosDosModelos\.push/,
        'o erro de cada modelo da cascata precisa ser acumulado, não só logado');
});
