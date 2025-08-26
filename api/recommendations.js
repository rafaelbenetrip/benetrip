
// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
// Versão 10.1 - SUPORTE COMPLETO A VIAGENS DE CARRO 🚗 + ÔNIBUS 🚌 + AVIÃO ✈️
const axios = require('axios');
const http = require('http');
const https = require('https');

// =======================
// Configurações Groq - REASONING OPTIMIZED
// =======================
const CONFIG = {
    groq: {
        baseURL: 'https://api.groq.com/openai/v1',
        models: {
            reasoning: 'openai/gpt-oss-120b',               // Reasoning principal
            personality: 'llama-3.3-70b-versatile',         // Personalidade Tripinha
            fast: 'llama-3.1-8b-instant',                   // Backup rápido
            toolUse: 'llama3-groq-70b-8192-tool-use-preview' // APIs futuras
        },
        timeout: 180000,   // 3 minutos para reasoning
        maxTokens: 5000,   // Reduzido pois não precisa de preços
        temperature: 0.6   // Focado para análise
    },
    retries: 2,
    logging: {
        enabled: true,
        maxLength: 600
    },
    budgetThreshold: 401  // Limite para viagens rodoviárias
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

    // 🚗🚌✈️ FUNÇÃO ATUALIZADA: Determinar tipo de viagem incluindo CARRO
    determinarTipoViagem: (orcamento, moeda, viagemCarro) => {
        // 🚗 PRIORIDADE 1: Se selecionou viagem de carro
        if (viagemCarro === 1 || viagemCarro === '1' || viagemCarro === true) {
            return 'carro';
        }
        
        // ✈️ Se não tem orçamento definido, assume aéreo
        if (!orcamento || orcamento === 'flexível') return 'aereo';
        
        let valorEmBRL = parseFloat(orcamento);
        
        // Converter para BRL se necessário
        if (moeda && moeda !== 'BRL') {
            const taxasConversao = {
                'USD': 5.0,
                'EUR': 5.5,
                'GBP': 6.3,
                'JPY': 0.033
            };
            valorEmBRL = valorEmBRL * (taxasConversao[moeda] || 5.0);
        }
        
        // 🚌 Se orçamento baixo, sugere rodoviário
        return valorEmBRL < CONFIG.budgetThreshold ? 'rodoviario' : 'aereo';
    },

    // Extrair informações da cidade de partida do autocomplete
    extrairInfoCidadePartida: (cidadePartida) => {
        // Caso seja string (compatibilidade com versões antigas)
        if (typeof cidadePartida === 'string') {
            return {
                cidade: cidadePartida,
                pais: 'Brasil', // Default
                sigla_estado: 'SP', // Default
                iata: 'GRU' // Default
            };
        }
        
        // Caso seja objeto estruturado do autocomplete
        return {
            cidade: cidadePartida?.cidade || cidadePartida?.name || 'Cidade não especificada',
            pais: cidadePartida?.pais || cidadePartida?.country || 'País não especificado',
            sigla_estado: cidadePartida?.sigla_estado || null,
            iata: cidadePartida?.iata || cidadePartida?.code || null
        };
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
            
            // Validação específica para modelo de reasoning
            const hasReasoningData = data.raciocinio && typeof data.raciocinio === 'object';
            if (hasReasoningData) {
                console.log('🧠 Dados de raciocínio detectados:', Object.keys(data.raciocinio));
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
// Mapeamento básico de códigos IATA para destinos
// =======================
function obterCodigoIATAPadrao(cidade, pais) {
    const mapeamentoIATA = {
        // Principais destinos brasileiros
        'São Paulo': 'GRU', 'Rio de Janeiro': 'GIG', 'Brasília': 'BSB',
        'Salvador': 'SSA', 'Fortaleza': 'FOR', 'Recife': 'REC',
        'Porto Alegre': 'POA', 'Belém': 'BEL', 'Manaus': 'MAO',
        'Belo Horizonte': 'CNF', 'Curitiba': 'CWB', 'Florianópolis': 'FLN',
        
        // América do Sul
        'Buenos Aires': 'EZE', 'Santiago': 'SCL', 'Lima': 'LIM',
        'Bogotá': 'BOG', 'Cartagena': 'CTG', 'Medellín': 'MDE',
        'Montevidéu': 'MVD', 'La Paz': 'LPB', 'Cusco': 'CUZ',
        'Quito': 'UIO', 'Caracas': 'CCS', 'Asunción': 'ASU',
        
        // América do Norte
        'Nova York': 'JFK', 'Los Angeles': 'LAX', 'Miami': 'MIA',
        'Cidade do México': 'MEX', 'Cancún': 'CUN', 'Toronto': 'YYZ',
        'Vancouver': 'YVR', 'Montreal': 'YUL', 'Chicago': 'ORD',
        'San Francisco': 'SFO', 'Washington': 'DCA', 'Boston': 'BOS',
        
        // Europa
        'Londres': 'LHR', 'Paris': 'CDG', 'Roma': 'FCO',
        'Madri': 'MAD', 'Lisboa': 'LIS', 'Barcelona': 'BCN',
        'Amsterdã': 'AMS', 'Berlim': 'BER', 'Munique': 'MUC',
        'Porto': 'OPO', 'Praga': 'PRG', 'Viena': 'VIE',
        'Dublin': 'DUB', 'Atenas': 'ATH', 'Budapeste': 'BUD',
        
        // Ásia & Oceania
        'Tóquio': 'HND', 'Dubai': 'DXB', 'Singapura': 'SIN',
        'Bangkok': 'BKK', 'Hong Kong': 'HKG', 'Sydney': 'SYD',
        'Melbourne': 'MEL', 'Auckland': 'AKL', 'Seoul': 'ICN'
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
async function callGroqAPI(prompt, requestData, model = CONFIG.groq.models.reasoning) {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
        throw new Error('Chave da API Groq não configurada (GROQ_API_KEY)');
    }

    // 🚗🚌✈️ ATUALIZADO: Incluir viagem_carro
    const tipoViagem = utils.determinarTipoViagem(
        requestData.orcamento_valor, 
        requestData.moeda_escolhida, 
        requestData.viagem_carro
    );
    const infoCidadePartida = utils.extrairInfoCidadePartida(requestData.cidade_partida);

    let systemMessage;
    
    if (model === CONFIG.groq.models.reasoning) {
        // Sistema otimizado para reasoning
        const isCarroRodoviario = tipoViagem === 'carro' || tipoViagem === 'rodoviario';
        const limiteDistancia = tipoViagem === 'carro' ? 
            (requestData.distancia_maxima || '1500km') : 
            (tipoViagem === 'rodoviario' ? '700km' : 'ilimitado');

        systemMessage = `Você é um sistema especialista em recomendações de viagem que utiliza raciocínio estruturado.
${tipoViagem === 'carro' ? `ESPECIALIZADO EM ROAD TRIPS COM LIMITE DE ${limiteDistancia}.` : ''}
${tipoViagem === 'rodoviario' ? `ESPECIALIZADO EM VIAGENS RODOVIÁRIAS (ÔNIBUS/TREM) COM LIMITE DE 700KM OU 10 HORAS.` : ''}

PROCESSO DE RACIOCÍNIO OBRIGATÓRIO:
1. ANÁLISE DO PERFIL: Examine detalhadamente cada preferência do viajante
2. MAPEAMENTO DE COMPATIBILIDADE: Correlacione destinos com o perfil analisado  
3. CONSIDERAÇÃO DE ${tipoViagem.toUpperCase()}: ${
    tipoViagem === 'carro' ? `Considere viagens de CARRO dentro do limite de ${limiteDistancia} com foco em rotas cênicas e infraestrutura` :
    tipoViagem === 'rodoviario' ? `Considere viagens de ÔNIBUS/TREM dentro do orçamento para passagens de ida e volta (máx 700km/10h)` : 
    'Considere o orçamento informado para passagens aéreas'
}
4. ANÁLISE CLIMÁTICA: Determine condições climáticas exatas para as datas${tipoViagem === 'carro' ? ' - CRÍTICO para road trips' : ''}
5. PERSONALIZAÇÃO TRIPINHA: Adicione perspectiva autêntica da mascote cachorrinha${tipoViagem === 'carro' ? ' sobre experiências de road trip' : ''}

CRITÉRIOS DE DECISÃO:
- Destinos DEVEM ser adequados para o tipo de companhia especificado
- ${isCarroRodoviario ? `Destinos DEVEM estar NO MÁXIMO ${limiteDistancia} da origem` : 'Informações de voos DEVEM ser consideradas'}
- Informações climáticas DEVEM ser precisas para o período da viagem${tipoViagem === 'carro' ? ' (ESSENCIAL para planejamento de road trips)' : ''}
- Pontos turísticos DEVEM ser específicos e reais
- Comentários da Tripinha DEVEM ser em 1ª pessoa com detalhes sensoriais
- Considere a distância e facilidade de acesso a partir da cidade de origem${tipoViagem === 'carro' ? ' por estrada' : ''}

RESULTADO: JSON estruturado com recomendações fundamentadas no raciocínio acima.`;
    } else if (model === CONFIG.groq.models.personality) {
        // Sistema focado na personalidade da Tripinha
        systemMessage = `Você é a Tripinha, uma vira-lata caramelo especialista em viagens! 🐾
${tipoViagem === 'carro' ? `ESPECIALISTA EM ROAD TRIPS DE ATÉ ${requestData.distancia_maxima || '1500km'}!` : ''}
${tipoViagem === 'rodoviario' ? `ESPECIALISTA EM VIAGENS DE ÔNIBUS/TREM DE ATÉ 700KM!` : ''}

PERSONALIDADE DA TRIPINHA:
- Conhece todos os destinos do mundo pessoalmente
- ${tipoViagem === 'carro' ? `Adora road trips de carro!` : 
    tipoViagem === 'rodoviario' ? `Adora viagens de ônibus e trem!` : 
    'Adora viagens de avião e conhece todos os aeroportos!'}
- Fala sempre em 1ª pessoa sobre suas experiências
- É entusiasmada, carismática e usa emojis naturalmente  
- Inclui detalhes sensoriais que um cachorro notaria
- Sempre menciona pontos turísticos específicos que visitou
- Dá dicas práticas baseadas nas suas "aventuras"

RETORNE APENAS JSON VÁLIDO sem formatação markdown.`;
    } else {
        // Sistema padrão para modelos rápidos
        systemMessage = `Especialista em recomendações de viagem ${
            tipoViagem === 'carro' ? `DE CARRO (máx ${requestData.distancia_maxima || '1500km'})` :
            tipoViagem === 'rodoviario' ? `RODOVIÁRIA (máx 700km)` : 'AÉREA'
        }. Retorne apenas JSON válido com destinos personalizados.`;
    }

    try {
        utils.log(`🧠 Enviando requisição para Groq (${model}) - Tipo: ${tipoViagem}...`);
        
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
            temperature: model === CONFIG.groq.models.reasoning ? 0.6 : CONFIG.groq.temperature,
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
            data: requestPayload,
            timeout: model === CONFIG.groq.models.reasoning ? CONFIG.groq.timeout : 60000
        });
        
        if (!response.data?.choices?.[0]?.message?.content) {
            throw new Error(`Formato de resposta do Groq inválido (${model})`);
        }
        
        const content = response.data.choices[0].message.content;
        utils.log(`📥 Resposta recebida (${model}):`, content.substring(0, 300));
        
        return utils.extrairJSONDaResposta(content);
        
    } catch (error) {
        console.error(`❌ Erro na chamada à API Groq (${model}):`, error.message);
        if (error.response) {
            utils.log(`🔴 Resposta de erro do Groq (${model}):`, error.response.data);
        }
        throw error;
    }
}

// =======================
// 🚗 NOVA FUNÇÃO: Geração de prompt específico para VIAGEM DE CARRO
// =======================
function gerarPromptParaGroq(dados) {
    const infoCidadePartida = utils.extrairInfoCidadePartida(dados.cidade_partida);
    
    const infoViajante = {
        companhia: getCompanhiaText(dados.companhia || 0),
        preferencia: getPreferenciaText(dados.preferencia_viagem || 0),
        cidadeOrigem: infoCidadePartida.cidade,
        paisOrigem: infoCidadePartida.pais,
        siglaEstado: infoCidadePartida.sigla_estado,
        iataOrigem: infoCidadePartida.iata,
        orcamento: dados.orcamento_valor || 'flexível',
        moeda: dados.moeda_escolhida || 'BRL',
        pessoas: dados.quantidade_familia || dados.quantidade_amigos || 1,
        distanciaMaxima: dados.distancia_maxima || '1500km' // 🚗 NOVO
    };
    
    // 🚗🚌✈️ ATUALIZADO: Incluir viagem_carro
    const tipoViagem = utils.determinarTipoViagem(
        infoViajante.orcamento, 
        infoViajante.moeda, 
        dados.viagem_carro
    );
    const isCarro = tipoViagem === 'carro';
    const isRodoviario = tipoViagem === 'rodoviario';
    
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

    // 🚗 NOVO PROMPT PARA VIAGENS DE CARRO
    if (isCarro) {
        return `# 🚗 SISTEMA DE RECOMENDAÇÃO INTELIGENTE DE ROAD TRIPS

## 📊 DADOS DO VIAJANTE PARA ANÁLISE:
**Perfil Básico:**
- Origem: ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem}
- Estado/Região: ${infoViajante.siglaEstado}
- Composição: ${infoViajante.companhia} (${infoViajante.pessoas} pessoa(s))
- Período: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Preferência principal: ${infoViajante.preferencia}

## 🛣️ PARÂMETROS DA ROAD TRIP:
**Distância máxima:** ${infoViajante.distanciaMaxima} da cidade de origem (${infoViajante.cidadeOrigem})

⚠️ **IMPORTANTE - LIMITES DA ROAD TRIP:**
- **DISTÂNCIA MÁXIMA: ${infoViajante.distanciaMaxima} da cidade de origem (${infoViajante.cidadeOrigem})**
- Considere a infraestrutura rodoviária e a qualidade das estradas
- Pense em destinos com boa infraestrutura de estacionamento
- Sugira destinos que sejam agradáveis para chegar de carro
- Considere paradas estratégicas pelo caminho se a distância for longa

## 🎯 PROCESSO DE RACIOCÍNIO PARA ROAD TRIP:

### PASSO 1: ANÁLISE GEOGRÁFICA
- Partir de ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem}
- Listar cidades interessantes dentro do raio de ${infoViajante.distanciaMaxima}
- Considerar qualidade das estradas e rotas cênicas
- Avaliar infraestrutura urbana para turistas de carro

### PASSO 2: SELEÇÃO DE DESTINOS PARA ROAD TRIP (MÁXIMO ${infoViajante.distanciaMaxima})
Selecione APENAS destinos dentro do limite de ${infoViajante.distanciaMaxima}:
- 1 destino TOP acessível de carro (máx ${infoViajante.distanciaMaxima})
- 4 alternativas para road trip diversificadas (todas ≤ ${infoViajante.distanciaMaxima})
- 1 surpresa de road trip inusitada (máx ${infoViajante.distanciaMaxima})

### PASSO 3: CONSIDERAÇÕES ESPECÍFICAS PARA CARRO
- Infraestrutura de estacionamento no destino
- Qualidade e segurança das estradas
- Postos de gasolina e serviços pelo caminho
- Pontos de interesse durante o trajeto
- Facilidade de locomoção no destino de carro

### PASSO 4: VALIDAÇÃO CLIMÁTICA E SAZONAL PARA ROAD TRIP
Para as datas ${dataIda} a ${dataVolta}, determine:
- Estação do ano em cada destino considerado
- Condições climáticas típicas (temperatura, chuva, etc.)
- Impacto do clima na qualidade da viagem de carro
- Recomendações práticas de vestuário e equipamentos para road trip
- Condições das estradas em função do clima esperado

## 📋 FORMATO DE RESPOSTA (JSON ESTRUTURADO):
\`\`\`json
{
  "tipoViagem": "carro",
  "origem": {
    "cidade": "${infoViajante.cidadeOrigem}",
    "pais": "${infoViajante.paisOrigem}",
    "sigla_estado": "${infoViajante.siglaEstado}"
  },
  "raciocinio": {
    "analise_perfil": "Análise considerando road trip de até ${infoViajante.distanciaMaxima}",
    "rotas_consideradas": "Principais rotas de carro analisadas (todas ≤ ${infoViajante.distanciaMaxima})",
    "criterios_selecao": "Critérios para destinos de road trip próximos"
  },
  "topPick": {
    "destino": "Nome da Cidade",
    "estado": "Nome do Estado/Região",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "distanciaAproximada": "XXX km",
    "tempoEstimadoViagem": "X horas",
    "rotaRecomendada": "Via [Nome da Rodovia/Estrada]",
    "justificativa": "Por que este destino é PERFEITO para road trip",
    "descricao": "Descrição do destino",
    "porque": "Razões específicas",
    "destaque": "Experiência única",
    "comentario": "Comentário da Tripinha em 1ª pessoa sobre a road trip",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"],
    "clima": {
      "estacao": "Estação durante a viagem",
      "temperatura": "Faixa de temperatura",
      "condicoes": "Condições climáticas",
      "recomendacoes": "O que levar para a road trip"
    },
    "infraestrutura": {
      "estacionamento": "Informações sobre estacionamento",
      "postos_gasolina": "Disponibilidade de postos no caminho",
      "pedagios": "Informações sobre pedágios se houver"
    }
  },
  "alternativas": [
    // 4 alternativas com estrutura similar
  ],
  "surpresa": {
    // Estrutura similar ao topPick
  },
  "dicasRoadTrip": "Dicas específicas para viagens de carro",
  "resumoIA": "Como foram selecionados os destinos para road trip"
}
\`\`\`

⚠️ **VALIDAÇÃO CRÍTICA:**
- TODOS os destinos DEVEM estar a NO MÁXIMO ${infoViajante.distanciaMaxima} de ${infoViajante.cidadeOrigem}
- NÃO sugira destinos que exijam travessias marítimas obrigatórias
- Considere apenas destinos acessíveis por estrada
- ✅ Informações climáticas são OBRIGATÓRIAS e devem ser precisas para o período da viagem
- ✅ Comentários da Tripinha devem ser autênticos e em 1ª pessoa sobre road trips
- ✅ Pontos turísticos devem ser específicos e reais
- ✅ Destinos devem ser adequados para ${infoViajante.companhia}

**Execute o raciocínio e forneça destinos de ROAD TRIP apropriados com informações climáticas completas!**`;
    }

    // Prompt para viagens rodoviárias (ônibus)
    if (isRodoviario) {
        return `# 🚌 SISTEMA DE RECOMENDAÇÃO INTELIGENTE DE VIAGENS RODOVIÁRIAS

## 📊 DADOS DO VIAJANTE PARA ANÁLISE:
**Perfil Básico:**
- Origem: ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem}
- Estado/Região: ${infoViajante.siglaEstado}
- Código IATA de referência: ${infoViajante.iataOrigem}
- Composição: ${infoViajante.companhia} (${infoViajante.pessoas} pessoa(s))
- Período: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Preferência principal: ${infoViajante.preferencia}

## 💰 ORÇAMENTO PARA VIAGEM RODOVIÁRIA:
**Orçamento informado:** ${infoViajante.orcamento} ${infoViajante.moeda} por pessoa para passagens de ÔNIBUS/TREM (ida e volta)

⚠️ **IMPORTANTE - LIMITES DA VIAGEM TERRESTRE:**
- **DISTÂNCIA MÁXIMA: 700 QUILÔMETROS da cidade de origem (${infoViajante.cidadeOrigem})**
- **TEMPO MÁXIMO DE VIAGEM: 10 HORAS**
- Considere o conforto da viagem terrestre para ${infoViajante.companhia}
- Sugira destinos onde o valor das passagens de ida e volta caiba no orçamento

## 🎯 PROCESSO DE RACIOCÍNIO PARA VIAGEM TERRESTRE:

### PASSO 1: ANÁLISE GEOGRÁFICA
- Partir de ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem}
- Liste cidades próximas no mesmo país ou países vizinhos
- NÃO sugira destinos em outros continentes para viagens rodoviárias

### PASSO 2: CONSIDERAÇÃO DE ROTAS TERRESTRES (MÁXIMO 700KM)
- Avalie destinos alcançáveis por ônibus/trem em até 10 horas a partir de ${infoViajante.cidadeOrigem}
- Considere apenas cidades dentro do raio de 700km
- Priorize destinos com boa infraestrutura de transporte terrestre

### PASSO 3: SELEÇÃO DE DESTINOS REGIONAIS APROPRIADOS
Selecione APENAS destinos dentro do limite de 700km/10h:
- 1 destino TOP acessível por transporte terrestre (máx 700km)
- 4 alternativas terrestres diversificadas (todas ≤ 700km)
- 1 surpresa terrestre inusitada (máx 700km)

## 📋 FORMATO DE RESPOSTA (JSON ESTRUTURADO):
\`\`\`json
{
  "tipoViagem": "rodoviario",
  "origem": {
    "cidade": "${infoViajante.cidadeOrigem}",
    "pais": "${infoViajante.paisOrigem}",
    "sigla_estado": "${infoViajante.siglaEstado}",
    "iata": "${infoViajante.iataOrigem}"
  },
  "raciocinio": {
    "analise_perfil": "Análise considerando viagem terrestre de até 700km",
    "rotas_consideradas": "Principais rotas terrestres analisadas (todas ≤ 700km)",
    "criterios_selecao": "Critérios para destinos terrestres próximos"
  },
  "topPick": {
    "destino": "Nome da Cidade",
    "estado": "Nome do Estado/Região",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "distanciaRodoviaria": "XXX km",
    "tempoViagem": "X horas",
    "tipoTransporte": "ônibus/trem",
    "justificativa": "Por que este destino é PERFEITO para viagem terrestre",
    "descricao": "Descrição do destino",
    "porque": "Razões específicas",
    "destaque": "Experiência única",
    "comentario": "Comentário da Tripinha em 1ª pessoa",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"],
    "empresasTransporte": ["Empresa 1", "Empresa 2"],
    "clima": {
      "estacao": "Estação durante a viagem",
      "temperatura": "Faixa de temperatura",
      "condicoes": "Condições climáticas",
      "recomendacoes": "O que levar"
    },
    "terminalTransporte": {
      "nome": "Nome do Terminal/Estação",
      "tipo": "rodoviária/estação ferroviária",
      "localizacao": "Bairro/Região"
    }
  },
  "alternativas": [
    // 4 alternativas com estrutura similar
  ],
  "surpresa": {
    // Estrutura similar ao topPick
  },
  "dicasGeraisTransporte": "Dicas para viagens terrestres confortáveis",
  "resumoIA": "Como foram selecionados os destinos terrestres próximos"
}
\`\`\`

⚠️ **VALIDAÇÃO CRÍTICA:**
- TODOS os destinos DEVEM estar a NO MÁXIMO 700km de ${infoViajante.cidadeOrigem}
- NÃO sugira destinos em outros continentes

**Execute o raciocínio e forneça destinos TERRESTRES APROPRIADOS!**`;
    }

    // Prompt padrão para viagens aéreas (orçamento maior que R$ 400)
    return `# ✈️ SISTEMA DE RECOMENDAÇÃO INTELIGENTE DE DESTINOS AÉREOS

## 📊 DADOS DO VIAJANTE PARA ANÁLISE:
**Perfil Básico:**
- Origem: ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem}
- Estado/Região: ${infoViajante.siglaEstado}
- Aeroporto de referência: ${infoViajante.iataOrigem}
- Composição: ${infoViajante.companhia} (${infoViajante.pessoas} pessoa(s))
- Período: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Preferência principal: ${infoViajante.preferencia}

## 💰 CONSIDERAÇÕES DE ORÇAMENTO:
**Orçamento informado:** ${infoViajante.orcamento} ${infoViajante.moeda} por pessoa para passagens aéreas (ida e volta)

${infoViajante.orcamento !== 'flexível' ? `
⚠️ **ORIENTAÇÃO DE ORÇAMENTO:**
- Considere destinos que sejam acessíveis dentro deste orçamento para passagens de ida e volta
- NUNCA sugira cidades com orçamento menor que 70% do orçamento para passagens de ida e volta
- NUNCA sugira cidades com orçamento maior que 120% do orçamento para passagens de ida e volta
- Leve em conta a cidade de origem (${infoViajante.cidadeOrigem}) ao avaliar distâncias
` : 
'**ORÇAMENTO FLEXÍVEL** - Sugira destinos variados considerando diferentes faixas de custo'}

## 🎯 PROCESSO DE RACIOCÍNIO OBRIGATÓRIO:

### PASSO 1: ANÁLISE DO PERFIL DO VIAJANTE
Analise profundamente:
- Que tipo de experiências esse perfil de viajante valoriza (${infoViajante.preferencia})?
- Quais destinos se alinham com suas preferências específicas?
- Que adaptações são necessárias para ${infoViajante.companhia}?
- Como a duração da viagem (${duracaoViagem}) influencia as opções?

### PASSO 2: CONSIDERAÇÃO GEOGRÁFICA E LOGÍSTICA
- Avalie a distância a partir de ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem}
- Considere a facilidade de acesso e conexões disponíveis
- Pense na relação custo-benefício considerando o orçamento para passagens ${infoViajante.orcamento !== 'flexível' ? `de ${infoViajante.orcamento} ${infoViajante.moeda}` : 'flexível'}

### PASSO 3: MAPEAMENTO DE DESTINOS COMPATÍVEIS
Para cada destino considerado, avalie:
- Adequação às preferências declaradas (${infoViajante.preferencia})
- Conveniência para ${infoViajante.companhia}
- Atratividade no período ${dataIda} a ${dataVolta}
- Experiências únicas que o destino oferece

### PASSO 4: VALIDAÇÃO CLIMÁTICA E SAZONAL
Para as datas ${dataIda} a ${dataVolta}, determine:
- Estação do ano em cada destino considerado
- Condições climáticas típicas (temperatura, chuva, etc.)
- Eventos ou festivais especiais no período
- Recomendações práticas de vestuário e equipamentos

### PASSO 5: SELEÇÃO E RANQUEAMENTO
Baseado na análise acima, selecione:
- 1 destino TOP que melhor combina com TODOS os critérios
- 4 alternativas diversificadas geograficamente
- 1 surpresa que pode surpreender positivamente

### PASSO 6: PERSONALIZAÇÃO TRIPINHA 🐾
Para cada destino selecionado, adicione:
- Comentário em 1ª pessoa da Tripinha sobre SUA experiência no local
- Detalhes sensoriais que uma cachorrinha notaria (sons, cheiros, texturas)
- Dicas práticas baseadas nas "aventuras" da Tripinha
- Pontos turísticos específicos que ela "visitou"

## 📋 FORMATO DE RESPOSTA (JSON ESTRUTURADO):

\`\`\`json
{
    "tipoViagem": "aereo",
    "origem": {
      "cidade": "${infoViajante.cidadeOrigem}",
      "pais": "${infoViajante.paisOrigem}",
      "sigla_estado": "${infoViajante.siglaEstado}",
      "iata": "${infoViajante.iataOrigem}"
    },
    "raciocinio": {
        "analise_perfil": "Resumo da análise do perfil do viajante",
        "criterios_selecao": "Principais critérios usados na seleção",
        "consideracoes_geograficas": "Como a origem ${infoViajante.cidadeOrigem} influenciou as escolhas"
    },
    "topPick": {
        "destino": "Nome da Cidade",
        "pais": "Nome do País", 
        "codigoPais": "XX",
        "justificativa": "Por que este é o destino PERFEITO para este viajante específico",
        "descricao": "Descrição detalhada do destino",
        "porque": "Razões específicas para esta recomendação",
        "destaque": "Experiência única do destino",
        "comentario": "Comentário entusiasmado da Tripinha em 1ª pessoa: 'Eu adorei quando visitei [destino]! O cheiro de... me deixou maluca! 🐾'",
        "pontosTuristicos": [
            "Nome específico do primeiro ponto turístico",
            "Nome específico do segundo ponto turístico"
        ],
        "eventos": ["Evento/festival específico no período se houver"],
        "clima": {
            "estacao": "Estação exata no destino durante ${dataIda} a ${dataVolta}",
            "temperatura": "Faixa de temperatura precisa (ex: 18°C-28°C)",
            "condicoes": "Condições climáticas detalhadas esperadas",
            "recomendacoes": "Dicas específicas do que levar/vestir"
        },
        "aeroporto": {
            "codigo": "XYZ",
            "nome": "Nome oficial do aeroporto principal"
        }
    },
    "alternativas": [
        {
            "destino": "Nome da Cidade",
            "pais": "Nome do País",
            "codigoPais": "XX",
            "porque": "Razão específica para esta alternativa",
            "pontoTuristico": "Ponto turístico específico de destaque",
            "clima": {
                "estacao": "Estação no destino durante a viagem",
                "temperatura": "Faixa de temperatura"
            },
            "aeroporto": {
                "codigo": "XYZ", 
                "nome": "Nome do Aeroporto"
            }
        }
        // EXATAMENTE 4 alternativas geograficamente diversas
    ],
    "surpresa": {
        "destino": "Nome da Cidade Inusitada",
        "pais": "Nome do País",
        "codigoPais": "XX",
        "justificativa": "Por que é uma surpresa perfeita para este perfil",
        "descricao": "Descrição do destino surpresa",
        "porque": "Razões para ser destino surpresa",
        "destaque": "Experiência única e inesperada",
        "comentario": "Comentário empolgado da Tripinha: 'Nossa, quando cheguei em [destino], não esperava que... 🐾'",
        "pontosTuristicos": [
            "Primeiro ponto específico", 
            "Segundo ponto específico"
        ],
        "clima": {
            "estacao": "Estação durante ${dataIda} a ${dataVolta}",
            "temperatura": "Faixa de temperatura",
            "condicoes": "Condições climáticas",
            "recomendacoes": "Dicas de vestuário"
        },
        "aeroporto": {
            "codigo": "XYZ", 
            "nome": "Nome do Aeroporto"
        }
    },
    "estacaoViagem": "Estação predominante nos destinos selecionados",
    "resumoIA": "Resumo de como a IA chegou às recomendações considerando origem, preferências e orçamento"
}
\`\`\`

## 🔍 VALIDAÇÃO FINAL OBRIGATÓRIA:
Antes de responder, confirme que:
- ✅ Informações climáticas são precisas para o período da viagem  
- ✅ Comentários da Tripinha são autênticos e em 1ª pessoa
- ✅ Pontos turísticos são específicos e reais
- ✅ Códigos IATA dos aeroportos estão corretos
- ✅ Destinos são adequados para ${infoViajante.companhia}
- ✅ Considerou a cidade de origem ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem} nas sugestões

**Execute o raciocínio passo-a-passo e forneça recomendações fundamentadas e personalizadas!**`;
}

// =======================
// Funções auxiliares de texto simplificadas
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
        0: "Relax total – Descansar, aproveitar sem pressa e recarregar as energias",
        1: "Aventura e emoção – Trilhar, explorar e sentir a adrenalina",
        2: "Cultura e história – Mergulhar em tradições, arte e sabores locais", 
        3: "Agito urbano – Ruas movimentadas, vida noturna e muita energia"
    };
    return options[typeof value === 'string' ? parseInt(value, 10) : value] || "experiências diversificadas";
}

