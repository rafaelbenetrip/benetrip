// api/flight-results.js - Consulta resultados de busca de voos
const axios = require('axios');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    return res.status(400).json({ 
      error: "Parâmetro 'uuid' (search_id) é obrigatório." 
    });
  }

  console.log(`Verificando resultados para search_id: ${uuid}`);
  const resultsUrl = `https://api.travelpayouts.com/v1/flight_search_results?uuid=${uuid}`;

  try {
    // Fazer consulta exatamente conforme o exemplo da documentação
    console.log(`Consultando resultados em ${resultsUrl}`);
    
    const resultsResponse = await axios.get(resultsUrl, {
      headers: { 
        'Accept-Encoding': 'gzip,deflate,sdch' 
      },
      // Usamos o parâmetro "decompress" para tratar a resposta comprimida
      decompress: true,
      timeout: 30000 // 30 segundos
    });

    console.log(`Resultados obtidos. Status: ${resultsResponse.status}`);
    
    // Verificar se a busca está completa ou ainda em andamento
    const data = resultsResponse.data;
    
    // Busca ainda em andamento: Array com um único elemento contendo apenas search_id
    if (Array.isArray(data) && data.length === 1 && 
        Object.keys(data[0]).length === 1 && data[0].search_id === uuid) {
      console.log("Busca ainda em andamento. Apenas search_id recebido");
      
      return res.status(202).json({
        search_completed: false,
        search_id: uuid,
        message: "Busca em andamento. Tente novamente em alguns segundos."
      });
    }
    
    // Busca completa com resultados (ou sem resultados, mas completada)
    if (Array.isArray(data) && data.length > 0) {
      // Verificar se há propostas de voos
      const hasProposals = data[0].proposals && 
                          Array.isArray(data[0].proposals) && 
                          data[0].proposals.length > 0;
      
      console.log(`Busca completa. Propostas encontradas: ${hasProposals ? data[0].proposals.length : 0}`);
      
      // Retornar os dados conforme recebidos da API, adicionando apenas metadados úteis
      return res.status(200).json({
        search_completed: true,
        search_id: uuid,
        has_results: hasProposals,
        data: data // Retorna a resposta completa da API para preservar toda a estrutura
      });
    }
    
    // Fallback para resposta em formato inesperado
    console.warn("Formato de resposta inesperado:", typeof data, data);
    return res.status(200).json({
      search_completed: true,
      search_id: uuid,
      has_results: false,
      original_response: data,
      message: "Formato de resposta não esperado da API de voos"
    });

  } catch (error) {
    console.error(`!!! ERRO AO BUSCAR RESULTADOS para ${uuid} !!!`);
    
    // Tratamento específico para timeout
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.error(`Timeout ao consultar resultados: ${error.message}`);
      return res.status(504).json({ 
        error: "Tempo limite excedido ao buscar resultados.",
        search_id: uuid
      });
    }
    
    if (error.response) {
      // Erro com resposta da API
      console.error("Erro ao consultar API:", error.response.status, error.response.data);
      
      // Tratamento especial para 404
      if (error.response.status === 404) {
        return res.status(404).json({
          error: "ID de busca não encontrado ou expirado. Inicie uma nova busca.",
          search_id: uuid
        });
      }
      
      return res.status(error.response.status).json({
        error: `Erro ${error.response.status} da API externa.`,
        details: error.response.data,
        search_id: uuid
      });
    } else if (error.request) {
      // Erro sem resposta (timeout, rede)
      console.error(`Erro de rede: ${error.message}`);
      return res.status(504).json({ 
        error: "Sem resposta da API externa (Gateway Timeout).",
        search_id: uuid
      });
    } else {
      // Outros erros
      console.error(`Erro interno: ${error.message}`);
      return res.status(500).json({ 
        error: "Erro interno no servidor.", 
        details: error.message,
        search_id: uuid
      });
    }
  }
};
