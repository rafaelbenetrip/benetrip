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
    maxRetries: 20,
    defaultTimeout: 30000 // 30 segundos de timeout padrão
},

    /**
     * Inicializa o serviço de API
     */
    init() {
        console.log("Serviço de API Aviasales inicializado");
        
        // Verifica se há uma busca anterior no sessionStorage para recuperar
        this.checkPreviousSearch();
        
        return this;
    },

    /**
     * Verifica se há uma busca anterior salva
     */
    checkPreviousSearch() {
        try {
            const lastSearch = sessionStorage.getItem('benetrip_last_search');
            if (lastSearch) {
                console.log("Busca anterior encontrada:", JSON.parse(lastSearch));
            }
        } catch (error) {
            console.warn("Erro ao verificar busca anterior:", error);
        }
    },

    /**
     * Busca voos entre origem e destino
     * @param {Object} params - Parâmetros da busca
     * @returns {Promise<Object>} - Resultados da busca
     */
    async buscarVoos(params) {
        console.log("Iniciando busca de voos com parâmetros:", params);
        
        try {
            // Validar e normalizar parâmetros
            params = this.validateAndNormalizeParams(params);
            
            // Salvar busca atual no sessionStorage para recuperação se necessário
            sessionStorage.setItem('benetrip_last_search', JSON.stringify({
                timestamp: Date.now(),
                params: params
            }));
            
            // Notificar início da busca
            this.dispatchProgressEvent(10, "Iniciando busca de voos... ✈️");
            
            // Tentar usar mock em ambiente de desenvolvimento ou teste
            if (this.isDevEnvironment() || params.useMock) {
                console.log("Usando dados mock para ambiente de desenvolvimento");
                return await this.getMockFlightResults(params);
            }
            
            // Usar nossa função de backend para buscar voos com timeout
            this.dispatchProgressEvent(30, "Consultando as melhores ofertas para você... 🔍");
            
            // Criar controller para abortar se levar muito tempo
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.defaultTimeout);
            
            try {
                const response = await fetch(this.config.searchBaseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(params),
                    signal: controller.signal
                });
                
                // Limpar o timeout
                clearTimeout(timeoutId);
                
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
                
                // Armazenar search_id para polling posterior se necessário
                if (resultados.search_id) {
                    sessionStorage.setItem('benetrip_search_id', resultados.search_id);
                    console.log("Search ID armazenado para polling:", resultados.search_id);
                }
                
                // Processar resultados para formato amigável
                this.dispatchProgressEvent(80, "Organizando os melhores voos... 📋");
                const processed = this.processResults(resultados, params);
                
                // Finalizar busca
                this.dispatchProgressEvent(100, "Voos encontrados! 🎉");
                return processed;
                
            } catch (error) {
                // Limpar o timeout em caso de erro
                clearTimeout(timeoutId);
                
                // Se for um erro de timeout, mostrar mensagem específica
                if (error.name === 'AbortError') {
                    console.warn("A busca excedeu o tempo limite. Usando dados mock como fallback.");
                    return await this.getMockFlightResults(params);
                }
                
                throw error;
            }
            
        } catch (error) {
            console.error("Erro ao buscar voos:", error);
            
            // Em caso de erro, tentar usar dados mock como fallback
            if (this.isDevEnvironment()) {
                console.warn("Usando dados mock como fallback após erro");
                return await this.getMockFlightResults(params);
            }
            
            throw error;
        }
    },

    /**
     * Verifica se está em ambiente de desenvolvimento
     */
    isDevEnvironment() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.search.includes('dev=true') ||
               window.location.search.includes('mock=true');
    },

    /**
     * Obtém resultados mock para desenvolvimento e testes
     */
    async getMockFlightResults(params) {
        // Simular delay de rede para parecer mais real
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        this.dispatchProgressEvent(75, "Preparando resultados de teste... 📋");
        
        // Criar dados mock
        const voosMock = [
            {
                id: 'mock-1',
                segmentos: [
                    {
                        partida: {
                            aeroporto: params.origem,
                            data: params.dataIda,
                            hora: '08:15'
                        },
                        chegada: {
                            aeroporto: params.destino,
                            data: params.dataIda,
                            hora: '12:30'
                        },
                        companhia: 'LATAM',
                        paradas: 0,
                        duracao: '4h 15m'
                    }
                ],
                duracaoTotal: '4h 15m',
                preco: {
                    total: 1240.50,
                    moeda: 'BRL'
                },
                bagagem: '1PC',
                direto: true,
                companhias: ['LA'],
                urlReserva: '#'
            },
            {
                id: 'mock-2',
                segmentos: [
                    {
                        partida: {
                            aeroporto: params.origem,
                            data: params.dataIda,
                            hora: '10:45'
                        },
                        chegada: {
                            aeroporto: params.destino,
                            data: params.dataIda,
                            hora: '17:30'
                        },
                        companhia: 'GOL',
                        paradas: 1,
                        duracao: '6h 45m'
                    }
                ],
                duracaoTotal: '6h 45m',
                preco: {
                    total: 890.20,
                    moeda: 'BRL'
                },
                bagagem: '1PC',
                direto: false,
                companhias: ['G3'],
                urlReserva: '#'
            },
            {
                id: 'mock-3',
                segmentos: [
                    {
                        partida: {
                            aeroporto: params.origem,
                            data: params.dataIda,
                            hora: '15:20'
                        },
                        chegada: {
                            aeroporto: params.destino,
                            data: params.dataIda,
                            hora: '21:10'
                        },
                        companhia: 'AZUL',
                        paradas: 0,
                        duracao: '5h 50m'
                    }
                ],
                duracaoTotal: '5h 50m',
                preco: {
                    total: 1050.75,
                    moeda: 'BRL'
                },
                bagagem: '1PC',
                direto: true,
                companhias: ['AD'],
                urlReserva: '#'
            }
        ];
        
        // Se tiver data de volta, adicionar voos de volta
        if (params.dataVolta) {
            voosMock.forEach(voo => {
                const dataVolta = params.dataVolta;
                const segmentoVolta = {
                    partida: {
                        aeroporto: params.destino,
                        data: dataVolta,
                        hora: '14:30'
                    },
                    chegada: {
                        aeroporto: params.origem,
                        data: dataVolta,
                        hora: '19:45'
                    },
                    companhia: voo.segmentos[0].companhia,
                    paradas: voo.segmentos[0].paradas,
                    duracao: voo.segmentos[0].duracao
                };
                
                voo.segmentos.push(segmentoVolta);
            });
        }
        
        // Finalizar busca
        this.dispatchProgressEvent(100, "Voos encontrados! 🎉");
        
        return {
            success: true,
            origem: params.origem,
            destino: params.destino,
            dataIda: params.dataIda,
            dataVolta: params.dataVolta,
            adultos: params.adultos,
            criancas: params.criancas || 0,
            bebes: params.bebes || 0,
            voos: voosMock,
            totalResultados: voosMock.length,
            filtros: this.generateFilters(voosMock),
            isMock: true
        };
    },

    /**
     * Valida e normaliza parâmetros da busca
     */
    validateAndNormalizeParams(params) {
        // Criar uma cópia para evitar modificar o objeto original
        const validatedParams = { ...params };
        
        // Garantir que parâmetros obrigatórios existem
        const required = ['origem', 'destino', 'dataIda', 'adultos'];
        const missing = required.filter(field => !validatedParams[field]);
        
        if (missing.length > 0) {
            console.error(`Parâmetros obrigatórios ausentes: ${missing.join(', ')}`);
            throw new Error(`Parâmetros obrigatórios ausentes: ${missing.join(', ')}`);
        }
        
        // Normalizar código IATA (sempre em maiúsculas)
        validatedParams.origem = validatedParams.origem.toUpperCase();
        validatedParams.destino = validatedParams.destino.toUpperCase();
        
        // Validar formato de código IATA
        const iataRegex = /^[A-Z]{3}$/;
        if (!iataRegex.test(validatedParams.origem) || !iataRegex.test(validatedParams.destino)) {
            console.error("Códigos IATA inválidos:", validatedParams.origem, validatedParams.destino);
            throw new Error("Código IATA inválido. Use 3 letras maiúsculas");
        }
        
        // Validar e normalizar formato de data
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(validatedParams.dataIda)) {
            console.error("Formato de data de ida inválido:", validatedParams.dataIda);
            throw new Error("Formato de data de ida inválido. Use YYYY-MM-DD");
        }
        
        if (validatedParams.dataVolta && !dateRegex.test(validatedParams.dataVolta)) {
            console.error("Formato de data de volta inválido:", validatedParams.dataVolta);
            throw new Error("Formato de data de volta inválido. Use YYYY-MM-DD");
        }
        
        // Garantir que adultos é um número
        validatedParams.adultos = parseInt(validatedParams.adultos) || 1;
        
        // Garantir que crianças e bebês são números
        if (validatedParams.criancas !== undefined) {
            validatedParams.criancas = parseInt(validatedParams.criancas) || 0;
        }
        
        if (validatedParams.bebes !== undefined) {
            validatedParams.bebes = parseInt(validatedParams.bebes) || 0;
        }
        
        return validatedParams;
    },

    /**
     * Processa resultados de voos para formato amigável ao usuário
     */
    processResults(results, params) {
        console.log("Processando resultados brutos:", results);
        
        // Se o resultado for um objeto com propriedade 'resultados', extrair os resultados
        if (results.resultados) {
            results = results.resultados;
        }
        
        // Verificar se temos um search_id (útil para polling e redirecionamento)
        if (results.search_id) {
            sessionStorage.setItem('benetrip_search_id', results.search_id);
        }
        
        // Verifica se temos resultados válidos
        if (!results || !results.proposals || results.proposals.length === 0) {
            console.warn("Nenhuma proposta encontrada nos resultados");
            return {
                success: false,
                message: "Não foram encontrados voos para esta rota e data."
            };
        }
        
        try {
            // Extrair dados importantes de cada proposta
            const voosProcessados = results.proposals.map((proposta, index) => {
                try {
                    // Calcular duração total em formato legível
                    const duracaoTotal = this.formatDuration(proposta.total_duration);
                    
                    // Extrair informações dos segmentos (ida e volta)
                    const segmentos = proposta.segment.map(seg => {
                        // Verificar se temos dados válidos
                        if (!seg.flight || !Array.isArray(seg.flight) || seg.flight.length === 0) {
                            console.warn(`Segmento sem dados de voo válidos: ${index}`);
                            return null;
                        }
                        
                        // Obter primeiro e último voo do segmento
                        const primeiroVoo = seg.flight[0];
                        const ultimoVoo = seg.flight[seg.flight.length - 1];
                        
                        if (!primeiroVoo || !ultimoVoo) {
                            console.warn(`Dados de voo incompletos no segmento: ${index}`);
                            return null;
                        }
                        
                        return {
                            partida: {
                                aeroporto: primeiroVoo.departure,
                                data: primeiroVoo.departure_date,
                                hora: primeiroVoo.departure_time
                            },
                            chegada: {
                                aeroporto: ultimoVoo.arrival,
                                data: ultimoVoo.arrival_date,
                                hora: ultimoVoo.arrival_time
                            },
                            companhia: primeiroVoo.marketing_carrier,
                            paradas: seg.flight.length - 1,
                            duracao: this.formatDuration(seg.flight.reduce((acc, f) => acc + (f.duration || 0), 0))
                        };
                    }).filter(seg => seg !== null);
                    
                    // Se não tivermos segmentos válidos, pular esta proposta
                    if (segmentos.length === 0) {
                        console.warn(`Proposta ${index} não tem segmentos válidos, pulando`);
                        return null;
                    }
                    
                    // Extrai termos de preço considerando diferentes formatos
                    const termKey = Object.keys(proposta.terms || {})[0] || "default";
                    const termObj = proposta.terms ? proposta.terms[termKey] : null;
                    
                    // Extrair informações de preço de forma segura
                    const preco = {
                        total: termObj?.total || termObj?.price || termObj?.unified_price || 0,
                        moeda: termObj?.currency || "BRL"
                    };
                    
                    // Informações sobre bagagem
                    const bagagem = termObj?.flights_baggage || 
                                    termObj?.flights_handbags ||
                                    "Verificar com a companhia";
                    
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
                } catch (err) {
                    console.error(`Erro ao processar proposta ${index}:`, err);
                    return null;
                }
            }).filter(voo => voo !== null); // Remover propostas que falharam
            
            // Verificar se temos resultados válidos após processamento
            if (voosProcessados.length === 0) {
                console.warn("Nenhum voo válido após processamento");
                return {
                    success: false,
                    message: "Não foi possível processar os resultados dos voos."
                };
            }
            
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
                filtros: this.generateFilters(voosProcessados),
                searchId: results.search_id
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
        if (!minutes || isNaN(minutes)) return 'N/A';
        
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
        
        // Se não houver preços válidos, usar valores padrão
        if (precos.length === 0) {
            return {
                companhias: companhias,
                paradas: [0, 1, 2],
                precos: {
                    min: 0,
                    max: 5000,
                    faixas: [
                        {min: 0, max: 1250},
                        {min: 1250, max: 2500},
                        {min: 2500, max: 3750},
                        {min: 3750, max: 5000}
                    ]
                }
            };
        }
        
        const minPreco = Math.min(...precos);
        const maxPreco = Math.max(...precos);
        
        // Criar faixas de preço (4 faixas distribuídas)
        const faixaPreco = maxPreco > minPreco ? [
            {min: minPreco, max: minPreco + (maxPreco - minPreco) / 4},
            {min: minPreco + (maxPreco - minPreco) / 4, max: minPreco + 2 * (maxPreco - minPreco) / 4},
            {min: minPreco + 2 * (maxPreco - minPreco) / 4, max: minPreco + 3 * (maxPreco - minPreco) / 4},
            {min: minPreco + 3 * (maxPreco - minPreco) / 4, max: maxPreco}
        ] : [
            {min: minPreco * 0.75, max: minPreco * 1.25}
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
            
            // Verificar se temos resultados em cache
            const cacheKey = `autocomplete_${termo.toLowerCase()}`;
            const cachedResults = sessionStorage.getItem(cacheKey);
            
            if (cachedResults) {
                const { timestamp, data } = JSON.parse(cachedResults);
                // Cache válido por 1 hora
                if (Date.now() - timestamp < 3600000) {
                    console.log("Usando resultados em cache para:", termo);
                    return data;
                }
            }
            
            // URL da API Aviasales Autocomplete
            const url = `${this.config.autocompleteUrl}?term=${encodeURIComponent(termo)}&locale=pt&types[]=city&types[]=airport`;
            
            console.log("Chamando API:", url);
            
            // Fazer a requisição usando fetch com timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            try {
                const response = await fetch(url, { signal: controller.signal });
                
                // Limpar o timeout
                clearTimeout(timeoutId);
                
                // Verificar se a requisição foi bem sucedida
                if (!response.ok) {
                    console.error("Erro na API:", response.status, response.statusText);
                    throw new Error(`Erro na API: ${response.status}`);
                }
                
                // Converter resposta para JSON
                const data = await response.json();
                console.log("Resposta da API:", data);
                
                // Armazenar em cache
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    data: data
                }));
                
                // Retornar resultados da API
                return data;
                
            } catch (error) {
                // Limpar o timeout em caso de erro
                clearTimeout(timeoutId);
                
                // Se for um erro de timeout, usar o cache ou simulação
                if (error.name === 'AbortError') {
                    console.warn("Timeout na API de autocomplete, usando simulação");
                    return this.simulateAutocompleteCities(termo);
                }
                
                throw error;
            }
            
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
            { name: "Dubai", code: "DXB", country_code: "AE", country_name: "Emirados Árabes" },
            // Adicionando mais cidades para maior cobertura
            { name: "Barcelona", code: "BCN", country_code: "ES", country_name: "Espanha" },
            { name: "Amsterdã", code: "AMS", country_code: "NL", country_name: "Holanda" },
            { name: "Berlim", code: "BER", country_code: "DE", country_name: "Alemanha" },
            { name: "Frankfurt", code: "FRA", country_code: "DE", country_name: "Alemanha" },
            { name: "Milão", code: "MIL", country_code: "IT", country_name: "Itália" },
            { name: "Sydney", code: "SYD", country_code: "AU", country_name: "Austrália" },
            { name: "Toronto", code: "YTO", country_code: "CA", country_name: "Canadá" },
            { name: "Cancún", code: "CUN", country_code: "MX", country_name: "México" },
            { name: "Lima", code: "LIM", country_code: "PE", country_name: "Peru" },
            { name: "Bogotá", code: "BOG", country_code: "CO", country_name: "Colômbia" },
            { name: "Medellín", code: "MDE", country_code: "CO", country_name: "Colômbia" },
            { name: "Cartagena", code: "CTG", country_code: "CO", country_name: "Colômbia" }
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
