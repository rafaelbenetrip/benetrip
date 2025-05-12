// api/flight-redirect.js
const axios = require('axios');

// Mapeamento de regras de parceiros para internacionalização (i18n) e localização (l10n)
// Este objeto pode ser expandido e até mesmo movido para um arquivo de configuração separado.
const partnerRules = {
  // Exemplo para ubfly.br.com (já existente no código original, agora formalizado)
  'ubfly.br.com': {
    currencyParam: 'Currency', // Nome do parâmetro de moeda
    languageParam: 'Locale',   // Nome do parâmetro de idioma
    languageValueFormat: (lang) => lang.toLowerCase().startsWith('pt') ? 'PT' : 'EN', // Formato específico: PT ou EN
    currencyValueFormat: (curr) => curr.toUpperCase(), // Ex: BRL
    // Regra específica: se a URL já tiver Currency=USD e o usuário quer BRL, substitui.
    // Se tiver Locale=EN e o usuário quer PT, substitui.
    specificLogic: (url, currency, language) => {
      let modifiedUrl = url;
      let modified = false;
      if (currency === 'BRL' && modifiedUrl.includes('Currency=USD')) {
        modifiedUrl = modifiedUrl.replace('Currency=USD', 'Currency=BRL');
        modified = true;
      }
      if (language && language.toLowerCase().startsWith('pt') && modifiedUrl.includes('Locale=EN')) {
        modifiedUrl = modifiedUrl.replace('Locale=EN', 'Locale=PT');
        modified = true;
      }
      return { url: modifiedUrl, modified };
    }
  },
  'exemplo-parceiro-a.com': {
    currencyParam: 'displayCurrency',
    languageParam: 'market', // Ex: 'pt-br', 'en-us'
    languageValueFormat: (lang) => lang.toLowerCase().startsWith('pt') ? 'pt-br' : (lang.toLowerCase().startsWith('en') ? 'en-us' : lang.toLowerCase()),
    currencyValueFormat: (curr) => curr.toUpperCase(),
  },
  'exemplo-parceiro-b.net': {
    currencyParam: 'cur',
    languageParam: 'lang', // Ex: 'pt', 'en'
    languageValueFormat: (lang) => lang.toLowerCase().split('-')[0], // Pega 'pt' de 'pt-BR'
    currencyValueFormat: (curr) => curr.toLowerCase(), // Ex: brl
  },
  // Adicione mais parceiros e suas regras específicas aqui
  // 'nomedoparceiro.com': { ... regras ... },
};


/**
 * Aplica modificações à URL do parceiro de forma inteligente para moeda e idioma.
 * @param {string} originalUrl - URL original do parceiro.
 * @param {string} targetCurrency - Moeda desejada (ex: "BRL").
 * @param {string} targetLanguage - Idioma desejado (ex: "pt-BR").
 * @returns {Object} - { url: string (modificada ou original), modified: boolean, domain: string, ruleApplied: string|null }
 */
