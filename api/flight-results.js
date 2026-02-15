// api/flight-results.js - Benetrip Flight Results v2.0
// Polling endpoint para buscar resultados de voos
// Converte preços de RUB para moeda selecionada via currency_rates
// CommonJS (compatível com Vercel)

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uuid, currency = 'BRL' } = req.query;

  if (!uuid) {
    return res.status(400).json({ error: 'Parâmetro uuid obrigatório' });
  }

  try {
    const url = `https://api.travelpayouts.com/v1/flight_search_results?uuid=${uuid}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept-Encoding': 'gzip,deflate',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `API retornou ${response.status}`,
        search_id: uuid
      });
    }

    const rawData = await response.json();

    // A API retorna um array. O último elemento pode ter apenas search_id
    // (indicando que a busca terminou)
    if (!Array.isArray(rawData)) {
      return res.status(200).json({
        search_id: uuid,
        completed: false,
        proposals: [],
        total: 0,
        message: 'Aguardando resultados...'
      });
    }

    // Processar chunks
    let allProposals = [];
    let currencyRates = {};
    let gatesInfo = {};
    let airlines = {};
    let flightInfo = {};
    let searchComplete = false;
    let segments = [];

    for (const chunk of rawData) {
      if (!chunk || typeof chunk !== 'object') continue;

      // Chunk com apenas search_id = busca completa
      if (chunk.search_id && Object.keys(chunk).length <= 2) {
        searchComplete = true;
        continue;
      }

      // Extrair dados de referência
      if (chunk.currency_rates) {
        currencyRates = { ...currencyRates, ...chunk.currency_rates };
      }
      if (chunk.gates_info) {
        gatesInfo = { ...gatesInfo, ...chunk.gates_info };
      }
      if (chunk.airlines) {
        Object.assign(airlines, chunk.airlines);
      }
      if (chunk.flight_info) {
        Object.assign(flightInfo, chunk.flight_info);
      }
      if (chunk.segments && chunk.segments.length > 0) {
        segments = chunk.segments;
      }
      if (chunk.proposals && Array.isArray(chunk.proposals)) {
        allProposals = allProposals.concat(chunk.proposals);
      }
    }

    // ============================================================
    // CONVERTER PREÇOS para a moeda desejada
    // Preços vêm em RUB. currency_rates contém: 1 RUB = X moeda
    // ATENÇÃO: a API retorna rates como DIVISOR (RUB / rate = moeda)
    // Exemplo: se rate BRL = 18.5, então 1850 RUB / 18.5 = 100 BRL
    // Mas na verdade, a API diz "para converter de RUB para BRL,
    // multiplique por currency_rates.brl"
    // Vamos testar ambas as abordagens e usar a que faz sentido
    // ============================================================
    const targetCurrency = currency.toLowerCase();
    const rate = currencyRates[targetCurrency] || currencyRates['brl'] || 1;

    // Formatar proposals
    const formattedProposals = allProposals.map((proposal, idx) => {
      try {
        return formatProposal(proposal, rate, targetCurrency, gatesInfo, airlines, idx);
      } catch (e) {
        console.warn(`⚠️ Erro formatando proposal ${idx}:`, e.message);
        return null;
      }
    }).filter(Boolean);

    // Ordenar por preço (menor primeiro)
    formattedProposals.sort((a, b) => a.price - b.price);

    // Deduplicar
    const deduped = deduplicateProposals(formattedProposals);

    console.log(`📋 [FlightResults] uuid=${uuid.substring(0, 8)}... | ${allProposals.length} raw → ${deduped.length} unique | complete=${searchComplete} | rate(${targetCurrency})=${rate}`);

    return res.status(200).json({
      search_id: uuid,
      completed: searchComplete,
      currency: currency.toUpperCase(),
      currency_rate: rate,
      total_raw: allProposals.length,
      total: deduped.length,
      proposals: deduped,
      gates_info: gatesInfo,
      airlines_info: airlines,
      segments,
      flight_info: flightInfo
    });

  } catch (error) {
    console.error('❌ [FlightResults] Erro:', error.message);
    return res.status(500).json({
      error: 'Erro ao buscar resultados',
      message: error.message,
      search_id: uuid
    });
  }
};

// ============================================================
// FORMATAR PROPOSAL
// ============================================================
function formatProposal(proposal, rate, currency, gatesInfo, airlines, index) {
  // Encontrar o melhor preço (menor) entre todos os terms/gates
  let bestPrice = Infinity;
  let bestGateId = null;
  let bestTermsUrl = null;

  if (proposal.terms) {
    for (const [gateId, termData] of Object.entries(proposal.terms)) {
      const priceRub = termData.unified_price || termData.price || Infinity;
      if (priceRub < bestPrice) {
        bestPrice = priceRub;
        bestGateId = gateId;
        bestTermsUrl = termData.url;
      }
    }
  }

  // Converter de RUB para moeda desejada
  // A API retorna rates como multiplicadores: preço_RUB * rate = preço_moeda
  const convertedPrice = bestPrice * rate;

  // Extrair informações dos segmentos (ida e volta)
  const segmentsData = (proposal.segment || []).map((seg, segIdx) => {
    const flights = (seg.flight || []).map(flight => ({
      airline: flight.marketing_carrier || flight.operating_carrier || '',
      airline_name: airlines[flight.marketing_carrier]?.name || flight.marketing_carrier || '',
      flight_number: `${flight.marketing_carrier || ''}${flight.number || ''}`,
      departure_airport: flight.departure,
      arrival_airport: flight.arrival,
      departure_date: flight.departure_date,
      departure_time: flight.departure_time,
      arrival_date: flight.arrival_date,
      arrival_time: flight.arrival_time,
      duration: flight.duration,
      aircraft: flight.aircraft || '',
      delay: flight.delay || 0,
      operating_carrier: flight.operating_carrier || flight.marketing_carrier || '',
    }));

    const totalDuration = flights.reduce((sum, f) => sum + (f.duration || 0) + (f.delay || 0), 0);
    const stops = flights.length - 1;

    return {
      type: segIdx === 0 ? 'ida' : 'volta',
      flights,
      stops,
      total_duration: totalDuration,
      departure_airport: flights[0]?.departure_airport || '',
      arrival_airport: flights[flights.length - 1]?.arrival_airport || '',
      departure_time: flights[0]?.departure_time || '',
      departure_date: flights[0]?.departure_date || '',
      arrival_time: flights[flights.length - 1]?.arrival_time || '',
      arrival_date: flights[flights.length - 1]?.arrival_date || '',
    };
  });

  const gateInfo = gatesInfo[bestGateId] || {};

  // Bagagem
  let baggage = null;
  if (proposal.terms?.[bestGateId]) {
    const term = proposal.terms[bestGateId];
    baggage = {
      handbags: term.flights_handbags || null,
      baggage: term.flights_baggage || null,
    };
  }

  const totalDuration = proposal.total_duration ||
    segmentsData.reduce((sum, s) => sum + s.total_duration, 0);

  return {
    id: index,
    price: Math.round(convertedPrice),
    price_raw_rub: bestPrice,
    currency: currency.toUpperCase(),
    gate_id: bestGateId,
    gate_name: gateInfo.label || `Agência ${bestGateId}`,
    gate_is_airline: gateInfo.is_airline || false,
    gate_rating: gateInfo.average_rate || 0,
    terms_url: bestTermsUrl,
    is_direct: proposal.is_direct || false,
    max_stops: proposal.max_stops || 0,
    total_duration: totalDuration,
    segment_durations: proposal.segment_durations || [],
    segments: segmentsData,
    baggage,
    validating_carrier: proposal.validating_carrier || '',
    all_terms: Object.entries(proposal.terms || {}).map(([gateId, term]) => ({
      gate_id: gateId,
      gate_name: (gatesInfo[gateId] || {}).label || `Agência ${gateId}`,
      price: Math.round((term.unified_price || term.price || 0) * rate),
      currency: currency.toUpperCase(),
      url: term.url,
    })).sort((a, b) => a.price - b.price)
  };
}

// ============================================================
// DEDUPLICAR: mesmo itinerário, manter menor preço
// ============================================================
function deduplicateProposals(proposals) {
  const seen = new Map();

  for (const p of proposals) {
    const key = p.segments.map(seg =>
      seg.flights.map(f => `${f.flight_number}_${f.departure_time}_${f.arrival_time}`).join('|')
    ).join('→');

    if (!seen.has(key) || p.price < seen.get(key).price) {
      if (seen.has(key)) {
        const existing = seen.get(key);
        const existingGates = new Set(existing.all_terms.map(t => t.gate_id));
        for (const term of p.all_terms) {
          if (!existingGates.has(term.gate_id)) {
            existing.all_terms.push(term);
          }
        }
        existing.all_terms.sort((a, b) => a.price - b.price);
        p.all_terms = existing.all_terms;
      }
      seen.set(key, p);
    } else {
      const existing = seen.get(key);
      const existingGates = new Set(existing.all_terms.map(t => t.gate_id));
      for (const term of p.all_terms) {
        if (!existingGates.has(term.gate_id)) {
          existing.all_terms.push(term);
        }
      }
      existing.all_terms.sort((a, b) => a.price - b.price);
    }
  }

  return Array.from(seen.values());
}
