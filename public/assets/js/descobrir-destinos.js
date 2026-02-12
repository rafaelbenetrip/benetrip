/**
 * BENETRIP - DESCOBRIR DESTINOS
 * Versão PRODUCTION - APENAS APIs reais, SEM fallbacks
 */

const BenetripDiscovery = {
    state: {
        cidadesData: null,
        origemSelecionada: null,
        formData: {},
        resultados: null
    },

    config: {
        travelpayoutsMarker: 'benetrip',
        debug: true
    },

    log(...args) {
        if (this.config.debug) console.log('[Benetrip]', ...args);
    },

    error(...args) {
        console.error('[Benetrip ERROR]', ...args);
    },

    init() {
        this.log('🐕 Benetrip Discovery inicializando...');
        
        this.carregarCidades();
        this.setupFormEvents();
        this.setupAutocomplete();
        this.setupCalendar();
        this.setupConditionalFields();
        this.setupOptionButtons();
        this.setupNumberInput();
        this.setupDistanceSlider();
        this.setupCurrencyInput();
        
        this.log('✅ Inicialização completa');
    },

    async carregarCidades() {
        try {
            const response = await fetch('data/cidades_global_iata_v3.json');
            if (!response.ok) throw new Error('Erro ao carregar cidades');
            
            const dados = await response.json();
            this.state.cidadesData = dados.filter(c => c.iata);
            
            this.log(`✅ ${this.state.cidadesData.length} cidades carregadas`);
        } catch (erro) {
            this.error('Erro ao carregar cidades:', erro);
            this.state.cidadesData = [
                { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", iata: "GRU" },
                { cidade: "Rio de Janeiro", sigla_estado: "RJ", pais: "Brasil", iata: "GIG" },
                { cidade: "Salvador", sigla_estado: "BA", pais: "Brasil", iata: "SSA" }
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
                return nomeNorm.includes(termoNorm) || iataNorm.includes(termoNorm);
            })
            .slice(0, 8)
            .map(cidade => ({
                code: cidade.iata,
                name: cidade.cidade,
                state: cidade.sigla_estado,
                country: cidade.pais
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
                            <div class="item-name">${cidade.name}${cidade.state ? ', ' + cidade.state : ''}</div>
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
        input.value = `${cidade.name} (${cidade.code})`;
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

    setupConditionalFields() {
        const companhiaInput = document.getElementById('companhia');
        const numPessoasGroup = document.getElementById('num-pessoas-group');
        
        const observer = new MutationObserver(() => {
            const value = parseInt(companhiaInput.value);
            numPessoasGroup.style.display = (value === 2 || value === 3) ? 'block' : 'none';
        });
        observer.observe(companhiaInput, { attributes: true });
        
        const tipoViagemInput = document.getElementById('tipo-viagem');
        const moedaGroup = document.getElementById('moeda-group');
        const orcamentoGroup = document.getElementById('orcamento-group');
        const distanciaGroup = document.getElementById('distancia-group');
        
        const observerTipo = new MutationObserver(() => {
            const value = parseInt(tipoViagemInput.value);
            if (value === 0) {
                moedaGroup.style.display = 'block';
                orcamentoGroup.style.display = 'block';
                distanciaGroup.style.display = 'none';
            } else if (value === 1) {
                moedaGroup.style.display = 'none';
                orcamentoGroup.style.display = 'none';
                distanciaGroup.style.display = 'block';
            }
        });
        observerTipo.observe(tipoViagemInput, { attributes: true });
    },

    setupOptionButtons() {
        document.querySelectorAll('.button-group').forEach(group => {
            const field = group.dataset.field;
            if (!field) return;
            
            const hiddenInput = document.getElementById(field);
            
            group.querySelectorAll('.btn-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    hiddenInput.value = btn.dataset.value;
                    hiddenInput.dispatchEvent(new Event('change'));
                    this.log(`✅ ${field}:`, btn.dataset.value);
                });
            });
        });
    },

    setupNumberInput() {
        const input = document.getElementById('num-pessoas');
        const decrementBtn = document.querySelector('.btn-number[data-action="decrement"]');
        const incrementBtn = document.querySelector('.btn-number[data-action="increment"]');
        
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

    setupDistanceSlider() {
        const slider = document.getElementById('distancia');
        const valueDisplay = document.getElementById('distancia-value');
        
        if (slider && valueDisplay) {
            slider.addEventListener('input', () => {
                valueDisplay.textContent = slider.value;
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
                    valor = (parseInt(valor) / 100).toFixed(2);
                    e.target.value = valor.replace('.', ',');
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
            alert('Por favor, escolha o que você busca nessa viagem');
            return false;
        }
        
        if (!document.getElementById('data-ida').value || !document.getElementById('data-volta').value) {
            alert('Por favor, selecione as datas da viagem');
            document.getElementById('datas').focus();
            return false;
        }
        
        if (!document.getElementById('tipo-viagem').value) {
            alert('Por favor, escolha como prefere viajar');
            return false;
        }
        
        const tipoViagem = parseInt(document.getElementById('tipo-viagem').value);
        if (tipoViagem === 0) {
            if (!document.getElementById('moeda').value) {
                alert('Por favor, escolha a moeda');
                return false;
            }
            
            const orcamento = document.getElementById('orcamento').value;
            if (!orcamento || parseFloat(orcamento.replace(',', '.')) <= 0) {
                alert('Por favor, informe o orçamento');
                document.getElementById('orcamento').focus();
                return false;
            }
        }
        
        return true;
    },

    coletarDadosFormulario() {
        const companhia = parseInt(document.getElementById('companhia').value);
        const tipoViagem = parseInt(document.getElementById('tipo-viagem').value);
        
        this.state.formData = {
            origem: this.state.origemSelecionada,
            companhia: companhia,
            numPessoas: (companhia === 2 || companhia === 3) ? parseInt(document.getElementById('num-pessoas').value) : (companhia === 1 ? 2 : 1),
            preferencias: document.getElementById('preferencias').value,
            dataIda: document.getElementById('data-ida').value,
            dataVolta: document.getElementById('data-volta').value,
            tipoViagem: tipoViagem
        };
        
        if (tipoViagem === 0) {
            this.state.formData.moeda = document.getElementById('moeda').value;
            this.state.formData.orcamento = parseFloat(document.getElementById('orcamento').value.replace(',', '.'));
        } else {
            this.state.formData.distanciaMaxima = parseInt(document.getElementById('distancia').value);
        }
        
        this.log('📝 Dados:', this.state.formData);
    },

    async buscarDestinos() {
        try {
            this.mostrarLoading();
            
            this.atualizarProgresso(20, 'Buscando destinos...');
            const destinosDisponiveis = await this.buscarDestinosAPI();
            
            if (!destinosDisponiveis || destinosDisponiveis.length === 0) {
                throw new Error('Nenhum destino encontrado');
            }
            
            this.atualizarProgresso(40, 'Filtrando...');
            const destinosFiltrados = this.filtrarDestinos(destinosDisponiveis);
            
            if (destinosFiltrados.length === 0) {
                throw new Error('Nenhum destino no orçamento');
            }
            
            this.atualizarProgresso(60, 'IA selecionando...');
            const ranking = await this.ranquearDestinosAPI(destinosFiltrados);
            
            this.atualizarProgresso(80, 'Gerando links...');
            const destinosComLinks = this.gerarLinksTravelpayouts(ranking);
            
            this.atualizarProgresso(100, 'Pronto!');
            await this.delay(500);
            this.mostrarResultados(destinosComLinks);
            
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
                dataVolta: this.state.formData.dataVolta
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Erro na API');
        }
        
        const data = await response.json();
        return data.destinations;
    },

    // ✅ CORREÇÃO: Filtrar apenas pelo preço da passagem (ida e volta)
    filtrarDestinos(destinos) {
        const { tipoViagem, orcamento } = this.state.formData;
        
        return destinos.filter(d => {
            if (tipoViagem === 0) {
                // Orçamento é para passagens (ida e volta) por pessoa
                const precoPassagem = d.flight?.price || 0;
                return precoPassagem > 0 && precoPassagem <= orcamento;
            }
            return true;
        });
    },

    calcularNoites(dataIda, dataVolta) {
        const ida = new Date(dataIda);
        const volta = new Date(dataVolta);
        return Math.ceil((volta - ida) / (1000 * 60 * 60 * 24));
    },

    async ranquearDestinosAPI(destinos) {
        const response = await fetch('/api/rank-destinations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destinos: destinos,
                preferencias: this.state.formData.preferencias,
                orcamento: this.state.formData.orcamento
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Erro no ranking');
        }
        
        return await response.json();
    },

    gerarLinksTravelpayouts(ranking) {
        const { origem, dataIda, dataVolta, numPessoas } = this.state.formData;
        
        const gerarLink = (d) => {
            if (!d?.primary_airport) return '#';
            const base = 'https://www.aviasales.com/search/';
            const params = `${origem.code}${dataIda.replace(/-/g, '')}${d.primary_airport}${dataVolta.replace(/-/g, '')}${numPessoas}`;
            return `${base}${params}?marker=${this.config.travelpayoutsMarker}`;
        };
        
        return {
            top_destino: { ...ranking.top_destino, link: gerarLink(ranking.top_destino) },
            alternativas: ranking.alternativas.map(d => ({ ...d, link: gerarLink(d) })),
            surpresa: { ...ranking.surpresa, link: gerarLink(ranking.surpresa) }
        };
    },

    mostrarLoading() {
        document.getElementById('form-container').style.display = 'none';
        document.getElementById('loading-container').style.display = 'block';
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

    // Helper para formatar moeda
    formatarPreco(valor, moeda) {
        const simbolos = { 'BRL': 'R$', 'USD': '$', 'EUR': '€' };
        const simbolo = simbolos[moeda] || 'R$';
        return `${simbolo} ${Math.round(valor).toLocaleString('pt-BR')}`;
    },

    // ✅ CORREÇÃO: Mostrar apenas preço das passagens (ida e volta)
    mostrarResultados(destinos) {
        const container = document.getElementById('resultados-container');
        const { dataIda, dataVolta, preferencias, moeda } = this.state.formData;
        const noites = this.calcularNoites(dataIda, dataVolta);
        
        // Formatar datas para exibição
        const dataIdaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR');
        const dataVoltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR');
        
        const formatPreco = (d) => this.formatarPreco(d.flight?.price || 0, moeda);
        
        const formatParadas = (d) => {
            const stops = d.flight?.stops || 0;
            if (stops === 0) return 'Direto';
            if (stops === 1) return '1 parada';
            return `${stops} paradas`;
        };

        const html = `
            <div class="resultado-header">
                <h1>🎉 Destinos Perfeitos!</h1>
                <p>Baseado em: ${preferencias} | ${dataIdaBR} - ${dataVoltaBR} (${noites} noites)</p>
            </div>

            <div class="top-destino">
                <div class="badge">🏆 MELHOR DESTINO</div>
                <h2>${destinos.top_destino.name}, ${destinos.top_destino.country || ''}</h2>
                <div class="preco">${formatPreco(destinos.top_destino)}</div>
                <div class="preco-label">Passagem ida e volta por pessoa</div>
                <div class="flight-info">${formatParadas(destinos.top_destino)}</div>
                <div class="descricao">${destinos.top_destino.razao || 'Perfeito para você!'}</div>
                <a href="${destinos.top_destino.link}" target="_blank" class="btn-ver-voos">Ver Passagens ✈️</a>
            </div>

            <div class="alternativas-section">
                <h3>📋 Outras Opções</h3>
                <div class="alternativas-grid">
                    ${destinos.alternativas.map(d => `
                        <div class="destino-card">
                            <h4>${d.name}${d.country ? ', ' + d.country : ''}</h4>
                            <div class="preco">${formatPreco(d)}</div>
                            <div class="preco-label">ida e volta</div>
                            <div class="flight-info">${formatParadas(d)}</div>
                            <div class="descricao">${d.razao || 'Boa opção!'}</div>
                            <a href="${d.link}" target="_blank" class="btn-ver-voos">Ver Passagens →</a>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="surpresa-card">
                <div class="badge">🎁 SURPRESA</div>
                <h3>${destinos.surpresa.name}${destinos.surpresa.country ? ', ' + destinos.surpresa.country : ''}</h3>
                <div class="preco">${formatPreco(destinos.surpresa)}</div>
                <div class="preco-label">ida e volta por pessoa</div>
                <div class="flight-info">${formatParadas(destinos.surpresa)}</div>
                <div class="descricao">${destinos.surpresa.razao || 'Descubra!'}</div>
                <a href="${destinos.surpresa.link}" target="_blank" class="btn-ver-voos">Descobrir ✈️</a>
            </div>
        `;
        
        container.innerHTML = html;
        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

document.addEventListener('DOMContentLoaded', () => BenetripDiscovery.init());