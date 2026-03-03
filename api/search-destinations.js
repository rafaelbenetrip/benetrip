// api/search-destinations.js - VERSÃO MULTI-CONTINENTE v3.3
// v3.3: SUPORTE A KGMID como departure_id
// Agora aceita tanto códigos IATA (GRU, JFK) quanto kgmid de cidade (/m/02cft)
// Cidades com múltiplos aeroportos usam kgmid para busca agrupada no Google Travel
// v3.2: BUSCA EM MÚLTIPLOS CONTINENTES quando "apenas internacional"
// v3.0: Triple search + filtro internacional + multi-preferências

import { readFileSync } from 'fs';
import { join } from 'path';

// ---> ADICIONE ESTA LINHA AQUI <---
export const maxDuration = 60; // Aumenta o limite da Vercel para 60 segundos

// ============================================================
// MAPEAMENTO DE CONTINENTES/REGIÕES PARA BUSCA
// ============================================================
const CONTINENTES_KGMID = {
    'america_sul': '/m/0dg3n1',
    'america_norte': '/m/059g4',
    'america_central': '/m/0261m',  // América Central + Caribe
    'europa': '/m/02j9z',
    'asia': '/m/0j0k',
    'africa': '/m/0dv5r',
    'oceania': '/m/05nrg',
};

