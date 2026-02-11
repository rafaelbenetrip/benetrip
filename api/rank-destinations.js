// api/rank-destinations.js - CORRIGIDO: só voos, datas reais
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
        console.log(`🤖 Ranqueando ${destinos.length} destinos (APENAS VOOS)`);

        // EXTRAIR APENAS DADOS DE VOO (ignorar hotéis completamente)
        const destinosVoo = destinos.map((d, i) => {
            if (!d.flight || !d.flight.price) {
                console.warn(`⚠️ Destino ${d.name} sem dados de voo, pulando...`);
                return null;
            }

            return {
                id: i + 1,
                name: d.name,
                country: d.country,
                primary_airport: d.primary_airport,
                outbound_date: d.outbound_date,
                return_date: d.return_date,
                flight: {
                    airport_code: d.flight.airport_code,
                    price: d.flight.price,
                    stops: d.flight.stops,
                    flight_duration: d.flight.flight_duration,
                    flight_duration_minutes: d.flight.flight_duration_minutes,
                    airline_name: d.flight.airline_name
                }
            };
        }).filter(d => d !== null);

        console.log(`✅ ${destinosVoo.length} destinos com voos válidos`);

        // Formato ULTRA COMPACTO e CLARO
        const listaVoos = destinosVoo.map(d => {
            const dias = calcularDias(d.outbound_date, d.return_date);
            return `${d.id}|${d.name}|${d.country}|${d.primary_airport}|R$${d.flight.price}|${d.flight.stops}parada(s)|${d.flight.flight_duration}|${d.flight.airline_name}|${d.outbound_date}→${d.return_date}(${dias}dias)`;
        }).join('\n');

        const prompt = `ANALISTA DE PASSAGENS AÉREAS - Escolher 5 voos de ${destinosVoo.length} opções

PREFERÊNCIA: ${preferencias}
ORÇAMENTO VOO: R$ ${orcamento}

VOOS (ID|Nome|País|Aeroporto|Preço|Escalas|Duração|Cia|Datas):
${listaVoos}

TAREFA: Escolha 1 top + 3 alternativas + 1 surpresa

REGRAS ABSOLUTAS:
1. Use APENAS IDs de 1 a ${destinosVoo.length}
2. COPIE nome, aeroporto, país, datas EXATAMENTE
3. NÃO invente, modifique ou calcule NADA
4. Retorne SÓ JSON (zero markdown, zero explicação)

JSON:
{
  "top_destino": {
    "id": número_exato,
    "razao": "1 frase sobre o voo"
  },
  "alternativas": [
    {"id": número_exato, "razao": "1 frase"},
    {"id": número_exato, "razao": "1 frase"},
    {"id": número_exato, "razao": "1 frase"}
  ],
  "surpresa": {
    "id": número_exato,
    "razao": "1 frase sobre o voo"
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
                        content: 'Você retorna APENAS JSON. Nunca invente dados. Escolha apenas IDs da lista fornecida.'
                    },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.05, // MUITO baixa
                max_tokens: 1000 // Reduzido - só precisa de IDs
            })
        });

        if (!groqResponse.ok) {
            throw new Error(`Groq: ${groqResponse.status}`);
        }

        const groqData = await groqResponse.json();
        const conteudo = groqData.choices[0].message.content;
        console.log('📝 Groq retornou:', conteudo.substring(0, 150));

        let ranking = JSON.parse(conteudo);

        // VALIDAÇÃO + SUBSTITUIÇÃO COM DADOS REAIS
        const construir = (item, nome) => {
            if (!item || !item.id) {
                throw new Error(`${nome}: sem ID`);
            }

            const idx = item.id - 1;
            if (idx < 0 || idx >= destinosVoo.length) {
                throw new Error(`${nome}: ID ${item.id} inválido (max: ${destinosVoo.length})`);
            }

            const original = destinosVoo[idx];

            // RETORNAR DADOS 100% ORIGINAIS (zero alucinação)
            return {
                id: item.id,
                name: original.name, // SEMPRE original
                country: original.country, // SEMPRE original
                primary_airport: original.primary_airport, // SEMPRE original
                outbound_date: original.outbound_date, // SEMPRE original
                return_date: original.return_date, // SEMPRE original
                flight: {
                    airport_code: original.flight.airport_code,
                    price: original.flight.price,
                    stops: original.flight.stops,
                    flight_duration: original.flight.flight_duration,
                    flight_duration_minutes: original.flight.flight_duration_minutes,
                    airline_name: original.flight.airline_name
                },
                razao: item.razao || 'Boa opção'
            };
        };

        const resultado = {
            top_destino: construir(ranking.top_destino, 'top_destino'),
            alternativas: ranking.alternativas.slice(0, 3).map((alt, i) => 
                construir(alt, `alternativa ${i+1}`)
            ),
            surpresa: construir(ranking.surpresa, 'surpresa')
        };

        console.log('✅ Ranking validado:');
        console.log(`   🏆 ${resultado.top_destino.name} - R$${resultado.top_destino.flight.price} (${resultado.top_destino.outbound_date} → ${resultado.top_destino.return_date})`);
        console.log(`   📋 ${resultado.alternativas.map(a => `${a.name} R$${a.flight.price}`).join(', ')}`);
        console.log(`   🎁 ${resultado.surpresa.name} - R$${resultado.surpresa.flight.price}`);

        return res.status(200).json(resultado);

    } catch (erro) {
        console.error('❌ Erro:', erro);
        return res.status(500).json({ 
            error: 'Erro ao processar ranking',
            message: erro.message
        });
    }
}

// Helper: calcular dias entre datas
function calcularDias(ida, volta) {
    if (!ida || !volta) return '?';
    const d1 = new Date(ida);
    const d2 = new Date(volta);
    const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : '?';
}
