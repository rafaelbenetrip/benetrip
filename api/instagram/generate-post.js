// api/instagram/generate-post.js - Gerador de Conteúdo para Instagram v2.0
//
// Sistema de 7 formatos diferentes (1 por dia da semana).
// Cada formato usa dados REAIS do Supabase + IA (Groq) para caption.
// Gera URL do card branded via /api/instagram/card.
//
// ENDPOINT: POST /api/instagram/generate-post
// BODY: { formato?: string, origem?: string }
// RESPOSTA: { post: { formato, cardUrl, fullCaption, ... } }

import { gerarPersona, gerarPersonaComEstilo } from './persona-simulator.js';
import {
    formatoDescobridor, formatoTop5, formatoEconomia,
    formatoOrigens, formatoRoteiro, formatoRanking,
    formatoDodia, ORIGENS_NOMES, flagPais, ESTILO_EMOJI,
} from './formats.js';

export const maxDuration = 60;

// ============================================================
// GERAR CAPTION COM GROQ (format-specific prompts)
// ============================================================
async function gerarCaptionGroq(formato, dados) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return null;

    const prompt = buildPrompt(formato, dados);
    if (!prompt) return null;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.8,
                max_tokens: 2000,
            }),
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) return null;

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        return JSON.parse(content);
    } catch (err) {
        console.error('Erro Groq:', err.message);
        return null;
    }
}

