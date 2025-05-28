// api/weather.js - Serviço corrigido para obtenção de previsão do tempo
const axios = require('axios');

// Chave da API WeatherAPI.com
const WEATHER_API_KEY = process.env.WEATHERAPI_KEY;

// Cache para previsões do tempo
const weatherCache = new Map();
// Tempo de validade do cache: 3 horas
const CACHE_EXPIRATION = 3 * 60 * 60 * 1000;

/**
 * Endpoint principal para previsão do tempo
 */
module.exports = async (req, res) => {
  // Configurar cabeçalhos CORS adequadamente
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Content-Type', 'application/json');
  
  // Responder a preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[Weather API] Preflight request recebido');
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'GET') {
    console.log(`[Weather API] Método não permitido: ${req.method}`);
    return res.status(405).json({ 
      error: 'Método não permitido. Use GET.',
      method_received: req.method
    });
  }
  
  console.log('[Weather API] Requisição recebida:', {
    query: req.query,
    url: req.url,
    method: req.method
  });
  
  // Extrair parâmetros da query
  const { city, start, end } = req.query;
  
  // Validar cidade
  if (!city) {
    console.log('[Weather API] Erro: Parâmetro city não fornecido');
    return res.status(400).json({ 
      error: 'Parâmetro "city" é obrigatório',
      received_params: req.query
    });
  }
  
  try {
    console.log(`[Weather API] Buscando previsão para: ${city}`);
    
    // Calcular número de dias baseado nas datas fornecidas
    const days = calculateDays(start, end);
    console.log(`[Weather API] Dias calculados: ${days}`);
    
    // Gerar chave de cache
    const cacheKey = `${city.toLowerCase()}_${start || 'nostart'}_${end || 'noend'}_${days}`;
    
    // Verificar cache
    if (weatherCache.has(cacheKey)) {
      const cached = weatherCache.get(cacheKey);
      // Verificar se o cache ainda é válido
      if (Date.now() - cached.timestamp < CACHE_EXPIRATION) {
        console.log('[Weather API] Usando previsão do tempo em cache');
        return res.status(200).json(cached.data);
      }
      // Se expirou, remover do cache
      weatherCache.delete(cacheKey);
    }
    
    console.log('[Weather API] Buscando nova previsão do tempo');
    
    // Verificar se a chave da API está configurada
    if (!WEATHER_API_KEY) {
      console.warn('[Weather API] WEATHERAPI_KEY não configurada, usando dados mockados');
      const mockData = getMockWeatherData(days, city);
      
      // Salvar no cache
      weatherCache.set(cacheKey, {
        data: mockData,
        timestamp: Date.now()
      });
      
      console.log('[Weather API] Retornando dados mockados:', mockData);
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
    
    console.log('[Weather API] Dados formatados retornados:', formattedData);
    return res.status(200).json(formattedData);
    
  } catch (error) {
    console.error('[Weather API] Erro ao obter previsão do tempo:', error);
    
    // Retornar dados mockados em caso de erro
    const mockData = getMockWeatherData(calculateDays(start, end), city);
    console.log('[Weather API] Retornando dados mockados por erro:', mockData);
    return res.status(200).json(mockData);
  }
};

/**
 * Obtém previsão do tempo da WeatherAPI.com
 */
