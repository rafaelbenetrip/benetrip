// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
import axios from 'axios';

export default async function handler(req, res) {
  console.log('Recebendo requisição na API recommendations!');
  
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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
    // Log para debugging
    console.log('Processando requisição para recomendações no Vercel');
    
    // Extrair dados da requisição
    const requestData = req.body;
    console.log('Dados recebidos:', JSON.stringify(requestData).substring(0, 200) + '...');
    
    // Verificar se temos informações suficientes
    if (!requestData) {
      throw new Error("Dados de preferências não fornecidos");
    }
    
    // Dados mockados para fallback em caso de erro
    const mockData = {
      "topPick": {
        "destino": "Medellín",
        "pais": "Colômbia",
        "codigoPais": "CO",
        "descricao": "Cidade da eterna primavera com clima perfeito o ano todo",
        "porque": "Clima primaveril o ano todo com paisagens montanhosas deslumbrantes",
        "destaque": "Passeio de teleférico, Comuna 13 e fazendas de café próximas",
        "comentario": "Eu simplesmente AMEI Medellín! É perfeito para quem busca um mix de cultura e natureza! 🐾",
        "preco": {
          "voo": 1800,
          "hotel": 350
        }
      },
      "alternativas": [
        {
          "destino": "Montevidéu",
          "pais": "Uruguai",
          "codigoPais": "UY",
          "porque": "Clima costeiro tranquilo com frutos do mar deliciosos e espaços culturais",
          "preco": {
            "voo": 1500,
            "hotel": 300
          }
        },
        {
          "destino": "Buenos Aires",
          "pais": "Argentina",
          "codigoPais": "AR",
          "porque": "Capital cosmopolita com rica vida cultural, teatros e arquitetura europeia",
          "preco": {
            "voo": 1400,
            "hotel": 280
          }
        },
        {
          "destino": "Santiago",
          "pais": "Chile",
          "codigoPais": "CL",
          "porque": "Moderna capital cercada pela Cordilheira dos Andes com excelentes vinhos",
          "preco": {
            "voo": 1600,
            "hotel": 350
          }
        },
        {
          "destino": "Cusco",
          "pais": "Peru",
          "codigoPais": "PE",
          "porque": "Portal para Machu Picchu com rica história inca e arquitetura colonial",
          "preco": {
            "voo": 1700,
            "hotel": 250
          }
        }
      ],
      "surpresa": {
        "destino": "Cartagena",
        "pais": "Colômbia",
        "codigoPais": "CO",
        "descricao": "Joia colonial no Caribe colombiano com praias paradisíacas",
        "porque": "Cidade murada histórica com ruas coloridas, cultura vibrante e praias maravilhosas",
        "destaque": "Passeio de barco pelas Ilhas do Rosário com águas cristalinas",
        "comentario": "Cartagena é um tesouro escondido que vai te conquistar! As cores, a música e a comida caribenha formam uma experiência inesquecível! 🐾🌴",
        "preco": {
          "voo": 1950,
          "hotel": 320
        }
      }
    };
    
    // Gerar prompt baseado nos dados do usuário
    const prompt = gerarPromptParaDestinos(requestData);
    
    // Chamar a API Perplexity
    try {
      console.log('Usando Perplexity para recomendações');
      
      // Verificar se API key da Perplexity está configurada
      if (!process.env.PERPLEXITY_API_KEY) {
        throw new Error('PERPLEXITY_API_KEY não configurada');
      }
      
      const perplexityResponse = await callPerplexityAPI(prompt);
      
      console.log('Resposta recebida da Perplexity');
      
      // Retornar a resposta formatada
      return res.status(200).json({
        tipo: "perplexity",
        conteudo: perplexityResponse
      });
    } catch (perplexityError) {
      console.error('Erro ao usar Perplexity:', perplexityError);
      
      // Tentar outros modelos como fallback se disponíveis
      try {
        let fallbackResponse = null;
        
        // Tentar OpenAI como fallback se configurada
        if (process.env.OPENAI_API_KEY) {
          console.log('Tentando OpenAI como fallback');
          fallbackResponse = await callOpenAIAPI(prompt);
        } 
        // Tentar Claude como segundo fallback
        else if (process.env.CLAUDE_API_KEY) {
          console.log('Tentando Claude como fallback');
          fallbackResponse = await callClaudeAPI(prompt);
        }
        
        if (fallbackResponse) {
          return res.status(200).json({
            tipo: "fallback",
            conteudo: fallbackResponse
          });
        } else {
          throw new Error('Nenhum serviço de IA disponível');
        }
      } catch (fallbackError) {
        console.error('Erro ao usar serviços de fallback:', fallbackError);
        
        // Retornar dados mockados se nenhum serviço estiver disponível
        return res.status(200).json({
          tipo: "mockado",
          conteudo: JSON.stringify(mockData)
        });
      }
    }
    
  } catch (error) {
    console.error('Erro na API de recomendações Vercel:', error);
    
    return res.status(500).json({ 
      error: "Erro ao processar solicitação de IA",
      message: error.message
    });
  }
}

