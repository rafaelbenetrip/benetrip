// api/flight-search.js - Endpoint Vercel para busca de voos
const axios = require('axios');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Lidar com requisições OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Apenas permitir requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    console.log('Recebendo requisição de busca de voos no Vercel');
    const params = req.body;
    
    // Obter token da API e marker do ambiente
    const token = process.env.AVIASALES_TOKEN;
    const marker = process.env.AVIASALES_MARKER;
    const host = process.env.HOST || "benetrip.com.br";
    
    // Verificar se o token e marker estão configurados
    if (!token || !marker) {
      console.error("Token ou Marker da API Aviasales não configurados!");
      return res.status(500).json({ 
        error: "Configuração da API incompleta", 
        success: false
      });
    }
    
    console.log('Token:', token.substring(0, 4) + '****');
    console.log('Marker:', marker);
    
    // Validar parâmetros obrigatórios
    if (!params.origem || !params.destino || !params.dataIda) {
      return res.status(400).json({ 
        error: "Parâmetros obrigatórios faltando: origem, destino ou dataIda", 
        params: params,
        success: false
      });
    }
    
    // Preparar dados para a requisição
    const data = {
      marker: marker,
      host: host,
      user_ip: req.headers['x-forwarded-for'] || req.headers['client-ip'] || req.connection.remoteAddress || "127.0.0.1",
      locale: "pt",
      trip_class: params.classe || "Y",
      passengers: {
        adults: params.adultos || 1,
        children: params.criancas || 0,
        infants: params.bebes || 0
      },
      segments: []
    };
    
    // Adicionar segmento de ida
    data.segments.push({
      origin: params.origem,
      destination: params.destino,
      date: params.dataIda
    });
    
    // Adicionar segmento de volta, se aplicável
    if (params.dataVolta) {
      data.segments.push({
        origin: params.destino,
        destination: params.origem,
        date: params.dataVolta
      });
    }
    
    // Gerar assinatura para a API Aviasales usando o objeto data completo
    const signature = generateSignature(data, token);
    data.signature = signature;
    
    console.log('Dados da requisição:', JSON.stringify(data, null, 2));
    
    // Fazer a requisição à API Aviasales
    const searchResponse = await axios.post(
      "https://api.travelpayouts.com/v1/flight_search",
      data,
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 10000 // 10 segundos
      }
    );
    
    console.log('Resposta da API: status', searchResponse.status);
    
    const searchId = searchResponse.data.search_id;
    console.log('Search ID:', searchId);
    
    if (!searchId) {
      console.error('Nenhum search_id retornado:', searchResponse.data);
      return res.status(500).json({ 
        error: "Falha na busca: API não retornou ID de busca", 
        success: false, 
        apiResponse: searchResponse.data 
      });
    }
    
    // Fazer várias tentativas para obter resultados
    let resultados = null;
    let tentativas = 0;
    const maxTentativas = 5;
    
    while (tentativas < maxTentativas) {
      tentativas++;
      console.log(`Tentativa ${tentativas} de ${maxTentativas} para obter resultados...`);
      
      // Esperar entre as tentativas
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Buscar resultados
      const resultsResponse = await axios.get(
        `https://api.travelpayouts.com/v1/flight_search_results?uuid=${searchId}`,
        { timeout: 8000 }
      );
      
      // Verificar se já temos resultados completos
      if (resultsResponse.data && 
          resultsResponse.data.proposals && 
          resultsResponse.data.proposals.length > 0) {
        console.log(`Encontrados ${resultsResponse.data.proposals.length} resultados`);
        resultados = resultsResponse.data;
        break;
      }
      
      // Se for a última resposta com apenas search_id, significa que a busca continua
      if (tentativas === maxTentativas && 
          resultsResponse.data && 
          Object.keys(resultsResponse.data).length === 1 &&
          resultsResponse.data.search_id) {
        console.log('A busca ainda está em andamento. Retornando o search_id para polling posterior');
        return res.status(202).json({
          success: true,
          searchId: searchId,
          message: "A busca está em andamento. Use o searchId para verificar os resultados posteriormente.",
          tentativas: tentativas
        });
      }
    }
    
    // Retornar resultados processados
    return res.status(200).json({
      success: true,
      searchId: searchId,
      resultados: resultados,
      tentativas: tentativas
    });
    
  } catch (error) {
    console.error("Erro na busca de voos no Vercel:", error);
    
    // Verificar se é um erro da API
    if (error.response) {
      console.error("Status da resposta:", error.response.status);
      console.error("Dados da resposta:", error.response.data);
      
      // Erro 401 - Problema de autenticação
      if (error.response.status === 401) {
        return res.status(500).json({
          error: "Erro de autenticação na API. Verifique o token e a assinatura.",
          status: error.response.status,
          data: error.response.data,
          success: false
        });
      }
      
      // Outros erros com resposta
      return res.status(500).json({
        error: `Erro na API: ${error.response.status} - ${error.response.statusText}`,
        data: error.response.data,
        success: false
      });
    }
    
    // Erros genéricos
    return res.status(500).json({ 
      error: error.message,
      success: false
    });
  }
}

