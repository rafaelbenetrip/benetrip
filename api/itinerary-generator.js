// api/itinerary-generator.js - Endpoint para geração de roteiro personalizado com GROQ
// Versão 2.0 - Otimizada para velocidade com Groq
const axios = require('axios');
const http = require('http');
const https = require('https');

// =======================
// Configurações Groq
// =======================
const CONFIG = {
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    models: {
      primary: 'llama-3.3-70b-versatile',      // Modelo principal - rápido e eficaz
      fast: 'llama-3.1-8b-instant',            // Backup ultra-rápido
      toolUse: 'llama3-groq-70b-8192-tool-use-preview' // Para features futuras
    },
    timeout: 60000,      // 60 segundos (Groq é mais rápido)
    maxTokens: 4000,     // Suficiente para roteiro completo
    temperature: 0.7     // Criatividade balanceada
  },
  retries: 2,
  logging: {
    enabled: true,
    maxLength: 500
  }
};

// =======================
// Cliente HTTP configurado
// =======================
const apiClient = axios.create({
  timeout: CONFIG.groq.timeout,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

// =======================
// Função auxiliar para logging estruturado
// =======================
function logEvent(type, message, data = {}) {
  if (!CONFIG.logging.enabled) return;
  
  const log = {
    timestamp: new Date().toISOString(),
    type,
    message,
    ...data
  };
  
  if (type === 'error') {
    console.error(JSON.stringify(log));
  } else {
    console.log(JSON.stringify(log));
  }
}

// =======================
// Função para extrair JSON da resposta
// =======================
function extrairJSONDaResposta(texto) {
  try {
    // Se já for objeto, retornar direto
    if (typeof texto === 'object' && texto !== null) {
      return texto;
    }
    
    // Tentar parse direto
    try {
      return JSON.parse(texto);
    } catch {}
    
    // Limpar markdown e comentários
    const textoLimpo = texto
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    
    // Procurar JSON válido
    const match = textoLimpo.match(/\{[\s\S]*\}/);
    if (match && match[0]) {
      return JSON.parse(match[0]);
    }
    
    throw new Error('JSON não encontrado na resposta');
    
  } catch (error) {
    logEvent('error', 'Erro ao extrair JSON', { error: error.message });
    return null;
  }
}

// =======================
// Chamada à API Groq
// =======================
async function chamarGroqAPI(prompt, model = CONFIG.groq.models.primary) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('Chave da API Groq não configurada (GROQ_API_KEY)');
  }
  
  const systemMessage = `Você é a Tripinha, uma vira-lata caramelo especialista em viagens da Benetrip.
Sua missão é criar roteiros detalhados e personalizados.

PERSONALIDADE:
- Fale como uma amiga próxima: leve, simpática, com bom humor
- Use experiências pessoais ("quando visitei...", "adorei quando...")
- Seja prática e direta nas dicas
- Use emojis com moderação

IMPORTANTE:
- Crie EXATAMENTE o número de dias solicitado
- Cada dia deve ter atividades completas
- Respeite horários de chegada/partida
- Retorne APENAS JSON válido, sem formatação markdown`;

  try {
    logEvent('info', `Chamando Groq API (${model})...`);
    
    const requestPayload = {
      model: model,
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: CONFIG.groq.temperature,
      max_tokens: CONFIG.groq.maxTokens,
      stream: false
    };
    
    const response = await apiClient({
      method: 'post',
      url: `${CONFIG.groq.baseURL}/chat/completions`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: requestPayload
    });
    
    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error(`Formato de resposta inválido do Groq`);
    }
    
    const content = response.data.choices[0].message.content;
    logEvent('info', `Resposta recebida do Groq (${model})`);
    
    return extrairJSONDaResposta(content);
    
  } catch (error) {
    logEvent('error', `Erro na API Groq (${model})`, { 
      message: error.message,
      response: error.response?.data 
    });
    throw error;
  }
}

