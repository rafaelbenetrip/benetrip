// api/compare-flights.js - BENETRIP COMPARAR VOOS v2.0
// Compara voos para destino específico em múltiplas combinações de datas
// Suporta adultos, crianças e bebês 
// Traduz ALL extensions EN→PT robusto
// Sanitiza priceInsights rigoroso
// Extrai horários de partida para filtros frontend

export const maxDuration = 60;

const MAX_IDAS = 4;
const MAX_VOLTAS = 4;
const BATCH_SIZE = 4;

// ============================================================
// TRADUÇÃO de extensions EN → PT (abrangente)
// ============================================================
const TRADUCOES_EXT = {
    'Free change, possible fare difference': 'Alteração gratuita, possível diferença tarifária',
    'Full refund for cancellations': 'Reembolso total em cancelamentos',
    'Checked baggage not included in price': 'Bagagem despachada não incluída no preço',
    'Bag and fare conditions depend on the return flight': 'Condições de bagagem dependem do voo de volta',
    'Checked baggage for a fee': 'Bagagem despachada paga',
    'No checked baggage included': 'Sem bagagem despachada incluída',
    'Free checked baggage': 'Bagagem despachada gratuita',
    'Carry-on bag included': 'Bagagem de mão incluída',
    'No carry-on bag': 'Sem bagagem de mão',
    'Personal item only': 'Apenas item pessoal',
    '1 checked bag included': '1 bagagem despachada incluída',
    '2 checked bags included': '2 bagagens despachadas incluídas',
    'First checked bag free': 'Primeira bagagem despachada gratuita',
    'No bags included': 'Sem bagagem incluída',
    'No change fee': 'Sem taxa de alteração',
    'Change for a fee': 'Alteração com taxa',
    'Non-refundable': 'Não reembolsável',
    'Partial refund': 'Reembolso parcial',
    'No refund': 'Sem reembolso',
    'Refundable': 'Reembolsável',
    'Refundable ticket': 'Passagem reembolsável',
    'Cancellation for a fee': 'Cancelamento com taxa',
    'Free cancellation': 'Cancelamento gratuito',
    'No cancellation': 'Sem cancelamento',
    'Possible fare difference': 'Possível diferença tarifária',
    'Wi-Fi available': 'Wi-Fi disponível',
    'In-seat power outlet': 'Tomada no assento',
    'In-seat USB outlet': 'USB no assento',
    'Personal device entertainment': 'Entretenimento no dispositivo pessoal',
    'Seatback screen': 'Tela no encosto',
    'Live TV': 'TV ao vivo',
    'On-demand video': 'Vídeo sob demanda',
    'Streaming entertainment': 'Entretenimento via streaming',
    'Power & USB outlets': 'Tomada e USB',
    'Economy': 'Econômica',
    'Premium Economy': 'Premium Economy',
    'Business': 'Executiva',
    'First': 'Primeira Classe',
    'Basic Economy': 'Econômica Básica',
    'Standard seat': 'Assento padrão',
    'Extra legroom': 'Espaço extra para pernas',
    'Average legroom': 'Espaço médio para pernas',
    'Below average legroom': 'Espaço abaixo da média',
    'Above average legroom': 'Espaço acima da média',
    'Often delayed by 30+ min': 'Frequentemente atrasado 30+ min',
    'Often delayed': 'Frequentemente atrasado',
    'Carbon emissions estimate': 'Estimativa de emissão de carbono',
    'Lower emissions': 'Menores emissões',
    'Higher emissions': 'Maiores emissões',
    'Average emissions': 'Emissões médias',
    'Overnight flight': 'Voo noturno',
    'Red-eye flight': 'Voo madrugada',
    'Self transfer': 'Conexão por conta própria',
    'Multi-airline itinerary': 'Itinerário com múltiplas companhias',
};

const TRADUCOES_PARCIAIS = [
    { en: 'Operated by', pt: 'Operado por' },
    { en: 'Ticket also valid on', pt: 'Passagem válida também em' },
    { en: 'checked bag', pt: 'bagagem despachada' },
    { en: 'carry-on', pt: 'bagagem de mão' },
    { en: 'personal item', pt: 'item pessoal' },
    { en: 'change fee', pt: 'taxa de alteração' },
    { en: 'cancellation', pt: 'cancelamento' },
    { en: 'refund', pt: 'reembolso' },
    { en: 'baggage', pt: 'bagagem' },
    { en: 'luggage', pt: 'bagagem' },
    { en: 'legroom', pt: 'espaço para pernas' },
    { en: 'in-seat', pt: 'no assento' },
    { en: 'Wi-Fi', pt: 'Wi-Fi' },
    { en: 'entertainment', pt: 'entretenimento' },
    { en: 'delayed', pt: 'atrasado' },
    { en: 'overnight', pt: 'pernoite' },
    { en: 'emissions', pt: 'emissões' },
    { en: 'not included', pt: 'não incluído' },
    { en: 'included', pt: 'incluído' },
    { en: 'for a fee', pt: 'pago' },
];

