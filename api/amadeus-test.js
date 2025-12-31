// api/amadeus-test.js - Endpoint de TESTE para Amadeus API
// Rota: /api/amadeus-test

const https = require('https');

// Configuração
const BASE_URL = process.env.AMADEUS_ENV === 'production' 
    ? 'api.amadeus.com' 
    : 'test.api.amadeus.com';

// Cache do token
let cachedToken = null;
let tokenExpiry = null;

/**
 * Fazer requisição HTTPS (sem axios)
 */
function httpsRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        reject({ status: res.statusCode, data: parsed });
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    reject({ status: res.statusCode, data: data });
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        if (postData) req.write(postData);
        req.end();
    });
}

/**
 * Obter token de acesso da Amadeus
 */
async function getToken() {
    // Usar cache se válido
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        console.log('♻️ Usando token em cache');
        return cachedToken;
    }

    const apiKey = process.env.Amadeus_test_apikey;
    const apiSecret = process.env.Amadeus_test_apisecret;

    if (!apiKey || !apiSecret) {
        throw new Error('Amadeus_test_apikey ou Amadeus_test_apisecret não configurados. Configure no Vercel: Settings → Environment Variables');
    }

    console.log('🔑 Obtendo novo token Amadeus...');

    const postData = `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`;

    const response = await httpsRequest({
        hostname: BASE_URL,
        path: '/v1/security/oauth2/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    cachedToken = response.access_token;
    tokenExpiry = Date.now() + (response.expires_in * 1000) - 60000; // 1 min margem

    console.log('✅ Token obtido com sucesso');
    return cachedToken;
}

/**
 * Buscar destinos na API Flight Inspiration Search
 */
async function buscarDestinos(origin, departureDate, returnDate, maxPrice = null) {
    const token = await getToken();

    // Calcular duração da viagem em dias
    const dataIda = new Date(departureDate);
    const dataVolta = new Date(returnDate);
    const duracaoDias = Math.ceil((dataVolta - dataIda) / (1000 * 60 * 60 * 24));

    // Montar query string - formato correto da Amadeus
    let queryParams = `origin=${origin}&oneWay=false&nonStop=false&viewBy=DESTINATION`;
    
    // Amadeus espera apenas departureDate com range ou data única
    // e duration para round-trip
    queryParams += `&departureDate=${departureDate}`;
    
    if (duracaoDias > 0 && duracaoDias <= 15) {
        queryParams += `&duration=${duracaoDias}`;
    }
    
    if (maxPrice && maxPrice > 0) {
        queryParams += `&maxPrice=${Math.floor(maxPrice)}`;
    }

    console.log(`🔍 Buscando: ${origin}, partida: ${departureDate}, duração: ${duracaoDias} dias, max: ${maxPrice || 'sem limite'}`);
    console.log(`📡 URL: /v1/shopping/flight-destinations?${queryParams}`);

    const response = await httpsRequest({
        hostname: BASE_URL,
        path: `/v1/shopping/flight-destinations?${queryParams}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    return response;
}

/**
 * Handler principal
 */
module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Use POST' });
    }

    try {
        console.log('🚀 === TESTE AMADEUS API ===');
        console.log('Body recebido:', JSON.stringify(req.body));

        const { origin, departureDate, returnDate, maxPrice } = req.body || {};

        // Validações
        if (!origin || !departureDate || !returnDate) {
            return res.status(400).json({ 
                error: 'Parâmetros obrigatórios: origin, departureDate, returnDate',
                received: { origin, departureDate, returnDate }
            });
        }

        const originCode = origin.toUpperCase().trim();
        if (!/^[A-Z]{3}$/.test(originCode)) {
            return res.status(400).json({ 
                error: 'Código IATA inválido. Use 3 letras (ex: GRU, JFK)',
                received: origin
            });
        }

        // Buscar destinos
        const rawData = await buscarDestinos(originCode, departureDate, returnDate, maxPrice);

        // Processar resposta
        const destinations = (rawData.data || []).map(d => ({
            iataCode: d.destination,
            cityName: rawData.dictionaries?.locations?.[d.destination]?.detailedName || d.destination,
            price: parseFloat(d.price.total),
            currency: rawData.meta?.currency || 'EUR',
            departureDate: d.departureDate,
            returnDate: d.returnDate
        }));

        // Ordenar por preço
        destinations.sort((a, b) => a.price - b.price);

        console.log(`✅ Encontrados ${destinations.length} destinos`);

        return res.status(200).json({
            success: true,
            count: destinations.length,
            currency: rawData.meta?.currency || 'EUR',
            origin: originCode,
            searchDates: `${departureDate} - ${returnDate}`,
            maxPriceUsed: maxPrice || null,
            destinations: destinations,
            raw: {
                meta: rawData.meta,
                dictionaries: rawData.dictionaries
            }
        });

    } catch (error) {
        console.error('❌ Erro completo:', JSON.stringify(error, null, 2));

        // Erros específicos da Amadeus
        if (error.data?.errors) {
            const amadeusError = error.data.errors[0];
            console.error('❌ Erro Amadeus:', JSON.stringify(amadeusError, null, 2));
            return res.status(error.status || 400).json({
                error: amadeusError.detail || amadeusError.title || 'Erro na API Amadeus',
                code: amadeusError.code,
                source: amadeusError.source,
                fullError: amadeusError
            });
        }

        return res.status(500).json({
            error: error.message || 'Erro interno do servidor',
            details: JSON.stringify(error)
        });
    }
};
