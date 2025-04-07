/**
 * BENETRIP - Módulo de Busca e Exibição de Voos
 * Versão 2.5.1 - Correção no Processamento de Chunks
 */

// Módulo de Voos do Benetrip
const BENETRIP_VOOS = {
  // --- Constantes ---
  INITIAL_WAIT_MS: 5000,
  POLLING_INTERVAL_MS: 3000,
  MAX_POLLING_ATTEMPTS: 40,
  TIMEOUT_MS: 125000,

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

  // --- Inicialização ---
  init() {
    console.log('Inicializando sistema de busca de voos v2.5.1 (Chunk Processing Fix)...');
    this.resetState();
    this.configurarEventos();
    if (!document.getElementById('toast-container')) {
      const toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    this.carregarDestino()
      .then(() => this.iniciarBuscaVoos())
      .catch(erro => this.mostrarErro('Erro ao carregar destino. Tente selecionar novamente.'));
    this.aplicarEstilosModernos();
    this.renderizarInterface();
  },

  resetState() {
      this.destino = null; // Adicionado para garantir limpeza
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
          this.exibirToast('Deslize e escolha um voo primeiro', 'warning');
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

    // Atualiza UI (mantido)
    const mensagens = ['Buscando voos...', 'Verificando tarifas...', 'Analisando conexões...', 'Consultando Cias...', 'Quase lá...'];
    const msgIdx = Math.min(Math.floor(this.pollingAttempts / (this.MAX_POLLING_ATTEMPTS / mensagens.length)), mensagens.length - 1);
    const progresso = 20 + Math.min(75, (this.pollingAttempts / this.MAX_POLLING_ATTEMPTS) * 75);
    this.atualizarProgresso(`${mensagens[msgIdx]} (${this.pollingAttempts})`, progresso);

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
                  // Nota: As propostas de outros itens do array já foram acumuladas acima
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
    const bar = document.querySelector('.progress-bar');
    const text = document.querySelector('.loading-text');
    if (bar) { bar.style.width = `${porcentagem}%`; bar.setAttribute('aria-valuenow', porcentagem); }
    if (text) { text.textContent = mensagem; }
  },

  renderizarInterface() {
    try {
      const container = document.getElementById('voos-container');
      if (!container) { console.error('Container não encontrado'); return; }

      const headerExistente = container.querySelector('.app-header');
      container.innerHTML = '';
      if (headerExistente) container.appendChild(headerExistente);
      else this.renderizarHeader(container);

      if (this.estaCarregando) {
        this.renderizarCarregamento(container);
      } else if (this.temErro) {
        this.renderizarErro(container);
      } else if (!this.finalResults || !this.finalResults.proposals || this.finalResults.proposals.length === 0) {
        this.renderizarSemResultados(container);
      } else {
        const mainContent = document.createElement('main');
        mainContent.className = 'voos-content';
        container.appendChild(mainContent);

        this.renderizarResumoViagem(mainContent);
        this.renderizarListaVoos(mainContent);
        this.renderizarBotaoSelecao(container);

        if (!container.querySelector('#swipe-hint')) this.renderizarSwipeHint(container);
        this.configurarEventosAposRenderizacao();

        // Seleciona primeiro voo
        const primeiroVoo = this.finalResults.proposals[0];
        if (primeiroVoo) {
          this.vooAtivo = primeiroVoo;
          this.indexVooAtivo = 0;
          this.atualizarVooAtivo();
        }
      }
    } catch (erro) {
      console.error('Erro ao renderizar interface:', erro);
       if (container) {
           container.innerHTML = '';
           this.renderizarHeader(container);
           this.mensagemErro = 'Ocorreu um erro ao exibir os voos.';
           this.renderizarErro(container);
       }
    }
  },

  renderizarHeader(container) {
    if (container.querySelector('.app-header')) return;
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `<button class="btn-voltar" aria-label="Voltar"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg><span class="sr-only">Voltar</span></button><h1>Voos Disponíveis</h1>`;
    container.insertBefore(header, container.firstChild);
    const btnVoltar = header.querySelector('.btn-voltar');
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            if (this.finalResults?.proposals?.length > 0 && !this.estaCarregando) {
                 if (confirm('Tem certeza? Você perderá os resultados.')) window.location.href = 'destinos.html';
            } else { window.location.href = 'destinos.html'; }
        });
    }
  },

  renderizarCarregamento(container) {
    if (container.querySelector('.loading-container')) return;
    const loadingImage = 'assets/images/tripinha/loading.gif';
    const loading = document.createElement('div');
    loading.className = 'loading-container';
    loading.innerHTML = `<div style="text-align: center; padding: 2rem 0;"><img src="${loadingImage}" alt="Tripinha carregando" class="loading-avatar" style="width: 100px; height: 100px; margin: 0 auto;" /><div class="loading-text" style="margin: 1rem 0;">Iniciando busca...</div><div class="progress-bar-container"><div class="progress-bar" role="progressbar" style="width: 10%;" aria-valuenow="10" aria-valuemin="0" aria-valuemax="100"></div></div><div class="loading-tips" style="margin-top: 1.5rem; font-size: 0.9rem; color: #666;"><p>💡 Dica: Preços mudam, reserve logo!</p></div></div>`;
    container.appendChild(loading);
    this.atualizarProgresso(document.querySelector('.loading-text')?.textContent || 'Buscando...', parseFloat(document.querySelector('.progress-bar')?.style.width || '10'));
    
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
      setInterval(() => {
        dicaIndex = (dicaIndex + 1) % dicas.length;
        dicasEl.innerHTML = `<p>${dicas[dicaIndex]}</p>`;
      }, 5000);
    }
  },

  renderizarErro(container) {
    const loading = container.querySelector('.loading-container'); if (loading) loading.remove();
    const erroDiv = document.createElement('div'); erroDiv.className = 'erro-container';
    erroDiv.innerHTML = `<div class="bg-red-100 text-red-700 p-4 rounded-lg my-4 text-center"><div class="mb-3"><img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="w-20 h-20 mx-auto" /></div><p class="font-bold">${this.mensagemErro || 'Ocorreu um erro.'}</p><p class="mt-2 text-sm">Desculpe. Tente novamente?</p><button class="btn-tentar-novamente mt-4 px-4 py-2 bg-red-600 text-white rounded">Tentar Novamente</button></div>`;
    container.appendChild(erroDiv);
  },

  renderizarSemResultados(container) {
    const loading = container.querySelector('.loading-container'); if (loading) loading.remove();
    const semResultados = document.createElement('div'); semResultados.className = 'sem-resultados-container';
    semResultados.innerHTML = `<div class="bg-blue-50 p-4 rounded-lg my-4 text-center"><div class="mb-3"><img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="w-20 h-20 mx-auto" /></div><p class="font-bold">Ops! Não encontramos voos para ${this.destino?.destino || 'este destino'}.</p><p class="mt-2 text-sm">Tente outras datas ou destino.</p><div class="flex gap-3 mt-4"><button class="btn-secundario flex-1 py-2 px-4 border rounded">Mudar Datas</button><button class="btn-principal flex-1 py-2 px-4 text-white rounded" style="background-color: #E87722;">Outro Destino</button></div></div>`;
    container.appendChild(semResultados);
  },

  renderizarResumoViagem(container) {
    const resumo = document.createElement('div'); resumo.className = 'viagem-resumo p-4 bg-white border-b';
    const destino = this.destino; const dataViagem = this.obterDatasViagem(); const passageiros = this.obterQuantidadePassageiros();
    resumo.innerHTML = `<h2 class="text-lg font-bold mb-2">Sua Viagem</h2><div class="flex items-center justify-between"><div class="flex items-center"><div class="bg-blue-50 p-1 rounded mr-2"><span class="text-lg">✈️</span></div><div><p class="font-medium">${destino?.destino || ''}, ${destino?.pais || ''}</p><p class="text-sm text-gray-600">${dataViagem}</p></div></div><div class="text-sm text-right"><span class="bg-gray-100 px-2 py-1 rounded">${passageiros} pas.</span></div></div>`;
    container.appendChild(resumo);
  },

  renderizarListaVoos(container) {
    const listaVoos = document.createElement('div');
    listaVoos.className = 'voos-lista';
    listaVoos.id = 'voos-lista';

    const voos = this.finalResults?.proposals || [];

    const header = document.createElement('div');
    header.className = 'voos-header p-3 bg-gray-50 border-b';
    header.innerHTML = `<div class="flex justify-between items-center"><h3 class="font-medium">${voos.length} ${voos.length === 1 ? 'voo encontrado' : 'voos encontrados'}</h3><div class="flex items-center"><span class="text-sm text-gray-600 mr-2">Por preço</span><span class="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">↑ Baratos</span></div></div>`;
    listaVoos.appendChild(header);

    const voosContainer = document.createElement('div');
    voosContainer.className = 'voos-swipe-container';
    voosContainer.id = 'voos-swipe-container';
    listaVoos.appendChild(voosContainer);

    voos.forEach((voo, index) => {
      const cardVoo = this.criarCardVoo(voo, index);
      voosContainer.appendChild(cardVoo);
    });

    container.appendChild(listaVoos);
  },

  criarCardVoo(voo, index) {
    const cardVoo = document.createElement('div');
    cardVoo.className = 'voo-card p-4 bg-white border-b';
    const vooId = voo.sign || `voo-idx-${index}`;
    cardVoo.dataset.vooId = vooId;
    cardVoo.dataset.vooIndex = index;

    const preco = this.obterPrecoVoo(voo);
    const moeda = this.finalResults?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    const infoIda = this.obterInfoSegmento(voo.segment?.[0]);
    const infoVolta = voo.segment?.length > 1 ? this.obterInfoSegmento(voo.segment[1]) : null;
    const economiaPercentual = voo._economia || 0;
    const isMelhorPreco = voo._melhorPreco || index === 0;
    const tagMelhorPreco = isMelhorPreco ? `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full absolute top-2 right-2">Melhor preço</span>` : '';

    if (infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0)) cardVoo.classList.add('voo-direto');

    cardVoo.innerHTML = `
        <div class="relative"> ${tagMelhorPreco} <div class="flex justify-between items-start mb-4"> <div> <span class="text-xl font-bold">${precoFormatado}</span> ${economiaPercentual > 0 ? `<span class="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded ml-1">-${economiaPercentual}%</span>` : ''} <p class="text-xs text-gray-500">Por pessoa, ida${infoVolta ? ' e volta' : ''}</p> </div> <div class="flex items-center"> <span class="text-xs bg-gray-100 px-2 py-1 rounded">${this.obterCompanhiasAereas(voo)}</span> </div> </div> </div>
        <div class="border-t pt-3"> <div class="mb-4"> <div class="flex justify-between items-center text-sm"><span class="font-medium">IDA</span><span class="text-xs text-gray-500">${this.formatarData(infoIda?.dataPartida)}</span></div> <div class="flex items-center justify-between mt-2"> <div class="text-center"><p class="font-bold">${infoIda?.horaPartida}</p><p class="text-xs text-gray-600">${infoIda?.aeroportoPartida}</p></div> <div class="flex-1 px-2"> <div class="text-xs text-center text-gray-500">${this.formatarDuracao(infoIda?.duracao)}</div> <div class="flight-line relative"><div class="border-t border-gray-300 my-2"></div><div class="flight-stops absolute inset-x-0 top-1/2 flex justify-center -mt-1">${this.renderizarParadas(infoIda?.paradas)}</div></div> <div class="text-xs text-center text-gray-500">${infoIda?.paradas ?? 0} ${infoIda?.paradas === 1 ? 'parada' : 'paradas'}</div> </div> <div class="text-center"><p class="font-bold">${infoIda?.horaChegada}</p><p class="text-xs text-gray-600">${infoIda?.aeroportoChegada}</p></div> </div> </div>
        ${infoVolta ? `<div class="mt-4 pt-3 border-t"> <div class="flex justify-between items-center text-sm"><span class="font-medium">VOLTA</span><span class="text-xs text-gray-500">${this.formatarData(infoVolta?.dataPartida)}</span></div> <div class="flex items-center justify-between mt-2"> <div class="text-center"><p class="font-bold">${infoVolta?.horaPartida}</p><p class="text-xs text-gray-600">${infoVolta?.aeroportoPartida}</p></div> <div class="flex-1 px-2"> <div class="text-xs text-center text-gray-500">${this.formatarDuracao(infoVolta?.duracao)}</div> <div class="flight-line relative"><div class="border-t border-gray-300 my-2"></div><div class="flight-stops absolute inset-x-0 top-1/2 flex justify-center -mt-1">${this.renderizarParadas(infoVolta?.paradas)}</div></div> <div class="text-xs text-center text-gray-500">${infoVolta?.paradas ?? 0} ${infoVolta?.paradas === 1 ? 'parada' : 'paradas'}</div> </div> <div class="text-center"><p class="font-bold">${infoVolta?.horaChegada}</p><p class="text-xs text-gray-600">${infoVolta?.aeroportoChegada}</p></div> </div> </div>` : ''} </div>
        <div class="mt-4 pt-2 border-t flex justify-between"> <button class="btn-detalhes-voo text-sm text-blue-600" data-voo-id="${vooId}">Ver detalhes</button> <div class="flex items-center text-xs text-gray-500"><span class="mr-1">Restam</span><span class="bg-orange-100 text-orange-800 px-1 py-0.5 rounded font-medium">${voo._assentosDisponiveis || '?'}</span></div> </div>
    `;

    // Adiciona tag Voo Direto visualmente
    if (infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0)) {
        const idaContainer = cardVoo.querySelector('.flex-1.px-2');
        if (idaContainer) {
            const flightLine = idaContainer.querySelector('.flight-line');
            const stopsText = idaContainer.querySelector('.text-xs.text-center.text-gray-500:last-child');
            if (flightLine) flightLine.style.display = 'none';
            if (stopsText) stopsText.style.display = 'none';
            const vooDiretoTag = document.createElement('div');
            vooDiretoTag.className = 'text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-center mt-1';
            vooDiretoTag.innerText = 'Voo Direto';
            idaContainer.appendChild(vooDiretoTag);
        }
    }
    return cardVoo;
  },

  renderizarParadas(paradas) {
     const numParadas = paradas ?? 0; 
     if (numParadas === 0) return `<span class="inline-block w-3 h-3 bg-green-500 rounded-full" title="Voo direto"></span>`;
     let html = ''; 
     for (let i = 0; i < Math.min(numParadas, 3); i++) {
         html += `<span class="inline-block w-2 h-2 bg-gray-400 rounded-full mx-1" title="${numParadas} parada${numParadas > 1 ? 's' : ''}"></span>`;
     }
     return html;
  },

  renderizarBotaoSelecao(container) {
    const btnExistente = document.querySelector('.botao-selecao-fixo'); 
    if (btnExistente) btnExistente.remove();
    const botaoFixo = document.createElement('div'); 
    botaoFixo.className = 'botao-selecao-fixo';
    botaoFixo.innerHTML = `<button class="btn-selecionar-voo"><span>Escolher Este Voo</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg></button>`;
    container.appendChild(botaoFixo);
  },

  renderizarSwipeHint(container) {
    const hint = document.createElement('div'); 
    hint.id = 'swipe-hint'; 
    hint.className = 'swipe-hint'; 
    hint.style.display = 'none';
    hint.innerHTML = `<span class="swipe-hint-arrow mr-2">←</span> Arraste para ver outros voos <span class="swipe-hint-arrow ml-2">→</span>`;
    container.appendChild(hint);
    if (this.finalResults?.proposals?.length > 1) {
        hint.style.display = 'flex';
        setTimeout(() => { 
            hint.style.opacity = '0'; 
            setTimeout(() => { hint.style.display = 'none'; }, 1000); 
        }, 4000);
    }
  },

  formatarPreco(preco, moeda = 'BRL') {
    if (typeof preco !== 'number') return 'N/A';
    return new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: moeda, 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    }).format(preco);
  },

  formatarData(data) {
    if (!(data instanceof Date) || isNaN(data)) return 'N/A';
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
    try {
      if (!voo?.terms) return 0;
      const k = Object.keys(voo.terms)[0];
      return voo.terms[k]?.unified_price || voo.terms[k]?.price || 0;
    } catch {
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
          if (codigos.length > 1) return `${info?.name || codigos[0]} +${codigos.length - 1}`;
          return info?.name || codigos[0];
      }
      if (codigos.length > 1) return `${codigos[0]} +${codigos.length - 1}`;
      return codigos[0];
    } catch {
      return 'N/A';
    }
  },

  obterInfoSegmento(segmento) {
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
    } catch {
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
    document.querySelectorAll('.voo-card').forEach(card => card.classList.remove('voo-card-ativo'));
    const cardAtivo = document.querySelector(`.voo-card[data-voo-index="${this.indexVooAtivo}"]`);
    if (cardAtivo) {
      cardAtivo.classList.add('voo-card-ativo');
      cardAtivo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      cardAtivo.classList.add('voo-card-highlight');
      setTimeout(() => cardAtivo.classList.remove('voo-card-highlight'), 500);
    }
    const btnSelecionar = document.querySelector('.btn-selecionar-voo');
    if (btnSelecionar && this.vooAtivo) {
      const preco = this.obterPrecoVoo(this.vooAtivo);
      const moeda = this.finalResults?.meta?.currency || 'BRL';
      btnSelecionar.innerHTML = `<span>Escolher Voo por ${this.formatarPreco(preco, moeda)}</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>`;
    } else if (btnSelecionar) {
        btnSelecionar.innerHTML = `<span>Escolher Este Voo</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>`;
    }
  },

  selecionarVoo(vooId) {
    if (!this.finalResults?.proposals) return;
    const vooEncontrado = this.finalResults.proposals.find((v, index) => (v.sign || `voo-idx-${index}`) === vooId);
    if (!vooEncontrado) { console.error(`Voo ${vooId} não encontrado`); return; }
    this.vooSelecionado = vooEncontrado;
    console.log('Voo selecionado:', this.vooSelecionado);
    const index = this.finalResults.proposals.findIndex((v, idx) => (v.sign || `voo-idx-${idx}`) === vooId);
    if (index !== -1) { this.vooAtivo = vooEncontrado; this.indexVooAtivo = index; }
    document.querySelectorAll('.voo-card').forEach(card => { 
        card.classList.remove('voo-selecionado'); 
        if (card.dataset.vooId === vooId) card.classList.add('voo-selecionado'); 
    });
    this.exibirToast('Voo selecionado! Confirme sua escolha', 'success');
    const btnConfirmar = document.querySelector('.btn-selecionar-voo');
    if (btnConfirmar) {
        btnConfirmar.classList.add('btn-pulsante');
        const preco = this.obterPrecoVoo(this.vooSelecionado);
        const moeda = this.finalResults?.meta?.currency || 'BRL';
        btnConfirmar.innerHTML = `<span>Escolher Voo por ${this.formatarPreco(preco, moeda)}</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>`;
        setTimeout(() => btnConfirmar.classList.remove('btn-pulsante'), 2000);
    }
  },

  exibirToast(mensagem, tipo = 'info') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.innerHTML = mensagem;
    c.appendChild(t);
    setTimeout(() => t.classList.add('toast-visible'), 50);
    setTimeout(() => {
      t.classList.remove('toast-visible');
      setTimeout(() => {
        if (c.contains(t)) c.removeChild(t);
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
    const voo = this.finalResults.proposals.find((v, index) => (v.sign || `voo-idx-${index}`) === vooId);
    if (!voo) { console.error(`Voo ${vooId} não encontrado`); return; }
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
        <div class="flex justify-between items-center mb-4"> <h3 class="text-lg font-bold">Detalhes do Voo</h3> <button id="btn-fechar-detalhes" class="text-gray-500 hover:text-gray-700"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button> </div>
        <div class="border-b pb-3 mb-3"> <div class="flex justify-between items-center"> <div> <p class="text-2xl font-bold">${precoFormatado}</p> <p class="text-sm text-gray-600">Preço por pessoa</p> </div> <div> <p class="font-medium">${this.obterCompanhiasAereas(voo)}</p> <p class="text-sm text-gray-600">${infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0) ? 'Voo direto' : `${(infoIda?.paradas ?? 0) + (infoVolta?.paradas ?? 0)} parada(s)`}</p> </div> </div> </div>
        <div class="mb-4"> <h4 class="font-medium mb-2">Ida (${this.formatarData(infoIda?.dataPartida)})</h4> <div class="voo-timeline">${this.renderizarTimelineVoos(voo.segment?.[0]?.flight || [])}</div> </div>
        ${infoVolta ? `<div class="mt-4 pt-3 border-t"> <h4 class="font-medium mb-2">Volta (${this.formatarData(infoVolta?.dataPartida)})</h4> <div class="voo-timeline">${this.renderizarTimelineVoos(voo.segment?.[1]?.flight || [])}</div> </div>` : ''}
        <div class="mt-4 pt-3 border-t"> <h4 class="font-medium mb-2">Info</h4> <ul class="text-sm space-y-2"> <li class="flex items-start"><span class="text-blue-600 mr-2">✓</span><span>Bagagem de mão (1 peça)</span></li> <li class="flex items-start"><span class="text-blue-600 mr-2">✓</span><span>Refeição a bordo</span></li> <li class="flex items-start text-gray-600"><span class="mr-2">ℹ️</span><span>Bagagem despachada opcional</span></li> </ul> </div>
        <div class="mt-4 pt-3 border-t flex justify-between"> <button id="btn-voltar-detalhes" class="py-2 px-4 border rounded">Voltar</button> <button id="btn-selecionar-este-voo" class="py-2 px-4 text-white rounded" style="background-color: #E87722;">Selecionar Voo</button> </div>
      </div>`;
    document.body.appendChild(modalContainer);
    document.getElementById('btn-fechar-detalhes')?.addEventListener('click', () => modalContainer.remove());
    document.getElementById('btn-voltar-detalhes')?.addEventListener('click', () => modalContainer.remove());
    document.getElementById('btn-selecionar-este-voo')?.addEventListener('click', () => { 
        this.selecionarVoo(vooId); 
        modalContainer.remove(); 
        this.mostrarConfirmacaoSelecao(voo); 
    });
    modalContainer.addEventListener('click', (e) => { if (e.target === modalContainer) modalContainer.remove(); });
  },

  renderizarTimelineVoos(voos) {
    if (!voos || !voos.length) return '<p>N/A</p>';
    let timeline = '';
    voos.forEach((v, i) => {
      const last = i === voos.length - 1;
      const dP = new Date(v.local_departure_timestamp * 1000), dC = new Date(v.local_arrival_timestamp * 1000);
      const hP = dP.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const hC = dC.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      let cInfo = v.marketing_carrier || v.operating_carrier || 'N/A';
      if (this.accumulatedAirlines[cInfo]) cInfo = this.accumulatedAirlines[cInfo].name || cInfo;
      timeline += `<div class="voo-leg mb-3 pb-3 ${!last ? 'border-b border-dashed' : ''}"><div class="flex justify-between mb-2"><div><p class="font-bold">${hP}</p><p class="text-sm">${v.departure}</p></div><div class="text-center flex-1 px-2"><p class="text-xs text-gray-500">${this.formatarDuracao(v.duration)}</p><div class="h-0.5 bg-gray-300 my-2 relative"><div class="absolute -top-1 left-0 w-2 h-2 rounded-full bg-gray-500"></div><div class="absolute -top-1 right-0 w-2 h-2 rounded-full bg-gray-500"></div></div><p class="text-xs">${cInfo}</p></div><div><p class="font-bold">${hC}</p><p class="text-sm">${v.arrival}</p></div></div><div class="text-xs text-gray-600"><p>Voo ${v.marketing_carrier || v.operating_carrier}${v.number}</p><p>Aeronave: ${v.aircraft || 'N/A'}</p></div></div>`;
      if (!last) {
        const prox = voos[i + 1];
        if (prox) {
          const tCon = Math.round((prox.local_departure_timestamp - v.local_arrival_timestamp) / 60);
          timeline += `<div class="conexao-info mb-3 text-sm"><div class="flex items-center text-orange-700"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span class="ml-1">Conexão em ${v.arrival} • ${this.formatarDuracao(tCon)}</span></div></div>`;
        }
      }
    });
    return timeline;
  },

  mostrarConfirmacaoSelecao(voo) {
    document.getElementById('modal-confirmacao')?.remove();
    const preco = this.obterPrecoVoo(voo);
    const moeda = this.finalResults?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    const numPassageiros = this.obterQuantidadePassageiros();
    const precoTotal = preco * numPassageiros;
    const precoTotalFormatado = this.formatarPreco(precoTotal, moeda);
    const modalContainer = document.createElement('div');
    modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modalContainer.id = 'modal-confirmacao';
    modalContainer.innerHTML = `
      <div class="bg-white rounded-lg w-full max-w-md p-4">
        <div class="p-4 rounded-lg" style="background-color: rgba(232, 119, 34, 0.1);">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-orange-100 border-2 border-orange-200"><img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover"></div>
            <div> <p class="font-bold">Ótima escolha! Voo por ${precoFormatado}/pessoa.</p> ${numPassageiros > 1 ? `<div class="mt-2 bg-white bg-opacity-70 p-2 rounded"><p class="text-sm font-medium">Resumo:</p><div class="flex justify-between text-sm"><span>${precoFormatado} × ${numPassageiros} pas.</span><span>${precoTotalFormatado}</span></div></div>` : ''} <div class="mt-3"><label class="flex items-center space-x-2 cursor-pointer"><input type="checkbox" id="confirmar-selecao" class="form-checkbox h-5 w-5 rounded" style="color: #E87722;"><span>Sim, continuar!</span></label></div> <p class="mt-3 text-sm">Valor por pessoa (ida/volta). Próxima etapa: hospedagem.</p> </div>
          </div>
        </div>
        <div class="flex gap-2 mt-4"> <button id="btn-cancelar" class="flex-1 py-2 px-4 border rounded">Voltar</button> <button id="btn-confirmar" class="flex-1 py-2 px-4 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed" style="background-color: #E87722;" disabled>Confirmar</button> </div>
      </div>`;
    document.body.appendChild(modalContainer);
    const chk = document.getElementById('confirmar-selecao');
    const btnC = document.getElementById('btn-confirmar');
    const btnX = document.getElementById('btn-cancelar');
    chk.addEventListener('change', () => { btnC.disabled = !chk.checked; });
    btnX.addEventListener('click', () => { modalContainer.remove(); });
    btnC.addEventListener('click', () => {
        const dadosVoo = { 
            voo: this.vooSelecionado, 
            preco, 
            precoTotal, 
            moeda, 
            numPassageiros, 
            infoIda: this.obterInfoSegmento(this.vooSelecionado.segment?.[0]), 
            infoVolta: this.vooSelecionado.segment?.length > 1 ? this.obterInfoSegmento(this.vooSelecionado.segment[1]) : null, 
            companhiaAerea: this.obterCompanhiasAereas(this.vooSelecionado), 
            dataSelecao: new Date().toISOString() 
        };
        localStorage.setItem('benetrip_voo_selecionado', JSON.stringify(dadosVoo));
        this.exibirToast('Voo selecionado! Redirecionando...', 'success');
        setTimeout(() => { window.location.href = 'hotels.html'; }, 1500);
    });
    modalContainer.addEventListener('click', function(e) { if (e.target === this) this.remove(); });
  },

  carregarDadosUsuario() {
    try {
      return JSON.parse(localStorage.getItem('benetrip_user_data') || '{}');
    } catch {
      return {};
    }
  },

  obterCodigoIATAOrigem(dadosUsuario) {
    try {
      const r = dadosUsuario?.respostas;
      if (!r) throw new Error("Sem respostas");
      let c = r.cidade_partida || r.partida || null;
      if (c && typeof c === 'object') c = c.code || c.value || c.name || c.iata || null;
      const br = {
        'sao paulo': 'GRU',
        'rio de janeiro': 'GIG',
        'brasilia': 'BSB',
        'salvador': 'SSA',
        'recife': 'REC',
        'fortaleza': 'FOR',
        'belo horizonte': 'CNF',
        'porto alegre': 'POA',
        'curitiba': 'CWB',
        'belem': 'BEL',
        'manaus': 'MAO',
        'florianopolis': 'FLN',
        'natal': 'NAT',
        'goiania': 'GYN'
      };
      if (typeof c === 'string') {
        if (/^[A-Z]{3}$/.test(c)) return c;
        const m = c.match(/\(([A-Z]{3})\)/);
        if (m?.[1]) return m[1];
        const l = c.toLowerCase().trim();
        if (br[l]) return br[l];
        return 'GRU';
      }
    } catch (e) {
      console.error("Erro origem:", e);
    }
    console.warn('Origem GRU padrão.');
    return 'GRU';
  },

  obterDatasViagem() {
    try {
      const d = this.carregarDadosUsuario()?.respostas?.datas;
      if (!d?.dataIda) return "N/A";
      const fmt = (s) => {
        const dt = new Date(s + 'T00:00:00');
        if (isNaN(dt.getTime())) return "Inválida";
        const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${dt.getDate()} ${m[dt.getMonth()]} ${dt.getFullYear()}`;
      };
      const idaF = fmt(d.dataIda);
      if (!d.dataVolta) return `${idaF} (Só ida)`;
      const voltaF = fmt(d.dataVolta);
      const ida = new Date(d.dataIda), volta = new Date(d.dataVolta);
      if (ida.getMonth() === volta.getMonth() && ida.getFullYear() === volta.getFullYear()) {
        const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${ida.getDate()} a ${volta.getDate()} ${m[ida.getMonth()]}, ${ida.getFullYear()}`;
      }
      return `${idaF} a ${voltaF}`;
    } catch (e) {
      console.error("Erro datas:", e);
    }
    return "N/A";
  },

  obterQuantidadePassageiros() {
    try {
      const r = this.carregarDadosUsuario()?.respostas;
      const p = r?.passageiros;
      if (p) return Math.max(1, (parseInt(p.adultos) || 0) + (parseInt(p.criancas) || 0) + (parseInt(p.bebes) || 0));
      const ad = parseInt(r?.adultos) || 0, cr = parseInt(r?.criancas) || 0, bb = parseInt(r?.bebes) || 0;
      if (ad > 0) return ad + cr + bb;
      const q = parseInt(r?.quantidade_familia) || parseInt(r?.quantidade_amigos) || parseInt(r?.quantidade_pessoas) || 0;
      if (q > 0) return q;
      const comp = r?.companhia;
      if (comp === 0) return 1;
      if (comp === 1) return 2;
      if (comp >= 2) return Math.max(2, comp);
    } catch (e) {
      console.error("Erro passageiros:", e);
    }
    return 1;
  },

  configurarEventosAposRenderizacao() {
    // Configura swipe e scroll-snap
    if (typeof Hammer !== 'undefined') {
       const sc = document.getElementById('voos-swipe-container');
       if (sc) {
         if (this.hammerInstance) this.hammerInstance.destroy();
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
    const sc = document.getElementById('voos-swipe-container');
    if (sc && 'onscrollend' in window) {
      sc.onscrollend = () => this.atualizarVooAtivoBaseadoNoScroll(sc);
    } else if (sc) {
      let st;
      sc.onscroll = () => {
        clearTimeout(st);
        st = setTimeout(() => this.atualizarVooAtivoBaseadoNoScroll(sc), 150);
      };
    }
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
      .voos-swipe-container { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
      .voo-card { flex: 0 0 100%; scroll-snap-align: center; transition: all 0.3s ease; position: relative; }
      .voo-card-ativo { box-shadow: 0 0 0 2px #E87722; }
      .voo-card-highlight { animation: pulse 1s; }
      .voo-selecionado { box-shadow: 0 0 0 3px #00A3E0; background-color: #f0f9ff; }
      @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(232, 119, 34, 0.7); } 70% { box-shadow: 0 0 0 6px rgba(232, 119, 34, 0); } 100% { box-shadow: 0 0 0 0 rgba(232, 119, 34, 0); } }
      .btn-pulsante { animation: button-pulse 1.5s 2; }
      @keyframes button-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
      .progress-bar-container { height: 8px; background-color: #f3f4f6; border-radius: 4px; overflow: hidden; margin: 0 auto; width: 80%; max-width: 300px; }
      .progress-bar { height: 100%; background-color: #E87722; border-radius: 4px; transition: width 0.3s ease; }
      .botao-selecao-fixo { position: fixed; bottom: 0; left: 0; right: 0; padding: 8px 16px; background-color: white; border-top: 1px solid #e5e7eb; z-index: 40; }
      .btn-selecionar-voo { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 12px 16px; background-color: #E87722; color: white; border-radius: 6px; font-weight: bold; transition: all 0.2s; }
      .btn-selecionar-voo:hover { background-color: #d06a1c; }
      .toast-container { position: fixed; bottom: 80px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; z-index: 50; pointer-events: none; }
      .toast { padding: 8px 16px; border-radius: 4px; background-color: rgba(0, 0, 0, 0.7); color: white; margin-bottom: 8px; transform: translateY(20px); opacity: 0; transition: all 0.3s ease; max-width: 80%; text-align: center; }
      .toast-visible { transform: translateY(0); opacity: 1; }
      .toast-success { background-color: rgba(22, 163, 74, 0.9); }
      .toast-warning { background-color: rgba(234, 88, 12, 0.9); }
      .toast-error { background-color: rgba(220, 38, 38, 0.9); }
      .swipe-hint { position: fixed; bottom: 60px; left: 0; right: 0; display: flex; justify-content: center; align-items: center; background-color: rgba(0, 0, 0, 0.7); color: white; padding: 8px 16px; z-index: 30; opacity: 1; transition: opacity 0.5s ease; }
      .swipe-hint-arrow { animation: arrow-bounce 1s infinite; display: inline-block; }
      @keyframes arrow-bounce { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-3px); } }
      .swipe-hint-arrow:last-child { animation: arrow-bounce-right 1s infinite; }
      @keyframes arrow-bounce-right { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(3px); } }
      #voos-container { padding-bottom: 80px; }
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

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('voos-container')) {
    console.log('Inicializando módulo de voos Benetrip (v2.5.1)...');
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

// Listener de erro global
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
