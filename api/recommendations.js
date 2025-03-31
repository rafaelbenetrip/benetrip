// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
const axios = require('axios');

// Aumentar o timeout para 50 segundos (dentro do limite de 60s do Vercel PRO)
const REQUEST_TIMEOUT = 50000;

module.exports = async function handler(req, res) {
  // Configuração de CORS para qualquer origem
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Lidar com requisições OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Apenas permitir requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Criar um wrapper global para toda a lógica
  try {
    // Verificar se existe corpo na requisição
    if (!req.body) {
      console.error('Corpo da requisição vazio');
      return res.status(400).json({ error: "Nenhum dado fornecido na requisição" });
    }
    
    // Extrair dados da requisição com verificação extra
    let requestData;
    try {
      requestData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      console.log('Dados recebidos processados com sucesso');
    } catch (parseError) {
      console.error('Erro ao processar corpo da requisição:', parseError);
      return res.status(400).json({ error: "Formato de dados inválido", details: parseError.message });
    }
    
    // Verificação adicional de dados
    console.log('Tipo de dados recebidos:', typeof requestData);
    console.log('Conteúdo parcial:', JSON.stringify(requestData).substring(0, 200) + '...');
    
    // Gerar prompt baseado nos dados do usuário
    let prompt;
    try {
      prompt = gerarPromptParaDestinos(requestData);
      console.log('Prompt gerado com sucesso, tamanho:', prompt.length);
    } catch (promptError) {
      console.error('Erro ao gerar prompt:', promptError);
      prompt = "Recomende destinos de viagem únicos e personalizados para o Brasil e mundo. Um destino principal, 4 destinos alternativos diferentes entre si, e um destino surpresa diferente dos demais. Seja criativo e evite destinos óbvios ou repetidos. Responda em formato JSON.";
    }
    
    // Tentar múltiplas vezes a consulta à API com diferentes modelos
    // até um deles retornar uma resposta válida
    let tentativas = 0;
    const maxTentativas = 3;
    
    while (tentativas < maxTentativas) {
      tentativas++;
      console.log(`Tentativa ${tentativas} de ${maxTentativas}`);
      
      // 1. Tentar Perplexity primeiro
      if (process.env.PERPLEXITY_API_KEY) {
        try {
          console.log('Chamando API Perplexity...');
          const response = await callPerplexityAPI(prompt);
          if (response && isValidDestinationJSON(response)) {
            console.log('Resposta Perplexity válida recebida');
            return res.status(200).json({
              tipo: "perplexity",
              conteudo: response,
              tentativa: tentativas
            });
          } else {
            console.log('Resposta Perplexity inválida ou incompleta, tentando próxima API');
          }
        } catch (perplexityError) {
          console.error('Erro ao usar Perplexity:', perplexityError.message);
        }
      }
      
      // 2. Tentar OpenAI em seguida
      if (process.env.OPENAI_API_KEY) {
        try {
          console.log('Chamando API OpenAI...');
          const response = await callOpenAIAPI(prompt);
          if (response && isValidDestinationJSON(response)) {
            console.log('Resposta OpenAI válida recebida');
            return res.status(200).json({
              tipo: "openai",
              conteudo: response,
              tentativa: tentativas
            });
          } else {
            console.log('Resposta OpenAI inválida ou incompleta, tentando próxima API');
          }
        } catch (openaiError) {
          console.error('Erro ao usar OpenAI:', openaiError.message);
        }
      }
      
      // 3. Tentar Claude por último
      if (process.env.CLAUDE_API_KEY) {
        try {
          console.log('Chamando API Claude...');
          const response = await callClaudeAPI(prompt);
          if (response && isValidDestinationJSON(response)) {
            console.log('Resposta Claude válida recebida');
            return res.status(200).json({
              tipo: "claude",
              conteudo: response,
              tentativa: tentativas
            });
          } else {
            console.log('Resposta Claude inválida ou incompleta');
          }
        } catch (claudeError) {
          console.error('Erro ao usar Claude:', claudeError.message);
        }
      }
      
      // Se chegamos aqui, todas as tentativas falharam nesta iteração
      // Vamos modificar o prompt para a próxima tentativa para incentivar mais criatividade
      prompt = `${prompt}\n\nIMPORTANTE: Sugira destinos CRIATIVOS e ÚNICOS. Faça um misto entre destinos alternativos e menos óbvios e destinos conhecidos, sempre adequando às preferências indicadas.`;
    }
    
    // Se todas as tentativas falharam, criar uma resposta de emergência
    console.log('Todas as tentativas de obter resposta válida falharam');
    
    // Usar um conjunto de dados de emergência que são diferentes dos destinos comuns
    // que estavam se repetindo (Santiago, Cusco, etc.)
    const emergencyData = generateEmergencyData(requestData);
    
    return res.status(200).json({
      tipo: "emergencia",
      conteudo: JSON.stringify(emergencyData),
      message: "Todas as tentativas de API falharam"
    });
    
  } catch (globalError) {
    // Captura qualquer erro não tratado para evitar o 500
    console.error('Erro global na API de recomendações:', globalError);
    
    // Retornar resposta de erro com dados de emergência
    const emergencyData = generateEmergencyData();
    
    return res.status(200).json({ 
      tipo: "erro",
      conteudo: JSON.stringify(emergencyData),
      error: globalError.message
    });
  }
}

