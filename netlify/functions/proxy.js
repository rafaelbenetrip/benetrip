// netlify/functions/proxy.js
const axios = require('axios');
const { OpenAI } = require('openai');

exports.handler = async function(event, context) {
  // Adicionar headers CORS para todas as respostas
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache"
  };

  // Responder a requisições OPTIONS para CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  
  // Apenas permitir requisições POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Método não permitido" })
    };
  }

  try {
    // Log de recebimento (para debugging)
    console.log('Recebendo requisição para proxy de IA');
    
    // Extrair dados da requisição
    const requestData = JSON.parse(event.body);
    console.log('Dados recebidos:', JSON.stringify(requestData).substring(0, 200) + '...');
    
    // Verificar se temos informações suficientes
    if (!requestData) {
      throw new Error("Dados de preferências não fornecidos");
    }
    
    // Gerar prompt adequado baseado nos dados do usuário
    const prompt = gerarPromptParaDestinos(requestData);
    
    // Determinar qual API de IA usar (agora OpenAI como principal)
    let response;
    let formattedResponse;
    
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('Usando API do OpenAI');
        
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        
        const completion = await openai.chat.completions.create({
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
          max_tokens: 2000
        });
        
        formattedResponse = {
          tipo: "openai",
          conteudo: completion.choices[0].message.content
        };
        
        console.log('Resposta da OpenAI recebida com sucesso');
      } catch (openaiError) {
        console.error('Erro na API do OpenAI:', openaiError.message);
        console.error('Detalhes do erro:', openaiError);
        
        // Tentar Claude como fallback se existir a chave
        if (process.env.CLAUDE_API_KEY) {
          console.log('Tentando API do Claude como fallback...');
          
          try {
            const claudeResponse = await axios({
              method: 'post',
              url: 'https://api.anthropic.com/v1/messages',
              headers: {
                'anthropic-api-key': process.env.CLAUDE_API_KEY,
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
              }
            });
            
            formattedResponse = {
              tipo: "claude",
              conteudo: claudeResponse.data.content[0].text
            };
            
            console.log('Resposta do Claude recebida com sucesso como fallback');
          } catch (claudeError) {
            console.error('Erro também na API do Claude:', claudeError.message);
            throw new Error(`OpenAI falhou: ${openaiError.message}, Claude falhou: ${claudeError.message}`);
          }
        } else {
          throw openaiError;
        }
      }
    } else {
      // Dados mockados caso API não esteja disponível - apenas para desenvolvimento
      console.log('API de OpenAI não configurada, usando dados simulados temporariamente');
      
      formattedResponse = {
        tipo: "simulado",
        conteudo: JSON.stringify({
          "topPick": {
            "destino": "Medellín",
            "pais": "Colômbia",
            "codigoPais": "CO",
            "descricao": "Cidade da eterna primavera com clima agradável o ano todo",
            "porque": "Combina natureza exuberante, cultura urbana vibrante e custo-benefício excelente",
            "destaque": "Passeio de teleférico sobre a cidade com vistas incríveis das montanhas",
            "comentario": "Eu simplesmente AMEI Medellín! As paisagens montanhosas e o clima primaveril são perfeitos para qualquer tipo de aventura! 🐾",
            "preco": {
              "voo": 1800,
              "hotel": 200
            }
          },
          "alternativas": [
            {
              "destino": "Lisboa",
              "pais": "Portugal",
              "codigoPais": "PT",
              "porque": "Cidade histórica com arquitetura deslumbrante, gastronomia incrível e facilidade com o idioma",
              "preco": {
                "voo": 3200,
                "hotel": 280
              }
            },
            {
              "destino": "Cidade do México",
              "pais": "México",
              "codigoPais": "MX",
              "porque": "Rica história, culinária famosa mundialmente e ótimo custo-benefício",
              "preco": {
                "voo": 2400,
                "hotel": 190
              }
            },
            {
              "destino": "Buenos Aires",
              "pais": "Argentina",
              "codigoPais": "AR",
              "porque": "Capital cosmopolita com rica vida cultural, teatros e arquitetura europeia",
              "preco": {
                "voo": 1500,
                "hotel": 220
              }
            },
            {
              "destino": "Santiago",
              "pais": "Chile",
              "codigoPais": "CL",
              "porque": "Moderna capital cercada pela Cordilheira dos Andes com excelentes vinhos",
              "preco": {
                "voo": 1650,
                "hotel": 240
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
        })
      };
    }
    
    // Verificar se a resposta é válida
    try {
      console.log('Validando resposta...');
      let jsonContent = extrairJSON(formattedResponse.conteudo);
      
      // Verificar a estrutura básica
      if (!jsonContent.topPick || !Array.isArray(jsonContent.alternativas)) {
        console.warn('Estrutura de JSON inválida na resposta, usando dados mockados');
        jsonContent = JSON.parse(formattedResponse.tipo === "simulado" ? 
          formattedResponse.conteudo : 
          JSON.stringify(getMockData()));
      }
      
      // Adicionar destino surpresa se não estiver presente
      if (!jsonContent.surpresa && jsonContent.alternativas && jsonContent.alternativas.length >= 1) {
        console.log('Destino surpresa não encontrado, criando a partir de alternativa');
        const alternativa = jsonContent.alternativas.length > 4 ? 
          jsonContent.alternativas.pop() : 
          jsonContent.alternativas[0];
        
        jsonContent.surpresa = {
          ...alternativa,
          destaque: alternativa.destaque || alternativa.porque || "Experiência única que vai te surpreender",
          descricao: alternativa.descricao || alternativa.porque || "Um destino surpreendente para explorar",
          comentario: "Este é um destino surpresa especial que farejei só para você! Confie no meu faro! 🐾🎁"
        };
      }
      
      // Garantir exatamente 4 alternativas
      while (jsonContent.alternativas && jsonContent.alternativas.length > 4) {
        jsonContent.alternativas.pop();
      }
      
      // Preencher com alternativas mockadas se necessário
      const mockData = getMockData();
      while (jsonContent.alternativas && jsonContent.alternativas.length < 4) {
        const index = jsonContent.alternativas.length;
        if (mockData.alternativas[index]) {
          jsonContent.alternativas.push(mockData.alternativas[index]);
        } else {
          break;
        }
      }
      
      formattedResponse.conteudo = JSON.stringify(jsonContent);
    } catch (jsonError) {
      console.error('Erro ao validar JSON da resposta:', jsonError);
      
      // Usar dados mockados em caso de erro no parsing
      formattedResponse = {
        tipo: "simulado-error-fallback",
        conteudo: JSON.stringify(getMockData())
      };
    }
    
    console.log('Enviando resposta...');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formattedResponse)
    };
    
  } catch (error) {
    console.error('Erro no proxy da IA:', error);
    
    // Em caso de erro, tentar retornar dados mockados
    try {
      const mockResponse = {
        tipo: "simulado-error",
        conteudo: JSON.stringify(getMockData())
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(mockResponse)
      };
    } catch (mockError) {
      // Se até o fallback falhar, retornar erro
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Erro ao processar solicitação de IA",
          message: error.message
        })
      };
    }
  }
};

