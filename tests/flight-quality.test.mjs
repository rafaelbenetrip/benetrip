// Testes da camada determinística de qualidade de voo (P0 — Descobrir Destinos)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    separarPorOrcamento,
    scoreVoo,
    ranquearPorQualidade,
    violaRestricaoObjetiva,
} from '../api/_lib/flight-quality.js';

const dest = (name, price, stops = 0, durMin = 90) => ({
    name,
    country: 'Brasil',
    flight: { price, stops, flight_duration_minutes: durMin },
});

// ============================================================
// ORÇAMENTO COMO TETO
// ============================================================
test('orçamento é teto: nunca descarta opção por ser barata demais', () => {
    // Cenário da auditoria: orçamento R$ 1.500, destinos bem mais baratos
    const destinos = [
        dest('Belo Horizonte', 534, 0),
        dest('Florianópolis', 628, 0),
        dest('Curitiba', 631, 0),
        dest('Rio de Janeiro', 680, 0),
        dest('Brasília', 759, 0),
        dest('Caro demais', 1800, 0),
    ];
    const { dentro, acima } = separarPorOrcamento(destinos, 1500);
    assert.equal(dentro.length, 5);
    assert.ok(dentro.some(d => d.name === 'Belo Horizonte'));
    assert.equal(acima.length, 1);
    assert.equal(acima[0].name, 'Caro demais');
});

test('opções acima do teto trazem diferença em valor e percentual', () => {
    const { acima } = separarPorOrcamento([dest('X', 1800)], 1500);
    assert.equal(acima[0]._acimaOrcamento.diferenca, 300);
    assert.equal(acima[0]._acimaOrcamento.percentual, 20);
});

test('sem orçamento, tudo é elegível', () => {
    const { dentro, acima } = separarPorOrcamento([dest('A', 100), dest('B', 99999)], 0);
    assert.equal(dentro.length, 2);
    assert.equal(acima.length, 0);
});

test('destinos sem preço são excluídos (não viram preço zero)', () => {
    const { dentro } = separarPorOrcamento([dest('SemPreco', 0), dest('Ok', 500)], 1000);
    assert.equal(dentro.length, 1);
    assert.equal(dentro[0].name, 'Ok');
});

// ============================================================
// SCORE DE ESCALAS E DURAÇÃO
// ============================================================
test('família com crianças: 2+ escalas recebem penalização forte', () => {
    const familia = { orcamento: 1500, criancas: 2, bebes: 0, noites: 7 };
    const direto = scoreVoo(dest('Direto', 680, 0, 90), familia);
    const duasEscalas = scoreVoo(dest('Duas escalas', 680, 2, 840), familia);
    assert.ok(direto.score - duasEscalas.score >= 40,
        `direto=${direto.score} vs 2 escalas=${duasEscalas.score}`);
    assert.ok(duasEscalas.penalidades.includes('escalas_familia'));
});

test('voo direto barato supera voo com 2 escalas mais caro (cenário da auditoria)', () => {
    const familia = { orcamento: 1500, criancas: 2, noites: 7 };
    const ranqueados = ranquearPorQualidade([
        dest('Destino 2 escalas 14h', 1400, 2, 840),
        dest('BH direto', 534, 0, 75),
        dest('Floripa direto', 628, 0, 80),
    ], familia);
    assert.equal(ranqueados[0].name, 'BH direto');
    assert.notEqual(ranqueados[ranqueados.length - 1].name, 'BH direto');
});

test('viagem curta: voo que consome parcela excessiva da viagem é penalizado', () => {
    const perfil = { orcamento: 2000, noites: 2 };
    const curto = scoreVoo(dest('Perto', 800, 0, 70), perfil);
    const longo = scoreVoo(dest('Longe', 800, 0, 600), perfil); // 10h de voo p/ 2 noites
    assert.ok(curto.score > longo.score);
    assert.ok(longo.penalidades.includes('voo_consome_viagem'));
});

test('sem família, 2 escalas penaliza menos que com família', () => {
    const semFamilia = scoreVoo(dest('X', 700, 2, 300), { orcamento: 1500, noites: 7 });
    const comFamilia = scoreVoo(dest('X', 700, 2, 300), { orcamento: 1500, criancas: 1, noites: 7 });
    assert.ok(semFamilia.score > comFamilia.score);
});

// ============================================================
// RESTRIÇÃO OBJETIVA (a IA não pode violar)
// ============================================================
test('IA não pode escolher 2+ escalas para família havendo opção direta de score >= igual', () => {
    const perfil = { orcamento: 1500, criancas: 2, noites: 7 };
    const pool = ranquearPorQualidade([
        dest('Duas escalas', 1400, 2, 840),
        dest('Direto barato', 628, 0, 80),
    ], perfil);
    const escolhaRuim = pool.find(d => d.name === 'Duas escalas');
    assert.equal(violaRestricaoObjetiva(escolhaRuim, pool, perfil), true);
    const escolhaBoa = pool.find(d => d.name === 'Direto barato');
    assert.equal(violaRestricaoObjetiva(escolhaBoa, pool, perfil), false);
});

test('sem crianças/bebês a restrição objetiva não bloqueia', () => {
    const perfil = { orcamento: 1500, noites: 7 };
    const pool = ranquearPorQualidade([
        dest('Duas escalas', 900, 2, 500),
        dest('Direto', 800, 0, 90),
    ], perfil);
    assert.equal(violaRestricaoObjetiva(pool.find(d => d.name === 'Duas escalas'), pool, perfil), false);
});

test('família: 2+ escalas é permitido quando NÃO existe opção melhor', () => {
    const perfil = { orcamento: 1500, criancas: 1, noites: 7 };
    const pool = ranquearPorQualidade([
        dest('Única opção, 2 escalas', 900, 2, 500),
    ], perfil);
    assert.equal(violaRestricaoObjetiva(pool[0], pool, perfil), false);
});