// ============================================================
// PROMPTS POR FORMATO
// ============================================================
function buildPrompt(formato, dados) {
    const baseInstrucoes = `Você é o social media da Benetrip, plataforma brasileira de viagens baratas.
A mascote é a Tripinha, uma cachorrinha vira-lata caramelo aventureira que "fareja" as melhores ofertas.
Tom: informal, brasileiro, entusiasmado, com emojis moderados.
REGRAS: máximo 2200 caracteres, quebras de linha para boa leitura, NÃO incluir hashtags (serão adicionadas separadas).
Retorne APENAS JSON: { "caption": "texto", "hashtags": ["tag1", ...], "gancho": "frase curta alt-text" }`;

    switch (formato) {
        case 'descobridor':
            return `${baseInstrucoes}

FORMATO: DESCOBRIDOR DE DESTINOS (história de persona usando a ferramenta)

IMPORTANTE: O post deve mostrar os DIFERENCIAIS da ferramenta Descobridor de Destinos:
- O usuário pode digitar livremente o que precisa (orçamento, estilo, itens essenciais)
- A Tripinha analisa o perfil e encontra o destino ideal com preços reais
- É personalizado: cada pessoa recebe uma recomendação diferente

PERSONA:
- Nome: ${dados.persona.nome}, ${dados.persona.idade} anos, ${dados.persona.profissao}
- De: ${dados.origemNome}
- Viajando: ${dados.persona.companhiaLabel}
- O que pediu: "${dados.pedido}"

DESTINO ENCONTRADO PELA TRIPINHA:
- ${dados.destino.nome}, ${dados.destino.pais} - R$${dados.destino.preco}
- Estilos: ${(dados.destino.estilos || []).join(', ')}
- Diferenciais atendidos: ${dados.checks.join(', ')}

ESTRUTURA DO POST:
1. Começar apresentando a persona e o que ela digitou no campo de busca
2. Mostrar como a Tripinha analisou o pedido
3. Revelar o destino com preço
4. Listar os diferenciais atendidos (checklist ✅)
5. CTA: "Diga o que precisa no campo de busca e a Tripinha encontra pra você!"
6. "Link na bio"`;

        case 'top5':
            return `${baseInstrucoes}

FORMATO: TOP 5 DESTINOS MAIS BARATOS DA SEMANA

DADOS REAIS (preços de hoje):
${dados.top5.map((d, i) => `${i + 1}. ${d.nome} (${d.pais}) - R$${d.preco}`).join('\n')}
Saindo de: ${dados.origemNome}

DESTAQUE a ferramenta "Destinos Baratos" da Benetrip que mostra ofertas reais de 100 cidades.
O post deve mostrar que esses preços são REAIS e atualizados.

ESTRUTURA:
1. Hook impactante com o menor preço
2. Lista numerada dos 5 destinos com preço
3. Destacar que são preços reais, atualizados pela Tripinha
4. CTA: "Veja destinos baratos saindo da sua cidade!"
5. "Link na bio"`;

        case 'economia':
            return `${baseInstrucoes}

FORMATO: ECONOMIA - PREÇO QUE CAIU!

DADOS REAIS:
- Destino: ${dados.destino.nome}, ${dados.destino.pais}
- Saindo de: ${dados.origemNome}
- Preço anterior: R$${dados.precoAntes}
- Preço atual: R$${dados.precoAgora}
- Economia: R$${dados.economia} (-${dados.percentual}%)

DESTAQUE a ferramenta "Comparar Voos" da Benetrip que monitora preços.
Mostre que a Tripinha fareja quedas de preço automaticamente.

ESTRUTURA:
1. Hook: "Preço caiu!" ou dado surpreendente sobre a economia
2. Mostrar preço antes vs agora
3. Destacar a economia em reais e percentual
4. Explicar que a Benetrip monitora preços de 100 cidades
5. CTA: "Compare voos e encontre quedas de preço!"
6. "Link na bio"`;

        case 'origens':
            return `${baseInstrucoes}

FORMATO: DE ONDE SAI MAIS BARATO - COMPARAR ORIGENS

DADOS REAIS - ${dados.destinoNome} ${flagPais(dados.destinoPais)}:
${dados.origens.map(o => `- De ${o.origemNome}: R$${o.preco}`).join('\n')}

DESTAQUE: A Benetrip compara preços de 100 cidades brasileiras.
A Tripinha encontra de qual cidade sai mais barato pro mesmo destino.

ESTRUTURA:
1. Hook: "Sabia que o preço muda MUITO dependendo de onde você sai?"
2. Mostrar comparação de preços por origem
3. Destacar o mais barato e a diferença pro mais caro
4. CTA: "Descubra de onde sai mais barato!"
5. "Link na bio"`;

        case 'roteiro':
            return `${baseInstrucoes}

FORMATO: ROTEIRO DIA A DIA

Gere um roteiro de 3 dias para ${dados.destino.nome} (${dados.destino.pais}).
O destino tem preço de passagem R$${dados.destino.preco} saindo de ${dados.origemNome}.
Estilos: ${(dados.destino.estilos || []).join(', ')}

DESTAQUE a ferramenta "Roteiro Viagem" da Benetrip que gera roteiros personalizados com IA.

IMPORTANTE: Retorne JSON com campos adicionais para o card:
{
  "caption": "texto do post",
  "hashtags": ["tag1", ...],
  "gancho": "frase curta",
  "roteiro": {
    "dias": 3,
    "itens": [
      { "titulo": "Chegada", "atividades": ["Check-in", "Almoço no centro", "Passeio pelo bairro histórico"] },
      { "titulo": "Exploração", "atividades": ["Ponto turístico 1", "Almoço típico", "Atividade da tarde"] },
      { "titulo": "Despedida", "atividades": ["Café da manhã especial", "Última atração", "Compras de souvenirs"] }
    ]
  }
}

ESTRUTURA DO CAPTION:
1. Hook: "X dias em ${dados.destino.nome}? Roteiro pronto!"
2. Resumo dia a dia com emojis
3. Destacar que a Benetrip gera roteiros personalizados com IA
4. CTA: "Monte seu roteiro personalizado!"
5. "Link na bio"`;

        case 'ranking':
            return `${baseInstrucoes}

FORMATO: RANKING SEMANAL - MELHORES DESTINOS

DADOS REAIS (${dados.semana}):
${dados.ranking.map((d, i) => `${i + 1}º ${d.nome} (${d.pais}) - R$${d.preco} ${d.estilos[0] ? `[${d.estilos[0]}]` : ''} saindo de ${d.origem}`).join('\n')}

DESTAQUE: Ranking baseado em dados reais de 100 cidades brasileiras.
A Tripinha analisa todos os destinos e monta o ranking semanal.

ESTRUTURA:
1. Hook: "Os destinos mais baratos do Brasil esta semana!"
2. Listar os top destinos com preço
3. Comentário sobre tendências (nacional vs internacional, estilos populares)
4. CTA: "Veja todos os destinos no site!"
5. "Link na bio"`;

        default:
            return null;
    }
}

