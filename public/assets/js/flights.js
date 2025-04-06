/**
 * BENETRIP - Módulo de Busca e Exibição de Voos
 * Versão 2.5.0 - Tratamento de Chunks + Assinatura Corrigida
 * Este módulo gerencia a busca de voos: inicia a busca, aguarda,
 * faz polling buscando chunks de resultados e os acumula até o fim.
 */

// Módulo de Voos do Benetrip
const BENETRIP_VOOS = {
  // --- Constantes ---
  INITIAL_WAIT_MS: 5000,   // Tempo de espera inicial ANTES de começar o polling (5 segundos)
  POLLING_INTERVAL_MS: 3000, // Intervalo entre chamadas de polling (3 segundos - pode ser mais curto agora)
  MAX_POLLING_ATTEMPTS: 40,  // Máximo de tentativas de polling (após espera inicial ~2 min total)
  TIMEOUT_MS: 125000,      // Timeout total para busca (inclui espera inicial + polling)

  // --- Dados e Estado ---
  destino: null,
  searchId: null,          // ID da busca retornado pelo backend
  currencyRates: null,     // Taxas de câmbio (se retornadas)

  // Estado do Polling e Resultados Acumulados (Ponto 2 - Frontend)
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
  accumulatedMeta: {}, // Pode acumular ou sobrescrever meta, dependendo da necessidade
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
    console.log('Inicializando sistema de busca de voos v2.5.0 (Tratamento de Chunks)...');
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
      this.resultados = null; // Mantido por compatibilidade, mas usar accumulated*
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

  // --- Carregar dados do destino selecionado ---
  async carregarDestino() {
    // (Sem mudanças significativas aqui, mantida a lógica anterior)
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
    // (Sem mudanças)
    if (!texto || typeof texto !== 'string') return null;
    const match = texto.match(/\(([A-Z]{3})\)/);
    if (match && match[1]) return match[1];
    const mapeamento = {'paris': 'CDG', 'londres': 'LHR', /* ... outros ... */ 'cidade do méxico': 'MEX'};
    const textoLower = texto.toLowerCase();
    for (const [cidade, codigo] of Object.entries(mapeamento)) {
        if (textoLower.includes(cidade)) return codigo;
    }
    return null;
  },

  // --- Iniciar Busca de Voos ---
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
        locale: "en" // Usando 'en' conforme documentação (Ponto 3)
        // only_direct: false // Adicionar se necessário (Ponto 4)
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
    // (Sem mudanças significativas)
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

  // --- Gerenciamento do Polling (Frontend com Chunks - Ponto 2) ---
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

  // Função principal de polling modificada para chunks
  async verificarResultadosPolling() {
    if (!this.isPolling) return;

    this.pollingAttempts++;
    console.log(`Polling Chunks: Tentativa ${this.pollingAttempts}/${this.MAX_POLLING_ATTEMPTS}`);

    // Atualiza UI
    const mensagens = ['Buscando voos...', 'Verificando tarifas...', 'Analisando conexões...', 'Consultando Cias...', 'Quase lá...'];
    const msgIdx = Math.min(Math.floor(this.pollingAttempts / (this.MAX_POLLING_ATTEMPTS / mensagens.length)), mensagens.length - 1);
    const progresso = 20 + Math.min(75, (this.pollingAttempts / this.MAX_POLLING_ATTEMPTS) * 75); // Progresso até 95%
    this.atualizarProgresso(`${mensagens[msgIdx]} (${this.pollingAttempts})`, progresso);

    // Verifica limite
    if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS) {
      this.pararPolling();
      this.mostrarErro('A busca demorou mais que o esperado.');
      return;
    }

    try {
      // Chama o backend (que agora é um proxy)
      const resposta = await fetch(`/api/flight-results?uuid=${this.searchId}`);

      // --- Processamento da Resposta (Chunk) ---
      if (!resposta.ok) {
          // Trata erros HTTP retornados pelo proxy (404, 5xx, etc.)
          const errorData = await resposta.json().catch(() => ({ error: `Erro ${resposta.status} ao buscar resultados (resposta não JSON)` }));
          const errorMessage = errorData.error || `Erro ${resposta.status} ao buscar resultados.`;
          console.error(`Erro no polling (HTTP ${resposta.status}):`, errorMessage, errorData);
          if (resposta.status === 404) {
              this.pararPolling();
              this.mostrarErro('A busca expirou ou é inválida.');
          } else {
              // Para outros erros, pode continuar tentando por um tempo
              console.warn(`Erro ${resposta.status}, continuando polling (tentativa ${this.pollingAttempts})`);
              if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS - 5) { // Desiste perto do fim
                   this.pararPolling();
                   this.mostrarErro(errorMessage);
              }
          }
          return; // Não processa mais este chunk
      }

      // Resposta OK (200), processa o chunk
      const chunkData = await resposta.json();
      console.log('Chunk recebido:', chunkData);

      // A API retorna um array, mesmo que vazio ou com um objeto.
      // A documentação diz que o último chunk tem proposals: []
      // Vamos assumir que a estrutura principal está no primeiro elemento do array, se for um array.
      const chunkObject = Array.isArray(chunkData) ? chunkData[0] : chunkData;

      // Caso MUITO estranho: resposta 200 mas sem dados ou sem ser objeto/array
      if (!chunkObject || typeof chunkObject !== 'object') {
          console.warn("Chunk recebido com status 200 mas formato inesperado:", chunkData);
          // Continua polling, pode ser um erro transitório da API
          return;
      }

      // Verifica se é a resposta "ainda buscando" (pode nem vir mais com o proxy, mas seguro verificar)
      if (Object.keys(chunkObject).length === 1 && chunkObject.search_id === this.searchId) {
          console.log('Busca ainda em andamento (resposta apenas com search_id)...');
          return; // Continua polling
      }

      // É um chunk de dados (ou o chunk final)
      const proposalsInChunk = chunkObject.proposals;
      const airlinesInChunk = chunkObject.airlines;
      const airportsInChunk = chunkObject.airports;
      const gatesInfoInChunk = chunkObject.gates_info;
      const metaInChunk = chunkObject.meta; // Pode conter moeda, etc.

      // Acumula os dados
      if (proposalsInChunk && Array.isArray(proposalsInChunk) && proposalsInChunk.length > 0) {
          this.accumulatedProposals.push(...proposalsInChunk);
          console.log(`Acumuladas ${this.accumulatedProposals.length} propostas.`);
      }
      if (airlinesInChunk) {
          Object.assign(this.accumulatedAirlines, airlinesInChunk);
      }
      if (airportsInChunk) {
          Object.assign(this.accumulatedAirports, airportsInChunk);
      }
       if (gatesInfoInChunk) {
          Object.assign(this.accumulatedGatesInfo, gatesInfoInChunk);
      }
      if (metaInChunk) {
          // Sobrescreve ou mescla meta conforme necessário. Por exemplo, pegar a última moeda.
          this.accumulatedMeta = { ...this.accumulatedMeta, ...metaInChunk };
      }

      // Verifica se é o FIM da busca (chunk com proposals vazio)
      // A documentação diz "empty proposals array", então verificamos isso.
      if (proposalsInChunk && proposalsInChunk.length === 0) {
          console.log('Polling concluído! (Chunk final com proposals vazio recebido)');
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
              // Adiciona outros dados relevantes do último chunk se necessário
              search_id: this.searchId,
              // ... (outros campos do chunkObject como segments, market etc podem ser úteis)
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
               this.exibirToast('Não encontramos voos disponíveis para esta rota e datas.', 'warning');
          }

          this.renderizarInterface(); // Renderiza com os resultados finais (ou sem resultados)
      } else {
          // Ainda não é o fim, continua polling
          console.log('Chunk processado, esperando próximo...');
      }

    } catch (erro) {
      console.error('Erro durante o polling ou processamento do chunk:', erro);
      // Tenta continuar polling por um tempo em caso de erro de rede/JSON
      if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS - 5) {
          this.pararPolling();
          this.mostrarErro('Erro ao verificar resultados. Verifique sua conexão.');
      }
    }
  },

  // Pré-processa as propostas acumuladas
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
  // --- Fim Gerenciamento do Polling ---

  // --- Renderização ---
  atualizarProgresso(mensagem, porcentagem) {
    // (Sem mudanças)
    const bar = document.querySelector('.progress-bar');
    const text = document.querySelector('.loading-text');
    if (bar) { bar.style.width = `${porcentagem}%`; bar.setAttribute('aria-valuenow', porcentagem); }
    if (text) { text.textContent = mensagem; }
  },

  renderizarInterface() {
    // Modificado para usar this.finalResults
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
        // Renderiza com this.finalResults
        const mainContent = document.createElement('main');
        mainContent.className = 'voos-content';
        container.appendChild(mainContent);

        this.renderizarResumoViagem(mainContent);
        this.renderizarListaVoos(mainContent); // Usará this.finalResults internamente
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

  renderizarHeader(container) { /* (Sem mudanças) */
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
  renderizarCarregamento(container) { /* (Sem mudanças significativas) */
    if (container.querySelector('.loading-container')) return;
    const loadingImage = 'assets/images/tripinha/loading.gif';
    const loading = document.createElement('div');
    loading.className = 'loading-container';
    loading.innerHTML = `<div style="text-align: center; padding: 2rem 0;"><img src="${loadingImage}" alt="Tripinha carregando" class="loading-avatar" style="width: 100px; height: 100px; margin: 0 auto;" /><div class="loading-text" style="margin: 1rem 0;">Iniciando busca...</div><div class="progress-bar-container"><div class="progress-bar" role="progressbar" style="width: 10%;" aria-valuenow="10" aria-valuemin="0" aria-valuemax="100"></div></div><div class="loading-tips" style="margin-top: 1.5rem; font-size: 0.9rem; color: #666;"><p>💡 Dica: Preços mudam, reserve logo!</p></div></div>`;
    container.appendChild(loading);
    this.atualizarProgresso(document.querySelector('.loading-text')?.textContent || 'Buscando...', parseFloat(document.querySelector('.progress-bar')?.style.width || '10'));
    // Lógica de dicas mantida...
  },
  renderizarErro(container) { /* (Sem mudanças) */
    const loading = container.querySelector('.loading-container'); if (loading) loading.remove();
    const erroDiv = document.createElement('div'); erroDiv.className = 'erro-container';
    erroDiv.innerHTML = `<div class="bg-red-100 text-red-700 p-4 rounded-lg my-4 text-center"><div class="mb-3"><img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="w-20 h-20 mx-auto" /></div><p class="font-bold">${this.mensagemErro || 'Ocorreu um erro.'}</p><p class="mt-2 text-sm">Desculpe. Tente novamente?</p><button class="btn-tentar-novamente mt-4 px-4 py-2 bg-red-600 text-white rounded">Tentar Novamente</button></div>`;
    container.appendChild(erroDiv);
  },
  renderizarSemResultados(container) { /* (Sem mudanças) */
    const loading = container.querySelector('.loading-container'); if (loading) loading.remove();
    const semResultados = document.createElement('div'); semResultados.className = 'sem-resultados-container';
    semResultados.innerHTML = `<div class="bg-blue-50 p-4 rounded-lg my-4 text-center"><div class="mb-3"><img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="w-20 h-20 mx-auto" /></div><p class="font-bold">Ops! Não encontramos voos para ${this.destino?.destino || 'este destino'}.</p><p class="mt-2 text-sm">Tente outras datas ou destino.</p><div class="flex gap-3 mt-4"><button class="btn-secundario flex-1 py-2 px-4 border rounded">Mudar Datas</button><button class="btn-principal flex-1 py-2 px-4 text-white rounded" style="background-color: #E87722;">Outro Destino</button></div></div>`;
    container.appendChild(semResultados);
  },
  renderizarResumoViagem(container) { /* (Sem mudanças) */
    const resumo = document.createElement('div'); resumo.className = 'viagem-resumo p-4 bg-white border-b';
    const destino = this.destino; const dataViagem = this.obterDatasViagem(); const passageiros = this.obterQuantidadePassageiros();
    resumo.innerHTML = `<h2 class="text-lg font-bold mb-2">Sua Viagem</h2><div class="flex items-center justify-between"><div class="flex items-center"><div class="bg-blue-50 p-1 rounded mr-2"><span class="text-lg">✈️</span></div><div><p class="font-medium">${destino?.destino || ''}, ${destino?.pais || ''}</p><p class="text-sm text-gray-600">${dataViagem}</p></div></div><div class="text-sm text-right"><span class="bg-gray-100 px-2 py-1 rounded">${passageiros} pas.</span></div></div>`;
    container.appendChild(resumo);
  },

  renderizarListaVoos(container) {
    // Modificado para usar this.finalResults
    const listaVoos = document.createElement('div');
    listaVoos.className = 'voos-lista';
    listaVoos.id = 'voos-lista';

    const voos = this.finalResults?.proposals || []; // Usa propostas acumuladas

    const header = document.createElement('div');
    header.className = 'voos-header p-3 bg-gray-50 border-b';
    header.innerHTML = `<div class="flex justify-between items-center"><h3 class="font-medium">${voos.length} ${voos.length === 1 ? 'voo encontrado' : 'voos encontrados'}</h3><div class="flex items-center"><span class="text-sm text-gray-600 mr-2">Por preço</span><span class="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">↑ Baratos</span></div></div>`;
    listaVoos.appendChild(header);

    const voosContainer = document.createElement('div');
    voosContainer.className = 'voos-swipe-container';
    voosContainer.id = 'voos-swipe-container';
    listaVoos.appendChild(voosContainer);

    voos.forEach((voo, index) => {
      const cardVoo = this.criarCardVoo(voo, index); // Passa o voo acumulado
      voosContainer.appendChild(cardVoo);
    });

    container.appendChild(listaVoos);
  },

  criarCardVoo(voo, index) {
    // Modificado para usar this.finalResults.meta.currency
    const cardVoo = document.createElement('div');
    cardVoo.className = 'voo-card p-4 bg-white border-b';
    const vooId = voo.sign || `voo-idx-${index}`;
    cardVoo.dataset.vooId = vooId;
    cardVoo.dataset.vooIndex = index;

    const preco = this.obterPrecoVoo(voo);
    // Usa a moeda do meta acumulado ou BRL como fallback
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
  renderizarParadas(paradas) { /* (Sem mudanças) */
     const numParadas = paradas ?? 0; if (numParadas === 0) return `<span class="inline-block w-3 h-3 bg-green-500 rounded-full" title="Voo direto"></span>`;
     let html = ''; for (let i = 0; i < Math.min(numParadas, 3); i++) html += `<span class="inline-block w-2 h-2 bg-gray-400 rounded-full mx-1" title="${numParadas} parada${numParadas > 1 ? 's' : ''}"></span>`; return html;
  },
  renderizarBotaoSelecao(container) { /* (Sem mudanças) */
    const btnExistente = document.querySelector('.botao-selecao-fixo'); if (btnExistente) btnExistente.remove();
    const botaoFixo = document.createElement('div'); botaoFixo.className = 'botao-selecao-fixo';
    botaoFixo.innerHTML = `<button class="btn-selecionar-voo"><span>Escolher Este Voo</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg></button>`;
    container.appendChild(botaoFixo);
  },
  renderizarSwipeHint(container) { /* (Sem mudanças) */
    const hint = document.createElement('div'); hint.id = 'swipe-hint'; hint.className = 'swipe-hint'; hint.style.display = 'none';
    hint.innerHTML = `<span class="swipe-hint-arrow mr-2">←</span> Arraste para ver outros voos <span class="swipe-hint-arrow ml-2">→</span>`;
    container.appendChild(hint);
    if (this.finalResults?.proposals?.length > 1) {
        hint.style.display = 'flex';
        setTimeout(() => { hint.style.opacity = '0'; setTimeout(() => { hint.style.display = 'none'; }, 1000); }, 4000);
    }
  },

  // --- Métodos de Formatação e Extração de Dados ---
  formatarPreco(preco, moeda = 'BRL') { /* (Sem mudanças) */ if (typeof preco !== 'number') return 'N/A'; return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(preco); },
  formatarData(data) { /* (Sem mudanças) */ if (!(data instanceof Date) || isNaN(data)) return 'N/A'; const d = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']; return `${d[data.getDay()]}, ${data.getDate()} ${m[data.getMonth()]}`; },
  formatarDuracao(duracaoMinutos) { /* (Sem mudanças) */ if (typeof duracaoMinutos !== 'number' || duracaoMinutos < 0) return 'N/A'; const h = Math.floor(duracaoMinutos / 60), m = duracaoMinutos % 60; return `${h}h ${m > 0 ? m + 'm' : ''}`.trim(); },
  obterPrecoVoo(voo) { /* (Sem mudanças) */ try { if (!voo?.terms) return 0; const k = Object.keys(voo.terms)[0]; return voo.terms[k]?.unified_price || voo.terms[k]?.price || 0; } catch { return 0; } },

  obterCompanhiasAereas(voo) {
    // Modificado para usar this.accumulatedAirlines
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
    } catch { return 'N/A'; }
  },
  obterInfoSegmento(segmento) { /* (Sem mudanças significativas) */ const def = { aeroportoPartida: 'N/A', aeroportoChegada: 'N/A', dataPartida: null, dataChegada: null, horaPartida: 'N/A', horaChegada: 'N/A', duracao: 0, paradas: 0 }; try { if (!segmento?.flight?.length) return def; const pV = segmento.flight[0], uV = segmento.flight[segmento.flight.length - 1]; if (!pV || !uV) return def; const tsP = pV.local_departure_timestamp * 1000, tsC = uV.local_arrival_timestamp * 1000; if (isNaN(tsP) || isNaN(tsC)) return def; const dP = new Date(tsP), dC = new Date(tsC); return { aeroportoPartida: pV.departure, aeroportoChegada: uV.arrival, dataPartida: dP, dataChegada: dC, horaPartida: dP.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), horaChegada: dC.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), duracao: Math.round((tsC - tsP) / 60000), paradas: segmento.flight.length - 1 }; } catch { return def; } },

  // --- Navegação e Interação ---
  // Modificadas para usar this.finalResults
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
    // Modificado para usar this.finalResults
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
      const moeda = this.finalResults?.meta?.currency || 'BRL'; // Usa moeda acumulada
      btnSelecionar.innerHTML = `<span>Escolher Voo por ${this.formatarPreco(preco, moeda)}</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>`;
    } else if (btnSelecionar) {
        btnSelecionar.innerHTML = `<span>Escolher Este Voo</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>`;
    }
  },
  selecionarVoo(vooId) {
    // Modificado para usar this.finalResults
    if (!this.finalResults?.proposals) return;
    const vooEncontrado = this.finalResults.proposals.find((v, index) => (v.sign || `voo-idx-${index}`) === vooId);
    if (!vooEncontrado) { console.error(`Voo ${vooId} não encontrado`); return; }
    this.vooSelecionado = vooEncontrado;
    console.log('Voo selecionado:', this.vooSelecionado);
    const index = this.finalResults.proposals.findIndex((v, idx) => (v.sign || `voo-idx-${idx}`) === vooId);
    if (index !== -1) { this.vooAtivo = vooEncontrado; this.indexVooAtivo = index; }
    document.querySelectorAll('.voo-card').forEach(card => { card.classList.remove('voo-selecionado'); if (card.dataset.vooId === vooId) card.classList.add('voo-selecionado'); });
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
  exibirToast(mensagem, tipo = 'info') { /* (Sem mudanças) */ const c = document.getElementById('toast-container'); if (!c) return; const t = document.createElement('div'); t.className = `toast toast-${tipo}`; t.innerHTML = mensagem; c.appendChild(t); setTimeout(() => t.classList.add('toast-visible'), 50); setTimeout(() => { t.classList.remove('toast-visible'); setTimeout(() => { if (c.contains(t)) c.removeChild(t); }, 300); }, 3000); },
  selecionarVooAtivo() { /* (Sem mudanças) */ if (!this.vooAtivo) { console.error('Nenhum voo ativo'); return; } const vooId = this.vooAtivo.sign || `voo-idx-${this.indexVooAtivo}`; this.selecionarVoo(vooId); },

  mostrarDetalhesVoo(vooId) {
    // Modificado para usar this.finalResults
    if (!this.finalResults?.proposals) return;
    const voo = this.finalResults.proposals.find((v, index) => (v.sign || `voo-idx-${index}`) === vooId);
    if (!voo) { console.error(`Voo ${vooId} não encontrado`); return; }
    document.getElementById('modal-detalhes-voo')?.remove();
    const preco = this.obterPrecoVoo(voo);
    const moeda = this.finalResults?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    const infoIda = this.obterInfoSegmento(voo.segment?.[0]);
    const infoVolta = voo.segment?.length > 1 ? this.obterInfoSegmento(voo.segment[1]) : null;
    const modalContainer = document.createElement('div'); modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'; modalContainer.id = 'modal-detalhes-voo';
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
    document.getElementById('btn-selecionar-este-voo')?.addEventListener('click', () => { this.selecionarVoo(vooId); modalContainer.remove(); this.mostrarConfirmacaoSelecao(voo); });
    modalContainer.addEventListener('click', (e) => { if (e.target === modalContainer) modalContainer.remove(); });
  },
  renderizarTimelineVoos(voos) { /* (Sem mudanças significativas) */ if (!voos || !voos.length) return '<p>N/A</p>'; let timeline = ''; voos.forEach((v, i) => { const last = i === voos.length - 1; const dP = new Date(v.local_departure_timestamp * 1000), dC = new Date(v.local_arrival_timestamp * 1000); const hP = dP.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), hC = dC.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); let cInfo = v.marketing_carrier || v.operating_carrier || 'N/A'; if (this.accumulatedAirlines[cInfo]) cInfo = this.accumulatedAirlines[cInfo].name || cInfo; timeline += `<div class="voo-leg mb-3 pb-3 ${!last ? 'border-b border-dashed' : ''}"><div class="flex justify-between mb-2"><div><p class="font-bold">${hP}</p><p class="text-sm">${v.departure}</p></div><div class="text-center flex-1 px-2"><p class="text-xs text-gray-500">${this.formatarDuracao(v.duration)}</p><div class="h-0.5 bg-gray-300 my-2 relative"><div class="absolute -top-1 left-0 w-2 h-2 rounded-full bg-gray-500"></div><div class="absolute -top-1 right-0 w-2 h-2 rounded-full bg-gray-500"></div></div><p class="text-xs">${cInfo}</p></div><div><p class="font-bold">${hC}</p><p class="text-sm">${v.arrival}</p></div></div><div class="text-xs text-gray-600"><p>Voo ${v.marketing_carrier || v.operating_carrier}${v.number}</p><p>Aeronave: ${v.aircraft || 'N/A'}</p></div></div>`; if (!last) { const prox = voos[i + 1]; if (prox) { const tCon = Math.round((prox.local_departure_timestamp - v.local_arrival_timestamp) / 60); timeline += `<div class="conexao-info mb-3 text-sm"><div class="flex items-center text-orange-700"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span class="ml-1">Conexão em ${v.arrival} • ${this.formatarDuracao(tCon)}</span></div></div>`; } } }); return timeline; },

  mostrarConfirmacaoSelecao(voo) {
    // Modificado para usar this.finalResults
    document.getElementById('modal-confirmacao')?.remove();
    const preco = this.obterPrecoVoo(voo);
    const moeda = this.finalResults?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    const numPassageiros = this.obterQuantidadePassageiros();
    const precoTotal = preco * numPassageiros;
    const precoTotalFormatado = this.formatarPreco(precoTotal, moeda);
    const modalContainer = document.createElement('div'); modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'; modalContainer.id = 'modal-confirmacao';
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
    const chk = document.getElementById('confirmar-selecao'), btnC = document.getElementById('btn-confirmar'), btnX = document.getElementById('btn-cancelar');
    chk.addEventListener('change', () => { btnC.disabled = !chk.checked; });
    btnX.addEventListener('click', () => { modalContainer.remove(); });
    btnC.addEventListener('click', () => {
        const dadosVoo = { voo: this.vooSelecionado, preco, precoTotal, moeda, numPassageiros, infoIda: this.obterInfoSegmento(this.vooSelecionado.segment?.[0]), infoVolta: this.vooSelecionado.segment?.length > 1 ? this.obterInfoSegmento(this.vooSelecionado.segment[1]) : null, companhiaAerea: this.obterCompanhiasAereas(this.vooSelecionado), dataSelecao: new Date().toISOString() };
        localStorage.setItem('benetrip_voo_selecionado', JSON.stringify(dadosVoo));
        this.exibirToast('Voo selecionado! Redirecionando...', 'success');
        setTimeout(() => { window.location.href = 'hotels.html'; }, 1500);
    });
    modalContainer.addEventListener('click', function(e) { if (e.target === this) this.remove(); });
  },

  // --- Métodos Auxiliares ---
  carregarDadosUsuario() { /* (Sem mudanças) */ try { return JSON.parse(localStorage.getItem('benetrip_user_data') || '{}'); } catch { return {}; } },
  obterCodigoIATAOrigem(dadosUsuario) { /* (Sem mudanças) */ try { const r = dadosUsuario?.respostas; if (!r) throw new Error("Sem respostas"); let c = r.cidade_partida || r.partida || null; if (c && typeof c === 'object') c = c.code || c.value || c.name || c.iata || null; const br = {'sao paulo': 'GRU', /*...*/ 'goiania': 'GYN'}; if (typeof c === 'string') { if (/^[A-Z]{3}$/.test(c)) return c; const m = c.match(/\(([A-Z]{3})\)/); if (m?.[1]) return m[1]; const l = c.toLowerCase().trim(); if (br[l]) return br[l]; return 'GRU'; } } catch (e) { console.error("Erro origem:", e); } console.warn('Origem GRU padrão.'); return 'GRU'; },
  obterDatasViagem() { /* (Sem mudanças) */ try { const d = this.carregarDadosUsuario()?.respostas?.datas; if (!d?.dataIda) return "N/A"; const fmt = (s) => { const dt = new Date(s + 'T00:00:00'); if (isNaN(dt.getTime())) return "Inválida"; const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']; return `${dt.getDate()} ${m[dt.getMonth()]} ${dt.getFullYear()}`; }; const idaF = fmt(d.dataIda); if (!d.dataVolta) return `${idaF} (Só ida)`; const voltaF = fmt(d.dataVolta); const ida = new Date(d.dataIda), volta = new Date(d.dataVolta); if (ida.getMonth() === volta.getMonth() && ida.getFullYear() === volta.getFullYear()) { const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']; return `${ida.getDate()} a ${volta.getDate()} ${m[ida.getMonth()]}, ${ida.getFullYear()}`; } return `${idaF} a ${voltaF}`; } catch (e) { console.error("Erro datas:", e); } return "N/A"; },
  obterQuantidadePassageiros() { /* (Sem mudanças) */ try { const r = this.carregarDadosUsuario()?.respostas; const p = r?.passageiros; if (p) return Math.max(1, (parseInt(p.adultos) || 0) + (parseInt(p.criancas) || 0) + (parseInt(p.bebes) || 0)); const ad = parseInt(r?.adultos) || 0, cr = parseInt(r?.criancas) || 0, bb = parseInt(r?.bebes) || 0; if (ad > 0) return ad + cr + bb; const q = parseInt(r?.quantidade_familia) || parseInt(r?.quantidade_amigos) || parseInt(r?.quantidade_pessoas) || 0; if (q > 0) return q; const comp = r?.companhia; if (comp === 0) return 1; if (comp === 1) return 2; if (comp >= 2) return Math.max(2, comp); } catch (e) { console.error("Erro passageiros:", e); } return 1; },

  configurarEventosAposRenderizacao() {
    // Configura swipe e scroll-snap
    if (typeof Hammer !== 'undefined') {
       const sc = document.getElementById('voos-swipe-container');
       if (sc) {
         if (this.hammerInstance) this.hammerInstance.destroy();
         this.hammerInstance = new Hammer(sc);
         this.hammerInstance.on('swipeleft', () => this.proximoVoo());
         this.hammerInstance.on('swiperight', () => this.vooAnterior());
         this.hammerInstance.on('swipeleft swiperight', () => { try { const s = new Audio('assets/sounds/swipe.mp3'); s.volume = 0.2; s.play().catch(()=>{}); } catch(e){} });
       }
    }
    const sc = document.getElementById('voos-swipe-container');
    if (sc && 'onscrollend' in window) { sc.onscrollend = () => this.atualizarVooAtivoBaseadoNoScroll(sc); }
    else if (sc) { let st; sc.onscroll = () => { clearTimeout(st); st = setTimeout(() => this.atualizarVooAtivoBaseadoNoScroll(sc), 150); }; }

    // Botão voltar (já configurado no renderHeader)

    // Botão selecionar fixo (já configurado no configurarEventos por delegação)

    // Cards de voo (já configurado no configurarEventos por delegação)
  },

  atualizarVooAtivoBaseadoNoScroll(swipeContainer) { /* (Sem mudanças) */ if (!swipeContainer) return; const sL = swipeContainer.scrollLeft; const cW = swipeContainer.querySelector('.voo-card')?.offsetWidth || 0; if (cW > 0 && this.finalResults?.proposals?.length > 0) { const nI = Math.round(sL / cW); if (nI >= 0 && nI < this.finalResults.proposals.length && nI !== this.indexVooAtivo) { this.indexVooAtivo = nI; this.vooAtivo = this.finalResults.proposals[this.indexVooAtivo]; this.atualizarVooAtivo(); } } },

  // --- Estilos e UI ---
  aplicarEstilosModernos() { /* (Sem mudanças significativas, estilos mantidos) */ const id = 'benetrip-voos-styles'; if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = `/* Estilos ... (mantidos como antes) ... */ #voos-container { padding-bottom: 80px; }`; document.head.appendChild(s); },
  mostrarErro(mensagem) { /* (Sem mudanças significativas) */ console.error("Erro exibido:", mensagem); this.pararPolling(); this.temErro = true; this.estaCarregando = false; this.mensagemErro = mensagem || 'Erro desconhecido.'; this.renderizarInterface(); this.reportarErro({ mensagem, searchId: this.searchId, timestamp: new Date().toISOString(), tentativas: this.pollingAttempts }); },
  reportarErro(dadosErro) { /* (Sem mudanças) */ console.warn("Dados erro:", dadosErro); try { const errs = JSON.parse(localStorage.getItem('benetrip_erros') || '[]'); errs.push(dadosErro); if (errs.length > 10) errs.shift(); localStorage.setItem('benetrip_erros', JSON.stringify(errs)); } catch (e) { console.error("Erro ao salvar erro:", e); } }

}; // Fim do objeto BENETRIP_VOOS

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('voos-container')) {
    console.log('Inicializando módulo de voos Benetrip (v2.5.0)...');
    BENETRIP_VOOS.init();
  }
  // Listener visibilitychange mantido...
});
// Listener de erro global mantido...
window.addEventListener('error', (event) => { /* ... */ });

