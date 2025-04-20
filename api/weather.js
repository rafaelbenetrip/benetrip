/**
 * API para obtenção de previsão do tempo
 * Utiliza WeatherAPI.com para fornecer dados meteorológicos
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Chave da API WeatherAPI.com
const WEATHER_API_KEY = process.env.WEATHERAPI_KEY || '';

/**
 * Endpoint para buscar previsão do tempo
 * GET /api/weather?city=Londres&start=2025-07-10&end=2025-07-15
 */
router.get('/', async (req, res) => {
    try {
        const { city, start, end } = req.query;
        
        if (!city) {
            return res.status(400).json({ error: 'Cidade não especificada' });
        }
        
        // Calcula número de dias para previsão
        const days = calculateDaysBetween(start, end);
        
        // Obtém previsão do tempo
        const forecast = await getWeatherForecast(city, days);
        
        res.json(forecast);
        
    } catch (error) {
        console.error('Erro ao buscar previsão do tempo:', error);
        res.status(500).json({ error: 'Falha ao obter previsão do tempo' });
    }
});

/**
 * Obtém previsão do tempo para os dias especificados
 */
async function getWeatherForecast(city, days) {
    try {
        // Chama a API WeatherAPI.com
        const response = await axios.get(`https://api.weatherapi.com/v1/forecast.json`, {
            params: {
                key: WEATHER_API_KEY,
                q: city,
                days: days,
                aqi: 'no',
                alerts: 'no'
            }
        });
        
        return response.data;
        
    } catch (error) {
        console.error('Erro na chamada à API de clima:', error);
        throw error;
    }
}

/**
 * Calcula o número de dias entre duas datas
 */
function calculateDaysBetween(startDate, endDate) {
    if (!startDate || !endDate) {
        return 7; // Valor padrão se datas não forem especificadas
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Verifica se as datas são válidas
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 7;
    }
    
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // WeatherAPI permite no máximo 14 dias de previsão
    return Math.min(diffDays, 14);
}

module.exports = router;
