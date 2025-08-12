// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
// Versão 5.0 - SEM FALLBACKS AUTOMÁTICOS - Apenas dados da LLM
const axios = require('axios');
const http = require('http');
const https = require('https');

// =======================
// Configurações
// =======================
const CONFIG = {
  timeout: {
    request: 120000,
    handler: 300000,
    retry: 1500
  },
  retries: 2,
  logging: {
    enabled: true,
    maxLength: 500
  },
  providerOrder: ['perplexity', 'deepseek', 'openai', 'claude']
};

// =======================
// Cliente HTTP configurado
// =======================
const apiClient = axios.create({
  timeout: CONFIG.timeout.request,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

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
  
  embaralharArray: array => {
    const resultado = [...array];
    for (let i = resultado.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
    }
    return resultado;
  },
  
  extrairJSONDaResposta: texto => {
    try {
      if (typeof texto === 'object' && texto !== null) {
        return JSON.stringify(texto);
      }
      
      try {
        return JSON.stringify(JSON.parse(texto));
      } catch {}
      
      const textoProcessado = texto
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\r\n/g, '\n')
        .trim();
        
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
  
  isPartiallyValidJSON: jsonString => {
    if (!jsonString) return false;
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      return data && (data.topPick || data.alternativas || data.surpresa);
    } catch (error) {
      console.error('Erro ao verificar JSON parcialmente válido:', error.message);
      return false;
    }
  },
  
  // VALIDAÇÃO FLEXÍVEL - Aceita respostas parciais da LLM
  isValidDestinationJSON: (jsonString, requestData) => {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      
      // Apenas verificar se há pelo menos um destino válido
      const hasValidTopPick = data.topPick && data.topPick.destino;
      const hasValidAlternatives = Array.isArray(data.alternativas) && data.alternativas.length > 0;
      const hasValidSurprise = data.surpresa && data.surpresa.destino;
      
      // Aceitar se tiver pelo menos o topPick OU alternativas
      if (!hasValidTopPick && !hasValidAlternatives) {
        console.log('❌ Validação falhou: nem topPick nem alternativas válidas');
        return false;
      }
      
      console.log('✅ Validação passou (dados parciais aceitos)');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao validar JSON de destino:', error.message);
      return false;
    }
  }
};

// =======================
// Função auxiliar para obter código IATA
// =======================
function obterCodigoIATAPadrao(cidade, pais) {
  const mapeamentoIATA = {
    'São Paulo': 'GRU', 'Rio de Janeiro': 'GIG', 'Buenos Aires': 'EZE',
    'Santiago': 'SCL', 'Lima': 'LIM', 'Bogotá': 'BOG',
    'Cartagena': 'CTG', 'Cidade do México': 'MEX', 'Cancún': 'CUN',
    'Nova York': 'JFK', 'Los Angeles': 'LAX', 'Miami': 'MIA',
    'Londres': 'LHR', 'Paris': 'CDG', 'Roma': 'FCO',
    'Madri': 'MAD', 'Lisboa': 'LIS', 'Barcelona': 'BCN',
    'Tóquio': 'HND', 'Dubai': 'DXB', 'Sydney': 'SYD',
    'Amsterdã': 'AMS', 'Berlim': 'BER', 'Munique': 'MUC',
    'Porto': 'OPO', 'Praga': 'PRG', 'Viena': 'VIE',
    'Bangkok': 'BKK', 'Singapura': 'SIN', 'Hong Kong': 'HKG',
    'Toronto': 'YYZ', 'Vancouver': 'YVR', 'Montreal': 'YUL'
  };
  
  const nomeLower = cidade.toLowerCase();
  
  for (const [cidadeMap, codigo] of Object.entries(mapeamentoIATA)) {
    if (nomeLower.includes(cidadeMap.toLowerCase())) return codigo;
  }
  
  // Fallback: primeira letra do país + duas da cidade
  return (pais.charAt(0) + cidade.substring(0, 2)).toUpperCase();
}

// =======================
// Função genérica de retentativa
// =======================
async function retryAsync(fn, maxAttempts = CONFIG.retries, initialDelay = CONFIG.timeout.retry) {
  let attempt = 1;
  let delay = initialDelay;
  
  while (attempt <= maxAttempts) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      console.error(`Tentativa ${attempt} falhou: ${error.message}`);
    }
    
    if (attempt === maxAttempts) return null;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 5000);
    attempt++;
  }
  
  return null;
}

