// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
const axios = require('axios');
const http = require('http');
const https = require('https');

// =======================
// Configurações
// =======================
const CONFIG = {
  timeout: {
    request: 50000,
    handler: 300000,
    retry: 1500,
    deepseek: 90000  // Timeout maior para DeepSeek (90 segundos)
  },
  retries: 2,
  logging: {
    enabled: true,
    maxLength: 500
  },
  // DeepSeek como primeiro provedor
  providerOrder: ['deepseek', 'openai', 'claude', 'perplexity']
};

// =======================
// Cliente HTTP configurado com configurações específicas
// =======================
const apiClient = axios.create({
  timeout: CONFIG.timeout.request,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

// Cliente específico para DeepSeek com configurações otimizadas
const deepseekClient = axios.create({
  timeout: CONFIG.timeout.deepseek,
  httpAgent: new http.Agent({ 
    keepAlive: true,
    timeout: CONFIG.timeout.deepseek,
    maxSockets: 1
  }),
  httpsAgent: new https.Agent({ 
    keepAlive: true,
    timeout: CONFIG.timeout.deepseek,
    maxSockets: 1
  })
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
  
  isValidDestinationJSON: (jsonString, requestData) => {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      
      if (!data.topPick?.destino || !data.alternativas || !data.surpresa?.destino) return false;
      if (!data.topPick.pontosTuristicos?.length || data.topPick.pontosTuristicos.length < 2) return false;
      if (!data.surpresa.pontosTuristicos?.length || data.surpresa.pontosTuristicos.length < 2) return false;
      if (!Array.isArray(data.alternativas) || data.alternativas.length !== 4) return false;
      
      if (!data.alternativas.every(alt => alt.pontoTuristico)) return false;
      
      if (!data.topPick.comentario || !data.topPick.pontosTuristicos.some(
        attraction => data.topPick.comentario.toLowerCase().includes(attraction.toLowerCase())
      )) return false;
      
      if (!data.surpresa.comentario || !data.surpresa.pontosTuristicos.some(
        attraction => data.surpresa.comentario.toLowerCase().includes(attraction.toLowerCase())
      )) return false;
      
      if (requestData?.orcamento_valor && !isNaN(parseFloat(requestData.orcamento_valor))) {
        const orcamentoMax = parseFloat(requestData.orcamento_valor);
        if (data.topPick.preco?.voo > orcamentoMax || data.alternativas[0]?.preco?.voo > orcamentoMax) {
          return false;
        }
      }
      
      if (data.topPick.destino?.toLowerCase() === data.alternativas[0]?.destino?.toLowerCase()) {
        return false;
      }
      
      if (!data.topPick.aeroporto?.codigo || !data.surpresa.aeroporto?.codigo) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao validar JSON de destino:', error.message);
      return false;
    }
  }
};

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
// Processamento de destinos (sem enriquecimento com preços de voos)
// =======================
async function processarDestinos(recomendacoes, datas) {
  try {
    if (!recomendacoes.estacaoViagem && datas.dataIda) {
      try {
        const dataObj = new Date(datas.dataIda);
        const mes = dataObj.getMonth();
        let estacaoViagem = '';
        
        if (mes >= 2 && mes <= 4) estacaoViagem = 'primavera';
        else if (mes >= 5 && mes <= 7) estacaoViagem = 'verão';
        else if (mes >= 8 && mes <= 10) estacaoViagem = 'outono';
        else estacaoViagem = 'inverno';
        
        if (recomendacoes.topPick?.pais?.toLowerCase().includes('brasil')) {
          const mapaEstacoes = {
            'verão': 'inverno',
            'inverno': 'verão',
            'primavera': 'outono',
            'outono': 'primavera'
          };
          estacaoViagem = mapaEstacoes[estacaoViagem] || estacaoViagem;
        }
        
        recomendacoes.estacaoViagem = estacaoViagem;
      } catch (error) {
        console.warn('Erro ao determinar estação do ano:', error);
      }
    }
    
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
// Prompt Deepseek otimizado (mais conciso)
// =======================
function gerarPromptParaDeepseek(dados) {
  const infoViajante = {
    companhia: getCompanhiaText(dados.companhia || 0),
    preferencia: getPreferenciaText(dados.preferencia_viagem || 0),
    cidadeOrigem: dados.cidade_partida?.name || 'origem não especificada',
    orcamento: dados.orcamento_valor || 'flexível',
    moeda: dados.moeda_escolhida || 'BRL',
    pessoas: dados.quantidade_familia || dados.quantidade_amigos || 1
  };
  
  let dataIda = 'não especificada';
  let dataVolta = 'não especificada';
  
  if (dados.datas) {
    if (typeof dados.datas === 'string' && dados.datas.includes(',')) {
      const partes = dados.datas.split(',');
      dataIda = partes[0] || 'não especificada';
      dataVolta = partes[1] || 'não especificada';
    } else if (dados.datas.dataIda && dados.datas.dataVolta) {
      dataIda = dados.datas.dataIda;
      dataVolta = dados.datas.dataVolta;
    }
  }
  
  const mensagemOrcamento = infoViajante.orcamento !== 'flexível' ?
    `Orçamento máximo para voos: ${infoViajante.orcamento} ${infoViajante.moeda}` : 
    'Orçamento flexível';

  return `Crie recomendações de destinos de viagem em JSON:

PERFIL:
- Origem: ${infoViajante.cidadeOrigem}
- Viajantes: ${infoViajante.companhia} (${infoViajante.pessoas} pessoa(s))
- Preferências: ${infoViajante.preferencia}
- Datas: ${dataIda} a ${dataVolta}
- ${mensagemOrcamento}

⚠️ CÓDIGOS IATA OBRIGATÓRIOS: Para cada destino, use APENAS o código IATA real do MAIOR E MAIS CONHECIDO AEROPORTO PRÓXIMO da cidade. Exemplos corretos:
- São Paulo → GRU (Guarulhos)
- Rio de Janeiro → GIG (Galeão) 
- Londres → LHR (Heathrow)
- Paris → CDG (Charles de Gaulle)
- Nova York → JFK (Kennedy)
- Madrid → MAD (Barajas)
- Roma → FCO (Fiumicino)
- Tóquio → HND (Haneda) ou NRT (Narita)

RETORNE JSON com esta estrutura exata:
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País", 
    "codigoPais": "XX",
    "descricao": "Descrição breve",
    "porque": "Razão para visitar",
    "destaque": "Experiência única",
    "comentario": "Comentário da Tripinha mencionando 1 ponto turístico específico",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"],
    "clima": {
      "temperatura": "15°C-25°C",
      "condicoes": "Ensolarado",
      "recomendacoes": "Roupas leves"
    },
    "aeroporto": {
      "codigo": "XYZ",
      "nome": "Nome do Aeroporto Principal Próximo"
    },
    "preco": {
      "voo": 1500,
      "hotel": 200
    }
  },
  "alternativas": [
    {
      "destino": "Cidade",
      "pais": "País",
      "codigoPais": "XX", 
      "porque": "Razão",
      "pontoTuristico": "Ponto turístico",
      "clima": {"temperatura": "20°C-30°C"},
      "aeroporto": {"codigo": "ABC", "nome": "Aeroporto Principal Real"},
      "preco": {"voo": 1200, "hotel": 180}
    }
  ],
  "surpresa": {
    "destino": "Cidade Surpresa",
    "pais": "País",
    "codigoPais": "XX",
    "descricao": "Descrição",
    "porque": "Razão surpresa",
    "destaque": "Experiência única",
    "comentario": "Comentário Tripinha com ponto turístico",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"],
    "clima": {
      "temperatura": "18°C-28°C",
      "condicoes": "Agradável",
      "recomendacoes": "Roupas variadas"
    },
    "aeroporto": {"codigo": "DEF", "nome": "Aeroporto Principal Real"},
    "preco": {"voo": 1800, "hotel": 250}
  }
}

CRÍTICO:
- Use APENAS códigos IATA reais de aeroportos principais (3 letras maiúsculas)
- Se não souber o código exato, use o aeroporto internacional principal da cidade
- Inclua EXATAMENTE 4 destinos em "alternativas"
- Preços de voos devem respeitar o orçamento
- Tripinha é uma cachorrinha aventureira 🐾
- Mencione pontos turísticos reais e específicos`;
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
      model: 'deepseek-chat',
      systemMessage: 'Você é um especialista em viagens. Seja conciso e retorne apenas JSON válido com destinos detalhados.',
      temperature: 0.5,  // Reduzir temperatura para mais eficiência
      max_tokens: 2500,  // Reduzir tokens para respostas mais rápidas
      response_format: { type: 'json_object' },
      timeout: CONFIG.timeout.deepseek  // Timeout específico para DeepSeek
    },
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      header: 'Authorization',
      prefix: 'Bearer',
      model: 'gpt-3.5-turbo',
      systemMessage: 'Você é um especialista em viagens. Retorne apenas JSON com 4 destinos alternativos, respeitando o orçamento para voos.',
      temperature: 0.2,
      max_tokens: 2000
    },
    claude: {
      url: 'https://api.anthropic.com/v1/messages',
      header: 'x-api-key',
      prefix: '',
      model: 'claude-3-haiku-20240307',
      systemMessage: 'Você é um especialista em viagens. Retorne apenas JSON com 4 destinos alternativos, respeitando o orçamento para voos.',
      temperature: 0.7,
      max_tokens: 2000
    },
    perplexity: {
      url: 'https://api.perplexity.ai/chat/completions',
      header: 'Authorization',
      prefix: 'Bearer',
      model: 'sonar',
      systemMessage: 'Você é um especialista em viagens. Sua prioridade é não exceder o orçamento para voos. Retorne apenas JSON puro com 4 destinos alternativos.',
      temperature: 0.5,
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

  // Usar prompt específico para DeepSeek ou prompt genérico para outros
  const finalPrompt = provider === 'deepseek' 
    ? gerarPromptParaDeepseek(requestData)
    : `${prompt}
  
IMPORTANTE: 
1. Cada voo DEVE respeitar o orçamento.
2. Retorne apenas JSON válido.
3. Forneça 4 destinos alternativos.
4. Inclua pontos turísticos específicos.
5. Inclua o código IATA de cada aeroporto.`;

  try {
    utils.log(`Enviando requisição para ${provider} (timeout: ${config.timeout || CONFIG.timeout.request}ms)...`, null);
    
    let requestData;
    
    if (provider === 'claude') {
      requestData = {
        model: config.model,
        max_tokens: config.max_tokens || 2000,
        messages: [
          {
            role: "user",
            content: finalPrompt
          }
        ],
        temperature: config.temperature || 0.7
      };
    } else {
      requestData = {
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
      
      // Adicionar response_format para DeepSeek
      if (provider === 'deepseek' && config.response_format) {
        requestData.response_format = config.response_format;
      }
      
      if (provider === 'perplexity') {
        requestData.response_format = { type: "text" };
      }
    }
    
    const headers = {
      'Content-Type': 'application/json'
    };
    headers[config.header] = config.prefix ? `${config.prefix} ${apiKey}` : apiKey;
    
    if (provider === 'claude') {
      headers['anthropic-version'] = '2023-06-01';
    }
    
    // Usar timeout específico para cada provedor
    const timeoutValue = config.timeout || CONFIG.timeout.request;
    
    // Usar cliente específico para DeepSeek
    const client = provider === 'deepseek' ? deepseekClient : apiClient;
    
    const response = await client({
      method: 'post',
      url: config.url,
      headers,
      data: requestData,
      timeout: timeoutValue
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
            surpresa: dados.surpresa?.destino
          });
        }
      } catch (error) {
        console.error('Erro ao analisar resposta do Deepseek:', error.message);
      }
    }
    
    return utils.extrairJSONDaResposta(content);
  } catch (error) {
    console.error(`Erro na chamada à API ${provider}:`, error.message);
    
    // Log específico para timeout
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout') || error.message.includes('aborted')) {
      console.error(`Timeout na API ${provider} após ${config.timeout || CONFIG.timeout.request}ms`);
    }
    
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

const pontosPopulares = {
  "Paris": ["Torre Eiffel", "Museu do Louvre"],
  "Roma": ["Coliseu", "Vaticano"],
  "Nova York": ["Central Park", "Times Square"],
  "Tóquio": ["Torre de Tóquio", "Shibuya Crossing"],
  "Rio de Janeiro": ["Cristo Redentor", "Pão de Açúcar"],
  "Lisboa": ["Torre de Belém", "Alfama"],
  "Barcelona": ["Sagrada Família", "Parque Güell"],
  "Londres": ["Big Ben", "London Eye"],
  "Cidade do México": ["Zócalo", "Teotihuacán"],
  "Dubai": ["Burj Khalifa", "Dubai Mall"],
  "Bangkok": ["Grande Palácio", "Templo do Buda de Esmeralda"],
  "Buenos Aires": ["Casa Rosada", "La Boca"],
  "Amsterdã": ["Museu Van Gogh", "Canais"],
  "Berlim": ["Portão de Brandemburgo", "Muro de Berlim"],
  "Praga": ["Castelo de Praga", "Ponte Carlos"],
  "Istambul": ["Hagia Sophia", "Grande Bazar"],
  "Cairo": ["Pirâmides de Gizé", "Museu Egípcio"],
  "Machu Picchu": ["Cidadela Inca", "Huayna Picchu"],
  "Sydney": ["Opera House", "Harbour Bridge"],
  "Veneza": ["Praça São Marcos", "Canal Grande"],
  "Marrakech": ["Medina", "Jardim Majorelle"],
  "Kyoto": ["Templo Kinkaku-ji", "Floresta de Bambu Arashiyama"],
  "Santorini": ["Oia", "Praias Vulcânicas"],
  "Cartagena": ["Cidade Amuralhada", "Praias Ilhas Rosário"],
  "Medellín": ["Comuna 13", "Parque Arví"],
  "San José": ["Teatro Nacional", "Vulcão Poás"],
  "generico_Brasil": ["Praias paradisíacas", "Parques nacionais"],
  "generico_Europa": ["Praças históricas", "Museus de arte"],
  "generico_Asia": ["Templos antigos", "Mercados tradicionais"],
  "generico_America": ["Parques nacionais", "Centros urbanos"]
};

async function ensureTouristAttractionsAndComments(jsonString, requestData) {
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    let modificado = false;
    
    // Processar topPick
    if (data.topPick) {
      if (!data.topPick.pontosTuristicos?.length || data.topPick.pontosTuristicos.length < 2) {
        const destino = data.topPick.destino;
        data.topPick.pontosTuristicos = pontosPopulares[destino] || 
          ["Principais atrativos da cidade", "Pontos históricos"];
        modificado = true;
      }
      
      if (data.topPick.comentario) {
        const novoComentario = enriquecerComentarioTripinha(
          data.topPick.comentario, data.topPick.pontosTuristicos
        );
        if (novoComentario && novoComentario !== data.topPick.comentario) {
          data.topPick.comentario = novoComentario;
          modificado = true;
        }
      } else {
        const pontoTuristico = data.topPick.pontosTuristicos[0] || "esse lugar incrível";
        data.topPick.comentario = `${data.topPick.destino} é um sonho! Adorei passear por ${pontoTuristico} e sentir todos aqueles cheiros novos! Uma aventura incrível para qualquer cachorro explorador! 🐾`;
        modificado = true;
      }
      
      // Validar e corrigir aeroporto do topPick
      if (!data.topPick.aeroporto?.codigo || !utils.validarCodigoIATA(data.topPick.aeroporto.codigo)) {
        try {
          const aeroportoValidado = await validarECorrigirAeroporto(
            data.topPick.destino, 
            data.topPick.pais, 
            data.topPick.aeroporto?.codigo
          );
          data.topPick.aeroporto = aeroportoValidado;
          modificado = true;
          console.log(`Aeroporto corrigido para ${data.topPick.destino}: ${aeroportoValidado.codigo}`);
        } catch (error) {
          console.warn(`Erro ao validar aeroporto para ${data.topPick.destino}:`, error.message);
          data.topPick.aeroporto = obterCodigoIATAMelhorado(data.topPick.destino, data.topPick.pais);
          modificado = true;
        }
      }
      
      if (!data.topPick.clima) {
        data.topPick.clima = {
          temperatura: "Temperatura típica para a estação",
          condicoes: "Condições climáticas normais para o período",
          recomendacoes: "Leve roupas adequadas para a estação"
        };
        modificado = true;
      }
    }
    
    // Processar surpresa
    if (data.surpresa) {
      if (!data.surpresa.pontosTuristicos?.length || data.surpresa.pontosTuristicos.length < 2) {
        const destino = data.surpresa.destino;
        data.surpresa.pontosTuristicos = pontosPopulares[destino] || 
          ["Locais exclusivos", "Atrativos menos conhecidos"];
        modificado = true;
      }
      
      if (data.surpresa.comentario) {
        const novoComentario = enriquecerComentarioTripinha(
          data.surpresa.comentario, data.surpresa.pontosTuristicos
        );
        if (novoComentario && novoComentario !== data.surpresa.comentario) {
          data.surpresa.comentario = novoComentario;
          modificado = true;
        }
      } else {
        const pontoTuristico = data.surpresa.pontosTuristicos[0] || "esse lugar secreto";
        data.surpresa.comentario = `${data.surpresa.destino} é uma descoberta incrível! Poucos conhecem ${pontoTuristico}, mas é um paraíso para cachorros curiosos como eu! Tantos aromas novos para farejar! 🐾🌟`;
        modificado = true;
      }
      
      // Validar e corrigir aeroporto da surpresa
      if (!data.surpresa.aeroporto?.codigo || !utils.validarCodigoIATA(data.surpresa.aeroporto.codigo)) {
        try {
          const aeroportoValidado = await validarECorrigirAeroporto(
            data.surpresa.destino, 
            data.surpresa.pais, 
            data.surpresa.aeroporto?.codigo
          );
          data.surpresa.aeroporto = aeroportoValidado;
          modificado = true;
          console.log(`Aeroporto corrigido para ${data.surpresa.destino}: ${aeroportoValidado.codigo}`);
        } catch (error) {
          console.warn(`Erro ao validar aeroporto para ${data.surpresa.destino}:`, error.message);
          data.surpresa.aeroporto = obterCodigoIATAMelhorado(data.surpresa.destino, data.surpresa.pais);
          modificado = true;
        }
      }
      
      if (!data.surpresa.clima) {
        data.surpresa.clima = {
          temperatura: "Temperatura típica para a estação",
          condicoes: "Condições climáticas normais para o período",
          recomendacoes: "Leve roupas adequadas para a estação"
        };
        modificado = true;
      }
    }
    
    // Processar alternativas
    if (!data.alternativas || !Array.isArray(data.alternativas)) {
      data.alternativas = [];
      modificado = true;
    }
    
    // Validar aeroportos das alternativas existentes
    for (let i = 0; i < data.alternativas.length; i++) {
      const alternativa = data.alternativas[i];
      
      if (!alternativa.pontoTuristico) {
        const destino = alternativa.destino;
        alternativa.pontoTuristico = (pontosPopulares[destino] || ["Atrações turísticas"])[0];
        modificado = true;
      }
      
      if (!alternativa.aeroporto?.codigo || !utils.validarCodigoIATA(alternativa.aeroporto.codigo)) {
        try {
          const aeroportoValidado = await validarECorrigirAeroporto(
            alternativa.destino, 
            alternativa.pais, 
            alternativa.aeroporto?.codigo
          );
          alternativa.aeroporto = aeroportoValidado;
          modificado = true;
          console.log(`Aeroporto corrigido para ${alternativa.destino}: ${aeroportoValidado.codigo}`);
        } catch (error) {
          console.warn(`Erro ao validar aeroporto para ${alternativa.destino}:`, error.message);
          alternativa.aeroporto = obterCodigoIATAMelhorado(alternativa.destino, alternativa.pais);
          modificado = true;
        }
      }
      
      if (!alternativa.clima) {
        alternativa.clima = {
          temperatura: "Temperatura típica para a estação"
        };
        modificado = true;
      }
    }
    
    // Completar alternativas se necessário (usando aeroportos validados)
    const destinosReserva = ["Lisboa", "Barcelona", "Roma", "Tóquio"];
    const paisesReserva = ["Portugal", "Espanha", "Itália", "Japão"];
    const codigosPaisesReserva = ["PT", "ES", "IT", "JP"];
    
    while (data.alternativas.length < 4) {
      const index = data.alternativas.length % destinosReserva.length;
      const destino = destinosReserva[index];
      const pais = paisesReserva[index];
      const pontosConhecidos = pontosPopulares[destino] || ["Atrações turísticas"];
      
      // Usar aeroporto validado para destinos de reserva
      const aeroportoReserva = obterCodigoIATAMelhorado(destino, pais);
      
      data.alternativas.push({
        destino: destino,
        pais: pais,
        codigoPais: codigosPaisesReserva[index],
        porque: `Cidade com rica história, gastronomia única e atmosfera encantadora`,
        pontoTuristico: pontosConhecidos[0] || "Atrações turísticas",
        aeroporto: aeroportoReserva,
        clima: {
          temperatura: "Temperatura típica para a estação"
        },
        preco: {
          voo: 1500,
          hotel: 200
        }
      });
      
      modificado = true;
    }
    
    if (data.alternativas.length > 4) {
      data.alternativas = data.alternativas.slice(0, 4);
      modificado = true;
    }
    
    return modificado ? JSON.stringify(data) : jsonString;
  } catch (error) {
    console.error("Erro ao processar pontos turísticos e aeroportos:", error);
    return jsonString;
  }
}

// =======================
// Validação de aeroportos usando API Aviasales
// =======================
async function validarECorrigirAeroporto(cidade, pais, codigoAtual) {
  try {
    // Se o código atual parece válido (3 letras maiúsculas), tenta validar
    if (codigoAtual && /^[A-Z]{3}$/.test(codigoAtual)) {
      return { codigo: codigoAtual, nome: `Aeroporto de ${cidade}` };
    }
    
    // Usa API de Autocomplete do Aviasales para encontrar aeroporto principal
    const termoBusca = `${cidade} airport`;
    const response = await axios.get(
      `https://autocomplete.travelpayouts.com/places2?term=${encodeURIComponent(termoBusca)}&locale=en&types[]=airport`,
      { timeout: 5000 }
    );
    
    if (response.data && response.data.length > 0) {
      // Procura o aeroporto com maior peso (mais importante)
      const aeroportos = response.data
        .filter(item => item.type === 'airport' && item.city_name && 
                item.city_name.toLowerCase().includes(cidade.toLowerCase()))
        .sort((a, b) => (b.weight || 0) - (a.weight || 0));
      
      if (aeroportos.length > 0) {
        const melhorAeroporto = aeroportos[0];
        return {
          codigo: melhorAeroporto.code,
          nome: melhorAeroporto.name || `Aeroporto de ${cidade}`
        };
      }
    }
    
    // Se não encontrou, usa fallback melhorado
    return obterCodigoIATAMelhorado(cidade, pais);
    
  } catch (error) {
    console.warn(`Erro ao validar aeroporto para ${cidade}:`, error.message);
    return obterCodigoIATAMelhorado(cidade, pais);
  }
}

// Função de fallback melhorada com lista expandida
function obterCodigoIATAMelhorado(cidade, pais) {
  // Lista expandida dos aeroportos principais por cidade
  const mapeamentoCompleto = {
    // Brasil
    'São Paulo': { codigo: 'GRU', nome: 'Aeroporto Internacional de Guarulhos' },
    'Rio de Janeiro': { codigo: 'GIG', nome: 'Aeroporto Internacional do Galeão' },
    'Brasília': { codigo: 'BSB', nome: 'Aeroporto Internacional de Brasília' },
    'Belo Horizonte': { codigo: 'CNF', nome: 'Aeroporto Internacional Tancredo Neves' },
    'Salvador': { codigo: 'SSA', nome: 'Aeroporto Internacional Deputado Luís Eduardo Magalhães' },
    'Fortaleza': { codigo: 'FOR', nome: 'Aeroporto Internacional Pinto Martins' },
    'Recife': { codigo: 'REC', nome: 'Aeroporto Internacional dos Guararapes' },
    'Manaus': { codigo: 'MAO', nome: 'Aeroporto Internacional Eduardo Gomes' },
    
    // América do Sul
    'Buenos Aires': { codigo: 'EZE', nome: 'Aeroporto Internacional Ezeiza' },
    'Santiago': { codigo: 'SCL', nome: 'Aeroporto Internacional Arturo Merino Benítez' },
    'Lima': { codigo: 'LIM', nome: 'Aeroporto Internacional Jorge Chávez' },
    'Bogotá': { codigo: 'BOG', nome: 'Aeroporto Internacional El Dorado' },
    'Cartagena': { codigo: 'CTG', nome: 'Aeroporto Internacional Rafael Núñez' },
    'Medellín': { codigo: 'MDE', nome: 'Aeroporto Internacional José María Córdova' },
    'Montevidéu': { codigo: 'MVD', nome: 'Aeroporto Internacional de Carrasco' },
    'La Paz': { codigo: 'LPB', nome: 'Aeroporto Internacional El Alto' },
    'Quito': { codigo: 'UIO', nome: 'Aeroporto Internacional Mariscal Sucre' },
    
    // América do Norte
    'Nova York': { codigo: 'JFK', nome: 'Aeroporto Internacional John F. Kennedy' },
    'Los Angeles': { codigo: 'LAX', nome: 'Aeroporto Internacional de Los Angeles' },
    'Miami': { codigo: 'MIA', nome: 'Aeroporto Internacional de Miami' },
    'Chicago': { codigo: 'ORD', nome: 'Aeroporto Internacional O\'Hare' },
    'San Francisco': { codigo: 'SFO', nome: 'Aeroporto Internacional de San Francisco' },
    'Las Vegas': { codigo: 'LAS', nome: 'Aeroporto Internacional McCarran' },
    'Toronto': { codigo: 'YYZ', nome: 'Aeroporto Internacional Pearson' },
    'Vancouver': { codigo: 'YVR', nome: 'Aeroporto Internacional de Vancouver' },
    'Cidade do México': { codigo: 'MEX', nome: 'Aeroporto Internacional Benito Juárez' },
    'Cancún': { codigo: 'CUN', nome: 'Aeroporto Internacional de Cancún' },
    
    // Europa
    'Londres': { codigo: 'LHR', nome: 'Aeroporto de Heathrow' },
    'Paris': { codigo: 'CDG', nome: 'Aeroporto Charles de Gaulle' },
    'Roma': { codigo: 'FCO', nome: 'Aeroporto Leonardo da Vinci' },
    'Madri': { codigo: 'MAD', nome: 'Aeroporto Adolfo Suárez Madrid-Barajas' },
    'Lisboa': { codigo: 'LIS', nome: 'Aeroporto Humberto Delgado' },
    'Porto': { codigo: 'OPO', nome: 'Aeroporto Francisco Sá Carneiro' },
    'Barcelona': { codigo: 'BCN', nome: 'Aeroporto de Barcelona-El Prat' },
    'Amsterdã': { codigo: 'AMS', nome: 'Aeroporto de Amsterdã Schiphol' },
    'Berlim': { codigo: 'BER', nome: 'Aeroporto de Berlim Brandemburgo' },
    'Munique': { codigo: 'MUC', nome: 'Aeroporto de Munique' },
    'Zurique': { codigo: 'ZUR', nome: 'Aeroporto de Zurique' },
    'Viena': { codigo: 'VIE', nome: 'Aeroporto Internacional de Viena' },
    'Praga': { codigo: 'PRG', nome: 'Aeroporto Václav Havel de Praga' },
    'Budapeste': { codigo: 'BUD', nome: 'Aeroporto Ferenc Liszt' },
    'Varsóvia': { codigo: 'WAW', nome: 'Aeroporto Frederic Chopin' },
    'Estocolmo': { codigo: 'ARN', nome: 'Aeroporto de Estocolmo-Arlanda' },
    'Copenhague': { codigo: 'CPH', nome: 'Aeroporto de Copenhague' },
    'Oslo': { codigo: 'OSL', nome: 'Aeroporto de Oslo' },
    'Helsinque': { codigo: 'HEL', nome: 'Aeroporto de Helsinque-Vantaa' },
    
    // Ásia
    'Tóquio': { codigo: 'HND', nome: 'Aeroporto de Haneda' },
    'Osaka': { codigo: 'KIX', nome: 'Aeroporto Internacional de Kansai' },
    'Seul': { codigo: 'ICN', nome: 'Aeroporto Internacional de Incheon' },
    'Pequim': { codigo: 'PEK', nome: 'Aeroporto Internacional de Pequim' },
    'Xangai': { codigo: 'PVG', nome: 'Aeroporto Internacional Pudong' },
    'Hong Kong': { codigo: 'HKG', nome: 'Aeroporto Internacional de Hong Kong' },
    'Singapura': { codigo: 'SIN', nome: 'Aeroporto de Changi' },
    'Bangkok': { codigo: 'BKK', nome: 'Aeroporto Suvarnabhumi' },
    'Kuala Lumpur': { codigo: 'KUL', nome: 'Aeroporto Internacional de Kuala Lumpur' },
    'Jacarta': { codigo: 'CGK', nome: 'Aeroporto Internacional Soekarno-Hatta' },
    'Manila': { codigo: 'MNL', nome: 'Aeroporto Internacional Ninoy Aquino' },
    'Mumbai': { codigo: 'BOM', nome: 'Aeroporto Internacional Chhatrapati Shivaji' },
    'Delhi': { codigo: 'DEL', nome: 'Aeroporto Internacional Indira Gandhi' },
    
    // Oriente Médio e África
    'Dubai': { codigo: 'DXB', nome: 'Aeroporto Internacional de Dubai' },
    'Doha': { codigo: 'DOH', nome: 'Aeroporto Internacional Hamad' },
    'Abu Dhabi': { codigo: 'AUH', nome: 'Aeroporto Internacional de Abu Dhabi' },
    'Istambul': { codigo: 'IST', nome: 'Aeroporto de Istambul' },
    'Cairo': { codigo: 'CAI', nome: 'Aeroporto Internacional do Cairo' },
    'Cidade do Cabo': { codigo: 'CPT', nome: 'Aeroporto Internacional da Cidade do Cabo' },
    'Joanesburgo': { codigo: 'JNB', nome: 'Aeroporto Internacional O.R. Tambo' },
    
    // Oceania
    'Sydney': { codigo: 'SYD', nome: 'Aeroporto Kingsford Smith' },
    'Melbourne': { codigo: 'MEL', nome: 'Aeroporto de Melbourne' },
    'Auckland': { codigo: 'AKL', nome: 'Aeroporto de Auckland' }
  };
  
  // Primeiro, tenta encontrar por cidade exata
  if (mapeamentoCompleto[cidade]) {
    return mapeamentoCompleto[cidade];
  }
  
  // Depois, tenta por correspondência parcial da cidade
  for (const [cidadeKey, aeroporto] of Object.entries(mapeamentoCompleto)) {
    if (cidadeKey.toLowerCase().includes(cidade.toLowerCase()) || 
        cidade.toLowerCase().includes(cidadeKey.toLowerCase())) {
      return aeroporto;
    }
  }
  
  // Mapeamento por país (aeroporto principal)
  const aeroportoPrincipalPorPais = {
    'Brasil': { codigo: 'GRU', nome: 'Aeroporto Internacional de Guarulhos' },
    'Argentina': { codigo: 'EZE', nome: 'Aeroporto Internacional Ezeiza' },
    'Chile': { codigo: 'SCL', nome: 'Aeroporto Internacional Arturo Merino Benítez' },
    'Colômbia': { codigo: 'BOG', nome: 'Aeroporto Internacional El Dorado' },
    'Peru': { codigo: 'LIM', nome: 'Aeroporto Internacional Jorge Chávez' },
    'Uruguai': { codigo: 'MVD', nome: 'Aeroporto Internacional de Carrasco' },
    'Estados Unidos': { codigo: 'JFK', nome: 'Aeroporto Internacional John F. Kennedy' },
    'México': { codigo: 'MEX', nome: 'Aeroporto Internacional Benito Juárez' },
    'Canadá': { codigo: 'YYZ', nome: 'Aeroporto Internacional Pearson' },
    'Reino Unido': { codigo: 'LHR', nome: 'Aeroporto de Heathrow' },
    'França': { codigo: 'CDG', nome: 'Aeroporto Charles de Gaulle' },
    'Itália': { codigo: 'FCO', nome: 'Aeroporto Leonardo da Vinci' },
    'Espanha': { codigo: 'MAD', nome: 'Aeroporto Adolfo Suárez Madrid-Barajas' },
    'Portugal': { codigo: 'LIS', nome: 'Aeroporto Humberto Delgado' },
    'Alemanha': { codigo: 'FRA', nome: 'Aeroporto de Frankfurt' },
    'Holanda': { codigo: 'AMS', nome: 'Aeroporto de Amsterdã Schiphol' },
    'Japão': { codigo: 'HND', nome: 'Aeroporto de Haneda' },
    'China': { codigo: 'PEK', nome: 'Aeroporto Internacional de Pequim' },
    'Coreia do Sul': { codigo: 'ICN', nome: 'Aeroporto Internacional de Incheon' },
    'Tailândia': { codigo: 'BKK', nome: 'Aeroporto Suvarnabhumi' },
    'Singapura': { codigo: 'SIN', nome: 'Aeroporto de Changi' },
    'Emirados Árabes Unidos': { codigo: 'DXB', nome: 'Aeroporto Internacional de Dubai' },
    'Austrália': { codigo: 'SYD', nome: 'Aeroporto Kingsford Smith' }
  };
  
  if (aeroportoPrincipalPorPais[pais]) {
    return aeroportoPrincipalPorPais[pais];
  }
  
  // Último recurso: gera um código genérico (não recomendado)
  const codigoGenerico = cidade?.length >= 3 ? 
    cidade.substring(0, 3).toUpperCase() : 'AAA';
  
  return {
    codigo: codigoGenerico,
    nome: `Aeroporto de ${cidade}`
  };
}

// =======================
// Dados de emergência
// =======================
function generateEmergencyData(dadosUsuario = {}) {
  const orcamento = dadosUsuario.orcamento_valor ? parseFloat(dadosUsuario.orcamento_valor) : 3000;
  const cidadeOrigem = dadosUsuario.cidade_partida?.name || '';
  const regiao = cidadeOrigem.toLowerCase().includes('brasil') ? 'americas' : 'global';
  
  const destinosEmergencia = {
    'americas': {
      topPick: {
        destino: "Cartagena",
        pais: "Colômbia",
        codigoPais: "CO",
        descricao: "Cidade histórica colonial à beira-mar com arquitetura colorida.",
        porque: "Excelente custo-benefício, praias paradisíacas e centro histórico deslumbrante.",
        destaque: "Explorar a cidade amuralhada ao pôr do sol",
        comentario: "Cartagena me conquistou! A Cidade Amuralhada tem tantos cheiros diferentes que eu não sabia onde focar meu focinho! As Ilhas do Rosário são maravilhosas! 🐾",
        pontosTuristicos: ["Cidade Amuralhada", "Ilhas do Rosário"],
        eventos: ["Festival Internacional de Cinema de Cartagena", "Festival de Música do Caribe"],
        clima: {
          temperatura: "28°C-32°C",
          condicoes: "Clima tropical, quente e úmido com sol constante",
          recomendacoes: "Roupas leves, protetor solar e chapéu"
        },
        aeroporto: { codigo: "CTG", nome: "Aeroporto Internacional Rafael Núñez" },
        preco: { voo: Math.round(orcamento * 0.85), hotel: 220 }
      },
      alternativas: [
        {
          destino: "Medellín", pais: "Colômbia", codigoPais: "CO",
          porque: "Cidade moderna com clima primaveril o ano todo",
          pontoTuristico: "Comuna 13",
          clima: { temperatura: "20°C-25°C" },
          aeroporto: { codigo: "MDE", nome: "Aeroporto Internacional José María Córdova" },
          preco: { voo: Math.round(orcamento * 0.75), hotel: 180 }
        },
        {
          destino: "Santiago", pais: "Chile", codigoPais: "CL",
          porque: "Cidade moderna cercada por montanhas",
          pontoTuristico: "Cerro San Cristóbal",
          clima: { temperatura: "15°C-25°C" },
          aeroporto: { codigo: "SCL", nome: "Aeroporto Internacional Arturo Merino Benítez" },
          preco: { voo: Math.round(orcamento * 0.75), hotel: 220 }
        },
        {
          destino: "Cidade do Panamá", pais: "Panamá", codigoPais: "PA",
          porque: "Mistura de moderno e histórico com o Canal do Panamá",
          pontoTuristico: "Canal do Panamá",
          clima: { temperatura: "26°C-30°C" },
          aeroporto: { codigo: "PTY", nome: "Aeroporto Internacional de Tocumen" },
          preco: { voo: Math.round(orcamento * 0.65), hotel: 180 }
        },
        {
          destino: "San José", pais: "Costa Rica", codigoPais: "CR",
          porque: "Portal para as aventuras de ecoturismo",
          pontoTuristico: "Vulcão Poás",
          clima: { temperatura: "22°C-27°C" },
          aeroporto: { codigo: "SJO", nome: "Aeroporto Internacional Juan Santamaría" },
          preco: { voo: Math.round(orcamento * 0.8), hotel: 210 }
        }
      ],
      surpresa: {
        destino: "Montevidéu",
        pais: "Uruguai",
        codigoPais: "UY",
        descricao: "Capital tranquila com praias urbanas.",
        porque: "Destino menos procurado com rica cultura e gastronomia.",
        destaque: "Degustar carnes uruguaias premium",
        comentario: "Montevidéu é uma descoberta incrível! Passeei pelo Mercado del Puerto, onde os aromas das parrillas me deixaram babando! A Rambla é maravilhosa! 🐾",
        pontosTuristicos: ["Mercado del Puerto", "Rambla de Montevidéu"],
        eventos: ["Carnaval Uruguaio", "Festival de Tango"],
        clima: {
          temperatura: "15°C-22°C",
          condicoes: "Temperado com brisa marítima",
          recomendacoes: "Casaco leve para as noites"
        },
        aeroporto: { codigo: "MVD", nome: "Aeroporto Internacional de Carrasco" },
        preco: { voo: Math.round(orcamento * 0.75), hotel: 180 }
      }
    },
    'global': {
      topPick: {
        destino: "Lisboa",
        pais: "Portugal",
        codigoPais: "PT",
        descricao: "Capital histórica com vista para o rio Tejo.",
        porque: "Excelente custo-benefício, rica gastronomia e cultura acessível.",
        destaque: "Passear pelos bairros históricos ao pôr do sol",
        comentario: "Lisboa me encantou! Os miradouros têm vistas de tirar o fôlego e explorar a Torre de Belém foi uma aventura e tanto! 🐾",
        pontosTuristicos: ["Torre de Belém", "Alfama"],
        eventos: ["Festas de Lisboa", "Festival de Fado"],
        clima: {
          temperatura: "16°C-26°C",
          condicoes: "Clima mediterrâneo com muitos dias ensolarados",
          recomendacoes: "Roupas leves e um casaco fino para as noites"
        },
        aeroporto: { codigo: "LIS", nome: "Aeroporto Humberto Delgado" },
        preco: { voo: Math.round(orcamento * 0.8), hotel: 250 }
      },
      alternativas: [
        {
          destino: "Budapeste", pais: "Hungria", codigoPais: "HU",
          porque: "Deslumbrante arquitetura e banhos termais",
          pontoTuristico: "Parlamento Húngaro",
          clima: { temperatura: "15°C-25°C" },
          aeroporto: { codigo: "BUD", nome: "Aeroporto de Budapeste-Ferenc Liszt" },
          preco: { voo: Math.round(orcamento * 0.8), hotel: 180 }
        },
        {
          destino: "Cidade do México", pais: "México", codigoPais: "MX",
          porque: "Metrópole com rica história e gastronomia",
          pontoTuristico: "Teotihuacán",
          clima: { temperatura: "18°C-25°C" },
          aeroporto: { codigo: "MEX", nome: "Aeroporto Internacional Benito Juárez" },
          preco: { voo: Math.round(orcamento * 0.7), hotel: 200 }
        },
        {
          destino: "Bangkok", pais: "Tailândia", codigoPais: "TH",
          porque: "Cidade vibrante com templos deslumbrantes",
          pontoTuristico: "Grande Palácio",
          clima: { temperatura: "28°C-34°C" },
          aeroporto: { codigo: "BKK", nome: "Aeroporto Suvarnabhumi" },
          preco: { voo: Math.round(orcamento * 0.9), hotel: 150 }
        },
        {
          destino: "Porto", pais: "Portugal", codigoPais: "PT",
          porque: "Cidade histórica à beira do Rio Douro",
          pontoTuristico: "Vale do Douro",
          clima: { temperatura: "15°C-25°C" },
          aeroporto: { codigo: "OPO", nome: "Aeroporto Francisco Sá Carneiro" },
          preco: { voo: Math.round(orcamento * 0.75), hotel: 180 }
        }
      ],
      surpresa: {
        destino: "Ljubljana",
        pais: "Eslovênia",
        codigoPais: "SI",
        descricao: "Pequena capital europeia encantadora.",
        porque: "Joia escondida com arquitetura única e natureza exuberante.",
        destaque: "Visita ao deslumbrante Lago Bled",
        comentario: "Ljubljana é um segredo que poucos conhecem! Adorei correr pelo parque Tivoli e explorar a Ponte do Dragão! Que lugar mágico! 🐾",
        pontosTuristicos: ["Parque Tivoli", "Ponte do Dragão"],
        eventos: ["Festival de Verão de Ljubljana", "Mercado de Natal"],
        clima: {
          temperatura: "12°C-22°C",
          condicoes: "Clima continental com quatro estações bem definidas",
          recomendacoes: "Roupas em camadas para adaptar às mudanças de temperatura"
        },
        aeroporto: { codigo: "LJU", nome: "Aeroporto Jože Pučnik" },
        preco: { voo: Math.round(orcamento * 0.9), hotel: 170 }
      }
    }
  };
  
  return destinosEmergencia[regiao] || destinosEmergencia.global;
}

// =======================
// Geração de prompt padrão para outros provedores
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
  
  let estacaoViagem = 'não determinada';
  let hemisferio = infoViajante.cidadeOrigem.toLowerCase().includes('brasil') ? 'sul' : 'norte';
  
  try {
    if (dataIda !== 'não especificada') {
      const dataObj = new Date(dataIda);
      const mes = dataObj.getMonth();
      
      if (mes >= 2 && mes <= 4) estacaoViagem = 'outono';
      else if (mes >= 5 && mes <= 7) estacaoViagem = 'inverno';
      else if (mes >= 8 && mes <= 10) estacaoViagem = 'primavera';
      else estacaoViagem = 'verão';
      
      if (hemisferio === 'norte') {
        const mapaEstacoes = {
          'verão': 'inverno',
          'inverno': 'verão',
          'primavera': 'outono',
          'outono': 'primavera'
        };
        estacaoViagem = mapaEstacoes[estacaoViagem] || estacaoViagem;
      }
    }
  } catch {}
  
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
- Estação do ano na viagem: ${estacaoViagem}
- Experiência como viajante: ${infoViajante.conheceDestino === 1 ? 'Com experiência' : 'Iniciante'} 
- Preferência por destinos: ${getTipoDestinoText(infoViajante.tipoDestino)}
- Popularidade do destino: ${getFamaDestinoText(infoViajante.famaDestino)}

IMPORTANTE:
1. Com base na sua experiência traga destinos em que o preço do VOO de IDA e VOLTA sejam PRÓXIMOS do orçamento de ${infoViajante.orcamento} ${infoViajante.moeda}.
2. Forneça um mix equilibrado: inclua tanto destinos populares quanto alternativas.
3. Forneça EXATAMENTE 4 destinos alternativos diferentes entre si.
4. Garanta que os preços sejam realistas para voos de ida e volta partindo de ${infoViajante.cidadeOrigem}.
5. Para CADA destino, inclua o código IATA (3 letras) do aeroporto principal.
6. Para cada destino, INCLUA PONTOS TURÍSTICOS ESPECÍFICOS E CONHECIDOS.
7. Os comentários da Tripinha DEVEM mencionar pelo menos um dos pontos turísticos do destino.
8. NOVO: Forneça informações sobre o CLIMA esperado no destino durante a viagem (temperatura média e condições).

Forneça no formato JSON exato abaixo, SEM formatação markdown:
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão específica para visitar",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário entusiasmado da Tripinha, mencionando pelo menos um ponto turístico",
    "pontosTuristicos": [
      "Nome do Primeiro Ponto Turístico", 
      "Nome do Segundo Ponto Turístico"
    ],
    "clima": {
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
    "comentario": "Comentário entusiasmado da Tripinha, mencionando pelo menos um ponto turístico",
    "pontosTuristicos": [
      "Nome do Primeiro Ponto Turístico", 
      "Nome do Segundo Ponto Turístico"
    ],
    "clima": {
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
  "estacaoViagem": "${estacaoViagem}"
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
// Função principal - Handler da API
// =======================
module.exports = async function handler(req, res) {
  let isResponseSent = false;
  const serverTimeout = setTimeout(() => {
    if (!isResponseSent) {
      isResponseSent = true;
      console.log('Timeout do servidor atingido, enviando resposta de emergência');
      const emergencyData = generateEmergencyData(req.body);
      return res.status(200).json({
        tipo: "emergencia-timeout",
        conteudo: JSON.stringify(emergencyData),
        message: "Timeout do servidor"
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
    
    const prompt = gerarPromptParaDestinos(requestData);
    const orcamento = requestData.orcamento_valor ? parseFloat(requestData.orcamento_valor) : null;
    
    const providers = CONFIG.providerOrder.filter(
      provider => {
        const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
        const hasKey = !!apiKey;
        console.log(`Provedor ${provider}: ${hasKey ? 'Chave configurada' : 'Chave não encontrada'}`);
        return hasKey;
      }
    );
    
    console.log(`Provedores disponíveis: ${providers.join(', ')}`);
    
    if (providers.length === 0) {
      console.error('Nenhuma chave de API configurada');
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(500).json({ 
          tipo: "erro-config",
          conteudo: JSON.stringify(generateEmergencyData(requestData)),
          error: "Nenhuma chave de API configurada"
        });
      }
    }
    
    for (const provider of providers) {
      try {
        console.log(`Tentando obter recomendações via ${provider}...`);
        
        // Retry específico para DeepSeek devido a timeouts frequentes
        let responseAI;
        if (provider === 'deepseek') {
          responseAI = await retryAsync(
            () => callAIAPI(provider, prompt, requestData),
            3,  // 3 tentativas para DeepSeek
            2000  // 2 segundos entre tentativas
          );
        } else {
          responseAI = await callAIAPI(provider, prompt, requestData);
        }
        
        let processedResponse = responseAI;
        if (responseAI && utils.isPartiallyValidJSON(responseAI)) {
          processedResponse = await ensureTouristAttractionsAndComments(responseAI, requestData);
        }
        
        if (processedResponse && utils.isValidDestinationJSON(processedResponse, requestData)) {
          utils.log(`Resposta ${provider} válida recebida`, null);
          
          if (provider === 'deepseek') {
            try {
              const parsedResponse = JSON.parse(processedResponse);
              console.log(`[Deepseek] TopPick: ${parsedResponse.topPick?.destino} (${parsedResponse.topPick?.pais})`);
              console.log(`[Deepseek] Alternativas: ${parsedResponse.alternativas?.map(a => a.destino).join(', ')}`);
              console.log(`[Deepseek] Surpresa: ${parsedResponse.surpresa?.destino} (${parsedResponse.surpresa?.pais})`);
            } catch (error) {
              console.error('Erro ao analisar resposta Deepseek para log:', error.message);
            }
          }
          
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
                tipo: provider,
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
              tipo: provider,
              conteudo: processedResponse
            });
          }
          return;
        } else {
          console.log(`Resposta de ${provider} não passou na validação. Tentando próximo provedor...`);
        }
      } catch (error) {
        console.error(`Erro ao usar ${provider}:`, error.message);
        
        // Para DeepSeek, se der timeout, tenta o próximo provedor mais rápido
        if (provider === 'deepseek' && (error.message.includes('timeout') || error.message.includes('aborted'))) {
          console.log('DeepSeek com timeout - passando para próximo provedor...');
        }
      }
    }
    
    console.log('Todos os provedores falharam, gerando resposta de emergência...');
    const emergencyData = generateEmergencyData(requestData);
    
    try {
      const datas = obterDatasViagem(requestData);
      const dadosProcessados = await processarDestinos(emergencyData, datas);
      
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(200).json({
          tipo: "emergencia",
          conteudo: JSON.stringify(dadosProcessados)
        });
      }
    } catch (emergencyError) {
      console.error('Erro ao processar dados de emergência:', emergencyError.message);
    }
    
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(200).json({
        tipo: "emergencia",
        conteudo: JSON.stringify(emergencyData)
      });
    }
    
  } catch (globalError) {
    console.error('Erro global:', globalError.message);
    
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(200).json({ 
        tipo: "erro",
        conteudo: JSON.stringify(generateEmergencyData(req.body)),
        error: globalError.message
      });
    }
  } finally {
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      res.status(200).json({
        tipo: "erro-finally",
        conteudo: JSON.stringify(generateEmergencyData(req.body)),
        message: "Erro interno no servidor"
      });
    }
  }
};
