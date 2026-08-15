// Identidade do destino
//
// O provedor devolve nome, país, aeroporto e coordenada como campos soltos.
// Dois erros reais motivaram este módulo:
//
//   1. "São Petersburgo" com país "Estados Unidos" e aeroporto TPA — é St.
//      Petersburg, na Flórida, servida pelo aeroporto de Tampa. Nada na tela
//      nem no prompt dizia isso, e o nome puxa a cidade russa.
//   2. Foto de praia num card de Belo Horizonte — a miniatura vem do
//      provedor e ninguém confere o que ela mostra.
//
// A parte determinística cobre o que dá para provar: par destino/aeroporto.
// A parte de prompt cobre o que não dá: sobre QUAL cidade o texto fala.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    coordenadasDe,
    descreverCoordenadas,
    linhaLocalizacao,
    bboxDe,
    avaliarIdentidade,
    identidadeQuebrada,
    INSTRUCOES_IDENTIDADE,
} from '../api/_lib/destination-identity.js';

// Recorte real de public/data/iata_geo_lookup.json
const LOOKUP = {
    TPA: { codigo_pais: 'US', pais: 'Estados Unidos', continente: 'América do Norte', bbox_continente: '[[7.0, -170.0], [84.0, -52.0]]' },
    CNF: { codigo_pais: 'BR', pais: 'Brasil', continente: 'América do Sul', bbox_continente: '[[-56.0, -82.0], [13.0, -34.0]]' },
    IGU: { codigo_pais: 'BR', pais: 'Brasil', continente: 'América do Sul', bbox_continente: '[[-56.0, -82.0], [13.0, -34.0]]' },
    LED: { codigo_pais: 'RU', pais: 'Rússia', continente: 'Europa', bbox_continente: '[[35.0, -25.0], [72.0, 45.0]]' },
};

// ============================================================
// COORDENADAS — melhor não ter do que ter trocada
// ============================================================
test('as grafias de objeto conhecidas são aceitas', () => {
    assert.deepEqual(coordenadasDe({ latitude: -19.9227, longitude: -43.9451 }), { lat: -19.9227, lon: -43.9451 });
    assert.deepEqual(coordenadasDe({ lat: -19.9227, lng: -43.9451 }), { lat: -19.9227, lon: -43.9451 });
    assert.deepEqual(coordenadasDe({ lat: -19.9227, lon: -43.9451 }), { lat: -19.9227, lon: -43.9451 });
});

test('array é recusado: [lat,lon] e [lon,lat] são indistinguíveis', () => {
    // Ler na ordem errada joga Belo Horizonte no meio do Atlântico. Sem
    // convenção declarada pelo provedor, o certo é não ter coordenada.
    assert.equal(coordenadasDe([-19.9227, -43.9451]), null);
    assert.equal(coordenadasDe([-43.9451, -19.9227]), null);
});

test('coordenada fora de faixa ou zerada não vira localização', () => {
    assert.equal(coordenadasDe({ latitude: 120, longitude: 10 }), null);
    assert.equal(coordenadasDe({ latitude: 10, longitude: 999 }), null);
    assert.equal(coordenadasDe({ latitude: 0, longitude: 0 }), null, 'campo vazio preenchido com zero não é o Golfo da Guiné');
    assert.equal(coordenadasDe(null), null);
    assert.equal(coordenadasDe({}), null);
});

test('a coordenada entra no prompt junto do país', () => {
    assert.equal(descreverCoordenadas({ latitude: 27.7676, longitude: -82.6403 }), '27.7676,-82.6403');
    assert.equal(
        linhaLocalizacao({ country: 'Estados Unidos', coordinates: { latitude: 27.7676, longitude: -82.6403 } }),
        'Estados Unidos @27.7676,-82.6403'
    );
});

test('destino sem coordenada ainda leva o país, sem inventar região', () => {
    assert.equal(linhaLocalizacao({ country: 'Brasil' }), 'Brasil');
    assert.equal(linhaLocalizacao({ country: 'Brasil', coordinates: [1, 2] }), 'Brasil');
    assert.equal(linhaLocalizacao({}), '?');
});

// ============================================================
// BBOX
// ============================================================
test('a bbox do lookup é lida como string ou como array', () => {
    assert.deepEqual(bboxDe('[[-56.0, -82.0], [13.0, -34.0]]'), { latMin: -56, lonMin: -82, latMax: 13, lonMax: -34 });
    assert.deepEqual(bboxDe([[-56, -82], [13, -34]]), { latMin: -56, lonMin: -82, latMax: 13, lonMax: -34 });
});

test('bbox malformada não vira caixa: nenhuma checagem é feita com lixo', () => {
    for (const ruim of ['', 'null', '[[1,2]]', '[[13,-34],[-56,-82]]', undefined, 42]) {
        assert.equal(bboxDe(ruim), null, `bbox aceita indevidamente: ${JSON.stringify(ruim)}`);
    }
});

