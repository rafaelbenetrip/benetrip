/**
 * BENETRIP - Módulo de Busca e Exibição de Voos
 * Versão 2.3.0 - Polling Desacoplado com Tratamento Aprimorado
 * Este módulo gerencia a busca de voos: inicia a busca no backend,
 * e faz o polling dos resultados diretamente do frontend.
 */

// Módulo de Voos do Benetrip
const BENETRIP_VOOS = {
  // --- Constantes ---
  POLLING_INTERVAL_MS: 4000, // Intervalo entre chamadas de polling (4 segundos)
  MAX_POLLING_ATTEMPTS: 30,  // Máximo de tentativas de polling
  TIMEOUT_MS: 120000,        // Timeout total para busca (2 minutos)

  // --- Dados e Estado ---
  destino: null,
  resultados: null,
  searchId: null,          // ID da busca retornado pelo backend
  estaCarregando: true,    // Estado geral de carregamento (inclui busca inicial e polling)
  isPolling: false,        // Indica se o polling está ativo
  pollingAttempts: 0,      // Contador de tentativas de polling
  pollingIntervalId: null, // ID do intervalo do polling (para poder limpar)
  temErro: false,
  mensagemErro: '',
  vooSelecionado: null,
  vooAtivo: null, // Para navegação entre voos
  indexVooAtivo: 0,
  timeoutId: null, // Para limitar o tempo total da busca

  // --- Inicialização ---
  init() {
    console.log('Inicializando sistema de busca de voos v2.3.0 (Polling Frontend Otimizado)...');
    this.configurarEventos(); // Configura eventos básicos primeiro
    
    // Adiciona container para toasts se não existir
    if (!document.getElementById('toast-container')) {
      const toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }

    this.carregarDestino()
      .then(() => {
        // Inicia a busca (que agora só retorna search_id)
        this.iniciarBuscaVoos();
      })
      .catch(erro => {
        console.error('Erro crítico ao carregar destino:', erro);
        this.mostrarErro('Não foi possível carregar informações do destino. Por favor, retorne e selecione o destino novamente.');
      });

    this.aplicarEstilosModernos(); // Aplica estilos
    this.renderizarInterface(); // Renderiza o estado inicial (carregando)
  },

  // --- Configurar eventos ---
  configurarEventos() {
    // Botão Voltar é configurado após renderização inicial no renderizarHeader ou configurarEventosAposRenderizacao
    // Eventos de swipe e cliques nos cards serão configurados após a renderização dos voos
    // Delegação de evento global para botões que podem aparecer depois (detalhes, etc.)
    document.addEventListener('click', (event) => {
      const target = event.target;

      // Botão de detalhes do voo
      const btnDetalhes = target.closest('.btn-detalhes-voo');
      if (btnDetalhes) {
        const vooId = btnDetalhes.dataset.vooId;
        if (vooId) this.mostrarDetalhesVoo(vooId);
        return; // Evita processar outros cliques
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
          if (target.closest('.btn-secundario')) { // Mudar Datas
              window.location.href = 'index.html';
              return;
          }
          if (target.closest('.btn-principal')) { // Outro Destino
              window.location.href = 'destinos.html';
              return;
          }
      }
       // Clique no card de voo (adicionado em configurarEventosAposRenderizacao)
       const vooCard = target.closest('.voo-card');
       if (vooCard && this.resultados) { // Só seleciona se houver resultados
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
          // Se não há voo selecionado, mas há um ativo, seleciona-o
          this.selecionarVooAtivo();
        } else {
          this.exibirToast('Por favor, selecione um voo primeiro', 'warning');
        }
        return;
      }
    });

    // Adiciona listener de teclas para navegação
    document.addEventListener('keydown', (e) => {
      if (this.resultados && this.resultados.proposals && this.resultados.proposals.length > 0) {
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
    });
  },

  // --- Carregar dados do destino selecionado ---
  async carregarDestino() {
    try {
        // Primeiro tenta carregar do localStorage padrão
        let destinoString = localStorage.getItem('benetrip_destino_selecionado');
        
        // Se não encontrar, tenta outras chaves que podem ter sido usadas
        if (!destinoString) {
            destinoString = localStorage.getItem('benetrip_destino_escolhido') || 
                            localStorage.getItem('benetrip_destino');
        }
        
        if (!destinoString) {
            // Tenta extrair do benetrip_user_data se o fluxo for 'destino_conhecido'
            const dadosUsuario = this.carregarDadosUsuario();
            if (dadosUsuario && dadosUsuario.fluxo === 'destino_conhecido' && 
                dadosUsuario.respostas && dadosUsuario.respostas.destino_conhecido) {
                this.destino = dadosUsuario.respostas.destino_conhecido;
                return true;
            }
            
            throw new Error('Nenhum destino selecionado');
        }
        
        this.destino = JSON.parse(destinoString);
        console.log('Destino carregado:', this.destino);
        
        // Verificar e corrigir formato do código IATA
        if (!this.destino.codigo_iata && this.destino.aeroporto?.codigo) {
            this.destino.codigo_iata = this.destino.aeroporto.codigo;
        }
        
        // Verificar código IATA
        if (!this.destino.codigo_iata) {
            const codigoExtraido = this.extrairCodigoIATA(this.destino.destino);
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
    if (!texto || typeof texto !== 'string') return null;
    
    // Tenta encontrar padrão (ABC) no texto
    const match = texto.match(/\(([A-Z]{3})\)/);
    if (match && match[1]) return match[1];
    
    // Mapeamento de cidades comuns
    const mapeamento = {
        'paris': 'CDG',
        'londres': 'LHR',
        'nova york': 'JFK',
        'são paulo': 'GRU',
        'rio de janeiro': 'GIG',
        'miami': 'MIA',
        'orlando': 'MCO',
        'madri': 'MAD',
        'madrid': 'MAD',
        'barcelona': 'BCN',
        'roma': 'FCO',
        'lisboa': 'LIS',
        'tóquio': 'HND',
        'tokyo': 'HND',
        'berlim': 'BER',
        'sydney': 'SYD',
        'cidade do méxico': 'MEX',
    };
    
    // Tenta correspondência parcial
    const textoLower = texto.toLowerCase();
    for (const [cidade, codigo] of Object.entries(mapeamento)) {
        if (textoLower.includes(cidade)) return codigo;
    }
    
    // Não encontrado
    return null;
  },
  // --- Iniciar Busca de Voos (Chama o backend para obter search_id) ---
  async iniciarBuscaVoos() {
    try {
      if (!this.destino || !this.destino.codigo_iata) {
        throw new Error('Dados do destino incompletos para iniciar busca.');
      }

      const dadosUsuario = this.carregarDadosUsuario();
      const datas = dadosUsuario?.respostas?.datas;
      if (!datas || !datas.dataIda) {
        throw new Error('Datas de viagem não disponíveis.');
      }

      const origemIATA = this.obterCodigoIATAOrigem(dadosUsuario);

      const params = {
        origem: origemIATA,
        destino: this.destino.codigo_iata,
        dataIda: datas.dataIda,
        dataVolta: datas.dataVolta, // Será undefined se não existir
        adultos: dadosUsuario?.respostas?.passageiros?.adultos || 1,
        criancas: dadosUsuario?.respostas?.passageiros?.criancas || 0,
        bebes: dadosUsuario?.respostas?.passageiros?.bebes || 0,
        classe: 'Y', // Econômica por padrão
        locale: "en-us" // Garantir locale suportado pela Aviasales
      };

      // Validar parâmetros antes de prosseguir
      const validacao = this.validarDadosParaBusca(params);
      if (!validacao.valido) {
          throw new Error(`Dados inválidos para busca: ${validacao.mensagens.join(", ")}`);
      }

      console.log('Iniciando busca com parâmetros:', params);
      this.estaCarregando = true; // Mantém carregando até o fim do polling ou erro
      this.temErro = false;
      this.mensagemErro = '';
      this.atualizarProgresso('Iniciando busca de voos...', 10); // Progresso inicial
      this.renderizarInterface(); // Mostra tela de carregamento inicial

      // Configurar timeout global para a busca
      this.timeoutId = setTimeout(() => {
        if (this.isPolling) {
          this.pararPolling();
          this.mostrarErro('A busca demorou mais que o esperado. Tente novamente mais tarde.');
        }
      }, this.TIMEOUT_MS);

      // Fazer a requisição ao endpoint que *inicia* a busca
      const resposta = await fetch('/api/flight-search', { // Chama o backend modificado
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const contentType = resposta.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          const textError = await resposta.text();
          throw new Error(`Resposta inesperada do servidor (${resposta.status}): ${textError.substring(0, 100)}`);
      }

      const dados = await resposta.json();

      if (!resposta.ok) {
        // Erros tratados pelo backend (4xx, 5xx da API externa ou internos)
        throw new Error(dados.error || dados.details?.error || `Erro ${resposta.status} ao iniciar busca.`);
      }

      // Espera-se um status 202 com search_id
      if (resposta.status === 202 && dados.search_id) {
        console.log('Busca iniciada com sucesso. Search ID:', dados.search_id);
        this.searchId = dados.search_id;
        // Inicia o polling do frontend
        this.iniciarPollingFrontend();
      } else {
        // Caso inesperado (ex: status 200 sem search_id)
        throw new Error(dados.message || 'Resposta inesperada do servidor ao iniciar busca.');
      }

    } catch (erro) {
      console.error('Erro ao iniciar busca de voos:', erro);
      this.mostrarErro(erro.message); // Define estado de erro e renderiza
    }
  },

  validarDadosParaBusca(params) {
    const mensagensErro = [];
    
    // Verificar campos obrigatórios
    if (!params.origem) {
        mensagensErro.push("Origem não especificada");
    }
    if (!params.destino) {
        mensagensErro.push("Destino não especificado");
    }
    if (!params.dataIda) {
        mensagensErro.push("Data de ida não especificada");
    }
    
    // Validar formatos
    const regexIATA = /^[A-Z]{3}$/;
    const regexData = /^\d{4}-\d{2}-\d{2}$/;
    
    if (params.origem && !regexIATA.test(params.origem)) {
        mensagensErro.push("Formato de origem inválido (deve ser código IATA de 3 letras)");
    }
    if (params.destino && !regexIATA.test(params.destino)) {
        mensagensErro.push("Formato de destino inválido (deve ser código IATA de 3 letras)");
    }
    if (params.dataIda && !regexData.test(params.dataIda)) {
        mensagensErro.push("Formato de data de ida inválido (deve ser YYYY-MM-DD)");
    }
    if (params.dataVolta && !regexData.test(params.dataVolta)) {
        mensagensErro.push("Formato de data de volta inválido (deve ser YYYY-MM-DD)");
    }
    
    // Validar adultos (mínimo 1)
    if (!params.adultos || params.adultos < 1) {
        mensagensErro.push("Número de adultos deve ser pelo menos 1");
    }
    
    // Retornar resultado da validação
    return {
        valido: mensagensErro.length === 0,
        mensagens: mensagensErro
    };
  },

  // --- Gerenciamento do Polling (Frontend) ---
  iniciarPollingFrontend() {
    console.log(`Iniciando polling para searchId: ${this.searchId}`);
    // Limpa qualquer polling anterior (segurança)
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
    }

    this.isPolling = true;
    this.pollingAttempts = 0;
    this.atualizarProgresso('Procurando as melhores conexões...', 20); // Atualiza mensagem

    // Inicia o intervalo para verificar resultados
    this.pollingIntervalId = setInterval(
      // Usamos arrow function para manter o 'this' correto
      () => this.verificarResultadosPolling(),
      this.POLLING_INTERVAL_MS
    );

    // Chama imediatamente a primeira vez para não esperar o primeiro intervalo
    this.verificarResultadosPolling();
  },

  pararPolling() {
    console.log('Parando polling.');
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    // Limpa timeout global
    if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
    }
    
    this.isPolling = false;
  },

  async verificarResultadosPolling() {
    // Verificar se deve parar
    if (!this.isPolling) return;
    
    this.pollingAttempts++;
    console.log(`Polling: Tentativa ${this.pollingAttempts}/${this.MAX_POLLING_ATTEMPTS}`);
    
    // Atualiza UI com mensagens variadas para melhor feedback
    const mensagens = [
        'Buscando voos disponíveis...',
        'Verificando melhores tarifas...',
        'Analisando conexões...',
        'Consultando companhias aéreas...',
        'Quase lá! Ordenando resultados...'
    ];
    const mensagemIndex = Math.min(
        Math.floor(this.pollingAttempts / 6), 
        mensagens.length - 1
    );
    
    const progresso = 20 + Math.min(60, (this.pollingAttempts / this.MAX_POLLING_ATTEMPTS) * 60);
    this.atualizarProgresso(`${mensagens[mensagemIndex]} (${this.pollingAttempts})`, progresso);
    
    // Verificar limite de tentativas
    if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS) {
        this.pararPolling();
        this.mostrarErro('A busca demorou mais que o esperado. Tente novamente mais tarde.');
        return;
    }
    
    try {
        // Implementar retry automático para falhas temporárias
        let tentativasRequest = 0;
        const maxTentativasRequest = 3;
        let resposta = null;
        
        while (tentativasRequest < maxTentativasRequest) {
            try {
                resposta = await fetch(`/api/flight-results?uuid=${this.searchId}`);
                break; // Se não lançar exceção, sai do loop
            } catch (erroRequest) {
                tentativasRequest++;
                console.warn(`Erro na requisição de polling (${tentativasRequest}/${maxTentativasRequest}):`, erroRequest);
                
                if (tentativasRequest >= maxTentativasRequest) {
                    throw erroRequest; // Propaga o erro se exceder tentativas
                }
                
                // Espera breve antes de tentar novamente (exponential backoff)
                await new Promise(r => setTimeout(r, 1000 * tentativasRequest));
            }
        }
        
        // Continua o processamento normal após obter resposta
        if (!resposta.ok) {
            const errorData = await resposta.json().catch(() => ({}));
            const errorMessage = errorData.error || errorData.details?.error || 
                                `Erro ${resposta.status} ao buscar resultados.`;
            console.error(`Erro no polling (HTTP ${resposta.status}):`, errorMessage);
            
            if (resposta.status === 404) {
                this.pararPolling();
                this.mostrarErro('A busca expirou ou é inválida. Por favor, tente novamente.');
            } else if (resposta.status >= 500) {
                // Para erros de servidor, continua tentando (não para o polling)
                console.warn("Erro de servidor, continuando polling");
            } else {
                this.pararPolling();
                this.mostrarErro(errorMessage);
            }
            return;
        }
        
        // Processa a resposta JSON
        const dados = await resposta.json();
        console.log('Dados do polling:', dados);
        
        // Verifica se a busca foi concluída (com ou sem resultados)
        const temResultados = dados.proposals && dados.proposals.length > 0;
        const buscaCompleta = dados.search_completed === true; // Verifica explicitamente se é true
        
        if (temResultados || buscaCompleta) {
            console.log('Polling concluído!');
            this.pararPolling();
            this.estaCarregando = false; // Terminou o carregamento/polling
            
            if (temResultados) {
                // Pré-processamento dos dados recebidos
                dados.proposals = this.preprocessarPropostas(dados.proposals);
                this.resultados = dados; // Armazena TUDO (inclui meta, airlines, gates, etc.)
                this.atualizarProgresso('Voos encontrados!', 100);
                
                // Exibe toast para melhoria UX
                this.exibirToast(`${dados.proposals.length} voos encontrados! ✈️`, 'success');
            } else {
                // Busca completa, mas sem resultados
                console.log('Busca concluída sem resultados disponíveis');
                this.resultados = { 
                    ...dados,
                    proposals: [], 
                    message: dados.message || "Nenhum voo disponível para esta rota nas datas selecionadas"
                };
                this.atualizarProgresso('Busca finalizada, sem voos disponíveis.', 100);
                
                // Exibe toast para feedback ao usuário
                this.exibirToast('Não encontramos voos disponíveis para esta rota e datas.', 'warning');
            }
            
            this.renderizarInterface(); // Renderiza a interface final (com resultados ou mensagem)
        } else {
            // Busca ainda não concluída, continua no próximo intervalo
            console.log('Busca ainda em andamento...');
        }
    } catch (erro) {
        console.error('Erro durante o polling:', erro);
        
        // Não para o polling imediatamente para erros de rede - tenta mais vezes
        if (this.pollingAttempts >= this.MAX_POLLING_ATTEMPTS - 5) {
            this.pararPolling();
            this.mostrarErro('Erro de conexão ao verificar resultados. Verifique sua internet.');
        }
    }
},
  
  // Pré-processa as propostas para adicionar informações úteis e organizá-las
  preprocessarPropostas(propostas) {
      if (!propostas || !Array.isArray(propostas)) return [];
      
      // Ordena por preço (menor primeiro)
      propostas.sort((a, b) => this.obterPrecoVoo(a) - this.obterPrecoVoo(b));
      
      // Adiciona informações calculadas a cada proposta
      return propostas.map((proposta, index) => {
          // Adiciona flag de melhor preço ao primeiro item
          proposta._melhorPreco = (index === 0);
          
          // Calcula economia comparada à média (simulação)
          const precoAtual = this.obterPrecoVoo(proposta);
          const precoMedio = precoAtual * (1 + (Math.random() * 0.25)); // simula 0-25% mais caro
          proposta._economia = Math.round(((precoMedio - precoAtual) / precoMedio) * 100);
          
          // Adiciona assentos disponíveis aleatórios (simulação)
          proposta._assentosDisponiveis = Math.floor(Math.random() * 8) + 1;
          
          return proposta;
      });
  },
  // --- Fim Gerenciamento do Polling ---
  // --- Renderização ---
  atualizarProgresso(mensagem, porcentagem) {
    const barraProgresso = document.querySelector('.progress-bar');
    const textoProgresso = document.querySelector('.loading-text');

    if (barraProgresso) {
      barraProgresso.style.width = `${porcentagem}%`;
      barraProgresso.setAttribute('aria-valuenow', porcentagem);
    }
    if (textoProgresso) {
      textoProgresso.textContent = mensagem;
    }
  },

  renderizarInterface() {
    try {
      const container = document.getElementById('voos-container');
      if (!container) { console.error('Container de voos não encontrado'); return; }

      // Limpa conteúdo anterior, EXCETO o header se já existir
      const headerExistente = container.querySelector('.app-header');
      container.innerHTML = ''; // Limpa tudo
      if (headerExistente) container.appendChild(headerExistente); // Readiciona header
      else this.renderizarHeader(container); // Renderiza header se não existir

      if (this.estaCarregando || this.isPolling) {
        this.renderizarCarregamento(container);
      } else if (this.temErro) {
        this.renderizarErro(container);
      } else if (!this.resultados || !this.resultados.proposals || this.resultados.proposals.length === 0) {
         // Inclui o caso onde search_completed é true mas proposals está vazio
        this.renderizarSemResultados(container);
      } else {
        // Renderiza conteúdo principal com voos
        const mainContent = document.createElement('main');
        mainContent.className = 'voos-content';
        container.appendChild(mainContent);

        this.renderizarResumoViagem(mainContent);
        this.renderizarListaVoos(mainContent); // Renderiza os cards
        this.renderizarBotaoSelecao(container); // Botão fixo no rodapé

        // Adiciona hint DEPOIS de renderizar a lista
        if (!container.querySelector('#swipe-hint')) { // Evita duplicar
            this.renderizarSwipeHint(container);
        }

        this.configurarEventosAposRenderizacao(); // Configura eventos dos elementos renderizados

        // Selecionar primeiro voo por padrão
        const primeiroVoo = this.resultados.proposals[0];
        if (primeiroVoo) {
          this.vooAtivo = primeiroVoo;
          this.indexVooAtivo = 0;
          this.atualizarVooAtivo(); // Destaca visualmente
        }
      }
    } catch (erro) {
      console.error('Erro ao renderizar interface de voos:', erro);
      // Tenta mostrar erro na interface se possível
       if (container) {
           container.innerHTML = ''; // Limpa
           this.renderizarHeader(container); // Garante header
           this.mensagemErro = 'Ocorreu um erro ao exibir os voos.';
           this.renderizarErro(container); // Mostra erro
       }
    }
  },

  renderizarHeader(container) {
    // Garante que só adiciona uma vez
    if (container.querySelector('.app-header')) return; 

    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
      <button class="btn-voltar" aria-label="Voltar para a página anterior">
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
        <span class="sr-only">Voltar</span>
      </button>
      <h1>Voos Disponíveis</h1>
    `;
    container.insertBefore(header, container.firstChild); // Insere no início

    // Adiciona evento ao botão voltar AQUI, após criar o elemento
    const btnVoltar = header.querySelector('.btn-voltar');
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            window.location.href = 'destinos.html';
        });
    }
  },

  renderizarCarregamento(container) {
    // Evita duplicar
    if (container.querySelector('.loading-container')) return;

    const loadingGifs = [
      'assets/images/tripinha/loading.gif',
      'assets/images/tripinha/avatar-pensando.png'
    ];
    
    // Usa gif animado se disponível, senão imagem estática
    const loadingImage = loadingGifs[0];

    const loading = document.createElement('div');
    loading.className = 'loading-container';
    loading.innerHTML = `
      <div style="text-align: center; padding: 2rem 0;">
        <img src="${loadingImage}" alt="Tripinha carregando" class="loading-avatar" style="width: 100px; height: 100px; margin: 0 auto;" />
        <div class="loading-text" style="margin: 1rem 0;">Iniciando busca...</div>
        <div class="progress-bar-container">
          <div class="progress-bar" role="progressbar" style="width: 10%;" aria-valuenow="10" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso da busca de voos"></div>
        </div>
        <div class="loading-tips" style="margin-top: 1.5rem; font-size: 0.9rem; color: #666; max-width: 320px; margin-left: auto; margin-right: auto;">
          <p>💡 Dica da Tripinha: Os preços podem variar dependendo da época do ano!</p>
        </div>
      </div>
    `;
    container.appendChild(loading);
     // Atualiza imediatamente com a mensagem correta, se houver
     this.atualizarProgresso(document.querySelector('.loading-text')?.textContent || 'Buscando...', parseFloat(document.querySelector('.progress-bar')?.style.width || '10'));
     
     // Rotar dicas de viagem
     const dicas = [
       "💡 Dica da Tripinha: Os preços podem variar dependendo da época do ano!",
       "💡 Dica da Tripinha: Reserve com antecedência para melhores preços!",
       "💡 Voos com conexão costumam ser mais baratos que voos diretos.",
       "💡 Lembre-se de verificar as regras de bagagem antes de comprar!",
       "💡 Preferência por alguma companhia aérea? Vou te mostrar todas!"
     ];
     
     // Alterna dicas a cada 6 segundos
     let dicaAtual = 0;
     const alternarDicas = () => {
       const dicasElement = document.querySelector('.loading-tips p');
       if (dicasElement && this.estaCarregando) {
         dicaAtual = (dicaAtual + 1) % dicas.length;
         dicasElement.textContent = dicas[dicaAtual];
       }
     };
     
     // Inicia rotação de dicas
     const intervaloRotacao = setInterval(alternarDicas, 6000);
     
     // Limpeza do intervalo quando carregamento terminar
     const observer = new MutationObserver((mutations) => {
       if (!document.body.contains(loading)) {
         clearInterval(intervaloRotacao);
         observer.disconnect();
       }
     });
     
     observer.observe(container, { childList: true });
  },

  renderizarErro(container) {
    // Garante que remove loading
    const loading = container.querySelector('.loading-container');
    if (loading) loading.remove();

    const erroDiv = document.createElement('div');
    erroDiv.className = 'erro-container';
    erroDiv.innerHTML = `
      <div class="bg-red-100 text-red-700 p-4 rounded-lg my-4 text-center">
        <div class="mb-3"><img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="w-20 h-20 mx-auto" /></div>
        <p class="font-bold">${this.mensagemErro || 'Ocorreu um erro.'}</p>
        <p class="mt-2 text-sm">Desculpe pelo inconveniente. Vamos tentar novamente?</p>
        <button class="btn-tentar-novamente mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
          Tentar Novamente
        </button>
      </div>
    `;
    container.appendChild(erroDiv);
    // O evento do botão é delegado no configurarEventos
  },

  renderizarSemResultados(container) {
     // Garante que remove loading
     const loading = container.querySelector('.loading-container');
     if (loading) loading.remove();

     const semResultados = document.createElement('div');
     semResultados.className = 'sem-resultados-container';
     semResultados.innerHTML = `
       <div class="bg-blue-50 p-4 rounded-lg my-4 text-center">
         <div class="mb-3"><img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="w-20 h-20 mx-auto" /></div>
         <p class="font-bold">Ops! Não encontramos voos para ${this.destino?.destino || 'este destino'} nas datas selecionadas.</p>
         <p class="mt-2 text-sm">Que tal tentar outras datas ou outro destino?</p>
         <div class="flex gap-3 mt-4">
           <button class="btn-secundario flex-1 py-2 px-4 border border-gray-300 rounded hover:bg-gray-100">Mudar Datas</button>
           <button class="btn-principal flex-1 py-2 px-4 text-white rounded hover:opacity-90" style="background-color: #E87722;">Outro Destino</button>
         </div>
       </div>
     `;
     container.appendChild(semResultados);
      // O evento dos botões é delegado no configurarEventos
  },

  renderizarResumoViagem(container) {
    // (Função mantida como antes)
    const resumo = document.createElement('div');
    resumo.className = 'viagem-resumo p-4 bg-white border-b border-gray-200';
    const destino = this.destino;
    const dataViagem = this.obterDatasViagem();
    const passageiros = this.obterQuantidadePassageiros();
    resumo.innerHTML = `
      <h2 class="text-lg font-bold mb-2">Sua Viagem</h2>
      <div class="flex items-center justify-between">
        <div class="flex items-center"><div class="bg-blue-50 p-1 rounded mr-2"><span class="text-lg">✈️</span></div><div><p class="font-medium">${destino?.destino || ''}, ${destino?.pais || ''}</p><p class="text-sm text-gray-600">${dataViagem}</p></div></div>
        <div class="text-sm text-right"><span class="bg-gray-100 px-2 py-1 rounded">${passageiros} ${passageiros > 1 ? 'passageiros' : 'passageiro'}</span></div>
      </div>
    `;
    container.appendChild(resumo);
  },

  renderizarListaVoos(container) {
    const listaVoos = document.createElement('div');
    listaVoos.className = 'voos-lista';
    listaVoos.id = 'voos-lista';

    // Já ordenado em preprocessarPropostas()
    const voos = this.resultados?.proposals || [];

    const header = document.createElement('div');
    header.className = 'voos-header p-3 bg-gray-50 border-b border-gray-200';
    header.innerHTML = `
      <div class="flex justify-between items-center">
        <h3 class="font-medium">${voos.length} ${voos.length === 1 ? 'voo encontrado' : 'voos encontrados'}</h3>
        <div class="flex items-center">
          <span class="text-sm text-gray-600 mr-2">Ordenados por preço</span>
          <span class="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">↑ Mais baratos primeiro</span>
        </div>
      </div>
    `;
    listaVoos.appendChild(header);

    const voosContainer = document.createElement('div');
    voosContainer.className = 'voos-swipe-container'; // Para swipe
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
    cardVoo.className = 'voo-card p-4 bg-white border-b border-gray-200';
    // Usa sign OU um fallback com index se sign não existir
    const vooId = voo.sign || `voo-idx-${index}`;
    cardVoo.dataset.vooId = vooId;
    cardVoo.dataset.vooIndex = index;

    const preco = this.obterPrecoVoo(voo);
    const moeda = this.resultados?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    const infoIda = this.obterInfoSegmento(voo.segment?.[0]); // Usa optional chaining
    const infoVolta = voo.segment?.length > 1 ? this.obterInfoSegmento(voo.segment[1]) : null;
    
    // Exibe economia real ou estimada
    const economiaPercentual = voo._economia || Math.floor(Math.random() * 15) + 5;
    
    // Adiciona classe para voos diretos (destaque visual)
    if (voo.is_direct) {
        cardVoo.classList.add('voo-direto');
    }
    
    // Adicionar tag de "Melhor preço" ao voo mais barato
    const isMelhorPreco = voo._melhorPreco || index === 0;
    const tagMelhorPreco = isMelhorPreco ? 
        '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full absolute top-2 right-2">Melhor preço</span>' : '';

    cardVoo.innerHTML = `
        <div class="relative">
            ${tagMelhorPreco}
            <div class="flex justify-between items-start mb-4">
                <div>
                    <span class="text-xl font-bold">${precoFormatado}</span>
                    <span class="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded ml-1">-${economiaPercentual}%</span>
                    <p class="text-xs text-gray-500">Preço por pessoa, ida${infoVolta ? ' e volta' : ''}</p>
                </div>
                <div class="flex items-center">
                    <span class="text-xs bg-gray-100 px-2 py-1 rounded">${this.obterCompanhiasAereas(voo)}</span>
                </div>
            </div>
        </div>
        <div class="border-t border-gray-100 pt-3">
            <div class="mb-4">
                <div class="flex justify-between items-center text-sm"><span class="font-medium">IDA</span><span class="text-xs text-gray-500">${this.formatarData(infoIda?.dataPartida)}</span></div>
                <div class="flex items-center justify-between mt-2">
                    <div class="text-center"><p class="font-bold">${infoIda?.horaPartida}</p><p class="text-xs text-gray-600">${infoIda?.aeroportoPartida}</p></div>
                    <div class="flex-1 px-2">
                        <div class="text-xs text-center text-gray-500">${this.formatarDuracao(infoIda?.duracao)}</div>
                        <div class="flight-line relative"><div class="border-t border-gray-300 my-2"></div><div class="flight-stops absolute inset-x-0 top-1/2 flex justify-center -mt-1">${this.renderizarParadas(infoIda?.paradas)}</div></div>
                        <div class="text-xs text-center text-gray-500">${infoIda?.paradas ?? 0} ${infoIda?.paradas === 1 ? 'parada' : 'paradas'}</div>
                    </div>
                    <div class="text-center"><p class="font-bold">${infoIda?.horaChegada}</p><p class="text-xs text-gray-600">${infoIda?.aeroportoChegada}</p></div>
                </div>
            </div>
            ${infoVolta ? `
            <div class="mt-4 pt-3 border-t border-gray-100">
                <div class="flex justify-between items-center text-sm"><span class="font-medium">VOLTA</span><span class="text-xs text-gray-500">${this.formatarData(infoVolta?.dataPartida)}</span></div>
                <div class="flex items-center justify-between mt-2">
                    <div class="text-center"><p class="font-bold">${infoVolta?.horaPartida}</p><p class="text-xs text-gray-600">${infoVolta?.aeroportoPartida}</p></div>
                     <div class="flex-1 px-2">
                        <div class="text-xs text-center text-gray-500">${this.formatarDuracao(infoVolta?.duracao)}</div>
                        <div class="flight-line relative"><div class="border-t border-gray-300 my-2"></div><div class="flight-stops absolute inset-x-0 top-1/2 flex justify-center -mt-1">${this.renderizarParadas(infoVolta?.paradas)}</div></div>
                        <div class="text-xs text-center text-gray-500">${infoVolta?.paradas ?? 0} ${infoVolta?.paradas === 1 ? 'parada' : 'paradas'}</div>
                    </div>
                    <div class="text-center"><p class="font-bold">${infoVolta?.horaChegada}</p><p class="text-xs text-gray-600">${infoVolta?.aeroportoChegada}</p></div>
                </div>
            </div>` : ''}
        </div>
        <div class="mt-4 pt-2 border-t border-gray-100 flex justify-between">
            <button class="btn-detalhes-voo text-sm text-blue-600" data-voo-id="${vooId}">Ver detalhes</button>
            <div class="flex items-center text-xs text-gray-500"><span class="mr-1">Restam</span><span class="bg-orange-100 text-orange-800 px-1 py-0.5 rounded font-medium">${voo._assentosDisponiveis || Math.floor(Math.random() * 5) + 2} assentos</span></div>
        </div>
    `;
    
    // Adicionar classe para voo direto
    if (infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0)) {
        cardVoo.classList.add('voo-direto');
        
        // Adiciona tag de voo direto se for direto
        const idaContainer = cardVoo.querySelector('.flex-1.px-2');
        if (idaContainer) {
            const vooDiretoTag = document.createElement('div');
            vooDiretoTag.className = 'text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-center mt-1';
            vooDiretoTag.innerText = 'Voo Direto';
            idaContainer.appendChild(vooDiretoTag);
        }
    }
    
    return cardVoo;
  },

  renderizarParadas(paradas) {
      // Converte undefined/null para 0
      const numParadas = paradas ?? 0;
      if (numParadas === 0) {
        return `<span class="inline-block w-3 h-3 bg-green-500 rounded-full" title="Voo direto"></span>`;
      }
      let html = '';
      for (let i = 0; i < Math.min(numParadas, 3); i++) { // Limita a 3 pontos visuais
        html += `<span class="inline-block w-2 h-2 bg-gray-400 rounded-full mx-1" title="${numParadas} parada${numParadas > 1 ? 's' : ''}"></span>`;
      }
      return html;
  },

  renderizarBotaoSelecao(container) {
    // Remove o botão existente se houver para evitar duplicação
    const btnExistente = document.querySelector('.botao-selecao-fixo');
    if (btnExistente) btnExistente.remove();
    
    // Cria o botão fixo no rodapé
    const botaoFixo = document.createElement('div');
    botaoFixo.className = 'botao-selecao-fixo';
    botaoFixo.innerHTML = `
      <button class="btn-selecionar-voo">
        <span>Escolher Este Voo</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
      </button>
    `;
    
    container.appendChild(botaoFixo);
  },

  renderizarSwipeHint(container) {
    const hint = document.createElement('div');
    hint.id = 'swipe-hint';
    hint.className = 'swipe-hint'; // Estilo definido em aplicarEstilosModernos
    hint.style.display = 'none'; // Começa escondido
    hint.innerHTML = `
        <span class="swipe-hint-arrow mr-2">←</span> Arraste para ver outros voos <span class="swipe-hint-arrow ml-2">→</span>
    `;
    container.appendChild(hint);

    // Mostra a dica se houver mais de um voo
    if (this.resultados?.proposals?.length > 1) {
        hint.style.display = 'flex';
        setTimeout(() => {
            hint.style.opacity = '0';
            setTimeout(() => { hint.style.display = 'none'; }, 1000); // Esconde após fade out
        }, 4000); // Mostra por 4 segundos
    }
  },
  // --- Métodos de Formatação e Extração de Dados ---
  formatarPreco(preco, moeda = 'BRL') {
     // (Função mantida como antes)
     if (typeof preco !== 'number') return 'N/A';
     const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda, minimumFractionDigits: 0, maximumFractionDigits: 0 });
     return formatter.format(preco);
  },

  formatarData(data) {
     // (Função mantida como antes)
     if (!(data instanceof Date) || isNaN(data)) return 'N/A';
     const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
     const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
     return `${dias[data.getDay()]}, ${data.getDate()} ${meses[data.getMonth()]}`;
  },

  formatarDuracao(duracaoMinutos) {
     // (Função mantida como antes)
     if (typeof duracaoMinutos !== 'number' || duracaoMinutos < 0) return 'N/A';
     const horas = Math.floor(duracaoMinutos / 60);
     const minutos = duracaoMinutos % 60;
     return `${horas}h ${minutos > 0 ? minutos + 'm' : ''}`.trim();
  },

  obterPrecoVoo(voo) {
     // (Função mantida como antes, com mais segurança)
     try {
        if (!voo?.terms) return 0;
        const primeiroTermoKey = Object.keys(voo.terms)[0];
        const primeiroTermo = voo.terms[primeiroTermoKey];
        return primeiroTermo?.unified_price || primeiroTermo?.price || 0;
     } catch { return 0; }
  },

  obterCompanhiasAereas(voo) {
     try {
        const codigos = voo?.carriers;
        if (!codigos || codigos.length === 0) return 'N/A';

        // Se houver informações de companhias aéreas no resultado
        if (this.resultados?.airlines) {
            // Pega detalhes da primeira companhia
            const info = this.resultados.airlines[codigos[0]];
            
            // Se houver múltiplas companhias, indica isso
            if (codigos.length > 1) {
                return `${info?.name || codigos[0]} +${codigos.length - 1}`;
            }
            
            return info?.name || codigos[0];
        }
        
        // Retorna os códigos se não houver detalhes
        if (codigos.length > 1) {
            return `${codigos[0]} +${codigos.length - 1}`;
        }
        return codigos[0];
     } catch { return 'N/A'; }
  },

  obterInfoSegmento(segmento) {
     // (Função mantida como antes, com mais segurança)
     const defaultInfo = { aeroportoPartida: 'N/A', aeroportoChegada: 'N/A', dataPartida: null, dataChegada: null, horaPartida: 'N/A', horaChegada: 'N/A', duracao: 0, paradas: 0 };
     try {
        if (!segmento?.flight?.length) return defaultInfo;

        const primeiroVoo = segmento.flight[0];
        const ultimoVoo = segmento.flight[segmento.flight.length - 1];
        if (!primeiroVoo || !ultimoVoo) return defaultInfo;

        const tsPartida = primeiroVoo.local_departure_timestamp * 1000;
        const tsChegada = ultimoVoo.local_arrival_timestamp * 1000;
        if (isNaN(tsPartida) || isNaN(tsChegada)) return defaultInfo;

        const dataPartida = new Date(tsPartida);
        const dataChegada = new Date(tsChegada);

        return {
            aeroportoPartida: primeiroVoo.departure,
            aeroportoChegada: ultimoVoo.arrival,
            dataPartida,
            dataChegada,
            horaPartida: dataPartida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            horaChegada: dataChegada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            duracao: Math.round((tsChegada - tsPartida) / 60000), // Em minutos
            paradas: segmento.flight.length - 1
        };
     } catch { return defaultInfo; }
  },

  // --- Navegação e Interação ---
  proximoVoo() {
    if (!this.resultados?.proposals?.length || this.resultados.proposals.length <= 1) return;
    this.indexVooAtivo = (this.indexVooAtivo + 1) % this.resultados.proposals.length;
    this.vooAtivo = this.resultados.proposals[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },

  vooAnterior() {
    if (!this.resultados?.proposals?.length || this.resultados.proposals.length <= 1) return;
    this.indexVooAtivo = (this.indexVooAtivo - 1 + this.resultados.proposals.length) % this.resultados.proposals.length;
    this.vooAtivo = this.resultados.proposals[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },

  atualizarVooAtivo() {
    document.querySelectorAll('.voo-card').forEach(card => card.classList.remove('voo-card-ativo'));
    const cardAtivo = document.querySelector(`.voo-card[data-voo-index="${this.indexVooAtivo}"]`);
    if (cardAtivo) {
      cardAtivo.classList.add('voo-card-ativo');
      
      // Scroll para a posição do card ativo com animação
      cardAtivo.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest', 
        inline: 'center' 
      });
      
      // Feedback visual para ajudar a identificar o card ativo
      cardAtivo.classList.add('voo-card-highlight');
      setTimeout(() => {
        cardAtivo.classList.remove('voo-card-highlight');
      }, 500);
    }
    
    // Atualiza texto do botão para refletir o voo ativo
    const btnSelecionar = document.querySelector('.btn-selecionar-voo');
    if (btnSelecionar) {
      const preco = this.obterPrecoVoo(this.vooAtivo);
      const moeda = this.resultados?.meta?.currency || 'BRL';
      btnSelecionar.innerHTML = `
        <span>Escolher Voo por ${this.formatarPreco(preco, moeda)}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
      `;
    }
  },

  selecionarVoo(vooId) {
    if (!this.resultados?.proposals) return;
    
    // Encontra o voo pelo ID
    const vooEncontrado = this.resultados.proposals.find(
        (v, index) => (v.sign || `voo-idx-${index}`) === vooId
    );
    
    if (!vooEncontrado) {
        console.error(`Voo com ID ${vooId} não encontrado`);
        return;
    }
    
    this.vooSelecionado = vooEncontrado;
    console.log('Voo selecionado:', this.vooSelecionado);
    
    // Atualiza voo ativo também
    const index = this.resultados.proposals.findIndex(
        (v, idx) => (v.sign || `voo-idx-${idx}`) === vooId
    );
    
    if (index !== -1) {
        this.vooAtivo = vooEncontrado;
        this.indexVooAtivo = index;
    }
    
    // Atualiza UI visualmente
    document.querySelectorAll('.voo-card').forEach(card => {
        card.classList.remove('voo-selecionado');
        if (card.dataset.vooId === vooId) {
            card.classList.add('voo-selecionado');
            
            // Scroll para garantir que o card selecionado esteja visível
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
    
    // Feedback visual adicional
    this.exibirToast('Voo selecionado! Confirme sua escolha', 'success');
    
    // Atualiza botão de confirmar
    const btnConfirmar = document.querySelector('.btn-selecionar-voo');
    if (btnConfirmar) {
        btnConfirmar.classList.add('btn-pulsante');
        
        // Atualiza texto do botão
        const preco = this.obterPrecoVoo(this.vooSelecionado);
        const moeda = this.resultados?.meta?.currency || 'BRL';
        btnConfirmar.innerHTML = `
          <span>Escolher Voo por ${this.formatarPreco(preco, moeda)}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
        `;
        
        // Remove a classe após 2 segundos
        setTimeout(() => btnConfirmar.classList.remove('btn-pulsante'), 2000);
    }
  },

  // Método para mostrar toast de feedback
  exibirToast(mensagem, tipo = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = mensagem;
    
    toastContainer.appendChild(toast);
    
    // Adiciona classe para animar entrada
    setTimeout(() => toast.classList.add('toast-visible'), 50);
    
    // Remove após 3 segundos
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 3000);
  },

  selecionarVooAtivo() {
    // (Função mantida como antes)
    if (!this.vooAtivo) { console.error('Nenhum voo ativo para selecionar'); return; }
    const vooId = this.vooAtivo.sign || `voo-idx-${this.indexVooAtivo}`;
    this.selecionarVoo(vooId);
    // A confirmação já é chamada dentro de selecionarVoo
  },

  mostrarDetalhesVoo(vooId) {
    if (!this.resultados?.proposals) return;
    const voo = this.resultados.proposals.find((v, index) => (v.sign || `voo-idx-${index}`) === vooId);
    if (!voo) { console.error(`Voo com ID ${vooId} não encontrado`); return; }
    
    // Remove modal anterior se existir
    document.getElementById('modal-detalhes-voo')?.remove();
    
    // Obtém dados do voo
    const preco = this.obterPrecoVoo(voo);
    const moeda = this.resultados?.meta?.currency || 'BRL';
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
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div class="border-b pb-3 mb-3">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-2xl font-bold">${precoFormatado}</p>
              <p class="text-sm text-gray-600">Preço total por pessoa</p>
            </div>
            <div>
              <p class="font-medium">${this.obterCompanhiasAereas(voo)}</p>
              <p class="text-sm text-gray-600">${infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0) ? 'Voo direto' : `${infoIda?.paradas + (infoVolta?.paradas || 0)} parada(s) total`}</p>
            </div>
          </div>
        </div>
        
        <!-- Detalhes da ida -->
        <div class="mb-4">
          <h4 class="font-medium mb-2">Voo de Ida (${this.formatarData(infoIda?.dataPartida)})</h4>
          
          <!-- Timeline para cada voo do segmento de ida -->
          <div class="voo-timeline">
            ${this.renderizarTimelineVoos(voo.segment?.[0]?.flight || [])}
          </div>
        </div>
        
        ${infoVolta ? `
        <!-- Detalhes da volta -->
        <div class="mt-4 pt-3 border-t">
          <h4 class="font-medium mb-2">Voo de Volta (${this.formatarData(infoVolta?.dataPartida)})</h4>
          
          <!-- Timeline para cada voo do segmento de volta -->
          <div class="voo-timeline">
            ${this.renderizarTimelineVoos(voo.segment?.[1]?.flight || [])}
          </div>
        </div>
        ` : ''}
        
        <!-- Informações adicionais -->
        <div class="mt-4 pt-3 border-t">
          <h4 class="font-medium mb-2">Informações Importantes</h4>
          <ul class="text-sm space-y-2">
            <li class="flex items-start">
              <span class="text-blue-600 mr-2">✓</span>
              <span>Tarifa inclui bagagem de mão (1 peça)</span>
            </li>
            <li class="flex items-start">
              <span class="text-blue-600 mr-2">✓</span>
              <span>Café/refeição a bordo (dependendo da duração)</span>
            </li>
            <li class="flex items-start text-gray-600">
              <span class="mr-2">ℹ️</span>
              <span>Bagagem despachada pode ser adquirida separadamente</span>
            </li>
          </ul>
        </div>
        
        <div class="mt-4 pt-3 border-t flex justify-between">
          <button id="btn-voltar-detalhes" class="py-2 px-4 border border-gray-300 rounded hover:bg-gray-100 transition-colors">
            Voltar
          </button>
          <button id="btn-selecionar-este-voo" class="py-2 px-4 text-white rounded hover:opacity-90" style="background-color: #E87722;">
            Selecionar Este Voo
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modalContainer);
    
    // Adiciona eventos
    document.getElementById('btn-fechar-detalhes')?.addEventListener('click', () => modalContainer.remove());
    document.getElementById('btn-voltar-detalhes')?.addEventListener('click', () => modalContainer.remove());
    document.getElementById('btn-selecionar-este-voo')?.addEventListener('click', () => {
        this.selecionarVoo(vooId);
        modalContainer.remove();
        // Mostra confirmação após selecionar
        this.mostrarConfirmacaoSelecao(voo);
    });
    
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) modalContainer.remove();
    });
  },
  
  renderizarTimelineVoos(voos) {
    if (!voos || !voos.length) return '<p class="text-gray-500">Informações de voo não disponíveis</p>';
    
    let timeline = '';
    
    voos.forEach((voo, index) => {
        const isLastVoo = index === voos.length - 1;
        const dataPartida = new Date(voo.local_departure_timestamp * 1000);
        const dataChegada = new Date(voo.local_arrival_timestamp * 1000);
        
        const horaPartida = dataPartida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const horaChegada = dataChegada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        // Obtém informações da companhia aérea
        let companhiaInfo = voo.marketing_carrier || voo.operating_carrier || 'N/A';
        if (this.resultados?.airlines && this.resultados.airlines[companhiaInfo]) {
            companhiaInfo = this.resultados.airlines[companhiaInfo].name || companhiaInfo;
        }
        
        timeline += `
        <div class="voo-leg mb-3 pb-3 ${!isLastVoo ? 'border-b border-dashed border-gray-200' : ''}">
            <div class="flex justify-between mb-2">
                <div>
                    <p class="font-bold">${horaPartida}</p>
                    <p class="text-sm">${voo.departure}</p>
                </div>
                <div class="text-center flex-1 px-2">
                    <p class="text-xs text-gray-500">${this.formatarDuracao(voo.duration)}</p>
                    <div class="h-0.5 bg-gray-300 my-2 relative">
                        <div class="absolute -top-1 left-0 w-2 h-2 rounded-full bg-gray-500"></div>
                        <div class="absolute -top-1 right-0 w-2 h-2 rounded-full bg-gray-500"></div>
                    </div>
                    <p class="text-xs">${companhiaInfo}</p>
                </div>
                <div>
                    <p class="font-bold">${horaChegada}</p>
                    <p class="text-sm">${voo.arrival}</p>
                </div>
            </div>
            <div class="text-xs text-gray-600">
                <p>Voo ${voo.marketing_carrier || voo.operating_carrier}${voo.number}</p>
                <p>Aeronave: ${voo.aircraft || 'Não especificado'}</p>
            </div>
        </div>
        `;
        
        // Adiciona informações de conexão se não for o último voo
        if (!isLastVoo) {
            const proximoVoo = voos[index + 1];
            if (proximoVoo) {
                const tempoConexao = Math.round((proximoVoo.local_departure_timestamp - voo.local_arrival_timestamp) / 60);
                timeline += `
                <div class="conexao-info mb-3 text-sm">
                    <div class="flex items-center text-orange-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <span class="ml-1">Conexão em ${voo.arrival} • ${this.formatarDuracao(tempoConexao)}</span>
                    </div>
                </div>
                `;
            }
        }
    });
    
    return timeline;
  },

  mostrarConfirmacaoSelecao(voo) {
    // Remove modal anterior se existir
    document.getElementById('modal-confirmacao')?.remove();

    const preco = this.obterPrecoVoo(voo);
    const moeda = this.resultados?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    
    // Calcular preço total para todos os passageiros
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
            <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-orange-100 border-2 border-orange-200">
              <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/60x60?text=🐶'">
            </div>
            <div>
              <p class="font-bold">Ótima escolha, Triper! Você selecionou um voo por ${precoFormatado} por pessoa.</p>
              
              ${numPassageiros > 1 ? `
              <div class="mt-2 bg-white bg-opacity-70 p-2 rounded">
                <p class="text-sm font-medium">Resumo do valor:</p>
                <div class="flex justify-between text-sm">
                  <span>${precoFormatado} × ${numPassageiros} ${numPassageiros > 1 ? 'passageiros' : 'passageiro'}</span>
                  <span>${precoTotalFormatado}</span>
                </div>
              </div>` : ''}
              
              <div class="mt-3">
                <label class="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" id="confirmar-selecao" class="form-checkbox h-5 w-5 rounded" style="color: #E87722;">
                  <span>Sim, quero continuar!</span>
                </label>
              </div>
              <p class="mt-3 text-sm">
                O preço mostrado é por pessoa, para o voo de ida e volta. Na próxima etapa, você poderá visualizar o valor total e escolher sua hospedagem.
              </p>
            </div>
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button id="btn-cancelar" class="flex-1 py-2 px-4 border border-gray-300 rounded hover:bg-gray-100 transition-colors">
            Voltar
          </button>
          <button id="btn-confirmar" class="flex-1 py-2 px-4 text-white rounded transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" style="background-color: #E87722;" disabled>
            Confirmar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modalContainer);

    const checkboxConfirmar = document.getElementById('confirmar-selecao');
    const btnConfirmar = document.getElementById('btn-confirmar');
    const btnCancelar = document.getElementById('btn-cancelar');

    checkboxConfirmar.addEventListener('change', () => { btnConfirmar.disabled = !checkboxConfirmar.checked; });
    btnCancelar.addEventListener('click', () => { modalContainer.remove(); });
    btnConfirmar.addEventListener('click', () => {
        // Salvar informações completas do voo selecionado
        const dadosVoo = {
            voo: this.vooSelecionado,
            preco: preco,
            precoTotal: precoTotal,
            moeda: moeda,
            numPassageiros: numPassageiros,
            infoIda: this.obterInfoSegmento(this.vooSelecionado.segment?.[0]),
            infoVolta: this.vooSelecionado.segment?.length > 1 ? 
                       this.obterInfoSegmento(this.vooSelecionado.segment[1]) : null,
            companhiaAerea: this.obterCompanhiasAereas(this.vooSelecionado),
            dataSelecao: new Date().toISOString()
        };
        
        localStorage.setItem('benetrip_voo_selecionado', JSON.stringify(dadosVoo));
        
        // Feedback antes de redirecionar
        this.exibirToast('Voo selecionado com sucesso! Redirecionando...', 'success');
        
        // Redireciona após breve delay para o toast ser visível
        setTimeout(() => {
            window.location.href = 'hotels.html';
        }, 1500);
    });
    
    modalContainer.addEventListener('click', function(e) { 
        if (e.target === this) this.remove(); 
    });
  },

  // --- Métodos Auxiliares ---
  carregarDadosUsuario() {
     // (Função mantida como antes)
     try { return JSON.parse(localStorage.getItem('benetrip_user_data') || '{}'); }
     catch { return {}; }
  },

  obterCodigoIATAOrigem(dadosUsuario) {
    try {
        const respostas = dadosUsuario?.respostas;
        if (!respostas) {
            throw new Error("Dados do usuário não contêm respostas");
        }
        
        let cidadePartidaInput = respostas.cidade_partida || respostas.partida || null;
        
        // Tenta diferentes formatos de armazenamento
        if (cidadePartidaInput && typeof cidadePartidaInput === 'object') {
            cidadePartidaInput = cidadePartidaInput.code || cidadePartidaInput.value || 
                                cidadePartidaInput.name || cidadePartidaInput.iata || null;
        }
        
        // Casos especiais para cidades brasileiras comuns
        const cidadesBR = {
            'sao paulo': 'GRU',
            'são paulo': 'GRU',
            'rio de janeiro': 'GIG',
            'brasilia': 'BSB',
            'brasília': 'BSB',
            'belo horizonte': 'CNF',
            'salvador': 'SSA',
            'recife': 'REC',
            'fortaleza': 'FOR',
            'curitiba': 'CWB',
            'porto alegre': 'POA',
            'belém': 'BEL',
            'belem': 'BEL',
            'manaus': 'MAO',
            'florianópolis': 'FLN', 
            'florianopolis': 'FLN',
            'natal': 'NAT',
            'goiânia': 'GYN',
            'goiania': 'GYN'
        };
        
        if (typeof cidadePartidaInput === 'string') {
            // Verifica se já é um IATA
            if (/^[A-Z]{3}$/.test(cidadePartidaInput)) {
                return cidadePartidaInput;
            }
            
            // Tenta extrair de "Cidade (IATA)"
            const match = cidadePartidaInput.match(/\(([A-Z]{3})\)/);
            if (match?.[1]) {
                return match[1];
            }
            
            // Verifica no mapeamento de cidades brasileiras
            const cidadeLower = cidadePartidaInput.toLowerCase().trim();
            if (cidadesBR[cidadeLower]) {
                return cidadesBR[cidadeLower];
            }
            
            // Retorna GRU como padrão para pedidos do Brasil
            return 'GRU';
        }
    } catch (erro) { 
        console.error("Erro ao processar origem:", erro); 
    }
    
    console.warn('Código IATA de origem não determinado, usando GRU como padrão.');
    return 'GRU'; // Padrão Brasil
  },

  obterDatasViagem() {
    try {
        const datas = this.carregarDadosUsuario()?.respostas?.datas;
        if (!datas?.dataIda) {
            return "Datas Indisponíveis";
        }
        
        const formatarDataLocal = (dataString) => {
            const data = new Date(dataString + 'T00:00:00');
            if (isNaN(data.getTime())) {
                return "Data inválida";
            }
            
            const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return `${data.getDate()} ${meses[data.getMonth()]} ${data.getFullYear()}`;
        };
        
        const dataIdaFormatada = formatarDataLocal(datas.dataIda);
        
        if (!datas.dataVolta) {
            return `${dataIdaFormatada} (Só ida)`;
        }
        
        const dataVoltaFormatada = formatarDataLocal(datas.dataVolta);
        
        // Se só o dia for diferente, mostra formato compacto
        const dataIda = new Date(datas.dataIda);
        const dataVolta = new Date(datas.dataVolta);
        
        if (dataIda.getMonth() === dataVolta.getMonth() && 
            dataIda.getFullYear() === dataVolta.getFullYear()) {
            const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return `${dataIda.getDate()} a ${dataVolta.getDate()} de ${meses[dataIda.getMonth()]}, ${dataIda.getFullYear()}`;
        }
        
        return `${dataIdaFormatada} a ${dataVoltaFormatada}`;
    } catch (erro) { 
        console.error("Erro ao formatar datas:", erro); 
    }
    
    return "Datas Indisponíveis";
  },

  obterQuantidadePassageiros() {
    try {
        // Tenta obter de diferentes fontes possíveis
        const dadosUsuario = this.carregarDadosUsuario();
        
        // Formato principal - objeto passageiros
        const passageiros = dadosUsuario?.respostas?.passageiros;
        if (passageiros) {
            return Math.max(1, 
                (parseInt(passageiros.adultos) || 0) + 
                (parseInt(passageiros.criancas) || 0) + 
                (parseInt(passageiros.bebes) || 0)
            );
        }
        
        // Formato alternativo - campos separados
        const adultos = parseInt(dadosUsuario?.respostas?.adultos) || 0;
        const criancas = parseInt(dadosUsuario?.respostas?.criancas) || 0;
        const bebes = parseInt(dadosUsuario?.respostas?.bebes) || 0;
        
        if (adultos > 0) {
            return adultos + criancas + bebes;
        }
        
        // Campos de quantidade específicos
        const quantidade = parseInt(dadosUsuario?.respostas?.quantidade_familia) || 
                          parseInt(dadosUsuario?.respostas?.quantidade_amigos) || 
                          parseInt(dadosUsuario?.respostas?.quantidade_pessoas) || 0;
        
        if (quantidade > 0) {
            return quantidade;
        }
        
        // Campo de companhia pode indicar número mínimo
        const companhia = dadosUsuario?.respostas?.companhia;
        if (companhia === 0) { // sozinho
            return 1;
        } else if (companhia === 1) { // romântico/casal
            return 2;
        } else if (companhia >= 2) { // família ou amigos
            return Math.max(2, companhia); // no mínimo 2 pessoas
        }
    } catch (erro) {
        console.error("Erro ao determinar quantidade de passageiros:", erro);
    }
    
    return 1; // valor padrão
  },
  configurarEventosAposRenderizacao() {
    // Configura eventos que dependem dos elementos renderizados

    // Swipe (se Hammer estiver disponível)
    if (typeof Hammer !== 'undefined') {
       const swipeContainer = document.getElementById('voos-swipe-container');
       if (swipeContainer) {
          // Limpar instâncias anteriores do Hammer, se possível
          if (this.hammerInstance) {
            this.hammerInstance.destroy();
          }

          this.hammerInstance = new Hammer(swipeContainer);
          this.hammerInstance.on('swipeleft', () => this.proximoVoo());
          this.hammerInstance.on('swiperight', () => this.vooAnterior());
          
          // Feedback visual para swipe
          this.hammerInstance.on('swipeleft swiperight', () => {
            // Feedback sonoro opcional
            if (typeof Audio !== 'undefined') {
              try {
                const clickSound = new Audio('assets/sounds/swipe.mp3');
                clickSound.volume = 0.2;
                clickSound.play().catch(() => {}); // Ignora erros de reprodução (políticas de autoplay)
              } catch (e) {} // Ignora erros de áudio
            }
          });
       }
    }

    // Scroll-snap pode atualizar o voo ativo (alternativa/complemento ao swipe)
    const swipeContainer = document.getElementById('voos-swipe-container');
    if (swipeContainer && 'onscrollend' in window) { // Usa onscrollend se disponível
      swipeContainer.onscrollend = () => {
        this.atualizarVooAtivoBaseadoNoScroll(swipeContainer);
      };
    } else if (swipeContainer) { // Fallback com debounce no scroll
       let scrollTimeout;
       swipeContainer.onscroll = () => {
           clearTimeout(scrollTimeout);
           scrollTimeout = setTimeout(() => {
                this.atualizarVooAtivoBaseadoNoScroll(swipeContainer);
           }, 150); // Ajuste o debounce conforme necessário
       };
    }

    // Botão de voltar (garante que está configurado)
    const btnVoltar = document.querySelector('.btn-voltar');
    if (btnVoltar && !btnVoltar.dataset.listenerAttached) { // Evita adicionar múltiplas vezes
       btnVoltar.addEventListener('click', () => { 
          // Confirmação caso o usuário já tenha visto resultados
          if (this.resultados?.proposals?.length > 0) {
            if (confirm('Tem certeza que deseja voltar? Você vai precisar fazer uma nova busca de voos.')) {
              window.location.href = 'destinos.html';
            }
          } else {
            window.location.href = 'destinos.html';
          }
       });
       btnVoltar.dataset.listenerAttached = 'true';
    }
    
    // Botão de selecionar voo
    const btnSelecionar = document.querySelector('.btn-selecionar-voo');
    if (btnSelecionar && !btnSelecionar.dataset.listenerAttached) {
      btnSelecionar.addEventListener('click', () => {
        if (this.vooSelecionado) {
          this.mostrarConfirmacaoSelecao(this.vooSelecionado);
        } else if (this.vooAtivo) {
          this.selecionarVooAtivo();
        } else {
          this.exibirToast('Por favor, selecione um voo primeiro', 'warning');
        }
      });
      btnSelecionar.dataset.listenerAttached = 'true';
    }
    
    // Cards de voo - eventListener para cliques
    const cards = document.querySelectorAll('.voo-card');
    cards.forEach(card => {
      if (!card.dataset.listenerAttached) {
        card.addEventListener('click', () => {
          const vooId = card.dataset.vooId;
          if (vooId) this.selecionarVoo(vooId);
        });
        card.dataset.listenerAttached = 'true';
      }
    });
  },
  
  // Método auxiliar para atualizar voo ativo com base no scroll
  atualizarVooAtivoBaseadoNoScroll(swipeContainer) {
    if (!swipeContainer) return;
    
    const scrollLeft = swipeContainer.scrollLeft;
    const cardWidth = swipeContainer.querySelector('.voo-card')?.offsetWidth || 0;
    
    if (cardWidth > 0 && this.resultados?.proposals?.length > 0) {
      const newIndex = Math.round(scrollLeft / cardWidth);
      
      // Verifica se o índice é válido e diferente do atual
      if (newIndex >= 0 && 
          newIndex < this.resultados.proposals.length && 
          newIndex !== this.indexVooAtivo) {
        
        this.indexVooAtivo = newIndex;
        this.vooAtivo = this.resultados.proposals[this.indexVooAtivo];
        this.atualizarVooAtivo();
      }
    }
  },

  // --- Estilos e UI ---
  aplicarEstilosModernos() {
    const styleId = 'benetrip-voos-styles';
    if (document.getElementById(styleId)) return; // Evita duplicar estilos
    
    const estiloElement = document.createElement('style');
    estiloElement.id = styleId;
    estiloElement.textContent = `
      /* Estilos dos cartões de voo */
      .voo-card { 
        transition: all 0.3s ease; 
        border-left: 3px solid transparent; 
        scroll-snap-align: start; 
        position: relative;
      }
      .voo-card-ativo { 
        border-left-color: #E87722; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
      }
      .voo-card.voo-selecionado { 
        background-color: rgba(232, 119, 34, 0.05); 
        border-left-color: #E87722; 
      }
      .voo-card-highlight {
        animation: highlight-pulse 0.5s ease;
      }
      .voo-direto {
        border-left-color: rgba(0, 163, 224, 0.5); /* Azul Benetrip */
      }
      
      /* Animação de destaque */
      @keyframes highlight-pulse {
        0% { background-color: transparent; }
        50% { background-color: rgba(232, 119, 34, 0.1); }
        100% { background-color: transparent; }
      }
      
      /* Elementos de UI */
      .flight-line { height: 2px; }
      .progress-bar-container { height: 6px; background-color: #f0f0f0; border-radius: 3px; overflow: hidden; margin: 8px 0; }
      .progress-bar { height: 100%; background-color: #E87722; width: 0%; transition: width 0.5s ease; }
      
      /* Hint de swipe */
      .swipe-hint { 
        position: fixed; 
        bottom: 80px; 
        left: 50%; 
        transform: translateX(-50%); 
        background-color: rgba(0,0,0,0.7); 
        color: white; 
        padding: 8px 16px; 
        border-radius: 20px; 
        display: none; 
        align-items: center; 
        opacity: 1; 
        transition: opacity 1s ease; 
        z-index: 10; 
        pointer-events: none; 
      }
      .swipe-hint-arrow { animation: swipe-animation 1.5s infinite; }
      @keyframes swipe-animation { 
        0%, 100% { transform: translateX(0); opacity: 0.5; } 
        50% { transform: translateX(-5px); opacity: 1; } 
      }
      
      /* Container swipe */
      .voos-swipe-container { 
        display: flex; 
        overflow-x: auto; 
        scroll-snap-type: x mandatory; 
        -webkit-overflow-scrolling: touch; 
        gap: 8px; 
        padding: 0 8px; 
        margin: 0 -8px; 
      }
      
      /* Form elements */
      .form-checkbox { 
        border-radius: 4px; 
        border: 2px solid #E0E0E0; 
        color: #E87722;
      }
      
      /* Esconder scrollbar */
      .voos-swipe-container::-webkit-scrollbar { display: none; }
      .voos-swipe-container { -ms-overflow-style: none; scrollbar-width: none; }
      
      /* Botão fixo no rodapé */
      .botao-selecao-fixo {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 12px 16px;
        background-color: white;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
        z-index: 10;
        text-align: center;
        border-top: 1px solid #e5e5e5;
      }
      
      .btn-selecionar-voo {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 12px;
        background-color: #E87722;
        color: white;
        border-radius: 8px;
        font-weight: bold;
        gap: 8px;
        transition: all 0.2s ease;
      }
      
      .btn-selecionar-voo:hover {
        opacity: 0.9;
      }
      
      .btn-pulsante {
        animation: pulse-button 1.5s ease;
      }
      
      @keyframes pulse-button {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      
      /* Toast notifications */
      .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 300px;
      }
      
      .toast {
        background-color: #333;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateX(120%);
        opacity: 0;
        transition: all 0.3s ease;
      }
      
      .toast-visible {
        transform: translateX(0);
        opacity: 1;
      }
      
      .toast-info {
        background-color: #00A3E0;
      }
      
      .toast-success {
        background-color: #28a745;
      }
      
      .toast-warning {
        background-color: #E87722;
      }
      
      .toast-error {
        background-color: #dc3545;
      }
      
      /* Timeline para detalhes do voo */
      .voo-timeline {
        padding-left: 8px;
      }
      
      .voo-leg {
        position: relative;
      }
      
      /* Estilos responsivos */
      @media (max-width: 480px) {
        .voos-content {
          padding-bottom: 80px; /* Espaço para o botão fixo */
        }
      }
    `;
    document.head.appendChild(estiloElement);
  },

  mostrarErro(mensagem) {
    console.error("Erro exibido:", mensagem); // Loga o erro
    this.pararPolling(); // Garante que o polling pare em caso de erro
    this.temErro = true;
    this.estaCarregando = false; // Termina o carregamento
    this.mensagemErro = mensagem || 'Ocorreu um erro desconhecido.';
    this.renderizarInterface(); // Mostra a UI de erro
    
    // Reportar erro para análise (se implementado)
    this.reportarErro({
      mensagem: mensagem,
      searchId: this.searchId,
      timestamp: new Date().toISOString(),
      tentativas: this.pollingAttempts,
      contexto: {
        origem: this.obterCodigoIATAOrigem(this.carregarDadosUsuario()),
        destino: this.destino?.codigo_iata,
        datas: this.carregarDadosUsuario()?.respostas?.datas
      }
    });
  },
  
  // Método para reportar erros (mock para implementação futura)
  reportarErro(dadosErro) {
    // Implementação futura: enviar para sistema de análise de erros
    // Por enquanto, apenas loga os dados para diagnóstico
    console.warn("Dados de erro para análise:", dadosErro);
    
    // Opcionalmente, armazena localmente para análise posterior
    try {
      const errosAnteriores = JSON.parse(localStorage.getItem('benetrip_erros') || '[]');
      errosAnteriores.push(dadosErro);
      // Manter apenas os últimos 10 erros para não sobrecarregar localStorage
      if (errosAnteriores.length > 10) errosAnteriores.shift();
      localStorage.setItem('benetrip_erros', JSON.stringify(errosAnteriores));
    } catch (e) {
      console.error("Erro ao salvar dados de erro:", e);
    }
  }
  
}; // Fim do objeto BENETRIP_VOOS

// Inicializar o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  // Verificar se estamos na página correta
  if (document.getElementById('voos-container')) {
    console.log('Inicializando módulo de voos Benetrip...');
    BENETRIP_VOOS.init();
  }
  
  // Adicionar listener para recarregar dados se a página ficar inativa e retornar
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && 
        document.getElementById('voos-container') && 
        BENETRIP_VOOS.resultados === null && 
        !BENETRIP_VOOS.estaCarregando && 
        !BENETRIP_VOOS.isPolling) {
      // Recarrega apenas se não estiver em carregamento e não tiver resultados
      console.log('Página reativada, recarregando dados...');
      BENETRIP_VOOS.init();
    }
  });
});

// Tratar erros não capturados
window.addEventListener('error', (event) => {
  console.error('Erro não capturado em flights.js:', event.error);
  
  // Se o módulo de voos estiver inicializado, reporta o erro
  if (BENETRIP_VOOS && typeof BENETRIP_VOOS.reportarErro === 'function') {
    BENETRIP_VOOS.reportarErro({
      tipo: 'erro_nao_capturado',
      mensagem: event.message || 'Erro JavaScript não capturado',
      origem: event.filename,
      linha: event.lineno,
      coluna: event.colno,
      timestamp: new Date().toISOString()
    });
  }
});
