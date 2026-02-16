/**
 * BENETRIP - DESCOBRIR DESTINOS
 * Versão GOOGLE FLIGHTS v4.2 - BUGFIX CRÍTICO
 * 
 * CORREÇÃO v4.2:
 * ❌ BUG CORRIGIDO: Destinos dentro do orçamento não apareciam quando havia poucos resultados
 * ✅ SOLUÇÃO: Sempre mostra destinos válidos, independente da quantidade mínima
 * 
 * NOVIDADES v4.1:
 * - Botão "← Nova busca" no topo dos resultados para fácil retorno
 * - Gerenciamento de histórico do navegador (pushState/popstate)
 *   para que o botão "voltar" do celular retorne ao formulário
 *   em vez de sair da página e perder a simulação
 * NOVIDADES v4.0:
 * - Links agora direcionam para Google Flights com todos os parâmetros
 * - Protobuf encoding para construir URLs compatíveis com Google Flights
 * - Suporte completo: origem, destino, datas, adultos, crianças, bebês, moeda
 * - Classe de cabine: econômica (padrão)
 * - Auto-search ao abrir Google Flights com os parâmetros pré-preenchidos
 */

const BenetripDiscovery = {
    state: {
        cidadesData: null,
        origemSelecionada: null,
        formData: {},
        resultados: null,
        viewingResults: false
    },

    config: {
        debug: true,
        cidadesJsonPath: 'data/cidades_global_iata_v5.json'
    },

    log(...args) {
        if (this.config.debug) console.log('[Benetrip]', ...args);
    },

    error(...args) {
        console.error('[Benetrip ERROR]', ...args);
    },

    init() {
        this.log('🐕 Benetrip Discovery v4.2 (Bugfix Orçamento) inicializando...');
        
        this.carregarCidades();
        this.setupFormEvents();
        this.setupAutocomplete();
        this.setupCalendar();
        this.setupCompanhiaConditional();
        this.setupOptionButtons();
        this.setupNumberInput();
        this.setupFamiliaInputs();
        this.setupCurrencyInput();
        this.setupHistoryNavigation();
        
        this.log('✅ Inicialização completa');
    },

    setupHistoryNavigation() {
        window.addEventListener('popstate', (event) => {
            if (this.state.viewingResults) {
                this.log('🔙 Botão voltar interceptado — retornando ao formulário');
                this.voltarAoFormulario(true);
            }
        });
    },

    pushResultsState() {
        history.pushState({ benetripView: 'results' }, '', '');
        this.state.viewingResults = true;
        this.log('📌 History state pushed (results)');
    },

    async carregarCidades() {
        try {
            const response = await fetch(this.config.cidadesJsonPath);
            if (!response.ok) throw new Error('Erro ao carregar cidades');
            
            const dados = await response.json();
            this.state.cidadesData = dados.filter(c => c.iata);
            
            this.log(`✅ ${this.state.cidadesData.length} cidades carregadas (v5 com aeroportos reais)`);
        } catch (erro) {
            this.error('Erro ao carregar cidades:', erro);
            this.state.cidadesData = [
                { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", codigo_pais: "BR", iata: "GRU", aeroporto: "Aeroporto de Guarulhos" },
                { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", codigo_pais: "BR", iata: "CGH", aeroporto: "Aeroporto de Congonhas" },
                { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", codigo_pais: "BR", iata: "VCP", aeroporto: "Aeroporto de Viracopos" },
                { cidade: "Rio de Janeiro", sigla_estado: "RJ", pais: "Brasil", codigo_pais: "BR", iata: "GIG", aeroporto: "Aeroporto do Galeão" },
                { cidade: "Rio de Janeiro", sigla_estado: "RJ", pais: "Brasil", codigo_pais: "BR", iata: "SDU", aeroporto: "Aeroporto Santos Dumont" },
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

    setupCompanhiaConditional() {
        const companhiaInput = document.getElementById('companhia');
        const numPessoasGroup = document.getElementById('num-pessoas-group');
        const familiaGroup = document.getElementById('familia-group');
        
        if (!companhiaInput) return;
        
        companhiaInput.addEventListener('change', () => {
            const value = parseInt(companhiaInput.value);
            numPessoasGroup.style.display = (value === 3) ? 'block' : 'none';
            familiaGroup.style.display = (value === 2) ? 'block' : 'none';
        });
    },

    setupFamiliaInputs() {
        document.querySelectorAll('.btn-number-sm').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const action = btn.dataset.action;
                const input = document.getElementById(targetId);
                if (!input) return;

                const value = parseInt(input.value);
                const min = parseInt(input.min);
                const max = parseInt(input.max);

                if (action === 'increment' && value < max) {
                    input.value = value + 1;
                } else if (action === 'decrement' && value > min) {
                    input.value = value - 1;
                }

                this.validarFamilia();
                this.atualizarTotalFamilia();
            });
        });

        this.atualizarTotalFamilia();
    },

    validarFamilia() {
        const adultos = parseInt(document.getElementById('familia-adultos').value);
        const bebes = parseInt(document.getElementById('familia-bebes').value);
        
        if (bebes > adultos) {
            document.getElementById('familia-bebes').value = adultos;
        }
    },

    atualizarTotalFamilia() {
        const adultos = parseInt(document.getElementById('familia-adultos')?.value || 2);
        const criancas = parseInt(document.getElementById('familia-criancas')?.value || 0);
        const bebes = parseInt(document.getElementById('familia-bebes')?.value || 0);
        const total = adultos + criancas + bebes;
        
        const hint = document.getElementById('familia-total-hint');
        if (hint) {
            const parts = [];
            parts.push(`${adultos} adulto${adultos > 1 ? 's' : ''}`);
            if (criancas > 0) parts.push(`${criancas} criança${criancas > 1 ? 's' : ''}`);
            if (bebes > 0) parts.push(`${bebes} bebê${bebes > 1 ? 's' : ''}`);
            hint.textContent = `Total: ${total} passageiro${total > 1 ? 's' : ''} (${parts.join(', ')})`;
        }
    },

    setupOptionButtons() {
        document.querySelectorAll('.button-group').forEach(group => {
            const field = group.dataset.field;
            if (!field) return;
            
            const hiddenInput = document.getElementById(field);
            const isMulti = group.dataset.multi === 'true';
            
            group.querySelectorAll('.btn-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (isMulti) {
                        btn.classList.toggle('active');
                        const selected = [];
                        group.querySelectorAll('.btn-option.active').forEach(b => {
                            selected.push(b.dataset.value);
                        });
                        hiddenInput.value = selected.join(',');
                        this.log(`✅ ${field} (multi):`, selected);
                    } else {
                        group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        hiddenInput.value = btn.dataset.value;
                        this.log(`✅ ${field}:`, btn.dataset.value);
                    }
                    
                    hiddenInput.dispatchEvent(new Event('change'));
                });
            });
        });
    },

    setupNumberInput() {
        const input = document.getElementById('num-pessoas');
        const decrementBtn = document.querySelector('#num-pessoas-group .btn-number[data-action="decrement"]');
        const incrementBtn = document.querySelector('#num-pessoas-group .btn-number[data-action="increment"]');
        
        if (decrementBtn) {
            decrementBtn.addEventListener('click', () => {
                const value = parseInt(input.value);
                if (value > 2) input.value = value - 1;
            });
        }
        
        if (incrementBtn) {
            incrementBtn.addEventListener('click', () => {
                const value = parseInt(input.value);
                if (value < 20) input.value = value + 1;
            });
        }
    },

    setupCurrencyInput() {
        const input = document.getElementById('orcamento');
        const moedaInput = document.getElementById('moeda');
        const currencySymbol = document.querySelector('.currency-symbol');
        
        if (moedaInput && currencySymbol) {
            moedaInput.addEventListener('change', () => {
                const simbolos = { 'BRL': 'R$', 'USD': '$', 'EUR': '€' };
                currencySymbol.textContent = simbolos[moedaInput.value] || 'R$';
            });
        }
        
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

    setupFormEvents() {
        const form = document.getElementById('descobrir-form');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!this.validarFormulario()) {
                return;
            }
            
            this.coletarDadosFormulario();
            await this.buscarDestinos();
        });
    },

    validarFormulario() {
        if (!this.state.origemSelecionada) {
            alert('Por favor, selecione uma cidade de origem');
            document.getElementById('origem').focus();
            return false;
        }
        
        if (!document.getElementById('companhia').value) {
            alert('Por favor, escolha com quem você vai viajar');
            return false;
        }
        
        if (!document.getElementById('preferencias').value) {
            alert('Por favor, escolha ao menos um estilo de viagem');
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
        const companhia = parseInt(document.getElementById('companhia').value);
        
        let adultos = 1;
        let criancas = 0;
        let bebes = 0;
        let numPessoas = 1;

        switch (companhia) {
            case 0: adultos = 1; numPessoas = 1; break;
            case 1: adultos = 2; numPessoas = 2; break;
            case 2:
                adultos = parseInt(document.getElementById('familia-adultos').value) || 2;
                criancas = parseInt(document.getElementById('familia-criancas').value) || 0;
                bebes = parseInt(document.getElementById('familia-bebes').value) || 0;
                numPessoas = adultos + criancas + bebes;
                break;
            case 3:
                adultos = parseInt(document.getElementById('num-pessoas').value) || 2;
                numPessoas = adultos;
                break;
        }

        const prefString = document.getElementById('preferencias').value;
        const preferenciasArray = prefString.split(',').filter(Boolean);
        const escopoDestino = document.getElementById('escopo-destino').value || 'tanto_faz';

        this.state.formData = {
            origem: this.state.origemSelecionada,
            companhia: companhia,
            adultos: adultos,
            criancas: criancas,
            bebes: bebes,
            numPessoas: numPessoas,
            preferencias: prefString,
            preferenciasArray: preferenciasArray,
            escopoDestino: escopoDestino,
            dataIda: document.getElementById('data-ida').value,
            dataVolta: document.getElementById('data-volta').value,
            moeda: document.getElementById('moeda').value,
            orcamento: parseFloat(document.getElementById('orcamento').value.replace(/\./g, ''))
        };
        
        this.log('📝 Dados:', this.state.formData);
    },

    getSimbolo(moeda) {
        return { 'BRL': 'R$', 'USD': 'US$', 'EUR': '€' }[moeda] || 'R$';
    },

    formatarPreco(valor, moeda) {
        const simbolo = this.getSimbolo(moeda || this.state.formData.moeda);
        return `${simbolo} ${Math.round(valor).toLocaleString('pt-BR')}`;
    },

    COMPANHIA_LABELS: {
        0: { emoji: '🧳', texto: 'Sozinho(a)' },
        1: { emoji: '❤️', texto: 'Viagem romântica' },
        2: { emoji: '👨‍👩‍👧‍👦', texto: 'Em família' },
        3: { emoji: '🎉', texto: 'Com amigos' }
    },

    PREFERENCIAS_LABELS: {
        'relax':    { emoji: '🌊', texto: 'Relax total' },
        'aventura': { emoji: '🏔️', texto: 'Aventura e emoção' },
        'cultura':  { emoji: '🏛️', texto: 'Cultura e história' },
        'urbano':   { emoji: '🏙️', texto: 'Agito urbano' }
    },

    COMPANHIA_API_MAP: {
        0: 'Viajando sozinho(a)',
        1: 'Viagem romântica (casal)',
        2: 'Viagem em família',
        3: 'Viagem com amigos'
    },

    PREFERENCIAS_API_MAP: {
        'relax': 'Relaxamento, praias, descanso e natureza tranquila',
        'aventura': 'Aventura, trilhas, esportes radicais e natureza selvagem',
        'cultura': 'Cultura, museus, história, gastronomia e arquitetura',
        'urbano': 'Agito urbano, vida noturna, compras e experiências cosmopolitas'
    },

    getPreferenciasDescricao(prefArray) {
        if (!prefArray || prefArray.length === 0) return 'Não informado';
        return prefArray
            .map(p => this.PREFERENCIAS_API_MAP[p] || p)
            .join(' + ');
    },

    getPreferenciasResumo(prefArray) {
        if (!prefArray || prefArray.length === 0) return { emoji: '🎯', texto: 'Não informado' };
        const partes = prefArray.map(p => this.PREFERENCIAS_LABELS[p] || { emoji: '🎯', texto: p });
        return {
            emoji: partes.map(p => p.emoji).join(''),
            texto: partes.map(p => p.texto).join(' + ')
        };
    },

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

    buildGoogleFlightsUrl(originIata, destIata, departDate, returnDate, adults, children, infants, currency) {
        const tfs = this._buildTfsParam(originIata, destIata, departDate, returnDate);
        const tfu = this._buildTfuParam(adults, children, infants);
        const curr = this._getGoogleCurrency(currency);
        const hl = this._getGoogleLocale(currency);
        const gl = this._getGoogleGl(currency);

        const params = new URLSearchParams();
        params.set('tfs', tfs);
        params.set('tfu', tfu);
        params.set('curr', curr);
        params.set('hl', hl);
        params.set('gl', gl);

        const url = `https://www.google.com/travel/flights/search?${params.toString()}`;

        this.log('✈️ Google Flights URL:', {
            origin: originIata,
            destination: destIata,
            dates: `${departDate} → ${returnDate}`,
            passengers: `${adults}A ${children}C ${infants}I`,
            currency: curr,
            url: url
        });

        return url;
    },

    async buscarDestinos() {
        try {
            this.mostrarLoading();
            
            this.atualizarProgresso(15, '🔍 Buscando destinos pelo mundo...');
            const destinosDisponiveis = await this.buscarDestinosAPI();
            
            if (!destinosDisponiveis || destinosDisponiveis.length === 0) {
                throw new Error('Nenhum destino encontrado');
            }
            
            this.atualizarProgresso(40, '💰 Filtrando pelo seu orçamento...');
            const filtro = this.filtrarDestinos(destinosDisponiveis);
            
            if (filtro.cenario === 'nenhum') {
                this.atualizarProgresso(100, '😕 Nenhum destino encontrado...');
                await this.delay(500);
                this.mostrarSemResultados();
                return;
            }

            const destinosParaRanking = filtro.destinos;
            this.log(`📋 Cenário: ${filtro.cenario} | ${destinosParaRanking.length} destinos para ranking`);
            
            this.atualizarProgresso(60, '🤖 Tripinha analisando destinos...');
            const ranking = await this.ranquearDestinosAPI(destinosParaRanking, filtro.cenario);
            
            this.atualizarProgresso(80, '✈️ Gerando links do Google Flights...');
            const destinosComLinks = this.gerarLinksGoogleFlights(ranking);
            
            this.state.resultados = destinosComLinks;
            
            this.atualizarProgresso(100, '🎉 Pronto!');
            await this.delay(500);
            this.mostrarResultados(destinosComLinks, filtro.cenario, filtro.mensagem);
            
        } catch (erro) {
            this.error('Erro:', erro);
            alert(`Erro: ${erro.message}`);
            this.esconderLoading();
        }
    },

    async buscarDestinosAPI() {
        const response = await fetch('/api/search-destinations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origem: this.state.formData.origem.code,
                dataIda: this.state.formData.dataIda,
                dataVolta: this.state.formData.dataVolta,
                preferencias: this.state.formData.preferenciasArray,
                moeda: this.state.formData.moeda,
                escopoDestino: this.state.formData.escopoDestino
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Erro na API');
        }
        
        const data = await response.json();

        if (data._meta) {
            this.log('📊 Triple Search:', {
                global: data._meta.sources.global,
                continente: data._meta.sources.continente,
                pais: data._meta.sources.pais,
                total: data.total,
                tempo: `${data._meta.totalTime}ms`,
                moeda: data._meta.currency || 'BRL',
                escopo: data._meta.escopoDestino || 'tanto_faz'
            });
        }

        return data.destinations;
    },

    // ================================================================
    // v4.2: FILTRO DE ORÇAMENTO CORRIGIDO
    // SEMPRE MOSTRA DESTINOS VÁLIDOS, independente da quantidade mínima
    // ================================================================
    filtrarDestinos(destinos) {
        const { orcamento, moeda } = this.state.formData;
        const simbolo = this.getSimbolo(moeda);

        const comPreco = destinos.filter(d => (d.flight?.price || 0) > 0);
        
        if (comPreco.length === 0) {
            this.log('❌ Nenhum destino com preço disponível');
            return { cenario: 'nenhum', destinos: [], mensagem: '' };
        }

        // Sem orçamento definido → mostra tudo
        if (!orcamento) {
            return { cenario: 'ideal', destinos: comPreco, mensagem: '' };
        }

        // ============================================================
        // NOVA LÓGICA: Sempre mostra destinos dentro do orçamento
        // A quantidade define apenas a mensagem/cenário, não se mostra
        // ============================================================

        // 1. Faixa ideal: 80-100% do orçamento
        const faixa80 = comPreco.filter(d => d.flight.price >= orcamento * 0.8 && d.flight.price <= orcamento);
        
        // 2. Faixa boa: 60-100% do orçamento
        const faixa60 = comPreco.filter(d => d.flight.price >= orcamento * 0.6 && d.flight.price <= orcamento);
        
        // 3. Qualquer coisa abaixo do orçamento
        const abaixo = comPreco.filter(d => d.flight.price <= orcamento);

        // ============================================================
        // DECISÃO DE CENÁRIO (mas sempre mostra se tiver destinos!)
        // ============================================================

        // CENÁRIO IDEAL: 5+ destinos na faixa 80-100%
        if (faixa80.length >= 5) {
            this.log(`✅ IDEAL: ${faixa80.length} destinos na faixa 80-100%`);
            return { 
                cenario: 'ideal', 
                destinos: faixa80, 
                mensagem: '' 
            };
        }

        // CENÁRIO BOM: 3+ destinos na faixa 60-100%
        if (faixa60.length >= 3) {
            this.log(`👍 BOM: ${faixa60.length} destinos na faixa 60-100%`);
            return {
                cenario: 'bom',
                destinos: faixa60,
                mensagem: `🐕 A Tripinha encontrou os melhores destinos dentro do seu orçamento de ${simbolo} ${orcamento.toLocaleString('pt-BR')}. Confira as opções!`
            };
        }

        // ✅ CORREÇÃO v4.2: SEMPRE mostra se tiver destinos dentro do orçamento
        // (mesmo que seja 1 ou 2 destinos apenas)
        if (abaixo.length > 0) {
            this.log(`💡 DENTRO DO ORÇAMENTO: ${abaixo.length} destino(s) de até ${simbolo} ${orcamento.toLocaleString('pt-BR')}`);
            
            // Mensagem adaptada à quantidade
            let mensagem = '';
            if (abaixo.length === 1) {
                mensagem = `🐕 A Tripinha encontrou 1 destino dentro do seu orçamento de ${simbolo} ${orcamento.toLocaleString('pt-BR')}. É uma ótima opção!`;
            } else if (abaixo.length === 2) {
                mensagem = `🐕 A Tripinha encontrou 2 destinos dentro do seu orçamento de ${simbolo} ${orcamento.toLocaleString('pt-BR')}. Confira!`;
            } else {
                mensagem = `🐕 Não encontrei muitas opções próximas ao orçamento ideal, mas achei ${abaixo.length} destinos dentro de ${simbolo} ${orcamento.toLocaleString('pt-BR')} que podem te interessar!`;
            }

            return {
                cenario: 'abaixo',
                destinos: abaixo,
                mensagem: mensagem
            };
        }

        // SÓ RETORNA "NENHUM" se REALMENTE não tiver nada dentro do orçamento
        this.log(`❌ Nenhum destino dentro do orçamento de ${simbolo} ${orcamento.toLocaleString('pt-BR')}`);
        
        // Debug adicional para investigação
        const maisBarato = comPreco.reduce((min, d) => 
            d.flight.price < min ? d.flight.price : min, 
            Infinity
        );
        this.log(`💰 Destino mais barato disponível: ${simbolo} ${maisBarato.toLocaleString('pt-BR')}`);
        
        return { 
            cenario: 'nenhum', 
            destinos: [], 
            mensagem: '' 
        };
    },

    calcularNoites(dataIda, dataVolta) {
        const ida = new Date(dataIda);
        const volta = new Date(dataVolta);
        return Math.ceil((volta - ida) / (1000 * 60 * 60 * 24));
    },

    async ranquearDestinosAPI(destinos, cenario) {
        const { formData } = this.state;
        const noites = this.calcularNoites(formData.dataIda, formData.dataVolta);

        let companhiaDesc = this.COMPANHIA_API_MAP[formData.companhia] || 'Não informado';
        if (formData.companhia === 2) {
            const parts = [`${formData.adultos} adulto(s)`];
            if (formData.criancas > 0) parts.push(`${formData.criancas} criança(s) de 2-11 anos`);
            if (formData.bebes > 0) parts.push(`${formData.bebes} bebê(s) de 0-1 ano`);
            companhiaDesc = `Viagem em família: ${parts.join(', ')}`;
        }

        const response = await fetch('/api/rank-destinations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destinos: destinos,
                preferencias: this.getPreferenciasDescricao(formData.preferenciasArray),
                companhia: companhiaDesc,
                numPessoas: formData.numPessoas,
                adultos: formData.adultos,
                criancas: formData.criancas,
                bebes: formData.bebes,
                noites: noites,
                orcamento: formData.orcamento,
                moeda: formData.moeda,
                dataIda: formData.dataIda,
                dataVolta: formData.dataVolta,
                cenario: cenario || 'ideal'
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Erro no ranking');
        }
        
        const ranking = await response.json();

        if (ranking._model) {
            this.log(`🤖 Modelo: ${ranking._model} | Analisados: ${ranking._totalAnalisados}`);
        }

        return ranking;
    },

    gerarLinksGoogleFlights(ranking) {
        const { origem, dataIda, dataVolta, adultos, criancas, bebes, moeda } = this.state.formData;

        const gerarLink = (d) => {
            if (!d?.primary_airport) return '#';

            return this.buildGoogleFlightsUrl(
                origem.code,
                d.primary_airport,
                dataIda,
                dataVolta,
                adultos,
                criancas,
                bebes,
                moeda
            );
        };
        
        return {
            top_destino: { ...ranking.top_destino, link: gerarLink(ranking.top_destino) },
            alternativas: (ranking.alternativas || []).map(d => ({ ...d, link: gerarLink(d) })),
            surpresa: ranking.surpresa ? { ...ranking.surpresa, link: gerarLink(ranking.surpresa) } : null,
            _model: ranking._model,
            _totalAnalisados: ranking._totalAnalisados,
            _poucosResultados: ranking._poucosResultados || false,
        };
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

    voltarAoFormulario(fromPopstate) {
        document.getElementById('resultados-container').style.display = 'none';
        document.getElementById('resultados-container').innerHTML = '';
        document.getElementById('form-container').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('progress-fill').style.width = '0%';
        
        this.state.viewingResults = false;
        
        if (!fromPopstate) {
            if (history.state && history.state.benetripView === 'results') {
                history.back();
            }
        }
        
        this.log('🔄 Voltou ao formulário com dados preservados');
    },

    gerarBotaoVoltarTopo() {
        return `
            <button class="btn-voltar-topo" onclick="BenetripDiscovery.voltarAoFormulario()">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 12H5"/>
                    <path d="M12 19l-7-7 7-7"/>
                </svg>
                Nova busca
            </button>
        `;
    },

    gerarResumoCriterios() {
        const { origem, companhia, adultos, criancas, bebes, numPessoas, preferenciasArray, escopoDestino, dataIda, dataVolta, moeda, orcamento } = this.state.formData;
        const noites = this.calcularNoites(dataIda, dataVolta);
        const simbolo = this.getSimbolo(moeda);
        
        const comp = this.COMPANHIA_LABELS[companhia] || { emoji: '👤', texto: 'Não informado' };
        const pref = this.getPreferenciasResumo(preferenciasArray);
        
        const dataIdaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        const dataVoltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

        let pessoasInfo = '';
        if (companhia === 0) {
            pessoasInfo = '1 adulto';
        } else if (companhia === 1) {
            pessoasInfo = '2 adultos';
        } else if (companhia === 2) {
            const parts = [`${adultos} adulto${adultos > 1 ? 's' : ''}`];
            if (criancas > 0) parts.push(`${criancas} criança${criancas > 1 ? 's' : ''}`);
            if (bebes > 0) parts.push(`${bebes} bebê${bebes > 1 ? 's' : ''}`);
            pessoasInfo = parts.join(', ');
        } else {
            pessoasInfo = `${numPessoas} adultos`;
        }

        const origemDisplay = origem.airport 
            ? `${origem.name} — ${origem.airport} (${origem.code})`
            : `${origem.name} (${origem.code})`;

        const escopoLabel = escopoDestino === 'internacional' 
            ? '✈️ Apenas internacionais' 
            : '🗺️ Nacionais e internacionais';

        return `
            <div class="criterios-resumo">
                <div class="criterios-titulo">
                    <span class="criterios-icon">🐕</span>
                    <span>A Tripinha buscou com base no seu perfil:</span>
                </div>
                <div class="criterios-grid">
                    <div class="criterio-item">
                        <span class="criterio-label">Saindo de</span>
                        <span class="criterio-valor">📍 ${origemDisplay}</span>
                    </div>
                    <div class="criterio-item">
                        <span class="criterio-label">Companhia</span>
                        <span class="criterio-valor">${comp.emoji} ${comp.texto} · ${pessoasInfo}</span>
                    </div>
                    <div class="criterio-item">
                        <span class="criterio-label">Estilo</span>
                        <span class="criterio-valor">${pref.emoji} ${pref.texto}</span>
                    </div>
                    <div class="criterio-item">
                        <span class="criterio-label">Destinos</span>
                        <span class="criterio-valor">${escopoLabel}</span>
                    </div>
                    <div class="criterio-item">
                        <span class="criterio-label">Período</span>
                        <span class="criterio-valor">📅 ${dataIdaBR} → ${dataVoltaBR} · ${noites} noites</span>
                    </div>
                    <div class="criterio-item">
                        <span class="criterio-label">Orçamento</span>
                        <span class="criterio-valor">💰 Até ${simbolo} ${orcamento.toLocaleString('pt-BR')} por pessoa (ida+volta)</span>
                    </div>
                </div>
            </div>
        `;
    },

    mostrarSemResultados() {
        const container = document.getElementById('resultados-container');
        const { orcamento, moeda, origem, escopoDestino } = this.state.formData;
        const simbolo = this.getSimbolo(moeda);

        const isInternacional = escopoDestino === 'internacional';

        this.pushResultsState();

        container.innerHTML = `
            ${this.gerarBotaoVoltarTopo()}

            <div class="sem-resultados">
                <img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="tripinha-triste" 
                     onerror="this.style.display='none'">
                <h2>😕 Puxa, não encontrei destinos...</h2>
                <p class="sem-resultados-msg">
                    A Tripinha procurou por todo canto, mas não encontrou passagens 
                    ${isInternacional ? '<strong>internacionais</strong>' : ''} 
                    saindo de <strong>${origem.name} (${origem.code})</strong> dentro do orçamento de 
                    <strong>${simbolo} ${orcamento?.toLocaleString('pt-BR') || '?'}</strong> para essas datas.
                </p>
                <div class="sem-resultados-dicas">
                    <h3>🐕 Dicas da Tripinha:</h3>
                    <div class="dica">💰 <strong>Aumente o orçamento</strong> — às vezes um pouco mais abre muitas opções!</div>
                    <div class="dica">📅 <strong>Tente outras datas</strong> — viajar em dias da semana costuma ser mais barato.</div>
                    ${isInternacional ? '<div class="dica">🗺️ <strong>Inclua destinos nacionais</strong> — selecione "Tanto faz" para mais opções!</div>' : ''}
                    <div class="dica">📍 <strong>Mude a cidade de origem</strong> — aeroportos maiores têm mais rotas e preços melhores.</div>
                    <div class="dica">🌍 <strong>Experimente outros estilos</strong> — pode revelar destinos menos óbvios!</div>
                </div>
                <button class="btn-submit btn-tentar-novamente" onclick="BenetripDiscovery.voltarAoFormulario()">
                    ✏️ Ajustar Busca
                </button>
            </div>
        `;

        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    mostrarResultados(destinos, cenario, mensagem) {
        const container = document.getElementById('resultados-container');
        const { dataIda, dataVolta, moeda, numPessoas } = this.state.formData;
        const noites = this.calcularNoites(dataIda, dataVolta);
        
        this.pushResultsState();

        const formatPreco = (d) => this.formatarPreco(d.flight?.price || 0, moeda);
        
        const formatParadas = (d) => {
            const stops = d.flight?.stops || 0;
            if (stops === 0) return '✈️ Voo direto';
            if (stops === 1) return '✈️ 1 parada';
            return `✈️ ${stops} paradas`;
        };

        const fonteBadge = (d) => {
            const count = d._source_count || 1;
            if (count >= 3) return '<span class="fonte-badge fonte-alta" title="Encontrado em 3 buscas diferentes">⭐ Alta confiança</span>';
            if (count >= 2) return '<span class="fonte-badge fonte-media" title="Encontrado em 2 buscas diferentes">✓ Confirmado</span>';
            return '';
        };

        const custoEstimado = (d) => {
            const passagem = d.flight?.price || 0;
            const hotelTotalQuarto = (d.avg_cost_per_night || 0) * noites;
            
            if (hotelTotalQuarto > 0) {
                const hotelPorPessoa = numPessoas > 1 
                    ? hotelTotalQuarto / numPessoas 
                    : hotelTotalQuarto;
                
                const custoTotal = passagem + hotelPorPessoa;
                
                let detalheTexto = `(voo + ${noites} noites hotel`;
                if (numPessoas > 1) {
                    detalheTexto += ` ÷ ${numPessoas} pessoas`;
                }
                detalheTexto += ')';
                
                return `<div class="custo-estimado">
                    <span class="custo-label">Estimativa total/pessoa:</span>
                    <span class="custo-valor">${this.formatarPreco(custoTotal, moeda)}</span>
                    <span class="custo-detalhe">${detalheTexto}</span>
                </div>`;
            }
            return '';
        };

        const comentarioHtml = (d) => {
            if (!d.comentario) return '';
            return `<div class="destino-comentario">${d.comentario}</div>`;
        };

        const dicaHtml = (d) => {
            if (!d.dica) return '';
            return `<div class="destino-dica"><span class="dica-icon">💡</span> ${d.dica}</div>`;
        };

        const totalExibidos = 1 
            + (destinos.alternativas?.length || 0) 
            + (destinos.surpresa ? 1 : 0);
        const poucosResultados = destinos._poucosResultados || totalExibidos < 5;

        let bannerPoucosResultados = '';
        if (poucosResultados) {
            bannerPoucosResultados = `
                <div class="resultado-banner banner-poucos-resultados">
                    <p>🐕 A Tripinha encontrou ${totalExibidos === 1 ? 'apenas 1 destino que se encaixa' : `apenas ${totalExibidos} destinos que se encaixam`} no seu perfil e orçamento. 
                    ${totalExibidos === 1 ? 'Mas é uma ótima opção!' : 'São poucas opções, mas todas combinam com o que você busca!'}
                    Experimente ajustar datas ou orçamento para mais resultados.</p>
                </div>
            `;
        }

        const googleFlightsBtnLabel = 'Buscar no Google Flights';
        const googleFlightsBtnIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`;

        let alternativasHtml = '';
        if (destinos.alternativas && destinos.alternativas.length > 0) {
            alternativasHtml = `
                <div class="alternativas-section">
                    <h3>📋 Outras Opções</h3>
                    <div class="alternativas-grid">
                        ${destinos.alternativas.map(d => `
                            <div class="destino-card">
                                ${fonteBadge(d)}
                                <h4>${d.name}${d.country ? ', ' + d.country : ''}</h4>
                                <div class="preco">${formatPreco(d)}</div>
                                <div class="preco-label">ida e volta por pessoa</div>
                                <div class="flight-info">${formatParadas(d)}</div>
                                ${custoEstimado(d)}
                                <div class="descricao">${d.razao || 'Boa opção!'}</div>
                                ${comentarioHtml(d)}
                                ${dicaHtml(d)}
                                <a href="${d.link}" target="_blank" rel="noopener" class="btn-ver-voos btn-google-flights">${googleFlightsBtnIcon} ${googleFlightsBtnLabel} →</a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        let surpresaHtml = '';
        if (destinos.surpresa) {
            surpresaHtml = `
                <div class="surpresa-card">
                    <div class="badge">🎁 DESTINO SURPRESA</div>
                    ${fonteBadge(destinos.surpresa)}
                    <h3>${destinos.surpresa.name}${destinos.surpresa.country ? ', ' + destinos.surpresa.country : ''}</h3>
                    <div class="preco">${formatPreco(destinos.surpresa)}</div>
                    <div class="preco-label">ida e volta por pessoa</div>
                    <div class="flight-info">${formatParadas(destinos.surpresa)}</div>
                    ${custoEstimado(destinos.surpresa)}
                    <div class="descricao">${destinos.surpresa.razao || 'Descubra!'}</div>
                    ${comentarioHtml(destinos.surpresa)}
                    ${dicaHtml(destinos.surpresa)}
                    <a href="${destinos.surpresa.link}" target="_blank" rel="noopener" class="btn-ver-voos btn-google-flights">${googleFlightsBtnIcon} Descobrir no Google Flights ✈️</a>
                </div>
            `;
        }

        const html = `
            ${this.gerarBotaoVoltarTopo()}

            ${this.gerarResumoCriterios()}

            <div class="resultado-header">
                <h1>${cenario === 'ideal' && !poucosResultados ? '🎉 Destinos Perfeitos!' : poucosResultados ? '✈️ Destinos Encontrados' : '✈️ Destinos Encontrados!'}</h1>
                <p class="resultado-subtitulo">
                    ${destinos._totalAnalisados ? `${destinos._totalAnalisados} destinos analisados` : ''}
                    ${destinos._model && destinos._model !== 'fallback_price' ? ' · Curadoria da Tripinha 🐶' : ''}
                </p>
                <p class="resultado-google-flights-info">
                    🔗 Os links abrem diretamente no <strong>Google Flights</strong> com suas preferências pré-preenchidas
                </p>
            </div>

            ${bannerPoucosResultados}

            ${mensagem && !poucosResultados ? `
            <div class="resultado-banner ${cenario === 'abaixo' ? 'banner-aviso' : 'banner-info'}">
                <p>${mensagem}</p>
            </div>
            ` : ''}

            <div class="top-destino">
                <div class="badge">🏆 ${totalExibidos === 1 ? 'DESTINO ENCONTRADO' : 'MELHOR DESTINO PARA VOCÊ'}</div>
                ${fonteBadge(destinos.top_destino)}
                <h2>${destinos.top_destino.name}, ${destinos.top_destino.country || ''}</h2>
                <div class="preco">${formatPreco(destinos.top_destino)}</div>
                <div class="preco-label">Passagem ida e volta por pessoa</div>
                <div class="flight-info">${formatParadas(destinos.top_destino)}</div>
                ${custoEstimado(destinos.top_destino)}
                <div class="descricao">${destinos.top_destino.razao || 'Perfeito para você!'}</div>
                ${comentarioHtml(destinos.top_destino)}
                ${dicaHtml(destinos.top_destino)}
                <a href="${destinos.top_destino.link}" target="_blank" rel="noopener" class="btn-ver-voos btn-google-flights btn-google-flights-destaque">${googleFlightsBtnIcon} ${googleFlightsBtnLabel} ✈️</a>
            </div>

            ${alternativasHtml}

            ${surpresaHtml}

            <div class="buscar-novamente-section">
                <p class="buscar-novamente-texto">
                    ${poucosResultados 
                        ? 'Quer ver mais opções? Ajuste datas, orçamento ou estilo de viagem para descobrir mais destinos!' 
                        : 'Quer explorar outras opções? Ajuste seus critérios e descubra mais!'}
                </p>
                <button class="btn-buscar-novamente" onclick="BenetripDiscovery.voltarAoFormulario()">
                    ✏️ Ajustar Busca e Descobrir Mais
                </button>
            </div>
        `;
        
        container.innerHTML = html;
        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

document.addEventListener('DOMContentLoaded', () => BenetripDiscovery.init());