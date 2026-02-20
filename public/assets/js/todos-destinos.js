/**
 * BENETRIP - TODOS OS DESTINOS
 * Versão: Comparação de Preços v1.0
 * 
 * Busca TODOS os destinos disponíveis e ordena por preço
 * Sem ranking por LLM - foco em transparência de preços
 */

const BenetripTodosDestinos = {
    state: {
        cidadesData: null,
        origemSelecionada: null,
        formData: {},
        todosDestinos: [],
        filtroAtivo: 'todos' // 'todos', 'dentro', 'fora'
    },

    config: {
        debug: true,
        cidadesJsonPath: 'data/cidades_global_iata_v7.json'
    },

    log(...args) {
        if (this.config.debug) console.log('[Benetrip Todos]', ...args);
    },

    error(...args) {
        console.error('[Benetrip Todos ERROR]', ...args);
    },

    init() {
        this.log('🐕 Benetrip Todos os Destinos v1.0 inicializando...');
        
        this.carregarCidades();
        this.setupFormEvents();
        this.setupAutocomplete();
        this.setupCalendar();
        this.setupOptionButtons();
        this.setupCurrencyInput();
        
        this.log('✅ Inicialização completa');
    },

    // ================================================================
    // CARREGAR CIDADES (mesma lógica do descobrir-destinos)
    // ================================================================
    async carregarCidades() {
        try {
            const response = await fetch(this.config.cidadesJsonPath);
            if (!response.ok) throw new Error('Erro ao carregar cidades');
            
            const dados = await response.json();
            this.state.cidadesData = dados.filter(c => c.iata);
            
            this.log(`✅ ${this.state.cidadesData.length} cidades carregadas`);
        } catch (erro) {
            this.error('Erro ao carregar cidades:', erro);
            this.state.cidadesData = [
                { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", codigo_pais: "BR", iata: "GRU", aeroporto: "Aeroporto de Guarulhos" },
                { cidade: "Rio de Janeiro", sigla_estado: "RJ", pais: "Brasil", codigo_pais: "BR", iata: "GIG", aeroporto: "Aeroporto do Galeão" },
                { cidade: "Salvador", sigla_estado: "BA", pais: "Brasil", codigo_pais: "BR", iata: "SSA" }
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
            .filter(cidade => {
                const nomeNorm = this.normalizarTexto(cidade.cidade);
                const iataNorm = cidade.iata.toLowerCase();
                const aeroNorm = cidade.aeroporto ? this.normalizarTexto(cidade.aeroporto) : '';
                return nomeNorm.includes(termoNorm) || iataNorm.includes(termoNorm) || aeroNorm.includes(termoNorm);
            })
            .slice(0, 8)
            .map(cidade => ({
                code: cidade.iata,
                name: cidade.cidade,
                state: cidade.sigla_estado,
                country: cidade.pais,
                countryCode: cidade.codigo_pais,
                airport: cidade.aeroporto || null
            }));
    },

    // ================================================================
    // AUTOCOMPLETE
    // ================================================================
    setupAutocomplete() {
        const input = document.getElementById('origem');
        const results = document.getElementById('origem-results');
        const hiddenInput = document.getElementById('origem-data');
        
        let debounceTimer;
        
        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            
            const termo = e.target.value.trim();
            
            if (termo.length < 2) {
                results.innerHTML = '';
                results.style.display = 'none';
                this.state.origemSelecionada = null;
                hiddenInput.value = '';
                return;
            }
            
            debounceTimer = setTimeout(() => {
                const cidades = this.buscarCidades(termo);
                
                if (cidades.length === 0) {
                    results.innerHTML = '<div style="padding: 12px; color: #666;">Nenhuma cidade encontrada</div>';
                    results.style.display = 'block';
                    return;
                }
                
                results.innerHTML = cidades.map(cidade => `
                    <div class="autocomplete-item" data-city='${JSON.stringify(cidade)}'>
                        <div class="item-code">${cidade.code}</div>
                        <div class="item-details">
                            <div class="item-name">${cidade.name}${cidade.state ? ', ' + cidade.state : ''}${cidade.airport ? ' — ' + cidade.airport : ''}</div>
                            <div class="item-country">${cidade.country}</div>
                        </div>
                    </div>
                `).join('');
                
                results.style.display = 'block';
                
                results.querySelectorAll('.autocomplete-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const cidade = JSON.parse(item.dataset.city);
                        this.selecionarOrigem(cidade);
                    });
                });
            }, 300);
        });
        
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !results.contains(e.target)) {
                results.style.display = 'none';
            }
        });
    },

    selecionarOrigem(cidade) {
        const input = document.getElementById('origem');
        const results = document.getElementById('origem-results');
        const hiddenInput = document.getElementById('origem-data');
        
        this.state.origemSelecionada = cidade;
        input.value = cidade.airport 
            ? `${cidade.name} — ${cidade.airport} (${cidade.code})`
            : `${cidade.name} (${cidade.code})`;
        hiddenInput.value = JSON.stringify(cidade);
        results.style.display = 'none';
        
        this.log('📍 Origem:', cidade);
    },

    // ================================================================
    // CALENDÁRIO
    // ================================================================
    setupCalendar() {
        const input = document.getElementById('datas');
        const dataIda = document.getElementById('data-ida');
        const dataVolta = document.getElementById('data-volta');
        
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        
        flatpickr(input, {
            mode: 'range',
            minDate: amanha,
            dateFormat: 'Y-m-d',
            locale: 'pt',
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    dataIda.value = this.formatarDataISO(selectedDates[0]);
                    dataVolta.value = this.formatarDataISO(selectedDates[1]);
                    input.value = `${this.formatarDataBR(selectedDates[0])} - ${this.formatarDataBR(selectedDates[1])}`;
                    this.log('📅 Datas:', dataIda.value, 'até', dataVolta.value);
                }
            }
        });
    },

    formatarDataISO(data) {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    },

    formatarDataBR(data) {
        return data.toLocaleDateString('pt-BR');
    },

    // ================================================================
    // BOTÕES DE OPÇÃO (Moeda)
    // ================================================================
    setupOptionButtons() {
        document.querySelectorAll('.button-group-vertical').forEach(group => {
            const field = group.dataset.field;
            if (!field) return;
            
            const hiddenInput = document.getElementById(field);
            
            group.querySelectorAll('.btn-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    hiddenInput.value = btn.dataset.value;
                    this.log(`✅ ${field}:`, btn.dataset.value);
                    
                    if (field === 'moeda') {
                        this.atualizarSimboloMoeda(btn.dataset.value);
                    }
                });
            });
        });
    },

    atualizarSimboloMoeda(moeda) {
        const simbolos = { 'BRL': 'R$', 'USD': '$', 'EUR': '€' };
        const currencySymbol = document.querySelector('.currency-symbol');
        if (currencySymbol) {
            currencySymbol.textContent = simbolos[moeda] || 'R$';
        }
    },

    // ================================================================
    // CURRENCY INPUT
    // ================================================================
    setupCurrencyInput() {
        const input = document.getElementById('orcamento');
        
        if (input) {
            input.addEventListener('input', (e) => {
                let valor = e.target.value.replace(/\D/g, '');
                if (valor) {
                    valor = parseInt(valor).toString();
                    e.target.value = parseInt(valor).toLocaleString('pt-BR');
                } else {
                    e.target.value = '';
                }
            });
        }
    },

    // ================================================================
    // FORM EVENTS
    // ================================================================
    setupFormEvents() {
        const form = document.getElementById('busca-form');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!this.validarFormulario()) {
                return;
            }
            
            this.coletarDadosFormulario();
            await this.buscarTodosDestinos();
        });
    },

    validarFormulario() {
        if (!this.state.origemSelecionada) {
            alert('Por favor, selecione uma cidade de origem');
            document.getElementById('origem').focus();
            return false;
        }
        
        if (!document.getElementById('data-ida').value || !document.getElementById('data-volta').value) {
            alert('Por favor, selecione as datas da viagem');
            document.getElementById('datas').focus();
            return false;
        }

        if (!document.getElementById('moeda').value) {
            alert('Por favor, escolha a moeda');
            return false;
        }
        
        const orcamento = document.getElementById('orcamento').value;
        if (!orcamento || parseFloat(orcamento.replace(/\./g, '')) <= 0) {
            alert('Por favor, informe o orçamento');
            document.getElementById('orcamento').focus();
            return false;
        }
        
        return true;
    },

    coletarDadosFormulario() {
        this.state.formData = {
            origem: this.state.origemSelecionada,
            dataIda: document.getElementById('data-ida').value,
            dataVolta: document.getElementById('data-volta').value,
            moeda: document.getElementById('moeda').value,
            orcamento: parseFloat(document.getElementById('orcamento').value.replace(/\./g, ''))
        };
        
        this.log('📝 Dados:', this.state.formData);
    },

    // ================================================================
    // BUSCA DE DESTINOS
    // ================================================================
    async buscarTodosDestinos() {
        try {
            this.mostrarLoading();
            
            this.atualizarProgresso(20, '🌍 Buscando destinos pelo mundo todo...');
            
            const response = await fetch('/api/search-destinations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origem: this.state.formData.origem.code,
                    dataIda: this.state.formData.dataIda,
                    dataVolta: this.state.formData.dataVolta,
                    moeda: this.state.formData.moeda
                })
            });
            
            this.atualizarProgresso(60, '💰 Organizando preços...');
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Erro na API');
            }
            
            const data = await response.json();
            
            if (!data.destinations || data.destinations.length === 0) {
                throw new Error('Nenhum destino encontrado');
            }

            this.log(`✅ ${data.destinations.length} destinos encontrados`);
            
            this.atualizarProgresso(80, '✈️ Gerando links do Google Flights...');
            
            // Ordenar por preço (menor para maior)
            const destinosOrdenados = data.destinations
                .filter(d => d.flight?.price > 0)
                .sort((a, b) => a.flight.price - b.flight.price);
            
            this.state.todosDestinos = destinosOrdenados;
            
            this.atualizarProgresso(100, '🎉 Pronto!');
            await this.delay(300);
            
            this.mostrarResultados(destinosOrdenados);
            
        } catch (erro) {
            this.error('Erro:', erro);
            alert(`Erro: ${erro.message}`);
            this.esconderLoading();
        }
    },

    // ================================================================
    // GOOGLE FLIGHTS - PROTOBUF (mesma implementação)
    // ================================================================
    _protoVarint(n) {
        const bytes = [];
        let v = n >>> 0;
        while (v > 127) {
            bytes.push((v & 0x7f) | 0x80);
            v >>>= 7;
        }
        bytes.push(v & 0x7f);
        return bytes;
    },

    _protoTag(fieldNumber, wireType) {
        return this._protoVarint((fieldNumber << 3) | wireType);
    },

    _protoVarintField(fieldNumber, value) {
        return [...this._protoTag(fieldNumber, 0), ...this._protoVarint(value)];
    },

    _protoStringField(fieldNumber, str) {
        const encoded = new TextEncoder().encode(str);
        return [
            ...this._protoTag(fieldNumber, 2),
            ...this._protoVarint(encoded.length),
            ...encoded
        ];
    },

    _protoMessageField(fieldNumber, messageBytes) {
        return [
            ...this._protoTag(fieldNumber, 2),
            ...this._protoVarint(messageBytes.length),
            ...messageBytes
        ];
    },

    _toBase64Url(bytes) {
        const binary = String.fromCharCode(...bytes);
        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    },

    _buildAirport(iataCode) {
        return [
            ...this._protoVarintField(1, 1),
            ...this._protoStringField(2, iataCode)
        ];
    },

    _buildFlightLeg(date, originIata, destIata) {
        return [
            ...this._protoStringField(2, date),
            ...this._protoMessageField(13, this._buildAirport(originIata)),
            ...this._protoMessageField(14, this._buildAirport(destIata))
        ];
    },

    _buildTfsParam(originIata, destIata, departDate, returnDate) {
        const tfsBytes = [
            ...this._protoVarintField(1, 28),
            ...this._protoVarintField(2, 2),
            ...this._protoMessageField(3, this._buildFlightLeg(departDate, originIata, destIata)),
            ...this._protoMessageField(3, this._buildFlightLeg(returnDate, destIata, originIata)),
            ...this._protoVarintField(14, 1)
        ];

        return this._toBase64Url(tfsBytes);
    },

    _buildTfuParam(adults, children, infantsOnLap) {
        const innerBytes = [
            ...this._protoVarintField(1, adults),
            ...this._protoVarintField(2, children),
            ...this._protoVarintField(3, infantsOnLap)
        ];

        const outerBytes = this._protoMessageField(2, innerBytes);
        return this._toBase64Url(outerBytes);
    },

    _getGoogleCurrency(moeda) {
        const map = { 'BRL': 'BRL', 'USD': 'USD', 'EUR': 'EUR' };
        return map[moeda] || 'BRL';
    },

    _getGoogleLocale(moeda) {
        const map = { 'BRL': 'pt-BR', 'USD': 'en', 'EUR': 'en' };
        return map[moeda] || 'pt-BR';
    },

    _getGoogleGl(moeda) {
        const map = { 'BRL': 'br', 'USD': 'us', 'EUR': 'de' };
        return map[moeda] || 'br';
    },

    buildGoogleFlightsUrl(originIata, destIata, departDate, returnDate, currency) {
        const tfs = this._buildTfsParam(originIata, destIata, departDate, returnDate);
        const tfu = this._buildTfuParam(1, 0, 0); // 1 adulto, sem crianças
        const curr = this._getGoogleCurrency(currency);
        const hl = this._getGoogleLocale(currency);
        const gl = this._getGoogleGl(currency);

        const params = new URLSearchParams();
        params.set('tfs', tfs);
        params.set('tfu', tfu);
        params.set('curr', curr);
        params.set('hl', hl);
        params.set('gl', gl);

        return `https://www.google.com/travel/flights/search?${params.toString()}`;
    },

    // ================================================================
    // HELPERS
    // ================================================================
    getSimbolo(moeda) {
        return { 'BRL': 'R$', 'USD': 'US$', 'EUR': '€' }[moeda] || 'R$';
    },

    formatarPreco(valor, moeda) {
        const simbolo = this.getSimbolo(moeda || this.state.formData.moeda);
        return `${simbolo} ${Math.round(valor).toLocaleString('pt-BR')}`;
    },

    calcularNoites(dataIda, dataVolta) {
        const ida = new Date(dataIda);
        const volta = new Date(dataVolta);
        return Math.ceil((volta - ida) / (1000 * 60 * 60 * 24));
    },

    mostrarLoading() {
        document.getElementById('form-container').style.display = 'none';
        document.getElementById('loading-container').style.display = 'block';
        document.getElementById('resultados-container').style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    esconderLoading() {
        document.getElementById('loading-container').style.display = 'none';
        document.getElementById('form-container').style.display = 'block';
    },

    atualizarProgresso(pct, msg) {
        document.getElementById('progress-fill').style.width = `${pct}%`;
        document.getElementById('loading-message').textContent = msg;
    },

    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    },

    voltarAoFormulario() {
        document.getElementById('resultados-container').style.display = 'none';
        document.getElementById('resultados-container').innerHTML = '';
        document.getElementById('form-container').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.log('🔄 Voltou ao formulário');
    },

    // ================================================================
    // EXIBIR RESULTADOS
    // ================================================================
    mostrarResultados(destinos) {
        const container = document.getElementById('resultados-container');
        const { origem, dataIda, dataVolta, moeda, orcamento } = this.state.formData;
        const noites = this.calcularNoites(dataIda, dataVolta);
        
        if (destinos.length === 0) {
            this.mostrarSemResultados();
            return;
        }

        // Estatísticas
        const dentroOrcamento = destinos.filter(d => d.flight.price <= orcamento);
        const foraOrcamento = destinos.filter(d => d.flight.price > orcamento);
        const maisBarato = destinos[0];
        const maisCaro = destinos[destinos.length - 1];

        this.log(`📊 Dentro: ${dentroOrcamento.length} | Fora: ${foraOrcamento.length}`);

        // Mensagem da Tripinha
        let tripinhaMsg = '';
        if (dentroOrcamento.length === 0) {
            tripinhaMsg = `🐕 Opa! Não encontrei nenhum destino dentro do seu orçamento de ${this.formatarPreco(orcamento, moeda)}. Mas listei TODOS os ${destinos.length} destinos disponíveis do mais barato ao mais caro. O mais em conta custa ${this.formatarPreco(maisBarato.flight.price, moeda)} — que tal aumentar um pouquinho o orçamento?`;
        } else if (dentroOrcamento.length === destinos.length) {
            tripinhaMsg = `🐕 Que beleza! TODOS os ${destinos.length} destinos encontrados cabem no seu orçamento de ${this.formatarPreco(orcamento, moeda)}! Você tem muitas opções, do mais barato (${this.formatarPreco(maisBarato.flight.price, moeda)}) ao mais caro (${this.formatarPreco(maisCaro.flight.price, moeda)}).`;
        } else {
            tripinhaMsg = `🐕 Achei ${dentroOrcamento.length} destinos dentro do seu orçamento de ${this.formatarPreco(orcamento, moeda)} e mais ${foraOrcamento.length} opções um pouco acima. Os preços vão de ${this.formatarPreco(maisBarato.flight.price, moeda)} até ${this.formatarPreco(maisCaro.flight.price, moeda)}. Confira as opções!`;
        }

        const origemDisplay = origem.airport 
            ? `${origem.name} — ${origem.airport} (${origem.code})`
            : `${origem.name} (${origem.code})`;

        const dataIdaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        const dataVoltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

        const html = `
            <button class="btn-voltar-topo" onclick="BenetripTodosDestinos.voltarAoFormulario()">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
                </svg>
                Nova busca
            </button>

            <div class="resultados-header">
                <h1>🌍 Todos os Destinos Disponíveis</h1>
                <div class="resultados-stats">
                    <div class="stat-item">
                        <span class="stat-label">De</span>
                        <span class="stat-value">📍 ${origemDisplay}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Período</span>
                        <span class="stat-value">📅 ${dataIdaBR} → ${dataVoltaBR} (${noites} noites)</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Total encontrado</span>
                        <span class="stat-value orange">${destinos.length} destinos</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Dentro do orçamento</span>
                        <span class="stat-value green">${dentroOrcamento.length} opções</span>
                    </div>
                </div>
            </div>

            <div class="tripinha-message">
                <img src="assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="tripinha-message-avatar"
                     onerror="this.style.display='none'">
                <div class="tripinha-message-content">
                    <h3>💬 Fala da Tripinha:</h3>
                    <p>${tripinhaMsg}</p>
                </div>
            </div>

            <div class="filtros-visualizacao">
                <span class="filtros-label">Filtrar:</span>
                <div class="filtros-buttons">
                    <button class="btn-filtro active" data-filtro="todos" onclick="BenetripTodosDestinos.aplicarFiltro('todos')">
                        Todos (${destinos.length})
                    </button>
                    <button class="btn-filtro" data-filtro="dentro" onclick="BenetripTodosDestinos.aplicarFiltro('dentro')">
                        Dentro do orçamento (${dentroOrcamento.length})
                    </button>
                    <button class="btn-filtro" data-filtro="fora" onclick="BenetripTodosDestinos.aplicarFiltro('fora')">
                        Acima do orçamento (${foraOrcamento.length})
                    </button>
                </div>
            </div>

            <div class="destinos-lista" id="destinos-lista">
                ${destinos.map(d => this.renderDestinoCard(d, orcamento, noites)).join('')}
            </div>
        `;

        container.innerHTML = html;
        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    renderDestinoCard(destino, orcamento, noites) {
        const { origem, dataIda, dataVolta, moeda } = this.state.formData;
        
        const dentroOrcamento = destino.flight.price <= orcamento;
        const preco = this.formatarPreco(destino.flight.price, moeda);
        
        const paradas = destino.flight.stops || 0;
        const paradasTexto = paradas === 0 ? 'Direto' : paradas === 1 ? '1 parada' : `${paradas} paradas`;
        
        const duracao = destino.flight.flight_duration_minutes || 0;
        const duracaoTexto = duracao > 0 ? `${Math.floor(duracao / 60)}h${duracao % 60}min` : '—';

        const googleFlightsUrl = this.buildGoogleFlightsUrl(
            origem.code,
            destino.primary_airport,
            dataIda,
            dataVolta,
            moeda
        );

        // Custo estimado com hotel (se disponível)
        let custoEstimadoHtml = '';
        if (destino.avg_cost_per_night && destino.avg_cost_per_night > 0) {
            const hotelTotal = destino.avg_cost_per_night * noites;
            const custoTotal = destino.flight.price + hotelTotal;
            custoEstimadoHtml = `
                <div class="custo-estimado-mini">
                    Com hotel: <strong>${this.formatarPreco(custoTotal, moeda)}</strong>
                    <span style="opacity: 0.7;">(voo + ${noites} noites)</span>
                </div>
            `;
        }

        const googleFlightsIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`;

        return `
            <div class="destino-item ${dentroOrcamento ? 'dentro-orcamento' : 'fora-orcamento'}" data-filtro="${dentroOrcamento ? 'dentro' : 'fora'}">
                <span class="status-badge ${dentroOrcamento ? 'dentro' : 'fora'}">
                    ${dentroOrcamento ? '✓ Dentro do orçamento' : '⚠ Acima do orçamento'}
                </span>
                
                <div class="destino-header">
                    <div class="destino-info">
                        <h3 class="destino-nome">${destino.name}</h3>
                        <p class="destino-pais">${destino.country || '—'} · ${destino.primary_airport}</p>
                    </div>
                    <div class="destino-preco-wrapper">
                        <div class="destino-preco">${preco}</div>
                        <div class="destino-preco-label">ida e volta</div>
                    </div>
                </div>

                <div class="destino-detalhes">
                    <div class="detalhe-item">
                        <span class="detalhe-icon">✈️</span>
                        <span>${paradasTexto}</span>
                    </div>
                    ${duracao > 0 ? `
                    <div class="detalhe-item">
                        <span class="detalhe-icon">⏱️</span>
                        <span>${duracaoTexto}</span>
                    </div>
                    ` : ''}
                    ${destino.flight.airline_name ? `
                    <div class="detalhe-item">
                        <span class="detalhe-icon">🛫</span>
                        <span>${destino.flight.airline_name}</span>
                    </div>
                    ` : ''}
                    ${destino._source_count > 1 ? `
                    <div class="detalhe-item">
                        <span class="detalhe-icon">🔍</span>
                        <span>${destino._source_count} fontes</span>
                    </div>
                    ` : ''}
                </div>

                <div class="destino-acao">
                    ${custoEstimadoHtml}
                    <a href="${googleFlightsUrl}" target="_blank" rel="noopener" class="btn-google-flights">
                        ${googleFlightsIcon}
                        Ver no Google Flights
                    </a>
                </div>
            </div>
        `;
    },

    // ================================================================
    // FILTROS
    // ================================================================
    aplicarFiltro(filtro) {
        this.state.filtroAtivo = filtro;
        
        // Atualizar botões
        document.querySelectorAll('.btn-filtro').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filtro === filtro);
        });

        // Filtrar cards
        const cards = document.querySelectorAll('.destino-item');
        cards.forEach(card => {
            if (filtro === 'todos') {
                card.style.display = 'block';
            } else {
                card.style.display = card.dataset.filtro === filtro ? 'block' : 'none';
            }
        });

        this.log(`🔍 Filtro aplicado: ${filtro}`);
    },

    // ================================================================
    // SEM RESULTADOS
    // ================================================================
    mostrarSemResultados() {
        const container = document.getElementById('resultados-container');
        const { origem } = this.state.formData;

        container.innerHTML = `
            <button class="btn-voltar-topo" onclick="BenetripTodosDestinos.voltarAoFormulario()">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
                </svg>
                Nova busca
            </button>

            <div class="sem-resultados">
                <img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" 
                     onerror="this.style.display='none'">
                <h2>😕 Nenhum destino encontrado</h2>
                <p>A Tripinha não encontrou voos saindo de <strong>${origem.name} (${origem.code})</strong> para essas datas.</p>
                <p>Tente outras datas ou outra cidade de origem!</p>
                <button class="btn-tentar-novamente" onclick="BenetripTodosDestinos.voltarAoFormulario()">
                    ✏️ Tentar Novamente
                </button>
            </div>
        `;

        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// ================================================================
// INICIALIZAÇÃO
// ================================================================
document.addEventListener('DOMContentLoaded', () => BenetripTodosDestinos.init());
