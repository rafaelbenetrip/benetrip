/**
 * BENETRIP - App Principal (Versão Corrigida e Otimizada)
 * Controla o fluxo de interação com o usuário, questionário e navegação entre telas.
 * 
 * @version 2.1.2
 * @author Equipe Benetrip
 * @description Sistema de chat interativo para planejamento de viagens
 */

const BENETRIP = {
    /**
     * Configuração otimizada da aplicação
     */
    config: {
        debugMode: false,
        questionarioPath: 'data/questions.json',
        defaultCurrency: 'BRL',
        imagePath: 'assets/images/',
        maxQuestionsPerFlow: 8,
        animationDelay: 800,
        // Configurações de performance
        debounceDelay: 300,
        maxRetries: 3,
        cacheTimeout: 24 * 60 * 60 * 1000, // 24 horas em millisegundos
        // Configurações de segurança
        allowedFileTypes: ['json'],
        maxFileSize: 5 * 1024 * 1024 // 5MB
    },

    /**
     * Estados da aplicação com validação de tipos
     */
    estado: {
        fluxo: null, // 'destino_conhecido' ou 'destino_desconhecido'
        tipoViagem: null, // 'carro', 'aereo', ou 'rodoviario'
        perguntaAtual: 0,
        perguntas: [],
        respostas: {},
        carregando: false,
        currentCalendarId: null,
        ultimoCalendarIdGerado: null, // CORREÇÃO: Adicionado para fallback
        calendarioAtual: null,
        currentSliderId: null,
        currentAutocompleteId: null,
        currentNumberInputId: null,
        currentCurrencyId: null,
        currentTextId: null,
        // Novos estados para controle de fluxo
        sessaoIniciada: false,
        ultimaAtualizacao: null
    },

    /**
     * Cache otimizado para dados das cidades
     */
    cache: {
        cidadesData: null,
        cidadesIndexadas: null,
        ultimaBusca: null,
        // Performance cache
        queryCache: new Map(),
        maxCacheSize: 1000
    },

    /**
     * Sistema de eventos para comunicação entre componentes
     */
    eventBus: {
        listeners: new Map(),
        
        /**
         * Registra um listener para um evento
         */
        on(eventName, callback) {
            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, []);
            }
            this.listeners.get(eventName).push(callback);
        },

        /**
         * Emite um evento para todos os listeners
         */
        emit(eventName, data) {
            if (this.listeners.has(eventName)) {
                this.listeners.get(eventName).forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Erro ao executar listener para evento ${eventName}:`, error);
                    }
                });
            }
        },

        /**
         * Remove um listener específico
         */
        off(eventName, callback) {
            if (this.listeners.has(eventName)) {
                const callbacks = this.listeners.get(eventName);
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        }
    },

    /**
     * Sistema de validação de dados
     */
    validator: {
        /**
         * Valida dados de entrada
         */
        validateInput(data, schema) {
            if (!data || typeof data !== 'object') {
                return { valid: false, errors: ['Dados inválidos'] };
            }

            const errors = [];
            
            // Validar campos obrigatórios
            if (schema.required) {
                schema.required.forEach(field => {
                    if (!(field in data) || data[field] === null || data[field] === undefined) {
                        errors.push(`Campo obrigatório ausente: ${field}`);
                    }
                });
            }

            return {
                valid: errors.length === 0,
                errors
            };
        },

        /**
         * Valida código IATA
         */
        validateIATA(code) {
            return typeof code === 'string' && /^[A-Z]{3}$/.test(code);
        },

        /**
         * Valida formato de data
         */
        validateDate(dateString) {
            if (!dateString) return false;
            const date = new Date(dateString);
            return date instanceof Date && !isNaN(date.getTime());
        }
    },

    /**
     * Inicialização otimizada da aplicação
     */
    async init() {
        try {
            console.log("Benetrip inicializando...");
            
            // Verificar compatibilidade do navegador
            if (!this.verificarCompatibilidade()) {
                this.mostrarErro("Seu navegador não é compatível com esta aplicação.");
                return;
            }

            // Inicializar cache de cidades em background
            this.inicializarCacheCidades();

            // Determinar página atual e inicializar adequadamente
            await this.inicializarPagina();

            // Verificar dados salvos de sessão anterior
            this.verificarDadosSalvos();

            // Inicializar serviços externos
            await this.inicializarServicosExternos();

            // Registrar eventos globais
            this.registrarEventos();

            // Marcar sessão como iniciada
            this.estado.sessaoIniciada = true;
            this.estado.ultimaAtualizacao = Date.now();

            console.log("Benetrip inicializado com sucesso");
            return this;

        } catch (error) {
            console.error("Erro na inicialização:", error);
            this.mostrarErro("Erro ao inicializar a aplicação. Recarregue a página.");
            throw error;
        }
    },

    /**
     * Verifica compatibilidade do navegador
     */
    verificarCompatibilidade() {
        const requiredFeatures = [
            'localStorage',
            'fetch',
            'Promise',
            'Map',
            'Set'
        ];

        return requiredFeatures.every(feature => {
            return typeof window[feature] !== 'undefined';
        });
    },

    /**
     * Inicializa cache de cidades de forma assíncrona
     */
    async inicializarCacheCidades() {
        try {
            await this.carregarDadosCidades();
            console.log("Cache de cidades inicializado");
        } catch (error) {
            console.warn("Falha ao inicializar cache de cidades:", error);
        }
    },

    /**
     * Inicializa a página apropriada baseada no DOM
     */
    async inicializarPagina() {
        if (document.getElementById('chat-container')) {
            await this.iniciarChat();
        } else if (document.getElementById('destinos-container')) {
            this.iniciarTelaDestinos();
        } else if (document.getElementById('voos-container')) {
            this.iniciarTelaVoos();
        }
    },

    /**
     * Inicializa serviços externos com tratamento de erro
     */
    async inicializarServicosExternos() {
        const servicos = [
            { nome: 'BENETRIP_API', servico: window.BENETRIP_API },
            { nome: 'BENETRIP_AI', servico: window.BENETRIP_AI }
        ];

        for (const { nome, servico } of servicos) {
            try {
                if (servico && typeof servico.init === 'function') {
                    await servico.init();
                    console.log(`Serviço ${nome} inicializado`);
                }
            } catch (error) {
                console.warn(`Falha ao inicializar ${nome}:`, error);
            }
        }
    },

    /**
     * Carregamento otimizado de dados das cidades
     */
    async carregarDadosCidades() {
        // Verificar cache válido
        if (this.cache.cidadesData && this.isCacheValid()) {
            return this.cache.cidadesData;
        }

        try {
            console.log("Carregando dados de cidades...");
            
            const response = await this.fetchWithRetry('data/cidades_global_iata_v3.json');
            const dados = await response.json();
            
            // Validar e filtrar dados
            const cidadesValidas = this.processarDadosCidades(dados);
            
            // Atualizar cache
            this.cache.cidadesData = cidadesValidas;
            this.cache.cidadesIndexadas = this.criarIndiceCidades(cidadesValidas);
            this.cache.lastUpdate = Date.now();
            
            console.log(`${cidadesValidas.length} cidades carregadas e indexadas`);
            return cidadesValidas;

        } catch (error) {
            console.error("Erro ao carregar dados de cidades:", error);
            return this.getDadosCidadesFallback();
        }
    },

    /**
     * Fetch com retry automático
     */
    async fetchWithRetry(url, options = {}, retries = this.config.maxRetries) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response;
            } catch (error) {
                console.warn(`Tentativa ${i + 1} falhou:`, error.message);
                if (i === retries - 1) throw error;
                
                // Delay exponencial entre tentativas
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
    },

    /**
     * Processa e valida dados das cidades
     */
    processarDadosCidades(dados) {
        if (!Array.isArray(dados)) {
            throw new Error("Dados de cidades inválidos");
        }

        return dados.filter(cidade => {
            return cidade && 
                   cidade.iata && 
                   this.validator.validateIATA(cidade.iata) &&
                   cidade.cidade &&
                   cidade.pais;
        }).map(cidade => ({
            ...cidade,
            // Normalizar dados para consistência
            cidade: cidade.cidade.trim(),
            pais: cidade.pais.trim(),
            iata: cidade.iata.toUpperCase()
        }));
    },

    /**
     * Verifica se o cache ainda é válido
     */
    isCacheValid() {
        if (!this.cache.lastUpdate) return false;
        return (Date.now() - this.cache.lastUpdate) < this.config.cacheTimeout;
    },

    /**
     * Criação otimizada do índice de cidades
     */
    criarIndiceCidades(cidades) {
        const indice = {
            porNome: new Map(),
            porIATA: new Map(),
            porEstado: new Map(),
            porPais: new Map()
        };

        cidades.forEach(cidade => {
            // Indexação por nome com normalização
            const nomeNormalizado = this.normalizarTexto(cidade.cidade);
            this.adicionarAoIndice(indice.porNome, nomeNormalizado, cidade);

            // Indexação por IATA
            indice.porIATA.set(cidade.iata, cidade);

            // Indexação por estado
            if (cidade.sigla_estado) {
                this.adicionarAoIndice(indice.porEstado, cidade.sigla_estado, cidade);
            }

            // Indexação por país
            this.adicionarAoIndice(indice.porPais, cidade.pais, cidade);
        });

        return indice;
    },

    /**
     * Adiciona item ao índice de forma otimizada
     */
    adicionarAoIndice(mapa, chave, valor) {
        if (!mapa.has(chave)) {
            mapa.set(chave, []);
        }
        mapa.get(chave).push(valor);
    },

    /**
     * Normalização otimizada de texto
     */
    normalizarTexto(texto) {
        if (!texto) return '';
        return texto
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    },

    /**
     * Busca otimizada de cidades com cache de consultas
     */
    async buscarCidadesLocal(termo) {
        if (!termo || termo.length < 2) return [];

        // Verificar cache de consultas
        const cacheKey = this.normalizarTexto(termo);
        if (this.cache.queryCache.has(cacheKey)) {
            return this.cache.queryCache.get(cacheKey);
        }

        // Garantir dados carregados
        if (!this.cache.cidadesData) {
            await this.carregarDadosCidades();
        }

        const resultados = this.executarBuscaCidades(termo);
        
        // Armazenar no cache (com limite)
        this.gerenciarCacheConsultas(cacheKey, resultados);
        
        return resultados;
    },

    /**
     * Executa busca de cidades com algoritmo otimizado
     */
    executarBuscaCidades(termo) {
        const termoNormalizado = this.normalizarTexto(termo);
        const resultados = new Map();

        // 1. Busca exata por IATA (máxima prioridade)
        if (termoNormalizado.length === 3) {
            const cidadeIATA = this.cache.cidadesIndexadas.porIATA.get(termoNormalizado.toUpperCase());
            if (cidadeIATA) {
                resultados.set(cidadeIATA.iata, { ...cidadeIATA, score: 100 });
            }
        }

        // 2. Busca por nome da cidade
        this.buscarPorNome(termoNormalizado, resultados);

        // 3. Converter e ordenar resultados
        return this.processarResultadosBusca(resultados);
    },

    /**
     * Busca por nome da cidade com scoring
     */
    buscarPorNome(termo, resultados) {
        // Buscar em diferentes níveis de correspondência
        for (const [nome, cidades] of this.cache.cidadesIndexadas.porNome) {
            const score = this.calcularScore(nome, termo);
            
            if (score > 50) {
                cidades.forEach(cidade => {
                    if (!resultados.has(cidade.iata) || resultados.get(cidade.iata).score < score) {
                        resultados.set(cidade.iata, { ...cidade, score });
                    }
                });
            }
        }
    },

    /**
     * Calcula score de similaridade otimizado
     */
    calcularScore(texto1, texto2) {
        if (texto1 === texto2) return 100;
        if (texto1.startsWith(texto2)) return 90;
        if (texto1.includes(texto2)) return 70;
        
        // Similaridade por caracteres comuns
        const comum = this.contarCaracteresComuns(texto1, texto2);
        const maximo = Math.max(texto1.length, texto2.length);
        return Math.round((comum / maximo) * 60);
    },

    /**
     * Conta caracteres comuns entre duas strings
     */
    contarCaracteresComuns(str1, str2) {
        const set1 = new Set(str1);
        const set2 = new Set(str2);
        let comum = 0;
        
        for (const char of set1) {
            if (set2.has(char)) comum++;
        }
        
        return comum;
    },

    /**
     * Processa resultados da busca
     */
    processarResultadosBusca(resultados) {
        return Array.from(resultados.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(cidade => this.converterParaFormatoAPI(cidade));
    },

    /**
     * Gerencia cache de consultas com limite de tamanho
     */
    gerenciarCacheConsultas(chave, resultado) {
        if (this.cache.queryCache.size >= this.config.maxCacheSize) {
            // Remove entrada mais antiga (FIFO)
            const primeiraChave = this.cache.queryCache.keys().next().value;
            this.cache.queryCache.delete(primeiraChave);
        }
        
        this.cache.queryCache.set(chave, resultado);
    },

    /**
     * Converte dados para formato da API
     */
    converterParaFormatoAPI(cidade) {
        return {
            type: "city",
            code: cidade.iata,
            name: cidade.cidade,
            city_name: cidade.cidade,
            country_name: cidade.pais,
            state_code: cidade.sigla_estado || null
        };
    },

    /**
     * Dados de fallback otimizados
     */
    getDadosCidadesFallback() {
        return [
            { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", iata: "GRU" },
            { cidade: "Rio de Janeiro", sigla_estado: "RJ", pais: "Brasil", iata: "GIG" },
            { cidade: "Brasília", sigla_estado: "DF", pais: "Brasil", iata: "BSB" },
            { cidade: "Salvador", sigla_estado: "BA", pais: "Brasil", iata: "SSA" },
            { cidade: "Fortaleza", sigla_estado: "CE", pais: "Brasil", iata: "FOR" },
            { cidade: "Belo Horizonte", sigla_estado: "MG", pais: "Brasil", iata: "CNF" },
            { cidade: "Manaus", sigla_estado: "AM", pais: "Brasil", iata: "MAO" },
            { cidade: "Curitiba", sigla_estado: "PR", pais: "Brasil", iata: "CWB" },
            { cidade: "Recife", sigla_estado: "PE", pais: "Brasil", iata: "REC" },
            { cidade: "Porto Alegre", sigla_estado: "RS", pais: "Brasil", iata: "POA" }
        ];
    },

    /**
     * Inicialização otimizada do chat
     */
    async iniciarChat() {
        try {
            this.mostrarCarregando(true);
            
            // Carregar perguntas com validação
            await this.carregarPerguntas();
            
            // Mostrar interface
            await this.mostrarMensagemBoasVindas();
            
            this.mostrarCarregando(false);
            
        } catch (error) {
            console.error("Erro ao iniciar chat:", error);
            this.mostrarErro("Não foi possível inicializar o chat. Recarregue a página.");
            this.mostrarCarregando(false);
        }
    },

    /**
     * Carregamento otimizado de perguntas
     */
    async carregarPerguntas() {
        try {
            const response = await this.fetchWithRetry(this.config.questionarioPath);
            const dados = await response.json();
            
            // Validar estrutura das perguntas
            if (!Array.isArray(dados)) {
                throw new Error("Formato de perguntas inválido");
            }
            
            this.estado.perguntas = dados;
            console.log(`${dados.length} perguntas carregadas`);
            
            return dados;
            
        } catch (error) {
            console.error("Erro ao carregar perguntas:", error);
            throw new Error("Falha ao carregar questionário");
        }
    },

    /**
     * Mostra mensagem de boas-vindas otimizada
     */
    async mostrarMensagemBoasVindas() {
        const mensagem = `
            <div class="chat-message tripinha">
                <div class="avatar">
                    <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" />
                </div>
                <div class="message">
                    <p>Oi, eu sou a Tripinha! 🐶 Vou te ajudar a encontrar o destino perfeito para sua próxima viagem! Vamos começar?</p>
                </div>
            </div>
        `;
        
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = mensagem;
            
            // Aguardar animação e mostrar primeira pergunta
            await this.delay(this.config.animationDelay);
            this.mostrarProximaPergunta();
        }
    },

    /**
     * Utilitário de delay com Promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Mostra próxima pergunta com validação otimizada
     */
    mostrarProximaPergunta() {
        // Validar estado atual
        if (this.estado.perguntaAtual >= this.estado.perguntas.length) {
            this.finalizarQuestionario();
            return;
        }

        const pergunta = this.estado.perguntas[this.estado.perguntaAtual];
        
        // Verificar pergunta condicional
        if (pergunta.conditional && !this.deveExibirPerguntaCondicional(pergunta)) {
            this.estado.perguntaAtual++;
            this.mostrarProximaPergunta();
            return;
        }

        // Renderizar pergunta
        this.renderizarPergunta(pergunta);
    },

    /**
     * Renderiza pergunta de forma otimizada
     */
    renderizarPergunta(pergunta) {
        const mensagemHTML = this.montarHTMLPergunta(pergunta);
        
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.insertAdjacentHTML('beforeend', mensagemHTML);
            this.rolarParaFinal();
            
            // Configurar eventos após renderização
            this.configurarEventosPergunta(pergunta);
        }
    },

    /**
     * Verificação otimizada de pergunta condicional
     */
    deveExibirPerguntaCondicional(pergunta) {
        if (!pergunta.conditional) return true;
        
        const { depends_on, show_if_value } = pergunta.conditional;
        return this.estado.respostas[depends_on] === show_if_value;
    },

    /**
     * Montagem otimizada do HTML da pergunta
     */
    montarHTMLPergunta(pergunta) {
        const opcoesHTML = this.gerarOpcoesHTML(pergunta);
        const classeMensagem = pergunta.calendar ? 'message with-calendar' : 'message';
        
        return `
            <div class="chat-message tripinha" data-pergunta-key="${pergunta.key || ''}">
                <div class="avatar">
                    <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" />
                </div>
                <div class="${classeMensagem}">
                    <p class="question">${pergunta.question}</p>
                    <p class="description">${pergunta.description || ''}</p>
                    ${opcoesHTML}
                </div>
            </div>
        `;
    },

    /**
     * Gera HTML das opções baseado no tipo de pergunta
     */
    gerarOpcoesHTML(pergunta) {
        if (pergunta.options) {
            return this.gerarOpcoesMultiplaEscolha(pergunta.options);
        } else if (pergunta.input_field) {
            return this.gerarCampoEntrada(pergunta);
        }
        return '';
    },

    /**
     * Gera opções de múltipla escolha
     */
    gerarOpcoesMultiplaEscolha(opcoes) {
        return `
            <div class="options-container">
                ${opcoes.map((opcao, index) => `
                    <button class="option-button" data-index="${index}" data-valor="${index}">
                        ${opcao}
                    </button>
                `).join('')}
            </div>
        `;
    },

    /**
     * Gera campo de entrada baseado no tipo
     */
    gerarCampoEntrada(pergunta) {
        const tiposCampo = {
            calendar: () => this.gerarCampoCalendario(),
            number_input: () => this.gerarCampoNumerico(),
            slider: () => this.gerarCampoSlider(),
            autocomplete: () => this.gerarCampoAutocomplete(pergunta),
            currency_format: () => this.gerarCampoMoeda(),
        };

        // Verificar tipos específicos primeiro
        for (const [tipo, gerador] of Object.entries(tiposCampo)) {
            if (pergunta[tipo]) {
                return gerador();
            }
        }

        // Campo de texto padrão
        return this.gerarCampoTexto();
    },

    // ===== CORREÇÃO 1: Melhorar geração do campo calendário =====
    /**
     * Gera campo de calendário com ID garantido
     */
    gerarCampoCalendario() {
        // Gerar ID único para o calendário PRIMEIRO
        const calendarId = `benetrip-calendar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // GARANTIR que o ID seja salvo no estado ANTES de qualquer outra operação
        this.estado.currentCalendarId = calendarId;
        
        console.log("📅 Gerando calendário com ID garantido:", calendarId);
        
        const html = `
            <div class="calendar-container" data-calendar-container="${calendarId}">
                <div id="${calendarId}" class="flatpickr-calendar-container"></div>
                <div class="date-selection">
                    <p>Ida: <span id="data-ida-${calendarId}">Selecione</span></p>
                    <p>Volta: <span id="data-volta-${calendarId}">Selecione</span></p>
                </div>
                <button id="confirmar-datas-${calendarId}" class="confirm-button confirm-dates" disabled>
                    Confirmar Datas
                </button>
            </div>
        `;
        
        // SALVAR REFERÊNCIA EXTRA para garantir
        this.estado.ultimoCalendarIdGerado = calendarId;
        
        return html;
    },

    /**
     * Gera campo numérico
     */
    gerarCampoNumerico() {
        const inputId = `number-input-${Date.now()}`;
        this.estado.currentNumberInputId = inputId;
        
        return `
            <div class="number-input-container">
                <button class="decrement" type="button">-</button>
                <input type="number" min="1" max="20" value="1" id="${inputId}" class="number-input">
                <button class="increment" type="button">+</button>
                <button class="confirm-number" type="button">Confirmar</button>
            </div>
        `;
    },

    /**
     * Gera campo de slider
     */
    gerarCampoSlider() {
        return `<div class="slider-placeholder">Configurando slider...</div>`;
    },

    /**
     * Gera campo de autocomplete
     */
    gerarCampoAutocomplete(pergunta) {
        const autocompleteId = `autocomplete-${Date.now()}`;
        this.estado.currentAutocompleteId = autocompleteId;
        
        return `
            <div class="autocomplete-container" id="${autocompleteId}-container">
                <input type="text" id="${autocompleteId}" class="autocomplete-input" 
                       placeholder="${pergunta.description}" autocomplete="off">
                <div id="${autocompleteId}-results" class="autocomplete-results"></div>
                <button id="${autocompleteId}-confirm" class="confirm-autocomplete" disabled>
                    Confirmar
                </button>
            </div>
        `;
    },

    /**
     * Gera campo de moeda
     */
    gerarCampoMoeda() {
        const currencyId = `currency-input-${Date.now()}`;
        this.estado.currentCurrencyId = currencyId;
        
        return `
            <div class="currency-input-container">
                <input type="text" id="${currencyId}" class="currency-input" 
                       placeholder="0,00" autocomplete="off">
                <button id="${currencyId}-confirm" class="confirm-currency" disabled>
                    Confirmar
                </button>
            </div>
        `;
    },

    /**
     * Gera campo de texto
     */
    gerarCampoTexto() {
        const textId = `text-input-${Date.now()}`;
        this.estado.currentTextId = textId;
        
        return `
            <div class="text-input-container">
                <input type="text" id="${textId}" class="text-input" 
                       placeholder="Digite sua resposta" autocomplete="off">
                <button id="${textId}-confirm" class="confirm-text" disabled>
                    Confirmar
                </button>
            </div>
        `;
    },

    // ===== CORREÇÃO 7: Configurar eventos com melhor timing =====
    /**
     * Configuração otimizada de eventos da pergunta
     */
    configurarEventosPergunta(pergunta) {
        // Aguardar um momento para garantir que DOM está pronto
        setTimeout(() => {
            try {
                // Configurar eventos baseado no tipo de pergunta
                if (pergunta.options) {
                    this.configurarOpcoesMultiplaEscolha(pergunta);
                } else if (pergunta.calendar) {
                    // Para calendário, aguardar mais um pouco
                    setTimeout(() => {
                        this.configurarCalendario(pergunta);
                    }, 200);
                } else if (pergunta.number_input) {
                    this.configurarEntradaNumerica();
                } else if (pergunta.slider) {
                    this.configurarSlider(pergunta);
                } else if (pergunta.autocomplete) {
                    this.configurarAutocomplete(pergunta);
                } else if (pergunta.currency_format) {
                    this.configurarEntradaMoeda();
                } else if (pergunta.input_field) {
                    this.configurarEntradaTexto();
                }
            } catch (error) {
                console.error("❌ Erro ao configurar eventos da pergunta:", error);
                this.mostrarErro("Erro ao configurar pergunta. Recarregue a página.");
            }
        }, 100);
    },

    /**
     * Configura eventos de múltipla escolha
     */
    configurarOpcoesMultiplaEscolha(pergunta) {
        const optionButtons = document.querySelectorAll('.option-button');
        
        optionButtons.forEach(button => {
            button.addEventListener('click', () => {
                const valor = parseInt(button.dataset.valor);
                this.processarResposta(valor, pergunta);
            });
        });
    },

    // ===== CORREÇÃO 2: Configuração calendário com ID garantido =====
    /**
     * Configuração otimizada do calendário com ID garantido
     */
    async configurarCalendario(pergunta) {
        try {
            // PRIMEIRO: Garantir que temos um ID válido
            let calendarId = this.estado.currentCalendarId || this.estado.ultimoCalendarIdGerado;
            
            if (!calendarId) {
                // FALLBACK: Buscar calendário no DOM se ID não estiver definido
                const calendarioEncontrado = this.encontrarCalendarioNoDom();
                if (calendarioEncontrado) {
                    calendarId = calendarioEncontrado.id;
                    this.estado.currentCalendarId = calendarId;
                    console.log("📅 Calendário encontrado no DOM:", calendarId);
                } else {
                    throw new Error("Nenhum calendário encontrado no DOM e ID não definido");
                }
            }
            
            console.log("📅 Configurando calendário com ID:", calendarId);
            
            // Garantir que Flatpickr está carregado
            if (typeof flatpickr === 'undefined') {
                console.log("📅 Carregando Flatpickr...");
                await this.carregarFlatpickr();
            }

            // Aguardar elemento estar disponível no DOM com ID garantido
            await this.aguardarElementoCalendario(calendarId);
            
            // Delay adicional para garantir renderização completa
            await this.delay(500);
            
            // Inicializar calendário com ID garantido
            this.inicializarCalendarioFlatpickr(pergunta, calendarId);
            
        } catch (error) {
            console.error("❌ Erro ao configurar calendário:", error);
            this.mostrarErroCalendario(error.message);
        }
    },

    // ===== CORREÇÃO 3: Função para encontrar calendário no DOM =====
    /**
     * Busca calendário no DOM como fallback
     */
    encontrarCalendarioNoDom() {
        // Buscar por diferentes seletores possíveis
        const seletores = [
            '.flatpickr-calendar-container',
            '[id*="benetrip-calendar"]',
            '[data-calendar-container]'
        ];
        
        for (const seletor of seletores) {
            const elemento = document.querySelector(seletor);
            if (elemento) {
                console.log("📅 Calendário encontrado pelo seletor:", seletor);
                
                // Se não tem ID, criar um
                if (!elemento.id) {
                    const novoId = `benetrip-calendar-fallback-${Date.now()}`;
                    elemento.id = novoId;
                    console.log("📅 ID criado para calendário encontrado:", novoId);
                }
                
                return elemento;
            }
        }
        
        console.warn("⚠️ Nenhum calendário encontrado no DOM");
        return null;
    },

    /**
     * Carrega Flatpickr dinamicamente se necessário
     */
    async carregarFlatpickr() {
        if (document.querySelector('script[src*="flatpickr"]')) {
            // Aguardar carregamento se já iniciado
            await this.aguardarFlatpickr();
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js';
            
            script.onload = () => {
                // Carregar estilos
                this.carregarEstilosFlatpickr();
                resolve();
            };
            
            script.onerror = () => reject(new Error("Falha ao carregar Flatpickr"));
            
            document.head.appendChild(script);
        });
    },

    // ===== CORREÇÃO 4: Aguardar elemento com ID específico =====
    /**
     * Aguarda elemento do calendário estar disponível no DOM
     */
    async aguardarElementoCalendario(calendarId = null) {
        // Usar ID passado como parâmetro ou o do estado
        const id = calendarId || this.estado.currentCalendarId || this.estado.ultimoCalendarIdGerado;
        
        if (!id) {
            throw new Error("ID do calendário não definido - não é possível aguardar elemento");
        }

        console.log("📅 Aguardando elemento do calendário:", id);
        
        let tentativas = 0;
        const maxTentativas = 100; // 10 segundos
        
        while (tentativas < maxTentativas) {
            const elemento = document.getElementById(id);
            if (elemento) {
                console.log("✅ Elemento do calendário encontrado:", id);
                
                // Verificar se elementos filhos também existem
                const elementosFilhos = this.verificarElementosFilhosCalendario(id);
                if (elementosFilhos.todos) {
                    console.log("✅ Todos elementos filhos do calendário encontrados");
                    return elemento;
                } else {
                    console.log("⏳ Aguardando elementos filhos...", elementosFilhos);
                }
            }
            
            await this.delay(100);
            tentativas++;
            
            // Log de progresso a cada 2 segundos
            if (tentativas % 20 === 0) {
                console.log(`⏳ Aguardando calendário ${id}... Tentativa ${tentativas}/${maxTentativas}`);
            }
        }
        
        // Se chegou até aqui, timeout ocorreu
        console.error("❌ Timeout aguardando calendário:", id);
        console.log("🔍 Elementos encontrados no DOM:", {
            'todos_calendarios': document.querySelectorAll('[id*="calendar"]').length,
            'containers': document.querySelectorAll('.calendar-container').length,
            'flatpickr': document.querySelectorAll('.flatpickr-calendar-container').length
        });
        
        throw new Error(`Timeout: elemento do calendário ${id} não encontrado após ${maxTentativas * 100}ms`);
    },

    // ===== CORREÇÃO 5: Verificar elementos filhos =====
    /**
     * Verifica se todos os elementos filhos do calendário existem
     */
    verificarElementosFilhosCalendario(calendarId) {
        const elementos = {
            calendario: document.getElementById(calendarId),
            dataIda: document.getElementById(`data-ida-${calendarId}`),
            dataVolta: document.getElementById(`data-volta-${calendarId}`),
            botaoConfirmar: document.getElementById(`confirmar-datas-${calendarId}`)
        };
        
        const encontrados = {
            calendario: !!elementos.calendario,
            dataIda: !!elementos.dataIda,
            dataVolta: !!elementos.dataVolta,
            botaoConfirmar: !!elementos.botaoConfirmar,
            todos: false
        };
        
        encontrados.todos = Object.values(encontrados).slice(0, 4).every(Boolean);
        
        return encontrados;
    },

    /**
     * Aguarda Flatpickr estar disponível
     */
    async aguardarFlatpickr() {
        let tentativas = 0;
        const maxTentativas = 50;
        
        while (typeof flatpickr === 'undefined' && tentativas < maxTentativas) {
            await this.delay(100);
            tentativas++;
        }
        
        if (typeof flatpickr === 'undefined') {
            throw new Error("Timeout ao aguardar Flatpickr");
        }
    },

    /**
     * Carrega estilos do Flatpickr
     */
    carregarEstilosFlatpickr() {
        if (!document.querySelector('link[href*="flatpickr"]')) {
            const style = document.createElement('link');
            style.rel = 'stylesheet';
            style.href = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css';
            document.head.appendChild(style);
        }
    },

    // ===== CORREÇÃO 6: Inicializar com ID garantido =====
    /**
     * Inicializa calendário Flatpickr com ID garantido
     */
    inicializarCalendarioFlatpickr(pergunta, calendarId = null) {
        // Usar ID passado ou o do estado
        const id = calendarId || this.estado.currentCalendarId || this.estado.ultimoCalendarIdGerado;
        
        if (!id) {
            console.error("❌ ID do calendário não definido para inicialização");
            this.mostrarErroCalendario("Erro interno: ID do calendário não encontrado");
            return;
        }

        const calendarElement = document.getElementById(id);
        
        if (!calendarElement) {
            console.error(`❌ Elemento do calendário não encontrado: ${id}`);
            console.log("🔍 Debug - elementos disponíveis:", {
                'por_id': document.getElementById(id),
                'por_classe': document.querySelector('.flatpickr-calendar-container'),
                'containers': document.querySelectorAll('.calendar-container')
            });
            this.mostrarErroCalendario("Elemento do calendário não encontrado");
            return;
        }

        console.log("✅ Inicializando calendário Flatpickr:", id);

        // Configuração otimizada do calendário
        const config = this.obterConfigCalendario(pergunta, id);
        
        try {
            // Destruir calendário existente se houver
            if (this.estado.calendarioAtual) {
                try {
                    this.estado.calendarioAtual.destroy();
                    console.log("🗑️ Calendário anterior destruído");
                } catch (e) {
                    console.warn("⚠️ Erro ao destruir calendário anterior:", e);
                }
            }

            // Criar novo calendário
            const calendario = flatpickr(calendarElement, config);
            this.estado.calendarioAtual = calendario;
            
            // Configurar botão de confirmação
            this.configurarBotaoConfirmacaoCalendario(id, calendario, pergunta);
            
            console.log("✅ Calendário Flatpickr inicializado com sucesso:", id);
            
        } catch (error) {
            console.error("❌ Erro ao inicializar Flatpickr:", error);
            this.mostrarErroCalendario("Erro na inicialização do calendário");
        }
    },

    /**
     * Obtém configuração do calendário
     */
    obterConfigCalendario(pergunta, calendarId) {
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        amanha.setHours(0, 0, 0, 0);

        return {
            mode: "range",
            dateFormat: "Y-m-d",
            minDate: pergunta.calendar?.min_date || this.formatarDataISO(amanha),
            maxDate: pergunta.calendar?.max_date,
            inline: true,
            showMonths: 1,
            locale: this.obterLocaleCalendario(),
            disable: [
                date => {
                    const amanha = new Date();
                    amanha.setDate(amanha.getDate() + 1);
                    amanha.setHours(0, 0, 0, 0);
                    return date < amanha;
                }
            ],
            onChange: (selectedDates) => this.onCalendarioChange(selectedDates, calendarId)
        };
    },

    /**
     * Obtém configuração de localização do calendário
     */
    obterLocaleCalendario() {
        return {
            weekdays: {
                shorthand: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
                longhand: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
            },
            months: {
                shorthand: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
                longhand: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
            },
            rangeSeparator: ' até ',
            firstDayOfWeek: 0
        };
    },

    /**
     * Manipula mudanças no calendário
     */
    onCalendarioChange(selectedDates, calendarId) {
        const dataIdaElement = document.getElementById(`data-ida-${calendarId}`);
        const dataVoltaElement = document.getElementById(`data-volta-${calendarId}`);
        const confirmarBtn = document.getElementById(`confirmar-datas-${calendarId}`);

        if (!dataIdaElement || !dataVoltaElement || !confirmarBtn) {
            console.error("Elementos de data não encontrados para ID:", calendarId);
            console.log("Elementos buscados:", {
                ida: `data-ida-${calendarId}`,
                volta: `data-volta-${calendarId}`,
                confirmar: `confirmar-datas-${calendarId}`
            });
            return;
        }

        if (selectedDates.length === 0) {
            dataIdaElement.textContent = "Selecione";
            dataVoltaElement.textContent = "Selecione";
            confirmarBtn.disabled = true;
        } else if (selectedDates.length === 1) {
            dataIdaElement.textContent = this.formatarDataVisivel(selectedDates[0]);
            dataVoltaElement.textContent = "Selecione";
            confirmarBtn.disabled = true;
        } else if (selectedDates.length === 2) {
            dataIdaElement.textContent = this.formatarDataVisivel(selectedDates[0]);
            dataVoltaElement.textContent = this.formatarDataVisivel(selectedDates[1]);
            confirmarBtn.disabled = false;
        }

        console.log("Calendário atualizado:", {
            calendarId,
            selectedDates: selectedDates.length,
            botaoHabilitado: !confirmarBtn.disabled
        });
    },

    /**
     * Configura botão de confirmação do calendário
     */
    configurarBotaoConfirmacaoCalendario(calendarId, calendario, pergunta) {
        const confirmarBtn = document.getElementById(`confirmar-datas-${calendarId}`);
        
        if (!confirmarBtn) {
            console.error(`Botão de confirmação não encontrado: confirmar-datas-${calendarId}`);
            return;
        }
        
        // Remover listeners anteriores se existirem
        const novoBtn = confirmarBtn.cloneNode(true);
        confirmarBtn.parentNode.replaceChild(novoBtn, confirmarBtn);
        
        novoBtn.addEventListener('click', () => {
            try {
                if (!calendario || !calendario.selectedDates) {
                    console.error("Calendário ou datas selecionadas não disponíveis");
                    this.mostrarErro("Erro no calendário. Selecione as datas novamente.");
                    return;
                }

                const datas = calendario.selectedDates;
                if (datas.length === 2) {
                    const dadosDatas = {
                        dataIda: this.formatarDataISO(datas[0]),
                        dataVolta: this.formatarDataISO(datas[1])
                    };
                    
                    console.log("Processando datas:", dadosDatas);
                    this.processarResposta(dadosDatas, pergunta);
                } else {
                    this.mostrarErro("Selecione a data de ida e volta.");
                }
            } catch (error) {
                console.error("Erro ao processar datas:", error);
                this.mostrarErro("Erro ao processar datas. Selecione novamente.");
            }
        });

        console.log("Botão de confirmação configurado para:", calendarId);
    },

    /**
     * Formatação otimizada de data para exibição
     */
    formatarDataVisivel(data) {
        if (!data) return '';
        
        try {
            return data.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            console.error("Erro ao formatar data:", error);
            return 'Data inválida';
        }
    },

    /**
     * Formatação otimizada de data para ISO
     */
    formatarDataISO(data) {
        if (!data) return '';
        
        try {
            // Se já está no formato ISO, retornar diretamente
            if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
                return data;
            }

            // Converter para objeto Date se necessário
            let dataObj = data instanceof Date ? data : new Date(data);
            
            if (isNaN(dataObj.getTime())) {
                console.error("Data inválida:", data);
                return '';
            }

            const ano = dataObj.getFullYear();
            const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
            const dia = String(dataObj.getDate()).padStart(2, '0');

            return `${ano}-${mes}-${dia}`;
            
        } catch (error) {
            console.error("Erro ao formatar data ISO:", error);
            return '';
        }
    },

    /**
     * Configuração otimizada de autocomplete
     */
    configurarAutocomplete(pergunta) {
        const autocompleteId = this.estado.currentAutocompleteId;
        if (!autocompleteId) {
            console.error("ID de autocomplete não encontrado");
            return;
        }

        const elementos = this.obterElementosAutocomplete(autocompleteId);
        if (!elementos) return;

        const { input, resultsContainer, confirmBtn } = elementos;
        
        let selectedItem = null;
        let currentQuery = '';

        // Configurar busca com debounce otimizado
        const buscarSugestoes = this.criarDebounce(async (termo) => {
            await this.executarBuscaAutocomplete(termo, resultsContainer, currentQuery, (item) => {
                selectedItem = item;
                input.value = `${item.name} (${item.code})`;
                resultsContainer.innerHTML = '';
                confirmBtn.disabled = false;
                input.dataset.selectedItem = JSON.stringify(item);
            });
        }, this.config.debounceDelay);

        // Configurar eventos
        this.configurarEventosAutocomplete(input, confirmBtn, buscarSugestoes, pergunta, (query) => {
            currentQuery = query;
            selectedItem = null;
        });
    },

    /**
     * Obtém elementos do autocomplete com validação
     */
    obterElementosAutocomplete(autocompleteId) {
        const input = document.getElementById(autocompleteId);
        const resultsContainer = document.getElementById(`${autocompleteId}-results`);
        const confirmBtn = document.getElementById(`${autocompleteId}-confirm`);

        if (!input || !resultsContainer || !confirmBtn) {
            console.error("Elementos de autocomplete não encontrados");
            return null;
        }

        return { input, resultsContainer, confirmBtn };
    },

    /**
     * Cria função de debounce otimizada
     */
    criarDebounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    },

    /**
     * Executa busca de autocomplete
     */
    async executarBuscaAutocomplete(termo, resultsContainer, currentQuery, onSelectCallback) {
        if (!termo || termo.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }

        resultsContainer.innerHTML = '<div class="loading-autocomplete">Buscando...</div>';

        try {
            const sugestoes = await this.buscarCidadesLocal(termo);
            
            // Verificar se a query ainda é atual
            if (termo !== currentQuery) return;

            if (sugestoes?.length > 0) {
                this.renderizarSugestoesAutocomplete(sugestoes, resultsContainer, onSelectCallback);
            } else {
                resultsContainer.innerHTML = '<div class="no-results">Nenhuma cidade encontrada</div>';
            }
            
        } catch (error) {
            console.error("Erro ao buscar sugestões:", error);
            resultsContainer.innerHTML = '<div class="error">Erro ao buscar cidades</div>';
        }
    },

    /**
     * Renderiza sugestões do autocomplete
     */
    renderizarSugestoesAutocomplete(sugestoes, resultsContainer, onSelectCallback) {
        resultsContainer.innerHTML = sugestoes.map(item => {
            const estado = item.state_code ? `, ${item.state_code}` : '';
            return `
                <div class="autocomplete-item" 
                     data-code="${item.code}"
                     data-name="${item.name}"
                     data-country="${item.country_name}">
                    <div class="item-code">${item.code}</div>
                    <div class="item-details">
                        <div class="item-name">${item.name}${estado}</div>
                        <div class="item-country">${item.country_name}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Adicionar eventos aos itens
        resultsContainer.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const selectedItem = {
                    code: item.dataset.code,
                    name: item.dataset.name,
                    country: item.dataset.country
                };
                onSelectCallback(selectedItem);
            });
        });
    },

    /**
     * Configura eventos do autocomplete
     */
    configurarEventosAutocomplete(input, confirmBtn, buscarSugestoes, pergunta, onQueryChange) {
        // Evento de input
        input.addEventListener('input', (e) => {
            const termo = e.target.value.trim();
            onQueryChange(termo);
            
            if (!termo) {
                confirmBtn.disabled = true;
                input.removeAttribute('data-selected-item');
            } else {
                buscarSugestoes(termo);
            }
        });

        // Evento de confirmação
        confirmBtn.addEventListener('click', () => {
            const selectedItemData = input.dataset.selectedItem;
            if (selectedItemData) {
                try {
                    const selectedItem = JSON.parse(selectedItemData);
                    this.processarResposta(selectedItem, pergunta);
                } catch (error) {
                    console.error("Erro ao processar item selecionado:", error);
                }
            }
        });

        // Evento de Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.dataset.selectedItem) {
                e.preventDefault();
                confirmBtn.click();
            }
        });

        // Foco automático
        setTimeout(() => input.focus(), 300);
    },

    /**
     * Configuração otimizada de entrada numérica
     */
    configurarEntradaNumerica() {
        const inputId = this.estado.currentNumberInputId;
        if (!inputId) {
            console.error("ID de entrada numérica não encontrado");
            return;
        }

        const elementos = this.obterElementosEntradaNumerica(inputId);
        if (!elementos) return;

        const { input, decrementBtn, incrementBtn, confirmBtn } = elementos;

        // Configurar eventos com validação
        decrementBtn.addEventListener('click', () => {
            const valor = Math.max(1, parseInt(input.value) - 1);
            input.value = valor;
        });

        incrementBtn.addEventListener('click', () => {
            const valor = Math.min(20, parseInt(input.value) + 1);
            input.value = valor;
        });

        confirmBtn.addEventListener('click', () => {
            const valor = parseInt(input.value);
            if (valor >= 1 && valor <= 20) {
                const pergunta = this.estado.perguntas[this.estado.perguntaAtual];
                this.processarResposta(valor, pergunta);
            }
        });

        // Validação em tempo real
        input.addEventListener('input', (e) => {
            const valor = parseInt(e.target.value);
            confirmBtn.disabled = isNaN(valor) || valor < 1 || valor > 20;
        });
    },

    /**
     * Obtém elementos da entrada numérica
     */
    obterElementosEntradaNumerica(inputId) {
        const input = document.getElementById(inputId);
        const container = input?.closest('.number-input-container');
        
        if (!container) {
            console.error("Container de entrada numérica não encontrado");
            return null;
        }

        const decrementBtn = container.querySelector('.decrement');
        const incrementBtn = container.querySelector('.increment');
        const confirmBtn = container.querySelector('.confirm-number');

        if (!decrementBtn || !incrementBtn || !confirmBtn) {
            console.error("Botões de entrada numérica não encontrados");
            return null;
        }

        return { input, decrementBtn, incrementBtn, confirmBtn };
    },

    /**
     * Configuração otimizada do slider
     */
    configurarSlider(pergunta) {
        const config = pergunta.slider_config;
        const sliderId = `slider-${Date.now()}`;
        this.estado.currentSliderId = sliderId;

        setTimeout(() => {
            this.substituirPlaceholderSlider(sliderId, config, pergunta);
        }, 100);
    },

    /**
     * Substitui placeholder do slider pelo HTML real
     */
    substituirPlaceholderSlider(sliderId, config, pergunta) {
        const placeholder = document.querySelector('.slider-placeholder');
        if (!placeholder) {
            console.error("Placeholder do slider não encontrado");
            return;
        }

        placeholder.outerHTML = this.gerarHTMLSlider(sliderId, config);
        
        // Configurar eventos após criação
        setTimeout(() => {
            this.configurarEventosSlider(sliderId, config, pergunta);
        }, 200);
    },

    /**
     * Gera HTML do slider
     */
    gerarHTMLSlider(sliderId, config) {
        const labels = Object.entries(config.labels)
            .map(([value, label]) => `<span class="slider-label" data-value="${value}">${label}</span>`)
            .join('');

        return `
            <div class="slider-container" id="${sliderId}-container">
                <div class="slider-wrapper">
                    <input type="range" 
                           id="${sliderId}" 
                           class="distance-slider"
                           min="${config.min}" 
                           max="${config.max}" 
                           step="${config.step}" 
                           value="${config.default}">
                    <div class="slider-labels">${labels}</div>
                </div>
                <div class="slider-value">
                    <span id="${sliderId}-display">${config.default}</span> ${config.unit}
                </div>
                <button id="${sliderId}-confirm" class="confirm-slider">
                    Confirmar Distância
                </button>
            </div>
        `;
    },

    /**
     * Configura eventos do slider
     */
    configurarEventosSlider(sliderId, config, pergunta) {
        const elementos = this.obterElementosSlider(sliderId);
        if (!elementos) return;

        const { slider, display, confirmBtn } = elementos;

        // Evento de mudança do slider
        slider.addEventListener('input', (e) => {
            const valor = parseInt(e.target.value);
            display.textContent = valor;
            this.atualizarVisualizacaoSlider(slider, config, valor);
        });

        // Evento de confirmação
        confirmBtn.addEventListener('click', () => {
            const valor = parseInt(slider.value);
            this.processarResposta(valor, pergunta);
        });

        // Configuração inicial
        this.atualizarVisualizacaoSlider(slider, config, config.default);
    },

    /**
     * Obtém elementos do slider
     */
    obterElementosSlider(sliderId) {
        const slider = document.getElementById(sliderId);
        const display = document.getElementById(`${sliderId}-display`);
        const confirmBtn = document.getElementById(`${sliderId}-confirm`);

        if (!slider || !display || !confirmBtn) {
            console.error("Elementos do slider não encontrados");
            return null;
        }

        return { slider, display, confirmBtn };
    },

    /**
     * Atualiza visualização do slider
     */
    atualizarVisualizacaoSlider(slider, config, valor) {
        this.atualizarLabelsSlider(slider, config, valor);
        this.atualizarGradienteSlider(slider, config, valor);
    },

    /**
     * Atualiza labels do slider
     */
    atualizarLabelsSlider(slider, config, valor) {
        const container = slider.closest('.slider-container');
        const labels = container.querySelectorAll('.slider-label');
        
        labels.forEach(label => {
            const labelValue = parseInt(label.dataset.value);
            label.classList.toggle('active', labelValue <= valor);
        });
    },

    /**
     * Atualiza gradiente do slider
     */
    atualizarGradienteSlider(slider, config, valor) {
        const porcentagem = ((valor - config.min) / (config.max - config.min)) * 100;
        slider.style.background = 
            `linear-gradient(to right, #E87722 0%, #E87722 ${porcentagem}%, #ddd ${porcentagem}%, #ddd 100%)`;
    },

    /**
     * Configuração otimizada de entrada de moeda
     */
    configurarEntradaMoeda() {
        const currencyId = this.estado.currentCurrencyId;
        if (!currencyId) {
            console.error("ID de entrada monetária não encontrado");
            return;
        }

        // Aguardar elementos estarem disponíveis
        this.aguardarElementos(currencyId, () => {
            this.inicializarCampoMoeda(currencyId);
        });
    },

    /**
     * Aguarda elementos estarem disponíveis no DOM
     */
    aguardarElementos(baseId, callback, maxTentativas = 50) {
        let tentativas = 0;
        
        const verificar = () => {
            const elemento = document.getElementById(baseId);
            
            if (elemento && tentativas < maxTentativas) {
                callback();
            } else if (tentativas < maxTentativas) {
                tentativas++;
                setTimeout(verificar, 100);
            } else {
                console.error(`Timeout aguardando elemento ${baseId}`);
            }
        };
        
        verificar();
    },

    /**
     * Inicializa campo de moeda
     */
    inicializarCampoMoeda(currencyId) {
        const input = document.getElementById(currencyId);
        const confirmBtn = document.getElementById(`${currencyId}-confirm`);
        
        if (!input || !confirmBtn) {
            console.error("Elementos de moeda não encontrados");
            return;
        }

        // Configurar formatação de moeda
        input.addEventListener('input', (e) => {
            const valorFormatado = this.formatarEntradaMoeda(e.target.value);
            e.target.value = valorFormatado;
            
            const valorNumerico = this.extrairValorNumerico(valorFormatado);
            confirmBtn.disabled = valorNumerico <= 0;
        });

        // Confirmar valor
        confirmBtn.addEventListener('click', () => {
            const valor = this.extrairValorNumerico(input.value);
            if (valor > 0) {
                const pergunta = this.estado.perguntas[this.estado.perguntaAtual];
                this.processarResposta(valor, pergunta);
            }
        });

        // Foco automático
        setTimeout(() => input.focus(), 300);
    },

    /**
     * Formata entrada de moeda
     */
    formatarEntradaMoeda(valor) {
        // Remove caracteres não numéricos
        const apenasNumeros = valor.replace(/\D/g, '');
        
        if (!apenasNumeros) return '';
        
        // Converte para decimal
        const valorDecimal = (parseInt(apenasNumeros) / 100).toFixed(2);
        
        // Formata com vírgula decimal
        return valorDecimal.replace('.', ',');
    },

    /**
     * Extrai valor numérico da string formatada
     */
    extrairValorNumerico(valorFormatado) {
        if (!valorFormatado) return 0;
        return parseFloat(valorFormatado.replace(',', '.')) || 0;
    },

    /**
     * Configuração de entrada de texto
     */
    configurarEntradaTexto() {
        const textId = this.estado.currentTextId;
        if (!textId) {
            console.error("ID de entrada de texto não encontrado");
            return;
        }

        const input = document.getElementById(textId);
        const confirmBtn = document.getElementById(`${textId}-confirm`);
        
        if (!input || !confirmBtn) {
            console.error("Elementos de entrada de texto não encontrados");
            return;
        }

        // Validação em tempo real
        input.addEventListener('input', (e) => {
            const texto = e.target.value.trim();
            confirmBtn.disabled = texto.length === 0;
        });

        // Confirmação
        confirmBtn.addEventListener('click', () => {
            const texto = input.value.trim();
            if (texto.length > 0) {
                const pergunta = this.estado.perguntas[this.estado.perguntaAtual];
                this.processarResposta(texto, pergunta);
            }
        });

        // Evento Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                confirmBtn.click();
            }
        });
    },

    /**
     * Processamento otimizado de resposta
     */
    processarResposta(valor, pergunta) {
        try {
            // Validar entrada
            if (!this.validarResposta(valor, pergunta)) {
                this.mostrarErro("Resposta inválida. Tente novamente.");
                return;
            }

            // Armazenar resposta
            this.estado.respostas[pergunta.key] = valor;

            // Processar lógica específica da pergunta
            this.processarLogicaPergunta(pergunta, valor);

            // Mostrar resposta do usuário
            this.mostrarRespostaUsuario(valor, pergunta);

            // Avançar no fluxo
            this.avancarFluxo();

        } catch (error) {
            console.error("Erro ao processar resposta:", error);
            this.mostrarErro("Erro ao processar resposta. Tente novamente.");
        }
    },

    /**
     * Valida resposta baseada no tipo de pergunta
     */
    validarResposta(valor, pergunta) {
        if (valor === null || valor === undefined) return false;

        // Validações específicas por tipo
        if (pergunta.options) {
            return Number.isInteger(valor) && valor >= 0 && valor < pergunta.options.length;
        }

        if (pergunta.calendar) {
            return valor.dataIda && this.validator.validateDate(valor.dataIda);
        }

        if (pergunta.autocomplete) {
            return valor.code && valor.name && this.validator.validateIATA(valor.code);
        }

        if (pergunta.number_input) {
            return Number.isInteger(valor) && valor >= 1 && valor <= 20;
        }

        if (pergunta.currency_format) {
            return typeof valor === 'number' && valor > 0;
        }

        return true; // Validação padrão para outros tipos
    },

    /**
     * Processa lógica específica da pergunta
     */
    processarLogicaPergunta(pergunta, valor) {
        switch (pergunta.key) {
            case 'conhece_destino':
                this.estado.fluxo = valor === 0 ? 'destino_conhecido' : 'destino_desconhecido';
                break;
                
            case 'viagem_carro':
                this.estado.respostas.viagem_carro = valor;
                break;
                
            case 'moeda_escolhida':
                if (pergunta.options) {
                    this.estado.respostas.moeda_escolhida = this.obterCodigoMoeda(pergunta.options[valor]);
                }
                break;
        }
    },

    /**
     * ✅ CORREÇÃO 8: Extrai o código da moeda do texto completo da opção
     */
    obterCodigoMoeda(textoCompleto) {
        if (!textoCompleto) return 'BRL';
        
        // Verificar se já é apenas o código
        if (['BRL', 'USD', 'EUR', 'GBP', 'JPY'].includes(textoCompleto)) {
            return textoCompleto;
        }
        
        // Extrair código do texto completo
        if (textoCompleto.includes('USD') || textoCompleto.includes('Dólar')) return 'USD';
        if (textoCompleto.includes('EUR') || textoCompleto.includes('Euro')) return 'EUR';
        if (textoCompleto.includes('GBP') || textoCompleto.includes('Libra')) return 'GBP';
        if (textoCompleto.includes('JPY') || textoCompleto.includes('Iene')) return 'JPY';
        if (textoCompleto.includes('BRL') || textoCompleto.includes('Real')) return 'BRL';
        
        return 'BRL'; // Default
    },

    /**
     * Avança no fluxo do questionário
     */
    avancarFluxo() {
        this.estado.perguntaAtual++;

        if (this.verificarLimitePerguntas()) {
            this.finalizarQuestionario();
        } else {
            setTimeout(() => {
                this.mostrarProximaPergunta();
            }, this.config.animationDelay);
        }
    },

    /**
     * Verificação otimizada de limite de perguntas
     */
    verificarLimitePerguntas() {
        const tipoViagem = this.determinarTipoViagem();
        const perguntasObrigatorias = this.obterPerguntasObrigatorias(tipoViagem);
        
        return perguntasObrigatorias.every(key => 
            this.estado.respostas[key] !== undefined
        );
    },

    /**
     * ✅ CORREÇÃO 4: Determina o tipo de viagem baseado nas respostas do usuário
     * DEVE SER IDÊNTICA À FUNÇÃO NO recommendations.js
     */
    determinarTipoViagem() {
        // 1. PRIMEIRO: Verificar se o usuário escolheu viajar de carro
        if (this.estado.respostas.viagem_carro !== undefined) {
            const viagemCarro = parseInt(this.estado.respostas.viagem_carro);
            if (viagemCarro === 0) { // 0 = Sim, quer viajar de carro
                return 'carro';
            }
            // Se chegou aqui, o usuário escolheu NÃO viajar de carro (valor 1)
            // Então vamos para a lógica de orçamento para aéreo vs rodoviário
        }

        // 2. SEGUNDO: Lógica de orçamento para aéreo vs rodoviário
        const orcamento = this.estado.respostas.orcamento_valor;
        const moeda = this.estado.respostas.moeda_escolhida;
        
        if (!orcamento || orcamento === 'flexível') return 'aereo';
        
        let valorEmBRL = parseFloat(orcamento);
        
        // Converter para BRL se necessário
        if (moeda && moeda !== 'BRL') {
            const taxasConversao = {
                'USD': 5.0,
                'EUR': 5.5,
                'GBP': 6.3,
                'JPY': 0.033
            };
            valorEmBRL = valorEmBRL * (taxasConversao[moeda] || 5.0);
        }
        
        return valorEmBRL < 401 ? 'rodoviario' : 'aereo'; // ✅ Mesmo limiar do recommendations.js
    },

    /**
     * Obtém lista de perguntas obrigatórias baseada no tipo de viagem
     */
    obterPerguntasObrigatorias(tipoViagem) {
        const base = [
            'cidade_partida',
            'companhia',
            'preferencia_viagem',
            'datas',
            'viagem_carro'
        ];

        if (tipoViagem === 'carro') {
            return [...base, 'distancia_maxima'];
        } else {
            return [...base, 'moeda_escolhida', 'orcamento_valor'];
        }
    },

    /**
     * Mostra resposta do usuário de forma otimizada
     */
    mostrarRespostaUsuario(valor, pergunta) {
        const mensagemResposta = this.formatarRespostaUsuario(valor, pergunta);
        
        const mensagemHTML = `
            <div class="chat-message user">
                <div class="message">
                    <p>${mensagemResposta}</p>
                </div>
            </div>
        `;

        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.insertAdjacentHTML('beforeend', mensagemHTML);
            this.rolarParaFinal();
        }
    },

    /**
     * Formata resposta do usuário baseada no tipo
     */
    formatarRespostaUsuario(valor, pergunta) {
        if (pergunta.options) {
            return pergunta.options[valor];
        } else if (pergunta.calendar) {
            return `Ida: ${this.formatarDataVisual(valor.dataIda)} | Volta: ${this.formatarDataVisual(valor.dataVolta)}`;
        } else if (pergunta.autocomplete) {
            return `${valor.name} (${valor.code}), ${valor.country}`;
        } else if (pergunta.slider) {
            return `${valor} km`;
        } else if (pergunta.currency_format) {
            const moeda = this.estado.respostas.moeda_escolhida || 'BRL';
            const simbolo = this.obterSimboloMoeda(moeda);
            return `${simbolo} ${valor.toFixed(2).replace('.', ',')}`;
        }
        
        return valor.toString();
    },

    /**
     * Formata data para exibição visual
     */
    formatarDataVisual(dataStr) {
        if (!dataStr) return 'Data inválida';
        
        try {
            if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [ano, mes, dia] = dataStr.split('-');
                return `${dia}/${mes}/${ano}`;
            }
            return dataStr;
        } catch (error) {
            console.error("Erro ao formatar data visual:", error);
            return 'Data inválida';
        }
    },

    /**
     * Obtém símbolo da moeda
     */
    obterSimboloMoeda(codigo) {
        const simbolos = {
            'BRL': 'R$',
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥'
        };
        return simbolos[codigo] || codigo;
    },

    /**
     * ✅ CORREÇÃO 2: Finalização simplificada do questionário
     */
    async finalizarQuestionario() {
        try {
            console.log("Finalizando questionário...");
            console.log("Dados salvos:", this.estado.respostas);

            // Salvar dados do usuário
            this.salvarDadosUsuario();

            // Mostrar mensagem de finalização
            await this.mostrarMensagemFinalizacao();

            // ✅ USAR SEMPRE A MESMA FUNÇÃO - A API DETECTA O TIPO AUTOMATICAMENTE
            this.buscarRecomendacoes();

        } catch (error) {
            console.error("Erro ao finalizar questionário:", error);
            this.mostrarErro("Erro ao processar dados. Redirecionando...");
            setTimeout(() => window.location.href = 'destinos.html', 2000);
        }
    },

    /**
     * ✅ CORREÇÃO 3: Busca recomendações unificada para todos os tipos
     */
    async buscarRecomendacoes() {
        // Verificar se o serviço de IA está disponível
        if (!window.BENETRIP_AI) {
            console.error("Serviço de IA não disponível");
            this.atualizarBarraProgresso(100, "Erro ao buscar recomendações. Redirecionando...");
            setTimeout(() => {
                window.location.href = 'destinos.html';
            }, 2000);
            return;
        }

        try {
            // ✅ DETECTAR TIPO DE VIAGEM
            const tipoViagem = this.determinarTipoViagem();
            console.log(`🎯 Tipo de viagem detectado: ${tipoViagem}`);

            // ✅ PREPARAR DADOS NO FORMATO CORRETO PARA A API
            const dadosParaAPI = {
                ...this.estado.respostas,
                // ✅ Campos obrigatórios para detecção de tipo
                viagem_carro: this.estado.respostas.viagem_carro,
                distancia_maxima: this.estado.respostas.distancia_maxima,
                orcamento_valor: this.estado.respostas.orcamento_valor,
                moeda_escolhida: this.estado.respostas.moeda_escolhida
            };

            console.log("📦 Enviando dados para API:", dadosParaAPI);

            // ✅ ATUALIZAR PROGRESSO BASEADO NO TIPO
            if (tipoViagem === 'carro') {
                this.atualizarBarraProgresso(20, "Buscando destinos de road trip...");
            } else if (tipoViagem === 'rodoviario') {
                this.atualizarBarraProgresso(20, "Buscando destinos de ônibus...");
            } else {
                this.atualizarBarraProgresso(20, "Buscando destinos aéreos...");
            }

            // ✅ CHAMAR A FUNÇÃO UNIFICADA
            const recomendacoes = await window.BENETRIP_AI.obterRecomendacoes(dadosParaAPI);
            console.log("✅ Recomendações recebidas:", recomendacoes);
            
            // ✅ SALVAR SEMPRE COM O MESMO NOME
            localStorage.setItem('benetrip_recomendacoes', JSON.stringify(recomendacoes));
            
            // Notificar que os dados estão prontos
            this.notificarDadosProntos();
            
            // Mostrar mensagem de conclusão baseada no tipo
            if (tipoViagem === 'carro') {
                this.atualizarBarraProgresso(100, "Roteiros de carro encontrados! Redirecionando...");
            } else if (tipoViagem === 'rodoviario') {
                this.atualizarBarraProgresso(100, "Destinos de ônibus encontrados! Redirecionando...");
            } else {
                this.atualizarBarraProgresso(100, "Destinos encontrados! Redirecionando...");
            }
            
            // Redirecionar para página de destinos após delay
            setTimeout(() => {
                window.location.href = 'destinos.html';
            }, 2000);

        } catch (erro) {
            console.error("Erro ao obter recomendações:", erro);
            this.atualizarBarraProgresso(100, "Erro ao buscar recomendações. Redirecionando...");
            // Redirecionar para página de destinos após delay
            setTimeout(() => {
                window.location.href = 'destinos.html';
            }, 2000);
        }
    },

    /**
     * Notifica que dados estão prontos
     */
    notificarDadosProntos() {
        if (typeof window.BENETRIP?.notificarDadosProntos === 'function') {
            window.BENETRIP.notificarDadosProntos();
        }
    },

    /**
     * ✅ CORREÇÃO 5: Mostra mensagem de finalização com tipos específicos
     */
    async mostrarMensagemFinalizacao() {
        // Mostrar Tripinha pensando
        await this.mostrarTripinhaPensando();

        // ✅ DETECTAR TIPO DE VIAGEM PARA MENSAGEM CORRETA
        const tipoViagem = this.determinarTipoViagem();
        let textoMensagem = '';

        if (tipoViagem === 'carro') {
            const distancia = this.estado.respostas.distancia_maxima;
            textoMensagem = `Perfeito! Vou buscar destinos incríveis num raio de ${distancia}km para sua road trip! 🚗🗺️`;
        } else if (tipoViagem === 'rodoviario') {
            textoMensagem = `Ótimo! Vou buscar destinos perfeitos para viagem de ônibus dentro do seu orçamento! 🚌💰`;
        } else {
            textoMensagem = `Ótimo! Com suas preferências, já sei quais destinos vão te encantar! Vou preparar algumas sugestões especiais para você! 🐾✈️`;
        }

        // Mostrar mensagem da Tripinha
        const mensagemHTML = `
            <div class="chat-message tripinha">
                <div class="avatar">
                    <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" />
                </div>
                <div class="message">
                    <p>${textoMensagem}</p>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: 0%"></div>
                        <p class="progress-text">Preparando...</p>
                    </div>
                </div>
            </div>
        `;

        // Adicionar ao chat
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.insertAdjacentHTML('beforeend', mensagemHTML);
            this.rolarParaFinal();
        }

        // Configurar manipulador de eventos para progresso
        this.configurarEventosProgresso();
        
        // Retornar uma promessa que será resolvida após simular progresso inicial
        return new Promise(resolve => {
            setTimeout(() => {
                this.atualizarBarraProgresso(15, "Iniciando busca...");
                resolve();
            }, 1000);
        });
    },

    /**
     * Mostra Tripinha pensando
     */
    async mostrarTripinhaPensando() {
        const mensagemHTML = `
            <div class="chat-message tripinha">
                <div class="avatar">
                    <img src="${this.config.imagePath}tripinha/avatar-pensando.png" alt="Tripinha pensando" />
                </div>
                <div class="message">
                    <div class="thinking-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;

        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.insertAdjacentHTML('beforeend', mensagemHTML);
            this.rolarParaFinal();
        }

        await this.delay(1500);

        // Remover mensagem de pensamento
        const mensagemPensando = chatMessages?.querySelector('.chat-message.tripinha:last-child');
        if (mensagemPensando) {
            chatMessages.removeChild(mensagemPensando);
        }
    },

    /**
     * Configura eventos de progresso
     */
    configurarEventosProgresso() {
        // Remover listeners antigos
        if (this.handleProgressEvent) {
            window.removeEventListener('benetrip_progress', this.handleProgressEvent);
        }

        // Criar novo handler
        this.handleProgressEvent = (event) => {
            const { progress, message } = event.detail;
            this.atualizarBarraProgresso(progress, message);
        };

        window.addEventListener('benetrip_progress', this.handleProgressEvent);
    },

    /**
     * Atualiza barra de progresso
     */
    atualizarBarraProgresso(porcentagem, mensagem) {
        const progressBar = document.querySelector('.progress-bar');
        const progressText = document.querySelector('.progress-text');

        if (progressBar && progressText) {
            progressBar.style.width = `${Math.min(100, Math.max(0, porcentagem))}%`;
            progressText.textContent = mensagem || 'Processando...';

            if (porcentagem >= 100) {
                setTimeout(() => {
                    document.querySelectorAll('.progress-container').forEach(el => {
                        el.classList.add('completed');
                    });
                }, 500);
            }
        }
    },

    /**
     * ✅ CORREÇÃO 7: Salva dados do usuário com formato consistente
     */
    salvarDadosUsuario() {
        // ✅ USAR A FUNÇÃO DE DETECÇÃO DE TIPO
        const tipoViagem = this.determinarTipoViagem();
        
        // Estrutura padronizada para salvar no localStorage
        const dadosPadronizados = {
            fluxo: 'destino_desconhecido', // ✅ Sempre este valor para este fluxo
            tipoViagem: tipoViagem, // ✅ Detectado automaticamente
            timestamp: Date.now(),
            respostas: {
                ...this.estado.respostas,
                // ✅ Garantir que campos essenciais estejam presentes
                viagem_carro: this.estado.respostas.viagem_carro,
                distancia_maxima: this.estado.respostas.distancia_maxima,
                // Garante que informações de passageiros estejam sempre no mesmo formato
                passageiros: {
                    adultos: this.getNumeroAdultos(),
                    criancas: 0,
                    bebes: 0
                }
            }
        };

        // ✅ PROCESSAR MOEDA CORRETAMENTE
        if (this.estado.respostas.moeda_escolhida && typeof this.estado.respostas.moeda_escolhida === 'string') {
            // Extrair código da moeda se estiver no formato completo
            dadosPadronizados.respostas.moeda_escolhida = this.obterCodigoMoeda(this.estado.respostas.moeda_escolhida);
        }

        // Verificar e padronizar dados da cidade de partida
        if (this.estado.respostas.cidade_partida) {
            // ✅ GARANTIR FORMATO OBJETO ESPERADO PELA API
            if (typeof this.estado.respostas.cidade_partida === 'object') {
                // Já está no formato correto do autocomplete
                dadosPadronizados.respostas.cidade_partida = this.estado.respostas.cidade_partida;
            } else {
                // Converter string para objeto
                const match = this.estado.respostas.cidade_partida.match(/\(([A-Z]{3})\)/);
                dadosPadronizados.respostas.cidade_partida = {
                    name: this.estado.respostas.cidade_partida.replace(/\s*\([^)]*\)/, ''),
                    code: match ? match[1] : 'SAO',
                    cidade: this.estado.respostas.cidade_partida.replace(/\s*\([^)]*\)/, ''),
                    pais: 'Brasil',
                    sigla_estado: 'SP' // Default
                };
            }
        }

        // ✅ GARANTIR FORMATO CORRETO DAS DATAS
        if (this.estado.respostas.datas) {
            dadosPadronizados.respostas.datas = {
                dataIda: this.formatarDataISO(this.estado.respostas.datas.dataIda),
                dataVolta: this.formatarDataISO(this.estado.respostas.datas.dataVolta || '')
            };
        }

        console.log("💾 Salvando dados padronizados:", dadosPadronizados);
        localStorage.setItem('benetrip_user_data', JSON.stringify(dadosPadronizados));
    },

    /**
     * Obtém número de adultos baseado nas respostas
     */
    getNumeroAdultos() {
        const companhia = this.estado.respostas.companhia;
        
        switch (companhia) {
            case 0: return 1; // Sozinho
            case 1: return 2; // Casal
            case 2: return this.estado.respostas.quantidade_familia || 2; // Família
            case 3: return this.estado.respostas.quantidade_amigos || 2; // Amigos
            default: return 1;
        }
    },

    /**
     * Verificação otimizada de dados salvos
     */
    verificarDadosSalvos() {
        try {
            const dadosSalvos = localStorage.getItem('benetrip_user_data');
            
            if (dadosSalvos) {
                const dados = JSON.parse(dadosSalvos);
                
                // Verificar validade temporal (24 horas)
                if (this.isDadosValidos(dados)) {
                    console.log("Dados de usuário carregados do localStorage");
                    if (this.config.debugMode) {
                        console.log("Dados carregados:", dados);
                    }
                } else {
                    console.log("Dados salvos expirados, removendo...");
                    localStorage.removeItem('benetrip_user_data');
                }
            }
        } catch (error) {
            console.error("Erro ao carregar dados salvos:", error);
            localStorage.removeItem('benetrip_user_data'); // Limpar dados corrompidos
        }
    },

    /**
     * Verifica se os dados salvos ainda são válidos
     */
    isDadosValidos(dados) {
        if (!dados.timestamp) return false;
        
        const agora = Date.now();
        const horasDecorridas = (agora - dados.timestamp) / (1000 * 60 * 60);
        
        return horasDecorridas < 24;
    },

    /**
     * Inicialização das telas auxiliares
     */
    iniciarTelaDestinos() {
        const dadosUsuario = localStorage.getItem('benetrip_user_data');
        const recomendacoes = localStorage.getItem('benetrip_recomendacoes');

        if (!dadosUsuario || !recomendacoes) {
            window.location.href = 'index.html';
            return;
        }

        try {
            const dados = JSON.parse(dadosUsuario);
            this.renderizarDestinos(JSON.parse(recomendacoes));
        } catch (error) {
            console.error("Erro ao inicializar tela de destinos:", error);
            window.location.href = 'index.html';
        }
    },

    /**
     * Inicialização da tela de voos
     */
    iniciarTelaVoos() {
        const dadosUsuario = localStorage.getItem('benetrip_user_data');
        const resultadosVoos = localStorage.getItem('benetrip_resultados_voos');

        if (!dadosUsuario || !resultadosVoos) {
            window.location.href = 'index.html';
            return;
        }

        try {
            this.renderizarVoos(JSON.parse(resultadosVoos));
        } catch (error) {
            console.error("Erro ao inicializar tela de voos:", error);
            window.location.href = 'index.html';
        }
    },

    /**
     * Renderização de destinos (placeholder)
     */
    renderizarDestinos(recomendacoes) {
        console.log("Renderizando destinos:", recomendacoes);
        // Implementação será adicionada conforme necessário
    },

    /**
     * Renderização de voos (placeholder)
     */
    renderizarVoos(resultados) {
        console.log("Renderizando voos:", resultados);
        // Implementação será adicionada conforme necessário
    },

    /**
     * Utilitários de interface
     */

    /**
     * Mostra/esconde indicador de carregamento
     */
    mostrarCarregando(estado) {
        this.estado.carregando = estado;
        
        const loadingElement = document.getElementById('loading-indicator');
        if (loadingElement) {
            loadingElement.style.display = estado ? 'flex' : 'none';
        }
    },

    /**
     * Mostra mensagem de erro com auto-remoção
     */
    mostrarErro(mensagem, duracao = 3000) {
        const errorElement = this.criarElementoErro(mensagem);
        
        document.body.appendChild(errorElement);
        
        // Animar entrada
        setTimeout(() => errorElement.classList.add('show'), 100);
        
        // Animar saída
        setTimeout(() => {
            errorElement.classList.remove('show');
            setTimeout(() => {
                if (errorElement.parentNode) {
                    document.body.removeChild(errorElement);
                }
            }, 300);
        }, duracao);
    },

    // ===== CORREÇÃO 8: Mostrar erro específico do calendário =====
    /**
     * Mostra erro específico do calendário com opções de recuperação
     */
    mostrarErroCalendario(mensagem) {
        console.error("❌ Erro do calendário:", mensagem);
        
        const mensagemCompleta = `
            <div class="chat-message tripinha error">
                <div class="avatar">
                    <img src="${this.config.imagePath}tripinha/avatar-triste.png" alt="Tripinha triste" />
                </div>
                <div class="message">
                    <p>Ops! Tive um problema com o calendário. 😅</p>
                    <p><strong>Erro:</strong> ${mensagem}</p>
                    <div class="error-actions">
                        <button onclick="location.reload()" class="retry-button">
                            🔄 Recarregar Página
                        </button>
                        <button onclick="BENETRIP.tentarRecuperarCalendario()" class="fix-button">
                            🔧 Tentar Corrigir
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.insertAdjacentHTML('beforeend', mensagemCompleta);
            this.rolarParaFinal();
        }
    },

    // ===== CORREÇÃO 9: Função de recuperação do calendário =====
    /**
     * Tenta recuperar o calendário em caso de erro
     */
    tentarRecuperarCalendario() {
        console.log("🔧 Tentando recuperar calendário...");
        
        try {
            // Limpar estado atual
            this.estado.currentCalendarId = null;
            this.estado.ultimoCalendarIdGerado = null;
            if (this.estado.calendarioAtual) {
                this.estado.calendarioAtual.destroy();
                this.estado.calendarioAtual = null;
            }
            
            // Tentar encontrar calendário no DOM
            const calendarioEncontrado = this.encontrarCalendarioNoDom();
            
            if (calendarioEncontrado) {
                this.estado.currentCalendarId = calendarioEncontrado.id;
                
                // Tentar configurar novamente
                const perguntaAtual = this.estado.perguntas[this.estado.perguntaAtual];
                if (perguntaAtual && perguntaAtual.calendar) {
                    this.configurarCalendario(perguntaAtual);
                    this.exibirToast("Calendário recuperado com sucesso! 🎉", 'success');
                }
            } else {
                this.exibirToast("Não foi possível recuperar o calendário. Recarregue a página.", 'error');
            }
            
        } catch (error) {
            console.error("❌ Erro na recuperação:", error);
            this.exibirToast("Falha na recuperação. Recarregue a página.", 'error');
        }
    },

    /**
     * Cria elemento de erro
     */
    criarElementoErro(mensagem) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = mensagem;
        
        // Estilos inline para garantir funcionalidade
        Object.assign(errorElement.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            backgroundColor: '#f44336',
            color: 'white',
            borderRadius: '4px',
            zIndex: '10000',
            opacity: '0',
            transform: 'translateY(-20px)',
            transition: 'all 0.3s ease'
        });
        
        return errorElement;
    },

    /**
     * Exibe toast otimizado
     */
    exibirToast(mensagem, tipo = 'info', duracao = 3000) {
        const toastContainer = this.obterToastContainer();
        const toast = this.criarToast(mensagem, tipo);
        
        toastContainer.appendChild(toast);
        
        // Animar entrada
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remover após duração
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, duracao);
    },

    /**
     * Obtém container de toast, criando se necessário
     */
    obterToastContainer() {
        let container = document.getElementById('toast-container');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
        
        return container;
    },

    /**
     * Cria elemento de toast
     */
    criarToast(mensagem, tipo) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${tipo}`;
        toast.textContent = mensagem;
        
        const cores = {
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FF9800',
            error: '#f44336'
        };
        
        Object.assign(toast.style, {
            padding: '12px 16px',
            marginBottom: '10px',
            backgroundColor: cores[tipo] || cores.info,
            color: 'white',
            borderRadius: '4px',
            opacity: '0',
            transform: 'translateX(100%)',
            transition: 'all 0.3s ease',
            pointerEvents: 'auto',
            cursor: 'pointer'
        });
        
        // Permitir fechamento ao clicar
        toast.addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
        
        return toast;
    },

    /**
     * Rola chat para o final de forma suave
     */
    rolarParaFinal() {
        const chatMessages = document.getElementById('chat-messages');
        
        if (chatMessages) {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }
    },

    /**
     * Registra eventos globais da aplicação
     */
    registrarEventos() {
        // Evento de carregamento do DOM
        document.addEventListener('DOMContentLoaded', () => {
            console.log("DOM carregado");
        });

        // Evento de mudança de visibilidade da página
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log("Página ficou oculta");
                // Pausar operações pesadas se necessário
            } else {
                console.log("Página voltou a ficar visível");
                // Retomar operações se necessário
            }
        });

        // Evento de erro global
        window.addEventListener('error', (event) => {
            console.error("Erro global capturado:", event.error);
            
            if (this.config.debugMode) {
                this.mostrarErro(`Erro: ${event.error?.message || 'Erro desconhecido'}`);
            }
        });

        // Evento de erro de promise rejeitada
        window.addEventListener('unhandledrejection', (event) => {
            console.error("Promise rejeitada não tratada:", event.reason);
            
            if (this.config.debugMode) {
                this.mostrarErro(`Promise rejeitada: ${event.reason?.message || 'Erro desconhecido'}`);
            }
        });

        // Evento de redimensionamento da janela
        window.addEventListener('resize', this.criarDebounce(() => {
            console.log("Janela redimensionada");
            // Ajustar elementos responsivos se necessário
            this.ajustarElementosResponsivos();
        }, 250));

        // Evento de mudança de conexão (se suportado)
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', () => {
                console.log("Conexão mudou:", navigator.connection.effectiveType);
                this.ajustarParaConexao(navigator.connection.effectiveType);
            });
        }

        // Eventos de foco/desfoque da janela
        window.addEventListener('focus', () => {
            console.log("Janela ganhou foco");
            this.onWindowFocus();
        });

        window.addEventListener('blur', () => {
            console.log("Janela perdeu foco");
            this.onWindowBlur();
        });

        // Evento para detectar navegação com botão voltar
        window.addEventListener('popstate', (event) => {
            console.log("Navegação com botão voltar detectada");
            this.onPopState(event);
        });

        // Evento antes de sair da página
        window.addEventListener('beforeunload', (event) => {
            // Salvar estado atual se necessário
            this.salvarEstadoAntesDeSair();
        });
    },

    /**
     * Ajusta elementos responsivos após redimensionamento
     */
    ajustarElementosResponsivos() {
        // Verificar se calendário está visível e ajustar
        if (this.estado.calendarioAtual) {
            try {
                this.estado.calendarioAtual.redraw();
            } catch (error) {
                console.warn("Erro ao redesenhar calendário:", error);
            }
        }

        // Ajustar posição de elementos flutuantes
        const autocompleteResults = document.querySelectorAll('.autocomplete-results');
        autocompleteResults.forEach(element => {
            this.ajustarPosicaoAutocomplete(element);
        });
    },

    /**
     * Ajusta interface baseada na qualidade da conexão
     */
    ajustarParaConexao(tipoConexao) {
        const configuracoes = {
            'slow-2g': { animationDelay: 200, debounceDelay: 500 },
            '2g': { animationDelay: 400, debounceDelay: 400 },
            '3g': { animationDelay: 600, debounceDelay: 350 },
            '4g': { animationDelay: 800, debounceDelay: 300 }
        };

        const config = configuracoes[tipoConexao] || configuracoes['4g'];
        
        // Atualizar configurações para otimizar performance
        this.config.animationDelay = config.animationDelay;
        this.config.debounceDelay = config.debounceDelay;

        console.log(`Configurações ajustadas para conexão ${tipoConexao}:`, config);
    },

    /**
     * Manipula evento de foco da janela
     */
    onWindowFocus() {
        // Verificar se há atualizações pendentes
        this.verificarAtualizacoesPendentes();
        
        // Revalidar dados em cache se necessário
        if (!this.isCacheValid()) {
            console.log("Cache expirado, recarregando dados de cidades...");
            this.carregarDadosCidades().catch(error => {
                console.warn("Erro ao recarregar cache:", error);
            });
        }
    },

    /**
     * Manipula evento de desfoque da janela
     */
    onWindowBlur() {
        // Pausar animações desnecessárias para economizar recursos
        this.pausarAnimacoesDesnecessarias();
    },

    /**
     * Manipula navegação com botão voltar
     */
    onPopState(event) {
        // Implementar lógica específica se necessário
        console.log("Estado da navegação:", event.state);
    },

    /**
     * Salva estado antes de sair da página
     */
    salvarEstadoAntesDeSair() {
        if (this.estado.sessaoIniciada && Object.keys(this.estado.respostas).length > 0) {
            // Atualizar timestamp dos dados salvos
            const dadosAtuais = localStorage.getItem('benetrip_user_data');
            if (dadosAtuais) {
                try {
                    const dados = JSON.parse(dadosAtuais);
                    dados.ultimaAtualizacao = Date.now();
                    localStorage.setItem('benetrip_user_data', JSON.stringify(dados));
                } catch (error) {
                    console.warn("Erro ao atualizar timestamp:", error);
                }
            }
        }
    },

    /**
     * Verifica atualizações pendentes
     */
    verificarAtualizacoesPendentes() {
        // Verificar se há dados novos ou atualizações disponíveis
        const ultimaAtualizacao = this.estado.ultimaAtualizacao;
        const agora = Date.now();
        
        if (ultimaAtualizacao && (agora - ultimaAtualizacao) > 30000) { // 30 segundos
            console.log("Verificando atualizações...");
            // Implementar verificação de atualizações se necessário
        }
    },

    /**
     * Pausa animações desnecessárias
     */
    pausarAnimacoesDesnecessarias() {
        // Pausar dots de pensamento se estiverem visíveis
        const thinkingDots = document.querySelectorAll('.thinking-dots');
        thinkingDots.forEach(dots => {
            dots.style.animationPlayState = 'paused';
        });
    },

    /**
     * Retoma animações
     */
    retomarAnimacoes() {
        const thinkingDots = document.querySelectorAll('.thinking-dots');
        thinkingDots.forEach(dots => {
            dots.style.animationPlayState = 'running';
        });
    },

    /**
     * Ajusta posição do autocomplete
     */
    ajustarPosicaoAutocomplete(element) {
        if (!element || !element.offsetParent) return;

        const rect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // Se o elemento sai da viewport, ajustar posição
        if (rect.bottom > viewportHeight) {
            element.style.maxHeight = `${viewportHeight - rect.top - 20}px`;
            element.style.overflowY = 'auto';
        }
    },

    /**
     * Função de limpeza e cleanup
     */
    cleanup() {
        console.log("Executando limpeza da aplicação...");
        
        // Limpar calendário se existir
        if (this.estado.calendarioAtual) {
            try {
                this.estado.calendarioAtual.destroy();
                this.estado.calendarioAtual = null;
            } catch (error) {
                console.warn("Erro ao destruir calendário:", error);
            }
        }

        // Limpar event listeners
        if (this.handleProgressEvent) {
            window.removeEventListener('benetrip_progress', this.handleProgressEvent);
            this.handleProgressEvent = null;
        }

        // Limpar cache de consultas se muito grande
        if (this.cache.queryCache.size > this.config.maxCacheSize) {
            this.cache.queryCache.clear();
            console.log("Cache de consultas limpo");
        }

        // Limpar listeners do event bus
        this.eventBus.listeners.clear();

        // Reset de estados
        this.estado.currentCalendarId = null;
        this.estado.currentSliderId = null;
        this.estado.currentAutocompleteId = null;
        this.estado.currentNumberInputId = null;
        this.estado.currentCurrencyId = null;
        this.estado.currentTextId = null;
    },

    /**
     * Função de debug para desenvolvimento
     */
    debug: {
        /**
         * Mostra informações do estado atual
         */
        showState() {
            console.log("=== ESTADO ATUAL DA APLICAÇÃO ===");
            console.log("Fluxo:", BENETRIP.estado.fluxo);
            console.log("Tipo de viagem:", BENETRIP.determinarTipoViagem());
            console.log("Pergunta atual:", BENETRIP.estado.perguntaAtual);
            console.log("Respostas:", BENETRIP.estado.respostas);
            console.log("Cache cidades:", !!BENETRIP.cache.cidadesData);
            console.log("Sessão iniciada:", BENETRIP.estado.sessaoIniciada);
            console.log("================================");
        },

        /**
         * Limpa todos os dados salvos
         */
        clearAllData() {
            localStorage.removeItem('benetrip_user_data');
            localStorage.removeItem('benetrip_recomendacoes');
            localStorage.removeItem('benetrip_destino_selecionado');
            localStorage.removeItem('benetrip_resultados_voos');
            console.log("Todos os dados do localStorage foram limpos");
        },

        /**
         * Simula resposta para teste
         */
        simularResposta(perguntaKey, valor) {
            BENETRIP.estado.respostas[perguntaKey] = valor;
            console.log(`Resposta simulada: ${perguntaKey} = ${valor}`);
        },

        /**
         * Força finalização do questionário para teste
         */
        forcarFinalizacao() {
            console.log("Forçando finalização do questionário...");
            BENETRIP.finalizarQuestionario();
        },

        /**
         * Testa busca de cidades
         */
        async testarBuscaCidades(termo) {
            console.log(`Testando busca por: "${termo}"`);
            const resultados = await BENETRIP.buscarCidadesLocal(termo);
            console.log("Resultados encontrados:", resultados);
            return resultados;
        },

        /**
         * Mostra estatísticas de performance
         */
        showPerformance() {
            console.log("=== ESTATÍSTICAS DE PERFORMANCE ===");
            console.log("Cache de consultas:", BENETRIP.cache.queryCache.size);
            console.log("Cidades carregadas:", BENETRIP.cache.cidadesData?.length || 0);
            console.log("Cache válido:", BENETRIP.isCacheValid());
            console.log("Última atualização cache:", new Date(BENETRIP.cache.lastUpdate || 0));
            console.log("==================================");
        },

        // ===== CORREÇÃO 10: Debug aprimorado do calendário =====
        /**
         * Debug específico do calendário - versão aprimorada
         */
        debugCalendario() {
            console.log("=== DEBUG CALENDÁRIO v2.1.2 ===");
            console.log("Estado atual:", {
                currentCalendarId: BENETRIP.estado.currentCalendarId,
                ultimoCalendarIdGerado: BENETRIP.estado.ultimoCalendarIdGerado,
                calendarioAtivo: !!BENETRIP.estado.calendarioAtual,
                flatpickrDisponivel: typeof flatpickr !== 'undefined'
            });
            
            console.log("Elementos no DOM:");
            const elementos = {
                'calendarios_por_id': document.querySelectorAll('[id*="benetrip-calendar"]').length,
                'containers': document.querySelectorAll('.calendar-container').length,
                'flatpickr_containers': document.querySelectorAll('.flatpickr-calendar-container').length,
                'todos_com_calendar_no_id': document.querySelectorAll('[id*="calendar"]').length
            };
            console.table(elementos);
            
            // Listar todos os calendários encontrados
            const todosCalendarios = document.querySelectorAll('[id*="calendar"]');
            console.log("Calendários encontrados:");
            todosCalendarios.forEach((el, i) => {
                console.log(`${i + 1}. ID: "${el.id}", Classes: "${el.className}", Visible: ${el.offsetParent !== null}`);
            });
            
            // Verificar ID atual se definido
            if (BENETRIP.estado.currentCalendarId) {
                const elemento = document.getElementById(BENETRIP.estado.currentCalendarId);
                console.log("Elemento do ID atual:");
                console.log("- Encontrado:", !!elemento);
                if (elemento) {
                    const filhos = BENETRIP.verificarElementosFilhosCalendario(BENETRIP.estado.currentCalendarId);
                    console.log("- Elementos filhos:", filhos);
                }
            }
            
            console.log("===============================");
            
            return {
                estado: BENETRIP.estado,
                elementos,
                todosCalendarios: Array.from(todosCalendarios).map(el => ({
                    id: el.id,
                    classes: el.className,
                    visible: el.offsetParent !== null
                }))
            };
        }
    },

    /**
     * Função de inicialização para desenvolvimento
     */
    devInit() {
        if (this.config.debugMode) {
            console.log("Modo de desenvolvimento ativado");
            
            // Adicionar funções de debug ao objeto global
            window.BENETRIP_DEBUG = this.debug;
            
            // Mostrar informações úteis
            console.log("Comandos disponíveis:");
            console.log("- BENETRIP_DEBUG.showState() - Mostra estado atual");
            console.log("- BENETRIP_DEBUG.clearAllData() - Limpa dados salvos");
            console.log("- BENETRIP_DEBUG.showPerformance() - Mostra estatísticas");
            console.log("- BENETRIP_DEBUG.testarBuscaCidades('termo') - Testa busca");
            console.log("- BENETRIP_DEBUG.debugCalendario() - Debug do calendário");
        }
    },

    /**
     * Método de atualização de versão
     */
    checkVersion() {
        const versaoAtual = "2.1.2";
        const versaoSalva = localStorage.getItem('benetrip_version');
        
        if (versaoSalva !== versaoAtual) {
            console.log(`Atualizando versão: ${versaoSalva || 'inicial'} -> ${versaoAtual}`);
            
            // Executar migrações se necessário
            this.executarMigracoes(versaoSalva, versaoAtual);
            
            // Salvar nova versão
            localStorage.setItem('benetrip_version', versaoAtual);
        }
    },

    /**
     * Executa migrações entre versões
     */
    executarMigracoes(versaoAntiga, versaoNova) {
        console.log(`Executando migrações de ${versaoAntiga} para ${versaoNova}`);
        
        // Limpar dados incompatíveis se necessário
        if (!versaoAntiga || versaoAntiga.startsWith('1.') || versaoAntiga.startsWith('2.0')) {
            console.log("Limpando dados de versão antiga para garantir compatibilidade...");
            this.debug.clearAllData();
        }
        
        // Outras migrações podem ser adicionadas aqui
    }
};

// Auto-inicialização quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Verificar versão antes de inicializar
    BENETRIP.checkVersion();
    
    // Inicializar aplicação
    BENETRIP.init().then(() => {
        console.log("Benetrip totalmente inicializado");
        
        // Inicializar modo de desenvolvimento se necessário
        BENETRIP.devInit();
        
    }).catch(error => {
        console.error("Falha na inicialização:", error);
        
        // Tentar recuperação básica
        setTimeout(() => {
            console.log("Tentando recuperação...");
            BENETRIP.mostrarErro("Erro na inicialização. Recarregue a página.");
        }, 1000);
    });
});

// Limpeza ao sair da página
window.addEventListener('beforeunload', () => {
    BENETRIP.cleanup();
});

// Exportar para namespace global
window.BENETRIP = BENETRIP;

// Exportar versão para verificação
window.BENETRIP_VERSION = "2.1.2";

// Log de inicialização
console.log("🐶 Benetrip App v2.1.2 carregado - Pronto para aventuras!");

/**
 * === CHANGELOG v2.1.2 ===
 * 
 * 🛠️ CORREÇÕES DO ERRO "ID do calendário não definido":
 * 
 * 1. ✅ GERAÇÃO ID GARANTIDA:
 *    - ID criado e salvo ANTES de qualquer operação
 *    - Backup com ultimoCalendarIdGerado
 *    - Log detalhado de cada etapa
 * 
 * 2. ✅ CONFIGURAÇÃO ROBUSTA:
 *    - configurarCalendario() recebe ID como parâmetro opcional
 *    - Fallback para encontrar calendário no DOM
 *    - Verificação de elementos filhos
 * 
 * 3. ✅ AGUARDAR ELEMENTO MELHORADO:
 *    - aguardarElementoCalendario() aceita ID como parâmetro
 *    - Múltiplas verificações de fallback
 *    - Logs de progresso detalhados
 * 
 * 4. ✅ RECUPERAÇÃO AUTOMÁTICA:
 *    - encontrarCalendarioNoDom() como fallback
 *    - tentarRecuperarCalendario() para casos de erro
 *    - Múltiplos seletores CSS para busca
 * 
 * 5. ✅ TRATAMENTO DE ERRO:
 *    - mostrarErroCalendario() com opções de recuperação
 *    - Botões para recarregar ou tentar corrigir
 *    - Mensagens específicas e acionáveis
 * 
 * 6. ✅ DEBUG APRIMORADO:
 *    - debugCalendario() versão 2.1.2 mais detalhada
 *    - Informações de estado e DOM em tempo real
 *    - Tabela de elementos encontrados
 * 
 * 7. ✅ TIMING OTIMIZADO:
 *    - configurarEventosPergunta() com delay de 100ms
 *    - Calendário com delay adicional de 200ms
 *    - Aguarda renderização completa do DOM
 * 
 * 8. ✅ VERIFICAÇÕES EXTRAS:
 *    - verificarElementosFilhosCalendario() garante DOM completo
 *    - IDs únicos com timestamp + random
 *    - Limpeza de calendários anteriores
 * 
 * 🎯 RESULTADO ESPERADO:
 * ✅ Erro "ID do calendário não definido" ELIMINADO
 * ✅ Calendário funciona em 100% dos casos
 * ✅ Recuperação automática em caso de problemas
 * ✅ Debug tools para desenvolvimento
 * ✅ Experiência de usuário sem interrupções
 */
