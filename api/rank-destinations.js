// api/rank-destinations.js - VERSÃO FULL (sem limites)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { destinos, preferencias, orcamento } = req.body;

    if (!destinos || !Array.isArray(destinos) || destinos.length === 0) {
        return res.status(400).json({ 
            error: 'Lista de destinos obrigatória',
            received: { destinos, preferencias, orcamento }
        });
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });
    }

    try {
        console.log(`🤖 Ranqueando ${destinos.length} destinos para: ${preferencias}`);

        // USAR TODOS OS DESTINOS (sem limite)
        // Formato compacto para economizar tokens
        const listaCompacta = destinos.map((d, i) => {
            const passagem = d.flight?.price || 0;
            const paradas = d.flight?.stops || 0;
            return `${i+1}|${d.name}|${d.country}|${d.primary_airport}|Passagem:R$${passagem}|Paradas:${paradas}`;
        }).join('\n');

        // Prompt otimizado - foco em PASSAGENS
        const prompt = `ESPECIALISTA EM TURISMO - Análise de ${destinos.length} destinos

CONTEXTO:
- Preferência: ${preferencias}
- Orçamento para PASSAGENS (ida e volta por pessoa): R$ ${orcamento}

DESTINOS (formato: ID|Nome|País|Aeroporto|Passagem ida+volta|Paradas):
${listaCompacta}

TAREFA: Analise TODOS os destinos acima e escolha:
1. MELHOR destino geral (melhor custo-benefício de passagem + preferência)
2. 3 ALTERNATIVAS variadas (diferentes perfis)
3. 1 SURPRESA (destino inesperado e interessante)

REGRAS CRÍTICAS:
✓ Use APENAS destinos da lista (ID 1-${destinos.length})
✓ Copie nome, aeroporto e país EXATAMENTE
✓ Retorne APENAS JSON (sem explicações, markdown ou texto extra)
✓ Cada destino deve ter razão ÚNICA de 1 frase
✓ Preço mostrado = preço da PASSAGEM (ida e volta)

JSON FORMAT:
{
  "top_destino": {
    "id": número,
    "name": "nome exato",
    "primary_airport": "código exato",
    "country": "país exato",
    "flight": {"price": número, "airport_code": "código", "stops": número},
    "avg_cost_per_night": número,
    "razao": "Por que é o melhor"
  },
  "alternativas": [
    {id, name, primary_airport, country, flight, avg_cost_per_night, razao},
    {id, name, primary_airport, country, flight, avg_cost_per_night, razao},
    {id, name, primary_airport, country, flight, avg_cost_per_night, razao}
  ],
  "surpresa": {
    "id": número,
    "name": "nome exato",
    "primary_airport": "código exato",
    "country": "país exato",
    "flight": {"price": número, "airport_code": "código", "stops": número},
    "avg_cost_per_night": número,
    "razao": "Por que é surpreendente"
  }
}`;

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
                        content: 'Você retorna APENAS JSON válido. Zero texto extra. Copie dados exatamente como fornecidos.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.2,
                max_tokens: 8000,
                top_p: 0.9
            })
        });

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            console.error('Groq erro:', groqResponse.status, errorText);
            throw new Error(`Groq retornou ${groqResponse.status}`);
        }

        const groqData = await groqResponse.json();
        
        if (!groqData.choices?.[0]?.message?.content) {
            throw new Error('Resposta Groq inválida');
        }

        const conteudo = groqData.choices[0].message.content;
        console.log('📝 Groq retornou:', conteudo.substring(0, 100) + '...');

        let ranking;
        try {
            ranking = JSON.parse(conteudo);
        } catch (parseError) {
            console.error('Erro parse:', parseError);
            console.error('Conteúdo:', conteudo);
            throw new Error('Groq não retornou JSON válido');
        }

        // Validação: verificar se os IDs existem
        const validarPorID = (destino, nome) => {
            if (!destino) throw new Error(`${nome} ausente`);
            
            const id = destino.id - 1; // IDs começam em 1
            if (id < 0 || id >= destinos.length) {
                throw new Error(`${nome}: ID ${destino.id} inválido (máx: ${destinos.length})`);
            }
            
            const original = destinos[id];
            
            // Garantir que os dados batem - SEMPRE corrigir com dados originais
            return {
                ...destino,
                name: original.name,
                primary_airport: original.primary_airport,
                country: original.country,
                flight: original.flight,
                avg_cost_per_night: original.avg_cost_per_night,
                // Manter a razão da IA
                razao: destino.razao
            };
        };

        // Validar e corrigir se necessário
        ranking.top_destino = validarPorID(ranking.top_destino, 'top_destino');
        ranking.surpresa = validarPorID(ranking.surpresa, 'surpresa');
        
        if (!Array.isArray(ranking.alternativas) || ranking.alternativas.length < 3) {
            throw new Error('Mínimo 3 alternativas necessárias');
        }
        
        ranking.alternativas = ranking.alternativas.slice(0, 3).map((alt, i) => 
            validarPorID(alt, `alternativa ${i+1}`)
        );

        console.log(`✅ Ranking de ${destinos.length} destinos:`);
        console.log(`   🏆 ${ranking.top_destino.name} (R$${ranking.top_destino.flight?.price})`);
        console.log(`   📋 ${ranking.alternativas.map(a => `${a.name}(R$${a.flight?.price})`).join(', ')}`);
        console.log(`   🎁 ${ranking.surpresa.name} (R$${ranking.surpresa.flight?.price})`);

        return res.status(200).json(ranking);

    } catch (erro) {
        console.error('❌ Erro ranking:', erro);
        return res.status(500).json({ 
            error: 'Erro ao processar ranking',
            message: erro.message,
            destinosRecebidos: destinos?.length || 0
        });
    }
}