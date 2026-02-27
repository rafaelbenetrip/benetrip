/**
 * BENETRIP - TODOS OS DESTINOS
 * Versão: Filtros Avançados v3.1
 *
 * - Calendário unificado: 1 data = busca exata | várias = datas flexíveis automático
 * - Filtros avançados: ordenação, paradas, duração, tipo destino,
 *   combinação de datas, companhia aérea, faixa de preço
 * - Tudo client-side para velocidade instantânea
 */

const BenetripTodosDestinos = {
    state: {
        cidadesData: null,
        origemSelecionada: null,
        formData: {},
        todosDestinos: [],
        destinosFiltrados: [],
        datasIda: [],
        datasVolta: [],
        fpIda: null,
        fpVolta: null,
        filtros: {
            ordenacao: 'preco_asc',
            orcamento: 'todos',
            paradas: 'qualquer',
            duracao: 'qualquer',
            tipoDestino: 'todos',
            comboData: 'melhor',
            companhias: [],
            precoMin: 0,
            precoMax: Infinity,
        },
        companhiasDisponiveis: [],
        paisOrigem: '',
        precoMinGlobal: 0,
        precoMaxGlobal: 0,
        filtrosAberto: false,
    },

    config: {
        debug: true,
        cidadesJsonPath: 'data/cidades_global_iata_v6.json',
        maxDatasIda: 3,
        maxDatasVolta: 3,
    },

    log(...args) { if (this.config.debug) console.log('[Benetrip]', ...args); },
    error(...args) { console.error('[Benetrip ERROR]', ...args); },

    init() {
        this.log('🐕 Benetrip v3.1 (Calendário Unificado) inicializando...');
        this.carregarCidades();
        this.setupFormEvents();
        this.setupAutocomplete();
        this.setupCalendars();
        this.setupOptionButtons();
        this.setupCurrencyInput();
        this.log('✅ Inicialização completa');
    },

    // ================================================================
    // CARREGAR CIDADES
    // ================================================================
    async carregarCidades() {
        try {
            const response = await fetch(this.config.cidadesJsonPath);
            if (!response.ok) throw new Error('Erro');
            const dados = await response.json();
            this.state.cidadesData = dados.filter(c => c.iata);
            this.log('✅ ' + this.state.cidadesData.length + ' cidades');
        } catch (e) {
            this.error('Erro cidades:', e);
            this.state.cidadesData = [
                { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", codigo_pais: "BR", iata: "GRU", aeroporto: "Aeroporto de Guarulhos" },
                { cidade: "Rio de Janeiro", sigla_estado: "RJ", pais: "Brasil", codigo_pais: "BR", iata: "GIG", aeroporto: "Aeroporto do Galeão" },
                { cidade: "Salvador", sigla_estado: "BA", pais: "Brasil", codigo_pais: "BR", iata: "SSA" }
            ];
        }
    },

    normalizarTexto(t) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); },

    buscarCidades(termo) {
        if (!this.state.cidadesData || termo.length < 2) return [];
        const tn = this.normalizarTexto(termo);
        return this.state.cidadesData
            .filter(c => {
                const n = this.normalizarTexto(c.cidade);
                const i = c.iata.toLowerCase();
                const a = c.aeroporto ? this.normalizarTexto(c.aeroporto) : '';
                return n.includes(tn) || i.includes(tn) || a.includes(tn);
            })
            .slice(0, 8)
            .map(c => ({ code: c.iata, name: c.cidade, state: c.sigla_estado, country: c.pais, countryCode: c.codigo_pais, airport: c.aeroporto || null }));
    },

    // ================================================================
    // AUTOCOMPLETE
    // ================================================================
    setupAutocomplete() {
        const input = document.getElementById('origem');
        const results = document.getElementById('origem-results');
        const hidden = document.getElementById('origem-data');
        let timer;
        input.addEventListener('input', (e) => {
            clearTimeout(timer);
            const t = e.target.value.trim();
            if (t.length < 2) { results.innerHTML = ''; results.style.display = 'none'; this.state.origemSelecionada = null; hidden.value = ''; return; }
            timer = setTimeout(() => {
                const cidades = this.buscarCidades(t);
                if (!cidades.length) { results.innerHTML = '<div style="padding:12px;color:#666;">Nenhuma cidade encontrada</div>'; results.style.display = 'block'; return; }
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
                    item.addEventListener('click', () => this.selecionarOrigem(JSON.parse(item.dataset.city)));
                });
            }, 300);
        });
        document.addEventListener('click', (e) => { if (!input.contains(e.target) && !results.contains(e.target)) results.style.display = 'none'; });
    },

    selecionarOrigem(c) {
        const input = document.getElementById('origem');
        const results = document.getElementById('origem-results');
        this.state.origemSelecionada = c;
        input.value = c.airport ? `${c.name} — ${c.airport} (${c.code})` : `${c.name} (${c.code})`;
        document.getElementById('origem-data').value = JSON.stringify(c);
        results.style.display = 'none';
        this.state.paisOrigem = (c.country || '').toLowerCase();
    },

    // ================================================================
    // CALENDÁRIOS UNIFICADOS
    // - 1 data selecionada = busca exata
    // - 2 ou 3 datas = datas flexíveis (comparação automática)
    // ================================================================
    setupCalendars() {
        const inpI = document.getElementById('datas-ida-flex');
        const inpV = document.getElementById('datas-volta-flex');
        const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);

        this.state.fpIda = flatpickr(inpI, {
            mode: 'multiple', minDate: amanha, dateFormat: 'Y-m-d', locale: 'pt', conjunction: ', ',
            onChange: (sel) => {
                if (sel.length > this.config.maxDatasIda) { sel.splice(this.config.maxDatasIda); this.state.fpIda.setDate(sel); }
                this.state.datasIda = sel.map(d => this.formatarDataISO(d)).sort();
                this.renderDateChips('selected-idas', this.state.datasIda, 'ida');
                this.atualizarCombinacoes();
                if (sel.length > 0) {
                    const mv = new Date(Math.min(...sel)); mv.setDate(mv.getDate() + 1);
                    this.state.fpVolta.set('minDate', mv);
                }
                inpI.value = sel.length > 0 ? sel.map(d => this.formatarDataBR(d)).join(', ') : '';
            }
        });

        this.state.fpVolta = flatpickr(inpV, {
            mode: 'multiple', minDate: amanha, dateFormat: 'Y-m-d', locale: 'pt', conjunction: ', ',
            onChange: (sel) => {
                if (sel.length > this.config.maxDatasVolta) { sel.splice(this.config.maxDatasVolta); this.state.fpVolta.setDate(sel); }
                this.state.datasVolta = sel.map(d => this.formatarDataISO(d)).sort();
                this.renderDateChips('selected-voltas', this.state.datasVolta, 'volta');
                this.atualizarCombinacoes();
                inpV.value = sel.length > 0 ? sel.map(d => this.formatarDataBR(d)).join(', ') : '';
            }
        });
    },

    renderDateChips(id, datas, tipo) {
        const el = document.getElementById(id); if (!el) return;
        el.innerHTML = datas.map((d, i) => {
            const br = new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
            return `<span class="date-chip">${tipo === 'ida' ? '🛫' : '🛬'} ${br} <span class="remove-date" onclick="BenetripTodosDestinos.removerData('${tipo}',${i})">✕</span></span>`;
        }).join('');
    },

    removerData(tipo, idx) {
        const arr = tipo === 'ida' ? this.state.datasIda : this.state.datasVolta;
        arr.splice(idx, 1);
        const fp = tipo === 'ida' ? this.state.fpIda : this.state.fpVolta;
        const inputId = tipo === 'ida' ? 'datas-ida-flex' : 'datas-volta-flex';
        const dates = arr.map(d => new Date(d + 'T12:00:00'));
        fp.setDate(dates);
        this.renderDateChips(tipo === 'ida' ? 'selected-idas' : 'selected-voltas', arr, tipo);
        document.getElementById(inputId).value = dates.length > 0 ? dates.map(d => this.formatarDataBR(d)).join(', ') : '';
        this.atualizarCombinacoes();
    },

    // Só exibe o banner de combinações quando há mais de 1 (busca flexível)
    atualizarCombinacoes() {
        const info = document.getElementById('combinacoes-info');
        const texto = document.getElementById('combinacoes-texto');
        const combos = this.gerarCombinacoes();

        if (this.state.datasIda.length > 0 && this.state.datasVolta.length > 0) {
            if (combos.length > 1) {
                info.style.display = 'flex';
                texto.textContent = `${combos.length} combinações serão pesquisadas`;
            } else {
                info.style.display = 'none';
            }
        } else {
            info.style.display = 'none';
        }
    },

    gerarCombinacoes() {
        const c = [];
        for (const ida of this.state.datasIda)
            for (const volta of this.state.datasVolta)
                if (volta > ida) c.push({ dataIda: ida, dataVolta: volta });
        return c;
    },

    // ================================================================
    // BOTÕES DE OPÇÃO
    // ================================================================
    setupOptionButtons() {
        document.querySelectorAll('.button-group-vertical, .button-group-horizontal').forEach(group => {
            const field = group.dataset.field;
            if (!field) return;
            const hidden = document.getElementById(field); if (!hidden) return;
            group.querySelectorAll('.btn-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active'); hidden.value = btn.dataset.value;
                    if (field === 'moeda') this.atualizarSimboloMoeda(btn.dataset.value);
                });
            });
        });
    },

    atualizarSimboloMoeda(m) { const el = document.querySelector('.currency-symbol'); if (el) el.textContent = { BRL: 'R$', USD: '$', EUR: '€' }[m] || 'R$'; },

    setupCurrencyInput() {
        const inp = document.getElementById('orcamento');
        if (inp) inp.addEventListener('input', (e) => { let v = e.target.value.replace(/\D/g, ''); e.target.value = v ? parseInt(v).toLocaleString('pt-BR') : ''; });
    },

    // ================================================================
    // FORM EVENTS
    // ================================================================
    setupFormEvents() {
        document.getElementById('busca-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.validarFormulario()) return;
            this.coletarDadosFormulario();
            await this.buscarTodosDestinos();
        });
    },

    validarFormulario() {
        if (!this.state.origemSelecionada) { alert('Selecione uma cidade de origem'); return false; }
        if (!this.state.datasIda.length) { alert('Selecione ao menos uma data de ida'); return false; }
        if (!this.state.datasVolta.length) { alert('Selecione ao menos uma data de volta'); return false; }
        if (!this.gerarCombinacoes().length) { alert('As datas de volta devem ser posteriores às de ida'); return false; }
        if (!document.getElementById('moeda').value) { alert('Escolha a moeda'); return false; }
        const o = document.getElementById('orcamento').value;
        if (!o || parseFloat(o.replace(/\./g, '')) <= 0) { alert('Informe o orçamento'); return false; }
        return true;
    },

    coletarDadosFormulario() {
        const moeda = document.getElementById('moeda').value;
        const escopo = document.getElementById('escopo').value || 'todos';
        const combos = this.gerarCombinacoes();

        this.state.formData = {
            origem: this.state.origemSelecionada,
            dataIda: combos[0]?.dataIda,
            dataVolta: combos[combos.length - 1]?.dataVolta,
            combinacoes: combos,
            moeda,
            escopo,
            orcamento: parseFloat(document.getElementById('orcamento').value.replace(/\./g, ''))
        };
        this.state.paisOrigem = (this.state.origemSelecionada.country || '').toLowerCase();
    },

    // ================================================================
    // BUSCA DE DESTINOS
    // ================================================================
    async buscarTodosDestinos() {
        try {
            this.mostrarLoading();
            const { origem, combinacoes, moeda, escopo } = this.state.formData;
            const totalCombos = combinacoes.length;
            const isFlexivel = totalCombos > 1;

            document.getElementById('loading-title').textContent = isFlexivel
                ? `🐕 Tripinha compara ${totalCombos} combinações...` : '🐕 Tripinha vasculha o mundo...';
            document.getElementById('loading-combinacao').style.display = isFlexivel ? 'block' : 'none';
            this.atualizarProgresso(10, '🌍 Preparando buscas...');

            let escopoDestino;
            if (escopo === 'brasil') escopoDestino = 'brasil';
            else if (escopo === 'internacional') escopoDestino = 'internacional';

            const allResults = new Map();
            const batchSize = 3;
            let completed = 0;

            for (let i = 0; i < totalCombos; i += batchSize) {
                const batch = combinacoes.slice(i, i + batchSize);
                const promises = batch.map(combo => {
                    const label = `${this.formatarDataCurta(combo.dataIda)} → ${this.formatarDataCurta(combo.dataVolta)}`;
                    if (isFlexivel) document.getElementById('loading-combinacao').textContent = `Pesquisando: ${label}`;
                    return fetch('/api/search-destinations', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ origem: origem.code, dataIda: combo.dataIda, dataVolta: combo.dataVolta, moeda, escopoDestino })
                    }).then(async r => {
                        if (!r.ok) { const e = await r.json().catch(() => ({})); return { combo, destinations: [], error: e.message }; }
                        const d = await r.json(); return { combo, destinations: d.destinations || [], error: null };
                    }).catch(e => ({ combo, destinations: [], error: e.message }));
                });

                const batchR = await Promise.all(promises);
                for (const result of batchR) {
                    if (!result.destinations?.length) continue;
                    for (const dest of result.destinations) {
                        if (!dest.name || !dest.flight?.price || dest.flight.price <= 0) continue;
                        const key = `${dest.name.toLowerCase()}_${(dest.country || '').toLowerCase()}`;
                        const existing = allResults.get(key);
                        const noites = this.calcularNoites(result.combo.dataIda, result.combo.dataVolta);
                        const opcao = { combo: result.combo, price: dest.flight.price, noites, flight: { ...dest.flight } };
                        if (!existing || dest.flight.price < existing.flight.price) {
                            allResults.set(key, {
                                ...dest, _melhorCombo: result.combo, _melhorNoites: noites,
                                _totalCombos: existing ? existing._totalCombos + 1 : 1,
                                _todasOpcoes: existing ? [...existing._todasOpcoes, opcao] : [opcao],
                            });
                        } else { existing._totalCombos++; existing._todasOpcoes.push(opcao); }
                    }
                }
                completed += batch.length;
                this.atualizarProgresso(20 + Math.floor((completed / totalCombos) * 60), `💰 ${completed}/${totalCombos} pesquisadas...`);
            }

            this.atualizarProgresso(85, '✈️ Organizando resultados...');
            const sorted = Array.from(allResults.values()).sort((a, b) => a.flight.price - b.flight.price);
            if (!sorted.length) throw new Error('Nenhum destino encontrado');

            this.state.todosDestinos = sorted;
            BenetripAutoSave.salvarBuscaTodosDestinos(this.state.formData, sorted);
            this.prepararDadosFiltros(sorted);
            this.resetFiltros();
            this.aplicarFiltrosEMostrar();

            this.atualizarProgresso(100, '🎉 Pronto!');
            await this.delay(300);
            document.getElementById('loading-container').style.display = 'none';
            document.getElementById('resultados-container').style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
            this.error('Erro:', e); alert(`Erro: ${e.message}`); this.esconderLoading();
        }
    },

    // ================================================================
    // PREPARAR / RESET FILTROS
    // ================================================================
    prepararDadosFiltros(destinos) {
        const comp = new Set();
        destinos.forEach(d => { if (d.flight.airline_name) comp.add(d.flight.airline_name); });
        this.state.companhiasDisponiveis = [...comp].sort();
        const precos = destinos.map(d => d.flight.price).filter(p => p > 0);
        this.state.precoMinGlobal = Math.min(...precos);
        this.state.precoMaxGlobal = Math.max(...precos);
    },

    resetFiltros() {
        this.state.filtros = {
            ordenacao: 'preco_asc', orcamento: 'todos', paradas: 'qualquer',
            duracao: 'qualquer', tipoDestino: 'todos', comboData: 'melhor',
            companhias: [], precoMin: this.state.precoMinGlobal, precoMax: this.state.precoMaxGlobal,
        };
    },

    // ================================================================
    // MOTOR DE FILTROS
    // ================================================================
    aplicarFiltrosEMostrar() {
        const f = this.state.filtros;
        const { orcamento, combinacoes } = this.state.formData;
        const isFlexivel = combinacoes.length > 1;
        let destinos = [...this.state.todosDestinos];

        // Combo de datas
        if (isFlexivel && f.comboData !== 'melhor') {
            const combo = combinacoes[parseInt(f.comboData)];
            if (combo) {
                destinos = destinos.filter(d => {
                    const op = (d._todasOpcoes || []).find(o => o.combo.dataIda === combo.dataIda && o.combo.dataVolta === combo.dataVolta);
                    if (op) { d._comboAtual = op; return true; }
                    return false;
                });
            }
        } else { destinos.forEach(d => d._comboAtual = null); }

        const getPreco = d => d._comboAtual ? d._comboAtual.price : d.flight.price;
        const getDur = d => d._comboAtual ? (d._comboAtual.flight?.flight_duration_minutes || d.flight.flight_duration_minutes || 0) : (d.flight.flight_duration_minutes || 0);
        const getStops = d => d._comboAtual ? (d._comboAtual.flight?.stops ?? d.flight.stops ?? 0) : (d.flight.stops || 0);

        if (f.orcamento === 'dentro') destinos = destinos.filter(d => getPreco(d) <= orcamento);
        else if (f.orcamento === 'fora') destinos = destinos.filter(d => getPreco(d) > orcamento);

        if (f.paradas === 'direto') destinos = destinos.filter(d => getStops(d) === 0);
        else if (f.paradas === 'max1') destinos = destinos.filter(d => getStops(d) <= 1);

        if (f.duracao !== 'qualquer') {
            destinos = destinos.filter(d => {
                const m = getDur(d); if (m <= 0) return false;
                if (f.duracao === 'curto') return m <= 180;
                if (f.duracao === 'medio') return m > 180 && m <= 360;
                if (f.duracao === 'longo') return m > 360 && m <= 600;
                if (f.duracao === 'muitolongo') return m > 600;
                return true;
            });
        }

        if (f.tipoDestino !== 'todos' && this.state.paisOrigem) {
            destinos = destinos.filter(d => {
                const isNac = (d.country || '').toLowerCase() === this.state.paisOrigem;
                return f.tipoDestino === 'nacional' ? isNac : !isNac;
            });
        }

        if (f.companhias.length > 0) destinos = destinos.filter(d => f.companhias.includes(d.flight.airline_name || ''));

        destinos = destinos.filter(d => { const p = getPreco(d); return p >= f.precoMin && p <= f.precoMax; });

        destinos.sort((a, b) => {
            switch (f.ordenacao) {
                case 'preco_asc': return getPreco(a) - getPreco(b);
                case 'preco_desc': return getPreco(b) - getPreco(a);
                case 'duracao_asc': return getDur(a) - getDur(b);
                case 'paradas_asc': return getStops(a) - getStops(b);
                case 'custo_total': {
                    const nA = a._comboAtual?.noites || a._melhorNoites || 1, nB = b._comboAtual?.noites || b._melhorNoites || 1;
                    return (getPreco(a) + (a.avg_cost_per_night || 0) * nA) - (getPreco(b) + (b.avg_cost_per_night || 0) * nB);
                }
                default: return getPreco(a) - getPreco(b);
            }
        });

        this.state.destinosFiltrados = destinos;
        this.renderResultados();
    },

    // ================================================================
    // RENDER RESULTADOS
    // ================================================================
    renderResultados() {
        const container = document.getElementById('resultados-container');
        const destinos = this.state.destinosFiltrados;
        const { origem, moeda, orcamento, combinacoes, escopo } = this.state.formData;
        const isFlexivel = combinacoes.length > 1;
        const todos = this.state.todosDestinos;

        if (!todos.length) { this.mostrarSemResultados(); return; }

        const origemDisplay = origem.airport ? `${origem.name} — ${origem.airport} (${origem.code})` : `${origem.name} (${origem.code})`;

        let periodoHtml = '';
        if (isFlexivel) {
            const idas = [...new Set(combinacoes.map(c => c.dataIda))].sort();
            const voltas = [...new Set(combinacoes.map(c => c.dataVolta))].sort();
            periodoHtml = `
                <div class="stat-item"><span class="stat-label">Idas</span><span class="stat-value">🛫 ${idas.map(d => this.formatarDataCurta(d)).join(' · ')}</span></div>
                <div class="stat-item"><span class="stat-label">Voltas</span><span class="stat-value">🛬 ${voltas.map(d => this.formatarDataCurta(d)).join(' · ')}</span></div>
                <div class="stat-item"><span class="stat-label">Combinações</span><span class="stat-value blue">🔀 ${combinacoes.length}</span></div>`;
        } else {
            const n = this.calcularNoites(this.state.formData.dataIda, this.state.formData.dataVolta);
            periodoHtml = `<div class="stat-item"><span class="stat-label">Período</span><span class="stat-value">📅 ${this.formatarDataCurta(this.state.formData.dataIda)} → ${this.formatarDataCompletaBR(this.state.formData.dataVolta)} (${n}n)</span></div>`;
        }

        const dentroCount = todos.filter(d => d.flight.price <= orcamento).length;
        const tripinhaMsg = this._tripinhaMsg(todos, orcamento, moeda, isFlexivel, combinacoes.length, escopo);
        const filtrosHtml = this._filtrosPainelHtml(isFlexivel);
        const escopoEmoji = escopo === 'brasil' ? '🇧🇷' : escopo === 'internacional' ? '✈️' : '🌍';

        container.innerHTML = `
            <button class="btn-voltar-topo" onclick="BenetripTodosDestinos.voltarAoFormulario()">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> Nova busca
            </button>
            <div class="resultados-header">
                <h1>${escopoEmoji} Todos os Destinos Disponíveis</h1>
                <div class="resultados-stats">
                    <div class="stat-item"><span class="stat-label">De</span><span class="stat-value">📍 ${origemDisplay}</span></div>
                    ${periodoHtml}
                    <div class="stat-item"><span class="stat-label">Total</span><span class="stat-value orange">${todos.length}</span></div>
                    <div class="stat-item"><span class="stat-label">No orçamento</span><span class="stat-value green">${dentroCount}</span></div>
                </div>
            </div>
            <div class="tripinha-message">
                <img src="assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="tripinha-message-avatar" onerror="this.style.display='none'">
                <div class="tripinha-message-content"><h3>💬 Fala da Tripinha:</h3><p>${tripinhaMsg}</p></div>
            </div>
            <button class="btn-toggle-filtros" id="btn-toggle-filtros" onclick="BenetripTodosDestinos.toggleFiltros()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
                <span>Filtros e Ordenação</span>
                <span class="filtro-count" id="filtro-count" style="display:none">0</span>
            </button>
            <div class="filtros-painel ${this.state.filtrosAberto ? 'aberto' : ''}" id="filtros-painel">${filtrosHtml}</div>
            <div class="filtros-overlay" id="filtros-overlay" onclick="BenetripTodosDestinos.toggleFiltros()"></div>
            <div class="resultados-count" id="resultados-count">
                ${destinos.length === todos.length
                    ? `<span>Mostrando <strong>${todos.length}</strong> destinos</span>`
                    : `<span>Mostrando <strong>${destinos.length}</strong> de ${todos.length}</span> <button class="btn-limpar-inline" onclick="BenetripTodosDestinos.limparFiltros()">Limpar filtros</button>`}
            </div>
            <div class="destinos-lista" id="destinos-lista">
                ${destinos.length > 0
                    ? destinos.map(d => this._cardHtml(d, orcamento, isFlexivel)).join('')
                    : '<div class="sem-resultados-filtro"><p>😕 Nenhum destino com esses filtros.</p><button class="btn-limpar-filtros-mini" onclick="BenetripTodosDestinos.limparFiltros()">Limpar filtros</button></div>'}
            </div>`;

        this._atualizarBadgeFiltros();
    },

    // ================================================================
    // FILTROS PAINEL HTML
    // ================================================================
    _filtrosPainelHtml(isFlexivel) {
        const f = this.state.filtros;
        const simbolo = this.getSimbolo(this.state.formData.moeda);

        const chip = (label, chave, valor) =>
            `<button class="chip ${f[chave] === valor ? 'active' : ''}" onclick="BenetripTodosDestinos.setFiltro('${chave}','${valor}')">${label}</button>`;

        let comboHtml = '';
        if (isFlexivel) {
            comboHtml = `<div class="filtro-grupo"><div class="filtro-titulo">📅 Combinação de Datas</div><div class="filtro-chips">
                <button class="chip ${f.comboData === 'melhor' ? 'active' : ''}" onclick="BenetripTodosDestinos.setFiltro('comboData','melhor')">⭐ Melhor preço</button>
                ${this.state.formData.combinacoes.map((c, i) => {
                    const lbl = `${this.formatarDataCurta(c.dataIda)} → ${this.formatarDataCurta(c.dataVolta)}`;
                    const n = this.calcularNoites(c.dataIda, c.dataVolta);
                    return `<button class="chip ${f.comboData === String(i) ? 'active' : ''}" onclick="BenetripTodosDestinos.setFiltro('comboData','${i}')">${lbl} <span class="chip-sub">${n}n</span></button>`;
                }).join('')}
            </div></div>`;
        }

        let compHtml = '';
        if (this.state.companhiasDisponiveis.length > 1) {
            compHtml = `<div class="filtro-grupo"><div class="filtro-titulo">🛫 Companhia Aérea</div><div class="filtro-chips">
                <button class="chip ${f.companhias.length === 0 ? 'active' : ''}" onclick="BenetripTodosDestinos.setFiltro('companhias',[])">Todas</button>
                ${this.state.companhiasDisponiveis.map(c =>
                    `<button class="chip ${f.companhias.includes(c) ? 'active' : ''}" onclick="BenetripTodosDestinos.toggleCompanhia('${c.replace(/'/g, "\\'")}')">${c}</button>`
                ).join('')}
            </div></div>`;
        }

        return `
            <div class="filtros-header-mobile"><h3>Filtros e Ordenação</h3><button class="btn-fechar-filtros" onclick="BenetripTodosDestinos.toggleFiltros()">✕</button></div>

            <div class="filtro-grupo"><div class="filtro-titulo">📊 Ordenar por</div><div class="filtro-chips">
                ${chip('💰 Menor preço', 'ordenacao', 'preco_asc')}
                ${chip('💰 Maior preço', 'ordenacao', 'preco_desc')}
                ${chip('⏱️ Menor duração', 'ordenacao', 'duracao_asc')}
                ${chip('✈️ Menos paradas', 'ordenacao', 'paradas_asc')}
                ${chip('🏨 Custo total', 'ordenacao', 'custo_total')}
            </div></div>

            ${comboHtml}

            <div class="filtro-grupo"><div class="filtro-titulo">💸 Orçamento</div><div class="filtro-chips">
                ${chip('Todos', 'orcamento', 'todos')} ${chip('✅ Dentro', 'orcamento', 'dentro')} ${chip('⚠️ Acima', 'orcamento', 'fora')}
            </div></div>

            <div class="filtro-grupo"><div class="filtro-titulo">🔄 Paradas</div><div class="filtro-chips">
                ${chip('Qualquer', 'paradas', 'qualquer')} ${chip('Direto', 'paradas', 'direto')} ${chip('Até 1', 'paradas', 'max1')}
            </div></div>

            <div class="filtro-grupo"><div class="filtro-titulo">⏱️ Duração do Voo</div><div class="filtro-chips">
                ${chip('Qualquer', 'duracao', 'qualquer')} ${chip('Até 3h', 'duracao', 'curto')} ${chip('3h–6h', 'duracao', 'medio')} ${chip('6h–10h', 'duracao', 'longo')} ${chip('+10h', 'duracao', 'muitolongo')}
            </div></div>

            <div class="filtro-grupo"><div class="filtro-titulo">🌎 Tipo de Destino</div><div class="filtro-chips">
                ${chip('Todos', 'tipoDestino', 'todos')} ${chip('🏠 Nacional', 'tipoDestino', 'nacional')} ${chip('✈️ Internacional', 'tipoDestino', 'internacional')}
            </div></div>

            ${compHtml}

            <div class="filtro-grupo"><div class="filtro-titulo">💰 Faixa de Preço</div>
                <div class="filtro-range"><div class="range-inputs">
                    <div class="range-field"><label>Mín</label><input type="text" id="filtro-preco-min" value="${Math.round(f.precoMin).toLocaleString('pt-BR')}" onchange="BenetripTodosDestinos.setPrecoRange()"></div>
                    <span class="range-separator">—</span>
                    <div class="range-field"><label>Máx</label><input type="text" id="filtro-preco-max" value="${f.precoMax === Infinity ? '' : Math.round(f.precoMax).toLocaleString('pt-BR')}" placeholder="Sem limite" onchange="BenetripTodosDestinos.setPrecoRange()"></div>
                </div><div class="range-hint">${simbolo} ${Math.round(this.state.precoMinGlobal).toLocaleString('pt-BR')} — ${simbolo} ${Math.round(this.state.precoMaxGlobal).toLocaleString('pt-BR')}</div></div>
            </div>

            <div class="filtro-acoes"><button class="btn-limpar-filtros" onclick="BenetripTodosDestinos.limparFiltros()">🗑️ Limpar todos os filtros</button></div>
            <div class="filtro-aplicar-mobile"><button class="btn-aplicar-filtros" onclick="BenetripTodosDestinos.toggleFiltros()">Ver <span id="filtro-resultado-count">${this.state.destinosFiltrados.length}</span> resultados</button></div>
        `;
    },

    // ================================================================
    // AÇÕES FILTROS
    // ================================================================
    setFiltro(k, v) { this.state.filtros[k] = v; this.aplicarFiltrosEMostrar(); },
    toggleCompanhia(n) { const a = this.state.filtros.companhias; const i = a.indexOf(n); if (i >= 0) a.splice(i, 1); else a.push(n); this.aplicarFiltrosEMostrar(); },
    setPrecoRange() {
        const mn = document.getElementById('filtro-preco-min');
        const mx = document.getElementById('filtro-preco-max');
        this.state.filtros.precoMin = parseFloat((mn?.value || '0').replace(/\./g, '').replace(',', '.')) || 0;
        this.state.filtros.precoMax = parseFloat((mx?.value || '0').replace(/\./g, '').replace(',', '.')) || Infinity;
        this.aplicarFiltrosEMostrar();
    },
    limparFiltros() { this.resetFiltros(); this.aplicarFiltrosEMostrar(); },

    toggleFiltros() {
        this.state.filtrosAberto = !this.state.filtrosAberto;
        document.getElementById('filtros-painel')?.classList.toggle('aberto', this.state.filtrosAberto);
        document.getElementById('filtros-overlay')?.classList.toggle('aberto', this.state.filtrosAberto);
        document.body.classList.toggle('filtros-open', this.state.filtrosAberto);
    },

    _atualizarBadgeFiltros() {
        const f = this.state.filtros;
        let c = 0;
        if (f.ordenacao !== 'preco_asc') c++;
        if (f.orcamento !== 'todos') c++;
        if (f.paradas !== 'qualquer') c++;
        if (f.duracao !== 'qualquer') c++;
        if (f.tipoDestino !== 'todos') c++;
        if (f.comboData !== 'melhor') c++;
        if (f.companhias.length > 0) c++;
        if (f.precoMin > this.state.precoMinGlobal || f.precoMax < this.state.precoMaxGlobal) c++;
        const badge = document.getElementById('filtro-count');
        if (badge) { badge.textContent = c; badge.style.display = c > 0 ? 'inline-flex' : 'none'; }
        const mc = document.getElementById('filtro-resultado-count');
        if (mc) mc.textContent = this.state.destinosFiltrados.length;
    },

    // ================================================================
    // CARD HTML
    // ================================================================
    _cardHtml(dest, orcamento, isFlexivel) {
        const { origem, moeda } = this.state.formData;
        const ca = dest._comboAtual;
        const preco = ca ? ca.price : dest.flight.price;
        const dentro = preco <= orcamento;
        const flight = ca?.flight || dest.flight;
        const stops = flight.stops || 0;
        const stopsT = stops === 0 ? 'Direto' : stops === 1 ? '1 parada' : `${stops} paradas`;
        const dur = flight.flight_duration_minutes || 0;
        const durT = dur > 0 ? `${Math.floor(dur / 60)}h${String(dur % 60).padStart(2, '0')}` : '';
        const combo = ca?.combo || dest._melhorCombo || { dataIda: this.state.formData.dataIda, dataVolta: this.state.formData.dataVolta };
        const noites = ca?.noites || dest._melhorNoites || this.calcularNoites(combo.dataIda, combo.dataVolta);
        const destIata = dest.primary_airport || dest.flight?.airport_code || '';
        const gfUrl = this.buildGoogleFlightsUrl(origem.code, destIata, combo.dataIda, combo.dataVolta, moeda);

        let bestDates = '';
        if (isFlexivel) {
            const c = ca?.combo || dest._melhorCombo;
            if (c) bestDates = `<div class="best-dates-badge">📅 ${this.formatarDataCurta(c.dataIda)} → ${this.formatarDataCurta(c.dataVolta)} (${noites}n)</div>`;
        }

        let custoHtml = '';
        if (dest.avg_cost_per_night > 0) {
            const t = preco + dest.avg_cost_per_night * noites;
            custoHtml = `<div class="custo-estimado-mini">Com hotel: <strong>${this.formatarPreco(t, moeda)}</strong> <span style="opacity:.7">(voo+${noites}n)</span></div>`;
        }

        const isNac = this.state.paisOrigem && (dest.country || '').toLowerCase() === this.state.paisOrigem;
        const tipoBadge = isNac ? '<span class="tipo-badge nacional">🏠 Nacional</span>' : '<span class="tipo-badge internacional">✈️ Internacional</span>';

        let outrasHtml = '';
        if (isFlexivel && dest._todasOpcoes?.length > 1 && !ca) {
            outrasHtml = `<div class="detalhe-item"><span class="detalhe-icon">🔀</span><span>${dest._todasOpcoes.length} combinações</span></div>`;
        }

        const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`;

        return `<div class="destino-item ${dentro ? 'dentro-orcamento' : 'fora-orcamento'}">
            <div class="destino-badges">
                <span class="status-badge ${dentro ? 'dentro' : 'fora'}">${dentro ? '✓ No orçamento' : '⚠ Acima'}</span>
                ${tipoBadge}
            </div>
            <div class="destino-header">
                <div class="destino-info">
                    <h3 class="destino-nome">${dest.name}</h3>
                    <p class="destino-pais">${dest.country || '—'} · ${destIata}</p>
                    ${bestDates}
                </div>
                <div class="destino-preco-wrapper">
                    <div class="destino-preco">${this.formatarPreco(preco, moeda)}</div>
                    <div class="destino-preco-label">ida e volta</div>
                </div>
            </div>
            <div class="destino-detalhes">
                <div class="detalhe-item"><span class="detalhe-icon">✈️</span><span>${stopsT}</span></div>
                ${durT ? `<div class="detalhe-item"><span class="detalhe-icon">⏱️</span><span>${durT}</span></div>` : ''}
                ${flight.airline_name ? `<div class="detalhe-item"><span class="detalhe-icon">🛫</span><span>${flight.airline_name}</span></div>` : ''}
                ${outrasHtml}
            </div>
            <div class="destino-acao">
                ${custoHtml}
                <a href="${gfUrl}" target="_blank" rel="noopener" class="btn-google-flights">${icon} Ver no Google Flights</a>
            </div>
        </div>`;
    },

    _tripinhaMsg(todos, orc, moeda, flex, nC, escopo) {
        const dentro = todos.filter(d => d.flight.price <= orc).length;
        const fora = todos.length - dentro;
        const cheap = todos[0];
        const fMsg = flex ? ` Pesquisei ${nC} combinações!` : '';
        const eMsg = escopo === 'brasil' ? ' no Brasil' : escopo === 'internacional' ? ' internacionais' : '';
        if (!dentro) return `🐕 Nenhum destino${eMsg} no orçamento de ${this.formatarPreco(orc, moeda)}.${fMsg} O mais barato é ${this.formatarPreco(cheap.flight.price, moeda)}. Use os filtros!`;
        if (dentro === todos.length) return `🐕 Todos os ${todos.length} destinos${eMsg} cabem no orçamento!${fMsg} Use os filtros para refinar!`;
        return `🐕 ${dentro} destinos${eMsg} no orçamento e ${fora} acima.${fMsg} Use os filtros para encontrar o destino perfeito!`;
    },

    // ================================================================
    // GOOGLE FLIGHTS PROTOBUF
    // ================================================================
    _protoVarint(n) { const b = []; let v = n >>> 0; while (v > 127) { b.push((v & 0x7f) | 0x80); v >>>= 7; } b.push(v & 0x7f); return b; },
    _protoTag(f, w) { return this._protoVarint((f << 3) | w); },
    _protoVarintField(f, v) { return [...this._protoTag(f, 0), ...this._protoVarint(v)]; },
    _protoStringField(f, s) { const e = new TextEncoder().encode(s); return [...this._protoTag(f, 2), ...this._protoVarint(e.length), ...e]; },
    _protoMessageField(f, m) { return [...this._protoTag(f, 2), ...this._protoVarint(m.length), ...m]; },
    _toBase64Url(b) { return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    _buildAirport(c) { return [...this._protoVarintField(1, 1), ...this._protoStringField(2, c)]; },
    _buildFlightLeg(d, o, de) { return [...this._protoStringField(2, d), ...this._protoMessageField(13, this._buildAirport(o)), ...this._protoMessageField(14, this._buildAirport(de))]; },
    _buildTfsParam(o, d, dep, ret) { return this._toBase64Url([...this._protoVarintField(1, 28), ...this._protoVarintField(2, 2), ...this._protoMessageField(3, this._buildFlightLeg(dep, o, d)), ...this._protoMessageField(3, this._buildFlightLeg(ret, d, o)), ...this._protoVarintField(14, 1)]); },
    _buildTfuParam(a, c, i) { return this._toBase64Url(this._protoMessageField(2, [...this._protoVarintField(1, a), ...this._protoVarintField(2, c), ...this._protoVarintField(3, i)])); },

    buildGoogleFlightsUrl(o, d, dep, ret, cur) {
        const p = new URLSearchParams();
        p.set('tfs', this._buildTfsParam(o, d, dep, ret));
        p.set('tfu', this._buildTfuParam(1, 0, 0));
        p.set('curr', { BRL: 'BRL', USD: 'USD', EUR: 'EUR' }[cur] || 'BRL');
        p.set('hl', { BRL: 'pt-BR', USD: 'en', EUR: 'en' }[cur] || 'pt-BR');
        p.set('gl', { BRL: 'br', USD: 'us', EUR: 'de' }[cur] || 'br');
        return `https://www.google.com/travel/flights/search?${p.toString()}`;
    },

    // ================================================================
    // HELPERS
    // ================================================================
    getSimbolo(m) { return { BRL: 'R$', USD: 'US$', EUR: '€' }[m] || 'R$'; },
    formatarPreco(v, m) { return `${this.getSimbolo(m || this.state.formData.moeda)} ${Math.round(v).toLocaleString('pt-BR')}`; },
    calcularNoites(i, v) { return Math.ceil((new Date(v) - new Date(i)) / 86400000); },
    formatarDataISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
    formatarDataBR(d) { return d.toLocaleDateString('pt-BR'); },
    formatarDataCurta(i) { return new Date(i + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); },
    formatarDataCompletaBR(i) { return new Date(i + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); },
    delay(ms) { return new Promise(r => setTimeout(r, ms)); },
    mostrarLoading() { document.getElementById('form-container').style.display = 'none'; document.getElementById('loading-container').style.display = 'block'; document.getElementById('resultados-container').style.display = 'none'; window.scrollTo({ top: 0, behavior: 'smooth' }); },
    esconderLoading() { document.getElementById('loading-container').style.display = 'none'; document.getElementById('form-container').style.display = 'block'; },
    atualizarProgresso(p, m) { document.getElementById('progress-fill').style.width = `${p}%`; document.getElementById('loading-message').textContent = m; },
    voltarAoFormulario() { document.getElementById('resultados-container').style.display = 'none'; document.getElementById('resultados-container').innerHTML = ''; document.getElementById('form-container').style.display = 'block'; this.state.filtrosAberto = false; document.body.classList.remove('filtros-open'); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    mostrarSemResultados() {
        const c = document.getElementById('resultados-container');
        const { origem } = this.state.formData;
        c.innerHTML = `<button class="btn-voltar-topo" onclick="BenetripTodosDestinos.voltarAoFormulario()"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> Nova busca</button><div class="sem-resultados"><img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha" onerror="this.style.display='none'"><h2>😕 Nenhum destino encontrado</h2><p>Nenhum voo de <strong>${origem.name} (${origem.code})</strong>.</p><button class="btn-tentar-novamente" onclick="BenetripTodosDestinos.voltarAoFormulario()">✏️ Tentar Novamente</button></div>`;
        document.getElementById('loading-container').style.display = 'none';
        c.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

document.addEventListener('DOMContentLoaded', () => BenetripTodosDestinos.init());
