// api/tripinha-insight.js - BENETRIP TRIPINHA INSIGHT v1.0
// Usa Groq para gerar uma frase curta da Tripinha interpretando
// os destinos baratos disponíveis para uma cidade de origem.
//
// POST /api/tripinha-insight
// Body: { origem: "São Paulo", origemCodigo: "GRU", destinos: [...] }
// Response: { success: true, insight: "Hoje tem voo pra..." }

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    const { origem, origemCodigo, destinos } = req.body;

    if (!origem || !destinos || !Array.isArray(destinos) || destinos.length === 0) {
        return res.status(400).json({
            error: 'Parâmetros obrigatórios: origem (string) e destinos (array)',
        });
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(200).json({
            success: true,
            insight: gerarFallback(origem, destinos),
            modelo: 'fallback',
        });
    }

    try {
        const insight = await gerarInsight(origem, origemCodigo, destinos);
        return res.status(200).json({ success: true, ...insight });
    } catch (error) {
        console.error('❌ Tripinha insight erro:', error.message);
        return res.status(200).json({
            success: true,
            insight: gerarFallback(origem, destinos),
            modelo: 'fallback',
        });
    }
}

// ============================================================
// INSIGHT VIA GROQ
// ============================================================
async function gerarInsight(origem, origemCodigo, destinos) {
    const top5 = destinos.slice(0, 5);
    const total = destinos.length;
    const precos = destinos.filter(d => d.preco > 0).map(d => d.preco);
    const maisBarato = top5[0];
    const media = precos.length > 0 ? Math.round(precos.reduce((a, b) => a + b, 0) / precos.length) : 0;
    const nacionais = destinos.filter(d => !d.internacional).length;
    const internacionais = destinos.filter(d => d.internacional).length;

    // Variações de preço
    const comVariacao = destinos.filter(d => d.variacao);
    const desceram = comVariacao.filter(d => d.variacao?.direcao === 'desceu');
    const subiram = comVariacao.filter(d => d.variacao?.direcao === 'subiu');

    const resumo = {
        origem,
        total,
        maisBarato: `${maisBarato.nome} (${maisBarato.pais}) por R$${maisBarato.preco}`,
        precoMedio: `R$${media}`,
        nacionais,
        internacionais,
        top5: top5.map(d => `${d.nome} R$${d.preco}`).join(', '),
        variacoes: comVariacao.length > 0
            ? `${desceram.length} destinos ficaram mais baratos, ${subiram.length} ficaram mais caros`
            : 'sem dados de variação hoje',
        estilosDisponiveis: [...new Set(destinos.flatMap(d => d.estilos || []))].join(', '),
    };

    const systemMessage = `Você é a Tripinha, a cachorrinha mascote da Benetrip — uma plataforma de viagens. Você é simpática, animada e fala de forma coloquial em português brasileiro.

Sua tarefa: gerar UMA frase curta e envolvente (máximo 140 caracteres) comentando os destinos baratos disponíveis hoje para quem sai de ${origem}.

Regras:
- Fale como se fosse um tweet/story curto, na primeira pessoa
- Seja específica: mencione o destino mais barato ou uma tendência de preço
- Se preços caíram, destaque isso como oportunidade
- Se há muitos internacionais baratos, comente
- Use no máximo 1 emoji no início da frase
- NÃO use hashtags
- NÃO comece com "Ei" ou "Olha"
- Seja criativa e varie o estilo
- Retorne APENAS um JSON: { "insight": "sua frase aqui" }`;

    const userMessage = `Dados de hoje para ${origem}:
- Total: ${resumo.total} destinos
- Mais barato: ${resumo.maisBarato}
- Preço médio: ${resumo.precoMedio}
- Nacionais: ${resumo.nacionais} | Internacionais: ${resumo.internacionais}
- Top 5: ${resumo.top5}
- Variações: ${resumo.variacoes}
- Estilos: ${resumo.estilosDisponiveis}`;

    const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

    for (const model of models) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: systemMessage },
                        { role: 'user', content: userMessage },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.7,
                    max_tokens: 200,
                }),
                signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
                console.warn(`⚠️ Groq ${model} HTTP ${response.status}`);
                continue;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) continue;

            const parsed = JSON.parse(content);
            const insight = (parsed.insight || '').trim();

            if (insight && insight.length > 0) {
                console.log(`✅ Tripinha insight (${model}): "${insight}"`);
                return { insight, modelo: model };
            }
        } catch (err) {
            console.warn(`⚠️ Groq ${model} erro:`, err.message);
            continue;
        }
    }

    return { insight: gerarFallback(origem, destinos), modelo: 'fallback' };
}

// ============================================================
// FALLBACK: insight estático baseado nos dados
// ============================================================
function gerarFallback(origem, destinos) {
    if (!destinos || destinos.length === 0) return `Buscando as melhores ofertas de ${origem} pra você!`;

    const maisBarato = destinos[0];
    const internacionais = destinos.filter(d => d.internacional).length;

    if (maisBarato.preco <= 500) {
        return `🔥 ${maisBarato.nome} por apenas R$${maisBarato.preco} saindo de ${origem} — corre que é pechincha!`;
    }
    if (internacionais > 10) {
        return `🌎 ${internacionais} destinos internacionais acessíveis saindo de ${origem} hoje!`;
    }
    return `✈️ Hoje o mais barato de ${origem} é ${maisBarato.nome} por R$${maisBarato.preco} — bora?`;
}
