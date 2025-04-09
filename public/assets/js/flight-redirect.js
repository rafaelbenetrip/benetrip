// api/flight-redirect.js - Proxy para obter links de redirecionamento para parceiros
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

  // Obter parâmetros da query string
  const { search_id, term_url, marker } = req.query;

  if (!search_id || !term_url || !marker) {
    return res.status(400).json({ 
      error: "Parâmetros obrigatórios ausentes", 
      required: ["search_id", "term_url", "marker"] 
    });
  }

  console.log(`[Proxy Redirect] Buscando link para search_id: ${search_id}, term_url: ${term_url}`);
  
  // Construir a URL da API da Travelpayouts
  const redirectUrl = `https://api.travelpayouts.com/v1/flight_searches/${search_id}/clicks/${term_url}.json?marker=${marker}`;

  try {
    // Faz a requisição para a API da Travelpayouts
    const redirectResponse = await axios.get(redirectUrl, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 15000,
      validateStatus: () => true // Aceita qualquer status code
    });

    console.log(`[Proxy Redirect] Resposta da Travelpayouts: Status ${redirectResponse.status}`);

    // Repassa o status code e o corpo da resposta
    res.setHeader('Content-Type', redirectResponse.headers['content-type'] || 'application/json');
    return res.status(redirectResponse.status).send(redirectResponse.data);

  } catch (error) {
    console.error(`!!! [Proxy Redirect] ERRO AO BUSCAR LINK !!!`);
    
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return res.status(504).json({
        error: "Tempo limite excedido ao buscar link da API externa."
      });
    } else if (error.request) {
      console.error(`Erro Axios (Get Redirect): Nenhuma resposta:`, error.message);
      return res.status(504).json({
        error: "Nenhuma resposta da API externa (Gateway Timeout)."
      });
    } else {
      console.error(`Erro interno (Get Redirect):`, error.message);
      return res.status(500).json({
        error: "Erro interno no servidor.",
        details: error.message
      });
    }
  }
};
