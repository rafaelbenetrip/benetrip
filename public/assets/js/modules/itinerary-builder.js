/**
 * Módulo responsável por construir o roteiro personalizado
 * baseado nas preferências do usuário e dados do destino
 */
(function() {
    'use strict';

    // Definição do namespace global se não existir
    window.BenetripApp = window.BenetripApp || {};

    // Objeto do módulo
    const ItineraryBuilder = {
        /**
         * Constrói a estrutura de dados do roteiro completo
         * @param {Object} destination - Informações do destino
         * @param {Object} preferences - Preferências do usuário
         * @param {Object} flight - Dados do voo selecionado
         * @param {Object} aiSuggestions - Sugestões da IA (opcional)
         * @param {Object} weather - Dados de previsão do tempo (opcional)
         * @returns {Object} Roteiro completo
         */
        buildItinerary: function(destination, preferences, flight, aiSuggestions = null, weather = null) {
            try {
                // Extrair datas
                const departureDate = new Date(flight.departureDate);
                const returnDate = new Date(flight.returnDate);
                
                // Calcular número de dias
                const totalDays = this.getDaysBetweenDates(departureDate, returnDate) + 1;
                
                // Estrutura base do roteiro
                const itinerary = {
                    destination: destination,
                    preferences: preferences,
                    flight: flight,
                    totalDays: totalDays,
                    days: []
                };
                
                // Gerar dados para cada dia
                for (let i = 0; i < totalDays; i++) {
                    const currentDate = new Date(departureDate);
                    currentDate.setDate(departureDate.getDate() + i);
                    
                    // Obter sugestões da IA para o dia, se disponíveis
                    const daySuggestions = aiSuggestions && aiSuggestions.days && aiSuggestions.days[i] 
                        ? aiSuggestions.days[i] 
                        : this.getDefaultDaySuggestions(i, totalDays, preferences);
                    
                    // Obter dados de clima para o dia, se disponíveis
                    const dayWeather = weather && weather[i] ? weather[i] : null;
                    
                    // Construir objeto para o dia
                    const day = this.buildDay(
                        i + 1,
                        currentDate,
                        destination,
                        preferences,
                        daySuggestions,
                        dayWeather,
                        i === 0 ? flight.arrivalTime : null,
                        i === totalDays - 1 ? flight.departureTime : null
                    );
                    
                    itinerary.days.push(day);
                }
                
                return itinerary;
            } catch (error) {
                console.error('Erro ao construir roteiro:', error);
                return this.buildFallbackItinerary(destination, preferences, flight);
            }
        },
        
        /**
         * Constrói os dados para um dia específico
         */
        buildDay: function(dayNumber, date, destination, preferences, suggestions, weather, arrivalTime, departureTime) {
            // Badges para a atividade principal
            const badges = this.getBadgesForPreferences(preferences);
            
            // Estrutura base para o dia
            const day = {
                number: dayNumber,
                date: date.toISOString().split('T')[0],
                weekday: this.getWeekdayName(date.getDay()),
                formattedDate: this.formatDate(date),
                description: suggestions.description || `Dia ${dayNumber} em ${destination.city}`,
                tip: suggestions.tip || 'Aproveite seu dia!',
                weather: weather ? {
                    icon: weather.icon || '🌤️',
                    temperature: weather.temperature || '25',
                    condition: weather.condition || 'Parcialmente nublado'
                } : null,
                activities: []
            };
            
            // Adicionar atividade principal
            if (suggestions.activities && suggestions.activities.length > 0) {
                const mainActivity = suggestions.activities[0];
                const activityTime = mainActivity.time || (arrivalTime ? `Chegada às ${arrivalTime}` : (departureTime ? `Partida às ${departureTime}` : ''));
                
                day.activities.push({
                    time: activityTime,
                    location: mainActivity.location || 'Local a ser definido',
                    description: mainActivity.description || 'Atividade recomendada',
                    image: mainActivity.image || '',
                    imageAlt: mainActivity.imageAlt || `Imagem de ${mainActivity.location} em ${destination.city}`,
                    badges: badges
                });
            } else {
                // Atividade genérica se não houver sugestões
                day.activities.push({
                    time: arrivalTime ? `Chegada às ${arrivalTime}` : (departureTime ? `Partida às ${departureTime}` : ''),
                    location: 'Explorar a cidade',
                    description: 'Aproveite este dia para conhecer a cidade',
                    image: '',
                    imageAlt: `Imagem de ${destination.city}`,
                    badges: badges
                });
            }
            
            return day;
        },
        
        /**
         * Gera badges baseados nas preferências do usuário
         */
        getBadgesForPreferences: function(preferences) {
            const badges = [];
            
            // Badge padrão
            badges.push({
                type: 'primary',
                text: 'Imperdível'
            });
            
            // Badge baseado no tipo de companhia
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
            
            // Badge baseado na preferência de viagem
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
         * Gera sugestões padrão para um dia caso não haja sugestões da IA
         */
        getDefaultDaySuggestions: function(dayIndex, totalDays, preferences) {
            // Mapeia o tipo de companhia para personalizar mensagens
            let companhia = 'você';
            if (preferences.companhia === 1) companhia = 'vocês dois';
            if (preferences.companhia === 2) companhia = 'toda a família';
            if (preferences.companhia === 3) companhia = 'seu grupo';
            
            // Mapeia a preferência para personalizar atividades
            let tipoAtividade = 'relaxante';
            let localTipo = 'áreas de descanso';
            
            if (preferences.preferencia_viagem === 1) { // Aventura
                tipoAtividade = 'aventureira';
                localTipo = 'pontos de aventura';
            } else if (preferences.preferencia_viagem === 2) { // Cultura
                tipoAtividade = 'cultural';
                localTipo = 'atrações culturais';
            } else if (preferences.preferencia_viagem === 3) { // Urbano
                tipoAtividade = 'urbana';
                localTipo = 'atrações urbanas';
            }
            
            // Primeiro dia (chegada)
            if (dayIndex === 0) {
                return {
                    description: `Depois de pousar, hora de sentir o clima da cidade! Um passeio leve para ${companhia} se ambientar e descansar da viagem.`,
                    tip: `Experimente a culinária local logo no primeiro dia! É a melhor forma de ${companhia} começar a viajar de verdade!`,
                    activities: [{
                        time: 'Chegada',
                        location: 'Centro da cidade',
                        description: 'Passeio de reconhecimento'
                    }]
                };
            }
            // Último dia (partida)
            else if (dayIndex === totalDays - 1) {
                return {
                    description: `Último dia! Aproveite para fazer compras de lembrancinhas e relaxar antes do voo de volta.`,
                    tip: `Organize as malas com antecedência para ${companhia} aproveitar ao máximo as últimas horas!`,
                    activities: [{
                        time: 'Manhã',
                        location: 'Mercado local',
                        description: 'Compras de lembranças'
                    }]
                };
            }
            // Dias intermediários
            else {
                return {
                    description: `Dia perfeito para uma experiência ${tipoAtividade}! Explore as melhores atrações da cidade.`,
                    tip: `Pesquise com antecedência sobre ingressos online para as ${localTipo}. Assim ${companhia} evita filas!`,
                    activities: [{
                        time: 'Dia inteiro',
                        location: 'Principais atrações',
                        description: `Explore as melhores ${localTipo} da cidade`
                    }]
                };
            }
        },
        
        /**
         * Constrói um roteiro básico caso ocorra algum erro
         */
        buildFallbackItinerary: function(destination, preferences, flight) {
            const departureDate = new Date(flight.departureDate);
            const returnDate = new Date(flight.returnDate);
            const totalDays = this.getDaysBetweenDates(departureDate, returnDate) + 1;
            
            const itinerary = {
                destination: destination,
                preferences: preferences,
                flight: flight,
                totalDays: totalDays,
                days: []
            };
            
            for (let i = 0; i < totalDays; i++) {
                const currentDate = new Date(departureDate);
                currentDate.setDate(departureDate.getDate() + i);
                
                const defaultSuggestions = this.getDefaultDaySuggestions(i, totalDays, preferences);
                
                const day = {
                    number: i + 1,
                    date: currentDate.toISOString().split('T')[0],
                    weekday: this.getWeekdayName(currentDate.getDay()),
                    formattedDate: this.formatDate(currentDate),
                    description: defaultSuggestions.description,
                    tip: defaultSuggestions.tip,
                    weather: {
                        icon: '🌤️',
                        temperature: '25',
                        condition: 'Parcialmente nublado'
                    },
                    activities: [{
                        time: i === 0 ? `Chegada às ${flight.arrivalTime || '15:00'}` : 
                              (i === totalDays - 1 ? `Partida às ${flight.departureTime || '18:00'}` : ''),
                        location: defaultSuggestions.activities[0].location,
                        description: defaultSuggestions.activities[0].description,
                        image: '',
                        imageAlt: `Imagem de ${destination.city}`,
                        badges: this.getBadgesForPreferences(preferences)
                    }]
                };
                
                itinerary.days.push(day);
            }
            
            return itinerary;
        },
        
        /**
         * Calcula número de dias entre duas datas
         */
        getDaysBetweenDates: function(startDate, endDate) {
            const difference = endDate.getTime() - startDate.getTime();
            return Math.ceil(difference / (1000 * 3600 * 24));
        },
        
        /**
         * Formata uma data para exibição
         */
        formatDate: function(date) {
            return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        },
        
        /**
         * Retorna o nome do dia da semana
         */
        getWeekdayName: function(weekdayIndex) {
            const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            return weekdays[weekdayIndex];
        }
    };
    
    // Expõe o módulo globalmente
    window.BenetripApp.ItineraryBuilder = ItineraryBuilder;
})();
