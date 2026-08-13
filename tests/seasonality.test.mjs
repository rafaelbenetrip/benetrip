// Testes da validação sazonal com grounding (P0 — Descoberta)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    STATUS,
    ADEQUACAO,
    montarConsulta,
    validarSazonalidade,
    validarSazonalidadeEmLote,
    MAX_DESTINOS_VALIDADOS,
    TEXTO_CONFLITO,
} from '../api/_lib/seasonality.js';
import { credibilidadeDaFonte, ordenarPorCredibilidade } from '../api/_lib/web-grounding.js';
import { limparCache } from '../api/_lib/external-cache.js';

// ============================================================
// CONSULTA GENÉRICA — vale para qualquer lugar do mundo
// ============================================================
test('a consulta é montada a partir do destino e do mês, sem tabela local', () => {
    const q = montarConsulta({ destino: 'Lençóis Maranhenses', pais: 'Brasil', mes: 11 });
    assert.match(q, /Lençóis Maranhenses/);
    assert.match(q, /Brasil/);
    assert.match(q, /novembro/);
});

test('funciona igual para um destino fora do Brasil', () => {
    const q = montarConsulta({ destino: 'Hokkaido', pais: 'Japão', mes: 2 });
    assert.match(q, /Hokkaido/);
    assert.match(q, /fevereiro/);
});

// ============================================================
// SEM GROUNDING NÃO HÁ AFIRMAÇÃO
// ============================================================
test('sem provedor de busca configurado o status é unavailable', async (t) => {
    limparCache();
    const salvos = {
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        GOOGLE_SEARCH_ENGINE_ID: process.env.GOOGLE_SEARCH_ENGINE_ID,
        SEARCHAPI_KEY: process.env.SEARCHAPI_KEY,
    };
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_SEARCH_ENGINE_ID;
    delete process.env.SEARCHAPI_KEY;
    t.after(() => {
        for (const [k, v] of Object.entries(salvos)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
        limparCache();
    });

    const r = await validarSazonalidade({ destino: 'Lençóis Maranhenses', pais: 'Brasil', mes: 11 });
    assert.equal(r.status, STATUS.INDISPONIVEL);
    assert.equal(r.summary, null, 'sem fonte não existe resumo');
    assert.equal(r.suitability, ADEQUACAO.DESCONHECIDA);
    assert.equal(r.sourceUrl, null);
    assert.equal(r.reason, 'grounding_indisponivel');
    assert.ok(!Number.isNaN(Date.parse(r.checkedAt)), 'a data da verificação sempre acompanha o resultado');
});

test('parâmetros inválidos não geram afirmação', async () => {
    const semDestino = await validarSazonalidade({ destino: '', mes: 5 });
    assert.equal(semDestino.status, STATUS.INDISPONIVEL);
    const mesInvalido = await validarSazonalidade({ destino: 'Salvador', mes: 13 });
    assert.equal(mesInvalido.status, STATUS.INDISPONIVEL);
});

// ============================================================
// LOTE — só os finalistas, nunca centenas
// ============================================================
test('o lote é limitado aos destinos que serão exibidos', async (t) => {
    limparCache();
    const salvo = process.env.SEARCHAPI_KEY;
    const salvoGoogle = process.env.GOOGLE_API_KEY;
    delete process.env.SEARCHAPI_KEY;
    delete process.env.GOOGLE_API_KEY;
    t.after(() => {
        if (salvo !== undefined) process.env.SEARCHAPI_KEY = salvo;
        if (salvoGoogle !== undefined) process.env.GOOGLE_API_KEY = salvoGoogle;
        limparCache();
    });

    const muitos = Array.from({ length: 40 }, (_, i) => ({ destino: `Destino ${i}`, pais: 'Brasil' }));
    const r = await validarSazonalidadeEmLote(muitos, { mes: 11 });
    assert.equal(r.length, MAX_DESTINOS_VALIDADOS);
    assert.ok(r.every((x) => x.status === STATUS.INDISPONIVEL));
});

// ============================================================
// PRIORIDADE DE FONTES OFICIAIS
// ============================================================
test('fontes oficiais têm prioridade sobre blogs', () => {
    assert.ok(credibilidadeDaFonte('turismo.gov.br') > credibilidadeDaFonte('blogdeviagem.com'));
    assert.ok(credibilidadeDaFonte('icmbio.gov.br') > credibilidadeDaFonte('exemplo.com.br'));
    assert.ok(credibilidadeDaFonte('visitbritain.com') > credibilidadeDaFonte('exemplo.com.br'));
    assert.equal(credibilidadeDaFonte(''), 0);
});

test('a ordenação por credibilidade coloca a fonte oficial primeiro', () => {
    const ordenado = ordenarPorCredibilidade([
        { dominio: 'blogqualquer.com', url: 'https://blogqualquer.com/a' },
        { dominio: 'gov.br', url: 'https://gov.br/b' },
    ]);
    assert.equal(ordenado[0].dominio, 'gov.br');
});

// ============================================================
// TEXTO DE FONTES CONFLITANTES
// ============================================================
test('o texto de fontes conflitantes é o exigido pela auditoria', () => {
    assert.match(TEXTO_CONFLITO, /não são conclusivas/);
    assert.match(TEXTO_CONFLITO, /Confirme antes de decidir/);
});

// ============================================================
// ESTADOS PERMITIDOS
// ============================================================
test('só existem três estados e nenhum deles é "inferred"', () => {
    const estados = Object.values(STATUS);
    assert.deepEqual(estados.sort(), ['conflicting_sources', 'unavailable', 'verified']);
    assert.ok(!estados.includes('inferred'), 'conhecimento do modelo nunca vira status válido');
});
