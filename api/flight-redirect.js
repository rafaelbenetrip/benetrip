// api/flight-redirect.js - Proxy para obter links de redirecionamento para parceiros
const axios = require('axios');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Responder para requisições OPTIONS (pre-flight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar se o método é GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: "Método não permitido", 
      message: "Esta API aceita apenas requisições GET"
    });
  }

  // Obter parâmetros obrigatórios da query string
  const { search_id, term_url, marker } = req.query;
  
  // Obter parâmetro opcional de moeda
  const currency = req.query.currency;

  // Validar presença de todos os parâmetros obrigatórios
  if (!search_id || !term_url || !marker) {
    return res.status(400).json({ 
      error: "Parâmetros obrigatórios ausentes", 
      required: ["search_id", "term_url", "marker"],
      provided: { search_id: !!search_id, term_url: !!term_url, marker: !!marker }
    });
  }

  console.log(`[Proxy Redirect] Buscando link para search_id: ${search_id}, term_url: ${term_url}, marker: ${marker}${currency ? `, currency: ${currency}` : ''}`);
  
  // Construir a URL da API da Travelpayouts - FORMATO EXATO CONFORME DOCUMENTAÇÃO
  // Adiciona o parâmetro currency à URL se ele estiver presente
  let redirectUrl = `https://api.travelpayouts.com/v1/flight_searches/${search_id}/clicks/${term_url}.json?marker=${marker}`;
  
  // Adicionamos o parâmetro currency se fornecido
  if (currency) {
    redirectUrl += `&currency=${currency}`;
  }
  
  console.log(`[Proxy Redirect] URL construída: ${redirectUrl}`);

  try {
    // Faz a requisição para a API da Travelpayouts
    console.log(`[Proxy Redirect] Enviando requisição para Travelpayouts...`);
    const redirectResponse = await axios.get(redirectUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Benetrip/1.0'
      },
      timeout: 10000,
      validateStatus: function (status) {
        // Aceita qualquer status HTTP para tratar de forma personalizada abaixo
        return true;
      }
    });

    // Log do status da resposta
    console.log(`[Proxy Redirect] Resposta recebida com status ${redirectResponse.status}`);

    // Verificar status HTTP
    if (redirectResponse.status !== 200) {
      console.error(`[Proxy Redirect] API retornou status ${redirectResponse.status}:`, 
        typeof redirectResponse.data === 'object' ? JSON.stringify(redirectResponse.data) : redirectResponse.data);
      
      return res.status(redirectResponse.status).json({
        error: `API externa retornou status ${redirectResponse.status}`,
        details: redirectResponse.data,
        timestamp: new Date().toISOString()
      });
    }

    // Validar conteúdo da resposta
    if (!redirectResponse.data || !redirectResponse.data.url) {
      console.error('[Proxy Redirect] Resposta inválida da API:', 
        typeof redirectResponse.data === 'object' ? JSON.stringify(redirectResponse.data) : redirectResponse.data);
      
      return res.status(502).json({
        error: "Resposta inválida da API externa",
        message: "A resposta não contém o campo 'url' obrigatório",
        data: redirectResponse.data,
        timestamp: new Date().toISOString()
      });
    }

    // Log de sucesso com parte da URL (para segurança, não logar URL completa)
    const urlParcial = redirectResponse.data.url.substring(0, 50) + '...';
    console.log(`[Proxy Redirect] Link obtido com sucesso: ${urlParcial}`);
    console.log(`[Proxy Redirect] Método: ${redirectResponse.data.method || 'GET'}`);
    
    // Adicionar cabeçalho de cache para garantir que o link não seja armazenado em cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Caso a moeda tenha sido especificada mas não esteja no URL, vamos tentar adicioná-la
    // Esta parte é necessária porque alguns parceiros aceitam a moeda como parâmetro na URL
    if (currency && redirectResponse.data.url && !redirectResponse.data.url.includes('currency=')) {
      // Verifica se a URL já tem parâmetros
      const separator = redirectResponse.data.url.includes('?') ? '&' : '?';
      redirectResponse.data.url += `${separator}currency=${currency}`;
      
      console.log(`[Proxy Redirect] Adicionada moeda ${currency} à URL de redirecionamento`);
    }
    
    // Repassar a resposta da API
    return res.status(200).json({
      ...redirectResponse.data,
      _benetrip_info: {
        expires_in: 15 * 60, // 15 minutos em segundos
        timestamp: Date.now(),
        currency: currency || 'default'
      }
    });

  } catch (error) {
    console.error(`[Proxy Redirect] ERRO AO BUSCAR LINK:`, error.message);
    
    // Tratar diferentes tipos de erros
    if (error.code === 'ECONNABORTED') {
      // Erro de timeout
      return res.status(504).json({
        error: "Tempo limite excedido ao conectar com a API externa",
        code: "TIMEOUT",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else if (error.response) {
      // A API respondeu com um status de erro
      return res.status(error.response.status || 502).json({
        error: "Erro retornado pela API externa",
        status: error.response.status,
        data: error.response.data,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta
      return res.status(504).json({
        error: "Sem resposta da API externa",
        code: "NO_RESPONSE",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      // Erro na preparação da requisição
      return res.status(500).json({
        error: "Erro interno na requisição",
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
};
