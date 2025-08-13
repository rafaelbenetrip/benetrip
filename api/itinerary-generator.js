// api/itinerary-generator.js - Endpoint para geração de roteiro personalizado
// Versão otimizada com Groq (primário) + Claude (fallback)
const axios = require('axios');

// Chaves de API
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Configurações dos modelos
const GROQ_CONFIG = {
  model: 'llama-3.1-70b-versatile', // Modelo principal para melhor qualidade
  maxTokens: 8192,
  temperature: 0.7
};

const CLAUDE_CONFIG = {
  model: 'claude-3-haiku-20240307',
  maxTokens: 4000,
  temperature: 0.7
};

// Função auxiliar para logging estruturado
function logEvent(type, message, data = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    message,
    service: 'itinerary-generator',
    ...data
  };
  console.log(JSON.stringify(log));
}

/**
 * Endpoint principal para geração de roteiros
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
  
  const startTime = Date.now();
  
  try {
    // Extrair e validar parâmetros
    const parametros = extrairParametros(req.body);
    
    // Log da requisição
    logEvent('info', 'Iniciando geração de roteiro', {
      destino: parametros.destino,
      diasViagem: parametros.diasViagem,
      tipoViagem: parametros.tipoViagem,
      tipoCompanhia: parametros.tipoCompanhia
    });
    
    // Gerar prompt otimizado
    const prompt = gerarPromptOtimizado(parametros);
    
    // Gerar roteiro com sistema de fallback
    const roteiro = await gerarRoteiroComFallback(prompt);
    
    // Validar resposta
    const roteiroValidado = validarRoteiro(roteiro, parametros.diasViagem);
    
    // Log de sucesso
    const tempoProcessamento = Date.now() - startTime;
    logEvent('success', 'Roteiro gerado com sucesso', {
      tempoProcessamento: `${tempoProcessamento}ms`,
      totalDias: roteiroValidado.dias.length
    });
    
    return res.status(200).json(roteiroValidado);
    
  } catch (erro) {
    const tempoProcessamento = Date.now() - startTime;
    
    // Log detalhado do erro
    logEvent('error', 'Erro ao gerar roteiro', {
      error: erro.message,
      stack: erro.stack,
      tempoProcessamento: `${tempoProcessamento}ms`
    });
    
    return res.status(500).json({
      error: 'Erro interno ao gerar roteiro',
      message: 'Tente novamente em alguns instantes',
      code: 'ROTEIRO_GENERATION_ERROR'
    });
  }
};

/**
 * Extrai e valida parâmetros da requisição
 */
function extrairParametros(body) {
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
    forcarModelo
  } = body;
  
  // Validações obrigatórias
  if (!destino || !dataInicio) {
    throw new Error('Parâmetros obrigatórios: destino, dataInicio');
  }
  
  // Calcular dias da viagem
  const diasViagem = calcularDiasViagem(dataInicio, dataFim);
  
  if (diasViagem > 30) {
    throw new Error('Máximo de 30 dias de viagem suportado');
  }
  
  return {
    destino: destino.trim(),
    pais: pais?.trim() || '',
    dataInicio,
    dataFim,
    horaChegada,
    horaSaida,
    diasViagem,
    tipoViagem: tipoViagem || 'cultura',
    tipoCompanhia: tipoCompanhia || 'sozinho',
    preferencias: preferencias || {},
    forcarModelo
  };
}

/**
 * Calcula número de dias entre datas
 */
function calcularDiasViagem(dataInicio, dataFim) {
  if (!dataInicio) return 1;
  
  const inicio = new Date(dataInicio);
  
  if (!dataFim) return 1;
  
  const fim = new Date(dataFim);
  const diffTempo = Math.abs(fim - inicio);
  const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;
  
  return Math.max(1, diffDias);
}

/**
 * Gera prompt otimizado para o Groq
 */
