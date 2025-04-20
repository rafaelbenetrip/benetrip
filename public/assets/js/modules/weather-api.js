/**
 * Módulo para integração com WeatherAPI.com
 * Obtém previsões meteorológicas para o destino
 */
(function() {
    'use strict';

    // Namespace global
    window.BenetripApp = window.BenetripApp || {};

    const WeatherAPI = {
        /**
         * Busca previsão do tempo para o período da viagem
         * @param {string} city - Nome da cidade
         * @param {string} startDate - Data inicial (YYYY-MM-DD)
         * @param {string} endDate - Data final (YYYY-MM-DD)
         * @returns {Promise<Object>} Dados do clima para cada dia
         */
        getWeatherForecast: async function(city, startDate, endDate) {
            try {
                const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}&start=${startDate}&end=${endDate}`);
                
                if (!response.ok) {
                    throw new Error('Falha ao obter previsão do tempo');
                }
                
                const data = await response.json();
                
                // Formata dados para uso no frontend
                return this.formatWeatherData(data);
                
            } catch (error) {
                console.error('Erro ao buscar previsão do tempo:', error);
                return this.getFallbackWeatherData(startDate, endDate);
            }
        },
        
        /**
         * Formata dados de clima recebidos da API para formato interno
         */
        formatWeatherData: function(apiData) {
            const formattedData = {};
            
            if (apiData && apiData.forecast && apiData.forecast.forecastday) {
                apiData.forecast.forecastday.forEach((day, index) => {
                    // Mapeia ícones de condição para emojis
                    const weatherIcon = this.getWeatherEmoji(day.day.condition.code);
                    
                    formattedData[index] = {
                        icon: weatherIcon,
                        temperature: Math.round(day.day.avgtemp_c),
                        condition: day.day.condition.text,
                        date: day.date
                    };
                });
            }
            
            return formattedData;
        },
        
        /**
         * Retorna dados de clima padrão se a API falhar
         */
        getFallbackWeatherData: function(startDate, endDate) {
            const fallbackData = {};
            const start = new Date(startDate);
            const end = new Date(endDate);
            const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            
            for (let i = 0; i < daysDiff; i++) {
                const currentDate = new Date(start);
                currentDate.setDate(start.getDate() + i);
                
                fallbackData[i] = {
                    icon: '🌤️',
                    temperature: 25,
                    condition: 'Parcialmente nublado',
                    date: currentDate.toISOString().split('T')[0]
                };
            }
            
            return fallbackData;
        },
        
        /**
         * Mapeia códigos de condição climática para emojis
         */
        getWeatherEmoji: function(conditionCode) {
            // Mapeamento simplificado de condições para emojis
            const weatherEmojis = {
                // Ensolarado
                1000: '☀️',
                // Parcialmente nublado
                1003: '🌤️',
                // Nublado
                1006: '☁️',
                1009: '☁️',
                // Chuvoso
                1063: '🌧️',
                1180: '🌧️',
                1186: '🌧️',
                1192: '🌧️',
                1195: '🌧️',
                1240: '🌧️',
                // Tempestade
                1087: '⛈️',
                1273: '⛈️',
                1276: '⛈️',
                // Neve
                1066: '❄️',
                1114: '❄️',
                1210: '❄️',
                1213: '❄️',
                1216: '❄️',
                1219: '❄️',
                1222: '❄️',
                1225: '❄️',
                // Neblina
                1030: '🌫️',
                1135: '🌫️',
                1147: '🌫️'
            };
            
            return weatherEmojis[conditionCode] || '🌤️';
        }
    };

    // Expõe o módulo globalmente
    window.BenetripApp.WeatherAPI = WeatherAPI;
})();
