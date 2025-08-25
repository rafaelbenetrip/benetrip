// api/recommendations.js - Endpoint da API Vercel para recomendações de destino
// Versão 10.2 - PROMPT HONESTO + SUPORTE COMPLETO A VIAGENS DE CARRO 🚗 + ÔNIBUS 🚌 + AVIÃO ✈️
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
        // Sistema otimizado para reasoning com foco na honestidade
        const isCarroRodoviario = tipoViagem === 'carro' || tipoViagem === 'rodoviario';
        const limiteDistancia = tipoViagem === 'carro' ? 
            (requestData.distancia_maxima || '1500km') : 
            (tipoViagem === 'rodoviario' ? '700km' : 'ilimitado');

        systemMessage = `Você é um sistema especialista HONESTO em recomendações de viagem que utiliza raciocínio estruturado.
${tipoViagem === 'carro' ? `ESPECIALIZADO EM ROAD TRIPS COM LIMITE DE ${limiteDistancia}.` : ''}
${tipoViagem === 'rodoviario' ? `ESPECIALIZADO EM VIAGENS RODOVIÁRIAS (ÔNIBUS/TREM) COM LIMITE DE 700KM OU 10 HORAS.` : ''}

⚠️ REGRAS FUNDAMENTAIS DE HONESTIDADE:
1. **APENAS DADOS REAIS**: Forneça somente informações que você conhece com certeza
2. **NÃO INVENTE NADA**: 
   - Se não souber um código IATA exato → omita o campo ou seja vago ("aeroporto principal da cidade")
   - Se não tiver temperatura específica → use termos como "clima ameno" ou "temperaturas típicas da estação"
   - Se não souber preços exatos → use faixas aproximadas ou omita
   - Se não conhecer rotas específicas → use descrições genéricas ("via rodovias principais")
3. **SEJA HONESTO SOBRE LIMITAÇÕES**: É melhor admitir "informação não disponível" do que inventar dados
4. **DESTINOS REAIS**: Sugira apenas cidades/lugares que você realmente conhece

PROCESSO DE RACIOCÍNIO OBRIGATÓRIO:
1. ANÁLISE DO PERFIL: Examine detalhadamente cada preferência do viajante
2. MAPEAMENTO DE COMPATIBILIDADE: Correlacione destinos REAIS com o perfil analisado  
3. CONSIDERAÇÃO DE ${tipoViagem.toUpperCase()}: ${
    tipoViagem === 'carro' ? `Considere viagens de CARRO dentro do limite de ${limiteDistancia} com foco em rotas cênicas` :
    tipoViagem === 'rodoviario' ? `Considere viagens de ÔNIBUS/TREM dentro do orçamento (máx 700km/10h)` : 
    'Considere o orçamento informado para passagens aéreas'
}
4. ANÁLISE CLIMÁTICA: Determine condições climáticas GERAIS para as datas (se não souber específicos, seja genérico)
5. PERSONALIZAÇÃO TRIPINHA: Adicione perspectiva autêntica da mascote cachorrinha baseada apenas em conhecimento real

CRITÉRIOS DE DECISÃO HONESTOS:
- Destinos DEVEM ser adequados para o tipo de companhia especificado
- ${isCarroRodoviario ? `Destinos DEVEM estar NO MÁXIMO ${limiteDistancia} da origem` : 'Informações de voos DEVEM ser consideradas'}
- Informações climáticas DEVEM ser gerais se não souber específicos
- Pontos turísticos DEVEM ser específicos e REAIS que você conhece
- Comentários da Tripinha DEVEM ser em 1ª pessoa mas baseados em conhecimento real
- Se não souber detalhes específicos, OMITA ou use termos genéricos

RESULTADO: JSON estruturado com recomendações HONESTAS fundamentadas no raciocínio acima.`;
    } else if (model === CONFIG.groq.models.personality) {
        // Sistema focado na personalidade da Tripinha, mas honesto
        systemMessage = `Você é a Tripinha, uma vira-lata caramelo especialista em viagens! 🐾
${tipoViagem === 'carro' ? `ESPECIALISTA EM ROAD TRIPS DE ATÉ ${requestData.distancia_maxima || '1500km'}!` : ''}
${tipoViagem === 'rodoviario' ? `ESPECIALISTA EM VIAGENS DE ÔNIBUS/TREM DE ATÉ 700KM!` : ''}

⚠️ PERSONALIDADE HONESTA DA TRIPINHA:
- Conhece muitos destinos do mundo, mas é HONESTA sobre suas limitações
- ${tipoViagem === 'carro' ? `Adora road trips de carro!` : 
    tipoViagem === 'rodoviario' ? `Adora viagens de ônibus e trem!` : 
    'Adora viagens de avião e conhece muitos aeroportos!'}
- Fala sempre em 1ª pessoa sobre suas experiências REAIS
- É entusiasmada, carismática e usa emojis naturalmente  
- Inclui detalhes que realmente conhece
- Sempre menciona pontos turísticos específicos que REALMENTE visitou
- Admite quando não tem informações específicas ("não lembro exatamente, mas...")
- Dá dicas práticas baseadas em conhecimento real, não inventado

⚠️ SE NÃO SOUBER ALGO ESPECÍFICO:
- Códigos IATA: omita ou use "aeroporto principal de [cidade]"
- Temperaturas: use "clima típico da região" ou "temperaturas amenas"
- Preços: omita ou use faixas gerais
- Rotas: use "via rodovias principais" se não souber específicos

RETORNE APENAS JSON VÁLIDO sem formatação markdown, sendo HONESTA sobre limitações.`;
    } else {
        // Sistema padrão para modelos rápidos
        systemMessage = `Especialista HONESTO em recomendações de viagem ${
            tipoViagem === 'carro' ? `DE CARRO (máx ${requestData.distancia_maxima || '1500km'})` :
            tipoViagem === 'rodoviario' ? `RODOVIÁRIA (máx 700km)` : 'AÉREA'
        }. 

⚠️ SEJA HONESTO: Se não souber dados específicos, omita ou seja genérico.
Retorne apenas JSON válido com destinos reais baseados em conhecimento real.`;
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
// 🚗 NOVA FUNÇÃO: Geração de prompt HONESTO para todos os tipos de viagem
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
        distanciaMaxima: dados.distancia_maxima || '1500km'
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

    // ✅ PROMPT COMPLETAMENTE REFORMULADO - FOCO NA HONESTIDADE
    const promptCompleto = `# 🌟 SISTEMA INTELIGENTE DE RECOMENDAÇÕES DE VIAGEM
**ESPECIALISTA EM ${tipoViagem.toUpperCase()} - DADOS REAIS APENAS**

## 👤 PERFIL DO VIAJANTE:
- **Origem**: ${infoViajante.cidadeOrigem}, ${infoViajante.paisOrigem}
- **Viaja**: ${infoViajante.companhia} (${infoViajante.pessoas} pessoas)
- **Período**: ${dataIda} a ${dataVolta} (${duracaoViagem})
- **Busca**: ${infoViajante.preferencia}
- **Transporte**: ${isCarro ? `🚗 CARRO (máx ${infoViajante.distanciaMaxima})` : 
                               isRodoviario ? `🚌 ÔNIBUS/TREM (máx 700km)` : 
                               `✈️ AVIÃO (orç: ${infoViajante.orcamento} ${infoViajante.moeda})`}

## ⚠️ REGRAS FUNDAMENTAIS DE HONESTIDADE:
1. **APENAS DADOS REAIS**: Forneça somente informações que você conhece com certeza
2. **NÃO INVENTE NADA**: 
   - Se não souber um código IATA exato → omita o campo ou seja vago
   - Se não tiver temperatura específica → use termos como "clima ameno" ou "temperaturas típicas da estação"
   - Se não souber preços exatos → use faixas aproximadas ou omita
3. **SEJA HONESTO SOBRE LIMITAÇÕES**: É melhor admitir "informação não disponível" do que inventar dados
4. **DESTINOS REAIS**: Sugira apenas cidades/lugares que você realmente conhece

## 🎯 MISSÃO:
Recomende ${isCarro ? 'destinos para ROAD TRIP' : isRodoviario ? 'destinos para ÔNIBUS/TREM' : 'destinos para VIAGEM AÉREA'} que combinem perfeitamente com as preferências do viajante.

${isCarro ? `
## 🚗 INSTRUÇÕES PARA ROAD TRIP:
- TODOS os destinos DEVEM estar dentro de ${infoViajante.distanciaMaxima} de ${infoViajante.cidadeOrigem}
- Considere apenas destinos acessíveis por estrada
- Inclua tempo estimado de viagem SE SOUBER com certeza
- Mencione rodovias principais SE CONHECER a rota
- Se não souber detalhes da rota, seja genérico: "acessível por rodovias principais"
` : isRodoviario ? `
## 🚌 INSTRUÇÕES PARA VIAGEM TERRESTRE:
- Destinos até 700km ou 10h de ${infoViajante.cidadeOrigem}
- Considere transporte público disponível
- Se não souber detalhes de transporte, seja genérico
` : `
## ✈️ INSTRUÇÕES PARA VIAGEM AÉREA:
- Considere orçamento de ${infoViajante.orcamento} ${infoViajante.moeda} por pessoa
- Inclua códigos IATA apenas se souber com certeza
- Se não souber o código exato, use descrições como "aeroporto principal da cidade"
`}

## 📋 ESTRUTURA DE RESPOSTA:
Retorne JSON com esta estrutura EXATA, mas inclua apenas campos que você conhece:

\`\`\`json
{
  "tipoTransporte": "${isCarro ? 'carro' : isRodoviario ? 'terrestre' : 'aviao'}",
  "topPick": {
    "destino": "Nome da Cidade Real",
    "pais": "Nome do País",
    ${isCarro ? `
    "distanciaAproximada": "XXXkm (apenas se souber)",
    "tempoViagem": "X horas (apenas se souber)",
    "rotaRecomendada": "Rodovia principal (apenas se conhecer)",` : 
      isRodoviario ? `
    "distanciaTerrestre": "XXXkm (apenas se souber)",
    "tempoViagem": "X horas (apenas se souber)",
    "tipoTransporte": "ônibus/trem (apenas se souber)",` : `
    "aeroporto": {
      "codigo": "ABC (apenas se souber o código exato)",
      "nome": "Nome do Aeroporto (apenas se souber)"
    },`}
    "descricao": "Descrição honesta baseada no seu conhecimento real",
    "porque": "Razões específicas baseadas nas preferências do viajante",
    "destaque": "Experiência única que você REALMENTE conhece",
    "comentario": "Comentário da Tripinha em 1ª pessoa sobre SUA experiência real no local",
    "pontosTuristicos": ["Pontos reais que você conhece"],
    "clima": {
      "periodo": "${dataIda} a ${dataVolta}",
      "condicoes": "Condições climáticas gerais que você conhece para o período",
      "recomendacoes": "Dicas climáticas apenas se souber"
    },
    "preco": {
      ${isCarro ? `"combustivel": "Estimativa geral ou omitir",
      "pedagios": "Se houver e souber",` : 
        isRodoviario ? `"passagem": "Faixa de preço se souber",` : 
        `"voo": "Faixa de preço se souber",`}
      "hospedagem": "Faixa de preço se souber"
    }
  },
  "alternativas": [
    {
      "destino": "Cidade Real 1",
      "pais": "País Real",
      "porque": "Razão específica",
      "pontoTuristico": "Um ponto que você conhece",
      "clima": "Condições gerais no período"
    },
    {
      "destino": "Cidade Real 2", 
      "pais": "País Real",
      "porque": "Razão específica",
      "pontoTuristico": "Um ponto que você conhece", 
      "clima": "Condições gerais no período"
    },
    {
      "destino": "Cidade Real 3",
      "pais": "País Real", 
      "porque": "Razão específica",
      "pontoTuristico": "Um ponto que você conhece",
      "clima": "Condições gerais no período"
    },
    {
      "destino": "Cidade Real 4",
      "pais": "País Real",
      "porque": "Razão específica", 
      "pontoTuristico": "Um ponto que você conhece",
      "clima": "Condições gerais no período"
    }
  ],
  "surpresa": {
    "destino": "Cidade Menos Conhecida Real",
    "pais": "País Real",
    "descricao": "Por que é uma surpresa especial",
    "porque": "Razões para ser destino surpresa",
    "destaque": "Experiência única surpreendente",
    "comentario": "Comentário empolgado da Tripinha sobre esta surpresa",
    "pontosTuristicos": ["Pontos únicos que você conhece"],
    "clima": "Condições no período da viagem"
  }
}
\`\`\`

## 🔥 ÚLTIMA INSTRUÇÃO CRÍTICA:
- **SEJA BRUTAL COM A HONESTIDADE**: Se não souber algo específico, OMITA ou seja genérico
- **NÃO FORCE DADOS**: Campos em branco são melhores que dados inventados  
- **FOQUE NA EXPERIÊNCIA**: O que importa é recomendar destinos reais que o viajante vai amar
- **SEJA A TRIPINHA**: Entusiasmada, conhecedora, mas sempre honesta sobre o que realmente conhece

**AGORA RECOMENDE DESTINOS REAIS QUE VOCÊ CONHECE PARA ESTE PERFIL DE VIAJANTE!** 🐾✨`;

    return promptCompleto;
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
        
        // Processar topPick com abordagem mais permissiva para dados honestos
        if (data.topPick) {
            if (isCarro) {
                // 🚗 Garantir campos específicos para viagem de carro (com dados genéricos se necessário)
                if (!data.topPick.distanciaAproximada) {
                    data.topPick.distanciaAproximada = "Consulte mapa para distância exata";
                    modificado = true;
                }
                if (!data.topPick.tempoViagem) {
                    data.topPick.tempoViagem = "Tempo variável conforme rota";
                    modificado = true;
                }
                if (!data.topPick.rotaRecomendada) {
                    data.topPick.rotaRecomendada = `Acesso via rodovias principais`;
                    modificado = true;
                }
                if (!data.topPick.infraestrutura) {
                    data.topPick.infraestrutura = {
                        estacionamento: "Verificar opções no destino",
                        postos_gasolina: "Rede de postos disponível"
                    };
                    modificado = true;
                }
            } else if (isRodoviario) {
                // Dados genéricos para transporte terrestre
                if (!data.topPick.terminalTransporte?.nome) {
                    data.topPick.terminalTransporte = {
                        nome: `Terminal/Estação principal`,
                        tipo: 'transporte terrestre',
                        localizacao: "Centro da cidade"
                    };
                    modificado = true;
                }
            } else {
                // Para viagens aéreas, usar dados genéricos se código IATA não conhecido
                if (!data.topPick.aeroporto?.codigo) {
                    data.topPick.aeroporto = {
                        codigo: "Consulte aeroporto local",
                        nome: `Aeroporto principal de ${data.topPick.destino}`
                    };
                    modificado = true;
                }
            }
            
            // Garantir dados climáticos genéricos se não especificados
            if (!data.topPick.clima || !data.topPick.clima.condicoes) {
                data.topPick.clima = {
                    periodo: "Período da viagem",
                    condicoes: "Consulte previsão do tempo local",
                    recomendacoes: "Verificar condições antes da viagem"
                };
                modificado = true;
            }
        }
        
        // Processar surpresa com dados genéricos se necessário
        if (data.surpresa) {
            if (isCarro && !data.surpresa.rotaRecomendada) {
                data.surpresa.rotaRecomendada = `Acesso via rodovias`;
                modificado = true;
            } else if (isRodoviario && !data.surpresa.terminalTransporte) {
                data.surpresa.terminalTransporte = {
                    nome: `Terminal principal`
                };
                modificado = true;
            } else if (!isCarro && !isRodoviario && !data.surpresa.aeroporto) {
                data.surpresa.aeroporto = {
                    codigo: "Consulte aeroporto local",
                    nome: `Aeroporto de ${data.surpresa.destino}`
                };
                modificado = true;
            }
            
            // Clima genérico se não especificado
            if (!data.surpresa.clima) {
                data.surpresa.clima = "Consulte condições climáticas locais";
                modificado = true;
            }
        }
        
        // Processar alternativas com dados genéricos mínimos
        if (data.alternativas && Array.isArray(data.alternativas)) {
            data.alternativas.forEach(alternativa => {
                if (!alternativa.clima) {
                    alternativa.clima = "Condições climáticas típicas da região";
                    modificado = true;
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
// 🚗🚌✈️ HANDLER PRINCIPAL ATUALIZADO COM PROMPT HONESTO
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
        console.log('🎯 === BENETRIP GROQ API v10.2 - PROMPT HONESTO + CARRO + ÔNIBUS + AVIÃO ===');
        
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
        console.log('🎯 MODO HONESTO: LLM instruída a admitir limitações');
        
        if (isCarro) {
            console.log('🛣️ Road trip - Limite máximo:', requestData.distancia_maxima || '1500km');
        } else if (isRodoviario) {
            console.log('📏 Limite máximo: 700km ou 10 horas');
        }
        
        // Gerar prompt HONESTO otimizado para Groq
        const prompt = gerarPromptParaGroq(requestData);
        console.log(`📝 Prompt HONESTO gerado para Groq (${tipoViagem})`);
        
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
                versao: '10.2-prompt-honesto',
                timestamp: new Date().toISOString(),
                reasoning_enabled: modeloUsado === CONFIG.groq.models.reasoning,
                honest_prompt: true, // 🎯 NOVO
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
            console.log('🎯 Prompt honesto aplicado: LLM pode admitir limitações');
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
                    honesto: true, // 🎯 NOVO
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
                    honesto: true, // 🎯 NOVO
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
