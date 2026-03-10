// api/compare-flights.js - BENETRIP COMPARAR VOOS v2.1
// v2.1: cheaper_alternatives, fare_type, baggage_allowance_links (SearchAPI update)
// Suporte a adultos, crianças (2-11) e bebês (0-2)

export const maxDuration = 60;

const MAX_IDAS = 4;
const MAX_VOLTAS = 4;
const MAX_PAX_TOTAL = 9;
const BATCH_SIZE = 4;

async function searchFlights(params, label) {
    const url = new URL('https://www.searchapi.io/api/v1/search');

    const fullParams = {
        engine: 'google_flights',
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
            console.error(`[Flights][${label}] HTTP ${response.status} (${elapsed}ms):`, errorText.substring(0, 300));
            return { flights: [], error: `HTTP ${response.status}`, elapsed };
        }

        const data = await response.json();
        const bestFlights = data.best_flights || [];
        const otherFlights = data.other_flights || [];
        const allFlights = [...bestFlights, ...otherFlights];
        const priceInsights = data.price_insights || null;

        // v2.1: capturar cheaper_alternatives retornadas pela API
        const cheaperAlternatives = data.cheaper_alternatives || [];

        console.log(`[Flights][${label}] ${allFlights.length} voos (${bestFlights.length} best + ${otherFlights.length} other) | ${cheaperAlternatives.length} alternativas mais baratas (${elapsed}ms)`);

        return { flights: allFlights, priceInsights, cheaperAlternatives, error: null, elapsed, isBest: bestFlights.length };
    } catch (err) {
        const elapsed = Date.now() - startTime;
        console.error(`[Flights][${label}] Erro (${elapsed}ms):`, err.message);
        return { flights: [], error: err.message, elapsed };
    }
}

