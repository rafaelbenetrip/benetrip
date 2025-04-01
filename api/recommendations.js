// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
const axios = require('axios');

// Configurações de timeout e limites
const REQUEST_TIMEOUT = 50000; // 50 segundos para requisições externas
const HANDLER_TIMEOUT = 55000; // 55 segundos para processamento total

module.exports = async function handler(req, res) {
  // Implementar mecanismo de timeout no servidor
  let isResponseSent = false;
  const serverTimeout = setTimeout(() => {
    if (!isResponseSent) {
      isResponseSent = true;
      console.log('Timeout do servidor atingido, enviando resposta de emergência');
      
      // Gerar dados de emergência e responder
      const emergencyData = generateEmergencyData(req.body);
      return res.status(200).json({
        tipo: "emergencia-timeout",
        conteudo: JSON.stringify(emergencyData),
        message: "Timeout do servidor"
      });
    }
  }, HANDLER_TIMEOUT);

  // Configuração de CORS para qualquer origem
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=60');
  
  // Lidar com requisições OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(200).end();
    }
    return;
  }
  
  // Apenas permitir requisições POST
  if (req.method !== 'POST') {
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(405).json({ error: "Método não permitido" });
    }
    return;
  }

  // Criar um wrapper global para toda a lógica
  try {
    // Verificar se existe corpo na requisição
    if (!req.body) {
      console.error('Corpo da requisição vazio');
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(400).json({ error: "Nenhum dado fornecido na requisição" });
      }
      return;
    }
    
    // Extrair dados da requisição com verificação extra
    let requestData;
    try {
      requestData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      console.log('Dados recebidos processados com sucesso');
    } catch (parseError) {
      console.error('Erro ao processar corpo da requisição:', parseError);
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(400).json({ error: "Formato de dados inválido", details: parseError.message });
      }
      return;
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
      prompt = "Recomende destinos de viagem únicos e personalizados para o Brasil e mundo. Um destino principal com 2 pontos turísticos, 4 destinos alternativos diferentes com 1 ponto turístico cada, e um destino surpresa com 2 pontos turísticos. Priorize URGENTEMENTE respeitar o orçamento máximo para voos. Inclua atrações turísticas específicas e conhecidas para cada destino. Responda em formato JSON.";
    }
    
    // Tentar múltiplas vezes a consulta à API com diferentes modelos
    // até um deles retornar uma resposta válida
    let tentativas = 0;
    const maxTentativas = 3;
    while (tentativas < maxTentativas) {
      tentativas++;
      console.log(`Tentativa ${tentativas} de ${maxTentativas}`);
      
      // 1. Tentar Perplexity primeiro
      if (process.env.PERPLEXITY_API_KEY) {
        try {
          console.log('Chamando API Perplexity...');
          const response = await callPerplexityAPI(prompt, requestData);
          
          // Pós-processamento para garantir pontos turísticos e comentários
          let processedResponse = response;
          if (response && isPartiallyValidJSON(response)) {
            processedResponse = ensureTouristAttractionsAndComments(response, requestData);
          }
          
          if (processedResponse && isValidDestinationJSON(processedResponse, requestData)) {
            console.log('Resposta Perplexity válida recebida');
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: "perplexity",
                conteudo: processedResponse,
                tentativa: tentativas
              });
            }
            return;
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
          const response = await callOpenAIAPI(prompt, requestData);
          
          // Pós-processamento para garantir pontos turísticos e comentários
          let processedResponse = response;
          if (response && isPartiallyValidJSON(response)) {
            processedResponse = ensureTouristAttractionsAndComments(response, requestData);
          }
          
          if (processedResponse && isValidDestinationJSON(processedResponse, requestData)) {
            console.log('Resposta OpenAI válida recebida');
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: "openai",
                conteudo: processedResponse,
                tentativa: tentativas
              });
            }
            return;
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
          const response = await callClaudeAPI(prompt, requestData);
          
          // Pós-processamento para garantir pontos turísticos e comentários
          let processedResponse = response;
          if (response && isPartiallyValidJSON(response)) {
            processedResponse = ensureTouristAttractionsAndComments(response, requestData);
          }
          
          if (processedResponse && isValidDestinationJSON(processedResponse, requestData)) {
            console.log('Resposta Claude válida recebida');
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: "claude",
                conteudo: processedResponse,
                tentativa: tentativas
              });
            }
            return;
          } else {
            console.log('Resposta Claude inválida ou incompleta');
          }
        } catch (claudeError) {
          console.error('Erro ao usar Claude:', claudeError.message);
        }
      }
      
      // Se chegamos aqui, todas as tentativas falharam nesta iteração
      // Vamos modificar o prompt para a próxima tentativa para incentivar mais criatividade
      prompt = `${prompt}\n\nURGENTE: O ORÇAMENTO MÁXIMO para voos (${requestData.orcamento_valor || 'informado'} ${requestData.moeda_escolhida || 'BRL'}) precisa ser RIGOROSAMENTE RESPEITADO. TODOS os destinos devem ter voos COM VALOR ABAIXO desse orçamento. Forneça um mix de destinos populares e alternativos, todos com preços realistas e acessíveis. Inclua PONTOS TURÍSTICOS ESPECÍFICOS e DETALHADOS para cada destino. COMENTÁRIOS DA TRIPINHA DEVEM mencionar pelo menos UM PONTO TURÍSTICO ESPECÍFICO de forma natural e entusiasmada.`;
    }
    
    // Se todas as tentativas falharam, criar uma resposta de emergência
    console.log('Todas as tentativas de obter resposta válida falharam');
    
    // Usar dados de emergência personalizados
    const emergencyData = generateEmergencyData(requestData);
    
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(200).json({
        tipo: "emergencia",
        conteudo: JSON.stringify(emergencyData),
        message: "Todas as tentativas de API falharam"
      });
    }
    
  } catch (globalError) {
    // Captura qualquer erro não tratado para evitar o 500
    console.error('Erro global na API de recomendações:', globalError);
    
    // Retornar resposta de erro com dados de emergência
    const emergencyData = generateEmergencyData(req.body);
    
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(200).json({ 
        tipo: "erro",
        conteudo: JSON.stringify(emergencyData),
        error: globalError.message
      });
    }
  } finally {
    // Garantir que o timeout é limpo mesmo se não enviamos resposta
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      // Se por algum motivo não enviamos nenhuma resposta ainda
      res.status(500).json({
        tipo: "erro",
        message: "Erro interno no servidor"
      });
    }
  }
}

