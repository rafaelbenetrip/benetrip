// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
// Versão 11.0 - SUPORTE COMPLETO A VIAGENS DE CARRO
// Agora com três tipos: AÉREO + RODOVIÁRIO + CARRO
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

    // Determinar tipo de viagem baseado nas respostas do usuário
    determinarTipoViagem: (requestData) => {
        // 1. PRIMEIRO: Verificar se o usuário escolheu viajar de carro
        if (requestData.viagem_carro !== undefined) {
            const viagemCarro = parseInt(requestData.viagem_carro);
            if (viagemCarro === 0) { // 0 = Sim, quer viajar de carro
                return 'carro';
            }
            // Se chegou aqui, o usuário escolheu NÃO viajar de carro (valor 1)
            // Então vamos para a lógica de orçamento para aéreo vs rodoviário
        }

        // 2. SEGUNDO: Lógica de orçamento para aéreo vs rodoviário
        const orcamento = requestData.orcamento_valor;
        const moeda = requestData.moeda_escolhida;
        
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

    const tipoViagem = utils.determinarTipoViagem(requestData);
    const infoCidadePartida = utils.extrairInfoCidadePartida(requestData.cidade_partida);

    let systemMessage;
    
    if (model === CONFIG.groq.models.reasoning) {
        // Sistema otimizado para reasoning
        systemMessage = `Você é um sistema especialista em recomendações de viagem que utiliza raciocínio estruturado.
${tipoViagem === 'rodoviario' ? `ESPECIALIZADO EM VIAGENS RODOVIÁRIAS (ÔNIBUS/TREM) COM LIMITE DE 700KM OU 10 HORAS.` : 
  tipoViagem === 'carro' ? `ESPECIALIZADO EM VIAGENS DE CARRO COM LIMITE DEFINIDO PELO USUÁRIO.` : ''}

PROCESSO DE RACIOCÍNIO OBRIGATÓRIO:
1. ANÁLISE DO PERFIL: Examine detalhadamente cada preferência do viajante
2. MAPEAMENTO DE COMPATIBILIDADE: Correlacione destinos com o perfil analisado  
3. CONSIDERAÇÃO DE TRANSPORTE: ${
    tipoViagem === 'rodoviario' ? `Considere viagens de ÔNIBUS/TREM dentro do orçamento para passagens de ida e volta (máx 700km/10h)` : 
    tipoViagem === 'carro' ? `Considere viagens de CARRO dentro da distância máxima definida pelo usuário` :
    'Considere o orçamento informado para passagens aéreas'
}
4. ANÁLISE CLIMÁTICA: Determine condições climáticas exatas para as datas
5. PERSONALIZAÇÃO TRIPINHA: Adicione perspectiva autêntica da mascote cachorrinha

CRITÉRIOS DE DECISÃO:
- Destinos DEVEM ser adequados para o tipo de companhia especificado
- ${tipoViagem === 'rodoviario' ? `Destinos DEVEM estar NO MÁXIMO 700km ou 10 horas de viagem terrestre da origem` : 
    tipoViagem === 'carro' ? `Destinos DEVEM estar dentro da distância máxima de carro definida pelo usuário` :
    'Informações de voos DEVEM ser consideradas'}
- Informações climáticas DEVEM ser precisas para o período da viagem
- Pontos turísticos DEVEM ser específicos e reais
- Comentários da Tripinha DEVEM ser em 1ª pessoa com detalhes sensoriais
- Considere a distância e facilidade de acesso a partir da cidade de origem

RESULTADO: JSON estruturado com recomendações fundamentadas no raciocínio acima.`;
    } else if (model === CONFIG.groq.models.personality) {
        // Sistema focado na personalidade da Tripinha
        systemMessage = `Você é a Tripinha, uma vira-lata caramelo especialista em viagens! 🐾
${tipoViagem === 'rodoviario' ? `ESPECIALISTA EM VIAGENS DE ÔNIBUS/TREM DE ATÉ 700KM!` : 
  tipoViagem === 'carro' ? `ESPECIALISTA EM VIAGENS DE CARRO E ROAD TRIPS!` :
  'ESPECIALISTA EM VIAGENS AÉREAS!'}

PERSONALIDADE DA TRIPINHA:
- Conhece todos os destinos do mundo pessoalmente
- ${tipoViagem === 'rodoviario' ? `Adora viagens de ônibus e trem!` : 
    tipoViagem === 'carro' ? `Adora colocar a cabeça pra fora da janela em road trips!` :
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
            tipoViagem === 'rodoviario' ? `RODOVIÁRIA (máx 700km)` : 
            tipoViagem === 'carro' ? `DE CARRO` :
            'AÉREA'
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
// Geração de prompt otimizado para os 3 tipos de viagem
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
        viagemCarro: dados.viagem_carro,
        distanciaMaxima: dados.distancia_maxima
    };
    
    // Determinar tipo de viagem baseado nas respostas
    const tipoViagem = utils.determinarTipoViagem(dados);
    
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

    // PROMPT ESPECÍFICO PARA VIAGENS DE CARRO
    if (tipoViagem === 'carro') {
        return `# 🚗 SISTEMA DE RECOMENDAÇÃO INTELIGENTE DE VIAGENS DE CARRO

## 📊 DADOS DO VIAJANTE PARA ANÁLISE:
**Perfil Básico:**
- Origem: ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem}
- Estado/Região: ${infoViajante.siglaEstado}
- Composição: ${infoViajante.companhia} (${infoViajante.pessoas} pessoa(s))
- Período: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Preferência principal: ${infoViajante.preferencia}

## 🛣️ LIMITAÇÕES DA VIAGEM DE CARRO:
**Distância máxima informada pelo usuário:** ${infoViajante.distanciaMaxima || 300} quilômetros (ida)
**Foco em road trips e roteiros rodoviários**

⚠️ **IMPORTANTES LIMITES PARA VIAGEM DE CARRO:**
- **DISTÂNCIA MÁXIMA: ${infoViajante.distanciaMaxima || 300} QUILÔMETROS da cidade de origem (${infoViajante.cidadeOrigem})**
- Considere o conforto da viagem de carro para ${infoViajante.companhia}
- Sugira destinos acessíveis por estradas em boas condições
- Considere paradas interessantes no caminho
- NÃO sugira destinos em outros países para distâncias grandes

## 🎯 PROCESSO DE RACIOCÍNIO PARA VIAGEM DE CARRO:

### PASSO 1: ANÁLISE GEOGRÁFICA E RODOVIÁRIA
- Partir de ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem}
- Mapear destinos dentro do raio de ${infoViajante.distanciaMaxima || 300}km
- Considerar rodovias principais e estradas cênicas
- Avaliar facilidade de acesso e qualidade das estradas

