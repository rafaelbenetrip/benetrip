// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
const axios = require('axios');

// Aumentar o timeout para 50 segundos (dentro do limite de 60s do Vercel PRO)
const REQUEST_TIMEOUT = 50000;

module.exports = async function handler(req, res) {
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
    
    // Tenta usar cada serviço de IA em sequência até obter sucesso
    let response = null;
    
    // Tentar Perplexity primeiro se estiver configurado
    if (process.env.PERPLEXITY_API_KEY) {
      try {
        console.log('Chamando API Perplexity...');
        response = await callPerplexityAPI(prompt);
        console.log('Resposta Perplexity recebida com sucesso');
        
        return res.status(200).json({
          tipo: "perplexity",
          conteudo: response
        });
      } catch (perplexityError) {
        console.error('Erro ao usar Perplexity:', perplexityError.message);
        // Continuar para o próximo método, não retornando aqui
      }
    }
    
    // Tentar OpenAI em seguida, se configurado
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('Tentando OpenAI como fallback...');
        response = await callOpenAIAPI(prompt);
        console.log('Resposta OpenAI recebida com sucesso');
        
        return res.status(200).json({
          tipo: "openai",
          conteudo: response
        });
      } catch (openaiError) {
        console.error('Erro ao usar OpenAI:', openaiError.message);
        // Continuar para o próximo método
      }
    }
    
    // Tentar Claude como última opção de IA
    if (process.env.CLAUDE_API_KEY) {
      try {
        console.log('Tentando Claude como fallback final...');
        response = await callClaudeAPI(prompt);
        console.log('Resposta Claude recebida com sucesso');
        
        return res.status(200).json({
          tipo: "claude",
          conteudo: response
        });
      } catch (claudeError) {
        console.error('Erro ao usar Claude:', claudeError.message);
        // Se todas as opções falharem, usar o mockado
      }
    }
    
    // Se chegou aqui, todas as opções de IA falharam, usar mockado
    console.log('Todos os serviços de IA falharam, retornando dados mockados');
    return res.status(200).json({
      tipo: "mockado",
      conteudo: JSON.stringify(mockData)
    });
    
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
    
    // Definição simplificada do schema para usar formato text
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
            content: 'Você é a Tripinha, uma cachorra vira-lata caramelo especialista em viagens da Benetrip. Você usa um tom amigável, alegre e entusiasmado. Você conhece sobre destinos turísticos em todo o mundo e pode recomendar lugares baseados nas preferências dos usuários. Responda APENAS em formato JSON válido, sem qualquer texto adicional.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        // Simplificando para usar text sem estrutura de json_schema
        response_format: { type: "text" }
      },
      timeout: REQUEST_TIMEOUT
    });
    
    // Verificar se a resposta contém o conteúdo esperado
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message || !response.data.choices[0].message.content) {
      console.error('Resposta Perplexity incompleta:', JSON.stringify(response.data).substring(0, 200));
      throw new Error('Formato de resposta da Perplexity inválido');
    }
    
    // Tentar extrair o JSON da resposta de texto
    const content = response.data.choices[0].message.content;
    return extrairJSONDaResposta(content);
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
    
    // Modificar o prompt para pedir explicitamente resposta em JSON
    const jsonPrompt = `${prompt}\n\nIMPORTANTE: Sua resposta deve ser exclusivamente um objeto JSON válido, sem nenhum texto adicional.`;
    
    const response = await axios({
      method: 'post',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: "gpt-4-turbo",  // Modelo mais rápido
        messages: [
          {
            role: "system",
            content: "Você é a Tripinha, uma cachorra vira-lata caramelo especialista em viagens da Benetrip. Você deve retornar somente JSON válido, sem texto adicional."
          },
          {
            role: "user",
            content: jsonPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      },
      timeout: REQUEST_TIMEOUT
    });
    
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message || !response.data.choices[0].message.content) {
      throw new Error('Formato de resposta da OpenAI inválido');
    }
    
    // Extrair JSON da resposta
    const content = response.data.choices[0].message.content;
    return extrairJSONDaResposta(content);
  } catch (error) {
    console.error('Erro detalhado na chamada à API OpenAI:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', JSON.stringify(error.response.data).substring(0, 200));
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
    
    // Adicionar instrução específica para o Claude retornar apenas JSON
    const jsonPrompt = `${prompt}\n\nIMPORTANTE: Sua resposta deve ser APENAS o objeto JSON, sem NENHUM texto adicional antes ou depois. Não inclua marcação de código, comentários ou explicações.`;
    
    const response = await axios({
      method: 'post',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'anthropic-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      data: {
        model: "claude-3-haiku-20240307",  // Modelo mais rápido
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content: "Você é a Tripinha, uma cachorra vira-lata caramelo especialista em viagens da Benetrip. Responda apenas com JSON puro, sem texto adicional."
          },
          {
            role: "user",
            content: jsonPrompt
          }
        ]
      },
      timeout: REQUEST_TIMEOUT
    });
    
    if (!response.data || !response.data.content || !response.data.content[0] || !response.data.content[0].text) {
      throw new Error('Formato de resposta do Claude inválido');
    }
    
    // Extrair JSON da resposta
    const content = response.data.content[0].text;
    return extrairJSONDaResposta(content);
  } catch (error) {
    console.error('Erro detalhado na chamada à API Claude:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', JSON.stringify(error.response.data).substring(0, 200));
    }
    
    throw error;
  }
}

// Função para extrair JSON válido de uma string de texto
function extrairJSONDaResposta(texto) {
  try {
    // Tentar analisar diretamente, assumindo que é um JSON completo
    try {
      return JSON.parse(texto);
    } catch (e) {
      // Se falhar, tente encontrar o JSON dentro da string
      const jsonPattern = /\{[\s\S]*\}/;
      const match = texto.match(jsonPattern);
      
      if (match && match[0]) {
        // Tentar analisar o JSON extraído
        const parsedJson = JSON.parse(match[0]);
        return match[0]; // Retorna como string para manter compatibilidade
      }
      
      // Se não conseguir encontrar um JSON válido, limpe e adapte a string
      const limpo = texto
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      
      // Tenta analisar a string limpa
      JSON.parse(limpo); // Isso vai lançar erro se não for um JSON válido
      return limpo;
    }
  } catch (error) {
    console.error('Erro ao extrair JSON:', error);
    // Se todas as tentativas falharem, retorne a string original
    // Isso permite que o sistema decida como lidar com o formato
    return texto;
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
  return `Quero recomendações de viagem com estas preferências:
- Partindo de: ${cidadeOrigem}
- Viajando: ${companhia}
- Buscando: ${preferencia}
- Orçamento: ${orcamento} ${moeda}
- Período: ${dataIda} a ${dataVolta}

Forneça EXATAMENTE este formato JSON, sem texto adicional:
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão principal para visitar",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Um comentário animado da Tripinha",
    "preco": {
      "voo": número,
      "hotel": número
    }
  },
  "alternativas": [
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
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão principal para visitar",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Um comentário da Tripinha",
    "preco": {
      "voo": número,
      "hotel": número
    }
  }
}`;
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
