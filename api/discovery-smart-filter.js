// api/discovery-smart-filter.js - BENETRIP DISCOVERY SMART FILTER v1.0
// Usa Groq (LLM) para interpretar busca em linguagem natural
// e retornar filtros estruturados para o frontend aplicar client-side
//
// POST /api/discovery-smart-filter
// Body: { query: "praia barata pra casal", destinos: [...] }
// Response: { filtros: {...}, indices: [0,2,5], explicacao: "..." }

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    const { query, destinos } = req.body;

    if (!query || !destinos || !Array.isArray(destinos) || destinos.length === 0) {
        return res.status(400).json({
            error: 'Parâmetros obrigatórios: query (string) e destinos (array)',
        });
    }

    if (!process.env.GROQ_API_KEY) {
        // Fallback: busca textual simples
        return res.status(200).json(fallbackTextSearch(query, destinos));
    }

    try {
        const resultado = await smartFilter(query, destinos);
        return res.status(200).json({ success: true, ...resultado });
    } catch (error) {
        console.error('❌ Smart filter erro:', error.message);
        // Fallback em caso de erro do Groq
        return res.status(200).json(fallbackTextSearch(query, destinos));
    }
}

// ============================================================
// SMART FILTER VIA GROQ
// ============================================================
async function smartFilter(query, destinos) {
    // Montar lista compacta dos destinos para o LLM
    const listaCompacta = destinos.map((d, i) =>
        `${i}|${d.nome}|${d.pais}|R$${d.preco}|${(d.estilos || []).join(',')}|${d.internacional ? 'intl' : 'nac'}|${d.paradas}p`
    ).join('\n');

    const systemMessage = `Você é um assistente de viagens da Benetrip. O usuário quer filtrar destinos de viagem.

Analise o pedido do usuário e retorne um JSON com:
1. "indices": array com os índices (números) dos destinos que melhor combinam com o pedido, ordenados do mais relevante ao menos. Retorne no máximo 20.
2. "explicacao": frase curta (máx 60 chars) explicando o filtro aplicado, em português. Ex: "Praias baratas para casal"
3. "titulo": título curto para a seção de resultados (máx 40 chars). Ex: "Praias para Casal"

Considere:
- Preço: "barato/econômico" = até R$800, "médio" = R$800-1500, "caro/premium" = acima de R$1500
- "Perto" = voos nacionais ou paradas=0
- "Longe/exótico" = internacional
- Estilos: praia, cidade, natureza, romantico, familia, aventura
- "Casal/romântico" = estilo romantico ou cidades conhecidas como românticas
- "Família/crianças" = estilo familia
- Se o pedido for vago, priorize os mais baratos
- Se pedir algo impossível (ex: praia no interior), retorne array vazio

IMPORTANTE: Retorne APENAS o JSON, sem markdown, sem explicação extra.`;

    const userMessage = `Pedido: "${query}"

Destinos disponíveis (índice|nome|país|preço|estilos|tipo|paradas):
${listaCompacta}`;

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
                    temperature: 0.3,
                    max_tokens: 1000,
                }),
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                console.warn(`⚠️ Groq ${model} HTTP ${response.status}`);
                continue;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) continue;

            const parsed = JSON.parse(content);
            const indices = (parsed.indices || []).filter(i => i >= 0 && i < destinos.length);

            console.log(`✅ Smart filter (${model}): "${query}" → ${indices.length} resultados`);

            return {
                indices,
                explicacao: parsed.explicacao || '',
                titulo: parsed.titulo || 'Resultados',
                modelo: model,
                fallback: false,
            };
        } catch (err) {
            console.warn(`⚠️ Groq ${model} erro:`, err.message);
            continue;
        }
    }

    // Se todos os modelos falharem, fallback
    return fallbackTextSearch(query, destinos);
}

// ============================================================
// FALLBACK: busca textual simples
// ============================================================
function fallbackTextSearch(query, destinos) {
    const termos = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/);

    // Mapeamento de termos comuns
    const precoMap = { barato: 1000, economico: 1000, medio: 2000, caro: 99999 };
    const estiloMap = {
        praia: 'praia', praias: 'praia', beach: 'praia',
        cidade: 'cidade', urbano: 'cidade', city: 'cidade',
        natureza: 'natureza', eco: 'natureza', nature: 'natureza',
        casal: 'romantico', romantico: 'romantico', lua: 'romantico',
        familia: 'familia', crianca: 'familia', kids: 'familia',
        aventura: 'aventura', radical: 'aventura', adventure: 'aventura',
    };
    const escopoMap = {
        nacional: false, brasil: false, domestico: false,
        internacional: true, exterior: true, fora: true,
    };

    let precoMax = null;
    let estiloFiltro = null;
    let escopoFiltro = null;
    const textoBusca = [];

    for (const t of termos) {
        if (precoMap[t]) precoMax = precoMap[t];
        else if (estiloMap[t]) estiloFiltro = estiloMap[t];
        else if (escopoMap[t] !== undefined) escopoFiltro = escopoMap[t];
        else textoBusca.push(t);
    }

    const indices = [];
    destinos.forEach((d, i) => {
        const nomeNorm = (d.nome + ' ' + d.pais).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        if (precoMax && d.preco > precoMax) return;
        if (estiloFiltro && !(d.estilos || []).includes(estiloFiltro)) return;
        if (escopoFiltro !== null && d.internacional !== escopoFiltro) return;
        if (textoBusca.length > 0 && !textoBusca.some(t => nomeNorm.includes(t))) return;

        indices.push(i);
    });

    return {
        success: true,
        indices,
        explicacao: `Busca: "${query}"`,
        titulo: 'Resultados da Busca',
        modelo: 'fallback',
        fallback: true,
    };
}
