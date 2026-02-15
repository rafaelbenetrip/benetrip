// api/flight-results.js - Benetrip Flight Results v2.1
// FORMULA: currency_rates values < 1 → MULTIPLY, values > 1 → DIVIDE
// Case-insensitive key lookup for currency_rates

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uuid, currency = 'BRL' } = req.query;
  if (!uuid) return res.status(400).json({ error: 'Parâmetro uuid obrigatório' });

  try {
    const response = await fetch(`https://api.travelpayouts.com/v1/flight_search_results?uuid=${uuid}`, {
      headers: { 'Accept-Encoding': 'gzip,deflate', 'Accept': 'application/json' }
    });

    if (!response.ok) return res.status(response.status).json({ error: `API retornou ${response.status}` });

    const rawData = await response.json();
    if (!Array.isArray(rawData)) {
      return res.status(200).json({ search_id: uuid, completed: false, proposals: [], total: 0 });
    }

    let allProposals = [];
    let currencyRates = {};
    let gatesInfo = {};
    let airlines = {};
    let searchComplete = false;
    let segments = [];

    for (const chunk of rawData) {
      if (!chunk || typeof chunk !== 'object') continue;
      if (chunk.search_id && Object.keys(chunk).length <= 2) { searchComplete = true; continue; }
      if (chunk.currency_rates) currencyRates = { ...currencyRates, ...chunk.currency_rates };
      if (chunk.gates_info) gatesInfo = { ...gatesInfo, ...chunk.gates_info };
      if (chunk.airlines) Object.assign(airlines, chunk.airlines);
      if (chunk.segments?.length > 0) segments = chunk.segments;
      if (Array.isArray(chunk.proposals)) allProposals = allProposals.concat(chunk.proposals);
    }

    // ============================================================
    // CURRENCY CONVERSION - case-insensitive key lookup
    // ============================================================
    const target = currency.toUpperCase();

    // Find rate (case-insensitive)
    let rate = null;
    for (const [key, val] of Object.entries(currencyRates)) {
      if (key.toUpperCase() === target) { rate = val; break; }
    }
    if (rate === null || rate === 0) {
      for (const [key, val] of Object.entries(currencyRates)) {
        if (key.toUpperCase() === 'BRL') { rate = val; break; }
      }
    }
    if (rate === null || rate === 0) rate = 1;

    // Auto-detect: rate < 1 means "1 RUB = X moeda" → MULTIPLY
    // rate > 1 means "1 moeda = X RUB" → DIVIDE
    const multiply = (rate < 1);
    const convert = (rub) => multiply ? rub * rate : rub / rate;

    console.log(`💱 [Currency] ${target} rate=${rate} method=${multiply ? 'MUL' : 'DIV'} rates=${JSON.stringify(currencyRates).substring(0, 200)}`);

    // Format proposals
    const formatted = allProposals.map((p, i) => {
      try { return fmtProposal(p, convert, target, gatesInfo, airlines, i); }
      catch (e) { return null; }
    }).filter(Boolean);

    formatted.sort((a, b) => a.price - b.price);
    const deduped = dedup(formatted);

    console.log(`📋 [Results] ${allProposals.length} raw → ${deduped.length} grouped | done=${searchComplete}`);

    return res.status(200).json({
      search_id: uuid,
      completed: searchComplete,
      currency: target,
      currency_rate: rate,
      total_raw: allProposals.length,
      total: deduped.length,
      proposals: deduped,
      gates_info: gatesInfo,
      airlines_info: airlines,
      segments
    });
  } catch (error) {
    console.error('❌ [Results]', error.message);
    return res.status(500).json({ error: 'Erro ao buscar resultados', message: error.message });
  }
};

