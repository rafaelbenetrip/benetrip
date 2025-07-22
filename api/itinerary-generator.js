// api/itinerary-generator.js - Endpoint para geração de roteiro personalizado (OTIMIZADO)
const axios = require('axios');

// Chaves de API
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Modelo padrão a ser usado (DeepSeek Coder)
const DEFAULT_MODEL = 'deepseek-chat';

// ✅ CONFIGURAÇÕES OTIMIZADAS PARA ROTEIROS MAIORES
const CONFIG_OTIMIZADA = {
  // Timeouts aumentados para roteiros maiores
  TIMEOUT_API_SECONDS: 120, // 2 minutos (antes era padrão ~30s)
  
  // Tokens aumentados significativamente
  MAX_TOKENS_DEEPSEEK: 8000, // Aumentado para suportar roteiros longos
  MAX_TOKENS_CLAUDE: 8000,   // Dobrado de 4000 para 8000
  
  // Limites de dias expandidos
  MAX_DIAS_VIAGEM: 60,       // Aumentado de 30 para 60 dias
  MIN_DIAS_VIAGEM: 1,
  
  // Configurações de retry
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000
};

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
    
    // ✅ VALIDAÇÃO EXPANDIDA PARA ROTEIROS MAIORES
    if (diasViagem > CONFIG_OTIMIZADA.MAX_DIAS_VIAGEM) {
      return res.status(400).json({ 
        error: `Duração máxima permitida: ${CONFIG_OTIMIZADA.MAX_DIAS_VIAGEM} dias. Solicitado: ${diasViagem} dias.` 
      });
    }
    
    if (diasViagem < CONFIG_OTIMIZADA.MIN_DIAS_VIAGEM) {
      return res.status(400).json({ 
        error: `Duração mínima permitida: ${CONFIG_OTIMIZADA.MIN_DIAS_VIAGEM} dia.` 
      });
    }
    
    // Log dos parâmetros recebidos
    logEvent('info', 'Gerando roteiro personalizado', {
      destino,
      pais,
      diasViagem,
      tipoViagem,
      tipoCompanhia,
      configuracao: 'otimizada_para_roteiros_maiores'
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
    
    // ✅ GERAÇÃO COM RETRY AUTOMÁTICO PARA ROTEIROS MAIORES
    let roteiro;
    let tentativa = 1;
    
    while (tentativa <= CONFIG_OTIMIZADA.MAX_RETRIES) {
      try {
        logEvent('info', `Tentativa ${tentativa} de geração de roteiro`, {
          modelo,
          diasViagem,
          maxTokens: modelo === 'claude' ? CONFIG_OTIMIZADA.MAX_TOKENS_CLAUDE : CONFIG_OTIMIZADA.MAX_TOKENS_DEEPSEEK
        });
        
        if (modelo === 'claude') {
          roteiro = await gerarRoteiroComClaude(prompt, diasViagem);
        } else {
          roteiro = await gerarRoteiroComDeepseek(prompt, diasViagem);
        }
        
        // ✅ VALIDAÇÃO RIGOROSA DO ROTEIRO GERADO
        if (roteiro && validarRoteiroCompleto(roteiro, diasViagem)) {
          logEvent('success', 'Roteiro gerado com sucesso', {
            tentativa,
            diasGerados: roteiro.dias?.length || 0,
            diasEsperados: diasViagem
          });
          break;
        } else {
          throw new Error(`Roteiro incompleto: ${roteiro?.dias?.length || 0} dias gerados de ${diasViagem} esperados`);
        }
        
      } catch (erro) {
        logEvent('warning', `Tentativa ${tentativa} falhou`, {
          erro: erro.message,
          modelo,
          diasViagem
        });
        
        if (tentativa === CONFIG_OTIMIZADA.MAX_RETRIES) {
          throw erro;
        }
        
        tentativa++;
        await delay(CONFIG_OTIMIZADA.RETRY_DELAY_MS * tentativa);
      }
    }
    
    // Verificar se o roteiro foi gerado com sucesso
    if (!roteiro) {
      throw new Error('Falha ao gerar roteiro após todas as tentativas');
    }
    
    // ✅ LOG FINAL COM MÉTRICAS
    logEvent('success', 'Roteiro finalizado', {
      diasGerados: roteiro.dias?.length || 0,
      diasSolicitados: diasViagem,
      tentativasUtilizadas: tentativa,
      modelo,
      tempoTotal: Date.now()
    });
    
    // Retornar o roteiro gerado
    return res.status(200).json(roteiro);
    
  } catch (erro) {
    // Log do erro
    logEvent('error', 'Erro ao gerar roteiro', {
      message: erro.message,
      stack: erro.stack,
      configuracao: 'otimizada'
    });
    
    // Retornar erro
    return res.status(500).json({
      error: 'Erro ao gerar roteiro personalizado',
      details: erro.message
    });
  }
};

