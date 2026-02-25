/**
 * BENETRIP - COMPARAR VOOS v1.1
 * Compare voos para um destino específico em múltiplas datas
 * Nova Lógica: Multi-passageiros, UI Filtros, Correções de Render
 */

const BenetripCompararVoos = {
    state: {
        cidadesData: null,
        origemSelecionada: null,
        destinoSelecionado: null,
        moedaSelecionada: 'BRL',
        passageiros: { adultos: 1, criancas: 0, bebes: 0 },
        datasIda: [],
        datasVolta: [],
        fpIda: null,
        fpVolta: null,
        resultados: null,
        comboSelecionada: null,
        filtroAtivo: 'todos',
        filtrosAvancados: { ciaAerea: 'todas', aeroportoO: 'todos', aeroportoD: 'todos' }
    },

    config: {
        debug: true,
        cidadesJsonPath: 'data/cidades_global_iata_v6.json',
        maxDatasIda: 4,
        maxDatasVolta: 4,
    },

    log(...a) { if (this.config.debug) console.log('[CompararVoos]', ...a); },

    init() {
        this.log('🐕 Comparar Voos v1.1 inicializando...');
        this.carregarCidades();
        this.setupAutocomplete('origem', 'origem-results', 'origem-data', 'origemSelecionada');
        this.setupAutocomplete('destino', 'destino-results', 'destino-data', 'destinoSelecionado');
        this.setupCalendars();
        this.setupCurrencyChips();
        this.setupForm();
        this.log('✅ Pronto!');
    },

    async carregarCidades() {
        try {
            const r = await fetch(this.config.cidadesJsonPath);
            if (!r.ok) throw new Error('Erro');
            const d = await r.json();
            this.state.cidadesData = d.filter(c => c.iata);
        } catch (e) {
            this.state.cidadesData = [
                { cidade: "São Paulo", iata: "GRU", aeroporto: "Aeroporto de Guarulhos" },
                { cidade: "Rio de Janeiro", iata: "GIG", aeroporto: "Aeroporto do Galeão" },
                { cidade: "Lisboa", iata: "LIS", aeroporto: "Aeroporto de Lisboa" },
                { cidade: "Miami", iata: "MIA", aeroporto: "Miami International" }
            ];
        }
    },

    norm(t) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); },

    buscarCidades(termo) {
        if (!this.state.cidadesData || termo.length < 2) return [];
        const tn = this.norm(termo);
        return this.state.cidadesData.filter(c => {
            const n = this.norm(c.cidade);
            const i = c.iata.toLowerCase();
            const a = c.aeroporto ? this.norm(c.aeroporto) : '';
            return n.includes(tn) || i.includes(tn) || a.includes(tn);
        }).slice(0, 8).map(c => ({ code: c.iata, name: c.cidade, state: c.sigla_estado || null, country: c.pais, countryCode: c.codigo_pais, airport: c.aeroporto || null }));
    },

    setupAutocomplete(inputId, resultsId, hiddenId, stateKey) {
        const input = document.getElementById(inputId);
        const results = document.getElementById(resultsId);
        const hidden = document.getElementById(hiddenId);
        let timer;

        input.addEventListener('input', (e) => {
            clearTimeout(timer);
            const t = e.target.value.trim();
            if (t.length < 2) { results.style.display = 'none'; results.innerHTML = ''; this.state[stateKey] = null; hidden.value = ''; return; }
            timer = setTimeout(() => {
                const cidades = this.buscarCidades(t);
                if (!cidades.length) {
                    results.innerHTML = '<div style="padding:12px;color:#666;font-size:13px;">Nenhuma cidade encontrada</div>';
                    results.style.display = 'block'; return;
                }
                results.innerHTML = cidades.map(c => `
                    <div class="autocomplete-item" data-city='${JSON.stringify(c)}'>
                        <div class="item-code">${c.code}</div>
                        <div class="item-details"><div class="item-name">${c.name}${c.airport ? ' — ' + c.airport : ''}</div><div class="item-country">${c.country}</div></div>
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
            if (!input.contains(e.target) && !results.contains(e.target)) results.style.display = 'none';
        });
    },

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
            return `<span class="date-chip">${tipo === 'ida' ? '🛫' : '🛬'} ${br} <span class="remove-chip" onclick="BenetripCompararVoos.removeDate('${tipo}',${i})">✕</span></span>`;
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
        for (const ida of this.state.datasIda) for (const volta of this.state.datasVolta) if (volta > ida) c.push({ dataIda: ida, dataVolta: volta });
        return c;
    },

    updateComboCount() {
        const info = document.getElementById('combo-info');
        const text = document.getElementById('combo-text');
        const combos = this.getValidCombos();
        if (this.state.datasIda.length > 0 && this.state.datasVolta.length > 0) {
            info.style.display = 'flex';
            text.textContent = combos.length === 1 ? '1 combinação será pesquisada' : `${combos.length} combinações serão pesquisadas`;
        } else { info.style.display = 'none'; }
    },

    togglePassengers() {
        document.getElementById('passenger-popover').classList.toggle('active');
    },

    ajustarPassageiros(tipo, delta) {
        let n = this.state.passageiros[tipo] + delta;
        if (tipo === 'adultos' && n < 1) n = 1;
        if (n < 0) n = 0;
        if (tipo === 'bebes' && n > this.state.passageiros.adultos) return; 
        if (n > 9) n = 9;

        this.state.passageiros[tipo] = n;
        document.getElementById(`num-${tipo}`).textContent = n;

        const { adultos, criancas, bebes } = this.state.passageiros;
        const total = adultos + criancas + bebes;
        document.getElementById('passengers-display').textContent = `${total} Passageiro${total > 1 ? 's' : ''}`;
    },

    setupCurrencyChips() {
        document.querySelectorAll('.currency-chip[data-currency]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.currency-chip[data-currency]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.moedaSelecionada = chip.dataset.currency;
            });
        });
    },

    setupForm() {
        document.getElementById('search-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (this.validar()) await this.buscar();
        });
    },

    validar() {
        if (!this.state.origemSelecionada || !this.state.destinoSelecionado) { alert('Selecione origem e destino'); return false; }
        if (this.state.origemSelecionada.code === this.state.destinoSelecionado.code) { alert('Origem e destino devem ser diferentes'); return false; }
        if (!this.state.datasIda.length || !this.state.datasVolta.length) { alert('Selecione datas de ida e volta'); return false; }
        if (!this.getValidCombos().length) { alert('Datas de volta devem ser posteriores às de ida'); return false; }
        return true;
    },

    async buscar() {
        const { origemSelecionada, destinoSelecionado, datasIda, datasVolta, moedaSelecionada, passageiros } = this.state;
        const combos = this.getValidCombos();
        const totPax = passageiros.adultos + passageiros.criancas + passageiros.bebes;

        this.showLoading();
        this.updateProgress(10, `🔍 Preparando ${combos.length} combinações...`);

        try {
            this.updateProgress(25, `✈️ Pesquisando ${origemSelecionada.code} → ${destinoSelecionado.code}...`);
            document.getElementById('loading-sub').textContent = `${combos.length} combinações · ${totPax} passageiro${totPax > 1 ? 's' : ''}`;

            const response = await fetch('/api/compare-flights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origem: origemSelecionada.code,
                    destino: destinoSelecionado.code,
                    datasIda,
                    datasVolta,
                    moeda: moedaSelecionada,
                    passageiros: passageiros,
                }),
            });

            this.updateProgress(75, '📊 Analisando resultados...');
            if (!response.ok) { const err = await response.json(); throw new Error(err.message || 'Erro na busca'); }

            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Nenhum voo encontrado');

            this.state.resultados = data;
            this.updateProgress(100, '🎉 Pronto!');
            await this.delay(400);

            if (data.stats.cheapestCombo) {
                this.state.comboSelecionada = data.stats.cheapestCombo;
            } else {
                const first = data.combinacoes.find(c => c.voos.length > 0);
                if (first) this.state.comboSelecionada = { dataIda: first.dataIda, dataVolta: first.dataVolta };
            }

            this.state.filtroAtivo = 'todos';
            this.state.filtrosAvancados = { ciaAerea: 'todas', aeroportoO: 'todos', aeroportoD: 'todos' };
            this.renderResults(data);

        } catch (err) {
            alert(`Ops! ${err.message}`);
            this.showForm();
        }
    },

    renderResults(data) {
        const container = document.getElementById('results-content');
        const { origemSelecionada: orig, destinoSelecionado: dest, moedaSelecionada: moeda, passageiros } = this.state;
        const s = this.getSimbolo(moeda);
        const stats = data.stats;
        
        const paxPagantes = Math.max(1, passageiros.adultos + passageiros.criancas);
        const precPorPax = Math.round(stats.cheapest / paxPagantes);

        const winnerCombo = data.combinacoes.find(c => c.dataIda === stats.cheapestCombo.dataIda && c.dataVolta === stats.cheapestCombo.dataVolta);
        const winnerNoites = winnerCombo?.noites || '—';

        container.innerHTML = `
            <button class="btn-back" onclick="BenetripCompararVoos.showForm()">← Nova busca</button>
            <div class="trip-summary fade-in">
                <div class="trip-route">
                    <div class="trip-city"><span class="trip-code">${orig.code}</span><span class="trip-name">${orig.name}</span></div>
                    <div class="trip-arrow">→</div>
                    <div class="trip-city"><span class="trip-code">${dest.code}</span><span class="trip-name">${dest.name}</span></div>
                </div>
                <div class="trip-meta">
                    <span class="meta-chip">👥 ${passageiros.adultos+passageiros.criancas+passageiros.bebes} pax</span>
                    <span class="meta-chip">💱 ${moeda}</span>
                    <span class="meta-chip">✅ ${stats.combinacoesComVoo} opções</span>
                </div>
            </div>

            <div class="winner-card fade-in" style="animation-delay:.05s">
                <div class="winner-badge">🏆 MELHOR COMBINAÇÃO</div>
                <div class="winner-row">
                    <div>
                        <div class="winner-price">${s} ${precPorPax.toLocaleString('pt-BR')}</div>
                        <div class="winner-price-label">por pessoa (+2 anos)</div>
                        <div class="winner-price-label" style="opacity:1;font-weight:600">Total todos os pax: ${s} ${stats.cheapest.toLocaleString('pt-BR')}</div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <div class="winner-dates-box"><div class="winner-date-lbl">Ida</div><div class="winner-date-val">${this.fmtDateShort(stats.cheapestCombo.dataIda)}</div></div>
                        <div class="winner-dates-box"><div class="winner-date-lbl">Volta</div><div class="winner-date-val">${this.fmtDateShort(stats.cheapestCombo.dataVolta)}</div></div>
                    </div>
                </div>
                <a href="${this.buildGoogleFlightsUrl(orig.code, dest.code, stats.cheapestCombo.dataIda, stats.cheapestCombo.dataVolta, moeda)}" target="_blank" class="winner-cta">✈️ Ver no Google Flights</a>
            </div>

            <div class="matrix-section fade-in" style="animation-delay:.2s">
                <h3 class="matrix-title">📊 Matriz de Preços (Total)</h3>
                ${this._renderMatrix(data, s)}
            </div>

            <div id="combo-detail" class="fade-in" style="animation-delay:.25s">${this._renderComboDetail(data)}</div>
        `;
        this.showResults();
    },

    _renderMatrix(data, simbolo) {
        const { datasIda, datasVolta, matrizPrecos, stats } = data;
        const sel = this.state.comboSelecionada;

        let html = '<table class="price-matrix"><thead><tr><th class="corner-cell"><span class="corner-labels"><span class="corner-ida">IDA →</span><span class="corner-volta">↓ VOLTA</span></span></th>';
        datasIda.forEach(d => html += `<th class="col-header">🛫 ${this.fmtDateShort(d)}</th>`);
        html += '</tr></thead><tbody>';

        datasVolta.forEach(volta => {
            html += `<tr><th class="row-header">🛬 ${this.fmtDateShort(volta)}</th>`;
            datasIda.forEach(ida => {
                const cell = matrizPrecos[`${ida}_${volta}`];
                if (!cell || cell.error || cell.melhorPreco === null) {
                    html += `<td class="matrix-cell no-data">${volta <= ida ? '—' : '✗'}</td>`; return;
                }
                const isCheapest = cell.melhorPreco === stats.cheapest;
                const isSelected = sel && sel.dataIda === ida && sel.dataVolta === volta;
                let cls = isCheapest ? 'cheapest' : 'mid';

                html += `<td class="matrix-cell ${cls} ${isSelected ? 'selected' : ''}" onclick="BenetripCompararVoos.selectCombo('${ida}','${volta}')">
                    ${simbolo} ${cell.melhorPreco.toLocaleString('pt-BR')}<span class="matrix-noites">${cell.totalVoos} voos</span>
                </td>`;
            });
            html += '</tr>';
        });
        return html + '</tbody></table>';
    },

    selectCombo(ida, volta) {
        this.state.comboSelecionada = { dataIda: ida, dataVolta: volta };
        this.state.filtroAtivo = 'todos';
        document.querySelectorAll('.matrix-cell').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.matrix-cell').forEach(c => {
            if (c.getAttribute('onclick')?.includes(`'${ida}'`) && c.getAttribute('onclick')?.includes(`'${volta}'`)) c.classList.add('selected');
        });
        document.getElementById('combo-detail').innerHTML = this._renderComboDetail(this.state.resultados);
        document.getElementById('combo-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    setFilter(filtro) {
        this.state.filtroAtivo = filtro;
        document.getElementById('combo-detail').innerHTML = this._renderComboDetail(this.state.resultados);
    },

    _renderComboDetail(data) {
        const sel = this.state.comboSelecionada;
        if (!sel) return '';
        const combo = data.combinacoes.find(c => c.dataIda === sel.dataIda && c.dataVolta === sel.dataVolta);
        if (!combo || !combo.voos.length) return `<div class="combo-detail-section"><div class="no-flights-msg">😕 Nenhum voo disponível para esta combinação.</div></div>`;

        const { moedaSelecionada: moeda, passageiros: pax } = this.state;
        const s = this.getSimbolo(moeda);
        let voos = [...combo.voos];

        // Lógica de Filtros Interativos
        if (this.state.filtroAtivo === 'direto') voos = voos.filter(v => v.stops === 0);
        else if (this.state.filtroAtivo === 'rapido') voos = voos.sort((a, b) => a.total_duration - b.total_duration);
        else if (this.state.filtroAtivo === 'barato') voos = voos.sort((a, b) => a.price - b.price);

        if (this.state.filtrosAvancados.ciaAerea !== 'todas') {
            voos = voos.filter(v => v.airlines.some(a => a.name === this.state.filtrosAvancados.ciaAerea));
        }

        const totalDiretos = combo.voos.filter(v => v.stops === 0).length;
        const airlines = Array.from(new Set(combo.voos.flatMap(v => v.airlines.map(a => a.name))));

        let insightsHtml = '';
        if (combo.priceInsights && Array.isArray(combo.priceInsights.typical_price_range) && combo.priceInsights.typical_price_range[0] !== undefined) {
            insightsHtml = ` · Faixa típica: ${s} ${combo.priceInsights.typical_price_range[0].toLocaleString('pt-BR')} – ${s} ${combo.priceInsights.typical_price_range[1].toLocaleString('pt-BR')}`;
        }

        const filterHtml = `
            <div class="filters-inline">
                <button class="filter-chip ${this.state.filtroAtivo === 'todos' ? 'active' : ''}" onclick="BenetripCompararVoos.setFilter('todos')">Todos</button>
                <button class="filter-chip ${this.state.filtroAtivo === 'barato' ? 'active' : ''}" onclick="BenetripCompararVoos.setFilter('barato')">💰 Mais barato</button>
                <button class="filter-chip ${this.state.filtroAtivo === 'rapido' ? 'active' : ''}" onclick="BenetripCompararVoos.setFilter('rapido')">⚡ Mais rápido</button>
                ${totalDiretos > 0 ? `<button class="filter-chip ${this.state.filtroAtivo === 'direto' ? 'active' : ''}" onclick="BenetripCompararVoos.setFilter('direto')">✅ Direto</button>` : ''}
            </div>
            <div class="advanced-filters-panel" style="background:#F5F7FA; padding:12px; border-radius:8px; margin-bottom:16px;">
                <label style="font-size:12px; font-weight:700;">Refinar por Companhia Aérea:</label>
                <select onchange="BenetripCompararVoos.state.filtrosAvancados.ciaAerea = this.value; BenetripCompararVoos.setFilter(BenetripCompararVoos.state.filtroAtivo)" style="padding:6px; border-radius:4px; border:1px solid #ccc; width:100%; max-width:250px;">
                    <option value="todas">Todas</option>
                    ${airlines.map(a => `<option value="${a}" ${this.state.filtrosAvancados.ciaAerea === a ? 'selected' : ''}>${a}</option>`).join('')}
                </select>
            </div>
        `;

        const cardsHtml = voos.length > 0
            ? voos.slice(0, 20).map((v, idx) => this._renderFlightCard(v, idx, s, pax, sel)).join('')
            : '<div class="no-flights-msg">Nenhum voo atende a este filtro.</div>';

        return `
            <div class="combo-detail-section">
                <div class="combo-detail-header">
                    <div>
                        <h3>📅 ${this.fmtDateFull(sel.dataIda)} → ${this.fmtDateFull(sel.dataVolta)}</h3>
                        <div class="combo-detail-sub">${combo.noites} noites · ${combo.voos.length} opções${insightsHtml}</div>
                    </div>
                </div>
                ${filterHtml}
                <div class="flights-list">${cardsHtml}</div>
            </div>
        `;
    },

    traduzirExtensao(texto) {
        const dicionario = {
            "Free change": "Alteração gratuita",
            "possible fare difference": "sujeita a diferença de tarifa",
            "Full refund for cancellations": "Reembolso total para cancelamentos",
            "Checked baggage not included in price": "Bagagem despachada não incluída",
            "Bag and fare conditions depend on the return flight": "Condições de bagagem dependem do voo de volta",
            "Often delayed by over 30 min": "Atrasos superiores a 30min frequentes"
        };
        let t = texto;
        for (const [eng, ptbr] of Object.entries(dicionario)) t = t.replace(new RegExp(eng, 'gi'), ptbr);
        return t;
    },

    _renderFlightCard(voo, idx, simbolo, pax, combo) {
        const { origemSelecionada: orig, destinoSelecionado: dest, moedaSelecionada: moeda } = this.state;
        const airlinesHtml = voo.airlines.map(a => `<img src="${a.logo}" alt="${a.name}" class="airline-logo" onerror="this.style.display='none'">`).join('');
        const airlinesNames = voo.airlines.map(a => a.name).join(', ');
        
        const durH = Math.floor(voo.total_duration / 60); const durM = voo.total_duration % 60;
        const durStr = durM > 0 ? `${durH}h${String(durM).padStart(2, '0')}` : `${durH}h`;
        const stopsStr = voo.stops === 0 ? 'Direto' : voo.stops === 1 ? '1 parada' : `${voo.stops} paradas`;
        const gfUrl = this.buildGoogleFlightsUrl(orig.code, dest.code, combo.dataIda, combo.dataVolta, moeda);

        const extHtml = voo.extensions.map(ext => `<span class="flight-tag"><span class="flight-tag-icon">📋</span> ${this.traduzirExtensao(ext)}</span>`).join('');

        const totalPagantes = Math.max(1, pax.adultos + pax.criancas);
        const precoPorPessoa = Math.round(voo.price / totalPagantes);

        return `
            <div class="flight-card ${idx === 0 && voo.is_best ? 'best-flight' : ''}">
                <div class="flight-top">
                    <div class="flight-airlines">${airlinesHtml} <span class="airline-names">${airlinesNames}</span></div>
                    <div class="flight-price-box" style="text-align: right;">
                        <div class="flight-price">${simbolo} ${precoPorPessoa.toLocaleString('pt-BR')}</div>
                        <div class="flight-price-pp">por pessoa (+2 anos)</div>
                        <div class="flight-price-total" style="font-size:12px; font-weight:600; color:var(--blue);">Total todos: ${simbolo} ${voo.price.toLocaleString('pt-BR')}</div>
                    </div>
                </div>
                <div class="flight-summary">
                    <span class="flight-tag ${voo.stops === 0 ? 'tag-direct' : ''}"><span class="flight-tag-icon">${voo.stops===0?'✅':'🔄'}</span> ${stopsStr}</span>
                    <span class="flight-tag"><span class="flight-tag-icon">⏱️</span> ${durStr} total</span>
                    ${extHtml}
                </div>
                ${this._renderFlightLegs(voo)}
                <div class="flight-action"><a href="${gfUrl}" target="_blank" class="btn-google-flights">✈️ Ver no Google Flights</a></div>
            </div>
        `;
    },

    _renderFlightLegs(voo) {
        if (!voo.legs || voo.legs.length === 0) return '';
        let html = '<div class="flight-legs" style="margin-top:12px; border-top:1px dashed #E0E4E8; padding-top:12px;">';
        voo.legs.forEach((leg, i) => {
            const arrTime = leg.arrival_airport.time ? leg.arrival_airport.time.split(' ').pop().substring(0, 5) : '';
            const depTime = leg.departure_airport.time ? leg.departure_airport.time.split(' ').pop().substring(0, 5) : '';
            html += `<div class="leg-row" style="font-size:13px; color:#666; margin-bottom:4px;">
                        🛫 <strong>${leg.departure_airport.id}</strong> ${depTime} → 🛬 <strong>${leg.arrival_airport.id}</strong> ${arrTime} 
                        (${leg.airline} ${leg.flight_number})
                     </div>`;
        });
        return html + '</div>';
    },

    buildGoogleFlightsUrl(o,d,dep,ret,cur) { return `https://www.google.com/travel/flights`; }, // URL builder simplificado para fallback.

    getSimbolo(m){ return {BRL:'R$',USD:'US$',EUR:'€'}[m]||'R$'; },
    fmtISO(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
    fmtBR(d){ return d.toLocaleDateString('pt-BR'); },
    fmtDateShort(s){ return new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}); },
    fmtDateFull(s){ return new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}); },
    delay(ms){ return new Promise(r=>setTimeout(r,ms)); },

    showLoading(){ document.getElementById('form-section').style.display='none'; document.getElementById('loading-section').style.display='block'; document.getElementById('results-section').style.display='none'; },
    showForm(){ document.getElementById('form-section').style.display='block'; document.getElementById('loading-section').style.display='none'; document.getElementById('results-section').style.display='none'; },
    showResults(){ document.getElementById('form-section').style.display='none'; document.getElementById('loading-section').style.display='none'; document.getElementById('results-section').style.display='block'; },
    updateProgress(pct,msg){ const bar=document.getElementById('progress-bar'); const msgEl=document.getElementById('loading-msg'); if(bar) bar.style.width=`${pct}%`; if(msgEl) msgEl.textContent=msg; }
};

document.addEventListener('DOMContentLoaded',()=>BenetripCompararVoos.init());
