// api/sitemap.js - BENETRIP SITEMAP DINÂMICO v1.0
// Vercel Function que gera o sitemap.xml na hora, incluindo a página base de
// destinos-baratos e uma URL por cidade (long tail de SEO).
//
// Roteamento: vercel.json reescreve /sitemap.xml -> /api/sitemap

import { carregarCidades } from './_lib/discovery-shared.js';

const SITE_URL = 'https://benetrip.com.br';

// Páginas estáticas do site (mesma lista do sitemap.xml anterior)
const PAGINAS_ESTATICAS = [
    { loc: '/', changefreq: 'weekly', priority: '1.0' },
    { loc: '/descobrir-destinos', changefreq: 'weekly', priority: '0.9' },
    { loc: '/todos-destinos', changefreq: 'weekly', priority: '0.8' },
    { loc: '/voos', changefreq: 'daily', priority: '0.9' },
    { loc: '/voos-baratos', changefreq: 'daily', priority: '0.8' },
    { loc: '/comparar-voos', changefreq: 'daily', priority: '0.7' },
    { loc: '/multidatas', changefreq: 'daily', priority: '0.7' },
    { loc: '/roteiro-viagem', changefreq: 'weekly', priority: '0.8' },
    { loc: '/create-itinerary', changefreq: 'weekly', priority: '0.7' },
    { loc: '/chat', changefreq: 'weekly', priority: '0.6' },
    { loc: '/quemsomos', changefreq: 'monthly', priority: '0.5' },
    { loc: '/perguntasfrequentes', changefreq: 'monthly', priority: '0.5' },
    { loc: '/termos', changefreq: 'yearly', priority: '0.3' },
    { loc: '/privacidade', changefreq: 'yearly', priority: '0.3' },
    { loc: '/cookies', changefreq: 'yearly', priority: '0.3' },
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
        ...PAGINAS_ESTATICAS.map((p) => urlEntry(p.loc, hoje, p.changefreq, p.priority)),
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
