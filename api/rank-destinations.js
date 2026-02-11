/**
 * Vercel Function - Ranquear Destinos com IA
 * Endpoint: /api/rank-destinations
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

    const { destinos, preferencias, orcamento } = req.body;

    // Validação
    if (!destinos || !Array.isArray(destinos) || destinos.length === 0) {
        return res.status(400).json({ 
            error: 'Lista de destinos inválida',
            received: typeof destinos
        });
    }

    if (!preferencias) {
        return res.status(400).json({ error: 'Preferências não fornecidas' });
    }

    // Verificar API key
    if (!process.env.GROQ_API_KEY) {
        console.error('❌ GROQ_API_KEY não configurada');
        return res.status(500).json({ 
            error: 'Groq AI não configurada',
            message: 'Configure GROQ_API_KEY nas variáveis de ambiente do Vercel'
        });
    }

    try {
        console.log(`🤖 Ranqueando ${destinos.length} destinos - preferência: ${preferencias}`);

        // Mapear preferências para descrições
        const preferenciaDescricao = {
            'relax': 'relaxamento, praias tranquilas, descanso, spa, tranquilidade',
            'aventura': 'adrenalina, esportes radicais, trilhas, atividades ao ar livre',
            'cultura': 'história, museus, gastronomia, tradições, patrimônio',
            'urbano': 'vida noturna, restaurantes, bares, compras, cosmopolita'
        }[preferencias] || preferencias;

        // Construir prompt
        const prompt = `Você é especialista em turismo brasileiro.

PREFERÊNCIA DO USUÁRIO: ${preferenciaDescricao}
ORÇAMENTO TOTAL: R$ ${orcamento || 'flexível'}

DESTINOS DISPONÍVEIS:
${destinos.map((d, i) => `${i + 1}. ${d.name} - Voo: R$${d.flight?.price}, Hospedagem/noite: R$${d.avg_cost_per_night}`).join('\n')}

TAREFA:
Selecione e retorne JSON com esta estrutura EXATA:

{
  "top_destino": {
    "name": "nome do destino",
    "primary_airport": "código IATA",
    "flight": { "price": número, "airport_code": "código" },
    "avg_cost_per_night": número,
    "razao": "Por que é perfeito para ${preferencias} (1 frase)"
  },
  "alternativas": [
    { ...mesmo formato acima... },
    { ...mesmo formato... },
    { ...mesmo formato... }
  ],
  "surpresa": {
    ...mesmo formato...
  }
}

REGRAS:
- top_destino: Melhor match com preferências + custo-benefício
- alternativas: 3 opções diferentes e variadas
- surpresa: Destino inesperado mas interessante
- Use APENAS destinos da lista fornecida
- Copie os dados EXATAMENTE (primary_airport, flight.price, etc)
- NÃO invente dados

RETORNE APENAS JSON VÁLIDO, SEM TEXTO ADICIONAL.`;

        console.log('📡 Chamando Groq AI...');

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: 'Você é um assistente que retorna APENAS JSON válido, sem texto adicional.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.5,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Groq erro:', response.status, errorText);
            throw new Error(`Groq retornou ${response.status}`);
        }

        const data = await response.json();
        
        // Extrair JSON
        const content = data.choices[0].message.content;
        console.log('📄 Resposta Groq:', content.substring(0, 200) + '...');

        let ranking;
        try {
            ranking = JSON.parse(content);
        } catch (e) {
            console.error('❌ JSON inválido:', content);
            throw new Error('IA retornou JSON inválido');
        }

        // Validar estrutura
        if (!ranking.top_destino || !ranking.top_destino.name) {
            throw new Error('Ranking sem top_destino válido');
        }

        if (!Array.isArray(ranking.alternativas) || ranking.alternativas.length === 0) {
            throw new Error('Ranking sem alternativas válidas');
        }

        if (!ranking.surpresa || !ranking.surpresa.name) {
            throw new Error('Ranking sem surpresa válida');
        }

        // Garantir que todos os destinos têm os campos necessários
        const validarDestino = (d) => ({
            name: d.name,
            primary_airport: d.primary_airport || d.flight?.airport_code || 'XXX',
            flight: {
                airport_code: d.flight?.airport_code || d.primary_airport || 'XXX',
                price: d.flight?.price || 0,
                stops: d.flight?.stops || 0,
                flight_duration_minutes: d.flight?.flight_duration_minutes || 0
            },
            avg_cost_per_night: d.avg_cost_per_night || 150,
            razao: d.razao || 'Destino recomendado para você.'
        });

        const resultado = {
            success: true,
            top_destino: validarDestino(ranking.top_destino),
            alternativas: ranking.alternativas.slice(0, 3).map(validarDestino),
            surpresa: validarDestino(ranking.surpresa)
        };

        console.log(`✅ Ranking gerado: ${resultado.top_destino.name}, ${resultado.alternativas.map(a => a.name).join(', ')}, ${resultado.surpresa.name}`);

        return res.status(200).json(resultado);

    } catch (error) {
        console.error('❌ Erro ao ranquear:', error);
        return res.status(500).json({ 
            error: 'Erro ao ranquear destinos',
            message: error.message
        });
    }
}
