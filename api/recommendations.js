// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
// Versão 8.1 - ENHANCED - Limite ajustado para viagens rodoviárias (700km/10h)
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
      reasoning: 'openai/gpt-oss-120b',     // Reasoning principal
      personality: 'llama-3.3-70b-versatile',         // Personalidade Tripinha
      fast: 'llama-3.1-8b-instant',                   // Backup rápido
      toolUse: 'llama3-groq-70b-8192-tool-use-preview' // APIs futuras
    },
    timeout: 180000,     // 3 minutos para reasoning
    maxTokens: 3500,     // Reduzido pois não precisa de preços
    temperature: 0.6     // Focado para análise
  },
  retries: 2,
  logging: {
    enabled: true,
    maxLength: 600
  },
  budgetThreshold: 401,  // Limite para viagens rodoviárias
  busTravel: {
    maxDistance: 700,    // Distância máxima em km
    maxHours: 10        // Tempo máximo em horas
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
// Funções utilitárias
// =======================
const utils = {
  validarCodigoIATA: codigo => codigo && /^[A-Z]{3}$/.test(codigo),
  
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

  // Determinar tipo de viagem baseado no orçamento
  determinarTipoViagem: (orcamento, moeda) => {
    if (!orcamento || orcamento === 'flexível') return 'aereo';
    
    let valorEmBRL = parseFloat(orcamento);
    
    // Converter para BRL se necessário
    if (moeda && moeda !== 'BRL') {
      const taxasConversao = {
        'USD': 5.0,
        'EUR': 5.5,
        'GBP': 6.3,
        'JPY': 0.033
      };
      valorEmBRL = valorEmBRL * (taxasConversao[moeda] || 5.0);
    }
    
    return valorEmBRL < CONFIG.budgetThreshold ? 'rodoviario' : 'aereo';
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
      
      // Validação específica para modelo de reasoning
      const hasReasoningData = data.raciocinio && typeof data.raciocinio === 'object';
      if (hasReasoningData) {
        console.log('🧠 Dados de raciocínio detectados:', Object.keys(data.raciocinio));
      }
      
      console.log('✅ Validação passou');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao validar JSON de destino:', error.message);
      return false;
    }
  }
};

// =======================
// Mapeamento de códigos IATA e Rodoviárias
// =======================
function obterCodigoIATAPadrao(cidade, pais) {
  const mapeamentoIATA = {
    // Principais destinos brasileiros
    'São Paulo': 'GRU', 'Rio de Janeiro': 'GIG', 'Brasília': 'BSB',
    'Salvador': 'SSA', 'Fortaleza': 'FOR', 'Recife': 'REC',
    'Porto Alegre': 'POA', 'Belém': 'BEL', 'Manaus': 'MAO',
    'Belo Horizonte': 'CNF', 'Curitiba': 'CWB', 'Florianópolis': 'FLN',
    
    // América do Sul
    'Buenos Aires': 'EZE', 'Santiago': 'SCL', 'Lima': 'LIM',
    'Bogotá': 'BOG', 'Cartagena': 'CTG', 'Medellín': 'MDE',
    'Montevidéu': 'MVD', 'La Paz': 'LPB', 'Cusco': 'CUZ',
    'Quito': 'UIO', 'Caracas': 'CCS', 'Asunción': 'ASU',
    
    // América do Norte
    'Nova York': 'JFK', 'Los Angeles': 'LAX', 'Miami': 'MIA',
    'Cidade do México': 'MEX', 'Cancún': 'CUN', 'Toronto': 'YYZ',
    'Vancouver': 'YVR', 'Montreal': 'YUL', 'Chicago': 'ORD',
    'San Francisco': 'SFO', 'Washington': 'DCA', 'Boston': 'BOS',
    
    // Europa
    'Londres': 'LHR', 'Paris': 'CDG', 'Roma': 'FCO',
    'Madri': 'MAD', 'Lisboa': 'LIS', 'Barcelona': 'BCN',
    'Amsterdã': 'AMS', 'Berlim': 'BER', 'Munique': 'MUC',
    'Porto': 'OPO', 'Praga': 'PRG', 'Viena': 'VIE',
    'Dublin': 'DUB', 'Atenas': 'ATH', 'Budapeste': 'BUD',
    
    // Ásia & Oceania
    'Tóquio': 'HND', 'Dubai': 'DXB', 'Singapura': 'SIN',
    'Bangkok': 'BKK', 'Hong Kong': 'HKG', 'Sydney': 'SYD',
    'Melbourne': 'MEL', 'Auckland': 'AKL', 'Seoul': 'ICN'
  };
  
  const nomeLower = cidade.toLowerCase();
  
  for (const [cidadeMap, codigo] of Object.entries(mapeamentoIATA)) {
    if (nomeLower.includes(cidadeMap.toLowerCase())) return codigo;
  }
  
  // Fallback: primeira letra do país + duas da cidade
  return (pais.charAt(0) + cidade.substring(0, 2)).toUpperCase();
}

