// api/itinerary-generator.js - Endpoint para geração de roteiro personalizado - VERSÃO MELHORADA
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
      roteiro = await gerarRoteiroComClaude(prompt, diasViagem);
    } else {
      roteiro = await gerarRoteiroComDeepseek(prompt, diasViagem);
    }
    
    // Verificar se o roteiro foi gerado com sucesso
    if (!roteiro) {
      throw new Error('Falha ao gerar roteiro');
    }
    
    // ✅ VALIDAÇÃO FINAL DO ROTEIRO
    const validacao = validarRoteiroCompleto(roteiro, diasViagem);
    if (!validacao.valido) {
      logEvent('warning', 'Roteiro incompleto detectado', validacao);
      // Retornar mesmo assim, mas com aviso
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
 * ✅ NOVO: Validação completa do roteiro gerado
 */
function validarRoteiroCompleto(roteiro, diasEsperados) {
  const validacao = {
    valido: true,
    problemas: [],
    diasEncontrados: 0,
    diasEsperados
  };
  
  // Verificar estrutura básica
  if (!roteiro || typeof roteiro !== 'object') {
    validacao.valido = false;
    validacao.problemas.push('Roteiro não é um objeto válido');
    return validacao;
  }
  
  if (!roteiro.dias || !Array.isArray(roteiro.dias)) {
    validacao.valido = false;
    validacao.problemas.push('Array de dias não encontrado');
    return validacao;
  }
  
  validacao.diasEncontrados = roteiro.dias.length;
  
  // Verificar número de dias
  if (roteiro.dias.length < diasEsperados) {
    validacao.valido = false;
    validacao.problemas.push(`Apenas ${roteiro.dias.length} dias de ${diasEsperados} esperados`);
  }
  
  // Verificar estrutura de cada dia
  roteiro.dias.forEach((dia, index) => {
    if (!dia.data) {
      validacao.problemas.push(`Dia ${index + 1}: sem data`);
    }
    
    if (!dia.manha && !dia.tarde && !dia.noite && !dia.atividades) {
      validacao.problemas.push(`Dia ${index + 1}: sem atividades`);
    }
  });
  
  return validacao;
}

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
  
  // ✅ PROMPT MELHORADO COM VALIDAÇÃO RIGOROSA
  return `
Você é a Tripinha, uma vira-lata caramelo magra, esperta, despojada e especialista em viagens na Benetrip. Sua missão é transformar as respostas do usuário em um roteiro de viagem completo, personalizado e incrível. Fale como se fosse uma amiga: com leveza, simpatia, bom humor e dicas práticas, sem enrolação.. 

PARÂMETROS DA VIAGEM:
- Destino: ${destino}, ${pais}
- Data de início: ${dataInicio}${dataFim ? `\n- Data de término: ${dataFim}` : ''}
- Duração: ${diasViagem} dias
- Horário de chegada no primeiro dia: ${horaChegada || 'Não informado'}
- Horário de partida no último dia: ${horaSaida || 'Não informado'}
- Tipo de viagem: Foco em ${descricaoTipoViagem}
- Viajantes: ${infoViajantes}
- Intensidade do roteiro: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
- Orçamento: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}

⚠️ INSTRUÇÕES CRÍTICAS - LEIA COM ATENÇÃO:

1. 🚨 OBRIGATÓRIO: CRIE EXATAMENTE ${diasViagem} DIAS DE ROTEIRO
   - Se a duração é ${diasViagem} dias, você DEVE retornar ${diasViagem} objetos no array "dias"
   - JAMAIS retorne menos que ${diasViagem} dias
   - CONFIRME: Você irá gerar ${diasViagem} dias? SIM ou NÃO?

2. 📅 DATAS SEQUENCIAIS:
   - Comece em ${dataInicio}
   - Gere dias consecutivos até completar ${diasViagem} dias
   - Format: YYYY-MM-DD

3. 🎯 QUALIDADE POR DIA:
   - Respeite a intensidade: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
   - Considere o orçamento: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}
   - Adapte para ${infoViajantes}

4. 📝 ESTRUTURA OBRIGATÓRIA:
   - Organize por dias → períodos (manhã, tarde, noite)
   - Cada atividade deve ter: horário, local, dica da Tripinha, tags
   - Primeiro dia: considere chegada às ${horaChegada || 'não informado'}
   - Último dia: considere partida às ${horaSaida || 'não informado'}

5. 🔄 SE DESTINO PEQUENO:
   - Repita locais em horários diferentes
   - Varie perspectivas (manhã vs tarde)
   - Inclua atividades próximas
   - NUNCA reduza o número de dias

FORMATO JSON OBRIGATÓRIO:
{
  "destino": "Nome do destino",
  "dias": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "Breve descrição sobre o dia",
      "manha": {
        "horarioEspecial": "Chegada às XX:XX" (opcional),
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome do local",
            "tags": ["tag1", "tag2"],
            "dica": "Dica da Tripinha sobre o local"
          }
        ]
      },
      "tarde": { ...mesmo formato... },
      "noite": { ...mesmo formato... }
    }
  ]
}

VALIDAÇÃO ANTES DE RESPONDER:
✅ Tenho ${diasViagem} objetos no array "dias"?
✅ Cada dia tem data no formato YYYY-MM-DD?
✅ As datas são sequenciais começando em ${dataInicio}?
✅ Cada período tem atividades relevantes?
✅ Respeitei a intensidade ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}?

RETORNE APENAS O JSON - SEM TEXTO ADICIONAL ANTES OU DEPOIS.
`;
}