// Função para extrair JSON de texto com tratamento de erro melhorado
function extrairJSON(texto) {
  if (!texto) {
    throw new Error('Texto de entrada vazio');
  }
  
  // Se já for objeto, retornar diretamente
  if (typeof texto === 'object') return texto;
  
  try {
    // Tentar extrair JSON diretamente
    return JSON.parse(texto);
  } catch (e) {
    // Tentar extrair JSON de dentro do texto
    try {
      // Buscar o texto entre as primeiras chaves abertas e fechadas balanceadas
      let depth = 0;
      let start = -1;
      
      for (let i = 0; i < texto.length; i++) {
        if (texto[i] === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (texto[i] === '}') {
          depth--;
          if (depth === 0 && start !== -1) {
            const jsonStr = texto.substring(start, i + 1);
            return JSON.parse(jsonStr);
          }
        }
      }
      
      // Tentar regex como último recurso
      const match = texto.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      
      throw new Error('Não foi possível encontrar estrutura JSON no texto');
    } catch (innerError) {
      console.error('Erro ao extrair JSON do texto:', innerError);
      throw new Error('Não foi possível extrair JSON válido da resposta');
    }
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

// Função para dados mockados de fallback
function getMockData() {
  return {
    "topPick": {
      "destino": "Medellín",
      "pais": "Colômbia",
      "codigoPais": "CO",
      "descricao": "Cidade da eterna primavera com clima agradável o ano todo",
      "porque": "Combina natureza exuberante, cultura urbana vibrante e custo-benefício excelente",
      "destaque": "Passeio de teleférico sobre a cidade com vistas incríveis das montanhas",
      "comentario": "Eu simplesmente AMEI Medellín! As paisagens montanhosas e o clima primaveril são perfeitos para qualquer tipo de aventura! 🐾",
      "preco": {
        "voo": 1800,
        "hotel": 200
      }
    },
    "alternativas": [
      {
        "destino": "Lisboa",
        "pais": "Portugal",
        "codigoPais": "PT",
        "porque": "Cidade histórica com arquitetura deslumbrante, gastronomia incrível e facilidade com o idioma",
        "preco": {
          "voo": 3200,
          "hotel": 280
        }
      },
      {
        "destino": "Cidade do México",
        "pais": "México",
        "codigoPais": "MX",
        "porque": "Rica história, culinária famosa mundialmente e ótimo custo-benefício",
        "preco": {
          "voo": 2400,
          "hotel": 190
        }
      },
      {
        "destino": "Buenos Aires",
        "pais": "Argentina",
        "codigoPais": "AR",
        "porque": "Capital cosmopolita com rica vida cultural, teatros e arquitetura europeia",
        "preco": {
          "voo": 1500,
          "hotel": 220
        }
      },
      {
        "destino": "Santiago",
        "pais": "Chile",
        "codigoPais": "CL",
        "porque": "Moderna capital cercada pela Cordilheira dos Andes com excelentes vinhos",
        "preco": {
          "voo": 1650,
          "hotel": 240
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
}
