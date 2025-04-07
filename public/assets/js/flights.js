/**
 * BENETRIP - Módulo de Busca e Exibição de Voos
 * Versão 2.6.0 - Performance Improvements
 */

// Módulo de Voos do Benetrip
const BENETRIP_VOOS = {
  // --- Constantes ---
  initialized: false,
  INITIAL_WAIT_MS: 5000,
  POLLING_INTERVAL_MS: 3000,
  MAX_POLLING_ATTEMPTS: 40,
  TIMEOUT_MS: 125000,
  lastUIUpdate: 0, // Nova variável para controlar atualizações de UI

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
  pendingUIUpdates: false, // Novo flag para controlar atualizações pendentes

  // --- Inicialização ---
  init() {
    console.log('Inicializando sistema de busca de voos v2.6.0 (Performance Improved)...');
    
    // Evita múltiplas inicializações
    if (this.initialized) {
      console.warn('Sistema já inicializado. Ignorando chamada duplicada.');
      return;
    }
    
    this.initialized = true;
    this.resetState();
    this.configurarEventos();
    
    if (!document.getElementById('toast-container')) {
      const toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    this.aplicarEstilosModernos();
    this.renderizarInterface(); // Render interface first
    
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
      this.pollingIntervalId = null;
      this.initialWaitTimeoutId = null;
      this.timeoutId = null;
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
      this.lastUIUpdate = 0;
      this.pendingUIUpdates = false;
      
      // Limpar instância hammer existente
      if (this.hammerInstance) {
        this.hammerInstance.destroy();
        this.hammerInstance = null;
      }
  },
  configurarEventos() {
    // Delegação de evento global - usando um único listener
    document.addEventListener('click', (event) => {
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
      if(semResultadosContainer) {
          if (target.closest('.btn-secundario')) { window.location.href = 'index.html'; return; }
          if (target.closest('.btn-principal')) { window.location.href = 'destinos.html'; return; }
      }

      // Clique no card de voo
      const vooCard = target.closest('.voo-card');
      if (vooCard && this.finalResults && this.finalResults.proposals.length > 0) {
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
          this.selecionarVooAtivo(); // Seleciona o ativo
           if (this.vooSelecionado) { // Verifica se a seleção funcionou
               this.mostrarConfirmacaoSelecao(this.vooSelecionado);
           }
        } else {
          this.exibirToast('Deslize e escolha um voo primeiro', 'warning');
        }
        return;
      }
    });

    // Listener de teclas para navegação (com debounce para evitar múltiplos eventos)
    let keyNavigationTimeout;
    document.addEventListener('keydown', (e) => {
      if (keyNavigationTimeout) clearTimeout(keyNavigationTimeout);
      
      keyNavigationTimeout = setTimeout(() => {
        // Usa finalResults
        if (this.finalResults && this.finalResults.proposals && this.finalResults.proposals.length > 0) {
          if (e.key === 'ArrowRight') { this.proximoVoo(); e.preventDefault(); }
          else if (e.key === 'ArrowLeft') { this.vooAnterior(); e.preventDefault(); }
          else if (e.key === 'Enter') { this.selecionarVooAtivo(); e.preventDefault(); }
        }
      }, 50); // Pequeno debounce
    });
  },

  async carregarDestino() {
    try {
        let destinoString = localStorage.getItem('benetrip_destino_selecionado');
        if (!destinoString) {
            destinoString = localStorage.getItem('benetrip_destino_escolhido') || localStorage.getItem('benetrip_destino');
        }
        if (!destinoString) {
            const dadosUsuario = this.carregarDadosUsuario();
            if (dadosUsuario?.fluxo === 'destino_conhecido' && dadosUsuario?.respostas?.destino_conhecido) {
                this.destino = dadosUsuario.respostas.destino_conhecido;
                if (typeof this.destino === 'string') {
                    const codigoExtraido = this.extrairCodigoIATA(this.destino);
                    this.destino = { destino: this.destino, codigo_iata: codigoExtraido };
                } else if (!this.destino.codigo_iata) {
                    this.destino.codigo_iata = this.extrairCodigoIATA(this.destino.destino || this.destino.nome);
                }
                if (!this.destino.codigo_iata) throw new Error('Código IATA do destino não encontrado nos dados do usuário.');
                console.log('Destino carregado dos dados do usuário:', this.destino);
                return true;
            }
            throw new Error('Nenhum destino selecionado');
        }
        this.destino = JSON.parse(destinoString);
        console.log('Destino carregado do localStorage:', this.destino);
        if (!this.destino.codigo_iata && this.destino.aeroporto?.codigo) {
            this.destino.codigo_iata = this.destino.aeroporto.codigo;
        }
        if (!this.destino.codigo_iata) {
            const codigoExtraido = this.extrairCodigoIATA(this.destino.destino || this.destino.nome);
            if (codigoExtraido) {
                this.destino.codigo_iata = codigoExtraido;
                console.log(`Código IATA extraído: ${codigoExtraido}`);
            } else {
                throw new Error('Código IATA do destino não encontrado');
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
    const mapeamento = {'paris': 'CDG', 'londres': 'LHR', 'nova york': 'JFK', 'nova iorque': 'JFK', 'tokyo': 'HND', 
                      'tóquio': 'HND', 'madrid': 'MAD', 'roma': 'FCO', 'berlim': 'BER', 'amsterdam': 'AMS', 
                      'dubai': 'DXB', 'bangkok': 'BKK', 'sidney': 'SYD', 'sydney': 'SYD', 'los angeles': 'LAX', 
                      'miami': 'MIA', 'cancun': 'CUN', 'cidade do méxico': 'MEX'};
    const textoLower = texto.toLowerCase();
    for (const [cidade, codigo] of Object.entries(mapeamento)) {
        if (textoLower.includes(cidade)) return codigo;
    }
    return null;
  },
  async iniciarBuscaVoos() {
    try {
      if (!this.destino || !this.destino.codigo_iata) throw new Error('Dados do destino incompletos.');
      const dadosUsuario = this.carregarDadosUsuario();
      const datas = dadosUsuario?.respostas?.datas;
      if (!datas || !datas.dataIda) throw new Error('Datas de viagem não disponíveis.');
      const origemIATA = this.obterCodigoIATAOrigem(dadosUsuario);

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

      const validacao = this.validarDadosParaBusca(params);
      if (!validacao.valido) throw new Error(`Dados inválidos: ${validacao.mensagens.join(", ")}`);

      console.log('Iniciando busca com parâmetros:', params);
      this.resetState(); // Limpa estado anterior antes de nova busca
      this.estaCarregando = true;
      this.atualizarProgresso('Iniciando busca de voos...', 10);
      this.renderizarInterface();

      // Configura timeout global
      this.timeoutId = setTimeout(() => {
        if (this.estaCarregando) {
          this.pararPolling();
          this.mostrarErro('A busca demorou mais que o esperado.');
        }
      }, this.TIMEOUT_MS);

      // Chama backend para iniciar busca
      const resposta = await fetch('/api/flight-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const dados = await resposta.json().catch(async () => {
          // Tenta ler como texto se não for JSON
          const textError = await resposta.text();
          throw new Error(`Resposta não JSON do servidor (${resposta.status}): ${textError.substring(0,150)}`);
      });

      if (!resposta.ok || (resposta.status === 202 && !dados.search_id)) {
         // Trata erros 4xx/5xx ou 202 inesperado sem search_id
         throw new Error(dados.error || dados.details?.error || dados.message || `Erro ${resposta.status} ao iniciar busca.`);
      }

      // Sucesso ao iniciar (Status 202 com search_id)
      console.log('Busca iniciada. Search ID:', dados.search_id);
      this.searchId = dados.search_id;
      this.currencyRates = dados.currency_rates;

      // Agenda início do polling após espera
      this.atualizarProgresso('Busca iniciada. Aguardando primeiros resultados...', 15);
      this.initialWaitTimeoutId = setTimeout(() => {
          console.log('Tempo de espera inicial concluído. Iniciando polling...');
          this.iniciarPollingFrontend();
      }, this.INITIAL_WAIT_MS);

    } catch (erro) {
      console.error('Erro ao iniciar busca de voos:', erro);
      this.mostrarErro(erro.message);
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
    return { valido: mensagensErro.length === 0, mensagens: mensagensErro };
  },
  iniciarPollingFrontend() {
    console.log(`Iniciando polling para searchId: ${this.searchId}`);
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
    if (this.initialWaitTimeoutId) { clearTimeout(this.initialWaitTimeoutId); this.initialWaitTimeoutId = null; }

    this.isPolling = true;
    this.pollingAttempts = 0;
    this.atualizarProgresso('Procurando as melhores conexões...', 20);

    // Inicia intervalo
    this.pollingIntervalId = setInterval(() => this.verificarResultadosPolling(), this.POLLING_INTERVAL_MS);
    // Chama imediatamente a primeira vez
    this.verificarResultadosPolling();
  },

  pararPolling() {
    console.log('Parando polling e timeouts.');
    if (this.pollingIntervalId) { clearInterval(this.pollingIntervalId); this.pollingIntervalId = null; }
    if (this.initialWaitTimeoutId) { clearTimeout(this.initialWaitTimeoutId); this.initialWaitTimeoutId = null; }
    if (this.timeoutId) { clearTimeout(this.timeoutId); this.timeoutId = null; }
    this.isPolling = false;
  },

  // Função principal de polling com TRATAMENTO EXPANDIDO para processar chunks
  async verificarResultadosPolling() {
    if (!this.isPolling) return;

    this.pollingAttempts++;
    console.log(`Polling Chunks: Tentativa ${this.pollingAttempts}/${this.MAX_POLLING_ATTEMPTS}`);

    // Atualiza UI com menos frequência (a cada 2 tentativas) para reduzir reflows
    const agora = Date.now();
    if (agora - this.lastUIUpdate > 1500) {
      this.lastUIUpdate = agora;
      const mensagens = ['Buscando voos...', 'Verificando tarifas...', 'Analisando conexões...', 'Consultando Cias...', 'Quase lá...'];
      const msgIdx = Math.min(Math.floor(this.pollingAttempts / (this.MAX_POLLING_ATTEMPTS / mensagens.length)), mensagens.length - 1);
      const progresso = 20 + Math.min(75, (this.pollingAttempts / this.MAX_POLLING_ATTEMPTS) * 75);
      this.atualizarProgresso(`${mensagens[msgIdx]} (${this.pollingAttempts})`, progresso);
    }

    // Verifica limite (mantido)
    if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS) {
      this.pararPolling();
      this.mostrarErro('A busca demorou mais que o esperado.');
      return;
    }

    try {
      // Chama o backend (proxy)
      const resposta = await fetch(`/api/flight-results?uuid=${this.searchId}`);

      // --- Processamento da Resposta (Chunk) ---
      if (!resposta.ok) {
          // Trata erros HTTP (mantido)
          const errorData = await resposta.json().catch(() => ({ error: `Erro ${resposta.status} (resposta não JSON)` }));
          const errorMessage = errorData.error || `Erro ${resposta.status}.`;
          console.error(`Erro no polling (HTTP ${resposta.status}):`, errorMessage, errorData);
          if (resposta.status === 404) { this.pararPolling(); this.mostrarErro('Busca expirou/inválida.'); }
          else if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS - 5) { this.pararPolling(); this.mostrarErro(errorMessage); }
          return;
      }

      const chunkData = await resposta.json();
      console.log(`Chunk recebido (Tentativa ${this.pollingAttempts}):`, chunkData); // Log do chunk bruto

      // --- DIAGNÓSTICO EXPANDIDO: Verifica todos os itens do array ---
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
                  
                  // Também extrai airlines, airports, gates_info de todos os itens
                  if (item.airlines) Object.assign(this.accumulatedAirlines, item.airlines);
                  if (item.airports) Object.assign(this.accumulatedAirports, item.airports);
                  if (item.gates_info) Object.assign(this.accumulatedGatesInfo, item.gates_info);
                  if (item.meta) this.accumulatedMeta = { ...this.accumulatedMeta, ...item.meta };
              }
          });
          
          if (proposalsTotal > 0) {
              console.log(`!!! ENCONTRADAS ${proposalsTotal} propostas em TODOS os itens do array !!!`);
              // Acumula todas as propostas encontradas em todos os itens
              this.accumulatedProposals.push(...proposalsEmTodosItens);
          }
      }

      // --- AJUSTE: Encontrar o objeto de dados relevante ---
      let chunkObject = null;
      if (Array.isArray(chunkData)) {
          // Procura o objeto no array que contém o search_id esperado
          chunkObject = chunkData.find(item => item && typeof item === 'object' && item.search_id === this.searchId);
          if (!chunkObject) {
              console.warn(`Array recebido, mas nenhum objeto encontrado com search_id ${this.searchId}. Conteúdo:`, chunkData);
          } else {
              console.log("Objeto principal do chunk encontrado dentro do array:", chunkObject);
          }
      } else if (chunkData && typeof chunkData === 'object') {
          // Se não for array, assume que é o objeto diretamente
          if (chunkData.search_id === this.searchId) {
             chunkObject = chunkData;
             console.log("Chunk recebido como objeto único:", chunkObject);
          } else if (Object.keys(chunkData).length === 1 && chunkData.search_id) {
             console.log('Busca ainda em andamento (resposta apenas com search_id)...');
          } else {
             console.warn(`Objeto recebido, mas search_id (${chunkData.search_id}) não corresponde ao esperado (${this.searchId}). Conteúdo:`, chunkData);
          }
      } else {
          console.warn("Chunk recebido com status 200 mas formato inesperado (não array/objeto):", chunkData);
          return;
      }

      // --- Processa o chunkObject SE encontrado ---
      if (chunkObject) {
          const proposalsInChunk = chunkObject.proposals;
          const airlinesInChunk = chunkObject.airlines;
          const airportsInChunk = chunkObject.airports;
          const gatesInfoInChunk = chunkObject.gates_info;
          const metaInChunk = chunkObject.meta;

          // Acumula dados de referência
          if (airlinesInChunk) Object.assign(this.accumulatedAirlines, airlinesInChunk);
          if (airportsInChunk) Object.assign(this.accumulatedAirports, airportsInChunk);
          if (gatesInfoInChunk) Object.assign(this.accumulatedGatesInfo, gatesInfoInChunk);
          if (metaInChunk) this.accumulatedMeta = { ...this.accumulatedMeta, ...metaInChunk };

          // CORREÇÃO CRÍTICA: Um array vazio de proposals só significa fim da busca se:
          // 1. Não é a primeira tentativa de polling (pollingAttempts > 1) E
          // 2. Propostas já foram acumuladas anteriormente OU fizemos várias tentativas sem resultados
          if (proposalsInChunk && Array.isArray(proposalsInChunk)) {
              if (proposalsInChunk.length > 0) {
                  // --- Propostas encontradas no objeto principal: acumula e continua ---
                  console.log(`Acumulando ${proposalsInChunk.length} propostas do objeto principal com search_id. Total acumulado: ${this.accumulatedProposals.length + proposalsInChunk.length}`);
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
                      console.log(`Polling concluído! (Array proposals vazio é realmente o fim na tentativa ${this.pollingAttempts})`);
                      // CORREÇÃO: Garante que o polling é interrompido aqui
                      this.pararPolling();
                      this.estaCarregando = false;
                      this.atualizarProgresso('Finalizando...', 100);

                      // Monta o objeto final de resultados
                      this.finalResults = {
                          proposals: this.accumulatedProposals,
                          airlines: this.accumulatedAirlines,
                          airports: this.accumulatedAirports,
                          gates_info: this.accumulatedGatesInfo,
                          meta: this.accumulatedMeta,
                          search_id: this.searchId,
                          segments: chunkObject.segments,
                          market: chunkObject.market
                      };

                      // Pré-processa as propostas acumuladas
                      this.finalResults.proposals = this.preprocessarPropostas(this.finalResults.proposals);

                      if (this.finalResults.proposals.length > 0) {
                          this.exibirToast(`${this.finalResults.proposals.length} voos encontrados! ✈️`, 'success');
                          console.log("Resultados finais montados:", this.finalResults);
                      } else {
                          console.log('Busca concluída sem resultados acumulados.');
                          this.exibirToast('Não encontramos voos disponíveis.', 'warning');
                      }
                      this.renderizarInterface();
                  } else {
                      // --- NÃO É O FIM AINDA: Continua polling ---
                      console.log(`Array proposals vazio na tentativa ${this.pollingAttempts}, mas NÃO é o fim: ${this.pollingAttempts === 1 ? "É a 1ª tentativa" : "Ainda não temos propostas suficientes"}. Continuando polling...`);
                  }
              }
          } else {
              console.warn(`Chunk object encontrado, mas 'proposals' não é um array ou está ausente. Conteúdo do chunkObject:`, chunkObject);
          }
      } else {
          console.log(`Nenhum objeto de dados principal encontrado na tentativa ${this.pollingAttempts}. Continuando polling...`);
      }

    } catch (erro) {
      console.error('Erro durante o polling ou processamento do chunk:', erro);
      if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS - 5) {
          this.pararPolling();
          this.mostrarErro('Erro ao verificar resultados. Verifique sua conexão.');
      }
    }
  },

  preprocessarPropostas(propostas) {
      if (!propostas || !Array.isArray(propostas)) return [];
      console.log(`Pré-processando ${propostas.length} propostas acumuladas...`);
      // Ordena por preço (menor primeiro)
      propostas.sort((a, b) => this.obterPrecoVoo(a) - this.obterPrecoVoo(b));
      // Adiciona informações calculadas
      return propostas.map((proposta, index) => {
          proposta._melhorPreco = (index === 0);
          const precoAtual = this.obterPrecoVoo(proposta);
          const precoMedio = precoAtual * (1 + (Math.random() * 0.25));
          proposta._economia = Math.max(0, Math.round(((precoMedio - precoAtual) / precoMedio) * 100)); // Garante não negativo
          proposta._assentosDisponiveis = Math.floor(Math.random() * 8) + 1;
          return proposta;
      });
  },
  atualizarProgresso(mensagem, porcentagem) {
    // Usar requestAnimationFrame para operações de DOM
    requestAnimationFrame(() => {
      const bar = document.querySelector('.progress-bar');
      const text = document.querySelector('.loading-text');
      if (bar) { bar.style.width = `${porcentagem}%`; bar.setAttribute('aria-valuenow', porcentagem); }
      if (text) { text.textContent = mensagem; }
    });
  },

  renderizarInterface() {
    // Usar debounce para evitar múltiplas chamadas em curto período
    if (this.pendingUIUpdates) return;
    this.pendingUIUpdates = true;
    
    // Agrupar atualizações visuais com requestAnimationFrame
    requestAnimationFrame(() => {
      try {
        console.log('Renderizando interface...');
        const container = document.getElementById('voos-container');
        if (!container) { 
            console.error('Container #voos-container não encontrado!'); 
            this.pendingUIUpdates = false;
            return; 
        }

        // Limpa o container, preservando apenas o header se existir
        const headerExistente = container.querySelector('.app-header');
        container.innerHTML = '';
        if (headerExistente) container.appendChild(headerExistente);
        else this.renderizarHeader(container);

        // Adiciona conteúdo com base no estado atual
        if (this.estaCarregando) {
            console.log('Renderizando estado: Carregando');
            this.renderizarCarregamento(container);
        } else if (this.temErro) {
            console.log('Renderizando estado: Erro', this.mensagemErro);
            this.renderizarErro(container);
        } else if (!this.finalResults || !this.finalResults.proposals || this.finalResults.proposals.length === 0) {
            console.log('Renderizando estado: Sem Resultados');
            this.renderizarSemResultados(container);
        } else {
            console.log('Renderizando estado: Voos Encontrados', this.finalResults.proposals.length);
            const mainContent = document.createElement('main');
            mainContent.className = 'voos-content';
            container.appendChild(mainContent);

            this.renderizarResumoViagem(mainContent);
            this.renderizarListaVoos(mainContent);
            this.renderizarBotaoSelecao(container);

            if (!container.querySelector('#swipe-hint')) this.renderizarSwipeHint(container);
            
            // Seleciona primeiro voo com atraso para garantir que o DOM está pronto
            setTimeout(() => {
                this.configurarEventosAposRenderizacao();
                const primeiroVoo = this.finalResults.proposals[0];
                if (primeiroVoo) {
                    this.vooAtivo = primeiroVoo;
                    this.indexVooAtivo = 0;
                    this.atualizarVooAtivo();
                }
            }, 100);
        }
        
        // Adiciona classe para indicar que a renderização foi concluída
        container.classList.add('interface-rendered');
        console.log('Renderização concluída');
        this.pendingUIUpdates = false;
      } catch (erro) {
        console.error('Erro ao renderizar interface:', erro);
        const container = document.getElementById('voos-container');
        if (container) {
            container.innerHTML = '';
            this.renderizarHeader(container);
            this.mensagemErro = 'Ocorreu um erro ao exibir os voos: ' + erro.message;
            this.renderizarErro(container);
        }
        this.pendingUIUpdates = false;
      }
    });
  },

  // Implementação otimizada de atualizarVooAtivo para reduzir reflows
  atualizarVooAtivo() {
    // Coletamos todas as informações do DOM primeiro para minimizar reflows
    const cards = Array.from(document.querySelectorAll('.voo-card'));
    const btnSelecionar = document.querySelector('.btn-selecionar-voo');
    const currentIndexElement = document.querySelector('.current-index');
    const paginationDots = Array.from(document.querySelectorAll('.pagination-dot'));
    
    // Agrupamos as mudanças de DOM em um único requestAnimationFrame
    requestAnimationFrame(() => {
      // 1. Remover classe ativa de todos os cards
      cards.forEach(card => card.classList.remove('voo-card-ativo'));
      
      // 2. Adicionar classe ao card ativo
      const cardAtivo = cards.find(card => parseInt(card.dataset.vooIndex) === this.indexVooAtivo);
      if (cardAtivo) {
        cardAtivo.classList.add('voo-card-ativo');
        // Scroll suave para o card
        cardAtivo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        
        // Adicionar e remover classe de destaque com timer
        cardAtivo.classList.add('voo-card-highlight');
        setTimeout(() => cardAtivo.classList.remove('voo-card-highlight'), 500);
      }
      
      // 3. Atualizar o botão de seleção
      if (btnSelecionar && this.vooAtivo) {
        const preco = this.obterPrecoVoo(this.vooAtivo);
        const moeda = this.finalResults?.meta?.currency || 'BRL';
        btnSelecionar.innerHTML = `<span>Escolher Voo por ${this.formatarPreco(preco, moeda)}</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>`;
      } else if (btnSelecionar) {
        btnSelecionar.innerHTML = `<span>Escolher Este Voo</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>`;
      }
      
      // 4. Atualizar indicador de paginação
      if (currentIndexElement) {
        currentIndexElement.textContent = (this.indexVooAtivo + 1).toString();
      }
      
      // 5. Atualizar pontos de paginação
      paginationDots.forEach(dot => {
        const dotIndex = parseInt(dot.dataset.index || '0');
        if (dotIndex === this.indexVooAtivo) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    });
  },
  configurarEventosAposRenderizacao() {
    // Limpar instâncias Hammer anteriores para evitar duplicação
    if (this.hammerInstance) {
      this.hammerInstance.destroy();
      this.hammerInstance = null;
    }
    
    // Configura swipe e scroll-snap
    if (typeof Hammer !== 'undefined') {
       const sc = document.getElementById('voos-swipe-container');
       if (sc) {
         this.hammerInstance = new Hammer(sc);
         this.hammerInstance.on('swipeleft', () => this.proximoVoo());
         this.hammerInstance.on('swiperight', () => this.vooAnterior());
         this.hammerInstance.on('swipeleft swiperight', () => {
           try {
             const s = new Audio('assets/sounds/swipe.mp3');
             s.volume = 0.2;
             s.play().catch(()=>{});
           } catch(e){} 
         });
       }
    }
    
    // Configura eventos de scroll com otimização para evitar múltiplas chamadas
    const sc = document.getElementById('voos-swipe-container');
    if (sc) {
      let scrollEndTimeout;
      let lastScrollPosition = 0;
      
      // Usar throttle para reduzir chamadas durante scroll rápido
      sc.addEventListener('scroll', () => {
        if (scrollEndTimeout) clearTimeout(scrollEndTimeout);
        
        // Verificar se o scroll mudou significativamente
        const currentScroll = sc.scrollLeft;
        if (Math.abs(currentScroll - lastScrollPosition) > 50) {
          lastScrollPosition = currentScroll;
          this.addScrollShadows(sc); // Atualiza sombras durante scroll
        }
        
        // Detectar fim do scroll
        scrollEndTimeout = setTimeout(() => {
          this.atualizarVooAtivoBaseadoNoScroll(sc);
          this.addScrollShadows(sc);
        }, 150);
      });
    }
    
    // Configurar resposta visual ao atingir o fim da lista
    const nextBtn = document.querySelector('.next-btn');
    const prevBtn = document.querySelector('.prev-btn');
    if (nextBtn && prevBtn) {
      this.proximoVooOriginal = this.proximoVoo;
      this.vooAnteriorOriginal = this.vooAnterior;
      
      this.proximoVoo = () => {
        const maxIndex = this.finalResults?.proposals?.length - 1 || 0;
        const isLast = this.indexVooAtivo >= maxIndex;
        
        if (isLast) {
          // Feedback visual quando chegou ao fim
          nextBtn.classList.add('opacity-50');
          setTimeout(() => nextBtn.classList.remove('opacity-50'), 300);
        } else {
          // Chama o método original
          this.proximoVooOriginal();
        }
      };
      
      this.vooAnterior = () => {
        const isFirst = this.indexVooAtivo <= 0;
        
        if (isFirst) {
          // Feedback visual quando chegou ao início
          prevBtn.classList.add('opacity-50');
          setTimeout(() => prevBtn.classList.remove('opacity-50'), 300);
        } else {
          // Chama o método original
          this.vooAnteriorOriginal();
        }
      };
    }
    
    // Hack visual: destaca o primeiro voo com delay para chamar atenção
    setTimeout(() => {
      const firstCard = document.querySelector('.voo-card[data-voo-index="0"]');
      if (firstCard && !this.vooSelecionado) {
        firstCard.classList.add('voo-card-highlight');
        setTimeout(() => firstCard.classList.remove('voo-card-highlight'), 800);
      }
    }, 1000);
    
    // Acrescenta estilo de sombra nas bordas para indicar scroll
    const container = document.getElementById('voos-swipe-container');
    if (container) {
      this.addScrollShadows(container);
    }
  },

  // Extraído para ser reusável e mais eficiente
  addScrollShadows(container) {
    if (!container) return;
    
    // Verifica se tem conteúdo à direita
    const hasMoreRight = container.scrollWidth > container.clientWidth + container.scrollLeft + 10;
    // Verifica se tem conteúdo à esquerda
    const hasMoreLeft = container.scrollLeft > 10;
    
    // Aplica as classes em batch
    requestAnimationFrame(() => {
      container.classList.toggle('shadow-right', hasMoreRight);
      container.classList.toggle('shadow-left', hasMoreLeft);
    });
  },

  atualizarVooAtivoBaseadoNoScroll(swipeContainer) {
    if (!swipeContainer) return;
    const sL = swipeContainer.scrollLeft;
    const cW = swipeContainer.querySelector('.voo-card')?.offsetWidth || 0;
    if (cW > 0 && this.finalResults?.proposals?.length > 0) {
      const nI = Math.round(sL / cW);
      if (nI >= 0 && nI < this.finalResults.proposals.length && nI !== this.indexVooAtivo) {
        this.indexVooAtivo = nI;
        this.vooAtivo = this.finalResults.proposals[this.indexVooAtivo];
        this.atualizarVooAtivo();
      }
    }
  },

  aplicarEstilosModernos() {
    const id = 'benetrip-voos-styles';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      /* Cores da identidade Benetrip */
      :root {
        --benetrip-orange: #E87722;
        --benetrip-blue: #00A3E0;
        --benetrip-dark: #21272A;
        --benetrip-light-gray: #F5F5F5;
        --benetrip-gray: #E0E0E0;
      }
      
      /* Container principal - z-index elevado para garantir visibilidade */
      #voos-container { 
        padding-bottom: 80px; 
        max-width: 100%; 
        overflow-x: hidden; 
        background-color: #f8f8f8;
        position: relative;
        z-index: 10;
      }
      
      /* Estilos para o swipe container */
      .voos-swipe-container { 
        display: flex !important; 
        overflow-x: auto; 
        scroll-snap-type: x proximity; /* Mudado para 'proximity' para melhorar experiência */
        -webkit-overflow-scrolling: touch; 
        scroll-behavior: smooth;
        gap: 8px;
        padding: 4px 8px;
        min-height: 350px;
        scrollbar-width: thin;
        position: relative;
        z-index: 5;
        will-change: scroll-position; /* Otimização de performance */
        transform: translateZ(0); /* Força aceleração por hardware */
      }
      
      /* Botão de seleção fixo com z-index elevado */
      .botao-selecao-fixo { 
        position: fixed !important; 
        bottom: 0 !important; 
        left: 0 !important; 
        right: 0 !important; 
        padding: 8px 16px !important; 
        background-color: white !important; 
        border-top: 1px solid #e5e7eb !important; 
        z-index: 1000 !important;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.05) !important;
        display: flex !important;
      }
      
      /* Cards otimizados para performance */
      .voo-card { 
        flex: 0 0 calc(100% - 16px); 
        scroll-snap-align: center; 
        transition: transform 0.3s ease, box-shadow 0.3s ease; 
        position: relative; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        border-radius: 8px;
        margin-bottom: 8px;
        overflow: hidden;
        transform: translateZ(0);
        will-change: transform, box-shadow;
      }
      
      /* Sistema de toast com z-index corrigido */
      .toast-container { 
        position: fixed; 
        bottom: 80px; /* Acima do botão fixo */ 
        left: 0; 
        right: 0; 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        z-index: 990; 
        pointer-events: none; 
      }
      
      /* Restante do CSS inalterado */
    `;
    document.head.appendChild(s);
  },
  mostrarErro(mensagem) {
    console.error("Erro exibido:", mensagem);
    this.pararPolling();
    this.temErro = true;
    this.estaCarregando = false;
    this.mensagemErro = mensagem || 'Erro desconhecido.';
    this.renderizarInterface();
    this.reportarErro({
      mensagem,
      searchId: this.searchId,
      timestamp: new Date().toISOString(),
      tentativas: this.pollingAttempts
    });
  },

  reportarErro(dadosErro) {
    console.warn("Dados erro:", dadosErro);
    try {
      const errs = JSON.parse(localStorage.getItem('benetrip_erros') || '[]');
      errs.push(dadosErro);
      if (errs.length > 10) errs.shift();
      localStorage.setItem('benetrip_erros', JSON.stringify(errs));
    } catch (e) {
      console.error("Erro ao salvar erro:", e);
    }
  }

}; // Fim do objeto BENETRIP_VOOS

// Inicializar com verificação para evitar inicialização múltipla
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('voos-container') && !window.beneTripInitCalled) {
    window.beneTripInitCalled = true;
    console.log('Inicializando módulo de voos Benetrip (v2.6.0)...');
    BENETRIP_VOOS.init();
  }
});

// Listener visibilitychange para pausar/retomar polling quando aba fica em background
document.addEventListener('visibilitychange', () => {
  if (document.getElementById('voos-container')) {
    if (document.visibilityState === 'hidden') {
      if (BENETRIP_VOOS.isPolling) {
        console.log('Aba em background: pausando polling...');
        clearInterval(BENETRIP_VOOS.pollingIntervalId);
        BENETRIP_VOOS.pollingIntervalId = null;
      }
    } else if (document.visibilityState === 'visible') {
      if (BENETRIP_VOOS.isPolling && !BENETRIP_VOOS.pollingIntervalId) {
        console.log('Aba voltou ao primeiro plano: retomando polling...');
        BENETRIP_VOOS.pollingIntervalId = setInterval(() => BENETRIP_VOOS.verificarResultadosPolling(), BENETRIP_VOOS.POLLING_INTERVAL_MS);
        BENETRIP_VOOS.verificarResultadosPolling(); // Executar imediatamente
      }
    }
  }
});

// Listener de erro global otimizado com throttle para evitar spam de erros
let ultimoErroGlobal = 0;
window.addEventListener('error', (event) => {
  const agora = Date.now();
  // Evita múltiplos relatórios em curto período
  if (agora - ultimoErroGlobal > 2000) {
    ultimoErroGlobal = agora;
    console.error('Erro global:', event);
    if (document.getElementById('voos-container') && BENETRIP_VOOS) {
      BENETRIP_VOOS.reportarErro({
        tipo: 'erro_global',
        mensagem: event.message,
        fonte: event.filename,
        linha: event.lineno,
        coluna: event.colno,
        timestamp: new Date().toISOString()
      });
    }
  }
});
