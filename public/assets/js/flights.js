/**
 * BENETRIP - Módulo de Busca e Exibição de Voos (Versão Simplificada)
 */

// Módulo de Voos do Benetrip
const BENETRIP_VOOS = {
  // --- Constantes ---
  POLLING_INTERVAL_MS: 3000,
  MAX_POLLING_ATTEMPTS: 20,
  
  // --- Dados e Estado ---
  destino: null,
  searchId: null,
  estaCarregando: true,
  isPolling: false,
  pollingAttempts: 0,
  voos: [],
  temErro: false,
  mensagemErro: '',
  vooSelecionado: null,
  vooAtivo: null,
  indexVooAtivo: 0,

  // --- Inicialização ---
  init() {
    console.log('Inicializando sistema de busca de voos...');
    this.resetState();
    this.configurarEventos();
    this.carregarDestino()
      .then(() => this.iniciarBuscaVoos())
      .catch(erro => this.mostrarErro('Erro ao carregar destino. Tente selecionar novamente.'));
    this.renderizarInterface();
  },

  resetState() {
    this.destino = null;
    this.searchId = null;
    this.estaCarregando = true;
    this.isPolling = false;
    this.pollingAttempts = 0;
    this.voos = [];
    this.temErro = false;
    this.mensagemErro = '';
    this.vooSelecionado = null;
    this.vooAtivo = null;
    this.indexVooAtivo = 0;
    
    // Limpar qualquer temporizador existente
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  },

  configurarEventos() {
    // Delegação de evento para cliques
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // Botão de voltar
      if (target.closest('.btn-voltar')) {
        history.back();
        return;
      }
      
      // Botão de detalhes do voo
      const btnDetalhes = target.closest('.btn-detalhes-voo');
      if (btnDetalhes) {
        const vooId = btnDetalhes.dataset.vooId;
        if (vooId) this.mostrarDetalhesVoo(vooId);
        return;
      }

      // Botão Tentar Novamente (em caso de erro)
      if (target.closest('.btn-tentar-novamente')) {
        window.location.reload();
        return;
      }

      // Clique no card de voo
      const vooCard = target.closest('.voo-card');
      if (vooCard && this.voos.length > 0) {
        const vooId = vooCard.dataset.vooId;
        if (vooId) this.selecionarVoo(vooId);
        return;
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
      
      // Botões de navegação
      if (target.closest('.next-btn')) {
        this.proximoVoo();
        return;
      }
      
      if (target.closest('.prev-btn')) {
        this.vooAnterior();
        return;
      }
    });

    // Configurar swipe para navegação
    this.configurarSwipe();
  },
  
  configurarSwipe() {
    const container = document.getElementById('voos-swipe-container');
    if (!container) return;
    
    // Usar biblioteca Hammer.js se disponível
    if (typeof Hammer !== 'undefined') {
      const hammer = new Hammer(container);
      hammer.on('swipeleft', () => this.proximoVoo());
      hammer.on('swiperight', () => this.vooAnterior());
    }
    
    // Adicionar também listener de scroll para detectar mudanças
    container.addEventListener('scroll', () => {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.atualizarVooAtivoBaseadoNoScroll(container);
      }, 150);
    });
  },

  async carregarDestino() {
    try {
      // Tenta carregar destino do localStorage
      const destinoString = localStorage.getItem('benetrip_destino_selecionado') ||
                           localStorage.getItem('benetrip_destino_escolhido') ||
                           localStorage.getItem('benetrip_destino');
      
      if (!destinoString) {
        throw new Error('Nenhum destino selecionado');
      }
      
      this.destino = JSON.parse(destinoString);
      console.log('Destino carregado:', this.destino);
      
      return true;
    } catch (erro) {
      console.error('Erro ao carregar destino:', erro);
      throw erro;
    }
  },

  async iniciarBuscaVoos() {
    try {
      // Mostrar tela de carregamento
      this.estaCarregando = true;
      this.renderizarInterface();
      
      // Simular dados de busca para desenvolvimento
      // Em produção, isso seria uma chamada real à API
      await this.simularBuscaVoos();
      
    } catch (erro) {
      console.error('Erro ao iniciar busca de voos:', erro);
      this.mostrarErro(erro.message);
    }
  },
  
  async simularBuscaVoos() {
    // Simula o carregamento para desenvolvimento
    // Substitua por chamada real à API em produção
    return new Promise((resolve) => {
      setTimeout(() => {
        // Dados simulados de voos
        this.voos = this.gerarVoosSimulados();
        
        // Atualizar interface
        this.estaCarregando = false;
        this.renderizarInterface();
        
        if (this.voos.length > 0) {
          this.vooAtivo = this.voos[0];
          this.atualizarVooAtivo();
        }
        
        resolve();
      }, 2000);
    });
  },
  
  gerarVoosSimulados() {
    // Gera dados simulados para desenvolvimento
    // Substitua por dados reais da API em produção
    const voos = [];
    
    for (let i = 0; i < 5; i++) {
      const preco = 1000 + Math.floor(Math.random() * 1000);
      const economiaPercentual = Math.floor(Math.random() * 20);
      const ehVooDireto = i % 2 === 0;
      const assentosDisponiveis = Math.floor(Math.random() * 8) + 1;
      
      voos.push({
        id: `voo-${i}`,
        preco: preco,
        precoFormatado: this.formatarPreco(preco),
        economiaPercentual: economiaPercentual,
        isMelhorPreco: i === 0,
        companhiaAerea: ['LATAM', 'GOL', 'AZUL', 'AVIANCA'][i % 4],
        ida: {
          origem: 'GRU',
          destino: this.destino.codigo_iata || 'JFK',
          horaPartida: '10:30',
          horaChegada: '17:00',
          duracao: 390, // em minutos
          paradas: ehVooDireto ? 0 : 1
        },
        volta: i < 4 ? {
          origem: this.destino.codigo_iata || 'JFK',
          destino: 'GRU',
          horaPartida: '19:30',
          horaChegada: '05:00',
          duracao: 570, // em minutos
          paradas: ehVooDireto ? 0 : 1
        } : null,
        assentosDisponiveis: assentosDisponiveis
      });
    }
    
    return voos;
  },

  renderizarInterface() {
    const container = document.getElementById('voos-container');
    if (!container) return;

    const mainContent = container.querySelector('.voos-content');
    if (!mainContent) return;
    
    // Limpa o conteúdo principal
    mainContent.innerHTML = '';

    // Decide qual estado renderizar
    if (this.estaCarregando) {
      this.renderizarCarregamento(mainContent);
    } else if (this.temErro) {
      this.renderizarErro(mainContent);
    } else if (!this.voos || this.voos.length === 0) {
      this.renderizarSemResultados(mainContent);
    } else {
      this.renderizarResultados(mainContent);
    }
  },

  renderizarCarregamento(container) {
    const loading = document.createElement('div');
    loading.className = 'loading-container';
    loading.innerHTML = `
      <img src="assets/images/tripinha/loading.gif" alt="Tripinha carregando" class="loading-avatar">
      <div class="loading-text">Farejando os melhores voos para você...</div>
      <div class="progress-bar-container">
        <div class="progress-bar" role="progressbar" style="width: 50%;" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
    `;
    
    container.appendChild(loading);
  },

  renderizarErro(container) {
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

  renderizarSemResultados(container) {
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
  },

  renderizarResultados(container) {
    // 1. Renderizar mensagem da Tripinha
    const tripinhaMessage = document.createElement('div');
    tripinhaMessage.className = 'tripinha-message';
    tripinhaMessage.innerHTML = `
      <div class="tripinha-avatar">
        <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha">
      </div>
      <div class="tripinha-bubble">
        <p>Encontrei ${this.voos.length} voos para seu destino! 🐾 
           Deslize para ver todas as opções e escolha a que melhor se encaixa no seu plano!</p>
      </div>
    `;
    container.appendChild(tripinhaMessage);
    
    // 2. Renderizar resumo da busca
    const flightsSummary = document.createElement('div');
    flightsSummary.className = 'flights-summary';
    flightsSummary.innerHTML = `
      <div class="flights-summary-header">
        <div>
          <span class="flights-count">${this.voos.length}</span> voos encontrados
        </div>
        <div class="flights-sort">
          <span>Por preço</span>
        </div>
      </div>
    `;
    container.appendChild(flightsSummary);
    
    // 3. Renderizar container de swipe para voos
    const voosContainer = document.createElement('div');
    voosContainer.className = 'voos-swipe-container';
    voosContainer.id = 'voos-swipe-container';
    
    // 4. Renderizar cards de voos
    this.voos.forEach((voo, index) => {
      const cardVoo = this.criarCardVoo(voo, index);
      voosContainer.appendChild(cardVoo);
    });
    
    container.appendChild(voosContainer);
    
    // 5. Renderizar indicadores de paginação
    const paginationIndicator = document.createElement('div');
    paginationIndicator.className = 'pagination-indicator';
    
    this.voos.forEach((_, index) => {
      const dot = document.createElement('div');
      dot.className = 'pagination-dot';
      if (index === this.indexVooAtivo) {
        dot.classList.add('active');
      }
      paginationIndicator.appendChild(dot);
    });
    
    container.appendChild(paginationIndicator);
    
    // 6. Renderizar controles de navegação
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
    
    // 7. Atualizar o botão de seleção fixo
    this.atualizarBotaoSelecao();
  },

  criarCardVoo(voo, index) {
    const cardVoo = document.createElement('div');
    cardVoo.className = 'voo-card';
    
    // Adicionar classes especiais
    if (index === this.indexVooAtivo) {
      cardVoo.classList.add('voo-card-ativo');
    }
    
    if (voo.isMelhorPreco) {
      cardVoo.classList.add('voo-melhor-preco');
    }
    
    if (voo.ida.paradas === 0 && (!voo.volta || voo.volta.paradas === 0)) {
      cardVoo.classList.add('voo-direto');
    }
    
    // Definir atributos de dados
    cardVoo.dataset.vooId = voo.id;
    cardVoo.dataset.vooIndex = index;
    
    // Construir o HTML interno
    cardVoo.innerHTML = `
      ${voo.isMelhorPreco ? '<div class="card-tag melhor-preco">Melhor preço</div>' : ''}
      ${voo.ida.paradas === 0 ? '<div class="card-tag voo-direto">Voo Direto</div>' : ''}
      
      <div class="voo-card-header">
        <div class="voo-price">
          ${voo.precoFormatado}
          ${voo.economiaPercentual > 0 ? `<span class="discount-badge">-${voo.economiaPercentual}%</span>` : ''}
        </div>
        <div class="voo-price-details">Por pessoa, ida${voo.volta ? ' e volta' : ''}</div>
        <div class="airline-info">${voo.companhiaAerea}</div>
      </div>
      
      <div class="voo-card-content">
        <!-- Rota de ida -->
        <div class="flight-route">
          <div class="route-point">
            <div class="route-time">${voo.ida.horaPartida}</div>
            <div class="route-airport">${voo.ida.origem}</div>
          </div>
          <div class="route-line">
            <div class="route-duration">${this.formatarDuracao(voo.ida.duracao)}</div>
            <div class="route-line-bar ${voo.ida.paradas === 0 ? 'route-line-direct' : ''}">
              <span class="stop-marker start"></span>
              ${voo.ida.paradas > 0 ? '<span class="stop-marker mid"></span>' : ''}
              <span class="stop-marker end"></span>
            </div>
            <div class="route-stops ${voo.ida.paradas === 0 ? 'route-stops-direct' : ''}">
              ${voo.ida.paradas === 0 ? 'Voo Direto' : `${voo.ida.paradas} ${voo.ida.paradas === 1 ? 'parada' : 'paradas'}`}
            </div>
          </div>
          <div class="route-point">
            <div class="route-time">${voo.ida.horaChegada}</div>
            <div class="route-airport">${voo.ida.destino}</div>
          </div>
        </div>
        
        ${voo.volta ? `
        <!-- Rota de volta -->
        <div class="flight-route return-route">
          <div class="route-point">
            <div class="route-time">${voo.volta.horaPartida}</div>
            <div class="route-airport">${voo.volta.origem}</div>
          </div>
          <div class="route-line">
            <div class="route-duration">${this.formatarDuracao(voo.volta.duracao)}</div>
            <div class="route-line-bar ${voo.volta.paradas === 0 ? 'route-line-direct' : ''}">
              <span class="stop-marker start"></span>
              ${voo.volta.paradas > 0 ? '<span class="stop-marker mid"></span>' : ''}
              <span class="stop-marker end"></span>
            </div>
            <div class="route-stops ${voo.volta.paradas === 0 ? 'route-stops-direct' : ''}">
              ${voo.volta.paradas === 0 ? 'Voo Direto' : `${voo.volta.paradas} ${voo.volta.paradas === 1 ? 'parada' : 'paradas'}`}
            </div>
          </div>
          <div class="route-point">
            <div class="route-time">${voo.volta.horaChegada}</div>
            <div class="route-airport">${voo.volta.destino}</div>
          </div>
        </div>
        ` : ''}
        
        <!-- Detalhes adicionais -->
        <div class="flight-details">
          <div>
            <span>✓</span> 1 bagagem incluída
          </div>
          <div>
            <span>⏱️</span> Duração: ${this.formatarDuracao(voo.ida.duracao)}
          </div>
        </div>
      </div>
      
      <div class="voo-card-footer">
        <button class="btn-detalhes-voo" data-voo-id="${voo.id}">Ver detalhes</button>
        <div class="remaining-seats">
          Restam <span class="seats-number">${voo.assentosDisponiveis}</span>
        </div>
      </div>
    `;
    
    return cardVoo;
  },

  atualizarBotaoSelecao() {
    const botaoSelecao = document.querySelector('.botao-selecao-fixo');
    if (!botaoSelecao) return;
    
    const btnSelecionar = botaoSelecao.querySelector('.btn-selecionar-voo');
    if (!btnSelecionar) return;
    
    let precoTexto = 'Escolher Este Voo';
    if (this.vooSelecionado) {
      precoTexto = `Escolher Voo por ${this.vooSelecionado.precoFormatado}`;
    } else if (this.vooAtivo) {
      precoTexto = `Escolher Voo por ${this.vooAtivo.precoFormatado}`;
    }
    
    btnSelecionar.innerHTML = `
      <span>${precoTexto}</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7"></path>
      </svg>
    `;
  },

  atualizarVooAtivo() {
    // Atualiza os cards
    document.querySelectorAll('.voo-card').forEach((card, index) => {
      if (index === this.indexVooAtivo) {
        card.classList.add('voo-card-ativo');
        
        // Centraliza na visualização
        card.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest', 
          inline: 'center' 
        });
      } else {
        card.classList.remove('voo-card-ativo');
      }
    });
    
    // Atualiza os dots de paginação
    document.querySelectorAll('.pagination-dot').forEach((dot, index) => {
      if (index === this.indexVooAtivo) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
    
    // Atualiza o botão de seleção
    this.atualizarBotaoSelecao();
  },

  atualizarVooAtivoBaseadoNoScroll(container) {
    if (!container || this.voos.length === 0) return;
    
    // Calcula o índice do voo ativo baseado na posição de scroll
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.querySelector('.voo-card')?.offsetWidth || 0;
    const containerWidth = container.offsetWidth;
    
    if (cardWidth > 0) {
      const novoIndice = Math.round(scrollLeft / cardWidth);
      
      // Verifica se o índice é válido e diferente do atual
      if (novoIndice >= 0 && 
          novoIndice < this.voos.length && 
          novoIndice !== this.indexVooAtivo) {
        
        // Atualiza índice e voo ativo
        this.indexVooAtivo = novoIndice;
        this.vooAtivo = this.voos[this.indexVooAtivo];
        
        // Atualiza a interface
        this.atualizarVooAtivo();
      }
    }
  },

  proximoVoo() {
    if (!this.voos.length || this.voos.length <= 1) return;
    
    this.indexVooAtivo = (this.indexVooAtivo + 1) % this.voos.length;
    this.vooAtivo = this.voos[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },

  vooAnterior() {
    if (!this.voos.length || this.voos.length <= 1) return;
    
    this.indexVooAtivo = (this.indexVooAtivo - 1 + this.voos.length) % this.voos.length;
    this.vooAtivo = this.voos[this.indexVooAtivo];
    this.atualizarVooAtivo();
  },

  selecionarVoo(vooId) {
    if (!this.voos.length) return;
    
    // Encontra o voo pelo ID
    const vooEncontrado = this.voos.find(v => v.id === vooId);
    
    if (!vooEncontrado) { 
      console.error(`Voo ${vooId} não encontrado`); 
      return; 
    }
    
    // Atualiza o voo selecionado
    this.vooSelecionado = vooEncontrado;
    console.log('Voo selecionado:', this.vooSelecionado);
    
    // Encontra o índice do voo selecionado
    const index = this.voos.findIndex(v => v.id === vooId);
    
    if (index !== -1) { 
      this.vooAtivo = vooEncontrado; 
      this.indexVooAtivo = index; 
    }
    
    // Atualiza a UI
    document.querySelectorAll('.voo-card').forEach((card, idx) => {
      if (idx === index) {
        card.classList.add('voo-card-ativo');
        card.classList.add('voo-selecionado');
      } else {
        card.classList.remove('voo-card-ativo');
        card.classList.remove('voo-selecionado');
      }
    });
    
    this.atualizarBotaoSelecao();
    this.exibirToast('Voo selecionado! Confirme sua escolha', 'success');
  },

  selecionarVooAtivo() {
    if (!this.vooAtivo) return;
    
    this.selecionarVoo(this.vooAtivo.id);
  },

  mostrarDetalhesVoo(vooId) {
    if (!this.voos.length) return;
    
    // Encontra o voo pelo ID
    const voo = this.voos.find(v => v.id === vooId);
    
    if (!voo) return;
    
    // Criar o modal de detalhes
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Detalhes do Voo</h3>
          <button class="btn-close-modal" aria-label="Fechar">×</button>
        </div>
        <div class="modal-body">
          <div class="voo-detalhes-preco">
            <div class="voo-price">${voo.precoFormatado}</div>
            <div class="voo-price-details">Por pessoa${voo.volta ? ', ida e volta' : ''}</div>
          </div>
          
          <div class="voo-detalhes-trecho">
            <h4>Ida</h4>
            <div class="flight-route">
              <div class="route-point">
                <div class="route-time">${voo.ida.horaPartida}</div>
                <div class="route-airport">${voo.ida.origem}</div>
              </div>
              <div class="route-line">
                <div class="route-duration">${this.formatarDuracao(voo.ida.duracao)}</div>
                <div class="route-line-bar ${voo.ida.paradas === 0 ? 'route-line-direct' : ''}">
                  <span class="stop-marker start"></span>
                  ${voo.ida.paradas > 0 ? '<span class="stop-marker mid"></span>' : ''}
                  <span class="stop-marker end"></span>
                </div>
                <div class="route-stops ${voo.ida.paradas === 0 ? 'route-stops-direct' : ''}">
                  ${voo.ida.paradas === 0 ? 'Voo Direto' : `${voo.ida.paradas} ${voo.ida.paradas === 1 ? 'parada' : 'paradas'}`}
                </div>
              </div>
              <div class="route-point">
                <div class="route-time">${voo.ida.horaChegada}</div>
                <div class="route-airport">${voo.ida.destino}</div>
              </div>
            </div>
          </div>
          
          ${voo.volta ? `
          <div class="voo-detalhes-trecho">
            <h4>Volta</h4>
            <div class="flight-route">
              <div class="route-point">
                <div class="route-time">${voo.volta.horaPartida}</div>
                <div class="route-airport">${voo.volta.origem}</div>
              </div>
              <div class="route-line">
                <div class="route-duration">${this.formatarDuracao(voo.volta.duracao)}</div>
                <div class="route-line-bar ${voo.volta.paradas === 0 ? 'route-line-direct' : ''}">
                  <span class="stop-marker start"></span>
                  ${voo.volta.paradas > 0 ? '<span class="stop-marker mid"></span>' : ''}
                  <span class="stop-marker end"></span>
                </div>
                <div class="route-stops ${voo.volta.paradas === 0 ? 'route-stops-direct' : ''}">
                  ${voo.volta.paradas === 0 ? 'Voo Direto' : `${voo.volta.paradas} ${voo.volta.paradas === 1 ? 'parada' : 'paradas'}`}
                </div>
              </div>
              <div class="route-point">
                <div class="route-time">${voo.volta.horaChegada}</div>
                <div class="route-airport">${voo.volta.destino}</div>
              </div>
            </div>
          </div>
          ` : ''}
          
          <div class="voo-detalhes-info">
            <h4>Informações Adicionais</h4>
            <ul>
              <li>✓ Bagagem de mão incluída</li>
              <li>✓ Refeição a bordo</li>
              <li>ℹ️ Bagagem despachada opcional</li>
            </ul>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-secondary btn-fechar-detalhes">Voltar</button>
          <button class="modal-btn modal-btn-primary btn-selecionar-detalhes" data-voo-id="${voo.id}">Selecionar Voo</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Configurar eventos
    modal.querySelector('.btn-close-modal').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.querySelector('.btn-fechar-detalhes').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.querySelector('.btn-selecionar-detalhes').addEventListener('click', () => {
      this.selecionarVoo(voo.id);
      modal.remove();
      this.mostrarConfirmacaoSelecao(voo);
    });
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  mostrarConfirmacaoSelecao(voo) {
    // Criar o modal de confirmação
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="confirmacao-tripinha">
          <div class="confirmacao-avatar">
            <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha">
          </div>
          <div class="confirmacao-mensagem">
            <p class="font-bold">Ótima escolha! Voo por ${voo.precoFormatado}/pessoa.</p>
            <div class="confirmacao-checkbox">
              <input type="checkbox" id="confirmar-selecao">
              <label for="confirmar-selecao">Sim, continuar!</label>
            </div>
            <p class="confirmacao-aviso">Valor por pessoa (ida${voo.volta ? '/volta' : ''}). Próxima etapa: hospedagem.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-secondary" id="btn-cancelar">Voltar</button>
          <button class="modal-btn modal-btn-primary" id="btn-confirmar" disabled>Confirmar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Configurar eventos
    const chk = modal.querySelector('#confirmar-selecao');
    const btnC = modal.querySelector('#btn-confirmar');
    const btnX = modal.querySelector('#btn-cancelar');
    
    if (chk) {
      chk.addEventListener('change', () => { 
        if (btnC) btnC.disabled = !chk.checked; 
      });
    }
    
    if (btnX) {
      btnX.addEventListener('click', () => { 
        modal.remove(); 
      });
    }
    
    if (btnC) {
      btnC.addEventListener('click', () => {
        // Salva os dados do voo selecionado
        localStorage.setItem('benetrip_voo_selecionado', JSON.stringify(voo));
        this.exibirToast('Voo selecionado! Redirecionando...', 'success');
        
        // Redireciona para a próxima página
        setTimeout(() => { 
          window.location.href = 'hotels.html'; 
        }, 1500);
      });
    }
    
    // Fecha ao clicar fora do modal
    modal.addEventListener('click', (e) => { 
      if (e.target === modal) modal.remove(); 
    });
  },

  exibirToast(mensagem, tipo = 'info') {
    // Procura o container de toast, se não existir, cria
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    // Cria o elemento toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensagem;
    
    // Adiciona ao container
    toastContainer.appendChild(toast);
    
    // Anima a entrada do toast
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    
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

  mostrarErro(mensagem) {
    console.error('Erro:', mensagem);
    
    this.temErro = true;
    this.estaCarregando = false;
    this.mensagemErro = mensagem || 'Erro desconhecido.';
    
    this.renderizarInterface();
  },

  formatarPreco(preco, moeda = 'BRL') {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: moeda, 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(preco);
  },

  formatarDuracao(duracaoMinutos) {
    const h = Math.floor(duracaoMinutos / 60);
    const m = duracaoMinutos % 60;
    return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
  }
}; // Fim do objeto BENETRIP_VOOS

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('voos-container')) {
    BENETRIP_VOOS.init();
  }
});
