// api/rank-destinations.js - VERSÃO TRIPLE SEARCH v2
// Recebe destinos consolidados das 3 buscas e ranqueia com LLM
// Fallback: Groq llama-3.3-70b → llama-3.1-8b → ranking por preço

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
            received: { destinos: destinos?.length, preferencias, orcamento }
        });
    }

    if (!process.env.GROQ_API_KEY) {
        console.warn('⚠️ GROQ_API_KEY não configurada, usando fallback por preço');
        return res.status(200).json(rankByPrice(destinos, orcamento));
    }

    try {
        console.log(`🤖 Ranqueando ${destinos.length} destinos | Preferência: ${preferencias} | Orçamento: R$${orcamento}`);

        // ============================================================
        // FORMATO COMPACTO PARA O LLM
        // Inclui _source_count para o LLM priorizar destinos mais confiáveis
        // ============================================================
        const listaCompacta = destinos.map((d, i) => {
            const passagem = d.flight?.price || 0;
            const paradas = d.flight?.stops || 0;
            const fontes = d._source_count || 1;
            const hotel = d.avg_cost_per_night || 0;
            return `${i + 1}|${d.name}|${d.country}|${d.primary_airport}|R$${passagem}|${paradas}paradas|${fontes}fontes|Hotel:R$${hotel}/noite`;
        }).join('\n');

        // ============================================================
        // PROMPT OTIMIZADO
        // ============================================================
        const prompt = `ESPECIALISTA EM TURISMO - Análise de ${destinos.length} destinos

CONTEXTO DO VIAJANTE:
- Preferência: ${preferencias}
- Orçamento PASSAGENS (ida+volta/pessoa): R$ ${orcamento}

DESTINOS (ID|Nome|País|Aeroporto|Passagem|Paradas|Fontes|Hotel):
${listaCompacta}

TAREFA: Escolha os 5 melhores destinos:
1. MELHOR DESTINO (melhor match com preferência entre todas as opções)
2. 3 ALTERNATIVAS variadas (diferentes perfis/países)
3. 1 SURPRESA (inesperado e interessante)

REGRAS:
✓ Use APENAS IDs da lista (1-${destinos.length})
✓ Destinos DENTRO do orçamento, entre 80% e 105% do orçamento (1 aspiracional até 15% acima é OK)
✓ Retorne APENAS JSON válido, sem markdown

JSON:
{
  "top_destino": {"id":1,"razao baseado nas preferencias":"frase sobre o lugar"},
  "alternativas": [{"id":2,"razao":"frase"},{"id":3,"razao":"frase"},{"id":4,"razao":"frase"}],
  "surpresa": {"id":5,"razao":"frase que mostre porque o destino é surpreendente"}
}`;

        // ============================================================
        // TENTAR MODELOS EM CASCATA
        // ============================================================
        const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        let ranking = null;
        let usedModel = null;

        for (const model of models) {
            try {
                const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                    },
                    body: JSON.stringify({
                        model,
                        messages: [
                            {
                                role: 'system',
                                content: 'Você retorna APENAS JSON válido. Zero texto extra. IDs referem a destinos da lista fornecida.'
                            },
                            { role: 'user', content: prompt }
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.2,
                        max_tokens: 2000,
                    })
                });

                if (!groqResponse.ok) {
                    console.error(`[Groq][${model}] HTTP ${groqResponse.status}`);
                    continue;
                }

                const groqData = await groqResponse.json();
                const content = groqData.choices?.[0]?.message?.content;

                if (!content) {
                    console.error(`[Groq][${model}] Resposta vazia`);
                    continue;
                }

                ranking = JSON.parse(content);
                usedModel = model;
                console.log(`✅ [Groq][${model}] Ranking gerado com sucesso`);
                break;

            } catch (err) {
                console.error(`[Groq][${model}] Erro:`, err.message);
                continue;
            }
        }

        // ============================================================
        // FALLBACK: ranking por preço se LLM falhou
        // ============================================================
        if (!ranking) {
            console.warn('⚠️ Todos os modelos falharam, usando fallback por preço');
            return res.status(200).json(rankByPrice(destinos, orcamento));
        }

        // ============================================================
        // VALIDAR E HIDRATAR COM DADOS ORIGINAIS
        // Os IDs do LLM apontam para destinos na lista original.
        // SEMPRE sobrescrever dados com os originais (evita alucinação).
        // ============================================================
        const hydrateById = (item, label) => {
            if (!item || !item.id) throw new Error(`${label}: sem ID`);

            const idx = item.id - 1; // IDs começam em 1
            if (idx < 0 || idx >= destinos.length) {
                throw new Error(`${label}: ID ${item.id} fora do range (máx: ${destinos.length})`);
            }

            const original = destinos[idx];
            return {
                id: item.id,
                name: original.name,
                primary_airport: original.primary_airport,
                country: original.country,
                coordinates: original.coordinates,
                image: original.image,
                flight: original.flight,
                avg_cost_per_night: original.avg_cost_per_night,
                outbound_date: original.outbound_date,
                return_date: original.return_date,
                _sources: original._sources,
                _source_count: original._source_count,
                razao: item.razao || 'Selecionado pela Tripinha 🐶',
            };
        };

        try {
            ranking.top_destino = hydrateById(ranking.top_destino, 'top_destino');
            ranking.surpresa = hydrateById(ranking.surpresa, 'surpresa');

            if (!Array.isArray(ranking.alternativas) || ranking.alternativas.length < 3) {
                throw new Error('Mínimo 3 alternativas');
            }
            ranking.alternativas = ranking.alternativas.slice(0, 3).map((alt, i) =>
                hydrateById(alt, `alternativa ${i + 1}`)
            );
        } catch (validationError) {
            console.error('❌ Validação falhou:', validationError.message);
            return res.status(200).json(rankByPrice(destinos, orcamento));
        }

        // Adicionar metadados
        ranking._model = usedModel;
        ranking._totalAnalisados = destinos.length;

        console.log(`🏆 ${ranking.top_destino.name} (R$${ranking.top_destino.flight?.price}) [${ranking.top_destino._source_count} fontes]`);
        console.log(`📋 ${ranking.alternativas.map(a => `${a.name}(R$${a.flight?.price})`).join(', ')}`);
        console.log(`🎁 ${ranking.surpresa.name} (R$${ranking.surpresa.flight?.price})`);

        return res.status(200).json(ranking);

    } catch (erro) {
        console.error('❌ Erro ranking:', erro);
        // Em caso de erro total, retornar fallback por preço
        return res.status(200).json(rankByPrice(destinos, orcamento));
    }
}

