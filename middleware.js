/**
 * Vercel Edge Middleware - Prerendering com Prerender.io
 *
 * COMO FUNCIONA:
 * ==============
 *
 * 1. DETECÇÃO DE BOT: Analisa o User-Agent para identificar crawlers
 *
 * 2. SE FOR UM USUÁRIO NORMAL: Passa direto, sem alteração
 *
 * 3. SE FOR UM CRAWLER (Googlebot, etc.):
 *    a) Redireciona a requisição para o Prerender.io
 *    b) O Prerender.io abre a página num Chrome headless
 *    c) Espera o JavaScript executar e renderizar todo o conteúdo
 *    d) Devolve o HTML completo e estático para o crawler
 *    e) O crawler vê TUDO: cards de destinos, resultados de voos, etc.
 *
 * 4. CACHE: O Prerender.io mantém cache das páginas renderizadas,
 *    então a segunda visita do Googlebot é instantânea
 *
 * CONFIGURAÇÃO:
 * - Token do Prerender.io deve estar na variável de ambiente PRERENDER_TOKEN
 *   no painel da Vercel (Settings > Environment Variables)
 * - Ou diretamente no .env local para testes
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
 * Busca a página pré-renderizada no Prerender.io
 *
 * O Prerender.io funciona assim:
 * 1. Recebe a URL da sua página
 * 2. Abre num Chrome headless (navegador sem tela)
 * 3. Espera o JavaScript executar completamente
 * 4. Captura o HTML final (com todo o conteúdo renderizado)
 * 5. Devolve esse HTML estático
 *
 * Para o Googlebot, é como se a página fosse 100% HTML estático!
 */
async function getPrerenderedPage(url, token) {
  var prerenderUrl = 'https://service.prerender.io/' + url;

  var response = await fetch(prerenderUrl, {
    headers: {
      'X-Prerender-Token': token
    },
    redirect: 'follow'
  });

  if (!response.ok) {
    // Se o Prerender.io falhar, retorna null para servir a página normal
    return null;
  }

  var html = await response.text();

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Prerender': 'true',
      'X-Robots-Tag': 'index, follow',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Vary': 'User-Agent'
    }
  });
}

/**
 * Edge Middleware principal
 * Executa no Edge Runtime da Vercel (rápido, global)
 */
export default async function middleware(request) {
  var url = new URL(request.url);
  var pathname = url.pathname;

  // Ignora rotas que não são páginas HTML
  if (!shouldProcess(pathname)) {
    return;  // Passa direto sem modificação
  }

  var userAgent = request.headers.get('user-agent') || '';
  var isCrawler = isBot(userAgent);

  if (isCrawler) {
    // Pega o token do Prerender.io das variáveis de ambiente
    var token = process.env.PRERENDER_TOKEN;

    if (token) {
      // Monta a URL limpa (sem extensão .html) — as rotas do vercel.json
      // servem os arquivos HTML a partir das URLs canônicas sem extensão
      var pageUrl = url.origin + pathname;

      // Tenta buscar a versão pré-renderizada
      var prerendered = await getPrerenderedPage(pageUrl, token);
      if (prerendered) {
        return prerendered;
      }
    }

    // Fallback: se não tem token ou Prerender.io falhou, passa direto
    // (não retornar Response vazia — isso serviria HTML em branco ao crawler)
    return;
  }

  // Para usuários normais: não faz nada, deixa passar
  return;
}

/**
 * Configuração: em quais rotas o middleware deve executar
 * Exclui assets e APIs para melhor performance
 */
export var config = {
  matcher: [
    '/((?!api|_next|_vercel|assets|.*\\.).*)'
  ]
};
