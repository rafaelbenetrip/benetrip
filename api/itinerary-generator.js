// api/itinerary-generator.js - Endpoint para geração de roteiro personalizado com GROQ
// Versão 2.1 - Prompt melhorado para viagens curtas e longas
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
      primary: 'llama-3.3-70b-versatile',
      fast: 'llama-3.1-8b-instant',
      toolUse: 'llama3-groq-70b-8192-tool-use-preview'
    },
    timeout: 90000,       // ✅ FIX: 90 segundos para viagens longas
    temperature: 0.7
  },
  retries: 2,
  logging: {
    enabled: true,
    maxLength: 500
  }
};

// ✅ FIX v2.1: maxTokens dinâmico baseado no número de dias
function calcularMaxTokens(diasViagem) {
  // ~400 tokens por dia é o mínimo para um roteiro detalhado
  // Base de 1500 tokens + 500 por dia
  const tokens = Math.min(Math.max(1500 + (diasViagem * 500), 3000), 8000);
  return tokens;
}

// =======================
// Cliente HTTP configurado
// =======================
const apiClient = axios.create({
  timeout: CONFIG.groq.timeout,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

// =======================
// Logging estruturado
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
// Extrair JSON da resposta
// =======================
function extrairJSONDaResposta(texto) {
  try {
    if (typeof texto === 'object' && texto !== null) return texto;
    
    try { return JSON.parse(texto); } catch {}
    
    const textoLimpo = texto
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    
    const match = textoLimpo.match(/\{[\s\S]*\}/);
    if (match && match[0]) return JSON.parse(match[0]);
    
    throw new Error('JSON não encontrado na resposta');
    
  } catch (error) {
    logEvent('error', 'Erro ao extrair JSON', { error: error.message });
    return null;
  }
}

// =======================
// Chamada à API Groq
// =======================
async function chamarGroqAPI(prompt, model = CONFIG.groq.models.primary, maxTokens = 4000) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('Chave da API Groq não configurada (GROQ_API_KEY)');
  }
  
  // ✅ FIX v2.1: System message melhorado
  const systemMessage = `Você é a Tripinha, uma vira-lata caramelo especialista em viagens da Benetrip.
Sua missão é criar roteiros COMPLETOS, DETALHADOS e REALISTAS.

PERSONALIDADE:
- Fale como uma amiga próxima: leve, simpática, com bom humor
- Use experiências pessoais ("quando visitei...", "adorei quando...")
- Seja prática e direta nas dicas
- Use emojis com moderação nas dicas

REGRAS ABSOLUTAS:
- Crie EXATAMENTE o número de dias solicitado no prompt — nem mais, nem menos
- Cada dia DEVE ter atividades nos 3 períodos: manhã, tarde e noite
- Use APENAS locais, restaurantes e pontos turísticos REAIS que existem de verdade
- NÃO invente nomes de locais. Se não conhece locais específicos, use categorias genéricas como "Restaurante local" com dica útil
- Respeite horários de chegada no primeiro dia e partida no último dia
- Adapte o ritmo das atividades ao tipo de viajante e intensidade solicitada
- Retorne APENAS JSON válido, sem formatação markdown, sem texto antes ou depois`;

  try {
    logEvent('info', `Chamando Groq API (${model}), maxTokens: ${maxTokens}...`);
    
    const requestPayload = {
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ],
      temperature: CONFIG.groq.temperature,
      max_tokens: maxTokens,
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
    
    // ✅ FIX v2.1: Log de finish_reason para detectar truncamento
    const finishReason = response.data.choices[0].finish_reason;
    logEvent('info', `Resposta recebida do Groq (${model}), finish_reason: ${finishReason}`);
    
    if (finishReason === 'length') {
      logEvent('warning', 'Resposta TRUNCADA pelo limite de tokens!');
    }
    
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
// ✅ FIX v2.1: Prompt otimizado para qualidade e diferentes durações
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
  
  const intensidadeInfo = {
    'leve': '2-3 atividades por período (manhã/tarde/noite)',
    'moderado': '3-4 atividades por período',
    'intenso': '4-5 atividades por período'
  }[preferencias?.intensidade_roteiro] || '3-4 atividades por período';
  
  const orcamentoInfo = {
    'economico': 'Priorize atividades gratuitas e de baixo custo. Sugira restaurantes acessíveis e transporte público.',
    'medio': 'Equilibre atividades gratuitas e pagas. Restaurantes de preço médio são bem-vindos.',
    'alto': 'Inclua experiências premium, restaurantes sofisticados e atividades exclusivas.'
  }[preferencias?.orcamento_nivel] || 'Equilibre atividades gratuitas e pagas.';

  // ✅ FIX v2.1: Instruções especiais para viagens curtas
  let instrucoesDuracao = '';
  if (diasViagem <= 2) {
    instrucoesDuracao = `
ATENÇÃO - VIAGEM CURTA (${diasViagem} dia${diasViagem > 1 ? 's' : ''}):
- Com poucos dias, foque nos DESTAQUES IMPERDÍVEIS de ${destino}
- Cada atividade deve ser realmente valiosa — não perca tempo com locais secundários
- No primeiro dia, se a chegada for tarde, priorize jantar especial e passeio noturno
- Se for apenas 1 dia, crie um roteiro COMPLETO com manhã, tarde e noite bem aproveitados
- Inclua os pontos turísticos mais icônicos e fotogênicos`;
  } else if (diasViagem >= 7) {
    instrucoesDuracao = `
ATENÇÃO - VIAGEM LONGA (${diasViagem} dias):
- Com ${diasViagem} dias disponíveis, explore DIFERENTES bairros e regiões de ${destino}
- Inclua 1-2 dias para excursões fora do centro ou cidades próximas
- Alterne dias intensos com dias mais leves para descanso
- Sugira bairros diferentes a cada dia para cobrir bem a cidade
- NÃO repita locais — cada dia deve ter atividades totalmente diferentes
- Considere incluir um "dia livre" no meio da viagem para descanso
- Dia 1 pode ser mais leve (chegada) e último dia focado na partida`;
  }

  // ✅ FIX v2.1: Adaptação para companhia
  let instrucaoCompanhia = '';
  if (tipoCompanhia === 'familia' || tipoCompanhia === 'Família') {
    instrucaoCompanhia = 'Inclua atividades adequadas para crianças. Evite locais com muitas escadas ou caminhos perigosos. Considere paradas para descanso.';
  } else if (tipoCompanhia === 'casal' || tipoCompanhia === 'Casal') {
    instrucaoCompanhia = 'Inclua experiências românticas: restaurantes aconchegantes, mirantes ao pôr-do-sol, passeios a dois.';
  } else if (tipoCompanhia === 'amigos' || tipoCompanhia === 'Amigos') {
    instrucaoCompanhia = 'Inclua atividades em grupo: bares, vida noturna, experiências divertidas e interativas.';
  }

  return `Crie um roteiro COMPLETO e DETALHADO de EXATAMENTE ${diasViagem} dia${diasViagem > 1 ? 's' : ''} para ${destino}, ${pais}.

DADOS DA VIAGEM:
- Período: ${dataInicio} a ${dataFim || dataInicio} (${diasViagem} dia${diasViagem > 1 ? 's' : ''})
- Horário de chegada no destino: ${horaChegada || 'não informado'}
- Horário de partida do destino: ${horaSaida || 'não informado'}
- Viajantes: ${tipoCompanhia}
- Foco principal: ${tipoViagem}
- Intensidade: ${intensidadeInfo}
- Orçamento: ${orcamentoInfo}
${instrucaoCompanhia ? `- Dica para companhia: ${instrucaoCompanhia}` : ''}
${instrucoesDuracao}

REGRAS PARA O JSON:
1. O array "dias" deve ter EXATAMENTE ${diasViagem} objetos — confira antes de retornar
2. Cada dia deve ter os campos: data, descricao, manha, tarde, noite
3. Cada período (manha/tarde/noite) deve ter um array "atividades" com pelo menos 1 atividade
4. No DIA 1: se o horário de chegada for depois das 18h, a manhã e tarde podem ter atividades simplificadas (ex: "Chegada e transfer para hotel")
5. No ÚLTIMO DIA: considere o horário de partida. Se for antes das 12h, manhã deve ser check-out e aeroporto
6. Cada atividade deve ter: horario (HH:MM), local (nome REAL do local), tags (array com 1-3 tags), dica (frase prática e útil)
7. Use SOMENTE locais reais de ${destino} — não invente nomes

ESTRUTURA JSON OBRIGATÓRIA (retorne APENAS este JSON, nada mais):
{
  "destino": "${destino}, ${pais}",
  "dias": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "Frase curta e empolgante sobre o dia",
      "manha": {
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome real do local",
            "tags": ["tag1", "tag2"],
            "dica": "Dica prática e útil"
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

CHECKLIST FINAL antes de retornar:
- [ ] O array "dias" tem exatamente ${diasViagem} objetos?
- [ ] Cada dia tem manha, tarde e noite com atividades?
- [ ] Todos os locais são reais e existem em ${destino}?
- [ ] As datas estão sequenciais a partir de ${dataInicio}?

Retorne APENAS o JSON, sem explicações.`;
}

// =======================
// Retry com fallback entre modelos
// =======================
async function executarComRetry(prompt, maxTentativas = CONFIG.retries, maxTokens = 4000) {
  const modelos = [
    CONFIG.groq.models.primary,
    CONFIG.groq.models.fast
  ];
  
  for (const modelo of modelos) {
    logEvent('info', `Tentando com modelo: ${modelo}, maxTokens: ${maxTokens}`);
    
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      try {
        const resultado = await chamarGroqAPI(prompt, modelo, maxTokens);
        
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
    if (!roteiro || typeof roteiro !== 'object') return false;
    if (!roteiro.destino || !Array.isArray(roteiro.dias)) return false;
    if (roteiro.dias.length === 0) return false;
    
    for (const dia of roteiro.dias) {
      if (!dia.data || !dia.descricao) return false;
      
      const temAtividades = 
        (dia.manha?.atividades?.length > 0) ||
        (dia.tarde?.atividades?.length > 0) ||
        (dia.noite?.atividades?.length > 0);
      
      if (!temAtividades) return false;
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
  while (roteiro.dias.length < diasEsperados) {
    const ultimoDia = roteiro.dias[roteiro.dias.length - 1];
    const novaData = new Date(ultimoDia.data);
    novaData.setDate(novaData.getDate() + 1);
    
    roteiro.dias.push({
      data: novaData.toISOString().split('T')[0],
      descricao: `Dia livre para explorar ${roteiro.destino.split(',')[0]} por conta própria`,
      manha: {
        atividades: [{
          horario: "09:00",
          local: "Exploração livre pelo bairro do hotel",
          tags: ["Livre", "Exploração"],
          dica: "Pergunte ao concierge por dicas locais!"
        }]
      },
      tarde: {
        atividades: [{
          horario: "14:00",
          local: "Dia livre - Sugestão: revisitar seus lugares favoritos",
          tags: ["Livre", "Opcional"],
          dica: "Aproveite para revisitar o que mais gostou!"
        }]
      },
      noite: {
        atividades: [{
          horario: "19:00",
          local: "Jantar em restaurante local",
          tags: ["Gastronomia", "Livre"],
          dica: "Peça sugestões ao hotel para um restaurante autêntico!"
        }]
      }
    });
  }
  
  if (roteiro.dias.length > diasEsperados) {
    roteiro.dias = roteiro.dias.slice(0, diasEsperados);
  }
  
  return roteiro;
}

// =======================
// Handler principal da API
// =======================
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  
  try {
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
      intensidade,
      orcamento
    } = req.body;
    
    if (!destino || !dataInicio) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: destino, dataInicio' });
    }
    
    const diasViagem = calcularDiasViagem(dataInicio, dataFim);
    
    // ✅ FIX v2.1: Calcular tokens dinamicamente
    const maxTokens = calcularMaxTokens(diasViagem);
    
    logEvent('info', 'Gerando roteiro com Groq', {
      destino,
      pais: pais || 'Internacional',
      diasViagem,
      maxTokens,
      tipoViagem,
      tipoCompanhia,
      intensidade,
      orcamento
    });
    
    // ✅ FIX v2.1: Passar intensidade e orcamento diretamente se vierem do frontend
    const preferenciasCompletas = {
      ...(preferencias || {}),
      intensidade_roteiro: intensidade || preferencias?.intensidade || 'moderado',
      orcamento_nivel: orcamento || preferencias?.orcamento || 'medio'
    };
    
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
      preferencias: preferenciasCompletas
    });
    
    const { roteiro, modelo } = await executarComRetry(prompt, CONFIG.retries, maxTokens);
    
    const roteiroCompleto = completarRoteiro(roteiro, diasViagem);
    
    roteiroCompleto.metadados = {
      provider: 'groq',
      modelo: modelo,
      versao: '2.1',
      timestamp: new Date().toISOString(),
      diasSolicitados: diasViagem,
      maxTokensUsados: maxTokens
    };
    
    logEvent('info', 'Roteiro gerado com sucesso', {
      modelo,
      diasGerados: roteiroCompleto.dias.length,
      diasSolicitados: diasViagem,
      maxTokens
    });
    
    return res.status(200).json(roteiroCompleto);
    
  } catch (erro) {
    logEvent('error', 'Erro ao gerar roteiro', {
      message: erro.message,
      stack: erro.stack
    });
    
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

function calcularDiasViagem(dataInicio, dataFim) {
  if (!dataInicio) return 1;
  
  const inicio = new Date(dataInicio);
  if (!dataFim) return 1;
  
  const fim = new Date(dataFim);
  const diffTempo = Math.abs(fim - inicio);
  const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;
  
  return Math.min(Math.max(diffDias, 1), 30);
}
