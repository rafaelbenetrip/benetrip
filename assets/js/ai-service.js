/**
 * Serviço de IA para recomendação de destinos da Benetrip
 */

const BENETRIP_AI = {
    // Tentar obter a chave das variáveis de ambiente do Netlify
    if (process.env.OPENAI_API_KEY) {
      this.config.apiKey = process.env.OPENAI_API_KEY;
      console.log("Chave API carregada das variáveis de ambiente");
    }
    
    // Configurações do serviço
    config: {
        apiKey: null, // Será inicializado durante setup
        cacheDuration: 24 * 60 * 60 * 1000, // 24 horas em ms
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4'
    },

    // Inicializa o serviço de IA
    init() {
        // Obter a chave da API do módulo de configuração
        if (window.BENETRIP_CONFIG && window.BENETRIP_CONFIG.credentials) {
            this.config.apiKey = window.BENETRIP_CONFIG.credentials.openAI;
            console.log("Serviço de IA inicializado");
            
            // Verificar se a chave está em formato válido
            if (!this.validateApiKey()) {
                console.error("Chave API inválida ou em formato incorreto");
                // Não lance exceção aqui, apenas registra o erro
            }
        } else {
            console.warn("BENETRIP_CONFIG não encontrado");
            return this;
        }
        
        // Carrega cache existente
        this.loadCache();
        
        return this;
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
    
    // Sistema de cache para evitar chamadas repetidas à API
    cache: {
        recommendations: {},
        timestamp: {}
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
            // Verificar se a chave API está configurada
            if (!this.validateApiKey()) {
                throw new Error("A chave da API OpenAI não está configurada corretamente. Verifique o arquivo config.js e coloque uma chave válida.");
            }
            
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
            const prompt = this.prepareAIPrompt(preferences);
            
            // Chamada à API de IA
            this.dispatchProgressEvent(50, "Consultando destinos ideais para seu perfil... 🌍");
            const aiResponse = await this.callAIService(prompt);
            
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
            
            // Propagar o erro com mensagem clara
            if (error.message.includes("401") || error.message.includes("Incorrect API key")) {
                throw new Error("Erro de autenticação com a API OpenAI. Sua chave API parece ser inválida ou expirada. Por favor, verifique-a no arquivo config.js.");
            } else {
                throw error;
            }
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
        // Verificar se temos uma chave de API configurada
        if (!this.config.apiKey) {
            throw new Error("Chave de API de IA não configurada");
        }
        
        try {
            console.log("Enviando solicitação para a API...");
            
            // Chamada à API da OpenAI
            const response = await fetch(this.config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [
                        {role: "system", content: "Você é um assistente especializado em viagens que fornece recomendações de destinos em formato JSON estruturado."},
                        {role: "user", content: prompt}
                    ],
                    temperature: 0.7,
                    response_format: { type: "json_object" }
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                // Adicione informações mais detalhadas sobre o erro específico
                let errorMessage = `Erro na API: ${response.status}`;
                
                if (error.error) {
                    if (error.error.message) {
                        errorMessage += ` - ${error.error.message}`;
                    }
                    
                    if (error.error.code) {
                        errorMessage += ` (código: ${error.error.code})`;
                    }
                }
                
                // Adicionar mensagem específica para erro de autenticação
                if (response.status === 401) {
                    errorMessage += ". Sua chave API da OpenAI parece ser inválida ou expirada. Verifique-a no arquivo config.js.";
                }
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error("Erro ao chamar serviço de IA:", error);
            throw error;
        }
    },

    /**
     * Busca imagens para os destinos
     */
    async getDestinationImages(destino) {
        try {
            // Pegando a chave da API Unsplash da configuração
            const accessKey = window.BENETRIP_CONFIG?.credentials?.unsplash || 
                             'x8q70wHdUpQoKmNtBmhfEbatdsxyapgkUEBgxQav708';
                             
            const query = `${destino.cidade} ${destino.pais} landmark`;
            const encodedQuery = encodeURIComponent(query);
            
            const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodedQuery}&per_page=2&orientation=landscape&client_id=${accessKey}`);
            
            if (!response.ok) {
                throw new Error(`Erro na API de imagens: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Se encontrou imagens, retornar URLs
            if (data.results && data.results.length > 0) {
                return {
                    principal: data.results[0].urls.regular,
                    secundaria: data.results.length > 1 ? data.results[1].urls.regular : data.results[0].urls.regular
                };
            }
            
            throw new Error("Nenhuma imagem encontrada");
        } catch (error) {
            console.error(`Erro ao buscar imagens para ${destino.cidade}:`, error);
            
            // Usar o Pixabay como fallback para imagens
            try {
                const pixabayKey = window.BENETRIP_CONFIG?.credentials?.pexels || 
                                  'GtZcnoPlphF95dn7SsHt7FewD8YYlDQCkBK2vDD4Z7AUt5flGFFJwMEt';
                const query = `${destino.cidade} ${destino.pais} travel`;
                const encodedQuery = encodeURIComponent(query);
                
                const response = await fetch(`https://pixabay.com/api/?key=${pixabayKey}&q=${encodedQuery}&image_type=photo&orientation=horizontal&category=travel&per_page=2`);
                
                if (!response.ok) {
                    throw new Error(`Erro na API Pixabay: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.hits && data.hits.length > 0) {
                    return {
                        principal: data.hits[0].webformatURL,
                        secundaria: data.hits.length > 1 ? data.hits[1].webformatURL : data.hits[0].webformatURL
                    };
                }
            } catch (pixabayError) {
                console.error("Erro no fallback de imagens:", pixabayError);
            }
            
            // Se ambas as APIs falharem, usar URLs genéricas
            return {
                principal: `https://source.unsplash.com/1600x900/?${encodeURIComponent(destino.cidade)},landmark`,
                secundaria: `https://source.unsplash.com/1600x900/?${encodeURIComponent(destino.pais)},travel`
            };
        }
    },

    /**
     * Processa a resposta da IA e converte para formato utilizável
     */
    async processAIResponse(response, preferences) {
        try {
            // Parseamento da resposta JSON
            let parsedResponse;
            
            if (typeof response === 'string') {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsedResponse = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error("Formato de resposta inválido");
                }
            } else {
                parsedResponse = response;
            }
            
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
