/**
 * BENETRIP - Módulo de Busca e Exibição de Voos
 * Versão 3.0.0 - Otimização de desempenho e correção de bugs
 */

// Módulo de Voos do Benetrip
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
    this.aplicarEstilosModernos();
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
    
    // Limpar temporizadores existentes
    this.limparTemporizadores();
    
    // Reset de dados acumulados
    this.accumulatedProposals = [];
    this.accumulatedAirlines = {};
    this.accumulatedAirports = {};
    this.accumulatedGatesInfo = {};
    this.accumulatedMeta = {};
    this.finalResults = null;
    
    // Reset de estados de erro e seleção
    this.temErro = false;
    this.mensagemErro = '';
    this.vooSelecionado = null;
    this.vooAtivo = null;
    this.indexVooAtivo = 0;
    
    // Limpar cache de dados
    this.dadosUsuarioCache = null;
  },
  
  limparTemporizadores() {
    // Função auxiliar para limpar todos os temporizadores de forma segura
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
    // Delegação de evento global com tratamento de erros
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
      } catch (erro) {
        console.error('Erro ao processar evento de clique:', erro);
        this.reportarErro({
          tipo: 'erro_evento_clique',
          mensagem: erro.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Listener de teclas para navegação
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
        this.reportarErro({
          tipo: 'erro_evento_teclado',
          mensagem: erro.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  },

  async carregarDestino() {
    try {
      // Tenta carregar destino de diferentes fontes
      let destinoString = localStorage.getItem('benetrip_destino_selecionado');
      if (!destinoString) {
        destinoString = localStorage.getItem('benetrip_destino_escolhido') || localStorage.getItem('benetrip_destino');
      }
      
      if (!destinoString) {
        // Se não encontrou no localStorage, tenta usar dados do usuário
        const dadosUsuario = this.carregarDadosUsuario();
        if (dadosUsuario?.fluxo === 'destino_conhecido' && dadosUsuario?.respostas?.destino_conhecido) {
          this.destino = dadosUsuario.respostas.destino_conhecido;
          
          // Processa o objeto ou string de destino
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
      
      // Processa o destino do localStorage
      this.destino = JSON.parse(destinoString);
      console.log('Destino carregado do localStorage:', this.destino);
      
      // Garante que o código IATA está presente
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

      // Valida parâmetros
      const validacao = this.validarDadosParaBusca(params);
      if (!validacao.valido) {
        throw new Error(`Dados inválidos: ${validacao.mensagens.join(", ")}`);
      }

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

      // Processa resposta como JSON, com fallback para texto em caso de erro
      const dados = await resposta.json().catch(async () => {
        const textError = await resposta.text();
        throw new Error(`Resposta não JSON do servidor (${resposta.status}): ${textError.substring(0,150)}`);
      });

      // Verifica erros na resposta
      if (!resposta.ok || (resposta.status === 202 && !dados.search_id)) {
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
    
    // Verifica campos obrigatórios
    if (!params.origem) mensagensErro.push("Origem não especificada");
    if (!params.destino) mensagensErro.push("Destino não especificado");
    if (!params.dataIda) mensagensErro.push("Data de ida não especificada");
    
    // Validações de formato
    const regexIATA = /^[A-Z]{3}$/;
    const regexData = /^\d{4}-\d{2}-\d{2}$/;
    
    // Valida formatos
    if (params.origem && !regexIATA.test(params.origem)) mensagensErro.push("Formato de origem inválido");
    if (params.destino && !regexIATA.test(params.destino)) mensagensErro.push("Formato de destino inválido");
    if (params.dataIda && !regexData.test(params.dataIda)) mensagensErro.push("Formato de data de ida inválido");
    if (params.dataVolta && !regexData.test(params.dataVolta)) mensagensErro.push("Formato de data de volta inválido");
    
    // Valida número de passageiros
    if (!params.adultos || params.adultos < 1) mensagensErro.push("Número de adultos deve ser pelo menos 1");
    
    return { 
      valido: mensagensErro.length === 0, 
      mensagens: mensagensErro 
    };
  },

  iniciarPollingFrontend() {
    console.log(`Iniciando polling para searchId: ${this.searchId}`);
    
    // Limpa temporizadores anteriores
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
    if (this.initialWaitTimeoutId) { 
      clearTimeout(this.initialWaitTimeoutId); 
      this.initialWaitTimeoutId = null; 
    }

    // Configura estado de polling
    this.isPolling = true;
    this.pollingAttempts = 0;
    this.atualizarProgresso('Procurando as melhores conexões...', 20);

    // Inicia intervalo de polling
    this.pollingIntervalId = setInterval(() => this.verificarResultadosPolling(), this.POLLING_INTERVAL_MS);
    
    // Chama imediatamente a primeira vez
    this.verificarResultadosPolling();
  },

  pararPolling() {
    console.log('Parando polling e timeouts.');
    
    // Limpa todos os temporizadores
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
    
    // Garante que o estado de polling é atualizado
    this.isPolling = false;
  },

  async verificarResultadosPolling() {
    if (!this.isPolling) return;

    this.pollingAttempts++;
    console.log(`Polling Chunks: Tentativa ${this.pollingAttempts}/${this.MAX_POLLING_ATTEMPTS}`);

    // Atualiza UI com mensagens variadas baseadas no progresso
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
      // Chama o backend (proxy)
      const resposta = await fetch(`/api/flight-results?uuid=${this.searchId}`);

      // --- Processamento da Resposta (Chunk) ---
      if (!resposta.ok) {
        // Trata erros HTTP
        const errorData = await resposta.json()
          .catch(() => ({ error: `Erro ${resposta.status} (resposta não JSON)` }));
          
        const errorMessage = errorData.error || `Erro ${resposta.status}.`;
        console.error(`Erro no polling (HTTP ${resposta.status}):`, errorMessage, errorData);
        
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
      console.log(`Chunk recebido (Tentativa ${this.pollingAttempts}):`, 
        this.formatarLogChunk(chunkData));

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
            
            // Extrai dados de referência de todos os itens
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
        
        // Extrai dados de referência
        this.extrairDadosAuxiliares(chunkObject);

        // CORREÇÃO CRÍTICA: Um array vazio de proposals só significa fim da busca se:
        // 1. Não é a primeira tentativa de polling (pollingAttempts > 1) E
        // 2. Propostas já foram acumuladas anteriormente OU fizemos várias tentativas sem resultados
        if (proposalsInChunk && Array.isArray(proposalsInChunk)) {
          if (proposalsInChunk.length > 0) {
            // --- Propostas encontradas no objeto principal: acumula e continua ---
            console.log(`Acumulando ${proposalsInChunk.length} propostas do objeto principal com search_id. ` +
              `Total acumulado: ${this.accumulatedProposals.length + proposalsInChunk.length}`);
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
              
              // CORREÇÃO: Garantir limpeza completa do estado de polling
              this.pararPolling();
              this.isPolling = false;
              this.estaCarregando = false;
              
              // Limpar qualquer temporizador residual
              if (this.pollingIntervalId) {
                clearInterval(this.pollingIntervalId);
                this.pollingIntervalId = null;
              }
              
              this.atualizarProgresso('Finalizando...', 100);

              // Monta o objeto final de resultados
              this.finalResults = this.montarResultadosFinais(chunkObject);

              // Pré-processa as propostas acumuladas
              this.finalResults.proposals = this.preprocessarPropostas(this.finalResults.proposals);

              if (this.finalResults.proposals.length > 0) {
                this.exibirToast(`${this.finalResults.proposals.length} voos encontrados! ✈️`, 'success');
                console.log("Resultados finais montados:", 
                  this.formatarLogResultados(this.finalResults));
              } else {
                console.log('Busca concluída sem resultados acumulados.');
                this.exibirToast('Não encontramos voos disponíveis.', 'warning');
              }
              
              this.renderizarInterface();
            } else {
              // --- NÃO É O FIM AINDA: Continua polling ---
              console.log(`Array proposals vazio na tentativa ${this.pollingAttempts}, mas NÃO é o fim: ` +
                `${this.pollingAttempts === 1 ? "É a 1ª tentativa" : "Ainda não temos propostas suficientes"}. ` +
                `Continuando polling...`);
            }
          }
        } else {
          console.warn(`Chunk object encontrado, mas 'proposals' não é um array ou está ausente. ` +
            `Conteúdo do chunkObject:`, this.formatarLogChunk(chunkObject));
        }
      } else {
        console.log(`Nenhum objeto de dados principal encontrado na tentativa ${this.pollingAttempts}. ` +
          `Continuando polling...`);
      }

    } catch (erro) {
      console.error('Erro durante o polling ou processamento do chunk:', erro);
      
      // Se já tentamos muitas vezes, desiste
      if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS - 5) {
        this.pararPolling();
        this.mostrarErro('Erro ao verificar resultados. Verifique sua conexão.');
      }
      
      // Reporta o erro
      this.reportarErro({
        tipo: 'erro_polling',
        mensagem: erro.message,
        tentativa: this.pollingAttempts,
        timestamp: new Date().toISOString()
      });
    }
  },

  formatarLogChunk(chunk) {
    // Reduz tamanho dos logs para melhorar performance e legibilidade
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
    
    // Extrai dados de referência
    if (item.airlines) Object.assign(this.accumulatedAirlines, item.airlines);
    if (item.airports) Object.assign(this.accumulatedAirports, item.airports);
    if (item.gates_info) Object.assign(this.accumulatedGatesInfo, item.gates_info);
    if (item.meta) this.accumulatedMeta = { ...this.accumulatedMeta, ...item.meta };
  },
  
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
    
    // Ordena por preço (menor primeiro)
    const propostasValidas = propostas.filter(p => p && typeof p === 'object');
    propostasValidas.sort((a, b) => this.obterPrecoVoo(a) - this.obterPrecoVoo(b));
    
    // Adiciona informações calculadas
    return propostasValidas.map((proposta, index) => {
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
    // Procura elementos apenas uma vez e atualiza em batch
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
    
    // Tenta renderizar tela de erro de forma robusta
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
    
    // Reporta o erro
    this.reportarErro({
      tipo: 'erro_renderizacao_interface',
      mensagem: erro.message,
      timestamp: new Date().toISOString()
    });
  }
},

  renderizarTripinhaMessage: function(container) {
  // Preserva mensagem existente se houver
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
  
  // Atualiza o texto com base na quantidade de voos
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
  
  // Configura navegação após renderização
  this.configurarEventosAposRenderizacao();
},

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

  renderizarHeader(container) {
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
  
  // Recupera e aplica o progresso atual
  this.atualizarProgresso(
    document.querySelector('.loading-text')?.textContent || 'Buscando...',
    parseFloat(document.querySelector('.progress-bar')?.style.width || '10')
  );
  
  // Alternar dicas
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
    
    // Limpa intervalo quando carregamento for removido
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

  renderizarErro: function(container) {
  // Limpa o container de carregamento se existir
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

  renderizarSemResultados: function(container) {
  // Limpa o container de carregamento se existir
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

  renderizarResumoViagem(container) {
    const resumo = document.createElement('div'); 
    resumo.className = 'viagem-resumo p-4 bg-white border-b';
    
    // Obtém dados de viagem
    const destino = this.destino; 
    const dataViagem = this.obterDatasViagem(); 
    const passageiros = this.obterQuantidadePassageiros();
    
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

  renderizarListaVoos(container) {
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

    // Adiciona seletores de visualização
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

    // Container para contadores de paginação
    const paginationInfo = document.createElement('div');
    paginationInfo.className = 'pagination-info text-center text-sm py-1 sticky top-0 bg-white bg-opacity-80 z-10 border-b';
    paginationInfo.innerHTML = `
      <span class="current-index font-bold">1</span> de 
      <span class="total-count">${voos.length}</span>
    `;
    listaVoos.appendChild(paginationInfo);

    // Container de swipe melhorado
    const voosContainer = document.createElement('div');
    voosContainer.className = 'voos-swipe-container';
    voosContainer.id = 'voos-swipe-container';
    listaVoos.appendChild(voosContainer);

    // Carregamento otimizado de voos - apenas os primeiros 20 inicialmente
    const initialVoos = voos.slice(0, Math.min(20, voos.length));
    
    // Usa DocumentFragment para melhorar performance
    const fragment = document.createDocumentFragment();
    initialVoos.forEach((voo, index) => {
      const cardVoo = this.criarCardVoo(voo, index);
      fragment.appendChild(cardVoo);
    });
    voosContainer.appendChild(fragment);

    // Adiciona controles de navegação visual
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
    
    // Adiciona botão de carregar mais (para melhorar desempenho com muitas ofertas)
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

  criarCardVoo(voo, index) {
    // Versão otimizada da criação de cards
    const cardVoo = document.createElement('div');
    cardVoo.className = 'voo-card p-3 bg-white border-b';
    
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
    
    // Tags especiais
    let tagsSpeciais = '';
    if (isMelhorPreco) {
      tagsSpeciais += `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full absolute top-2 right-2 shadow-sm">Melhor preço</span>`;
    }
    if (ehVooDireto) {
      tagsSpeciais += `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full absolute top-2 left-2 shadow-sm">Voo Direto</span>`;
    }
    
    // Índice visual do card
    const indexDisplay = `<div class="card-index absolute top-0 left-0 w-6 h-6 flex items-center justify-center bg-gray-100 rounded-br-lg text-xs font-bold">${index + 1}</div>`;

    // Constrói o HTML interno - versão simplificada para melhor performance
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
                ${ehVooDireto ? 
                  '<span class="text-blue-600 font-medium">Voo Direto</span>' : 
                  `${infoIda?.paradas || 0} ${infoIda?.paradas === 1 ? 'parada' : 'paradas'}`
                }
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
                ${(!infoVolta || infoVolta.paradas === 0) ? 
                  '<span class="text-blue-600 font-medium">Voo Direto</span>' : 
                  `${infoVolta?.paradas || 0} ${infoVolta?.paradas === 1 ? 'parada' : 'paradas'}`
                }
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

  renderizarParadas(paradas) {
    // Simplifica a renderização de paradas
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

  renderizarBotaoSelecao: function(container) {
  // Remove botão existente para evitar duplicatas
  const btnExistente = container.querySelector('.botao-selecao-fixo'); 
  if (btnExistente) btnExistente.remove();
  
  const botaoFixo = document.createElement('div'); 
  botaoFixo.className = 'botao-selecao-fixo';
  
  // Tenta obter o preço do voo ativo
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

  renderizarSwipeHint(container) {
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
    
    // Mostra dica de swipe apenas se houver mais de um voo
    if (this.finalResults?.proposals?.length > 1) {
      hint.style.display = 'flex';
      
      // Esconde a dica depois de alguns segundos
      setTimeout(() => { 
        hint.style.opacity = '0'; 
        setTimeout(() => { 
          hint.style.display = 'none'; 
        }, 1000); 
      }, 4000);
    }
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

  obterCompanhiasAereas(voo) {
    try {
      const codigos = voo?.carriers;
      if (!codigos || codigos.length === 0) return 'N/A';
      
      // Usa as airlines acumuladas
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
      
      // Converte timestamps para objetos Date
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
    // Otimiza as operações DOM agrupando leituras e depois escritas
    // Evita múltiplos reflows ao modificar o DOM
    
    // 1. Fase de leitura - coleta referências DOM
    const cardAtual = document.querySelector('.voo-card-ativo');
    const cardAtivo = document.querySelector(`.voo-card[data-voo-index="${this.indexVooAtivo}"]`);
    const btnSelecionar = document.querySelector('.btn-selecionar-voo');
    const currentIndexElement = document.querySelector('.current-index');
    const dots = document.querySelectorAll('.pagination-dot');
    
    // 2. Calcula valores antes de modificar o DOM
    const preco = this.vooAtivo ? this.obterPrecoVoo(this.vooAtivo) : 0;
    const moeda = this.finalResults?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    
    // 3. Executa as mudanças DOM em batch usando requestAnimationFrame
    requestAnimationFrame(() => {
      // Atualiza classes dos cards
      if (cardAtual) cardAtual.classList.remove('voo-card-ativo');
      if (cardAtivo) {
        cardAtivo.classList.add('voo-card-ativo');
        
        // Centraliza o card na visualização
        cardAtivo.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest', 
          inline: 'center' 
        });
        
        // Adiciona destaque temporário
        cardAtivo.classList.add('voo-card-highlight');
        setTimeout(() => cardAtivo.classList.remove('voo-card-highlight'), 500);
      }
      
      // Atualiza o botão de seleção
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
      
      // Atualiza elementos de navegação
      if (currentIndexElement) {
        currentIndexElement.textContent = (this.indexVooAtivo + 1).toString();
      }
      
      // Atualiza dots de paginação
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
    console.log('Voo selecionado:', this.vooSelecionado);
    
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

  exibirToast(mensagem, tipo = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    // Cria o elemento toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = mensagem;
    
    // Adiciona ao container
    toastContainer.appendChild(toast);
    
    // Anima a entrada do toast (em requestAnimationFrame para melhor performance)
    requestAnimationFrame(() => {
      setTimeout(() => toast.classList.add('toast-visible'), 10);
    });
    
    // Configura a saída do toast
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      
      // Remove o elemento após a transição
      setTimeout(() => {
        if (toastContainer.contains(toast)) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    }, 3000);
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
    const precoFormatado = this.formatarPreco(preco, moeda);
    const infoIda = this.obterInfoSegmento(voo.segment?.[0]);
    const infoVolta = voo.segment?.length > 1 ? this.obterInfoSegmento(voo.segment[1]) : null;
    
    // Cria o modal
    const modalContainer = document.createElement('div');
    modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modalContainer.id = 'modal-detalhes-voo';
    
    // Conteúdo do modal
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
        
        <div class="mb-4"> 
          <h4 class="font-medium mb-2">Ida (${this.formatarData(infoIda?.dataPartida)})</h4> 
          <div class="voo-timeline">${this.renderizarTimelineVoos(voo.segment?.[0]?.flight || [])}</div> 
        </div>
        
        ${infoVolta ? `
        <div class="mt-4 pt-3 border-t"> 
          <h4 class="font-medium mb-2">Volta (${this.formatarData(infoVolta?.dataPartida)})</h4> 
          <div class="voo-timeline">${this.renderizarTimelineVoos(voo.segment?.[1]?.flight || [])}</div> 
        </div>` : ''}
        
        <div class="mt-4 pt-3 border-t"> 
          <h4 class="font-medium mb-2">Info</h4> 
          <ul class="text-sm space-y-2"> 
            <li class="flex items-start">
              <span class="text-blue-600 mr-2">✓</span>
              <span>Bagagem de mão (1 peça)</span>
            </li> 
            <li class="flex items-start">
              <span class="text-blue-600 mr-2">✓</span>
              <span>Refeição a bordo</span>
            </li> 
            <li class="flex items-start text-gray-600">
              <span class="mr-2">ℹ️</span>
              <span>Bagagem despachada opcional</span>
            </li> 
          </ul> 
        </div>
        
        <div class="mt-4 pt-3 border-t flex justify-between"> 
          <button id="btn-voltar-detalhes" class="py-2 px-4 border rounded">Voltar</button> 
          <button id="btn-selecionar-este-voo" class="py-2 px-4 text-white rounded" style="background-color: #E87722;">
            Selecionar Voo
          </button> 
        </div>
      </div>
    `;
    
    // Adiciona o modal ao DOM
    document.body.appendChild(modalContainer);
    
    // Configura eventos do modal
    document.getElementById('btn-fechar-detalhes')?.addEventListener('click', () => modalContainer.remove());
    document.getElementById('btn-voltar-detalhes')?.addEventListener('click', () => modalContainer.remove());
    document.getElementById('btn-selecionar-este-voo')?.addEventListener('click', () => { 
      this.selecionarVoo(vooId); 
      modalContainer.remove(); 
      this.mostrarConfirmacaoSelecao(voo); 
    });
    
    // Fecha ao clicar fora
    modalContainer.addEventListener('click', (e) => { 
      if (e.target === modalContainer) modalContainer.remove(); 
    });
  },

  renderizarTimelineVoos(voos) {
    if (!voos || !voos.length) return '<p>N/A</p>';
    
    let timeline = '';
    
    voos.forEach((v, i) => {
      const last = i === voos.length - 1;
      
      // Processa timestamps para exibição
      const dP = new Date(v.local_departure_timestamp * 1000);
      const dC = new Date(v.local_arrival_timestamp * 1000);
      const hP = dP.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const hC = dC.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      // Obtém informações da companhia
      let cInfo = v.marketing_carrier || v.operating_carrier || 'N/A';
      if (this.accumulatedAirlines[cInfo]) {
        cInfo = this.accumulatedAirlines[cInfo].name || cInfo;
      }
      
      // Renderiza trecho do voo
      timeline += `
        <div class="voo-leg mb-3 pb-3 ${!last ? 'border-b border-dashed' : ''}">
          <div class="flex justify-between mb-2">
            <div>
              <p class="font-bold">${hP}</p>
              <p class="text-sm">${v.departure}</p>
            </div>
            <div class="text-center flex-1 px-2">
              <p class="text-xs text-gray-500">${this.formatarDuracao(v.duration)}</p>
              <div class="h-0.5 bg-gray-300 my-2 relative">
                <div class="absolute -top-1 left-0 w-2 h-2 rounded-full bg-gray-500"></div>
                <div class="absolute -top-1 right-0 w-2 h-2 rounded-full bg-gray-500"></div>
              </div>
              <p class="text-xs">${cInfo}</p>
            </div>
            <div>
              <p class="font-bold">${hC}</p>
              <p class="text-sm">${v.arrival}</p>
            </div>
          </div>
          <div class="text-xs text-gray-600">
            <p>Voo ${v.marketing_carrier || v.operating_carrier}${v.number}</p>
            <p>Aeronave: ${v.aircraft || 'N/A'}</p>
          </div>
        </div>
      `;
      
      // Adiciona informações de conexão se não for o último trecho
      if (!last) {
        const prox = voos[i + 1];
        if (prox) {
          const tCon = Math.round((prox.local_departure_timestamp - v.local_arrival_timestamp) / 60);
          timeline += `
            <div class="conexao-info mb-3 text-sm">
              <div class="flex items-center text-orange-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span class="ml-1">Conexão em ${v.arrival} • ${this.formatarDuracao(tCon)}</span>
              </div>
            </div>
          `;
        }
      }
    });
    
    return timeline;
  },

  mostrarConfirmacaoSelecao(voo) {
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
    modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modalContainer.id = 'modal-confirmacao';
    
    // Conteúdo do modal
    modalContainer.innerHTML = `
      <div class="bg-white rounded-lg w-full max-w-md p-4">
        <div class="p-4 rounded-lg" style="background-color: rgba(232, 119, 34, 0.1);">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-orange-100 border-2 border-orange-200">
              <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover">
            </div>
            <div> 
              <p class="font-bold">Ótima escolha! Voo por ${precoFormatado}/pessoa.</p> 
              ${numPassageiros > 1 ? `
                <div class="mt-2 bg-white bg-opacity-70 p-2 rounded">
                  <p class="text-sm font-medium">Resumo:</p>
                  <div class="flex justify-between text-sm">
                    <span>${precoFormatado} × ${numPassageiros} pas.</span>
                    <span>${precoTotalFormatado}</span>
                  </div>
                </div>` : ''} 
              <div class="mt-3">
                <label class="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" id="confirmar-selecao" class="form-checkbox h-5 w-5 rounded" style="color: #E87722;">
                  <span>Sim, continuar!</span>
                </label>
              </div> 
              <p class="mt-3 text-sm">Valor por pessoa (ida/volta). Próxima etapa: hospedagem.</p> 
            </div>
          </div>
        </div>
        <div class="flex gap-2 mt-4"> 
          <button id="btn-cancelar" class="flex-1 py-2 px-4 border rounded">Voltar</button> 
          <button id="btn-confirmar" class="flex-1 py-2 px-4 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed" style="background-color: #E87722;" disabled>Confirmar</button> 
        </div>
      </div>
    `;
    
    // Adiciona o modal ao DOM
    document.body.appendChild(modalContainer);
    
    // Configura eventos do modal
    const chk = document.getElementById('confirmar-selecao');
    const btnC = document.getElementById('btn-confirmar');
    const btnX = document.getElementById('btn-cancelar');
    
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
          companhiaAerea: this.obterCompanhiasAereas(this.vooSelecionado), 
          dataSelecao: new Date().toISOString() 
        };
        
        localStorage.setItem('benetrip_voo_selecionado', JSON.stringify(dadosVoo));
        this.exibirToast('Voo selecionado! Redirecionando...', 'success');
        
        // Redireciona para a próxima página
        setTimeout(() => { 
          window.location.href = 'hotels.html'; 
        }, 1500);
      });
    }
    
    // Fecha ao clicar fora do modal
    modalContainer.addEventListener('click', function(e) { 
      if (e.target === this) this.remove(); 
    });
  },

  carregarDadosUsuario() {
    // Cache para evitar múltiplas leituras do localStorage
    if (this.dadosUsuarioCache) return this.dadosUsuarioCache;
    
    try {
      const dados = JSON.parse(localStorage.getItem('benetrip_user_data') || '{}');
      this.dadosUsuarioCache = dados;
      return dados;
    } catch (erro) {
      console.warn('Erro ao carregar dados do usuário:', erro);
      return {};
    }
  },

  obterCodigoIATAOrigem(dadosUsuario) {
    try {
      const r = dadosUsuario?.respostas;
      if (!r) throw new Error("Sem respostas");
      
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
        
        // Valor padrão se nada for encontrado
        return 'GRU';
      }
    } catch (e) {
      console.error("Erro ao obter origem:", e);
    }
    
    // Valor padrão como fallback
    console.warn('Origem GRU padrão será usada.');
    return 'GRU';
  },

  obterDatasViagem() {
    try {
      const d = this.carregarDadosUsuario()?.respostas?.datas;
      if (!d?.dataIda) return "N/A";
      
      // Função auxiliar para formatar data
      const fmt = (s) => {
        const dt = new Date(s + 'T00:00:00');
        if (isNaN(dt.getTime())) return "Inválida";
        
        const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${dt.getDate()} ${m[dt.getMonth()]} ${dt.getFullYear()}`;
      };
      
      // Processa a data de ida
      const idaF = fmt(d.dataIda);
      
      // Se não tiver data de volta, é só ida
      if (!d.dataVolta) return `${idaF} (Só ida)`;
      
      // Com data de volta
      const voltaF = fmt(d.dataVolta);
      
      // Se as datas forem no mesmo mês/ano, simplifica a exibição
      const ida = new Date(d.dataIda), volta = new Date(d.dataVolta);
      if (ida.getMonth() === volta.getMonth() && ida.getFullYear() === volta.getFullYear()) {
        const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${ida.getDate()} a ${volta.getDate()} ${m[ida.getMonth()]}, ${ida.getFullYear()}`;
      }
      
      // Caso contrário, exibe as datas completas
      return `${idaF} a ${voltaF}`;
    } catch (e) {
      console.error("Erro ao processar datas:", e);
    }
    
    return "N/A";
  },

  obterQuantidadePassageiros() {
    try {
      const r = this.carregarDadosUsuario()?.respostas;
      
      // Tenta obter quantidade de passageiros de diferentes formatos
      
      // Formato completo (adultos, crianças, bebês)
      const p = r?.passageiros;
      if (p) {
        return Math.max(1, 
          (parseInt(p.adultos) || 0) + 
          (parseInt(p.criancas) || 0) + 
          (parseInt(p.bebes) || 0)
        );
      }
      
      // Formato separado (adultos, crianças, bebês)
      const ad = parseInt(r?.adultos) || 0;
      const cr = parseInt(r?.criancas) || 0;
      const bb = parseInt(r?.bebes) || 0;
      if (ad > 0) return ad + cr + bb;
      
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

  configurarEventosAposRenderizacao() {
    // Configura swipe e scroll-snap com tratamento de erros adequado
    this.configurarSwipeGestures();
    
    // Configura eventos de scroll para atualizar card ativo
    this.configurarScrollBehavior();
    
    // Configura ações dos cartões individuais
    this.configurarEventosBotoes();
    
    // Configura resposta visual ao atingir o fim da lista
    this.configurarFeedbackNavegacao();
    
    // Destaque visual para o primeiro cartão
    this.destacarPrimeiroCard();
    
    // Configura sombras para indicar scroll
    this.configurarShadowScroll();
  },
  
  configurarSwipeGestures() {
    // Configura gestos de swipe com Hammer.js, se disponível
    if (typeof Hammer !== 'undefined') {
      const sc = document.getElementById('voos-swipe-container');
      if (sc) {
        // CORREÇÃO: Destrói instância anterior se existir
        if (this.hammerInstance) {
          this.hammerInstance.destroy();
        }
        
        // Cria nova instância
        this.hammerInstance = new Hammer(sc);
        
        // Configura eventos
        this.hammerInstance.on('swipeleft', () => this.proximoVoo());
        this.hammerInstance.on('swiperight', () => this.vooAnterior());
        
        // Feedback sonoro
        this.hammerInstance.on('swipeleft swiperight', () => {
          try {
            const s = new Audio('assets/sounds/swipe.mp3');
            s.volume = 0.2;
            s.play().catch(() => {});
          } catch(e) {
            // Silenciamos erros de áudio, pois não são críticos
          } 
        });
      }
    }
  },
  
  configurarScrollBehavior() {
    const sc = document.getElementById('voos-swipe-container');
    if (!sc) return;
    
    // Usa API moderna se disponível
    if ('onscrollend' in window) {
      sc.onscrollend = () => this.atualizarVooAtivoBaseadoNoScroll(sc);
    } else {
      // Fallback para browsers que não suportam scrollend
      sc.onscroll = () => {
        // Evita chamadas múltiplas durante o scroll
        clearTimeout(this.scrollTimeoutId);
        this.scrollTimeoutId = setTimeout(() => 
          this.atualizarVooAtivoBaseadoNoScroll(sc), 150);
      };
    }
  },
  
  configurarEventosBotoes() {
    // Configura eventos para botões de seleção em cada cartão
    document.querySelectorAll('.btn-select-voo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const vooId = btn.dataset.vooId;
        if (vooId) this.selecionarVoo(vooId);
      });
    });
    
    // Configura cliques nos dots de paginação
    document.querySelectorAll('.pagination-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.index);
        if (!isNaN(idx) && this.finalResults?.proposals[idx]) {
          this.indexVooAtivo = idx;
          this.vooAtivo = this.finalResults.proposals[idx];
          this.atualizarVooAtivo();
        }
      });
    });
    
    // Configura eventos para botões de alternância de visualização
    const viewBtns = document.querySelectorAll('.view-btn');
    const voosContainer = document.getElementById('voos-swipe-container');
    
    viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        viewBtns.forEach(b => b.classList.remove('view-btn-active'));
        btn.classList.add('view-btn-active');
        
        if (voosContainer) {
          if (view === 'list') {
            voosContainer.classList.add('voos-list-view');
            voosContainer.classList.remove('voos-card-view');
          } else {
            voosContainer.classList.add('voos-card-view');
            voosContainer.classList.remove('voos-list-view');
          }
        }
      });
    });
    
    // Ativa view de cards por padrão
    if (voosContainer) {
      voosContainer.classList.add('voos-card-view');
    }
    
    // Configura evento para botão "Carregar mais"
    const loadMoreBtn = document.querySelector('.load-more-btn');
    if (loadMoreBtn && this.finalResults?.proposals) {
      loadMoreBtn.addEventListener('click', () => this.carregarMaisResultados(loadMoreBtn));
    }
  },
  
  carregarMaisResultados(loadMoreBtn) {
    const voosContainer = document.getElementById('voos-swipe-container');
    if (!voosContainer || !this.finalResults?.proposals) return;
    
    // Determina quantos voos já foram carregados
    const currentCount = voosContainer.children.length;
    
    // Obtém o próximo lote de voos
    const nextBatch = this.finalResults.proposals.slice(currentCount, currentCount + 20);
    
    // Usa fragment para melhorar performance
    const fragment = document.createDocumentFragment();
    
    // Cria cards para cada voo do lote
    nextBatch.forEach((voo, idx) => {
      const index = currentCount + idx;
      const cardVoo = this.criarCardVoo(voo, index);
      fragment.appendChild(cardVoo);
    });
    
    // Adiciona todos os cards de uma vez
    voosContainer.appendChild(fragment);
    
    // Atualiza contador do botão ou remove se não houver mais
    const remaining = this.finalResults.proposals.length - voosContainer.children.length;
    if (remaining <= 0) {
      loadMoreBtn.parentElement.remove();
    } else {
      loadMoreBtn.textContent = `Carregar mais resultados (${remaining} restantes)`;
    }
  },
  
  configurarFeedbackNavegacao() {
    // Configura feedback visual ao navegar pelos voos
    const nextBtn = document.querySelector('.next-btn');
    const prevBtn = document.querySelector('.prev-btn');
    
    if (!nextBtn || !prevBtn) return;
    
    // Guarda as funções originais
    this.proximoVooOriginal = this.proximoVoo;
    this.vooAnteriorOriginal = this.vooAnterior;
    
    // Sobrescreve com versões que dão feedback visual
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
    
    // Adiciona eventos de clique nos botões
    nextBtn.addEventListener('click', () => this.proximoVoo());
    prevBtn.addEventListener('click', () => this.vooAnterior());
  },
  
  destacarPrimeiroCard() {
    // Destaca o primeiro voo com delay para chamar atenção
    setTimeout(() => {
      const firstCard = document.querySelector('.voo-card[data-voo-index="0"]');
      if (firstCard && !this.vooSelecionado) {
        firstCard.classList.add('voo-card-highlight');
        setTimeout(() => firstCard.classList.remove('voo-card-highlight'), 800);
      }
    }, 1000);
  },
  
  configurarShadowScroll() {
    // Adiciona sombras nas bordas para indicar conteúdo disponível no scroll
    const addScrollShadows = () => {
      const container = document.getElementById('voos-swipe-container');
      if (!container) return;
      
      // Verifica se tem conteúdo fora da área visível
      const hasMoreRight = container.scrollWidth > container.clientWidth + container.scrollLeft + 10;
      const hasMoreLeft = container.scrollLeft > 10;
      
      // Aplica classes CSS baseadas na condição
      container.classList.toggle('shadow-right', hasMoreRight);
      container.classList.toggle('shadow-left', hasMoreLeft);
    };
    
    // Aplica inicialmente
    addScrollShadows();
    
    // Configura para atualizar durante scroll
    const sc = document.getElementById('voos-swipe-container');
    if (sc) {
      sc.addEventListener('scroll', addScrollShadows);
    }
  },

  atualizarVooAtivoBaseadoNoScroll(swipeContainer) {
    if (!swipeContainer || !this.finalResults?.proposals?.length) return;
    
    // Calcula o índice do voo ativo baseado na posição de scroll
    const scrollLeft = swipeContainer.scrollLeft;
    const cardWidth = swipeContainer.querySelector('.voo-card')?.offsetWidth || 0;
    
    if (cardWidth > 0) {
      const novoIndice = Math.round(scrollLeft / cardWidth);
      
      // Verifica se o índice é válido e diferente do atual
      if (novoIndice >= 0 && 
          novoIndice < this.finalResults.proposals.length && 
          novoIndice !== this.indexVooAtivo) {
        
        // Atualiza índice e voo ativo
        this.indexVooAtivo = novoIndice;
        this.vooAtivo = this.finalResults.proposals[this.indexVooAtivo];
        
        // Atualiza a interface
        this.atualizarVooAtivo();
      }
    }
  },

  aplicarEstilosModernos() {
    // Evita aplicar estilos duplicados
    const id = 'benetrip-voos-styles';
    if (document.getElementById(id)) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = id;
    styleElement.textContent = `
      /* Cores da identidade Benetrip */
      :root {
        --benetrip-orange: #E87722;
        --benetrip-blue: #00A3E0;
        --benetrip-dark: #21272A;
        --benetrip-light-gray: #F5F5F5;
        --benetrip-gray: #E0E0E0;
      }
      
      /* Container principal */
      #voos-container { 
        padding-bottom: 80px; 
        max-width: 100%; 
        overflow-x: hidden; 
        background-color: #f8f8f8;
        height: 100%;
      }
      
      /* Estilos para o swipe container */
      .voos-swipe-container { 
        display: flex; 
        overflow-x: auto; 
        scroll-snap-type: x mandatory; 
        -webkit-overflow-scrolling: touch; 
        scroll-behavior: smooth;
        gap: 8px;
        padding: 4px 8px;
        min-height: 350px;
        scrollbar-width: thin;
        position: relative;
      }
      
      /* Shadow edges para indicar scroll */
      .voos-swipe-container.shadow-right::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        height: 100%;
        width: 24px;
        background: linear-gradient(to right, transparent, rgba(0,0,0,0.1));
        pointer-events: none;
      }
      
      .voos-swipe-container.shadow-left::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 24px;
        background: linear-gradient(to left, transparent, rgba(0,0,0,0.1));
        pointer-events: none;
        z-index: 1;
      }
      
      /* Scrollbar personalizada */
      .voos-swipe-container::-webkit-scrollbar {
        height: 6px;
      }
      .voos-swipe-container::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
      }
      .voos-swipe-container::-webkit-scrollbar-thumb {
        background: #ccc;
        border-radius: 4px;
      }
      .voos-swipe-container::-webkit-scrollbar-thumb:hover {
        background: #aaa;
      }
      
      /* Estilos dos cards */
      .voo-card { 
        flex: 0 0 calc(100% - 16px); 
        scroll-snap-align: center; 
        transition: all 0.3s ease; 
        position: relative; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        border-radius: 8px;
        margin-bottom: 8px;
        overflow: hidden;
      }
      
      /* Alternância de visualização */
      .voos-card-view .voo-card {
        flex: 0 0 calc(100% - 16px);
      }
      
      @media (min-width: 640px) {
        .voos-card-view .voo-card {
          flex: 0 0 calc(50% - 16px);
        }
      }
      
      @media (min-width: 1024px) {
        .voos-card-view .voo-card {
          flex: 0 0 calc(33.333% - 16px);
        }
      }
      
      .voos-list-view {
        display: block !important;
      }
      
      .voos-list-view .voo-card {
        flex: none;
        width: 100%;
        margin-bottom: 4px;
        scroll-snap-align: unset;
        border-radius: 4px;
      }
      
      /* Estados do card */
      .voo-card-ativo { 
        box-shadow: 0 0 0 3px var(--benetrip-orange), 0 4px 6px rgba(0,0,0,0.1); 
        transform: translateY(-2px);
      }
      .voo-card-highlight { 
        animation: pulse 1s;
      }
      .voo-selecionado { 
        box-shadow: 0 0 0 3px var(--benetrip-blue), 0 4px 8px rgba(0,0,0,0.15); 
        background-color: #f0f9ff; 
      }
      .voo-melhor-preco {
        border: 1px solid #d1fae5;
      }
      .voo-direto {
        border-left: 4px solid var(--benetrip-blue);
      }
      .voo-primeiro {
        border-top: 2px solid var(--benetrip-orange);
      }
      
      /* Cards pares e ímpares para diferenciar melhor */
      .voo-par {
        background-color: #ffffff;
      }
      .voos-list-view .voo-par {
        background-color: #fafafa;
      }
      
      /* Animações */
      @keyframes pulse { 
        0% { box-shadow: 0 0 0 0 rgba(232, 119, 34, 0.7); } 
        70% { box-shadow: 0 0 0 6px rgba(232, 119, 34, 0); } 
        100% { box-shadow: 0 0 0 0 rgba(232, 119, 34, 0); } 
      }
      
      .btn-pulsante { 
        animation: button-pulse 1.5s 2; 
      }
      
      @keyframes button-pulse { 
        0% { transform: scale(1); } 
        50% { transform: scale(1.05); } 
        100% { transform: scale(1); } 
      }
      
      /* Barra de progresso */
      .progress-bar-container { 
        height: 8px; 
        background-color: #f3f4f6; 
        border-radius: 4px; 
        overflow: hidden; 
        margin: 0 auto; 
        width: 80%; 
        max-width: 300px; 
      }
      
      .progress-bar { 
        height: 100%; 
        background-color: var(--benetrip-orange); 
        border-radius: 4px; 
        transition: width 0.3s ease; 
      }
      
      /* Botão de seleção fixo */
      .botao-selecao-fixo { 
        position: fixed; 
        bottom: 0; 
        left: 0; 
        right: 0; 
        padding: 8px 16px; 
        background-color: white; 
        border-top: 1px solid #e5e7eb; 
        z-index: 40;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
      }
      
      .btn-selecionar-voo { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        width: 100%; 
        padding: 12px 16px; 
        background-color: var(--benetrip-orange); 
        color: white; 
        border-radius: 6px; 
        font-weight: bold; 
        transition: all 0.2s; 
      }
      
      .btn-selecionar-voo:hover { 
        background-color: #d06a1c; 
      }
      
      /* Sistema de toast */
      .toast-container { 
        position: fixed; 
        bottom: 80px; 
        left: 0; 
        right: 0; 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        z-index: 50; 
        pointer-events: none; 
      }
      
      .toast { 
        padding: 8px 16px; 
        border-radius: 4px; 
        background-color: rgba(0, 0, 0, 0.7); 
        color: white; 
        margin-bottom: 8px; 
        transform: translateY(20px); 
        opacity: 0; 
        transition: all 0.3s ease; 
        max-width: 80%; 
        text-align: center; 
      }
      
      .toast-visible { 
        transform: translateY(0); 
        opacity: 1; 
      }
      
      .toast-success { background-color: rgba(22, 163, 74, 0.9); }
      .toast-warning { background-color: rgba(234, 88, 12, 0.9); }
      .toast-error { background-color: rgba(220, 38, 38, 0.9); }
      
      /* Dica de swipe */
      .swipe-hint { 
        position: fixed; 
        bottom: 60px; 
        left: 0; 
        right: 0; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        background-color: rgba(0, 0, 0, 0.7); 
        color: white; 
        padding: 8px 16px; 
        z-index: 30; 
        opacity: 1; 
        transition: opacity 0.5s ease; 
        border-radius: 4px;
      }
      
      .swipe-hint-arrow { 
        animation: arrow-bounce 1s infinite; 
        display: inline-block; 
      }
      
      @keyframes arrow-bounce { 
        0%, 100% { transform: translateX(0); } 
        50% { transform: translateX(-3px); } 
      }
      
      .swipe-hint-arrow:last-child { 
        animation: arrow-bounce-right 1s infinite; 
      }
      
      @keyframes arrow-bounce-right { 
        0%, 100% { transform: translateX(0); } 
        50% { transform: translateX(3px); } 
      }
      
      /* Elementos de UI adicionais */
      .view-selector {
        background-color: #fff;
      }
      
      .view-btn {
        transition: all 0.2s ease;
        color: #666;
      }
      
      .view-btn-active {
        background-color: var(--benetrip-orange);
        color: white;
        font-weight: 500;
      }
      
      .pagination-info {
        font-size: 0.8rem;
      }
      
      .pagination-dots {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      
      .pagination-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #ccc;
        margin: 0 3px;
      }
      
      .pagination-dot.active {
        background-color: var(--benetrip-orange);
        width: 10px;
        height: 10px;
      }
      
      .nav-btn {
        transition: all 0.2s ease;
      }
      
      .nav-btn:hover {
        background-color: #e0e0e0;
      }
      
      .nav-controls {
        margin-top: 8px;
      }
      
      .card-index {
        z-index: 1;
        opacity: 0.8;
      }
      
      .btn-select-voo {
        transition: all 0.2s ease;
      }
      
      .btn-select-voo:hover {
        background-color: var(--benetrip-blue);
        color: white;
      }
      
      .load-more-btn {
        transition: all 0.2s ease;
      }
      
      .load-more-btn:hover {
        background-color: #dbeafe;
      }
      
      /* Melhorias para acessibilidade */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }
      
      /* Otimização para dispositivos de baixo desempenho */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      }
    `;
    
    document.head.appendChild(styleElement);
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
    this.renderizarInterface();
    
    // Reporta o erro
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
      // Limitado a 10 erros para não sobrecarregar o localStorage
      const erros = JSON.parse(localStorage.getItem('benetrip_erros') || '[]');
      erros.push(dadosErro);
      
      // Mantém apenas os 10 erros mais recentes
      if (erros.length > 10) erros.shift();
      
      localStorage.setItem('benetrip_erros', JSON.stringify(erros));
    } catch (e) {
      console.error("Erro ao salvar log de erro:", e);
    }
  }

}; // Fim do objeto BENETRIP_VOOS

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('voos-container')) {
    console.log('Inicializando módulo de voos Benetrip (v3.0.0)...');
    BENETRIP_VOOS.init();
  }
});

// Listener visibilitychange para pausar/retomar polling quando aba fica em background
document.addEventListener('visibilitychange', () => {
  if (document.getElementById('voos-container') && BENETRIP_VOOS) {
    if (document.visibilityState === 'hidden') {
      // Pausa o polling quando aba está em background
      if (BENETRIP_VOOS.isPolling) {
        console.log('Aba em background: pausando polling...');
        clearInterval(BENETRIP_VOOS.pollingIntervalId);
        BENETRIP_VOOS.pollingIntervalId = null;
      }
    } else if (document.visibilityState === 'visible') {
      // Retoma o polling quando aba volta ao primeiro plano
      if (BENETRIP_VOOS.isPolling && !BENETRIP_VOOS.pollingIntervalId) {
        console.log('Aba voltou ao primeiro plano: retomando polling...');
        BENETRIP_VOOS.pollingIntervalId = setInterval(
          () => BENETRIP_VOOS.verificarResultadosPolling(), 
          BENETRIP_VOOS.POLLING_INTERVAL_MS
        );
        // Executa imediatamente uma vez
        BENETRIP_VOOS.verificarResultadosPolling();
      }
    }
  }
});

// Listener de erro global para capturar erros não tratados
window.addEventListener('error', (event) => {
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
});

// Tratamento para erros de promessas não capturadas
window.addEventListener('unhandledrejection', (event) => {
  console.error('Promessa não tratada:', event.reason);
  
  if (document.getElementById('voos-container') && BENETRIP_VOOS) {
    BENETRIP_VOOS.reportarErro({
      tipo: 'promessa_nao_tratada',
      mensagem: event.reason?.message || 'Erro em promessa',
      timestamp: new Date().toISOString()
    });
  }
});
