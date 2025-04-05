// api/flight-results.js - VERIFICA o status/resultado de uma busca existente
const axios = require('axios');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Restrinja em produção
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS'); // Apenas GET
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Obter search_id/uuid da query string (ex: /api/flight-results?uuid=...)
  const { uuid } = req.query;

  if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
      return res.status(400).json({ error: "Parâmetro 'uuid' (search_id) é obrigatório e deve ser válido." });
  }

  console.log(`Verificando resultados para search_id (uuid): ${uuid}`);
  const resultsUrl = `https://api.travelpayouts.com/v1/flight_search_results?uuid=${uuid}`;

  try {
    const resultsResponse = await axios.get(resultsUrl, {
      timeout: 15000 // Timeout para a chamada de resultados (ajuste se necessário)
      // Não precisa de autenticação (token/assinatura) para este endpoint
    });

    console.log(`Resultados obtidos para ${uuid} - Status Travelpayouts: ${resultsResponse.status}`);
    // Retorna diretamente a resposta da API Travelpayouts para o frontend
    // O frontend decidirá o que fazer com base nos dados (ex: proposals, search_completed)
    return res.status(200).json(resultsResponse.data);

  } catch (error) {
    console.error(`!!! ERRO AO BUSCAR RESULTADOS para ${uuid} !!!`);
    if (error.response) {
      // Erro retornado pela API da Travelpayouts (ex: 404 Not Found se UUID inválido/expirado)
      console.error("Erro Axios (Get Results): Status:", error.response.status, "Data:", error.response.data);
      return res.status(error.response.status).json({ // Retorna o erro exato da API
        error: `Erro ${error.response.status} ao obter resultados da API externa.`,
        details: error.response.data
      });
    } else if (error.request) {
      // Timeout ou problema de rede ao tentar conectar à API de resultados
      console.error(`Erro Axios (Get Results) para ${uuid}: Nenhuma resposta recebida:`, error.message);
      return res.status(504).json({ error: "Nenhuma resposta da API externa ao buscar resultados (Gateway Timeout)." });
    } else {
      // Erro interno antes de fazer a chamada
      console.error(`Erro interno (Get Results) para ${uuid}:`, error.message);
      return res.status(500).json({ error: "Erro interno no servidor ao buscar resultados.", details: error.message });
    }
  }
};
