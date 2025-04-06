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

// Função generateSignature CORRIGIDA - Ordena alfabeticamente por nome de parâmetro
function generateSignature(data, token) {
  // Extrair todos os parâmetros em pares de chave-valor
  const paramPairs = [];
  
  // Adicionar parâmetros simples
  paramPairs.push(['host', data.host]);
  paramPairs.push(['locale', data.locale]);
  paramPairs.push(['marker', data.marker]);
  paramPairs.push(['trip_class', data.trip_class]);
  paramPairs.push(['user_ip', data.user_ip]);
  
  // Adicionar parâmetros opcionais se existirem
  if (data.currency !== undefined) paramPairs.push(['currency', data.currency]);
  if (data.know_english !== undefined) paramPairs.push(['know_english', data.know_english]);
  if (data.direct !== undefined) paramPairs.push(['direct', data.direct]);
  if (data.flexible !== undefined) paramPairs.push(['flexible', data.flexible]);
  
  // Adicionar parâmetros de passageiros
  paramPairs.push(['passengers.adults', data.passengers.adults]);
  paramPairs.push(['passengers.children', data.passengers.children]);
  paramPairs.push(['passengers.infants', data.passengers.infants]);
  
  // Adicionar segmentos
  data.segments.forEach((segment, index) => {
    paramPairs.push([`segments[${index}].date`, segment.date]);
    paramPairs.push([`segments[${index}].destination`, segment.destination]);
    paramPairs.push([`segments[${index}].origin`, segment.origin]);
  });
  
  // Ordenar por nome do parâmetro (primeira posição no par)
  paramPairs.sort((a, b) => a[0].localeCompare(b[0]));
  
  // Extrair apenas os valores (segunda posição no par) na ordem ordenada
  const sortedValues = paramPairs.map(pair => pair[1]);
  
  // Concatenar valores com token
  const signatureString = token + ':' + sortedValues.join(':');
  
  console.log("--- Debug Assinatura (Método Ordenação Alfabética) ---");
  console.log("Token (início):", token ? token.substring(0, 4) + '****' : 'NÃO DEFINIDO');
  console.log("Valores concatenados (na ordem das chaves ordenadas):", sortedValues.join(':'));
  console.log("String completa para assinatura:", signatureString);
  
  // Gerar hash
  const signatureHash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log("Hash MD5 gerado (Signature - Alfabético):", signatureHash);
  
  return signatureHash;
}
// --- Fim Funções Auxiliares ---


// --- Handler Principal ---
module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Restrinja em produção
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    console.log("Iniciando busca de voos (Endpoint: /api/flight-search)...");
    const params = req.body;

    // --- Validações ---
    if (!params.origem || !params.destino || !params.dataIda || !isValidIATA(params.origem.toUpperCase()) || !isValidIATA(params.destino.toUpperCase()) || !isValidDate(params.dataIda) || (params.dataVolta && !isValidDate(params.dataVolta))) {
         // Consolida validações básicas
         // (Adicione validações mais específicas se necessário)
        return res.status(400).json({ error: "Parâmetros inválidos ou ausentes." });
    }
    const origem = params.origem.toUpperCase();
    const destino = params.destino.toUpperCase();
    // --- Fim Validações ---

    // --- Obter variáveis de ambiente ---
    const token = process.env.AVIASALES_TOKEN;
    const marker = process.env.AVIASALES_MARKER;
    const hostEnv = process.env.HOST || "www.benetrip.com.br"; // Garante www

    if (!token || !marker) {
      console.error("!!! ERRO CRÍTICO: Credenciais da API não configuradas no servidor.");
      return res.status(500).json({ error: "Configuração interna da API incompleta." });
    }

    const userIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.headers['client-ip'] || req.connection?.remoteAddress || req.socket?.remoteAddress || "127.0.0.1";
    // --- Fim Obter variáveis ---


    // --- Montar objeto da requisição ---
    const requestData = {
      marker: marker,
      host: hostEnv,
      user_ip: userIp,
      locale: params.locale || "en", // Usa locale suportado por Aviasales (en-us, en-gb, ru, de, es, fr, pl)
      trip_class: params.classe ? params.classe.toUpperCase() : "Y",
      passengers: {
        adults: parseInt(params.adultos || 1, 10),
        children: parseInt(params.criancas || 0, 10),
        infants: parseInt(params.bebes || 0, 10)
      },
      segments: []
    };

    requestData.segments.push({ origin: origem, destination: destino, date: params.dataIda });
    if (params.dataVolta) {
      requestData.segments.push({ origin: destino, destination: origem, date: params.dataVolta });
    }
    // --- Fim Montar objeto ---

    // --- Gerar Assinatura ---
    const signature = generateSignature(requestData, token);
    requestData.signature = signature;
    // --- Fim Gerar Assinatura ---

    console.log("Enviando requisição INICIAL para Travelpayouts...");
    console.log("Payload completo:", JSON.stringify(requestData, null, 2));

    // --- Enviar requisição INICIAL ---
    const apiResponse = await axios.post(
      "https://api.travelpayouts.com/v1/flight_search",
      requestData,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15000 // Timeout para esta chamada inicial
      }
    );
    // --- Fim Enviar requisição ---

    console.log("Resposta inicial da Travelpayouts (Status):", apiResponse.status);

    const searchId = apiResponse.data?.search_id;

    if (searchId) {
      console.log("Busca iniciada com sucesso. Search ID:", searchId);
      // Retorna 202 Accepted com o search_id. O frontend fará o polling.
      return res.status(202).json({
        search_id: searchId,
        message: "Busca de voos iniciada. Use o search_id para verificar os resultados."
      });
    } else {
      // Se a API não retornar search_id mesmo com status 2xx, algo está errado.
      console.error("!!! ERRO: A API Travelpayouts não retornou search_id apesar do status de sucesso aparente. Resposta:", apiResponse.data);
      return res.status(500).json({ error: "Falha ao iniciar a busca. Resposta inesperada da API externa.", apiResponse: apiResponse.data });
    }

  } catch (error) {
    // --- Tratamento de Erro (mantido) ---
    console.error("!!! ERRO GERAL NO HANDLER /api/flight-search !!!");
    if (error.response) {
        console.error("Erro Axios (Initial Search): Status:", error.response.status, "Data:", error.response.data);
        return res.status(error.response.status).json({ // Retorna o erro da API externa
            error: `Erro ${error.response.status} ao iniciar busca com a API externa.`,
            details: error.response.data
        });
    } else if (error.request) {
        console.error("Erro Axios (Initial Search): Nenhuma resposta recebida:", error.message);
        return res.status(504).json({ error: "Nenhuma resposta da API externa ao iniciar busca (Gateway Timeout)." });
    } else {
        console.error("Erro interno (Initial Search):", error.message);
        return res.status(500).json({ error: "Erro interno no servidor ao iniciar busca.", details: error.message });
    }
    // --- Fim Tratamento de Erro ---
  }
};
