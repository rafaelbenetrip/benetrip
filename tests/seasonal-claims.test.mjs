// Guarda determinística de afirmação sazonal (P0 — Descoberta, sem rede)
//
// Substitui a verificação externa: o prompt reduz a frequência do erro e esta
// guarda garante que o que escapar não seja exibido como fato. Sem provedor,
// sem token, sem custo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    afirmaFenomenoSazonal,
    aplicarGuardaSazonal,
    INSTRUCOES_SAZONALIDADE,
    TEXTO_SEM_FONTE,
} from '../api/_lib/seasonal-claims.js';

// ============================================================
// O CASO DA AUDITORIA
// ============================================================
test('"em novembro as lagoas estarão cheias" é bloqueado', () => {
    const frase = 'Em novembro as lagoas dos Lençóis estarão cheias, perfeitas para banho.';
    assert.equal(afirmaFenomenoSazonal(frase), true);
    const r = aplicarGuardaSazonal(frase, { verificado: false });
    assert.equal(r.texto, null, 'a frase não pode chegar à tela');
    assert.equal(r.descartada, true);
    assert.equal(r.motivo, 'fenomeno_sem_fonte');
});

test('a mesma ideia, modalizada e com convite a confirmar, passa', () => {
    const frase = 'Novembro fica perto do fim do período de chuvas e o nível das lagoas varia bastante de ano para ano. Confirme as condições antes de fechar.';
    assert.equal(afirmaFenomenoSazonal(frase), false);
    assert.equal(aplicarGuardaSazonal(frase).texto, frase);
});

test('um "confirme antes" no fim não absolve a afirmação categórica no começo', () => {
    const frase = 'As lagoas estarão cheias. Confirme antes de ir.';
    assert.equal(afirmaFenomenoSazonal(frase), true, 'a primeira oração afirma como fato');
});

// ============================================================
// FENÔMENOS QUE EXIGEM FONTE
// ============================================================
test('neve, floração, desova e clima garantido são bloqueados', () => {
    const proibidas = [
        'Vai nevar, leve casaco.',
        'As cerejeiras estarão floridas nesse período.',
        'A temporada de baleias estará aberta.',
        'Clima perfeito, sem chuva no período.',
        'Sol garantido durante toda a viagem.',
        'As cachoeiras estarão cheias e volumosas.',
        'A temperatura vai ser de 28 graus.',
        'O parque estará aberto na sua data.',
    ];
    for (const f of proibidas) {
        assert.equal(afirmaFenomenoSazonal(f), true, `deveria bloquear: "${f}"`);
        assert.equal(aplicarGuardaSazonal(f).texto, null);
    }
});

test('caracterizações que não dependem de fenômeno natural passam', () => {
    const permitidas = [
        'Novembro é alta temporada, com a cidade mais movimentada e preços maiores.',
        'É verão na região, com calor e pancadas de chuva possíveis à tarde.',
        'Fora do pico turístico, então costuma ter menos fila nos passeios.',
        'A região costuma ter observação de baleias em alguns meses. Verifique o calendário.',
        'Pode nevar no período, leve casaco.',
    ];
    for (const f of permitidas) {
        assert.equal(afirmaFenomenoSazonal(f), false, `não deveria bloquear: "${f}"`);
        assert.equal(aplicarGuardaSazonal(f).texto, f);
    }
});

// ============================================================
// COM FONTE, A AFIRMAÇÃO É SUSTENTADA
// ============================================================
test('verificado externamente, o texto passa como veio', () => {
    const frase = 'Período de seca: muitas lagoas podem estar com nível baixo.';
    const r = aplicarGuardaSazonal(frase, { verificado: true });
    assert.equal(r.texto, frase);
    assert.equal(r.descartada, false);
});

test('mesmo uma afirmação forte passa quando há fonte', () => {
    const frase = 'As lagoas estarão cheias neste período.';
    assert.equal(aplicarGuardaSazonal(frase, { verificado: true }).texto, frase);
    assert.equal(aplicarGuardaSazonal(frase, { verificado: false }).texto, null);
});

// ============================================================
// BORDAS
// ============================================================
test('texto vazio não vira descarte nem erro', () => {
    for (const v of ['', '   ', null, undefined]) {
        const r = aplicarGuardaSazonal(v);
        assert.equal(r.texto, null);
        assert.equal(r.descartada, false);
    }
});

test('o texto substituto orienta a conferir, sem afirmar nada', () => {
    assert.match(TEXTO_SEM_FONTE, /variam/i);
    assert.match(TEXTO_SEM_FONTE, /Confirme/i);
    assert.equal(afirmaFenomenoSazonal(TEXTO_SEM_FONTE), false,
        'o próprio substituto não pode ser bloqueado pela guarda');
});

// ============================================================
// PROMPT
// ============================================================
test('as instruções do prompt trazem exemplos de errado e certo', () => {
    assert.match(INSTRUCOES_SAZONALIDADE, /Errado:/);
    assert.match(INSTRUCOES_SAZONALIDADE, /Certo:/);
    assert.match(INSTRUCOES_SAZONALIDADE, /lagoas cheias/i);
    assert.match(INSTRUCOES_SAZONALIDADE, /DESCARTADA/);
});

test('os exemplos "certo" do prompt sobrevivem à própria guarda', () => {
    // Se o prompt ensinasse uma frase que a guarda depois bloqueia, as duas
    // camadas estariam brigando entre si.
    const certos = INSTRUCOES_SAZONALIDADE
        .split('\n')
        .filter((l) => l.trim().startsWith('- Certo:'))
        .map((l) => l.replace(/^\s*- Certo:\s*/, '').replace(/^"|"$/g, ''));
    assert.ok(certos.length >= 3, 'o prompt precisa de exemplos positivos');
    for (const frase of certos) {
        assert.equal(afirmaFenomenoSazonal(frase), false, `o prompt ensina uma frase que a guarda bloqueia: "${frase}"`);
    }
});

test('os exemplos "errado" do prompt são de fato bloqueados', () => {
    const errados = INSTRUCOES_SAZONALIDADE
        .split('\n')
        .filter((l) => l.trim().startsWith('- Errado:'))
        .map((l) => l.replace(/^\s*- Errado:\s*/, '').replace(/^"|"$/g, ''));
    assert.ok(errados.length >= 3);
    for (const frase of errados) {
        assert.equal(afirmaFenomenoSazonal(frase), true, `o prompt chama de errado algo que a guarda deixa passar: "${frase}"`);
    }
});
