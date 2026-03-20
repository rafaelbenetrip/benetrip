// api/instagram/publish.js - Publicador no Instagram via Graph API v1.0
//
// Publica posts no Instagram Business usando a Meta Graph API.
//
// PRÉ-REQUISITOS:
// 1. Conta Instagram Business conectada a uma Facebook Page
// 2. App no Meta for Developers com permissões:
//    - instagram_basic
//    - instagram_content_publish
//    - pages_show_list
//    - pages_read_engagement
// 3. Token de acesso de longa duração (60 dias) — renovar automaticamente
//
// ENV VARS NECESSÁRIAS:
//   INSTAGRAM_ACCESS_TOKEN  - Token de acesso (long-lived)
//   INSTAGRAM_BUSINESS_ID   - ID da conta Instagram Business
//   CRON_SECRET             - Para autenticar chamadas do cron
//
// ENDPOINT:
//   POST /api/instagram/publish
//   Body: { imageUrl, caption, altText }
//
// COMO OBTER O TOKEN:
// 1. Vá em https://developers.facebook.com/tools/explorer/
// 2. Selecione seu app e gere um User Token com as permissões acima
// 3. Troque por um long-lived token:
//    GET https://graph.facebook.com/v19.0/oauth/access_token?
//      grant_type=fb_exchange_token&
//      client_id={APP_ID}&
//      client_secret={APP_SECRET}&
//      fb_exchange_token={SHORT_LIVED_TOKEN}
// 4. Obtenha o Page Token (que não expira):
//    GET https://graph.facebook.com/v19.0/me/accounts?access_token={LONG_LIVED_TOKEN}
// 5. Use o page_access_token como INSTAGRAM_ACCESS_TOKEN
// 6. Obtenha o Instagram Business ID:
//    GET https://graph.facebook.com/v19.0/{PAGE_ID}?fields=instagram_business_account&access_token={PAGE_TOKEN}

export const maxDuration = 60;

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

// ============================================================
// STEP 1: Criar Media Container (upload da imagem)
// ============================================================
async function criarMediaContainer(instagramId, imageUrl, caption, accessToken) {
    const url = `${GRAPH_API_BASE}/${instagramId}/media`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image_url: imageUrl,
            caption: caption,
            access_token: accessToken,
        }),
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(`Meta API (criar container): ${data.error.message} (code: ${data.error.code})`);
    }

    return data.id; // creation_id
}

// ============================================================
// STEP 2: Verificar status do container (polling)
// ============================================================
async function verificarStatusContainer(containerId, accessToken) {
    const url = `${GRAPH_API_BASE}/${containerId}?fields=status_code,status&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        throw new Error(`Meta API (status): ${data.error.message}`);
    }

    return data.status_code; // FINISHED, IN_PROGRESS, ERROR
}

// ============================================================
// STEP 3: Publicar o container
// ============================================================
async function publicarMedia(instagramId, containerId, accessToken) {
    const url = `${GRAPH_API_BASE}/${instagramId}/media_publish`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            creation_id: containerId,
            access_token: accessToken,
        }),
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(`Meta API (publicar): ${data.error.message} (code: ${data.error.code})`);
    }

    return data.id; // media_id
}

// ============================================================
// AGUARDAR CONTAINER FICAR PRONTO
// ============================================================
async function aguardarContainer(containerId, accessToken, maxTentativas = 10) {
    for (let i = 0; i < maxTentativas; i++) {
        const status = await verificarStatusContainer(containerId, accessToken);

        if (status === 'FINISHED') return true;
        if (status === 'ERROR') throw new Error('Container falhou no processamento');

        // Esperar 3 segundos entre verificações
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    throw new Error(`Container não ficou pronto após ${maxTentativas} tentativas`);
}

// ============================================================
// ATUALIZAR STATUS NO SUPABASE
// ============================================================
async function atualizarStatusPost(data, destinoNome, mediaId) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) return;

    try {
        await fetch(
            `${supabaseUrl}/rest/v1/instagram_posts?data=eq.${data}&destino_nome=eq.${encodeURIComponent(destinoNome)}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                    published: true,
                    instagram_media_id: mediaId,
                    published_at: new Date().toISOString(),
                }),
            }
        );
    } catch (err) {
        console.warn('Erro ao atualizar status do post:', err.message);
    }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    // Autenticação
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    const isAuth = (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
                   (cronSecret && req.query?.key === cronSecret) ||
                   !cronSecret;

    if (!isAuth) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    // Verificar variáveis de ambiente
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const instagramId = process.env.INSTAGRAM_BUSINESS_ID;

    if (!accessToken || !instagramId) {
        return res.status(500).json({
            error: 'Instagram não configurado',
            message: 'Configure INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_BUSINESS_ID nas variáveis de ambiente do Vercel',
            guia: {
                passo1: 'Crie um app em developers.facebook.com',
                passo2: 'Conecte sua conta Instagram Business à sua Facebook Page',
                passo3: 'Gere um token com permissões: instagram_basic, instagram_content_publish',
                passo4: 'Troque por um long-lived token (60 dias)',
                passo5: 'Obtenha o Instagram Business ID via Graph API',
                passo6: 'Configure as env vars no Vercel Dashboard',
            },
        });
    }

    try {
        const { imageUrl, caption, altText, destinoNome, data: postDate } = req.body || {};

        if (!imageUrl || !caption) {
            return res.status(400).json({
                error: 'Campos obrigatórios: imageUrl, caption',
                nota: 'imageUrl deve ser uma URL pública acessível (HTTPS, JPEG/PNG)',
            });
        }

        console.log(`📸 [Instagram Publish] Iniciando publicação...`);
        console.log(`   Imagem: ${imageUrl.substring(0, 80)}...`);
        console.log(`   Caption: ${caption.substring(0, 80)}...`);

        // Step 1: Criar container
        const containerId = await criarMediaContainer(instagramId, imageUrl, caption, accessToken);
        console.log(`   Container criado: ${containerId}`);

        // Step 2: Aguardar processamento
        await aguardarContainer(containerId, accessToken);
        console.log(`   Container pronto!`);

        // Step 3: Publicar
        const mediaId = await publicarMedia(instagramId, containerId, accessToken);
        console.log(`   ✅ Publicado! Media ID: ${mediaId}`);

        // Atualizar status no Supabase
        if (postDate && destinoNome) {
            await atualizarStatusPost(postDate, destinoNome, mediaId);
        }

        return res.status(200).json({
            success: true,
            mediaId,
            message: 'Post publicado com sucesso no Instagram!',
            instagramUrl: `https://www.instagram.com/p/${mediaId}/`,
        });
    } catch (error) {
        console.error('❌ [Instagram Publish] Erro:', error);

        // Erros comuns da Meta API
        const errorGuide = {};
        if (error.message.includes('190')) {
            errorGuide.causa = 'Token expirado ou inválido';
            errorGuide.solucao = 'Renove o INSTAGRAM_ACCESS_TOKEN';
        } else if (error.message.includes('9007')) {
            errorGuide.causa = 'Imagem não acessível pela Meta';
            errorGuide.solucao = 'A URL da imagem deve ser pública, HTTPS, e retornar JPEG/PNG';
        } else if (error.message.includes('36003')) {
            errorGuide.causa = 'Limite de publicações atingido (25/dia)';
            errorGuide.solucao = 'Aguarde 24 horas';
        }

        return res.status(500).json({
            error: error.message,
            guide: Object.keys(errorGuide).length > 0 ? errorGuide : undefined,
        });
    }
}
