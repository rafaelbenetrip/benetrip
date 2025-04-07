/**
 * BENETRIP - Módulo de Busca e Exibição de Voos
 * Versão 2.5.1 - Processamento de Chunk Refinado (Integrado)
 * Este módulo gerencia a busca de voos: inicia a busca, aguarda,
 * faz polling buscando chunks de resultados e os acumula até o fim.
 */

// Módulo de Voos do Benetrip
const BENETRIP_VOOS = {
  // --- Constantes ---
  INITIAL_WAIT_MS: 5000,   // Tempo de espera inicial ANTES de começar o polling (5 segundos)
  POLLING_INTERVAL_MS: 3000, // Intervalo entre chamadas de polling (3 segundos)
  MAX_POLLING_ATTEMPTS: 40,  // Máximo de tentativas de polling (após espera inicial ~2 min total)
  TIMEOUT_MS: 125000,      // Timeout total para busca (inclui espera inicial + polling)

  // --- Dados e Estado ---
  destino: null,
  searchId: null,          // ID da busca retornado pelo backend
  currencyRates: null,     // Taxas de câmbio (se retornadas)

  // Estado do Polling e Resultados Acumulados
  estaCarregando: true,    // Estado geral de carregamento
  isPolling: false,        // Indica se o polling está ativo
  pollingAttempts: 0,      // Contador de tentativas de polling
  pollingIntervalId: null, // ID do intervalo do polling
  initialWaitTimeoutId: null, // ID do timeout da espera inicial
  timeoutId: null,         // ID do timeout global da busca

  // Acumuladores para chunks
  accumulatedProposals: [],
  accumulatedAirlines: {},
  accumulatedAirports: {},
  accumulatedGatesInfo: {},
  accumulatedMeta: {},
  finalResults: null, // Objeto final montado após acumular tudo

  // Estado de Erro
  temErro: false,
  mensagemErro: '',

  // Estado de Seleção e Navegação
  vooSelecionado: null,
  vooAtivo: null,          // Para navegação entre voos
  indexVooAtivo: 0,
  hammerInstance: null,    // Instância do Hammer.js para swipe

  // --- Inicialização ---
  init() {
    console.log('Inicializando sistema de busca de voos v2.5.1 (Chunk Processing Refined - Integrated)...');
    this.resetState(); // Garante que o estado está limpo
    this.configurarEventos();

    if (!document.getElementById('toast-container')) {
      const toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }

    this.carregarDestino()
      .then(() => {
        this.iniciarBuscaVoos();
      })
      .catch(erro => {
        console.error('Erro crítico ao carregar destino:', erro);
        this.mostrarErro('Não foi possível carregar informações do destino. Por favor, retorne e selecione o destino novamente.');
      });

    this.aplicarEstilosModernos();
    this.renderizarInterface(); // Renderiza o estado inicial (carregando)
  },

  // Reseta o estado da busca e resultados acumulados
  resetState() {
      // this.resultados = null; // Removido, usar finalResults
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
  },


  // --- Configurar eventos ---
  configurarEventos() {
    // Delegação de evento global
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
        window.location.reload(); // Recarrega a página para reiniciar
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
       // Usa finalResults agora
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
          // Verifica se há voos para selecionar
          if(this.finalResults && this.finalResults.proposals && this.finalResults.proposals.length > 0) {
            this.exibirToast('Deslize e escolha um voo primeiro', 'warning');
          } else if (!this.estaCarregando) {
            this.exibirToast('Nenhum voo disponível para selecionar.', 'info');
          }
        }
        return;
      }
    });

    // Listener de teclas para navegação
    document.addEventListener('keydown', (e) => {
      // Usa finalResults
      if (this.finalResults && this.finalResults.proposals && this.finalResults.proposals.length > 0) {
        if (e.key === 'ArrowRight') { this.proximoVoo(); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { this.vooAnterior(); e.preventDefault(); }
        else if (e.key === 'Enter') { this.selecionarVooAtivo(); e.preventDefault(); }
      }
    });
  },

  // --- Carregar dados do destino selecionado ---
  async carregarDestino() {
    // (Mantido como na versão anterior completa)
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

  // Método para extrair IATA de texto (backup)
  extrairCodigoIATA(texto) {
    // (Mantido)
    if (!texto || typeof texto !== 'string') return null;
    const match = texto.match(/\(([A-Z]{3})\)/);
    if (match && match[1]) return match[1];
    const mapeamento = {'paris': 'CDG', 'londres': 'LHR', 'são paulo': 'GRU', 'rio de janeiro': 'GIG', 'miami': 'MIA', 'orlando': 'MCO', 'madri': 'MAD', 'madrid': 'MAD', 'barcelona': 'BCN', 'roma': 'FCO', 'lisboa': 'LIS', 'tóquio': 'HND', 'tokyo': 'HND', 'berlim': 'BER', 'sydney': 'SYD', 'cidade do méxico': 'MEX'};
    const textoLower = texto.toLowerCase();
    for (const [cidade, codigo] of Object.entries(mapeamento)) {
        if (textoLower.includes(cidade)) return codigo;
    }
    return null;
  },

  // --- Iniciar Busca de Voos ---
  async iniciarBuscaVoos() {
    // (Mantido como na versão anterior completa)
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
        locale: "en" // Usa 'en'
      };

      const validacao = this.validarDadosParaBusca(params);
      if (!validacao.valido) throw new Error(`Dados inválidos: ${validacao.mensagens.join(", ")}`);

      console.log('Iniciando busca com parâmetros:', params);
      this.resetState();
      this.estaCarregando = true;
      this.atualizarProgresso('Iniciando busca de voos...', 10);
      this.renderizarInterface();

      this.timeoutId = setTimeout(() => {
        if (this.estaCarregando) {
          this.pararPolling();
          this.mostrarErro('A busca demorou mais que o esperado.');
        }
      }, this.TIMEOUT_MS);

      const resposta = await fetch('/api/flight-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const dados = await resposta.json().catch(async () => {
          const textError = await resposta.text();
          throw new Error(`Resposta não JSON (${resposta.status}): ${textError.substring(0,150)}`);
      });

      if (!resposta.ok || (resposta.status === 202 && !dados.search_id)) {
         throw new Error(dados.error || dados.details?.error || dados.message || `Erro ${resposta.status} ao iniciar.`);
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
      this.mostrarErro(erro.message);
    }
  },

  validarDadosParaBusca(params) {
    // (Mantido)
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

  // --- Gerenciamento do Polling (Frontend com Chunks) ---
  iniciarPollingFrontend() {
    // (Mantido)
    console.log(`Iniciando polling para searchId: ${this.searchId}`);
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
    if (this.initialWaitTimeoutId) { clearTimeout(this.initialWaitTimeoutId); this.initialWaitTimeoutId = null; }

    this.isPolling = true;
    this.pollingAttempts = 0;
    this.atualizarProgresso('Procurando as melhores conexões...', 20);

    this.pollingIntervalId = setInterval(() => this.verificarResultadosPolling(), this.POLLING_INTERVAL_MS);
    this.verificarResultadosPolling();
  },

  pararPolling() {
    // (Mantido)
    console.log('Parando polling e timeouts.');
    if (this.pollingIntervalId) { clearInterval(this.pollingIntervalId); this.pollingIntervalId = null; }
    if (this.initialWaitTimeoutId) { clearTimeout(this.initialWaitTimeoutId); this.initialWaitTimeoutId = null; }
    if (this.timeoutId) { clearTimeout(this.timeoutId); this.timeoutId = null; }
    this.isPolling = false;
  },

  // --- verificarResultadosPolling ATUALIZADO ---
  // Função principal de polling com lógica refinada para processar chunks
  async verificarResultadosPolling() {
    if (!this.isPolling) return;

    this.pollingAttempts++;
    console.log(`Polling Chunks: Tentativa ${this.pollingAttempts}/${this.MAX_POLLING_ATTEMPTS}`);

    // Atualiza UI (mantido)
    const mensagens = ['Buscando voos...', 'Verificando tarifas...', 'Analisando conexões...', 'Consultando Cias...', 'Quase lá...'];
    const msgIdx = Math.min(Math.floor(this.pollingAttempts / (this.MAX_POLLING_ATTEMPTS / mensagens.length)), mensagens.length - 1);
    const progresso = 20 + Math.min(75, (this.pollingAttempts / this.MAX_POLLING_ATTEMPTS) * 75);
    this.atualizarProgresso(`${mensagens[msgIdx]} (${this.pollingAttempts})`, progresso);

    // Verifica limite (mantido)
    if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS) {
      this.pararPolling();
      // Se acumulou algo, mostra. Senão, mostra erro.
      if (this.accumulatedProposals.length > 0) {
          console.warn("Polling atingiu limite de tentativas, finalizando com resultados parciais.");
          this.finalizarBuscaComResultadosAcumulados("Limite de tempo atingido, mostrando melhores opções encontradas.");
      } else {
          this.mostrarErro('A busca demorou mais que o esperado.');
      }
      return;
    }

    try {
      // Chama o backend (proxy)
      const resposta = await fetch(`/api/flight-results?uuid=${this.searchId}`);

      // --- Processamento da Resposta (Chunk) ---
      if (!resposta.ok) {
          const errorData = await resposta.json().catch(() => ({ error: `Erro ${resposta.status} (resposta não JSON)` }));
          const errorMessage = errorData.error || `Erro ${resposta.status}.`;
          console.error(`Erro no polling (HTTP ${resposta.status}):`, errorMessage, errorData);
          if (resposta.status === 404) { this.pararPolling(); this.mostrarErro('Busca expirou ou inválida.'); }
          // Para outros erros, continua tentando (a menos que perto do limite)
          else if (this.pollingAttempts >= this.MAX_POLLING_ATTEMPTS) { this.pararPolling(); this.mostrarErro(errorMessage); }
          return;
      }

      const chunkData = await resposta.json();
      console.log(`Chunk recebido (Tentativa ${this.pollingAttempts}):`, chunkData);

      // --- Lógica Refinada para Encontrar o Objeto Principal ---
      let chunkObject = null;
      let isFinalChunk = false; // Flag para indicar se este chunk é o último

      if (Array.isArray(chunkData)) {
          // Procura o objeto principal que contém 'search_id' e 'proposals'
          chunkObject = chunkData.find(item =>
              item && typeof item === 'object' && item.search_id === this.searchId && item.hasOwnProperty('proposals')
          );

          if (chunkObject) {
              console.log("Objeto principal do chunk encontrado dentro do array:", chunkObject);
              // Verifica se ESTE objeto principal indica o fim (proposals vazio)
              if (Array.isArray(chunkObject.proposals) && chunkObject.proposals.length === 0) {
                  isFinalChunk = true;
              }
          } else {
              // Se não achou o objeto principal no array, pode ser um chunk intermediário
              // ou um array de outro tipo. Loga e continua.
              console.warn(`Array recebido, mas objeto principal com search_id ${this.searchId} e proposals não encontrado.`, chunkData);
          }
      } else if (chunkData && typeof chunkData === 'object') {
          // Se não for array, verifica se é o objeto principal ou a resposta "ainda buscando"
          if (chunkData.search_id === this.searchId && chunkData.hasOwnProperty('proposals')) {
              chunkObject = chunkData;
              console.log("Chunk recebido como objeto único:", chunkObject);
              if (Array.isArray(chunkObject.proposals) && chunkObject.proposals.length === 0) {
                  isFinalChunk = true;
              }
          } else if (Object.keys(chunkData).length === 1 && chunkData.search_id === this.searchId) {
              console.log('Busca ainda em andamento (resposta apenas com search_id)...');
              // Continua polling, não processa este chunk
              return;
          } else {
              console.warn(`Objeto recebido, mas não é o objeto principal esperado ou search_id não confere.`, chunkData);
          }
      } else {
          console.warn("Chunk recebido com status 200 mas formato inesperado.", chunkData);
          return; // Continua polling
      }

      // --- Processa o chunkObject SE encontrado ---
      if (chunkObject) {
          // Acumula metadados SEMPRE que um chunk principal for encontrado
          const { proposals: proposalsInChunk, airlines: airlinesInChunk, airports: airportsInChunk, gates_info: gatesInfoInChunk, meta: metaInChunk, ...restOfChunkObject } = chunkObject;

          if (airlinesInChunk) Object.assign(this.accumulatedAirlines, airlinesInChunk);
          if (airportsInChunk) Object.assign(this.accumulatedAirports, airportsInChunk);
          if (gatesInfoInChunk) Object.assign(this.accumulatedGatesInfo, gatesInfoInChunk);
          // Acumula/sobrescreve meta (pega o mais recente)
          if (metaInChunk) this.accumulatedMeta = { ...this.accumulatedMeta, ...metaInChunk };

          // Acumula propostas APENAS se não for o chunk final
          if (!isFinalChunk && proposalsInChunk && Array.isArray(proposalsInChunk) && proposalsInChunk.length > 0) {
              this.accumulatedProposals.push(...proposalsInChunk);
              console.log(`Acumuladas ${this.accumulatedProposals.length} propostas. Esperando próximo chunk...`);
          } else if (!isFinalChunk) {
              // Recebeu chunk principal mas proposals não é array ou está vazio (inesperado antes do fim)
              console.warn("Chunk principal recebido sem propostas válidas antes do chunk final.", chunkObject);
          }
      } else {
         // Nenhum objeto principal encontrado neste chunk, apenas continua o polling
         console.log(`Nenhum objeto de dados principal encontrado na tentativa ${this.pollingAttempts}. Continuando polling...`);
      }

      // --- Verifica se é o FIM (flag isFinalChunk) ---
      if (isFinalChunk) {
          console.log(`Polling concluído! (Chunk final com proposals vazio recebido na tentativa ${this.pollingAttempts})`);
          this.finalizarBuscaComResultadosAcumulados("Busca finalizada.");
      }
      // Se não for final, o setInterval continua o loop

    } catch (erro) {
      console.error('Erro durante o polling ou processamento do chunk:', erro);
      if (this.pollingAttempts >= this.MAX_POLLING_ATTEMPTS) {
          this.pararPolling();
          this.mostrarErro('Erro ao verificar resultados. Verifique sua conexão.');
      }
      // Continua tentando mesmo com erro, a menos que perto do limite
    }
  },

  // Função auxiliar para finalizar a busca e renderizar
  finalizarBuscaComResultadosAcumulados(mensagemFinal = "Busca finalizada.") {
      this.pararPolling();
      this.estaCarregando = false;
      this.atualizarProgresso(mensagemFinal, 100);

      // Monta o objeto final de resultados
      this.finalResults = {
          proposals: this.accumulatedProposals, // Usa as propostas acumuladas
          airlines: this.accumulatedAirlines,
          airports: this.accumulatedAirports,
          gates_info: this.accumulatedGatesInfo,
          meta: this.accumulatedMeta,
          search_id: this.searchId
          // Poderia adicionar segments/market do último chunk aqui se necessário
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
      this.renderizarInterface(); // Renderiza com os resultados finais
  },


  preprocessarPropostas(propostas) {
      if (!propostas || !Array.isArray(propostas)) return [];
      console.log(`Pré-processando ${propostas.length} propostas acumuladas...`);
      propostas.sort((a, b) => this.obterPrecoVoo(a) - this.obterPrecoVoo(b));
      return propostas.map((proposta, index) => {
          proposta._melhorPreco = (index === 0);
          const precoAtual = this.obterPrecoVoo(proposta);
          // Simulação de economia mais realista (evita > 100%)
          const economiaSimulada = Math.random() * 0.3; // até 30%
          const precoMedio = precoAtual / (1 - economiaSimulada);
          proposta._economia = Math.max(0, Math.min(95, Math.round(economiaSimulada * 100))); // Limita a 95%
          proposta._assentosDisponiveis = Math.floor(Math.random() * 8) + 1;
          return proposta;
      });
  },

  // --- Renderização (Mantida a estrutura, usa this.finalResults) ---
  atualizarProgresso(mensagem, porcentagem) { /* ... (mantido) ... */ },
  renderizarInterface() { /* ... (mantido, usa this.finalResults) ... */ },
  renderizarHeader(container) { /* ... (mantido) ... */ },
  renderizarCarregamento(container) { /* ... (mantido) ... */ },
  renderizarErro(container) { /* ... (mantido) ... */ },
  renderizarSemResultados(container) { /* ... (mantido) ... */ },
  renderizarResumoViagem(container) { /* ... (mantido) ... */ },
  renderizarListaVoos(container) { /* ... (mantido, usa this.finalResults) ... */ },
  criarCardVoo(voo, index) { /* ... (mantido, usa this.finalResults) ... */ },
  renderizarParadas(paradas) { /* ... (mantido) ... */ },
  renderizarBotaoSelecao(container) { /* ... (mantido) ... */ },
  renderizarSwipeHint(container) { /* ... (mantido, usa this.finalResults) ... */ },

  // --- Métodos de Formatação e Extração (Mantidos, usam this.finalResults ou this.accumulated*) ---
  formatarPreco(preco, moeda = 'BRL') { /* ... (mantido) ... */ },
  formatarData(data) { /* ... (mantido) ... */ },
  formatarDuracao(duracaoMinutos) { /* ... (mantido) ... */ },
  obterPrecoVoo(voo) { /* ... (mantido) ... */ },
  obterCompanhiasAereas(voo) { /* ... (mantido, usa this.accumulatedAirlines) ... */ },
  obterInfoSegmento(segmento) { /* ... (mantido) ... */ },

  // --- Navegação e Interação (Mantidas, usam this.finalResults) ---
  proximoVoo() { /* ... (mantido, usa this.finalResults) ... */ },
  vooAnterior() { /* ... (mantido, usa this.finalResults) ... */ },
  atualizarVooAtivo() { /* ... (mantido, usa this.finalResults) ... */ },
  selecionarVoo(vooId) { /* ... (mantido, usa this.finalResults) ... */ },
  exibirToast(mensagem, tipo = 'info') { /* ... (mantido) ... */ },
  selecionarVooAtivo() { /* ... (mantido) ... */ },
  mostrarDetalhesVoo(vooId) { /* ... (mantido, usa this.finalResults) ... */ },
  renderizarTimelineVoos(voos) { /* ... (mantido, usa this.accumulatedAirlines) ... */ },
  mostrarConfirmacaoSelecao(voo) { /* ... (mantido, usa this.finalResults) ... */ },

  // --- Métodos Auxiliares (Mantidos) ---
  carregarDadosUsuario() { /* ... (mantido) ... */ },
  obterCodigoIATAOrigem(dadosUsuario) { /* ... (mantido) ... */ },
  obterDatasViagem() { /* ... (mantido) ... */ },
  obterQuantidadePassageiros() { /* ... (mantido) ... */ },
  configurarEventosAposRenderizacao() { /* ... (mantido) ... */ },
  atualizarVooAtivoBaseadoNoScroll(swipeContainer) { /* ... (mantido, usa this.finalResults) ... */ },

  // --- Estilos e UI (Mantidos) ---
  aplicarEstilosModernos() { /* ... (mantido) ... */ },
  mostrarErro(mensagem) { /* ... (mantido) ... */ },
  reportarErro(dadosErro) { /* ... (mantido) ... */ }

}; // Fim do objeto BENETRIP_VOOS

// Inicializar (mantido)
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('voos-container')) {
    console.log('Inicializando módulo de voos Benetrip (v2.5.1)...');
    BENETRIP_VOOS.init();
  }
});
// Listeners de visibilitychange e erro global (mantidos)
// ...

