// api/discovery-smart-filter.js - BENETRIP DISCOVERY SMART FILTER v2.0 (Cerebras)
// Usa Cerebras (LLM) para interpretar busca em linguagem natural
// e retornar filtros estruturados para o frontend aplicar client-side
//
// POST /api/discovery-smart-filter
// Body: { query: "praia barata pra casal", destinos: [...] }
// Response: { filtros: {...}, filtrosDescricao: [...], indices: [0,2,5], explicacao: "..." }
//
// v2.1: a IA interpreta o pedido em filtros ESTRUTURADOS e a aplicação deles
// é determinística (api/_lib/smart-filter.js). A IA ordena por relevância mas
// não consegue furar um critério objetivo — "sem escalas, até R$ 1.500" passa
// a valer de verdade. Os filtros interpretados voltam para a tela.

import {
    aplicarFiltrosEstruturados,
    combinarComRelevancia,
    descreverFiltros,
    normalizarFiltros,
} from './_lib/smart-filter.js';

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

    if (!getCerebrasKey()) {
        // Fallback: busca textual simples
        return res.status(200).json(fallbackTextSearch(query, destinos));
    }

    try {
        const resultado = await smartFilter(query, destinos);
        return res.status(200).json({ success: true, ...resultado });
    } catch (error) {
        console.error('❌ Smart filter erro:', error.message);
        // Fallback em caso de erro da IA
        return res.status(200).json(fallbackTextSearch(query, destinos));
    }
}

function getCerebrasKey() {
    return process.env.CEREBRAS_KEY || process.env.CEREBRAS_API_KEY || null;
}