// =======================
// Processamento de destinos - SEM FALLBACKS
// =======================
async function processarDestinos(recomendacoes, datas) {
  try {
    console.log('✅ Processando destinos usando APENAS dados da LLM');
    console.log('📊 Dados recebidos:', {
      temTopPick: !!recomendacoes.topPick,
      temAlternativas: !!recomendacoes.alternativas,
      temSurpresa: !!recomendacoes.surpresa,
      estacaoViagem: recomendacoes.estacaoViagem || 'não fornecida pela LLM'
    });
    
    // REMOVIDO: Cálculo automático de estação/clima
    // Agora usa apenas o que vier da LLM
    
    return recomendacoes;
  } catch (error) {
    console.error(`Erro ao processar destinos: ${error.message}`);
    return recomendacoes;
  }
}

// =======================
// Funções para dados de entrada
// =======================
function obterCodigoIATAOrigem(dadosUsuario) {
  try {
    if (!dadosUsuario?.cidade_partida) return null;
    if (dadosUsuario.cidade_partida.iata) return dadosUsuario.cidade_partida.iata;
    
    const mapeamentoIATA = {
      'São Paulo': 'GRU', 'Rio de Janeiro': 'GIG', 'Brasília': 'BSB',
      'Buenos Aires': 'EZE', 'Santiago': 'SCL', 'Lima': 'LIM',
      'Bogotá': 'BOG', 'Cidade do México': 'MEX', 'Nova York': 'JFK',
      'Los Angeles': 'LAX', 'Miami': 'MIA', 'Londres': 'LHR',
      'Paris': 'CDG', 'Roma': 'FCO', 'Madri': 'MAD',
      'Lisboa': 'LIS', 'Tóquio': 'HND', 'Dubai': 'DXB',
      'Sydney': 'SYD'
    };
    
    const cidadeNome = dadosUsuario.cidade_partida.name || '';
    for (const [cidade, iata] of Object.entries(mapeamentoIATA)) {
      if (cidadeNome.toLowerCase().includes(cidade.toLowerCase())) {
        return iata;
      }
    }
    
    return 'GRU';
  } catch (error) {
    console.error('Erro ao obter código IATA de origem:', error.message);
    return 'GRU';
  }
}

function obterDatasViagem(dadosUsuario) {
  try {
    let datas = dadosUsuario.datas || (dadosUsuario.respostas ? dadosUsuario.respostas.datas : null);
    
    if (!datas) {
      const hoje = new Date();
      const mesQueVem = new Date(hoje);
      mesQueVem.setMonth(hoje.getMonth() + 1);
      const dataIdaPadrao = utils.formatarData(mesQueVem);
      const dataVoltaPadrao = new Date(mesQueVem);
      dataVoltaPadrao.setDate(dataVoltaPadrao.getDate() + 7);
      
      return { 
        dataIda: dataIdaPadrao, 
        dataVolta: utils.formatarData(dataVoltaPadrao) 
      };
    }
    
    if (typeof datas === 'string' && datas.includes(',')) {
      const [dataIda, dataVolta] = datas.split(',');
      return { dataIda: dataIda.trim(), dataVolta: dataVolta.trim() };
    }
    
    if (datas.dataIda && datas.dataVolta) {
      return { dataIda: datas.dataIda, dataVolta: datas.dataVolta };
    }
    
    return { dataIda: '2025-08-05', dataVolta: '2025-08-12' };
  } catch (error) {
    console.error('Erro ao obter datas de viagem:', error.message);
    return { dataIda: '2025-08-05', dataVolta: '2025-08-12' };
  }
}

