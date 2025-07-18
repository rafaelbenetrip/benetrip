/**
 * BENETRIP - Chat Otimizado para Fluidez
 * Melhorias de performance e experiência do usuário
 */

const BENETRIP_CHAT_OPTIMIZED = {
    config: {
        // Delays reduzidos para maior fluidez
        typingDelay: 25, // Reduzido de 50ms para 25ms
        messageDelay: 400, // Reduzido de 800ms para 400ms
        scrollDuration: 300, // Animação de scroll suave
        transitionDuration: 200, // Transições rápidas
        
        // Configurações de animação
        easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)', // Easing suave
        prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    },

    /**
     * Sistema de scroll inteligente e suave
     */
    smoothScrollToBottom() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        // Verificar se o usuário está próximo do final
        const isNearBottom = chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 100;
        
        if (isNearBottom || this.shouldAutoScroll) {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: this.config.prefersReducedMotion ? 'auto' : 'smooth'
            });
        }
    },

    /**
     * Sistema de digitação otimizado com controle de velocidade adaptativa
     */
    typeMessage(element, text, callback) {
        if (this.config.prefersReducedMotion) {
            element.textContent = text;
            callback && callback();
            return;
        }

        let i = 0;
        const words = text.split(' ');
        let currentWordIndex = 0;
        let currentCharInWord = 0;

        const typeChar = () => {
            if (currentWordIndex >= words.length) {
                callback && callback();
                return;
            }

            const currentWord = words[currentWordIndex];
            
            if (currentCharInWord === 0 && currentWordIndex > 0) {
                element.textContent += ' ';
            }

            if (currentCharInWord < currentWord.length) {
                element.textContent += currentWord[currentCharInWord];
                currentCharInWord++;
                
                // Velocidade variável: pontuação mais lenta, letras normais
                const char = currentWord[currentCharInWord - 1];
                const delay = /[.!?]/.test(char) ? this.config.typingDelay * 3 : this.config.typingDelay;
                
                setTimeout(typeChar, delay);
            } else {
                currentWordIndex++;
                currentCharInWord = 0;
                setTimeout(typeChar, this.config.typingDelay * 2); // Pausa entre palavras
            }
        };

        element.textContent = '';
        typeChar();
    },

    /**
     * Sistema de transições fluidas entre perguntas
     */
    transitionToNextQuestion() {
        return new Promise((resolve) => {
            const chatMessages = document.getElementById('chat-messages');
            const lastMessage = chatMessages.lastElementChild;
            
            if (lastMessage) {
                // Fade out da mensagem anterior se necessário
                lastMessage.style.transition = `opacity ${this.config.transitionDuration}ms ${this.config.easing}`;
                lastMessage.style.opacity = '0.7';
                
                setTimeout(() => {
                    lastMessage.style.opacity = '1';
                    resolve();
                }, this.config.transitionDuration / 2);
            } else {
                resolve();
            }
        });
    },

    /**
     * Pré-carregamento inteligente de recursos
     */
    preloadResources() {
        // Pré-carregar imagens da Tripinha
        const imagesToPreload = [
            'assets/images/tripinha/avatar-normal.png',
            'assets/images/tripinha/avatar-pensando.png',
            'assets/images/tripinha/avatar-animada.png'
        ];

        imagesToPreload.forEach(src => {
            const img = new Image();
            img.src = src;
        });

        // Pré-carregar Flatpickr se ainda não estiver disponível
        if (typeof flatpickr === 'undefined') {
            this.loadFlatpickr();
        }
    },

    /**
     * Carregamento assíncrono otimizado do Flatpickr
     */
    async loadFlatpickr() {
        if (window.flatpickrLoading) return window.flatpickrLoading;
        
        window.flatpickrLoading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js';
            script.onload = () => {
                console.log('Flatpickr carregado');
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });

        return window.flatpickrLoading;
    },

    /**
     * Sistema de feedback visual em tempo real
     */
    addVisualFeedback(element, type = 'success') {
        const feedback = document.createElement('div');
        feedback.className = `visual-feedback feedback-${type}`;
        
        const styles = {
            success: { background: '#4CAF50', icon: '✓' },
            error: { background: '#F44336', icon: '✕' },
            loading: { background: '#FF9800', icon: '⟳' }
        };

        feedback.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            width: 24px;
            height: 24px;
            background: ${styles[type].background};
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            transform: scale(0);
            transition: transform 0.2s ${this.config.easing};
            z-index: 10;
        `;

        feedback.textContent = styles[type].icon;
        element.style.position = 'relative';
        element.appendChild(feedback);

        // Animar entrada
        requestAnimationFrame(() => {
            feedback.style.transform = 'scale(1)';
        });

        // Remover após delay
        setTimeout(() => {
            feedback.style.transform = 'scale(0)';
            setTimeout(() => feedback.remove(), 200);
        }, 1500);
    },

    /**
     * Debounce inteligente para inputs
     */
    createSmartDebounce(func, wait, immediate = false) {
        let timeout;
        let lastCallTime = 0;
        
        return function executedFunction(...args) {
            const callNow = immediate && !timeout;
            const currentTime = Date.now();
            
            // Se a última chamada foi muito recente, aumentar o delay
            const dynamicWait = (currentTime - lastCallTime < wait) ? wait * 1.5 : wait;
            
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                timeout = null;
                if (!immediate) func.apply(this, args);
                lastCallTime = Date.now();
            }, dynamicWait);
            
            if (callNow) {
                func.apply(this, args);
                lastCallTime = currentTime;
            }
        };
    },

    /**
     * Sistema de cache para melhorar performance
     */
    cache: new Map(),
    
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutos
            return cached.data;
        }
        return null;
    },

    setCached(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    },

    /**
     * Otimização de autocomplete com cache
     */
    optimizedAutocomplete(inputElement, searchFunction) {
        const resultsContainer = inputElement.nextElementSibling;
        let currentRequest = null;

        const debouncedSearch = this.createSmartDebounce(async (query) => {
            if (query.length < 2) {
                resultsContainer.innerHTML = '';
                return;
            }

            // Verificar cache primeiro
            const cacheKey = `autocomplete_${query.toLowerCase()}`;
            const cached = this.getCached(cacheKey);
            
            if (cached) {
                this.renderAutocompleteResults(resultsContainer, cached);
                return;
            }

            // Cancelar request anterior
            if (currentRequest) {
                currentRequest.abort();
            }

            // Novo request
            currentRequest = new AbortController();
            
            try {
                resultsContainer.innerHTML = '<div class="loading-autocomplete">🔍 Buscando...</div>';
                
                const results = await searchFunction(query, { signal: currentRequest.signal });
                this.setCached(cacheKey, results);
                this.renderAutocompleteResults(resultsContainer, results);
                
            } catch (error) {
                if (error.name !== 'AbortError') {
                    resultsContainer.innerHTML = '<div class="error">❌ Erro na busca</div>';
                }
            }
        }, 250);

        inputElement.addEventListener('input', (e) => {
            debouncedSearch(e.target.value.trim());
        });
    },

    /**
     * Renderização otimizada de resultados de autocomplete
     */
    renderAutocompleteResults(container, results) {
        if (!results || results.length === 0) {
            container.innerHTML = '<div class="no-results">🔍 Nenhum resultado</div>';
            return;
        }

        // Usar DocumentFragment para melhor performance
        const fragment = document.createDocumentFragment();
        
        results.slice(0, 10).forEach(item => { // Limitar a 10 resultados
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.innerHTML = `
                <div class="item-code">${item.code}</div>
                <div class="item-details">
                    <div class="item-name">${item.name}</div>
                    <div class="item-country">${item.country_name}</div>
                </div>
            `;
            
            div.addEventListener('click', () => this.selectAutocompleteItem(item));
            fragment.appendChild(div);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
    },

    /**
     * Animações de microinteração
     */
    addMicroInteraction(element, type = 'tap') {
        const animations = {
            tap: 'transform: scale(0.95); transition: transform 0.1s ease;',
            hover: 'transform: translateY(-2px); transition: transform 0.2s ease;',
            focus: 'box-shadow: 0 0 0 3px rgba(232, 119, 34, 0.3); transition: box-shadow 0.2s ease;'
        };

        if (type === 'tap') {
            element.addEventListener('touchstart', () => {
                element.style.cssText += animations.tap;
            });
            
            element.addEventListener('touchend', () => {
                element.style.transform = 'scale(1)';
            });
        }
    },

    /**
     * Sistema de vibração para feedback tátil (mobile)
     */
    hapticFeedback(type = 'light') {
        if ('vibrate' in navigator) {
            const patterns = {
                light: [10],
                medium: [20],
                heavy: [30],
                double: [10, 10, 10]
            };
            navigator.vibrate(patterns[type] || patterns.light);
        }
    },

    /**
     * Otimização do calendário com carregamento lazy
     */
    async initOptimizedCalendar(elementId, config) {
        // Garantir que Flatpickr está carregado
        if (typeof flatpickr === 'undefined') {
            await this.loadFlatpickr();
        }

        const element = document.getElementById(elementId);
        if (!element) return null;

        // Configuração otimizada
        const optimizedConfig = {
            ...config,
            animationDuration: this.config.prefersReducedMotion ? 0 : 150,
            // Usar RAF para melhor performance
            onChange: (...args) => {
                requestAnimationFrame(() => {
                    if (config.onChange) config.onChange(...args);
                });
            }
        };

        return flatpickr(element, optimizedConfig);
    },

    /**
     * Sistema de monitoramento de performance
     */
    performanceMonitor: {
        marks: new Map(),
        
        mark(name) {
            this.marks.set(name, performance.now());
        },
        
        measure(name, startMark) {
            const start = this.marks.get(startMark);
            const end = performance.now();
            const duration = end - start;
            
            if (duration > 100) { // Log apenas se demorar mais que 100ms
                console.warn(`Performance: ${name} took ${duration.toFixed(2)}ms`);
            }
            
            return duration;
        }
    }
};

// Integração com o sistema existente
if (window.BENETRIP) {
    // Sobrescrever métodos para versões otimizadas
    window.BENETRIP.rolarParaFinal = BENETRIP_CHAT_OPTIMIZED.smoothScrollToBottom;
    window.BENETRIP.config.animationDelay = BENETRIP_CHAT_OPTIMIZED.config.messageDelay;
    
    // Inicializar otimizações
    document.addEventListener('DOMContentLoaded', () => {
        BENETRIP_CHAT_OPTIMIZED.preloadResources();
    });
}

// Exportar para uso global
window.BENETRIP_CHAT_OPTIMIZED = BENETRIP_CHAT_OPTIMIZED;
