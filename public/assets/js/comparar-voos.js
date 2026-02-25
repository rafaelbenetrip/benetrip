/**
 * BENETRIP - COMPARAR VOOS v1.0
 * Compare voos para um destino específico em múltiplas datas
 * Até 4 idas × 4 voltas = 16 combinações 
 * Exibe: Matriz de preços, detalhes de voo, filtros
 */

const BenetripCompararVoos = {
    state: {
        cidadesData: null,
        origemSelecionada: null,
        destinoSelecionado: null,
        moedaSelecionada: 'BRL',
        numPassageiros: 1,
        datasIda: [],
        datasVolta: [],
        fpIda: null,
        fpVolta: null,
        resultados: null,
        comboSelecionada: null, // { dataIda, dataVolta }
        filtroAtivo: 'todos',  // todos, direto, rapido
    },

    config: {
        debug: true,
        cidadesJsonPath: 'data/cidades_global_iata_v6.json',
        maxDatasIda: 4,
        maxDatasVolta: 4,
    },

    log(...a) { if (this.config.debug) console.log('[CompararVoos]', ...a); },

    // ================================================================
    // INICIALIZAÇÃO
    // ================================================================
    init() {
        this.log('🐕 Comparar Voos v1.0 inicializando...');
        this.carregarCidades();
        this.setupAutocomplete('origem', 'origem-results', 'origem-data', 'origemSelecionada');
        this.setupAutocomplete('destino', 'destino-results', 'destino-data', 'destinoSelecionado');
        this.setupCalendars();
        this.setupCurrencyChips();
        this.setupForm();
        this.log('✅ Pronto!');
    },

    // ================================================================
    // CIDADES
    // ================================================================
    async carregarCidades() {
        try {
            const r = await fetch(this.config.cidadesJsonPath);
            if (!r.ok) throw new Error('Erro');
            const d = await r.json();
            this.state.cidadesData = d.filter(c => c.iata);
            this.log(`✅ ${this.state.cidadesData.length} cidades`);
        } catch (e) {
            this.state.cidadesData = [
                { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", codigo_pais: "BR", iata: "GRU", aeroporto: "Aeroporto de Guarulhos" },
                { cidade: "Rio de Janeiro", sigla_estado: "RJ", pais: "Brasil", codigo_pais: "BR", iata: "GIG", aeroporto: "Aeroporto do Galeão" },
                { cidade: "Lisboa", pais: "Portugal", codigo_pais: "PT", iata: "LIS", aeroporto: "Aeroporto de Lisboa" },
                { cidade: "Miami", pais: "Estados Unidos", codigo_pais: "US", iata: "MIA", aeroporto: "Miami International" },
                { cidade: "Buenos Aires", pais: "Argentina", codigo_pais: "AR", iata: "EZE", aeroporto: "Ezeiza" },
                { cidade: "Paris", pais: "França", codigo_pais: "FR", iata: "CDG", aeroporto: "Charles de Gaulle" },
                { cidade: "Orlando", pais: "Estados Unidos", codigo_pais: "US", iata: "MCO", aeroporto: "Orlando International" },
                { cidade: "Salvador", sigla_estado: "BA", pais: "Brasil", codigo_pais: "BR", iata: "SSA" },
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

    // ================================================================
    // AUTOCOMPLETE
    // ================================================================
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
            if (!input.contains(e.target) && !results.contains(e.target)) results.style.display = 'none';
        });
    },

    // ================================================================
    // CALENDÁRIOS
    // ================================================================
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
        const inputId = tipo === 'ida' ? 'datas-ida' : 'datas-volta';
        document.getElementById(inputId).value = dates.length > 0 ? dates.map(d => this.fmtBR(d)).join(', ') : '';
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

    // ================================================================
    // PASSAGEIROS
    // ================================================================
    ajustarPassageiros(delta) {
        const n = Math.min(Math.max(this.state.numPassageiros + delta, 1), 9);
        this.state.numPassageiros = n;
        document.getElementById('num-passageiros').textContent = n;
        document.getElementById('btn-menos').disabled = n <= 1;
        document.getElementById('btn-mais').disabled = n >= 9;
    },

    // ================================================================
    // MOEDA
    // ================================================================
    setupCurrencyChips() {
        document.querySelectorAll('.currency-chip[data-currency]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.currency-chip[data-currency]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.moedaSelecionada = chip.dataset.currency;
            });
        });
    },

    // ================================================================
    // FORM
    // ================================================================
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

    // ================================================================
    // BUSCAR
    // ================================================================
    async buscar() {
        const { origemSelecionada, destinoSelecionado, datasIda, datasVolta, moedaSelecionada, numPassageiros } = this.state;
        const combos = this.getValidCombos();

        this.showLoading();
        this.updateProgress(10, `🔍 Preparando ${combos.length} combinações...`);

        try {
            this.updateProgress(25, `✈️ Pesquisando ${origemSelecionada.code} → ${destinoSelecionado.code}...`);
            document.getElementById('loading-sub').textContent = `${combos.length} combinações · ${numPassageiros} passageiro${numPassageiros > 1 ? 's' : ''}`;

            const response = await fetch('/api/compare-flights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origem: origemSelecionada.code,
                    destino: destinoSelecionado.code,
                    datasIda,
                    datasVolta,
                    moeda: moedaSelecionada,
                    adultos: numPassageiros,
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

            // Auto-select cheapest combo
            if (data.stats.cheapestCombo) {
                this.state.comboSelecionada = data.stats.cheapestCombo;
            } else {
                const first = data.combinacoes.find(c => c.voos.length > 0);
                if (first) this.state.comboSelecionada = { dataIda: first.dataIda, dataVolta: first.dataVolta };
            }

            this.state.filtroAtivo = 'todos';
            this.renderResults(data);

        } catch (err) {
            this.log('❌ Erro:', err.message);
            alert(`Ops! ${err.message}`);
            this.showForm();
        }
    },

    // ================================================================
    // RENDER RESULTADOS
    // ================================================================
    renderResults(data) {
        const container = document.getElementById('results-content');
        const { origemSelecionada: orig, destinoSelecionado: dest, moedaSelecionada: moeda, numPassageiros: pax } = this.state;
        const s = this.getSimbolo(moeda);
        const stats = data.stats;

        // Winner
        const winnerCombo = data.combinacoes.find(c => c.dataIda === stats.cheapestCombo.dataIda && c.dataVolta === stats.cheapestCombo.dataVolta);
        const winnerNoites = winnerCombo?.noites || '—';

        // Saving
        const saving = stats.mostExpensive - stats.cheapest;
        const savingPct = stats.mostExpensive > 0 ? Math.round((saving / stats.mostExpensive) * 100) : 0;
        const tipText = savingPct > 20
            ? `<strong>Boa escolha ser flexível!</strong> A diferença entre a combo mais barata e a mais cara é de <strong>${s} ${saving.toLocaleString('pt-BR')}</strong> (${savingPct}%)! 🐾`
            : savingPct > 5
            ? `A diferença entre as combinações é de <strong>${s} ${saving.toLocaleString('pt-BR')}</strong>. Cada real conta! 🐾`
            : `Os preços estão bem parecidos entre as combinações. Escolha a data mais conveniente! 🎉`;

        container.innerHTML = `
            <button class="btn-back" onclick="BenetripCompararVoos.showForm()">← Nova busca</button>

            <!-- ROUTE SUMMARY -->
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
                    <span class="meta-chip">👥 ${pax} passageiro${pax > 1 ? 's' : ''}</span>
                    <span class="meta-chip">💱 ${moeda}</span>
                    <span class="meta-chip">🔀 ${stats.totalCombinacoes} combinações</span>
                    <span class="meta-chip">✅ ${stats.combinacoesComVoo} com voos</span>
                </div>
            </div>

            <!-- WINNER -->
            <div class="winner-card fade-in" style="animation-delay:.05s">
                <div class="winner-badge">🏆 MELHOR COMBINAÇÃO</div>
                <div class="winner-row">
                    <div>
                        <div class="winner-price">${s} ${stats.cheapest.toLocaleString('pt-BR')}</div>
                        <div class="winner-price-label">por pessoa · ida e volta</div>
                        ${pax > 1 ? `<div class="winner-price-label" style="opacity:1;font-weight:600">Total ${pax}p: ${s} ${(stats.cheapest * pax).toLocaleString('pt-BR')}</div>` : ''}
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

            <!-- STATS -->
            <div class="stats-row fade-in" style="animation-delay:.1s">
                <div class="stat-card"><div class="stat-label">Mais barato</div><div class="stat-value green">${s} ${stats.cheapest.toLocaleString('pt-BR')}</div></div>
                <div class="stat-card"><div class="stat-label">Média</div><div class="stat-value blue">${s} ${stats.average.toLocaleString('pt-BR')}</div></div>
                <div class="stat-card"><div class="stat-label">Mais caro</div><div class="stat-value orange">${s} ${stats.mostExpensive.toLocaleString('pt-BR')}</div></div>
            </div>

            <!-- TIP -->
            <div class="tripinha-tip fade-in" style="animation-delay:.15s">
                <img src="assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="tripinha-tip-avatar" onerror="this.style.display='none'">
                <div class="tripinha-tip-text">${tipText}</div>
            </div>

            <!-- PRICE MATRIX -->
            <div class="matrix-section fade-in" style="animation-delay:.2s">
                <h3 class="matrix-title">📊 Matriz de Preços</h3>
                <p class="matrix-subtitle">Clique em uma combinação para ver os voos detalhados</p>
                ${this._renderMatrix(data, s)}
            </div>

            <!-- COMBO DETAIL -->
            <div id="combo-detail" class="fade-in" style="animation-delay:.25s">
                ${this._renderComboDetail(data)}
            </div>

            <!-- SHARE -->
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

    // ================================================================
    // PRICE MATRIX
    // ================================================================
    _renderMatrix(data, simbolo) {
        const { datasIda, datasVolta, matrizPrecos, stats } = data;
        const sel = this.state.comboSelecionada;

        let html = '<table class="price-matrix"><thead><tr>';
        html += '<th class="corner-cell"><span class="corner-labels"><span class="corner-ida">IDA →</span><span class="corner-volta">↓ VOLTA</span></span></th>';

        // Column headers (idas)
        datasIda.forEach(d => {
            const dShort = this.fmtDateShort(d);
            const weekday = this.fmtWeekday(d);
            html += `<th class="col-header">🛫 ${dShort}<br><small>${weekday}</small></th>`;
        });
        html += '</tr></thead><tbody>';

        // Rows (voltas)
        datasVolta.forEach(volta => {
            const vShort = this.fmtDateShort(volta);
            const vWeekday = this.fmtWeekday(volta);
            html += `<tr><th class="row-header">🛬 ${vShort}<br><small>${vWeekday}</small></th>`;

            datasIda.forEach(ida => {
                const key = `${ida}_${volta}`;
                const cell = matrizPrecos[key];

                if (!cell || cell.error || cell.melhorPreco === null) {
                    if (volta <= ida) {
                        html += '<td class="matrix-cell no-data">—</td>';
                    } else {
                        html += '<td class="matrix-cell no-data">✗</td>';
                    }
                    return;
                }

                const price = cell.melhorPreco;
                const noites = cell.noites;
                const isCheapest = price === stats.cheapest;
                const isExpensive = price === stats.mostExpensive && stats.totalCombinacoes > 1;
                const isSelected = sel && sel.dataIda === ida && sel.dataVolta === volta;

                let cls = 'mid';
                if (isCheapest) cls = 'cheapest';
                else if (isExpensive) cls = 'expensive';

                html += `<td class="matrix-cell ${cls} ${isSelected ? 'selected' : ''}"
                             onclick="BenetripCompararVoos.selectCombo('${ida}','${volta}')">
                    ${simbolo} ${price.toLocaleString('pt-BR')}
                    <span class="matrix-noites">${noites}n · ${cell.totalVoos} voos</span>
                </td>`;
            });

            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    },

    // ================================================================
    // SELECT COMBO (click on matrix cell)
    // ================================================================
    selectCombo(ida, volta) {
        this.state.comboSelecionada = { dataIda: ida, dataVolta: volta };
        this.state.filtroAtivo = 'todos';

        // Update matrix selection visual
        document.querySelectorAll('.matrix-cell').forEach(c => c.classList.remove('selected'));
        const cells = document.querySelectorAll('.matrix-cell');
        cells.forEach(c => {
            const onclick = c.getAttribute('onclick') || '';
            if (onclick.includes(`'${ida}'`) && onclick.includes(`'${volta}'`)) {
                c.classList.add('selected');
            }
        });

        // Re-render combo detail
        const detailEl = document.getElementById('combo-detail');
        if (detailEl) {
            detailEl.innerHTML = this._renderComboDetail(this.state.resultados);
            detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },

    // ================================================================
    // SET FILTER
    // ================================================================
    setFilter(filtro) {
        this.state.filtroAtivo = filtro;
        const detailEl = document.getElementById('combo-detail');
        if (detailEl) detailEl.innerHTML = this._renderComboDetail(this.state.resultados);
    },

    // ================================================================
    // COMBO DETAIL (list of flights)
    // ================================================================
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

        const { moedaSelecionada: moeda, numPassageiros: pax } = this.state;
        const s = this.getSimbolo(moeda);
        const f = this.state.filtroAtivo;

        // Apply filters
        let voos = [...combo.voos];
        if (f === 'direto') voos = voos.filter(v => v.stops === 0);
        else if (f === 'rapido') voos = voos.sort((a, b) => a.total_duration - b.total_duration);
        else if (f === 'barato') voos = voos.sort((a, b) => a.price - b.price);

        // Count types for filter badges
        const totalDiretos = combo.voos.filter(v => v.stops === 0).length;

        // Unique airlines
        const airlines = new Set();
        combo.voos.forEach(v => v.airlines.forEach(a => airlines.add(a.name)));

        const filterHtml = `
            <div class="filters-inline">
                <button class="filter-chip ${f === 'todos' ? 'active' : ''}" onclick="BenetripCompararVoos.setFilter('todos')">Todos (${combo.voos.length})</button>
                <button class="filter-chip ${f === 'barato' ? 'active' : ''}" onclick="BenetripCompararVoos.setFilter('barato')">💰 Mais barato</button>
                <button class="filter-chip ${f === 'rapido' ? 'active' : ''}" onclick="BenetripCompararVoos.setFilter('rapido')">⚡ Mais rápido</button>
                ${totalDiretos > 0 ? `<button class="filter-chip ${f === 'direto' ? 'active' : ''}" onclick="BenetripCompararVoos.setFilter('direto')">✅ Direto (${totalDiretos})</button>` : ''}
            </div>
        `;

        const cardsHtml = voos.length > 0
            ? voos.slice(0, 20).map((v, idx) => this._renderFlightCard(v, idx, s, pax, sel)).join('')
            : '<div class="no-flights-msg">Nenhum voo com esse filtro.</div>';

        // Price insights
        let insightsHtml = '';
        if (combo.priceInsights) {
            const pi = combo.priceInsights;
            if (pi.typical_price_range) {
                insightsHtml = ` · Faixa típica: ${s} ${pi.typical_price_range[0]?.toLocaleString('pt-BR')} – ${s} ${pi.typical_price_range[1]?.toLocaleString('pt-BR')}`;
            }
        }

        return `
            <div class="combo-detail-section">
                <div class="combo-detail-header">
                    <div>
                        <h3>📅 ${this.fmtDateFull(sel.dataIda)} → ${this.fmtDateFull(sel.dataVolta)}</h3>
                        <div class="combo-detail-sub">${combo.noites} noites · ${combo.voos.length} opções de voo${insightsHtml}</div>
                    </div>
                </div>
                ${filterHtml}
                <div class="flights-list">${cardsHtml}</div>
            </div>
        `;
    },

    // ================================================================
    // FLIGHT CARD
    // ================================================================
    _renderFlightCard(voo, idx, simbolo, pax, combo) {
        const { origemSelecionada: orig, destinoSelecionado: dest, moedaSelecionada: moeda } = this.state;
        const isBest = idx === 0 && voo.is_best;

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

        // Legs detail
        const legsHtml = this._renderFlightLegs(voo);

        // Carbon
        const carbonHtml = voo.carbon_emissions ? `<span class="flight-tag"><span class="flight-tag-icon">🌱</span> ${voo.carbon_emissions} kg CO₂</span>` : '';

        // Extensions (baggage, etc)
        const extHtml = voo.extensions.map(ext => `<span class="flight-tag"><span class="flight-tag-icon">📋</span> ${ext}</span>`).join('');

        return `
            <div class="flight-card ${isBest ? 'best-flight' : ''}">
                <div class="flight-top">
                    <div class="flight-airlines">
                        ${airlinesHtml}
                        <span class="airline-names">${airlinesNames}</span>
                    </div>
                    <div class="flight-price-box">
                        <div class="flight-price">${simbolo} ${voo.price.toLocaleString('pt-BR')}</div>
                        <div class="flight-price-pp">por pessoa</div>
                        ${pax > 1 ? `<div class="flight-price-total">Total ${pax}p: ${simbolo} ${(voo.price * pax).toLocaleString('pt-BR')}</div>` : ''}
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

    // ================================================================
    // FLIGHT LEGS (IDA + VOLTA segments)
    // ================================================================
    _renderFlightLegs(voo) {
        const legs = voo.legs || [];
        const layovers = voo.layovers || [];

        if (legs.length === 0) return '';

        // Split legs into outbound and return (heuristic: after reaching destination, it's return)
        const { origemSelecionada: orig, destinoSelecionado: dest } = this.state;
        let splitIdx = -1;
        for (let i = 0; i < legs.length; i++) {
            if (legs[i].arrival_airport.id === dest.code || legs[i].arrival_airport.id.startsWith(dest.code)) {
                splitIdx = i;
                break;
            }
        }

        const outbound = splitIdx >= 0 ? legs.slice(0, splitIdx + 1) : legs;
        const returnLegs = splitIdx >= 0 ? legs.slice(splitIdx + 1) : [];

        // Corresponding layovers (layover is between consecutive legs)
        const outLayovers = layovers.slice(0, Math.max(0, splitIdx));
        const retLayovers = splitIdx >= 0 ? layovers.slice(splitIdx) : [];

        let html = '<div class="flight-legs">';

        // Outbound
        if (outbound.length > 0) {
            html += `<div class="leg-section"><div class="leg-label">🛫 Ida · ${orig.code} → ${dest.code}</div>`;
            outbound.forEach((leg, i) => {
                html += this._renderLegRow(leg);
                if (i < outLayovers.length && outLayovers[i]) {
                    html += this._renderLayover(outLayovers[i]);
                }
            });
            html += '</div>';
        }

        // Return
        if (returnLegs.length > 0) {
            html += `<div class="leg-section" style="margin-top:8px"><div class="leg-label">🛬 Volta · ${dest.code} → ${orig.code}</div>`;
            returnLegs.forEach((leg, i) => {
                html += this._renderLegRow(leg);
                if (i < retLayovers.length && retLayovers[i]) {
                    html += this._renderLayover(retLayovers[i]);
                }
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    },

    _renderLegRow(leg) {
        const depTime = leg.departure_airport.time ? leg.departure_airport.time.split(' ').pop()?.substring(0, 5) || '' : '';
        const arrTime = leg.arrival_airport.time ? leg.arrival_airport.time.split(' ').pop()?.substring(0, 5) || '' : '';
        const durH = Math.floor(leg.duration / 60);
        const durM = leg.duration % 60;
        const durStr = durM > 0 ? `${durH}h${String(durM).padStart(2, '0')}` : `${durH}h`;

        return `
            <div class="leg-row">
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
            </div>
        `;
    },

    _renderLayover(layover) {
        const durH = Math.floor(layover.duration / 60);
        const durM = layover.duration % 60;
        const durStr = durM > 0 ? `${durH}h${String(durM).padStart(2, '0')}` : `${durH}h`;
        const cls = layover.overnight ? 'overnight' : '';

        return `<div class="leg-layover ${cls}">
            ⏳ Conexão em ${layover.airport_id || layover.airport} · ${durStr}
            ${layover.overnight ? ' · 🌙 Pernoite' : ''}
        </div>`;
    },

    // ================================================================
    // SHARE
    // ================================================================
    _buildShareText() {
        const data = this.state.resultados;
        if (!data) return null;
        const { origemSelecionada: orig, destinoSelecionado: dest, moedaSelecionada: moeda, numPassageiros: pax } = this.state;
        const s = this.getSimbolo(moeda);
        const stats = data.stats;
        const gfUrl = this.buildGoogleFlightsUrl(orig.code, dest.code, stats.cheapestCombo.dataIda, stats.cheapestCombo.dataVolta, moeda);

        let text = `✈️ *Comparação de voos pela Benetrip!*\n\n`;
        text += `📍 ${orig.name} (${orig.code}) → ${dest.name} (${dest.code})\n`;
        text += `👥 ${pax} passageiro${pax > 1 ? 's' : ''}\n\n`;
        text += `🏆 *Melhor combinação:*\n`;
        text += `💰 *${s} ${stats.cheapest.toLocaleString('pt-BR')}* por pessoa\n`;
        text += `📆 ${this.fmtDateFull(stats.cheapestCombo.dataIda)} → ${this.fmtDateFull(stats.cheapestCombo.dataVolta)}\n`;
        if (pax > 1) text += `💰 Total: *${s} ${(stats.cheapest * pax).toLocaleString('pt-BR')}*\n`;
        text += `\n🔗 ${gfUrl}\n`;
        text += `\n🐕 benetrip.com.br`;
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
        }).catch(() => prompt('Copie:', text));
    },

    // ================================================================
    // GOOGLE FLIGHTS URL (Protobuf)
    // ================================================================
    _pV(n){const b=[];let v=n>>>0;while(v>127){b.push((v&0x7f)|0x80);v>>>=7;}b.push(v&0x7f);return b;},
    _pT(f,w){return this._pV((f<<3)|w);},
    _pVF(f,v){return[...this._pT(f,0),...this._pV(v)];},
    _pSF(f,s){const e=new TextEncoder().encode(s);return[...this._pT(f,2),...this._pV(e.length),...e];},
    _pMF(f,m){return[...this._pT(f,2),...this._pV(m.length),...m];},
    _b64u(b){return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');},
    _bAirport(c){return[...this._pVF(1,1),...this._pSF(2,c)];},
    _bLeg(d,o,de){return[...this._pSF(2,d),...this._pMF(13,this._bAirport(o)),...this._pMF(14,this._bAirport(de))];},

    buildGoogleFlightsUrl(o,d,dep,ret,cur){
        const tfs=this._b64u([...this._pVF(1,28),...this._pVF(2,2),...this._pMF(3,this._bLeg(dep,o,d)),...this._pMF(3,this._bLeg(ret,d,o)),...this._pVF(14,1)]);
        const tfu=this._b64u(this._pMF(2,[...this._pVF(1,1),...this._pVF(2,0),...this._pVF(3,0)]));
        const p=new URLSearchParams();
        p.set('tfs',tfs);p.set('tfu',tfu);
        p.set('curr',{BRL:'BRL',USD:'USD',EUR:'EUR'}[cur]||'BRL');
        p.set('hl',{BRL:'pt-BR',USD:'en',EUR:'en'}[cur]||'pt-BR');
        p.set('gl',{BRL:'br',USD:'us',EUR:'de'}[cur]||'br');
        return`https://www.google.com/travel/flights/search?${p.toString()}`;
    },

    // ================================================================
    // HELPERS
    // ================================================================
    getSimbolo(m){return{BRL:'R$',USD:'US$',EUR:'€'}[m]||'R$';},
    fmtISO(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;},
    fmtBR(d){return d.toLocaleDateString('pt-BR');},
    fmtDateShort(s){return new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});},
    fmtDateFull(s){return new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});},
    fmtWeekday(s){const wd=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];return wd[new Date(s+'T12:00:00').getDay()];},
    delay(ms){return new Promise(r=>setTimeout(r,ms));},

    showLoading(){
        document.getElementById('form-section').style.display='none';
        document.getElementById('hero-section').style.display='none';
        document.getElementById('loading-section').style.display='block';
        document.getElementById('results-section').style.display='none';
        window.scrollTo({top:0,behavior:'smooth'});
    },
    showForm(){
        document.getElementById('form-section').style.display='block';
        document.getElementById('hero-section').style.display='block';
        document.getElementById('loading-section').style.display='none';
        document.getElementById('results-section').style.display='none';
        window.scrollTo({top:0,behavior:'smooth'});
    },
    showResults(){
        document.getElementById('form-section').style.display='none';
        document.getElementById('hero-section').style.display='none';
        document.getElementById('loading-section').style.display='none';
        document.getElementById('results-section').style.display='block';
        window.scrollTo({top:0,behavior:'smooth'});
    },
    updateProgress(pct,msg){
        const bar=document.getElementById('progress-bar');
        const msgEl=document.getElementById('loading-msg');
        if(bar) bar.style.width=`${pct}%`;
        if(msgEl) msgEl.textContent=msg;
    },
};

document.addEventListener('DOMContentLoaded',()=>BenetripCompararVoos.init());
