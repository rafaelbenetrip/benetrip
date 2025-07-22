// api/itinerary-generator.js - Endpoint para geração de roteiro personalizado
const axios = require('axios');

// Chaves de API
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Modelo padrão a ser usado (DeepSeek Coder)
const DEFAULT_MODEL = 'deepseek-chat';

// Função auxiliar para logging estruturado
function logEvent(type, message, data = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    message,
    ...data
  };
  console.log(JSON.stringify(log));
}

/**
 * Gera um roteiro personalizado através da API Deepseek ou Claude
 */
module.exports = async (req, res) => {
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Responder a preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }
  
  try {
    // Obter parâmetros do corpo da requisição
    const {
      destino,
      pais,
      dataInicio,
      dataFim,
      horaChegada,
      horaSaida,
      tipoViagem,
      tipoCompanhia,
      preferencias,
      modeloIA
    } = req.body;
    
    // Validar parâmetros obrigatórios
    if (!destino || !dataInicio) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: destino, dataInicio' });
    }
    
    // Calcular número de dias SEM FALLBACKS
    const diasViagem = calcularDiasViagem(dataInicio, dataFim);
    
    // Log dos parâmetros recebidos
    logEvent('info', 'Gerando roteiro personalizado', {
      destino,
      pais,
      diasViagem,
      tipoViagem,
      tipoCompanhia,
      dataInicio,
      dataFim
    });
    
    // Gerar o prompt para a IA
    const prompt = gerarPromptRoteiro({
      destino,
      pais,
      dataInicio,
      dataFim,
      horaChegada,
      horaSaida,
      diasViagem,
      tipoViagem,
      tipoCompanhia,
      preferencias
    });
    
    // Selecionar o modelo de IA a ser usado
    const modelo = modeloIA || DEFAULT_MODEL;
    
    // Gerar o roteiro usando a API correspondente
    let roteiro;
    
    if (modelo === 'claude') {
      roteiro = await gerarRoteiroComClaude(prompt, diasViagem);
    } else {
      roteiro = await gerarRoteiroComDeepseek(prompt, diasViagem);
    }
    
    // Verificar se o roteiro foi gerado com sucesso
    if (!roteiro) {
      throw new Error('Falha ao gerar roteiro');
    }
    
    // Log de sucesso
    logEvent('info', 'Roteiro gerado com sucesso', {
      destino: roteiro.destino,
      totalDias: roteiro.dias.length,
      primeiroDia: roteiro.dias[0]?.data,
      ultimoDia: roteiro.dias[roteiro.dias.length - 1]?.data
    });
    
    // Retornar o roteiro gerado
    return res.status(200).json(roteiro);
    
  } catch (erro) {
    // Log do erro
    logEvent('error', 'Erro ao gerar roteiro', {
      message: erro.message,
      stack: erro.stack
    });
    
    // Retornar erro
    return res.status(500).json({
      error: 'Erro ao gerar roteiro personalizado',
      details: erro.message
    });
  }
};

/**
 * Calcula o número de dias entre duas datas SEM FALLBACKS
 * @param {string} dataInicio - Data de início no formato YYYY-MM-DD
 * @param {string} dataFim - Data de fim no formato YYYY-MM-DD
 * @returns {number} Número de dias
 */
function calcularDiasViagem(dataInicio, dataFim) {
  if (!dataInicio) {
    throw new Error('Data de início é obrigatória');
  }
  
  const inicio = new Date(dataInicio + 'T12:00:00');
  
  if (isNaN(inicio.getTime())) {
    throw new Error(`Data de início inválida: ${dataInicio}`);
  }
  
  // Se não tiver data fim, é erro - não assumir nada
  if (!dataFim) {
    throw new Error('Data de fim é obrigatória');
  }
  
  const fim = new Date(dataFim + 'T12:00:00');
  
  if (isNaN(fim.getTime())) {
    throw new Error(`Data de fim inválida: ${dataFim}`);
  }
  
  // Calcular diferença em dias
  const diffMs = fim - inicio;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  
  if (diffDias < 1) {
    throw new Error('Data de fim deve ser posterior à data de início');
  }
  
  if (diffDias > 21) {
    throw new Error('Roteiro limitado a máximo 21 dias');
  }
  
  logEvent('info', 'Dias calculados', {
    dataInicio,
    dataFim,
    diasCalculados: diffDias
  });
  
  return diffDias;
}

