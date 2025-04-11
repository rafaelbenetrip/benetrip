// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
const axios = require('axios');
const http = require('http');
const https = require('https');

// =======================
// Configurações de timeout e limites
// =======================
const REQUEST_TIMEOUT = 50000; // 50 segundos para requisições externas
const HANDLER_TIMEOUT = 55000; // 55 segundos para processamento total
const AVIASALES_TIMEOUT = 15000; // 15 segundos para requisições à API Flights Search
const RETRY_DELAY = 1500; // 1.5 segundos entre tentativas
const MAX_RETRY = 2; // Número máximo de tentativas para cada método

// =======================
// Configurações de logging
// =======================
const enableDetailedLogs = true;
const MAX_LOG_LENGTH = 500; // Limite de caracteres para logs de resposta

// =======================
// Funções utilitárias
// =======================

// Validação de código IATA (3 letras maiúsculas)
function validarCodigoIATA(codigo) {
  if (!codigo) return false;
  const regex = /^[A-Z]{3}$/;
  return regex.test(codigo);
}

// Formatação de duração no formato "PT12H30M" para "12h 30m"
function formatarDuracao(duracao) {
  if (!duracao) return null;
  try {
    const horasMatch = duracao.match(/(\d+)H/);
    const minutosMatch = duracao.match(/(\d+)M/);
    const horas = horasMatch ? parseInt(horasMatch[1]) : 0;
    const minutos = minutosMatch ? parseInt(minutosMatch[1]) : 0;
    return `${horas}h${minutos > 0 ? ` ${minutos}m` : ''}`;
  } catch (e) {
    console.warn(`Erro ao formatar duração "${duracao}":`, e);
    return null;
  }
}

// Log detalhado com limite de caracteres
function logDetalhado(mensagem, dados, limite = MAX_LOG_LENGTH) {
  if (!enableDetailedLogs) return;
  console.log(mensagem);
  if (dados) {
    const dadosStr = typeof dados === 'string' ? dados : JSON.stringify(dados);
    console.log(dadosStr.length > limite ? dadosStr.substring(0, limite) + '...' : dadosStr);
  }
}

// =======================
// NOVA FUNÇÃO: Busca de preço de voo via Flights Search API
// =======================
async function buscarPrecoVooFlightsSearch(origemIATA, destinoIATA, datas, moeda) {
  try {
    const response = await axios.get('https://api.travelpayouts.com/v2/flight_search', {
      params: {
        origin: origemIATA,
        destination: destinoIATA,
        depart_date: datas.dataIda,
        return_date: datas.dataVolta,
        token: process.env.AVIASALES_TOKEN,
        marker: process.env.AVIASALES_MARKER,
        user_ip: '191.19.187.101'
      },
      timeout: AVIASALES_TIMEOUT
    });

    const voo = response.data?.data?.[0];
    const taxa = response.data?.currency_rates?.[moeda] || 1;
    const precoConvertido = voo ? Math.round(voo.price * taxa) : 0;

    return {
      precoConvertido,
      moeda
    };
  } catch (erro) {
    console.error(`Erro ao buscar preço via Flights Search: ${erro.message}`);
    return null;
  }
}

// =======================
// Função genérica de retentativa com backoff exponencial
// =======================
async function retryAsync(fn, maxAttempts = MAX_RETRY, initialDelay = RETRY_DELAY) {
  let attempt = 1;
  let delay = initialDelay;
  
  while (attempt <= maxAttempts) {
    try {
      const result = await fn();
      if (result) return result;
      logDetalhado(`Tentativa ${attempt} retornou resultado nulo ou inválido`, null);
    } catch (error) {
      console.error(`Tentativa ${attempt} falhou com erro: ${error.message}`);
    }
    
    if (attempt === maxAttempts) return null;
    
    logDetalhado(`Aguardando ${delay}ms antes da próxima tentativa...`, null);
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 5000);
    attempt++;
  }
  
  return null;
}

// =======================
// Função de estimativa de preço modificada para não fornecer estimativas
// =======================
function estimarPrecoVoo(origemIATA, destinoIATA) {
  console.log('Função de estimação de preço desativada conforme solicitado.');
  // Retorna um preço genérico com flag indicando que é uma estimativa
  return {
    precoReal: 0, // Valor zerado para indicar que não foi calculado
    detalhesVoo: {
      companhia: 'N/D',
      numeroParadas: 0,
      duracao: 'N/D'
    },
    fonte: 'Valor Indisponível'
  };
}

// =======================
// FUNÇÃO GERAR PROMPT PARA DESTINOS (AJUSTADA)
// =======================
function gerarPromptParaDestinos(requestData) {
  const orcamento = requestData.orcamento_valor || "não especificado";
  return `
Por favor, gere recomendações de destinos de viagem personalizados com base nas preferências do usuário.
Considere o orçamento informado (${orcamento}) como teto máximo para os voos.
Priorize destinos com o menor custo possível que se encaixem no perfil do usuário.
Se o orçamento for muito baixo, retorne sugestões realistas e explique com empatia as limitações de opções.
Se o orçamento for alto, evite destinos excessivamente baratos, a menos que representem experiências realmente incríveis.
11. Priorize destinos com o menor custo possível que se encaixem no perfil do usuário. Caso o orçamento seja muito baixo, explique com empatia e mostre o melhor que dá para fazer.
12. Quando o orçamento for alto, prefira destinos que estejam entre 70% e 100% do valor informado.
Forneça exatamente 4 destinos alternativos, incluindo o destino principal (topPick), alternativas e um destino surpresa.
Inclua pontos turísticos específicos e o código IATA de cada aeroporto.
Responda estritamente em formato JSON.
  `.trim();
}

