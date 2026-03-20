// api/instagram/generate-post.js - Gerador de Conteúdo para Instagram v1.0
// Combina: persona simulada + destinos baratos reais (Supabase) + IA (Groq) + imagem (Pexels)
//
// ENDPOINT: POST /api/instagram/generate-post
// BODY (opcional): { estilo: "praia", origem: "GRU", forceDestino: "Cancún" }
// RESPOSTA: { persona, destino, caption, hashtags, imageUrl, postData }

import { gerarPersona, gerarPersonaComEstilo, estiloDodia } from './persona-simulator.js';

export const maxDuration = 60;

// ============================================================
// BUSCAR DESTINOS BARATOS DO SUPABASE
// ============================================================
async function buscarDestinosBaratos(origemCode) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase não configurado');
    }

    // Buscar snapshot mais recente para a origem
    const url = `${supabaseUrl}/rest/v1/discovery_snapshots?origem=eq.${origemCode}&tipo=eq.destinos-baratos&select=*&order=data.desc&limit=1`;

    const response = await fetch(url, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Erro ao buscar Supabase: ${response.status}`);
    }

    const rows = await response.json();
    if (rows.length === 0) return [];

    return rows[0].destinos || [];
}

// ============================================================
// FILTRAR DESTINO POR ESTILO/PERSONA
// ============================================================
function escolherDestinoParaPersona(destinos, persona, estiloPreferido) {
    if (destinos.length === 0) return null;

    let candidatos = destinos;

    // Filtrar por estilo se definido
    if (estiloPreferido) {
        const comEstilo = destinos.filter(d =>
            (d.estilos || []).includes(estiloPreferido)
        );
        if (comEstilo.length > 0) candidatos = comEstilo;
    }

    // Filtrar por escopo (nacional/internacional)
    if (persona.escopoDestino === 'nacional') {
        const nacionais = candidatos.filter(d => !d.internacional);
        if (nacionais.length > 0) candidatos = nacionais;
    } else if (persona.escopoDestino === 'internacional') {
        const internacionais = candidatos.filter(d => d.internacional);
        if (internacionais.length > 0) candidatos = internacionais;
    }

    // Filtrar por orçamento (preço do voo < 60% do orçamento)
    const dentroOrcamento = candidatos.filter(d => d.preco <= persona.orcamento * 0.6);
    if (dentroOrcamento.length > 0) candidatos = dentroOrcamento;

    // Escolher aleatoriamente entre os top 10 mais baratos para variedade
    const top = candidatos.slice(0, Math.min(10, candidatos.length));
    return top[Math.floor(Math.random() * top.length)];
}

// ============================================================
// GERAR CAPTION COM IA (GROQ)
// ============================================================
async function gerarCaption(persona, destino) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
        // Fallback sem IA
        return gerarCaptionFallback(persona, destino);
    }

    const prompt = `Você é o social media da Benetrip, uma plataforma brasileira de viagens baratas.
A mascote é a Tripinha, uma cachorrinha vira-lata caramelo aventureira.

Gere um post de Instagram ENGAJANTE para o seguinte cenário:

PERSONA DO VIAJANTE:
- Nome: ${persona.nome}, ${persona.idade} anos, ${persona.profissao}
- Viajando: ${persona.companhiaLabel} (${persona.numPessoas} pessoa(s))
- Saindo de: ${persona.origem.name}/${persona.origem.state}
- Preferências: ${persona.preferencias}
- Orçamento: R$${persona.orcamento} por pessoa
- Contexto: "${persona.observacoes}"

DESTINO ENCONTRADO:
- Destino: ${destino.nome}, ${destino.pais}
- Preço da passagem: R$${destino.preco}
- Estilos: ${(destino.estilos || []).join(', ')}
- ${destino.internacional ? 'Internacional' : 'Nacional'}

REGRAS DO POST:
1. Máximo 2200 caracteres (limite Instagram)
2. Começar com um hook forte (pergunta, dado surpreendente, ou provocação)
3. Contar uma mini-história da persona descobrindo o destino na Benetrip
4. Incluir o PREÇO da passagem (destaque como oferta)
5. Mencionar a Tripinha de forma natural e fofa
6. Call-to-action: convidar a usar o descobridor de destinos no site
7. Tom: informal, entusiasmado, brasileiro, com emojis moderados
8. NÃO usar hashtags no caption (serão adicionados separadamente)
9. Incluir quebras de linha para boa leitura no Instagram

Retorne APENAS um JSON:
{
  "caption": "texto do post aqui",
  "hashtags": ["viagem", "destino", ...],
  "gancho": "frase curta para alt-text da imagem"
}`;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'user', content: prompt },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.8,
                max_tokens: 2000,
            }),
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            console.warn(`Groq HTTP ${response.status}, usando fallback`);
            return gerarCaptionFallback(persona, destino);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return gerarCaptionFallback(persona, destino);

        const parsed = JSON.parse(content);
        return {
            caption: parsed.caption || gerarCaptionFallback(persona, destino).caption,
            hashtags: parsed.hashtags || gerarHashtagsPadrao(destino),
            gancho: parsed.gancho || `${destino.nome} por R$${destino.preco}`,
        };
    } catch (err) {
        console.error('Erro Groq caption:', err.message);
        return gerarCaptionFallback(persona, destino);
    }
}

// ============================================================
// FALLBACK: CAPTION SEM IA
// ============================================================
function gerarCaptionFallback(persona, destino) {
    const hooks = [
        `Passagem pra ${destino.nome} por apenas R$${destino.preco}?! A Tripinha farejou essa oferta! 🐕`,
        `${persona.nome} queria viajar gastando pouco. A Tripinha encontrou ${destino.nome} por R$${destino.preco}! ✈️`,
        `Sabia que dá pra ir de ${persona.origem.name} pra ${destino.nome} por R$${destino.preco}? 🤯`,
        `A Tripinha não para! Achou ${destino.nome} saindo de ${persona.origem.name} por R$${destino.preco} 🐾`,
    ];

    const caption = `${hooks[Math.floor(Math.random() * hooks.length)]}

${persona.companhiaEmoji} ${persona.nome}, ${persona.profissao} de ${persona.origem.name}, sonhava com uma viagem ${persona.preferenciasArray.includes('relax') ? 'relaxante' : 'incrível'} ${persona.companhiaNome === 'solo' ? 'solo' : persona.companhiaNome === 'casal' ? 'a dois' : persona.companhiaNome === 'familia' ? 'em família' : 'com amigos'}.

Usando o Descobridor de Destinos da Benetrip, encontrou ${destino.nome} ${destino.pais !== 'Brasil' ? '(' + destino.pais + ') ' : ''}com passagem a partir de R$${destino.preco}! ${destino.internacional ? '🌎' : '🇧🇷'}

${destino.estilos?.includes('praia') ? '🏖️ Praia' : destino.estilos?.includes('natureza') ? '🌿 Natureza' : destino.estilos?.includes('cidade') ? '🏙️ Cidade' : '✨ Destino'} perfeito${persona.companhiaNome === 'casal' ? ' pra dois' : persona.companhiaNome === 'familia' ? ' pra família toda' : ''}!

🐾 A Tripinha sempre encontra as melhores ofertas pra você!

Quer descobrir destinos baratos saindo da sua cidade?
Link na bio! 👆`;

    return {
        caption,
        hashtags: gerarHashtagsPadrao(destino),
        gancho: `${destino.nome} por R$${destino.preco}`,
    };
}

function gerarHashtagsPadrao(destino) {
    const base = ['benetrip', 'viagembarata', 'passagembarata', 'tripinha', 'descobridordedestinos'];
    const destTags = [
        destino.nome.toLowerCase().replace(/\s+/g, ''),
        destino.pais.toLowerCase().replace(/\s+/g, ''),
    ];
    const estiloTags = {
        praia: ['praia', 'beach', 'ferias', 'sol'],
        natureza: ['natureza', 'ecoturismo', 'trilha'],
        cidade: ['cidade', 'cultura', 'gastronomia'],
        romantico: ['romance', 'luademel', 'viagemadois'],
        aventura: ['aventura', 'adrenalina', 'esporteradical'],
        familia: ['viagememfamilia', 'feriasemfamilia', 'viajarcomcriancas'],
    };

    let tags = [...base, ...destTags];
    for (const estilo of (destino.estilos || [])) {
        tags.push(...(estiloTags[estilo] || []));
    }

    // Deduplicate and limit to 30 (Instagram limit)
    return [...new Set(tags)].slice(0, 30);
}

// ============================================================
// BUSCAR IMAGEM DO DESTINO (PEXELS)
// ============================================================
async function buscarImagemDestino(destino) {
    const pexelsKey = process.env.PEXELS_API_KEY;
    if (!pexelsKey) {
        return {
            url: destino.imagem || null,
            source: 'snapshot',
            photographer: null,
        };
    }

    const query = `${destino.nome} ${destino.pais} travel landscape`;

    try {
        const response = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=square&size=large`,
            {
                headers: { Authorization: pexelsKey },
            }
        );

        if (!response.ok) {
            console.warn(`Pexels HTTP ${response.status}`);
            return { url: destino.imagem || null, source: 'snapshot', photographer: null };
        }

        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
            // Escolher aleatoriamente entre as top 5 para variedade
            const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
            return {
                url: photo.src.large2x || photo.src.large || photo.src.original,
                urlSquare: photo.src.large || photo.src.medium,
                source: 'pexels',
                photographer: photo.photographer,
                photographerUrl: photo.photographer_url,
                pexelsUrl: photo.url,
            };
        }
    } catch (err) {
        console.error('Erro Pexels:', err.message);
    }

    return { url: destino.imagem || null, source: 'snapshot', photographer: null };
}

