// api/search-destinations.js - FOCO EM PASSAGENS
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { origem } = req.body;

    if (!origem) {
        return res.status(400).json({ error: 'Origem obrigatória' });
    }

    if (!process.env.SEARCHAPI_KEY) {
        return res.status(500).json({ error: 'SEARCHAPI_KEY não configurada' });
    }

    try {
        console.log(`🔍 Buscando voos de ${origem}...`);

        const searchParams = new URLSearchParams({
            engine: 'google_travel_explore',
            departure_id: origem,
            arrival_id: '/m/02j71', // Mundo
            time_period: 'one_week_trip_in_the_next_six_months',
            travel_mode: 'all',
            adults: '1',
            children: '0',
            infants_in_seat: '0',
            infants_on_lap: '0',
            travel_class: 'economy',
            interests: 'popular',
            stops: 'any',
            currency: 'BRL',
            hl: 'pt-BR',
            gl: 'BR',
            api_key: process.env.SEARCHAPI_KEY
        });

        const searchResponse = await fetch(`https://www.searchapi.io/api/v1/search?${searchParams}`);
        
        if (!searchResponse.ok) {
            throw new Error(`SearchAPI retornou ${searchResponse.status}`);
        }

        const data = await searchResponse.json();
        
        if (!data.destinations || !Array.isArray(data.destinations)) {
            throw new Error('SearchAPI não retornou destinos válidos');
        }

        // LIMPAR E VALIDAR - APENAS PASSAGENS
        const destinosLimpos = data.destinations
            .filter(d => {
                // OBRIGATÓRIO: nome, aeroporto, país, voo com preço
                return d.name && 
                       d.primary_airport && 
                       d.country && 
                       d.flight && 
                       d.flight.price > 0;
            })
            .map((d, index) => {
                // Estrutura MINIMALISTA - só o essencial
                const destino = {
                    id: index + 1, // ID sequencial
                    name: d.name,
                    primary_airport: d.primary_airport,
                    country: d.country,
                    
                    // VOOS - dados exatos
                    flight_price: d.flight.price,
                    flight_airport: d.flight.airport_code,
                    flight_stops: d.flight.stops,
                    flight_duration: d.flight.flight_duration,
                    airline: d.flight.airline_name,
                    
                    // DATAS - fundamentais
                    outbound_date: d.outbound_date,
                    return_date: d.return_date,
                    
                    // OPCIONAL: data alternativa
                    ...(d.alternative_outbound_date && {
                        alternative_outbound_date: d.alternative_outbound_date
                    })
                };

                return destino;
            });

        console.log(`✅ ${destinosLimpos.length} destinos processados (apenas voos)`);
        
        // Log de exemplo
        if (destinosLimpos.length > 0) {
            console.log('Exemplo:', {
                destino: destinosLimpos[0].name,
                voo: `R$ ${destinosLimpos[0].flight_price}`,
                datas: `${destinosLimpos[0].outbound_date} → ${destinosLimpos[0].return_date}`
            });
        }

        return res.status(200).json({
            origem,
            total_destinos: destinosLimpos.length,
            destinations: destinosLimpos
        });

    } catch (erro) {
        console.error('❌ Erro SearchAPI:', erro);
        return res.status(500).json({ 
            error: 'Erro ao buscar destinos',
            message: erro.message
        });
    }
}
