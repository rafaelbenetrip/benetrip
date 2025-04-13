// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
const axios = require('axios');
const http = require('http');
const https = require('https');

// =======================
// Configurações
// =======================
const CONFIG = {
  timeout: {
    request: 60000,
    handler: 120000,
    retry: 2000
  },
  retries: 2,
  logging: {
    enabled: true,
    maxLength: 500
  },
  // Configuração OpenRouter
  openRouter: {
    defaultModel: 'deepseek/deepseek-llm',  // Ative reasoner_enabled ao usar
    backupModels: [
      'anthropic/claude-3-sonnet',
      'google/gemini-pro',
      'meta-llama/llama-3-70b-instruct'
    ]
  }
};

// =======================
// Cliente HTTP configurado
// =======================
const apiClient = axios.create({
  timeout: CONFIG.timeout.request,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  headers: {
    'Content-Type': 'application/json'
  }
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
  
  // Sistema de pontuação para relevância de destinos
  calcularPontuacaoRelevancia: (destino, preferencias) => {
    if (!destino || !preferencias) return 0;
    
    let pontuacao = 0;
    const max = 100;
    
    // Verifica tipo de destino (nacional/internacional)
    if (preferencias.tipoDestino === 0 && destino.pais?.toLowerCase() === 'brasil') { 
      pontuacao += 15;
    } else if (preferencias.tipoDestino === 1 && destino.pais?.toLowerCase() !== 'brasil') {
      pontuacao += 15;
    } else if (preferencias.tipoDestino === 2) {
      pontuacao += 10; // Pontuação para "tanto faz"
    }
    
    // Verifica popularidade do destino
    if (preferencias.famaDestino === 0 && destino.popularidade === 'alta') {
      pontuacao += 10;
    } else if (preferencias.famaDestino === 1 && destino.popularidade === 'baixa') {
      pontuacao += 10;
    } else if (preferencias.famaDestino === 2) {
      pontuacao += 7; // Pontuação para "tanto faz"
    }
    
    // Verifica preço dentro do orçamento
    if (preferencias.orcamento_valor && destino.preco?.voo) {
      const orcamento = parseFloat(preferencias.orcamento_valor);
      const precoVoo = parseFloat(destino.preco.voo);
      
      if (precoVoo <= orcamento) {
        // Quanto mais próximo do orçamento (80-100%), melhor a pontuação
        const percentualOrcamento = precoVoo / orcamento;
        if (percentualOrcamento >= 0.8 && percentualOrcamento <= 1.0) {
          pontuacao += 20;
        } else if (percentualOrcamento >= 0.6 && percentualOrcamento < 0.8) {
          pontuacao += 15;
        } else {
          pontuacao += 10; // Muito abaixo do orçamento
        }
      } else {
        // Destino acima do orçamento recebe penalidade
        pontuacao -= 15;
      }
    }
    
    // Adicional por experiência do tipo de viagem
    if (destino.experiencias) {
      switch(parseInt(preferencias.companhia || 0)) {
        case 0: // sozinho
          if (destino.experiencias.includes('solo')) pontuacao += 15;
          break;
        case 1: // casal
          if (destino.experiencias.includes('romantico')) pontuacao += 15;
          break;
        case 2: // família
          if (destino.experiencias.includes('familia')) pontuacao += 15;
          break;
        case 3: // amigos
          if (destino.experiencias.includes('grupo')) pontuacao += 15;
          break;
      }
    }
    
    return Math.min(pontuacao, max);
  }
};
// =======================
// ação com OpenRouter corrigida
// =======================
async function callOpenRouterAPI(prompt, requestData, modelName = CONFIG.openRouter.defaultModel) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  
  if (!openRouterKey) {
    throw new Error("Chave da API OpenRouter não configurada");
  }
  
  try {
    utils.log(`Enviando requisição para OpenRouter (${modelName})...`, null);
    
    // Parâmetros base para a requisição
    const requestParams = {
      model: modelName,
      messages: [
        {
          role: "system",
          content: "Você é um especialista em viagens com experiência em destinos globais. Retorne apenas JSON com destinos detalhados, respeitando o formato solicitado."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    };
    
    // Adiciona reasoner_enabled apenas para Deepseek
    if (modelName.includes('deepseek')) {
      requestParams.additional_model_parameters = {
        reasoner_enabled: true
      };
    }
    
    // Defina um timeout menor para cada requisição individual
    const response = await apiClient({
      method: 'post',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'HTTP-Referer': 'https://benetrip.com.br',
        'X-Title': 'Benetrip - Recomendação de Destinos'
      },
      data: requestParams,
      timeout: 60000  // 60 segundos para cada chamada individual
    });
    
    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error(`Formato de resposta do OpenRouter inválido`);
    }
    
    const content = response.data.choices[0].message.content;
    utils.log(`Conteúdo recebido da OpenRouter (primeiros 200 caracteres):`, content.substring(0, 200));
    
    return utils.extrairJSONDaResposta(content);
  } catch (error) {
    console.error(`Erro na chamada à API OpenRouter (${modelName}):`, error.message);
    if (error.response) {
      utils.log(`Resposta de erro (OpenRouter):`, error.response.data);
    }
    throw error;
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
    delay = Math.min(delay * 1.5, 8000);
    attempt++;
  }
  
  return null;
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
// Melhorar a relevância das recomendações
// =======================
function gerarPromptAprimorado(dados) {
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
    } catch (error) {
      console.error('Erro ao calcular duração da viagem:', error.message);
    }
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
  } catch (error) {
    console.error('Erro ao determinar estação do ano:', error.message);
  }
  
  // Adaptações específicas por tipo de viajante
  const adaptacoesPorTipo = {
    "sozinho(a)": "Destinos seguros para viajantes solo, hostels bem avaliados, atividades para conhecer pessoas, bairros com boa vida noturna e transporte público eficiente",
    "em casal (viagem romântica)": "Cenários românticos, jantares especiais, passeios a dois, hotéis boutique, praias privativas, mirantes com vistas panorâmicas e vinícolas",
    "em família": "Atividades para todas as idades, opções kid-friendly, segurança, acomodações espaçosas, parques temáticos, atrações educativas e opções de transporte facilitado",
    "com amigos": "Vida noturna, atividades em grupo, opções de compartilhamento, diversão coletiva, esportes de aventura, festivais locais e culinária diversificada"
  };
  
  const mensagemOrcamento = infoViajante.orcamento !== 'flexível' ?
    `IMPORTANTE: Estou considerando um orçamento de aproximadamente ${infoViajante.orcamento} ${infoViajante.moeda} para voos.` : 
    'Orçamento flexível';

  return `# Recomendações de Destinos de Viagem Personalizadas

## Objetivo: Encontrar destinos que melhor se adequem ao perfil do viajante e suas preferências.

## Informações do Viajante
- Origem: ${infoViajante.cidadeOrigem}
- Período: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Viajando: ${infoViajante.companhia}
- Número de pessoas: ${infoViajante.pessoas}
- Interesses: ${infoViajante.preferencia}
- Estação durante a viagem: ${estacaoViagem}
- Preferência de destinos: ${getTipoDestinoText(infoViajante.tipoDestino)}
- Popularidade desejada: ${getFamaDestinoText(infoViajante.famaDestino)}
- ${mensagemOrcamento}

## CONSIDERAÇÕES IMPORTANTES
- **Relevância Climática:** Considere o clima ideal para a época (${estacaoViagem}) na escolha dos destinos.
- **Experiências Adaptadas:** ${adaptacoesPorTipo[infoViajante.companhia] || "Diversifique as experiências para atender diferentes perfis"}
- **Eventos Especiais:** Inclua eventos, festivais ou temporadas especiais que acontecem no período da viagem.
- **Destinos Diversos:** Sugira destinos em diferentes continentes e com diferentes características.

## Personalidade da Tripinha (Mascote)
A Tripinha é uma cachorrinha vira-lata caramelo que adora:
- Comentar os cheiros, sons e texturas únicas de cada destino
- Mencionar pontos turísticos específicos que conheceu
- Usar emoji 🐾 para dar personalidade às suas dicas
- Trazer observações que só um cachorro notaria

## Instruções para Destinos
1. **TopPick:** Escolha o destino que MELHOR combina com o perfil, época e orçamento do viajante
2. **Alternativas:** Forneça EXATAMENTE 4 destinos alternativos, geograficamente diversos
3. **Surpresa:** Recomende um destino menos óbvio mas igualmente adequado às preferências

## IMPORTANTE: Preços
- Forneça estimativas de preços REALISTAS para voos partindo de ${infoViajante.cidadeOrigem}
- NÃO ajuste artificialmente os preços para caber no orçamento
- Considere a sazonalidade dos destinos ao estimar preços

## Formato do JSON
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino (1-2 frases)",
    "porque": "Razão específica para visitar este destino",
    "destaque": "Uma experiência/atividade única neste destino",
    "comentario": "Comentário entusiasmado da Tripinha mencionando um ponto turístico específico",
    "pontosTuristicos": ["Nome do Primeiro Ponto", "Nome do Segundo Ponto"],
    "eventos": ["Festival ou evento especial", "Outro evento relevante"],
    "clima": {
      "temperatura": "Faixa de temperatura esperada (ex: 15°C-25°C)",
      "condicoes": "Descrição das condições típicas",
      "recomendacoes": "Dicas relacionadas ao clima"
    },
    "experiencias": ["solo", "romantico", "familia", "grupo"],
    "popularidade": "alta|media|baixa",
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
    {
      "destino": "Nome da Cidade",
      "pais": "Nome do País",
      "codigoPais": "XX",
      "porque": "Razão específica para visitar",
      "pontoTuristico": "Nome de um Ponto Turístico",
      "experiencias": ["solo", "romantico", "familia", "grupo"],
      "popularidade": "alta|media|baixa",
      "clima": {
        "temperatura": "Faixa de temperatura esperada"
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
    ...3 destinos adicionais...
  ],
  "surpresa": {
    // Mesmo formato do topPick
  },
  "estacaoViagem": "${estacaoViagem}"
}`;
}

