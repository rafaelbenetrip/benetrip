/**
 * BENETRIP - Módulo de Busca e Exibição de Voos
 * Versão simplificada para aderência ao protótipo
 */

// Módulo de Voos do Benetrip
const BENETRIP_VOOS = {
  // --- Constantes ---
  INITIAL_WAIT_MS: 3000,
  POLLING_INTERVAL_MS: 2000,
  MAX_POLLING_ATTEMPTS: 30,
  TIMEOUT_MS: 90000,
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
  
  // --- Inicialização ---
  init() {
    console.log('Inicializando sistema de busca de voos...');
    this.resetState();
    this.configurarEventos();
    this.criarToastContainerSeNecessario();
    this.carregarDestino()
      .then(() => this.iniciarBuscaVoos())
      .catch(erro => this.mostrarErro('Erro ao carregar destino. Tente selecionar novamente.'));
  },

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

  criarToastContainerSeNecessario() {
    if (!document.getElementById('toast-container')) {
      const toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  },

  configurarEventos() {
    // Eventos principais
    document.addEventListener('click', (event) => {
      try {
        const target = event.target;
        
        // Botão de detalhes do voo
        const btnDetalhes = target.closest('.btn-detalhes-voo');
        if (btnDetalhes) {
          const vooId = btnDetalhes.dataset.vooId;
          if (vooId) this.mostrarDetalhesVoo(vooId);
          return;
        }

        // Botão Tentar Novamente (em caso de erro)
        const btnTentar = target.closest('.btn-tentar-novamente');
        if (btnTentar) {
          window.location.reload();
          return;
        }

        // Clique no card de voo
        const vooCard = target.closest('.voo-card');
        if (vooCard && this.finalResults?.proposals?.length > 0) {
          const vooId = vooCard.dataset.vooId;
          if (vooId) {
            this.selecionarVoo(vooId);
          }
        }

        // Botão de selecionar voo (botão fixo no rodapé)
        if (target.closest('.btn-selecionar-voo')) {
          if (this.vooSelecionado) {
            this.mostrarConfirmacaoSelecao(this.vooSelecionado);
          } else if (this.vooAtivo) {
            this.selecionarVooAtivo();
            if (this.vooSelecionado) {
              this.mostrarConfirmacaoSelecao(this.vooSelecionado);
            }
          } else {
            this.exibirToast('Deslize e escolha um voo primeiro', 'warning');
          }
          return;
        }
        
        // Botão de voltar
        if (target.closest('.btn-voltar')) {
          window.location.href = 'destinos.html';
          return;
        }
        
        // Botões de navegação
        if (target.closest('.next-btn')) {
          this.proximoVoo();
          return;
        }
        
        if (target.closest('.prev-btn')) {
          this.vooAnterior();
          return;
        }
      } catch (erro) {
        console.error('Erro ao processar evento de clique:', erro);
      }
    });

    // Configurar swipe com Hammer.js
    this.configurarSwipeGestures();
    
    // Configurar scroll para atualizar card ativo
    this.configurarScrollBehavior();
  },
  
  configurarSwipeGestures() {
    if (typeof Hammer !== 'undefined') {
      const sc = document.getElementById('voos-swipe-container');
      if (sc) {
        if (this.hammerInstance) {
          this.hammerInstance.destroy();
        }
        
        this.hammerInstance = new Hammer(sc);
        this.hammerInstance.on('swipeleft', () => this.proximoVoo());
        this.hammerInstance.on('swiperight', () => this.vooAnterior());
      }
    }
  },
  
  configurarScrollBehavior() {
    const sc = document.getElementById('voos-swipe-container');
    if (!sc) return;
    
    let scrollTimeoutId = null;
    
    sc.addEventListener('scroll', () => {
      clearTimeout(scrollTimeoutId);
      scrollTimeoutId = setTimeout(() => {
        // Encontra o card no centro da visualização
        const containerRect = sc.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;
        
        let closestCard = null;
        let closestDistance = Infinity;
        
        const cards = sc.querySelectorAll('.voo-card');
        cards.forEach((card, index) => {
          const cardRect = card.getBoundingClientRect();
          const cardCenter = cardRect.left + cardRect.width / 2;
          const distance = Math.abs(containerCenter - cardCenter);
          
          if (distance < closestDistance) {
            closestDistance = distance;
            closestCard = card;
          }
        });
        
        if (closestCard) {
          const index = parseInt(closestCard.dataset.vooIndex || '0');
          if (this.finalResults?.proposals[index]) {
            this.vooAtivo = this.finalResults.proposals[index];
            this.indexVooAtivo = index;
            this.atualizarVooAtivo();
          }
        }
      }, 150);
    });
  },

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
        locale: "en"
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
      this.currencyRates = dados.currency_rates;

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

  async verificarResultados() {
    if (!this.isPolling) return;

    this.pollingAttempts++;
    console.log(`Polling: Tentativa ${this.pollingAttempts}/${this.MAX_POLLING_ATTEMPTS}`);

    // Atualiza UI
    const mensagens = [
      'Buscando voos...', 
      'Verificando tarifas...', 
      'Analisando conexões...', 
      'Quase lá...'
    ];
    const msgIdx = Math.min(
      Math.floor(this.pollingAttempts / (this.MAX_POLLING_ATTEMPTS / mensagens.length)), 
      mensagens.length - 1
    );
    const progresso = 20 + Math.min(75, (this.pollingAttempts / this.MAX_POLLING_ATTEMPTS) * 75);
    
    this.atualizarProgresso(mensagens[msgIdx], progresso);

    // Verifica limite de tentativas
    if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS) {
      this.pararPolling();
      this.mostrarErro('A busca demorou mais que o esperado.');
      return;
    }

    try {
      // Chama o backend
      const resposta = await fetch(`/api/flight-results?uuid=${this.searchId}`);

      if (!resposta.ok) {
        console.error(`Erro ao buscar resultados: ${resposta.status}`);
        return;
      }

      // Processa a resposta
      const dados = await resposta.json();
      
      // Verifica se há propostas
      if (Array.isArray(dados)) {
        // Processa cada item do array
        dados.forEach(item => {
          if (item && item.proposals && Array.isArray(item.proposals)) {
            this.accumulatedProposals.push(...item.proposals);
          }
          
          // Extrai dados auxiliares
          if (item && item.airlines) Object.assign(this.accumulatedAirlines, item.airlines);
          if (item && item.airports) Object.assign(this.accumulatedAirports, item.airports);
          if (item && item.gates_info) Object.assign(this.accumulatedGatesInfo, item.gates_info);
        });
        
        // Se encontrou apenas um objeto com search_id, pode ser o fim
        const finalItem = dados.find(item => 
          item && typeof item === 'object' && 
          Object.keys(item).length === 1 && 
          item.search_id === this.searchId
        );
        
        if (finalItem && this.accumulatedProposals.length > 0) {
          console.log('Busca concluída!');
          this.concluirBusca();
        }
      }
      
    } catch (erro) {
      console.error('Erro durante o polling:', erro);
    }
  },
  
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
  
  concluirBusca() {
    // Para o polling
    this.pararPolling();
    this.estaCarregando = false;
    
    // Prepara resultados finais
    this.finalResults = {
      proposals: this.preprocessarPropostas(this.accumulatedProposals),
      airlines: this.accumulatedAirlines,
      airports: this.accumulatedAirports,
      gates_info: this.accumulatedGatesInfo,
      meta: { currency: 'BRL' }
    };
    
    // Atualiza UI
    if (this.finalResults.proposals.length > 0) {
      this.vooAtivo = this.finalResults.proposals[0];
      this.indexVooAtivo = 0;
      
      this.exibirToast(`${this.finalResults.proposals.length} voos encontrados! ✈️`, 'success');
      this.renderizarResultados();
      
      // Configura navegação após renderização
      setTimeout(() => {
        this.configurarSwipeGestures();
        this.configurarScrollBehavior();
      }, 500);
    } else {
      this.exibirToast('Não encontramos voos disponíveis.', 'warning');
      this.renderizarSemResultados();
    }
  },
  
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

  renderizarResultados() {
    // Obtém o container principal
    const container = document.querySelector('.voos-content');
    if (!container) return;
    
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
    this.finalResults.proposals.forEach((voo, index) => {
      const cardVoo = this.criarCardVoo(voo, index);
      voosContainer.appendChild(cardVoo);
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
  },

// Função para obter URL do logo da companhia aérea
getAirlineLogoUrl(iataCode, width = 40, height = 40, retina = false) {
  if (!iataCode || typeof iataCode !== 'string') {
    return `https://pics.avs.io/${width}/${height}/default.png`;
  }
  
  // Converte para maiúsculas e remove espaços
  const code = iataCode.trim().toUpperCase();
  
  // Adiciona sufixo @2x para versão retina, se solicitado
  const retinaSuffix = retina ? '@2x' : '';
  
  return `https://pics.avs.io/${width}/${height}/${code}${retinaSuffix}.png`;
},

// Função para obter URL do logo da agência (gateway)
getAgencyLogoUrl(gateId, width = 110, height = 40, retina = false) {
  if (!gateId) {
    return null;
  }
  
  // Adiciona sufixo @2x para versão retina, se solicitado
  const retinaSuffix = retina ? '@2x' : '';
  
  return `https://pics.avs.io/as_gates/${width}/${height}/${gateId}${retinaSuffix}.png`;
},
  
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
  const moeda = this.finalResults?.meta?.currency || 'BRL';
  const infoIda = this.obterInfoSegmento(voo.segment?.[0]);
  const infoVolta = voo.segment?.length > 1 ? this.obterInfoSegmento(voo.segment[1]) : null;
  const economiaPercentual = voo._economia || 0;
  const isMelhorPreco = voo._melhorPreco || index === 0;
  const ehVooDireto = infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0);
  
  // Adiciona classes especiais
  if (ehVooDireto) cardVoo.classList.add('voo-direto');
  
  // Constrói o HTML interno com o novo layout
  cardVoo.innerHTML = `
    <div class="voo-card-header">
      <div class="voo-price-container">
        <div class="voo-price">${this.formatarPreco(preco, moeda)}</div>
        ${economiaPercentual > 0 ? `<span class="discount-badge">-${economiaPercentual}%</span>` : ''}
        ${isMelhorPreco ? '<span class="card-tag melhor-preco">Melhor preço</span>' : ''}
      </div>
      <div class="voo-price-details">Por pessoa, ida${infoVolta ? ' e volta' : ''}</div>
      <div class="airline-info">${this.obterNomeCompanhiaAerea(voo.carriers?.[0])}</div>
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

  // Extrai código IATA da companhia aérea
  const companhiaIATA = voo.carriers?.[0];
  const companhiaAerea = this.obterNomeCompanhiaAerea(companhiaIATA);
  
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
        <img src="${this.getAirlineLogoUrl(companhiaIATA, 20, 20)}" alt="${companhiaAerea}" class="airline-logo">
        ${companhiaAerea}
      </div>
    </div>
    `;
  return cardVoo;
},

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

  atualizarBotaoSelecao() {
    const botaoFixo = document.querySelector('.botao-selecao-fixo');
    if (!botaoFixo) return;
    
    // Tenta obter o preço do voo ativo
    let precoTexto = 'Escolher Este Voo';
    if (this.vooAtivo) {
      const preco = this.obterPrecoVoo(this.vooAtivo);
      const moeda = this.finalResults?.meta?.currency || 'BRL';
      precoTexto = `Escolher Voo por ${this.formatarPreco(preco, moeda)}`;
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

  obterPrecoVoo(voo) {
    if (!voo || !voo.terms) return 0;
    
    try {
      const k = Object.keys(voo.terms)[0];
      return voo.terms[k]?.unified_price || voo.terms[k]?.price || 0;
    } catch (erro) {
      console.warn('Erro ao obter preço do voo:', erro);
      return 0;
    }
  },
  
  obterNomeCompanhiaAerea(codigoIATA) {
    if (!codigoIATA) return 'N/A';
    
    const airline = this.accumulatedAirlines[codigoIATA];
    return airline?.name || codigoIATA;
  },

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

  proximoVoo() {
    if (!this.finalResults?.proposals?.length || this.finalResults.proposals.length <= 1) return;
    
    this.indexVooAtivo = (this.indexVooAtivo + 1) % this.finalResults.proposals.length;
    this.vooAtivo = this.finalResults.proposals[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },

  vooAnterior() {
    if (!this.finalResults?.proposals?.length || this.finalResults.proposals.length <= 1) return;
    
    this.indexVooAtivo = (this.indexVooAtivo - 1 + this.finalResults.proposals.length) % this.finalResults.proposals.length;
    this.vooAtivo = this.finalResults.proposals[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },

  atualizarVooAtivo() {
    // Remove classe ativo de todos os cards
    document.querySelectorAll('.voo-card').forEach(card => {
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
    
    // Atualiza os dots de paginação
    document.querySelectorAll('.pagination-dot').forEach(dot => {
      const dotIndex = parseInt(dot.dataset.index || '0');
      dot.classList.toggle('active', dotIndex === this.indexVooAtivo);
    });
    
    // Atualiza o botão de seleção
    this.atualizarBotaoSelecao();
  },

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
    document.querySelectorAll('.voo-card').forEach(card => { 
      card.classList.remove('voo-selecionado'); 
      if (card.dataset.vooId === vooId) {
        card.classList.add('voo-selecionado');
      }
    });
    
    // Feedback ao usuário
    this.exibirToast('Voo selecionado! Confirme sua escolha', 'success');
    
    // Atualiza o botão de confirmação
    this.atualizarBotaoSelecao();
  },

  selecionarVooAtivo() {
    if (!this.vooAtivo) {
      console.error('Nenhum voo ativo');
      return;
    }
    
    const vooId = this.vooAtivo.sign || `voo-idx-${this.indexVooAtivo}`;
    this.selecionarVoo(vooId);
  },

  mostrarDetalhesVoo(vooId) {
  if (!this.finalResults?.proposals) return;
  
  // Encontra o voo pelo ID
  const voo = this.finalResults.proposals.find(
    (v, index) => (v.sign || `voo-idx-${index}`) === vooId
  );
  
  if (!voo) { 
    console.error(`Voo ${vooId} não encontrado`); 
    return; 
  }
  
  // Remove modal existente se houver
  document.getElementById('modal-detalhes-voo')?.remove();
  
  // Extrai informações do voo
  const preco = this.obterPrecoVoo(voo);
  const moeda = this.finalResults?.meta?.currency || 'BRL';
  const infoIda = this.obterInfoSegmento(voo.segment?.[0]);
  const infoVolta = voo.segment?.length > 1 ? this.obterInfoSegmento(voo.segment[1]) : null;
  const companhiaIATA = voo.carriers?.[0];
  const companhiaAerea = this.obterNomeCompanhiaAerea(voo.carriers?.[0]);
  const ehVooDireto = infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0);
  
  // Cria o modal com o novo design
  const modalContainer = document.createElement('div');
  modalContainer.className = 'modal-backdrop';
  modalContainer.id = 'modal-detalhes-voo';
  
  // Conteúdo do modal
  modalContainer.innerHTML = `
    <div class="modal-content modal-detalhes-voo">
      <div class="modal-header">
        <h3 class="modal-title">Detalhes do Voo</h3>
        <button id="btn-fechar-detalhes" class="btn-fechar">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="detalhes-content">
      <!-- Resumo de preço e companhia -->
      <div class="detalhes-sumario">
        <div class="detalhes-preco">
          <div class="preco-valor">${this.formatarPreco(preco, moeda)}</div>
          <div class="preco-info">Por pessoa, ida${infoVolta ? ' e volta' : ''}</div>
        </div>
        <div class="detalhes-companhia">
          <div class="companhia-logo">
            <img src="${this.getAirlineLogoUrl(companhiaIATA, 60, 60)}" 
                 alt="${companhiaAerea}" 
                 onerror="this.src='${this.getAirlineLogoUrl('default', 60, 60)}'">
          </div>
          <div class="companhia-nome">${companhiaAerea}</div>
        </div>
      </div>
        
        <!-- Visualização da rota com timeline -->
        <div class="detalhes-secao">
          <div class="secao-header">
            <h4 class="secao-titulo">Ida • ${this.formatarData(infoIda?.dataPartida)}</h4>
            ${ehVooDireto ? `
            <div class="secao-etiqueta voo-direto">
              <span class="etiqueta-icone">✈️</span>
              <span>Voo Direto</span>
            </div>` : ''}
          </div>
          
          <div class="timeline-voo">
            <div class="timeline-item">
              <div class="timeline-ponto partida">
                <div class="timeline-tempo">${infoIda?.horaPartida || '--:--'}</div>
                <div class="timeline-local">
                  <div class="timeline-codigo">${infoIda?.aeroportoPartida || '---'}</div>
                  <div class="timeline-cidade">${this.obterNomeCidade(infoIda?.aeroportoPartida) || 'Origem'}</div>
                </div>
              </div>
              <div class="timeline-linha">
                <div class="duracao-badge">${this.formatarDuracao(infoIda?.duracao || 0)}</div>
              </div>
              <div class="timeline-ponto chegada">
                <div class="timeline-tempo">${infoIda?.horaChegada || '--:--'}</div>
                <div class="timeline-local">
                  <div class="timeline-codigo">${infoIda?.aeroportoChegada || '---'}</div>
                  <div class="timeline-cidade">${this.obterNomeCidade(infoIda?.aeroportoChegada) || 'Destino'}</div>
                </div>
              </div>
            </div>
            
            <div class="voo-info">
              <div class="info-item">
                <span class="info-icone">🛫</span>
                <span class="info-texto">Voo ${voo.segment?.[0]?.flight?.[0]?.marketing_carrier || ''}${voo.segment?.[0]?.flight?.[0]?.number || ''}</span>
              </div>
              <div class="info-item">
                <span class="info-icone">🪑</span>
                <span class="info-texto">Classe Econômica</span>
              </div>
              ${voo.segment?.[0]?.flight?.[0]?.aircraft ? `
              <div class="info-item">
                <span class="info-icone">✓</span>
                <span class="info-texto">Aeronave: ${voo.segment?.[0]?.flight?.[0]?.aircraft}</span>
              </div>` : ''}
            </div>
          </div>
        </div>
        
        ${infoVolta ? `
        <!-- Volta -->
        <div class="detalhes-secao">
          <div class="secao-header">
            <h4 class="secao-titulo">Volta • ${this.formatarData(infoVolta.dataPartida)}</h4>
            ${infoVolta.paradas === 0 ? `
            <div class="secao-etiqueta voo-direto">
              <span class="etiqueta-icone">✈️</span>
              <span>Voo Direto</span>
            </div>` : ''}
          </div>
          
          <div class="timeline-voo">
            <div class="timeline-item">
              <div class="timeline-ponto partida">
                <div class="timeline-tempo">${infoVolta.horaPartida || '--:--'}</div>
                <div class="timeline-local">
                  <div class="timeline-codigo">${infoVolta.aeroportoPartida || '---'}</div>
                  <div class="timeline-cidade">${this.obterNomeCidade(infoVolta.aeroportoPartida) || 'Origem'}</div>
                </div>
              </div>
              <div class="timeline-linha">
                <div class="duracao-badge">${this.formatarDuracao(infoVolta.duracao || 0)}</div>
              </div>
              <div class="timeline-ponto chegada">
                <div class="timeline-tempo">${infoVolta.horaChegada || '--:--'}</div>
                <div class="timeline-local">
                  <div class="timeline-codigo">${infoVolta.aeroportoChegada || '---'}</div>
                  <div class="timeline-cidade">${this.obterNomeCidade(infoVolta.aeroportoChegada) || 'Destino'}</div>
                </div>
              </div>
            </div>
            
            <div class="voo-info">
              <div class="info-item">
                <span class="info-icone">🛫</span>
                <span class="info-texto">Voo ${voo.segment?.[1]?.flight?.[0]?.marketing_carrier || ''}${voo.segment?.[1]?.flight?.[0]?.number || ''}</span>
              </div>
              <div class="info-item">
                <span class="info-icone">🪑</span>
                <span class="info-texto">Classe Econômica</span>
              </div>
            </div>
          </div>
        </div>
        ` : ''}
        
        <!-- Serviços e bagagem -->
        <div class="detalhes-secao">
          <h4 class="secao-titulo">Serviços Incluídos</h4>
          <div class="servicos-grid">
            <div class="servico-item incluido">
              <span class="servico-icone">🧳</span>
              <span class="servico-nome">1 Bagagem de Mão</span>
            </div>
            <div class="servico-item incluido">
              <span class="servico-icone">🍽️</span>
              <span class="servico-nome">Refeição a Bordo</span>
            </div>
            <div class="servico-item incluido">
              <span class="servico-icone">🔄</span>
              <span class="servico-nome">Remarcação Flexível</span>
            </div>
            <div class="servico-item opcional">
              <span class="servico-icone">💼</span>
              <span class="servico-nome">Bagagem Despachada</span>
            </div>
            <div class="servico-item opcional">
              <span class="servico-icone">🪑</span>
              <span class="servico-nome">Escolha de Assento</span>
            </div>
          </div>
        </div>
        
        <!-- Política de cancelamento -->
        <div class="detalhes-secao">
          <div class="secao-header">
            <h4 class="secao-titulo">Política de Cancelamento</h4>
            <div class="politica-toggle">
              <span class="politica-icone">▼</span>
            </div>
          </div>
          <div class="politica-conteudo">
            <p class="politica-texto">
              Cancelamento até 24h antes da partida: cobrança de taxa de ${this.formatarPreco(350, moeda)} por passageiro.
              Cancelamento em menos de 24h: não reembolsável.
            </p>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="modal-btn modal-btn-secondary" id="btn-voltar-lista">
          Voltar
        </button>
        <button class="modal-btn modal-btn-primary" id="btn-selecionar-este-voo">
          Selecionar Voo
        </button>
      </div>
    </div>
  `;
  
  // Adiciona o modal ao DOM
  document.body.appendChild(modalContainer);
  
  // Configura eventos
  document.getElementById('btn-fechar-detalhes')?.addEventListener('click', () => modalContainer.remove());
  document.getElementById('btn-voltar-lista')?.addEventListener('click', () => modalContainer.remove());
  document.getElementById('btn-selecionar-este-voo')?.addEventListener('click', () => { 
    this.selecionarVoo(vooId); 
    modalContainer.remove(); 
    this.mostrarConfirmacaoSelecao(voo); 
  });
  
  // Configura o toggle da política de cancelamento
  const politicaToggle = modalContainer.querySelector('.politica-toggle');
  const politicaConteudo = modalContainer.querySelector('.politica-conteudo');
  
  if (politicaToggle && politicaConteudo) {
    politicaToggle.addEventListener('click', () => {
      const icone = politicaToggle.querySelector('.politica-icone');
      if (politicaConteudo.style.display === 'none') {
        politicaConteudo.style.display = 'block';
        icone.textContent = '▼';
      } else {
        politicaConteudo.style.display = 'none';
        icone.textContent = '▶';
      }
    });
  }
  
  // Fecha ao clicar fora
  modalContainer.addEventListener('click', (e) => { 
    if (e.target === modalContainer) modalContainer.remove(); 
  });
},

  // Função auxiliar para obter o nome da cidade a partir do código do aeroporto
function obterNomeCidade(codigoAeroporto) {
  if (!codigoAeroporto) return '';
  
  const aeroporto = this.accumulatedAirports[codigoAeroporto];
  if (aeroporto?.city) return aeroporto.city;
  
  // Se não encontrar no accumulated, tenta buscar no finalResults
  const finalAeroporto = this.finalResults?.airports?.[codigoAeroporto];
  return finalAeroporto?.city || '';
},

  renderizarTimelineVoos(voos) {
    if (!voos || !voos.length) return '<p>Informações não disponíveis</p>';
    
    let timeline = '';
    
    voos.forEach((v, i) => {
      const ultimo = i === voos.length - 1;
      
      // Obtém horários
      const horaPartida = v.departure_time || '--:--';
      const horaChegada = v.arrival_time || '--:--';
      
      // Obtém nome da companhia
      const companhia = this.obterNomeCompanhiaAerea(v.marketing_carrier);
      
      // Renderiza trecho
      timeline += `
        <div style="margin-bottom: ${ultimo ? '0' : '12px'}; padding-bottom: ${ultimo ? '0' : '12px'}; 
                   ${!ultimo ? 'border-bottom: 1px dashed #e0e0e0;' : ''}">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <div>
              <p style="font-weight: 700; margin: 0;">${horaPartida}</p>
              <p style="font-size: 0.8rem; margin: 0;">${v.departure}</p>
            </div>
            <div style="text-align: center; flex: 1; padding: 0 8px;">
              <p style="font-size: 0.7rem; color: #6c757d; margin: 0;">${this.formatarDuracao(v.duration || 0)}</p>
              <div style="height: 1px; background-color: #e0e0e0; margin: 4px 0; position: relative;">
                <div style="position: absolute; width: 4px; height: 4px; background-color: #6c757d; border-radius: 50%; 
                           top: -2px; left: 0;"></div>
                <div style="position: absolute; width: 4px; height: 4px; background-color: #6c757d; border-radius: 50%; 
                           top: -2px; right: 0;"></div>
              </div>
              <p style="font-size: 0.7rem; margin: 0;">${companhia}</p>
            </div>
            <div>
              <p style="font-weight: 700; margin: 0;">${horaChegada}</p>
              <p style="font-size: 0.8rem; margin: 0;">${v.arrival}</p>
            </div>
          </div>
          <div style="font-size: 0.8rem; color: #6c757d;">
            <p style="margin: 0;">Voo ${v.marketing_carrier || v.operating_carrier || ''}${v.number || ''}</p>
          </div>
        </div>
      `;
      
      // Adiciona informações de conexão
      if (!ultimo) {
        const prox = voos[i + 1];
        if (prox) {
          // Calcula tempo de conexão (usando strings de hora)
          let tempoConexao = 60; // Valor padrão
          
          if (v.arrival_time && prox.departure_time) {
            const [horaC, minC] = v.arrival_time.split(':').map(Number);
            const [horaP, minP] = prox.departure_time.split(':').map(Number);
            
            if (!isNaN(horaC) && !isNaN(minC) && !isNaN(horaP) && !isNaN(minP)) {
              const minutosC = horaC * 60 + minC;
              const minutosP = horaP * 60 + minP;
              tempoConexao = minutosP - minutosC;
              
              // Se negativo, assume que é no dia seguinte
              if (tempoConexao < 0) tempoConexao += 24 * 60;
            }
          }
          
          timeline += `
            <div style="margin-bottom: 12px; text-align: center; color: #E87722; font-size: 0.8rem;">
              <p style="margin: 0;">
                <span style="display: inline-block; vertical-align: middle; margin-right: 4px;">⏱️</span>
                Conexão em ${v.arrival} • ${this.formatarDuracao(tempoConexao)}
              </p>
            </div>
          `;
        }
      }
    });
    
    return timeline;
  },

  function mostrarConfirmacaoSelecao(voo) {
  // Remove modal existente se houver
  document.getElementById('modal-confirmacao')?.remove();
  
  // Prepara dados do voo
  const preco = this.obterPrecoVoo(voo);
  const moeda = this.finalResults?.meta?.currency || 'BRL';
  const precoFormatado = this.formatarPreco(preco, moeda);
  const numPassageiros = this.obterQuantidadePassageiros();
  const precoTotal = preco * numPassageiros;
  const precoTotalFormatado = this.formatarPreco(precoTotal, moeda);
  
  // Cria o modal
  const modalContainer = document.createElement('div');
  modalContainer.className = 'modal-backdrop';
  modalContainer.id = 'modal-confirmacao';
  
  // Conteúdo do modal com o novo design
  modalContainer.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Confirmar Seleção</h3>
        <button id="btn-fechar-modal" class="btn-fechar">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="confirmacao-tripinha">
        <div class="confirmacao-avatar">
          <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha">
        </div>
        <div class="confirmacao-content">
          <p class="confirmacao-titulo">Ótima escolha!</p>
          
          ${numPassageiros > 1 ? `
          <div class="confirmacao-resumo">
            <div class="resumo-item">
              <span class="resumo-label">Preço por pessoa:</span>
              <span class="resumo-valor">${precoFormatado}</span>
            </div>
            <div class="resumo-item">
              <span class="resumo-label">Total (${numPassageiros} pessoas):</span>
              <span class="resumo-valor destaque">${precoTotalFormatado}</span>
            </div>
          </div>
          ` : `
          <div class="confirmacao-resumo">
            <div class="resumo-item">
              <span class="resumo-label">Preço total:</span>
              <span class="resumo-valor destaque">${precoFormatado}</span>
            </div>
          </div>
          `}
          
          <div class="confirmacao-checkbox">
            <input type="checkbox" id="confirmar-selecao">
            <label for="confirmar-selecao">Confirmo que desejo prosseguir com este voo</label>
          </div>
          
          <p class="confirmacao-aviso">
            <span class="icon-info">ℹ️</span> 
            Após a confirmação, você será direcionado para selecionar sua hospedagem.
          </p>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="modal-btn modal-btn-secondary" id="btn-continuar-buscando">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"></path>
          </svg>
          Voltar aos Voos
        </button>
        <button class="modal-btn modal-btn-primary" id="btn-confirmar" disabled>
          Confirmar e Prosseguir
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  // Adiciona o modal ao DOM
  document.body.appendChild(modalContainer);
  
  // Configura eventos
  const chk = document.getElementById('confirmar-selecao');
  const btnC = document.getElementById('btn-confirmar');
  const btnX = document.getElementById('btn-fechar-modal');
  const btnB = document.getElementById('btn-continuar-buscando');
  
  if (chk) {
    chk.addEventListener('change', () => { 
      if (btnC) btnC.disabled = !chk.checked; 
    });
  }
  
  if (btnX) {
    btnX.addEventListener('click', () => { 
      modalContainer.remove(); 
    });
  }
  
  if (btnB) {
    btnB.addEventListener('click', () => { 
      modalContainer.remove(); 
    });
  }
  
  if (btnC) {
    btnC.addEventListener('click', () => {
      // Salva os dados do voo selecionado
      const dadosVoo = { 
        voo: this.vooSelecionado, 
        preco, 
        precoTotal, 
        moeda, 
        numPassageiros, 
        infoIda: this.obterInfoSegmento(this.vooSelecionado.segment?.[0]), 
        infoVolta: this.vooSelecionado.segment?.length > 1 ? 
          this.obterInfoSegmento(this.vooSelecionado.segment[1]) : null, 
        companhiaAerea: this.obterNomeCompanhiaAerea(this.vooSelecionado.carriers?.[0]), 
        dataSelecao: new Date().toISOString() 
      };
      
      localStorage.setItem('benetrip_voo_selecionado', JSON.stringify(dadosVoo));
      this.exibirToast('Voo selecionado! Redirecionando...', 'success');
      
      // Adiciona efeito de loading no botão
      btnC.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Processando...
      `;
      btnC.disabled = true;
      
      // Redireciona para a próxima página
      setTimeout(() => { 
        window.location.href = 'hotels.html'; 
      }, 1500);
    });
  }
  
  // Fecha ao clicar fora
  modalContainer.addEventListener('click', (e) => { 
    if (e.target === modalContainer) modalContainer.remove(); 
  });
},

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

  carregarDadosUsuario() {
    try {
      return JSON.parse(localStorage.getItem('benetrip_user_data') || '{}');
    } catch (erro) {
      console.warn('Erro ao carregar dados do usuário:', erro);
      return {};
    }
  },

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

  formatarPreco(preco, moeda = 'BRL') {
    if (typeof preco !== 'number' || isNaN(preco)) return 'N/A';
    
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: moeda, 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(preco);
  },

  formatarData(data) {
    if (!(data instanceof Date) || isNaN(data.getTime())) return 'N/A';
    
    const d = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    return `${d[data.getDay()]}, ${data.getDate()} ${m[data.getMonth()]}`;
  },

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

// Tratamento para erros não capturados
window.addEventListener('error', (event) => {
  console.error('Erro global:', event);
});