// Chamar a API da Perplexity
async function callPerplexityAPI(prompt) {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    const response = await axios({
      method: 'post',
      url: 'https://api.perplexity.ai/chat/completions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'Você é a Tripinha, uma cachorra vira-lata caramelo especialista em viagens da Benetrip. Você usa um tom amigável, alegre e entusiasmado. Você conhece sobre destinos turísticos em todo o mundo e pode recomendar lugares baseados nas preferências dos usuários.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: {
          type: "json_schema",
          json_schema: {
            type: "object",
            properties: {
              topPick: {
                type: "object",
                properties: {
                  destino: { type: "string" },
                  pais: { type: "string" },
                  codigoPais: { type: "string" },
                  descricao: { type: "string" },
                  porque: { type: "string" },
                  destaque: { type: "string" },
                  comentario: { type: "string" },
                  preco: {
                    type: "object",
                    properties: {
                      voo: { type: "number" },
                      hotel: { type: "number" }
                    }
                  }
                }
              },
              alternativas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    destino: { type: "string" },
                    pais: { type: "string" },
                    codigoPais: { type: "string" },
                    porque: { type: "string" },
                    preco: {
                      type: "object",
                      properties: {
                        voo: { type: "number" },
                        hotel: { type: "number" }
                      }
                    }
                  }
                }
              },
              surpresa: {
                type: "object",
                properties: {
                  destino: { type: "string" },
                  pais: { type: "string" },
                  codigoPais: { type: "string" },
                  descricao: { type: "string" },
                  porque: { type: "string" },
                  destaque: { type: "string" },
                  comentario: { type: "string" },
                  preco: {
                    type: "object",
                    properties: {
                      voo: { type: "number" },
                      hotel: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      timeout: 30000 // 30 segundos
    });
    
    // Retorna diretamente o conteúdo JSON da resposta
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Erro na chamada à API Perplexity:', error);
    if (error.response) {
      console.error('Resposta de erro:', error.response.data);
    }
    throw error;
  }
}

// Chamar a API da OpenAI como fallback
async function callOpenAIAPI(prompt) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    const response = await axios({
      method: 'post',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Você é a Tripinha, uma cachorra vira-lata caramelo especialista em viagens da Benetrip."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { "type": "json_object" }
      },
      timeout: 30000
    });
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Erro na chamada à API OpenAI:', error);
    throw error;
  }
}

// Chamar a API do Claude como fallback secundário
async function callClaudeAPI(prompt) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    
    const response = await axios({
      method: 'post',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'anthropic-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      data: {
        model: "claude-3-sonnet-20240229",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      },
      timeout: 30000
    });
    
    return response.data.content[0].text;
  } catch (error) {
    console.error('Erro na chamada à API Claude:', error);
    throw error;
  }
}

