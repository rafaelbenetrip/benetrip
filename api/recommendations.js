// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
const axios = require('axios');
const http = require('http');
const https = require('https');

// Configurações de timeout e limites
const REQUEST_TIMEOUT = 50000; // 50 segundos para requisições externas
const HANDLER_TIMEOUT = 55000; // 55 segundos para processamento total
const AMADEUS_TIMEOUT = 15000; // 15 segundos para requisições à API Amadeus

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

// =======================
// Autenticação Amadeus
// =======================

async function obterTokenAmadeus() {
  try {
    console.log('Iniciando autenticação Amadeus...');
    const apiKey = process.env.AMADEUS_API_KEY;
    const apiSecret = process.env.AMADEUS_API_SECRET;
    if (!apiKey || !apiSecret) {
      console.error('Credenciais Amadeus não configuradas');
      return null;
    }
    const response = await axios({
      method: 'post',
      url: 'https://api.amadeus.com/v1/security/oauth2/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        'grant_type': 'client_credentials',
        'client_id': apiKey,
        'client_secret': apiSecret
      }),
      timeout: 10000
    });
    if (!response.data || !response.data.access_token) {
      throw new Error('Token não encontrado na resposta');
    }
    console.log('Token Amadeus obtido com sucesso');
    console.log(`Tipo de token: ${response.data.token_type}`);
    console.log(`Expiração: ${response.data.expires_in} segundos`);
    return response.data.access_token;
  } catch (erro) {
    console.error(`Erro ao obter token Amadeus: ${erro.message}`);
    if (erro.response) {
      console.error(`Status: ${erro.response.status}`);
      console.error(`Dados: ${JSON.stringify(erro.response.data)}`);
    }
    return null;
  }
}

// =======================
// Função de busca de preço de voo
// =======================

