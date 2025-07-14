// api/itinerary-generator.js - Endpoint para geração de roteiro personalizado
// ✅ VERSÃO ATUALIZADA - Inclui todos os parâmetros do formulário
const axios = require('axios');

// Chaves de API
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Modelo padrão a ser usado (DeepSeek Coder)
const DEFAULT_MODEL = 'deepseek';

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
 * ✅ ENDPOINT PRINCIPAL - Gera um roteiro personalizado através da API Deepseek ou Claude
 * Parâmetros suportados:
 * - destino, pais, dataInicio, dataFim
 * - horaChegada, horaSaida
 * - tipoViagem, tipoCompanhia, quantidade
 * - intensidade, nivelOrcamento (NOVOS!)
 * - modeloIA
 */
module.exports = async (req, res) => {
  // ✅ CONFIGURAR CABEÇALHOS CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Responder a preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Método não permitido. Use POST.',
      allowedMethods: ['POST']
    });
  }
  
  try {
    // ✅ OBTER E VALIDAR PARÂMETROS
    const {
      destino,
      pais,
      dataInicio,
      dataFim,
      horaChegada,
      horaSaida,
      tipoViagem,
      tipoCompanhia,
      quantidade,
      intensidade,        // NOVO! (leve, moderado, intenso)
      nivelOrcamento,     // NOVO! (economico, medio, alto)
      preferencias,
      modeloIA
    } = req.body;
    
    // ✅ VALIDAR PARÂMETROS OBRIGATÓRIOS
    const errosValidacao = [];
    
    if (!destino?.trim()) {
      errosValidacao.push('destino é obrigatório');
    }
    
    if (!dataInicio) {
      errosValidacao.push('dataInicio é obrigatória');
    }
    
    if (!tipoViagem) {
      errosValidacao.push('tipoViagem é obrigatório');
    }
    
    if (!tipoCompanhia) {
      errosValidacao.push('tipoCompanhia é obrigatório');
    }
    
    if (errosValidacao.length > 0) {
      return res.status(400).json({ 
        error: 'Parâmetros obrigatórios faltando',
        details: errosValidacao
      });
    }
    
    // ✅ CALCULAR NÚMERO DE DIAS
    const diasViagem = calcularDiasViagem(dataInicio, dataFim);
    
    // ✅ VALIDAR LIMITE DE DIAS (máximo 30 dias)
    if (diasViagem > 30) {
      return res.status(400).json({
        error: 'Período muito longo. Máximo de 30 dias.',
        diasCalculados: diasViagem
      });
    }
    
    // ✅ LOG DOS PARÂMETROS RECEBIDOS
    logEvent('info', 'Gerando roteiro personalizado', {
      destino,
      pais,
      diasViagem,
      tipoViagem,
      tipoCompanhia,
      intensidade,        // Novo parâmetro incluído no log
      nivelOrcamento,     // Novo parâmetro incluído no log
      quantidade: quantidade || 1
    });
    
    // ✅ GERAR O PROMPT PARA A IA (ATUALIZADO!)
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
      quantidade,
      intensidade,        // NOVO!
      nivelOrcamento,     // NOVO!
      preferencias
    });
    
    // ✅ SELECIONAR O MODELO DE IA
    const modelo = modeloIA || DEFAULT_MODEL;
    logEvent('info', 'Usando modelo de IA', { modelo });
    
    // ✅ GERAR O ROTEIRO USANDO A API CORRESPONDENTE
    let roteiro;
    
    if (modelo === 'claude') {
      roteiro = await gerarRoteiroComClaude(prompt);
    } else {
      roteiro = await gerarRoteiroComDeepseek(prompt);
    }
    
    // ✅ VERIFICAR SE O ROTEIRO FOI GERADO COM SUCESSO
    if (!roteiro) {
      throw new Error('Falha ao gerar roteiro - resposta vazia da IA');
    }
    
    // ✅ VALIDAR ESTRUTURA DO ROTEIRO
    if (!roteiro.dias || !Array.isArray(roteiro.dias) || roteiro.dias.length === 0) {
      throw new Error('Estrutura de roteiro inválida - sem dias definidos');
    }
    
    // ✅ GARANTIR QUE TEMOS O NÚMERO CORRETO DE DIAS
    if (roteiro.dias.length !== diasViagem) {
      logEvent('warning', 'Número de dias incorreto no roteiro gerado', {
        esperado: diasViagem,
        recebido: roteiro.dias.length
      });
      
      // Ajustar automaticamente se necessário
      roteiro.dias = ajustarNumeroDias(roteiro.dias, diasViagem, destino);
    }
    
    // ✅ ENRIQUECER O ROTEIRO COM METADADOS
    const roteiroEnriquecido = {
      ...roteiro,
      metadata: {
        geradoEm: new Date().toISOString(),
        parametros: {
          destino,
          pais,
          diasViagem,
          tipoViagem,
          tipoCompanhia,
          intensidade,
          nivelOrcamento,
          quantidade: quantidade || 1
        },
        modelo: modelo,
        versaoAPI: '2.0'
      }
    };
    
    logEvent('success', 'Roteiro gerado com sucesso', {
      destino,
      diasGerados: roteiroEnriquecido.dias.length,
      modelo
    });
    
    // ✅ RETORNAR O ROTEIRO GERADO
    return res.status(200).json(roteiroEnriquecido);
    
  } catch (erro) {
    // ✅ LOG DO ERRO
    logEvent('error', 'Erro ao gerar roteiro', {
      message: erro.message,
      stack: erro.stack?.substring(0, 500) // Limitar stack trace
    });
    
    // ✅ RETORNAR ERRO DETALHADO
    return res.status(500).json({
      error: 'Erro ao gerar roteiro personalizado',
      details: erro.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * ✅ CALCULAR NÚMERO DE DIAS ENTRE DUAS DATAS
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
  
  return Math.max(1, diffDias); // Garantir pelo menos 1 dia
}

/**
 * ✅ GERAR PROMPT APRIMORADO PARA A IA (INCLUINDO NOVOS PARÂMETROS!)
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
    quantidade,
    intensidade,       // NOVO!
    nivelOrcamento,    // NOVO!
    preferencias
  } = params;
  
  // ✅ MAPEAR TIPO DE VIAGEM
  const descricaoTipoViagem = {
    'relaxar': 'relaxamento e descanso',
    'aventura': 'aventura e adrenalina',
    'cultura': 'cultura, história e gastronomia',
    'urbano': 'urbanismo, compras e vida noturna'
  }[tipoViagem] || 'cultura e experiências variadas';
  
  // ✅ MAPEAR TIPO DE COMPANHIA
  const descricaoTipoCompanhia = {
    'sozinho': 'uma pessoa viajando sozinha',
    'casal': 'um casal em viagem romântica',
    'familia': 'uma família com crianças',
    'amigos': 'um grupo de amigos'
  }[tipoCompanhia] || 'um viajante';
  
  // ✅ MAPEAR INTENSIDADE (NOVO!)
  const descricaoIntensidade = {
    'leve': 'com 2-3 atividades por dia, priorizando o descanso',
    'moderado': 'com 3-4 atividades balanceadas entre turismo e relaxamento',
    'intenso': 'com 4-5 atividades por dia, aproveitando ao máximo o tempo'
  }[intensidade] || 'com ritmo moderado';
  
  // ✅ MAPEAR NÍVEL DE ORÇAMENTO (NOVO!)
  const descricaoOrcamento = {
    'economico': 'opções econômicas como transporte público, restaurantes locais, atividades gratuitas/baratas',
    'medio': 'mix de opções econômicas e confortáveis, restaurantes de categoria média, atividades pagas moderadas',
    'alto': 'experiências premium, restaurantes refinados, atividades exclusivas, transporte privado quando necessário'
  }[nivelOrcamento] || 'opções variadas de orçamento';
  
  // ✅ MONTAR O PROMPT COMPLETO E DETALHADO
  return `
Você é a Tripinha, uma vira-lata caramelo magra, esperta, despojada e especialista em viagens na Benetrip. Sua missão é transformar as respostas do usuário em um roteiro de viagem completo, personalizado e incrível. Fale como se fosse uma amiga: com leveza, simpatia, bom humor e dicas práticas, sem enrolação.

Crie um roteiro detalhado para uma viagem com as seguintes características:

📍 **DESTINO E PERÍODO:**
- Destino: ${destino}, ${pais || 'Internacional'}
- Data de início: ${dataInicio}${dataFim ? `\n- Data de término: ${dataFim}` : ''}
- Duração: ${diasViagem} dias
- Horário de chegada no primeiro dia: ${horaChegada || 'Não informado'}
- Horário de partida no último dia: ${horaSaida || 'Não informado'}

👥 **PERFIL DOS VIAJANTES:**
- Viajantes: ${descricaoTipoCompanhia}${quantidade > 1 ? ` (total: ${quantidade} pessoas)` : ''}
- Estilo de viagem: Foco em ${descricaoTipoViagem}
- Intensidade: ${descricaoIntensidade}
- Orçamento: Priorizar ${descricaoOrcamento}

🎯 **INSTRUÇÕES CRÍTICAS:**
1. **CRIE EXATAMENTE ${diasViagem} DIAS DE ROTEIRO** - NÃO OMITA NENHUM DIA
2. **INTENSIDADE**: ${intensidade === 'leve' ? 'Máximo 3 atividades por dia' : intensidade === 'moderado' ? '3-4 atividades balanceadas' : '4-5 atividades aproveitando bem o tempo'}
3. **ORÇAMENTO**: ${nivelOrcamento === 'economico' ? 'Priorize atividades gratuitas/baratas, transporte público, restaurantes locais' : nivelOrcamento === 'medio' ? 'Balance opções econômicas e confortáveis' : 'Inclua experiências premium e exclusivas'}

📋 **ESTRUTURA OBRIGATÓRIA:**
- Para cada dia, divida em períodos: manhã, tarde e (opcionalmente) noite
- Para cada atividade, inclua:
  * Horário sugerido (formato HH:MM)
  * Nome específico do local (pontos turísticos reais, restaurantes conhecidos, etc)
  * 1-2 tags relevantes (ex: Imperdível, Cultural, Família, Econômico, Premium)
  * Uma dica personalizada da Tripinha

🚀 **CONSIDERAÇÕES ESPECIAIS:**
- **Primeiro dia**: Considere o horário de chegada (${horaChegada || 'não informado'})
- **Último dia**: Considere o horário de partida (${horaSaida || 'não informado'})
- **Tipo de viagem**: Priorize atividades relacionadas a ${descricaoTipoViagem}
- **Viajantes**: Adapte atividades para ${descricaoTipoCompanhia}
- **Fins de semana vs dias úteis**: Considere horários de funcionamento e aglomerações
- **Locais reais**: Use nomes de estabelecimentos, museus, restaurantes que realmente existem
- **Dicas da Tripinha**: Personalize para o perfil dos viajantes e nível de orçamento

✅ **RETORNO EM JSON:**
{
  "destino": "${destino}",
  "resumo": {
    "diasViagem": ${diasViagem},
    "tipoViagem": "${tipoViagem}",
    "intensidade": "${intensidade}",
    "nivelOrcamento": "${nivelOrcamento}"
  },
  "dias": [
    {
      "numero": 1,
      "data": "${dataInicio}",
      "descricao": "Descrição do dia com o tom da Tripinha",
      "atividades": [
        {
          "horario": "HH:MM",
          "local": "Nome específico do local real",
          "tags": ["tag1", "tag2"],
          "dica": "Dica personalizada da Tripinha considerando perfil e orçamento"
        }
      ]
    }
  ]
}

⚠️ **LEMBRE-SE:** 
- TODOS os ${diasViagem} dias devem ter atividades
- Horários realistas e sequenciais
- Nomes de locais que realmente existem em ${destino}
- Dicas considerando ${nivelOrcamento} orçamento e ${intensidade} intensidade
- Tom amigável e despojado da Tripinha
`;
}

/**
 * ✅ GERAR ROTEIRO COM DEEPSEEK (ATUALIZADO)
 */
async function gerarRoteiroComDeepseek(prompt) {
  try {
    // Verificar se a chave da API está configurada
    if (!DEEPSEEK_API_KEY) {
      throw new Error('Chave da API DeepSeek não configurada');
    }
    
    logEvent('info', 'Chamando API DeepSeek', { promptLength: prompt.length });
    
    // ✅ REALIZAR CHAMADA À API DEEPSEEK
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Você é a Tripinha, especialista em roteiros de viagem. Sempre responda em JSON válido conforme solicitado.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        timeout: 60000 // 60 segundos timeout
      }
    );
    
    // ✅ EXTRAIR RESPOSTA
    const respostaText = response.data.choices[0].message.content;
    
    logEvent('info', 'Resposta recebida da DeepSeek', { 
      responseLength: respostaText.length,
      model: 'deepseek-chat'
    });
    
    // ✅ PROCESSAR A RESPOSTA JSON
    try {
      // Limpar qualquer markdown ou texto antes/depois do JSON
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      
      // Parsear para objeto
      const roteiro = JSON.parse(jsonText);
      
      // Validar estrutura básica
      if (!roteiro.destino || !roteiro.dias) {
        throw new Error('Estrutura de roteiro inválida - faltam campos obrigatórios');
      }
      
      return roteiro;
      
    } catch (parseError) {
      logEvent('error', 'Erro ao processar resposta JSON da DeepSeek', {
        error: parseError.message,
        response: respostaText.substring(0, 500)
      });
      
      throw new Error(`Resposta da DeepSeek não é um JSON válido: ${parseError.message}`);
    }
    
  } catch (erro) {
    // ✅ LOG DETALHADO DO ERRO
    logEvent('error', 'Erro na chamada à API DeepSeek', {
      error: erro.message,
      status: erro.response?.status,
      statusText: erro.response?.statusText,
      responseData: JSON.stringify(erro.response?.data).substring(0, 300)
    });
    
    throw erro;
  }
}