// Função para gerar a assinatura da API
function generateSignature(params, token) {
  if (!token) {
    console.warn("Token da API Aviasales não configurado!");
    return "fake_signature_placeholder";
  }
  
  try {
    // 1. Extrair todos os parâmetros e valores
    const flatValues = [];
    
    // Função auxiliar para extrair valores recursivamente
    function extractValues(obj) {
      if (!obj) return;
      
      for (const key of Object.keys(obj).sort()) {
        if (key === 'signature') continue;
        const value = obj[key];
        
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            // Para arrays, adicionar recursivamente cada item
            value.forEach(item => {
              if (typeof item === 'object' && item !== null) {
                extractValues(item);
              } else if (item !== undefined) {
                flatValues.push(String(item));
              }
            });
          } else {
            // Para objetos, extrair valores recursivamente
            extractValues(value);
          }
        } else if (value !== undefined) {
          // Adicionar valores simples
          flatValues.push(String(value));
        }
      }
    }
    
    // Extrair valores (não reordenar novamente)
    extractValues(params);
    
    // Construir a string de assinatura: token + valores concatenados sem delimitador
    const signatureString = token + flatValues.join('');
    console.log('String da assinatura (primeiros 30 chars):', signatureString.substring(0, 30) + '...');
    
    // Gerar hash MD5
    return crypto.createHash('md5').update(signatureString).digest('hex');
  } catch (error) {
    console.error("Erro ao gerar assinatura:", error);
    
    // Método de fallback original
    try {
      const paramsClone = JSON.parse(JSON.stringify(params));
      delete paramsClone.signature; // Remover a assinatura se existir
      const paramsString = JSON.stringify(paramsClone);
      return crypto.createHash('md5').update(token + paramsString).digest('hex');
    } catch (err) {
      console.error("Erro no método de fallback:", err);
      return "error_generating_signature";
    }
  }
}

// Função auxiliar para verificação de parâmetros (debug)
function validarParametrosBusca(params) {
  console.log('Validando parâmetros de busca de voos:');
  console.log('Origem:', params.origem);
  console.log('Destino:', params.destino);
  console.log('Data de Ida:', params.dataIda);
  console.log('Data de Volta:', params.dataVolta);
  
  let valido = true;
  let mensagensErro = [];
  
  if (!params.origem) {
    valido = false;
    mensagensErro.push('Código IATA de origem não encontrado');
  }
  
  if (!params.destino) {
    valido = false;
    mensagensErro.push('Código IATA de destino não encontrado');
  }
  
  if (!params.dataIda) {
    valido = false;
    mensagensErro.push('Data de ida não encontrada');
  }
  
  return {
    valido,
    mensagensErro,
    params
  };
}
