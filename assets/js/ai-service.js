/**
 * Serviço de IA para recomendação de destinos da Benetrip
 */

const BENETRIP_AI = {
    // Configurações do serviço
    config: {
        apiKey: null, // Será inicializado durante setup
        cacheDuration: 24 * 60 * 60 * 1000, // 24 horas em ms
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4',
        useNetlifyFunctions: true // Sempre usar Netlify Functions em produção
    },

    // Sistema de cache para evitar chamadas repetidas à API
    cache: {
        recommendations: {},
        timestamp: {}
    },

    // Inicializa o serviço de IA
    init() {
        console.log("Serviço de IA inicializado");
        
        // Em produção, sempre usar as funções Netlify
        this.config.useNetlifyFunctions = true;
        
        // Carregar cache
        this.loadCache();
        
        // Flag de inicialização
        this.initialized = true;
        
        return this;
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
            
            // Chamar a função Netlify
            this.dispatchProgressEvent(50, "Consultando destinos ideais para seu perfil... 🌍");
            const aiResponse = await this.callNetlifyFunction(preferences);
            
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
            
            // Usar a URL relativa para garantir que funcione em produção
            // Isso evita problemas com URLs absolutas que podem diferir entre ambientes
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
            
            // Usar a URL relativa para Netlify Functions
            const response = await fetch(`/.netlify/functions/image-search?query=${encodedQuery}`);
            
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