// Chamar a API da Perplexity com melhor tratamento de erros
async function callPerplexityAPI(prompt) {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave da API Perplexity não configurada');
    }
    
    console.log('Enviando requisição para Perplexity...');
    
    // Construir instruções claras para não usar formatação markdown
    const enhancedPrompt = `${prompt}\n\nIMPORTANTE: NÃO inclua blocos de código, marcadores markdown, ou comentários em sua resposta. Retorne APENAS o JSON puro.`;
    
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
            content: 'Você é um especialista em viagens focado em fornecer recomendações altamente personalizadas. Evite sugerir destinos populares ou óbvios. Gere sugestões completamente diferentes uma das outras, criativas e adequadas ao perfil do viajante. Retorne APENAS JSON puro, sem marcações ou formatação extra.'
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.9, // Aumentando a temperatura para mais criatividade
        max_tokens: 3000,
        response_format: { type: "text" }
      },
      timeout: REQUEST_TIMEOUT
    });
    
    // Verificar se a resposta contém o conteúdo esperado
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message || !response.data.choices[0].message.content) {
      console.error('Resposta Perplexity incompleta:', JSON.stringify(response.data).substring(0, 200));
      throw new Error('Formato de resposta da Perplexity inválido');
    }
    
    // Tentar extrair o JSON da resposta de texto
    const content = response.data.choices[0].message.content;
    console.log('Conteúdo recebido da API Perplexity (primeiros 200 caracteres):', content.substring(0, 200));
    
    return extrairJSONDaResposta(content);
  } catch (error) {
    console.error('Erro detalhado na chamada à API Perplexity:');
    
    // Verificar se é um erro de timeout
    if (error.code === 'ECONNABORTED') {
      console.error('Timeout na chamada à API Perplexity');
    }
    
    // Verificar erro de resposta da API
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers));
      console.error('Dados:', JSON.stringify(error.response.data).substring(0, 500));
    }
    
    // Verificar erro de requisição
    if (error.request) {
      console.error('Requisição enviada, mas sem resposta');
    }
    
    // Outros erros
    console.error('Mensagem de erro:', error.message);
    
    throw error;
  }
}

// Chamar a API da OpenAI como alternativa
async function callOpenAIAPI(prompt) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave da API OpenAI não configurada');
    }
    
    console.log('Enviando requisição para OpenAI...');
    
    // Modificar o prompt para pedir explicitamente resposta em JSON
    const enhancedPrompt = `${prompt}\n\nIMPORTANTE: Sua resposta deve ser exclusivamente um objeto JSON válido sem formatação markdown. NÃO inclua blocos de código, comentários ou texto adicional.`;
    
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
            content: "Você é um especialista em viagens focado em fornecer recomendações altamente personalizadas e criativas. Gere sugestões diversas uma das outras e adequadas ao perfil do viajante. Retorne APENAS JSON puro, sem formatação extra."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        temperature: 0.9, // Aumentando a temperatura para mais criatividade
        max_tokens: 3000
      },
      timeout: REQUEST_TIMEOUT
    });
    
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message || !response.data.choices[0].message.content) {
      throw new Error('Formato de resposta da OpenAI inválido');
    }
    
    // Extrair JSON da resposta
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

