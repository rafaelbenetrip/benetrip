// api/amadeus/test.js - Endpoint de TESTE para Amadeus API
// Versão simples para validar integração

const axios = require('axios');

// Configuração
const CONFIG = {
    baseURL: process.env.AMADEUS_ENV === 'production' 
        ? 'https://api.amadeus.com' 
        : 'https://test.api.amadeus.com',
    timeout: 30000
};

// Cache do token
let cachedToken = null;
let tokenExpiry = null;

/**
 * Obter token de acesso da Amadeus
 */
async function getToken() {
    // Usar cache se válido
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        console.log('♻️ Usando token em cache');
        return cachedToken;
    }

    const apiKey = process.env.AMADEUS_API_KEY;
    const apiSecret = process.env.AMADEUS_API_SECRET;

    if (!apiKey || !apiSecret) {
        throw new Error('AMADEUS_API_KEY ou AMADEUS_API_SECRET não configurados');
    }

    console.log('🔑 Obtendo novo token Amadeus...');

    const response = await axios.post(
        `${CONFIG.baseURL}/v1/security/oauth2/token`,
        new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: apiKey,
            client_secret: apiSecret
        }),
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: CONFIG.timeout
        }
    );

    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 min margem

    console.log('✅ Token obtido com sucesso');
    return cachedToken;
}

/**
 * Buscar destinos na API Flight Inspiration Search
 */
async function buscarDestinos(origin, departureDate, returnDate, maxPrice = null) {
    const token = await getToken();

    // Montar parâmetros
    const params = new URLSearchParams({
        origin: origin,
        departureDate: `${departureDate},${returnDate}`,
        oneWay: 'false',
        nonStop: 'false',
        viewBy: 'DESTINATION'
    });

    // Adicionar maxPrice se informado
    if (maxPrice && maxPrice > 0) {
        params.append('maxPrice', Math.floor(maxPrice));
    }

    console.log(`🔍 Buscando destinos: ${origin}, ${departureDate} - ${returnDate}, maxPrice: ${maxPrice || 'sem limite'}`);

    const response = await axios.get(
        `${CONFIG.baseURL}/v1/shopping/flight-destinations?${params}`,
        {
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: CONFIG.timeout
        }
    );

    return response.data;
}

/**
 * Handler principal
 */
module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        console.log('🚀 === TESTE AMADEUS API ===');

        const { origin, departureDate, returnDate, maxPrice } = req.body;

        // Validações
        if (!origin || !departureDate || !returnDate) {
            return res.status(400).json({ 
                error: 'Parâmetros obrigatórios: origin, departureDate, returnDate' 
            });
        }

        if (!/^[A-Z]{3}$/.test(origin.toUpperCase())) {
            return res.status(400).json({ 
                error: 'Código IATA inválido. Use 3 letras maiúsculas (ex: GRU, JFK)' 
            });
        }

        // Buscar destinos
        const rawData = await buscarDestinos(
            origin.toUpperCase(),
            departureDate,
            returnDate,
            maxPrice
        );

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
            origin: origin.toUpperCase(),
            searchDates: `${departureDate} - ${returnDate}`,
            maxPriceUsed: maxPrice || null,
            destinations: destinations,
            raw: {
                meta: rawData.meta,
                dictionaries: rawData.dictionaries
            }
        });

    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);

        // Erros específicos da Amadeus
        if (error.response?.data?.errors) {
            const amadeusError = error.response.data.errors[0];
            return res.status(400).json({
                error: amadeusError.detail || amadeusError.title || 'Erro na API Amadeus',
                code: amadeusError.code,
                source: amadeusError.source
            });
        }

        return res.status(500).json({
            error: error.message || 'Erro interno do servidor'
        });
    }
};
