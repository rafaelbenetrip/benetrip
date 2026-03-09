// api/search-destinations.js - VERSÃO MULTI-CONTINENTE v3.7
// v3.7: ESTRATÉGIA UNIFICADA DE BUSCAS
// - Todos os escopos usam o mesmo conjunto amplo de buscas
// - Filtro nacional/internacional acontece APENAS na consolidação
// - "Internacional" nunca terá menos resultados que "tanto faz" (menos domésticos)
// - Estratégia por continente otimizada para maximizar destinos
// - Nacional: buscas focadas (GLOBAL + PAÍS) — sem desperdício de chamadas
//
// v3.6: FIX origens kgmid, safety net, fallback geo
// v3.5: GEO VINDO DO FRONTEND
// v3.4: SUPORTE A ESCOPO "NACIONAL"
// v3.3: SUPORTE A KGMID como departure_id
// v3.2: BUSCA EM MÚLTIPLOS CONTINENTES

import { readFileSync } from 'fs';
import { join } from 'path';

export const maxDuration = 60;

// ============================================================
// MAPEAMENTO DE CONTINENTES/REGIÕES PARA BUSCA
// ============================================================
const CONTINENTES_KGMID = {
    'america_sul':     '/m/0dg3n1',
    'america_norte':   '/m/059g4',
    'america_central': '/m/0261m',
    'europa':          '/m/02j9z',
    'asia':            '/m/0j0k',
    'africa':          '/m/0dv5r',
    'oceania':         '/m/05nrg',
};

// ============================================================
// v3.7: ESTRATÉGIA UNIFICADA — Quais continentes buscar por região de origem
// Ordem: do mais provável ao menos provável para aquela origem
// Usado tanto para "tanto_faz" quanto para "internacional"
// ============================================================
const ESTRATEGIA_BUSCAS = {
    'america_sul': {
        continentes: ['america_sul', 'america_central', 'america_norte', 'europa'],
        descricao: 'América do Sul → Sul, Caribe, Norte, Europa'
    },
    'america_norte': {
        continentes: ['america_norte', 'america_central', 'europa', 'america_sul', 'asia'],
        descricao: 'América do Norte → Norte, Caribe, Europa, Sul, Ásia'
    },
    'america_central': {
        continentes: ['america_central', 'america_sul', 'america_norte', 'europa'],
        descricao: 'Caribe → Caribe, Sul, Norte, Europa'
    },
    'europa': {
        continentes: ['europa', 'africa', 'asia', 'america_norte', 'america_sul'],
        descricao: 'Europa → Europa, África, Ásia, América do Norte, América do Sul'
    },
    'asia': {
        continentes: ['asia', 'oceania', 'europa', 'africa', 'america_norte'],
        descricao: 'Ásia → Ásia, Oceania, Europa, África, América do Norte'
    },
    'africa': {
        continentes: ['africa', 'europa', 'asia', 'america_sul'],
        descricao: 'África → África, Europa, Ásia, América do Sul'
    },
    'oceania': {
        continentes: ['oceania', 'asia', 'america_norte', 'europa'],
        descricao: 'Oceania → Oceania, Ásia, América do Norte, Europa'
    },
};

function getChaveContinente(continente) {
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
            "CGH": { "codigo_pais": "BR", "pais": "Brasil", "kgmid_pais": "/m/015fr", "continente": "América do Sul", "kgmid_continente": "/m/0dg3n1" },
            "SDU": { "codigo_pais": "BR", "pais": "Brasil", "kgmid_pais": "/m/015fr", "continente": "América do Sul", "kgmid_continente": "/m/0dg3n1" },
        };
    }
    return IATA_LOOKUP;
}

