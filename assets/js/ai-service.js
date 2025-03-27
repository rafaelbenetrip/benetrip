/**
 * Serviço de IA para recomendação de destinos da Benetrip
 */

const BENETRIP_AI = {
    // Configurações do serviço
    config: {
        apiKey: null, // Será inicializado durante setup
        cacheDuration: 24 * 60 * 60 * 1000, // 24 horas em ms
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4'
    },

    // Sistema de cache para evitar chamadas repetidas à API
    cache: {
        recommendations: {},
        timestamp: {}
    },

    // Inicializa o serviço de IA
    init() {
    // Implementar estratégia de retry com delay para esperar config
    const maxRetries = 5;
    let retryCount = 0;
    
    const initWithRetry = () => {
        // Tentar obter a chave das variáveis de ambiente do Netlify
        if (typeof process !== 'undefined' && process.env && process.env.OPENAI_API_KEY) {
            this.config.apiKey = process.env.OPENAI_API_KEY;
            console.log("Chave API carregada das variáveis de ambiente");
            return true;
        } 
        // Verificar se BENETRIP_CONFIG está disponível
        else if (typeof window.BENETRIP_CONFIG !== 'undefined') {
            // Se estiver disponível mas não inicializado, tente inicializar
            if (typeof window.BENETRIP_CONFIG.init === 'function' && !window.BENETRIP_CONFIG.initialized) {
                try {
                    console.log("Tentando inicializar BENETRIP_CONFIG automaticamente");
                    window.BENETRIP_CONFIG.init();
                } catch (error) {
                    console.error("Erro ao inicializar BENETRIP_CONFIG:", error);
                }
            }
            
            // Agora tente obter as credenciais
            if (window.BENETRIP_CONFIG.credentials) {
                this.config.apiKey = window.BENETRIP_CONFIG.credentials.openAI;
                console.log("Serviço de IA inicializado com credenciais");
                
                // Verificar se a chave está em formato válido
                if (!this.validateApiKey()) {
                    console.error("Chave API inválida ou em formato incorreto");
                }
                return true;
            } else {
                console.warn("BENETRIP_CONFIG existe mas não tem credentials");
            }
        } 
        
        // Verificar variáveis do Netlify como último recurso
        const netlifyKey = this.getNetlifyVariable('OPENAI_API_KEY') || 
                         this.getNetlifyVariable('CLAUDE_API_KEY') || 
                         this.getNetlifyVariable('AI_API_KEY');
        
        if (netlifyKey) {
            this.config.apiKey = netlifyKey;
            console.log("Chave API carregada das variáveis do Netlify");
            return true;
        }
        
        // Se nenhuma config foi encontrada e ainda temos retries
        if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Tentativa ${retryCount} de inicializar BENETRIP_AI: aguardando BENETRIP_CONFIG...`);
            // Tentar novamente após um delay
            setTimeout(initWithRetry, 500 * retryCount); // Delay progressivo
            return false;
        } else {
            console.warn("BENETRIP_CONFIG não encontrado após várias tentativas");
            // Usar API via função do Netlify em vez de chave direta
            this.config.useNetlifyFunctions = true;
            console.log("Configurado para usar funções do Netlify em vez de chave direta");
            return true;
        }
    }
    
    // Iniciar a primeira tentativa
    const initialized = initWithRetry();
    
    // Carregar cache independentemente do status de inicialização
    this.loadCache();
    
    // Definir flag para indicar se inicialização foi bem-sucedida
    this.initialized = initialized;
    
    return this;
},

// Método de ajuda para buscar variáveis do Netlify
getNetlifyVariable(name) {
    // Netlify injeta variáveis no objeto window.ENV ou como variáveis globais diretamente
    if (window.ENV && window.ENV[name]) {
        return window.ENV[name];
    }
    
    // Tentar acessar diretamente (algumas configurações do Netlify)
    if (window[name]) {
        return window[name];
    }
    
    return null;
},
    
    // Valida o formato básico da chave API
    validateApiKey() {
        if (!this.config.apiKey) {
            return false;
        }
        
        // Verificar formato básico (começa com sk-)
        if (!this.config.apiKey.startsWith('sk-')) {
            return false;
        }
        
        // Verificar comprimento (deve ser suficientemente longo)
        if (this.config.apiKey.length < 20) {
            return false;
        }
        
        return true;
    },
    
    // Carrega cache do localStorage
    loadCache() {
        try {
            const cachedData = localStorage.getItem('benetrip_ai_cache');
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                this.cache = {...parsed};
                console.log("Cache de IA carregado com sucesso");
            }
        } catch (error) {
            console.warn("Erro ao carregar cache de IA:", error);
        }
    },

// Método de retry para chamadas de API com backoff exponencial
retryFetch: async function(url, options, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Tentativa ${attempt} de ${maxRetries} para ${url}`);
            
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            console.warn(`Tentativa ${attempt} falhou:`, error);
            lastError = error;
            
            if (attempt < maxRetries) {
                const waitTime = delay * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`Aguardando ${waitTime}ms antes da próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    throw lastError;
},
    
    // Salva cache no localStorage
    saveCache() {
        try {
            localStorage.setItem('benetrip_ai_cache', JSON.stringify(this.cache));
        } catch (error) {
            console.warn("Erro ao salvar cache de IA:", error);
        }
    },
    
    // Gera um ID de cache baseado nas preferências
    generateCacheId(preferences) {
        // Cria uma chave concatenando valores principais
        const companhia = preferences.companhia || '0';
        const preferencia = preferences.preferencia_viagem || '0';
        const moeda = preferences.moeda_escolhida || 'BRL';
        return `${companhia}_${preferencia}_${moeda}`;
    },
    
    // Verifica se há dados em cache válidos
    hasCachedData(cacheId) {
        if (!this.cache.recommendations[cacheId]) return false;
        
        const cacheTime = this.cache.timestamp[cacheId] || 0;
        const now = Date.now();
        
        // Verifica se o cache ainda é válido
        return (now - cacheTime) < this.config.cacheDuration;
    },

    /**
     * Obtém recomendações de destinos baseadas nas preferências do usuário
     */
    async obterRecomendacoes(preferences) {
    // Notifica início do processo
    this.dispatchProgressEvent(10, "Iniciando análise de suas preferências de viagem... 🔍");
    
    try {
        // Verificar se preferences é válido
        if (!preferences || typeof preferences !== 'object') {
            console.warn("Preferências inválidas:", preferences);
            throw new Error("Preferências de viagem inválidas");
        }
        
        // Gera ID para cache
        const cacheId = this.generateCacheId(preferences);
        
        // Verifica se temos dados em cache
        if (this.hasCachedData(cacheId)) {
            this.dispatchProgressEvent(100, "Recomendações encontradas! 🎉");
            return this.cache.recommendations[cacheId];
        }
        
        // Preparação dos dados
        this.dispatchProgressEvent(30, "Processando suas preferências... 🧮");
        
        // Determinar método de chamada à API com base na configuração
        let aiResponse;
        
        // Em produção, usar preferencialmente a função do Netlify
        if (this.config.useNetlifyFunctions || !this.validateApiKey()) {
            this.dispatchProgressEvent(50, "Consultando serviço de recomendações... 🌍");
            aiResponse = await this.callNetlifyFunction(preferences);
        } else {
            // Caso tenha a chave API e esteja em desenvolvimento local, usar chamada direta
            const prompt = this.prepareAIPrompt(preferences);
            this.dispatchProgressEvent(50, "Consultando destinos ideais para seu perfil... 🌍");
            aiResponse = await this.callAIService(prompt);
        }
        
        // Processamento da resposta
        this.dispatchProgressEvent(80, "Organizando as melhores opções para você... 🗂️");
        const destinations = await this.processAIResponse(aiResponse, preferences);
        
        // Salva no cache
        this.cache.recommendations[cacheId] = destinations;
        this.cache.timestamp[cacheId] = Date.now();
        this.saveCache();
        
        // Salvar no localStorage para uso em outras páginas
        localStorage.setItem('benetrip_recomendacoes', JSON.stringify(destinations));
        
        // Finaliza processo
        this.dispatchProgressEvent(100, "Recomendações prontas! 🎉");
        return destinations;
        
    } catch (error) {
        console.error("Erro ao obter recomendações:", error);
        this.dispatchProgressEvent(100, "Erro ao obter recomendações 😔");
        
        // Propagar o erro com mensagem mais amigável para o usuário final
        throw new Error("Não foi possível gerar recomendações no momento. Por favor, tente novamente mais tarde.");
    }
},
    
    /**
     * Prepara o prompt para a API de IA
     */
    prepareAIPrompt(preferences) {
        // Extrair dados relevantes das preferências
        const {companhia, preferencia_viagem, moeda_escolhida, orcamento_valor, datas, cidade_partida} = preferences;
        
        // Mapear tipos de companhia para descrições
        const companhiaMap = {
            0: "sozinho",
            1: "em casal (viagem romântica)",
            2: "em família",
            3: "com amigos"
        };
        
        // Mapear preferências de viagem
        const preferenciaMap = {
            0: "relaxamento e descanso (praias, resorts tranquilos, spas)",
            1: "aventura e atividades ao ar livre (trilhas, esportes, natureza)",
            2: "cultura, história e gastronomia (museus, centros históricos, culinária local)",
            3: "experiência urbana, compras e vida noturna (centros urbanos, lojas, restaurantes)"
        };
        
        // Informações sobre datas da viagem
        const dataInfo = datas ? `Período da viagem: ${datas.dataIda} a ${datas.dataVolta}` : "Sem período definido";
        
        // Informação da cidade de origem
        const origemInfo = cidade_partida ? 
            `Partindo de ${cidade_partida.name}, ${cidade_partida.country || ''}` : 
            "Origem não especificada";
        
        return `
        Você é a Tripinha, uma cachorra vira-lata caramelo especialista em viagens da Benetrip.
        Preciso que recomende 6 destinos de viagem, considerando as seguintes preferências:
        
        - ${origemInfo}
        - Viajando ${companhiaMap[companhia] || 'sozinho'}
        - Busca principalmente: ${preferenciaMap[preferencia_viagem] || 'relaxamento e descanso'}
        - Orçamento para passagens aéreas: ${orcamento_valor || 'flexível'} ${moeda_escolhida || 'BRL'} por pessoa
        - ${dataInfo}
        
        Forneça exatamente 6 destinos no seguinte formato JSON:
        {
          "destinations": [
            {
              "cidade": "Nome da cidade",
              "pais": "Nome do país",
              "codigo_pais": "Código de 2 letras do país",
              "codigo_iata": "Código IATA do aeroporto principal",
              "descricao_curta": "Breve descrição de uma linha",
              "preco_passagem": valor numérico estimado (apenas para passagem aérea),
              "preco_hospedagem": valor numérico por noite,
              "experiencias": "3 experiências imperdíveis separadas por vírgula",
              "custo_total": valor numérico estimado para 5 dias,
              "porque_ir": "Uma frase curta e envolvente sobre o destino"
            },
            ...mais 5 destinos
          ]
        }
        
        Importante:
        1. O primeiro destino deve ser a melhor correspondência para as preferências.
        2. O último (sexto) destino será usado como "destino surpresa", então deve ser mais inusitado.
        3. Todos os destinos DEVEM respeitar o orçamento para passagens aéreas.
        4. O código_pais deve ser o código ISO de 2 letras (ex: br, us, pt).
        5. Certifique-se de que os valores estejam na moeda solicitada (${moeda_escolhida || 'BRL'}).
        6. Os preços e estimativas devem ser realistas para a região.
        `;
    },
    
    /**
     * Chama o serviço de IA para obter recomendações
     */
    async callAIService(prompt) {
    try {
        console.log("Chamando API através do Netlify Function...");
        
// Extrair dados da requisição dos estados
const dadosUsuario = prompt || {};

// Obter URL da API do BENETRIP_CONFIG
const apiUrl = window.BENETRIP_CONFIG?.getApiUrl('aiRecommend') || 
               '/.netlify/functions/ai-recommend';
               
console.log(`Usando endpoint de IA: ${apiUrl}`);

const response = await fetch(`${urlBase}/.netlify/functions/ai-recommend`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    body: JSON.stringify({
        companhia: dadosUsuario.companhia,
        preferencia_viagem: dadosUsuario.preferencia_viagem,
        moeda_escolhida: dadosUsuario.moeda_escolhida,
        orcamento_valor: dadosUsuario.orcamento_valor,
        datas: dadosUsuario.datas,
        cidade_partida: dadosUsuario.cidade_partida
    })
});
        
        if (!response.ok) {
    let errorMessage = `Erro na API: ${response.status}`;
    
    // Log detalhado para debugging
    console.error(`Erro na requisição para ${apiUrl}:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries([...response.headers.entries()]),
        requestData: dadosUsuario
    });
    
    try {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage += ` - ${errorData.error || errorData.message || 'Erro desconhecido'}`;
        } else {
            const textError = await response.text();
            errorMessage += ` - ${textError.substring(0, 100) || 'Erro sem detalhes'}`;
        }
    } catch (e) {
        console.warn("Não foi possível ler detalhes do erro:", e);
        errorMessage += ' - Não foi possível obter detalhes do erro';
    }
    
    throw new Error(errorMessage);
}
        
        const data = await response.json();
        return data.data; // O conteúdo da resposta da IA
    } catch (error) {
        console.error("Erro ao chamar serviço de IA:", error);
        throw error;
    }
},

