/**
 * BENETRIP - Visualização de Voos
 * Controla a exibição e interação com os resultados de voos
 * Versão corrigida para resolver problemas de transição do fluxo de destinos
 */

const BENETRIP_VOOS = {
    /**
     * Configuração do módulo
     */
    config: {
        imagePath: 'assets/images/',
        companhiasLogos: {
            'AA': 'american-airlines.png',
            'LA': 'latam.png',
            'G3': 'gol.png',
            'AD': 'azul.png',
            'CM': 'copa.png',
            'AV': 'avianca.png',
            'UA': 'united.png',
            'DL': 'delta.png',
            'default': 'airline-default.png'
        },
        animationDelay: 300,
        debug: true // Habilita logs detalhados para debug
    },

    /**
     * Estados do módulo
     */
    estado: {
        resultados: null,
        voosSelecionados: [],
        filtros: {
            precoMax: null,
            precoMin: null,
            companhias: [],
            paradas: null,
            duracao: null
        },
        ordenacao: 'preco',
        fluxo: null,
        destinoEscolhido: null
    },

    /**
     * Inicializa o módulo de voos
     */
    init() {
        this.log("Inicializando módulo de voos...");
        
        // Carregar dados
        this.carregarDados();
        
        // Renderizar interface
        this.renderizarInterface();
        
        // Configurar eventos
        this.configurarEventos();
        
        return this;
    },

    /**
     * Método de log com suporte a debug
     */
    log(mensagem, dados = null) {
        if (!this.config.debug) return;
        
        console.log(`[BENETRIP_VOOS] ${mensagem}`);
        if (dados !== null) {
            console.log(dados);
        }
    },

    /**
     * Carrega dados do localStorage
     */
    carregarDados() {
        try {
            // Carregar preferências do usuário
            const dadosUsuario = localStorage.getItem('benetrip_user_data');
            this.log("Dados do usuário encontrados no localStorage", dadosUsuario ? "Sim" : "Não");
            
            if (dadosUsuario) {
                this.estado.dadosUsuario = JSON.parse(dadosUsuario);
                // Garantir que o fluxo existe, com valor padrão caso não exista
                this.estado.fluxo = this.estado.dadosUsuario.fluxo || 'destino_desconhecido';
                this.log("Fluxo identificado", this.estado.fluxo);
            } else {
                this.log("Dados do usuário não encontrados, redirecionando para início");
                this.redirecionarParaInicio();
                return;
            }
            
            // Verificar destino selecionado (tentando ambas as nomenclaturas)
            let destinoLocalStorage = localStorage.getItem('benetrip_destino_selecionado') || 
                                      localStorage.getItem('benetrip_destino_escolhido');
                                      
            this.log("Destino encontrado no localStorage", destinoLocalStorage ? "Sim" : "Não");
            
            if (destinoLocalStorage) {
                try {
                    this.estado.destinoEscolhido = JSON.parse(destinoLocalStorage);
                    this.log("Destino escolhido carregado com sucesso", this.estado.destinoEscolhido);
                    
                    // Padronizar o localStorage (se necessário)
                    if (!localStorage.getItem('benetrip_destino_escolhido')) {
                        localStorage.setItem('benetrip_destino_escolhido', destinoLocalStorage);
                    }
                } catch (parseError) {
                    this.log("Erro ao processar destino escolhido", parseError.message);
                    // Continuar mesmo com erro, pois pode haver outro fluxo
                }
            } else if (this.estado.fluxo !== 'destino_conhecido') {
                // Só redirecionar se não estiver no fluxo de destino conhecido
                this.log("Destino escolhido não encontrado, redirecionando para destinos");
                this.redirecionarParaDestinos();
                return;
            }
            
            // Carregar resultados de voos
            const resultadosVoos = localStorage.getItem('benetrip_resultados_voos');
            if (resultadosVoos) {
                this.estado.resultados = JSON.parse(resultadosVoos);
                this.log("Resultados de voos carregados do localStorage");
                
                // Configurar filtros baseados nos resultados
                this.configurarFiltrosIniciais();
            } else {
                // Se não tiver resultados, buscar voos
                this.log("Nenhum resultado de voo encontrado, iniciando busca");
                this.buscarVoos();
            }
            
            this.log("Dados carregados com sucesso");
        } catch (erro) {
            console.error("Erro ao carregar dados:", erro);
            this.redirecionarParaInicio();
        }
    },

    /**
     * Configura os filtros iniciais baseados nos resultados
     */
    configurarFiltrosIniciais() {
        if (!this.estado.resultados || !this.estado.resultados.voos) return;
        
        // Código existente...
    },

    /**
     * Redireciona para a página inicial
     */
    redirecionarParaInicio() {
        alert("Precisamos de algumas informações antes de mostrar os voos. Vamos recomeçar!");
        window.location.href = 'index.html';
    },

    /**
     * Redireciona para a página de destinos
     */
    redirecionarParaDestinos() {
        alert("Antes de ver os voos, você precisa escolher um destino!");
        window.location.href = 'destinos.html';
    },

    /**
     * Busca voos usando a API
     */
    buscarVoos() {
        // Mostrar overlay de carregamento
        this.mostrarCarregando(true, "Buscando as melhores opções de voos...");
        
        // Verificar se o serviço API está disponível
        if (!window.BENETRIP_API) {
            console.error("Serviço de API não disponível");
            this.mostrarErro("Serviço de busca não disponível no momento. Tente novamente mais tarde.");
            return;
        }
        
        // Preparar parâmetros para busca
        let params = {};
        
        if (this.estado.fluxo === 'destino_conhecido') {
            // Fluxo onde o usuário já sabia o destino
            const respostas = this.estado.dadosUsuario.respostas;
            
            params = {
                origem: this.obterCodigoIATAOrigem(respostas),
                destino: this.obterCodigoIATADestino(respostas.destino_conhecido),
                dataIda: this.obterDataIda(respostas),
                dataVolta: this.obterDataVolta(respostas),
                adultos: this.getNumeroAdultos(respostas)
            };
            
            this.log("Parâmetros de busca para destino conhecido", params);
        } else {
            // Fluxo de recomendação
            const destino = this.estado.destinoEscolhido;
            const respostas = this.estado.dadosUsuario.respostas;
            
            params = {
                origem: this.obterCodigoIATAOrigem(respostas),
                destino: this.obterCodigoIATADestino(destino),
                dataIda: this.obterDataIda(respostas),
                dataVolta: this.obterDataVolta(respostas),
                adultos: this.getNumeroAdultos(respostas)
            };
            
            this.log("Parâmetros de busca para destino recomendado", params);
        }
        
        // Verificação de segurança para parâmetros essenciais
        if (!params.origem || !params.destino || !params.dataIda) {
            this.log("Parâmetros insuficientes para busca", params);
            this.mostrarErro("Faltam informações necessárias para a busca de voos. Voltando à etapa anterior.");
            setTimeout(() => this.redirecionarParaDestinos(), 3000);
            return;
        }
        
        // Chamar API para busca de voos
        window.BENETRIP_API.buscarVoos(params)
            .then(resultados => {
                // Salvar resultados
                this.estado.resultados = resultados;
                localStorage.setItem('benetrip_resultados_voos', JSON.stringify(resultados));
                
                // Configurar filtros
                this.configurarFiltrosIniciais();
                
                // Atualizar interface
                this.renderizarInterface();
                
                // Esconder overlay de carregamento
                this.mostrarCarregando(false);
            })
            .catch(erro => {
                console.error("Erro ao buscar voos:", erro);
                this.mostrarErro("Ocorreu um erro ao buscar voos. Tente novamente mais tarde.");
                this.mostrarCarregando(false);
            });
    },

    /**
     * Métodos auxiliares para extrair informações consistentemente
     */
    obterCodigoIATAOrigem(respostas) {
        if (!respostas) return null;
        
        // Tentar vários caminhos possíveis para encontrar o código IATA
        if (respostas.cidade_partida) {
            if (respostas.cidade_partida.code) return respostas.cidade_partida.code;
            if (respostas.cidade_partida.iata) return respostas.cidade_partida.iata;
            if (respostas.cidade_partida.aeroporto && respostas.cidade_partida.aeroporto.codigo) {
                return respostas.cidade_partida.aeroporto.codigo;
            }
        }
        
        // Fallback para GRU (São Paulo) se não encontrar
        this.log("Código IATA de origem não encontrado, usando GRU como fallback");
        return "GRU";
    },
    
    obterCodigoIATADestino(destino) {
        if (!destino) return null;
        
        // Tentar vários caminhos possíveis para encontrar o código IATA
        if (destino.code) return destino.code;
        if (destino.iata) return destino.iata;
        if (destino.codigo_iata) return destino.codigo_iata;
        if (destino.aeroporto && destino.aeroporto.codigo) {
            return destino.aeroporto.codigo;
        }
        
        this.log("Não foi possível encontrar código IATA para destino", destino);
        return null;
    },
    
    obterDataIda(respostas) {
        if (!respostas) return null;
        
        // Tentar vários caminhos possíveis para encontrar a data
        if (respostas.datas && respostas.datas.dataIda) {
            return respostas.datas.dataIda;
        }
        
        if (typeof respostas.datas === 'string' && respostas.datas.includes(',')) {
            return respostas.datas.split(',')[0].trim();
        }
        
        // Fallback para data padrão (um mês à frente)
        const dataFutura = new Date();
        dataFutura.setMonth(dataFutura.getMonth() + 1);
        return this.formatarDataISO(dataFutura);
    },
    
    obterDataVolta(respostas) {
        if (!respostas) return null;
        
        // Tentar vários caminhos possíveis para encontrar a data
        if (respostas.datas && respostas.datas.dataVolta) {
            return respostas.datas.dataVolta;
        }
        
        if (typeof respostas.datas === 'string' && respostas.datas.includes(',')) {
            const partes = respostas.datas.split(',');
            if (partes.length > 1) {
                return partes[1].trim();
            }
        }
        
        // Fallback para data padrão (um mês e uma semana à frente)
        const dataFutura = new Date();
        dataFutura.setMonth(dataFutura.getMonth() + 1);
        dataFutura.setDate(dataFutura.getDate() + 7);
        return this.formatarDataISO(dataFutura);
    },
    
    formatarDataISO(data) {
        return data.toISOString().split('T')[0]; // Formato YYYY-MM-DD
    },

    /**
     * Obtém o número total de adultos com base nas respostas
     */
    getNumeroAdultos(respostas) {
        if (!respostas) return 1;
        
        if (respostas.companhia === 0) {
            // Viajando sozinho
            return 1;
        } else if (respostas.companhia === 1) {
            // Viajando em casal
            return 2;
        } else if (respostas.companhia === 2) {
            // Viajando em família
            return respostas.quantidade_familia || 2;
        } else if (respostas.companhia === 3) {
            // Viajando com amigos
            return respostas.quantidade_amigos || 2;
        }
        
        // Valor padrão
        return 1;
    },

    // Os métodos restantes permanecem inalterados
    // ...
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    BENETRIP_VOOS.init();
});

// Exportar para namespace global
window.BENETRIP_VOOS = BENETRIP_VOOS;
