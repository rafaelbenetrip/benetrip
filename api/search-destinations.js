// api/search-destinations.js - VERSÃO MULTI-CONTINENTE v3.5
// v3.5: GEO VINDO DO FRONTEND — elimina dependência de KGMID_CITY_GEO hardcoded
// - O frontend envia origemGeo { codigo_pais, pais, kgmid_pais, continente, kgmid_continente }
// - Backend usa direto, sem precisar de mapa interno para cada kgmid de cidade
// - Fallback para iata_geo_lookup.json quando origemGeo não é fornecido (IATA simples)
//
// v3.4: SUPORTE A ESCOPO "NACIONAL"
// v3.3: SUPORTE A KGMID como departure_id
// v3.2: BUSCA EM MÚLTIPLOS CONTINENTES quando "apenas internacional"

import { readFileSync } from 'fs';
import { join } from 'path';

export const maxDuration = 60;

// ============================================================
// MAPEAMENTO DE CONTINENTES/REGIÕES PARA BUSCA
// ============================================================
const CONTINENTES_KGMID = {
    'america_sul': '/m/0dg3n1',
    'america_norte': '/m/059g4',
    'america_central': '/m/0261m',
    'europa': '/m/02j9z',
    'asia': '/m/0j0k',
    'africa': '/m/0dv5r',
    'oceania': '/m/05nrg',
};

// ============================================================
// ESTRATÉGIA: Quais continentes buscar para cada região de origem
// ============================================================
const ESTRATEGIA_CONTINENTES = {
    'america_sul': {
        prioridade: ['america_sul', 'america_central', 'america_norte', 'europa'],
        descricao: 'América do Sul → Sul, Caribe, Norte, Europa'
    },
    'america_norte': {
        prioridade: ['america_norte', 'america_central', 'europa', 'asia'],
        descricao: 'América do Norte → Norte, Caribe, Europa, Ásia'
    },
    'america_central': {
        prioridade: ['america_central', 'america_sul', 'america_norte', 'europa'],
        descricao: 'Caribe → Caribe, Sul, Norte, Europa'
    },
    'europa': {
        prioridade: ['europa', 'africa', 'asia', 'america_norte'],
        descricao: 'Europa → Europa, África, Ásia, América do Norte'
    },
    'asia': {
        prioridade: ['asia', 'oceania', 'europa', 'africa'],
        descricao: 'Ásia → Ásia, Oceania, Europa, África'
    },
    'africa': {
        prioridade: ['africa', 'europa', 'asia', 'america_sul'],
        descricao: 'África → África, Europa, Ásia, América do Sul'
    },
    'oceania': {
        prioridade: ['oceania', 'asia', 'america_norte', 'america_sul'],
        descricao: 'Oceania → Oceania, Ásia, América do Norte, América do Sul'
    },
};

function getEstrategiaContinente(continente) {
    const mapeamento = {
        'América do Sul': 'america_sul',
        'América do Norte': 'america_norte',
        'América Central': 'america_central',
        'Europa': 'europa',
        'Ásia': 'asia',
        'África': 'africa',
        'Oceania': 'oceania',
    };
    return mapeamento[continente] || 'america_sul';
}

// ============================================================
// LOOKUP IATA — fallback quando frontend não envia origemGeo
// ============================================================
let IATA_LOOKUP = null;