function obterNomeRodoviariaPadrao(cidade) {
  const mapeamentoRodoviarias = {
    // Principais cidades brasileiras
    'São Paulo': 'Terminal Rodoviário Tietê',
    'Rio de Janeiro': 'Rodoviária Novo Rio',
    'Belo Horizonte': 'Terminal Rodoviário Gov. Israel Pinheiro',
    'Brasília': 'Rodoviária do Plano Piloto',
    'Salvador': 'Terminal Rodoviário de Salvador',
    'Recife': 'Terminal Integrado de Passageiros (TIP)',
    'Fortaleza': 'Terminal Rodoviário Engenheiro João Thomé',
    'Porto Alegre': 'Estação Rodoviária de Porto Alegre',
    'Curitiba': 'Rodoferroviária de Curitiba',
    'Florianópolis': 'Terminal Rodoviário Rita Maria',
    'Goiânia': 'Terminal Rodoviário de Goiânia',
    'Campinas': 'Terminal Rodoviário de Campinas',
    'Campo Grande': 'Terminal Rodoviário de Campo Grande',
    'Natal': 'Terminal Rodoviário de Natal',
    'João Pessoa': 'Terminal Rodoviário de João Pessoa',
    'Maceió': 'Terminal Rodoviário de Maceió',
    'Vitória': 'Terminal Rodoviário de Vitória',
    'Santos': 'Terminal Rodoviário de Santos',
    'Ribeirão Preto': 'Terminal Rodoviário de Ribeirão Preto',
    'Uberlândia': 'Terminal Rodoviário de Uberlândia',
    'Londrina': 'Terminal Rodoviário de Londrina',
    'Joinville': 'Terminal Rodoviário Harold Nielson',
    'Blumenau': 'Terminal Rodoviário de Blumenau',
    'Maringá': 'Terminal Rodoviário de Maringá',
    
    // Cidades turísticas próximas (até 700km de distância das capitais)
    'Foz do Iguaçu': 'Terminal de Transporte Urbano',
    'Paraty': 'Rodoviária de Paraty',
    'Búzios': 'Rodoviária de Búzios',
    'Gramado': 'Rodoviária de Gramado',
    'Canela': 'Estação Rodoviária de Canela',
    'Campos do Jordão': 'Rodoviária de Campos do Jordão',
    'Ouro Preto': 'Rodoviária de Ouro Preto',
    'Tiradentes': 'Rodoviária de Tiradentes',
    'Petrópolis': 'Terminal Rodoviário Leonel Brizola',
    'Angra dos Reis': 'Rodoviária de Angra dos Reis',
    'Ilhabela': 'Rodoviária de Ilhabela',
    'Guarujá': 'Rodoviária de Guarujá',
    'Balneário Camboriú': 'Terminal Rodoviário de Balneário Camboriú',
    'Bombinhas': 'Terminal Rodoviário de Bombinhas',
    'Porto Seguro': 'Rodoviária de Porto Seguro',
    'Arraial do Cabo': 'Rodoviária de Arraial do Cabo',
    'Cabo Frio': 'Rodoviária de Cabo Frio',
    'Bonito': 'Terminal Rodoviário de Bonito',
    'Caldas Novas': 'Rodoviária de Caldas Novas',
    'São Lourenço': 'Terminal Rodoviário de São Lourenço',
    'Poços de Caldas': 'Terminal Rodoviário de Poços de Caldas',
    'Aparecida': 'Terminal Rodoviário de Aparecida',
    'Guarapari': 'Terminal Rodoviário de Guarapari',
    'Águas de Lindóia': 'Rodoviária de Águas de Lindóia',
    'Holambra': 'Terminal Rodoviário de Holambra',
    'Penedo': 'Rodoviária de Penedo',
    'Pirenópolis': 'Terminal Rodoviário de Pirenópolis'
  };
  
  const nomeLower = cidade.toLowerCase();
  
  for (const [cidadeMap, nomeRodoviaria] of Object.entries(mapeamentoRodoviarias)) {
    if (nomeLower.includes(cidadeMap.toLowerCase())) return nomeRodoviaria;
  }
  
  // Fallback genérico
  return `Terminal Rodoviário de ${cidade}`;
}

