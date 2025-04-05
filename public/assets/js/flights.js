/**
 * BENETRIP - Módulo de Busca e Exibição de Voos
 * Versão 2.1.0
 * Este módulo gerencia a busca de voos na API Travelpayouts (Aviasales)
 * e exibe os resultados para o usuário
 */

// Módulo de Voos do Benetrip
const BENETRIP_VOOS = {
  // Dados e estado
  destino: null,
  resultados: null,
  searchId: null,
  estaCarregando: true,
  temErro: false,
  mensagemErro: '',
  vooSelecionado: null,
  vooAtivo: null, // Para navegação entre voos
  indexVooAtivo: 0,
  
  // Inicialização
  init() {
    console.log('Inicializando sistema de busca de voos...');
    
    // Configurar manipuladores de eventos
    this.configurarEventos();
    
    // Carregar destino selecionado
    this.carregarDestino()
      .then(() => {
        this.buscarVoos()
          .then(() => {
            this.renderizarInterface();
          })
          .catch(erro => {
            console.error('Erro ao buscar voos:', erro);
            this.mostrarErro('Não foi possível buscar voos para este destino. Por favor, tente novamente.');
          });
      })
      .catch(erro => {
        console.error('Erro ao carregar destino:', erro);
        this.mostrarErro('Não foi possível carregar informações do destino. Por favor, retorne e selecione o destino novamente.');
      });
    
    // Aplicar estilos modernos
    this.aplicarEstilosModernos();
  },
  
  // Configurar eventos
  configurarEventos() {
    // Botão para voltar à página de destinos
    const btnVoltar = document.querySelector('.btn-voltar');
    if (btnVoltar) {
      btnVoltar.addEventListener('click', () => {
        window.location.href = 'destinos.html';
      });
    }
    
    // Eventos de swipe para navegação entre voos 
    if (typeof Hammer !== 'undefined') {
      const container = document.getElementById('voos-container');
      if (container) {
        const hammer = new Hammer(container);
        hammer.on('swipeleft', () => this.proximoVoo());
        hammer.on('swiperight', () => this.vooAnterior());
      }
    }
    
    // Delegação de evento para cliques nos voos
    document.addEventListener('click', (event) => {
      // Verificar se é um clique em um card de voo
      const vooCard = event.target.closest('.voo-card');
      if (vooCard) {
        const vooId = vooCard.dataset.vooId;
        if (vooId) {
          this.selecionarVoo(vooId);
        }
      }
      
      // Verificar se é um clique em um botão de detalhes
      if (event.target.closest('.btn-detalhes-voo')) {
        const btnDetalhes = event.target.closest('.btn-detalhes-voo');
        const vooId = btnDetalhes.dataset.vooId;
        if (vooId) {
          this.mostrarDetalhesVoo(vooId);
        }
      }
    });
  },
  
  // Carregar dados do destino selecionado
  async carregarDestino() {
    try {
      const destinoString = localStorage.getItem('benetrip_destino_selecionado');
      if (!destinoString) {
        throw new Error('Nenhum destino selecionado');
      }
      
      this.destino = JSON.parse(destinoString);
      console.log('Destino carregado:', this.destino);
      
      // Extrair ou definir códigos IATA
      if (!this.destino.codigo_iata && this.destino.aeroporto && this.destino.aeroporto.codigo) {
        this.destino.codigo_iata = this.destino.aeroporto.codigo;
      }
      
      return true;
    } catch (erro) {
      console.error('Erro ao carregar destino:', erro);
      throw erro;
    }
  },
  
  // Buscar voos disponíveis na API
  async buscarVoos() {
    try {
      if (!this.destino || !this.destino.codigo_iata) {
        throw new Error('Código IATA do destino não disponível');
      }
      
      // Obter dados do usuário para datas de viagem
      const dadosUsuario = this.carregarDadosUsuario();
      if (!dadosUsuario || !dadosUsuario.respostas || !dadosUsuario.respostas.datas) {
        throw new Error('Datas de viagem não disponíveis');
      }
      
      const datas = dadosUsuario.respostas.datas;
      
      // Construir parâmetros da requisição
      const params = {
        origem: this.obterCodigoIATAOrigem(dadosUsuario),
        destino: this.destino.codigo_iata,
        dataIda: datas.dataIda,
        dataVolta: datas.dataVolta,
        adultos: dadosUsuario.respostas.passageiros?.adultos || 1,
        criancas: dadosUsuario.respostas.passageiros?.criancas || 0,
        bebes: dadosUsuario.respostas.passageiros?.bebes || 0,
        classe: 'Y' // Econômica por padrão
      };
      
      console.log('Parâmetros da busca de voos:', params);
      
      // Mostrar estado de carregamento
      this.estaCarregando = true;
      this.atualizarProgresso('Buscando as melhores ofertas de voo...', 20);
      
      // Fazer a requisição ao nosso endpoint
      const resposta = await fetch('/api/flight-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      if (!resposta.ok) {
        const erro = await resposta.json();
        throw new Error(erro.error || 'Erro ao buscar voos');
      }
      
      const dados = await resposta.json();
      console.log('Resposta da API de voos:', dados);
      
      if (!dados.success) {
        throw new Error(dados.error || 'Erro ao buscar voos');
      }
      
      this.searchId = dados.searchId;
      
      // Verificar se já temos resultados ou se precisamos fazer polling
      if (dados.resultados && dados.resultados.proposals && dados.resultados.proposals.length > 0) {
        console.log(`Recebidos ${dados.resultados.proposals.length} voos`);
        this.resultados = dados.resultados;
        this.estaCarregando = false;
        this.atualizarProgresso('Voos encontrados! Preparando resultados...', 100);
        return true;
      } else if (dados.searchId) {
        // Se não tiver resultados mas tiver searchId, fazer polling
        return await this.fazerPollingResultados(dados.searchId);
      } else {
        throw new Error('Nenhum resultado encontrado e nenhum ID de busca retornado');
      }
    } catch (erro) {
      console.error('Erro na busca de voos:', erro);
      this.estaCarregando = false;
      this.temErro = true;
      this.mensagemErro = erro.message;
      throw erro;
    }
  },
  
  // Fazer polling de resultados até ter voos ou atingir timeout
  async fazerPollingResultados(searchId, maxTentativas = 10) {
    try {
      console.log(`Iniciando polling para searchId ${searchId}`);
      let tentativas = 0;
      
      while (tentativas < maxTentativas) {
        tentativas++;
        this.atualizarProgresso(`Buscando voos (${tentativas}/${maxTentativas})...`, 20 + (tentativas / maxTentativas) * 60);
        
        // Esperar entre as tentativas
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Fazer requisição de polling
        const resposta = await fetch(`/api/flight-search-results?searchId=${searchId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!resposta.ok) {
          console.warn(`Tentativa ${tentativas}: resposta não ok`);
          continue;
        }
        
        const dados = await resposta.json();
        
        // Verificar se temos resultados
        if (dados.resultados && dados.resultados.proposals && dados.resultados.proposals.length > 0) {
          console.log(`Encontrados ${dados.resultados.proposals.length} voos na tentativa ${tentativas}`);
          this.resultados = dados.resultados;
          this.estaCarregando = false;
          this.atualizarProgresso('Voos encontrados! Preparando resultados...', 100);
          return true;
        }
        
        // Se chegou à última tentativa sem resultados
        if (tentativas === maxTentativas) {
          console.warn('Máximo de tentativas atingido sem resultados');
          throw new Error('Não foi possível encontrar voos para este destino no momento');
        }
      }
      
      throw new Error('Tempo limite excedido na busca de voos');
    } catch (erro) {
      console.error('Erro no polling de resultados:', erro);
      this.estaCarregando = false;
      this.temErro = true;
      this.mensagemErro = erro.message;
      throw erro;
    }
  },
  
  // Atualizar barra de progresso
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
  
  // Renderizar a interface com os resultados
  renderizarInterface() {
    try {
      const container = document.getElementById('voos-container');
      if (!container) {
        console.error('Container de voos não encontrado');
        return;
      }
      
      // Limpar conteúdo anterior
      container.innerHTML = '';
      
      // Adicionar header
      this.renderizarHeader(container);
      
      if (this.estaCarregando) {
        // Mostrar tela de carregamento
        this.renderizarCarregamento(container);
        return;
      }
      
      if (this.temErro) {
        // Mostrar mensagem de erro
        this.renderizarErro(container);
        return;
      }
      
      if (!this.resultados || !this.resultados.proposals || this.resultados.proposals.length === 0) {
        // Mostrar mensagem de nenhum voo encontrado
        this.renderizarSemResultados(container);
        return;
      }
      
      // Criar container principal
      const mainContent = document.createElement('main');
      mainContent.className = 'voos-content';
      container.appendChild(mainContent);
      
      // Renderizar resumo da viagem
      this.renderizarResumoViagem(mainContent);
      
      // Renderizar lista de voos
      this.renderizarListaVoos(mainContent);
      
      // Configurar eventos específicos após renderização
      this.configurarEventosAposRenderizacao();
      
      // Selecionar primeiro voo por padrão
      if (this.resultados.proposals && this.resultados.proposals.length > 0) {
        const primeiroVoo = this.resultados.proposals[0];
        if (primeiroVoo) {
          this.vooAtivo = primeiroVoo;
          this.indexVooAtivo = 0;
          this.atualizarVooAtivo();
        }
      }
      
      // Mostrar a dica de swipe
      const swipeHint = document.getElementById('swipe-hint');
      if (swipeHint && this.resultados.proposals.length > 1) {
        swipeHint.style.display = 'flex';
        setTimeout(() => {
          swipeHint.style.opacity = '0';
          setTimeout(() => {
            swipeHint.style.display = 'none';
          }, 1000);
        }, 3000);
      }
      
    } catch (erro) {
      console.error('Erro ao renderizar interface de voos:', erro);
      this.mostrarErro('Ocorreu um erro ao exibir os voos');
    }
  },
  
  // Renderizar o header da página
  renderizarHeader(container) {
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
      <button class="btn-voltar" aria-label="Voltar para a página anterior">
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"></path>
        </svg>
        <span class="sr-only">Voltar</span>
      </button>
      <h1>Voos Disponíveis</h1>
    `;
    container.appendChild(header);
  },
  
  // Renderizar tela de carregamento
  renderizarCarregamento(container) {
    const loading = document.createElement('div');
    loading.className = 'loading-container';
    loading.innerHTML = `
      <div style="text-align: center; padding: 2rem 0;">
        <img src="assets/images/tripinha/avatar-pensando.png" alt="Tripinha carregando" class="loading-avatar" style="width: 80px; height: 80px; margin: 0 auto;" />
        <div class="loading-text" style="margin: 1rem 0;">Farejando os melhores voos para você...</div>
        <div class="progress-bar-container">
          <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso da busca de voos"></div>
        </div>
      </div>
    `;
    container.appendChild(loading);
  },
  
  // Renderizar mensagem de erro
  renderizarErro(container) {
    const erro = document.createElement('div');
    erro.className = 'erro-container';
    erro.innerHTML = `
      <div class="bg-red-100 text-red-700 p-4 rounded-lg my-4 text-center">
        <p class="font-bold">${this.mensagemErro || 'Ocorreu um erro ao buscar voos'}</p>
        <button class="btn-tentar-novamente mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
          Tentar Novamente
        </button>
      </div>
    `;
    container.appendChild(erro);
    
    // Adicionar evento ao botão
    const btnTentarNovamente = erro.querySelector('.btn-tentar-novamente');
    if (btnTentarNovamente) {
      btnTentarNovamente.addEventListener('click', () => {
        window.location.reload();
      });
    }
  },
  
  // Renderizar mensagem de nenhum resultado
  renderizarSemResultados(container) {
    const semResultados = document.createElement('div');
    semResultados.className = 'sem-resultados-container';
    semResultados.innerHTML = `
      <div class="bg-blue-50 p-4 rounded-lg my-4 text-center">
        <div class="mb-3">
          <img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="w-20 h-20 mx-auto" />
        </div>
        <p class="font-bold">Não encontramos voos para ${this.destino?.destino || 'este destino'} nas datas selecionadas</p>
        <p class="mt-2 text-sm">Que tal tentar outras datas ou outro destino?</p>
        <div class="flex gap-3 mt-4">
          <button class="btn-secundario flex-1 py-2 px-4 border border-gray-300 rounded hover:bg-gray-100">
            Mudar Datas
          </button>
          <button class="btn-principal flex-1 py-2 px-4 text-white rounded hover:opacity-90" style="background-color: #E87722;">
            Outro Destino
          </button>
        </div>
      </div>
    `;
    container.appendChild(semResultados);
    
    // Adicionar eventos aos botões
    const btnMudarDatas = semResultados.querySelector('.btn-secundario');
    const btnOutroDestino = semResultados.querySelector('.btn-principal');
    
    if (btnMudarDatas) {
      btnMudarDatas.addEventListener('click', () => {
        window.location.href = 'index.html'; // Voltar para o chat
      });
    }
    
    if (btnOutroDestino) {
      btnOutroDestino.addEventListener('click', () => {
        window.location.href = 'destinos.html'; // Voltar para destinos
      });
    }
  },
  
  // Renderizar resumo da viagem
  renderizarResumoViagem(container) {
    const resumo = document.createElement('div');
    resumo.className = 'viagem-resumo p-4 bg-white border-b border-gray-200';
    
    // Obter dados do destino
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
            <p class="font-medium">${destino.destino}, ${destino.pais}</p>
            <p class="text-sm text-gray-600">${dataViagem}</p>
          </div>
        </div>
        <div class="text-sm text-right">
          <span class="bg-gray-100 px-2 py-1 rounded">
            ${passageiros} ${passageiros > 1 ? 'passageiros' : 'passageiro'}
          </span>
        </div>
      </div>
    `;
    
    container.appendChild(resumo);
  },
  
  // Renderizar lista de voos
  renderizarListaVoos(container) {
    const listaVoos = document.createElement('div');
    listaVoos.className = 'voos-lista';
    listaVoos.id = 'voos-lista';
    
    // Verificar se temos propostas de voos
    if (!this.resultados.proposals || this.resultados.proposals.length === 0) {
      listaVoos.innerHTML = `
        <div class="text-center p-4">
          <p>Nenhum voo encontrado</p>
        </div>
      `;
      container.appendChild(listaVoos);
      return;
    }
    
    // Ordenar voos por preço
    const voos = [...this.resultados.proposals].sort((a, b) => {
      const precoA = this.obterPrecoVoo(a);
      const precoB = this.obterPrecoVoo(b);
      return precoA - precoB;
    });
    
    // Renderizar cabeçalho com contador
    const header = document.createElement('div');
    header.className = 'voos-header p-3 bg-gray-50 border-b border-gray-200';
    header.innerHTML = `
      <div class="flex justify-between items-center">
        <h3 class="font-medium">${voos.length} voos encontrados</h3>
        <span class="text-sm text-gray-600">Ordenados por preço</span>
      </div>
    `;
    listaVoos.appendChild(header);
    
    // Container para os cards de voo com swipe horizontal
    const voosContainer = document.createElement('div');
    voosContainer.className = 'voos-swipe-container';
    voosContainer.id = 'voos-swipe-container';
    listaVoos.appendChild(voosContainer);
    
    // Renderizar cada voo
    voos.forEach((voo, index) => {
      const cardVoo = this.criarCardVoo(voo, index);
      voosContainer.appendChild(cardVoo);
    });
    
    container.appendChild(listaVoos);
  },
  
  // Criar card de voo individual
  criarCardVoo(voo, index) {
    const cardVoo = document.createElement('div');
    cardVoo.className = 'voo-card p-4 bg-white border-b border-gray-200';
    cardVoo.dataset.vooId = voo.sign || `voo-${index}`;
    cardVoo.dataset.vooIndex = index;
    
    // Obter dados do voo
    const preco = this.obterPrecoVoo(voo);
    const moeda = this.resultados?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    
    // Obter informações dos segmentos (ida e volta)
    const infoIda = this.obterInfoSegmento(voo.segment[0]);
    const infoVolta = voo.segment.length > 1 ? this.obterInfoSegmento(voo.segment[1]) : null;
    
    // Calcular economia (mockup para demonstração)
    const economiaPercentual = Math.floor(Math.random() * 15) + 5; // 5-20%
    
    // Renderizar o card
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
          <div class="flex justify-between items-center text-sm">
            <span class="font-medium">IDA</span>
            <span class="text-xs text-gray-500">${this.formatarData(infoIda.dataPartida)}</span>
          </div>
          
          <div class="flex items-center justify-between mt-2">
            <div class="text-center">
              <p class="font-bold">${infoIda.horaPartida}</p>
              <p class="text-xs text-gray-600">${infoIda.aeroportoPartida}</p>
            </div>
            
            <div class="flex-1 px-2">
              <div class="text-xs text-center text-gray-500">${this.formatarDuracao(infoIda.duracao)}</div>
              <div class="flight-line relative">
                <div class="border-t border-gray-300 my-2"></div>
                <div class="flight-stops absolute inset-x-0 top-1/2 flex justify-center -mt-1">
                  ${this.renderizarParadas(infoIda.paradas)}
                </div>
              </div>
              <div class="text-xs text-center text-gray-500">${infoIda.paradas} ${infoIda.paradas === 1 ? 'parada' : 'paradas'}</div>
            </div>
            
            <div class="text-center">
              <p class="font-bold">${infoIda.horaChegada}</p>
              <p class="text-xs text-gray-600">${infoIda.aeroportoChegada}</p>
            </div>
          </div>
        </div>
        
        ${infoVolta ? `
        <div class="mt-4 pt-3 border-t border-gray-100">
          <div class="flex justify-between items-center text-sm">
            <span class="font-medium">VOLTA</span>
            <span class="text-xs text-gray-500">${this.formatarData(infoVolta.dataPartida)}</span>
          </div>
          
          <div class="flex items-center justify-between mt-2">
            <div class="text-center">
              <p class="font-bold">${infoVolta.horaPartida}</p>
              <p class="text-xs text-gray-600">${infoVolta.aeroportoPartida}</p>
            </div>
            
            <div class="flex-1 px-2">
              <div class="text-xs text-center text-gray-500">${this.formatarDuracao(infoVolta.duracao)}</div>
              <div class="flight-line relative">
                <div class="border-t border-gray-300 my-2"></div>
                <div class="flight-stops absolute inset-x-0 top-1/2 flex justify-center -mt-1">
                  ${this.renderizarParadas(infoVolta.paradas)}
                </div>
              </div>
              <div class="text-xs text-center text-gray-500">${infoVolta.paradas} ${infoVolta.paradas === 1 ? 'parada' : 'paradas'}</div>
            </div>
            
            <div class="text-center">
              <p class="font-bold">${infoVolta.horaChegada}</p>
              <p class="text-xs text-gray-600">${infoVolta.aeroportoChegada}</p>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
      
      <div class="mt-4 pt-2 border-t border-gray-100 flex justify-between">
        <button class="btn-detalhes-voo text-sm text-blue-600" data-voo-id="${voo.sign || `voo-${index}`}">
          Ver detalhes
        </button>
        
        <div class="flex items-center text-xs text-gray-500">
          <span class="mr-1">Restam</span>
          <span class="bg-orange-100 text-orange-800 px-1 py-0.5 rounded font-medium">
            ${Math.floor(Math.random() * 5) + 2} assentos
          </span>
        </div>
      </div>
    `;
    
    return cardVoo;
  },
  
  // Função auxiliar para renderizar as paradas
  renderizarParadas(paradas) {
    if (paradas === 0) {
      return `<span class="inline-block w-3 h-3 bg-green-500 rounded-full"></span>`;
    }
    
    let html = '';
    for (let i = 0; i < paradas; i++) {
      html += `<span class="inline-block w-2 h-2 bg-gray-400 rounded-full mx-1"></span>`;
    }
    
    return html;
  },
  
  // Métodos para formatar e extrair dados
  formatarPreco(preco, moeda = 'BRL') {
    // Formatação básica para demonstração
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: moeda,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    
    return formatter.format(preco);
  },
  
  formatarData(data) {
    if (!data) return '';
    
    // Formato: "Dom, 15 Ago"
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const diaSemana = dias[data.getDay()];
    const dia = data.getDate();
    const mes = meses[data.getMonth()];
    
    return `${diaSemana}, ${dia} ${mes}`;
  },
  
  formatarDuracao(duracaoMinutos) {
    const horas = Math.floor(duracaoMinutos / 60);
    const minutos = duracaoMinutos % 60;
    
    return `${horas}h ${minutos > 0 ? minutos + 'm' : ''}`;
  },
  
  obterPrecoVoo(voo) {
    if (!voo || !voo.terms) return 0;
    
    // Obter o primeiro termo disponível
    const primeiroTermoKey = Object.keys(voo.terms)[0];
    if (!primeiroTermoKey) return 0;
    
    const primeiroTermo = voo.terms[primeiroTermoKey];
    if (!primeiroTermo) return 0;
    
    // Tentar obter o preço unificado ou o preço normal
    return primeiroTermo.unified_price || primeiroTermo.price || 0;
  },
  
  obterCompanhiasAereas(voo) {
    if (!voo || !voo.carriers || voo.carriers.length === 0) {
      return 'N/A';
    }
    
    // Obter códigos de companhias aéreas
    const codigos = voo.carriers;
    
    // Se houver informações detalhadas sobre as companhias
    if (this.resultados && this.resultados.airlines) {
      const companhias = codigos.map(codigo => {
        const info = this.resultados.airlines[codigo];
        return info ? info.name || codigo : codigo;
      });
      
      // Retornar apenas a primeira companhia se houver várias
      return companhias[0];
    }
    
    return codigos[0] || 'N/A';
  },
  
  obterInfoSegmento(segmento) {
    if (!segmento || !segmento.flight || segmento.flight.length === 0) {
      return {
        aeroportoPartida: 'N/A',
        aeroportoChegada: 'N/A',
        dataPartida: new Date(),
        dataChegada: new Date(),
        horaPartida: 'N/A',
        horaChegada: 'N/A',
        duracao: 0,
        paradas: 0
      };
    }
    
    // Obter primeiro e último voo do segmento
    const primeiroVoo = segmento.flight[0];
    const ultimoVoo = segmento.flight[segmento.flight.length - 1];
    
    // Obter timestamps de partida e chegada
    const timestampPartida = primeiroVoo.local_departure_timestamp * 1000;
    const timestampChegada = ultimoVoo.local_arrival_timestamp * 1000;
    
    // Converter para objetos Date
    const dataPartida = new Date(timestampPartida);
    const dataChegada = new Date(timestampChegada);
    
    // Formatar horas
    const horaPartida = dataPartida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const horaChegada = dataChegada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Calcular duração total (em minutos)
    const duracaoMs = timestampChegada - timestampPartida;
    const duracaoMinutos = Math.round(duracaoMs / (1000 * 60));
    
    // Número de paradas (número de voos - 1)
    const paradas = segmento.flight.length - 1;
    
    return {
      aeroportoPartida: primeiroVoo.departure,
      aeroportoChegada: ultimoVoo.arrival,
      dataPartida,
      dataChegada,
      horaPartida,
      horaChegada,
      duracao: duracaoMinutos,
      paradas
    };
  },
  
  // Métodos de navegação e interação
  proximoVoo() {
    if (!this.resultados || !this.resultados.proposals || this.resultados.proposals.length <= 1) {
      return;
    }
    
    this.indexVooAtivo = (this.indexVooAtivo + 1) % this.resultados.proposals.length;
    this.vooAtivo = this.resultados.proposals[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },
  
  vooAnterior() {
    if (!this.resultados || !this.resultados.proposals || this.resultados.proposals.length <= 1) {
      return;
    }
    
    this.indexVooAtivo = (this.indexVooAtivo - 1 + this.resultados.proposals.length) % this.resultados.proposals.length;
    this.vooAtivo = this.resultados.proposals[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },
  
  atualizarVooAtivo() {
    // Remover classe ativa de todos os cards
    const cards = document.querySelectorAll('.voo-card');
    cards.forEach(card => {
      card.classList.remove('voo-card-ativo');
    });
    
    // Adicionar classe ativa ao card atual
    const cardAtivo = document.querySelector(`.voo-card[data-voo-index="${this.indexVooAtivo}"]`);
    if (cardAtivo) {
      cardAtivo.classList.add('voo-card-ativo');
      
      // Rolar para o card ativo
      cardAtivo.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  },
  
  selecionarVoo(vooId) {
    // Encontrar o voo pelo ID
    const voo = this.resultados.proposals.find(v => (v.sign || '') === vooId);
    if (!voo) {
      console.error(`Voo com ID ${vooId} não encontrado`);
      return;
    }
    
    this.vooSelecionado = voo;
    console.log('Voo selecionado:', voo);
    
    // Atualizar UI
    const cards = document.querySelectorAll('.voo-card');
    cards.forEach(card => {
      card.classList.remove('voo-selecionado');
      if (card.dataset.vooId === vooId) {
        card.classList.add('voo-selecionado');
      }
    });
    
    // TODO: Implementar lógica para avançar para a próxima etapa
  },
  
  // Método público para selecionar o voo ativo
  selecionarVooAtivo() {
    if (!this.vooAtivo) {
      console.error('Nenhum voo ativo para selecionar');
      return;
    }
    
    const vooId = this.vooAtivo.sign || `voo-${this.indexVooAtivo}`;
    this.selecionarVoo(vooId);
    
    // Mostrar mensagem de confirmação
    this.mostrarConfirmacaoSelecao(this.vooAtivo);
  },
  
  mostrarDetalhesVoo(vooId) {
    // Encontrar o voo pelo ID
    const voo = this.resultados.proposals.find(v => (v.sign || '') === vooId);
    if (!voo) {
      console.error(`Voo com ID ${vooId} não encontrado`);
      return;
    }
    
    console.log('Exibindo detalhes do voo:', voo);
    
    // TODO: Implementar modal de detalhes do voo
    alert('Detalhes do voo (em desenvolvimento)');
  },
  
  // Método para mostrar confirmação de seleção
  mostrarConfirmacaoSelecao(voo) {
    const preco = this.obterPrecoVoo(voo);
    const moeda = this.resultados?.meta?.currency || 'BRL';
    const precoFormatado = this.formatarPreco(preco, moeda);
    
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
    
    checkboxConfirmar.addEventListener('change', () => {
      btnConfirmar.disabled = !checkboxConfirmar.checked;
    });
    
    btnCancelar.addEventListener('click', () => {
      document.getElementById('modal-confirmacao').remove();
    });
    
    btnConfirmar.addEventListener('click', () => {
      // Salvar voo selecionado no localStorage
      localStorage.setItem('benetrip_voo_selecionado', JSON.stringify({
        voo: this.vooSelecionado,
        preco: preco,
        moeda: moeda,
        dataSelecao: new Date().toISOString()
      }));
      
      // Redirecionar para a página de hospedagem
      window.location.href = 'hotels.html';
    });
    
    // Fechar modal ao clicar fora
    modalContainer.addEventListener('click', function(e) {
      if (e.target === this) {
        this.remove();
      }
    });
  },
  
  // Métodos auxiliares
  carregarDadosUsuario() {
    try {
      const dadosString = localStorage.getItem('benetrip_user_data');
      if (!dadosString) return null;
      return JSON.parse(dadosString);
    } catch (erro) {
      console.error('Erro ao carregar dados do usuário:', erro);
      return null;
    }
  },
  
  obterCodigoIATAOrigem(dadosUsuario) {
    // Tentar obter do localStorage ou usar um valor padrão
    if (dadosUsuario && dadosUsuario.respostas && dadosUsuario.respostas.cidade_partida) {
      // Implementar lógica para obter código IATA a partir da cidade
      return this.obterCodigoIATADeCidade(dadosUsuario.respostas.cidade_partida);
    }
    
    return 'GRU'; // Padrão: São Paulo
  },
  
  obterCodigoIATADeCidade(nomeCidade) {
    // Mapeamento simplificado de algumas cidades comuns
    const mapeamentoCidades = {
      'São Paulo': 'SAO',
      'Rio de Janeiro': 'RIO',
      'Brasília': 'BSB',
      'Salvador': 'SSA',
      'Recife': 'REC',
      'Fortaleza': 'FOR',
      'Belo Horizonte': 'BHZ',
      'Porto Alegre': 'POA',
      'Curitiba': 'CWB',
      'Manaus': 'MAO',
      'Belém': 'BEL',
      'Florianópolis': 'FLN',
      'Natal': 'NAT',
      'Campinas': 'CPQ',
      'Vitória': 'VIX',
      'Goiânia': 'GYN'
    };
    
    // Verificar correspondência exata
    if (mapeamentoCidades[nomeCidade]) {
      return mapeamentoCidades[nomeCidade];
    }
    
    // Verificar correspondência parcial
    for (const [cidade, codigo] of Object.entries(mapeamentoCidades)) {
      if (nomeCidade.toLowerCase().includes(cidade.toLowerCase())) {
        return codigo;
      }
    }
    
    console.warn(`Código IATA não encontrado para cidade: ${nomeCidade}. Usando GRU (São Paulo) como padrão.`);
    return 'GRU'; // Padrão: São Paulo
  },
  
  obterDatasViagem() {
    try {
      const dadosUsuario = this.carregarDadosUsuario();
      if (dadosUsuario && dadosUsuario.respostas && dadosUsuario.respostas.datas) {
        const datas = dadosUsuario.respostas.datas;
        if (datas.dataIda && datas.dataVolta) {
          const dataIdaParts = datas.dataIda.split('-');
          const dataVoltaParts = datas.dataVolta.split('-');
          if (dataIdaParts.length === 3 && dataVoltaParts.length === 3) {
            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const diaIda = parseInt(dataIdaParts[2]);
            const mesIda = meses[parseInt(dataIdaParts[1]) - 1];
            const anoIda = dataIdaParts[0];
            const diaVolta = parseInt(dataVoltaParts[2]);
            const mesVolta = meses[parseInt(dataVoltaParts[1]) - 1];
            const anoVolta = dataVoltaParts[0];
            if (mesIda === mesVolta && anoIda === anoVolta) {
              return `${diaIda} a ${diaVolta} de ${mesIda}, ${anoIda}`;
            } else {
              return `${diaIda} de ${mesIda} a ${diaVolta} de ${mesVolta}, ${anoVolta}`;
            }
          }
        }
      }
    } catch (erro) {
      console.error('Erro ao processar datas:', erro);
    }
    return "5 a 12 de Agosto, 2025";
  },
  
  obterQuantidadePassageiros() {
    try {
      const dadosUsuario = this.carregarDadosUsuario();
      if (dadosUsuario && dadosUsuario.respostas) {
        const respostas = dadosUsuario.respostas;
        
        let total = 0;
        
        // Adultos
        if (respostas.passageiros && respostas.passageiros.adultos) {
          total += parseInt(respostas.passageiros.adultos);
        } else if (respostas.quantidade_familia) {
          total += parseInt(respostas.quantidade_familia);
        } else if (respostas.quantidade_amigos) {
          total += parseInt(respostas.quantidade_amigos);
        } else {
          total += 1; // Padrão: 1 adulto
        }
        
        // Crianças
        if (respostas.passageiros && respostas.passageiros.criancas) {
          total += parseInt(respostas.passageiros.criancas);
        }
        
        // Bebês
        if (respostas.passageiros && respostas.passageiros.bebes) {
          total += parseInt(respostas.passageiros.bebes);
        }
        
        return total;
      }
    } catch (erro) {
      console.error('Erro ao processar quantidade de passageiros:', erro);
    }
    return 1; // Padrão: 1 passageiro
  },
  
  // Método para aplicar estilos modernos
  aplicarEstilosModernos() {
    // Criar elemento de estilo
    const estiloElement = document.createElement('style');
    estiloElement.textContent = `
      /* Cards de voo */
      .voo-card {
        transition: all 0.3s ease;
        border-left: 3px solid transparent;
      }
      
      .voo-card-ativo {
        border-left: 3px solid #E87722;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .voo-card.voo-selecionado {
        background-color: rgba(232, 119, 34, 0.05);
        border-left: 3px solid #E87722;
      }
      
      /* Linha de voo */
      .flight-line {
        height: 2px;
      }
      
      /* Animação de carregamento */
      .progress-bar-container {
        height: 6px;
        background-color: #f0f0f0;
        border-radius: 3px;
        overflow: hidden;
        margin: 8px 0;
      }
      
      .progress-bar {
        height: 100%;
        background-color: #E87722;
        width: 0%;
        transition: width 0.5s ease;
      }
      
      /* Melhoria no swipe hint */
      .swipe-hint {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0,0,0,0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        display: flex;
        align-items: center;
        opacity: 1;
        transition: opacity 1s ease;
        z-index: 10;
      }
      
      .swipe-hint-arrow {
        animation: swipe-animation 1.5s infinite;
        margin-right: 8px;
      }
      
      @keyframes swipe-animation {
        0% { transform: translateX(0); opacity: 0.5; }
        50% { transform: translateX(-10px); opacity: 1; }
        100% { transform: translateX(0); opacity: 0.5; }
      }
      
      /* Melhorias em tipografia */
      .viagem-resumo h2 {
        letter-spacing: -0.01em;
      }
      
      /* Checkbox personalizado */
      .form-checkbox {
        border-radius: 4px;
        border: 2px solid #E0E0E0;
      }
    `;
    
    // Adicionar ao documento
    document.head.appendChild(estiloElement);
  },
  
  // Método para exibir erro
  mostrarErro(mensagem) {
    this.temErro = true;
    this.mensagemErro = mensagem;
    this.renderizarInterface();
  },
  
  // Método para configurar eventos após renderização
  configurarEventosAposRenderizacao() {
    // Botão de voltar
    const btnVoltar = document.querySelector('.btn-voltar');
    if (btnVoltar) {
      btnVoltar.addEventListener('click', () => {
        window.location.href = 'destinos.html';
      });
    }
  }
};

// Inicializar o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  BENETRIP_VOOS.init();
});
