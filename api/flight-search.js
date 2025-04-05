// api/flight-search.js - Endpoint para busca de voos conforme as especificações da API Travelpayouts
const axios = require('axios');
const crypto = require('crypto');

// Função para validar data no formato YYYY-MM-DD
function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

// Função para validar código IATA (3 letras maiúsculas)
function isValidIATA(code) {
  return /^[A-Z]{3}$/.test(code);
}

module.exports = async function handler(req, res) {
  // Configuração dos cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Lida com requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Permite somente o método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    console.log("Iniciando busca de voos");
    const params = req.body;

    // Validação dos parâmetros obrigatórios
    if (!params.origem || !params.destino || !params.dataIda) {
      return res.status(400).json({ 
        error: "Parâmetros obrigatórios ausentes: 'origem', 'destino' ou 'dataIda'" 
      });
    }
    if (!isValidDate(params.dataIda)) {
      return res.status(400).json({ error: "dataIda inválida. Use o formato YYYY-MM-DD" });
    }
    if (params.dataVolta && !isValidDate(params.dataVolta)) {
      return res.status(400).json({ error: "dataVolta inválida. Use o formato YYYY-MM-DD" });
    }

    // Garantir que os códigos IATA estejam em maiúsculas
    const origem = params.origem.toUpperCase();
    const destino = params.destino.toUpperCase();
    if (!isValidIATA(origem) || !isValidIATA(destino)) {
      return res.status(400).json({ error: "Código IATA inválido. Use 3 letras maiúsculas." });
    }

    // Obter variáveis de ambiente
    const token = process.env.AVIASALES_TOKEN;
    const marker = process.env.AVIASALES_MARKER;
    const hostEnv = process.env.HOST || "benetrip.com.br";

    if (!token || !marker) {
      console.error("Token ou Marker da API não configurados");
      return res.status(500).json({ error: "Configuração da API incompleta" });
    }

    console.log("Token:", token.substring(0, 4) + "****");
    console.log("Marker:", marker);

    // Montar o objeto de requisição conforme a especificação da API
    const requestData = {
      marker: marker,
      host: hostEnv,
      user_ip: req.headers['x-forwarded-for'] ||
               req.headers['client-ip'] ||
               req.connection.remoteAddress ||
               "127.0.0.1",
      locale: "en", // ou "pt" conforme o idioma desejado
      trip_class: params.classe ? params.classe.toUpperCase() : "Y",
      passengers: {
        adults: params.adultos || 1,
        children: params.criancas || 0,
        infants: params.bebes || 0
      },
      segments: []
    };

    // Adicionar segmento de ida
    requestData.segments.push({
      origin: origem,
      destination: destino,
      date: params.dataIda
    });

    // Adicionar segmento de volta, se fornecido (round trip)
    if (params.dataVolta) {
      requestData.segments.push({
        origin: destino,
        destination: origem,
        date: params.dataVolta
      });
    }

    // Gerar a assinatura conforme a ordem fixa:
    // marker, host, user_ip, locale, trip_class, 
    // passengers.adults, passengers.children, passengers.infants,
    // para cada segmento: origin, destination, date.
    const signature = generateSignature(requestData, token);
    requestData.signature = signature;

    console.log("Objeto de requisição montado:", JSON.stringify(requestData, null, 2));

    // Enviar a requisição POST para iniciar a busca
    const apiResponse = await axios.post(
      "https://api.travelpayouts.com/v1/flight_search",
      requestData,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000 // 10 segundos
      }
    );

    console.log("Resposta da API, status:", apiResponse.status);
    const searchId = apiResponse.data.search_id;
    if (!searchId) {
      console.error("A API não retornou search_id:", apiResponse.data);
      return res.status(500).json({ error: "A API não retornou search_id", apiResponse: apiResponse.data });
    }

    // Lógica de polling para buscar resultados completos
    const maxAttempts = 10;   // Número máximo de tentativas
    const intervalMs = 3000;    // Intervalo entre tentativas (em milissegundos)
    let attempts = 0;
    let resultados = null;
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Polling: tentativa ${attempts} de ${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));

      const resultsResponse = await axios.get(
        `https://api.travelpayouts.com/v1/flight_search_results?uuid=${searchId}`,
        { timeout: 8000 }
      );
      if (resultsResponse.data && resultsResponse.data.proposals && resultsResponse.data.proposals.length > 0) {
        console.log(`Resultados encontrados na tentativa ${attempts}`);
        resultados = resultsResponse.data;
        break;
      }
    }

    if (!resultados) {
      console.log("Busca em andamento; retornando search_id para consulta posterior");
      return res.status(202).json({
        success: true,
        search_id: searchId,
        message: "A busca está em andamento. Utilize o search_id para verificar os resultados posteriormente.",
        attempts: attempts
      });
    }

    return res.status(200).json({
      success: true,
      search_id: searchId,
      resultados: resultados,
      attempts: attempts
    });
  } catch (error) {
    console.error("Erro na busca de voos:", error);
    if (error.response) {
      console.error("Status da resposta:", error.response.status);
      console.error("Dados da resposta:", error.response.data);
      return res.status(error.response.status).json({ error: error.response.data });
    }
    return res.status(500).json({ error: error.message });
  }
};

// Função para gerar a assinatura com ordem fixa
function generateSignature(data, token) {
  // Ordem fixa: marker, host, user_ip, locale, trip_class,
  // passengers.adults, passengers.children, passengers.infants,
  // para cada segmento: origin, destination, date.
  const values = [];
  values.push(data.marker);
  values.push(data.host);
  values.push(data.user_ip);
  values.push(data.locale);
  values.push(data.trip_class);
  values.push(String(data.passengers.adults));
  values.push(String(data.passengers.children));
  values.push(String(data.passengers.infants));
  data.segments.forEach(segment => {
    values.push(segment.origin);
    values.push(segment.destination);
    values.push(segment.date);
  });
  // Concatena com ":" e antepõe o token também separado por ":"
  const signatureString = token + ':' + values.join(':');
  console.log("String da assinatura (primeiros 30 chars):", signatureString.substring(0, 30) + "...");
  return crypto.createHash('md5').update(signatureString).digest('hex');
}
