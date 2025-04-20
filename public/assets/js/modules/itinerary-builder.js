/**
 * Módulo de construção do roteiro
 * Responsável por formatar dados do roteiro para exibição
 */
(function() {
    'use strict';

    // Namespace global
    window.BenetripApp = window.BenetripApp || {};

    const ItineraryBuilder = {
        /**
         * Constrói o roteiro completo
         * @param {Object} destination - Dados do destino
         * @param {Object} preferences - Preferências do usuário
         * @param {Object} flight - Dados do voo selecionado
         * @param {Object} aiSuggestions - Sugestões da IA
         * @param {Object} weather - Dados de clima
         * @returns {Object} Objeto com o roteiro completo
         */
        buildItinerary: function(destination, preferences, flight, aiSuggestions, weather) {
            // Datas da viagem
            const departureDate = new Date(flight.departureDate);
            const returnDate = new Date(flight.returnDate);
            
            // Número de dias
            const totalDays = this.getDaysBetweenDates(departureDate, returnDate) + 1;
            
            // Cria estrutura básica do roteiro
            const itinerary = {
                destination: destination,
                totalDays: totalDays,
                days: []
            };
            
            // Gera cada dia do roteiro
            for (let i = 0; i < totalDays; i++) {
                const currentDate = new Date(departureDate);
                currentDate.setDate(departureDate.getDate() + i);
                
                // Obtém sugestões da IA para este dia
                const daySuggestions = aiSuggestions.days && aiSuggestions.days[i] ? 
                    aiSuggestions.days[i] : this.getDefaultDaySuggestions(i, totalDays);
                
                // Obtém dados climáticos para o dia
                const dayWeather = weather[i] || null;
                
                // Cria objeto do dia
                const day = this.buildDay(
                    i + 1,
                    currentDate,
                    daySuggestions,
                    dayWeather,
                    preferences,
                    i === 0 ? flight.arrivalTime : null,
                    i === totalDays - 1 ? flight.departureTime : null
                );
                
                itinerary.days.push(day);
            }
            
            return itinerary;
        },
        
        /**
         * Constrói os dados de um dia específico
         */
        buildDay: function(dayNumber, date, suggestions, weather, preferences, arrivalTime, departureTime) {
            // Formata data para string ISO
            const dateString = date.toISOString().split('T')[0];
            
            // Determina os badges apropriados com base nas preferências
            const badges = this.getBadgesForPreferences(preferences);
            
            // Cria objeto do dia
            const day = {
                number: dayNumber,
                date: dateString,
                description: suggestions.description || 'Aproveite seu dia!',
                tip: suggestions.tip || 'Dica da Tripinha: Aproveite cada momento!',
                weather: weather,
                activities: []
            };
            
            // Adiciona atividades do dia
            if (suggestions.activities && suggestions.activities.length > 0) {
                suggestions.activities.forEach(activity => {
                    day.activities.push({
                        time: activity.time || (arrivalTime ? `Chegada às ${arrivalTime}` : ''),
                        location: activity.location || '',
                        description: activity.description || '',
                        image: activity.image || '',
                        imageAlt: activity.imageAlt || `Imagem de ${activity.location}`,
                        badges: badges
                    });
                });
            } else {
                // Atividade padrão se não houver sugestões
                day.activities.push({
                    time: arrivalTime ? `Chegada às ${arrivalTime}` : (departureTime ? `Partida às ${departureTime}` : ''),
                    location: 'Explore a cidade',
                    description: 'Aproveite este dia para conhecer a cidade.',
                    image: '',
                    badges: badges
                });
            }
            
            return day;
        },
        
        /**
         * Cria badges apropriados baseados nas preferências
         */
        getBadgesForPreferences: function(preferences) {
            const badges = [];
            
            // Badge "Imperdível" é padrão para atividades principais
            badges.push({
                type: 'primary',
                text: 'Imperdível'
            });
            
            // Badge baseado no tipo de grupo
            if (preferences.companhia === 2) { // Família
                badges.push({
                    type: 'success',
                    text: 'Ideal para família'
                });
            } else if (preferences.companhia === 1) { // Casal
                badges.push({
                    type: 'success',
                    text: 'Romântico'
                });
            } else if (preferences.companhia === 3) { // Amigos
                badges.push({
                    type: 'success',
                    text: 'Para grupos'
                });
            }
            
            // Badge baseado nas preferências de viagem
            if (preferences.preferencia_viagem === 0) { // Relaxar
                badges.push({
                    type: 'info',
                    text: 'Relaxante'
                });
            } else if (preferences.preferencia_viagem === 1) { // Aventura
                badges.push({
                    type: 'info',
                    text: 'Aventura'
                });
            } else if (preferences.preferencia_viagem === 2) { // Cultura
                badges.push({
                    type: 'info',
                    text: 'Cultural'
                });
            } else if (preferences.preferencia_viagem === 3) { // Urbano
                badges.push({
                    type: 'purple',
                    text: 'Urbano'
                });
            }
            
            return badges;
        },
        
        /**
         * Determina número de dias entre duas datas
         */
        getDaysBetweenDates: function(startDate, endDate) {
            const difference = endDate.getTime() - startDate.getTime();
            return Math.ceil(difference / (1000 * 3600 * 24));
        },
        
        /**
         * Gera sugestões padrão para um dia
         */
        getDefaultDaySuggestions: function(dayIndex, totalDays) {
            // Primeiro dia
            if (dayIndex === 0) {
                return {
                    description: "Depois de pousar, hora sentir o clima da cidade com calma: faça um passeio pela região central, experimente a culinária local e descanse para os próximos dias.",
                    tip: "Procure restaurantes autênticos onde os moradores locais comem para ter uma experiência gastronômica genuína!",
                    activities: [
                        {
                            time: "Tarde",
                            location: "Centro da cidade",
                            description: "Passeio pelo centro histórico"
                        }
                    ]
                };
            }
            // Último dia
            else if (dayIndex === totalDays - 1) {
                return {
                    description: "Último dia de viagem! Aproveite para fazer compras de últimos souvenirs e relaxar antes do voo de volta.",
                    tip: "Reserve tempo suficiente para o check-in no aeroporto e organize suas malas com antecedência!",
                    activities: [
                        {
                            time: "Manhã",
                            location: "Mercado local",
                            description: "Compras de lembranças"
                        }
                    ]
                };
            }
            // Dias intermediários
            else {
                return {
                    description: "Explore as principais atrações da cidade.",
                    tip: "Pesquise sobre passes de transporte público para economizar durante seus deslocamentos!",
                    activities: [
                        {
                            time: "Dia inteiro",
                            location: "Atrações turísticas",
                            description: "Visita aos pontos turísticos"
                        }
                    ]
                };
            }
        }
    };

    // Expõe o módulo globalmente
    window.BenetripApp.ItineraryBuilder = ItineraryBuilder;
})();
