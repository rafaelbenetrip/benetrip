// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
// Versão 6.0 - GROQ ONLY - Otimizado para llama-3.3-70b-versatile
const axios = require('axios');
const http = require('http');
const https = require('https');

// =======================
// Configurações Groq
// =======================
const CONFIG = {
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    models: {
      primary: 'llama-3.3-70b-versatile',      // Análise complexa
      fast: 'llama-3.1-8b-instant',            // Respostas rápidas
      toolUse: 'llama3-groq-70b-8192-tool-use-preview' // APIs
    },
    timeout: 120000,
    maxTokens: 4000,
    temperature: 0.7
  },
  retries: 3,
  logging: {
    enabled: true,
    maxLength: 500
  }
};

// =======================
// Cliente HTTP configurado
// =======================
const apiClient = axios.create({
  timeout: CONFIG.groq.timeout,
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

  extrairJSONDaResposta: texto => {
    try {
      if (typeof texto === 'object' && texto !== null) {
        return JSON.stringify(texto);
      }
      
      // Tentar parse direto primeiro
      try {
        return JSON.stringify(JSON.parse(texto));
      } catch {}
      
      // Limpar markdown e comentários
      const textoProcessado = texto
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\r\n/g, '\n')
        .trim();
        
      // Procurar JSON no texto
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
  
  isValidDestinationJSON: (jsonString, requestData) => {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      
      // Verificar estrutura mínima necessária
      const hasValidTopPick = data.topPick && data.topPick.destino && data.topPick.pais;
      const hasValidAlternatives = Array.isArray(data.alternativas) && 
                                   data.alternativas.length >= 2 &&
                                   data.alternativas.every(alt => alt.destino && alt.pais);
      
      if (!hasValidTopPick && !hasValidAlternatives) {
        console.log('❌ Validação falhou: nem topPick nem alternativas válidas');
        return false;
      }
      
      console.log('✅ Validação passou');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao validar JSON de destino:', error.message);
      return false;
    }
  }
};

// =======================
// Mapeamento de códigos IATA
// =======================
function obterCodigoIATAPadrao(cidade, pais) {
  const mapeamentoIATA = {
    // Principais destinos brasileiros
    'São Paulo': 'GRU', 'Rio de Janeiro': 'GIG', 'Brasília': 'BSB',
    'Salvador': 'SSA', 'Fortaleza': 'FOR', 'Recife': 'REC',
    'Porto Alegre': 'POA', 'Belém': 'BEL', 'Manaus': 'MAO',
    
    // América do Sul
    'Buenos Aires': 'EZE', 'Santiago': 'SCL', 'Lima': 'LIM',
    'Bogotá': 'BOG', 'Cartagena': 'CTG', 'Medellín': 'MDE',
    'Montevidéu': 'MVD', 'La Paz': 'LPB', 'Cusco': 'CUZ',
    
    // América do Norte
    'Nova York': 'JFK', 'Los Angeles': 'LAX', 'Miami': 'MIA',
    'Cidade do México': 'MEX', 'Cancún': 'CUN', 'Toronto': 'YYZ',
    'Vancouver': 'YVR', 'Montreal': 'YUL',
    
    // Europa
    'Londres': 'LHR', 'Paris': 'CDG', 'Roma': 'FCO',
    'Madri': 'MAD', 'Lisboa': 'LIS', 'Barcelona': 'BCN',
    'Amsterdã': 'AMS', 'Berlim': 'BER', 'Munique': 'MUC',
    'Porto': 'OPO', 'Praga': 'PRG', 'Viena': 'VIE',
    
    // Ásia & Oceania
    'Tóquio': 'HND', 'Dubai': 'DXB', 'Singapura': 'SIN',
    'Bangkok': 'BKK', 'Hong Kong': 'HKG', 'Sydney': 'SYD'
  };
  
  const nomeLower = cidade.toLowerCase();
  
  for (const [cidadeMap, codigo] of Object.entries(mapeamentoIATA)) {
    if (nomeLower.includes(cidadeMap.toLowerCase())) return codigo;
  }
  
  // Fallback: primeira letra do país + duas da cidade
  return (pais.charAt(0) + cidade.substring(0, 2)).toUpperCase();
}

// =======================
// Função para chamada ao Groq
// =======================
async function callGroqAPI(prompt, requestData, model = CONFIG.groq.models.primary) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('Chave da API Groq não configurada (GROQ_API_KEY)');
  }

  const systemMessage = model === CONFIG.groq.models.primary ?
    `Você é a Tripinha, uma vira-lata caramelo especialista em viagens do mundo todo! 🐾

Sua missão é criar recomendações de destinos PERSONALIZADAS e DETALHADAS baseadas no perfil do viajante.

CARACTERÍSTICAS DA TRIPINHA:
- Conhece todos os destinos do mundo pessoalmente
- Fala sempre em 1ª pessoa sobre suas experiências nos lugares
- É entusiasmada, carismática e usa emojis naturalmente
- Inclui detalhes sensoriais que um cachorro notaria (cheiros, sons, texturas)
- Sempre menciona pontos turísticos específicos que visitou
- Dá dicas práticas baseadas nas suas "aventuras"

OBRIGATÓRIO EM CADA DESTINO:
✅ Código IATA válido do aeroporto principal
✅ Informações climáticas COMPLETAS (estação, temperatura, condições, recomendações)
✅ Pontos turísticos específicos e conhecidos
✅ Preços realistas de voo compatíveis com o orçamento
✅ Comentários da Tripinha em 1ª pessoa sobre suas experiências

RETORNE APENAS JSON VÁLIDO sem formatação markdown.` :
    `Você é um especialista em viagens focado em recomendações rápidas e precisas. 
     Retorne apenas JSON válido com destinos que respeitem o orçamento do usuário.`;

  try {
    utils.log(`🚀 Enviando requisição para Groq (${model})...`);
    
    const requestPayload = {
      model: model,
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: CONFIG.groq.temperature,
      max_tokens: CONFIG.groq.maxTokens,
      stream: false
    };
    
    const response = await apiClient({
      method: 'post',
      url: `${CONFIG.groq.baseURL}/chat/completions`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: requestPayload
    });
    
    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Formato de resposta do Groq inválido');
    }
    
    const content = response.data.choices[0].message.content;
    utils.log('📥 Resposta recebida do Groq:', content.substring(0, 300));
    
    return utils.extrairJSONDaResposta(content);
    
  } catch (error) {
    console.error('❌ Erro na chamada à API Groq:', error.message);
    if (error.response) {
      utils.log('🔴 Resposta de erro do Groq:', error.response.data);
    }
    throw error;
  }
}

