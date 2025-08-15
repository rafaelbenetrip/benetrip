// api/itinerary-generator.js - Endpoint para geração de roteiro personalizado com Groq OTIMIZADO
const axios = require('axios');
const http = require('http');
const https = require('https');

// =======================
// Configurações Groq - OTIMIZADAS para Roteiros
// =======================
const CONFIG = {
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    models: {
      reasoning: 'openai/gpt-oss-120b',        // 🧠 Reasoning para roteiros complexos
      personality: 'llama-3.3-70b-versatile', // 🐾 Personalidade Tripinha
      fast: 'llama-3.1-8b-instant',           // ⚡ Backup rápido
      structured: 'llama3-groq-70b-8192-tool-use-preview' // 📋 Dados estruturados
    },
    timeout: 240000,     // 4 minutos para roteiros complexos
    maxTokens: 6000,     // Mais tokens para roteiros detalhados
    temperature: 0.6     // Focado mas criativo
  },
  retries: 2,
  logging: {
    enabled: true,
    maxLength: 800
  }
};

// Cliente HTTP configurado
const apiClient = axios.create({
  timeout: CONFIG.groq.timeout,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

//=======================
// Funções utilitárias otimizadas
// =======================
const utils = {
  log: (mensagem, dados, limite = CONFIG.logging.maxLength) => {
    if (!CONFIG.logging.enabled) return;
    console.log(mensagem);
    if (dados) {
      const dadosStr = typeof dados === 'string' ? dados : JSON.stringify(dados);
      console.log(dadosStr.length > limite ? dadosStr.substring(0, limite) + '...' : dadosStr);
    }
  },
  
  extrairJSONDaResposta: texto => {
    try {
      if (typeof texto === 'object' && texto !== null) {
        return JSON.stringify(texto);
      }
      
      // Tentar parse direto primeiro
      try {
        return JSON.stringify(JSON.parse(texto));
      } catch {}
      
      // Limpar markdown e comentários
      const textoProcessado = texto
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\r\n/g, '\n')
        .trim();
        
      // Procurar JSON no texto
      const match = textoProcessado.match(/(\{[\s\S]*\})/);
      if (match && match[0]) {
        return JSON.stringify(JSON.parse(match[0]));
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao extrair JSON:', error.message);
      return null;
    }
  },
  
  isValidItineraryJSON: (jsonString, requestData) => {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      
      // Verificar estrutura mínima necessária para roteiro
      const hasValidDestino = data.destino && typeof data.destino === 'string';
      const hasValidDias = Array.isArray(data.dias) && 
                           data.dias.length >= 1 &&
                           data.dias.every(dia => 
                             dia.data && 
                             dia.descricao &&
                             (dia.manha || dia.tarde || dia.noite)
                           );
      
      if (!hasValidDestino || !hasValidDias) {
        console.log('❌ Validação falhou: estrutura de roteiro inválida');
        return false;
      }
      
      // Validação específica para modelo de reasoning
      const hasReasoningData = data.processo_criacao && typeof data.processo_criacao === 'object';
      if (hasReasoningData) {
        console.log('🧠 Dados de raciocínio detectados:', Object.keys(data.processo_criacao));
      }
      
      console.log('✅ Validação de roteiro passou');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao validar JSON de roteiro:', error.message);
      return false;
    }
  }
};

// =======================
// Função para chamada ao Groq - OTIMIZADA para Roteiros
// =======================
async function callGroqAPI(prompt, requestData, model = CONFIG.groq.models.reasoning) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('Chave da API Groq não configurada (GROQ_API_KEY)');
  }

  let systemMessage;
  
  if (model === CONFIG.groq.models.reasoning) {
    // Sistema otimizado para reasoning de roteiros
    systemMessage = `Você é um sistema especialista em criação de roteiros de viagem que utiliza raciocínio estruturado.

PROCESSO DE RACIOCÍNIO OBRIGATÓRIO PARA ROTEIROS:
1. ANÁLISE DO PERFIL: Examine preferências, duração, tipo de companhia e orçamento
2. CONSIDERAÇÃO TEMPORAL: Analise datas, clima e sazonalidade do destino
3. MAPEAMENTO DE ATIVIDADES: Correlacione atividades com perfil do viajante
4. ORGANIZAÇÃO LOGÍSTICA: Otimize sequência e localização das atividades
5. PERSONALIZAÇÃO TRIPINHA: Adicione experiências autênticas da mascote

CRITÉRIOS DE CRIAÇÃO:
- Roteiro DEVE ter exatamente o número de dias solicitado
- Atividades DEVEM ser adequadas para o tipo de companhia
- Horários DEVEM ser realistas e logicamente sequenciados
- Dicas da Tripinha DEVEM ser específicas e em 1ª pessoa
- Considere intensidade do roteiro e orçamento informado

RESULTADO: JSON estruturado com roteiro completo fundamentado no raciocínio.`;
  } else if (model === CONFIG.groq.models.personality) {
    // Sistema focado na personalidade da Tripinha para roteiros
    systemMessage = `Você é a Tripinha, uma vira-lata caramelo especialista em roteiros de viagem! 🐾

PERSONALIDADE DA TRIPINHA PARA ROTEIROS:
- Conhece cada cantinho dos destinos pessoalmente
- Cria roteiros baseados nas suas próprias aventuras
- Inclui dicas práticas que só uma "local expert" saberia
- Menciona cheiros, sons e sensações que vivenciou
- Sempre sugere atividades que ela "adorou fazer"
- Organiza tudo de forma divertida e eficiente

RETORNE APENAS JSON VÁLIDO sem formatação markdown.`;
  } else {
    // Sistema padrão para modelos rápidos
    systemMessage = `Especialista em roteiros de viagem. Retorne apenas JSON válido com roteiro detalhado e personalizado.`;
  }

  try {
    utils.log(`🧠 Enviando requisição para Groq (${model})...`);
    
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
      temperature: model === CONFIG.groq.models.reasoning ? 0.6 : CONFIG.groq.temperature,
      max_tokens: CONFIG.groq.maxTokens,
      stream: false
    };
    
    // Adicionar parâmetros específicos para modelos de reasoning
    if (model === CONFIG.groq.models.reasoning) {
      requestPayload.reasoner_enabled = true;
    }
    
    const response = await apiClient({
      method: 'post',
      url: `${CONFIG.groq.baseURL}/chat/completions`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: requestPayload,
      timeout: model === CONFIG.groq.models.reasoning ? CONFIG.groq.timeout : 120000
    });
    
    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error(`Formato de resposta do Groq inválido (${model})`);
    }
    
    const content = response.data.choices[0].message.content;
    utils.log(`📥 Resposta recebida (${model}):`, content.substring(0, 400));
    
    return utils.extrairJSONDaResposta(content);
    
  } catch (error) {
    console.error(`❌ Erro na chamada à API Groq (${model}):`, error.message);
    if (error.response) {
      utils.log(`🔴 Resposta de erro do Groq (${model}):`, error.response.data);
    }
    throw error;
  }
}