function fmtProposal(proposal, convert, currency, gatesInfo, airlines, index) {
  const allTerms = [];
  let bestRub = Infinity, bestGateId = null, bestUrl = null;

  if (proposal.terms) {
    for (const [gateId, term] of Object.entries(proposal.terms)) {
      const rub = term.unified_price || term.price || Infinity;
      const converted = Math.round(convert(rub));
      const gi = gatesInfo[gateId] || {};
      allTerms.push({
        gate_id: gateId,
        gate_name: gi.label || `Agência ${gateId}`,
        gate_is_airline: gi.is_airline || false,
        price: converted,
        price_rub: rub,
        currency,
        url: term.url,
      });
      if (rub < bestRub) { bestRub = rub; bestGateId = gateId; bestUrl = term.url; }
    }
  }
  allTerms.sort((a, b) => a.price - b.price);

  const segs = (proposal.segment || []).map((seg, si) => {
    const flights = (seg.flight || []).map(f => ({
      airline: f.marketing_carrier || f.operating_carrier || '',
      airline_name: airlines[f.marketing_carrier]?.name || airlines[f.operating_carrier]?.name || f.marketing_carrier || '',
      flight_number: `${f.marketing_carrier || f.operating_carrier || ''}${f.number || ''}`,
      departure_airport: f.departure,
      arrival_airport: f.arrival,
      departure_date: f.departure_date,
      departure_time: f.departure_time,
      arrival_date: f.arrival_date,
      arrival_time: f.arrival_time,
      duration: f.duration,
      delay: f.delay || 0,
      operating_carrier: f.operating_carrier || f.marketing_carrier || '',
    }));
    const dur = flights.reduce((s, f) => s + (f.duration || 0) + (f.delay || 0), 0);
    return {
      type: si === 0 ? 'ida' : 'volta',
      flights, stops: flights.length - 1, total_duration: dur,
      departure_airport: flights[0]?.departure_airport || '',
      arrival_airport: flights[flights.length - 1]?.arrival_airport || '',
      departure_time: flights[0]?.departure_time || '',
      departure_date: flights[0]?.departure_date || '',
      arrival_time: flights[flights.length - 1]?.arrival_time || '',
      arrival_date: flights[flights.length - 1]?.arrival_date || '',
    };
  });

  const carriers = new Set();
  for (const s of segs) for (const f of s.flights) if (f.airline) carriers.add(f.airline);

  let baggage = null;
  if (proposal.terms?.[bestGateId]) {
    const t = proposal.terms[bestGateId];
    baggage = { handbags: t.flights_handbags || null, baggage: t.flights_baggage || null };
  }

  const totalDur = proposal.total_duration || segs.reduce((s, seg) => s + seg.total_duration, 0);
  const gi = gatesInfo[bestGateId] || {};

  return {
    id: index,
    price: allTerms.length > 0 ? allTerms[0].price : Math.round(convert(bestRub)),
    price_raw_rub: bestRub,
    currency,
    gate_id: bestGateId,
    gate_name: gi.label || `Agência ${bestGateId}`,
    terms_url: bestUrl,
    is_direct: proposal.is_direct || false,
    max_stops: proposal.max_stops || 0,
    total_duration: totalDur,
    segment_durations: proposal.segment_durations || [],
    segments: segs,
    carriers: Array.from(carriers),
    baggage,
    sign: proposal.sign || '',
    all_terms: allTerms
  };
}

// Dedup: group same flight from different operators using sign or flight key
function dedup(proposals) {
  const seen = new Map();
  for (const p of proposals) {
    const key = p.sign || p.segments.map(s =>
      s.flights.map(f => `${f.flight_number}_${f.departure_time}_${f.arrival_time}`).join('|')
    ).join('→');

    if (!seen.has(key)) {
      seen.set(key, { ...p });
    } else {
      const ex = seen.get(key);
      const exGates = new Set(ex.all_terms.map(t => t.gate_id));
      for (const t of p.all_terms) {
        if (!exGates.has(t.gate_id)) { ex.all_terms.push(t); exGates.add(t.gate_id); }
        else {
          const idx = ex.all_terms.findIndex(x => x.gate_id === t.gate_id);
          if (idx >= 0 && t.price < ex.all_terms[idx].price) ex.all_terms[idx] = t;
        }
      }
      ex.all_terms.sort((a, b) => a.price - b.price);
      if (ex.all_terms[0].price < ex.price) {
        ex.price = ex.all_terms[0].price;
        ex.price_raw_rub = ex.all_terms[0].price_rub;
        ex.gate_id = ex.all_terms[0].gate_id;
        ex.gate_name = ex.all_terms[0].gate_name;
        ex.terms_url = ex.all_terms[0].url;
      }
    }
  }
  return Array.from(seen.values());
}