// =======================
// Processamento de destinos para enriquecer com preços reais via Flights Search API
// =======================
async function processarDestinos(recomendacoes, origemIATA, datas, moeda) {
  if (!validarCodigoIATA(origemIATA)) {
    console.error(`Código IATA de origem inválido: ${origemIATA}`);
    origemIATA = 'GRU';
    logDetalhado(`Usando código IATA de fallback: ${origemIATA}`, null);
  }
  
  logDetalhado('Iniciando processamento de destinos com Flights Search API...', null);
  
  // Processamento dos destinos de forma paralela para evitar timeout na Vercel
  const promises = [];
  
  // Processa o destino principal (topPick)
  if (recomendacoes.topPick && recomendacoes.topPick.aeroporto && recomendacoes.topPick.aeroporto.codigo) {
    promises.push((async () => {
      const destinoIATA = recomendacoes.topPick.aeroporto.codigo;
      logDetalhado(`Processando destino principal: ${recomendacoes.topPick.destino} (${destinoIATA})`, null);
      if (validarCodigoIATA(destinoIATA)) {
        const resultado = await retryAsync(() => buscarPrecoVooFlightsSearch(origemIATA, destinoIATA, datas, moeda));
        if (resultado) {
          recomendacoes.topPick.preco = {
            voo: resultado.precoConvertido,
            moeda: resultado.moeda,
            fonte: 'Aviasales Flights Search'
          };
          // Caso a API retorne detalhes adicionais (opcional)
          if (resultado.detalhesVoo) {
            recomendacoes.topPick.detalhesVoo = resultado.detalhesVoo;
          }
          logDetalhado(`Preço atualizado para ${recomendacoes.topPick.destino}: ${moeda} ${recomendacoes.topPick.preco.voo}`, null);
        } else {
          console.warn(`Consulta Flights Search falhou para ${recomendacoes.topPick.destino}.`);
          recomendacoes.topPick.preco = {
            voo: recomendacoes.topPick.preco?.voo || 0,
            fonte: 'Indisponível - API não retornou dados'
          };
        }
      } else {
        console.warn(`Código IATA inválido para ${recomendacoes.topPick.destino}: ${destinoIATA}`);
      }
    })());
  }
  
  // Processa as alternativas (todas em paralelo)
  if (recomendacoes.alternativas && Array.isArray(recomendacoes.alternativas)) {
    recomendacoes.alternativas.forEach((alternativa, index) => {
      promises.push((async () => {
        if (alternativa.aeroporto && alternativa.aeroporto.codigo) {
          const destinoIATA = alternativa.aeroporto.codigo;
          logDetalhado(`Processando alternativa ${index + 1}/${recomendacoes.alternativas.length}: ${alternativa.destino} (${destinoIATA})`, null);
          if (validarCodigoIATA(destinoIATA)) {
            const resultado = await retryAsync(() => buscarPrecoVooFlightsSearch(origemIATA, destinoIATA, datas, moeda));
            if (resultado) {
              alternativa.preco = {
                voo: resultado.precoConvertido,
                moeda: resultado.moeda,
                fonte: 'Aviasales Flights Search'
              };
              if (resultado.detalhesVoo) {
                alternativa.detalhesVoo = resultado.detalhesVoo;
              }
              logDetalhado(`Preço atualizado para ${alternativa.destino}: ${moeda} ${alternativa.preco.voo}`, null);
            } else {
              console.warn(`Consulta Flights Search falhou para ${alternativa.destino}.`);
              alternativa.preco = {
                voo: alternativa.preco?.voo || 0,
                fonte: 'Indisponível - API não retornou dados'
              };
            }
          } else {
            console.warn(`Código IATA inválido para ${alternativa.destino}: ${destinoIATA}`);
          }
        }
      })());
    });
  }
  
  // Processa o destino surpresa
  if (recomendacoes.surpresa && recomendacoes.surpresa.aeroporto && recomendacoes.surpresa.aeroporto.codigo) {
    promises.push((async () => {
      const destinoIATA = recomendacoes.surpresa.aeroporto.codigo;
      logDetalhado(`Processando destino surpresa: ${recomendacoes.surpresa.destino} (${destinoIATA})`, null);
      if (validarCodigoIATA(destinoIATA)) {
        const resultado = await retryAsync(() => buscarPrecoVooFlightsSearch(origemIATA, destinoIATA, datas, moeda));
        if (resultado) {
          recomendacoes.surpresa.preco = {
            voo: resultado.precoConvertido,
            moeda: resultado.moeda,
            fonte: 'Aviasales Flights Search'
          };
          if (resultado.detalhesVoo) {
            recomendacoes.surpresa.detalhesVoo = resultado.detalhesVoo;
          }
          logDetalhado(`Preço atualizado para ${recomendacoes.surpresa.destino}: ${moeda} ${recomendacoes.surpresa.preco.voo}`, null);
        } else {
          console.warn(`Consulta Flights Search falhou para ${recomendacoes.surpresa.destino}.`);
          recomendacoes.surpresa.preco = {
            voo: recomendacoes.surpresa.preco?.voo || 0,
            fonte: 'Indisponível - API não retornou dados'
          };
        }
      } else {
        console.warn(`Código IATA inválido para ${recomendacoes.surpresa.destino}: ${destinoIATA}`);
      }
    })());
  }
  
  // Aguarda que todos os destinos sejam processados
  await Promise.all(promises);
  
  // Assegurar que temos a estação do ano armazenada
  if (!recomendacoes.estacaoViagem) {
    try {
      if (datas.dataIda) {
        const dataObj = new Date(datas.dataIda);
        const mes = dataObj.getMonth();
        let estacaoViagem = '';
        
        if (mes >= 2 && mes <= 4) estacaoViagem = 'primavera';
        else if (mes >= 5 && mes <= 7) estacaoViagem = 'verão';
        else if (mes >= 8 && mes <= 10) estacaoViagem = 'outono';
        else estacaoViagem = 'inverno';
        
        // Determinar hemisfério baseado na origem
        const hemisferio = determinarHemisferioDestino(origemIATA);
        
        if (hemisferio === 'sul') {
          if (estacaoViagem === 'verão') estacaoViagem = 'inverno';
          else if (estacaoViagem === 'inverno') estacaoViagem = 'verão';
          else if (estacaoViagem === 'primavera') estacaoViagem = 'outono';
          else if (estacaoViagem === 'outono') estacaoViagem = 'primavera';
        }
        
        recomendacoes.estacaoViagem = estacaoViagem;
        logDetalhado(`Estação do ano definida: ${estacaoViagem}`, null);
      }
    } catch (error) {
      console.warn('Erro ao determinar estação do ano:', error);
    }
  }
  
  return recomendacoes;
}

// Adicione esta função para determinar hemisfério por IATA
function determinarHemisferioDestino(iataCode) {
  // IATA codes para países do hemisfério sul
  const hemisfSulIATA = [
    // América do Sul
    'GRU', 'GIG', 'SSA', 'REC', 'FOR', 'BSB', 'CNF', 'CWB', 'POA', 'CGH', 'SDU', 'FLN',
    // Austrália/Nova Zelândia
    'SYD', 'MEL', 'BNE', 'PER', 'ADL', 'AKL', 'CHC', 'ZQN',
    // África
    'JNB', 'CPT', 'DUR'
  ];
  
  if (hemisfSulIATA.includes(iataCode)) return 'sul';
  return 'norte';
}

