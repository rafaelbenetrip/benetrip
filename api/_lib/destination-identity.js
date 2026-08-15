// api/_lib/destination-identity.js - IDENTIDADE DO DESTINO v1.0
//
// O provedor de destinos (google_travel_explore, via SearchAPI) devolve nome,
// país, aeroporto e coordenadas. O NOME sozinho não identifica um lugar:
//
//   - "São Petersburgo" com país "Estados Unidos" é St. Petersburg, na
//     Flórida, e não a cidade russa que o nome evoca em português;
//   - "Santiago" existe no Chile, na Espanha, no Brasil e nas Filipinas;
//   - "Córdoba" existe na Argentina, na Espanha e no México.
//
// Quem lê só o nome — o modelo que escreve o comentário do card, e o viajante
// que lê o card — completa a lacuna com o lugar mais famoso. Foi assim que a
// Descoberta ofereceu São Petersburgo/EUA com aeroporto em Tampa sem que nada
// na tela explicasse que são duas cidades diferentes da mesma região.
//
// Este módulo tem duas camadas, na mesma divisão de seasonal-claims.js:
//
//   1. INSTRUCOES_IDENTIDADE + linhaLocalizacao(): reduzem o erro na origem,
//      dando ao modelo a coordenada e proibindo descrever o homônimo.
//   2. avaliarIdentidade(): determinística, roda DEPOIS e não depende de o
//      modelo obedecer. Compara o país do AEROPORTO com o país do DESTINO e
//      confere se a coordenada cai no continente daquele aeroporto.
//
// Sem catálogo de destinos: o que entra aqui é o que o provedor já devolveu
// mais a tabela de aeroportos que o projeto já mantém. Destino sem coordenada
// ou com aeroporto desconhecido passa intacto, sem afirmação nenhuma.

// ============================================================
// COORDENADAS
//
// O provedor não garante um formato único. Aceitamos as grafias de objeto
// conhecidas e recusamos array: [-43.9, -19.9] e [-19.9, -43.9] são
// indistinguíveis sem convenção, e trocar latitude por longitude coloca o
// destino no oceano. Preferimos não ter coordenada a ter a errada.
// ============================================================
export function coordenadasDe(coordinates) {
    if (!coordinates || typeof coordinates !== 'object' || Array.isArray(coordinates)) return null;

    const lat = Number(
        coordinates.latitude ?? coordinates.lat ?? coordinates.latitud ?? NaN
    );
    const lon = Number(
        coordinates.longitude ?? coordinates.lng ?? coordinates.lon ?? coordinates.long ?? NaN
    );

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    // 0,0 é o Golfo da Guiné: na prática é campo vazio preenchido com zero.
    if (lat === 0 && lon === 0) return null;

    return { lat, lon };
}

