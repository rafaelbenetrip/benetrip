/**
 * BENETRIP VOOS v2.0 — Página completa de busca de voos
 *
 * Funciona de duas formas:
 * A) Acesso direto: Mostra formulário completo para busca manual
 * B) Via URL params (vindo do "Descobrir Destinos"): Auto-preenche e busca
 *
 * Fluxo:
 * 1. Carrega cidades para autocomplete
 * 2. Se tem params na URL → preenche form e busca automaticamente
 * 3. Se não → mostra form vazio para busca manual
 * 4. Busca: /api/flight-search → polling /api/flight-results → exibe
 * 5. Clique "Reservar" → /api/flight-click → redirect
 */

const BenetripVoos = {

    // ================================================================
    // STATE
    // ================================================================
    state: {
        cidadesData: null,
        params: {},
        searchId: null,
        currencyRates: {},
        proposals: [],
        searchComplete: false,
        pollTimer: null,
        pollCount: 0,
        maxPolls: 40,
        displayedCount: 0,
        perPage: 10,
        sortBy: 'cheapest',
        filterStops: 'all',
        resultsShown: false,
        tipInterval: null,
    },

    CURRENCY: {
        'BRL': { sym: 'R$', name: 'Real', locale: 'pt-BR' },
        'USD': { sym: 'US$', name: 'Dólar', locale: 'en-US' },
        'EUR': { sym: '€', name: 'Euro', locale: 'de-DE' },
    },

    // ================================================================
    // INIT
    // ================================================================
    async init() {
        console.log('✈️ BenetripVoos v2.0');
        await this.loadCities();
        this.setupSearchForm();
        this.setupSortAndFilters();

        // Checar se tem params na URL → auto-buscar
        const urlParams = this.parseUrlParams();
        if (urlParams.origin && urlParams.destination && urlParams.departure_date) {
            this.prefillForm(urlParams);
            // Pequeno delay pra o form renderizar
            setTimeout(() => this.submitSearch(), 300);
        }
    },

    // ================================================================
    // CARREGAR CIDADES (mesmo JSON do descobrir-destinos)
    // ================================================================
    async loadCities() {
        try {
            const r = await fetch('data/cidades_global_iata_v5.json');
            if (!r.ok) throw new Error('Erro');
            const data = await r.json();
            this.state.cidadesData = data.filter(c => c.iata);
            console.log(`✅ ${this.state.cidadesData.length} cidades carregadas`);
        } catch (e) {
            console.warn('⚠️ Fallback cidades');
            this.state.cidadesData = [
                { cidade:'São Paulo', sigla_estado:'SP', pais:'Brasil', codigo_pais:'BR', iata:'GRU', aeroporto:'Guarulhos' },
                { cidade:'São Paulo', sigla_estado:'SP', pais:'Brasil', codigo_pais:'BR', iata:'CGH', aeroporto:'Congonhas' },
                { cidade:'Rio de Janeiro', sigla_estado:'RJ', pais:'Brasil', codigo_pais:'BR', iata:'GIG', aeroporto:'Galeão' },
                { cidade:'Salvador', sigla_estado:'BA', pais:'Brasil', codigo_pais:'BR', iata:'SSA' },
                { cidade:'Brasília', sigla_estado:'DF', pais:'Brasil', codigo_pais:'BR', iata:'BSB' },
            ];
        }
    },

    normalize(t) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); },

    searchCities(term) {
        if (!this.state.cidadesData || term.length < 2) return [];
        const n = this.normalize(term);
        return this.state.cidadesData
            .filter(c => {
                const cn = this.normalize(c.cidade);
                const an = c.aeroporto ? this.normalize(c.aeroporto) : '';
                return cn.includes(n) || c.iata.toLowerCase().includes(n) || an.includes(n);
            })
            .slice(0, 8)
            .map(c => ({
                code: c.iata,
                name: c.cidade,
                state: c.sigla_estado,
                country: c.pais,
                airport: c.aeroporto || null,
            }));
    },

    // ================================================================
    // PARSE URL PARAMS
    // ================================================================
    parseUrlParams() {
        const u = new URL(window.location.href);
        const p = u.searchParams;
        return {
            origin: (p.get('origin') || '').toUpperCase(),
            destination: (p.get('destination') || '').toUpperCase(),
            departure_date: p.get('departure_date') || '',
            return_date: p.get('return_date') || '',
            adults: parseInt(p.get('adults') || '1'),
            children: parseInt(p.get('children') || '0'),
            infants: parseInt(p.get('infants') || '0'),
            currency: (p.get('currency') || 'BRL').toUpperCase(),
            origin_name: p.get('origin_name') || '',
            destination_name: p.get('destination_name') || '',
        };
    },

    // ================================================================
    // PREFILL FORM FROM URL
    // ================================================================
    prefillForm(p) {
        // Origin
        document.getElementById('sf-input-origin').value = p.origin_name ? `${p.origin_name} (${p.origin})` : p.origin;
        document.getElementById('sf-origin-code').value = p.origin;
        document.getElementById('sf-origin-name').value = p.origin_name || p.origin;
        // Destination
        document.getElementById('sf-input-dest').value = p.destination_name ? `${p.destination_name} (${p.destination})` : p.destination;
        document.getElementById('sf-dest-code').value = p.destination;
        document.getElementById('sf-dest-name').value = p.destination_name || p.destination;
        // Dates
        if (p.departure_date) {
            document.getElementById('sf-departure').value = p.departure_date;
            document.getElementById('sf-return').value = p.return_date;
            const fmt = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '';
            document.getElementById('sf-input-dates').value = p.return_date
                ? `${fmt(p.departure_date)} — ${fmt(p.return_date)}`
                : fmt(p.departure_date);
        }
        // Passengers
        document.getElementById('pax-adults').value = p.adults;
        document.getElementById('pax-children').value = p.children;
        document.getElementById('pax-infants').value = p.infants;
        this.updatePaxSummary();
        // Currency
        document.getElementById('sf-currency').value = p.currency;
    },

    // ================================================================
    // SETUP SEARCH FORM
    // ================================================================
    setupSearchForm() {
        // Autocomplete for origin
        this.setupAutocomplete('sf-input-origin', 'sf-dropdown-origin', 'sf-origin-code', 'sf-origin-name');
        // Autocomplete for destination
        this.setupAutocomplete('sf-input-dest', 'sf-dropdown-dest', 'sf-dest-code', 'sf-dest-name');

        // Swap button
        document.getElementById('sf-swap').addEventListener('click', () => {
            const oi = document.getElementById('sf-input-origin');
            const di = document.getElementById('sf-input-dest');
            const oc = document.getElementById('sf-origin-code');
            const dc = document.getElementById('sf-dest-code');
            const on = document.getElementById('sf-origin-name');
            const dn = document.getElementById('sf-dest-name');
            [oi.value, di.value] = [di.value, oi.value];
            [oc.value, dc.value] = [dc.value, oc.value];
            [on.value, dn.value] = [dn.value, on.value];
        });

        // Calendar
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        flatpickr('#sf-input-dates', {
            mode: 'range', minDate: tomorrow, dateFormat: 'Y-m-d', locale: 'pt',
            onChange: (sel) => {
                if (sel.length === 2) {
                    document.getElementById('sf-departure').value = this.isoDate(sel[0]);
                    document.getElementById('sf-return').value = this.isoDate(sel[1]);
                    document.getElementById('sf-input-dates').value =
                        `${this.brDate(sel[0])} — ${this.brDate(sel[1])}`;
                } else if (sel.length === 1) {
                    document.getElementById('sf-departure').value = this.isoDate(sel[0]);
                    document.getElementById('sf-return').value = '';
                }
            }
        });

        // Passengers dropdown
        const trigger = document.getElementById('sf-pax-trigger');
        const dropdown = document.getElementById('sf-pax-dropdown');
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });
        document.getElementById('sf-pax-done').addEventListener('click', () => {
            dropdown.classList.remove('open');
        });
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== trigger) dropdown.classList.remove('open');
        });
        document.querySelectorAll('.pax-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const inp = document.getElementById(btn.dataset.t);
                const v = parseInt(inp.value);
                const min = parseInt(inp.min), max = parseInt(inp.max);
                if (btn.dataset.a === 'inc' && v < max) inp.value = v + 1;
                if (btn.dataset.a === 'dec' && v > min) inp.value = v - 1;
                // Bebês <= adultos
                const a = parseInt(document.getElementById('pax-adults').value);
                const i = parseInt(document.getElementById('pax-infants').value);
                if (i > a) document.getElementById('pax-infants').value = a;
                this.updatePaxSummary();
            });
        });

        // Form submit
        document.getElementById('search-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitSearch();
        });

        // Route bar edit
        document.getElementById('route-edit').addEventListener('click', () => this.showSearchForm());
    },

    setupAutocomplete(inputId, dropdownId, hiddenCodeId, hiddenNameId) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        const hiddenCode = document.getElementById(hiddenCodeId);
        const hiddenName = document.getElementById(hiddenNameId);
        let timer;

        input.addEventListener('input', () => {
            clearTimeout(timer);
            const term = input.value.trim();
            if (term.length < 2) { dropdown.classList.remove('open'); hiddenCode.value = ''; return; }
            timer = setTimeout(() => {
                const results = this.searchCities(term);
                if (results.length === 0) {
                    dropdown.innerHTML = '<div style="padding:12px;color:#999;font-size:13px">Nenhum resultado</div>';
                } else {
                    dropdown.innerHTML = results.map(c => `
                        <div class="sf-dd-item" data-code="${c.code}" data-name="${c.name}" data-full="${c.name}${c.airport ? ' — ' + c.airport : ''} (${c.code})">
                            <span class="sf-dd-code">${c.code}</span>
                            <div class="sf-dd-info">
                                <div class="sf-dd-name">${c.name}${c.state ? ', ' + c.state : ''}${c.airport ? ' — ' + c.airport : ''}</div>
                                <div class="sf-dd-sub">${c.country}</div>
                            </div>
                        </div>
                    `).join('');
                }
                dropdown.classList.add('open');
                dropdown.querySelectorAll('.sf-dd-item').forEach(item => {
                    item.addEventListener('click', () => {
                        input.value = item.dataset.full;
                        hiddenCode.value = item.dataset.code;
                        hiddenName.value = item.dataset.name;
                        dropdown.classList.remove('open');
                    });
                });
            }, 250);
        });

        input.addEventListener('focus', () => {
            if (dropdown.children.length > 0 && input.value.length >= 2) dropdown.classList.add('open');
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.remove('open');
        });
    },

    updatePaxSummary() {
        const a = parseInt(document.getElementById('pax-adults').value);
        const c = parseInt(document.getElementById('pax-children').value);
        const i = parseInt(document.getElementById('pax-infants').value);
        const parts = [];
        parts.push(`${a} adulto${a > 1 ? 's' : ''}`);
        if (c > 0) parts.push(`${c} criança${c > 1 ? 's' : ''}`);
        if (i > 0) parts.push(`${i} bebê${i > 1 ? 's' : ''}`);
        document.getElementById('sf-pax-summary').textContent = parts.join(', ');
    },

    isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
    brDate(d) { return d.toLocaleDateString('pt-BR'); },

    // ================================================================
    // SUBMIT SEARCH (from form or URL)
    // ================================================================
    submitSearch() {
        // Collect form data
        const originCode = document.getElementById('sf-origin-code').value;
        const destCode = document.getElementById('sf-dest-code').value;
        const dep = document.getElementById('sf-departure').value;
        const ret = document.getElementById('sf-return').value;

        if (!originCode) { alert('Selecione a cidade de origem'); return; }
        if (!destCode) { alert('Selecione o destino'); return; }
        if (!dep) { alert('Selecione as datas'); return; }

        this.state.params = {
            origin: originCode,
            destination: destCode,
            departure_date: dep,
            return_date: ret,
            adults: parseInt(document.getElementById('pax-adults').value),
            children: parseInt(document.getElementById('pax-children').value),
            infants: parseInt(document.getElementById('pax-infants').value),
            currency: document.getElementById('sf-currency').value,
            origin_name: document.getElementById('sf-origin-name').value || originCode,
            destination_name: document.getElementById('sf-dest-name').value || destCode,
        };

        // Update URL (sem recarregar)
        const sp = new URLSearchParams(this.state.params);
        history.replaceState(null, '', `?${sp.toString()}`);

        // Update route bar
        this.updateRouteBar();

        // Show loading, hide form
        this.hideSearchForm();
        this.showPanel('loading');
        this.resetSearchState();
        this.startSearch();
    },

    // ================================================================
    // UI VISIBILITY
    // ================================================================
    showSearchForm() {
        document.getElementById('search-section').style.display = 'block';
        document.getElementById('search-section').classList.remove('compact');
        document.getElementById('route-bar').style.display = 'none';
        this.hideAllPanels();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    hideSearchForm() {
        document.getElementById('search-section').style.display = 'none';
        document.getElementById('route-bar').style.display = 'block';
    },

    showPanel(name) {
        this.hideAllPanels();
        const el = document.getElementById(`state-${name}`);
        if (el) el.style.display = 'block';
    },

    hideAllPanels() {
        ['loading', 'error', 'empty', 'results'].forEach(n => {
            const el = document.getElementById(`state-${n}`);
            if (el) el.style.display = 'none';
        });
    },

    updateRouteBar() {
        const p = this.state.params;
        document.getElementById('rb-origin').textContent = p.origin_name || p.origin;
        document.getElementById('rb-dest').textContent = p.destination_name || p.destination;

        const fmt = (iso) => iso ? new Date(iso+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : '';
        document.getElementById('rb-dates').textContent = p.return_date
            ? `${fmt(p.departure_date)} → ${fmt(p.return_date)}`
            : `${fmt(p.departure_date)} (só ida)`;

        const parts = [];
        if (p.adults) parts.push(`${p.adults} ad`);
        if (p.children) parts.push(`${p.children} cri`);
        if (p.infants) parts.push(`${p.infants} bb`);
        document.getElementById('rb-pax').textContent = parts.join(', ');
        document.getElementById('rb-currency').textContent = p.currency;
    },

    // ================================================================
    // SEARCH FLOW
    // ================================================================
    resetSearchState() {
        this.state.searchId = null;
        this.state.proposals = [];
        this.state.searchComplete = false;
        this.state.resultsShown = false;
        this.state.displayedCount = 0;
        this.state.pollCount = 0;
        if (this.state.pollTimer) clearTimeout(this.state.pollTimer);
        if (this.state.tipInterval) clearInterval(this.state.tipInterval);
    },

    async startSearch() {
        this.setProgress(10, 'Iniciando busca de voos...');
        this.startTips();

        try {
            const r = await fetch('/api/flight-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.state.params)
            });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(err.error || err.message || err.detail || `Erro ${r.status}`);
            }
            const data = await r.json();
            if (!data.search_id) throw new Error('Sem search_id');

            this.state.searchId = data.search_id;
            this.state.currencyRates = data.currency_rates || {};
            this.setProgress(20, 'Consultando companhias aéreas...');
            this.poll();
        } catch (err) {
            console.error('❌', err);
            this.showError(err.message);
        }
    },

    async poll() {
        if (this.state.searchComplete || this.state.pollCount >= this.state.maxPolls) {
            this.finishSearch();
            return;
        }
        this.state.pollCount++;
        try {
            const r = await fetch(`/api/flight-results?uuid=${this.state.searchId}&currency=${this.state.params.currency}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();

            const pct = Math.min(90, 20 + (this.state.pollCount / this.state.maxPolls) * 70);
            this.setProgress(pct, data.total > 0 ? `${data.total} ofertas encontradas...` : 'Consultando agências...');

            if (data.proposals?.length > 0) {
                this.state.proposals = data.proposals;
                if (data.total >= 3 && !this.state.resultsShown) {
                    this.state.resultsShown = true;
                    this.showResults();
                }
            }
            if (data.completed) {
                this.state.searchComplete = true;
                this.finishSearch();
                return;
            }
            this.state.pollTimer = setTimeout(() => this.poll(), this.state.pollCount < 5 ? 2000 : 1500);
        } catch (e) {
            console.warn('Poll error:', e.message);
            this.state.pollTimer = setTimeout(() => this.poll(), 2000);
        }
    },

    finishSearch() {
        if (this.state.pollTimer) clearTimeout(this.state.pollTimer);
        if (this.state.tipInterval) clearInterval(this.state.tipInterval);
        this.setProgress(100, 'Busca concluída!');

        if (this.state.proposals.length === 0) {
            this.showPanel('empty');
            return;
        }
        if (!this.state.resultsShown) this.showResults();
        else this.renderCards();
    },

    retrySearch() {
        this.resetSearchState();
        this.showPanel('loading');
        this.startSearch();
    },

    showError(msg) {
        document.getElementById('error-msg').textContent = msg;
        this.showPanel('error');
    },

    showResults() {
        this.showPanel('results');
        this.renderCards();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    setProgress(pct, msg) {
        const bar = document.getElementById('progress-fill');
        if (bar) bar.style.width = `${pct}%`;
        const m = document.getElementById('loading-msg');
        if (m) m.textContent = msg;
    },

    startTips() {
        const tips = [
            '💡 Os preços são por pessoa, ida e volta',
            '✈️ Comparando dezenas de companhias aéreas',
            '🔍 Buscando as melhores tarifas',
            '💰 Preços na moeda que você escolheu',
            '🐕 A Tripinha está farejando ofertas!',
            '⏰ A busca leva até 60 segundos',
        ];
        let i = 0;
        this.state.tipInterval = setInterval(() => {
            i = (i + 1) % tips.length;
            const el = document.getElementById('loading-tip');
            if (el) el.textContent = tips[i];
        }, 4000);
    },

    // ================================================================
    // FORMAT HELPERS
    // ================================================================
    fmtPrice(v) {
        const c = this.CURRENCY[this.state.params.currency] || this.CURRENCY.BRL;
        return `${c.sym} ${Math.round(v).toLocaleString('pt-BR')}`;
    },
    fmtDuration(min) {
        if (!min || min <= 0) return '--';
        const h = Math.floor(min / 60), m = min % 60;
        if (h === 0) return `${m}min`;
        if (m === 0) return `${h}h`;
        return `${h}h${String(m).padStart(2, '0')}`;
    },
    fmtTime(t) { return (t || '--:--').substring(0, 5); },
    stopsClass(s) { return s === 0 ? 's0' : s === 1 ? 's1' : 's2'; },
    stopsText(s) { return s === 0 ? 'Direto' : s === 1 ? '1 parada' : `${s} paradas`; },
    airlineLogo(iata) { return iata ? `https://pics.avs.io/60/60/${iata}.png` : ''; },

    pricePerPerson(total) {
        const { adults, children } = this.state.params;
        const paying = (adults || 1) + (children || 0);
        return paying > 0 ? Math.round(total / paying) : total;
    },

    // ================================================================
    // SORT & FILTER
    // ================================================================
    setupSortAndFilters() {
        document.querySelectorAll('.sort-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.sort-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.state.sortBy = tab.dataset.sort;
                this.state.displayedCount = 0;
                this.renderCards();
            });
        });

        const stopsBtn = document.getElementById('fc-stops');
        const stopsDd = document.getElementById('fd-stops');
        if (stopsBtn && stopsDd) {
            stopsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = stopsDd.style.display !== 'none';
                stopsDd.style.display = open ? 'none' : 'block';
                stopsBtn.classList.toggle('active', !open);
            });
            stopsDd.querySelectorAll('input').forEach(cb => {
                cb.addEventListener('change', () => {
                    if (cb.value === 'all') {
                        stopsDd.querySelectorAll('input').forEach(i => i.checked = cb.checked);
                        this.state.filterStops = 'all';
                    } else {
                        stopsDd.querySelector('input[value="all"]').checked = false;
                        const checked = [...stopsDd.querySelectorAll('input:checked:not([value="all"])')].map(i => i.value);
                        this.state.filterStops = checked.length === 0 ? 'all' : checked;
                    }
                    this.state.displayedCount = 0;
                    this.renderCards();
                });
            });
            document.addEventListener('click', () => { stopsDd.style.display = 'none'; stopsBtn.classList.remove('active'); });
        }

        document.getElementById('btn-load-more')?.addEventListener('click', () => {
            this.state.displayedCount += this.state.perPage;
            this.renderCards(true);
        });
    },

    getFiltered() {
        let list = [...this.state.proposals];
        // Filter stops
        if (this.state.filterStops !== 'all') {
            const allow = (Array.isArray(this.state.filterStops) ? this.state.filterStops : [this.state.filterStops]).map(Number);
            list = list.filter(p => {
                const ms = p.max_stops || Math.max(...(p.segments || []).map(s => s.stops));
                return allow.some(a => a === 2 ? ms >= 2 : ms === a);
            });
        }
        // Sort
        switch (this.state.sortBy) {
            case 'cheapest': list.sort((a, b) => a.price - b.price); break;
            case 'fastest': list.sort((a, b) => (a.total_duration || Infinity) - (b.total_duration || Infinity)); break;
            case 'best': list.sort((a, b) => (a.price/1000 + (a.total_duration||0)/60) - (b.price/1000 + (b.total_duration||0)/60)); break;
        }
        return list;
    },

    // ================================================================
    // RENDER CARDS
    // ================================================================
    renderCards(append = false) {
        const sorted = this.getFiltered();

        // Update sort tab values
        if (sorted.length > 0) {
            const cheap = [...sorted].sort((a,b) => a.price - b.price)[0];
            const fast = [...sorted].sort((a,b) => (a.total_duration||Infinity) - (b.total_duration||Infinity))[0];
            const best = [...sorted].sort((a,b) => (a.price/1000+(a.total_duration||0)/60) - (b.price/1000+(b.total_duration||0)/60))[0];
            document.getElementById('sv-cheap').textContent = this.fmtPrice(this.pricePerPerson(cheap.price));
            document.getElementById('sv-fast').textContent = this.fmtDuration(fast.total_duration);
            document.getElementById('sv-best').textContent = this.fmtPrice(this.pricePerPerson(best.price));
        }

        // Info
        document.getElementById('r-count').textContent = `${sorted.length} resultado${sorted.length !== 1 ? 's' : ''}`;
        const cur = this.CURRENCY[this.state.params.currency] || this.CURRENCY.BRL;
        document.getElementById('r-currency').textContent = `Preços por pessoa em ${cur.name} (${this.state.params.currency})`;

        // Render
        const container = document.getElementById('results-list');
        if (!append) {
            this.state.displayedCount = Math.min(this.state.perPage, sorted.length);
            container.innerHTML = sorted.slice(0, this.state.displayedCount).map(p => this.cardHtml(p)).join('');
        } else {
            this.state.displayedCount = Math.min(this.state.displayedCount, sorted.length);
            const curr = container.children.length;
            const newOnes = sorted.slice(curr, this.state.displayedCount);
            container.insertAdjacentHTML('beforeend', newOnes.map(p => this.cardHtml(p)).join(''));
        }

        // Load more
        const lm = document.getElementById('load-more-wrap');
        if (lm) lm.style.display = this.state.displayedCount < sorted.length ? 'block' : 'none';
    },

    cardHtml(p) {
        const pp = this.pricePerPerson(p.price);
        const segs = (p.segments || []).map(seg => {
            const al = seg.flights[0]?.airline || '';
            const aln = seg.flights[0]?.airline_name || al;
            const via = seg.flights.length > 1 ? seg.flights.slice(0,-1).map(f => f.arrival_airport).join(', ') : '';
            return `
            <div class="fc-seg">
                <div><div class="fc-time">${this.fmtTime(seg.departure_time)}</div><div class="fc-airport">${seg.departure_airport}</div></div>
                <div class="fc-line">
                    <span class="fc-dur">${this.fmtDuration(seg.total_duration)}</span>
                    <div class="fc-line-bar"></div>
                    <span class="fc-stops ${this.stopsClass(seg.stops)}">${this.stopsText(seg.stops)}</span>
                    ${via ? `<span class="fc-stop-via">${via}</span>` : ''}
                </div>
                <div><div class="fc-time">${this.fmtTime(seg.arrival_time)}</div><div class="fc-airport">${seg.arrival_airport}</div></div>
                <div class="fc-airline">
                    <img class="fc-al-logo" src="${this.airlineLogo(al)}" alt="${aln}" onerror="this.style.display='none'">
                    <span class="fc-al-name">${aln}</span>
                </div>
            </div>`;
        }).join('');

        const others = (p.all_terms || []).slice(1, 6);
        const moreHtml = others.length > 0 ? `
            <div class="fc-more-toggle">
                <button class="fc-more-btn" onclick="BenetripVoos.toggleMore(this)">+${others.length} oferta${others.length > 1 ? 's' : ''}</button>
            </div>
            <div class="fc-more-list">
                ${others.map(t => `
                <div class="fc-mo-row">
                    <span class="fc-mo-gate">${t.gate_name}</span>
                    <span class="fc-mo-price">${this.fmtPrice(this.pricePerPerson(t.price))}</span>
                    <button class="fc-mo-book" onclick="BenetripVoos.book('${this.state.searchId}','${t.url}',this)">Reservar</button>
                </div>`).join('')}
            </div>` : '';

        return `
        <div class="flight-card">
            <div class="fc-main">
                <div class="fc-segments">${segs}</div>
                <div class="fc-price-panel">
                    <div>
                        <div class="fc-price">${this.fmtPrice(pp)}</div>
                        <div class="fc-price-lbl">por pessoa · ida e volta</div>
                        <div class="fc-gate">${p.gate_name}</div>
                    </div>
                    <button class="fc-book" onclick="BenetripVoos.book('${this.state.searchId}','${p.terms_url}',this)">Reservar →</button>
                </div>
            </div>
            ${moreHtml}
        </div>`;
    },

    toggleMore(btn) {
        const list = btn.closest('.flight-card').querySelector('.fc-more-list');
        if (list) { list.classList.toggle('open'); btn.textContent = list.classList.contains('open') ? 'Menos' : btn.textContent; }
    },

    // ================================================================
    // BOOKING CLICK
    // ================================================================
    async book(searchId, termsUrl, btn) {
        if (!searchId || !termsUrl) { alert('Dados indisponíveis. Tente buscar novamente.'); return; }
        const orig = btn.textContent;
        btn.textContent = 'Abrindo...';
        btn.classList.add('loading');
        try {
            const r = await fetch('/api/flight-click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ search_id: searchId, terms_url: termsUrl })
            });
            if (!r.ok) throw new Error(`Erro ${r.status}`);
            const data = await r.json();
            if (data.method === 'POST' && data.params && Object.keys(data.params).length > 0) {
                this.postRedirect(data.url, data.params);
            } else {
                window.open(data.url, '_blank');
            }
        } catch (e) {
            console.error('❌', e);
            alert('Não foi possível gerar o link. Os resultados expiram em 15 minutos. Tente buscar novamente.');
        } finally {
            btn.textContent = orig;
            btn.classList.remove('loading');
        }
    },

    postRedirect(url, params) {
        const form = document.getElementById('redirect-form');
        form.action = url; form.target = '_blank'; form.innerHTML = '';
        for (const [k, v] of Object.entries(params)) {
            const inp = document.createElement('input');
            inp.type = 'hidden'; inp.name = k; inp.value = v;
            form.appendChild(inp);
        }
        form.submit();
    },
};

document.addEventListener('DOMContentLoaded', () => BenetripVoos.init());
