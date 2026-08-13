// Testes das restrições do roteiro (P0)
// Cenário da auditoria: "evitar deslocamentos longos e atividades noturnas"
// foi prometido no texto e violado quatro vezes no roteiro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    extrairRestricoes,
    blocoInstrucoes,
    validarRoteiro,
    aplicarRestricoes,
    tipoDeClima,
    rotuloClima,
} from '../api/_lib/itinerary-constraints.js';

const atividade = (nome, extra = {}) => ({ nome, descricao: '', tags: [], ...extra });

const roteiroCom = (periodos) => ({
    dias: [{ dia_numero: 1, periodos }],
});

// ============================================================
// EXTRAÇÃO DE RESTRIÇÕES DO TEXTO LIVRE
// ============================================================
test('reconhece o pedido da auditoria', () => {
    const r = extrairRestricoes({ observacoes: 'Evitar deslocamentos longos e atividades noturnas' });
    assert.ok(r.chaves.includes('evitar_noturnas'));
    assert.ok(r.chaves.includes('evitar_deslocamentos_longos'));
    assert.ok(r.obrigatorias.includes('evitar_noturnas'), 'noturnas é restrição conferida');
});

test('reconhece variações comuns de escrita', () => {
    for (const texto of ['sem atividades noturnas', 'nada de vida noturna', 'não quero programa à noite']) {
        assert.ok(extrairRestricoes({ observacoes: texto }).chaves.includes('evitar_noturnas'), texto);
    }
});

test('não confunde pedido POSITIVO por vida noturna com restrição', () => {
    for (const texto of ['quero muita vida noturna', 'evitar museus e incluir vida noturna', 'adoramos balada']) {
        assert.ok(!extrairRestricoes({ observacoes: texto }).chaves.includes('evitar_noturnas'),
            `não deveria restringir noturnas em: ${texto}`);
    }
});

test('negação composta ("não quero") é entendida como restrição', () => {
    assert.ok(extrairRestricoes({ observacoes: 'não quero programa à noite' }).chaves.includes('evitar_noturnas'));
});

test('reconhece mobilidade reduzida, escadas e restrição alimentar', () => {
    const r = extrairRestricoes({ observacoes: 'Minha mãe tem mobilidade reduzida, evitar escadas. Sou vegetariano.' });
    assert.ok(r.chaves.includes('mobilidade_reduzida'));
    assert.ok(r.chaves.includes('evitar_escadas'));
    assert.ok(r.chaves.includes('restricao_alimentar'));
});

test('campos estruturados do formulário também viram restrição', () => {
    const r = extrairRestricoes({ observacoes: '', criancas: 2, bebes: 1, intensidade: 'leve' });
    assert.ok(r.chaves.includes('criancas_pequenas'));
    assert.ok(r.chaves.includes('bebe'));
    assert.ok(r.chaves.includes('ritmo_leve'));
});

test('sem pedidos não há restrições', () => {
    const r = extrairRestricoes({ observacoes: 'Quero conhecer a cidade' });
    assert.deepEqual(r.chaves, []);
    assert.equal(blocoInstrucoes(r), '');
});

test('bloco de instruções marca o que é obrigatório', () => {
    const bloco = blocoInstrucoes(extrairRestricoes({ observacoes: 'sem atividades noturnas' }));
    assert.match(bloco, /OBRIGATÓRIO/);
    assert.match(bloco, /noite/i);
});

// ============================================================
// VALIDAÇÃO — detecta o que o modelo violou
// ============================================================
test('detecta as quatro atividades noturnas do cenário auditado', () => {
    const r = extrairRestricoes({ observacoes: 'evitar atividades noturnas' });
    const roteiro = {
        dias: [
            { dia_numero: 1, periodos: [
                { periodo: 'manhã', atividades: [atividade('Mercado Modelo')] },
                { periodo: 'noite', atividades: [atividade('Jantar no Pelourinho')] },
            ] },
            { dia_numero: 2, periodos: [
                { periodo: 'noite', atividades: [atividade('Show na Casa do Samba'), atividade('Bar do Porto')] },
            ] },
            { dia_numero: 3, periodos: [
                { periodo: 'tarde', atividades: [atividade('Rooftop com drinks')] },
            ] },
        ],
    };
    const violacoes = validarRoteiro(roteiro, r);
    assert.equal(violacoes.length, 4);
    assert.ok(violacoes.every(v => v.restricao === 'evitar_noturnas'));
});

