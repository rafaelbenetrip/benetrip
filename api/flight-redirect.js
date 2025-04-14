// api/flight-redirect.js - Proxy para obter links de redirecionamento para parceiros, com modificação automática de idioma/moeda
const axios = require('axios');

// --- ETAPA 1: Função de modificação automática de parâmetros ---
/**
 * Aplica modificações à URL do parceiro de forma automática
 * @param {string} url - URL original
 * @param {string} currency - Moeda desejada
 * @param {string} language - Idioma desejado (pt-BR)
 * @returns {Object} - URL modificada e informações
 */
function applySmartParameterChanges(url, currency, language) {
  if (!url) return { url, modified: false };
  
  const urlLower = url.toLowerCase();
  let modifiedUrl = url;
  let modified = false;
  
  // 1. EXTRAIR DOMÍNIO PARA DIAGNÓSTICO
  const domainMatch = urlLower.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
  const domain = domainMatch ? domainMatch[1] : 'unknown';
  
  // 2. DETECTAR PADRÕES DE PARÂMETROS DE URL
  const hasQueryString = url.includes('?');
  
  // Parsing de URL seguro
  let urlObj;
  try {
    urlObj = new URL(url.startsWith('http') ? url : 'https://example.com' + url);
  } catch (e) {
    console.warn('[Proxy Redirect] Erro ao analisar URL:', e.message);
    // Continuar com abordagem baseada em string
    urlObj = { searchParams: new Map() };
  }
  
  // 3. COLETAR TODOS OS PARÂMETROS EXISTENTES RELACIONADOS A MOEDA E IDIOMA
  const currencyParams = [];
  const languageParams = [];
  
  // Identificar parâmetros existentes relacionados a moeda e idioma
  try {
    for (const [key, value] of urlObj.searchParams.entries()) {
      // Parâmetros de moeda comuns
      if (key.match(/curr(ency)?|moeda|val(uta)?|devise/i)) {
        currencyParams.push({ key, value });
      }
      
      // Parâmetros de idioma comuns
      if (key.match(/lang(uage)?|locale|idioma|lng/i)) {
        languageParams.push({ key, value });
      }
    }
  } catch (e) {
    console.warn('[Proxy Redirect] Erro ao analisar parâmetros:', e.message);
  }
  
  // 4. APLICAR MODIFICAÇÕES BASEADAS EM PADRÕES DETECTADOS
  
  // A. Modificar moeda se necessária
  if (currency) {
    // Se encontramos parâmetros de moeda, modificamos todos eles
    if (currencyParams.length > 0) {
      currencyParams.forEach(param => {
        const regex = new RegExp(`${param.key}=${param.value}`, 'g');
        modifiedUrl = modifiedUrl.replace(regex, `${param.key}=${currency}`);
      });
      modified = true;
    } else {
      // Tentativa de detecção de padrões especiais
      
      // 1. URL codificada: currency%3AUSD
      const encodedPattern = /currency%3A([A-Z]{3})/gi;
      if (modifiedUrl.match(encodedPattern)) {
        modifiedUrl = modifiedUrl.replace(encodedPattern, `currency%3A${currency}`);
        modified = true;
      }
      
      // 2. Outros formatos comuns de moeda
      const currencyPattern = /([?&](cur|curr|currency|money|moeda)=)([A-Z]{3})/gi;
      if (modifiedUrl.match(currencyPattern)) {
        modifiedUrl = modifiedUrl.replace(currencyPattern, `$1${currency}`);
        modified = true;
      }
      
      // 3. Formato especial Trip.com
      if (domain.includes('trip.com')) {
        if (modifiedUrl.includes('curr=')) {
          modifiedUrl = modifiedUrl.replace(/curr=([A-Z]{3})/gi, `curr=${currency}`);
          modified = true;
        }
      }
      
      // 4. Se nenhum padrão for encontrado, adicionar como parâmetro normal
      if (!modified) {
        const separator = hasQueryString ? '&' : '?';
        modifiedUrl = `${modifiedUrl}${separator}currency=${currency}`;
        modified = true;
      }
    }
  }
  
  // B. Modificar idioma
  if (language) {
    const langCode = language.startsWith('pt') ? 'pt-BR' : language;
    const shortLangCode = langCode.split('-')[0]; // pt, en, etc.
    
    // Se encontramos parâmetros de idioma, modificamos todos eles
    if (languageParams.length > 0) {
      languageParams.forEach(param => {
        // Decide qual formato de idioma usar com base no valor existente
        let newValue = langCode;
        
        // Se o valor existente tiver apenas 2 caracteres, use o código curto
        if (param.value.length <= 2) {
          newValue = shortLangCode;
        }
        
        const regex = new RegExp(`${param.key}=${param.value}`, 'g');
        modifiedUrl = modifiedUrl.replace(regex, `${param.key}=${newValue}`);
      });
      modified = true;
    } else {
      // Tentar detecção de padrões especiais de idioma
      
      // 1. Idioma em formato URL-encoded: locale%3Apt-PT
      const encodedLocalePattern = /locale%3A([a-z]{2}(-[A-Z]{2})?)/gi;
      if (modifiedUrl.match(encodedLocalePattern)) {
        modifiedUrl = modifiedUrl.replace(encodedLocalePattern, `locale%3A${langCode}`);
        modified = true;
      }
      
      // 2. Padrões comuns de idioma
      const langPattern = /([?&](locale|lang|language|idioma)=)([a-z]{2}(-[A-Z]{2})?)/gi;
      if (modifiedUrl.match(langPattern)) {
        modifiedUrl = modifiedUrl.replace(langPattern, `$1${langCode}`);
        modified = true;
      }
      
      // 3. Caso especial Trip.com
      if (domain.includes('trip.com')) {
        if (modifiedUrl.includes('locale=pt-PT')) {
          modifiedUrl = modifiedUrl.replace(/locale=pt-PT/g, `locale=pt-BR`);
          modified = true;
        }
      }
      
      // 4. Se nenhum padrão for encontrado, adicionar como parâmetro padrão
      if (!modified && language.startsWith('pt')) {
        const separator = hasQueryString ? '&' : '?';
        modifiedUrl = `${modifiedUrl}${separator}lang=${langCode}`;
        modified = true;
      }
    }
  }
  
  return {
    url: modifiedUrl,
    modified,
    domain,
    currencyParamsFound: currencyParams.length,
    languageParamsFound: languageParams.length
  };
}

