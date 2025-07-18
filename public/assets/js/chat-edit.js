/** 
 * BENETRIP - Sistema de Edição de Respostas
 * Permite ao usuário editar respostas já dadas
 * VERSÃO OTIMIZADA: Integração com calendário e autocomplete APIs
 */

// Extensão do BENETRIP para incluir funcionalidades de edição
Object.assign(BENETRIP, {
    /**
     * Histórico de perguntas e respostas para navegação
     */
    historico: [],
    
    /**
     * Indica se estamos em modo de edição
     */
    modoEdicao: false,
    
    /**
     * Pergunta sendo editada
     */
    perguntaEditando: null,

    /**
     * IDs únicos para componentes em edição
     */
    edicaoIds: {
        calendarioAtual: null,
        autocompleteAtual: null,
        currencyAtual: null,
        numberAtual: null
    },

    /**
     * Versão melhorada da função mostrarRespostaUsuario com botão de edição
     */
    mostrarRespostaUsuarioComEdicao(valor, pergunta) {
        let mensagemResposta = '';
        
        // Formatar a resposta com base no tipo de pergunta (código original)
        if (pergunta.options) {
            mensagemResposta = pergunta.options[valor];
        } else if (pergunta.calendar) {
            const formatarDataVisual = (dataStr) => {
                if (!dataStr || typeof dataStr !== 'string') return 'Data inválida';
                if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const [ano, mes, dia] = dataStr.split('-');
                    return `${dia}/${mes}/${ano}`;
                }
                return dataStr;
            };
            mensagemResposta = `Ida: ${formatarDataVisual(valor.dataIda)} | Volta: ${formatarDataVisual(valor.dataVolta)}`;
        } else if (pergunta.autocomplete) {
            mensagemResposta = `${valor.name} (${valor.code}), ${valor.country}`;
        } else {
            mensagemResposta = valor.toString();
        }
        
        // Criar elemento da mensagem COM botão de editar
        const mensagemHTML = `
            <div class="chat-message user" data-pergunta-key="${pergunta.key}" data-pergunta-index="${this.estado.perguntaAtual - 1}">
                <div class="message">
                    <div class="response-content">
                        <p>${mensagemResposta}</p>
                        <button class="btn-editar-resposta" onclick="BENETRIP.editarResposta('${pergunta.key}', ${this.estado.perguntaAtual - 1})">
                            ✏️ Editar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Adicionar ao chat
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.insertAdjacentHTML('beforeend', mensagemHTML);
        
        // Salvar no histórico
        this.historico.push({
            pergunta: pergunta,
            resposta: valor,
            perguntaIndex: this.estado.perguntaAtual - 1,
            mensagemResposta: mensagemResposta
        });
        
        this.rolarParaFinal();
    },

    /**
     * Função para editar uma resposta específica
     */
    editarResposta(perguntaKey, perguntaIndex) {
        console.log(`Editando resposta da pergunta: ${perguntaKey}`);
        
        // Encontrar a pergunta no histórico
        const itemHistorico = this.historico.find(item => item.pergunta.key === perguntaKey);
        if (!itemHistorico) {
            console.error('Pergunta não encontrada no histórico');
            return;
        }
        
        // Entrar em modo de edição
        this.modoEdicao = true;
        this.perguntaEditando = itemHistorico;
        
        // Encontrar a mensagem do usuário correspondente
        const mensagemUsuario = document.querySelector(`[data-pergunta-key="${perguntaKey}"]`);
        if (!mensagemUsuario) {
            console.error('Mensagem do usuário não encontrada');
            return;
        }
        
        // Substituir a mensagem por um formulário de edição
        this.criarFormularioEdicao(mensagemUsuario, itemHistorico);
    },

    /**
     * Cria formulário de edição inline - VERSÃO OTIMIZADA
     */
    criarFormularioEdicao(elementoMensagem, itemHistorico) {
        const pergunta = itemHistorico.pergunta;
        const respostaAtual = itemHistorico.resposta;
        
        // Gerar HTML do formulário baseado no tipo de pergunta
        let formularioHTML = '';
        
        if (pergunta.options) {
            // Múltipla escolha
            formularioHTML = `
                <div class="edicao-container">
                    <p class="edicao-titulo">✏️ Editando: ${pergunta.question}</p>
                    <div class="opcoes-edicao">
                        ${pergunta.options.map((opcao, index) => `
                            <button class="opcao-edicao ${index === respostaAtual ? 'selecionada' : ''}" 
                                    data-valor="${index}">
                                ${opcao}
                            </button>
                        `).join('')}
                    </div>
                    <div class="edicao-acoes">
                        <button class="btn-cancelar-edicao">❌ Cancelar</button>
                        <button class="btn-salvar-edicao" disabled>✅ Salvar</button>
                    </div>
                </div>
            `;
        } else if (pergunta.calendar) {
            // Calendário - usando estrutura compatível com app.js
            const calendarioId = `edicao-calendar-${Date.now()}`;
            this.edicaoIds.calendarioAtual = calendarioId;
            
            formularioHTML = `
                <div class="edicao-container">
                    <p class="edicao-titulo">✏️ Editando: ${pergunta.question}</p>
                    <p class="edicao-instrucao">Selecione novas datas:</p>
                    <div class="calendar-container" data-calendar-container="${calendarioId}">
                        <div id="${calendarioId}" class="flatpickr-calendar-container"></div>
                        <div class="date-selection">
                            <p>Ida: <span id="data-ida-${calendarioId}">Selecione</span></p>
                            <p>Volta: <span id="data-volta-${calendarioId}">Selecione</span></p>
                        </div>
                        <div class="edicao-acoes">
                            <button class="btn-cancelar-edicao">❌ Cancelar</button>
                            <button id="confirmar-datas-${calendarioId}" class="btn-salvar-edicao confirm-button confirm-dates" disabled>✅ Salvar Datas</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (pergunta.autocomplete) {
            // Autocomplete - usando estrutura compatível com app.js
            const autocompleteId = `edicao-autocomplete-${Date.now()}`;
            this.edicaoIds.autocompleteAtual = autocompleteId;
            
            const valorAtual = typeof respostaAtual === 'object' ? 
                `${respostaAtual.name} (${respostaAtual.code})` : respostaAtual;
                
            formularioHTML = `
                <div class="edicao-container">
                    <p class="edicao-titulo">✏️ Editando: ${pergunta.question}</p>
                    <div class="autocomplete-container" id="${autocompleteId}-container">
                        <input type="text" id="${autocompleteId}" class="autocomplete-input" 
                               value="${valorAtual}" placeholder="${pergunta.description}">
                        <div id="${autocompleteId}-results" class="autocomplete-results"></div>
                        <div class="edicao-acoes">
                            <button class="btn-cancelar-edicao">❌ Cancelar</button>
                            <button id="${autocompleteId}-confirm" class="btn-salvar-edicao confirm-autocomplete" disabled>✅ Salvar</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (pergunta.currency_format) {
            // Entrada de moeda
            const currencyId = `edicao-currency-${Date.now()}`;
            this.edicaoIds.currencyAtual = currencyId;
            
            formularioHTML = `
                <div class="edicao-container">
                    <p class="edicao-titulo">✏️ Editando: ${pergunta.question}</p>
                    <div class="currency-input-container">
                        <input type="text" id="${currencyId}" class="currency-input" 
                               value="${respostaAtual}" placeholder="0,00">
                        <div class="edicao-acoes">
                            <button class="btn-cancelar-edicao">❌ Cancelar</button>
                            <button id="${currencyId}-confirm" class="btn-salvar-edicao confirm-currency" disabled>✅ Salvar</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (pergunta.number_input) {
            // Entrada numérica
            const numberId = `edicao-number-${Date.now()}`;
            this.edicaoIds.numberAtual = numberId;
            
            formularioHTML = `
                <div class="edicao-container">
                    <p class="edicao-titulo">✏️ Editando: ${pergunta.question}</p>
                    <div class="number-input-container">
                        <button class="decrement">-</button>
                        <input type="number" min="1" max="20" value="${respostaAtual}" id="${numberId}" class="number-input">
                        <button class="increment">+</button>
                        <div class="edicao-acoes">
                            <button class="btn-cancelar-edicao">❌ Cancelar</button>
                            <button class="btn-salvar-edicao confirm-number">✅ Salvar</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (pergunta.input_field) {
            // Campo de texto simples
            const textId = `edicao-text-${Date.now()}`;
            
            const valorAtual = typeof respostaAtual === 'object' ? 
                `${respostaAtual.name} (${respostaAtual.code})` : respostaAtual;
                
            formularioHTML = `
                <div class="edicao-container">
                    <p class="edicao-titulo">✏️ Editando: ${pergunta.question}</p>
                    <div class="text-input-container">
                        <input type="text" id="${textId}" class="text-input" 
                               value="${valorAtual}" placeholder="${pergunta.description}">
                        <div class="edicao-acoes">
                            <button class="btn-cancelar-edicao">❌ Cancelar</button>
                            <button id="${textId}-confirm" class="btn-salvar-edicao confirm-text" disabled>✅ Salvar</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Substituir conteúdo da mensagem
        elementoMensagem.querySelector('.message').innerHTML = formularioHTML;
        
        // Configurar eventos do formulário - VERSÃO OTIMIZADA
        this.configurarEventosEdicaoOtimizada(elementoMensagem, itemHistorico);
    },

    /**
     * Configura eventos do formulário de edição - VERSÃO OTIMIZADA
     */
    configurarEventosEdicaoOtimizada(elementoMensagem, itemHistorico) {
        const container = elementoMensagem.querySelector('.edicao-container');
        const btnCancelar = container.querySelector('.btn-cancelar-edicao');
        const pergunta = itemHistorico.pergunta;
        
        let novaResposta = null;
        
        // Configurar componentes específicos usando as funções do app.js
        if (pergunta.calendar && this.edicaoIds.calendarioAtual) {
            this.configurarCalendarioEdicao(pergunta, (dadosDatas) => {
                novaResposta = dadosDatas;
                // O botão de salvar será habilitado dentro da função de calendário
            });
        } else if (pergunta.autocomplete && this.edicaoIds.autocompleteAtual) {
            this.configurarAutocompleteEdicao(pergunta, (dadosLocal) => {
                novaResposta = dadosLocal;
                const btnSalvar = container.querySelector('.btn-salvar-edicao');
                if (btnSalvar) btnSalvar.disabled = false;
            });
        } else if (pergunta.currency_format && this.edicaoIds.currencyAtual) {
            this.configurarMoedaEdicao(pergunta, (valor) => {
                novaResposta = valor;
                const btnSalvar = container.querySelector('.btn-salvar-edicao');
                if (btnSalvar) btnSalvar.disabled = false;
            });
        } else if (pergunta.number_input && this.edicaoIds.numberAtual) {
            this.configurarNumeroEdicao(pergunta, (valor) => {
                novaResposta = valor;
                // Botão sempre habilitado para números
            });
        } else if (pergunta.options) {
            // Múltipla escolha
            const opcoes = container.querySelectorAll('.opcao-edicao');
            const btnSalvar = container.querySelector('.btn-salvar-edicao');
            
            opcoes.forEach(opcao => {
                opcao.addEventListener('click', () => {
                    opcoes.forEach(o => o.classList.remove('selecionada'));
                    opcao.classList.add('selecionada');
                    novaResposta = parseInt(opcao.dataset.valor);
                    btnSalvar.disabled = false;
                });
            });
        } else if (pergunta.input_field) {
            // Campo de texto simples
            const campo = container.querySelector('.text-input');
            const btnSalvar = container.querySelector('.btn-salvar-edicao');
            
            if (campo && btnSalvar) {
                campo.addEventListener('input', () => {
                    novaResposta = campo.value.trim();
                    btnSalvar.disabled = novaResposta.length === 0;
                });
                
                btnSalvar.addEventListener('click', () => {
                    if (novaResposta && novaResposta.length > 0) {
                        this.salvarEdicao(elementoMensagem, itemHistorico, novaResposta);
                    }
                });
            }
        }
        
        // Botão cancelar - funciona para todos os tipos
        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => {
                this.cancelarEdicao(elementoMensagem, itemHistorico);
            });
        }
        
        // Configurar botão salvar geral (se não foi configurado especificamente acima)
        const btnSalvarGeral = container.querySelector('.btn-salvar-edicao:not(.confirm-dates):not(.confirm-autocomplete)');
        if (btnSalvarGeral && !pergunta.input_field) {
            btnSalvarGeral.addEventListener('click', () => {
                if (novaResposta !== null && novaResposta !== undefined) {
                    this.salvarEdicao(elementoMensagem, itemHistorico, novaResposta);
                }
            });
        }
    },

    /**
     * Configura calendário para edição reutilizando função do app.js
     */
    configurarCalendarioEdicao(pergunta, callback) {
        // Temporariamente definir o ID do calendário atual para reutilizar a função
        const idOriginal = this.estado.currentCalendarId;
        this.estado.currentCalendarId = this.edicaoIds.calendarioAtual;
        
        // Reutilizar a função de inicializar calendário
        setTimeout(() => {
            try {
                this.inicializarCalendario(pergunta);
                
                // Configurar callback personalizado para edição
                const btnConfirmar = document.getElementById(`confirmar-datas-${this.edicaoIds.calendarioAtual}`);
                if (btnConfirmar) {
                    // Remover eventos existentes
                    btnConfirmar.replaceWith(btnConfirmar.cloneNode(true));
                    const novoBtn = document.getElementById(`confirmar-datas-${this.edicaoIds.calendarioAtual}`);
                    
                    novoBtn.addEventListener('click', () => {
                        const calendario = this.estado.calendarioAtual;
                        if (calendario && calendario.selectedDates.length === 2) {
                            const datas = calendario.selectedDates;
                            const dadosDatas = {
                                dataIda: this.formatarDataISO(datas[0]),
                                dataVolta: this.formatarDataISO(datas[1])
                            };
                            callback(dadosDatas);
                            
                            // Processar edição
                            const elementoMensagem = novoBtn.closest('.chat-message');
                            const itemHistorico = this.perguntaEditando;
                            this.salvarEdicao(elementoMensagem, itemHistorico, dadosDatas);
                        }
                    });
                }
            } catch (erro) {
                console.error('Erro ao configurar calendário de edição:', erro);
            } finally {
                // Restaurar ID original
                this.estado.currentCalendarId = idOriginal;
            }
        }, 300);
    },

    /**
     * Configura autocomplete para edição reutilizando função do app.js
     */
    configurarAutocompleteEdicao(pergunta, callback) {
        // Temporariamente definir o ID do autocomplete atual
        const idOriginal = this.estado.currentAutocompleteId;
        this.estado.currentAutocompleteId = this.edicaoIds.autocompleteAtual;
        
        setTimeout(() => {
            try {
                this.configurarAutocomplete(pergunta);
                
                // Configurar callback personalizado para edição
                const btnConfirmar = document.getElementById(`${this.edicaoIds.autocompleteAtual}-confirm`);
                if (btnConfirmar) {
                    // Remover eventos existentes
                    btnConfirmar.replaceWith(btnConfirmar.cloneNode(true));
                    const novoBtn = document.getElementById(`${this.edicaoIds.autocompleteAtual}-confirm`);
                    
                    novoBtn.addEventListener('click', () => {
                        // Acessar dados do autocomplete (precisa adaptar a lógica do app.js)
                        const input = document.getElementById(this.edicaoIds.autocompleteAtual);
                        if (input && input.dataset.selectedItem) {
                            const dadosLocal = JSON.parse(input.dataset.selectedItem);
                            callback(dadosLocal);
                            
                            // Processar edição
                            const elementoMensagem = novoBtn.closest('.chat-message');
                            const itemHistorico = this.perguntaEditando;
                            this.salvarEdicao(elementoMensagem, itemHistorico, dadosLocal);
                        }
                    });
                }
            } catch (erro) {
                console.error('Erro ao configurar autocomplete de edição:', erro);
            } finally {
                // Restaurar ID original
                this.estado.currentAutocompleteId = idOriginal;
            }
        }, 300);
    },

    /**
     * Configura entrada de moeda para edição reutilizando função do app.js
     */
    configurarMoedaEdicao(pergunta, callback) {
        const idOriginal = this.estado.currentCurrencyId;
        this.estado.currentCurrencyId = this.edicaoIds.currencyAtual;
        
        setTimeout(() => {
            try {
                this.configurarEntradaMoeda();
                
                const btnConfirmar = document.getElementById(`${this.edicaoIds.currencyAtual}-confirm`);
                if (btnConfirmar) {
                    btnConfirmar.replaceWith(btnConfirmar.cloneNode(true));
                    const novoBtn = document.getElementById(`${this.edicaoIds.currencyAtual}-confirm`);
                    
                    novoBtn.addEventListener('click', () => {
                        const input = document.getElementById(this.edicaoIds.currencyAtual);
                        if (input) {
                            const valor = parseFloat(input.value.replace(',', '.'));
                            if (valor > 0) {
                                callback(valor);
                                
                                const elementoMensagem = novoBtn.closest('.chat-message');
                                const itemHistorico = this.perguntaEditando;
                                this.salvarEdicao(elementoMensagem, itemHistorico, valor);
                            }
                        }
                    });
                }
            } catch (erro) {
                console.error('Erro ao configurar moeda de edição:', erro);
            } finally {
                this.estado.currentCurrencyId = idOriginal;
            }
        }, 300);
    },

    /**
     * Configura entrada numérica para edição reutilizando função do app.js
     */
    configurarNumeroEdicao(pergunta, callback) {
        const idOriginal = this.estado.currentNumberInputId;
        this.estado.currentNumberInputId = this.edicaoIds.numberAtual;
        
        setTimeout(() => {
            try {
                this.configurarEntradaNumerica();
                
                const btnConfirmar = document.querySelector('.edicao-container .confirm-number');
                if (btnConfirmar) {
                    btnConfirmar.replaceWith(btnConfirmar.cloneNode(true));
                    const novoBtn = document.querySelector('.edicao-container .confirm-number');
                    
                    novoBtn.addEventListener('click', () => {
                        const input = document.getElementById(this.edicaoIds.numberAtual);
                        if (input) {
                            const valor = parseInt(input.value);
                            callback(valor);
                            
                            const elementoMensagem = novoBtn.closest('.chat-message');
                            const itemHistorico = this.perguntaEditando;
                            this.salvarEdicao(elementoMensagem, itemHistorico, valor);
                        }
                    });
                }
            } catch (erro) {
                console.error('Erro ao configurar número de edição:', erro);
            } finally {
                this.estado.currentNumberInputId = idOriginal;
            }
        }, 300);
    },

    /**
     * Cancela a edição e restaura a mensagem original
     */
    cancelarEdicao(elementoMensagem, itemHistorico) {
        // Limpar calendário se existir
        if (this.estado.calendarioAtual && this.estado.calendarioAtual.destroy) {
            this.estado.calendarioAtual.destroy();
            this.estado.calendarioAtual = null;
        }
        
        // Restaurar mensagem original
        elementoMensagem.querySelector('.message').innerHTML = `
            <div class="response-content">
                <p>${itemHistorico.mensagemResposta}</p>
                <button class="btn-editar-resposta" onclick="BENETRIP.editarResposta('${itemHistorico.pergunta.key}', ${itemHistorico.perguntaIndex})">
                    ✏️ Editar
                </button>
            </div>
        `;
        
        // Limpar IDs de edição
        this.edicaoIds = {
            calendarioAtual: null,
            autocompleteAtual: null,
            currencyAtual: null,
            numberAtual: null
        };
        
        // Sair do modo de edição
        this.modoEdicao = false;
        this.perguntaEditando = null;
    },

    /**
     * Salva a edição e atualiza o estado
     */
    salvarEdicao(elementoMensagem, itemHistorico, novaResposta) {
        if (novaResposta === null || novaResposta === undefined) {
            this.exibirToast('Por favor, selecione uma opção válida', 'warning');
            return;
        }
        
        // Limpar calendário se existir
        if (this.estado.calendarioAtual && this.estado.calendarioAtual.destroy) {
            this.estado.calendarioAtual.destroy();
            this.estado.calendarioAtual = null;
        }
        
        // Atualizar resposta no estado
        this.estado.respostas[itemHistorico.pergunta.key] = novaResposta;
        
        // Atualizar histórico
        itemHistorico.resposta = novaResposta;
        
        // Formatar nova mensagem de resposta
        let novaMensagemResposta = '';
        if (itemHistorico.pergunta.options) {
            novaMensagemResposta = itemHistorico.pergunta.options[novaResposta];
        } else if (itemHistorico.pergunta.calendar) {
            const formatarDataVisual = (dataStr) => {
                if (!dataStr || typeof dataStr !== 'string') return 'Data inválida';
                if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const [ano, mes, dia] = dataStr.split('-');
                    return `${dia}/${mes}/${ano}`;
                }
                return dataStr;
            };
            novaMensagemResposta = `Ida: ${formatarDataVisual(novaResposta.dataIda)} | Volta: ${formatarDataVisual(novaResposta.dataVolta)}`;
        } else if (itemHistorico.pergunta.autocomplete) {
            novaMensagemResposta = `${novaResposta.name} (${novaResposta.code}), ${novaResposta.country}`;
        } else {
            novaMensagemResposta = novaResposta.toString();
        }
        
        itemHistorico.mensagemResposta = novaMensagemResposta;
        
        // Atualizar interface
        elementoMensagem.querySelector('.message').innerHTML = `
            <div class="response-content">
                <p>${novaMensagemResposta}</p>
                <button class="btn-editar-resposta" onclick="BENETRIP.editarResposta('${itemHistorico.pergunta.key}', ${itemHistorico.perguntaIndex})">
                    ✏️ Editar
                </button>
            </div>
        `;
        
        // Limpar IDs de edição
        this.edicaoIds = {
            calendarioAtual: null,
            autocompleteAtual: null,
            currencyAtual: null,
            numberAtual: null
        };
        
        // Feedback visual
        this.exibirToast('Resposta atualizada com sucesso! ✅', 'success');
        
        // Sair do modo de edição
        this.modoEdicao = false;
        this.perguntaEditando = null;
        
        // Salvar dados atualizados
        this.salvarDadosUsuario();
    },

    /**
     * Protege contra cliques em perguntas já respondidas
     */
    protegerPerguntasRespondidas() {
        // Desabilitar botões de opções de perguntas anteriores
        const mensagensAnteriores = document.querySelectorAll('.chat-message.tripinha');
        mensagensAnteriores.forEach((mensagem, index) => {
            if (index < this.estado.perguntaAtual - 1) {
                const botoes = mensagem.querySelectorAll('.option-button');
                botoes.forEach(botao => {
                    botao.disabled = true;
                    botao.style.opacity = '0.6';
                    botao.style.cursor = 'not-allowed';
                    
                    // Remover eventos existentes
                    const novoBotao = botao.cloneNode(true);
                    botao.parentNode.replaceChild(novoBotao, botao);
                });
            }
        });
    },

    /**
     * Adiciona barra de progresso com navegação
     */
    adicionarBarraProgresso() {
        const chatContainer = document.getElementById('chat-container');
        const barraHTML = `
            <div class="barra-progresso-navegacao">
                <div class="progresso-visual">
                    <div class="progresso-barra" style="width: ${(this.estado.perguntaAtual / this.estado.perguntas.length) * 100}%"></div>
                </div>
                <div class="navegacao-botoes">
                    <button class="btn-voltar" onclick="BENETRIP.voltarPergunta()" ${this.estado.perguntaAtual <= 1 ? 'disabled' : ''}>
                        ← Voltar
                    </button>
                    <span class="contador-perguntas">${this.estado.perguntaAtual}/${this.estado.perguntas.length}</span>
                    <button class="btn-resumo" onclick="BENETRIP.mostrarResumo()">
                        📋 Resumo
                    </button>
                </div>
            </div>
        `;
        
        // Inserir antes das mensagens
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.insertAdjacentHTML('beforebegin', barraHTML);
    },

    /**
     * Função para voltar à pergunta anterior
     */
    voltarPergunta() {
        if (this.estado.perguntaAtual <= 1) return;
        
        // Voltar uma pergunta
        this.estado.perguntaAtual--;
        
        // Remover última mensagem da Tripinha e do usuário
        const chatMessages = document.getElementById('chat-messages');
        const ultimasMensagens = chatMessages.querySelectorAll('.chat-message');
        if (ultimasMensagens.length >= 2) {
            // Remover última mensagem do usuário
            ultimasMensagens[ultimasMensagens.length - 1].remove();
            // Remover última mensagem da Tripinha
            ultimasMensagens[ultimasMensagens.length - 2].remove();
        }
        
        // Remover resposta do estado
        const perguntaAnterior = this.estado.perguntas[this.estado.perguntaAtual];
        if (perguntaAnterior && this.estado.respostas[perguntaAnterior.key]) {
            delete this.estado.respostas[perguntaAnterior.key];
        }
        
        // Mostrar pergunta novamente
        this.mostrarProximaPergunta();
        
        // Atualizar barra de progresso
        this.atualizarBarraProgresso();
    },

    /**
     * Mostra resumo das respostas até agora
     */
    mostrarResumo() {
        const respostas = this.estado.respostas;
        let resumoHTML = `
            <div class="modal-resumo">
                <div class="modal-conteudo">
                    <div class="modal-header">
                        <h3>📋 Resumo das suas respostas</h3>
                        <button class="btn-fechar" onclick="this.closest('.modal-resumo').remove()">×</button>
                    </div>
                    <div class="modal-body">
        `;
        
        this.historico.forEach(item => {
            resumoHTML += `
                <div class="item-resumo">
                    <strong>${item.pergunta.question}</strong>
                    <p>${item.mensagemResposta}</p>
                    <button class="btn-editar-mini" onclick="BENETRIP.editarResposta('${item.pergunta.key}', ${item.perguntaIndex})">
                        ✏️ Editar
                    </button>
                </div>
            `;
        });
        
        resumoHTML += `
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', resumoHTML);
    }
});

// Sobrescrever a função original de mostrar resposta do usuário
BENETRIP.mostrarRespostaUsuario = BENETRIP.mostrarRespostaUsuarioComEdicao;

// Sobrescrever função de processar resposta para incluir proteções
const processarRespostaOriginal = BENETRIP.processarResposta;
BENETRIP.processarResposta = function(valor, pergunta) {
    // Verificar se estamos em modo de edição
    if (this.modoEdicao) {
        return; // Não processar novas respostas em modo de edição
    }
    
    // Chamar função original
    processarRespostaOriginal.call(this, valor, pergunta);
    
    // Proteger perguntas anteriores
    setTimeout(() => {
        this.protegerPerguntasRespondidas();
    }, 100);
};
