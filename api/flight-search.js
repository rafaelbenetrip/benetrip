// api/flight-search.js - Benetrip Flight Search v2.0
// Inicia busca de voos via Travelpayouts/Aviasales Flight Search API
// Assinatura MD5 baseada no código antigo que FUNCIONAVA
// CommonJS (compatível com Vercel)

const crypto = require('crypto');

// ============================================================
// GERAR ASSINATURA MD5 (algoritmo do código antigo que funcionava)
// 1. Coleta TODOS os nomes de parâmetros (top-level + 'passengers' + 'segments')
// 2. Ordena alfabeticamente
// 3. Para cada nome, insere os valores (nested sorted internamente)
// 4. Junta com ":", prepend token, MD5
// ============================================================
function generateSignature(requestData, token) {
  console.log("[Signature] Gerando assinatura MD5...");

  // Nomes das estruturas aninhadas
  const nestedNames = ['passengers', 'segments'];

  // Coleta nomes de parâmetros top-level presentes no requestData
  const topLevelNames = [];
  const topLevelKeys = ['host', 'locale', 'marker', 'trip_class', 'user_ip', 'currency', 'know_english', 'only_direct'];
  
  for (const key of topLevelKeys) {
    if (requestData[key] !== undefined) {
      topLevelNames.push(key);
    }
  }

  // Junta top-level + nested e ordena TUDO alfabeticamente
  const allNames = [...topLevelNames, ...nestedNames];
  allNames.sort((a, b) => a.localeCompare(b));
  console.log("[Signature] Ordem dos nomes:", allNames);

  // Extrai valores na ordem correta
  const values = [];
  for (const name of allNames) {
    if (name === 'passengers') {
      // Passengers: adults, children, infants (ordem alfabética)
      values.push(String(requestData.passengers.adults));
      values.push(String(requestData.passengers.children));
      values.push(String(requestData.passengers.infants));
    } else if (name === 'segments') {
      // Segments: para cada segmento, date, destination, origin (ordem alfabética)
      for (const seg of requestData.segments) {
        values.push(String(seg.date));
        values.push(String(seg.destination));
        values.push(String(seg.origin));
      }
    } else {
      // Parâmetro top-level simples
      values.push(String(requestData[name]));
    }
  }

  console.log("[Signature] Valores:", values);

  // Monta string: token:valor1:valor2:...
  const signatureString = token + ':' + values.join(':');
  console.log("[Signature] String (parcial):", signatureString.substring(0, 80) + "...");

  // MD5
  const hash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log("[Signature] MD5:", hash);

  return hash;
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const TOKEN = process.env.AVIASALES_TOKEN;
  const MARKER = process.env.AVIASALES_MARKER;

  if (!TOKEN || !MARKER) {
    console.error("[FlightSearch] AVIASALES_TOKEN ou AVIASALES_MARKER não configurados");
    return res.status(500).json({ error: 'Configuração interna incompleta.' });
  }

  try {
    const params = req.body;
    console.log("[FlightSearch] Params recebidos:", JSON.stringify(params));

    // ============================================================
    // Aceita AMBOS os formatos de parâmetros:
    // NOVO: origin, destination, departure_date, return_date, adults, children, infants
    // ANTIGO: origem, destino, dataIda, dataVolta, adultos, criancas, bebes
    // ============================================================
    const origin = (params.origin || params.origem || '').toUpperCase();
    const destination = (params.destination || params.destino || '').toUpperCase();
    const departureDate = params.departure_date || params.dataIda || '';
    const returnDate = params.return_date || params.dataVolta || '';
    const adults = parseInt(params.adults || params.adultos || 1, 10);
    const children = parseInt(params.children || params.criancas || 0, 10);
    const infants = parseInt(params.infants || params.bebes || 0, 10);
    const tripClass = (params.trip_class || params.classe || 'Y').toUpperCase();
    const currency = (params.currency || '').toUpperCase();

    // Validações
    if (!origin || !destination || !departureDate) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: origin, destination, departure_date' });
    }
    if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) {
      return res.status(400).json({ error: 'Códigos IATA inválidos (devem ter 3 letras)' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
      return res.status(400).json({ error: 'Formato de data inválido (yyyy-mm-dd)' });
    }

    // IP do usuário
    const userIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.headers['client-ip']
      || req.connection?.remoteAddress
      || '127.0.0.1';

    const host = process.env.HOST || 'www.benetrip.com.br';
    const locale = params.locale || 'pt';

    // ============================================================
    // Montar objeto da requisição para Travelpayouts
    // ============================================================
    const requestData = {
      marker: MARKER,
      host: host,
      user_ip: userIp,
      locale: locale,
      trip_class: tripClass,
      passengers: {
        adults: adults,
        children: children,
        infants: infants
      },
      segments: []
    };

    // Segmento de ida
    requestData.segments.push({
      origin: origin,
      destination: destination,
      date: departureDate
    });

    // Segmento de volta (round trip)
    if (returnDate && /^\d{4}-\d{2}-\d{2}$/.test(returnDate)) {
      requestData.segments.push({
        origin: destination,
        destination: origin,
        date: returnDate
      });
    }

    // Parâmetros opcionais — DEVEM estar na assinatura se presentes no body
    if (locale.toLowerCase().startsWith('pt')) {
      requestData.know_english = false;
    }

    if (currency && currency.length === 3) {
      requestData.currency = currency;
    }

    // ============================================================
    // Gerar assinatura e adicionar ao request
    // ============================================================
    const signature = generateSignature(requestData, TOKEN);
    requestData.signature = signature;

    console.log(`✈️ [FlightSearch] ${origin} → ${destination} | ${departureDate}${returnDate ? ' → ' + returnDate : ' (só ida)'} | ${adults}a ${children}c ${infants}i | IP: ${userIp}`);

    // Log do payload (sem assinatura por segurança)
    const logData = { ...requestData };
    delete logData.signature;
    console.log("[FlightSearch] Payload:", JSON.stringify(logData));

    // ============================================================
    // Enviar para Travelpayouts
    // ============================================================
    const response = await fetch('https://api.travelpayouts.com/v1/flight_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [FlightSearch] HTTP ${response.status}:`, errorText);

      if (response.status === 401 || response.status === 403) {
        console.error("❌ [FlightSearch] ERRO DE ASSINATURA! Verifique TOKEN e MARKER.");
      }

      return res.status(response.status).json({
        error: `Erro ${response.status} na API de voos`,
        detail: errorText
      });
    }

    const data = await response.json();
    const searchId = data.search_id;
    const currencyRates = data.currency_rates;

    if (!searchId) {
      console.error("❌ [FlightSearch] Sem search_id:", JSON.stringify(data).substring(0, 500));
      return res.status(500).json({ error: 'Resposta inválida da API' });
    }

    console.log(`✅ [FlightSearch] search_id: ${searchId} | gates: ${data.gates_count || '?'}`);
    if (currencyRates) {
      console.log("[FlightSearch] Currency rates:", JSON.stringify(currencyRates));
    }

    return res.status(202).json({
      success: true,
      search_id: searchId,
      currency_rates: currencyRates || null,
      segments: data.segments || requestData.segments,
      passengers: data.passengers || requestData.passengers,
      gates_count: data.gates_count || 0,
      _meta: {
        origin,
        destination,
        departure_date: departureDate,
        return_date: returnDate,
        currency,
        locale
      }
    });

  } catch (error) {
    console.error("❌ [FlightSearch] Erro:", error.message);

    if (error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'Timeout ao conectar com API de voos' });
    }

    return res.status(500).json({
      error: 'Erro interno',
      message: error.message
    });
  }
};
