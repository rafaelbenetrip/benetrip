/**
 * Serviço de IA para recomendação de destinos da Benetrip
 * Este módulo gerencia as recomendações inteligentes de destinos com base nas preferências do usuário
 */

const BENETRIP_AI = {
    /**
     * Configurações do serviço de IA
     */
    config: {
        apiKey: null, // Será inicializado durante setup
        useLocalFallback: true, // Usar recomendações locais se a IA falhar
        cacheDuration: 24 * 60 * 60 * 1000, // 24 horas em ms
    },

    /**
     * Inicializa o serviço de IA
     */
    init() {
        // Carrega a chave da API do ambiente ou do localStorage
        this.config.apiKey = process.env.AI_API_KEY || localStorage.getItem('benetrip_ai_key');
        console.log("Serviço de IA inicializado");
        
        // Carrega cache existente
        this.loadCache();
        
        return this;
    },
    
    /**
     * Sistema de cache para evitar chamadas repetidas à API
     */
    cache: {
        recommendations: {},
        timestamp: {}
    },
    
    /**
     * Carrega cache do localStorage
     */
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
    
    /**
     * Salva cache no localStorage
     */
    saveCache() {
        try {
            localStorage.setItem('benetrip_ai_cache', JSON.stringify(this.cache));
        } catch (error) {
            console.warn("Erro ao salvar cache de IA:", error);
        }
    },
    
    /**
     * Gera um ID de cache baseado nas preferências
     */
    generateCacheId(preferences) {
        // Cria uma chave concatenando valores principais para identificação única
        return `${preferences.companhia}_${preferences.preferencia_viagem}_${preferences.moeda_escolhida}`;
    },
    
    /**
     * Verifica se há dados em cache válidos
     */
    hasCachedData(cacheId) {
        if (!this.cache.recommendations[cacheId]) return false;
        
        const cacheTime = this.cache.timestamp[cacheId] || 0;
        const now = Date.now();
        
        // Verifica se o cache ainda é válido
        return (now - cacheTime) < this.config.cacheDuration;
    },

    /**
     * Obtém recomendações de destinos baseadas nas preferências do usuário
     * @param {Object} preferences - Preferências do usuário coletadas do questionário
     * @returns {Promise<Array>} - Array de destinos recomendados
     */
    async obterRecomendacoes(preferences) {
        // Notifica início do processo
        this.dispatchProgressEvent(10, "Iniciando análise de suas preferências de viagem... 🔍");
        
        // Gera ID para cache
        const cacheId = this.generateCacheId(preferences);
        
        // Verifica se temos dados em cache
        if (this.hasCachedData(cacheId)) {
            this.dispatchProgressEvent(100, "Recomendações encontradas! 🎉");
            return this.cache.recommendations[cacheId];
        }
        
        try {
            // Preparação dos dados
            this.dispatchProgressEvent(30, "Processando suas preferências... 🧮");
            const prompt = this.prepareAIPrompt(preferences);
            
            // Chamada à API de IA
            this.dispatchProgressEvent(50, "Consultando destinos ideais para seu perfil... 🌍");
            const aiResponse = await this.callAIService(prompt);
            
            // Processamento da resposta
            this.dispatchProgressEvent(80, "Organizando as melhores opções para você... 🗂️");
            const destinations = this.processAIResponse(aiResponse, preferences);
            
            // Salva no cache
            this.cache.recommendations[cacheId] = destinations;
            this.cache.timestamp[cacheId] = Date.now();
            this.saveCache();
            
            // Finaliza processo
            this.dispatchProgressEvent(100, "Recomendações prontas! 🎉");
            return destinations;
            
        } catch (error) {
            console.error("Erro ao obter recomendações:", error);
            
            // Usa recomendações locais em caso de falha
            if (this.config.useLocalFallback) {
                this.dispatchProgressEvent(90, "Finalizando recomendações... 📋");
                const fallbackRecommendations = this.getFallbackRecommendations(preferences);
                
                this.dispatchProgressEvent(100, "Recomendações prontas! 🎉");
                return fallbackRecommendations;
            }
            
            throw error;
        }
    },
    
    /**
     * Prepara o prompt para a API de IA
     */
    prepareAIPrompt(preferences) {
        // Extrai dados relevantes das preferências
        const {companhia, preferencia_viagem, moeda_escolhida, orcamento_valor, datas} = preferences;
        
        // Mapeia termos para linguagem natural
        const companhiaMap = {
            0: "sozinho",
            1: "em casal (viagem romântica)",
            2: "em família",
            3: "com amigos"
        };
        
        const preferenciaMap = {
            0: "relaxamento e descanso",
            1: "aventura e atividades ao ar livre",
            2: "cultura, história e gastronomia",
            3: "experiência urbana, compras e vida noturna"
        };
        
        // Constrói o prompt para a IA
        return `
        Você é a Tripinha, uma cachorra vira-lata caramelo especialista em viagens da Benetrip. 
        Preciso que recomende 5 destinos de viagem com base nas seguintes preferências:
        
        - Viajando ${companhiaMap[companhia]}
        - Busca principalmente: ${preferenciaMap[preferencia_viagem]}
        - Orçamento: ${orcamento_valor} ${moeda_escolhida}
        - Período aproximado da viagem: ${datas}
        
        Para cada destino, forneça:
        1. Nome da cidade e país
        2. Código IATA da cidade
        3. Descrição curta (30-40 palavras) no estilo animado e amigável da Tripinha
        4. Uma curiosidade interessante sobre o lugar
        5. Estimativa de preço de passagem em ${moeda_escolhida}
        6. Estimativa de preço de hospedagem por noite em ${moeda_escolhida}
        7. Uma tag principal que define o destino (ex: #Praia, #Aventura, #Cultural, #Urbano)
        
        Formate cada recomendação em JSON para eu poder processar facilmente. Inclua 5 destinos no total, organizados em ordem de relevância para as preferências informadas.
        `;
    },
    
    /**
     * Chama o serviço de IA para obter recomendações
     */
    async callAIService(prompt) {
        // Verifica se temos uma chave de API configurada
        if (!this.config.apiKey) {
            throw new Error("Chave de API de IA não configurada");
        }
        
        try {
            // Na implementação real, aqui seria feita a chamada à API de IA (OpenAI, Claude, etc.)
            // Para este exemplo, vamos simular uma resposta após um breve delay
            
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(this.getSimulatedAIResponse(prompt));
                }, 2000);
            });
            
            /* Exemplo de chamada real à API da OpenAI
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4",
                    messages: [
                        {role: "system", content: "Você é a Tripinha, uma cachorra vira-lata caramelo especialista em viagens da Benetrip."},
                        {role: "user", content: prompt}
                    ],
                    temperature: 0.7
                })
            });
            
            const data = await response.json();
            return data.choices[0].message.content;
            */
        } catch (error) {
            console.error("Erro ao chamar serviço de IA:", error);
            throw error;
        }
    },
    
    /**
     * Simula uma resposta da IA para desenvolvimento
     * Em produção, seria substituído pela resposta real da API
     */
    getSimulatedAIResponse(prompt) {
        // Análise simples do prompt para personalizar resposta
        let destinations = [];
        
        if (prompt.includes("relaxamento")) {
            destinations = [
                {
                    cidade: "Cancún",
                    pais: "México",
                    codigo_iata: "CUN",
                    descricao: "Praias de areia branca e águas cristalinas perfeitas para relaxar! Ideal para descansar com o melhor do Caribe sem complicações. 🏖️",
                    curiosidade: "A palavra Cancún significa 'ninho de serpentes' na língua maia original.",
                    preco_passagem: 2800,
                    preco_hospedagem: 350,
                    tag: "#Praia"
                },
                {
                    cidade: "Santorini",
                    pais: "Grécia",
                    codigo_iata: "JTR",
                    descricao: "Cenários de tirar o fôlego com casinhas brancas e o azul do mar Egeu. Um lugar perfeito para relaxar com vistas deslumbrantes! ✨",
                    curiosidade: "Santorini foi formada por uma enorme erupção vulcânica há cerca de 3.600 anos.",
                    preco_passagem: 3500,
                    preco_hospedagem: 400,
                    tag: "#Romântico"
                }
            ];
        } else if (prompt.includes("aventura")) {
            destinations = [
                {
                    cidade: "Queenstown",
                    pais: "Nova Zelândia",
                    codigo_iata: "ZQN",
                    descricao: "A capital mundial dos esportes de aventura! Bungee jump, rafting, esqui e cenários que parecem de filme de fantasia! 🏔️",
                    curiosidade: "Foi cenário para as filmagens da trilogia 'O Senhor dos Anéis'.",
                    preco_passagem: 4500,
                    preco_hospedagem: 300,
                    tag: "#Aventura"
                },
                {
                    cidade: "Costa Rica",
                    pais: "Costa Rica",
                    codigo_iata: "SJO",
                    descricao: "Florestas tropicais, vulcões ativos e tirolesas espetaculares! Um paraíso natural para quem ama adrenalina e vida selvagem! 🌴",
                    curiosidade: "A Costa Rica não possui exército desde 1949 e investe esses recursos em educação e saúde.",
                    preco_passagem: 2900,
                    preco_hospedagem: 250,
                    tag: "#Natureza"
                }
            ];
        } else if (prompt.includes("cultura")) {
            destinations = [
                {
                    cidade: "Kyoto",
                    pais: "Japão",
                    codigo_iata: "KIX",
                    descricao: "Templos ancestrais, jardins zen e a verdadeira cultura japonesa tradicional. Uma viagem no tempo com a melhor gastronomia! 🏯",
                    curiosidade: "Kyoto foi poupada dos bombardeios na Segunda Guerra Mundial devido ao seu valor histórico e cultural.",
                    preco_passagem: 4200,
                    preco_hospedagem: 320,
                    tag: "#Cultural"
                },
                {
                    cidade: "Praga",
                    pais: "República Tcheca",
                    codigo_iata: "PRG",
                    descricao: "Arquitetura medieval intacta, castelos de contos de fadas e uma rica história cultural. Cada rua conta uma história fascinante! 🏰",
                    curiosidade: "O Castelo de Praga é o maior castelo antigo do mundo.",
                    preco_passagem: 3100,
                    preco_hospedagem: 280,
                    tag: "#Histórico"
                }
            ];
        } else {
            destinations = [
                {
                    cidade: "Nova York",
                    pais: "Estados Unidos",
                    codigo_iata: "NYC",
                    descricao: "A cidade que nunca dorme! Shows da Broadway, museus de classe mundial e compras incríveis em cada esquina! 🗽",
                    curiosidade: "O metrô de Nova York tem 472 estações, mais que qualquer outro sistema de metrô no mundo.",
                    preco_passagem: 3800,
                    preco_hospedagem: 450,
                    tag: "#Urbano"
                },
                {
                    cidade: "Dubai",
                    pais: "Emirados Árabes Unidos",
                    codigo_iata: "DXB",
                    descricao: "Luxo inigualável, arranha-céus futuristas e shopping centers gigantescos. Uma experiência urbana como nenhuma outra! 🏙️",
                    curiosidade: "O Burj Khalifa é tão alto que você pode assistir ao pôr do sol na base e subir ao topo para vê-lo novamente.",
                    preco_passagem: 4100,
                    preco_hospedagem: 500,
                    tag: "#Luxo"
                }
            ];
        }
        
        // Adiciona mais 3 destinos padrão para completar os 5 recomendados
        destinations.push(
            {
                cidade: "Medellín",
                pais: "Colômbia",
                codigo_iata: "MDE",
                descricao: "Clima perfeito o ano todo, pessoas acolhedoras e uma cidade que se transformou em exemplo mundial! Experiências urbanas e naturais! 🌺",
                curiosidade: "Conhecida como 'Cidade da Eterna Primavera' pelo seu clima agradável durante todo o ano.",
                preco_passagem: 2500,
                preco_hospedagem: 200,
                tag: "#Tendência"
            },
            {
                cidade: "Lisboa",
                pais: "Portugal",
                codigo_iata: "LIS",
                descricao: "Ruelas charmosas, pastéis de nata e o charme único lusitano. Fado nas noites e praias incríveis pertinho do centro! 🎭",
                curiosidade: "Lisboa é construída sobre sete colinas, assim como Roma.",
                preco_passagem: 2900,
                preco_hospedagem: 280,
                tag: "#Cultural"
            },
            {
                cidade: "Bali",
                pais: "Indonésia",
                codigo_iata: "DPS",
                descricao: "Espiritualidade, praias paradisíacas e uma cultura única. Perfeita para relaxar, praticar yoga e conectar-se com a natureza! 🧘‍♀️",
                curiosidade: "Em Bali, cada criança recebe quatro nomes, independentemente do gênero.",
                preco_passagem: 3800,
                preco_hospedagem: 220,
                tag: "#Relax"
            }
        );
        
        // Retorna apenas 5 destinos
        return JSON.stringify({destinations: destinations.slice(0, 5)});
    },
    
    /**
     * Processa a resposta da IA e converte para formato utilizável
     */
    processAIResponse(response, preferences) {
        try {
            // Tenta fazer o parse da resposta
            let parsedResponse;
            
            if (typeof response === 'string') {
                // Extrai apenas o JSON da resposta, caso tenha outros textos
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsedResponse = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error("Formato de resposta inválido");
                }
            } else {
                parsedResponse = response;
            }
            
            // Verifica se há array de destinos
            if (!parsedResponse.destinations || !Array.isArray(parsedResponse.destinations)) {
                throw new Error("Resposta não contém lista de destinos");
            }
            
            // Formata os destinos conforme necessário para exibição
            const moeda = preferences.moeda_escolhida || 'BRL';
            
            return parsedResponse.destinations.map((destino, index) => {
                // Adiciona propriedades extras necessárias para o frontend
                return {
                    ...destino,
                    id: `dest-${index + 1}`,
                    moeda: moeda,
                    ranking: index + 1,
                    imagens: this.getImagePlaceholders(destino.cidade, destino.pais),
                    comentario_tripinha: this.generateTripinhaComment(destino, preferences)
                };
            });
        } catch (error) {
            console.error("Erro ao processar resposta da IA:", error);
            throw error;
        }
    },
    
    /**
     * Gera URLs de placeholder para imagens dos destinos
     * Na implementação real, seria substituído por chamadas à API de imagens (Unsplash, Pexels, etc.)
     */
    getImagePlaceholders(cidade, pais) {
        return {
            principal: `https://source.unsplash.com/featured/?${encodeURIComponent(cidade)},landmark`,
            secundaria: `https://source.unsplash.com/featured/?${encodeURIComponent(pais)},travel`
        };
    },
    
    /**
     * Gera um comentário personalizado da Tripinha para cada destino
     */
    generateTripinhaComment(destino, preferences) {
        const comentarios = [
            `Eu simplesmente AMEI ${destino.cidade}! Um lugar cheio de energia e experiências pra você curtir do seu jeito! 🐾`,
            `${destino.cidade} é perfeito para quem busca ${destino.tag.replace('#','')}! Eu visitaria esse lugar com certeza! 🐶`,
            `O que acha de explorar ${destino.cidade}? Eu ficaria super animada pra conhecer cada cantinho! 🧳`,
            `${destino.cidade} me conquistou! E tenho certeza que vai te conquistar também! Que tal arrumar as malas? ✨`
        ];
        
        return comentarios[Math.floor(Math.random() * comentarios.length)];
    },
    
    /**
     * Retorna recomendações locais se a IA falhar
     */
    getFallbackRecommendations(preferences) {
        // Destinos padrão organizados por tipo de preferência
        const destinos = {
            relaxamento: [
                {
                    id: 'dest-1',
                    cidade: "Maceió",
                    pais: "Brasil",
                    codigo_iata: "MCZ",
                    descricao: "Praias paradisíacas de águas cristalinas e piscinas naturais. O lugar perfeito para relaxar ao som do mar! 🏝️",
                    curiosidade: "Maceió possui mais de 40km de litoral com praias urbanas e selvagens.",
                    preco_passagem: 1200,
                    preco_hospedagem: 200,
                    tag: "#Praia",
                    ranking: 1
                },
                {
                    id: 'dest-2',
                    cidade: "Gramado",
                    pais: "Brasil",
                    codigo_iata: "CXJ",
                    descricao: "Clima europeu, fondue e muito charme. Um cantinho aconchegante para descansar com conforto! 🏡",
                    curiosidade: "Em Gramado, há mais chocolaterias por metro quadrado que em qualquer outra cidade brasileira.",
                    preco_passagem: 900,
                    preco_hospedagem: 280,
                    tag: "#Romântico",
                    ranking: 2
                }
            ],
            aventura: [
                {
                    id: 'dest-1',
                    cidade: "Bonito",
                    pais: "Brasil",
                    codigo_iata: "BYO",
                    descricao: "Rios de águas transparentes, cavernas e trilhas incríveis. Um paraíso natural para os aventureiros! 🌊",
                    curiosidade: "A transparência da água em Bonito é resultado de um fenômeno geológico de filtragem natural.",
                    preco_passagem: 1100,
                    preco_hospedagem: 220,
                    tag: "#Natureza",
                    ranking: 1
                },
                {
                    id: 'dest-2',
                    cidade: "Chapada dos Veadeiros",
                    pais: "Brasil",
                    codigo_iata: "BSB",
                    descricao: "Cachoeiras imponentes, trilhas desafiadoras e energia pura! O destino ideal para quem ama natureza selvagem! 🏞️",
                    curiosidade: "A Chapada dos Veadeiros está sobre uma imensa placa de cristal de quartzo, que dizem ter propriedades energéticas.",
                    preco_passagem: 850,
                    preco_hospedagem: 180,
                    tag: "#Aventura",
                    ranking: 2
                }
            ],
            cultura: [
                {
                    id: 'dest-1',
                    cidade: "Salvador",
                    pais: "Brasil",
                    codigo_iata: "SSA",
                    descricao: "Cultura afro-brasileira vibrante, centro histórico colorido e a melhor música! Uma explosão cultural à beira-mar! 🥁",
                    curiosidade: "O Elevador Lacerda em Salvador foi o primeiro elevador urbano do mundo.",
                    preco_passagem: 950,
                    preco_hospedagem: 200,
                    tag: "#Cultural",
                    ranking: 1
                },
                {
                    id: 'dest-2',
                    cidade: "Ouro Preto",
                    pais: "Brasil",
                    codigo_iata: "BHZ",
                    descricao: "Joias do barroco brasileiro, ruas de pedra e história em cada esquina! Um museu a céu aberto! ⛪",
                    curiosidade: "Ouro Preto foi a primeira cidade brasileira a ser declarada Patrimônio Cultural da Humanidade pela UNESCO.",
                    preco_passagem: 800,
                    preco_hospedagem: 220,
                    tag: "#Histórico",
                    ranking: 2
                }
            ],
            urbano: [
                {
                    id: 'dest-1',
                    cidade: "São Paulo",
                    pais: "Brasil",
                    codigo_iata: "GRU",
                    descricao: "Gastronomia mundial, museus incríveis e vida noturna agitada. A metrópole que nunca para! 🌆",
                    curiosidade: "São Paulo tem a maior frota de helicópteros do mundo e o segundo maior tráfego de helicópteros, atrás apenas de Nova York.",
                    preco_passagem: 700,
                    preco_hospedagem: 250,
                    tag: "#Urbano",
                    ranking: 1
                },
                {
                    id: 'dest-2',
                    cidade: "Rio de Janeiro",
                    pais: "Brasil",
                    codigo_iata: "GIG",
                    descricao: "Praias icônicas, Cristo Redentor e o jeito carioca de ser! A mistura perfeita de cidade e natureza! 🏄‍♂️",
                    curiosidade: "O Rio de Janeiro foi a única cidade da América do Sul a já ter sido capital de um império europeu (Império Português).",
                    preco_passagem: 750,
                    preco_hospedagem: 300,
                    tag: "#CidadeMaravilhosa",
                    ranking: 2
                }
            ]
        };
        
        // Seleciona os destinos com base na preferência
        let tipoPreferencia = 'relaxamento';
        if (preferences.preferencia_viagem === 1) tipoPreferencia = 'aventura';
        if (preferences.preferencia_viagem === 2) tipoPreferencia = 'cultura';
        if (preferences.preferencia_viagem === 3) tipoPreferencia = 'urbano';
        
        // Adiciona destinos padrão para completar 5
        let recomendacoes = [...destinos[tipoPreferencia]];
        
        const destinosComplementares = [
            {
                id: 'dest-3',
                cidade: "Jericoacoara",
                pais: "Brasil",
                codigo_iata: "JJD",
                descricao: "Dunas, ventos perfeitos e paisagens de outro mundo. Um vilarejo rústico que é paraíso dos kitesurfistas! 🏄‍♀️",
                curiosidade: "Em Jericoacoara não existem ruas pavimentadas, apenas areia.",
                preco_passagem: 1300,
                preco_hospedagem: 240,
                tag: "#ParaísoNatural",
                ranking: 3
            },
            {
                id: 'dest-4',
                cidade: "Natal",
                pais: "Brasil",
                codigo_iata: "NAT",
                descricao: "Sol o ano inteiro, dunas gigantes e passeios de buggy emocionantes! A capital do sol não decepciona! 🌞",
                curiosidade: "Natal tem o ar mais puro das Américas devido às correntes marítimas.",
                preco_passagem: 950,
                preco_hospedagem: 180,
                tag: "#Dunas",
                ranking: 4
            },
            {
                id: 'dest-5',
                cidade: "Curitiba",
                pais: "Brasil",
                codigo_iata: "CWB",
                descricao: "Parques urbanos, transporte eficiente e qualidade de vida. Uma cidade planejada que encanta! 🌳",
                curiosidade: "Curitiba tem o primeiro ônibus biarticulado do mundo e um dos sistemas de transporte público mais eficientes.",
                preco_passagem: 800,
                preco_hospedagem: 200,
                tag: "#CidadeVerde",
                ranking: 5
            }
        ];
        
        recomendacoes = recomendacoes.concat(destinosComplementares);
        
        // Adiciona propriedades extras
        const moeda = preferences.moeda_escolhida || 'BRL';
        return recomendacoes.map(destino => {
            return {
                ...destino,
                moeda: moeda,
                imagens: this.getImagePlaceholders(destino.cidade, destino.pais),
                comentario_tripinha: this.generateTripinhaComment(destino, preferences)
            };
        });
    },
    
    /**
     * Despacha evento de progresso para atualizar a interface
     */
    dispatchProgressEvent(progress, message) {
        const event = new CustomEvent('benetrip_progress', {
            detail: {
                progress: progress,
                message: message
            }
        });
        window.dispatchEvent(event);
    }
};

// Exporta o serviço para uso global
window.BENETRIP_AI = BENETRIP_AI;
