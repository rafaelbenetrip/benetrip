// Regra do feriado em destaque (P0 — home + /escapadas)
// Feriado a menos de 7 dias sai de cartaz: a chamada passa para o próximo do
// calendário. As duas superfícies (radar da home e barra da /escapadas) e a
// lista de janelas pesquisadas precisam apontar para o MESMO feriado — o bug
// era anunciar na home um feriado que a /escapadas já não tinha para vender.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    feriadoEmDestaque,
    proximosFeriados,
    diffDias,
    MIN_DIAS_FERIADO,
    MAX_DIAS_FERIADO,
} from '../api/_lib/feriados.js';
import { janelasAtivas } from '../api/_lib/escapadas-shared.js';

test('o limite da regra é 7 dias', () => {
    assert.equal(MIN_DIAS_FERIADO, 7);
});

test('feriado a menos de 7 dias cede lugar ao próximo do calendário', () => {
    // 04/09/2026: faltam 3 dias para a Independência (07/09, segunda).
    const destaque = feriadoEmDestaque('2026-09-04');
    assert.notEqual(destaque.slug, 'independencia');
    assert.equal(destaque.slug, 'aparecida');
    assert.ok(diffDias('2026-09-04', destaque.data) >= MIN_DIAS_FERIADO);
});

test('exatamente 7 dias ainda é o feriado em destaque', () => {
    assert.equal(feriadoEmDestaque('2026-08-31').slug, 'independencia');
    assert.equal(feriadoEmDestaque('2026-09-01').slug, 'aparecida', '6 dias já é tarde demais');
});

test('o destaque nunca fica fora da faixa de antecedência', () => {
    let dia = '2026-01-01';
    for (let i = 0; i < 400; i++) {
        const f = feriadoEmDestaque(dia);
        assert.ok(f, `sem feriado em destaque em ${dia}`);
        const dias = diffDias(dia, f.data);
        assert.ok(dias >= MIN_DIAS_FERIADO, `${dia}: destaque a ${dias} dias`);
        assert.ok(dias <= MAX_DIAS_FERIADO, `${dia}: destaque a ${dias} dias`);
        const d = new Date(dia + 'T12:00:00Z');
        d.setUTCDate(d.getUTCDate() + 1);
        dia = d.toISOString().split('T')[0];
    }
});

test('o feriado em destaque sempre tem janela de voos para oferecer', () => {
    let dia = '2026-01-01';
    for (let i = 0; i < 400; i++) {
        const f = feriadoEmDestaque(dia);
        const janelas = janelasAtivas(dia);
        const id = `feriado-${f.slug}-${f.ano}`;
        // A janela pode ter sido deduplicada contra um fds idêntico; nesse caso
        // o que não pode faltar é uma janela cobrindo as mesmas datas.
        assert.ok(
            janelas.some((j) => j.id === id) || janelas.some((j) => j.ida <= f.data && j.volta >= f.data),
            `${dia}: destaque ${id} sem janela correspondente`
        );
        const d = new Date(dia + 'T12:00:00Z');
        d.setUTCDate(d.getUTCDate() + 1);
        dia = d.toISOString().split('T')[0];
    }
});

test('o radar da home usa a mesma faixa de antecedência do backend', () => {
    const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
    assert.match(html, new RegExp(`const MIN_DIAS = ${MIN_DIAS_FERIADO}, MAX_DIAS = ${MAX_DIAS_FERIADO};`));
    assert.match(html, /diasAte\(f\) >= MIN_DIAS && diasAte\(f\) <= MAX_DIAS/);
    // O radar só mostra feriado a 7+ dias: "é hoje/amanhã" viraria mentira.
    assert.ok(!/É amanhã/.test(html.split('RADAR VAI E VEM')[0]));
});

test('a home e a /escapadas anunciam o mesmo feriado', () => {
    const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
    const slugsHome = [...html.matchAll(/\['([a-z-]+)', '[^']+', (?:new Date|mais)/g)].map((m) => m[1]);
    const slugsBackend = proximosFeriados('2026-01-01', 12, 0).map((f) => f.slug);
    for (const slug of slugsBackend) {
        assert.ok(slugsHome.includes(slug), `home não conhece o feriado ${slug}`);
    }
});