/**
 * ✅ GERA ROTEIRO COM DEEPSEEK - PARSING MELHORADO
 */
async function gerarRoteiroComDeepseek(prompt, diasEsperados) {
  try {
    // Verificar se a chave da API está configurada
    if (!DEEPSEEK_API_KEY) {
      throw new Error('Chave da API DeepSeek não configurada');
    }
    
    logEvent('info', 'Chamando API DeepSeek', { diasEsperados });
    
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
        max_tokens: 8000, // ✅ Aumentado para roteiros longos
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        timeout: 45000 // ✅ 45 segundos para roteiros longos
      }
    );
    
    // Extrair resposta
    const respostaText = response.data.choices[0].message.content;
    
    logEvent('info', 'Resposta recebida da DeepSeek', { 
      tamanho: respostaText.length,
      primeiros100: respostaText.substring(0, 100)
    });
    
    // ✅ PARSING ROBUSTO MELHORADO
    return processarRespostaJSON(respostaText, diasEsperados, 'DeepSeek');
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada à API DeepSeek', {
      error: erro.message,
      response: erro.response?.data
    });
    
    throw erro;
  }
}

/**
 * ✅ GERA ROTEIRO COM CLAUDE - PARSING MELHORADO
 */
async function gerarRoteiroComClaude(prompt, diasEsperados) {
  try {
    // Verificar se a chave da API está configurada
    if (!CLAUDE_API_KEY) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    logEvent('info', 'Chamando API Claude', { diasEsperados });
    
    // Realizar chamada à API Claude (Anthropic)
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 8000, // ✅ Aumentado para roteiros longos
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
        timeout: 45000 // ✅ 45 segundos para roteiros longos
      }
    );
    
    // Extrair resposta
    const respostaText = response.data.content[0].text;
    
    logEvent('info', 'Resposta recebida da Claude', { 
      tamanho: respostaText.length,
      primeiros100: respostaText.substring(0, 100)
    });
    
    // ✅ PARSING ROBUSTO MELHORADO
    return processarRespostaJSON(respostaText, diasEsperados, 'Claude');
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada à API Claude', {
      error: erro.message,
      response: erro.response?.data
    });
    
    throw erro;
  }
}

/**
 * ✅ PARSING ROBUSTO E INTELIGENTE DA RESPOSTA JSON
 */