function extractFlightDetails(flight, isBestFlight) {
    const legs = flight.flights || [];
    const layovers = flight.layovers || [];

    const airlines = new Map();
    legs.forEach(leg => {
        if (leg.airline) airlines.set(leg.airline, { name: leg.airline, logo: leg.airline_logo || '' });
    });

    const flightLegs = legs.map(leg => ({
        departure_airport: {
            id: leg.departure_airport?.id || '',
            name: leg.departure_airport?.name || '',
            time: leg.departure_airport?.time || '',
        },
        arrival_airport: {
            id: leg.arrival_airport?.id || '',
            name: leg.arrival_airport?.name || '',
            time: leg.arrival_airport?.time || '',
        },
        airline: leg.airline || '',
        airline_logo: leg.airline_logo || '',
        flight_number: leg.flight_number || '',
        duration: leg.duration || 0,
        airplane: leg.airplane || '',
        travel_class: leg.travel_class || 'Economy',
        legroom: leg.legroom || '',
        extensions: leg.extensions || [],
        often_delayed_by_over_30_min: leg.often_delayed_by_over_30_min || false,
    }));

    const layoverDetails = layovers.map(l => ({
        airport: l.name || '',
        airport_id: l.id || '',
        duration: l.duration || 0,
        overnight: l.overnight || false,
    }));

    return {
        price: flight.price || 0,
        total_duration: flight.total_duration || 0,
        stops: layovers.length,
        airlines: Array.from(airlines.values()),
        legs: flightLegs,
        layovers: layoverDetails,
        is_best: isBestFlight,
        carbon_emissions: flight.carbon_emissions?.this_flight
            ? Math.round(flight.carbon_emissions.this_flight / 1000)
            : null,
        booking_token: flight.booking_token || null,
        type: flight.type || 'round_trip',
        extensions: flight.extensions || [],
        // v2.1: novos campos da SearchAPI
        fare_type: flight.fare_type || null,
        baggage_allowance_links: flight.baggage_allowance_links || null,
    };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    try {
        const { origem, destino, datasIda, datasVolta, moeda, adultos, criancas, bebes } = req.body;

        if (!origem || !/^[A-Z]{3}$/i.test(origem))
            return res.status(400).json({ error: 'Origem inválida (IATA 3 letras)' });
        if (!destino || !/^[A-Z]{3}$/i.test(destino))
            return res.status(400).json({ error: 'Destino inválido (IATA 3 letras)' });
        if (!Array.isArray(datasIda) || datasIda.length === 0 || datasIda.length > MAX_IDAS)
            return res.status(400).json({ error: `Informe 1 a ${MAX_IDAS} datas de ida` });
        if (!Array.isArray(datasVolta) || datasVolta.length === 0 || datasVolta.length > MAX_VOLTAS)
            return res.status(400).json({ error: `Informe 1 a ${MAX_VOLTAS} datas de volta` });

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        for (const d of [...datasIda, ...datasVolta]) {
            if (!dateRegex.test(d))
                return res.status(400).json({ error: `Data inválida: ${d} (use YYYY-MM-DD)` });
        }

        if (!process.env.SEARCHAPI_KEY)
            return res.status(500).json({ error: 'SEARCHAPI_KEY não configurada' });

        const origemCode = origem.toUpperCase().trim();
        const destinoCode = destino.toUpperCase().trim();
        const currencyCode = (moeda && /^[A-Z]{3}$/.test(moeda)) ? moeda : 'BRL';

        // ── Passageiros ──────────────────────────────────────────────
        const numAdultos = Math.min(Math.max(parseInt(adultos) || 1, 1), MAX_PAX_TOTAL);
        const numCriancas = Math.min(Math.max(parseInt(criancas) || 0, 0), MAX_PAX_TOTAL);
        const numBebes = Math.min(Math.max(parseInt(bebes) || 0, 0), 4);

        const totalPagantes = Math.min(numAdultos + numCriancas, MAX_PAX_TOTAL);
        const adultosFinal = Math.min(numAdultos, MAX_PAX_TOTAL);
        const criancasFinal = Math.max(0, totalPagantes - adultosFinal);
        const paxParaPreco = adultosFinal + criancasFinal;

        const combinacoes = [];
        for (const ida of datasIda)
            for (const volta of datasVolta)
                if (volta > ida) combinacoes.push({ dataIda: ida, dataVolta: volta });

        if (combinacoes.length === 0)
            return res.status(400).json({
                error: 'Nenhuma combinação válida',
                message: 'As datas de volta devem ser posteriores às de ida',
            });

        console.log(`✈️ Compare Flights v2.1: ${origemCode}→${destinoCode} | ${combinacoes.length} combos | ${adultosFinal}A/${criancasFinal}C/${numBebes}B | ${currencyCode}`);

        const localeMap = {
            'BRL': { gl: 'br', hl: 'pt-BR' },
            'USD': { gl: 'us', hl: 'en' },
            'EUR': { gl: 'de', hl: 'en' },
        };
        const locale = localeMap[currencyCode] || localeMap['BRL'];

        const startTime = Date.now();
        const allResults = [];

        for (let i = 0; i < combinacoes.length; i += BATCH_SIZE) {
            const batch = combinacoes.slice(i, i + BATCH_SIZE);

            const promises = batch.map((combo, idx) => {
                const label = `${combo.dataIda}→${combo.dataVolta} (#${i + idx + 1})`;
                const params = {
                    departure_id: origemCode,
                    arrival_id: destinoCode,
                    outbound_date: combo.dataIda,
                    return_date: combo.dataVolta,
                    flight_type: 'round_trip',
                    currency: currencyCode,
                    gl: locale.gl,
                    hl: locale.hl,
                    adults: String(adultosFinal),
                };
                if (criancasFinal > 0) params.children = String(criancasFinal);
                if (numBebes > 0) params.infants_on_lap = String(numBebes);

                return searchFlights(params, label).then(result => ({ combo, ...result }));
            });

            const batchResults = await Promise.all(promises);
            allResults.push(...batchResults);
        }

        const totalTime = Date.now() - startTime;

        const combinacoesResult = [];
        const todasCompanhias = new Map();
        let globalCheapest = Infinity;
        let globalCheapestCombo = null;

        // v2.1: acumular cheaper_alternatives de todas as buscas
        const searchedKeys = new Set(combinacoes.map(c => `${c.dataIda}_${c.dataVolta}`));
        const rawCheaperAlts = new Map(); // key -> {departure, return, price}

        for (const result of allResults) {
            const { combo, flights, priceInsights, cheaperAlternatives, error, elapsed } = result;
            const d1 = new Date(combo.dataIda + 'T00:00:00Z');
            const d2 = new Date(combo.dataVolta + 'T00:00:00Z');
            const noites = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));

            // v2.1: coletar alternativas mais baratas retornadas pela API para essa busca
            if (cheaperAlternatives && cheaperAlternatives.length > 0) {
                cheaperAlternatives.forEach(alt => {
                    if (!alt.departure_date || !alt.return_date || !alt.price) return;
                    const altKey = `${alt.departure_date}_${alt.return_date}`;
                    // Ignorar datas que já foram pesquisadas
                    if (searchedKeys.has(altKey)) return;
                    if (!rawCheaperAlts.has(altKey) || alt.price < rawCheaperAlts.get(altKey).price) {
                        rawCheaperAlts.set(altKey, {
                            departure: alt.departure_date,
                            return: alt.return_date,
                            price: alt.price,
                        });
                    }
                });
            }

            if (error || !flights.length) {
                combinacoesResult.push({ dataIda: combo.dataIda, dataVolta: combo.dataVolta, noites, voos: [], melhorPreco: null, priceInsights: null, error: error || 'Sem voos', elapsed });
                continue;
            }

            const voosDetalhados = flights.map((f, idx) => {
                const details = extractFlightDetails(f, idx < result.isBest);
                details.airlines.forEach(a => { if (!todasCompanhias.has(a.name)) todasCompanhias.set(a.name, a); });
                return details;
            });

            voosDetalhados.sort((a, b) => a.price - b.price);
            const melhorPreco = voosDetalhados[0]?.price || null;

            if (melhorPreco && melhorPreco < globalCheapest) {
                globalCheapest = melhorPreco;
                globalCheapestCombo = combo;
            }

            combinacoesResult.push({
                dataIda: combo.dataIda,
                dataVolta: combo.dataVolta,
                noites,
                voos: voosDetalhados,
                melhorPreco,
                totalVoos: voosDetalhados.length,
                priceInsights,
                error: null,
                elapsed,
            });
        }

        // v2.1: filtrar e ordenar alternativas — só manter as mais baratas que o globalCheapest
        const cheaperAlternativesFinal = Array.from(rawCheaperAlts.values())
            .filter(alt => alt.price < globalCheapest)
            .sort((a, b) => a.price - b.price)
            .slice(0, 5);

        if (cheaperAlternativesFinal.length > 0) {
            console.log(`💡 ${cheaperAlternativesFinal.length} alternativas mais baratas encontradas | Mais barata: ${cheaperAlternativesFinal[0].price} ${currencyCode} (${cheaperAlternativesFinal[0].departure}→${cheaperAlternativesFinal[0].return})`);
        }

        const matrizPrecos = {};
        combinacoesResult.forEach(c => {
            matrizPrecos[`${c.dataIda}_${c.dataVolta}`] = {
                dataIda: c.dataIda, dataVolta: c.dataVolta, noites: c.noites,
                melhorPreco: c.melhorPreco, totalVoos: c.totalVoos || 0, error: c.error,
            };
        });

        const precosValidos = combinacoesResult.filter(c => c.melhorPreco).map(c => c.melhorPreco);

        if (!precosValidos.length) {
            return res.status(404).json({
                error: 'Nenhum voo encontrado',
                message: `Não foram encontrados voos de ${origemCode} para ${destinoCode} nas datas selecionadas.`,
                combinacoesTestadas: combinacoes.length,
            });
        }

        const sum = precosValidos.reduce((a, b) => a + b, 0);
        const stats = {
            cheapest: globalCheapest,
            cheapestCombo: globalCheapestCombo,
            average: Math.round(sum / precosValidos.length),
            mostExpensive: Math.max(...precosValidos),
            totalCombinacoes: combinacoes.length,
            combinacoesComVoo: precosValidos.length,
            combinacoesSemVoo: combinacoes.length - precosValidos.length,
        };

        console.log(`✅ Completo em ${totalTime}ms | Mais barato: ${globalCheapest} ${currencyCode} | Pax: ${adultosFinal}A/${criancasFinal}C/${numBebes}B | Alternativas: ${cheaperAlternativesFinal.length}`);

        return res.status(200).json({
            success: true,
            origem: origemCode,
            destino: destinoCode,
            moeda: currencyCode,
            adultos: adultosFinal,
            criancas: criancasFinal,
            bebes: numBebes,
            paxParaPreco,
            datasIda,
            datasVolta,
            stats,
            matrizPrecos,
            combinacoes: combinacoesResult,
            companhias: Array.from(todasCompanhias.values()),
            // v2.1: alternativas mais baratas fora das datas pesquisadas
            cheaperAlternatives: cheaperAlternativesFinal,
            _meta: { totalTime, totalCombinacoes: combinacoes.length, batchSize: BATCH_SIZE },
        });

    } catch (error) {
        console.error('❌ Erro geral:', error);
        return res.status(500).json({ error: 'Erro ao comparar voos', message: error.message });
    }
}
