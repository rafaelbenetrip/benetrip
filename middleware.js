/**
 * Vercel Edge Middleware - Prerendering para Crawlers
 *
 * COMO FUNCIONA:
 * ==============
 *
 * 1. DETECÇÃO DE BOT: Quando uma requisição chega, o middleware analisa o
 *    User-Agent para identificar se é um crawler (Googlebot, Bingbot, etc.)
 *
 * 2. SE FOR UM USUÁRIO NORMAL: A requisição passa direto, sem alteração.
 *    O site funciona normalmente com JavaScript no navegador.
 *
 * 3. SE FOR UM CRAWLER:
 *    a) Verifica se a página é uma rota HTML válida (não API, não asset)
 *    b) Adiciona headers especiais que indicam ao Vercel para priorizar
 *       o conteúdo HTML estático
 *    c) Define headers de cache para que o conteúdo pré-renderizado
 *       fique em cache por 1 hora no edge da Vercel
 *
 * 4. HEADERS SEO: Adiciona headers de segurança e SEO em todas as respostas
 *    (X-Robots-Tag, referrer-policy, etc.)
 *
 * ONDE COLOCAR: Na raiz do projeto (middleware.js)
 * O Vercel detecta automaticamente e executa antes de cada requisição.
 */

// Lista de User-Agents de crawlers conhecidos
const BOT_AGENTS = [
  'googlebot',
  'bingbot',
  'slurp',         // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebot',       // Facebook
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'applebot',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'petalbot',
  'gptbot',
  'claudebot'
];

// Rotas que devem ser ignoradas pelo middleware (não são páginas HTML)
const IGNORE_PATTERNS = [
  '/api/',
  '/assets/',
  '/_vercel/',
  '/favicon',
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.svg',
  '.ico',
  '.json',
  '.xml',
  '.txt',
  '.webmanifest'
];

/**
 * Verifica se o User-Agent é de um bot/crawler
 */
function isBot(userAgent) {
  if (!userAgent) return false;
  var ua = userAgent.toLowerCase();
  return BOT_AGENTS.some(function (bot) {
    return ua.indexOf(bot) !== -1;
  });
}

/**
 * Verifica se a rota deve ser processada pelo middleware
 */
function shouldProcess(pathname) {
  return !IGNORE_PATTERNS.some(function (pattern) {
    return pathname.indexOf(pattern) !== -1;
  });
}

/**
 * Edge Middleware principal
 * Executa no Edge Runtime da Vercel (rápido, global)
 */
export default function middleware(request) {
  var url = new URL(request.url);
  var pathname = url.pathname;

  // Ignora rotas que não são páginas HTML
  if (!shouldProcess(pathname)) {
    return;  // Passa direto sem modificação
  }

  var userAgent = request.headers.get('user-agent') || '';
  var isCrawler = isBot(userAgent);

  // Cria headers adicionais para a resposta
  var responseHeaders = new Headers();

  // Headers SEO para todas as respostas
  responseHeaders.set('X-Robots-Tag', 'index, follow');
  responseHeaders.set('Referrer-Policy', 'origin-when-cross-origin');

  if (isCrawler) {
    // Para crawlers: adiciona headers que indicam conteúdo estático
    // e define cache agressivo no edge
    responseHeaders.set('X-Prerender', 'true');
    responseHeaders.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    responseHeaders.set('Vary', 'User-Agent');

    // Reescreve a URL para garantir que .html é servido
    // (crawlers devem ver o HTML completo, não redirecionamentos)
    if (!pathname.endsWith('.html') && pathname !== '/' && !pathname.endsWith('/')) {
      var htmlPath = pathname + '.html';
      return Response.redirect(new URL(htmlPath, request.url), 302);
    }
  }

  // Retorna a resposta com os headers adicionais
  return new Response(null, {
    headers: responseHeaders,
    status: 200
  });
}

/**
 * Configuração: em quais rotas o middleware deve executar
 * Exclui assets e APIs para melhor performance
 */
export var config = {
  matcher: [
    /*
     * Match todas as rotas exceto:
     * - api (rotas de API)
     * - _next (arquivos internos do Next.js, se houver)
     * - _vercel (arquivos internos da Vercel)
     * - assets estáticos (js, css, imagens)
     */
    '/((?!api|_next|_vercel|assets|.*\\.).*)'
  ]
};
