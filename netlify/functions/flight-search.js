// netlify/functions/flight-search.js
const axios = require("axios");
const crypto = require("crypto");

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Método não permitido" };
  }

  try {
    const params = JSON.parse(event.body);
    
    // Gerar assinatura para a API Aviasales
    const token = process.env.AVIASALES_TOKEN;
    const marker = process.env.AVIASALES_MARKER;
    const host = process.env.HOST || "benetrip.com.br";
    
    // Esta é uma função simplificada - para produção, implemente o algoritmo de assinatura correto
    const signature = generateSignature(params, token);
    
    // Preparar dados para a requisição
    const data = {
      signature: signature,
      marker: marker,
      host: host,
      user_ip: event.headers['client-ip'] || "127.0.0.1",
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
    
    // Fazer a requisição à API Aviasales
    const searchResponse = await axios.post(
      "https://api.travelpayouts.com/v1/flight_search",
      data,
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
    
    const searchId = searchResponse.data.search_id;
    
    // Fazer várias tentativas para obter resultados
    let resultados = null;
    let tentativas = 0;
    const maxTentativas = 10;
    
    while (tentativas < maxTentativas) {
      tentativas++;
      
      // Esperar um pouco entre as tentativas
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Buscar resultados
      const resultsResponse = await axios.get(
        `https://api.travelpayouts.com/v1/flight_search_results?uuid=${searchId}`
      );
      
      // Verificar se já temos resultados completos
      if (resultsResponse.data && 
          resultsResponse.data.proposals && 
          resultsResponse.data.proposals.length > 0) {
        resultados = resultsResponse.data;
        break;
      }
    }
    
    // Retornar resultados processados
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(resultados)
    };
    
  } catch (error) {
    console.error("Erro na busca de voos:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Função para gerar a assinatura da API
function generateSignature(params, token) {
  // Implemente o algoritmo de assinatura correto aqui
  // Exemplo simplificado:
  const paramsString = JSON.stringify(params);
  return crypto.createHash('md5').update(token + paramsString).digest('hex');
}
