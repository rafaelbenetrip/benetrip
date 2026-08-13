// Testes da linguagem de confiança da Tripinha (P0 — Destinos Baratos)
// A auditoria pegou uma tarifa de ~R$ 1.544 chamada de "baratinha" e
// "oportunidade urgente" só porque o preço tinha caído.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    avaliarEvidencias,
    gerarFallbackInsight,
    gerarFallbackEscolha,
    QUEDA_RELEVANTE_PCT,
    DIAS_HISTORICO_MINIMO,
} from '../api/_lib/tripinha-shared.js';
import { contarLugaresEAeroportos, lugaresPorAeroporto } from '../api/_lib/discovery-shared.js';

const HOJE = new Date('2026-08-13T12:00:00Z');

const destino = (nome, preco, variacao = null, extra = {}) => ({
    nome, pais: 'Brasil', preco, aeroporto: 'XXX', internacional: false, variacao, ...extra,
});

const variacao = (pct, dias, precoAnterior) => ({
    direcao: pct < 0 ? 'desceu' : 'subiu',
    percentual: pct,
    diferenca: Math.round((precoAnterior * pct) / 100),
    preco_anterior: precoAnterior,
    dias,
    referencia: dias === 1 ? 'ontem' : 'media',
});

const URGENCIA = /\b(urgente|imperd(í|i)vel|corre|(ú|u)ltima chance|quase de gra(ç|c)a|de gra(ç|c)a|baratinh|despencou|vai que (é|e) agora|some r(á|a)pido)\b/i;

// ============================================================
// EVIDÊNCIA
// ============================================================
test('queda relevante com histórico e dado recente permite urgência', () => {
    const ev = avaliarEvidencias(
        [destino('Salvador', 900, variacao(-18, 5, 1100))],
        { dataSnapshot: '2026-08-13', hoje: HOJE }
    );
    assert.ok(ev.quedaRelevante);
    assert.equal(ev.permiteUrgencia, true);
});

test('queda pequena não vira oportunidade', () => {
    const ev = avaliarEvidencias(
        [destino('Recife', 1544, variacao(-3, 5, 1590))],
        { dataSnapshot: '2026-08-13', hoje: HOJE }
    );
    assert.equal(ev.quedaRelevante, null);
    assert.equal(ev.permiteUrgencia, false);
    assert.ok(ev.quedaSimples, 'a queda continua sendo um fato reportável');
});

test('queda sem histórico suficiente não vira oportunidade', () => {
    const ev = avaliarEvidencias(
        [destino('Recife', 1544, variacao(-20, 1, 1930))],
        { dataSnapshot: '2026-08-13', hoje: HOJE }
    );
    assert.equal(ev.quedaRelevante, null, `precisa de ${DIAS_HISTORICO_MINIMO} dias de histórico`);
    assert.equal(ev.permiteUrgencia, false);
});

test('dado desatualizado bloqueia urgência mesmo com queda relevante', () => {
    const ev = avaliarEvidencias(
        [destino('Salvador', 900, variacao(-25, 5, 1200))],
        { dataSnapshot: '2026-08-05', hoje: HOJE }
    );
    assert.ok(ev.quedaRelevante);
    assert.equal(ev.dadoRecente, false);
    assert.equal(ev.permiteUrgencia, false);
});

test('sem variação nenhuma não há evidência', () => {
    const ev = avaliarEvidencias([destino('Natal', 700)], { dataSnapshot: '2026-08-13', hoje: HOJE });
    assert.equal(ev.quedaRelevante, null);
    assert.equal(ev.quedaSimples, null);
    assert.equal(ev.permiteUrgencia, false);
});

// ============================================================
// LINGUAGEM DO FALLBACK
// ============================================================
test('preço alto com queda pequena não é chamado de barato nem urgente', () => {
    const destinos = [destino('Recife', 1544, variacao(-3, 5, 1590))];
    const ev = avaliarEvidencias(destinos, { dataSnapshot: '2026-08-13', hoje: HOJE });
    const insight = gerarFallbackInsight('São Paulo', destinos, ev);
    assert.doesNotMatch(insight, URGENCIA, `insight com urgência artificial: "${insight}"`);
    assert.match(insight, /caiu R\$/, 'a queda deve ser reportada como fato');
});