function applySmartParameterChanges(originalUrl, targetCurrency, targetLanguage) {
  if (!originalUrl) return { url: originalUrl, modified: false, domain: 'unknown', ruleApplied: null };

  let currentUrl = originalUrl;
  let modified = false;
  let ruleApplied = null;

  console.log(`[Redirect Smarter] Iniciando modificação para URL: ${originalUrl.substring(0,100)}...`);
  console.log(`[Redirect Smarter] Moeda Alvo: ${targetCurrency}, Idioma Alvo: ${targetLanguage}`);

  const domainMatch = originalUrl.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
  const domain = domainMatch ? domainMatch[1].toLowerCase() : 'unknown';
  console.log(`[Redirect Smarter] Domínio detectado: ${domain}`);

  const specificRule = partnerRules[domain];

  if (specificRule && specificRule.specificLogic) {
    console.log(`[Redirect Smarter] Aplicando lógica específica para o domínio: ${domain}`);
    const result = specificRule.specificLogic(currentUrl, targetCurrency, targetLanguage);
    currentUrl = result.url;
    if (result.modified) {
        modified = true;
        ruleApplied = `specificLogic for ${domain}`;
    }
    console.log(`[Redirect Smarter] Após lógica específica: ${currentUrl.substring(0,100)}... (Modificado: ${modified})`);
  }

  // Tentar aplicar regras genéricas ou baseadas em partnerRules (se não houver specificLogic ou ela não modificou)
  const currencyParamName = specificRule?.currencyParam;
  const languageParamName = specificRule?.languageParam;
  const formatLangValue = specificRule?.languageValueFormat || ((lang) => lang.toLowerCase().startsWith('pt') ? 'pt-BR' : lang); // Default: pt-BR ou original
  const formatCurrValue = specificRule?.currencyValueFormat || ((curr) => curr.toUpperCase()); // Default: BRL

  // 1. Modificar/Adicionar Moeda
  if (targetCurrency) {
    const formattedTargetCurrency = formatCurrValue(targetCurrency);
    let currencyModifiedThisPass = false;
    // Padrões comuns para parâmetros de moeda (case insensitive)
    const currencyPatterns = [
      new RegExp(`([?&]${currencyParamName || 'currency'}=)([A-Z]{3})`, 'i'),
      new RegExp(`([?&]${currencyParamName || 'curr'}=)([A-Z]{3})`, 'i'),
      new RegExp(`([?&]${currencyParamName || 'cur'}=)([A-Z]{3})`, 'i'),
      new RegExp(`([?&]${currencyParamName || 'pricecurrency'}=)([A-Z]{3})`, 'i'),
      new RegExp(`([?&]${currencyParamName || 'displayCurrency'}=)([A-Z]{3})`, 'i'),
      new RegExp(`([?&]${currencyParamName || 'moeda'}=)([A-Z]{3})`, 'i'),
      // Adicione outros padrões comuns se necessário
    ];

    for (const pattern of currencyPatterns) {
      if (currentUrl.match(pattern)) {
        const existingCurrency = currentUrl.match(pattern)[2];
        if (existingCurrency.toUpperCase() !== formattedTargetCurrency) {
          currentUrl = currentUrl.replace(pattern, `$1${formattedTargetCurrency}`);
          modified = true;
          currencyModifiedThisPass = true;
          ruleApplied = ruleApplied || `currencyPattern ${pattern.source}`;
          console.log(`[Redirect Smarter] Moeda MODIFICADA via padrão ${pattern.source} para ${formattedTargetCurrency}`);
        } else {
          currencyModifiedThisPass = true; // Já está correto
          console.log(`[Redirect Smarter] Moeda JÁ CORRETA via padrão ${pattern.source} (${formattedTargetCurrency})`);
        }
        break;
      }
    }

    if (!currencyModifiedThisPass) {
      const separator = currentUrl.includes('?') ? '&' : '?';
      const paramNameToAdd = currencyParamName || (currentUrl.toLowerCase().includes('currency=') ? 'Currency' : 'currency');
      currentUrl = `${currentUrl}${separator}${paramNameToAdd}=${formattedTargetCurrency}`;
      modified = true;
      ruleApplied = ruleApplied || `currencyAdded ${paramNameToAdd}`;
      console.log(`[Redirect Smarter] Moeda ADICIONADA: ${paramNameToAdd}=${formattedTargetCurrency}`);
    }
  }

  // 2. Modificar/Adicionar Idioma
  if (targetLanguage) {
    const formattedTargetLanguage = formatLangValue(targetLanguage);
    let languageModifiedThisPass = false;
    // Padrões comuns para parâmetros de idioma (case insensitive)
    // Formatos comuns: xx, xx-XX, xx_XX
    const languagePatterns = [
      new RegExp(`([?&]${languageParamName || 'locale'}=)([a-zA-Z]{2}(?:[-_][a-zA-Z]{2})?)`, 'i'),
      new RegExp(`([?&]${languageParamName || 'lang'}=)([a-zA-Z]{2}(?:[-_][a-zA-Z]{2})?)`, 'i'),
      new RegExp(`([?&]${languageParamName || 'language'}=)([a-zA-Z]{2}(?:[-_][a-zA-Z]{2})?)`, 'i'),
      new RegExp(`([?&]${languageParamName || 'lc'}=)([a-zA-Z]{2}(?:[-_][a-zA-Z]{2})?)`, 'i'),
      new RegExp(`([?&]${languageParamName || 'hl'}=)([a-zA-Z]{2}(?:[-_][a-zA-Z]{2})?)`, 'i'),
      new RegExp(`([?&]${languageParamName || 'market'}=)([a-zA-Z]{2}(?:[-_][a-zA-Z]{2})?)`, 'i'),
      new RegExp(`([?&]${languageParamName || 'CountryCode'}=)([a-zA-Z]{2})`, 'i'), // Para casos como CountryCode=BR
      new RegExp(`([?&]${languageParamName || 'idioma'}=)([a-zA-Z]{2}(?:[-_][a-zA-Z]{2})?)`, 'i'),
    ];

    for (const pattern of languagePatterns) {
      if (currentUrl.match(pattern)) {
        const existingLanguage = currentUrl.match(pattern)[2];
        // Normalizar para comparação (ex: pt-br vs pt_BR vs pt)
        const normalize = (lang) => lang.toLowerCase().replace('_', '-').split('-')[0];
        if (normalize(existingLanguage) !== normalize(formattedTargetLanguage)) {
          currentUrl = currentUrl.replace(pattern, `$1${formattedTargetLanguage}`);
          modified = true;
          languageModifiedThisPass = true;
          ruleApplied = ruleApplied || `languagePattern ${pattern.source}`;
          console.log(`[Redirect Smarter] Idioma MODIFICADO via padrão ${pattern.source} para ${formattedTargetLanguage}`);
        } else {
          languageModifiedThisPass = true; // Já está correto ou equivalente
           console.log(`[Redirect Smarter] Idioma JÁ CORRETO/EQUIVALENTE via padrão ${pattern.source} (${formattedTargetLanguage})`);
        }
        break;
      }
    }

    if (!languageModifiedThisPass) {
      const separator = currentUrl.includes('?') ? '&' : '?';
      const paramNameToAdd = languageParamName || (currentUrl.toLowerCase().includes('locale=') ? 'Locale' : 'locale');
      currentUrl = `${currentUrl}${separator}${paramNameToAdd}=${formattedTargetLanguage}`;
      modified = true;
      ruleApplied = ruleApplied || `languageAdded ${paramNameToAdd}`;
      console.log(`[Redirect Smarter] Idioma ADICIONADO: ${paramNameToAdd}=${formattedTargetLanguage}`);
    }
  }

  console.log(`[Redirect Smarter] URL Final: ${currentUrl.substring(0,100)}... (Modificado: ${modified}, Regra: ${ruleApplied || 'Nenhuma'})`);
  return { url: currentUrl, modified, domain, ruleApplied };
}


