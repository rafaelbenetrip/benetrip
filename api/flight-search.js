// api/flight-search.js - Endpoint Vercel para busca de voos
import axios from 'axios';
import crypto from 'crypto';

export default async function handler(req, res) {
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
    return res.status(200).json({
      success: true,
      searchId: searchId,
      resultados: resultados,
      tentativas: tentativas
    });
    
  } catch (error) {
    console.error("Erro na busca de voos no Vercel:", error);
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
  
  // Implementação do algoritmo de assinatura
  try {
    const paramsString = JSON.stringify(params);
    return crypto.createHash('md5').update(token + paramsString).digest('hex');
  } catch (error) {
    console.error("Erro ao gerar assinatura:", error);
    return "error_generating_signature";
  }
}