// Validação parcial para verificação rápida
function isPartiallyValidJSON(jsonString) {
  if (!jsonString) return false;
  
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    return data && (data.topPick || data.alternativas || data.surpresa);
  } catch (error) {
    return false;
  }
}

// Chamar a API da Perplexity com melhor tratamento de erros
async function callPerplexityAPI(prompt, requestData) {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave da API Perplexity não configurada');
    }
    
    console.log('Enviando requisição para Perplexity...');
    
    // Reforçar a mensagem sobre orçamento como prioridade absoluta e pontos turísticos
    const orcamentoMessage = requestData.orcamento_valor ? 
      `\n\n⚠️ ORÇAMENTO MÁXIMO: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'} para voos (ida e volta por pessoa). Todos os destinos DEVEM ter preços de voo ABAIXO deste valor. Este é o requisito MAIS IMPORTANTE.` : '';
    
    // Destaque explícito sobre comentários da Tripinha com pontos turísticos
    const enhancedPrompt = `${prompt}${orcamentoMessage}\n\nIMPORTANTE: 
    1. Cada voo DEVE respeitar rigorosamente o orçamento máximo indicado.
    2. Retorne APENAS o JSON puro, sem marcação markdown ou comentários.
    3. Forneça EXATAMENTE 4 destinos alternativos totalmente diferentes entre si.
    4. Garanta preços realistas e acessíveis para todas as recomendações.
    5. Inclua PONTOS TURÍSTICOS ESPECÍFICOS para cada destino - 2 para o destino principal e destino surpresa, 1 para cada alternativa.
    6. Os comentários da Tripinha DEVEM mencionar de forma natural e entusiasmada PELO MENOS UM dos pontos turísticos mencionados. Exemplo: "Paris tem a Torre Eiffel mais linda que já vi! Adorei correr pelas Tulherias e farejar todas aquelas flores!"`;
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
            content: 'Você é um especialista em viagens focado em fornecer recomendações personalizadas globais para vários orçamentos. Sua prioridade #1 é NUNCA exceder o orçamento máximo indicado para passagens aéreas. Forneça um mix balanceado de destinos populares e alternativos, adequados ao perfil do viajante. Para cada destino, forneça pontos turísticos específicos e conhecidos (não genéricos). Os comentários da Tripinha (cachorra mascote) devem mencionar pelo menos um ponto turístico específico de forma entusiasmada e natural. Retorne APENAS JSON puro. SEMPRE forneça EXATAMENTE 4 destinos alternativos.'
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: "text" }
      },
      timeout: REQUEST_TIMEOUT,
      httpAgent: new (require('http').Agent)({ keepAlive: true }),
      httpsAgent: new (require('https').Agent)({ keepAlive: true })
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
async function callOpenAIAPI(prompt, requestData) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave da API OpenAI não configurada');
    }
    
    console.log('Enviando requisição para OpenAI...');
    
    // Reforçar a mensagem sobre orçamento como prioridade absoluta e pontos turísticos
    const orcamentoMessage = requestData.orcamento_valor ? 
      `\n\n⚠️ ORÇAMENTO MÁXIMO: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'} para voos (ida e volta por pessoa). Todos os destinos DEVEM ter preços de voo ABAIXO deste valor. Este é o requisito MAIS IMPORTANTE.` : '';
    
    // Destaque explícito sobre comentários da Tripinha com pontos turísticos
    const enhancedPrompt = `${prompt}${orcamentoMessage}\n\nIMPORTANTE: 
    1. Cada voo DEVE respeitar rigorosamente o orçamento máximo indicado.
    2. Sua resposta deve ser exclusivamente um objeto JSON válido sem formatação markdown. 
    3. Forneça EXATAMENTE 4 destinos alternativos totalmente diferentes entre si.
    4. Garanta preços realistas e acessíveis para todas as recomendações.
    5. Inclua PONTOS TURÍSTICOS ESPECÍFICOS para cada destino - 2 para o principal e surpresa, 1 para cada alternativa.
    6. Os comentários da Tripinha DEVEM mencionar de forma natural e entusiasmada PELO MENOS UM dos pontos turísticos mencionados. Exemplo: "Lisboa tem a melhor Torre de Belém! Adorei correr por Alfama e farejar todos aqueles cafés!"`;
    
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
            content: "Você é um especialista em viagens focado em fornecer recomendações personalizadas globais para vários orçamentos. Sua prioridade #1 é NUNCA exceder o orçamento máximo indicado para passagens aéreas. Forneça um mix balanceado de destinos populares e alternativos, adequados ao perfil do viajante. Para cada destino, forneça pontos turísticos específicos e conhecidos (não genéricos). Os comentários da Tripinha (cachorra mascote) devem mencionar pelo menos um ponto turístico específico de forma entusiasmada e natural. Retorne APENAS JSON puro. SEMPRE forneça EXATAMENTE 4 destinos alternativos."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      },
      timeout: REQUEST_TIMEOUT,
      httpAgent: new (require('http').Agent)({ keepAlive: true }),
      httpsAgent: new (require('https').Agent)({ keepAlive: true })
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
async function callClaudeAPI(prompt, requestData) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    console.log('Enviando requisição para Claude...');
    
    // Reforçar a mensagem sobre orçamento como prioridade absoluta e pontos turísticos
    const orcamentoMessage = requestData.orcamento_valor ? 
      `\n\n⚠️ ORÇAMENTO MÁXIMO: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'} para voos (ida e volta por pessoa). Todos os destinos DEVEM ter preços de voo ABAIXO deste valor. Este é o requisito MAIS IMPORTANTE.` : '';
    
    // Destaque explícito sobre comentários da Tripinha com pontos turísticos
    const enhancedPrompt = `${prompt}${orcamentoMessage}\n\nIMPORTANTE: 
    1. Cada voo DEVE respeitar rigorosamente o orçamento máximo indicado.
    2. Sua resposta deve ser APENAS o objeto JSON válido, sem NENHUM texto adicional.
    3. Forneça EXATAMENTE 4 destinos alternativos totalmente diferentes entre si.
    4. Garanta preços realistas e acessíveis para todas as recomendações.
    5. Inclua PONTOS TURÍSTICOS ESPECÍFICOS para cada destino - 2 para o principal e surpresa, 1 para cada alternativa.
    6. Os comentários da Tripinha DEVEM mencionar de forma natural e entusiasmada PELO MENOS UM dos pontos turísticos mencionados. Exemplo: "Veneza tem os canais mais bonitos que já vi! Adorei passear perto da Ponte Rialto e farejar os aromas das gôndolas!"`;
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
            content: "Você é um especialista em viagens focado em fornecer recomendações personalizadas globais para vários orçamentos. Sua prioridade #1 é NUNCA exceder o orçamento máximo indicado para passagens aéreas. Forneça um mix balanceado de destinos populares e alternativos, adequados ao perfil do viajante. Para cada destino, forneça pontos turísticos específicos e conhecidos (não genéricos). Os comentários da Tripinha (cachorra mascote) devem mencionar pelo menos um ponto turístico específico de forma entusiasmada e natural. Retorne APENAS JSON puro. SEMPRE forneça EXATAMENTE 4 destinos alternativos."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        temperature: 0.7
      },
      timeout: REQUEST_TIMEOUT,
      httpAgent: new (require('http').Agent)({ keepAlive: true }),
      httpsAgent: new (require('https').Agent)({ keepAlive: true })
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

