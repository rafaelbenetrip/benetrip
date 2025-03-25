/**
 * Serviço de API Aviasales para a Benetrip
 * Este módulo gerencia a integração com a API Aviasales para busca de voos e autocomplete
 */

const BENETRIP_API = {
/**
 * Configurações da API
 */
config: {
    marker: '604241', // Era process.env.AVIASALES_MARKER || '604241'
    token: 'e82f7d420689b6124dcfa5921a8c6934', // Era process.env.AVIASALES_TOKEN || 'e82f7d420689b6124dcfa5921a8c6934'
    host: 'benetrip.com.br', // Era process.env.HOST || 'benetrip.com.br'
    searchBaseUrl: 'https://api.travelpayouts.com/v1/flight_search',
    resultsBaseUrl: 'https://api.travelpayouts.com/v1/flight_search_results',
    clicksBaseUrl: 'https://api.travelpayouts.com/v1/flight_searches',
    autocompleteUrl: 'https://autocomplete.travelpayouts.com/places2',
    requestDelay: 2000,
    maxRetries: 20
},

    /**
     * Inicializa o serviço de API
     */
    init() {
        console.log("Serviço de API Aviasales inicializado");
        return this;
    },

    /**
     * Busca voos entre origem e destino
     * @param {Object} params - Parâmetros da busca
     * @returns {Promise<Object>} - Resultados da busca
     */
    async buscarVoos(params) {
        try {
            // Validar parâmetros
            this.validateFlightParams(params);
            
            // Notificar início da busca
            this.dispatchProgressEvent(10, "Iniciando busca de voos... ✈️");
            
            // Inicializar busca e obter ID de pesquisa
            const searchId = await this.iniciarBusca(params);
            
            // Buscar resultados usando o ID de pesquisa
            this.dispatchProgressEvent(30, "Buscando as melhores ofertas para você... 🔍");
            const resultados = await this.obterResultados(searchId);
            
            // Processar resultados para formato amigável
            this.dispatchProgressEvent(80, "Organizando os melhores voos... 📋");
            const processed = this.processResults(resultados, params);
            
            // Finalizar busca
            this.dispatchProgressEvent(100, "Voos encontrados! 🎉");
            return processed;
            
        } catch (error) {
            console.error("Erro ao buscar voos:", error);
            throw error;
        }
    },

    /**
     * Valida parâmetros da busca de voos
     */
    validateFlightParams(params) {
        const required = ['origem', 'destino', 'dataIda', 'adultos'];
        
        for (const field of required) {
            if (!params[field]) {
                throw new Error(`Parâmetro obrigatório ausente: ${field}`);
            }
        }
        
        // Validar formato de data (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(params.dataIda)) {
            throw new Error("Formato de data inválido. Use YYYY-MM-DD");
        }
        
        if (params.dataVolta && !dateRegex.test(params.dataVolta)) {
            throw new Error("Formato de data inválido. Use YYYY-MM-DD");
        }
        
        // Validar IATA codes (3 letras maiúsculas)
        const iataRegex = /^[A-Z]{3}$/;
        if (!iataRegex.test(params.origem) || !iataRegex.test(params.destino)) {
            throw new Error("Código IATA inválido. Use 3 letras maiúsculas");
        }
    },

    /**
     * Gera assinatura para a API Aviasales
     */
    generateSignature(params) {
        // Na implementação real, usaria uma função de hash MD5
        // Para o MVP, estamos simplificando
        return "hash-simulado-para-demo";
    },

    /**
     * Inicia a busca na API Aviasales
     */
    async iniciarBusca(params) {
        try {
            // Preparar dados para a requisição
            const data = {
                signature: this.generateSignature(params),
                marker: this.config.marker,
                host: this.config.host,
                user_ip: "127.0.0.1", // Em produção, usar IP real do usuário
                locale: "pt",
                trip_class: params.classe || "Y", // Econômica por padrão
                passengers: {
                    adults: params.adultos || 1,
                    children: params.criancas || 0,
                    infants: params.bebes || 0
                },
                segments: []
            };
            
            // Adicionar segmento de ida
            data.segments.push({
                origin: params.origem,
                destination: params.destino,
                date: params.dataIda
            });
            
            // Adicionar segmento de volta, se aplicável
            if (params.dataVolta) {
                data.segments.push({
                    origin: params.destino,
                    destination: params.origem,
                    date: params.dataVolta
                });
            }
            
            // Na implementação real, fazer a requisição à API
            // Para o MVP, simulamos o retorno
            return this.simulateSearchId();
            
            /* Exemplo de código para a chamada real à API
            const response = await fetch(this.config.searchBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const responseData = await response.json();
            return responseData.search_id;
            */
        } catch (error) {
            console.error("Erro ao iniciar busca:", error);
            throw error;
        }
    },

    /**
     * Obtém resultados de busca usando o ID de pesquisa
     */
    async obterResultados(searchId) {
        try {
            let tentativas = 0;
            let resultados = null;
            
            // Loop para obter resultados (pode demorar alguns segundos)
            while (tentativas < this.config.maxRetries) {
                tentativas++;
                
                // Atualizar progresso a cada tentativa
                const progress = Math.min(30 + Math.floor(tentativas * 2.5), 75);
                this.dispatchProgressEvent(progress, `Buscando voos (tentativa ${tentativas})... ⏳`);
                
                // Simular delay da API
                await new Promise(resolve => setTimeout(resolve, this.config.requestDelay));
                
                // Simulação de resultados para o MVP
                resultados = this.simulateResults(searchId, tentativas);
                
                // Verificar se já temos resultados completos
                if (resultados && resultados.proposals && resultados.proposals.length > 0) {
                    break;
                }
                
                /* Código para chamada real à API
                const response = await fetch(`${this.config.resultsBaseUrl}?uuid=${searchId}`);
                resultados = await response.json();
                
                // Verificar se já temos resultados completos
                if (resultados && resultados.proposals && resultados.proposals.length > 0) {
                    break;
                }
                */
            }
            
            return resultados;
            
        } catch (error) {
            console.error("Erro ao obter resultados:", error);
            throw error;
        }
    },

    /**
     * Processa resultados de voos para formato amigável ao usuário
     */
    processResults(results, params) {
        // Verifica se temos resultados válidos
        if (!results || !results.proposals || results.proposals.length === 0) {
            return {
                success: false,
                message: "Não foram encontrados voos para esta rota e data."
            };
        }
        
        try {
            // Extrair dados importantes de cada proposta
            const voosProcessados = results.proposals.map((proposta, index) => {
                // Calcular duração total em formato legível
                const duracaoTotal = this.formatDuration(proposta.total_duration);
                
                // Extrair informações dos segmentos (ida e volta)
                const segmentos = proposta.segment.map(seg => {
                    return {
                        partida: {
                            aeroporto: seg.flight[0].departure,
                            data: seg.flight[0].departure_date,
                            hora: seg.flight[0].departure_time
                        },
                        chegada: {
                            aeroporto: seg.flight[seg.flight.length - 1].arrival,
                            data: seg.flight[seg.flight.length - 1].arrival_date,
                            hora: seg.flight[seg.flight.length - 1].arrival_time
                        },
                        companhia: seg.flight[0].marketing_carrier,
                        paradas: seg.flight.length - 1,
                        duracao: this.formatDuration(seg.flight.reduce((acc, f) => acc + f.duration, 0))
                    };
                });
                
                // Extrair informações de preço
                const preco = proposta.terms ? {
                    total: proposta.terms["48"].total || proposta.terms["48"].price,
                    moeda: proposta.terms["48"].currency || "BRL"
                } : {
                    total: "Indisponível",
                    moeda: "BRL"
                };
                
                // Informações sobre bagagem
                const bagagem = proposta.terms && proposta.terms["48"].flights_baggage 
                    ? proposta.terms["48"].flights_baggage 
                    : "Verificar com a companhia";
                
                return {
                    id: `voo-${index + 1}`,
                    segmentos: segmentos,
                    duracaoTotal: duracaoTotal,
                    preco: preco,
                    bagagem: bagagem,
                    direto: proposta.is_direct || false,
                    companhias: proposta.carriers || ["N/A"],
                    urlReserva: `link-reserva-${index}` // Será gerado dinâmicamente ao clicar
                };
            });
            
            // Ordenar por preço (do mais barato ao mais caro)
            voosProcessados.sort((a, b) => {
                const precoA = typeof a.preco.total === 'string' 
                    ? parseFloat(a.preco.total.replace(/[^0-9.]/g, '')) 
                    : a.preco.total;
                    
                const precoB = typeof b.preco.total === 'string'
                    ? parseFloat(b.preco.total.replace(/[^0-9.]/g, ''))
                    : b.preco.total;
                    
                return precoA - precoB;
            });
            
            // Retornar resultado processado
            return {
                success: true,
                origem: params.origem,
                destino: params.destino,
                dataIda: params.dataIda,
                dataVolta: params.dataVolta,
                adultos: params.adultos,
                criancas: params.criancas || 0,
                bebes: params.bebes || 0,
                voos: voosProcessados,
                totalResultados: voosProcessados.length,
                filtros: this.generateFilters(voosProcessados)
            };
            
        } catch (error) {
            console.error("Erro ao processar resultados:", error);
            return {
                success: false,
                message: "Erro ao processar resultados de voos."
            };
        }
    },

    /**
     * Formata duração em minutos para formato legível (ex: 2h 15m)
     */
    formatDuration(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0 && mins > 0) {
            return `${hours}h ${mins}m`;
        } else if (hours > 0) {
            return `${hours}h`;
        } else {
            return `${mins}m`;
        }
    },

    /**
     * Gera filtros baseados nos resultados disponíveis
     */
    generateFilters(voos) {
        // Extrair companhias aéreas únicas
        const companhias = [...new Set(voos.flatMap(v => v.companhias))];
        
        // Extrair faixas de preço
        const precos = voos.map(v => {
            const valor = typeof v.preco.total === 'string' 
                ? parseFloat(v.preco.total.replace(/[^0-9.]/g, ''))
                : v.preco.total;
            return valor;
        }).filter(p => !isNaN(p));
        
        const minPreco = Math.min(...precos);
        const maxPreco = Math.max(...precos);
        
        // Criar faixas de preço (4 faixas distribuídas)
        const faixaPreco = [
            {min: minPreco, max: minPreco + (maxPreco - minPreco) / 4},
            {min: minPreco + (maxPreco - minPreco) / 4, max: minPreco + 2 * (maxPreco - minPreco) / 4},
            {min: minPreco + 2 * (maxPreco - minPreco) / 4, max: minPreco + 3 * (maxPreco - minPreco) / 4},
            {min: minPreco + 3 * (maxPreco - minPreco) / 4, max: maxPreco}
        ];
        
        // Extrair opções de paradas
        const paradas = [...new Set(voos.flatMap(v => v.segmentos.map(s => s.paradas)))];
        
        return {
            companhias: companhias,
            paradas: paradas.sort(),
            precos: {
                min: minPreco,
                max: maxPreco,
                faixas: faixaPreco
            }
        };
    },

    /**
     * Gera link de reserva para um voo específico
     */
    async gerarLinkReserva(voId, searchId) {
        try {
            // Em produção, faria uma chamada à API para obter o link de reserva
            // Para o MVP, simulamos um link
            return `https://www.benetrip.com.br/reserva?voo=${voId}&search=${searchId}`;
            
            /* Código para chamada real à API
            const response = await fetch(`${this.config.clicksBaseUrl}/${searchId}/clicks/${termsUrl}.json?marker=${this.config.marker}`);
            const data = await response.json();
            return data.url;
            */
        } catch (error) {
            console.error("Erro ao gerar link de reserva:", error);
            throw error;
        }
    },

    /**
 * Busca sugestões de lugares para autocomplete usando a API Aviasales
 */
