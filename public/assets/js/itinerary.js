/**
 * Arquivo principal para a página de roteiro
 * Responsável pela inicialização e coordenação dos módulos
 */
(function() {
    'use strict';

    // Módulos
    const StorageManager = window.BenetripApp.StorageManager;
    const EventEmitter = window.BenetripApp.EventEmitter;
    const ItineraryBuilder = window.BenetripApp.ItineraryBuilder;
    const WeatherAPI = window.BenetripApp.WeatherAPI;
    const AISuggestions = window.BenetripApp.AISuggestions;

    // Elementos DOM
    const elements = {
        destinationTitle: document.getElementById('destination-title'),
        tripSummary: document.getElementById('trip-summary'),
        itineraryDays: document.getElementById('itinerary-days'),
        btnEditFlights: document.getElementById('btn-edit-flights'),
        btnShare: document.getElementById('btn-share')
    };

    // Templates
    const templates = {
        tripSummary: document.getElementById('trip-summary-template'),
        day: document.getElementById('day-template'),
        badge: document.getElementById('badge-template')
    };

    // Estado da aplicação
    let appState = {
        userPreferences: null,
        selectedFlight: null,
        destination: null,
        itinerary: null,
        weather: {}
    };

    /**
     * Inicializa a página
     */
    function init() {
        // Carrega dados da sessão anterior
        loadStoredData();
        
        // Se não houver dados suficientes, redireciona para página inicial
        if (!validateData()) {
            window.location.href = 'index.html';
            return;
        }

        // Atualiza título com o destino
        updateDestinationTitle();
        
        // Gera o roteiro
        generateItinerary();
        
        // Configura eventos dos botões
        setupEventListeners();
    }

    /**
     * Carrega dados armazenados no localStorage
     */
    function loadStoredData() {
        appState.userPreferences = StorageManager.get('userPreferences');
        appState.selectedFlight = StorageManager.get('selectedFlight');
        appState.destination = StorageManager.get('destination');
    }

    /**
     * Valida se temos dados suficientes para gerar o roteiro
     */
    function validateData() {
        return (
            appState.userPreferences && 
            appState.selectedFlight && 
            appState.destination
        );
    }

    /**
     * Atualiza título com o nome do destino
     */
    function updateDestinationTitle() {
        elements.destinationTitle.textContent = `Seu Roteiro para ${appState.destination.city}`;
    }

    /**
     * Gera o roteiro de viagem
     */
    async function generateItinerary() {
        try {
            // Exibe loader
            showLoader();
            
            // Obtém sugestões de IA para o roteiro
            const aiSuggestions = await AISuggestions.getItinerarySuggestions(
                appState.destination, 
                appState.userPreferences,
                appState.selectedFlight
            );
            
            // Busca previsão do tempo
            const weatherData = await WeatherAPI.getWeatherForecast(
                appState.destination.city,
                formatDateForWeatherAPI(appState.selectedFlight.departureDate),
                formatDateForWeatherAPI(appState.selectedFlight.returnDate)
            );
            
            appState.weather = weatherData;
            
            // Constrói o roteiro completo
            appState.itinerary = ItineraryBuilder.buildItinerary(
                appState.destination,
                appState.userPreferences,
                appState.selectedFlight,
                aiSuggestions,
                appState.weather
            );
            
            // Armazena o roteiro no localStorage
            StorageManager.save('itinerary', appState.itinerary);
            
            // Renderiza o resumo da viagem
            renderTripSummary();
            
            // Renderiza os dias do roteiro
            renderItineraryDays();
            
            // Esconde loader
            hideLoader();
            
        } catch (error) {
            console.error('Erro ao gerar roteiro:', error);
            hideLoader();
            showErrorMessage('Não foi possível gerar seu roteiro. Tente novamente mais tarde.');
        }
    }

    /**
     * Renderiza o resumo da viagem
     */
    function renderTripSummary() {
        const template = templates.tripSummary.innerHTML;
        const flight = appState.selectedFlight;
        const preferences = appState.userPreferences;
        
        // Formata datas para exibição
        const formattedDates = formatDateRange(flight.departureDate, flight.returnDate);
        
        // Determina o tipo de grupo
        let groupText = 'Sozinho(a)';
        if (preferences.companhia === 1) {
            groupText = 'Romântico (2 pessoas)';
        } else if (preferences.companhia === 2) {
            groupText = `Família (${preferences.quantidade_familia} pessoas)`;
        } else if (preferences.companhia === 3) {
            groupText = `Amigos (${preferences.quantidade_amigos} pessoas)`;
        }
        
        // Determina a preferência de viagem
        let preferenceText = 'Relaxar';
        if (preferences.preferencia_viagem === 1) {
            preferenceText = 'Aventura';
        } else if (preferences.preferencia_viagem === 2) {
            preferenceText = 'Cultura';
        } else if (preferences.preferencia_viagem === 3) {
            preferenceText = 'Urbano';
        }
        
        // Preenche o template
        const html = template
            .replace('{{destination}}', `${appState.destination.city}, ${appState.destination.country}`)
            .replace('{{dates}}', formattedDates)
            .replace('{{flightTimes}}', `Chegada ${formatTime(flight.arrivalTime)} - Saída ${formatTime(flight.departureTime)}`)
            .replace('{{group}}', groupText)
            .replace('{{preference}}', preferenceText)
            .replace('{{originCity}}', preferences.cidade_partida);
        
        elements.tripSummary.innerHTML = html;
    }

    /**
     * Renderiza os dias do roteiro
     */
    function renderItineraryDays() {
        if (!appState.itinerary || !appState.itinerary.days || !appState.itinerary.days.length) {
            return;
        }
        
        let daysHtml = '';
        
        // Para cada dia do roteiro
        appState.itinerary.days.forEach((day, index) => {
            const dayNumber = index + 1;
            const dayId = `day-${dayNumber}`;
            
            // Cria os badges para atividades
            let badgesHtml = '';
            if (day.activities && day.activities.length > 0) {
                const activity = day.activities[0]; // Pega primeira atividade do dia
                
                if (activity.badges && activity.badges.length > 0) {
                    activity.badges.forEach(badge => {
                        const badgeHtml = templates.badge.innerHTML
                            .replace('{{badgeType}}', badge.type)
                            .replace('{{badgeText}}', badge.text);
                        badgesHtml += badgeHtml;
                    });
                }
            }
            
            // Obtém previsão do tempo para o dia
            const weather = appState.weather[index] || {
                icon: '🌤️',
                temperature: '--',
                condition: 'Informação indisponível'
            };
            
            // Formata a data do dia
            const dayDate = formatDayDate(day.date);
            
            // Preenche o template do dia
            const template = templates.day.innerHTML;
            const dayHtml = template
                .replace(/{{dayNumber}}/g, dayNumber)
                .replace('{{dayDate}}', dayDate)
                .replace('{{dayDescription}}', day.description)
                .replace('{{weatherIcon}}', weather.icon)
                .replace('{{temperature}}', weather.temperature)
                .replace('{{weatherCondition}}', weather.condition)
                .replace('{{dayId}}', dayId)
                .replace('{{activityTime}}', day.activities[0]?.time || '')
                .replace('{{activityLocation}}', day.activities[0]?.location || '')
                .replace('{{activityBadges}}', badgesHtml)
                .replace('{{tripinhaTip}}', day.tip || 'Aproveite seu dia!')
                .replace('{{activityImage}}', day.activities[0]?.image || 'public/assets/images/default-location.jpg')
                .replace('{{activityImageAlt}}', day.activities[0]?.imageAlt || 'Imagem do local');
            
            daysHtml += dayHtml;
        });
        
        elements.itineraryDays.innerHTML = daysHtml;
        
        // Configura os eventos das abas de período
        setupPeriodTabs();
    }

    /**
     * Configura os eventos das abas de período (manhã, tarde, noite)
     */
    function setupPeriodTabs() {
        const periodTabs = document.querySelectorAll('.period-tab');
        
        periodTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // Remove classe ativa de todas as abas do mesmo dia
                const dayCard = this.closest('.day-card');
                const tabs = dayCard.querySelectorAll('.period-tab');
                tabs.forEach(t => t.classList.remove('period-active'));
                
                // Adiciona classe ativa na aba clicada
                this.classList.add('period-active');
                
                // TODO: Implementar troca de conteúdo por período
                // Esta funcionalidade será implementada em versão futura
            });
        });
    }

    /**
     * Configura listeners de eventos
     */
    function setupEventListeners() {
        // Botão de editar voos
        elements.btnEditFlights.addEventListener('click', function() {
            window.location.href = 'flights.html';
        });
        
        // Botão de compartilhar
        elements.btnShare.addEventListener('click', function() {
            shareItinerary();
        });
        
        // Botões de ver no mapa
        document.addEventListener('click', function(e) {
            if (e.target.matches('.map-button') || e.target.closest('.map-button')) {
                const dayCard = e.target.closest('.day-card');
                const dayNumber = dayCard.dataset.day;
                const day = appState.itinerary.days[dayNumber - 1];
                
                if (day && day.activities && day.activities.length > 0) {
                    const activity = day.activities[0];
                    openMap(activity.location, appState.destination.city);
                }
            }
        });
    }

    /**
     * Compartilha o roteiro
     */
    function shareItinerary() {
        if (navigator.share) {
            navigator.share({
                title: `Roteiro para ${appState.destination.city}`,
                text: `Confira meu roteiro de viagem para ${appState.destination.city} criado pela Benetrip!`,
                url: window.location.href
            })
            .catch(error => {
                console.error('Erro ao compartilhar:', error);
            });
        } else {
            // Fallback para navegadores que não suportam Web Share API
            const dummyInput = document.createElement('input');
            dummyInput.value = window.location.href;
            document.body.appendChild(dummyInput);
            dummyInput.select();
            document.execCommand('copy');
            document.body.removeChild(dummyInput);
            
            alert('Link copiado para a área de transferência!');
        }
    }

    /**
     * Abre mapa com a localização
     */
    function openMap(place, city) {
        const query = encodeURIComponent(`${place}, ${city}`);
        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }

    /**
     * Funções auxiliares para formatação
     */
    function formatDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const options = { day: 'numeric', month: 'numeric' };
        const startFormatted = start.toLocaleDateString('pt-BR', options);
        const endFormatted = end.toLocaleDateString('pt-BR', options);
        
        // Determina os dias da semana
        const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
        const startDay = weekdays[start.getDay()];
        const endDay = weekdays[end.getDay()];
        
        return `${startFormatted} a ${endFormatted} (${startDay} a ${endDay})`;
    }

    function formatDayDate(dateString) {
        const date = new Date(dateString);
        const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const day = date.getDate();
        const month = date.getMonth() + 1;
        
        return `${weekdays[date.getDay()]}, ${day}/${month}`;
    }

    function formatTime(timeString) {
        if (!timeString) return '--:--';
        
        // Converte horário para formato HH:MM
        const [hours, minutes] = timeString.split(':');
        return `${hours}:${minutes}`;
    }

    function formatDateForWeatherAPI(dateString) {
        return dateString.split('T')[0];
    }

    /**
     * Exibe loader
     */
    function showLoader() {
        // Implemente conforme o padrão do projeto
        const loader = document.createElement('div');
        loader.id = 'loader';
        loader.className = 'loader';
        loader.innerHTML = '<div class="loader-spinner"></div><p>Preparando seu roteiro personalizado...</p>';
        document.body.appendChild(loader);
    }

    /**
     * Esconde loader
     */
    function hideLoader() {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.remove();
        }
    }

    /**
     * Exibe mensagem de erro
     */
    function showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        // Adiciona botão para tentar novamente
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Tentar novamente';
        retryButton.className = 'btn btn-primary';
        retryButton.style.marginTop = '16px';
        retryButton.addEventListener('click', function() {
            errorDiv.remove();
            generateItinerary();
        });
        
        errorDiv.appendChild(document.createElement('br'));
        errorDiv.appendChild(retryButton);
        
        document.body.appendChild(errorDiv);
    }

    // Inicializa quando o DOM estiver pronto
    document.addEventListener('DOMContentLoaded', init);
})();