// =======================
// Funções auxiliares para dados de entrada e validação
// =======================
function obterCodigoIATAOrigem(dadosUsuario) {
  try {
    if (!dadosUsuario || !dadosUsuario.cidade_partida) return null;
    if (dadosUsuario.cidade_partida.iata) return dadosUsuario.cidade_partida.iata;
    const mapeamentoIATA = {
      'São Paulo': 'GRU',
      'Rio de Janeiro': 'GIG',
      'Brasília': 'BSB',
      'Salvador': 'SSA',
      'Recife': 'REC',
      'Fortaleza': 'FOR',
      'Belo Horizonte': 'CNF',
      'Porto Alegre': 'POA',
      'Curitiba': 'CWB',
      'Belém': 'BEL',
      'Manaus': 'MAO',
      'Natal': 'NAT',
      'Florianópolis': 'FLN',
      'Maceió': 'MCZ',
      'Goiânia': 'GYN',
      'Vitória': 'VIX',
      'Buenos Aires': 'EZE',
      'Santiago': 'SCL',
      'Lima': 'LIM',
      'Bogotá': 'BOG',
      'Cidade do México': 'MEX',
      'Nova York': 'JFK',
      'Los Angeles': 'LAX',
      'Miami': 'MIA',
      'Londres': 'LHR',
      'Paris': 'CDG',
      'Roma': 'FCO',
      'Madri': 'MAD',
      'Lisboa': 'LIS',
      'Tóquio': 'HND',
      'Dubai': 'DXB',
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
    console.error('Erro ao obter código IATA:', error);
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
      const dataIdaPadrao = formatarData(mesQueVem);
      const dataVoltaPadrao = new Date(mesQueVem);
      dataVoltaPadrao.setDate(dataVoltaPadrao.getDate() + 7);
      return { 
        dataIda: dataIdaPadrao, 
        dataVolta: formatarData(dataVoltaPadrao) 
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
    console.error('Erro ao obter datas de viagem:', error);
    return { dataIda: '2025-08-05', dataVolta: '2025-08-12' };
  }
}

function formatarData(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
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
  }, HANDLER_TIMEOUT);

  // Configuração de CORS e headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=60');

  if (req.method === 'OPTIONS') {
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(200).end();
    }
    return;
  }
  
  if (req.method !== 'POST') {
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(405).json({ error: "Método não permitido" });
    }
    return;
  }

  try {
    if (!req.body) {
      console.error('Corpo da requisição vazio');
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(400).json({ error: "Nenhum dado fornecido na requisição" });
      }
      return;
    }
    
    let requestData;
    try {
      requestData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      logDetalhado('Dados recebidos processados com sucesso', null);
    } catch (parseError) {
      console.error('Erro ao processar corpo da requisição:', parseError);
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(400).json({ error: "Formato de dados inválido", details: parseError.message });
      }
      return;
    }
    
    logDetalhado('Tipo de dados recebidos:', typeof requestData);
    logDetalhado('Conteúdo parcial:', JSON.stringify(requestData).substring(0, 200) + '...');
    
    let prompt;
    try {
      prompt = gerarPromptParaDestinos(requestData);
      logDetalhado('Prompt gerado com sucesso, tamanho:', prompt.length);
    } catch (promptError) {
      console.error('Erro ao gerar prompt:', promptError);
      prompt = "Recomende destinos de viagem únicos e personalizados. Responda em formato JSON.";
    }
    
    const moeda = requestData.moeda_escolhida || 'BRL';
    const orcamento = requestData.orcamento_valor ? parseFloat(requestData.orcamento_valor) : null;
    
    let tentativas = 0;
    const maxTentativas = 3;
    
    while (tentativas < maxTentativas) {
      tentativas++;
      logDetalhado(`Tentativa ${tentativas} de ${maxTentativas}`, null);
      
      if (process.env.PERPLEXITY_API_KEY) {
        try {
          logDetalhado('Chamando API Perplexity...', null);
          const responsePerplexity = await callPerplexityAPI(prompt, requestData);
          let processedResponse = responsePerplexity;
          if (responsePerplexity && isPartiallyValidJSON(responsePerplexity)) {
            processedResponse = ensureTouristAttractionsAndComments(responsePerplexity, requestData);
          }
          if (processedResponse && isValidDestinationJSON(processedResponse, requestData)) {
            logDetalhado('Resposta Perplexity válida recebida', null);
            try {
              const recomendacoes = typeof processedResponse === 'string' ? JSON.parse(processedResponse) : processedResponse;
              if (orcamento) {
                recomendacoes.orcamentoMaximo = orcamento;
              }
              const origemIATA = obterCodigoIATAOrigem(requestData);
              const datas = obterDatasViagem(requestData);
              if (origemIATA) {
                logDetalhado(`Origem IATA identificada: ${origemIATA}, processando destinos...`, null);
                const recomendacoesEnriquecidas = await processarDestinos(recomendacoes, origemIATA, datas, moeda);
                logDetalhado('Recomendações enriquecidas com sucesso', null);
                if (!isResponseSent) {
                  isResponseSent = true;
                  clearTimeout(serverTimeout);
                  return res.status(200).json({
                    tipo: "perplexity-enriquecido",
                    conteudo: JSON.stringify(recomendacoesEnriquecidas),
                    tentativa: tentativas
                  });
                }
                return;
              }
            } catch (enriquecerError) {
              console.error('Erro ao enriquecer recomendações:', enriquecerError.message);
            }
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: "perplexity",
                conteudo: processedResponse,
                tentativa: tentativas
              });
            }
            return;
          } else {
            logDetalhado('Resposta Perplexity inválida ou incompleta, tentando próxima API', null);
          }
        } catch (perplexityError) {
          console.error('Erro ao usar Perplexity:', perplexityError.message);
        }
      }
      
      if (process.env.OPENAI_API_KEY) {
        try {
          logDetalhado('Chamando API OpenAI...', null);
          const responseOpenAI = await callOpenAIAPI(prompt, requestData);
          let processedResponse = responseOpenAI;
          if (responseOpenAI && isPartiallyValidJSON(responseOpenAI)) {
            processedResponse = ensureTouristAttractionsAndComments(responseOpenAI, requestData);
          }
          if (processedResponse && isValidDestinationJSON(processedResponse, requestData)) {
            logDetalhado('Resposta OpenAI válida recebida', null);
            try {
              const recomendacoes = typeof processedResponse === 'string' ? JSON.parse(processedResponse) : processedResponse;
              if (orcamento) {
                recomendacoes.orcamentoMaximo = orcamento;
              }
              const origemIATA = obterCodigoIATAOrigem(requestData);
              const datas = obterDatasViagem(requestData);
              if (origemIATA) {
                logDetalhado(`Origem IATA identificada: ${origemIATA}, processando destinos...`, null);
                const recomendacoesEnriquecidas = await processarDestinos(recomendacoes, origemIATA, datas, moeda);
                logDetalhado('Recomendações enriquecidas com sucesso', null);
                if (!isResponseSent) {
                  isResponseSent = true;
                  clearTimeout(serverTimeout);
                  return res.status(200).json({
                    tipo: "openai-enriquecido",
                    conteudo: JSON.stringify(recomendacoesEnriquecidas),
                    tentativa: tentativas
                  });
                }
                return;
              }
            } catch (enriquecerError) {
              console.error('Erro ao enriquecer recomendações:', enriquecerError.message);
            }
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: "openai",
                conteudo: processedResponse,
                tentativa: tentativas
              });
            }
            return;
          } else {
            logDetalhado('Resposta OpenAI inválida ou incompleta, tentando próxima API', null);
          }
        } catch (openaiError) {
          console.error('Erro ao usar OpenAI:', openaiError.message);
        }
      }
      
      if (process.env.CLAUDE_API_KEY) {
        try {
          logDetalhado('Chamando API Claude...', null);
          const responseClaude = await callClaudeAPI(prompt, requestData);
          let processedResponse = responseClaude;
          if (responseClaude && isPartiallyValidJSON(responseClaude)) {
            processedResponse = ensureTouristAttractionsAndComments(responseClaude, requestData);
          }
          if (processedResponse && isValidDestinationJSON(processedResponse, requestData)) {
            logDetalhado('Resposta Claude válida recebida', null);
            try {
              const recomendacoes = typeof processedResponse === 'string' ? JSON.parse(processedResponse) : processedResponse;
              if (orcamento) {
                recomendacoes.orcamentoMaximo = orcamento;
              }
              const origemIATA = obterCodigoIATAOrigem(requestData);
              const datas = obterDatasViagem(requestData);
              if (origemIATA) {
                logDetalhado(`Origem IATA identificada: ${origemIATA}, processando destinos...`, null);
                const recomendacoesEnriquecidas = await processarDestinos(recomendacoes, origemIATA, datas, moeda);
                logDetalhado('Recomendações enriquecidas com sucesso', null);
                if (!isResponseSent) {
                  isResponseSent = true;
                  clearTimeout(serverTimeout);
                  return res.status(200).json({
                    tipo: "claude-enriquecido",
                    conteudo: JSON.stringify(recomendacoesEnriquecidas),
                    tentativa: tentativas
                  });
                }
                return;
              }
            } catch (enriquecerError) {
              console.error('Erro ao enriquecer recomendações:', enriquecerError.message);
            }
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: "claude",
                conteudo: processedResponse,
                tentativa: tentativas
              });
            }
            return;
          } else {
            logDetalhado('Resposta Claude inválida ou incompleta', null);
          }
        } catch (claudeError) {
          console.error('Erro ao usar Claude:', claudeError.message);
        }
      }
      
      // Em cada tentativa, complementa o prompt com urgência e regras de orçamento estritas
      prompt = `${prompt}\n\nURGENTE: O ORÇAMENTO MÁXIMO para voos (${requestData.orcamento_valor || 'informado'} ${requestData.moeda_escolhida || 'BRL'}) precisa ser RIGOROSAMENTE RESPEITADO. TODOS os destinos devem ter voos abaixo desse valor. Forneça um mix equilibrado: inclua tanto destinos populares quanto alternativas.`;
    }
    
    logDetalhado('Todas as tentativas de obter resposta válida falharam', null);
    const emergencyData = generateEmergencyData(requestData);
    try {
      logDetalhado('Tentando enriquecer dados de emergência com preços reais...', null);
      const origemIATA = obterCodigoIATAOrigem(requestData);
      const datas = obterDatasViagem(requestData);
      if (origemIATA) {
        logDetalhado(`Origem IATA identificada: ${origemIATA}, processando destinos de emergência...`, null);
        if (orcamento) {
          emergencyData.orcamentoMaximo = orcamento;
        }
        const dadosEnriquecidos = await processarDestinos(emergencyData, origemIATA, datas, moeda);
        logDetalhado('Dados de emergência enriquecidos com sucesso', null);
        if (!isResponseSent) {
          isResponseSent = true;
          clearTimeout(serverTimeout);
          return res.status(200).json({
            tipo: "emergencia-enriquecida",
            conteudo: JSON.stringify(dadosEnriquecidos),
            message: "Dados de emergência com preços reais"
          });
        }
        return;
      }
    } catch (emergencyError) {
      console.error('Erro ao enriquecer dados de emergência:', emergencyError.message);
    }
    
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(200).json({
        tipo: "emergencia",
        conteudo: JSON.stringify(emergencyData),
        message: "Todas as tentativas de API falharam"
      });
    }
    
  } catch (globalError) {
    console.error('Erro global na API de recomendações:', globalError);
    const emergencyData = generateEmergencyData(req.body);
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(200).json({ 
        tipo: "erro",
        conteudo: JSON.stringify(emergencyData),
        error: globalError.message
      });
    }
  } finally {
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      const emergencyData = generateEmergencyData(req.body);
      res.status(200).json({
        tipo: "erro-finally",
        conteudo: JSON.stringify(emergencyData),
        message: "Erro interno no servidor"
      });
    }
  }
};

