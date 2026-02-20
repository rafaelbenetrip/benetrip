/**
 * Benetrip — Voos Baratos
 * assets/js/voos-baratos.js
 *
 * Autocomplete consome /data/cidades_global_iata_v4.json
 * Estrutura do JSON: [{ cidade, sigla_estado, pais, codigo_pais, iata, ... }]
 */

'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────
let AIRPORTS       = [];    // populado via fetch do JSON
let airportsReady  = false;
let selectedOrigin = null;
let selectedDest   = null;
let selectedDuration = null;
let flexMin = 5;
let flexMax = 12;

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const originInput   = document.getElementById('origin-input');
const destInput     = document.getElementById('dest-input');
const originList    = document.getElementById('origin-list');
const destList      = document.getElementById('dest-list');
const pills         = document.querySelectorAll('.pill');
const flexWrap      = document.getElementById('flexible-wrap');
const flexMinEl     = document.getElementById('flex-min');
const flexMaxEl     = document.getElementById('flex-max');
const flexLabel     = document.getElementById('flex-label');
const btnSearch     = document.getElementById('btn-search');
const loadingBox    = document.getElementById('loading-box');
const loadingSub    = document.getElementById('loading-sub');
const errorBox      = document.getElementById('error-box');
const errorMsg      = document.getElementById('error-msg');
const resultsHeader = document.getElementById('results-header');
const resultsRoute  = document.getElementById('results-route');
const resultCards   = document.getElementById('result-cards');
const tripinhaTip   = document.getElementById('tripinha-tip');
const tipText       = document.getElementById('tip-text');