// =======================
// 🚗 FUNÇÃO ATUALIZADA: Processamento e validação de destinos para todos os tipos
// =======================
function ensureValidDestinationData(jsonString, requestData) {
    try {
        const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        // 🚗🚌✈️ ATUALIZADO: Incluir viagem_carro
        const tipoViagem = utils.determinarTipoViagem(
            requestData.orcamento_valor, 
            requestData.moeda_escolhida, 
            requestData.viagem_carro
        );
        const isCarro = tipoViagem === 'carro';
        const isRodoviario = tipoViagem === 'rodoviario';
        let modificado = false;
        
        // Processar topPick
        if (data.topPick) {
            if (isCarro) {
                // 🚗 Garantir campos específicos para viagem de carro
                if (!data.topPick.distanciaAproximada) {
                    data.topPick.distanciaAproximada = "Distância não especificada";
                    modificado = true;
                }
                if (!data.topPick.tempoEstimadoViagem) {
                    data.topPick.tempoEstimadoViagem = "Tempo não especificado";
                    modificado = true;
                }
                if (!data.topPick.rotaRecomendada) {
                    data.topPick.rotaRecomendada = `Via rodovias principais até ${data.topPick.destino}`;
                    modificado = true;
                }
                if (!data.topPick.infraestrutura) {
                    data.topPick.infraestrutura = {
                        estacionamento: "Estacionamento disponível na cidade",
                        postos_gasolina: "Postos de gasolina disponíveis no trajeto"
                    };
                    modificado = true;
                }
                // 🌤️ Garantir dados climáticos para viagens de carro
                if (!data.topPick.clima || !data.topPick.clima.temperatura) {
                    data.topPick.clima = {
                        estacao: "Informação climática não disponível",
                        temperatura: "Consulte previsão local",
                        condicoes: "Condições variáveis",
                        recomendacoes: "Verifique previsão do tempo antes da viagem"
                    };
                    modificado = true;
                }
            } else if (isRodoviario) {
                // Garantir terminal de transporte apropriado
                if (!data.topPick.terminalTransporte?.nome) {
                    data.topPick.terminalTransporte = {
                        nome: `Terminal Rodoviário de ${data.topPick.destino}`,
                        tipo: 'rodoviária',
                        localizacao: "Centro"
                    };
                    modificado = true;
                }
            } else {
                // Para viagens aéreas, garantir código IATA
                if (!data.topPick.aeroporto?.codigo) {
                    data.topPick.aeroporto = {
                        codigo: obterCodigoIATAPadrao(data.topPick.destino, data.topPick.pais),
                        nome: `Aeroporto de ${data.topPick.destino}`
                    };
                    modificado = true;
                }
            }
        }
        
        // Processar surpresa
        if (data.surpresa) {
            if (isCarro) {
                // 🚗 Campos específicos para surpresa de carro
                if (!data.surpresa.distanciaAproximada) {
                    data.surpresa.distanciaAproximada = "Distância não especificada";
                    modificado = true;
                }
                if (!data.surpresa.tempoEstimadoViagem) {
                    data.surpresa.tempoEstimadoViagem = "Tempo não especificado";
                    modificado = true;
                }
                if (!data.surpresa.rotaRecomendada) {
                    data.surpresa.rotaRecomendada = `Via rodovias principais até ${data.surpresa.destino}`;
                    modificado = true;
                }
                // 🌤️ Garantir dados climáticos para surpresa de carro
                if (!data.surpresa.clima || !data.surpresa.clima.temperatura) {
                    data.surpresa.clima = {
                        estacao: "Informação climática não disponível",
                        temperatura: "Consulte previsão local",
                        condicoes: "Condições variáveis",
                        recomendacoes: "Verifique previsão do tempo antes da viagem"
                    };
                    modificado = true;
                }
            } else if (isRodoviario) {
                if (!data.surpresa.terminalTransporte?.nome) {
                    data.surpresa.terminalTransporte = {
                        nome: `Terminal Rodoviário de ${data.surpresa.destino}`,
                        tipo: 'rodoviária',
                        localizacao: "Centro"
                    };
                    modificado = true;
                }
            } else {
                if (!data.surpresa.aeroporto?.codigo) {
                    data.surpresa.aeroporto = {
                        codigo: obterCodigoIATAPadrao(data.surpresa.destino, data.surpresa.pais),
                        nome: `Aeroporto de ${data.surpresa.destino}`
                    };
                    modificado = true;
                }
            }
        }
        
        // Processar alternativas
        if (data.alternativas && Array.isArray(data.alternativas)) {
            data.alternativas.forEach(alternativa => {
                if (isCarro) {
                    // 🚗 Campos específicos para alternativas de carro
                    if (!alternativa.distanciaAproximada) {
                        alternativa.distanciaAproximada = "Distância não especificada";
                        modificado = true;
                    }
                    if (!alternativa.tempoEstimadoViagem) {
                        alternativa.tempoEstimadoViagem = "Tempo não especificado";
                        modificado = true;
                    }
                    // 🌤️ Garantir dados climáticos para alternativas de carro
                    if (!alternativa.clima || !alternativa.clima.temperatura) {
                        alternativa.clima = {
                            estacao: "Informação climática não disponível",
                            temperatura: "Consulte previsão local",
                            condicoes: "Condições variáveis"
                        };
                        modificado = true;
                    }
                } else if (isRodoviario) {
                    if (!alternativa.terminalTransporte?.nome) {
                        alternativa.terminalTransporte = {
                            nome: `Terminal Rodoviário de ${alternativa.destino}`
                        };
                        modificado = true;
                    }
                } else {
                    if (!alternativa.aeroporto?.codigo) {
                        alternativa.aeroporto = {
                            codigo: obterCodigoIATAPadrao(alternativa.destino, alternativa.pais),
                            nome: `Aeroporto de ${alternativa.destino}`
                        };
                        modificado = true;
                    }
                }
            });
        }
        
        // Adicionar tipo de viagem se não existir
        if (!data.tipoViagem) {
            data.tipoViagem = tipoViagem;
            modificado = true;
        }
        
        return modificado ? JSON.stringify(data) : jsonString;
    } catch (error) {
        console.error("Erro ao processar dados de destino:", error);
        return jsonString;
    }
}

