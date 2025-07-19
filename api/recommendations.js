// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
// Versão 3.0 - Corrigida com diagnóstico, validação flexível e sistema anti-repetição
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
// Sistema de Cache Inteligente Anti-Repetição
// =======================
const RECOMMENDATION_CACHE = {
  // Armazenar histórico de recomendações por usuário
  userHistory: new Map(),
  
  // TTL do cache: 1 hora
  TTL: 60 * 60 * 1000,
  
  // Gerar chave única baseada nas preferências do usuário
  generateUserKey(userData) {
    const key = [
      userData.companhia || 0,
      userData.preferencia_viagem || 0,
      userData.tipo_destino || 0,
      userData.fama_destino || 0,
      userData.cidade_partida?.name || 'unknown',
      userData.orcamento_valor || 'flexible'
    ].join('_');
    
    return Buffer.from(key).toString('base64').substring(0, 16);
  },
  
  // Verificar se já recomendamos recentemente
  hasRecentRecommendation(userData, destinoName) {
    const userKey = this.generateUserKey(userData);
    const history = this.userHistory.get(userKey);
    
    if (!history) return false;
    
    // Limpar entradas expiradas
    const now = Date.now();
    history.recommendations = history.recommendations.filter(
      rec => (now - rec.timestamp) < this.TTL
    );
    
    // Verificar se o destino foi recomendado recentemente
    return history.recommendations.some(rec => 
      rec.topPick === destinoName || 
      rec.destinations.includes(destinoName)
    );
  },
  
  // Adicionar recomendação ao histórico
  addRecommendation(userData, recommendations) {
    const userKey = this.generateUserKey(userData);
    const now = Date.now();
    
    if (!this.userHistory.has(userKey)) {
      this.userHistory.set(userKey, { recommendations: [] });
    }
    
    const history = this.userHistory.get(userKey);
    
    // Extrair nomes dos destinos
    const destinations = [
      recommendations.topPick?.destino,
      recommendations.surpresa?.destino,
      ...(recommendations.alternativas?.map(alt => alt.destino) || [])
    ].filter(Boolean);
    
    history.recommendations.push({
      timestamp: now,
      topPick: recommendations.topPick?.destino,
      destinations: destinations
    });
    
    console.log(`💾 Cache: Adicionada recomendação para usuário ${userKey}`);
    console.log(`📍 Destinos: ${destinations.join(', ')}`);
  },
  
  // Verificar se dados de emergência devem ser variados
  shouldVaryEmergencyData(userData) {
    const userKey = this.generateUserKey(userData);
    const history = this.userHistory.get(userKey);
    
    if (!history) return false;
    
    // Se temos mais de 2 recomendações nas últimas 2 horas, variar
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    const recentCount = history.recommendations.filter(
      rec => rec.timestamp > twoHoursAgo
    ).length;
    
    return recentCount >= 2;
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
  
  // VALIDAÇÃO FLEXÍVEL COM AUTO-CORREÇÃO - VERSÃO CORRIGIDA
  isValidDestinationJSON: (jsonString, requestData) => {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      
      // VALIDAÇÕES ESSENCIAIS (não opcionais)
      if (!data.topPick?.destino) {
        console.log('❌ Validação falhou: topPick.destino ausente');
        return false;
      }
      
      if (!data.surpresa?.destino) {
        console.log('❌ Validação falhou: surpresa.destino ausente');
        return false;
      }
      
      if (!Array.isArray(data.alternativas) || data.alternativas.length === 0) {
        console.log('❌ Validação falhou: alternativas inválidas ou vazias');
        return false;
      }
      
      // VALIDAÇÕES FLEXÍVEIS (com auto-correção)
      
      // 1. Pontos turísticos - aceitar pelo menos 1, não exigir 2
      if (!data.topPick.pontosTuristicos || data.topPick.pontosTuristicos.length === 0) {
        console.log('⚠️ Auto-correção: adicionando pontos turísticos para topPick');
        data.topPick.pontosTuristicos = ['Centro histórico', 'Principais atrações'];
      }
      
      if (!data.surpresa.pontosTuristicos || data.surpresa.pontosTuristicos.length === 0) {
        console.log('⚠️ Auto-correção: adicionando pontos turísticos para surpresa');
        data.surpresa.pontosTuristicos = ['Locais únicos', 'Atrações especiais'];
      }
      
      // 2. Alternativas - garantir que todas tenham pontoTuristico
      data.alternativas.forEach((alt, index) => {
        if (!alt.pontoTuristico && !alt.pontosTuristicos) {
          console.log(`⚠️ Auto-correção: adicionando ponto turístico para alternativa ${index}`);
          alt.pontoTuristico = 'Principais atrações';
        }
      });
      
      // 3. Códigos IATA - adicionar se ausentes
      if (!data.topPick.aeroporto?.codigo) {
        console.log('⚠️ Auto-correção: adicionando código IATA para topPick');
        data.topPick.aeroporto = {
          codigo: obterCodigoIATAPadrao(data.topPick.destino, data.topPick.pais),
          nome: `Aeroporto de ${data.topPick.destino}`
        };
      }
      
      if (!data.surpresa.aeroporto?.codigo) {
        console.log('⚠️ Auto-correção: adicionando código IATA para surpresa');
        data.surpresa.aeroporto = {
          codigo: obterCodigoIATAPadrao(data.surpresa.destino, data.surpresa.pais),
          nome: `Aeroporto de ${data.surpresa.destino}`
        };
      }
      
      // 4. Validação de orçamento - mais flexível
      if (requestData?.orcamento_valor && !isNaN(parseFloat(requestData.orcamento_valor))) {
        const orcamentoMax = parseFloat(requestData.orcamento_valor);
        
        // Permitir até 20% acima do orçamento em vez de rejeitar
        if (data.topPick.preco?.voo > orcamentoMax * 1.2) {
          console.log('⚠️ Auto-correção: ajustando preço do topPick para orçamento');
          data.topPick.preco.voo = Math.round(orcamentoMax * 0.9);
        }
      }
      
      // 5. Evitar destinos duplicados (só avisar, não rejeitar)
      if (data.topPick.destino?.toLowerCase() === data.alternativas[0]?.destino?.toLowerCase()) {
        console.log('⚠️ Aviso: topPick e primeira alternativa são iguais, mas permitindo');
      }
      
      console.log('✅ Validação passou com possíveis auto-correções');
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
// Processamento de destinos
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
   - Eventos especiais/festivais no período
   - Adaptação para viajantes ${infoViajante.companhia}
   - Destinos que fiquem entre 80% e 120% orçamento estipulado para voos de ${infoViajante.orcamento} ${infoViajante.moeda}

2) Para cada destino, determine:
   - Preço realista de voo
   - Pontos turísticos específicos e conhecidos
   - Eventos sazonais ou especiais no período da viagem
   - Comentário personalizado em 1ª pessoa da Tripinha mencionando detalhes sensoriais
   - Informações práticas de clima para o período

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
- ✓ Todos os comentários da Tripinha são em 1a pessoa e simulam como foi a experiência dela nesse local
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
      temperature: 0.5,
      max_tokens: 3000
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
    
    const destinosReserva = ["Lisboa", "Barcelona", "Roma", "Praga"];
    const paisesReserva = ["Portugal", "Espanha", "Itália", "República Tcheca"];
    const codigosPaisesReserva = ["PT", "ES", "IT", "CZ"];
    const codigosIATAReserva = ["LIS", "BCN", "FCO", "PRG"];
    
    while (data.alternativas.length < 4) {
      const index = data.alternativas.length % destinosReserva.length;
      const destino = destinosReserva[index];
      const pontosConhecidos = pontosPopulares[destino] || ["Atrações turísticas"];
      
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

// =======================
// Dados de emergência diversificados
// =======================
function generateEmergencyData(dadosUsuario = {}) {
  const orcamento = dadosUsuario.orcamento_valor ? parseFloat(dadosUsuario.orcamento_valor) : 3000;
  const cidadeOrigem = dadosUsuario.cidade_partida?.name || '';
  const regiao = cidadeOrigem.toLowerCase().includes('brasil') ? 'americas' : 'global';
  
  // MÚLTIPLOS CONJUNTOS DE DADOS PARA EVITAR REPETIÇÃO
  const conjuntosEmergencia = {
    americas: [
      // Conjunto 1: Destinos Sul-Americanos
      {
        topPick: {
          destino: "Medellín", pais: "Colômbia", codigoPais: "CO",
          descricao: "Cidade da eterna primavera com inovação urbana.",
          porque: "Clima perfeito, transformação urbana inspiradora e cultura vibrante.",
          destaque: "Teleféricos urbanos e arte de rua na Comuna 13",
          comentario: "Medellín me conquistou! Os teleféricos têm vistas incríveis e a Comuna 13 é pura arte! 🐾",
          pontosTuristicos: ["Comuna 13", "Parque Arví"],
          clima: { temperatura: "22°C-28°C", condicoes: "Clima primaveril constante" },
          aeroporto: { codigo: "MDE", nome: "Aeroporto José María Córdova" },
          preco: { voo: Math.round(orcamento * 0.8), hotel: 200 }
        },
        alternativas: [
          { destino: "Cartagena", pais: "Colômbia", codigoPais: "CO", pontoTuristico: "Cidade Amuralhada", aeroporto: { codigo: "CTG" }, preco: { voo: Math.round(orcamento * 0.75) } },
          { destino: "San José", pais: "Costa Rica", codigoPais: "CR", pontoTuristico: "Vulcão Poás", aeroporto: { codigo: "SJO" }, preco: { voo: Math.round(orcamento * 0.85) } },
          { destino: "Santiago", pais: "Chile", codigoPais: "CL", pontoTuristico: "Cerro San Cristóbal", aeroporto: { codigo: "SCL" }, preco: { voo: Math.round(orcamento * 0.7) } },
          { destino: "Montevidéu", pais: "Uruguai", codigoPais: "UY", pontoTuristico: "Rambla", aeroporto: { codigo: "MVD" }, preco: { voo: Math.round(orcamento * 0.65) } }
        ],
        surpresa: {
          destino: "Valparaíso", pais: "Chile", codigoPais: "CL",
          descricao: "Porto histórico com arte urbana vibrante.",
          porque: "Cidade patrimônio da humanidade com cultura única.",
          destaque: "Murais coloridos e teleféricos históricos",
          comentario: "Valparaíso é mágico! As ruas cheias de arte e os cheiros do mar me fascinaram! 🐾",
          pontosTuristicos: ["Cerros Coloridos", "Porto Histórico"],
          clima: { temperatura: "15°C-22°C", condicoes: "Clima mediterrâneo" },
          aeroporto: { codigo: "SCL", nome: "Aeroporto de Santiago (conexão)" },
          preco: { voo: Math.round(orcamento * 0.75), hotel: 180 }
        }
      },
      
      // Conjunto 2: Destinos Centro-Americanos/Caribe
      {
        topPick: {
          destino: "San José", pais: "Costa Rica", codigoPais: "CR",
          descricao: "Portal para aventuras na natureza.",
          porque: "Rica biodiversidade, ecoturismo e estabilidade política.",
          destaque: "Vulcões ativos e florestas tropicais",
          comentario: "Costa Rica é um paraíso! Os cheiros da floresta e os sons dos animais são incrível! 🐾",
          pontosTuristicos: ["Vulcão Arenal", "Parque Nacional Manuel Antonio"],
          clima: { temperatura: "20°C-30°C", condicoes: "Tropical com duas estações" },
          aeroporto: { codigo: "SJO", nome: "Aeroporto Juan Santamaría" },
          preco: { voo: Math.round(orcamento * 0.85), hotel: 250 }
        },
        alternativas: [
          { destino: "Panamá", pais: "Panamá", codigoPais: "PA", pontoTuristico: "Canal do Panamá", aeroporto: { codigo: "PTY" }, preco: { voo: Math.round(orcamento * 0.8) } },
          { destino: "Guadalajara", pais: "México", codigoPais: "MX", pontoTuristico: "Centro Histórico", aeroporto: { codigo: "GDL" }, preco: { voo: Math.round(orcamento * 0.7) } },
          { destino: "Havana", pais: "Cuba", codigoPais: "CU", pontoTuristico: "Habana Vieja", aeroporto: { codigo: "HAV" }, preco: { voo: Math.round(orcamento * 0.9) } },
          { destino: "Quito", pais: "Equador", codigoPais: "EC", pontoTuristico: "Centro Histórico", aeroporto: { codigo: "UIO" }, preco: { voo: Math.round(orcamento * 0.8) } }
        ],
        surpresa: {
          destino: "León", pais: "Nicarágua", codigoPais: "NI",
          descricao: "Cidade colonial com vulcões próximos.",
          porque: "Autenticidade, baixo custo e vulcões ativos.",
          destaque: "Volcano boarding no Cerro Negro",
          comentario: "León me surpreendeu! A arquitetura colonial e os vulcões criam paisagens únicas! 🐾",
          pontosTuristicos: ["Catedral de León", "Vulcão Cerro Negro"],
          clima: { temperatura: "25°C-32°C", condicoes: "Tropical seco" },
          aeroporto: { codigo: "MGA", nome: "Aeroporto de Manágua" },
          preco: { voo: Math.round(orcamento * 0.75), hotel: 150 }
        }
      }
    ],
    
    global: [
      // Conjunto 1: Europa Alternativa
      {
        topPick: {
          destino: "Porto", pais: "Portugal", codigoPais: "PT",
          descricao: "Cidade histórica à beira do Douro.",
          porque: "Patrimônio mundial, vinhos incríveis e custo acessível.",
          destaque: "Caves de vinho do Porto e azulejos históricos",
          comentario: "Porto é encantador! O cheiro das padarias e as vistas do rio me deixaram apaixonada! 🐾",
          pontosTuristicos: ["Ribeira do Porto", "Caves de Vila Nova de Gaia"],
          clima: { temperatura: "15°C-25°C", condicoes: "Mediterrâneo oceânico" },
          aeroporto: { codigo: "OPO", nome: "Aeroporto Francisco Sá Carneiro" },
          preco: { voo: Math.round(orcamento * 0.8), hotel: 180 }
        },
        alternativas: [
          { destino: "Praga", pais: "República Tcheca", codigoPais: "CZ", pontoTuristico: "Ponte Carlos", aeroporto: { codigo: "PRG" }, preco: { voo: Math.round(orcamento * 0.85) } },
          { destino: "Budapeste", pais: "Hungria", codigoPais: "HU", pontoTuristico: "Parlamento", aeroporto: { codigo: "BUD" }, preco: { voo: Math.round(orcamento * 0.9) } },
          { destino: "Cracóvia", pais: "Polônia", codigoPais: "PL", pontoTuristico: "Centro Medieval", aeroporto: { codigo: "KRK" }, preco: { voo: Math.round(orcamento * 0.85) } },
          { destino: "Braga", pais: "Portugal", codigoPais: "PT", pontoTuristico: "Bom Jesus", aeroporto: { codigo: "OPO" }, preco: { voo: Math.round(orcamento * 0.75) } }
        ],
        surpresa: {
          destino: "Tallinn", pais: "Estônia", codigoPais: "EE",
          descricao: "Capital medieval digital.",
          porque: "Cidade medieval preservada em país ultra-moderno.",
          destaque: "Centro histórico digital e cultura báltica",
          comentario: "Tallinn é fascinante! A mistura do antigo com o digital é única, e os bosques próximos são mágicos! 🐾",
          pontosTuristicos: ["Cidade Velha de Tallinn", "Parque Kadriorg"],
          clima: { temperatura: "10°C-20°C", condicoes: "Continental temperado" },
          aeroporto: { codigo: "TLL", nome: "Aeroporto de Tallinn" },
          preco: { voo: Math.round(orcamento * 0.9), hotel: 160 }
        }
      },
      
      // Conjunto 2: Ásia Acessível
      {
        topPick: {
          destino: "Bangkok", pais: "Tailândia", codigoPais: "TH",
          descricao: "Metrópole vibrante com templos dourados.",
          porque: "Cultura rica, comida incrível e ótimo custo-benefício.",
          destaque: "Templos budistas e mercados flutuantes",
          comentario: "Bangkok é sensorial! Os aromas das comidas de rua e os sons dos templos são inesquecíveis! 🐾",
          pontosTuristicos: ["Grande Palácio", "Wat Pho"],
          clima: { temperatura: "28°C-35°C", condicoes: "Tropical quente e úmido" },
          aeroporto: { codigo: "BKK", nome: "Aeroporto Suvarnabhumi" },
          preco: { voo: Math.round(orcamento * 0.85), hotel: 120 }
        },
        alternativas: [
          { destino: "Kuala Lumpur", pais: "Malásia", codigoPais: "MY", pontoTuristico: "Torres Petronas", aeroporto: { codigo: "KUL" }, preco: { voo: Math.round(orcamento * 0.8) } },
          { destino: "Ho Chi Minh", pais: "Vietnã", codigoPais: "VN", pontoTuristico: "Palácio da Reunificação", aeroporto: { codigo: "SGN" }, preco: { voo: Math.round(orcamento * 0.9) } },
          { destino: "Manila", pais: "Filipinas", codigoPais: "PH", pontoTuristico: "Intramuros", aeroporto: { codigo: "MNL" }, preco: { voo: Math.round(orcamento * 0.85) } },
          { destino: "Jacarta", pais: "Indonésia", codigoPais: "ID", pontoTuristico: "Kota Tua", aeroporto: { codigo: "CGK" }, preco: { voo: Math.round(orcamento * 0.8) } }
        ],
        surpresa: {
          destino: "Luang Prabang", pais: "Laos", codigoPais: "LA",
          descricao: "Cidade patrimônio da UNESCO no Mekong.",
          porque: "Espiritualidade budista e natureza preservada.",
          destaque: "Cachoeiras Kuang Si e cerimônia das esmolas",
          comentario: "Luang Prabang é mágico! A tranquilidade dos templos e o som das cachoeiras são únicos! 🐾",
          pontosTuristicos: ["Cachoeiras Kuang Si", "Monte Phousi"],
          clima: { temperatura: "22°C-32°C", condicoes: "Tropical de monção" },
          aeroporto: { codigo: "LPQ", nome: "Aeroporto de Luang Prabang" },
          preco: { voo: Math.round(orcamento * 0.9), hotel: 100 }
        }
      }
    ]
  };
  
  // SELEÇÃO PSEUDO-ALEATÓRIA BASEADA EM DADOS DO USUÁRIO
  const conjuntos = conjuntosEmergencia[regiao] || conjuntosEmergencia.global;
  
  // Usar preferências do usuário para escolher conjunto mais apropriado
  let indiceConjunto = 0;
  if (dadosUsuario.preferencia_viagem !== undefined) {
    indiceConjunto = parseInt(dadosUsuario.preferencia_viagem) % conjuntos.length;
  } else {
    // Usar timestamp para aleatoriedade
    indiceConjunto = Math.floor(Date.now() / 1000) % conjuntos.length;
  }
  
  const conjuntoSelecionado = conjuntos[indiceConjunto];
  
  console.log(`🎲 Selecionado conjunto de emergência ${indiceConjunto + 1}/${conjuntos.length} para região ${regiao}`);
  console.log(`📍 TopPick de emergência: ${conjuntoSelecionado.topPick.destino}`);
  
  return conjuntoSelecionado;
}

// FUNÇÃO MELHORADA PARA GERAR DADOS DE EMERGÊNCIA VARIADOS
function generateEmergencyDataWithVariation(dadosUsuario = {}) {
  const baseData = generateEmergencyData(dadosUsuario);
  
  // Se devemos variar, aplicar transformações
  if (RECOMMENDATION_CACHE.shouldVaryEmergencyData(dadosUsuario)) {
    console.log('🔄 Cache: Aplicando variação aos dados de emergência');
    
    // Embaralhar alternativas
    if (baseData.alternativas && baseData.alternativas.length > 1) {
      baseData.alternativas = utils.embaralharArray(baseData.alternativas);
    }
    
    // Trocar topPick com primeira alternativa ocasionalmente
    if (Math.random() > 0.5 && baseData.alternativas && baseData.alternativas.length > 0) {
      const tempTopPick = { ...baseData.topPick };
      const newTopPick = { ...baseData.alternativas[0] };
      
      // Converter alternativa para formato topPick
      newTopPick.descricao = newTopPick.porque || 'Destino incrível para sua viagem';
      newTopPick.destaque = `Experiência única em ${newTopPick.destino}`;
      newTopPick.comentario = `${newTopPick.destino} é maravilhoso! Adorei explorar ${newTopPick.pontoTuristico} e sentir todos os cheiros locais! 🐾`;
      newTopPick.pontosTuristicos = [newTopPick.pontoTuristico, 'Outras atrações locais'];
      
      baseData.topPick = newTopPick;
      baseData.alternativas[0] = {
        destino: tempTopPick.destino,
        pais: tempTopPick.pais,
        codigoPais: tempTopPick.codigoPais,
        porque: tempTopPick.porque,
        pontoTuristico: tempTopPick.pontosTuristicos?.[0] || 'Atrações principais',
        aeroporto: tempTopPick.aeroporto,
        preco: tempTopPick.preco
      };
      
      console.log(`🔄 Cache: TopPick alterado para ${newTopPick.destino}`);
    }
  }
  
  return baseData;
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
    "comentario": "Comentário entusiasmado da Tripinha em 1ª pessoa, falando sobre como foi sua experiência no local",
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
    "comentario": "Comentário entusiasmado da Tripinha em 1ª pessoa, comentando como foi sua experiencia no local",
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
// Função principal - Handler da API com DIAGNÓSTICO DETALHADO
// =======================
module.exports = async function handler(req, res) {
  let isResponseSent = false;
  const serverTimeout = setTimeout(() => {
    if (!isResponseSent) {
      isResponseSent = true;
      console.log('Timeout do servidor atingido, enviando resposta de emergência');
      const emergencyData = generateEmergencyDataWithVariation(req.body);
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
    
    // ============= DIAGNÓSTICO DETALHADO =============
    console.log('🔍 DIAGNÓSTICO DETALHADO:');
    console.log('📄 Dados da requisição:', JSON.stringify(requestData, null, 2));
    
    const providers = CONFIG.providerOrder.filter(
      provider => process.env[`${provider.toUpperCase()}_API_KEY`]
    );
    console.log('🔑 Provedores disponíveis:', providers);
    
    let tentativasDetalhadas = [];
    const prompt = gerarPromptParaDestinos(requestData);
    const orcamento = requestData.orcamento_valor ? parseFloat(requestData.orcamento_valor) : null;
    
    for (const provider of providers) {
      try {
        console.log(`🤖 TENTANDO ${provider.toUpperCase()}...`);
        const responseAI = await callAIAPI(provider, prompt, requestData);
        
        // LOG DA RESPOSTA BRUTA
        console.log(`📥 Resposta bruta ${provider}:`, responseAI ? responseAI.substring(0, 500) + '...' : 'NULA');
        
        let processedResponse = responseAI;
        if (responseAI && utils.isPartiallyValidJSON(responseAI)) {
          console.log(`✅ ${provider}: JSON parcialmente válido`);
          processedResponse = ensureTouristAttractionsAndComments(responseAI, requestData);
          console.log(`🔧 ${provider}: Resposta processada`);
        } else {
          console.log(`❌ ${provider}: JSON inválido ou nulo`);
        }
        
        // TESTE DE VALIDAÇÃO DETALHADO
        if (processedResponse) {
          const isValid = utils.isValidDestinationJSON(processedResponse, requestData);
          console.log(`🎯 ${provider}: Validação final = ${isValid}`);
          
          if (!isValid) {
            // LOG DETALHADO DO PORQUÊ FALHOU
            try {
              const data = typeof processedResponse === 'string' ? JSON.parse(processedResponse) : processedResponse;
              console.log(`❓ ${provider}: Estrutura da resposta:`, {
                hasTopPick: !!data.topPick,
                hasTopPickDestino: !!data.topPick?.destino,
                hasAlternativas: !!data.alternativas,
                alternativasLength: data.alternativas?.length,
                hasSurpresa: !!data.surpresa,
                hasSurpresaDestino: !!data.surpresa?.destino,
                topPickPontos: data.topPick?.pontosTuristicos?.length || 0,
                surpresaPontos: data.surpresa?.pontosTuristicos?.length || 0
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
          console.log(`🎉 ${provider}: SUCESSO! Usando recomendações da IA`);
          
          try {
            const recomendacoes = typeof processedResponse === 'string' ? 
              JSON.parse(processedResponse) : processedResponse;
            
            if (orcamento) {
              recomendacoes.orcamentoMaximo = orcamento;
            }
            
            // ADICIONAR AO CACHE
            RECOMMENDATION_CACHE.addRecommendation(requestData, recomendacoes);
            
            const datas = obterDatasViagem(requestData);
            const recomendacoesProcessadas = await processarDestinos(recomendacoes, datas);
            
            if (!isResponseSent) {
              isResponseSent = true;
              clearTimeout(serverTimeout);
              return res.status(200).json({
                tipo: `${provider}_cached`,
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
        console.error(`💥 Erro ${provider}:`, error.message);
        tentativasDetalhadas.push({
          provider,
          success: false,
          error: error.message
        });
      }
    }
    
    // Se chegou aqui, todos os provedores falharam
    console.log('🚨 TODOS OS PROVEDORES FALHARAM!');
    console.log('📊 Resumo das tentativas:', tentativasDetalhadas);
    console.log('🔄 Usando dados de emergência...');
    
    console.log('Todos os provedores falharam, gerando resposta de emergência...');
    const emergencyData = generateEmergencyDataWithVariation(requestData);
    
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
        conteudo: JSON.stringify(generateEmergencyDataWithVariation(req.body)),
        error: globalError.message
      });
    }
  } finally {
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      res.status(200).json({
        tipo: "erro-finally",
        conteudo: JSON.stringify(generateEmergencyDataWithVariation(req.body)),
        message: "Erro interno no servidor"
      });
    }
  }
};
