// api/flight-redirect.js
const axios = require('axios');

/**
 * Aplica modificações à URL do parceiro de forma automática (case-sensitive e regras de domínios)
 * @param {string} url - URL original
 * @param {string} currency - Moeda desejada
 * @param {string} language - Idioma desejado (pt-BR)
 * @returns {Object} - URL modificada e informações
 */
function applySmartParameterChanges(url, currency, language) {
  if (!url) return { url, modified: false };
  
  let modifiedUrl = url;
  let modified = false;

  // 1. EXTRAIR DOMÍNIO PARA DIAGNÓSTICO
  const domainMatch = url.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
  const domain = domainMatch ? domainMatch[1] : 'unknown';

  // 2. Verificações específicas para domínios conhecidos
  if (domain.includes('ubfly.br.com')) {
    console.log('[Proxy Redirect] Detectado ubfly.br.com, aplicando regras específicas');
    // Se a URL já contém Currency=USD, substituir por BRL
    if (modifiedUrl.includes('Currency=USD') && currency === 'BRL') {
      modifiedUrl = modifiedUrl.replace('Currency=USD', 'Currency=BRL');
      modified = true;
    }
    // Se a URL contém Locale=EN, substituir por PT
    if (modifiedUrl.includes('Locale=EN') && language && language.toLowerCase().startsWith('pt')) {
      modifiedUrl = modifiedUrl.replace('Locale=EN', 'Locale=PT');
      modified = true;
    }
    if (modified) {
      return {
        url: modifiedUrl,
        modified: true,
        domain,
        specificRulesApplied: true
      };
    }
  }

  // 2b. Detectar se já há querystring
  const hasQueryString = url.includes('?');
  
  // 3. APLICAR MODIFICAÇÕES BASEADAS EM PADRÕES DETECTADOS
  // A. Modificar moeda se necessária (considerar case-sensitivity)
  if (currency) {
    // Padrões para parâmetros de moeda (com case insensitive + modos uppercase)
    const currencyPatterns = [
      /([?&]currency=)([A-Z]{3})/gi,
      /([?&]curr=)([A-Z]{3})/gi,
      /([?&]cur=)([A-Z]{3})/gi,
      /([?&]Currency=)([A-Z]{3})/g,
      /([?&]Curr=)([A-Z]{3})/g,
      /currency%3A([A-Z]{3})/gi,
      /([?&]moeda=)([A-Z]{3})/gi
    ];
    
    let currencyModified = false;
    currencyPatterns.forEach(pattern => {
      if (modifiedUrl.match(pattern)) {
        modifiedUrl = modifiedUrl.replace(pattern, function(match, p1) {
          currencyModified = true;
          return p1 + currency;
        });
      }
    });

    // Se nenhum padrão foi encontrado, adicionar o parâmetro no formato predominante
    if (!currencyModified) {
      const separator = hasQueryString ? '&' : '?';
      if (modifiedUrl.includes('Currency=')) {
        modifiedUrl = `${modifiedUrl}${separator}Currency=${currency}`;
      } else {
        modifiedUrl = `${modifiedUrl}${separator}currency=${currency}`;
      }
      modified = true;
    } else {
      modified = true;
    }
  }
  
  // B. Modificar idioma (considerar case-sensitivity)
  if (language) {
    const langCode = language.startsWith('pt') ? 'pt-BR' : language;
    const shortLangCode = langCode.split('-')[0];
    const languagePatterns = [
      /([?&]locale=)([a-z]{2}(-[A-Z]{2})?)/gi,
      /([?&]lang(uage)?=)([a-z]{2}(-[A-Z]{2})?)/gi, 
      /([?&]idioma=)([a-z]{2}(-[A-Z]{2})?)/gi,
      /([?&]Locale=)([a-z]{2}(-[A-Z]{2})?)/g,
      /([?&]Lang(uage)?=)([a-z]{2}(-[A-Z]{2})?)/g,
      /locale%3A([a-z]{2}(-[A-Z]{2})?)/gi
    ];
    
    let langModified = false;
    languagePatterns.forEach(pattern => {
      if (modifiedUrl.match(pattern)) {
        // Inferir formato curto ou completo
        const isShortFormat = pattern.toString().includes('([a-z]{2})');
        const langValue = isShortFormat ? shortLangCode : langCode;
        modifiedUrl = modifiedUrl.replace(pattern, function(match, p1) {
          langModified = true;
          return p1 + langValue;
        });
      }
    });

    // CASO ESPECIAL: ubfly.br.com usa Locale=EN → Locale=PT
    if (domain.includes('ubfly.br.com') && modifiedUrl.includes('Locale=EN')) {
      modifiedUrl = modifiedUrl.replace('Locale=EN', 'Locale=PT');
      langModified = true;
    }

    if (!langModified && language.startsWith('pt')) {
      const separator = hasQueryString ? '&' : '?';
      if (modifiedUrl.includes('Locale=') || modifiedUrl.includes('Language=')) {
        modifiedUrl = `${modifiedUrl}${separator}Locale=PT`;
      } else {
        modifiedUrl = `${modifiedUrl}${separator}locale=pt-BR`;
      }
      modified = true;
    } else if (langModified) {
      modified = true;
    }
  }
  
  return {
    url: modifiedUrl,
    modified,
    domain
  };
}