// Função para gerar prompt adequado para a IA
function gerarPromptParaDestinos(dados) {
  // Extrair informações relevantes dos dados recebidos
  const companhia = getCompanhiaText(dados.companhia);
  const preferencia = getPreferenciaText(dados.preferencia_viagem);
  const cidadeOrigem = dados.cidade_partida?.name || 'origem não especificada';
  const orcamento = dados.orcamento_valor || 'flexível';
  const moeda = dados.moeda_escolhida || 'BRL';
  
  // Datas de viagem
  let dataIda = 'não especificada';
  let dataVolta = 'não especificada';
  
  if (dados.datas) {
    if (typeof dados.datas === 'string' && dados.datas.includes(',')) {
      const partes = dados.datas.split(',');
      dataIda = partes[0];
      dataVolta = partes[1];
    } else if (dados.datas.dataIda && dados.datas.dataVolta) {
      dataIda = dados.datas.dataIda;
      dataVolta = dados.datas.dataVolta;
    }
  }

  // Construir prompt detalhado
  return `Preciso que recomende destinos de viagem baseados nestas preferências do usuário:

- Partindo de: ${cidadeOrigem}
- Viajando: ${companhia}
- Buscando principalmente: ${preferencia}
- Orçamento para passagens: ${orcamento} ${moeda}
- Período: ${dataIda} a ${dataVolta}

Você deve usar a internet para pesquisar destinos reais que combinem com essas preferências.
Forneça destinos relevantes para o perfil do usuário considerando:
- Atrações que combinam com as preferências indicadas
- Clima adequado no período de viagem
- Opções dentro do orçamento mencionado
- Facilidade de acesso a partir da origem

Forneça EXATAMENTE o seguinte formato JSON, sem texto adicional antes ou depois:
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX", // código de 2 letras do país
    "descricao": "Breve descrição do destino com até 100 caracteres",
    "porque": "Razão principal para visitar, relacionada às preferências do usuário",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Um comentário animado da Tripinha, como se você fosse um cachorro entusiasmado",
    "preco": {
      "voo": número, // valor estimado em ${moeda}
      "hotel": número // valor por noite estimado em ${moeda}
    }
  },
  "alternativas": [
    // EXATAMENTE 4 destinos alternativos, cada um com:
    {
      "destino": "Nome da Cidade",
      "pais": "Nome do País", 
      "codigoPais": "XX",
      "porque": "Razão principal para visitar",
      "preco": {
        "voo": número,
        "hotel": número
      }
    }
  ],
  "surpresa": {
    // Um destino surpresa menos óbvio mas que também combine com as preferências
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino com até 100 caracteres",
    "porque": "Razão principal para visitar, destacando o fator surpresa",
    "destaque": "Uma experiência única e surpreendente neste destino",
    "comentario": "Um comentário animado da Tripinha sobre este destino surpresa",
    "preco": {
      "voo": número,
      "hotel": número
    }
  }
}

Cada destino DEVE ser realista e ter preços estimados plausíveis. Não inclua texto explicativo antes ou depois do JSON.`;
}

// Função auxiliar para obter texto de companhia
function getCompanhiaText(value) {
  const options = {
    0: "sozinho(a)",
    1: "em casal (viagem romântica)",
    2: "em família",
    3: "com amigos"
  };
  return options[value] || "sozinho(a)";
}

// Função auxiliar para obter texto de preferência
function getPreferenciaText(value) {
  const options = {
    0: "relaxamento e descanso (praias, resorts tranquilos, spas)",
    1: "aventura e atividades ao ar livre (trilhas, esportes, natureza)",
    2: "cultura, história e gastronomia (museus, centros históricos, culinária local)",
    3: "experiência urbana, compras e vida noturna (centros urbanos, lojas, restaurantes)"
  };
  return options[value] || "experiências diversificadas de viagem";
}
