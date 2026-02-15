// api/flight-search.js - Benetrip Flight Search
// Inicia busca de voos via Travelpayouts/Aviasales Flight Search API
// Gera assinatura MD5, envia request, retorna search_id
// v1.0

import { createHash } from 'crypto';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const MARKER = process.env.AVIASALES_MARKER;
    const TOKEN = process.env.AVIASALES_TOKEN;

    if (!MARKER || !TOKEN) {
        return res.status(500).json({
            error: 'Configuração ausente',
            message: 'AVIASALES_MARKER e AVIASALES_TOKEN devem estar configurados no Vercel'
        });
    }

    try {
        const {
            origin,        // IATA code (ex: "GRU")
            destination,   // IATA code (ex: "BCN")
            departure_date, // yyyy-mm-dd
            return_date,    // yyyy-mm-dd (opcional para one-way)
            adults = 1,
            children = 0,
            infants = 0,
            trip_class = 'Y', // Y=Economy, C=Business
            currency = 'BRL'  // moeda desejada pelo usuário (para referência)
        } = req.body;

        // Validações
        if (!origin || !destination || !departure_date) {
            return res.status(400).json({
                error: 'Parâmetros obrigatórios: origin, destination, departure_date'
            });
        }

        // Detectar IP do usuário
        const userIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip']
            || req.connection?.remoteAddress
            || '127.0.0.1';

        const host = 'www.benetrip.com.br';
        const locale = 'pt';
        const tripClass = trip_class.toUpperCase();

        // Montar segments
        const segments = [
            {
                origin: origin.toUpperCase(),
                destination: destination.toUpperCase(),
                date: departure_date
            }
        ];

        // Round trip
        if (return_date) {
            segments.push({
                origin: destination.toUpperCase(),
                destination: origin.toUpperCase(),
                date: return_date
            });
        }

        const passengers = {
            adults: parseInt(adults),
            children: parseInt(children),
            infants: parseInt(infants)
        };

        // ============================================================
        // GERAR ASSINATURA MD5
        // Ordenar todos os valores alfabeticamente, separar por ":"
        // Prepend token
        // ============================================================
        const signature = generateSignature(TOKEN, {
            host,
            locale,
            marker: MARKER,
            passengers,
            segments,
            trip_class: tripClass,
            user_ip: userIp
        });

        // Montar body da request
        const requestBody = {
            signature,
            marker: MARKER,
            host,
            user_ip: userIp,
            locale,
            trip_class: tripClass,
            passengers,
            segments,
            know_english: true
        };

        console.log(`✈️ [FlightSearch] ${origin} → ${destination} | ${departure_date}${return_date ? ' → ' + return_date : ' (só ida)'} | ${adults}a ${children}c ${infants}i | IP: ${userIp}`);

        // Enviar para Travelpayouts
        const response = await fetch('https://api.travelpayouts.com/v1/flight_search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ [FlightSearch] HTTP ${response.status}:`, errorText);
            return res.status(response.status).json({
                error: 'Erro na API de voos',
                status: response.status,
                detail: errorText
            });
        }

        const data = await response.json();

        if (!data.search_id) {
            console.error('❌ [FlightSearch] Sem search_id na resposta:', JSON.stringify(data).substring(0, 500));
            return res.status(500).json({
                error: 'Resposta inválida da API',
                message: 'Não foi possível iniciar a busca'
            });
        }

        console.log(`✅ [FlightSearch] search_id: ${data.search_id} | gates: ${data.gates_count || '?'}`);

        return res.status(200).json({
            success: true,
            search_id: data.search_id,
            currency_rates: data.currency_rates || {},
            segments: data.segments || segments,
            passengers: data.passengers || passengers,
            gates_count: data.gates_count || 0,
            _meta: {
                origin,
                destination,
                departure_date,
                return_date,
                currency,
                locale
            }
        });

    } catch (error) {
        console.error('❌ [FlightSearch] Erro:', error.message);
        return res.status(500).json({
            error: 'Erro interno',
            message: error.message
        });
    }
}

// ============================================================
// GERAR ASSINATURA MD5
// 1. Extrair todos os valores primitivos (flatten)
// 2. Ordenar alfabeticamente pela chave completa
// 3. Juntar valores com ":"
// 4. Prepend token
// 5. MD5
// ============================================================
function generateSignature(token, params) {
    // Flatten all values in alphabetical key order
    const values = [];

    // host
    values.push(params.host);
    // locale
    values.push(params.locale);
    // marker
    values.push(params.marker);
    // passengers (sorted: adults, children, infants)
    values.push(params.passengers.adults);
    values.push(params.passengers.children);
    values.push(params.passengers.infants);
    // segments (each sorted: date, destination, origin)
    for (const seg of params.segments) {
        values.push(seg.date);
        values.push(seg.destination);
        values.push(seg.origin);
    }
    // trip_class
    values.push(params.trip_class);
    // user_ip
    values.push(params.user_ip);

    const signatureString = token + ':' + values.join(':');
    const md5 = createHash('md5').update(signatureString).digest('hex');

    console.log(`🔐 [Signature] String length: ${signatureString.length} → MD5: ${md5}`);

    return md5;
}
