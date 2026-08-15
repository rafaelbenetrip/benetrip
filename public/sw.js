/**
 * Benetrip Service Worker
 *
 * Estratégias:
 * - Navegação (HTML): network-first com fallback para cache e página offline
 * - Assets estáticos (CSS/JS/imagens/fontes): stale-while-revalidate
 * - APIs (/api/, /_vercel/) e requisições externas: nunca cacheadas
 *
 * Para forçar atualização em todos os clientes, incremente VERSION.
 */

const VERSION = 'benetrip-v2';
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;

const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/assets/images/favicon/web-app-manifest-192x192.png',
  '/logo-tripinha.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    /\.(css|js|png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nunca interceptar APIs, analytics ou requisições de outros domínios
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_vercel/')) return;

  // Navegação: network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Assets estáticos: stale-while-revalidate
  //
  // A revalidação usa cache: 'no-cache' de propósito. Sem isso ela caía no
  // cache HTTP do navegador (os assets vão com max-age=86400 no vercel.json)
  // e o Service Worker regravava a mesma cópia velha: uma correção de CSS
  // podia levar até um dia para aparecer, mesmo com o deploy pronto. Com
  // 'no-cache' o navegador revalida no servidor — 304 quando nada mudou,
  // então continua barato — e a correção entra na próxima navegação.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request, { cache: 'no-cache' })
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
