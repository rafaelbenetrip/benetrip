/**
 * Vercel Serverless Function - Buscar Destinos
 * Endpoint: /api/search-destinations
 * Integração: SearchAPI Google Travel Explore
 */

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { origem, dataIda, dataVolta } = req.body;

    // Validação básica
    if (!origem || !dataIda || !dataVolta) {
        return res.status(400).json({ 
            error: 'Parâmetros inválidos',
            required: ['origem', 'dataIda', 'dataVolta']
        });
    }

    try {
        console.log(`🔍 Buscando destinos de ${origem} entre ${dataIda} e ${dataVolta}`);

        // Chamar SearchAPI Google Travel Explore
        const searchParams = new URLSearchParams({
            engine: 'google_travel_explore',
            departure_id: origem,
            gl: 'br',
            hl: 'pt-BR',
            currency: 'BRL',
            api_key: process.env.SEARCHAPI_KEY
        });

        const response = await fetch(
            `https://www.searchapi.io/api/v1/search?${searchParams.toString()}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`SearchAPI retornou erro: ${response.status}`);
        }

        const data = await response.json();

        // Verificar se temos destinos
        if (!data.destinations || data.destinations.length === 0) {
            return res.status(404).json({ 
                error: 'Nenhum destino encontrado',
                message: 'Tente aumentar o orçamento ou mudar as datas'
            });
        }

        console.log(`✅ ${data.destinations.length} destinos encontrados`);

        // Retornar destinos
        return res.status(200).json({
            success: true,
            count: data.destinations.length,
            destinations: data.destinations
        });

    } catch (error) {
        console.error('❌ Erro ao buscar destinos:', error);
        
        return res.status(500).json({ 
            error: 'Erro ao buscar destinos',
            message: error.message,
            // Em produção, remover detalhes do erro
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
}