// =======================
// Funções para chamadas às APIs de LLM
// (Mantidas inalteradas, pois não foram requisitadas modificações)
// =======================
async function callPerplexityAPI(prompt, requestData) {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) throw new Error('Chave da API Perplexity não configurada');
    logDetalhado('Enviando requisição para Perplexity...', null);
    const orcamentoMessage = requestData.orcamento_valor ? 
      `\n\n⚠️ ORÇAMENTO MÁXIMO: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'} para voos. Todos os destinos DEVEM ter preços abaixo deste valor.` : '';
    const enhancedPrompt = `${prompt}${orcamentoMessage}
    
IMPORTANTE: 
1. Cada voo DEVE respeitar o orçamento máximo.
2. Retorne APENAS o JSON puro.
3. Forneça EXATAMENTE 4 destinos alternativos.
4. Inclua PONTOS TURÍSTICOS ESPECÍFICOS (2 para topPick e surpresa, 1 para cada alternativa).
5. Inclua o código IATA (3 letras) de cada aeroporto.`;
    const response = await axios({
      method: 'post',
      url: 'https://api.perplexity.ai/chat/completions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em viagens. Sua prioridade é não exceder o orçamento para voos. Retorne apenas JSON puro com 4 destinos alternativos.'
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: "text" }
      },
      timeout: REQUEST_TIMEOUT,
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true })
    });
    if (!response.data || !response.data.choices || !response.data.choices[0] || 
        !response.data.choices[0].message || !response.data.choices[0].message.content) {
      logDetalhado('Resposta Perplexity incompleta:', JSON.stringify(response.data).substring(0, 200));
      throw new Error('Formato de resposta da Perplexity inválido');
    }
    const content = response.data.choices[0].message.content;
    logDetalhado('Conteúdo recebido da API Perplexity (primeiros 200 caracteres):', content.substring(0, 200));
    return extrairJSONDaResposta(content);
  } catch (error) {
    console.error('Erro detalhado na chamada à API Perplexity:');
    if (error.code === 'ECONNABORTED') {
      console.error('Timeout na chamada à API Perplexity');
    }
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers));
      logDetalhado('Dados do erro:', error.response.data);
    }
    if (error.request) {
      console.error('Requisição enviada, mas sem resposta');
    }
    console.error('Mensagem de erro:', error.message);
    throw error;
  }
}

async function callOpenAIAPI(prompt, requestData) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Chave da API OpenAI não configurada');
    logDetalhado('Enviando requisição para OpenAI...', null);
    const orcamentoMessage = requestData.orcamento_valor ? 
      `\n\n⚠️ ORÇAMENTO MÁXIMO: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'} para voos.` : '';
    const enhancedPrompt = `${prompt}${orcamentoMessage}
    
IMPORTANTE: 
1. Cada voo DEVE respeitar o orçamento.
2. Retorne apenas JSON.
3. Forneça 4 destinos alternativos.
4. Inclua pontos turísticos específicos.
5. Inclua o código IATA de cada aeroporto.`;
    const response = await axios({
      method: 'post',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em viagens. Retorne apenas JSON com 4 destinos alternativos, respeitando o orçamento para voos."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      },
      timeout: REQUEST_TIMEOUT,
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true })
    });
    if (!response.data || !response.data.choices || !response.data.choices[0] || 
        !response.data.choices[0].message || !response.data.choices[0].message.content) {
      throw new Error('Formato de resposta da OpenAI inválido');
    }
    const content = response.data.choices[0].message.content;
    logDetalhado('Conteúdo recebido da API OpenAI (primeiros 200 caracteres):', content.substring(0, 200));
    return extrairJSONDaResposta(content);
  } catch (error) {
    console.error('Erro detalhado na chamada à API OpenAI:');
    if (error.response) {
      console.error('Status:', error.response.status);
      logDetalhado('Dados do erro:', error.response.data);
    }
    throw error;
  }
}

async function callClaudeAPI(prompt, requestData) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) throw new Error('Chave da API Claude não configurada');
    logDetalhado('Enviando requisição para Claude...', null);
    const orcamentoMessage = requestData.orcamento_valor ? 
      `\n\n⚠️ ORÇAMENTO MÁXIMO: ${requestData.orcamento_valor} ${requestData.moeda_escolhida || 'BRL'} para voos.` : '';
    const enhancedPrompt = `${prompt}${orcamentoMessage}
    
IMPORTANTE: 
1. Cada voo DEVE respeitar o orçamento.
2. Retorne apenas o JSON.
3. Forneça 4 destinos alternativos.
4. Inclua pontos turísticos específicos.
5. Inclua o código IATA de cada aeroporto.`;
    const response = await axios({
      method: 'post',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'anthropic-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      data: {
        model: "claude-3-haiku-20240307",
        max_tokens: 3000,
        messages: [
          {
            role: "system",
            content: "Você é um especialista em viagens. Retorne apenas JSON com 4 destinos alternativos, respeitando o orçamento para voos."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        temperature: 0.7
      },
      timeout: REQUEST_TIMEOUT,
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true })
    });
    if (!response.data || !response.data.content || !response.data.content[0] || !response.data.content[0].text) {
      throw new Error('Formato de resposta do Claude inválido');
    }
    const content = response.data.content[0].text;
    logDetalhado('Conteúdo recebido da API Claude (primeiros 200 caracteres):', content.substring(0, 200));
    return extrairJSONDaResposta(content);
  } catch (error) {
    console.error('Erro detalhado na chamada à API Claude:');
    if (error.response) {
      console.error('Status:', error.response.status);
      logDetalhado('Dados do erro:', error.response.data);
    }
    throw error;
  }
}

