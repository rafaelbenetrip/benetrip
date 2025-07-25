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
        carregando: false,
        currentCalendarId: null, // Armazena o ID do calendário atual
        calendarioAtual: null    // Armazena a instância do calendário
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
        
        // ADICIONADO: Botão de segurança para a última pergunta do fluxo de destino conhecido
        if (this.estado.fluxo === 'destino_conhecido' && pergunta.key === 'datas') {
            setTimeout(() => {
                // Verificar se o elemento container de mensagens ainda existe
                const chatMessages = document.getElementById('chat-messages');
                if (!chatMessages) return;
                
                // Criar container para o botão
                const btnContainer = document.createElement('div');
                btnContainer.className = 'action-button-container';
                btnContainer.style.marginTop = '20px';
                
                // Criar o botão
                const btnBuscarVoos = document.createElement('button');
                btnBuscarVoos.textContent = 'Buscar Voos ✈️';
                btnBuscarVoos.className = 'action-button-large';
                btnBuscarVoos.onclick = () => {
                    if (this.estado.respostas.datas) {
                        this.finalizarQuestionario();
                    } else {
                        this.exibirToast('Por favor, selecione as datas da viagem primeiro.');
                    }
                };
                
                // Adicionar botão ao container e container à mensagem
                btnContainer.appendChild(btnBuscarVoos);
                chatMessages.appendChild(btnContainer);
            }, 2000);
        }
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

        if (pergunta.options) {
            opcoesHTML = `
                <div class="options-container">
                    ${pergunta.options.map((opcao, index) => `
                        <button class="option-button" data-index="${index}" data-valor="${index}">
                            ${opcao}
                        </button>`).join('')}
                </div>
            `;
        } else if (pergunta.input_field) {
            if (pergunta.calendar) {
                if (!this.estado.currentCalendarId) {
                    this.estado.currentCalendarId = `benetrip-calendar-${Date.now()}`;
                }
                const calendarId = this.estado.currentCalendarId;

                console.log(`Gerando HTML do calendário com ID: ${calendarId}`);

                opcoesHTML = `
                    <div class="calendar-container" data-calendar-container="${calendarId}">
                        <div id="${calendarId}" class="flatpickr-calendar-container"></div>
                        <div class="date-selection">
                            <p>Ida: <span id="data-ida-${calendarId}">Selecione</span></p>
                            <p>Volta: <span id="data-volta-${calendarId}">Selecione</span></p>
                        </div>
                        <button id="confirmar-datas-${calendarId}" class="confirm-button confirm-dates" disabled>Confirmar Datas</button>
                    </div>
                `;
            } else if (pergunta.number_input) {
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
                const currencyId = `currency-input-${Date.now()}`;
                this.estado.currentCurrencyId = currencyId;

                opcoesHTML = `
                    <div class="currency-input-container">
                        <input type="text" id="${currencyId}" class="currency-input" placeholder="0,00">
                        <button id="${currencyId}-confirm" class="confirm-currency" disabled>Confirmar</button>
                    </div>
                `;
            } else {
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

            // Garantir que temos um ID de calendário válido
            if (!this.estado.currentCalendarId) {
                this.estado.currentCalendarId = `benetrip-calendar-${Date.now()}`;
                console.log(`Criado novo ID de calendário: ${this.estado.currentCalendarId}`);
            }

            // Verificar se carregou a biblioteca Flatpickr
            if (typeof flatpickr === 'undefined') {
                console.error("Biblioteca Flatpickr não encontrada. Tentando carregar dinamicamente...");
                this.carregarFlatpickrDinamicamente(pergunta);
            } else {
                // Salvar o ID do calendário em uma variável local
                const calendarId = this.estado.currentCalendarId;
                console.log(`Usando ID do calendário: ${calendarId} para inicialização`);

                // Inicializar o calendário com um pequeno atraso para garantir que o DOM foi atualizado
                setTimeout(() => {
                    // Verificar novamente o ID dentro do setTimeout para garantir
                    if (!this.estado.currentCalendarId) {
                        this.estado.currentCalendarId = calendarId;
                        console.log(`Restaurado ID do calendário: ${calendarId}`);
                    }
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
     * Inicializa o calendário com Flatpickr - Versão corrigida
     */
    inicializarCalendario(pergunta) {
    console.log("Iniciando configuração do calendário com proteção de duplicação");

    // Verificar se o calendário já foi inicializado para evitar duplicação
    if (this.estado.calendarioAtual) {
        console.log("Calendário já inicializado, ignorando chamada duplicada");
        return;
    }
    
    // Usar um ID fixo para evitar problemas com múltiplas inicializações
    this.estado.currentCalendarId = 'benetrip-calendar-principal';
    
    // Verificar se já temos um elemento de calendário no DOM
    const existingContainer = document.querySelector('.calendar-container');
    if (existingContainer) {
        // Atualizar todos os IDs relacionados ao calendário para corresponder ao fixo
        const calendarElement = existingContainer.querySelector('.flatpickr-calendar-container');
        if (calendarElement) {
            calendarElement.id = this.estado.currentCalendarId;
            
            // Atualizar também os IDs dos campos de data e botão
            const dataIdaElement = existingContainer.querySelector('.date-selection p:first-child span');
            const dataVoltaElement = existingContainer.querySelector('.date-selection p:last-child span');
            const confirmarBtn = existingContainer.querySelector('.confirm-button');
            
            if (dataIdaElement) dataIdaElement.id = `data-ida-${this.estado.currentCalendarId}`;
            if (dataVoltaElement) dataVoltaElement.id = `data-volta-${this.estado.currentCalendarId}`;
            if (confirmarBtn) confirmarBtn.id = `confirmar-datas-${this.estado.currentCalendarId}`;
            
            console.log(`Elementos do calendário atualizados com ID fixo: ${this.estado.currentCalendarId}`);
        }
    } else {
        console.warn("Container de calendário não encontrado, será criado manualmente");
        this.criarElementoCalendarioManualmente(pergunta);
        return;
    }

    // Linha problemática corrigida - Indentação ajustada
    const calendarId = this.estado.currentCalendarId;
    console.log(`Buscando elemento do calendário com ID: ${calendarId}`);

    setTimeout(() => {
        const calendarElement = document.getElementById(calendarId);

        if (!calendarElement) {
            console.log(`Iniciando criação manual do calendário para ID ${calendarId}`);
            this.criarElementoCalendarioManualmente(pergunta);
            return;
        }

        console.log("Elemento do calendário encontrado, configurando Flatpickr");

        if (typeof flatpickr === 'undefined') {
            console.error("Biblioteca Flatpickr não encontrada!");
            this.carregarFlatpickrDinamicamente(pergunta);
            return;
        }

        // Calcular a data de amanhã para definir como data mínima
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        amanha.setHours(0, 0, 0, 0);

        const config = {
            mode: "range",
            dateFormat: "Y-m-d",
            // Definição mais forte da data mínima, convertendo para string no formato YYYY-MM-DD
            minDate: pergunta.calendar?.min_date || this.formatarDataISO(amanha),
            maxDate: pergunta.calendar?.max_date,
            inline: true,
            showMonths: 1,
            disable: [
                function(date) {
                    // Desabilitar datas anteriores a amanhã
                    const amanha = new Date();
                    amanha.setDate(amanha.getDate() + 1);
                    amanha.setHours(0, 0, 0, 0);
                    return date < amanha;
                }
            ],
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

        try {
            const calendario = flatpickr(calendarElement, config);
            console.log("Flatpickr inicializado com sucesso");

            this.estado.calendarioAtual = calendario;

            // Ocultar o contêiner original de forma mais agressiva
            calendarElement.style.display = 'none';
            calendarElement.style.height = '0';
            calendarElement.style.width = '0';
            calendarElement.style.overflow = 'hidden';
            calendarElement.style.margin = '0';
            calendarElement.style.padding = '0';

            // Ajustar o container pai
            const containerElement = calendarElement.closest('.calendar-container');
            if (containerElement) {
                containerElement.classList.add('only-flatpickr');

                // Remover qualquer espaçamento extra no container
                const originalContainer = containerElement.querySelector('.flatpickr-calendar-container');
                if (originalContainer && originalContainer !== calendarElement) {
                    originalContainer.style.display = 'none';
                    originalContainer.style.height = '0';
                }

                const confirmarBtn = document.getElementById(`confirmar-datas-${calendarId}`);
                if (confirmarBtn) {
                    confirmarBtn.addEventListener('click', () => {
    try {
        const datas = calendario.selectedDates;
        if (datas.length === 2) {
            // Método super simplificado que evita manipulações complexas de data
            // Extrair componentes da data diretamente dos objetos Date
            const dataIda = {
                dia: datas[0].getDate(),
                mes: datas[0].getMonth() + 1,
                ano: datas[0].getFullYear()
            };
            
            const dataVolta = {
                dia: datas[1].getDate(),
                mes: datas[1].getMonth() + 1,
                ano: datas[1].getFullYear()
            };
            
            // Criar strings de data no formato YYYY-MM-DD manualmente
            const dataIdaStr = `${dataIda.ano}-${String(dataIda.mes).padStart(2, '0')}-${String(dataIda.dia).padStart(2, '0')}`;
            const dataVoltaStr = `${dataVolta.ano}-${String(dataVolta.mes).padStart(2, '0')}-${String(dataVolta.dia).padStart(2, '0')}`;
            
            // Criar objeto de dados com as strings formatadas
            const dadosDatas = {
                dataIda: dataIdaStr,
                dataVolta: dataVoltaStr
            };
            
            // Log simplificado
            console.log("Datas processadas:", dadosDatas);
            
            // Processar resposta
            this.processarResposta(dadosDatas, pergunta);
        }
    } catch (erro) {
        console.error("Erro ao processar datas:", erro);
        this.mostrarErro("Houve um problema ao processar as datas. Por favor, selecione novamente.");
    }
});
                    console.log("Eventos do botão de confirmação configurados");
                } else {
                    console.error(`Botão de confirmação com ID confirmar-datas-${calendarId} não encontrado`);
                }
            }
        } catch (erro) {
            console.error("Erro ao inicializar Flatpickr:", erro);
        }
    }, 500);
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
        
        // Gerar ID único para o novo calendário
        const calendarId = `benetrip-calendar-${Date.now()}`;
        this.estado.currentCalendarId = calendarId;
        
        // Criar HTML do calendário
        const calendarHTML = `
            <div class="calendar-container" data-calendar-container="${calendarId}">
                <div id="${calendarId}" class="flatpickr-calendar-container"></div>
                <div class="date-selection">
                    <p>Ida: <span id="data-ida-${calendarId}">Selecione</span></p>
                    <p>Volta: <span id="data-volta-${calendarId}">Selecione</span></p>
                </div>
                <button id="confirmar-datas-${calendarId}" class="confirm-button confirm-dates" disabled>Confirmar Datas</button>
            </div>
        `;
        
        // Adicionar ao container da mensagem
        containerMensagem.insertAdjacentHTML('beforeend', calendarHTML);
        
        // Tentar inicializar novamente após criar o elemento
        setTimeout(() => {
            const calendarElement = document.getElementById(calendarId);
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
     * Formata a data para o formato ISO (YYYY-MM-DD) corrigindo o problema de timezone
     */
    formatarDataISO(data) {
    if (!data) return '';
    
    try {
        // Se for já um formato ISO (YYYY-MM-DD), retornamos diretamente
        if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
            return data;
        }
        
        // Verificar se o parâmetro é uma string e convertê-lo para objeto Date
        let dataObj = data;
        if (typeof data === 'string') {
            // Tentar extrair componentes de data no formato YYYY-MM-DD
            const partes = data.split('-');
            if (partes.length === 3) {
                const ano = parseInt(partes[0]);
                const mes = parseInt(partes[1]) - 1; // Mês em JS começa em 0
                const dia = parseInt(partes[2]);
                dataObj = new Date(ano, mes, dia, 12, 0, 0); // Definir para meio-dia para evitar problemas de fuso
            } else {
                dataObj = new Date(data);
            }
        }
        
        // Garantir que temos um objeto Date válido
        if (!(dataObj instanceof Date) || isNaN(dataObj.getTime())) {
            console.error("Data inválida:", data);
            return '';
        }
        
        const ano = dataObj.getFullYear();
        const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
        const dia = String(dataObj.getDate()).padStart(2, '0');
        
        // Log para depuração
        console.log(`Convertendo data: Original=${data}, Formatada=${ano}-${mes}-${dia}`);
        
        return `${ano}-${mes}-${dia}`;
    } catch (erro) {
        console.error("Erro ao formatar data:", erro, data);
        return '';
    }
},
    /**
     * Configura a entrada numérica para quantidade de viajantes
     */
    configurarEntradaNumerica() {
        const inputId = this.estado.currentNumberInputId;
        if (!inputId) {
            console.error("ID de entrada numérica não encontrado!");
            return;
        }
        
        const input = document.getElementById(inputId);
        if (!input) {
            console.error(`Input com ID ${inputId} não encontrado!`);
            return;
        }
        
        const container = input.closest('.number-input-container');
        if (!container) {
            console.error("Container de entrada numérica não encontrado!");
            return;
        }
        
        const decrementBtn = container.querySelector('.decrement');
        const incrementBtn = container.querySelector('.increment');
        const confirmBtn = container.querySelector('.confirm-number');
        
        if (!decrementBtn || !incrementBtn || !confirmBtn) {
            console.error("Botões de entrada numérica não encontrados!");
            return;
        }
        
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
 * VERSÃO OTIMIZADA: Compatível com sistema de edição
 */
configurarAutocomplete(pergunta) {
    const autocompleteId = this.estado.currentAutocompleteId;
    if (!autocompleteId) {
        console.error("ID de autocomplete não encontrado!");
        return;
    }
    
    // Identificar o tipo de campo (origem ou destino)
    const tipoCampo = pergunta.key === 'destino_conhecido' ? 'destino' : 'origem';
    console.log(`Configurando autocomplete para campo: ${tipoCampo}`);
    
    const input = document.getElementById(autocompleteId);
    const resultsContainer = document.getElementById(`${autocompleteId}-results`);
    const confirmBtn = document.getElementById(`${autocompleteId}-confirm`);
    
    if (!input || !resultsContainer || !confirmBtn) {
        console.error("Elementos de autocomplete não encontrados!");
        return;
    }
    
    let selectedItem = null;
    let currentQuery = '';
    
    // Função para buscar sugestões com debounce (atraso)
    const buscarSugestoes = _.debounce(async (termo) => {
        if (!termo || termo.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }
        
        // Mostrar indicador de carregamento
        resultsContainer.innerHTML = '<div class="loading-autocomplete">Buscando...</div>';
        
        try {
            let sugestoes = [];
            
            // Usar a API Aviasales através do serviço
            if (window.BENETRIP_API) {
                sugestoes = await window.BENETRIP_API.buscarSugestoesCidade(termo);
                console.log(`Sugestões recebidas para ${tipoCampo}:`, sugestoes);
            } else {
                // Fallback para dados simulados
                sugestoes = [
                    { type: "city", code: "SAO", name: "São Paulo", country_code: "BR", country_name: "Brasil" },
                    { type: "city", code: "RIO", name: "Rio de Janeiro", country_code: "BR", country_name: "Brasil" },
                    { type: "city", code: "NYC", name: "Nova York", country_code: "US", country_name: "Estados Unidos" }
                ];
            }
            
            // Verificar se a consulta ainda é relevante
            if (termo !== currentQuery) return;
            
            if (sugestoes && sugestoes.length > 0) {
                resultsContainer.innerHTML = sugestoes.map(item => {
                    // Garantir compatibilidade com diferentes formatos de resposta
                    const code = item.code || item.iata;
                    const name = item.name || item.city_name;
                    const country = item.country_name;
                    
                    return `
                        <div class="autocomplete-item" data-code="${code}" data-name="${name}" data-country="${country}">
                            <div class="item-code">${code}</div>
                            <div class="item-details">
                                <div class="item-name">${name}</div>
                                <div class="item-country">${country}</div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                // Adicionar eventos aos itens
                document.querySelectorAll(`#${autocompleteId}-results .autocomplete-item`).forEach(item => {
                    item.addEventListener('click', () => {
                        selectedItem = {
                            code: item.dataset.code,
                            name: item.dataset.name,
                            country: item.dataset.country
                        };
                        input.value = `${selectedItem.name} (${selectedItem.code})`;
                        resultsContainer.innerHTML = '';
                        confirmBtn.disabled = false;
                        
                        // NOVO: Salvar dados selecionados no dataset para sistema de edição
                        input.dataset.selectedItem = JSON.stringify(selectedItem);
                    });
                });
            } else {
                resultsContainer.innerHTML = '<div class="no-results">Nenhum resultado encontrado</div>';
            }
        } catch (error) {
            console.error(`Erro ao buscar sugestões para ${tipoCampo}:`, error);
            resultsContainer.innerHTML = '<div class="error">Erro ao buscar sugestões</div>';
        }
    }, 300);
    
    // Evento para input
    input.addEventListener('input', (e) => {
        const termo = e.target.value.trim();
        currentQuery = termo;
        
        if (!termo) {
            resultsContainer.innerHTML = '';
            confirmBtn.disabled = true;
            selectedItem = null;
            
            // NOVO: Limpar dados salvos quando input é limpo
            input.removeAttribute('data-selected-item');
        } else {
            buscarSugestoes(termo);
        }
    });
    
    // Evento para o botão de confirmação
    confirmBtn.addEventListener('click', () => {
        if (selectedItem) {
            // NOVO: Garantir que dados estejam salvos no dataset
            input.dataset.selectedItem = JSON.stringify(selectedItem);
            
            this.processarResposta(selectedItem, pergunta);
        }
    });
    
    // Evento para Enter no campo
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && selectedItem) {
            e.preventDefault();
            
            // NOVO: Garantir que dados estejam salvos no dataset
            input.dataset.selectedItem = JSON.stringify(selectedItem);
            
            this.processarResposta(selectedItem, pergunta);
        }
    });
    
    // Foco automático no campo
    setTimeout(() => input.focus(), 300);
},

    /**
     * Configura a entrada de valor monetário
     */
    configurarEntradaMoeda() {
        // Verificar se o input está presente no DOM
        const checkInput = setInterval(() => {
            const currencyId = this.estado.currentCurrencyId;
            if (!currencyId) {
                console.error("ID de entrada monetária não encontrado!");
                clearInterval(checkInput);
                return;
            }
            
            const input = document.getElementById(currencyId);
            const confirmBtn = document.getElementById(`${currencyId}-confirm`);
            
            if (input && confirmBtn) {
                clearInterval(checkInput);
                
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
                        e.target.value = valor.replace('.',',');
                        
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
        const textId = this.estado.currentTextId;
        if (!textId) {
            console.error("ID de entrada de texto não encontrado!");
            return;
        }
        
        const input = document.getElementById(textId);
        const confirmBtn = document.getElementById(`${textId}-confirm`);
        
        if (!input || !confirmBtn) {
            console.error("Elementos de entrada de texto não encontrados!");
            return;
        }
        
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
        // Armazenar referência ao "this" atual para usar dentro do setTimeout
        const self = this;
        setTimeout(function() {
            self.mostrarProximaPergunta();
        }, this.config.animationDelay);
    },

    /**
     * Verifica se atingimos o limite de perguntas para este fluxo
     */
    verificarLimitePerguntas() {
    // Garantir que o questionário termine se todas as perguntas obrigatórias foram respondidas
    if (this.estado.fluxo === 'destino_conhecido') {
        const perguntasObrigatorias = [
            'conhece_destino', 
            'destino_conhecido', 
            'estilo_viagem_destino', // Nova pergunta adicionada
            'cidade_partida', 
            'datas'
        ];
        const todasRespondidas = perguntasObrigatorias.every(key => this.estado.respostas[key] !== undefined);
        
        if (todasRespondidas && this.estado.perguntaAtual >= 4) { // Aumentamos de 3 para 4
            console.log("Todas perguntas obrigatórias respondidas, finalizando questionário");
            return true;
        }
    }
    
    return false; // Mantém comportamento padrão para outros casos
},

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
        // Função simplificada para formatar data de YYYY-MM-DD para DD/MM/YYYY
        const formatarDataVisual = (dataStr) => {
            if (!dataStr || typeof dataStr !== 'string') return 'Data inválida';
            
            // Se for formato YYYY-MM-DD, converter para DD/MM/YYYY
            if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [ano, mes, dia] = dataStr.split('-');
                return `${dia}/${mes}/${ano}`;
            }
            
            return dataStr; // Retornar como está se não for o formato esperado
        };
        
        mensagemResposta = `Ida: ${formatarDataVisual(valor.dataIda)} | Volta: ${formatarDataVisual(valor.dataVolta)}`;
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
        // Adicionar logs para depuração
        console.log("Finalizando questionário com fluxo:", this.estado.fluxo);
        console.log("Dados salvos:", this.estado.respostas);

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
     * Mostra a Tripinha "pensando"
     */
    async mostrarTripinhaPensando() {
        // Criar elemento de mensagem
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
        
        // Adicionar ao chat
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.insertAdjacentHTML('beforeend', mensagemHTML);
        
        // Rolar para a última mensagem
        this.rolarParaFinal();
        
        // Simular tempo de "pensamento"
        return new Promise(resolve => {
            setTimeout(() => {
                // Remover mensagem de pensamento
                const mensagemPensando = chatMessages.querySelector('.chat-message.tripinha:last-child');
                if (mensagemPensando) {
                    chatMessages.removeChild(mensagemPensando);
                }
                resolve();
            }, 1500);
        });
    },

    /**
     * Configura eventos para atualização da barra de progresso
     */
    configurarEventosProgresso() {
        // Remover manipuladores antigos para evitar duplicação
        window.removeEventListener('benetrip_progress', this.handleProgressEvent);
        
        // Criar novo manipulador de eventos
        this.handleProgressEvent = (event) => {
            const { progress, message } = event.detail;
            this.atualizarBarraProgresso(progress, message);
        };
        
        // Registrar manipulador para eventos de progresso
        window.addEventListener('benetrip_progress', this.handleProgressEvent);
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
                
                // Notificar que os dados estão prontos
                if (window.BENETRIP.notificarDadosProntos) {
                    window.BENETRIP.notificarDadosProntos();
                }
                
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
        // Garantir que haja um redirecionamento, mesmo se API falhar
        const redirecionarParaVoos = () => {
            console.log("Redirecionando para página de voos...");
            this.atualizarBarraProgresso(100, "Redirecionando para voos...");
            setTimeout(() => {
                window.location.href = 'flights.html';
            }, 2000);
        };
        
        // Verificar se o serviço de API está disponível
        if (!window.BENETRIP_API) {
            console.error("Serviço de API não disponível");
            this.atualizarBarraProgresso(100, "Erro ao buscar voos. Redirecionando...");
            redirecionarParaVoos();
            return;
        }
        
        // Verificar dados essenciais
        const destino = this.estado.respostas.destino_conhecido;
        const origem = this.estado.respostas.cidade_partida;
        const datas = this.estado.respostas.datas;
        
        if (!destino || !origem || !datas || !datas.dataIda) {
            console.error("Dados incompletos para busca de voos:", {destino, origem, datas});
            this.atualizarBarraProgresso(100, "Dados incompletos. Redirecionando...");
            redirecionarParaVoos();
            return;
        }
        
        // Preparar parâmetros para busca de voos
        const params = {
            origem: origem.code,
            destino: destino.code,
            dataIda: datas.dataIda,
            dataVolta: datas.dataVolta,
            adultos: this.getNumeroAdultos()
        };
        
        console.log('Iniciando busca de voos com parâmetros:', params);
        this.atualizarBarraProgresso(15, "Iniciando busca...");
        
        // Chamar serviço de API para busca de voos
        window.BENETRIP_API.buscarVoos(params)
            .then(resultados => {
                // Salvar resultados
                localStorage.setItem('benetrip_resultados_voos', JSON.stringify(resultados));
                
                // Notificar que os dados estão prontos
                if (window.BENETRIP.notificarDadosProntos) {
                    window.BENETRIP.notificarDadosProntos();
                }
                
                // Mostrar mensagem de conclusão
                this.atualizarBarraProgresso(100, "Voos encontrados! Redirecionando...");
                redirecionarParaVoos();
            })
            .catch(erro => {
                console.error("Erro ao buscar voos:", erro);
                this.atualizarBarraProgresso(100, "Erro ao buscar voos. Redirecionando...");
                redirecionarParaVoos();
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
     * Salva os dados do usuário no localStorage com formato padronizado
     */
    salvarDadosUsuario() {
        // Estrutura padronizada para salvar no localStorage
        const dadosPadronizados = {
            fluxo: this.estado.fluxo,
            timestamp: Date.now(),
            respostas: {
                ...this.estado.respostas,
                // Garante que informações de passageiros estejam sempre no mesmo formato
                passageiros: {
                    adultos: this.getNumeroAdultos(),
                    criancas: 0,
                    bebes: 0
                }
            }
        };
        
        // Verificar e padronizar dados da cidade de partida
        if (this.estado.respostas.cidade_partida) {
            // Garante que cidade_partida seja sempre um objeto com formato padrão
            if (typeof this.estado.respostas.cidade_partida === 'string') {
                // Tenta extrair código IATA se estiver no formato "Cidade (ABC)"
                const match = this.estado.respostas.cidade_partida.match(/\(([A-Z]{3})\)/);
                dadosPadronizados.respostas.cidade_partida = {
                    name: this.estado.respostas.cidade_partida,
                    code: match ? match[1] : 'GRU' // Fallback para GRU se não encontrar
                };
            }
        }
        
        // Padronizar dados de destino conhecido, se existir
        if (this.estado.respostas.destino_conhecido) {
            if (typeof this.estado.respostas.destino_conhecido === 'string') {
                const match = this.estado.respostas.destino_conhecido.match(/\(([A-Z]{3})\)/);
                dadosPadronizados.respostas.destino_conhecido = {
                    name: this.estado.respostas.destino_conhecido,
                    code: match ? match[1] : 'JFK', // Fallback para JFK se não encontrar
                    country: 'País não especificado'
                };
            }
        }
        
        // Padronizar dados de datas, se existir
        if (this.estado.respostas.datas) {
            // Garantir que datas estejam no formato correto (YYYY-MM-DD)
            if (this.estado.respostas.datas.dataIda && typeof this.estado.respostas.datas.dataIda === 'string') {
                dadosPadronizados.respostas.datas = {
                    ...this.estado.respostas.datas,
                    dataIda: this.formatarDataISO(this.estado.respostas.datas.dataIda),
                    dataVolta: this.formatarDataISO(this.estado.respostas.datas.dataVolta || '')
                };
            }
        }
        
        // Adicionar moeda preferida
        dadosPadronizados.respostas.moeda = this.estado.respostas.moeda_escolhida || this.config.defaultCurrency;
        
        // Log para debug
        if (this.config.debugMode) {
            console.log("Dados padronizados para salvamento:", dadosPadronizados);
        }
        
        localStorage.setItem('benetrip_user_data', JSON.stringify(dadosPadronizados));
        
        // NOVO: Salvar o destino em formato compatível com a página de voos quando fluxo for destino_conhecido
        if (this.estado.fluxo === 'destino_conhecido' && this.estado.respostas.destino_conhecido) {
            const destino = this.estado.respostas.destino_conhecido;
            if (destino) {
                const destinoFormatado = {
                    codigo_iata: destino.code,
                    destino: destino.name,
                    pais: destino.country || 'País não especificado'
                };
                localStorage.setItem('benetrip_destino_selecionado', JSON.stringify(destinoFormatado));
                console.log('Destino salvo para página de voos:', destinoFormatado);
            }
        }
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
     * Exibe uma mensagem toast
     * @param {string} mensagem - Mensagem a ser exibida
     * @param {string} tipo - Tipo da mensagem (info, warning, error, success)
     */
    exibirToast(mensagem, tipo = 'info') {
        // Verificar se container de toast existe
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            // Criar container se não existir
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // Criar toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${tipo}`;
        toast.textContent = mensagem;
        
        // Adicionar ao container
        toastContainer.appendChild(toast);
        
        // Adicionar classe para mostrar com animação
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remover após timeout
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    /**
     * Rolar o chat para a última mensagem
     */
    rolarParaFinal() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
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
document.addEventListener('DOMContentLoaded', function() {
    BENETRIP.init();
});

// Exportar a aplicação para o namespace global
window.BENETRIP = BENETRIP;
