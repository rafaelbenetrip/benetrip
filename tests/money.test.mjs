// Testes da normalização monetária única (P1 — Vai e Vem e demais telas)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizarValor,
    normalizarValorOpcional,
    precoPorPessoa,
    formatarValor,
    formatarPreco,
    mesmoValorExibido,
    simboloMoeda,
} from '../api/_lib/money.js';

// ============================================================
// O CASO DA AUDITORIA: R$ 786 num ponto, R$ 787 em outro
// ============================================================
test('o mesmo valor bruto produz sempre o mesmo número exibido', () => {
    const bruto = 786.5;
    assert.equal(normalizarValor(bruto), 787);
    assert.equal(formatarValor(bruto), '787');
    assert.equal(formatarPreco(bruto, 'BRL'), 'R$ 787');
});

test('dividir o total já arredondado não pode divergir da divisão do bruto', () => {
    const total = 1573.4;
    const pax = 2;
    // Errado: arredondar antes de dividir
    const errado = Math.round(Math.round(total) / pax);
    // Certo: sempre a partir do bruto
    const certo = precoPorPessoa(total, pax);
    assert.equal(certo, 787);
    assert.equal(errado, 787, 'neste caso coincidem, mas o método único é o que garante');

    // Caso onde os métodos divergem de verdade
    const t2 = 1573.6;
    assert.equal(precoPorPessoa(t2, 2), 787);
    assert.equal(Math.round(Math.round(t2) / 2), 787);
    const t3 = 787.5;
    assert.equal(precoPorPessoa(t3, 1), 788);
});

test('preço por pessoa nunca divide por zero nem por fração', () => {
    assert.equal(precoPorPessoa(1000, 0), 1000);
    assert.equal(precoPorPessoa(1000, null), 1000);
    assert.equal(precoPorPessoa(1000, 3), 333);
});

// ============================================================
// AUSÊNCIA DE DADO NÃO É ZERO
// ============================================================
test('valor ausente vira null, nunca zero', () => {
    assert.equal(normalizarValor(null), null);
    assert.equal(normalizarValor(undefined), null);
    assert.equal(normalizarValor(''), null);
    assert.equal(normalizarValor('abc'), null);
});

test('custo opcional zero é dado ausente, não hospedagem grátis', () => {
    assert.equal(normalizarValorOpcional(0), null);
    assert.equal(normalizarValorOpcional(-5), null);
    assert.equal(normalizarValorOpcional(120), 120);
    assert.equal(normalizarValorOpcional(null), null);
});

test('valor ausente não é formatado como "0"', () => {
    assert.equal(formatarValor(null), '');
    assert.equal(formatarPreco(null, 'BRL'), '');
});

// ============================================================
// COMPARAÇÃO DE VALORES EXIBIDOS (empates)
// ============================================================
test('dois valores que aparecem iguais na tela são tratados como empate', () => {
    assert.equal(mesmoValorExibido(786.6, 787.4), true, 'ambos aparecem como 787');
    assert.equal(mesmoValorExibido(786.4, 787.6), false);
    assert.equal(mesmoValorExibido(null, 787), false);
});

// ============================================================
// MOEDAS
// ============================================================
test('símbolos das moedas suportadas', () => {
    assert.equal(simboloMoeda('BRL'), 'R$');
    assert.equal(simboloMoeda('USD'), 'US$');
    assert.equal(simboloMoeda('EUR'), '€');
    assert.equal(simboloMoeda('XYZ'), 'R$', 'moeda desconhecida cai no padrão da casa');
});

test('formatação usa separador de milhar pt-BR', () => {
    assert.equal(formatarValor(1234567), '1.234.567');
});