// =======================
// Geração de prompt otimizado para Groq
// =======================
function gerarPromptParaGroq(dados) {
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
      dataIda = partes[0]?.trim() || 'não especificada';
      dataVolta = partes[1]?.trim() || 'não especificada';
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
    "sozinho(a)": "Destinos seguros para viajantes solo, atividades para conhecer pessoas, transporte público eficiente",
    "em casal (viagem romântica)": "Cenários românticos, jantares especiais, hotéis boutique, praias privativas, mirantes com vistas panorâmicas",
    "em família": "Atividades kid-friendly, segurança, acomodações espaçosas, parques temáticos, atrações educativas",
    "com amigos": "Vida noturna, atividades em grupo, diversão coletiva, esportes de aventura, festivais locais"
  };

  return `# 🐾 MISSÃO TRIPINHA: Recomendações Personalizadas de Viagem

## 👤 PERFIL DO MEU HUMANO FAVORITO
- **Partindo de:** ${infoViajante.cidadeOrigem}
- **Viajando:** ${infoViajante.companhia} (${infoViajante.pessoas} pessoa(s))
- **Período:** ${dataIda} a ${dataVolta} (${duracaoViagem})
- **Paixões:** ${infoViajante.preferencia}
- **Orçamento para voos:** ${infoViajante.orcamento} ${infoViajante.moeda}
- **Tipo de destino:** ${getTipoDestinoText(infoViajante.tipoDestino)}
- **Popularidade:** ${getFamaDestinoText(infoViajante.famaDestino)}

## 🎯 ADAPTAÇÕES ESPECIAIS PARA: ${infoViajante.companhia.toUpperCase()}
${adaptacoesPorTipo[infoViajante.companhia] || "Experiências versáteis para diferentes perfis"}

## 🌍 MINHAS RECOMENDAÇÕES COMO TRIPINHA

### REGRAS DE OURO:
1. **Orçamento Sagrado:** Voos DEVEM ficar próximos de ${infoViajante.orcamento} ${infoViajante.moeda}
2. **Informações Climáticas:** Para CADA destino, inclua estação, temperatura, condições e dicas do que levar
3. **Pontos Turísticos:** Cite locais específicos que EU visitei pessoalmente
4. **Códigos IATA:** Aeroporto principal de cada destino (3 letras)
5. **Meus Comentários:** Sempre em 1ª pessoa, falando das MINHAS experiências nos lugares

### FORMATO DE RESPOSTA (JSON PURO):
\`\`\`json
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País", 
    "codigoPais": "XX",
    "descricao": "Descrição breve do destino",
    "porque": "Por que é perfeito para este viajante",
    "destaque": "Experiência única do destino",
    "comentario": "MEU comentário em 1ª pessoa sobre como foi incrível visitar este lugar! Mencione cheiros, sons ou texturas que notei 🐾",
    "pontosTuristicos": [
      "Nome do Primeiro Ponto Turístico Específico",
      "Nome do Segundo Ponto Turístico Específico"
    ],
    "eventos": ["Festival ou evento especial no período", "Outro evento se houver"],
    "clima": {
      "estacao": "Estação do ano no destino durante a viagem",
      "temperatura": "Faixa de temperatura (ex: 18°C-28°C)",
      "condicoes": "Condições típicas esperadas",
      "recomendacoes": "O que levar/vestir baseado no clima"
    },
    "aeroporto": {
      "codigo": "XYZ",
      "nome": "Nome do Aeroporto Principal"
    },
    "preco": {
      "voo": número_realista,
      "hotel": número_estimado
    }
  },
  "alternativas": [
    {
      "destino": "Nome da Cidade",
      "pais": "Nome do País",
      "codigoPais": "XX", 
      "porque": "Razão específica para visitar",
      "pontoTuristico": "Ponto turístico específico",
      "clima": {
        "estacao": "Estação no destino",
        "temperatura": "Faixa de temperatura"
      },
      "aeroporto": {
        "codigo": "XYZ",
        "nome": "Nome do Aeroporto"
      },
      "preco": {
        "voo": número,
        "hotel": número
      }
    }
    // EXATAMENTE 4 alternativas
  ],
  "surpresa": {
    "destino": "Nome da Cidade Inusitada",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Por que é uma surpresa especial",
    "porque": "Razão para ser destino surpresa",
    "destaque": "Experiência única e inesperada",
    "comentario": "MEU comentário empolgado em 1ª pessoa sobre este lugar surpreendente que visitei! 🐾",
    "pontosTuristicos": [
      "Primeiro Ponto Específico",
      "Segundo Ponto Específico"
    ],
    "clima": {
      "estacao": "Estação durante a viagem",
      "temperatura": "Faixa de temperatura",
      "condicoes": "Condições climáticas",
      "recomendacoes": "Dicas de vestuário"
    },
    "aeroporto": {
      "codigo": "XYZ", 
      "nome": "Nome do Aeroporto"
    },
    "preco": {
      "voo": número,
      "hotel": número
    }
  },
  "estacaoViagem": "Estação predominante nos destinos"
}
\`\`\`

## 🐕 LEMBRE-SE:
- Sou a Tripinha e já visitei TODOS esses lugares pessoalmente
- Meus comentários são baseados nas MINHAS aventuras caninas
- Sempre menciono o que mais me impressionou em cada lugar
- Uso emoji 🐾 para mostrar minha personalidade
- Dou dicas práticas baseadas na minha experiência de viagem

**AGORA ME AJUDE A FAZER MEU HUMANO FELIZ! LATIDOS E RECOMENDAÇÕES! 🐾**`;
}

