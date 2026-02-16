// api/search-destinations.js - VERSÃO MULTI-CONTINENTE v3.2
// v3.2: BUSCA EM MÚLTIPLOS CONTINENTES quando "apenas internacional"
// Melhora drasticamente cobertura de destinos internacionais
// Exemplo: Belém → América do Sul + Caribe + América do Norte + Europa
// v3.0: Triple search + filtro internacional + multi-preferências

import { readFileSync } from 'fs';
import { join } from 'path';

// ============================================================
// MAPEAMENTO DE CONTINENTES/REGIÕES PARA BUSCA
// ============================================================
const CONTINENTES_KGMID = {
    'america_sul': '/m/0dg3n1',
    'america_norte': '/m/059g4',
    'america_central': '/m/01_d4',  // América Central + Caribe
    'europa': '/m/02j9z',
    'asia': '/m/0j0k',
    'africa': '/m/0dv5r',
    'oceania': '/m/05nrg',
};

// ============================================================
// ESTRATÉGIA: Quais continentes buscar para cada região de origem
// Quando usuário seleciona "apenas internacional"
// ============================================================
const ESTRATEGIA_CONTINENTES = {
    // América do Sul (Brasil, Argentina, Chile, etc.)
    'america_sul': {
        prioridade: ['america_sul', 'america_central', 'america_norte', 'europa'],
        descricao: 'América do Sul → Sul, Caribe, Norte, Europa'
    },
    
    // América do Norte (EUA, Canadá, México)
    'america_norte': {
        prioridade: ['america_norte', 'america_central', 'europa', 'asia'],
        descricao: 'América do Norte → Norte, Caribe, Europa, Ásia'
    },
    
    // América Central/Caribe
    'america_central': {
        prioridade: ['america_central', 'america_sul', 'america_norte', 'europa'],
        descricao: 'Caribe → Caribe, Sul, Norte, Europa'
    },
    
    // Europa
    'europa': {
        prioridade: ['europa', 'africa', 'asia', 'america_norte'],
        descricao: 'Europa → Europa, África, Ásia, América do Norte'
    },
    
    // Ásia
    'asia': {
        prioridade: ['asia', 'oceania', 'europa', 'africa'],
        descricao: 'Ásia → Ásia, Oceania, Europa, África'
    },
    
    // África
    'africa': {
        prioridade: ['africa', 'europa', 'asia', 'america_sul'],
        descricao: 'África → África, Europa, Ásia, América do Sul'
    },
    
    // Oceania
    'oceania': {
        prioridade: ['oceania', 'asia', 'america_norte', 'america_sul'],
        descricao: 'Oceania → Oceania, Ásia, América do Norte, América do Sul'
    },
};