### PASSO 2: MAPEAMENTO DE ROTEIROS (MÁXIMO ${infoViajante.distanciaMaxima || 300}KM)
- Destinos acessíveis por carro em até ${infoViajante.distanciaMaxima || 300}km
- Roteiros cênicos e estradas interessantes
- Paradas obrigatórias no caminho
- Postos de combustível e infraestrutura

### PASSO 3: SELEÇÃO DE DESTINOS PARA ROAD TRIP
Selecione APENAS destinos dentro do limite de ${infoViajante.distanciaMaxima || 300}km:
- 1 destino TOP acessível de carro (máx ${infoViajante.distanciaMaxima || 300}km)
- 4 alternativas para road trip diversificadas (todas ≤ ${infoViajante.distanciaMaxima || 300}km)
- 1 surpresa road trip inusitada (máx ${infoViajante.distanciaMaxima || 300}km)

## 📋 FORMATO DE RESPOSTA (JSON ESTRUTURADO):
\`\`\`json
{
  "tipoViagem": "carro",
  "origem": {
    "cidade": "${infoViajante.cidadeOrigem}",
    "pais": "${infoViajante.paisOrigem}",
    "sigla_estado": "${infoViajante.siglaEstado}",
    "iata": "${infoViajante.iataOrigem}"
  },
  "parametrosViagem": {
    "distanciaMaxima": "${infoViajante.distanciaMaxima || 300}km",
    "tipoTransporte": "carro"
  },
  "raciocinio": {
    "analise_perfil": "Análise considerando viagem de carro até ${infoViajante.distanciaMaxima || 300}km",
    "roteiros_considerados": "Principais roteiros rodoviários analisados (todos ≤ ${infoViajante.distanciaMaxima || 300}km)",
    "criterios_selecao": "Critérios para destinos acessíveis de carro"
  },
  "topPick": {
    "destino": "Nome da Cidade",
    "estado": "Nome do Estado/Região",
    "pais": "Nome do País",
    "codigoPais": "BR",
    "distanciaCarro": "XXX km",
    "tempoViagem": "X horas",
    "rodoviaPrincipal": "Nome da rodovia (ex: BR-101, SP-055)",
    "justificativa": "Por que este destino é PERFEITO para viagem de carro",
    "descricao": "Descrição do destino",
    "porque": "Razões específicas",
    "destaque": "Experiência única",
    "comentario": "Comentário da Tripinha em 1ª pessoa sobre a road trip",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"],
    "paradasNoCAMINHO": ["Parada interessante 1", "Parada interessante 2"],
    "dicasRoadTrip": ["Dica 1 para viagem de carro", "Dica 2"],
    "clima": {
      "estacao": "Estação durante a viagem",
      "temperatura": "Faixa de temperatura",
      "condicoes": "Condições climáticas",
      "recomendacoes": "O que levar"
    },
    "infoEstrada": {
      "condicoes": "boas/regulares/ruins",
      "pedagios": "sim/não",
      "paisagem": "descrição da paisagem no caminho"
    }
  },
  "alternativas": [
    // 4 alternativas com estrutura similar, todas dentro de ${infoViajante.distanciaMaxima || 300}km
  ],
  "surpresa": {
    // Estrutura similar ao topPick
  },
  "dicasGeraisRoadTrip": "Dicas gerais para viagens de carro confortáveis",
  "resumoIA": "Como foram selecionados os destinos de carro"
}
\`\`\`

⚠️ **VALIDAÇÃO CRÍTICA:**
- TODOS os destinos DEVEM estar a NO MÁXIMO ${infoViajante.distanciaMaxima || 300}km de ${infoViajante.cidadeOrigem}
- NÃO sugira destinos inacessíveis de carro
- Considere sempre a qualidade das estradas

**Execute o raciocínio e forneça destinos DE CARRO APROPRIADOS!**`;
    }

    // Prompt para viagens rodoviárias (ônibus/trem)
    if (tipoViagem === 'rodoviario') {
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
  "topPick": {
    "destino": "Nome da Cidade",
    "estado": "Nome do Estado/Região", 
    "pais": "Nome do País",
    "codigoPais": "XX",
    "distanciaRodoviaria": "XXX km",
    "tempoViagem": "X horas",
    "tipoTransporte": "ônibus/trem",
    "terminalTransporte": {
      "nome": "Nome do Terminal/Estação",
      "tipo": "rodoviária/estação ferroviária",
      "localizacao": "Bairro/Região"
    }
  }
}
\`\`\`

Execute o raciocínio e forneça destinos TERRESTRES APROPRIADOS!`;
    }

    // Prompt padrão para viagens aéreas
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