test('preço baixo sozinho não autoriza "quase de graça"', () => {
    const destinos = [destino('Belo Horizonte', 320)];
    const insight = gerarFallbackInsight('São Paulo', destinos);
    assert.doesNotMatch(insight, URGENCIA, `insight com urgência artificial: "${insight}"`);
});

test('comparações são relativas ao conjunto pesquisado', () => {
    const destinos = [destino('Belo Horizonte', 320), destino('Curitiba', 400)];
    const insight = gerarFallbackInsight('São Paulo', destinos);
    assert.match(insight, /pesquisad|média|achei|R\$/i);
});

test('nenhuma frase do fallback usa urgência sem evidência', () => {
    // varre as várias ramificações mudando o tamanho da lista e a origem
    for (const total of [1, 3, 25]) {
        for (const origem of ['São Paulo', 'Rio', 'Belo Horizonte']) {
            const destinos = Array.from({ length: total }, (_, i) => destino(`Destino ${i}`, 500 + i * 100));
            const insight = gerarFallbackInsight(origem, destinos);
            assert.doesNotMatch(insight, URGENCIA, `"${insight}"`);
        }
    }
});

test('com evidência real a frase cita a referência da queda', () => {
    const destinos = [destino('Salvador', 900, variacao(-18, 5, 1100))];
    const ev = avaliarEvidencias(destinos, { dataSnapshot: '2026-08-13', hoje: HOJE });
    const insight = gerarFallbackInsight('São Paulo', destinos, ev);
    assert.match(insight, /(m(é|e)dia|refer(ê|e)ncia|(ú|u)ltimos \d+ dias)/i,
        `sem referência explícita: "${insight}"`);
});

test('escolha da Tripinha explica a base da comparação', () => {
    const semEvidencia = gerarFallbackEscolha([destino('Natal', 700), destino('Recife', 800)]);
    assert.match(semEvidencia.motivo, /pesquisados/);
    assert.doesNotMatch(semEvidencia.motivo, URGENCIA);

    const destinos = [destino('Salvador', 900, variacao(-18, 5, 1100))];
    const comEvidencia = gerarFallbackEscolha(destinos, avaliarEvidencias(destinos, { dataSnapshot: '2026-08-13', hoje: HOJE }));
    assert.match(comEvidencia.motivo, /(ú|u)ltimos 5 dias/);
});

// ============================================================
// CONTAGEM LUGARES x AEROPORTOS
// ============================================================
test('50 lugares em 43 aeroportos são contados separadamente', () => {
    const destinos = [];
    for (let i = 0; i < 50; i++) {
        // 7 lugares dividem aeroporto com outro (50 lugares -> 43 aeroportos)
        const code = i < 43 ? `A${String(i).padStart(2, '0')}` : `A${String(i - 43).padStart(2, '0')}`;
        destinos.push(destino(`Lugar ${i}`, 500, null, { aeroporto: code }));
    }
    const c = contarLugaresEAeroportos(destinos);
    assert.equal(c.lugares, 50);
    assert.equal(c.aeroportos, 43);
});

test('lugares por aeroporto identifica os compartilhados', () => {
    const destinos = [
        destino('Ouro Preto', 600, null, { aeroporto: 'CNF' }),
        destino('Tiradentes', 600, null, { aeroporto: 'CNF' }),
        destino('Salvador', 700, null, { aeroporto: 'SSA' }),
    ];
    const mapa = lugaresPorAeroporto(destinos);
    assert.equal(mapa.get('CNF'), 2);
    assert.equal(mapa.get('SSA'), 1);
});

test('destino sem aeroporto não infla a contagem', () => {
    const c = contarLugaresEAeroportos([
        destino('Com aeroporto', 500, null, { aeroporto: 'GRU' }),
        destino('Sem aeroporto', 500, null, { aeroporto: '' }),
    ]);
    assert.equal(c.lugares, 2);
    assert.equal(c.aeroportos, 1);
});
