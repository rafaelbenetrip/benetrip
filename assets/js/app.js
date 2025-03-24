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
        setTimeout(() => this.mostrarProximaPergunta(), this.config.animationDelay);
    },

    /**
     * Mostra a próxima pergunta no chat
     */
    mostrarProximaPergunta() {
        // Verificar se ainda há perguntas
        if (this.estado.perguntaAtual >= this.estado.perguntas.length) {
            this.finalizarQuestionario();
            return;
        }
        
        const pergunta = this.estado.perguntas[this.estado.perguntaAtual];
        
        // Verificar se devemos mostrar esta pergunta (baseado em condicionais)
        if (!this.deveExibirPergunta(pergunta)) {
            // Pular para a próxima pergunta
            this.estado.perguntaAtual++;
            this.mostrarProximaPergunta();
            return;
        }
        
        // Mostrar Tripinha pensando
        this.mostrarTripinhaPensando()
            .then(() => {
                // Montar a mensagem da pergunta
                const mensagemHTML = this.montarHTMLPergunta(pergunta);
                
                // Adicionar ao chat
                const chatMessages = document.getElementById('chat-messages');
                chatMessages.insertAdjacentHTML('beforeend', mensagemHTML);
                
                // Configurar manipuladores de eventos específicos para o tipo de pergunta
                this.configurarEventosPergunta(pergunta);
                
                // Rolar para a última mensagem
                this.rolarParaFinal();
            });
    },

    /**
     * Verifica se uma pergunta deve ser exibida com base em condicionais
     */
    deveExibirPergunta(pergunta) {
        // Se não tiver condicionais, sempre exibir
        if (!pergunta.conditional) return true;
        
        // Verificar fluxo conhece_destino
        if (pergunta.conditional.depends_on === 'conhece_destino') {
            // A primeira resposta define o fluxo
            if (this.estado.fluxo === null && this.estado.respostas.conhece_destino !== undefined) {
                this.estado.fluxo = this.estado.respostas.conhece_destino === 0 ? 'destino_conhecido' : 'destino_desconhecido';
            }
            
            // Verificar se a pergunta pertence ao fluxo atual
            const valorEsperado = pergunta.conditional.show_if_value;
            return this.estado.respostas.conhece_destino === valorEsperado;
        }
        
        // Verificar outras condicionais (quantidade de pessoas, etc)
        const dependeDe = pergunta.conditional.depends_on;
        const valorEsperado = pergunta.conditional.show_if_value;
        
        return this.estado.respostas[dependeDe] === valorEsperado;
    },

    /**
     * Mostra a Tripinha "pensando" (animação de espera)
     */
    async mostrarTripinhaPensando() {
        return new Promise(resolve => {
            const mensagemPensando = `
                <div class="chat-message tripinha pensando">
                    <div class="avatar">
                        <img src="${this.config.imagePath}tripinha/avatar-pensando.png" alt="Tripinha pensando" />
                    </div>
                    <div class="message">
                        <div class="thinking-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                </div>
            `;
            
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.insertAdjacentHTML('beforeend', mensagemPensando);
            
            this.rolarParaFinal();
            
            // Simular o tempo de "pensamento"
            setTimeout(() => {
                // Remover a mensagem de pensamento
                const pensandoEl = chatMessages.querySelector('.pensando');
                if (pensandoEl) {
                    pensandoEl.remove();
                }
                resolve();
            }, 800);
        });
    },

    /**
     * Monta o HTML para exibir uma pergunta no chat
     */
    montarHTMLPergunta(pergunta) {
        let opcoesHTML = '';
        
        // Construir opções com base no tipo da pergunta
        if (pergunta.options) {
            // Pergunta de múltipla escolha
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
            // Campo de entrada de texto
            if (pergunta.calendar) {
                // Calendário
                opcoesHTML = `
                    <div class="calendar-container">
                        <div id="inline-calendar"></div>
                        <div class="date-selection">
                            <p>Ida: <span id="date-start">Selecione</span></p>
                            <p>Volta: <span id="date-end">Selecione</span></p>
                        </div>
                        <button id="confirm-dates" class="confirm-button" disabled>Confirmar Datas</button>
                    </div>
                `;
            } else if (pergunta.number_input) {
                // Entrada numérica
                opcoesHTML = `
                    <div class="number-input-container">
                        <button class="decrement">-</button>
                        <input type="number" min="1" max="20" value="1" id="number-input">
                        <button class="increment">+</button>
                        <button class="confirm-number">Confirmar</button>
                    </div>
                `;
            } else if (pergunta.autocomplete) {
                // Campo com autocomplete
                opcoesHTML = `
                    <div class="autocomplete-container">
                        <input type="text" class="autocomplete-input" placeholder="${pergunta.description}">
                        <div class="autocomplete-results"></div>
                        <button class="confirm-autocomplete" disabled>Confirmar</button>
                    </div>
                `;
            } else if (pergunta.currency_format) {
                // Campo para valor monetário
                opcoesHTML = `
                    <div class="currency-input-container">
                        <input type="text" class="currency-input" placeholder="0,00">
                        <button class="confirm-currency" disabled>Confirmar</button>
                    </div>
                `;
            } else {
                // Campo de texto simples
                opcoesHTML = `
                    <div class="text-input-container">
                        <input type="text" class="text-input" placeholder="${pergunta.description}">
                        <button class="confirm-text" disabled>Confirmar</button>
                    </div>
                `;
            }
        }
        
        // Construir a mensagem completa
        return `
            <div class="chat-message tripinha">
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
            this.configurarCalendario(pergunta);
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
 * Configura o calendário para seleção de datas
 */
configurarCalendario(pergunta) {
    console.log("Iniciando configuração do calendário");
    
    // Verificar se o calendário foi carregado no DOM
    const checkCalendarElement = setInterval(() => {
        const calendarElement = document.getElementById('inline-calendar');
        if (calendarElement) {
            console.log("Elemento do calendário encontrado");
            clearInterval(checkCalendarElement);
            
            // Elementos do calendário
            const dateStart = document.getElementById('date-start');
            const dateEnd = document.getElementById('date-end');
            const confirmButton = document.getElementById('confirm-dates');
            
            // Data mínima e máxima
            const today = new Date();
            const minDate = pergunta.calendar.min_date || today;
            const maxDate = pergunta.calendar.max_date || new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
            
            // Inicializar Flatpickr diretamente, sem verificar window.flatpickr
            try {
                const calendar = flatpickr(calendarElement, {
                    inline: true,
                    mode: "range",
                    minDate: minDate,
                    maxDate: maxDate,
                    dateFormat: "Y-m-d",
                    defaultDate: [today, new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)], // Hoje e uma semana depois
                    onChange: function(selectedDates, dateStr) {
                        if (selectedDates.length === 2) {
                            // Atualizar exibição das datas
                            const dataFormatada = (data) => {
                                return data.toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                });
                            };
                            
                            dateStart.textContent = dataFormatada(selectedDates[0]);
                            dateEnd.textContent = dataFormatada(selectedDates[1]);
                            
                            // Habilitar botão de confirmação
                            confirmButton.disabled = false;
                        }
                    }
                });
                
                console.log("Calendário inicializado com sucesso:", calendar);
                
                // Evento para o botão de confirmação
                confirmButton.addEventListener('click', () => {
                    const datas = calendar.selectedDates.map(data => {
                        return data.toISOString().split('T')[0]; // Formato YYYY-MM-DD
                    });
                    
                    // Verificar se temos duas datas
                    if (datas.length === 2) {
                        const valor = {
                            dataIda: datas[0],
                            dataVolta: datas[1]
                        };
                        this.processarResposta(valor, pergunta);
                    }
                });
            } catch (error) {
                console.error("Erro ao inicializar calendário:", error);
                
                // Fallback simples se a biblioteca não estiver disponível
                confirmButton.disabled = false;
                confirmButton.addEventListener('click', () => {
                    const hoje = new Date();
                    const amanha = new Date(hoje);
                    amanha.setDate(amanha.getDate() + 7);
                    
                    const formatarData = (data) => {
                        const ano = data.getFullYear();
                        const mes = String(data.getMonth() + 1).padStart(2, '0');
                        const dia = String(data.getDate()).padStart(2, '0');
                        return `${ano}-${mes}-${dia}`;
                    };
                    
                    const valor = {
                        dataIda: formatarData(hoje),
                        dataVolta: formatarData(amanha)
                    };
                    
                    // Atualizar texto dos elementos de data
                    if (dateStart) dateStart.textContent = hoje.toLocaleDateString('pt-BR');
                    if (dateEnd) dateEnd.textContent = amanha.toLocaleDateString('pt-BR');
                    
                    this.processarResposta(valor, pergunta);
                });
            }
        }
    }, 300); // Verifica a cada 300ms
}    
    /**
     * Configura a entrada numérica para quantidade de viajantes
     */
    configurarEntradaNumerica() {
        const input = document.getElementById('number-input');
        const decrementBtn = document.querySelector('.decrement');
        const incrementBtn = document.querySelector('.increment');
        const confirmBtn = document.querySelector('.confirm-number');
        
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
        const input = document.querySelector('.autocomplete-input');
        const results = document.querySelector('.autocomplete-results');
        const confirmBtn = document.querySelector('.confirm-autocomplete');
        
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
                if (window.BENETRIP_API) {
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
    },

    /**
 * Configura a entrada de valor monetário
 */
configurarEntradaMoeda() {
    // Verificar se o input está presente no DOM
    const checkInput = setInterval(() => {
        const input = document.querySelector('.currency-input');
        if (input) {
            clearInterval(checkInput);
            
            const confirmBtn = document.querySelector('.confirm-currency');
            
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
            
            console.log("Campo de moeda inicializado com sucesso");
        }
    }, 100); // Verifica a cada 100ms se o elemento foi criado
},
    
    /**
     * Configura a entrada de texto simples
     */
    configurarEntradaTexto() {
        const input = document.querySelector('.text-input');
        const confirmBtn = document.querySelector('.confirm-text');
        
        // Evento para o campo de entrada
        input.addEventListener('input', (e) => {
            const texto = e.target.value.trim();
            confirmBtn.disabled = texto.length === 0;
        });
        
        // Evento para o botão de confirmação
        confirmBtn.addEventListener('click', () => {
            const texto = input.value.trim();
            if (texto.length > 0) {
                const pergunta = this.estado.perguntas[this.estado.perguntaAtual];
                this.processarResposta(texto, pergunta);
            }
        });
    },

    /**
     * Processa a resposta do usuário a uma pergunta
     */
    processarResposta(valor, pergunta) {
        // Armazenar resposta
        this.estado.respostas[pergunta.key] = valor;
        
        // Mostrar resposta do usuário no chat
        this.mostrarRespostaUsuario(valor, pergunta);
        
        // Se for a primeira pergunta (conhece_destino), definir o fluxo
        if (pergunta.key === 'conhece_destino') {
            this.estado.fluxo = valor === 0 ? 'destino_conhecido' : 'destino_desconhecido';
        }
        
        // Avançar para a próxima pergunta
        this.estado.perguntaAtual++;
        
        // Verificar se atingimos o limite de perguntas para este fluxo
        if (this.verificarLimitePerguntas()) {
            this.finalizarQuestionario();
            return;
        }
        
        // Mostrar próxima pergunta
        setTimeout(() => this.mostrarProximaPergunta(), this.config.animationDelay);
    },

    /**
     * Verifica se atingimos o limite de perguntas para este fluxo
     */
    verificarLimitePerguntas() {
    // Desativar verificação de limite para garantir que todas as perguntas sejam exibidas
    return false; // Sempre retorna falso para não finalizar prematuramente
}

    /**
     * Mostra a resposta do usuário no chat
     */
    mostrarRespostaUsuario(valor, pergunta) {
        let mensagemResposta = '';
        
        // Formatar a resposta com base no tipo de pergunta
        if (pergunta.options) {
            // Resposta de múltipla escolha
            mensagemResposta = pergunta.options[valor];
        } else if (pergunta.calendar) {
            // Resposta de calendário
            const formatarData = (data) => {
                const dataObj = new Date(data);
                return dataObj.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            };
            
            mensagemResposta = `Ida: ${formatarData(valor.dataIda)} | Volta: ${formatarData(valor.dataVolta)}`;
        } else if (pergunta.autocomplete) {
            // Resposta de autocomplete
            mensagemResposta = `${valor.name} (${valor.code}), ${valor.country}`;
        } else {
            // Outros tipos de resposta
            mensagemResposta = valor.toString();
        }
        
        // Criar elemento da mensagem
        const mensagemHTML = `
            <div class="chat-message user">
                <div class="message">
                    <p>${mensagemResposta}</p>
                </div>
            </div>
        `;
        
        // Adicionar ao chat
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.insertAdjacentHTML('beforeend', mensagemHTML);
        
        // Rolar para a última mensagem
        this.rolarParaFinal();
    },

    /**
     * Finaliza o questionário e passa para a próxima etapa
     */
    finalizarQuestionario() {
        // Salvar dados do usuário
        this.salvarDadosUsuario();
        
        // Mostrar mensagem de finalização
        this.mostrarMensagemFinalizacao()
            .then(() => {
                // Determinar próxima etapa com base no fluxo
                if (this.estado.fluxo === 'destino_conhecido') {
                    // Se já sabe o destino, ir direto para busca de voos
                    this.buscarVoos();
                } else {
                    // Se não sabe o destino, mostrar recomendações
                    this.buscarRecomendacoes();
                }
            });
    },

    /**
     * Mostra mensagem de finalização do questionário
     */
    async mostrarMensagemFinalizacao() {
        // Mostrar Tripinha pensando
        await this.mostrarTripinhaPensando();
        
        // Texto da mensagem
        let textoMensagem = '';
        
        if (this.estado.fluxo === 'destino_conhecido') {
            const destino = this.estado.respostas.destino_conhecido;
            textoMensagem = `Ótimo! Vou buscar as melhores opções de voos para ${destino.name} para você! 🧳✈️`;
        } else {
            textoMensagem = `Perfeito! Com suas preferências, já sei quais destinos vão te encantar! Vou preparar algumas sugestões especiais para você! 🐾🗺️`;
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
        chatMessages.insertAdjacentHTML('beforeend', mensagemHTML);
        
        // Rolar para a última mensagem
        this.rolarParaFinal();
        
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
     * Configura eventos para atualização da barra de progresso
     */
    configurarEventosProgresso() {
        // Registrar manipulador para eventos de progresso
        window.addEventListener('benetrip_progress', (event) => {
            const { progress, message } = event.detail;
            this.atualizarBarraProgresso(progress, message);
        });
    },

    /**
     * Atualiza a barra de progresso
     */
    atualizarBarraProgresso(porcentagem, mensagem) {
        const progressBar = document.querySelector('.progress-bar');
        const progressText = document.querySelector('.progress-text');
        
        if (progressBar && progressText) {
            progressBar.style.width = `${porcentagem}%`;
            progressText.textContent = mensagem || 'Processando...';
            
            // Se o progresso for 100%, preparar para transição
            if (porcentagem >= 100) {
                setTimeout(() => {
                    // Adicionar classe para animar saída
                    document.querySelectorAll('.progress-container').forEach(el => {
                        el.classList.add('completed');
                    });
                }, 500);
            }
        }
    },

    /**
     * Busca recomendações de destinos com base nas preferências do usuário
     */
    buscarRecomendacoes() {
        // Verificar se o serviço de IA está disponível
        if (!window.BENETRIP_AI) {
            console.error("Serviço de IA não disponível");
            this.atualizarBarraProgresso(100, "Erro ao buscar recomendações. Redirecionando...");
            
            // Redirecionar para página de destinos após delay
            setTimeout(() => {
                window.location.href = 'destinos.html';
            }, 2000);
            return;
        }
        
        // Chamar serviço de IA para recomendações
        window.BENETRIP_AI.obterRecomendacoes(this.estado.respostas)
            .then(recomendacoes => {
                // Salvar recomendações
                localStorage.setItem('benetrip_recomendacoes', JSON.stringify(recomendacoes));
                
                // Mostrar mensagem de conclusão
                this.atualizarBarraProgresso(100, "Destinos encontrados! Redirecionando...");
                
                // Redirecionar para página de destinos após delay
                setTimeout(() => {
                    window.location.href = 'destinos.html';
                }, 2000);
            })
            .catch(erro => {
                console.error("Erro ao obter recomendações:", erro);
                this.atualizarBarraProgresso(100, "Erro ao buscar recomendações. Redirecionando...");
                
                // Redirecionar para página de destinos após delay
                setTimeout(() => {
                    window.location.href = 'destinos.html';
                }, 2000);
            });
    },

    /**
     * Busca voos para o destino escolhido pelo usuário
     */
    buscarVoos() {
        // Verificar se o serviço de API está disponível
        if (!window.BENETRIP_API) {
            console.error("Serviço de API não disponível");
            this.atualizarBarraProgresso(100, "Erro ao buscar voos. Redirecionando...");
            
            // Redirecionar para página de voos após delay
            setTimeout(() => {
                window.location.href = 'flights.html';
            }, 2000);
            return;
        }
        
        // Preparar parâmetros para busca de voos
        const destino = this.estado.respostas.destino_conhecido;
        const origem = this.estado.respostas.cidade_partida;
        const datas = this.estado.respostas.datas;
        
        const params = {
            origem: origem.code,
            destino: destino.code,
            dataIda: datas.dataIda,
            dataVolta: datas.dataVolta,
            adultos: this.getNumeroAdultos()
        };
        
        // Chamar serviço de API para busca de voos
        window.BENETRIP_API.buscarVoos(params)
            .then(resultados => {
                // Salvar resultados
                localStorage.setItem('benetrip_resultados_voos', JSON.stringify(resultados));
                
                // Mostrar mensagem de conclusão
                this.atualizarBarraProgresso(100, "Voos encontrados! Redirecionando...");
                
                // Redirecionar para página de voos após delay
                setTimeout(() => {
                    window.location.href = 'flights.html';
                }, 2000);
            })
            .catch(erro => {
                console.error("Erro ao buscar voos:", erro);
                this.atualizarBarraProgresso(100, "Erro ao buscar voos. Redirecionando...");
                
                // Redirecionar para página de voos após delay
                setTimeout(() => {
                    window.location.href = 'flights.html';
                }, 2000);
            });
    },

    /**
     * Obtém o número total de adultos com base nas respostas
     */
    getNumeroAdultos() {
        if (this.estado.respostas.companhia === 0) {
            // Viajando sozinho
            return 1;
        } else if (this.estado.respostas.companhia === 1) {
            // Viajando em casal
            return 2;
        } else if (this.estado.respostas.companhia === 2) {
            // Viajando em família
            return this.estado.respostas.quantidade_familia || 2;
        } else if (this.estado.respostas.companhia === 3) {
            // Viajando com amigos
            return this.estado.respostas.quantidade_amigos || 2;
        }
        
        // Valor padrão
        return 1;
    },

    /**
     * Salva os dados do usuário no localStorage
     */
    salvarDadosUsuario() {
        localStorage.setItem('benetrip_user_data', JSON.stringify({
            respostas: this.estado.respostas,
            fluxo: this.estado.fluxo,
            timestamp: Date.now()
        }));
    },

    /**
     * Verifica se existem dados salvos de uma sessão anterior
     */
    verificarDadosSalvos() {
        const dadosSalvos = localStorage.getItem('benetrip_user_data');
        
        if (dadosSalvos) {
            try {
                const dados = JSON.parse(dadosSalvos);
                
                // Verificar se os dados ainda são válidos (menos de 24 horas)
                const agora = Date.now();
                const dataGravacao = dados.timestamp || 0;
                
                const horasDecorridas = (agora - dataGravacao) / (1000 * 60 * 60);
                
                if (horasDecorridas < 24) {
                    // Dados ainda são válidos
                    console.log("Dados de usuário carregados do localStorage");
                    
                    if (this.config.debugMode) {
                        console.log("Dados carregados:", dados);
                    }
                }
            } catch (erro) {
                console.error("Erro ao carregar dados salvos:", erro);
            }
        }
    },

    /**
     * Inicializa a tela de destinos
     */
    iniciarTelaDestinos() {
        // Carregar dados salvos
        const dadosUsuario = localStorage.getItem('benetrip_user_data');
        const recomendacoes = localStorage.getItem('benetrip_recomendacoes');
        
        if (!dadosUsuario || !recomendacoes) {
            // Redirecionar para a página inicial se não tiver dados
            window.location.href = 'index.html';
            return;
        }
        
        // Renderizar destinos recomendados
        this.renderizarDestinos(JSON.parse(recomendacoes));
    },

    /**
     * Renderiza os destinos recomendados na tela
     */
    renderizarDestinos(recomendacoes) {
        // Implementação a ser completada
        console.log("Renderizando destinos:", recomendacoes);
        
        // O código para renderizar destinos será implementado na próxima fase
    },

    /**
     * Inicializa a tela de voos
     */
    iniciarTelaVoos() {
        // Carregar dados salvos
        const dadosUsuario = localStorage.getItem('benetrip_user_data');
        const resultadosVoos = localStorage.getItem('benetrip_resultados_voos');
        
        if (!dadosUsuario || !resultadosVoos) {
            // Redirecionar para a página inicial se não tiver dados
            window.location.href = 'index.html';
            return;
        }
        
        // Renderizar voos
        this.renderizarVoos(JSON.parse(resultadosVoos));
    },

    /**
     * Renderiza os voos encontrados na tela
     */
    renderizarVoos(resultados) {
        // Implementação a ser completada
        console.log("Renderizando voos:", resultados);
        
        // O código para renderizar voos será implementado na próxima fase
    },

    /**
     * Mostrar indicador de carregamento
     */
    mostrarCarregando(estado) {
        this.estado.carregando = estado;
        
        const loadingElement = document.getElementById('loading-indicator');
        if (loadingElement) {
            loadingElement.style.display = estado ? 'flex' : 'none';
        }
    },

    /**
     * Mostrar mensagem de erro
     */
    mostrarErro(mensagem) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = mensagem;
        
        document.body.appendChild(errorElement);
        
        setTimeout(() => {
            errorElement.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            errorElement.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(errorElement);
            }, 300);
        }, 3000);
    },

    /**
     * Rolar o chat para a última mensagem
     */
    rolarParaFinal() {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },

    /**
     * Registrar manipuladores de eventos globais
     */
    registrarEventos() {
        // Manipulador para o evento DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => {
            // Inicializar componentes específicos da página
            if (document.getElementById('chat-container')) {
                this.iniciarChat();
            }
        });
        
        // Outros eventos globais podem ser registrados aqui
    }
};

// Inicializar a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    BENETRIP.init();
});

// Exportar a aplicação para o namespace global
window.BENETRIP = BENETRIP;
