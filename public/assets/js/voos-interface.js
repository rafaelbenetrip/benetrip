/**
 * BENETRIP - Script de Interface de Voos
 * Complemento para melhorar a visualização dos voos conforme o protótipo
 * Este script melhora a apresentação da interface sem alterar a lógica principal
 */

// IIFE para evitar poluição do escopo global
(function() {
    // Constantes para elementos DOM frequentemente acessados
    let vooSwipeContainer, tripinhaMessage, flightsSummary, paginationIndicator;
    let btnSelecionar, navControls, activeCardIndex = 0;
    
    // Cores da identidade visual
    const COLORS = {
        orange: '#E87722',
        blue: '#00A3E0',
        white: '#FFFFFF',
        lightGray: '#F5F5F5'
    };
    
    // Mensagens aleatórias da Tripinha
    const TRIPINHA_MESSAGES = [
        "Eu farejei por aí e encontrei alguns voos incríveis para sua aventura! 🐾 Deslize para ver todas as opções!",
        "Olha só quantos voos encontrei para você! ✈️ Analise as opções e escolha a que melhor se encaixa no seu plano!",
        "Woof! 🐶 Achei várias opções de voos que cabem no seu orçamento. Deslize para conferir todas!",
        "Estou aqui com o rabinho balançando de empolgação! Encontrei ótimas opções de voos para você! 🐾"
    ];
    
    // Inicialização quando o DOM estiver pronto
    document.addEventListener('DOMContentLoaded', function() {
        // Verifica se estamos na página de voos
        if (!document.getElementById('voos-container')) return;
        
        console.log('Inicializando interface aprimorada para voos...');
        
        // Inicializa referências DOM
        initDomReferences();
        
        // Configura observador para reagir às mudanças no DOM
        setupObservers();
        
        // Configura eventos da interface
        setupEventListeners();
        
        // Inicia monitoramento da interface principal
        startInterfaceMonitoring();
    });
    
    // Inicializa referências DOM
    function initDomReferences() {
        vooSwipeContainer = document.getElementById('voos-swipe-container');
        tripinhaMessage = document.querySelector('.tripinha-message');
        flightsSummary = document.querySelector('.flights-summary');
        paginationIndicator = document.querySelector('.pagination-indicator');
        btnSelecionar = document.querySelector('.btn-selecionar-voo');
        navControls = document.querySelector('.nav-controls');
    }
    
    // Configuração de observadores para reagir às mudanças no DOM
    function setupObservers() {
        // Observador para quando os voos forem carregados pelo script principal
        const vooContainerObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Procura por cards de voo sendo adicionados
                    for (let i = 0; i < mutation.addedNodes.length; i++) {
                        const node = mutation.addedNodes[i];
                        if (node.classList && node.classList.contains('voo-card')) {
                            enhanceFlightCard(node);
                        }
                    }
                    
                    // Se o container de voos tem cards, atualiza a interface
                    if (vooSwipeContainer.querySelectorAll('.voo-card').length > 0) {
                        updateInterfaceForLoadedFlights();
                    }
                }
            });
        });
        
        // Inicia observação se o container existir
        if (vooSwipeContainer) {
            vooContainerObserver.observe(vooSwipeContainer, { childList: true });
        }
    }
    
    // Configura listeners de eventos para a interface
    function setupEventListeners() {
        // Botão voltar
        const btnVoltar = document.querySelector('.btn-voltar');
        if (btnVoltar) {
            btnVoltar.addEventListener('click', function() {
                // Verificamos se temos o objeto BENETRIP_VOOS e voos carregados
                if (window.BENETRIP_VOOS?.finalResults?.proposals?.length > 0) {
                    if (confirm('Tem certeza? Você perderá os resultados da busca.')) {
                        window.location.href = 'destinos.html';
                    }
                } else {
                    window.location.href = 'destinos.html';
                }
            });
        }
        
        // Controles de navegação
        if (navControls) {
            const prevBtn = navControls.querySelector('.prev-btn');
            const nextBtn = navControls.querySelector('.next-btn');
            
            if (prevBtn) {
                prevBtn.addEventListener('click', function() {
                    navigateToPreviousCard();
                });
            }
            
            if (nextBtn) {
                nextBtn.addEventListener('click', function() {
                    navigateToNextCard();
                });
            }
        }
        
        // Botão de seleção fixo
        if (btnSelecionar) {
            btnSelecionar.addEventListener('click', function() {
                // Integra com a função do script principal se disponível
                if (window.BENETRIP_VOOS && window.BENETRIP_VOOS.selecionarVooAtivo) {
                    window.BENETRIP_VOOS.selecionarVooAtivo();
                } else {
                    console.warn('Função de seleção de voo não disponível no objeto BENETRIP_VOOS');
                    showToast('Selecione um voo primeiro', 'warning');
                }
            });
        }
        
        // Eventos de teclado para navegação
        document.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowLeft') {
                navigateToPreviousCard();
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                navigateToNextCard();
                e.preventDefault();
            } else if (e.key === 'Enter') {
                // Seleciona o voo ativo
                if (window.BENETRIP_VOOS && window.BENETRIP_VOOS.selecionarVooAtivo) {
                    window.BENETRIP_VOOS.selecionarVooAtivo();
                }
                e.preventDefault();
            }
        });
    }
    
    // Melhora a aparência e funcionalidade de um card de voo
    function enhanceFlightCard(cardElement) {
        if (!cardElement || cardElement.dataset.enhanced === 'true') return;
        
        try {
            // Extrai dados do card original
            const cardData = extractCardData(cardElement);
            
            // Aplica o novo template com os dados extraídos
            applyEnhancedTemplate(cardElement, cardData);
            
            // Marca como já melhorado para evitar processamento duplicado
            cardElement.dataset.enhanced = 'true';
            
            // Adiciona handlers de eventos ao card
            setupCardEvents(cardElement);
            
        } catch (error) {
            console.error('Erro ao melhorar card de voo:', error);
        }
    }
    
    // Extrai os dados de um card de voo existente
    function extractCardData(cardElement) {
        const data = {};
        
        try {
            // Extrai preço
            const priceElement = cardElement.querySelector('.preco-valor, .text-xl');
            data.price = priceElement ? priceElement.textContent.trim() : 'N/A';
            
            // Extrai desconto (se houver)
            const discountElement = cardElement.querySelector('.text-xs.bg-green-100');
            data.discount = discountElement ? discountElement.textContent.trim() : null;
            
            // Extrai companhia aérea
            const airlineElement = cardElement.querySelector('.companhia-nome, .text-xs.bg-gray-100');
            data.airline = airlineElement ? airlineElement.textContent.trim() : 'N/A';
            
            // Verifica se é voo direto
            data.isDirect = cardElement.classList.contains('voo-direto');
            
            // Extrai informações de ida
            const departureTimeElement = cardElement.querySelector('.horario .hora:first-child, .font-bold:nth-child(1)');
            data.departureTime = departureTimeElement ? departureTimeElement.textContent.trim() : 'N/A';
            
            const departureAirportElement = cardElement.querySelector('.codigo:first-child, .text-xs.text-gray-600:nth-child(1)');
            data.departureAirport = departureAirportElement ? departureAirportElement.textContent.trim() : 'N/A';
            
            const arrivalTimeElement = cardElement.querySelector('.horario .hora:last-child, .font-bold:nth-child(3)');
            data.arrivalTime = arrivalTimeElement ? arrivalTimeElement.textContent.trim() : 'N/A';
            
            const arrivalAirportElement = cardElement.querySelector('.codigo:last-child, .text-xs.text-gray-600:nth-child(3)');
            data.arrivalAirport = arrivalAirportElement ? arrivalAirportElement.textContent.trim() : 'N/A';
            
            // Extrai duração
            const durationElement = cardElement.querySelector('.duracao, .text-xs.text-center.text-gray-500');
            data.duration = durationElement ? durationElement.textContent.trim() : 'N/A';
            
            // Extrai quantidade de paradas
            const stopsElement = cardElement.querySelector('.paradas, .text-xs.text-center.text-gray-500:nth-child(2)');
            data.stops = stopsElement ? stopsElement.textContent.trim() : (data.isDirect ? 'Voo Direto' : 'N/A');
            
            // Extrai assentos restantes
            const seatsElement = cardElement.querySelector('.bg-orange-100, .bg-orange-100.text-orange-800');
            data.remainingSeats = seatsElement ? seatsElement.textContent.trim() : '?';
            
            // Extrai ID do voo
            data.vooId = cardElement.dataset.vooId || '';
            data.vooIndex = cardElement.dataset.vooIndex || '0';
            
            // Extrai se é melhor preço
            data.isBestPrice = cardElement.classList.contains('voo-melhor-preco') || cardElement.classList.contains('voo-primeiro');
            
            // Extrai se o card é o ativo
            data.isActive = cardElement.classList.contains('voo-card-ativo');
            
        } catch (error) {
            console.error('Erro ao extrair dados do card:', error);
        }
        
        return data;
    }
    
    // Aplica o template aprimorado ao card de voo
    function applyEnhancedTemplate(cardElement, cardData) {
        // Preserva classes importantes do card original
        const originalClasses = Array.from(cardElement.classList)
            .filter(cls => ['voo-card-ativo', 'voo-selecionado', 'voo-primeiro', 'voo-melhor-preco', 'voo-direto'].includes(cls));
        
        // Preserva atributos de dados importantes
        const vooId = cardElement.dataset.vooId;
        const vooIndex = cardElement.dataset.vooIndex;
        
        // Aplica o novo HTML
        cardElement.innerHTML = `
            ${cardData.isBestPrice ? '<div class="card-tag melhor-preco">Melhor preço</div>' : ''}
            ${cardData.isDirect ? '<div class="card-tag voo-direto">Voo Direto</div>' : ''}
            
            <div class="voo-card-header">
                <div class="voo-price">
                    ${cardData.price}
                    ${cardData.discount ? `<span class="discount-badge">${cardData.discount}</span>` : ''}
                </div>
                <div class="voo-price-details">Por pessoa, ida e volta</div>
                <div class="airline-info">${cardData.airline}</div>
            </div>
            
            <div class="voo-card-content">
                <!-- Rota de ida -->
                <div class="flight-route">
                    <div class="route-point">
                        <div class="route-time">${cardData.departureTime}</div>
                        <div class="route-airport">${cardData.departureAirport}</div>
                    </div>
                    <div class="route-line">
                        <div class="route-duration">${cardData.duration}</div>
                        <div class="route-line-bar ${cardData.isDirect ? 'route-line-direct' : ''}">
                            <span class="stop-marker start"></span>
                            ${!cardData.isDirect ? '<span class="stop-marker mid"></span>' : ''}
                            <span class="stop-marker end"></span>
                        </div>
                        <div class="route-stops ${cardData.isDirect ? 'route-stops-direct' : ''}">${cardData.stops}</div>
                    </div>
                    <div class="route-point">
                        <div class="route-time">${cardData.arrivalTime}</div>
                        <div class="route-airport">${cardData.arrivalAirport}</div>
                    </div>
                </div>
                
                <!-- Detalhes adicionais -->
                <div class="flight-details">
                    <div>
                        <span>✓</span> 1 bagagem incluída
                    </div>
                    <div>
                        <span>⏱️</span> Duração: ${cardData.duration}
                    </div>
                </div>
            </div>
            
            <div class="voo-card-footer">
                <button class="btn-detalhes-voo" data-voo-id="${vooId}">Ver detalhes</button>
                <div class="remaining-seats">
                    Restam <span class="seats-number">${cardData.remainingSeats}</span>
                </div>
            </div>
        `;
        
        // Restaura classes e atributos importantes
        originalClasses.forEach(cls => cardElement.classList.add(cls));
        cardElement.dataset.vooId = vooId;
        cardElement.dataset.vooIndex = vooIndex;
    }
    
    // Configura eventos para o card
    function setupCardEvents(cardElement) {
        // Evento de clique no card (seleciona o voo)
        cardElement.addEventListener('click', function(e) {
            // Ignora se clicou no botão de detalhes
            if (e.target.closest('.btn-detalhes-voo')) return;
            
            // Integra com a função de seleção do script principal
            const vooId = cardElement.dataset.vooId;
            if (vooId && window.BENETRIP_VOOS && window.BENETRIP_VOOS.selecionarVoo) {
                window.BENETRIP_VOOS.selecionarVoo(vooId);
            }
        });
        
        // Evento de clique no botão de detalhes
        const btnDetalhes = cardElement.querySelector('.btn-detalhes-voo');
        if (btnDetalhes) {
            btnDetalhes.addEventListener('click', function(e) {
                e.stopPropagation(); // Evita propagar para o card
                
                const vooId = this.dataset.vooId;
                if (vooId && window.BENETRIP_VOOS && window.BENETRIP_VOOS.mostrarDetalhesVoo) {
                    window.BENETRIP_VOOS.mostrarDetalhesVoo(vooId);
                }
            });
        }
    }
    
    // Atualiza a interface quando os voos são carregados
    function updateInterfaceForLoadedFlights() {
        // Obtém a quantidade de voos carregados
        const cards = vooSwipeContainer.querySelectorAll('.voo-card');
        if (!cards.length) return;
        
        console.log(`Atualizando interface para ${cards.length} voos carregados`);
        
        // Atualiza a mensagem da Tripinha com texto aleatório
        updateTripinhaMessage(cards.length);
        
        // Atualiza o contador de voos
        updateFlightCounter(cards.length);
        
        // Cria os indicadores de paginação
        createPaginationIndicators(cards.length);
        
        // Configura gestos de swipe
        setupSwipeGestures();
        
        // Configura a rolagem snap
        setupScrollSnapping();
        
        // Atualiza o botão de seleção fixo com o preço do voo ativo
        updateSelectionButton();
        
        // Adiciona a dica de swipe
        if (cards.length > 1) {
            showSwipeHint();
        }
    }
    
    // Atualiza a mensagem da Tripinha
    function updateTripinhaMessage(flightCount) {
        if (!tripinhaMessage) return;
        
        const randomIndex = Math.floor(Math.random() * TRIPINHA_MESSAGES.length);
        let message = TRIPINHA_MESSAGES[randomIndex];
        
        // Adiciona menção ao número de voos encontrados
        if (flightCount > 0) {
            message = message.replace('alguns voos', `${flightCount} voos`);
        }
        
        const messageBubble = tripinhaMessage.querySelector('.tripinha-bubble');
        if (messageBubble) {
            messageBubble.innerHTML = `<p>${message}</p>`;
        }
    }
    
    // Atualiza o contador de voos
    function updateFlightCounter(flightCount) {
        if (!flightsSummary) return;
        
        const flightsCount = flightsSummary.querySelector('.flights-count');
        if (flightsCount) {
            flightsCount.textContent = flightCount;
        }
    }
    
    // Cria os indicadores de paginação
    function createPaginationIndicators(flightCount) {
        if (!paginationIndicator) return;
        
        // Limpa os indicadores existentes
        paginationIndicator.innerHTML = '';
        
        // Se tiver mais de 15 voos, não mostra todos os dots
        const maxDots = Math.min(flightCount, 10);
        
        for (let i = 0; i < maxDots; i++) {
            const dot = document.createElement('div');
            dot.className = 'pagination-dot';
            if (i === activeCardIndex) {
                dot.classList.add('active');
            }
            dot.dataset.index = i;
            
            // Adiciona evento de clique para ir diretamente para o card
            dot.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                navigateToCard(index);
            });
            
            paginationIndicator.appendChild(dot);
        }
        
        // Se tem mais voos do que mostramos dots, adiciona indicação
        if (flightCount > maxDots) {
            const moreIndicator = document.createElement('div');
            moreIndicator.className = 'pagination-more';
            moreIndicator.textContent = '...';
            paginationIndicator.appendChild(moreIndicator);
        }
    }
    
    // Configura gestos de swipe para navegação
    function setupSwipeGestures() {
        // Verifica se o container existe e se a biblioteca Hammer.js está disponível
        if (!vooSwipeContainer || typeof Hammer === 'undefined') return;
        
        // Remove instância existente
        if (window.voosHammer) {
            window.voosHammer.destroy();
        }
        
        // Cria nova instância
        window.voosHammer = new Hammer(vooSwipeContainer);
        
        // Configura eventos
        window.voosHammer.on('swipeleft', function() {
            navigateToNextCard();
        });
        
        window.voosHammer.on('swiperight', function() {
            navigateToPreviousCard();
        });
    }
    
    // Configura o snap scroll para os cards
    function setupScrollSnapping() {
        if (!vooSwipeContainer) return;
        
        // Configura o evento de scroll para atualizar o card ativo
        vooSwipeContainer.addEventListener('scroll', function() {
            requestAnimationFrame(function() {
                updateActiveCardOnScroll();
            });
        });
    }
    
    // Atualiza qual card é o ativo baseado na posição de scroll
    function updateActiveCardOnScroll() {
        if (!vooSwipeContainer) return;
        
        const scrollLeft = vooSwipeContainer.scrollLeft;
        const cards = vooSwipeContainer.querySelectorAll('.voo-card');
        if (!cards.length) return;
        
        // Calcula a largura aproximada de um card
        const cardWidth = cards[0].offsetWidth;
        
        // Calcula qual deve ser o índice ativo baseado no scroll
        const newActiveIndex = Math.round(scrollLeft / cardWidth);
        
        // Se o índice mudou, atualiza
        if (newActiveIndex !== activeCardIndex && newActiveIndex >= 0 && newActiveIndex < cards.length) {
            navigateToCard(newActiveIndex, false); // false para não rolar automaticamente
        }
    }
    
    // Função para navegar para o próximo card
    function navigateToNextCard() {
        const cards = vooSwipeContainer?.querySelectorAll('.voo-card');
        if (!cards || !cards.length) return;
        
        // Calcula o próximo índice (com loop)
        const nextIndex = (activeCardIndex + 1) % cards.length;
        navigateToCard(nextIndex);
    }
    
    // Função para navegar para o card anterior
    function navigateToPreviousCard() {
        const cards = vooSwipeContainer?.querySelectorAll('.voo-card');
        if (!cards || !cards.length) return;
        
        // Calcula o índice anterior (com loop)
        const prevIndex = (activeCardIndex - 1 + cards.length) % cards.length;
        navigateToCard(prevIndex);
    }
    
    // Função para navegar para um card específico
    function navigateToCard(index, shouldScroll = true) {
        const cards = vooSwipeContainer?.querySelectorAll('.voo-card');
        if (!cards || !cards.length || index < 0 || index >= cards.length) return;
        
        // Remove a classe ativa de todos os cards
        cards.forEach(card => card.classList.remove('voo-card-ativo'));
        
        // Adiciona a classe ativa ao card desejado
        cards[index].classList.add('voo-card-ativo');
        
        // Atualiza o índice ativo
        activeCardIndex = index;
        
        // Atualiza os dots de paginação
        updatePaginationDots();
        
        // Atualiza o botão de seleção
        updateSelectionButton();
        
        // Rola para o card se necessário
        if (shouldScroll && vooSwipeContainer) {
            cards[index].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
        
        // Integra com o script principal
        if (window.BENETRIP_VOOS) {
            // Atualiza o índice do voo ativo
            window.BENETRIP_VOOS.indexVooAtivo = index;
            
            // Atualiza o voo ativo
            if (window.BENETRIP_VOOS.finalResults?.proposals) {
                window.BENETRIP_VOOS.vooAtivo = window.BENETRIP_VOOS.finalResults.proposals[index];
            }
        }
    }
    
    // Atualiza os dots de paginação para refletir o card ativo
    function updatePaginationDots() {
        if (!paginationIndicator) return;
        
        // Remove a classe ativa de todos os dots
        const dots = paginationIndicator.querySelectorAll('.pagination-dot');
        dots.forEach(dot => dot.classList.remove('active'));
        
        // Adiciona a classe ativa ao dot correspondente ao card ativo (se existir)
        const activeIndexStr = activeCardIndex.toString();
        const activeDot = Array.from(dots).find(dot => dot.dataset.index === activeIndexStr);
        if (activeDot) {
            activeDot.classList.add('active');
        }
    }
    
    // Atualiza o botão de seleção fixo com o preço do voo ativo
    function updateSelectionButton() {
        if (!btnSelecionar) return;
        
        try {
            // Obtém o voo ativo através do DOM primeiro
            const activeCard = document.querySelector('.voo-card.voo-card-ativo');
            if (activeCard) {
                const priceElement = activeCard.querySelector('.voo-price');
                if (priceElement) {
                    const priceText = priceElement.textContent.trim().split('\n')[0].trim();
                    btnSelecionar.innerHTML = `
                        <span>Escolher Voo por ${priceText}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7"></path>
                        </svg>
                    `;
                    return;
                }
            }
            
            // Fallback: Usar dados do BENETRIP_VOOS
            if (window.BENETRIP_VOOS?.vooAtivo) {
                const voo = window.BENETRIP_VOOS.vooAtivo;
                
                // Obtém o preço formatado
                let precoFormatado = 'N/A';
                if (window.BENETRIP_VOOS.obterPrecoVoo && window.BENETRIP_VOOS.formatarPreco) {
                    const preco = window.BENETRIP_VOOS.obterPrecoVoo(voo);
                    const moeda = window.BENETRIP_VOOS.finalResults?.meta?.currency || 'BRL';
                    precoFormatado = window.BENETRIP_VOOS.formatarPreco(preco, moeda);
                }
                
                btnSelecionar.innerHTML = `
                    <span>Escolher Voo por ${precoFormatado}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"></path>
                    </svg>
                `;
            }
        } catch (error) {
            console.error('Erro ao atualizar botão de seleção:', error);
        }
    }
    
    // Exibe a dica de swipe
    function showSwipeHint() {
        const hint = document.querySelector('.swipe-hint');
        if (!hint) return;
        
        // Exibe a dica
        hint.style.display = 'flex';
        
        // Configura para ocultar após 4 segundos
        setTimeout(function() {
            hint.style.opacity = '0';
            setTimeout(function() {
                hint.style.display = 'none';
            }, 500);
        }, 4000);
    }
    
    // Inicia monitoramento da interface do script principal
    function startInterfaceMonitoring() {
        // Intervalo para verificar quando os resultados estiverem prontos
        const checkInterval = setInterval(function() {
            if (window.BENETRIP_VOOS?.finalResults?.proposals) {
                console.log('Resultados de voos detectados, melhorando interface...');
                
                // Melhora os cards existentes
                const cards = document.querySelectorAll('.voo-card');
                cards.forEach(enhanceFlightCard);
                
                // Atualiza a interface
                updateInterfaceForLoadedFlights();
                
                // Limpa o intervalo
                clearInterval(checkInterval);
            }
        }, 500);
        
        // Limpa o intervalo após 30 segundos para evitar execução infinita
        setTimeout(function() {
            clearInterval(checkInterval);
        }, 30000);
    }
    
    // Função auxiliar para exibir toast notifications
    function showToast(message, type = 'info', duration = 3000) {
        // Verifica se existe a função global
        if (typeof window.showToast === 'function') {
            window.showToast(message, type, duration);
            return;
        }
        
        // Caso contrário, implementa localmente
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        container.appendChild(toast);
        
        // Trigger reflow para iniciar a animação
        void toast.offsetWidth;
        toast.classList.add('toast-visible');
        
        setTimeout(() => {
            toast.classList.remove('toast-visible');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, duration);
    }
    
    // Expõe funções úteis globalmente
    window.BENETRIP_VOOS_UI = {
        enhanceFlightCard,
        updateInterfaceForLoadedFlights,
        navigateToNextCard,
        navigateToPreviousCard,
        navigateToCard,
        showToast
    };
})();
