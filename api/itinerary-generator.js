// api/itinerary-generator.js - VERSÃO CORRIGIDA COM TODAS AS PREFERÊNCIAS
const axios = require('axios');

// Chaves de API
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Modelo padrão a ser usado (DeepSeek Coder)
const DEFAULT_MODEL = 'deepseek-chat';

// Função auxiliar para logging estruturado
function logEvent(type, message, data = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    message,
    ...data
  };
  console.log(JSON.stringify(log));
}

/**
 * Gera um roteiro personalizado através da API Deepseek ou Claude
 */
module.exports = async (req, res) => {
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Responder a preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }
  
  try {
    // Obter parâmetros do corpo da requisição
    const {
      destino,
      pais,
      dataInicio,
      dataFim,
      horaChegada,
      horaSaida,
      tipoViagem,
      tipoCompanhia,
      intensidade,           // ✅ NOVO: Agora será usado
      orcamento,            // ✅ NOVO: Agora será usado
      preferencias,         // ✅ MELHORADO: Objeto completo
      modeloIA
    } = req.body;
    
    // Validar parâmetros obrigatórios
    if (!destino || !dataInicio) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: destino, dataInicio' });
    }
    
    // Calcular número de dias
    const diasViagem = calcularDiasViagem(dataInicio, dataFim);
    
    // ✅ NOVO: Extrair dados detalhados das preferências
    const dadosDetalhados = extrairDadosDetalhados(preferencias, tipoCompanhia);
    
    // Log dos parâmetros recebidos
    logEvent('info', 'Gerando roteiro personalizado com TODAS as preferências', {
      destino,
      pais,
      diasViagem,
      tipoViagem,
      tipoCompanhia,
      intensidade,
      orcamento,
      dadosDetalhados
    });
    
    // Gerar o prompt para a IA
    const prompt = gerarPromptRoteiroCompleto({
      destino,
      pais,
      dataInicio,
      dataFim,
      horaChegada,
      horaSaida,
      diasViagem,
      tipoViagem,
      tipoCompanhia,
      intensidade,        // ✅ NOVO
      orcamento,         // ✅ NOVO
      dadosDetalhados,   // ✅ NOVO
      preferencias
    });
    
    // Selecionar o modelo de IA a ser usado
    const modelo = modeloIA || DEFAULT_MODEL;
    
    // Gerar o roteiro usando a API correspondente
    let roteiro;
    
    if (modelo === 'claude') {
      roteiro = await gerarRoteiroComClaude(prompt);
    } else {
      roteiro = await gerarRoteiroComDeepseek(prompt);
    }
    
    // Verificar se o roteiro foi gerado com sucesso
    if (!roteiro) {
      throw new Error('Falha ao gerar roteiro');
    }
    
    // Retornar o roteiro gerado
    return res.status(200).json(roteiro);
    
  } catch (erro) {
    // Log do erro
    logEvent('error', 'Erro ao gerar roteiro', {
      message: erro.message,
      stack: erro.stack
    });
    
    // Retornar erro
    return res.status(500).json({
      error: 'Erro ao gerar roteiro personalizado',
      details: erro.message
    });
  }
};

/**
 * ✅ NOVA FUNÇÃO: Extrai dados detalhados das preferências
 */
function extrairDadosDetalhados(preferencias, tipoCompanhia) {
  const dados = {
    quantidadeTotal: 1,
    quantidadeAdultos: 1,
    quantidadeCriancas: 0,
    quantidadeBebes: 0,
    temCriancas: false,
    temBebes: false,
    grupoGrande: false
  };
  
  if (preferencias) {
    dados.quantidadeTotal = preferencias.quantidade || 1;
    dados.quantidadeAdultos = preferencias.quantidade_adultos || 1;
    dados.quantidadeCriancas = preferencias.quantidade_criancas || 0;
    dados.quantidadeBebes = preferencias.quantidade_bebes || 0;
    
    dados.temCriancas = dados.quantidadeCriancas > 0;
    dados.temBebes = dados.quantidadeBebes > 0;
    dados.grupoGrande = dados.quantidadeTotal >= 5;
  }
  
  return dados;
}

