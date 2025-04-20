// api/weather.js - Serviço para obtenção de previsão do tempo
const axios = require('axios');

// Chave da API WeatherAPI.com
const WEATHER_API_KEY = process.env.WEATHERAPI_KEY;

// Cache para previsões do tempo
const weatherCache = new Map();
// Tempo de validade do cache: 3 horas
const CACHE_EXPIRATION = 3 * 60 * 60 * 1000;

/**
 * Endpoint para obtenção de previsão do tempo
 * 
 * Parâmetros:
 * - city: cidade para previsão
 * - start: data inicial (YYYY-MM-DD)
 * - end: data final (YYYY-MM-DD)
 */
module.exports = async (req, res) => {
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Responder a preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }
  
  // Extrair parâmetros da query
  const { city, start, end } = req.query;
  
  // Validar cidade
  if (!city) {
    return res.status(400).json({ error: 'Parâmetro "city" é obrigatório' });
  }
  
  try {
    // Calcular número de dias baseado nas datas fornecidas
    const days = calculateDays(start, end);
    
    // Gerar chave de cache
    const cacheKey = `${city.toLowerCase()}_${start || 'nostart'}_${end || 'noend'}_${days}`;
    
    // Verificar cache
    if (weatherCache.has(cacheKey)) {
      const cached = weatherCache.get(cacheKey);
      // Verificar se o cache ainda é válido
      if (Date.now() - cached.timestamp < CACHE_EXPIRATION) {
        console.log('Usando previsão do tempo em cache');
        return res.status(200).json(cached.data);
      }
      // Se expirou, remover do cache
      weatherCache.delete(cacheKey);
    }
    
    console.log('Buscando nova previsão do tempo');
    
    // Verificar se a chave da API está configurada
    if (!WEATHER_API_KEY) {
      console.warn('WEATHERAPI_KEY não configurada, usando dados mockados');
      const mockData = getMockWeatherData(days);
      
      // Salvar no cache
      weatherCache.set(cacheKey, {
        data: mockData,
        timestamp: Date.now()
      });
      
      return res.status(200).json(mockData);
    }
    
    // Chamar a API WeatherAPI.com
    const weatherData = await getWeatherForecast(city, days);
    
    // Formatar dados para o formato esperado pelo frontend
    const formattedData = formatWeatherData(weatherData);
    
    // Salvar no cache
    weatherCache.set(cacheKey, {
      data: formattedData,
      timestamp: Date.now()
    });
    
    return res.status(200).json(formattedData);
    
  } catch (error) {
    console.error('Erro ao obter previsão do tempo:', error);
    
    // Retornar dados mockados em caso de erro
    const mockData = getMockWeatherData(calculateDays(start, end));
    return res.status(200).json(mockData);
  }
};

/**
 * Obtém previsão do tempo da WeatherAPI.com
 */
async function getWeatherForecast(city, days) {
  try {
    const response = await axios.get('https://api.weatherapi.com/v1/forecast.json', {
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
    console.error('Erro na API de previsão do tempo:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Formata dados de clima para o formato esperado pelo frontend
 */
function formatWeatherData(weatherData) {
  const formattedData = {};
  
  if (weatherData && weatherData.forecast && weatherData.forecast.forecastday) {
    weatherData.forecast.forecastday.forEach((day, index) => {
      // Mapear código de condição para emoji
      const weatherIcon = getWeatherEmoji(day.day.condition.code);
      
      formattedData[index] = {
        icon: weatherIcon,
        temperature: Math.round(day.day.avgtemp_c),
        condition: day.day.condition.text,
        date: day.date
      };
    });
  }
  
  return formattedData;
}

/**
 * Calcula número de dias entre datas, ou retorna padrão
 */
function calculateDays(startDate, endDate) {
  // Valor padrão se não houver datas
  if (!startDate || !endDate) return 7;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Verificar se as datas são válidas
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 7;
  
  // Calcular diferença em dias
  const differenceMs = Math.abs(end - start);
  const differenceDays = Math.ceil(differenceMs / (1000 * 60 * 60 * 24)) + 1;
  
  // WeatherAPI permite no máximo 14 dias
  return Math.min(differenceDays, 14);
}

/**
 * Mapeia códigos de condição climática para emojis
 */
function getWeatherEmoji(conditionCode) {
  // Mapeamento simplificado
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

/**
 * Gera dados mockados de previsão do tempo
 */
function getMockWeatherData(days) {
  const mockData = {};
  
  // Condições climáticas
  const conditions = [
    { icon: '☀️', condition: 'Ensolarado', temp: 25 },
    { icon: '🌤️', condition: 'Parcialmente nublado', temp: 22 },
    { icon: '☁️', condition: 'Nublado', temp: 20 },
    { icon: '🌧️', condition: 'Chuvoso', temp: 18 },
    { icon: '⛈️', condition: 'Tempestade', temp: 17 }
  ];
  
  // Gerar data para cada dia
  for (let i = 0; i < days; i++) {
    // Escolher condição aleatória
    const randomIndex = Math.floor(Math.random() * conditions.length);
    const condition = conditions[randomIndex];
    
    // Adicionar variação de temperatura
    const tempVariation = Math.floor(Math.random() * 6) - 3;
    
    mockData[i] = {
      icon: condition.icon,
      temperature: condition.temp + tempVariation,
      condition: condition.condition,
      date: getDateString(i)
    };
  }
  
  return mockData;
}

/**
 * Gera string de data para N dias a partir de hoje
 */
function getDateString(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}