// ============================================================
// MAPEAR CONTINENTE → ESTRATÉGIA
// ============================================================
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
// LOOKUP: Carrega mapeamento IATA → país + continente
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
// BUSCA INDIVIDUAL no SearchAPI
// ============================================================
async function searchTravelExplore(params, label) {
    const url = new URL('https://www.searchapi.io/api/v1/search');
    const fullParams = {
        engine: 'google_travel_explore',
        api_key: process.env.SEARCHAPI_KEY,
        gl: 'br',
        hl: 'pt-BR',
        ...params,
    };

    Object.entries(fullParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });

    const startTime = Date.now();

    try {
        const response = await fetch(url.toString(), {
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
        const { origem, dataIda, dataVolta, preferencias, moeda, escopoDestino } = req.body;

        if (!origem || typeof origem !== 'string') {
            return res.status(400).json({
                error: 'Origem obrigatória',
                exemplo: { origem: 'GRU', dataIda: '2026-03-15', dataVolta: '2026-03-22' }
            });
        }

        const origemCode = origem.toUpperCase().trim();
        if (!/^[A-Z]{3}$/.test(origemCode)) {
            return res.status(400).json({
                error: 'Código IATA inválido',
                message: 'Use 3 letras (ex: GRU, GIG, SSA)'
            });
        }

        if (!process.env.SEARCHAPI_KEY) {
            return res.status(500).json({
                error: 'SEARCHAPI_KEY não configurada',
                message: 'Configure em Vercel → Settings → Environment Variables'
            });
        }

        const currencyCode = (moeda && /^[A-Z]{3}$/.test(moeda)) ? moeda : 'BRL';
        const apenasInternacional = escopoDestino === 'internacional';
        console.log(`💱 Moeda: ${currencyCode} | Escopo: ${apenasInternacional ? 'INTERNACIONAL' : 'TODOS'}`);

        // ============================================================
        // RESOLVER GEO DO AEROPORTO
        // ============================================================
        const lookup = getIataLookup();
        const geo = lookup[origemCode] || null;

        console.log(`🔍 Multi-Continent Search de ${origemCode} | País: ${geo?.pais || '?'} | Continente: ${geo?.continente || '?'} | Internacional: ${apenasInternacional}`);

        // ============================================================
        // MAPEAR PREFERÊNCIAS → interests
        // ============================================================
        const INTERESTS_MAP = {
            'relax':     'beaches',
            'aventura':  'outdoors',
            'cultura':   'museums',
            'urbano':    'popular',
        };

        let prefArray = [];
        if (Array.isArray(preferencias)) {
            prefArray = preferencias;
        } else if (typeof preferencias === 'string') {
            prefArray = preferencias.split(',').filter(Boolean);
        }

        const interests = prefArray.length === 1 
            ? (INTERESTS_MAP[prefArray[0]] || 'popular')
            : 'popular';
        
        console.log(`🎯 Preferências: [${prefArray.join(', ')}] → interests: ${interests}`);

        // ============================================================
        // PARÂMETROS BASE
        // ============================================================
        const baseParams = {
            departure_id: origemCode,
            interests,
            currency: currencyCode,
        };

        if (dataIda && dataVolta) {
            baseParams.time_period = `${dataIda}..${dataVolta}`;
            console.log(`📅 Datas: ${dataIda} → ${dataVolta}`);
        } else if (dataIda) {
            baseParams.time_period = dataIda;
        }

        // ============================================================
        // v3.2: ESTRATÉGIA DE BUSCAS BASEADA EM ESCOPO
        // ============================================================
        const searchPromises = [];
        const startTime = Date.now();

        // BUSCA 1: GLOBAL (sempre)
        searchPromises.push(
            searchTravelExplore(
                { ...baseParams },
                `GLOBAL desde ${origemCode}`
            )
        );

        if (apenasInternacional && geo?.continente) {
            // ============================================================
            // MODO INTERNACIONAL: Buscar em múltiplos continentes
            // ============================================================
            const estrategiaKey = getEstrategiaContinente(geo.continente);
            const estrategia = ESTRATEGIA_CONTINENTES[estrategiaKey];
            
            if (estrategia) {
                console.log(`🌍 Estratégia internacional: ${estrategia.descricao}`);
                
                // Buscar em cada continente da estratégia (máximo 4)
                estrategia.prioridade.slice(0, 4).forEach(continenteKey => {
                    const kgmid = CONTINENTES_KGMID[continenteKey];
                    if (kgmid) {
                        const continenteNome = Object.keys(CONTINENTES_KGMID).find(k => CONTINENTES_KGMID[k] === kgmid);
                        searchPromises.push(
                            searchTravelExplore(
                                { ...baseParams, arrival_id: kgmid },
                                `${continenteNome.toUpperCase()} desde ${origemCode}`
                            )
                        );
                    }
                });
            } else {
                // Fallback: busca apenas no continente de origem
                searchPromises.push(
                    searchTravelExplore(
                        { ...baseParams, arrival_id: geo.kgmid_continente },
                        `${geo.continente} desde ${origemCode}`
                    )
                );
            }
            
        } else if (!apenasInternacional) {
            // ============================================================
            // MODO TANTO FAZ: Busca continente + país (como antes)
            // ============================================================
            
            // BUSCA 2: CONTINENTE
            if (geo?.kgmid_continente) {
                searchPromises.push(
                    searchTravelExplore(
                        { ...baseParams, arrival_id: geo.kgmid_continente },
                        `${geo.continente} desde ${origemCode}`
                    )
                );
            }
            
            // BUSCA 3: PAÍS (doméstico)
            if (geo?.kgmid_pais) {
                searchPromises.push(
                    searchTravelExplore(
                        { ...baseParams, arrival_id: geo.kgmid_pais },
                        `${geo.pais} desde ${origemCode}`
                    )
                );
            }
        }

        console.log(`📡 Fazendo ${searchPromises.length} buscas paralelas...`);
        const results = await Promise.all(searchPromises);
        const totalTime = Date.now() - startTime;

        // ============================================================
        // CONSOLIDAÇÃO: Deduplicar, manter menor preço
        // Se apenasInternacional → filtrar destinos do país de origem
        // ============================================================
        const allDestinations = new Map();
        const paisOrigem = geo?.pais?.toLowerCase() || '';
        const codigoPaisOrigem = geo?.codigo_pais?.toUpperCase() || '';

        function addDestinations(destinations, source) {
            for (const dest of destinations) {
                // Se apenas internacional, pular destinos do mesmo país
                if (apenasInternacional && paisOrigem) {
                    const destCountry = (dest.country || '').toLowerCase();
                    if (destCountry === paisOrigem) {
                        continue;
                    }
                }

                const key = `${(dest.name || '').toLowerCase()}_${(dest.country || '').toLowerCase()}`;
                const flightPrice = dest.flight?.price ?? 0;

                if (!allDestinations.has(key)) {
                    allDestinations.set(key, {
                        name: dest.name,
                        primary_airport: dest.primary_airport,
                        country: dest.country,
                        coordinates: dest.coordinates,
                        image: dest.image,
                        flight: {
                            airport_code: dest.flight?.airport_code || dest.primary_airport,
                            price: dest.flight?.price || 0,
                            stops: dest.flight?.stops || 0,
                            flight_duration_minutes: dest.flight?.flight_duration_minutes || 0,
                            airline_name: dest.flight?.airline_name || ''
                        },
                        avg_cost_per_night: dest.avg_cost_per_night || 0,
                        outbound_date: dest.outbound_date,
                        return_date: dest.return_date,
                        _sources: [source],
                        _source_count: 1,
                    });
                } else {
                    const existing = allDestinations.get(key);
                    existing._sources.push(source);
                    existing._source_count++;
                    if (flightPrice > 0 && (existing.flight.price === 0 || flightPrice < existing.flight.price)) {
                        existing.flight = {
                            airport_code: dest.flight?.airport_code || dest.primary_airport,
                            price: dest.flight?.price || 0,
                            stops: dest.flight?.stops || 0,
                            flight_duration_minutes: dest.flight?.flight_duration_minutes || 0,
                            airline_name: dest.flight?.airline_name || ''
                        };
                    }
                }
            }
        }

        // Adicionar resultados de todas as buscas
        results.forEach((result, idx) => {
            const label = idx === 0 ? 'global' : `busca_${idx}`;
            addDestinations(result.destinations, label);
        });

        // Ordenar por preço
        const consolidated = Array.from(allDestinations.values()).sort((a, b) => {
            if (a.flight.price === 0 && b.flight.price === 0) return 0;
            if (a.flight.price === 0) return 1;
            if (b.flight.price === 0) return -1;
            return a.flight.price - b.flight.price;
        });

        // ============================================================
        // RESPOSTA
        // ============================================================
        if (consolidated.length === 0) {
            return res.status(404).json({
                error: 'Nenhum destino encontrado',
                message: apenasInternacional 
                    ? 'Nenhum voo internacional encontrado. Tente incluir destinos nacionais ou ajuste datas/orçamento.'
                    : 'Nenhum voo encontrado nas buscas. Tente outra origem ou datas.',
                _debug: {
                    totalBuscas: searchPromises.length,
                    apenasInternacional,
                }
            });
        }

        console.log(`✅ Multi-Continent Search completo em ${totalTime}ms | ` +
            `${searchPromises.length} buscas → ${consolidated.length} destinos únicos | Moeda: ${currencyCode}`
        );

        return res.status(200).json({
            success: true,
            origem: origemCode,
            origemGeo: geo ? {
                pais: geo.pais,
                codigo_pais: geo.codigo_pais,
                continente: geo.continente,
            } : null,
            dataIda: dataIda || null,
            dataVolta: dataVolta || null,
            moeda: currencyCode,
            total: consolidated.length,
            destinations: consolidated,
            _meta: {
                totalTime,
                currency: currencyCode,
                escopoDestino: apenasInternacional ? 'internacional' : 'tanto_faz',
                preferencias: prefArray,
                totalBuscas: searchPromises.length,
                buscasRealizadas: results.map((r, i) => ({
                    ordem: i + 1,
                    resultados: r.destinations.length,
                    tempo: r.elapsed,
                    erro: r.error
                }))
            }
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        return res.status(500).json({
            error: 'Erro ao buscar destinos',
            message: error.message,
        });
    }
}