// netlify/functions/proxy.js
const axios = require("axios");

exports.handler = async function(event, context) {
  // Aceitar qualquer método, incluindo OPTIONS para preflight CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // Responder a preflight requests
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    // Extrair o endpoint alvo dos parâmetros da requisição
    const target = event.path.split('/proxy/')[1] || 'ai-recommend';
    const params = JSON.parse(event.body || '{}');
    
    // Obter chave API diretamente das variáveis de ambiente
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    
    // Usar OpenAI (prefererencial) ou Claude
    let responseData;
    
    if (OPENAI_API_KEY) {
      console.log("Usando OpenAI API");
      const prompt = `
        Você é a Tripinha, uma cachorra vira-lata caramelo especialista em viagens da Benetrip.
        Preciso que recomende 6 destinos de viagem, considerando as seguintes preferências:
        
        - Partindo de ${params.cidade_partida?.name || 'origem não especificada'}
        - Viajando ${getCompanhiaText(params.companhia)}
        - Busca principalmente: ${getPreferenciaText(params.preferencia_viagem)}
        - Orçamento para passagens aéreas: ${params.orcamento_valor || 'flexível'} ${params.moeda_escolhida || 'BRL'} por pessoa
        - Período: ${params.datas?.dataIda || 'não especificado'} a ${params.datas?.dataVolta || 'não especificado'}
      `;
      
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4",
          messages: [
            {
              role: "system", 
              content: "Você é um assistente especializado em viagens que fornece recomendações de destinos em formato JSON estruturado."
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.7
        },
        {
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      responseData = response.data.choices[0].message.content;
    }
    else if (CLAUDE_API_KEY) {
      console.log("Usando Claude API");
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
              - Período: ${params.datas?.dataIda || 'não especificado'} a ${params.datas?.dataVolta || 'não especificado'}
              
              Forneça exatamente 6 destinos no seguinte formato JSON:
              {
                "destinations": [
                  {
                    "cidade": "Nome da cidade",
                    "pais": "Nome do país",
                    "codigo_pais": "Código de 2 letras do país",
                    "codigo_iata": "Código IATA do aeroporto principal",
                    "descricao_curta": "Breve descrição de uma linha",
                    "preco_passagem": valor numérico estimado (apenas para passagem aérea),
                    "preco_hospedagem": valor numérico por noite,
                    "experiencias": "3 experiências imperdíveis separadas por vírgula",
                    "custo_total": valor numérico estimado para 5 dias,
                    "porque_ir": "Uma frase curta e envolvente sobre o destino"
                  },
                  ...mais 5 destinos
                ]
              }`
            }
          ],
          max_tokens: 4000
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01"
          }
        }
      );
      
      responseData = response.data.content[0].text;
    }
    else {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Nenhuma API configurada", 
          message: "Configure OPENAI_API_KEY ou CLAUDE_API_KEY nas variáveis de ambiente do Netlify" 
        })
      };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: responseData })
    };
  } catch (error) {
    console.error("Erro no proxy:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Erro ao processar requisição", 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
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
