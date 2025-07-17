/**
 * BENETRIP - CALENDÁRIO MOBILE CORRIGIDO
 * Versão 2.0 - Resolvendo problemas de largura e exibição do mês
 */

// Sobrescrever função de inicialização do calendário no BENETRIP
if (typeof BENETRIP !== 'undefined') {
    // Guardar referência da função original
    const inicializarCalendarioOriginal = BENETRIP.inicializarCalendario;
    
    // Sobrescrever com versão corrigida
    BENETRIP.inicializarCalendario = function(pergunta) {
        console.log("Iniciando calendário mobile corrigido - versão 2.0");
        
        // Limpar qualquer calendário existente
        if (this.estado.calendarioAtual) {
            console.log("Limpando instância anterior do calendário");
            try {
                this.estado.calendarioAtual.destroy();
            } catch (e) {
                console.log("Erro ao destruir calendário anterior:", e);
            }
            this.estado.calendarioAtual = null;
        }
        
        // Usar ID fixo consistente
        this.estado.currentCalendarId = 'benetrip-calendar-fixed';
        const calendarId = this.estado.currentCalendarId;
        
        console.log(`Usando ID do calendário: ${calendarId}`);
        
        // Aguardar um tempo para garantir que o DOM esteja estável
        setTimeout(() => {
            this.inicializarCalendarioCorrigido(pergunta, calendarId);
        }, 300);
    };
    
    // Nova função de inicialização corrigida
    BENETRIP.inicializarCalendarioCorrigido = function(pergunta, calendarId) {
        console.log("Executando inicialização corrigida do calendário");
        
        try {
            // Verificar se o Flatpickr está disponível
            if (typeof flatpickr === 'undefined') {
                console.error("Flatpickr não encontrado, carregando dinamicamente");
                this.carregarFlatpickrCorrigido(pergunta, calendarId);
                return;
            }
            
            // Encontrar ou criar container
            let container = document.querySelector('.calendar-container');
            if (!container) {
                console.log("Container não encontrado, criando novo");
                container = this.criarContainerCalendarioCorrigido(calendarId);
            }
            
            // Atualizar elementos com o ID correto
            this.atualizarElementosCalendario(container, calendarId);
            
            // Criar elemento do calendário
            let calendarElement = document.getElementById(calendarId);
            if (!calendarElement) {
                calendarElement = document.createElement('div');
                calendarElement.id = calendarId;
                calendarElement.className = 'flatpickr-mobile-calendar-fixed';
                
                // Inserir no início do container, antes dos outros elementos
                container.insertBefore(calendarElement, container.firstChild);
            }
            
            console.log("Elemento do calendário preparado:", calendarElement);
            
            // Configuração corrigida para mobile
            const config = this.obterConfiguracaoCorrigida(pergunta, calendarId);
            
            // Inicializar Flatpickr
            const calendario = flatpickr(calendarElement, config);
            
            if (!calendario) {
                throw new Error("Falha ao criar instância do Flatpickr");
            }
            
            // Salvar referência
            this.estado.calendarioAtual = calendario;
            
            console.log("Flatpickr inicializado com sucesso");
            
            // Aplicar correções pós-inicialização
            setTimeout(() => {
                this.aplicarCorrecoesFinais(container, calendario, calendarId);
            }, 200);
            
        } catch (erro) {
            console.error("Erro na inicialização corrigida:", erro);
            this.exibirErroCalendario(container, erro.message);
        }
    };
    
    // Configuração corrigida do Flatpickr
    BENETRIP.obterConfiguracaoCorrigida = function(pergunta, calendarId) {
        console.log("Gerando configuração corrigida para mobile");
        
        // Data mínima (amanhã)
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        amanha.setHours(0, 0, 0, 0);
        
        return {
            // Configurações essenciais
            mode: "range",
            dateFormat: "Y-m-d",
            inline: true,
            static: true,
            
            // CRUCIAL: Forçar apenas 1 mês
            showMonths: 1,
            
            // Limites de data
            minDate: pergunta.calendar?.min_date || this.formatarDataISO(amanha),
            maxDate: pergunta.calendar?.max_date,
            
            // Otimizações para mobile
            animate: false,
            monthSelectorType: 'static',
            
            // Localização em português
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
            
            // Eventos
            onChange: (selectedDates, dateStr) => {
                console.log("Data alterada:", selectedDates);
                this.processarMudancaDataCorrigida(selectedDates, calendarId);
            },
            
            onReady: () => {
                console.log("Flatpickr pronto, aplicando correções finais");
                setTimeout(() => {
                    this.garantirVisibilidadeHeader(calendarId);
                    this.ajustarLarguraCalendario(calendarId);
                }, 100);
            },
            
            onMonthChange: () => {
                console.log("Mês alterado");
                setTimeout(() => {
                    this.garantirVisibilidadeHeader(calendarId);
                }, 50);
            },
            
            onDayCreate: (dObj, dStr, fp, dayElem) => {
                // Garantir que cada dia tenha o tamanho correto
                dayElem.style.width = 'calc(100% / 7)';
                dayElem.style.maxWidth = 'calc(100% / 7)';
                dayElem.style.boxSizing = 'border-box';
            }
        };
    };
    
    // Função para processar mudança de data corrigida
    BENETRIP.processarMudancaDataCorrigida = function(selectedDates, calendarId) {
        const dataIdaElement = document.getElementById(`data-ida-${calendarId}`);
        const dataVoltaElement = document.getElementById(`data-volta-${calendarId}`);
        const confirmarBtn = document.getElementById(`confirmar-datas-${calendarId}`);
        
        if (!dataIdaElement || !dataVoltaElement || !confirmarBtn) {
            console.error("Elementos de interface não encontrados!");
            return;
        }
        
        // Feedback tátil
        if (navigator.vibrate && selectedDates.length > 0) {
            navigator.vibrate(10);
        }
        
        // Atualizar interface baseado na seleção
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
            
            // Feedback visual
            confirmarBtn.style.animation = 'pulse 0.5s ease-in-out';
            setTimeout(() => {
                confirmarBtn.style.animation = '';
            }, 500);
        }
    };
    
    // Função para garantir visibilidade do header
    BENETRIP.garantirVisibilidadeHeader = function(calendarId) {
        console.log("Garantindo visibilidade do header do mês");
        
        const calendar = document.getElementById(calendarId);
        if (!calendar) return;
        
        const flatpickrCalendar = calendar.querySelector('.flatpickr-calendar');
        if (!flatpickrCalendar) return;
        
        // Forçar visibilidade dos elementos do header
        const months = flatpickrCalendar.querySelector('.flatpickr-months');
        const currentMonth = flatpickrCalendar.querySelector('.flatpickr-current-month');
        const monthInput = flatpickrCalendar.querySelector('.flatpickr-current-month input');
        
        if (months) {
            months.style.display = 'flex';
            months.style.visibility = 'visible';
            months.style.width = '100%';
            months.style.justifyContent = 'center';
            months.style.alignItems = 'center';
            months.style.padding = '8px 0 12px 0';
        }
        
        if (currentMonth) {
            currentMonth.style.display = 'flex';
            currentMonth.style.visibility = 'visible';
            currentMonth.style.fontSize = '16px';
            currentMonth.style.fontWeight = '700';
            currentMonth.style.color = '#21272A';
            currentMonth.style.justifyContent = 'center';
            currentMonth.style.alignItems = 'center';
        }
        
        if (monthInput) {
            monthInput.style.display = 'block';
            monthInput.style.visibility = 'visible';
            monthInput.style.fontSize = '16px';
            monthInput.style.fontWeight = '700';
            monthInput.style.color = '#21272A';
            monthInput.style.background = 'transparent';
            monthInput.style.border = 'none';
            monthInput.style.textAlign = 'center';
            monthInput.style.width = 'auto';
            monthInput.style.minWidth = '80px';
        }
        
        // Garantir visibilidade dos botões de navegação
        const prevBtn = flatpickrCalendar.querySelector('.flatpickr-prev-month');
        const nextBtn = flatpickrCalendar.querySelector('.flatpickr-next-month');
        
        [prevBtn, nextBtn].forEach(btn => {
            if (btn) {
                btn.style.display = 'flex';
                btn.style.visibility = 'visible';
                btn.style.width = '32px';
                btn.style.height = '32px';
                btn.style.borderRadius = '50%';
                btn.style.backgroundColor = '#f5f5f5';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
            }
        });
        
        console.log("Header do mês configurado para visibilidade");
    };
    
    // Função para ajustar largura do calendário
    BENETRIP.ajustarLarguraCalendario = function(calendarId) {
        console.log("Ajustando largura do calendário");
        
        const calendar = document.getElementById(calendarId);
        if (!calendar) return;
        
        const flatpickrCalendar = calendar.querySelector('.flatpickr-calendar');
        if (!flatpickrCalendar) return;
        
        // Aplicar largura correta
        flatpickrCalendar.style.width = '100%';
        flatpickrCalendar.style.maxWidth = '100%';
        flatpickrCalendar.style.minWidth = '280px';
        flatpickrCalendar.style.boxSizing = 'border-box';
        flatpickrCalendar.style.overflow = 'hidden';
        
        // Ajustar container interno
        const innerContainer = flatpickrCalendar.querySelector('.flatpickr-innerContainer');
        if (innerContainer) {
            innerContainer.style.width = '100%';
            innerContainer.style.maxWidth = '100%';
            innerContainer.style.overflow = 'hidden';
        }
        
        // Forçar layout correto dos dias
        const dayContainer = flatpickrCalendar.querySelector('.dayContainer');
        if (dayContainer) {
            dayContainer.style.display = 'grid';
            dayContainer.style.gridTemplateColumns = 'repeat(7, 1fr)';
            dayContainer.style.gap = '1px';
            dayContainer.style.width = '100%';
            dayContainer.style.maxWidth = '100%';
            
            // Garantir que cada dia tenha largura correta
            const days = dayContainer.querySelectorAll('.flatpickr-day');
            days.forEach(day => {
                day.style.width = '100%';
                day.style.maxWidth = '100%';
                day.style.height = '36px';
                day.style.minHeight = '36px';
                day.style.boxSizing = 'border-box';
            });
        }
        
        console.log("Largura do calendário ajustada");
    };
    
    // Aplicar correções finais
    BENETRIP.aplicarCorrecoesFinais = function(container, calendario, calendarId) {
        console.log("Aplicando correções finais do calendário");
        
        // Ocultar elementos problemáticos
        const problematicContainers = container.querySelectorAll('.flatpickr-calendar-container');
        problematicContainers.forEach(el => {
            el.style.display = 'none';
            el.style.height = '0';
            el.style.width = '0';
            el.style.overflow = 'hidden';
        });
        
        // Garantir visibilidade do calendário principal
        this.garantirVisibilidadeHeader(calendarId);
        this.ajustarLarguraCalendario(calendarId);
        
        // Configurar botão de confirmação
        this.configurarBotaoConfirmacao(calendario, calendarId);
        
        // Marcar como inicializado
        container.classList.add('calendar-initialized');
        
        console.log("Correções finais aplicadas com sucesso");
    };
    
    // Configurar botão de confirmação
    BENETRIP.configurarBotaoConfirmacao = function(calendario, calendarId) {
        const confirmarBtn = document.getElementById(`confirmar-datas-${calendarId}`);
        
        if (confirmarBtn) {
            // Remover listeners antigos clonando o elemento
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
                        
                        // Processar datas
                        const dadosDatas = {
                            dataIda: this.formatarDataISO(datas[0]),
                            dataVolta: this.formatarDataISO(datas[1])
                        };
                        
                        console.log("Datas processadas:", dadosDatas);
                        
                        // Buscar pergunta atual
                        const pergunta = this.estado.perguntas[this.estado.perguntaAtual];
                        
                        if (pergunta) {
                            // Desabilitar botão temporariamente
                            novoBtn.disabled = true;
                            novoBtn.textContent = "Processando...";
                            
                            // Processar resposta
                            setTimeout(() => {
                                this.processarResposta(dadosDatas, pergunta);
                            }, 200);
                        }
                    } else {
                        this.exibirToast("Por favor, selecione as datas de ida e volta", 'warning');
                    }
                } catch (erro) {
                    console.error("Erro ao confirmar datas:", erro);
                    this.exibirToast("Erro ao processar datas. Tente novamente.", 'error');
                }
            });
        }
    };
    
    // Atualizar elementos do calendário com ID correto
    BENETRIP.atualizarElementosCalendario = function(container, calendarId) {
        // Atualizar IDs dos elementos existentes
        const dataIdaElement = container.querySelector('.date-selection p:first-child span');
        const dataVoltaElement = container.querySelector('.date-selection p:last-child span');
        const confirmarBtn = container.querySelector('.confirm-button');
        
        if (dataIdaElement) dataIdaElement.id = `data-ida-${calendarId}`;
        if (dataVoltaElement) dataVoltaElement.id = `data-volta-${calendarId}`;
        if (confirmarBtn) confirmarBtn.id = `confirmar-datas-${calendarId}`;
        
        console.log("Elementos do calendário atualizados com novo ID");
    };
    
    // Criar container do calendário corrigido
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
        
        // HTML otimizado para mobile
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
    
    // Carregamento dinâmico do Flatpickr corrigido
    BENETRIP.carregarFlatpickrCorrigido = function(pergunta, calendarId) {
        console.log("Carregando Flatpickr dinamicamente (versão corrigida)");
        
        if (document.querySelector('script[src*="flatpickr"]')) {
            console.log("Flatpickr já em processo de carregamento");
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js';
        script.onload = () => {
            console.log("Flatpickr carregado dinamicamente com sucesso");
            
            // Carregar CSS se necessário
            if (!document.querySelector('link[href*="flatpickr"]')) {
                const style = document.createElement('link');
                style.rel = 'stylesheet';
                style.href = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css';
                document.head.appendChild(style);
            }
            
            // Reinicializar após carregamento
            setTimeout(() => {
                this.inicializarCalendarioCorrigido(pergunta, calendarId);
            }, 500);
        };
        
        script.onerror = () => {
            console.error("Falha ao carregar Flatpickr");
            this.exibirToast("Erro ao carregar calendário. Recarregue a página.", 'error');
        };
        
        document.head.appendChild(script);
    };
    
    // Exibir erro do calendário
    BENETRIP.exibirErroCalendario = function(container, mensagem) {
        console.error("Erro no calendário:", mensagem);
        
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; background: #ffebee; border-radius: 8px; color: #d32f2f;">
                    <p>❌ ${mensagem}</p>
                    <button onclick="location.reload()" 
                            style="background: #d32f2f; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer;">
                        Recarregar Página
                    </button>
                </div>
            `;
        }
    };
}

// CSS adicional para garantir layout correto
if (!document.querySelector('#mobile-calendar-fixes-v2')) {
    const style = document.createElement('style');
    style.id = 'mobile-calendar-fixes-v2';
    style.textContent = `
        .flatpickr-mobile-calendar-fixed {
            width: 100% !important;
            max-width: 100% !important;
        }
        
        .calendar-initialized .flatpickr-calendar {
            display: inline-block !important;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
}

console.log("Calendário mobile corrigido - versão 2.0 carregado com sucesso!");