/**
 * Gera o prompt para a IA baseado nos parâmetros
 * @param {Object} params - Parâmetros para o prompt
 * @returns {string} Prompt formatado
 */
function gerarPromptRoteiro(params) {
  const {
    destino,
    pais,
    dataInicio,
    dataFim,
    horaChegada,
    horaSaida,
    diasViagem,
    tipoViagem,
    tipoCompanhia,
    preferencias
  } = params;
  
  // Mapear o tipo de viagem para descrição
  const descricaoTipoViagem = {
    'relaxar': 'relaxamento e descanso',
    'aventura': 'aventura e adrenalina',
    'cultura': 'cultura, história e gastronomia',
    'urbano': 'urbanismo, compras e vida noturna'
  }[tipoViagem] || 'cultura e experiências variadas';
  
  // Mapear o tipo de companhia para descrição
  const descricaoTipoCompanhia = {
    'sozinho': 'uma pessoa viajando sozinha',
    'casal': 'um casal em viagem romântica',
    'familia': 'uma família com crianças',
    'amigos': 'um grupo de amigos'
  }[tipoCompanhia] || 'um viajante';
  
  // Mapear intensidade e orçamento
  const intensidadeInfo = {
    'leve': '2-3 atividades por dia (ritmo relaxado)',
    'moderado': '4-5 atividades por dia (ritmo equilibrado)',
    'intenso': '6+ atividades por dia (ritmo acelerado)'
  };
  
  const orcamentoInfo = {
    'economico': 'econômico (priorize atividades gratuitas e de baixo custo)',
    'medio': 'médio (misture atividades gratuitas e pagas)',
    'alto': 'alto (inclua experiências premium sem limitações de custo)'
  };
  
  // Criar informações detalhadas de viajantes
  let infoViajantes = descricaoTipoCompanhia;
  if (tipoCompanhia === 'familia' && preferencias) {
    const adultos = preferencias.quantidade_adultos || 2;
    const criancas = preferencias.quantidade_criancas || 0;
    const bebes = preferencias.quantidade_bebes || 0;
    infoViajantes += ` (${adultos} adulto${adultos > 1 ? 's' : ''}`;
    if (criancas > 0) infoViajantes += `, ${criancas} criança${criancas > 1 ? 's' : ''}`;
    if (bebes > 0) infoViajantes += `, ${bebes} bebê${bebes > 1 ? 's' : ''}`;
    infoViajantes += ')';
  }
  
  // Montar o prompt OTIMIZADO para roteiros de até 21 dias
  return `
🐕 TRIPINHA - ESPECIALISTA EM ROTEIROS DE VIAGEM

**MISSÃO CRÍTICA: CRIAR EXATAMENTE ${diasViagem} DIAS DE ROTEIRO COMPLETO**

📋 PARÂMETROS DA VIAGEM:
• Destino: ${destino}, ${pais}
• Data início: ${dataInicio}
• Data fim: ${dataFim}
• DURAÇÃO TOTAL: ${diasViagem} dias
• Chegada: ${horaChegada || 'Não informado'}
• Partida: ${horaSaida || 'Não informado'}
• Viajantes: ${infoViajantes}
• Estilo: ${descricaoTipoViagem}
• Intensidade: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
• Orçamento: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}

🚨 REGRAS OBRIGATÓRIAS:
1. **RETORNAR ARRAY "dias" COM EXATAMENTE ${diasViagem} ELEMENTOS**
2. **CADA DIA DEVE TER: data, descricao, manha, tarde, noite**
3. **CADA PERÍODO DEVE TER ATIVIDADES COM: horario, local, tags, dica**
4. **USE LOCAIS REAIS E ESPECÍFICOS DE ${destino}**
5. **ADAPTE PARA ${infoViajantes}**
6. **SIGA A INTENSIDADE: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}**

📅 ESTRUTURA JSON OBRIGATÓRIA:
{
  "destino": "${destino}, ${pais}",
  "dias": [
    {
      "data": "${dataInicio}",
      "descricao": "Descrição envolvente do dia",
      "manha": {
        "atividades": [
          {
            "horario": "09:00",
            "local": "Nome específico do local em ${destino}",
            "tags": ["Imperdível", "Cultural"],
            "dica": "Dica prática e personalizada da Tripinha"
          }
        ]
      },
      "tarde": {
        "atividades": [
          {
            "horario": "14:00",
            "local": "Outro local específico em ${destino}",
            "tags": ["Gastronomia", "Local"],
            "dica": "Outra dica útil da Tripinha"
          }
        ]
      },
      "noite": {
        "atividades": [
          {
            "horario": "19:00",
            "local": "Local noturno em ${destino}",
            "tags": ["Vida Noturna", "Experiência"],
            "dica": "Dica especial para a noite"
          }
        ]
      }
    }
    // REPETIR PARA TODOS OS ${diasViagem} DIAS
  ]
}

⚡ INSTRUÇÕES ESPECÍFICAS:
• DIA 1: Considerar chegada às ${horaChegada || '15:30'}
• DIA ${diasViagem}: Considerar partida às ${horaSaida || '21:00'}
• VARIAÇÃO: Cada dia deve ter atividades diferentes
• REALISMO: Use pontos turísticos, restaurantes e locais reais de ${destino}
• QUALIDADE: Cada atividade deve ter dica personalizada da Tripinha

**VALIDAÇÃO FINAL: O array "dias" DEVE conter ${diasViagem} objetos, nem mais, nem menos!**

Comece agora criando o roteiro completo:`;
}

