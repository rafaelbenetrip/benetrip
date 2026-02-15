// api/flight-click.js - Benetrip Flight Booking Link
// Gera link de reserva quando o usuário clica em "Reservar"
// IMPORTANTE: Este endpoint só deve ser chamado mediante ação do usuário
// (requisito da API Travelpayouts - coleta automática de links é proibida)
// v1.0

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const MARKER = process.env.AVIASALES_MARKER;

    if (!MARKER) {
        return res.status(500).json({ error: 'AVIASALES_MARKER não configurado' });
    }

    try {
        const { search_id, terms_url } = req.body;

        if (!search_id || !terms_url) {
            return res.status(400).json({
                error: 'Parâmetros obrigatórios: search_id, terms_url'
            });
        }

        // Montar URL do click
        const clickUrl = `https://api.travelpayouts.com/v1/flight_searches/${search_id}/clicks/${terms_url}.json?marker=${MARKER}`;

        console.log(`🔗 [FlightClick] search=${search_id.substring(0, 8)}... terms=${terms_url}`);

        const response = await fetch(clickUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ [FlightClick] HTTP ${response.status}:`, errorText);
            return res.status(response.status).json({
                error: 'Erro ao gerar link de reserva',
                status: response.status,
                detail: errorText
            });
        }

        const data = await response.json();

        console.log(`✅ [FlightClick] gate=${data.gate_id} method=${data.method}`);

        // Retornar dados para o frontend montar o redirect
        return res.status(200).json({
            success: true,
            url: data.url,
            method: data.method || 'GET',
            params: data.params || {},
            gate_id: data.gate_id,
            click_id: data.str_click_id || data.click_id
        });

    } catch (error) {
        console.error('❌ [FlightClick] Erro:', error.message);
        return res.status(500).json({
            error: 'Erro ao gerar link',
            message: error.message
        });
    }
}