// =======================
// Sistema de retry com fallback inteligente entre modelos
// =======================
async function retryWithBackoffAndFallback(prompt, requestData, maxAttempts = CONFIG.retries) {
  const modelOrder = [
    CONFIG.groq.models.reasoning,     // Primeiro: Reasoning (melhor qualidade)
    CONFIG.groq.models.personality,  // Segundo: Personalidade Tripinha
    CONFIG.groq.models.fast          // Terceiro: Backup rápido
  ];
  
  for (const model of modelOrder) {
    console.log(`🔄 Tentando modelo: ${model}`);
    
    let attempt = 1;
    let delay = 2000;
    
    while (attempt <= maxAttempts) {
      try {
        console.log(`🔄 Modelo ${model} - Tentativa ${attempt}/${maxAttempts}...`);
        
        const result = await callGroqAPI(prompt, requestData, model);
        
        if (result && utils.isValidItineraryJSON(result, requestData)) {
          console.log(`✅ Sucesso com ${model} na tentativa ${attempt}`);
          return { result, model };
        } else {
          console.log(`❌ ${model} - Tentativa ${attempt}: resposta inválida`);
        }
        
      } catch (error) {
        console.error(`❌ ${model} - Tentativa ${attempt} falhou:`, error.message);
      }
      
      if (attempt === maxAttempts) {
        console.log(`🚫 ${model}: Todas as ${maxAttempts} tentativas falharam`);
        break;
      }
      
      console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.2, 8000);
      attempt++;
    }
  }
  
  console.log('🚫 Todos os modelos falharam');
  return null;
}