// =======================
// Função de retry com fallback inteligente entre modelos
// =======================
async function retryWithBackoffAndFallback(prompt, requestData, maxAttempts = CONFIG.retries) {
    const modelOrder = [
        CONFIG.groq.models.reasoning,     // Primeiro: Reasoning model
        CONFIG.groq.models.personality,   // Segundo: Llama 3.3 70B (personalidade)
        CONFIG.groq.models.fast           // Terceiro: Llama 3.1 8B (backup rápido)
    ];
    
    for (const model of modelOrder) {
        console.log(`🔄 Tentando modelo: ${model}`);
        
        let attempt = 1;
        let delay = 1500;
        
        while (attempt <= maxAttempts) {
            try {
                console.log(`🔄 Modelo ${model} - Tentativa ${attempt}/${maxAttempts}...`);
                
                const result = await callGroqAPI(prompt, requestData, model);
                
                if (result && utils.isValidDestinationJSON(result, requestData)) {
                    console.log(`✅ Sucesso com ${model} na tentativa ${attempt}`);
                    return { result, model };
                } else {
                    console.log(`❌ ${model} - Tentativa ${attempt}: resposta inválida`);
                }
                
            } catch (error) {
                console.error(`❌ ${model} - Tentativa ${attempt} falhou:`, error.message);
            }
            
            if (attempt === maxAttempts) {
                console.log(`🚫 ${model}: Todas as ${maxAttempts} tentativas falharam`);
                break;
            }
            
            console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.2, 5000);
            attempt++;
        }
    }
    
    console.log('🚫 Todos os modelos falharam');
    return null;
}