function traduzirExt(ext) {
    if (!ext || typeof ext !== 'string') return '';
    if (TRADUCOES_EXT[ext]) return TRADUCOES_EXT[ext];
    const extLower = ext.toLowerCase();
    for (const [en, pt] of Object.entries(TRADUCOES_EXT)) {
        if (en.toLowerCase() === extLower) return pt;
    }
    let resultado = ext;
    let traduzido = false;
    for (const { en, pt } of TRADUCOES_PARCIAIS) {
        if (resultado.toLowerCase().includes(en.toLowerCase())) {
            resultado = resultado.replace(new RegExp(en, 'gi'), pt);
            traduzido = true;
        }
    }
    if (traduzido) return resultado;
    return ext;
}

function extractHour(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) return parseInt(match[1]);
    return null;
}

// ============================================================
// BUSCA INDIVIDUAL
// ============================================================
async function searchFlights(params, label) {
    const url = new URL('https://www.searchapi.io/api/v1/search');
    const fullParams = { engine: 'google_flights', api_key: process.env.SEARCHAPI_KEY, ...params };
    Object.entries(fullParams).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, String(v)); });

    const t0 = Date.now();
    try {
        const resp = await fetch(url.toString(), { method: 'GET', headers: { 'Accept': 'application/json' } });
        const elapsed = Date.now() - t0;
        if (!resp.ok) { console.error(`[${label}] HTTP ${resp.status}`); return { flights: [], error: `HTTP ${resp.status}`, elapsed }; }
        const data = await resp.json();
        const best = data.best_flights || [];
        const other = data.other_flights || [];
        console.log(`[${label}] ${best.length + other.length} voos (${elapsed}ms)`);
        return { flights: [...best, ...other], priceInsights: data.price_insights || null, airports: data.airports || null, error: null, elapsed, isBest: best.length };
    } catch (err) {
        return { flights: [], error: err.message, elapsed: Date.now() - t0 };
    }
}

// ============================================================
// EXTRAIR DETALHES
// ============================================================
function extractFlight(flight, isBestFlight, origemCode, destinoCode) {
    const legs = flight.flights || [];
    const layovers = flight.layovers || [];

    const airlines = new Map();
    legs.forEach(l => { if (l.airline) airlines.set(l.airline, { name: l.airline, logo: l.airline_logo || '' }); });

    const flightLegs = legs.map(l => ({
        departure_airport: { id: l.departure_airport?.id || '', name: l.departure_airport?.name || '', time: l.departure_airport?.time || '' },
        arrival_airport: { id: l.arrival_airport?.id || '', name: l.arrival_airport?.name || '', time: l.arrival_airport?.time || '' },
        airline: l.airline || '', airline_logo: l.airline_logo || '', flight_number: l.flight_number || '',
        duration: l.duration || 0, airplane: l.airplane || '', travel_class: traduzirExt(l.travel_class || 'Economy'),
        legroom: l.legroom || '', extensions: (l.extensions || []).map(traduzirExt).filter(Boolean),
        often_delayed_by_over_30_min: l.often_delayed_by_over_30_min || false,
    }));

    const layoverDetails = layovers.map(l => ({
        airport: l.name || '', airport_id: l.id || '', duration: l.duration || 0, overnight: l.overnight || false,
    }));

    // Extrair horários para filtros de horário de ida e volta
    let departureHourIda = null;
    let departureHourVolta = null;

    if (flightLegs.length > 0) {
        departureHourIda = extractHour(flightLegs[0].departure_airport.time);
    }

    // Detectar onde começa a volta: leg que parte do destino
    for (let i = 0; i < flightLegs.length; i++) {
        const depId = flightLegs[i].departure_airport.id;
        if (depId === destinoCode && i > 0) {
            departureHourVolta = extractHour(flightLegs[i].departure_airport.time);
            break;
        }
        // Fallback: se o leg anterior chega no destino
        if (i > 0 && flightLegs[i - 1].arrival_airport.id === destinoCode) {
            departureHourVolta = extractHour(flightLegs[i].departure_airport.time);
            break;
        }
    }

    return {
        price: flight.price || 0,
        total_duration: flight.total_duration || 0,
        stops: layovers.length,
        airlines: Array.from(airlines.values()),
        legs: flightLegs, layovers: layoverDetails,
        is_best: isBestFlight,
        carbon_emissions: flight.carbon_emissions?.this_flight ? Math.round(flight.carbon_emissions.this_flight / 1000) : null,
        extensions: (flight.extensions || []).map(traduzirExt).filter(Boolean),
        departureHourIda,
        departureHourVolta,
    };
}

