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
    handler: 55000,
    aviasales: 15000,
    retry: 1500
  },
  retries: 2,
  logging: {
    enabled: true,
    maxLength: 500
  }
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
      
      // Tentar parse direto
      try {
        return JSON.stringify(JSON.parse(texto));
      } catch {}
      
      // Limpar e extrair JSON
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
    } catch {
      return null;
    }
  },
  
  isPartiallyValidJSON: jsonString => {
    if (!jsonString) return false;
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      return data && (data.topPick || data.alternativas || data.surpresa);
    } catch {
      return false;
    }
  },
  
  isValidDestinationJSON: (jsonString, requestData) => {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      
      // Verificações básicas
      if (!data.topPick?.destino || !data.alternativas || !data.surpresa?.destino) return false;
      if (!data.topPick.pontosTuristicos?.length || data.topPick.pontosTuristicos.length < 2) return false;
      if (!data.surpresa.pontosTuristicos?.length || data.surpresa.pontosTuristicos.length < 2) return false;
      if (!Array.isArray(data.alternativas) || data.alternativas.length !== 4) return false;
      
      // Verificar pontos turísticos em alternativas
      if (!data.alternativas.every(alt => alt.pontoTuristico)) return false;
      
      // Verificar comentários mencionam pontos turísticos
      if (!data.topPick.comentario || !data.topPick.pontosTuristicos.some(
        attraction => data.topPick.comentario.toLowerCase().includes(attraction.toLowerCase())
      )) return false;
      
      if (!data.surpresa.comentario || !data.surpresa.pontosTuristicos.some(
        attraction => data.surpresa.comentario.toLowerCase().includes(attraction.toLowerCase())
      )) return false;
      
      // Verificar orçamento
      if (requestData?.orcamento_valor && !isNaN(parseFloat(requestData.orcamento_valor))) {
        const orcamentoMax = parseFloat(requestData.orcamento_valor);
        if (data.topPick.preco?.voo > orcamentoMax || data.alternativas[0]?.preco?.voo > orcamentoMax) {
          return false;
        }
      }
      
      // Verificar destinos únicos
      if (data.topPick.destino?.toLowerCase() === data.alternativas[0]?.destino?.toLowerCase()) {
        return false;
      }
      
      // Verificar códigos IATA
      if (!data.topPick.aeroporto?.codigo || !data.surpresa.aeroporto?.codigo) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }
};

