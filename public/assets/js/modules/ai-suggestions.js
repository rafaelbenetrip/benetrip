/**
 * Módulo para integração com IA
 * Obtém sugestões personalizadas para o roteiro
 */
(function() {
    'use strict';

    // Namespace global
    window.BenetripApp = window.BenetripApp || {};

    const AISuggestions = {
        /**
         * Obtém sugestões personalizadas para o roteiro
         * @param {Object} destination - Dados do destino
         * @param {Object} preferences - Preferências do usuário
         * @param {Object} flight - Dados do voo selecionado
         * @returns {Promise<Object>} Sugestões personalizadas
         */
        getItinerarySuggestions: async function(destination, preferences, flight) {
            try {
                // Prepara os dados para enviar à API
                const requestData = {
                    destination: destination,
                    preferences: preferences,
                    flight: flight,
                    dates: {
                        arrival: flight.departureDate,
                        departure: flight.returnDate
                    }
                };
                
                // Chama a API de geração de roteiro
                const response = await fetch('/api/itinerary-generator', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                });
                
                if (!response.ok) {
                    throw new Error('Falha ao obter sugestões personalizadas');
                }
                
                const suggestions = await response.json();
                return suggestions;
                
            } catch (error) {
                console.error('Erro ao buscar sugestões:', error);
                // Em caso de erro, retorna roteiro básico
                return this.generateBasicItinerary(destination, preferences, flight);
            }
        },
        
        /**
         * Gera um roteiro básico se a chamada à IA falhar
         */
        generateBasicItinerary: function(destination, preferences, flight) {
            const departureDate = new Date(flight.departureDate);
            const returnDate = new Date(flight.returnDate);
            const totalDays = Math.ceil((returnDate - departureDate) / (1000 * 60 * 60 * 24)) + 1;
            
            // Obtém tipo de companhia para personalizar dicas
            let companhiaTexto = 'você';
            
            if (preferences.companhia === 1) {
                companhiaTexto = 'vocês dois';
            } else if (preferences.companhia === 2) {
                companhiaTexto = 'toda a família';
            } else if (preferences.companhia === 3) {
                companhiaTexto = 'a turma';
            }
            
            // Determina tipo de atividades com base nas preferências
            let tipoAtividade = 'relaxar e curtir';
            
            if (preferences.preferencia_viagem === 1) {
                tipoAtividade = 'aventuras e atividades ao ar livre';
            } else if (preferences.preferencia_viagem === 2) {
                tipoAtividade = 'atrações culturais e históricas';
            } else if (preferences.preferencia_viagem === 3) {
                tipoAtividade = 'vida urbana e compras';
            }
            
            // Roteiro básico
            const basicItinerary = {
                days: []
            };
            
            // Gera dias do roteiro
            for (let i = 0; i < totalDays; i++) {
                const currentDate = new Date(departureDate);
                currentDate.setDate(departureDate.getDate() + i);
                
                // Primeiro dia - chegada
                if (i === 0) {
                    basicItinerary.days.push({
                        description: `Depois de pousar, hora sentir o clima de ${destination.city} com calma: um passeio pelo centro, uma refeição local, e descansar para os próximos dias.`,
                        tip: `Dica da Tripinha: Experimentem a gastronomia local logo no primeiro dia para ${companhiaTexto} entrar no clima da viagem!`,
                        activities: [
                            {
                                time: 'Chegada',
                                location: 'Centro da cidade',
                                description: 'Passeio de reconhecimento'
                            }
                        ]
                    });
                }
                // Último dia - partida
                else if (i === totalDays - 1) {
                    basicItinerary.days.push({
                        description: `Último dia em ${destination.city}! Aproveite para fazer compras e relaxar antes do voo de volta.`,
                        tip: `Dica da Tripinha: Deixe as malas organizadas com antecedência para ${companhiaTexto} aproveitar ao máximo as últimas horas!`,
                        activities: [
                            {
                                time: 'Manhã',
                                location: 'Mercado local',
                                description: 'Compras de lembranças'
                            }
                        ]
                    });
                }
                // Dias intermediários
                else {
                    basicItinerary.days.push({
                        description: `Dia perfeito para explorar ${destination.city} e aproveitar ${tipoAtividade}.`,
                        tip: `Dica da Tripinha: Pesquise antes sobre ingressos online para atrações populares. Assim ${companhiaTexto} economiza tempo!`,
                        activities: [
                            {
                                time: 'Dia inteiro',
                                location: 'Principais atrações',
                                description: `Explore as melhores ${tipoAtividade} da cidade`
                            }
                        ]
                    });
                }
            }
            
            return basicItinerary;
        }
    };

    // Expõe o módulo globalmente
    window.BenetripApp.AISuggestions = AISuggestions;
})();
