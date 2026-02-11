/**
 * Vercel Serverless Function - Ranquear Destinos
 * Endpoint: /api/rank-destinations
 * Integração: Groq AI (Llama 3.3 70B)
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

    const { destinos, preferencias, orcamento } = req.body;

    // Validação básica
    if (!destinos || !Array.isArray(destinos) || destinos.length === 0) {
        return res.status(400).json({ 
            error: 'Lista de destinos inválida ou vazia'
        });
    }

    if (!preferencias) {
        return res.status(400).json({ 
            error: 'Preferências não fornecidas'
        });
    }

    try {
        console.log(`🤖 Ranqueando ${destinos.length} destinos com preferência: ${preferencias}`);

        // Mapear preferências para descrições
        const preferenciasMap = {
            'relax': 'relaxamento total, praias tranquilas, resorts, spa, descanso',
            'aventura': 'emoção, adrenalina, esportes radicais, trilhas, atividades ao ar livre',
            'cultura': 'história, museus, gastronomia local, tradições, patrimônio cultural',
            'urbano': 'vida noturna, restaurantes, bares, compras, agito cosmopolita'
        };

        const descricaoPreferencia = preferenciasMap[preferencias] || preferencias;

        // Construir prompt para Groq
        const prompt = `Você é um assistente de viagens especializado em Brasil.

USUÁRIO BUSCA: ${descricaoPreferencia}
ORÇAMENTO MÁXIMO: R$ ${orcamento || 'não especificado'}

DESTINOS DISPONÍVEIS:
${JSON.stringify(destinos.map(d => ({
    nome: d.name,
    aeroporto: d.primary_airport,
    preco_voo: d.flight?.price,
    preco_hospedagem_noite: d.avg_cost_per_night,
    duracao_voo_min: d.flight?.flight_duration_minutes
})), null, 2)}

TAREFA:
Selecione e ranqueie os destinos da seguinte forma:

1. **top_destino**: O MELHOR destino considerando:
   - Match perfeito com as preferências do usuário
   - Melhor custo-benefício
   - Experiência memorável

2. **alternativas**: 3 destinos alternativos variados que também combinam com as preferências

3. **surpresa**: 1 destino INESPERADO mas interessante (pode ter perfil diferente mas oferece algo único)

Para cada destino, adicione:
- "razao": Por que esse destino é bom para o que o usuário busca (1-2 frases diretas)

RETORNE APENAS JSON VÁLIDO neste formato exato:
{
  "top_destino": {
    "name": "nome",
    "primary_airport": "código",
    "flight": {...},
    "avg_cost_per_night": número,
    "razao": "explicação"
  },
  "alternativas": [
    { ... mesmo formato ... },
    { ... },
    { ... }
  ],
  "surpresa": {
    ... mesmo formato ...
  }
}

IMPORTANTE: Retorne SOMENTE o JSON, sem texto adicional.`;

        // Chamar Groq API
        const response = await fetch(
            'https://api.groq.com/openai/v1/chat/completions',
            {
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
                            content: 'Você é um especialista em viagens pelo Brasil. Retorne sempre JSON válido.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.7,
                    max_tokens: 2000
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Groq API retornou erro: ${response.status}`);
        }

        const data = await response.json();

        // Extrair JSON da resposta
        const content = data.choices[0].message.content;
        let ranking;

        try {
            ranking = JSON.parse(content);
        } catch (parseError) {
            console.error('❌ Erro ao parsear JSON:', content);
            throw new Error('Resposta da IA não está em formato JSON válido');
        }

        // Validar estrutura
        if (!ranking.top_destino || !ranking.alternativas || !ranking.surpresa) {
            throw new Error('Ranking da IA está incompleto');
        }

        // Garantir que alternativas é um array de 3 itens
        if (!Array.isArray(ranking.alternativas)) {
            ranking.alternativas = [];
        }

        // Preencher com destinos originais se necessário
        while (ranking.alternativas.length < 3 && destinos.length > 0) {
            const destinoExtra = destinos.find(d => 
                d.name !== ranking.top_destino.name &&
                !ranking.alternativas.some(alt => alt.name === d.name) &&
                d.name !== ranking.surpresa?.name
            );
            
            if (destinoExtra) {
                ranking.alternativas.push({
                    ...destinoExtra,
                    razao: 'Opção alternativa interessante para sua viagem.'
                });
            } else {
                break;
            }
        }

        console.log(`✅ Ranking gerado: Top=${ranking.top_destino.name}, Alt=${ranking.alternativas.map(a => a.name).join(', ')}, Surpresa=${ranking.surpresa.name}`);

        return res.status(200).json({
            success: true,
            ...ranking
        });

    } catch (error) {
        console.error('❌ Erro ao ranquear destinos:', error);
        
        // Fallback: retornar ranking simples baseado em preço
        console.log('⚠️ Usando fallback simples');
        
        const sorted = [...destinos].sort((a, b) => {
            const custoA = (a.flight?.price || 0) + (a.avg_cost_per_night || 0) * 7;
            const custoB = (b.flight?.price || 0) + (b.avg_cost_per_night || 0) * 7;
            return custoA - custoB;
        });

        return res.status(200).json({
            success: true,
            fallback: true,
            top_destino: {
                ...sorted[0],
                razao: 'Melhor custo-benefício para sua viagem.'
            },
            alternativas: sorted.slice(1, 4).map(d => ({
                ...d,
                razao: 'Opção alternativa com bom custo-benefício.'
            })),
            surpresa: {
                ...sorted[sorted.length - 1],
                razao: 'Destino diferente que pode surpreender você!'
            }
        });
    }
}