// =======================
// Prompt Deepseek Reasoner aprimorado - SEM CÁLCULOS DE ESTAÇÃO
// =======================
function gerarPromptParaDeepseekReasoner(dados) {
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
  
  let dataIda = 'não especificada';
  let dataVolta = 'não especificada';
  let duracaoViagem = 'não especificada';
  
  if (dados.datas) {
    if (typeof dados.datas === 'string' && dados.datas.includes(',')) {
      const partes = dados.datas.split(',');
      dataIda = partes[0] || 'não especificada';
      dataVolta = partes[1] || 'não especificada';
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
  
  const adaptacoesPorTipo = {
    "sozinho(a)": "Destinos seguros para viajantes solo, atividades para conhecer pessoas, bairros com boa vida noturna e transporte público eficiente",
    "em casal (viagem romântica)": "Cenários românticos, jantares especiais, passeios a dois, hotéis boutique, praias privativas, mirantes com vistas panorâmicas e vinícolas",
    "em família": "Atividades para todas as idades, opções kid-friendly, segurança, acomodações espaçosas, parques temáticos, atrações educativas e opções de transporte facilitado",
    "com amigos": "Vida noturna, atividades em grupo, opções de compartilhamento, diversão coletiva, esportes de aventura, festivais locais e culinária diversificada"
  };
  
  const mensagemOrcamento = infoViajante.orcamento !== 'flexível' ?
    `ORÇAMENTO MÁXIMO: ${infoViajante.orcamento} ${infoViajante.moeda}` : 
    'Orçamento flexível';

  return `# Tarefa: Recomendações Personalizadas de Destinos de Viagem

## Dados do Viajante
- Origem: ${infoViajante.cidadeOrigem}
- Composição: ${infoViajante.companhia}
- Quantidade: ${infoViajante.pessoas} pessoa(s)
- Interesses: ${infoViajante.preferencia}
- Período: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Tipo de destino preferido: ${getTipoDestinoText(infoViajante.tipoDestino)}
- Nível de popularidade desejado: ${getFamaDestinoText(infoViajante.famaDestino)}

## ASPECTOS SAZONAIS E CLIMÁTICOS CRÍTICOS
- Para o período ${dataIda} a ${dataVolta}, VOCÊ DEVE determinar e incluir:
  * Estação do ano no destino durante essas datas
  * Temperatura média esperada e condições climáticas
  * Festivais, feriados e eventos especiais que agregam valor à viagem
  * Condições climáticas adversas a evitar: monções, furacões, temperaturas extremas
  * Temporada turística (alta/baixa) e impacto em preços, disponibilidade e experiência
  * Recomendações específicas sobre o que levar/vestir

## ADAPTAÇÕES ESPECÍFICAS PARA: ${infoViajante.companhia.toUpperCase()}
${adaptacoesPorTipo[infoViajante.companhia] || "Considere experiências versáteis para diferentes perfis"}

## PERSONALIDADE DA TRIPINHA (MASCOTE)
- A Tripinha é uma cachorrinha vira-lata caramelo, curiosa e aventureira e que conhece todos os lugares do mundo
- Seus comentários devem ser:
  * Autênticos e entusiasmados
  * Mencionar PELO MENOS UM ponto turístico específico do destino
  * Incluir uma observação sensorial que um cachorro notaria (cheiros, sons, texturas)
  * Usar emoji 🐾 para dar personalidade
  * Tom amigável e conversacional

## Processo de Raciocínio Passo a Passo
1) Identifique destinos adequados considerando:
   - Clima e estação no período especificado
   - Eventos especiais/festivais no período
   - Adaptação para viajantes ${infoViajante.companhia}
   - Destinos que fiquem entre 80% e 120% orçamento estipulado para voos de ${infoViajante.orcamento} ${infoViajante.moeda}

2) Para cada destino, determine:
   - Preço realista de voo
   - Pontos turísticos específicos e conhecidos
   - INFORMAÇÕES CLIMÁTICAS DETALHADAS para o período da viagem
   - Eventos sazonais ou especiais no período da viagem
   - Comentário personalizado em 1ª pessoa da Tripinha mencionando detalhes sensoriais
   - Recomendações práticas sobre clima/vestuário

3) Diversifique suas recomendações:
   - topPick: Destino com máxima adequação ao perfil
   - alternativas: 4 destinos diversos, custo e experiências
   - surpresa: Destino incomum mas encantador (pode ser mais desafiador, desde que viável)

## Formato de Retorno (JSON estrito)
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição de 1-2 frases sobre o destino",
    "porque": "Razão específica para este viajante visitar este destino",
    "destaque": "Uma experiência/atividade única neste destino",
    "comentario": "Comentário entusiasmado em 1a pessoa da Tripinha como foi interessante ter visitado esse local",
    "pontosTuristicos": ["Nome do Primeiro Ponto", "Nome do Segundo Ponto"],
    "eventos": ["Festival ou evento especial durante o período", "Outro evento relevante se houver"],
    "clima": {
      "estacao": "Estação do ano no destino durante o período da viagem",
      "temperatura": "Faixa de temperatura média esperada (ex: 15°C-25°C)",
      "condicoes": "Descrição das condições típicas (ex: ensolarado com chuvas ocasionais)",
      "recomendacoes": "Dicas relacionadas ao clima (o que levar/vestir)"
    },
    "aeroporto": {
      "codigo": "XYZ",
      "nome": "Nome do Aeroporto Principal"
    },
    "preco": {
      "voo": 1500,
      "hotel": 200
    }
  },
  "alternativas": [
    // EXATAMENTE 4 destinos com estrutura similar à descrita acima
    // Cada destino alternativo deve ser de uma região/continente diferente para maximizar a diversidade
    // TODOS devem incluir informações climáticas detalhadas
  ],
  "surpresa": {
    // Mesma estrutura do topPick, incluindo informações climáticas
    // Deve ser um destino menos óbvio, mas igualmente adequado
  },
  "estacaoViagem": "Estação predominante nos destinos recomendados"
}

## Verificação Final Obrigatória - CONFIRME QUE:
- ✓ TODAS as informações climáticas foram determinadas por você para cada destino
- ✓ Considerou eventos sazonais, clima e atrações para CADA destino
- ✓ Todos os comentários da Tripinha são em 1a pessoa e simulam como foi a experiência dela nesse local
- ✓ As recomendações estão adaptadas para viajantes ${infoViajante.companhia}
- ✓ Todos os destinos incluem código IATA válido do aeroporto
- ✓ Diversificou geograficamente as alternativas
- ✓ Incluiu informações climáticas COMPLETAS para cada destino (estação, temperatura, condições, recomendações)`;
}

// =======================
// Funções para chamadas às APIs de IA
// =======================
async function callAIAPI(provider, prompt, requestData) {
  const apiConfig = {
    deepseek: {
      url: 'https://api.deepseek.com/v1/chat/completions', 
      header: 'Authorization',
      prefix: 'Bearer',
      model: 'deepseek-reasoner',
      systemMessage: 'Você é um especialista em viagens com experiência em destinos globais. Retorne apenas JSON com destinos detalhados, respeitando o orçamento para voos. INCLUA informações climáticas completas para cada destino.',
      temperature: 0.5,
      max_tokens: 3000,
      additionalParams: {
        reasoner_enabled: true
      }
    },
    perplexity: {
      url: 'https://api.perplexity.ai/chat/completions',
      header: 'Authorization',
      prefix: 'Bearer',
      model: 'sonar',
      systemMessage: 'Você é um especialista em viagens. Sua prioridade é não exceder o orçamento para voos. Retorne apenas JSON puro com 4 destinos alternativos. INCLUA informações climáticas para cada destino.',
      temperature: 0.5,
      max_tokens: 3000
    },
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      header: 'Authorization',
      prefix: 'Bearer',
      model: 'gpt-3.5-turbo',
      systemMessage: 'Você é um especialista em viagens. Retorne apenas JSON com 4 destinos alternativos, respeitando o orçamento para voos. INCLUA informações climáticas para cada destino.',
      temperature: 0.7,
      max_tokens: 2000
    },
    claude: {
      url: 'https://api.anthropic.com/v1/messages',
      header: 'anthropic-api-key',
      prefix: '',
      model: 'claude-3-haiku-20240307',
      systemMessage: 'Você é um especialista em viagens. Retorne apenas JSON com 4 destinos alternativos, respeitando o orçamento para voos. INCLUA informações climáticas para cada destino.',
      temperature: 0.7,
      max_tokens: 2000
    }
  };
  
  if (!apiConfig[provider]) {
    throw new Error(`Provedor ${provider} não suportado`);
  }
  
  const config = apiConfig[provider];
  const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  
  if (!apiKey) {
    throw new Error(`Chave da API ${provider} não configurada`);
  }

  const finalPrompt = provider === 'deepseek' 
    ? gerarPromptParaDeepseekReasoner(requestData)
    : `${prompt}
  
IMPORTANTE: 
1. Cada voo DEVE respeitar o orçamento.
2. Retorne apenas JSON.
3. Forneça 4 destinos alternativos.
4. Inclua pontos turísticos específicos.
5. Inclua o código IATA de cada aeroporto.
6. OBRIGATÓRIO: Inclua informações climáticas COMPLETAS para cada destino (estação, temperatura, condições, recomendações).`;

  try {
    utils.log(`Enviando requisição para ${provider}...`, null);
    
    let requestPayload;
    
    if (provider === 'claude') {
      requestPayload = {
        model: config.model,
        max_tokens: config.max_tokens || 2000,
        messages: [
          {
            role: "system",
            content: config.systemMessage
          },
          {
            role: "user",
            content: finalPrompt
          }
        ],
        temperature: config.temperature || 0.7
      };
    } else {
      requestPayload = {
        model: config.model,
        messages: [
          {
            role: "system",
            content: config.systemMessage
          },
          {
            role: "user",
            content: finalPrompt
          }
        ],
        temperature: config.temperature || 0.7,
        max_tokens: config.max_tokens || 2000
      };
      
      if (config.additionalParams) {
        Object.assign(requestPayload, config.additionalParams);
      }
      
      if (provider === 'perplexity') {
        requestPayload.response_format = { type: "text" };
      }
    }
    
    const headers = {
      'Content-Type': 'application/json'
    };
    headers[config.header] = config.prefix ? `${config.prefix} ${apiKey}` : apiKey;
    
    if (provider === 'claude') {
      headers['anthropic-version'] = '2023-06-01';
    }
    
    const response = await apiClient({
      method: 'post',
      url: config.url,
      headers,
      data: requestPayload,
      timeout: config.timeout || CONFIG.timeout.request
    });
    
    let content;
    
    if (provider === 'claude') {
      if (!response.data?.content?.[0]?.text) {
        throw new Error(`Formato de resposta do ${provider} inválido`);
      }
      content = response.data.content[0].text;
    } else {
      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error(`Formato de resposta do ${provider} inválido`);
      }
      content = response.data.choices[0].message.content;
    }
    
    utils.log(`Conteúdo recebido da API ${provider} (primeiros 200 caracteres):`, content.substring(0, 200));
    
    if (provider === 'deepseek') {
      try {
        const jsonConteudo = utils.extrairJSONDaResposta(content);
        if (jsonConteudo) {
          const dados = JSON.parse(jsonConteudo);
          utils.log('Deepseek forneceu destinos válidos:', {
            topPick: dados.topPick?.destino,
            alternativas: dados.alternativas?.map(a => a.destino).join(', '),
            surpresa: dados.surpresa?.destino,
            climaIncluido: !!(dados.topPick?.clima || dados.surpresa?.clima)
          });
        }
      } catch (error) {
        console.error('Erro ao analisar resposta do Deepseek:', error.message);
      }
    }
    
    return utils.extrairJSONDaResposta(content);
  } catch (error) {
    console.error(`Erro na chamada à API ${provider}:`, error.message);
    if (error.response) {
      utils.log(`Resposta de erro (${provider}):`, error.response.data);
    }
    throw error;
  }
}