// =======================
// Funções auxiliares otimizadas
// =======================
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

function gerarDatasRoteiro(dataInicio, diasViagem) {
  const datas = [];
  const dataAtual = new Date(dataInicio);
  
  for (let i = 0; i < diasViagem; i++) {
    const ano = dataAtual.getFullYear();
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    datas.push(`${ano}-${mes}-${dia}`);
    dataAtual.setDate(dataAtual.getDate() + 1);
  }
  
  return datas;
}

// =======================
// Prompt Engineering Avançado para Roteiros
// =======================
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
  
  // Gerar datas para cada dia
  const datasRoteiro = gerarDatasRoteiro(dataInicio, diasViagem);
  
  return `# 🧠 SISTEMA INTELIGENTE DE CRIAÇÃO DE ROTEIROS DE VIAGEM

## 📊 DADOS DO VIAJANTE PARA ANÁLISE:
**Perfil Básico:**
- Destino: ${destino}, ${pais}
- Período: ${dataInicio} a ${dataFim || dataInicio} (${diasViagem} dia${diasViagem > 1 ? 's' : ''})
- Composição: ${infoViajantes}
- Horário de chegada: ${horaChegada || 'Não informado'}
- Horário de partida: ${horaSaida || 'Não informado'}
- Preferência principal: ${descricaoTipoViagem}
- Intensidade: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
- Orçamento: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}

## 🎯 PROCESSO DE RACIOCÍNIO OBRIGATÓRIO:

### PASSO 1: ANÁLISE TEMPORAL E CLIMÁTICA
- Determine a estação exata em ${destino} durante ${dataInicio} a ${dataFim || dataInicio}
- Analise condições climáticas típicas para o período
- Identifique eventos sazonais, festivais ou atividades especiais
- Considere horários de funcionamento e melhores momentos para cada atividade

### PASSO 2: MAPEAMENTO DE ATIVIDADES POR PERFIL
Para ${infoViajantes} com foco em ${descricaoTipoViagem}:
- Quais são as experiências IMPERDÍVEIS no destino?
- Que atividades se alinham perfeitamente com as preferências?
- Como adaptar experiências para este tipo de companhia específico?
- Quais locais visitados pela Tripinha foram mais marcantes?

### PASSO 3: ORGANIZAÇÃO LOGÍSTICA INTELIGENTE
- Agrupe atividades por proximidade geográfica para otimizar deslocamentos
- Considere horários de funcionamento e tempos de deslocamento realistas
- Balanceie atividades de alta e baixa energia ao longo do dia
- Respeite a intensidade escolhida: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}

### PASSO 4: PERSONALIZAÇÃO EXPERIENCIAL
- Incorpore experiências sensoriais que a Tripinha vivenciou
- Adicione dicas práticas baseadas nas aventuras da mascote
- Inclua descobertas locais que apenas um "conhecedor" saberia
- Sugira horários específicos baseados na experiência da Tripinha

### PASSO 5: VALIDAÇÃO E REFINAMENTO
- Verifique se cada dia tem o número apropriado de atividades para a intensidade
- Confirme que todas as atividades são adequadas para ${infoViajantes}
- Valide que o roteiro considera ${horaChegada || 'horário de chegada'} e ${horaSaida || 'horário de partida'}
- Assegure que há equilíbrio entre atividades obrigatórias e tempo livre

## 📋 FORMATO DE RESPOSTA (JSON ESTRUTURADO):

\`\`\`json
{
  "processo_criacao": {
    "analise_temporal": "Resumo das condições climáticas e sazonais para ${dataInicio} a ${dataFim || dataInicio}",
    "adaptacao_perfil": "Como o roteiro foi adaptado para ${infoViajantes} com foco em ${descricaoTipoViagem}",
    "organizacao_logistica": "Estratégia de organização geográfica e temporal das atividades",
    "personalizacao_tripinha": "Como as experiências da Tripinha influenciaram as escolhas"
  },
  "destino": "${destino}, ${pais}",
  "periodo_viagem": "${dataInicio} a ${dataFim || dataInicio}",
  "perfil_viajante": "${infoViajantes}",
  "intensidade_roteiro": "${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}",
  "dias": [${datasRoteiro.map((data, index) => `
    {
      "dia_numero": ${index + 1},
      "data": "${data}",
      "dia_semana": "Determine o dia da semana para ${data}",
      "descricao": "Descrição temática do dia baseada nas atividades planejadas",
      ${index === 0 && horaChegada ? `"horario_especial_chegada": "${horaChegada}",` : ''}
      ${index === diasViagem - 1 && horaSaida ? `"horario_especial_partida": "${horaSaida}",` : ''}
      "clima_previsto": {
        "estacao": "Estação no destino",
        "temperatura": "Faixa de temperatura esperada",
        "condicoes": "Condições climáticas (sol, chuva, etc.)",
        "dicas_vestuario": "Dicas específicas do que vestir"
      },
      "manha": {
        "periodo": "08:00-12:00",
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome específico do local",
            "descricao": "Descrição detalhada da atividade",
            "duracao_estimada": "XX minutos",
            "tags": ["Imperdível", "Família", "Cultural", etc],
            "dica_tripinha": "Dica em 1ª pessoa da Tripinha: 'Quando eu visitei este lugar, descobri que...'",
            "custo_aproximado": "Gratuito/Baixo/Médio/Alto",
            "dicas_praticas": "Informações úteis sobre horários, ingressos, etc."
          }
        ]
      },
      "tarde": {
        "periodo": "12:00-18:00", 
        "atividades": [
          // Mesmo formato da manhã
        ]
      },
      "noite": {
        "periodo": "18:00-22:00",
        "atividades": [
          // Mesmo formato da manhã
        ]
      },
      "resumo_dia": "Resumo das experiências e descobertas do dia",
      "total_atividades": "X atividades planejadas"
    }`).join(',\n  ')
  }],
  "resumo_roteiro": {
    "total_dias": ${diasViagem},
    "foco_principal": "${descricaoTipoViagem}",
    "intensidade_aplicada": "${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}",
    "pontos_turisticos_incluidos": "Lista dos principais pontos visitados",
    "experiencias_unicas": "Experiências especiais que tornam este roteiro único"
  },
  "dicas_gerais_tripinha": [
    "Dica geral 1 da Tripinha baseada em sua experiência no destino",
    "Dica geral 2 sobre o que não pode esquecer de fazer",
    "Dica geral 3 sobre descobertas especiais do destino"
  ]
}
\`\`\`

## 🔍 VALIDAÇÃO FINAL OBRIGATÓRIA:
Antes de responder, confirme que:
- ✅ O roteiro tem EXATAMENTE ${diasViagem} dia${diasViagem > 1 ? 's' : ''} completo${diasViagem > 1 ? 's' : ''}
- ✅ Cada dia respeita a intensidade: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
- ✅ Atividades são adequadas para ${infoViajantes}
- ✅ Horários são realistas e bem distribuídos
- ✅ Informações climáticas são precisas para ${dataInicio} a ${dataFim || dataInicio}
- ✅ Dicas da Tripinha são específicas e em 1ª pessoa
- ✅ Considerou ${horaChegada || 'horário de chegada'} e ${horaSaida || 'horário de partida'}
- ✅ Incluiu experiências focadas em ${descricaoTipoViagem}

**Execute o raciocínio passo-a-passo e crie um roteiro detalhado, personalizado e inesquecível!**`;
}

