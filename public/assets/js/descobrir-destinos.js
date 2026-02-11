/**
 * BENETRIP - DESCOBRIR DESTINOS
 * Versão MVP simplificada - Formulário + SearchAPI + Groq + Travelpayouts
 */

const BenetripDiscovery = {
    // Estado da aplicação
    state: {
        cidadesData: null,
        origemSelecionada: null,
        formData: {},
        resultados: null
    },

    // Configuração
    config: {
        searchApiKey: 'YOUR_SEARCHAPI_KEY', // Substituir pela key real
        groqApiKey: 'YOUR_GROQ_KEY', // Substituir pela key real
        travelpayoutsToken: 'YOUR_TP_TOKEN', // Substituir pela key real
        travelpayoutsMarker: 'benetrip'
    },

    /**
     * Inicializa a aplicação
     */
    init() {
        console.log('🐕 Benetrip Discovery iniciando...');
        
        // Carregar dados de cidades
        this.carregarCidades();
        
        // Configurar eventos do formulário
        this.setupFormEvents();
        
        // Configurar autocomplete
        this.setupAutocomplete();
        
        // Configurar calendário
        this.setupCalendar();
        
        // Configurar campos condicionais
        this.setupConditionalFields();
        
        // Configurar botões de opção
        this.setupOptionButtons();
        
        // Configurar número de pessoas
        this.setupNumberInput();
        
        // Configurar slider de distância
        this.setupDistanceSlider();
        
        // Configurar input de moeda
        this.setupCurrencyInput();
    },

    /**
     * Carrega dados de cidades do JSON local
     */
    async carregarCidades() {
        try {
            const response = await fetch('data/cidades_global_iata_v3.json');
            if (!response.ok) throw new Error('Erro ao carregar cidades');
            
            const dados = await response.json();
            this.state.cidadesData = dados.filter(c => c.iata);
            
            console.log(`✅ ${this.state.cidadesData.length} cidades carregadas`);
        } catch (erro) {
            console.error('❌ Erro ao carregar cidades:', erro);
            // Fallback com cidades principais
            this.state.cidadesData = this.getCidadesFallback();
        }
    },

    /**
     * Cidades fallback caso JSON não carregue
     */
    getCidadesFallback() {
        return [
            { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", iata: "GRU" },
            { cidade: "Rio de Janeiro", sigla_estado: "RJ", pais: "Brasil", iata: "GIG" },
            { cidade: "Brasília", sigla_estado: "DF", pais: "Brasil", iata: "BSB" },
            { cidade: "Salvador", sigla_estado: "BA", pais: "Brasil", iata: "SSA" },
            { cidade: "Fortaleza", sigla_estado: "CE", pais: "Brasil", iata: "FOR" }
        ];
    },

    /**
     * Normaliza texto para busca
     */
    normalizarTexto(texto) {
        return texto
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    },

    /**
     * Busca cidades localmente
     */
    buscarCidades(termo) {
        if (!this.state.cidadesData || termo.length < 2) return [];
        
        const termoNorm = this.normalizarTexto(termo);
        
        return this.state.cidadesData
            .filter(cidade => {
                const nomeNorm = this.normalizarTexto(cidade.cidade);
                const iataNorm = cidade.iata.toLowerCase();
                
                return nomeNorm.includes(termoNorm) || iataNorm.includes(termoNorm);
            })
            .slice(0, 8) // Limitar a 8 resultados
            .map(cidade => ({
                code: cidade.iata,
                name: cidade.cidade,
                state: cidade.sigla_estado,
                country: cidade.pais
            }));
    },

    /**
     * Configura autocomplete de origem
     */
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
                
                // Adicionar eventos de clique
                results.querySelectorAll('.autocomplete-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const cidade = JSON.parse(item.dataset.city);
                        this.selecionarOrigem(cidade);
                    });
                });
            }, 300);
        });
        
        // Fechar ao clicar fora
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !results.contains(e.target)) {
                results.style.display = 'none';
            }
        });
    },

    /**
     * Seleciona a cidade de origem
     */
    selecionarOrigem(cidade) {
        const input = document.getElementById('origem');
        const results = document.getElementById('origem-results');
        const hiddenInput = document.getElementById('origem-data');
        
        this.state.origemSelecionada = cidade;
        input.value = `${cidade.name} (${cidade.code})`;
        hiddenInput.value = JSON.stringify(cidade);
        results.style.display = 'none';
        
        console.log('📍 Origem selecionada:', cidade);
    },

    /**
     * Configura o calendário Flatpickr
     */
    setupCalendar() {
        const input = document.getElementById('datas');
        const dataIda = document.getElementById('data-ida');
        const dataVolta = document.getElementById('data-volta');
        
        // Data mínima = amanhã
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        
        flatpickr(input, {
            mode: 'range',
            minDate: amanha,
            dateFormat: 'Y-m-d',
            locale: 'pt',
            inline: false,
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    dataIda.value = this.formatarDataISO(selectedDates[0]);
                    dataVolta.value = this.formatarDataISO(selectedDates[1]);
                    
                    // Atualizar display
                    input.value = `${this.formatarDataBR(selectedDates[0])} - ${this.formatarDataBR(selectedDates[1])}`;
                    
                    console.log('📅 Datas:', dataIda.value, 'até', dataVolta.value);
                }
            }
        });
    },

    /**
     * Formata data para ISO (YYYY-MM-DD)
     */
    formatarDataISO(data) {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    },

    /**
     * Formata data para exibição BR (DD/MM/YYYY)
     */
    formatarDataBR(data) {
        return data.toLocaleDateString('pt-BR');
    },

    /**
     * Configura campos condicionais
     */
    setupConditionalFields() {
        // Mostrar "número de pessoas" para família/amigos
        const companhiaInput = document.getElementById('companhia');
        const numPessoasGroup = document.getElementById('num-pessoas-group');
        
        // Observador para mudanças em companhia
        const observer = new MutationObserver(() => {
            const value = parseInt(companhiaInput.value);
            if (value === 2 || value === 3) {
                numPessoasGroup.style.display = 'block';
            } else {
                numPessoasGroup.style.display = 'none';
            }
        });
        
        observer.observe(companhiaInput, { attributes: true });
        
        // Mostrar campos de avião/ônibus ou carro
        const tipoViagemInput = document.getElementById('tipo-viagem');
        const moedaGroup = document.getElementById('moeda-group');
        const orcamentoGroup = document.getElementById('orcamento-group');
        const distanciaGroup = document.getElementById('distancia-group');
        
        const observerTipo = new MutationObserver(() => {
            const value = parseInt(tipoViagemInput.value);
            if (value === 0) {
                // Avião/Ônibus
                moedaGroup.style.display = 'block';
                orcamentoGroup.style.display = 'block';
                distanciaGroup.style.display = 'none';
            } else if (value === 1) {
                // Carro
                moedaGroup.style.display = 'none';
                orcamentoGroup.style.display = 'none';
                distanciaGroup.style.display = 'block';
            }
        });
        
        observerTipo.observe(tipoViagemInput, { attributes: true });
    },

    /**
     * Configura botões de opção
     */
    setupOptionButtons() {
        document.querySelectorAll('.button-group').forEach(group => {
            const field = group.dataset.field;
            if (!field) return;
            
            const hiddenInput = document.getElementById(field);
            
            group.querySelectorAll('.btn-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    // Remover active de todos
                    group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
                    
                    // Adicionar active no clicado
                    btn.classList.add('active');
                    
                    // Atualizar hidden input
                    hiddenInput.value = btn.dataset.value;
                    
                    // Trigger change event para campos condicionais
                    hiddenInput.dispatchEvent(new Event('change'));
                    
                    console.log(`✅ ${field}:`, btn.dataset.value);
                });
            });
        });
    },

    /**
     * Configura input numérico
     */
    setupNumberInput() {
        const input = document.getElementById('num-pessoas');
        const decrementBtn = document.querySelector('.btn-number[data-action="decrement"]');
        const incrementBtn = document.querySelector('.btn-number[data-action="increment"]');
        
        decrementBtn.addEventListener('click', () => {
            const value = parseInt(input.value);
            if (value > 2) {
                input.value = value - 1;
            }
        });
        
        incrementBtn.addEventListener('click', () => {
            const value = parseInt(input.value);
            if (value < 20) {
                input.value = value + 1;
            }
        });
    },

    /**
     * Configura slider de distância
     */
    setupDistanceSlider() {
        const slider = document.getElementById('distancia');
        const valueDisplay = document.getElementById('distancia-value');
        
        slider.addEventListener('input', () => {
            valueDisplay.textContent = slider.value;
        });
    },

    /**
     * Configura input de moeda
     */
    setupCurrencyInput() {
        const input = document.getElementById('orcamento');
        const moedaInput = document.getElementById('moeda');
        const currencySymbol = document.querySelector('.currency-symbol');
        
        // Atualizar símbolo quando moeda muda
        moedaInput.addEventListener('change', () => {
            const simbolos = {
                'BRL': 'R$',
                'USD': '$',
                'EUR': '€'
            };
            currencySymbol.textContent = simbolos[moedaInput.value] || 'R$';
        });
        
        // Formatar entrada como moeda
        input.addEventListener('input', (e) => {
            let valor = e.target.value.replace(/\D/g, '');
            
            if (valor) {
                valor = (parseInt(valor) / 100).toFixed(2);
                e.target.value = valor.replace('.', ',');
            } else {
                e.target.value = '';
            }
        });
    },

    /**
     * Configura eventos do formulário
     */
    setupFormEvents() {
        const form = document.getElementById('descobrir-form');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!this.validarFormulario()) {
                return;
            }
            
            // Coletar dados
            this.coletarDadosFormulario();
            
            // Buscar destinos
            await this.buscarDestinos();
        });
    },

    /**
     * Valida o formulário
     */
    validarFormulario() {
        // Verificar origem
        if (!this.state.origemSelecionada) {
            alert('Por favor, selecione uma cidade de origem');
            document.getElementById('origem').focus();
            return false;
        }
        
        // Verificar companhia
        if (!document.getElementById('companhia').value) {
            alert('Por favor, escolha com quem você vai viajar');
            return false;
        }
        
        // Verificar preferências
        if (!document.getElementById('preferencias').value) {
            alert('Por favor, escolha o que você busca nessa viagem');
            return false;
        }
        
        // Verificar datas
        if (!document.getElementById('data-ida').value || !document.getElementById('data-volta').value) {
            alert('Por favor, selecione as datas da viagem');
            document.getElementById('datas').focus();
            return false;
        }
        
        // Verificar tipo de viagem
        if (!document.getElementById('tipo-viagem').value) {
            alert('Por favor, escolha como prefere viajar');
            return false;
        }
        
        // Se avião/ônibus, verificar orçamento
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

    /**
     * Coleta dados do formulário
     */
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
            // Avião/Ônibus
            this.state.formData.moeda = document.getElementById('moeda').value;
            this.state.formData.orcamento = parseFloat(document.getElementById('orcamento').value.replace(',', '.'));
        } else {
            // Carro
            this.state.formData.distanciaMaxima = parseInt(document.getElementById('distancia').value);
        }
        
        console.log('📝 Dados coletados:', this.state.formData);
    },

    /**
     * Busca destinos (fluxo principal)
     */
    async buscarDestinos() {
        try {
            // Mostrar loading
            this.mostrarLoading();
            
            // 1. Buscar destinos com SearchAPI Google Travel Explore
            this.atualizarProgresso(20, 'Buscando destinos disponíveis...');
            const destinosDisponiveis = await this.buscarDestinosSearchAPI();
            
            // 2. Filtrar por orçamento/distância
            this.atualizarProgresso(40, 'Filtrando por suas preferências...');
            const destinosFiltrados = this.filtrarDestinos(destinosDisponiveis);
            
            // 3. Ranquear com IA (Groq)
            this.atualizarProgresso(60, 'IA selecionando os melhores para você...');
            const destinosRanqueados = await this.ranquearDestinosIA(destinosFiltrados);
            
            // 4. Gerar links Travelpayouts
            this.atualizarProgresso(80, 'Gerando links de reserva...');
            const destinosComLinks = await this.gerarLinksTravelpayouts(destinosRanqueados);
            
            // 5. Mostrar resultados
            this.atualizarProgresso(100, 'Tudo pronto!');
            await this.delay(500);
            this.mostrarResultados(destinosComLinks);
            
        } catch (erro) {
            console.error('❌ Erro ao buscar destinos:', erro);
            alert('Ops! Algo deu errado. Por favor, tente novamente.');
            this.esconderLoading();
        }
    },

    /**
     * Busca destinos usando SearchAPI Google Travel Explore
     */
    async buscarDestinosSearchAPI() {
        // IMPORTANTE: Esta é uma chamada de exemplo
        // Você precisa implementar isso no backend (Vercel Functions)
        // para não expor a API key no frontend
        
        try {
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
                throw new Error('Erro na busca de destinos');
            }
            
            const data = await response.json();
            return data.destinations || [];
            
        } catch (erro) {
            console.error('Erro SearchAPI:', erro);
            // Fallback com dados mock para teste
            return this.getDestinosMock();
        }
    },

    /**
     * Dados mock para teste (remover em produção)
     */
    getDestinosMock() {
        return [
            {
                name: "João Pessoa",
                kgmid: "/m/02q_qz",
                primary_airport: "JPA",
                country: "Brasil",
                flight: { airport_code: "JPA", price: 856, stops: 0, flight_duration_minutes: 200 },
                avg_cost_per_night: 180
            },
            {
                name: "Salvador",
                kgmid: "/m/01qfy",
                primary_airport: "SSA",
                country: "Brasil",
                flight: { airport_code: "SSA", price: 678, stops: 0, flight_duration_minutes: 150 },
                avg_cost_per_night: 175
            },
            {
                name: "Natal",
                kgmid: "/m/03cht",
                primary_airport: "NAT",
                country: "Brasil",
                flight: { airport_code: "NAT", price: 923, stops: 0, flight_duration_minutes: 215 },
                avg_cost_per_night: 195
            },
            {
                name: "Florianópolis",
                kgmid: "/m/0fpcx",
                primary_airport: "FLN",
                country: "Brasil",
                flight: { airport_code: "FLN", price: 542, stops: 0, flight_duration_minutes: 90 },
                avg_cost_per_night: 220
            },
            {
                name: "Gramado",
                kgmid: "/m/0fpcx",
                primary_airport: "POA",
                country: "Brasil",
                flight: { airport_code: "POA", price: 612, stops: 0, flight_duration_minutes: 120 },
                avg_cost_per_night: 250
            }
        ];
    },

    /**
     * Filtra destinos por orçamento/distância
     */
    filtrarDestinos(destinos) {
        const { tipoViagem, orcamento, dataIda, dataVolta } = this.state.formData;
        
        // Calcular número de noites
        const noites = this.calcularNoites(dataIda, dataVolta);
        
        return destinos.filter(destino => {
            if (tipoViagem === 0) {
                // Avião/Ônibus - filtrar por orçamento
                const custoTotal = destino.flight.price + (destino.avg_cost_per_night * noites);
                return custoTotal <= orcamento;
            } else {
                // Carro - filtrar por distância (aqui seria necessário calcular distância)
                // Por enquanto, retornar todos
                return true;
            }
        });
    },

    /**
     * Calcula número de noites
     */
    calcularNoites(dataIda, dataVolta) {
        const ida = new Date(dataIda);
        const volta = new Date(dataVolta);
        const diff = volta - ida;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    },

    /**
     * Ranqueia destinos usando IA (Groq)
     */
    async ranquearDestinosIA(destinos) {
        // IMPORTANTE: Implementar no backend para não expor API key
        
        try {
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
                throw new Error('Erro no ranking IA');
            }
            
            return await response.json();
            
        } catch (erro) {
            console.error('Erro Groq:', erro);
            // Fallback simples
            return {
                top_destino: destinos[0],
                alternativas: destinos.slice(1, 4),
                surpresa: destinos[4] || destinos[1]
            };
        }
    },

    /**
     * Gera links Travelpayouts
     */
    async gerarLinksTravelpayouts(ranking) {
        const { origem, dataIda, dataVolta, numPessoas } = this.state.formData;
        
        // Função helper para gerar link
        const gerarLink = (destino) => {
            const base = 'https://www.aviasales.com/search/';
            const params = `${origem.code}${dataIda.replace(/-/g, '')}${destino.primary_airport}${dataVolta.replace(/-/g, '')}${numPessoas}`;
            return `${base}${params}?marker=${this.config.travelpayoutsMarker}`;
        };
        
        // Adicionar links
        return {
            top_destino: {
                ...ranking.top_destino,
                link: gerarLink(ranking.top_destino)
            },
            alternativas: ranking.alternativas.map(d => ({
                ...d,
                link: gerarLink(d)
            })),
            surpresa: {
                ...ranking.surpresa,
                link: gerarLink(ranking.surpresa)
            }
        };
    },

    /**
     * Mostra loading
     */
    mostrarLoading() {
        document.getElementById('form-container').style.display = 'none';
        document.getElementById('loading-container').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Esconde loading
     */
    esconderLoading() {
        document.getElementById('loading-container').style.display = 'none';
        document.getElementById('form-container').style.display = 'block';
    },

    /**
     * Atualiza barra de progresso
     */
    atualizarProgresso(porcentagem, mensagem) {
        document.getElementById('progress-fill').style.width = `${porcentagem}%`;
        document.getElementById('loading-message').textContent = mensagem;
    },

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Mostra resultados
     */
    mostrarResultados(destinos) {
        const container = document.getElementById('resultados-container');
        const { dataIda, dataVolta } = this.state.formData;
        const noites = this.calcularNoites(dataIda, dataVolta);
        
        const html = `
            <div class="resultado-header">
                <h1>🎉 Destinos Perfeitos Para Você!</h1>
                <p>Selecionados especialmente pela Tripinha com base nas suas preferências</p>
            </div>

            <!-- Top Destino -->
            <div class="top-destino">
                <div class="badge">🏆 MELHOR ESCOLHA</div>
                <h2>${destinos.top_destino.name}</h2>
                <div class="preco">
                    ✈️ R$ ${destinos.top_destino.flight.price} + 
                    🏨 R$ ${destinos.top_destino.avg_cost_per_night * noites} 
                    = R$ ${destinos.top_destino.flight.price + (destinos.top_destino.avg_cost_per_night * noites)}
                </div>
                <div class="descricao">
                    ${this.gerarDescricao(destinos.top_destino, this.state.formData.preferencias)}
                </div>
                <a href="${destinos.top_destino.link}" target="_blank" class="btn-ver-voos">
                    Ver Passagens ✈️
                </a>
            </div>

            <!-- Alternativas -->
            <div class="alternativas-section">
                <h3>📋 Outras Ótimas Opções</h3>
                <div class="alternativas-grid">
                    ${destinos.alternativas.map(d => `
                        <div class="destino-card">
                            <h4>${d.name}</h4>
                            <div class="preco">R$ ${d.flight.price + (d.avg_cost_per_night * noites)}</div>
                            <div class="descricao">${this.gerarDescricao(d, this.state.formData.preferencias)}</div>
                            <a href="${d.link}" target="_blank" class="btn-ver-voos">Ver Passagens →</a>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Surpresa -->
            <div class="surpresa-card">
                <div class="badge">🎁 DESTINO SURPRESA</div>
                <h3>${destinos.surpresa.name}</h3>
                <div class="preco">R$ ${destinos.surpresa.flight.price + (destinos.surpresa.avg_cost_per_night * noites)}</div>
                <div class="descricao">
                    ${this.gerarDescricao(destinos.surpresa, 'surpresa')}
                </div>
                <a href="${destinos.surpresa.link}" target="_blank" class="btn-ver-voos">
                    Descobrir Esse Destino ✈️
                </a>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Esconder loading e mostrar resultados
        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Gera descrição do destino
     */
    gerarDescricao(destino, preferencia) {
        const descricoes = {
            'relax': {
                'João Pessoa': 'Praias tranquilas e piscinas naturais perfeitas para relaxar.',
                'Salvador': 'Praias paradisíacas e resorts all-inclusive para descanso total.',
                'Natal': 'Litoral sereno com mar calmo ideal para relaxamento.',
                'Florianópolis': 'Praias de águas cristalinas e natureza preservada.',
                'Gramado': 'Clima ameno e atmosfera acolhedora para descanso.'
            },
            'aventura': {
                'João Pessoa': 'Passeios de buggy e mergulho nas piscinas naturais.',
                'Salvador': 'Trilhas ecológicas e esportes aquáticos radicais.',
                'Natal': 'Passeio de buggy pelas dunas e esquibunda emocionante.',
                'Florianópolis': 'Surf, trilhas e rapel em cachoeiras.',
                'Gramado': 'Tirolesa, arvorismo e esportes de montanha.'
            },
            'cultura': {
                'João Pessoa': 'Centro histórico preservado e cultura nordestina autêntica.',
                'Salvador': 'Pelourinho, capoeira e forte herança afro-brasileira.',
                'Natal': 'Forte dos Reis Magos e artesanato local.',
                'Florianópolis': 'Cultura açoriana e gastronomia típica.',
                'Gramado': 'Arquitetura germânica e festivais culturais.'
            },
            'urbano': {
                'João Pessoa': 'Bares na orla e vida noturna animada.',
                'Salvador': 'Carnaval, festas e agito o ano todo.',
                'Natal': 'Restaurantes à beira-mar e vida noturna vibrante.',
                'Florianópolis': 'Baladas na Lagoa e agito cosmopolita.',
                'Gramado': 'Rua Coberta e gastronomia sofisticada.'
            },
            'surpresa': {
                'João Pessoa': 'Um destino que surpreende pela tranquilidade e beleza natural.',
                'Salvador': 'Cultura vibrante que vai muito além do carnaval.',
                'Natal': 'Belezas naturais únicas que poucos conhecem.',
                'Florianópolis': 'Ilha mágica que combina natureza e urbanidade.',
                'Gramado': 'Charme europeu no coração do Rio Grande do Sul.'
            }
        };
        
        return descricoes[preferencia]?.[destino.name] || `Destino incrível com muito a oferecer!`;
    }
};

// Inicializar quando DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    BenetripDiscovery.init();
});
