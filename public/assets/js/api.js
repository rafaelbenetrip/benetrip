/**
 * Serviço de API Aviasales para a Benetrip
 * Este módulo gerencia a integração com a API Aviasales para busca de voos e autocomplete
 */

const BENETRIP_API = {
/**
 * Configurações da API
 */
config: {
    // Removidas credenciais hardcoded por razões de segurança
    // Todas as credenciais são gerenciadas pelo backend
    searchBaseUrl: '/api/flight-search', // Endpoint do Vercel
    resultsBaseUrl: '/api/flight-search-results', // Endpoint para polling
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
        
        // Usar nossa função de backend para buscar voos
        this.dispatchProgressEvent(30, "Consultando as melhores ofertas para você... 🔍");
        
        const response = await fetch(this.config.searchBaseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        
        if (!response.ok) {
            let errorMessage = `Erro na API de voos: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage += ` - ${errorData.error || 'Erro desconhecido'}`;
            } catch (e) {
                // Se não conseguir ler o JSON de erro
                errorMessage += ' - Não foi possível obter detalhes do erro';
            }
            
            throw new Error(errorMessage);
        }
        
        const resultados = await response.json();
        
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
     * Processa resultados de voos para formato amigável ao usuário
     */
    processResults(results, params) {
        // Se o resultado for um objeto com propriedade 'resultados', extrair os resultados
        if (results.resultados) {
            results = results.resultados;
        }
        
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
                    total: proposta.terms["48"]?.total || proposta.terms["48"]?.price,
                    moeda: proposta.terms["48"]?.currency || "BRL"
                } : {
                    total: "Indisponível",
                    moeda: "BRL"
                };
                
                // Informações sobre bagagem
                const bagagem = proposta.terms && proposta.terms["48"]?.flights_baggage 
                    ? proposta.terms["48"].flights_baggage 
                    : "Verificar com a companhia";
                
                return {
                    id: proposta.sign || `voo-${index + 1}`,
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
     * Realiza polling para obter resultados de voos
     */
    async realizarPollingResultados(searchId, maxTentativas = 10) {
        try {
            let tentativas = 0;
            
            while (tentativas < maxTentativas) {
                tentativas++;
                
                this.dispatchProgressEvent(30 + (tentativas / maxTentativas) * 50, 
                    `Buscando voos (tentativa ${tentativas})... ⏳`);
                
                // Aguardar entre tentativas
                await new Promise(r => setTimeout(r, this.config.requestDelay));
                
                // Realizar requisição de polling
                const response = await fetch(`${this.config.resultsBaseUrl}?searchId=${searchId}`);
                
                if (!response.ok) {
                    console.warn(`Tentativa ${tentativas}: erro na requisição`);
                    continue;
                }
                
                const data = await response.json();
                
                // Verificar se temos resultados
                if (data.resultados && data.resultados.proposals && 
                    data.resultados.proposals.length > 0) {
                    return data;
                }
                
                // Se for a última tentativa sem resultados
                if (tentativas === maxTentativas) {
                    return { 
                        success: false,
                        message: "Tempo limite excedido ao buscar voos" 
                    };
                }
            }
            
            return { 
                success: false,
                message: "Não foi possível encontrar voos no momento" 
            };
            
        } catch (error) {
            console.error("Erro ao realizar polling de resultados:", error);
            throw error;
        }
    },

    /**
     * Gera link de reserva para um voo específico
     */
    async gerarLinkReserva(vooId, searchId) {
        try {
            // Em ambiente real, far-se-ia uma chamada ao backend para gerar o link
            return `/api/generate-booking-link?vooId=${vooId}&searchId=${searchId}`;
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
            const url = `${this.config.autocompleteUrl}?term=${encodeURIComponent(termo)}&locale=pt&types[]=city&types[]=airport`;
            
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
