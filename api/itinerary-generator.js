// api/itinerary-generator.js - Gerador de Roteiro com Groq IA (Versão Limpa)
const axios = require('axios');

// ============================================
// CONFIGURAÇÃO E CHAVES DE API
// ============================================

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Configurações
const TIMEOUT_MS = 45000; // 45 segundos
const MAX_TOKENS = 8192;

// ============================================
// LOGGING ESTRUTURADO
// ============================================

function logEvent(type, message, data = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    service: 'itinerary-generator',
    version: '2.0-clean',
    type,
    message,
    ...data
  };
  console.log(JSON.stringify(log));
}

// ============================================
// ENDPOINT PRINCIPAL
// ============================================

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }
  
  const startTime = Date.now();
  
  try {
    // Extrair e validar parâmetros
    const params = extrairParametros(req.body);
    
    logEvent('info', 'Iniciando geração de roteiro', {
      destino: params.destino,
      pais: params.pais,
      diasViagem: params.diasViagem,
      tipoViagem: params.tipoViagem,
      tipoCompanhia: params.tipoCompanhia,
      intensidade: params.preferencias?.intensidade_roteiro,
      orcamento: params.preferencias?.orcamento_nivel
    });
    
    // Gerar roteiro usando APENAS Groq
    const roteiro = await gerarRoteiroComGroq(params);
    
    logEvent('success', 'Roteiro gerado com Groq', { 
      dias: roteiro.dias?.length,
      tempoMs: Date.now() - startTime,
      atividadesTotal: contarAtividadesTotal(roteiro),
      climaIncluido: !!roteiro.clima
    });
    
    // Validar estrutura básica apenas
    const roteiroValidado = validarEstruturaBasica(roteiro);
    
    return res.status(200).json(roteiroValidado);
    
  } catch (erro) {
    logEvent('error', 'Erro na geração de roteiro', {
      message: erro.message,
      stack: erro.stack,
      tempoMs: Date.now() - startTime
    });
    
    return res.status(500).json({
      error: 'Erro ao gerar roteiro personalizado',
      details: erro.message
    });
  }
};

// ============================================
// GERAÇÃO COM GROQ (MÉTODO ÚNICO)
// ============================================

async function gerarRoteiroComGroq(params) {
  if (!GROQ_API_KEY) {
    throw new Error('Chave da API Groq não configurada - verifique GROQ_API_KEY no Vercel');
  }
  
  const prompt = gerarPromptOtimizado(params);
  
  logEvent('info', 'Chamando Groq API', { 
    model: 'llama3-70b-8192',
    tokens: MAX_TOKENS 
  });
  
  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'llama3-70b-8192', // Modelo mais poderoso do Groq
        messages: [
          {
            role: 'system',
            content: 'Você é a Tripinha, especialista em viagens da Benetrip. Responda SEMPRE em JSON válido seguindo exatamente o schema fornecido. Use apenas locais e atividades REAIS do destino solicitado.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: MAX_TOKENS,
        top_p: 0.9,
        stream: false,
        response_format: { 
          type: "json_object" 
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        timeout: TIMEOUT_MS
      }
    );
    
    const respostaText = response.data.choices[0].message.content;
    
    // Processar resposta JSON
    try {
      const roteiro = JSON.parse(respostaText);
      return validarEstruturaBasica(roteiro);
    } catch (parseError) {
      logEvent('error', 'Erro ao processar JSON do Groq', {
        error: parseError.message,
        response: respostaText.substring(0, 500)
      });
      throw new Error('Resposta do Groq não é um JSON válido');
    }
    
  } catch (erro) {
    if (erro.code === 'ECONNABORTED') {
      throw new Error('Timeout na chamada ao Groq API');
    }
    
    logEvent('error', 'Erro na chamada ao Groq API', {
      error: erro.message,
      status: erro.response?.status,
      data: erro.response?.data
    });
    
    throw erro;
  }
}

// ============================================
// GERAÇÃO DE PROMPT OTIMIZADO
// ============================================

