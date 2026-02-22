/**
 * BENETRIP - TODOS OS DESTINOS
 * Versão: Datas Flexíveis v2.0
 * 
 * Novidades:
 * - Datas flexíveis: até 3 idas × 3 voltas = 9 combinações
 * - Busca paralela por combinação de datas
 * - Ranking por menor preço entre todas as combinações
 * - Escopo: Todos / Brasil / Internacional
 */

const BenetripTodosDestinos = {
    state: {
        cidadesData: null,
        origemSelecionada: null,
        formData: {},
        todosDestinos: [],
        filtroAtivo: 'todos',
        // Datas flexíveis
        modoData: 'fixas', // 'fixas' ou 'flexiveis'
        datasIda: [],      // Array de datas ISO (máx 3)
        datasVolta: [],    // Array de datas ISO (máx 3)
        // Flatpickr instances
        fpFixas: null,
        fpIda: null,
        fpVolta: null,
    },

    config: {
        debug: true,
        cidadesJsonPath: 'data/cidades_global_iata_v6.json',
        maxDatasIda: 3,
        maxDatasVolta: 3,
    },

    log(...args) {
        if (this.config.debug) console.log('[Benetrip Todos]', ...args);
    },

    error(...args) {
        console.error('[Benetrip Todos ERROR]', ...args);
    },

    init() {
        this.log('🐕 Benetrip Todos os Destinos v2.0 (Datas Flexíveis) inicializando...');
        
        this.carregarCidades();
        this.setupFormEvents();
        this.setupAutocomplete();
        this.setupCalendarFixas();
        this.setupCalendarFlexiveis();
        this.setupModoData();
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
    // MODO DE DATA (fixas / flexíveis)
    // ================================================================
    setupModoData() {
        const btnFixas = document.getElementById('btn-modo-fixas');
        const btnFlexiveis = document.getElementById('btn-modo-flexiveis');
        const hint = document.getElementById('hint-modo-data');

        btnFixas.addEventListener('click', () => {
            this.state.modoData = 'fixas';
            btnFixas.classList.add('active');
            btnFlexiveis.classList.remove('active');
            document.getElementById('datas-fixas-container').style.display = 'block';
            document.getElementById('datas-flexiveis-container').style.display = 'none';
            hint.textContent = 'Selecione ida e volta exatas';
            this.log('📅 Modo: Datas fixas');
        });

        btnFlexiveis.addEventListener('click', () => {
            this.state.modoData = 'flexiveis';
            btnFlexiveis.classList.add('active');
            btnFixas.classList.remove('active');
            document.getElementById('datas-fixas-container').style.display = 'none';
            document.getElementById('datas-flexiveis-container').style.display = 'block';
            hint.textContent = 'Selecione várias opções de ida e volta para encontrar o melhor preço';
            this.log('📅 Modo: Datas flexíveis');
        });
    },

    // ================================================================
    // CALENDÁRIO FIXAS (range como antes)
    // ================================================================
    setupCalendarFixas() {
        const input = document.getElementById('datas-fixas');
        
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        
        this.state.fpFixas = flatpickr(input, {
            mode: 'range',
            minDate: amanha,
            dateFormat: 'Y-m-d',
            locale: 'pt',
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    document.getElementById('data-ida').value = this.formatarDataISO(selectedDates[0]);
                    document.getElementById('data-volta').value = this.formatarDataISO(selectedDates[1]);
                    input.value = `${this.formatarDataBR(selectedDates[0])} - ${this.formatarDataBR(selectedDates[1])}`;
                    this.log('📅 Fixas:', document.getElementById('data-ida').value, '→', document.getElementById('data-volta').value);
                }
            }
        });
    },

    // ================================================================
    // CALENDÁRIOS FLEXÍVEIS (multiple mode)
    // ================================================================
    setupCalendarFlexiveis() {
        const inputIda = document.getElementById('datas-ida-flex');
        const inputVolta = document.getElementById('datas-volta-flex');
        
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);

        // Flatpickr de IDA (múltiplas datas)
        this.state.fpIda = flatpickr(inputIda, {
            mode: 'multiple',
            minDate: amanha,
            dateFormat: 'Y-m-d',
            locale: 'pt',
            conjunction: ', ',
            onChange: (selectedDates) => {
                if (selectedDates.length > this.config.maxDatasIda) {
                    // Limitar a 3
                    selectedDates.splice(this.config.maxDatasIda);
                    this.state.fpIda.setDate(selectedDates);
                }
                this.state.datasIda = selectedDates.map(d => this.formatarDataISO(d)).sort();
                this.renderDateChips('selected-idas', this.state.datasIda, 'ida');
                this.atualizarCombinacoes();
                // Atualizar data mínima da volta
                if (this.state.datasIda.length > 0) {
                    const minVolta = new Date(Math.min(...selectedDates));
                    minVolta.setDate(minVolta.getDate() + 1);
                    this.state.fpVolta.set('minDate', minVolta);
                }
                inputIda.value = selectedDates.length > 0 
                    ? selectedDates.map(d => this.formatarDataBR(d)).join(', ')
                    : '';
                this.log('🛫 Idas:', this.state.datasIda);
            }
        });

        // Flatpickr de VOLTA (múltiplas datas)
        this.state.fpVolta = flatpickr(inputVolta, {
            mode: 'multiple',
            minDate: amanha,
            dateFormat: 'Y-m-d',
            locale: 'pt',
            conjunction: ', ',
            onChange: (selectedDates) => {
                if (selectedDates.length > this.config.maxDatasVolta) {
                    selectedDates.splice(this.config.maxDatasVolta);
                    this.state.fpVolta.setDate(selectedDates);
                }
                this.state.datasVolta = selectedDates.map(d => this.formatarDataISO(d)).sort();
                this.renderDateChips('selected-voltas', this.state.datasVolta, 'volta');
                this.atualizarCombinacoes();
                inputVolta.value = selectedDates.length > 0 
                    ? selectedDates.map(d => this.formatarDataBR(d)).join(', ')
                    : '';
                this.log('🛬 Voltas:', this.state.datasVolta);
            }
        });
    },

    renderDateChips(containerId, datas, tipo) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = datas.map((data, idx) => {
            const dataBR = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { 
                day: '2-digit', month: 'short', year: 'numeric' 
            });
            return `
                <span class="date-chip">
                    ${tipo === 'ida' ? '🛫' : '🛬'} ${dataBR}
                    <span class="remove-date" onclick="BenetripTodosDestinos.removerData('${tipo}', ${idx})">✕</span>
                </span>
            `;
        }).join('');
    },

    removerData(tipo, idx) {
        if (tipo === 'ida') {
            this.state.datasIda.splice(idx, 1);
            const dates = this.state.datasIda.map(d => new Date(d + 'T12:00:00'));
            this.state.fpIda.setDate(dates);
            this.renderDateChips('selected-idas', this.state.datasIda, 'ida');
            document.getElementById('datas-ida-flex').value = dates.length > 0
                ? dates.map(d => this.formatarDataBR(d)).join(', ')
                : '';
        } else {
            this.state.datasVolta.splice(idx, 1);
            const dates = this.state.datasVolta.map(d => new Date(d + 'T12:00:00'));
            this.state.fpVolta.setDate(dates);
            this.renderDateChips('selected-voltas', this.state.datasVolta, 'volta');
            document.getElementById('datas-volta-flex').value = dates.length > 0
                ? dates.map(d => this.formatarDataBR(d)).join(', ')
                : '';
        }
        this.atualizarCombinacoes();
    },

    atualizarCombinacoes() {
        const info = document.getElementById('combinacoes-info');
        const texto = document.getElementById('combinacoes-texto');
        const nIda = this.state.datasIda.length;
        const nVolta = this.state.datasVolta.length;
        
        // Filtrar combinações válidas (volta > ida)
        const combos = this.gerarCombinacoes();
        const total = combos.length;
        
        if (nIda > 0 && nVolta > 0) {
            info.style.display = 'flex';
            texto.textContent = total === 1 
                ? '1 combinação será pesquisada'
                : `${total} combinações serão pesquisadas`;
        } else {
            info.style.display = 'none';
        }
    },

    gerarCombinacoes() {
        const combos = [];
        for (const ida of this.state.datasIda) {
            for (const volta of this.state.datasVolta) {
                // Volta deve ser depois da ida
                if (volta > ida) {
                    combos.push({ dataIda: ida, dataVolta: volta });
                }
            }
        }
        return combos;
    },

    // ================================================================
    // BOTÕES DE OPÇÃO (Moeda + Escopo)
    // ================================================================
    setupOptionButtons() {
        document.querySelectorAll('.button-group-vertical, .button-group-horizontal').forEach(group => {
            const field = group.dataset.field;
            if (!field || field === 'modo-data') return; // modo-data tem handler próprio
            
            const hiddenInput = document.getElementById(field);
            if (!hiddenInput) return;
            
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
            
            if (!this.validarFormulario()) return;
            
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
        
        if (this.state.modoData === 'fixas') {
            if (!document.getElementById('data-ida').value || !document.getElementById('data-volta').value) {
                alert('Por favor, selecione as datas da viagem');
                document.getElementById('datas-fixas').focus();
                return false;
            }
        } else {
            // Flexíveis
            if (this.state.datasIda.length === 0) {
                alert('Por favor, selecione pelo menos uma data de ida');
                document.getElementById('datas-ida-flex').focus();
                return false;
            }
            if (this.state.datasVolta.length === 0) {
                alert('Por favor, selecione pelo menos uma data de volta');
                document.getElementById('datas-volta-flex').focus();
                return false;
            }
            const combos = this.gerarCombinacoes();
            if (combos.length === 0) {
                alert('Nenhuma combinação válida encontrada. As datas de volta devem ser posteriores às de ida.');
                return false;
            }
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
        const moeda = document.getElementById('moeda').value;
        const escopo = document.getElementById('escopo').value || 'todos';

        if (this.state.modoData === 'fixas') {
            this.state.formData = {
                origem: this.state.origemSelecionada,
                modoData: 'fixas',
                dataIda: document.getElementById('data-ida').value,
                dataVolta: document.getElementById('data-volta').value,
                combinacoes: [{ 
                    dataIda: document.getElementById('data-ida').value, 
                    dataVolta: document.getElementById('data-volta').value 
                }],
                moeda,
                escopo,
                orcamento: parseFloat(document.getElementById('orcamento').value.replace(/\./g, ''))
            };
        } else {
            const combos = this.gerarCombinacoes();
            this.state.formData = {
                origem: this.state.origemSelecionada,
                modoData: 'flexiveis',
                dataIda: combos[0]?.dataIda || this.state.datasIda[0],
                dataVolta: combos[combos.length - 1]?.dataVolta || this.state.datasVolta[this.state.datasVolta.length - 1],
                combinacoes: combos,
                moeda,
                escopo,
                orcamento: parseFloat(document.getElementById('orcamento').value.replace(/\./g, ''))
            };
        }
        
        this.log('📝 Dados:', this.state.formData);
        this.log(`🔀 ${this.state.formData.combinacoes.length} combinação(ões) de datas`);
    },

    // ================================================================
    // BUSCA DE DESTINOS (com suporte a múltiplas combinações)
    // ================================================================
    async buscarTodosDestinos() {
        try {
            this.mostrarLoading();
            
            const { origem, combinacoes, moeda, escopo } = this.state.formData;
            const totalCombos = combinacoes.length;
            const isFlexivel = totalCombos > 1;

            if (isFlexivel) {
                document.getElementById('loading-title').textContent = `🐕 Tripinha está comparando ${totalCombos} combinações de datas...`;
                document.getElementById('loading-combinacao').style.display = 'block';
            } else {
                document.getElementById('loading-title').textContent = '🐕 Tripinha está vasculhando o mundo...';
                document.getElementById('loading-combinacao').style.display = 'none';
            }

            this.atualizarProgresso(10, '🌍 Preparando buscas...');

            // Mapear escopo para o parâmetro da API
            let escopoDestino = undefined;
            if (escopo === 'brasil') escopoDestino = 'brasil';
            else if (escopo === 'internacional') escopoDestino = 'internacional';
            // 'todos' = não enviar (default)

            // ============================================================
            // BUSCA PARALELA POR COMBINAÇÃO DE DATAS
            // ============================================================
            const allResults = new Map(); // chave = destino, valor = melhor info

            const batchSize = 3; // buscar 3 combinações por vez para não sobrecarregar
            let completedCombos = 0;

            for (let i = 0; i < totalCombos; i += batchSize) {
                const batch = combinacoes.slice(i, i + batchSize);
                
                const promises = batch.map(combo => {
                    const comboLabel = `${this.formatarDataCurta(combo.dataIda)} → ${this.formatarDataCurta(combo.dataVolta)}`;
                    
                    if (isFlexivel) {
                        document.getElementById('loading-combinacao').textContent = 
                            `Pesquisando: ${comboLabel}`;
                    }
                    
                    return fetch('/api/search-destinations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            origem: origem.code,
                            dataIda: combo.dataIda,
                            dataVolta: combo.dataVolta,
                            moeda,
                            escopoDestino,
                        })
                    })
                    .then(async (res) => {
                        if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            this.log(`⚠️ Combo ${comboLabel}: ${err.message || res.status}`);
                            return { combo, destinations: [], error: err.message };
                        }
                        const data = await res.json();
                        this.log(`✅ Combo ${comboLabel}: ${data.destinations?.length || 0} destinos`);
                        return { combo, destinations: data.destinations || [], error: null };
                    })
                    .catch(err => {
                        this.error(`Erro combo ${comboLabel}:`, err);
                        return { combo, destinations: [], error: err.message };
                    });
                });

                const batchResults = await Promise.all(promises);
                
                // Consolidar resultados deste batch
                for (const result of batchResults) {
                    if (!result.destinations || result.destinations.length === 0) continue;
                    
                    for (const dest of result.destinations) {
                        if (!dest.name || !dest.flight?.price || dest.flight.price <= 0) continue;
                        
                        const key = `${dest.name.toLowerCase()}_${(dest.country || '').toLowerCase()}`;
                        const existing = allResults.get(key);
                        
                        const noites = this.calcularNoites(result.combo.dataIda, result.combo.dataVolta);
                        
                        if (!existing || dest.flight.price < existing.flight.price) {
                            allResults.set(key, {
                                ...dest,
                                _melhorCombo: result.combo,
                                _melhorNoites: noites,
                                _totalCombos: existing ? existing._totalCombos + 1 : 1,
                                _todasOpcoes: existing 
                                    ? [...existing._todasOpcoes, { combo: result.combo, price: dest.flight.price, noites }]
                                    : [{ combo: result.combo, price: dest.flight.price, noites }],
                            });
                        } else {
                            existing._totalCombos++;
                            existing._todasOpcoes.push({ 
                                combo: result.combo, 
                                price: dest.flight.price, 
                                noites 
                            });
                        }
                    }
                }

                completedCombos += batch.length;
                const pct = 20 + Math.floor((completedCombos / totalCombos) * 60);
                this.atualizarProgresso(pct, `💰 ${completedCombos}/${totalCombos} combinações pesquisadas...`);
            }

            this.atualizarProgresso(85, '✈️ Organizando resultados...');
            
            // Converter Map em array ordenado por preço
            const destinosOrdenados = Array.from(allResults.values())
                .sort((a, b) => a.flight.price - b.flight.price);

            if (destinosOrdenados.length === 0) {
                throw new Error('Nenhum destino encontrado para as combinações de datas selecionadas');
            }

            this.state.todosDestinos = destinosOrdenados;
            
            this.log(`✅ Total consolidado: ${destinosOrdenados.length} destinos únicos de ${totalCombos} combinação(ões)`);
            
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
    // GOOGLE FLIGHTS - PROTOBUF
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
        return { 'BRL': 'BRL', 'USD': 'USD', 'EUR': 'EUR' }[moeda] || 'BRL';
    },

    _getGoogleLocale(moeda) {
        return { 'BRL': 'pt-BR', 'USD': 'en', 'EUR': 'en' }[moeda] || 'pt-BR';
    },

    _getGoogleGl(moeda) {
        return { 'BRL': 'br', 'USD': 'us', 'EUR': 'de' }[moeda] || 'br';
    },

    buildGoogleFlightsUrl(originIata, destIata, departDate, returnDate, currency) {
        const tfs = this._buildTfsParam(originIata, destIata, departDate, returnDate);
        const tfu = this._buildTfuParam(1, 0, 0);
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

    formatarDataISO(data) {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    },

    formatarDataBR(data) {
        return data.toLocaleDateString('pt-BR');
    },

    formatarDataCurta(dataISO) {
        return new Date(dataISO + 'T12:00:00').toLocaleDateString('pt-BR', { 
            day: '2-digit', month: 'short' 
        });
    },

    formatarDataCompletaBR(dataISO) {
        return new Date(dataISO + 'T12:00:00').toLocaleDateString('pt-BR', { 
            day: '2-digit', month: 'short', year: 'numeric' 
        });
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
        const { origem, moeda, orcamento, combinacoes, modoData, escopo } = this.state.formData;
        const isFlexivel = combinacoes.length > 1;
        
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
        const flexMsg = isFlexivel 
            ? ` Pesquisei ${combinacoes.length} combinações de datas para encontrar os melhores preços!` 
            : '';

        const escopoEmoji = escopo === 'brasil' ? '🇧🇷' : escopo === 'internacional' ? '✈️' : '🌍';
        const escopoLabel = escopo === 'brasil' ? 'no Brasil' : escopo === 'internacional' ? 'internacionais' : '';

        if (dentroOrcamento.length === 0) {
            tripinhaMsg = `🐕 Opa! Não encontrei nenhum destino ${escopoLabel} dentro do seu orçamento de ${this.formatarPreco(orcamento, moeda)}.${flexMsg} Mas listei TODOS os ${destinos.length} destinos do mais barato ao mais caro. O mais em conta custa ${this.formatarPreco(maisBarato.flight.price, moeda)} — que tal aumentar um pouquinho o orçamento?`;
        } else if (dentroOrcamento.length === destinos.length) {
            tripinhaMsg = `🐕 Que beleza! TODOS os ${destinos.length} destinos ${escopoLabel} cabem no seu orçamento de ${this.formatarPreco(orcamento, moeda)}!${flexMsg} Os preços vão de ${this.formatarPreco(maisBarato.flight.price, moeda)} a ${this.formatarPreco(maisCaro.flight.price, moeda)}.`;
        } else {
            tripinhaMsg = `🐕 Achei ${dentroOrcamento.length} destinos ${escopoLabel} dentro do seu orçamento de ${this.formatarPreco(orcamento, moeda)} e mais ${foraOrcamento.length} opções acima.${flexMsg} Os preços vão de ${this.formatarPreco(maisBarato.flight.price, moeda)} até ${this.formatarPreco(maisCaro.flight.price, moeda)}.`;
        }

        const origemDisplay = origem.airport 
            ? `${origem.name} — ${origem.airport} (${origem.code})`
            : `${origem.name} (${origem.code})`;

        // Período exibido
        let periodoHtml = '';
        if (isFlexivel) {
            const todasIdas = [...new Set(combinacoes.map(c => c.dataIda))].sort();
            const todasVoltas = [...new Set(combinacoes.map(c => c.dataVolta))].sort();
            periodoHtml = `
                <div class="stat-item">
                    <span class="stat-label">Idas pesquisadas</span>
                    <span class="stat-value">🛫 ${todasIdas.map(d => this.formatarDataCurta(d)).join(' · ')}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Voltas pesquisadas</span>
                    <span class="stat-value">🛬 ${todasVoltas.map(d => this.formatarDataCurta(d)).join(' · ')}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Combinações</span>
                    <span class="stat-value blue">🔀 ${combinacoes.length} pesquisadas</span>
                </div>
            `;
        } else {
            const dataIdaBR = this.formatarDataCurta(this.state.formData.dataIda);
            const dataVoltaBR = this.formatarDataCompletaBR(this.state.formData.dataVolta);
            const noites = this.calcularNoites(this.state.formData.dataIda, this.state.formData.dataVolta);
            periodoHtml = `
                <div class="stat-item">
                    <span class="stat-label">Período</span>
                    <span class="stat-value">📅 ${dataIdaBR} → ${dataVoltaBR} (${noites} noites)</span>
                </div>
            `;
        }

        const escopoDisplay = escopo === 'brasil' ? '🇧🇷 Brasil' : escopo === 'internacional' ? '✈️ Internacional' : '🌍 Todos';

        const html = `
            <button class="btn-voltar-topo" onclick="BenetripTodosDestinos.voltarAoFormulario()">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
                </svg>
                Nova busca
            </button>

            <div class="resultados-header">
                <h1>${escopoEmoji} Todos os Destinos Disponíveis</h1>
                <div class="resultados-stats">
                    <div class="stat-item">
                        <span class="stat-label">De</span>
                        <span class="stat-value">📍 ${origemDisplay}</span>
                    </div>
                    ${periodoHtml}
                    <div class="stat-item">
                        <span class="stat-label">Escopo</span>
                        <span class="stat-value">${escopoDisplay}</span>
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
                ${destinos.map(d => this.renderDestinoCard(d, orcamento, isFlexivel)).join('')}
            </div>
        `;

        container.innerHTML = html;
        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    renderDestinoCard(destino, orcamento, isFlexivel) {
        const { origem, moeda } = this.state.formData;
        
        const dentroOrcamento = destino.flight.price <= orcamento;
        const preco = this.formatarPreco(destino.flight.price, moeda);
        
        const paradas = destino.flight.stops || 0;
        const paradasTexto = paradas === 0 ? 'Direto' : paradas === 1 ? '1 parada' : `${paradas} paradas`;
        
        const duracao = destino.flight.flight_duration_minutes || 0;
        const duracaoTexto = duracao > 0 ? `${Math.floor(duracao / 60)}h${duracao % 60}min` : '—';

        // Usar as melhores datas para o Google Flights link
        const melhorCombo = destino._melhorCombo || { 
            dataIda: this.state.formData.dataIda, 
            dataVolta: this.state.formData.dataVolta 
        };
        const noites = destino._melhorNoites || this.calcularNoites(melhorCombo.dataIda, melhorCombo.dataVolta);

        const googleFlightsUrl = this.buildGoogleFlightsUrl(
            origem.code,
            destino.primary_airport || destino.flight?.airport_code || '',
            melhorCombo.dataIda,
            melhorCombo.dataVolta,
            moeda
        );

        // Badge de melhor data (só em modo flexível)
        let bestDatesHtml = '';
        if (isFlexivel && destino._melhorCombo) {
            const idaCurta = this.formatarDataCurta(destino._melhorCombo.dataIda);
            const voltaCurta = this.formatarDataCurta(destino._melhorCombo.dataVolta);
            bestDatesHtml = `
                <div class="best-dates-badge">
                    📅 Melhor preço: ${idaCurta} → ${voltaCurta} (${noites} noites)
                </div>
            `;
        }

        // Custo estimado com hotel
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

        // Info de outras opções de datas
        let outrasOpcoesHtml = '';
        if (isFlexivel && destino._todasOpcoes && destino._todasOpcoes.length > 1) {
            outrasOpcoesHtml = `
                <div class="detalhe-item">
                    <span class="detalhe-icon">🔀</span>
                    <span>Encontrado em ${destino._todasOpcoes.length} combinações</span>
                </div>
            `;
        }

        return `
            <div class="destino-item ${dentroOrcamento ? 'dentro-orcamento' : 'fora-orcamento'}" data-filtro="${dentroOrcamento ? 'dentro' : 'fora'}">
                <span class="status-badge ${dentroOrcamento ? 'dentro' : 'fora'}">
                    ${dentroOrcamento ? '✓ Dentro do orçamento' : '⚠ Acima do orçamento'}
                </span>
                
                <div class="destino-header">
                    <div class="destino-info">
                        <h3 class="destino-nome">${destino.name}</h3>
                        <p class="destino-pais">${destino.country || '—'} · ${destino.primary_airport || destino.flight?.airport_code || ''}</p>
                        ${bestDatesHtml}
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
                    ${outrasOpcoesHtml}
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
        
        document.querySelectorAll('.btn-filtro').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filtro === filtro);
        });

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
