// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
import axios from 'axios';

export default async function handler(req, res) {
  // Configuração de CORS para qualquer origem
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

  // Criar um wrapper global para toda a lógica
  try {
    // Verificar se existe corpo na requisição
    if (!req.body) {
      console.error('Corpo da requisição vazio');
      return res.status(400).json({ error: "Nenhum dado fornecido na requisição" });
    }
    
    // Extrair dados da requisição com verificação extra
    let requestData;
    try {
      requestData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      console.log('Dados recebidos processados com sucesso');
    } catch (parseError) {
      console.error('Erro ao processar corpo da requisição:', parseError);
      return res.status(400).json({ error: "Formato de dados inválido", details: parseError.message });
    }
    
    // Verificação adicional de dados
    console.log('Tipo de dados recebidos:', typeof requestData);
    console.log('Conteúdo parcial:', JSON.stringify(requestData).substring(0, 200) + '...');
    
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
    let prompt;
    try {
      prompt = gerarPromptParaDestinos(requestData);
      console.log('Prompt gerado com sucesso, tamanho:', prompt.length);
    } catch (promptError) {
      console.error('Erro ao gerar prompt:', promptError);
      prompt = "Recomende destinos de viagem para um usuário. Forneça um destino principal, 4 alternativas e um destino surpresa. Responda em formato JSON.";
    }
    
    // Chamar a API Perplexity com verificação de ambiente
    try {
      // Verificar se API key da Perplexity está configurada
      if (!process.env.PERPLEXITY_API_KEY) {
        console.warn('PERPLEXITY_API_KEY não configurada, tentando alternativas');
        throw new Error('PERPLEXITY_API_KEY não configurada');
      }
      
      console.log('Chamando API Perplexity...');
      const perplexityResponse = await callPerplexityAPI(prompt);
      console.log('Resposta Perplexity recebida com sucesso');
      
      // Verificar se a resposta é válida
      if (!perplexityResponse) {
        throw new Error('Resposta vazia da Perplexity');
      }
      
      // Retornar a resposta formatada
      return res.status(200).json({
        tipo: "perplexity",
        conteudo: perplexityResponse
      });
    } catch (perplexityError) {
      console.error('Erro ao usar Perplexity:', perplexityError.message);
      
      // Tentar outros modelos como fallback com verificação de ambiente
      try {
        let fallbackResponse = null;
        
        // Tentar OpenAI como fallback se configurada
        if (process.env.OPENAI_API_KEY) {
          console.log('Tentando OpenAI como fallback...');
          fallbackResponse = await callOpenAIAPI(prompt);
          console.log('Resposta OpenAI recebida com sucesso');
        } 
        // Tentar Claude como segundo fallback
        else if (process.env.CLAUDE_API_KEY) {
          console.log('Tentando Claude como fallback...');
          fallbackResponse = await callClaudeAPI(prompt);
          console.log('Resposta Claude recebida com sucesso');
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
        console.error('Erro ao usar serviços de fallback:', fallbackError.message);
        
        // Retornar dados mockados se nenhum serviço estiver disponível
        console.log('Retornando dados mockados devido a falhas em todos os serviços');
        return res.status(200).json({
          tipo: "mockado",
          conteudo: JSON.stringify(mockData)
        });
      }
    }
    
  } catch (globalError) {
    // Captura qualquer erro não tratado para evitar o 500
    console.error('Erro global na API de recomendações:', globalError);
    
    // Retornar resposta de erro com detalhes
    return res.status(200).json({ 
      tipo: "erro",
      conteudo: JSON.stringify({
        error: "Erro no processamento",
        message: globalError.message,
        // Dados mockados como fallback de emergência
        data: {
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
        }
      })
    });
  }
}

// Chamar a API da Perplexity com melhor tratamento de erros
async function callPerplexityAPI(prompt) {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave da API Perplexity não configurada');
    }
    
    console.log('Enviando requisição para Perplexity...');
    
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
      timeout: 60000 // Aumentado para 60 segundos
    });
    
    // Verificar se a resposta contém o conteúdo esperado
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message || !response.data.choices[0].message.content) {
      console.error('Resposta Perplexity incompleta:', JSON.stringify(response.data).substring(0, 500));
      throw new Error('Formato de resposta da Perplexity inválido');
    }
    
    // Retorna diretamente o conteúdo JSON da resposta
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Erro detalhado na chamada à API Perplexity:');
    
    // Verificar se é um erro de timeout
    if (error.code === 'ECONNABORTED') {
      console.error('Timeout na chamada à API Perplexity');
    }
    
    // Verificar erro de resposta da API
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers));
      console.error('Dados:', JSON.stringify(error.response.data).substring(0, 500));
    }
    
    // Verificar erro de requisição
    if (error.request) {
      console.error('Requisição enviada, mas sem resposta');
    }
    
    // Outros erros
    console.error('Mensagem de erro:', error.message);
    
    throw error;
  }
}