async buscarSugestoesCidade(termo) {
    try {
        console.log("Buscando sugestões para:", termo);
        
        // Ignorar busca se o termo for curto demais
        if (!termo || termo.length < 2) {
            return [];
        }
        
        // URL da API Aviasales Autocomplete
        const url = `https://autocomplete.travelpayouts.com/places2?term=${encodeURIComponent(termo)}&locale=pt&types[]=city&types[]=airport`;
        
        console.log("Chamando API:", url);
        
        // Fazer a requisição usando fetch
        const response = await fetch(url);
        
        // Verificar se a requisição foi bem sucedida
        if (!response.ok) {
            console.error("Erro na API:", response.status, response.statusText);
            throw new Error(`Erro na API: ${response.status}`);
        }
        
        // Converter resposta para JSON
        const data = await response.json();
        console.log("Resposta da API:", data);
        
        // Retornar resultados da API
        return data;
    } catch (error) {
        console.error("Erro ao buscar sugestões de cidade:", error);
        
        // Em caso de erro, retornar simulação para não travar a interface
        return this.simulateAutocompleteCities(termo);
    }
},

    /**
     * Simula ID de pesquisa para desenvolvimento
     */
    simulateSearchId() {
        return `search-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    },

    /**
     * Simula resultados de busca para desenvolvimento
     */
    simulateResults(searchId, tentativa) {
        // Nos primeiros 3 retornos, simular que não temos resultados ainda
        if (tentativa < 3) {
            return { search_id: searchId };
        }
        
        // Após a terceira tentativa, retornar resultados simulados
        return {
            search_id: searchId,
            proposals: [
                {
                    segment: [
                        {
                            flight: [
                                {
                                    departure: "GRU",
                                    departure_date: "2025-07-15",
                                    departure_time: "08:30",
                                    arrival: "MIA",
                                    arrival_date: "2025-07-15",
                                    arrival_time: "16:45",
                                    marketing_carrier: "AA",
                                    duration: 525
                                }
                            ]
                        },
                        {
                            flight: [
                                {
                                    departure: "MIA",
                                    departure_date: "2025-07-22",
                                    departure_time: "19:30",
                                    arrival: "GRU",
                                    arrival_date: "2025-07-23",
                                    arrival_time: "07:45",
                                    marketing_carrier: "AA",
                                    duration: 540
                                }
                            ]
                        }
                    ],
                    total_duration: 1065,
                    is_direct: true,
                    carriers: ["AA"],
                    terms: {
                        "48": {
                            total: "3450.75",
                            price: "3450.75",
                            currency: "BRL",
                            flights_baggage: "1PC"
                        }
                    }
                },
                {
                    segment: [
                        {
                            flight: [
                                {
                                    departure: "GRU",
                                    departure_date: "2025-07-15",
                                    departure_time: "10:20",
                                    arrival: "BOG",
                                    arrival_date: "2025-07-15",
                                    arrival_time: "14:10",
                                    marketing_carrier: "AV",
                                    duration: 350
                                },
                                {
                                    departure: "BOG",
                                    departure_date: "2025-07-15",
                                    departure_time: "16:30",
                                    arrival: "MIA",
                                    arrival_date: "2025-07-15",
                                    arrival_time: "20:50",
                                    marketing_carrier: "AV",
                                    duration: 260
                                }
                            ]
                        },
                        {
                            flight: [
                                {
                                    departure: "MIA",
                                    departure_date: "2025-07-22",
                                    departure_time: "21:30",
                                    arrival: "BOG",
                                    arrival_date: "2025-07-23",
                                    arrival_time: "00:50",
                                    marketing_carrier: "AV",
                                    duration: 260
                                },
                                {
                                    departure: "BOG",
                                    departure_date: "2025-07-23",
                                    departure_time: "02:10",
                                    arrival: "GRU",
                                    arrival_date: "2025-07-23",
                                    arrival_time: "09:15",
                                    marketing_carrier: "AV",
                                    duration: 365
                                }
                            ]
                        }
                    ],
                    total_duration: 1235,
                    is_direct: false,
                    carriers: ["AV"],
                    terms: {
                        "48": {
                            total: "2890.45",
                            price: "2890.45",
                            currency: "BRL",
                            flights_baggage: "1PC"
                        }
                    }
                },
                {
                    segment: [
                        {
                            flight: [
                                {
                                    departure: "GRU",
                                    departure_date: "2025-07-15",
                                    departure_time: "23:45",
                                    arrival: "PTY",
                                    arrival_date: "2025-07-16",
                                    arrival_time: "04:20",
                                    marketing_carrier: "CM",
                                    duration: 395
                                },
                                {
                                    departure: "PTY",
                                    departure_date: "2025-07-16",
                                    departure_time: "08:30",
                                    arrival: "MIA",
                                    arrival_date: "2025-07-16",
                                    arrival_time: "12:15",
                                    marketing_carrier: "CM",
                                    duration: 225
                                }
                            ]
                        },
                        {
                            flight: [
                                {
                                    departure: "MIA",
                                    departure_date: "2025-07-22",
                                    departure_time: "16:10",
                                    arrival: "PTY",
                                    arrival_date: "2025-07-22",
                                    arrival_time: "19:40",
                                    marketing_carrier: "CM",
                                    duration: 210
                                },
                                {
                                    departure: "PTY",
                                    departure_date: "2025-07-22",
                                    departure_time: "21:30",
                                    arrival: "GRU",
                                    arrival_date: "2025-07-23",
                                    arrival_time: "05:15",
                                    marketing_carrier: "CM",
                                    duration: 405
                                }
                            ]
                        }
                    ],
                    total_duration: 1235,
                    is_direct: false,
                    carriers: ["CM"],
                    terms: {
                        "48": {
                            total: "2750.30",
                            price: "2750.30",
                            currency: "BRL",
                            flights_baggage: "2PC"
                        }
                    }
                }
            ]
        };
    },

    /**
     * Simula resultado de autocomplete de cidades para desenvolvimento
     */
    simulateAutocompleteCities(termo) {
        const cidades = [
            { name: "São Paulo", code: "SAO", country_code: "BR", country_name: "Brasil" },
            { name: "Rio de Janeiro", code: "RIO", country_code: "BR", country_name: "Brasil" },
            { name: "Brasília", code: "BSB", country_code: "BR", country_name: "Brasil" },
            { name: "Salvador", code: "SSA", country_code: "BR", country_name: "Brasil" },
            { name: "Recife", code: "REC", country_code: "BR", country_name: "Brasil" },
            { name: "Nova York", code: "NYC", country_code: "US", country_name: "Estados Unidos" },
            { name: "Miami", code: "MIA", country_code: "US", country_name: "Estados Unidos" },
            { name: "Orlando", code: "MCO", country_code: "US", country_name: "Estados Unidos" },
            { name: "Los Angeles", code: "LAX", country_code: "US", country_name: "Estados Unidos" },
            { name: "Lisboa", code: "LIS", country_code: "PT", country_name: "Portugal" },
            { name: "Londres", code: "LON", country_code: "GB", country_name: "Reino Unido" },
            { name: "Paris", code: "PAR", country_code: "FR", country_name: "França" },
            { name: "Roma", code: "ROM", country_code: "IT", country_name: "Itália" },
            { name: "Madri", code: "MAD", country_code: "ES", country_name: "Espanha" },
            { name: "Buenos Aires", code: "BUE", country_code: "AR", country_name: "Argentina" },
            { name: "Santiago", code: "SCL", country_code: "CL", country_name: "Chile" },
            { name: "Cidade do México", code: "MEX", country_code: "MX", country_name: "México" },
            { name: "Tóquio", code: "TYO", country_code: "JP", country_name: "Japão" },
            { name: "Dubai", code: "DXB", country_code: "AE", country_name: "Emirados Árabes" }
        ];
        
        // Filtrar cidades que correspondem ao termo
        const termoLower = termo.toLowerCase();
        return cidades.filter(cidade => 
            cidade.name.toLowerCase().includes(termoLower) || 
            cidade.code.toLowerCase().includes(termoLower) ||
            cidade.country_name.toLowerCase().includes(termoLower)
        ).map(cidade => ({
            type: "city",
            code: cidade.code,
            name: cidade.name,
            country_code: cidade.country_code,
            country_name: cidade.country_name
        }));
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
window.BENETRIP_API = BENETRIP_API;