// ============================================================
// HANDLER
// ============================================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    try {
        const { origem, destino, datasIda, datasVolta, moeda, adultos, criancas, bebes } = req.body;

        if (!origem || !/^[A-Z]{3}$/i.test(origem)) return res.status(400).json({ error: 'Origem inválida' });
        if (!destino || !/^[A-Z]{3}$/i.test(destino)) return res.status(400).json({ error: 'Destino inválido' });
        if (!Array.isArray(datasIda) || !datasIda.length || datasIda.length > MAX_IDAS) return res.status(400).json({ error: `Informe 1 a ${MAX_IDAS} datas de ida` });
        if (!Array.isArray(datasVolta) || !datasVolta.length || datasVolta.length > MAX_VOLTAS) return res.status(400).json({ error: `Informe 1 a ${MAX_VOLTAS} datas de volta` });

        for (const d of [...datasIda, ...datasVolta]) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return res.status(400).json({ error: `Data inválida: ${d}` }); }
        if (!process.env.SEARCHAPI_KEY) return res.status(500).json({ error: 'SEARCHAPI_KEY não configurada' });

        const origemCode = origem.toUpperCase().trim();
        const destinoCode = destino.toUpperCase().trim();
        const currencyCode = (moeda && /^[A-Z]{3}$/.test(moeda)) ? moeda : 'BRL';

        const numAdultos = Math.min(Math.max(parseInt(adultos) || 1, 1), 9);
        const numCriancas = Math.min(Math.max(parseInt(criancas) || 0, 0), 8);
        const numBebes = Math.min(Math.max(parseInt(bebes) || 0, 0), numAdultos);
        const passageirosPagantes = numAdultos + numCriancas;

        const combinacoes = [];
        for (const ida of datasIda) for (const volta of datasVolta) if (volta > ida) combinacoes.push({ dataIda: ida, dataVolta: volta });
        if (!combinacoes.length) return res.status(400).json({ error: 'Datas de volta devem ser posteriores às de ida' });

        console.log(`✈️ ${origemCode}→${destinoCode} | ${combinacoes.length} combos | ${numAdultos}A ${numCriancas}C ${numBebes}B | ${currencyCode}`);

        const locale = { BRL: { gl: 'br', hl: 'pt-BR' }, USD: { gl: 'us', hl: 'en' }, EUR: { gl: 'de', hl: 'en' } }[currencyCode] || { gl: 'br', hl: 'pt-BR' };

        const t0 = Date.now();
        const allResults = [];

        for (let i = 0; i < combinacoes.length; i += BATCH_SIZE) {
            const batch = combinacoes.slice(i, i + BATCH_SIZE);
            const promises = batch.map((combo) => {
                const params = {
                    departure_id: origemCode, arrival_id: destinoCode,
                    outbound_date: combo.dataIda, return_date: combo.dataVolta,
                    flight_type: 'round_trip', currency: currencyCode, gl: locale.gl, hl: locale.hl,
                    adults: String(numAdultos),
                };
                if (numCriancas > 0) params.children = String(numCriancas);
                if (numBebes > 0) params.infants_on_lap = String(numBebes);
                return searchFlights(params, `${combo.dataIda}→${combo.dataVolta}`).then(r => ({ combo, ...r }));
            });
            allResults.push(...(await Promise.all(promises)));
        }

        const totalTime = Date.now() - t0;
        const combinacoesResult = [];
        const todasCompanhias = new Map();
        const aeroportosOrigem = new Set();
        const aeroportosDestino = new Set();
        let globalCheapest = Infinity, globalCheapestCombo = null;

        for (const result of allResults) {
            const { combo, flights, priceInsights, error, elapsed } = result;
            const noites = Math.round((new Date(combo.dataVolta + 'T00:00:00Z') - new Date(combo.dataIda + 'T00:00:00Z')) / 86400000);

            if (error || !flights.length) {
                combinacoesResult.push({ dataIda: combo.dataIda, dataVolta: combo.dataVolta, noites, voos: [], melhorPreco: null, melhorPrecoPP: null, priceInsights: null, error: error || 'Sem voos', elapsed });
                continue;
            }

            const voosDetalhados = flights.map((f, idx) => {
                const d = extractFlight(f, idx < result.isBest, origemCode, destinoCode);
                d.airlines.forEach(a => { if (!todasCompanhias.has(a.name)) todasCompanhias.set(a.name, a); });
                if (d.legs.length > 0) {
                    aeroportosOrigem.add(d.legs[0].departure_airport.id);
                    d.legs.forEach(l => {
                        aeroportosDestino.add(l.arrival_airport.id);
                        aeroportosOrigem.add(l.departure_airport.id);
                    });
                }
                d.pricePP = passageirosPagantes > 0 ? Math.round(d.price / passageirosPagantes) : d.price;
                d.priceTotal = d.price;
                return d;
            });
            voosDetalhados.sort((a, b) => a.price - b.price);

            const melhorPreco = voosDetalhados[0]?.price || null;
            const melhorPrecoPP = voosDetalhados[0]?.pricePP || null;
            if (melhorPreco && melhorPreco < globalCheapest) { globalCheapest = melhorPreco; globalCheapestCombo = combo; }

            // Sanitizar priceInsights de forma rigorosa
            let sanePI = null;
            if (priceInsights && typeof priceInsights === 'object') {
                sanePI = {};
                if (typeof priceInsights.lowest_price === 'number' && priceInsights.lowest_price > 0) {
                    sanePI.lowest_price = priceInsights.lowest_price;
                }
                if (priceInsights.price_level && typeof priceInsights.price_level === 'string') {
                    sanePI.price_level = priceInsights.price_level;
                }
                if (Array.isArray(priceInsights.typical_price_range) && priceInsights.typical_price_range.length >= 2) {
                    const lo = priceInsights.typical_price_range[0];
                    const hi = priceInsights.typical_price_range[1];
                    if (typeof lo === 'number' && typeof hi === 'number' && lo > 0 && hi > 0 && hi >= lo) {
                        sanePI.typical_price_range = [lo, hi];
                    }
                }
                if (Object.keys(sanePI).length === 0) sanePI = null;
            }

            combinacoesResult.push({
                dataIda: combo.dataIda, dataVolta: combo.dataVolta, noites,
                voos: voosDetalhados, melhorPreco, melhorPrecoPP,
                totalVoos: voosDetalhados.length, priceInsights: sanePI,
                error: null, elapsed
            });
        }

        const matrizPrecos = {};
        combinacoesResult.forEach(c => {
            matrizPrecos[`${c.dataIda}_${c.dataVolta}`] = {
                dataIda: c.dataIda, dataVolta: c.dataVolta, noites: c.noites,
                melhorPreco: c.melhorPreco, melhorPrecoPP: c.melhorPrecoPP,
                totalVoos: c.totalVoos || 0, error: c.error
            };
        });

        const precosValidos = combinacoesResult.filter(c => c.melhorPreco).map(c => c.melhorPreco);
        if (!precosValidos.length) return res.status(404).json({ error: 'Nenhum voo encontrado', message: `Sem voos ${origemCode}→${destinoCode}` });

        const sum = precosValidos.reduce((a, b) => a + b, 0);
        const stats = {
            cheapest: globalCheapest,
            cheapestPP: passageirosPagantes > 0 ? Math.round(globalCheapest / passageirosPagantes) : globalCheapest,
            cheapestCombo: globalCheapestCombo,
            average: Math.round(sum / precosValidos.length),
            averagePP: passageirosPagantes > 0 ? Math.round(sum / precosValidos.length / passageirosPagantes) : Math.round(sum / precosValidos.length),
            mostExpensive: Math.max(...precosValidos),
            mostExpensivePP: passageirosPagantes > 0 ? Math.round(Math.max(...precosValidos) / passageirosPagantes) : Math.max(...precosValidos),
            totalCombinacoes: combinacoes.length,
            combinacoesComVoo: precosValidos.length,
        };

        return res.status(200).json({
            success: true, origem: origemCode, destino: destinoCode, moeda: currencyCode,
            passageiros: { adultos: numAdultos, criancas: numCriancas, bebes: numBebes, passageirosPagantes },
            datasIda, datasVolta, stats, matrizPrecos,
            combinacoes: combinacoesResult,
            companhias: Array.from(todasCompanhias.values()),
            aeroportosOrigem: Array.from(aeroportosOrigem),
            aeroportosDestino: Array.from(aeroportosDestino),
            _meta: { totalTime, totalCombinacoes: combinacoes.length },
        });

    } catch (error) {
        console.error('❌', error);
        return res.status(500).json({ error: 'Erro ao comparar voos', message: error.message });
    }
}