// Chamar a API do Claude como alternativa final
async function callClaudeAPI(prompt) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    console.log('Enviando requisição para Claude...');
    
    // Adicionar instrução específica para o Claude retornar apenas JSON
    const enhancedPrompt = `${prompt}\n\nIMPORTANTE: Sua resposta deve ser APENAS o objeto JSON válido, sem NENHUM texto adicional, marcação de código, comentários ou explicações.`;
    
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
            content: "Você é um especialista em viagens focado em fornecer recomendações altamente personalizadas e criativas. Gere sugestões diversas e adequadas ao perfil do viajante. Retorne APENAS JSON puro."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        temperature: 0.9 // Aumentando a temperatura para mais criatividade
      },
      timeout: REQUEST_TIMEOUT
    });
    
    if (!response.data || !response.data.content || !response.data.content[0] || !response.data.content[0].text) {
      throw new Error('Formato de resposta do Claude inválido');
    }
    
    // Extrair JSON da resposta
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

// Função aprimorada para extrair JSON válido de uma string de texto
function extrairJSONDaResposta(texto) {
  try {
    // Registrar o formato do texto para diagnóstico
    console.log("Tipo da resposta recebida:", typeof texto);
    console.log("Tamanho da resposta recebida:", texto.length);
    
    // Verificar se já é um objeto JSON
    if (typeof texto === 'object' && texto !== null) {
      console.log("Resposta já é um objeto, convertendo para string");
      return JSON.stringify(texto);
    }
    
    // Primeira tentativa: Analisar diretamente se for um JSON limpo
    try {
      const parsed = JSON.parse(texto);
      console.log("JSON analisado com sucesso no primeiro método");
      return JSON.stringify(parsed); 
    } catch (e) {
      console.log("Primeira tentativa falhou, tentando métodos alternativos");
      // Continuar com os outros métodos
    }
    
    // Pré-processar o texto para remover problemas comuns
    let textoProcessado = texto
      // Remover blocos de código markdown
      .replace(/```json/g, '')
      .replace(/```/g, '')
      // Remover comentários de estilo JavaScript
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Normalizar quebras de linha e espaços extras
      .replace(/\r\n/g, '\n')
      .trim();
    
    // Tentar encontrar um objeto JSON usando regex mais preciso
    const jsonRegex = /(\{[\s\S]*\})/;
    const match = textoProcessado.match(jsonRegex);
    
    if (match && match[0]) {
      try {
        // Tentar analisar o texto extraído
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
    
    // Se todas as tentativas falharem, retornar null para tentar outro serviço
    console.log("Todas as tentativas de extração falharam");
    return null;
  } catch (error) {
    console.error('Erro fatal ao processar resposta:', error);
    return null;
  }
}

// Verifica se o objeto JSON recebido é válido para nosso contexto
function isValidDestinationJSON(jsonString) {
  if (!jsonString) return false;
  
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    
    // Verificar se tem os campos obrigatórios
    if (!data.topPick || !data.alternativas || !data.surpresa) {
      console.log("JSON inválido: faltam campos obrigatórios");
      return false;
    }
    
    // Verificar se tem pelo menos um destino alternativo
    if (!Array.isArray(data.alternativas) || data.alternativas.length < 1) {
      console.log("JSON inválido: array de alternativas vazio ou inexistente");
      return false;
    }
    
    // Verificar se os destinos principais têm os campos necessários
    if (!data.topPick.destino || !data.topPick.pais || !data.topPick.preco) {
      console.log("JSON inválido: topPick incompleto");
      return false;
    }
    
    // Verificar se o destino surpresa tem os campos necessários
    if (!data.surpresa.destino || !data.surpresa.pais || !data.surpresa.preco) {
      console.log("JSON inválido: surpresa incompleto");
      return false;
    }
    
    // Verificar se não é um caso de destinos repetidos como Santiago e Cusco
    const destinos = [
      data.topPick.destino,
      ...data.alternativas.map(alt => alt.destino),
      data.surpresa.destino
    ].map(d => d.toLowerCase());
    
    // Verificar se não tem os destinos que estão se repetindo nos resultados
    const problemDestinos = ['santiago', 'cusco', 'buenos aires', 'montevidéu', 'montevideo'];
    const repetidos = destinos.filter(d => problemDestinos.includes(d));
    
    if (repetidos.length >= 2) {
      console.log(`JSON tem destinos problemáticos repetidos: ${repetidos.join(', ')}`);
      return false;
    }
    
    // Verificar se há destinos repetidos em geral
    const destSet = new Set(destinos);
    if (destSet.size < destinos.length) {
      console.log("JSON tem destinos repetidos");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Erro ao validar JSON:", error);
    return false;
  }
}

// Função para gerar prompt adequado para a IA
function gerarPromptParaDestinos(dados) {
  // Extrair informações relevantes dos dados recebidos, com verificações
  const companhia = getCompanhiaText(dados.companhia || 0);
  const preferencia = getPreferenciaText(dados.preferencia_viagem || 0);
  const cidadeOrigem = dados.cidade_partida?.name || 'origem não especificada';
  const orcamento = dados.orcamento_valor || 'flexível';
  const moeda = dados.moeda_escolhida || 'BRL';
  
  // Extrair informações sobre quantidade de pessoas
  const quantidadePessoas = dados.quantidade_familia || dados.quantidade_amigos || 1;
  
  // Extrair qualquer informação adicional importante
  const conheceDestino = dados.conhece_destino || 0;
  const tipoDestino = dados.tipo_destino || 'qualquer';
  const famaDestino = dados.fama_destino || 'qualquer';
  
  // Datas de viagem com verificação de formato
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
  
  // Calcular duração da viagem para contextualizar melhor
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

  // Construir prompt detalhado e personalizado
  return `Crie recomendações de viagem CRIATIVAS e ÚNICAS para:

PERFIL DO VIAJANTE:
- Partindo de: ${cidadeOrigem}
- Viajando: ${companhia}
- Número de pessoas: ${quantidadePessoas}
- Atividades preferidas: ${preferencia}
- Orçamento por pessoa: ${orcamento} ${moeda}
- Período da viagem: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Experiência como viajante: ${conheceDestino === 1 ? 'Com experiência' : 'Iniciante'} 
- Preferência por destinos: ${getTipoDestinoText(tipoDestino)}
- Popularidade do destino: ${getFamaDestinoText(famaDestino)}

IMPORTANTE:
1. Sugira destinos DIVERSOS e CRIATIVOS que combinem bem com o perfil.
2. Destinos DEVEM ser DIFERENTES entre si e necessitar de uma viagem de avião.
3. O destino principal, alternativas e surpresa DEVEM ser de locais DISTINTOS.

Forneça no formato JSON exato abaixo, SEM formatação markdown:
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão específica para visitar baseada nas preferências",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário entusiasmado da Tripinha (cachorra)",
    "preco": {
      "voo": número,
      "hotel": número
    }
  },
  "alternativas": [
    {
      "destino": "Nome da Cidade",
      "pais": "Nome do País", 
      "codigoPais": "XX",
      "porque": "Razão específica para visitar",
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
    "comentario": "Comentário entusiasmado da Tripinha",
    "preco": {
      "voo": número,
      "hotel": número
    }
  }
}`;
}

// Função auxiliar para obter texto de companhia com verificação de tipo
function getCompanhiaText(value) {
  // Converter para número se for string
  if (typeof value === 'string') {
    value = parseInt(value, 10);
  }
  
  const options = {
    0: "sozinho(a)",
    1: "em casal (viagem romântica)",
    2: "em família",
    3: "com amigos"
  };
  return options[value] || "sozinho(a)";
}

// Função auxiliar para obter texto de preferência com verificação de tipo
function getPreferenciaText(value) {
  // Converter para número se for string
  if (typeof value === 'string') {
    value = parseInt(value, 10);
  }
  
  const options = {
    0: "relaxamento e descanso (praias, resorts tranquilos, spas)",
    1: "aventura e atividades ao ar livre (trilhas, esportes, natureza)",
    2: "cultura, história e gastronomia (museus, centros históricos, culinária local)",
    3: "experiência urbana, compras e vida noturna (centros urbanos, lojas, restaurantes)"
  };
  return options[value] || "experiências diversificadas de viagem";
}

// Função auxiliar para obter texto de tipo de destino
function getTipoDestinoText(value) {
  // Converter para número se for string
  if (typeof value === 'string') {
    value = parseInt(value, 10);
  }
  
  const options = {
    0: "nacional",
    1: "internacional",
    2: "qualquer (nacional ou internacional)"
  };
  return options[value] || "qualquer";
}

// Função auxiliar para obter texto de fama do destino
function getFamaDestinoText(value) {
  // Converter para número se for string
  if (typeof value === 'string') {
    value = parseInt(value, 10);
  }
  
  const options = {
    0: "famoso e turístico",
    1: "fora do circuito turístico comum",
    2: "mistura de ambos"
  };
  return options[value] || "qualquer";
}

// Função para gerar dados de emergência personalizados baseados no perfil
function generateEmergencyData(dadosUsuario = {}) {
  // Determinar o tipo de destino baseado nas preferências
  const preferencia = dadosUsuario.preferencia_viagem || 0;
  const companhia = dadosUsuario.companhia || 0;
  const quantidadePessoas = dadosUsuario.quantidade_familia || dadosUsuario.quantidade_amigos || 1;
  
  // Vamos ter alguns conjuntos de destinos por tipo de viagem
  const destinosPorPreferencia = {
    // Relaxamento (0)
    0: [
      {
        topPick: {
          destino: "Jericoacoara",
          pais: "Brasil",
          codigoPais: "BR",
          descricao: "Paraíso de dunas, lagoas e praias no Ceará",
          porque: "Combinação perfeita de praias paradisíacas e ambiente relaxado",
          destaque: "Pôr do sol na Duna do Pôr do Sol com show de capoeira",
          comentario: "Au au! Jeri tem dunas INCRÍVEIS para cavar e praias sem fim para correr! E aquelas redes dentro d'água? Paraíso canino!",
          preco: { voo: 1200, hotel: 280 }
        },
        alternativas: [
          {
            destino: "Maragogi",
            pais: "Brasil",
            codigoPais: "BR",
            porque: "As 'piscinas naturais' garantem relaxamento total em águas cristalinas",
            preco: { voo: 1100, hotel: 250 }
          },
          {
            destino: "Ilhabela",
            pais: "Brasil",
            codigoPais: "BR",
            porque: "Combina praias tranquilas com natureza exuberante, perfeito para descanso",
            preco: { voo: 900, hotel: 320 }
          },
          {
            destino: "Punta Cana",
            pais: "República Dominicana",
            codigoPais: "DO",
            porque: "Resorts all-inclusive em praias de areia branca com coqueiros",
            preco: { voo: 2800, hotel: 480 }
          },
          {
            destino: "Maldivas",
            pais: "Maldivas",
            codigoPais: "MV",
            porque: "A definição de paraíso com bangalôs sobre águas cristalinas",
            preco: { voo: 5200, hotel: 950 }
          }
        ],
        surpresa: {
          destino: "Zanzibar",
          pais: "Tanzânia",
          codigoPais: "TZ",
          descricao: "Ilha paradisíaca com praias de areia branca e cultura swahili única",
          porque: "Combina praias espetaculares com uma cultura fascinante e pouco explorada pelos brasileiros",
          destaque: "Tour de especiarias nas fazendas históricas seguido de jantar na praia",
          comentario: "Zanzibar é um tesouro escondido que você nem imaginava! Praias de cinema, povo acolhedor e uma história cheia de mistérios! Au au de alegria só de pensar! 🐾🌴",
          preco: { voo: 4200, hotel: 300 }
        }
      }
    ],
    // Aventura (1)
    1: [
      {
        topPick: {
          destino: "Alter do Chão",
          pais: "Brasil",
          codigoPais: "BR",
          descricao: "O 'Caribe Amazônico' com praias de rio e floresta intocada",
          porque: "Oferece aventura em trilhas na Amazônia e esportes aquáticos nos rios cristalinos",
          destaque: "Passeio de barco até a Ilha do Amor e trilha na Floresta Nacional do Tapajós",
          comentario: "Alter do Chão tem TANTOS cheiros incríveis para farejar na floresta! E aquela água clarinha pra nadar? Patas para cima, melhor aventura ever! 🐾🌳",
          preco: { voo: 1400, hotel: 180 }
        },
        alternativas: [
          {
            destino: "Lençóis Maranhenses",
            pais: "Brasil",
            codigoPais: "BR",
            porque: "Aventura entre dunas e lagoas de água doce em paisagem única no mundo",
            preco: { voo: 1300, hotel: 220 }
          },
          {
            destino: "Chapada dos Veadeiros",
            pais: "Brasil",
            codigoPais: "BR",
            porque: "Trilhas desafiadoras levam a cachoeiras espetaculares e cânions",
            preco: { voo: 950, hotel: 170 }
          },
          {
            destino: "Queenstown",
            pais: "Nova Zelândia",
            codigoPais: "NZ",
            porque: "Capital mundial dos esportes radicais com bungee jump e rafting",
            preco: { voo: 6800, hotel: 340 }
          },
          {
            destino: "San Gil",
            pais: "Colômbia",
            codigoPais: "CO",
            porque: "Destino emergente para esportes radicais com rafting, parapente e mountain bike",
            preco: { voo: 2100, hotel: 150 }
          }
        ],
        surpresa: {
          destino: "Komodo",
          pais: "Indonésia",
          codigoPais: "ID",
          descricao: "Ilha habitada pelos famosos dragões de Komodo com snorkel em corais intocados",
          porque: "Combina aventura selvagem com os dragões e mergulho em alguns dos corais mais preservados do mundo",
          destaque: "Trekking guiado para observar os dragões de Komodo em seu habitat natural",
          comentario: "Uau! Komodo tem LAGARTOS GIGANTES! Eu ficaria latindo de longe, mas você vai amar! E os peixes coloridos? O paraíso existe, e é aqui! 🐾🦎",
          preco: { voo: 5500, hotel: 260 }
        }
      }
    ],
    // Cultura (2)
    2: [
      {
        topPick: {
          destino: "Salvador",
          pais: "Brasil",
          codigoPais: "BR",
          descricao: "Capital da cultura afro-brasileira com música, gastronomia e história colonial",
          porque: "Imersão profunda na cultura afro-brasileira com arquitetura colonial preservada",
          destaque: "Aula de percussão com mestres locais seguida de jantar de comida baiana tradicional",
          comentario: "Salvador tem TANTOS cheiros de comida boa e música que faz até cachorro querer sambar! O Pelourinho é demais para passear e farejar história! 🐾🥁",
          preco: { voo: 1100, hotel: 220 }
        },
        alternativas: [
          {
            destino: "Ouro Preto",
            pais: "Brasil",
            codigoPais: "BR",
            porque: "Joia do barroco brasileiro com igrejas históricas e gastronomia mineira",
            preco: { voo: 950, hotel: 190 }
          },
          {
            destino: "Quioto",
            pais: "Japão",
            codigoPais: "JP",
            porque: "Templos milenares e tradições vivas da cultura japonesa",
            preco: { voo: 5900, hotel: 310 }
          },
          {
            destino: "Istambul",
            pais: "Turquia",
            codigoPais: "TR",
            porque: "Encontro entre Oriente e Ocidente com bazaars, mesquitas e palácios históricos",
            preco: { voo: 4200, hotel: 270 }
          },
          {
            destino: "Cartagena",
            pais: "Colômbia",
            codigoPais: "CO",
            porque: "Cidade colonial cercada por muralhas com rica herança cultural afro-caribenha",
            preco: { voo: 1900, hotel: 230 }
          }
        ],
        surpresa: {
          destino: "Luang Prabang",
          pais: "Laos",
          codigoPais: "LA",
          descricao: "Cidade patrimônio mundial com templos budistas e ritual diário dos monges",
          porque: "Experiência cultural profunda em um dos destinos mais autênticos e menos turísticos do Sudeste Asiático",
          destaque: "Cerimônia do Tak Bat, onde centenas de monges coletam oferendas ao amanhecer",
          comentario: "Luang Prabang tem monges de túnicas laranja e comida TÃO cheirosa nos mercados! Fiquei sentada comportada vendo os monges passarem! Quase ganhei petiscos! 🐾🏮",
          preco: { voo: 4900, hotel: 180 }
        }
      }
    ],
    // Urbano (3)
    3: [
      {
        topPick: {
          destino: "São Paulo",
          pais: "Brasil",
          codigoPais: "BR",
          descricao: "Metrópole vibrante com os melhores restaurantes, compras e vida noturna",
          porque: "Oferece diversidade gastronômica imbatível e compras de classe mundial",
          destaque: "Tour gastronômico pelos bares da Vila Madalena seguido de balada premium",
          comentario: "São Paulo tem TANTOS cheiros diferentes e restaurantes pet friendly! Tem até sorveteria para cachorro! Amo passear na Paulista aos domingos! 🐾🌆",
          preco: { voo: 800, hotel: 280 }
        },
        alternativas: [
          {
            destino: "Dubai",
            pais: "Emirados Árabes Unidos",
            codigoPais: "AE",
            porque: "Shopping de luxo, arquitetura futurista e experiências urbanas exclusivas",
            preco: { voo: 4800, hotel: 520 }
          },
          {
            destino: "Tóquio",
            pais: "Japão",
            codigoPais: "JP",
            porque: "Mistura de tradição e futuro com tecnologia, moda e gastronomia de ponta",
            preco: { voo: 5700, hotel: 380 }
          },
          {
            destino: "Nova York",
            pais: "Estados Unidos",
            codigoPais: "US",
            porque: "A capital cultural do mundo com teatros, museus, compras e vida noturna",
            preco: { voo: 3900, hotel: 450 }
          },
          {
            destino: "Cidade do México",
            pais: "México",
            codigoPais: "MX",
            porque: "Metrópole vibrante com fusão entre cultura histórica e modernidade",
            preco: { voo: 2800, hotel: 260 }
          }
        ],
        surpresa: {
          destino: "Beirute",
          pais: "Líbano",
          codigoPais: "LB",
          descricao: "Cidade cosmopolita com vida noturna lendária e gastronomia premiada",
          porque: "Surpreende com sua cena cultural vibrante, clubes de classe mundial e contrastes arquitetônicos",
          destaque: "Jantar nos restaurantes badalados de Mar Mikhael seguido de clubes premiados",
          comentario: "Beirute é INCRÍVEL! Tanta comida cheirosa, música alta e pessoas que adoram fazer carinho em cachorros! A vida noturna é au au de primeira! 🐾🌙",
          preco: { voo: 4100, hotel: 290 }
        }
      }
    ]
  };
  
  // Selecionar baseado na preferência e variáveis aleatórias para evitar repetições
  const conjuntoPreferencia = destinosPorPreferencia[preferencia] || destinosPorPreferencia[0];
  const indiceAleatorio = Math.floor(Math.random() * conjuntoPreferencia.length);
  
  // Reordenar alternativas para evitar sempre as mesmas posições
  const resultado = {...conjuntoPreferencia[indiceAleatorio]};
  resultado.alternativas = embaralharArray([...resultado.alternativas]).slice(0, 4);
  
  return resultado;
}

// Função auxiliar para embaralhar arrays (útil para reordenar destinos)
function embaralharArray(array) {
  let currentIndex = array.length;
  let randomIndex;

  // Enquanto existirem elementos a serem embaralhados
  while (currentIndex != 0) {
    // Escolher um elemento restante
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // E trocar com o elemento atual
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
}
