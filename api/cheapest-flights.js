/**
 * Benetrip — API: /api/cheapest-flights
 * Vercel Serverless Function
 *
 * Busca os períodos mais baratos para uma rota nos próximos 6 meses
 * usando a SearchAPI (Google Flights Calendar engine).
 *
 * Suporta duração fixa (7, 14, 21 dias) e flexível (range personalizado).
 */

const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY;
const SEARCHAPI_URL = 'https://www.searchapi.io/api/v1/search';
const MAX_COMBINATIONS = 190; // margem de segurança abaixo do limite de 200
const MONTHS_AHEAD     = 180; // ~6 meses em dias
const TOP_RESULTS      = 10;
const BATCH_SIZE       = 8;   // chamadas paralelas por rodada

// ─── UTIL: DATAS ──────────────────────────────────────────────────────────────

function toISO(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dateRange(start, end) {
  const dates = [];
  const cur   = new Date(start);
  while (cur <= end) {
    dates.push(toISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ─── CHUNK BUILDERS ───────────────────────────────────────────────────────────

/**
 * Duração FIXA: cada data de saída tem exatamente 1 data de volta.
 * Cabe até MAX_COMBINATIONS datas de saída por chunk.
 */
function buildFixedChunks(startDate, endDate, durationDays) {
  const outboundDates = dateRange(startDate, addDays(endDate, -durationDays));
  const chunks = [];

  for (let i = 0; i < outboundDates.length; i += MAX_COMBINATIONS) {
    const slice    = outboundDates.slice(i, i + MAX_COMBINATIONS);
    const startOut = slice[0];
    const endOut   = slice[slice.length - 1];

    chunks.push({
      outbound_date:       startOut,
      return_date:         toISO(addDays(new Date(startOut), durationDays)),
      outbound_date_start: startOut,
      outbound_date_end:   endOut,
      return_date_start:   toISO(addDays(new Date(startOut), durationDays)),
      return_date_end:     toISO(addDays(new Date(endOut),   durationDays)),
    });
  }

  return chunks;
}

/**
 * Duração FLEXÍVEL: cada data de saída tem (flexMax - flexMin + 1) opções de volta.
 * Calcula quantas saídas cabem por chunk.
 */
function buildFlexChunks(startDate, endDate, flexMin, flexMax) {
  const rangeSize     = flexMax - flexMin + 1;
  const outPerChunk   = Math.max(1, Math.floor(MAX_COMBINATIONS / rangeSize));
  const outboundDates = dateRange(startDate, addDays(endDate, -flexMin));
  const chunks = [];

  for (let i = 0; i < outboundDates.length; i += outPerChunk) {
    const slice    = outboundDates.slice(i, i + outPerChunk);
    const startOut = slice[0];
    const endOut   = slice[slice.length - 1];

    chunks.push({
      outbound_date:       startOut,
      return_date:         toISO(addDays(new Date(startOut), flexMin)),
      outbound_date_start: startOut,
      outbound_date_end:   endOut,
      return_date_start:   toISO(addDays(new Date(startOut), flexMin)),
      return_date_end:     toISO(addDays(new Date(endOut),   flexMax)),
    });
  }

  return chunks;
}

// ─── SEARCHAPI CALL ───────────────────────────────────────────────────────────

async function fetchCalendarChunk(origin, destination, chunk) {
  const params = new URLSearchParams({
    engine:              'google_flights_calendar',
    api_key:             SEARCHAPI_KEY,
    flight_type:         'round_trip',
    departure_id:        origin,
    arrival_id:          destination,
    currency:            'BRL',
    hl:                  'pt',
    outbound_date:       chunk.outbound_date,
    return_date:         chunk.return_date,
    outbound_date_start: chunk.outbound_date_start,
    outbound_date_end:   chunk.outbound_date_end,
    return_date_start:   chunk.return_date_start,
    return_date_end:     chunk.return_date_end,
  });

  const response = await fetch(`${SEARCHAPI_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal:  AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SearchAPI ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`SearchAPI: ${data.error}`);
  }

  return Array.isArray(data.calendar) ? data.calendar : [];
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {

  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // Chave obrigatória
  if (!SEARCHAPI_KEY) {
    console.error('[Benetrip] SEARCHAPI_KEY ausente.');
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  // ─── Validação de entrada ────────────────────────────────────────────────────
  const { origin, destination, durationType, flexMin, flexMax } = req.body ?? {};

  if (!origin || !destination) {
    return res.status(400).json({ error: 'Origem e destino são obrigatórios.' });
  }

  const iataRegex = /^[A-Z]{3}$/;
  if (!iataRegex.test(origin) || !iataRegex.test(destination)) {
    return res.status(400).json({ error: 'Códigos IATA inválidos (use 3 letras maiúsculas).' });
  }

  if (origin === destination) {
    return res.status(400).json({ error: 'Origem e destino não podem ser iguais.' });
  }

  const isFixed = ['7', '14', '21'].includes(String(durationType));
  const isFlex  = durationType === 'flex';

  if (!isFixed && !isFlex) {
    return res.status(400).json({ error: 'Duração inválida. Use 7, 14, 21 ou flex.' });
  }

  let fMin, fMax;
  if (isFlex) {
    fMin = parseInt(flexMin);
    fMax = parseInt(flexMax);
    if (isNaN(fMin) || isNaN(fMax) || fMin < 2 || fMax > 35 || fMax <= fMin) {
      return res.status(400).json({ error: 'Range flexível inválido.' });
    }
  }

  // ─── Período de busca ────────────────────────────────────────────────────────
  const today      = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate  = addDays(today, 3);          // mínimo 3 dias à frente
  const endDate    = addDays(today, MONTHS_AHEAD);

  // ─── Montar chunks ───────────────────────────────────────────────────────────
  const fixedDays = isFixed ? parseInt(durationType) : null;
  const chunks    = isFixed
    ? buildFixedChunks(startDate, endDate, fixedDays)
    : buildFlexChunks(startDate, endDate, fMin, fMax);

  console.log(`[Benetrip] ${origin}→${destination} | tipo:${durationType} | chunks:${chunks.length}`);

  // ─── Chamadas paralelas em batches ───────────────────────────────────────────
  let allCalendar = [];
  let errorCount  = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch   = chunks.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(chunk => fetchCalendarChunk(origin, destination, chunk))
    );

    settled.forEach(result => {
      if (result.status === 'fulfilled') {
        allCalendar.push(...result.value);
      } else {
        errorCount++;
        console.error('[Benetrip] Chunk falhou:', result.reason?.message);
      }
    });
  }

  // Todos os chunks falharam
  if (!allCalendar.length && errorCount > 0) {
    return res.status(502).json({
      error: 'Não foi possível obter tarifas no momento. Tente novamente em alguns instantes.'
    });
  }

  // ─── Processar resultados ────────────────────────────────────────────────────

  // 1. Filtrar entradas sem preço ou sem voo disponível
  const valid = allCalendar.filter(r => r.price && r.departure && r.return && !r.has_no_flights);

  // 2. Para duração fixa, garantir que a duração seja exata
  const filtered = fixedDays
    ? valid.filter(r => {
        const diff = Math.round((new Date(r.return) - new Date(r.departure)) / 86400000);
        return diff === fixedDays;
      })
    : valid;

  // 3. Deduplicar por par (ida + volta)
  const seen   = new Set();
  const unique = filtered.filter(r => {
    const key = `${r.departure}|${r.return}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 4. Ordenar por preço crescente
  unique.sort((a, b) => a.price - b.price);

  // 5. Top N resultados
  const topResults = unique.slice(0, TOP_RESULTS);

  console.log(`[Benetrip] ${valid.length} válidos → ${topResults.length} selecionados`);

  // ─── Resposta ────────────────────────────────────────────────────────────────
  return res.status(200).json({
    origin,
    destination,
    durationType,
    lowestPrice:  topResults[0]?.price ?? null,
    totalScanned: valid.length,
    results:      topResults.map(r => ({
      departure:       r.departure,
      return:          r.return,
      price:           r.price,
      is_lowest_price: r.is_lowest_price ?? false,
    })),
    generatedAt: new Date().toISOString(),
  });
}
