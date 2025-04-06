// api/flight-search.js - INICIA a busca de voos e retorna search_id
// Versão com correção na geração da assinatura e ajuste de locale
const axios = require('axios');
const crypto = require('crypto');

// --- Funções Auxiliares ---
function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isValidIATA(code) {
  return /^[A-Z]{3}$/.test(code);
}

// Função Auxiliar para achatar e coletar todos os valores primitivos de um objeto/array
function flattenValues(data) {
    const values = [];
    const process = (item) => {
        if (item === null || item === undefined) {
            // Ignora null/undefined explicitamente para evitar 'null'/'undefined' na assinatura
            return;
        }
        if (typeof item === 'object') {
            if (Array.isArray(item)) {
                item.forEach(process); // Processa cada item do array
            } else {
                // Processa valores de propriedades do objeto recursivamente
                Object.values(item).forEach(process);
            }
        } else if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
            // Adiciona apenas valores primitivos convertidos para string
            values.push(String(item));
        }
    };
    process(data);
    return values;
}


// --- Função generateSignature CORRIGIDA (Ponto 1) ---
// Ordena os VALORES alfabeticamente, conforme documentação oficial
function generateSignature(data, token) {
    console.log("--- Iniciando Geração de Assinatura (Valores Ordenados) ---");
    // 1. Coletar TODOS os valores dos parâmetros enviados
    //    Incluindo os valores de 'passengers' e 'segments' individualmente
    const allValues = [];

    // Adiciona valores simples obrigatórios
    allValues.push(String(data.marker));
    allValues.push(String(data.host));
    allValues.push(String(data.user_ip));
    allValues.push(String(data.locale));
    allValues.push(String(data.trip_class));

    // Adiciona valores de passageiros
    allValues.push(String(data.passengers.adults));
    allValues.push(String(data.passengers.children));
    allValues.push(String(data.passengers.infants));

    // Adiciona valores de segmentos
    data.segments.forEach(segment => {
        allValues.push(String(segment.origin));
        allValues.push(String(segment.destination));
        allValues.push(String(segment.date));
    });

    // Adiciona valores opcionais SE existirem
    if (data.know_english !== undefined) {
        allValues.push(String(data.know_english));
    }
    if (data.currency !== undefined) {
        allValues.push(String(data.currency));
    }
    if (data.only_direct !== undefined) { // Exemplo se adicionar only_direct
        allValues.push(String(data.only_direct));
    }
    // Adicione outros parâmetros opcionais aqui

    console.log("Valores coletados ANTES da ordenação:", allValues);

    // 2. Ordenar a lista de valores alfabeticamente
    allValues.sort((a, b) => a.localeCompare(b)); // Ordenação alfabética padrão

    console.log("Valores coletados DEPOIS da ordenação:", allValues);

    // 3. Concatenar token e valores ordenados com ':'
    const signatureString = token + ':' + allValues.join(':');

    console.log("String completa para assinatura:", signatureString);

    // 4. Gerar hash MD5
    const signatureHash = crypto.createHash('md5').update(signatureString).digest('hex');
    console.log("Hash MD5 gerado (Signature - Valores Ordenados):", signatureHash);

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
        return res.status(400).json({ error: "Parâmetros inválidos ou ausentes." });
    }
    const origem = params.origem.toUpperCase();
    const destino = params.destino.toUpperCase();
    // --- Fim Validações ---

    // --- Obter variáveis de ambiente ---
    const token = process.env.AVIASALES_TOKEN;
    const marker = process.env.AVIASALES_MARKER;
    const hostEnv = process.env.HOST || "www.benetrip.com.br";

    if (!token || !marker) {
      console.error("!!! ERRO CRÍTICO: Credenciais da API não configuradas no servidor.");
      return res.status(500).json({ error: "Configuração interna da API incompleta." });
    }

    const userIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.headers['client-ip'] || req.connection?.remoteAddress || req.socket?.remoteAddress || "127.0.0.1";
    // --- Fim Obter variáveis ---


    // --- Montar objeto da requisição ---
    // Lista de locales suportados pela documentação oficial
    const supportedLocales = ['en', 'ru', 'de', 'fr', 'it', 'pl', 'th', 'zh-Hans', 'ko', 'ja', 'vi', 'pt', 'uk', 'es', 'id', 'ms', 'zh-Hant', 'tr'];
    const requestData = {
      marker: marker,
      host: hostEnv,
      user_ip: userIp,
      // AJUSTE (Ponto 3): Usa 'en' como padrão e valida contra lista oficial
      locale: params.locale && supportedLocales.includes(params.locale) ? params.locale : "en",
      trip_class: params.classe ? params.classe.toUpperCase() : "Y",
      passengers: {
        adults: parseInt(params.adultos || 1, 10),
        children: parseInt(params.criancas || 0, 10),
        infants: parseInt(params.bebes || 0, 10)
      },
      segments: []
      // Opcionais podem ser adicionados aqui, se necessário
      // know_english: ...,
      // currency: ...,
      // only_direct: ...,
    };

     // Adiciona opcionais se vierem do frontend
    if (params.know_english !== undefined) {
        // Garante que é booleano para a assinatura
        requestData.know_english = (String(params.know_english).toLowerCase() === 'true');
    }
    if (params.currency) {
        // Garante 3 letras maiúsculas
        requestData.currency = String(params.currency).toUpperCase().substring(0, 3);
    }
     if (params.only_direct !== undefined) { // Exemplo only_direct
        requestData.only_direct = (String(params.only_direct).toLowerCase() === 'true');
    }


    requestData.segments.push({ origin: origem, destination: destino, date: params.dataIda });
    if (params.dataVolta) {
      requestData.segments.push({ origin: destino, destination: origem, date: params.dataVolta });
    }
    // --- Fim Montar objeto ---

    // --- Gerar Assinatura (usando a nova função corrigida) ---
    const signature = generateSignature(requestData, token);
    requestData.signature = signature;
    // --- Fim Gerar Assinatura ---

    console.log("Enviando requisição INICIAL para Travelpayouts...");
    const logData = { ...requestData };
    delete logData.signature; // Não loga a assinatura
    console.log("Payload (sem assinatura):", JSON.stringify(logData, null, 2));


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

    console.log("Resposta inicial da Travelpayouts (Status):", apiResponse.status);

    const searchId = apiResponse.data?.search_id;
    const currencyRates = apiResponse.data?.currency_rates; // Pode não vir mais aqui, verificar docs

    if (searchId) {
      console.log("Busca iniciada com sucesso. Search ID:", searchId);
      // Retorna 202 com search_id (e talvez currency_rates, se ainda vier)
      return res.status(202).json({
        search_id: searchId,
        currency_rates: currencyRates,
        message: "Busca de voos iniciada. Use o search_id para verificar os resultados."
      });
    } else {
      // A API retornou 200 mas sem search_id? Algo errado.
      console.error("!!! ERRO: A API Travelpayouts não retornou search_id apesar do status 200. Resposta:", apiResponse.data);
      return res.status(500).json({ error: "Falha ao iniciar a busca. Resposta inesperada da API externa.", apiResponse: apiResponse.data });
    }

  } catch (error) {
    // --- Tratamento de Erro ---
    console.error("!!! ERRO GERAL NO HANDLER /api/flight-search !!!");
    if (error.response) {
        // Erro retornado pela API da Travelpayouts (ex: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 5xx)
        console.error("Erro Axios (Initial Search): Status:", error.response.status, "Data:", error.response.data);
        // Se for 401 ou 403, provavelmente a assinatura está errada ou token/marker inválido
        if (error.response.status === 401 || error.response.status === 403) {
             console.error("!!! ATENÇÃO: Erro 401/403 pode indicar assinatura inválida ou credenciais incorretas !!!");
        }
        return res.status(error.response.status).json({
            error: `Erro ${error.response.status} ao iniciar busca com a API externa.`,
            details: error.response.data
        });
    } else if (error.request) {
        // A requisição foi feita mas não houve resposta (timeout, problema de rede)
        console.error("Erro Axios (Initial Search): Nenhuma resposta recebida:", error.message);
        return res.status(504).json({ error: "Nenhuma resposta da API externa ao iniciar busca (Gateway Timeout)." });
    } else {
        // Erro na configuração da requisição ou outro erro interno
        console.error("Erro interno (Initial Search):", error.message);
        return res.status(500).json({ error: "Erro interno no servidor ao iniciar busca.", details: error.message });
    }
    // --- Fim Tratamento de Erro ---
  }
};
