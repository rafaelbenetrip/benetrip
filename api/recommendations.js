// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
// Versão 6.0 - GROQ REASONING OPTIMIZED - DeepSeek R1 Distill + Fallbacks Inteligentes
// Prioriza modelo de reasoning para análise complexa com fallback para personalidade e velocidade
const axios = require('axios');
const http = require('http');
const https = require('https');

// =======================
// Configurações Groq - REASONING OPTIMIZED
// =======================
const CONFIG = {
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    models: {
      reasoning: 'deepseek-r1-distill-llama-70b',     // Reasoning principal
      personality: 'llama-3.3-70b-versatile',         // Personalidade Tripinha
      fast: 'llama-3.1-8b-instant',                   // Backup rápido
      toolUse: 'llama3-groq-70b-8192-tool-use-preview' // APIs futuras
    },
    timeout: 180000,     // Aumentado para reasoning (3min)
    maxTokens: 4500,     // Mais tokens para reasoning detalhado
    temperature: 0.6     // Mais focado para análise
  },
  retries: 2,            // Menos retries devido ao tempo maior
  logging: {
    enabled: true,
    maxLength: 600
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
// Base de dados de preços realistas por região
// =======================
const PRECOS_REFERENCIAIS = {
  'Brasil': {
    'Nacional': { min: 300, max: 800, media: 500 },
    'América do Sul': { min: 800, max: 1800, media: 1200 },
    'América do Norte': { min: 1500, max: 3500, media: 2200 },
    'Europa': { min: 1800, max: 4000, media: 2500 },
    'Ásia': { min: 2200, max: 5000, media: 3000 },
    'Oceania': { min: 3000, max: 6000, media: 4000 }
  }
};

// =======================
// Funções utilitárias
// =======================
const utils = {
  validarCodigoIATA: codigo => codigo && /^[A-Z]{3}$/.test(codigo),
  
  formatarDuracao: duracao => {
    if (!duracao) return null;
    try {
      const horas = (duracao.match(/(\d+)H/) || [])[1] || 0;
      const minutos = (duracao.match(/(\d+)M/) || [])[1] || 0;
      return `${horas}h${minutos > 0 ? ` ${minutos}m` : ''}`;
    } catch (e) {
      console.warn(`Erro ao formatar duração "${duracao}":`, e);
      return null;
    }
  },

  // Nova função para validar orçamento
  validarOrcamentoDestino: (preco, orcamentoMax, tolerancia = 0.1) => {
    if (!orcamentoMax || orcamentoMax === 'flexível') return true;
    const limite = parseFloat(orcamentoMax) * (1 + tolerancia); // 10% de tolerância
    return parseFloat(preco) <= limite;
  },

  // Obter faixa de preços realista baseado na origem
  obterFaixaPrecos: (origem, regiao) => {
    const paisOrigem = origem.toLowerCase().includes('brasil') || 
                      origem.toLowerCase().includes('são paulo') || 
                      origem.toLowerCase().includes('rio') ? 'Brasil' : 'Brasil';
    
    return PRECOS_REFERENCIAIS[paisOrigem]?.[regiao] || 
           PRECOS_REFERENCIAIS['Brasil']['América do Sul'];
  },
  
  log: (mensagem, dados, limite = CONFIG.logging.maxLength) => {
    if (!CONFIG.logging.enabled) return;
    console.log(mensagem);
    if (dados) {
      const dadosStr = typeof dados === 'string' ? dados : JSON.stringify(dados);
      console.log(dadosStr.length > limite ? dadosStr.substring(0, limite) + '...' : dadosStr);
    }
  },
  
  formatarData: data => {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
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
  
  isValidDestinationJSON: (jsonString, requestData) => {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      
      // Verificar estrutura mínima necessária
      const hasValidTopPick = data.topPick && data.topPick.destino && data.topPick.pais;
      const hasValidAlternatives = Array.isArray(data.alternativas) && 
                                   data.alternativas.length >= 2 &&
                                   data.alternativas.every(alt => alt.destino && alt.pais);
      
      if (!hasValidTopPick && !hasValidAlternatives) {
        console.log('❌ Validação falhou: nem topPick nem alternativas válidas');
        return false;
      }
      
      // NOVA VALIDAÇÃO DE ORÇAMENTO
      const orcamentoMax = requestData.orcamento_valor;
      if (orcamentoMax && orcamentoMax !== 'flexível') {
        const orcamentoNum = parseFloat(orcamentoMax);
        let destinosForaOrcamento = [];
        
        // Verificar topPick
        if (data.topPick?.preco?.voo && !utils.validarOrcamentoDestino(data.topPick.preco.voo, orcamentoMax)) {
          destinosForaOrcamento.push(`topPick (${data.topPick.destino}: ${data.topPick.preco.voo})`);
        }
        
        // Verificar alternativas
        if (data.alternativas) {
          data.alternativas.forEach((alt, i) => {
            if (alt.preco?.voo && !utils.validarOrcamentoDestino(alt.preco.voo, orcamentoMax)) {
              destinosForaOrcamento.push(`alternativa ${i+1} (${alt.destino}: ${alt.preco.voo})`);
            }
          });
        }
        
        // Verificar surpresa
        if (data.surpresa?.preco?.voo && !utils.validarOrcamentoDestino(data.surpresa.preco.voo, orcamentoMax)) {
          destinosForaOrcamento.push(`surpresa (${data.surpresa.destino}: ${data.surpresa.preco.voo})`);
        }
        
        if (destinosForaOrcamento.length > 2) { // Mais de 2 destinos fora = problema
          console.log(`❌ ORÇAMENTO VIOLADO! Destinos fora do orçamento de ${orcamentoMax}:`, destinosForaOrcamento);
          return false;
        } else if (destinosForaOrcamento.length > 0) {
          console.log(`⚠️ Alguns destinos fora do orçamento (aceitável):`, destinosForaOrcamento);
        }
      }
      
      // Validação específica para modelo de reasoning
      const hasReasoningData = data.raciocinio && typeof data.raciocinio === 'object';
      if (hasReasoningData) {
        console.log('🧠 Dados de raciocínio detectados:', Object.keys(data.raciocinio));
      }
      
      console.log('✅ Validação passou (incluindo orçamento)');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao validar JSON de destino:', error.message);
      return false;
    }
  }
};

// =======================
// Mapeamento de códigos IATA
// =======================
function obterCodigoIATAPadrao(cidade, pais) {
  const mapeamentoIATA = {
    // Principais destinos brasileiros
    'São Paulo': 'GRU', 'Rio de Janeiro': 'GIG', 'Brasília': 'BSB',
    'Salvador': 'SSA', 'Fortaleza': 'FOR', 'Recife': 'REC',
    'Porto Alegre': 'POA', 'Belém': 'BEL', 'Manaus': 'MAO',
    
    // América do Sul
    'Buenos Aires': 'EZE', 'Santiago': 'SCL', 'Lima': 'LIM',
    'Bogotá': 'BOG', 'Cartagena': 'CTG', 'Medellín': 'MDE',
    'Montevidéu': 'MVD', 'La Paz': 'LPB', 'Cusco': 'CUZ',
    
    // América do Norte
    'Nova York': 'JFK', 'Los Angeles': 'LAX', 'Miami': 'MIA',
    'Cidade do México': 'MEX', 'Cancún': 'CUN', 'Toronto': 'YYZ',
    'Vancouver': 'YVR', 'Montreal': 'YUL',
    
    // Europa
    'Londres': 'LHR', 'Paris': 'CDG', 'Roma': 'FCO',
    'Madri': 'MAD', 'Lisboa': 'LIS', 'Barcelona': 'BCN',
    'Amsterdã': 'AMS', 'Berlim': 'BER', 'Munique': 'MUC',
    'Porto': 'OPO', 'Praga': 'PRG', 'Viena': 'VIE',
    
    // Ásia & Oceania
    'Tóquio': 'HND', 'Dubai': 'DXB', 'Singapura': 'SIN',
    'Bangkok': 'BKK', 'Hong Kong': 'HKG', 'Sydney': 'SYD'
  };
  
  const nomeLower = cidade.toLowerCase();
  
  for (const [cidadeMap, codigo] of Object.entries(mapeamentoIATA)) {
    if (nomeLower.includes(cidadeMap.toLowerCase())) return codigo;
  }
  
  // Fallback: primeira letra do país + duas da cidade
  return (pais.charAt(0) + cidade.substring(0, 2)).toUpperCase();
}

// =======================
// Função para chamada ao Groq - REASONING OPTIMIZED
// =======================
async function callGroqAPI(prompt, requestData, model = CONFIG.groq.models.reasoning) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('Chave da API Groq não configurada (GROQ_API_KEY)');
  }

  let systemMessage;
  
  if (model === CONFIG.groq.models.reasoning) {
    // Sistema otimizado para reasoning
    systemMessage = `Você é um sistema especialista em recomendações de viagem que utiliza raciocínio estruturado.

PROCESSO DE RACIOCÍNIO OBRIGATÓRIO:
1. ANÁLISE DO PERFIL: Examine detalhadamente cada preferência do viajante
2. MAPEAMENTO DE COMPATIBILIDADE: Correlacione destinos com o perfil analisado  
3. VALIDAÇÃO DE ORÇAMENTO: Verifique se preços de voo são realistas e compatíveis
4. ANÁLISE CLIMÁTICA: Determine condições climáticas exatas para as datas
5. PERSONALIZAÇÃO TRIPINHA: Adicione perspectiva autêntica da mascote cachorrinha

CRITÉRIOS DE DECISÃO:
- Orçamento de voo DEVE ser respeitado rigorosamente
- Destinos DEVEM ser adequados para o tipo de companhia especificado
- Informações climáticas DEVEM ser precisas para o período da viagem
- Pontos turísticos DEVEM ser específicos e reais
- Comentários da Tripinha DEVEM ser em 1ª pessoa com detalhes sensoriais

RESULTADO: JSON estruturado com recomendações fundamentadas no raciocínio acima.`;
  } else if (model === CONFIG.groq.models.personality) {
    // Sistema focado na personalidade da Tripinha
    systemMessage = `Você é a Tripinha, uma vira-lata caramelo especialista em viagens! 🐾

PERSONALIDADE DA TRIPINHA:
- Conhece todos os destinos do mundo pessoalmente
- Fala sempre em 1ª pessoa sobre suas experiências
- É entusiasmada, carismática e usa emojis naturalmente  
- Inclui detalhes sensoriais que um cachorro notaria
- Sempre menciona pontos turísticos específicos que visitou
- Dá dicas práticas baseadas nas suas "aventuras"

RETORNE APENAS JSON VÁLIDO sem formatação markdown.`;
  } else {
    // Sistema padrão para modelos rápidos
    systemMessage = `Especialista em recomendações de viagem. Retorne apenas JSON válido com destinos que respeitem o orçamento do usuário.`;
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
    
    // Adicionar parâmetros específicos para DeepSeek R1
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
      timeout: model === CONFIG.groq.models.reasoning ? CONFIG.groq.timeout : 60000
    });
    
    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error(`Formato de resposta do Groq inválido (${model})`);
    }
    
    const content = response.data.choices[0].message.content;
    utils.log(`📥 Resposta recebida (${model}):`, content.substring(0, 300));
    
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
// Geração de prompt otimizado para REASONING
// =======================
function gerarPromptParaGroq(dados) {
  const infoViajante = {
    companhia: getCompanhiaText(dados.companhia || 0),
    preferencia: getPreferenciaText(dados.preferencia_viagem || 0),
    cidadeOrigem: dados.cidade_partida?.name || 'origem não especificada',
    orcamento: dados.orcamento_valor || 'flexível',
    moeda: dados.moeda_escolhida || 'BRL',
    pessoas: dados.quantidade_familia || dados.quantidade_amigos || 1,
    tipoDestino: dados.tipo_destino || 'qualquer',
    famaDestino: dados.fama_destino || 'qualquer'
  };
  
  // Processar datas
  let dataIda = 'não especificada';
  let dataVolta = 'não especificada';
  let duracaoViagem = 'não especificada';
  
  if (dados.datas) {
    if (typeof dados.datas === 'string' && dados.datas.includes(',')) {
      const partes = dados.datas.split(',');
      dataIda = partes[0]?.trim() || 'não especificada';
      dataVolta = partes[1]?.trim() || 'não especificada';
    } else if (dados.datas.dataIda && dados.datas.dataVolta) {
      dataIda = dados.datas.dataIda;
      dataVolta = dados.datas.dataVolta;
    }
    
    try {
      if (dataIda !== 'não especificada' && dataVolta !== 'não especificada') {
        const ida = new Date(dataIda);
        const volta = new Date(dataVolta);
        const diff = Math.abs(volta - ida);
        duracaoViagem = `${Math.ceil(diff / (1000 * 60 * 60 * 24))} dias`;
      }
    } catch (error) {
      console.error('Erro ao calcular duração da viagem:', error.message);
    }
  }

  // NOVA SEÇÃO: Análise de orçamento e faixas realistas
  const orcamentoAnalise = {
    valor: infoViajante.orcamento,
    moeda: infoViajante.moeda,
    flexivel: infoViajante.orcamento === 'flexível',
    faixasRealistas: {}
  };

  if (!orcamentoAnalise.flexivel) {
    const orcamentoNum = parseFloat(infoViajante.orcamento);
    orcamentoAnalise.faixasRealistas = {
      'Nacional': utils.obterFaixaPrecos(infoViajante.cidadeOrigem, 'Nacional'),
      'América do Sul': utils.obterFaixaPrecos(infoViajante.cidadeOrigem, 'América do Sul'),
      'América do Norte': utils.obterFaixaPrecos(infoViajante.cidadeOrigem, 'América do Norte'),
      'Europa': utils.obterFaixaPrecos(infoViajante.cidadeOrigem, 'Europa'),
      'Ásia': utils.obterFaixaPrecos(infoViajante.cidadeOrigem, 'Ásia')
    };
  }

  return `# 🧠 SISTEMA DE RECOMENDAÇÃO INTELIGENTE DE DESTINOS - REASONING MODE

## 📊 DADOS DO VIAJANTE PARA ANÁLISE:
**Perfil Básico:**
- Origem: ${infoViajante.cidadeOrigem}
- Composição: ${infoViajante.companhia} (${infoViajante.pessoas} pessoa(s))
- Período: ${dataIda} a ${dataVolta} (${duracaoViagem})

## 💰 ANÁLISE CRÍTICA DE ORÇAMENTO - EXTREMAMENTE IMPORTANTE!

**ORÇAMENTO MÁXIMO PARA VOOS DE IDA E VOLTA:** ${infoViajante.orcamento} ${infoViajante.moeda}

${!orcamentoAnalise.flexivel ? `
⚠️  **RESTRIÇÃO ORÇAMENTÁRIA ABSOLUTA** ⚠️
- A SOMA DOS VOOS DE IDA E VOLTA NÃO PODEM custar mais que ${infoViajante.orcamento} ${infoViajante.moeda}
- Tolerância máxima: 10% (${Math.round(parseFloat(infoViajante.orcamento) * 1.1)} ${infoViajante.moeda})
- Se não conseguir respeitar o orçamento, REDUZA o alcance geográfico dos destinos

**FAIXAS REALISTAS DE PREÇOS DE VOO SAINDO DE ${infoViajante.cidadeOrigem}:**
- 🇧🇷 Destinos Nacionais: R$ 300-800 (média R$ 500)
- 🌎 América do Sul: R$ 800-1.800 (média R$ 1.200)  
- 🌎 América do Norte: R$ 1.500-3.500 (média R$ 2.200)
- 🌍 Europa: R$ 1.800-4.000 (média R$ 2.500)
- 🌏 Ásia: R$ 2.200-5.000 (média R$ 3.000)
- 🌏 Oceania: R$ 3.000-6.000 (média R$ 4.000)

**INSTRUÇÕES OBRIGATÓRIAS:**
1. Se orçamento ≤ R$ 1.000: APENAS destinos nacionais e América do Sul próxima
2. Se orçamento ≤ R$ 2.000: Máximo até América do Norte ou Europa básica
3. Se orçamento ≤ R$ 3.000: Europa e algumas opções asiáticas
4. Se orçamento > R$ 3.000: Pode considerar destinos mais distantes

**EXEMPLO DE COMO RESPEITAR ORÇAMENTO DE ${infoViajante.orcamento} ${infoViajante.moeda}:**
${parseFloat(infoViajante.orcamento) <= 1000 ? 
  '- Buenos Aires: R$ 900, Santiago: R$ 950, Salvador: R$ 400' :
parseFloat(infoViajante.orcamento) <= 2000 ?
  '- Lisboa: R$ 1.800, México: R$ 1.600, Miami: R$ 1.700' :
  '- Paris: R$ 2.400, Tóquio: R$ 2.800, Dubai: R$ 2.200'}` :
'**ORÇAMENTO FLEXÍVEL** - Pode sugerir destinos variados, mas mantenha preços realistas'}

**Preferências Declaradas:**
- Atividades preferidas: ${infoViajante.preferencia}
- Tipo de destino: ${getTipoDestinoText(infoViajante.tipoDestino)}
- Popularidade desejada: ${getFamaDestinoText(infoViajante.famaDestino)}

## 🎯 PROCESSO DE RACIOCÍNIO OBRIGATÓRIO:

### PASSO 1: ANÁLISE DO PERFIL DO VIAJANTE
Analise profundamente:
- Que tipo de experiências esse perfil de viajante valoriza?
- Quais destinos se alinham com suas preferências específicas?
- Que adaptações são necessárias para ${infoViajante.companhia}?

### PASSO 2: **FILTRO RIGOROSO DE ORÇAMENTO** 🚨
${!orcamentoAnalise.flexivel ? `
**ESTA É A ETAPA MAIS CRÍTICA:**
- Elimine IMEDIATAMENTE qualquer destino com o valor da soma dos voos de ida e volta > ${Math.round(parseFloat(infoViajante.orcamento) * 1.1)} ${infoViajante.moeda}
- Priorize destinos na faixa de ${Math.round(parseFloat(infoViajante.orcamento) * 0.8)}-${infoViajante.orcamento} ${infoViajante.moeda}
- Se não encontrar destinos suficientes, REDUZA o alcance geográfico
- NÃO SUGIRA destinos "quase no orçamento" - seja rigoroso!` :
'Mantenha preços realistas mesmo com orçamento flexível'}

### PASSO 3: MAPEAMENTO DE DESTINOS COMPATÍVEIS
Para cada destino considerado, avalie:
- Adequação às preferências declaradas (${infoViajante.preferencia})
- **VIABILIDADE ORÇAMENTÁRIA CONFIRMADA**
- Conveniência para ${infoViajante.companhia}
- Atratividade no período ${dataIda} a ${dataVolta}

### PASSO 4: VALIDAÇÃO CLIMÁTICA E SAZONAL
Para as datas ${dataIda} a ${dataVolta}, determine:
- Estação do ano em cada destino considerado
- Condições climáticas típicas (temperatura, chuva, etc.)
- Eventos/festivais especiais no período
- Recomendações práticas de vestuário/equipamentos

### PASSO 5: SELEÇÃO E RANQUEAMENTO
Baseado na análise acima, selecione:
- 1 destino TOP que melhor combina com TODOS os critérios **E RESPEITA O ORÇAMENTO**
- 4 alternativas diversificadas geograficamente **TODAS DENTRO DO ORÇAMENTO**
- 1 surpresa que pode surpreender positivamente **SEM EXCEDER O ORÇAMENTO**

### PASSO 6: PERSONALIZAÇÃO TRIPINHA 🐾
Para cada destino selecionado, adicione:
- Comentário em 1ª pessoa da Tripinha sobre SUA experiência no local
- Detalhes sensoriais que uma cachorrinha notaria (sons, cheiros, texturas)
- Dicas práticas baseadas nas "aventuras" da Tripinha
- Pontos turísticos específicos que ela "visitou"

## 📋 FORMATO DE RESPOSTA (JSON ESTRUTURADO):

\`\`\`json
{
  "raciocinio": {
    "analise_perfil": "Resumo da análise do perfil do viajante",
    "criterios_selecao": "Principais critérios usados na seleção",
    "consideracoes_orcamento": "DETALHE como o orçamento de ${infoViajante.orcamento} ${infoViajante.moeda} influenciou CADA escolha",
    "destinos_rejeitados": "Mencione destinos que foram rejeitados por exceder o orçamento"
  },
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País", 
    "codigoPais": "XX",
    "justificativa": "Por que este é o destino PERFEITO para este viajante específico",
    "justificativa_orcamento": "CONFIRME que o preço de R$ X está dentro do orçamento de ${infoViajante.orcamento} ${infoViajante.moeda}",
    "descricao": "Descrição detalhada do destino",
    "porque": "Razões específicas para esta recomendação",
    "destaque": "Experiência única do destino",
    "comentario": "Comentário entusiasmado da Tripinha em 1ª pessoa: 'Eu adorei quando visitei [destino]! O cheiro de... me deixou maluca! 🐾'",
    "pontosTuristicos": [
      "Nome específico do primeiro ponto turístico",
      "Nome específico do segundo ponto turístico"
    ],
    "eventos": ["Evento/festival específico no período se houver"],
    "clima": {
      "estacao": "Estação exata no destino durante ${dataIda} a ${dataVolta}",
      "temperatura": "Faixa de temperatura precisa (ex: 18°C-28°C)",
      "condicoes": "Condições climáticas detalhadas esperadas",
      "recomendacoes": "Dicas específicas do que levar/vestir"
    },
    "aeroporto": {
      "codigo": "XYZ",
      "nome": "Nome oficial do aeroporto principal"
    },
    "preco": {
      "voo": ${!orcamentoAnalise.flexivel ? `número_MÁXIMO_${Math.round(parseFloat(infoViajante.orcamento) * 1.1)}` : 'número_realista'},
      "hotel": número_estimado_por_noite,
      "justificativa_preco": "Explique por que este preço está correto e dentro do orçamento"
    }
  },
  "alternativas": [
    {
      "destino": "Nome da Cidade",
      "pais": "Nome do País",
      "codigoPais": "XX",
      "porque": "Razão específica para esta alternativa",
      "pontoTuristico": "Ponto turístico específico de destaque",
      "clima": {
        "estacao": "Estação no destino durante a viagem",
        "temperatura": "Faixa de temperatura"
      },
      "aeroporto": {"codigo": "XYZ", "nome": "Nome do Aeroporto"},
      "preco": {
        "voo": ${!orcamentoAnalise.flexivel ? `número_MÁXIMO_${Math.round(parseFloat(infoViajante.orcamento) * 1.1)}` : 'número_realista'},
        "hotel": número
      }
    }
    // EXATAMENTE 4 alternativas geograficamente diversas - TODAS COM PREÇOS DENTRO DO ORÇAMENTO
  ],
  "surpresa": {
    "destino": "Nome da Cidade Inusitada",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "justificativa": "Por que é uma surpresa perfeita para este perfil",
    "justificativa_orcamento": "CONFIRME que mesmo sendo surpresa, está dentro do orçamento",
    "descricao": "Descrição do destino surpresa",
    "porque": "Razões para ser destino surpresa",
    "destaque": "Experiência única e inesperada",
    "comentario": "Comentário empolgado da Tripinha: 'Nossa, quando cheguei em [destino], não esperava que... 🐾'",
    "pontosTuristicos": ["Primeiro ponto específico", "Segundo ponto específico"],
    "clima": {
      "estacao": "Estação durante ${dataIda} a ${dataVolta}",
      "temperatura": "Faixa de temperatura",
      "condicoes": "Condições climáticas",
      "recomendacoes": "Dicas de vestuário"
    },
    "aeroporto": {"codigo": "XYZ", "nome": "Nome do Aeroporto"},
    "preco": {
      "voo": ${!orcamentoAnalise.flexivel ? `número_MÁXIMO_${Math.round(parseFloat(infoViajante.orcamento) * 1.1)}` : 'número_realista'},
      "hotel": número
    }
  },
  "estacaoViagem": "Estação predominante nos destinos selecionados",
  "resumoIA": "Resumo de como a IA chegou às recomendações respeitando rigorosamente o orçamento"
}
\`\`\`

## 🔍 VALIDAÇÃO FINAL OBRIGATÓRIA:
Antes de responder, confirme que:
${!orcamentoAnalise.flexivel ? `
- 🚨 **CRÍTICO:** TODOS os preços de voo estão ≤ ${Math.round(parseFloat(infoViajante.orcamento) * 1.1)} ${infoViajante.moeda}
- 🚨 **CRÍTICO:** Nenhum destino excede o orçamento de ${infoViajante.orcamento} ${infoViajante.moeda}
- 💰 Justificou como cada preço respeita o orçamento` :
'- 💰 Todos os preços são realistas e justificados'}
- ✅ Informações climáticas são precisas para o período da viagem  
- ✅ Comentários da Tripinha são autênticos e em 1ª pessoa
- ✅ Pontos turísticos são específicos e reais
- ✅ Códigos IATA dos aeroportos estão corretos
- ✅ Destinos são adequados para ${infoViajante.companhia}

**Execute o raciocínio passo-a-passo e forneça recomendações fundamentadas que RESPEITEM RIGOROSAMENTE O ORÇAMENTO!**`;
}