test('atividade noturna disfarçada em período da tarde é pega pelo conteúdo', () => {
    const r = extrairRestricoes({ observacoes: 'sem atividades noturnas' });
    const roteiro = roteiroCom([{ periodo: 'tarde', atividades: [atividade('Balada no centro')] }]);
    assert.equal(validarRoteiro(roteiro, r).length, 1);
});

test('sem restrição obrigatória não há violação', () => {
    const r = extrairRestricoes({ observacoes: 'ritmo leve' });
    const roteiro = roteiroCom([{ periodo: 'noite', atividades: [atividade('Show')] }]);
    assert.deepEqual(validarRoteiro(roteiro, r), []);
});

test('mobilidade reduzida barra trilha e escadaria', () => {
    const r = extrairRestricoes({ observacoes: 'viajo com alguém de mobilidade reduzida' });
    const roteiro = roteiroCom([{ periodo: 'manhã', atividades: [
        atividade('Trilha da Pedra Bonita'),
        atividade('Escadaria Selarón'),
        atividade('Museu de Arte'),
    ] }]);
    assert.equal(validarRoteiro(roteiro, r).length, 2);
});

// ============================================================
// APLICAÇÃO — o roteiro entregue realmente respeita
// ============================================================
test('atividades que violam restrição obrigatória são removidas', () => {
    const r = extrairRestricoes({ observacoes: 'evitar atividades noturnas' });
    const roteiro = {
        dias: [{ dia_numero: 1, periodos: [
            { periodo: 'manhã', atividades: [atividade('Mercado')] },
            { periodo: 'noite', atividades: [atividade('Bar do Porto')] },
        ] }],
    };
    const { roteiro: limpo, removidas } = aplicarRestricoes(roteiro, r);
    assert.equal(removidas.length, 1);
    assert.equal(validarRoteiro(limpo, r).length, 0, 'o roteiro entregue não pode mais violar');
    assert.equal(limpo.dias[0].periodos.length, 1, 'período vazio é descartado');
    assert.equal(limpo.dias[0].periodos[0].periodo, 'manhã');
});

test('atividades válidas são preservadas intactas', () => {
    const r = extrairRestricoes({ observacoes: 'evitar atividades noturnas' });
    const roteiro = roteiroCom([{ periodo: 'tarde', atividades: [atividade('Museu'), atividade('Praia')] }]);
    const { roteiro: limpo, removidas } = aplicarRestricoes(roteiro, r);
    assert.equal(removidas.length, 0);
    assert.equal(limpo.dias[0].periodos[0].atividades.length, 2);
});

test('sem restrições o roteiro passa inalterado', () => {
    const r = extrairRestricoes({ observacoes: '' });
    const roteiro = roteiroCom([{ periodo: 'noite', atividades: [atividade('Show')] }]);
    const { roteiro: saida, removidas } = aplicarRestricoes(roteiro, r);
    assert.equal(removidas.length, 0);
    assert.deepEqual(saida.dias[0].periodos[0].atividades.length, 1);
});

// ============================================================
// CLIMA — previsão só dentro do horizonte
// ============================================================
test('viagem a meses de distância é clima típico, não previsão', () => {
    const hoje = new Date('2026-08-13T12:00:00Z');
    assert.equal(tipoDeClima('2026-11-12', hoje), 'tipico');
    assert.equal(rotuloClima('tipico'), 'Clima típico para o período');
});

test('viagem dentro do horizonte pode ser previsão', () => {
    const hoje = new Date('2026-08-13T12:00:00Z');
    assert.equal(tipoDeClima('2026-08-20', hoje), 'previsao');
    assert.equal(rotuloClima('previsao'), 'Previsão do tempo');
});

test('limite do horizonte é respeitado', () => {
    const hoje = new Date('2026-08-13T12:00:00Z');
    assert.equal(tipoDeClima('2026-08-27', hoje), 'previsao', '14 dias ainda é previsão');
    assert.equal(tipoDeClima('2026-08-28', hoje), 'tipico', '15 dias já é clima típico');
});

test('data ausente ou inválida cai em clima típico', () => {
    assert.equal(tipoDeClima(null), 'tipico');
    assert.equal(tipoDeClima('data-invalida'), 'tipico');
});
