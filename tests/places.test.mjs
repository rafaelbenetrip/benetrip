// Testes da validação externa de lugares (P1 — Roteiro)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    STATUS_LUGAR,
    TEXTO_HORARIO_NAO_VERIFICADO,
    resolverLugar,
    ehCandidatoEspeculativo,
    sugestaoPorCategoria,
    reconciliarCusto,
} from '../api/_lib/places.js';
import { limparCache } from '../api/_lib/external-cache.js';

// ============================================================
// CANDIDATOS ESPECULATIVOS
// A auditoria pegou "Café do Forte, se acessível, ou um café similar"
// ============================================================
test('"Café do Forte, se acessível, ou um café similar" é especulativo', () => {
    assert.equal(ehCandidatoEspeculativo('Café do Forte, se acessível, ou um café similar'), true);
});

test('outras formas de hedge também são recusadas', () => {
    const especulativos = [
        'Restaurante da Praça, se estiver aberto',
        'Algum café no centro histórico',
        'Museu X ou outro museu similar',
        'Bar do Porto (ou equivalente na região)',
        '   ',
    ];
    for (const nome of especulativos) {
        assert.equal(ehCandidatoEspeculativo(nome), true, `deveria recusar: "${nome}"`);
    }
});

test('nome concreto de lugar não é especulativo', () => {
    const concretos = ['Elevador Lacerda', 'Mercado Modelo', 'Farol da Barra', 'Igreja do Bonfim'];
    for (const nome of concretos) {
        assert.equal(ehCandidatoEspeculativo(nome), false, `não deveria recusar: "${nome}"`);
    }
});

// ============================================================
// SEM PROVEDOR NÃO EXISTE LUGAR VERIFICADO
// ============================================================
test('sem chave de lugares o candidato fica not_verified', async (t) => {
    limparCache();
    const salvos = {
        GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    };
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    t.after(() => {
        for (const [k, v] of Object.entries(salvos)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
        limparCache();
    });

    const r = await resolverLugar({ nome: 'Elevador Lacerda', cidade: 'Salvador' });
    assert.equal(r.status, STATUS_LUGAR.NAO_VERIFICADO);
    assert.equal(r.nomeOficial, null, 'sem provedor não afirmamos nome oficial');
    assert.equal(r.endereco, null);
    assert.equal(r.urlMapa, null);
    assert.equal(r.motivo, 'provedor_indisponivel');
});

// ============================================================
// SUBSTITUTO SEM ESTABELECIMENTO
// ============================================================
test('sem lugar verificado recomendamos categoria e região, sem nome', () => {
    const texto = sugestaoPorCategoria({ categoria: 'pausa para café', regiao: 'do Comércio' });
    assert.match(texto, /Pausa para café/);
    assert.match(texto, /do Comércio/);
    assert.match(texto, /Escolha uma opção aberta no momento/);
});

test('sem região a sugestão continua utilizável', () => {
    const texto = sugestaoPorCategoria({ categoria: 'refeição' });
    assert.match(texto, /na região/);
});

// ============================================================
// COERÊNCIA DE CUSTO
// Nenhum local pode ser pago e gratuito ao mesmo tempo
// ============================================================
test('local declarado gratuito com descrição de ingresso vira custo não confirmado', () => {
    const r = reconciliarCusto({
        gratuito: true,
        descricao: 'A entrada custa R$ 20 por pessoa',
        tags: ['Gratuito'],
    });
    assert.equal(r.gratuito, null, 'não escolhemos um dos dois: assumimos que não sabemos');
    assert.equal(r.conflito, true);
    assert.equal(r.rotulo, 'Custo não confirmado');
});

test('gratuito coerente continua gratuito', () => {
    const r = reconciliarCusto({ gratuito: true, descricao: 'Entrada franca, acesso livre', tags: [] });
    assert.equal(r.gratuito, true);
    assert.equal(r.rotulo, 'Gratuito');
    assert.equal(r.conflito, false);
});

test('descrição de ingresso sem flag marca como pago', () => {
    const r = reconciliarCusto({ descricao: 'Ingresso vendido na bilheteria', tags: [] });
    assert.equal(r.gratuito, false);
    assert.equal(r.rotulo, 'Pago');
});

test('sem sinal nenhum o custo fica desconhecido, nunca zero', () => {
    const r = reconciliarCusto({ descricao: 'Caminhada pelo bairro', tags: [] });
    assert.equal(r.gratuito, null);
    assert.equal(r.rotulo, 'Custo não confirmado');
});

// ============================================================
// HORÁRIO
// ============================================================
test('o aviso de horário não verificado é explícito', () => {
    assert.match(TEXTO_HORARIO_NAO_VERIFICADO, /não verificado/i);
    assert.match(TEXTO_HORARIO_NAO_VERIFICADO, /confirme antes de ir/i);
});