// ============================================================
// FALLBACK CAPTIONS (sem IA)
// ============================================================
function captionFallback(formato, dados) {
    switch (formato) {
        case 'descobridor':
            return {
                caption: `${dados.persona.nome}, ${dados.persona.profissao} de ${dados.origemNome}, digitou no Descobridor:\n\n"${dados.pedido}"\n\nE a Tripinha encontrou: ${dados.destino.nome} ${flagPais(dados.destino.pais)} por R$${dados.destino.preco}! 🐾\n\n${dados.checks.map(c => `✅ ${c}`).join('\n')}\n\nVocê também pode! Digite o que precisa — orçamento, estilo, itens essenciais — e a Tripinha fareja o destino perfeito.\n\n👆 Link na bio`,
                hashtags: ['benetrip', 'tripinha', 'descobridordedestinos', 'viagembarata', dados.destino.nome.toLowerCase().replace(/\s/g, '')],
                gancho: `${dados.destino.nome} por R$${dados.destino.preco}`,
            };

        case 'top5':
            return {
                caption: `🔥 TOP 5 destinos mais baratos saindo de ${dados.origemNome} esta semana!\n\n${dados.top5.map((d, i) => `${['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i]} ${d.nome} ${flagPais(d.pais)} — R$${d.preco}`).join('\n')}\n\nPreços reais, atualizados hoje pela Tripinha! 🐾\n\nVeja todos os destinos baratos saindo da sua cidade.\n👆 Link na bio`,
                hashtags: ['benetrip', 'top5', 'viagembarata', 'passagembarata', 'tripinha', ...dados.top5.map(d => d.nome.toLowerCase().replace(/\s/g, ''))],
                gancho: `Top 5 mais baratos de ${dados.origemNome}`,
            };

        case 'economia':
            return {
                caption: `📉 PREÇO CAIU!\n\n${dados.destino.nome} ${flagPais(dados.destino.pais)} saindo de ${dados.origemNome}:\n\n📅 Antes: R$${dados.precoAntes}\n📅 Agora: R$${dados.precoAgora}\n💰 Economia: R$${dados.economia} (-${dados.percentual}%)\n\nA Tripinha monitora preços de 100 cidades brasileiras e fareja as quedas! 🐾\n\nCompare voos e encontre o melhor preço.\n👆 Link na bio`,
                hashtags: ['benetrip', 'precocaiu', 'economia', 'viagembarata', dados.destino.nome.toLowerCase().replace(/\s/g, '')],
                gancho: `${dados.destino.nome} caiu ${dados.percentual}%`,
            };

        case 'origens':
            return {
                caption: `✈️ ${dados.destinoNome} ${flagPais(dados.destinoPais)} — de onde sai mais barato?\n\n${dados.origens.map((o, i) => `${i === 0 ? '🏆' : '📍'} De ${o.origemNome}: R$${o.preco}`).join('\n')}\n\nDiferença de R$${dados.origens[dados.origens.length - 1].preco - dados.origens[0].preco} entre o mais barato e o mais caro!\n\nA Tripinha compara preços de 100 cidades brasileiras! 🐾\n\n👆 Link na bio`,
                hashtags: ['benetrip', 'compararvoos', 'viagembarata', dados.destinoNome.toLowerCase().replace(/\s/g, '')],
                gancho: `${dados.destinoNome} de ${dados.origens[0].origemNome}: R$${dados.origens[0].preco}`,
            };

        case 'roteiro':
            return {
                caption: `📋 3 DIAS EM ${dados.destino.nome.toUpperCase()}!\n\n🌅 Dia 1: Chegada e exploração do centro\n☀️ Dia 2: Pontos turísticos principais\n🌄 Dia 3: Compras e despedida\n\nPassagem a partir de R$${dados.destino.preco} saindo de ${dados.origemNome}!\n\nA Tripinha monta roteiros personalizados com IA! 🐾\nDiga pra onde vai e ela organiza tudo.\n\n👆 Link na bio`,
                hashtags: ['benetrip', 'roteiro', 'roteirodeviagem', dados.destino.nome.toLowerCase().replace(/\s/g, '')],
                gancho: `Roteiro: 3 dias em ${dados.destino.nome}`,
            };

        case 'ranking':
            return {
                caption: `🏆 RANKING DA SEMANA — ${dados.semana}\n\n${dados.ranking.slice(0, 8).map((d, i) => `${i + 1}º ${d.nome} ${flagPais(d.pais)} — R$${d.preco}`).join('\n')}\n\nRanking baseado em preços reais de 100 cidades brasileiras! 🐾\n\nVeja todos os destinos no site.\n👆 Link na bio`,
                hashtags: ['benetrip', 'ranking', 'viagembarata', 'destinosbaratos'],
                gancho: `Ranking semanal de destinos`,
            };

        default:
            return { caption: 'Benetrip 🐾', hashtags: ['benetrip'], gancho: 'Benetrip' };
    }
}

// ============================================================
// GERAR HASHTAGS PADRÃO POR FORMATO
// ============================================================
function hashtagsPadrao(formato, dados) {
    const base = ['benetrip', 'tripinha', 'viagembarata'];
    const extras = {
        descobridor: ['descobridordedestinos', 'viagempersonalizada'],
        top5: ['top5', 'passagembarata', 'destinosbaratos'],
        economia: ['precocaiu', 'economia', 'compararvoos'],
        origens: ['compararvoos', 'melhorpreco'],
        roteiro: ['roteiro', 'roteirodeviagem', 'dicadeviagem'],
        ranking: ['ranking', 'destinosbaratos', 'melhordestino'],
    };
    return [...base, ...(extras[formato] || [])];
}

// ============================================================
// BUSCAR IMAGEM PEXELS
// ============================================================
async function buscarImagemPexels(query) {
    const pexelsKey = process.env.PEXELS_API_KEY;
    if (!pexelsKey) return null;

    try {
        const response = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=square&size=large`,
            { headers: { Authorization: pexelsKey } }
        );
        if (!response.ok) return null;

        const data = await response.json();
        if (data.photos?.length > 0) {
            const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
            return {
                url: photo.src.large2x || photo.src.large || photo.src.original,
                source: 'pexels',
                photographer: photo.photographer,
            };
        }
    } catch (err) {
        console.error('Erro Pexels:', err.message);
    }
    return null;
}

// ============================================================
// CONSTRUIR URL DO CARD
// ============================================================
function buildCardUrl(baseUrl, cardParams) {
    return `${baseUrl}/api/instagram/card?${cardParams}`;
}

// ============================================================
// SALVAR NO SUPABASE
// ============================================================
async function salvarPost(postData) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return;

    try {
        await fetch(`${supabaseUrl}/rest/v1/instagram_posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify(postData),
        });
    } catch (err) {
        console.warn('Erro ao salvar post:', err.message);
    }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Auth
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    const isAuth = (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
                   (cronSecret && req.query?.key === cronSecret) || !cronSecret;
    if (!isAuth) return res.status(401).json({ error: 'Não autorizado' });

    try {
        const body = req.method === 'POST' ? req.body || {} : req.query || {};
        const formatoParam = body.formato || formatoDodia();
        const origemParam = body.origem || null;

        console.log(`\n📸 [Instagram v2] Formato: ${formatoParam}`);

        // Obter base URL para card
        const proto = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'benetrip.vercel.app';
        const baseUrl = `${proto}://${host}`;

        // STEP 1: Gerar dados do formato
        let formatoData;
        let persona = null;

        switch (formatoParam) {
            case 'descobridor': {
                // Gerar persona com estilo baseado no dia (Dom=praia, Sab=aventura)
                const dia = new Date().getDay();
                const estilos = ['praia', 'cidade', 'natureza', 'romantico', 'aventura', 'familia', 'aventura'];
                persona = gerarPersonaComEstilo(estilos[dia]);
                if (origemParam) persona.origem.code = origemParam;
                formatoData = await formatoDescobridor(persona);
                break;
            }
            case 'top5':
                formatoData = await formatoTop5();
                break;
            case 'economia':
                formatoData = await formatoEconomia();
                break;
            case 'origens':
                formatoData = await formatoOrigens();
                break;
            case 'roteiro':
                formatoData = await formatoRoteiro();
                break;
            case 'ranking':
                formatoData = await formatoRanking();
                break;
            default:
                return res.status(400).json({ error: `Formato desconhecido: ${formatoParam}` });
        }

        console.log(`   Dados gerados para formato: ${formatoParam}`);

        // STEP 2: Gerar caption com Groq
        let captionData = await gerarCaptionGroq(formatoParam, formatoData.dadosCaption);
        if (!captionData) {
            console.log('   Usando caption fallback (sem IA)');
            captionData = captionFallback(formatoParam, formatoData.dadosCaption);
        }

        // Para roteiro: construir cardParams com dados do Groq
        if (formatoParam === 'roteiro' && captionData.roteiro) {
            const { destino } = formatoData;
            const rot = captionData.roteiro;
            const cardParams = new URLSearchParams({
                f: 'roteiro',
                dn: destino.nome,
                nd: String(rot.dias || 3),
            });
            (rot.itens || []).forEach((item, i) => {
                cardParams.set(`d${i + 1}t`, item.titulo);
                cardParams.set(`d${i + 1}a`, (item.atividades || []).join('|'));
            });
            formatoData.cardParams = cardParams.toString();
        } else if (formatoParam === 'roteiro' && !formatoData.cardParams) {
            // Fallback roteiro card
            const { destino } = formatoData;
            const cardParams = new URLSearchParams({
                f: 'roteiro',
                dn: destino.nome,
                nd: '3',
                d1t: 'Chegada',
                d1a: 'Check-in|Almoço no centro|Explorar o bairro',
                d2t: 'Exploração',
                d2a: 'Ponto turístico principal|Almoço típico|Passeio à tarde',
                d3t: 'Despedida',
                d3a: 'Café especial|Último passeio|Compras e volta',
            });
            formatoData.cardParams = cardParams.toString();
        }

        // STEP 3: Construir URL do card e buscar imagem Pexels (em paralelo)
        const cardUrl = formatoData.cardParams ? buildCardUrl(baseUrl, formatoData.cardParams) : null;

        // Buscar imagem Pexels como alternativa/fallback
        let pexelsQuery;
        if (formatoData.destino) {
            pexelsQuery = `${formatoData.destino.nome} ${formatoData.destino.pais || ''} travel`;
        } else if (formatoData.destinos?.[0]) {
            pexelsQuery = `${formatoData.destinos[0].nome} travel landscape`;
        } else if (formatoData.destinoNome) {
            pexelsQuery = `${formatoData.destinoNome} travel`;
        } else if (formatoData.ranking?.[0]) {
            pexelsQuery = `${formatoData.ranking[0].nome} travel`;
        } else {
            pexelsQuery = 'travel destinations beautiful landscape';
        }

        const pexelsData = await buscarImagemPexels(pexelsQuery);

        // Usar card como imagem principal, Pexels como fallback
        const imageUrl = cardUrl || pexelsData?.url || null;

        // STEP 4: Montar hashtags
        const hashtags = captionData.hashtags?.length > 0
            ? captionData.hashtags
            : hashtagsPadrao(formatoParam, formatoData);
        const hashtagStr = [...new Set(hashtags)].slice(0, 30).map(h => `#${h}`).join(' ');

        const fullCaption = `${captionData.caption}\n\n${hashtagStr}`;

        // STEP 5: Montar resposta
        const post = {
            formato: formatoParam,
            cardUrl,
            imagem: {
                url: imageUrl,
                source: cardUrl ? 'card' : 'pexels',
                pexelsUrl: pexelsData?.url || null,
                photographer: pexelsData?.photographer || null,
            },
            caption: captionData.caption,
            hashtags,
            fullCaption,
            gancho: captionData.gancho || '',
            dadosFormato: formatoData,
            geradoEm: new Date().toISOString(),
        };

        // Adicionar persona se existir
        if (persona || formatoData.persona) {
            const p = persona || formatoData.persona;
            post.persona = {
                nome: p.nome,
                idade: p.idade,
                profissao: p.profissao,
                origem: p.origem,
                companhia: p.companhiaLabel,
            };
        }

        // Adicionar destino principal se existir
        if (formatoData.destino) {
            post.destino = {
                nome: formatoData.destino.nome,
                pais: formatoData.destino.pais,
                preco: formatoData.destino.preco,
                estilos: formatoData.destino.estilos,
            };
        }

        // STEP 6: Salvar histórico
        await salvarPost({
            data: new Date().toISOString().split('T')[0],
            formato: formatoParam,
            estilo: formatoData.destino?.estilos?.[0] || formatoParam,
            destino_nome: formatoData.destino?.nome || formatoData.destinoNome || formatoData.ranking?.[0]?.nome || 'Vários',
            destino_pais: formatoData.destino?.pais || formatoData.destinoPais || '',
            destino_preco: formatoData.destino?.preco || formatoData.destinos?.[0]?.preco || 0,
            origem: persona?.origem?.code || formatoData.origem?.code || '',
            persona_nome: persona?.nome || '',
            caption: captionData.caption,
            hashtags,
            image_url: imageUrl,
            published: false,
        });

        console.log(`   ✅ Post gerado: ${formatoParam}`);

        return res.status(200).json({ success: true, post });
    } catch (error) {
        console.error('❌ [Instagram] Erro:', error);
        return res.status(500).json({ error: error.message });
    }
}
