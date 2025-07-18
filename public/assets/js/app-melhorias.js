/**
 * BENETRIP - App.js Otimizado para Fluidez
 * Principais otimizações a serem aplicadas no código existente
 */

// ===== 1. OTIMIZAÇÃO DA FUNÇÃO mostrarProximaPergunta =====
BENETRIP.mostrarProximaPergunta = function() {
    // Performance mark para monitoramento
    BENETRIP_CHAT_OPTIMIZED.performanceMonitor.mark('showQuestion_start');
    
    if (this.estado.perguntaAtual >= this.estado.perguntas.length) {
        this.finalizarQuestionario();
        return;
    }

    const pergunta = this.estado.perguntas[this.estado.perguntaAtual];

    if (pergunta.conditional && !this.deveExibirPerguntaCondicional(pergunta)) {
        this.estado.perguntaAtual++;
        // Chamada recursiva otimizada com requestAnimationFrame
        requestAnimationFrame(() => this.mostrarProximaPergunta());
        return;
    }

    // Usar requestAnimationFrame para melhor performance
    requestAnimationFrame(() => {
        const mensagemHTML = this.montarHTMLPergunta(pergunta);
        const chatMessages = document.getElementById('chat-messages');
        
        // Usar insertAdjacentHTML para melhor performance
        chatMessages.insertAdjacentHTML('beforeend', mensagemHTML);
        
        // Scroll otimizado
        BENETRIP_CHAT_OPTIMIZED.smoothScrollToBottom();
        
        // Configurar eventos de forma assíncrona
        setTimeout(() => {
            this.configurarEventosPergunta(pergunta);
            BENETRIP_CHAT_OPTIMIZED.performanceMonitor.measure('showQuestion', 'showQuestion_start');
        }, 0);
    });
};

// ===== 2. OTIMIZAÇÃO DA FUNÇÃO processarResposta =====
BENETRIP.processarResposta = function(valor, pergunta) {
    // Feedback tátil imediato
    BENETRIP_CHAT_OPTIMIZED.hapticFeedback('light');
    
    // Armazenar resposta
    this.estado.respostas[pergunta.key] = valor;
    
    // Mostrar resposta do usuário de forma otimizada
    this.mostrarRespostaUsuarioOtimizada(valor, pergunta);
    
    if (pergunta.key === 'conhece_destino') {
        this.estado.fluxo = valor === 0 ? 'destino_conhecido' : 'destino_desconhecido';
    }
    
    this.estado.perguntaAtual++;
    
    if (this.verificarLimitePerguntas()) {
        this.finalizarQuestionario();
        return;
    }
    
    // Transição otimizada usando requestAnimationFrame
    requestAnimationFrame(() => {
        setTimeout(() => {
            this.mostrarProximaPergunta();
        }, BENETRIP_CHAT_OPTIMIZED.config.messageDelay);
    });
};

// ===== 3. NOVA FUNÇÃO OTIMIZADA PARA RESPOSTA DO USUÁRIO =====
BENETRIP.mostrarRespostaUsuarioOtimizada = function(valor, pergunta) {
    let mensagemResposta = '';
    
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
        mensagemResposta = `✈️ ${formatarDataVisual(valor.dataIda)} → ${formatarDataVisual(valor.dataVolta)}`;
    } else if (pergunta.autocomplete) {
        mensagemResposta = `📍 ${valor.name} (${valor.code}), ${valor.country}`;
    } else {
        mensagemResposta = valor.toString();
    }
    
    // Criar mensagem usando DocumentFragment para melhor performance
    const fragment = document.createDocumentFragment();
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message user';
    messageDiv.innerHTML = `
        <div class="message">
            <p>${mensagemResposta}</p>
        </div>
    `;
    
    fragment.appendChild(messageDiv);
    
    // Adicionar feedback visual
    BENETRIP_CHAT_OPTIMIZED.addVisualFeedback(messageDiv, 'success');
    
    // Adicionar ao chat de forma otimizada
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(fragment);
    
    // Scroll suave
    BENETRIP_CHAT_OPTIMIZED.smoothScrollToBottom();
};

