/**
 * BENETRIP - Melhorias de Interação Mobile
 * Aprimora a experiência em dispositivos móveis com interações otimizadas
 */

const BENETRIP_MOBILE = {
    /**
     * Configuração do módulo
     */
    config: {
        touchFeedbackDelay: 100,
        tapHighlightColor: 'rgba(232, 119, 34, 0.3)',
        keyboardAwareAdjustment: true,
        preventZoom: true,
        useNativeDatePicker: true,
        swipeThreshold: 50,
        vibrate: true
    },

    /**
     * Estados do módulo
     */
    estado: {
        touchStartY: 0,
        touchStartX: 0,
        isSwiping: false,
        scrollPos: 0,
        isScrollLocked: false,
        isKeyboardOpen: false,
        activeViews: [],
        touchStartTime: 0
    },

    /**
     * Inicializa as melhorias mobile
     */
    init() {
        console.log("Inicializando melhorias para mobile...");
        
        // Detectar se estamos em um dispositivo móvel
        this.detectarDispositivo();
        
        // Aplicar ajustes para mobile se necessário
        if (this.estado.isMobile) {
            this.aplicarAjustesMobile();
            this.configurarEventos();
            
            // Verificar e ajustar para notch (iPhone X+)
            this.ajustarParaNotch();
            
            // Verificar e ajustar para teclado virtual
            this.monitorarTecladoVirtual();
        }
        
        // Inicialização concluída
        return this;
    },

    /**
     * Detecta o tipo de dispositivo
     */
    detectarDispositivo() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        this.estado.isMobile = /android|webos|iphone|ipad|ipod|blackberry|windows phone/.test(userAgent);
        this.estado.isIOS = /iphone|ipad|ipod/.test(userAgent);
        this.estado.isAndroid = /android/.test(userAgent);
        this.estado.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Adicionar classe ao body para estilização via CSS
        if (this.estado.isMobile) {
            document.body.classList.add('mobile-device');
            
            if (this.estado.isIOS) document.body.classList.add('ios-device');
            if (this.estado.isAndroid) document.body.classList.add('android-device');
        }
        
        console.log(`Dispositivo detectado: Mobile=${this.estado.isMobile}, iOS=${this.estado.isIOS}, Android=${this.estado.isAndroid}`);
    },

    /**
     * Aplica ajustes específicos para mobile
     */
    aplicarAjustesMobile() {
        // Ajustar viewport para evitar zoom indesejado em inputs
        if (this.config.preventZoom && !document.querySelector('meta[name="viewport"]')) {
            const viewportMeta = document.createElement('meta');
            viewportMeta.name = 'viewport';
            viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            document.head.appendChild(viewportMeta);
        }
        
        // Prevenir pull-to-refresh no iOS
        this.prevenirPullToRefresh();
        
        // Otimizar campos de formulário
        this.otimizarCamposFormulario();
        
        // Melhorar interações em botões
        this.melhorarInteracoesBotoes();
        
        // Otimizar calendário
        this.otimizarCalendario();
        
        // Adicionar feedback tátil para interações
        this.adicionarFeedbackTatil();
        
        // Ajustar scroll em overlays
        this.melhorarScrollOverlays();
    },

    /**
     * Previne o comportamento padrão de pull-to-refresh no iOS
     */
    prevenirPullToRefresh() {
        document.body.addEventListener('touchstart', (e) => {
            this.estado.touchStartY = e.touches[0].clientY;
        }, { passive: false });
        
        document.body.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].clientY;
            const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            
            // Se estiver no topo da página e tentar puxar para baixo, prevenir
            if (scrollTop <= 0 && touchY > this.estado.touchStartY) {
                e.preventDefault();
            }
        }, { passive: false });
    },

    /**
     * Otimiza os campos de formulário para uso em mobile
     */
    otimizarCamposFormulario() {
        // Ajustar campos de texto para evitar zoom no iOS
        const camposTexto = document.querySelectorAll('input[type="text"], input[type="number"], textarea');
        camposTexto.forEach(campo => {
            // Garantir que o font-size seja pelo menos 16px para evitar zoom no iOS
            campo.style.fontSize = '16px';
            
            // Adicionar eventos para melhorar feedback visual
            campo.addEventListener('focus', () => {
                campo.parentElement.classList.add('focused');
                
                // Ajustar scroll para garantir que o campo seja visível
                if (this.config.keyboardAwareAdjustment) {
                    setTimeout(() => {
                        campo.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                }
            });
            
            campo.addEventListener('blur', () => {
                campo.parentElement.classList.remove('focused');
            });
        });
        
        // Otimizar campos de data para usar o seletor nativo
        const camposData = document.querySelectorAll('input[type="date"]');
        if (this.config.useNativeDatePicker && this.estado.isMobile) {
            camposData.forEach(campo => {
                campo.setAttribute('type', 'date');
            });
        }
        
        // Adicionar botão para limpar campos de texto
        camposTexto.forEach(campo => {
            if (campo.type === 'text' && !campo.readOnly) {
                const wrapper = document.createElement('div');
                wrapper.className = 'input-clear-wrapper';
                
                const btnClear = document.createElement('button');
                btnClear.className = 'input-clear-button';
                btnClear.innerHTML = '&times;';
                btnClear.style.display = 'none';
                
                // Posicionar o elemento
                campo.parentNode.insertBefore(wrapper, campo);
                wrapper.appendChild(campo);
                wrapper.appendChild(btnClear);
                
                // Configurar eventos
                campo.addEventListener('input', () => {
                    btnClear.style.display = campo.value ? 'block' : 'none';
                });
                
                btnClear.addEventListener('click', () => {
                    campo.value = '';
                    btnClear.style.display = 'none';
                    campo.focus();
                });
            }
        });
    },

    /**
     * Melhora as interações em botões para touch
     */
    melhorarInteracoesBotoes() {
        const botoes = document.querySelectorAll('button, .btn, .option-button, [role="button"]');
        
        botoes.forEach(botao => {
            // Adicionar feedback visual ao tocar
            botao.addEventListener('touchstart', () => {
                botao.classList.add('touch-active');
                
                // Registrar tempo para distinguir entre tap e hold
                this.estado.touchStartTime = Date.now();
                
                // Vibração tátil se disponível
                if (this.config.vibrate && navigator.vibrate) {
                    navigator.vibrate(10);
                }
            });
            
            botao.addEventListener('touchend', () => {
                // Aplicar delay para feedback visual
                setTimeout(() => {
                    botao.classList.remove('touch-active');
                }, this.config.touchFeedbackDelay);
                
                // Verificar se foi um tap simples (não um hold)
                const touchDuration = Date.now() - this.estado.touchStartTime;
                if (touchDuration < 300) {
                    this.executarTapAnimation(botao);
                }
            });
            
            // Prevenir sticky hover em touch devices
            botao.addEventListener('touchmove', () => {
                botao.classList.remove('touch-active');
            });
        });
    },

    /**
     * Otimiza o componente de calendário para mobile
     */
    otimizarCalendario() {
        // Se estiver usando Flatpickr, otimizar para mobile
        if (typeof flatpickr !== 'undefined') {
            // Sobrescrever configurações para mobile
            const configMobile = {
                disableMobile: false, // Usar interface do flatpickr mesmo em mobile
                monthSelectorType: 'static',
                time_24hr: true,
                dateFormat: 'Y-m-d',
                animate: false // Desativar animações para melhor performance
            };
            
            // Aplicar em novas instâncias
            const originalFlatpickr = window.flatpickr;
            window.flatpickr = function(element, options) {
                // Mesclar opções com as otimizações mobile
                const newOptions = { ...options, ...configMobile };
                return originalFlatpickr(element, newOptions);
            };
            
            // Adicionar estilos específicos para mobile
            const styleEl = document.createElement('style');
            styleEl.innerHTML = `
                .flatpickr-calendar {
                    font-size: 16px !important;
                    width: 100% !important;
                    max-width: 320px !important;
                    padding: 10px !important;
                }
                .flatpickr-day {
                    min-height: 40px !important;
                    line-height: 40px !important;
                }
                .flatpickr-current-month {
                    font-size: 120% !important;
                }
            `;
            document.head.appendChild(styleEl);
        }
    },

    /**
     * Adiciona feedback tátil para interações
     */
    adicionarFeedbackTatil() {
        if (!this.config.vibrate || !navigator.vibrate) return;
        
        // Elementos que devem ter feedback tátil
        const elementosTateis = document.querySelectorAll(
            'button, .btn, .option-button, [role="button"], .destino-card, .voo-card, .checkbox-group label, .radio-group label'
        );
        
        elementosTateis.forEach(elemento => {
            elemento.addEventListener('touchstart', () => {
                navigator.vibrate(10); // Vibração sutil
            });
        });
    },

    /**
     * Melhora o comportamento de scroll em overlays e modais
     */
    melhorarScrollOverlays() {
        const overlays = document.querySelectorAll('.modal, .painel-filtros, .confirmacao-overlay');
        
        overlays.forEach(overlay => {
            overlay.addEventListener('touchmove', (e) => {
                // Permitir scroll apenas dentro do conteúdo do overlay
                const content = overlay.querySelector('.modal-content, .filtros-content, .confirmacao-container');
                
                if (content) {
                    const isScrollingContent = e.target === content || content.contains(e.target);
                    
                    if (!isScrollingContent) {
                        e.preventDefault();
                    }
                }
            }, { passive: false });
        });
    },

    /**
     * Executa animação de tap em um elemento
     */
    executarTapAnimation(elemento) {
        // Criar elementos para animação de ripple
        const ripple = document.createElement('span');
        ripple.className = 'tap-ripple';
        
        // Estilizar o ripple
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.backgroundColor = this.config.tapHighlightColor;
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple 0.5s linear';
        
        // Adicionar animação via CSS
        const styleEl = document.createElement('style');
        styleEl.innerHTML = `
            @keyframes ripple {
                to {
                    transform: scale(2);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(styleEl);
        
        // Verificar e ajustar posição do elemento
        const elementoPos = elemento.getBoundingClientRect();
        if (elementoPos.width > 0 && elementoPos.height > 0) {
            // Definir tamanho e posição
            const size = Math.max(elementoPos.width, elementoPos.height);
            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = '50%';
            ripple.style.top = '50%';
            ripple.style.marginLeft = `-${size/2}px`;
            ripple.style.marginTop = `-${size/2}px`;
            
            // Definir posicionamento no elemento
            elemento.style.position = elemento.style.position || 'relative';
            elemento.style.overflow = 'hidden';
            
            // Adicionar e remover após animação
            elemento.appendChild(ripple);
            setTimeout(() => {
                elemento.removeChild(ripple);
            }, 500);
        }
    },

    /**
     * Monitora o estado do teclado virtual
     */
    monitorarTecladoVirtual() {
        if (!this.estado.isMobile) return;
        
        if (this.estado.isAndroid) {
            // Para Android, monitorar mudanças na altura da janela
            const windowHeight = window.innerHeight;
            
            window.addEventListener('resize', () => {
                const novaAltura = window.innerHeight;
                
                // Se a altura diminuiu significativamente, o teclado provavelmente está aberto
                if (novaAltura < windowHeight * 0.8) {
                    this.estado.isKeyboardOpen = true;
                    document.body.classList.add('keyboard-open');
                    this.ajustarParaTecladoAberto();
                } else {
                    this.estado.isKeyboardOpen = false;
                    document.body.classList.remove('keyboard-open');
                    this.ajustarParaTecladoFechado();
                }
            });
        } else if (this.estado.isIOS) {
            // Para iOS, usar eventos blur e focus nos campos
            const campos = document.querySelectorAll('input, textarea, select');
            
            campos.forEach(campo => {
                campo.addEventListener('focus', () => {
                    this.estado.isKeyboardOpen = true;
                    document.body.classList.add('keyboard-open');
                    this.ajustarParaTecladoAberto();
                });
                
                campo.addEventListener('blur', () => {
                    this.estado.isKeyboardOpen = false;
                    document.body.classList.remove('keyboard-open');
                    this.ajustarParaTecladoFechado();
                });
            });
        }
    },

    /**
     * Ajusta a UI quando o teclado está aberto
     */
    ajustarParaTecladoAberto() {
        if (!this.config.keyboardAwareAdjustment) return;
        
        // Salvar posição de scroll
        this.estado.scrollPos = window.scrollY;
        
        // Adicionar padding no body para compensar o teclado
        setTimeout(() => {
            const focusedElement = document.activeElement;
            
            if (focusedElement && (focusedElement.tagName === 'INPUT' || focusedElement.tagName === 'TEXTAREA')) {
                // Rolar para garantir que o campo em foco seja visível
                focusedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    },

    /**
     * Ajusta a UI quando o teclado é fechado
     */
    ajustarParaTecladoFechado() {
        if (!this.config.keyboardAwareAdjustment) return;
        
        // Remover padding extra
        document.body.style.paddingBottom = '';
        
        // Restaurar posição de scroll se necessário
        if (document.body.classList.contains('ios-device')) {
            window.scrollTo(0, this.estado.scrollPos);
        }
    },

    /**
     * Ajusta o layout para dispositivos com notch (iPhone X+)
     */
    ajustarParaNotch() {
        // Detectar se o dispositivo tem notch
        const hasNotch = this.estado.isIOS && window.screen.height >= 812;
        
        if (hasNotch) {
            document.body.classList.add('has-notch');
            
            // Adicionar padding na parte superior
            const headerElements = document.querySelectorAll('.chat-header, .voos-header, .destinos-header');
            headerElements.forEach(header => {
                header.style.paddingTop = 'calc(env(safe-area-inset-top, 20px))';
            });
            
            // Adicionar padding na parte inferior
            const footerElements = document.querySelectorAll('.app-footer, .fixed-bottom-bar');
            footerElements.forEach(footer => {
                footer.style.paddingBottom = 'calc(env(safe-area-inset-bottom, 20px))';
            });
        }
    },

    /**
     * Configura eventos globais para mobile
     */
    configurarEventos() {
        // Detecção de gesto swipe
        document.addEventListener('touchstart', (e) => {
            this.estado.touchStartX = e.touches[0].clientX;
            this.estado.touchStartY = e.touches[0].clientY;
            this.estado.isSwiping = false;
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) return; // Ignorar multitouch
            
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            
            // Calcular distância
            const deltaX = touchX - this.estado.touchStartX;
            const deltaY = touchY - this.estado.touchStartY;
            
            // Se o movimento horizontal for maior que o vertical e maior que threshold
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.config.swipeThreshold) {
                this.estado.isSwiping = true;
                this.processarGestoSwipe(deltaX > 0 ? 'right' : 'left');
            }
        }, { passive: true });
        
        // Melhorar cliques em elementos com atraso
        document.addEventListener('click', (e) => {
            // Se for um elemento interativo, aplicar debounce para evitar cliques duplos
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.hasAttribute('role')) {
                if (this.estado.lastClickTime && Date.now() - this.estado.lastClickTime < 300) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
                
                this.estado.lastClickTime = Date.now();
            }
        }, true);
        
        // Melhorar navegação com back button
        window.addEventListener('popstate', (e) => {
            // Verificar se há uma view ativa que deveria ser fechada
            if (this.estado.activeViews.length > 0) {
                e.preventDefault();
                
                const lastView = this.estado.activeViews.pop();
                this.fecharView(lastView);
                
                return false;
            }
        });
    },

    /**
     * Processa gestos de swipe na interface
     */
    processarGestoSwipe(direcao) {
        // Identificar elemento swipeable mais próximo
        const swipeables = document.querySelectorAll('.swipeable-container, .voo-card, .destino-card');
        
        swipeables.forEach(elemento => {
            // Verificar se o elemento está visível e no viewport
            const rect = elemento.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            
            if (isVisible) {
                if (direcao === 'left') {
                    elemento.classList.add('swiped-left');
                    elemento.querySelectorAll('.swipe-action').forEach(action => {
                        action.style.display = 'flex';
                    });
                } else if (direcao === 'right') {
                    elemento.classList.remove('swiped-left');
                    elemento.querySelectorAll('.swipe-action').forEach(action => {
                        action.style.display = 'none';
                    });
                }
            }
        });
    },

    /**
     * Fecha uma view ativa
     */
    fecharView(viewId) {
        const view = document.getElementById(viewId);
        
        if (view) {
            // Animar saída
            view.classList.add('closing');
            
            setTimeout(() => {
                if (view.parentNode) {
                    view.parentNode.removeChild(view);
                }
            }, 300);
        }
    },
    
    /**
     * Cria um toast notification
     */
    mostrarToast(mensagem, duracao = 2000) {
        // Remover toast existente
        const toastExistente = document.querySelector('.toast-notification');
        if (toastExistente) {
            document.body.removeChild(toastExistente);
        }
        
        // Criar novo toast
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = mensagem;
        
        // Adicionar ao DOM
        document.body.appendChild(toast);
        
        // Animar entrada
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Remover após duração
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duracao);
    },
    
    /**
     * Adiciona botão de voltar para topo
     */
    adicionarBotaoVoltarTopo() {
        // Criar botão
        const btnTopo = document.createElement('button');
        btnTopo.className = 'back-to-top';
        btnTopo.innerHTML = '⬆️';
        btnTopo.style.display = 'none';
        
        // Estilizar
        btnTopo.style.position = 'fixed';
        btnTopo.style.bottom = '20px';
        btnTopo.style.right = '20px';
        btnTopo.style.width = '44px';
        btnTopo.style.height = '44px';
        btnTopo.style.borderRadius = '50%';
        btnTopo.style.backgroundColor = 'var(--orange-primary)';
        btnTopo.style.color = 'white';
        btnTopo.style.border = 'none';
        btnTopo.style.zIndex = '99';
        btnTopo.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        
        // Adicionar ao DOM
        document.body.appendChild(btnTopo);
        
        // Configurar eventos
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                btnTopo.style.display = 'block';
            } else {
                btnTopo.style.display = 'none';
            }
        });
        
        btnTopo.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    BENETRIP_MOBILE.init();
});

// Exportar para namespace global
window.BENETRIP_MOBILE = BENETRIP_MOBILE;