function gerarPromptOtimizado(params) {
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
  const descricaoTipoViagem = {
    'relaxar': 'relaxamento, spa, praias e descanso',
    'aventura': 'aventura, esportes radicais e natureza',
    'cultura': 'cultura, história, museus e gastronomia',
    'urbano': 'vida urbana, compras, arquitetura moderna e vida noturna'
  }[tipoViagem] || 'experiências variadas e equilibradas';
  
  const descricaoCompanhia = {
    'sozinho': 'uma pessoa viajando sozinha',
    'casal': 'um casal em viagem romântica',
    'familia': 'uma família com crianças',
    'amigos': 'um grupo de amigos'
  }[tipoCompanhia] || 'viajantes';
  
  // Intensidade detalhada
  const intensidadeDetalhes = {
    'leve': 'LEVE: máximo 2-3 atividades por dia, com bastante tempo livre',
    'moderado': 'MODERADO: 3-4 atividades por dia, ritmo equilibrado',
    'intenso': 'INTENSO: 4-6 atividades por dia, aproveitamento máximo'
  };
  
  const intensidadeEscolhida = preferencias?.intensidade_roteiro || 'moderado';
  
  // Orçamento específico
  const orcamentoDetalhes = {
    'economico': 'ECONÔMICO: priorize atividades gratuitas, mercados locais, caminhadas',
    'medio': 'MÉDIO: misture atividades pagas e gratuitas, restaurantes locais',
    'alto': 'ALTO: inclua experiências premium, restaurantes renomados, tours privativos'
  };
  
  const orcamentoEscolhido = preferencias?.orcamento_nivel || 'medio';
  
  return `
MISSÃO: Criar um roteiro COMPLETO de ${diasViagem} dias para ${destino}, ${pais} com informações climáticas

PERFIL DO VIAJANTE:
- Tipo: ${descricaoCompanhia}
- Preferência: ${descricaoTipoViagem}
- ${intensidadeDetalhes[intensidadeEscolhida]}
- ${orcamentoDetalhes[orcamentoEscolhido]}

DATAS E HORÁRIOS:
- Data início: ${dataInicio}
- Data fim: ${dataFim || 'Viagem de 1 dia'}
- Chegada: ${horaChegada || '15:30'}
- Partida: ${horaSaida || '21:00'}
- DURAÇÃO TOTAL: ${diasViagem} dias

INSTRUÇÕES CRÍTICAS:
1. OBRIGATÓRIO: Crie EXATAMENTE ${diasViagem} dias de roteiro
2. INCLUA informações climáticas detalhadas para o período
3. CADA DIA deve ter atividades para manhã, tarde e noite
4. RESPEITE a intensidade ${intensidadeEscolhida} (${intensidadeDetalhes[intensidadeEscolhida]})
5. AJUSTE ao orçamento ${orcamentoEscolhido}
6. PRIMEIRO DIA: considere chegada às ${horaChegada || '15:30'}
7. ÚLTIMO DIA: considere partida às ${horaSaida || '21:00'}
8. USE APENAS locais reais e específicos de ${destino}
9. NÃO use locais genéricos como "Centro Histórico" ou "Museu Nacional"
10. CADA ATIVIDADE deve ter horário específico, local real, tags apropriadas e dica da Tripinha
11. INCLUA nomes reais: restaurantes, museus, praças, atrações turísticas
12. SEJA ESPECÍFICO: "Museu do Louvre" não "Museu Nacional", "Praça da Sé" não "Praça Central"

INFORMAÇÕES CLIMÁTICAS:
- Base as informações no conhecimento geral sobre ${destino} em ${dataInicio.split('-')[1]}/${dataInicio.split('-')[0]}
- Inclua temperatura típica, padrão de chuvas e dicas de vestimenta
- Seja específico sobre o que esperar no período da viagem

ESTILO DE COMUNICAÇÃO:
- Fale como a Tripinha: descontraída, esperta, com dicas práticas
- Dicas curtas e úteis (máximo 150 caracteres)
- Use expressões brasileiras casuais
- Seja entusiasta mas prática

ESTRUTURA JSON OBRIGATÓRIA:
{
  "destino": "${destino}, ${pais}",
  "clima": {
    "resumo": "Como geralmente é o clima em ${destino} nesta época (${dataInicio.split('-')[1]}/${dataInicio.split('-')[0]})",
    "temperatura": "Faixa de temperatura esperada (ex: 18°C a 25°C)",
    "chuva": "Padrão de chuvas no período (ex: poucas chuvas, chuvas frequentes à tarde)",
    "dicas": "Dicas da Tripinha sobre o que levar na mala e como se preparar"
  },
  "dias": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "Breve descrição do dia (até 200 chars)",
      "manha": {
        "horarioEspecial": "Chegada às XX:XX" (se aplicável),
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome específico e real do local",
            "tags": ["tag1", "tag2"],
            "dica": "Dica prática da Tripinha"
          }
        ]
      },
      "tarde": {
        "atividades": [...]
      },
      "noite": {
        "atividades": [...]
      }
    }
  ]
}

TAGS DISPONÍVEIS: ["Imperdível", "Cultural", "Gastronomia", "Natureza", "Compras", "Religioso", "Vida Noturna", "Vista Panorâmica", "Histórico", "Chegada", "Partida", "Família", "Aventura", "Relaxante", "Fotogênico"]

IMPORTANTE: 
- Se ${tipoCompanhia} = "familia", priorize atividades family-friendly
- Se ${intensidadeEscolhida} = "leve", menos atividades por período
- Se ${orcamentoEscolhido} = "economico", mais atividades gratuitas
- SEMPRE inclua pelo menos 1 "Imperdível" por dia
- Horários realistas (viagem entre locais, tempo de atividade)
- USE NOMES REAIS: Restaurante da Maria, Museu de Arte Moderna, Igreja de São Bento, etc.
- INFORMAÇÕES CLIMÁTICAS baseadas no seu conhecimento geral sobre ${destino}

EXEMPLOS DE ESPECIFICIDADE:
❌ GENÉRICO: "Centro Histórico", "Museu Nacional", "Restaurante Típico"
✅ ESPECÍFICO: "Pelourinho", "Museu Nacional de Belas Artes", "Restaurante Amado"

EXEMPLO DE CLIMA:
❌ GENÉRICO: "Clima agradável"
✅ ESPECÍFICO: "Verão europeu com temperaturas entre 20°C-28°C, chuvas raras, ideal para caminhadas"

Responda APENAS com o JSON válido, sem texto adicional.
`;
}