/**
 * Gera roteiro utilizando a API DeepSeek COM TIMEOUTS E TOKENS AUMENTADOS
 * @param {string} prompt - Prompt para a IA
 * @param {number} diasEsperados - Número de dias esperados
 * @returns {Object} Roteiro gerado
 */
async function gerarRoteiroComDeepseek(prompt, diasEsperados) {
  try {
    // Verificar se a chave da API está configurada
    if (!DEEPSEEK_API_KEY) {
      throw new Error('Chave da API DeepSeek não configurada');
    }
    
    // Configurações para roteiros longos
    const isRoteiroLongo = diasEsperados >= 14;
    const timeoutMs = isRoteiroLongo ? 120000 : 60000; // 2min para roteiros 14+ dias
    const maxTokens = isRoteiroLongo ? 20000 : 12000; // Tokens aumentados significativamente
    
    logEvent('info', 'Configurações DeepSeek', {
      diasEsperados,
      isRoteiroLongo,
      timeoutMs,
      maxTokens
    });
    
    // Controller para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logEvent('error', 'Timeout na API DeepSeek', { timeoutMs, diasEsperados });
      controller.abort();
    }, timeoutMs);
    
    try {
      // Realizar chamada à API DeepSeek
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
          },
          signal: controller.signal,
          timeout: timeoutMs
        }
      );
      
      clearTimeout(timeoutId);
      
      // Extrair resposta
      const respostaText = response.data.choices[0].message.content;
      
      logEvent('info', 'Resposta DeepSeek recebida', {
        tamanhoResposta: respostaText.length,
        diasEsperados
      });
      
      // Processar a resposta JSON
      try {
        // Limpar qualquer markdown ou texto antes/depois do JSON
        const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
        
        // Parsear para objeto
        const roteiro = JSON.parse(jsonText);
        
        // Validação básica
        if (!roteiro.dias || !Array.isArray(roteiro.dias)) {
          throw new Error('Estrutura de roteiro inválida - sem array de dias');
        }
        
        if (roteiro.dias.length !== diasEsperados) {
          logEvent('error', 'Número incorreto de dias na resposta', {
            esperados: diasEsperados,
            recebidos: roteiro.dias.length
          });
          throw new Error(`Esperado ${diasEsperados} dias, recebido ${roteiro.dias.length} dias`);
        }
        
        logEvent('info', 'Roteiro validado com sucesso', {
          diasGerados: roteiro.dias.length,
          primeiraData: roteiro.dias[0]?.data,
          ultimaData: roteiro.dias[roteiro.dias.length - 1]?.data
        });
        
        return roteiro;
        
      } catch (parseError) {
        logEvent('error', 'Erro ao processar resposta JSON da DeepSeek', {
          error: parseError.message,
          respostaTamanho: respostaText.length,
          diasEsperados
        });
        
        throw new Error(`Resposta da DeepSeek não é um JSON válido: ${parseError.message}`);
      }
      
    } catch (requestError) {
      clearTimeout(timeoutId);
      
      if (requestError.name === 'AbortError' || requestError.code === 'ECONNABORTED') {
        throw new Error(`Timeout na API DeepSeek após ${timeoutMs}ms para roteiro de ${diasEsperados} dias`);
      }
      
      throw requestError;
    }
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada à API DeepSeek', {
      error: erro.message,
      diasEsperados,
      response: erro.response?.data
    });
    
    throw erro;
  }
}