// Função para extrair JSON válido de uma string de texto
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
    }
    
    // Pré-processar o texto para remover problemas comuns
    let textoProcessado = texto
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
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

// Função otimizada de validação para verificar pontos turísticos e comentários
function isValidDestinationJSON(jsonString, requestData) {
  if (!jsonString) return false;
  
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    
    // Verificação rápida de campos obrigatórios
    if (!data.topPick?.destino || !data.alternativas || !data.surpresa?.destino) {
      console.log("JSON inválido: faltam campos obrigatórios básicos");
      return false;
    }
    
    // Verificação dos campos de pontos turísticos
    if (!data.topPick.pontosTuristicos || !Array.isArray(data.topPick.pontosTuristicos) || data.topPick.pontosTuristicos.length < 2) {
      console.log("JSON inválido: faltam pontos turísticos no destino principal ou menos de 2");
      return false;
    }
    
    if (!data.surpresa.pontosTuristicos || !Array.isArray(data.surpresa.pontosTuristicos) || data.surpresa.pontosTuristicos.length < 2) {
      console.log("JSON inválido: faltam pontos turísticos no destino surpresa ou menos de 2");
      return false;
    }
    
    // Verificação de tamanho exato para alternativas
    if (!Array.isArray(data.alternativas) || data.alternativas.length !== 4) {
      console.log(`JSON inválido: array de alternativas deve conter exatamente 4 destinos (contém ${data.alternativas?.length || 0})`);
      return false;
    }
    
    // Verificar se as alternativas têm pelo menos um ponto turístico cada
    for (let i = 0; i < data.alternativas.length; i++) {
      if (!data.alternativas[i].pontoTuristico) {
        console.log(`JSON inválido: alternativa ${i+1} não tem ponto turístico`);
        return false;
      }
    }
    
    // Verificar se os comentários da Tripinha mencionam pelo menos um ponto turístico
    if (data.topPick.comentario) {
      const includesAnyTopPickAttraction = data.topPick.pontosTuristicos.some(attraction => 
        data.topPick.comentario.toLowerCase().includes(attraction.toLowerCase())
      );
      
      if (!includesAnyTopPickAttraction) {
        console.log("JSON inválido: comentário da Tripinha no topPick não menciona nenhum ponto turístico");
        return false;
      }
    } else {
      console.log("JSON inválido: topPick não tem comentário da Tripinha");
      return false;
    }
    
    if (data.surpresa.comentario) {
      const includesAnySurpriseAttraction = data.surpresa.pontosTuristicos.some(attraction => 
        data.surpresa.comentario.toLowerCase().includes(attraction.toLowerCase())
      );
      
      if (!includesAnySurpriseAttraction) {
        console.log("JSON inválido: comentário da Tripinha na surpresa não menciona nenhum ponto turístico");
        return false;
      }
    } else {
      console.log("JSON inválido: surpresa não tem comentário da Tripinha");
      return false;
    }
    
    // Verificação rápida de orçamento apenas se disponível
    if (requestData?.orcamento_valor && !isNaN(parseFloat(requestData.orcamento_valor))) {
      const orcamentoMax = parseFloat(requestData.orcamento_valor);
      
      // Verificar apenas topPick e primeira alternativa para decisão rápida
      if (data.topPick.preco?.voo > orcamentoMax) {
        console.log(`JSON inválido: topPick tem voo acima do orçamento (${data.topPick.preco?.voo} > ${orcamentoMax})`);
        return false;
      }
      
      // Verificar a primeira alternativa 
      if (data.alternativas[0]?.preco?.voo > orcamentoMax) {
        console.log(`JSON inválido: primeira alternativa tem voo acima do orçamento (${data.alternativas[0]?.preco?.voo} > ${orcamentoMax})`);
        return false;
      }
    }
    
    // Verificação de destinos repetidos - apenas topPick vs primeira alternativa
    if (data.topPick.destino?.toLowerCase() === data.alternativas[0]?.destino?.toLowerCase()) {
      console.log("JSON inválido: destino principal repetido na primeira alternativa");
      return false;
    }
    
    // Se passar nas verificações rápidas, os dados são considerados válidos para resposta
    return true;
  } catch (error) {
    console.error("Erro ao validar JSON:", error);
    return false;
  }
}

