// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
// Versão 11.0 - SUPORTE A VIAGENS DE CARRO
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

    // Determinar tipo de viagem baseado no orçamento e preferência
    determinarTipoViagem: (orcamento, moeda, viagemCarro) => {
        // Prioridade máxima: se o usuário escolheu viajar de carro
        if (viagemCarro === 1) {
            return 'carro';
        }
        
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

    const tipoViagem = utils.determinarTipoViagem(requestData.orcamento_valor, requestData.moeda_escolhida, requestData.viagem_carro);
    const infoCidadePartida = utils.extrairInfoCidadePartida(requestData.cidade_partida);

    let systemMessage;
    
    if (model === CONFIG.groq.models.reasoning) {
        // Sistema otimizado para reasoning
        systemMessage = `Você é um sistema especialista em recomendações de viagem que utiliza raciocínio estruturado.
${tipoViagem === 'rodoviario' ? `ESPECIALIZADO EM VIAGENS RODOVIÁRIAS (ÔNIBUS/TREM) COM LIMITE DE 700KM OU 10 HORAS.` : ''}
${tipoViagem === 'carro' ? `ESPECIALIZADO EM VIAGENS DE CARRO (ROAD TRIPS).` : ''}

PROCESSO DE RACIOCÍNIO OBRIGATÓRIO:
1. ANÁLISE DO PERFIL: Examine detalhadamente cada preferência do viajante
2. MAPEAMENTO DE COMPATIBILIDADE: Correlacione destinos com o perfil analisado  
3. CONSIDERAÇÃO DE ORÇAMENTO/DISTÂNCIA: ${tipoViagem === 'rodoviario' ? `Considere viagens de ÔNIBUS/TREM dentro do orçamento para passagens de ida e volta (máx 700km/10h)` : tipoViagem === 'carro' ? `Considere a DISTÂNCIA MÁXIMA informada para a road trip.` : 'Considere o orçamento informado para passagens aéreas'}
4. ANÁLISE CLIMÁTICA: Determine condições climáticas exatas para as datas
5. PERSONALIZAÇÃO TRIPINHA: Adicione perspectiva autêntica da mascote cachorrinha

CRITÉRIOS DE DECISÃO:
- Destinos DEVEM ser adequados para o tipo de companhia especificado
- ${tipoViagem === 'rodoviario' ? `Destinos DEVEM estar NO MÁXIMO 700km ou 10 horas de viagem terrestre da origem` : tipoViagem === 'carro' ? `Destinos DEVEM estar DENTRO DO RAIO DE DISTÂNCIA informado.` : 'Informações de voos DEVEM ser consideradas'}
- Informações climáticas DEVEM ser precisas para o período da viagem
- Pontos turísticos DEVEM ser específicos e reais
- Comentários da Tripinha DEVEM ser em 1ª pessoa com detalhes sensoriais
- Considere a distância e facilidade de acesso a partir da cidade de origem

RESULTADO: JSON estruturado com recomendações fundamentadas no raciocínio acima.`;
    } else {
        // Sistema padrão para outros modelos
        systemMessage = `Você é um especialista em recomendações de viagem. Retorne apenas JSON válido com destinos personalizados para o tipo de viagem: ${tipoViagem.toUpperCase()}.`;
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
// Geração de prompt otimizado usando dados do autocomplete
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
        pessoas: dados.quantidade_familia || dados.quantidade_amigos || 1
    };
    
    // Determinar tipo de viagem
    const tipoViagem = utils.determinarTipoViagem(infoViajante.orcamento, infoViajante.moeda, dados.viagem_carro);
    const isRodoviario = tipoViagem === 'rodoviario';
    const isCarro = tipoViagem === 'carro';
    
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

    // NOVO: Prompt para Viagens de Carro
    if (isCarro) {
        const distanciaMaxima = dados.distancia_maxima || 500;
        return `# 🚗 SISTEMA DE RECOMENDAÇÃO INTELIGENTE DE VIAGENS DE CARRO

## 📊 DADOS DO VIAJANTE PARA ANÁLISE:
- Origem: ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem}
- Composição: ${infoViajante.companhia} (${infoViajante.pessoas} pessoa(s))
- Período: ${dataIda} a ${dataVolta} (${duracaoViagem})
- Preferência principal: ${infoViajante.preferencia}

## 🛣️ LIMITES DA ROAD TRIP:
- **DISTÂNCIA MÁXIMA: ${distanciaMaxima} QUILÔMETROS da cidade de origem (${infoViajante.cidadeOrigem})**
- Sugira destinos que sejam agradáveis para uma road trip, considerando a infraestrutura rodoviária e atrações no caminho.

## 🎯 PROCESSO DE RACIOCÍNIO PARA VIAGEM DE CARRO:
- **PASSO 1: ANÁLISE GEOGRÁFICA**: Partir de ${infoViajante.cidadeOrigem} e listar cidades turísticas interessantes dentro do raio de ${distanciaMaxima} km.
- **PASSO 2: SELEÇÃO DE DESTINOS**: Escolher destinos que combinem com o perfil do viajante (${infoViajante.preferencia}) e sejam bons para chegar de carro (infraestrutura, estacionamento, etc.).
- **PASSO 3: FORMATO DE RESPOSTA**: Gerar um JSON estruturado com as informações da viagem de carro.

## 📋 FORMATO DE RESPOSTA (JSON ESTRUTURADO):
\`\`\`json
{
  "tipoViagem": "carro",
  "origem": { "cidade": "${infoViajante.cidadeOrigem}", "pais": "${infoViajante.paisOrigem}" },
  "raciocinio": {
    "analise_perfil": "Análise focada em road trip, considerando a preferência por ${infoViajante.preferencia}.",
    "rotas_consideradas": "Principais rotas e destinos dentro do limite de ${distanciaMaxima}km de ${infoViajante.cidadeOrigem}.",
    "criterios_selecao": "Critérios como atratividade, infraestrutura para carros e adequação ao perfil."
  },
  "topPick": {
    "destino": "Nome da Cidade",
    "estado": "Nome do Estado/Região",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "distanciaAproximada": "XXX km",
    "tempoEstimadoViagem": "X horas",
    "justificativa": "Por que este destino é perfeito para uma road trip a partir de ${infoViajante.cidadeOrigem}",
    "descricao": "Descrição do destino focada em viajantes de carro",
    "porque": "Razões específicas para a recomendação",
    "destaque": "Uma experiência única no destino ou na estrada",
    "comentario": "Comentário da Tripinha em 1ª pessoa sobre a viagem de carro para lá",
    "pontosTuristicos": ["Ponto Turístico 1", "Ponto Turístico 2"],
    "clima": {
      "estacao": "Estação durante a viagem",
      "temperatura": "Faixa de temperatura",
      "condicoes": "Condições climáticas esperadas",
      "recomendacoes": "O que levar para uma viagem de carro"
    }
  },
  "alternativas": [
    {
      "destino": "Nome da Cidade",
      "estado": "Nome do Estado/Região",
      "pais": "Nome do País",
      "codigoPais": "XX",
      "distanciaAproximada": "XXX km",
      "tempoEstimadoViagem": "X horas",
      "porque": "Razão para esta alternativa de road trip",
      "pontoTuristico": "Ponto turístico principal",
      "clima": { "temperatura": "Faixa de temperatura" }
    }
  ],
  "surpresa": {
    "destino": "Nome da Cidade Surpresa",
    "estado": "Nome do Estado/Região",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "distanciaAproximada": "XXX km",
    "tempoEstimadoViagem": "X horas",
    "justificativa": "Por que é uma surpresa perfeita para este perfil de viajante de carro",
    "comentario": "Comentário da Tripinha sobre esta road trip inesperada",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"],
    "clima": { "temperatura": "Faixa de temperatura" }
  },
  "resumoIA": "Como foram selecionados os destinos de carro dentro do limite de ${distanciaMaxima}km."
}
\`\`\`

⚠️ **VALIDAÇÃO CRÍTICA:**
- TODOS os destinos DEVEM estar a NO MÁXIMO ${distanciaMaxima}km de ${infoViajante.cidadeOrigem}.
- Forneça estimativas realistas de distância e tempo de viagem.

**Execute o raciocínio e forneça destinos de CARRO apropriados!**`;
    }

    // Prompt para viagens rodoviárias (Ônibus/Trem)
    if (isRodoviario) {
        return `# 🚌 SISTEMA DE RECOMENDAÇÃO INTELIGENTE DE VIAGENS RODOVIÁRIAS

## 📊 DADOS DO VIAJANTE PARA ANÁLISE:
- Origem: ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem}
- Orçamento: ${infoViajante.orcamento} ${infoViajante.moeda} por pessoa para passagens de ÔNIBUS/TREM (ida e volta)
- Perfil: ${infoViajante.companhia}, ${infoViajante.preferencia}

⚠️ **LIMITES DA VIAGEM TERRESTRE:**
- **DISTÂNCIA MÁXIMA: 700 QUILÔMETROS de ${infoViajante.cidadeOrigem}**
- **TEMPO MÁXIMO DE VIAGEM: 10 HORAS**

## 📋 FORMATO DE RESPOSTA (JSON ESTRUTURADO):
\`\`\`json
{
  "tipoViagem": "rodoviario",
  "topPick": {
    "destino": "Nome da Cidade",
    "estado": "Nome do Estado",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "distanciaRodoviaria": "XXX km",
    "tempoViagem": "X horas",
    "tipoTransporte": "ônibus/trem",
    "justificativa": "Justificativa da escolha para viagem terrestre",
    "comentario": "Comentário da Tripinha sobre a viagem de ônibus/trem",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"],
    "clima": { /* ... */ }
  },
  "alternativas": [ /* 4 alternativas */ ],
  "surpresa": { /* ... */ }
}
\`\`\`
⚠️ **VALIDAÇÃO CRÍTICA:**
- TODOS os destinos DEVEM estar a NO MÁXIMO 700km de ${infoViajante.cidadeOrigem}.
- Forneça estimativas de distância e tempo de viagem terrestre.`;
    }

    // Prompt padrão para viagens aéreas
    return `# ✈️ SISTEMA DE RECOMENDAÇÃO INTELIGENTE DE DESTINOS AÉREOS

## 📊 DADOS DO VIAJANTE PARA ANÁLISE:
- Origem: ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem} (Aeroporto: ${infoViajante.iataOrigem})
- Orçamento: ${infoViajante.orcamento} ${infoViajante.moeda} por pessoa para passagens aéreas (ida e volta)
- Perfil: ${infoViajante.companhia}, ${infoViajante.preferencia}

## 💰 CONSIDERAÇÕES DE ORÇAMENTO:
${infoViajante.orcamento !== 'flexível' ? `- Considere destinos com passagens aéreas dentro do orçamento de ${infoViajante.orcamento} ${infoViajante.moeda}.` : '- Orçamento flexível, sugira opções variadas.'}

## 📋 FORMATO DE RESPOSTA (JSON ESTRUTURADO):
\`\`\`json
{
    "tipoViagem": "aereo",
    "topPick": {
        "destino": "Nome da Cidade",
        "pais": "Nome do País", 
        "codigoPais": "XX",
        "justificativa": "Justificativa da escolha para viagem aérea",
        "comentario": "Comentário da Tripinha sobre a viagem de avião",
        "pontosTuristicos": ["Ponto 1", "Ponto 2"],
        "aeroporto": {
            "codigo": "XYZ",
            "nome": "Nome do aeroporto"
        },
        "clima": { /* ... */ }
    },
    "alternativas": [ /* 4 alternativas com aeroporto */ ],
    "surpresa": { /* com aeroporto */ }
}
\`\`\`
## 🔍 VALIDAÇÃO FINAL OBRIGATÓRIA:
- Códigos IATA dos aeroportos devem estar corretos.
- Informações climáticas devem ser precisas para o período da viagem.`;
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
// Processamento e validação de destinos
// =======================
function ensureValidDestinationData(jsonString, requestData) {
    try {
        const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        const tipoViagem = utils.determinarTipoViagem(requestData.orcamento_valor, requestData.moeda_escolhida, requestData.viagem_carro);
        let modificado = false;
        
        const processarDestino = (destino) => {
            if (!destino) return;
            
            if (tipoViagem === 'aereo' && !destino.aeroporto?.codigo) {
                destino.aeroporto = {
                    codigo: obterCodigoIATAPadrao(destino.destino, destino.pais),
                    nome: `Aeroporto de ${destino.destino}`
                };
                modificado = true;
            }
        };

        processarDestino(data.topPick);
        processarDestino(data.surpresa);
        if (data.alternativas && Array.isArray(data.alternativas)) {
            data.alternativas.forEach(processarDestino);
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
        console.log('🚗🚌✈️ === BENETRIP GROQ API v11.0 - SUPORTE A CARRO ===');
        
        if (!req.body) {
            isResponseSent = true;
            clearTimeout(serverTimeout);
            return res.status(400).json({ error: "Nenhum dado fornecido na requisição" });
        }
        
        const requestData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        
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
        
        const infoCidadePartida = utils.extrairInfoCidadePartida(requestData.cidade_partida);
        const tipoViagem = utils.determinarTipoViagem(requestData.orcamento_valor, requestData.moeda_escolhida, requestData.viagem_carro);
        
        utils.log('📊 Dados da requisição:', {
            cidade_partida: infoCidadePartida,
            tipoViagem: tipoViagem,
            distancia_maxima: requestData.distancia_maxima, // Log da nova informação
            orcamento: requestData.orcamento_valor,
            moeda: requestData.moeda_escolhida,
        });
        
        console.log(`📍 Origem: ${infoCidadePartida.cidade}, ${infoCidadePartida.pais}`);
        const emoji = tipoViagem === 'carro' ? '🚗' : tipoViagem === 'rodoviario' ? '🚌' : '✈️';
        console.log(`${emoji} Tipo de viagem: ${tipoViagem.toUpperCase()}`);
        
        const prompt = gerarPromptParaGroq(requestData);
        console.log(`📝 Prompt gerado para Groq (${tipoViagem})`);
        
        const resultado = await retryWithBackoffAndFallback(prompt, requestData);
        
        if (!resultado) {
            console.error('🚫 Falha em todos os modelos do Groq');
            if (!isResponseSent) {
                isResponseSent = true;
                clearTimeout(serverTimeout);
                return res.status(503).json({
                    tipo: "erro",
                    message: "Não foi possível obter recomendações no momento. Tente novamente.",
                    error: "groq_all_models_failed"
                });
            }
            return;
        }
        
        const { result: recomendacoesBrutas, model: modeloUsado } = resultado;
        
        try {
            const recomendacoesProcessadas = ensureValidDestinationData(recomendacoesBrutas, requestData);
            const dados = typeof recomendacoesProcessadas === 'string' ? 
                JSON.parse(recomendacoesProcessadas) : recomendacoesProcessadas;
            
            dados.metadados = {
                modelo: modeloUsado,
                provider: 'groq',
                versao: '11.0-carro',
                timestamp: new Date().toISOString(),
                origem: infoCidadePartida,
                tipoViagem: tipoViagem,
            };
            
            console.log('🎉 Recomendações processadas com sucesso!');
            console.log('🧠 Modelo usado:', modeloUsado);
            
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