// =======================
// Funções auxiliares de texto
// =======================
function getCompanhiaText(value) {
  const options = {
    0: "sozinho(a)",
    1: "em casal (viagem romântica)", 
    2: "em família",
    3: "com amigos"
  };
  return options[typeof value === 'string' ? parseInt(value, 10) : value] || "sozinho(a)";
}

function getPreferenciaText(value) {
  const options = {
    0: "relaxamento e descanso",
    1: "aventura e atividades ao ar livre",
    2: "cultura, história e gastronomia", 
    3: "experiência urbana, compras e vida noturna"
  };
  return options[typeof value === 'string' ? parseInt(value, 10) : value] || "experiências diversificadas";
}

function getTipoDestinoText(value) {
  const options = {
    0: "nacional",
    1: "internacional", 
    2: "qualquer (nacional ou internacional)"
  };
  return options[typeof value === 'string' ? parseInt(value, 10) : value] || "qualquer";
}

function getFamaDestinoText(value) {
  const options = {
    0: "famoso e turístico",
    1: "fora do circuito turístico comum",
    2: "mistura de ambos"
  };
  return options[typeof value === 'string' ? parseInt(value, 10) : value] || "qualquer";
}

// =======================
// Nova função para filtrar destinos por orçamento
// =======================
function filtrarDestinosPorOrcamento(jsonString, orcamentoMax, moeda = 'BRL') {
  if (!orcamentoMax || orcamentoMax === 'flexível') return jsonString;
  
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    const orcamentoNum = parseFloat(orcamentoMax);
    const tolerancia = 1.1; // 10% de tolerância
    const limite = orcamentoNum * tolerancia;
    
    console.log(`🔍 Filtrando destinos com orçamento máximo: ${limite} ${moeda}`);
    
    let modificado = false;
    
    // Filtrar topPick
    if (data.topPick?.preco?.voo && parseFloat(data.topPick.preco.voo) > limite) {
      console.log(`❌ TopPick ${data.topPick.destino} removido: R$ ${data.topPick.preco.voo} > R$ ${limite}`);
      data.topPick = null;
      modificado = true;
    }
    
    // Filtrar alternativas
    if (data.alternativas && Array.isArray(data.alternativas)) {
      const alternativasOriginais = data.alternativas.length;
      data.alternativas = data.alternativas.filter(alt => {
        if (alt.preco?.voo && parseFloat(alt.preco.voo) > limite) {
          console.log(`❌ Alternativa ${alt.destino} removida: R$ ${alt.preco.voo} > R$ ${limite}`);
          return false;
        }
        return true;
      });
      if (data.alternativas.length < alternativasOriginais) modificado = true;
    }
    
    // Filtrar surpresa
    if (data.surpresa?.preco?.voo && parseFloat(data.surpresa.preco.voo) > limite) {
      console.log(`❌ Surpresa ${data.surpresa.destino} removida: R$ ${data.surpresa.preco.voo} > R$ ${limite}`);
      data.surpresa = null;
      modificado = true;
    }
    
    if (modificado) {
      console.log('✂️ Destinos filtrados por orçamento - alguns destinos foram removidos');
      data.observacaoOrcamento = `Alguns destinos foram automaticamente removidos por excederem o orçamento de ${orcamentoMax} ${moeda}`;
    }
    
    return JSON.stringify(data);
  } catch (error) {
    console.error('Erro ao filtrar destinos por orçamento:', error.message);
    return jsonString;
  }
}

