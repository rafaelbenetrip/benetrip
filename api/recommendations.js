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
      prompt = "Recomende destinos de viagem únicos e personalizados para o Brasil e mundo. Um destino principal, 4 destinos alternativos diferentes entre si, e um destino surpresa diferente dos demais. Para cada destino, forneça 2-3 pontos turísticos específicos para visitar. Priorize URGENTEMENTE respeitar o orçamento máximo para voos. Responda em formato JSON.";
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
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: "perplexity",
                conteudo: response,
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
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: "openai",
                conteudo: response,
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
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: "claude",
                conteudo: response,
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
      prompt = `${prompt}\n\nURGENTE: O ORÇAMENTO MÁXIMO para voos (${requestData.orcamento_valor || 'informado'} ${requestData.moeda_escolhida || 'BRL'}) precisa ser RIGOROSAMENTE RESPEITADO. TODOS os destinos devem ter voos COM VALOR ABAIXO desse orçamento. Forneça um mix de destinos populares e alternativos, todos com preços realistas e acessíveis. PARA CADA DESTINO, INDIQUE 2-3 PONTOS TURÍSTICOS ESPECÍFICOS E CONHECIDOS.`;
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

// Chamar a API da Perplexity com melhor tratamento de erros
async function callPerplexityAPI(prompt, requestData) {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave da API Perplexity não configurada');
    }
    
    console.log('Enviando requisição para Perplexity...');
    
    // Reforçar a mensagem sobre orçamento como prioridade absoluta
    const orcamentoMessage = requestData.orcamento_valor ? 
      `\n\n⚠️ ORÇAMENTO MÁXIMO: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'} para voos (ida e volta por pessoa). Todos os destinos DEVEM ter preços de voo ABAIXO deste valor. Este é o requisito MAIS IMPORTANTE.` : '';
    
    // Construir instruções claras para não usar formatação markdown
    const enhancedPrompt = `${prompt}${orcamentoMessage}\n\nIMPORTANTE: 
    1. Cada voo DEVE respeitar rigorosamente o orçamento máximo indicado.
    2. Retorne APENAS o JSON puro, sem marcação markdown ou comentários.
    3. Forneça EXATAMENTE 4 destinos alternativos totalmente diferentes entre si.
    4. Garanta preços realistas e acessíveis para todas as recomendações.
    5. Para cada destino, inclua 2-3 PONTOS TURÍSTICOS ESPECÍFICOS que sejam conhecidos ou representativos.`;
    
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
            content: 'Você é um especialista em viagens focado em fornecer recomendações personalizadas globais para vários orçamentos. Sua prioridade #1 é NUNCA exceder o orçamento máximo indicado para passagens aéreas. Forneça um mix balanceado de destinos populares e alternativos, adequados ao perfil do viajante. Retorne APENAS JSON puro. SEMPRE forneça EXATAMENTE 4 destinos alternativos e inclua pontos turísticos específicos para cada destino.'
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.7, // Reduzindo temperatura para priorizar precisão nos preços
        max_tokens: 2000,
        response_format: { type: "text" }
      },
      timeout: REQUEST_TIMEOUT,
      // Adicionar keepalive para conexão persistente
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
    
    // Reforçar a mensagem sobre orçamento como prioridade absoluta
    const orcamentoMessage = requestData.orcamento_valor ? 
      `\n\n⚠️ ORÇAMENTO MÁXIMO: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'} para voos (ida e volta por pessoa). Todos os destinos DEVEM ter preços de voo ABAIXO deste valor. Este é o requisito MAIS IMPORTANTE.` : '';
    
    // Modificar o prompt para pedir explicitamente resposta em JSON
    const enhancedPrompt = `${prompt}${orcamentoMessage}\n\nIMPORTANTE: 
    1. Cada voo DEVE respeitar rigorosamente o orçamento máximo indicado.
    2. Sua resposta deve ser exclusivamente um objeto JSON válido sem formatação markdown. 
    3. Forneça EXATAMENTE 4 destinos alternativos totalmente diferentes entre si.
    4. Garanta preços realistas e acessíveis para todas as recomendações.
    5. Para cada destino, inclua 2-3 PONTOS TURÍSTICOS ESPECÍFICOS e conhecidos.`;
    
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
            content: "Você é um especialista em viagens focado em fornecer recomendações personalizadas globais para vários orçamentos. Sua prioridade #1 é NUNCA exceder o orçamento máximo indicado para passagens aéreas. Forneça um mix balanceado de destinos populares e alternativos, adequados ao perfil do viajante. Retorne APENAS JSON puro. SEMPRE forneça EXATAMENTE 4 destinos alternativos e inclua pontos turísticos específicos para cada destino."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        temperature: 0.7, // Reduzindo temperatura para priorizar precisão nos preços
        max_tokens: 2000
      },
      timeout: REQUEST_TIMEOUT,
      // Adicionar keepalive para conexão persistente
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
    
    // Reforçar a mensagem sobre orçamento como prioridade absoluta
    const orcamentoMessage = requestData.orcamento_valor ? 
      `\n\n⚠️ ORÇAMENTO MÁXIMO: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'} para voos (ida e volta por pessoa). Todos os destinos DEVEM ter preços de voo ABAIXO deste valor. Este é o requisito MAIS IMPORTANTE.` : '';
    
    // Adicionar instrução específica para o Claude retornar apenas JSON
    const enhancedPrompt = `${prompt}${orcamentoMessage}\n\nIMPORTANTE: 
    1. Cada voo DEVE respeitar rigorosamente o orçamento máximo indicado.
    2. Sua resposta deve ser APENAS o objeto JSON válido, sem NENHUM texto adicional.
    3. Forneça EXATAMENTE 4 destinos alternativos totalmente diferentes entre si.
    4. Garanta preços realistas e acessíveis para todas as recomendações.
    5. Para cada destino, inclua 2-3 PONTOS TURÍSTICOS ESPECÍFICOS e CONHECIDOS.`;
    
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
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content: "Você é um especialista em viagens focado em fornecer recomendações personalizadas globais para vários orçamentos. Sua prioridade #1 é NUNCA exceder o orçamento máximo indicado para passagens aéreas. Forneça um mix balanceado de destinos populares e alternativos, adequados ao perfil do viajante. Retorne APENAS JSON puro. SEMPRE forneça EXATAMENTE 4 destinos alternativos e inclua pontos turísticos específicos para cada destino."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        temperature: 0.7 // Reduzindo temperatura para priorizar precisão nos preços
      },
      timeout: REQUEST_TIMEOUT,
      // Adicionar keepalive para conexão persistente
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

