/** 
 * BENETRIP - Sistema de Posicionamento Inteligente do Autocomplete
 * Garante que a lista de sugestões seja sempre visível
 */

const BENETRIP_AUTOCOMPLETE_POSITIONING = {
    
    /**
     * Calcula e aplica a posição ideal para a lista de autocomplete
     */
    positionAutocompleteResults(inputElement, resultsContainer) {
        if (!inputElement || !resultsContainer) return;
        
        // Obter dimensões e posição do input
        const inputRect = inputElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        // Calcular espaço disponível abaixo e acima do input
        const spaceBelow = viewportHeight - inputRect.bottom;
        const spaceAbove = inputRect.top;
        
        // Altura estimada da lista (será ajustada dinamicamente)
        const estimatedListHeight = 300;
        const margin = 16;
        
        // Determinar se deve aparecer acima ou abaixo
        const shouldShowAbove = spaceBelow < estimatedListHeight && spaceAbove > spaceBelow;
        
        // Calcular posição horizontal
        const leftPosition = Math.max(margin, Math.min(inputRect.left, viewportWidth - 300 - margin));
        const rightPosition = Math.max(margin, viewportWidth - Math.max(inputRect.right, 300 + margin));
        
        // Aplicar estilos de posicionamento
        resultsContainer.style.position = 'fixed';
        resultsContainer.style.left = `${leftPosition}px`;
        resultsContainer.style.right = `${rightPosition}px`;
        resultsContainer.style.width = 'auto';
        resultsContainer.style.maxWidth = '400px';
        resultsContainer.style.zIndex = '9999';
        
        if (shouldShowAbove) {
            // Mostrar acima do input
            resultsContainer.style.bottom = `${viewportHeight - inputRect.top + 8}px`;
            resultsContainer.style.top = 'auto';
            resultsContainer.style.maxHeight = `${Math.min(spaceAbove - 20, 300)}px`;
            resultsContainer.classList.add('show-above');
        } else {
            // Mostrar abaixo do input
            resultsContainer.style.top = `${inputRect.bottom + 8}px`;
            resultsContainer.style.bottom = 'auto';
            resultsContainer.style.maxHeight = `${Math.min(spaceBelow - 20, 300)}px`;
            resultsContainer.classList.remove('show-above');
        }
        
        // Garantir que a lista seja visível
        this.ensureVisibility(resultsContainer);
    },
    
    /**
     * Garante que a lista de autocomplete seja visível na tela
     */
    ensureVisibility(resultsContainer) {
        if (!resultsContainer) return;
        
        // Forçar scroll suave para mostrar a lista se necessário
        setTimeout(() => {
            const containerRect = resultsContainer.getBoundingClientRect();
            const viewportHeight = window.innerViewportHeight || window.innerHeight;
            
            // Se a lista está parcialmente fora da tela, fazer scroll
            if (containerRect.bottom > viewportHeight) {
                const scrollAmount = containerRect.bottom - viewportHeight + 20;
                this.smoothScrollBy(scrollAmount);
            } else if (containerRect.top < 0) {
                const scrollAmount = containerRect.top - 20;
                this.smoothScrollBy(scrollAmount);
            }
        }, 100);
    },
    
    /**
     * Scroll suave para ajustar a visualização
     */
    smoothScrollBy(amount) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        
        chatMessages.scrollBy({
            top: amount,
            behavior: 'smooth'
        });
    },
    
    /**
     * Cria overlay para destacar o autocomplete quando ativo
     */
    createAutocompleteOverlay() {
        let overlay = document.getElementById('autocomplete-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'autocomplete-overlay';
            overlay.className = 'autocomplete-overlay';
            document.body.appendChild(overlay);
            
            // Fechar autocomplete ao clicar no overlay
            overlay.addEventListener('click', () => {
                this.hideAllAutocompleteResults();
            });
        }
        
        return overlay;
    },
    
    /**
     * Mostra o overlay do autocomplete
     */
    showAutocompleteOverlay() {
        const overlay = this.createAutocompleteOverlay();
        overlay.classList.add('active');
    },
    
    /**
     * Esconde o overlay do autocomplete
     */
    hideAutocompleteOverlay() {
        const overlay = document.getElementById('autocomplete-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    },
    
    /**
     * Esconde todas as listas de autocomplete ativas
     */
    hideAllAutocompleteResults() {
        const allResults = document.querySelectorAll('.autocomplete-results');
        allResults.forEach(results => {
            results.innerHTML = '';
            results.style.display = 'none';
        });
        this.hideAutocompleteOverlay();
    },
    
    /**
     * Monitora mudanças de orientação e redimensionamento
     */
    setupResizeMonitoring() {
        let resizeTimeout;
        
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // Reposicionar todas as listas ativas
                const activeResults = document.querySelectorAll('.autocomplete-results:not(:empty)');
                activeResults.forEach(results => {
                    const container = results.closest('.autocomplete-container');
                    const input = container?.querySelector('.autocomplete-input');
                    if (input && results) {
                        this.positionAutocompleteResults(input, results);
                    }
                });
            }, 150);
        };
        
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        
        // Também monitorar scroll para reposicionar se necessário
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.addEventListener('scroll', _.throttle(() => {
                const activeResults = document.querySelectorAll('.autocomplete-results:not(:empty)');
                activeResults.forEach(results => {
                    const container = results.closest('.autocomplete-container');
                    const input = container?.querySelector('.autocomplete-input');
                    if (input && results) {
                        this.positionAutocompleteResults(input, results);
                    }
                });
            }, 100));
        }
    },
    
    /**
     * Melhora a função de autocomplete existente
     */
    enhanceExistingAutocomplete() {
        // Aguardar que o DOM esteja pronto
        const checkAndEnhance = () => {
            const autocompleteInputs = document.querySelectorAll('.autocomplete-input');
            
            autocompleteInputs.forEach(input => {
                if (input.dataset.enhanced) return; // Já foi melhorado
                
                const container = input.closest('.autocomplete-container');
                const resultsContainer = container?.querySelector('.autocomplete-results');
                
                if (!resultsContainer) return;
                
                // Marcar como melhorado
                input.dataset.enhanced = 'true';
                
                // Interceptar eventos de foco
                input.addEventListener('focus', () => {
                    this.showAutocompleteOverlay();
                    setTimeout(() => {
                        if (resultsContainer.innerHTML.trim()) {
                            this.positionAutocompleteResults(input, resultsContainer);
                        }
                    }, 50);
                });
                
                input.addEventListener('blur', () => {
                    // Delay para permitir cliques nos resultados
                    setTimeout(() => {
                        if (!input.matches(':focus') && !resultsContainer.matches(':hover')) {
                            this.hideAutocompleteOverlay();
                        }
                    }, 150);
                });
                
                // Monitorar mudanças no conteúdo dos resultados
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList' && resultsContainer.innerHTML.trim()) {
                            // Dar tempo para o conteúdo ser renderizado
                            setTimeout(() => {
                                this.positionAutocompleteResults(input, resultsContainer);
                            }, 50);
                        }
                    });
                });
                
                observer.observe(resultsContainer, {
                    childList: true,
                    subtree: true
                });
                
                // Melhorar navegação por teclado
                this.setupKeyboardNavigation(input, resultsContainer);
            });
        };
        
        // Verificar periodicamente por novos elementos
        const intervalId = setInterval(checkAndEnhance, 500);
        
        // Parar verificação após 30 segundos
        setTimeout(() => clearInterval(intervalId), 30000);
        
        // Verificar imediatamente
        checkAndEnhance();
    },
    
    /**
     * Configura navegação por teclado melhorada
     */
    setupKeyboardNavigation(input, resultsContainer) {
        let selectedIndex = -1;
        
        input.addEventListener('keydown', (e) => {
            const items = resultsContainer.querySelectorAll('.autocomplete-item');
            
            if (items.length === 0) return;
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                    this.updateKeyboardSelection(items, selectedIndex);
                    this.scrollToSelected(resultsContainer, items[selectedIndex]);
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, -1);
                    this.updateKeyboardSelection(items, selectedIndex);
                    if (selectedIndex >= 0) {
                        this.scrollToSelected(resultsContainer, items[selectedIndex]);
                    }
                    break;
                    
                case 'Enter':
                    if (selectedIndex >= 0 && items[selectedIndex]) {
                        e.preventDefault();
                        items[selectedIndex].click();
                    }
                    break;
                    
                case 'Escape':
                    resultsContainer.innerHTML = '';
                    this.hideAutocompleteOverlay();
                    break;
            }
        });
        
        // Reset seleção quando novos resultados chegam
        const resetSelection = () => {
            selectedIndex = -1;
        };
        
        new MutationObserver(resetSelection).observe(resultsContainer, {
            childList: true
        });
    },
    
    /**
     * Atualiza seleção visual da navegação por teclado
     */
    updateKeyboardSelection(items, selectedIndex) {
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('keyboard-selected');
                item.setAttribute('aria-selected', 'true');
            } else {
                item.classList.remove('keyboard-selected');
                item.setAttribute('aria-selected', 'false');
            }
        });
    },
    
    /**
     * Faz scroll para o item selecionado por teclado
     */
    scrollToSelected(container, selectedItem) {
        if (!selectedItem) return;
        
        const containerRect = container.getBoundingClientRect();
        const itemRect = selectedItem.getBoundingClientRect();
        
        // Se o item está fora da view do container
        if (itemRect.top < containerRect.top) {
            container.scrollTop -= (containerRect.top - itemRect.top) + 10;
        } else if (itemRect.bottom > containerRect.bottom) {
            container.scrollTop += (itemRect.bottom - containerRect.bottom) + 10;
        }
    },
    
    /**
     * Inicialização do sistema
     */
    init() {
        console.log('Inicializando sistema de posicionamento de autocomplete...');
        
        // Configurar monitoramento de redimensionamento
        this.setupResizeMonitoring();
        
        // Melhorar autocompletion existente
        this.enhanceExistingAutocomplete();
        
        // Configurar para elementos que possam ser adicionados dinamicamente
        document.addEventListener('DOMNodeInserted', (e) => {
            if (e.target.classList && e.target.classList.contains('autocomplete-input')) {
                setTimeout(() => this.enhanceExistingAutocomplete(), 100);
            }
        });
        
        console.log('Sistema de autocomplete melhorado inicializado com sucesso!');
    }
};

// Auto-inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        BENETRIP_AUTOCOMPLETE_POSITIONING.init();
    });
} else {
    BENETRIP_AUTOCOMPLETE_POSITIONING.init();
}

// Integrar com o sistema BENETRIP existente
if (window.BENETRIP) {
    // Melhorar a função de configurar autocomplete existente
    const originalConfigureAutocomplete = window.BENETRIP.configurarAutocomplete;
    
    window.BENETRIP.configurarAutocomplete = function(pergunta) {
        // Chamar função original
        const result = originalConfigureAutocomplete.call(this, pergunta);
        
        // Aplicar melhorias de posicionamento
        setTimeout(() => {
            BENETRIP_AUTOCOMPLETE_POSITIONING.enhanceExistingAutocomplete();
        }, 100);
        
        return result;
    };
}

// Exportar para uso global
window.BENETRIP_AUTOCOMPLETE_POSITIONING = BENETRIP_AUTOCOMPLETE_POSITIONING;
