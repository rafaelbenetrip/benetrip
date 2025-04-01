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
          if (response && isValidDestinationJSON(response, requestData)) {
            console.log('Resposta Perplexity válida recebida');
            let parsedResponse = JSON.parse(response);
            // Pós-processamento para enriquecer comentários e pontos turísticos
            parsedResponse = postProcessDestinos(parsedResponse);
            const finalResponse = JSON.stringify(parsedResponse);
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: "perplexity",
                conteudo: finalResponse,
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
          if (response && isValidDestinationJSON(response, requestData)) {
            console.log('Resposta OpenAI válida recebida');
            let parsedResponse = JSON.parse(response);
            parsedResponse = postProcessDestinos(parsedResponse);
            const finalResponse = JSON.stringify(parsedResponse);
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: "openai",
                conteudo: finalResponse,
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
          if (response && isValidDestinationJSON(response, requestData)) {
            console.log('Resposta Claude válida recebida');
            let parsedResponse = JSON.parse(response);
            parsedResponse = postProcessDestinos(parsedResponse);
            const finalResponse = JSON.stringify(parsedResponse);
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: "claude",
                conteudo: finalResponse,
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
      prompt = `${prompt}\n\nURGENTE: O ORÇAMENTO MÁXIMO para voos (${requestData.orcamento_valor || 'informado'} ${requestData.moeda_escolhida || 'BRL'}) precisa ser RIGOROSAMENTE RESPEITADO. TODOS os destinos devem ter voos COM VALOR ABAIXO desse orçamento. Forneça um mix de destinos populares e alternativos, todos com preços realistas e acessíveis. Inclua PONTOS TURÍSTICOS ESPECÍFICOS e DETALHADOS para cada destino.`;
    }
    
    // Se todas as tentativas falharam, criar uma resposta de emergência
    console.log('Todas as tentativas de obter resposta válida falharam');
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
    console.error('Erro global na API de recomendações:', globalError);
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
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      res.status(500).json({
        tipo: "erro",
        message: "Erro interno no servidor"
      });
    }
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
    const orcamentoMessage = requestData.orcamento_valor ? 
      `\n\n⚠️ ORÇAMENTO MÁXIMO: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'} para voos (ida e volta por pessoa). Todos os destinos DEVEM ter preços de voo ABAIXO deste valor. Este é o requisito MAIS IMPORTANTE.` : '';
    const enhancedPrompt = `${prompt}${orcamentoMessage}\n\nIMPORTANTE: 
    1. Cada voo DEVE respeitar rigorosamente o orçamento máximo indicado.
    2. Retorne APENAS o JSON puro, sem marcação markdown ou comentários.
    3. Forneça EXATAMENTE 4 destinos alternativos totalmente diferentes entre si.
    4. Garanta preços realistas e acessíveis para todas as recomendações.
    5. Inclua PONTOS TURÍSTICOS ESPECÍFICOS para cada destino - 2 para o destino principal e destino surpresa, 1 para cada alternativa.`;
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
            content: 'Você é um especialista em viagens focado em fornecer recomendações personalizadas globais para vários orçamentos. Sua prioridade #1 é NUNCA exceder o orçamento máximo indicado para passagens aéreas. Forneça um mix balanceado de destinos populares e alternativos, adequados ao perfil do viajante. Para cada destino, forneça pontos turísticos específicos e conhecidos (não genéricos). Retorne APENAS JSON puro. SEMPRE forneça EXATAMENTE 4 destinos alternativos.'
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
    
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message || !response.data.choices[0].message.content) {
      console.error('Resposta Perplexity incompleta:', JSON.stringify(response.data).substring(0, 200));
      throw new Error('Formato de resposta da Perplexity inválido');
    }
    
    const content = response.data.choices[0].message.content;
    console.log('Conteúdo recebido da API Perplexity (primeiros 200 caracteres):', content.substring(0, 200));
    
    return extrairJSONDaResposta(content);
  } catch (error) {
    console.error('Erro detalhado na chamada à API Perplexity:');
    if (error.code === 'ECONNABORTED') {
      console.error('Timeout na chamada à API Perplexity');
    }
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers));
      console.error('Dados:', JSON.stringify(error.response.data).substring(0, 500));
    }
    if (error.request) {
      console.error('Requisição enviada, mas sem resposta');
    }
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
    const orcamentoMessage = requestData.orcamento_valor ? 
      `\n\n⚠️ ORÇAMENTO MÁXIMO: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'} para voos (ida e volta por pessoa). Todos os destinos DEVEM ter preços de voo ABAIXO deste valor. Este é o requisito MAIS IMPORTANTE.` : '';
    const enhancedPrompt = `${prompt}${orcamentoMessage}\n\nIMPORTANTE: 
    1. Cada voo DEVE respeitar rigorosamente o orçamento máximo indicado.
    2. Sua resposta deve ser exclusivamente um objeto JSON válido sem formatação markdown. 
    3. Forneça EXATAMENTE 4 destinos alternativos totalmente diferentes entre si.
    4. Garanta preços realistas e acessíveis para todas as recomendações.
    5. Inclua PONTOS TURÍSTICOS ESPECÍFICOS para cada destino - 2 para o principal e surpresa, 1 para cada alternativa.`;
    
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
            content: "Você é um especialista em viagens focado em fornecer recomendações personalizadas globais para vários orçamentos. Sua prioridade #1 é NUNCA exceder o orçamento máximo indicado para passagens aéreas. Forneça um mix balanceado de destinos populares e alternativos, adequados ao perfil do viajante. Para cada destino, forneça pontos turísticos específicos e conhecidos (não genéricos). Retorne APENAS JSON puro. SEMPRE forneça EXATAMENTE 4 destinos alternativos."
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
    const orcamentoMessage = requestData.orcamento_valor ? 
      `\n\n⚠️ ORÇAMENTO MÁXIMO: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'} para voos (ida e volta por pessoa). Todos os destinos DEVEM ter preços de voo ABAIXO deste valor. Este é o requisito MAIS IMPORTANTE.` : '';
    const enhancedPrompt = `${prompt}${orcamentoMessage}\n\nIMPORTANTE: 
    1. Cada voo DEVE respeitar rigorosamente o orçamento máximo indicado.
    2. Sua resposta deve ser APENAS o objeto JSON válido, sem NENHUM texto adicional.
    3. Forneça EXATAMENTE 4 destinos alternativos totalmente diferentes entre si.
    4. Garanta preços realistas e acessíveis para todas as recomendações.
    5. Inclua PONTOS TURÍSTICOS ESPECÍFICOS para cada destino - 2 para o principal e surpresa, 1 para cada alternativa.`;
    
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
            content: "Você é um especialista em viagens focado em fornecer recomendações personalizadas globais para vários orçamentos. Sua prioridade #1 é NUNCA exceder o orçamento máximo indicado para passagens aéreas. Forneça um mix balanceado de destinos populares e alternativos, adequados ao perfil do viajante. Para cada destino, forneça pontos turísticos específicos e conhecidos (não genéricos). Retorne APENAS JSON puro. SEMPRE forneça EXATAMENTE 4 destinos alternativos."
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
    console.log("Tipo da resposta recebida:", typeof texto);
    console.log("Tamanho da resposta recebida:", texto.length);
    
    if (typeof texto === 'object' && texto !== null) {
      console.log("Resposta já é um objeto, convertendo para string");
      return JSON.stringify(texto);
    }
    
    try {
      const parsed = JSON.parse(texto);
      console.log("JSON analisado com sucesso no primeiro método");
      return JSON.stringify(parsed); 
    } catch (e) {
      console.log("Primeira tentativa falhou, tentando métodos alternativos");
    }
    
    let textoProcessado = texto
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\r\n/g, '\n')
      .trim();
    
    const jsonRegex = /(\{[\s\S]*\})/;
    const match = textoProcessado.match(jsonRegex);
    
    if (match && match[0]) {
      try {
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
    
    console.log("Todas as tentativas de extração falharam");
    return null;
  } catch (error) {
    console.error('Erro fatal ao processar resposta:', error);
    return null;
  }
}
// Função auxiliar para enriquecer o comentário da Tripinha garantindo que mencione pelo menos um ponto turístico
function enriquecerComentarioTripinha(comentario, pontosTuristicos) {
  let possuiPonto = false;
  if (typeof comentario === 'string' && Array.isArray(pontosTuristicos)) {
    pontosTuristicos.forEach(pt => {
      if (comentario.toLowerCase().includes(pt.toLowerCase())) {
        possuiPonto = true;
      }
    });
  }
  // Se não há menção de nenhum ponto turístico, adiciona de forma interpolada o primeiro da lista
  if (!possuiPonto && pontosTuristicos.length > 0) {
    return `${comentario} Não esqueça de conferir: ${pontosTuristicos[0]}.`;
  }
  return comentario;
}

