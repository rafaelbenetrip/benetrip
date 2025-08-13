// api/itinerary-generator.js - Gerador de roteiro com Groq (Otimizado)
const axios = require('axios');

// Configurações da API Groq
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // Modelo mais recente e performático

// Configurações de timeout e retry
const API_TIMEOUT = 60000; // 60 segundos
const MAX_RETRIES = 2;

// Função auxiliar para logging estruturado
function logEvent(type, message, data = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    message,
    service: 'itinerary-generator',
    model: GROQ_MODEL,
    ...data
  };
  console.log(JSON.stringify(log));
}

/**
 * Endpoint principal para geração de roteiro personalizado via Groq
 */
module.exports = async (req, res) => {
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Responder a preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Método não permitido', 
      message: 'Use POST para este endpoint' 
    });
  }
  
  try {
    // Validar chave da API
    if (!GROQ_API_KEY) {
      logEvent('error', 'Chave da API Groq não configurada');
      return res.status(500).json({ 
        error: 'Configuração inválida', 
        message: 'Chave da API não encontrada' 
      });
    }
    
    // Extrair e validar parâmetros
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
      testMode = false
    } = req.body;
    
    // Validação de parâmetros obrigatórios
    if (!destino || !dataInicio) {
      return res.status(400).json({ 
        error: 'Parâmetros obrigatórios ausentes', 
        message: 'destino e dataInicio são obrigatórios' 
      });
    }
    
    // Calcular duração da viagem
    const diasViagem = calcularDiasViagem(dataInicio, dataFim);
    
    // Validar duração máxima (limite prático)
    if (diasViagem > 21) {
      return res.status(400).json({ 
        error: 'Duração inválida', 
        message: 'Máximo de 21 dias de viagem suportado' 
      });
    }
    
    // Log da requisição
    logEvent('info', 'Iniciando geração de roteiro', {
      destino,
      pais,
      diasViagem,
      tipoViagem,
      tipoCompanhia,
      testMode
    });
    
    // Gerar prompt otimizado para Groq
    const prompt = gerarPromptRoteiroGroq({
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
    
    // Gerar roteiro com Groq (com retry automático)
    const roteiro = await gerarRoteiroComGroq(prompt, testMode);
    
    // Validar estrutura do roteiro
    if (!validarEstrutulaRoteiro(roteiro, diasViagem)) {
      throw new Error('Roteiro gerado com estrutura inválida');
    }
    
    // Log de sucesso
    logEvent('success', 'Roteiro gerado com sucesso', {
      destino,
      diasGerados: roteiro.dias?.length || 0,
      diasEsperados: diasViagem
    });
    
    // Retornar roteiro com metadata
    return res.status(200).json({
      ...roteiro,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: GROQ_MODEL,
        requestId: generateRequestId(),
        diasViagem,
        parametros: {
          destino,
          pais,
          tipoViagem,
          tipoCompanhia
        }
      }
    });
    
  } catch (erro) {
    // Log detalhado do erro
    logEvent('error', 'Erro na geração do roteiro', {
      message: erro.message,
      stack: processo.env.NODE_ENV === 'development' ? erro.stack : undefined,
      body: req.body
    });
    
    // Retornar erro estruturado
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Falha ao gerar roteiro personalizado',
      details: processo.env.NODE_ENV === 'development' ? erro.message : undefined,
      requestId: generateRequestId()
    });
  }
};

/**
 * Calcula o número de dias entre duas datas
 * @param {string} dataInicio - Data de início (YYYY-MM-DD)
 * @param {string} dataFim - Data de fim (YYYY-MM-DD)
 * @returns {number} Número de dias da viagem
 */
function calcularDiasViagem(dataInicio, dataFim) {
  if (!dataInicio) return 1;
  
  const inicio = new Date(dataInicio);
  
  // Se não tiver data fim, assume viagem de 1 dia
  if (!dataFim) return 1;
  
  const fim = new Date(dataFim);
  
  // Calcular diferença em dias (incluindo dia de chegada)
  const diffTempo = Math.abs(fim - inicio);
  const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;
  
  return Math.max(1, diffDias); // Mínimo 1 dia
}

/**
 * Gera prompt otimizado específico para Groq Llama
 * @param {Object} params - Parâmetros da viagem
 * @returns {string} Prompt formatado para Groq
 */
