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
    logEvent('info', 'Iniciando processamento de roteiro', {
      method: req.method,
      hasBody: !!req.body
    });

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
    } = req.body || {};
    
    logEvent('info', 'Parâmetros recebidos', {
      destino,
      pais,
      dataInicio,
      dataFim,
      tipoViagem,
      tipoCompanhia
    });
    
    // Validar parâmetros obrigatórios
    if (!destino || !dataInicio) {
      logEvent('error', 'Parâmetros obrigatórios ausentes', {
        temDestino: !!destino,
        temDataInicio: !!dataInicio
      });
      return res.status(400).json({ 
        error: 'Parâmetros obrigatórios: destino, dataInicio',
        details: {
          destino: !!destino,
          dataInicio: !!dataInicio
        }
      });
    }
    
    // Calcular número de dias com tratamento de erro
    let diasViagem;
    try {
      diasViagem = calcularDiasViagem(dataInicio, dataFim);
      logEvent('info', 'Dias calculados com sucesso', { diasViagem });
    } catch (erroCalculo) {
      logEvent('error', 'Erro no cálculo de dias', {
        erro: erroCalculo.message,
        dataInicio,
        dataFim
      });
      
      // Se erro no cálculo, tentar método alternativo
      diasViagem = calcularDiasAlternativo(dataInicio, dataFim);
      logEvent('info', 'Usando cálculo alternativo', { diasViagem });
    }
    
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
    
    logEvent('info', 'Prompt gerado', {
      tamanhoPrompt: prompt.length,
      diasViagem
    });
    
    // Selecionar o modelo de IA a ser usado
    const modelo = modeloIA || DEFAULT_MODEL;
    
    // Gerar o roteiro usando a API correspondente
    let roteiro;
    
    try {
      if (modelo === 'claude') {
        roteiro = await gerarRoteiroComClaude(prompt, diasViagem);
      } else {
        roteiro = await gerarRoteiroComDeepseek(prompt, diasViagem);
      }
    } catch (erroIA) {
      logEvent('error', 'Erro na geração via IA', {
        erro: erroIA.message,
        modelo,
        diasViagem
      });
      
      // Se falhou na IA, retornar erro claro
      return res.status(500).json({
        error: 'Erro na geração do roteiro via IA',
        details: erroIA.message,
        modelo,
        diasViagem
      });
    }
    
    // Verificar se o roteiro foi gerado com sucesso
    if (!roteiro || !roteiro.dias) {
      logEvent('error', 'Roteiro inválido retornado pela IA', {
        temRoteiro: !!roteiro,
        temDias: !!(roteiro && roteiro.dias)
      });
      
      return res.status(500).json({
        error: 'Roteiro inválido gerado pela IA',
        details: 'Estrutura de roteiro não conforme'
      });
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
    // Log do erro detalhado
    logEvent('error', 'Erro geral no processamento', {
      message: erro.message,
      stack: erro.stack,
      name: erro.name
    });
    
    // Retornar erro detalhado para debug
    return res.status(500).json({
      error: 'Erro interno do servidor',
      details: erro.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Calcula o número de dias entre duas datas
 * @param {string} dataInicio - Data de início no formato YYYY-MM-DD
 * @param {string} dataFim - Data de fim no formato YYYY-MM-DD
 * @returns {number} Número de dias
 */
function calcularDiasViagem(dataInicio, dataFim) {
  logEvent('info', 'Iniciando cálculo de dias', { dataInicio, dataFim });
  
  if (!dataInicio) {
    throw new Error('Data de início é obrigatória');
  }
  
  // Tentar criar data de início
  let inicio;
  try {
    inicio = new Date(dataInicio + 'T12:00:00');
  } catch (e) {
    throw new Error(`Formato de data de início inválido: ${dataInicio}`);
  }
  
  if (isNaN(inicio.getTime())) {
    throw new Error(`Data de início inválida: ${dataInicio}`);
  }
  
  // Se não tiver data fim, assumir 7 dias (em vez de erro)
  if (!dataFim) {
    logEvent('warning', 'Data fim não fornecida, assumindo 7 dias');
    return 7;
  }
  
  // Tentar criar data de fim
  let fim;
  try {
    fim = new Date(dataFim + 'T12:00:00');
  } catch (e) {
    throw new Error(`Formato de data de fim inválido: ${dataFim}`);
  }
  
  if (isNaN(fim.getTime())) {
    throw new Error(`Data de fim inválida: ${dataFim}`);
  }
  
  // Calcular diferença em dias
  const diffMs = fim - inicio;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  
  logEvent('info', 'Diferença calculada', {
    diffMs,
    diffDias,
    inicio: inicio.toISOString(),
    fim: fim.toISOString()
  });
  
  if (diffDias < 1) {
    throw new Error('Data de fim deve ser posterior à data de início');
  }
  
  if (diffDias > 21) {
    logEvent('warning', 'Roteiro muito longo, limitando a 21 dias', { 
      diasOriginais: diffDias 
    });
    return 21;
  }
  
  return diffDias;
}

/**
 * Método alternativo de cálculo para casos de erro
 */
function calcularDiasAlternativo(dataInicio, dataFim) {
  try {
    // Se chegou aqui, tentar formatos alternativos
    const formatosData = [
      (data) => new Date(data),
      (data) => new Date(data + 'T00:00:00'),
      (data) => new Date(data.replace(/-/g, '/')),
    ];
    
    let inicio, fim;
    
    // Tentar diferentes formatos para data de início
    for (const formato of formatosData) {
      try {
        inicio = formato(dataInicio);
        if (!isNaN(inicio.getTime())) break;
      } catch (e) {
        continue;
      }
    }
    
    if (!inicio || isNaN(inicio.getTime())) {
      return 7; // Fallback seguro
    }
    
    if (!dataFim) {
      return 7; // Fallback seguro
    }
    
    // Tentar diferentes formatos para data de fim
    for (const formato of formatosData) {
      try {
        fim = formato(dataFim);
        if (!isNaN(fim.getTime())) break;
      } catch (e) {
        continue;
      }
    }
    
    if (!fim || isNaN(fim.getTime())) {
      return 7; // Fallback seguro
    }
    
    const diffMs = fim - inicio;
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDias < 1) return 7;
    if (diffDias > 21) return 21;
    
    return diffDias;
    
  } catch (e) {
    logEvent('warning', 'Cálculo alternativo falhou, usando 7 dias', {
      erro: e.message
    });
    return 7;
  }
}

/**
 * Gera o prompt para a IA baseado nos parâmetros
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
  }[tipoViagem] || 'experiências variadas';
  
  // Mapear o tipo de companhia para descrição
  const descricaoTipoCompanhia = {
    'sozinho': 'uma pessoa viajando sozinha',
    'casal': 'um casal em viagem romântica',
    'familia': 'uma família com crianças',
    'amigos': 'um grupo de amigos'
  }[tipoCompanhia] || 'viajantes';
  
  // Criar informações de intensidade e orçamento
  const intensidadeInfo = preferencias?.intensidade_roteiro || 'moderado';
  const orcamentoInfo = preferencias?.orcamento_nivel || 'medio';
  
  // Montar o prompt otimizado
  return `
Você é a Tripinha, especialista em roteiros de viagem da Benetrip.

MISSÃO: Criar um roteiro de ${diasViagem} dias para ${destino}, ${pais}.

PARÂMETROS:
- Destino: ${destino}, ${pais}
- Data início: ${dataInicio}
- Data fim: ${dataFim || 'Não informada'}
- Duração: ${diasViagem} dias
- Chegada: ${horaChegada || 'Não informado'}
- Partida: ${horaSaida || 'Não informado'}
- Viajantes: ${descricaoTipoCompanhia}
- Estilo: ${descricaoTipoViagem}
- Intensidade: ${intensidadeInfo}
- Orçamento: ${orcamentoInfo}

IMPORTANTE: Retorne um JSON com EXATAMENTE ${diasViagem} dias no array "dias".

Estrutura obrigatória:
{
  "destino": "${destino}, ${pais}",
  "dias": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "Descrição do dia",
      "manha": {
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome específico do local",
            "tags": ["tag1", "tag2"],
            "dica": "Dica da Tripinha"
          }
        ]
      },
      "tarde": {
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome específico do local",
            "tags": ["tag1", "tag2"],
            "dica": "Dica da Tripinha"
          }
        ]
      },
      "noite": {
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome específico do local",
            "tags": ["tag1", "tag2"],
            "dica": "Dica da Tripinha"
          }
        ]
      }
    }
  ]
}

Crie um roteiro detalhado com locais reais de ${destino} para todos os ${diasViagem} dias.`;
}

/**
 * Gera roteiro utilizando a API DeepSeek
 */
async function gerarRoteiroComDeepseek(prompt, diasEsperados) {
  logEvent('info', 'Iniciando chamada DeepSeek', { diasEsperados });
  
  if (!DEEPSEEK_API_KEY) {
    throw new Error('Chave da API DeepSeek não configurada');
  }
  
  // Configurações baseadas no número de dias
  const isRoteiroLongo = diasEsperados >= 14;
  const timeoutMs = isRoteiroLongo ? 120000 : 60000; // 2min para roteiros longos
  const maxTokens = isRoteiroLongo ? 20000 : 12000; // Tokens aumentados
  
  logEvent('info', 'Configurações DeepSeek', {
    diasEsperados,
    isRoteiroLongo,
    timeoutMs,
    maxTokens
  });
  
  try {
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
        timeout: timeoutMs
      }
    );
    
    const respostaText = response.data.choices[0].message.content;
    
    logEvent('info', 'Resposta DeepSeek recebida', {
      tamanhoResposta: respostaText.length,
      diasEsperados
    });
    
    // Processar JSON
    let roteiro;
    try {
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      roteiro = JSON.parse(jsonText);
    } catch (parseError) {
      logEvent('error', 'Erro no parse JSON', {
        erro: parseError.message,
        resposta: respostaText.substring(0, 500)
      });
      throw new Error(`Erro ao processar resposta JSON: ${parseError.message}`);
    }
    
    // Validar estrutura
    if (!roteiro || !roteiro.dias || !Array.isArray(roteiro.dias)) {
      throw new Error('Estrutura de roteiro inválida');
    }
    
    logEvent('info', 'Roteiro DeepSeek processado', {
      diasRecebidos: roteiro.dias.length,
      diasEsperados
    });
    
    // Se número de dias diferente, logar mas não falhar
    if (roteiro.dias.length !== diasEsperados) {
      logEvent('warning', 'Número de dias diferente do esperado', {
        esperados: diasEsperados,
        recebidos: roteiro.dias.length
      });
    }
    
    return roteiro;
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada DeepSeek', {
      erro: erro.message,
      diasEsperados,
      isTimeout: erro.code === 'ECONNABORTED'
    });
    
    throw erro;
  }
}

