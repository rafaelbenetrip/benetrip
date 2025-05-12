// api/flight-search.js - INICIA a busca de voos e retorna search_id
// Versão com assinatura CORRIGIDA e inclusão de moeda na requisição inicial
const axios = require('axios');
const crypto = require('crypto');

// --- Funções Auxiliares ---
function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isValidIATA(code) {
  return /^[A-Z]{3}$/.test(code);
}

// --- Função generateSignature CORRIGIDA (Ordenação Aninhada) ---
// Segue a lógica da documentação: ordena nomes de nível superior + 'passengers' + 'segments',
// e insere os valores aninhados na ordem correta.
function generateSignature(data, token) {
  console.log("[Flight Search] Iniciando Geração de Assinatura (Ordenação Aninhada Correta)");

  const topLevelParamNames = [];
  const nestedStructureNames = ['passengers', 'segments'];

  // Adiciona chaves de nível superior presentes em 'data'
  if (data.host !== undefined) topLevelParamNames.push('host');
  if (data.locale !== undefined) topLevelParamNames.push('locale');
  if (data.marker !== undefined) topLevelParamNames.push('marker');
  if (data.trip_class !== undefined) topLevelParamNames.push('trip_class');
  if (data.user_ip !== undefined) topLevelParamNames.push('user_ip');
  if (data.currency !== undefined) topLevelParamNames.push('currency'); // Adicionado currency aqui
  if (data.know_english !== undefined) topLevelParamNames.push('know_english');
  if (data.only_direct !== undefined) topLevelParamNames.push('only_direct');

  const namesToSort = [...topLevelParamNames, ...nestedStructureNames];
  namesToSort.sort((a, b) => a.localeCompare(b));
  console.log("[Flight Search] Ordem dos nomes para assinatura:", namesToSort);

  const finalValues = [];
  namesToSort.forEach(name => {
    if (name === 'passengers') {
      finalValues.push(String(data.passengers.adults));
      finalValues.push(String(data.passengers.children));
      finalValues.push(String(data.passengers.infants));
    } else if (name === 'segments') {
      data.segments.forEach(segment => {
        finalValues.push(String(segment.date));
        finalValues.push(String(segment.destination));
        finalValues.push(String(segment.origin));
      });
    } else {
      if (data[name] !== undefined) {
         finalValues.push(String(data[name]));
      }
    }
  });

  console.log("[Flight Search] Valores finais para assinatura:", finalValues);
  const signatureString = token + ':' + finalValues.join(':');
  console.log("[Flight Search] String completa para assinatura:", signatureString.substring(0, 50) + "..."); // Log parcial por segurança
  const signatureHash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log("[Flight Search] Hash MD5 gerado (Assinatura):", signatureHash);
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
    console.log("[Flight Search] Iniciando busca de voos...");
    const params = req.body; // Parâmetros recebidos do frontend

    // --- Validações ---
    if (!params.origem || !params.destino || !params.dataIda ||
        !isValidIATA(params.origem.toUpperCase()) ||
        !isValidIATA(params.destino.toUpperCase()) ||
        !isValidDate(params.dataIda) ||
        (params.dataVolta && !isValidDate(params.dataVolta))) {
      console.warn("[Flight Search] Parâmetros inválidos ou ausentes:", params);
      return res.status(400).json({ error: "Parâmetros inválidos ou ausentes." });
    }
    const origem = params.origem.toUpperCase();
    const destino = params.destino.toUpperCase();
    // --- Fim Validações ---

    // --- Obter variáveis de ambiente ---
    const token = process.env.AVIASALES_TOKEN;
    const marker = process.env.AVIASALES_MARKER;
    const hostEnv = process.env.HOST || "www.benetrip.com.br"; // Use um host real ou configurável

    if (!token || !marker) {
      console.error("[Flight Search] ERRO CRÍTICO: Credenciais da API (AVIASALES_TOKEN/AVIASALES_MARKER) não configuradas no servidor.");
      return res.status(500).json({ error: "Configuração interna da API incompleta." });
    }

    const userIp = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                   req.headers['client-ip'] ||
                   req.connection?.remoteAddress ||
                   req.socket?.remoteAddress ||
                   "127.0.0.1"; // IP do usuário
    // --- Fim Obter variáveis ---


    // --- Montar objeto da requisição para Travelpayouts ---
    const supportedLocales = ['en', 'ru', 'de', 'fr', 'it', 'pl', 'th', 'zh-Hans', 'ko', 'ja', 'vi', 'pt', 'pt-BR', 'uk', 'es', 'id', 'ms', 'zh-Hant', 'tr'];
    const localeParam = params.locale && supportedLocales.includes(params.locale) ? params.locale : "pt-BR"; // Prioriza pt-BR

    const requestData = {
      marker: marker,
      host: hostEnv,
      user_ip: userIp,
      locale: localeParam,
      trip_class: params.classe ? params.classe.toUpperCase() : "Y",
      passengers: {
        adults: parseInt(params.adultos || 1, 10),
        children: parseInt(params.criancas || 0, 10),
        infants: parseInt(params.bebes || 0, 10)
      },
      segments: []
    };

    // Adiciona preferência para parceiros que suportam português se o locale for pt ou pt-BR
    if (requestData.locale && requestData.locale.toLowerCase().startsWith("pt")) {
      requestData.know_english = false; // Informa à API que o usuário pode não saber inglês
    }

    // Adiciona currency SE FOR ENVIADO PELO FRONTEND
    // Esta é a principal modificação desta seção
    if (params.currency && typeof params.currency === 'string' && params.currency.length === 3) {
      requestData.currency = params.currency.toUpperCase();
      console.log(`[Flight Search] Moeda definida na requisição inicial: ${requestData.currency}`);
    } else {
      console.log("[Flight Search] Moeda não especificada pelo frontend para a requisição inicial.");
    }

    if (params.only_direct !== undefined) {
        requestData.only_direct = (String(params.only_direct).toLowerCase() === 'true');
    }
    // Adicione outros opcionais aqui se necessário (ex: params.know_english)

    requestData.segments.push({ origin: origem, destination: destino, date: params.dataIda });
    if (params.dataVolta) {
      requestData.segments.push({ origin: destino, destination: origem, date: params.dataVolta });
    }
    // --- Fim Montar objeto ---

    // --- Gerar Assinatura ---
    const signature = generateSignature(requestData, token);
    requestData.signature = signature;
    // --- Fim Gerar Assinatura ---

    console.log("[Flight Search] Enviando requisição INICIAL para Travelpayouts...");
    const logDataForPayload = { ...requestData };
    delete logDataForPayload.signature; // Não logar a assinatura completa por segurança
    console.log("[Flight Search] Payload (sem assinatura):", JSON.stringify(logDataForPayload, null, 2));


    // --- Enviar requisição INICIAL ---
    const apiResponse = await axios.post(
      "https://api.travelpayouts.com/v1/flight_search",
      requestData,
      {
        headers: { "Content-Type": "application/json", 'Accept-Encoding': 'gzip, deflate, br' },
        timeout: 20000 // Aumentado timeout para 20s
      }
    );
    // --- Fim Enviar requisição ---

    console.log("[Flight Search] Resposta inicial da Travelpayouts (Status):", apiResponse.status);
    console.log("[Flight Search] Resposta completa da API Travelpayouts:", JSON.stringify(apiResponse.data, null, 2).substring(0, 500) + "..."); // Log parcial

    const searchId = apiResponse.data?.search_id;
    const currencyRates = apiResponse.data?.currency_rates; // Preservar formato original

    if (currencyRates) {
      console.log("[Flight Search] Taxas de câmbio recebidas da API:", JSON.stringify(currencyRates, null, 2));
    } else {
      console.warn("[Flight Search] ATENÇÃO: API não retornou taxas de câmbio (currency_rates)!");
    }

    // Tratar status 200 ou 202 como sucesso se tiver search_id
    if (searchId && (apiResponse.status === 200 || apiResponse.status === 202)) {
      console.log("[Flight Search] Busca iniciada com sucesso. Search ID:", searchId);
      return res.status(202).json({
        search_id: searchId,
        currency_rates: currencyRates, // Manter as taxas no formato original da API
        // raw_response: apiResponse.data, // Opcional: incluir resposta completa para diagnóstico no frontend
        message: "Busca de voos iniciada. Use o search_id para verificar os resultados."
      });
    } else {
      console.error(`[Flight Search] ERRO: A API Travelpayouts retornou status ${apiResponse.status} mas sem search_id ou status inesperado. Resposta:`, apiResponse.data);
      return res.status(apiResponse.status || 500).json({
        error: "Falha ao iniciar a busca. Resposta inesperada da API externa.",
        details: apiResponse.data
      });
    }

  } catch (error) {
    // --- Tratamento de Erro ---
    console.error("!!! [Flight Search] ERRO GERAL NO HANDLER /api/flight-search !!!");
    if (error.response) {
        console.error("[Flight Search] Erro Axios (Initial Search): Status:", error.response.status, "Data:", JSON.stringify(error.response.data).substring(0, 500) + "...");
        if (error.response.status === 401 || error.response.status === 403) {
             console.error("[Flight Search] !!! ATENÇÃO: Erro 401/403. Verifique a assinatura e as credenciais (Token/Marker).");
        }
        return res.status(error.response.status || 502).json({
            error: `Erro ${error.response.status || 'desconhecido'} ao iniciar busca com a API externa.`,
            details: error.response.data
        });
    } else if (error.request) {
        console.error("[Flight Search] Erro Axios (Initial Search): Nenhuma resposta recebida:", error.message);
        return res.status(504).json({ error: "Nenhuma resposta da API externa ao iniciar busca (Gateway Timeout)." });
    } else {
        console.error("[Flight Search] Erro interno (Initial Search):", error.message, error.stack);
        return res.status(500).json({ error: "Erro interno no servidor ao iniciar busca.", details: error.message });
    }
    // --- Fim Tratamento de Erro ---
  }
};
