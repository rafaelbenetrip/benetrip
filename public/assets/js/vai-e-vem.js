/**
 * BENETRIP - VAI E VEM
 * Preços da sua rota recorrente (família, amor à distância, trabalho, estudo)
 * nos dias da semana que você escolher, pelos próximos meses.
 * Versão: v1.0
 */

const BenetripVaiEVem = {
    // Método único de normalização monetária (benetrip-shared-ui.js). Sem ele,
    // o mesmo valor aparecia como R$ 786 num ponto e R$ 787 em outro.
    fmtValor(v) {
        if (window.BenetripPrice) return window.BenetripPrice.formatarValor(v);
        return Math.round(Number(v) || 0).toLocaleString('pt-BR');
    },

    esc(t) {
        if (window.BenetripSafe) return window.BenetripSafe.escapeHtml(t);
        return String(t === null || t === undefined ? '' : t)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    state: {
        origemSelecionada: null,
        destinoSelecionado: null,
        diasIda: new Set([4, 5]),   // qui, sex
        diasVolta: new Set([0, 1]), // dom, seg
        mesesSelecionados: 2,
        moedaSelecionada: 'BRL',
        resultados: null,
    },

    DIAS_CURTO: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],

    config: {
        debug: true,
    },

    log(...args) {
        if (this.config.debug) console.log('[VaiEVem]', ...args);
    },

    // ================================================================
    // INICIALIZAÇÃO
    // ================================================================
    init() {
        this.log('🔁 Benetrip Vai e Vem v1.0 inicializando...');
        this.setupAutocomplete('origem', 'origem-results', 'origem-data', 'origemSelecionada');
        this.setupAutocomplete('destino', 'destino-results', 'destino-data', 'destinoSelecionado');
        this.setupDiasChips('dias-ida', 'diasIda');
        this.setupDiasChips('dias-volta', 'diasVolta');
        this.setupMesesChips();
        this.setupCurrencyChips();
        this.setupForm();
        this.preencherViaURL();
        this.log('✅ Pronto!');
    },

    // ================================================================
    // PRÉ-PREENCHIMENTO VIA URL
    // Params: ?origem=GRU&destino=REC
    // ================================================================
    async preencherViaURL() {
        const params = new URLSearchParams(window.location.search);
        const origemCode = params.get('origem');
        const destinoCode = params.get('destino');
        if (!origemCode && !destinoCode) return;

        if (origemCode) {
            const cidade = await this.encontrarCidadePorCodigo(origemCode);
            if (cidade) this.selecionarCidade('origem', 'origem-data', 'origemSelecionada', cidade);
        }
        if (destinoCode) {
            const cidade = await this.encontrarCidadePorCodigo(destinoCode);
            if (cidade) this.selecionarCidade('destino', 'destino-data', 'destinoSelecionado', cidade);
        }
    },

    async encontrarCidadePorCodigo(code) {
        const codeUpper = code.toUpperCase();
        const { results } = await BenetripPlaces.search(codeUpper);
        const hit = results.find(p => p.code === codeUpper) || results[0] || null;
        return hit ? BenetripPlaces.toLegacy(hit) : null;
    },

    selecionarCidade(inputId, hiddenId, stateKey, cidade) {
        const input = document.getElementById(inputId);
        const hidden = document.getElementById(hiddenId);
        if (!input || !hidden) return;

        this.state[stateKey] = cidade;
        const codeDisplay = cidade.displayCode || cidade.code;
        input.value = cidade.airport
            ? `${cidade.name} · ${cidade.airport} (${codeDisplay})`
            : `${cidade.name} (${codeDisplay})`;
        hidden.value = cidade.code;
    },

    // ================================================================
    // AUTOCOMPLETE (via módulo compartilhado benetrip-places.js)
    // ================================================================
    normalizarTexto(texto) {
        return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    },

    async buscarCidades(termo) {
        if (termo.length < 2) return [];
        const { results } = await BenetripPlaces.search(termo);
        return results.map(p => BenetripPlaces.toLegacy(p));
    },

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

            timer = setTimeout(async () => {
                const cidades = await this.buscarCidades(termo);
                if (this.normalizarTexto(input.value.trim()) !== this.normalizarTexto(termo)) return; // resposta atrasada

                if (cidades.length === 0) {
                    results.innerHTML = '<div style="padding:12px;color:#666;font-size:13px;">Nenhuma cidade encontrada</div>';
                    results.style.display = 'block';
                    return;
                }

                results.innerHTML = cidades.map(c => {
                    const cityClass = c.isCityCode ? 'autocomplete-item autocomplete-city-group' : 'autocomplete-item';
                    const cityIcon = c.isCityCode ? '🏙️' : '';

                    return `
                        <div class="${cityClass}" data-city='${JSON.stringify(c).replace(/'/g, "&#39;")}'>
                            <div class="item-code">${cityIcon}${c.displayCode}</div>
                            <div class="item-details">
                                <div class="item-name">${c.name}${c.state ? ', ' + c.state : ''}${c.airport ? ' · ' + c.airport : ''}</div>
                                <div class="item-country">${c.country}</div>
                            </div>
                        </div>
                    `;
                }).join('');

                results.style.display = 'block';

                results.querySelectorAll('.autocomplete-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const cidade = JSON.parse(item.dataset.city);
                        this.state[stateKey] = cidade;

                        const codeDisplay = cidade.displayCode || cidade.code;
                        input.value = cidade.airport
                            ? `${cidade.name} · ${cidade.airport} (${codeDisplay})`
                            : `${cidade.name} (${codeDisplay})`;

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
    // CHIPS: dias da semana, meses, moeda
    // ================================================================
    setupDiasChips(containerId, stateKey) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = this.DIAS_CURTO.map((nome, dia) => {
            const active = this.state[stateKey].has(dia) ? ' active' : '';
            return `<button type="button" class="dia-chip${active}" data-dia="${dia}">${nome}</button>`;
        }).join('');

        container.querySelectorAll('.dia-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const dia = parseInt(chip.dataset.dia);
                if (this.state[stateKey].has(dia)) {
                    this.state[stateKey].delete(dia);
                    chip.classList.remove('active');
                } else {
                    this.state[stateKey].add(dia);
                    chip.classList.add('active');
                }
                this.log(`📅 ${stateKey}:`, [...this.state[stateKey]]);
            });
        });
    },

    setupMesesChips() {
        document.querySelectorAll('.mes-chip[data-meses]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.mes-chip[data-meses]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.mesesSelecionados = parseInt(chip.dataset.meses);
                this.log('📆 Meses:', this.state.mesesSelecionados);
            });
        });
    },

    setupCurrencyChips() {
        document.querySelectorAll('.currency-chip[data-currency]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.currency-chip[data-currency]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.moedaSelecionada = chip.dataset.currency;
            });
        });
        document.querySelector('.currency-chip[data-currency="BRL"]')?.classList.add('active');
    },

    // ================================================================
    // FORM & BUSCA
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
        if (this.state.diasIda.size === 0) {
            alert('Escolha pelo menos 1 dia da semana para ir');
            return false;
        }
        if (this.state.diasVolta.size === 0) {
            alert('Escolha pelo menos 1 dia da semana para voltar');
            return false;
        }
        return true;
    },

    async buscar() {
        const { origemSelecionada, destinoSelecionado, diasIda, diasVolta, mesesSelecionados, moedaSelecionada } = this.state;

        this.showLoading();
        this.updateProgress(10, '🔍 Montando o calendário da sua rota...');

        try {
            this.updateProgress(30, `✈️ Checando os preços de cada semana...`);

            const response = await fetch('/api/vai-e-vem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origem: origemSelecionada.code,
                    destino: destinoSelecionado.code,
                    diasIda: [...diasIda],
                    diasVolta: [...diasVolta],
                    meses: mesesSelecionados,
                    moeda: moedaSelecionada,
                }),
            });

            this.updateProgress(75, '📊 Separando o que tá barato do que tá caro...');

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Erro na busca');
            }

            const data = await response.json();
            if (!data.success || !data.semanas || data.semanas.length === 0) {
                throw new Error(data.message || 'Nenhum voo encontrado para esta rota nos dias escolhidos');
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
    // RESOLVER IATA PARA GOOGLE FLIGHTS
    // ================================================================
    getIataParaGoogleFlights(cidade) {
        // Cidade agregada → lista completa de aeroportos (o link do Google
        // Flights aceita múltiplos por trecho; não abre mais só o primeiro)
        if (cidade.isCityCode && cidade.aeroportosIncluidos && cidade.aeroportosIncluidos.length > 0) {
            return cidade.aeroportosIncluidos;
        }
        return cidade.code;
    },

    // Aeroportos reais da tarifa quando a viagem foi enriquecida
    _realAirports(viagem) {
        const fd = viagem?.flight_details;
        return {
            origin: fd?.origin_airport || null,
            dest: fd?.destination_airport || null,
        };
    },

    // ================================================================
    // RENDER RESULTADOS
    // ================================================================
    renderResults(data) {
        const container = document.getElementById('results-content');
        const { origemSelecionada, destinoSelecionado, moedaSelecionada } = this.state;

        const simbolo = this.getSimbolo(moedaSelecionada);
        const maisBarata = data.stats.maisBarata;

        const displayOrigemCode = origemSelecionada.displayCode || origemSelecionada.code;
        const displayDestinoCode = destinoSelecionado.displayCode || destinoSelecionado.code;

        const originIataGF = this.getIataParaGoogleFlights(origemSelecionada);
        const destIataGF = this.getIataParaGoogleFlights(destinoSelecionado);

        const diasIdaLabel = [...this.state.diasIda].sort().map(d => this.DIAS_CURTO[d]).join(', ');
        const diasVoltaLabel = [...this.state.diasVolta].sort().map(d => this.DIAS_CURTO[d]).join(', ');

        const realWinner = this._realAirports(maisBarata);
        const winnerUrl = this.buildGoogleFlightsUrl(originIataGF, destIataGF, maisBarata.ida, maisBarata.volta, moedaSelecionada, realWinner.origin, realWinner.dest);

        // Tripinha: insight + escolha
        const tripinha = data.tripinha || {};
        const escolha = tripinha.escolha;
        let escolhaHtml = '';
        if (escolha) {
            const viagemEscolhida = this.encontrarViagem(data, escolha.ida, escolha.volta);
            if (viagemEscolhida) {
                const realEscolha = this._realAirports(viagemEscolhida);
                const url = this.buildGoogleFlightsUrl(originIataGF, destIataGF, viagemEscolhida.ida, viagemEscolhida.volta, moedaSelecionada, realEscolha.origin, realEscolha.dest);
                escolhaHtml = `
                    <div class="tripinha-escolha">
                        <span class="escolha-badge">🏆 Escolha da Tripinha</span>
                        <span class="escolha-dates">${this.formatDateComDia(viagemEscolhida.ida)} → ${this.formatDateComDia(viagemEscolhida.volta)}</span>
                        <span class="escolha-preco">${simbolo} ${this.fmtValor(viagemEscolhida.price)}</span>
                        ${escolha.motivo ? `<span class="escolha-motivo">${escolha.motivo}</span>` : ''}
                        <a href="${url}" target="_blank" rel="noopener" class="escolha-link">Ver voo →</a>
                    </div>`;
            }
        }

        // Legenda de classificação: a referência é sempre a distribuição das
        // semanas pesquisadas — a faixa do Google entra apenas como contexto
        const classificacao = data.classificacao || {};
        const faixa = classificacao.faixa;
        const faixaGoogle = classificacao.faixaGoogle;
        const contextoGoogle = faixaGoogle
            ? `<span class="legenda-contexto">De referência: o Google indica faixa típica de <strong>${simbolo} ${this.fmtValor(faixaGoogle.low)} a ${simbolo} ${this.fmtValor(faixaGoogle.high)}</strong> para esta rota.</span>`
            : '';
        const legendaHtml = faixa ? `
            <div class="legenda-classes fade-in" style="animation-delay: 0.18s">
                <span class="legenda-titulo">${classificacao.precosSemelhantes
                    ? 'As semanas pesquisadas têm preços parecidos, então escolha pela data que for mais conveniente.'
                    : 'Classificação <strong>em relação às semanas pesquisadas</strong> (não é comparação histórica):'}</span>
                ${classificacao.precosSemelhantes ? '' : `
                <div class="legenda-itens">
                    <span class="badge-classe badge-barato">Mais barata que a maioria</span>
                    <span class="badge-classe badge-normal">Na média</span>
                    <span class="badge-classe badge-caro">Mais cara que a maioria</span>
                </div>`}
                ${contextoGoogle}
                <span class="legenda-contexto">O preço pode mudar até a conclusão da reserva no parceiro.</span>
            </div>` : '';

        const html = `
            <button class="btn-back" onclick="BenetripVaiEVem.showForm()">
                ← Nova busca
            </button>

            <div class="trip-summary fade-in">
                <div class="trip-summary-route">
                    <div class="trip-summary-city">
                        <span class="trip-summary-code">${displayOrigemCode}</span>
                        <span class="trip-summary-name">${origemSelecionada.airport || origemSelecionada.displayCode || origemSelecionada.code || origemSelecionada.name}</span>
                    </div>
                    <div class="trip-summary-arrow">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>
                    </div>
                    <div class="trip-summary-city">
                        <span class="trip-summary-code">${displayDestinoCode}</span>
                        <span class="trip-summary-name">${destinoSelecionado.airport || destinoSelecionado.displayCode || destinoSelecionado.code || destinoSelecionado.name}</span>
                    </div>
                </div>
                <div class="trip-summary-meta">
                    <span class="trip-meta-chip">🛫 Ida: ${diasIdaLabel}</span>
                    <span class="trip-meta-chip">🛬 Volta: ${diasVoltaLabel}</span>
                    <span class="trip-meta-chip">📆 Próximos ${data.meses} ${data.meses === 1 ? 'mês' : 'meses'}</span>
                    <span class="trip-meta-chip">🔍 ${data.stats.totalViagens} idas e voltas em ${data.stats.totalSemanas} semanas</span>
                </div>
            </div>

            <div class="winner-card fade-in" style="animation-delay: 0.05s">
                <div class="winner-badge">🏆 SEMANA MAIS BARATA PRA IR</div>
                <div class="winner-price">${simbolo} ${this.fmtValor(maisBarata.price)}</div>
                <div class="winner-price-label">ida e volta por pessoa</div>
                ${this._renderFeriadoTag(maisBarata)}
                ${this._renderWinnerFlightDetails(maisBarata)}
                <div class="winner-dates">
                    <div class="winner-date-item">
                        <div class="winner-date-label">Ida (${this.DIAS_CURTO[this.getDow(maisBarata.ida)]})</div>
                        <div class="winner-date-value">${this.formatDateBR(maisBarata.ida)}</div>
                    </div>
                    <div class="winner-arrow">→</div>
                    <div class="winner-date-item">
                        <div class="winner-date-label">Volta (${this.DIAS_CURTO[this.getDow(maisBarata.volta)]})</div>
                        <div class="winner-date-value">${this.formatDateBR(maisBarata.volta)}</div>
                    </div>
                </div>
                <a href="${winnerUrl}" target="_blank" rel="noopener" class="winner-cta">
                    ✈️ Ver no Google Flights
                </a>
            </div>

            <div class="stats-row fade-in" style="animation-delay: 0.1s">
                <div class="stat-card">
                    <div class="stat-card-label">Mais barata</div>
                    <div class="stat-card-value green">${simbolo} ${this.fmtValor(data.stats.maisBarata.price)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Média</div>
                    <div class="stat-card-value blue">${simbolo} ${this.fmtValor(data.stats.media)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Mais cara</div>
                    <div class="stat-card-value orange">${simbolo} ${this.fmtValor(data.stats.maisCara.price)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Economia entre semanas</div>
                    <div class="stat-card-value">${simbolo} ${this.fmtValor(data.stats.economia || 0)}</div>
                </div>
            </div>

            <div class="tripinha-tip fade-in" style="animation-delay: 0.15s">
                <img src="assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="tripinha-tip-avatar"
                     onerror="this.style.display='none'">
                <div class="tripinha-tip-text">
                    ${tripinha.insight || ''}
                    ${escolhaHtml}
                </div>
            </div>

            ${legendaHtml}
            ${this.renderAlertaSection()}

            <div class="semanas-section fade-in" style="animation-delay: 0.2s">
                <h3 class="semanas-title">📅 Semana a semana na sua rota</h3>
                <p class="semanas-hint">Todas as combinações de ida e volta nos dias que você escolheu. É só achar a semana verde! 🟢</p>
                <div class="semanas-lista">
                    ${data.semanas.map(s => this.renderSemana(s, simbolo, originIataGF, destIataGF)).join('')}
                </div>
            </div>

            <div class="share-section fade-in" style="animation-delay: 0.25s">
                <h3 class="share-title">📤 Compartilhar resultado</h3>
                <p class="share-subtitle">Manda pra quem tá te esperando! 🏠</p>
                <div class="share-buttons">
                    <button class="btn-share btn-share-whatsapp" onclick="BenetripVaiEVem.shareWhatsApp()">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                    </button>
                    <button class="btn-share btn-share-copy" onclick="BenetripVaiEVem.copyShareText()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        Copiar texto
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.showResults();
    },

    // ================================================================
    // ALERTA DE PREÇO (segunda etapa)
    // Só aparece com a feature flag ligada, o que exige a infraestrutura
    // descrita em docs/alertas-de-preco.md (canal de envio, fila e
    // persistência). Sem isso não exibimos formulário: cadastrar um alerta
    // que nunca seria disparado é pior do que não oferecer.
    // ================================================================
    renderAlertaSection() {
        if (!window.BENETRIP_FLAGS?.alertasPreco) return '';
        const { origemSelecionada, destinoSelecionado } = this.state;
        const rota = `${origemSelecionada?.displayCode || origemSelecionada?.code} → ${destinoSelecionado?.displayCode || destinoSelecionado?.code}`;
        return `
            <div class="alerta-section fade-in">
                <h3 class="alerta-title">🔔 Avisar quando ficar mais barato</h3>
                <p class="alerta-sub">Rota ${rota}, nos dias que você escolheu.</p>
                <button class="btn-alerta" onclick="BenetripVaiEVem.abrirCadastroAlerta()">Criar alerta</button>
            </div>`;
    },

    abrirCadastroAlerta() {
        // Implementação depende de POST /api/price-alerts (ver docs/alertas-de-preco.md)
        console.warn('[VaiEVem] Cadastro de alerta indisponível: infraestrutura de notificação não configurada');
    },

    encontrarViagem(data, ida, volta) {
        for (const s of data.semanas) {
            const hit = s.opcoes.find(o => o.ida === ida && o.volta === volta);
            if (hit) return hit;
        }
        return null;
    },

    _renderFeriadoTag(viagem) {
        if (!viagem.feriados || viagem.feriados.length === 0) return '';
        return `<div class="feriado-tag">🎉 ${viagem.feriados.map(f => f.nome).join(' + ')}</div>`;
    },

    _renderWinnerFlightDetails(viagem) {
        const fd = viagem.flight_details;
        if (!fd) return '';

        const durationH = Math.floor(fd.total_duration / 60);
        const durationM = fd.total_duration % 60;
        const durationStr = durationM > 0 ? `${durationH}h${durationM}min` : `${durationH}h`;
        const stopsStr = fd.stops === 0 ? 'Direto' : fd.stops === 1 ? '1 parada' : `${fd.stops} paradas`;
        const airlinesStr = fd.airlines.join(', ');

        const logosHtml = fd.airline_logos.slice(0, 2).map(logo =>
            `<img src="${logo}" alt="" style="width:24px;height:24px;border-radius:4px;background:#fff;" onerror="this.style.display='none'">`
        ).join('');

        // Aeroportos reais da tarifa (podem diferir do primeiro aeroporto
        // da cidade agregada — ex.: VCP em vez de GRU)
        const real = this._realAirports(viagem);
        const airportChip = real.origin && real.dest
            ? `<div class="winner-detail-chip">🛫 ${real.origin} → ${real.dest}</div>`
            : '';

        return `
            <div class="winner-flight-details">
                <div class="winner-detail-chip">${logosHtml} ${airlinesStr}</div>
                <div class="winner-detail-chip">⏱️ ${durationStr}</div>
                <div class="winner-detail-chip">${fd.stops === 0 ? '✅' : '🔄'} ${stopsStr}</div>
                ${airportChip}
            </div>
        `;
    },

    renderSemana(semana, simbolo, originIataGF, destIataGF) {
        const feriadoBadge = semana.temFeriado
            ? `<span class="semana-feriado">🎉 ${[...new Set(semana.opcoes.flatMap(o => o.feriados.map(f => f.nome)))].join(' · ')}</span>`
            : '';

        const opcoesHtml = semana.opcoes.map(o => {
            const realOpcao = this._realAirports(o);
            const url = this.buildGoogleFlightsUrl(originIataGF, destIataGF, o.ida, o.volta, this.state.moedaSelecionada, realOpcao.origin, realOpcao.dest);
            const isMaisBarata = o === semana.maisBarata || (o.ida === semana.maisBarata.ida && o.volta === semana.maisBarata.volta);
            const svgArrow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>`;

            return `
                <div class="opcao-row ${isMaisBarata && semana.opcoes.length > 1 ? 'opcao-melhor' : ''}">
                    <div class="opcao-info">
                        <div class="opcao-dates">
                            ${this.formatDateComDia(o.ida)} → ${this.formatDateComDia(o.volta)}
                        </div>
                        <div class="opcao-meta">
                            ${o.noites} noite${o.noites > 1 ? 's' : ''}
                            ${o.flight_details ? ` · ${o.flight_details.stops === 0 ? 'direto' : `${o.flight_details.stops} conexão${o.flight_details.stops > 1 ? 'ões' : ''}`}${o.flight_details.total_duration ? ` · ${Math.floor(o.flight_details.total_duration / 60)}h${String(o.flight_details.total_duration % 60).padStart(2, '0')}` : ''}` : ''}
                            ${o.feriados && o.feriados.length > 0 ? ` · 🎉 ${o.feriados[0].nome}` : ''}
                        </div>
                        ${o.viabilidade?.nivel === 'inviavel' ? `<div class="opcao-aviso">⚠️ ${o.viabilidade.motivo}</div>` : ''}
                    </div>
                    <span class="badge-classe badge-${o.classe}">${{ barato: 'Mais barata', normal: 'Na média', caro: 'Mais cara' }[o.classe] || ''}</span>
                    <div class="opcao-preco">${simbolo} ${this.fmtValor(o.price)}</div>
                    <a href="${url}" target="_blank" rel="noopener" class="opcao-link" title="Ver no Google Flights">${svgArrow}</a>
                </div>
            `;
        }).join('');

        return `
            <div class="semana-card classe-${semana.maisBarata.classe}">
                <div class="semana-header">
                    <span class="semana-label">Semana de ${this.formatDateBR(semana.inicioSemana)}</span>
                    ${feriadoBadge}
                    <span class="semana-desde">a partir de <strong>${simbolo} ${this.fmtValor(semana.maisBarata.price)}</strong></span>
                </div>
                <div class="semana-opcoes">
                    ${opcoesHtml}
                </div>
            </div>
        `;
    },

    // ================================================================
    // COMPARTILHAMENTO
    // ================================================================
    _buildShareText() {
        const data = this.state.resultados;
        if (!data || !data.stats) return null;

        const { origemSelecionada, destinoSelecionado, moedaSelecionada } = this.state;
        const displayOrigemCode = origemSelecionada.displayCode || origemSelecionada.code;
        const displayDestinoCode = destinoSelecionado.displayCode || destinoSelecionado.code;

        const originIataGF = this.getIataParaGoogleFlights(origemSelecionada);
        const destIataGF = this.getIataParaGoogleFlights(destinoSelecionado);

        const simbolo = this.getSimbolo(moedaSelecionada);
        const maisBarata = data.stats.maisBarata;

        const realBarata = this._realAirports(maisBarata);
        const googleUrl = this.buildGoogleFlightsUrl(originIataGF, destIataGF, maisBarata.ida, maisBarata.volta, moedaSelecionada, realBarata.origin, realBarata.dest);

        let text = `🔁 *Achei as melhores datas pra nossa rota de sempre!*\n\n`;
        text += `📍 ${origemSelecionada.name} (${displayOrigemCode}) → ${destinoSelecionado.name} (${displayDestinoCode})\n\n`;
        text += `🏆 *Semana mais barata:*\n`;
        text += `💰 *${simbolo} ${this.fmtValor(maisBarata.price)}* ida e volta\n`;
        text += `📆 ${this.formatDateComDia(maisBarata.ida)} → ${this.formatDateComDia(maisBarata.volta)}\n`;
        if (maisBarata.feriados && maisBarata.feriados.length > 0) {
            text += `🎉 Pegando ${maisBarata.feriados[0].nome}!\n`;
        }
        text += `\n📊 Até ${data.meses} ${data.meses === 1 ? 'mês' : 'meses'} à frente: média ${simbolo} ${this.fmtValor(data.stats.media)}, mais cara ${simbolo} ${this.fmtValor(data.stats.maisCara.price)}\n`;
        text += `\n🔗 Ver no Google Flights:\n${googleUrl}\n`;
        text += `\n🐕 Pesquisado em benetrip.com.br/vai-e-vem`;

        return text;
    },

    shareWhatsApp() {
        const text = this._buildShareText();
        if (!text) return;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    },

    copyShareText() {
        const text = this._buildShareText();
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
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
        }).catch(() => {
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

    buildGoogleFlightsUrl(orig, dest, depDate, retDate, moeda, realOrig = null, realDest = null) {
        // Módulo compartilhado: aeroporto real da tarifa quando conhecido;
        // senão, todos os aeroportos do grupo agregado
        if (typeof BenetripFlightLinks !== 'undefined') {
            const url = BenetripFlightLinks.buildUrl({
                origins: realOrig || orig,
                destinations: realDest || dest,
                departDate: depDate, returnDate: retDate, currency: moeda,
            });
            if (url) return url;
        }
        if (Array.isArray(orig)) orig = orig[0];
        if (Array.isArray(dest)) dest = dest[0];
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

        return `https://www.google.com/travel/flights?${params.toString()}`;
    },

    // ================================================================
    // HELPERS
    // ================================================================
    getSimbolo(moeda) {
        return { 'BRL': 'R$', 'USD': 'US$', 'EUR': '€' }[moeda] || 'R$';
    },

    getDow(dateStr) {
        return new Date(dateStr + 'T12:00:00').getDay();
    },

    formatDateBR(dateStr) {
        if (!dateStr) return 'sem data';
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    },

    formatDateComDia(dateStr) {
        if (!dateStr) return 'sem data';
        return `${this.DIAS_CURTO[this.getDow(dateStr)]} ${this.formatDateBR(dateStr)}`;
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
document.addEventListener('DOMContentLoaded', () => BenetripVaiEVem.init());
