// api/cheapest-flights.js - BENETRIP VOOS BARATOS v1.0
// Encontra o período mais barato para viajar nos próximos 6 meses
// Usa SearchAPI google_flights_calendar engine
// Estratégia: divide 6 meses em janelas de ~14 dias (max 200 combos por request)

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const MAX_COMBOS_PER_REQUEST = 200;
const WINDOW_SIZE_DAYS = 14; // 14 x 14 = 196 combos (< 200)
const MONTHS_AHEAD = 6;
const ENRICH_TOP_N = 5; // Enriquecer os top N com detalhes do voo

// ============================================================
// HELPER: Formatar data como YYYY-MM-DD
// ============================================================
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ============================================================
// HELPER: Adicionar dias a uma data
// ============================================================
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// ============================================================
// HELPER: Diferença em dias entre duas datas
// ============================================================
function diffDays(dateStr1, dateStr2) {
    const d1 = new Date(dateStr1 + 'T00:00:00Z');
    const d2 = new Date(dateStr2 + 'T00:00:00Z');
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

// ============================================================
// BUSCA INDIVIDUAL no SearchAPI Calendar
// ============================================================
async function searchFlightsCalendar(params, label) {
    const url = new URL('https://www.searchapi.io/api/v1/search');

    const fullParams = {
        engine: 'google_flights_calendar',
        api_key: process.env.SEARCHAPI_KEY,
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
            console.error(`[Calendar][${label}] HTTP ${response.status} (${elapsed}ms):`, errorText.substring(0, 200));
            return { calendar: [], error: `HTTP ${response.status}`, elapsed };
        }

        const data = await response.json();
        const count = (data.calendar || []).length;
        console.log(`[Calendar][${label}] ${count} resultados (${elapsed}ms)`);

        return { calendar: data.calendar || [], error: null, elapsed };
    } catch (err) {
        const elapsed = Date.now() - startTime;
        console.error(`[Calendar][${label}] Erro (${elapsed}ms):`, err.message);
        return { calendar: [], error: err.message, elapsed };
    }
}

// ============================================================
// GERAR JANELAS DE BUSCA
// Para cobrir N meses com janelas de WINDOW_SIZE_DAYS
// ============================================================
function generateSearchWindows(startDate, months, duration) {
    const windows = [];
    const endDate = addDays(startDate, months * 30); // ~6 meses

    let windowStart = new Date(startDate);

    while (windowStart < endDate) {
        let windowEnd = addDays(windowStart, WINDOW_SIZE_DAYS - 1);
        if (windowEnd > endDate) windowEnd = endDate;

        // Para round_trip: return dates = outbound dates + duration
        const returnStart = addDays(windowStart, duration);
        const returnEnd = addDays(windowEnd, duration);

        windows.push({
            outbound_date: formatDate(windowStart),
            outbound_date_start: formatDate(windowStart),
            outbound_date_end: formatDate(windowEnd),
            return_date: formatDate(returnStart),
            return_date_start: formatDate(returnStart),
            return_date_end: formatDate(returnEnd),
        });

        // Avançar para próxima janela
        windowStart = addDays(windowEnd, 1);
    }

    return windows;
}

