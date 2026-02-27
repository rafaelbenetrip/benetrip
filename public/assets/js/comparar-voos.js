/**
 * BENETRIP — COMPARAR VOOS v2.0
 * Passageiros: adultos, crianças, bebês
 * Filtros: paradas, companhias, horários, duração, preço, aeroportos
 */

const BenetripCompararVoos = {
    state: {
        cidadesData: null,
        origemSelecionada: null,
        destinoSelecionado: null,
        moedaSelecionada: 'BRL',
        // Passageiros por tipo
        numAdultos: 1,
        numCriancas: 0,
        numBebes: 0,
        // Datas
        datasIda: [],
        datasVolta: [],
        fpIda: null,
        fpVolta: null,
        // Resultados
        resultados: null,
        comboSelecionada: null,
        sortAtivo: 'melhor',  // melhor | barato | rapido
        // Painel de filtros
        filtrosPanelAberto: false,
        filtros: {
            paradas: new Set(),           // Set<number> — 0=direto,1=1p,2=2+p
            companhias: new Set(),         // Set<string>
            aeroportosSaida: new Set(),    // Set<string> — aeroporto partida na ida
            aeroportosChegada: new Set(),  // Set<string> — aeroporto chegada na ida
            aeroportosRetSaida: new Set(), // Set<string> — aeroporto partida na volta
            aeroportosRetChegada: new Set(),// Set<string> — aeroporto chegada na volta
            precoMax: null,               // number | null
            horarioSaidaIda: new Set(),   // Set<string>: madrugada,manha,tarde,noite
            horarioSaidaVolta: new Set(),
            duracaoMaxIda: null,          // minutos | null
            duracaoMaxVolta: null,        // minutos | null
        },
        // Opções extraídas dos resultados (para popular os filtros)
        filterOptions: null,
    },

    config: {
        debug: true,
        cidadesJsonPath: 'data/cidades_global_iata_v6.json',
        maxDatasIda: 4,
        maxDatasVolta: 4,
    },

    TIME_BLOCKS: {
        madrugada: { label: 'Madrugada', range: '00:00–05:59', icon: '🌙', min: 0,   max: 359  },
        manha:     { label: 'Manhã',     range: '06:00–11:59', icon: '🌅', min: 360, max: 719  },
        tarde:     { label: 'Tarde',     range: '12:00–17:59', icon: '☀️', min: 720, max: 1079 },
        noite:     { label: 'Noite',     range: '18:00–23:59', icon: '🌆', min: 1080,max: 1439 },
    },

    log(...a) { if (this.config.debug) console.log('[CompararVoos]', ...a); },

    // ════════════════════════════════════════
    // INIT
    // ════════════════════════════════════════
    init() {
        this.log('🐕 Comparar Voos v2.0 inicializando...');
        this.carregarCidades();
        this.setupAutocomplete('origem', 'origem-results', 'origem-data', 'origemSelecionada');
        this.setupAutocomplete('destino', 'destino-results', 'destino-data', 'destinoSelecionado');
        this.setupCalendars();
        this.setupCurrencyChips();
        this.setupForm();
        this.log('✅ Pronto!');
    },

    // ════════════════════════════════════════
    // TRADUÇÃO
    // ════════════════════════════════════════
    traduzirTexto(texto) {
        if (!texto) return '';
        const dic = {
            "Free change": "Alteração gratuita",
            "possible fare difference": "sujeita a diferença de tarifa",
            "Full refund for cancellations": "Reembolso total para cancelamentos",
            "Checked baggage not included in price": "Bagagem despachada não incluída",
            "Bag and fare conditions depend on the return flight": "Condições dependem do voo de volta",
            "Often delayed by over 30 min": "Atrasos frequentes (+30 min)",
            "Change fees apply": "Taxas de alteração aplicáveis",
            "No free changes": "Sem alterações gratuitas",
        };
        let t = texto;
        for (const [eng, pt] of Object.entries(dic)) t = t.replace(new RegExp(eng, 'gi'), pt);
        return t;
    },

    // ════════════════════════════════════════
    // CIDADES
    // ════════════════════════════════════════
    async carregarCidades() {
        try {
            const r = await fetch(this.config.cidadesJsonPath);
            if (!r.ok) throw new Error('Erro');
            const d = await r.json();
            this.state.cidadesData = d.filter(c => c.iata);
            this.log(`✅ ${this.state.cidadesData.length} cidades`);
        } catch {
            this.state.cidadesData = [
                { cidade: "São Paulo",     sigla_estado: "SP", pais: "Brasil",         codigo_pais: "BR", iata: "GRU", aeroporto: "Aeroporto de Guarulhos" },
                { cidade: "Rio de Janeiro",sigla_estado: "RJ", pais: "Brasil",         codigo_pais: "BR", iata: "GIG", aeroporto: "Aeroporto do Galeão" },
                { cidade: "Lisboa",                             pais: "Portugal",       codigo_pais: "PT", iata: "LIS" },
                { cidade: "Miami",                              pais: "Estados Unidos", codigo_pais: "US", iata: "MIA", aeroporto: "Miami International" },
                { cidade: "Buenos Aires",                       pais: "Argentina",      codigo_pais: "AR", iata: "EZE", aeroporto: "Ezeiza" },
                { cidade: "Paris",                              pais: "França",         codigo_pais: "FR", iata: "CDG", aeroporto: "Charles de Gaulle" },
                { cidade: "Orlando",                            pais: "Estados Unidos", codigo_pais: "US", iata: "MCO", aeroporto: "Orlando International" },
                { cidade: "Salvador",      sigla_estado: "BA", pais: "Brasil",         codigo_pais: "BR", iata: "SSA" },
            ];
        }
    },

    norm(t) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); },

    buscarCidades(termo) {
        if (!this.state.cidadesData || termo.length < 2) return [];
        const tn = this.norm(termo);
        return this.state.cidadesData
            .filter(c => {
                const n = this.norm(c.cidade);
                const i = c.iata.toLowerCase();
                const a = c.aeroporto ? this.norm(c.aeroporto) : '';
                return n.includes(tn) || i.includes(tn) || a.includes(tn);
            })
            .slice(0, 8)
            .map(c => ({ code: c.iata, name: c.cidade, state: c.sigla_estado || null, country: c.pais, countryCode: c.codigo_pais, airport: c.aeroporto || null }));
    },

    // ════════════════════════════════════════
    // AUTOCOMPLETE
    // ════════════════════════════════════════
    setupAutocomplete(inputId, resultsId, hiddenId, stateKey) {
        const input = document.getElementById(inputId);
        const results = document.getElementById(resultsId);
        const hidden = document.getElementById(hiddenId);
        let timer;

        input.addEventListener('input', (e) => {
            clearTimeout(timer);
            const t = e.target.value.trim();
            if (t.length < 2) {
                results.style.display = 'none'; results.innerHTML = '';
                this.state[stateKey] = null; hidden.value = '';
                return;
            }
            timer = setTimeout(() => {
                const cidades = this.buscarCidades(t);
                if (!cidades.length) {
                    results.innerHTML = '<div style="padding:12px;color:#666;font-size:13px;">Nenhuma cidade encontrada</div>';
                    results.style.display = 'block';
                    return;
                }
                results.innerHTML = cidades.map(c => `
                    <div class="autocomplete-item" data-city='${JSON.stringify(c)}'>
                        <div class="item-code">${c.code}</div>
                        <div class="item-details">
                            <div class="item-name">${c.name}${c.state ? ', ' + c.state : ''}${c.airport ? ' — ' + c.airport : ''}</div>
                            <div class="item-country">${c.country}</div>
                        </div>
                    </div>`).join('');
                results.style.display = 'block';
                results.querySelectorAll('.autocomplete-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const cidade = JSON.parse(item.dataset.city);
                        this.state[stateKey] = cidade;
                        input.value = cidade.airport ? `${cidade.name} — ${cidade.airport} (${cidade.code})` : `${cidade.name} (${cidade.code})`;
                        hidden.value = JSON.stringify(cidade);
                        results.style.display = 'none';
                    });
                });
            }, 250);
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !results.contains(e.target))
                results.style.display = 'none';
        });
    },

    // ════════════════════════════════════════
    // PASSAGEIROS — Métodos
    // ════════════════════════════════════════
    ajustarPax(tipo, delta) {
        const { numAdultos, numCriancas, numBebes } = this.state;
        const totalPagantes = numAdultos + numCriancas;

        if (tipo === 'adultos') {
            const novo = numAdultos + delta;
            if (novo < 1 || novo > 9 || (novo + numCriancas) > 9) return;
            this.state.numAdultos = novo;
        } else if (tipo === 'criancas') {
            const novo = numCriancas + delta;
            if (novo < 0 || novo > 8 || (numAdultos + novo) > 9) return;
            this.state.numCriancas = novo;
        } else if (tipo === 'bebes') {
            const novo = numBebes + delta;
            if (novo < 0 || novo > Math.min(4, this.state.numAdultos)) return; // 1 bebê por adulto
            this.state.numBebes = novo;
        }

        this._updatePaxUI();
    },

    _updatePaxUI() {
        const { numAdultos, numCriancas, numBebes } = this.state;
        const totalPagantes = numAdultos + numCriancas;

        // Atualizar counts
        const setCount = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = val;
                el.className = `pax-count${val > 0 ? ' has-value' : ''}`;
            }
        };
        setCount('pax-adultos-count', numAdultos);
        setCount('pax-criancas-count', numCriancas);
        setCount('pax-bebes-count', numBebes);

        // Atualizar estados dos botões
        const setDisabled = (id, disabled) => {
            const el = document.getElementById(id);
            if (el) el.disabled = disabled;
        };
        setDisabled('btn-adultos-menos', numAdultos <= 1);
        setDisabled('btn-adultos-mais', numAdultos >= 9 || (numAdultos + numCriancas) >= 9);
        setDisabled('btn-criancas-menos', numCriancas <= 0);
        setDisabled('btn-criancas-mais', numCriancas >= 8 || (numAdultos + numCriancas) >= 9);
        setDisabled('btn-bebes-menos', numBebes <= 0);
        setDisabled('btn-bebes-mais', numBebes >= 4 || numBebes >= numAdultos);

        // Hint total
        const hint = document.getElementById('pax-total-hint');
        if (hint) {
            const partes = [];
            partes.push(`${numAdultos} adulto${numAdultos > 1 ? 's' : ''}`);
            if (numCriancas > 0) partes.push(`${numCriancas} criança${numCriancas > 1 ? 's' : ''}`);
            if (numBebes > 0) partes.push(`${numBebes} bebê${numBebes > 1 ? 's' : ''} (grátis)`);
            hint.innerHTML = `Preço dividido por <strong>${totalPagantes}</strong> passageiro${totalPagantes > 1 ? 's' : ''} · ${partes.join(' + ')}`;
        }
    },

    // ════════════════════════════════════════
    // CALENDÁRIOS
    // ════════════════════════════════════════
    setupCalendars() {
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);

        this.state.fpIda = flatpickr('#datas-ida', {
            mode: 'multiple', minDate: amanha, dateFormat: 'Y-m-d', locale: 'pt', conjunction: ', ',
            onChange: (sel) => {
                if (sel.length > this.config.maxDatasIda) { sel.splice(this.config.maxDatasIda); this.state.fpIda.setDate(sel); }
                this.state.datasIda = sel.map(d => this.fmtISO(d)).sort();
                this.renderChips('chips-ida', this.state.datasIda, 'ida');
                this.updateComboCount();
                if (sel.length > 0) {
                    const min = new Date(Math.min(...sel));
                    min.setDate(min.getDate() + 1);
                    this.state.fpVolta.set('minDate', min);
                }
                document.getElementById('datas-ida').value = sel.length > 0 ? sel.map(d => this.fmtBR(d)).join(', ') : '';
            }
        });

        this.state.fpVolta = flatpickr('#datas-volta', {
            mode: 'multiple', minDate: amanha, dateFormat: 'Y-m-d', locale: 'pt', conjunction: ', ',
            onChange: (sel) => {
                if (sel.length > this.config.maxDatasVolta) { sel.splice(this.config.maxDatasVolta); this.state.fpVolta.setDate(sel); }
                this.state.datasVolta = sel.map(d => this.fmtISO(d)).sort();
                this.renderChips('chips-volta', this.state.datasVolta, 'volta');
                this.updateComboCount();
                document.getElementById('datas-volta').value = sel.length > 0 ? sel.map(d => this.fmtBR(d)).join(', ') : '';
            }
        });
    },

    renderChips(containerId, datas, tipo) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = datas.map((d, i) => {
            const br = new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
            const icon = tipo === 'ida' ? '🛫' : '🛬';
            return `<span class="date-chip">${icon} ${br} <span class="remove-chip" onclick="BenetripCompararVoos.removeDate('${tipo}',${i})">✕</span></span>`;
        }).join('');
    },

    removeDate(tipo, idx) {
        const arr = tipo === 'ida' ? this.state.datasIda : this.state.datasVolta;
        arr.splice(idx, 1);
        const fp = tipo === 'ida' ? this.state.fpIda : this.state.fpVolta;
        const dates = arr.map(d => new Date(d + 'T12:00:00'));
        fp.setDate(dates);
        this.renderChips(tipo === 'ida' ? 'chips-ida' : 'chips-volta', arr, tipo);
        document.getElementById(tipo === 'ida' ? 'datas-ida' : 'datas-volta').value = dates.length > 0 ? dates.map(d => this.fmtBR(d)).join(', ') : '';
        this.updateComboCount();
    },

    getValidCombos() {
        const c = [];
        for (const ida of this.state.datasIda)
            for (const volta of this.state.datasVolta)
                if (volta > ida) c.push({ dataIda: ida, dataVolta: volta });
        return c;
    },

    updateComboCount() {
        const info = document.getElementById('combo-info');
        const text = document.getElementById('combo-text');
        const combos = this.getValidCombos();
        if (this.state.datasIda.length > 0 && this.state.datasVolta.length > 0) {
            info.style.display = 'flex';
            text.textContent = combos.length === 1 ? '1 combinação será pesquisada' : `${combos.length} combinações serão pesquisadas`;
        } else {
            info.style.display = 'none';
        }
    },

    // ════════════════════════════════════════
    // MOEDA
    // ════════════════════════════════════════
    setupCurrencyChips() {
        document.querySelectorAll('.currency-chip[data-currency]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.currency-chip[data-currency]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.moedaSelecionada = chip.dataset.currency;
            });
        });
    },

    // ════════════════════════════════════════
    // FORM
    // ════════════════════════════════════════
    setupForm() {
        document.getElementById('search-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (this.validar()) await this.buscar();
        });
    },

    validar() {
        if (!this.state.origemSelecionada) { alert('Selecione a cidade de origem'); return false; }
        if (!this.state.destinoSelecionado) { alert('Selecione a cidade de destino'); return false; }
        if (this.state.origemSelecionada.code === this.state.destinoSelecionado.code) { alert('Origem e destino devem ser diferentes'); return false; }
        if (!this.state.datasIda.length) { alert('Selecione pelo menos 1 data de ida'); return false; }
        if (!this.state.datasVolta.length) { alert('Selecione pelo menos 1 data de volta'); return false; }
        if (!this.getValidCombos().length) { alert('Datas de volta devem ser posteriores às de ida'); return false; }
        return true;
    },

    // ════════════════════════════════════════
    // BUSCAR
    // ════════════════════════════════════════
    async buscar() {
        const { origemSelecionada, destinoSelecionado, datasIda, datasVolta, moedaSelecionada, numAdultos, numCriancas, numBebes } = this.state;
        const combos = this.getValidCombos();

        this.showLoading();
        this.updateProgress(10, `🔍 Preparando ${combos.length} combinações...`);

        const totalPax = numAdultos + numCriancas + numBebes;
        const paxDesc = [
            `${numAdultos} adulto${numAdultos > 1 ? 's' : ''}`,
            numCriancas > 0 ? `${numCriancas} criança${numCriancas > 1 ? 's' : ''}` : '',
            numBebes > 0 ? `${numBebes} bebê${numBebes > 1 ? 's' : ''}` : '',
        ].filter(Boolean).join(' + ');

        document.getElementById('loading-sub').textContent = `${combos.length} combinações · ${paxDesc}`;

        try {
            this.updateProgress(25, `✈️ Pesquisando ${origemSelecionada.code} → ${destinoSelecionado.code}...`);

            const response = await fetch('/api/compare-flights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origem: origemSelecionada.code,
                    destino: destinoSelecionado.code,
                    datasIda, datasVolta,
                    moeda: moedaSelecionada,
                    adultos: numAdultos,
                    criancas: numCriancas,
                    bebes: numBebes,
                }),
            });

            this.updateProgress(75, '📊 Analisando resultados...');

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Erro na busca');
            }

            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Nenhum voo encontrado');

            this.state.resultados = data;
            this.log('✅ Resultados:', data.stats);

            this.updateProgress(100, '🎉 Pronto!');
            await this.delay(400);

            if (data.stats.cheapestCombo) {
                this.state.comboSelecionada = data.stats.cheapestCombo;
            } else {
                const first = data.combinacoes.find(c => c.voos.length > 0);
                if (first) this.state.comboSelecionada = { dataIda: first.dataIda, dataVolta: first.dataVolta };
            }

            this.state.sortAtivo = 'melhor';
            this._resetFiltros();
            this.renderResults(data);

        } catch (err) {
            this.log('❌ Erro:', err.message);
            alert(`Ops! ${err.message}`);
            this.showForm();
        }
    },

    // ════════════════════════════════════════
    // FILTROS — Core Logic
    // ════════════════════════════════════════
    _resetFiltros() {
        const f = this.state.filtros;
        f.paradas.clear();
        f.companhias.clear();
        f.aeroportosSaida.clear();
        f.aeroportosChegada.clear();
        f.aeroportosRetSaida.clear();
        f.aeroportosRetChegada.clear();
        f.precoMax = null;
        f.horarioSaidaIda.clear();
        f.horarioSaidaVolta.clear();
        f.duracaoMaxIda = null;
        f.duracaoMaxVolta = null;
        this.state.filtrosPanelAberto = false;
    },

    _countFiltrosAtivos() {
        const f = this.state.filtros;
        let count = 0;
        if (f.paradas.size > 0) count++;
        if (f.companhias.size > 0) count++;
        if (f.aeroportosSaida.size > 0) count++;
        if (f.aeroportosChegada.size > 0) count++;
        if (f.aeroportosRetSaida.size > 0) count++;
        if (f.aeroportosRetChegada.size > 0) count++;
        if (f.precoMax !== null) count++;
        if (f.horarioSaidaIda.size > 0) count++;
        if (f.horarioSaidaVolta.size > 0) count++;
        if (f.duracaoMaxIda !== null) count++;
        if (f.duracaoMaxVolta !== null) count++;
        return count;
    },

    // Extrair legs de ida e volta de um voo
    _splitLegs(voo) {
        const legs = voo.legs || [];
        const dest = this.state.destinoSelecionado;
        let splitIdx = -1;
        for (let i = 0; i < legs.length; i++) {
            const arrId = legs[i].arrival_airport.id;
            if (arrId === dest.code || arrId.startsWith(dest.code)) {
                splitIdx = i;
                break;
            }
        }
        return {
            outbound: splitIdx >= 0 ? legs.slice(0, splitIdx + 1) : legs,
            returnLegs: splitIdx >= 0 ? legs.slice(splitIdx + 1) : [],
        };
    },

    // Extrair options disponíveis da combo atual
    extractFilterOptions(combo) {
        const voos = combo?.voos || [];
        const opts = {
            paradas: new Map(),         // value -> count
            companhias: new Map(),      // name -> {logo, count}
            aeroportosSaida: new Map(), // id -> {name, count}
            aeroportosChegada: new Map(),
            aeroportosRetSaida: new Map(),
            aeroportosRetChegada: new Map(),
            precoMin: Infinity,
            precoMax: 0,
            duracaoMaxIda: 0,
            duracaoMaxVolta: 0,
            horarioCounts: {
                ida: { madrugada: 0, manha: 0, tarde: 0, noite: 0 },
                volta: { madrugada: 0, manha: 0, tarde: 0, noite: 0 },
            },
        };

        voos.forEach(voo => {
            // Paradas
            const stopsKey = Math.min(voo.stops, 2);
            opts.paradas.set(stopsKey, (opts.paradas.get(stopsKey) || 0) + 1);

            // Companhias
            voo.airlines.forEach(a => {
                const cur = opts.companhias.get(a.name) || { logo: a.logo, count: 0 };
                cur.count++;
                opts.companhias.set(a.name, cur);
            });

            // Preço
            opts.precoMin = Math.min(opts.precoMin, voo.price);
            opts.precoMax = Math.max(opts.precoMax, voo.price);

            // Split legs
            const { outbound, returnLegs } = this._splitLegs(voo);

            const addAirport = (map, id, name) => {
                if (!id) return;
                const cur = map.get(id) || { name: name || id, count: 0 };
                cur.count++;
                map.set(id, cur);
            };

            if (outbound.length > 0) {
                const first = outbound[0];
                const last = outbound[outbound.length - 1];
                addAirport(opts.aeroportosSaida, first.departure_airport.id, first.departure_airport.name);
                addAirport(opts.aeroportosChegada, last.arrival_airport.id, last.arrival_airport.name);
                // Duração total ida
                const dur = outbound.reduce((s, l) => s + l.duration, 0);
                opts.duracaoMaxIda = Math.max(opts.duracaoMaxIda, dur);
                // Horário saída ida
                const block = this._getTimeBlock(first.departure_airport.time);
                if (block) opts.horarioCounts.ida[block]++;
            }

            if (returnLegs.length > 0) {
                const first = returnLegs[0];
                const last = returnLegs[returnLegs.length - 1];
                addAirport(opts.aeroportosRetSaida, first.departure_airport.id, first.departure_airport.name);
                addAirport(opts.aeroportosRetChegada, last.arrival_airport.id, last.arrival_airport.name);
                const dur = returnLegs.reduce((s, l) => s + l.duration, 0);
                opts.duracaoMaxVolta = Math.max(opts.duracaoMaxVolta, dur);
                const block = this._getTimeBlock(first.departure_airport.time);
                if (block) opts.horarioCounts.volta[block]++;
            }
        });

        return opts;
    },

    _getTimeBlock(timeStr) {
        const mins = this._timeToMins(timeStr);
        if (mins === null) return null;
        for (const [key, b] of Object.entries(this.TIME_BLOCKS)) {
            if (mins >= b.min && mins <= b.max) return key;
        }
        return null;
    },

    _timeToMins(timeStr) {
        if (!timeStr) return null;
        const match = timeStr.match(/(\d{2}):(\d{2})/);
        if (!match) return null;
        return parseInt(match[1]) * 60 + parseInt(match[2]);
    },

    // Aplicar todos os filtros num array de voos
    applyFilters(voos) {
        const f = this.state.filtros;
        const s = this.state.sortAtivo;

        let resultado = voos.filter(voo => {
            // ── Paradas ──────────────────────────────
            if (f.paradas.size > 0) {
                const stopsKey = Math.min(voo.stops, 2);
                if (!f.paradas.has(stopsKey)) return false;
            }

            // ── Companhias ────────────────────────────
            if (f.companhias.size > 0) {
                const vooAirlines = voo.airlines.map(a => a.name);
                if (!Array.from(f.companhias).some(c => vooAirlines.includes(c))) return false;
            }

            // ── Preço máximo ──────────────────────────
            if (f.precoMax !== null && voo.price > f.precoMax) return false;

            // ── Split legs para demais filtros ────────
            const { outbound, returnLegs } = this._splitLegs(voo);

            // ── Aeroportos de saída (ida) ─────────────
            if (f.aeroportosSaida.size > 0 && outbound.length > 0) {
                if (!f.aeroportosSaida.has(outbound[0].departure_airport.id)) return false;
            }

            // ── Aeroportos de chegada (ida) ───────────
            if (f.aeroportosChegada.size > 0 && outbound.length > 0) {
                if (!f.aeroportosChegada.has(outbound[outbound.length - 1].arrival_airport.id)) return false;
            }

            // ── Aeroportos de saída (volta) ───────────
            if (f.aeroportosRetSaida.size > 0 && returnLegs.length > 0) {
                if (!f.aeroportosRetSaida.has(returnLegs[0].departure_airport.id)) return false;
            }

            // ── Aeroportos de chegada (volta) ─────────
            if (f.aeroportosRetChegada.size > 0 && returnLegs.length > 0) {
                if (!f.aeroportosRetChegada.has(returnLegs[returnLegs.length - 1].arrival_airport.id)) return false;
            }

            // ── Horário de saída ida ──────────────────
            if (f.horarioSaidaIda.size > 0 && outbound.length > 0) {
                const block = this._getTimeBlock(outbound[0].departure_airport.time);
                if (!block || !f.horarioSaidaIda.has(block)) return false;
            }

            // ── Horário de saída volta ────────────────
            if (f.horarioSaidaVolta.size > 0 && returnLegs.length > 0) {
                const block = this._getTimeBlock(returnLegs[0].departure_airport.time);
                if (!block || !f.horarioSaidaVolta.has(block)) return false;
            }

            // ── Duração máxima ida ────────────────────
            if (f.duracaoMaxIda !== null && outbound.length > 0) {
                const dur = outbound.reduce((s, l) => s + l.duration, 0);
                if (dur > f.duracaoMaxIda) return false;
            }

            // ── Duração máxima volta ──────────────────
            if (f.duracaoMaxVolta !== null && returnLegs.length > 0) {
                const dur = returnLegs.reduce((s, l) => s + l.duration, 0);
                if (dur > f.duracaoMaxVolta) return false;
            }

            return true;
        });

        // ── Ordenação ─────────────────────────────
        if (s === 'barato') {
            resultado.sort((a, b) => a.price - b.price);
        } else if (s === 'rapido') {
            resultado.sort((a, b) => a.total_duration - b.total_duration);
        } else if (s === 'melhor') {
            // Score composto: normalizar preço + duração, peso 60/40
            const precoMax = Math.max(...resultado.map(v => v.price)) || 1;
            const durMax = Math.max(...resultado.map(v => v.total_duration)) || 1;
            resultado.sort((a, b) => {
                const scoreA = (a.price / precoMax) * 0.6 + (a.total_duration / durMax) * 0.4;
                const scoreB = (b.price / precoMax) * 0.6 + (b.total_duration / durMax) * 0.4;
                return scoreA - scoreB;
            });
        }

        return resultado;
    },

    // ════════════════════════════════════════
    // FILTROS — UI Actions
    // ════════════════════════════════════════
    toggleFiltros() {
        this.state.filtrosPanelAberto = !this.state.filtrosPanelAberto;
        this._refreshFilterBarUI();
        const panel = document.getElementById('filter-panel');
        const icon = document.getElementById('filter-toggle-icon');
        if (panel) panel.classList.toggle('open', this.state.filtrosPanelAberto);
        if (icon) icon.classList.toggle('open', this.state.filtrosPanelAberto);
    },

    toggleParada(val) {
        const v = Number(val);
        if (this.state.filtros.paradas.has(v)) this.state.filtros.paradas.delete(v);
        else this.state.filtros.paradas.add(v);
        this._applyAndRefresh();
    },

    toggleCompanhia(nome) {
        if (this.state.filtros.companhias.has(nome)) this.state.filtros.companhias.delete(nome);
        else this.state.filtros.companhias.add(nome);
        this._applyAndRefresh();
    },

    toggleAeroporto(tipo, id) {
        const set = this.state.filtros[tipo];
        if (set.has(id)) set.delete(id);
        else set.add(id);
        this._applyAndRefresh();
    },

    toggleHorario(tipo, block) {
        const key = tipo === 'ida' ? 'horarioSaidaIda' : 'horarioSaidaVolta';
        if (this.state.filtros[key].has(block)) this.state.filtros[key].delete(block);
        else this.state.filtros[key].add(block);
        this._applyAndRefresh();
    },

    setPrecoMax(val) {
        this.state.filtros.precoMax = val === '' || val === null ? null : Number(val);
        this._applyAndRefresh();
    },

    setDuracaoMax(tipo, val) {
        const key = tipo === 'ida' ? 'duracaoMaxIda' : 'duracaoMaxVolta';
        this.state.filtros[key] = val === '' || val === null ? null : Number(val);
        this._applyAndRefresh();
    },

    setSort(sort) {
        this.state.sortAtivo = sort;
        this._applyAndRefresh();
    },

    limparFiltros() {
        this._resetFiltros();
        this.state.filtrosPanelAberto = true;
        this._reRenderComboDetail();
    },

    _applyAndRefresh() {
        this._refreshFilterBarUI();
        this._refreshFlightsList();
        this._refreshFilterPanelChecks();
    },

    _refreshFilterBarUI() {
        const count = this._countFiltrosAtivos();
        const bar = document.getElementById('filter-bar');
        const badge = document.getElementById('filter-active-badge');
        const clearBtn = document.getElementById('btn-clear-filters');
        const resCount = document.getElementById('filter-results-count');

        if (bar) bar.classList.toggle('has-active', count > 0);
        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('visible', count > 0);
        }
        if (clearBtn) clearBtn.classList.toggle('visible', count > 0);

        if (resCount) {
            const combo = this._getCurrentCombo();
            if (combo) {
                const filtered = this.applyFilters(combo.voos);
                resCount.textContent = `${filtered.length} de ${combo.voos.length} voos`;
            }
        }
    },

    _refreshFlightsList() {
        const listEl = document.getElementById('flights-list-container');
        const tagsEl = document.getElementById('active-filter-tags');
        if (!listEl) return;

        const combo = this._getCurrentCombo();
        if (!combo) return;

        const { moedaSelecionada: moeda } = this.state;
        const paxParaPreco = this.state.resultados?.paxParaPreco || (this.state.numAdultos + this.state.numCriancas);
        const s = this.getSimbolo(moeda);

        const voosFiltered = this.applyFilters(combo.voos);

        // Atualizar tags ativas
        if (tagsEl) tagsEl.innerHTML = this._buildActiveFilterTags();

        if (voosFiltered.length === 0) {
            listEl.innerHTML = `
                <div class="no-filter-results">
                    <div class="nfr-icon">🔍</div>
                    <p>Nenhum voo com os filtros selecionados.</p>
                    <button class="btn-reset-filters" onclick="BenetripCompararVoos.limparFiltros()">Limpar filtros</button>
                </div>`;
        } else {
            listEl.innerHTML = voosFiltered.slice(0, 20)
                .map((v, idx) => this._renderFlightCard(v, idx, s, paxParaPreco, this.state.comboSelecionada))
                .join('');
        }
    },

    _refreshFilterPanelChecks() {
        const combo = this._getCurrentCombo();
        if (!combo) return;
        const opts = this.extractFilterOptions(combo);
        const f = this.state.filtros;

        // Paradas
        [0, 1, 2].forEach(val => {
            const el = document.querySelector(`.stops-opt[data-val="${val}"]`);
            if (el) el.classList.toggle('checked', f.paradas.has(val));
        });

        // Companhias
        opts.companhias.forEach((_, nome) => {
            const el = document.querySelector(`.filter-check-item[data-airline="${CSS.escape(nome)}"]`);
            if (el) el.classList.toggle('checked', f.companhias.has(nome));
        });

        // Aeroportos
        ['aeroportosSaida','aeroportosChegada','aeroportosRetSaida','aeroportosRetChegada'].forEach(tipo => {
            f[tipo].forEach(id => {
                const el = document.querySelector(`.filter-check-item[data-airport="${tipo}-${CSS.escape(id)}"]`);
                if (el) el.classList.toggle('checked', true);
            });
        });

        // Horários
        ['ida','volta'].forEach(dir => {
            const key = dir === 'ida' ? 'horarioSaidaIda' : 'horarioSaidaVolta';
            Object.keys(this.TIME_BLOCKS).forEach(block => {
                const el = document.querySelector(`.time-block[data-dir="${dir}"][data-block="${block}"]`);
                if (el) el.classList.toggle('checked', f[key].has(block));
            });
        });

        // Sliders
        const precoSlider = document.getElementById('range-preco');
        if (precoSlider && f.precoMax !== null) precoSlider.value = f.precoMax;

        const durIdaSlider = document.getElementById('range-dur-ida');
        if (durIdaSlider && f.duracaoMaxIda !== null) durIdaSlider.value = f.duracaoMaxIda;

        const durVoltaSlider = document.getElementById('range-dur-volta');
        if (durVoltaSlider && f.duracaoMaxVolta !== null) durVoltaSlider.value = f.duracaoMaxVolta;

        // Sort chips
        document.querySelectorAll('.sort-chip').forEach(c => {
            c.classList.toggle('active', c.dataset.sort === this.state.sortAtivo);
        });
    },

    _buildActiveFilterTags() {
        const f = this.state.filtros;
        const tags = [];
        const s = this.getSimbolo(this.state.moedaSelecionada);

        if (f.paradas.size > 0) {
            const labels = { 0: 'Direto', 1: '1 parada', 2: '2+ paradas' };
            f.paradas.forEach(v => {
                tags.push(`<span class="active-tag">${labels[v]} <span class="tag-remove" onclick="BenetripCompararVoos.toggleParada(${v})">✕</span></span>`);
            });
        }
        f.companhias.forEach(nome => {
            tags.push(`<span class="active-tag">✈️ ${nome} <span class="tag-remove" onclick="BenetripCompararVoos.toggleCompanhia('${nome.replace(/'/g,"\\'")}')">✕</span></span>`);
        });
        if (f.precoMax !== null) {
            const paxParaPreco = this.state.resultados?.paxParaPreco || 1;
            tags.push(`<span class="active-tag">💰 até ${s} ${Math.round(f.precoMax / paxParaPreco).toLocaleString('pt-BR')}/pessoa <span class="tag-remove" onclick="BenetripCompararVoos.setPrecoMax(null)">✕</span></span>`);
        }
        f.horarioSaidaIda.forEach(b => {
            tags.push(`<span class="active-tag">🛫 ${this.TIME_BLOCKS[b].label} <span class="tag-remove" onclick="BenetripCompararVoos.toggleHorario('ida','${b}')">✕</span></span>`);
        });
        f.horarioSaidaVolta.forEach(b => {
            tags.push(`<span class="active-tag">🛬 ${this.TIME_BLOCKS[b].label} <span class="tag-remove" onclick="BenetripCompararVoos.toggleHorario('volta','${b}')">✕</span></span>`);
        });
        if (f.duracaoMaxIda !== null) {
            tags.push(`<span class="active-tag">⏱️ Ida ≤ ${this.fmtDuracao(f.duracaoMaxIda)} <span class="tag-remove" onclick="BenetripCompararVoos.setDuracaoMax('ida',null)">✕</span></span>`);
        }
        if (f.duracaoMaxVolta !== null) {
            tags.push(`<span class="active-tag">⏱️ Volta ≤ ${this.fmtDuracao(f.duracaoMaxVolta)} <span class="tag-remove" onclick="BenetripCompararVoos.setDuracaoMax('volta',null)">✕</span></span>`);
        }

        const airportLabels = {
            aeroportosSaida: '🛫 Saída ida',
            aeroportosChegada: '🛬 Chegada ida',
            aeroportosRetSaida: '🛫 Saída volta',
            aeroportosRetChegada: '🛬 Chegada volta',
        };
        Object.entries(airportLabels).forEach(([key, label]) => {
            f[key].forEach(id => {
                tags.push(`<span class="active-tag">${label}: ${id} <span class="tag-remove" onclick="BenetripCompararVoos.toggleAeroporto('${key}','${id}')">✕</span></span>`);
            });
        });

        return tags.join('');
    },

    _getCurrentCombo() {
        const sel = this.state.comboSelecionada;
        if (!sel || !this.state.resultados) return null;
        return this.state.resultados.combinacoes.find(c => c.dataIda === sel.dataIda && c.dataVolta === sel.dataVolta) || null;
    },

    // ════════════════════════════════════════
    // RENDER FILTROS
    // ════════════════════════════════════════
    _renderFilterPanel(combo) {
        const opts = this.extractFilterOptions(combo);
        const f = this.state.filtros;
        const s = this.getSimbolo(this.state.moedaSelecionada);
        const paxParaPreco = this.state.resultados?.paxParaPreco || 1;

        // ── Paradas ──────────────────────────────
        const stopLabels = { 0: { label: 'Direto', icon: '✅' }, 1: { label: '1 parada', icon: '🔄' }, 2: { label: '2+ paradas', icon: '🔀' } };
        const stopsHtml = [0, 1, 2].map(val => {
            const cnt = opts.paradas.get(val) || 0;
            if (cnt === 0) return '';
            const { label, icon } = stopLabels[val];
            return `<div class="stops-opt ${f.paradas.has(val) ? 'checked' : ''}" data-val="${val}" onclick="BenetripCompararVoos.toggleParada(${val})">
                <span class="stops-opt-icon">${icon}</span>
                <span class="stops-opt-label">${label}</span>
                <span class="stops-opt-count">${cnt} voo${cnt > 1 ? 's' : ''}</span>
            </div>`;
        }).join('');

        // ── Companhias ────────────────────────────
        const compHtml = Array.from(opts.companhias.entries()).map(([nome, info]) => `
            <div class="filter-check-item ${f.companhias.has(nome) ? 'checked' : ''}" data-airline="${nome}" onclick="BenetripCompararVoos.toggleCompanhia('${nome.replace(/'/g,"\\'")}')">
                <span class="fci-check"></span>
                ${info.logo ? `<img src="${info.logo}" style="width:18px;height:18px;object-fit:contain;border-radius:3px" onerror="this.style.display='none'">` : ''}
                ${nome} <span class="fci-count">${info.count}</span>
            </div>`).join('');

        // ── Horários ──────────────────────────────
        const buildTimeHtml = (dir) => {
            const key = dir === 'ida' ? 'horarioSaidaIda' : 'horarioSaidaVolta';
            const counts = opts.horarioCounts[dir];
            return Object.entries(this.TIME_BLOCKS).map(([block, meta]) => {
                const cnt = counts[block] || 0;
                if (cnt === 0) return '';
                return `<div class="time-block ${f[key].has(block) ? 'checked' : ''}" data-dir="${dir}" data-block="${block}" onclick="BenetripCompararVoos.toggleHorario('${dir}','${block}')">
                    <span class="tb-icon">${meta.icon}</span>
                    <span class="tb-label">${meta.label}</span>
                    <span class="tb-range">${meta.range}</span>
                </div>`;
            }).join('');
        };

        // ── Preço ─────────────────────────────────
        const precoMinPp = Math.round(opts.precoMin / paxParaPreco);
        const precoMaxPp = Math.round(opts.precoMax / paxParaPreco);
        const precoAtual = f.precoMax ?? opts.precoMax;
        const precoAtualPp = Math.round(precoAtual / paxParaPreco);

        const precoHtml = opts.precoMax > 0 ? `
            <div class="filter-range-group">
                <div class="range-row">
                    <input type="range" id="range-preco" class="range-input"
                           min="${opts.precoMin}" max="${opts.precoMax}" step="50"
                           value="${precoAtual}"
                           oninput="BenetripCompararVoos._updatePrecoDisplay(this.value)"
                           onchange="BenetripCompararVoos.setPrecoMax(this.value)">
                    <span class="range-value" id="range-preco-val">${s} ${precoAtualPp.toLocaleString('pt-BR')}<small style="font-size:9px;opacity:.6">/pessoa</small></span>
                </div>
                <div class="range-limits">
                    <span>${s} ${precoMinPp.toLocaleString('pt-BR')}</span>
                    <span>${s} ${precoMaxPp.toLocaleString('pt-BR')}</span>
                </div>
            </div>` : '<p style="font-size:13px;color:var(--gray-medium)">Dados de preço indisponíveis</p>';

        // ── Duração ───────────────────────────────
        const buildDurHtml = (tipo) => {
            const maxDur = tipo === 'ida' ? opts.duracaoMaxIda : opts.duracaoMaxVolta;
            if (maxDur === 0) return '<p style="font-size:13px;color:var(--gray-medium)">Dados indisponíveis</p>';
            const key = tipo === 'ida' ? 'duracaoMaxIda' : 'duracaoMaxVolta';
            const current = f[key] ?? maxDur;
            return `
                <div class="filter-range-group">
                    <div class="range-row">
                        <input type="range" id="range-dur-${tipo}" class="range-input"
                               min="60" max="${maxDur}" step="30" value="${current}"
                               oninput="BenetripCompararVoos._updateDurDisplay('${tipo}',this.value)"
                               onchange="BenetripCompararVoos.setDuracaoMax('${tipo}',this.value)">
                        <span class="range-value" id="range-dur-${tipo}-val">${this.fmtDuracao(current)}</span>
                    </div>
                    <div class="range-limits">
                        <span>1h</span>
                        <span>${this.fmtDuracao(maxDur)}</span>
                    </div>
                </div>`;
        };

        // ── Aeroportos ────────────────────────────
        const buildAirportHtml = (map, tipo) => {
            if (map.size <= 1) return '';
            return Array.from(map.entries()).map(([id, info]) => `
                <div class="filter-check-item ${f[tipo].has(id) ? 'checked' : ''}" data-airport="${tipo}-${id}" onclick="BenetripCompararVoos.toggleAeroporto('${tipo}','${id}')">
                    <span class="fci-check"></span>
                    <strong>${id}</strong> — ${info.name} <span class="fci-count">${info.count}</span>
                </div>`).join('');
        };

        const aerSaidaHtml = buildAirportHtml(opts.aeroportosSaida, 'aeroportosSaida');
        const aerChegadaHtml = buildAirportHtml(opts.aeroportosChegada, 'aeroportosChegada');
        const aerRetSaidaHtml = buildAirportHtml(opts.aeroportosRetSaida, 'aeroportosRetSaida');
        const aerRetChegadaHtml = buildAirportHtml(opts.aeroportosRetChegada, 'aeroportosRetChegada');

        const hasAeroportos = aerSaidaHtml || aerChegadaHtml || aerRetSaidaHtml || aerRetChegadaHtml;

        return `
            <div class="filter-section">
                <div class="filter-section-title"><span class="filter-section-title-icon">🔄</span> Número de Paradas</div>
                <div class="stops-options">${stopsHtml || '<span style="font-size:13px;color:var(--gray-medium)">Dados indisponíveis</span>'}</div>
            </div>

            ${compHtml ? `
            <div class="filter-section">
                <div class="filter-section-title"><span class="filter-section-title-icon">✈️</span> Companhias Aéreas</div>
                <div class="filter-checks">${compHtml}</div>
            </div>` : ''}

            <div class="filter-section">
                <div class="filter-section-title"><span class="filter-section-title-icon">💰</span> Preço Máximo por Pessoa</div>
                ${precoHtml}
            </div>

            <div class="filter-section">
                <div class="filter-section-title"><span class="filter-section-title-icon">🛫</span> Horário de Saída — Ida</div>
                <div class="time-blocks">${buildTimeHtml('ida') || '<span style="font-size:13px;color:var(--gray-medium)">Dados indisponíveis</span>'}</div>
            </div>

            <div class="filter-section">
                <div class="filter-section-title"><span class="filter-section-title-icon">🛬</span> Horário de Saída — Volta</div>
                <div class="time-blocks">${buildTimeHtml('volta') || '<span style="font-size:13px;color:var(--gray-medium)">Dados indisponíveis</span>'}</div>
            </div>

            <div class="filter-section">
                <div class="filter-section-title"><span class="filter-section-title-icon">⏱️</span> Duração Máxima do Voo de Ida</div>
                ${buildDurHtml('ida')}
            </div>

            <div class="filter-section">
                <div class="filter-section-title"><span class="filter-section-title-icon">⏱️</span> Duração Máxima do Voo de Volta</div>
                ${buildDurHtml('volta')}
            </div>

            ${hasAeroportos ? `
            <div class="filter-section">
                <div class="filter-section-title"><span class="filter-section-title-icon">🏢</span> Aeroportos</div>
                ${aerSaidaHtml ? `<div style="margin-bottom:10px"><p style="font-size:11px;font-weight:600;color:var(--gray-medium);text-transform:uppercase;margin-bottom:6px">Saída (ida)</p><div class="filter-checks">${aerSaidaHtml}</div></div>` : ''}
                ${aerChegadaHtml ? `<div style="margin-bottom:10px"><p style="font-size:11px;font-weight:600;color:var(--gray-medium);text-transform:uppercase;margin-bottom:6px">Chegada (ida)</p><div class="filter-checks">${aerChegadaHtml}</div></div>` : ''}
                ${aerRetSaidaHtml ? `<div style="margin-bottom:10px"><p style="font-size:11px;font-weight:600;color:var(--gray-medium);text-transform:uppercase;margin-bottom:6px">Saída (volta)</p><div class="filter-checks">${aerRetSaidaHtml}</div></div>` : ''}
                ${aerRetChegadaHtml ? `<div><p style="font-size:11px;font-weight:600;color:var(--gray-medium);text-transform:uppercase;margin-bottom:6px">Chegada (volta)</p><div class="filter-checks">${aerRetChegadaHtml}</div></div>` : ''}
            </div>` : ''}
        `;
    },

    // Live display updates para sliders (sem esperar onChange)
    _updatePrecoDisplay(val) {
        const paxParaPreco = this.state.resultados?.paxParaPreco || 1;
        const s = this.getSimbolo(this.state.moedaSelecionada);
        const el = document.getElementById('range-preco-val');
        if (el) el.innerHTML = `${s} ${Math.round(Number(val) / paxParaPreco).toLocaleString('pt-BR')}<small style="font-size:9px;opacity:.6">/pessoa</small>`;
    },

    _updateDurDisplay(tipo, val) {
        const el = document.getElementById(`range-dur-${tipo}-val`);
        if (el) el.textContent = this.fmtDuracao(Number(val));
    },

    // ════════════════════════════════════════
    // RENDER RESULTADOS
    // ════════════════════════════════════════
    renderResults(data) {
        const container = document.getElementById('results-content');
        const { origemSelecionada: orig, destinoSelecionado: dest, moedaSelecionada: moeda, numAdultos, numCriancas, numBebes } = this.state;
        const s = this.getSimbolo(moeda);
        const paxParaPreco = data.paxParaPreco || (numAdultos + numCriancas);
        const stats = data.stats;

        const precoPorPessoaCheapest = Math.round(stats.cheapest / paxParaPreco);
        const precoPorPessoaMedia = Math.round(stats.average / paxParaPreco);
        const precoPorPessoaMaisCaro = Math.round(stats.mostExpensive / paxParaPreco);

        const winnerCombo = data.combinacoes.find(c => c.dataIda === stats.cheapestCombo.dataIda && c.dataVolta === stats.cheapestCombo.dataVolta);
        const winnerNoites = winnerCombo?.noites || '—';

        const saving = stats.mostExpensive - stats.cheapest;
        const savingPct = stats.mostExpensive > 0 ? Math.round((saving / stats.mostExpensive) * 100) : 0;
        const tipText = savingPct > 20
            ? `<strong>Boa escolha ser flexível!</strong> A diferença entre a combo mais barata e a mais cara é de <strong>${s} ${Math.round(saving / paxParaPreco).toLocaleString('pt-BR')}</strong> por pessoa (${savingPct}%)! 🐾`
            : savingPct > 5
            ? `A diferença entre as combinações é de <strong>${s} ${Math.round(saving / paxParaPreco).toLocaleString('pt-BR')}</strong> por pessoa. Cada real conta! 🐾`
            : `Os preços estão bem parecidos. Escolha a data mais conveniente! 🎉`;

        // Resumo de passageiros
        const paxParts = [`${numAdultos} adulto${numAdultos > 1 ? 's' : ''}`];
        if (numCriancas > 0) paxParts.push(`${numCriancas} criança${numCriancas > 1 ? 's' : ''}`);
        if (numBebes > 0) paxParts.push(`${numBebes} bebê${numBebes > 1 ? 's' : ''}`);
        const paxDesc = paxParts.join(' + ');

        container.innerHTML = `
            <button class="btn-back" onclick="BenetripCompararVoos.showForm()">← Nova busca</button>

            <div class="trip-summary fade-in">
                <div class="trip-route">
                    <div class="trip-city">
                        <span class="trip-code">${orig.code}</span>
                        <span class="trip-name">${orig.name}</span>
                    </div>
                    <div class="trip-arrow">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                    </div>
                    <div class="trip-city">
                        <span class="trip-code">${dest.code}</span>
                        <span class="trip-name">${dest.name}</span>
                    </div>
                </div>
                <div class="trip-meta">
                    <span class="meta-chip">👥 ${paxDesc}</span>
                    <span class="meta-chip">💱 ${moeda}</span>
                    <span class="meta-chip">🔀 ${stats.totalCombinacoes} combinações</span>
                    <span class="meta-chip">✅ ${stats.combinacoesComVoo} com voos</span>
                </div>
            </div>

            <div class="winner-card fade-in" style="animation-delay:.05s">
                <div class="winner-badge">🏆 MELHOR COMBINAÇÃO</div>
                <div class="winner-row">
                    <div>
                        <div class="winner-price">${s} ${precoPorPessoaCheapest.toLocaleString('pt-BR')}</div>
                        <div class="winner-price-label">por pessoa · ida e volta</div>
                        ${paxParaPreco > 1 ? `<div class="winner-price-label" style="opacity:1;font-weight:600">Total ${paxParaPreco}p: ${s} ${stats.cheapest.toLocaleString('pt-BR')}${numBebes > 0 ? ` + ${numBebes} bebê${numBebes > 1 ? 's' : ''} (grátis)` : ''}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
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
                <div class="stat-card"><div class="stat-label">Mais barato</div><div class="stat-value green">${s} ${precoPorPessoaCheapest.toLocaleString('pt-BR')}</div></div>
                <div class="stat-card"><div class="stat-label">Média</div><div class="stat-value blue">${s} ${precoPorPessoaMedia.toLocaleString('pt-BR')}</div></div>
                <div class="stat-card"><div class="stat-label">Mais caro</div><div class="stat-value orange">${s} ${precoPorPessoaMaisCaro.toLocaleString('pt-BR')}</div></div>
            </div>

            <div class="tripinha-tip fade-in" style="animation-delay:.15s">
                <img src="assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="tripinha-tip-avatar" onerror="this.style.display='none'">
                <div class="tripinha-tip-text">${tipText}</div>
            </div>

            <div class="matrix-section fade-in" style="animation-delay:.2s">
                <h3 class="matrix-title">📊 Matriz de Preços</h3>
                <p class="matrix-subtitle">Valores por pessoa. Clique para ver os voos da combinação.</p>
                ${this._renderMatrix(data, s, paxParaPreco)}
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
                    <button class="btn-share btn-share-copy" onclick="BenetripCompararVoos.copyShareText()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        Copiar texto
                    </button>
                </div>
            </div>
        `;

        this.showResults();
    },

    // ════════════════════════════════════════
    // PRICE MATRIX
    // ════════════════════════════════════════
    _renderMatrix(data, simbolo, paxParaPreco) {
        const { datasIda, datasVolta, matrizPrecos, stats } = data;
        const sel = this.state.comboSelecionada;

        let html = '<table class="price-matrix"><thead><tr>';
        html += '<th class="corner-cell"><span class="corner-labels"><span class="corner-ida">IDA →</span><span class="corner-volta">↓ VOLTA</span></span></th>';
        datasIda.forEach(d => {
            html += `<th class="col-header">🛫 ${this.fmtDateShort(d)}<br><small>${this.fmtWeekday(d)}</small></th>`;
        });
        html += '</tr></thead><tbody>';

        datasVolta.forEach(volta => {
            html += `<tr><th class="row-header">🛬 ${this.fmtDateShort(volta)}<br><small>${this.fmtWeekday(volta)}</small></th>`;
            datasIda.forEach(ida => {
                const key = `${ida}_${volta}`;
                const cell = matrizPrecos[key];
                if (!cell || cell.error || cell.melhorPreco === null) {
                    html += `<td class="matrix-cell no-data">${volta <= ida ? '—' : '✗'}</td>`;
                    return;
                }
                const pricePp = Math.round(cell.melhorPreco / paxParaPreco);
                const isCheapest = cell.melhorPreco === stats.cheapest;
                const isExpensive = cell.melhorPreco === stats.mostExpensive && stats.totalCombinacoes > 1;
                const isSelected = sel && sel.dataIda === ida && sel.dataVolta === volta;
                let cls = 'mid';
                if (isCheapest) cls = 'cheapest';
                else if (isExpensive) cls = 'expensive';
                html += `<td class="matrix-cell ${cls} ${isSelected ? 'selected' : ''}" onclick="BenetripCompararVoos.selectCombo('${ida}','${volta}')">
                    ${simbolo} ${pricePp.toLocaleString('pt-BR')}
                    <span class="matrix-noites">${cell.noites}n · ${cell.totalVoos} voos</span>
                </td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    },

    // ════════════════════════════════════════
    // SELECT COMBO
    // ════════════════════════════════════════
    selectCombo(ida, volta) {
        this.state.comboSelecionada = { dataIda: ida, dataVolta: volta };
        this._resetFiltros();
        this.state.filtrosPanelAberto = false;

        document.querySelectorAll('.matrix-cell').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.matrix-cell').forEach(c => {
            const oc = c.getAttribute('onclick') || '';
            if (oc.includes(`'${ida}'`) && oc.includes(`'${volta}'`)) c.classList.add('selected');
        });

        this._reRenderComboDetail();
    },

    _reRenderComboDetail() {
        const detailEl = document.getElementById('combo-detail');
        if (detailEl) {
            detailEl.innerHTML = this._renderComboDetail(this.state.resultados);
            detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },

    // ════════════════════════════════════════
    // COMBO DETAIL
    // ════════════════════════════════════════
    _renderComboDetail(data) {
        const sel = this.state.comboSelecionada;
        if (!sel) return '';

        const combo = data.combinacoes.find(c => c.dataIda === sel.dataIda && c.dataVolta === sel.dataVolta);
        if (!combo || !combo.voos.length) {
            return `<div class="combo-detail-section">
                <div class="combo-detail-header"><h3>📅 ${this.fmtDateShort(sel.dataIda)} → ${this.fmtDateShort(sel.dataVolta)}</h3></div>
                <div class="no-flights-msg">😕 Nenhum voo disponível para esta combinação de datas.</div>
            </div>`;
        }

        const { moedaSelecionada: moeda } = this.state;
        const paxParaPreco = data.paxParaPreco || (this.state.numAdultos + this.state.numCriancas);
        const s = this.getSimbolo(moeda);

        const voosFiltered = this.applyFilters(combo.voos);
        const filtrosAtivos = this._countFiltrosAtivos();

        let insightsHtml = '';
        if (combo.priceInsights?.typical_price_range?.[0] !== undefined) {
            const pi = combo.priceInsights;
            insightsHtml = ` · Faixa típica: ${s} ${Math.round(pi.typical_price_range[0] / paxParaPreco).toLocaleString('pt-BR')} – ${s} ${Math.round(pi.typical_price_range[1] / paxParaPreco).toLocaleString('pt-BR')}/pessoa`;
        }

        const cardsHtml = voosFiltered.length > 0
            ? voosFiltered.slice(0, 20).map((v, idx) => this._renderFlightCard(v, idx, s, paxParaPreco, sel)).join('')
            : `<div class="no-filter-results">
                    <div class="nfr-icon">🔍</div>
                    <p>Nenhum voo com os filtros selecionados.</p>
                    <button class="btn-reset-filters" onclick="BenetripCompararVoos.limparFiltros()">Limpar filtros</button>
               </div>`;

        return `
            <div class="combo-detail-section">
                <div class="combo-detail-header">
                    <div>
                        <h3>📅 ${this.fmtDateFull(sel.dataIda)} → ${this.fmtDateFull(sel.dataVolta)}</h3>
                        <div class="combo-detail-sub">${combo.noites} noites · ${combo.voos.length} opções${insightsHtml}</div>
                    </div>
                </div>

                <!-- Ordenação -->
                <div class="sort-filter-row">
                    <span class="sort-label">Ordenar:</span>
                    <div class="sort-chips">
                        <div class="sort-chip ${this.state.sortAtivo === 'melhor' ? 'active' : ''}" data-sort="melhor" onclick="BenetripCompararVoos.setSort('melhor')">⭐ Melhor</div>
                        <div class="sort-chip ${this.state.sortAtivo === 'barato' ? 'active' : ''}" data-sort="barato" onclick="BenetripCompararVoos.setSort('barato')">💰 Mais barato</div>
                        <div class="sort-chip ${this.state.sortAtivo === 'rapido' ? 'active' : ''}" data-sort="rapido" onclick="BenetripCompararVoos.setSort('rapido')">⚡ Mais rápido</div>
                    </div>
                </div>

                <!-- Barra de filtros -->
                <div class="filter-bar ${filtrosAtivos > 0 ? 'has-active' : ''}" id="filter-bar" onclick="BenetripCompararVoos.toggleFiltros()">
                    <div class="filter-bar-left">
                        <span class="filter-bar-icon">🎛️</span>
                        <span class="filter-bar-title">Filtros</span>
                        <span class="filter-active-badge ${filtrosAtivos > 0 ? 'visible' : ''}" id="filter-active-badge">${filtrosAtivos}</span>
                    </div>
                    <div class="filter-bar-right">
                        <span class="filter-results-count" id="filter-results-count">${voosFiltered.length} de ${combo.voos.length} voos</span>
                        <button class="btn-clear-all ${filtrosAtivos > 0 ? 'visible' : ''}" id="btn-clear-filters"
                                onclick="event.stopPropagation();BenetripCompararVoos.limparFiltros()">Limpar</button>
                        <span class="filter-toggle-icon ${this.state.filtrosPanelAberto ? 'open' : ''}" id="filter-toggle-icon">▼</span>
                    </div>
                </div>

                <!-- Painel de filtros expansível -->
                <div class="filter-panel ${this.state.filtrosPanelAberto ? 'open' : ''}" id="filter-panel">
                    ${this._renderFilterPanel(combo)}
                </div>

                <!-- Tags de filtros ativos -->
                <div class="active-filter-tags" id="active-filter-tags">
                    ${this._buildActiveFilterTags()}
                </div>

                <!-- Lista de voos -->
                <div class="flights-list" id="flights-list-container">
                    ${cardsHtml}
                </div>
            </div>
        `;
    },

    // ════════════════════════════════════════
    // FLIGHT CARD
    // ════════════════════════════════════════
    _renderFlightCard(voo, idx, simbolo, paxParaPreco, combo) {
        const { origemSelecionada: orig, destinoSelecionado: dest, moedaSelecionada: moeda, numBebes } = this.state;
        const isBest = idx === 0 && voo.is_best;

        const airlinesHtml = voo.airlines.map(a =>
            `<img src="${a.logo}" alt="${a.name}" class="airline-logo" onerror="this.style.display='none'">`
        ).join('');
        const airlinesNames = voo.airlines.map(a => a.name).join(', ');

        const durH = Math.floor(voo.total_duration / 60);
        const durM = voo.total_duration % 60;
        const durStr = durM > 0 ? `${durH}h${String(durM).padStart(2, '0')}` : `${durH}h`;
        const stopsStr = voo.stops === 0 ? 'Direto' : voo.stops === 1 ? '1 parada' : `${voo.stops} paradas`;
        const stopsClass = voo.stops === 0 ? 'tag-direct' : voo.stops >= 2 ? 'tag-warn' : '';

        const gfUrl = this.buildGoogleFlightsUrl(orig.code, dest.code, combo.dataIda, combo.dataVolta, moeda);
        const legsHtml = this._renderFlightLegs(voo);

        const precoTotal = voo.price;
        const precoPorPessoa = Math.round(precoTotal / paxParaPreco);

        const carbonHtml = voo.carbon_emissions ? `<span class="flight-tag"><span class="flight-tag-icon">🌱</span> ${voo.carbon_emissions} kg CO₂</span>` : '';
        const extHtml = voo.extensions.slice(0, 2).map(ext => `<span class="flight-tag"><span class="flight-tag-icon">📋</span> ${this.traduzirTexto(ext)}</span>`).join('');

        // Detalhamento por tipo de passageiro
        let paxDetailHtml = '';
        const { numAdultos, numCriancas } = this.state;
        if (numCriancas > 0 || numBebes > 0) {
            const parts = [];
            parts.push(`${numAdultos} adulto${numAdultos > 1 ? 's' : ''}`);
            if (numCriancas > 0) parts.push(`${numCriancas} criança${numCriancas > 1 ? 's' : ''}`);
            if (numBebes > 0) parts.push(`${numBebes} bebê (colo)`);
            paxDetailHtml = `<div class="flight-price-detail">${parts.join(' + ')}</div>`;
        }

        return `
            <div class="flight-card ${isBest ? 'best-flight' : ''}">
                <div class="flight-top">
                    <div class="flight-airlines">
                        ${airlinesHtml}
                        <span class="airline-names">${airlinesNames}</span>
                    </div>
                    <div class="flight-price-box">
                        <div class="flight-price">${simbolo} ${precoPorPessoa.toLocaleString('pt-BR')}</div>
                        <div class="flight-price-pp">por pessoa</div>
                        ${paxParaPreco > 1 ? `<div class="flight-price-detail">Total: <span class="price-pax">${simbolo} ${precoTotal.toLocaleString('pt-BR')}</span></div>` : ''}
                        ${paxDetailHtml}
                    </div>
                </div>
                <div class="flight-summary">
                    <span class="flight-tag ${stopsClass}"><span class="flight-tag-icon">${voo.stops === 0 ? '✅' : '🔄'}</span> ${stopsStr}</span>
                    <span class="flight-tag"><span class="flight-tag-icon">⏱️</span> ${durStr} total</span>
                    ${carbonHtml}
                    ${extHtml}
                </div>
                ${legsHtml}
                <div class="flight-action">
                    <a href="${gfUrl}" target="_blank" rel="noopener" class="btn-google-flights">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
                        Ver no Google Flights
                    </a>
                </div>
            </div>
        `;
    },

    // ════════════════════════════════════════
    // FLIGHT LEGS
    // ════════════════════════════════════════
    _renderFlightLegs(voo) {
        const legs = voo.legs || [];
        const layovers = voo.layovers || [];
        if (legs.length === 0) return '';

        const { outbound, returnLegs } = this._splitLegs(voo);
        const { origemSelecionada: orig, destinoSelecionado: dest } = this.state;
        const splitIdx = outbound.length - 1;
        const outLayovers = layovers.slice(0, Math.max(0, splitIdx));
        const retLayovers = layovers.slice(splitIdx);

        let html = '<div class="flight-legs-container">';

        html += '<div class="leg-column">';
        html += `<div class="leg-label">🛫 Ida · ${orig.code} → ${dest.code}</div>`;
        if (outbound.length > 0) {
            outbound.forEach((leg, i) => {
                html += this._renderLegRow(leg);
                if (i < outLayovers.length && outLayovers[i]) html += this._renderLayover(outLayovers[i]);
            });
        } else {
            html += '<div style="font-size:12px;color:var(--gray-medium)">Informações indisponíveis</div>';
        }
        html += '</div>';

        html += '<div class="leg-column">';
        html += `<div class="leg-label">🛬 Volta · ${dest.code} → ${orig.code}</div>`;
        if (returnLegs.length > 0) {
            returnLegs.forEach((leg, i) => {
                html += this._renderLegRow(leg);
                if (i < retLayovers.length && retLayovers[i]) html += this._renderLayover(retLayovers[i]);
            });
        } else {
            html += '<div style="font-size:12px;color:var(--gray-medium)">Informações indisponíveis</div>';
        }
        html += '</div>';

        html += '</div>';
        return html;
    },

    _renderLegRow(leg) {
        const depTime = leg.departure_airport.time ? (leg.departure_airport.time.split(' ').pop()?.substring(0, 5) || '') : '';
        const arrTime = leg.arrival_airport.time ? (leg.arrival_airport.time.split(' ').pop()?.substring(0, 5) || '') : '';
        const durH = Math.floor(leg.duration / 60);
        const durM = leg.duration % 60;
        const durStr = durM > 0 ? `${durH}h${String(durM).padStart(2, '0')}` : `${durH}h`;

        return `<div class="leg-row">
            <img src="${leg.airline_logo}" alt="${leg.airline}" class="leg-airline-logo" onerror="this.style.display='none'">
            <div class="leg-info">
                <div class="leg-times">${depTime} → ${arrTime}</div>
                <div class="leg-route">${leg.departure_airport.id} → ${leg.arrival_airport.id} · ${leg.airline} ${leg.flight_number}</div>
                <div class="leg-details">
                    <span class="leg-detail-chip">⏱️ ${durStr}</span>
                    ${leg.airplane ? `<span class="leg-detail-chip">✈️ ${leg.airplane}</span>` : ''}
                    ${leg.legroom ? `<span class="leg-detail-chip">🦵 ${leg.legroom}</span>` : ''}
                    ${leg.often_delayed_by_over_30_min ? '<span class="leg-detail-chip" style="color:var(--red)">⚠️ Atrasos frequentes</span>' : ''}
                </div>
            </div>
        </div>`;
    },

    _renderLayover(layover) {
        const durH = Math.floor(layover.duration / 60);
        const durM = layover.duration % 60;
        const durStr = durM > 0 ? `${durH}h${String(durM).padStart(2, '0')}` : `${durH}h`;
        return `<div class="leg-layover ${layover.overnight ? 'overnight' : ''}">
            ⏳ Conexão em ${layover.airport_id || layover.airport} · ${durStr}
            ${layover.overnight ? ' · 🌙 Pernoite' : ''}
        </div>`;
    },

    // ════════════════════════════════════════
    // SHARE
    // ════════════════════════════════════════
    _buildShareText() {
        const data = this.state.resultados;
        if (!data) return null;
        const { origemSelecionada: orig, destinoSelecionado: dest, moedaSelecionada: moeda, numAdultos, numCriancas, numBebes } = this.state;
        const s = this.getSimbolo(moeda);
        const paxParaPreco = data.paxParaPreco || (numAdultos + numCriancas);
        const stats = data.stats;
        const precoPorPessoa = Math.round(stats.cheapest / paxParaPreco);
        const gfUrl = this.buildGoogleFlightsUrl(orig.code, dest.code, stats.cheapestCombo.dataIda, stats.cheapestCombo.dataVolta, moeda);

        const paxParts = [`${numAdultos} adulto${numAdultos > 1 ? 's' : ''}`];
        if (numCriancas > 0) paxParts.push(`${numCriancas} criança${numCriancas > 1 ? 's' : ''}`);
        if (numBebes > 0) paxParts.push(`${numBebes} bebê`);

        let text = `✈️ *Comparação de voos pela Benetrip!*\n\n`;
        text += `📍 ${orig.name} (${orig.code}) → ${dest.name} (${dest.code})\n`;
        text += `👥 ${paxParts.join(' + ')}\n\n`;
        text += `🏆 *Melhor combinação:*\n`;
        text += `💰 *${s} ${precoPorPessoa.toLocaleString('pt-BR')}* por pessoa\n`;
        text += `📆 ${this.fmtDateFull(stats.cheapestCombo.dataIda)} → ${this.fmtDateFull(stats.cheapestCombo.dataVolta)}\n`;
        if (paxParaPreco > 1) text += `💰 Total: *${s} ${stats.cheapest.toLocaleString('pt-BR')}*${numBebes > 0 ? ` (+${numBebes} bebê grátis)` : ''}\n`;
        text += `\n🔗 ${gfUrl}\n\n🐕 benetrip.com.br`;
        return text;
    },

    shareWhatsApp() {
        const text = this._buildShareText();
        if (text) window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    },

    copyShareText() {
        const text = this._buildShareText();
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.querySelector('.btn-share-copy');
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '✅ Copiado!';
                btn.classList.add('copied');
                setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 2000);
            }
        }).catch(() => prompt('Copie o texto:', text));
    },

    // ════════════════════════════════════════
    // GOOGLE FLIGHTS URL
    // ════════════════════════════════════════
    _pV(n){const b=[];let v=n>>>0;while(v>127){b.push((v&0x7f)|0x80);v>>>=7;}b.push(v&0x7f);return b;},
    _pT(f,w){return this._pV((f<<3)|w);},
    _pVF(f,v){return[...this._pT(f,0),...this._pV(v)];},
    _pSF(f,s){const e=new TextEncoder().encode(s);return[...this._pT(f,2),...this._pV(e.length),...e];},
    _pMF(f,m){return[...this._pT(f,2),...this._pV(m.length),...m];},
    _b64u(b){return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');},
    _bAirport(c){return[...this._pVF(1,1),...this._pSF(2,c)];},
    _bLeg(d,o,de){return[...this._pSF(2,d),...this._pMF(13,this._bAirport(o)),...this._pMF(14,this._bAirport(de))];},

    buildGoogleFlightsUrl(o, d, dep, ret, cur) {
        const tfs = this._b64u([...this._pVF(1,28),...this._pVF(2,2),...this._pMF(3,this._bLeg(dep,o,d)),...this._pMF(3,this._bLeg(ret,d,o)),...this._pVF(14,1)]);
        const tfu = this._b64u(this._pMF(2,[...this._pVF(1,1),...this._pVF(2,0),...this._pVF(3,0)]));
        const p = new URLSearchParams();
        p.set('tfs', tfs); p.set('tfu', tfu);
        p.set('curr', { BRL:'BRL', USD:'USD', EUR:'EUR' }[cur] || 'BRL');
        p.set('hl', { BRL:'pt-BR', USD:'en', EUR:'en' }[cur] || 'pt-BR');
        p.set('gl', { BRL:'br', USD:'us', EUR:'de' }[cur] || 'br');
        return `https://www.google.com/travel/flights?${p.toString()}`;
    },

    // ════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════
    getSimbolo(m) { return { BRL:'R$', USD:'US$', EUR:'€' }[m] || 'R$'; },
    fmtISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
    fmtBR(d) { return d.toLocaleDateString('pt-BR'); },
    fmtDateShort(s) { return new Date(s+'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }); },
    fmtDateFull(s) { return new Date(s+'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' }); },
    fmtWeekday(s) { const wd=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']; return wd[new Date(s+'T12:00:00').getDay()]; },
    fmtDuracao(mins) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`;
    },
    delay(ms) { return new Promise(r => setTimeout(r, ms)); },

    showLoading() {
        document.getElementById('form-section').style.display = 'none';
        document.getElementById('hero-section').style.display = 'none';
        document.getElementById('loading-section').style.display = 'block';
        document.getElementById('results-section').style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    showForm() {
        document.getElementById('form-section').style.display = 'block';
        document.getElementById('hero-section').style.display = 'block';
        document.getElementById('loading-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    showResults() {
        document.getElementById('form-section').style.display = 'none';
        document.getElementById('hero-section').style.display = 'none';
        document.getElementById('loading-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    updateProgress(pct, msg) {
        const bar = document.getElementById('progress-bar');
        const msgEl = document.getElementById('loading-msg');
        if (bar) bar.style.width = `${pct}%`;
        if (msgEl) msgEl.textContent = msg;
    },
};

document.addEventListener('DOMContentLoaded', () => BenetripCompararVoos.init());
