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
    retry: 1500,
    deepseek: 60000  // Timeout específico para DeepSeek Reasoner
  },
  retries: {
    default: 2,
    deepseek: 2     // Número de tentativas para DeepSeek
  },
  logging: {
    enabled: true,
    maxLength: 500
  },
  preferredProvider: 'deepseek' // Definir DeepSeek como provedor preferido
};

// =======================
// Cliente HTTP configurado
// =======================
const apiClient = axios.create({
  timeout: CONFIG.timeout.request,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

// Cliente HTTP específico para DeepSeek com timeout estendido
const deepseekClient = axios.create({
  timeout: CONFIG.timeout.deepseek,
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
async function retryAsync(fn, maxAttempts = CONFIG.retries.default, initialDelay = CONFIG.timeout.retry) {
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
// Prompt otimizado para DeepSeek Reasoner
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

// Versão otimizada para chamar especificamente a DeepSeek Reasoner
async function callDeepseekReasonerAPI(prompt, requestData) {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('Chave da API DeepSeek não configurada');
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const finalPrompt = gerarPromptParaDeepseekReasoner(requestData);

  utils.log('Enviando requisição para DeepSeek Reasoner...', null);

  try {
    const response = await deepseekClient({
      method: 'post',
      url: 'https://api.deepseek.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      data: {
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em viagens. Retorne apenas JSON com 4 destinos alternativos, respeitando o orçamento para voos.'
          },
          {
            role: 'user',
            content: finalPrompt
          }
        ],
        temperature: 0.6, // Ligeiramente reduzido para maior precisão
        max_tokens: 2500, // Aumentado para permitir respostas mais detalhadas
        top_p: 0.95
      },
      timeout: CONFIG.timeout.deepseek
    });

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Formato de resposta do DeepSeek inválido');
    }

    const content = response.data.choices[0].message.content;
    utils.log(`Conteúdo recebido da API DeepSeek (primeiros 200 caracteres):`, content.substring(0, 200));
    return utils.extrairJSONDaResposta(content);
  } catch (error) {
    console.error(`Erro na chamada à API DeepSeek Reasoner:`, error.message);
    if (error.response) {
      utils.log('Resposta de erro (DeepSeek):', error.response.data);
    }
    throw error;
  }
}

// Função para outras APIs
async function callOtherAIAPI(provider, prompt, requestData) {
  const apiConfig = {
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