/**
 * ✅ VALIDAÇÃO COMPLETA DO ROTEIRO GERADO
 */
function validarRoteiroCompleto(roteiro, diasEsperados) {
  if (!roteiro || typeof roteiro !== 'object') {
    return false;
  }
  
  if (!roteiro.dias || !Array.isArray(roteiro.dias)) {
    return false;
  }
  
  // ✅ VALIDAÇÃO RIGOROSA: deve ter EXATAMENTE o número de dias solicitados
  if (roteiro.dias.length !== diasEsperados) {
    logEvent('warning', 'Roteiro incompleto detectado', {
      diasGerados: roteiro.dias.length,
      diasEsperados: diasEsperados,
      diferenca: diasEsperados - roteiro.dias.length
    });
    return false;
  }
  
  // Validar cada dia
  for (let i = 0; i < roteiro.dias.length; i++) {
    const dia = roteiro.dias[i];
    
    if (!dia || typeof dia !== 'object') {
      return false;
    }
    
    if (!dia.data) {
      return false;
    }
    
    // Verificar se tem pelo menos uma estrutura de período ou atividades
    const temAtividades = (dia.atividades && dia.atividades.length > 0) ||
                         (dia.manha && dia.manha.atividades && dia.manha.atividades.length > 0) ||
                         (dia.tarde && dia.tarde.atividades && dia.tarde.atividades.length > 0) ||
                         (dia.noite && dia.noite.atividades && dia.noite.atividades.length > 0);
    
    if (!temAtividades) {
      logEvent('warning', `Dia ${i + 1} sem atividades válidas`);
      return false;
    }
  }
  
  return true;
}