// ============================================================
// AVALIAÇÃO DO PAR DESTINO x AEROPORTO
// ============================================================
test('São Petersburgo/EUA via Tampa é um par válido, não um erro', () => {
    // As duas cidades ficam na mesma região metropolitana da Flórida. O
    // card precisa contextualizar, mas a oferta é real e não pode sumir.
    const id = avaliarIdentidade({
        name: 'São Petersburgo',
        country: 'Estados Unidos',
        primary_airport: 'TPA',
        coordinates: { latitude: 27.7676, longitude: -82.6403 },
    }, LOOKUP);

    assert.equal(id.aeroportoEmOutroPais, false);
    assert.equal(id.foraDoContinente, false);
    assert.equal(identidadeQuebrada(id), false, 'oferta legítima não pode ser descartada');
    assert.equal(id.coordenadas, '27.7676,-82.6403');
});

test('destino em outro continente que o do aeroporto é registro quebrado', () => {
    // O caso que o nome sozinho produz: São Petersburgo da Rússia colada
    // num voo para a Flórida. Coordenada e aeroporto se contradizem.
    const id = avaliarIdentidade({
        name: 'São Petersburgo',
        country: 'Estados Unidos',
        primary_airport: 'TPA',
        coordinates: { latitude: 59.9343, longitude: 30.3351 },
    }, LOOKUP);

    assert.equal(id.foraDoContinente, true);
    assert.equal(identidadeQuebrada(id), true);
});

test('aeroporto em outro país é rótulo, nunca descarte', () => {
    // Puerto Iguazú é argentina e usa IGU, do lado brasileiro. Par real.
    const id = avaliarIdentidade({
        name: 'Puerto Iguazú',
        country: 'Argentina',
        primary_airport: 'IGU',
        coordinates: { latitude: -25.5994, longitude: -54.5735 },
    }, LOOKUP);

    assert.equal(id.aeroportoEmOutroPais, true);
    assert.equal(id.paisAeroporto, 'Brasil');
    assert.equal(identidadeQuebrada(id), false, 'fronteira atravessada não invalida a tarifa');
});

test('sem dado suficiente a avaliação devolve null, não "ok"', () => {
    // null significa "não deu para verificar". Tratar como aprovado seria
    // exibir garantia que não existe.
    const semCoord = avaliarIdentidade({ name: 'X', country: 'Brasil', primary_airport: 'CNF' }, LOOKUP);
    assert.equal(semCoord.foraDoContinente, null);
    assert.equal(identidadeQuebrada(semCoord), false);

    const aeroportoDesconhecido = avaliarIdentidade({
        name: 'X', country: 'Brasil', primary_airport: 'ZZZ',
        coordinates: { latitude: -19.9, longitude: -43.9 },
    }, LOOKUP);
    assert.equal(aeroportoDesconhecido.aeroportoEmOutroPais, null);
    assert.equal(aeroportoDesconhecido.foraDoContinente, null);
    assert.equal(identidadeQuebrada(aeroportoDesconhecido), false);
});

test('acento no nome do país não vira divergência de país', () => {
    const id = avaliarIdentidade({
        name: 'Belo Horizonte', country: 'BRASIL', primary_airport: 'CNF',
        coordinates: { latitude: -19.9227, longitude: -43.9451 },
    }, LOOKUP);
    assert.equal(id.aeroportoEmOutroPais, false);
});

// ============================================================
// INSTRUÇÕES DO PROMPT
//
// Primeira camada: o modelo escrevia sobre a cidade errada porque o prompt
// entregava só nome e país e não proibia nada.
// ============================================================
test('o prompt nomeia o erro concreto e manda o país prevalecer', () => {
    assert.match(INSTRUCOES_IDENTIDADE, /São Petersburgo/);
    assert.match(INSTRUCOES_IDENTIDADE, /coordenada/i);
    assert.match(INSTRUCOES_IDENTIDADE, /hom[ôo]nimo/i);
});

test('o prompt proíbe citar ponto turístico sem certeza', () => {
    assert.match(INSTRUCOES_IDENTIDADE, /N[ÃA]O afirme que um ponto tur[íi]stico/i);
    assert.match(INSTRUCOES_IDENTIDADE, /gen[ée]rico e correto/i);
});

test('o prompt separa aeroporto de destino', () => {
    assert.match(INSTRUCOES_IDENTIDADE, /O AEROPORTO NÃO É O DESTINO/);
    assert.match(INSTRUCOES_IDENTIDADE, /TPA/);
    assert.match(INSTRUCOES_IDENTIDADE, /deslocamento terrestre/i);
});
