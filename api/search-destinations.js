// api/search-destinations.js - VERSÃO TRIPLE SEARCH v2
// 3 buscas paralelas: Global + Continente + País
// Usa iata_geo_lookup.json para resolver aeroporto → país/continente

import { readFileSync } from 'fs';
import { join } from 'path';

// ============================================================
// LOOKUP: Carrega mapeamento IATA → país + continente
// ============================================================
let IATA_LOOKUP = null;

function getIataLookup() {
    if (IATA_LOOKUP) return IATA_LOOKUP;
    try {
        // Em Vercel, arquivos em /public/data/ são acessíveis via process.cwd()
        const filePath = join(process.cwd(), 'public', 'data', 'iata_geo_lookup.json');
        IATA_LOOKUP = JSON.parse(readFileSync(filePath, 'utf-8'));
        console.log(`[Lookup] ${Object.keys(IATA_LOOKUP).length} aeroportos carregados`);
    } catch (err) {
        console.error('[Lookup] Erro ao carregar iata_geo_lookup.json:', err.message);
        // Fallback mínimo para aeroportos brasileiros mais comuns
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
        currency: 'BRL',
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
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    try {
        const { origem, dataIda, dataVolta } = req.body;

        // Validar origem
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

        // ============================================================
        // RESOLVER GEO DO AEROPORTO
        // ============================================================
        const lookup = getIataLookup();
        const geo = lookup[origemCode] || null;

        console.log(`🔍 Triple Search de ${origemCode} | País: ${geo?.pais || '?'} | Continente: ${geo?.continente || '?'}`);

        // ============================================================
        // PARÂMETROS BASE (compartilhados pelas 3 buscas)
        // ============================================================
        const baseParams = {
            departure_id: origemCode,
        };

        // Datas → parâmetro correto é time_period
        // Round-trip: "YYYY-MM-DD..YYYY-MM-DD"
        // One-way:    "YYYY-MM-DD"
        if (dataIda && dataVolta) {
            baseParams.time_period = `${dataIda}..${dataVolta}`;
            console.log(`📅 Datas: ${dataIda} → ${dataVolta} (time_period: ${baseParams.time_period})`);
        } else if (dataIda) {
            baseParams.time_period = dataIda;
            console.log(`📅 Data ida: ${dataIda} (one-way)`);
        }
        // Se nenhuma data: API usa default "one_week_trip_in_the_next_six_months"

        // ============================================================
        // 3 BUSCAS EM PARALELO
        // ============================================================
        const startTime = Date.now();

        const [globalResult, continenteResult, paisResult] = await Promise.all([
            // BUSCA 1: GLOBAL (sem arrival_id → mundo inteiro)
            searchTravelExplore(
                { ...baseParams },
                `GLOBAL desde ${origemCode}`
            ),

            // BUSCA 2: CONTINENTE
            geo?.kgmid_continente
                ? searchTravelExplore(
                    { ...baseParams, arrival_id: geo.kgmid_continente },
                    `${geo.continente} desde ${origemCode}`
                )
                : Promise.resolve({ destinations: [], error: 'Continente não mapeado', elapsed: 0 }),

            // BUSCA 3: PAÍS (doméstico)
            geo?.kgmid_pais
                ? searchTravelExplore(
                    { ...baseParams, arrival_id: geo.kgmid_pais },
                    `${geo.pais} desde ${origemCode}`
                )
                : Promise.resolve({ destinations: [], error: 'País não mapeado', elapsed: 0 }),
        ]);

        const totalTime = Date.now() - startTime;

        // ============================================================
        // CONSOLIDAÇÃO: Deduplicar, manter menor preço
        // ============================================================
        const allDestinations = new Map();

        function addDestinations(destinations, source) {
            for (const dest of destinations) {
                // Chave de deduplicação: nome + país (mais confiável que kgmid que pode não existir)
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
                        // Metadados do triple search
                        _sources: [source],
                        _source_count: 1,
                    });
                } else {
                    const existing = allDestinations.get(key);
                    existing._sources.push(source);
                    existing._source_count++;
                    // Manter menor preço de voo
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

        addDestinations(globalResult.destinations, 'global');
        addDestinations(continenteResult.destinations, 'continente');
        addDestinations(paisResult.destinations, 'pais');

        // Ordenar por preço (destinos com preço 0 vão pro final)
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
                message: 'Nenhum voo encontrado nas 3 buscas. Tente outra origem ou datas.',
                _debug: {
                    global: { count: globalResult.destinations.length, error: globalResult.error },
                    continente: { count: continenteResult.destinations.length, error: continenteResult.error },
                    pais: { count: paisResult.destinations.length, error: paisResult.error },
                }
            });
        }

        console.log(`✅ Triple Search completo em ${totalTime}ms | ` +
            `Global=${globalResult.destinations.length} ` +
            `${geo?.continente || 'Continente'}=${continenteResult.destinations.length} ` +
            `${geo?.pais || 'País'}=${paisResult.destinations.length} ` +
            `→ ${consolidated.length} únicos`
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
            total: consolidated.length,
            destinations: consolidated,
            _meta: {
                totalTime,
                sources: {
                    global: globalResult.destinations.length,
                    continente: continenteResult.destinations.length,
                    pais: paisResult.destinations.length,
                },
                timing: {
                    global: globalResult.elapsed,
                    continente: continenteResult.elapsed,
                    pais: paisResult.elapsed,
                },
                errors: {
                    global: globalResult.error,
                    continente: continenteResult.error,
                    pais: paisResult.error,
                },
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
