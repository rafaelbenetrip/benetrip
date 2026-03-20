// api/cron/instagram-post.js - Cron Job de Post Automático no Instagram v2.0
//
// Roda diariamente via Vercel Cron. Cada dia da semana publica um FORMATO diferente.
//
// CALENDÁRIO:
//   Dom: Descobridor (Persona Story) — card branded
//   Seg: Top 5 Mais Baratos — card branded
//   Ter: Economia (Preço Caiu!) — card branded
//   Qua: De Onde Sai Mais Barato — card branded
//   Qui: Roteiro dia-a-dia — card branded
//   Sex: Ranking Semanal — card branded
//   Sab: Descobridor (Persona Surpresa) — card branded
//
// TRIGGER: Vercel Cron (1x/dia às 12:00 UTC = 9:00 BRT)
// MANUAL: GET /api/cron/instagram-post?key=CRON_SECRET
// PREVIEW: GET /api/cron/instagram-post?key=CRON_SECRET&preview=true

export const maxDuration = 120;

const FORMATO_NOMES = {
    descobridor: 'Descobridor de Destinos',
    top5: 'Top 5 Mais Baratos',
    economia: 'Economia (Preço Caiu!)',
    origens: 'De Onde Sai Mais Barato',
    roteiro: 'Roteiro dia-a-dia',
    ranking: 'Ranking Semanal',
};

const FORMATO_POR_DIA = [
    'descobridor',  // Dom
    'top5',         // Seg
    'economia',     // Ter
    'origens',      // Qua
    'roteiro',      // Qui
    'ranking',      // Sex
    'descobridor',  // Sab
];

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Auth
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    const queryKey = req.query?.key;
    const isVercelCron = authHeader === `Bearer ${cronSecret}`;
    const isManualWithKey = queryKey && queryKey === cronSecret;

    if (cronSecret && !isVercelCron && !isManualWithKey) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    const isPreview = req.query?.preview === 'true';
    const formatoOverride = req.query?.formato || null;

    // Determinar formato do dia
    const dia = new Date().getDay();
    const formato = formatoOverride || FORMATO_POR_DIA[dia];
    const formatoNome = FORMATO_NOMES[formato] || formato;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📸 INSTAGRAM CRON v2.0 - ${new Date().toISOString()}`);
    console.log(`   ${DIAS_SEMANA[dia]} → Formato: ${formatoNome}`);
    console.log(`   Modo: ${isPreview ? 'PREVIEW (sem publicar)' : 'PUBLICAÇÃO'}`);
    console.log(`${'='.repeat(60)}`);

    try {
        // Verificar config Instagram (exceto preview)
        if (!isPreview && (!process.env.INSTAGRAM_ACCESS_TOKEN || !process.env.INSTAGRAM_BUSINESS_ID)) {
            return res.status(200).json({
                success: false,
                message: 'Instagram não configurado. Post gerado mas não publicado.',
                formato,
                setup: {
                    variaveis_necessarias: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ID'],
                },
            });
        }

        // STEP 1: Gerar post (formato-specific)
        const baseUrl = getBaseUrl(req);
        const generateUrl = `${baseUrl}/api/instagram/generate-post`;

        const generateResponse = await fetch(generateUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': cronSecret ? `Bearer ${cronSecret}` : '',
            },
            body: JSON.stringify({ formato }),
        });

        if (!generateResponse.ok) {
            const errorData = await generateResponse.json().catch(() => ({}));
            throw new Error(`Falha ao gerar post: ${errorData.error || generateResponse.status}`);
        }

        const { post } = await generateResponse.json();

        console.log(`\n📝 Post gerado:`);
        console.log(`   Formato: ${formato} (${formatoNome})`);
        console.log(`   Card URL: ${post.cardUrl ? 'Sim' : 'Não (fallback Pexels)'}`);
        console.log(`   Imagem: ${post.imagem?.source}`);
        if (post.destino) console.log(`   Destino: ${post.destino.nome}`);
        if (post.persona) console.log(`   Persona: ${post.persona.nome}`);

        // Preview mode
        if (isPreview) {
            console.log(`\n👁️ Modo PREVIEW - post não publicado`);
            return res.status(200).json({
                success: true,
                mode: 'preview',
                formato,
                formatoNome,
                dia: DIAS_SEMANA[dia],
                post,
            });
        }

        // STEP 2: Publicar no Instagram
        const imageUrl = post.imagem?.url;
        if (!imageUrl) {
            console.warn('⚠️ Sem imagem disponível');
            return res.status(200).json({
                success: false,
                message: 'Post gerado mas sem imagem disponível',
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
                imageUrl,
                caption: post.fullCaption,
                altText: post.gancho,
                destinoNome: post.destino?.nome || 'Vários',
                data: new Date().toISOString().split('T')[0],
            }),
        });

        const publishResult = await publishResponse.json();

        if (!publishResponse.ok || !publishResult.success) {
            console.error(`❌ Falha ao publicar:`, publishResult);
            return res.status(200).json({
                success: false,
                message: 'Post gerado mas falha ao publicar',
                publishError: publishResult.error || publishResult,
                formato,
                post,
            });
        }

        console.log(`\n✅ POST PUBLICADO COM SUCESSO!`);
        console.log(`   Media ID: ${publishResult.mediaId}`);
        console.log(`   Formato: ${formatoNome}`);
        console.log(`${'='.repeat(60)}\n`);

        return res.status(200).json({
            success: true,
            message: `Post ${formatoNome} publicado no Instagram!`,
            mediaId: publishResult.mediaId,
            formato,
            formatoNome,
            dia: DIAS_SEMANA[dia],
            post: {
                destino: post.destino,
                persona: post.persona,
                cardUrl: post.cardUrl,
            },
        });
    } catch (error) {
        console.error(`\n❌ INSTAGRAM CRON ERRO:`, error);
        return res.status(500).json({
            success: false,
            error: error.message,
            formato,
        });
    }
}

function getBaseUrl(req) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'benetrip.vercel.app';
    return `${proto}://${host}`;
}