// ===== 4. OTIMIZAÇÃO DO CALENDÁRIO =====
BENETRIP.inicializarCalendarioOtimizado = async function(pergunta) {
    console.log("Inicializando calendário otimizado");
    
    if (this.estado.calendarioAtual) {
        console.log("Calendário já inicializado");
        return;
    }
    
    this.estado.currentCalendarId = 'benetrip-calendar-principal';
    const calendarId = this.estado.currentCalendarId;
    
    // Aguardar que o elemento esteja disponível
    const waitForElement = (selector, timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const element = document.getElementById(selector);
            if (element) {
                resolve(element);
                return;
            }
            
            const observer = new MutationObserver((mutations) => {
                const element = document.getElementById(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            setTimeout(() => {
                observer.disconnect();
                reject(new Error('Element not found'));
            }, timeout);
        });
    };
    
    try {
        const calendarElement = await waitForElement(calendarId);
        
        // Garantir que Flatpickr está carregado
        if (typeof flatpickr === 'undefined') {
            await BENETRIP_CHAT_OPTIMIZED.loadFlatpickr();
        }
        
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        
        const calendar = await BENETRIP_CHAT_OPTIMIZED.initOptimizedCalendar(calendarId, {
            mode: "range",
            dateFormat: "Y-m-d",
            minDate: this.formatarDataISO(amanha),
            maxDate: pergunta.calendar?.max_date,
            inline: true,
            locale: {
                weekdays: {
                    shorthand: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
                    longhand: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
                },
                months: {
                    shorthand: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
                    longhand: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
                }
            },
            onChange: (selectedDates) => {
                this.atualizarExibicaoDatas(selectedDates, calendarId);
            }
        });
        
        this.estado.calendarioAtual = calendar;
        this.configurarBotaoConfirmacaoDatas(calendarId, pergunta);
        
    } catch (error) {
        console.error("Erro ao inicializar calendário:", error);
        this.exibirToast("Erro ao carregar calendário. Tente recarregar a página.", "error");
    }
};

// ===== 5. FUNÇÃO AUXILIAR PARA ATUALIZAR DATAS =====
BENETRIP.atualizarExibicaoDatas = function(selectedDates, calendarId) {
    const dataIdaElement = document.getElementById(`data-ida-${calendarId}`);
    const dataVoltaElement = document.getElementById(`data-volta-${calendarId}`);
    const confirmarBtn = document.getElementById(`confirmar-datas-${calendarId}`);
    
    if (!dataIdaElement || !dataVoltaElement || !confirmarBtn) return;
    
    // Usar requestAnimationFrame para animações suaves
    requestAnimationFrame(() => {
        if (selectedDates.length === 0) {
            dataIdaElement.textContent = "Selecione";
            dataVoltaElement.textContent = "Selecione";
            confirmarBtn.disabled = true;
        } else if (selectedDates.length === 1) {
            dataIdaElement.textContent = this.formatarDataVisivel(selectedDates[0]);
            dataVoltaElement.textContent = "Selecione";
            confirmarBtn.disabled = true;
            // Feedback visual
            BENETRIP_CHAT_OPTIMIZED.addVisualFeedback(dataIdaElement.parentElement, 'success');
        } else if (selectedDates.length === 2) {
            dataIdaElement.textContent = this.formatarDataVisivel(selectedDates[0]);
            dataVoltaElement.textContent = this.formatarDataVisivel(selectedDates[1]);
            confirmarBtn.disabled = false;
            // Feedback visual e tátil
            BENETRIP_CHAT_OPTIMIZED.addVisualFeedback(dataVoltaElement.parentElement, 'success');
            BENETRIP_CHAT_OPTIMIZED.hapticFeedback('medium');
        }
    });
};

// ===== 6. OTIMIZAÇÃO DO AUTOCOMPLETE =====
BENETRIP.configurarAutocompleteOtimizado = function(pergunta) {
    const autocompleteId = this.estado.currentAutocompleteId;
    if (!autocompleteId) return;
    
    const input = document.getElementById(autocompleteId);
    const confirmBtn = document.getElementById(`${autocompleteId}-confirm`);
    
    if (!input || !confirmBtn) return;
    
    let selectedItem = null;
    
    // Função de busca otimizada
    const searchFunction = async (query, options = {}) => {
        if (window.BENETRIP_API) {
            return await window.BENETRIP_API.buscarSugestoesCidade(query);
        }
        
        // Fallback com dados simulados
        return [
            { type: "city", code: "SAO", name: "São Paulo", country_code: "BR", country_name: "Brasil" },
            { type: "city", code: "RIO", name: "Rio de Janeiro", country_code: "BR", country_name: "Brasil" }
        ].filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
    };
    
    // Usar autocomplete otimizado
    BENETRIP_CHAT_OPTIMIZED.optimizedAutocomplete(input, searchFunction);
    
    // Configurar seleção de item
    input.addEventListener('focus', () => {
        BENETRIP_CHAT_OPTIMIZED.addMicroInteraction(input, 'focus');
    });
    
    confirmBtn.addEventListener('click', () => {
        if (selectedItem) {
            BENETRIP_CHAT_OPTIMIZED.hapticFeedback('medium');
            this.processarResposta(selectedItem, pergunta);
        }
    });
    
    // Auto-focus otimizado
    requestAnimationFrame(() => {
        input.focus();
    });
};

// ===== 7. OTIMIZAÇÃO DA BARRA DE PROGRESSO =====
BENETRIP.atualizarBarraProgressoOtimizada = function(porcentagem, mensagem) {
    requestAnimationFrame(() => {
        const progressBar = document.querySelector('.progress-bar');
        const progressText = document.querySelector('.progress-text');
        
        if (progressBar && progressText) {
            // Animação suave da barra
            progressBar.style.width = `${porcentagem}%`;
            progressText.textContent = mensagem || 'Processando...';
            
            // Feedback visual quando completa
            if (porcentagem >= 100) {
                BENETRIP_CHAT_OPTIMIZED.hapticFeedback('double');
                setTimeout(() => {
                    document.querySelectorAll('.progress-container').forEach(el => {
                        el.style.transition = 'opacity 0.3s ease';
                        el.style.opacity = '0';
                    });
                }, 500);
            }
        }
    });
};

// ===== 8. SISTEMA DE TOAST OTIMIZADO =====
BENETRIP.exibirToastOtimizado = function(mensagem, tipo = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensagem;
    
    // Feedback tátil baseado no tipo
    const hapticMap = { error: 'heavy', success: 'medium', warning: 'light', info: 'light' };
    BENETRIP_CHAT_OPTIMIZED.hapticFeedback(hapticMap[tipo]);
    
    toastContainer.appendChild(toast);
    
    // Animação de entrada
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Remoção otimizada
    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => {
            toast.remove();
        }, { once: true });
    }, 3000);
};

// ===== 9. SUBSTITUIÇÃO DA FUNÇÃO ORIGINAL DE SCROLL =====
BENETRIP.rolarParaFinal = BENETRIP_CHAT_OPTIMIZED.smoothScrollToBottom;

// ===== 10. OTIMIZAÇÃO DOS DELAYS =====
BENETRIP.config.animationDelay = BENETRIP_CHAT_OPTIMIZED.config.messageDelay;

// ===== 11. INICIALIZAÇÃO OTIMIZADA =====
const originalInit = BENETRIP.init;
BENETRIP.init = function() {
    // Pré-carregamento de recursos
    BENETRIP_CHAT_OPTIMIZED.preloadResources();
    
    // Configurar observador de performance
    if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.duration > 100) {
                    console.warn(`Performance: ${entry.name} took ${entry.duration}ms`);
                }
            }
        });
        observer.observe({ entryTypes: ['measure'] });
    }
    
    // Chamar inicialização original
    return originalInit.call(this);
};

// ===== 12. EXPORTAR MELHORIAS =====
window.BENETRIP_OPTIMIZATIONS_APPLIED = true;
console.log("✅ Otimizações de fluidez aplicadas ao BENETRIP");