/**
 * Chama a função Netlify para obter recomendações de destinos
 */
async callNetlifyFunction(preferences) {
    try {
        console.log("Chamando função Netlify para recomendações...");
        
        // Extrair apenas os dados necessários para reduzir o tamanho da requisição
        const data = {
            companhia: preferences.companhia,
            preferencia_viagem: preferences.preferencia_viagem,
            moeda_escolhida: preferences.moeda_escolhida,
            orcamento_valor: preferences.orcamento_valor,
            datas: preferences.datas,
            cidade_partida: preferences.cidade_partida
        };
        
        // Chamar a API através de função Netlify
        const response = await fetch('/.netlify/functions/ai-recommend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            let errorMessage = `Erro na função Netlify: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage += ` - ${errorData.error || 'Erro desconhecido'}`;
            } catch (e) {
                // Se não conseguir ler o JSON de erro
                errorMessage += ' - Não foi possível obter detalhes do erro';
            }
            
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        return result.data;
    } catch (error) {
        console.error("Erro ao chamar função Netlify:", error);
        throw error;
    }
},
    
    /**
     * Busca imagens para os destinos
     */
    async getDestinationImages(destino) {
    try {
        const query = `${destino.cidade} ${destino.pais} landmark`;
        const encodedQuery = encodeURIComponent(query);
        
        // Usar nossa função Netlify para buscar imagens
        const apiUrl = window.BENETRIP_CONFIG?.getApiUrl('imageSearch') || 
               '/.netlify/functions/image-search';
               
const response = await fetch(`${apiUrl}?query=${encodedQuery}`);
        
        if (!response.ok) {
            throw new Error(`Erro na API de imagens: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Se encontrou imagens, retornar URLs
        if (data.images && data.images.length > 0) {
            return {
                principal: data.images[0].url,
                secundaria: data.images.length > 1 ? data.images[1].url : data.images[0].url
            };
        }
        
        throw new Error("Nenhuma imagem encontrada");
    } catch (error) {
        console.error(`Erro ao buscar imagens para ${destino.cidade}:`, error);
        
        // Usar URLs de placeholder como fallback
        return {
            principal: `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(destino.cidade)}`,
            secundaria: `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(destino.pais)}`
        };
    }
},
    /**
     * Processa a resposta da IA e converte para formato utilizável
     */
    async processAIResponse(response, preferences) {
        try {
            // Parseamento da resposta JSON
            // ai-service.js (no método processAIResponse, linha ~493)
let parsedResponse;
            
if (typeof response === 'string') {
    try {
        // Primeiro tenta fazer parse direto
        parsedResponse = JSON.parse(response);
    } catch (e) {
        // Se falhar, tenta extrair o JSON usando regex
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                parsedResponse = JSON.parse(jsonMatch[0]);
            } catch (e2) {
                throw new Error("Formato de resposta inválido: não foi possível extrair JSON válido");
            }
        } else {
            throw new Error("Formato de resposta inválido: nenhum JSON encontrado");
        }
    }
} else if (response && typeof response === 'object') {
    parsedResponse = response;
} else {
    throw new Error("Resposta inválida: tipo inesperado");
}

// Adicionar log para debug
console.log("Resposta processada:", parsedResponse);
            
            // Verificar se há array de destinos
            if (!parsedResponse.destinations || !Array.isArray(parsedResponse.destinations)) {
                throw new Error("Resposta não contém lista de destinos");
            }
            
            // Separar os destinos
            const destinos = parsedResponse.destinations;
            
            // Validar que temos os 6 destinos necessários
            if (destinos.length < 6) {
                throw new Error(`Número insuficiente de destinos: ${destinos.length}, necessário 6`);
            }
            
            // Separar o destino principal (top), os alternativos e o surpresa
            const destinoPrincipal = destinos[0];
            const destinosAlternativos = destinos.slice(1, 5);
            const destinoSurpresa = destinos[5];
            
            // Array para armazenar as promessas de processamento
            const processamentoPromessas = [];
            
            // Processar destino principal
            processamentoPromessas.push(this.processarDestino(destinoPrincipal, 1, preferences, true));
            
            // Processar destinos alternativos
            destinosAlternativos.forEach((destino, index) => {
                processamentoPromessas.push(this.processarDestino(destino, index + 2, preferences, false));
            });
            
            // Processar destino surpresa
            processamentoPromessas.push(this.processarDestino(destinoSurpresa, 6, preferences, false, true));
            
            // Aguardar todas as promessas
            const destinosProcessados = await Promise.all(processamentoPromessas);
            
            // Separar novamente para organizar conforme necessário pela interface
            const resultado = {
                principal: destinosProcessados[0],
                alternativos: destinosProcessados.slice(1, 5),
                surpresa: destinosProcessados[5]
            };
            
            return resultado;
        } catch (error) {
            console.error("Erro ao processar resposta da IA:", error);
            throw error;
        }
    },

    async processarDestino(destino, ranking, preferences, isPrincipal = false, isSurpresa = false) {
        // Buscar imagens para o destino
        const imagens = await this.getDestinationImages(destino);
        
        // Adicionar propriedades extras necessárias
        return {
            ...destino,
            id: `dest-${ranking}`,
            moeda: preferences.moeda_escolhida || 'BRL',
            ranking: ranking,
            imagens: imagens,
            isPrincipal: isPrincipal,
            isSurpresa: isSurpresa,
            comentario_tripinha: this.generateTripinhaComment(destino, preferences, isSurpresa)
        };
    },

    /**
     * Gera um comentário personalizado da Tripinha para cada destino
     */
    generateTripinhaComment(destino, preferences, isSurpresa = false) {
        // Array de templates de comentários para destinos normais
        const comentariosNormais = [
            `Eu simplesmente AMEI ${destino.cidade}! ${destino.porque_ir} É perfeito para quem viaja ${isSurpresa ? 'buscando surpresas' : 'querendo ' + this.getPreferenciaTexto(preferences.preferencia_viagem)}! 🐾`,
            
            `${destino.cidade} é incrível! ${destino.porque_ir} Você vai se apaixonar pelos lugares e experiências que esse destino oferece! ✨🐶`,
            
            `Farejei esse destino especialmente para você! ${destino.cidade} tem tudo o que você está buscando. ${destino.porque_ir} 🐾🌍`,
            
            `O que acha de explorar ${destino.cidade}? ${destino.porque_ir} É perfeito para sua viagem! Já estou ansiosa pra você conhecer! 🧳`
        ];
        
        // Array de templates de comentários para destinos surpresa
        const comentariosSurpresa = [
            `Uau! Este é meu destino surpresa favorito! ${destino.cidade} vai te surpreender completamente. ${destino.porque_ir} Confie no meu faro! 🐾🎁`,
            
            `Sei que você não esperava por essa, mas ${destino.cidade} é uma joia escondida que poucos conhecem! ${destino.porque_ir} Que tal se aventurar? 🕵️‍♀️🐶`,
            
            `Olha que surpresa incrível! ${destino.cidade} não é um destino óbvio, mas é PERFEITO para você! ${destino.porque_ir} Vai por mim! 🎯🐾`
        ];
        
        // Selecionar array de comentários com base no tipo do destino
        const comentarios = isSurpresa ? comentariosSurpresa : comentariosNormais;
        
        // Retornar um comentário aleatório do array correspondente
        return comentarios[Math.floor(Math.random() * comentarios.length)];
    },

    /**
     * Retorna texto descritivo para a preferência de viagem
     */
    getPreferenciaTexto(preferencia) {
        const textos = [
            "relaxar e descansar",
            "viver aventuras",
            "descobrir cultura e gastronomia",
            "explorar a vida urbana"
        ];
        
        return textos[preferencia] || "se divertir";
    },

    /**
     * Despacha evento de progresso para atualizar a interface
     */
    dispatchProgressEvent(progress, message) {
        try {
            const event = new CustomEvent('benetrip_progress', {
                detail: {
                    progress: progress,
                    message: message
                }
            });
            window.dispatchEvent(event);
        } catch (error) {
            console.warn("Erro ao despachar evento de progresso:", error);
        }
    }
};

// Exporta o serviço para uso global
window.BENETRIP_AI = BENETRIP_AI;