// ============================================================
// SMART FILTER VIA CEREBRAS
// ============================================================
async function smartFilter(query, destinos) {
    // Montar lista compacta dos destinos para o LLM
    const listaCompacta = destinos.map((d, i) =>
        `${i}|${d.nome}|${d.pais}|R$${d.preco}|${(d.estilos || []).join(',')}|${d.internacional ? 'intl' : 'nac'}|${d.paradas}p|${d.duracao_voo_min ? `${d.duracao_voo_min}min` : 'dur?'}|${d.aeroporto || '?'}`
    ).join('\n');

    const systemMessage = `Você é um assistente de viagens da Benetrip. O usuário quer filtrar destinos de viagem.

Analise o pedido e retorne um JSON com:
1. "filtros": objeto com os critérios OBJETIVOS extraídos do pedido. Use apenas os campos citados pelo usuário; omita o resto.
   - precoMax / precoMin: número em reais
   - estilos: array entre praia, cidade, natureza, romantico, familia, aventura
   - familia: true quando o pedido é para viajar com família/crianças
   - internacional: true (só exterior) ou false (só nacional)
   - pais: nome do país, se citado
   - direto: true quando o usuário pede sem escalas
   - maxParadas: número máximo de paradas, se citado
   - duracaoMaxMin: duração máxima do voo em minutos, se citada
   - aeroporto: código IATA, se citado
   - periodo: "AAAA-MM" quando um mês específico for citado
2. "indices": array com os índices dos destinos mais relevantes, do melhor ao pior (máx 20). Serve para ORDENAR; os critérios objetivos são aplicados pelo sistema.
3. "explicacao": frase curta (máx 60 chars) do que foi entendido. Ex: "Praias para família, sem escalas, até R$ 1.500"
4. "titulo": título curto para a seção (máx 40 chars). Ex: "Praias para Família"

Referências de preço quando o usuário não der um valor:
- "barato/econômico" = precoMax 800 · "médio" = precoMax 1500 · "caro/premium" = precoMin 1500
Outras equivalências: "perto" = direto true · "longe/exótico" = internacional true · "casal/romântico" = estilo romantico

IMPORTANTE: Retorne APENAS o JSON, sem markdown, sem explicação extra.`;

    const userMessage = `Pedido: "${query}"

Destinos disponíveis (índice|nome|país|preço|estilos|tipo|paradas):
${listaCompacta}`;

    const models = [process.env.CEREBRAS_MODEL || 'gpt-oss-120b', process.env.CEREBRAS_MODEL_FALLBACK || 'zai-glm-4.7'];

    for (const model of models) {
        try {
            const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getCerebrasKey()}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: systemMessage },
                        { role: 'user', content: userMessage },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.3,
                    max_tokens: 2500, // inclui tokens de "thinking" dos modelos de reasoning
                    reasoning_effort: model.startsWith('zai-glm') ? 'none' : 'low',
                }),
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                console.warn(`⚠️ Cerebras ${model} HTTP ${response.status}`);
                continue;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) continue;

            const parsed = JSON.parse(content);
            const indicesIA = (parsed.indices || []).filter(i => Number.isInteger(i) && i >= 0 && i < destinos.length);

            // Os critérios objetivos são aplicados aqui, não pela IA:
            // ela só define a ordem de relevância entre os que passaram.
            const filtros = normalizarFiltros(parsed.filtros);
            const indices = combinarComRelevancia(destinos, filtros, indicesIA);
            const descartadosPelaIA = indicesIA.filter(i => !indices.includes(i)).length;

            console.log(`✅ Smart filter (${model}): "${query}" → ${indices.length} resultados${descartadosPelaIA > 0 ? ` (${descartadosPelaIA} sugestões da IA descartadas por não atenderem os critérios)` : ''}`);

            return {
                indices,
                filtros,
                filtrosDescricao: descreverFiltros(filtros),
                explicacao: parsed.explicacao || '',
                titulo: parsed.titulo || 'Resultados',
                modelo: model,
                fallback: false,
            };
        } catch (err) {
            console.warn(`⚠️ Cerebras ${model} erro:`, err.message);
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
    let direto = null;
    const textoBusca = [];

    // "sem escalas" / "voo direto" tamb\u00e9m valem no fallback sem IA
    const queryNorm = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/(sem escala|voo direto|direto)/.test(queryNorm)) direto = true;
    // "at\u00e9 R$ 1500" / "ate 1500"
    const tetoMatch = queryNorm.match(/at(e|\u00e9)\s*r?\$?\s*([\d.]+)/);
    if (tetoMatch) {
        const valor = parseInt(tetoMatch[2].replace(/\./g, ''), 10);
        if (Number.isFinite(valor) && valor > 0) precoMax = valor;
    }

    for (const t of termos) {
        if (!precoMax && precoMap[t]) precoMax = precoMap[t];
        else if (estiloMap[t]) estiloFiltro = estiloMap[t];
        else if (escopoMap[t] !== undefined) escopoFiltro = escopoMap[t];
        else textoBusca.push(t);
    }

    const filtros = normalizarFiltros({
        precoMax,
        estilos: estiloFiltro ? [estiloFiltro] : [],
        internacional: escopoFiltro,
        direto,
        familia: estiloFiltro === 'familia' ? true : null,
    });

    // Crit\u00e9rios objetivos aplicados de forma determin\u00edstica; o texto livre
    // ainda filtra por nome/pa\u00eds entre os que passaram
    let indices = aplicarFiltrosEstruturados(destinos, filtros);
    if (textoBusca.length > 0) {
        const semRuido = textoBusca.filter(t => t.length > 2 && !['sem', 'escalas', 'escala', 'para', 'com', 'ate'].includes(t));
        if (semRuido.length > 0) {
            const comTexto = indices.filter(i => {
                const nomeNorm = `${destinos[i].nome} ${destinos[i].pais}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return semRuido.some(t => nomeNorm.includes(t));
            });
            // S\u00f3 restringe por texto se sobrar algo \u2014 sen\u00e3o o filtro objetivo manda
            if (comTexto.length > 0) indices = comTexto;
        }
    }

    return {
        success: true,
        indices,
        filtros,
        filtrosDescricao: descreverFiltros(filtros),
        explicacao: `Busca: "${query}"`,
        titulo: 'Resultados da Busca',
        modelo: 'fallback',
        fallback: true,
    };
}
