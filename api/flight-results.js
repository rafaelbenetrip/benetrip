// api/flight-results.js - Atua como Proxy para buscar chunks de resultados
// Versão simplificada para lidar com respostas em chunks (Ponto 2 - Backend)
const axios = require('axios');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Restrinja em produção
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Obter search_id/uuid da query string
  const { uuid } = req.query;

  if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
    return res.status(400).json({ error: "Parâmetro 'uuid' (search_id) é obrigatório e deve ser válido." });
  }

  console.log(`[Proxy Results] Buscando chunk para search_id (uuid): ${uuid}`);
  const resultsUrl = `https://api.travelpayouts.com/v1/flight_search_results?uuid=${uuid}`;

  try {
    // Faz a requisição para a API da Travelpayouts
    const resultsResponse = await axios.get(resultsUrl, {
      headers: {
          'Accept-Encoding': 'gzip, deflate, br', // Headers comuns de accept-encoding
          'Accept': 'application/json' // Indica que aceitamos JSON
        },
      timeout: 45000, // Timeout para a requisição externa
      // Importante: Não valida o status aqui, pois queremos repassar a resposta mesmo se for 200 com erro interno da API deles
      validateStatus: () => true // Aceita qualquer status code da API externa
    });

    console.log(`[Proxy Results] Resposta da Travelpayouts para ${uuid} - Status: ${resultsResponse.status}`);

    // Repassa o status code e o corpo da resposta (o chunk) para o frontend
    // Define o Content-Type correto na resposta para o frontend
    res.setHeader('Content-Type', resultsResponse.headers['content-type'] || 'application/json');
    return res.status(resultsResponse.status).send(resultsResponse.data);

  } catch (error) {
    // Trata erros na *comunicação* com a API da Travelpayouts (timeout, rede, etc.)
    // Erros de status code (4xx, 5xx) da API externa serão tratados pelo bloco try/axios acima devido ao validateStatus
    console.error(`!!! [Proxy Results] ERRO AO BUSCAR CHUNK para ${uuid} !!!`);

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.error(`Timeout ao buscar chunk para ${uuid}:`, error.message);
      // Retorna 504 Gateway Timeout para o frontend
      return res.status(504).json({
        error: "Tempo limite excedido ao buscar resultados da API externa.",
        search_id: uuid
      });
    } else if (error.request) {
      // Erro sem resposta (problema de rede?)
      console.error(`Erro Axios (Get Chunk) para ${uuid}: Nenhuma resposta recebida:`, error.message);
      return res.status(504).json({
        error: "Nenhuma resposta da API externa ao buscar resultados (Gateway Timeout).",
        search_id: uuid
      });
    } else {
      // Outros erros internos (configuração do axios, etc.)
      console.error(`Erro interno (Get Chunk) para ${uuid}:`, error.message);
      return res.status(500).json({
        error: "Erro interno no servidor ao buscar resultados.",
        details: error.message,
        search_id: uuid
      });
    }
  }
};
