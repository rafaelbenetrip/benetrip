// api/itinerary-generator.js - Endpoint para geração de roteiro personalizado com Groq
const axios = require('axios');

// Chaves de API
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Modelos disponíveis
const MODELS = {
  GROQ_GEMMA: 'gemma2-9b-it',
  GROQ_LLAMA: 'llama-3.1-8b-instant', // Modelo recomendado pelo Groq
  GROQ_LLAMA_70B: 'llama-3.3-70b-versatile', // Modelo mais potente
  DEEPSEEK: 'deepseek-chat',
  CLAUDE: 'claude-3-haiku-20240307'
};

// Modelo padrão a ser usado
const DEFAULT_MODEL = MODELS.GROQ_LLAMA;

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
 * Gera um roteiro personalizado através da API Groq, DeepSeek ou Claude
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
    
    // Calcular número de dias
    const diasViagem = calcularDiasViagem(dataInicio, dataFim);
    
    // Log dos parâmetros recebidos
    logEvent('info', 'Gerando roteiro personalizado', {
      destino,
      pais,
      diasViagem,
      tipoViagem,
      tipoCompanhia,
      modelo: modeloIA || DEFAULT_MODEL
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
    
    if (modelo.startsWith('llama') || modelo.startsWith('gemma') || Object.values(MODELS).includes(modelo)) {
      // Usar Groq para modelos Llama, Gemma e modelos da lista
      roteiro = await gerarRoteiroComGroq(prompt, modelo);
    } else if (modelo === 'claude') {
      roteiro = await gerarRoteiroComClaude(prompt);
    } else if (modelo === 'deepseek') {
      roteiro = await gerarRoteiroComDeepseek(prompt);
    } else {
      // Fallback para Groq com modelo padrão
      roteiro = await gerarRoteiroComGroq(prompt, DEFAULT_MODEL);
    }
    
    // Verificar se o roteiro foi gerado com sucesso
    if (!roteiro) {
      throw new Error('Falha ao gerar roteiro');
    }
    
    // Retornar o roteiro gerado
    return res.status(200).json({
      ...roteiro,
      metadata: {
        modelo_usado: modelo,
        timestamp: new Date().toISOString(),
        dias_viagem: diasViagem
      }
    });
    
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
 * Calcula o número de dias entre duas datas
 * @param {string} dataInicio - Data de início no formato YYYY-MM-DD
 * @param {string} dataFim - Data de fim no formato YYYY-MM-DD
 * @returns {number} Número de dias
 */
function calcularDiasViagem(dataInicio, dataFim) {
  if (!dataInicio) return 1;
  
  const inicio = new Date(dataInicio);
  
  // Se não tiver data fim, assume 1 dia
  if (!dataFim) return 1;
  
  const fim = new Date(dataFim);
  
  // Calcular diferença em dias
  const diffTempo = Math.abs(fim - inicio);
  const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;  // +1 para incluir o dia de chegada
  
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
  
  // Montar o prompt
  return `
Você é a Tripinha, uma vira-lata caramelo magra, esperta, despojada e especialista em viagens na Benetrip. Sua missão é transformar as respostas do usuário em um roteiro de viagem completo, personalizado e incrível. Fale como se fosse uma amiga: com leveza, simpatia, bom humor e dicas práticas, sem enrolação.

Crie um roteiro detalhado para uma viagem com as seguintes características:

- Destino: ${destino}, ${pais}
- Data de início: ${dataInicio}${dataFim ? `\n- Data de término: ${dataFim}` : ''}
- Duração: ${diasViagem} dias
- Horário de chegada no primeiro dia: ${horaChegada || 'Não informado'}
- Horário de partida no último dia: ${horaSaida || 'Não informado'}
- Tipo de viagem: Foco em ${descricaoTipoViagem}
- Viajantes: ${infoViajantes}
- Intensidade do roteiro: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
- Orçamento: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}

INSTRUÇÕES CRÍTICAS:
1. RETORNE APENAS JSON VÁLIDO - NÃO INCLUA TEXTO ANTES OU DEPOIS DO JSON
2. CRIE EXATAMENTE ${diasViagem} DIAS DE ROTEIRO COMPLETO
3. RESPEITE A INTENSIDADE: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
4. CONSIDERE O ORÇAMENTO: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}
5. ADAPTE PARA: ${infoViajantes}

Retorne APENAS este JSON:
{
  "destino": "${destino}, ${pais}",
  "dias": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "Breve descrição sobre o dia",
      "manha": {
        "horarioEspecial": "Chegada às XX:XX" (apenas se aplicável),
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome do local",
            "tags": ["tag1", "tag2"],
            "dica": "Dica da Tripinha sobre o local"
          }
        ]
      },
      "tarde": { /* mesmo formato */ },
      "noite": { /* mesmo formato */ }
    }
  ]
}`;
}

/**
 * Gera roteiro utilizando a API Groq
 * @param {string} prompt - Prompt para a IA
 * @param {string} modelo - Modelo a ser usado
 * @returns {Object} Roteiro gerado
 */
async function gerarRoteiroComGroq(prompt, modelo = MODELS.GROQ_LLAMA) {
  try {
    // Verificar se a chave da API está configurada
    if (!GROQ_API_KEY) {
      throw new Error('Chave da API Groq não configurada');
    }

    logEvent('info', 'Chamando API Groq', { modelo });
    
    // Realizar chamada à API Groq
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: modelo,
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        timeout: 60000 // 60 segundos de timeout
      }
    );
    
    // Extrair resposta
    const respostaText = response.data.choices[0].message.content;
    
    logEvent('info', 'Resposta recebida da Groq', { 
      modelo,
      length: respostaText.length,
      usage: response.data.usage
    });
    
    // Processar a resposta JSON
    try {
      // Limpar qualquer markdown ou texto antes/depois do JSON
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      
      // Parsear para objeto
      const roteiro = JSON.parse(jsonText);
      
      // Validar estrutura básica
      if (!roteiro.dias || !Array.isArray(roteiro.dias)) {
        throw new Error('Estrutura de roteiro inválida: falta array de dias');
      }
      
      return roteiro;
      
    } catch (parseError) {
      logEvent('error', 'Erro ao processar resposta JSON da Groq', {
        error: parseError.message,
        response: respostaText.substring(0, 500) // Primeiros 500 chars para debug
      });
      
      throw new Error('Resposta da Groq não é um JSON válido');
    }
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada à API Groq', {
      error: erro.message,
      response: erro.response?.data,
      status: erro.response?.status
    });
    
    // Se for erro de modelo não encontrado, tentar com modelo alternativo
    if (erro.response?.status === 404 || erro.response?.status === 400) {
      if (modelo !== MODELS.GROQ_LLAMA) {
        logEvent('info', 'Tentando modelo alternativo', { 
          modeloOriginal: modelo, 
          modeloAlternativo: MODELS.GROQ_LLAMA 
        });
        return await gerarRoteiroComGroq(prompt, MODELS.GROQ_LLAMA);
      }
    }
    
    throw erro;
  }
}

