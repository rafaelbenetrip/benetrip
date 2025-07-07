// api/itinerary-generator.js - OTIMIZADO PARA VERCEL SERVERLESS

// ⚡ CHAVES DE AMBIENTE VERCEL
const DEEPSEEK_API_KEY = process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// 📊 LOG ESTRUTURADO PARA VERCEL
function logVercel(type, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`, data);
}

/**
 * 🚀 HANDLER PRINCIPAL VERCEL SERVERLESS
 */
export default async function handler(req, res) {
  // ⏱️ Configurar timeout específico do Vercel
  const startTime = Date.now();
  
  // 🌐 CORS para Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Apenas POST aceito
  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'Método não permitido',
      allowed: ['POST'],
      received: req.method
    });
    return;
  }

  try {
    logVercel('info', 'Iniciando geração de roteiro', {
      method: req.method,
      hasDeepseek: !!DEEPSEEK_API_KEY,
      hasClaude: !!CLAUDE_API_KEY,
      vercelRegion: process.env.VERCEL_REGION || 'unknown'
    });

    // 📋 EXTRAIR PARÂMETROS
    const {
      destino,
      pais,
      dataInicio,
      dataFim,
      horaChegada = '15:30',
      horaSaida = '21:00',
      tipoViagem = 'cultura',
      tipoCompanhia = 'casal',
      preferencias = {},
      modeloIA = 'deepseek'
    } = req.body || {};

    // ✅ VALIDAÇÃO BÁSICA
    if (!destino) {
      res.status(400).json({
        error: 'Parâmetro obrigatório: destino',
        received: { destino, dataInicio },
        exemplo: {
          destino: 'Lisboa',
          pais: 'Portugal',
          dataInicio: '2025-08-01'
        }
      });
      return;
    }

    // 📅 CALCULAR DIAS
    const diasViagem = calcularDiasViagem(dataInicio, dataFim);
    
    logVercel('info', 'Parâmetros processados', {
      destino, pais, diasViagem, tipoViagem, tipoCompanhia
    });

    // 🤖 TENTAR GERAR VIA IA
    let roteiro = null;
    let fonteUsada = 'fallback';

    // Verificar se temos pelo menos uma API key
    if (!DEEPSEEK_API_KEY && !CLAUDE_API_KEY) {
      logVercel('warn', 'Nenhuma API key encontrada - usando fallback');
    } else {
      try {
        const prompt = criarPromptOtimizado({
          destino, pais, dataInicio, dataFim, horaChegada, horaSaida,
          diasViagem, tipoViagem, tipoCompanhia, preferencias
        });

        if (modeloIA === 'claude' && CLAUDE_API_KEY) {
          logVercel('info', 'Tentando Claude API');
          roteiro = await chamarClaudeAPI(prompt);
          fonteUsada = 'claude';
        } else if (DEEPSEEK_API_KEY) {
          logVercel('info', 'Tentando DeepSeek API');
          roteiro = await chamarDeepseekAPI(prompt);
          fonteUsada = 'deepseek';
        }
      } catch (apiError) {
        logVercel('error', 'Erro na API de IA', {
          error: apiError.message,
          stack: apiError.stack?.substring(0, 500)
        });
      }
    }

    // 🆘 FALLBACK SE IA FALHOU
    if (!roteiro || !roteiro.dias) {
      logVercel('info', 'Usando roteiro de fallback');
      roteiro = criarRoteiroFallback(destino, pais, dataInicio, dataFim, diasViagem);
      fonteUsada = 'fallback';
    }

    // 📊 ADICIONAR METADATA
    roteiro.metadata = {
      geradoEm: new Date().toISOString(),
      fonte: fonteUsada,
      versao: '8.5-vercel',
      diasTotal: roteiro.dias?.length || 0,
      tempoProcessamento: Date.now() - startTime,
      vercelRegion: process.env.VERCEL_REGION || 'unknown'
    };

    logVercel('success', 'Roteiro gerado com sucesso', {
      fonte: fonteUsada,
      dias: roteiro.dias?.length,
      tempo: Date.now() - startTime
    });

    // ✅ RETORNAR SUCESSO
    res.status(200).json(roteiro);

  } catch (error) {
    const tempoErro = Date.now() - startTime;
    
    logVercel('error', 'Erro fatal no handler', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      tempo: tempoErro
    });

    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error.message,
      timestamp: new Date().toISOString(),
      hasApiKeys: {
        deepseek: !!DEEPSEEK_API_KEY,
        claude: !!CLAUDE_API_KEY
      },
      tempoProcessamento: tempoErro
    });
  }
}

/**
 * 📅 CALCULAR DIAS DE VIAGEM
 */
function calcularDiasViagem(dataInicio, dataFim) {
  if (!dataInicio) return 3; // Padrão
  
  try {
    const inicio = new Date(dataInicio);
    const fim = dataFim ? new Date(dataFim) : inicio;
    
    const diffMs = Math.abs(fim - inicio);
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
    
    return Math.max(1, Math.min(10, diffDias)); // Entre 1 e 10 dias
  } catch (e) {
    return 3;
  }
}

/**
 * 📝 CRIAR PROMPT OTIMIZADO
 */
function criarPromptOtimizado(params) {
  const { destino, pais, diasViagem, tipoViagem, tipoCompanhia } = params;
  
  return `Crie um roteiro de viagem em formato JSON para:

DESTINO: ${destino}, ${pais}
DURAÇÃO: ${diasViagem} dias
TIPO: ${tipoViagem} 
VIAJANTES: ${tipoCompanhia}

Retorne APENAS o JSON no formato:
{
  "destino": "${destino}, ${pais}",
  "dias": [
    {
      "data": "2025-08-01",
      "descricao": "Primeiro dia em ${destino}",
      "manha": {
        "atividades": [
          {
            "horario": "09:00",
            "local": "Centro Histórico",
            "tags": ["Cultural", "Imperdível"],
            "dica": "Chegue cedo para evitar multidões!"
          }
        ]
      },
      "tarde": {
        "atividades": [
          {
            "horario": "14:00",
            "local": "Museu Principal",
            "tags": ["Cultural"],
            "dica": "Reserve pelo menos 2 horas para a visita."
          }
        ]
      },
      "noite": {
        "atividades": [
          {
            "horario": "19:00",
            "local": "Restaurante Típico",
            "tags": ["Gastronomia"],
            "dica": "Experimente o prato tradicional!"
          }
        ]
      }
    }
  ]
}

IMPORTANTE: 
- Crie EXATAMENTE ${diasViagem} dias
- Use locais reais de ${destino}
- Horários realistas
- Tags: Cultural, Gastronomia, Natureza, Compras, Imperdível
- RETORNE APENAS O JSON, sem texto adicional`;
}

/**
 * 🤖 CHAMAR DEEPSEEK API (USANDO FETCH NATIVO)
 */
async function chamarDeepseekAPI(prompt) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DeepSeek API key não configurada');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 40000); // 40s para Vercel

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'User-Agent': 'Benetrip/1.0'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 3000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da DeepSeek API');
    }

    // Extrair JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON não encontrado na resposta da DeepSeek');
    }

    const roteiro = JSON.parse(jsonMatch[0]);
    return roteiro;

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Timeout na DeepSeek API (>40s)');
    }
    
    throw error;
  }
}

/**
 * 🤖 CHAMAR CLAUDE API (USANDO FETCH NATIVO)
 */
async function chamarClaudeAPI(prompt) {
  if (!CLAUDE_API_KEY) {
    throw new Error('Claude API key não configurada');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 40000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error('Resposta vazia da Claude API');
    }

    // Extrair JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON não encontrado na resposta da Claude');
    }

    const roteiro = JSON.parse(jsonMatch[0]);
    return roteiro;

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Timeout na Claude API (>40s)');
    }
    
    throw error;
  }
}

/**
 * 🆘 ROTEIRO FALLBACK BÁSICO
 */
function criarRoteiroFallback(destino, pais, dataInicio, dataFim, diasViagem) {
  const dias = [];
  const dataBase = new Date(dataInicio || '2025-08-01');

  for (let i = 0; i < diasViagem; i++) {
    const dataAtual = new Date(dataBase);
    dataAtual.setDate(dataBase.getDate() + i);
    const dataISO = dataAtual.toISOString().split('T')[0];

    dias.push({
      data: dataISO,
      descricao: `Dia ${i + 1} explorando ${destino}`,
      manha: {
        atividades: [{
          horario: '09:00',
          local: `Centro de ${destino}`,
          tags: ['Exploração'],
          dica: 'Comece explorando o centro da cidade!'
        }]
      },
      tarde: {
        atividades: [{
          horario: '14:00',
          local: `Principais Atrações de ${destino}`,
          tags: ['Turístico'],
          dica: 'Visite os pontos mais famosos!'
        }]
      },
      noite: {
        atividades: [{
          horario: '19:00',
          local: `Gastronomia Local`,
          tags: ['Gastronomia'],
          dica: 'Experimente os sabores locais!'
        }]
      }
    });
  }

  return {
    destino: `${destino}, ${pais || 'Destino'}`,
    dias
  };
}
