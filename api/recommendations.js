// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
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
  providerOrder: ['deepseek', 'perplexity', 'openai', 'claude']
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
// Prompt Deepseek Reasoner aprimorado
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
  
  let estacaoViagem = 'não determinada';
  let hemisferio = infoViajante.cidadeOrigem.toLowerCase().includes('brasil') ? 'sul' : 'norte';
  
  try {
    if (dataIda !== 'não especificada') {
      const dataObj = new Date(dataIda);
      const mes = dataObj.getMonth();
      
      if (mes >= 2 && mes <= 4) estacaoViagem = 'primavera';
      else if (mes >= 5 && mes <= 7) estacaoViagem = 'verão';
      else if (mes >= 8 && mes <= 10) estacaoViagem = 'outono';
      else estacaoViagem = 'inverno';
      
      if (hemisferio === 'sul') {
        const mapaEstacoes = {
          'verão': 'inverno',
          'inverno': 'verão',
          'primavera': 'outono',
          'outono': 'primavera'
        };
        estacaoViagem = mapaEstacoes[estacaoViagem] || estacaoViagem;
      }
    }
  } catch (error) {
    console.error('Erro ao determinar estação do ano:', error.message);
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
- Estação na viagem: ${estacaoViagem}
- Tipo de destino preferido: ${getTipoDestinoText(infoViajante.tipoDestino)}
- Nível de popularidade desejado: ${getFamaDestinoText(infoViajante.famaDestino)}

## ASPECTOS SAZONAIS E CLIMÁTICOS CRÍTICOS
- Para o período ${dataIda} a ${dataVolta}, verifique:
  * Festivais, feriados e eventos especiais que agregam valor à viagem
  * Condições climáticas adversas a evitar: monções, furacões, temperaturas extremas
  * Temporada turística (alta/baixa) e impacto em preços, disponibilidade e experiência

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
   - Clima apropriado para ${estacaoViagem}
   - Eventos especiais/festivais no período
   - Adaptação para viajantes ${infoViajante.companhia}
   - Destinos que fiquem entre 80% e 105% orçamento estipulado para voos de ${infoViajante.orcamento} ${infoViajante.moeda}

2) Para cada destino, determine:
   - Preço realista de voo
   - Pontos turísticos específicos e conhecidos
   - Eventos sazonais ou especiais no período da viagem
   - Comentário personalizado da Tripinha mencionando detalhes sensoriais
   - Informações práticas de clima para o período

3) Diversifique suas recomendações:
   - topPick: Destino com máxima adequação ao perfil
   - alternativas: 4 destinos diversos em geografia, custo e experiências
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
    "comentario": "Comentário entusiasmado da Tripinha mencionando um ponto turístico específico e aspectos sensoriais",
    "pontosTuristicos": ["Nome do Primeiro Ponto", "Nome do Segundo Ponto"],
    "eventos": ["Festival ou evento especial durante o período", "Outro evento relevante se houver"],
    "clima": {
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
  ],
  "surpresa": {
    // Mesma estrutura do topPick
    // Deve ser um destino menos óbvio, mas igualmente adequado
  },
  "estacaoViagem": "${estacaoViagem}"
}

