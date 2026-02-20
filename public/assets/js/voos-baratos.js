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
        mesSelecionado: null, // mês clicado no gráfico (YYYY-MM)
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
            this.log('✈️ Voos enriquecidos:', data._meta?.enrichedCount || 0);

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

            <!-- RESUMO DA VIAGEM -->
            <div class="trip-summary fade-in">
                <div class="trip-summary-route">
                    <div class="trip-summary-city">
                        <span class="trip-summary-code">${origemSelecionada.code}</span>
                        <span class="trip-summary-name">${origemSelecionada.name}</span>
                    </div>
                    <div class="trip-summary-arrow">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                    </div>
                    <div class="trip-summary-city">
                        <span class="trip-summary-code">${destinoSelecionado.code}</span>
                        <span class="trip-summary-name">${destinoSelecionado.name}</span>
                    </div>
                </div>
                <div class="trip-summary-meta">
                    <span class="trip-meta-chip">📅 ${duracaoSelecionada} dias</span>
                    <span class="trip-meta-chip">💱 ${moedaSelecionada}</span>
                    <span class="trip-meta-chip">🔍 ${data.stats.totalDates} períodos analisados</span>
                    <span class="trip-meta-chip">📆 Próximos 6 meses</span>
                </div>
            </div>

            <!-- WINNER CARD -->
            <div class="winner-card fade-in" style="animation-delay: 0.05s">
                <div class="winner-badge">🏆 PERÍODO MAIS BARATO</div>
                <div class="winner-price">${simbolo} ${cheapest.price.toLocaleString('pt-BR')}</div>
                <div class="winner-price-label">ida e volta por pessoa</div>
                ${this._renderWinnerFlightDetails(cheapest)}
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
                <p class="chart-hint">👆 Clique em um mês para ver todos os períodos disponíveis</p>
                <div class="chart-bars" id="chart-bars">
                    ${this.renderChart(data.monthlyData, simbolo)}
                </div>
            </div>

            <!-- DETALHE DO MÊS SELECIONADO (aparece ao clicar na barra) -->
            <div class="month-detail-section" id="month-detail" style="display:none">
                <!-- Preenchido dinamicamente por selectMonth() -->
            </div>

            <!-- TOP 10 -->
            <div class="top-list-section fade-in" style="animation-delay: 0.25s">
                <h3 class="top-list-title">🏅 Top 10 Períodos Mais Baratos</h3>
                <div class="top-list">
                    ${data.top10.map((item, idx) => this.renderTopItem(item, idx, simbolo)).join('')}
                </div>
            </div>

            <!-- COMPARTILHAR -->
            <div class="share-section fade-in" style="animation-delay: 0.3s">
                <h3 class="share-title">📤 Compartilhar resultado</h3>
                <p class="share-subtitle">Envie pra quem vai viajar com você!</p>
                <div class="share-buttons">
                    <button class="btn-share btn-share-whatsapp" onclick="BenetripVoosBaratos.shareWhatsApp()">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                    </button>
                    <button class="btn-share btn-share-copy" onclick="BenetripVoosBaratos.copyShareText()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        Copiar texto
                    </button>
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
    // RENDER: Winner flight details (inside green card)
    // ================================================================
    _renderWinnerFlightDetails(cheapest) {
        const fd = cheapest.flight_details;
        if (!fd) return '';

        const durationH = Math.floor(fd.total_duration / 60);
        const durationM = fd.total_duration % 60;
        const durationStr = durationM > 0 ? `${durationH}h${durationM}min` : `${durationH}h`;
        const stopsStr = fd.stops === 0 ? 'Direto' : fd.stops === 1 ? '1 parada' : `${fd.stops} paradas`;
        const airlinesStr = fd.airlines.join(', ');

        const logosHtml = fd.airline_logos.slice(0, 2).map(logo =>
            `<img src="${logo}" alt="" style="width:24px;height:24px;border-radius:4px;background:#fff;" onerror="this.style.display='none'">`
        ).join('');

        return `
            <div class="winner-flight-details">
                <div class="winner-detail-chip">${logosHtml} ${airlinesStr}</div>
                <div class="winner-detail-chip">⏱️ ${durationStr}</div>
                <div class="winner-detail-chip">${fd.stops === 0 ? '✅' : '🔄'} ${stopsStr}</div>
            </div>
        `;
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
                         data-month="${m.month}"
                         style="height: 0%"
                         onclick="BenetripVoosBaratos.selectMonth('${m.month}')"
                         title="Clique para ver todas as opções de ${monthLabel}">
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

        // Flight details (when enriched)
        let detailsHtml = '';
        const fd = item.flight_details;
        if (fd) {
            const durationH = Math.floor(fd.total_duration / 60);
            const durationM = fd.total_duration % 60;
            const durationStr = durationM > 0 ? `${durationH}h${durationM}min` : `${durationH}h`;
            const stopsStr = fd.stops === 0 ? 'Direto' : fd.stops === 1 ? '1 parada' : `${fd.stops} paradas`;
            const airlinesStr = fd.airlines.join(', ');

            // Airline logos
            const logosHtml = fd.airline_logos.slice(0, 2).map(logo =>
                `<img src="${logo}" alt="" class="detail-airline-logo" onerror="this.style.display='none'">`
            ).join('');

            // Price insights badge
            let insightBadge = '';
            if (fd.price_insights && fd.price_insights.price_level) {
                const levelMap = {
                    'low': { text: 'Preço baixo', cls: 'insight-low' },
                    'typical': { text: 'Preço típico', cls: 'insight-typical' },
                    'high': { text: 'Preço alto', cls: 'insight-high' },
                };
                const lvl = levelMap[fd.price_insights.price_level];
                if (lvl) {
                    insightBadge = `<span class="insight-badge ${lvl.cls}">${lvl.text}</span>`;
                }
            }

            detailsHtml = `
                <div class="top-item-details">
                    <div class="detail-chip">
                        ${logosHtml}
                        <span>${airlinesStr}</span>
                    </div>
                    <div class="detail-chip">
                        <span class="detail-icon">⏱️</span>
                        <span>${durationStr}</span>
                    </div>
                    <div class="detail-chip">
                        <span class="detail-icon">${fd.stops === 0 ? '✅' : '🔄'}</span>
                        <span>${stopsStr}</span>
                    </div>
                    ${insightBadge}
                </div>
            `;
        }

        return `
            <div class="top-item ${idx === 0 ? 'rank-1' : ''}">
                <div class="top-rank">${idx + 1}</div>
                <div class="top-info">
                    <div class="top-dates">
                        ${this.formatDateBR(item.departure)} → ${this.formatDateBR(item.return)}
                    </div>
                    <div class="top-weekday">${depWeekday} a ${retWeekday}</div>
                    ${detailsHtml}
                </div>
                <div class="top-price">${simbolo} ${item.price.toLocaleString('pt-BR')}</div>
                <a href="${url}" target="_blank" rel="noopener" class="top-link" title="Ver no Google Flights">
                    ${svgArrow}
                </a>
            </div>
        `;
    },

    // ================================================================
    // SELECIONAR MÊS NO GRÁFICO
    // ================================================================
    selectMonth(monthKey) {
        const data = this.state.resultados;
        if (!data || !data.prices) return;

        const { origemSelecionada, destinoSelecionado, moedaSelecionada } = this.state;
        const simbolo = this.getSimbolo(moedaSelecionada);
        this.state.mesSelecionado = monthKey;

        // Filtrar preços deste mês e ordenar
        const monthPrices = data.prices
            .filter(p => p.departure && p.departure.startsWith(monthKey))
            .sort((a, b) => a.price - b.price);

        // Highlight visual na barra selecionada
        document.querySelectorAll('.chart-bar').forEach(bar => {
            bar.classList.remove('selected');
            if (bar.dataset.month === monthKey) bar.classList.add('selected');
        });

        const monthNames = {
            '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
            '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
            '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
        };
        const monthNum = monthKey.split('-')[1];
        const monthLabel = monthNames[monthNum] || monthKey;

        const container = document.getElementById('month-detail');

        if (monthPrices.length === 0) {
            container.innerHTML = `
                <div class="month-detail-header">
                    <h3>📅 ${monthLabel}</h3>
                    <button class="btn-close-month" onclick="BenetripVoosBaratos.closeMonthDetail()">✕</button>
                </div>
                <p style="text-align:center;color:#666;padding:20px;">Nenhum período disponível neste mês.</p>
            `;
            container.style.display = 'block';
            container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        const cheapestInMonth = monthPrices[0].price;
        const avgInMonth = Math.round(monthPrices.reduce((s, p) => s + p.price, 0) / monthPrices.length);

        container.innerHTML = `
            <div class="month-detail-header">
                <div>
                    <h3>📅 ${monthLabel} — ${monthPrices.length} período${monthPrices.length > 1 ? 's' : ''}</h3>
                    <span class="month-detail-stats">
                        Mais barato: <strong style="color:var(--green)">${simbolo} ${cheapestInMonth.toLocaleString('pt-BR')}</strong>
                        · Média: <strong style="color:var(--blue)">${simbolo} ${avgInMonth.toLocaleString('pt-BR')}</strong>
                    </span>
                </div>
                <button class="btn-close-month" onclick="BenetripVoosBaratos.closeMonthDetail()">✕</button>
            </div>
            <div class="month-detail-list">
                ${monthPrices.map((item, idx) => this.renderTopItem(item, idx, simbolo)).join('')}
            </div>
        `;

        container.style.display = 'block';
        container.classList.add('fade-in');
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        this.log(`📅 Mês selecionado: ${monthLabel} (${monthPrices.length} opções)`);
    },

    closeMonthDetail() {
        const container = document.getElementById('month-detail');
        container.style.display = 'none';
        this.state.mesSelecionado = null;
        // Remove highlight de barras
        document.querySelectorAll('.chart-bar').forEach(bar => bar.classList.remove('selected'));
    },

    // ================================================================
    // COMPARTILHAR VIA WHATSAPP
    // ================================================================
    _buildShareText() {
        const data = this.state.resultados;
        if (!data || !data.stats) return null;

        const { origemSelecionada, destinoSelecionado, duracaoSelecionada, moedaSelecionada } = this.state;
        const simbolo = this.getSimbolo(moedaSelecionada);
        const cheapest = data.stats.cheapest;

        const googleUrl = this.buildGoogleFlightsUrl(
            origemSelecionada.code,
            destinoSelecionado.code,
            cheapest.departure,
            cheapest.return,
            moedaSelecionada
        );

        let text = `✈️ *Voos baratos encontrados pela Benetrip!*\n\n`;
        text += `📍 ${origemSelecionada.name} (${origemSelecionada.code}) → ${destinoSelecionado.name} (${destinoSelecionado.code})\n`;
        text += `📅 ${duracaoSelecionada} dias de viagem\n\n`;
        text += `🏆 *Período mais barato:*\n`;
        text += `💰 *${simbolo} ${cheapest.price.toLocaleString('pt-BR')}* ida e volta\n`;
        text += `📆 ${this.formatDateBR(cheapest.departure)} → ${this.formatDateBR(cheapest.return)}\n`;

        // Flight details if available
        if (cheapest.flight_details) {
            const fd = cheapest.flight_details;
            const dH = Math.floor(fd.total_duration / 60);
            const dM = fd.total_duration % 60;
            const durStr = dM > 0 ? `${dH}h${dM}min` : `${dH}h`;
            const stopsStr = fd.stops === 0 ? 'Direto' : fd.stops === 1 ? '1 parada' : `${fd.stops} paradas`;
            text += `🛫 ${fd.airlines.join(', ')} · ${durStr} · ${stopsStr}\n`;
        }

        text += '\n';

        // Top 3
        if (data.top10 && data.top10.length > 1) {
            text += `🥈 2º melhor: ${simbolo} ${data.top10[1].price.toLocaleString('pt-BR')} (${this.formatDateBR(data.top10[1].departure)})\n`;
        }
        if (data.top10 && data.top10.length > 2) {
            text += `🥉 3º melhor: ${simbolo} ${data.top10[2].price.toLocaleString('pt-BR')} (${this.formatDateBR(data.top10[2].departure)})\n`;
        }

        text += `\n🔗 Ver no Google Flights:\n${googleUrl}\n`;
        text += `\n🐕 Pesquisado em benetrip.com.br`;

        return text;
    },

    shareWhatsApp() {
        const text = this._buildShareText();
        if (!text) return;

        const encoded = encodeURIComponent(text);
        const url = `https://api.whatsapp.com/send?text=${encoded}`;
        window.open(url, '_blank');

        this.log('📤 Compartilhado via WhatsApp');
    },

    copyShareText() {
        const text = this._buildShareText();
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            // Feedback visual
            const btn = document.querySelector('.btn-share-copy');
            if (btn) {
                const original = btn.innerHTML;
                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado!`;
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.innerHTML = original;
                    btn.classList.remove('copied');
                }, 2000);
            }
            this.log('📋 Texto copiado');
        }).catch(() => {
            // Fallback: selecionar texto em prompt
            prompt('Copie o texto abaixo:', text);
        });
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