// =======================
// Gerar prompt otimizado para Groq
// =======================
function gerarPromptGroq(params) {
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
  
  // Calcular informações adicionais
  const intensidadeInfo = {
    'leve': '2-3 atividades por dia',
    'moderado': '4-5 atividades por dia', 
    'intenso': '6+ atividades por dia'
  }[preferencias?.intensidade_roteiro] || '4-5 atividades por dia';
  
  const orcamentoInfo = {
    'economico': 'priorize atividades gratuitas',
    'medio': 'misture atividades gratuitas e pagas',
    'alto': 'inclua experiências premium'
  }[preferencias?.orcamento_nivel] || 'equilibrado';

  return `Crie um roteiro COMPLETO de ${diasViagem} dias para ${destino}, ${pais}.

DADOS DA VIAGEM:
- Período: ${dataInicio} a ${dataFim || dataInicio} (${diasViagem} dias)
- Chegada: ${horaChegada || 'não informado'}
- Partida: ${horaSaida || 'não informado'}  
- Viajantes: ${tipoCompanhia}
- Foco: ${tipoViagem}
- Intensidade: ${intensidadeInfo}
- Orçamento: ${orcamentoInfo}

REGRAS CRÍTICAS:
1. Crie EXATAMENTE ${diasViagem} dias com atividades
2. Cada dia deve ter manhã, tarde e noite
3. No primeiro dia, considere o horário de chegada
4. No último dia, considere o horário de partida
5. Adapte as atividades para ${tipoCompanhia}

ESTRUTURA JSON OBRIGATÓRIA:
{
  "destino": "Cidade, País",
  "dias": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "Descrição breve do dia",
      "manha": {
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome do local real",
            "tags": ["tag1", "tag2"],
            "dica": "Dica da Tripinha"
          }
        ]
      },
      "tarde": { ... },
      "noite": { ... }
    }
  ]
}

Garanta que todos os ${diasViagem} dias tenham atividades diferentes e relevantes para ${destino}.
Use locais e pontos turísticos REAIS de ${destino}.
Adapte para ${tipoCompanhia} com foco em ${tipoViagem}.

RETORNE APENAS O JSON, SEM MARKDOWN OU EXPLICAÇÕES.`;
}

// =======================
// Retry com fallback entre modelos
// =======================
async function executarComRetry(prompt, maxTentativas = CONFIG.retries) {
  const modelos = [
    CONFIG.groq.models.primary,  // Primeiro: Llama 3.3 70B
    CONFIG.groq.models.fast      // Segundo: Llama 3.1 8B (backup rápido)
  ];
  
  for (const modelo of modelos) {
    logEvent('info', `Tentando com modelo: ${modelo}`);
    
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      try {
        const resultado = await chamarGroqAPI(prompt, modelo);
        
        if (resultado && validarRoteiro(resultado)) {
          logEvent('info', `Sucesso com ${modelo} na tentativa ${tentativa}`);
          return { roteiro: resultado, modelo };
        }
        
        logEvent('warning', `Resposta inválida do ${modelo}, tentativa ${tentativa}`);
        
      } catch (error) {
        logEvent('error', `Erro no ${modelo}, tentativa ${tentativa}`, { 
          message: error.message 
        });
        
        if (tentativa < maxTentativas) {
          // Aguardar antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 1000 * tentativa));
        }
      }
    }
  }
  
  throw new Error('Todos os modelos falharam após múltiplas tentativas');
}

// =======================
// Validar estrutura do roteiro
// =======================
function validarRoteiro(roteiro) {
  try {
    // Verificações básicas
    if (!roteiro || typeof roteiro !== 'object') {
      return false;
    }
    
    if (!roteiro.destino || !Array.isArray(roteiro.dias)) {
      return false;
    }
    
    if (roteiro.dias.length === 0) {
      return false;
    }
    
    // Verificar estrutura de cada dia
    for (const dia of roteiro.dias) {
      if (!dia.data || !dia.descricao) {
        return false;
      }
      
      // Pelo menos um período deve ter atividades
      const temAtividades = 
        (dia.manha?.atividades?.length > 0) ||
        (dia.tarde?.atividades?.length > 0) ||
        (dia.noite?.atividades?.length > 0);
      
      if (!temAtividades) {
        return false;
      }
    }
    
    return true;
    
  } catch (error) {
    logEvent('error', 'Erro ao validar roteiro', { error: error.message });
    return false;
  }
}