// =======================
// Função de busca de preço de voo via Aviasales
// =======================
async function buscarPrecoVooAviasales(origemIATA, destinoIATA, datas, moeda) {
  if (!process.env.AVIASALES_TOKEN || !process.env.AVIASALES_MARKER) {
    throw new Error("Token ou marker da API Aviasales não configurados.");
  }

  if (!origemIATA || !destinoIATA || !datas) {
    utils.log(`Parâmetros incompletos para busca de voo:`, { origem: origemIATA, destino: destinoIATA });
    return null;
  }

  try {
    utils.log(`Buscando voo de ${origemIATA} para ${destinoIATA} via Aviasales (Calendar)...`, null);
    
    const response = await apiClient({
      method: 'get',
      url: 'https://api.travelpayouts.com/v1/prices/calendar',
      params: {
        origin: origemIATA,
        destination: destinoIATA,
        depart_date: datas.dataIda,
        return_date: datas.dataVolta,
        currency: moeda,
        token: process.env.AVIASALES_TOKEN,
        marker: process.env.AVIASALES_MARKER
      },
      headers: {
        'Accept-Encoding': 'gzip, deflate'
      },
      timeout: CONFIG.timeout.aviasales
    });

    if (!response.data?.success || !response.data?.data) {
      throw new Error("Resposta inválida ou incompleta da API Aviasales");
    }

    // Processa a resposta
    let menorPreco = Infinity;
    for (const date in response.data.data) {
      const precosPorDestino = response.data.data[date];
      if (precosPorDestino && precosPorDestino[destinoIATA] !== undefined) {
        const preco = parseFloat(precosPorDestino[destinoIATA]);
        if (preco < menorPreco) {
          menorPreco = preco;
        }
      }
    }

    if (menorPreco !== Infinity) {
      return { 
        precoReal: menorPreco, 
        detalhesVoo: {
          companhia: 'Não informado',
          departure_at: '',
          return_at: ''
        }, 
        fonte: 'Aviasales Calendar' 
      };
    }

    utils.log('Nenhuma oferta válida encontrada no Calendar', null);
    return null;
  } catch (erro) {
    console.error(`Erro ao buscar preços via Aviasales Calendar: ${erro.message}`);
    utils.log('Detalhes do erro:', erro.response ? erro.response.data : erro);
    return null;
  }
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
// Processamento de destinos (enriquecimento com preços)
// =======================
async function processarDestinos(recomendacoes, origemIATA, datas, moeda) {
  if (!utils.validarCodigoIATA(origemIATA)) {
    console.error(`Código IATA de origem inválido: ${origemIATA}`);
    origemIATA = 'GRU';
  }
  
  try {
    // Processar destinos principais e alternativos
    const destinos = [
      { tipo: 'topPick', item: recomendacoes.topPick },
      ...recomendacoes.alternativas.map(alt => ({ tipo: 'alternativa', item: alt })),
      { tipo: 'surpresa', item: recomendacoes.surpresa }
    ];
    
    for (const destino of destinos) {
      if (!destino.item?.aeroporto?.codigo) continue;
      
      const destinoIATA = destino.item.aeroporto.codigo;
      if (!utils.validarCodigoIATA(destinoIATA)) continue;
      
      utils.log(`Processando ${destino.tipo}: ${destino.item.destino} (${destinoIATA})`, null);
      
      const resultado = await retryAsync(
        async () => await buscarPrecoVooAviasales(origemIATA, destinoIATA, datas, moeda)
      );
      
      if (resultado) {
        destino.item.preco = destino.item.preco || {};
        destino.item.preco.voo = resultado.precoReal;
        destino.item.preco.fonte = resultado.fonte || 'Aviasales Calendar';
        destino.item.detalhesVoo = resultado.detalhesVoo;
      } else {
        destino.item.preco = {
          voo: destino.item.preco?.voo || 0,
          fonte: 'Indisponível - API não retornou dados'
        };
      }
      
      // Pausa entre requisições para evitar rate limiting
      if (destino.tipo !== 'surpresa') {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Determinar estação do ano
    if (!recomendacoes.estacaoViagem && datas.dataIda) {
      try {
        const dataObj = new Date(datas.dataIda);
        const mes = dataObj.getMonth();
        let estacaoViagem = '';
        
        if (mes >= 2 && mes <= 4) estacaoViagem = 'primavera';
        else if (mes >= 5 && mes <= 7) estacaoViagem = 'verão';
        else if (mes >= 8 && mes <= 10) estacaoViagem = 'outono';
        else estacaoViagem = 'inverno';
        
        // Ajustar para hemisfério sul
        const hemisferio = determinarHemisferioDestino(origemIATA);
        if (hemisferio === 'sul') {
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

// Função para determinar hemisfério por IATA
function determinarHemisferioDestino(iataCode) {
  const hemisfSulIATA = [
    'GRU', 'GIG', 'SSA', 'REC', 'FOR', 'BSB', 'CNF', 'CWB', 'POA', 'CGH', 'SDU', 'FLN',
    'SYD', 'MEL', 'BNE', 'PER', 'ADL', 'AKL', 'CHC', 'ZQN',
    'JNB', 'CPT', 'DUR'
  ];
  
  return hemisfSulIATA.includes(iataCode) ? 'sul' : 'norte';
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
  } catch {
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
  } catch {
    return { dataIda: '2025-08-05', dataVolta: '2025-08-12' };
  }
}

// =======================
// Novo prompt específico para Deepseek Reasoner
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
  
  // Processar datas
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
  
  // Determinar estação
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
  
  // Configuração de adaptações específicas por tipo de viajante
  const adaptacoesPorTipo = {
    "sozinho(a)": "Destinos seguros para viajantes solo, hostels bem avaliados, atividades para conhecer pessoas",
    "em casal (viagem romântica)": "Cenários românticos, jantares especiais, passeios a dois, hotéis boutique",
    "em família": "Atividades para todas as idades, opções kid-friendly, segurança, acomodações espaçosas",
    "com amigos": "Vida noturna, atividades em grupo, opções de compartilhamento, diversão coletiva"
  };
  
  const mensagemOrcamento = infoViajante.orcamento !== 'flexível' ?
    `ORÇAMENTO MÁXIMO: ${infoViajante.orcamento} ${infoViajante.moeda}` : 
    'Orçamento flexível';

  return `# Tarefa: Recomendações de Destinos de Viagem
  
## RESTRIÇÃO CRÍTICA DE ORÇAMENTO
${mensagemOrcamento} para voos (NUNCA EXCEDA ESTE VALOR)

## Dados do Viajante
- Origem: ${infoViajante.cidadeOrigem}
- Composição: ${infoViajante.companhia}
- Quantidade: ${infoViajante.pessoas} pessoa(s)
- Interesses: ${infoViajante.preferencia}
- Período: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Estação na viagem: ${estacaoViagem}
- Tipo de destino preferido: ${getTipoDestinoText(infoViajante.tipoDestino)}
- Nível de popularidade desejado: ${getFamaDestinoText(infoViajante.famaDestino)}

## ASPECTOS SAZONAIS CRÍTICOS
- Verifique eventos especiais no período (${dataIda} a ${dataVolta})
- Evite destinos com condições climáticas adversas: monções, furacões, frio/calor extremo
- Priorize destinos com festivais, eventos culturais ou temporadas especiais relevantes
- Considere alta/baixa temporada e impacto em preços e lotação

## ADAPTAÇÕES PARA TIPO DE VIAJANTE: ${infoViajante.companhia.toUpperCase()}
${adaptacoesPorTipo[infoViajante.companhia] || "Considere experiências versáteis para diferentes perfis"}

## PERSONALIDADE DA TRIPINHA
- A Tripinha é uma cachorrinha vira-lata caramelo, entusiasmada e curiosa
- Seus comentários devem ser autênticos, divertidos e ESPECÍFICOS ao destino
- SEMPRE mencione pelo menos um ponto turístico específico no comentário
- Use emoji 🐾 para dar personalidade
- Inclua uma observação sensorial (cheiros, sons, texturas) que um cachorro notaria

## Processo de Raciocínio Passo a Passo
1) Identifique destinos adequados considerando:
   - Clima apropriado para ${estacaoViagem}
   - Eventos especiais/festivais no período
   - Adaptação para viajantes ${infoViajante.companhia}
   - Compatibilidade com orçamento de ${infoViajante.orcamento} ${infoViajante.moeda}

2) Para cada destino, determine:
   - Preço realista de voo ABAIXO DO ORÇAMENTO MÁXIMO
   - Pontos turísticos específicos e conhecidos
   - Eventos sazonais ou especiais no período da viagem
   - Comentário personalizado da Tripinha mencionando detalhes sensoriais

3) Diversifique suas recomendações:
   - topPick: Destino com máxima adequação ao perfil
   - alternativas: 4 destinos diversos em geografia, custo e experiências
   - surpresa: Destino incomum mas encantador

## Formato de Retorno (JSON estrito)
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão específica para visitar baseada no perfil do viajante",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário entusiasmado da Tripinha mencionando um ponto turístico e aspectos sensoriais",
    "pontosTuristicos": ["Nome do Primeiro Ponto", "Nome do Segundo Ponto"],
    "eventos": ["Festival ou evento especial durante o período", "Outro evento relevante"],
    "clima": {
      "temperatura": "Faixa de temperatura média esperada",
      "condicoes": "Descrição das condições climáticas",
      "recomendacoes": "Dicas relacionadas ao clima"
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
  ],
  "surpresa": {
    // Mesma estrutura do topPick
  },
  "estacaoViagem": "${estacaoViagem}"
}

## Verificação Final Obrigatória
- Confirme que TODOS os preços de voo estão abaixo de ${infoViajante.orcamento} ${infoViajante.moeda}
- Verifique que considerou eventos sazonais e clima para CADA destino
- Confirme que os comentários da Tripinha mencionam pontos turísticos específicos e incluem observações sensoriais
- Verifique que as recomendações estão adaptadas para viajantes ${infoViajante.companhia}`;
}

// =======================
// Funções para chamadas às APIs de IA
// =======================
async function callAIAPI(provider, prompt, requestData) {
  const apiConfig = {
    deepseek: {
      url: 'https://api.deepseek.com', 
      header: 'Authorization',
      prefix: 'Bearer',
      model: 'deepseek-reasoner',
      systemMessage: 'Você é um especialista em viagens. Retorne apenas JSON com 4 destinos alternativos, respeitando o orçamento para voos.'
    },
    perplexity: {
      url: 'https://api.perplexity.ai/chat/completions',
      header: 'Authorization',
      prefix: 'Bearer',
      model: 'sonar',
      systemMessage: 'Você é um especialista em viagens. Sua prioridade é não exceder o orçamento para voos. Retorne apenas JSON puro com 4 destinos alternativos.'
    },
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      header: 'Authorization',
      prefix: 'Bearer',
      model: 'gpt-3.5-turbo',
      systemMessage: 'Você é um especialista em viagens. Retorne apenas JSON com 4 destinos alternativos, respeitando o orçamento para voos.'
    },
    claude: {
      url: 'https://api.anthropic.com/v1/messages',
      header: 'anthropic-api-key',
      prefix: '',
      model: 'claude-3-haiku-20240307',
      systemMessage: 'Você é um especialista em viagens. Retorne apenas JSON com 4 destinos alternativos, respeitando o orçamento para voos.'
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
  
  // Usar o prompt especializado para Deepseek
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
    
    // Preparar dados específicos para cada provedor
    if (provider === 'claude') {
      requestData = {
        model: config.model,
        max_tokens: 2000,
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
        temperature: 0.7
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
        temperature: 0.7,
        max_tokens: 2000
      };
      
      // Ajustes específicos para Perplexity
      if (provider === 'perplexity') {
        requestData.response_format = { type: "text" };
      }
    }
    
    const headers = {
      'Content-Type': 'application/json'
    };
    headers[config.header] = config.prefix ? `${config.prefix} ${apiKey}` : apiKey;
    
    // Para Claude, adicionar versão da API
    if (provider === 'claude') {
      headers['anthropic-version'] = '2023-06-01';
    }
    
    const response = await apiClient({
      method: 'post',
      url: config.url,
      headers,
      data: requestData
    });
    
    // Extrair conteúdo de acordo com o formato de resposta do provedor
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
  "generico_Brasil": ["Praias paradisíacas", "Parques nacionais"],
  "generico_Europa": ["Praças históricas", "Museus de arte"],
  "generico_Asia": ["Templos antigos", "Mercados tradicionais"],
  "generico_America": ["Parques nacionais", "Centros urbanos"]
};

function ensureTouristAttractionsAndComments(jsonString, requestData) {
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    let modificado = false;
    
    // Melhorar topPick
    if (data.topPick) {
      // Adicionar pontos turísticos se necessário
      if (!data.topPick.pontosTuristicos?.length || data.topPick.pontosTuristicos.length < 2) {
        const destino = data.topPick.destino;
        data.topPick.pontosTuristicos = pontosPopulares[destino] || 
          ["Principais atrativos da cidade", "Pontos históricos"];
        modificado = true;
      }
      
      // Melhorar comentário
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
      
      // Adicionar aeroporto se necessário
      if (!data.topPick.aeroporto?.codigo) {
        data.topPick.aeroporto = {
          codigo: obterCodigoIATAPadrao(data.topPick.destino, data.topPick.pais),
          nome: `Aeroporto de ${data.topPick.destino}`
        };
        modificado = true;
      }
    }
    
    // Melhorar destino surpresa
    if (data.surpresa) {
      // Processar de forma semelhante ao topPick
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
    }
    
    // Verificar e melhorar alternativas
    if (!data.alternativas || !Array.isArray(data.alternativas)) {
      data.alternativas = [];
      modificado = true;
    }
    
    // Processar alternativas existentes
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
    });
    
    // Adicionar alternativas se necessário
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
        preco: {
          voo: precoBase - (index * 100),
          hotel: 200 + (index * 20)
        }
      });
      
      modificado = true;
    }
    
    // Limitar a 4 alternativas se houver mais
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
    'Tóquio': 'HND', 'Dubai': 'DXB', 'Sydney': 'SYD'
  };
  
  if (mapeamentoIATA[cidade]) return mapeamentoIATA[cidade];
  
  const mapeamentoPais = {
    'Brasil': 'GRU', 'Estados Unidos': 'JFK', 'México': 'MEX',
    'Reino Unido': 'LHR', 'França': 'CDG', 'Itália': 'FCO',
    'Espanha': 'MAD', 'Portugal': 'LIS', 'Japão': 'HND'
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
  
  // Mapa simplificado de destinos de emergência por região
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
        aeroporto: { codigo: "CTG", nome: "Aeroporto Internacional Rafael Núñez" },
        preco: { voo: Math.round(orcamento * 0.85), hotel: 220 }
      },
      alternativas: [
        {
          destino: "Medellín", pais: "Colômbia", codigoPais: "CO",
          porque: "Cidade moderna com clima primaveril o ano todo",
          pontoTuristico: "Comuna 13",
          aeroporto: { codigo: "MDE", nome: "Aeroporto Internacional José María Córdova" },
          preco: { voo: Math.round(orcamento * 0.75), hotel: 180 }
        },
        {
          destino: "Santiago", pais: "Chile", codigoPais: "CL",
          porque: "Cidade moderna cercada por montanhas",
          pontoTuristico: "Cerro San Cristóbal",
          aeroporto: { codigo: "SCL", nome: "Aeroporto Internacional Arturo Merino Benítez" },
          preco: { voo: Math.round(orcamento * 0.75), hotel: 220 }
        },
        {
          destino: "Cidade do Panamá", pais: "Panamá", codigoPais: "PA",
          porque: "Mistura de moderno e histórico com o Canal do Panamá",
          pontoTuristico: "Canal do Panamá",
          aeroporto: { codigo: "PTY", nome: "Aeroporto Internacional de Tocumen" },
          preco: { voo: Math.round(orcamento * 0.65), hotel: 180 }
        },
        {
          destino: "San José", pais: "Costa Rica", codigoPais: "CR",
          porque: "Portal para as aventuras de ecoturismo",
          pontoTuristico: "Vulcão Poás",
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
        aeroporto: { codigo: "LIS", nome: "Aeroporto Humberto Delgado" },
        preco: { voo: Math.round(orcamento * 0.8), hotel: 250 }
      },
      alternativas: [
        {
          destino: "Budapeste", pais: "Hungria", codigoPais: "HU",
          porque: "Deslumbrante arquitetura e banhos termais",
          pontoTuristico: "Parlamento Húngaro",
          aeroporto: { codigo: "BUD", nome: "Aeroporto de Budapeste-Ferenc Liszt" },
          preco: { voo: Math.round(orcamento * 0.8), hotel: 180 }
        },
        {
          destino: "Cidade do México", pais: "México", codigoPais: "MX",
          porque: "Metrópole com rica história e gastronomia",
          pontoTuristico: "Teotihuacán",
          aeroporto: { codigo: "MEX", nome: "Aeroporto Internacional Benito Juárez" },
          preco: { voo: Math.round(orcamento * 0.7), hotel: 200 }
        },
        {
          destino: "Bangkok", pais: "Tailândia", codigoPais: "TH",
          porque: "Cidade vibrante com templos deslumbrantes",
          pontoTuristico: "Grande Palácio",
          aeroporto: { codigo: "BKK", nome: "Aeroporto Suvarnabhumi" },
          preco: { voo: Math.round(orcamento * 0.9), hotel: 150 }
        },
        {
          destino: "Porto", pais: "Portugal", codigoPais: "PT",
          porque: "Cidade histórica à beira do Rio Douro",
          pontoTuristico: "Vale do Douro",
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
  
  // Processar datas
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
  
  // Determinar estação
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

  // Configuração de CORS e headers
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
    
    // Processar dados da requisição
    const requestData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // Gerar prompt e obter configurações
    const prompt = gerarPromptParaDestinos(requestData);
    const moeda = requestData.moeda_escolhida || 'BRL';
    const orcamento = requestData.orcamento_valor ? parseFloat(requestData.orcamento_valor) : null;
    
    // Lista de provedores de IA a tentar
    const providers = ['perplexity', 'openai', 'claude', 'deepseek'].filter(
      provider => process.env[`${provider.toUpperCase()}_API_KEY`]
    );
    
    // Tentar cada provedor de IA
    for (const provider of providers) {
      try {
        const responseAI = await callAIAPI(provider, prompt, requestData);
        
        let processedResponse = responseAI;
        if (responseAI && utils.isPartiallyValidJSON(responseAI)) {
          processedResponse = ensureTouristAttractionsAndComments(responseAI, requestData);
        }
        
        if (processedResponse && utils.isValidDestinationJSON(processedResponse, requestData)) {
          utils.log(`Resposta ${provider} válida recebida`, null);
          
          // Enrichecimento dos dados
          try {
            const recomendacoes = typeof processedResponse === 'string' ? 
              JSON.parse(processedResponse) : processedResponse;
            
            if (orcamento) {
              recomendacoes.orcamentoMaximo = orcamento;
            }
            
            const origemIATA = obterCodigoIATAOrigem(requestData);
            const datas = obterDatasViagem(requestData);
            
            if (origemIATA) {
              const recomendacoesEnriquecidas = await processarDestinos(
                recomendacoes, origemIATA, datas, moeda
              );
              
              if (!isResponseSent) {
                isResponseSent = true;
                clearTimeout(serverTimeout);
                return res.status(200).json({
                  tipo: `${provider}-enriquecido`,
                  conteudo: JSON.stringify(recomendacoesEnriquecidas)
                });
              }
              return;
            }
          } catch (enriquecerError) {
            console.error('Erro ao enriquecer:', enriquecerError.message);
          }
          
          // Se o enriquecimento falhar, retornar a resposta original
          if (!isResponseSent) {
            isResponseSent = true;
            clearTimeout(serverTimeout);
            return res.status(200).json({
              tipo: provider,
              conteudo: processedResponse
            });
          }
          return;
        }
      } catch (error) {
        console.error(`Erro ao usar ${provider}:`, error.message);
      }
    }
    
    // Se todos os provedores falharem, gerar resposta de emergência
    const emergencyData = generateEmergencyData(requestData);
    
    try {
      const origemIATA = obterCodigoIATAOrigem(requestData);
      const datas = obterDatasViagem(requestData);
      
      if (origemIATA) {
        if (orcamento) {
          emergencyData.orcamentoMaximo = orcamento;
        }
        
        const dadosEnriquecidos = await processarDestinos(
          emergencyData, origemIATA, datas, moeda
        );
        
        if (!isResponseSent) {
          isResponseSent = true;
          clearTimeout(serverTimeout);
          return res.status(200).json({
            tipo: "emergencia-enriquecida",
            conteudo: JSON.stringify(dadosEnriquecidos)
          });
        }
        return;
      }
    } catch (emergencyError) {
      console.error('Erro ao enriquecer dados de emergência:', emergencyError.message);
    }
    
    // Retornar dados de emergência sem enriquecimento se tudo falhar
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