// ============================================================
// v3.3: MAPEAMENTO KGMID DE CIDADE → DADOS GEO
// Usado quando departure_id é kgmid em vez de código IATA
// ============================================================
const KGMID_CITY_GEO = {
    // Brasil
    '/m/02cft':   { codigo_pais: 'BR', pais: 'Brasil',           kgmid_pais: '/m/015fr', continente: 'América do Sul',    kgmid_continente: '/m/0dg3n1', label: 'São Paulo (todos)' },
    '/m/06gmr':   { codigo_pais: 'BR', pais: 'Brasil',           kgmid_pais: '/m/015fr', continente: 'América do Sul',    kgmid_continente: '/m/0dg3n1', label: 'Rio de Janeiro (todos)' },
    '/m/01hhpg':  { codigo_pais: 'BR', pais: 'Brasil',           kgmid_pais: '/m/015fr', continente: 'América do Sul',    kgmid_continente: '/m/0dg3n1', label: 'Belo Horizonte (todos)' },
    // EUA
    '/m/02_286':  { codigo_pais: 'US', pais: 'Estados Unidos',   kgmid_pais: '/m/09c7w0', continente: 'América do Norte', kgmid_continente: '/m/059g4', label: 'Nova York (todos)' },
    '/m/0rh6k':   { codigo_pais: 'US', pais: 'Estados Unidos',   kgmid_pais: '/m/09c7w0', continente: 'América do Norte', kgmid_continente: '/m/059g4', label: 'Washington (todos)' },
    '/m/01_d4':   { codigo_pais: 'US', pais: 'Estados Unidos',   kgmid_pais: '/m/09c7w0', continente: 'América do Norte', kgmid_continente: '/m/059g4', label: 'Chicago (todos)' },
    '/m/0d6lp':   { codigo_pais: 'US', pais: 'Estados Unidos',   kgmid_pais: '/m/09c7w0', continente: 'América do Norte', kgmid_continente: '/m/059g4', label: 'San Francisco (todos)' },
    '/m/030qb3t': { codigo_pais: 'US', pais: 'Estados Unidos',   kgmid_pais: '/m/09c7w0', continente: 'América do Norte', kgmid_continente: '/m/059g4', label: 'Los Angeles (todos)' },
    '/m/0f2rq':   { codigo_pais: 'US', pais: 'Estados Unidos',   kgmid_pais: '/m/09c7w0', continente: 'América do Norte', kgmid_continente: '/m/059g4', label: 'Dallas (todos)' },
    '/m/03l2n':   { codigo_pais: 'US', pais: 'Estados Unidos',   kgmid_pais: '/m/09c7w0', continente: 'América do Norte', kgmid_continente: '/m/059g4', label: 'Houston (todos)' },
    '/m/0f2v0':   { codigo_pais: 'US', pais: 'Estados Unidos',   kgmid_pais: '/m/09c7w0', continente: 'América do Norte', kgmid_continente: '/m/059g4', label: 'Miami (todos)' },
    // Europa
    '/m/04jpl':   { codigo_pais: 'GB', pais: 'Reino Unido',      kgmid_pais: '/m/07ssc', continente: 'Europa',            kgmid_continente: '/m/02j9z', label: 'Londres (todos)' },
    '/m/05qtj':   { codigo_pais: 'FR', pais: 'França',           kgmid_pais: '/m/0f8l9c', continente: 'Europa',           kgmid_continente: '/m/02j9z', label: 'Paris (todos)' },
    '/m/04swd':   { codigo_pais: 'RU', pais: 'Rússia',           kgmid_pais: '/m/06bnz', continente: 'Europa',            kgmid_continente: '/m/02j9z', label: 'Moscou (todos)' },
    '/m/06mxs':   { codigo_pais: 'SE', pais: 'Suécia',           kgmid_pais: '/m/0d0vqn', continente: 'Europa',           kgmid_continente: '/m/02j9z', label: 'Estocolmo (todos)' },
    '/m/0947l':   { codigo_pais: 'IT', pais: 'Itália',           kgmid_pais: '/m/03rjj', continente: 'Europa',            kgmid_continente: '/m/02j9z', label: 'Milão (todos)' },
    '/m/06c62':   { codigo_pais: 'IT', pais: 'Itália',           kgmid_pais: '/m/03rjj', continente: 'Europa',            kgmid_continente: '/m/02j9z', label: 'Roma (todos)' },
    // América do Sul
    '/m/01ly5m':  { codigo_pais: 'AR', pais: 'Argentina',        kgmid_pais: '/m/0jgd', continente: 'América do Sul',     kgmid_continente: '/m/0dg3n1', label: 'Buenos Aires (todos)' },
    // Ásia
    '/m/07dfk':   { codigo_pais: 'JP', pais: 'Japão',            kgmid_pais: '/m/03_3d', continente: 'Ásia',              kgmid_continente: '/m/0j0k', label: 'Tóquio (todos)' },
    '/m/0dj5q':   { codigo_pais: 'JP', pais: 'Japão',            kgmid_pais: '/m/03_3d', continente: 'Ásia',              kgmid_continente: '/m/0j0k', label: 'Osaka (todos)' },
    '/m/0hsqf':   { codigo_pais: 'KR', pais: 'Coreia do Sul',    kgmid_pais: '/m/06qd3', continente: 'Ásia',              kgmid_continente: '/m/0j0k', label: 'Seul (todos)' },
    '/m/0195pd':  { codigo_pais: 'TH', pais: 'Tailândia',        kgmid_pais: '/m/07f1x', continente: 'Ásia',              kgmid_continente: '/m/0j0k', label: 'Bangkok (todos)' },
    '/m/04f_d':   { codigo_pais: 'ID', pais: 'Indonésia',        kgmid_pais: '/m/03ryn', continente: 'Ásia',              kgmid_continente: '/m/0j0k', label: 'Jacarta (todos)' },
    '/m/01914':   { codigo_pais: 'CN', pais: 'China',            kgmid_pais: '/m/0d05w3', continente: 'Ásia',             kgmid_continente: '/m/0j0k', label: 'Pequim (todos)' },
    '/m/06wjf':   { codigo_pais: 'CN', pais: 'China',            kgmid_pais: '/m/0d05w3', continente: 'Ásia',             kgmid_continente: '/m/0j0k', label: 'Xangai (todos)' },
    '/m/09949m':  { codigo_pais: 'TR', pais: 'Turquia',          kgmid_pais: '/m/01znc_', continente: 'Ásia',             kgmid_continente: '/m/0j0k', label: 'Istambul (todos)' },
    // Oriente Médio
    '/m/0162v':   { codigo_pais: 'AE', pais: 'Emirados Árabes',  kgmid_pais: '/m/0j1z8', continente: 'Ásia',              kgmid_continente: '/m/0j0k', label: 'Dubai (todos)' },
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
// v3.3: RESOLVER GEO - Aceita IATA ou kgmid
// ============================================================
function resolveGeo(origemCode) {
    // Se é kgmid de cidade → buscar no mapeamento interno
    if (origemCode.startsWith('/m/')) {
        const cityGeo = KGMID_CITY_GEO[origemCode];
        if (cityGeo) {
            console.log(`[Geo] kgmid ${origemCode} → ${cityGeo.label} (${cityGeo.pais})`);
            return cityGeo;
        }
        console.warn(`[Geo] kgmid ${origemCode} não encontrado no mapeamento interno`);
        return null;
    }
    
    // Se é código IATA → buscar no lookup JSON
    const lookup = getIataLookup();
    return lookup[origemCode] || null;
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

        // ============================================================
        // v3.3: VALIDAÇÃO - Aceita IATA (GRU), múltiplos IATA (GRU,CGH,VCP) ou kgmid (/m/02cft)
        // ============================================================
        const origemRaw = origem.trim();
        const isKgmid = origemRaw.startsWith('/m/');
        const isIata = /^[A-Z]{3}$/i.test(origemRaw);
        // v3.3b: Múltiplos IATA separados por vírgula (ex: GRU,CGH,VCP)
        const isMultiIata = /^[A-Z]{3}(,[A-Z]{3})+$/i.test(origemRaw);
        
        if (!isKgmid && !isIata && !isMultiIata) {
            return res.status(400).json({
                error: 'Código de origem inválido',
                message: 'Use código IATA (ex: GRU), múltiplos IATA (ex: GRU,CGH,VCP) ou kgmid (ex: /m/02cft)'
            });
        }
        
        // Para IATA, normaliza para maiúsculo. Para kgmid, mantém como está.
        const origemCode = isKgmid ? origemRaw : origemRaw.toUpperCase();
        // Para geo, usar o primeiro aeroporto se for múltiplos
        const origemGeoKey = isMultiIata ? origemCode.split(',')[0] : origemCode;

        if (!process.env.SEARCHAPI_KEY) {
            return res.status(500).json({
                error: 'SEARCHAPI_KEY não configurada',
                message: 'Configure em Vercel → Settings → Environment Variables'
            });
        }

        const currencyCode = (moeda && /^[A-Z]{3}$/.test(moeda)) ? moeda : 'BRL';
        const apenasInternacional = escopoDestino === 'internacional';
        console.log(`💱 Moeda: ${currencyCode} | Escopo: ${apenasInternacional ? 'INTERNACIONAL' : 'TODOS'} | Tipo: ${isKgmid ? 'KGMID' : isMultiIata ? 'MULTI_IATA' : 'IATA'}`);

        // ============================================================
        // v3.3: RESOLVER GEO (usa primeiro aeroporto se múltiplos)
        // ============================================================
        const geo = resolveGeo(origemGeoKey);

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
        // departure_id aceita tanto IATA quanto kgmid
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
        
        let results = [];
        try {
            results = await Promise.all(searchPromises);
        } catch (err) {
            console.error('❌ Erro nas buscas paralelas:', err);
            // Se Promise.all falhar, inicializa results vazio
            results = searchPromises.map(() => ({ destinations: [], error: 'Falha na busca', elapsed: 0 }));
        }
        
        // Garantir que results sempre tem estrutura válida
        results = results.map(r => r || { destinations: [], error: 'Resposta inválida', elapsed: 0 });
        
        const totalTime = Date.now() - startTime;

        // ============================================================
        // CONSOLIDAÇÃO: Deduplicar, manter menor preço
        // Se apenasInternacional → filtrar destinos do país de origem
        // ============================================================
        const allDestinations = new Map();
        const paisOrigem = geo?.pais?.toLowerCase() || '';
        const codigoPaisOrigem = geo?.codigo_pais?.toUpperCase() || '';

        function addDestinations(destinations, source) {
            // Validação defensiva
            if (!destinations || !Array.isArray(destinations)) {
                console.warn(`[Consolidação] Destinos inválidos de ${source}:`, destinations);
                return;
            }
            
            for (const dest of destinations) {
                // Validar dados mínimos do destino
                if (!dest || !dest.name || !dest.country) {
                    console.warn(`[Consolidação] Destino inválido ignorado:`, dest);
                    continue;
                }
                
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
                    origemTipo: isKgmid ? 'kgmid' : isMultiIata ? 'multi_iata' : 'iata',
                }
            });
        }

        console.log(`✅ Multi-Continent Search completo em ${totalTime}ms | ` +
            `${searchPromises.length} buscas → ${consolidated.length} destinos únicos | Moeda: ${currencyCode}`
        );

        // Preparar estatísticas compatíveis com v3.0
        const sources = {
            global: results[0]?.destinations?.length || 0,
            continente: 0,
            pais: 0,
        };

        // Se tem múltiplos continentes (modo internacional)
        if (results.length > 1) {
            // Somar destinos de todos os continentes buscados
            for (let i = 1; i < results.length; i++) {
                sources.continente += results[i]?.destinations?.length || 0;
            }
        }

        const timing = {
            global: results[0]?.elapsed || 0,
            continente: results.length > 1 ? Math.max(...results.slice(1).map(r => r.elapsed || 0)) : 0,
            pais: 0,
        };

        const errors = {
            global: results[0]?.error || null,
            continente: results.length > 1 ? (results.slice(1).find(r => r.error)?.error || null) : null,
            pais: null,
        };

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
                origemTipo: isKgmid ? 'kgmid' : isMultiIata ? 'multi_iata' : 'iata',
                escopoDestino: apenasInternacional ? 'internacional' : 'tanto_faz',
                preferencias: prefArray,
                sources,      // Compatível com v3.0
                timing,       // Compatível com v3.0
                errors,       // Compatível com v3.0
                totalBuscas: searchPromises.length,
                buscasDetalhadas: results.map((r, i) => ({
                    ordem: i + 1,
                    tipo: i === 0 ? 'global' : `continente_${i}`,
                    resultados: r?.destinations?.length || 0,
                    tempo: r?.elapsed || 0,
                    erro: r?.error || null
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