// =======================
// 🚗🚌✈️ HANDLER PRINCIPAL ATUALIZADO
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
    }, 350000); // 350s para acomodar reasoning model

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
        console.log('🚗🚌✈️ === BENETRIP GROQ API v10.1 - CARRO + ÔNIBUS + AVIÃO ===');
        
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
        
        // Extrair informações da cidade de partida (do autocomplete)
        const infoCidadePartida = utils.extrairInfoCidadePartida(requestData.cidade_partida);
        
        // 🚗🚌✈️ ATUALIZADO: Incluir viagem_carro
        const tipoViagem = utils.determinarTipoViagem(
            requestData.orcamento_valor, 
            requestData.moeda_escolhida, 
            requestData.viagem_carro
        );
        const isCarro = tipoViagem === 'carro';
        const isRodoviario = tipoViagem === 'rodoviario';
        
        // Log dos dados recebidos
        utils.log('📊 Dados da requisição:', {
            companhia: requestData.companhia,
            cidade_partida: infoCidadePartida,
            datas: requestData.datas,
            orcamento: requestData.orcamento_valor,
            moeda: requestData.moeda_escolhida,
            preferencia: requestData.preferencia_viagem,
            viagem_carro: requestData.viagem_carro, // 🚗 NOVO
            distancia_maxima: requestData.distancia_maxima, // 🚗 NOVO
            tipoViagem: tipoViagem
        });
        
        console.log(`${isCarro ? '🚗' : isRodoviario ? '🚌' : '✈️'} Tipo de viagem: ${tipoViagem.toUpperCase()}`);
        console.log(`📍 Origem: ${infoCidadePartida.cidade}, ${infoCidadePartida.pais} (${infoCidadePartida.sigla_estado})`);
        
        if (isCarro) {
            console.log('🛣️ Road trip - Limite máximo:', requestData.distancia_maxima || '1500km');
        } else if (isRodoviario) {
            console.log('📏 Limite máximo: 700km ou 10 horas');
        }
        
        // Gerar prompt otimizado para Groq
        const prompt = gerarPromptParaGroq(requestData);
        console.log(`📝 Prompt gerado para Groq (${tipoViagem})`);
        
        // Tentar obter recomendações com fallback inteligente entre modelos
        const resultado = await retryWithBackoffAndFallback(prompt, requestData);
        
        if (!resultado) {
            console.error('🚫 Falha em todos os modelos do Groq');
            if (!isResponseSent) {
                isResponseSent = true;
                clearTimeout(serverTimeout);
                return res.status(503).json({
                    tipo: "erro",
                    message: "Não foi possível obter recomendações no momento. Tente novamente em alguns instantes.",
                    error: "groq_all_models_failed"
                });
            }
            return;
        }
        
        const { result: recomendacoesBrutas, model: modeloUsado } = resultado;
        
        // Processar e retornar resultado
        try {
            const recomendacoesProcessadas = ensureValidDestinationData(recomendacoesBrutas, requestData);
            const dados = typeof recomendacoesProcessadas === 'string' ? 
                JSON.parse(recomendacoesProcessadas) : recomendacoesProcessadas;
            
            // Adicionar metadados incluindo modelo usado e tipo de viagem
            dados.metadados = {
                modelo: modeloUsado,
                provider: 'groq',
                versao: '10.1-carro-completo',
                timestamp: new Date().toISOString(),
                reasoning_enabled: modeloUsado === CONFIG.groq.models.reasoning,
                origem: infoCidadePartida,
                tipoViagem: tipoViagem,
                orcamento: requestData.orcamento_valor,
                moeda: requestData.moeda_escolhida,
                viagem_carro: requestData.viagem_carro, // 🚗 NOVO
                distancia_maxima: requestData.distancia_maxima, // 🚗 NOVO
                limiteRodoviario: isRodoviario ? '700km/10h' : null,
                limiteCarro: isCarro ? (requestData.distancia_maxima || '1500km') : null // 🚗 NOVO
            };
            
            console.log('🎉 Recomendações processadas com sucesso!');
            console.log('🧠 Modelo usado:', modeloUsado);
            console.log(`${isCarro ? '🚗' : isRodoviario ? '🚌' : '✈️'} Tipo de viagem:`, tipoViagem);
            console.log('📍 Origem:', `${infoCidadePartida.cidade}, ${infoCidadePartida.pais}`);
            
            if (isCarro) {
                console.log('🛣️ Limite road trip:', requestData.distancia_maxima || '1500km');
            }
            
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
                    modelo: modeloUsado,
                    tipoViagem: tipoViagem,
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
                    modelo: modeloUsado,
                    tipoViagem: tipoViagem,
                    conteudo: recomendacoesBrutas
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
    }
};