function gerarPromptOtimizado(params) {
  const {
    destino, pais, dataInicio, dataFim, horaChegada, horaSaida,
    diasViagem, tipoViagem, tipoCompanhia, preferencias
  } = params;
  
  // Mapeamentos de descrições
  const tiposViagem = {
    'relaxar': 'relaxamento e bem-estar',
    'aventura': 'aventura e adrenalina',
    'cultura': 'cultura, história e gastronomia', 
    'urbano': 'vida urbana, compras e entretenimento',
    'natureza': 'natureza e paisagens'
  };
  
  const tiposCompanhia = {
    'sozinho': 'viajante solo',
    'casal': 'casal romântico',
    'familia': 'família',
    'amigos': 'grupo de amigos'
  };
  
  const intensidades = {
    'leve': '2-3 atividades por dia (ritmo relaxado)',
    'moderado': '3-4 atividades por dia (ritmo equilibrado)', 
    'intenso': '5+ atividades por dia (ritmo acelerado)'
  };
  
  const orcamentos = {
    'economico': 'econômico (priorize atividades gratuitas)',
    'medio': 'médio (misture atividades gratuitas e pagas)',
    'alto': 'premium (inclua experiências exclusivas)'
  };
  
  // Construir informações dos viajantes
  let infoViajantes = tiposCompanhia[tipoCompanhia] || 'viajante';
  if (tipoCompanhia === 'familia' && preferencias) {
    const detalhes = [];
    if (preferencias.quantidade_adultos) detalhes.push(`${preferencias.quantidade_adultos} adultos`);
    if (preferencias.quantidade_criancas) detalhes.push(`${preferencias.quantidade_criancas} crianças`);
    if (preferencias.quantidade_bebes) detalhes.push(`${preferencias.quantidade_bebes} bebês`);
    if (detalhes.length > 0) infoViajantes += ` (${detalhes.join(', ')})`;
  }
  
  return `Você é a Tripinha, mascote especialista em viagens da Benetrip. Crie um roteiro COMPLETO e DETALHADO seguindo EXATAMENTE estas especificações:

🎯 DADOS DA VIAGEM:
• Destino: ${destino}${pais ? `, ${pais}` : ''}
• Período: ${dataInicio}${dataFim ? ` até ${dataFim}` : ''} (${diasViagem} dias)
• Chegada: ${horaChegada || 'Flexível'}
• Partida: ${horaSaida || 'Flexível'}
• Tipo: ${tiposViagem[tipoViagem] || 'experiências variadas'}
• Viajantes: ${infoViajantes}
• Intensidade: ${intensidades[preferencias?.intensidade_roteiro] || intensidades.moderado}
• Orçamento: ${orcamentos[preferencias?.orcamento_nivel] || orcamentos.medio}

🎯 REQUISITOS OBRIGATÓRIOS:
1. CRIAR EXATAMENTE ${diasViagem} DIAS no array "dias"
2. CADA DIA deve ter atividades em manhã, tarde e noite
3. ADAPTAR ao perfil: ${infoViajantes}
4. FOCAR em: ${tiposViagem[tipoViagem] || 'cultura'}
5. RESPEITAR intensidade: ${intensidades[preferencias?.intensidade_roteiro] || intensidades.moderado}
6. CONSIDERAR orçamento: ${orcamentos[preferencias?.orcamento_nivel] || orcamentos.medio}

🎯 ESTRUTURA OBRIGATÓRIA (JSON):
{
  "destino": "${destino}",
  "resumo": "Descrição em 1-2 frases sobre a viagem",
  "dias": [
    {
      "dia": 1,
      "data": "${dataInicio}",
      "titulo": "Primeiro dia - Chegada",
      "descricao": "Breve descrição do dia",
      "manha": {
        "periodo": "Manhã",
        "horarioEspecial": "${horaChegada ? `Chegada às ${horaChegada}` : ''}",
        "atividades": [
          {
            "horario": "10:00",
            "local": "Nome real do local/atração",
            "descricao": "Descrição da atividade",
            "tags": ["Imperdível", "Cultural"],
            "dica": "Dica prática da Tripinha"
          }
        ]
      },
      "tarde": { ... },
      "noite": { ... }
    }
  ]
}

🎯 DIRETRIZES ESPECÍFICAS:
• Use LOCAIS REAIS e ESPECÍFICOS do destino
• Cada período deve ter ${preferencias?.intensidade_roteiro === 'leve' ? '1-2' : preferencias?.intensidade_roteiro === 'intenso' ? '2-3' : '1-2'} atividades
• Tags sugeridas: ["Imperdível", "Cultural", "Família", "Aventura", "Gastronomia", "Natureza", "Compras", "Noturno"]
• Dicas da Tripinha: práticas, divertidas e específicas
• Considerar dias da semana (alguns locais fecham em dias específicos)
• ÚLTIMO DIA: considerar horário de partida ${horaSaida || 'flexível'}

RETORNE APENAS O JSON VÁLIDO SEM FORMATAÇÃO ADICIONAL.`;
}