// =======================
// Funções para processamento e melhoria de JSON
// =======================
function enriquecerComentarioTripinha(comentario, pontosTuristicos) {
  if (!comentario || !pontosTuristicos?.length) return null;
  
  const mencionaAtual = pontosTuristicos.some(ponto => 
    comentario.toLowerCase().includes(ponto.toLowerCase())
  );
  
  if (mencionaAtual) return comentario;
  
  const pontoParaMencionar = pontosTuristicos[0];
  const padroes = [
    `${comentario} Adorei especialmente ${pontoParaMencionar}! 🐾`,
    `${comentario.replace(/🐾.*$/, '')} Fiquei impressionada com ${pontoParaMencionar}! 🐾`,
    comentario.includes('!') 
      ? comentario.replace(/!([^!]*)$/, `! ${pontoParaMencionar} é incrível!$1`)
      : `${comentario} ${pontoParaMencionar} é um lugar que todo cachorro devia visitar! 🐾`
  ];
  
  return padroes[Math.floor(Math.random() * padroes.length)];
}

// Função simplificada - apenas adiciona aeroportos se faltarem
function ensureTouristAttractionsAndComments(jsonString, requestData) {
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    let modificado = false;
    
    // Adicionar códigos IATA apenas se faltarem
    if (data.topPick && !data.topPick.aeroporto?.codigo) {
      data.topPick.aeroporto = {
        codigo: obterCodigoIATAPadrao(data.topPick.destino, data.topPick.pais),
        nome: `Aeroporto de ${data.topPick.destino}`
      };
      modificado = true;
    }
    
    if (data.surpresa && !data.surpresa.aeroporto?.codigo) {
      data.surpresa.aeroporto = {
        codigo: obterCodigoIATAPadrao(data.surpresa.destino, data.surpresa.pais),
        nome: `Aeroporto de ${data.surpresa.destino}`
      };
      modificado = true;
    }
    
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
    console.error("Erro ao processar dados:", error);
    return jsonString;
  }
}

