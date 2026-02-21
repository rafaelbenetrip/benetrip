// api/flight-results.js - Benetrip Flight Results v4.0
// ROBUST CURRENCY CONVERSION with safer heuristics
//
// Changelog v4.0:
// - FIX: Removed fragile < 1 / > 1 heuristic for rate direction detection
// - NEW: Always prefer Strategy 1 (derived from terms) — most reliable
// - NEW: Strategy 2 now validates rate direction using a cross-check term
// - NEW: Each proposal exposes `term_currency` and each term exposes `original_currency`
//        so the frontend can warn users about currency mismatches
// - NEW: All terms include original currency info for transparency

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
    // CURRENCY CONVERSION - Improved multi-strategy approach
    // ============================================================
    const target = currency.toUpperCase();
    const allRates = { ...frontendRates, ...chunkCurrencyRates };

    // ---- Strategy 1: Derive rate from terms data (MOST RELIABLE) ----
    // Find a term whose currency matches our target currency.
    // The ratio term.price / term.unified_price gives us the exact conversion factor.
    // unified_price is ALWAYS in RUB (Travelpayouts base currency).
    let derivedRate = null;
    let derivedSamples = 0;
    
    for (const p of allProposals) {
      if (derivedRate !== null && derivedSamples >= 3) break; // Enough samples
      if (!p.terms) continue;
      for (const [, term] of Object.entries(p.terms)) {
        if (term.unified_price && term.unified_price > 0 && term.price && term.price > 0 && term.currency) {
          const termCur = term.currency.toUpperCase();
          if (termCur === target) {
            const rate = term.price / term.unified_price;
            if (derivedRate === null) {
              derivedRate = rate;
            } else {
              // Average with previous to smooth out rounding differences
              derivedRate = (derivedRate * derivedSamples + rate) / (derivedSamples + 1);
            }
            derivedSamples++;
            break;
          }
        }
      }
    }
    
    if (derivedRate !== null) {
      console.log(`💱 [Strategy 1] Derived ${target} rate from ${derivedSamples} terms: ${derivedRate.toFixed(8)}`);
    }

    // ---- Strategy 2: Use currency_rates with cross-validation ----
    // The rates object from Travelpayouts is inconsistent about direction.
    // We validate by checking against a known term conversion.
    let validatedLookupRate = null;
    
    if (derivedRate === null) {
      // Find any rate for our target currency
      let rawRate = null;
      for (const [key, val] of Object.entries(allRates)) {
        if (key.toUpperCase() === target || key.toLowerCase() === target.toLowerCase()) {
          rawRate = val;
          break;
        }
      }

      if (rawRate !== null && rawRate > 0) {
        // Cross-validate: find ANY term to check if multiply or divide is correct
        let testTerm = null;
        for (const p of allProposals) {
          if (testTerm) break;
          if (!p.terms) continue;
          for (const [, term] of Object.entries(p.terms)) {
            if (term.unified_price > 0 && term.price > 0 && term.currency) {
              testTerm = term;
              break;
            }
          }
        }

        if (testTerm) {
          const termCur = testTerm.currency.toUpperCase();
          const termRatio = testTerm.price / testTerm.unified_price; // RUB → termCurrency

          // Find the rate for the term's currency to compare
          let termRate = null;
          for (const [key, val] of Object.entries(allRates)) {
            if (key.toUpperCase() === termCur) { termRate = val; break; }
          }

          if (termRate !== null && termRate > 0) {
            // If rates are in "RUB → X" direction: rate * unified_price ≈ price
            const testMultiply = testTerm.unified_price * termRate;
            const testDivide = testTerm.unified_price / termRate;
            
            const errMultiply = Math.abs(testMultiply - testTerm.price) / testTerm.price;
            const errDivide = Math.abs(testDivide - testTerm.price) / testTerm.price;

            // Determine which direction is correct
            if (errMultiply < errDivide && errMultiply < 0.05) {
              // Rates are "multiply" direction (RUB * rate = local)
              validatedLookupRate = rawRate;
              console.log(`💱 [Strategy 2] Validated MULTIPLY: rate=${rawRate} (err=${(errMultiply*100).toFixed(1)}%)`);
            } else if (errDivide < errMultiply && errDivide < 0.05) {
              // Rates are "divide" direction (RUB / rate = local)
              validatedLookupRate = 1 / rawRate;
              console.log(`💱 [Strategy 2] Validated DIVIDE→inverted: rate=${(1/rawRate).toFixed(8)} (err=${(errDivide*100).toFixed(1)}%)`);
            } else {
              console.warn(`⚠️ [Strategy 2] Cannot validate direction: errMul=${(errMultiply*100).toFixed(1)}% errDiv=${(errDivide*100).toFixed(1)}%`);
            }
          }
        }
        
        // If we couldn't cross-validate, skip this rate entirely — don't guess
        if (validatedLookupRate === null && rawRate !== null) {
          console.warn(`⚠️ [Strategy 2] Raw rate ${rawRate} for ${target} found but NOT validated. Skipping.`);
        }
      }
    }

    // ---- Select best rate ----
    let convertFn;
    if (derivedRate !== null && derivedRate > 0) {
      convertFn = (rub) => Math.round(rub * derivedRate);
      console.log(`💱 [FINAL] Using derived rate: ×${derivedRate.toFixed(8)}`);
    } else if (validatedLookupRate !== null && validatedLookupRate > 0) {
      convertFn = (rub) => Math.round(rub * validatedLookupRate);
      console.log(`💱 [FINAL] Using validated lookup rate: ×${validatedLookupRate.toFixed(8)}`);
    } else {
      // ABSOLUTE FALLBACK: use term prices directly when they match target currency
      // or return RUB values (which will look wrong but at least won't crash)
      convertFn = (rub) => rub;
      console.warn(`⚠️ [FINAL] NO VALID RATE for ${target}! Returning raw values. chunk_keys=${JSON.stringify(Object.keys(chunkCurrencyRates))}`);
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
  let bestTermCurrency = null; // Track what currency the best gate actually sells in

  if (proposal.terms) {
    for (const [gateId, term] of Object.entries(proposal.terms)) {
      const rub = term.unified_price || term.price || Infinity;
      
      // If this term already has the target currency price, use it directly
      let converted;
      const termCur = (term.currency || '').toUpperCase();
      if (termCur === currency && term.price > 0) {
        converted = Math.round(term.price);
      } else {
        converted = convert(rub);
      }
      
      const gi = gatesInfo[gateId] || {};
      allTerms.push({
        gate_id: gateId,
        gate_name: gi.label || `Agência ${gateId}`,
        gate_is_airline: gi.is_airline || false,
        price: converted,
        price_rub: rub,
        currency,
        original_currency: termCur || 'RUB', // NEW: what currency the gate actually charges in
        url: term.url,
      });
      if (converted < bestConverted) {
        bestConverted = converted;
        bestGateId = gateId;
        bestUrl = term.url;
        bestTermCurrency = termCur || 'RUB';
      }
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
    term_currency: bestTermCurrency, // NEW: actual currency of the best gate
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
        ex.term_currency = ex.all_terms[0].original_currency; // Update currency info too
      }
    }
  }
  return Array.from(seen.values());
}