function gerarPromptRoteiroGroq(params) {
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
  
  // Mapear tipos para descrições mais específicas
  const tipoViagemMap = {
    'relaxar': 'relaxamento, bem-estar e descanso',
    'aventura': 'aventura, adrenalina e atividades radicais',
    'cultura': 'cultura, história, gastronomia e arte local',
    'urbano': 'vida urbana, compras, entretenimento e vida noturna',
    'natureza': 'natureza, trilhas e contato com o meio ambiente'
  };
  
  const tipoCompanhiaMap = {
    'sozinho': 'viajante solo',
    'casal': 'casal romântico',
    'familia': 'família com crianças',
    'amigos': 'grupo de amigos'
  };
  
  // Informações de intensidade e orçamento
  const intensidadeMap = {
    'leve': '2-3 atividades por dia (ritmo relaxado)',
    'moderado': '3-4 atividades por dia (ritmo equilibrado)',
    'intenso': '5+ atividades por dia (ritmo acelerado)'
  };
  
  const orcamentoMap = {
    'economico': 'econômico (priorize atividades gratuitas ou de baixo custo)',
    'medio': 'médio (balance atividades gratuitas e pagas)',
    'alto': 'premium (inclua experiências exclusivas sem limitação de custo)'
  };
  
  // Informações adicionais sobre viajantes
  let infoViajantes = tipoCompanhiaMap[tipoCompanhia] || 'viajante';
  if (tipoCompanhia === 'familia' && preferencias) {
    const adultos = preferencias.quantidade_adultos || 2;
    const criancas = preferencias.quantidade_criancas || 0;
    if (criancas > 0) {
      infoViajantes += ` (${adultos} adulto${adultos > 1 ? 's' : ''}, ${criancas} criança${criancas > 1 ? 's' : ''})`;
    }
  }
  
  const intensidade = intensidadeMap[preferencias?.intensidade_roteiro] || intensidadeMap['moderado'];
  const orcamento = orcamentoMap[preferencias?.orcamento_nivel] || orcamentoMap['medio'];
  const focoPrincipal = tipoViagemMap[tipoViagem] || 'experiências variadas';
  
  return `Você é a Tripinha, uma vira-lata caramelo esperta e carismática da Benetrip. Crie um roteiro de viagem COMPLETO e DETALHADO em formato JSON.

DADOS DA VIAGEM:
🎯 Destino: ${destino}, ${pais}
📅 Período: ${dataInicio}${dataFim ? ` até ${dataFim}` : ''} (${diasViagem} dias)
✈️ Chegada: ${horaChegada || 'Flexível'}
🛫 Partida: ${horaSaida || 'Flexível'}
👥 Viajantes: ${infoViajantes}
🎨 Foco: ${focoPrincipal}
⚡ Intensidade: ${intensidade}
💰 Orçamento: ${orcamento}

INSTRUÇÕES CRÍTICAS:
1. OBRIGATÓRIO: Crie EXATAMENTE ${diasViagem} dias de roteiro
2. Cada dia deve ter atividades para manhã, tarde e noite
3. Respeite a intensidade: ${intensidade}
4. Adeque ao orçamento: ${orcamento}
5. Adapte para ${infoViajantes}
6. No primeiro dia, considere chegada às ${horaChegada || 'flexível'}
7. No último dia, considere partida às ${horaSaida || 'flexível'}

FORMATO JSON OBRIGATÓRIO:
{
  "destino": "${destino}",
  "resumo": "Breve descrição da viagem",
  "dias": [
    {
      "numero": 1,
      "data": "${dataInicio}",
      "diaSemana": "Nome do dia da semana",
      "tema": "Tema principal do dia",
      "descricao": "Descrição geral do dia",
      "manha": {
        "horarioEspecial": "Se chegada/partida",
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome específico do local",
            "tipo": "categoria da atividade",
            "tags": ["tag1", "tag2"],
            "descricao": "Breve descrição",
            "dica": "Dica personalizada da Tripinha",
            "custo": "gratuito|baixo|medio|alto"
          }
        ]
      },
      "tarde": { /* mesmo formato */ },
      "noite": { /* mesmo formato */ }
    }
  ]
}

REGRAS IMPORTANTES:
- Use locais REAIS e específicos de ${destino}
- Inclua pelo menos 1 dica da Tripinha por período
- Varie os tipos de atividade conforme o foco em ${focoPrincipal}
- Para família, priorize atividades kid-friendly
- Para casal, inclua experiências românticas
- Para amigos, foque em diversão e vida noturna
- Para solo, inclua experiências introspectivas e sociais

Responda APENAS com o JSON válido, sem texto adicional.`;
}

/**
 * Gera roteiro utilizando a API Groq com retry automático
 * @param {string} prompt - Prompt para a IA
 * @param {boolean} testMode - Modo de teste (menos tokens)
 * @returns {Object} Roteiro gerado
 */