// =======================
// Handler principal da API - OTIMIZADO
// =======================
module.exports = async function handler(req, res) {
  let isResponseSent = false;
  const serverTimeout = setTimeout(() => {
    if (!isResponseSent) {
      isResponseSent = true;
      console.log('⏰ Timeout do servidor atingido');
      return res.status(500).json({
        tipo: "erro",
        message: "Tempo limite excedido. Tente novamente.",
        error: "timeout"
      });
    }
  }, 420000); // 7 minutos para roteiros complexos

  // Headers CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    isResponseSent = true;
    clearTimeout(serverTimeout);
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    isResponseSent = true;
    clearTimeout(serverTimeout);
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    console.log('🧠 === BENETRIP GROQ ITINERARY API v2.0 - OTIMIZADA ===');
    
    if (!req.body) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(400).json({ error: "Nenhum dado fornecido na requisição" });
    }
    
    const requestData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // Verificar se a chave do Groq está configurada
    if (!process.env.GROQ_API_KEY) {
      console.error('❌ GROQ_API_KEY não configurada');
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(500).json({
          tipo: "erro",
          message: "Serviço temporariamente indisponível.",
          error: "groq_api_key_missing"
        });
      }
      return;
    }
    
    // Validar parâmetros obrigatórios
    const { destino, pais, dataInicio } = requestData;
    if (!destino || !dataInicio) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(400).json({ 
        error: 'Parâmetros obrigatórios: destino, dataInicio' 
      });
    }
    
    // Calcular número de dias
    const diasViagem = calcularDiasViagem(requestData.dataInicio, requestData.dataFim);
    
    // Log dos dados recebidos
    utils.log('📊 Dados da requisição de roteiro:', {
      destino: destino,
      pais: pais,
      diasViagem: diasViagem,
      dataInicio: requestData.dataInicio,
      dataFim: requestData.dataFim,
      tipoViagem: requestData.tipoViagem,
      tipoCompanhia: requestData.tipoCompanhia,
      intensidade: requestData.preferencias?.intensidade_roteiro,
      orcamento: requestData.preferencias?.orcamento_nivel
    });
    
    // Gerar prompt otimizado para roteiros
    const prompt = gerarPromptRoteiro(requestData);
    console.log('📝 Prompt de roteiro gerado para Groq');
    
    // Tentar obter roteiro com fallback inteligente entre modelos
    const resultado = await retryWithBackoffAndFallback(prompt, requestData);
    
    if (!resultado) {
      console.error('🚫 Falha em todos os modelos do Groq para roteiro');
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(503).json({
          tipo: "erro",
          message: "Não foi possível gerar o roteiro no momento. Tente novamente em alguns instantes.",
          error: "groq_all_models_failed"
        });
      }
      return;
    }
    
    const { result: roteiroBruto, model: modeloUsado } = resultado;
    
    // Processar e retornar resultado
    try {
      const dados = typeof roteiroBruto === 'string' ? 
        JSON.parse(roteiroBruto) : roteiroBruto;
      
      // Validar estrutura básica do roteiro
      if (!dados.dias || !Array.isArray(dados.dias)) {
        throw new Error('Estrutura de roteiro inválida: falta array de dias');
      }
      
      // Adicionar metadados
      dados.metadados = {
        modelo: modeloUsado,
        provider: 'groq',
        versao: '2.0-otimizada',
        timestamp: new Date().toISOString(),
        reasoning_enabled: modeloUsado === CONFIG.groq.models.reasoning,
        destino_completo: `${destino}, ${pais}`,
        dias_viagem: diasViagem,
        gerado_em: new Date().toLocaleString('pt-BR')
      };
      
      console.log('🎉 Roteiro processado com sucesso!');
      console.log('🧠 Modelo usado:', modeloUsado);
      console.log('📍 Destino:', `${destino}, ${pais}`);
      console.log('📋 Roteiro gerado:', {
        diasTotal: dados.dias?.length || 0,
        temProcessoCriacao: !!dados.processo_criacao,
        temDicasTripinha: !!dados.dicas_gerais_tripinha,
        periodoViagem: `${requestData.dataInicio} a ${requestData.dataFim || requestData.dataInicio}`
      });
      
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(200).json({
          tipo: "groq_success",
          modelo: modeloUsado,
          roteiro: dados
        });
      }
      
    } catch (processError) {
      console.error('❌ Erro ao processar resposta final do roteiro:', processError.message);
      
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(200).json({
          tipo: "groq_partial_success",
          modelo: modeloUsado,
          roteiro_bruto: roteiroBruto
        });
      }
    }
    
  } catch (globalError) {
    console.error('💥 Erro global no gerador de roteiros:', globalError.message);
    
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(500).json({
        tipo: "erro",
        message: "Erro interno do servidor. Tente novamente.",
        error: globalError.message
      });
    }
  } finally {
    clearTimeout(serverTimeout);
    if (!isResponseSent) {
      isResponseSent = true;
      res.status(500).json({
        tipo: "erro",
        message: "Erro inesperado. Tente novamente.",
        error: "unexpected_error"
      });
    }
  }
};