async function buscarPrecoVoo(origemIATA, destinoIATA, datas, token) {
  if (!origemIATA || !destinoIATA || !datas || !token) {
    console.log(`Parâmetros incompletos para busca de voo: ${origemIATA} -> ${destinoIATA}`);
    return null;
  }

  try {
    console.log(`Buscando voos de ${origemIATA} para ${destinoIATA}...`);

    // Alerta: Caso o código IATA "STM" (por exemplo, para Santarém) esteja sendo usado, emita um aviso.
    if (destinoIATA === "STM") {
      console.warn("Atenção: Confirme se o código IATA 'STM' para Santarém é suportado pela API Amadeus.");
    }

    // Ajuste: Incluímos o filtro de classe de viagem para ECONOMY e limitamos a 1 resultado.
    const params = {
      originLocationCode: origemIATA,
      destinationLocationCode: destinoIATA,
      departureDate: datas.dataIda,
      returnDate: datas.dataVolta,
      adults: 1,
      currencyCode: 'BRL',
      travelClass: 'ECONOMY', // Mantém a classe econômica
      max: 1               // Solicita apenas o primeiro resultado
    };

    console.log('Parâmetros da requisição:', JSON.stringify(params));

    const response = await axios({
      method: 'get',
      url: 'https://api.amadeus.com/v2/shopping/flight-offers',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      params: params,
      timeout: AMADEUS_TIMEOUT
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
      const melhorOferta = response.data.data[0];
      const precoTotal = parseFloat(melhorOferta.price.total);
      const detalhesVoo = {
        companhia: melhorOferta.validatingAirlineCodes?.[0] || 'Várias',
        numeroParadas: 0,
        duracao: ''
      };
      if (melhorOferta.itineraries && melhorOferta.itineraries.length > 0) {
        const segmentosIda = melhorOferta.itineraries[0].segments || [];
        detalhesVoo.numeroParadas = Math.max(0, segmentosIda.length - 1);
        if (melhorOferta.itineraries[0].duration) {
          detalhesVoo.duracao = formatarDuracao(melhorOferta.itineraries[0].duration);
        }
      }
      return { precoReal: precoTotal, detalhesVoo };
    } else {
      console.warn('Nenhuma oferta encontrada para', origemIATA, destinoIATA);
      return null;
    }
  } catch (erro) {
    console.error(`Erro ao buscar preços de voo: ${erro.message}`);
    if (erro.response) {
      console.error(`Status: ${erro.response.status}`);
      console.error(`Dados: ${JSON.stringify(erro.response.data)}`);
      if (erro.response.data && erro.response.data.errors) {
        erro.response.data.errors.forEach(e => {
          console.error(`Código de erro: ${e.code}, Título: ${e.title}, Detalhe: ${e.detail}`);
        });
      }
    }
    return null;
  }
}

// =======================
// Função genérica de retentativa com backoff exponencial
// =======================

async function retryAsync(fn, maxAttempts = 3, initialDelay = 1000) {
  let attempt = 1;
  let delay = initialDelay;
  while (attempt <= maxAttempts) {
    try {
      const result = await fn();
      if (result) return result;
      throw new Error('Resultado inválido ou nulo');
    } catch (error) {
      console.error(`Tentativa ${attempt} falhou: ${error.message}`);
      if (attempt === maxAttempts) return null;
      console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
      attempt++;
    }
  }
  return null;
}

async function buscarPrecoComRetentativa(origemIATA, destinoIATA, datas, token) {
  return await retryAsync(
    async () => await buscarPrecoVoo(origemIATA, destinoIATA, datas, token),
    3,
    1000
  );
}

// =======================
// Endpoint alternativo: Flight Inspiration Search
// =======================

async function buscarPrecoAlternativo(origemIATA, datas, token) {
  try {
    console.log(`Tentando endpoint alternativo Flight Inspiration Search com origem ${origemIATA}`);
    const params = {
      origin: origemIATA,
      departureDate: `${datas.dataIda},${datas.dataVolta}`,
      oneWay: false,
      duration: "7,14",
      viewBy: "DESTINATION"
    };
    const response = await axios({
      method: 'get',
      url: 'https://api.amadeus.com/v1/shopping/flight-destinations',
      headers: { 'Authorization': `Bearer ${token}` },
      params: params,
      timeout: AMADEUS_TIMEOUT
    });
    return response.data;
  } catch (erro) {
    console.error(`Erro ao usar endpoint alternativo: ${erro.message}`);
    return null;
  }
}

function atualizarPrecosComDadosAlternativos(destinos, dadosAlternativos) {
  if (!dadosAlternativos || !dadosAlternativos.data) return false;
  const mapaDadosAlternativos = {};
  dadosAlternativos.data.forEach(item => {
    mapaDadosAlternativos[item.destination] = parseFloat(item.price.total);
  });
  let atualizacoesFeitas = 0;
  destinos.forEach(destino => {
    const codigoIATA = destino.aeroporto?.codigo;
    if (codigoIATA && mapaDadosAlternativos[codigoIATA]) {
      destino.preco.voo = Math.round(mapaDadosAlternativos[codigoIATA]);
      destino.preco.fonte = 'Amadeus (alternativo)';
      atualizacoesFeitas++;
    }
  });
  console.log(`Atualizados ${atualizacoesFeitas} destinos com dados alternativos`);
  return atualizacoesFeitas > 0;
}

// =======================
// Processamento de destinos para enriquecer com preços reais
// =======================

async function processarDestinos(recomendacoes, origemIATA, datas, token) {
  if (!validarCodigoIATA(origemIATA)) {
    console.error(`Código IATA de origem inválido: ${origemIATA}`);
    origemIATA = 'GRU';
    console.log(`Usando código IATA de fallback: ${origemIATA}`);
  }
  try {
    console.log('Iniciando processamento de destinos para obter preços reais...');
    if (recomendacoes.topPick && recomendacoes.topPick.aeroporto && recomendacoes.topPick.aeroporto.codigo) {
      const destinoIATA = recomendacoes.topPick.aeroporto.codigo;
      console.log(`Processando destino principal: ${recomendacoes.topPick.destino} (${destinoIATA})`);
      if (validarCodigoIATA(destinoIATA)) {
        const resultado = await buscarPrecoComRetentativa(origemIATA, destinoIATA, datas, token);
        if (resultado) {
          recomendacoes.topPick.preco.voo = resultado.precoReal;
          recomendacoes.topPick.preco.fonte = 'Amadeus';
          recomendacoes.topPick.detalhesVoo = resultado.detalhesVoo;
          console.log(`Preço atualizado para ${recomendacoes.topPick.destino}: R$ ${recomendacoes.topPick.preco.voo}`);
        }
      } else {
        console.warn(`Código IATA inválido para ${recomendacoes.topPick.destino}: ${destinoIATA}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (recomendacoes.alternativas && Array.isArray(recomendacoes.alternativas)) {
      const lotes = [];
      for (let i = 0; i < recomendacoes.alternativas.length; i += 2) {
        lotes.push(recomendacoes.alternativas.slice(i, i + 2));
      }
      for (const [index, lote] of lotes.entries()) {
        console.log(`Processando lote ${index + 1}/${lotes.length} de destinos alternativos...`);
        await Promise.all(lote.map(async (alternativa) => {
          if (alternativa.aeroporto && alternativa.aeroporto.codigo) {
            const destinoIATA = alternativa.aeroporto.codigo;
            if (validarCodigoIATA(destinoIATA)) {
              console.log(`Processando destino alternativo: ${alternativa.destino} (${destinoIATA})`);
              const resultado = await buscarPrecoComRetentativa(origemIATA, destinoIATA, datas, token);
              if (resultado) {
                alternativa.preco.voo = resultado.precoReal;
                alternativa.preco.fonte = 'Amadeus';
                alternativa.detalhesVoo = resultado.detalhesVoo;
                console.log(`Preço atualizado para ${alternativa.destino}: R$ ${alternativa.preco.voo}`);
              }
            } else {
              console.warn(`Código IATA inválido para ${alternativa.destino}: ${destinoIATA}`);
            }
          }
        }));
        if (index < lotes.length - 1) {
          console.log('Aguardando 1 segundo antes do próximo lote...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    if (recomendacoes.surpresa && recomendacoes.surpresa.aeroporto && recomendacoes.surpresa.aeroporto.codigo) {
      const destinoIATA = recomendacoes.surpresa.aeroporto.codigo;
      if (validarCodigoIATA(destinoIATA)) {
        console.log(`Processando destino surpresa: ${recomendacoes.surpresa.destino} (${destinoIATA})`);
        const resultado = await buscarPrecoComRetentativa(origemIATA, destinoIATA, datas, token);
        if (resultado) {
          recomendacoes.surpresa.preco.voo = resultado.precoReal;
          recomendacoes.surpresa.preco.fonte = 'Amadeus';
          recomendacoes.surpresa.detalhesVoo = resultado.detalhesVoo;
          console.log(`Preço atualizado para ${recomendacoes.surpresa.destino}: R$ ${recomendacoes.surpresa.preco.voo}`);
        }
      } else {
        console.warn(`Código IATA inválido para ${recomendacoes.surpresa.destino}: ${destinoIATA}`);
      }
    }
    const todosDestinos = [
      recomendacoes.topPick,
      ...(recomendacoes.alternativas || []),
      recomendacoes.surpresa
    ].filter(Boolean);
    const algunsPrecoAtualizados = todosDestinos.some(d => d.preco?.fonte === 'Amadeus');
    if (!algunsPrecoAtualizados) {
      console.log('Nenhum preço foi atualizado, tentando endpoint alternativo...');
      const dadosAlternativos = await buscarPrecoAlternativo(origemIATA, datas, token);
      if (dadosAlternativos) {
        const sucesso = atualizarPrecosComDadosAlternativos(todosDestinos, dadosAlternativos);
        if (sucesso) {
          console.log('Alguns preços foram atualizados usando endpoint alternativo');
        }
      }
    }
    return recomendacoes;
  } catch (error) {
    console.error(`Erro ao processar destinos: ${error.message}`);
    return recomendacoes;
  }
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
      console.log('Dados recebidos processados com sucesso');
    } catch (parseError) {
      console.error('Erro ao processar corpo da requisição:', parseError);
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(400).json({ error: "Formato de dados inválido", details: parseError.message });
      }
      return;
    }
    console.log('Tipo de dados recebidos:', typeof requestData);
    console.log('Conteúdo parcial:', JSON.stringify(requestData).substring(0, 200) + '...');

    let prompt;
    try {
      prompt = gerarPromptParaDestinos(requestData);
      console.log('Prompt gerado com sucesso, tamanho:', prompt.length);
    } catch (promptError) {
      console.error('Erro ao gerar prompt:', promptError);
      prompt = "Recomende destinos de viagem únicos e personalizados. Responda em formato JSON.";
    }

    let tentativas = 0;
    const maxTentativas = 3;
    while (tentativas < maxTentativas) {
      tentativas++;
      console.log(`Tentativa ${tentativas} de ${maxTentativas}`);
      
      if (process.env.PERPLEXITY_API_KEY) {
        try {
          console.log('Chamando API Perplexity...');
          const responsePerplexity = await callPerplexityAPI(prompt, requestData);
          let processedResponse = responsePerplexity;
          if (responsePerplexity && isPartiallyValidJSON(responsePerplexity)) {
            processedResponse = ensureTouristAttractionsAndComments(responsePerplexity, requestData);
          }
          if (processedResponse && isValidDestinationJSON(processedResponse, requestData)) {
            console.log('Resposta Perplexity válida recebida');
            try {
              const recomendacoes = typeof processedResponse === 'string' ? JSON.parse(processedResponse) : processedResponse;
              console.log('Tentando enriquecer recomendações com preços reais...');
              const token = await obterTokenAmadeus();
              if (token) {
                const origemIATA = obterCodigoIATAOrigem(requestData);
                const datas = obterDatasViagem(requestData);
                if (origemIATA) {
                  console.log(`Origem IATA identificada: ${origemIATA}, processando destinos...`);
                  const recomendacoesEnriquecidas = await processarDestinos(recomendacoes, origemIATA, datas, token);
                  console.log('Recomendações enriquecidas com sucesso');
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
              }
            } catch (amadeusError) {
              console.error('Erro ao enriquecer com Amadeus:', amadeusError.message);
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
            console.log('Resposta Perplexity inválida ou incompleta, tentando próxima API');
          }
        } catch (perplexityError) {
          console.error('Erro ao usar Perplexity:', perplexityError.message);
        }
      }
      
      if (process.env.OPENAI_API_KEY) {
        try {
          console.log('Chamando API OpenAI...');
          const responseOpenAI = await callOpenAIAPI(prompt, requestData);
          let processedResponse = responseOpenAI;
          if (responseOpenAI && isPartiallyValidJSON(responseOpenAI)) {
            processedResponse = ensureTouristAttractionsAndComments(responseOpenAI, requestData);
          }
          if (processedResponse && isValidDestinationJSON(processedResponse, requestData)) {
            console.log('Resposta OpenAI válida recebida');
            try {
              const recomendacoes = typeof processedResponse === 'string' ? JSON.parse(processedResponse) : processedResponse;
              console.log('Tentando enriquecer recomendações com preços reais...');
              const token = await obterTokenAmadeus();
              if (token) {
                const origemIATA = obterCodigoIATAOrigem(requestData);
                const datas = obterDatasViagem(requestData);
                if (origemIATA) {
                  console.log(`Origem IATA identificada: ${origemIATA}, processando destinos...`);
                  const recomendacoesEnriquecidas = await processarDestinos(recomendacoes, origemIATA, datas, token);
                  console.log('Recomendações enriquecidas com sucesso');
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
              }
            } catch (amadeusError) {
              console.error('Erro ao enriquecer com Amadeus:', amadeusError.message);
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
            console.log('Resposta OpenAI inválida ou incompleta, tentando próxima API');
          }
        } catch (openaiError) {
          console.error('Erro ao usar OpenAI:', openaiError.message);
        }
      }
      
      if (process.env.CLAUDE_API_KEY) {
        try {
          console.log('Chamando API Claude...');
          const responseClaude = await callClaudeAPI(prompt, requestData);
          let processedResponse = responseClaude;
          if (responseClaude && isPartiallyValidJSON(responseClaude)) {
            processedResponse = ensureTouristAttractionsAndComments(responseClaude, requestData);
          }
          if (processedResponse && isValidDestinationJSON(processedResponse, requestData)) {
            console.log('Resposta Claude válida recebida');
            try {
              const recomendacoes = typeof processedResponse === 'string' ? JSON.parse(processedResponse) : processedResponse;
              console.log('Tentando enriquecer recomendações com preços reais...');
              const token = await obterTokenAmadeus();
              if (token) {
                const origemIATA = obterCodigoIATAOrigem(requestData);
                const datas = obterDatasViagem(requestData);
                if (origemIATA) {
                  console.log(`Origem IATA identificada: ${origemIATA}, processando destinos...`);
                  const recomendacoesEnriquecidas = await processarDestinos(recomendacoes, origemIATA, datas, token);
                  console.log('Recomendações enriquecidas com sucesso');
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
              }
            } catch (amadeusError) {
              console.error('Erro ao enriquecer com Amadeus:', amadeusError.message);
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
            console.log('Resposta Claude inválida ou incompleta');
          }
        } catch (claudeError) {
          console.error('Erro ao usar Claude:', claudeError.message);
        }
      }
      
      prompt = `${prompt}\n\nURGENTE: O ORÇAMENTO MÁXIMO para voos (${requestData.orcamento_valor || 'informado'} ${requestData.moeda_escolhida || 'BRL'}) precisa ser RIGOROSAMENTE RESPEITADO. TODOS os destinos devem ter voos abaixo desse valor. Forneça um mix de destinos populares e alternativos, com preços realistas.`;
    }
    
    console.log('Todas as tentativas de obter resposta válida falharam');
    const emergencyData = generateEmergencyData(requestData);
    try {
      console.log('Tentando enriquecer dados de emergência com preços reais...');
      const token = await obterTokenAmadeus();
      if (token) {
        const origemIATA = obterCodigoIATAOrigem(requestData);
        const datas = obterDatasViagem(requestData);
        if (origemIATA) {
          console.log(`Origem IATA identificada: ${origemIATA}, processando destinos de emergência...`);
          const dadosEnriquecidos = await processarDestinos(emergencyData, origemIATA, datas, token);
          console.log('Dados de emergência enriquecidos com sucesso');
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
      }
    } catch (amadeusEmergencyError) {
      console.error('Erro ao enriquecer dados de emergência:', amadeusEmergencyError.message);
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
      res.status(500).json({
        tipo: "erro",
        message: "Erro interno no servidor"
      });
    }
  }
};

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
    if (!datas) return { dataIda: '2025-08-05', dataVolta: '2025-08-12' };
    if (typeof datas === 'string' && datas.includes(',')) {
      const [dataIda, dataVolta] = datas.split(',');
      return { dataIda: dataIda.trim(), dataVolta: dataVolta.trim() };
    }
    if (datas.dataIda && datas.dataVolta) return { dataIda: datas.dataIda, dataVolta: datas.dataVolta };
    return { dataIda: '2025-08-05', dataVolta: '2025-08-12' };
  } catch (error) {
    console.error('Erro ao obter datas de viagem:', error);
    return { dataIda: '2025-08-05', dataVolta: '2025-08-12' };
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

async function callPerplexityAPI(prompt, requestData) {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) throw new Error('Chave da API Perplexity não configurada');
    console.log('Enviando requisição para Perplexity...');
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
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message || !response.data.choices[0].message.content) {
      console.error('Resposta Perplexity incompleta:', JSON.stringify(response.data).substring(0, 200));
      throw new Error('Formato de resposta da Perplexity inválido');
    }
    const content = response.data.choices[0].message.content;
    console.log('Conteúdo recebido da API Perplexity (primeiros 200 caracteres):', content.substring(0, 200));
    return extrairJSONDaResposta(content);
  } catch (error) {
    console.error('Erro detalhado na chamada à API Perplexity:');
    if (error.code === 'ECONNABORTED') console.error('Timeout na chamada à API Perplexity');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers));
      console.error('Dados:', JSON.stringify(error.response.data).substring(0, 500));
    }
    if (error.request) console.error('Requisição enviada, mas sem resposta');
    console.error('Mensagem de erro:', error.message);
    throw error;
  }
}

async function callOpenAIAPI(prompt, requestData) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Chave da API OpenAI não configurada');
    console.log('Enviando requisição para OpenAI...');
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
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message || !response.data.choices[0].message.content) {
      throw new Error('Formato de resposta da OpenAI inválido');
    }
    const content = response.data.choices[0].message.content;
    console.log('Conteúdo recebido da API OpenAI (primeiros 200 caracteres):', content.substring(0, 200));
    return extrairJSONDaResposta(content);
  } catch (error) {
    console.error('Erro detalhado na chamada à API OpenAI:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', JSON.stringify(error.response.data).substring(0, 200));
    }
    throw error;
  }
}

async function callClaudeAPI(prompt, requestData) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) throw new Error('Chave da API Claude não configurada');
    console.log('Enviando requisição para Claude...');
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
    console.log('Conteúdo recebido da API Claude (primeiros 200 caracteres):', content.substring(0, 200));
    return extrairJSONDaResposta(content);
  } catch (error) {
    console.error('Erro detalhado na chamada à API Claude:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', JSON.stringify(error.response.data).substring(0, 200));
    }
    throw error;
  }
}

function extrairJSONDaResposta(texto) {
  try {
    console.log("Tipo da resposta recebida:", typeof texto);
    console.log("Tamanho da resposta recebida:", texto.length);
    if (typeof texto === 'object' && texto !== null) {
      console.log("Resposta já é um objeto, convertendo para string");
      return JSON.stringify(texto);
    }
    try {
      const parsed = JSON.parse(texto);
      console.log("JSON analisado com sucesso no primeiro método");
      return JSON.stringify(parsed);
    } catch (e) {
      console.log("Primeira tentativa falhou, tentando métodos alternativos");
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
        console.log("JSON extraído e analisado com sucesso via regex");
        return JSON.stringify(parsed);
      } catch (regexError) {
        console.log("Falha na extração via regex:", regexError.message);
      }
    } else {
      console.log("Nenhum padrão JSON encontrado no texto processado");
    }
    console.log("Todas as tentativas de extração falharam");
    return null;
  } catch (error) {
    console.error('Erro fatal ao processar resposta:', error);
    return null;
  }
}

function isValidDestinationJSON(jsonString, requestData) {
  if (!jsonString) return false;
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    if (!data.topPick?.destino || !data.alternativas || !data.surpresa?.destino) {
      console.log("JSON inválido: faltam campos obrigatórios básicos");
      return false;
    }
    if (!data.topPick.pontosTuristicos || !Array.isArray(data.topPick.pontosTuristicos) || data.topPick.pontosTuristicos.length < 2) {
      console.log("JSON inválido: faltam pontos turísticos no destino principal ou menos de 2");
      return false;
    }
    if (!data.surpresa.pontosTuristicos || !Array.isArray(data.surpresa.pontosTuristicos) || data.surpresa.pontosTuristicos.length < 2) {
      console.log("JSON inválido: faltam pontos turísticos no destino surpresa ou menos de 2");
      return false;
    }
    if (!Array.isArray(data.alternativas) || data.alternativas.length !== 4) {
      console.log(`JSON inválido: array de alternativas deve conter exatamente 4 destinos (contém ${data.alternativas?.length || 0})`);
      return false;
    }
    for (let i = 0; i < data.alternativas.length; i++) {
      if (!data.alternativas[i].pontoTuristico) {
        console.log(`JSON inválido: alternativa ${i+1} não tem ponto turístico`);
        return false;
      }
    }
    if (data.topPick.comentario) {
      const includesAnyTopPickAttraction = data.topPick.pontosTuristicos.some(attraction => 
        data.topPick.comentario.toLowerCase().includes(attraction.toLowerCase())
      );
      if (!includesAnyTopPickAttraction) {
        console.log("JSON inválido: comentário da Tripinha no topPick não menciona nenhum ponto turístico");
        return false;
      }
    } else {
      console.log("JSON inválido: topPick não tem comentário da Tripinha");
      return false;
    }
    if (data.surpresa.comentario) {
      const includesAnySurpriseAttraction = data.surpresa.pontosTuristicos.some(attraction => 
        data.surpresa.comentario.toLowerCase().includes(attraction.toLowerCase())
      );
      if (!includesAnySurpriseAttraction) {
        console.log("JSON inválido: comentário da Tripinha na surpresa não menciona nenhum ponto turístico");
        return false;
      }
    } else {
      console.log("JSON inválido: surpresa não tem comentário da Tripinha");
      return false;
    }
    if (requestData?.orcamento_valor && !isNaN(parseFloat(requestData.orcamento_valor))) {
      const orcamentoMax = parseFloat(requestData.orcamento_valor);
      if (data.topPick.preco?.voo > orcamentoMax) {
        console.log(`JSON inválido: topPick tem voo acima do orçamento (${data.topPick.preco?.voo} > ${orcamentoMax})`);
        return false;
      }
      if (data.alternativas[0]?.preco?.voo > orcamentoMax) {
        console.log(`JSON inválido: primeira alternativa tem voo acima do orçamento (${data.alternativas[0]?.preco?.voo} > ${orcamentoMax})`);
        return false;
      }
    }
    if (data.topPick.destino?.toLowerCase() === data.alternativas[0]?.destino?.toLowerCase()) {
      console.log("JSON inválido: destino principal repetido na primeira alternativa");
      return false;
    }
    if (!data.topPick.aeroporto || !data.topPick.aeroporto.codigo) {
      console.log("JSON inválido: falta código IATA no destino principal");
    }
    if (!data.surpresa.aeroporto || !data.surpresa.aeroporto.codigo) {
      console.log("JSON inválido: falta código IATA no destino surpresa");
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
    'Bogotá': 'BOG',
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
  const dadosEmergencia = {
    "americas": { /* ... dados de emergência para américas ... */ },
    "europa": { /* ... dados de emergência para europa ... */ },
    "asia": { /* ... dados de emergência para asia ... */ },
    "global": { /* ... dados de emergência globais ... */ }
  };
  const dadosRegiao = dadosEmergencia[regiao] || dadosEmergencia.global;
  if (orcamento) {
    if (dadosRegiao.topPick.preco.voo > orcamento * 0.95) {
      dadosRegiao.topPick.preco.voo = Math.round(orcamento * 0.85);
    }
    dadosRegiao.alternativas.forEach((alt, index) => {
      if (alt.preco.voo > orcamento * 0.95) {
        const fatorAjuste = 0.7 + (index * 0.05);
        alt.preco.voo = Math.round(orcamento * fatorAjuste);
      }
    });
    if (dadosRegiao.surpresa.preco.voo > orcamento) {
      dadosRegiao.surpresa.preco.voo = Math.round(orcamento * 0.9);
    }
  }
  dadosRegiao.alternativas = embaralharArray([...dadosRegiao.alternativas]);
  return dadosRegiao;
}

function gerarPromptParaDestinos(dados) {
  const companhia = getCompanhiaText(dados.companhia || 0);
  const preferencia = getPreferenciaText(dados.preferencia_viagem || 0);
  const cidadeOrigem = dados.cidade_partida?.name || 'origem não especificada';
  const orcamento = dados.orcamento_valor || 'flexível';
  const moeda = dados.moeda_escolhida || 'BRL';
  const quantidadePessoas = dados.quantidade_familia || dados.quantidade_amigos || 1;
  const conheceDestino = dados.conhece_destino || 0;
  const tipoDestino = dados.tipo_destino || 'qualquer';
  const famaDestino = dados.fama_destino || 'qualquer';
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
  let duracaoViagem = 'não especificada';
  try {
    if (dataIda !== 'não especificada' && dataVolta !== 'não especificada') {
      const ida = new Date(dataIda);
      const volta = new Date(dataVolta);
      const diff = Math.abs(volta - ida);
      const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
      duracaoViagem = `${dias} dias`;
    }
  } catch (e) {
    console.log("Erro ao calcular duração da viagem:", e);
  }
  let estacaoViagem = 'não determinada';
  let hemisferio = determinarHemisferio(cidadeOrigem);
  try {
    if (dataIda !== 'não especificada') {
      const dataObj = new Date(dataIda);
      const mes = dataObj.getMonth();
      if (mes >= 2 && mes <= 4) estacaoViagem = 'primavera';
      else if (mes >= 5 && mes <= 7) estacaoViagem = 'verão';
      else if (mes >= 8 && mes <= 10) estacaoViagem = 'outono';
      else estacaoViagem = 'inverno';
      if (hemisferio === 'sul') {
        if (estacaoViagem === 'verão') estacaoViagem = 'inverno';
        else if (estacaoViagem === 'inverno') estacaoViagem = 'verão';
        else if (estacaoViagem === 'primavera') estacaoViagem = 'outono';
        else if (estacaoViagem === 'outono') estacaoViagem = 'primavera';
      }
    }
  } catch (e) {
    console.log("Erro ao determinar estação do ano:", e);
  }
  const mensagemOrcamento = orcamento !== 'flexível' ?
    `⚠️ ORÇAMENTO MÁXIMO: ${orcamento} ${moeda} para voos. Todos os destinos DEVEM ter preços abaixo deste valor.` : 
    'Orçamento flexível';
  const sugestaoDistancia = gerarSugestaoDistancia(cidadeOrigem, tipoDestino);
  return `Crie recomendações de viagem que respeitam ESTRITAMENTE o orçamento do usuário:

${mensagemOrcamento}

PERFIL DO VIAJANTE:
- Partindo de: ${cidadeOrigem} ${sugestaoDistancia}
- Viajando: ${companhia}
- Número de pessoas: ${quantidadePessoas}
- Atividades preferidas: ${preferencia}
- Período da viagem: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Estação do ano na viagem: ${estacaoViagem}
- Experiência como viajante: ${conheceDestino === 1 ? 'Com experiência' : 'Iniciante'} 
- Preferência por destinos: ${getTipoDestinoText(tipoDestino)}
- Popularidade do destino: ${getFamaDestinoText(famaDestino)}

IMPORTANTE:
1. O preço do VOO de CADA destino DEVE ser MENOR que o orçamento máximo de ${orcamento} ${moeda}.
2. Forneça um mix equilibrado: inclua tanto destinos populares quanto alternativas.
3. Forneça EXATAMENTE 4 destinos alternativos diferentes entre si.
4. Considere a ÉPOCA DO ANO (${estacaoViagem}) para sugerir destinos com clima adequado.
5. Inclua destinos de diferentes continentes/regiões.
6. Garanta que os preços sejam realistas para voos de ida e volta partindo de ${cidadeOrigem}.
7. Para CADA destino, inclua o código IATA (3 letras) do aeroporto principal.
8. Para cada destino, INCLUA PONTOS TURÍSTICOS ESPECÍFICOS E CONHECIDOS.
9. Os comentários da Tripinha DEVEM mencionar pelo menos um dos pontos turísticos do destino.

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
      "aeroporto": {
        "codigo": "XYZ",
        "nome": "Nome do Aeroporto Principal"
      },
      "preco": {
        "voo": número,
        "hotel": número
      }
    },
    {
      "destino": "Nome da Cidade 2",
      "pais": "Nome do País 2", 
      "codigoPais": "XX",
      "porque": "Razão específica para visitar",
      "pontoTuristico": "Nome de um Ponto Turístico", 
      "aeroporto": {
        "codigo": "XYZ",
        "nome": "Nome do Aeroporto Principal"
      },
      "preco": {
        "voo": número,
        "hotel": número
      }
    },
    {
      "destino": "Nome da Cidade 3",
      "pais": "Nome do País 3", 
      "codigoPais": "XX",
      "porque": "Razão específica para visitar",
      "pontoTuristico": "Nome de um Ponto Turístico",
      "aeroporto": {
        "codigo": "XYZ",
        "nome": "Nome do Aeroporto Principal"
      },
      "preco": {
        "voo": número,
        "hotel": número
      }
    },
    {
      "destino": "Nome da Cidade 4",
      "pais": "Nome do País 4", 
      "codigoPais": "XX",
      "porque": "Razão específica para visitar",
      "pontoTuristico": "Nome de um Ponto Turístico",
      "aeroporto": {
        "codigo": "XYZ",
        "nome": "Nome do Aeroporto Principal"
      },
      "preco": {
        "voo": número,
        "hotel": número
      }
    }
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
    "aeroporto": {
      "codigo": "XYZ",
      "nome": "Nome do Aeroporto Principal"
    },
    "preco": {
      "voo": número,
      "hotel": número
    }
  }
}`;
}

function getCompanhiaText(value) {
  if (typeof value === 'string') value = parseInt(value, 10);
  const options = {
    0: "sozinho(a)",
    1: "em casal (viagem romântica)",
    2: "em família",
    3: "com amigos"
  };
  return options[value] || "sozinho(a)";
}

function getPreferenciaText(value) {
  if (typeof value === 'string') value = parseInt(value, 10);
  const options = {
    0: "relaxamento e descanso",
    1: "aventura e atividades ao ar livre",
    2: "cultura, história e gastronomia",
    3: "experiência urbana, compras e vida noturna"
  };
  return options[value] || "experiências diversificadas";
}

function getTipoDestinoText(value) {
  if (typeof value === 'string') value = parseInt(value, 10);
  const options = {
    0: "nacional",
    1: "internacional",
    2: "qualquer (nacional ou internacional)"
  };
  return options[value] || "qualquer";
}

function getFamaDestinoText(value) {
  if (typeof value === 'string') value = parseInt(value, 10);
  const options = {
    0: "famoso e turístico",
    1: "fora do circuito turístico comum",
    2: "mistura de ambos"
  };
  return options[value] || "qualquer";
}

function determinarHemisferio(cidadeOrigem) {
  const indicadoresSul = ['brasil', 'argentina', 'chile', 'austrália', 'nova zelândia', 'áfrica do sul', 'peru', 'uruguai', 'paraguai', 'bolívia'];
  if (!cidadeOrigem || cidadeOrigem === 'origem não especificada') return 'norte';
  const cidadeLowerCase = cidadeOrigem.toLowerCase();
  if (indicadoresSul.some(termo => cidadeLowerCase.includes(termo))) return 'sul';
  return 'norte';
}

function gerarSugestaoDistancia(cidadeOrigem, tipoDestino) {
  if (cidadeOrigem === 'origem não especificada' || tipoDestino === 0) return '';
  const grandeshubs = ['nova york', 'londres', 'paris', 'tóquio', 'dubai', 'são paulo'];
  const cidadeLowerCase = cidadeOrigem.toLowerCase();
  if (grandeshubs.some(cidade => cidadeLowerCase.includes(cidade))) {
    return '(considere incluir destinos intercontinentais)';
  }
  return '(considere a distância e acessibilidade)';
}

function determinarRegiaoOrigem(cidadeOrigem) {
  if (cidadeOrigem.toLowerCase().includes('são paulo') || cidadeOrigem.toLowerCase().includes('rio')) {
    return 'americas';
  }
  return 'global';
}

function embaralharArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
