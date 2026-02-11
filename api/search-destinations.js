/**
 * Vercel Function - Buscar Destinos
 * Endpoint: /api/search-destinations
 */

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { origem, dataIda, dataVolta } = req.body;

    // Validação
    if (!origem) {
        return res.status(400).json({ error: 'Origem é obrigatória' });
    }

    // Verificar se API key existe
    if (!process.env.SEARCHAPI_KEY) {
        console.error('❌ SEARCHAPI_KEY não configurada');
        return res.status(500).json({ 
            error: 'SearchAPI não configurada',
            message: 'Configure SEARCHAPI_KEY nas variáveis de ambiente do Vercel'
        });
    }

    try {
        console.log(`🔍 Buscando destinos de ${origem}`);

        // Construir URL com parâmetros
        const params = new URLSearchParams({
            engine: 'google_travel_explore',
            departure_id: origem,
            gl: 'br',
            hl: 'pt-BR',
            currency: 'BRL',
            api_key: process.env.SEARCHAPI_KEY
        });

        const url = `https://www.searchapi.io/api/v1/search?${params.toString()}`;
        
        console.log('📡 Chamando SearchAPI...');
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ SearchAPI erro:', response.status, errorText);
            throw new Error(`SearchAPI retornou ${response.status}`);
        }

        const data = await response.json();

        // Verificar se retornou destinos
        if (!data.destinations || data.destinations.length === 0) {
            console.warn('⚠️ Nenhum destino encontrado');
            return res.status(404).json({ 
                error: 'Nenhum destino encontrado',
                message: 'Tente outra cidade de origem ou aumente o orçamento'
            });
        }

        console.log(`✅ ${data.destinations.length} destinos encontrados`);

        // Retornar apenas os campos necessários
        const destinosLimpos = data.destinations.map(d => ({
            name: d.name,
            primary_airport: d.primary_airport,
            country: d.country,
            flight: {
                airport_code: d.flight?.airport_code || d.primary_airport,
                price: d.flight?.price || 0,
                stops: d.flight?.stops || 0,
                flight_duration_minutes: d.flight?.flight_duration_minutes || 0
            },
            avg_cost_per_night: d.avg_cost_per_night || 150
        }));

        return res.status(200).json({
            success: true,
            count: destinosLimpos.length,
            destinations: destinosLimpos
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        return res.status(500).json({ 
            error: 'Erro ao buscar destinos',
            message: error.message
        });
    }
}
