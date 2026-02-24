// ============================================================
// BENETRIP COMPARAR VOOS v1.1 (Revisada) - JavaScript
// Passageiros: adultos/crianças/bebês
// Preço por pessoa = total ÷ (adultos + crianças)
// Filtros avançados + texto 100% PT-BR
// URLs Protobuf do Google Flights Restauradas
// ============================================================

const BenetripCompararVoos = {

    // ================================================================
    // STATE
    // ================================================================
    state: {
        cidadesData: [],
        origemSelecionada: null,
        destinoSelecionado: null,
        moedaSelecionada: 'BRL',
        adultos: 1,
        criancas: 0,
        bebes: 0,
        datasIda: [],
        datasVolta: [],
        flatpickrIda: null,
        flatpickrVolta: null,
        resultados: null,
        comboSelecionada: null,
        // Sorting
        sortAtivo: 'todos',
        // Advanced filters
        filtros: {
            precoMax: null,
            duracaoMax: null,
            companhias: [],      // empty = all
            aeroportoOrigem: [], // empty = all
            aeroportoDestino: [], // empty = all
            apenasDirecto: false,
            apenasReembolsavel: false,
        },
        // Filter options from data
        opcoesCompanhias: [],
        opcoesAeroportoOrigem: [],
        opcoesAeroportoDestino: [],
        filtroPainelAberto: true,
    },

    // ================================================================
    // INIT
    // ================================================================
    init() {
        this.log('🚀 Init v1.1 Revisada');
        this.loadCidades();
        this.setupAutocomplete('origem');
        this.setupAutocomplete('destino');
        this.setupCalendars();
        this.setupCurrency();
        this.setupForm();
    },

    log(...args) { console.log('[CompararVoos]', ...args); },
    delay(ms) { return new Promise(r => setTimeout(r, ms)); },

    // ================================================================
    // LOAD CIDADES
    // ================================================================
    async loadCidades() {
        try {
            const resp = await fetch('data/cidades_global_iata_v6.json');
            if (resp.ok) {
                this.state.cidadesData = await resp.json();
                this.log(`✅ ${this.state.cidadesData.length} cidades`);
            }
        } catch (e) {
            this.log('⚠️ Cidades fallback');
            this.state.cidadesData = [
                { city: 'São Paulo', iata: 'GRU', airport: 'Guarulhos', state: 'SP', country: 'Brasil' },
                { city: 'São Paulo', iata: 'CGH', airport: 'Congonhas', state: 'SP', country: 'Brasil' },
                { city: 'Rio de Janeiro', iata: 'GIG', airport: 'Galeão', state: 'RJ', country: 'Brasil' },
                { city: 'Brasília', iata: 'BSB', airport: 'Juscelino Kubitschek', state: 'DF', country: 'Brasil' },
                { city: 'Salvador', iata: 'SSA', airport: 'Dep. L. E. Magalhães', state: 'BA', country: 'Brasil' },
                { city: 'Recife', iata: 'REC', airport: 'Guararapes', state: 'PE', country: 'Brasil' },
                { city: 'Belo Horizonte', iata: 'CNF', airport: 'Confins', state: 'MG', country: 'Brasil' },
                { city: 'Fortaleza', iata: 'FOR', airport: 'Pinto Martins', state: 'CE', country: 'Brasil' },
                { city: 'Porto Alegre', iata: 'POA', airport: 'Salgado Filho', state: 'RS', country: 'Brasil' },
                { city: 'Curitiba', iata: 'CWB', airport: 'Afonso Pena', state: 'PR', country: 'Brasil' },
                { city: 'Buenos Aires', iata: 'EZE', airport: 'Ezeiza', state: '', country: 'Argentina' },
                { city: 'Santiago', iata: 'SCL', airport: 'A. M. Benítez', state: '', country: 'Chile' },
                { city: 'Lima', iata: 'LIM', airport: 'Jorge Chávez', state: '', country: 'Peru' },
                { city: 'Lisboa', iata: 'LIS', airport: 'Humberto Delgado', state: '', country: 'Portugal' },
                { city: 'Miami', iata: 'MIA', airport: 'Miami Intl', state: 'FL', country: 'EUA' },
                { city: 'Nova York', iata: 'JFK', airport: 'John F. Kennedy', state: 'NY', country: 'EUA' },
                { city: 'Paris', iata: 'CDG', airport: 'Charles de Gaulle', state: '', country: 'França' },
                { city: 'Londres', iata: 'LHR', airport: 'Heathrow', state: '', country: 'Reino Unido' },
            ];
        }
    },

    // ================================================================
    // AUTOCOMPLETE
    // ================================================================
    normalize(str) { return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); },

    setupAutocomplete(field) {
        const input = document.getElementById(field);
        const results = document.getElementById(`${field}-results`);
        if (!input || !results) return;

        input.addEventListener('input', () => {
            const q = this.normalize(input.value);
            if (q.length < 2) { results.classList.remove('show'); return; }

            const matches = this.state.cidadesData.filter(c => {
                const n = this.normalize;
                return n(c.city).includes(q) || n(c.iata).includes(q) || n(c.airport || '').includes(q);
            }).slice(0, 8);

            if (!matches.length) { results.classList.remove('show'); return; }

            results.innerHTML = matches.map(c => `
                <div class="autocomplete-item" data-code="${c.iata}" data-name="${c.city}" data-airport="${c.airport || ''}">
                    <span class="iata-badge">${c.iata}</span>
                    <div class="city-info">
                        <div class="city-name">${c.city}</div>
                        <div class="city-sub">${c.airport || ''} ${c.state ? '· ' + c.state : ''} · ${c.country || ''}</div>
                    </div>
                </div>
            `).join('');

            results.classList.add('show');

            results.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    const obj = { code: item.dataset.code, name: item.dataset.name, airport: item.dataset.airport };
                    if (field === 'origem') this.state.origemSelecionada = obj;
                    else this.state.destinoSelecionado = obj;
                    input.value = `${obj.code} – ${obj.name}`;
                    results.classList.remove('show');
                });
            });
        });

        input.addEventListener('focus', () => { if (input.value.length >= 2) input.dispatchEvent(new Event('input')); });
        document.addEventListener('click', (e) => { if (!e.target.closest('.autocomplete-wrapper')) results.classList.remove('show'); });
    },

    // ================================================================
    // CALENDARS
    // ================================================================
    setupCalendars() {
        const commonCfg = {
            locale: 'pt',
            mode: 'multiple',
            dateFormat: 'Y-m-d',
            minDate: 'today',
            conjunction: ', ',
            disableMobile: true,
        };

        this.state.flatpickrIda = flatpickr('#datas-ida', {
            ...commonCfg,
            onChange: (dates) => {
                this.state.datasIda = dates.map(d => this.fmtISO(d)).sort();
                if (this.state.datasIda.length > 4) {
                    this.state.datasIda = this.state.datasIda.slice(0, 4);
                    this.state.flatpickrIda.setDate(this.state.datasIda);
                }
                this.renderChips('ida');
                this.updateComboCount();
                if (this.state.datasIda.length > 0 && this.state.flatpickrVolta) {
                    this.state.flatpickrVolta.set('minDate', this.state.datasIda[0]);
                }
            },
        });

        this.state.flatpickrVolta = flatpickr('#datas-volta', {
            ...commonCfg,
            onChange: (dates) => {
                this.state.datasVolta = dates.map(d => this.fmtISO(d)).sort();
                if (this.state.datasVolta.length > 4) {
                    this.state.datasVolta = this.state.datasVolta.slice(0, 4);
                    this.state.flatpickrVolta.setDate(this.state.datasVolta);
                }
                this.renderChips('volta');
                this.updateComboCount();
            },
        });
    },

    renderChips(tipo) {
        const container = document.getElementById(`chips-${tipo}`);
        const datas = tipo === 'ida' ? this.state.datasIda : this.state.datasVolta;
        container.innerHTML = datas.map(d => `
            <span class="date-chip">
                ${this.fmtDateShort(d)}
                <span class="chip-remove" onclick="BenetripCompararVoos.removeDate('${tipo}','${d}')">✕</span>
            </span>
        `).join('');
    },

    removeDate(tipo, date) {
        if (tipo === 'ida') {
            this.state.datasIda = this.state.datasIda.filter(d => d !== date);
            this.state.flatpickrIda.setDate(this.state.datasIda);
        } else {
            this.state.datasVolta = this.state.datasVolta.filter(d => d !== date);
            this.state.flatpickrVolta.setDate(this.state.datasVolta);
        }
        this.renderChips(tipo);
        this.updateComboCount();
    },

    updateComboCount() {
        const el = document.getElementById('combo-info');
        const txt = document.getElementById('combo-text');
        let count = 0;
        for (const ida of this.state.datasIda) {
            for (const volta of this.state.datasVolta) {
                if (volta > ida) count++;
            }
        }
        if (count > 0) {
            el.style.display = 'flex';
            txt.textContent = `${count} combinação${count > 1 ? 'ões' : ''} de datas serão pesquisadas`;
        } else {
            el.style.display = 'none';
        }
    },

    // ================================================================
    // PASSENGERS
    // ================================================================
    ajustarPax(tipo, delta) {
        const s = this.state;
        if (tipo === 'adultos') {
            s.adultos = Math.min(Math.max(s.adultos + delta, 1), 9);
            // Bebê máx = adultos
            if (s.bebes > s.adultos) s.bebes = s.adultos;
        } else if (tipo === 'criancas') {
            s.criancas = Math.min(Math.max(s.criancas + delta, 0), 8);
        } else if (tipo === 'bebes') {
            s.bebes = Math.min(Math.max(s.bebes + delta, 0), s.adultos);
        }
        document.getElementById('pax-adultos').textContent = s.adultos;
        document.getElementById('pax-criancas').textContent = s.criancas;
        document.getElementById('pax-bebes').textContent = s.bebes;

        const hint = `Preços exibidos por pessoa (adulto/criança)${s.bebes > 0 ? ' · Bebês no colo podem ter tarifa reduzida ou gratuita' : ''}`;
        document.getElementById('hint-pass').textContent = hint;
    },

    get passageirosPagantes() { return this.state.adultos + this.state.criancas; },
    get totalPassageiros() { return this.state.adultos + this.state.criancas + this.state.bebes; },

    // ================================================================
    // CURRENCY
    // ================================================================
    setupCurrency() {
        document.querySelectorAll('.currency-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.currency-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.moedaSelecionada = chip.dataset.currency;
            });
        });
    },

    getSimbolo(m) { return { BRL: 'R$', USD: 'US$', EUR: '€' }[m] || m; },

    // ================================================================
    // FORM SUBMIT
    // ================================================================
    setupForm() {
        document.getElementById('search-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.doSearch();
        });
    },

    async doSearch() {
        const s = this.state;
        if (!s.origemSelecionada) return alert('Selecione a origem');
        if (!s.destinoSelecionado) return alert('Selecione o destino');
        if (s.origemSelecionada.code === s.destinoSelecionado.code) return alert('Origem e destino devem ser diferentes');
        if (!s.datasIda.length) return alert('Selecione pelo menos 1 data de ida');
        if (!s.datasVolta.length) return alert('Selecione pelo menos 1 data de volta');

        let validCombos = 0;
        for (const ida of s.datasIda) for (const volta of s.datasVolta) if (volta > ida) validCombos++;
        if (!validCombos) return alert('As datas de volta devem ser posteriores às de ida');

        this.showLoading();
        this.updateProgress(5, '🔍 Preparando busca...');

        try {
            this.updateProgress(15, `✈️ Buscando voos ${s.origemSelecionada.code} → ${s.destinoSelecionado.code}...`);

            const body = {
                origem: s.origemSelecionada.code,
                destino: s.destinoSelecionado.code,
                datasIda: s.datasIda,
                datasVolta: s.datasVolta,
                moeda: s.moedaSelecionada,
                adultos: s.adultos,
                criancas: s.criancas,
                bebes: s.bebes,
            };

            this.updateProgress(30, '🐕 Tripinha está comparando preços...');

            const resp = await fetch('/api/compare-flights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            this.updateProgress(70, '📊 Processando resultados...');

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.message || err.error || `Erro ${resp.status}`);
            }

            const data = await resp.json();
            this.state.resultados = data;

            this.updateProgress(90, '🎨 Montando a visualização...');
            await this.delay(300);

            if (data.stats.cheapestCombo) {
                this.state.comboSelecionada = data.stats.cheapestCombo;
            } else {
                const first = data.combinacoes.find(c => c.voos.length > 0);
                if (first) this.state.comboSelecionada = { dataIda: first.dataIda, dataVolta: first.dataVolta };
            }

            this.state.sortAtivo = 'todos';
            this.resetFiltros();

            // Collect filter options from data
            this.state.opcoesCompanhias = (data.companhias || []).map(c => c.name).sort();
            this.state.opcoesAeroportoOrigem = (data.aeroportosOrigem || []).sort();
            this.state.opcoesAeroportoDestino = (data.aeroportosDestino || []).sort();

            this.updateProgress(100, '🎉 Pronto!');
            await this.delay(400);

            this.renderResults(data);

        } catch (err) {
            this.log('❌', err.message);
            alert(`Ops! ${err.message}`);
            this.showForm();
        }
    },

    resetFiltros() {
        this.state.filtros = {
            precoMax: null,
            duracaoMax: null,
            companhias: [],
            aeroportoOrigem: [],
            aeroportoDestino: [],
            apenasDirecto: false,
            apenasReembolsavel: false,
        };
    },

    // ================================================================
    // SCREEN TRANSITIONS
    // ================================================================
    showForm() {
        document.getElementById('form-section').style.display = '';
        document.getElementById('hero-section').style.display = '';
        document.getElementById('loading-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
    },
    showLoading() {
        document.getElementById('form-section').style.display = 'none';
        document.getElementById('hero-section').style.display = 'none';
        document.getElementById('loading-section').style.display = '';
        document.getElementById('results-section').style.display = 'none';
    },
    showResults() {
        document.getElementById('form-section').style.display = 'none';
        document.getElementById('hero-section').style.display = 'none';
        document.getElementById('loading-section').style.display = 'none';
        document.getElementById('results-section').style.display = '';
    },
    updateProgress(pct, msg, sub) {
        const bar = document.getElementById('progress-bar');
        if (bar) bar.style.width = pct + '%';
        if (msg) document.getElementById('loading-msg').textContent = msg;
        if (sub !== undefined) document.getElementById('loading-sub').textContent = sub;
    },

    // ================================================================
    // RENDER RESULTS
    // ================================================================
    renderResults(data) {
        this.showResults();
        const container = document.getElementById('results-content');
        const { origemSelecionada: orig, destinoSelecionado: dest, moedaSelecionada: moeda } = this.state;
        const paxPag = this.passageirosPagantes;
        const s = this.getSimbolo(moeda);
        const stats = data.stats;

        // Per-person prices
        const cheapPP = paxPag > 0 ? Math.round(stats.cheapest / paxPag) : stats.cheapest;
        const avgPP = paxPag > 0 ? Math.round(stats.average / paxPag) : stats.average;
        const expPP = paxPag > 0 ? Math.round(stats.mostExpensive / paxPag) : stats.mostExpensive;

        // Winner combo info
        const winnerCombo = data.combinacoes.find(c => c.dataIda === stats.cheapestCombo.dataIda && c.dataVolta === stats.cheapestCombo.dataVolta);
        const winnerNoites = winnerCombo?.noites || '—';

        // Saving
        const saving = stats.mostExpensive - stats.cheapest;
        const savingPct = stats.mostExpensive > 0 ? Math.round((saving / stats.mostExpensive) * 100) : 0;
        const savingPP = paxPag > 0 ? Math.round(saving / paxPag) : saving;

        const tipText = savingPct > 20
            ? `<strong>Boa escolha ser flexível!</strong> A diferença entre a combo mais barata e a mais cara é de <strong>${s} ${savingPP.toLocaleString('pt-BR')}</strong> por pessoa (${savingPct}%)! 🐾`
            : savingPct > 5
            ? `A diferença entre as combinações é de <strong>${s} ${savingPP.toLocaleString('pt-BR')}</strong> por pessoa. Cada real conta! 🐾`
            : `Os preços estão bem parecidos entre as combinações. Escolha a data mais conveniente! 🎉`;

        // Pax label
        let paxLabel = `${this.state.adultos} adulto${this.state.adultos > 1 ? 's' : ''}`;
        if (this.state.criancas > 0) paxLabel += ` · ${this.state.criancas} criança${this.state.criancas > 1 ? 's' : ''}`;
        if (this.state.bebes > 0) paxLabel += ` · ${this.state.bebes} bebê${this.state.bebes > 1 ? 's' : ''}`;

        container.innerHTML = `
            <button class="btn-back" onclick="BenetripCompararVoos.showForm()">← Nova busca</button>

            <div class="trip-summary fade-in">
                <div class="trip-route">
                    <div class="trip-city">
                        <span class="trip-code">${orig.code}</span>
                        <span class="trip-name">${orig.name}</span>
                    </div>
                    <div class="trip-arrow">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                    </div>
                    <div class="trip-city">
                        <span class="trip-code">${dest.code}</span>
                        <span class="trip-name">${dest.name}</span>
                    </div>
                </div>
                <div class="trip-meta">
                    <span class="meta-chip">👥 ${paxLabel}</span>
                    <span class="meta-chip">💱 ${moeda}</span>
                    <span class="meta-chip">🔀 ${stats.totalCombinacoes} combinações</span>
                    <span class="meta-chip">✅ ${stats.combinacoesComVoo} com voos</span>
                </div>
            </div>

            <div class="winner-card fade-in" style="animation-delay:.05s">
                <div class="winner-badge">🏆 MELHOR COMBINAÇÃO</div>
                <div class="winner-row">
                    <div>
                        <div class="winner-price">${s} ${cheapPP.toLocaleString('pt-BR')}</div>
                        <div class="winner-price-label">por pessoa · ida e volta</div>
                        ${paxPag > 1 ? `<div class="winner-price-total">Total ${paxPag} passageiro${paxPag > 1 ? 's' : ''}: ${s} ${stats.cheapest.toLocaleString('pt-BR')}</div>` : ''}
                        ${this.state.bebes > 0 ? `<div class="winner-price-label" style="font-size:11px">+ ${this.state.bebes} bebê${this.state.bebes > 1 ? 's' : ''} (tarifa pode variar)</div>` : ''}
                    </div>
                    <div style="display:flex;gap:8px;">
                        <div class="winner-dates-box">
                            <div class="winner-date-lbl">Ida</div>
                            <div class="winner-date-val">${this.fmtDateShort(stats.cheapestCombo.dataIda)}</div>
                        </div>
                        <div style="display:flex;align-items:center;opacity:.6">→</div>
                        <div class="winner-dates-box">
                            <div class="winner-date-lbl">Volta</div>
                            <div class="winner-date-val">${this.fmtDateShort(stats.cheapestCombo.dataVolta)}</div>
                        </div>
                        <div class="winner-dates-box">
                            <div class="winner-date-lbl">Noites</div>
                            <div class="winner-date-val">${winnerNoites}</div>
                        </div>
                    </div>
                </div>
                <a href="${this.buildGoogleFlightsUrl(orig.code, dest.code, stats.cheapestCombo.dataIda, stats.cheapestCombo.dataVolta, moeda)}"
                   target="_blank" rel="noopener" class="winner-cta">✈️ Ver no Google Flights</a>
            </div>

            <div class="stats-row fade-in" style="animation-delay:.1s">
                <div class="stat-card">
                    <div class="stat-label">Mais barato</div>
                    <div class="stat-value green">${s} ${cheapPP.toLocaleString('pt-BR')}</div>
                    <div class="stat-sub">por pessoa</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Média</div>
                    <div class="stat-value blue">${s} ${avgPP.toLocaleString('pt-BR')}</div>
                    <div class="stat-sub">por pessoa</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Mais caro</div>
                    <div class="stat-value orange">${s} ${expPP.toLocaleString('pt-BR')}</div>
                    <div class="stat-sub">por pessoa</div>
                </div>
            </div>

            <div class="tripinha-tip fade-in" style="animation-delay:.15s">
                <img src="assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="tripinha-tip-avatar" onerror="this.style.display='none'">
                <div class="tripinha-tip-text">${tipText}</div>
            </div>

            <div class="matrix-section fade-in" style="animation-delay:.2s">
                <h3 class="matrix-title">📊 Matriz de Preços</h3>
                <p class="matrix-subtitle">Clique em uma combinação para ver os voos detalhados</p>
                ${this._renderMatrix(data)}
            </div>

            <div id="combo-detail" class="fade-in" style="animation-delay:.25s">
                ${this._renderComboDetail(data)}
            </div>

            <div class="share-section fade-in" style="animation-delay:.3s">
                <h3 class="share-title">📤 Compartilhar</h3>
                <p class="share-subtitle">Envie para quem vai viajar com você!</p>
                <div class="share-buttons">
                    <button class="btn-share btn-share-whatsapp" onclick="BenetripCompararVoos.shareWhatsApp()">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                    </button>
                    <button class="btn-share btn-share-copy" onclick="BenetripCompararVoos.copyShare()">📋 Copiar</button>
                </div>
            </div>
        `;

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ================================================================
    // PRICE MATRIX
    // ================================================================
    _renderMatrix(data) {
        const s = this.getSimbolo(this.state.moedaSelecionada);
        const paxPag = this.passageirosPagantes;
        const sel = this.state.comboSelecionada;
        const idas = data.datasIda.sort();
        const voltas = data.datasVolta.sort();

        // Collect valid prices for color coding
        const prices = [];
        Object.values(data.matrizPrecos).forEach(v => { if (v.melhorPreco) prices.push(v.melhorPreco); });
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        const range = maxP - minP;

        let html = '<div class="matrix-wrap"><table class="matrix-table"><thead><tr>';
        html += '<th class="matrix-corner">IDA →<br>↓ VOLTA</th>';
        idas.forEach(ida => { html += `<th>${this.fmtDateShort(ida)}<br><small>${this.fmtWeekday(ida)}</small></th>`; });
        html += '</tr></thead><tbody>';

        voltas.forEach(volta => {
            html += `<tr><th>${this.fmtDateShort(volta)}<br><small>${this.fmtWeekday(volta)}</small></th>`;
            idas.forEach(ida => {
                if (volta <= ida) {
                    html += '<td class="matrix-cell no-data">—</td>';
                    return;
                }
                const key = `${ida}_${volta}`;
                const cell = data.matrizPrecos[key];
                if (!cell || !cell.melhorPreco) {
                    html += '<td class="matrix-cell no-data">sem voo</td>';
                    return;
                }

                const price = cell.melhorPreco;
                const pp = paxPag > 0 ? Math.round(price / paxPag) : price;
                const noites = cell.noites;
                const isSelected = sel && sel.dataIda === ida && sel.dataVolta === volta;

                let cls = 'mid';
                if (range > 0) {
                    const pct = (price - minP) / range;
                    if (pct <= 0.33) cls = 'cheapest';
                    else if (pct >= 0.66) cls = 'expensive';
                }

                html += `<td class="matrix-cell ${cls} ${isSelected ? 'selected' : ''}"
                             onclick="BenetripCompararVoos.selectCombo('${ida}','${volta}')">
                    ${s} ${pp.toLocaleString('pt-BR')}
                    <span class="matrix-noites">${noites}n · ${cell.totalVoos} voo${cell.totalVoos !== 1 ? 's' : ''}</span>
                </td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        return html;
    },

    // ================================================================
    // SELECT COMBO
    // ================================================================
    selectCombo(ida, volta) {
        this.state.comboSelecionada = { dataIda: ida, dataVolta: volta };
        this.state.sortAtivo = 'todos';
        this.resetFiltros();

        document.querySelectorAll('.matrix-cell').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.matrix-cell').forEach(c => {
            const oc = c.getAttribute('onclick') || '';
            if (oc.includes(`'${ida}'`) && oc.includes(`'${volta}'`)) c.classList.add('selected');
        });

        const el = document.getElementById('combo-detail');
        if (el) {
            el.innerHTML = this._renderComboDetail(this.state.resultados);
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },

    // ================================================================
    // SORT
    // ================================================================
    setSort(sort) {
        this.state.sortAtivo = sort;
        const el = document.getElementById('combo-detail');
        if (el) el.innerHTML = this._renderComboDetail(this.state.resultados);
    },

    // ================================================================
    // FILTER TOGGLE
    // ================================================================
    toggleFilter(tipo, valor) {
        const f = this.state.filtros;
        if (tipo === 'companhia') {
            const idx = f.companhias.indexOf(valor);
            if (idx >= 0) f.companhias.splice(idx, 1); else f.companhias.push(valor);
        } else if (tipo === 'aeroportoOrigem') {
            const idx = f.aeroportoOrigem.indexOf(valor);
            if (idx >= 0) f.aeroportoOrigem.splice(idx, 1); else f.aeroportoOrigem.push(valor);
        } else if (tipo === 'aeroportoDestino') {
            const idx = f.aeroportoDestino.indexOf(valor);
            if (idx >= 0) f.aeroportoDestino.splice(idx, 1); else f.aeroportoDestino.push(valor);
        } else if (tipo === 'direto') {
            f.apenasDirecto = !f.apenasDirecto;
        }
        this.refreshComboDetail();
    },

    updateFilterPreco(val) {
        this.state.filtros.precoMax = val ? parseInt(val) : null;
        document.getElementById('filtro-preco-label').textContent = val ? `Até ${this.getSimbolo(this.state.moedaSelecionada)} ${parseInt(val).toLocaleString('pt-BR')}` : 'Sem limite';
        this.refreshComboDetail();
    },

    updateFilterDuracao(val) {
        this.state.filtros.duracaoMax = val ? parseInt(val) : null;
        const h = Math.floor(parseInt(val) / 60);
        const m = parseInt(val) % 60;
        document.getElementById('filtro-duracao-label').textContent = val ? `Até ${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : 'Sem limite';
        this.refreshComboDetail();
    },

    limparFiltros() {
        this.resetFiltros();
        this.refreshComboDetail();
    },

    refreshComboDetail() {
        const el = document.getElementById('combo-detail');
        if (el) el.innerHTML = this._renderComboDetail(this.state.resultados);
    },

    // ================================================================
    // APPLY FILTERS TO FLIGHTS
    // ================================================================
    _applyFilters(voos) {
        const f = this.state.filtros;
        const paxPag = this.passageirosPagantes;
        let filtered = [...voos];

        // Direct only
        if (f.apenasDirecto) filtered = filtered.filter(v => v.stops === 0);

        // Price max (per person)
        if (f.precoMax) {
            filtered = filtered.filter(v => {
                const pp = paxPag > 0 ? Math.round(v.price / paxPag) : v.price;
                return pp <= f.precoMax;
            });
        }

        // Duration max
        if (f.duracaoMax) filtered = filtered.filter(v => v.total_duration <= f.duracaoMax);

        // Airlines
        if (f.companhias.length > 0) {
            filtered = filtered.filter(v => v.airlines.some(a => f.companhias.includes(a.name)));
        }

        // Origin airport
        if (f.aeroportoOrigem.length > 0) {
            filtered = filtered.filter(v => {
                if (!v.legs.length) return false;
                return f.aeroportoOrigem.includes(v.legs[0].departure_airport.id);
            });
        }

        // Destination airport
        if (f.aeroportoDestino.length > 0) {
            filtered = filtered.filter(v => {
                if (!v.legs.length) return false;
                return v.legs.some(l => f.aeroportoDestino.includes(l.arrival_airport.id));
            });
        }

        return filtered;
    },

    _applySorting(voos) {
        const sort = this.state.sortAtivo;
        if (sort === 'barato') return voos.sort((a, b) => a.price - b.price);
        if (sort === 'rapido') return voos.sort((a, b) => a.total_duration - b.total_duration);
        if (sort === 'direto') return voos.filter(v => v.stops === 0);
        return voos; // 'todos'
    },

    // ================================================================
    // COMBO DETAIL
    // ================================================================
    _renderComboDetail(data) {
        const sel = this.state.comboSelecionada;
        if (!sel) return '';

        const combo = data.combinacoes.find(c => c.dataIda === sel.dataIda && c.dataVolta === sel.dataVolta);
        if (!combo || !combo.voos.length) {
            return `<div class="combo-detail-section">
                <div class="combo-detail-header"><h3>📅 ${this.fmtDateShort(sel.dataIda)} → ${this.fmtDateShort(sel.dataVolta)}</h3></div>
                <div class="no-flights-msg">😕 Nenhum voo disponível para esta combinação.</div>
            </div>`;
        }

        const { moedaSelecionada: moeda } = this.state;
        const s = this.getSimbolo(moeda);
        const paxPag = this.passageirosPagantes;
        const sort = this.state.sortAtivo;

        // Apply filters then sorting
        let voos = this._applyFilters(combo.voos);
        voos = this._applySorting(voos);

        // Counts for sort badges
        const totalDiretos = combo.voos.filter(v => v.stops === 0).length;

        // Collect unique airlines/airports in THIS combo for filter panel
        const comboCompanhias = new Map();
        const comboAerOrigem = new Set();
        const comboAerDestino = new Set();
        let comboMaxPrice = 0;
        let comboMaxDuration = 0;

        combo.voos.forEach(v => {
            v.airlines.forEach(a => comboCompanhias.set(a.name, a));
            if (v.legs.length > 0) {
                comboAerOrigem.add(v.legs[0].departure_airport.id);
                v.legs.forEach(l => comboAerDestino.add(l.arrival_airport.id));
            }
            const pp = paxPag > 0 ? Math.round(v.price / paxPag) : v.price;
            if (pp > comboMaxPrice) comboMaxPrice = pp;
            if (v.total_duration > comboMaxDuration) comboMaxDuration = v.total_duration;
        });

        // Price insights
        let insightsHtml = '';
        if (combo.priceInsights) {
            const pi = combo.priceInsights;
            if (pi.typical_price_range && Array.isArray(pi.typical_price_range) && pi.typical_price_range.length === 2) {
                const [lo, hi] = pi.typical_price_range;
                if (typeof lo === 'number' && typeof hi === 'number') {
                    const loPP = paxPag > 0 ? Math.round(lo / paxPag) : lo;
                    const hiPP = paxPag > 0 ? Math.round(hi / paxPag) : hi;
                    insightsHtml = ` · Faixa típica: ${s} ${loPP.toLocaleString('pt-BR')} – ${s} ${hiPP.toLocaleString('pt-BR')}`;
                }
            }
        }

        // Sort buttons
        const sortHtml = `
            <div class="sort-inline">
                <button class="sort-chip ${sort === 'todos' ? 'active' : ''}" onclick="BenetripCompararVoos.setSort('todos')">Todos (${combo.voos.length})</button>
                <button class="sort-chip ${sort === 'barato' ? 'active' : ''}" onclick="BenetripCompararVoos.setSort('barato')">💰 Mais barato</button>
                <button class="sort-chip ${sort === 'rapido' ? 'active' : ''}" onclick="BenetripCompararVoos.setSort('rapido')">⚡ Mais rápido</button>
                ${totalDiretos > 0 ? `<button class="sort-chip ${sort === 'direto' ? 'active' : ''}" onclick="BenetripCompararVoos.setSort('direto')">✈️ Direto (${totalDiretos})</button>` : ''}
            </div>
        `;

        // Advanced filters panel
        const filtersHtml = this._renderFiltersPanel(comboCompanhias, comboAerOrigem, comboAerDestino, comboMaxPrice, comboMaxDuration);

        // Flight cards
        const cardsHtml = voos.length > 0
            ? voos.slice(0, 20).map((v, idx) => this._renderFlightCard(v, idx, sel)).join('')
            : '<div class="no-flights-msg">😕 Nenhum voo com esses filtros. <button class="btn-filter-clear" style="margin-left:8px" onclick="BenetripCompararVoos.limparFiltros()">Limpar filtros</button></div>';

        const filterResultCount = voos.length !== combo.voos.length
            ? `<div class="filter-result-count">Mostrando ${Math.min(voos.length, 20)} de ${voos.length} voo${voos.length !== 1 ? 's' : ''} filtrados (total: ${combo.voos.length})</div>`
            : '';

        return `
            <div class="combo-detail-section">
                <div class="combo-detail-header">
                    <div>
                        <h3>📅 ${this.fmtDateFull(sel.dataIda)} → ${this.fmtDateFull(sel.dataVolta)}</h3>
                        <div class="combo-detail-sub">${combo.noites} noites · ${combo.voos.length} opções de voo${insightsHtml}</div>
                    </div>
                </div>
                ${sortHtml}
                ${filtersHtml}
                ${filterResultCount}
                <div class="flights-list">${cardsHtml}</div>
            </div>
        `;
    },

    // ================================================================
    // FILTERS PANEL
    // ================================================================
    _renderFiltersPanel(companhias, aerOrigem, aerDestino, maxPreco, maxDuracao) {
        const f = this.state.filtros;
        const s = this.getSimbolo(this.state.moedaSelecionada);
        const isOpen = this.state.filtroPainelAberto;

        // Airlines chips
        const compArr = Array.from(companhias.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const airlinesChips = compArr.map(([name, obj]) => {
            const isActive = f.companhias.includes(name);
            return `<button class="filter-chip ${isActive ? 'active' : ''}" onclick="BenetripCompararVoos.toggleFilter('companhia','${name.replace(/'/g, "\\'")}')">${name}</button>`;
        }).join('');

        // Origin airports
        const origArr = Array.from(aerOrigem).sort();
        const origChips = origArr.map(code => {
            const isActive = f.aeroportoOrigem.includes(code);
            return `<button class="filter-chip ${isActive ? 'active' : ''}" onclick="BenetripCompararVoos.toggleFilter('aeroportoOrigem','${code}')">${code}</button>`;
        }).join('');

        // Destination airports
        const destArr = Array.from(aerDestino).sort();
        const destChips = destArr.map(code => {
            const isActive = f.aeroportoDestino.includes(code);
            return `<button class="filter-chip ${isActive ? 'active' : ''}" onclick="BenetripCompararVoos.toggleFilter('aeroportoDestino','${code}')">${code}</button>`;
        }).join('');

        // Check if any filter is active
        const hasActiveFilter = f.companhias.length > 0 || f.aeroportoOrigem.length > 0 || f.aeroportoDestino.length > 0 || f.precoMax || f.duracaoMax || f.apenasDirecto;

        // Price range
        const precoAtual = f.precoMax || maxPreco;
        const precoLabel = f.precoMax ? `Até ${s} ${f.precoMax.toLocaleString('pt-BR')}` : 'Sem limite';

        // Duration range
        const duracaoMaxMin = maxDuracao || 1800; // 30h default
        const duracaoRounded = Math.ceil(duracaoMaxMin / 60) * 60;
        const duracaoAtual = f.duracaoMax || duracaoRounded;
        const dH = Math.floor(duracaoAtual / 60);
        const dM = duracaoAtual % 60;
        const duracaoLabel = f.duracaoMax ? `Até ${dH}h${dM > 0 ? String(dM).padStart(2, '0') : ''}` : 'Sem limite';

        return `
            <div class="filters-panel">
                <div class="filters-panel-title">
                    🔧 Filtros avançados ${hasActiveFilter ? '<span style="color:var(--orange);font-size:11px">● filtros ativos</span>' : ''}
                    <span class="toggle-btn" onclick="BenetripCompararVoos.toggleFilterPanel()">${isOpen ? '▲ Recolher' : '▼ Expandir'}</span>
                </div>
                <div id="filters-body" style="${isOpen ? '' : 'display:none'}">
                    <div class="filter-group">
                        <span class="filter-group-label">Paradas</span>
                        <div class="filter-chips">
                            <button class="filter-chip ${f.apenasDirecto ? 'active' : ''}" onclick="BenetripCompararVoos.toggleFilter('direto')">✈️ Apenas diretos</button>
                        </div>
                    </div>

                    <div class="filter-group">
                        <span class="filter-group-label">Preço máximo por pessoa</span>
                        <div class="filter-range">
                            <input type="range" min="0" max="${maxPreco}" step="${Math.max(10, Math.round(maxPreco / 50))}" value="${precoAtual}" oninput="BenetripCompararVoos.updateFilterPreco(this.value)">
                            <span class="filter-range-label" id="filtro-preco-label">${precoLabel}</span>
                        </div>
                    </div>

                    <div class="filter-group">
                        <span class="filter-group-label">Duração máxima do voo</span>
                        <div class="filter-range">
                            <input type="range" min="60" max="${duracaoRounded}" step="30" value="${duracaoAtual}" oninput="BenetripCompararVoos.updateFilterDuracao(this.value)">
                            <span class="filter-range-label" id="filtro-duracao-label">${duracaoLabel}</span>
                        </div>
                    </div>

                    ${compArr.length > 1 ? `
                    <div class="filter-group">
                        <span class="filter-group-label">Companhias aéreas</span>
                        <div class="filter-chips">${airlinesChips}</div>
                    </div>` : ''}

                    ${origArr.length > 1 ? `
                    <div class="filter-group">
                        <span class="filter-group-label">Aeroporto de origem</span>
                        <div class="filter-chips">${origChips}</div>
                    </div>` : ''}

                    ${destArr.length > 1 ? `
                    <div class="filter-group">
                        <span class="filter-group-label">Aeroporto de destino</span>
                        <div class="filter-chips">${destChips}</div>
                    </div>` : ''}

                    ${hasActiveFilter ? `
                    <div class="filters-actions">
                        <button class="btn-filter-clear" onclick="BenetripCompararVoos.limparFiltros()">✕ Limpar filtros</button>
                    </div>` : ''}
                </div>
            </div>
        `;
    },

    toggleFilterPanel() {
        this.state.filtroPainelAberto = !this.state.filtroPainelAberto;
        const body = document.getElementById('filters-body');
        if (body) body.style.display = this.state.filtroPainelAberto ? '' : 'none';
        // Update toggle text
        const btn = document.querySelector('.filters-panel .toggle-btn');
        if (btn) btn.textContent = this.state.filtroPainelAberto ? '▲ Recolher' : '▼ Expandir';
    },

    // ================================================================
    // FLIGHT CARD
    // ================================================================
    _renderFlightCard(voo, idx, combo) {
        const { origemSelecionada: orig, destinoSelecionado: dest, moedaSelecionada: moeda } = this.state;
        const s = this.getSimbolo(moeda);
        const paxPag = this.passageirosPagantes;
        const isBest = idx === 0 && voo.is_best;

        // Price per person (adulto+criança)
        const pricePP = paxPag > 0 ? Math.round(voo.price / paxPag) : voo.price;

        // Airlines
        const airlinesHtml = voo.airlines.map(a =>
            `<img src="${a.logo}" alt="${a.name}" class="airline-logo" onerror="this.style.display='none'">`
        ).join('');
        const airlinesNames = voo.airlines.map(a => a.name).join(', ');

        // Duration
        const durH = Math.floor(voo.total_duration / 60);
        const durM = voo.total_duration % 60;
        const durStr = durM > 0 ? `${durH}h${String(durM).padStart(2, '0')}` : `${durH}h`;

        // Stops
        const stopsStr = voo.stops === 0 ? 'Direto' : voo.stops === 1 ? '1 parada' : `${voo.stops} paradas`;
        const stopsClass = voo.stops === 0 ? 'tag-direct' : voo.stops >= 2 ? 'tag-warn' : '';

        // Google Flights URL
        const gfUrl = this.buildGoogleFlightsUrl(orig.code, dest.code, combo.dataIda, combo.dataVolta, moeda);

        // Carbon
        const carbonHtml = voo.carbon_emissions
            ? `<span class="flight-tag"><span class="flight-tag-icon">🌱</span>${voo.carbon_emissions} kg CO₂</span>`
            : '';

        // Extensions
        const extHtml = (voo.extensions || []).map(ext =>
            `<span class="flight-tag"><span class="flight-tag-icon">📋</span>${ext}</span>`
        ).join('');

        // Legs detail
        const legsHtml = this._renderFlightLegs(voo);

        return `
            <div class="flight-card ${isBest ? 'best-flight' : ''}">
                <div class="flight-top">
                    <div class="flight-airlines">
                        ${airlinesHtml}
                        <span class="airline-names">${airlinesNames}</span>
                    </div>
                    <div class="flight-price-box">
                        <div class="flight-price">${s} ${pricePP.toLocaleString('pt-BR')}</div>
                        <div class="flight-price-pp">por pessoa · ida e volta</div>
                        ${paxPag > 1 ? `<div class="flight-price-total">Total ${paxPag}p: ${s} ${voo.price.toLocaleString('pt-BR')}</div>` : ''}
                    </div>
                </div>

                <div class="flight-summary">
                    <span class="flight-tag ${stopsClass}"><span class="flight-tag-icon">${voo.stops === 0 ? '✅' : '🔄'}</span>${stopsStr}</span>
                    <span class="flight-tag"><span class="flight-tag-icon">⏱️</span>${durStr} total</span>
                    ${carbonHtml}
                    ${extHtml}
                </div>

                ${legsHtml}

                <a href="${gfUrl}" target="_blank" rel="noopener" class="flight-cta">🔍 Ver no Google Flights</a>
            </div>
        `;
    },

    // ================================================================
    // FLIGHT LEGS
    // ================================================================
    _renderFlightLegs(voo) {
        if (!voo.legs || !voo.legs.length) return '';

        const { origemSelecionada: orig, destinoSelecionado: dest } = this.state;
        const layovers = voo.layovers || [];

        // Split legs into outbound and return
        let splitIdx = voo.legs.length;
        for (let i = 1; i < voo.legs.length; i++) {
            const depId = voo.legs[i].departure_airport.id;
            if (depId === dest.code || (layovers[i - 1] && i > 0 && voo.legs[i - 1].arrival_airport.id === dest.code)) {
                splitIdx = i;
                break;
            }
        }

        if (splitIdx === voo.legs.length && voo.legs.length > 1) {
            for (let i = 0; i < voo.legs.length; i++) {
                if (voo.legs[i].arrival_airport.id === dest.code && i < voo.legs.length - 1) {
                    splitIdx = i + 1;
                    break;
                }
            }
        }

        const outLegs = voo.legs.slice(0, splitIdx);
        const retLegs = voo.legs.slice(splitIdx);

        let html = '<div class="flight-legs">';

        // Outbound
        if (outLegs.length) {
            html += '<div class="flight-leg-section">';
            html += `<div class="flight-leg-section-title">🛫 Ida · ${orig.code} → ${dest.code}</div>`;
            outLegs.forEach((leg, i) => {
                html += this._renderLeg(leg);
                if (i < outLegs.length - 1 && layovers[i]) {
                    html += this._renderLayover(layovers[i]);
                }
            });
            html += '</div>';
        }

        // Return
        if (retLegs.length) {
            html += '<div class="flight-leg-section">';
            html += `<div class="flight-leg-section-title">🛬 Volta · ${dest.code} → ${orig.code}</div>`;
            retLegs.forEach((leg, i) => {
                html += this._renderLeg(leg);
                const layIdx = splitIdx + i;
                if (i < retLegs.length - 1 && layovers[layIdx]) {
                    html += this._renderLayover(layovers[layIdx]);
                }
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    },

    _renderLeg(leg) {
        const depTime = leg.departure_airport.time ? leg.departure_airport.time.split(' ').pop() || leg.departure_airport.time : '';
        const arrTime = leg.arrival_airport.time ? leg.arrival_airport.time.split(' ').pop() || leg.arrival_airport.time : '';
        const durH = Math.floor(leg.duration / 60);
        const durM = leg.duration % 60;
        const durStr = `${durH}h${durM > 0 ? String(durM).padStart(2, '0') : ''}`;

        // Airplane / class
        let extraParts = [];
        if (leg.airplane) extraParts.push(leg.airplane);
        if (leg.travel_class && leg.travel_class !== 'Economy') extraParts.push(leg.travel_class);
        if (leg.legroom) extraParts.push(leg.legroom);
        if (leg.often_delayed_by_over_30_min) extraParts.push('⚠️ Frequentemente atrasado');

        // Leg extensions
        const legExtras = (leg.extensions || []).join(' · ');
        if (legExtras) extraParts.push(legExtras);

        return `
            <div class="leg-item">
                <div class="leg-times">
                    <div class="leg-time">${depTime}</div>
                    <div class="leg-airport-id">${leg.departure_airport.id}</div>
                    <div class="leg-connector"><div class="leg-dot"></div><div class="leg-line"></div><div class="leg-dot"></div></div>
                    <div class="leg-time">${arrTime}</div>
                    <div class="leg-airport-id">${leg.arrival_airport.id}</div>
                </div>
                <div class="leg-details">
                    <div class="leg-airline">${leg.airline} ${leg.flight_number} <span class="leg-duration-badge">· ${durStr}</span></div>
                    <div class="leg-extra">${extraParts.join(' · ')}</div>
                </div>
            </div>
        `;
    },

    _renderLayover(layover) {
        const h = Math.floor(layover.duration / 60);
        const m = layover.duration % 60;
        const durStr = `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`;
        const overnight = layover.overnight ? '<span class="layover-overnight"> · 🌙 Pernoite</span>' : '';

        return `
            <div class="layover-item">
                <span class="layover-icon">⏳</span>
                Conexão em ${layover.airport_id || layover.airport} · ${durStr}${overnight}
            </div>
        `;
    },

    // ================================================================
    // GOOGLE FLIGHTS URL (Restaurado da v1.0 e corrigido)
    // ================================================================
    _pV(n) { const b=[]; let v=n>>>0; while(v>127){ b.push((v&0x7f)|0x80); v>>>=7; } b.push(v&0x7f); return b; },
    _pT(f,w) { return this._pV((f<<3)|w); },
    _pVF(f,v) { return [...this._pT(f,0),...this._pV(v)]; },
    _pSF(f,s) { const e=new TextEncoder().encode(s); return [...this._pT(f,2),...this._pV(e.length),...e]; },
    _pMF(f,m) { return [...this._pT(f,2),...this._pV(m.length),...m]; },
    _b64u(b) { return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); },
    _bAirport(c) { return [...this._pVF(1,1),...this._pSF(2,c)]; },
    _bLeg(d,o,de) { return [...this._pSF(2,d),...this._pMF(13,this._bAirport(o)),...this._pMF(14,this._bAirport(de))]; },

    buildGoogleFlightsUrl(o,d,dep,ret,cur) {
        try {
            const tfs = this._b64u([...this._pVF(1,28),...this._pVF(2,2),...this._pMF(3,this._bLeg(dep,o,d)),...this._pMF(3,this._bLeg(ret,d,o)),...this._pVF(14,1)]);
            const tfu = this._b64u(this._pMF(2,[...this._pVF(1,1),...this._pVF(2,0),...this._pVF(3,0)]));
            const p = new URLSearchParams();
            p.set('tfs', tfs);
            p.set('tfu', tfu);
            p.set('curr', {BRL:'BRL',USD:'USD',EUR:'EUR'}[cur] || 'BRL');
            p.set('hl', {BRL:'pt-BR',USD:'en',EUR:'en'}[cur] || 'pt-BR');
            p.set('gl', {BRL:'br',USD:'us',EUR:'de'}[cur] || 'br');
            // Bug de interpolação da v1.0 corrigido abaixo ($ inserido)
            return `https://www.google.com/travel/flights?${p.toString()}`;
        } catch (e) {
            return `https://www.google.com/travel/flights`;
        }
    },

    // ================================================================
    // SHARE
    // ================================================================
    _buildShareText() {
        const { origemSelecionada: orig, destinoSelecionado: dest, moedaSelecionada: moeda } = this.state;
        const s = this.getSimbolo(moeda);
        const data = this.state.resultados;
        if (!data) return '';

        const paxPag = this.passageirosPagantes;
        const cheapPP = paxPag > 0 ? Math.round(data.stats.cheapest / paxPag) : data.stats.cheapest;
        const cc = data.stats.cheapestCombo;

        const gfUrl = this.buildGoogleFlightsUrl(orig.code, dest.code, cc.dataIda, cc.dataVolta, moeda);

        let text = `✈️ Voos ${orig.code} → ${dest.code}\n`;
        text += `💰 A partir de ${s} ${cheapPP.toLocaleString('pt-BR')} por pessoa\n`;
        text += `📅 Melhor combo: ${this.fmtDateBR(cc.dataIda)} → ${this.fmtDateBR(cc.dataVolta)}\n`;
        text += `👥 ${this.state.adultos} adulto${this.state.adultos > 1 ? 's' : ''}`;
        if (this.state.criancas > 0) text += `, ${this.state.criancas} criança${this.state.criancas > 1 ? 's' : ''}`;
        if (this.state.bebes > 0) text += `, ${this.state.bebes} bebê${this.state.bebes > 1 ? 's' : ''}`;
        text += `\n🔗 ${gfUrl}\n`;
        text += `\n🐕 Encontrado pela Tripinha | benetrip.com.br`;
        return text;
    },

    shareWhatsApp() {
        const text = this._buildShareText();
        if (text) window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    },

    copyShare() {
        const text = this._buildShareText();
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.querySelector('.btn-share-copy');
            if (btn) { btn.textContent = '✅ Copiado!'; setTimeout(() => { btn.textContent = '📋 Copiar'; }, 2000); }
        });
    },

    // ================================================================
    // DATE HELPERS
    // ================================================================
    fmtISO(date) {
        if (typeof date === 'string') return date;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    fmtDateShort(iso) {
        if (!iso) return '';
        const [y, m, d] = iso.split('-').map(Number);
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${d} ${meses[m - 1]}`;
    },

    fmtDateFull(iso) {
        if (!iso) return '';
        const [y, m, d] = iso.split('-').map(Number);
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${d} ${meses[m - 1]} ${y}`;
    },

    fmtDateBR(iso) {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    },

    fmtWeekday(iso) {
        if (!iso) return '';
        const [y, m, d] = iso.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return dias[dt.getDay()];
    },
};

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => BenetripCompararVoos.init());
