// api/search-destinations.js
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Apenas POST' });
    }

    try {
        const { origem } = req.body;

        // Validar origem
        if (!origem || typeof origem !== 'string') {
            return res.status(400).json({ 
                error: 'Origem obrigatória',
                exemplo: { origem: 'GRU' }
            });
        }

        // Validar código IATA (3 letras maiúsculas)
        const origemCode = origem.toUpperCase().trim();
        if (!/^[A-Z]{3}$/.test(origemCode)) {
            return res.status(400).json({ 
                error: 'Código IATA inválido',
                message: 'Use 3 letras (ex: GRU, GIG, SSA)'
            });
        }

        // Verificar API key
        if (!process.env.SEARCHAPI_KEY) {
            console.error('❌ SEARCHAPI_KEY não configurada');
            return res.status(500).json({ 
                error: 'SEARCHAPI_KEY não configurada',
                message: 'Configure em Vercel → Settings → Environment Variables'
            });
        }

        console.log(`🔍 Buscando destinos de ${origemCode}`);

        // Chamar SearchAPI
        const params = new URLSearchParams({
            engine: 'google_travel_explore',
            departure_id: origemCode,
            gl: 'br',
            hl: 'pt-BR',
            currency: 'BRL',
            api_key: process.env.SEARCHAPI_KEY
        });

        const url = `https://www.searchapi.io/api/v1/search?${params}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('SearchAPI erro:', response.status, errorText);
            throw new Error(`SearchAPI retornou ${response.status}`);
        }

        const data = await response.json();

        // Validar resposta
        if (!data.destinations || !Array.isArray(data.destinations)) {
            console.error('Resposta inválida:', data);
            return res.status(404).json({ 
                error: 'Nenhum destino encontrado',
                message: 'Tente outra cidade de origem'
            });
        }

        if (data.destinations.length === 0) {
            return res.status(404).json({ 
                error: 'Nenhum destino disponível',
                message: 'Nenhum voo encontrado para esta origem'
            });
        }

        console.log(`✅ ${data.destinations.length} destinos encontrados`);

        // Retornar apenas os campos necessários
        const destinos = data.destinations.map(d => ({
            name: d.name,
            primary_airport: d.primary_airport,
            country: d.country,
            coordinates: d.coordinates,
            image: d.image,
            flight: {
                airport_code: d.flight?.airport_code || d.primary_airport,
                price: d.flight?.price || 0,
                stops: d.flight?.stops || 0,
                flight_duration_minutes: d.flight?.flight_duration_minutes || 0,
                airline_name: d.flight?.airline_name || ''
            },
            avg_cost_per_night: d.avg_cost_per_night || 0,
            outbound_date: d.outbound_date,
            return_date: d.return_date
        }));

        return res.status(200).json({ 
            success: true,
            origem: origemCode,
            total: destinos.length,
            destinations: destinos
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        return res.status(500).json({ 
            error: 'Erro ao buscar destinos',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