// =======================
// Completar roteiro se necessário
// =======================
function completarRoteiro(roteiro, diasEsperados) {
  // Garantir que temos o número correto de dias
  while (roteiro.dias.length < diasEsperados) {
    const ultimoDia = roteiro.dias[roteiro.dias.length - 1];
    const novaData = new Date(ultimoDia.data);
    novaData.setDate(novaData.getDate() + 1);
    
    roteiro.dias.push({
      data: novaData.toISOString().split('T')[0],
      descricao: "Dia livre para explorar ou descansar",
      manha: {
        atividades: [{
          horario: "09:00",
          local: "Dia livre - Sugestão: explorar bairros locais",
          tags: ["Livre", "Opcional"],
          dica: "Aproveite para revisitar seus lugares favoritos ou descansar!"
        }]
      },
      tarde: { atividades: [] },
      noite: { atividades: [] }
    });
  }
  
  // Remover dias extras se houver
  if (roteiro.dias.length > diasEsperados) {
    roteiro.dias = roteiro.dias.slice(0, diasEsperados);
  }
  
  return roteiro;
}

// =======================
// Handler principal da API
// =======================
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Responder a preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }
  
  try {
    // Obter parâmetros
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
      modeloIA // Ignorado - sempre usa Groq
    } = req.body;
    
    // Validar parâmetros obrigatórios
    if (!destino || !dataInicio) {
      return res.status(400).json({ 
        error: 'Parâmetros obrigatórios: destino, dataInicio' 
      });
    }
    
    // Calcular dias de viagem
    const diasViagem = calcularDiasViagem(dataInicio, dataFim);
    
    logEvent('info', 'Gerando roteiro com Groq', {
      destino,
      pais: pais || 'Internacional',
      diasViagem,
      tipoViagem,
      tipoCompanhia
    });
    
    // Gerar prompt otimizado
    const prompt = gerarPromptGroq({
      destino,
      pais: pais || 'Internacional',
      dataInicio,
      dataFim,
      horaChegada,
      horaSaida,
      diasViagem,
      tipoViagem,
      tipoCompanhia,
      preferencias
    });
    
    // Executar com retry e fallback
    const { roteiro, modelo } = await executarComRetry(prompt);
    
    // Completar roteiro se necessário
    const roteiroCompleto = completarRoteiro(roteiro, diasViagem);
    
    // Adicionar metadados
    roteiroCompleto.metadados = {
      provider: 'groq',
      modelo: modelo,
      versao: '2.0',
      timestamp: new Date().toISOString(),
      diasSolicitados: diasViagem
    };
    
    logEvent('info', 'Roteiro gerado com sucesso', {
      modelo,
      diasGerados: roteiroCompleto.dias.length
    });
    
    // Retornar roteiro
    return res.status(200).json(roteiroCompleto);
    
  } catch (erro) {
    logEvent('error', 'Erro ao gerar roteiro', {
      message: erro.message,
      stack: erro.stack
    });
    
    // Verificar se é erro de API key
    if (erro.message.includes('GROQ_API_KEY')) {
      return res.status(500).json({
        error: 'Configuração do servidor incompleta',
        details: 'API key não configurada'
      });
    }
    
    return res.status(500).json({
      error: 'Erro ao gerar roteiro personalizado',
      details: erro.message
    });
  }
};

// =======================
// Funções auxiliares
// =======================

/**
 * Calcula o número de dias entre duas datas
 */
function calcularDiasViagem(dataInicio, dataFim) {
  if (!dataInicio) return 1;
  
  const inicio = new Date(dataInicio);
  
  if (!dataFim) return 1;
  
  const fim = new Date(dataFim);
  
  const diffTempo = Math.abs(fim - inicio);
  const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;
  
  // Limitar entre 1 e 30 dias
  return Math.min(Math.max(diffDias, 1), 30);
}
