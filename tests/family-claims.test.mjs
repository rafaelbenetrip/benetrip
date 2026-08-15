// Critério de seleção x texto do card, em buscas com crianças e bebês
//
// O bloco de família do prompt pedia "considere destinos com hospitais e
// clínicas acessíveis" para orientar a ESCOLHA. Nada dizia que era critério
// de escolha, e o resultado apareceu na tela: todos os cards, de todas as
// cidades, gastando o pouco espaço que têm para falar da rede de saúde do
// lugar — sobre a qual não temos dado nenhum.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    afirmaInfraestruturaDeSaude,
    removerAfirmacoesDeSaude,
    limparAfirmacoesDeSaude,
    blocoRestricoesFamilia,
} from '../api/_lib/family-claims.js';

// ============================================================
// DETECÇÃO
// ============================================================
test('afirmação sobre rede de saúde é reconhecida em suas variações', () => {
    const exemplos = [
        'A cidade tem bons hospitais.',
        'Hospital de referência a poucos minutos.',
        'Conta com clínicas acessíveis para emergências.',
        'Tem pronto-socorro 24 horas.',
        'Boa estrutura de saúde para quem viaja com bebê.',
        'A infraestrutura médica é confiável.',
        'Rede hospitalar completa.',
        'Atendimento médico de qualidade.',
        'Posto de saúde no centro.',
        'Assistência médica próxima aos hotéis.',
    ];
    for (const frase of exemplos) {
        assert.ok(afirmaInfraestruturaDeSaude(frase), `não detectou: ${frase}`);
    }
});

test('passeio de bem-estar não é alegação sobre rede hospitalar', () => {
    // Nunca um /saúde/ solto: termas e turismo de saúde são categoria de
    // passeio, e derrubá-las seria censurar o destino, não a alegação.
    const inocentes = [
        'A cidade é conhecida pelo turismo de saúde e pelas termas.',
        'As praias são calmas e boas para crianças.',
        'O centro é plano, dá para andar com carrinho sem sufoco.',
        'O voo curto ajuda muito com bebê no colo.',
        '',
    ];
    for (const frase of inocentes) {
        assert.ok(!afirmaInfraestruturaDeSaude(frase), `falso positivo: ${frase}`);
    }
});

// ============================================================
// REMOÇÃO — o card não pode ficar mudo por causa de uma frase
// ============================================================
test('a oração sobre saúde sai e o resto do comentário fica', () => {
    const r = removerAfirmacoesDeSaude(
        'Essa cidade é um encanto! A rede hospitalar é excelente. As praças são cheias de crianças brincando.'
    );
    assert.equal(r.removidas, 1);
    assert.match(r.texto, /Essa cidade é um encanto!/);
    assert.match(r.texto, /As praças são cheias de crianças brincando\./);
    assert.ok(!/hospitalar/i.test(r.texto));
});

test('texto que só fala de saúde fica vazio, e o bloco some do card', () => {
    const r = removerAfirmacoesDeSaude('A cidade tem ótimos hospitais e clínicas acessíveis.');
    assert.equal(r.texto, '');
    assert.equal(r.removidas, 1);
});

test('texto sem menção nenhuma passa intacto', () => {
    const original = 'Praias calmas, comida boa e um centrinho para caminhar à noite.';
    const r = removerAfirmacoesDeSaude(original);
    assert.equal(r.texto, original);
    assert.equal(r.removidas, 0);
});

test('menção grudada por vírgula derruba a oração inteira, não corta no meio', () => {
    // Recortar "é seguro, tem bons hospitais e fica perto do mar" na vírgula
    // produziria frase quebrada. Texto a menos é melhor que texto truncado.
    const r = removerAfirmacoesDeSaude('É seguro, tem bons hospitais e fica perto do mar. O centro é charmoso.');
    assert.ok(!/hospitais/i.test(r.texto));
    assert.ok(!r.texto.includes('É seguro,'), 'a oração quebrada não pode sobrar pela metade');
    assert.match(r.texto, /O centro é charmoso\./);
});

// ============================================================
// APLICAÇÃO A TODOS OS CAMPOS DO CARD
// ============================================================
test('a guarda cobre todos os campos de texto, não só o comentário', () => {
    const { destino, removidas } = limparAfirmacoesDeSaude({
        name: 'Cidade X',
        razao: 'Ótimo para família, com hospitais por perto.',
        comentario: 'Você vai amar as praças! O atendimento médico é bom.',
        dica: 'Leve protetor solar.',
        ponto_negativo: 'O hospital mais próximo fica a 2 horas de carro.',
        flight: { price: 1000 },
    });

    assert.equal(removidas, 3);
    assert.equal(destino.razao, '');
    assert.equal(destino.comentario, 'Você vai amar as praças!');
    assert.equal(destino.dica, 'Leve protetor solar.', 'campo limpo não pode ser tocado');
    assert.equal(destino.ponto_negativo, '', 'aviso sem fonte também é palpite');
    assert.deepEqual(destino.flight, { price: 1000 }, 'a guarda não mexe em dado de voo');
});

test('destino sem os campos de texto não quebra a guarda', () => {
    const { destino, removidas } = limparAfirmacoesDeSaude({ name: 'Y', flight: {} });
    assert.equal(removidas, 0);
    assert.equal(destino.name, 'Y');
});

// ============================================================
// BLOCO DO PROMPT
// ============================================================
test('o bloco separa critério de escolha de assunto do texto', () => {
    const bloco = blocoRestricoesFamilia({ criancas: 2, bebes: 0 });
    assert.match(bloco, /CRITÉRIO DE ESCOLHA, não assunto para os textos/);
    assert.match(bloco, /PROIBIDO FALAR DE SAÚDE/);
    assert.match(bloco, /DESCARTADA automaticamente/);
});

test('o bloco não pede mais que a IA avalie hospitais', () => {
    // A linha "Considere destinos com hospitais/clínicas acessíveis" era a
    // origem do texto repetido. Pedir isso é pedir para o modelo inventar
    // um critério que nenhum dado sustenta.
    for (const perfil of [{ criancas: 2 }, { bebes: 1 }, { criancas: 1, bebes: 1 }]) {
        const bloco = blocoRestricoesFamilia(perfil);
        assert.ok(!/Considere destinos com hospitais/i.test(bloco));
        assert.ok(!/boa estrutura de saúde e clima ameno/i.test(bloco));
    }
});

test('o bloco mostra o certo e o errado, como a guarda sazonal', () => {
    const bloco = blocoRestricoesFamilia({ bebes: 1 });
    assert.match(bloco, /Errado:/);
    assert.match(bloco, /Certo:/);
});

test('viagem sem crianças nem bebês não recebe bloco nenhum', () => {
    assert.equal(blocoRestricoesFamilia({ criancas: 0, bebes: 0 }), '');
    assert.equal(blocoRestricoesFamilia({}), '');
    assert.equal(blocoRestricoesFamilia(), '');
});

test('as linhas específicas seguem condicionadas ao perfil', () => {
    assert.match(blocoRestricoesFamilia({ bebes: 1 }), /BEBÊ\(S\) NO COLO/);
    assert.ok(!/BEBÊ\(S\) NO COLO/.test(blocoRestricoesFamilia({ criancas: 2 })));
    assert.match(blocoRestricoesFamilia({ criancas: 2 }), /CRIANÇAS:/);
});
