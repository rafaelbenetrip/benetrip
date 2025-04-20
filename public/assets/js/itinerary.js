/**
 * Script principal para a página de roteiro de viagem
 * Coordena a renderização e interação do usuário com o roteiro
 */
(function() {
    'use strict';
    
    // Módulos e utilitários
    const StorageManager = window.BenetripApp.StorageManager;
    const EventEmitter = window.BenetripApp.EventEmitter;
    const ItineraryBuilder = window.BenetripApp.ItineraryBuilder;
    
    // Elementos do DOM
    const elements = {
        destinationTitle: document.getElementById('destination-title'),
        tripSummary: document.getElementById('trip-summary'),
        itineraryDays: document.getElementById('itinerary-days'),
        itineraryLoader: document.getElementById('itinerary-loader'),
        btnEditFlights: document.getElementById('btn-edit-flights'),
        btnShare: document.getElementById('btn-share')
    };
    
    // Templates
    const templates = {
        tripSummary: document.getElementById('trip-summary-template').innerHTML,
        day: document.getElementById('day-template').innerHTML,
        badge: document.getElementById('badge-template').innerHTML
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
        // Carregar dados armazenados
        loadStoredData();
        
        // Validar se há dados suficientes
        if (!validateData()) {
            showError('Dados insuficientes para gerar o roteiro. Volte e selecione um voo.');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            return;
        }
        
        // Atualizar título com destino
        updateDestinationTitle();
        
        // Configurar eventos
        setupEventListeners();
        
        // Gerar roteiro
        generateItinerary();
        
        // Emitir evento de página carregada
        EventEmitter.emit('itinerary:loaded');
    }
    
    /**
     * Carrega dados do localStorage
     */
    function loadStoredData() {
        appState.userPreferences = StorageManager.get('userPreferences');
        appState.selectedFlight = StorageManager.get('selectedFlight');
        appState.destination = StorageManager.get('destination');
        
        console.log('Dados carregados:', {
            userPreferences: appState.userPreferences,
            selectedFlight: appState.selectedFlight,
            destination: appState.destination
        });
    }
    
    /**
     * Valida se há dados suficientes para gerar o roteiro
     */
    function validateData() {
        return (
            appState.userPreferences && 
            appState.selectedFlight && 
            appState.destination
        );
    }
    
    /**
     * Atualiza o título com o nome do destino
     */
    function updateDestinationTitle() {
        if (elements.destinationTitle && appState.destination) {
            elements.destinationTitle.textContent = `Seu Roteiro para ${appState.destination.city}`;
        }
    }
    
    /**
     * Configura eventos dos elementos interativos
     */
    function setupEventListeners() {
        // Botão para editar voos
        if (elements.btnEditFlights) {
            elements.btnEditFlights.addEventListener('click', function() {
                window.location.href = 'flights.html';
            });
        }
        
        // Botão para compartilhar
        if (elements.btnShare) {
            elements.btnShare.addEventListener('click', shareItinerary);
        }
        
        // Evento global para cliques em botões de mapa
        document.addEventListener('click', function(e) {
            // Verificar se o clique foi em um botão de mapa
            if (e.target.matches('.map-button') || e.target.closest('.map-button')) {
                const button = e.target.matches('.map-button') ? e.target : e.target.closest('.map-button');
                const location = button.dataset.location;
                
                if (location) {
                    openInMaps(`${location}, ${appState.destination.city}, ${appState.destination.country}`);
                }
            }
            
            // Verificar se o clique foi em uma aba de período
            if (e.target.matches('.period-tab') || e.target.closest('.period-tab')) {
                const tab = e.target.matches('.period-tab') ? e.target : e.target.closest('.period-tab');
                const dayCard = tab.closest('.day-card');
                
                if (dayCard) {
                    // Remover classe ativa de todas as abas no mesmo dia
                    const tabs = dayCard.querySelectorAll('.period-tab');
                    tabs.forEach(t => t.classList.remove('period-active'));
                    
                    // Adicionar classe ativa na aba clicada
                    tab.classList.add('period-active');
                    
                    // Mudar conteúdo para o período selecionado (implementação futura)
                    // Por enquanto, apenas um feedback visual
                    console.log('Período selecionado:', tab.dataset.period);
                }
            }
        });
    }
    
    /**
     * Gera o roteiro de viagem
     */
    async function generateItinerary() {
        try {
            showLoader();
            
            // 1. Buscar previsão do tempo
            const weatherData = await fetchWeatherForecast(
                appState.destination.city,
                appState.selectedFlight.departureDate,
                appState.selectedFlight.returnDate
            );
            
            appState.weather = weatherData;
            
            // 2. Obter sugestões da IA
            const aiSuggestions = await fetchItinerarySuggestions(
                appState.destination,
                appState.userPreferences,
                appState.selectedFlight
            );
            
            // 3. Construir o roteiro completo
            appState.itinerary = ItineraryBuilder.buildItinerary(
                appState.destination,
                appState.userPreferences,
                appState.selectedFlight,
                aiSuggestions,
                appState.weather
            );
            
            // 4. Salvar no localStorage para persistência
            StorageManager.save('itinerary', appState.itinerary);
            
            // 5. Renderizar na tela
            renderTripSummary();
            renderItineraryDays();
            
            // 6. Buscar imagens para cada dia
            fetchImagesForDays();
            
            hideLoader();
        } catch (error) {
            console.error('Erro ao gerar roteiro:', error);
            hideLoader();
            showError('Não foi possível gerar seu roteiro. Tente novamente mais tarde.');
        }
    }
    
    /**
     * Busca a previsão do tempo para o destino
     */
    async function fetchWeatherForecast(city, startDate, endDate) {
        try {
            // Formatar datas para YYYY-MM-DD
            const start = new Date(startDate).toISOString().split('T')[0];
            const end = new Date(endDate).toISOString().split('T')[0];
            
            const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}&start=${start}&end=${end}`);
            
            if (!response.ok) {
                throw new Error('Falha ao obter previsão do tempo');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar previsão do tempo:', error);
            return {}; // Retorna objeto vazio em caso de erro
        }
    }
    
    /**
     * Busca sugestões de roteiro da IA
     */
    async function fetchItinerarySuggestions(destination, preferences, flight) {
        try {
            const requestData = {
                destination: destination,
                preferences: preferences,
                flight: flight
            };
            
            const response = await fetch('/api/itinerary-generator', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                throw new Error('Falha ao obter sugestões de roteiro');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar sugestões de roteiro:', error);
            return { days: [] }; // Retorna objeto com array vazio em caso de erro
        }
    }
    
    /**
     * Busca imagens para cada dia do roteiro
     */
    async function fetchImagesForDays() {
        if (!appState.itinerary || !appState.itinerary.days) return;
        
        for (let i = 0; i < appState.itinerary.days.length; i++) {
            const day = appState.itinerary.days[i];
            
            if (day.activities && day.activities.length > 0) {
                for (let j = 0; j < day.activities.length; j++) {
                    const activity = day.activities[j];
                    
                    // Se a atividade já tem imagem, pular
                    if (activity.image && activity.image.length > 0) continue;
                    
                    try {
                        // Buscar imagem para a atividade
                        const query = `${activity.location} ${appState.destination.city} ${appState.destination.country}`;
                        const imageUrl = await fetchImage(query);
                        
                        if (imageUrl) {
                            // Atualizar a imagem na atividade
                            activity.image = imageUrl;
                            activity.imageAlt = `Imagem de ${activity.location} em ${appState.destination.city}`;
                            
                            // Atualizar a imagem no DOM
                            const activityImageEl = document.querySelector(`.day-card[data-day="${day.number}"] .activity-image img`);
                            if (activityImageEl) {
                                activityImageEl.src = imageUrl;
                                activityImageEl.alt = activity.imageAlt;
                            }
                        }
                    } catch (error) {
                        console.error(`Erro ao buscar imagem para o dia ${day.number}:`, error);
                    }
                }
            }
        }
    }
    
    /**
     * Busca uma imagem para um local específico
     */
    async function fetchImage(query) {
        try {
            const response = await fetch(`/api/image-search?query=${encodeURIComponent(query)}&perPage=1`);
            
            if (!response.ok) {
                throw new Error('Falha ao buscar imagem');
            }
            
            const data = await response.json();
            
            if (data.images && data.images.length > 0) {
                return data.images[0].url;
            }
            
            return null;
        } catch (error) {
            console.error('Erro ao buscar imagem:', error);
            return null;
        }
    }
    
    /**
     * Renderiza o resumo da viagem
     */
    function renderTripSummary() {
        if (!appState.itinerary || !elements.tripSummary) return;
        
        const destination = appState.destination;
        const flight = appState.selectedFlight;
        const preferences = appState.userPreferences;
        
        // Formatar datas
        const departureDate = new Date(flight.departureDate);
        const returnDate = new Date(flight.returnDate);
        const formattedDates = formatDateRange(departureDate, returnDate);
        
        // Determinar tipo de companhia
        let groupText = 'Sozinho(a)';
        if (preferences.companhia === 1) {
            groupText = 'Romântico (2 pessoas)';
        } else if (preferences.companhia === 2) {
            groupText = `Família (${preferences.quantidade_familia || 'múltiplas'} pessoas)`;
        } else if (preferences.companhia === 3) {
            groupText = `Amigos (${preferences.quantidade_amigos || 'múltiplas'} pessoas)`;
        }
        
        // Determinar preferência de viagem
        let preferenceText = 'Relaxar';
        if (preferences.preferencia_viagem === 1) {
            preferenceText = 'Aventura';
        } else if (preferences.preferencia_viagem === 2) {
            preferenceText = 'Cultura';
        } else if (preferences.preferencia_viagem === 3) {
            preferenceText = 'Urbano';
        }
        
        // Preencher o template
        let html = templates.tripSummary
            .replace('{{destination}}', `${destination.city}, ${destination.country}`)
            .replace('{{dates}}', formattedDates)
            .replace('{{flightTimes}}', `Chegada ${formatTime(flight.arrivalTime)} - Saída ${formatTime(flight.departureTime)}`)
            .replace('{{group}}', groupText)
            .replace('{{preference}}', preferenceText)
            .replace('{{originCity}}', preferences.cidade_partida || '');
        
        elements.tripSummary.innerHTML = html;
    }
    
    /**
     * Renderiza os dias do roteiro
     */
    function renderItineraryDays() {
        if (!appState.itinerary || !appState.itinerary.days || !elements.itineraryDays) return;
        
        let daysHtml = '';
        
        appState.itinerary.days.forEach(day => {
            // Criar badges para a atividade principal
            let badgesHtml = '';
            if (day.activities && day.activities.length > 0 && day.activities[0].badges) {
                day.activities[0].badges.forEach(badge => {
                    const badgeHtml = templates.badge
                        .replace('{{badgeType}}', badge.type)
                        .replace('{{badgeText}}', badge.text);
                    badgesHtml += badgeHtml;
                });
            }
            
            // Informações de clima
            const weather = day.weather || {
                icon: '🌤️',
                temperature: '25',
                condition: 'Parcialmente nublado'
            };
            
            // Informações da atividade principal
            const activity = day.activities && day.activities.length > 0 ? day.activities[0] : {
                time: '',
                location: 'Local a definir',
                image: '',
                imageAlt: `Imagem de ${appState.destination.city}`
            };
            
            // Preencher o template do dia
            const dayHtml = templates.day
                .replace(/{{dayNumber}}/g, day.number)
                .replace('{{dayDate}}', `${day.weekday}, ${day.formattedDate}`)
                .replace('{{dayDescription}}', day.description)
                .replace('{{weatherIcon}}', weather.icon)
                .replace('{{temperature}}', weather.temperature)
                .replace('{{weatherCondition}}', weather.condition)
                .replace('{{dayId}}', `day-${day.number}`)
                .replace('{{activityTime}}', activity.time)
                .replace('{{activityLocation}}', activity.location)
                .replace('{{activityBadges}}', badgesHtml)
                .replace('{{tripinhaTip}}', day.tip)
                .replace('{{activityImage}}', activity.image)
                .replace('{{activityImageAlt}}', activity.imageAlt);
            
            daysHtml += dayHtml;
        });
        
        elements.itineraryDays.innerHTML = daysHtml;
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
     * Abre um local no Google Maps
     */
    function openInMaps(location) {
        if (!location) return;
        
        const query = encodeURIComponent(location);
        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
    
    /**
     * Funções auxiliares para formatação de datas e horas
     */
    function formatDateRange(startDate, endDate) {
        // Formatar data para DD/MM (dia da semana a dia da semana)
        const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
        
        const startFormatted = `${startDate.getDate().toString().padStart(2, '0')}/${(startDate.getMonth() + 1).toString().padStart(2, '0')}`;
        const endFormatted = `${endDate.getDate().toString().padStart(2, '0')}/${(endDate.getMonth() + 1).toString().padStart(2, '0')}`;
        
        const startWeekday = weekdays[startDate.getDay()];
        const endWeekday = weekdays[endDate.getDay()];
        
        return `${startFormatted} a ${endFormatted} (${startWeekday} a ${endWeekday})`;
    }
    
    function formatTime(timeString) {
        if (!timeString) return '00:00';
        
        return timeString;
    }
    
    /**
     * Funções de gerenciamento de UI
     */
    function showLoader() {
        if (elements.itineraryLoader) {
            elements.itineraryLoader.style.display = 'flex';
        }
    }
    
    function hideLoader() {
        if (elements.itineraryLoader) {
            elements.itineraryLoader.style.display = 'none';
        }
    }
    
    function showError(message) {
        // Remover erro existente, se houver
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Criar mensagem de erro
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        // Adicionar botão para tentar novamente
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Tentar novamente';
        retryButton.className = 'btn btn-primary';
        retryButton.style.marginTop = '16px';
        retryButton.style.width = '100%';
        
        retryButton.addEventListener('click', function() {
            errorDiv.remove();
            generateItinerary();
        });
        
        errorDiv.appendChild(document.createElement('br'));
        errorDiv.appendChild(retryButton);
        
        // Adicionar no DOM
        if (elements.itineraryDays) {
            elements.itineraryDays.innerHTML = '';
            elements.itineraryDays.appendChild(errorDiv);
        } else {
            document.body.appendChild(errorDiv);
        }
    }
    
    // Inicializar quando o DOM estiver carregado
    document.addEventListener('DOMContentLoaded', init);
})();