Execute o raciocínio passo-a-passo e forneça recomendações fundamentadas e personalizadas para viagens AÉREAS!`;
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
        0: "Relax total – Descansar, aproveitar sem pressa e recarregar as energias",
        1: "Aventura e emoção – Trilhar, explorar e sentir a adrenalina",
        2: "Cultura e história – Mergulhar em tradições, arte e sabores locais", 
        3: "Agito urbano – Ruas movimentadas, vida noturna e muita energia"
    };
    return options[typeof value === 'string' ? parseInt(value, 10) : value] || "experiências diversificadas";
}

// =======================
// Processamento e validação de destinos para os 3 tipos
// =======================
function ensureValidDestinationData(jsonString, requestData) {
    try {
        const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        const tipoViagem = utils.determinarTipoViagem(requestData);
        let modificado = false;
        
        // Processar topPick
        if (data.topPick) {
            if (tipoViagem === 'carro') {
                // Garantir informações de estrada e distância
                if (!data.topPick.distanciaCarro && !data.topPick.tempoViagem) {
                    data.topPick.distanciaCarro = `${requestData.distancia_maxima || 300}km`;
                    data.topPick.tempoViagem = "3-4 horas";
                    modificado = true;
                }
                if (!data.topPick.rodoviaPrincipal) {
                    data.topPick.rodoviaPrincipal = `Rodovia para ${data.topPick.destino}`;
                    modificado = true;
                }
            } else if (tipoViagem === 'rodoviario') {
                // Garantir terminal de transporte
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
            if (tipoViagem === 'carro') {
                if (!data.surpresa.distanciaCarro) {
                    data.surpresa.distanciaCarro = `${requestData.distancia_maxima || 300}km`;
                    modificado = true;
                }
            } else if (tipoViagem === 'rodoviario') {
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
                if (tipoViagem === 'carro') {
                    if (!alternativa.distanciaCarro) {
                        alternativa.distanciaCarro = `${requestData.distancia_maxima || 300}km`;
                        modificado = true;
                    }
                } else if (tipoViagem === 'rodoviario') {
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
        console.log('🚗🚌✈️ === BENETRIP GROQ API v11.0 - SUPORTE COMPLETO A CARRO ===');
        
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
        
        // Determinar tipo de viagem (agora com suporte a carro)
        const tipoViagem = utils.determinarTipoViagem(requestData);
        
        // Log dos dados recebidos
        utils.log('📊 Dados da requisição:', {
            companhia: requestData.companhia,
            cidade_partida: infoCidadePartida,
            datas: requestData.datas,
            orcamento: requestData.orcamento_valor,
            moeda: requestData.moeda_escolhida,
            preferencia: requestData.preferencia_viagem,
            viagem_carro: requestData.viagem_carro,
            distancia_maxima: requestData.distancia_maxima,
            tipoViagem: tipoViagem
        });
        
        console.log(`${tipoViagem === 'carro' ? '🚗' : tipoViagem === 'rodoviario' ? '🚌' : '✈️'} Tipo de viagem: ${tipoViagem.toUpperCase()}`);
        console.log(`📍 Origem: ${infoCidadePartida.cidade}, ${infoCidadePartida.pais} (${infoCidadePartida.sigla_estado})`);
        
        if (tipoViagem === 'carro') {
            console.log(`🛣️ Distância máxima de carro: ${requestData.distancia_maxima || 300}km`);
        } else if (tipoViagem === 'rodoviario') {
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
                versao: '11.0-suporte-carro',
                timestamp: new Date().toISOString(),
                reasoning_enabled: modeloUsado === CONFIG.groq.models.reasoning,
                origem: infoCidadePartida,
                tipoViagem: tipoViagem,
                orcamento: requestData.orcamento_valor,
                moeda: requestData.moeda_escolhida,
                viagemCarro: requestData.viagem_carro,
                distanciaMaxima: requestData.distancia_maxima,
                limiteRodoviario: tipoViagem === 'rodoviario' ? '700km/10h' : null,
                limiteCarro: tipoViagem === 'carro' ? `${requestData.distancia_maxima || 300}km` : null
            };
            
            console.log('🎉 Recomendações processadas com sucesso!');
            console.log('🧠 Modelo usado:', modeloUsado);
            console.log(`${tipoViagem === 'carro' ? '🚗' : tipoViagem === 'rodoviario' ? '🚌' : '✈️'} Tipo de viagem:`, tipoViagem);
            console.log('📍 Origem:', `${infoCidadePartida.cidade}, ${infoCidadePartida.pais}`);
            
            if (tipoViagem === 'carro') {
                console.log('🛣️ Distância máxima:', `${requestData.distancia_maxima || 300}km`);
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