// Enriquecer comentários da Tripinha para garantir menção de pontos turísticos
function enriquecerComentarioTripinha(comentario, pontosTuristicos) {
  if (!comentario || !pontosTuristicos || !Array.isArray(pontosTuristicos) || pontosTuristicos.length === 0) {
    return null;
  }
  
  // Verificar se já menciona algum ponto turístico
  const mencionaAtual = pontosTuristicos.some(ponto => 
    comentario.toLowerCase().includes(ponto.toLowerCase())
  );
  
  // Se já menciona um ponto turístico, retornar o comentário original
  if (mencionaAtual) {
    return comentario;
  }
  
  // Escolher o primeiro ponto turístico para mencionar
  const pontoParaMencionar = pontosTuristicos[0];
  
  // Padrões de comentários para inserção natural
  const padroes = [
    `${comentario} Adorei especialmente ${pontoParaMencionar}! 🐾`,
    `${comentario.replace(/🐾.*$/, '')} Fiquei impressionada com ${pontoParaMencionar}! 🐾`,
    comentario.includes('!') 
      ? comentario.replace(/!([^!]*)$/, `! ${pontoParaMencionar} é incrível!$1`)
      : `${comentario} ${pontoParaMencionar} é um lugar que todo cachorro devia visitar! 🐾`,
  ];
  
  // Escolher um padrão aleatoriamente
  const indice = Math.floor(Math.random() * padroes.length);
  return padroes[indice];
}
// Banco simplificado de pontos turísticos populares (reduzido significativamente)
const pontosPopulares = {
  // Destinos mais populares globalmente
  "Paris": ["Torre Eiffel", "Museu do Louvre"],
  "Roma": ["Coliseu", "Vaticano"],
  "Nova York": ["Central Park", "Times Square"],
  "Tóquio": ["Torre de Tóquio", "Shibuya Crossing"],
  "Rio de Janeiro": ["Cristo Redentor", "Pão de Açúcar"],
  "Lisboa": ["Torre de Belém", "Alfama"],
  "Barcelona": ["Sagrada Família", "Parque Güell"],
  
  // Genéricos por região (para quando só temos região)
  "generico_Brasil": ["Praias paradisíacas", "Parques nacionais"],
  "generico_Europa": ["Praças históricas", "Museus de arte"],
  "generico_Asia": ["Templos antigos", "Mercados tradicionais"],
  "generico_America": ["Parques nacionais", "Centros urbanos"]
};

