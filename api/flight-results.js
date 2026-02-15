// api/flight-results.js - Benetrip Flight Results v3.0
// ROBUST CURRENCY CONVERSION: 3-strategy approach
//   1. Derive rate from terms.price / terms.unified_price (most reliable)
//   2. Use currency_rates from API response chunks
//   3. Use currency_rates forwarded from frontend (from initial search)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uuid, currency = 'BRL', rates: ratesParam } = req.query;
  if (!uuid) return res.status(400).json({ error: 'Parâmetro uuid obrigatório' });

  // Parse frontend-forwarded rates (fallback)
  let frontendRates = {};
  if (ratesParam) {
    try { frontendRates = JSON.parse(ratesParam); } catch (e) { /* ignore */ }
  }

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
    let chunkCurrencyRates = {};
    let gatesInfo = {};
    let airlines = {};
    let searchComplete = false;
    let segments = [];

    for (const chunk of rawData) {
      if (!chunk || typeof chunk !== 'object') continue;
      if (chunk.search_id && Object.keys(chunk).length <= 2) { searchComplete = true; continue; }
      if (chunk.currency_rates) chunkCurrencyRates = { ...chunkCurrencyRates, ...chunk.currency_rates };
      if (chunk.gates_info) gatesInfo = { ...gatesInfo, ...chunk.gates_info };
      if (chunk.airlines) Object.assign(airlines, chunk.airlines);
      if (chunk.segments?.length > 0) segments = chunk.segments;
      if (Array.isArray(chunk.proposals)) allProposals = allProposals.concat(chunk.proposals);
    }

    // ============================================================
    // CURRENCY CONVERSION - Multi-strategy approach
    // ============================================================
    const target = currency.toUpperCase();
    const targetLower = currency.toLowerCase();

    // Merge all available rates (chunk + frontend)
    const allRates = { ...frontendRates, ...chunkCurrencyRates };

    // Strategy 1: Derive rate from terms data (most reliable)
    // Find a term whose currency matches our target and compute the ratio
    let derivedRate = null;
    for (const p of allProposals) {
      if (derivedRate !== null) break;
      if (!p.terms) continue;
      for (const [, term] of Object.entries(p.terms)) {
        if (term.unified_price && term.unified_price > 0 && term.price && term.price > 0 && term.currency) {
          const termCur = term.currency.toUpperCase();
          if (termCur === target) {
            derivedRate = term.price / term.unified_price;
            console.log(`💱 [Strategy 1] Derived ${target} rate from terms: ${derivedRate.toFixed(8)} (${term.price}/${term.unified_price})`);
            break;
          }
        }
      }
    }

    // Strategy 2: Look up in merged rates (case-insensitive)
    let lookupRate = null;
    for (const [key, val] of Object.entries(allRates)) {
      if (key.toUpperCase() === target || key.toLowerCase() === targetLower) {
        lookupRate = val;
        console.log(`💱 [Strategy 2] Rates lookup [${key}] = ${val}`);
        break;
      }
    }

    // Strategy 3: Cross-convert using any available term + rates
    // If target isn't directly in rates, derive from another currency
    let crossRate = null;
    if (derivedRate === null && lookupRate === null) {
      for (const p of allProposals) {
        if (crossRate !== null) break;
        if (!p.terms) continue;
        for (const [, term] of Object.entries(p.terms)) {
          if (term.unified_price > 0 && term.price > 0 && term.currency) {
            // We know: term.price / term.unified_price = rate_for_term_currency
            // So 1 RUB = (term.price / term.unified_price) in term.currency
            const termRate = term.price / term.unified_price; // RUB → term.currency
            const termCur = term.currency.toUpperCase();

            // Now find target in rates relative to term currency or RUB
            // If we have currency_rates for target, we can use them
            for (const [rk, rv] of Object.entries(allRates)) {
              if (rk.toUpperCase() === target) {
                // Found target rate; now determine direction
                // If rv is similar magnitude to termRate, it's also RUB→target multiplier
                crossRate = rv < 1 ? rv : 1 / rv;
                console.log(`💱 [Strategy 3] Cross-convert via ${termCur}: target rate = ${crossRate}`);
                break;
              }
            }
            if (crossRate !== null) break;
          }
        }
      }
    }

    // Select best rate and determine conversion
    let convertFn;
    if (derivedRate !== null && derivedRate > 0) {
      // Derived from terms: price_target / price_rub = always MULTIPLY
      convertFn = (rub) => Math.round(rub * derivedRate);
      console.log(`💱 [FINAL] Using derived rate: ${derivedRate.toFixed(8)} (MULTIPLY)`);
    } else if (lookupRate !== null && lookupRate > 0) {
      // From rates: detect direction
      if (lookupRate < 1) {
        // Small number like 0.055 → "1 RUB = 0.055 BRL" → MULTIPLY
        convertFn = (rub) => Math.round(rub * lookupRate);
        console.log(`💱 [FINAL] Using lookup rate: ${lookupRate} (MULTIPLY, rate < 1)`);
      } else {
        // Large number like 18.2 → "1 BRL = 18.2 RUB" → DIVIDE
        convertFn = (rub) => Math.round(rub / lookupRate);
        console.log(`💱 [FINAL] Using lookup rate: ${lookupRate} (DIVIDE, rate > 1)`);
      }
    } else if (crossRate !== null && crossRate > 0) {
      convertFn = (rub) => Math.round(rub * crossRate);
      console.log(`💱 [FINAL] Using cross rate: ${crossRate}`);
    } else {
      // ABSOLUTE FALLBACK: no conversion possible
      convertFn = (rub) => rub;
      console.warn(`⚠️ [FINAL] NO RATE for ${target}! chunk_keys=${JSON.stringify(Object.keys(chunkCurrencyRates))} fe_keys=${JSON.stringify(Object.keys(frontendRates))}`);
    }

    // Format proposals
    const formatted = allProposals.map((p, i) => {
      try { return fmtProposal(p, convertFn, target, gatesInfo, airlines, i); }
      catch (e) { console.warn(`⚠️ Skip proposal ${i}:`, e.message); return null; }
    }).filter(Boolean);

    formatted.sort((a, b) => a.price - b.price);
    const deduped = dedup(formatted);

    console.log(`📋 [Results] ${allProposals.length} raw → ${formatted.length} fmt → ${deduped.length} grouped | done=${searchComplete}`);

    return res.status(200).json({
      search_id: uuid,
      completed: searchComplete,
      currency: target,
      total_raw: allProposals.length,
      total: deduped.length,
      proposals: deduped,
      gates_info: gatesInfo,
      airlines_info: airlines,
      segments,
      currency_rates: { ...frontendRates, ...chunkCurrencyRates }
    });
  } catch (error) {
    console.error('❌ [Results]', error.message);
    return res.status(500).json({ error: 'Erro ao buscar resultados', message: error.message });
  }
};

function fmtProposal(proposal, convert, currency, gatesInfo, airlines, index) {
  const allTerms = [];
  let bestConverted = Infinity, bestGateId = null, bestUrl = null;

  if (proposal.terms) {
    for (const [gateId, term] of Object.entries(proposal.terms)) {
      const rub = term.unified_price || term.price || Infinity;
      const converted = convert(rub);
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
      if (converted < bestConverted) { bestConverted = converted; bestGateId = gateId; bestUrl = term.url; }
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
    price: allTerms.length > 0 ? allTerms[0].price : bestConverted,
    price_raw_rub: allTerms.length > 0 ? allTerms[0].price_rub : (proposal.terms?.[bestGateId]?.unified_price || 0),
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
