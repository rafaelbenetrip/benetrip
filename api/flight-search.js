// api/flight-search.js - Endpoint para busca de voos conforme as especificações da API Travelpayouts
// ATENÇÃO: Utiliza o método de assinatura por ORDENAÇÃO ALFABÉTICA.
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

// ========================================================================
// NOVA FUNÇÃO generateSignature - Método de Ordenação Alfabética
// ========================================================================
function generateSignature(data, token) {
  const values = [];
  // Ordem alfabética das chaves de PRIMEIRO nível:
  const topLevelKeys = ['host', 'locale', 'marker', 'passengers', 'segments', 'trip_class', 'user_ip'].sort();

  topLevelKeys.forEach(key => {
    if (key === 'passengers') {
      // Ordena alfabeticamente as chaves DENTRO de 'passengers'
      const passengerKeys = Object.keys(data.passengers).sort(); // ['adults', 'children', 'infants']
      passengerKeys.forEach(pKey => {
        // Adiciona os VALORES na ordem das chaves ordenadas
        values.push(String(data.passengers[pKey]));
      });
    } else if (key === 'segments') {
      // Processa cada segmento na ordem em que aparecem no array
      data.segments.forEach(segment => {
        // Ordena alfabeticamente as chaves DENTRO de cada 'segment'
        const segmentKeys = Object.keys(segment).sort(); // ['date', 'destination', 'origin']
        segmentKeys.forEach(sKey => {
          // Adiciona os VALORES na ordem das chaves ordenadas
          values.push(segment[sKey]);
        });
      });
    } else {
      // Adiciona o valor das chaves de primeiro nível simples
      values.push(data[key]);
    }
  });

  // Concatena os VALORES coletados (na ordem definida pela ordenação alfabética das chaves) com ":"
  const valuesString = values.join(':');
  // Adiciona o token no início, separado por ":"
  const signatureString = token + ':' + valuesString;

  // --- LOGS DETALHADOS PARA DEBUG ---
  console.log("--- Debug Assinatura (Método Ordenação Alfabética) ---");
  console.log("Token (início):", token ? token.substring(0, 4) + '****' : 'NÃO DEFINIDO');
  console.log("Valores concatenados (na ordem das chaves ordenadas):", valuesString);
  console.log("String completa para assinatura:", signatureString);
  // --- FIM DOS LOGS DETALHADOS ---

  const signatureHash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log("Hash MD5 gerado (Signature - Alfabético):", signatureHash);
  return signatureHash;
}
// ========================================================================
// Fim da NOVA FUNÇÃO generateSignature
// ========================================================================