// =======================
// Função para buscar preços reais (sem ajuste artificial)
// =======================
async function buscarPrecoVoo(origemIATA, destinoIATA, datas, moeda) {
  if (!origemIATA || !destinoIATA || !datas) {
    utils.log(`Parâmetros incompletos para busca de voo:`, { origem: origemIATA, destino: destinoIATA });
    return null;
  }

  try {
    // Implementação para obter preços reais de APIs externas
    // Aqui você pode ar com Aviasales, Skyscanner ou qualquer outra API
    utils.log(`Buscando informações de voo de ${origemIATA} para ${destinoIATA}...`, null);
    
    // Por enquanto, retornamos null para indicar que não temos preços reais
    // e vamos manter os preços estimados pela IA
    return null;
  } catch (erro) {
    console.error(`Erro ao buscar preços de voo: ${erro.message}`);
    return null;
  }
}

// =======================
// Funções auxiliares
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
    'Espanha': 'MAD', 'Portugal': 'LIS', 'Japão': 'HND',
    'China': 'PEK', 'Austrália': 'SYD', 'Alemanha': 'FRA'
  };
  
  if (mapeamentoPais[pais]) return mapeamentoPais[pais];
  
  return cidade?.length >= 3 ? cidade.substring(0, 3).toUpperCase() : "AAA";
}
// =======================
// Dados de emergência (mantendo estimativas reais)
// =======================
function generateEmergencyData(dadosUsuario = {}) {
  const orcamento = dadosUsuario.orcamento_valor ? parseFloat(dadosUsuario.orcamento_valor) : 3000;
  const cidadeOrigem = dadosUsuario.cidade_partida?.name || '';
  const regiao = cidadeOrigem.toLowerCase().includes('brasil') ? 'americas' : 'global';
  
  // Mapa de destinos de emergência por região com preços mais realistas
  const destinosEmergencia = {
    'americas': {
      topPick: {
        destino: "Cartagena",
        pais: "Colômbia",
        codigoPais: "CO",
        descricao: "Cidade histórica colonial à beira-mar com arquitetura colorida.",
        porque: "Rica história colonial, praias caribenhas e vida noturna vibrante.",
        destaque: "Explorar a cidade amuralhada ao pôr do sol",
        comentario: "Cartagena me conquistou! A Cidade Amuralhada tem tantos cheiros diferentes que eu não sabia onde focar meu focinho! As Ilhas do Rosário são maravilhosas! 🐾",
        pontosTuristicos: ["Cidade Amuralhada", "Ilhas do Rosário"],
        eventos: ["Festival Internacional de Cinema de Cartagena", "Festival de Música do Caribe"],
        experiencias: ["solo", "romantico", "familia", "grupo"],
        popularidade: "alta",
        clima: {
          temperatura: "28°C-32°C",
          condicoes: "Clima tropical, quente e úmido com sol constante",
          recomendacoes: "Roupas leves, protetor solar e chapéu"
        },
        aeroporto: { codigo: "CTG", nome: "Aeroporto Internacional Rafael Núñez" },
        preco: { voo: 1950, hotel: 220 }
      },
      alternativas: [
        {
          destino: "Medellín",
          pais: "Colômbia",
          codigoPais: "CO",
          porque: "Cidade moderna com clima primaveril o ano todo",
          pontoTuristico: "Comuna 13",
          experiencias: ["solo", "grupo"],
          popularidade: "media",
          clima: { temperatura: "20°C-25°C" },
          aeroporto: { codigo: "MDE", nome: "Aeroporto Internacional José María Córdova" },
          preco: { voo: 1850, hotel: 180 }
        },
        {
          destino: "Santiago",
          pais: "Chile",
          codigoPais: "CL",
          porque: "Cidade moderna cercada por montanhas",
          pontoTuristico: "Cerro San Cristóbal",
          experiencias: ["solo", "familia"],
          popularidade: "alta",
          clima: { temperatura: "15°C-25°C" },
          aeroporto: { codigo: "SCL", nome: "Aeroporto Internacional Arturo Merino Benítez" },
          preco: { voo: 2100, hotel: 220 }
        },
        {
          destino: "Cidade do Panamá",
          pais: "Panamá",
          codigoPais: "PA",
          porque: "Mistura de moderno e histórico com o Canal do Panamá",
          pontoTuristico: "Canal do Panamá",
          experiencias: ["solo", "familia"],
          popularidade: "media",
          clima: { temperatura: "26°C-30°C" },
          aeroporto: { codigo: "PTY", nome: "Aeroporto Internacional de Tocumen" },
          preco: { voo: 1750, hotel: 180 }
        },
        {
          destino: "San José",
          pais: "Costa Rica",
          codigoPais: "CR",
          porque: "Portal para as aventuras de ecoturismo",
          pontoTuristico: "Vulcão Poás",
          experiencias: ["romantico", "familia"],
          popularidade: "media",
          clima: { temperatura: "22°C-27°C" },
          aeroporto: { codigo: "SJO", nome: "Aeroporto Internacional Juan Santamaría" },
          preco: { voo: 2200, hotel: 210 }
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
        experiencias: ["solo", "familia"],
        popularidade: "baixa",
        clima: {
          temperatura: "15°C-22°C",
          condicoes: "Temperado com brisa marítima",
          recomendacoes: "Casaco leve para as noites"
        },
        aeroporto: { codigo: "MVD", nome: "Aeroporto Internacional de Carrasco" },
        preco: { voo: 1650, hotel: 180 }
      }
    },
    'global': {
      // Conteúdo similar para região global
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
        experiencias: ["solo", "romantico", "familia", "grupo"],
        popularidade: "alta",
        clima: {
          temperatura: "16°C-26°C",
          condicoes: "Clima mediterrâneo com muitos dias ensolarados",
          recomendacoes: "Roupas leves e um casaco fino para as noites"
        },
        aeroporto: { codigo: "LIS", nome: "Aeroporto Humberto Delgado" },
        preco: { voo: 3800, hotel: 250 }
      },
      alternativas: [
        {
          destino: "Budapeste",
          pais: "Hungria", 
          codigoPais: "HU",
          porque: "Deslumbrante arquitetura e banhos termais",
          pontoTuristico: "Parlamento Húngaro",
          experiencias: ["romantico", "solo"],
          popularidade: "media",
          clima: { temperatura: "15°C-25°C" },
          aeroporto: { codigo: "BUD", nome: "Aeroporto de Budapeste-Ferenc Liszt" },
          preco: { voo: 4100, hotel: 180 }
        },
        {
          destino: "Cidade do México",
          pais: "México",
          codigoPais: "MX",
          porque: "Metrópole com rica história e gastronomia",
          pontoTuristico: "Teotihuacán",
          experiencias: ["familia", "grupo"],
          popularidade: "alta",
          clima: { temperatura: "18°C-25°C" },
          aeroporto: { codigo: "MEX", nome: "Aeroporto Internacional Benito Juárez" },
          preco: { voo: 3500, hotel: 200 }
        },
        {
          destino: "Bangkok",
          pais: "Tailândia",
          codigoPais: "TH",
          porque: "Cidade vibrante com templos deslumbrantes",
          pontoTuristico: "Grande Palácio",
          experiencias: ["solo", "grupo"],
          popularidade: "alta",
          clima: { temperatura: "28°C-34°C" },
          aeroporto: { codigo: "BKK", nome: "Aeroporto Suvarnabhumi" },
          preco: { voo: 5200, hotel: 150 }
        },
        {
          destino: "Porto",
          pais: "Portugal",
          codigoPais: "PT",
          porque: "Cidade histórica à beira do Rio Douro",
          pontoTuristico: "Vale do Douro",
          experiencias: ["romantico", "solo"],
          popularidade: "media",
          clima: { temperatura: "15°C-25°C" },
          aeroporto: { codigo: "OPO", nome: "Aeroporto Francisco Sá Carneiro" },
          preco: { voo: 3700, hotel: 180 }
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
        experiencias: ["solo", "romantico"],
        popularidade: "baixa",
        clima: {
          temperatura: "12°C-22°C",
          condicoes: "Clima continental com quatro estações bem definidas",
          recomendacoes: "Roupas em camadas para adaptar às mudanças de temperatura"
        },
        aeroporto: { codigo: "LJU", nome: "Aeroporto Jože Pučnik" },
        preco: { voo: 4300, hotel: 170 }
      }
    }
  };
  
  // Avaliar se os preços estão compatíveis com o orçamento (apenas para informação)
  try {
    const destinos = [
      destinosEmergencia[regiao].topPick,
      ...destinosEmergencia[regiao].alternativas,
      destinosEmergencia[regiao].surpresa
    ];
    
    for (const destino of destinos) {
      if (destino.preco?.voo > orcamento) {
        destino.acima_orcamento = true;
      } else {
        destino.acima_orcamento = false;
      }
    }
  } catch (error) {
    console.error('Erro ao avaliar preços:', error.message);
  }
  
  return destinosEmergencia[regiao] || destinosEmergencia.global;
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
  }, 270000); // 270 segundos (menor que os 300s do Vercel)

  // Configuração de CORS e headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=60');

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
    
    // Gerar prompt aprimorado para maior relevância nas recomendações
    const prompt = gerarPromptAprimorado(requestData);
    
    try {
      // Enviar heartbeat para manter conexão
      if (!isResponseSent) {
        res.writeHead(202, {
          'Content-Type': 'application/json',
          'X-Processing': 'true'
        });
      }
      
      // Tentar obter recomendações via OpenRouter com múltiplos modelos
      const result = await retryAsync(async () => {
        return await tryWithMultipleModels(prompt, requestData);
      });
      
      if (result && result.data) {
        // Processar resposta para melhorar relevância (ordenar por pontuação)
        try {
          const recomendacoes = typeof result.data === 'string' ? 
            JSON.parse(result.data) : result.data;
          
          // Calcular pontuações de relevância
          if (recomendacoes.topPick) {
            recomendacoes.topPick.relevanciaScore = utils.calcularPontuacaoRelevancia(
              recomendacoes.topPick, 
              requestData
            );
          }
          
          if (Array.isArray(recomendacoes.alternativas)) {
            // Calcular e adicionar pontuação para cada alternativa
            recomendacoes.alternativas.forEach(alt => {
              alt.relevanciaScore = utils.calcularPontuacaoRelevancia(alt, requestData);
            });
            
            // Ordenar alternativas por relevância
            recomendacoes.alternativas.sort((a, b) => 
              (b.relevanciaScore || 0) - (a.relevanciaScore || 0)
            );
            
            // Limitar a 4 alternativas
            if (recomendacoes.alternativas.length > 4) {
              recomendacoes.alternativas = recomendacoes.alternativas.slice(0, 4);
            }
          }
          
          if (recomendacoes.surpresa) {
            recomendacoes.surpresa.relevanciaScore = utils.calcularPontuacaoRelevancia(
              recomendacoes.surpresa, 
              requestData
            );
          }
          
          // Adicionar orcamento máximo e modelo usado
          if (requestData.orcamento_valor) {
            recomendacoes.orcamentoMaximo = parseFloat(requestData.orcamento_valor);
          }
          recomendacoes.modeloUsado = result.model;
          
          if (!isResponseSent) {
            isResponseSent = true;
            clearTimeout(serverTimeout);
            return res.status(200).json({
              tipo: "openrouter",
              modelo: result.model,
              conteudo: JSON.stringify(recomendacoes)
            });
          }
          return;
        } catch (processError) {
          console.error('Erro ao processar recomendações:', processError.message);
        }
        
        // Fallback: retornar resposta sem processamento
        if (!isResponseSent) {
          isResponseSent = true;
          clearTimeout(serverTimeout);
          return res.status(200).json({
            tipo: "openrouter-raw",
            modelo: result.model,
            conteudo: result.data
          });
        }
        return;
      }
      
      // Se todas as chamadas falharem, usar dados de emergência
      console.log('Falha na obtenção de recomendações, usando dados de emergência');
      const emergencyData = generateEmergencyData(requestData);
      
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(200).json({
          tipo: "emergencia",
          conteudo: JSON.stringify(emergencyData)
        });
      }
      
    } catch (aiError) {
      console.error('Erro na chamada à IA:', aiError.message);
    }
    
    // Resposta de emergência final
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(200).json({
        tipo: "emergencia-fallback",
        conteudo: JSON.stringify(generateEmergencyData(requestData))
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