// Função de pós-processamento para ajustar os dados dos destinos
function postProcessDestinos(data) {
  // Para o destino principal (topPick)
  if (data.topPick) {
    // Se não houver pontos turísticos, insere um padrão simples
    if (!data.topPick.pontosTuristicos || data.topPick.pontosTuristicos.length === 0) {
      data.topPick.pontosTuristicos = ["Ponto Histórico Central", "Atração Turística Popular"];
    }
    // Enriquecer o comentário da Tripinha para topPick
    if (data.topPick.comentario) {
      data.topPick.comentario = enriquecerComentarioTripinha(data.topPick.comentario, data.topPick.pontosTuristicos);
    }
  }
  
  // Para o destino surpresa
  if (data.surpresa) {
    if (!data.surpresa.pontosTuristicos || data.surpresa.pontosTuristicos.length === 0) {
      data.surpresa.pontosTuristicos = ["Ponto Histórico Central", "Atração Turística Popular"];
    }
    if (data.surpresa.comentario) {
      data.surpresa.comentario = enriquecerComentarioTripinha(data.surpresa.comentario, data.surpresa.pontosTuristicos);
    }
  }
  
  // Para cada alternativa, se faltar o ponto turístico, insere um padrão
  if (Array.isArray(data.alternativas)) {
    data.alternativas.forEach((alt, index) => {
      if (!alt.pontoTuristico || alt.pontoTuristico.trim() === "") {
        alt.pontoTuristico = "Ponto Turístico Popular";
      }
    });
  }
  return data;
}

