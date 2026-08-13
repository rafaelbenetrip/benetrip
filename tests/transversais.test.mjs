// Testes dos padrões transversais (P2): preço por pessoa e analytics
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Price = require('../public/assets/js/benetrip-price.js');
const Analytics = require('../public/assets/js/benetrip-analytics.js');

// ============================================================
// PREÇO POR PESSOA E TOTAL
// ============================================================
test('bebê de colo não entra na divisão do preço por pessoa', () => {
    // Família da auditoria: 2 adultos + 2 crianças + 1 bebê, total R$ 8.000
    const comBebe = Price.porPessoa(8000, { adultos: 2, criancas: 2, bebes: 1 });
    const semBebe = Price.porPessoa(8000, { adultos: 2, criancas: 2 });
    assert.equal(comBebe, 2000);
    assert.equal(comBebe, semBebe, 'o bebê não pode baratear o preço por pessoa');
});

test('preço por pessoa divide pelos pagantes', () => {
    assert.equal(Price.porPessoa(4000, { adultos: 2, criancas: 2 }), 1000);
    assert.equal(Price.porPessoa(1500, { adultos: 1 }), 1500);
});

test('sem passageiros informados assume um adulto', () => {
    assert.equal(Price.paxPagantes({}), 1);
    assert.equal(Price.porPessoa(900, {}), 900);
});

test('preço ausente vira "não disponível", nunca zero', () => {
    assert.equal(Price.porPessoa(0, { adultos: 2 }), null);
    assert.equal(Price.formatar(null, 'BRL'), 'não disponível');
    assert.equal(Price.formatar(undefined, 'BRL'), 'não disponível');
});

test('rótulo informa por pessoa, ida e volta e o total familiar', () => {
    const d = Price.descrever(8000, { adultos: 2, criancas: 2, bebes: 1, moeda: 'BRL' });
    assert.equal(d.principal, 'R$ 2.000');
    assert.match(d.rotulo, /por pessoa/);
    assert.match(d.rotulo, /ida e volta/);
    assert.match(d.total, /Total 4 pagantes: R\$ 8\.000/);
    assert.match(d.observacao, /bebê de colo não entra/);
});

test('tarifa parcial aparece no rótulo', () => {
    const d = Price.descrever(1000, { adultos: 1, tarifaParcial: true });
    assert.match(d.rotulo, /tarifa inicial/);
});

test('viajante sozinho não mostra linha de total', () => {
    const d = Price.descrever(1000, { adultos: 1 });
    assert.equal(d.total, null);
    assert.equal(d.observacao, null);
});

test('símbolo acompanha a moeda', () => {
    assert.equal(Price.simbolo('BRL'), 'R$');
    assert.equal(Price.simbolo('USD'), 'US$');
    assert.equal(Price.simbolo('EUR'), '€');
    assert.equal(Price.simbolo('XXX'), 'R$');
});

// ============================================================
// ANALYTICS — sem dados pessoais
// ============================================================
test('campos pessoais nunca são enviados', () => {
    const limpo = Analytics.sanitizar({
        ferramenta: 'descobrir-destinos',
        observacoes: 'Evitar deslocamentos longos, meu filho tem alergia',
        query: 'praia para família',
        email: 'pessoa@exemplo.com',
        nome: 'Fulano',
        resultados: 12,
    });
    assert.deepEqual(limpo, { ferramenta: 'descobrir-destinos', resultados: 12 });
});

test('só primitivos entram no evento', () => {
    const limpo = Analytics.sanitizar({
        ok: true,
        n: 5,
        texto_curto: 'nacional',
        objeto: { a: 1 },
        lista: [1, 2, 3],
        nulo: null,
    });
    assert.deepEqual(limpo, { ok: true, n: 5, texto_curto: 'nacional' });
});

test('strings longas são truncadas', () => {
    const limpo = Analytics.sanitizar({ motivo: 'x'.repeat(500) });
    assert.equal(limpo.motivo.length, 60);
});

test('evento desconhecido não é enviado', () => {
    assert.equal(Analytics.track('evento_inventado', {}), null);
});

test('todos os eventos pedidos pela auditoria existem', () => {
    for (const e of [
        'tool_viewed', 'search_submitted', 'search_completed', 'search_failed',
        'empty_result', 'filters_applied', 'result_clicked', 'external_flight_clicked',
        'alert_requested', 'itinerary_generated', 'itinerary_constraint_violation',
    ]) {
        assert.ok(Analytics.EVENTOS.includes(e), `falta o evento ${e}`);
    }
});

test('evento válido carrega os campos esperados', () => {
    const r = Analytics.searchCompleted('descobrir-destinos', {
        duracaoMs: 4200, resultados: 12, escopo: 'nacional', flexivel: false,
    });
    assert.equal(r.evento, 'search_completed');
    assert.equal(r.props.duracao_ms, 4200);
    assert.equal(r.props.resultados, 12);
    assert.equal(r.props.escopo, 'nacional');
    assert.equal(r.props.flexivel, false);
});

test('analytics não quebra sem ferramenta configurada', () => {
    // window.va não existe neste ambiente: a chamada precisa retornar normalmente
    assert.doesNotThrow(() => Analytics.toolViewed('voos'));
});