// =======================
// Funções de processamento e extração de JSON 
// =======================
function extrairJSONDaResposta(texto) {
  try {
    logDetalhado("Processando resposta para extrair JSON", null);
    if (typeof texto === 'object' && texto !== null) {
      logDetalhado("Resposta já é um objeto, convertendo para string", null);
      return JSON.stringify(texto);
    }
    try {
      const parsed = JSON.parse(texto);
      logDetalhado("JSON analisado com sucesso no primeiro método", null);
      return JSON.stringify(parsed);
    } catch (e) {
      logDetalhado("Primeira tentativa falhou, tentando métodos alternativos", null);
    }
    let textoProcessado = texto
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\r\n/g, '\n')
      .trim();
    const jsonRegex = /(\{[\s\S]*\})/;
    const match = textoProcessado.match(jsonRegex);
    if (match && match[0]) {
      try {
        const possibleJson = match[0];
        const parsed = JSON.parse(possibleJson);
        logDetalhado("JSON extraído e analisado com sucesso via regex", null);
        return JSON.stringify(parsed);
      } catch (regexError) {
        logDetalhado("Falha na extração via regex:", regexError.message);
      }
    } else {
      logDetalhado("Nenhum padrão JSON encontrado no texto processado", null);
    }
    logDetalhado("Todas as tentativas de extração falharam", null);
    return null;
  } catch (error) {
    console.error('Erro fatal ao processar resposta:', error);
    return null;
  }
}

function isPartiallyValidJSON(jsonString) {
  if (!jsonString) return false;
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    return data && (data.topPick || data.alternativas || data.surpresa);
  } catch (error) {
    return false;
  }
}

function isValidDestinationJSON(jsonString, requestData) {
  if (!jsonString) return false;
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    if (!data.topPick?.destino || !data.alternativas || !data.surpresa?.destino) {
      logDetalhado("JSON inválido: faltam campos obrigatórios básicos", null);
      return false;
    }
    if (!data.topPick.pontosTuristicos || !Array.isArray(data.topPick.pontosTuristicos) || data.topPick.pontosTuristicos.length < 2) {
      logDetalhado("JSON inválido: faltam pontos turísticos no destino principal ou menos de 2", null);
      return false;
    }
    if (!data.surpresa.pontosTuristicos || !Array.isArray(data.surpresa.pontosTuristicos) || data.surpresa.pontosTuristicos.length < 2) {
      logDetalhado("JSON inválido: faltam pontos turísticos no destino surpresa ou menos de 2", null);
      return false;
    }
    if (!Array.isArray(data.alternativas) || data.alternativas.length !== 4) {
      logDetalhado(`JSON inválido: array de alternativas deve conter exatamente 4 destinos (contém ${data.alternativas?.length || 0})`, null);
      return false;
    }
    for (let i = 0; i < data.alternativas.length; i++) {
      if (!data.alternativas[i].pontoTuristico) {
        logDetalhado(`JSON inválido: alternativa ${i+1} não tem ponto turístico`, null);
        return false;
      }
    }
    if (data.topPick.comentario) {
      const includesAnyTopPickAttraction = data.topPick.pontosTuristicos.some(attraction => 
        data.topPick.comentario.toLowerCase().includes(attraction.toLowerCase())
      );
      if (!includesAnyTopPickAttraction) {
        logDetalhado("JSON inválido: comentário da Tripinha no topPick não menciona nenhum ponto turístico", null);
        return false;
      }
    } else {
      logDetalhado("JSON inválido: topPick não tem comentário da Tripinha", null);
      return false;
    }
    if (data.surpresa.comentario) {
      const includesAnySurpriseAttraction = data.surpresa.pontosTuristicos.some(attraction => 
        data.surpresa.comentario.toLowerCase().includes(attraction.toLowerCase())
      );
      if (!includesAnySurpriseAttraction) {
        logDetalhado("JSON inválido: comentário da Tripinha na surpresa não menciona nenhum ponto turístico", null);
        return false;
      }
    } else {
      logDetalhado("JSON inválido: surpresa não tem comentário da Tripinha", null);
      return false;
    }
    if (requestData?.orcamento_valor && !isNaN(parseFloat(requestData.orcamento_valor))) {
      const orcamentoMax = parseFloat(requestData.orcamento_valor);
      if (data.topPick.preco?.voo > orcamentoMax) {
        logDetalhado(`JSON inválido: topPick tem voo acima do orçamento (${data.topPick.preco?.voo} > ${orcamentoMax})`, null);
        return false;
      }
      if (data.alternativas[0]?.preco?.voo > orcamentoMax) {
        logDetalhado(`JSON inválido: primeira alternativa tem voo acima do orçamento (${data.alternativas[0]?.preco?.voo} > ${orcamentoMax})`, null);
        return false;
      }
    }
    if (data.topPick.destino?.toLowerCase() === data.alternativas[0]?.destino?.toLowerCase()) {
      logDetalhado("JSON inválido: destino principal repetido na primeira alternativa", null);
      return false;
    }
    if (!data.topPick.aeroporto || !data.topPick.aeroporto.codigo) {
      logDetalhado("JSON inválido: falta código IATA no destino principal", null);
      return false;
    }
    if (!data.surpresa.aeroporto || !data.surpresa.aeroporto.codigo) {
      logDetalhado("JSON inválido: falta código IATA no destino surpresa", null);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Erro ao validar JSON:", error);
    return false;
  }
}