/**
 * Calcula o número de dias entre duas datas
 * ✅ OTIMIZADO PARA ROTEIROS MAIORES
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
  
  // ✅ LIMITES EXPANDIDOS
  if (diffDias < CONFIG_OTIMIZADA.MIN_DIAS_VIAGEM) return CONFIG_OTIMIZADA.MIN_DIAS_VIAGEM;
  if (diffDias > CONFIG_OTIMIZADA.MAX_DIAS_VIAGEM) {
    logEvent('warning', 'Viagem muito longa, limitando', {
      diasCalculados: diffDias,
      limite: CONFIG_OTIMIZADA.MAX_DIAS_VIAGEM
    });
    return CONFIG_OTIMIZADA.MAX_DIAS_VIAGEM;
  }
  
  return diffDias;
}

/**
 * Gera o prompt para a IA baseado nos parâmetros
 * ✅ PROMPT MANTIDO INTACTO CONFORME SOLICITADO
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
  
  // Montar o prompt
  return `
Você é a Tripinha, uma vira-lata caramelo magra, esperta, despojada e especialista em viagens na Benetrip. Sua missão é transformar as respostas do usuário em um roteiro de viagem completo, personalizado e incrível. Fale como se fosse uma amiga: com leveza, simpatia, bom humor e dicas práticas, sem enrolação.. 
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

INSTRUÇÕES:
1. CRIE EXATAMENTE ${diasViagem} DIAS DE ROTEIRO - NÃO OMITA NENHUM DIA
2. RESPEITE A INTENSIDADE escolhida: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
3. CONSIDERE O ORÇAMENTO: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}
4. ADAPTE AS ATIVIDADES para ${infoViajantes}
5. Organize o roteiro por dias, considerando o dia da semana real e se é fim de semana ou dia útil.
6. Para cada dia, divida o roteiro em períodos: manhã, tarde e noite.
7. Cada período deve ter atividades relevantes conforme a intensidade escolhida, com locais reais (pontos turísticos, restaurantes, etc).
8. Para cada atividade, inclua:
   - Horário sugerido
   - Nome do local
   - 1-2 tags relevantes (ex: Imperdível, Cultural, Família)
   - Uma dica personalizada da Tripinha (mascote da Benetrip)
9. No primeiro dia, considere o horário de chegada (${horaChegada || 'não informado'}).
10. No último dia, considere o horário de partida (${horaSaida || 'não informado'}).
11. Inclua uma breve descrição para cada dia.
12. FAÇA O MÁXIMO PARA QUE TODOS OS ${diasViagem} DIAS TENHAM ATIVIDADES DIFERENTES, CASO CONTRARIO, REPITA OS PASSEIOS MAIS CONHECIDOS.
13. CRITICAL: Você DEVE criar atividades para TODOS os ${diasViagem} dias sem exceções. Se ${diasViagem} é 29, você DEVE criar 29 dias de roteiro completo.

Retorne o roteiro em formato JSON com a seguinte estrutura:
{
  "destino": "Nome do destino",
  "dias": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "Breve descrição sobre o dia",
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
    }
  ]
}

Observações importantes:
- Para ${infoViajantes}, dê prioridade a atividades compatíveis.
- Como o foco é ${descricaoTipoViagem}, sugira mais atividades relacionadas a esse tema.
- Respeite rigorosamente a intensidade de ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}.
- Ajuste as sugestões ao orçamento ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}.
- Considere atividades para dias úteis e atividades específicas para fins de semana.
- Inclua uma mistura de atrações turísticas populares e experiências locais.
- Garanta que destinos mais conhecidos estejam no roteiro da viagem.
`;
}

/**
 * ✅ DEEPSEEK COM CONFIGURAÇÕES OTIMIZADAS
 */
async function gerarRoteiroComDeepseek(prompt, diasViagem) {
  try {
    // Verificar se a chave da API está configurada
    if (!DEEPSEEK_API_KEY) {
      throw new Error('Chave da API DeepSeek não configurada');
    }
    
    // ✅ CONFIGURAÇÕES OTIMIZADAS PARA ROTEIROS MAIORES
    const requestConfig = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: CONFIG_OTIMIZADA.MAX_TOKENS_DEEPSEEK, // ✅ AUMENTADO
      response_format: { type: 'json_object' },
      // ✅ CONFIGURAÇÕES ADICIONAIS PARA ROTEIROS MAIORES
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1
    };
    
    logEvent('info', 'Chamando API DeepSeek', {
      maxTokens: requestConfig.max_tokens,
      diasViagem,
      timeoutSegundos: CONFIG_OTIMIZADA.TIMEOUT_API_SECONDS
    });
    
    // ✅ TIMEOUT CONFIGURÁVEL
    const axiosConfig = {
      timeout: CONFIG_OTIMIZADA.TIMEOUT_API_SECONDS * 1000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      }
    };
    
    // Realizar chamada à API DeepSeek
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      requestConfig,
      axiosConfig
    );
    
    // Extrair resposta
    const respostaText = response.data.choices[0].message.content;
    
    // ✅ PROCESSAMENTO ROBUSTO DA RESPOSTA JSON
    try {
      // Limpar qualquer markdown ou texto antes/depois do JSON
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      
      // Parsear para objeto
      const roteiro = JSON.parse(jsonText);
      
      // ✅ VALIDAÇÃO ADICIONAL
      if (!roteiro.dias || !Array.isArray(roteiro.dias)) {
        throw new Error('Estrutura de resposta inválida: propriedade "dias" não encontrada ou não é array');
      }
      
      if (roteiro.dias.length !== diasViagem) {
        logEvent('warning', 'DeepSeek retornou número incorreto de dias', {
          esperado: diasViagem,
          recebido: roteiro.dias.length,
          diferenca: diasViagem - roteiro.dias.length
        });
      }
      
      return roteiro;
    } catch (parseError) {
      logEvent('error', 'Erro ao processar resposta JSON da DeepSeek', {
        error: parseError.message,
        response: respostaText.substring(0, 500) + '...',
        diasViagem
      });
      
      throw new Error('Resposta da DeepSeek não é um JSON válido');
    }
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada à API DeepSeek', {
      error: erro.message,
      response: erro.response?.data,
      diasViagem,
      timeout: CONFIG_OTIMIZADA.TIMEOUT_API_SECONDS
    });
    
    throw erro;
  }
}