/**
 * Calcula o número de dias entre duas datas
 */
function calcularDiasViagem(dataInicio, dataFim) {
  if (!dataInicio) return 1;
  
  const inicio = new Date(dataInicio);
  
  if (!dataFim) return 1;
  
  const fim = new Date(dataFim);
  const diffTempo = Math.abs(fim - inicio);
  const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;
  
  return diffDias;
}

/**
 * ✅ FUNÇÃO COMPLETAMENTE REESCRITA: Gera prompt completo considerando TODAS as preferências
 */
function gerarPromptRoteiroCompleto(params) {
  const {
    destino,
    pais,
    dataInicio,
    dataFim,
    horaChegada,
    horaSaida,
    diasViagem,
    tipoViagem,
    tipoCompanhia,
    intensidade,
    orcamento,
    dadosDetalhados,
    preferencias
  } = params;
  
  // ✅ MAPEAR TODAS AS PREFERÊNCIAS DETALHADAMENTE
  
  // Intensidade do roteiro
  const configIntensidade = {
    'leve': {
      atividades: '2-3 atividades por período',
      ritmo: 'relaxado com bastante tempo livre',
      descanso: 'muitas pausas para descanso'
    },
    'moderado': {
      atividades: '3-4 atividades por período', 
      ritmo: 'equilibrado entre atividades e descanso',
      descanso: 'pausas regulares'
    },
    'intenso': {
      atividades: '4-6 atividades por período',
      ritmo: 'dinâmico com agenda cheia',
      descanso: 'poucas pausas, máximo aproveitamento'
    }
  };
  
  const infoIntensidade = configIntensidade[intensidade] || configIntensidade['moderado'];
  
  // Orçamento
  const configOrcamento = {
    'baixo': {
      descricao: 'econômico',
      atividades: 'atrações gratuitas, museus com entrada grátis, parques públicos, mercados locais',
      alimentacao: 'restaurantes locais simples, street food, mercados',
      transporte: 'transporte público, caminhadas'
    },
    'medio': {
      descricao: 'moderado',
      atividades: 'mix de atrações pagas e gratuitas, museus principais, tours',
      alimentacao: 'restaurantes tradicionais, algumas experiências gastronômicas',
      transporte: 'transporte público e eventual táxi/uber'
    },
    'alto': {
      descricao: 'premium',
      atividades: 'principais atrações, tours privados, experiências exclusivas',
      alimentacao: 'restaurantes renomados, experiências gastronômicas especiais',
      transporte: 'conforto e conveniência priorizados'
    }
  };
  
  const infoOrcamento = configOrcamento[orcamento] || configOrcamento['medio'];
  
  // Tipo de viagem
  const configTipoViagem = {
    'relaxar': 'relaxamento, bem-estar, spas, praias, parques tranquilos',
    'aventura': 'atividades outdoor, trilhas, esportes, adrenalina',
    'cultura': 'museus, história, arquitetura, arte, patrimônio cultural',
    'urbano': 'vida urbana, compras, gastronomia, vida noturna, modernidade'
  };
  
  const descricaoTipoViagem = configTipoViagem[tipoViagem] || 'cultura e experiências variadas';
  
  // Companhia de viagem
  const configCompanhia = {
    'sozinho': {
      descricao: 'uma pessoa viajando sozinha',
      consideracoes: 'atividades que podem ser feitas individualmente, lugares seguros, oportunidades de socialização'
    },
    'casal': {
      descricao: 'um casal em viagem romântica',
      consideracoes: 'experiências românticas, restaurantes intimistas, atividades para dois'
    },
    'familia': {
      descricao: `uma família de ${dadosDetalhados.quantidadeTotal} pessoas (${dadosDetalhados.quantidadeAdultos} adulto${dadosDetalhados.quantidadeAdultos > 1 ? 's' : ''}${dadosDetalhados.quantidadeCriancas > 0 ? `, ${dadosDetalhados.quantidadeCriancas} criança${dadosDetalhados.quantidadeCriancas > 1 ? 's' : ''}` : ''}${dadosDetalhados.quantidadeBebes > 0 ? `, ${dadosDetalhados.quantidadeBebes} bebê${dadosDetalhados.quantidadeBebes > 1 ? 's' : ''}` : ''})`,
      consideracoes: `atividades family-friendly, ${dadosDetalhados.temCriancas ? 'entretenimento para crianças, ' : ''}${dadosDetalhados.temBebes ? 'facilidades para bebês, ' : ''}restaurantes que recebem bem famílias, atrações educativas`
    },
    'amigos': {
      descricao: `um grupo de ${dadosDetalhados.quantidadeTotal} amigos`,
      consideracoes: 'atividades em grupo, vida noturna, experiências compartilhadas, diversão'
    }
  };
  
  const infoCompanhia = configCompanhia[tipoCompanhia] || configCompanhia['sozinho'];
  
  // ✅ PROMPT COMPLETAMENTE MELHORADO
  return `
Você é a Tripinha, uma vira-lata caramelo magra, esperta, despojada e especialista em viagens na Benetrip. Sua missão é criar roteiros PERSONALIZADOS baseados em TODAS as preferências do usuário.

📋 DADOS DA VIAGEM:
- Destino: ${destino}, ${pais}
- Data de início: ${dataInicio}${dataFim ? `\n- Data de término: ${dataFim}` : ''}
- Duração: ${diasViagem} dias
- Horário de chegada: ${horaChegada || 'Não informado'}
- Horário de partida: ${horaSaida || 'Não informado'}

👥 PERFIL DO VIAJANTE:
- Viajantes: ${infoCompanhia.descricao}
- Considerações especiais: ${infoCompanhia.consideracoes}

🎯 PREFERÊNCIAS ESPECÍFICAS:
- Estilo de viagem: ${descricaoTipoViagem}
- Intensidade: ${intensidade.toUpperCase()} (${infoIntensidade.atividades}, ${infoIntensidade.ritmo})
- Orçamento: ${infoOrcamento.descricao.toUpperCase()}
- Foco em: ${infoOrcamento.atividades}
- Alimentação: ${infoOrcamento.alimentacao}

🔧 INSTRUÇÕES PERSONALIZADAS:

1. **INTENSIDADE ${intensidade.toUpperCase()}**: 
   - ${infoIntensidade.atividades}
   - Ritmo ${infoIntensidade.ritmo}
   - ${infoIntensidade.descanso}

2. **ORÇAMENTO ${orcamento.toUpperCase()}**:
   - Priorize: ${infoOrcamento.atividades}
   - Restaurantes: ${infoOrcamento.alimentacao}
   - Transporte: ${infoOrcamento.transporte}

3. **ADAPTAÇÕES PARA ${tipoCompanhia.toUpperCase()}**:
   ${dadosDetalhados.temCriancas ? '- PRIORIDADE: Atividades kid-friendly, playgrounds, museus interativos' : ''}
   ${dadosDetalhados.temBebes ? '- ESSENCIAL: Locais com facilidades para troca de fraldas, carrinho de bebê' : ''}
   ${dadosDetalhados.grupoGrande ? '- GRUPOS GRANDES: Restaurantes que comportem grupos, atividades coletivas' : ''}
   ${tipoCompanhia === 'casal' ? '- ROMÂNTICO: Locais com vista, restaurantes intimistas, experiências para dois' : ''}
   ${tipoCompanhia === 'sozinho' ? '- SOLO TRAVEL: Lugares seguros, oportunidades de conhecer pessoas' : ''}

4. **TIMING INTELIGENTE**:
   - Primeiro dia: Considere chegada às ${horaChegada || 'XX:XX'}
   - Último dia: Considere partida às ${horaSaida || 'XX:XX'}
   - ${intensidade === 'leve' ? 'Manhãs relaxadas, tardes tranquilas' : intensidade === 'intenso' ? 'Aproveite cada minuto, agenda cheia' : 'Equilíbrio entre atividades e descanso'}

5. **EXPERIÊNCIAS AUTÊNTICAS**:
   - Misture atrações famosas com experiências locais
   - ${tipoViagem === 'cultura' ? 'Museus, sítios históricos, arte local' : ''}
   - ${tipoViagem === 'aventura' ? 'Atividades outdoor, trilhas, esportes locais' : ''}
   - ${tipoViagem === 'relaxar' ? 'Spas, praias, parques, café tranquilo' : ''}
   - ${tipoViagem === 'urbano' ? 'Shopping, vida noturna, gastronomia moderna' : ''}

CRIE EXATAMENTE ${diasViagem} DIAS DE ROTEIRO PERSONALIZADO.

Retorne em formato JSON:
{
  "destino": "Nome do destino",
  "observacoes_personalizacao": "Como o roteiro foi adaptado às preferências específicas",
  "dias": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "Descrição do dia alinhada com as preferências",
      "intensidade_dia": "${intensidade}",
      "foco_orcamento": "${orcamento}",
      "manha": {
        "horarioEspecial": "Chegada às XX:XX" (apenas se aplicável),
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome do local (adaptado ao orçamento ${orcamento})",
            "tags": ["tag1", "tag2", "${tipoViagem}", "${tipoCompanhia}"],
            "dica": "Dica específica da Tripinha considerando ${tipoCompanhia} com orçamento ${orcamento}",
            "adequado_para": "${dadosDetalhados.temCriancas ? 'crianças, ' : ''}${dadosDetalhados.temBebes ? 'bebês, ' : ''}${tipoCompanhia}",
            "custo_estimado": "${orcamento === 'baixo' ? 'Gratuito/Baixo' : orcamento === 'alto' ? 'Premium' : 'Moderado'}"
          }
        ]
      },
      "tarde": { "atividades": [...] },
      "noite": { "atividades": [...] }
    }
  ]
}

IMPORTANTE: O roteiro deve refletir TODAS as preferências: intensidade ${intensidade}, orçamento ${orcamento}, estilo ${tipoViagem}, perfil ${tipoCompanhia} com ${dadosDetalhados.quantidadeTotal} pessoa${dadosDetalhados.quantidadeTotal > 1 ? 's' : ''}.
`;
}

