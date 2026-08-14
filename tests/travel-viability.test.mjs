// Testes da regra determinística de viabilidade (P0 — Escapadas)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    avaliarViabilidade,
    separarPorViabilidade,
    motivoLegivel,
    NIVEL,
} from '../api/_lib/travel-viability.js';
import { janelasAtivas } from '../api/_lib/escapadas-shared.js';

// ============================================================
// JANELA DE DUAS NOITES — as regras mínimas da auditoria
// ============================================================
test('duas ou mais escalas numa janela de 2 noites é inviável', () => {
    const v = avaliarViabilidade({ noites: 2, duracaoVooMin: 100, paradas: 2 });
    assert.equal(v.nivel, NIVEL.INVIAVEL);
    assert.equal(v.recomendavel, false);
    assert.match(v.motivo, /escalas/);
});

test('três escalas numa janela de 2 noites é inviável', () => {
    const v = avaliarViabilidade({ noites: 2, duracaoVooMin: 90, paradas: 3 });
    assert.equal(v.recomendavel, false);
    assert.match(motivoLegivel(v), /3 escalas/);
});

test('voo acima de ~5h por trecho é inviável para 2 noites', () => {
    const v = avaliarViabilidade({ noites: 2, duracaoVooMin: 330, paradas: 0 });
    assert.equal(v.nivel, NIVEL.INVIAVEL);
    assert.match(motivoLegivel(v), /5h30 por trecho/);
});

test('voo de 5h exato ainda passa no teto por trecho', () => {
    const v = avaliarViabilidade({ noites: 2, duracaoVooMin: 300, paradas: 0 });
    assert.notEqual(v.nivel, NIVEL.INVIAVEL);
});

test('voos de 19h, 30h e 42h nunca entram na lista principal de 2 noites', () => {
    for (const horas of [19.83, 30, 42]) {
        const v = avaliarViabilidade({ noites: 2, duracaoVooMin: Math.round(horas * 60), paradas: 1 });
        assert.equal(v.recomendavel, false, `${horas}h deveria ficar fora da lista principal`);
    }
});

test('a explicação cita o voo de 19h50 encontrado na auditoria', () => {
    const v = avaliarViabilidade({ noites: 2, duracaoVooMin: 1190, paradas: 1 });
    assert.match(motivoLegivel(v), /19h50/);
});

test('deslocamento aéreo excessivo é reportado em percentual', () => {
    const v = avaliarViabilidade({ noites: 4, duracaoVooMin: 700, paradas: 0 });
    assert.equal(v.recomendavel, false);
    assert.match(motivoLegivel(v), /consome \d+% da viagem/);
});

// ============================================================
// AUSÊNCIA DE DADO NUNCA VIRA "BOA"
// ============================================================
test('duração desconhecida fica desconhecida, nunca boa', () => {
    const v = avaliarViabilidade({ noites: 2, duracaoVooMin: 0, paradas: 0 });
    assert.equal(v.nivel, NIVEL.DESCONHECIDA);
    assert.equal(v.recomendavel, false, 'sem dado não entra na lista principal');
    assert.equal(v.fracao, null);
    assert.match(motivoLegivel(v), /não informada/i);
});

test('voo curto e direto continua sendo boa opção', () => {
    const v = avaliarViabilidade({ noites: 2, duracaoVooMin: 70, paradas: 0 });
    assert.equal(v.nivel, NIVEL.BOA);
    assert.equal(v.recomendavel, true);
});

test('uma escala com voo curto é aceitável (entra na lista, sem topo)', () => {
    const v = avaliarViabilidade({ noites: 2, duracaoVooMin: 90, paradas: 1 });
    assert.equal(v.nivel, NIVEL.ACEITAVEL);
    assert.equal(v.recomendavel, true);
});

test('a mesma rota longa vira aceitável numa janela maior', () => {
    const curta = avaliarViabilidade({ noites: 2, duracaoVooMin: 420, paradas: 0 });
    const longa = avaliarViabilidade({ noites: 7, duracaoVooMin: 420, paradas: 0 });
    assert.equal(curta.recomendavel, false);
    assert.equal(longa.recomendavel, true);
});

// ============================================================
// DESLOCAMENTO TERRESTRE MEDIDO EXTERNAMENTE
// ============================================================
test('deslocamento terrestre longo derruba a viabilidade da escapada', () => {
    const v = avaliarViabilidade({ noites: 2, duracaoVooMin: 90, paradas: 0, deslocamentoTerrestreMin: 180 });
    assert.equal(v.recomendavel, false);
    assert.match(motivoLegivel(v), /deslocamento terrestre/i);
});