// =======================
// Processamento e validação de destinos
// =======================
function ensureValidDestinationData(jsonString, requestData) {
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    let modificado = false;
    
    // Garantir códigos IATA para topPick
    if (data.topPick && !data.topPick.aeroporto?.codigo) {
      data.topPick.aeroporto = {
        codigo: obterCodigoIATAPadrao(data.topPick.destino, data.topPick.pais),
        nome: `Aeroporto de ${data.topPick.destino}`
      };
      modificado = true;
    }
    
    // Garantir códigos IATA para surpresa
    if (data.surpresa && !data.surpresa.aeroporto?.codigo) {
      data.surpresa.aeroporto = {
        codigo: obterCodigoIATAPadrao(data.surpresa.destino, data.surpresa.pais),
        nome: `Aeroporto de ${data.surpresa.destino}`
      };
      modificado = true;
    }
    
    // Garantir códigos IATA para alternativas
    if (data.alternativas && Array.isArray(data.alternativas)) {
      data.alternativas.forEach(alternativa => {
        if (!alternativa.aeroporto?.codigo) {
          alternativa.aeroporto = {
            codigo: obterCodigoIATAPadrao(alternativa.destino, alternativa.pais),
            nome: `Aeroporto de ${alternativa.destino}`
          };
          modificado = true;
        }
      });
    }
    
    return modificado ? JSON.stringify(data) : jsonString;
  } catch (error) {
    console.error("Erro ao processar dados de destino:", error);
    return jsonString;
  }
}

