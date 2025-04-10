/**
 * BENETRIP - Módulo de Busca e Exibição de Voos
 * Versão otimizada para performance e confiabilidade
 */

// Módulo de Voos do Benetrip
const BENETRIP_VOOS = {
  // --- Constantes ---
  INITIAL_WAIT_MS: 5000,
  POLLING_INTERVAL_MS: 3000,
  MAX_POLLING_ATTEMPTS: 40,
  TIMEOUT_MS: 120000,
  IATA_MAP: {
    'sao paulo': 'GRU', 'rio de janeiro': 'GIG', 'brasilia': 'BSB', 'salvador': 'SSA',
    'recife': 'REC', 'fortaleza': 'FOR', 'belo horizonte': 'CNF', 'porto alegre': 'POA',
    'curitiba': 'CWB', 'belem': 'BEL', 'manaus': 'MAO', 'florianopolis': 'FLN',
    'natal': 'NAT', 'goiania': 'GYN', 'paris': 'CDG', 'londres': 'LHR', 
    'nova york': 'JFK', 'nova iorque': 'JFK', 'tokyo': 'HND', 'tóquio': 'HND'
  },

  // --- Dados e Estado ---
  destino: null,
  searchId: null,
  currencyRates: null,
  estaCarregando: true,
  isPolling: false,
  pollingAttempts: 0,
  pollingIntervalId: null,
  timeoutId: null,
  accumulatedProposals: [],
  accumulatedAirlines: {},
  accumulatedAirports: {},
  accumulatedGatesInfo: {},
  finalResults: null,
  temErro: false,
  mensagemErro: '',
  vooSelecionado: null,
  vooAtivo: null,
  indexVooAtivo: 0,
  hammerInstance: null,
  
  /**
   * Inicializa o sistema de busca de voos
   */
  init() {
    console.log('Inicializando sistema de busca de voos...');
    this.resetState();
    this.criarToastContainerSeNecessario();
    this.carregarDestino()
      .then(() => this.iniciarBuscaVoos())
      .catch(erro => this.mostrarErro('Erro ao carregar destino. Tente selecionar novamente.'));
  },

  /**
   * Reseta todos os dados de estado para valores iniciais
   */
  resetState() {
    this.destino = null;
    this.searchId = null;
    this.currencyRates = null;
    this.estaCarregando = true;
    this.isPolling = false;
    this.pollingAttempts = 0;
    
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    this.accumulatedProposals = [];
    this.accumulatedAirlines = {};
    this.accumulatedAirports = {};
    this.accumulatedGatesInfo = {};
    this.finalResults = null;
    
    this.temErro = false;
    this.mensagemErro = '';
    this.vooSelecionado = null;
    this.vooAtivo = null;
    this.indexVooAtivo = 0;
  },

  /**
   * Cria o container de toasts se necessário
   */
  criarToastContainerSeNecessario() {
    if (!document.getElementById('toast-container')) {
      const toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  },

  /**
   * Carrega os dados do destino da viagem
   * @returns {Promise<boolean>}
   */
  async carregarDestino() {
    try {
      // Tenta carregar o destino do localStorage
      let destinoString = localStorage.getItem('benetrip_destino_selecionado');
      if (!destinoString) {
        destinoString = localStorage.getItem('benetrip_destino_escolhido') || 
                        localStorage.getItem('benetrip_destino');
      }
      
      if (!destinoString) {
        throw new Error('Nenhum destino selecionado');
      }
      
      this.destino = JSON.parse(destinoString);
      console.log('Destino carregado:', this.destino);
      
      // Garante que o código IATA está presente
      if (!this.destino.codigo_iata) {
        if (this.destino.aeroporto?.codigo) {
          this.destino.codigo_iata = this.destino.aeroporto.codigo;
        } else {
          const codigoExtraido = this.extrairCodigoIATA(this.destino.destino || this.destino.nome);
          if (codigoExtraido) {
            this.destino.codigo_iata = codigoExtraido;
          } else {
            throw new Error('Código IATA do destino não encontrado');
          }
        }
      }
      
      return true;
    } catch (erro) {
      console.error('Erro ao carregar destino:', erro);
      throw erro;
    }
  },

  /**
   * Extrai o código IATA de um texto
   * @param {string} texto - O texto contendo o código IATA
   * @returns {string|null} Código IATA ou null se não encontrado
   */
  extrairCodigoIATA(texto) {
    if (!texto || typeof texto !== 'string') return null;
    
    // Tenta extrair o código IATA de um formato como "Cidade (XXX)"
    const match = texto.match(/\(([A-Z]{3})\)/);
    if (match && match[1]) return match[1];
    
    // Se não encontrou pelo formato parenteses, busca no mapeamento de cidades
    const textoLower = texto.toLowerCase();
    for (const [cidade, codigo] of Object.entries(this.IATA_MAP)) {
      if (textoLower.includes(cidade)) return codigo;
    }
    
    return null;
  },

  /**
   * Inicia o processo de busca de voos
   */
  async iniciarBuscaVoos() {
    try {
      // Verifica dados do destino
      if (!this.destino || !this.destino.codigo_iata) {
        throw new Error('Dados do destino incompletos.');
      }
      
      // Carrega dados do usuário e verifica datas
      const dadosUsuario = this.carregarDadosUsuario();
      const datas = dadosUsuario?.respostas?.datas;
      if (!datas || !datas.dataIda) {
        throw new Error('Datas de viagem não disponíveis.');
      }
      
      // Obtém código de origem
      const origemIATA = this.obterCodigoIATAOrigem(dadosUsuario);

      // Prepara parâmetros de busca
      const params = {
        origem: origemIATA,
        destino: this.destino.codigo_iata,
        dataIda: datas.dataIda,
        dataVolta: datas.dataVolta,
        adultos: dadosUsuario?.respostas?.passageiros?.adultos || 1,
        criancas: dadosUsuario?.respostas?.passageiros?.criancas || 0,
        bebes: dadosUsuario?.respostas?.passageiros?.bebes || 0,
        classe: 'Y',
        locale: "pt-BR"
      };

      console.log('Iniciando busca com parâmetros:', params);
      this.estaCarregando = true;
      this.atualizarProgresso('Iniciando busca de voos...', 10);
      this.atualizarInterfaceCarregamento();

      // Configura timeout global
      this.timeoutId = setTimeout(() => {
        if (this.estaCarregando) {
          this.pararPolling();
          this.mostrarErro('A busca demorou mais que o esperado.');
        }
      }, this.TIMEOUT_MS);

      // Simular busca para testes de interface
      if (window.location.href.includes('localhost') || window.location.href.includes('?mock=true')) {
        console.log('Ambiente de desenvolvimento detectado, usando dados de mock...');
        setTimeout(() => {
          this.searchId = 'mock-search-id';
          this.buscarResultadosMock();
        }, this.INITIAL_WAIT_MS);
        return;
      }

      // Chama backend para iniciar busca
      const resposta = await fetch('/api/flight-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!resposta.ok) {
        const errorData = await resposta.text();
        throw new Error(`Erro ${resposta.status} ao iniciar busca: ${errorData}`);
      }

      // Processa resposta
      const dados = await resposta.json();
      if (!dados.search_id) {
        throw new Error('ID de busca não retornado pelo servidor.');
      }

      console.log('Busca iniciada. Search ID:', dados.search_id);
      this.searchId = dados.search_id;
      
      // Logging detalhado das taxas de conversão para debug
      if (dados.currency_rates) {
        console.log('Taxas de conversão recebidas:', dados.currency_rates);
        this.currencyRates = dados.currency_rates;
      } else {
        console.warn('ATENÇÃO: Taxas de conversão não recebidas do servidor');
        this.currencyRates = null;
      }

      // Inicia polling após breve espera
      this.atualizarProgresso('Busca iniciada. Aguardando primeiros resultados...', 15);
      setTimeout(() => {
        this.iniciarPolling();
      }, this.INITIAL_WAIT_MS);

    } catch (erro) {
      console.error('Erro ao iniciar busca de voos:', erro);
      this.mostrarErro(erro.message);
    }
  },

  /**
   * Inicia o processo de polling para obter resultados de voos
   */
  iniciarPolling() {
    console.log(`Iniciando polling para searchId: ${this.searchId}`);
    
    // Limpa polling anterior se houver
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
    }

    // Configura estado de polling
    this.isPolling = true;
    this.pollingAttempts = 0;
    this.atualizarProgresso('Procurando as melhores conexões...', 20);

    // Inicia intervalo de polling
    this.pollingIntervalId = setInterval(() => this.verificarResultados(), this.POLLING_INTERVAL_MS);
    
    // Chama imediatamente a primeira vez
    this.verificarResultados();
  },

  /**
   * Para o processo de polling e limpa timeouts
   */
  pararPolling() {
    console.log('Parando polling e timeouts.');
    
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    this.isPolling = false;
  },

  /**
   * Verifica se há resultados disponíveis
   */
  async verificarResultados() {
    if (!this.isPolling) return;

    this.pollingAttempts++;
    console.log(`Polling: Tentativa ${this.pollingAttempts}/${this.MAX_POLLING_ATTEMPTS}`);

    // Atualiza UI com mensagens dinâmicas
    const mensagens = [
      'Buscando voos...', 
      'Verificando tarifas...', 
      'Analisando conexões...', 
      'Consultando companhias...', 
      'Quase lá...'
    ];
    const msgIdx = Math.min(
      Math.floor(this.pollingAttempts / (this.MAX_POLLING_ATTEMPTS / mensagens.length)), 
      mensagens.length - 1
    );
    const progresso = 20 + Math.min(75, (this.pollingAttempts / this.MAX_POLLING_ATTEMPTS) * 75);
    
    this.atualizarProgresso(`${mensagens[msgIdx]} (${this.pollingAttempts})`, progresso);

    // Verifica limite de tentativas
    if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS) {
      this.pararPolling();
      this.mostrarErro('A busca demorou mais que o esperado.');
      return;
    }

    try {
      // Chama o backend
      const resposta = await fetch(`/api/flight-results?uuid=${this.searchId}`);

      // Trata erros HTTP
      if (!resposta.ok) {
        const errorData = await resposta.json()
          .catch(() => ({ error: `Erro ${resposta.status} (resposta não JSON)` }));
        
        const errorMessage = errorData.error || `Erro ${resposta.status}.`;
        console.error(`Erro no polling (HTTP ${resposta.status}):`, errorMessage);
        
        if (resposta.status === 404) { 
          this.pararPolling(); 
          this.mostrarErro('Busca expirou/inválida.'); 
        } else if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS - 5) { 
          this.pararPolling(); 
          this.mostrarErro(errorMessage); 
        }
        return;
      }

      // Processa a resposta JSON
      const chunkData = await resposta.json();
      console.log(`Chunk recebido (Tentativa ${this.pollingAttempts})`);

      // --- Diagnóstico: Verifica todos os itens do array ---
      let proposalsTotal = 0;
      let proposalsEmTodosItens = [];
      
      if (Array.isArray(chunkData)) {
        console.log(`Analisando array de ${chunkData.length} itens para buscar propostas:`);
        
        chunkData.forEach((item, idx) => {
          if (item && typeof item === 'object') {
            // Conta propostas em cada item
            const proposalsNoItem = Array.isArray(item.proposals) ? item.proposals.length : 0;
            const temSearchId = item.search_id === this.searchId;
            
            console.log(`Item ${idx}: search_id correto: ${temSearchId ? 'SIM' : 'NÃO'}, Propostas: ${proposalsNoItem}`);
            
            if (proposalsNoItem > 0) {
              // Guarda todas as propostas encontradas em qualquer item
              proposalsEmTodosItens.push(...item.proposals);
              proposalsTotal += proposalsNoItem;
            }
            
            // Extrai dados auxiliares de todos os itens
            this.extrairDadosAuxiliares(item);
          }
        });
        
        if (proposalsTotal > 0) {
          console.log(`!!! ENCONTRADAS ${proposalsTotal} propostas em TODOS os itens do array !!!`);
          // Acumula todas as propostas encontradas em todos os itens
          this.accumulatedProposals.push(...proposalsEmTodosItens);
        }
      }

      // --- Encontrar o objeto de dados relevante ---
      let chunkObject = this.encontrarObjetoRelevante(chunkData);

      // --- Processa o chunkObject SE encontrado ---
      if (chunkObject) {
        const proposalsInChunk = chunkObject.proposals;
        
        // CORREÇÃO CRÍTICA: Um array vazio de proposals só significa fim da busca se:
        // 1. Não é a primeira tentativa de polling (pollingAttempts > 1) E
        // 2. Propostas já foram acumuladas anteriormente OU fizemos várias tentativas sem resultados
        if (proposalsInChunk && Array.isArray(proposalsInChunk)) {
          if (proposalsInChunk.length > 0) {
            // --- Propostas encontradas no objeto principal: acumula e continua ---
            console.log(`Acumulando ${proposalsInChunk.length} propostas do objeto principal com search_id`);
            this.accumulatedProposals.push(...proposalsInChunk);
          } else if (proposalsInChunk.length === 0) {
            // --- Objeto principal tem proposals vazio: é fim da busca ou primeira tentativa? ---
            const ehFimDaBusca = 
              // Não é primeira tentativa E (já temos propostas OU várias tentativas sem resultado)
              (this.pollingAttempts > 1 && (this.accumulatedProposals.length > 0 || this.pollingAttempts >= 5)) ||
              // OU é 1ª tentativa mas encontramos propostas em outros objetos do array
              (this.pollingAttempts === 1 && proposalsTotal > 0);
            
            if (ehFimDaBusca) {
              // --- É O FIM REAL DA BUSCA ---
              console.log(`Polling concluído! (Array proposals vazio é o fim na tentativa ${this.pollingAttempts})`);
              
              this.pararPolling();
              this.estaCarregando = false;
              
              this.atualizarProgresso('Finalizando...', 100);

              // Finaliza busca com sucesso
              this.concluirBusca();
            } else {
              // --- NÃO É O FIM AINDA: Continua polling ---
              console.log(`Array proposals vazio na tentativa ${this.pollingAttempts}, mas NÃO é o fim: ` +
                `${this.pollingAttempts === 1 ? "É a 1ª tentativa" : "Ainda não temos propostas suficientes"}. ` +
                `Continuando polling...`);
            }
          }
        }
      } else {
        // --- Verifica se esse é o fim simples da busca (último item só com search_id) ---
        const finalItem = Array.isArray(chunkData) && chunkData.find(item => 
          item && typeof item === 'object' && 
          Object.keys(item).length === 1 && 
          item.search_id === this.searchId
        );
        
        if (finalItem && this.accumulatedProposals.length > 0 && this.pollingAttempts > 2) {
          console.log('Busca concluída! (Último item com apenas search_id)');
          this.pararPolling();
          this.estaCarregando = false;
          this.atualizarProgresso('Finalizando...', 100);
          this.concluirBusca();
        } else {
          console.log(`Nenhum objeto de dados principal encontrado na tentativa ${this.pollingAttempts}. ` +
            `Continuando polling...`);
        }
      }

    } catch (erro) {
      console.error('Erro durante o polling ou processamento do chunk:', erro);
      
      // Se já tentamos muitas vezes, desiste
      if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS - 5) {
        this.pararPolling();
        this.mostrarErro('Erro ao verificar resultados. Verifique sua conexão.');
      }
    }
  },

  /**
   * Extrai dados auxiliares de um item da resposta
   * @param {Object} item - Item da resposta
   */
  extrairDadosAuxiliares(item) {
    if (!item || typeof item !== 'object') return;
    
    // Extrai dados de referência
    if (item.airlines) Object.assign(this.accumulatedAirlines, item.airlines);
    if (item.airports) Object.assign(this.accumulatedAirports, item.airports);
    if (item.gates_info) Object.assign(this.accumulatedGatesInfo, item.gates_info);
    if (item.meta) this.accumulatedMeta = { ...this.accumulatedMeta, ...item.meta };
  },

  /**
   * Encontra o objeto relevante na resposta
   * @param {Object|Array} chunkData - Dados recebidos
   * @returns {Object|null} - Objeto relevante ou null
   */
  encontrarObjetoRelevante(chunkData) {
    if (!chunkData) return null;
    
    if (Array.isArray(chunkData)) {
      // Procura o objeto no array que contém o search_id esperado
      const objRelevante = chunkData.find(item => 
        item && typeof item === 'object' && item.search_id === this.searchId);
      
      if (!objRelevante) {
        console.warn(`Array recebido, mas nenhum objeto encontrado com search_id ${this.searchId}`);
      } else {
        console.log("Objeto principal do chunk encontrado dentro do array");
      }
      
      return objRelevante;
    } else if (chunkData && typeof chunkData === 'object') {
      // Se não for array, assume que é o objeto diretamente
      if (chunkData.search_id === this.searchId) {
        console.log("Chunk recebido como objeto único");
        return chunkData;
      } else if (Object.keys(chunkData).length === 1 && chunkData.search_id) {
        console.log('Busca ainda em andamento (resposta apenas com search_id)...');
      } else {
        console.warn(`Objeto recebido, mas search_id (${chunkData.search_id}) ` +
          `não corresponde ao esperado (${this.searchId})`);
      }
    } else {
      console.warn("Chunk recebido com status 200 mas formato inesperado (não array/objeto)");
    }
    
    return null;
  },
  
  /**
   * Carrega dados de mock para testes
   */
  buscarResultadosMock() {
    console.log('Carregando dados de mock para testes...');
    
    // Simular progresso
    let progresso = 20;
    const intervalo = setInterval(() => {
      progresso += 10;
      this.atualizarProgresso('Carregando dados de teste...', progresso);
      
      if (progresso >= 100) {
        clearInterval(intervalo);
        
        // Dados de mock
        const dadosMock = {
          proposals: [
            // Voo 1 - Melhor preço, direto
            {
              sign: 'voo-1',
              carriers: ['LATAM'],
              terms: {
                'default': {
                  unified_price: 1800,
                  currency: 'BRL'
                }
              },
              segment: [
                {
                  flight: [
                    {
                      departure: 'GRU',
                      arrival: 'MDE',
                      departure_date: '2025-08-05',
                      departure_time: '08:30',
                      arrival_date: '2025-08-05',
                      arrival_time: '14:00',
                      duration: 330,
                      marketing_carrier: 'LA',
                      number: '1234',
                      local_departure_timestamp: 1722963000,
                      local_arrival_timestamp: 1722982800
                    }
                  ]
                },
                {
                  flight: [
                    {
                      departure: 'MDE',
                      arrival: 'GRU',
                      departure_date: '2025-08-15',
                      departure_time: '16:45',
                      arrival_date: '2025-08-15',
                      arrival_time: '22:30',
                      duration: 345,
                      marketing_carrier: 'LA',
                      number: '1235',
                      local_departure_timestamp: 1723768500,
                      local_arrival_timestamp: 1723789800
                    }
                  ]
                }
              ],
              // Dados adicionais para UI
              _economia: 15,
              _melhorPreco: true,
              _assentosDisponiveis: 5
            },
            // Voo 2 - Conectado
            {
              sign: 'voo-2',
              carriers: ['AVIANCA'],
              terms: {
                'default': {
                  unified_price: 1600,
                  currency: 'BRL'
                }
              },
              segment: [
                {
                  flight: [
                    {
                      departure: 'GRU',
                      arrival: 'BOG',
                      departure_date: '2025-08-05',
                      departure_time: '06:15',
                      arrival_date: '2025-08-05',
                      arrival_time: '10:30',
                      duration: 265,
                      marketing_carrier: 'AV',
                      number: '8532',
                      local_departure_timestamp: 1722954600,
                      local_arrival_timestamp: 1722970600
                    },
                    {
                      departure: 'BOG',
                      arrival: 'MDE',
                      departure_date: '2025-08-05',
                      departure_time: '11:30',
                      arrival_date: '2025-08-05',
                      arrival_time: '13:45',
                      duration: 135,
                      marketing_carrier: 'AV',
                      number: '9001',
                      local_departure_timestamp: 1722974400,
                      local_arrival_timestamp: 1722982500
                    }
                  ]
                },
                {
                  flight: [
                    {
                      departure: 'MDE',
                      arrival: 'BOG',
                      departure_date: '2025-08-15',
                      departure_time: '14:15',
                      arrival_date: '2025-08-15',
                      arrival_time: '16:30',
                      duration: 135,
                      marketing_carrier: 'AV',
                      number: '9002',
                      local_departure_timestamp: 1723759800,
                      local_arrival_timestamp: 1723767800
                    },
                    {
                      departure: 'BOG',
                      arrival: 'GRU',
                      departure_date: '2025-08-15',
                      departure_time: '17:30',
                      arrival_date: '2025-08-15',
                      arrival_time: '23:45',
                      duration: 375,
                      marketing_carrier: 'AV',
                      number: '8533',
                      local_departure_timestamp: 1723772000,
                      local_arrival_timestamp: 1723792500
                    }
                  ]
                }
              ],
              // Dados adicionais para UI
              _economia: 8,
              _assentosDisponiveis: 3
            },
            // Voo 3
            {
              sign: 'voo-3',
              carriers: ['COPA'],
              terms: {
                'default': {
                  unified_price: 2100,
                  currency: 'BRL'
                }
              },
              segment: [
                {
                  flight: [
                    {
                      departure: 'GRU',
                      arrival: 'PTY',
                      departure_date: '2025-08-05',
                      departure_time: '09:45',
                      arrival_date: '2025-08-05',
                      arrival_time: '14:30',
                      duration: 285,
                      marketing_carrier: 'CM',
                      number: '702',
                      local_departure_timestamp: 1722967700,
                      local_arrival_timestamp: 1722983700
                    },
                    {
                      departure: 'PTY',
                      arrival: 'MDE',
                      departure_date: '2025-08-05',
                      departure_time: '15:30',
                      arrival_date: '2025-08-05',
                      arrival_time: '18:20',
                      duration: 170,
                      marketing_carrier: 'CM',
                      number: '423',
                      local_departure_timestamp: 1723987100,
                      local_arrival_timestamp: 1723994100
                    }
                  ]
                },
                {
                  flight: [
                    {
                      departure: 'MDE',
                      arrival: 'PTY',
                      departure_date: '2025-08-15',
                      departure_time: '12:30',
                      arrival_date: '2025-08-15',
                      arrival_time: '15:20',
                      duration: 170,
                      marketing_carrier: 'CM',
                      number: '424',
                      local_departure_timestamp: 1723753800,
                      local_arrival_timestamp: 1723760800
                    },
                    {
                      departure: 'PTY',
                      arrival: 'GRU',
                      departure_date: '2025-08-15',
                      departure_time: '16:20',
                      arrival_date: '2025-08-15',
                      arrival_time: '22:10',
                      duration: 350,
                      marketing_carrier: 'CM',
                      number: '701',
                      local_departure_timestamp: 1723764800,
                      local_arrival_timestamp: 1723785000
                    }
                  ]
                }
              ],
              // Dados adicionais para UI
              _economia: 5,
              _assentosDisponiveis: 8
            }
          ],
          airlines: {
            'LA': { name: 'LATAM Airlines', iata: 'LA' },
            'AV': { name: 'Avianca', iata: 'AV' },
            'CM': { name: 'Copa Airlines', iata: 'CM' }
          },
          airports: {
            'GRU': { name: 'Guarulhos International', city: 'São Paulo', country: 'Brasil' },
            'MDE': { name: 'José María Córdova', city: 'Medellín', country: 'Colômbia' },
            'BOG': { name: 'El Dorado', city: 'Bogotá', country: 'Colômbia' },
            'PTY': { name: 'Tocumen International', city: 'Panamá', country: 'Panamá' }
          },
          meta: {
            currency: 'BRL'
          }
        };
        
        // Atribui dados ao estado
        this.accumulatedProposals = dadosMock.proposals;
        this.accumulatedAirlines = dadosMock.airlines;
        this.accumulatedAirports = dadosMock.airports;
        
        // Finaliza busca
        this.concluirBusca();
      }
    }, 500);
  },
  
  /**
   * Finaliza o processo de busca e prepara os resultados
   */
  concluirBusca() {
    // Verificação e log das taxas de conversão ao concluir a busca
    console.log('=== DEBUG DE CONVERSÃO DE MOEDA ===');
    console.log('searchId:', this.searchId);
    console.log('currencyRates disponível:', !!this.currencyRates);
    if (this.currencyRates) {
      console.log('Taxas de conversão:', this.currencyRates);
    }
    
    const moedaUsuario = this.obterMoedaAtual();
    console.log('Moeda do usuário detectada:', moedaUsuario);
    
    // Se existirem propostas, mostra o preço original e convertido da primeira
    if (this.accumulatedProposals.length > 0) {
      const primeiraProposta = this.accumulatedProposals[0];
      const k = Object.keys(primeiraProposta.terms)[0];
      const precoOriginal = primeiraProposta.terms[k]?.unified_price || primeiraProposta.terms[k]?.price || 0;
      
      console.log('Exemplo - Preço original:', precoOriginal);
      const taxaConversao = this.currencyRates ? this.currencyRates[moedaUsuario.toLowerCase()] : null;
      console.log(`Taxa de conversão para ${moedaUsuario}:`, taxaConversao);
      
      if (taxaConversao) {
        const precoConvertido = Math.round(precoOriginal * taxaConversao);
        console.log(`Preço convertido: ${precoOriginal} * ${taxaConversao} = ${precoConvertido} ${moedaUsuario}`);
      } else {
        console.log('Conversão não aplicada - taxa não disponível');
      }
    }
    console.log('=== FIM DEBUG CONVERSÃO ===');
    
    // Para o polling
    this.pararPolling();
    this.estaCarregando = false;
    
    // Prepara plenamente os resultados finais
    this.finalResults = {
        proposals: this.preprocessarPropostas(this.accumulatedProposals),
        airlines: this.accumulatedAirlines,
        airports: this.accumulatedAirports,
        gates_info: this.accumulatedGatesInfo,
        meta: { currency: this.obterMoedaAtual() } // Atualiza a moeda nos metadados
    };
    
    console.log(`Busca concluída com ${this.finalResults.proposals.length} propostas processadas`);
    
    // Atualiza UI
    if (this.finalResults.proposals.length > 0) {
        this.vooAtivo = this.finalResults.proposals[0];
        this.indexVooAtivo = 0;
        
        this.exibirToast(`${this.finalResults.proposals.length} voos encontrados! ✈️`, 'success');
        
        // Render com delay mínimo para garantir que o DOM esteja pronto
        setTimeout(() => {
            this.renderizarResultados();
            
            // Notifica outros módulos que os resultados estão prontos
            const evento = new CustomEvent('resultadosVoosProntos', {
                detail: { 
                    quantidadeVoos: this.finalResults.proposals.length 
                }
            });
            document.dispatchEvent(evento);
        }, 10);
    } else {
        this.exibirToast('Não encontramos voos disponíveis.', 'warning');
        this.renderizarSemResultados();
    }
  },

  /**
   * Pré-processa as propostas de voos para uso na interface
   * @param {Array} propostas - Lista de propostas de voos
   * @returns {Array} - Lista processada
   */
  preprocessarPropostas(propostas) {
    if (!propostas || !Array.isArray(propostas) || propostas.length === 0) return [];
    
    console.log(`Pré-processando ${propostas.length} propostas...`);
    
    // Ordena por preço (menor primeiro)
    const propostasValidas = propostas.filter(p => p && typeof p === 'object');
    propostasValidas.sort((a, b) => this.obterPrecoVoo(a) - this.obterPrecoVoo(b));
    
    // Adiciona informações calculadas
    return propostasValidas.map((proposta, index) => {
      // Se já tem as propriedades adicionais, mantém
      if (proposta._melhorPreco !== undefined) return proposta;
      
      // Atribui propriedades adicionais para uso na interface
      proposta._melhorPreco = (index === 0);
      
      // Calcula economia baseada em uma variação aleatória do preço médio
      const precoAtual = this.obterPrecoVoo(proposta);
      const precoMedio = precoAtual * (1 + (Math.random() * 0.25));
      proposta._economia = Math.max(0, Math.round(((precoMedio - precoAtual) / precoMedio) * 100));
      
      // Simula assentos disponíveis (para fins de UI)
      proposta._assentosDisponiveis = Math.floor(Math.random() * 8) + 1;
      
      return proposta;
    });
  },

  /**
   * Atualiza a barra de progresso e mensagem
   * @param {string} mensagem - Mensagem de status
   * @param {number} porcentagem - Porcentagem de progresso (0-100)
   */
  atualizarProgresso(mensagem, porcentagem) {
    const bar = document.querySelector('.progress-bar');
    const text = document.querySelector('.loading-text');
    
    if (bar) { 
      bar.style.width = `${porcentagem}%`; 
    }
    
    if (text) { 
      text.textContent = mensagem; 
    }
  },

  /**
   * Atualiza a interface para mostrar o estado de carregamento
   */
  atualizarInterfaceCarregamento() {
    const container = document.querySelector('.voos-content');
    if (!container) return;
    
    // Limpa o conteúdo atual
    container.innerHTML = '';
    
    // Adiciona o indicador de carregamento
    const loading = document.createElement('div');
    loading.className = 'loading-container';
    loading.innerHTML = `
      <img src="assets/images/tripinha/loading.gif" alt="Tripinha carregando" class="loading-avatar">
      <div class="loading-text">Farejando os melhores voos para você...</div>
      <div class="progress-bar-container">
        <div class="progress-bar" role="progressbar" style="width: 10%;" aria-valuenow="10" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
      <div class="loading-tips">
        <p>💡 Dica: Voos diretos aparecem destacados em azul!</p>
      </div>
    `;
    
    container.appendChild(loading);
  },

  /**
   * Renderiza os resultados da busca
   */
  renderizarResultados() {
    console.log('Renderizando resultados de voos...');
    
    // Obtém o container principal
    const container = document.querySelector('.voos-content');
    if (!container) {
        console.error('Container de conteúdo não encontrado');
        return;
    }
    
    // Limpa o conteúdo atual
    container.innerHTML = '';
    
    // Renderiza a mensagem da Tripinha
    const tripinhaMessage = document.createElement('div');
    tripinhaMessage.className = 'tripinha-message';
    tripinhaMessage.innerHTML = `
      <div class="tripinha-avatar">
        <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha">
      </div>
      <div class="tripinha-bubble">
        <p>Eu farejei por aí e encontrei ${this.finalResults.proposals.length} voos incríveis para sua aventura! 🐾 
           Deslize para ver todas as opções e escolha a que melhor se encaixa no seu plano!</p>
      </div>
    `;
    container.appendChild(tripinhaMessage);
    
    // Renderiza o resumo da viagem
    const flightsSummary = document.createElement('div');
    flightsSummary.className = 'flights-summary';
    flightsSummary.innerHTML = `
      <div class="flights-summary-header">
        <div>
          <span class="flights-count">${this.finalResults.proposals.length}</span> voos encontrados
        </div>
        <div class="flights-sort">
          <span>Por preço</span>
        </div>
      </div>
    `;
    container.appendChild(flightsSummary);
    
    // Container de swipe para voos
    const voosContainer = document.createElement('div');
    voosContainer.className = 'voos-swipe-container';
    voosContainer.id = 'voos-swipe-container';
    container.appendChild(voosContainer);
    
    // Renderiza os cards de voo
    console.log(`Criando ${this.finalResults.proposals.length} cards de voo...`);
    this.finalResults.proposals.forEach((voo, index) => {
      const cardVoo = this.criarCardVoo(voo, index);
      if (cardVoo) {
        voosContainer.appendChild(cardVoo);
      } else {
        console.error(`Falha ao criar card para o voo ${index}`);
      }
    });
    
    // Adiciona indicadores de paginação
    const paginationIndicator = document.createElement('div');
    paginationIndicator.className = 'pagination-indicator';
    
    for (let i = 0; i < this.finalResults.proposals.length; i++) {
      const dot = document.createElement('div');
      dot.className = 'pagination-dot';
      if (i === 0) dot.classList.add('active');
      dot.dataset.index = i.toString();
      paginationIndicator.appendChild(dot);
    }
    
    container.appendChild(paginationIndicator);
    
    // Adiciona controles de navegação
    const navControls = document.createElement('div');
    navControls.className = 'nav-controls';
    navControls.innerHTML = `
      <button class="nav-btn prev-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"></path>
        </svg>
        Anterior
      </button>
      <button class="nav-btn next-btn">
        Próximo
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"></path>
        </svg>
      </button>
    `;
    container.appendChild(navControls);
    
    // Atualiza o botão de seleção
    this.atualizarBotaoSelecao();
    
    // Exibe dica de swipe
    this.exibirDicaSwipe();
    
    // MODIFICADO: Tenta inicializar navegação com tratamento de fallback
    if (typeof window.inicializarNavegacaoVoos === 'function') {
        console.log('Inicializando navegação de voos via função global...');
        try {
            window.inicializarNavegacaoVoos();
        } catch (erro) {
            console.warn('Erro ao inicializar navegação global, usando método local:', erro);
            this.configurarNavegacaoCards();
        }
    } else {
        console.log('Função global de navegação não disponível, configurando navegação diretamente...');
        this.configurarNavegacaoCards();
    }
  },

  /**
   * Renderiza a tela de "sem resultados"
   */
  renderizarSemResultados() {
    const container = document.querySelector('.voos-content');
    if (!container) return;
    
    container.innerHTML = '';
    
    const semResultados = document.createElement('div');
    semResultados.className = 'sem-resultados-container';
    semResultados.innerHTML = `
      <div class="tripinha-message">
        <div class="tripinha-avatar">
          <img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste">
        </div>
        <div class="tripinha-bubble">
          <p>Ops! Cheirei todos os cantos e não encontrei voos para ${this.destino?.destino || 'este destino'} nas datas selecionadas. 🐾</p>
          <p>Podemos tentar outras datas ou destinos!</p>
        </div>
      </div>
      
      <div class="no-results-actions">
        <button class="btn-secundario">Mudar Datas</button>
        <button class="btn-principal">Outro Destino</button>
      </div>
    `;
    
    container.appendChild(semResultados);
    
    // Adiciona eventos aos botões
    const btnMudarDatas = semResultados.querySelector('.btn-secundario');
    const btnOutroDestino = semResultados.querySelector('.btn-principal');
    
    if (btnMudarDatas) {
      btnMudarDatas.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }
    
    if (btnOutroDestino) {
      btnOutroDestino.addEventListener('click', () => {
        window.location.href = 'destinos.html';
      });
    }
  },

  /**
   * Cria um card de voo para a interface
   * @param {Object} voo - Dados do voo
   * @param {number} index - Índice do voo na lista
   * @returns {HTMLElement} O elemento card criado
   */
  criarCardVoo(voo, index) {
    const cardVoo = document.createElement('div');
    cardVoo.className = 'voo-card';
    if (index === 0) cardVoo.classList.add('voo-card-ativo');
    
    // Define atributos de dados
    const vooId = voo.sign || `voo-idx-${index}`;
    cardVoo.dataset.vooId = vooId;
    cardVoo.dataset.vooIndex = index.toString();
    
    // Extrai informações do voo
    const preco = this.obterPrecoVoo(voo);
    const moeda = this.obterMoedaAtual();
    const infoIda = this.obterInfoSegmento(voo.segment?.[0]);
    const infoVolta = voo.segment?.length > 1 ? this.obterInfoSegmento(voo.segment[1]) : null;
    const economiaPercentual = voo._economia || 0;
    const isMelhorPreco = voo._melhorPreco || index === 0;
    const ehVooDireto = infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0);
    
    // Adiciona classes especiais
    if (ehVooDireto) cardVoo.classList.add('voo-direto');
    
    // Extrai código IATA da companhia aérea
    const companhiaIATA = voo.carriers?.[0];
    const companhiaAerea = this.obterNomeCompanhiaAerea(companhiaIATA);
    
    // Função para obter URL do logo da companhia aérea
    const getAirlineLogoUrl = (iataCode, width = 40, height = 40) => {
      if (!iataCode || typeof iataCode !== 'string') {
        return `https://pics.avs.io/${width}/${height}/default.png`;
      }
      const code = iataCode.trim().toUpperCase();
      return `https://pics.avs.io/${width}/${height}/${code}.png`;
    };
    
    // Constrói o HTML interno com o logo da companhia aérea
    cardVoo.innerHTML = `
      <div class="voo-card-header">
        <div class="voo-price-container">
          <div class="voo-price">${this.formatarPreco(preco, moeda)}</div>
          ${economiaPercentual > 0 ? `<span class="discount-badge">-${economiaPercentual}%</span>` : ''}
          ${isMelhorPreco ? '<span class="card-tag melhor-preco">Melhor preço</span>' : ''}
        </div>
        <div class="voo-price-details">Por pessoa, ida${infoVolta ? ' e volta' : ''}</div>
        <div class="airline-info">
          <img src="${getAirlineLogoUrl(companhiaIATA, 20, 20)}" alt="${companhiaAerea}" class="airline-logo">
          ${companhiaAerea}
        </div>
      </div>
      
      <div class="voo-card-content">
        <!-- Rota de ida -->
        <div class="flight-route">
          <div class="route-point">
            <div class="route-time">${infoIda?.horaPartida || '--:--'}</div>
            <div class="route-airport">${infoIda?.aeroportoPartida || '---'}</div>
          </div>
          <div class="route-line">
            ${ehVooDireto ? '<div class="route-info-badge"><span class="card-tag voo-direto">Voo Direto</span></div>' : ''}
            <div class="route-duration">${this.formatarDuracao(infoIda?.duracao || 0)}</div>
            <div class="route-line-bar ${ehVooDireto ? 'route-line-direct' : ''}">
              <span class="stop-marker start"></span>
              ${infoIda?.paradas > 0 ? '<span class="stop-marker mid"></span>' : ''}
              <span class="stop-marker end"></span>
            </div>
            <div class="route-stops ${ehVooDireto ? 'route-stops-direct' : ''}">
              ${infoIda?.paradas === 0 ? 'Sem escalas' : `${infoIda?.paradas || 0} ${infoIda?.paradas === 1 ? 'parada' : 'paradas'}`}
            </div>
          </div>
          <div class="route-point">
            <div class="route-time">${infoIda?.horaChegada || '--:--'}</div>
            <div class="route-airport">${infoIda?.aeroportoChegada || '---'}</div>
          </div>
        </div>
        
        ${infoVolta ? `
        <!-- Rota de volta -->
        <div class="flight-route return-route">
          <div class="route-point">
            <div class="route-time">${infoVolta.horaPartida || '--:--'}</div>
            <div class="route-airport">${infoVolta.aeroportoPartida || '---'}</div>
          </div>
          <div class="route-line">
            ${infoVolta.paradas === 0 ? '<div class="route-info-badge"><span class="card-tag voo-direto">Voo Direto</span></div>' : ''}
            <div class="route-duration">${this.formatarDuracao(infoVolta.duracao || 0)}</div>
            <div class="route-line-bar ${infoVolta.paradas === 0 ? 'route-line-direct' : ''}">
              <span class="stop-marker start"></span>
              ${infoVolta.paradas > 0 ? '<span class="stop-marker mid"></span>' : ''}
              <span class="stop-marker end"></span>
            </div>
            <div class="route-stops ${infoVolta.paradas === 0 ? 'route-stops-direct' : ''}">
              ${infoVolta.paradas === 0 ? 'Sem escalas' : `${infoVolta.paradas} ${infoVolta.paradas === 1 ? 'parada' : 'paradas'}`}
            </div>
          </div>
          <div class="route-point">
            <div class="route-time">${infoVolta.horaChegada || '--:--'}</div>
            <div class="route-airport">${infoVolta.aeroportoChegada || '---'}</div>
          </div>
        </div>
        ` : ''}
        
        <!-- Detalhes adicionais -->
        <div class="flight-details">
          <div>
            <span>✓</span> 1 bagagem incluída
          </div>
          <div>
            <span>⏱️</span> Duração: ${this.formatarDuracao(infoIda?.duracao || 0)}
          </div>
        </div>
      </div>
      
      <div class="voo-card-footer">
        <button class="btn-detalhes-voo" data-voo-id="${vooId}">Ver detalhes</button>
        <div class="remaining-seats">
          Restam <span class="seats-number">${voo._assentosDisponiveis || '?'}</span>
        </div>
      </div>
    `;

    return cardVoo;
  },

  /**
   * Configurar navegação entre cards de voo
   */
  configurarNavegacaoCards() {
    const swipeContainer = document.getElementById('voos-swipe-container');
    if (!swipeContainer) {
        console.error('Container de swipe não encontrado');
        return;
    }
    
    const cards = swipeContainer.querySelectorAll('.voo-card');
    if (!cards.length) {
        console.error('Nenhum card de voo encontrado para configurar navegação');
        return;
    }
    
    console.log(`Configurando navegação para ${cards.length} cards de voo`);
    
    const paginationDots = document.querySelectorAll('.pagination-dot');
    let currentCardIndex = 0;
    
    // Configurar swipe com Hammer.js - COM TRATAMENTO DE ERRO MELHORADO
    try {
        // Verifica se Hammer realmente é um construtor válido
        if (typeof Hammer === 'function') {
            // Limpar instância anterior se existir
            if (this.hammerInstance) {
                try {
                    this.hammerInstance.destroy();
                } catch (e) {
                    console.warn('Erro ao destruir instância anterior de Hammer', e);
                }
            }
            
            this.hammerInstance = new Hammer(swipeContainer);
            this.hammerInstance.on('swipeleft', () => {
                if (currentCardIndex < cards.length - 1) {
                    this.proximoVoo();
                }
            });
            
            this.hammerInstance.on('swiperight', () => {
                if (currentCardIndex > 0) {
                    this.vooAnterior();
                }
            });
            
            console.log('Hammer.js configurado para swipe');
        } else {
            console.log('Hammer não é um construtor válido, usando alternativa de navegação');
            this.configurarNavegacaoAlternativa(swipeContainer, cards);
        }
    } catch (erro) {
        console.error('Erro ao configurar Hammer.js:', erro);
        // Implementa navegação alternativa baseada em scroll
        this.configurarNavegacaoAlternativa(swipeContainer, cards);
    }
    
    // Configurar botões de navegação (mantido como está)
    const btnNext = document.querySelector('.next-btn');
    const btnPrev = document.querySelector('.prev-btn');
    
    if (btnNext) {
        btnNext.onclick = () => this.proximoVoo();
    }
    
    if (btnPrev) {
        btnPrev.onclick = () => this.vooAnterior();
    }
    
    // Configurar clique nas bolinhas de paginação
    if (paginationDots.length) {
        paginationDots.forEach((dot, index) => {
            dot.onclick = () => {
                this.indexVooAtivo = index;
                this.vooAtivo = this.finalResults.proposals[index];
                this.atualizarVooAtivo();
            };
        });
    }
    
    // Configurar clique nos cards
    cards.forEach((card, index) => {
        card.onclick = (e) => {
            // Não ativar se o clique foi em um botão dentro do card
            if (!e.target.closest('button')) {
                this.indexVooAtivo = index;
                this.vooAtivo = this.finalResults.proposals[index];
                this.atualizarVooAtivo();
            }
        };
    });
    
    // Configurar botões de detalhes
    const botoesDetalhes = document.querySelectorAll('.btn-detalhes-voo');
    botoesDetalhes.forEach(btn => {
        const vooId = btn.dataset.vooId;
        if (vooId) {
            btn.onclick = () => {
                const evento = new CustomEvent('mostrarDetalhesVoo', {
                    detail: { vooId }
                });
                document.dispatchEvent(evento);
            };
        }
    });
  },

  /**
   * Configura uma alternativa de navegação baseada em scroll para quando Hammer não funciona
   * @param {HTMLElement} container - Container de swipe
   * @param {NodeList} cards - Lista de cards de voo
   */
  configurarNavegacaoAlternativa(container, cards) {
    console.log('Configurando navegação alternativa baseada em scroll');
    
    // Garante que o container seja scrollável
    container.style.overflowX = 'auto';
    container.style.scrollBehavior = 'smooth';
    container.style.scrollSnapType = 'x mandatory';
    
    // Adiciona scroll-snap para cada card
    Array.from(cards).forEach(card => {
        card.style.scrollSnapAlign = 'center';
    });
    
    // Configura eventos de click nos próprios cards
    Array.from(cards).forEach((card, index) => {
        card.addEventListener('click', (e) => {
            // Evita ativar se clicou em um botão
            if (!e.target.closest('button')) {
                this.indexVooAtivo = index;
                this.vooAtivo = this.finalResults.proposals[index];
                this.atualizarVooAtivo();
            }
        });
    });
    
    // Detecta mudanças no scroll para atualizar card ativo
    let scrollTimeout = null;
    container.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            // Encontra o card mais visível no centro
            const containerRect = container.getBoundingClientRect();
            const containerCenter = containerRect.left + containerRect.width / 2;
            
            let closestCard = null;
            let closestDistance = Infinity;
            
            Array.from(cards).forEach(card => {
                const cardRect = card.getBoundingClientRect();
                const cardCenter = cardRect.left + cardRect.width / 2;
                const distance = Math.abs(containerCenter - cardCenter);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestCard = card;
                }
            });
            
            if (closestCard) {
                const index = Array.from(cards).indexOf(closestCard);
                if (index !== -1 && index !== this.indexVooAtivo) {
                    this.indexVooAtivo = index;
                    this.vooAtivo = this.finalResults.proposals[index];
                    this.atualizarVooAtivo();
                }
            }
        }, 150);
    });
    
    // Adiciona navegação por teclado
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            this.vooAnterior();
        } else if (e.key === 'ArrowRight') {
            this.proximoVoo();
        }
    });
  },

  /**
   * Atualiza o botão de seleção com o preço atual
   */
  atualizarBotaoSelecao() {
    const botaoFixo = document.querySelector('.botao-selecao-fixo');
    if (!botaoFixo) return;
    
    // Tenta obter o preço do voo ativo
    let precoTexto = 'Escolher Este Voo';
    if (this.vooAtivo) {
      const preco = this.obterPrecoVoo(this.vooAtivo);
      const moeda = this.obterMoedaAtual();
      precoTexto = `Reservar Voo por ${this.formatarPreco(preco, moeda)}`;
    }
    
    const btnSelecionar = botaoFixo.querySelector('.btn-selecionar-voo');
    if (btnSelecionar) {
      btnSelecionar.innerHTML = `
        <span>${precoTexto}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"></path>
        </svg>
      `;
    }
  },
  
  /**
   * Exibe uma dica de swipe na interface
   */
  exibirDicaSwipe() {
    const existingHint = document.querySelector('.swipe-hint');
    if (existingHint) existingHint.remove();
    
    // Cria a dica de swipe
    const hint = document.createElement('div');
    hint.className = 'swipe-hint';
    hint.innerHTML = `
      <span class="swipe-arrow left">←</span> 
      Deslize para ver outros voos 
      <span class="swipe-arrow right">→</span>
    `;
    
    document.body.appendChild(hint);
    
    // Esconde a dica após alguns segundos
    setTimeout(() => {
      hint.style.opacity = '0';
      setTimeout(() => {
        if (hint.parentNode) hint.parentNode.removeChild(hint);
      }, 1000);
    }, 5000);
  },

  /**
   * Exibe uma mensagem de erro na interface
   * @param {string} mensagem - Mensagem de erro a ser exibida
   */
  mostrarErro(mensagem) {
    console.error("Erro exibido:", mensagem);
    
    // Para qualquer operação em andamento
    this.pararPolling();
    
    // Atualiza o estado
    this.temErro = true;
    this.estaCarregando = false;
    this.mensagemErro = mensagem || 'Erro desconhecido.';
    
    // Atualiza a interface
    const container = document.querySelector('.voos-content');
    if (!container) return;
    
    container.innerHTML = '';
    
    const erroDiv = document.createElement('div'); 
    erroDiv.className = 'erro-container';
    erroDiv.innerHTML = `
      <div class="error-message-box">
        <div class="error-image">
          <img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="tripinha-error-avatar">
        </div>
        <h3 class="error-title">${this.mensagemErro}</h3>
        <p class="error-description">Desculpe pelo inconveniente. Podemos tentar novamente?</p>
        <button class="btn-tentar-novamente">
          Tentar Novamente
        </button>
      </div>
    `;
    
    container.appendChild(erroDiv);
  },

  /**
   * Obtém o preço de um voo convertido para a moeda selecionada pelo usuário
   * @param {Object} voo - Dados do voo
   * @returns {number} Preço do voo na moeda selecionada
   */
  obterPrecoVoo(voo) {
    if (!voo || !voo.terms) {
      console.log('Voo sem termos ou inválido', voo);
      return 0;
    }
    
    try {
      // Extrai o preço original
      const k = Object.keys(voo.terms)[0];
      if (!k) {
        console.warn('Nenhuma chave encontrada em voo.terms', voo.terms);
        return 0;
      }
      
      // Obter o preço original (geralmente em rublos russos)
      const precoOriginal = voo.terms[k]?.unified_price || voo.terms[k]?.price || 0;
      
      // Log do preço original
      console.log(`Preço original: ${precoOriginal} RUB`);
      
      // Obter a moeda selecionada pelo usuário
      const moedaUsuario = this.obterMoedaAtual();
      console.log(`Moeda selecionada: ${moedaUsuario}`);
      
      // Se não temos taxas de conversão, retorna o preço original com aviso
      if (!this.currencyRates) {
        console.warn('Taxas de conversão não disponíveis. Usando preço original:', precoOriginal);
        return precoOriginal;
      }
      
      // Log das taxas de conversão disponíveis para debug
      console.log('Taxas de conversão disponíveis:', this.currencyRates);
      
      // Se a moeda já é a mesma da API (RUB) ou a taxa não existe
      if (moedaUsuario === 'RUB') {
        return precoOriginal;
      }
      
      // Encontrar a taxa de conversão para a moeda selecionada (minúsculo conforme formato da API)
      const moedaLower = moedaUsuario.toLowerCase();
      const taxaConversao = this.currencyRates[moedaLower];
      
      if (!taxaConversao) {
        console.warn(`Taxa de conversão não encontrada para ${moedaUsuario}. Taxas disponíveis:`, this.currencyRates);
        
        // Tentativa usando outra forma de acesso
        if (typeof this.currencyRates === 'object') {
          // Procura pela chave em qualquer formato (maiúsculo/minúsculo)
          const todasChaves = Object.keys(this.currencyRates);
          const chaveEncontrada = todasChaves.find(k => 
            k.toLowerCase() === moedaLower || 
            k.toUpperCase() === moedaUsuario.toUpperCase()
          );
          
          if (chaveEncontrada) {
            const taxaAlternativa = this.currencyRates[chaveEncontrada];
            console.log(`Taxa alternativa encontrada para ${chaveEncontrada}: ${taxaAlternativa}`);
            return Math.round(precoOriginal * taxaAlternativa);
          }
        }
        
        // Fallback: retorna o preço original com aviso
        console.warn(`Usando preço original devido à falta de taxa de conversão: ${precoOriginal}`);
        return precoOriginal;
      }
      
      // Aplicar a conversão com a taxa encontrada
      const precoConvertido = precoOriginal * taxaConversao;
      console.log(`Preço convertido: ${precoOriginal} RUB * ${taxaConversao} = ${precoConvertido} ${moedaUsuario}`);
      
      // Retorna o valor convertido arredondado
      return Math.round(precoConvertido);
    } catch (erro) {
      console.error('Erro ao obter/converter preço do voo:', erro);
      return 0;
    }
  },

  /**
   * Obtém a moeda selecionada pelo usuário de forma mais robusta
   * @returns {string} Código da moeda (BRL, USD, EUR)
   */
  obterMoedaAtual() {
    try {
      // Obtém dados do usuário do localStorage
      const dadosUsuarioString = localStorage.getItem('benetrip_user_data');
      console.log('Dados do usuário (string):', dadosUsuarioString);
      
      if (!dadosUsuarioString) {
        console.warn('Dados do usuário não encontrados no localStorage');
        return 'BRL'; // Default
      }
      
      const dadosUsuario = JSON.parse(dadosUsuarioString);
      console.log('Dados do usuário (objeto):', dadosUsuario);
      
      // Verificar diferentes formatos possíveis
      const respostas = dadosUsuario?.respostas;
      if (!respostas) {
        console.warn('Respostas não encontradas nos dados do usuário');
        return 'BRL';
      }
      
      console.log('Respostas do usuário:', respostas);
      
      // 1. Verificar formato direto (string com código da moeda)
      if (respostas.moeda_escolhida) {
        const moeda = respostas.moeda_escolhida;
        console.log('Moeda encontrada (formato direto):', moeda);
        
        // Se for código direto de 3 letras
        if (typeof moeda === 'string' && /^[A-Z]{3}$/.test(moeda)) {
          return moeda;
        }
        
        // Se for string com formato "Moeda (XXX)"
        if (typeof moeda === 'string' && moeda.includes('(')) {
          const match = moeda.match(/\(([A-Z]{3})\)/);
          if (match && match[1]) {
            return match[1];
          }
        }
        
        // Se for índice numérico (0=BRL, 1=USD, 2=EUR)
        if (typeof moeda === 'number' || !isNaN(parseInt(moeda))) {
          const indice = parseInt(moeda);
          const moedasPadrao = ['BRL', 'USD', 'EUR'];
          if (indice >= 0 && indice < moedasPadrao.length) {
            return moedasPadrao[indice];
          }
        }
      }
      
      // 2. Verificar mapeamento de moedas
      // Formato esperado: currency_map = { "opção selecionada": "BRL" }
      if (respostas.currency_map) {
        console.log('Currency map encontrado:', respostas.currency_map);
        
        // Se for objeto
        if (typeof respostas.currency_map === 'object') {
          // Encontra a opção selecionada
          const opcaoSelecionada = respostas.moeda_escolhida;
          if (opcaoSelecionada && respostas.currency_map[opcaoSelecionada]) {
            return respostas.currency_map[opcaoSelecionada];
          }
          
          // Se não encontrou pela opção selecionada, pega o primeiro valor
          const primeiroValor = Object.values(respostas.currency_map)[0];
          if (primeiroValor && typeof primeiroValor === 'string') {
            return primeiroValor;
          }
        }
      }
      
      // 3. Verificar outros campos possíveis
      if (respostas.moeda && typeof respostas.moeda === 'string') {
        if (/^[A-Z]{3}$/.test(respostas.moeda)) {
          return respostas.moeda;
        }
      }
      
      // 4. Verificar texto descritivo
      const camposPossiveis = ['moeda_escolhida', 'moeda', 'currency'];
      for (const campo of camposPossiveis) {
        if (respostas[campo] && typeof respostas[campo] === 'string') {
          // Verificar por texto padrão como "Real Brasileiro (BRL)"
          if (respostas[campo].includes('BRL')) return 'BRL';
          if (respostas[campo].includes('USD')) return 'USD';
          if (respostas[campo].includes('EUR')) return 'EUR';
        }
      }
      
      // Nenhuma moeda encontrada, retorna o padrão
      console.warn('Nenhuma moeda encontrada nos dados. Usando BRL como padrão.');
      return 'BRL';
    } catch (e) {
      console.error('Erro ao obter moeda atual:', e);
      return 'BRL';
    }
  },
  
  /**
   * Obtém o nome da companhia aérea a partir do código IATA
   * @param {string} codigoIATA - Código IATA da companhia
   * @returns {string} Nome da companhia
   */
  obterNomeCompanhiaAerea(codigoIATA) {
    if (!codigoIATA) return 'N/A';
    
    const airline = this.accumulatedAirlines[codigoIATA];
    return airline?.name || codigoIATA;
  },

  /**
   * Obtém informações de um segmento de voo
   * @param {Object} segmento - Dados do segmento
   * @returns {Object} Informações processadas do segmento
   */
  obterInfoSegmento(segmento) {
    // Valores padrão para o caso de dados ausentes
    const def = { 
      aeroportoPartida: 'N/A', 
      aeroportoChegada: 'N/A', 
      dataPartida: null, 
      dataChegada: null, 
      horaPartida: 'N/A', 
      horaChegada: 'N/A', 
      duracao: 0, 
      paradas: 0 
    };
    
    try {
      if (!segmento?.flight?.length) return def;
      
      const pV = segmento.flight[0], uV = segmento.flight[segmento.flight.length - 1];
      if (!pV || !uV) return def;
      
      // Se é um voo de teste com timestamps
      if (pV.local_departure_timestamp && uV.local_arrival_timestamp) {
        const dP = new Date(pV.local_departure_timestamp * 1000);
        const dC = new Date(uV.local_arrival_timestamp * 1000);
        
        return {
          aeroportoPartida: pV.departure,
          aeroportoChegada: uV.arrival,
          dataPartida: dP,
          dataChegada: dC,
          horaPartida: pV.departure_time || dP.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          horaChegada: uV.arrival_time || dC.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          duracao: pV.duration || Math.round((uV.local_arrival_timestamp - pV.local_departure_timestamp) / 60),
          paradas: segmento.flight.length - 1
        };
      }
      
      // Se tem data e hora como strings
      if (pV.departure_date && pV.departure_time && uV.arrival_date && uV.arrival_time) {
        return {
          aeroportoPartida: pV.departure,
          aeroportoChegada: uV.arrival,
          dataPartida: new Date(`${pV.departure_date}T${pV.departure_time}`),
          dataChegada: new Date(`${uV.arrival_date}T${uV.arrival_time}`),
          horaPartida: pV.departure_time,
          horaChegada: uV.arrival_time,
          duracao: pV.duration || 0,
          paradas: segmento.flight.length - 1
        };
      }
      
      return {
        ...def,
        aeroportoPartida: pV.departure,
        aeroportoChegada: uV.arrival,
        paradas: segmento.flight.length - 1
      };
    } catch (erro) {
      console.warn('Erro ao obter informações do segmento:', erro);
      return def;
    }
  },

  /**
   * Seleciona o próximo voo
   */
  proximoVoo() {
    if (!this.finalResults?.proposals?.length || this.finalResults.proposals.length <= 1) return;
    
    this.indexVooAtivo = (this.indexVooAtivo + 1) % this.finalResults.proposals.length;
    this.vooAtivo = this.finalResults.proposals[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },

  /**
   * Seleciona o voo anterior
   */
  vooAnterior() {
    if (!this.finalResults?.proposals?.length || this.finalResults.proposals.length <= 1) return;
    
    this.indexVooAtivo = (this.indexVooAtivo - 1 + this.finalResults.proposals.length) % this.finalResults.proposals.length;
    this.vooAtivo = this.finalResults.proposals[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },

  /**
   * Atualiza o voo ativo na interface
   */
  atualizarVooAtivo() {
    // Remove classe ativo de todos os cards
    const cards = document.querySelectorAll('.voo-card');
    if (cards.length) {
      cards.forEach(card => {
        card.classList.remove('voo-card-ativo');
      });
      
      // Adiciona classe ativo ao card atual
      const cardAtivo = document.querySelector(`.voo-card[data-voo-index="${this.indexVooAtivo}"]`);
      if (cardAtivo) {
        cardAtivo.classList.add('voo-card-ativo');
        
        // Centraliza o card na visualização
        cardAtivo.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest', 
          inline: 'center' 
        });
      }
    }
    
    // Atualiza os dots de paginação
    const dots = document.querySelectorAll('.pagination-dot');
    if (dots.length) {
      dots.forEach(dot => {
        const dotIndex = parseInt(dot.dataset.index || '0');
        dot.classList.toggle('active', dotIndex === this.indexVooAtivo);
      });
    }
    
    // Atualiza o botão de seleção
    this.atualizarBotaoSelecao();
  },

  /**
   * Seleciona um voo pelo ID
   * @param {string} vooId - ID do voo a ser selecionado
   */
  selecionarVoo(vooId) {
    if (!this.finalResults?.proposals) return;
    
    // Encontra o voo pelo ID
    const vooEncontrado = this.finalResults.proposals.find(
      (v, index) => (v.sign || `voo-idx-${index}`) === vooId
    );
    
    if (!vooEncontrado) { 
      console.error(`Voo ${vooId} não encontrado`); 
      return; 
    }
    
    // Atualiza o voo selecionado
    this.vooSelecionado = vooEncontrado;
    
    // Também atualiza o voo ativo para o selecionado
    const index = this.finalResults.proposals.findIndex(
      (v, idx) => (v.sign || `voo-idx-${idx}`) === vooId
    );
    
    if (index !== -1) { 
      this.vooAtivo = vooEncontrado; 
      this.indexVooAtivo = index; 
    }
    
    // Atualiza a UI com a seleção
    const cards = document.querySelectorAll('.voo-card');
    if (cards.length) {
      cards.forEach(card => { 
        card.classList.remove('voo-selecionado'); 
        if (card.dataset.vooId === vooId) {
          card.classList.add('voo-selecionado');
        }
      });
    }
    
    // Feedback ao usuário
    this.exibirToast('Voo selecionado! Confirme sua escolha', 'success');
    
    // Atualiza o botão de confirmação
    this.atualizarBotaoSelecao();
    
    // Usar a função global para mostrar o modal de confirmação
    if (typeof window.mostrarConfirmacaoSelecao === 'function') {
        window.mostrarConfirmacaoSelecao();
    }
  },

  /**
   * Seleciona o voo ativo
   */
  selecionarVooAtivo() {
    if (!this.vooAtivo) {
      console.error('Nenhum voo ativo');
      return;
    }
    
    const vooId = this.vooAtivo.sign || `voo-idx-${this.indexVooAtivo}`;
    this.selecionarVoo(vooId);
  },

  /**
   * Exibe uma mensagem toast na interface
   * @param {string} mensagem - Mensagem a ser exibida
   * @param {string} tipo - Tipo do toast (info, success, warning, error)
   */
  exibirToast(mensagem, tipo = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    // Remove toasts existentes
    const existingToasts = toastContainer.querySelectorAll('.toast');
    existingToasts.forEach(toast => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    });
    
    // Cria o toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = mensagem;
    
    // Adiciona ao container
    toastContainer.appendChild(toast);
    
    // Anima entrada
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    
    // Configura saída automática
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /**
   * Carrega dados do usuário do localStorage
   * @returns {Object} Dados do usuário
   */
  carregarDadosUsuario() {
    try {
      return JSON.parse(localStorage.getItem('benetrip_user_data') || '{}');
    } catch (erro) {
      console.warn('Erro ao carregar dados do usuário:', erro);
      return {};
    }
  },

  /**
   * Obtém o código IATA da origem a partir dos dados do usuário
   * @param {Object} dadosUsuario - Dados do usuário
   * @returns {string} Código IATA da origem
   */
  obterCodigoIATAOrigem(dadosUsuario) {
    try {
      const r = dadosUsuario?.respostas;
      if (!r) return 'GRU';
      
      // Tenta obter o código de origem de diferentes campos
      let c = r.cidade_partida || r.partida || null;
      
      // Se for um objeto, extrai o código
      if (c && typeof c === 'object') {
        c = c.code || c.value || c.name || c.iata || null;
      }
      
      // Se for uma string, tenta extrair o código IATA
      if (typeof c === 'string') {
        // Se já for um código IATA, retorna
        if (/^[A-Z]{3}$/.test(c)) return c;
        
        // Tenta extrair de um formato como "City (XXX)"
        const m = c.match(/\(([A-Z]{3})\)/);
        if (m?.[1]) return m[1];
        
        // Busca no mapeamento de cidades conhecidas
        const l = c.toLowerCase().trim();
        if (this.IATA_MAP[l]) return this.IATA_MAP[l];
      }
    } catch (e) {
      console.error("Erro ao obter origem:", e);
    }
    
    // Valor padrão como fallback
    return 'GRU';
  },

  /**
   * Obtém a quantidade de passageiros
   * @returns {number} Número de passageiros
   */
  obterQuantidadePassageiros() {
    try {
      const r = this.carregarDadosUsuario()?.respostas;
      
      // Tenta obter quantidade de passageiros de diferentes formatos
      const p = r?.passageiros;
      if (p) {
        return Math.max(1, 
          (parseInt(p.adultos) || 0) + 
          (parseInt(p.criancas) || 0) + 
          (parseInt(p.bebes) || 0)
        );
      }
      
      // Formato quantidade total
      const q = parseInt(r?.quantidade_familia) || 
                parseInt(r?.quantidade_amigos) || 
                parseInt(r?.quantidade_pessoas) || 0;
      if (q > 0) return q;
      
      // Formato tipo de companhia
      const comp = r?.companhia;
      if (comp === 0) return 1;  // Sozinho
      if (comp === 1) return 2;  // Casal
      if (comp >= 2) return Math.max(2, comp);  // Grupo/família
    } catch (e) {
      console.error("Erro ao obter quantidade de passageiros:", e);
    }
    
    // Valor padrão: 1 passageiro
    return 1;
  },

  /**
   * Formata um valor de preço para exibição
   * @param {number} preco - Valor do preço
   * @param {string} moeda - Código da moeda
   * @returns {string} Preço formatado
   */
  formatarPreco(preco, moeda = 'BRL') {
    if (typeof preco !== 'number' || isNaN(preco)) return 'N/A';
    
    // Se moeda não foi especificada, tenta obter do usuário
    if (arguments.length === 1) {
      moeda = this.obterMoedaAtual();
    }
    
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: moeda, 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(preco);
  },

  /**
   * Formata uma data para exibição
   * @param {Date} data - Data a ser formatada
   * @returns {string} Data formatada
   */
  formatarData(data) {
    if (!(data instanceof Date) || isNaN(data.getTime())) return 'N/A';
    
    const d = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    return `${d[data.getDay()]}, ${data.getDate()} ${m[data.getMonth()]}`;
  },

  /**
   * Formata uma duração em minutos para exibição
   * @param {number} duracaoMinutos - Duração em minutos
   * @returns {string} Duração formatada
   */
  formatarDuracao(duracaoMinutos) {
    if (typeof duracaoMinutos !== 'number' || duracaoMinutos < 0) return 'N/A';
    
    const h = Math.floor(duracaoMinutos / 60), m = duracaoMinutos % 60;
    return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
  }

}; // Fim do objeto BENETRIP_VOOS

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('voos-container')) {
    console.log('Inicializando módulo de voos Benetrip...');
    BENETRIP_VOOS.init();
  }
});

// Exporta o módulo para acesso global
window.BENETRIP_VOOS = BENETRIP_VOOS;