/**
 * Gera roteiro utilizando a API DeepSeek
 * @param {string} prompt - Prompt para a IA
 * @returns {Object} Roteiro gerado
 */
async function gerarRoteiroComDeepseek(prompt) {
  try {
    // Verificar se a chave da API está configurada
    if (!DEEPSEEK_API_KEY) {
      throw new Error('Chave da API DeepSeek não configurada');
    }
    
    logEvent('info', 'Chamando API DeepSeek');
    
    // Realizar chamada à API DeepSeek
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        timeout: 60000
      }
    );
    
    // Extrair resposta
    const respostaText = response.data.choices[0].message.content;
    
    // Processar a resposta JSON
    try {
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      const roteiro = JSON.parse(jsonText);
      return roteiro;
    } catch (parseError) {
      logEvent('error', 'Erro ao processar resposta JSON da DeepSeek', {
        error: parseError.message,
        response: respostaText.substring(0, 500)
      });
      throw new Error('Resposta da DeepSeek não é um JSON válido');
    }
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada à API DeepSeek', {
      error: erro.message,
      response: erro.response?.data
    });
    throw erro;
  }
}

/**
 * Gera roteiro utilizando a API Claude (Anthropic)
 * @param {string} prompt - Prompt para a IA
 * @returns {Object} Roteiro gerado
 */
async function gerarRoteiroComClaude(prompt) {
  try {
    // Verificar se a chave da API está configurada
    if (!CLAUDE_API_KEY) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    logEvent('info', 'Chamando API Claude');
    
    // Realizar chamada à API Claude (Anthropic)
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
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
        timeout: 60000
      }
    );
    
    // Extrair resposta
    const respostaText = response.data.content[0].text;
    
    // Processar a resposta JSON
    try {
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      const roteiro = JSON.parse(jsonText);
      return roteiro;
    } catch (parseError) {
      logEvent('error', 'Erro ao processar resposta JSON da Claude', {
        error: parseError.message,
        response: respostaText.substring(0, 500)
      });
      throw new Error('Resposta da Claude não é um JSON válido');
    }
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada à API Claude', {
      error: erro.message,
      response: erro.response?.data
    });
    throw erro;
  }
}
