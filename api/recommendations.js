// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
// Versão 7.0 - GROQ REASONING + VIAGENS DE ÔNIBUS - DeepSeek R1 Distill + Fallbacks Inteligentes
// Prioriza modelo de reasoning para análise complexa com fallback para personalidade e velocidade
// NOVO: Suporte para viagens de ônibus em orçamentos baixos (< R$ 400)
const axios = require('axios');
const http = require('http');
const https = require('https');

// =======================
// Configurações Groq - REASONING OPTIMIZED + BUS TRAVEL
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
  },
  // NOVO: Configuração para viagens de ônibus
  viagemOnibus: {
    orcamentoLimite: 400,  // Valor limite para sugerir ônibus
    distanciaMaxima: 1200, // Distância máxima em km para viagem de ônibus
    duracaoMaxima: 15      // Duração máxima em horas
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
// Funções utilitárias - ATUALIZADAS
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

  // NOVA função para detectar se deve sugerir viagem de ônibus
  deveUsarViagemOnibus: (orcamento, moeda = 'BRL') => {
    if (!orcamento || orcamento === 'flexível') return false;
    
    // Converter orçamento para BRL se necessário
    let orcamentoBRL = parseFloat(orcamento);
    if (moeda !== 'BRL') {
      // Conversões aproximadas - pode ser melhorado com API de câmbio
      const taxas = { 'USD': 5.2, 'EUR': 5.8, 'GBP': 6.5 };
      orcamentoBRL = orcamentoBRL * (taxas[moeda] || 1);
    }
    
    return orcamentoBRL < CONFIG.viagemOnibus.orcamentoLimite;
  },

  // Função para validar orçamento (voo ou ônibus)
  validarOrcamentoDestino: (preco, orcamentoMax, tolerancia = 0.1) => {
    if (!orcamentoMax || orcamentoMax === 'flexível') return true;
    const limite = parseFloat(orcamentoMax) * (1 + tolerancia); // 10% de tolerância
    return parseFloat(preco) <= limite;
  },

  // NOVA função para obter destinos de ônibus baseado na origem
  obterDestinosOnibus: (cidadeOrigem, orcamento) => {
    const origem = cidadeOrigem.toLowerCase();
    let cidadeBase = 'São Paulo'; // Padrão
    
    if (origem.includes('rio') || origem.includes('rj')) {
      cidadeBase = 'Rio de Janeiro';
    } else if (origem.includes('são paulo') || origem.includes('sp')) {
      cidadeBase = 'São Paulo';
    }
    
    const destinos = DESTINOS_ONIBUS_BRASIL[cidadeBase] || DESTINOS_ONIBUS_BRASIL['São Paulo'];
    const orcamentoNum = parseFloat(orcamento);
    
    // Filtrar destinos pelo orçamento
    const proximosFiltrados = destinos.Próximos.filter(d => d.preco <= orcamentoNum);
    const regionaisFiltrados = destinos.Regionais.filter(d => d.preco <= orcamentoNum);
    
    return {
      proximos: proximosFiltrados,
      regionais: regionaisFiltrados,
      cidadeBase
    };
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
  
  // ATUALIZADA: Validação considerando viagens de ônibus
  isValidDestinationJSON: (jsonString, requestData) => {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      
      // Verificar estrutura mínima necessária
      const hasValidTopPick = data.topPick && data.topPick.destino;
      const hasValidAlternatives = Array.isArray(data.alternativas) && 
                                   data.alternativas.length >= 2 &&
                                   data.alternativas.every(alt => alt.destino);
      
      if (!hasValidTopPick && !hasValidAlternatives) {
        console.log('❌ Validação falhou: nem topPick nem alternativas válidas');
        return false;
      }
      
      // Detectar se é viagem de ônibus
      const viagemOnibus = utils.deveUsarViagemOnibus(requestData.orcamento_valor, requestData.moeda_escolhida);
      
      // NOVA VALIDAÇÃO DE ORÇAMENTO (considerando ônibus)
      const orcamentoMax = requestData.orcamento_valor;
      if (orcamentoMax && orcamentoMax !== 'flexível') {
        const orcamentoNum = parseFloat(orcamentoMax);
        let destinosForaOrcamento = [];
        
        // Verificar topPick
        const precoTopPick = viagemOnibus ? data.topPick?.preco?.onibus : data.topPick?.preco?.voo;
        if (precoTopPick && !utils.validarOrcamentoDestino(precoTopPick, orcamentoMax)) {
          destinosForaOrcamento.push(`topPick (${data.topPick.destino}: ${precoTopPick})`);
        }
        
        // Verificar alternativas
        if (data.alternativas) {
          data.alternativas.forEach((alt, i) => {
            const precoAlt = viagemOnibus ? alt.preco?.onibus : alt.preco?.voo;
            if (precoAlt && !utils.validarOrcamentoDestino(precoAlt, orcamentoMax)) {
              destinosForaOrcamento.push(`alternativa ${i+1} (${alt.destino}: ${precoAlt})`);
            }
          });
        }
        
        // Verificar surpresa
        const precoSurpresa = viagemOnibus ? data.surpresa?.preco?.onibus : data.surpresa?.preco?.voo;
        if (precoSurpresa && !utils.validarOrcamentoDestino(precoSurpresa, orcamentoMax)) {
          destinosForaOrcamento.push(`surpresa (${data.surpresa.destino}: ${precoSurpresa})`);
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
      
      // NOVA: Validação específica para viagens de ônibus
      if (viagemOnibus) {
        console.log('🚌 Viagem de ônibus detectada - validando campos específicos');
        
        // Verificar se tem informações de ônibus nos destinos
        const temInfoOnibus = data.topPick?.transporte?.tipo === 'onibus' || 
                              data.topPick?.preco?.onibus !== undefined;
        
        if (temInfoOnibus) {
          console.log('✅ Informações de ônibus encontradas');
        } else {
          console.log('⚠️ Faltam informações específicas de ônibus');
        }
      }
      
      console.log('✅ Validação passou (incluindo orçamento e transporte)');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao validar JSON de destino:', error.message);
      return false;
    }
  }
};

// =======================
// Mapeamento de códigos IATA - EXPANDIDO PARA BRASIL
// =======================
function obterCodigoIATAPadrao(cidade, pais) {
  const mapeamentoIATA = {
    // Principais destinos brasileiros
    'São Paulo': 'GRU', 'Rio de Janeiro': 'GIG', 'Brasília': 'BSB',
    'Salvador': 'SSA', 'Fortaleza': 'FOR', 'Recife': 'REC',
    'Porto Alegre': 'POA', 'Belém': 'BEL', 'Manaus': 'MAO',
    'Belo Horizonte': 'CNF', 'Curitiba': 'CWB', 'Florianópolis': 'FLN',
    'Goiânia': 'GYN', 'Vitória': 'VIX', 'Natal': 'NAT',
    
    // NOVO: Destinos nacionais de ônibus (usando códigos identificadores)
    'Campos do Jordão': 'CJD', 'Santos': 'SNT', 'Guarujá': 'GRJ',
    'Aparecida': 'APR', 'Búzios': 'BUZ', 'Petrópolis': 'PET',
    'Paraty': 'PTY', 'Cabo Frio': 'CFR',
    
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
2. DETERMINAÇÃO DO TRANSPORTE: Avalie se deve sugerir ÔNIBUS ou AVIÃO baseado no orçamento
3. MAPEAMENTO DE COMPATIBILIDADE: Correlacione destinos com o perfil analisado  
4. VALIDAÇÃO DE ORÇAMENTO: Verifique se preços são realistas e compatíveis
5. ANÁLISE CLIMÁTICA: Determine condições climáticas exatas para as datas
6. PERSONALIZAÇÃO TRIPINHA: Adicione perspectiva autêntica da mascote cachorrinha

CRITÉRIOS DE DECISÃO:
- Orçamento DEVE ser respeitado rigorosamente
- Para orçamentos < R$ 400: PRIORIZAR destinos acessíveis de ÔNIBUS no Brasil
- Para orçamentos ≥ R$ 400: Considerar voos nacionais e internacionais
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
- NOVO: Conhece muito bem viagens de ônibus pelo Brasil!

RETORNE APENAS JSON VÁLIDO sem formatação markdown.`;
  } else {
    // Sistema padrão para modelos rápidos
    systemMessage = `Especialista em recomendações de viagem. Retorne apenas JSON válido com destinos que respeitem o orçamento do usuário. Para orçamentos baixos, considere viagens de ônibus.`;
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
// NOVA função para gerar prompt de viagem de ônibus - SEM BASE LOCAL
// =======================
function gerarPromptViagemOnibus(dados) {
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

  return `# 🚌 SISTEMA DE RECOMENDAÇÃO INTELIGENTE - VIAGENS DE ÔNIBUS NO BRASIL

## 📊 DADOS DO VIAJANTE PARA ANÁLISE:
**Perfil Básico:**
- Origem: ${infoViajante.cidadeOrigem}
- Composição: ${infoViajante.companhia} (${infoViajante.pessoas} pessoa(s))
- Período: ${dataIda} a ${dataVolta} (${duracaoViagem})

## 🚌 MODALIDADE DE TRANSPORTE: ÔNIBUS RODOVIÁRIO

**ORÇAMENTO PARA TRANSPORTE:** ${infoViajante.orcamento} ${infoViajante.moeda}

⚠️  **FOCO EXCLUSIVO EM VIAGENS DE ÔNIBUS** ⚠️
- Como o orçamento é de ${infoViajante.orcamento} ${infoViajante.moeda}, vamos focar em destinos acessíveis de ÔNIBUS
- TODOS os destinos devem ser acessíveis por transporte rodoviário do Brasil
- Priorizar destinos dentro do Brasil com boa infraestrutura de ônibus
- Considerar tempo de viagem realista (máximo 20 horas de ônibus)
- Usar seu conhecimento sobre destinos brasileiros acessíveis de ônibus

**INSTRUÇÕES OBRIGATÓRIAS PARA VIAGEM DE ÔNIBUS:**
1. Todos os destinos DEVEM ser acessíveis de ônibus saindo de ${infoViajante.cidadeOrigem}
2. Preços DEVEM incluir ida e volta de ônibus (dentro do orçamento ${infoViajante.orcamento} ${infoViajante.moeda})
3. Priorizar destinos nacionais com boa infraestrutura rodoviária
4. Considerar conforto da viagem vs. economia
5. Incluir dicas específicas para viagens rodoviárias
6. Destacar vantagens: economia, paisagens, flexibilidade de paradas
7. Use seu conhecimento sobre cidades brasileiras acessíveis de ônibus

**Preferências Declaradas:**
- Atividades preferidas: ${infoViajante.preferencia}
- Tipo de destino: ${getTipoDestinoText(infoViajante.tipoDestino)}
- Popularidade desejada: ${getFamaDestinoText(infoViajante.famaDestino)}

## 🎯 PROCESSO DE RACIOCÍNIO PARA VIAGEM DE ÔNIBUS:

### PASSO 1: ANÁLISE DE VIABILIDADE RODOVIÁRIA
- Quais destinos brasileiros são acessíveis de ônibus dentro do orçamento?
- Qual a relação custo x tempo x conforto para viagens rodoviárias?
- Como maximizar a experiência mesmo com orçamento limitado?

### PASSO 2: **FILTRO RIGOROSO DE ORÇAMENTO DE ÔNIBUS** 🚨
- Elimine destinos com passagem de ônibus (ida+volta) > ${infoViajante.orcamento} ${infoViajante.moeda}
- Priorize destinos brasileiros na faixa de R$ 50-${infoViajante.orcamento}
- Considere que ônibus permite economizar no transporte para gastar mais no destino

### PASSO 3: SELEÇÃO DE DESTINOS RODOVIÁRIOS
Para cada destino considerado, avalie:
- Adequação às preferências declaradas (${infoViajante.preferencia})
- **VIABILIDADE DE ÔNIBUS CONFIRMADA** (destinos brasileiros acessíveis por estrada)
- Conveniência para ${infoViajante.companhia}
- Infraestrutura turística no destino
- Qualidade da viagem rodoviária

### PASSO 4: VALIDAÇÃO CLIMÁTICA E SAZONAL
Para as datas ${dataIda} a ${dataVolta}, determine:
- Estação do ano em cada destino brasileiro
- Condições climáticas para viagem de ônibus
- Eventos/festivais no período
- Dicas específicas para viagem rodoviária

### PASSO 5: SELEÇÃO E RANQUEAMENTO RODOVIÁRIO
Baseado na análise acima, selecione:
- 1 destino TOP de ônibus no Brasil que melhor combina com TODOS os critérios
- 4 alternativas diversificadas geograficamente (todas acessíveis de ônibus)
- 1 surpresa rodoviária brasileira que pode surpreender positivamente

### PASSO 6: PERSONALIZAÇÃO TRIPINHA 🐾
Para cada destino selecionado, adicione:
- Comentário em 1ª pessoa da Tripinha sobre SUA experiência de ônibus
- Detalhes específicos da viagem rodoviária que ela fez
- Dicas práticas para viagem de ônibus
- Menção a empresas de ônibus ou paradas interessantes no caminho

## 📋 FORMATO DE RESPOSTA PARA VIAGEM DE ÔNIBUS (JSON ESTRUTURADO):

\`\`\`json
{
  "modalidade_transporte": "onibus",
  "raciocinio": {
    "analise_perfil": "Resumo da análise do perfil do viajante",
    "criterios_selecao": "Principais critérios para viagem de ônibus",
    "consideracoes_orcamento": "Como o orçamento de ${infoViajante.orcamento} ${infoViajante.moeda} direcionou para viagem de ônibus",
    "vantagens_onibus": "Benefícios específicos da viagem rodoviária para este perfil"
  },
  "topPick": {
    "destino": "Nome da Cidade",
    "estado": "Estado",
    "pais": "Brasil",
    "codigoPais": "BR",
    "justificativa": "Por que este é o destino PERFEITO para viagem de ônibus",
    "justificativa_orcamento": "CONFIRME que o preço de R$ X está dentro do orçamento de ${infoViajante.orcamento} ${infoViajante.moeda}",
    "descricao": "Descrição detalhada do destino",
    "porque": "Razões específicas para esta recomendação rodoviária",
    "destaque": "Experiência única do destino",
    "comentario": "Comentário entusiasmado da Tripinha: 'Adorei minha viagem de ônibus para [destino]! O cheiro da estrada e... 🐾'",
    "pontosTuristicos": [
      "Nome específico do primeiro ponto turístico",
      "Nome específico do segundo ponto turístico"
    ],
    "transporte": {
      "tipo": "onibus",
      "duracao_viagem": "Estimativa realista em horas",
      "empresas_sugeridas": ["Nome de empresas de ônibus conhecidas"],
      "dicas_viagem": "Dicas específicas para a viagem de ônibus",
      "paradas_interessantes": "Cidades ou pontos no caminho"
    },
    "clima": {
      "estacao": "Estação exata no destino durante ${dataIda} a ${dataVolta}",
      "temperatura": "Faixa de temperatura precisa",
      "condicoes": "Condições climáticas detalhadas esperadas",
      "recomendacoes": "Dicas específicas do que levar para viagem de ônibus"
    },
    "preco": {
      "onibus": número_MÁXIMO_${infoViajante.orcamento},
      "hotel": número_estimado_por_noite,
      "total_estimado": número_total_viagem,
      "justificativa_preco": "Por que este preço de ônibus está correto e dentro do orçamento"
    }
  },
  "alternativas": [
    {
      "destino": "Nome da Cidade",
      "estado": "Estado",
      "pais": "Brasil",
      "codigoPais": "BR",
      "porque": "Razão específica para esta alternativa rodoviária",
      "pontoTuristico": "Ponto turístico específico de destaque",
      "transporte": {
        "tipo": "onibus",
        "duracao_viagem": "Estimativa em horas",
        "empresa_sugerida": "Nome da empresa"
      },
      "clima": {
        "estacao": "Estação no destino durante a viagem",
        "temperatura": "Faixa de temperatura"
      },
      "preco": {
        "onibus": número_MÁXIMO_${infoViajante.orcamento},
        "hotel": número
      }
    }
    // EXATAMENTE 4 alternativas brasileiras - TODAS com ônibus dentro do orçamento
  ],
  "surpresa": {
    "destino": "Nome da Cidade Brasileira Próxima",
    "estado": "Estado",
    "pais": "Brasil",
    "codigoPais": "BR",
    "justificativa": "Por que é uma surpresa perfeita para viagem de ônibus",
    "justificativa_orcamento": "CONFIRME que está dentro do orçamento de ônibus",
    "descricao": "Descrição do destino surpresa acessível de ônibus",
    "porque": "Razões para ser destino surpresa rodoviário",
    "destaque": "Experiência única e inesperada",
    "comentario": "Comentário empolgado da Tripinha: 'Nossa, quando peguei o ônibus para [destino]... 🐾'",
    "pontosTuristicos": ["Primeiro ponto específico", "Segundo ponto específico"],
    "transporte": {
      "tipo": "onibus",
      "duracao_viagem": "Estimativa em horas",
      "empresa_sugerida": "Nome da empresa",
      "dicas_especiais": "Dica especial para esta viagem rodoviária"
    },
    "clima": {
      "estacao": "Estação durante ${dataIda} a ${dataVolta}",
      "temperatura": "Faixa de temperatura",
      "condicoes": "Condições climáticas",
      "recomendacoes": "Dicas de vestuário para ônibus"
    },
    "preco": {
      "onibus": número_MÁXIMO_${infoViajante.orcamento},
      "hotel": número
    }
  },
  "estacaoViagem": "Estação predominante nos destinos selecionados",
  "dicas_gerais_onibus": [
    "Dica 1 para viagem de ônibus",
    "Dica 2 específica para o perfil do viajante",
    "Dica 3 sobre empresas ou rotas"
  ],
  "resumoIA": "Como a IA escolheu viagem de ônibus e os destinos específicos usando seu conhecimento"
}
\`\`\`

## 🔍 VALIDAÇÃO FINAL OBRIGATÓRIA PARA ÔNIBUS:
Antes de responder, confirme que:
- 🚌 **CRÍTICO:** TODOS os destinos são brasileiros e acessíveis de ÔNIBUS
- 🚌 **CRÍTICO:** TODOS os preços de ônibus estão ≤ ${infoViajante.orcamento} ${infoViajante.moeda}
- 🚌 **CRÍTICO:** Tempos de viagem são realistas para ônibus no Brasil
- ✅ Informações de empresas de ônibus são baseadas em seu conhecimento
- ✅ Comentários da Tripinha mencionam experiências rodoviárias específicas
- ✅ Destinos são adequados para ${infoViajante.companhia}
- ✅ Dicas são específicas para viagem de ônibus

**Execute o raciocínio passo-a-passo usando SEU CONHECIMENTO sobre destinos brasileiros acessíveis de ÔNIBUS!**`;
}

// =======================
// Geração de prompt otimizado para REASONING - ATUALIZADO
// =======================
function gerarPromptParaGroq(dados) {
  // Verificar se deve usar viagem de ônibus
  const viagemOnibus = utils.deveUsarViagemOnibus(dados.orcamento_valor, dados.moeda_escolhida);
  
  if (viagemOnibus) {
    console.log('🚌 Orçamento baixo detectado - gerando prompt para viagem de ônibus');
    return gerarPromptViagemOnibus(dados);
  }
  
  console.log('✈️ Orçamento adequado - gerando prompt para viagem aérea');
  
  // Prompt original para viagens aéreas (orçamento ≥ R$ 400)
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

  // Análise de orçamento e faixas realistas
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
  "modalidade_transporte": "aviao",
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

// [Resto das funções permanecem iguais - getCompanhiaText, getPreferenciaText, etc.]
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
// Nova função para filtrar destinos por orçamento - ATUALIZADA
// =======================
function filtrarDestinosPorOrcamento(jsonString, orcamentoMax, moeda = 'BRL') {
  if (!orcamentoMax || orcamentoMax === 'flexível') return jsonString;
  
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    const orcamentoNum = parseFloat(orcamentoMax);
    const tolerancia = 1.1; // 10% de tolerância
    const limite = orcamentoNum * tolerancia;
    
    // Detectar tipo de transporte
    const viagemOnibus = utils.deveUsarViagemOnibus(orcamentoMax, moeda);
    const campoPreco = viagemOnibus ? 'onibus' : 'voo';
    
    console.log(`🔍 Filtrando destinos (${viagemOnibus ? 'ônibus' : 'voo'}) com orçamento máximo: ${limite} ${moeda}`);
    
    let modificado = false;
    
    // Filtrar topPick
    if (data.topPick?.preco?.[campoPreco] && parseFloat(data.topPick.preco[campoPreco]) > limite) {
      console.log(`❌ TopPick ${data.topPick.destino} removido: R$ ${data.topPick.preco[campoPreco]} > R$ ${limite}`);
      data.topPick = null;
      modificado = true;
    }
    
    // Filtrar alternativas
    if (data.alternativas && Array.isArray(data.alternativas)) {
      const alternativasOriginais = data.alternativas.length;
      data.alternativas = data.alternativas.filter(alt => {
        if (alt.preco?.[campoPreco] && parseFloat(alt.preco[campoPreco]) > limite) {
          console.log(`❌ Alternativa ${alt.destino} removida: R$ ${alt.preco[campoPreco]} > R$ ${limite}`);
          return false;
        }
        return true;
      });
      if (data.alternativas.length < alternativasOriginais) modificado = true;
    }
    
    // Filtrar surpresa
    if (data.surpresa?.preco?.[campoPreco] && parseFloat(data.surpresa.preco[campoPreco]) > limite) {
      console.log(`❌ Surpresa ${data.surpresa.destino} removida: R$ ${data.surpresa.preco[campoPreco]} > R$ ${limite}`);
      data.surpresa = null;
      modificado = true;
    }
    
    if (modificado) {
      console.log(`✂️🚌 Destinos filtrados por orçamento (${campoPreco}) - alguns destinos foram removidos`);
      data.observacaoOrcamento = `Alguns destinos foram automaticamente removidos por excederem o orçamento de ${orcamentoMax} ${moeda} para ${viagemOnibus ? 'viagem de ônibus' : 'voos'}`;
    }
    
    return JSON.stringify(data);
  } catch (error) {
    console.error('Erro ao filtrar destinos por orçamento:', error.message);
    return jsonString;
  }
}

// [Resto das funções permanecem iguais - ensureValidDestinationData, retryWithBackoffAndFallback, handler principal]

// =======================
// Processamento e validação de destinos - ATUALIZADA
// =======================
function ensureValidDestinationData(jsonString, requestData) {
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    let modificado = false;
    
    // Detectar se é viagem de ônibus
    const viagemOnibus = utils.deveUsarViagemOnibus(requestData.orcamento_valor, requestData.moeda_escolhida);
    
    // Para viagens de ônibus, não precisamos de códigos IATA tradicionais
    if (!viagemOnibus) {
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
    } else {
      // Para viagens de ônibus, garantir informações de transporte rodoviário
      if (data.topPick && !data.topPick.transporte) {
        data.topPick.transporte = {
          tipo: 'onibus',
          duracao_viagem: 'A definir',
          empresas_sugeridas: ['Consultar rodoviária']
        };
        modificado = true;
      }
      
      // Adicionar modalidade de transporte se não existir
      if (!data.modalidade_transporte) {
        data.modalidade_transporte = 'onibus';
        modificado = true;
      }
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
// Handler principal da API - ATUALIZADO
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
    console.log('🧠🚌 === BENETRIP GROQ REASONING + BUS API v7.0 ===');
    
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
    
    // NOVA DETECÇÃO: Verificar se deve usar viagem de ônibus
    const viagemOnibus = utils.deveUsarViagemOnibus(requestData.orcamento_valor, requestData.moeda_escolhida);
    console.log(`🚌 Viagem de ônibus detectada: ${viagemOnibus} (orçamento: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'})`);
    
    // Log dos dados recebidos
    utils.log('📊 Dados da requisição:', {
      companhia: requestData.companhia,
      cidade_partida: requestData.cidade_partida?.name,
      datas: requestData.datas,
      orcamento: requestData.orcamento_valor,
      moeda: requestData.moeda_escolhida,
      tipo_transporte: viagemOnibus ? 'ônibus' : 'voo'
    });
    
    // Gerar prompt otimizado para Groq (que automaticamente detecta tipo de transporte)
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
    
    // NOVA ETAPA: Filtrar destinos por orçamento (considerando tipo de transporte)
    console.log('💰🚌 Aplicando filtro de orçamento (incluindo viagens de ônibus)...');
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
      
      // Adicionar metadados incluindo modelo usado e tipo de transporte
      dados.metadados = {
        modelo: modeloUsado,
        provider: 'groq',
        versao: '7.0-reasoning-budget-bus',
        timestamp: new Date().toISOString(),
        reasoning_enabled: modeloUsado === CONFIG.groq.models.reasoning,
        orcamento_filtrado: !!dados.observacaoOrcamento,
        orcamento_maximo: requestData.orcamento_valor,
        tipo_transporte: viagemOnibus ? 'onibus' : 'voo',
        viagem_onibus: viagemOnibus
      };
      
      console.log('🎉 Recomendações processadas com sucesso!');
      console.log('🧠 Modelo usado:', modeloUsado);
      console.log('🚌✈️ Tipo de transporte:', viagemOnibus ? 'ÔNIBUS' : 'VOO');
      console.log('💰 Orçamento respeitado:', requestData.orcamento_valor);
      console.log('📋 Destinos encontrados:', {
        topPick: dados.topPick?.destino,
        topPickPreco: dados.topPick?.preco?.[viagemOnibus ? 'onibus' : 'voo'],
        alternativas: dados.alternativas?.length || 0,
        surpresa: dados.surpresa?.destino,
        surpresaPreco: dados.surpresa?.preco?.[viagemOnibus ? 'onibus' : 'voo'],
        temRaciocinio: !!dados.raciocinio,
        filtradoPorOrcamento: !!dados.observacaoOrcamento,
        modalidadeTransporte: dados.modalidade_transporte
      });
      
      // Verificação final de orçamento (considerando tipo de transporte)
      if (requestData.orcamento_valor && requestData.orcamento_valor !== 'flexível') {
        const orcamentoMax = parseFloat(requestData.orcamento_valor);
        const campoPreco = viagemOnibus ? 'onibus' : 'voo';
        const violacoes = [];
        
        if (dados.topPick?.preco?.[campoPreco] && parseFloat(dados.topPick.preco[campoPreco]) > orcamentoMax * 1.1) {
          violacoes.push(`topPick: R$ ${dados.topPick.preco[campoPreco]}`);
        }
        
        if (dados.alternativas) {
          dados.alternativas.forEach((alt, i) => {
            if (alt.preco?.[campoPreco] && parseFloat(alt.preco[campoPreco]) > orcamentoMax * 1.1) {
              violacoes.push(`alt${i+1}: R$ ${alt.preco[campoPreco]}`);
            }
          });
        }
        
        if (violacoes.length > 0) {
          console.log(`⚠️ ATENÇÃO: Ainda há violações de orçamento (${campoPreco}):`, violacoes);
        } else {
          console.log(`✅ ORÇAMENTO RESPEITADO: Todos os destinos (${campoPreco}) ≤ R$ ${orcamentoMax}`);
        }
      }
      
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(200).json({
          tipo: "groq_reasoning_budget_bus_success",
          modelo: modeloUsado,
          orcamento_controlado: true,
          viagem_onibus: viagemOnibus,
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
          viagem_onibus: viagemOnibus,
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