// --- Início do handler principal ---
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

  // Suporte a idioma
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
  
  // Construir a URL da API da Travelpayouts
  let redirectUrl = `https://api.travelpayouts.com/v1/flight_searches/${encodeURIComponent(search_id)}/clicks/${encodeURIComponent(term_url)}.json?marker=${encodeURIComponent(marker)}`;
  if (currency) redirectUrl += `&currency=${encodeURIComponent(currency)}`;
  redirectUrl += `&locale=${encodeURIComponent(wantsPtBr ? 'pt-BR' : 'en-US')}`;

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

    // --- ETAPA 2: NOVO sistema automatizado de modificação de URL ---
    let urlModified = false;
    let partnerDomain = 'unknown';

    // Extrair informações úteis
    const partnerUrl = redirectResponse.data.url;
    const gateName = redirectResponse.data.gate_name || '';
    const gateId = redirectResponse.data.gate_id || '';

    // NOVO: Aplicar modificações automáticas
    if (partnerUrl) {
      const languageToUse = wantsPtBr ? 'pt-BR' : preferredLanguage || 'en-US';
      console.log(`[Proxy Redirect] Aplicando modificações automáticas para idioma ${languageToUse} e moeda ${currency || 'N/A'}`);
      
      const { 
        url: modifiedUrl, 
        modified,
        domain,
        currencyParamsFound,
        languageParamsFound
      } = applySmartParameterChanges(partnerUrl, currency, languageToUse);
      
      if (modified) {
        redirectResponse.data.url = modifiedUrl;
        console.log(`[Proxy Redirect] URL modificada automaticamente. Domínio: ${domain}`);
        console.log(`[Proxy Redirect] Parâmetros encontrados - Moeda: ${currencyParamsFound}, Idioma: ${languageParamsFound}`);
        urlModified = true;
        partnerDomain = domain;
      }
    }

    // Adicionar cabeçalho de cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // --- ETAPA 3: Atualizar resposta com novos metadados ---
    const finalJson = {
      ...redirectResponse.data,
      _benetrip_info: {
        expires_in: 15 * 60, // 15 minutos
        timestamp: Date.now(),
        currency: currency || 'default'
      },
      _benetrip_meta: {
        language_requested: wantsPtBr ? 'pt-BR' : preferredLanguage,
        currency_requested: currency || 'default',
        url_modified: urlModified,
        gate_id: gateId,
        gate_name: gateName,
        partner_domain: partnerDomain
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
