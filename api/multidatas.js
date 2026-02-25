// api/multidatas.js - BENETRIP BUSCA MULTIDATAS v1.0
import { maxDuration } from './search-destinations.js'; // Reaproveitando limite da Vercel (60s)

export { maxDuration };

async function searchGoogleFlights(params, comboLabel) {
    const url = new URL('https://www.searchapi.io/api/v1/search');
    const fullParams = {
        engine: 'google_flights',
        api_key: process.env.SEARCHAPI_KEY,
        hl: 'pt-BR',
        gl: 'br',
        type: '1', // Round trip
        ...params,
    };

    Object.entries(fullParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });

    try {
        const response = await fetch(url.toString(), { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (!response.ok) return { error: `HTTP ${response.status}` };
        const data = await response.json();
        
        // Pega o melhor voo ou primeiro de outros voos
        const flights = data.best_flights || data.other_flights || [];
        return { data: flights, insights: data.price_insights || null };
    } catch (err) {
        return { error: err.message };
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    try {
        const { origem, destino, idas, voltas, adultos, criancas, bebes, moeda } = req.body;

        if (!origem || !destino || !idas?.length || !voltas?.length) {
            return res.status(400).json({ error: 'Parâmetros incompletos' });
        }

        // Montar combinações válidas (volta > ida)
        const combinacoes = [];
        idas.forEach(ida => {
            voltas.forEach(volta => {
                if (new Date(volta) > new Date(ida)) {
                    combinacoes.push({ ida, volta });
                }
            });
        });

        const searchPromises = combinacoes.map(combo => {
            return searchGoogleFlights({
                departure_id: origem,
                arrival_id: destino,
                outbound_date: combo.ida,
                return_date: combo.volta,
                currency: moeda || 'BRL',
                adults: adultos || 1,
                children: criancas || 0,
                infants_on_lap: bebes || 0
            }, `${combo.ida}_${combo.volta}`).then(result => ({ combo, ...result }));
        });

        // Buscar em paralelo
        const results = await Promise.all(searchPromises);

        const matriz = {};
        const todosVoos = [];

        results.forEach(({ combo, data, insights, error }) => {
            const key = `${combo.ida}_${combo.volta}`;
            if (error || !data || data.length === 0) {
                matriz[key] = { price: null, status: 'indisponivel' };
                return;
            }

            const melhorVoo = data[0]; // Extrair a melhor opção
            matriz[key] = {
                price: melhorVoo.price,
                duration: melhorVoo.total_duration,
                stops: (melhorVoo.flights || []).reduce((acc, f) => acc + (f.stops || 0), 0)
            };

            todosVoos.push({
                combo,
                id: key,
                price: melhorVoo.price,
                duration: melhorVoo.total_duration,
                carbon: melhorVoo.carbon_emissions?.this_flight || null,
                legs: melhorVoo.flights || [],
                airline: melhorVoo.flights[0]?.airline || '',
                airline_logo: melhorVoo.flights[0]?.airline_logo || '',
                insights
            });
        });

        // Ordenar voos por preço
        todosVoos.sort((a, b) => a.price - b.price);

        return res.status(200).json({
            success: true,
            matriz,
            voos: todosVoos,
            combinacoesPesquisadas: combinacoes.length
        });

    } catch (error) {
        console.error('❌ Erro API Multidatas:', error);
        return res.status(500).json({ error: 'Erro interno', message: error.message });
    }
}
