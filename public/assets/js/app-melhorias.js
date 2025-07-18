/**
 * BENETRIP - Melhorias Simples para Fluidez
 * Versão simplificada sem dependências externas
 */

// Aguardar o BENETRIP estar disponível
(function() {
    'use strict';
    
    function aplicarMelhoriasSimples() {
        if (typeof BENETRIP === 'undefined') {
            setTimeout(aplicarMelhoriasSimples, 100);
            return;
        }
        
        console.log("📱 Aplicando melhorias de fluidez...");
        
        // ===== 1. DELAYS MAIS RÁPIDOS =====
        if (BENETRIP.config) {
            BENETRIP.config.animationDelay = 400; // Reduzido de 800ms
        }
        
        // ===== 2. SCROLL SUAVE MELHORADO =====
        const scrollOriginal = BENETRIP.rolarParaFinal;
        BENETRIP.rolarParaFinal = function() {
            const chatMessages = document.getElementById('chat-messages');
            if (!chatMessages) return;
            
            // Verificar se usuário está próximo do final
            const isNearBottom = chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 100;
            
            if (isNearBottom) {
                chatMessages.scrollTo({
                    top: chatMessages.scrollHeight,
                    behavior: 'smooth'
                });
            }
        };
        
        // ===== 3. FEEDBACK VISUAL SIMPLES =====
        function adicionarFeedbackVisual(elemento, tipo = 'success') {
            const cores = {
                success: '#4CAF50',
                error: '#F44336',
                info: '#2196F3'
            };
            
            const feedback = document.createElement('div');
            feedback.innerHTML = tipo === 'success' ? '✓' : (tipo === 'error' ? '✕' : 'i');
            feedback.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                width: 20px;
                height: 20px;
                background: ${cores[tipo]};
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                opacity: 0;
                transform: scale(0);
                transition: all 0.3s ease;
                z-index: 10;
                pointer-events: none;
            `;
            
            elemento.style.position = 'relative';
            elemento.appendChild(feedback);
            
            // Mostrar feedback
            requestAnimationFrame(() => {
                feedback.style.opacity = '1';
                feedback.style.transform = 'scale(1)';
            });
            
            // Remover após 1.5s
            setTimeout(() => {
                feedback.style.opacity = '0';
                feedback.style.transform = 'scale(0)';
                setTimeout(() => feedback.remove(), 300);
            }, 1500);
        }
        
        // ===== 4. VIBRAÇÃO MÓVEL =====
        function vibrarMobile(intensidade = 'light') {
            if ('vibrate' in navigator) {
                const padroes = {
                    light: [10],
                    medium: [20],
                    heavy: [30]
                };
                navigator.vibrate(padroes[intensidade] || padroes.light);
            }
        }
        
        // ===== 5. MELHORIAS NA RESPOSTA DO USUÁRIO =====
        const processarRespostaOriginal = BENETRIP.processarResposta;
        BENETRIP.processarResposta = function(valor, pergunta) {
            // Vibração ao selecionar resposta
            vibrarMobile('light');
            
            // Chamar função original
            processarRespostaOriginal.call(this, valor, pergunta);
        };
        
        // ===== 6. OTIMIZAÇÃO DOS BOTÕES =====
        function otimizarBotoes() {
            // Adicionar efeitos aos botões de opção
            document.addEventListener('click', function(e) {
                if (e.target.classList.contains('option-button')) {
                    // Feedback visual
                    adicionarFeedbackVisual(e.target, 'success');
                    
                    // Vibração
                    vibrarMobile('medium');
                    
                    // Efeito visual no botão
                    e.target.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                    }, 150);
                }
            });
        }
        
        // ===== 7. ANIMAÇÕES CSS DINÂMICAS =====
        function adicionarEstilosOtimizados() {
            const style = document.createElement('style');
            style.textContent = `
                /* Animações mais fluidas */
                .chat-message {
                    animation: messageSlideIn 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
                }
                
                @keyframes messageSlideIn {
                    0% {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                /* Botões mais responsivos */
                .option-button {
                    transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
                    transform: translateZ(0);
                }
                
                .option-button:hover {
                    transform: translateY(-2px) scale(1.02);
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                }
                
                .option-button:active {
                    transform: translateY(0) scale(0.98);
                    transition-duration: 0.1s;
                }
                
                /* Scroll suave */
                .chat-messages {
                    scroll-behavior: smooth;
                    overflow-anchor: auto;
                }
                
                /* Calendário mais fluido */
                .flatpickr-day {
                    transition: all 0.2s ease;
                }
                
                .flatpickr-day:hover {
                    transform: scale(1.1);
                    background-color: rgba(232, 119, 34, 0.1) !important;
                }
                
                /* Inputs mais responsivos */
                .text-input, .autocomplete-input, .currency-input {
                    transition: all 0.2s ease;
                }
                
                .text-input:focus, .autocomplete-input:focus, .currency-input:focus {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(232, 119, 34, 0.2);
                }
                
                /* Loading mais suave */
                .thinking-dots span {
                    animation: thinkingPulse 1.2s infinite ease-in-out;
                }
                
                @keyframes thinkingPulse {
                    0%, 100% { 
                        transform: scale(0.8);
                        opacity: 0.5;
                    }
                    50% { 
                        transform: scale(1.2);
                        opacity: 1;
                    }
                }
                
                /* Toasts otimizados */
                .toast {
                    animation: toastSlideUp 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                }
                
                @keyframes toastSlideUp {
                    0% {
                        opacity: 0;
                        transform: translateY(100%) scale(0.95);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                /* Reduzir movimento se necessário */
                @media (prefers-reduced-motion: reduce) {
                    * {
                        animation-duration: 0.01ms !important;
                        transition-duration: 0.01ms !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // ===== 8. OTIMIZAÇÃO DO TOAST =====
        const exibirToastOriginal = BENETRIP.exibirToast;
        if (exibirToastOriginal) {
            BENETRIP.exibirToast = function(mensagem, tipo = 'info') {
                // Vibração baseada no tipo
                const vibracaoMap = {
                    error: 'heavy',
                    success: 'medium',
                    warning: 'light',
                    info: 'light'
                };
                vibrarMobile(vibracaoMap[tipo]);
                
                // Chamar função original
                exibirToastOriginal.call(this, mensagem, tipo);
            };
        }
        
        // ===== 9. OTIMIZAÇÃO DO CALENDÁRIO =====
        const inicializarCalendarioOriginal = BENETRIP.inicializarCalendario;
        if (inicializarCalendarioOriginal) {
            BENETRIP.inicializarCalendario = function(pergunta) {
                console.log("🗓️ Inicializando calendário otimizado...");
                
                // Chamar versão original mas com melhorias
                const resultado = inicializarCalendarioOriginal.call(this, pergunta);
                
                // Adicionar melhorias após inicialização
                setTimeout(() => {
                    const dias = document.querySelectorAll('.flatpickr-day');
                    dias.forEach(dia => {
                        dia.addEventListener('click', () => {
                            vibrarMobile('light');
                        });
                    });
                }, 500);
                
                return resultado;
            };
        }
        
        // ===== 10. INICIALIZAR MELHORIAS =====
        function inicializar() {
            console.log("✅ Melhorias de fluidez aplicadas!");
            
            // Aplicar estilos
            adicionarEstilosOtimizados();
            
            // Otimizar botões
            otimizarBotoes();
            
            // Marcar como aplicado
            window.BENETRIP_MELHORIAS_APLICADAS = true;
            
            // Mostrar confirmação
            setTimeout(() => {
                if (BENETRIP.exibirToast) {
                    BENETRIP.exibirToast("Chat otimizado para melhor fluidez! 🚀", "success");
                }
            }, 1000);
        }
        
        // Executar quando DOM estiver pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', inicializar);
        } else {
            inicializar();
        }
    }
    
    // Iniciar processo
    aplicarMelhoriasSimples();
})();
