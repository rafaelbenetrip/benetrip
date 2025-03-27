// netlify/functions/ai-recommend.js
const { Configuration, OpenAIApi } = require("openai");
const axios = require("axios");

exports.handler = async function(event, context) {
  // Verificar método e body
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Método não permitido" };
  }

  try {
    // Extrair parâmetros do corpo da requisição
    const params = JSON.parse(event.body);
    
    // Se estiver usando OpenAI
    if (process.env.OPENAI_API_KEY) {
      const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
      });
      const openai = new OpenAIApi(configuration);
      
      // Preparar o prompt baseado nos parâmetros recebidos
      const prompt = `
        Você é a Tripinha, uma cachorra vira-lata caramelo especialista em viagens da Benetrip.
        Preciso que recomende 6 destinos de viagem, considerando as seguintes preferências:
        
        - Partindo de ${params.cidade_partida?.name || 'origem não especificada'}
        - Viajando ${getCompanhiaText(params.companhia)}
        - Busca principalmente: ${getPreferenciaText(params.preferencia_viagem)}
        - Orçamento para passagens aéreas: ${params.orcamento_valor || 'flexível'} ${params.moeda_escolhida || 'BRL'} por pessoa
        - Período: ${params.datas?.dataIda || 'não especificado'} a ${params.datas?.dataVolta || 'não especificado'}
      `;
      
      const response = await openai.createChatCompletion({
        model: "gpt-4",
        messages: [
          {
            role: "system", 
            content: "Você é um assistente especializado em viagens que fornece recomendações de destinos em formato JSON estruturado."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      });
      
      // Retornar resultado
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          data: response.data.choices[0].message.content
        })
      };
    }
    
    // Se estiver usando Claude
    else if (process.env.CLAUDE_API_KEY) {
      const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-3-opus-20240229",
          messages: [
            {
              role: "user",
              content: `Você é a Tripinha, uma cachorra vira-lata caramelo especialista em viagens da Benetrip.
              Preciso que recomende 6 destinos de viagem, considerando as seguintes preferências:
              
              - Partindo de ${params.cidade_partida?.name || 'origem não especificada'}
              - Viajando ${getCompanhiaText(params.companhia)}
              - Busca principalmente: ${getPreferenciaText(params.preferencia_viagem)}
              - Orçamento para passagens aéreas: ${params.orcamento_valor || 'flexível'} ${params.moeda_escolhida || 'BRL'} por pessoa
              - Período: ${params.datas?.dataIda || 'não especificado'} a ${params.datas?.dataVolta || 'não especificado'}`
            }
          ],
          max_tokens: 4000
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01"
          }
        }
      );
      
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          data: response.data.content[0].text
        })
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Nenhuma API de IA configurada" })
    };
    
  } catch (error) {
    console.error("Erro:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Funções auxiliares
function getCompanhiaText(value) {
  const options = {
    0: "sozinho",
    1: "em casal (viagem romântica)",
    2: "em família",
    3: "com amigos"
  };
  return options[value] || "sozinho";
}

function getPreferenciaText(value) {
  const options = {
    0: "relaxamento e descanso (praias, resorts tranquilos, spas)",
    1: "aventura e atividades ao ar livre (trilhas, esportes, natureza)",
    2: "cultura, história e gastronomia (museus, centros históricos, culinária local)",
    3: "experiência urbana, compras e vida noturna (centros urbanos, lojas, restaurantes)"
  };
  return options[value] || "relaxamento e descanso";
}