// =======================
// Funções auxiliares de texto
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

// =======================
// Processamento e validação de destinos
// =======================
function ensureValidDestinationData(jsonString, requestData) {
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    let modificado = false;
    
    // Garantir códigos IATA para topPick
    if (data.topPick && !data.topPick.aeroporto?.codigo) {
      data.topPick.aeroporto = {
        codigo: obterCodigoIATAPadrao(data.topPick.destino, data.topPick.pais),
        nome: `Aeroporto de ${data.topPick.destino}`
      };
      modificado = true;
    }
    
    // Garantir códigos IATA para surpresa
    if (data.surpresa && !data.surpresa.aeroporto?.codigo) {
      data.surpresa.aeroporto = {
        codigo: obterCodigoIATAPadrao(data.surpresa.destino, data.surpresa.pais),
        nome: `Aeroporto de ${data.surpresa.destino}`
      };
      modificado = true;
    }
    
    // Garantir códigos IATA para alternativas
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
    console.error("Erro ao processar dados de destino:", error);
    return jsonString;
  }
}

// =======================
// Função de retry com backoff exponencial
// =======================
async function retryWithBackoff(fn, maxAttempts = CONFIG.retries, initialDelay = 1000) {
  let attempt = 1;
  let delay = initialDelay;
  
  while (attempt <= maxAttempts) {
    try {
      console.log(`🔄 Tentativa ${attempt}/${maxAttempts}...`);
      const result = await fn();
      if (result) {
        console.log(`✅ Sucesso na tentativa ${attempt}`);
        return result;
      }
    } catch (error) {
      console.error(`❌ Tentativa ${attempt} falhou:`, error.message);
    }
    
    if (attempt === maxAttempts) {
      console.log(`🚫 Todas as ${maxAttempts} tentativas falharam`);
      return null;
    }
    
    console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 10000); // Max 10s
    attempt++;
  }
  
  return null;
}