/**
 * ✅ CLAUDE COM CONFIGURAÇÕES OTIMIZADAS
 */
async function gerarRoteiroComClaude(prompt, diasViagem) {
  try {
    // Verificar se a chave da API está configurada
    if (!CLAUDE_API_KEY) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    // ✅ CONFIGURAÇÕES OTIMIZADAS PARA ROTEIROS MAIORES
    const requestConfig = {
      model: 'claude-3-haiku-20240307',
      max_tokens: CONFIG_OTIMIZADA.MAX_TOKENS_CLAUDE, // ✅ DOBRADO DE 4000 PARA 8000
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
      // Nota: Claude não suporta response_format JSON nativo, processaremos manualmente
    };
    
    logEvent('info', 'Chamando API Claude', {
      maxTokens: requestConfig.max_tokens,
      diasViagem,
      timeoutSegundos: CONFIG_OTIMIZADA.TIMEOUT_API_SECONDS
    });
    
    // ✅ TIMEOUT CONFIGURÁVEL
    const axiosConfig = {
      timeout: CONFIG_OTIMIZADA.TIMEOUT_API_SECONDS * 1000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    };
    
    // Realizar chamada à API Claude (Anthropic)
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      requestConfig,
      axiosConfig
    );
    
    // Extrair resposta
    const respostaText = response.data.content[0].text;
    
    // ✅ PROCESSAMENTO ROBUSTO DA RESPOSTA JSON
    try {
      // Limpar qualquer markdown ou texto antes/depois do JSON
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      
      // Parsear para objeto
      const roteiro = JSON.parse(jsonText);
      
      // ✅ VALIDAÇÃO ADICIONAL
      if (!roteiro.dias || !Array.isArray(roteiro.dias)) {
        throw new Error('Estrutura de resposta inválida: propriedade "dias" não encontrada ou não é array');
      }
      
      if (roteiro.dias.length !== diasViagem) {
        logEvent('warning', 'Claude retornou número incorreto de dias', {
          esperado: diasViagem,
          recebido: roteiro.dias.length,
          diferenca: diasViagem - roteiro.dias.length
        });
      }
      
      return roteiro;
    } catch (parseError) {
      logEvent('error', 'Erro ao processar resposta JSON da Claude', {
        error: parseError.message,
        response: respostaText.substring(0, 500) + '...',
        diasViagem
      });
      
      throw new Error('Resposta da Claude não é um JSON válido');
    }
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada à API Claude', {
      error: erro.message,
      response: erro.response?.data,
      diasViagem,
      timeout: CONFIG_OTIMIZADA.TIMEOUT_API_SECONDS
    });
    
    throw erro;
  }
}

/**
 * ✅ FUNÇÃO DE DELAY AUXILIAR
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
