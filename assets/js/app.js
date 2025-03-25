/**
 * BENETRIP - App Principal
 * Controla o fluxo de interação com o usuário, questionário e navegação entre telas
 */

const BENETRIP = {
    /**
     * Configuração da aplicação
     */
    config: {
        debugMode: false,
        questionarioPath: 'data/questions.json',
        defaultCurrency: 'BRL',
        imagePath: 'assets/images/',
        maxQuestionsPerFlow: 8, // Limitar a 5-6 perguntas por fluxo
        animationDelay: 800
    },

    /**
     * Estados da aplicação
     */
    estado: {
        fluxo: null, // 'destino_conhecido' ou 'destino_desconhecido'
        perguntaAtual: 0,
        perguntas: [],
        respostas: {},
        carregando: false
    },

    /**
     * Inicializa a aplicação
     */
    init() {
        console.log("Benetrip inicializando...");
        
        // Verificar se estamos na página inicial
        if (document.getElementById('chat-container')) {
            this.iniciarChat();
        }
        
        // Verificar se estamos na página de destinos
        if (document.getElementById('destinos-container')) {
            this.iniciarTelaDestinos();
        }
        
        // Verificar se estamos na página de voos
        if (document.getElementById('voos-container')) {
            this.iniciarTelaVoos();
        }
        
        // Verificar se temos dados salvos de uma sessão anterior
        this.verificarDadosSalvos();
        
        // Inicializar serviços de API se disponíveis
        if (window.BENETRIP_API) {
            window.BENETRIP_API.init();
        }
        
        // Inicializar serviço de IA se disponível
        if (window.BENETRIP_AI) {
            window.BENETRIP_AI.init();
        }
        
        // Registrar manipuladores de eventos
        this.registrarEventos();
        
        return this;
    },
    
    /**
     * Inicia a interface de chat e carrega perguntas
     */
    iniciarChat() {
        // Mostrar indicador de carregamento
        this.mostrarCarregando(true);
        
        // Carregar perguntas do arquivo JSON
        this.carregarPerguntas()
            .then(() => {
                console.log("Perguntas carregadas com sucesso");
                
                // Mostrar mensagem de boas-vindas e primeira pergunta
                this.mostrarMensagemBoasVindas();
                
                // Esconder indicador de carregamento
                this.mostrarCarregando(false);
            })
            .catch(erro => {
                console.error("Erro ao carregar perguntas:", erro);
                this.mostrarErro("Ops! Não consegui carregar as perguntas. Tente novamente mais tarde.");
                this.mostrarCarregando(false);
            });
    },

    /**
     * Carrega as perguntas do arquivo JSON
     */
    async carregarPerguntas() {
        try {
            const resposta = await fetch(this.config.questionarioPath);
            
            if (!resposta.ok) {
                throw new Error(`Erro ${resposta.status}: ${resposta.statusText}`);
            }
            
            const dados = await resposta.json();
            this.estado.perguntas = dados;
            return dados;
        } catch (erro) {
            console.error("Erro ao carregar perguntas:", erro);
            throw erro;
        }
    },

    /**
     * Mostra a mensagem de boas-vindas da Tripinha
     */
    mostrarMensagemBoasVindas() {
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
        
        document.getElementById('chat-messages').innerHTML = mensagem;
        
        // Mostrar primeira pergunta após breve delay
        // Armazenar referência ao "this" atual para usar dentro do setTimeout
        const self = this;
        setTimeout(function() {
            self.mostrarProximaPergunta();
        }, this.config.animationDelay);
    },

    /**
     * Mostra a próxima pergunta no chat
     */
    mostrarProximaPergunta() {
        // Verificar se ainda temos perguntas
        if (this.estado.perguntaAtual >= this.estado.perguntas.length) {
            this.finalizarQuestionario();
            return;
        }
        
        // Obter a próxima pergunta
        const pergunta = this.estado.perguntas[this.estado.perguntaAtual];
        
        // Verificar se é uma pergunta condicional
        if (pergunta.conditional && !this.deveExibirPerguntaCondicional(pergunta)) {
            // Pular esta pergunta e ir para a próxima
            this.estado.perguntaAtual++;
            this.mostrarProximaPergunta();
            return;
        }
        
        // Gerar e exibir a mensagem com a pergunta
        const mensagemHTML = this.montarHTMLPergunta(pergunta);
        
        // Adicionar ao chat
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.insertAdjacentHTML('beforeend', mensagemHTML);
        
        // Rolar para a última mensagem
        this.rolarParaFinal();
        
        // Configurar eventos específicos para o tipo de pergunta
        this.configurarEventosPergunta(pergunta);
    },

    /**
     * Verifica se uma pergunta condicional deve ser exibida
     */
    deveExibirPerguntaCondicional(pergunta) {
        if (!pergunta.conditional) return true;
        
        const dependenciaKey = pergunta.conditional.depends_on;
        const valorEsperado = pergunta.conditional.show_if_value;
        
        // Verificar se temos a resposta para a dependência
        if (this.estado.respostas.hasOwnProperty(dependenciaKey)) {
            return this.estado.respostas[dependenciaKey] === valorEsperado;
        }
        
        return false;
    },

    /**
     * Monta o HTML para exibir uma pergunta no chat
     */
    montarHTMLPergunta(pergunta) {
        let opcoesHTML = '';
        
        // Construir opções com base no tipo da pergunta
        if (pergunta.options) {
            // Código existente para perguntas de múltipla escolha
            opcoesHTML = `
                <div class="options-container">
                    ${pergunta.options.map((opcao, index) => `
                        <button class="option-button" data-index="${index}" data-valor="${index}">
                            ${opcao}
                        </button>
                    `).join('')}
                </div>
            `;
        } else if (pergunta.input_field) {
            if (pergunta.calendar) {
                console.log("Gerando HTML do calendário");
                
                // Gerar ID único para evitar conflitos com elementos anteriores
                const calendarId = `benetrip-calendar-${Date.now()}`;
                
                // Armazenar o ID para referência posterior
                this.estado.currentCalendarId = calendarId;
                
                opcoesHTML = `
                    <div class="calendar-container" data-calendar-container="${calendarId}">
                        <div id="${calendarId}" class="flatpickr-calendar-container"></div>
                        <div class="date-selection">
                            <p>Ida: <span id="data-ida-${calendarId}" class="data-ida">Selecione</span></p>
                            <p>Volta: <span id="data-volta-${calendarId}" class="data-volta">Selecione</span></p>
                        </div>
                        <button id="confirmar-datas-${calendarId}" class="confirm-button confirm-dates" disabled>Confirmar Datas</button>
                    </div>
                `;
                console.log(`HTML do calendário gerado com ID dinâmico: ${calendarId}`);
            }
            else if (pergunta.number_input) {
                // Entrada numérica
                const inputId = `number-input-${Date.now()}`;
                this.estado.currentNumberInputId = inputId;
                
                opcoesHTML = `
                    <div class="number-input-container">
                        <button class="decrement">-</button>
                        <input type="number" min="1" max="20" value="1" id="${inputId}" class="number-input">
                        <button class="increment">+</button>
                        <button class="confirm-number">Confirmar</button>
                    </div>
                `;
            } else if (pergunta.autocomplete) {
                // Campo com autocomplete
                const autocompleteId = `autocomplete-${Date.now()}`;
                this.estado.currentAutocompleteId = autocompleteId;
                
                opcoesHTML = `
                    <div class="autocomplete-container" id="${autocompleteId}-container">
                        <input type="text" id="${autocompleteId}" class="autocomplete-input" placeholder="${pergunta.description}">
                        <div id="${autocompleteId}-results" class="autocomplete-results"></div>
                        <button id="${autocompleteId}-confirm" class="confirm-autocomplete" disabled>Confirmar</button>
                    </div>
                `;
            } else if (pergunta.currency_format) {
                // Campo para valor monetário
                const currencyId = `currency-input-${Date.now()}`;
                this.estado.currentCurrencyId = currencyId;
                
                opcoesHTML = `
                    <div class="currency-input-container">
                        <input type="text" id="${currencyId}" class="currency-input" placeholder="0,00">
                        <button id="${currencyId}-confirm" class="confirm-currency" disabled>Confirmar</button>
                    </div>
                `;
            } else {
                // Campo de texto simples
                const textId = `text-input-${Date.now()}`;
                this.estado.currentTextId = textId;
                
                opcoesHTML = `
                    <div class="text-input-container">
                        <input type="text" id="${textId}" class="text-input" placeholder="${pergunta.description}">
                        <button id="${textId}-confirm" class="confirm-text" disabled>Confirmar</button>
                    </div>
                `;
            }
        }
        
        // Construir a mensagem completa
        return `
            <div class="chat-message tripinha" data-pergunta-key="${pergunta.key || ''}">
                <div class="avatar">
                    <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" />
                </div>
                <div class="message">
                    <p class="question">${pergunta.question}</p>
                    <p class="description">${pergunta.description || ''}</p>
                    ${opcoesHTML}
                </div>
            </div>
        `;
    },

    /**
     * Configura eventos específicos para cada tipo de pergunta
     */
    configurarEventosPergunta(pergunta) {
        // Botões de opção para perguntas de múltipla escolha
        const optionButtons = document.querySelectorAll('.option-button');
        if (optionButtons.length > 0) {
            optionButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const valor = parseInt(button.dataset.valor);
                    this.processarResposta(valor, pergunta);
                });
            });
        }
        
        // Configurar calendário
        if (pergunta.calendar) {
            console.log("Configurando calendário...");
            
            // Verificar se carregou a biblioteca Flatpickr
            if (typeof flatpickr === 'undefined') {
                console.error("Biblioteca Flatpickr não encontrada. Tentando carregar dinamicamente...");
                
                // Tentar carregar Flatpickr dinamicamente
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js';
                script.onload = () => {
                    console.log("Flatpickr carregado com sucesso");
                    const style = document.createElement('link');
                    style.rel = 'stylesheet';
                    style.href = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css';
                    document.head.appendChild(style);
                    
                    // Inicializar calendário após carregamento
                    setTimeout(() => {
                        this.inicializarCalendario(pergunta);
                    }, 300);
                };
                script.onerror = () => {
                    console.error("Falha ao carregar Flatpickr dinamicamente");
                };
                document.head.appendChild(script);
            } else {
                // Inicializar o calendário com um pequeno atraso para garantir que o DOM foi atualizado
                setTimeout(() => {
                    this.inicializarCalendario(pergunta);
                }, 300);
            }
        }
        
        // Configurar entrada numérica
        if (pergunta.number_input) {
            this.configurarEntradaNumerica();
        }
        
        // Configurar autocomplete
        if (pergunta.autocomplete) {
            this.configurarAutocomplete(pergunta);
        }
        
        // Configurar entrada de moeda
        if (pergunta.currency_format) {
            this.configurarEntradaMoeda();
        }
        
        // Configurar entrada de texto
        if (pergunta.input_field && !pergunta.calendar && !pergunta.number_input && !pergunta.autocomplete && !pergunta.currency_format) {
            this.configurarEntradaTexto();
        }
    },

    /**
     * Inicializa o calendário com Flatpickr
     */
    inicializarCalendario(pergunta) {
        console.log("Iniciando configuração do calendário");
        
        // Usar o ID armazenado no estado
        const calendarId = this.estado.currentCalendarId;
        
        if (!calendarId) {
            console.error("ID do calendário não encontrado no estado!");
            return;
        }
        
        console.log(`Buscando elemento do calendário com ID: ${calendarId}`);
        
        // Aguardar um momento para garantir que o DOM foi atualizado
        setTimeout(() => {
            const calendarElement = document.getElementById(calendarId);
            
            if (!calendarElement) {
                console.error(`Elemento do calendário com ID ${calendarId} não encontrado!`);
                return;
            }
            
            console.log("Elemento do calendário encontrado, configurando Flatpickr");
            
            // Verificar se Flatpickr está disponível
            if (typeof flatpickr === 'undefined') {
                console.error("Biblioteca Flatpickr não encontrada!");
                this.carregarFlatpickrDinamicamente(pergunta);
                return;
            }
            
            // Configurações do Flatpickr
            const config = {
                mode: "range",
                dateFormat: "Y-m-d",
                minDate: pergunta.calendar.min_date || "today",
                maxDate: pergunta.calendar.max_date,
                inline: true,
                showMonths: 1,
                locale: {
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
                },
                onChange: (selectedDates, dateStr) => {
                    // Atualizar campos de data
                    const dataIdaElement = document.getElementById(`data-ida-${calendarId}`);
                    const dataVoltaElement = document.getElementById(`data-volta-${calendarId}`);
                    const confirmarBtn = document.getElementById(`confirmar-datas-${calendarId}`);
                    
                    if (!dataIdaElement || !dataVoltaElement || !confirmarBtn) {
                        console.error("Elementos de data não encontrados!");
                        return;
                    }
                    
                    if (selectedDates.length === 0) {
                        dataIdaElement.textContent = "Selecione";
                        dataVoltaElement.textContent = "Selecione";
                        confirmarBtn.disabled = true;
                    } else if (selectedDates.length === 1) {
                        const dataFormatada = this.formatarDataVisivel(selectedDates[0]);
                        dataIdaElement.textContent = dataFormatada;
                        dataVoltaElement.textContent = "Selecione";
                        confirmarBtn.disabled = true;
                    } else if (selectedDates.length === 2) {
                        const dataIdaFormatada = this.formatarDataVisivel(selectedDates[0]);
                        const dataVoltaFormatada = this.formatarDataVisivel(selectedDates[1]);
                        dataIdaElement.textContent = dataIdaFormatada;
                        dataVoltaElement.textContent = dataVoltaFormatada;
                        confirmarBtn.disabled = false;
                    }
                }
            };
            
            // Inicializar Flatpickr
            try {
                const calendario = flatpickr(calendarElement, config);
                console.log("Flatpickr inicializado com sucesso");
                
                // Armazenar a instância no estado para referência futura
                this.estado.calendarioAtual = calendario;
                
                // Configurar botão de confirmação
                const confirmarBtn = document.getElementById(`confirmar-datas-${calendarId}`);
                if (confirmarBtn) {
                    confirmarBtn.addEventListener('click', () => {
                        const datas = calendario.selectedDates;
                        if (datas.length === 2) {
                            const dadosDatas = {
                                dataIda: datas[0].toISOString().split('T')[0],
                                dataVolta: datas[1].toISOString().split('T')[0]
                            };
                            this.processarResposta(dadosDatas, pergunta);
                        }
                    });
                    console.log("Eventos do botão de confirmação configurados");
                } else {
                    console.error(`Botão de confirmação com ID confirmar-datas-${calendarId} não encontrado`);
                }
            } catch (erro) {
                console.error("Erro ao inicializar Flatpickr:", erro);
            }
        }, 500); // Aumentado para 500ms para garantir que o DOM foi atualizado
    },

    /**
     * Carrega a biblioteca Flatpickr dinamicamente
     */
    carregarFlatpickrDinamicamente(pergunta) {
        console.log("Tentando carregar Flatpickr dinamicamente");
        
        // Verificar se já existe um script de carregamento
        if (document.querySelector('script[src*="flatpickr"]')) {
            console.log("Carregamento de Flatpickr já em andamento");
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js';
        script.onload = () => {
            console.log("Flatpickr carregado com sucesso");
            
            // Carregar estilos
            if (!document.querySelector('link[href*="flatpickr"]')) {
                const style = document.createElement('link');
                style.rel = 'stylesheet';
                style.href = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css';
                document.head.appendChild(style);
            }
            
            // Inicializar calendário após carregamento bem-sucedido
            setTimeout(() => {
                this.inicializarCalendario(pergunta);
            }, 300);
        };
        
        script.onerror = () => {
            console.error("Falha ao carregar Flatpickr dinamicamente");
            this.mostrarErro("Não foi possível carregar o componente de calendário. Recarregue a página e tente novamente.");
        };
        
        document.head.appendChild(script);
    },

    /**
     * Cria o elemento do calendário manualmente como último recurso
     */
    criarElementoCalendarioManualmente(pergunta) {
        console.log("Tentando criar elemento do calendário manualmente");
        
        // Verificar se a mensagem da pergunta está no DOM
        const mensagens = document.querySelectorAll('.chat-message.tripinha');
        if (mensagens.length === 0) {
            console.error("Nenhuma mensagem encontrada para adicionar o calendário");
            return;
        }
        
        // Pegar a última mensagem da Tripinha
        const ultimaMensagem = mensagens[mensagens.length - 1];
        const containerMensagem = ultimaMensagem.querySelector('.message');
        
        if (!containerMensagem) {
            console.error("Container de mensagem não encontrado");
            return;
        }
        
        // Verificar se já existe um container de calendário
        if (containerMensagem.querySelector('.calendar-container')) {
            console.log("Container de calendário já existe, recriando");
            containerMensagem.querySelector('.calendar-container').remove();
        }
        
        // Criar HTML do calendário
        const calendarHTML = `
            <div class="calendar-container">
                <div id="benetrip-calendar" class="flatpickr-calendar-container"></div>
                <div class="date-selection">
                    <p>Ida: <span id="data-ida">Selecione</span></p>
                    <p>Volta: <span id="data-volta">Selecione</span></p>
                </div>
                <button id="confirmar-datas" class="confirm-button" disabled>Confirmar Datas</button>
            </div>
        `;
        
        // Adicionar ao container da mensagem
        containerMensagem.insertAdjacentHTML('beforeend', calendarHTML);
        
        // Tentar inicializar novamente após criar o elemento
        setTimeout(() => {
            const calendarElement = document.getElementById('benetrip-calendar');
            if (calendarElement) {
                console.log("Elemento do calendário criado manualmente com sucesso");
                this.inicializarCalendario(pergunta);
            } else {
                console.error("Falha ao criar elemento do calendário manualmente");
            }
        }, 300);
    },

    /**
     * Formata a data para exibição amigável
     */
    formatarDataVisivel(data) {
        return data.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },
    
    /**
     * Configura a entrada numérica para quantidade de viajantes
     */
    configurarEntradaNumerica() {
        const inputId = this.estado.currentNumberInputId;
        const input = document.getElementById(inputId);
        
        if (!input) {
            console.error(`Input número com ID ${inputId} não encontrado`);
            return;
        }
        
        const decrementBtn = input.parentElement.querySelector('.decrement');
        const incrementBtn = input.parentElement.querySelector('.increment');
        const confirmBtn = input.parentElement.querySelector('.confirm-number');
        
        // Evento para o botão de decremento
        decrementBtn.addEventListener('click', () => {
            const valor = parseInt(input.value);
            if (valor > 1) {
                input.value = valor - 1;
            }
        });
        
        // Evento para o botão de incremento
        incrementBtn.addEventListener('click', () => {
            const valor = parseInt(input.value);
            if (valor < 20) {
                input.value = valor + 1;
            }
        });
        
        // Evento para o botão de confirmação
        confirmBtn.addEventListener('click', () => {
            const valor = parseInt(input.value);
            const pergunta = this.estado.perguntas[this.estado.perguntaAtual];
            this.processarResposta(valor, pergunta);
        });
    },

    /**
     * Configura o campo de autocomplete para cidades/destinos
     */
    configurarAutocomplete(pergunta) {
        const autocompleteId = this.estado.currentAutocompleteId;
        const input = document.getElementById(autocompleteId);
        
        if (!input) {
            console.error(`Input autocomplete com ID ${autocompleteId} não encontrado`);
            return;
        }
        
        const results = document.getElementById(`${autocompleteId}-results`);
        const confirmBtn = document.getElementById(`${autocompleteId}-confirm`);
        
        let selectedItem = null;
        
        // Função para buscar sugestões
        const buscarSugestoes = _.debounce(async (termo) => {
            if (!termo || termo.length < 2) {
                results.innerHTML = '';
                return;
            }
            
            try {
                // Se o serviço de API estiver disponível, usar para buscar cidades
                let sugestoes = [];
                if (window.BENETRIP_API && window.BENETRIP_API.buscarSugestoesCidade) {
                    sugestoes = await window.BENETRIP_API.buscarSugestoesCidade(termo);
                } else {
                    // Sugestões locais básicas para desenvolvimento
                    sugestoes = [
                        { type: "city", code: "SAO", name: "São Paulo", country_code: "BR", country_name: "Brasil" },
                        { type: "city", code: "RIO", name: "Rio de Janeiro", country_code: "BR", country_name: "Brasil" },
                        { type: "city", code: "NYC", name: "Nova York", country_code: "US", country_name: "Estados Unidos" },
                        { type: "city", code: "MIA", name: "Miami", country_code: "US", country_name: "Estados Unidos" }
                    ];
                }
                
                // Mostrar sugestões
                if (sugestoes.length > 0) {
                    results.innerHTML = sugestoes.map(item => {
                        return `
                            <div class="autocomplete-item" data-code="${item.code}" data-name="${item.name}" data-country="${item.country_name}">
                                <div class="item-code">${item.code}</div>
                                <div class="item-details">
                                    <div class="item-name">${item.name}</div>
                                    <div class="item-country">${item.country_name}</div>
                                </div>
                            </div>
                        `;
                    }).join('');
                    
                    // Adicionar eventos aos itens
                    document.querySelectorAll('.autocomplete-item').forEach(item => {
                        item.addEventListener('click', () => {
                            selectedItem = {
                                code: item.dataset.code,
                                name: item.dataset.name,
                                country: item.dataset.country
                            };
                            
                            // Atualizar campo de entrada
                            input.value = `${selectedItem.name} (${selectedItem.code})`;
                            
                            // Limpar resultados
                            results.innerHTML = '';
                            
                            // Habilitar botão de confirmação
                            confirmBtn.disabled = false;
                        });
                    });
                } else {
                    results.innerHTML = '<div class="no-results">Nenhum resultado encontrado</div>';
                }
            } catch (error) {
                console.error("Erro ao buscar sugestões:", error);
                results.innerHTML = '<div class="error">Erro ao buscar sugestões</div>';
            }
        }, 300);
        
        // Evento para o campo de entrada
        input.addEventListener('input', (e) => {
            const termo = e.target.value;
            buscarSugestoes(termo);
            
            // Desabilitar botão se limpar o campo
            if (!termo) {
                confirmBtn.disabled = true;
                selectedItem = null;
            }
        });
        
        // Evento para o botão de confirmação
        confirmBtn.addEventListener('click', () => {
            if (selectedItem) {
                this.processarResposta(selectedItem, pergunta);
            }
        });
        
        // Foco automático no input
        setTimeout(() => input.focus(), 300);
    },

    /**
     * Configura a entrada de valor monetário
     */
    configurarEntradaMoeda() {
        const currencyId = this.estado.currentCurrencyId;
        const input = document.getElementById(currencyId);
        
        if (!input) {
            console.error(`Input de moeda com ID ${currencyId} não encontrado`);
            return;
        }
        
        const confirmBtn = document.getElementById(`${currencyId}-confirm`);
        
        // Inicializar com valor vazio
        input.value = '';
        confirmBtn.disabled = true;
        
        // Formatar entrada como moeda
        input.addEventListener('input', (e) => {
            // Remover tudo exceto números
            let valor = e.target.value.replace(/\D/g, '');
            
            // Verificar se o valor não está vazio
            if (valor) {
                // Converter para formato decimal (dividir por 100)
                valor = (parseInt(valor) / 100).toFixed(2);
                
                // Formatar com separador decimal
                e.target.value = valor.replace('.', ',');
                
                // Habilitar botão se tiver valor
                confirmBtn.disabled = parseFloat(valor) <= 0;
            } else {
                e.target.value = '';
                confirmBtn.disabled = true;
            }
        });
        
        // Evento para o botão de confirmação
        confirmBtn.addEventListener('click', () => {
            const valor = parseFloat(input.value.replace(',', '.'));
            if (valor > 0) {
                const pergunta = this.estado.perguntas[this.estado.perguntaAtual];
                this.processarResposta(valor, pergunta);
            }
        });
        
        // Foco automático no input
        setTimeout(() => input.focus(), 300);
    },