## Verificação Final Obrigatória - CONFIRME QUE:
- ✓ Considerou eventos sazonais, clima e atrações para CADA destino
- ✓ Todos os comentários da Tripinha mencionam pontos turísticos específicos e incluem observações sensoriais
- ✓ As recomendações estão adaptadas para viajantes ${infoViajante.companhia}
- ✓ Todos os destinos incluem código IATA válido do aeroporto
- ✓ Diversificou geograficamente as alternativas`;
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
      systemMessage: 'Você é um especialista em viagens com experiência em destinos globais. Retorne apenas JSON com destinos detalhados, respeitando o orçamento para voos.',
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
      systemMessage: 'Você é um especialista em viagens. Sua prioridade é não exceder o orçamento para voos. Retorne apenas JSON puro com 4 destinos alternativos.',
      temperature: 0.7,
      max_tokens: 2000
    },
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      header: 'Authorization',
      prefix: 'Bearer',
      model: 'gpt-3.5-turbo',
      systemMessage: 'Você é um especialista em viagens. Retorne apenas JSON com 4 destinos alternativos, respeitando o orçamento para voos.',
      temperature: 0.7,
      max_tokens: 2000
    },
    claude: {
      url: 'https://api.anthropic.com/v1/messages',
      header: 'anthropic-api-key',
      prefix: '',
      model: 'claude-3-haiku-20240307',
      systemMessage: 'Você é um especialista em viagens. Retorne apenas JSON com 4 destinos alternativos, respeitando o orçamento para voos.',
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

    // Configuração dos cabeçalhos
  const headers = {
    'Content-Type': 'application/json'
  };
  headers[config.header] = config.prefix ? `${config.prefix} ${apiKey}` : apiKey;

  // Adicione um log para verificar os headers
  console.log('Headers:', headers);
  
  const finalPrompt = provider === 'deepseek' 
    ? gerarPromptParaDeepseekReasoner(requestData)
    : `${prompt}
  