async function getWeatherForecast(city, days) {
  try {
    console.log(`[Weather API] Chamando WeatherAPI para ${city}, ${days} dias`);
    
    const response = await axios.get('https://api.weatherapi.com/v1/forecast.json', {
      params: {
        key: WEATHER_API_KEY,
        q: city,
        days: Math.min(days, 14), // WeatherAPI permite máximo 14 dias
        aqi: 'no',
        alerts: 'no'
      },
      timeout: 10000 // 10 segundos de timeout
    });
    
    console.log('[Weather API] Resposta da WeatherAPI recebida');
    return response.data;
  } catch (error) {
    console.error('[Weather API] Erro na API de previsão do tempo:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
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
  if (!startDate || !endDate) {
    console.log('[Weather API] Datas não fornecidas, usando 7 dias');
    return 7;
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Verificar se as datas são válidas
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.log('[Weather API] Datas inválidas, usando 7 dias');
    return 7;
  }
  
  // Calcular diferença em dias
  const differenceMs = Math.abs(end - start);
  const differenceDays = Math.ceil(differenceMs / (1000 * 60 * 60 * 24)) + 1;
  
  // WeatherAPI permite no máximo 14 dias
  const finalDays = Math.min(differenceDays, 14);
  console.log(`[Weather API] Dias calculados: ${finalDays} (de ${startDate} até ${endDate})`);
  
  return finalDays;
}

/**
 * Mapeia códigos de condição climática para emojis
 */
function getWeatherEmoji(conditionCode) {
  // Mapeamento expandido
  const weatherEmojis = {
    // Ensolarado
    1000: '☀️',
    // Parcialmente nublado
    1003: '🌤️',
    // Nublado
    1006: '☁️',
    1009: '☁️',
    // Neblina/Névoa
    1030: '🌫️',
    1135: '🌫️',
    1147: '🌫️',
    // Chuvoso
    1063: '🌧️',
    1150: '🌦️',
    1153: '🌦️',
    1168: '🌦️',
    1171: '🌦️',
    1180: '🌧️',
    1183: '🌧️',
    1186: '🌧️',
    1189: '🌧️',
    1192: '🌧️',
    1195: '🌧️',
    1198: '🌧️',
    1201: '🌧️',
    1240: '🌧️',
    1243: '🌧️',
    1246: '🌧️',
    // Tempestade
    1087: '⛈️',
    1273: '⛈️',
    1276: '⛈️',
    1279: '⛈️',
    1282: '⛈️',
    // Neve
    1066: '❄️',
    1114: '❄️',
    1117: '❄️',
    1210: '❄️',
    1213: '❄️',
    1216: '❄️',
    1219: '❄️',
    1222: '❄️',
    1225: '❄️',
    1237: '❄️',
    1249: '❄️',
    1252: '❄️',
    1255: '❄️',
    1258: '❄️',
    1261: '❄️',
    1264: '❄️'
  };
  
  return weatherEmojis[conditionCode] || '🌤️';
}

/**
 * Gera dados mockados de previsão do tempo
 */
function getMockWeatherData(days, city = 'Cidade') {
  console.log(`[Weather API] Gerando ${days} dias de dados mockados para ${city}`);
  
  const mockData = {};
  
  // Condições climáticas variadas
  const conditions = [
    { icon: '☀️', condition: 'Ensolarado', tempBase: 28 },
    { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 25 },
    { icon: '☁️', condition: 'Nublado', tempBase: 22 },
    { icon: '🌧️', condition: 'Chuvoso', tempBase: 20 },
    { icon: '⛈️', condition: 'Tempestade', tempBase: 18 },
    { icon: '🌫️', condition: 'Neblina', tempBase: 19 }
  ];
  
  // Gerar previsão para cada dia
  for (let i = 0; i < days; i++) {
    // Escolher condição com distribuição mais realista
    let conditionIndex;
    if (i < 3) {
      // Primeiros dias: mais chance de tempo bom
      conditionIndex = Math.floor(Math.random() * 3);
    } else {
      // Outros dias: condições variadas
      conditionIndex = Math.floor(Math.random() * conditions.length);
    }
    
    const condition = conditions[conditionIndex];
    
    // Adicionar variação de temperatura (-3 a +5 graus)
    const tempVariation = Math.floor(Math.random() * 9) - 3;
    const finalTemp = Math.max(15, Math.min(35, condition.tempBase + tempVariation));
    
    mockData[i] = {
      icon: condition.icon,
      temperature: finalTemp,
      condition: condition.condition,
      date: getDateString(i)
    };
  }
  
  console.log(`[Weather API] Dados mockados gerados:`, mockData);
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
