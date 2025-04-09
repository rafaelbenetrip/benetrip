// api/flight-search.js - INICIA a busca de voos e retorna search_id
// Versão com assinatura CORRIGIDA para ordenação aninhada (documentação)
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
  console.log("--- Iniciando Geração de Assinatura (Ordenação Aninhada Correta) ---");

  // 1. Identificar chaves de nível superior e nomes das estruturas aninhadas
  const topLevelParamNames = [];
  const nestedStructureNames = ['passengers', 'segments']; // Estruturas aninhadas conhecidas

  // Adiciona chaves de nível superior presentes em 'data'
  if (data.host !== undefined) topLevelParamNames.push('host');
  if (data.locale !== undefined) topLevelParamNames.push('locale');
  if (data.marker !== undefined) topLevelParamNames.push('marker');
  if (data.trip_class !== undefined) topLevelParamNames.push('trip_class');
  if (data.user_ip !== undefined) topLevelParamNames.push('user_ip');
  // Adiciona opcionais de nível superior se presentes
  if (data.currency !== undefined) topLevelParamNames.push('currency');
  if (data.know_english !== undefined) topLevelParamNames.push('know_english');
  if (data.only_direct !== undefined) topLevelParamNames.push('only_direct');
  // Adicione outros opcionais de nível superior aqui

  // Lista combinada de nomes para ordenação
  const namesToSort = [...topLevelParamNames, ...nestedStructureNames];

  // 2. Ordenar a lista de nomes alfabeticamente
  namesToSort.sort((a, b) => a.localeCompare(b));
  console.log("Ordem dos nomes (nível superior + aninhados) para processamento:", namesToSort);

  // 3. Construir a lista final de VALORES na ordem definida
  const finalValues = [];
  namesToSort.forEach(name => {
    if (name === 'passengers') {
      // Insere valores de passengers na ordem: adults, children, infants
      finalValues.push(String(data.passengers.adults));
      finalValues.push(String(data.passengers.children));
      finalValues.push(String(data.passengers.infants));
    } else if (name === 'segments') {
      // Insere valores de cada segmento na ordem: date, destination, origin
      data.segments.forEach(segment => {
        finalValues.push(String(segment.date));
        finalValues.push(String(segment.destination));
        finalValues.push(String(segment.origin));
      });
    } else {
      // É um parâmetro de nível superior (simples ou opcional)
      // Adiciona o valor correspondente SE ele existir em 'data'
      if (data[name] !== undefined) {
         finalValues.push(String(data[name]));
      }
    }
  });

  console.log("Valores finais coletados na ordem correta:", finalValues);

  // 4. Concatenar token e valores finais com ':'
  const signatureString = token + ':' + finalValues.join(':');
  console.log("String completa para assinatura:", signatureString);

  // 5. Gerar hash MD5
  const signatureHash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log("Hash MD5 gerado (Signature - Ordenação Aninhada Correta):", signatureHash);

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
    const supportedLocales = ['en', 'ru', 'de', 'fr', 'it', 'pl', 'th', 'zh-Hans', 'ko', 'ja', 'vi', 'pt', 'uk', 'es', 'id', 'ms', 'zh-Hant', 'tr'];
    const requestData = {
      marker: marker,
      host: hostEnv,
      user_ip: userIp,
      // Mantém locale 'pt' e validação
      locale: params.locale && supportedLocales.includes(params.locale) ? params.locale : "pt",
      trip_class: params.classe ? params.classe.toUpperCase() : "Y",
      passengers: {
        adults: parseInt(params.adultos || 1, 10),
        children: parseInt(params.criancas || 0, 10),
        infants: parseInt(params.bebes || 0, 10)
      },
      segments: []
      // Opcionais serão adicionados abaixo se vierem dos params
    };

     // Adiciona opcionais se vierem do frontend
    if (params.know_english !== undefined) {
        requestData.know_english = (String(params.know_english).toLowerCase() === 'true');
    }
    if (params.currency) {
        requestData.currency = String(params.currency).toUpperCase().substring(0, 3);
    }
     if (params.only_direct !== undefined) {
        requestData.only_direct = (String(params.only_direct).toLowerCase() === 'true');
    }
    // Adicione outros opcionais aqui se necessário


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
    delete logData.signature;
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
    const currencyRates = apiResponse.data?.currency_rates;

    // Tratar status 200 ou 202 como sucesso se tiver search_id
    if (searchId && (apiResponse.status === 200 || apiResponse.status === 202)) {
      console.log("Busca iniciada com sucesso. Search ID:", searchId);
      // Retorna 202 para indicar processo assíncrono ao frontend
      return res.status(202).json({
        search_id: searchId,
        currency_rates: currencyRates,
        message: "Busca de voos iniciada. Use o search_id para verificar os resultados."
      });
    } else {
      console.error(`!!! ERRO: A API Travelpayouts retornou status ${apiResponse.status} mas sem search_id ou status inesperado. Resposta:`, apiResponse.data);
      return res.status(500).json({ error: "Falha ao iniciar a busca. Resposta inesperada da API externa.", apiResponse: apiResponse.data });
    }

  } catch (error) {
    // --- Tratamento de Erro ---
    console.error("!!! ERRO GERAL NO HANDLER /api/flight-search !!!");
    if (error.response) {
        console.error("Erro Axios (Initial Search): Status:", error.response.status, "Data:", error.response.data);
        if (error.response.status === 401 || error.response.status === 403) {
             console.error("!!! ATENÇÃO: Erro 401/403. Verifique se a nova lógica de assinatura está 100% correta ou se as credenciais (Token/Marker) estão válidas.");
        }
        return res.status(error.response.status).json({
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