/**
 * Sistema de fallback: Groq → Claude
 */
async function gerarRoteiroComFallback(prompt) {
  // Tentativa 1: Groq (primário)
  try {
    logEvent('info', 'Tentando gerar roteiro com Groq');
    return await gerarRoteiroComGroq(prompt);
  } catch (erroGroq) {
    logEvent('warning', 'Groq falhou, tentando Claude como fallback', {
      erro: erroGroq.message
    });
    
    // Tentativa 2: Claude (fallback)
    try {
      return await gerarRoteiroComClaude(prompt);
    } catch (erroClaude) {
      logEvent('error', 'Todos os provedores falharam', {
        erroGroq: erroGroq.message,
        erroClaude: erroClaude.message
      });
      
      throw new Error('Serviço temporariamente indisponível. Tente novamente.');
    }
  }
}

/**
 * Geração com Groq (Llama 3.1 70B)
 */
async function gerarRoteiroComGroq(prompt) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY não configurada');
  }
  
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: GROQ_CONFIG.model,
      max_tokens: GROQ_CONFIG.maxTokens,
      temperature: GROQ_CONFIG.temperature,
      messages: [
        {
          role: 'system',
          content: 'Você é a Tripinha da Benetrip. Responda SEMPRE em JSON válido conforme especificado.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      timeout: 30000 // 30 segundos
    }
  );
  
  return processarRespostaJSON(response.data.choices[0].message.content, 'Groq');
}

/**
 * Geração com Claude (fallback)
 */
async function gerarRoteiroComClaude(prompt) {
  if (!CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY não configurada');
  }
  
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: CLAUDE_CONFIG.model,
      max_tokens: CLAUDE_CONFIG.maxTokens,
      temperature: CLAUDE_CONFIG.temperature,
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
      timeout: 30000
    }
  );
  
  return processarRespostaJSON(response.data.content[0].text, 'Claude');
}

/**
 * Processa resposta JSON das APIs
 */
function processarRespostaJSON(textoResposta, provedor) {
  try {
    // Remover possível formatação markdown
    const jsonLimpo = textoResposta
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    // Extrair JSON se houver texto adicional
    const jsonMatch = jsonLimpo.match(/\{[\s\S]*\}/);
    const jsonFinal = jsonMatch ? jsonMatch[0] : jsonLimpo;
    
    const objeto = JSON.parse(jsonFinal);
    
    logEvent('success', `Resposta JSON processada com sucesso (${provedor})`);
    return objeto;
    
  } catch (erro) {
    logEvent('error', `Erro ao processar JSON do ${provedor}`, {
      erro: erro.message,
      resposta: textoResposta.substring(0, 500) + '...'
    });
    
    throw new Error(`Resposta inválida do ${provedor}`);
  }
}

/**
 * Valida estrutura do roteiro gerado
 */
function validarRoteiro(roteiro, diasEsperados) {
  if (!roteiro || typeof roteiro !== 'object') {
    throw new Error('Roteiro inválido');
  }
  
  if (!roteiro.destino || !roteiro.dias || !Array.isArray(roteiro.dias)) {
    throw new Error('Estrutura do roteiro inválida');
  }
  
  if (roteiro.dias.length !== diasEsperados) {
    logEvent('warning', 'Número de dias diverge do esperado', {
      esperado: diasEsperados,
      recebido: roteiro.dias.length
    });
  }
  
  // Validar estrutura básica de cada dia
  roteiro.dias.forEach((dia, index) => {
    if (!dia.dia || !dia.data || !dia.manha || !dia.tarde || !dia.noite) {
      throw new Error(`Estrutura inválida no dia ${index + 1}`);
    }
  });
  
  return roteiro;
}
