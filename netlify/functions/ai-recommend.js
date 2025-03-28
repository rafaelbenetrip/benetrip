// netlify/functions/ai-recommend.js
const { Configuration, OpenAIApi } = require("openai");
const axios = require("axios");

exports.handler = async function(event, context) {
  // Adicionar headers CORS para todas as respostas
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };

  // Responder imediatamente a requisições OPTIONS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: "Método não permitido" })
    };
  }

  try {
    // Extrair parâmetros do corpo da requisição
    const params = JSON.parse(event.body);
    
    // Modelo de destinos de fallback para testes e desenvolvimento
    const mockData = {
      "destinations": [
        {
          "cidade": "Medellín",
          "pais": "Colômbia",
          "codigo_pais": "CO",
          "codigo_iata": "MDE",
          "descricao_curta": "Cidade da eterna primavera com clima perfeito",
          "preco_passagem": 1800,
          "preco_hospedagem": 350,
          "experiencias": "Passeio de teleférico, Fazendas de café, Comuna 13",
          "custo_total": 3750,
          "porque_ir": "Clima primaveril o ano todo com paisagens montanhosas deslumbrantes"
        },
        {
          "cidade": "Montevidéu",
          "pais": "Uruguai",
          "codigo_pais": "UY",
          "codigo_iata": "MVD",
          "descricao_curta": "Capital tranquila com belas praias e cultura rica",
          "preco_passagem": 1500,
          "preco_hospedagem": 300,
          "experiencias": "Ciudad Vieja, Mercado del Puerto, Rambla",
          "custo_total": 3200,
          "porque_ir": "Atmosfera relaxante com excelente gastronomia e praias urbanas"
        },
        {
          "cidade": "Cusco",
          "pais": "Peru",
          "codigo_pais": "PE",
          "codigo_iata": "CUZ",
          "descricao_curta": "Portal para Machu Picchu e cultura inca",
          "preco_passagem": 1700,
          "preco_hospedagem": 250,
          "experiencias": "Machu Picchu, Vale Sagrado, San Blas",
          "custo_total": 3000,
          "porque_ir": "Imersão na cultura inca com paisagens de tirar o fôlego"
        },
        {
          "cidade": "Santiago",
          "pais": "Chile",
          "codigo_pais": "CL",
          "codigo_iata": "SCL",
          "descricao_curta": "Moderna capital cercada pela Cordilheira dos Andes",
          "preco_passagem": 1600,
          "preco_hospedagem": 350,
          "experiencias": "Cerro San Cristóbal, Vinícolas, Valparaíso",
          "custo_total": 3350,
          "porque_ir": "Mistura perfeita de cidade cosmopolita e natureza exuberante"
        },
        {
          "cidade": "Bariloche",
          "pais": "Argentina",
          "codigo_pais": "AR",
          "codigo_iata": "BRC",
          "descricao_curta": "Paraíso na Patagônia com lagos e montanhas",
          "preco_passagem": 2000,
          "preco_hospedagem": 400,
          "experiencias": "Cerro Catedral, Circuito Chico, Chocolaterias",
          "custo_total": 4000,
          "porque_ir": "Paisagens alpinas deslumbrantes e chocolate artesanal de qualidade"
        },
        {
          "cidade": "Cartagena",
          "pais": "Colômbia",
          "codigo_pais": "CO",
          "codigo_iata": "CTG",
          "descricao_curta": "Joia colonial no Caribe colombiano",
          "preco_passagem": 1950,
          "preco_hospedagem": 320,
          "experiencias": "Cidade Amuralhada, Ilhas do Rosário, Getsemaní",
          "custo_total": 3600,
          "porque_ir": "Ruas coloridas de arquitetura colonial com praias caribenhas paradisíacas"
        }
      ]
    };
    
    // Se estiver usando OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
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
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({
            data: response.data.choices[0].message.content
          })
        };
      } catch (error) {
        console.error("Erro na OpenAI:", error);
        // Se houver erro na API, retornar dados mockados para não quebrar a aplicação em produção
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({
            data: JSON.stringify(mockData)
          })
        };
      }
    }
    
    // Se estiver usando Claude
    else if (process.env.CLAUDE_API_KEY) {
      try {
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
              "x-api-key": process.env.CLAUDE_API_KEY,
              "anthropic-version": "2023-06-01"
            }
          }
        );
        
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({
            data: response.data.content[0].text
          })
        };
      } catch (error) {
        console.error("Erro no Claude:", error);
        // Se houver erro na API, retornar dados mockados para não quebrar a aplicação em produção
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({
            data: JSON.stringify(mockData)
          })
        };
      }
    }
    
    // Se nenhuma API estiver configurada, retornar dados de exemplo
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        data: JSON.stringify(mockData),
        warning: "Sem API configurada - usando dados de exemplo"
      })
    };
    
  } catch (error) {
    console.error("Erro geral:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
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
