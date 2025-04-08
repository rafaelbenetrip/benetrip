/**
 * BENETRIP - Módulo de Busca e Exibição de Voos
 * Versão 3.0.0 - Otimização de desempenho e correção de bugs
 */
const BENETRIP_VOOS = {
  // --- Constantes ---
  INITIAL_WAIT_MS: 5000,
  POLLING_INTERVAL_MS: 3000,
  MAX_POLLING_ATTEMPTS: 40,
  TIMEOUT_MS: 125000,
  IATA_MAP: {
    'sao paulo': 'GRU', 'rio de janeiro': 'GIG', 'brasilia': 'BSB', 'salvador': 'SSA',
    'recife': 'REC', 'fortaleza': 'FOR', 'belo horizonte': 'CNF', 'porto alegre': 'POA',
    'curitiba': 'CWB', 'belem': 'BEL', 'manaus': 'MAO', 'florianopolis': 'FLN',
    'natal': 'NAT', 'goiania': 'GYN', 'paris': 'CDG', 'londres': 'LHR', 
    'nova york': 'JFK', 'nova iorque': 'JFK', 'tokyo': 'HND', 'tóquio': 'HND', 
    'madrid': 'MAD', 'roma': 'FCO', 'berlim': 'BER', 'amsterdam': 'AMS', 
    'dubai': 'DXB', 'bangkok': 'BKK', 'sidney': 'SYD', 'sydney': 'SYD', 
    'los angeles': 'LAX', 'miami': 'MIA', 'cancun': 'CUN', 'cidade do méxico': 'MEX'
  },

  // --- Dados e Estado ---
  destino: null,
  searchId: null,
  currencyRates: null,
  estaCarregando: true,
  isPolling: false,
  pollingAttempts: 0,
  pollingIntervalId: null,
  initialWaitTimeoutId: null,
  timeoutId: null,
  accumulatedProposals: [],
  accumulatedAirlines: {},
  accumulatedAirports: {},
  accumulatedGatesInfo: {},
  accumulatedMeta: {},
  finalResults: null,
  temErro: false,
  mensagemErro: '',
  vooSelecionado: null,
  vooAtivo: null,
  indexVooAtivo: 0,
  hammerInstance: null,
  proximoVooOriginal: null,
  vooAnteriorOriginal: null,
  scrollTimeoutId: null,

  // Cache para melhorar performance
  dadosUsuarioCache: null,

  // --- Inicialização ---
  init() {
    console.log('Inicializando sistema de busca de voos v3.0.0 (Performance Optimized)...');
    this.resetState();
    this.configurarEventos();
    this.criarToastContainerSeNecessario();
    this.carregarDestino()
      .then(() => this.iniciarBuscaVoos())
      .catch(erro => this.mostrarErro('Erro ao carregar destino. Tente selecionar novamente.'));
    // Aplica estilos modernos se a função estiver definida
    this.aplicarEstilosModernos && this.aplicarEstilosModernos();
    this.renderizarInterface();
  },

  resetState() {
    // Reset completo de todos os estados
    this.destino = null;
    this.searchId = null;
    this.currencyRates = null;
    this.estaCarregando = true;
    this.isPolling = false;
    this.pollingAttempts = 0;
    this.limparTemporizadores();
    this.accumulatedProposals = [];
    this.accumulatedAirlines = {};
    this.accumulatedAirports = {};
    this.accumulatedGatesInfo = {};
    this.accumulatedMeta = {};
    this.finalResults = null;
    this.temErro = false;
    this.mensagemErro = '';
    this.vooSelecionado = null;
    this.vooAtivo = null;
    this.indexVooAtivo = 0;
    this.dadosUsuarioCache = null;
  },

  limparTemporizadores() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    if (this.initialWaitTimeoutId) {
      clearTimeout(this.initialWaitTimeoutId);
      this.initialWaitTimeoutId = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.scrollTimeoutId) {
      clearTimeout(this.scrollTimeoutId);
      this.scrollTimeoutId = null;
    }
  },

  criarToastContainerSeNecessario() {
    if (!document.getElementById('toast-container')) {
      const toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  },

  configurarEventos() {
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
        // Botões em "Sem Resultados"
        const semResultadosContainer = target.closest('.sem-resultados-container');
        if (semResultadosContainer) {
          if (target.closest('.btn-secundario')) { 
            window.location.href = 'index.html'; 
            return; 
          }
          if (target.closest('.btn-principal')) { 
            window.location.href = 'destinos.html'; 
            return; 
          }
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
            this.mostrarConfirmacaoSelecao && this.mostrarConfirmacaoSelecao(this.vooSelecionado);
          } else if (this.vooAtivo) {
            this.selecionarVooAtivo();
            if (this.vooSelecionado) {
              this.mostrarConfirmacaoSelecao && this.mostrarConfirmacaoSelecao(this.vooSelecionado);
            }
          } else {
            this.exibirToast('Deslize e escolha um voo primeiro', 'warning');
          }
          return;
        }
      } catch (erro) {
        console.error('Erro ao processar evento de clique:', erro);
        this.reportarErro && this.reportarErro({
          tipo: 'erro_evento_clique',
          mensagem: erro.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    document.addEventListener('keydown', (e) => {
      try {
        if (this.finalResults?.proposals?.length > 0) {
          if (e.key === 'ArrowRight') { 
            this.proximoVoo(); 
            e.preventDefault(); 
          } else if (e.key === 'ArrowLeft') { 
            this.vooAnterior(); 
            e.preventDefault(); 
          } else if (e.key === 'Enter') { 
            this.selecionarVooAtivo(); 
            e.preventDefault(); 
          }
        }
      } catch (erro) {
        console.error('Erro ao processar evento de teclado:', erro);
        this.reportarErro && this.reportarErro({
          tipo: 'erro_evento_teclado',
          mensagem: erro.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  },

  async carregarDestino() {
    try {
      let destinoString = localStorage.getItem('benetrip_destino_selecionado');
      if (!destinoString) {
        destinoString = localStorage.getItem('benetrip_destino_escolhido') || localStorage.getItem('benetrip_destino');
      }
      if (!destinoString) {
        // Se não encontrou no localStorage, tenta usar dados do usuário
        const dadosUsuario = this.carregarDadosUsuario && this.carregarDadosUsuario();
        if (dadosUsuario?.fluxo === 'destino_conhecido' && dadosUsuario?.respostas?.destino_conhecido) {
          this.destino = dadosUsuario.respostas.destino_conhecido;
          if (typeof this.destino === 'string') {
            const codigoExtraido = this.extrairCodigoIATA(this.destino);
            this.destino = { destino: this.destino, codigo_iata: codigoExtraido };
          } else if (!this.destino.codigo_iata) {
            this.destino.codigo_iata = this.extrairCodigoIATA(this.destino.destino || this.destino.nome);
          }
          if (!this.destino.codigo_iata) {
            throw new Error('Código IATA do destino não encontrado nos dados do usuário.');
          }
          console.log('Destino carregado dos dados do usuário:', this.destino);
          return true;
        }
        throw new Error('Nenhum destino selecionado');
      }
      this.destino = JSON.parse(destinoString);
      console.log('Destino carregado do localStorage:', this.destino);
      if (!this.destino.codigo_iata) {
        if (this.destino.aeroporto?.codigo) {
          this.destino.codigo_iata = this.destino.aeroporto.codigo;
        } else {
          const codigoExtraido = this.extrairCodigoIATA(this.destino.destino || this.destino.nome);
          if (codigoExtraido) {
            this.destino.codigo_iata = codigoExtraido;
            console.log(`Código IATA extraído: ${codigoExtraido}`);
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
    const match = texto.match(/\(([A-Z]{3})\)/);
    if (match && match[1]) return match[1];
    const textoLower = texto.toLowerCase();
    for (const [cidade, codigo] of Object.entries(this.IATA_MAP)) {
      if (textoLower.includes(cidade)) return codigo;
    }
    return null;
  },

  async iniciarBuscaVoos() {
    try {
      if (!this.destino || !this.destino.codigo_iata) {
        throw new Error('Dados do destino incompletos.');
      }
      const dadosUsuario = this.carregarDadosUsuario && this.carregarDadosUsuario();
      const datas = dadosUsuario?.respostas?.datas;
      if (!datas || !datas.dataIda) {
        throw new Error('Datas de viagem não disponíveis.');
      }
      const origemIATA = this.obterCodigoIATAOrigem && this.obterCodigoIATAOrigem(dadosUsuario);
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
      const validacao = this.validarDadosParaBusca && this.validarDadosParaBusca(params);
      if (!validacao.valido) {
        throw new Error(`Dados inválidos: ${validacao.mensagens.join(", ")}`);
      }
      console.log('Iniciando busca com parâmetros:', params);
      this.resetState();
      this.estaCarregando = true;
      this.atualizarProgresso('Iniciando busca de voos...', 10);
      this.renderizarInterface();
      this.timeoutId = setTimeout(() => {
        if (this.estaCarregando) {
          this.pararPolling();
          this.mostrarErro && this.mostrarErro('A busca demorou mais que o esperado.');
        }
      }, this.TIMEOUT_MS);
      const resposta = await fetch('/api/flight-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const dados = await resposta.json().catch(async () => {
        const textError = await resposta.text();
        throw new Error(`Resposta não JSON do servidor (${resposta.status}): ${textError.substring(0,150)}`);
      });
      if (!resposta.ok || (resposta.status === 202 && !dados.search_id)) {
        throw new Error(dados.error || dados.details?.error || dados.message || `Erro ${resposta.status} ao iniciar busca.`);
      }
      console.log('Busca iniciada. Search ID:', dados.search_id);
      this.searchId = dados.search_id;
      this.currencyRates = dados.currency_rates;
      this.atualizarProgresso('Busca iniciada. Aguardando primeiros resultados...', 15);
      this.initialWaitTimeoutId = setTimeout(() => {
        console.log('Tempo de espera inicial concluído. Iniciando polling...');
        this.iniciarPollingFrontend();
      }, this.INITIAL_WAIT_MS);
    } catch (erro) {
      console.error('Erro ao iniciar busca de voos:', erro);
      this.mostrarErro && this.mostrarErro(erro.message);
    }
  },

  validarDadosParaBusca(params) {
    const mensagensErro = [];
    if (!params.origem) mensagensErro.push("Origem não especificada");
    if (!params.destino) mensagensErro.push("Destino não especificado");
    if (!params.dataIda) mensagensErro.push("Data de ida não especificada");
    const regexIATA = /^[A-Z]{3}$/;
    const regexData = /^\d{4}-\d{2}-\d{2}$/;
    if (params.origem && !regexIATA.test(params.origem)) mensagensErro.push("Formato de origem inválido");
    if (params.destino && !regexIATA.test(params.destino)) mensagensErro.push("Formato de destino inválido");
    if (params.dataIda && !regexData.test(params.dataIda)) mensagensErro.push("Formato de data de ida inválido");
    if (params.dataVolta && !regexData.test(params.dataVolta)) mensagensErro.push("Formato de data de volta inválido");
    if (!params.adultos || params.adultos < 1) mensagensErro.push("Número de adultos deve ser pelo menos 1");
    return { 
      valido: mensagensErro.length === 0, 
      mensagens: mensagensErro 
    };
  },

  iniciarPollingFrontend() {
    console.log(`Iniciando polling para searchId: ${this.searchId}`);
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
    if (this.initialWaitTimeoutId) { 
      clearTimeout(this.initialWaitTimeoutId); 
      this.initialWaitTimeoutId = null; 
    }
    this.isPolling = true;
    this.pollingAttempts = 0;
    this.atualizarProgresso('Procurando as melhores conexões...', 20);
    this.pollingIntervalId = setInterval(() => this.verificarResultadosPolling(), this.POLLING_INTERVAL_MS);
    this.verificarResultadosPolling();
  },

  pararPolling() {
    console.log('Parando polling e timeouts.');
    if (this.pollingIntervalId) { 
      clearInterval(this.pollingIntervalId); 
      this.pollingIntervalId = null; 
    }
    if (this.initialWaitTimeoutId) { 
      clearTimeout(this.initialWaitTimeoutId); 
      this.initialWaitTimeoutId = null; 
    }
    if (this.timeoutId) { 
      clearTimeout(this.timeoutId); 
      this.timeoutId = null; 
    }
    this.isPolling = false;
  },

  async verificarResultadosPolling() {
    if (!this.isPolling) return;
    this.pollingAttempts++;
    console.log(`Polling Chunks: Tentativa ${this.pollingAttempts}/${this.MAX_POLLING_ATTEMPTS}`);
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
    if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS) {
      this.pararPolling();
      this.mostrarErro && this.mostrarErro('A busca demorou mais que o esperado.');
      return;
    }
    try {
      const resposta = await fetch(`/api/flight-results?uuid=${this.searchId}`);
      if (!resposta.ok) {
        const errorData = await resposta.json().catch(() => ({ error: `Erro ${resposta.status} (resposta não JSON)` }));
        const errorMessage = errorData.error || `Erro ${resposta.status}.`;
        console.error(`Erro no polling (HTTP ${resposta.status}):`, errorMessage, errorData);
        if (resposta.status === 404) { 
          this.pararPolling(); 
          this.mostrarErro && this.mostrarErro('Busca expirou/inválida.'); 
        } else if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS - 5) { 
          this.pararPolling(); 
          this.mostrarErro && this.mostrarErro(errorMessage); 
        }
        return;
      }
      const chunkData = await resposta.json();
      console.log(`Chunk recebido (Tentativa ${this.pollingAttempts}):`, this.formatarLogChunk(chunkData));
      let proposalsTotal = 0;
      let proposalsEmTodosItens = [];
      if (Array.isArray(chunkData)) {
        console.log(`Analisando array de ${chunkData.length} itens para buscar propostas:`);
        chunkData.forEach((item, idx) => {
          if (item && typeof item === 'object') {
            const proposalsNoItem = Array.isArray(item.proposals) ? item.proposals.length : 0;
            const temSearchId = item.search_id === this.searchId;
            console.log(`Item ${idx}: search_id correto: ${temSearchId ? 'SIM' : 'NÃO'}, Propostas: ${proposalsNoItem}`);
            if (proposalsNoItem > 0) {
              proposalsEmTodosItens.push(...item.proposals);
              proposalsTotal += proposalsNoItem;
            }
            this.extrairDadosAuxiliares && this.extrairDadosAuxiliares(item);
          }
        });
        if (proposalsTotal > 0) {
          console.log(`!!! ENCONTRADAS ${proposalsTotal} propostas em TODOS os itens do array !!!`);
          this.accumulatedProposals.push(...proposalsEmTodosItens);
        }
      }
      let chunkObject = this.encontrarObjetoRelevante && this.encontrarObjetoRelevante(chunkData);
      if (chunkObject) {
        const proposalsInChunk = chunkObject.proposals;
        this.extrairDadosAuxiliares && this.extrairDadosAuxiliares(chunkObject);
        if (proposalsInChunk && Array.isArray(proposalsInChunk)) {
          if (proposalsInChunk.length > 0) {
            console.log(`Acumulando ${proposalsInChunk.length} propostas do objeto principal com search_id. Total acumulado: ${this.accumulatedProposals.length + proposalsInChunk.length}`);
            this.accumulatedProposals.push(...proposalsInChunk);
          } else if (proposalsInChunk.length === 0) {
            const ehFimDaBusca = 
              (this.pollingAttempts > 1 && (this.accumulatedProposals.length > 0 || this.pollingAttempts >= 5)) ||
              (this.pollingAttempts === 1 && proposalsTotal > 0);
            if (ehFimDaBusca) {
              console.log(`Polling concluído! (Array proposals vazio é realmente o fim na tentativa ${this.pollingAttempts})`);
              this.pararPolling();
              this.isPolling = false;
              this.estaCarregando = false;
              if (this.pollingIntervalId) {
                clearInterval(this.pollingIntervalId);
                this.pollingIntervalId = null;
              }
              this.atualizarProgresso('Finalizando...', 100);
              this.finalResults = this.montarResultadosFinais && this.montarResultadosFinais(chunkObject);
              this.finalResults.proposals = this.preprocessarPropostas && this.preprocessarPropostas(this.finalResults.proposals);
              if (this.finalResults.proposals.length > 0) {
                this.exibirToast && this.exibirToast(`${this.finalResults.proposals.length} voos encontrados! ✈️`, 'success');
                console.log("Resultados finais montados:", this.formatarLogResultados && this.formatarLogResultados(this.finalResults));
              } else {
                console.log('Busca concluída sem resultados acumulados.');
                this.exibirToast && this.exibirToast('Não encontramos voos disponíveis.', 'warning');
              }
              this.renderizarInterface();
            } else {
              console.log(`Array proposals vazio na tentativa ${this.pollingAttempts}, mas NÃO é o fim: continuando polling...`);
            }
          }
        } else {
          console.warn(`Chunk object encontrado, mas 'proposals' não é um array ou está ausente.`);
        }
      } else {
        console.log(`Nenhum objeto de dados principal encontrado na tentativa ${this.pollingAttempts}. Continuando polling...`);
      }
    } catch (erro) {
      console.error('Erro durante o polling ou processamento do chunk:', erro);
      if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS - 5) {
        this.pararPolling();
        this.mostrarErro && this.mostrarErro('Erro ao verificar resultados. Verifique sua conexão.');
      }
      this.reportarErro && this.reportarErro({
        tipo: 'erro_polling',
        mensagem: erro.message,
        tentativa: this.pollingAttempts,
        timestamp: new Date().toISOString()
      });
    }
  },

  formatarLogChunk(chunk) {
    if (!chunk) return null;
    if (Array.isArray(chunk)) {
      return `[Array com ${chunk.length} itens]`;
    }
    if (typeof chunk === 'object') {
      const { proposals, ...resto } = chunk;
      return {
        ...resto,
        proposals: proposals ? `[Array com ${proposals.length} propostas]` : null
      };
    }
    return chunk;
  },

  formatarLogResultados(resultados) {
    if (!resultados) return null;
    return {
      proposals: `[Array com ${resultados.proposals?.length || 0} propostas]`,
      airlines: Object.keys(resultados.airlines || {}).length + ' companhias',
      airports: Object.keys(resultados.airports || {}).length + ' aeroportos',
      search_id: resultados.search_id
    };
  },

  extrairDadosAuxiliares(item) {
    if (!item || typeof item !== 'object') return;
    if (item.airlines) Object.assign(this.accumulatedAirlines, item.airlines);
    if (item.airports) Object.assign(this.accumulatedAirports, item.airports);
    if (item.gates_info) Object.assign(this.accumulatedGatesInfo, item.gates_info);
    if (item.meta) this.accumulatedMeta = { ...this.accumulatedMeta, ...item.meta };
  },

  encontrarObjetoRelevante(chunkData) {
    if (!chunkData) return null;
    if (Array.isArray(chunkData)) {
      const objRelevante = chunkData.find(item => 
        item && typeof item === 'object' && item.search_id === this.searchId
      );
      if (!objRelevante) {
        console.warn(`Array recebido, mas nenhum objeto encontrado com search_id ${this.searchId}`);
      } else {
        console.log("Objeto principal do chunk encontrado dentro do array");
      }
      return objRelevante;
    } else if (chunkData && typeof chunkData === 'object') {
      if (chunkData.search_id === this.searchId) {
        console.log("Chunk recebido como objeto único");
        return chunkData;
      } else if (Object.keys(chunkData).length === 1 && chunkData.search_id) {
        console.log('Busca ainda em andamento (resposta apenas com search_id)...');
      } else {
        console.warn(`Objeto recebido, mas search_id (${chunkData.search_id}) não corresponde ao esperado (${this.searchId})`);
      }
    } else {
      console.warn("Chunk recebido com formato inesperado");
    }
    return null;
  },

  montarResultadosFinais(chunkObject) {
    return {
      proposals: this.accumulatedProposals,
      airlines: this.accumulatedAirlines,
      airports: this.accumulatedAirports,
      gates_info: this.accumulatedGatesInfo,
      meta: this.accumulatedMeta,
      search_id: this.searchId,
      segments: chunkObject.segments || [],
      market: chunkObject.market || ''
    };
  },

  preprocessarPropostas(propostas) {
    if (!propostas || !Array.isArray(propostas) || propostas.length === 0) return [];
    console.log(`Pré-processando ${propostas.length} propostas acumuladas...`);
    const propostasValidas = propostas.filter(p => p && typeof p === 'object');
    propostasValidas.sort((a, b) => this.obterPrecoVoo(a) - this.obterPrecoVoo(b));
    return propostasValidas.map((proposta, index) => {
      // Atribui propriedades adicionais para uso na interface
      proposta._melhorPreco = (index === 0);
      const precoAtual = this.obterPrecoVoo(proposta);
      const precoMedio = precoAtual * (1 + (Math.random() * 0.25));
      proposta._economia = Math.max(0, Math.round(((precoMedio - precoAtual) / precoMedio) * 100));
      // Simula assentos disponíveis
      proposta._assentosDisponiveis = Math.floor(Math.random() * 8) + 1;
      return proposta;
    });
  },

  atualizarProgresso(mensagem, porcentagem) {
    requestAnimationFrame(() => {
      const bar = document.querySelector('.progress-bar');
      const text = document.querySelector('.loading-text');
      if (bar) { 
        bar.style.width = `${porcentagem}%`; 
        bar.setAttribute('aria-valuenow', porcentagem); 
      }
      if (text) { 
        text.textContent = mensagem; 
      }
    });
  },

  // === MODIFICAÇÕES SOLICITADAS ===

  // 1. Substituição completa da função renderizarInterface()
  renderizarInterface: function() {
    try {
      const container = document.getElementById('voos-container');
      if (!container) {
        console.error('Container não encontrado');
        return;
      }
      // Preserva o header se existir
      const headerExistente = container.querySelector('.app-header');
      if (!headerExistente) {
        this.renderizarHeader(container);
      }
      // Limpa o conteúdo principal, mas mantém o header
      const mainContent = container.querySelector('.voos-content');
      if (mainContent) {
        mainContent.innerHTML = '';
      } else {
        const newMainContent = document.createElement('main');
        newMainContent.className = 'voos-content';
        container.appendChild(newMainContent);
      }
      // Decide qual estado renderizar no mainContent
      const contentContainer = container.querySelector('.voos-content');
      if (this.estaCarregando) {
        this.renderizarCarregamento(contentContainer);
      } else if (this.temErro) {
        this.renderizarErro(contentContainer);
      } else if (!this.finalResults || !this.finalResults.proposals || this.finalResults.proposals.length === 0) {
        this.renderizarSemResultados(contentContainer);
      } else {
        this.renderizarResultados(contentContainer);
      }
    } catch (erro) {
      console.error('Erro ao renderizar interface:', erro);
      const container = document.getElementById('voos-container');
      if (container) {
        const mainContent = container.querySelector('.voos-content') || document.createElement('main');
        mainContent.className = 'voos-content';
        if (!container.contains(mainContent)) {
          container.appendChild(mainContent);
        }
        mainContent.innerHTML = '';
        this.mensagemErro = 'Ocorreu um erro ao exibir os voos.';
        this.renderizarErro(mainContent);
      }
      this.reportarErro && this.reportarErro({
        tipo: 'erro_renderizacao_interface',
        mensagem: erro.message,
        timestamp: new Date().toISOString()
      });
    }
  },

  // 2. Adição da nova função renderizarTripinhaMessage()
  renderizarTripinhaMessage: function(container) {
    let tripinhaMessage = container.querySelector('.tripinha-message');
    if (!tripinhaMessage) {
      tripinhaMessage = document.createElement('div');
      tripinhaMessage.className = 'tripinha-message';
      tripinhaMessage.innerHTML = `
        <div class="tripinha-avatar">
          <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha">
        </div>
        <div class="tripinha-bubble">
          <p>Eu farejei por aí e encontrei alguns voos incríveis para sua aventura! 🐾
            Deslize para ver todas as opções e escolha a que melhor se encaixa no seu plano!</p>
        </div>
      `;
      container.appendChild(tripinhaMessage);
    }
    const numVoos = this.finalResults.proposals.length;
    const textoBubble = tripinhaMessage.querySelector('.tripinha-bubble');
    if (textoBubble) {
      if (numVoos > 0) {
        textoBubble.innerHTML = `<p>Encontrei ${numVoos} voos para seu destino! 🐾
                                Deslize para ver todas as opções e escolha a que melhor se encaixa no seu plano!</p>`;
      } else {
        textoBubble.innerHTML = `<p>Busquei em todos os cantos, mas não encontrei voos disponíveis para seu destino.
                                Tente outras datas ou destinos! 🐾</p>`;
      }
    }
  },

  // 3. Substituição completa da função renderizarResultados()
  renderizarResultados: function(container) {
    // Renderiza a mensagem da Tripinha
    this.renderizarTripinhaMessage(container);
    // Renderiza o resumo da viagem/busca
    this.renderizarResumoViagem(container);
    // Resumo de quantidade de voos
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
    // Renderiza cards usando o novo formato
    this.renderizarCards(voosContainer);
    // Adiciona indicadores de paginação
    this.renderizarPaginacao(container);
    // Adiciona controles de navegação
    this.renderizarControlesNavegacao(container);
    // Renderizar botão de seleção fixo
    this.renderizarBotaoSelecao(document.getElementById('voos-container'));
    // Configura navegação após renderização (se a função estiver definida)
    this.configurarEventosAposRenderizacao && this.configurarEventosAposRenderizacao();
  },

  // 4. Adição da nova função renderizarCards()
  renderizarCards: function(container) {
    const propostas = this.finalResults.proposals || [];
    // Carregamento otimizado de voos - apenas os primeiros 20 inicialmente
    const initialVoos = propostas.slice(0, Math.min(20, propostas.length));
    // Usa DocumentFragment para melhorar performance
    const fragment = document.createDocumentFragment();
    initialVoos.forEach((voo, index) => {
      const cardVoo = this.criarCardVooAprimorado(voo, index);
      fragment.appendChild(cardVoo);
    });
    container.appendChild(fragment);
  },

  // 5. Adição da nova função criarCardVooAprimorado()
  criarCardVooAprimorado: function(voo, index) {
    const cardVoo = document.createElement('div');
    cardVoo.className = 'voo-card';
    // Define atributos de dados
    const vooId = voo.sign || `voo-idx-${index}`;
    cardVoo.dataset.vooId = vooId;
    cardVoo.dataset.vooIndex = index;
    // Aplica classes especiais
    if (index === 0) cardVoo.classList.add('voo-primeiro');
    if (index % 2 === 0) cardVoo.classList.add('voo-par');
    // Extrai informações do voo
    const preco = this.obterPrecoVoo(voo);
    const moeda = this.finalResults?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    const infoIda = this.obterInfoSegmento(voo.segment?.[0]);
    const infoVolta = voo.segment?.length > 1 ? this.obterInfoSegmento(voo.segment[1]) : null;
    const economiaPercentual = voo._economia || 0;
    const isMelhorPreco = voo._melhorPreco || index === 0;
    const ehVooDireto = infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0);
    // Aplica classes adicionais para estados especiais
    if (ehVooDireto) cardVoo.classList.add('voo-direto');
    if (isMelhorPreco) cardVoo.classList.add('voo-melhor-preco');
    // Constrói o HTML interno usando o novo design
    cardVoo.innerHTML = `
      ${isMelhorPreco ? '<div class="card-tag melhor-preco">Melhor preço</div>' : ''}
      ${ehVooDireto ? '<div class="card-tag voo-direto">Voo Direto</div>' : ''}
      <div class="voo-card-header">
        <div class="voo-price">
          ${precoFormatado}
          ${economiaPercentual > 0 ? `<span class="discount-badge">-${economiaPercentual}%</span>` : ''}
        </div>
        <div class="voo-price-details">Por pessoa, ida${infoVolta ? ' e volta' : ''}</div>
        <div class="airline-info">${this.obterCompanhiasAereas(voo)}</div>
      </div>
      <div class="voo-card-content">
        <!-- Rota de ida -->
        <div class="flight-route">
          <div class="route-point">
            <div class="route-time">${infoIda?.horaPartida || '--:--'}</div>
            <div class="route-airport">${infoIda?.aeroportoPartida || '---'}</div>
          </div>
          <div class="route-line">
            <div class="route-duration">${this.formatarDuracao(infoIda?.duracao || 0)}</div>
            <div class="route-line-bar ${ehVooDireto ? 'route-line-direct' : ''}">
              <span class="stop-marker start"></span>
              ${!ehVooDireto ? '<span class="stop-marker mid"></span>' : ''}
              <span class="stop-marker end"></span>
            </div>
            <div class="route-stops ${ehVooDireto ? 'route-stops-direct' : ''}">
              ${ehVooDireto ? 'Voo Direto' : `${infoIda?.paradas || 0} ${infoIda?.paradas === 1 ? 'parada' : 'paradas'}`}
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
            <div class="route-duration">${this.formatarDuracao(infoVolta.duracao || 0)}</div>
            <div class="route-line-bar ${infoVolta.paradas === 0 ? 'route-line-direct' : ''}">
              <span class="stop-marker start"></span>
              ${infoVolta.paradas > 0 ? '<span class="stop-marker mid"></span>' : ''}
              <span class="stop-marker end"></span>
            </div>
            <div class="route-stops ${infoVolta.paradas === 0 ? 'route-stops-direct' : ''}">
              ${infoVolta.paradas === 0 ? 'Voo Direto' : `${infoVolta.paradas} ${infoVolta.paradas === 1 ? 'parada' : 'paradas'}`}
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

  // 6. Adição das funções de paginação e navegação
  renderizarPaginacao: function(container) {
    const paginationIndicator = document.createElement('div');
    paginationIndicator.className = 'pagination-indicator';
    const numVoos = this.finalResults.proposals.length;
    const maxDots = Math.min(numVoos, 10);
    for (let i = 0; i < maxDots; i++) {
      const dot = document.createElement('div');
      dot.className = 'pagination-dot';
      if (i === 0) {
        dot.classList.add('active');
      }
      dot.dataset.index = i;
      paginationIndicator.appendChild(dot);
    }
    container.appendChild(paginationIndicator);
  },

  renderizarControlesNavegacao: function(container) {
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
  },

  // 7. Substituição completa da função renderizarBotaoSelecao()
  renderizarBotaoSelecao: function(container) {
    // Remove botão existente para evitar duplicatas
    const btnExistente = container.querySelector('.botao-selecao-fixo');
    if (btnExistente) btnExistente.remove();
    const botaoFixo = document.createElement('div');
    botaoFixo.className = 'botao-selecao-fixo';
    let precoTexto = 'Escolher Este Voo';
    if (this.vooAtivo) {
      const preco = this.obterPrecoVoo(this.vooAtivo);
      const moeda = this.finalResults?.meta?.currency || 'BRL';
      precoTexto = `Escolher Voo por ${this.formatarPreco(preco, moeda)}`;
    }
    botaoFixo.innerHTML = `
      <button class="btn-selecionar-voo">
        <span>${precoTexto}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"></path>
        </svg>
      </button>
    `;
    container.appendChild(botaoFixo);
  },

  // 8. Substituição completa da função renderizarCarregamento()
  renderizarCarregamento: function(container) {
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
    this.atualizarProgresso(
      document.querySelector('.loading-text')?.textContent || 'Buscando...',
      parseFloat(document.querySelector('.progress-bar')?.style.width || '10')
    );
    const dicas = [
      '💡 Dica: Preços mudam, reserve logo!',
      '🔍 Dica: Voos diretos aparecem destacados',
      '💳 Dica: Parcelar sua compra pode sair mais em conta',
      '⏱️ Dica: Muitas vezes voos de madrugada são mais baratos',
      '🎒 Dica: Verifique a franquia de bagagem incluída'
    ];
    let dicaIndex = 0;
    const dicasEl = loading.querySelector('.loading-tips');
    if (dicasEl) {
      const dicasInterval = setInterval(() => {
        dicaIndex = (dicaIndex + 1) % dicas.length;
        dicasEl.innerHTML = `<p>${dicas[dicaIndex]}</p>`;
      }, 5000);
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.removedNodes) {
            mutation.removedNodes.forEach((node) => {
              if (node === loading || node.contains(loading)) {
                clearInterval(dicasInterval);
                observer.disconnect();
              }
            });
          }
        });
      });
      observer.observe(container, { childList: true, subtree: true });
    }
  },

  // 9. Substituição completa da função renderizarErro()
  renderizarErro: function(container) {
    const loading = container.querySelector('.loading-container');
    if (loading) loading.remove();
    const erroDiv = document.createElement('div');
    erroDiv.className = 'erro-container';
    erroDiv.innerHTML = `
      <div class="error-message-box">
        <div class="error-image">
          <img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="tripinha-error-avatar">
        </div>
        <h3 class="error-title">${this.mensagemErro || 'Ocorreu um erro.'}</h3>
        <p class="error-description">Desculpe pelo inconveniente. Podemos tentar novamente?</p>
        <button class="btn-tentar-novamente">
          Tentar Novamente
        </button>
      </div>
    `;
    container.appendChild(erroDiv);
  },

  // 10. Substituição completa da função renderizarSemResultados()
  renderizarSemResultados: function(container) {
    const loading = container.querySelector('.loading-container');
    if (loading) loading.remove();
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

  // === Funções originais mantidas ===

  renderizarHeader: function(container) {
    if (container.querySelector('.app-header')) return;
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
      <button class="btn-voltar" aria-label="Voltar">
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"></path>
        </svg>
        <span class="sr-only">Voltar</span>
      </button>
      <h1>Voos Disponíveis</h1>
    `;
    container.insertBefore(header, container.firstChild);
    const btnVoltar = header.querySelector('.btn-voltar');
    if (btnVoltar) {
      btnVoltar.addEventListener('click', () => {
        if (this.finalResults?.proposals?.length > 0 && !this.estaCarregando) {
          if (confirm('Tem certeza? Você perderá os resultados.')) {
            window.location.href = 'destinos.html';
          }
        } else { 
          window.location.href = 'destinos.html';
        }
      });
    }
  },

  renderizarResumoViagem: function(container) {
    const resumo = document.createElement('div');
    resumo.className = 'viagem-resumo p-4 bg-white border-b';
    const destino = this.destino;
    const dataViagem = this.obterDatasViagem && this.obterDatasViagem();
    const passageiros = this.obterQuantidadePassageiros && this.obterQuantidadePassageiros();
    resumo.innerHTML = `
      <h2 class="text-lg font-bold mb-2">Sua Viagem</h2>
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="bg-blue-50 p-1 rounded mr-2">
            <span class="text-lg">✈️</span>
          </div>
          <div>
            <p class="font-medium">${destino?.destino || ''}, ${destino?.pais || ''}</p>
            <p class="text-sm text-gray-600">${dataViagem}</p>
          </div>
        </div>
        <div class="text-sm text-right">
          <span class="bg-gray-100 px-2 py-1 rounded">${passageiros} pas.</span>
        </div>
      </div>
    `;
    container.appendChild(resumo);
  },

  renderizarListaVoos: function(container) {
    const listaVoos = document.createElement('div');
    listaVoos.className = 'voos-lista';
    listaVoos.id = 'voos-lista';
    const voos = this.finalResults?.proposals || [];
    // Header com contador de resultados
    const header = document.createElement('div');
    header.className = 'voos-header p-3 bg-gray-50 border-b';
    header.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="flex items-center">
          <h3 class="font-medium">
            <span class="text-primary font-bold" style="color:#E87722">${voos.length}</span> 
            ${voos.length === 1 ? 'voo encontrado' : 'voos encontrados'}
          </h3>
          ${voos.length > 10 ? 
            `<span class="ml-2 text-xs text-gray-500">(mostrando os melhores preços)</span>` : 
            ''}
        </div>
        <div class="flex items-center">
          <span class="text-sm text-gray-600 mr-2">Por preço</span>
          <span class="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">↑ Baratos</span>
        </div>
      </div>
    `;
    listaVoos.appendChild(header);
    // Seletor de visualização
    const viewSelector = document.createElement('div');
    viewSelector.className = 'view-selector p-2 border-b flex justify-between items-center';
    viewSelector.innerHTML = `
      <div class="flex space-x-2">
        <button class="view-btn view-btn-active px-2 py-1 rounded text-sm" data-view="cards">
          <span class="icon">🗂️</span> Cards
        </button>
        <button class="view-btn px-2 py-1 rounded text-sm" data-view="list">
          <span class="icon">📋</span> Lista
        </button>
      </div>
      <div class="text-xs text-gray-500">
        <span class="swipe-instruction flex items-center">
          <span class="mr-1">←</span> Deslize para navegar <span class="ml-1">→</span>
        </span>
      </div>
    `;
    listaVoos.appendChild(viewSelector);
    // Informações de paginação
    const paginationInfo = document.createElement('div');
    paginationInfo.className = 'pagination-info text-center text-sm py-1 sticky top-0 bg-white bg-opacity-80 z-10 border-b';
    paginationInfo.innerHTML = `
      <span class="current-index font-bold">1</span> de 
      <span class="total-count">${voos.length}</span>
    `;
    listaVoos.appendChild(paginationInfo);
    // Container para os cards (swipe)
    const voosContainer = document.createElement('div');
    voosContainer.className = 'voos-swipe-container';
    voosContainer.id = 'voos-swipe-container';
    listaVoos.appendChild(voosContainer);
    // Carrega os primeiros 20 voos
    const initialVoos = voos.slice(0, Math.min(20, voos.length));
    const fragment = document.createDocumentFragment();
    initialVoos.forEach((voo, index) => {
      const cardVoo = this.criarCardVoo(voo, index);
      fragment.appendChild(cardVoo);
    });
    voosContainer.appendChild(fragment);
    // Controles de navegação visual
    const navControls = document.createElement('div');
    navControls.className = 'nav-controls flex justify-between items-center p-2 sticky bottom-0 bg-white bg-opacity-90 border-t z-10';
    navControls.innerHTML = `
      <button class="nav-btn prev-btn px-3 py-1 bg-gray-100 rounded-full mr-2 flex items-center" aria-label="Voo anterior">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"></path>
        </svg>
        <span class="ml-1">Anterior</span>
      </button>
      <div class="pagination-dots flex space-x-1 justify-center">
        ${initialVoos.length <= 10 ? 
          Array(initialVoos.length).fill().map((_, i) => 
            `<span class="pagination-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`
          ).join('') : 
          '<span class="text-xs">Navegue pelos melhores preços</span>'
        }
      </div>
      <button class="nav-btn next-btn px-3 py-1 bg-gray-100 rounded-full ml-2 flex items-center" aria-label="Próximo voo">
        <span class="mr-1">Próximo</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"></path>
        </svg>
      </button>
    `;
    listaVoos.appendChild(navControls);
    // Botão para carregar mais resultados, se necessário
    if (voos.length > 20) {
      const loadMoreWrapper = document.createElement('div');
      loadMoreWrapper.className = 'load-more-wrapper p-3 text-center';
      loadMoreWrapper.innerHTML = `
        <button class="load-more-btn px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
          Carregar mais resultados (${voos.length - initialVoos.length} restantes)
        </button>
      `;
      listaVoos.appendChild(loadMoreWrapper);
    }
    container.appendChild(listaVoos);
  },

  criarCardVoo: function(voo, index) {
    // Versão otimizada da criação de cards (versão antiga mantida)
    const cardVoo = document.createElement('div');
    cardVoo.className = 'voo-card p-3 bg-white border-b';
    const vooId = voo.sign || `voo-idx-${index}`;
    cardVoo.dataset.vooId = vooId;
    cardVoo.dataset.vooIndex = index;
    if (index === 0) cardVoo.classList.add('voo-primeiro');
    if (index % 2 === 0) cardVoo.classList.add('voo-par');
    const preco = this.obterPrecoVoo(voo);
    const moeda = this.finalResults?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    const infoIda = this.obterInfoSegmento(voo.segment?.[0]);
    const infoVolta = voo.segment?.length > 1 ? this.obterInfoSegmento(voo.segment[1]) : null;
    const economiaPercentual = voo._economia || 0;
    const isMelhorPreco = voo._melhorPreco || index === 0;
    const ehVooDireto = infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0);
    if (ehVooDireto) cardVoo.classList.add('voo-direto');
    if (isMelhorPreco) cardVoo.classList.add('voo-melhor-preco');
    let tagsSpeciais = '';
    if (isMelhorPreco) {
      tagsSpeciais += `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full absolute top-2 right-2 shadow-sm">Melhor preço</span>`;
    }
    if (ehVooDireto) {
      tagsSpeciais += `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full absolute top-2 left-2 shadow-sm">Voo Direto</span>`;
    }
    const indexDisplay = `<div class="card-index absolute top-0 left-0 w-6 h-6 flex items-center justify-center bg-gray-100 rounded-br-lg text-xs font-bold">${index + 1}</div>`;
    cardVoo.innerHTML = `
      <div class="relative">
        ${indexDisplay}
        ${tagsSpeciais}
        <div class="flex justify-between items-start mb-3 mt-2"> 
          <div> 
            <span class="text-xl font-bold" style="color: #E87722;">${precoFormatado}</span>
            ${economiaPercentual > 0 ? `<span class="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded ml-1 font-medium">-${economiaPercentual}%</span>` : ''} 
            <p class="text-xs text-gray-500">Por pessoa, ida${infoVolta ? ' e volta' : ''}</p> 
          </div> 
          <div class="text-right"> 
            <span class="text-xs bg-gray-100 px-2 py-1 rounded font-medium">${this.obterCompanhiasAereas(voo)}</span> 
          </div> 
        </div>
      </div>
      <div class="pt-2 border-t"> 
        <div class="mb-3"> 
          <div class="flex justify-between text-sm">
            <div class="text-center">
              <p class="font-bold">${infoIda?.horaPartida || '--:--'}</p>
              <p class="text-xs text-gray-600">${infoIda?.aeroportoPartida || '---'}</p>
            </div> 
            <div class="flex-1 px-2"> 
              <div class="text-xs text-center text-gray-500">${this.formatarDuracao(infoIda?.duracao || 0)}</div> 
              <div class="flight-line relative">
                <div class="border-t ${ehVooDireto ? 'border-blue-300' : 'border-gray-300'} my-2"></div>
                <div class="flight-stops absolute inset-x-0 top-1/2 flex justify-center -mt-1">
                  ${this.renderizarParadas(infoIda?.paradas || 0)}
                </div>
              </div> 
              <div class="text-xs text-center text-gray-500">
                ${ehVooDireto ? '<span class="text-blue-600 font-medium">Voo Direto</span>' : `${infoIda?.paradas || 0} ${infoIda?.paradas === 1 ? 'parada' : 'paradas'}`}
              </div> 
            </div> 
            <div class="text-center">
              <p class="font-bold">${infoIda?.horaChegada || '--:--'}</p>
              <p class="text-xs text-gray-600">${infoIda?.aeroportoChegada || '---'}</p>
            </div> 
          </div> 
        </div>
        ${infoVolta ? `
        <div class="mt-3 pt-2 border-t"> 
          <div class="flex justify-between text-sm">
            <div class="text-center">
              <p class="font-bold">${infoVolta.horaPartida || '--:--'}</p>
              <p class="text-xs text-gray-600">${infoVolta.aeroportoPartida || '---'}</p>
            </div> 
            <div class="flex-1 px-2"> 
              <div class="text-xs text-center text-gray-500">${this.formatarDuracao(infoVolta.duracao || 0)}</div> 
              <div class="flight-line relative">
                <div class="border-t ${(!infoVolta || infoVolta.paradas === 0) ? 'border-blue-300' : 'border-gray-300'} my-2"></div>
                <div class="flight-stops absolute inset-x-0 top-1/2 flex justify-center -mt-1">
                  ${this.renderizarParadas(infoVolta?.paradas || 0)}
                </div>
              </div> 
              <div class="text-xs text-center text-gray-500">
                ${(!infoVolta || infoVolta.paradas === 0) ? '<span class="text-blue-600 font-medium">Voo Direto</span>' : `${infoVolta?.paradas || 0} ${infoVolta?.paradas === 1 ? 'parada' : 'paradas'}`}
              </div> 
            </div> 
            <div class="text-center">
              <p class="font-bold">${infoVolta.horaChegada || '--:--'}</p>
              <p class="text-xs text-gray-600">${infoVolta.aeroportoChegada || '---'}</p>
            </div> 
          </div> 
        </div>` : ''} 
      </div>
      <div class="mt-3 pt-2 border-t flex justify-between items-center"> 
        <button class="btn-detalhes-voo text-sm text-blue-600 hover:text-blue-800" data-voo-id="${vooId}">
          Ver detalhes
        </button> 
        <div class="flex items-center text-xs text-gray-500">
          <span class="mr-1">Restam</span>
          <span class="bg-orange-100 text-orange-800 px-2 py-1 rounded font-medium">${voo._assentosDisponiveis || '?'}</span>
        </div>
        <button class="btn-select-voo text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded" data-voo-id="${vooId}">
          Selecionar
        </button>
      </div>
    `;
    return cardVoo;
  },

  renderizarParadas: function(paradas) {
    const numParadas = paradas || 0;
    if (numParadas === 0) {
      return `<span class="inline-block w-3 h-3 bg-green-500 rounded-full" title="Voo direto"></span>`;
    }
    let html = ''; 
    for (let i = 0; i < Math.min(numParadas, 3); i++) {
      html += `<span class="inline-block w-2 h-2 bg-gray-400 rounded-full mx-1" title="${numParadas} parada${numParadas > 1 ? 's' : ''}"></span>`;
    }
    return html;
  },

  renderizarSwipeHint: function(container) {
    const hint = document.createElement('div');
    hint.id = 'swipe-hint';
    hint.className = 'swipe-hint';
    hint.style.display = 'none';
    hint.innerHTML = `
      <span class="swipe-hint-arrow mr-2">←</span> 
      Arraste para ver outros voos 
      <span class="swipe-hint-arrow ml-2">→</span>
    `;
    container.appendChild(hint);
    if (this.finalResults?.proposals?.length > 1) {
      hint.style.display = 'flex';
      setTimeout(() => { 
        hint.style.opacity = '0'; 
        setTimeout(() => { 
          hint.style.display = 'none'; 
        }, 1000); 
      }, 4000);
    }
  },

  formatarPreco: function(preco, moeda = 'BRL') {
    if (typeof preco !== 'number' || isNaN(preco)) return 'N/A';
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: moeda, 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(preco);
  },

  formatarData: function(data) {
    if (!(data instanceof Date) || isNaN(data.getTime())) return 'N/A';
    const d = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${d[data.getDay()]}, ${data.getDate()} ${m[data.getMonth()]}`;
  },

  formatarDuracao: function(duracaoMinutos) {
    if (typeof duracaoMinutos !== 'number' || duracaoMinutos < 0) return 'N/A';
    const h = Math.floor(duracaoMinutos / 60), m = duracaoMinutos % 60;
    return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
  },

  obterPrecoVoo: function(voo) {
    if (!voo || !voo.terms) return 0;
    try {
      const k = Object.keys(voo.terms)[0];
      return voo.terms[k]?.unified_price || voo.terms[k]?.price || 0;
    } catch (erro) {
      console.warn('Erro ao obter preço do voo:', erro);
      return 0;
    }
  },

  obterCompanhiasAereas: function(voo) {
    try {
      const codigos = voo?.carriers;
      if (!codigos || codigos.length === 0) return 'N/A';
      if (this.accumulatedAirlines && this.accumulatedAirlines[codigos[0]]) {
        const info = this.accumulatedAirlines[codigos[0]];
        if (codigos.length > 1) {
          return `${info?.name || codigos[0]} +${codigos.length - 1}`;
        }
        return info?.name || codigos[0];
      }
      if (codigos.length > 1) {
        return `${codigos[0]} +${codigos.length - 1}`;
      }
      return codigos[0];
    } catch (erro) {
      console.warn('Erro ao obter companhias aéreas:', erro);
      return 'N/A';
    }
  },

  obterInfoSegmento: function(segmento) {
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
      const tsP = pV.local_departure_timestamp * 1000, tsC = uV.local_arrival_timestamp * 1000;
      if (isNaN(tsP) || isNaN(tsC)) return def;
      const dP = new Date(tsP), dC = new Date(tsC);
      return {
        aeroportoPartida: pV.departure,
        aeroportoChegada: uV.arrival,
        dataPartida: dP,
        dataChegada: dC,
        horaPartida: dP.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        horaChegada: dC.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        duracao: Math.round((tsC - tsP) / 60000),
        paradas: segmento.flight.length - 1
      };
    } catch (erro) {
      console.warn('Erro ao obter informações do segmento:', erro);
      return def;
    }
  },

  proximoVoo: function() {
    if (!this.finalResults?.proposals?.length || this.finalResults.proposals.length <= 1) return;
    this.indexVooAtivo = (this.indexVooAtivo + 1) % this.finalResults.proposals.length;
    this.vooAtivo = this.finalResults.proposals[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },

  vooAnterior: function() {
    if (!this.finalResults?.proposals?.length || this.finalResults.proposals.length <= 1) return;
    this.indexVooAtivo = (this.indexVooAtivo - 1 + this.finalResults.proposals.length) % this.finalResults.proposals.length;
    this.vooAtivo = this.finalResults.proposals[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },

  atualizarVooAtivo: function() {
    const cardAtual = document.querySelector('.voo-card-ativo');
    const cardAtivo = document.querySelector(`.voo-card[data-voo-index="${this.indexVooAtivo}"]`);
    const btnSelecionar = document.querySelector('.btn-selecionar-voo');
    const currentIndexElement = document.querySelector('.current-index');
    const dots = document.querySelectorAll('.pagination-dot');
    const preco = this.vooAtivo ? this.obterPrecoVoo(this.vooAtivo) : 0;
    const moeda = this.finalResults?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    requestAnimationFrame(() => {
      if (cardAtual) cardAtual.classList.remove('voo-card-ativo');
      if (cardAtivo) {
        cardAtivo.classList.add('voo-card-ativo');
        cardAtivo.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest', 
          inline: 'center' 
        });
        cardAtivo.classList.add('voo-card-highlight');
        setTimeout(() => cardAtivo.classList.remove('voo-card-highlight'), 500);
      }
      if (btnSelecionar && this.vooAtivo) {
        btnSelecionar.innerHTML = `
          <span>Escolher Voo por ${precoFormatado}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"></path>
          </svg>
        `;
      } else if (btnSelecionar) {
        btnSelecionar.innerHTML = `
          <span>Escolher Este Voo</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"></path>
          </svg>
        `;
      }
      if (currentIndexElement) {
        currentIndexElement.textContent = (this.indexVooAtivo + 1).toString();
      }
      dots.forEach((dot) => {
        const dotIndex = parseInt(dot.dataset.index || '0');
        if (dotIndex === this.indexVooAtivo) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    });
  },

  selecionarVoo: function(vooId) {
    if (!this.finalResults?.proposals) return;
    const vooEncontrado = this.finalResults.proposals.find(
      (v, index) => (v.sign || `voo-idx-${index}`) === vooId
    );
    if (!vooEncontrado) {
      console.error(`Voo ${vooId} não encontrado`);
      return;
    }
    this.vooSelecionado = vooEncontrado;
    console.log('Voo selecionado:', this.vooSelecionado);
    const index = this.finalResults.proposals.findIndex(
      (v, idx) => (v.sign || `voo-idx-${idx}`) === vooId
    );
    if (index !== -1) {
      this.vooAtivo = vooEncontrado;
      this.indexVooAtivo = index;
    }
    document.querySelectorAll('.voo-card').forEach(card => {
      card.classList.remove('voo-selecionado');
      if (card.dataset.vooId === vooId) {
        card.classList.add('voo-selecionado');
      }
    });
    this.exibirToast && this.exibirToast('Voo selecionado! Confirme sua escolha', 'success');
    const btnConfirmar = document.querySelector('.btn-selecionar-voo');
    if (btnConfirmar) {
      btnConfirmar.classList.add('btn-pulsante');
      const preco = this.obterPrecoVoo(this.vooSelecionado);
      const moeda = this.finalResults?.meta?.currency || 'BRL';
      btnConfirmar.innerHTML = `
        <span>Escolher Voo por ${this.formatarPreco(preco, moeda)}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"></path>
        </svg>
      `;
      setTimeout(() => btnConfirmar.classList.remove('btn-pulsante'), 2000);
    }
  },

  exibirToast: function(mensagem, tipo = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = mensagem;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => {
      setTimeout(() => toast.classList.add('toast-visible'), 10);
    });
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => {
        if (toastContainer.contains(toast)) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    }, 3000);
  },

  selecionarVooAtivo: function() {
    if (!this.vooAtivo) {
      console.error('Nenhum voo ativo');
      return;
    }
    const vooId = this.vooAtivo.sign || `voo-idx-${this.indexVooAtivo}`;
    this.selecionarVoo(vooId);
  },

  mostrarDetalhesVoo: function(vooId) {
    if (!this.finalResults?.proposals) return;
    const voo = this.finalResults.proposals.find(
      (v, index) => (v.sign || `voo-idx-${index}`) === vooId
    );
    if (!voo) {
      console.error(`Voo ${vooId} não encontrado`);
      return;
    }
    document.getElementById('modal-detalhes-voo')?.remove();
    const preco = this.obterPrecoVoo(voo);
    const moeda = this.finalResults?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    const infoIda = this.obterInfoSegmento(voo.segment?.[0]);
    const infoVolta = voo.segment?.length > 1 ? this.obterInfoSegmento(voo.segment[1]) : null;
    const modalContainer = document.createElement('div');
    modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modalContainer.id = 'modal-detalhes-voo';
    modalContainer.innerHTML = `
      <div class="bg-white rounded-lg w-full max-w-md p-4 max-h-90vh overflow-y-auto">
        <div class="flex justify-between items-center mb-4"> 
          <h3 class="text-lg font-bold">Detalhes do Voo</h3> 
          <button id="btn-fechar-detalhes" class="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button> 
        </div>
        <div class="border-b pb-3 mb-3"> 
          <div class="flex justify-between items-center"> 
            <div> 
              <p class="text-2xl font-bold">${precoFormatado}</p> 
              <p class="text-sm text-gray-600">Preço por pessoa</p> 
            </div> 
            <div> 
              <p class="font-medium">${this.obterCompanhiasAereas(voo)}</p> 
              <p class="text-sm text-gray-600">
                ${infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0) ? 'Voo direto' : 
                  `${(infoIda?.paradas ?? 0) + (infoVolta?.paradas ?? 0)} parada(s)`}
              </p>
            </div>
          </div>
        </div>
        <div>
          <!-- Aqui seriam renderizados mais detalhes do voo -->
          <p>Detalhes completos do voo aqui...</p>
        </div>
      </div>
    `;
    document.body.appendChild(modalContainer);
    document.getElementById('btn-fechar-detalhes').addEventListener('click', () => {
      modalContainer.remove();
    });
  }
};

window.BENETRIP_VOOS = BENETRIP_VOOS;
BENETRIP_VOOS.init();
