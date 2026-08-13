// Testes da regra de feriados (P0 — Escapadas)
// Cobre os 7 dias da semana: dias livres, noites e dias de folga necessários.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    janelaDoFeriado,
    descricaoEmenda,
    diaDaSemana,
    feriadosDoAno,
    calcularPascoa,
    diffDias,
} from '../api/_lib/feriados.js';

// Datas reais de 2026 usadas como feriado de teste, uma por dia da semana
const DATAS = {
    domingo: '2026-11-01',
    segunda: '2026-11-02',
    terca: '2026-11-03',
    quarta: '2026-11-04',
    quinta: '2026-11-05',
    sexta: '2026-11-06',
    sabado: '2026-11-07',
};

function feriado(data) {
    return { slug: 'teste', nome: 'Feriado de teste', data, ano: 2026, diaSemana: diaDaSemana(data) };
}

test('as datas de teste cobrem os 7 dias da semana', () => {
    assert.equal(diaDaSemana(DATAS.domingo), 0);
    assert.equal(diaDaSemana(DATAS.segunda), 1);
    assert.equal(diaDaSemana(DATAS.terca), 2);
    assert.equal(diaDaSemana(DATAS.quarta), 3);
    assert.equal(diaDaSemana(DATAS.quinta), 4);
    assert.equal(diaDaSemana(DATAS.sexta), 5);
    assert.equal(diaDaSemana(DATAS.sabado), 6);
});

test('sexta-feira: 3 dias livres sem folga', () => {
    const j = janelaDoFeriado(feriado(DATAS.sexta));
    assert.equal(j.folga, 0);
    assert.equal(j.diasLivres, 3);
    assert.equal(j.estendeFimDeSemana, true);
});

test('segunda-feira: 3 dias livres sem folga', () => {
    const j = janelaDoFeriado(feriado(DATAS.segunda));
    assert.equal(j.folga, 0);
    assert.equal(j.diasLivres, 3);
    assert.equal(j.estendeFimDeSemana, true);
});

test('sábado NÃO cria automaticamente um terceiro dia', () => {
    const j = janelaDoFeriado(feriado(DATAS.sabado));
    assert.equal(j.estendeFimDeSemana, false);
    assert.equal(j.diasLivres, 2, 'sábado já era dia livre');
    const texto = descricaoEmenda(feriado(DATAS.sabado));
    assert.ok(!/3 dias/.test(texto), `texto não pode prometer 3 dias: "${texto}"`);
    assert.match(texto, /não estende/);
});

test('domingo NÃO cria automaticamente um terceiro dia', () => {
    const j = janelaDoFeriado(feriado(DATAS.domingo));
    assert.equal(j.estendeFimDeSemana, false);
    assert.equal(j.diasLivres, 2, 'domingo já era dia livre');
    const texto = descricaoEmenda(feriado(DATAS.domingo));
    assert.ok(!/3 dias/.test(texto), `texto não pode prometer 3 dias: "${texto}"`);
    assert.match(texto, /não estende/);
});

test('terça-feira: 4 dias livres usando 1 folga na segunda', () => {
    const j = janelaDoFeriado(feriado(DATAS.terca));
    assert.equal(j.folga, 1);
    assert.equal(j.diasLivres, 4);
    assert.equal(diaDaSemana(j.ida), 6, 'a janela começa no sábado');
});

test('quinta-feira: 4 dias livres usando 1 folga na sexta', () => {
    const j = janelaDoFeriado(feriado(DATAS.quinta));
    assert.equal(j.folga, 1);
    assert.equal(j.diasLivres, 4);
    assert.equal(diaDaSemana(j.volta), 0, 'a janela termina no domingo');
});

test('quarta-feira não é fim de semana prolongado automático', () => {
    const j = janelaDoFeriado(feriado(DATAS.quarta));
    assert.equal(j.estendeFimDeSemana, false);
    assert.equal(j.folga, 2);
    const texto = descricaoEmenda(feriado(DATAS.quarta));
    assert.match(texto, /2 dias de folga/);
});

test('nenhum feriado promete dia livre sem folga correspondente', () => {
    for (const data of Object.values(DATAS)) {
        const f = feriado(data);
        const j = janelaDoFeriado(f);
        // Um feriado só pode render mais que o fim de semana (2 dias livres)
        // se ele mesmo estende o fim de semana OU se há folga pedida.
        if (j.diasLivres > 2) {
            assert.ok(j.estendeFimDeSemana || j.folga > 0,
                `${data} promete ${j.diasLivres} dias livres sem justificativa`);
        }
        assert.equal(j.noites, diffDias(j.ida, j.volta));
        assert.ok(j.noites >= 1, `${data} gerou janela sem noites`);
    }
});

test('descrição sempre distingue noites de dias livres', () => {
    for (const data of Object.values(DATAS)) {
        assert.match(descricaoEmenda(feriado(data)), /noite/);
    }
});

// ── Sanidade do cálculo de feriados móveis ──
test('Páscoa e feriados nacionais de 2026 estão corretos', () => {
    assert.equal(calcularPascoa(2026), '2026-04-05');
    const doAno = feriadosDoAno(2026);
    const natal = doAno.find(f => f.slug === 'natal');
    assert.equal(natal.data, '2026-12-25');
    const carnaval = doAno.find(f => f.slug === 'carnaval');
    assert.equal(diaDaSemana(carnaval.data), 2, 'Carnaval cai sempre numa terça');
});