function getIataLookup() {
    if (IATA_LOOKUP) return IATA_LOOKUP;
    try {
        const filePath = join(process.cwd(), 'public', 'data', 'iata_geo_lookup.json');
        IATA_LOOKUP = JSON.parse(readFileSync(filePath, 'utf-8'));
        console.log(`[Lookup] ${Object.keys(IATA_LOOKUP).length} aeroportos carregados`);
    } catch (err) {
        console.error('[Lookup] Erro ao carregar iata_geo_lookup.json:', err.message);
        IATA_LOOKUP = {
            "GRU": { "codigo_pais": "BR", "pais": "Brasil", "kgmid_pais": "/m/015fr", "continente": "América do Sul", "kgmid_continente": "/m/0dg3n1" },
            "GIG": { "codigo_pais": "BR", "pais": "Brasil", "kgmid_pais": "/m/015fr", "continente": "América do Sul", "kgmid_continente": "/m/0dg3n1" },
            "CNF": { "codigo_pais": "BR", "pais": "Brasil", "kgmid_pais": "/m/015fr", "continente": "América do Sul", "kgmid_continente": "/m/0dg3n1" },
            "SSA": { "codigo_pais": "BR", "pais": "Brasil", "kgmid_pais": "/m/015fr", "continente": "América do Sul", "kgmid_continente": "/m/0dg3n1" },
            "BSB": { "codigo_pais": "BR", "pais": "Brasil", "kgmid_pais": "/m/015fr", "continente": "América do Sul", "kgmid_continente": "/m/0dg3n1" },
            "REC": { "codigo_pais": "BR", "pais": "Brasil", "kgmid_pais": "/m/015fr", "continente": "América do Sul", "kgmid_continente": "/m/0dg3n1" },
            "FOR": { "codigo_pais": "BR", "pais": "Brasil", "kgmid_pais": "/m/015fr", "continente": "América do Sul", "kgmid_continente": "/m/0dg3n1" },
            "POA": { "codigo_pais": "BR", "pais": "Brasil", "kgmid_pais": "/m/015fr", "continente": "América do Sul", "kgmid_continente": "/m/0dg3n1" },
            "CWB": { "codigo_pais": "BR", "pais": "Brasil", "kgmid_pais": "/m/015fr", "continente": "América do Sul", "kgmid_continente": "/m/0dg3n1" },
            "VCP": { "codigo_pais": "BR", "pais": "Brasil", "kgmid_pais": "/m/015fr", "continente": "América do Sul", "kgmid_continente": "/m/0dg3n1" },
        };
    }
    return IATA_LOOKUP;
}

// ============================================================
// v3.5: RESOLVER GEO — prioriza origemGeo enviado pelo frontend
// ============================================================
function resolveGeo(origemCode, origemGeoFromFrontend) {
    // 1. Frontend enviou dados geo → usa direto (fonte mais confiável)
    if (origemGeoFromFrontend && origemGeoFromFrontend.pais && origemGeoFromFrontend.kgmid_pais) {
        console.log(`[Geo] Dados geo do frontend: ${origemGeoFromFrontend.pais} (${origemGeoFromFrontend.kgmid_pais})`);
        return {
            codigo_pais: origemGeoFromFrontend.codigo_pais || '',
            pais: origemGeoFromFrontend.pais,
            kgmid_pais: origemGeoFromFrontend.kgmid_pais,
            continente: origemGeoFromFrontend.continente || '',
            kgmid_continente: origemGeoFromFrontend.kgmid_continente || '',
        };
    }

    // 2. IATA simples → buscar no lookup JSON
    if (/^[A-Z]{3}$/i.test(origemCode)) {
        const lookup = getIataLookup();
        const geo = lookup[origemCode.toUpperCase()];
        if (geo) {
            console.log(`[Geo] IATA ${origemCode} → ${geo.pais} via lookup`);
            return geo;
        }
    }

    // 3. Multi-IATA → usar primeiro código
    if (/^[A-Z]{3}(,[A-Z]{3})+$/i.test(origemCode)) {
        const primeiro = origemCode.split(',')[0].toUpperCase();
        const lookup = getIataLookup();
        const geo = lookup[primeiro];
        if (geo) {
            console.log(`[Geo] Multi-IATA → usando ${primeiro} → ${geo.pais}`);
            return geo;
        }
    }

    console.warn(`[Geo] Não foi possível resolver geo para ${origemCode}`);
    return null;
}

