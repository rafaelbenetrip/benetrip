// api/search-destinations.js - VERSÃO MULTI-CONTINENTE v3.4
// v3.4: SUPORTE A ESCOPO "NACIONAL" (apenas destinos domésticos)
// - escopoDestino: 'nacional' → busca apenas no país de origem
// - escopoDestino: 'internacional' → busca em múltiplos continentes (exclui país de origem)
// - escopoDestino: undefined/outro → busca global + continente + país (todos)
//
// v3.3: SUPORTE A KGMID como departure_id
// v3.2: BUSCA EM MÚLTIPLOS CONTINENTES quando "apenas internacional"
// v3.0: Triple search + filtro internacional + multi-preferências

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
// v3.3: MAPEAMENTO KGMID DE CIDADE → DADOS GEO
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
    if (origemCode.startsWith('/m/')) {
        const cityGeo = KGMID_CITY_GEO[origemCode];
        if (cityGeo) {
            console.log(`[Geo] kgmid ${origemCode} → ${cityGeo.label} (${cityGeo.pais})`);
            return cityGeo;
        }
        console.warn(`[Geo] kgmid ${origemCode} não encontrado no mapeamento interno`);
        return null;
    }
    const lookup = getIataLookup();
    return lookup[origemCode] || null;
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
        const { origem, dataIda, dataVolta, preferencias, moeda, escopoDestino } = req.body;

        if (!origem || typeof origem !== 'string') {
            return res.status(400).json({
                error: 'Origem obrigatória',
                exemplo: { origem: 'GRU', dataIda: '2026-03-15', dataVolta: '2026-03-22' }
            });
        }

        // ============================================================
        // VALIDAÇÃO - Aceita IATA, multi-IATA ou kgmid
        // ============================================================
        const origemRaw = origem.trim();
        const isKgmid = origemRaw.startsWith('/m/');
        const isIata = /^[A-Z]{3}$/i.test(origemRaw);
        const isMultiIata = /^[A-Z]{3}(,[A-Z]{3})+$/i.test(origemRaw);
        
        if (!isKgmid && !isIata && !isMultiIata) {
            return res.status(400).json({
                error: 'Código de origem inválido',
                message: 'Use código IATA (ex: GRU), múltiplos (ex: GRU,CGH,VCP) ou kgmid (ex: /m/02cft)'
            });
        }
        
        const origemCode = isKgmid ? origemRaw : origemRaw.toUpperCase();
        const origemGeoKey = isMultiIata ? origemCode.split(',')[0] : origemCode;

        if (!process.env.SEARCHAPI_KEY) {
            return res.status(500).json({
                error: 'SEARCHAPI_KEY não configurada',
                message: 'Configure em Vercel → Settings → Environment Variables'
            });
        }

        const currencyCode = (moeda && /^[A-Z]{3}$/.test(moeda)) ? moeda : 'BRL';
        
        // ============================================================
        // v3.4: TRÊS MODOS DE ESCOPO
        // - 'internacional' → exclui país de origem, busca multi-continente
        // - 'nacional'      → busca APENAS no país de origem
        // - undefined/outro  → busca global (todos os destinos)
        // ============================================================
        const apenasInternacional = escopoDestino === 'internacional';
        const apenasNacional = escopoDestino === 'nacional';
        
        const escopoLabel = apenasInternacional ? 'INTERNACIONAL' : apenasNacional ? 'NACIONAL' : 'TODOS';
        console.log(`💱 Moeda: ${currencyCode} | Escopo: ${escopoLabel} | Tipo: ${isKgmid ? 'KGMID' : isMultiIata ? 'MULTI_IATA' : 'IATA'}`);

        // ============================================================
        // RESOLVER GEO
        // ============================================================
        const geo = resolveGeo(origemGeoKey);

        console.log(`🔍 Search de ${origemCode} | País: ${geo?.pais || '?'} | Continente: ${geo?.continente || '?'} | Escopo: ${escopoLabel}`);

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
        // v3.4: ESTRATÉGIA DE BUSCAS BASEADA EM ESCOPO (3 modos)
        // ============================================================
        const searchPromises = [];
        const startTime = Date.now();

        if (apenasNacional) {
            // ============================================================
            // MODO NACIONAL: Buscar APENAS dentro do país de origem
            // Faz 2 buscas: global (para ter mais resultados) + país específico
            // A filtragem por país acontece na consolidação
            // ============================================================
            if (geo?.kgmid_pais) {
                console.log(`🏠 Modo NACIONAL: buscando apenas em ${geo.pais} (${geo.kgmid_pais})`);
                
                // Busca 1: Focada no país (arrival_id = país)
                searchPromises.push(
                    searchTravelExplore(
                        { ...baseParams, arrival_id: geo.kgmid_pais },
                        `NACIONAL ${geo.pais} desde ${origemCode}`
                    )
                );
                
                // Busca 2: Global (depois filtramos só doméstico na consolidação)
                // Isso pega destinos nacionais que a busca focada pode ter perdido
                searchPromises.push(
                    searchTravelExplore(
                        { ...baseParams },
                        `GLOBAL (filtro nacional) desde ${origemCode}`
                    )
                );
            } else {
                // Sem geo do país, faz busca global e filtra depois
                console.warn(`⚠️ Sem kgmid_pais para ${origemCode}, buscando global e filtrando`);
                searchPromises.push(
                    searchTravelExplore(
                        { ...baseParams },
                        `GLOBAL (filtro nacional fallback) desde ${origemCode}`
                    )
                );
            }

        } else if (apenasInternacional) {
            // ============================================================
            // MODO INTERNACIONAL: Buscar em múltiplos continentes
            // ============================================================
            
            // Busca 1: Global (sempre)
            searchPromises.push(
                searchTravelExplore(
                    { ...baseParams },
                    `GLOBAL desde ${origemCode}`
                )
            );

            if (geo?.continente) {
                const estrategiaKey = getEstrategiaContinente(geo.continente);
                const estrategia = ESTRATEGIA_CONTINENTES[estrategiaKey];
                
                if (estrategia) {
                    console.log(`🌍 Estratégia internacional: ${estrategia.descricao}`);
                    
                    estrategia.prioridade.slice(0, 4).forEach(continenteKey => {
                        const kgmid = CONTINENTES_KGMID[continenteKey];
                        if (kgmid) {
                            searchPromises.push(
                                searchTravelExplore(
                                    { ...baseParams, arrival_id: kgmid },
                                    `${continenteKey.toUpperCase()} desde ${origemCode}`
                                )
                            );
                        }
                    });
                } else {
                    searchPromises.push(
                        searchTravelExplore(
                            { ...baseParams, arrival_id: geo.kgmid_continente },
                            `${geo.continente} desde ${origemCode}`
                        )
                    );
                }
            }
            
        } else {
            // ============================================================
            // MODO TODOS: Busca global + continente + país (como antes)
            // ============================================================
            
            // Busca 1: Global
            searchPromises.push(
                searchTravelExplore(
                    { ...baseParams },
                    `GLOBAL desde ${origemCode}`
                )
            );
            
            // Busca 2: Continente
            if (geo?.kgmid_continente) {
                searchPromises.push(
                    searchTravelExplore(
                        { ...baseParams, arrival_id: geo.kgmid_continente },
                        `${geo.continente} desde ${origemCode}`
                    )
                );
            }
            
            // Busca 3: País (doméstico)
            if (geo?.kgmid_pais) {
                searchPromises.push(
                    searchTravelExplore(
                        { ...baseParams, arrival_id: geo.kgmid_pais },
                        `${geo.pais} desde ${origemCode}`
                    )
                );
            }
        }

        console.log(`📡 Fazendo ${searchPromises.length} buscas paralelas (escopo: ${escopoLabel})...`);
        
        let results = [];
        try {
            results = await Promise.all(searchPromises);
        } catch (err) {
            console.error('❌ Erro nas buscas paralelas:', err);
            results = searchPromises.map(() => ({ destinations: [], error: 'Falha na busca', elapsed: 0 }));
        }
        
        results = results.map(r => r || { destinations: [], error: 'Resposta inválida', elapsed: 0 });
        
        const totalTime = Date.now() - startTime;

        // ============================================================
        // CONSOLIDAÇÃO: Deduplicar, manter menor preço
        // v3.4: Filtro por escopo (nacional/internacional/todos)
        // ============================================================
        const allDestinations = new Map();
        const paisOrigem = geo?.pais?.toLowerCase() || '';
        const codigoPaisOrigem = geo?.codigo_pais?.toUpperCase() || '';

        function addDestinations(destinations, source) {
            if (!destinations || !Array.isArray(destinations)) {
                console.warn(`[Consolidação] Destinos inválidos de ${source}:`, destinations);
                return;
            }
            
            for (const dest of destinations) {
                if (!dest || !dest.name || !dest.country) {
                    console.warn(`[Consolidação] Destino inválido ignorado:`, dest);
                    continue;
                }
                
                const destCountry = (dest.country || '').toLowerCase();
                const isDestinoDomestico = paisOrigem && destCountry === paisOrigem;
                
                // v3.4: Filtrar por escopo
                if (apenasInternacional && isDestinoDomestico) {
                    // Internacional: pular destinos do mesmo país
                    continue;
                }
                if (apenasNacional && !isDestinoDomestico) {
                    // Nacional: pular destinos de outros países
                    continue;
                }

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

        results.forEach((result, idx) => {
            const label = idx === 0 ? 'busca_principal' : `busca_${idx}`;
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
            let mensagemErro;
            if (apenasNacional) {
                mensagemErro = `Nenhum destino doméstico encontrado em ${geo?.pais || 'seu país'}. Tente incluir destinos internacionais ou ajuste datas/orçamento.`;
            } else if (apenasInternacional) {
                mensagemErro = 'Nenhum voo internacional encontrado. Tente incluir destinos nacionais ou ajuste datas/orçamento.';
            } else {
                mensagemErro = 'Nenhum voo encontrado nas buscas. Tente outra origem ou datas.';
            }
            
            return res.status(404).json({
                error: 'Nenhum destino encontrado',
                message: mensagemErro,
                _debug: {
                    totalBuscas: searchPromises.length,
                    escopo: escopoLabel,
                    origemTipo: isKgmid ? 'kgmid' : isMultiIata ? 'multi_iata' : 'iata',
                }
            });
        }

        console.log(`✅ Search completo em ${totalTime}ms | ` +
            `${searchPromises.length} buscas → ${consolidated.length} destinos únicos | Escopo: ${escopoLabel} | Moeda: ${currencyCode}`
        );

        // Preparar estatísticas
        const sources = {
            global: 0,
            continente: 0,
            pais: 0,
        };

        // Calcular sources baseado no modo
        if (apenasNacional) {
            sources.pais = results[0]?.destinations?.length || 0;
            if (results.length > 1) sources.global = results[1]?.destinations?.length || 0;
        } else if (apenasInternacional) {
            sources.global = results[0]?.destinations?.length || 0;
            for (let i = 1; i < results.length; i++) {
                sources.continente += results[i]?.destinations?.length || 0;
            }
        } else {
            sources.global = results[0]?.destinations?.length || 0;
            if (results.length > 1) sources.continente = results[1]?.destinations?.length || 0;
            if (results.length > 2) sources.pais = results[2]?.destinations?.length || 0;
        }

        const timing = {
            total: totalTime,
            buscas: results.map(r => r.elapsed || 0),
        };

        const errors = {};
        results.forEach((r, i) => {
            if (r.error) errors[`busca_${i}`] = r.error;
        });

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
                escopoDestino: escopoLabel.toLowerCase(),
                preferencias: prefArray,
                sources,
                timing,
                errors: Object.keys(errors).length > 0 ? errors : null,
                totalBuscas: searchPromises.length,
                buscasDetalhadas: results.map((r, i) => ({
                    ordem: i + 1,
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