// ============================================================
// RESOLVER GEO (v3.6+)
// ============================================================
function resolveGeo(origemCode, origemGeoFromFrontend) {
    // 1. Frontend enviou dados geo
    if (origemGeoFromFrontend && origemGeoFromFrontend.pais) {
        console.log(`[Geo] Dados geo do frontend: ${origemGeoFromFrontend.pais} (kgmid_pais: ${origemGeoFromFrontend.kgmid_pais || 'N/A'})`);
        return {
            codigo_pais: origemGeoFromFrontend.codigo_pais || '',
            pais: origemGeoFromFrontend.pais,
            kgmid_pais: origemGeoFromFrontend.kgmid_pais || '',
            continente: origemGeoFromFrontend.continente || '',
            kgmid_continente: origemGeoFromFrontend.kgmid_continente || '',
        };
    }

    // 2. IATA simples
    if (/^[A-Z]{3}$/i.test(origemCode)) {
        const lookup = getIataLookup();
        const geo = lookup[origemCode.toUpperCase()];
        if (geo) {
            console.log(`[Geo] IATA ${origemCode} → ${geo.pais} via lookup`);
            return geo;
        }
    }

    // 3. Multi-IATA
    if (/^[A-Z]{3}(,[A-Z]{3})+$/i.test(origemCode)) {
        const primeiro = origemCode.split(',')[0].toUpperCase();
        const lookup = getIataLookup();
        const geo = lookup[primeiro];
        if (geo) {
            console.log(`[Geo] Multi-IATA → usando ${primeiro} → ${geo.pais}`);
            return geo;
        }
    }

    // 4. kgmid — fallbacks
    if (origemCode.startsWith('/m/')) {
        if (origemGeoFromFrontend && origemGeoFromFrontend.codigo_pais) {
            console.log(`[Geo] kgmid ${origemCode} → usando codigo_pais do frontend: ${origemGeoFromFrontend.codigo_pais}`);
            return {
                codigo_pais: origemGeoFromFrontend.codigo_pais,
                pais: origemGeoFromFrontend.pais || '',
                kgmid_pais: origemGeoFromFrontend.kgmid_pais || '',
                continente: origemGeoFromFrontend.continente || '',
                kgmid_continente: origemGeoFromFrontend.kgmid_continente || '',
            };
        }

        const lookup = getIataLookup();
        const KGMID_FALLBACK = {
            '/m/022pfm': 'GRU',
            '/m/06gmr':  'GIG',
            '/m/01ky2c': 'BSB',
            '/m/01nmhq': 'SSA',
            '/m/04cjn':  'GIG',
        };
        const fallbackIata = KGMID_FALLBACK[origemCode];
        if (fallbackIata && lookup[fallbackIata]) {
            console.log(`[Geo] kgmid ${origemCode} → fallback IATA ${fallbackIata} → ${lookup[fallbackIata].pais}`);
            return lookup[fallbackIata];
        }

        console.warn(`[Geo] ⚠️ kgmid ${origemCode}: NÃO foi possível resolver geo`);
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
            return { destinations: [], error: `HTTP ${response.status}`, elapsed, label };
        }

        const data = await response.json();
        const count = (data.destinations || []).length;
        console.log(`[SearchAPI][${label}] ${count} destinos (${elapsed}ms)`);
        return { destinations: data.destinations || [], error: null, elapsed, label };
    } catch (err) {
        const elapsed = Date.now() - startTime;
        console.error(`[SearchAPI][${label}] Erro (${elapsed}ms):`, err.message);
        return { destinations: [], error: err.message, elapsed, label };
    }
}