async function gerarRoteiroComGroq(prompt, testMode = false) {
  let ultimoErro;
  
  for (let tentativa = 1; tentativa <= MAX_RETRIES; tentativa++) {
    try {
      logEvent('info', `Tentativa ${tentativa} de geração com Groq`);
      
      const config = {
        timeout: API_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        }
      };
      
      const payload = {
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Você é a Tripinha da Benetrip. Responda SEMPRE em JSON válido conforme o formato solicitado. Seja criativa, detalhada e útil.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: testMode ? 4000 : 8000,
        temperature: 0.7,
        top_p: 0.9,
        response_format: { type: 'json_object' },
        stream: false
      };
      
      // Fazer chamada à API Groq
      const response = await axios.post(
        `${GROQ_BASE_URL}/chat/completions`,
        payload,
        config
      );
      
      // Validar resposta da API
      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Resposta inválida da API Groq');
      }
      
      const respostaTexto = response.data.choices[0].message.content;
      
      // Log da resposta bruta (apenas em desenvolvimento)
      if (processo.env.NODE_ENV === 'development') {
        logEvent('debug', 'Resposta bruta da Groq', { content: respostaTexto.substring(0, 500) });
      }
      
      // Processar e validar JSON
      const roteiro = processarRespostaJSON(respostaTexto);
      
      // Log de sucesso
      logEvent('success', 'Resposta processada com sucesso', {
        tentativa,
        diasGerados: roteiro.dias?.length || 0,
        tokensUsados: response.data.usage?.total_tokens || 0
      });
      
      return roteiro;
      
    } catch (erro) {
      ultimoErro = erro;
      
      logEvent('warning', `Tentativa ${tentativa} falhou`, {
        error: erro.message,
        tentativa,
        maxTentativas: MAX_RETRIES
      });
      
      // Se for a última tentativa, relançar o erro
      if (tentativa === MAX_RETRIES) {
        throw ultimoErro;
      }
      
      // Aguardar antes da próxima tentativa (backoff exponencial)
      await new Promise(resolve => setTimeout(resolve, tentativa * 1000));
    }
  }
}

/**
 * Processa a resposta JSON da Groq, limpando formatação
 * @param {string} respostaTexto - Resposta bruta da API
 * @returns {Object} Objeto JSON parseado
 */
function processarRespostaJSON(respostaTexto) {
  try {
    // Limpar possível markdown ou texto extra
    let jsonTexto = respostaTexto.trim();
    
    // Remover markdown se existir
    if (jsonTexto.startsWith('```json')) {
      jsonTexto = jsonTexto.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonTexto.startsWith('```')) {
      jsonTexto = jsonTexto.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Encontrar JSON válido na resposta
    const jsonMatch = jsonTexto.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonTexto = jsonMatch[0];
    }
    
    // Tentar parsear JSON
    const roteiro = JSON.parse(jsonTexto);
    
    return roteiro;
    
  } catch (erro) {
    logEvent('error', 'Erro ao processar JSON da resposta', {
      error: erro.message,
      rawContent: respostaTexto.substring(0, 1000)
    });
    
    throw new Error(`Resposta da Groq não contém JSON válido: ${erro.message}`);
  }
}

/**
 * Valida a estrutura do roteiro gerado
 * @param {Object} roteiro - Roteiro a ser validado
 * @param {number} diasEsperados - Número de dias esperado
 * @returns {boolean} Se é válido
 */
function validarEstrutulaRoteiro(roteiro, diasEsperados) {
  if (!roteiro || typeof roteiro !== 'object') {
    logEvent('error', 'Roteiro não é um objeto válido');
    return false;
  }
  
  if (!roteiro.destino || !Array.isArray(roteiro.dias)) {
    logEvent('error', 'Roteiro não possui estrutura básica (destino, dias)');
    return false;
  }
  
  if (roteiro.dias.length !== diasEsperados) {
    logEvent('error', 'Número de dias incorreto', {
      esperado: diasEsperados,
      gerado: roteiro.dias.length
    });
    return false;
  }
  
  // Validar cada dia
  for (let i = 0; i < roteiro.dias.length; i++) {
    const dia = roteiro.dias[i];
    
    if (!dia.data || !dia.manha || !dia.tarde || !dia.noite) {
      logEvent('error', `Dia ${i + 1} possui estrutura inválida`);
      return false;
    }
  }
  
  return true;
}

/**
 * Gera um ID único para a requisição
 * @returns {string} ID da requisição
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