// =======================
// Geração de prompt padrão - SEM CÁLCULOS DE ESTAÇÃO
// =======================
function gerarPromptParaDestinos(dados) {
  const infoViajante = {
    companhia: getCompanhiaText(dados.companhia || 0),
    preferencia: getPreferenciaText(dados.preferencia_viagem || 0),
    cidadeOrigem: dados.cidade_partida?.name || 'origem não especificada',
    orcamento: dados.orcamento_valor || 'flexível',
    moeda: dados.moeda_escolhida || 'BRL',
    pessoas: dados.quantidade_familia || dados.quantidade_amigos || 1,
    conheceDestino: dados.conhece_destino || 0,
    tipoDestino: dados.tipo_destino || 'qualquer',
    famaDestino: dados.fama_destino || 'qualquer'
  };
  
  let dataIda = 'não especificada';
  let dataVolta = 'não especificada';
  let duracaoViagem = 'não especificada';
  
  if (dados.datas) {
    if (typeof dados.datas === 'string' && dados.datas.includes(',')) {
      const partes = dados.datas.split(',');
      dataIda = partes[0] || 'não especificada';
      dataVolta = partes[1] || 'não especificada';
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
    } catch {}
  }
  
  const mensagemOrcamento = infoViajante.orcamento !== 'flexível' ?
    `⚠️ ORÇAMENTO MÁXIMO: ${infoViajante.orcamento} ${infoViajante.moeda} para voos. Todos os destinos DEVEM ter preços próximos a este valor.` : 
    'Orçamento flexível';
  
  const sugestaoDistancia = infoViajante.cidadeOrigem.toLowerCase().includes('são paulo') || 
                           infoViajante.cidadeOrigem.toLowerCase().includes('nova york') ? 
    '(considere incluir destinos intercontinentais)' : '(considere a distância e acessibilidade)';

  return `Crie recomendações de viagem que respeitam ESTRITAMENTE o orçamento do usuário:

${mensagemOrcamento}

PERFIL DO VIAJANTE:
- Partindo de: ${infoViajante.cidadeOrigem} ${sugestaoDistancia}
- Viajando: ${infoViajante.companhia}
- Número de pessoas: ${infoViajante.pessoas}
- Atividades preferidas: ${infoViajante.preferencia}
- Período da viagem: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Experiência como viajante: ${infoViajante.conheceDestino === 1 ? 'Com experiência' : 'Iniciante'} 
- Preferência por destinos: ${getTipoDestinoText(infoViajante.tipoDestino)}
- Popularidade do destino: ${getFamaDestinoText(infoViajante.famaDestino)}

IMPORTANTE:
1. Com base na sua experiência traga destinos em que o preço do VOO de IDA e VOLTA sejam PRÓXIMOS do orçamento de ${infoViajante.orcamento} ${infoViajante.moeda}.
2. Forneça um mix equilibrado: inclua tanto destinos populares quanto alternativas.
3. Forneça 6 destinos alternativos diferentes entre si.
4. Garanta que os destinos sejam sejam realistas para o orçamento voos de ida e volta partindo de ${infoViajante.cidadeOrigem}.
5. Para CADA destino, inclua o código IATA (3 letras) do aeroporto principal.
6. Para cada destino, INCLUA PONTOS TURÍSTICOS ESPECÍFICOS E CONHECIDOS.
7. Os comentários da Tripinha DEVEM ser em 1a pessoa e comentar curiosidades que ela conhece sobre o local.
8. OBRIGATÓRIO: Forneça informações COMPLETAS sobre o CLIMA esperado no destino durante a viagem (estação, temperatura média, condições e recomendações).

Forneça no formato JSON exato abaixo, SEM formatação markdown:
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão específica para visitar",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário entusiasmado da Tripinha em 1ª pessoa, falando sobre como foi sua experiência no local",
    "pontosTuristicos": [
      "Nome do Primeiro Ponto Turístico", 
      "Nome do Segundo Ponto Turístico"
    ],
    "clima": {
      "estacao": "Estação do ano no destino durante o período da viagem",
      "temperatura": "Faixa de temperatura média esperada",
      "condicoes": "Descrição das condições climáticas esperadas",
      "recomendacoes": "Dicas relacionadas ao clima"
    },
    "aeroporto": {
      "codigo": "XYZ",
      "nome": "Nome do Aeroporto Principal"
    },
    "preco": {
      "voo": número,
      "hotel": número
    }
  },
  "alternativas": [
    {
      "destino": "Nome da Cidade 1",
      "pais": "Nome do País 1", 
      "codigoPais": "XX",
      "porque": "Razão específica para visitar",
      "pontoTuristico": "Nome de um Ponto Turístico",
      "clima": {
        "estacao": "Estação do ano no destino",
        "temperatura": "Faixa de temperatura média esperada"
      },
      "aeroporto": {
        "codigo": "XYZ",
        "nome": "Nome do Aeroporto Principal"
      },
      "preco": {
        "voo": número,
        "hotel": número
      }
    },
    ...
  ],
  "surpresa": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão para visitar, destacando o fator surpresa",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário entusiasmado da Tripinha em 1ª pessoa, comentando como foi sua experiencia no local",
    "pontosTuristicos": [
      "Nome do Primeiro Ponto Turístico", 
      "Nome do Segundo Ponto Turístico"
    ],
    "clima": {
      "estacao": "Estação do ano no destino durante o período da viagem",
      "temperatura": "Faixa de temperatura média esperada",
      "condicoes": "Descrição das condições climáticas esperadas",
      "recomendacoes": "Dicas relacionadas ao clima"
    },
    "aeroporto": {
      "codigo": "XYZ",
      "nome": "Nome do Aeroporto Principal"
    },
    "preco": {
      "voo": número,
      "hotel": número
    }
  },
  "estacaoViagem": "Estação determinada com base nos destinos recomendados"
}`;
}

