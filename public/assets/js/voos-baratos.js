/**
 * BENETRIP - VOOS BARATOS
 * Encontre o período mais barato para viajar!
 * Versão: Calendar Heatmap v1.0
 */

const BenetripVoosBaratos = {
    state: {
        cidadesData: null,
        origemSelecionada: null,
        destinoSelecionado: null,
        duracaoSelecionada: 7,
        moedaSelecionada: 'BRL',
        resultados: null,
    },

    config: {
        debug: true,
        cidadesJsonPath: 'data/cidades_global_iata_v5.json',
    },

    log(...args) {
        if (this.config.debug) console.log('[VoosBaratos]', ...args);
    },

    // ================================================================
    // INICIALIZAÇÃO
    // ================================================================
    init() {
        this.log('🐕 Benetrip Voos Baratos v1.0 inicializando...');
        this.carregarCidades();
        this.setupAutocomplete('origem', 'origem-results', 'origem-data', 'origemSelecionada');
        this.setupAutocomplete('destino', 'destino-results', 'destino-data', 'destinoSelecionado');
        this.setupDurationChips();
        this.setupCurrencyChips();
        this.setupForm();
        this.log('✅ Pronto!');
    },

    // ================================================================
    // CARREGAR CIDADES
    // ================================================================
    async carregarCidades() {
        try {
            const response = await fetch(this.config.cidadesJsonPath);
            if (!response.ok) throw new Error('Erro ao carregar cidades');
            const dados = await response.json();
            this.state.cidadesData = dados.filter(c => c.iata);
            this.log(`✅ ${this.state.cidadesData.length} cidades carregadas`);
        } catch (err) {
            this.log('⚠️ Usando fallback de cidades');
            this.state.cidadesData = [
                { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", codigo_pais: "BR", iata: "GRU", aeroporto: "Aeroporto de Guarulhos" },
                { cidade: "Rio de Janeiro", sigla_estado: "RJ", pais: "Brasil", codigo_pais: "BR", iata: "GIG", aeroporto: "Aeroporto do Galeão" },
                { cidade: "Lisboa", pais: "Portugal", codigo_pais: "PT", iata: "LIS", aeroporto: "Aeroporto de Lisboa" },
                { cidade: "Miami", pais: "Estados Unidos", codigo_pais: "US", iata: "MIA", aeroporto: "Miami International" },
                { cidade: "Buenos Aires", pais: "Argentina", codigo_pais: "AR", iata: "EZE", aeroporto: "Ezeiza" },
                { cidade: "Paris", pais: "França", codigo_pais: "FR", iata: "CDG", aeroporto: "Charles de Gaulle" },
                { cidade: "Londres", pais: "Reino Unido", codigo_pais: "GB", iata: "LHR", aeroporto: "Heathrow" },
                { cidade: "Santiago", pais: "Chile", codigo_pais: "CL", iata: "SCL", aeroporto: "Arturo Merino Benítez" },
                { cidade: "Orlando", pais: "Estados Unidos", codigo_pais: "US", iata: "MCO", aeroporto: "Orlando International" },
                { cidade: "Roma", pais: "Itália", codigo_pais: "IT", iata: "FCO", aeroporto: "Fiumicino" },
                { cidade: "Salvador", sigla_estado: "BA", pais: "Brasil", codigo_pais: "BR", iata: "SSA" },
                { cidade: "Recife", sigla_estado: "PE", pais: "Brasil", codigo_pais: "BR", iata: "REC" },
            ];
        }
    },

    normalizarTexto(texto) {
        return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    },

    buscarCidades(termo) {
        if (!this.state.cidadesData || termo.length < 2) return [];
        const termoNorm = this.normalizarTexto(termo);
        return this.state.cidadesData
            .filter(c => {
                const nomeNorm = this.normalizarTexto(c.cidade);
                const iataNorm = c.iata.toLowerCase();
                const aeroNorm = c.aeroporto ? this.normalizarTexto(c.aeroporto) : '';
                return nomeNorm.includes(termoNorm) || iataNorm.includes(termoNorm) || aeroNorm.includes(termoNorm);
            })
            .slice(0, 8)
            .map(c => ({
                code: c.iata,
                name: c.cidade,
                state: c.sigla_estado || null,
                country: c.pais,
                countryCode: c.codigo_pais,
                airport: c.aeroporto || null,
            }));
    },

    // ================================================================
    // AUTOCOMPLETE (reutilizável para origem e destino)
    // ================================================================
    setupAutocomplete(inputId, resultsId, hiddenId, stateKey) {
        const input = document.getElementById(inputId);
        const results = document.getElementById(resultsId);
        const hidden = document.getElementById(hiddenId);
        let timer;

        input.addEventListener('input', (e) => {
            clearTimeout(timer);
            const termo = e.target.value.trim();

            if (termo.length < 2) {
                results.style.display = 'none';
                results.innerHTML = '';
                this.state[stateKey] = null;
                hidden.value = '';
                return;
            }

            timer = setTimeout(() => {
                const cidades = this.buscarCidades(termo);

                if (cidades.length === 0) {
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
                    </div>
                `).join('');

                results.style.display = 'block';

                results.querySelectorAll('.autocomplete-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const cidade = JSON.parse(item.dataset.city);
                        this.state[stateKey] = cidade;
                        input.value = cidade.airport
                            ? `${cidade.name} — ${cidade.airport} (${cidade.code})`
                            : `${cidade.name} (${cidade.code})`;
                        hidden.value = JSON.stringify(cidade);
                        results.style.display = 'none';
                        this.log(`📍 ${stateKey}:`, cidade.code);
                    });
                });
            }, 250);
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !results.contains(e.target)) {
                results.style.display = 'none';
            }
        });
    },

    // ================================================================
    // CHIPS: Duração
    // ================================================================
    setupDurationChips() {
        document.querySelectorAll('.chip[data-days]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.chip[data-days]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.duracaoSelecionada = parseInt(chip.dataset.days);
                this.log('📅 Duração:', this.state.duracaoSelecionada, 'dias');
            });
        });
        // Selecionar 7 por padrão
        document.querySelector('.chip[data-days="7"]')?.classList.add('active');
    },

    // ================================================================
    // CHIPS: Moeda
    // ================================================================
    setupCurrencyChips() {
        document.querySelectorAll('.currency-chip[data-currency]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.currency-chip[data-currency]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.moedaSelecionada = chip.dataset.currency;
                this.log('💱 Moeda:', this.state.moedaSelecionada);
            });
        });
        document.querySelector('.currency-chip[data-currency="BRL"]')?.classList.add('active');
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
        if (!this.state.origemSelecionada) {
            alert('Selecione a cidade de origem');
            document.getElementById('origem').focus();
            return false;
        }
        if (!this.state.destinoSelecionado) {
            alert('Selecione a cidade de destino');
            document.getElementById('destino').focus();
            return false;
        }
        if (this.state.origemSelecionada.code === this.state.destinoSelecionado.code) {
            alert('Origem e destino devem ser diferentes');
            return false;
        }
        return true;
    },

    // ================================================================
    // BUSCAR VOOS BARATOS
    // ================================================================
    async buscar() {
        const { origemSelecionada, destinoSelecionado, duracaoSelecionada, moedaSelecionada } = this.state;

        this.showLoading();
        this.updateProgress(10, '🔍 Preparando busca nos próximos 6 meses...');

        try {
            this.updateProgress(25, `✈️ Pesquisando ${origemSelecionada.code} → ${destinoSelecionado.code}...`);

            const response = await fetch('/api/cheapest-flights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origem: origemSelecionada.code,
                    destino: destinoSelecionado.code,
                    duracao: duracaoSelecionada,
                    moeda: moedaSelecionada,
                }),
            });

            this.updateProgress(70, '📊 Analisando preços por período...');

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Erro na busca');
            }

            const data = await response.json();

            if (!data.success || !data.prices || data.prices.length === 0) {
                throw new Error(data.message || 'Nenhum voo encontrado para esta rota');
            }

            this.state.resultados = data;
            this.log('✅ Resultados:', data.stats);

            this.updateProgress(100, '🎉 Pronto!');
            await this.delay(400);

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
        const { origemSelecionada, destinoSelecionado, duracaoSelecionada, moedaSelecionada } = this.state;
        const simbolo = this.getSimbolo(moedaSelecionada);
        const cheapest = data.stats.cheapest;

        // Tripinha dica
        const saving = data.stats.mostExpensive.price - cheapest.price;
        const savingPct = Math.round((saving / data.stats.mostExpensive.price) * 100);

        const tipText = savingPct > 30
            ? `<strong>Wow!</strong> Viajando no período mais barato você economiza <strong>${simbolo} ${saving.toLocaleString('pt-BR')}</strong> (${savingPct}% a menos) comparado ao mais caro! Vale a pena ser flexível! 🐾`
            : savingPct > 10
            ? `A diferença entre o mais barato e o mais caro é de <strong>${simbolo} ${saving.toLocaleString('pt-BR')}</strong>. Nem sempre dá pra ser flexível, mas cada real conta! 🐾`
            : `Os preços estão bem estáveis para esta rota! Praticamente qualquer período tem um bom preço. Que sorte! 🎉`;

        const html = `
            <button class="btn-back" onclick="BenetripVoosBaratos.showForm()">
                ← Nova busca
            </button>

            <!-- WINNER CARD -->
            <div class="winner-card fade-in">
                <div class="winner-badge">🏆 PERÍODO MAIS BARATO</div>
                <div class="winner-price">${simbolo} ${cheapest.price.toLocaleString('pt-BR')}</div>
                <div class="winner-price-label">ida e volta por pessoa</div>
                <div class="winner-dates">
                    <div class="winner-date-item">
                        <div class="winner-date-label">Ida</div>
                        <div class="winner-date-value">${this.formatDateBR(cheapest.departure)}</div>
                    </div>
                    <div class="winner-arrow">→</div>
                    <div class="winner-date-item">
                        <div class="winner-date-label">Volta</div>
                        <div class="winner-date-value">${this.formatDateBR(cheapest.return)}</div>
                    </div>
                </div>
                <a href="${this.buildGoogleFlightsUrl(origemSelecionada.code, destinoSelecionado.code, cheapest.departure, cheapest.return, moedaSelecionada)}" 
                   target="_blank" rel="noopener" class="winner-cta">
                    ✈️ Ver no Google Flights
                </a>
            </div>

            <!-- STATS -->
            <div class="stats-row fade-in" style="animation-delay: 0.1s">
                <div class="stat-card">
                    <div class="stat-card-label">Mais barato</div>
                    <div class="stat-card-value green">${simbolo} ${data.stats.cheapest.price.toLocaleString('pt-BR')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Média</div>
                    <div class="stat-card-value blue">${simbolo} ${data.stats.average.toLocaleString('pt-BR')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Mais caro</div>
                    <div class="stat-card-value orange">${simbolo} ${data.stats.mostExpensive.price.toLocaleString('pt-BR')}</div>
                </div>
            </div>

            <!-- TRIPINHA TIP -->
            <div class="tripinha-tip fade-in" style="animation-delay: 0.15s">
                <img src="assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="tripinha-tip-avatar"
                     onerror="this.style.display='none'">
                <div class="tripinha-tip-text">${tipText}</div>
            </div>

            <!-- GRÁFICO MENSAL -->
            <div class="chart-section fade-in" style="animation-delay: 0.2s">
                <h3 class="chart-title">📊 Preço mais barato por mês</h3>
                <div class="chart-bars" id="chart-bars">
                    ${this.renderChart(data.monthlyData, simbolo)}
                </div>
            </div>

            <!-- TOP 10 -->
            <div class="top-list-section fade-in" style="animation-delay: 0.25s">
                <h3 class="top-list-title">🏅 Top 10 Períodos Mais Baratos</h3>
                <div class="top-list">
                    ${data.top10.map((item, idx) => this.renderTopItem(item, idx, simbolo)).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Animar barras do gráfico
        requestAnimationFrame(() => {
            setTimeout(() => this.animateChartBars(), 300);
        });

        this.showResults();
    },

    // ================================================================
    // RENDER: Gráfico de barras
    // ================================================================
    renderChart(monthlyData, simbolo) {
        if (!monthlyData || monthlyData.length === 0) return '<p>Sem dados mensais</p>';

        const maxPrice = Math.max(...monthlyData.map(m => m.cheapest));
        const minPrice = Math.min(...monthlyData.map(m => m.cheapest));

        const monthNames = {
            '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
            '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
            '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
        };

        return monthlyData.map(m => {
            const heightPct = maxPrice > 0 ? Math.max(10, (m.cheapest / maxPrice) * 100) : 10;
            const monthNum = m.month.split('-')[1];
            const monthLabel = monthNames[monthNum] || monthNum;
            const isCheapest = m.cheapest === minPrice;
            const isExpensive = m.cheapest === maxPrice && monthlyData.length > 1;
            const barClass = isCheapest ? 'cheapest' : isExpensive ? 'expensive' : 'normal';

            return `
                <div class="chart-bar-wrapper">
                    <div class="chart-bar ${barClass}" 
                         data-height="${heightPct}"
                         style="height: 0%"
                         title="${simbolo} ${m.cheapest.toLocaleString('pt-BR')} - ${monthLabel}">
                        <span class="chart-bar-price">${simbolo} ${m.cheapest.toLocaleString('pt-BR')}</span>
                    </div>
                    <span class="chart-bar-month">${monthLabel}</span>
                </div>
            `;
        }).join('');
    },

    animateChartBars() {
        document.querySelectorAll('.chart-bar[data-height]').forEach((bar, idx) => {
            setTimeout(() => {
                bar.style.height = bar.dataset.height + '%';
            }, idx * 80);
        });
    },

    // ================================================================
    // RENDER: Top item
    // ================================================================
    renderTopItem(item, idx, simbolo) {
        const { origemSelecionada, destinoSelecionado, moedaSelecionada } = this.state;
        const url = this.buildGoogleFlightsUrl(
            origemSelecionada.code,
            destinoSelecionado.code,
            item.departure,
            item.return,
            moedaSelecionada
        );

        const depDate = new Date(item.departure + 'T12:00:00');
        const retDate = new Date(item.return + 'T12:00:00');
        const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const depWeekday = weekdays[depDate.getDay()];
        const retWeekday = weekdays[retDate.getDay()];

        const svgArrow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>`;

        return `
            <div class="top-item ${idx === 0 ? 'rank-1' : ''}">
                <div class="top-rank">${idx + 1}</div>
                <div class="top-info">
                    <div class="top-dates">
                        ${this.formatDateBR(item.departure)} → ${this.formatDateBR(item.return)}
                    </div>
                    <div class="top-weekday">${depWeekday} a ${retWeekday}</div>
                </div>
                <div class="top-price">${simbolo} ${item.price.toLocaleString('pt-BR')}</div>
                <a href="${url}" target="_blank" rel="noopener" class="top-link" title="Ver no Google Flights">
                    ${svgArrow}
                </a>
            </div>
        `;
    },

    // ================================================================
    // GOOGLE FLIGHTS URL (Protobuf)
    // ================================================================
    _protoVarint(n) {
        const bytes = [];
        let v = n >>> 0;
        while (v > 127) { bytes.push((v & 0x7f) | 0x80); v >>>= 7; }
        bytes.push(v & 0x7f);
        return bytes;
    },
    _protoTag(fn, wt) { return this._protoVarint((fn << 3) | wt); },
    _protoVarintField(fn, val) { return [...this._protoTag(fn, 0), ...this._protoVarint(val)]; },
    _protoStringField(fn, str) {
        const enc = new TextEncoder().encode(str);
        return [...this._protoTag(fn, 2), ...this._protoVarint(enc.length), ...enc];
    },
    _protoMessageField(fn, msg) {
        return [...this._protoTag(fn, 2), ...this._protoVarint(msg.length), ...msg];
    },
    _toBase64Url(bytes) {
        return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    _buildAirport(iata) {
        return [...this._protoVarintField(1, 1), ...this._protoStringField(2, iata)];
    },
    _buildFlightLeg(date, orig, dest) {
        return [
            ...this._protoStringField(2, date),
            ...this._protoMessageField(13, this._buildAirport(orig)),
            ...this._protoMessageField(14, this._buildAirport(dest)),
        ];
    },

    buildGoogleFlightsUrl(orig, dest, depDate, retDate, moeda) {
        const tfsBytes = [
            ...this._protoVarintField(1, 28),
            ...this._protoVarintField(2, 2),
            ...this._protoMessageField(3, this._buildFlightLeg(depDate, orig, dest)),
            ...this._protoMessageField(3, this._buildFlightLeg(retDate, dest, orig)),
            ...this._protoVarintField(14, 1),
        ];
        const tfs = this._toBase64Url(tfsBytes);

        const tfuInner = [...this._protoVarintField(1, 1), ...this._protoVarintField(2, 0), ...this._protoVarintField(3, 0)];
        const tfu = this._toBase64Url(this._protoMessageField(2, tfuInner));

        const currMap = { 'BRL': 'BRL', 'USD': 'USD', 'EUR': 'EUR' };
        const hlMap = { 'BRL': 'pt-BR', 'USD': 'en', 'EUR': 'en' };
        const glMap = { 'BRL': 'br', 'USD': 'us', 'EUR': 'de' };

        const params = new URLSearchParams();
        params.set('tfs', tfs);
        params.set('tfu', tfu);
        params.set('curr', currMap[moeda] || 'BRL');
        params.set('hl', hlMap[moeda] || 'pt-BR');
        params.set('gl', glMap[moeda] || 'br');

        return `https://www.google.com/travel/flights/search?${params.toString()}`;
    },

    // ================================================================
    // HELPERS
    // ================================================================
    getSimbolo(moeda) {
        return { 'BRL': 'R$', 'USD': 'US$', 'EUR': '€' }[moeda] || 'R$';
    },

    formatDateBR(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    },

    // ================================================================
    // UI STATE
    // ================================================================
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

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => BenetripVoosBaratos.init());
