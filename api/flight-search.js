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

// Função para gerar a assinatura com ordem fixa e logs detalhados
function generateSignature(data, token) {
  // Ordem fixa conforme documentação Travelpayouts:
  // token:marker:host:user_ip:locale:trip_class:
  // passengers.adults:passengers.children:passengers.infants:
  // para cada segmento: origin:destination:date
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

  // --- LOGS DETALHADOS PARA DEBUG ---
  console.log("--- Debug Assinatura ---");
  console.log("Token (início):", token ? token.substring(0, 4) + '****' : 'NÃO DEFINIDO');
  console.log("Marker:", data.marker);
  console.log("Host:", data.host);
  console.log("User IP:", data.user_ip);
  console.log("Locale:", data.locale);
  console.log("Trip Class:", data.trip_class);
  console.log("Passengers:", JSON.stringify(data.passengers));
  console.log("Segments:", JSON.stringify(data.segments));
  console.log("String completa para assinatura:", signatureString); // Log completo! Cuidado se o token for muito sensível.
  // --- FIM DOS LOGS DETALHADOS ---

  const signatureHash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log("Hash MD5 gerado (Signature):", signatureHash);
  return signatureHash;
}


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
    console.log("Iniciando busca de voos...");
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
    // Tenta obter o host da requisição ou da variável de ambiente, com fallback
    const requestHost = req.headers.host;
    const hostEnv = process.env.HOST || "benetrip.com.br"; // Use o seu domínio principal aqui como fallback seguro

    if (!token || !marker) {
      console.error("!!! ERRO CRÍTICO: AVIASALES_TOKEN ou AVIASALES_MARKER não configurados no ambiente do servidor !!!");
      return res.status(500).json({ error: "Configuração interna da API incompleta." });
    }

    // Determina o IP do usuário
    const userIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || // Pega o primeiro IP se houver múltiplos
                   req.headers['client-ip'] ||
                   req.connection?.remoteAddress || // Use optional chaining
                   req.socket?.remoteAddress || // Fallback adicional
                   "127.0.0.1"; // Último recurso

    console.log("Usando Token (início):", token.substring(0, 4) + "****");
    console.log("Usando Marker:", marker);
    console.log("Usando Host para assinatura:", hostEnv); // O host usado na assinatura
    console.log("IP Detectado:", userIp);
    // --- Fim Obter variáveis ---


    // --- Montar objeto da requisição para Travelpayouts ---
    const requestData = {
      marker: marker,
      host: hostEnv, // Usar o host definido acima
      user_ip: userIp,
      locale: "en", // Alterado para 'pt', ajuste se necessário
      trip_class: params.classe ? params.classe.toUpperCase() : "Y",
      passengers: {
        adults: parseInt(params.adultos || 1, 10), // Garantir que são números inteiros
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
        origin: destino, // Origem é o destino da ida
        destination: origem, // Destino é a origem da ida
        date: params.dataVolta
      });
    }
    // --- Fim Montar objeto ---


    // --- Gerar Assinatura ---
    // A função generateSignature agora contém logs detalhados
    const signature = generateSignature(requestData, token);
    requestData.signature = signature;
    // --- Fim Gerar Assinatura ---

    console.log("Enviando requisição para Travelpayouts com dados:", JSON.stringify({ ...requestData, signature: signature.substring(0, 5) + '...' }, null, 2)); // Não logar assinatura completa aqui

    // --- Enviar requisição para Travelpayouts ---
    const apiResponse = await axios.post(
      "https://api.travelpayouts.com/v1/flight_search",
      requestData,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15000 // Aumentado para 15 segundos
      }
    );
    // --- Fim Enviar requisição ---

    console.log("Resposta inicial da Travelpayouts (Status):", apiResponse.status);
    console.log("Resposta inicial da Travelpayouts (Data):", apiResponse.data); // Log da resposta

    const searchId = apiResponse.data.search_id;
    if (!searchId) {
      console.error("!!! ERRO: A API Travelpayouts não retornou search_id. Resposta:", apiResponse.data);
      return res.status(500).json({ error: "Falha ao iniciar a busca. A API externa não retornou um ID.", apiResponse: apiResponse.data });
    }

    // --- Lógica de Polling ---
    const maxAttempts = 12;   // Aumentado
    const intervalMs = 3500;  // Aumentado
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
          { timeout: 10000 } // Timeout para cada tentativa de polling
        );

        // Verifica se a busca foi concluída (mesmo que sem resultados) ou se há propostas
         if (resultsResponse.data?.search_completed || (resultsResponse.data?.proposals && resultsResponse.data.proposals.length > 0)) {
           console.log(`Resultados recebidos ou busca concluída na tentativa ${attempts}.`);
           resultados = resultsResponse.data; // Armazena os dados (pode ter proposals ou não)
           pollingComplete = true; // Marca como completo para sair do loop
         } else {
           console.log(`Busca ainda em andamento (tentativa ${attempts})...`);
         }

      } catch (pollError) {
        console.error(`Erro durante o polling (tentativa ${attempts}):`, pollError.message);
        // Decide se quer parar o polling em caso de erro ou continuar tentando
        if (pollError.response) {
            console.error("Polling Error Status:", pollError.response.status);
            console.error("Polling Error Data:", pollError.response.data);
            // Se for um erro como 404 (search not found), pode parar
            if (pollError.response.status === 404) {
                console.warn("Search ID não encontrado no polling. Parando.");
                pollingComplete = true; // Para o loop
                // Considerar retornar erro aqui ou apenas o status 202 abaixo
            }
        }
        // Continua tentando nas próximas iterações a menos que seja um erro fatal
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
          resultados: resultados, // Contém proposals, gates, airlines, etc.
          attempts: attempts
        });
    } else {
        console.log("Busca concluída, mas sem propostas/voos encontrados.");
        return res.status(200).json({ // OK, mas sem resultados
            success: true,
            status: 'completed_empty',
            search_id: searchId,
            message: "Busca concluída, mas nenhum voo encontrado para os critérios fornecidos.",
            resultados: resultados, // Pode conter informações úteis mesmo sem proposals
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
        config_url: error.config?.url, // Loga a URL que falhou
        config_method: error.config?.method,
      });
      // Retorna o erro específico da API externa para o cliente
      return res.status(error.response.status).json({
          error: "Erro ao comunicar com a API externa.",
          details: error.response.data // Envia detalhes do erro da API externa
      });
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta
      console.error("Erro Axios: Nenhuma resposta recebida:", error.request);
      return res.status(504).json({ error: "Nenhuma resposta da API externa (Gateway Timeout)." });
    } else {
      // Erro na configuração da requisição ou outro erro interno
      console.error("Erro interno:", error.message);
      console.error(error.stack); // Log do stack trace
      return res.status(500).json({ error: "Erro interno no servidor.", details: error.message });
    }
  }
};