// ============================================================
// FALLBACK: Ranking simples por preço (sem LLM)
// ============================================================
function rankByPrice(destinos, orcamento) {
    // Filtrar destinos com preço válido e dentro/perto do orçamento
    const comPreco = destinos.filter(d => d.flight?.price > 0);

    if (comPreco.length === 0) {
        // Se nada tem preço, pegar os primeiros 5
        const top5 = destinos.slice(0, 5);
        return buildFallbackResult(top5, orcamento);
    }

    // Separar: dentro do orçamento vs fora
    const dentroOrcamento = comPreco.filter(d => d.flight.price <= orcamento);
    const pool = dentroOrcamento.length >= 5 ? dentroOrcamento : comPreco;

    // Ordenar por preço
    pool.sort((a, b) => a.flight.price - b.flight.price);

    // Pegar top 5 tentando diversificar países
    const selected = [];
    const usedCountries = new Set();

    for (const d of pool) {
        if (selected.length >= 5) break;
        // Permitir até 2 do mesmo país
        const countryCount = selected.filter(s => s.country === d.country).length;
        if (countryCount < 2) {
            selected.push(d);
            usedCountries.add(d.country);
        }
    }

    // Se não conseguiu 5, completar sem restrição de país
    if (selected.length < 5) {
        for (const d of pool) {
            if (selected.length >= 5) break;
            if (!selected.includes(d)) selected.push(d);
        }
    }

    return buildFallbackResult(selected, orcamento);
}

function buildFallbackResult(selected, orcamento) {
    const wrap = (d, razao) => ({
        id: 0,
        name: d.name,
        primary_airport: d.primary_airport,
        country: d.country,
        coordinates: d.coordinates,
        image: d.image,
        flight: d.flight,
        avg_cost_per_night: d.avg_cost_per_night,
        outbound_date: d.outbound_date,
        return_date: d.return_date,
        _sources: d._sources,
        _source_count: d._source_count,
        razao,
    });

    return {
        top_destino: selected[0] ? wrap(selected[0], 'Melhor preço encontrado! 🐶') : null,
        alternativas: selected.slice(1, 4).map(d => wrap(d, 'Boa opção de preço')),
        surpresa: selected[4] ? wrap(selected[4], 'Uma opção diferente para explorar! 🎁') : (selected[0] ? wrap(selected[0], 'Única opção disponível') : null),
        _model: 'fallback_price',
        _totalAnalisados: selected.length,
    };
}
