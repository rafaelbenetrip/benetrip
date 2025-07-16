/**
 * 🐕 SISTEMA DE INTERAÇÕES DA TRIPINHA - VERSÃO PREMIUM
 * Aproveita ao máximo a nova imagem oficial da mascote
 */

const TRIPINHA_INTERACTIONS = {
    
    // 🎯 Estados da Tripinha
    estados: {
        welcome: 'welcome',
        loading: 'loading',
        success: 'success',
        tip: 'tip',
        error: 'error'
    },
    
    // 🎨 Configurações visuais
    config: {
        animationDuration: 600,
        hoverDelay: 150,
        celebrationDuration: 1200,
        tipDelay: 2000
    },
    
    /**
     * ✨ Inicializar sistema de interações
     */
    init() {
        console.log('🐕 Tripinha Interactions v2.0 - Sistema Premium Ativado');
        
        this.configurarAnimacaoEntrada();
        this.configurarHoverEfeitos();
        this.configurarClickInteractions();
        this.configurarEstadosContextuais();
        this.adicionarEasterEggs();
        
        // Aplicar entrada especial
        setTimeout(() => {
            this.aplicarEstado('welcome');
        }, 300);
    },
    
    /**
     * 🌟 Configurar animação de entrada
     */
    configurarAnimacaoEntrada() {
        const avatars = document.querySelectorAll(
            '.tripinha-avatar-principal, .loading-avatar-oficial'
        );
        
        avatars.forEach((avatar, index) => {
            // Adicionar classe de entrada com delay escalonado
            setTimeout(() => {
                avatar.classList.add('tripinha-entrada-especial');
                
                // Efeito de "acordar"
                this.simularAcordar(avatar);
            }, index * 200);
        });
    },
    
    /**
     * 🐾 Simular "acordar" da Tripinha
     */
    simularAcordar(elemento) {
        const estadosAcordar = [
            { transform: 'scale(0.98)', duration: 100 },
            { transform: 'scale(1.02)', duration: 150 },
            { transform: 'scale(1)', duration: 100 }
        ];
        
        estadosAcordar.forEach((estado, index) => {
            setTimeout(() => {
                elemento.style.transform = estado.transform;
            }, index * estado.duration);
        });
    },
    
    /**
     * 🎪 Configurar efeitos de hover
     */
    configurarHoverEfeitos() {
        const avatars = document.querySelectorAll(
            '.tripinha-avatar-principal, .avatar-img-oficial'
        );
        
        avatars.forEach(avatar => {
            let hoverTimeout;
            
            avatar.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
                this.aplicarHoverEfeito(avatar);
            });
            
            avatar.addEventListener('mouseleave', () => {
                hoverTimeout = setTimeout(() => {
                    this.removerHoverEfeito(avatar);
                }, this.config.hoverDelay);
            });
            
            // Touch para mobile
            avatar.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.aplicarHoverEfeito(avatar);
                
                setTimeout(() => {
                    this.removerHoverEfeito(avatar);
                }, 1000);
            });
        });
    },
    
    /**
     * ✨ Aplicar efeito de hover
     */
    aplicarHoverEfeito(elemento) {
        elemento.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        
        // Efeito baseado no contexto
        if (elemento.classList.contains('tripinha-avatar-principal')) {
            elemento.style.transform = 'scale(1.05) rotate(3deg)';
            elemento.style.filter = 'brightness(1.1) saturate(1.2)';
        } else {
            elemento.style.transform = 'scale(1.1) rotate(-3deg)';
            elemento.style.filter = 'brightness(1.05)';
        }
        
        // Adicionar brilho temporário
        this.adicionarBrilho(elemento);
    },
    
    /**
     * 🌟 Remover efeito de hover
     */
    removerHoverEfeito(elemento) {
        elemento.style.transform = '';
        elemento.style.filter = '';
        this.removerBrilho(elemento);
    },
    
    /**
     * ✨ Adicionar brilho
     */
    adicionarBrilho(elemento) {
        const brilho = document.createElement('div');
        brilho.className = 'tripinha-brilho';
        brilho.style.cssText = `
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            border-radius: 50%;
            background: linear-gradient(45deg, 
                transparent 30%, 
                rgba(255, 255, 255, 0.3) 50%, 
                transparent 70%);
            pointer-events: none;
            animation: tripinha-shimmer 1.5s ease-in-out infinite;
            z-index: -1;
        `;
        
        // Posicionamento relativo no pai
        if (getComputedStyle(elemento.parentElement).position === 'static') {
            elemento.parentElement.style.position = 'relative';
        }
        
        elemento.parentElement.appendChild(brilho);
        
        // Adicionar CSS da animação se não existir
        this.adicionarAnimacaoShimmer();
    },
    
    /**
     * 🌟 Remover brilho
     */
    removerBrilho(elemento) {
        const brilho = elemento.parentElement.querySelector('.tripinha-brilho');
        if (brilho) {
            brilho.style.opacity = '0';
            setTimeout(() => brilho.remove(), 300);
        }
    },
    
    /**
     * 💫 Adicionar animação shimmer
     */
    adicionarAnimacaoShimmer() {
        if (document.getElementById('tripinha-shimmer-style')) return;
        
        const style = document.createElement('style');
        style.id = 'tripinha-shimmer-style';
        style.textContent = `
            @keyframes tripinha-shimmer {
                0% { transform: translateX(-100%) rotate(45deg); opacity: 0; }
                50% { opacity: 1; }
                100% { transform: translateX(100%) rotate(45deg); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    },
    
    /**
     * 👆 Configurar interações de clique
     */
    configurarClickInteractions() {
        const avatars = document.querySelectorAll(
            '.tripinha-avatar-principal, .loading-avatar-oficial'
        );
        
        avatars.forEach(avatar => {
            let clickCount = 0;
            let clickTimer = null;
            
            avatar.addEventListener('click', (e) => {
                e.preventDefault();
                clickCount++;
                
                clearTimeout(clickTimer);
                clickTimer = setTimeout(() => {
                    this.processarClicks(avatar, clickCount);
                    clickCount = 0;
                }, 400);
            });
        });
    },
    
    /**
     * 🎯 Processar cliques
     */
    processarClicks(elemento, numClicks) {
        if (numClicks === 1) {
            this.animacaoCliqueSingle(elemento);
        } else if (numClicks === 2) {
            this.animacaoCliqueDouble(elemento);
        } else if (numClicks >= 3) {
            this.animacaoCelebration(elemento);
        }
    },
    
    /**
     * 👆 Animação clique simples
     */
    animacaoCliqueSingle(elemento) {
        elemento.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            elemento.style.transform = 'scale(1.05)';
        }, 100);
        
        setTimeout(() => {
            elemento.style.transform = '';
        }, 200);
        
        // Som visual (pseudo-haptic feedback)
        this.criarRippleEfect(elemento);
    },
    
    /**
     * 👆👆 Animação clique duplo
     */
    animacaoCliqueDouble(elemento) {
        elemento.classList.add('tripinha-sucesso');
        
        // Mostrar coração temporário
        this.mostrarCoracao(elemento);
        
        setTimeout(() => {
            elemento.classList.remove('tripinha-sucesso');
        }, this.config.celebrationDuration);
    },
    
    /**
     * 🎉 Animação de celebração
     */
    animacaoCelebration(elemento) {
        // Easter egg - celebração especial
        elemento.style.animation = 'tripinha-celebration 0.6s ease-out 3';
        
        // Criar confetes
        this.criarConfetes(elemento);
        
        // Mostrar mensagem especial
        this.mostrarMensagemEspecial();
        
        setTimeout(() => {
            elemento.style.animation = '';
        }, 1800);
    },
    
    /**
     * 💝 Mostrar coração
     */
    mostrarCoracao(elemento) {
        const coracao = document.createElement('div');
        coracao.textContent = '❤️';
        coracao.style.cssText = `
            position: absolute;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 24px;
            animation: tripinha-heart-float 1.5s ease-out forwards;
            pointer-events: none;
            z-index: 1000;
        `;
        
        const parent = elemento.parentElement;
        if (getComputedStyle(parent).position === 'static') {
            parent.style.position = 'relative';
        }
        
        parent.appendChild(coracao);
        
        // Adicionar animação
        this.adicionarAnimacaoHeart();
        
        setTimeout(() => coracao.remove(), 1500);
    },
    
    /**
     * 💖 Adicionar animação de coração
     */
    adicionarAnimacaoHeart() {
        if (document.getElementById('tripinha-heart-style')) return;
        
        const style = document.createElement('style');
        style.id = 'tripinha-heart-style';
        style.textContent = `
            @keyframes tripinha-heart-float {
                0% { 
                    opacity: 0; 
                    transform: translateX(-50%) translateY(0) scale(0.5); 
                }
                50% { 
                    opacity: 1; 
                    transform: translateX(-50%) translateY(-20px) scale(1.2); 
                }
                100% { 
                    opacity: 0; 
                    transform: translateX(-50%) translateY(-40px) scale(0.8); 
                }
            }
        `;
        document.head.appendChild(style);
    },
    
    /**
     * 🎊 Criar confetes
     */
    criarConfetes(elemento) {
        const cores = ['#E87722', '#00A3E0', '#FFD700', '#FF69B4', '#98FB98'];
        const numConfetes = 15;
        
        for (let i = 0; i < numConfetes; i++) {
            setTimeout(() => {
                this.criarConfete(elemento, cores[i % cores.length]);
            }, i * 50);
        }
    },
    
    /**
     * 🎊 Criar confete individual
     */
    criarConfete(elemento, cor) {
        const confete = document.createElement('div');
        confete.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            background: ${cor};
            border-radius: 50%;
            top: 50%;
            left: 50%;
            pointer-events: none;
            animation: tripinha-confete ${1 + Math.random()}s ease-out forwards;
            z-index: 999;
        `;
        
        // Direção aleatória
        const angle = Math.random() * 360;
        const distance = 50 + Math.random() * 50;
        
        confete.style.setProperty('--end-x', `${Math.cos(angle) * distance}px`);
        confete.style.setProperty('--end-y', `${Math.sin(angle) * distance}px`);
        
        const parent = elemento.parentElement;
        if (getComputedStyle(parent).position === 'static') {
            parent.style.position = 'relative';
        }
        
        parent.appendChild(confete);
        
        // Adicionar animação
        this.adicionarAnimacaoConfete();
        
        setTimeout(() => confete.remove(), 2000);
    },
    
    /**
     * 🎊 Adicionar animação de confete
     */
    adicionarAnimacaoConfete() {
        if (document.getElementById('tripinha-confete-style')) return;
        
        const style = document.createElement('style');
        style.id = 'tripinha-confete-style';
        style.textContent = `
            @keyframes tripinha-confete {
                0% { 
                    opacity: 1; 
                    transform: translate(-50%, -50%) scale(0);
                }
                20% { 
                    transform: translate(-50%, -50%) scale(1);
                }
                100% { 
                    opacity: 0; 
                    transform: translate(
                        calc(-50% + var(--end-x)), 
                        calc(-50% + var(--end-y))
                    ) scale(0.5);
                }
            }
        `;
        document.head.appendChild(style);
    },
    
    /**
     * 💬 Mostrar mensagem especial
     */
    mostrarMensagemEspecial() {
        const mensagens = [
            "Au au! Você encontrou um easter egg! 🐕",
            "Tripinha adora carinho! 🥰",
            "Você desbloqueou a amizade da Tripinha! 🎉",
            "Que fofinho! A Tripinha está feliz! 💕"
        ];
        
        const mensagem = mensagens[Math.floor(Math.random() * mensagens.length)];
        
        // Usar sistema de toast existente se disponível
        if (window.BENETRIP_ROTEIRO && window.BENETRIP_ROTEIRO.exibirToast) {
            window.BENETRIP_ROTEIRO.exibirToast(mensagem, 'success');
        } else {
            this.criarToastEspecial(mensagem);
        }
    },
    
    /**
     * 🍞 Criar toast especial
     */
    criarToastEspecial(mensagem) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #E87722, #f39c42);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-weight: 600;
            box-shadow: 0 8px 24px rgba(232, 119, 34, 0.3);
            z-index: 10000;
            animation: tripinha-toast-in 0.5s ease-out;
        `;
        toast.textContent = mensagem;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'tripinha-toast-out 0.5s ease-in forwards';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
        
        // Adicionar animações do toast
        this.adicionarAnimacaoToast();
    },
    
    /**
     * 🍞 Adicionar animação de toast
     */
    adicionarAnimacaoToast() {
        if (document.getElementById('tripinha-toast-style')) return;
        
        const style = document.createElement('style');
        style.id = 'tripinha-toast-style';
        style.textContent = `
            @keyframes tripinha-toast-in {
                from { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); }
                to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
            }
            
            @keyframes tripinha-toast-out {
                from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
                to { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); }
            }
        `;
        document.head.appendChild(style);
    },
    
    /**
     * 🌊 Criar efeito ripple
     */
    criarRippleEfect(elemento) {
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(232, 119, 34, 0.3);
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            animation: tripinha-ripple 0.6s ease-out;
            pointer-events: none;
            z-index: -1;
        `;
        
        const parent = elemento.parentElement;
        if (getComputedStyle(parent).position === 'static') {
            parent.style.position = 'relative';
        }
        
        parent.appendChild(ripple);
        
        // Adicionar animação ripple
        this.adicionarAnimacaoRipple();
        
        setTimeout(() => ripple.remove(), 600);
    },
    
    /**
     * 🌊 Adicionar animação ripple
     */
    adicionarAnimacaoRipple() {
        if (document.getElementById('tripinha-ripple-style')) return;
        
        const style = document.createElement('style');
        style.id = 'tripinha-ripple-style';
        style.textContent = `
            @keyframes tripinha-ripple {
                from { 
                    width: 0;
                    height: 0;
                    opacity: 0.5;
                    transform: translate(-50%, -50%) scale(0);
                }
                to { 
                    width: 100px;
                    height: 100px;
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(1);
                }
            }
        `;
        document.head.appendChild(style);
    },
    
    /**
     * 🎨 Aplicar estado contextual
     */
    aplicarEstado(estado) {
        const avatars = document.querySelectorAll(
            '.tripinha-avatar-principal, .loading-avatar-oficial, .avatar-img-oficial'
        );
        
        avatars.forEach(avatar => {
            // Remover estados anteriores
            Object.values(this.estados).forEach(st => {
                avatar.classList.remove(`tripinha-context-${st}`);
            });
            
            // Aplicar novo estado
            avatar.classList.add(`tripinha-context-${estado}`);
        });
    },
    
    /**
     * 🎯 Configurar estados contextuais
     */
    configurarEstadosContextuais() {
        // Observar mudanças no DOM para aplicar estados apropriados
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    this.detectarContextoEAplicarEstado();
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Aplicar estado inicial
        setTimeout(() => {
            this.detectarContextoEAplicarEstado();
        }, 500);
    },
    
    /**
     * 🔍 Detectar contexto e aplicar estado
     */
    detectarContextoEAplicarEstado() {
        if (document.querySelector('.loading-container:not([style*="display: none"])')) {
            this.aplicarEstado('loading');
        } else if (document.querySelector('.formulario-container:not([style*="display: none"])')) {
            this.aplicarEstado('welcome');
        } else if (document.querySelector('.roteiro-content:not([style*="display: none"])')) {
            this.aplicarEstado('success');
        }
    },
    
    /**
     * 🥚 Adicionar easter eggs
     */
    adicionarEasterEggs() {
        // Sequência de teclas para ativar modo especial
        let sequence = [];
        const targetSequence = ['t', 'r', 'i', 'p', 'i', 'n', 'h', 'a'];
        
        document.addEventListener('keydown', (e) => {
            sequence.push(e.key.toLowerCase());
            
            if (sequence.length > targetSequence.length) {
                sequence.shift();
            }
            
            if (JSON.stringify(sequence) === JSON.stringify(targetSequence)) {
                this.ativarModoEspecial();
                sequence = [];
            }
        });
        
        // Código Konami para super easter egg
        let konamiSequence = [];
        const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 
                           'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];
        
        document.addEventListener('keydown', (e) => {
            konamiSequence.push(e.code);
            
            if (konamiSequence.length > konamiCode.length) {
                konamiSequence.shift();
            }
            
            if (JSON.stringify(konamiSequence) === JSON.stringify(konamiCode)) {
                this.ativarSuperEasterEgg();
                konamiSequence = [];
            }
        });
    },
    
    /**
     * ✨ Ativar modo especial
     */
    ativarModoEspecial() {
        const avatars = document.querySelectorAll(
            '.tripinha-avatar-principal, .loading-avatar-oficial, .avatar-img-oficial'
        );
        
        avatars.forEach(avatar => {
            avatar.style.filter = 'hue-rotate(180deg) saturate(1.5)';
            avatar.style.animation = 'tripinha-rainbow 2s linear infinite';
        });
        
        this.criarToastEspecial("🌈 Modo Arco-íris da Tripinha ativado! 🐕");
        
        // Adicionar animação rainbow
        this.adicionarAnimacaoRainbow();
        
        // Desativar após 10 segundos
        setTimeout(() => {
            avatars.forEach(avatar => {
                avatar.style.filter = '';
                avatar.style.animation = '';
            });
        }, 10000);
    },
    
    /**
     * 🌈 Adicionar animação rainbow
     */
    adicionarAnimacaoRainbow() {
        if (document.getElementById('tripinha-rainbow-style')) return;
        
        const style = document.createElement('style');
        style.id = 'tripinha-rainbow-style';
        style.textContent = `
            @keyframes tripinha-rainbow {
                0% { filter: hue-rotate(0deg) saturate(1.5); }
                25% { filter: hue-rotate(90deg) saturate(1.5); }
                50% { filter: hue-rotate(180deg) saturate(1.5); }
                75% { filter: hue-rotate(270deg) saturate(1.5); }
                100% { filter: hue-rotate(360deg) saturate(1.5); }
            }
        `;
        document.head.appendChild(style);
    },
    
    /**
     * 🚀 Ativar super easter egg
     */
    ativarSuperEasterEgg() {
        // Criar múltiplas Tripinhas flutuantes
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.criarTripinhaFlutuante();
            }, i * 200);
        }
        
        this.criarToastEspecial("🚀 SUPER TRIPINHA ACTIVATED! 🐕✨");
    },
    
    /**
     * 🎈 Criar Tripinha flutuante
     */
    criarTripinhaFlutuante() {
        const tripinhaFlutuante = document.createElement('img');
        tripinhaFlutuante.src = 'assets/images/tripinha-avatar-oficial.png';
        tripinhaFlutuante.style.cssText = `
            position: fixed;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: 2px solid #E87722;
            z-index: 9999;
            pointer-events: none;
            animation: tripinha-float ${3 + Math.random() * 2}s ease-in-out infinite;
        `;
        
        // Posição inicial aleatória
        tripinhaFlutuante.style.left = Math.random() * window.innerWidth + 'px';
        tripinhaFlutuante.style.top = window.innerHeight + 'px';
        
        document.body.appendChild(tripinhaFlutuante);
        
        // Adicionar animação de flutuação
        this.adicionarAnimacaoFloat();
        
        // Remover após animação
        setTimeout(() => {
            tripinhaFlutuante.remove();
        }, 8000);
    },
    
    /**
     * 🎈 Adicionar animação de flutuação
     */
    adicionarAnimacaoFloat() {
        if (document.getElementById('tripinha-float-style')) return;
        
        const style = document.createElement('style');
        style.id = 'tripinha-float-style';
        style.textContent = `
            @keyframes tripinha-float {
                0% { 
                    transform: translateY(0) rotate(0deg) scale(1);
                    opacity: 0;
                }
                10% { 
                    opacity: 1;
                }
                50% { 
                    transform: translateY(-${window.innerHeight + 100}px) 
                               rotate(180deg) scale(1.2);
                    opacity: 1;
                }
                90% {
                    opacity: 1;
                }
                100% { 
                    transform: translateY(-${window.innerHeight + 200}px) 
                               rotate(360deg) scale(0.8);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
};

// 🚀 Auto-inicialização quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        TRIPINHA_INTERACTIONS.init();
    });
} else {
    TRIPINHA_INTERACTIONS.init();
}

// 🌍 Exportar para uso global
window.TRIPINHA_INTERACTIONS = TRIPINHA_INTERACTIONS;
