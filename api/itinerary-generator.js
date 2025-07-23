// api/itinerary-generator.js - Endpoint para geração de roteiro personalizado
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
      preferencias,
      modeloIA
    } = req.body;
    
    // Validar parâmetros obrigatórios
    if (!destino || !dataInicio) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: destino, dataInicio' });
    }
    
    // Calcular número de dias
    const diasViagem = calcularDiasViagem(dataInicio, dataFim);
    
    // Log dos parâmetros recebidos
    logEvent('info', 'Gerando roteiro personalizado', {
      destino,
      pais,
      diasViagem,
      tipoViagem,
      tipoCompanhia
    });
    
    // Gerar o prompt para a IA
    const prompt = gerarPromptRoteiro({
      destino,
      pais,
      dataInicio,
      dataFim,
      horaChegada,
      horaSaida,
      diasViagem,
      tipoViagem,
      tipoCompanhia,
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
 * Calcula o número de dias entre duas datas
 * @param {string} dataInicio - Data de início no formato YYYY-MM-DD
 * @param {string} dataFim - Data de fim no formato YYYY-MM-DD
 * @returns {number} Número de dias
 */
function calcularDiasViagem(dataInicio, dataFim) {
  if (!dataInicio) return 1;
  
  const inicio = new Date(dataInicio);
  
  // Se não tiver data fim, assume 1 dia
  if (!dataFim) return 1;
  
  const fim = new Date(dataFim);
  
  // Calcular diferença em dias
  const diffTempo = Math.abs(fim - inicio);
  const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;  // +1 para incluir o dia de chegada
  
  return diffDias;
}

/**
 * Gera o prompt para a IA baseado nos parâmetros
 * @param {Object} params - Parâmetros para o prompt
 * @returns {string} Prompt formatado
 */
function gerarPromptRoteiro(params) {
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
    preferencias
  } = params;
  
  // Mapear o tipo de viagem para descrição
  const descricaoTipoViagem = {
    'relaxar': 'relaxamento e descanso',
    'aventura': 'aventura e adrenalina',
    'cultura': 'cultura, história e gastronomia',
    'urbano': 'urbanismo, compras e vida noturna'
  }[tipoViagem] || 'cultura e experiências variadas';
  
  // Mapear o tipo de companhia para descrição
  const descricaoTipoCompanhia = {
    'sozinho': 'uma pessoa viajando sozinha',
    'casal': 'um casal em viagem romântica',
    'familia': 'uma família com crianças',
    'amigos': 'um grupo de amigos'
  }[tipoCompanhia] || 'um viajante';
  
  // ✅ NOVO: Mapear intensidade e orçamento
  const intensidadeInfo = {
    'leve': '2-3 atividades por dia (ritmo relaxado)',
    'moderado': '4-5 atividades por dia (ritmo equilibrado)',
    'intenso': '6+ atividades por dia (ritmo acelerado)'
  };
  
  const orcamentoInfo = {
    'economico': 'econômico (priorize atividades gratuitas e de baixo custo)',
    'medio': 'médio (misture atividades gratuitas e pagas)',
    'alto': 'alto (inclua experiências premium sem limitações de custo)'
  };
  
  // ✅ NOVO: Criar informações detalhadas de viajantes
  let infoViajantes = descricaoTipoCompanhia;
  if (tipoCompanhia === 'familia' && preferencias) {
    const adultos = preferencias.quantidade_adultos || 2;
    const criancas = preferencias.quantidade_criancas || 0;
    const bebes = preferencias.quantidade_bebes || 0;
    infoViajantes += ` (${adultos} adulto${adultos > 1 ? 's' : ''}`;
    if (criancas > 0) infoViajantes += `, ${criancas} criança${criancas > 1 ? 's' : ''}`;
    if (bebes > 0) infoViajantes += `, ${bebes} bebê${bebes > 1 ? 's' : ''}`;
    infoViajantes += ')';
  }
  
  // Montar o prompt
  return `
Você é a Tripinha, uma vira-lata caramelo magra, esperta, despojada e especialista em viagens na Benetrip. Sua missão é transformar as respostas do usuário em um roteiro de viagem completo, personalizado e incrível. Fale como se fosse uma amiga: com leveza, simpatia, bom humor e dicas práticas, sem enrolação.. 
Crie um roteiro detalhado para uma viagem com as seguintes características:

- Destino: ${destino}, ${pais}
- Data de início: ${dataInicio}${dataFim ? `\n- Data de término: ${dataFim}` : ''}
- Duração: ${diasViagem} dias
- Horário de chegada no primeiro dia: ${horaChegada || 'Não informado'}
- Horário de partida no último dia: ${horaSaida || 'Não informado'}
- Tipo de viagem: Foco em ${descricaoTipoViagem}
- Viajantes: ${infoViajantes}
- Intensidade do roteiro: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
- Orçamento: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}

INSTRUÇÕES:
1. CRIE UM ROTEIRO PARA TODOS OS ${diasViagem} DIAS DE VIAGEM - TODOS OS DIAS ESSENCIALMENTE TEM DE TER ROTEIRO!
2. RESPEITE A INTENSIDADE escolhida: ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}
3. CONSIDERE O ORÇAMENTO: ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}
4. ADAPTE AS ATIVIDADES para ${infoViajantes}
5. Organize o roteiro por dias, considerando o dia da semana real e se é fim de semana ou dia útil.
6. Para cada dia, divida o roteiro em períodos: manhã, tarde e noite.
7. Cada período deve ter atividades relevantes conforme a intensidade escolhida, com locais reais (pontos turísticos, restaurantes, etc).
8. Para cada atividade, inclua:
   - Horário sugerido
   - Nome do local
   - 1-2 tags relevantes (ex: Imperdível, Cultural, Família)
   - Uma dica personalizada da Tripinha (mascote da Benetrip)
9. No primeiro dia, considere o horário de chegada (${horaChegada || 'não informado'}).
10. No último dia, considere o horário de partida (${horaSaida || 'não informado'}).
11. Inclua uma breve descrição para cada dia.
12. FAÇA O MÁXIMO PARA QUE TODOS OS ${diasViagem} DIAS TENHAM ATIVIDADES DIFERENTES, CASO CONTRARIO, REPITA OS PASSEIOS MAIS CONHECIDOS.
13. CRITICAL: Você DEVE criar atividades para TODOS os ${diasViagem} dias sem exceções. Se ${diasViagem} é 29, você DEVE criar 29 dias de roteiro completo.

Retorne o roteiro em formato JSON com a seguinte estrutura:
{
  "destino": "Nome do destino",
  "dias": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "Breve descrição sobre o dia",
      "manha": {
        "horarioEspecial": "Chegada às XX:XX" (opcional, apenas se for chegada/partida),
        "atividades": [
          {
            "horario": "HH:MM",
            "local": "Nome do local",
            "tags": ["tag1", "tag2"],
            "dica": "Dica da Tripinha sobre o local"
          }
        ]
      },
      "tarde": { ... mesmo formato da manhã ... },
      "noite": { ... mesmo formato da manhã ... }
    }
  ]
}

Observações importantes:
- Para ${infoViajantes}, dê prioridade a atividades compatíveis.
- Como o foco é ${descricaoTipoViagem}, sugira mais atividades relacionadas a esse tema.
- Respeite rigorosamente a intensidade de ${intensidadeInfo[preferencias?.intensidade_roteiro] || intensidadeInfo['moderado']}.
- Ajuste as sugestões ao orçamento ${orcamentoInfo[preferencias?.orcamento_nivel] || orcamentoInfo['medio']}.
- Considere atividades para dias úteis e atividades específicas para fins de semana.
- Inclua uma mistura de atrações turísticas populares e experiências locais.
- Garanta que destinos mais conhecidos estejam no roteiro da viagem.
`;
}

/**
 * Gera roteiro utilizando a API DeepSeek
 * @param {string} prompt - Prompt para a IA
 * @returns {Object} Roteiro gerado
 */
async function gerarRoteiroComDeepseek(prompt) {
  try {
    // Verificar se a chave da API está configurada
    if (!DEEPSEEK_API_KEY) {
      throw new Error('Chave da API DeepSeek não configurada');
    }
    
    // Realizar chamada à API DeepSeek
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
    
    // Extrair resposta
    const respostaText = response.data.choices[0].message.content;
    
    // Processar a resposta JSON
    try {
      // Limpar qualquer markdown ou texto antes/depois do JSON
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      
      // Parsear para objeto
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
 * @param {string} prompt - Prompt para a IA
 * @returns {Object} Roteiro gerado
 */
async function gerarRoteiroComClaude(prompt) {
  try {
    // Verificar se a chave da API está configurada
    if (!CLAUDE_API_KEY) {
      throw new Error('Chave da API Claude não configurada');
    }
    
    // Realizar chamada à API Claude (Anthropic)
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
        ],
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    
    // Extrair resposta
    const respostaText = response.data.content[0].text;
    
    // Processar a resposta JSON
    try {
      // Limpar qualquer markdown ou texto antes/depois do JSON
      const jsonMatch = respostaText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : respostaText;
      
      // Parsear para objeto
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