// =======================
// Função de retry com fallback inteligente entre modelos
// =======================
async function retryWithBackoffAndFallback(prompt, requestData, maxAttempts = CONFIG.retries) {
  const modelOrder = [
    CONFIG.groq.models.reasoning,     // Primeiro: DeepSeek R1 (melhor qualidade)
    CONFIG.groq.models.personality,  // Segundo: Llama 3.3 70B (personalidade)
    CONFIG.groq.models.fast          // Terceiro: Llama 3.1 8B (backup rápido)
  ];
  
  for (const model of modelOrder) {
    console.log(`🔄 Tentando modelo: ${model}`);
    
    let attempt = 1;
    let delay = 1500;
    
    while (attempt <= maxAttempts) {
      try {
        console.log(`🔄 Modelo ${model} - Tentativa ${attempt}/${maxAttempts}...`);
        
        const result = await callGroqAPI(prompt, requestData, model);
        
        if (result && utils.isValidDestinationJSON(result, requestData)) {
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
      delay = Math.min(delay * 1.2, 5000); // Backoff mais suave
      attempt++;
    }
  }
  
  console.log('🚫 Todos os modelos falharam');
  return null;
}

// =======================
// Handler principal da API
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
  }, 350000); // 350s - Aumentado para acomodar reasoning model

  // Headers CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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
    console.log('🧠 === BENETRIP GROQ REASONING API v6.0 ===');
    
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
    
    // Log dos dados recebidos
    utils.log('📊 Dados da requisição:', {
      companhia: requestData.companhia,
      cidade_partida: requestData.cidade_partida?.name,
      datas: requestData.datas,
      orcamento: requestData.orcamento_valor,
      moeda: requestData.moeda_escolhida
    });
    
    // Gerar prompt otimizado para Groq
    const prompt = gerarPromptParaGroq(requestData);
    console.log('📝 Prompt gerado para Groq');
    
    // Tentar obter recomendações com fallback inteligente entre modelos
    const resultado = await retryWithBackoffAndFallback(prompt, requestData);
    
    if (!resultado) {
      console.error('🚫 Falha em todos os modelos do Groq');
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(503).json({
          tipo: "erro",
          message: "Não foi possível obter recomendações no momento. Tente novamente em alguns instantes.",
          error: "groq_all_models_failed"
        });
      }
      return;
    }
    
    const { result: recomendacoesBrutas, model: modeloUsado } = resultado;
    
    // NOVA ETAPA: Filtrar destinos por orçamento
    console.log('💰 Aplicando filtro de orçamento...');
    const recomendacoesFiltradas = filtrarDestinosPorOrcamento(
      recomendacoesBrutas, 
      requestData.orcamento_valor, 
      requestData.moeda_escolhida || 'BRL'
    );
    
    // Processar e retornar resultado
    try {
      const recomendacoesProcessadas = ensureValidDestinationData(recomendacoesFiltradas, requestData);
      const dados = typeof recomendacoesProcessadas === 'string' ? 
        JSON.parse(recomendacoesProcessadas) : recomendacoesProcessadas;
      
      // Adicionar metadados incluindo modelo usado
      dados.metadados = {
        modelo: modeloUsado,
        provider: 'groq',
        versao: '6.0-reasoning-budget',
        timestamp: new Date().toISOString(),
        reasoning_enabled: modeloUsado === CONFIG.groq.models.reasoning,
        orcamento_filtrado: !!dados.observacaoOrcamento,
        orcamento_maximo: requestData.orcamento_valor
      };
      
      console.log('🎉 Recomendações processadas com sucesso!');
      console.log('🧠 Modelo usado:', modeloUsado);
      console.log('💰 Orçamento respeitado:', requestData.orcamento_valor);
      console.log('📋 Destinos encontrados:', {
        topPick: dados.topPick?.destino,
        topPickPreco: dados.topPick?.preco?.voo,
        alternativas: dados.alternativas?.length || 0,
        surpresa: dados.surpresa?.destino,
        surpresaPreco: dados.surpresa?.preco?.voo,
        temRaciocinio: !!dados.raciocinio,
        filtradoPorOrcamento: !!dados.observacaoOrcamento
      });
      
      // Verificação final de orçamento
      if (requestData.orcamento_valor && requestData.orcamento_valor !== 'flexível') {
        const orcamentoMax = parseFloat(requestData.orcamento_valor);
        const violacoes = [];
        
        if (dados.topPick?.preco?.voo && parseFloat(dados.topPick.preco.voo) > orcamentoMax * 1.1) {
          violacoes.push(`topPick: R$ ${dados.topPick.preco.voo}`);
        }
        
        if (dados.alternativas) {
          dados.alternativas.forEach((alt, i) => {
            if (alt.preco?.voo && parseFloat(alt.preco.voo) > orcamentoMax * 1.1) {
              violacoes.push(`alt${i+1}: R$ ${alt.preco.voo}`);
            }
          });
        }
        
        if (violacoes.length > 0) {
          console.log(`⚠️ ATENÇÃO: Ainda há violações de orçamento:`, violacoes);
        } else {
          console.log(`✅ ORÇAMENTO RESPEITADO: Todos os destinos ≤ R$ ${orcamentoMax}`);
        }
      }
      
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(200).json({
          tipo: "groq_reasoning_budget_success",
          modelo: modeloUsado,
          orcamento_controlado: true,
          conteudo: JSON.stringify(dados)
        });
      }
      
    } catch (processError) {
      console.error('❌ Erro ao processar resposta final:', processError.message);
      
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(200).json({
          tipo: "groq_partial_success",
          modelo: modeloUsado,
          conteudo: recomendacoesFiltradas
        });
      }
    }
    
  } catch (globalError) {
    console.error('💥 Erro global:', globalError.message);
    
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