// Função otimizada de validação para responder mais rapidamente
function isValidDestinationJSON(jsonString, requestData) {
  if (!jsonString) return false;
  
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    
    // Verificação rápida de campos obrigatórios
    if (!data.topPick?.destino || !data.alternativas || !data.surpresa?.destino) {
      console.log("JSON inválido: faltam campos obrigatórios básicos");
      return false;
    }
    
    // Verificação de tamanho exato para alternativas
    if (!Array.isArray(data.alternativas) || data.alternativas.length !== 4) {
      console.log(`JSON inválido: array de alternativas deve conter exatamente 4 destinos (contém ${data.alternativas?.length || 0})`);
      return false;
    }
    
    // Verificação de pontos turísticos para o destino principal
    // Não exigiremos estritamente, mas logamos para informação
    if (!data.topPick.pontosTuristicos && !data.topPick.pontoTuristico) {
      console.log("Aviso: topPick não contém pontos turísticos");
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

  // NOVA SEÇÃO - Colocar orçamento com destaque prioritário
  const mensagemOrcamento = orcamento !== 'flexível' ?
    `⚠️ ORÇAMENTO MÁXIMO: ${orcamento} ${moeda} para voos (ida e volta por pessoa). Todos os destinos DEVEM ter preços de voo ABAIXO deste valor.` : 
    'Orçamento flexível';
    
  // Adicionar sugestão de localidade baseada na origem
  const sugestaoDistancia = gerarSugestaoDistancia(cidadeOrigem, tipoDestino);

  // Construir prompt detalhado e personalizado (MODIFICADO)
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
8. Para CADA destino, forneça 2-3 pontos turísticos específicos e conhecidos para visitar.

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
    "pontosTuristicos": ["Ponto turístico 1", "Ponto turístico 2", "Ponto turístico 3"],
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
      "pontoTuristico": "Atrações para visitar neste destino",
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
      "pontoTuristico": "Atrações para visitar neste destino",
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
      "pontoTuristico": "Atrações para visitar neste destino",
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
      "pontoTuristico": "Atrações para visitar neste destino",
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
    "pontosTuristicos": ["Ponto turístico surpresa 1", "Ponto turístico surpresa 2"],
    "preco": {
      "voo": número,
      "hotel": número
    }
  }
}`;
}

// NOVA FUNÇÃO: Determinar o hemisfério baseado na cidade de origem
function determinarHemisferio(cidadeOrigem) {
  // Lista simplificada de grandes cidades no hemisfério sul
  const cidadesHemisferioSul = [
    'são paulo', 'rio de janeiro', 'brasília', 'salvador', 'fortaleza', 
    'recife', 'porto alegre', 'curitiba', 'manaus', 'belém', 'brasil',
    'buenos aires', 'santiago', 'lima', 'bogotá', 'quito', 'caracas',
    'sydney', 'melbourne', 'brisbane', 'perth', 'auckland', 'wellington',
    'cidade do cabo', 'joanesburgo', 'pretória', 'durban', 'luanda', 'maputo'
  ];
  
  if (!cidadeOrigem || cidadeOrigem === 'origem não especificada') {
    return 'norte'; // Padrão para o caso de não sabermos
  }
  
  const cidadeLowerCase = cidadeOrigem.toLowerCase();
  
  // Verificar se a cidade está na lista do hemisfério sul
  if (cidadesHemisferioSul.some(cidade => cidadeLowerCase.includes(cidade))) {
    return 'sul';
  }
  
  return 'norte';
}

// NOVA FUNÇÃO: Gerar sugestão de distância de viagem baseada na origem
function gerarSugestaoDistancia(cidadeOrigem, tipoDestino) {
  if (cidadeOrigem === 'origem não especificada') {
    return '';
  }
  
  // Se o usuário prefere destinos nacionais
  if (tipoDestino === 0) {
    return '';
  }
  
  // Lista de grandes hubs internacionais
  const grandeshubs = [
    'nova york', 'londres', 'paris', 'tóquio', 'dubai', 
    'frankfurt', 'hong kong', 'singapura', 'amsterdã',
    'bangkok', 'são paulo', 'cidade do méxico'
  ];
  
  const cidadeLowerCase = cidadeOrigem.toLowerCase();
  
  // Se a origem for um grande hub, sugerir destinos mais distantes
  if (grandeshubs.some(cidade => cidadeLowerCase.includes(cidade))) {
    return '(considere incluir destinos intercontinentais nas opções)';
  }
  
  return '(considere a distância e acessibilidade a partir desta origem)';
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

// Função simplificada para gerar dados de emergência sem bancos de dados extensos
function generateEmergencyData(dadosUsuario = {}) {
  // Extrair orçamento para ajustar preços de emergência
  const orcamento = dadosUsuario.orcamento_valor ? parseFloat(dadosUsuario.orcamento_valor) : 3000;
  const tipoPreferencia = dadosUsuario.preferencia_viagem || 0;
  
  // Base minimalista de dados para emergência
  const dadosEmergencia = {
    topPick: {
      destino: "Barcelona",
      pais: "Espanha",
      codigoPais: "ES",
      descricao: "Cidade mediterrânea com arquitetura única de Gaudí e praias urbanas",
      porque: "Combinação perfeita de cultura, gastronomia, praia e vida noturna vibrante",
      destaque: "Passeio pela Sagrada Família e tarde relaxante no Parque Güell",
      comentario: "Barcelona é incrível! Tantos cheiros de tapas, música de rua e praias onde posso correr livremente! O melhor da Europa em uma cidade só! 🐾🌊",
      pontosTuristicos: ["Sagrada Família", "Parque Güell", "La Rambla", "Bairro Gótico"],
      preco: {
        voo: Math.round(orcamento * 0.85),
        hotel: 280
      }
    },
    alternativas: [
      {
        destino: "Lisboa",
        pais: "Portugal",
        codigoPais: "PT",
        porque: "Cidade charmosa com clima agradável, culinária deliciosa e preços acessíveis",
        pontoTuristico: "Torre de Belém, Mosteiro dos Jerônimos e bairro de Alfama",
        preco: {
          voo: Math.round(orcamento * 0.75),
          hotel: 230
        }
      },
      {
        destino: "Tóquio",
        pais: "Japão",
        codigoPais: "JP",
        porque: "Metrópole futurista com tradição milenar, tecnologia de ponta e gastronomia refinada",
        pontoTuristico: "Templo Senso-ji, Shibuya Crossing e Torre de Tóquio",
        preco: {
          voo: Math.round(orcamento * 0.9),
          hotel: 320
        }
      },
      {
        destino: "Buenos Aires",
        pais: "Argentina",
        codigoPais: "AR",
        porque: "Capital latina com rica cultura, arquitetura europeia e paixão pelo tango",
        pontoTuristico: "Teatro Colón, Plaza de Mayo e bairro La Boca",
        preco: {
          voo: Math.round(orcamento * 0.6),
          hotel: 190
        }
      },
      {
        destino: "Cidade do Cabo",
        pais: "África do Sul",
        codigoPais: "ZA",
        porque: "Mistura de cidade, natureza, safáris e vinícolas em um só destino",
        pontoTuristico: "Table Mountain, Cabo da Boa Esperança e Robben Island",
        preco: {
          voo: Math.round(orcamento * 0.82),
          hotel: 240
        }
      }
    ],
    surpresa: {
      destino: "Ljubljana",
      pais: "Eslovênia",
      codigoPais: "SI",
      descricao: "Capital europeia verde com castelo medieval e atmosfera de conto de fadas",
      porque: "Cidade encantadora pouco explorada com natureza exuberante nas proximidades",
      destaque: "Passeio pela Ponte dos Dragões e navegação no rio Ljubljanica",
      comentario: "Ljubljana é um segredo da Europa! Ruas de pedestres, cafés à beira-rio e pessoas super amigáveis que sempre me ofereciam petiscos! Uma joia escondida! 🐾🏰",
      pontosTuristicos: ["Castelo de Ljubljana", "Ponte dos Dragões", "Mercado Central", "Parque Tivoli"],
      preco: {
        voo: Math.round(orcamento * 0.78),
        hotel: 180
      }
    }
  };
  
  // Ajustar o tema dos destinos conforme a preferência do viajante
  if (tipoPreferencia === 1) { // Aventura 
    dadosEmergencia.topPick = {
      destino: "Queenstown",
      pais: "Nova Zelândia",
      codigoPais: "NZ",
      descricao: "Capital mundial dos esportes de aventura com cenários naturais deslumbrantes",
      porque: "Oferece a maior variedade de aventuras radicais em paisagens de tirar o fôlego",
      destaque: "Bungee jumping original do mundo e passeios de jet boat pelo desfiladeiro",
      comentario: "Queenstown é um paraíso para cachorros aventureiros! Trilhas sem fim, montanhas nevadas e pessoas super animadas! Melhor lugar para quem gosta de ar livre! 🐾🏔️",
      pontosTuristicos: ["Coronet Peak", "Lake Wakatipu", "Shotover Canyon", "The Remarkables"],
      preco: {
        voo: Math.round(orcamento * 0.93),
        hotel: 260
      }
    };
    
    // Ajustar algumas alternativas para aventura
    dadosEmergencia.alternativas[1] = {
      destino: "Interlaken",
      pais: "Suíça",
      codigoPais: "CH",
      porque: "Centro de aventuras alpinas com parapente, canyoning e esqui em cenário espetacular",
      pontoTuristico: "Jungfrau, Lagos Thun e Brienz, trilha Hardergrat",
      preco: {
        voo: Math.round(orcamento * 0.85),
        hotel: 290
      }
    };
  }
  else if (tipoPreferencia === 0) { // Relaxamento
    dadosEmergencia.topPick = {
      destino: "Maldivas",
      pais: "Maldivas",
      codigoPais: "MV",
      descricao: "Arquipélago paradisíaco com águas cristalinas e bangalôs sobre a água",
      porque: "Refúgio perfeito para relaxamento completo em praias imaculadas e resorts exclusivos",
      destaque: "Snorkeling com raias e tubarões-baleia em águas turquesa transparentes",
      comentario: "Maldivas é o paraíso na Terra! A água mais azul que já vi e areia tão branca que parece neve! Posso correr pela praia o dia inteiro! 🐾🏝️",
      pontosTuristicos: ["Atolão Malé Norte", "Ilha Maafushi", "Recife de Banana", "Spa sobre a água"],
      preco: {
        voo: Math.round(orcamento * 0.92),
        hotel: 550
      }
    };
  }
  
  return dadosEmergencia;
}

// Simplificar o embaralhamento de arrays para diversidade
function embaralharArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
