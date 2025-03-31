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
    
    // Gerar prompt baseado nos dados do usuário
    let prompt;
    try {
      prompt = gerarPromptParaDestinos(requestData);
      console.log('Prompt gerado com sucesso, tamanho:', prompt.length);
    } catch (promptError) {
      console.error('Erro ao gerar prompt:', promptError);
      prompt = "Recomende destinos de viagem únicos e personalizados para o Brasil e mundo. Um destino principal, 4 destinos alternativos diferentes entre si, e um destino surpresa diferente dos demais. Seja criativo e evite destinos óbvios ou repetidos. Responda em formato JSON.";
    }
    
    // Estratégia de múltiplas tentativas com diferentes variações de prompt
    const maxTentativas = 5; // Aumentado para 5 tentativas
    let tentativas = 0;
    
    // Array de variações de prompt para promover diversidade nas tentativas subsequentes
    const promptVariations = [
      "", // Primeira tentativa com o prompt original
      "\n\nIMPORTANTE: Sugira destinos CRIATIVOS e ÚNICOS. Faça um misto entre destinos alternativos e menos óbvios e destinos conhecidos, sempre adequando às preferências indicadas.",
      "\n\nIMPORTANTE: Seja criativo e evite destinos comuns como Santiago, Cusco, Buenos Aires ou Montevidéu. Forneça opções em diferentes continentes e alternativas variadas.",
      "\n\nIMPORTANTE: Surpreenda com destinos fora do comum que realmente despertem interesse. Sugira lugares desconhecidos pela maioria dos viajantes mas com excelente infraestrutura turística.",
      "\n\nIMPORTANTE: Foque exclusivamente em destinos incomuns e surpreendentes, evitando completamente os mais populares. Busque joias escondidas que poucos conhecem."
    ];
    
    while (tentativas < maxTentativas) {
      // Construir o prompt atual com uma das variações para estimular diferentes respostas
      const currentPromptVariation = promptVariations[Math.min(tentativas, promptVariations.length - 1)];
      const currentPrompt = `${prompt}${currentPromptVariation}`;
      
      console.log(`Tentativa ${tentativas + 1} de ${maxTentativas}`);
      
      // 1. Tentar Perplexity primeiro
      if (process.env.PERPLEXITY_API_KEY) {
        try {
          console.log('Chamando API Perplexity...');
          const response = await callPerplexityAPI(currentPrompt);
          if (response && isValidDestinationJSON(response)) {
            console.log('Resposta Perplexity válida recebida');
            return res.status(200).json({
              tipo: "perplexity",
              conteudo: response,
              tentativa: tentativas + 1
            });
          } else {
            console.log('Resposta Perplexity inválida ou incompleta, tentando próxima API');
          }
        } catch (perplexityError) {
          console.error('Erro ao usar Perplexity:', perplexityError.message);
        }
      }
      
      // 2. Tentar OpenAI em seguida
      if (process.env.OPENAI_API_KEY) {
        try {
          console.log('Chamando API OpenAI...');
          const response = await callOpenAIAPI(currentPrompt);
          if (response && isValidDestinationJSON(response)) {
            console.log('Resposta OpenAI válida recebida');
            return res.status(200).json({
              tipo: "openai",
              conteudo: response,
              tentativa: tentativas + 1
            });
          } else {
            console.log('Resposta OpenAI inválida ou incompleta, tentando próxima API');
          }
        } catch (openaiError) {
          console.error('Erro ao usar OpenAI:', openaiError.message);
        }
      }
      
      // 3. Tentar Claude por último
      if (process.env.CLAUDE_API_KEY) {
        try {
          console.log('Chamando API Claude...');
          const response = await callClaudeAPI(currentPrompt);
          if (response && isValidDestinationJSON(response)) {
            console.log('Resposta Claude válida recebida');
            return res.status(200).json({
              tipo: "claude",
              conteudo: response,
              tentativa: tentativas + 1
            });
          } else {
            console.log('Resposta Claude inválida ou incompleta');
          }
        } catch (claudeError) {
          console.error('Erro ao usar Claude:', claudeError.message);
        }
      }
      
      // Incrementar tentativas e aplicar um pequeno delay antes da próxima rodada
      tentativas++;
      
      // Aplicar um delay crescente entre tentativas (backoff exponencial)
      if (tentativas < maxTentativas) {
        const delayMs = Math.min(1000 * Math.pow(2, tentativas - 1), 8000); // Máximo de 8 segundos
        console.log(`Aguardando ${delayMs}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // Se chegamos aqui, todas as tentativas falharam
    console.log('Todas as tentativas de obter resposta válida falharam');
    
    // Fazer uma última tentativa com um prompt drasticamente simplificado
    try {
      const simplifiedPrompt = `Forneça recomendações de destinos de viagem em formato JSON válido. Inclua no mínimo:
      {
        "topPick": {
          "destino": "Nome da Cidade",
          "pais": "Nome do País",
          "descricao": "Breve descrição",
          "preco": { "voo": 1000, "hotel": 200 }
        },
        "alternativas": [
          {
            "destino": "Nome da Cidade",
            "pais": "Nome do País",
            "preco": { "voo": 1000, "hotel": 200 }
          }
        ],
        "surpresa": {
          "destino": "Nome da Cidade",
          "pais": "Nome do País",
          "descricao": "Breve descrição",
          "preco": { "voo": 1000, "hotel": 200 }
        }
      }`;
      
      console.log('Fazendo tentativa final com prompt simplificado');
      
      // Tentar cada serviço uma vez mais com o prompt simplificado
      let finalResponse = null;
      
      if (process.env.PERPLEXITY_API_KEY) {
        finalResponse = await callPerplexityAPI(simplifiedPrompt);
      }
      
      if (!finalResponse && process.env.OPENAI_API_KEY) {
        finalResponse = await callOpenAIAPI(simplifiedPrompt);
      }
      
      if (!finalResponse && process.env.CLAUDE_API_KEY) {
        finalResponse = await callClaudeAPI(simplifiedPrompt);
      }
      
      if (finalResponse) {
        return res.status(200).json({
          tipo: "simplificado",
          conteudo: finalResponse,
          message: "Resposta obtida com prompt simplificado após falhas"
        });
      }
    } catch (finalError) {
      console.error('Erro na tentativa final:', finalError);
    }
    
    // Se ainda não temos resposta, retornar erro
    return res.status(500).json({
      erro: "Falha ao obter recomendações de destino",
      message: "Não foi possível gerar recomendações de viagem após múltiplas tentativas."
    });
    
  } catch (globalError) {
    // Captura qualquer erro não tratado para evitar o 500
    console.error('Erro global na API de recomendações:', globalError);
    
    // Retornar resposta de erro clara
    return res.status(500).json({ 
      erro: "Erro interno no serviço de recomendações",
      message: globalError.message
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
    
    // Construir instruções claras para não usar formatação markdown
    const enhancedPrompt = `${prompt}\n\nIMPORTANTE: NÃO inclua blocos de código, marcadores markdown, ou comentários em sua resposta. Retorne APENAS o JSON puro.`;
    
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
            content: 'Você é um especialista em viagens focado em fornecer recomendações altamente personalizadas. Evite sugerir destinos populares ou óbvios. Gere sugestões completamente diferentes uma das outras, criativas e adequadas ao perfil do viajante. Retorne APENAS JSON puro, sem marcações ou formatação extra.'
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.9, // Aumentando a temperatura para mais criatividade
        max_tokens: 3000,
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
    console.log('Conteúdo recebido da API Perplexity (primeiros 200 caracteres):', content.substring(0, 200));
    
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

// Chamar a API da OpenAI como alternativa
async function callOpenAIAPI(prompt) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave da API OpenAI não configurada');
    }
    
    console.log('Enviando requisição para OpenAI...');
    
    // Modificar o prompt para pedir explicitamente resposta em JSON
    const enhancedPrompt = `${prompt}\n\nIMPORTANTE: Sua resposta deve ser exclusivamente um objeto JSON válido sem formatação markdown. NÃO inclua blocos de código, comentários ou texto adicional.`;
    
    const response = await axios({
      method: 'post',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em viagens focado em fornecer recomendações altamente personalizadas e criativas. Gere sugestões diversas uma das outras e adequadas ao perfil do viajante. Retorne APENAS JSON puro, sem formatação extra."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        temperature: 0.9, // Aumentando a temperatura para mais criatividade
        max_tokens: 3000,
        response_format: { "type": "json_object" } // Forçar formato JSON na resposta
      },
      timeout: REQUEST_TIMEOUT
    });
    
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message || !response.data.choices[0].message.content) {
      throw new Error('Formato de resposta da OpenAI inválido');
    }
    
    // Extrair JSON da resposta
    const content = response.data.choices[0].message.content;
    console.log('Conteúdo recebido da API OpenAI (primeiros 200 caracteres):', content.substring(0, 200));
    
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

// Chamar a API do Claude como alternativa final
async function callClaudeAPI(prompt) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    console.log('Enviando requisição para Claude...');
    
    // Adicionar instrução específica para o Claude retornar apenas JSON
    const enhancedPrompt = `${prompt}\n\nIMPORTANTE: Sua resposta deve ser APENAS o objeto JSON válido, sem NENHUM texto adicional, marcação de código, comentários ou explicações.`;
    
    const response = await axios({
      method: 'post',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'anthropic-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      data: {
        model: "claude-3-haiku-20240307",
        max_tokens: 3000,
        messages: [
          {
            role: "system",
            content: "Você é um especialista em viagens focado em fornecer recomendações altamente personalizadas e criativas. Gere sugestões diversas e adequadas ao perfil do viajante. Retorne APENAS JSON puro."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        temperature: 0.9 // Aumentando a temperatura para mais criatividade
      },
      timeout: REQUEST_TIMEOUT
    });
    
    if (!response.data || !response.data.content || !response.data.content[0] || !response.data.content[0].text) {
      throw new Error('Formato de resposta do Claude inválido');
    }
    
    // Extrair JSON da resposta
    const content = response.data.content[0].text;
    console.log('Conteúdo recebido da API Claude (primeiros 200 caracteres):', content.substring(0, 200));
    
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

// Função aprimorada para extrair JSON válido de uma string de texto
function extrairJSONDaResposta(texto) {
  try {
    // Registrar o formato do texto para diagnóstico
    console.log("Tipo da resposta recebida:", typeof texto);
    console.log("Tamanho da resposta recebida:", texto.length);
    
    // Verificar se já é um objeto JSON
    if (typeof texto === 'object' && texto !== null) {
      console.log("Resposta já é um objeto, convertendo para string");
      return JSON.stringify(texto);
    }
    
    // Primeira tentativa: Analisar diretamente se for um JSON limpo
    try {
      const parsed = JSON.parse(texto);
      console.log("JSON analisado com sucesso no primeiro método");
      return JSON.stringify(parsed); 
    } catch (e) {
      console.log("Primeira tentativa falhou, tentando métodos alternativos");
      // Continuar com os outros métodos
    }
    
    // Pré-processar o texto para remover problemas comuns
    let textoProcessado = texto
      // Remover blocos de código markdown
      .replace(/```json/g, '')
      .replace(/```/g, '')
      // Remover comentários de estilo JavaScript
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Normalizar quebras de linha e espaços extras
      .replace(/\r\n/g, '\n')
      .trim();
    
    // Tentar encontrar um objeto JSON usando regex mais preciso
    const jsonRegex = /(\{[\s\S]*\})/;
    const match = textoProcessado.match(jsonRegex);
    
    if (match && match[0]) {
      try {
        // Tentar analisar o texto extraído
        const possibleJson = match[0];
        const parsed = JSON.parse(possibleJson);
        console.log("JSON extraído e analisado com sucesso via regex");
        return JSON.stringify(parsed);
      } catch (regexError) {
        console.log("Falha na extração via regex:", regexError.message);
      }
    } else {
      console.log("Nenhum padrão JSON encontrado no texto processado");
    }
    
    // Se todas as tentativas falharem, retornar null para tentar outro serviço
    console.log("Todas as tentativas de extração falharam");
    return null;
  } catch (error) {
    console.error('Erro fatal ao processar resposta:', error);
    return null;
  }
}

// Verifica se o objeto JSON recebido é válido para nosso contexto
function isValidDestinationJSON(jsonString) {
  if (!jsonString) return false;
  
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    
    // Verificar se tem os campos obrigatórios
    if (!data.topPick || !data.alternativas || !data.surpresa) {
      console.log("JSON inválido: faltam campos obrigatórios");
      return false;
    }
    
    // Verificar se tem pelo menos um destino alternativo
    if (!Array.isArray(data.alternativas) || data.alternativas.length < 1) {
      console.log("JSON inválido: array de alternativas vazio ou inexistente");
      return false;
    }
    
    // Verificar se os destinos principais têm os campos necessários
    if (!data.topPick.destino || !data.topPick.pais || !data.topPick.preco) {
      console.log("JSON inválido: topPick incompleto");
      return false;
    }
    
    // Verificar se o destino surpresa tem os campos necessários
    if (!data.surpresa.destino || !data.surpresa.pais || !data.surpresa.preco) {
      console.log("JSON inválido: surpresa incompleto");
      return false;
    }
    
    // Verificar se não é um caso de destinos repetidos como Santiago e Cusco
    const destinos = [
      data.topPick.destino,
      ...data.alternativas.map(alt => alt.destino),
      data.surpresa.destino
    ].map(d => d.toLowerCase());
    
    // Verificar se não tem os destinos que estão se repetindo nos resultados
    const problemDestinos = ['santiago', 'cusco', 'buenos aires', 'montevidéu', 'montevideo'];
    const repetidos = destinos.filter(d => problemDestinos.includes(d));
    
    if (repetidos.length >= 2) {
      console.log(`JSON tem destinos problemáticos repetidos: ${repetidos.join(', ')}`);
      return false;
    }
    
    // Verificar se há destinos repetidos em geral
    const destSet = new Set(destinos);
    if (destSet.size < destinos.length) {
      console.log("JSON tem destinos repetidos");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Erro ao validar JSON:", error);
    return false;
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
  
  // Extrair informações sobre quantidade de pessoas
  const quantidadePessoas = dados.quantidade_familia || dados.quantidade_amigos || 1;
  
  // Extrair qualquer informação adicional importante
  const conheceDestino = dados.conhece_destino || 0;
  const tipoDestino = dados.tipo_destino || 'qualquer';
  const famaDestino = dados.fama_destino || 'qualquer';
  
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
  
  // Calcular duração da viagem para contextualizar melhor
  let duracaoViagem = 'não especificada';
  try {
    if (dataIda !== 'não especificada' && dataVolta !== 'não especificada') {
      const ida = new Date(dataIda);
      const volta = new Date(dataVolta);
      const diff = Math.abs(volta - ida);
      const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
      duracaoViagem = `${dias} dias`;
    }
  } catch (e) {
    console.log("Erro ao calcular duração da viagem:", e);
  }

  // Construir prompt detalhado e personalizado
  return `Crie recomendações de viagem CRIATIVAS e ÚNICAS para:

PERFIL DO VIAJANTE:
- Partindo de: ${cidadeOrigem}
- Viajando: ${companhia}
- Número de pessoas: ${quantidadePessoas}
- Atividades preferidas: ${preferencia}
- Orçamento por pessoa: ${orcamento} ${moeda}
- Período da viagem: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Experiência como viajante: ${conheceDestino === 1 ? 'Com experiência' : 'Iniciante'} 
- Preferência por destinos: ${getTipoDestinoText(tipoDestino)}
- Popularidade do destino: ${getFamaDestinoText(famaDestino)}

IMPORTANTE:
1. Sugira destinos DIVERSOS e CRIATIVOS que combinem bem com o perfil.
2. Destinos DEVEM ser DIFERENTES entre si e necessitar de uma viagem de avião.
3. O destino principal, alternativas e surpresa DEVEM ser de locais DISTINTOS.

Forneça no formato JSON exato abaixo, SEM formatação markdown:
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão específica para visitar baseada nas preferências",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário entusiasmado da Tripinha (cachorra)",
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
      "porque": "Razão específica para visitar",
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
    "porque": "Razão para visitar, destacando o fator surpresa",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário entusiasmado da Tripinha",
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

// Função auxiliar para obter texto de tipo de destino
function getTipoDestinoText(value) {
  // Converter para número se for string
  if (typeof value === 'string') {
    value = parseInt(value, 10);
  }
  
  const options = {
    0: "nacional",
    1: "internacional",
    2: "qualquer (nacional ou internacional)"
  };
  return options[value] || "qualquer";
}

// Função auxiliar para obter texto de fama do destino
function getFamaDestinoText(value) {
  // Converter para número se for string
  if (typeof value === 'string') {
    value = parseInt(value, 10);
  }
  
  const options = {
    0: "famoso e turístico",
    1: "fora do circuito turístico comum",
    2: "mistura de ambos"
  };
  return options[value] || "qualquer";
}