/**
 * ✅ GERAR ROTEIRO COM CLAUDE (ATUALIZADO)
 */
async function gerarRoteiroComClaude(prompt) {
  try {
    // Verificar se a chave da API está configurada
    if (!CLAUDE_API_KEY) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    logEvent('info', 'Chamando API Claude', { promptLength: prompt.length });
    
    // ✅ REALIZAR CHAMADA À API CLAUDE (ANTHROPIC)
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
        timeout: 60000 // 60 segundos timeout
      }
    );
    
    // ✅ EXTRAIR RESPOSTA
    const respostaText = response.data.content[0].text;
    
    logEvent('info', 'Resposta recebida da Claude', { 
      responseLength: respostaText.length,
      model: 'claude-3-haiku'
    });
    
    // ✅ PROCESSAR A RESPOSTA JSON
    try {
      // Limpar qualquer markdown ou texto antes/depois do JSON
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      
      // Parsear para objeto
      const roteiro = JSON.parse(jsonText);
      
      // Validar estrutura básica
      if (!roteiro.destino || !roteiro.dias) {
        throw new Error('Estrutura de roteiro inválida - faltam campos obrigatórios');
      }
      
      return roteiro;
      
    } catch (parseError) {
      logEvent('error', 'Erro ao processar resposta JSON da Claude', {
        error: parseError.message,
        response: respostaText.substring(0, 500)
      });
      
      throw new Error(`Resposta da Claude não é um JSON válido: ${parseError.message}`);
    }
    
  } catch (erro) {
    // ✅ LOG DETALHADO DO ERRO
    logEvent('error', 'Erro na chamada à API Claude', {
      error: erro.message,
      status: erro.response?.status,
      statusText: erro.response?.statusText,
      responseData: JSON.stringify(erro.response?.data).substring(0, 300)
    });
    
    throw erro;
  }
}

/**
 * ✅ AJUSTAR NÚMERO DE DIAS SE NECESSÁRIO
 */
function ajustarNumeroDias(diasExistentes, diasNecessarios, destino) {
  if (diasExistentes.length === diasNecessarios) {
    return diasExistentes;
  }
  
  const diasAjustados = [...diasExistentes];
  
  // Se temos menos dias que o necessário, duplicar alguns
  while (diasAjustados.length < diasNecessarios) {
    const diaParaDuplicar = diasAjustados[diasAjustados.length - 1];
    const novoDia = {
      ...diaParaDuplicar,
      numero: diasAjustados.length + 1,
      descricao: `Continuando a exploração de ${destino}...`
    };
    diasAjustados.push(novoDia);
  }
  
  // Se temos mais dias que o necessário, remover alguns
  while (diasAjustados.length > diasNecessarios) {
    diasAjustados.pop();
  }
  
  return diasAjustados;
}