// ============================================================
// SALVAR POST NO SUPABASE (HISTÓRICO)
// ============================================================
async function salvarPostHistorico(postData) {
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
        console.warn('Erro ao salvar histórico do post:', err.message);
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

    // Autenticação (CRON_SECRET ou admin)
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    const queryKey = req.query?.key;
    const isAuth = (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
                   (cronSecret && queryKey === cronSecret) ||
                   !cronSecret; // Se não tem secret, permite (dev)

    if (!isAuth) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    try {
        const body = req.method === 'POST' ? req.body || {} : req.query || {};
        const estiloParam = body.estilo || estiloDodia();
        const origemParam = body.origem || null;
        const forceDestino = body.forceDestino || null;

        console.log(`\n📸 [Instagram] Gerando post - Estilo: ${estiloParam}`);

        // 1. Gerar persona
        const persona = gerarPersonaComEstilo(estiloParam);
        if (origemParam) {
            persona.origem.code = origemParam;
        }

        console.log(`👤 Persona: ${persona.nome}, ${persona.profissao} de ${persona.origem.name} (${persona.companhiaLabel})`);

        // 2. Buscar destinos baratos reais do Supabase
        const destinos = await buscarDestinosBaratos(persona.origem.code);
        if (destinos.length === 0) {
            return res.status(404).json({
                error: 'Nenhum destino encontrado',
                message: `Sem snapshots para ${persona.origem.code}. O cron de discovery já rodou?`,
            });
        }

        // 3. Escolher destino ideal para a persona
        let destino;
        if (forceDestino) {
            destino = destinos.find(d => d.nome.toLowerCase().includes(forceDestino.toLowerCase()));
        }
        if (!destino) {
            destino = escolherDestinoParaPersona(destinos, persona, estiloParam);
        }
        if (!destino) {
            destino = destinos[Math.floor(Math.random() * Math.min(5, destinos.length))];
        }

        console.log(`✈️ Destino: ${destino.nome}, ${destino.pais} - R$${destino.preco}`);

        // 4. Gerar caption com IA + buscar imagem (paralelo)
        const [captionData, imagemData] = await Promise.all([
            gerarCaption(persona, destino),
            buscarImagemDestino(destino),
        ]);

        // 5. Montar post completo
        const fullCaption = `${captionData.caption}\n\n${captionData.hashtags.map(h => `#${h}`).join(' ')}`;

        const postData = {
            persona: {
                nome: persona.nome,
                idade: persona.idade,
                profissao: persona.profissao,
                origem: persona.origem,
                companhia: persona.companhiaLabel,
                preferencias: persona.preferenciasArray,
                orcamento: persona.orcamento,
                observacoes: persona.observacoes,
            },
            destino: {
                nome: destino.nome,
                pais: destino.pais,
                preco: destino.preco,
                estilos: destino.estilos,
                internacional: destino.internacional,
            },
            caption: captionData.caption,
            hashtags: captionData.hashtags,
            fullCaption,
            gancho: captionData.gancho,
            imagem: imagemData,
            estilo: estiloParam,
            geradoEm: new Date().toISOString(),
        };

        // 6. Salvar no histórico
        await salvarPostHistorico({
            data: new Date().toISOString().split('T')[0],
            estilo: estiloParam,
            destino_nome: destino.nome,
            destino_pais: destino.pais,
            destino_preco: destino.preco,
            origem: persona.origem.code,
            persona_nome: persona.nome,
            caption: captionData.caption,
            hashtags: captionData.hashtags,
            image_url: imagemData.url,
            published: false,
        });

        console.log(`✅ [Instagram] Post gerado para ${destino.nome}`);

        return res.status(200).json({
            success: true,
            post: postData,
        });
    } catch (error) {
        console.error('❌ [Instagram] Erro:', error);
        return res.status(500).json({ error: error.message });
    }
}
