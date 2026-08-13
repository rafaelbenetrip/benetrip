/**
 * Benetrip Vai e Vem Promo — v1.0
 * Convite cruzado nas paginas de busca de voos: quando os resultados
 * aparecem, mostra um card "Faz essa rota sempre?" levando a rota
 * pesquisada pro Vai e Vem (/vai-e-vem?origem=XXX&destino=YYY).
 *
 * Funciona em qualquer pagina que tenha um destes containers de resultado:
 *   #results-content        (voos-baratos, comparar-voos)
 *   #state-results          (voos)
 *   #resultados-container   (multidatas)
 *
 * USO: <script src="assets/js/vai-e-vem-promo.js" defer></script>
 */
(function () {
  'use strict';

  var PROMO_ID = 'vev-promo';

  var CSS = [
    '.vev-promo { display: flex; align-items: center; gap: 16px; background: #FFF; border: 2px solid #FBCFE8; border-left: 6px solid #DB2777; border-radius: 16px; padding: 18px 20px; margin: 22px auto 8px; max-width: 800px; box-shadow: 0 4px 20px rgba(219, 39, 119, 0.08); font-family: "Montserrat", sans-serif; }',
    '.vev-promo-emoji { font-size: 1.9rem; flex-shrink: 0; }',
    '.vev-promo-body { flex: 1; min-width: 0; }',
    '.vev-promo-title { font-family: "Poppins", "Montserrat", sans-serif; font-size: 1rem; font-weight: 700; color: #21272A; margin: 0 0 4px; }',
    '.vev-promo-text { font-size: 0.85rem; color: #616161; line-height: 1.5; margin: 0; }',
    '.vev-promo-cta { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; padding: 11px 20px; background: linear-gradient(135deg, #DB2777, #F472B6); color: #FFF; text-decoration: none; border-radius: 50px; font-family: "Poppins", "Montserrat", sans-serif; font-size: 0.85rem; font-weight: 600; white-space: nowrap; box-shadow: 0 4px 14px rgba(219, 39, 119, 0.3); transition: transform 0.25s ease, box-shadow 0.25s ease; }',
    '.vev-promo-cta:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(219, 39, 119, 0.4); }',
    '@media (max-width: 640px) { .vev-promo { flex-direction: column; align-items: flex-start; gap: 10px; } .vev-promo-cta { align-self: stretch; justify-content: center; } }',
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('vev-promo-styles')) return;
    var style = document.createElement('style');
    style.id = 'vev-promo-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // --- Rota pesquisada (varia por pagina) ---
  function lerJsonInput(id) {
    var el = document.getElementById(id);
    if (!el || !el.value) return null;
    try {
      var d = JSON.parse(el.value);
      return d && d.code ? { code: d.code, name: d.name || d.code } : null;
    } catch (e) { return null; }
  }

  function getRoute() {
    // voos-baratos / comparar-voos / multidatas: hidden inputs com JSON
    var o = lerJsonInput('origem-data');
    var d = lerJsonInput('destino-data');
    if (o && d) return { origem: o, destino: d };

    // voos.html: codigos e nomes em inputs separados
    var oc = document.getElementById('sf-origin-code');
    var dc = document.getElementById('sf-dest-code');
    if (oc && dc && oc.value && dc.value) {
      var on = document.getElementById('sf-origin-name');
      var dn = document.getElementById('sf-dest-name');
      return {
        origem: { code: oc.value, name: (on && on.value) || oc.value },
        destino: { code: dc.value, name: (dn && dn.value) || dc.value },
      };
    }
    return null;
  }

  // --- Card ---
  function buildHref(route) {
    if (!route) return '/vai-e-vem';
    return '/vai-e-vem?origem=' + encodeURIComponent(route.origem.code) +
           '&destino=' + encodeURIComponent(route.destino.code);
  }

  function buildText(route) {
    if (!route) {
      return 'Visita a família, namora à distância ou trabalha em outra cidade? ' +
             'O Vai e Vem mostra quando sua rota de sempre fica mais barata nos próximos meses.';
    }
    return 'Se você vive indo e voltando entre <strong>' + route.origem.name +
           '</strong> e <strong>' + route.destino.name + '</strong>, seja por família, amor ou trabalho, ' +
           'o Vai e Vem mostra quando essa rota fica mais barata nos próximos meses, ' +
           'nos dias da semana que você costuma viajar.';
  }

  function upsertPromo(container) {
    var route = getRoute();
    var promo = document.getElementById(PROMO_ID);

    if (!promo) {
      promo = document.createElement('div');
      promo.id = PROMO_ID;
      promo.className = 'vev-promo';
      promo.innerHTML =
        '<span class="vev-promo-emoji">🔁</span>' +
        '<div class="vev-promo-body">' +
          '<p class="vev-promo-title">Faz essa rota sempre? 🐾</p>' +
          '<p class="vev-promo-text"></p>' +
        '</div>' +
        '<a class="vev-promo-cta" href="/vai-e-vem">Ver minha rota no Vai e Vem ' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="15" height="15"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
        '</a>';
      container.appendChild(promo);
    } else if (promo.parentElement !== container || promo !== container.lastElementChild) {
      container.appendChild(promo);
    }

    promo.querySelector('.vev-promo-text').innerHTML = buildText(route);
    promo.querySelector('.vev-promo-cta').href = buildHref(route);
  }

  function removePromo() {
    var promo = document.getElementById(PROMO_ID);
    if (promo) promo.remove();
  }

  // --- Observadores por tipo de container ---
  function watchChildList(container) {
    // Resultados injetados dinamicamente (ex.: #results-content):
    // mostra o convite quando ha conteudo, some junto quando a busca reseta.
    var observer = new MutationObserver(function () {
      var hasResults = Array.prototype.some.call(container.children, function (el) {
        return el.id !== PROMO_ID;
      });
      if (hasResults) {
        upsertPromo(container);
      } else {
        removePromo();
      }
    });
    observer.observe(container, { childList: true });
  }

  function watchVisibility(container) {
    // Containers estaticos que alternam display (ex.: #state-results):
    // acrescenta o convite quando ficam visiveis.
    function check() {
      if (container.style.display !== 'none') upsertPromo(container);
    }
    var observer = new MutationObserver(check);
    observer.observe(container, { attributes: true, attributeFilter: ['style'] });
    check();
  }

  function init() {
    // Nao faz sentido convidar pro Vai e Vem dentro do proprio Vai e Vem
    if (window.location.pathname.indexOf('vai-e-vem') !== -1) return;

    injectStyles();

    var dynamic = document.getElementById('results-content');
    if (dynamic) watchChildList(dynamic);

    ['state-results', 'resultados-container'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) watchVisibility(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