// ============================================================
// ENRIQUECIMENTO: Buscar detalhes do voo (duração, paradas, cia)
// Usa engine google_flights para uma data específica
// ============================================================
async function enrichFlightDetails(origemCode, destinoCode, departDate, returnDate, currencyCode, locale, label) {
    const url = new URL('https://www.searchapi.io/api/v1/search');

    const params = {
        engine: 'google_flights',
        api_key: process.env.SEARCHAPI_KEY,
        departure_id: origemCode,
        arrival_id: destinoCode,
        outbound_date: departDate,
        return_date: returnDate,
        flight_type: 'round_trip',
        currency: currencyCode,
        gl: locale.gl,
        hl: locale.hl,
        adults: '1',
    };

    Object.entries(params).forEach(([k, v]) => {
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
            console.error(`[Enrich][${label}] HTTP ${response.status} (${elapsed}ms)`);
            return null;
        }

        const data = await response.json();
        console.log(`[Enrich][${label}] OK (${elapsed}ms)`);

        // Extrair o melhor voo (best_flights[0] ou other_flights[0])
        const bestFlight = (data.best_flights && data.best_flights[0])
            || (data.other_flights && data.other_flights[0]);

        if (!bestFlight) return null;

        // Extrair detalhes
        const flights = bestFlight.flights || [];
        const outboundLegs = [];
        let totalDuration = bestFlight.total_duration || 0;
        let stops = (bestFlight.layovers || []).length;
        let price = bestFlight.price || 0;

        // Companhias aéreas (dedup)
        const airlines = new Set();
        const airlineLogos = new Set();

        flights.forEach(leg => {
            if (leg.airline) airlines.add(leg.airline);
            if (leg.airline_logo) airlineLogos.add(leg.airline_logo);
            outboundLegs.push({
                from: leg.departure_airport?.id || '',
                to: leg.arrival_airport?.id || '',
                airline: leg.airline || '',
                airline_logo: leg.airline_logo || '',
                flight_number: leg.flight_number || '',
                duration: leg.duration || 0,
                airplane: leg.airplane || '',
            });
        });

        // Price insights
        const priceInsights = data.price_insights ? {
            lowest_price: data.price_insights.lowest_price || null,
            price_level: data.price_insights.price_level || null,
            typical_price_range: data.price_insights.typical_price_range || null,
        } : null;

        return {
            total_duration: totalDuration,
            stops,
            airlines: Array.from(airlines),
            airline_logos: Array.from(airlineLogos),
            legs: outboundLegs,
            price: price,
            price_insights: priceInsights,
        };

    } catch (err) {
        const elapsed = Date.now() - startTime;
        console.error(`[Enrich][${label}] Erro (${elapsed}ms):`, err.message);
        return null;
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
        const { origem, destino, duracao, moeda } = req.body;

        // ============================================================
        // VALIDAÇÕES
        // ============================================================
        if (!origem || typeof origem !== 'string' || !/^[A-Z]{3}$/.test(origem.toUpperCase())) {
            return res.status(400).json({
                error: 'Origem inválida',
                message: 'Use código IATA de 3 letras (ex: GRU, GIG, SSA)'
            });
        }

        if (!destino || typeof destino !== 'string' || !/^[A-Z]{3}$/.test(destino.toUpperCase())) {
            return res.status(400).json({
                error: 'Destino inválido',
                message: 'Use código IATA de 3 letras (ex: LIS, MIA, CDG)'
            });
        }

        const duracaoNum = parseInt(duracao);
        if (![7, 14, 21].includes(duracaoNum)) {
            return res.status(400).json({
                error: 'Duração inválida',
                message: 'Escolha 7, 14 ou 21 dias'
            });
        }

        if (!process.env.SEARCHAPI_KEY) {
            return res.status(500).json({
                error: 'SEARCHAPI_KEY não configurada',
                message: 'Configure em Vercel → Settings → Environment Variables'
            });
        }

        const origemCode = origem.toUpperCase().trim();
        const destinoCode = destino.toUpperCase().trim();
        const currencyCode = (moeda && /^[A-Z]{3}$/.test(moeda)) ? moeda : 'BRL';

        console.log(`✈️ Cheapest Flights: ${origemCode} → ${destinoCode} | ${duracaoNum} dias | ${currencyCode}`);

        // ============================================================
        // GERAR JANELAS DE BUSCA
        // ============================================================
        const today = new Date();
        const startDate = addDays(today, 1); // Começar amanhã

        const windows = generateSearchWindows(startDate, MONTHS_AHEAD, duracaoNum);
        console.log(`📅 ${windows.length} janelas de busca geradas para ${MONTHS_AHEAD} meses`);

        // ============================================================
        // LOCALIZAÇÃO (gl/hl baseado na moeda)
        // ============================================================
        const localeMap = {
            'BRL': { gl: 'br', hl: 'pt-BR' },
            'USD': { gl: 'us', hl: 'en' },
            'EUR': { gl: 'de', hl: 'en' },
        };
        const locale = localeMap[currencyCode] || localeMap['BRL'];

        // ============================================================
        // FAZER BUSCAS EM PARALELO
        // ============================================================
        const startTime = Date.now();

        const searchPromises = windows.map((window, idx) => {
            const params = {
                flight_type: 'round_trip',
                departure_id: origemCode,
                arrival_id: destinoCode,
                currency: currencyCode,
                gl: locale.gl,
                hl: locale.hl,
                ...window,
            };

            return searchFlightsCalendar(params, `Janela ${idx + 1}/${windows.length}`);
        });

        let results;
        try {
            results = await Promise.all(searchPromises);
        } catch (err) {
            console.error('❌ Erro nas buscas paralelas:', err);
            results = searchPromises.map(() => ({ calendar: [], error: 'Falha', elapsed: 0 }));
        }

        const totalTime = Date.now() - startTime;

        // ============================================================
        // CONSOLIDAR E FILTRAR RESULTADOS
        // Só manter combinações onde return - departure = duração
        // ============================================================
        const allPrices = [];
        let totalCalendarEntries = 0;
        let validEntries = 0;
        let errorsCount = 0;

        results.forEach((result, idx) => {
            if (result.error) {
                errorsCount++;
                return;
            }

            totalCalendarEntries += result.calendar.length;

            result.calendar.forEach(entry => {
                // Pular entradas sem voo
                if (entry.has_no_flights || !entry.price) return;

                // Para round_trip, filtrar só as combinações com duração correta
                if (entry.departure && entry.return) {
                    const actualDuration = diffDays(entry.departure, entry.return);

                    // Aceitar duração exata ± 0 dias (strict)
                    if (actualDuration !== duracaoNum) return;
                }

                validEntries++;

                allPrices.push({
                    departure: entry.departure,
                    return: entry.return || null,
                    price: entry.price,
                    is_lowest: entry.is_lowest_price || false,
                });
            });
        });

        console.log(`📊 Total entries: ${totalCalendarEntries} | Valid (${duracaoNum}d): ${validEntries} | Errors: ${errorsCount}`);

        // ============================================================
        // DEDUPLICAR (mesma data de ida pode vir em janelas sobrepostas)
        // ============================================================
        const uniquePrices = new Map();
        allPrices.forEach(entry => {
            const key = `${entry.departure}_${entry.return}`;
            if (!uniquePrices.has(key) || entry.price < uniquePrices.get(key).price) {
                uniquePrices.set(key, entry);
            }
        });

        // Ordenar por preço (mais barato primeiro)
        const sorted = Array.from(uniquePrices.values()).sort((a, b) => a.price - b.price);

        // ============================================================
        // CALCULAR ESTATÍSTICAS
        // ============================================================
        let stats = null;
        if (sorted.length > 0) {
            const prices = sorted.map(e => e.price);
            const sum = prices.reduce((a, b) => a + b, 0);

            stats = {
                cheapest: sorted[0],
                mostExpensive: sorted[sorted.length - 1],
                average: Math.round(sum / prices.length),
                median: prices[Math.floor(prices.length / 2)],
                totalDates: sorted.length,
            };
        }

        // ============================================================
        // AGRUPAR POR MÊS (para o gráfico)
        // ============================================================
        const byMonth = {};
        sorted.forEach(entry => {
            const monthKey = entry.departure.substring(0, 7); // YYYY-MM
            if (!byMonth[monthKey]) {
                byMonth[monthKey] = {
                    month: monthKey,
                    cheapest: entry.price,
                    cheapestDate: entry.departure,
                    cheapestReturn: entry.return,
                    prices: [],
                };
            }
            byMonth[monthKey].prices.push(entry.price);
            if (entry.price < byMonth[monthKey].cheapest) {
                byMonth[monthKey].cheapest = entry.price;
                byMonth[monthKey].cheapestDate = entry.departure;
                byMonth[monthKey].cheapestReturn = entry.return;
            }
        });

        // Calcular média por mês
        const monthlyData = Object.values(byMonth).map(m => ({
            month: m.month,
            cheapest: m.cheapest,
            cheapestDate: m.cheapestDate,
            cheapestReturn: m.cheapestReturn,
            average: Math.round(m.prices.reduce((a, b) => a + b, 0) / m.prices.length),
            totalDates: m.prices.length,
        }));

        // ============================================================
        // ENRIQUECIMENTO: Buscar detalhes dos top N voos
        // ============================================================
        const top10 = sorted.slice(0, 10);
        const toEnrich = sorted.slice(0, ENRICH_TOP_N);

        console.log(`🔍 Enriquecendo top ${toEnrich.length} com detalhes de voo...`);

        const enrichStartTime = Date.now();
        const enrichPromises = toEnrich.map((entry, idx) =>
            enrichFlightDetails(
                origemCode,
                destinoCode,
                entry.departure,
                entry.return,
                currencyCode,
                locale,
                `#${idx + 1} ${entry.departure}`
            )
        );

        let enrichResults;
        try {
            enrichResults = await Promise.all(enrichPromises);
        } catch (err) {
            console.error('⚠️ Erro no enriquecimento:', err.message);
            enrichResults = toEnrich.map(() => null);
        }

        const enrichTime = Date.now() - enrichStartTime;
        console.log(`🔍 Enriquecimento completo em ${enrichTime}ms`);

        // Merge detalhes nos top entries
        toEnrich.forEach((entry, idx) => {
            const details = enrichResults[idx];
            if (details) {
                entry.flight_details = details;
            }
        });

        // Se o cheapest foi enriquecido, atualizar stats
        if (sorted[0].flight_details) {
            stats.cheapest = sorted[0];
        }

        // ============================================================
        // RESPOSTA
        // ============================================================
        if (sorted.length === 0) {
            return res.status(404).json({
                error: 'Nenhum voo encontrado',
                message: `Não foram encontrados voos de ${origemCode} para ${destinoCode} com ${duracaoNum} dias nos próximos ${MONTHS_AHEAD} meses.`,
                _debug: {
                    windows: windows.length,
                    totalCalendarEntries,
                    errorsCount,
                    totalTime,
                }
            });
        }

        console.log(`✅ Cheapest Flights completo em ${totalTime + enrichTime}ms | ${sorted.length} datas válidas | Mais barato: ${stats.cheapest.price} ${currencyCode}`);

        return res.status(200).json({
            success: true,
            origem: origemCode,
            destino: destinoCode,
            duracao: duracaoNum,
            moeda: currencyCode,
            stats,
            monthlyData,
            prices: sorted, // Todas as datas ordenadas por preço
            top10,           // Top 10 (top N enriquecidas com detalhes)
            _meta: {
                totalTime: totalTime + enrichTime,
                calendarTime: totalTime,
                enrichTime,
                enrichedCount: enrichResults.filter(r => r !== null).length,
                windows: windows.length,
                totalCalendarEntries,
                validEntries,
                errorsCount,
                monthsSearched: MONTHS_AHEAD,
            }
        });

    } catch (error) {
        console.error('❌ Erro geral:', error);
        return res.status(500).json({
            error: 'Erro ao buscar voos',
            message: error.message,
        });
    }
}
