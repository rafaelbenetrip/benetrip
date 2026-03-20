// api/cron/instagram-post.js - Cron Job de Post Automático no Instagram v1.0
//
// Roda diariamente via Vercel Cron (configurado em vercel.json)
// Fluxo: Gerar Persona → Buscar Destino → Gerar Caption (Groq) → Buscar Imagem (Pexels) → Publicar (Instagram Graph API)
//
// TRIGGER: Vercel Cron (1x/dia às 12:00 UTC = 9:00 BRT)
// MANUAL: GET /api/cron/instagram-post?key=CRON_SECRET
// PREVIEW: GET /api/cron/instagram-post?key=CRON_SECRET&preview=true (não publica, só gera)

export const maxDuration = 120;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Autenticação
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    const queryKey = req.query?.key;
    const isVercelCron = authHeader === `Bearer ${cronSecret}`;
    const isManualWithKey = queryKey && queryKey === cronSecret;

    if (cronSecret && !isVercelCron && !isManualWithKey) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    const isPreview = req.query?.preview === 'true';
    const estilo = req.query?.estilo || null;
    const origem = req.query?.origem || null;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📸 INSTAGRAM CRON v1.0 - ${new Date().toISOString()}`);
    console.log(`   Modo: ${isPreview ? 'PREVIEW (sem publicar)' : 'PUBLICAÇÃO'}`);
    console.log(`${'='.repeat(60)}`);

    try {
        // Verificar se Instagram está configurado (exceto em modo preview)
        if (!isPreview && (!process.env.INSTAGRAM_ACCESS_TOKEN || !process.env.INSTAGRAM_BUSINESS_ID)) {
            return res.status(200).json({
                success: false,
                message: 'Instagram não configurado. Post gerado mas não publicado.',
                setup: {
                    variaveis_necessarias: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ID'],
                    como_obter: 'Veja as instruções em /api/instagram/publish',
                },
            });
        }

        // STEP 1: Gerar o post (persona + destino + caption + imagem)
        const baseUrl = getBaseUrl(req);
        const generateUrl = `${baseUrl}/api/instagram/generate-post`;

        const generateBody = {};
        if (estilo) generateBody.estilo = estilo;
        if (origem) generateBody.origem = origem;

        const generateResponse = await fetch(generateUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': cronSecret ? `Bearer ${cronSecret}` : '',
            },
            body: JSON.stringify(generateBody),
        });

        if (!generateResponse.ok) {
            const errorData = await generateResponse.json().catch(() => ({}));
            throw new Error(`Falha ao gerar post: ${errorData.error || generateResponse.status}`);
        }

        const { post } = await generateResponse.json();

        console.log(`\n📝 Post gerado:`);
        console.log(`   Persona: ${post.persona.nome}, ${post.persona.profissao}`);
        console.log(`   Destino: ${post.destino.nome}, ${post.destino.pais}`);
        console.log(`   Preço: R$${post.destino.preco}`);
        console.log(`   Imagem: ${post.imagem.source}`);

        // Se é preview, retornar sem publicar
        if (isPreview) {
            console.log(`\n👁️ Modo PREVIEW - post não publicado`);
            return res.status(200).json({
                success: true,
                mode: 'preview',
                post,
            });
        }

        // STEP 2: Publicar no Instagram
        if (!post.imagem.url) {
            console.warn('⚠️ Sem imagem disponível, post não será publicado');
            return res.status(200).json({
                success: false,
                message: 'Post gerado mas sem imagem disponível para publicar',
                post,
            });
        }

        const publishUrl = `${baseUrl}/api/instagram/publish`;
        const publishResponse = await fetch(publishUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': cronSecret ? `Bearer ${cronSecret}` : '',
            },
            body: JSON.stringify({
                imageUrl: post.imagem.url,
                caption: post.fullCaption,
                altText: post.gancho,
                destinoNome: post.destino.nome,
                data: new Date().toISOString().split('T')[0],
            }),
        });

        const publishResult = await publishResponse.json();

        if (!publishResponse.ok || !publishResult.success) {
            console.error(`❌ Falha ao publicar:`, publishResult);
            return res.status(200).json({
                success: false,
                message: 'Post gerado mas falha ao publicar no Instagram',
                publishError: publishResult.error || publishResult,
                post,
            });
        }

        console.log(`\n✅ POST PUBLICADO COM SUCESSO!`);
        console.log(`   Media ID: ${publishResult.mediaId}`);
        console.log(`${'='.repeat(60)}\n`);

        return res.status(200).json({
            success: true,
            message: 'Post gerado e publicado no Instagram!',
            mediaId: publishResult.mediaId,
            post: {
                destino: post.destino,
                persona: post.persona,
                estilo: post.estilo,
            },
        });
    } catch (error) {
        console.error(`\n❌ INSTAGRAM CRON ERRO:`, error);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

// Helper para obter URL base
function getBaseUrl(req) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'benetrip.vercel.app';
    return `${proto}://${host}`;
}