// Funções auxiliares simplificadas
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
// Função principal - Handler da API SEM FALLBACK
// =======================
module.exports = async function handler(req, res) {
  let isResponseSent = false;
  const serverTimeout = setTimeout(() => {
    if (!isResponseSent) {
      isResponseSent = true;
      console.log('Timeout do servidor atingido');
      return res.status(500).json({
        tipo: "erro",
        message: "Não foi possível obter recomendações no momento. Por favor, tente novamente.",
        error: "timeout"
      });
    }
  }, CONFIG.timeout.handler);

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
    if (!req.body) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(400).json({ error: "Nenhum dado fornecido na requisição" });
    }
    
    const requestData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // ============= DIAGNÓSTICO =============
    console.log('🔍 DIAGNÓSTICO (Versão SEM FALLBACKS):');
    console.log('📄 Dados da requisição:', JSON.stringify(requestData, null, 2));
    
    const providers = CONFIG.providerOrder.filter(
      provider => process.env[`${provider.toUpperCase()}_API_KEY`]
    );
    console.log('🔑 Provedores disponíveis:', providers);
    
    if (providers.length === 0) {
      console.error('❌ Nenhum provedor de IA configurado');
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(500).json({ 
          tipo: "erro",
          message: "Serviço temporariamente indisponível. Configure as chaves de API.",
          error: "no_providers"
        });
      }
      return;
    }
    
    let tentativasDetalhadas = [];
    const prompt = gerarPromptParaDestinos(requestData);
    const orcamento = requestData.orcamento_valor ? parseFloat(requestData.orcamento_valor) : null;
    
    // Tentar cada provedor
    for (const provider of providers) {
      try {
        console.log(`🤖 TENTANDO ${provider.toUpperCase()}...`);
        const responseAI = await callAIAPI(provider, prompt, requestData);
        
        console.log(`📥 Resposta bruta ${provider}:`, responseAI ? responseAI.substring(0, 500) + '...' : 'NULA');
        
        let processedResponse = responseAI;
        if (responseAI && utils.isPartiallyValidJSON(responseAI)) {
          console.log(`✅ ${provider}: JSON parcialmente válido`);
          processedResponse = ensureTouristAttractionsAndComments(responseAI, requestData);
          console.log(`🔧 ${provider}: Resposta processada`);
        } else {
          console.log(`❌ ${provider}: JSON inválido ou nulo`);
        }
        
        // Validação
        if (processedResponse) {
          const isValid = utils.isValidDestinationJSON(processedResponse, requestData);
          console.log(`🎯 ${provider}: Validação final = ${isValid}`);
          
          if (!isValid) {
            try {
              const data = typeof processedResponse === 'string' ? JSON.parse(processedResponse) : processedResponse;
              console.log(`❓ ${provider}: Estrutura da resposta:`, {
                hasTopPick: !!data.topPick,
                hasTopPickDestino: !!data.topPick?.destino,
                hasAlternativas: !!data.alternativas,
                alternativasLength: data.alternativas?.length,
                hasSurpresa: !!data.surpresa,
                hasSurpresaDestino: !!data.surpresa?.destino,
                climaTopPick: !!data.topPick?.clima,
                climaSurpresa: !!data.surpresa?.clima
              });
            } catch (e) {
              console.log(`❓ ${provider}: Erro ao analisar estrutura:`, e.message);
            }
          }
        }
        
        tentativasDetalhadas.push({
          provider,
          success: !!processedResponse && utils.isValidDestinationJSON(processedResponse, requestData),
          hasResponse: !!responseAI,
          isValidJSON: !!responseAI && utils.isPartiallyValidJSON(responseAI),
          finalValidation: !!processedResponse && utils.isValidDestinationJSON(processedResponse, requestData)
        });
        
        if (processedResponse && utils.isValidDestinationJSON(processedResponse, requestData)) {
          console.log(`🎉 ${provider}: SUCESSO! Usando recomendações da IA (sem fallbacks)`);
          
          try {
            const recomendacoes = typeof processedResponse === 'string' ? 
              JSON.parse(processedResponse) : processedResponse;
            
            if (orcamento) {
              recomendacoes.orcamentoMaximo = orcamento;
            }
            
            const datas = obterDatasViagem(requestData);
            const recomendacoesProcessadas = await processarDestinos(recomendacoes, datas);
            
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: `${provider}_success_no_fallback`,
                conteudo: JSON.stringify(recomendacoesProcessadas)
              });
            }
            return;
          } catch (processError) {
            console.error('Erro ao processar recomendações:', processError.message);
          }
          
          if (!isResponseSent) {
            isResponseSent = true;
            clearTimeout(serverTimeout);
            return res.status(200).json({
              tipo: `${provider}_no_fallback`,
              conteudo: processedResponse
            });
          }
          return;
        } else {
          console.log(`Resposta de ${provider} não passou na validação. Tentando próximo provedor...`);
        }
      } catch (error) {
        console.error(`💥 Erro ${provider}:`, error.message);
        tentativasDetalhadas.push({
          provider,
          success: false,
          error: error.message
        });
      }
    }
    
    // Se chegou aqui, todos os provedores falharam
    console.log('🚨 TODOS OS PROVEDORES FALHARAM (sem fallbacks)!');
    console.log('📊 Resumo das tentativas:', tentativasDetalhadas);
    
    // SEM FALLBACK - Retornar erro
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(503).json({
        tipo: "erro",
        message: "Não foi possível obter recomendações de destinos no momento. Por favor, tente novamente em alguns instantes.",
        error: "all_providers_failed_no_fallback",
        details: tentativasDetalhadas.map(t => ({
          provider: t.provider,
          success: t.success,
          error: t.error
        }))
      });
    }
    
  } catch (globalError) {
    console.error('Erro global:', globalError.message);
    
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(500).json({ 
        tipo: "erro",
        message: "Erro interno do servidor. Por favor, tente novamente.",
        error: globalError.message
      });
    }
  } finally {
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      res.status(500).json({
        tipo: "erro",
        message: "Erro inesperado. Por favor, tente novamente.",
        error: "unexpected_error"
      });
    }
  }
};
