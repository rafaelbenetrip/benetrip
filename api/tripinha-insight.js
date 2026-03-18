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

Sua tarefa: gerar UMA frase curta e envolvente (máximo 160 caracteres) comentando os destinos baratos disponíveis hoje para quem sai de ${origem}.

Regras:
- Fale como se fosse um tweet/story curto, na primeira pessoa
- PRIORIZE variações de preço: se destinos ficaram mais baratos, destaque como OPORTUNIDADE URGENTE
- Se preços caíram, mencione o destino específico que caiu e quanto (ex: "Salvador caiu R$120!")
- Se preços subiram, sugira alternativas baratas
- Se há internacionais abaixo de R$2.500, destaque como achado
- Mencione pelo menos 1 destino pelo nome com preço
- Use no máximo 1 emoji no início da frase
- NÃO use hashtags
- NÃO comece com "Ei" ou "Olha"
- Seja criativa, varie o estilo, gere urgência positiva (tipo "corre!", "vai que é agora")
- Retorne APENAS um JSON: { "insight": "sua frase aqui" }`;

    // Detalhes de quem caiu mais
    const topDesceram = desceram
        .sort((a, b) => Math.abs(b.variacao?.diferenca || 0) - Math.abs(a.variacao?.diferenca || 0))
        .slice(0, 3)
        .map(d => `${d.nome} caiu R$${Math.abs(d.variacao.diferenca)} (agora R$${d.preco})`)
        .join('; ');

    const intlBaratos = destinos.filter(d => d.internacional && d.preco <= 2500);
    const intlDestaques = intlBaratos.slice(0, 3).map(d => `${d.nome} R$${d.preco}`).join(', ');

    const userMessage = `Dados de hoje para ${origem}:
- Total: ${resumo.total} destinos
- Mais barato: ${resumo.maisBarato}
- Preço médio: ${resumo.precoMedio}
- Nacionais: ${resumo.nacionais} | Internacionais: ${resumo.internacionais}
- Top 5: ${resumo.top5}
- Variações: ${resumo.variacoes}
${topDesceram ? `- Maiores quedas: ${topDesceram}` : ''}
${intlDestaques ? `- Internacionais acessíveis (<R$2500): ${intlDestaques}` : ''}
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
                    temperature: 0.9,
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
// FALLBACK: insight dinâmico baseado nos dados
// ============================================================
function gerarFallback(origem, destinos) {
    if (!destinos || destinos.length === 0) return `✈️ Buscando as melhores ofertas de ${origem} pra você!`;

    const maisBarato = destinos[0];
    const segundo = destinos[1];
    const total = destinos.length;
    const precos = destinos.filter(d => d.preco > 0).map(d => d.preco);
    const media = precos.length > 0 ? Math.round(precos.reduce((a, b) => a + b, 0) / precos.length) : 0;
    const nacionais = destinos.filter(d => !d.internacional);
    const internacionais = destinos.filter(d => d.internacional);
    const intlBaratos = internacionais.filter(d => d.preco <= 2500);

    // Variações
    const desceram = destinos.filter(d => d.variacao?.direcao === 'desceu');
    const maiorQueda = desceram.sort((a, b) => Math.abs(b.variacao?.diferenca || 0) - Math.abs(a.variacao?.diferenca || 0))[0];

    // Pool de frases contextuais — escolha baseada no hash do dia + origem
    const hoje = new Date().getDate();
    const seed = (hoje + origem.length + total) % 20;

    // Prioridade 1: variação de preço
    if (maiorQueda) {
        const queda = Math.abs(maiorQueda.variacao.diferenca);
        const frases = [
            `📉 ${maiorQueda.nome} caiu R$${queda} e tá custando R$${maiorQueda.preco} — vai que é agora!`,
            `🔥 Preço despencou! ${maiorQueda.nome} por R$${maiorQueda.preco} (caiu R$${queda}) saindo de ${origem}`,
            `💸 ${maiorQueda.nome} ficou R$${queda} mais barato hoje! Tá R$${maiorQueda.preco} saindo de ${origem}`,
        ];
        return frases[seed % frases.length];
    }

    // Prioridade 2: pechincha (preço muito baixo)
    if (maisBarato.preco <= 400) {
        const frases = [
            `🔥 ${maisBarato.nome} por R$${maisBarato.preco}?! Isso é preço de rodoviária, não de avião! Corre!`,
            `✈️ R$${maisBarato.preco} pra ${maisBarato.nome} saindo de ${origem} — tá praticamente de graça!`,
            `💰 Achei ${maisBarato.nome} por R$${maisBarato.preco}! Preço assim some rápido, bora?`,
        ];
        return frases[seed % frases.length];
    }

    // Prioridade 3: internacionais baratos
    if (intlBaratos.length >= 3) {
        const dest = intlBaratos[0];
        const frases = [
            `🌎 ${intlBaratos.length} destinos internacionais abaixo de R$2.500! ${dest.nome} por R$${dest.preco} tá imperdível`,
            `✈️ Quer sair do Brasil? ${dest.nome} por R$${dest.preco} e mais ${intlBaratos.length - 1} opções baratas saindo de ${origem}!`,
            `🌍 ${dest.nome} a R$${dest.preco} saindo de ${origem}! E tem mais ${intlBaratos.length - 1} internacionais acessíveis`,
        ];
        return frases[seed % frases.length];
    }

    // Prioridade 4: bom preço geral
    if (maisBarato.preco <= 800) {
        const frases = [
            `✈️ ${maisBarato.nome} por R$${maisBarato.preco} é o destino mais barato de ${origem} hoje — corre!`,
            `🐶 Farejei ${total} destinos de ${origem} e o campeão é ${maisBarato.nome} por R$${maisBarato.preco}!`,
            `💡 De ${origem} pra ${maisBarato.nome} por R$${maisBarato.preco}${segundo ? ` ou ${segundo.nome} por R$${segundo.preco}` : ''} — qual você escolhe?`,
        ];
        return frases[seed % frases.length];
    }

    // Prioridade 5: muitas opções
    if (total >= 20) {
        const frases = [
            `✈️ ${total} destinos saindo de ${origem}! O mais em conta é ${maisBarato.nome} por R$${maisBarato.preco}`,
            `🗺️ Tem ${nacionais.length} nacionais e ${internacionais.length} internacionais de ${origem} — ${maisBarato.nome} lidera com R$${maisBarato.preco}`,
            `🐶 Fuçando ${total} opções de ${origem}! Preço médio R$${media}, mas tem ${maisBarato.nome} por R$${maisBarato.preco}`,
        ];
        return frases[seed % frases.length];
    }

    // Default variado
    const frases = [
        `✈️ ${maisBarato.nome} por R$${maisBarato.preco} é a melhor pedida saindo de ${origem} hoje!`,
        `🐶 O melhor que achei de ${origem}: ${maisBarato.nome} por R$${maisBarato.preco}${segundo ? ` e ${segundo.nome} por R$${segundo.preco}` : ''}`,
        `💡 Saindo de ${origem}? ${maisBarato.nome} tá R$${maisBarato.preco} — preço médio dos ${total} destinos é R$${media}`,
        `✈️ Top 1 de ${origem}: ${maisBarato.nome} a R$${maisBarato.preco}! Tem ${total} destinos pra explorar`,
    ];
    return frases[seed % frases.length];
}