// =======================
// Handler principal da API
// =======================
module.exports = async function handler(req, res) {
  let isResponseSent = false;
  const serverTimeout = setTimeout(() => {
    if (!isResponseSent) {
      isResponseSent = true;
      console.log('⏰ Timeout do servidor atingido');
      return res.status(500).json({
        tipo: "erro",
        message: "Tempo limite excedido. Tente novamente.",
        error: "timeout"
      });
    }
  }, 290000); // 290s (Vercel limit is 300s)

  // Headers CORS
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
    console.log('🚀 === BENETRIP GROQ API v6.0 ===');
    
    if (!req.body) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(400).json({ error: "Nenhum dado fornecido na requisição" });
    }
    
    const requestData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // Verificar se a chave do Groq está configurada
    if (!process.env.GROQ_API_KEY) {
      console.error('❌ GROQ_API_KEY não configurada');
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(500).json({
          tipo: "erro",
          message: "Serviço temporariamente indisponível.",
          error: "groq_api_key_missing"
        });
      }
      return;
    }
    
    // Log dos dados recebidos
    utils.log('📊 Dados da requisição:', {
      companhia: requestData.companhia,
      cidade_partida: requestData.cidade_partida?.name,
      datas: requestData.datas,
      orcamento: requestData.orcamento_valor,
      moeda: requestData.moeda_escolhida
    });
    
    // Gerar prompt otimizado para Groq
    const prompt = gerarPromptParaGroq(requestData);
    console.log('📝 Prompt gerado para Groq');
    
    // Tentar obter recomendações com retry
    const recomendacoes = await retryWithBackoff(async () => {
      const response = await callGroqAPI(prompt, requestData, CONFIG.groq.models.primary);
      
      if (response && utils.isValidDestinationJSON(response, requestData)) {
        console.log('✅ Resposta válida recebida do Groq');
        return ensureValidDestinationData(response, requestData);
      }
      
      console.log('❌ Resposta inválida, tentando novamente...');
      return null;
    });
    
    if (!recomendacoes) {
      console.error('🚫 Falha em todas as tentativas com Groq');
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(503).json({
          tipo: "erro",
          message: "Não foi possível obter recomendações no momento. Tente novamente em alguns instantes.",
          error: "groq_all_attempts_failed"
        });
      }
      return;
    }
    
    // Processar e retornar resultado
    try {
      const dados = typeof recomendacoes === 'string' ? JSON.parse(recomendacoes) : recomendacoes;
      
      // Adicionar metadados
      dados.metadados = {
        modelo: CONFIG.groq.models.primary,
        provider: 'groq',
        versao: '6.0',
        timestamp: new Date().toISOString()
      };
      
      console.log('🎉 Recomendações processadas com sucesso!');
      console.log('📋 Destinos encontrados:', {
        topPick: dados.topPick?.destino,
        alternativas: dados.alternativas?.length || 0,
        surpresa: dados.surpresa?.destino
      });
      
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(200).json({
          tipo: "groq_success",
          conteudo: JSON.stringify(dados)
        });
      }
      
    } catch (processError) {
      console.error('❌ Erro ao processar resposta final:', processError.message);
      
      if (!isResponseSent) {
        isResponseSent = true;
        clearTimeout(serverTimeout);
        return res.status(200).json({
          tipo: "groq_partial_success",
          conteudo: recomendacoes
        });
      }
    }
    
  } catch (globalError) {
    console.error('💥 Erro global:', globalError.message);
    
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(serverTimeout);
      return res.status(500).json({
        tipo: "erro",
        message: "Erro interno do servidor. Tente novamente.",
        error: globalError.message
      });
    }
  } finally {
    clearTimeout(serverTimeout);
    if (!isResponseSent) {
      isResponseSent = true;
      res.status(500).json({
        tipo: "erro",
        message: "Erro inesperado. Tente novamente.",
        error: "unexpected_error"
      });
    }
  }
};