/**
 * Gera roteiro utilizando a API DeepSeek
 */
async function gerarRoteiroComDeepseek(prompt) {
  try {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('Chave da API DeepSeek não configurada');
    }
    
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      }
    );
    
    const respostaText = response.data.choices[0].message.content;
    
    try {
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      const roteiro = JSON.parse(jsonText);
      return roteiro;
    } catch (parseError) {
      logEvent('error', 'Erro ao processar resposta JSON da DeepSeek', {
        error: parseError.message,
        response: respostaText
      });
      
      throw new Error('Resposta da DeepSeek não é um JSON válido');
    }
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada à API DeepSeek', {
      error: erro.message,
      response: erro.response?.data
    });
    
    throw erro;
  }
}

/**
 * Gera roteiro utilizando a API Claude (Anthropic)
 */
async function gerarRoteiroComClaude(prompt) {
  try {
    if (!CLAUDE_API_KEY) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    
    const respostaText = response.data.content[0].text;
    
    try {
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      const roteiro = JSON.parse(jsonText);
      return roteiro;
    } catch (parseError) {
      logEvent('error', 'Erro ao processar resposta JSON da Claude', {
        error: parseError.message,
        response: respostaText
      });
      
      throw new Error('Resposta da Claude não é um JSON válido');
    }
    
  } catch (erro) {
    logEvent('error', 'Erro na chamada à API Claude', {
      error: erro.message,
      response: erro.response?.data
    });
    
    throw erro;
  }
}
