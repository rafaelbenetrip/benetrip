// api/flight-search.js - INICIA a busca de voos e retorna search_id
const axios = require('axios');
const crypto = require('crypto');

// --- Funções Auxiliares ---
function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isValidIATA(code) {
  return /^[A-Z]{3}$/.test(code);
}

// Função de assinatura EXATAMENTE conforme documentação da Travelpayouts
function generateSignature(data, token) {
  // Função para extrair valores na ordem correta conforme a documentação
  function extractOrderedValues(data) {
    let allValues = [];
    
    // 1. Obter parâmetros de nível superior em ordem alfabética
    const topLevelKeys = Object.keys(data).filter(key => 
      key !== 'passengers' && key !== 'segments' && key !== 'signature'
    ).sort();
    
    // 2. Adicionar valores dos parâmetros de nível superior
    for (const key of topLevelKeys) {
      allValues.push(data[key]);
    }
    
    // 3. Adicionar valores de passengers (se existir), em ordem alfabética
    if (data.passengers) {
      const passengerKeys = Object.keys(data.passengers).sort();
      for (const key of passengerKeys) {
        allValues.push(data.passengers[key]);
      }
    }
    
    // 4. Adicionar valores de segments (se existir), mantendo a ordem dos segmentos
    if (data.segments && Array.isArray(data.segments)) {
      for (const segment of data.segments) {
        // Para cada segmento, ordenar suas chaves alfabeticamente
        const segmentKeys = Object.keys(segment).sort();
        for (const key of segmentKeys) {
          allValues.push(segment[key]);
        }
      }
    }
    
    return allValues;
  }
  
  // Extrair valores na ordem específica
  const orderedValues = extractOrderedValues(data);
  
  // Concatenar token + valores separados por dois pontos
  const signatureString = token + ':' + orderedValues.join(':');
  
  console.log("--- Debug Assinatura (seguindo documentação) ---");
  console.log("Token (início):", token ? token.substring(0, 4) + '****' : 'NÃO DEFINIDO');
  console.log("Valores em ordem:", orderedValues);
  console.log("String para assinatura:", signatureString);
  
  // Calcular o hash MD5
  const signature = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log("Hash MD5 gerado:", signature);
  
  return signature;
}

// --- Handler Principal ---
module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    console.log("Iniciando busca de voos...");
    const params = req.body;

    // --- Validações ---
    if (!params.origem || !params.destino || !params.dataIda) {
      return res.status(400).json({ error: "Parâmetros obrigatórios ausentes." });
    }
    
    if (!isValidIATA(params.origem.toUpperCase()) || !isValidIATA(params.destino.toUpperCase())) {
      return res.status(400).json({ error: "Códigos IATA inválidos." });
    }
    
    if (!isValidDate(params.dataIda) || (params.dataVolta && !isValidDate(params.dataVolta))) {
      return res.status(400).json({ error: "Formato de data inválido. Use YYYY-MM-DD." });
    }
    
    const origem = params.origem.toUpperCase();
    const destino = params.destino.toUpperCase();
    // --- Fim Validações ---

    // --- Obter variáveis de ambiente ---
    const token = process.env.AVIASALES_TOKEN;
    const marker = process.env.AVIASALES_MARKER;
    const hostEnv = process.env.HOST || "benetrip.com.br";

    if (!token || !marker) {
      console.error("!!! ERRO: Credenciais da API não configuradas");
      return res.status(500).json({ error: "Configuração interna incompleta." });
    }

    // Obter IP do cliente com fallbacks
    const userIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                  req.headers['client-ip'] || 
                  req.connection?.remoteAddress || 
                  "127.0.0.1";
    // --- Fim Obter variáveis ---

    // --- Montar objeto da requisição EXATAMENTE conforme documentação ---
    const requestData = {
      marker: marker,
      host: hostEnv,
      user_ip: userIp,
      locale: params.locale || "en",
      trip_class: params.classe ? params.classe.toUpperCase() : "Y",
      passengers: {
        adults: parseInt(params.adultos || 1, 10),
        children: parseInt(params.criancas || 0, 10),
        infants: parseInt(params.bebes || 0, 10)
      },
      segments: []
    };

    // Adicionar segmentos (ida e volta)
    requestData.segments.push({
      origin: origem,
      destination: destino,
      date: params.dataIda
    });
    
    if (params.dataVolta) {
      requestData.segments.push({
        origin: destino,
        destination: origem,
        date: params.dataVolta
      });
    }
    
    // Adicionar parâmetros opcionais se fornecidos
    if (params.know_english !== undefined) requestData.know_english = params.know_english;
    // --- Fim Montar objeto ---

    // --- Gerar Assinatura ---
    const signature = generateSignature(requestData, token);
    requestData.signature = signature;
    // --- Fim Gerar Assinatura ---

    console.log("Enviando requisição para API Travelpayouts:");
    console.log("Payload:", JSON.stringify(requestData));

    // --- Enviar requisição INICIAL ---
    const apiResponse = await axios.post(
      "https://api.travelpayouts.com/v1/flight_search",
      requestData,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15000
      }
    );
    // --- Fim Enviar requisição ---

    const searchId = apiResponse.data?.search_id;

    if (searchId) {
      console.log("Busca iniciada com sucesso. Search ID:", searchId);
      // Retorna 202 Accepted com o search_id para o frontend fazer polling
      return res.status(202).json({
        success: true,
        search_id: searchId,
        message: "Busca de voos iniciada."
      });
    } else {
      console.error("!!! ERRO: API não retornou search_id:", apiResponse.data);
      return res.status(500).json({ 
        error: "Falha ao iniciar a busca. Resposta inesperada da API externa.", 
        details: apiResponse.data 
      });
    }

  } catch (error) {
    // --- Tratamento de Erro ---
    console.error("!!! ERRO NA BUSCA DE VOOS:", error.message);
    
    if (error.response) {
      // Erro com resposta da API externa
      console.error("Status:", error.response.status, "Dados:", error.response.data);
      return res.status(error.response.status).json({
        error: `Erro ${error.response.status} ao iniciar busca.`,
        details: error.response.data
      });
    } else if (error.request) {
      // Erro sem resposta (timeout, rede)
      console.error("Sem resposta da API externa:", error.message);
      return res.status(504).json({ 
        error: "Timeout ou erro de conexão com a API externa." 
      });
    } else {
      // Outros erros
      console.error("Erro interno:", error.message);
      return res.status(500).json({ 
        error: "Erro interno no servidor.", 
        details: error.message 
      });
    }
    // --- Fim Tratamento de Erro ---
  }
};
