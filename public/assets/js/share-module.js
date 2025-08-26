/**
 * BENETRIP SHARE 2.0 - Compartilhamento Inteligente
 * Aproveita TODAS as informações ricas vindas das LLMs
 * Versão que cria narrativas envolventes baseadas nas respostas da IA
 */

const BenetripShareV2 = {
    // Configuração
    config: {
        baseUrl: 'https://benetrip.com.br',
        utm: {
            source: 'share_ai',
            medium: 'social', 
            campaign: 'destinos_inteligentes'
        }
    },

    // Dados ricos das LLMs
    aiData: null,
    destinations: null,

    // Inicialização
    init() {
        console.log('🤖 Inicializando compartilhamento inteligente v2.0...');
        this.loadAIGeneratedData();
        this.injectIntelligentShareUI();
    },

    // Carregar dados RICOS vindos das LLMs (SEM fallbacks genéricos)
    loadAIGeneratedData() {
        try {
            const aiRecommendations = localStorage.getItem('benetrip_recomendacoes');
            if (aiRecommendations) {
                this.destinations = JSON.parse(aiRecommendations);
                
                // Extrair dados específicos da IA
                this.aiData = {
                    raciocinio: this.destinations.raciocinio,
                    tipoViagem: this.destinations.tipoViagem,
                    origem: this.destinations.origem,
                    metadados: this.destinations.metadados,
                    modelo: this.destinations.metadados?.modelo,
                    reasoning_enabled: this.destinations.metadados?.reasoning_enabled
                };
                
                console.log('🧠 Dados ricos da IA carregados:', this.aiData);
                return true;
            }
        } catch (error) {
            console.error('Erro ao carregar dados da IA:', error);
        }
        return false;
    },

    // Gerar compartilhamento baseado no COMENTÁRIO DA TRIPINHA
    generateTripinhaStoryShare(destination) {
        if (!destination.comentario) return null;

        const storyMessages = [
            `🐶 A Tripinha conta:\n\n"${destination.comentario}"\n\n📍 ${destination.destino}, ${destination.pais}`,
            
            `🐾 Experiência real da nossa mascote:\n\n💬 "${destination.comentario}"\n\n✨ ${destination.destino} é especial!`,
            
            `Olha só o que a Tripinha viveu em ${destination.destino}! 🐶\n\n"${destination.comentario}"\n\n${destination.pais} te espera!`
        ];

        return this.addContextualInfo(storyMessages[Math.floor(Math.random() * storyMessages.length)], destination);
    },

    // Gerar compartilhamento baseado na JUSTIFICATIVA DA IA
    generateAIReasoningShare(destination) {
        if (!destination.justificativa && !this.aiData?.raciocinio) return null;

        const reasoning = destination.justificativa || this.aiData.raciocinio?.criterios_selecao || '';
        
        const reasoningMessages = [
            `🤖 Por que a IA escolheu ${destination.destino}?\n\n${reasoning}\n\n🎯 Resultado: destino perfeito para você!`,
            
            `A inteligência artificial analisou seu perfil e concluiu:\n\n"${reasoning}"\n\n📍 ${destination.destino}, ${destination.pais}`,
            
            `🧠 Análise personalizada da IA:\n\n${reasoning}\n\n✨ ${destination.destino} combina 100% com suas vibes!`
        ];

        return this.addContextualInfo(reasoningMessages[Math.floor(Math.random() * reasoningMessages.length)], destination);
    },

    // Gerar compartilhamento com INFORMAÇÕES CLIMÁTICAS específicas
    generateWeatherAwareShare(destination) {
        if (!destination.clima || !destination.clima.temperatura) return null;

        const climate = destination.clima;
        
        const weatherMessages = [
            `🌤️ ${destination.destino} te espera com ${climate.temperatura}!\n\n${climate.estacao} - ${climate.condicoes}\n\n💡 Dica: ${climate.recomendacoes}`,
            
            `Clima perfeito para ${destination.destino}! ☀️\n\n🌡️ ${climate.temperatura}\n🗓️ ${climate.estacao}\n\nPronto para a aventura?`,
            
            `A IA calculou: ${climate.temperatura} em ${destination.destino} durante sua viagem!\n\n${climate.condicoes}\n\n📦 Não esqueça: ${climate.recomendacoes}`
        ];

        return this.addContextualInfo(weatherMessages[Math.floor(Math.random() * weatherMessages.length)], destination);
    },

    // Gerar compartilhamento específico para ROAD TRIPS
    generateRoadTripShare(destination) {
        if (this.aiData?.tipoViagem !== 'carro') return null;

        const roadTripElements = {
            distance: destination.distanciaAproximada || 'Jornada incrível',
            time: destination.tempoEstimadoViagem || 'Tempo ideal',
            route: destination.rotaRecomendada || 'Rota cênica'
        };

        const roadTripMessages = [
            `🚗 Road trip planejada pela IA!\n\n📍 ${destination.destino}\n🛣️ ${roadTripElements.distance}\n⏰ ${roadTripElements.time}\n\nBora pegar a estrada?`,
            
            `Que tal uma aventura de carro até ${destination.destino}? 🚗💨\n\n${roadTripElements.route}\nDistância: ${roadTripElements.distance}\n\nPaisagem garantida!`,
            
            `🗺️ A IA planejou sua road trip perfeita:\n\n${destination.destino}, ${destination.pais}\n${roadTripElements.distance} de pura aventura!`
        ];

        return this.addContextualInfo(roadTripMessages[Math.floor(Math.random() * roadTripMessages.length)], destination);
    },

    // Gerar compartilhamento para viagem RODOVIÁRIA
    generateBusJourneyShare(destination) {
        if (this.aiData?.tipoViagem !== 'rodoviario') return null;

        const busInfo = {
            distance: destination.distanciaRodoviaria || 'Distância econômica',
            time: destination.tempoViagem || 'Viagem confortável'
        };

        const busMessages = [
            `🚌 Viagem de ônibus inteligente!\n\n📍 ${destination.destino}\n⏱️ ${busInfo.time}\n💰 Orçamento otimizado pela IA`,
            
            `Descoberta econômica: ${destination.destino}! 🚌\n\n${busInfo.distance}\nConforto + economia + aventura`,
            
            `A IA encontrou a rota perfeita de ônibus:\n\n${destination.destino}, ${destination.pais}\n${busInfo.time} de viagem`
        ];

        return this.addContextualInfo(busMessages[Math.floor(Math.random() * busMessages.length)], destination);
    },

    // Gerar compartilhamento com PONTOS TURÍSTICOS específicos
    generateAttractionBasedShare(destination) {
        const attractions = destination.pontosTuristicos || [];
        if (attractions.length === 0) return null;

        const mainAttraction = attractions[0];
        const totalAttractions = attractions.length;

        const attractionMessages = [
            `🎯 A IA descobriu: ${mainAttraction} em ${destination.destino}!\n\n${totalAttractions > 1 ? `+ ${totalAttractions - 1} outros pontos incríveis` : ''}\n\nCada cantinho é uma descoberta!`,
            
            `📍 ${destination.destino} esconde tesouros como:\n\n✨ ${mainAttraction}\n${totalAttractions > 1 ? `E mais ${totalAttractions - 1} surpresas te esperando!` : ''}`,
            
            `Olha só o que te espera em ${destination.destino}! 🤩\n\n🏛️ ${mainAttraction}\n${attractions.slice(1, 3).map(a => `🎯 ${a}`).join('\n')}`
        ];

        return this.addContextualInfo(attractionMessages[Math.floor(Math.random() * attractionMessages.length)], destination);
    },

    // Gerar compartilhamento com ANÁLISE DE PERSONALIDADE
    generatePersonalityBasedShare(destination) {
        if (!this.aiData?.raciocinio?.analise_perfil) return null;

        const analysis = this.aiData.raciocinio.analise_perfil;
        
        const personalityMessages = [
            `🎭 A IA analisou sua personalidade:\n\n"${analysis}"\n\nResultado: ${destination.destino} é SUA cara!`,
            
            `Combinação perfeita encontrada! 🎯\n\nSeu perfil + IA = ${destination.destino}\n\n${analysis}`,
            
            `🧠 Análise comportamental da IA:\n\n${analysis}\n\n📍 Destino calibrado: ${destination.destino}, ${destination.pais}`
        ];

        return personalityMessages[Math.floor(Math.random() * personalityMessages.length)];
    },

    // Compartilhamento com MODELO DE IA específico usado
    generateModelBasedShare(destination) {
        const model = this.aiData?.modelo;
        const isReasoning = this.aiData?.reasoning_enabled;
        
        if (!model) return null;

        const modelMessages = [
            `🤖 Gerado por ${model}${isReasoning ? ' (com raciocínio avançado)' : ''}:\n\n${destination.destino}, ${destination.pais}\n\nIA de última geração encontrou SEU destino!`,
            
            `Tecnologia ${isReasoning ? 'de raciocínio' : 'avançada'} em ação! 🧠\n\n${destination.destino} foi escolhido por ${model}\n\nPersonalização 100% precisa`,
            
            `${destination.destino} = resultado de IA ${isReasoning ? 'super inteligente' : 'especializada'}\n\nModelo: ${model}\nPrecisão: 🎯 Máxima`
        ];

        return this.addContextualInfo(modelMessages[Math.floor(Math.random() * modelMessages.length)], destination);
    },

    // Adicionar informações contextuais ricas
    addContextualInfo(baseMessage, destination) {
        let contextualInfo = [];

        // Adicionar informação climática se disponível
        if (destination.clima?.temperatura) {
            contextualInfo.push(`🌡️ ${destination.clima.temperatura}`);
        }

        // Adicionar tipo de viagem
        if (this.aiData?.tipoViagem) {
            const transportEmoji = {
                'carro': '🚗',
                'rodoviario': '🚌', 
                'aereo': '✈️'
            };
            contextualInfo.push(`${transportEmoji[this.aiData.tipoViagem]} Viagem ${this.aiData.tipoViagem}`);
        }

        // Adicionar origem se disponível
        if (this.aiData?.origem?.cidade) {
            contextualInfo.push(`📍 Saindo de ${this.aiData.origem.cidade}`);
        }

        // Montar mensagem final com contexto
        let finalMessage = baseMessage;
        if (contextualInfo.length > 0) {
            finalMessage += '\n\n' + contextualInfo.join(' • ');
        }

        return finalMessage;
    },

    // Escolher a MELHOR estratégia de compartilhamento baseada nos dados disponíveis
    generateSmartShare(destination, type = 'best') {
        const strategies = [];

        // Priorizar estratégias baseado na riqueza dos dados
        if (destination.comentario?.length > 50) {
            strategies.push(() => this.generateTripinhaStoryShare(destination));
        }

        if (destination.justificativa || this.aiData?.raciocinio?.criterios_selecao) {
            strategies.push(() => this.generateAIReasoningShare(destination));
        }

        if (destination.clima?.temperatura) {
            strategies.push(() => this.generateWeatherAwareShare(destination));
        }

        if (this.aiData?.tipoViagem === 'carro') {
            strategies.push(() => this.generateRoadTripShare(destination));
        }

        if (this.aiData?.tipoViagem === 'rodoviario') {
            strategies.push(() => this.generateBusJourneyShare(destination));
        }

        if (destination.pontosTuristicos?.length > 0) {
            strategies.push(() => this.generateAttractionBasedShare(destination));
        }

        if (this.aiData?.raciocinio?.analise_perfil) {
            strategies.push(() => this.generatePersonalityBasedShare(destination));
        }

        if (this.aiData?.modelo) {
            strategies.push(() => this.generateModelBasedShare(destination));
        }

        // Selecionar estratégia baseada no tipo solicitado
        if (type === 'random' && strategies.length > 0) {
            const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)];
            return randomStrategy();
        }

        // Para 'best', usar a primeira estratégia disponível (priorizada)
        for (const strategy of strategies) {
            const result = strategy();
            if (result) return result;
        }

        // Fallback apenas se NADA funcionar (o que é muito raro com dados da IA)
        return `🤖 IA personalizada encontrou: ${destination.destino}, ${destination.pais}!\n\nSeu destino perfeito te espera! 🌟`;
    },

    // Interface de compartilhamento inteligente
    injectIntelligentShareUI() {
        // Botão flutuante com indicação de IA
        const floatingButton = document.createElement('div');
        floatingButton.id = 'smart-share-button';
        floatingButton.className = 'share-floating-button';
        floatingButton.innerHTML = `
            <button class="share-fab smart-share-fab" aria-label="Compartilhamento Inteligente">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12l2 2 4-4"></path>
                    <circle cx="12" cy="12" r="10"></circle>
                </svg>
                <span class="ai-indicator">IA</span>
            </button>
        `;

        // Adicionar estilos para o indicador de IA
        const aiStyles = document.createElement('style');
        aiStyles.textContent = `
            .smart-share-fab {
                position: relative;
                background: linear-gradient(135deg, #E87722 0%, #00A3E0 100%);
            }
            .ai-indicator {
                position: absolute;
                top: -8px;
                right: -8px;
                background: #10B981;
                color: white;
                font-size: 8px;
                font-weight: bold;
                padding: 2px 4px;
                border-radius: 6px;
                border: 1px solid white;
            }
        `;
        document.head.appendChild(aiStyles);
        document.body.appendChild(floatingButton);

        // Evento de click para compartilhamento inteligente
        floatingButton.addEventListener('click', () => this.openIntelligentShareModal());
    },

    // Modal de compartilhamento inteligente
    openIntelligentShareModal() {
        const topPick = this.destinations?.topPick;
        if (!topPick) return;

        // Gerar múltiplas opções inteligentes
        const smartOptions = [
            { 
                type: 'story', 
                title: '🐶 História da Tripinha',
                message: this.generateTripinhaStoryShare(topPick),
                description: 'Experiência autêntica da nossa mascote'
            },
            {
                type: 'reasoning',
                title: '🤖 Análise da IA', 
                message: this.generateAIReasoningShare(topPick),
                description: 'Por que a IA escolheu este destino'
            },
            {
                type: 'weather',
                title: '🌤️ Clima Perfeito',
                message: this.generateWeatherAwareShare(topPick), 
                description: 'Informações climáticas precisas'
            },
            {
                type: 'transport',
                title: this.aiData?.tipoViagem === 'carro' ? '🚗 Road Trip' : 
                      this.aiData?.tipoViagem === 'rodoviario' ? '🚌 Viagem Econômica' : '✈️ Voo Direto',
                message: this.aiData?.tipoViagem === 'carro' ? this.generateRoadTripShare(topPick) :
                        this.aiData?.tipoViagem === 'rodoviario' ? this.generateBusJourneyShare(topPick) :
                        this.generateSmartShare(topPick),
                description: 'Informações específicas do transporte'
            }
        ].filter(option => option.message); // Remove opções sem mensagem

        this.showSmartShareModal(smartOptions);
    },

    // Exibir modal com opções inteligentes
    showSmartShareModal(options) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-blue-50">
                    <div class="flex justify-between items-center">
                        <h3 class="text-lg font-bold text-gray-800">🤖 Compartilhamento Inteligente</h3>
                        <button class="close-modal p-1 hover:bg-gray-100 rounded">✕</button>
                    </div>
                    <p class="text-sm text-gray-600 mt-1">Mensagens geradas pela IA baseadas nas suas preferências</p>
                </div>
                
                <div class="p-4 space-y-4">
                    ${options.map((option, index) => `
                        <div class="smart-share-option border border-gray-200 rounded-lg p-3 hover:border-orange-300 transition-colors cursor-pointer" 
                             data-option-index="${index}">
                            <div class="flex justify-between items-start mb-2">
                                <h4 class="font-medium text-gray-800">${option.title}</h4>
                                <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">IA</span>
                            </div>
                            <p class="text-xs text-gray-500 mb-3">${option.description}</p>
                            <div class="bg-gray-50 p-3 rounded text-sm font-mono text-gray-700 mb-3 max-h-24 overflow-y-auto">
                                ${option.message.substring(0, 150)}${option.message.length > 150 ? '...' : ''}
                            </div>
                            <div class="flex gap-2 text-xs">
                                <button class="share-smart-btn bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600" 
                                        data-platform="whatsapp" data-option="${index}">WhatsApp</button>
                                <button class="share-smart-btn bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600" 
                                        data-platform="facebook" data-option="${index}">Facebook</button>
                                <button class="share-smart-btn bg-black text-white px-3 py-1 rounded hover:bg-gray-800" 
                                        data-platform="twitter" data-option="${index}">X</button>
                                <button class="share-smart-btn bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600" 
                                        data-platform="copy" data-option="${index}">Copiar</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="p-4 border-t border-gray-200 bg-gray-50">
                    <p class="text-xs text-gray-500 text-center">
                        💡 Mensagens personalizadas baseadas em análise de IA ${this.aiData?.modelo || 'avançada'}
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        modal.querySelector('.close-modal').onclick = () => modal.remove();
        modal.onclick = (e) => e.target === modal && modal.remove();

        // Compartilhamento por botão
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('share-smart-btn')) {
                const platform = e.target.dataset.platform;
                const optionIndex = parseInt(e.target.dataset.option);
                const selectedMessage = options[optionIndex].message;
                
                this.shareIntelligentMessage(platform, selectedMessage, options[optionIndex].type);
                modal.remove();
            }
        });
    },

    // Compartilhar mensagem inteligente
    shareIntelligentMessage(platform, message, messageType) {
        const url = `${this.config.baseUrl}?utm_source=${this.config.utm.source}&utm_medium=${platform}&utm_campaign=${messageType}`;
        const fullMessage = `${message}\n\n🤖 Descubra seu destino com IA: ${url}`;

        switch(platform) {
            case 'whatsapp':
                window.open(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`, '_blank');
                break;
            case 'facebook':
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(message)}`, '_blank');
                break;
            case 'twitter':
                const tweetText = fullMessage.length > 250 ? message.substring(0, 200) + '...' : fullMessage;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
                break;
            case 'copy':
                navigator.clipboard.writeText(fullMessage).then(() => {
                    this.showToast('Mensagem inteligente copiada! 🤖');
                });
                break;
        }

        // Track compartilhamento inteligente
        console.log(`🤖 Compartilhamento inteligente: ${platform} - ${messageType}`);
    },

    // Toast notification
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg z-50';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};

// Inicializar automaticamente
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar dados das recomendações estarem disponíveis
    const checkAndInit = () => {
        const hasData = localStorage.getItem('benetrip_recomendacoes');
        if (hasData) {
            BenetripShareV2.init();
        } else {
            setTimeout(checkAndInit, 1000);
        }
    };
    checkAndInit();
});

// Exportar
window.BenetripShareV2 = BenetripShareV2;