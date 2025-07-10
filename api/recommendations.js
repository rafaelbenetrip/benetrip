// api/recommendations.js - Versão Otimizada para Deepseek R1 Reasoner
const axios = require('axios');

// =============================================
// CONFIGURAÇÕES PRINCIPAIS
// =============================================
const CONFIG = {
  timeout: { request: 60000, handler: 290000 },
  retries: 2,
  providerOrder: ['deepseek', 'perplexity', 'openai'] // Deepseek R1 como prioridade
};

const apiClient = axios.create({
  timeout: CONFIG.timeout.request,
  headers: { 'User-Agent': 'Benetrip/1.0' }
});

// =============================================
// UTILITÁRIOS ESSENCIAIS
// =============================================
const utils = {
  log: (msg, data) => console.log(msg, data ? JSON.stringify(data).substring(0, 200) + '...' : ''),
  
  extractJSON: (text) => {
    try {
      if (typeof text === 'object') return JSON.stringify(text);
      
      // Remove formatação markdown e comentários
      const cleaned = text
        .replace(/```json|```/g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      
      // Tenta encontrar JSON válido
      const match = cleaned.match(/(\{[\s\S]*\})/);
      if (match) {
        JSON.parse(match[0]); // Valida antes de retornar
        return match[0];
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao extrair JSON:', error.message);
      return null;
    }
  },
  
  isValidDestination: (jsonStr) => {
    try {
      const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      
      // Validações essenciais
      const hasTopPick = data.topPick?.destino && data.topPick?.aeroporto?.codigo;
      const hasAlternatives = Array.isArray(data.alternativas) && data.alternativas.length >= 3;
      const hasSurprise = data.surpresa?.destino && data.surpresa?.aeroporto?.codigo;
      
      return hasTopPick && hasAlternatives && hasSurprise;
    } catch {
      return false;
    }
  },
  
  formatDate: (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

// =============================================
// MAPEAMENTO DE CÓDIGOS IATA ESSENCIAIS
// =============================================
const IATA_CODES = {
  // Principais destinos brasileiros
  'São Paulo': 'GRU', 'Rio de Janeiro': 'GIG', 'Brasília': 'BSB',
  
  // América do Sul popular
  'Buenos Aires': 'EZE', 'Santiago': 'SCL', 'Lima': 'LIM', 'Bogotá': 'BOG',
  'Cartagena': 'CTG', 'Medellín': 'MDE', 'Montevidéu': 'MVD',
  
  // Destinos internacionais populares
  'Lisboa': 'LIS', 'Porto': 'OPO', 'Madrid': 'MAD', 'Barcelona': 'BCN',
  'Paris': 'CDG', 'Londres': 'LHR', 'Roma': 'FCO', 'Amsterdã': 'AMS',
  'Nova York': 'JFK', 'Miami': 'MIA', 'Cidade do México': 'MEX',
  'Tóquio': 'HND', 'Dubai': 'DXB', 'Bangkok': 'BKK'
};

const getIATACode = (city, country) => {
  return IATA_CODES[city] || 
         IATA_CODES[country] || 
         (city?.length >= 3 ? city.substring(0, 3).toUpperCase() : 'XXX');
};

// =============================================
// PROCESSAMENTO DE DADOS DE ENTRADA
// =============================================
function processUserData(data) {
  const getCompanionText = (val) => {
    const options = ['sozinho(a)', 'em casal', 'em família', 'com amigos'];
    return options[parseInt(val) || 0];
  };
  
  const getPreferenceText = (val) => {
    const options = [
      'relaxamento', 'aventura e natureza', 
      'cultura e história', 'vida urbana e compras'
    ];
    return options[parseInt(val) || 0];
  };
  
  // Processa datas
  let travelDates = { departure: null, return: null };
  if (data.datas) {
    if (typeof data.datas === 'string' && data.datas.includes(',')) {
      const [dep, ret] = data.datas.split(',');
      travelDates = { departure: dep.trim(), return: ret.trim() };
    } else if (data.datas.dataIda) {
      travelDates = { departure: data.datas.dataIda, return: data.datas.dataVolta };
    }
  }
  
  // Define datas padrão se não fornecidas
  if (!travelDates.departure) {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);
    
    travelDates.departure = utils.formatDate(nextMonth);
    const returnDate = new Date(nextMonth);
    returnDate.setDate(returnDate.getDate() + 7);
    travelDates.return = utils.formatDate(returnDate);
  }
  
  return {
    origin: data.cidade_partida?.name || 'São Paulo',
    companion: getCompanionText(data.companhia),
    preference: getPreferenceText(data.preferencia_viagem),
    budget: data.orcamento_valor ? parseFloat(data.orcamento_valor) : 3000,
    currency: data.moeda_escolhida || 'BRL',
    travelers: data.quantidade_familia || data.quantidade_amigos || 1,
    dates: travelDates
  };
}

// =============================================
// PROMPT OTIMIZADO PARA DEEPSEEK R1 REASONER
// =============================================
function generateDeepseekPrompt(userData) {
  return `# Tarefa: Recomendações de Destinos de Viagem

## Dados do Viajante
- Origem: ${userData.origin}
- Tipo: ${userData.companion}
- Preferência: ${userData.preference}
- Orçamento voos: ${userData.budget} ${userData.currency}
- Pessoas: ${userData.travelers}
- Datas: ${userData.dates.departure} a ${userData.dates.return}

## Raciocínio Necessário
1. Analise o perfil e determine destinos adequados
2. Considere clima e eventos sazonais para as datas
3. Garanta que preços de voo fiquem dentro do orçamento
4. Diversifique geograficamente as opções

## Resposta Requerida (JSON exato):
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "País",
    "codigoPais": "BR",
    "porque": "Razão específica para este viajante",
    "destaque": "Experiência única",
    "comentario": "Comentário da Tripinha (cachorra vira-lata) mencionando pontos turísticos específicos e detalhes sensoriais",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"],
    "clima": {"temperatura": "20°C-25°C", "condicoes": "Ensolarado"},
    "aeroporto": {"codigo": "LIS", "nome": "Aeroporto de Lisboa"},
    "preco": {"voo": ${Math.round(userData.budget * 0.9)}, "hotel": 200}
  },
  "alternativas": [
    {
      "destino": "Cidade 1", "pais": "País 1", "codigoPais": "XX",
      "porque": "Razão", "pontoTuristico": "Ponto famoso",
      "aeroporto": {"codigo": "XXX", "nome": "Aeroporto"},
      "preco": {"voo": ${Math.round(userData.budget * 0.8)}, "hotel": 180}
    },
    {
      "destino": "Cidade 2", "pais": "País 2", "codigoPais": "YY",
      "porque": "Razão", "pontoTuristico": "Ponto famoso",
      "aeroporto": {"codigo": "YYY", "nome": "Aeroporto"},
      "preco": {"voo": ${Math.round(userData.budget * 0.85)}, "hotel": 190}
    },
    {
      "destino": "Cidade 3", "pais": "País 3", "codigoPais": "ZZ",
      "porque": "Razão", "pontoTuristico": "Ponto famoso",
      "aeroporto": {"codigo": "ZZZ", "nome": "Aeroporto"},
      "preco": {"voo": ${Math.round(userData.budget * 0.75)}, "hotel": 170}
    }
  ],
  "surpresa": {
    "destino": "Destino Incomum",
    "pais": "País",
    "codigoPais": "XX",
    "porque": "Razão do fator surpresa",
    "destaque": "Experiência única",
    "comentario": "Comentário entusiasmado da Tripinha",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"],
    "clima": {"temperatura": "18°C-24°C", "condicoes": "Agradável"},
    "aeroporto": {"codigo": "XXX", "nome": "Aeroporto"},
    "preco": {"voo": ${Math.round(userData.budget * 0.8)}, "hotel": 180}
  }
}`;
}

// =============================================
// CHAMADAS ÀS APIS DE IA
// =============================================
async function callAIProvider(provider, prompt, userData) {
  const apiConfigs = {
    deepseek: {
      url: 'https://api.deepseek.com/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      model: 'deepseek-reasoner',
      systemMsg: 'Você é um especialista em viagens. Analise step-by-step e retorne apenas JSON válido.',
      temp: 0.3
    },
    perplexity: {
      url: 'https://api.perplexity.ai/chat/completions',
      headers: { 'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}` },
      model: 'sonar',
      systemMsg: 'Especialista em viagens. Retorne apenas JSON com destinos dentro do orçamento.',
      temp: 0.5
    },
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      model: 'gpt-4',
      systemMsg: 'Especialista em viagens. JSON apenas, respeite o orçamento.',
      temp: 0.7
    }
  };
  
  const config = apiConfigs[provider];
  if (!config || !config.headers.Authorization.includes(process.env[`${provider.toUpperCase()}_API_KEY`])) {
    throw new Error(`${provider} não configurado`);
  }
  
  const finalPrompt = provider === 'deepseek' ? 
    generateDeepseekPrompt(userData) : 
    `${prompt}\n\nIMPORTANTE: JSON válido apenas, orçamento máximo ${userData.budget} ${userData.currency}`;
  
  const requestBody = {
    model: config.model,
    messages: [
      { role: "system", content: config.systemMsg },
      { role: "user", content: finalPrompt }
    ],
    temperature: config.temp,
    max_tokens: 3000
  };
  
  if (provider !== 'openai') {
    requestBody.response_format = { type: "json_object" };
  }
  
  utils.log(`[${provider.toUpperCase()}] Enviando requisição...`);
  
  const response = await apiClient({
    method: 'post',
    url: config.url,
    headers: { 'Content-Type': 'application/json', ...config.headers },
    data: requestBody
  });
  
  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Resposta inválida de ${provider}`);
  
  utils.log(`[${provider.toUpperCase()}] Resposta recebida`);
  return utils.extractJSON(content);
}

// =============================================
// DADOS DE EMERGÊNCIA SIMPLIFICADOS
// =============================================
function generateEmergencyData(userData) {
  const budget = userData.budget || 3000;
  const isBrazilian = userData.origin.toLowerCase().includes('brasil') || 
                      userData.origin.toLowerCase().includes('são paulo');
  
  return {
    topPick: {
      destino: isBrazilian ? "Lisboa" : "Cartagena",
      pais: isBrazilian ? "Portugal" : "Colômbia",
      codigoPais: isBrazilian ? "PT" : "CO",
      porque: "Excelente custo-benefício e rica cultura",
      destaque: "Explorar o centro histórico",
      comentario: `${isBrazilian ? 'Lisboa' : 'Cartagena'} é incrível! Adorei passear pelas ruas históricas, tantos cheiros e sons novos! 🐾`,
      pontosTuristicos: isBrazilian ? ["Torre de Belém", "Alfama"] : ["Cidade Amuralhada", "Playa Blanca"],
      clima: { temperatura: "22°C-28°C", condicoes: "Agradável" },
      aeroporto: { 
        codigo: isBrazilian ? "LIS" : "CTG", 
        nome: isBrazilian ? "Aeroporto de Lisboa" : "Aeroporto de Cartagena" 
      },
      preco: { voo: Math.round(budget * 0.85), hotel: 220 }
    },
    alternativas: [
      {
        destino: "Porto", pais: "Portugal", codigoPais: "PT",
        porque: "Cidade histórica com vinhos famosos",
        pontoTuristico: "Livraria Lello",
        aeroporto: { codigo: "OPO", nome: "Aeroporto do Porto" },
        preco: { voo: Math.round(budget * 0.75), hotel: 180 }
      },
      {
        destino: "Santiago", pais: "Chile", codigoPais: "CL",
        porque: "Cidade moderna cercada por montanhas",
        pontoTuristico: "Cerro San Cristóbal",
        aeroporto: { codigo: "SCL", nome: "Aeroporto de Santiago" },
        preco: { voo: Math.round(budget * 0.8), hotel: 200 }
      },
      {
        destino: "Cidade do México", pais: "México", codigoPais: "MX",
        porque: "Rica cultura e gastronomia única",
        pontoTuristico: "Teotihuacán",
        aeroporto: { codigo: "MEX", nome: "Aeroporto da Cidade do México" },
        preco: { voo: Math.round(budget * 0.7), hotel: 190 }
      }
    ],
    surpresa: {
      destino: "Montevidéu",
      pais: "Uruguai",
      codigoPais: "UY",
      porque: "Destino charmoso e pouco explorado",
      destaque: "Mercado del Puerto",
      comentario: "Montevidéu é uma surpresa incrível! O Mercado del Puerto tem aromas que deixaram meu focinho louco! 🐾",
      pontosTuristicos: ["Mercado del Puerto", "Rambla"],
      clima: { temperatura: "15°C-22°C", condicoes: "Temperado" },
      aeroporto: { codigo: "MVD", nome: "Aeroporto de Montevidéu" },
      preco: { voo: Math.round(budget * 0.75), hotel: 170 }
    }
  };
}

// =============================================
// HANDLER PRINCIPAL
// =============================================
module.exports = async function handler(req, res) {
  let responseTimer;
  let isResponseSent = false;
  
  const sendResponse = (data) => {
    if (!isResponseSent) {
      isResponseSent = true;
      if (responseTimer) clearTimeout(responseTimer);
      res.status(200).json(data);
    }
  };
  
  // Timeout de segurança
  responseTimer = setTimeout(() => {
    console.log('⚠️ Timeout atingido, enviando dados de emergência');
    sendResponse({
      tipo: "timeout",
      conteudo: JSON.stringify(generateEmergencyData({ budget: 3000, origin: 'São Paulo' }))
    });
  }, CONFIG.timeout.handler);
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return sendResponse({});
  if (req.method !== 'POST') return sendResponse({ error: "Método não permitido" });
  
  try {
    if (!req.body) throw new Error("Dados não fornecidos");
    
    const rawData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userData = processUserData(rawData);
    
    utils.log('📊 Dados processados:', userData);
    
    // Tenta providers em ordem de prioridade
    for (const provider of CONFIG.providerOrder) {
      if (!process.env[`${provider.toUpperCase()}_API_KEY`]) continue;
      
      try {
        console.log(`🚀 Tentando ${provider.toUpperCase()}...`);
        
        const jsonResponse = await callAIProvider(provider, '', userData);
        
        if (jsonResponse && utils.isValidDestination(jsonResponse)) {
          console.log(`✅ ${provider.toUpperCase()} retornou resposta válida`);
          
          return sendResponse({
            tipo: provider,
            conteudo: jsonResponse
          });
        } else {
          console.log(`❌ ${provider.toUpperCase()} - resposta inválida`);
        }
      } catch (error) {
        console.error(`❌ Erro em ${provider.toUpperCase()}:`, error.message);
      }
    }
    
    // Fallback para dados de emergência
    console.log('⚠️ Todos providers falharam, usando dados de emergência');
    const emergencyData = generateEmergencyData(userData);
    
    return sendResponse({
      tipo: "emergency",
      conteudo: JSON.stringify(emergencyData)
    });
    
  } catch (error) {
    console.error('❌ Erro global:', error.message);
    
    return sendResponse({
      tipo: "error",
      conteudo: JSON.stringify(generateEmergencyData({ budget: 3000, origin: 'São Paulo' })),
      error: error.message
    });
  }
};