IMPORTANTE: 
1. Cada voo DEVE respeitar o orçamento.
2. Retorne apenas JSON.
3. Forneça 4 destinos alternativos.
4. Inclua pontos turísticos específicos.
5. Inclua o código IATA de cada aeroporto.`;

  try {
    utils.log(`Enviando requisição para ${provider}...`, null);
    
    let requestData;
    
    if (provider === 'claude') {
      requestData = {
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
      
      if (config.additionalParams) {
        Object.assign(requestData, config.additionalParams);
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
    
    const response = await apiClient({
      method: 'post',
      url: config.url,
      headers,
      data: requestData,
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

function ensureTouristAttractionsAndComments(jsonString, requestData) {
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    let modificado = false;
    
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
      
      if (!data.topPick.aeroporto?.codigo) {
        data.topPick.aeroporto = {
          codigo: obterCodigoIATAPadrao(data.topPick.destino, data.topPick.pais),
          nome: `Aeroporto de ${data.topPick.destino}`
        };
        modificado = true;
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
      
      if (!data.surpresa.aeroporto?.codigo) {
        data.surpresa.aeroporto = {
          codigo: obterCodigoIATAPadrao(data.surpresa.destino, data.surpresa.pais),
          nome: `Aeroporto de ${data.surpresa.destino}`
        };
        modificado = true;
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
    
    if (!data.alternativas || !Array.isArray(data.alternativas)) {
      data.alternativas = [];
      modificado = true;
    }
    
    data.alternativas.forEach(alternativa => {
      if (!alternativa.pontoTuristico) {
        const destino = alternativa.destino;
        alternativa.pontoTuristico = (pontosPopulares[destino] || ["Atrações turísticas"])[0];
        modificado = true;
      }
      
      if (!alternativa.aeroporto?.codigo) {
        alternativa.aeroporto = {
          codigo: obterCodigoIATAPadrao(alternativa.destino, alternativa.pais),
          nome: `Aeroporto de ${alternativa.destino}`
        };
        modificado = true;
      }
      
      if (!alternativa.clima) {
        alternativa.clima = {
          temperatura: "Temperatura típica para a estação"
        };
        modificado = true;
      }
    });
    
    const destinosReserva = ["Lisboa", "Barcelona", "Roma", "Tóquio"];
    const paisesReserva = ["Portugal", "Espanha", "Itália", "Japão"];
    const codigosPaisesReserva = ["PT", "ES", "IT", "JP"];
    const codigosIATAReserva = ["LIS", "BCN", "FCO", "HND"];
    
    while (data.alternativas.length < 4) {
      const index = data.alternativas.length % destinosReserva.length;
      const destino = destinosReserva[index];
      const pontosConhecidos = pontosPopulares[destino] || ["Atrações turísticas"];
      const precoBase = requestData?.orcamento_valor ? 
        Math.round(parseFloat(requestData.orcamento_valor) * 0.7) : 2000;
      
      data.alternativas.push({
        destino: destino,
        pais: paisesReserva[index],
        codigoPais: codigosPaisesReserva[index],
        porque: `Cidade com rica história, gastronomia única e atmosfera encantadora`,
        pontoTuristico: pontosConhecidos[0] || "Atrações turísticas",
        aeroporto: {
          codigo: codigosIATAReserva[index],
          nome: `Aeroporto de ${destino}`
        },
        clima: {
          temperatura: "Temperatura típica para a estação"
        },
        preco: {
          voo: precoBase - (index * 100),
          hotel: 200 + (index * 20)
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
    console.error("Erro ao processar pontos turísticos:", error);
    return jsonString;
  }
}

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
  
  if (mapeamentoIATA[cidade]) return mapeamentoIATA[cidade];
  
  const mapeamentoPais = {
    'Brasil': 'GRU', 'Estados Unidos': 'JFK', 'México': 'MEX',
    'Reino Unido': 'LHR', 'França': 'CDG', 'Itália': 'FCO',
    'Espanha': 'MAD', 'Portugal': 'LIS', 'Japão': 'HND',
    'China': 'PEK', 'Austrália': 'SYD', 'Alemanha': 'FRA',
    'Canadá': 'YYZ', 'Tailândia': 'BKK', 'Emirados Árabes': 'DXB',
    'Colômbia': 'BOG', 'Peru': 'LIM', 'Chile': 'SCL',
    'Argentina': 'EZE', 'Uruguai': 'MVD', 'Costa Rica': 'SJO'
  };
  
  if (mapeamentoPais[pais]) return mapeamentoPais[pais];
  
  if (cidade?.length >= 3) return cidade.substring(0, 3).toUpperCase();
  
  return "AAA";
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
// Geração de prompt padrão
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
      
      if (mes >= 2 && mes <= 4) estacaoViagem = 'primavera';
      else if (mes >= 5 && mes <= 7) estacaoViagem = 'verão';
      else if (mes >= 8 && mes <= 10) estacaoViagem = 'outono';
      else estacaoViagem = 'inverno';
      
      if (hemisferio === 'sul') {
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
    `⚠️ ORÇAMENTO MÁXIMO: ${infoViajante.orcamento} ${infoViajante.moeda} para voos. Todos os destinos DEVEM ter preços abaixo deste valor.` : 
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
1. O preço do VOO de CADA destino DEVE ser MENOR que o orçamento máximo de ${infoViajante.orcamento} ${infoViajante.moeda}.
2. Forneça um mix equilibrado: inclua tanto destinos populares quanto alternativas.
3. Forneça EXATAMENTE 4 destinos alternativos diferentes entre si.
4. Considere a ÉPOCA DO ANO (${estacaoViagem}) para sugerir destinos com clima adequado.
5. Inclua destinos de diferentes continentes/regiões.
6. Garanta que os preços sejam realistas para voos de ida e volta partindo de ${infoViajante.cidadeOrigem}.
7. Para CADA destino, inclua o código IATA (3 letras) do aeroporto principal.
8. Para cada destino, INCLUA PONTOS TURÍSTICOS ESPECÍFICOS E CONHECIDOS.
9. Os comentários da Tripinha DEVEM mencionar pelo menos um dos pontos turísticos do destino.
10. NOVO: Forneça informações sobre o CLIMA esperado no destino durante a viagem (temperatura média e condições).

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
      provider => process.env[`${provider.toUpperCase()}_API_KEY`]
    );
    
    for (const provider of providers) {
      try {
        console.log(`Tentando obter recomendações via ${provider}...`);
        const responseAI = await callAIAPI(provider, prompt, requestData);
        
        let processedResponse = responseAI;
        if (responseAI && utils.isPartiallyValidJSON(responseAI)) {
          processedResponse = ensureTouristAttractionsAndComments(responseAI, requestData);
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