// ============================================================
// BUSCA INDIVIDUAL no SearchAPI
// ============================================================
async function searchTravelExplore(params, label) {
    const fullParams = {
        engine: 'google_travel_explore',
        api_key: process.env.SEARCHAPI_KEY,
        gl: 'br',
        hl: 'pt-BR',
        ...params,
    };

    const queryParts = [];
    Object.entries(fullParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
            const encodedKey = encodeURIComponent(k);
            const encodedValue = encodeURIComponent(String(v)).replace(/%2C/gi, ',');
            queryParts.push(`${encodedKey}=${encodedValue}`);
        }
    });
    const urlString = `https://www.searchapi.io/api/v1/search?${queryParts.join('&')}`;
    const startTime = Date.now();

    try {
        const response = await fetch(urlString, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const elapsed = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[SearchAPI][${label}] HTTP ${response.status} (${elapsed}ms):`, errorText);
            return { destinations: [], error: `HTTP ${response.status}`, elapsed };
        }

        const data = await response.json();
        const count = (data.destinations || []).length;
        console.log(`[SearchAPI][${label}] ${count} destinos (${elapsed}ms)`);
        return { destinations: data.destinations || [], error: null, elapsed };
    } catch (err) {
        const elapsed = Date.now() - startTime;
        console.error(`[SearchAPI][${label}] Erro (${elapsed}ms):`, err.message);
        return { destinations: [], error: err.message, elapsed };
    }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    try {
        const { origem, dataIda, dataVolta, preferencias, moeda, escopoDestino, origemGeo: origemGeoBody } = req.body;

        if (!origem || typeof origem !== 'string') {
            return res.status(400).json({
                error: 'Origem obrigatória',
                exemplo: { origem: 'GRU', dataIda: '2026-03-15', dataVolta: '2026-03-22' }
            });
        }

        const origemRaw = origem.trim();
        const isKgmid = origemRaw.startsWith('/m/');
        const isIata = /^[A-Z]{3}$/i.test(origemRaw);
        const isMultiIata = /^[A-Z]{3}(,[A-Z]{3})+$/i.test(origemRaw);
        
        if (!isKgmid && !isIata && !isMultiIata) {
            return res.status(400).json({
                error: 'Código de origem inválido',
                message: 'Use código IATA (ex: GRU), múltiplos (ex: GRU,CGH,VCP) ou kgmid (ex: /m/022pfm)'
            });
        }
        
        const origemCode = isKgmid ? origemRaw : origemRaw.toUpperCase();

        if (!process.env.SEARCHAPI_KEY) {
            return res.status(500).json({
                error: 'SEARCHAPI_KEY não configurada',
                message: 'Configure em Vercel → Settings → Environment Variables'
            });
        }

        const currencyCode = (moeda && /^[A-Z]{3}$/.test(moeda)) ? moeda : 'BRL';
        const apenasInternacional = escopoDestino === 'internacional';
        const apenasNacional = escopoDestino === 'nacional';
        const escopoLabel = apenasInternacional ? 'INTERNACIONAL' : apenasNacional ? 'NACIONAL' : 'TODOS';
        console.log(`💱 Moeda: ${currencyCode} | Escopo: ${escopoLabel} | Tipo: ${isKgmid ? 'KGMID' : isMultiIata ? 'MULTI_IATA' : 'IATA'}`);

        // v3.5: Resolve geo usando dados do frontend como fonte primária
        const geo = resolveGeo(origemCode, origemGeoBody);
        console.log(`🔍 Search de ${origemCode} | País: ${geo?.pais || '?'} | Continente: ${geo?.continente || '?'} | Escopo: ${escopoLabel}`);

        // Preferências → interests
        const INTERESTS_MAP = { 'relax': 'beaches', 'aventura': 'outdoors', 'cultura': 'museums', 'urbano': 'popular' };
        let prefArray = [];
        if (Array.isArray(preferencias)) prefArray = preferencias;
        else if (typeof preferencias === 'string') prefArray = preferencias.split(',').filter(Boolean);
        const interests = prefArray.length === 1 ? (INTERESTS_MAP[prefArray[0]] || 'popular') : 'popular';
        console.log(`🎯 Preferências: [${prefArray.join(', ')}] → interests: ${interests}`);

        // Parâmetros base
        const baseParams = { departure_id: origemCode, interests, currency: currencyCode };
        if (dataIda && dataVolta) { baseParams.time_period = `${dataIda}..${dataVolta}`; console.log(`📅 Datas: ${dataIda} → ${dataVolta}`); }
        else if (dataIda) { baseParams.time_period = dataIda; }

        // ============================================================
        // ESTRATÉGIA DE BUSCAS (3 modos)
        // ============================================================
        const searchPromises = [];
        const startTime = Date.now();

        if (apenasNacional) {
            if (geo?.kgmid_pais) {
                console.log(`🏠 Modo NACIONAL: buscando em ${geo.pais} (${geo.kgmid_pais})`);
                searchPromises.push(searchTravelExplore({ ...baseParams, arrival_id: geo.kgmid_pais }, `NACIONAL ${geo.pais}`));
                searchPromises.push(searchTravelExplore({ ...baseParams }, `GLOBAL (filtro nacional)`));
            } else {
                console.warn(`⚠️ Sem kgmid_pais, buscando global e filtrando`);
                searchPromises.push(searchTravelExplore({ ...baseParams }, `GLOBAL (filtro nacional fallback)`));
            }
        } else if (apenasInternacional) {
            searchPromises.push(searchTravelExplore({ ...baseParams }, `GLOBAL`));
            if (geo?.continente) {
                const estrategiaKey = getEstrategiaContinente(geo.continente);
                const estrategia = ESTRATEGIA_CONTINENTES[estrategiaKey];
                if (estrategia) {
                    console.log(`🌍 Estratégia internacional: ${estrategia.descricao}`);
                    estrategia.prioridade.slice(0, 4).forEach(ck => {
                        const kgmid = CONTINENTES_KGMID[ck];
                        if (kgmid) searchPromises.push(searchTravelExplore({ ...baseParams, arrival_id: kgmid }, `${ck.toUpperCase()}`));
                    });
                } else if (geo.kgmid_continente) {
                    searchPromises.push(searchTravelExplore({ ...baseParams, arrival_id: geo.kgmid_continente }, `${geo.continente}`));
                }
            }
        } else {
            searchPromises.push(searchTravelExplore({ ...baseParams }, `GLOBAL`));
            if (geo?.kgmid_continente) searchPromises.push(searchTravelExplore({ ...baseParams, arrival_id: geo.kgmid_continente }, `${geo.continente}`));
            if (geo?.kgmid_pais) searchPromises.push(searchTravelExplore({ ...baseParams, arrival_id: geo.kgmid_pais }, `${geo.pais}`));
        }

        console.log(`📡 ${searchPromises.length} buscas paralelas (escopo: ${escopoLabel})...`);
        
        let results = [];
        try { results = await Promise.all(searchPromises); }
        catch (err) { console.error('❌ Erro paralelo:', err); results = searchPromises.map(() => ({ destinations: [], error: 'Falha', elapsed: 0 })); }
        results = results.map(r => r || { destinations: [], error: 'Resposta inválida', elapsed: 0 });
        const totalTime = Date.now() - startTime;

        // ============================================================
        // CONSOLIDAÇÃO
        // ============================================================
        const allDestinations = new Map();
        const paisOrigem = geo?.pais?.toLowerCase() || '';

        function addDestinations(destinations, source) {
            if (!destinations || !Array.isArray(destinations)) return;
            for (const dest of destinations) {
                if (!dest || !dest.name || !dest.country) continue;
                const destCountry = (dest.country || '').toLowerCase();
                const isDestinoDomestico = paisOrigem && destCountry === paisOrigem;
                if (apenasInternacional && isDestinoDomestico) continue;
                if (apenasNacional && !isDestinoDomestico) continue;

                const key = `${(dest.name || '').toLowerCase()}_${destCountry}`;
                const flightPrice = dest.flight?.price ?? 0;

                if (!allDestinations.has(key)) {
                    allDestinations.set(key, {
                        name: dest.name,
                        primary_airport: dest.primary_airport || '',
                        country: dest.country,
                        coordinates: dest.coordinates || null,
                        image: dest.image || '',
                        flight: {
                            airport_code: dest.flight?.airport_code || dest.primary_airport || '',
                            price: dest.flight?.price || 0,
                            stops: dest.flight?.stops || 0,
                            flight_duration_minutes: dest.flight?.flight_duration_minutes || 0,
                            airline_name: dest.flight?.airline_name || ''
                        },
                        avg_cost_per_night: dest.avg_cost_per_night || 0,
                        outbound_date: dest.outbound_date || null,
                        return_date: dest.return_date || null,
                        _sources: [source],
                        _source_count: 1,
                    });
                } else {
                    const existing = allDestinations.get(key);
                    existing._sources.push(source);
                    existing._source_count++;
                    if (flightPrice > 0 && (existing.flight.price === 0 || flightPrice < existing.flight.price)) {
                        existing.flight = {
                            airport_code: dest.flight?.airport_code || dest.primary_airport || '',
                            price: dest.flight?.price || 0,
                            stops: dest.flight?.stops || 0,
                            flight_duration_minutes: dest.flight?.flight_duration_minutes || 0,
                            airline_name: dest.flight?.airline_name || ''
                        };
                    }
                }
            }
        }

        results.forEach((result, idx) => addDestinations(result.destinations, `busca_${idx}`));

        const consolidated = Array.from(allDestinations.values()).sort((a, b) => {
            if (a.flight.price === 0 && b.flight.price === 0) return 0;
            if (a.flight.price === 0) return 1;
            if (b.flight.price === 0) return -1;
            return a.flight.price - b.flight.price;
        });

        if (consolidated.length === 0) {
            let mensagemErro;
            if (apenasNacional) mensagemErro = `Nenhum destino doméstico encontrado em ${geo?.pais || 'seu país'}. Tente incluir destinos internacionais ou ajuste datas/orçamento.`;
            else if (apenasInternacional) mensagemErro = 'Nenhum voo internacional encontrado. Tente incluir destinos nacionais ou ajuste datas/orçamento.';
            else mensagemErro = 'Nenhum voo encontrado. Tente outra origem ou datas.';
            
            return res.status(404).json({
                error: 'Nenhum destino encontrado',
                message: mensagemErro,
                _debug: { totalBuscas: searchPromises.length, escopo: escopoLabel, geoResolvido: !!geo }
            });
        }

        console.log(`✅ ${totalTime}ms | ${searchPromises.length} buscas → ${consolidated.length} destinos | Escopo: ${escopoLabel}`);

        const sources = { global: 0, continente: 0, pais: 0 };
        if (apenasNacional) { sources.pais = results[0]?.destinations?.length || 0; if (results.length > 1) sources.global = results[1]?.destinations?.length || 0; }
        else if (apenasInternacional) { sources.global = results[0]?.destinations?.length || 0; for (let i = 1; i < results.length; i++) sources.continente += results[i]?.destinations?.length || 0; }
        else { sources.global = results[0]?.destinations?.length || 0; if (results.length > 1) sources.continente = results[1]?.destinations?.length || 0; if (results.length > 2) sources.pais = results[2]?.destinations?.length || 0; }

        return res.status(200).json({
            success: true,
            origem: origemCode,
            origemGeo: geo ? { pais: geo.pais, codigo_pais: geo.codigo_pais, continente: geo.continente } : null,
            dataIda: dataIda || null, dataVolta: dataVolta || null,
            moeda: currencyCode, total: consolidated.length,
            destinations: consolidated,
            _meta: {
                totalTime, currency: currencyCode,
                origemTipo: isKgmid ? 'kgmid' : isMultiIata ? 'multi_iata' : 'iata',
                escopoDestino: escopoLabel.toLowerCase(),
                preferencias: prefArray, sources, totalBuscas: searchPromises.length,
                buscasDetalhadas: results.map((r, i) => ({ ordem: i + 1, resultados: r?.destinations?.length || 0, tempo: r?.elapsed || 0, erro: r?.error || null }))
            }
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        return res.status(500).json({ error: 'Erro ao buscar destinos', message: error.message });
    }
}