function enriquecerComentarioTripinha(comentario, pontosTuristicos) {
  if (!comentario || !pontosTuristicos || !Array.isArray(pontosTuristicos) || pontosTuristicos.length === 0) return null;
  const mencionaAtual = pontosTuristicos.some(ponto => comentario.toLowerCase().includes(ponto.toLowerCase()));
  if (mencionaAtual) return comentario;
  const pontoParaMencionar = pontosTuristicos[0];
  const padroes = [
    `${comentario} Adorei especialmente ${pontoParaMencionar}! 🐾`,
    `${comentario.replace(/🐾.*$/, '')} Fiquei impressionada com ${pontoParaMencionar}! 🐾`,
    comentario.includes('!') 
      ? comentario.replace(/!([^!]*)$/, `! ${pontoParaMencionar} é incrível!$1`)
      : `${comentario} ${pontoParaMencionar} é um lugar que todo cachorro devia visitar! 🐾`
  ];
  const indice = Math.floor(Math.random() * padroes.length);
  return padroes[indice];
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
  "Amsterdã": ["Museu Van Gogh", "Canais de Amsterdã"],
  "Bangkok": ["Grande Palácio", "Templo do Buda de Esmeralda"],
  "Dubai": ["Burj Khalifa", "Dubai Mall"],
  "Cidade do México": ["Teotihuacán", "Museu Frida Kahlo"],
  "Buenos Aires": ["Caminito", "Teatro Colón"],
  "Cairo": ["Pirâmides de Gizé", "Museu Egípcio"],
  "Istambul": ["Hagia Sophia", "Mesquita Azul"],
  "São Paulo": ["Avenida Paulista", "MASP"],
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
      if (!data.topPick.pontosTuristicos || !Array.isArray(data.topPick.pontosTuristicos) || data.topPick.pontosTuristicos.length < 2) {
        const destino = data.topPick.destino;
        const pontosConhecidos = pontosPopulares[destino] || ["Principais atrativos da cidade", "Pontos históricos"];
        data.topPick.pontosTuristicos = [
          pontosConhecidos[0] || "Principais atrativos da cidade",
          pontosConhecidos[1] || "Pontos históricos"
        ];
        modificado = true;
      }
      if (data.topPick.comentario) {
        const novoComentario = enriquecerComentarioTripinha(data.topPick.comentario, data.topPick.pontosTuristicos);
        if (novoComentario && novoComentario !== data.topPick.comentario) {
          data.topPick.comentario = novoComentario;
          modificado = true;
        }
      } else {
        const pontoTuristico = data.topPick.pontosTuristicos[0] || "esse lugar incrível";
        data.topPick.comentario = `${data.topPick.destino} é um sonho! Adorei passear por ${pontoTuristico} e sentir todos aqueles cheiros novos! Uma aventura incrível para qualquer cachorro explorador! 🐾`;
        modificado = true;
      }
      if (!data.topPick.aeroporto || !data.topPick.aeroporto.codigo) {
        data.topPick.aeroporto = {
          codigo: obterCodigoIATAPadrao(data.topPick.destino, data.topPick.pais),
          nome: `Aeroporto de ${data.topPick.destino}`
        };
        modificado = true;
      }
    }
    if (data.surpresa) {
      if (!data.surpresa.pontosTuristicos || !Array.isArray(data.surpresa.pontosTuristicos) || data.surpresa.pontosTuristicos.length < 2) {
        const destino = data.surpresa.destino;
        const pontosConhecidos = pontosPopulares[destino] || ["Locais exclusivos", "Atrativos menos conhecidos"];
        data.surpresa.pontosTuristicos = [
          pontosConhecidos[0] || "Locais exclusivos",
          pontosConhecidos[1] || "Atrativos menos conhecidos"
        ];
        modificado = true;
      }
      if (data.surpresa.comentario) {
        const novoComentario = enriquecerComentarioTripinha(data.surpresa.comentario, data.surpresa.pontosTuristicos);
        if (novoComentario && novoComentario !== data.surpresa.comentario) {
          data.surpresa.comentario = novoComentario;
          modificado = true;
        }
      } else {
        const pontoTuristico = data.surpresa.pontosTuristicos[0] || "esse lugar secreto";
        data.surpresa.comentario = `${data.surpresa.destino} é uma descoberta incrível! Poucos conhecem ${pontoTuristico}, mas é um paraíso para cachorros curiosos como eu! Tantos aromas novos para farejar! 🐾🌟`;
        modificado = true;
      }
      if (!data.surpresa.aeroporto || !data.surpresa.aeroporto.codigo) {
        data.surpresa.aeroporto = {
          codigo: obterCodigoIATAPadrao(data.surpresa.destino, data.surpresa.pais),
          nome: `Aeroporto de ${data.surpresa.destino}`
        };
        modificado = true;
      }
    }
    if (data.alternativas && Array.isArray(data.alternativas)) {
      for (let i = 0; i < data.alternativas.length; i++) {
        const alternativa = data.alternativas[i];
        if (!alternativa.pontoTuristico) {
          const destino = alternativa.destino;
          const pontosConhecidos = pontosPopulares[destino] || ["Atrações turísticas"];
          alternativa.pontoTuristico = pontosConhecidos[0] || "Atrações turísticas";
          modificado = true;
        }
        if (!alternativa.aeroporto || !alternativa.aeroporto.codigo) {
          alternativa.aeroporto = {
            codigo: obterCodigoIATAPadrao(alternativa.destino, alternativa.pais),
            nome: `Aeroporto de ${alternativa.destino}`
          };
          modificado = true;
        }
      }
    }
    if (!data.alternativas || !Array.isArray(data.alternativas)) {
      data.alternativas = [];
      modificado = true;
    }
    while (data.alternativas.length < 4) {
      const destinos = ["Lisboa", "Barcelona", "Roma", "Tóquio"];
      const paisesDestinos = ["Portugal", "Espanha", "Itália", "Japão"];
      const codigosPaises = ["PT", "ES", "IT", "JP"];
      const codigosIATA = ["LIS", "BCN", "FCO", "HND"];
      const index = data.alternativas.length % destinos.length;
      const destino = destinos[index];
      const pontosConhecidos = pontosPopulares[destino] || ["Atrações turísticas"];
      const precoBase = requestData?.orcamento_valor ? Math.round(parseFloat(requestData.orcamento_valor) * 0.7) : 2000;
      data.alternativas.push({
        destino: destino,
        pais: paisesDestinos[index],
        codigoPais: codigosPaises[index],
        porque: `Cidade com rica história, gastronomia única e atmosfera encantadora`,
        pontoTuristico: pontosConhecidos[0] || "Atrações turísticas",
        aeroporto: {
          codigo: codigosIATA[index],
          nome: `Aeroporto de ${destino}`
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
    'São Paulo': 'GRU',
    'Rio de Janeiro': 'GIG',
    'Brasília': 'BSB',
    'Salvador': 'SSA',
    'Recife': 'REC',
    'Fortaleza': 'FOR',
    'Belo Horizonte': 'CNF',
    'Porto Alegre': 'POA',
    'Curitiba': 'CWB',
    'Belém': 'BEL',
    'Manaus': 'MAO',
    'Natal': 'NAT',
    'Florianópolis': 'FLN',
    'Maceió': 'MCZ',
    'Goiânia': 'GYN',
    'Vitória': 'VIX',
    'Buenos Aires': 'EZE',
    'Santiago': 'SCL',
    'Lima': 'LIM',
    'Bogotá': 'FCO',
    'Cartagena': 'CTG',
    'Cidade do México': 'MEX',
    'Cancún': 'CUN',
    'San José': 'SJO',
    'Nova York': 'JFK',
    'Los Angeles': 'LAX',
    'Miami': 'MIA',
    'Toronto': 'YYZ',
    'Vancouver': 'YVR',
    'Londres': 'LHR',
    'Paris': 'CDG',
    'Roma': 'FCO',
    'Madri': 'MAD',
    'Lisboa': 'LIS',
    'Barcelona': 'BCN',
    'Amsterdã': 'AMS',
    'Berlim': 'BER',
    'Frankfurt': 'FRA',
    'Viena': 'VIE',
    'Zurique': 'ZRH',
    'Atenas': 'ATH',
    'Istambul': 'IST',
    'Tóquio': 'HND',
    'Pequim': 'PEK',
    'Xangai': 'PVG',
    'Hong Kong': 'HKG',
    'Bangkok': 'BKK',
    'Seul': 'ICN',
    'Dubai': 'DXB',
    'Singapura': 'SIN',
    'Mumbai': 'BOM',
    'Nova Délhi': 'DEL',
    'Sydney': 'SYD',
    'Melbourne': 'MEL',
    'Auckland': 'AKL'
  };
  
  if (mapeamentoIATA[cidade]) return mapeamentoIATA[cidade];
  
  const mapeamentoPais = {
    'Brasil': 'GRU',
    'Estados Unidos': 'JFK',
    'México': 'MEX',
    'Canadá': 'YYZ',
    'Reino Unido': 'LHR',
    'França': 'CDG',
    'Itália': 'FCO',
    'Espanha': 'MAD',
    'Portugal': 'LIS',
    'Alemanha': 'FRA',
    'Japão': 'HND',
    'China': 'PEK',
    'Índia': 'DEL',
    'Austrália': 'SYD',
    'Tailândia': 'BKK',
    'Singapura': 'SIN',
    'Emirados Árabes Unidos': 'DXB'
  };
  
  if (mapeamentoPais[pais]) return mapeamentoPais[pais];
  
  if (cidade && cidade.length >= 3) return cidade.substring(0, 3).toUpperCase();
  
  return "AAA";
}

function generateEmergencyData(dadosUsuario = {}) {
  const preferencia = dadosUsuario.preferencia_viagem || 0;
  const orcamento = dadosUsuario.orcamento_valor ? parseFloat(dadosUsuario.orcamento_valor) : 3000;
  const moeda = dadosUsuario.moeda_escolhida || 'BRL';
  const cidadeOrigem = dadosUsuario.cidade_partida?.name || '';
  const regiao = determinarRegiaoOrigem(cidadeOrigem);
  
  const destinosEmergencia = {
    "americas": {
      topPick: {
        destino: "Curaçao",
        pais: "Antilhas Holandesas",
        codigoPais: "AN",
        descricao: "Ilha paradisíaca no Caribe, com águas cristalinas e rica história cultural.",
        porque: "Perfeito para relaxar nas praias de areia branca e conhecer a arquitetura colonial colorida.",
        destaque: "Snorkeling em recifes de corais intocados",
        comentario: "Curaçao roubou meu coração! As praias são tão lindas que nem parece real, e o Parque Nacional Christoffel é perfeito para cães aventureiros como eu! 🐾",
        pontosTuristicos: [
          "Parque Nacional Christoffel",
          "Praia de Kenepa"
        ],
        aeroporto: {
          codigo: "CUR",
          nome: "Aeroporto Internacional Hato"
        },
        preco: {
          voo: Math.round(orcamento * 0.85),
          hotel: 350
        }
      },
      alternativas: [
        {
          destino: "Cartagena",
          pais: "Colômbia",
          codigoPais: "CO",
          porque: "Cidade histórica com belas praias e arquitetura colonial preservada",
          pontoTuristico: "Cidade Amuralhada",
          aeroporto: {
            codigo: "CTG",
            nome: "Aeroporto Internacional Rafael Núñez"
          },
          preco: {
            voo: Math.round(orcamento * 0.7),
            hotel: 200
          }
        },
        {
          destino: "Santiago",
          pais: "Chile",
          codigoPais: "CL",
          porque: "Cidade moderna cercada por montanhas com excelente gastronomia",
          pontoTuristico: "Cerro San Cristóbal",
          aeroporto: {
            codigo: "SCL",
            nome: "Aeroporto Internacional Arturo Merino Benítez"
          },
          preco: {
            voo: Math.round(orcamento * 0.75),
            hotel: 220
          }
        },
        {
          destino: "Cidade do Panamá",
          pais: "Panamá",
          codigoPais: "PA",
          porque: "Uma mistura de moderno e histórico com o famoso Canal do Panamá",
          pontoTuristico: "Canal do Panamá",
          aeroporto: {
            codigo: "PTY",
            nome: "Aeroporto Internacional de Tocumen"
          },
          preco: {
            voo: Math.round(orcamento * 0.65),
            hotel: 180
          }
        },
        {
          destino: "San José",
          pais: "Costa Rica",
          codigoPais: "CR",
          porque: "Portal para as aventuras de ecoturismo da Costa Rica",
          pontoTuristico: "Vulcão Poás",
          aeroporto: {
            codigo: "SJO",
            nome: "Aeroporto Internacional Juan Santamaría"
          },
          preco: {
            voo: Math.round(orcamento * 0.8),
            hotel: 210
          }
        }
      ],
      surpresa: {
        destino: "Montevidéu",
        pais: "Uruguai",
        codigoPais: "UY",
        descricao: "Capital tranquila com excelente qualidade de vida e praias urbanas.",
        porque: "Destino menos procurado, mas com rica cultura, gastronomia excepcional e povo acolhedor.",
        destaque: "Degustar carnes uruguaias premium com vinhos tannat locais",
        comentario: "Montevidéu é uma descoberta incrível! Passeiei pelo Mercado del Puerto, onde os aromas das parrillas me deixaram babando, e a Rambla é o lugar mais lindo para ver o pôr do sol! 🐾",
        pontosTuristicos: [
          "Mercado del Puerto",
          "Rambla de Montevidéu"
        ],
        aeroporto: {
          codigo: "MVD",
          nome: "Aeroporto Internacional de Carrasco"
        },
        preco: {
          voo: Math.round(orcamento * 0.75),
          hotel: 180
        }
      }
    },
    "europa": {
      topPick: {
        destino: "Porto",
        pais: "Portugal",
        codigoPais: "PT",
        descricao: "Cidade histórica à beira do Rio Douro, famosa pelos vinhos e arquitetura.",
        porque: "Alternativa mais acessível a Lisboa, com o mesmo charme português e cultura vinícola.",
        destaque: "Cruzeiro pelo rio Douro com degustação de vinhos",
        comentario: "Nunca vi uma cidade tão bonita quanto Porto! As pontes sobre o Rio Douro são impressionantes, e passear pelo Jardim do Palácio de Cristal foi minha parte favorita! 🐾",
        pontosTuristicos: [
          "Jardim do Palácio de Cristal",
          "Rio Douro"
        ],
        aeroporto: {
          codigo: "OPO",
          nome: "Aeroporto Francisco Sá Carneiro"
        },
        preco: {
          voo: Math.round(orcamento * 0.85),
          hotel: 300
        }
      },
      alternativas: [
        {
          destino: "Budapeste",
          pais: "Hungria",
          codigoPais: "HU",
          porque: "Deslumbrante arquitetura, banhos termais e vida noturna vibrante",
          pontoTuristico: "Parlamento Húngaro",
          aeroporto: {
            codigo: "BUD",
            nome: "Aeroporto de Budapeste-Ferenc Liszt"
          },
          preco: {
            voo: Math.round(orcamento * 0.8),
            hotel: 180
          }
        },
        {
          destino: "Cracóvia",
          pais: "Polônia",
          codigoPais: "PL",
          porque: "Centro histórico medieval preservado e rica cultura",
          pontoTuristico: "Praça do Mercado Principal",
          aeroporto: {
            codigo: "KRK",
            nome: "Aeroporto Internacional João Paulo II"
          },
          preco: {
            voo: Math.round(orcamento * 0.82),
            hotel: 150
          }
        },
        {
          destino: "Valência",
          pais: "Espanha",
          codigoPais: "ES",
          porque: "Cidade moderna com belas praias e excelente gastronomia",
          pontoTuristico: "Cidade das Artes e Ciências",
          aeroporto: {
            codigo: "VLC",
            nome: "Aeroporto de Valência"
          },
          preco: {
            voo: Math.round(orcamento * 0.78),
            hotel: 220
          }
        },
        {
          destino: "Split",
          pais: "Croácia",
          codigoPais: "HR",
          porque: "Cidade costeira com arquitetura romana e praias deslumbrantes",
          pontoTuristico: "Palácio de Diocleciano",
          aeroporto: {
            codigo: "SPU",
            nome: "Aeroporto de Split"
          },
          preco: {
            voo: Math.round(orcamento * 0.85),
            hotel: 200
          }
        }
      ],
      surpresa: {
        destino: "Liubliana",
        pais: "Eslovênia",
        codigoPais: "SI",
        descricao: "Pequena capital europeia com castelo medieval e arquitetura única.",
        porque: "Destino pouco explorado com natureza exuberante, vida urbana tranquila e ótimos preços.",
        destaque: "Visita ao Lago Bled, uma das paisagens mais bonitas da Europa",
        comentario: "Liubliana é um segredo que poucos conhecem! Adorei correr pelo parque Tivoli e explorar a Ponte do Dragão, onde dizem que os dragões batem as asas quando pessoas virgens passam por lá! 🐾",
        pontosTuristicos: [
          "Parque Tivoli",
          "Ponte do Dragão"
        ],
        aeroporto: {
          codigo: "LJU",
          nome: "Aeroporto Jože Pučnik"
        },
        preco: {
          voo: Math.round(orcamento * 0.9),
          hotel: 170
        }
      }
    },
    "asia": {
      topPick: {
        destino: "Chiang Mai",
        pais: "Tailândia",
        codigoPais: "TH",
        descricao: "Cidade histórica no norte da Tailândia conhecida por templos e natureza.",
        porque: "Alternativa mais autêntica e acessível que Bangkok, com rica cultura e gastronomia.",
        destaque: "Interagir com elefantes em santuários éticos",
        comentario: "Chiang Mai é um paraíso para cachorros curiosos como eu! Visitei o Templo Doi Suthep nas montanhas e fiquei maravilhada com a vista. Os monges até me deram petiscos de arroz! 🐾",
        pontosTuristicos: [
          "Templo Doi Suthep",
          "Mercado Noturno"
        ],
        aeroporto: {
          codigo: "CNX",
          nome: "Aeroporto Internacional de Chiang Mai"
        },
        preco: {
          voo: Math.round(orcamento * 0.85),
          hotel: 150
        }
      },
      alternativas: [
        {
          destino: "Hoi An",
          pais: "Vietnã",
          codigoPais: "VN",
          porque: "Cidade antiga com arquitetura preservada e praias próximas",
          pontoTuristico: "Cidade Antiga de Hoi An",
          aeroporto: {
            codigo: "DAD",
            nome: "Aeroporto Internacional de Da Nang"
          },
          preco: {
            voo: Math.round(orcamento * 0.88),
            hotel: 120
          }
        },
        {
          destino: "Penang",
          pais: "Malásia",
          codigoPais: "MY",
          porque: "Ilha com rica história, cultura e famosa gastronomia de rua",
          pontoTuristico: "Georgetown",
          aeroporto: {
            codigo: "PEN",
            nome: "Aeroporto Internacional de Penang"
          },
          preco: {
            voo: Math.round(orcamento * 0.83),
            hotel: 180
          }
        },
        {
          destino: "Busan",
          pais: "Coreia do Sul",
          codigoPais: "KR",
          porque: "Segunda maior cidade coreana com praias, montanhas e cultura vibrante",
          pontoTuristico: "Templo Haedong Yonggungsa",
          aeroporto: {
            codigo: "PUS",
            nome: "Aeroporto Internacional de Gimhae"
          },
          preco: {
            voo: Math.round(orcamento * 0.87),
            hotel: 220
          }
        },
        {
          destino: "Taipei",
          pais: "Taiwan",
          codigoPais: "TW",
          porque: "Capital moderna com rica história, mercados noturnos e pontos naturais próximos",
          pontoTuristico: "Taipei 101",
          aeroporto: {
            codigo: "TPE",
            nome: "Aeroporto Internacional de Taiwan Taoyuan"
          },
          preco: {
            voo: Math.round(orcamento * 0.92),
            hotel: 200
          }
        }
      ],
      surpresa: {
        destino: "Luang Prabang",
        pais: "Laos",
        codigoPais: "LA",
        descricao: "Antiga capital real com templos dourados e cachoeiras escondidas.",
        porque: "Destino sereno e menos turístico no Sudeste Asiático, com preços acessíveis e cultura intocada.",
        destaque: "Observar a tradicional procissão matinal dos monges budistas",
        comentario: "Luang Prabang é mágica! Me apaixonei pela Cachoeira Kuang Si - a água mais azul que já vi em toda minha vida! E as cerimônias de oferendas aos monges nas manhãs são uma experiência única! 🐾",
        pontosTuristicos: [
          "Cachoeira Kuang Si",
          "Monte Phousi"
        ],
        aeroporto: {
          codigo: "LPQ",
          nome: "Aeroporto Internacional de Luang Prabang"
        },
        preco: {
          voo: Math.round(orcamento * 0.87),
          hotel: 130
        }
      }
    },
    "global": {
      topPick: {
        destino: "Cartagena",
        pais: "Colômbia",
        codigoPais: "CO",
        descricao: "Cidade histórica colonial à beira-mar com arquitetura colorida.",
        porque: "Excelente custo-benefício, praias paradisíacas, centro histórico deslumbrante e comida incrível.",
        destaque: "Explorar a cidade amuralhada ao pôr do sol",
        comentario: "Cartagena me conquistou! A Cidade Amuralhada tem tantos cheiros diferentes que eu não sabia onde focar meu focinho! E as Ilhas do Rosário são um paraíso com águas tão cristalinas que dá para ver os peixinhos! 🐾",
        pontosTuristicos: [
          "Cidade Amuralhada",
          "Ilhas do Rosário"
        ],
        aeroporto: {
          codigo: "CTG",
          nome: "Aeroporto Internacional Rafael Núñez"
        },
        preco: {
          voo: Math.round(orcamento * 0.85),
          hotel: 220
        }
      },
      alternativas: [
        {
          destino: "Lisboa",
          pais: "Portugal",
          codigoPais: "PT",
          porque: "Cidade histórica vibrante com cultura rica e gastronomia incrível",
          pontoTuristico: "Torre de Belém",
          aeroporto: {
            codigo: "LIS",
            nome: "Aeroporto Humberto Delgado"
          },
          preco: {
            voo: Math.round(orcamento * 0.8),
            hotel: 250
          }
        },
        {
          destino: "Cidade do México",
          pais: "México",
          codigoPais: "MX",
          porque: "Metrópole com rica história, gastronomia incrível e excelente custo-benefício",
          pontoTuristico: "Teotihuacán",
          aeroporto: {
            codigo: "MEX",
            nome: "Aeroporto Internacional Benito Juárez"
          },
          preco: {
            voo: Math.round(orcamento * 0.7),
            hotel: 200
          }
        },
        {
          destino: "Bangkok",
          pais: "Tailândia",
          codigoPais: "TH",
          porque: "Cidade vibrante com templos deslumbrantes, mercados exóticos e culinária única",
          pontoTuristico: "Grande Palácio",
          aeroporto: {
            codigo: "BKK",
            nome: "Aeroporto Suvarnabhumi"
          },
          preco: {
            voo: Math.round(orcamento * 0.9),
            hotel: 150
          }
        },
        {
          destino: "Medellín",
          pais: "Colômbia",
          codigoPais: "CO",
          porque: "Cidade moderna com clima primaveril o ano todo e cultura vibrante",
          pontoTuristico: "Comuna 13",
          aeroporto: {
            codigo: "MDE",
            nome: "Aeroporto Internacional José María Córdova"
          },
          preco: {
            voo: Math.round(orcamento * 0.8),
            hotel: 210
          }
        }
      ],
      surpresa: {
        destino: "Medellín",
        pais: "Colômbia",
        codigoPais: "CO",
        descricao: "Cidade vibrante e moderna, com clima primaveril e cenas culturais intensas.",
        porque: "Apesar de ser bem conhecida, Medellín surpreende pela qualidade de vida, inovação urbana e clima agradável durante todo o ano.",
        destaque: "Experiência cultural nos bairros vibrantes e na Comuna 13",
        comentario: "Medellín é realmente incrível! A energia da cidade e a criatividade em cada esquina fazem dela um destino imperdível para quem busca experiências autênticas.",
        pontosTuristicos: [
          "Comuna 13",
          "Plaza Botero"
        ],
        aeroporto: {
          codigo: "MDE",
          nome: "Aeroporto Internacional José María Córdova"
        },
        preco: {
          voo: Math.round(orcamento * 0.85),
          hotel: 200
        }
      }
    }
  };

  // Função auxiliar para determinar a região de origem (pode ser expandida conforme necessário)
  function determinarRegiaoOrigem(cidade) {
    if (/Brasil/i.test(cidade)) return "americas";
    if (/Europa/i.test(cidade)) return "europa";
    if (/Ásia|China|Japão|Índia/i.test(cidade)) return "asia";
    return "global";
  }
  
  return destinosEmergencia[deteminarRegiaoOrigem(cidadeOrigem)] || destinosEmergencia["global"];
}

// Fim do arquivo recommendations.js