/**
 * Gera roteiro utilizando a API Claude (Anthropic) COM TIMEOUTS AUMENTADOS
 * @param {string} prompt - Prompt para a IA
 * @param {number} diasEsperados - Número de dias esperados
 * @returns {Object} Roteiro gerado
 */
async function gerarRoteiroComClaude(prompt, diasEsperados) {
  try {
    // Verificar se a chave da API está configurada
    if (!CLAUDE_API_KEY) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    // Configurações para roteiros longos
    const isRoteiroLongo = diasEsperados >= 14;
    const timeoutMs = isRoteiroLongo ? 120000 : 60000; // 2min para roteiros 14+ dias
    const maxTokens = isRoteiroLongo ? 8000 : 4000; // Claude tem limites diferentes
    
    logEvent('info', 'Configurações Claude', {
      diasEsperados,
      isRoteiroLongo,
      timeoutMs,
      maxTokens
    });
    
    // Controller para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logEvent('error', 'Timeout na API Claude', { timeoutMs, diasEsperados });
      controller.abort();
    }, timeoutMs);
    
    try {
      // Realizar chamada à API Claude (Anthropic)
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-haiku-20240307',
          max_tokens: maxTokens,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          signal: controller.signal,
          timeout: timeoutMs
        }
      );
      
      clearTimeout(timeoutId);
      
      // Extrair resposta
      const respostaText = response.data.content[0].text;
      
      logEvent('info', 'Resposta Claude recebida', {
        tamanhoResposta: respostaText.length,
        diasEsperados
      });
      
      // Processar a resposta JSON
      try {
        // Limpar qualquer markdown ou texto antes/depois do JSON
        const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
        
        // Parsear para objeto
        const roteiro = JSON.parse(jsonText);
        
        // Validação básica
        if (!roteiro.dias || !Array.isArray(roteiro.dias)) {
          throw new Error('Estrutura de roteiro inválida - sem array de dias');
        }
        
        if (roteiro.dias.length !== diasEsperados) {
          logEvent('error', 'Número incorreto de dias na resposta Claude', {
            esperados: diasEsperados,
            recebidos: roteiro.dias.length
          });
          throw new Error(`Esperado ${diasEsperados} dias, recebido ${roteiro.dias.length} dias`);
        }
        
        logEvent('info', 'Roteiro Claude validado com sucesso', {
          diasGerados: roteiro.dias.length,
          primeiraData: roteiro.dias[0]?.data,
          ultimaData: roteiro.dias[roteiro.dias.length - 1]?.data
        });
        
        return roteiro;
        
      } catch (parseError) {
        logEvent('error', 'Erro ao processar resposta JSON da Claude', {
          error: parseError.message,
          respostaTamanho: respostaText.length,
          diasEsperados
        });
        
        throw new Error(`Resposta da Claude não é um JSON válido: ${parseError.message}`);
      }
      
    } catch (requestError) {
      clearTimeout(timeoutId);
      
      if (requestError.name === 'AbortError' || requestError.code === 'ECONNABORTED') {
        throw new Error(`Timeout na API Claude após ${timeoutMs}ms para roteiro de ${diasEsperados} dias`);
      }
      
      throw requestError;
    }
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada à API Claude', {
      error: erro.message,
      diasEsperados,
      response: erro.response?.data
    });
    
    throw erro;
  }
}