// ============================================================
// v3.7: MONTAR BUSCAS — estratégia unificada por escopo
// ============================================================
function montarBuscas(baseParams, geo, escopoDestino) {
    const buscas = [];

    // ─── BUSCA 1: GLOBAL (sempre, em qualquer escopo) ───
    buscas.push({ params: { ...baseParams }, label: 'GLOBAL' });

    if (escopoDestino === 'nacional') {
        // ─── NACIONAL: GLOBAL + PAÍS (2-3 buscas, focadas) ───
        // A busca GLOBAL já traz destinos domésticos populares
        // A busca por PAÍS garante cobertura completa do território
        if (geo?.kgmid_pais) {
            buscas.push({
                params: { ...baseParams, arrival_id: geo.kgmid_pais },
                label: `PAÍS ${geo.pais}`
            });
        }
        // Extra: busca no continente para pegar domésticos que aparecem lá
        if (geo?.kgmid_continente) {
            buscas.push({
                params: { ...baseParams, arrival_id: geo.kgmid_continente },
                label: `CONTINENTE ${geo.continente} (filtro nacional)`
            });
        }
        console.log(`🏠 Modo NACIONAL: ${buscas.length} buscas (GLOBAL + PAÍS + CONTINENTE → filtro doméstico na consolidação)`);

    } else {
        // ─── TANTO FAZ / INTERNACIONAL: Mesma estratégia ampla ───
        // Diferença está APENAS no filtro de consolidação
        
        // Busca por PAÍS (traz domésticos — útil para "tanto faz", descartados para "internacional")
        if (geo?.kgmid_pais) {
            buscas.push({
                params: { ...baseParams, arrival_id: geo.kgmid_pais },
                label: `PAÍS ${geo.pais}`
            });
        }

        // Buscas por CONTINENTES — estratégia baseada na região de origem
        if (geo?.continente) {
            const chave = getChaveContinente(geo.continente);
            const estrategia = ESTRATEGIA_BUSCAS[chave];

            if (estrategia) {
                console.log(`🌍 Estratégia de continentes: ${estrategia.descricao}`);
                
                // Pega até 5 continentes da estratégia
                const continentesParaBuscar = estrategia.continentes.slice(0, 5);
                
                for (const ck of continentesParaBuscar) {
                    const kgmid = CONTINENTES_KGMID[ck];
                    if (!kgmid) continue;
                    
                    // Evita duplicata se kgmid_continente do geo já é esse
                    // (já está coberto implicitamente pela busca GLOBAL)
                    buscas.push({
                        params: { ...baseParams, arrival_id: kgmid },
                        label: ck.toUpperCase().replace('_', ' ')
                    });
                }
            } else if (geo.kgmid_continente) {
                // Fallback: buscar no continente de origem
                buscas.push({
                    params: { ...baseParams, arrival_id: geo.kgmid_continente },
                    label: `CONTINENTE ${geo.continente}`
                });
            }
        }

        const escopoTxt = escopoDestino === 'internacional' ? 'INTERNACIONAL' : 'TANTO FAZ';
        console.log(`✈️ Modo ${escopoTxt}: ${buscas.length} buscas (GLOBAL + PAÍS + ${buscas.length - 2} continentes → filtro na consolidação)`);
    }

    return buscas;
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
        console.log(`\n${'='.repeat(60)}`);
        console.log(`💱 Moeda: ${currencyCode} | Escopo: ${escopoLabel} | Tipo: ${isKgmid ? 'KGMID' : isMultiIata ? 'MULTI_IATA' : 'IATA'}`);

        // Resolve geo
        const geo = resolveGeo(origemCode, origemGeoBody);
        console.log(`🔍 Origem: ${origemCode} | País: ${geo?.pais || '?'} | Continente: ${geo?.continente || '?'}`);

        // ─── SAFETY NET: Escopo filtrado exige geo ───
        if (!geo && (apenasInternacional || apenasNacional)) {
            console.error(`❌ SAFETY NET: Geo não resolvido para ${origemCode} — impossível filtrar ${escopoLabel}`);
            return res.status(404).json({
                error: 'Não foi possível determinar o país de origem',
                message: `Para buscar destinos ${apenasInternacional ? 'internacionais' : 'nacionais'}, precisamos identificar seu país de origem. Tente selecionar um aeroporto específico.`,
                _debug: { origemCode, isKgmid, escopoDestino, geoResolvido: false }
            });
        }
        if ((apenasInternacional || apenasNacional) && geo && !geo.pais) {
            console.error(`❌ SAFETY NET: Geo sem campo 'pais' para ${origemCode}`);
            return res.status(404).json({
                error: 'País de origem não identificado',
                message: `Não conseguimos identificar o país de origem. Tente selecionar um aeroporto específico.`,
                _debug: { origemCode, geo, escopoDestino }
            });
        }

        // Preferências → interests
        const INTERESTS_MAP = { 'relax': 'beaches', 'aventura': 'outdoors', 'cultura': 'museums', 'urbano': 'popular' };
        let prefArray = [];
        if (Array.isArray(preferencias)) prefArray = preferencias;
        else if (typeof preferencias === 'string') prefArray = preferencias.split(',').filter(Boolean);
        const interests = prefArray.length === 1 ? (INTERESTS_MAP[prefArray[0]] || 'popular') : 'popular';
        console.log(`🎯 Preferências: [${prefArray.join(', ')}] → interests: ${interests}`);

        // Parâmetros base
        const baseParams = { departure_id: origemCode, interests, currency: currencyCode };
        if (dataIda && dataVolta) {
            baseParams.time_period = `${dataIda}..${dataVolta}`;
            console.log(`📅 Datas: ${dataIda} → ${dataVolta}`);
        } else if (dataIda) {
            baseParams.time_period = dataIda;
        }

        // ============================================================
        // v3.7: MONTAR E EXECUTAR BUSCAS
        // ============================================================
        const buscasConfig = montarBuscas(baseParams, geo, escopoDestino);
        const startTime = Date.now();

        console.log(`📡 ${buscasConfig.length} buscas paralelas:`);
        buscasConfig.forEach((b, i) => console.log(`   ${i + 1}. ${b.label}`));

        // Executa todas em paralelo
        const searchPromises = buscasConfig.map(b => searchTravelExplore(b.params, b.label));
        
        let results = [];
        try {
            results = await Promise.all(searchPromises);
        } catch (err) {
            console.error('❌ Erro paralelo:', err);
            results = searchPromises.map(() => ({ destinations: [], error: 'Falha', elapsed: 0, label: '?' }));
        }
        results = results.map(r => r || { destinations: [], error: 'Resposta inválida', elapsed: 0, label: '?' });
        const totalTime = Date.now() - startTime;

        // ============================================================
        // v3.7: CONSOLIDAÇÃO UNIFICADA
        // Filtro nacional/internacional acontece aqui, não na seleção de buscas
        // ============================================================
        const allDestinations = new Map();
        const paisOrigem = geo?.pais?.toLowerCase() || '';

        // Safety check adicional
        if (!paisOrigem && (apenasInternacional || apenasNacional)) {
            console.error(`❌ CRITICAL: paisOrigem vazio na consolidação com escopo ${escopoLabel}`);
            return res.status(404).json({
                error: 'Erro interno',
                message: 'Não foi possível filtrar destinos. Tente novamente.',
                _debug: { paisOrigem: '(vazio)', escopoDestino }
            });
        }

        let totalBruto = 0;
        let filtradosDomestico = 0;
        let filtradosInternacional = 0;

        function addDestinations(destinations, source) {
            if (!destinations || !Array.isArray(destinations)) return;
            for (const dest of destinations) {
                if (!dest || !dest.name || !dest.country) continue;
                totalBruto++;

                const destCountry = (dest.country || '').toLowerCase();
                const isDestinoDomestico = paisOrigem && destCountry === paisOrigem;

                // ─── FILTRO POR ESCOPO (único ponto de filtragem) ───
                if (apenasInternacional && isDestinoDomestico) {
                    filtradosDomestico++;
                    continue;
                }
                if (apenasNacional && !isDestinoDomestico) {
                    filtradosInternacional++;
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
                    if (!existing._sources.includes(source)) {
                        existing._sources.push(source);
                        existing._source_count++;
                    }
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
            const label = buscasConfig[idx]?.label || `busca_${idx}`;
            addDestinations(result.destinations, label);
        });

        // Ordenar por preço
        const consolidated = Array.from(allDestinations.values()).sort((a, b) => {
            if (a.flight.price === 0 && b.flight.price === 0) return 0;
            if (a.flight.price === 0) return 1;
            if (b.flight.price === 0) return -1;
            return a.flight.price - b.flight.price;
        });

        // ─── LOG DE CONSOLIDAÇÃO ───
        console.log(`📊 Consolidação:`);
        console.log(`   Bruto (todas as buscas): ${totalBruto} destinos`);
        if (apenasInternacional) console.log(`   Filtrados (domésticos removidos): ${filtradosDomestico}`);
        if (apenasNacional) console.log(`   Filtrados (internacionais removidos): ${filtradosInternacional}`);
        console.log(`   Únicos após deduplicação: ${consolidated.length}`);

        // Detalhes por busca
        results.forEach((r, i) => {
            const label = buscasConfig[i]?.label || `busca_${i}`;
            const count = r.destinations?.length || 0;
            const tempo = r.elapsed || 0;
            const erro = r.error ? ` ⚠️ ${r.error}` : '';
            console.log(`   [${label}] ${count} destinos (${tempo}ms)${erro}`);
        });

        if (consolidated.length === 0) {
            let mensagemErro;
            if (apenasNacional) {
                mensagemErro = `Nenhum destino doméstico encontrado em ${geo?.pais || 'seu país'}. Tente incluir destinos internacionais ou ajuste datas/orçamento.`;
            } else if (apenasInternacional) {
                mensagemErro = `Nenhum voo internacional encontrado saindo de ${geo?.pais || 'seu país'}. Tente incluir destinos nacionais ou ajuste datas/orçamento.`;
            } else {
                mensagemErro = 'Nenhum voo encontrado. Tente outra origem ou datas.';
            }
            
            return res.status(404).json({
                error: 'Nenhum destino encontrado',
                message: mensagemErro,
                _debug: {
                    totalBuscas: buscasConfig.length,
                    totalBruto,
                    filtradosDomestico,
                    filtradosInternacional,
                    escopo: escopoLabel,
                    geoResolvido: !!geo,
                    paisOrigem: paisOrigem || '(vazio)'
                }
            });
        }

        console.log(`✅ ${totalTime}ms | ${buscasConfig.length} buscas → ${consolidated.length} destinos únicos | Escopo: ${escopoLabel}`);
        console.log(`${'='.repeat(60)}\n`);

        // ─── MONTAR RESPOSTA ───
        const sourcesInfo = {};
        results.forEach((r, i) => {
            const label = buscasConfig[i]?.label || `busca_${i}`;
            sourcesInfo[label] = r.destinations?.length || 0;
        });

        return res.status(200).json({
            success: true,
            origem: origemCode,
            origemGeo: geo ? { pais: geo.pais, codigo_pais: geo.codigo_pais, continente: geo.continente } : null,
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
                totalBuscas: buscasConfig.length,
                totalBruto,
                filtradosDomestico: apenasInternacional ? filtradosDomestico : 0,
                filtradosInternacional: apenasNacional ? filtradosInternacional : 0,
                sources: sourcesInfo,
                buscasDetalhadas: results.map((r, i) => ({
                    ordem: i + 1,
                    label: buscasConfig[i]?.label || `busca_${i}`,
                    resultados: r?.destinations?.length || 0,
                    tempo: r?.elapsed || 0,
                    erro: r?.error || null
                }))
            }
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        return res.status(500).json({ error: 'Erro ao buscar destinos', message: error.message });
    }
}