/**
 * Gera roteiro utilizando a API Claude
 */
async function gerarRoteiroComClaude(prompt, diasEsperados) {
  logEvent('info', 'Iniciando chamada Claude', { diasEsperados });
  
  if (!CLAUDE_API_KEY) {
    throw new Error('Chave da API Claude não configurada');
  }
  
  // Configurações para Claude
  const isRoteiroLongo = diasEsperados >= 14;
  const timeoutMs = isRoteiroLongo ? 120000 : 60000;
  const maxTokens = isRoteiroLongo ? 8000 : 4000;
  
  logEvent('info', 'Configurações Claude', {
    diasEsperados,
    isRoteiroLongo,
    timeoutMs,
    maxTokens
  });
  
  try {
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
        timeout: timeoutMs
      }
    );
    
    const respostaText = response.data.content[0].text;
    
    logEvent('info', 'Resposta Claude recebida', {
      tamanhoResposta: respostaText.length,
      diasEsperados
    });
    
    // Processar JSON
    let roteiro;
    try {
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      roteiro = JSON.parse(jsonText);
    } catch (parseError) {
      logEvent('error', 'Erro no parse JSON Claude', {
        erro: parseError.message,
        resposta: respostaText.substring(0, 500)
      });
      throw new Error(`Erro ao processar resposta JSON Claude: ${parseError.message}`);
    }
    
    // Validar estrutura
    if (!roteiro || !roteiro.dias || !Array.isArray(roteiro.dias)) {
      throw new Error('Estrutura de roteiro Claude inválida');
    }
    
    logEvent('info', 'Roteiro Claude processado', {
      diasRecebidos: roteiro.dias.length,
      diasEsperados
    });
    
    return roteiro;
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada Claude', {
      erro: erro.message,
      diasEsperados
    });
    
    throw erro;
  }
}
