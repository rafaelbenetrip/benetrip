// api/amadeus-test.js - Endpoint de TESTE para Amadeus API
// Baseado na documentação oficial: Flight Inspiration Search

const https = require('https');

// O ambiente TEST só tem dados para certas origens!
// Ver: https://github.com/amadeus4dev/data-collection
const ORIGENS_TESTE_CONHECIDAS = ['MAD', 'NYC', 'LON', 'PAR', 'BCN', 'FCO', 'MIA', 'LAX', 'SFO'];

const BASE_URL = process.env.AMADEUS_ENV === 'production' 
    ? 'api.amadeus.com' 
    : 'test.api.amadeus.com';

// Cache do token
let cachedToken = null;
let tokenExpiry = null;

/**
 * Fazer requisição HTTPS
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
 * Obter token OAuth2
 */
async function getToken() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        console.log('♻️ Token em cache');
        return cachedToken;
    }

    const apiKey = process.env.Amadeus_test_apikey;
    const apiSecret = process.env.Amadeus_test_apisecret;

    if (!apiKey || !apiSecret) {
        throw new Error('Credenciais Amadeus não configuradas');
    }

    console.log('🔑 Obtendo token...');
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
    tokenExpiry = Date.now() + (response.expires_in * 1000) - 60000;
    console.log('✅ Token OK');
    return cachedToken;
}

/**
 * Buscar destinos - formato SIMPLIFICADO seguindo documentação
 * 
 * Documentação: GET /v1/shopping/flight-destinations
 * - origin: OBRIGATÓRIO (IATA 3 letras)
 * - departureDate: OPCIONAL (YYYY-MM-DD ou range YYYY-MM-DD,YYYY-MM-DD)
 * - duration: OPCIONAL (1-15 dias, ou range 2,8)
 * - maxPrice: OPCIONAL (inteiro positivo)
 * - viewBy: OPCIONAL (DESTINATION, DATE, DURATION, WEEK, COUNTRY)
 */
async function buscarDestinos(params) {
    const token = await getToken();
    
    // Montar query - começando só com o obrigatório
    const queryParts = [`origin=${params.origin}`];
    
    // Adicionar opcionais se informados
    if (params.departureDate) {
        queryParts.push(`departureDate=${params.departureDate}`);
    }
    
    if (params.duration) {
        queryParts.push(`duration=${params.duration}`);
    }
    
    if (params.maxPrice && params.maxPrice > 0) {
        queryParts.push(`maxPrice=${Math.floor(params.maxPrice)}`);
    }
    
    // viewBy=DESTINATION agrupa por destino (mais útil para nós)
    queryParts.push('viewBy=DESTINATION');
    
    const queryString = queryParts.join('&');
    const path = `/v1/shopping/flight-destinations?${queryString}`;
    
    console.log(`📡 GET ${path}`);

    return await httpsRequest({
        hostname: BASE_URL,
        path: path,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });
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

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

    try {
        console.log('\n🚀 === TESTE AMADEUS ===');
        
        const body = req.body || {};
        const origin = (body.origin || '').toUpperCase().trim();
        
        // Validação básica
        if (!origin || !/^[A-Z]{3}$/.test(origin)) {
            return res.status(400).json({ 
                error: 'Origin inválido. Use código IATA de 3 letras.',
                exemplo: 'MAD, NYC, LON, PAR'
            });
        }
        
        // Aviso sobre ambiente de teste
        const isOrigemConhecida = ORIGENS_TESTE_CONHECIDAS.includes(origin);
        if (!isOrigemConhecida) {
            console.log(`⚠️ AVISO: ${origin} pode não ter dados no ambiente TEST`);
        }
        
        // Montar parâmetros
        const params = { origin };
        
        // Se informou datas, criar range de departureDate
        if (body.departureDate) {
            if (body.returnDate) {
                // Range: ida,volta
                params.departureDate = `${body.departureDate},${body.returnDate}`;
            } else {
                params.departureDate = body.departureDate;
            }
        }
        
        // Duration (1-15 dias)
        if (body.duration) {
            params.duration = body.duration;
        }
        
        // Max price
        if (body.maxPrice) {
            params.maxPrice = body.maxPrice;
        }
        
        console.log('📋 Params:', JSON.stringify(params));
        
        // Buscar
        const rawData = await buscarDestinos(params);
        
        // Processar resposta
        const destinations = (rawData.data || []).map(d => ({
            iataCode: d.destination,
            cityName: rawData.dictionaries?.locations?.[d.destination]?.detailedName || d.destination,
            subType: rawData.dictionaries?.locations?.[d.destination]?.subType,
            price: parseFloat(d.price.total),
            departureDate: d.departureDate,
            returnDate: d.returnDate,
            links: d.links
        }));

        destinations.sort((a, b) => a.price - b.price);

        console.log(`✅ ${destinations.length} destinos encontrados`);

        return res.status(200).json({
            success: true,
            ambiente: process.env.AMADEUS_ENV || 'test',
            avisoTeste: !isOrigemConhecida ? 
                `⚠️ ${origin} pode ter dados limitados no ambiente TEST. Origens conhecidas: ${ORIGENS_TESTE_CONHECIDAS.join(', ')}` : 
                null,
            origin,
            count: destinations.length,
            currency: rawData.meta?.currency || 'EUR',
            destinations,
            meta: rawData.meta,
            dictionaries: rawData.dictionaries
        });

    } catch (error) {
        console.error('❌ ERRO:', JSON.stringify(error, null, 2));
        
        const amadeusError = error.data?.errors?.[0];
        
        if (amadeusError) {
            // Erro 500 da Amadeus geralmente = origem sem dados no teste
            if (amadeusError.code === 141) {
                return res.status(400).json({
                    error: 'Erro no servidor Amadeus. Provável causa: origem sem dados no ambiente TEST.',
                    sugestao: `Tente com origens conhecidas: ${ORIGENS_TESTE_CONHECIDAS.join(', ')}`,
                    detalhes: amadeusError
                });
            }
            
            return res.status(error.status || 400).json({
                error: amadeusError.detail || amadeusError.title,
                code: amadeusError.code,
                detalhes: amadeusError
            });
        }

        return res.status(500).json({
            error: error.message || 'Erro interno',
            detalhes: JSON.stringify(error)
        });
    }
};