function processarRespostaJSON(respostaText, diasEsperados, fonte) {
  try {
    logEvent('info', `Processando resposta do ${fonte}`, {
      tamanhoOriginal: respostaText.length,
      diasEsperados
    });
    
    // 1️⃣ LIMPEZA INICIAL
    let textoLimpo = respostaText.trim();
    
    // Remover markdown se houver
    if (textoLimpo.includes('```')) {
      textoLimpo = textoLimpo.replace(/```json\n?/g, '').replace(/\n?```/g, '');
    }
    
    // Remover texto antes/depois do JSON
    textoLimpo = textoLimpo.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
    
    // 2️⃣ ENCONTRAR INÍCIO E FIM DO JSON PRINCIPAL
    const primeiraChave = textoLimpo.indexOf('{');
    if (primeiraChave === -1) {
      throw new Error('Nenhuma estrutura JSON encontrada na resposta');
    }
    
    // 3️⃣ PARSING INTELIGENTE COM CONTAGEM DE CHAVES
    let jsonCompleto = '';
    let contadorChaves = 0;
    let dentroString = false;
    let escapado = false;
    
    for (let i = primeiraChave; i < textoLimpo.length; i++) {
      const char = textoLimpo[i];
      const charAnterior = i > 0 ? textoLimpo[i - 1] : '';
      
      jsonCompleto += char;
      
      // Verificar se estamos dentro de uma string
      if (char === '"' && charAnterior !== '\\' && !escapado) {
        dentroString = !dentroString;
      }
      
      // Verificar escape
      escapado = char === '\\' && !escapado;
      
      // Contar chaves apenas fora de strings
      if (!dentroString) {
        if (char === '{') {
          contadorChaves++;
        } else if (char === '}') {
          contadorChaves--;
          
          // Se fechamos todas as chaves, encontramos o fim do JSON
          if (contadorChaves === 0) {
            break;
          }
        }
      }
    }
    
    logEvent('info', 'JSON extraído com sucesso', {
      tamanhoExtraido: jsonCompleto.length,
      inicioCom: jsonCompleto.substring(0, 50),
      terminaCom: jsonCompleto.substring(jsonCompleto.length - 50)
    });
    
    // 4️⃣ PARSE E VALIDAÇÃO
    let roteiro;
    try {
      roteiro = JSON.parse(jsonCompleto);
    } catch (parseError) {
      logEvent('error', 'Erro no JSON.parse', {
        erro: parseError.message,
        jsonTruncado: jsonCompleto.substring(0, 500)
      });
      
      // 5️⃣ TENTATIVA DE RECUPERAÇÃO
      roteiro = tentarRecuperarJSON(jsonCompleto);
    }
    
    // 6️⃣ VALIDAÇÃO ESPECÍFICA DA ESTRUTURA
    if (!roteiro || typeof roteiro !== 'object') {
      throw new Error('Resposta não é um objeto JSON válido');
    }
    
    if (!roteiro.dias || !Array.isArray(roteiro.dias)) {
      throw new Error('Array "dias" não encontrado na resposta');
    }
    
    // 7️⃣ VALIDAÇÃO DO NÚMERO DE DIAS
    const diasEncontrados = roteiro.dias.length;
    logEvent('info', 'Validação de dias', {
      diasEsperados,
      diasEncontrados,
      diferenca: diasEsperados - diasEncontrados
    });
    
    if (diasEncontrados < diasEsperados) {
      logEvent('warning', 'Número de dias insuficiente', {
        esperados: diasEsperados,
        encontrados: diasEncontrados,
        fonte
      });
      
      // ⚠️ NÃO FALHAR, mas registrar o problema
      // O sistema frontend pode lidar com isso
    }
    
    // 8️⃣ VALIDAÇÃO DE ESTRUTURA DE CADA DIA
    roteiro.dias.forEach((dia, index) => {
      if (!dia.data) {
        logEvent('warning', `Dia ${index + 1} sem data`, { dia });
      }
      
      // Garantir que há pelo menos uma estrutura de atividades
      if (!dia.manha && !dia.tarde && !dia.noite && !dia.atividades) {
        logEvent('warning', `Dia ${index + 1} sem atividades`, { dia });
      }
    });
    
    logEvent('info', 'Roteiro processado com sucesso', {
      destino: roteiro.destino,
      diasGerados: roteiro.dias.length,
      fonte
    });
    
    return roteiro;
    
  } catch (erro) {
    logEvent('error', `Erro ao processar resposta JSON do ${fonte}`, {
      error: erro.message,
      respostaTruncada: respostaText.substring(0, 1000)
    });
    
    throw new Error(`Resposta do ${fonte} não é um JSON válido: ${erro.message}`);
  }
}

/**
 * ✅ TENTATIVA DE RECUPERAÇÃO DE JSON CORROMPIDO
 */
function tentarRecuperarJSON(jsonString) {
  try {
    // Tentar corrigir problemas comuns
    let jsonCorrigido = jsonString;
    
    // Corrigir vírgulas extras
    jsonCorrigido = jsonCorrigido.replace(/,(\s*[}\]])/g, '$1');
    
    // Corrigir aspas simples
    jsonCorrigido = jsonCorrigido.replace(/'/g, '"');
    
    // Tentar parsear novamente
    return JSON.parse(jsonCorrigido);
    
  } catch (e) {
    // Se ainda não funcionar, tentar extrair apenas a parte dos dias
    const diasMatch = jsonString.match(/"dias"\s*:\s*\[[\s\S]*\]/);
    if (diasMatch) {
      try {
        const diasArray = JSON.parse(`{${diasMatch[0]}}`);
        return {
          destino: "Destino não identificado",
          dias: diasArray.dias
        };
      } catch (e2) {
        // Se nada funcionar, falhar
        throw new Error('Impossível recuperar JSON corrompido');
      }
    }
    
    throw e;
  }
}
