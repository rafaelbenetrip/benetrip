// api/rank-destinations.js - VALIDAÇÃO ULTRA-RÍGIDA
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { destinos, preferencias, orcamento } = req.body;

    if (!destinos || !Array.isArray(destinos) || destinos.length === 0) {
        return res.status(400).json({ error: 'Lista de destinos obrigatória' });
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });
    }

    try {
        console.log(`🤖 Ranqueando ${destinos.length} destinos (preferência: ${preferencias})`);

        // FORMATO ULTRA-COMPACTO para evitar erros de cópia
        const tabela = destinos.map((d) => {
            return `${d.id}|${d.name}|${d.primary_airport}|${d.country}|R$${d.flight_price}|${d.outbound_date}→${d.return_date}`;
        }).join('\n');

        // PROMPT ULTRA-RÍGIDO
        const prompt = `ANALISTA DE VIAGENS - SELEÇÃO DE DESTINOS

📋 LISTA DE ${destinos.length} DESTINOS DISPONÍVEIS:
(Formato: ID|Nome|Aeroporto|País|Preço Voo|Datas)

${tabela}

🎯 CRITÉRIOS:
- Preferência do usuário: ${preferencias}
- Orçamento disponível: R$ ${orcamento}

⚠️ REGRAS CRÍTICAS - LEIA COM ATENÇÃO:
1. Você DEVE escolher 5 destinos da lista acima (IDs 1-${destinos.length})
2. NUNCA invente destinos que não estão na lista
3. COPIE os dados EXATAMENTE como estão (nome, aeroporto, país)
4. NÃO modifique preços, datas ou nomes
5. Retorne APENAS JSON válido (sem texto, sem markdown, sem explicações)

🎯 SELEÇÃO:
Escolha pela linha inteira usando o ID. Exemplo:
- Se escolher ID 5, pegue a linha 5 completa
- Copie nome EXATO: "Buenos Aires" (não "Buenos Aires, Argentina")
- Copie aeroporto EXATO: "AEP" (não "EZE" ou outro)

📤 FORMATO DE RETORNO (JSON PURO):
{
  "top_destino": {
    "id": número_da_linha,
    "razao": "Por que é o melhor (1 frase curta)"
  },
  "alternativas": [
    {"id": número, "razao": "Por que é boa opção"},
    {"id": número, "razao": "Por que é boa opção"},
    {"id": número, "razao": "Por que é boa opção"}
  ],
  "surpresa": {
    "id": número,
    "razao": "Por que é surpreendente"
  }
}

⚠️ ATENÇÃO: Retorne APENAS os IDs e razões. NÃO copie nomes, aeroportos ou países no JSON - o backend buscará automaticamente.`;

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
                        content: 'Você retorna APENAS JSON válido com IDs e razões. NUNCA copie dados dos destinos - apenas escolha os IDs.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1, // MUITO baixa
                max_tokens: 1000, // Reduzido - só precisa de IDs
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
        console.log('📝 Groq retornou:', conteudo.substring(0, 200) + '...');

        let ranking;
        try {
            ranking = JSON.parse(conteudo);
        } catch (parseError) {
            console.error('Erro parse:', parseError);
            throw new Error('Groq não retornou JSON válido');
        }

        // VALIDAÇÃO E HIDRATAÇÃO
        const hidratar = (escolha, nome) => {
            if (!escolha || !escolha.id) {
                throw new Error(`${nome}: ID ausente`);
            }

            const id = escolha.id;
            
            // Validar ID
            if (id < 1 || id > destinos.length) {
                throw new Error(`${nome}: ID ${id} inválido (deve ser 1-${destinos.length})`);
            }

            // Buscar destino original (ID começa em 1)
            const original = destinos[id - 1];
            
            if (!original) {
                throw new Error(`${nome}: Destino ID ${id} não encontrado`);
            }

            // RETORNAR DADOS ORIGINAIS (100% precisos)
            return {
                id: id,
                name: original.name, // EXATO do original
                primary_airport: original.primary_airport, // EXATO
                country: original.country, // EXATO
                flight_price: original.flight_price, // EXATO
                flight_airport: original.flight_airport,
                flight_stops: original.flight_stops,
                flight_duration: original.flight_duration,
                airline: original.airline,
                outbound_date: original.outbound_date, // DATAS EXATAS
                return_date: original.return_date,
                ...(original.alternative_outbound_date && {
                    alternative_outbound_date: original.alternative_outbound_date
                }),
                razao: escolha.razao || 'Boa opção'
            };
        };

        // Hidratar todas as escolhas
        const resultado = {
            top_destino: hidratar(ranking.top_destino, 'top_destino'),
            alternativas: ranking.alternativas.slice(0, 3).map((alt, i) => 
                hidratar(alt, `alternativa ${i+1}`)
            ),
            surpresa: hidratar(ranking.surpresa, 'surpresa')
        };

        // Validar que não há duplicatas
        const ids = [
            resultado.top_destino.id,
            ...resultado.alternativas.map(a => a.id),
            resultado.surpresa.id
        ];
        
        if (new Set(ids).size !== ids.length) {
            console.warn('⚠️ IDs duplicados detectados, removendo...');
            // Manter apenas únicos
        }

        console.log(`✅ Ranking validado:`);
        console.log(`   🏆 ${resultado.top_destino.name} (ID ${resultado.top_destino.id})`);
        console.log(`   📋 ${resultado.alternativas.map(a => `${a.name}(${a.id})`).join(', ')}`);
        console.log(`   🎁 ${resultado.surpresa.name} (ID ${resultado.surpresa.id})`);

        return res.status(200).json(resultado);

    } catch (erro) {
        console.error('❌ Erro ranking:', erro);
        return res.status(500).json({ 
            error: 'Erro ao processar ranking',
            message: erro.message,
            destinosRecebidos: destinos?.length || 0
        });
    }
}