// Chamar a API da OpenAI como fallback
async function callOpenAIAPI(prompt) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave da API OpenAI não configurada');
    }
    
    console.log('Enviando requisição para OpenAI...');
    
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
      timeout: 60000 // Aumentado para 60 segundos
    });
    
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message || !response.data.choices[0].message.content) {
      throw new Error('Formato de resposta da OpenAI inválido');
    }
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Erro detalhado na chamada à API OpenAI:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', JSON.stringify(error.response.data).substring(0, 500));
    }
    
    throw error;
  }
}

// Chamar a API do Claude como fallback secundário
async function callClaudeAPI(prompt) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    console.log('Enviando requisição para Claude...');
    
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
      timeout: 60000 // Aumentado para 60 segundos
    });
    
    if (!response.data || !response.data.content || !response.data.content[0] || !response.data.content[0].text) {
      throw new Error('Formato de resposta do Claude inválido');
    }
    
    return response.data.content[0].text;
  } catch (error) {
    console.error('Erro detalhado na chamada à API Claude:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', JSON.stringify(error.response.data).substring(0, 500));
    }
    
    throw error;
  }
}

// Função para gerar prompt adequado para a IA
function gerarPromptParaDestinos(dados) {
  // Extrair informações relevantes dos dados recebidos, com verificações
  const companhia = getCompanhiaText(dados.companhia || 0);
  const preferencia = getPreferenciaText(dados.preferencia_viagem || 0);
  const cidadeOrigem = dados.cidade_partida?.name || 'origem não especificada';
  const orcamento = dados.orcamento_valor || 'flexível';
  const moeda = dados.moeda_escolhida || 'BRL';
  
  // Datas de viagem com verificação de formato
  let dataIda = 'não especificada';
  let dataVolta = 'não especificada';
  
  if (dados.datas) {
    if (typeof dados.datas === 'string' && dados.datas.includes(',')) {
      const partes = dados.datas.split(',');
      dataIda = partes[0] || 'não especificada';
      dataVolta = partes[1] || 'não especificada';
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

Você deve fornecer destinos relevantes para o perfil do usuário considerando:
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

// Função auxiliar para obter texto de companhia com verificação de tipo
function getCompanhiaText(value) {
  // Converter para número se for string
  if (typeof value === 'string') {
    value = parseInt(value, 10);
  }
  
  const options = {
    0: "sozinho(a)",
    1: "em casal (viagem romântica)",
    2: "em família",
    3: "com amigos"
  };
  return options[value] || "sozinho(a)";
}

// Função auxiliar para obter texto de preferência com verificação de tipo
function getPreferenciaText(value) {
  // Converter para número se for string
  if (typeof value === 'string') {
    value = parseInt(value, 10);
  }
  
  const options = {
    0: "relaxamento e descanso (praias, resorts tranquilos, spas)",
    1: "aventura e atividades ao ar livre (trilhas, esportes, natureza)",
    2: "cultura, história e gastronomia (museus, centros históricos, culinária local)",
    3: "experiência urbana, compras e vida noturna (centros urbanos, lojas, restaurantes)"
  };
  return options[value] || "experiências diversificadas de viagem";
}