// Função otimizada de validação para responder mais rapidamente e garantir a presença de pontos turísticos e comentários adequados
function isValidDestinationJSON(jsonString, requestData) {
  if (!jsonString) return false;
  
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    
    if (!data.topPick?.destino || !data.alternativas || !data.surpresa?.destino) {
      console.log("JSON inválido: faltam campos obrigatórios básicos");
      return false;
    }
    
    // Verificação dos campos de pontos turísticos no destino principal e surpresa
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
    
    // Verificação do comentário da Tripinha para topPick: deve ser uma string não vazia e mencionar pelo menos um dos pontos turísticos
    if (!data.topPick.comentario || typeof data.topPick.comentario !== 'string' || data.topPick.comentario.trim() === "") {
      console.log("JSON inválido: topPick não tem comentário da Tripinha");
      return false;
    }
    let topPickCommentValid = false;
    data.topPick.pontosTuristicos.forEach(pt => {
      if (data.topPick.comentario.toLowerCase().includes(pt.toLowerCase())) {
        topPickCommentValid = true;
      }
    });
    if (!topPickCommentValid) {
      console.log("JSON inválido: comentário da Tripinha do topPick não menciona nenhum ponto turístico");
      return false;
    }
    
    // Verificação do comentário da Tripinha para o destino surpresa
    if (!data.surpresa.comentario || typeof data.surpresa.comentario !== 'string' || data.surpresa.comentario.trim() === "") {
      console.log("JSON inválido: surpresa não tem comentário da Tripinha");
      return false;
    }
    let surpresaCommentValid = false;
    data.surpresa.pontosTuristicos.forEach(pt => {
      if (data.surpresa.comentario.toLowerCase().includes(pt.toLowerCase())) {
        surpresaCommentValid = true;
      }
    });
    if (!surpresaCommentValid) {
      console.log("JSON inválido: comentário da Tripinha da surpresa não menciona nenhum ponto turístico");
      return false;
    }
    
    // Verificação rápida de orçamento se disponível
    if (requestData?.orcamento_valor && !isNaN(parseFloat(requestData.orcamento_valor))) {
      const orcamentoMax = parseFloat(requestData.orcamento_valor);
      if (data.topPick.preco?.voo > orcamentoMax) {
        console.log(`JSON inválido: topPick tem voo acima do orçamento (${data.topPick.preco?.voo} > ${orcamentoMax})`);
        return false;
      }
      if (data.alternativas[0]?.preco?.voo > orcamentoMax) {
        console.log(`JSON inválido: primeira alternativa tem voo acima do orçamento (${data.alternativas[0]?.preco?.voo} > ${orcamentoMax})`);
        return false;
      }
    }
    
    // Verificação de destinos repetidos
    if (data.topPick.destino?.toLowerCase() === data.alternativas[0]?.destino?.toLowerCase()) {
      console.log("JSON inválido: destino principal repetido na primeira alternativa");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Erro ao validar JSON:", error);
    return false;
  }
}
// Função para gerar prompt adequado para a IA com ênfase nos pontos turísticos e comentários da Tripinha
function gerarPromptParaDestinos(dados) {
  const companhia = getCompanhiaText(dados.companhia || 0);
  const preferencia = getPreferenciaText(dados.preferencia_viagem || 0);
  const cidadeOrigem = dados.cidade_partida?.name || 'origem não especificada';
  const orcamento = dados.orcamento_valor || 'flexível';
  const moeda = dados.moeda_escolhida || 'BRL';
  
  const quantidadePessoas = dados.quantidade_familia || dados.quantidade_amigos || 1;
  const conheceDestino = dados.conhece_destino || 0;
  const tipoDestino = dados.tipo_destino || 'qualquer';
  const famaDestino = dados.fama_destino || 'qualquer';
  
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

  let estacaoViagem = 'não determinada';
  let hemisferio = determinarHemisferio(cidadeOrigem);
  
  try {
    if (dataIda !== 'não especificada') {
      const dataObj = new Date(dataIda);
      const mes = dataObj.getMonth();
      
      if (mes >= 2 && mes <= 4) estacaoViagem = 'primavera';
      else if (mes >= 5 && mes <= 7) estacaoViagem = 'verão';
      else if (mes >= 8 && mes <= 10) estacaoViagem = 'outono';
      else estacaoViagem = 'inverno';
      
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

  const mensagemOrcamento = orcamento !== 'flexível' ?
    `⚠️ ORÇAMENTO MÁXIMO: ${orcamento} ${moeda} para voos (ida e volta por pessoa). Todos os destinos DEVEM ter preços de voo ABAIXO deste valor.` : 
    'Orçamento flexível';
    
  const sugestaoDistancia = gerarSugestaoDistancia(cidadeOrigem, tipoDestino);

  // Construir prompt detalhado e personalizado com ênfase em pontos turísticos
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
8. Para cada destino, INCLUA PONTOS TURÍSTICOS ESPECÍFICOS E CONHECIDOS:
   - Principal e Surpresa: 2 pontos turísticos específicos para cada
   - Alternativas: 1 ponto turístico específico para cada
9. **Garanta que o comentário entusiasmado da Tripinha inclua ao menos um dos pontos turísticos listados.**

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
    "comentario": "Comentário entusiasmado da Tripinha",
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

// Função para determinar o hemisfério baseado na cidade de origem
function determinarHemisferio(cidadeOrigem) {
  const cidadesHemisferioSul = [
    'são paulo', 'rio de janeiro', 'brasília', 'salvador', 'fortaleza', 
    'recife', 'porto alegre', 'curitiba', 'manaus', 'belém', 'brasil',
    'buenos aires', 'santiago', 'lima', 'bogotá', 'quito', 'caracas',
    'sydney', 'melbourne', 'brisbane', 'perth', 'auckland', 'wellington',
    'cidade do cabo', 'joanesburgo', 'pretória', 'durban', 'luanda', 'maputo'
  ];
  
  if (!cidadeOrigem || cidadeOrigem === 'origem não especificada') {
    return 'norte';
  }
  
  const cidadeLowerCase = cidadeOrigem.toLowerCase();
  if (cidadesHemisferioSul.some(cidade => cidadeLowerCase.includes(cidade))) {
    return 'sul';
  }
  
  return 'norte';
}

// Função para gerar sugestão de distância de viagem baseada na origem
function gerarSugestaoDistancia(cidadeOrigem, tipoDestino) {
  if (cidadeOrigem === 'origem não especificada') {
    return '';
  }
  
  if (tipoDestino === 0) {
    return '';
  }
  
  const grandeshubs = [
    'nova york', 'londres', 'paris', 'tóquio', 'dubai', 
    'frankfurt', 'hong kong', 'singapura', 'amsterdã',
    'bangkok', 'são paulo', 'cidade do méxico'
  ];
  
  const cidadeLowerCase = cidadeOrigem.toLowerCase();
  if (grandeshubs.some(cidade => cidadeLowerCase.includes(cidade))) {
    return '(considere incluir destinos intercontinentais nas opções)';
  }
  
  return '(considere a distância e acessibilidade a partir desta origem)';
}

// Função auxiliar para obter texto de companhia com verificação de tipo
function getCompanhiaText(value) {
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
// Função para gerar dados de emergência personalizados baseados no perfil
function generateEmergencyData(dadosUsuario = {}) {
  const preferencia = dadosUsuario.preferencia_viagem || 0;
  const companhia = dadosUsuario.companhia || 0;
  const quantidadePessoas = dadosUsuario.quantidade_familia || dadosUsuario.quantidade_amigos || 1;
  const orcamento = dadosUsuario.orcamento_valor ? parseFloat(dadosUsuario.orcamento_valor) : 3000;
  const cidadeOrigem = dadosUsuario.cidade_partida?.name || '';
  const regiaoOrigem = determinarRegiaoOrigem(cidadeOrigem);
  const destinosPorRegiao = gerarDestinosPorRegiao(regiaoOrigem, preferencia, orcamento);
  const conjuntoAtual = destinosPorRegiao[preferencia] || destinosPorRegiao[0];
  const indiceAleatorio = Math.floor(Math.random() * conjuntoAtual.length);
  const resultado = {...conjuntoAtual[indiceAleatorio]};
  resultado.alternativas = embaralharArray([...resultado.alternativas]);
  
  if (resultado.alternativas.length < 4) {
    const destinosExtras = gerarDestinosExtras(regiaoOrigem, orcamento);
    while (resultado.alternativas.length < 4) {
      resultado.alternativas.push(destinosExtras[resultado.alternativas.length % destinosExtras.length]);
    }
  } else if (resultado.alternativas.length > 4) {
    resultado.alternativas = resultado.alternativas.slice(0, 4);
  }
  
  if (orcamento) {
    if (resultado.topPick.preco.voo > orcamento * 0.95) {
      resultado.topPick.preco.voo = Math.round(orcamento * 0.85);
    }
    
    let temOpcaoEconomica = false;
    resultado.alternativas.forEach((alt, index) => {
      if (alt.preco.voo > orcamento * 0.95) {
        const fatorAjuste = 0.7 + (index * 0.05);
        alt.preco.voo = Math.round(orcamento * fatorAjuste);
      }
      if (alt.preco.voo <= orcamento * 0.7) {
        temOpcaoEconomica = true;
      }
    });
    
    if (!temOpcaoEconomica && resultado.alternativas.length > 0) {
      resultado.alternativas[0].preco.voo = Math.round(orcamento * 0.6);
    }
    
    if (resultado.surpresa.preco.voo > orcamento) {
      resultado.surpresa.preco.voo = Math.round(orcamento * 0.9);
    }
  }
  
  // Pós-processamento para enriquecer os comentários da Tripinha nos dados de emergência
  if (resultado.topPick) {
    resultado.topPick.comentario = enriquecerComentarioTripinha(resultado.topPick.comentario, resultado.topPick.pontosTuristicos);
  }
  if (resultado.surpresa) {
    resultado.surpresa.comentario = enriquecerComentarioTripinha(resultado.surpresa.comentario, resultado.surpresa.pontosTuristicos);
  }
  
  return resultado;
}

// Função para determinar região de origem para dados de emergência mais relevantes
function determinarRegiaoOrigem(cidadeOrigem) {
  if (!cidadeOrigem) return 'global';
  
  const cidadeLowerCase = cidadeOrigem.toLowerCase();
  const regioesNorteAmerica = ['nova york', 'los angeles', 'chicago', 'toronto', 'cidade do méxico', 'montreal', 'miami', 'las vegas'];
  const regioesSulAmerica = ['são paulo', 'rio de janeiro', 'buenos aires', 'santiago', 'lima', 'bogotá', 'brasília', 'salvador'];
  const regioesEuropa = ['londres', 'paris', 'roma', 'madri', 'barcelona', 'berlim', 'amsterdã', 'lisboa'];
  const regioesAsia = ['tóquio', 'pequim', 'xangai', 'hong kong', 'singapura', 'seul', 'banguecoque', 'delhi'];
  const regioesOceania = ['sydney', 'melbourne', 'auckland', 'brisbane', 'perth', 'adelaide', 'wellington'];
  const regioesAfrica = ['cidade do cabo', 'joanesburgo', 'cairo', 'casablanca', 'nairobi', 'lagos', 'marrakech'];
  
  if (regioesNorteAmerica.some(cidade => cidadeLowerCase.includes(cidade))) return 'norte_america';
  if (regioesSulAmerica.some(cidade => cidadeLowerCase.includes(cidade))) return 'sul_america';
  if (regioesEuropa.some(cidade => cidadeLowerCase.includes(cidade))) return 'europa';
  if (regioesAsia.some(cidade => cidadeLowerCase.includes(cidade))) return 'asia';
  if (regioesOceania.some(cidade => cidadeLowerCase.includes(cidade))) return 'oceania';
  if (regioesAfrica.some(cidade => cidadeLowerCase.includes(cidade))) return 'africa';
  if (cidadeLowerCase.includes('brasil') || cidadeLowerCase.includes('brazil')) return 'sul_america';
  if (cidadeLowerCase.includes('eua') || cidadeLowerCase.includes('usa') || cidadeLowerCase.includes('estados unidos')) return 'norte_america';
  if (cidadeLowerCase.includes('europa') || cidadeLowerCase.includes('europe')) return 'europa';
  if (cidadeLowerCase.includes('ásia') || cidadeLowerCase.includes('asia')) return 'asia';
  return 'global';
}

// Função para gerar destinos por região (atualizada para incluir pontos turísticos)
function gerarDestinosPorRegiao(regiao, preferencia, orcamento) {
  const sulAmerica = {
    0: [
      {
        topPick: {
          destino: "Fernando de Noronha",
          pais: "Brasil",
          codigoPais: "BR",
          descricao: "Arquipélago paradisíaco com praias intocadas e vida marinha exuberante",
          porque: "Praias de águas cristalinas perfeitas para relaxamento e contato com a natureza preservada",
          destaque: "Mergulho com golfinhos na Baía dos Golfinhos e pôr do sol na Baía do Sancho",
          comentario: "Au au! Noronha tem praias perfeitas para cavar na areia e tomar banho de mar! A água é tão clarinha que dá para ver os peixinhos nadando! 🐾🌊",
          pontosTuristicos: ["Praia do Sancho", "Baía dos Porcos"],
          preco: { voo: Math.min(orcamento * 0.85, 1800), hotel: 450 }
        },
        alternativas: [
          {
            destino: "Jericoacoara",
            pais: "Brasil",
            codigoPais: "BR",
            porque: "Paraíso de dunas, lagoas e praias com clima descontraído e ótima infraestrutura",
            pontoTuristico: "Pedra Furada",
            preco: { voo: Math.min(orcamento * 0.7, 1100), hotel: 250 }
          },
          {
            destino: "Ilha Grande",
            pais: "Brasil",
            codigoPais: "BR",
            porque: "Ilha paradisíaca sem carros com praias desertas e trilhas na Mata Atlântica",
            pontoTuristico: "Praia de Lopes Mendes",
            preco: { voo: Math.min(orcamento * 0.5, 700), hotel: 280 }
          },
          {
            destino: "San Andrés",
            pais: "Colômbia",
            codigoPais: "CO",
            porque: "Ilha caribenha com mar de sete cores e praia de areia branca",
            pontoTuristico: "Johnny Cay",
            preco: { voo: Math.min(orcamento * 0.75, 1500), hotel: 220 }
          },
          {
            destino: "Punta del Este",
            pais: "Uruguai",
            codigoPais: "UY",
            porque: "Destino sofisticado com praias tranquilas e ótima gastronomia",
            pontoTuristico: "La Mano (Monumento Los Dedos)",
            preco: { voo: Math.min(orcamento * 0.6, 1200), hotel: 320 }
          }
        ],
        surpresa: {
          destino: "Ilha de Providencia",
          pais: "Colômbia",
          codigoPais: "CO",
          descricao: "Paraíso escondido no Caribe colombiano com águas cristalinas e poucos turistas",
          porque: "Destino isolado e autêntico longe das multidões com recifes de coral preservados",
          destaque: "Snorkeling em Crab Cay com visibilidade de mais de 30 metros",
          comentario: "Providencia é um segredo que poucos conhecem! Praias intocadas e um mar tão azul que nem parece real! Fiquei impressionada com tantos cheirinhos diferentes! 🐾🏝️",
          pontosTuristicos: ["Crab Cay", "Praia de Manzanillo"],
          preco: { voo: Math.min(orcamento * 0.9, 2000), hotel: 210 }
        }
      }
    ],
    1: [
      {
        topPick: {
          destino: "Chapada dos Veadeiros",
          pais: "Brasil",
          codigoPais: "BR",
          descricao: "Parque Nacional com cânions, cachoeiras e formações rochosas milenares",
          porque: "Combinação perfeita de trilhas desafiadoras e cachoeiras espetaculares para banhos refrescantes",
          destaque: "Trilha das 7 quedas d'água com banho nas piscinas naturais de água cristalina",
          comentario: "Chapada tem TANTAS trilhas incríveis para explorar e cachoeiras para mergulhar! Andei tanto que minhas patinhas ficaram cansadas, mas valeu cada passo! 🐾🌄",
          pontosTuristicos: ["Cachoeira Santa Bárbara", "Vale da Lua"],
          preco: { voo: Math.min(orcamento * 0.5, 800), hotel: 180 }
        },
        alternativas: [
          {
            destino: "Ushuaia",
            pais: "Argentina",
            codigoPais: "AR",
            porque: "Fim do mundo com trekking na Patagônia, navegação no Canal de Beagle e glaciares",
            pontoTuristico: "Parque Nacional Tierra del Fuego",
            preco: { voo: Math.min(orcamento * 0.8, 1700), hotel: 250 }
          },
          {
            destino: "Bonito",
            pais: "Brasil",
            codigoPais: "BR",
            porque: "Ecoturismo de ponta com flutuação em rios cristalinos e grutas impressionantes",
            pontoTuristico: "Gruta do Lago Azul",
            preco: { voo: Math.min(orcamento * 0.6, 900), hotel: 210 }
          },
          {
            destino: "Huacachina",
            pais: "Peru",
            codigoPais: "PE",
            porque: "Oásis no deserto com sandboarding e passeios de buggy nas dunas gigantes",
            pontoTuristico: "Dunas de Huacachina",
            preco: { voo: Math.min(orcamento * 0.75, 1300), hotel: 150 }
          },
          {
            destino: "San Pedro de Atacama",
            pais: "Chile",
            codigoPais: "CL",
            porque: "Deserto mais árido do mundo com paisagens lunares e fenômenos geotérmicos",
            pontoTuristico: "Vale da Lua (Valle de la Luna)",
            preco: { voo: Math.min(orcamento * 0.7, 1400), hotel: 190 }
          }
        ],
        surpresa: {
          destino: "Salar de Uyuni",
          pais: "Bolívia",
          codigoPais: "BO",
          descricao: "Maior deserto de sal do mundo com paisagens surreais e reflexos perfeitos",
          porque: "Experiência de aventura única em um dos cenários mais fotogênicos do planeta",
          destaque: "Tour de 3 dias visitando lagoas coloridas, gêiseres e formações rochosas",
          comentario: "Uyuni parece outro planeta! Quando o sal reflete o céu é impossível saber onde termina um e começa o outro! Nunca vi nada igual! 🐾🌈",
          pontosTuristicos: ["Ilha Incahuasi", "Laguna Colorada"],
          preco: { voo: Math.min(orcamento * 0.75, 1600), hotel: 140 }
        }
      }
    ]
  };
  
  const norteAmerica = {
    0: [
      {
        topPick: {
          destino: "Cancún",
          pais: "México",
          codigoPais: "MX",
          descricao: "Paraíso caribenho com praias de areia branca e águas turquesa",
          porque: "Resorts all-inclusive com praias deslumbrantes e opções para todos os orçamentos",
          destaque: "Relaxar em Playa Delfines com vista para o mar caribenho",
          comentario: "Cancún tem a areia mais macia que já pisei! E aquela água quentinha e azul é perfeita para um cachorro feliz! 🐾🏖️",
          pontosTuristicos: ["Ruínas de Tulum", "Ilha Mujeres"],
          preco: { voo: Math.min(orcamento * 0.7, 1900), hotel: 320 }
        },
        alternativas: [
          {
            destino: "Key West",
            pais: "Estados Unidos",
            codigoPais: "US",
            porque: "Ilha tropical com clima descontraído, praias tranquilas e pores do sol espetaculares",
            pontoTuristico: "Southernmost Point",
            preco: { voo: Math.min(orcamento * 0.85, 2200), hotel: 380 }
          },
          {
            destino: "Tulum",
            pais: "México",
            codigoPais: "MX",
            porque: "Combinação perfeita de praia paradisíaca, ruínas maias e cenotes místicos",
            pontoTuristico: "Zona Arqueológica de Tulum",
            preco: { voo: Math.min(orcamento * 0.75, 1800), hotel: 290 }
          },
          {
            destino: "Kauai",
            pais: "Estados Unidos",
            codigoPais: "US",
            porque: "A 'Ilha Jardim' do Havaí com praias intocadas e natureza exuberante",
            pontoTuristico: "Cânion Waimea",
            preco: { voo: Math.min(orcamento * 0.9, 3000), hotel: 410 }
          },
          {
            destino: "Palm Springs",
            pais: "Estados Unidos",
            codigoPais: "US",
            porque: "Oásis no deserto com piscinas, spas e atmosfera relaxante",
            pontoTuristico: "Aerial Tramway",
            preco: { voo: Math.min(orcamento * 0.8, 2100), hotel: 350 }
          }
        ],
        surpresa: {
          destino: "Little Corn Island",
          pais: "Nicarágua",
          codigoPais: "NI",
          descricao: "Ilha remota no Caribe nicaraguense sem carros e com praias desertas",
          porque: "Destino verdadeiramente isolado para relaxamento completo longe da civilização",
          destaque: "Snorkeling em recifes de coral preservados com tartarugas marinhas",
          comentario: "Little Corn é o verdadeiro paraíso escondido! Sem carros, só trilhas de terra e praias vazias! A vida simples com o mar mais lindo que você já viu! 🐾🌴",
          pontosTuristicos: ["Dolphin Rock", "Praia Otto Beach"],
          preco: { voo: Math.min(orcamento * 0.85, 2300), hotel: 180 }
        }
      }
    ]
  };
  
  const europa = {
    2: [
      {
        topPick: {
          destino: "Porto",
          pais: "Portugal",
          codigoPais: "PT",
          descricao: "Cidade histórica nas margens do Rio Douro com atmosfera autêntica",
          porque: "Combinação perfeita de cultura, gastronomia, arquitetura histórica e vinhos do Porto",
          destaque: "Visita às caves de vinho do Porto seguida de jantar com vista para o rio",
          comentario: "Porto é pura magia! Tantos cheirinhos de comida boa, ruas históricas para explorar e pessoas que adoram fazer carinho em cachorros! 🐾🍷",
          pontosTuristicos: ["Livraria Lello", "Ribeira"],
          preco: { voo: Math.min(orcamento * 0.8, 2800), hotel: 220 }
        },
        alternativas: [
          {
            destino: "Cracóvia",
            pais: "Polônia",
            codigoPais: "PL",
            porque: "Cidade medieval intacta com rica história, preços acessíveis e hospitalidade polonesa",
            pontoTuristico: "Wawel Castle",
            preco: { voo: Math.min(orcamento * 0.7, 2600), hotel: 180 }
          },
          {
            destino: "Sevilha",
            pais: "Espanha",
            codigoPais: "ES",
            porque: "Berço do flamenco com arquitetura mourisca, tapas deliciosas e atmosfera vibrante",
            pontoTuristico: "Alcázar de Sevilha",
            preco: { voo: Math.min(orcamento * 0.75, 2700), hotel: 210 }
          },
          {
            destino: "Budapeste",
            pais: "Hungria",
            codigoPais: "HU",
            porque: "Cidade termal dividida pelo Danúbio com arquitetura art nouveau e vida noturna",
            pontoTuristico: "Parlamento Húngaro",
            preco: { voo: Math.min(orcamento * 0.65, 2500), hotel: 170 }
          },
          {
            destino: "Bolonha",
            pais: "Itália",
            codigoPais: "IT",
            porque: "Capital gastronômica da Itália com arquitetura medieval e ótimas universidades",
            pontoTuristico: "As Duas Torres",
            preco: { voo: Math.min(orcamento * 0.85, 2900), hotel: 250 }
          }
        ],
        surpresa: {
          destino: "Lviv",
          pais: "Ucrânia",
          codigoPais: "UA",
          descricao: "Joia arquitetônica da Europa Oriental com influências austríacas e polonesas",
          porque: "Centro histórico UNESCO com cafés históricos, igrejas medievais e preços acessíveis",
          destaque: "Tour pelos antigos cafés literários e cervejarias artesanais da cidade",
          comentario: "Lviv é um segredo que poucos conhecem! Praças charmosas, cafés aconchegantes e pessoas super amigáveis que sempre têm um petisco para oferecer! 🐾☕",
          pontosTuristicos: ["Praça do Mercado", "Capela Boim"],
          preco: { voo: Math.min(orcamento * 0.7, 2600), hotel: 140 }
        }
      }
    ]
  };
  
  const global = {
    0: [
      {
        topPick: {
          destino: "Bali",
          pais: "Indonésia",
          codigoPais: "ID",
          descricao: "Ilha dos Deuses com praias, templos e cultura única",
          porque: "Equilibra perfeitamente relaxamento em praias e resorts com experiências culturais",
          destaque: "Retiro em Ubud com yoga, spa e vista para campos de arroz em terraços",
          comentario: "Bali tem energia especial! As praias são incríveis para correr e as pessoas sempre me dão petiscos nos templos! Que lugar abençoado! 🐾🌺",
          pontosTuristicos: ["Templo Tanah Lot", "Terraços de Arroz Tegallalang"],
          preco: { voo: Math.min(orcamento * 0.8, 3500), hotel: 200 }
        },
        alternativas: [
          {
            destino: "Santorini",
            pais: "Grécia",
            codigoPais: "GR",
            porque: "Ilha vulcânica com vistas deslumbrantes, vilas brancas e pores do sol inesquecíveis",
            pontoTuristico: "Vila de Oia",
            preco: { voo: Math.min(orcamento * 0.85, 3000), hotel: 350 }
          },
          {
            destino: "Maldivas",
            pais: "Maldivas",
            codigoPais: "MV",
            porque: "Destino de luxo com bangalôs sobre a água e recifes de coral exuberantes",
            pontoTuristico: "Playa Vaadhoo (Playa del Mar de Estrellas)",
            preco: { voo: Math.min(orcamento * 0.9, 4000), hotel: 500 }
          },
          {
            destino: "Koh Samui",
            pais: "Tailândia",
            codigoPais: "TH",
            porque: "Ilha tropical com praias de areia branca, spas requintados e comida deliciosa",
            pontoTuristico: "Big Buddha Temple",
            preco: { voo: Math.min(orcamento * 0.75, 3200), hotel: 180 }
          },
          {
            destino: "Seychelles",
            pais: "Seychelles",
            codigoPais: "SC",
            porque: "Arquipélago com algumas das praias mais bonitas do mundo e natureza intocada",
            pontoTuristico: "Praia Anse Source d'Argent",
            preco: { voo: Math.min(orcamento * 0.95, 4200), hotel: 400 }
          }
        ],
        surpresa: {
          destino: "Ilha de Socotra",
          pais: "Iêmen",
          codigoPais: "YE",
          descricao: "Ilha 'alienígena' com vegetação única no mundo e praias desconhecidas",
          porque: "Um dos lugares mais isolados e inexplorados do planeta, com biodiversidade única",
          destaque: "Caminhada entre as icônicas árvores de sangue de dragão, espécie endêmica da ilha",
          comentario: "Socotra parece outro planeta! Árvores que parecem guarda-chuvas virados e praias onde você não encontra mais ninguém! Um verdadeiro sonho de explorador! 🐾🌴",
          pontosTuristicos: ["Árvores de Sangue de Dragão", "Montanhas Hajhir"],
          preco: { voo: Math.min(orcamento * 0.85, 3700), hotel: 150 }
        }
      }
    ],
    1: [
      {
        topPick: {
          destino: "Queenstown",
          pais: "Nova Zelândia",
          codigoPais: "NZ",
          descricao: "Capital mundial dos esportes de aventura cercada por montanhas e lagos",
          porque: "Oferece a maior variedade de aventuras radicais em cenários naturais deslumbrantes",
          destaque: "Bungee jumping na ponte Kawarau, o primeiro ponto comercial de bungee do mundo",
          comentario: "Queenstown tem trilhas INCRÍVEIS para explorar e paisagens que fariam qualquer cachorro ficar de boca aberta! Eu latia de alegria a cada aventura! 🐾⛰️",
          pontosTuristicos: ["Ponte Kawarau", "Parque Nacional Fiordland"],
          preco: { voo: Math.min(orcamento * 0.8, 4000), hotel: 260 }
        },
        alternativas: [
          {
            destino: "Interlaken",
            pais: "Suíça",
            codigoPais: "CH",
            porque: "Hub de aventuras alpinas com parapente, canyoning e esqui em cenário de montanhas",
            pontoTuristico: "Jungfraujoch",
            preco: { voo: Math.min(orcamento * 0.85, 3200), hotel: 290 }
          },
          {
            destino: "Moab",
            pais: "Estados Unidos",
            codigoPais: "US",
            porque: "Meca do mountain bike com trilhas desafiadoras e parques nacionais espetaculares",
            pontoTuristico: "Arches National Park",
            preco: { voo: Math.min(orcamento * 0.7, 2800), hotel: 230 }
          },
          {
            destino: "Chiang Mai",
            pais: "Tailândia",
            codigoPais: "TH",
            porque: "Trekking na selva, rafting em rios de corredeiras e passeios com elefantes resgatados",
            pontoTuristico: "Elephant Nature Park",
            preco: { voo: Math.min(orcamento * 0.8, 3300), hotel: 150 }
          },
          {
            destino: "Victoria Falls",
            pais: "Zâmbia",
            codigoPais: "ZM",
            porque: "Maior queda d'água do mundo com bungee jumping, rafting e safáris próximos",
            pontoTuristico: "Devil's Pool",
            preco: { voo: Math.min(orcamento * 0.9, 3600), hotel: 200 }
          }
        ],
        surpresa: {
          destino: "Svalbard",
          pais: "Noruega",
          codigoPais: "NO",
          descricao: "Arquipélago no Ártico com ursos polares, expedições de caiaque e auroras boreais",
          porque: "A última fronteira: aventura no extremo norte do planeta com paisagens árticas surreais",
          destaque: "Expedição de snowmobile durante a noite polar para ver a aurora boreal dançando no céu",
          comentario: "Svalbard é um sonho branco! Faz frio nas patinhas, mas a aventura de ver os ursos polares (de longe!) e a aurora boreal vale cada segundo! 🐾❄️",
          pontosTuristicos: ["Pyramiden (Cidade Fantasma)", "Longyearbyen"],
          preco: { voo: Math.min(orcamento * 0.9, 3900), hotel: 280 }
        }
      }
    ],
    2: [
      {
        topPick: {
          destino: "Kyoto",
          pais: "Japão",
          codigoPais: "JP",
          descricao: "Antiga capital japonesa com mais de 1.600 templos budistas e jardins zen",
          porque: "Imersão profunda na cultura tradicional japonesa com cerimônias do chá e gueixas",
          destaque: "Visita ao templo Fushimi Inari com seus milhares de portões torii vermelho-laranja",
          comentario: "Kyoto tem tanta história e tantos cheiros diferentes! Os templos são calmos e os jardins perfeitos para passear tranquilamente! 🐾🏮",
          pontosTuristicos: ["Fushimi Inari Taisha", "Templo Kinkaku-ji (Pavilhão Dourado)"],
          preco: { voo: Math.min(orcamento * 0.9, 3800), hotel: 270 }
        },
        alternativas: [
          {
            destino: "Istambul",
            pais: "Turquia",
            codigoPais: "TR",
            porque: "Cidade que conecta Europa e Ásia com mesquitas impressionantes e bazaars históricos",
            pontoTuristico: "Hagia Sophia",
            preco: { voo: Math.min(orcamento * 0.8, 3000), hotel: 180 }
          },
          {
            destino: "Varanasi",
            pais: "Índia",
            codigoPais: "IN",
            porque: "Uma das cidades mais antigas do mundo com cerimônias espirituais no rio Ganges",
            pontoTuristico: "Dashashwamedh Ghat",
            preco: { voo: Math.min(orcamento * 0.85, 3200), hotel: 120 }
          },
          {
            destino: "Marrakech",
            pais: "Marrocos",
            codigoPais: "MA",
            porque: "Labirinto de medinas, souks coloridos e palácios ornamentados com influência berbere",
            pontoTuristico: "Jardim Majorelle",
            preco: { voo: Math.min(orcamento * 0.7, 2800), hotel: 150 }
          },
          {
            destino: "Luang Prabang",
            pais: "Laos",
            codigoPais: "LA",
            porque: "Cidade patrimônio mundial com templos dourados, monges budistas e atmosfera tranquila",
            pontoTuristico: "Templo Wat Xieng Thong",
            preco: { voo: Math.min(orcamento * 0.8, 3300), hotel: 130 }
          }
        ],
        surpresa: {
          destino: "Yazd",
          pais: "Irã",
          codigoPais: "IR",
          descricao: "Cidade antiga no deserto com arquitetura zoroastriana e torres do vento",
          porque: "Experiência cultural autêntica em uma das cidades mais bem preservadas do Oriente Médio",
          destaque: "Visita ao Templo do Fogo de Zoroastro, onde uma chama arde continuamente há 1.500 anos",
          comentario: "Yazd é uma descoberta incrível! Labirintos de ruas de barro, torres que capturam o vento e pessoas tão hospitaleiras que sempre me ofereciam água fresca! 🐾🕌",
          pontosTuristicos: ["Torres do Vento (Badgirs)", "Templo do Fogo Zoroastriano"],
          preco: { voo: Math.min(orcamento * 0.8, 3100), hotel: 100 }
        }
      }
    ],
    3: [
      {
        topPick: {
          destino: "Singapura",
          pais: "Singapura",
          codigoPais: "SG",
          descricao: "Cidade-estado futurista com arquitetura inovadora e fusão cultural",
          porque: "Experiência urbana completa com compras, gastronomia, vida noturna e atrações inovadoras",
          destaque: "Visita noturna aos jardins Gardens by the Bay com show de luzes na floresta de super-árvores",
          comentario: "Singapura é a cidade mais limpa que já visitei! Os jardins são incríveis para passear e tem tantos restaurantes com cheiros deliciosos! 🐾🌆",
          pontosTuristicos: ["Gardens by the Bay", "Marina Bay Sands"],
          preco: { voo: Math.min(orcamento * 0.85, 3500), hotel: 300 }
        },
        alternativas: [
          {
            destino: "Berlim",
            pais: "Alemanha",
            codigoPais: "DE",
            porque: "Capital cultural europeia com história fascinante, arte de rua e vida noturna lendária",
            pontoTuristico: "East Side Gallery",
            preco: { voo: Math.min(orcamento * 0.8, 3000), hotel: 250 }
          },
          {
            destino: "Melbourne",
            pais: "Austrália",
            codigoPais: "AU",
            porque: "Capital cultural australiana com cena gastronômica vibrante e arte urbana",
            pontoTuristico: "Federation Square",
            preco: { voo: Math.min(orcamento * 0.9, 4000), hotel: 280 }
          },
          {
            destino: "Cidade do México",
            pais: "México",
            codigoPais: "MX",
            porque: "Megalópole com história milenar, museus de classe mundial e gastronomia premiada",
            pontoTuristico: "Museo Frida Kahlo",
            preco: { voo: Math.min(orcamento * 0.7, 2500), hotel: 220 }
          },
          {
            destino: "Montreal",
            pais: "Canadá",
            codigoPais: "CA",
            porque: "Cidade com charme europeu na América do Norte, rica em cultura e festivais",
            pontoTuristico: "Old Montreal",
            preco: { voo: Math.min(orcamento * 0.75, 2700), hotel: 260 }
          }
        ],
        surpresa: {
          destino: "Tallinn",
          pais: "Estônia",
          codigoPais: "EE",
          descricao: "Capital medieval com centro histórico perfeito e cultura digital avançada",
          porque: "Mistura fascinante entre cidade medieval perfeitamente preservada e hub tecnológico inovador",
          destaque: "Explorar o bairro Telliskivi Creative City com seus cafés hipsters e arte urbana",
          comentario: "Tallinn parece um conto de fadas com tecnologia! Você pode passear nas ruas de pedra medievais e depois trabalhar em cafés super modernos! A comida é deliciosa! 🐾🏰",
          pontosTuristicos: ["Centro Histórico de Tallinn", "Kadriorg Palace"],
          preco: { voo: Math.min(orcamento * 0.8, 3200), hotel: 180 }
        }
      }
    ]
  };
  
  switch (regiao) {
    case 'sul_america':
      return sulAmerica;
    case 'norte_america':
      return norteAmerica;
    case 'europa':
      return europa;
    default:
      return global;
  }
}

// Função para gerar destinos extras para complementar quando necessário (atualizada com pontos turísticos)
function gerarDestinosExtras(regiao, orcamento) {
  const extrasGlobal = [
    {
      destino: "Lisboa",
      pais: "Portugal",
      codigoPais: "PT",
      porque: "Capital portuguesa com charme histórico, preços acessíveis e ótima gastronomia",
      pontoTuristico: "Torre de Belém",
      preco: { voo: Math.min(orcamento * 0.7, 2800), hotel: 220 }
    },
    {
      destino: "Bangkok",
      pais: "Tailândia",
      codigoPais: "TH",
      porque: "Metrópole vibrante com cultura rica, templos dourados e comida de rua incrível",
      pontoTuristico: "Grande Palácio Real",
      preco: { voo: Math.min(orcamento * 0.8, 3200), hotel: 150 }
    },
    {
      destino: "Cidade do Cabo",
      pais: "África do Sul",
      codigoPais: "ZA",
      porque: "Combinação de cidade cosmopolita, praias deslumbrantes e safáris próximos",
      pontoTuristico: "Table Mountain",
      preco: { voo: Math.min(orcamento * 0.85, 3600), hotel: 200 }
    },
    {
      destino: "Vancouver",
      pais: "Canadá",
      codigoPais: "CA",
      porque: "Cidade cercada por montanhas e oceano com qualidade de vida excepcional",
      pontoTuristico: "Stanley Park",
      preco: { voo: Math.min(orcamento * 0.75, 2700), hotel: 280 }
    },
    {
      destino: "Quioto",
      pais: "Japão",
      codigoPais: "JP",
      porque: "Antiga capital japonesa com mais de 1.600 templos e tradições preservadas",
      pontoTuristico: "Arashiyama Bamboo Grove",
      preco: { voo: Math.min(orcamento * 0.9, 3500), hotel: 250 }
    },
    {
      destino: "Ljubljana",
      pais: "Eslovênia",
      codigoPais: "SI",
      porque: "Capital europeia verde com castelo medieval e atmosfera de conto de fadas",
      pontoTuristico: "Ponte do Dragão",
      preco: { voo: Math.min(orcamento * 0.7, 2800), hotel: 190 }
    }
  ];
  
  const extrasSulAmerica = [
    {
      destino: "Olinda",
      pais: "Brasil",
      codigoPais: "BR",
      porque: "Cidade histórica com casario colonial colorido e rica tradição cultural",
      pontoTuristico: "Mosteiro de São Bento",
      preco: { voo: Math.min(orcamento * 0.6, 900), hotel: 180 }
    },
    {
      destino: "Bariloche",
      pais: "Argentina",
      codigoPais: "AR",
      porque: "Cenário alpino na Patagônia com lagos, montanhas e chocolate artesanal",
      pontoTuristico: "Cerro Catedral",
      preco: { voo: Math.min(orcamento * 0.7, 1400), hotel: 220 }
    },
    {
      destino: "Cartagena",
      pais: "Colômbia",
      codigoPais: "CO",
      porque: "Cidade colonial murada no Caribe com casas coloridas e atmosfera vibrante",
      pontoTuristico: "Ciudad Amurallada",
      preco: { voo: Math.min(orcamento * 0.75, 1500), hotel: 210 }
    },
    {
      destino: "Paraty",
      pais: "Brasil",
      codigoPais: "BR",
      porque: "Vila colonial histórica entre a mata atlântica e o mar com ruas de pedra",
      pontoTuristico: "Centro Histórico de Paraty",
      preco: { voo: Math.min(orcamento * 0.5, 800), hotel: 250 }
    }
  ];
  
  const extrasRegionais = regiao === 'sul_america' ? extrasSulAmerica : extrasGlobal;
  return embaralharArray([...extrasRegionais]);
}

// Função auxiliar para embaralhar arrays (útil para reordenar destinos)
function embaralharArray(array) {
  let currentIndex = array.length;
  let randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}
