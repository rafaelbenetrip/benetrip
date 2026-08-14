// api/sitemap.js - BENETRIP SITEMAP DINÂMICO v1.0
// Vercel Function que gera o sitemap.xml na hora, incluindo a página base de
// destinos-baratos e uma URL por cidade (long tail de SEO).
//
// Roteamento: vercel.json reescreve /sitemap.xml -> /api/sitemap

import { carregarCidades } from './_lib/discovery-shared.js';

const SITE_URL = 'https://benetrip.com.br';

// Páginas estáticas do site.
//
// `lastmod` é FIXO por página e só muda quando o conteúdo muda de verdade:
// carimbar a data de hoje em tudo a cada deploy ensina o crawler a ignorar o
// campo. As páginas movidas a dados (destinos-baratos e escapadas) são a
// exceção legítima, porque o snapshot realmente muda todo dia.
//
// FORA DO SITEMAP de propósito:
//   /multidatas       -> duplicava a matriz de datas do Comparar Voos.
//                        Agora responde 308 para /comparar-voos.
//   /create-itinerary -> duplicava o formulário do Roteiro de Viagem.
//                        Agora responde 308 para /roteiro-viagem.
//   /chat             -> fluxo conversacional legado, mantido no ar porque
//                        ainda é acessado a partir de /destinos, mas
//                        superado pela Descoberta. Sem valor de indexação.
const PAGINAS_ESTATICAS = [
    { loc: '/', changefreq: 'weekly', priority: '1.0', lastmod: '2026-08-13' },
    { loc: '/descobrir-destinos', changefreq: 'weekly', priority: '0.9', lastmod: '2026-08-13' },
    { loc: '/todos-destinos', changefreq: 'weekly', priority: '0.8', lastmod: '2026-08-13' },
    { loc: '/voos', changefreq: 'daily', priority: '0.9', lastmod: '2026-08-13' },
    { loc: '/voos-baratos', changefreq: 'daily', priority: '0.8', lastmod: '2026-08-13' },
    { loc: '/vai-e-vem', changefreq: 'daily', priority: '0.8', lastmod: '2026-08-13' },
    { loc: '/comparar-voos', changefreq: 'daily', priority: '0.7', lastmod: '2026-08-13' },
    { loc: '/roteiro-viagem', changefreq: 'weekly', priority: '0.8', lastmod: '2026-08-13' },
    { loc: '/quemsomos', changefreq: 'monthly', priority: '0.5', lastmod: '2026-02-01' },
    { loc: '/perguntasfrequentes', changefreq: 'monthly', priority: '0.5', lastmod: '2026-02-01' },
    { loc: '/termos', changefreq: 'yearly', priority: '0.3', lastmod: '2026-02-01' },
    { loc: '/privacidade', changefreq: 'yearly', priority: '0.3', lastmod: '2026-08-13' },
    { loc: '/cookies', changefreq: 'yearly', priority: '0.3', lastmod: '2026-02-01' },
];

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).send('Método não permitido');
    }

    let cidades;
    try {
        cidades = carregarCidades();
    } catch (err) {
        console.error('[sitemap] Erro ao carregar lista de cidades:', err);
        return res.status(500).send('Erro ao gerar sitemap');
    }

    const hoje = new Date().toISOString().split('T')[0];

    const urls = [
        ...PAGINAS_ESTATICAS.map((p) => urlEntry(p.loc, p.lastmod, p.changefreq, p.priority)),
        urlEntry('/destinos-baratos', hoje, 'daily', '0.9'),
        // São Paulo (GRU) não entra separado: /destinos-baratos/sao-paulo redireciona pra base
        ...cidades
            .filter((c) => c.slug !== 'sao-paulo')
            .map((c) => urlEntry(`/destinos-baratos/${c.slug}`, hoje, 'daily', '0.7')),
        urlEntry('/escapadas', hoje, 'daily', '0.9'),
        // Mesma regra: /escapadas/sao-paulo redireciona pra base
        ...cidades
            .filter((c) => c.slug !== 'sao-paulo')
            .map((c) => urlEntry(`/escapadas/${c.slug}`, hoje, 'daily', '0.7')),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    return res.status(200).send(xml);
}

function urlEntry(loc, lastmod, changefreq, priority) {
    return `  <url>\n    <loc>${SITE_URL}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}
