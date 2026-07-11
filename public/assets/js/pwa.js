/**
 * Benetrip PWA - registro do service worker
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(function (error) {
        console.warn('Benetrip PWA: falha ao registrar service worker', error);
      });
  });
})();
