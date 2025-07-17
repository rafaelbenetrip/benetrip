/**
 * BENETRIP - CALENDÁRIO OTIMIZADO PARA MOBILE
 * Melhorias JavaScript para o componente Flatpickr em dispositivos móveis
 */

// Sobrescrever função de inicialização do calendário no BENETRIP
if (typeof BENETRIP !== 'undefined') {
    // Guardar referência da função original
    const inicializarCalendarioOriginal = BENETRIP.inicializarCalendario;
    
    // Sobrescrever com versão mobile-otimizada
    BENETRIP.inicializarCalendario = function(pergunta) {
        console.log("Iniciando calendário otimizado para mobile");
        
        // Verificar se já foi inicializado
        if (this.estado.calendarioAtual) {
            console.log("Calendário já inicializado, limpando instância anterior");
            this.estado.calendarioAtual.destroy();
            this.estado.calendarioAtual = null;
        }
        
        // Usar ID fixo para evitar conflitos
        this.estado.currentCalendarId = 'benetrip-calendar-mobile';
        const calendarId = this.estado.currentCalendarId;
        
        // Aguardar um pouco para garantir que o DOM esteja pronto
        setTimeout(() => {
            this.criarCalendarioMobileOtimizado(pergunta, calendarId);
        }, 200);
    };
    
    // Nova função para criar calendário otimizado
    BENETRIP.criarCalendarioMobileOtimizado = function(pergunta, calendarId) {
        console.log("Criando calendário mobile-otimizado");
        
        // Verificar se o container existe
        let container = document.querySelector('.calendar-container');
        if (!container) {
            console.log("Container não encontrado, criando manualmente");
            container = this.criarContainerCalendario(calendarId);
        }
        
        // Adicionar classe de carregamento
        container.classList.add('calendar-loading');
        
        // Verificar se Flatpickr está disponível
        if (typeof flatpickr === 'undefined') {
            console.error("Flatpickr não encontrado, carregando dinamicamente");
            this.carregarFlatpickrParaMobile(pergunta, calendarId);
            return;
        }
        
        // Criar elemento do calendário se não existir
        let calendarElement = document.getElementById(calendarId);
        if (!calendarElement) {
            calendarElement = document.createElement('div');
            calendarElement.id = calendarId;
            calendarElement.className = 'flatpickr-mobile-calendar';
            container.appendChild(calendarElement);
        }
        
        // Configuração otimizada para mobile
        const configMobile = this.obterConfigMobile(pergunta, calendarId);
        
        try {
            // Inicializar Flatpickr
            const calendario = flatpickr(calendarElement, configMobile);
            
            // Salvar referência
            this.estado.calendarioAtual = calendario;
            
            // Aplicar otimizações pós-inicialização
            this.aplicarOtimizacoesPosInicializacao(container, calendario, calendarId);
            
            // Configurar eventos mobile
            this.configurarEventosMobile(calendario, calendarId);
            
            // Remover indicador de carregamento
            container.classList.remove('calendar-loading');
            container.classList.add('calendar-initialized');
            
            console.log("Calendário mobile inicializado com sucesso");
            
        } catch (erro) {
            console.error("Erro ao inicializar calendário mobile:", erro);
            this.tratarErroCalendario(container, erro);
        }
    };
    
    // Função para obter configuração mobile-otimizada
    BENETRIP.obterConfigMobile = function(pergunta, calendarId) {
        // Detectar tipo de dispositivo
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isTouch = 'ontouchstart' in window;
        
        // Data mínima (amanhã)
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        amanha.setHours(0, 0, 0, 0);
        
        return {
            // Configurações básicas
            mode: "range",
            dateFormat: "Y-m-d",
            inline: true,
            static: true, // Previne problemas de posicionamento
            
            // Limites de data
            minDate: pergunta.calendar?.min_date || this.formatarDataISO(amanha),
            maxDate: pergunta.calendar?.max_date,
            
            // Otimizações mobile
            animate: false, // Desabilitar animações para melhor performance
            monthSelectorType: 'static', // Mais estável em mobile
            showMonths: 1, // Sempre mostrar apenas 1 mês
            
            // Localização
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
                firstDayOfWeek: 0 // Domingo
            },
            
            // Desabilitar datas passadas
            disable: [
                function(date) {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    return date < hoje;
                }
            ],
            
            // Events otimizados para mobile
            onChange: (selectedDates, dateStr) => {
                this.processarMudancaDatasMobile(selectedDates, calendarId);
            },
            
            onReady: () => {
                this.aplicarEstilosMobilePosPronto(calendarId);
            },
            
            onMonthChange: () => {
                // Feedback tátil ao mudar mês (se disponível)
                if (navigator.vibrate && isTouch) {
                    navigator.vibrate(10);
                }
            },
            
            onDayCreate: (dObj, dStr, fp, dayElem) => {
                // Melhorar acessibilidade e touch
                this.otimizarDiaParaMobile(dayElem, dObj);
            }
        };
    };
    
    // Função para processar mudanças de data em mobile
    BENETRIP.processarMudancaDatasMobile = function(selectedDates, calendarId) {
        const dataIdaElement = document.getElementById(`data-ida-${calendarId}`);
        const dataVoltaElement = document.getElementById(`data-volta-${calendarId}`);
        const confirmarBtn = document.getElementById(`confirmar-datas-${calendarId}`);
        
        if (!dataIdaElement || !dataVoltaElement || !confirmarBtn) {
            console.error("Elementos de data não encontrados para mobile!");
            return;
        }
        
        // Feedback tátil para seleção
        if (navigator.vibrate && selectedDates.length > 0) {
            navigator.vibrate(15); // Vibração um pouco mais longa para feedback de seleção
        }
        
        // Processar estados baseado na quantidade de datas selecionadas
        if (selectedDates.length === 0) {
            // Nenhuma data selecionada
            dataIdaElement.textContent = "Selecione";
            dataVoltaElement.textContent = "Selecione";
            confirmarBtn.disabled = true;
            confirmarBtn.textContent = "Selecione as datas";
            
        } else if (selectedDates.length === 1) {
            // Apenas data de ida selecionada
            const dataFormatada = this.formatarDataVisivel(selectedDates[0]);
            dataIdaElement.textContent = dataFormatada;
            dataVoltaElement.textContent = "Selecione volta";
            confirmarBtn.disabled = true;
            confirmarBtn.textContent = "Selecione data de volta";
            
        } else if (selectedDates.length === 2) {
            // Ambas as datas selecionadas
            const dataIdaFormatada = this.formatarDataVisivel(selectedDates[0]);
            const dataVoltaFormatada = this.formatarDataVisivel(selectedDates[1]);
            
            dataIdaElement.textContent = dataIdaFormatada;
            dataVoltaElement.textContent = dataVoltaFormatada;
            confirmarBtn.disabled = false;
            confirmarBtn.textContent = "Confirmar Datas";
            
            // Feedback visual adicional
            confirmarBtn.style.animation = 'pulse 0.5s ease-in-out';
            setTimeout(() => {
                confirmarBtn.style.animation = '';
            }, 500);
        }
    };
    
    // Função para otimizar cada dia do calendário
    BENETRIP.otimizarDiaParaMobile = function(dayElem, dateObj) {
        // Adicionar atributos de acessibilidade
        dayElem.setAttribute('role', 'button');
        dayElem.setAttribute('tabindex', '0');
        
        // Melhorar área de toque
        dayElem.style.minWidth = '44px';
        dayElem.style.minHeight = '44px';
        
        // Adicionar eventos de touch otimizados
        let touchStartTime = 0;
        
        dayElem.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            dayElem.style.transform = 'scale(0.95)';
            
            // Feedback tátil sutil
            if (navigator.vibrate) {
                navigator.vibrate(5);
            }
        }, { passive: true });
        
        dayElem.addEventListener('touchend', (e) => {
            dayElem.style.transform = '';
            
            // Verificar se foi um tap rápido (não um hold)
            const touchDuration = Date.now() - touchStartTime;
            if (touchDuration < 200) {
                // Aplicar efeito visual de seleção
                this.aplicarEfeitoSelecaoMobile(dayElem);
            }
        }, { passive: true });
        
        dayElem.addEventListener('touchcancel', () => {
            dayElem.style.transform = '';
        }, { passive: true });
    };
    
    // Função para aplicar efeito visual de seleção
    BENETRIP.aplicarEfeitoSelecaoMobile = function(elemento) {
        // Criar efeito ripple simples
        elemento.style.position = 'relative';
        elemento.style.overflow = 'hidden';
        
        const ripple = document.createElement('span');
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.backgroundColor = 'rgba(232, 119, 34, 0.3)';
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple-mobile 0.4s linear';
        ripple.style.left = '50%';
        ripple.style.top = '50%';
        ripple.style.width = '40px';
        ripple.style.height = '40px';
        ripple.style.marginLeft = '-20px';
        ripple.style.marginTop = '-20px';
        ripple.style.pointerEvents = 'none';
        
        elemento.appendChild(ripple);
        
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 400);
    };
    
    // Função para aplicar otimizações pós-inicialização
    BENETRIP.aplicarOtimizacoesPosInicializacao = function(container, calendario, calendarId) {
        // Ocultar elementos problemáticos
        const problematicContainers = container.querySelectorAll('.flatpickr-calendar-container');
        problematicContainers.forEach(el => {
            el.style.display = 'none';
            el.style.height = '0';
            el.style.overflow = 'hidden';
        });
        
        // Garantir que o calendário principal esteja visível
        const mainCalendar = container.querySelector('.flatpickr-calendar');
        if (mainCalendar) {
            mainCalendar.style.display = 'inline-block';
            mainCalendar.style.visibility = 'visible';
            mainCalendar.style.opacity = '1';
        }
        
        // Otimizar navegação por touch
        const navButtons = container.querySelectorAll('.flatpickr-prev-month, .flatpickr-next-month');
        navButtons.forEach(btn => {
            btn.style.minWidth = '44px';
            btn.style.minHeight = '44px';
            
            // Melhorar feedback visual
            btn.addEventListener('touchstart', () => {
                btn.style.transform = 'scale(0.9)';
            }, { passive: true });
            
            btn.addEventListener('touchend', () => {
                btn.style.transform = '';
            }, { passive: true });
        });
    };
    
    // Função para configurar eventos específicos para mobile
    BENETRIP.configurarEventosMobile = function(calendario, calendarId) {
        const confirmarBtn = document.getElementById(`confirmar-datas-${calendarId}`);
        
        if (confirmarBtn) {
            // Remover event listeners antigos
            const novoBtn = confirmarBtn.cloneNode(true);
            confirmarBtn.parentNode.replaceChild(novoBtn, confirmarBtn);
            
            // Adicionar novo event listener otimizado
            novoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                
                try {
                    const datas = calendario.selectedDates;
                    if (datas.length === 2) {
                        // Feedback tátil de confirmação
                        if (navigator.vibrate) {
                            navigator.vibrate([50, 50, 100]); // Padrão de confirmação
                        }
                        
                        // Processar datas com método otimizado
                        const dadosDatas = this.processarDatasParaResposta(datas);
                        
                        // Buscar pergunta atual
                        const pergunta = this.estado.perguntas[this.estado.perguntaAtual];
                        
                        if (pergunta) {
                            // Desabilitar botão temporariamente para evitar cliques duplos
                            novoBtn.disabled = true;
                            novoBtn.textContent = "Processando...";
                            
                            // Processar resposta
                            setTimeout(() => {
                                this.processarResposta(dadosDatas, pergunta);
                            }, 100);
                        }
                    } else {
                        // Mostrar feedback de erro
                        this.mostrarFeedbackErro("Por favor, selecione as datas de ida e volta");
                    }
                } catch (erro) {
                    console.error("Erro ao processar datas:", erro);
                    this.mostrarFeedbackErro("Erro ao processar datas. Tente novamente.");
                }
            });
            
            // Melhorar feedback visual do botão
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
    
    // Função para processar datas de forma segura
    BENETRIP.processarDatasParaResposta = function(datas) {
        try {
            const dataIda = datas[0];
            const dataVolta = datas[1];
            
            // Processar datas de forma mais robusta
            const dadosDatas = {
                dataIda: this.formatarDataISO(dataIda),
                dataVolta: this.formatarDataISO(dataVolta)
            };
            
            console.log("Datas processadas para mobile:", dadosDatas);
            return dadosDatas;
            
        } catch (erro) {
            console.error("Erro ao processar datas:", erro);
            throw new Error("Falha ao processar datas selecionadas");
        }
    };
    
    // Função para mostrar feedback de erro
    BENETRIP.mostrarFeedbackErro = function(mensagem) {
        // Usar sistema de toast se disponível
        if (this.exibirToast) {
            this.exibirToast(mensagem, 'warning');
        } else {
            // Fallback para alert
            alert(mensagem);
        }
        
        // Feedback tátil de erro
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 100]); // Padrão de erro
        }
    };
    
    // Função para criar container do calendário
    BENETRIP.criarContainerCalendario = function(calendarId) {
        const mensagens = document.querySelectorAll('.chat-message.tripinha');
        if (mensagens.length === 0) {
            throw new Error("Nenhuma mensagem encontrada para adicionar calendário");
        }
        
        const ultimaMensagem = mensagens[mensagens.length - 1];
        const containerMensagem = ultimaMensagem.querySelector('.message');
        
        if (!containerMensagem) {
            throw new Error("Container de mensagem não encontrado");
        }
        
        // Criar HTML otimizado para mobile
        const calendarHTML = `
            <div class="calendar-container" data-calendar-container="${calendarId}">
                <div id="${calendarId}" class="flatpickr-mobile-calendar"></div>
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
    
    // Função para tratar erros do calendário
    BENETRIP.tratarErroCalendario = function(container, erro) {
        console.error("Erro no calendário mobile:", erro);
        
        // Remover indicador de carregamento
        container.classList.remove('calendar-loading');
        
        // Mostrar mensagem de erro
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #e74c3c;">
                <p>❌ Erro ao carregar calendário</p>
                <button onclick="location.reload()" style="background: #e74c3c; color: white; border: none; padding: 10px 20px; border-radius: 20px;">
                    Tentar Novamente
                </button>
            </div>
        `;
    };
    
    // Função para aplicar estilos após inicialização
    BENETRIP.aplicarEstilosMobilePosPronto = function(calendarId) {
        // Aguardar um pouco para garantir que o DOM foi atualizado
        setTimeout(() => {
            const calendar = document.getElementById(calendarId);
            if (calendar) {
                const flatpickrCalendar = calendar.querySelector('.flatpickr-calendar');
                if (flatpickrCalendar) {
                    // Aplicar classe para estilos específicos
                    flatpickrCalendar.classList.add('mobile-optimized');
                    
                    // Forçar layout correto
                    flatpickrCalendar.style.width = '100%';
                    flatpickrCalendar.style.maxWidth = '100%';
                }
            }
        }, 100);
    };
}

// Adicionar CSS para animação ripple
if (!document.querySelector('#mobile-calendar-animations')) {
    const style = document.createElement('style');
    style.id = 'mobile-calendar-animations';
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
        
        .flatpickr-mobile-calendar {
            width: 100% !important;
        }
        
        .mobile-optimized {
            font-family: 'Poppins', sans-serif !important;
        }
    `;
    document.head.appendChild(style);
}

console.log("Otimizações mobile para calendário carregadas com sucesso!");
