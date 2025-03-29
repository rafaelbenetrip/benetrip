// api/recommendations.js
import { OpenAI } from 'openai';
import axios from 'axios';

export default async function handler(req, res) {
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
    console.log('Recebendo requisição para recomendações');
    
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
    
    let responseData;
    
    // Tentar usar OpenAI primeiro
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('Usando OpenAI para recomendações');
        
        // Inicializar a API OpenAI
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        
        console.log('Enviando requisição para OpenAI...');
        
        // Fazer a chamada para a API da OpenAI
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
          max_tokens: 4000
        });
        
        console.log('Resposta recebida da OpenAI');
        
        responseData = {
          tipo: "openai",
          conteudo: completion.choices[0].message.content
        };
      } catch (openaiError) {
        console.error('Erro ao usar OpenAI:', openaiError);
        
        // Tentar Claude como fallback
        if (process.env.CLAUDE_API_KEY) {
          try {
            console.log('Tentando usar Claude como fallback');
            
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
            
            console.log('Resposta recebida do Claude');
            
            responseData = {
              tipo: "claude",
              conteudo: claudeResponse.data.content[0].text
            };
          } catch (claudeError) {
            console.error('Erro ao usar Claude como fallback:', claudeError);
            
            // Usar dados mockados se ambas as APIs falharem
            responseData = {
              tipo: "mockado",
              conteudo: JSON.stringify(mockData)
            };
          }
        } else {
          // Sem Claude API Key, usar dados mockados
          responseData = {
            tipo: "mockado",
            conteudo: JSON.stringify(mockData)
          };
        }
      }
    } else if (process.env.CLAUDE_API_KEY) {
      // Se não tiver OpenAI mas tiver Claude
      try {
        console.log('Usando Claude para recomendações');
        
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
        
        console.log('Resposta recebida do Claude');
        
        responseData = {
          tipo: "claude",
          conteudo: claudeResponse.data.content[0].text
        };
      } catch (claudeError) {
        console.error('Erro ao usar Claude:', claudeError);
        
        // Usar dados mockados se Claude falhar
        responseData = {
          tipo: "mockado",
          conteudo: JSON.stringify(mockData)
        };
      }
    } else {
      // Se não tiver API keys, usar dados mockados
      console.log('Sem API keys configuradas, usando dados mockados');
      
      responseData = {
        tipo: "mockado",
        conteudo: JSON.stringify(mockData)
      };
    }
    
    // Validar a resposta para garantir formato JSON correto
    try {
      const jsonContent = extrairJSON(responseData.conteudo);
      console.log('JSON extraído com sucesso');
    } catch (jsonError) {
      console.error('Erro ao extrair JSON da resposta:', jsonError);
      responseData.conteudo = JSON.stringify(mockData);
      responseData.tipo = "mockado-json-erro";
    }
    
    // Retornar a resposta formatada
    return res.status(200).json(responseData);
    
  } catch (error) {
    console.error('Erro na API de recomendações:', error);
    
    return res.status(500).json({ 
      error: "Erro ao processar solicitação de IA",
      message: error.message
    });
  }
}

// Função para extrair JSON de texto, lidando com diferentes formatos
function extrairJSON(texto) {
  // Se já for um objeto, retornar diretamente
  if (texto && typeof texto === 'object') {
    return texto;
  }
  
  // Primeiro, tenta fazer parse direto
  try {
    return JSON.parse(texto);
  } catch (e) {
    console.log('Erro ao fazer parse direto, tentando extrair do texto');
    
    // Se falhar, tenta extrair JSON de bloco de código ou texto
    try {
      // Busca por blocos de código JSON
      const blocoCodigo = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (blocoCodigo && blocoCodigo[1]) {
        const jsonLimpo = blocoCodigo[1].trim();
        console.log('JSON extraído de bloco de código', jsonLimpo.substring(0, 100) + '...');
        return JSON.parse(jsonLimpo);
      }
      
      // Busca pela primeira ocorrência de chaves balanceadas
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
            console.log('JSON extraído do texto usando análise de profundidade');
            return JSON.parse(jsonStr);
          }
        }
      }
      
      // Último recurso: busca por regex simples
      const match = texto.match(/(\{[\s\S]*\})/);
      if (match && match[0]) {
        const jsonPotencial = match[0];
        console.log('JSON extraído de texto usando regex');
        return JSON.parse(jsonPotencial);
      }
      
      throw new Error('Não foi possível extrair JSON válido da resposta');
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
