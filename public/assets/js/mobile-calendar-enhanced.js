/**
 * BENETRIP - CALENDÁRIO OTIMIZADO PARA MOBILE (VERSÃO CORRIGIDA)
 * Melhorias JavaScript para o componente Flatpickr em dispositivos móveis
 */

// Sobrescrever função de inicialização do calendário no BENETRIP
if (typeof BENETRIP !== 'undefined') {
    // Guardar referência da função original
    const inicializarCalendarioOriginal = BENETRIP.inicializarCalendario;
    
    // Sobrescrever com versão mobile-otimizada CORRIGIDA
    BENETRIP.inicializarCalendario = function(pergunta) {
        console.log("Iniciando calendário otimizado para mobile - VERSÃO CORRIGIDA");
        
        // Verificar se já foi inicializado
        if (this.estado.calendarioAtual) {
            console.log("Limpando calendário anterior");
            try {
                this.estado.calendarioAtual.destroy();
            } catch (e) {
                console.log("Erro ao destruir calendário anterior:", e);
            }
            this.estado.calendarioAtual = null;
        }
        
        // Usar ID fixo para evitar conflitos
        this.estado.currentCalendarId = 'benetrip-calendar-mobile-fixed';
        const calendarId = this.estado.currentCalendarId;
        
        console.log(`Usando ID fixo do calendário: ${calendarId}`);
        
        // Aguardar um pouco para garantir que o DOM esteja pronto
        setTimeout(() => {
            this.criarCalendarioMobileCorrigido(pergunta, calendarId);
        }, 100);
    };
    
    // Nova função para criar calendário corrigido
    BENETRIP.criarCalendarioMobileCorrigido = function(pergunta, calendarId) {
        console.log("Criando calendário mobile CORRIGIDO");
        
        try {
            // Verificar se o container existe
            let container = document.querySelector('.calendar-container');
            if (!container) {
                console.log("Container não encontrado, criando manualmente");
                container = this.criarContainerCalendarioCorrigido(calendarId);
            } else {
                // Limpar container existente
                this.limparContainerCalendario(container, calendarId);
            }
            
            // Adicionar classe de carregamento
            container.classList.add('calendar-loading');
            
            // Verificar se Flatpickr está disponível
            if (typeof flatpickr === 'undefined') {
                console.error("Flatpickr não encontrado, carregando dinamicamente");
                this.carregarFlatpickrParaMobile(pergunta, calendarId);
                return;
            }
            
            // Criar elemento do calendário
            let calendarElement = document.getElementById(calendarId);
            if (!calendarElement) {
                calendarElement = document.createElement('div');
                calendarElement.id = calendarId;
                calendarElement.className = 'flatpickr-mobile-calendar-fixed';
                
                // Inserir no início do container, antes dos elementos de seleção
                const dateSelection = container.querySelector('.date-selection');
                if (dateSelection) {
                    container.insertBefore(calendarElement, dateSelection);
                } else {
                    container.appendChild(calendarElement);
                }
            }
            
            // Configuração corrigida para mobile
            const configMobile = this.obterConfigMobileCorrigido(pergunta, calendarId);
            
            // Aguardar um frame para garantir que o elemento esteja no DOM
            requestAnimationFrame(() => {
                this.inicializarFlatpickrCorrigido(calendarElement, configMobile, container, calendarId);
            });
            
        } catch (erro) {
            console.error("Erro ao criar calendário mobile:", erro);
            this.tratarErroCalendarioCorrigido(container, erro);
        }
    };
    
    // Função para inicializar Flatpickr de forma corrigida
    BENETRIP.inicializarFlatpickrCorrigido = function(calendarElement, config, container, calendarId) {
        try {
            console.log("Inicializando Flatpickr corrigido");
            
            // Inicializar Flatpickr
            const calendario = flatpickr(calendarElement, config);
            
            // Verificar se foi inicializado corretamente
            if (!calendario || !calendario.calendarContainer) {
                throw new Error("Falha na inicialização do Flatpickr");
            }
            
            // Salvar referência
            this.estado.calendarioAtual = calendario;
            
            // Aplicar correções pós-inicialização
            setTimeout(() => {
                this.aplicarCorrecoesPosInicializacao(container, calendario, calendarId);
            }, 50);
            
            console.log("Flatpickr inicializado com sucesso");
            
        } catch (erro) {
            console.error("Erro ao inicializar Flatpickr:", erro);
            this.tratarErroCalendarioCorrigido(container, erro);
        }
    };
    
    // Função para obter configuração mobile corrigida
    BENETRIP.obterConfigMobileCorrigido = function(pergunta, calendarId) {
        // Detectar tipo de dispositivo
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent);
        const isTouch = 'ontouchstart' in window;
        
        // Data mínima (amanhã)
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        amanha.setHours(0, 0, 0, 0);
        
        return {
            // Configurações básicas CORRIGIDAS
            mode: "range",
            dateFormat: "Y-m-d",
            inline: true,
            static: true,
            
            // CORREÇÃO: Forçar exibição do mês
            showMonths: 1,
            enableTime: false,
            noCalendar: false,
            
            // Limites de data
            minDate: pergunta.calendar?.min_date || this.formatarDataISO(amanha),
            maxDate: pergunta.calendar?.max_date,
            
            // CORREÇÃO: Configurações que garantem a exibição correta
            monthSelectorType: 'dropdown',
            shorthandCurrentMonth: false,
            
            // Localização CORRIGIDA
            locale: {
                weekdays: {
                    shorthand: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
                    longhand: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
                },
                months: {
                    shorthand: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
                    longhand: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
                },
                rangeSeparator: ' até ',
                firstDayOfWeek: 0
            },
            
            // Desabilitar datas passadas
            disable: [
                function(date) {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    return date < hoje;
                }
            ],
            
            // Events otimizados
            onChange: (selectedDates, dateStr) => {
                this.processarMudancaDatasMobileCorrigido(selectedDates, calendarId);
            },
            
            onReady: (selectedDates, dateStr, instance) => {
                console.log("Flatpickr pronto, aplicando correções");
                this.aplicarEstilosMobilePosProntoCorrigido(instance, calendarId);
            },
            
            onMonthChange: (selectedDates, dateStr, instance) => {
                // Garantir que o mês seja exibido após mudança
                setTimeout(() => {
                    this.garantirExibicaoMes(instance);
                }, 10);
                
                // Feedback tátil
                if (navigator.vibrate && isTouch) {
                    navigator.vibrate(10);
                }
            },
            
            onYearChange: (selectedDates, dateStr, instance) => {
                // Garantir que o mês seja exibido após mudança de ano
                setTimeout(() => {
                    this.garantirExibicaoMes(instance);
                }, 10);
            },
            
            onDayCreate: (dObj, dStr, fp, dayElem) => {
                this.otimizarDiaParaMobileCorrigido(dayElem, dObj);
            }
        };
    };
    
    // NOVA função para garantir exibição do mês
    BENETRIP.garantirExibicaoMes = function(instance) {
        try {
            const monthElement = instance.monthNav;
            const currentMonthElement = instance.currentMonthElement;
            
            if (currentMonthElement) {
                currentMonthElement.style.display = 'inline-block';
                currentMonthElement.style.visibility = 'visible';
                currentMonthElement.style.opacity = '1';
            }
            
            // Garantir que o dropdown do mês seja visível
            const monthDropdown = instance.monthsDropdownContainer;
            if (monthDropdown) {
                monthDropdown.style.display = 'inline-block';
                monthDropdown.style.visibility = 'visible';
            }
            
            // Forçar re-render do header se necessário
            const monthsContainer = instance.monthNav;
            if (monthsContainer) {
                monthsContainer.style.display = 'flex';
                monthsContainer.style.justifyContent = 'center';
                monthsContainer.style.alignItems = 'center';
            }
            
        } catch (e) {
            console.log("Erro ao garantir exibição do mês:", e);
        }
    };
    
    // Função para processar mudanças de data CORRIGIDA
    BENETRIP.processarMudancaDatasMobileCorrigido = function(selectedDates, calendarId) {
        const dataIdaElement = document.getElementById(`data-ida-${calendarId}`);
        const dataVoltaElement = document.getElementById(`data-volta-${calendarId}`);
        const confirmarBtn = document.getElementById(`confirmar-datas-${calendarId}`);
        
        if (!dataIdaElement || !dataVoltaElement || !confirmarBtn) {
            console.error("Elementos de data não encontrados!");
            return;
        }
        
        // Feedback tátil para seleção
        if (navigator.vibrate && selectedDates.length > 0) {
            navigator.vibrate(15);
        }
        
        if (selectedDates.length === 0) {
            dataIdaElement.textContent = "Selecione";
            dataVoltaElement.textContent = "Selecione";
            confirmarBtn.disabled = true;
            confirmarBtn.textContent = "Selecione as datas";
            
        } else if (selectedDates.length === 1) {
            const dataFormatada = this.formatarDataVisivel(selectedDates[0]);
            dataIdaElement.textContent = dataFormatada;
            dataVoltaElement.textContent = "Selecione volta";
            confirmarBtn.disabled = true;
            confirmarBtn.textContent = "Selecione data de volta";
            
        } else if (selectedDates.length === 2) {
            const dataIdaFormatada = this.formatarDataVisivel(selectedDates[0]);
            const dataVoltaFormatada = this.formatarDataVisivel(selectedDates[1]);
            
            dataIdaElement.textContent = dataIdaFormatada;
            dataVoltaElement.textContent = dataVoltaFormatada;
            confirmarBtn.disabled = false;
            confirmarBtn.textContent = "Confirmar Datas";
            
            // Animação de feedback
            confirmarBtn.style.animation = 'pulse 0.5s ease-in-out';
            setTimeout(() => {
                confirmarBtn.style.animation = '';
            }, 500);
        }
    };
    
    // Função para otimizar cada dia CORRIGIDA
    BENETRIP.otimizarDiaParaMobileCorrigido = function(dayElem, dateObj) {
        // Atributos de acessibilidade
        dayElem.setAttribute('role', 'button');
        dayElem.setAttribute('tabindex', '0');
        
        // CORREÇÃO: Garantir área de toque mínima
        dayElem.style.minWidth = '36px';
        dayElem.style.minHeight = '36px';
        dayElem.style.display = 'flex';
        dayElem.style.alignItems = 'center';
        dayElem.style.justifyContent = 'center';
        
        // Touch events otimizados
        let touchStartTime = 0;
        
        dayElem.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touchStartTime = Date.now();
            dayElem.style.transform = 'scale(0.95)';
            
            if (navigator.vibrate) {
                navigator.vibrate(5);
            }
        }, { passive: false });
        
        dayElem.addEventListener('touchend', (e) => {
            e.preventDefault();
            dayElem.style.transform = '';
            
            const touchDuration = Date.now() - touchStartTime;
            if (touchDuration < 200) {
                this.aplicarEfeitoSelecaoMobileCorrigido(dayElem);
            }
        }, { passive: false });
        
        dayElem.addEventListener('touchcancel', () => {
            dayElem.style.transform = '';
        }, { passive: true });
    };
    
    // Função para aplicar efeito visual de seleção CORRIGIDA
    BENETRIP.aplicarEfeitoSelecaoMobileCorrigido = function(elemento) {
        const ripple = document.createElement('span');
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background-color: rgba(232, 119, 34, 0.3);
            transform: scale(0);
            animation: ripple-mobile 0.4s linear;
            left: 50%;
            top: 50%;
            width: 30px;
            height: 30px;
            margin-left: -15px;
            margin-top: -15px;
            pointer-events: none;
            z-index: 10;
        `;
        
        elemento.style.position = 'relative';
        elemento.style.overflow = 'hidden';
        elemento.appendChild(ripple);
        
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 400);
    };
    
    // Função para aplicar correções pós-inicialização
    BENETRIP.aplicarCorrecoesPosInicializacao = function(container, calendario, calendarId) {
        console.log("Aplicando correções pós-inicialização");
        
        try {
            // Ocultar elementos problemáticos
            const problematicContainers = container.querySelectorAll('.flatpickr-calendar-container');
            problematicContainers.forEach(el => {
                el.style.cssText = 'display: none !important; height: 0 !important; overflow: hidden !important;';
            });
            
            // Garantir que o calendário principal esteja visível e com largura correta
            const mainCalendar = calendario.calendarContainer;
            if (mainCalendar) {
                mainCalendar.style.cssText = `
                    display: inline-block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                    overflow-x: hidden !important;
                `;
                
                // CORREÇÃO ESPECÍFICA: Garantir que o mês seja exibido
                this.garantirExibicaoMes(calendario);
            }
            
            // Otimizar botões de navegação
            const navButtons = container.querySelectorAll('.flatpickr-prev-month, .flatpickr-next-month');
            navButtons.forEach(btn => {
                btn.style.minWidth = '36px';
                btn.style.minHeight = '36px';
                
                btn.addEventListener('touchstart', () => {
                    btn.style.transform = 'translateY(-50%) scale(0.9)';
                }, { passive: true });
                
                btn.addEventListener('touchend', () => {
                    btn.style.transform = 'translateY(-50%)';
                }, { passive: true });
            });
            
            // Configurar evento do botão de confirmação
            this.configurarEventosBotaoConfirmacao(calendario, calendarId);
            
            // Remover indicador de carregamento
            container.classList.remove('calendar-loading');
            container.classList.add('calendar-initialized');
            
            // Força redimensionamento para garantir layout correto
            setTimeout(() => {
                this.forcarRedimensionamentoCalendario(calendario);
            }, 100);
            
        } catch (erro) {
            console.error("Erro ao aplicar correções:", erro);
        }
    };
    
    // NOVA função para forçar redimensionamento
    BENETRIP.forcarRedimensionamentoCalendario = function(calendario) {
        try {
            if (calendario && calendario.calendarContainer) {
                const container = calendario.calendarContainer;
                
                // Forçar recálculo do layout
                container.style.width = '99.9%';
                
                requestAnimationFrame(() => {
                    container.style.width = '100%';
                });
                
                // Garantir que os dias tenham largura correta
                const days = container.querySelectorAll('.flatpickr-day');
                days.forEach(day => {
                    day.style.width = 'calc(14.28% - 2px)';
                    day.style.maxWidth = 'calc(14.28% - 2px)';
                });
            }
        } catch (e) {
            console.log("Erro ao forçar redimensionamento:", e);
        }
    };
    
    // Função para configurar eventos do botão de confirmação
    BENETRIP.configurarEventosBotaoConfirmacao = function(calendario, calendarId) {
        const confirmarBtn = document.getElementById(`confirmar-datas-${calendarId}`);
        
        if (confirmarBtn) {
            // Remover listeners antigos
            const novoBtn = confirmarBtn.cloneNode(true);
            confirmarBtn.parentNode.replaceChild(novoBtn, confirmarBtn);
            
            // Adicionar novo listener
            novoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                
                try {
                    const datas = calendario.selectedDates;
                    if (datas.length === 2) {
                        // Feedback tátil
                        if (navigator.vibrate) {
                            navigator.vibrate([50, 50, 100]);
                        }
                        
                        const dadosDatas = this.processarDatasParaRespostaCorrigido(datas);
                        const pergunta = this.estado.perguntas[this.estado.perguntaAtual];
                        
                        if (pergunta) {
                            novoBtn.disabled = true;
                            novoBtn.textContent = "Processando...";
                            
                            setTimeout(() => {
                                this.processarResposta(dadosDatas, pergunta);
                            }, 100);
                        }
                    } else {
                        this.mostrarFeedbackErroCorrigido("Por favor, selecione as datas de ida e volta");
                    }
                } catch (erro) {
                    console.error("Erro ao processar datas:", erro);
                    this.mostrarFeedbackErroCorrigido("Erro ao processar datas. Tente novamente.");
                }
            });
            
            // Touch feedback
            novoBtn.addEventListener('touchstart', () => {
                if (!novoBtn.disabled) {
                    novoBtn.style.transform = 'scale(0.98)';
                }
            }, { passive: true });
            
            novoBtn.addEventListener('touchend', () => {
                novoBtn.style.transform = '';
            }, { passive: true });
        }
    };
    
    // Função para processar datas CORRIGIDA
    BENETRIP.processarDatasParaRespostaCorrigido = function(datas) {
        try {
            return {
                dataIda: this.formatarDataISO(datas[0]),
                dataVolta: this.formatarDataISO(datas[1])
            };
        } catch (erro) {
            console.error("Erro ao processar datas:", erro);
            throw new Error("Falha ao processar datas selecionadas");
        }
    };
    
    // Função para mostrar feedback de erro CORRIGIDA
    BENETRIP.mostrarFeedbackErroCorrigido = function(mensagem) {
        if (this.exibirToast) {
            this.exibirToast(mensagem, 'warning');
        } else {
            console.warn(mensagem);
        }
        
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 100]);
        }
    };
    
    // Função para limpar container do calendário
    BENETRIP.limparContainerCalendario = function(container, calendarId) {
        // Atualizar IDs dos elementos existentes
        const dataIdaElement = container.querySelector('.date-selection p:first-child span');
        const dataVoltaElement = container.querySelector('.date-selection p:last-child span');
        const confirmarBtn = container.querySelector('.confirm-button');
        
        if (dataIdaElement) dataIdaElement.id = `data-ida-${calendarId}`;
        if (dataVoltaElement) dataVoltaElement.id = `data-volta-${calendarId}`;
        if (confirmarBtn) confirmarBtn.id = `confirmar-datas-${calendarId}`;
        
        // Remover calendários antigos
        const oldCalendars = container.querySelectorAll('[id*="calendar"]');
        oldCalendars.forEach(el => {
            if (el.id !== calendarId) {
                el.remove();
            }
        });
    };
    
    // Função para criar container CORRIGIDO
    BENETRIP.criarContainerCalendarioCorrigido = function(calendarId) {
        const mensagens = document.querySelectorAll('.chat-message.tripinha');
        if (mensagens.length === 0) {
            throw new Error("Nenhuma mensagem encontrada para adicionar calendário");
        }
        
        const ultimaMensagem = mensagens[mensagens.length - 1];
        const containerMensagem = ultimaMensagem.querySelector('.message');
        
        if (!containerMensagem) {
            throw new Error("Container de mensagem não encontrado");
        }
        
        const calendarHTML = `
            <div class="calendar-container" data-calendar-container="${calendarId}">
                <div class="date-selection">
                    <p>Ida:<br><span id="data-ida-${calendarId}">Selecione</span></p>
                    <p>Volta:<br><span id="data-volta-${calendarId}">Selecione</span></p>
                </div>
                <button id="confirmar-datas-${calendarId}" class="confirm-button confirm-dates" disabled>
                    Selecione as datas
                </button>
            </div>
        `;
        
        containerMensagem.insertAdjacentHTML('beforeend', calendarHTML);
        return containerMensagem.querySelector('.calendar-container');
    };
    
    // Função para aplicar estilos pós-pronto CORRIGIDA
    BENETRIP.aplicarEstilosMobilePosProntoCorrigido = function(instance, calendarId) {
        setTimeout(() => {
            try {
                const calendar = instance.calendarContainer;
                if (calendar) {
                    calendar.classList.add('mobile-optimized');
                    
                    // CORREÇÃO: Aplicar estilos de largura forçadamente
                    calendar.style.cssText += `
                        width: 100% !important;
                        max-width: 100% !important;
                        min-width: 280px !important;
                        overflow-x: hidden !important;
                        box-sizing: border-box !important;
                    `;
                    
                    // Garantir exibição do mês
                    this.garantirExibicaoMes(instance);
                }
            } catch (e) {
                console.log("Erro ao aplicar estilos pós-pronto:", e);
            }
        }, 50);
    };
    
    // Função para tratar erros CORRIGIDA
    BENETRIP.tratarErroCalendarioCorrigido = function(container, erro) {
        console.error("Erro no calendário mobile:", erro);
        
        if (container) {
            container.classList.remove('calendar-loading');
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #e74c3c; font-family: 'Poppins', sans-serif;">
                    <p style="margin: 0 0 15px 0;">❌ Erro ao carregar calendário</p>
                    <button onclick="location.reload()" style="background: #e74c3c; color: white; border: none; padding: 12px 20px; border-radius: 20px; font-family: 'Poppins', sans-serif; cursor: pointer;">
                        Tentar Novamente
                    </button>
                </div>
            `;
        }
    };
}