// ─── LOAD AIRPORTS JSON ───────────────────────────────────────────────────────
async function loadAirports() {
  try {
    const res = await fetch('/data/cidades_global_iata_v4.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();

    // Normaliza, filtra entradas sem IATA válido
    const normalized = raw
      .filter(a => a.iata && a.iata.trim().length === 3)
      .map(a => ({
        iata:       a.iata.trim().toUpperCase(),
        cidade:     a.cidade        || '',
        estado:     a.sigla_estado  || '',
        pais:       a.pais          || '',
        codigo:     a.codigo_pais   || '',
        continente: a.continente    || '',
      }));

    // Remove IATAs duplicadas (mantém 1ª ocorrência)
    const seen = new Set();
    AIRPORTS = normalized.filter(a => {
      if (seen.has(a.iata)) return false;
      seen.add(a.iata);
      return true;
    });

    airportsReady = true;
    console.log(`[Benetrip] ${AIRPORTS.length} aeroportos carregados.`);
  } catch (err) {
    console.error('[Benetrip] Erro ao carregar aeroportos:', err);
    airportsReady = false;
  }
}

// ─── AUTOCOMPLETE SEARCH ──────────────────────────────────────────────────────
/**
 * Busca e pontua aeroportos pelo termo digitado.
 * Prioridade: IATA exato > começa com IATA > cidade exata >
 *             cidade começa com > cidade contém > país contém
 */
function searchAirports(query, limit = 8) {
  if (!query || query.length < 2 || !airportsReady) return [];

  const q = query.trim().toUpperCase();

  return AIRPORTS
    .map(a => {
      const iata   = a.iata;
      const cidade = a.cidade.toUpperCase();
      const pais   = a.pais.toUpperCase();
      const estado = a.estado.toUpperCase();
      let score = 0;

      if (iata === q)                 score = 1000;
      else if (iata.startsWith(q))    score = 800;
      else if (cidade === q)          score = 700;
      else if (cidade.startsWith(q))  score = 600;
      else if (cidade.includes(q))    score = 400;
      else if (estado === q)          score = 300;
      else if (pais.startsWith(q))    score = 200;
      else if (pais.includes(q))      score = 100;
      else return null;

      return { ...a, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── RENDER DROPDOWN ──────────────────────────────────────────────────────────
function renderDropdown(listEl, items, onSelect) {
  listEl.innerHTML = '';

  if (!airportsReady) {
    listEl.innerHTML = '<div class="autocomplete-msg">⏳ Carregando aeroportos...</div>';
    listEl.classList.add('visible');
    return;
  }

  if (!items.length) {
    listEl.classList.remove('visible');
    return;
  }

  items.forEach((airport, idx) => {
    const div = document.createElement('div');
    div.className = 'autocomplete-item';
    if (idx === 0) div.classList.add('focused');

    // Para cidades brasileiras mostra estado; para outras, mostra país
    const isBR = airport.codigo === 'BR';

    div.innerHTML = `
      <span class="iata">${airport.iata}</span>
      <span class="city-name">${airport.cidade}</span>
      ${isBR && airport.estado
        ? `<span class="state-tag">${airport.estado}</span>`
        : ''}
      <span class="country-name">${airport.pais}</span>
    `;

    div.addEventListener('mousedown', e => {
      e.preventDefault();
      onSelect(airport);
    });

    listEl.appendChild(div);
  });

  listEl.classList.add('visible');
}

// ─── LABEL DO AEROPORTO SELECIONADO ──────────────────────────────────────────
function airportLabel(airport) {
  const isBR = airport.codigo === 'BR';
  if (isBR && airport.estado) {
    return `${airport.iata} — ${airport.cidade}, ${airport.estado}`;
  }
  return `${airport.iata} — ${airport.cidade}, ${airport.pais}`;
}

// ─── SETUP AUTOCOMPLETE ───────────────────────────────────────────────────────
function setupAutocomplete(input, listEl, setterFn) {
  let debounceTimer = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    setterFn(null);
    checkReady();

    debounceTimer = setTimeout(() => {
      const results = searchAirports(input.value);
      renderDropdown(listEl, results, airport => {
        input.value = airportLabel(airport);
        listEl.classList.remove('visible');
        setterFn(airport.iata);
        checkReady();
      });
    }, 120);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => listEl.classList.remove('visible'), 200);
  });

  input.addEventListener('keydown', e => {
    const items = listEl.querySelectorAll('.autocomplete-item');
    if (e.key === 'Escape') {
      listEl.classList.remove('visible');
    } else if ((e.key === 'Enter' || e.key === 'Tab') && items.length) {
      e.preventDefault();
      items[0].dispatchEvent(new Event('mousedown'));
    }
  });
}

setupAutocomplete(originInput, originList, v => { selectedOrigin = v; });
setupAutocomplete(destInput,   destList,   v => { selectedDest   = v; });

// ─── DURATION PILLS ───────────────────────────────────────────────────────────
pills.forEach(pill => {
  pill.addEventListener('click', () => {
    pills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    selectedDuration = pill.dataset.days;
    flexWrap.classList.toggle('visible', selectedDuration === 'flex');
    checkReady();
  });
});

// ─── FLEXIBLE RANGE ───────────────────────────────────────────────────────────
function updateFlexLabel() {
  flexMin = parseInt(flexMinEl.value);
  flexMax = parseInt(flexMaxEl.value);
  if (flexMax < flexMin + 2) {
    flexMax = flexMin + 2;
    flexMaxEl.value = flexMax;
  }
  flexLabel.textContent = `${flexMin}–${flexMax} dias`;
}

flexMinEl.addEventListener('input', updateFlexLabel);
flexMaxEl.addEventListener('input', updateFlexLabel);
updateFlexLabel();

// ─── VALIDATION ───────────────────────────────────────────────────────────────
function checkReady() {
  btnSearch.disabled = !(
    selectedOrigin &&
    selectedDest &&
    selectedDuration &&
    selectedOrigin !== selectedDest
  );
}

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
const MONTHS_PT  = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const WEEKDAY_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${d} ${MONTHS_PT[m - 1]} ${y} (${WEEKDAY_PT[dt.getDay()]})`;
}

function fmtPrice(price) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(price);
}

function calcDays(dep, ret) {
  return Math.round((new Date(ret) - new Date(dep)) / 86_400_000);
}

// ─── GOOGLE FLIGHTS LINK ──────────────────────────────────────────────────────
function buildGoogleFlightsURL(origin, dest, depDate, retDate) {
  return `https://www.google.com/travel/flights?hl=pt-BR&curr=BRL` +
    `#search;f=${origin};t=${dest};d=${depDate};r=${retDate};tt=r;a=1`;
}

// ─── SEARCH HANDLER ───────────────────────────────────────────────────────────
btnSearch.addEventListener('click', async () => {
  if (!selectedOrigin || !selectedDest || !selectedDuration) return;

  hide(errorBox);
  hide(resultsHeader);
  hide(tripinhaTip);
  resultCards.innerHTML = '';
  show(loadingBox);
  btnSearch.disabled = true;

  const loadingMsgs = [
    'Consultando tarifas dos próximos 6 meses... 🗓️',
    'Comparando datas e preços... 💰',
    'Selecionando os melhores períodos... 🏆',
    'Quase lá! Farejando as últimas ofertas... 🐾',
  ];
  let msgIdx = 0;
  const msgTimer = setInterval(() => {
    msgIdx = (msgIdx + 1) % loadingMsgs.length;
    loadingSub.textContent = loadingMsgs[msgIdx];
  }, 2800);

  try {
    const payload = {
      origin:       selectedOrigin,
      destination:  selectedDest,
      durationType: selectedDuration,
      flexMin:      selectedDuration === 'flex' ? flexMin : null,
      flexMax:      selectedDuration === 'flex' ? flexMax : null,
    };

    const res = await fetch('/api/cheapest-flights', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    clearInterval(msgTimer);
    const data = await res.json();
    hide(loadingBox);

    if (!res.ok || data.error) {
      showError(data.error || 'Erro ao buscar tarifas. Tente novamente.');
      return;
    }

    if (!data.results?.length) {
      showError('Nenhuma tarifa encontrada para essa rota. Tente outra origem ou destino.');
      return;
    }

    renderResults(data);

  } catch (err) {
    clearInterval(msgTimer);
    hide(loadingBox);
    showError('Erro de conexão. Verifique sua internet e tente novamente.');
    console.error('[Benetrip]', err);
  } finally {
    btnSearch.disabled = false;
    checkReady();
  }
});

// ─── RENDER RESULTS ───────────────────────────────────────────────────────────
function renderResults(data) {
  const { results, origin, destination } = data;

  resultsRoute.textContent = `${origin} → ${destination}`;
  show(resultsHeader);
  resultCards.innerHTML = '';

  results.forEach((item, i) => {
    const isBest = i === 0;
    const days   = calcDays(item.departure, item.return);
    const gLink  = buildGoogleFlightsURL(origin, destination, item.departure, item.return);

    const card = document.createElement('a');
    card.href      = gLink;
    card.target    = '_blank';
    card.rel       = 'noopener noreferrer';
    card.className = 'result-card' + (isBest ? ' best' : '');
    card.style.animationDelay = `${i * 70}ms`;

    card.innerHTML = `
      <div class="result-rank">${i + 1}</div>
      <div class="result-dates">
        <div class="result-dates-main">✈️ ${fmtDate(item.departure)}</div>
        <div class="result-dates-detail">
          <span>🔙 Volta em ${fmtDate(item.return)}</span>
          <span class="result-duration">${days} dias</span>
          ${isBest ? '<span class="best-badge">⭐ Melhor preço</span>' : ''}
        </div>
      </div>
      <div class="result-price-wrap">
        <div class="result-price-label">ida e volta / pessoa</div>
        <div class="result-price">${fmtPrice(item.price)}</div>
        <a
          class="btn-book"
          href="${gLink}"
          target="_blank"
          rel="noopener noreferrer"
          onclick="event.stopPropagation()"
        >Ver no Google ✈️</a>
      </div>
    `;

    resultCards.appendChild(card);
  });

  // Tripinha tip
  const [y, m, d]  = results[0].departure.split('-').map(Number);
  const cheapMonth  = new Date(y, m - 1, d).toLocaleString('pt-BR', { month: 'long' });
  const savings     = results[results.length - 1].price - results[0].price;

  tipText.innerHTML = `
    Farejei os próximos <strong>6 meses</strong> e encontrei
    <strong>${results.length} ótimos períodos</strong> para você!
    ${savings > 0
      ? `Viajando em <strong>${cheapMonth}</strong>, você economiza até
         <strong>${fmtPrice(savings)}</strong> em relação ao período mais caro da lista. 🎉`
      : `O menor preço encontrado é <strong>${fmtPrice(results[0].price)}</strong>.`}
    Clique em qualquer card para ver os voos no Google Flights!
  `;
  show(tripinhaTip);

  resultsHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function show(el) { el.classList.add('visible'); }
function hide(el) { el.classList.remove('visible'); }
function showError(msg) {
  errorMsg.textContent = '😕 ' + msg;
  show(errorBox);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadAirports();
