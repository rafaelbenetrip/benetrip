// api/flight-redirect.js - Proxy para obter links de redirecionamento para parceiros, agora com suporte a idioma/moeda
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

  // NOVO: Suporte a idioma
  // Obtém do querystring, ou do header Accept-Language, ou padrão pt-BR
  const preferredLanguage = req.query.language || req.headers['accept-language']?.split(',')[0] || 'pt-BR';
  const wantsPtBr = preferredLanguage.toLowerCase().startsWith('pt-br') || preferredLanguage.toLowerCase().startsWith('pt');

  // Validar presença de todos os parâmetros obrigatórios
  if (!search_id || !term_url || !marker) {
    return res.status(400).json({ 
      error: "Parâmetros obrigatórios ausentes", 
      required: ["search_id", "term_url", "marker"],
      provided: { search_id: !!search_id, term_url: !!term_url, marker: !!marker }
    });
  }

  console.log(`[Proxy Redirect] Buscando link para search_id: ${search_id}, term_url: ${term_url}, marker: ${marker}${currency ? `, currency: ${currency}` : ''}${preferredLanguage ? `, language: ${preferredLanguage}` : ''}`);
  
  // Construir a URL da API da Travelpayouts conforme documentação
  let redirectUrl = `https://api.travelpayouts.com/v1/flight_searches/${encodeURIComponent(search_id)}/clicks/${encodeURIComponent(term_url)}.json?marker=${encodeURIComponent(marker)}`;

  // Adiciona currency se fornecida
  if (currency) {
    redirectUrl += `&currency=${encodeURIComponent(currency)}`;
  }

  // Adicionar preferência de idioma (locale)
  redirectUrl += `&locale=${encodeURIComponent(wantsPtBr ? 'pt-BR' : 'en-US')}`;

  // ADICIONAR: Mercado brasileiro explícito
  redirectUrl += `&market=br`;

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
        return true; // aceitamos qualquer status HTTP
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

    // --- NOVO: Verifica e modifica o URL do parceiro se necessário ---
    let urlModified = false;

    // Extrair informações úteis (se existirem)
    const partnerUrl = redirectResponse.data.url;
    const gateName = redirectResponse.data.gate_name || '';
    const gateId = redirectResponse.data.gate_id || '';

    let urlToModify = partnerUrl;

    // Verificar compatibilidade de idioma PT-BR
    if (wantsPtBr) {
      // Indicadores de suporte a PT-BR (na URL do parceiro)
      const ptBrIndicators = [
        '.com.br',
        '/pt-br/',
        '/pt/',
        'portugues',
        'brasil',
        'language=pt',
        'lang=pt',
        'locale=pt'
      ];
      const partnerUrlLc = urlToModify.toLowerCase();
      const hasPtSupport = ptBrIndicators.some(indicator => 
        partnerUrlLc.includes(indicator)
      );
      if (!hasPtSupport) {
        // Tenta adicionar parâmetro lang=pt-BR se não tiver
        const separator = urlToModify.includes('?') ? '&' : '?';
        urlToModify += `${separator}lang=pt-BR`;
        urlModified = true;
        console.log(`[Proxy Redirect] Adicionado parâmetro de idioma pt-BR à URL`);
      }
    }

    // Verifica moeda se foi solicitada
    if (currency) {
      const currencyIndicators = [
        `currency=${currency}`,
        `curr=${currency}`,
        `moeda=${currency}`
      ];
      const hasCurrency = currencyIndicators.some(ind => urlToModify.includes(ind));
      if (!hasCurrency) {
        const separator = urlToModify.includes('?') ? '&' : '?';
        urlToModify += `${separator}currency=${currency}`;
        urlModified = true;
        console.log(`[Proxy Redirect] Adicionada moeda ${currency} à URL`);
      }
    }

    // Atualiza a propriedade url da resposta se foi modificada
    if (urlModified) {
      redirectResponse.data.url = urlToModify;
    }

    // Adicionar cabeçalho de cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Montar resposta JSON incluindo os metadados benetrip_meta
    const finalJson = {
      ...redirectResponse.data,
      _benetrip_info: {
        expires_in: 15 * 60, // 15 minutos
        timestamp: Date.now(),
        currency: currency || 'default'
      },
      _benetrip_meta: {
        language_requested: wantsPtBr ? 'pt-BR' : 'en-US',
        currency_requested: currency || 'default',
        url_modified: urlModified,
        gate_id: gateId,
        gate_name: gateName
      }
    };

    // Log de sucesso (parcial da URL para segurança)
    const urlParcial = redirectResponse.data.url.substring(0, 50) + '...';
    console.log(`[Proxy Redirect] Link final: ${urlParcial}`);
    console.log(`[Proxy Redirect] Método: ${redirectResponse.data.method || 'GET'}`);

    return res.status(200).json(finalJson);

  } catch (error) {
    console.error(`[Proxy Redirect] ERRO AO BUSCAR LINK:`, error.message);
    // Tratar diferentes tipos de erros
    if (error.code === 'ECONNABORTED') {
      // Timeout
      return res.status(504).json({
        error: "Tempo limite excedido ao conectar com a API externa",
        code: "TIMEOUT",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else if (error.response) {
      // A API respondeu com erro
      return res.status(error.response.status || 502).json({
        error: "Erro retornado pela API externa",
        status: error.response.status,
        data: error.response.data,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else if (error.request) {
      // Sem resposta
      return res.status(504).json({
        error: "Sem resposta da API externa",
        code: "NO_RESPONSE",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      // Erro interno
      return res.status(500).json({
        error: "Erro interno na requisição",
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
};