// --- Início do handler principal ---
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
    return res.status(405).json({
      error: "Método não permitido",
      message: "Esta API aceita apenas requisições GET"
    });
  }

  const { search_id, term_url, marker } = req.query;
  // Moeda e idioma desejados pelo usuário, passados pelo frontend
  const userCurrency = req.query.currency; // Ex: "BRL"
  const userLanguage = req.query.language || req.headers['accept-language']?.split(',')[0] || 'pt-BR'; // Ex: "pt-BR"

  if (!search_id || !term_url || !marker) {
    console.warn("[Proxy Redirect] Parâmetros obrigatórios ausentes:", req.query);
    return res.status(400).json({
      error: "Parâmetros obrigatórios ausentes",
      required: ["search_id", "term_url", "marker"],
      provided: { search_id: !!search_id, term_url: !!term_url, marker: !!marker }
    });
  }

  console.log(`[Proxy Redirect] Buscando link para search_id: ${search_id}, term_url: ${term_url.substring(0,30)}..., marker: ${marker}`);
  if (userCurrency) console.log(`[Proxy Redirect] Moeda do usuário: ${userCurrency}`);
  if (userLanguage) console.log(`[Proxy Redirect] Idioma do usuário: ${userLanguage}`);

  // O locale na API da Travelpayouts para /clicks afeta a página de "estamos te redirecionando" deles,
  // não necessariamente a página final do parceiro.
  const travelpayoutsApiLocale = userLanguage.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en-US';

  let redirectApiUrl = `https://api.travelpayouts.com/v1/flight_searches/${encodeURIComponent(search_id)}/clicks/${encodeURIComponent(term_url)}.json?marker=${encodeURIComponent(marker)}`;
  // A API de clicks da Travelpayouts também aceita `currency`, que pode influenciar o link gerado.
  if (userCurrency) redirectApiUrl += `&currency=${encodeURIComponent(userCurrency.toUpperCase())}`;
  redirectApiUrl += `&locale=${encodeURIComponent(travelpayoutsApiLocale)}`;

  console.log(`[Proxy Redirect] URL da API de cliques construída: ${redirectApiUrl}`);

  try {
    const redirectResponseFromApi = await axios.get(redirectApiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BenetripFlights/1.1', // Seja específico no User-Agent
        'Accept-Encoding': 'gzip, deflate, br'
      },
      timeout: 15000, // Timeout aumentado
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Aceitar 4xx para ver o erro
      }
    });

    console.log(`[Proxy Redirect] Resposta da API de cliques recebida com status ${redirectResponseFromApi.status}`);

    if (redirectResponseFromApi.status !== 200) {
      console.error(`[Proxy Redirect] API de cliques retornou status ${redirectResponseFromApi.status}:`,
        typeof redirectResponseFromApi.data === 'object' ? JSON.stringify(redirectResponseFromApi.data) : redirectResponseFromApi.data);
      return res.status(redirectResponseFromApi.status).json({
        error: `API externa (cliques) retornou status ${redirectResponseFromApi.status}`,
        details: redirectResponseFromApi.data,
        timestamp: new Date().toISOString()
      });
    }

    if (!redirectResponseFromApi.data || !redirectResponseFromApi.data.url) {
      console.error('[Proxy Redirect] Resposta inválida da API de cliques (sem URL):',
        typeof redirectResponseFromApi.data === 'object' ? JSON.stringify(redirectResponseFromApi.data) : redirectResponseFromApi.data);
      return res.status(502).json({
        error: "Resposta inválida da API externa (cliques)",
        message: "A resposta não contém o campo 'url' obrigatório",
        data: redirectResponseFromApi.data,
        timestamp: new Date().toISOString()
      });
    }

    let partnerUrlFromApi = redirectResponseFromApi.data.url;
    const gateName = redirectResponseFromApi.data.gate_name || '';
    const gateId = redirectResponseFromApi.data.gate_id || '';
    let urlModificationDetails = { modified: false, domain: 'unknown', ruleApplied: null };

    console.log(`[Proxy Redirect] URL do parceiro recebida da API: ${partnerUrlFromApi.substring(0, 100)}...`);
    console.log(`[Proxy Redirect] Gate: ${gateName} (ID: ${gateId})`);

    // Aplicar modificações de moeda e idioma na URL do parceiro
    if (partnerUrlFromApi && (userCurrency || userLanguage)) {
      console.log(`[Proxy Redirect] Tentando aplicar modificações inteligentes para Moeda: ${userCurrency || 'N/A'}, Idioma: ${userLanguage || 'N/A'}`);
      const modificationResult = applySmartParameterChanges(partnerUrlFromApi, userCurrency, userLanguage);
      partnerUrlFromApi = modificationResult.url;
      urlModificationDetails = modificationResult;
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const finalJsonResponse = {
      ...redirectResponseFromApi.data, // Inclui todos os dados da resposta da API (url, method, params, etc.)
      url: partnerUrlFromApi, // Sobrescreve com a URL possivelmente modificada
      _benetrip_info: {
        timestamp: Date.now(),
        currency_requested_to_partner: userCurrency || 'default',
        language_requested_to_partner: userLanguage || 'default',
        url_modification_details: {
            original_url_length: redirectResponseFromApi.data.url.length,
            modified_url_length: partnerUrlFromApi.length,
            was_modified: urlModificationDetails.modified,
            partner_domain: urlModificationDetails.domain,
            rule_applied: urlModificationDetails.ruleApplied
        },
        gate_id: gateId,
        gate_name: gateName,
      }
    };

    console.log(`[Proxy Redirect] Link final para o cliente: ${finalJsonResponse.url.substring(0, 50)}...`);
    console.log(`[Proxy Redirect] Método para o cliente: ${finalJsonResponse.method || 'GET'}`);
    if(finalJsonResponse.params) console.log(`[Proxy Redirect] Parâmetros POST para o cliente:`, finalJsonResponse.params);


    return res.status(200).json(finalJsonResponse);

  } catch (error) {
    console.error(`[Proxy Redirect] ERRO CRÍTICO AO BUSCAR LINK:`, error.message);
    if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
      return res.status(504).json({
        error: "Tempo limite excedido ao conectar com a API externa de cliques",
        code: "TIMEOUT",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else if (error.response) {
      // Erro vindo da resposta da API (ex: 4xx, 5xx da Travelpayouts)
      console.error("[Proxy Redirect] Erro na resposta da API externa:", error.response.status, error.response.data);
      return res.status(error.response.status || 502).json({
        error: "Erro retornado pela API externa de cliques",
        status: error.response.status,
        data: error.response.data,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else if (error.request) {
      // Erro na requisição, sem resposta (ex: problema de rede)
      console.error("[Proxy Redirect] Sem resposta da API externa:", error.request);
      return res.status(504).json({
        error: "Sem resposta da API externa de cliques",
        code: "NO_RESPONSE",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      // Outro tipo de erro (configuração do axios, erro de lógica no try, etc.)
      console.error("[Proxy Redirect] Erro interno na requisição:", error.stack);
      return res.status(500).json({
        error: "Erro interno no servidor durante o redirecionamento",
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined, // Não exponha stack em produção
        timestamp: new Date().toISOString()
      });
    }
  }
};
