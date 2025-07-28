// api/itinerary-generator.js - Endpoint para geração de roteiro personalizado
const axios = require('axios');

// Chaves de API
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Modelo padrão a ser usado (DeepSeek Coder)
const DEFAULT_MODEL = 'deepseek-chat';

// ✅ CONFIGURAÇÃO ATUALIZADA: Limite de dias padronizado
const CONFIG_ROTEIRO = {
  LIMITE_DIAS_MINIMO: 1,
  LIMITE_DIAS_MAXIMO: 30,
  LIMITE_TOKENS_RESPOSTA: 8192,
  TIMEOUT_API: 30000
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
    
    // ✅ NOVO: Calcular e validar número de dias
    const diasViagem = calcularDiasViagem(dataInicio, dataFim);
    
    // ✅ VALIDAÇÃO ATUALIZADA: Verificar limites
    if (diasViagem < CONFIG_ROTEIRO.LIMITE_DIAS_MINIMO) {
      return res.status(400).json({ 
        error: `Mínimo de ${CONFIG_ROTEIRO.LIMITE_DIAS_MINIMO} dia de viagem` 
      });
    }
    
    if (diasViagem > CONFIG_ROTEIRO.LIMITE_DIAS_MAXIMO) {
      return res.status(400).json({ 
        error: `Máximo de ${CONFIG_ROTEIRO.LIMITE_DIAS_MAXIMO} dias de viagem. Para viagens mais longas, crie múltiplos roteiros.` 
      });
    }
    
    // Log dos parâmetros recebidos
    logEvent('info', 'Gerando roteiro personalizado', {
      destino,
      pais,
      diasViagem,
      tipoViagem,
      tipoCompanhia,
      limites: CONFIG_ROTEIRO
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
      roteiro = await gerarRoteiroComClaude(prompt);
    } else {
      roteiro = await gerarRoteiroComDeepseek(prompt);
    }
    
    // Verificar se o roteiro foi gerado com sucesso
    if (!roteiro) {
      throw new Error('Falha ao gerar roteiro');
    }
    
    // ✅ NOVO: Validar estrutura do roteiro
    const roteiroValidado = validarEstruturalRoteiro(roteiro, diasViagem);
    
    // Retornar o roteiro gerado
    return res.status(200).json(roteiroValidado);
    
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
 * ✅ ATUALIZADO: Calcula o número de dias entre duas datas
 * @param {string} dataInicio - Data de início no formato YYYY-MM-DD
 * @param {string} dataFim - Data de fim no formato YYYY-MM-DD
 * @returns {number} Número de dias
 */
function calcularDiasViagem(dataInicio, dataFim) {
  if (!dataInicio) return CONFIG_ROTEIRO.LIMITE_DIAS_MINIMO;
  
  const inicio = new Date(dataInicio + 'T12:00:00');
  
  // ✅ CORREÇÃO: Se não tiver data fim ou for igual à data início, é 1 dia
  if (!dataFim || dataFim === dataInicio) {
    console.log('✅ Viagem de 1 dia detectada');
    return 1;
  }
  
  const fim = new Date(dataFim + 'T12:00:00');
  
  // Verificar se as datas são válidas
  if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
    console.warn('⚠️ Datas inválidas fornecidas, usando 1 dia');
    return 1;
  }
  
  // Calcular diferença em dias
  const diffTempo = Math.abs(fim - inicio);
  const diffDias = Math.floor(diffTempo / (1000 * 60 * 60 * 24));
  
  // ✅ CORREÇÃO: Se diferença é 0, é viagem de 1 dia
  if (diffDias === 0) return 1;
  
  // ✅ NOVO: Aplicar limites configurados
  if (diffDias > CONFIG_ROTEIRO.LIMITE_DIAS_MAXIMO) {
    console.warn(`⚠️ Viagem muito longa (${diffDias} dias), limitando a ${CONFIG_ROTEIRO.LIMITE_DIAS_MAXIMO} dias`);
    return CONFIG_ROTEIRO.LIMITE_DIAS_MAXIMO;
  }
  
  console.log(`✅ Calculados ${diffDias} dias de viagem`);
  return diffDias;
}

/**
 * ✅ ATUALIZADO: Gera o prompt para a IA baseado nos parâmetros
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
  
  // ✅ NOVO: Informações específicas para viagens de 1 dia
  const infoEspecialDias = diasViagem === 1 ? 
    'Esta é uma VIAGEM DE 1 DIA (bate e volta). Foque nas atrações PRINCIPAIS e IMPERDÍVEIS. Organize as atividades de forma EFICIENTE considerando deslocamentos.' :
    `Esta é uma viagem de ${diasViagem} dias. Distribua as atividades de forma equilibrada ao longo dos dias.`;
  
  // Montar o prompt
  return `
Você é a Tripinha, uma vira-lata caramelo magra, esperta, despojada e especialista em viagens na Benetrip. Sua missão é transformar as respostas do usuário em um roteiro de viagem completo, personalizado e incrível. Fale como se fosse uma amiga: com leveza, simpatia, bom humor e dicas práticas, sem enrolação.

${infoEspecialDias}

Crie um roteiro detalhado para uma viagem com as seguintes características:

- Destino: ${destino}, ${pais}
- Data de início: ${dataInicio}${dataFim ? `\n- Data de término: ${dataFim}` : '\n- Viagem de 1 dia (bate e volta)'}
- Duração: ${diasViagem} ${diasViagem === 1 ? 'dia' : 'dias'}
- Horário de chegada no primeiro dia: ${horaChegada || 'Não informado'}
- Horário de partida no último dia: ${horaSaida || 'Não informado'}
- Tipo de viagem: Foco em ${descricaoTipoViagem}
- Viajantes: ${infoViajantes}
- Intensidade do roteiro: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
- Orçamento: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}

INSTRUÇÕES ESSENCIAIS:
1. ✅ OBRIGATÓRIO: CRIE UM ROTEIRO COMPLETO PARA EXATAMENTE ${diasViagem} ${diasViagem === 1 ? 'DIA' : 'DIAS'} DE VIAGEM.
2. ✅ CADA UM DOS ${diasViagem} ${diasViagem === 1 ? 'DIA' : 'DIAS'} DEVE CONTER ATIVIDADES RELEVANTES.
3. ✅ RESPEITE A INTENSIDADE: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
4. ✅ CONSIDERE O ORÇAMENTO: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}
5. ✅ ADAPTE AS ATIVIDADES para ${infoViajantes}

INSTRUÇÕES ESPECÍFICAS PARA ${diasViagem} ${diasViagem === 1 ? 'DIA' : 'DIAS'}:
${diasViagem === 1 ? `
- Foque nos PRINCIPAIS pontos turísticos e experiências IMPERDÍVEIS
- Organize por proximidade geográfica para otimizar tempo
- Considere horários de funcionamento e deslocamentos
- Priorize 1-2 atrações principais + experiências gastronômicas locais
` : `
- Organize o roteiro por dias, considerando o dia da semana real
- Distribua as atrações principais ao longo dos ${diasViagem} dias
- Inclua tempo para descanso e experiências locais
- Varie entre atividades culturais, gastronômicas e de lazer
`}

6. Para cada dia, divida o roteiro em períodos: manhã, tarde e noite.
7. Cada período deve ter atividades relevantes conforme a intensidade escolhida, com locais reais.
8. Para cada atividade, inclua:
   - Horário sugerido
   - Nome do local (use nomes reais e específicos)
   - 1-2 tags relevantes (ex: Imperdível, Cultural, Família)
   - Uma dica personalizada da Tripinha
9. No primeiro dia, considere o horário de chegada (${horaChegada || 'Não informado'}).
${diasViagem > 1 ? `10. No último dia, considere o horário de partida (${horaSaida || 'Não informado'}).` : ''}
11. Inclua uma breve descrição para cada dia.
12. ✅ CRÍTICO: O array "dias" no JSON FINAL DEVE CONTER EXATAMENTE ${diasViagem} OBJETO${diasViagem === 1 ? '' : 'S'} DE DIA${diasViagem === 1 ? '' : 'S'}, SEM EXCEÇÕES.

Retorne o roteiro em formato JSON com a seguinte estrutura:
{
  "destino": "${destino}, ${pais}",
  "totalDias": ${diasViagem},
  "dias": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "Breve descrição sobre o dia",
      "manha": {
        "horarioEspecial": "Chegada às XX:XX" (opcional, apenas se for chegada/partida),
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome específico do local",
            "tags": ["tag1", "tag2"],
            "dica": "Dica prática da Tripinha sobre o local"
          }
        ]
      },
      "tarde": { ... mesmo formato da manhã ... },
      "noite": { ... mesmo formato da manhã ... }
    }
  ]
}

VALIDAÇÕES FINAIS:
- ✅ Confirme que existem EXATAMENTE ${diasViagem} objetos no array "dias"
- ✅ Cada dia deve ter pelo menos 2-3 atividades (conforme intensidade)
- ✅ Use nomes reais de locais, restaurantes e atrações em ${destino}
- ✅ Horários devem ser realistas e considerando deslocamentos
- ✅ Para viagem de 1 dia: foque no essencial e imperdível
${diasViagem > 1 ? '- ✅ Para viagens múltiplas: distribua atrações principais entre os dias' : ''}

Observações importantes:
- Para ${infoViajantes}, priorize atividades compatíveis.
- Como o foco é ${descricaoTipoViagem}, sugira mais atividades relacionadas.
- Considere atividades para dias úteis vs fins de semana.
- Inclua mistura de atrações populares e experiências locais autênticas.
- ✅ GARANTA que destinos famosos de ${destino} estejam incluídos.
`;
}

/**
 * ✅ NOVO: Validar estrutura do roteiro gerado
 * @param {Object} roteiro - Roteiro gerado pela IA
 * @param {number} diasEsperados - Número de dias esperado
 * @returns {Object} Roteiro validado e corrigido se necessário
 */
function validarEstruturalRoteiro(roteiro, diasEsperados) {
  try {
    // Verificar estrutura básica
    if (!roteiro || typeof roteiro !== 'object') {
      throw new Error('Roteiro deve ser um objeto válido');
    }
    
    if (!roteiro.dias || !Array.isArray(roteiro.dias)) {
      throw new Error('Roteiro deve conter array "dias"');
    }
    
    // ✅ VALIDAÇÃO CRÍTICA: Verificar número de dias
    if (roteiro.dias.length !== diasEsperados) {
      console.warn(`⚠️ Roteiro tem ${roteiro.dias.length} dias, esperado ${diasEsperados}. Ajustando...`);
      
      // Ajustar número de dias
      if (roteiro.dias.length < diasEsperados) {
        // Adicionar dias faltantes
        const diasFaltantes = diasEsperados - roteiro.dias.length;
        for (let i = 0; i < diasFaltantes; i++) {
          const diaExtra = criarDiaFallback(roteiro.dias.length + i + 1, roteiro.destino);
          roteiro.dias.push(diaExtra);
        }
      } else {
        // Remover dias excedentes
        roteiro.dias = roteiro.dias.slice(0, diasEsperados);
      }
    }
    
    // Validar cada dia
    roteiro.dias.forEach((dia, index) => {
      if (!dia.data) {
        dia.data = calcularDataDoDia(index);
      }
      
      if (!dia.descricao) {
        dia.descricao = `Dia ${index + 1} de exploração e descobertas.`;
      }
      
      // Garantir estrutura de períodos
      ['manha', 'tarde', 'noite'].forEach(periodo => {
        if (!dia[periodo]) {
          dia[periodo] = { atividades: [] };
        }
        if (!dia[periodo].atividades) {
          dia[periodo].atividades = [];
        }
      });
    });
    
    // Adicionar metadados
    roteiro.totalDias = diasEsperados;
    roteiro.validado = true;
    roteiro.geradoEm = new Date().toISOString();
    
    console.log(`✅ Roteiro validado: ${roteiro.dias.length} dias para ${roteiro.destino}`);
    return roteiro;
    
  } catch (erro) {
    console.error('❌ Erro na validação do roteiro:', erro);
    throw new Error(`Falha na validação: ${erro.message}`);
  }
}

/**
 * ✅ NOVO: Criar dia fallback caso necessário
 */
function criarDiaFallback(numeroDia, destino) {
  const dataBase = new Date();
  dataBase.setDate(dataBase.getDate() + numeroDia - 1);
  
  return {
    data: dataBase.toISOString().split('T')[0],
    descricao: `Dia ${numeroDia} para explorar ${destino || 'a região'} com mais calma.`,
    manha: {
      atividades: [
        {
          horario: '09:00',
          local: 'Exploração livre da cidade',
          tags: ['Flexível', 'Local'],
          dica: 'Aproveite para descobrir lugares que chamaram sua atenção!'
        }
      ]
    },
    tarde: {
      atividades: [
        {
          horario: '14:00',
          local: 'Atividades opcionais',
          tags: ['Livre', 'Descanso'],
          dica: 'Tempo para relaxar ou revisitar seus lugares favoritos!'
        }
      ]
    },
    noite: {
      atividades: [
        {
          horario: '19:00',
          local: 'Jantar e experiência gastronômica local',
          tags: ['Gastronomia', 'Cultural'],
          dica: 'Experimente especialidades que ainda não provou!'
        }
      ]
    }
  };
}

/**
 * ✅ NOVO: Calcular data do dia baseado no índice
 */
function calcularDataDoDia(indiceDia) {
  const hoje = new Date();
  hoje.setDate(hoje.getDate() + indiceDia);
  return hoje.toISOString().split('T')[0];
}

/**
 * ✅ ATUALIZADO: Gera roteiro utilizando a API DeepSeek
 * @param {string} prompt - Prompt para a IA
 * @returns {Object} Roteiro gerado
 */
async function gerarRoteiroComDeepseek(prompt) {
  try {
    // Verificar se a chave da API está configurada
    if (!DEEPSEEK_API_KEY) {
      throw new Error('Chave da API DeepSeek não configurada');
    }
    
    console.log('🤖 Chamando API DeepSeek...');
    
    // Realizar chamada à API DeepSeek
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        max_tokens: CONFIG_ROTEIRO.LIMITE_TOKENS_RESPOSTA,
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
        timeout: CONFIG_ROTEIRO.TIMEOUT_API
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
      
      console.log('✅ Roteiro gerado pela DeepSeek com sucesso');
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
 * ✅ ATUALIZADO: Gera roteiro utilizando a API Claude (Anthropic)
 * @param {string} prompt - Prompt para a IA
 * @returns {Object} Roteiro gerado
 */
async function gerarRoteiroComClaude(prompt) {
  try {
    // Verificar se a chave da API está configurada
    if (!CLAUDE_API_KEY) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    console.log('🤖 Chamando API Claude...');
    
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
        timeout: CONFIG_ROTEIRO.TIMEOUT_API
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
      
      console.log('✅ Roteiro gerado pela Claude com sucesso');
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