module.exports = async function handler(req, res) {
  // Configuração dos cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Em produção, considere restringir para seu domínio frontend
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
    console.log("Iniciando busca de voos (Assinatura Alfabética)...");
    const params = req.body;

    // --- Validações ---
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

    const origem = params.origem.toUpperCase();
    const destino = params.destino.toUpperCase();
    if (!isValidIATA(origem) || !isValidIATA(destino)) {
      return res.status(400).json({ error: "Código IATA inválido. Use 3 letras maiúsculas." });
    }
    // --- Fim Validações ---


    // --- Obter variáveis de ambiente ---
    const token = process.env.AVIASALES_TOKEN;
    const marker = process.env.AVIASALES_MARKER;
    // USA O VALOR CORRIGIDO COM WWW
    const hostEnv = process.env.HOST || "www.benetrip.com.br"; // <- Garantir que usa www

    if (!token || !marker) {
      console.error("!!! ERRO CRÍTICO: AVIASALES_TOKEN ou AVIASALES_MARKER não configurados no ambiente do servidor !!!");
      return res.status(500).json({ error: "Configuração interna da API incompleta." });
    }

    // Determina o IP do usuário
    const userIp = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                   req.headers['client-ip'] ||
                   req.connection?.remoteAddress ||
                   req.socket?.remoteAddress ||
                   "127.0.0.1";

    console.log("Usando Token (início):", token.substring(0, 4) + "****");
    console.log("Usando Marker:", marker);
    console.log("Usando Host para assinatura:", hostEnv); // DEVE SER www.benetrip.com.br
    console.log("IP Detectado:", userIp);
    // --- Fim Obter variáveis ---


    // --- Montar objeto da requisição para Travelpayouts ---
    // Certifique-se de que todas as chaves necessárias para a assinatura estejam presentes aqui
    const requestData = {
      marker: marker,
      host: hostEnv, // Usar o host correto com www
      user_ip: userIp,
      locale: "pt", // Pode voltar para 'pt' ou manter 'en' se preferir testar
      trip_class: params.classe ? params.classe.toUpperCase() : "Y",
      passengers: {
        adults: parseInt(params.adultos || 1, 10),
        children: parseInt(params.criancas || 0, 10),
        infants: parseInt(params.bebes || 0, 10)
      },
      segments: []
    };

    // Adicionar segmento de ida
    requestData.segments.push({
      origin: origem,
      destination: destino,
      date: params.dataIda
    });

    // Adicionar segmento de volta, se fornecido
    if (params.dataVolta) {
      requestData.segments.push({
        origin: destino,
        destination: origem,
        date: params.dataVolta
      });
    }
    // --- Fim Montar objeto ---


    // --- Gerar Assinatura (AGORA USANDO O MÉTODO ALFABÉTICO) ---
    const signature = generateSignature(requestData, token);
    requestData.signature = signature; // Adiciona a assinatura gerada ao corpo da requisição
    // --- Fim Gerar Assinatura ---

    console.log("Enviando requisição para Travelpayouts com dados:", JSON.stringify({ ...requestData, signature: signature.substring(0, 5) + '...' }, null, 2));

    // --- Enviar requisição para Travelpayouts ---
    const apiResponse = await axios.post(
      "https://api.travelpayouts.com/v1/flight_search",
      requestData, // Envia o objeto completo com a nova assinatura
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15000
      }
    );
    // --- Fim Enviar requisição ---

    console.log("Resposta inicial da Travelpayouts (Status):", apiResponse.status);
    console.log("Resposta inicial da Travelpayouts (Data):", apiResponse.data);

    const searchId = apiResponse.data.search_id;
    if (!searchId) {
      console.error("!!! ERRO: A API Travelpayouts não retornou search_id. Resposta:", apiResponse.data);
      return res.status(500).json({ error: "Falha ao iniciar a busca. A API externa não retornou um ID.", apiResponse: apiResponse.data });
    }

    // --- Lógica de Polling (sem alterações) ---
    const maxAttempts = 12;
    const intervalMs = 3500;
    let attempts = 0;
    let resultados = null;
    let pollingComplete = false;

    while (attempts < maxAttempts && !pollingComplete) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      console.log(`Polling resultados: tentativa ${attempts}/${maxAttempts} para search_id: ${searchId}`);

      try {
        const resultsResponse = await axios.get(
          `https://api.travelpayouts.com/v1/flight_search_results?uuid=${searchId}`,
          { timeout: 10000 }
        );

         if (resultsResponse.data?.search_completed || (resultsResponse.data?.proposals && resultsResponse.data.proposals.length > 0)) {
           console.log(`Resultados recebidos ou busca concluída na tentativa ${attempts}.`);
           resultados = resultsResponse.data;
           pollingComplete = true;
         } else {
           console.log(`Busca ainda em andamento (tentativa ${attempts})...`);
         }

      } catch (pollError) {
        console.error(`Erro durante o polling (tentativa ${attempts}):`, pollError.message);
        if (pollError.response) {
            console.error("Polling Error Status:", pollError.response.status);
            console.error("Polling Error Data:", pollError.response.data);
            if (pollError.response.status === 404) {
                console.warn("Search ID não encontrado no polling. Parando.");
                pollingComplete = true;
            }
        }
      }
    } // Fim do While

    if (!pollingComplete && attempts >= maxAttempts) {
        console.log("Polling atingiu o número máximo de tentativas sem conclusão. Retornando search_id.");
         return res.status(202).json({ // Accepted
           success: true,
           status: 'pending',
           search_id: searchId,
           message: "A busca de voos demorou mais que o esperado e ainda está em andamento. Use o search_id para verificar os resultados mais tarde.",
           attempts: attempts
         });
    }

    if (resultados && resultados.proposals && resultados.proposals.length > 0) {
       console.log("Retornando resultados encontrados.");
        return res.status(200).json({ // OK
          success: true,
          status: 'completed',
          search_id: searchId,
          resultados: resultados,
          attempts: attempts
        });
    } else {
        console.log("Busca concluída, mas sem propostas/voos encontrados.");
        return res.status(200).json({ // OK, mas sem resultados
            success: true,
            status: 'completed_empty',
            search_id: searchId,
            message: "Busca concluída, mas nenhum voo encontrado para os critérios fornecidos.",
            resultados: resultados,
            attempts: attempts
        });
    }
    // --- Fim Lógica de Polling ---

  } catch (error) {
    console.error("!!! ERRO GERAL NO HANDLER flight-search !!!");
    // Log mais detalhado do erro
    if (error.response) {
      // Erro da requisição Axios (provavelmente da Travelpayouts)
      console.error("Erro Axios:", {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data,
        config_url: error.config?.url,
        config_method: error.config?.method,
      });
      // Retorna o erro específico da API externa para o cliente
      return res.status(error.response.status).json({
          error: "Erro ao comunicar com a API externa.",
          details: error.response.data
      });
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta
      console.error("Erro Axios: Nenhuma resposta recebida:", error.request);
      return res.status(504).json({ error: "Nenhuma resposta da API externa (Gateway Timeout)." });
    } else {
      // Erro na configuração da requisição ou outro erro interno
      console.error("Erro interno:", error.message);
      console.error(error.stack);
      return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
    }
  }
};
