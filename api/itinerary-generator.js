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
    
    // Calcular número de dias
    const diasViagem = calcularDiasViagem(dataInicio, dataFim);
    
    // Log dos parâmetros recebidos
    logEvent('info', 'Gerando roteiro personalizado', {
      destino,
      pais,
      diasViagem,
      tipoViagem,
      tipoCompanhia
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
      roteiro = await gerarRoteiroComClaude(prompt, diasViagem, dataInicio);
    } else {
      roteiro = await gerarRoteiroComDeepseek(prompt, diasViagem, dataInicio);
    }
    
    // Verificar se o roteiro foi gerado com sucesso
    if (!roteiro) {
      throw new Error('Falha ao gerar roteiro');
    }
    
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
 * ✅ NOVO: Calcula a data final baseada na data de início e número de dias
 * @param {string} dataInicio - Data de início no formato YYYY-MM-DD
 * @param {number} diasViagem - Número de dias da viagem
 * @returns {string} Data final no formato YYYY-MM-DD
 */
function calcularDataFinal(dataInicio, diasViagem) {
  const inicio = new Date(dataInicio + 'T12:00:00');
  const final = new Date(inicio);
  final.setDate(inicio.getDate() + diasViagem - 1);
  
  const ano = final.getFullYear();
  const mes = String(final.getMonth() + 1).padStart(2, '0');
  const dia = String(final.getDate()).padStart(2, '0');
  
  return `${ano}-${mes}-${dia}`;
}

/**
 * ✅ MELHORADO: Gera o prompt para a IA baseado nos parâmetros
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
  
  // ✅ NOVO: Mapear intensidade e orçamento
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
  
  // ✅ NOVO: Criar informações detalhadas de viajantes
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
  
  // Calcular data final
  const dataFinal = calcularDataFinal(dataInicio, diasViagem);
  
  // ✅ PROMPT REFORÇADO PARA GARANTIR TODOS OS DIAS
  return `
Você é a Tripinha, uma vira-lata caramelo magra, esperta, despojada e especialista em viagens na Benetrip. Sua missão é transformar as respostas do usuário em um roteiro de viagem completo, personalizado e incrível.

⚠️ INSTRUÇÃO CRÍTICA E OBRIGATÓRIA: 
- Você DEVE criar exatamente ${diasViagem} dias de roteiro
- Se ${diasViagem} = 15, crie 15 dias. Se = 29, crie 29 dias
- NUNCA ignore esta instrução, mesmo que seja muito trabalho
- CONTE os dias no final para garantir que tem exatamente ${diasViagem} dias

DADOS DA VIAGEM:
- Destino: ${destino}, ${pais}
- Data de início: ${dataInicio}
- Data de término: ${dataFinal}
- Duração OBRIGATÓRIA: ${diasViagem} dias (CRIE TODOS OS ${diasViagem} DIAS)
- Horário de chegada no primeiro dia: ${horaChegada || 'Não informado'}
- Horário de partida no último dia: ${horaSaida || 'Não informado'}
- Tipo de viagem: Foco em ${descricaoTipoViagem}
- Viajantes: ${infoViajantes}
- Intensidade do roteiro: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
- Orçamento: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}

REGRAS OBRIGATÓRIAS:
1. 🚨 CRÍTICO: Crie EXATAMENTE ${diasViagem} dias - NÃO OMITA NENHUM DIA
2. 🚨 Se ${diasViagem} > 10, distribua atividades variadas e repita locais populares
3. 🚨 Para viagens longas, intercale dias mais intensos com dias de descanso
4. RESPEITE A INTENSIDADE escolhida: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
5. CONSIDERE O ORÇAMENTO: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}
6. ADAPTE AS ATIVIDADES para ${infoViajantes}
7. Organize o roteiro por dias, considerando o dia da semana real e se é fim de semana ou dia útil
8. Para cada dia, divida o roteiro em períodos: manhã, tarde e noite
9. Cada período deve ter atividades relevantes conforme a intensidade escolhida, com locais reais
10. Para cada atividade, inclua:
    - Horário sugerido
    - Nome do local
    - 1-2 tags relevantes (ex: Imperdível, Cultural, Família)
    - Uma dica personalizada da Tripinha
11. No primeiro dia, considere o horário de chegada (${horaChegada || 'não informado'})
12. No último dia, considere o horário de partida (${horaSaida || 'não informado'})
13. Inclua uma breve descrição para cada dia
14. FAÇA O MÁXIMO PARA QUE TODOS OS ${diasViagem} DIAS TENHAM ATIVIDADES DIFERENTES
15. 🚨 CRITICAL: Você DEVE criar atividades para TODOS os ${diasViagem} dias sem exceções

ESTRUTURA OBRIGATÓRIA DO JSON:
{
  "destino": "Nome do destino",
  "dias": [
    {
      "data": "${dataInicio}",
      "descricao": "Breve descrição sobre o dia 1",
      "manha": {
        "horarioEspecial": "Chegada às XX:XX" (opcional, apenas se for chegada/partida),
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome do local",
            "tags": ["tag1", "tag2"],
            "dica": "Dica da Tripinha sobre o local"
          }
        ]
      },
      "tarde": { ... mesmo formato da manhã ... },
      "noite": { ... mesmo formato da manhã ... }
    },
    // ... CONTINUE ATÉ O DIA ${diasViagem}
    {
      "data": "${dataFinal}",
      "descricao": "Breve descrição sobre o último dia",
      "manha": { ... },
      "tarde": { ... },
      "noite": { ... }
    }
  ]
}

⚠️ VALIDAÇÃO FINAL OBRIGATÓRIA: 
Antes de responder, conte os dias no array "dias". 
Se não tiver exatamente ${diasViagem} dias, ADICIONE os dias faltantes.
O array "dias" DEVE ter length = ${diasViagem}.

OBSERVAÇÕES IMPORTANTES:
- Para ${infoViajantes}, dê prioridade a atividades compatíveis
- Como o foco é ${descricaoTipoViagem}, sugira mais atividades relacionadas a esse tema
- Respeite rigorosamente a intensidade de ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
- Ajuste as sugestões ao orçamento ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}
- Considere atividades para dias úteis e atividades específicas para fins de semana
- Inclua uma mistura de atrações turísticas populares e experiências locais
- Garanta que destinos mais conhecidos estejam no roteiro da viagem

RESPONDA APENAS COM O JSON. NÃO ADICIONE TEXTO ANTES OU DEPOIS.
`;
}

/**
 * ✅ MELHORADO: Gera roteiro utilizando a API DeepSeek
 * @param {string} prompt - Prompt para a IA
 * @param {number} diasViagem - Número de dias esperados
 * @param {string} dataInicio - Data de início da viagem
 * @returns {Object} Roteiro gerado
 */
async function gerarRoteiroComDeepseek(prompt, diasViagem, dataInicio) {
  try {
    // Verificar se a chave da API está configurada
    if (!DEEPSEEK_API_KEY) {
      throw new Error('Chave da API DeepSeek não configurada');
    }
    
    // ✅ TIMEOUT AUMENTADO PARA ROTEIROS LONGOS
    const timeoutMs = 180000; // 3 minutos (era padrão ~30s)
    
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
        max_tokens: 8000, // ✅ AUMENTADO para roteiros longos (era ~2000)
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        timeout: timeoutMs // ✅ TIMEOUT EXPLÍCITO
      }
    );
    
    // Extrair resposta
    const respostaText = response.data.choices[0].message.content;
    
    // Processar a resposta JSON
    try {
      // Limpar qualquer markdown ou texto antes/depois do JSON
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      
      // Parsear para objeto
      const roteiro = JSON.parse(jsonText);
      
      // ✅ VALIDAR E CORRIGIR NÚMERO DE DIAS
      return validarECorrigirRoteiro(roteiro, diasViagem, dataInicio);
      
    } catch (parseError) {
      logEvent('error', 'Erro ao processar resposta JSON da DeepSeek', {
        error: parseError.message,
        response: respostaText
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
 * ✅ MELHORADO: Gera roteiro utilizando a API Claude (Anthropic)
 * @param {string} prompt - Prompt para a IA
 * @param {number} diasViagem - Número de dias esperados
 * @param {string} dataInicio - Data de início da viagem
 * @returns {Object} Roteiro gerado
 */
async function gerarRoteiroComClaude(prompt, diasViagem, dataInicio) {
  try {
    // Verificar se a chave da API está configurada
    if (!CLAUDE_API_KEY) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    // ✅ TIMEOUT AUMENTADO
    const timeoutMs = 180000; // 3 minutos
    
    // Realizar chamada à API Claude (Anthropic)
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 8000, // ✅ AUMENTADO para roteiros longos
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
        timeout: timeoutMs // ✅ TIMEOUT EXPLÍCITO
      }
    );
    
    // Extrair resposta
    const respostaText = response.data.content[0].text;
    
    // Processar a resposta JSON
    try {
      // Limpar qualquer markdown ou texto antes/depois do JSON
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      
      // Parsear para objeto
      const roteiro = JSON.parse(jsonText);
      
      // ✅ VALIDAR E CORRIGIR NÚMERO DE DIAS
      return validarECorrigirRoteiro(roteiro, diasViagem, dataInicio);
      
    } catch (parseError) {
      logEvent('error', 'Erro ao processar resposta JSON da Claude', {
        error: parseError.message,
        response: respostaText
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

/**
 * ✅ NOVO: Valida e corrige o roteiro para garantir o número correto de dias
 * @param {Object} roteiro - Roteiro recebido da IA
 * @param {number} diasEsperados - Número de dias esperados
 * @param {string} dataInicio - Data de início da viagem
 * @returns {Object} Roteiro validado e corrigido
 */
function validarECorrigirRoteiro(roteiro, diasEsperados, dataInicio) {
  // Validar estrutura básica
  if (!roteiro.dias || !Array.isArray(roteiro.dias)) {
    throw new Error('Estrutura de roteiro inválida: propriedade "dias" não encontrada ou não é array');
  }
  
  const diasRecebidos = roteiro.dias.length;
  
  logEvent('info', 'Validando roteiro da IA', {
    diasEsperados,
    diasRecebidos,
    diferenca: diasEsperados - diasRecebidos
  });
  
  // Se o número de dias está correto, retornar como está
  if (diasRecebidos === diasEsperados) {
    logEvent('success', 'Roteiro da IA tem o número correto de dias');
    return roteiro;
  }
  
  // Se recebeu menos dias que esperado, estender o roteiro
  if (diasRecebidos < diasEsperados) {
    logEvent('warning', 'IA retornou menos dias que solicitado, estendendo roteiro', {
      esperado: diasEsperados,
      recebido: diasRecebidos,
      faltam: diasEsperados - diasRecebidos
    });
    
    roteiro.dias = estenderRoteiro(roteiro.dias, diasEsperados, dataInicio);
  }
  
  // Se recebeu mais dias que esperado, truncar
  if (diasRecebidos > diasEsperados) {
    logEvent('warning', 'IA retornou mais dias que solicitado, truncando roteiro', {
      esperado: diasEsperados,
      recebido: diasRecebidos
    });
    
    roteiro.dias = roteiro.dias.slice(0, diasEsperados);
  }
  
  logEvent('success', 'Roteiro corrigido com sucesso', {
    diasFinais: roteiro.dias.length
  });
  
  return roteiro;
}

/**
 * ✅ NOVO: Estende roteiro quando IA retorna menos dias que solicitado
 * @param {Array} diasExistentes - Dias já criados pela IA
 * @param {number} diasTotal - Total de dias necessários
 * @param {string} dataInicio - Data de início da viagem
 * @returns {Array} Array de dias estendido
 */
function estenderRoteiro(diasExistentes, diasTotal, dataInicio) {
  const diasEstendidos = [...diasExistentes];
  
  // Calcular próxima data baseada no último dia existente ou data de início
  let ultimaData;
  if (diasExistentes.length > 0 && diasExistentes[diasExistentes.length - 1].data) {
    ultimaData = new Date(diasExistentes[diasExistentes.length - 1].data + 'T12:00:00');
  } else {
    ultimaData = new Date(dataInicio + 'T12:00:00');
    ultimaData.setDate(ultimaData.getDate() + diasExistentes.length - 1);
  }
  
  // Criar atividades variadas para repetir
  const atividadesVariadas = [
    {
      horario: "09:00",
      local: "Exploração livre do centro da cidade",
      tags: ["Livre", "Descoberta"],
      dica: "Caminhe sem pressa e descubra novos cantinhos!"
    },
    {
      horario: "14:00", 
      local: "Visita a mercados locais",
      tags: ["Cultural", "Gastronomia"],
      dica: "Prove frutas e produtos locais!"
    },
    {
      horario: "19:00",
      local: "Jantar em restaurante típico",
      tags: ["Gastronomia", "Típico"],
      dica: "Peça a especialidade da casa!"
    }
  ];
  
  const atividadesAlternativas = [
    {
      horario: "10:00",
      local: "Revisitar locais favoritos",
      tags: ["Favoritos", "Relaxante"],
      dica: "Volte aos lugares que mais gostou!"
    },
    {
      horario: "15:30",
      local: "Compras de lembranças",
      tags: ["Compras", "Lembranças"],
      dica: "Hora de comprar presentes especiais!"
    },
    {
      horario: "20:00",
      local: "Experiência noturna local",
      tags: ["Noturno", "Cultural"],
      dica: "Viva a vida noturna como um local!"
    }
  ];
  
  // Adicionar dias faltantes
  while (diasEstendidos.length < diasTotal) {
    const proximoDia = diasEstendidos.length + 1;
    
    // Calcular próxima data
    ultimaData.setDate(ultimaData.getDate() + 1);
    const dataProxima = formatarDataISO(ultimaData);
    
    // Escolher conjunto de atividades (alternando)
    const atividades = proximoDia % 2 === 0 ? atividadesAlternativas : atividadesVariadas;
    
    const novoDia = {
      data: dataProxima,
      descricao: `Dia ${proximoDia} - Explorando mais do destino e aproveitando experiências adicionais`,
      manha: {
        atividades: [atividades[0]]
      },
      tarde: {
        atividades: [atividades[1]]
      },
      noite: {
        atividades: [atividades[2]]
      }
    };
    
    // Se for o último dia, ajustar para partida
    if (proximoDia === diasTotal) {
      novoDia.descricao = `Dia ${proximoDia} - Últimos momentos e preparação para a partida`;
      novoDia.noite = {
        atividades: [{
          horario: "18:00",
          local: "Preparação para partida",
          tags: ["Partida", "Organização"],
          dica: "Organize as malas e prepare-se para a despedida!"
        }]
      };
    }
    
    diasEstendidos.push(novoDia);
  }
  
  return diasEstendidos;
}

/**
 * ✅ NOVO: Formatar data no padrão ISO (YYYY-MM-DD)
 * @param {Date} data - Objeto Date
 * @returns {string} Data formatada
 */
function formatarDataISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  
  return `${ano}-${mes}-${dia}`;
}