// "-19.9227,-43.9451" — 4 casas resolvem ~11 m, mais que suficiente para
// identificar uma cidade e curto o bastante para caber no prompt.
export function descreverCoordenadas(coordinates) {
    const c = coordenadasDe(coordinates);
    if (!c) return '';
    return `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
}

// Linha de localização usada no prompt: coordenada quando existe, país
// sempre. Nunca inventa região que o provedor não devolveu.
export function linhaLocalizacao(destino) {
    const d = destino || {};
    const coord = descreverCoordenadas(d.coordinates);
    return coord ? `${d.country || '?'} @${coord}` : `${d.country || '?'}`;
}

// ============================================================
// BOUNDING BOX DO CONTINENTE
//
// iata_geo_lookup.json guarda a bbox como string, no formato
// "[[latMin, lonMin], [latMax, lonMax]]".
// ============================================================
export function bboxDe(valor) {
    let bruto = valor;
    if (typeof bruto === 'string') {
        try {
            bruto = JSON.parse(bruto);
        } catch {
            return null;
        }
    }
    if (!Array.isArray(bruto) || bruto.length !== 2) return null;
    const [min, max] = bruto;
    if (!Array.isArray(min) || !Array.isArray(max)) return null;

    const [latMin, lonMin] = min.map(Number);
    const [latMax, lonMax] = max.map(Number);
    if (![latMin, lonMin, latMax, lonMax].every(Number.isFinite)) return null;
    if (latMin >= latMax || lonMin >= lonMax) return null;

    return { latMin, lonMin, latMax, lonMax };
}

export function dentroDaBbox(coord, bbox) {
    if (!coord || !bbox) return null;
    return coord.lat >= bbox.latMin && coord.lat <= bbox.latMax
        && coord.lon >= bbox.lonMin && coord.lon <= bbox.lonMax;
}

// ============================================================
// AVALIAÇÃO DETERMINÍSTICA
//
// Retorna sempre um objeto, mesmo sem dado suficiente. Campo null significa
// "não deu para verificar" e nunca deve ser exibido como se fosse "ok".
//
//   aeroportoEmOutroPais  o voo pousa em país diferente do país do destino
//   foraDoContinente      a coordenada do destino não cai no continente do
//                         aeroporto: o par destino/aeroporto está quebrado
//
// Aeroporto em outro país NÃO é erro: Foz/Puerto Iguazú, Jaguarão/Montevidéu
// e Punta Cana servindo o Haiti são pares reais. É informação que precisa
// aparecer no card, não motivo para descartar a oferta.
// ============================================================
export function avaliarIdentidade(destino, lookupIata) {
    const d = destino || {};
    const iata = String(d.primary_airport || d.flight?.airport_code || '').toUpperCase();
    const geoAeroporto = (iata && lookupIata) ? lookupIata[iata] || null : null;
    const coord = coordenadasDe(d.coordinates);

    const paisDestino = String(d.country || '').trim();
    const paisAeroporto = String(geoAeroporto?.pais || '').trim();

    const aeroportoEmOutroPais = (paisDestino && paisAeroporto)
        ? normalizar(paisDestino) !== normalizar(paisAeroporto)
        : null;

    const bbox = bboxDe(geoAeroporto?.bbox_continente);
    const dentro = dentroDaBbox(coord, bbox);
    const foraDoContinente = dentro === null ? null : !dentro;

    return {
        aeroporto: iata || null,
        paisDestino: paisDestino || null,
        paisAeroporto: paisAeroporto || null,
        continenteAeroporto: geoAeroporto?.continente || null,
        coordenadas: coord ? descreverCoordenadas(d.coordinates) : null,
        aeroportoEmOutroPais,
        foraDoContinente,
    };
}

// Só descartamos com prova: coordenada válida, bbox conhecida e o ponto fora
// dela. Isso não é "aeroporto longe" — é destino em outro continente que o do
// aeroporto cuja tarifa estamos exibindo, ou seja, registro quebrado.
export function identidadeQuebrada(identidade) {
    return identidade?.foraDoContinente === true;
}

function normalizar(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// ============================================================
// INSTRUÇÕES PARA O PROMPT
//
// Primeira camada: o modelo recebe país e coordenada em cada linha e é
// proibido de escrever sobre o homônimo famoso. A camada determinística
// acima não consegue ler o texto e julgar sobre QUAL cidade ele fala — é
// aqui que esse erro precisa ser evitado.
// ============================================================
export const INSTRUCOES_IDENTIDADE = `IDENTIDADE DO DESTINO (regra anterior a todas as outras):

Cada linha da lista traz Nome, País, Aeroporto e, quando disponível, a
coordenada (latitude,longitude) do destino. O lugar é identificado pelo
CONJUNTO. O nome sozinho não identifica nada.

MUITOS NOMES SE REPETEM PELO MUNDO. Exemplos reais que já apareceram nesta
lista: "São Petersburgo" nos Estados Unidos é St. Petersburg, na Flórida, e
não a cidade russa; "Santiago" pode ser Chile, Espanha, Brasil ou Filipinas;
"Córdoba" pode ser Argentina, Espanha ou México; "Valencia" pode ser Espanha,
Venezuela ou Estados Unidos.

REGRAS:
- Quando o nome sugerir uma cidade famosa em OUTRO país, o país e a coordenada
  da linha é que valem. Escreva sobre o lugar que a linha descreve.
- NUNCA cite pontos turísticos, pratos, história ou clima do homônimo famoso.
- Se você não tem certeza de qual lugar é, escreva um comentário genérico
  sobre a região e o país da linha. Comentário genérico e correto é melhor que
  comentário específico e sobre a cidade errada.
- NÃO afirme que um ponto turístico específico fica no destino se você não tem
  certeza. Sem certeza, fale da região, do tipo de passeio ou do perfil do
  lugar, sem nome próprio.

O AEROPORTO NÃO É O DESTINO. O código da linha é onde o avião pousa, e ele
pode servir uma cidade vizinha ou toda uma região metropolitana (TPA atende
Tampa e também St. Petersburg; CNF fica em Confins, não em Belo Horizonte).
- NUNCA escreva que o aeroporto "fica no destino" ou "fica na cidade".
- Se comentar o aeroporto, trate-o como ponto de chegada da região, e lembre
  que pode haver deslocamento terrestre até o destino.`;