// Adicionar CSS para animações se não existir
if (!document.querySelector('#mobile-calendar-animations-fixed')) {
    const style = document.createElement('style');
    style.id = 'mobile-calendar-animations-fixed';
    style.textContent = `
        @keyframes ripple-mobile {
            to {
                transform: scale(2);
                opacity: 0;
            }
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .flatpickr-mobile-calendar-fixed {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: hidden !important;
        }
        
        .mobile-optimized {
            font-family: 'Poppins', sans-serif !important;
        }
        
        /* CORREÇÃO ADICIONAL: Garantir que o calendário não transborde */
        .flatpickr-calendar.mobile-optimized {
            max-width: calc(100vw - 40px) !important;
            width: 100% !important;
        }
        
        .flatpickr-calendar.mobile-optimized .flatpickr-months {
            width: 100% !important;
        }
        
        .flatpickr-calendar.mobile-optimized .flatpickr-days {
            width: 100% !important;
        }
        
        .flatpickr-calendar.mobile-optimized .dayContainer {
            width: 100% !important;
            max-width: 100% !important;
        }
    `;
    document.head.appendChild(style);
}

// Log de inicialização
console.log("Otimizações mobile CORRIGIDAS para calendário carregadas com sucesso!");

// Função adicional para debug em desenvolvimento
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.debugCalendario = function() {
        if (BENETRIP && BENETRIP.estado && BENETRIP.estado.calendarioAtual) {
            const cal = BENETRIP.estado.calendarioAtual;
            console.log("Estado do calendário:", {
                selectedDates: cal.selectedDates,
                currentMonth: cal.currentMonth,
                currentYear: cal.currentYear,
                container: cal.calendarContainer,
                config: cal.config
            });
        } else {
            console.log("Calendário não inicializado");
        }
    };
}