test('sem dado de deslocamento terrestre a conta não muda', () => {
    const semDado = avaliarViabilidade({ noites: 2, duracaoVooMin: 90, paradas: 0 });
    const comZero = avaliarViabilidade({ noites: 2, duracaoVooMin: 90, paradas: 0, deslocamentoTerrestreMin: null });
    assert.deepEqual(semDado.nivel, comZero.nivel);
});

// ============================================================
// SEPARAÇÃO DAS LISTAS
// ============================================================
test('inviáveis saem da lista principal e o total só conta os recomendáveis', () => {
    const destinos = [
        { nome: 'A', viabilidade: avaliarViabilidade({ noites: 2, duracaoVooMin: 70, paradas: 0 }) },
        { nome: 'B', viabilidade: avaliarViabilidade({ noites: 2, duracaoVooMin: 1190, paradas: 2 }) },
        { nome: 'C', viabilidade: avaliarViabilidade({ noites: 2, duracaoVooMin: 0, paradas: 0 }) },
    ];
    const r = separarPorViabilidade(destinos);
    assert.equal(r.totalRecomendados, 1);
    assert.equal(r.recomendados[0].nome, 'A');
    assert.equal(r.totalNaoRecomendados, 2);
    assert.equal(r.recomendados[0].posicao, 1, 'posições são reatribuídas na lista visível');
});

test('snapshots antigos (sem campo recomendavel) continuam sendo separados', () => {
    const r = separarPorViabilidade([
        { nome: 'antigo-ok', viabilidade: { nivel: 'boa' } },
        { nome: 'antigo-ruim', viabilidade: { nivel: 'inviavel' } },
    ]);
    assert.equal(r.totalRecomendados, 1);
    assert.equal(r.totalNaoRecomendados, 1);
});

// ============================================================
// RÓTULOS DAS JANELAS DE FIM DE SEMANA
// ============================================================
test('"Este fim de semana" só aparece para o fim de semana imediato', () => {
    // Segunda-feira 2026-11-09: a sexta 13/11 está a 4 dias, entra normalmente
    const janelas = janelasAtivas('2026-11-09').filter((j) => j.categoria === 'fds');
    assert.equal(janelas[0].rotulo, 'Este fim de semana');
    assert.equal(janelas[0].ida, '2026-11-13');
    assert.equal(janelas[0].omitidoPorAntecedencia, null);
});

test('fim de semana próximo demais é omitido e o rótulo diz isso', () => {
    // Quinta-feira 2026-11-12: a sexta 13/11 está a 1 dia (< 2), sai da lista
    const janelas = janelasAtivas('2026-11-12').filter((j) => j.categoria === 'fds');
    assert.equal(janelas[0].rotulo, 'Próximo fim de semana com tarifas disponíveis');
    assert.equal(janelas[0].ida, '2026-11-20');
    assert.ok(janelas[0].omitidoPorAntecedencia, 'a omissão precisa ser explicada na interface');
    assert.equal(janelas[0].omitidoPorAntecedencia.ida, '2026-11-13');
    assert.match(janelas[0].omitidoPorAntecedencia.explicacao, /última hora/);
});

test('os rótulos seguintes acompanham o deslocamento da janela', () => {
    // Agosto de 2026 não tem feriado nacional: nenhuma janela de fds é
    // absorvida pela janela de feriado, então os três rótulos aparecem.
    const semOmissao = janelasAtivas('2026-08-10').filter((j) => j.categoria === 'fds');
    assert.deepEqual(
        semOmissao.map((j) => j.rotulo),
        ['Este fim de semana', 'Próximo fim de semana', 'Em 2 semanas']
    );

    const comOmissao = janelasAtivas('2026-08-13').filter((j) => j.categoria === 'fds');
    assert.deepEqual(
        comOmissao.map((j) => j.rotulo),
        ['Próximo fim de semana com tarifas disponíveis', 'Em 2 semanas', 'Em 3 semanas']
    );
});

test('a janela rotulada como imediata é mesmo a mais próxima da lista', () => {
    for (const hoje of ['2026-08-10', '2026-08-13', '2026-11-09', '2026-11-12']) {
        const fds = janelasAtivas(hoje).filter((j) => j.categoria === 'fds');
        if (fds.length === 0) continue;
        const maisProxima = fds.reduce((a, b) => (a.ida <= b.ida ? a : b));
        const rotuladaImediata = fds.find((j) => j.rotulo === 'Este fim de semana');
        if (rotuladaImediata) {
            assert.equal(rotuladaImediata.ida, maisProxima.ida, `${hoje}: "Este fim de semana" precisa ser a janela mais próxima`);
        }
    }
});