// ============================================
// VALIDAÇÃO MÍNIMA
// ============================================

function validarEstruturaBasica(roteiro) {
  if (!roteiro || typeof roteiro !== 'object') {
    throw new Error('Roteiro inválido: não é um objeto');
  }
  
  if (!roteiro.destino || typeof roteiro.destino !== 'string') {
    throw new Error('Roteiro inválido: destino ausente ou inválido');
  }
  
  // Validar informações climáticas
  if (!roteiro.clima || typeof roteiro.clima !== 'object') {
    throw new Error('Roteiro inválido: informações climáticas ausentes');
  }
  
  const camposClima = ['resumo', 'temperatura', 'chuva', 'dicas'];
  camposClima.forEach(campo => {
    if (!roteiro.clima[campo] || typeof roteiro.clima[campo] !== 'string') {
      throw new Error(`Roteiro inválido: campo clima.${campo} ausente ou inválido`);
    }
  });
  
  if (!Array.isArray(roteiro.dias) || roteiro.dias.length === 0) {
    throw new Error('Roteiro inválido: array de dias ausente ou vazio');
  }
  
  // Validação básica da estrutura de cada dia
  roteiro.dias.forEach((dia, index) => {
    if (!dia.data || typeof dia.data !== 'string') {
      throw new Error(`Dia ${index + 1}: data inválida ou ausente`);
    }
    
    if (!dia.descricao || typeof dia.descricao !== 'string') {
      throw new Error(`Dia ${index + 1}: descrição inválida ou ausente`);
    }
    
    ['manha', 'tarde', 'noite'].forEach(periodo => {
      if (!dia[periodo] || !Array.isArray(dia[periodo].atividades)) {
        throw new Error(`Dia ${index + 1}: período ${periodo} inválido`);
      }
      
      dia[periodo].atividades.forEach((atividade, ativIndex) => {
        if (!atividade.horario || !atividade.local || !atividade.dica) {
          throw new Error(`Dia ${index + 1}, ${periodo}, atividade ${ativIndex + 1}: campos obrigatórios ausentes`);
        }
        
        if (!Array.isArray(atividade.tags)) {
          throw new Error(`Dia ${index + 1}, ${periodo}, atividade ${ativIndex + 1}: tags deve ser um array`);
        }
      });
    });
  });
  
  return roteiro;
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

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
    preferencias
  } = body;
  
  if (!destino || !dataInicio) {
    throw new Error('Parâmetros obrigatórios: destino, dataInicio');
  }
  
  const diasViagem = calcularDiasViagem(dataInicio, dataFim);
  
  return {
    destino: String(destino).trim(),
    pais: String(pais || 'Internacional').trim(),
    dataInicio: String(dataInicio),
    dataFim: dataFim ? String(dataFim) : null,
    horaChegada: String(horaChegada || '15:30'),
    horaSaida: String(horaSaida || '21:00'),
    diasViagem,
    tipoViagem: String(tipoViagem || 'cultura'),
    tipoCompanhia: String(tipoCompanhia || 'sozinho'),
    preferencias: preferencias || {}
  };
}

function calcularDiasViagem(dataInicio, dataFim) {
  if (!dataInicio) return 1;
  
  const inicio = new Date(dataInicio);
  
  if (!dataFim) return 1;
  
  const fim = new Date(dataFim);
  
  const diffTempo = Math.abs(fim - inicio);
  const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;
  
  return Math.max(1, Math.min(30, diffDias)); // Entre 1 e 30 dias
}

function contarAtividadesTotal(roteiro) {
  if (!roteiro.dias) return 0;
  
  return roteiro.dias.reduce((total, dia) => {
    const manha = dia.manha?.atividades?.length || 0;
    const tarde = dia.tarde?.atividades?.length || 0;
    const noite = dia.noite?.atividades?.length || 0;
    return total + manha + tarde + noite;
  }, 0);
}
