/**
 * BENETRIP - Módulo de Busca e Exibição de Voos
 * Versão 2.2.0 - Polling Desacoplado
 * Este módulo gerencia a busca de voos: inicia a busca no backend,
 * e faz o polling dos resultados diretamente do frontend.
 */

// Módulo de Voos do Benetrip
const BENETRIP_VOOS = {
  // --- Constantes ---
  POLLING_INTERVAL_MS: 4000, // Intervalo entre chamadas de polling (4 segundos)
  MAX_POLLING_ATTEMPTS: 15,  // Máximo de tentativas de polling

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

  // --- Inicialização ---
  init() {
    console.log('Inicializando sistema de busca de voos v2.2.0 (Polling Frontend)...');
    this.configurarEventos(); // Configura eventos básicos primeiro

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
    });
  },

  // --- Carregar dados do destino selecionado ---
  async carregarDestino() {
    // (Função mantida como antes)
    try {
      const destinoString = localStorage.getItem('benetrip_destino_selecionado');
      if (!destinoString) throw new Error('Nenhum destino selecionado');
      this.destino = JSON.parse(destinoString);
      console.log('Destino carregado:', this.destino);
      if (!this.destino.codigo_iata && this.destino.aeroporto?.codigo) {
        this.destino.codigo_iata = this.destino.aeroporto.codigo;
      }
      if (!this.destino.codigo_iata) throw new Error('Código IATA do destino não encontrado');
      return true;
    } catch (erro) {
      console.error('Erro ao carregar destino:', erro);
      throw erro;
    }
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
        locale: 'pt' // Pode ajustar se necessário
      };

      console.log('Iniciando busca com parâmetros:', params);
      this.estaCarregando = true; // Mantém carregando até o fim do polling ou erro
      this.temErro = false;
      this.mensagemErro = '';
      this.atualizarProgresso('Iniciando busca de voos...', 10); // Progresso inicial
      this.renderizarInterface(); // Mostra tela de carregamento inicial

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
    this.isPolling = false;
  },

  async verificarResultadosPolling() {
    // Verifica se deve parar
    if (!this.isPolling) return; // Se já foi parado por outro motivo

    this.pollingAttempts++;
    console.log(`Polling: Tentativa ${this.pollingAttempts}/${this.MAX_POLLING_ATTEMPTS}`);

    // Atualiza UI
    const progresso = 20 + Math.min(60, (this.pollingAttempts / this.MAX_POLLING_ATTEMPTS) * 60); // Progresso de 20% a 80% durante polling
    this.atualizarProgresso(`Verificando voos (${this.pollingAttempts})...`, progresso);

    // Verifica limite de tentativas
    if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS) {
      this.pararPolling();
      this.mostrarErro('A busca demorou mais que o esperado. Tente novamente mais tarde.');
      return;
    }

    try {
      // Chama o NOVO endpoint de resultados
      const resposta = await fetch(`/api/flight-results?uuid=${this.searchId}`); // Usa 'uuid' como query param

      // Tratamento de erro básico da resposta HTTP
       if (!resposta.ok) {
          const errorData = await resposta.json().catch(() => ({})); // Tenta pegar JSON, senão objeto vazio
          const errorMessage = errorData.error || errorData.details?.error || `Erro ${resposta.status} ao buscar resultados.`;
          console.error(`Erro no polling (HTTP ${resposta.status}):`, errorMessage);

          // Se for 404, o searchId pode ter expirado ou ser inválido
          if (resposta.status === 404) {
              this.pararPolling();
              this.mostrarErro('A busca expirou ou é inválida. Por favor, tente novamente.');
          }
          // Para outros erros, pode continuar tentando por um tempo ou parar
          // Aqui, vamos parar em qualquer erro HTTP para simplificar
          else {
             this.pararPolling();
             this.mostrarErro(errorMessage);
          }
          return; // Sai da função após erro
       }

      // Processa a resposta JSON
      const dados = await resposta.json();
      console.log('Dados do polling:', dados);

      // Verifica se a busca foi concluída (com ou sem resultados)
      // A API pode retornar 'proposals' antes de 'search_completed' ser true em alguns casos.
      const temResultados = dados.proposals && dados.proposals.length > 0;
      const buscaCompleta = dados.search_completed === true; // Verifica explicitamente se é true

      if (temResultados || buscaCompleta) {
        console.log('Polling concluído!');
        this.pararPolling();
        this.estaCarregando = false; // Terminou o carregamento/polling
        this.resultados = dados; // Armazena TUDO (inclui meta, airlines, gates, etc.)

        if (temResultados) {
          this.atualizarProgresso('Voos encontrados!', 100);
        } else {
          // Busca completa, mas sem resultados
          this.atualizarProgresso('Busca finalizada.', 100); // Mensagem neutra
           // renderizarInterface vai mostrar a tela de "Sem Resultados"
        }
        this.renderizarInterface(); // Renderiza a interface final (com resultados ou mensagem)
      } else {
        // Busca ainda não concluída, continua no próximo intervalo
        console.log('Busca ainda em andamento...');
      }

    } catch (erro) {
      // Erro na chamada fetch (rede, etc.)
      console.error('Erro de rede ou inesperado durante o polling:', erro);
      this.pararPolling();
      this.mostrarErro('Erro de conexão ao verificar resultados. Verifique sua internet.');
    }
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
    // (Função mantida como antes, mas garante que só adiciona uma vez)
    if (container.querySelector('.app-header')) return; // Já existe

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
    // (Função mantida como antes)
    if (container.querySelector('.loading-container')) return; // Evita duplicar

    const loading = document.createElement('div');
    loading.className = 'loading-container';
    // Usa a mensagem e progresso atuais do estado
    loading.innerHTML = `
      <div style="text-align: center; padding: 2rem 0;">
        <img src="assets/images/tripinha/avatar-pensando.png" alt="Tripinha carregando" class="loading-avatar" style="width: 80px; height: 80px; margin: 0 auto;" />
        <div class="loading-text" style="margin: 1rem 0;">Iniciando busca...</div>
        <div class="progress-bar-container">
          <div class="progress-bar" role="progressbar" style="width: 10%;" aria-valuenow="10" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso da busca de voos"></div>
        </div>
      </div>
    `;
    container.appendChild(loading);
     // Atualiza imediatamente com a mensagem correta, se houver
     this.atualizarProgresso(document.querySelector('.loading-text')?.textContent || 'Buscando...', parseFloat(document.querySelector('.progress-bar')?.style.width || '10'));
  },

  renderizarErro(container) {
    // (Função mantida como antes, mas garante que remove loading)
    const loading = container.querySelector('.loading-container');
    if (loading) loading.remove();

    const erroDiv = document.createElement('div');
    erroDiv.className = 'erro-container';
    erroDiv.innerHTML = `
      <div class="bg-red-100 text-red-700 p-4 rounded-lg my-4 text-center">
        <p class="font-bold">${this.mensagemErro || 'Ocorreu um erro.'}</p>
        <button class="btn-tentar-novamente mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
          Tentar Novamente
        </button>
      </div>
    `;
    container.appendChild(erroDiv);
    // O evento do botão é delegado no configurarEventos
  },

  renderizarSemResultados(container) {
     // (Função mantida como antes, mas garante que remove loading)
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
    // (Função mantida como antes, mas usa dados de this.resultados)
    const listaVoos = document.createElement('div');
    listaVoos.className = 'voos-lista';
    listaVoos.id = 'voos-lista';

    const voos = [...(this.resultados?.proposals || [])].sort((a, b) => this.obterPrecoVoo(a) - this.obterPrecoVoo(b));

    const header = document.createElement('div');
    header.className = 'voos-header p-3 bg-gray-50 border-b border-gray-200';
    header.innerHTML = `<div class="flex justify-between items-center"><h3 class="font-medium">${voos.length} ${voos.length === 1 ? 'voo encontrado' : 'voos encontrados'}</h3><span class="text-sm text-gray-600">Ordenados por preço</span></div>`;
    listaVoos.appendChild(header);

    const voosContainer = document.createElement('div');
    voosContainer.className = 'voos-swipe-container'; // Manter se for usar swipe
    voosContainer.id = 'voos-swipe-container';
    listaVoos.appendChild(voosContainer);

    voos.forEach((voo, index) => {
      const cardVoo = this.criarCardVoo(voo, index);
      voosContainer.appendChild(cardVoo);
    });

    container.appendChild(listaVoos);
  },

  criarCardVoo(voo, index) {
    // (Função mantida como antes, mas obtém moeda de this.resultados.meta)
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
    const economiaPercentual = Math.floor(Math.random() * 15) + 5; // Mockup

    cardVoo.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div>
                <span class="text-xl font-bold">${precoFormatado}</span>
                <span class="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded ml-1">-${economiaPercentual}%</span>
                <p class="text-xs text-gray-500">Preço por pessoa, ida e volta</p>
            </div>
            <div class="flex items-center">
                <span class="text-xs bg-gray-100 px-2 py-1 rounded">${this.obterCompanhiasAereas(voo)}</span>
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
            <div class="flex items-center text-xs text-gray-500"><span class="mr-1">Restam</span><span class="bg-orange-100 text-orange-800 px-1 py-0.5 rounded font-medium">${Math.floor(Math.random() * 5) + 2} assentos</span></div>
        </div>
    `;
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
     // (Função mantida como antes, com mais segurança)
     try {
        const codigos = voo?.carriers;
        if (!codigos || codigos.length === 0) return 'N/A';

        if (this.resultados?.airlines) {
            const info = this.resultados.airlines[codigos[0]];
            return info?.name || codigos[0]; // Usa nome ou código da primeira
        }
        return codigos[0]; // Retorna só o código se não houver detalhes
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
     // (Função mantida como antes)
    if (!this.resultados?.proposals?.length || this.resultados.proposals.length <= 1) return;
    this.indexVooAtivo = (this.indexVooAtivo + 1) % this.resultados.proposals.length;
    this.vooAtivo = this.resultados.proposals[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },

  vooAnterior() {
     // (Função mantida como antes)
    if (!this.resultados?.proposals?.length || this.resultados.proposals.length <= 1) return;
    this.indexVooAtivo = (this.indexVooAtivo - 1 + this.resultados.proposals.length) % this.resultados.proposals.length;
    this.vooAtivo = this.resultados.proposals[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },

  atualizarVooAtivo() {
     // (Função mantida como antes)
    document.querySelectorAll('.voo-card').forEach(card => card.classList.remove('voo-card-ativo'));
    const cardAtivo = document.querySelector(`.voo-card[data-voo-index="${this.indexVooAtivo}"]`);
    if (cardAtivo) {
      cardAtivo.classList.add('voo-card-ativo');
      // O scrollIntoView pode ser agressivo, talvez usar só para swipe manual
      // cardAtivo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  },

  selecionarVoo(vooId) {
     // (Função mantida como antes, mas verifica se 'resultados' existe)
     if (!this.resultados?.proposals) return;

     // Encontra o voo pelo ID (que agora pode ser voo-idx-N)
     const vooEncontrado = this.resultados.proposals.find((v, index) => (v.sign || `voo-idx-${index}`) === vooId);

     if (!vooEncontrado) {
        console.error(`Voo com ID ${vooId} não encontrado`); return;
     }

     this.vooSelecionado = vooEncontrado;
     console.log('Voo selecionado:', this.vooSelecionado);

     // Atualiza UI visualmente (destaca o card clicado)
     document.querySelectorAll('.voo-card').forEach(card => {
         card.classList.remove('voo-selecionado');
         if (card.dataset.vooId === vooId) {
             card.classList.add('voo-selecionado');
         }
     });

     // Mostra confirmação
     this.mostrarConfirmacaoSelecao(this.vooSelecionado);
  },

  selecionarVooAtivo() {
    // (Função mantida como antes)
    if (!this.vooAtivo) { console.error('Nenhum voo ativo para selecionar'); return; }
    const vooId = this.vooAtivo.sign || `voo-idx-${this.indexVooAtivo}`;
    this.selecionarVoo(vooId);
    // A confirmação já é chamada dentro de selecionarVoo
  },

  mostrarDetalhesVoo(vooId) {
     // (Função mantida como antes, mas verifica se 'resultados' existe)
     if (!this.resultados?.proposals) return;
     const voo = this.resultados.proposals.find((v, index) => (v.sign || `voo-idx-${index}`) === vooId);
     if (!voo) { console.error(`Voo com ID ${vooId} não encontrado`); return; }
     console.log('Exibindo detalhes do voo (mock):', voo);
     alert(`Detalhes do Voo (ID: ${vooId})\nPreço: ${this.formatarPreco(this.obterPrecoVoo(voo))}\nCompanhia: ${this.obterCompanhiasAereas(voo)}\n\n(Implementação completa pendente)`);
  },

  mostrarConfirmacaoSelecao(voo) {
     // (Função mantida como antes)
     // Remove modal anterior se existir
     document.getElementById('modal-confirmacao')?.remove();

     const preco = this.obterPrecoVoo(voo);
     const moeda = this.resultados?.meta?.currency || 'BRL';
     const precoFormatado = this.formatarPreco(preco, moeda);

     const modalContainer = document.createElement('div');
     modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
     modalContainer.id = 'modal-confirmacao';
     // ... (innerHTML do modal como antes) ...
       modalContainer.innerHTML = `
      <div class="bg-white rounded-lg w-full max-w-md p-4">
        <div class="p-4 rounded-lg" style="background-color: rgba(232, 119, 34, 0.1);">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-orange-100 border-2 border-orange-200">
              <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/60x60?text=🐶'">
            </div>
            <div>
              <p class="font-bold">Ótima escolha, Triper! Você selecionou um voo por ${precoFormatado}. Vamos avançar?</p>
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
         localStorage.setItem('benetrip_voo_selecionado', JSON.stringify({ voo: this.vooSelecionado, preco: preco, moeda: moeda, dataSelecao: new Date().toISOString() }));
         window.location.href = 'hotels.html'; // Redireciona para hotéis
     });
     modalContainer.addEventListener('click', function(e) { if (e.target === this) this.remove(); });
  },

  // --- Métodos Auxiliares ---
  carregarDadosUsuario() {
     // (Função mantida como antes)
     try { return JSON.parse(localStorage.getItem('benetrip_user_data') || '{}'); }
     catch { return {}; }
  },

  obterCodigoIATAOrigem(dadosUsuario) {
     // (Função mantida como antes, mas pode ser simplificada se os dados estiverem consistentes)
     // Idealmente, o dado 'cidade_partida' já deveria vir como o código IATA do chat/localStorage
     try {
        const respostas = dadosUsuario?.respostas;
        if (respostas) {
            let cidadePartidaInput = respostas.cidade_partida || respostas.partida || null;
            // Se for objeto, tenta pegar 'value' ou 'code'
            if (cidadePartidaInput && typeof cidadePartidaInput === 'object') {
                cidadePartidaInput = cidadePartidaInput.code || cidadePartidaInput.value || cidadePartidaInput.name || null;
            }
            if (typeof cidadePartidaInput === 'string') {
                // Verifica se já é um IATA
                if (/^[A-Z]{3}$/.test(cidadePartidaInput)) return cidadePartidaInput;
                // Tenta extrair de "Cidade (IATA)"
                const match = cidadePartidaInput.match(/\(([A-Z]{3})\)/);
                if (match?.[1]) return match[1];
                // Tenta mapear nome (simplificado)
                 return this.obterCodigoIATADeCidade(cidadePartidaInput); // Chama o mapeamento
            }
        }
     } catch (erro) { console.error("Erro ao processar origem:", erro); }
     console.warn('Código IATA de origem não determinado, usando GRU como padrão.');
     return 'GRU'; // Padrão
  },

  obterCodigoIATADeCidade(nomeCidade) {
    // (Função mantida como antes - mapeamento simplificado)
     if (!nomeCidade || typeof nomeCidade !== 'string') return 'GRU';
     const mapeamento = { 'sao paulo': 'SAO', 'rio de janeiro': 'RIO', /* ... outras cidades ... */ };
     const lowerCaseNome = nomeCidade.toLowerCase().trim();
     // Tenta correspondência exata ou parcial (poderia ser melhorado com fuzzy search ou API dedicada)
     for (const [cidade, codigo] of Object.entries(mapeamento)) {
         if (lowerCaseNome.includes(cidade)) return codigo;
     }
     // Verifica se o próprio nome já é um código IATA
     if (/^[A-Z]{3}$/.test(nomeCidade.toUpperCase())) return nomeCidade.toUpperCase();
     console.warn(`Código IATA não mapeado para "${nomeCidade}", usando GRU.`);
     return 'GRU';
  },

  obterDatasViagem() {
     // (Função mantida como antes)
     try {
         const datas = this.carregarDadosUsuario()?.respostas?.datas;
         if (datas?.dataIda && datas?.dataVolta) {
             const dataIda = new Date(datas.dataIda + 'T00:00:00'); // Assume UTC ou local, consistência é chave
             const dataVolta = new Date(datas.dataVolta + 'T00:00:00');
             const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
             if (dataIda.getMonth() === dataVolta.getMonth() && dataIda.getFullYear() === dataVolta.getFullYear()) {
                 return `${dataIda.getDate()} a ${dataVolta.getDate()} de ${meses[dataIda.getMonth()]}, ${dataIda.getFullYear()}`;
             } else {
                 return `${dataIda.getDate()} ${meses[dataIda.getMonth()]} a ${dataVolta.getDate()} ${meses[dataVolta.getMonth()]}, ${dataVolta.getFullYear()}`;
             }
         }
     } catch (erro) { console.error("Erro formatar datas:", erro); }
     return "Datas Indisponíveis"; // Mensagem padrão
  },

  obterQuantidadePassageiros() {
     // (Função mantida como antes)
     try {
         const p = this.carregarDadosUsuario()?.respostas?.passageiros;
         if (p) return (parseInt(p.adultos || 1) + parseInt(p.criancas || 0) + parseInt(p.bebes || 0));
         // Fallback para outros campos se 'passageiros' não existir
         const r = this.carregarDadosUsuario()?.respostas;
         if (r) return parseInt(r.quantidade_familia || r.quantidade_amigos || 1);
     } catch {}
     return 1;
  },

  // --- Estilos e UI ---
  aplicarEstilosModernos() {
    // (Função mantida como antes)
    const styleId = 'benetrip-voos-styles';
    if (document.getElementById(styleId)) return; // Evita duplicar estilos
    const estiloElement = document.createElement('style');
    estiloElement.id = styleId;
    estiloElement.textContent = `
      .voo-card { transition: all 0.3s ease; border-left: 3px solid transparent; scroll-snap-align: start; }
      .voo-card-ativo { border-left-color: #E87722; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .voo-card.voo-selecionado { background-color: rgba(232, 119, 34, 0.05); border-left-color: #E87722; }
      .flight-line { height: 2px; }
      .progress-bar-container { height: 6px; background-color: #f0f0f0; border-radius: 3px; overflow: hidden; margin: 8px 0; }
      .progress-bar { height: 100%; background-color: #E87722; width: 0%; transition: width 0.5s ease; }
      .swipe-hint { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.7); color: white; padding: 8px 16px; border-radius: 20px; display: none; align-items: center; opacity: 1; transition: opacity 1s ease; z-index: 10; pointer-events: none; }
      .swipe-hint-arrow { animation: swipe-animation 1.5s infinite; }
      @keyframes swipe-animation { 0%, 100% { transform: translateX(0); opacity: 0.5; } 50% { transform: translateX(-5px); opacity: 1; } }
      .voos-swipe-container { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; gap: 8px; /* Espaçamento entre cards */ padding: 0 8px; /* Padding lateral */ margin: 0 -8px; /* Compensa padding */ }
      .form-checkbox { border-radius: 4px; border: 2px solid #E0E0E0; color: #E87722;}
      /* Esconder scrollbar */
      .voos-swipe-container::-webkit-scrollbar { display: none; }
      .voos-swipe-container { -ms-overflow-style: none; scrollbar-width: none; }
    `;
    document.head.appendChild(estiloElement);
  },

  mostrarErro(mensagem) {
     // (Função mantida como antes)
    console.error("Erro exibido:", mensagem); // Loga o erro
    this.pararPolling(); // Garante que o polling pare em caso de erro
    this.temErro = true;
    this.estaCarregando = false; // Termina o carregamento
    this.mensagemErro = mensagem || 'Ocorreu um erro desconhecido.';
    this.renderizarInterface(); // Mostra a UI de erro
  },

  configurarEventosAposRenderizacao() {
    // Configura eventos que dependem dos elementos renderizados

     // Swipe (se Hammer estiver disponível)
     // Reconfigura o Hammer no container correto se ele for recriado
     if (typeof Hammer !== 'undefined') {
        const swipeContainer = document.getElementById('voos-swipe-container');
        if (swipeContainer) {
           // Remove listener antigo se existir para evitar duplicação (opcional, mas seguro)
           // Hammer(swipeContainer).off('swipeleft swiperight');

           const hammer = new Hammer(swipeContainer);
           hammer.on('swipeleft', () => this.proximoVoo());
           hammer.on('swiperight', () => this.vooAnterior());
        }
     }

     // Scroll-snap pode atualizar o voo ativo (alternativa/complemento ao swipe)
     const swipeContainer = document.getElementById('voos-swipe-container');
     if (swipeContainer && 'onscrollend' in window) { // Usa onscrollend se disponível
       swipeContainer.onscrollend = () => {
         const scrollLeft = swipeContainer.scrollLeft;
         const cardWidth = swipeContainer.querySelector('.voo-card')?.offsetWidth || 0;
         if (cardWidth > 0) {
           const newIndex = Math.round(scrollLeft / cardWidth);
           if (newIndex !== this.indexVooAtivo && newIndex < this.resultados.proposals.length) {
              this.indexVooAtivo = newIndex;
              this.vooAtivo = this.resultados.proposals[this.indexVooAtivo];
              this.atualizarVooAtivo();
           }
         }
       };
     } else if (swipeContainer) { // Fallback com debounce no scroll
        let scrollTimeout;
        swipeContainer.onscroll = () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                 const scrollLeft = swipeContainer.scrollLeft;
                 const cardWidth = swipeContainer.querySelector('.voo-card')?.offsetWidth || 0;
                 if (cardWidth > 0) {
                     const newIndex = Math.round(scrollLeft / cardWidth);
                     if (newIndex !== this.indexVooAtivo && newIndex < this.resultados.proposals.length) {
                         this.indexVooAtivo = newIndex;
                         this.vooAtivo = this.resultados.proposals[this.indexVooAtivo];
                         this.atualizarVooAtivo();
                     }
                 }
            }, 150); // Ajuste o debounce conforme necessário
        };
     }

     // Botão de voltar (garante que está configurado)
     const btnVoltar = document.querySelector('.btn-voltar');
     if (btnVoltar && !btnVoltar.dataset.listenerAttached) { // Evita adicionar múltiplas vezes
        btnVoltar.addEventListener('click', () => { window.location.href = 'destinos.html'; });
        btnVoltar.dataset.listenerAttached = 'true';
     }
  }

}; // Fim do módulo BENETRIP_VOOS

// Inicializar o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  BENETRIP_VOOS.init();
});