// --- Início do handler principal ---
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
    return res.status(405).json({ 
      error: "Método não permitido", 
      message: "Esta API aceita apenas requisições GET"
    });
  }

  const { search_id, term_url, marker } = req.query;
  const currency = req.query.currency;
  const preferredLanguage = req.query.language || req.headers['accept-language']?.split(',')[0] || 'pt-BR';
  const wantsPtBr = preferredLanguage.toLowerCase().startsWith('pt-br') || preferredLanguage.toLowerCase().startsWith('pt');

  if (!search_id || !term_url || !marker) {
    return res.status(400).json({ 
      error: "Parâmetros obrigatórios ausentes", 
      required: ["search_id", "term_url", "marker"],
      provided: { search_id: !!search_id, term_url: !!term_url, marker: !!marker }
    });
  }

  console.log(`[Proxy Redirect] Buscando link para search_id: ${search_id}, term_url: ${term_url}, marker: ${marker}${currency ? `, currency: ${currency}` : ''}${preferredLanguage ? `, language: ${preferredLanguage}` : ''}`);
  
  let redirectUrl = `https://api.travelpayouts.com/v1/flight_searches/${encodeURIComponent(search_id)}/clicks/${encodeURIComponent(term_url)}.json?marker=${encodeURIComponent(marker)}`;
  if (currency) redirectUrl += `&currency=${encodeURIComponent(currency)}`;
  redirectUrl += `&locale=${encodeURIComponent(wantsPtBr ? 'pt-BR' : 'en-US')}`;
  console.log(`[Proxy Redirect] URL construída: ${redirectUrl}`);

  try {
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

    console.log(`[Proxy Redirect] Resposta recebida com status ${redirectResponse.status}`);

    if (redirectResponse.status !== 200) {
      console.error(`[Proxy Redirect] API retornou status ${redirectResponse.status}:`, 
        typeof redirectResponse.data === 'object' ? JSON.stringify(redirectResponse.data) : redirectResponse.data);
      return res.status(redirectResponse.status).json({
        error: `API externa retornou status ${redirectResponse.status}`,
        details: redirectResponse.data,
        timestamp: new Date().toISOString()
      });
    }

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

    let urlModified = false;
    let partnerDomain = 'unknown';

    const partnerUrl = redirectResponse.data.url;
    const gateName = redirectResponse.data.gate_name || '';
    const gateId = redirectResponse.data.gate_id || '';

    // --- Registro detalhado para diagnóstico ---
    if (partnerUrl) {
      // Extrai domínio
      const matchDomain = partnerUrl.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
      partnerDomain = matchDomain ? matchDomain[1] : 'unknown';
      console.log(`[Proxy Redirect] URL recebida: ${partnerUrl.substring(0, 100)}...`);
      console.log(`[Proxy Redirect] Domínio detectado: ${partnerDomain}`);
      console.log(`[Proxy Redirect] Parâmetros importantes detectados:`);
      console.log(
        `  - Currency/Moeda: ${
          partnerUrl.match(/[?&](([cC]urr(ency)?|[mM]oeda)=)([A-Z]{3})/i) ? 'Sim' : 'Não'
        }`
      );
      console.log(
        `  - Locale/Idioma: ${
          partnerUrl.match(/[?&](([lL]ocale|[lL]ang(uage)?)=)([a-zA-Z-]{2,7})/i) ? 'Sim' : 'Não'
        }`
      );
    }

    // NOVO: Modificação automática de URL
    if (partnerUrl) {
      const languageToUse = wantsPtBr ? 'pt-BR' : preferredLanguage || 'en-US';
      console.log(`[Proxy Redirect] Aplicando modificações automáticas para idioma ${languageToUse} e moeda ${currency || 'N/A'}`);

      const { url: modifiedUrl, modified, domain } =
        applySmartParameterChanges(partnerUrl, currency, languageToUse);

      if (modified) {
        redirectResponse.data.url = modifiedUrl;
        console.log(`[Proxy Redirect] URL modificada automaticamente. Domínio: ${domain}`);
        urlModified = true;
        partnerDomain = domain;
      }
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

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

    const urlParcial = redirectResponse.data.url.substring(0, 50) + '...';
    console.log(`[Proxy Redirect] Link final: ${urlParcial}`);
    console.log(`[Proxy Redirect] Método: ${redirectResponse.data.method || 'GET'}`);

    return res.status(200).json(finalJson);

  } catch (error) {
    console.error(`[Proxy Redirect] ERRO AO BUSCAR LINK:`, error.message);
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: "Tempo limite excedido ao conectar com a API externa",
        code: "TIMEOUT",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else if (error.response) {
      return res.status(error.response.status || 502).json({
        error: "Erro retornado pela API externa",
        status: error.response.status,
        data: error.response.data,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else if (error.request) {
      return res.status(504).json({
        error: "Sem resposta da API externa",
        code: "NO_RESPONSE",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        error: "Erro interno na requisição",
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
};