// Pós-processamento simplificado para garantir pontos turísticos e comentários
function ensureTouristAttractionsAndComments(jsonString, requestData) {
  try {
    // Converter para objeto se for string
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    let modificado = false;
    
    // Tratar destino principal
    if (data.topPick) {
      // Verificar e adicionar pontos turísticos se necessário
      if (!data.topPick.pontosTuristicos || !Array.isArray(data.topPick.pontosTuristicos) || data.topPick.pontosTuristicos.length < 2) {
        const destino = data.topPick.destino;
        const pontosConhecidos = pontosPopulares[destino] || ["Principais atrativos da cidade", "Pontos históricos"];
        
        // Assegurar que temos pelo menos 2 pontos turísticos
        data.topPick.pontosTuristicos = [
          pontosConhecidos[0] || "Principais atrativos da cidade",
          pontosConhecidos[1] || "Pontos históricos"
        ];
        modificado = true;
      }
      
      // Verificar e melhorar comentário da Tripinha
      if (data.topPick.comentario) {
        const novoComentario = enriquecerComentarioTripinha(data.topPick.comentario, data.topPick.pontosTuristicos);
        if (novoComentario && novoComentario !== data.topPick.comentario) {
          data.topPick.comentario = novoComentario;
          modificado = true;
        }
      } else {
        // Criar comentário se não existir
        const pontoTuristico = data.topPick.pontosTuristicos[0] || "esse lugar incrível";
        data.topPick.comentario = `${data.topPick.destino} é um sonho! Adorei passear por ${pontoTuristico} e sentir todos aqueles cheiros novos! Uma aventura incrível para qualquer cachorro explorador! 🐾`;
        modificado = true;
      }
    }
    
    // Tratar destino surpresa
    if (data.surpresa) {
      // Verificar e adicionar pontos turísticos se necessário
      if (!data.surpresa.pontosTuristicos || !Array.isArray(data.surpresa.pontosTuristicos) || data.surpresa.pontosTuristicos.length < 2) {
        const destino = data.surpresa.destino;
        const pontosConhecidos = pontosPopulares[destino] || ["Locais exclusivos", "Atrativos menos conhecidos"];
        
        // Assegurar que temos pelo menos 2 pontos turísticos
        data.surpresa.pontosTuristicos = [
          pontosConhecidos[0] || "Locais exclusivos",
          pontosConhecidos[1] || "Atrativos menos conhecidos"
        ];
        modificado = true;
      }
      
      // Verificar e melhorar comentário da Tripinha
      if (data.surpresa.comentario) {
        const novoComentario = enriquecerComentarioTripinha(data.surpresa.comentario, data.surpresa.pontosTuristicos);
        if (novoComentario && novoComentario !== data.surpresa.comentario) {
          data.surpresa.comentario = novoComentario;
          modificado = true;
        }
      } else {
        // Criar comentário se não existir
        const pontoTuristico = data.surpresa.pontosTuristicos[0] || "esse lugar secreto";
        data.surpresa.comentario = `${data.surpresa.destino} é uma descoberta incrível! Poucos conhecem ${pontoTuristico}, mas é um paraíso para cachorros curiosos como eu! Tantos aromas novos para farejar! 🐾🌟`;
        modificado = true;
      }
    }
    
    // Tratar destinos alternativos
    if (data.alternativas && Array.isArray(data.alternativas)) {
      for (let i = 0; i < data.alternativas.length; i++) {
        const alternativa = data.alternativas[i];
        if (!alternativa.pontoTuristico) {
          const destino = alternativa.destino;
          const pontosConhecidos = pontosPopulares[destino] || ["Atrações turísticas"];
          
          // Adicionar um ponto turístico
          alternativa.pontoTuristico = pontosConhecidos[0] || "Atrações turísticas";
          modificado = true;
        }
      }
    }
    
    // Se faltarem exatamente 4 alternativas, completar
    if (!data.alternativas || !Array.isArray(data.alternativas)) {
      data.alternativas = [];
      modificado = true;
    }
    
    while (data.alternativas.length < 4) {
      // Criar destinos alternativos extras
      const destinos = ["Lisboa", "Barcelona", "Roma", "Tóquio"];
      const paisesDestinos = ["Portugal", "Espanha", "Itália", "Japão"];
      const codigosPaises = ["PT", "ES", "IT", "JP"];
      
      const index = data.alternativas.length % destinos.length;
      const destino = destinos[index];
      const pontosConhecidos = pontosPopulares[destino] || ["Atrações turísticas"];
      
      const precoBase = requestData?.orcamento_valor ? Math.round(parseFloat(requestData.orcamento_valor) * 0.7) : 2000;
      
      data.alternativas.push({
        destino: destino,
        pais: paisesDestinos[index],
        codigoPais: codigosPaises[index],
        porque: `Cidade com rica história, gastronomia única e atmosfera encantadora`,
        pontoTuristico: pontosConhecidos[0] || "Atrações turísticas",
        preco: {
          voo: precoBase - (index * 100),
          hotel: 200 + (index * 20)
        }
      });
      
      modificado = true;
    }
    
    // Limitar a exatamente 4 alternativas
    if (data.alternativas.length > 4) {
      data.alternativas = data.alternativas.slice(0, 4);
      modificado = true;
    }
    
    return modificado ? JSON.stringify(data) : jsonString;
    
  } catch (error) {
    console.error("Erro ao processar pontos turísticos:", error);
    return jsonString; // Retornar original em caso de erro
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

  // Determinar estação do ano baseada na data de ida
  let estacaoViagem = 'não determinada';
  let hemisferio = determinarHemisferio(cidadeOrigem);
  
  try {
    if (dataIda !== 'não especificada') {
      const dataObj = new Date(dataIda);
      const mes = dataObj.getMonth();
      
      // Simplificação para hemisfério norte
      if (mes >= 2 && mes <= 4) estacaoViagem = 'primavera';
      else if (mes >= 5 && mes <= 7) estacaoViagem = 'verão';
      else if (mes >= 8 && mes <= 10) estacaoViagem = 'outono';
      else estacaoViagem = 'inverno';
      
      // Inversão para hemisfério sul
      if (hemisferio === 'sul') {
        if (estacaoViagem === 'verão') estacaoViagem = 'inverno';
        else if (estacaoViagem === 'inverno') estacaoViagem = 'verão';
        else if (estacaoViagem === 'primavera') estacaoViagem = 'outono';
        else if (estacaoViagem === 'outono') estacaoViagem = 'primavera';
      }
    }
  } catch (e) {
    console.log("Erro ao determinar estação do ano:", e);
  }

  // Colocar orçamento com destaque prioritário
  const mensagemOrcamento = orcamento !== 'flexível' ?
    `⚠️ ORÇAMENTO MÁXIMO: ${orcamento} ${moeda} para voos (ida e volta por pessoa). Todos os destinos DEVEM ter preços de voo ABAIXO deste valor.` : 
    'Orçamento flexível';
    
  // Adicionar sugestão de localidade baseada na origem
  const sugestaoDistancia = gerarSugestaoDistancia(cidadeOrigem, tipoDestino);

  // Construir prompt detalhado e personalizado
  return `Crie recomendações de viagem que respeitam ESTRITAMENTE o orçamento do usuário:

${mensagemOrcamento}

PERFIL DO VIAJANTE:
- Partindo de: ${cidadeOrigem} ${sugestaoDistancia}
- Viajando: ${companhia}
- Número de pessoas: ${quantidadePessoas}
- Atividades preferidas: ${preferencia}
- Período da viagem: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Estação do ano na viagem: ${estacaoViagem}
- Experiência como viajante: ${conheceDestino === 1 ? 'Com experiência' : 'Iniciante'} 
- Preferência por destinos: ${getTipoDestinoText(tipoDestino)}
- Popularidade do destino: ${getFamaDestinoText(famaDestino)}

IMPORTANTE:
1. O preço do VOO de CADA destino DEVE ser MENOR que o orçamento máximo de ${orcamento} ${moeda}.
2. Forneça um mix equilibrado: inclua tanto destinos populares quanto opções alternativas.
3. Forneça EXATAMENTE 4 destinos alternativos diferentes entre si.
4. Considere a ÉPOCA DO ANO (${estacaoViagem}) para sugerir destinos com clima adequado.
5. Inclua destinos de diferentes continentes/regiões nas alternativas.
6. Garanta que os preços sejam realistas e precisos para voos de ida e volta partindo de ${cidadeOrigem}.
7. Pelo menos um destino deve ter preço bem abaixo do orçamento máximo (economicamente vantajoso).
8. Para cada destino, INCLUA PONTOS TURÍSTICOS ESPECÍFICOS E CONHECIDOS - não genéricos:
   - Principal e Surpresa: 2 pontos turísticos específicos para cada
   - Alternativas: 1 ponto turístico específico para cada
9. Os comentários da Tripinha (que é uma cachorra mascote) DEVEM mencionar pelo menos um dos pontos turísticos do destino de forma natural e entusiasmada. Exemplo: "Paris tem a Torre Eiffel mais linda que já vi! Adorei passear pelos Jardins de Luxemburgo e farejar tantas flores novas! 🐾"

Forneça no formato JSON exato abaixo, SEM formatação markdown:
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão específica para visitar baseada nas preferências",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário entusiasmado da Tripinha (cachorra) mencionando pelo menos um ponto turístico específico",
    "pontosTuristicos": [
      "Nome do Primeiro Ponto Turístico específico e conhecido na cidade", 
      "Nome do Segundo Ponto Turístico específico e conhecido na cidade"
    ],
    "preco": {
      "voo": número,
      "hotel": número
    }
  },
  "alternativas": [
    {
      "destino": "Nome da Cidade 1",
      "pais": "Nome do País 1", 
      "codigoPais": "XX",
      "porque": "Razão específica para visitar",
      "pontoTuristico": "Nome de um Ponto Turístico específico e conhecido na cidade",
      "preco": {
        "voo": número,
        "hotel": número
      }
    },
    {
      "destino": "Nome da Cidade 2",
      "pais": "Nome do País 2", 
      "codigoPais": "XX",
      "porque": "Razão específica para visitar",
      "pontoTuristico": "Nome de um Ponto Turístico específico e conhecido na cidade", 
      "preco": {
        "voo": número,
        "hotel": número
      }
    },
    {
      "destino": "Nome da Cidade 3",
      "pais": "Nome do País 3", 
      "codigoPais": "XX",
      "porque": "Razão específica para visitar",
      "pontoTuristico": "Nome de um Ponto Turístico específico e conhecido na cidade",
      "preco": {
        "voo": número,
        "hotel": número
      }
    },
    {
      "destino": "Nome da Cidade 4",
      "pais": "Nome do País 4", 
      "codigoPais": "XX",
      "porque": "Razão específica para visitar",
      "pontoTuristico": "Nome de um Ponto Turístico específico e conhecido na cidade",
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
    "comentario": "Comentário entusiasmado da Tripinha mencionando pelo menos um ponto turístico específico",
    "pontosTuristicos": [
      "Nome do Primeiro Ponto Turístico específico e conhecido na cidade", 
      "Nome do Segundo Ponto Turístico específico e conhecido na cidade"
    ],
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

// Determinar o hemisfério baseado na cidade de origem (simplificado)
function determinarHemisferio(cidadeOrigem) {
  // Lista simplificada de termos que indicam hemisfério sul
  const indicadoresSul = [
    'brasil', 'argentina', 'chile', 'austrália', 'nova zelândia', 
    'áfrica do sul', 'peru', 'uruguai', 'paraguai', 'bolívia'
  ];
  
  if (!cidadeOrigem || cidadeOrigem === 'origem não especificada') {
    return 'norte'; // Padrão para o caso de não sabermos
  }
  
  const cidadeLowerCase = cidadeOrigem.toLowerCase();
  
  // Verificar se a cidade contém algum indicador de hemisfério sul
  if (indicadoresSul.some(termo => cidadeLowerCase.includes(termo))) {
    return 'sul';
  }
  
  return 'norte';
}

// Gerar sugestão de distância de viagem baseada na origem (simplificado)
function gerarSugestaoDistancia(cidadeOrigem, tipoDestino) {
  if (cidadeOrigem === 'origem não especificada' || tipoDestino === 0) {
    return '';
  }
  
  // Lista simplificada de grandes hubs internacionais
  const grandeshubs = ['nova york', 'londres', 'paris', 'tóquio', 'dubai', 'são paulo'];
  
  const cidadeLowerCase = cidadeOrigem.toLowerCase();
  
  // Se a origem for um grande hub, sugerir destinos mais distantes
  if (grandeshubs.some(cidade => cidadeLowerCase.includes(cidade))) {
    return '(considere incluir destinos intercontinentais nas opções)';
  }
  
  return '(considere a distância e acessibilidade a partir desta origem)';
}
// Função para gerar dados de emergência personalizados baseados no perfil (SIGNIFICATIVAMENTE SIMPLIFICADA)
function generateEmergencyData(dadosUsuario = {}) {
  // Extrair parâmetros essenciais
  const preferencia = dadosUsuario.preferencia_viagem || 0;
  const orcamento = dadosUsuario.orcamento_valor ? parseFloat(dadosUsuario.orcamento_valor) : 3000;
  const moeda = dadosUsuario.moeda_escolhida || 'BRL';
  
  // Determinar região da origem para selecionar destinos apropriados
  const cidadeOrigem = dadosUsuario.cidade_partida?.name || '';
  const regiao = determinarRegiaoOrigem(cidadeOrigem);
  
  // Dados de emergência fixos, mas adaptados por região e orçamento
  const dadosEmergencia = {
    "americas": {
      topPick: {
        destino: "Rio de Janeiro",
        pais: "Brasil",
        codigoPais: "BR",
        descricao: "Cidade maravilhosa com praias, montanhas e cultura vibrante",
        porque: "Combinação perfeita de beleza natural, cultura rica e gastronomia diversificada",
        destaque: "Visitar o Cristo Redentor ao pôr do sol com vista panorâmica da cidade",
        comentario: "O Rio tem a praia de Copacabana mais linda para cavar na areia! Corri pelo Cristo Redentor e vi a cidade inteira aos meus pés! Que aventura incrível! 🐾",
        pontosTuristicos: ["Cristo Redentor", "Praia de Copacabana"],
        preco: { voo: Math.min(orcamento * 0.6, 1200), hotel: 250 }
      },
      alternativas: [
        {
          destino: "Cidade do México",
          pais: "México",
          codigoPais: "MX",
          porque: "Capital cultural com pirâmides antigas, museus e gastronomia premiada",
          pontoTuristico: "Museu Frida Kahlo",
          preco: { voo: Math.min(orcamento * 0.7, 1600), hotel: 180 }
        },
        {
          destino: "Buenos Aires",
          pais: "Argentina",
          codigoPais: "AR",
          porque: "A Paris da América do Sul com arquitetura europeia e tango nas ruas",
          pontoTuristico: "Teatro Colón",
          preco: { voo: Math.min(orcamento * 0.65, 1500), hotel: 170 }
        },
        {
          destino: "Toronto",
          pais: "Canadá",
          codigoPais: "CA",
          porque: "Metrópole multicultural com torres icônicas e proximidade às Cataratas do Niágara",
          pontoTuristico: "CN Tower",
          preco: { voo: Math.min(orcamento * 0.8, 2200), hotel: 280 }
        },
        {
          destino: "Cusco",
          pais: "Peru",
          codigoPais: "PE",
          porque: "Antiga capital Inca próxima a Machu Picchu com rica história andina",
          pontoTuristico: "Sacsayhuamán",
          preco: { voo: Math.min(orcamento * 0.75, 1800), hotel: 160 }
        }
      ],
      surpresa: {
        destino: "Cartagena",
        pais: "Colômbia",
        codigoPais: "CO",
        descricao: "Cidade colonial murada no Caribe colombiano com cores vibrantes",
        porque: "Destino colombiano menos visitado por brasileiros com cultura caribenha única",
        destaque: "Passear pelas ruas coloridas da Cidade Murada ao entardecer",
        comentario: "Cartagena é mágica! A Ciudad Amurallada tem ruas de pedra onde posso passear a noite toda! E os pescadores sempre me dão petiscos fresquinhos no mercado! 🐾🐟",
        pontosTuristicos: ["Ciudad Amurallada", "Castillo San Felipe de Barajas"],
        preco: { voo: Math.min(orcamento * 0.7, 1700), hotel: 200 }
      }
    },
    "europa": {
      topPick: {
        destino: "Lisboa",
        pais: "Portugal",
        codigoPais: "PT",
        descricao: "Capital portuguesa à beira do Tejo com colinas, elétricos e pastelarias",
        porque: "Combinação de cultura, gastronomia, clima agradável e preços acessíveis para europeus",
        destaque: "Jantar com show de Fado em uma casa tradicional de Alfama",
        comentario: "Lisboa tem a Torre de Belém mais bonita à beira do rio! Adorei farejar os pastéis de nata quentinhos e correr pelas ruelas de Alfama! 🐾🚋",
        pontosTuristicos: ["Torre de Belém", "Bairro de Alfama"],
        preco: { voo: Math.min(orcamento * 0.7, 2600), hotel: 220 }
      },
      alternativas: [
        {
          destino: "Barcelona",
          pais: "Espanha",
          codigoPais: "ES",
          porque: "Cidade mediterrânea com arquitetura fantástica de Gaudí e praias urbanas",
          pontoTuristico: "Sagrada Família",
          preco: { voo: Math.min(orcamento * 0.75, 2800), hotel: 240 }
        },
        {
          destino: "Amsterdã",
          pais: "Holanda",
          codigoPais: "NL",
          porque: "Cidade de canais com museus de classe mundial e atmosfera liberal",
          pontoTuristico: "Museu Van Gogh",
          preco: { voo: Math.min(orcamento * 0.8, 3000), hotel: 280 }
        },
        {
          destino: "Praga",
          pais: "República Tcheca",
          codigoPais: "CZ",
          porque: "Cidade medieval perfeitamente preservada com castelo e pontes históricos",
          pontoTuristico: "Ponte Carlos",
          preco: { voo: Math.min(orcamento * 0.7, 2700), hotel: 190 }
        },
        {
          destino: "Roma",
          pais: "Itália",
          codigoPais: "IT",
          porque: "Capital histórica com ruínas antigas, arte renascentista e gastronomia premiada",
          pontoTuristico: "Coliseu",
          preco: { voo: Math.min(orcamento * 0.8, 2900), hotel: 250 }
        }
      ],
      surpresa: {
        destino: "Porto",
        pais: "Portugal",
        codigoPais: "PT",
        descricao: "Cidade histórica à beira do Rio Douro com caves de vinho e atmosfera autêntica",
        porque: "Menos turística que Lisboa, com vinhos únicos e custo-benefício excelente",
        destaque: "Degustação de vinho do Porto nas caves históricas de Vila Nova de Gaia",
        comentario: "Porto é um sonho para cães aventureiros! A Livraria Lello parece saída de um conto de fadas, e pude sentir o cheirinho do vinho do Porto envelhecendo nas caves! 🐾🍷",
        pontosTuristicos: ["Livraria Lello", "Caves de Vinho do Porto"],
        preco: { voo: Math.min(orcamento * 0.7, 2500), hotel: 200 }
      }
    },
    "asia": {
      topPick: {
        destino: "Tóquio",
        pais: "Japão",
        codigoPais: "JP",
        descricao: "Metrópole futurista com tradição milenar, tecnologia avançada e culinária única",
        porque: "Experiência cultural única com segurança, eficiência e contrastes fascinantes",
        destaque: "Visitar o cruzamento de Shibuya e depois relaxar no tradicional jardim Shinjuku Gyoen",
        comentario: "Tóquio é incrível! O cruzamento de Shibuya tem tantas pessoas e luzes! E os jardins de cerejeira são perfeitos para um cachorro curioso como eu! 🐾🌸",
        pontosTuristicos: ["Cruzamento de Shibuya", "Templo Senso-ji"],
        preco: { voo: Math.min(orcamento * 0.85, 3800), hotel: 270 }
      },
      alternativas: [
        {
          destino: "Bangkok",
          pais: "Tailândia",
          codigoPais: "TH",
          porque: "Capital tailandesa com templos dourados, mercados flutuantes e vida noturna",
          pontoTuristico: "Grande Palácio Real",
          preco: { voo: Math.min(orcamento * 0.8, 3500), hotel: 150 }
        },
        {
          destino: "Singapura",
          pais: "Singapura",
          codigoPais: "SG",
          porque: "Cidade-estado moderna com arquitetura futurista, limpeza impecável e gastronomia diversa",
          pontoTuristico: "Gardens by the Bay",
          preco: { voo: Math.min(orcamento * 0.85, 3700), hotel: 290 }
        },
        {
          destino: "Bali",
          pais: "Indonésia",
          codigoPais: "ID",
          porque: "Ilha paradisíaca com praias, templos, terraços de arroz e cultura única",
          pontoTuristico: "Templo Tanah Lot",
          preco: { voo: Math.min(orcamento * 0.75, 3400), hotel: 180 }
        },
        {
          destino: "Dubai",
          pais: "Emirados Árabes Unidos",
          codigoPais: "AE",
          porque: "Cidade futurista no deserto com os prédios mais altos do mundo e luxo extremo",
          pontoTuristico: "Burj Khalifa",
          preco: { voo: Math.min(orcamento * 0.8, 3600), hotel: 320 }
        }
      ],
      surpresa: {
        destino: "Hoi An",
        pais: "Vietnã",
        codigoPais: "VN",
        descricao: "Antiga cidade portuária com arquitetura preservada e lanternas coloridas",
        porque: "Destino menos conhecido com história fascinante e atmosfera mágica ao anoitecer",
        destaque: "Passear pela cidade antiga iluminada por milhares de lanternas coloridas",
        comentario: "Hoi An é um sonho! A Cidade Antiga fica toda iluminada com lanternas coloridas à noite, parece mágica! E os barquinhos no rio têm cheiros tão interessantes! 🐾🏮",
        pontosTuristicos: ["Cidade Antiga de Hoi An", "Ponte Japonesa"],
        preco: { voo: Math.min(orcamento * 0.75, 3300), hotel: 130 }
      }
    },
    "global": {
      topPick: {
        destino: "Barcelona",
        pais: "Espanha",
        codigoPais: "ES",
        descricao: "Cidade mediterrânea com arquitetura única, praias e cultura vibrante",
        porque: "Combinação perfeita de atrações urbanas, praia, gastronomia e arte",
        destaque: "Passear pela Sagrada Família e depois relaxar na Praia de Barceloneta",
        comentario: "Barcelona é um paraíso! A Sagrada Família é o lugar mais impressionante que já vi com tantos detalhes para observar! O Parque Güell é como um parquinho mágico para cães! 🐾🏛️",
        pontosTuristicos: ["Sagrada Família", "Parque Güell"],
        preco: { voo: Math.min(orcamento * 0.7, 2600), hotel: 220 }
      },
      alternativas: [
        {
          destino: "Tóquio",
          pais: "Japão",
          codigoPais: "JP",
          porque: "Metropole futurista com tradição milenar, segurança e gastronomia excepcional",
          pontoTuristico: "Cruzamento de Shibuya",
          preco: { voo: Math.min(orcamento * 0.85, 3500), hotel: 270 }
        },
        {
          destino: "Cidade do Cabo",
          pais: "África do Sul",
          codigoPais: "ZA",
          porque: "Cidade entre montanha e mar com safáris próximos e paisagens deslumbrantes",
          pontoTuristico: "Table Mountain",
          preco: { voo: Math.min(orcamento * 0.8, 3000), hotel: 200 }
        },
        {
          destino: "Nova York",
          pais: "Estados Unidos",
          codigoPais: "US",
          porque: "A 'Capital do Mundo' com arranha-céus, cultura, compras e entretenimento",
          pontoTuristico: "Central Park",
          preco: { voo: Math.min(orcamento * 0.8, 3100), hotel: 350 }
        },
        {
          destino: "Rio de Janeiro",
          pais: "Brasil",
          codigoPais: "BR",
          porque: "Cidade maravilhosa com praias, montanhas e cultura brasileira vibrante",
          pontoTuristico: "Cristo Redentor",
          preco: { voo: Math.min(orcamento * 0.6, 1500), hotel: 230 }
        }
      ],
      surpresa: {
        destino: "Ljubljana",
        pais: "Eslovênia",
        codigoPais: "SI",
        descricao: "Capital eslovena com aspecto de conto de fadas e natureza exuberante",
        porque: "Pequena capital europeia desconhecida com charme único e natureza próxima",
        destaque: "Passear pelo centro histórico e depois fazer uma excursão ao Lago Bled",
        comentario: "Ljubljana é um segredo escondido! A Ponte do Dragão tem estátuas que parecem ganhar vida! E o Castelo de Ljubljana no alto da colina tem os melhores pontos para farejar a cidade inteira! 🐾🏰",
        pontosTuristicos: ["Ponte do Dragão", "Castelo de Ljubljana"],
        preco: { voo: Math.min(orcamento * 0.7, 2700), hotel: 170 }
      }
    }
  };
  
  // Selecionar o conjunto de dados conforme a região
  const dadosRegiao = dadosEmergencia[regiao] || dadosEmergencia.global;
  
  // Ajustar preços para respeitar orçamento
  if (orcamento) {
    // Ajustar preço do destino principal se necessário
    if (dadosRegiao.topPick.preco.voo > orcamento * 0.95) {
      dadosRegiao.topPick.preco.voo = Math.round(orcamento * 0.85);
    }
    
    // Ajustar preços das alternativas
    dadosRegiao.alternativas.forEach((alt, index) => {
      if (alt.preco.voo > orcamento * 0.95) {
        const fatorAjuste = 0.7 + (index * 0.05);
        alt.preco.voo = Math.round(orcamento * fatorAjuste);
      }
    });
    
    // Ajustar preço do destino surpresa
    if (dadosRegiao.surpresa.preco.voo > orcamento) {
      dadosRegiao.surpresa.preco.voo = Math.round(orcamento * 0.9);
    }
  }
  
  // Embaralhar alternativas para evitar sempre as mesmas posições
  dadosRegiao.alternativas = embaralharArray([...dadosRegiao.alternativas]);
  
  return dadosRegiao;
}

// Determinar região de origem (simplificado para apenas 4 regiões principais)
function determinarRegiaoOrigem(cidadeOrigem) {
  if (!cidadeOrigem) return 'global';
  
  const cidadeLowerCase = cidadeOrigem.toLowerCase();
  
  // Termos que indicam América
  const termosAmericas = ['brasil', 'argentina', 'chile', 'méxico', 'canadá', 'estados unidos', 'eua', 'peru', 'colômbia'];
  
  // Termos que indicam Europa
  const termosEuropa = ['alemanha', 'frança', 'itália', 'espanha', 'reino unido', 'portugal', 'londres', 'paris', 'roma', 'madri'];
  
  // Termos que indicam Ásia/Oceania
  const termosAsia = ['japão', 'china', 'índia', 'tailândia', 'austrália', 'singapura', 'tóquio', 'pequim', 'dubai'];
  
  // Verificar em qual região a cidade se encaixa
  if (termosAmericas.some(termo => cidadeLowerCase.includes(termo))) return 'americas';
  if (termosEuropa.some(termo => cidadeLowerCase.includes(termo))) return 'europa';
  if (termosAsia.some(termo => cidadeLowerCase.includes(termo))) return 'asia';
  
  // Padrão global como fallback
  return 'global';
}

// Função auxiliar para embaralhar arrays (útil para reordenar destinos)
function embaralharArray(array) {
  let currentIndex = array.length;
  let randomIndex;

  // Enquanto existirem elementos a serem embaralhados
  while (currentIndex != 0) {
    // Escolher um elemento restante
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // E trocar com o elemento atual
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
}