// =======================
// Função para chamada ao Groq - REASONING OPTIMIZED
// =======================
async function callGroqAPI(prompt, requestData, model = CONFIG.groq.models.reasoning) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('Chave da API Groq não configurada (GROQ_API_KEY)');
  }

  const tipoViagem = utils.determinarTipoViagem(requestData.orcamento_valor, requestData.moeda_escolhida);

  let systemMessage;
  
  if (model === CONFIG.groq.models.reasoning) {
    // Sistema otimizado para reasoning
    systemMessage = `Você é um sistema especialista em recomendações de viagem que utiliza raciocínio estruturado.
${tipoViagem === 'rodoviario' ? 'ESPECIALIZADO EM VIAGENS RODOVIÁRIAS DE ÔNIBUS COM LIMITE DE 700KM OU 10 HORAS.' : ''}

PROCESSO DE RACIOCÍNIO OBRIGATÓRIO:
1. ANÁLISE DO PERFIL: Examine detalhadamente cada preferência do viajante
2. MAPEAMENTO DE COMPATIBILIDADE: Correlacione destinos com o perfil analisado  
3. CONSIDERAÇÃO DE ORÇAMENTO: ${tipoViagem === 'rodoviario' ? 'Considere viagens de ÔNIBUS dentro do orçamento limitado (máx 700km/10h)' : 'Considere o orçamento informado para passagens aéreas'}
4. ANÁLISE CLIMÁTICA: Determine condições climáticas exatas para as datas
5. PERSONALIZAÇÃO TRIPINHA: Adicione perspectiva autêntica da mascote cachorrinha

CRITÉRIOS DE DECISÃO:
- Destinos DEVEM ser adequados para o tipo de companhia especificado
- ${tipoViagem === 'rodoviario' ? 'Destinos DEVEM estar a NO MÁXIMO 700km ou 10 horas de ônibus da origem' : 'Informações de voos DEVEM ser consideradas'}
- Informações climáticas DEVEM ser precisas para o período da viagem
- Pontos turísticos DEVEM ser específicos e reais
- Comentários da Tripinha DEVEM ser em 1ª pessoa com detalhes sensoriais
- Considere a distância e facilidade de acesso a partir da cidade de origem

RESULTADO: JSON estruturado com recomendações fundamentadas no raciocínio acima.`;
  } else if (model === CONFIG.groq.models.personality) {
    // Sistema focado na personalidade da Tripinha
    systemMessage = `Você é a Tripinha, uma vira-lata caramelo especialista em viagens! 🐾
${tipoViagem === 'rodoviario' ? 'ESPECIALISTA EM VIAGENS DE ÔNIBUS DE ATÉ 700KM!' : ''}

PERSONALIDADE DA TRIPINHA:
- Conhece todos os destinos do mundo pessoalmente
- ${tipoViagem === 'rodoviario' ? 'Adora viagens de ônibus curtas e médias (até 10h)!' : 'Adora viagens de avião e conhece todos os aeroportos!'}
- Fala sempre em 1ª pessoa sobre suas experiências
- É entusiasmada, carismática e usa emojis naturalmente  
- Inclui detalhes sensoriais que um cachorro notaria
- Sempre menciona pontos turísticos específicos que visitou
- Dá dicas práticas baseadas nas suas "aventuras"

RETORNE APENAS JSON VÁLIDO sem formatação markdown.`;
  } else {
    // Sistema padrão para modelos rápidos
    systemMessage = `Especialista em recomendações de viagem ${tipoViagem === 'rodoviario' ? 'RODOVIÁRIA (máx 700km)' : 'AÉREA'}. Retorne apenas JSON válido com destinos personalizados.`;
  }

  try {
    utils.log(`🧠 Enviando requisição para Groq (${model}) - Tipo: ${tipoViagem}...`);
    
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
// Geração de prompt otimizado para viagens rodoviárias e aéreas
// =======================
function gerarPromptParaGroq(dados) {
  const infoViajante = {
    companhia: getCompanhiaText(dados.companhia || 0),
    preferencia: getPreferenciaText(dados.preferencia_viagem || 0),
    cidadeOrigem: dados.cidade_partida?.name || dados.cidade_partida || 'cidade não especificada',
    orcamento: dados.orcamento_valor || 'flexível',
    moeda: dados.moeda_escolhida || 'BRL',
    pessoas: dados.quantidade_familia || dados.quantidade_amigos || 1
  };
  
  // Determinar tipo de viagem baseado no orçamento
  const tipoViagem = utils.determinarTipoViagem(infoViajante.orcamento, infoViajante.moeda);
  const isRodoviario = tipoViagem === 'rodoviario';
  
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

  // Prompt diferenciado para viagens rodoviárias
  if (isRodoviario) {
    return `# 🚌 SISTEMA DE RECOMENDAÇÃO INTELIGENTE DE VIAGENS RODOVIÁRIAS

## 📊 DADOS DO VIAJANTE PARA ANÁLISE:
**Perfil Básico:**
- Origem: ${infoViajante.cidadeOrigem}
- Composição: ${infoViajante.companhia} (${infoViajante.pessoas} pessoa(s))
- Período: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Preferência principal: ${infoViajante.preferencia}

## 💰 ORÇAMENTO PARA VIAGEM RODOVIÁRIA:
**Orçamento informado:** ${infoViajante.orcamento} ${infoViajante.moeda} por pessoa para passagens de ÔNIBUS (ida e volta)

⚠️ **IMPORTANTE - LIMITES DA VIAGEM RODOVIÁRIA:**
- APENAS destinos acessíveis por ÔNIBUS a partir de ${infoViajante.cidadeOrigem}
- **DISTÂNCIA MÁXIMA: 700 QUILÔMETROS**
- **TEMPO MÁXIMO DE VIAGEM: 10 HORAS DE ÔNIBUS**
- Priorize destinos dentro do mesmo estado ou estados vizinhos
- Considere o conforto da viagem de ônibus para ${infoViajante.companhia}
- Sugira destinos onde o valor das passagens de ônibus caiba no orçamento

## 🎯 PROCESSO DE RACIOCÍNIO PARA VIAGEM RODOVIÁRIA:

### PASSO 1: ANÁLISE DO PERFIL DO VIAJANTE
Analise profundamente:
- Que tipo de experiências esse perfil valoriza (${infoViajante.preferencia})?
- Quais destinos RODOVIÁRIOS (máx 700km) se alinham com suas preferências?
- Como tornar a viagem de ônibus confortável para ${infoViajante.companhia}?

### PASSO 2: CONSIDERAÇÃO DE ROTAS RODOVIÁRIAS (MÁXIMO 700KM)
- Avalie destinos alcançáveis por ônibus em até 10 horas a partir de ${infoViajante.cidadeOrigem}
- Considere apenas cidades dentro do raio de 700km
- Priorize destinos com boa infraestrutura rodoviária
- Pense em paradas interessantes durante o trajeto
- Calcule tempo real de viagem (máximo 10 horas por trecho)

### PASSO 3: MAPEAMENTO DE DESTINOS PRÓXIMOS
Para cada destino considerado, avalie:
- Distância rodoviária EXATA a partir de ${infoViajante.cidadeOrigem} (deve ser ≤ 700km)
- Tempo de viagem EXATO (deve ser ≤ 10 horas)
- Qualidade da infraestrutura rodoviária
- Empresas de ônibus que fazem a rota
- Custo estimado das passagens de ônibus

### PASSO 4: VALIDAÇÃO CLIMÁTICA E SAZONAL
Para as datas ${dataIda} a ${dataVolta}, determine:
- Condições das estradas no período
- Clima nos destinos
- Eventos regionais ou festivais locais

### PASSO 5: SELEÇÃO DE DESTINOS RODOVIÁRIOS PRÓXIMOS
Selecione APENAS destinos dentro do limite de 700km/10h:
- 1 destino TOP acessível por ônibus (máx 700km)
- 4 alternativas rodoviárias diversificadas (todas ≤ 700km)
- 1 surpresa rodoviária inusitada (máx 700km)

### PASSO 6: PERSONALIZAÇÃO TRIPINHA 🐾
Para cada destino, adicione:
- Comentário sobre a viagem de ônibus pela Tripinha
- Dicas sobre as rodoviárias
- Experiências nas paradas do trajeto

## 📋 FORMATO DE RESPOSTA (JSON ESTRUTURADO):

\`\`\`json
{
  "tipoViagem": "rodoviario",
  "raciocinio": {
    "analise_perfil": "Análise considerando viagem de ônibus de até 700km",
    "rotas_consideradas": "Principais rotas rodoviárias analisadas (todas ≤ 700km)",
    "criterios_selecao": "Critérios para destinos rodoviários próximos"
  },
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Brasil", 
    "codigoPais": "BR",
    "distanciaRodoviaria": "XXX km (MÁXIMO 700km)",
    "tempoViagem": "X horas de ônibus (MÁXIMO 10h)",
    "justificativa": "Por que este destino próximo é PERFEITO para viagem de ônibus",
    "descricao": "Descrição do destino",
    "porque": "Razões específicas para esta recomendação rodoviária",
    "destaque": "Experiência única do destino",
    "comentario": "Comentário da Tripinha: 'Adorei a viagem de ônibus para [destino]! São apenas X horas, super tranquilo! 🚌🐾'",
    "pontosTuristicos": [
      "Ponto turístico 1",
      "Ponto turístico 2"
    ],
    "dicasRodoviarias": "Dicas sobre a viagem de ônibus e rodoviárias",
    "empresasOnibus": ["Empresa 1", "Empresa 2"],
    "clima": {
      "estacao": "Estação durante a viagem",
      "temperatura": "Faixa de temperatura",
      "condicoes": "Condições climáticas",
      "recomendacoes": "O que levar"
    },
    "rodoviaria": {
      "nome": "Nome da Rodoviária Principal",
      "localizacao": "Bairro/Região da rodoviária"
    }
  },
  "alternativas": [
    {
      "destino": "Nome da Cidade",
      "pais": "Brasil",
      "codigoPais": "BR",
      "distanciaRodoviaria": "XXX km (≤ 700km)",
      "tempoViagem": "X horas (≤ 10h)",
      "porque": "Razão para esta alternativa rodoviária próxima",
      "pontoTuristico": "Principal atração",
      "empresaOnibus": "Principal empresa de ônibus",
      "clima": {
        "estacao": "Estação",
        "temperatura": "Temperatura"
      },
      "rodoviaria": {
        "nome": "Nome da Rodoviária"
      }
    }
    // EXATAMENTE 4 alternativas rodoviárias, TODAS ≤ 700km
  ],
  "surpresa": {
    "destino": "Cidade Surpresa Rodoviária",
    "pais": "Brasil",
    "codigoPais": "BR",
    "distanciaRodoviaria": "XXX km (MÁXIMO 700km)",
    "tempoViagem": "X horas (MÁXIMO 10h)",
    "justificativa": "Por que é uma surpresa perfeita de ônibus",
    "descricao": "Descrição",
    "porque": "Razões",
    "destaque": "Experiência única",
    "comentario": "Tripinha: 'Que aventura de ônibus tranquila! Apenas X horas! 🚌🐾'",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"],
    "clima": {
      "estacao": "Estação",
      "temperatura": "Temperatura",
      "condicoes": "Condições",
      "recomendacoes": "Dicas"
    },
    "rodoviaria": {
      "nome": "Nome da Rodoviária",
      "localizacao": "Localização"
    }
  },
  "dicasGeraisOnibus": "Dicas gerais para viagens de ônibus confortáveis de até 10 horas",
  "resumoIA": "Como foram selecionados os destinos rodoviários próximos (todos ≤ 700km)"
}
\`\`\`

⚠️ **VALIDAÇÃO CRÍTICA:**
- TODOS os destinos DEVEM estar a NO MÁXIMO 700km de ${infoViajante.cidadeOrigem}
- TODOS os tempos de viagem DEVEM ser de NO MÁXIMO 10 horas
- NÃO sugira destinos mais distantes que esses limites

**Execute o raciocínio e forneça destinos RODOVIÁRIOS PRÓXIMOS (máx 700km/10h)!**`;
  }

  // Prompt padrão para viagens aéreas (orçamento maior que R$ 400)
  return `# ✈️ SISTEMA DE RECOMENDAÇÃO INTELIGENTE DE DESTINOS AÉREOS

## 📊 DADOS DO VIAJANTE PARA ANÁLISE:
**Perfil Básico:**
- Origem: ${infoViajante.cidadeOrigem}
- Composição: ${infoViajante.companhia} (${infoViajante.pessoas} pessoa(s))
- Período: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Preferência principal: ${infoViajante.preferencia}

## 💰 CONSIDERAÇÕES DE ORÇAMENTO:
**Orçamento informado:** ${infoViajante.orcamento} ${infoViajante.moeda} por pessoa para passagens aéreas (ida e volta)

${infoViajante.orcamento !== 'flexível' ? `
⚠️ **ORIENTAÇÃO DE ORÇAMENTO:**
- Considere destinos que sejam acessíveis dentro deste orçamento para passagens de ida e volta
- NUNCA sugira cidades com orçamento menor que 70% do orçamento para passagens de ida e volta
- NUNCA sugira cidades com orçamento maior que 120% do orçamento para passagens de ida e volta
- Leve em conta a cidade de origem (${infoViajante.cidadeOrigem}) ao avaliar distâncias
` : 
'**ORÇAMENTO FLEXÍVEL** - Sugira destinos variados considerando diferentes faixas de custo'}

## 🎯 PROCESSO DE RACIOCÍNIO OBRIGATÓRIO:

### PASSO 1: ANÁLISE DO PERFIL DO VIAJANTE
Analise profundamente:
- Que tipo de experiências esse perfil de viajante valoriza (${infoViajante.preferencia})?
- Quais destinos se alinham com suas preferências específicas?
- Que adaptações são necessárias para ${infoViajante.companhia}?
- Como a duração da viagem (${duracaoViagem}) influencia as opções?

### PASSO 2: CONSIDERAÇÃO GEOGRÁFICA E LOGÍSTICA
- Avalie a distância a partir de ${infoViajante.cidadeOrigem}
- Considere a facilidade de acesso e conexões disponíveis
- Pense na relação custo-benefício considerando o orçamento para passagens ${infoViajante.orcamento !== 'flexível' ? `de ${infoViajante.orcamento} ${infoViajante.moeda}` : 'flexível'}

### PASSO 3: MAPEAMENTO DE DESTINOS COMPATÍVEIS
Para cada destino considerado, avalie:
- Adequação às preferências declaradas (${infoViajante.preferencia})
- Conveniência para ${infoViajante.companhia}
- Atratividade no período ${dataIda} a ${dataVolta}
- Experiências únicas que o destino oferece

### PASSO 4: VALIDAÇÃO CLIMÁTICA E SAZONAL
Para as datas ${dataIda} a ${dataVolta}, determine:
- Estação do ano em cada destino considerado
- Condições climáticas típicas (temperatura, chuva, etc.)
- Eventos ou festivais especiais no período
- Recomendações práticas de vestuário e equipamentos

### PASSO 5: SELEÇÃO E RANQUEAMENTO
Baseado na análise acima, selecione:
- 1 destino TOP que melhor combina com TODOS os critérios
- 4 alternativas diversificadas geograficamente
- 1 surpresa que pode surpreender positivamente

### PASSO 6: PERSONALIZAÇÃO TRIPINHA 🐾
Para cada destino selecionado, adicione:
- Comentário em 1ª pessoa da Tripinha sobre SUA experiência no local
- Detalhes sensoriais que uma cachorrinha notaria (sons, cheiros, texturas)
- Dicas práticas baseadas nas "aventuras" da Tripinha
- Pontos turísticos específicos que ela "visitou"

## 📋 FORMATO DE RESPOSTA (JSON ESTRUTURADO):

\`\`\`json
{
  "tipoViagem": "aereo",
  "raciocinio": {
    "analise_perfil": "Resumo da análise do perfil do viajante",
    "criterios_selecao": "Principais critérios usados na seleção",
    "consideracoes_geograficas": "Como a origem ${infoViajante.cidadeOrigem} influenciou as escolhas"
  },
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País", 
    "codigoPais": "XX",
    "justificativa": "Por que este é o destino PERFEITO para este viajante específico",
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
      "aeroporto": {
        "codigo": "XYZ", 
        "nome": "Nome do Aeroporto"
      }
    }
    // EXATAMENTE 4 alternativas geograficamente diversas
  ],
  "surpresa": {
    "destino": "Nome da Cidade Inusitada",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "justificativa": "Por que é uma surpresa perfeita para este perfil",
    "descricao": "Descrição do destino surpresa",
    "porque": "Razões para ser destino surpresa",
    "destaque": "Experiência única e inesperada",
    "comentario": "Comentário empolgado da Tripinha: 'Nossa, quando cheguei em [destino], não esperava que... 🐾'",
    "pontosTuristicos": [
      "Primeiro ponto específico", 
      "Segundo ponto específico"
    ],
    "clima": {
      "estacao": "Estação durante ${dataIda} a ${dataVolta}",
      "temperatura": "Faixa de temperatura",
      "condicoes": "Condições climáticas",
      "recomendacoes": "Dicas de vestuário"
    },
    "aeroporto": {
      "codigo": "XYZ", 
      "nome": "Nome do Aeroporto"
    }
  },
  "estacaoViagem": "Estação predominante nos destinos selecionados",
  "resumoIA": "Resumo de como a IA chegou às recomendações considerando origem, preferências e orçamento"
}
\`\`\`

## 🔍 VALIDAÇÃO FINAL OBRIGATÓRIA:
Antes de responder, confirme que:
- ✅ Informações climáticas são precisas para o período da viagem  
- ✅ Comentários da Tripinha são autênticos e em 1ª pessoa
- ✅ Pontos turísticos são específicos e reais
- ✅ Códigos IATA dos aeroportos estão corretos
- ✅ Destinos são adequados para ${infoViajante.companhia}
- ✅ Considerou a cidade de origem ${infoViajante.cidadeOrigem} nas sugestões

**Execute o raciocínio passo-a-passo e forneça recomendações fundamentadas e personalizadas!**`;
}

// =======================
// Funções auxiliares de texto simplificadas
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

// =======================
// Processamento e validação de destinos (adaptado para rodoviário)
// =======================
function ensureValidDestinationData(jsonString, requestData) {
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    const tipoViagem = utils.determinarTipoViagem(requestData.orcamento_valor, requestData.moeda_escolhida);
    const isRodoviario = tipoViagem === 'rodoviario';
    let modificado = false;
    
    // Processar topPick
    if (data.topPick) {
      if (isRodoviario) {
        // Para viagens rodoviárias, garantir nome da rodoviária
        if (!data.topPick.rodoviaria?.nome) {
          data.topPick.rodoviaria = {
            nome: obterNomeRodoviariaPadrao(data.topPick.destino),
            localizacao: "Centro"
          };
          modificado = true;
        }
      } else {
        // Para viagens aéreas, garantir código IATA
        if (!data.topPick.aeroporto?.codigo) {
          data.topPick.aeroporto = {
            codigo: obterCodigoIATAPadrao(data.topPick.destino, data.topPick.pais),
            nome: `Aeroporto de ${data.topPick.destino}`
          };
          modificado = true;
        }
      }
    }
    
    // Processar surpresa
    if (data.surpresa) {
      if (isRodoviario) {
        if (!data.surpresa.rodoviaria?.nome) {
          data.surpresa.rodoviaria = {
            nome: obterNomeRodoviariaPadrao(data.surpresa.destino),
            localizacao: "Centro"
          };
          modificado = true;
        }
      } else {
        if (!data.surpresa.aeroporto?.codigo) {
          data.surpresa.aeroporto = {
            codigo: obterCodigoIATAPadrao(data.surpresa.destino, data.surpresa.pais),
            nome: `Aeroporto de ${data.surpresa.destino}`
          };
          modificado = true;
        }
      }
    }
    
    // Processar alternativas
    if (data.alternativas && Array.isArray(data.alternativas)) {
      data.alternativas.forEach(alternativa => {
        if (isRodoviario) {
          if (!alternativa.rodoviaria?.nome) {
            alternativa.rodoviaria = {
              nome: obterNomeRodoviariaPadrao(alternativa.destino)
            };
            modificado = true;
          }
        } else {
          if (!alternativa.aeroporto?.codigo) {
            alternativa.aeroporto = {
              codigo: obterCodigoIATAPadrao(alternativa.destino, alternativa.pais),
              nome: `Aeroporto de ${alternativa.destino}`
            };
            modificado = true;
          }
        }
      });
    }
    
    // Adicionar tipo de viagem se não existir
    if (!data.tipoViagem) {
      data.tipoViagem = tipoViagem;
      modificado = true;
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
      delay = Math.min(delay * 1.2, 5000);
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
  }, 350000); // 350s para acomodar reasoning model

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
    console.log('🚌✈️ === BENETRIP GROQ API v8.1 - LIMITES AJUSTADOS ===');
    
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
    
    // Determinar tipo de viagem
    const tipoViagem = utils.determinarTipoViagem(requestData.orcamento_valor, requestData.moeda_escolhida);
    const isRodoviario = tipoViagem === 'rodoviario';
    
    // Log dos dados recebidos
    utils.log('📊 Dados da requisição:', {
      companhia: requestData.companhia,
      cidade_partida: requestData.cidade_partida?.name || requestData.cidade_partida,
      datas: requestData.datas,
      orcamento: requestData.orcamento_valor,
      moeda: requestData.moeda_escolhida,
      preferencia: requestData.preferencia_viagem,
      tipoViagem: tipoViagem,
      limiteRodoviario: isRodoviario ? '700km/10h' : 'N/A'
    });
    
    console.log(`${isRodoviario ? '🚌' : '✈️'} Tipo de viagem: ${tipoViagem.toUpperCase()}`);
    if (isRodoviario) {
      console.log('📏 Limite máximo: 700km ou 10 horas de ônibus');
    }
    
    // Gerar prompt otimizado para Groq
    const prompt = gerarPromptParaGroq(requestData);
    console.log(`📝 Prompt gerado para Groq (${tipoViagem})`);
    
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
    
    // Processar e retornar resultado
    try {
      const recomendacoesProcessadas = ensureValidDestinationData(recomendacoesBrutas, requestData);
      const dados = typeof recomendacoesProcessadas === 'string' ? 
        JSON.parse(recomendacoesProcessadas) : recomendacoesProcessadas;
      
      // Adicionar metadados incluindo modelo usado e tipo de viagem
      dados.metadados = {
        modelo: modeloUsado,
        provider: 'groq',
        versao: '8.1-limits-adjusted',
        timestamp: new Date().toISOString(),
        reasoning_enabled: modeloUsado === CONFIG.groq.models.reasoning,
        origem: requestData.cidade_partida?.name || requestData.cidade_partida,
        tipoViagem: tipoViagem,
        orcamento: requestData.orcamento_valor,
        moeda: requestData.moeda_escolhida,
        limiteRodoviario: isRodoviario ? '700km/10h' : null
      };
      
      console.log('🎉 Recomendações processadas com sucesso!');
      console.log('🧠 Modelo usado:', modeloUsado);
      console.log(`${isRodoviario ? '🚌' : '✈️'} Tipo de viagem:`, tipoViagem);
      console.log('📍 Origem:', requestData.cidade_partida?.name || requestData.cidade_partida);
      console.log('📋 Destinos encontrados:', {
        topPick: dados.topPick?.destino,
        alternativas: dados.alternativas?.length || 0,
        surpresa: dados.surpresa?.destino,
        temRaciocinio: !!dados.raciocinio,
        tipoTransporte: isRodoviario ? 'Rodoviário (máx 700km/10h)' : 'Aéreo'
      });
      
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(200).json({
          tipo: "groq_success",
          modelo: modeloUsado,
          tipoViagem: tipoViagem,
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
          tipoViagem: tipoViagem,
          conteudo: recomendacoesBrutas
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
