// api/_lib/geo-routes.js - BENETRIP ADAPTER DE GEO E ROTAS v1.0
//
// ⚠️ NÃO ESTÁ LIGADO A NENHUM ENDPOINT.
//
// O componente de aeroporto (renderAeroportoDisclosureHtml) aceita um campo
// `deslocamento`, mas hoje NADA o preenche: nenhum endpoint importa este
// módulo. Na prática o card diz apenas que "pode exigir deslocamento
// terrestre", sem km nem tempo, e o custo destas APIs é zero.
//
// Para ativar seria preciso: chamar deslocamentoAeroportoDestino() no
// endpoint que monta os cards (com limite de concorrência, só para os
// destinos exibidos) e anexar o resultado em `destino.deslocamento`.
// Isso liga duas APIs do Google Cloud que precisam estar habilitadas e são
// cobradas à parte: Geocoding e Directions. Decisão de custo pendente.
//
// Resolve dinamicamente, para QUALQUER lugar do mundo:
//   - coordenadas de um destino turístico (geocodificação);
//   - coordenadas de um aeroporto pelo código IATA;
//   - deslocamento terrestre entre os dois.
//
// Não existe mapa local de cidades e aeroportos aqui: tudo vem de provedor
// externo, com cache técnico por chave e data de verificação.
//
// Provedores (nesta ordem, todos já configurados no projeto):
//   1. Google Geocoding API  (GOOGLE_PLACES_API_KEY | GOOGLE_API_KEY)
//   2. Google Routes/Directions API (mesma chave), quando habilitada
//
// Sem provedor ou sem resposta confiável a função devolve null e a interface
// diz apenas que existe um deslocamento adicional — nunca um número inventado.

import { comCache } from './external-cache.js';

const TTL_GEO_MS = 7 * 24 * 60 * 60 * 1000;   // coordenadas mudam raramente
const TTL_ROTA_MS = 24 * 60 * 60 * 1000;      // rota rodoviária: 1 dia

const FONTE_GEO = 'Google Geocoding';
const FONTE_ROTA = 'Google Directions';

function chaveApi() {
    return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || null;
}

export function geoDisponivel() {
    return Boolean(chaveApi());
}

// ============================================================
// GEOCODIFICAÇÃO
// ============================================================
export async function geocodificar(consulta, { idioma = 'pt-BR' } = {}) {
    const termo = String(consulta || '').trim();
    if (!termo) return null;
    const key = chaveApi();
    if (!key) return null;

    return comCache(`geo|${idioma}|${termo.toLowerCase()}`, TTL_GEO_MS, async () => {
        const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        url.searchParams.set('address', termo);
        url.searchParams.set('language', idioma);
        url.searchParams.set('key', key);

        try {
            const resp = await fetch(url.toString());
            if (!resp.ok) return null;
            const data = await resp.json();
            const primeiro = (data.results || [])[0];
            if (!primeiro?.geometry?.location) return null;
            return {
                lat: primeiro.geometry.location.lat,
                lng: primeiro.geometry.location.lng,
                nomeFormatado: primeiro.formatted_address || termo,
                placeId: primeiro.place_id || null,
                fonte: FONTE_GEO,
                verificadoEm: new Date().toISOString(),
            };
        } catch (err) {
            console.warn(`[Geo] Falha ao geocodificar "${termo}": ${err.message}`);
            return null;
        }
    });
}

// Aeroporto pelo IATA: a própria geocodificação resolve globalmente
// ("GRU airport"), sem tabela local.
export async function coordenadasDoAeroporto(iata) {
    const code = String(iata || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return null;
    return geocodificar(`${code} airport`, { idioma: 'en' });
}

// ============================================================
// DISTÂNCIA EM LINHA RETA (Haversine)
// Usada apenas para saber se existe distância relevante; NUNCA é apresentada
// como distância rodoviária.
// ============================================================
export function distanciaLinhaRetaKm(a, b) {
    if (!a || !b) return null;
    const R = 6371;
    const rad = (g) => (g * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// ============================================================
// ROTA RODOVIÁRIA
// Só devolve tempo quando o provedor de rotas responde. Sem isso, nada de
// tempo estimado.
// ============================================================
export async function rotaTerrestre(origem, destino, { idioma = 'pt-BR' } = {}) {
    const key = chaveApi();
    if (!key || !origem || !destino) return null;

    const chave = `rota|${origem.lat.toFixed(3)},${origem.lng.toFixed(3)}|${destino.lat.toFixed(3)},${destino.lng.toFixed(3)}`;
    return comCache(chave, TTL_ROTA_MS, async () => {
        const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
        url.searchParams.set('origin', `${origem.lat},${origem.lng}`);
        url.searchParams.set('destination', `${destino.lat},${destino.lng}`);
        url.searchParams.set('mode', 'driving');
        url.searchParams.set('language', idioma);
        url.searchParams.set('key', key);

        try {
            const resp = await fetch(url.toString());
            if (!resp.ok) return null;
            const data = await resp.json();
            const perna = data.routes?.[0]?.legs?.[0];
            if (!perna?.distance?.value || !perna?.duration?.value) return null;
            return {
                distanciaKm: Math.round(perna.distance.value / 1000),
                duracaoMin: Math.round(perna.duration.value / 60),
                fonte: FONTE_ROTA,
                verificadoEm: new Date().toISOString(),
            };
        } catch (err) {
            console.warn(`[Geo] Falha ao calcular rota: ${err.message}`);
            return null;
        }
    });
}

// ============================================================
// DESLOCAMENTO AEROPORTO -> DESTINO
//
// Retorna:
//   null                                    provedor indisponível ou sem dado
//   { tipo: 'rota', distanciaKm, duracaoMin, fonte, verificadoEm }
//   { tipo: 'linha_reta', distanciaKm, duracaoMin: null, fonte, verificadoEm }
//
// A interface decide o texto: com 'rota' pode dizer tempo; com 'linha_reta'
// diz apenas que o destino fica a X km em linha reta do aeroporto, sem
// prometer tempo de viagem.
// ============================================================
const DISTANCIA_MINIMA_RELEVANTE_KM = 25;

export async function deslocamentoAeroportoDestino({ destino, pais, aeroporto }) {
    if (!geoDisponivel()) return null;
    const consultaDestino = [destino, pais].filter(Boolean).join(', ');
    if (!consultaDestino) return null;

    const [coordDestino, coordAeroporto] = await Promise.all([
        geocodificar(consultaDestino),
        coordenadasDoAeroporto(aeroporto),
    ]);
    if (!coordDestino || !coordAeroporto) return null;

    const linhaReta = distanciaLinhaRetaKm(coordAeroporto, coordDestino);
    if (linhaReta === null) return null;
    // Aeroporto praticamente no destino: não há o que avisar
    if (linhaReta < DISTANCIA_MINIMA_RELEVANTE_KM) {
        return { tipo: 'proximo', distanciaKm: linhaReta, duracaoMin: null, fonte: FONTE_GEO, verificadoEm: coordDestino.verificadoEm };
    }

    const rota = await rotaTerrestre(coordAeroporto, coordDestino);
    if (rota) return { tipo: 'rota', ...rota };

    return {
        tipo: 'linha_reta',
        distanciaKm: linhaReta,
        duracaoMin: null,
        fonte: FONTE_GEO,
        verificadoEm: coordDestino.verificadoEm,
    };
}
