/**
 * BENETRIP - Sistema de Edição de Respostas
 * Permite ao usuário editar respostas já dadas
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
     * Cria formulário de edição inline
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
        } else if (pergunta.input_field && !pergunta.calendar) {
            // Campo de texto
            const valorAtual = typeof respostaAtual === 'object' ? 
                `${respostaAtual.name} (${respostaAtual.code})` : respostaAtual;
                
            formularioHTML = `
                <div class="edicao-container">
                    <p class="edicao-titulo">✏️ Editando: ${pergunta.question}</p>
                    <div class="input-edicao">
                        <input type="text" class="campo-edicao" value="${valorAtual}" 
                               placeholder="${pergunta.description}">
                    </div>
                    <div class="edicao-acoes">
                        <button class="btn-cancelar-edicao">❌ Cancelar</button>
                        <button class="btn-salvar-edicao">✅ Salvar</button>
                    </div>
                </div>
            `;
        } else if (pergunta.calendar) {
            // Calendário
            formularioHTML = `
                <div class="edicao-container">
                    <p class="edicao-titulo">✏️ Editando: ${pergunta.question}</p>
                    <p class="edicao-instrucao">Selecione novas datas:</p>
                    <div class="calendar-edicao" id="calendar-edicao-${Date.now()}">
                        <!-- Calendário será inicializado aqui -->
                    </div>
                    <div class="edicao-acoes">
                        <button class="btn-cancelar-edicao">❌ Cancelar</button>
                        <button class="btn-salvar-edicao" disabled>✅ Salvar</button>
                    </div>
                </div>
            `;
        }
        
        // Substituir conteúdo da mensagem
        elementoMensagem.querySelector('.message').innerHTML = formularioHTML;
        
        // Configurar eventos do formulário
        this.configurarEventosEdicao(elementoMensagem, itemHistorico);
    },

    /**
     * Configura eventos do formulário de edição
     */
    configurarEventosEdicao(elementoMensagem, itemHistorico) {
        const container = elementoMensagem.querySelector('.edicao-container');
        const btnCancelar = container.querySelector('.btn-cancelar-edicao');
        const btnSalvar = container.querySelector('.btn-salvar-edicao');
        
        let novaResposta = null;
        
        // Eventos baseados no tipo de pergunta
        if (itemHistorico.pergunta.options) {
            // Múltipla escolha
            const opcoes = container.querySelectorAll('.opcao-edicao');
            opcoes.forEach(opcao => {
                opcao.addEventListener('click', () => {
                    // Remover seleção anterior
                    opcoes.forEach(o => o.classList.remove('selecionada'));
                    // Adicionar seleção atual
                    opcao.classList.add('selecionada');
                    novaResposta = parseInt(opcao.dataset.valor);
                    btnSalvar.disabled = false;
                });
            });
        } else if (itemHistorico.pergunta.input_field && !itemHistorico.pergunta.calendar) {
            // Campo de texto
            const campo = container.querySelector('.campo-edicao');
            campo.addEventListener('input', () => {
                novaResposta = campo.value.trim();
                btnSalvar.disabled = novaResposta.length === 0;
            });
        }
        
        // Botão cancelar
        btnCancelar.addEventListener('click', () => {
            this.cancelarEdicao(elementoMensagem, itemHistorico);
        });
        
        // Botão salvar
        btnSalvar.addEventListener('click', () => {
            this.salvarEdicao(elementoMensagem, itemHistorico, novaResposta);
        });
    },

    /**
     * Cancela a edição e restaura a mensagem original
     */
    cancelarEdicao(elementoMensagem, itemHistorico) {
        // Restaurar mensagem original
        elementoMensagem.querySelector('.message').innerHTML = `
            <div class="response-content">
                <p>${itemHistorico.mensagemResposta}</p>
                <button class="btn-editar-resposta" onclick="BENETRIP.editarResposta('${itemHistorico.pergunta.key}', ${itemHistorico.perguntaIndex})">
                    ✏️ Editar
                </button>
            </div>
        `;
        
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
        
        // Atualizar resposta no estado
        this.estado.respostas[itemHistorico.pergunta.key] = novaResposta;
        
        // Atualizar histórico
        itemHistorico.resposta = novaResposta;
        
        // Formatar nova mensagem de resposta
        let novaMensagemResposta = '';
        if (itemHistorico.pergunta.options) {
            novaMensagemResposta = itemHistorico.pergunta.options[novaResposta];
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
