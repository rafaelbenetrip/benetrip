// Parte 1 do flights.js - Modificações nas funções de renderização

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

// Método para carregar mais resultados (pode ser chamado por um botão "Carregar mais")
carregarMaisResultados: function(loadMoreBtn) {
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
    const cardVoo = this.criarCardVooAprimorado(voo, index);
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

// Método para configurar eventos após renderização
configurarEventosAposRenderizacao: function() {
  // Configura swipe e scroll-snap com tratamento de erros adequado
  this.configurarSwipeGestures();
  
  // Configura eventos de scroll para atualizar card ativo
  this.configurarScrollBehavior();
  
  // Configura ações dos cartões individuais
  this.configurarEventosBotoes();
  
  // Configura resposta visual ao navegar pelos voos
  this.configurarFeedbackNavegacao();
  
  // Destaque visual para o primeiro cartão
  this.destacarPrimeiroCard();
  
  // Configura sombras para indicar scroll
  this.configurarShadowScroll();
},

configurarSwipeGestures: function() {
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
configurarScrollBehavior: function() {
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

configurarEventosBotoes: function() {
  // Configura eventos para botões de seleção em cada cartão
  document.querySelectorAll('.btn-detalhes-voo').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const vooId = btn.dataset.vooId;
      if (vooId) this.mostrarDetalhesVoo(vooId);
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
  
  // Configura eventos para botões de navegação
  const nextBtn = document.querySelector('.nav-btn.next-btn');
  const prevBtn = document.querySelector('.nav-btn.prev-btn');
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => this.proximoVoo());
  }
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => this.vooAnterior());
  }
},

configurarFeedbackNavegacao: function() {
  // Configura feedback visual ao navegar pelos voos
  const nextBtn = document.querySelector('.nav-btn.next-btn');
  const prevBtn = document.querySelector('.nav-btn.prev-btn');
  
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
},

destacarPrimeiroCard: function() {
  // Destaca o primeiro voo com delay para chamar atenção
  setTimeout(() => {
    const firstCard = document.querySelector('.voo-card[data-voo-index="0"]');
    if (firstCard && !this.vooSelecionado) {
      firstCard.classList.add('voo-card-highlight');
      setTimeout(() => firstCard.classList.remove('voo-card-highlight'), 800);
    }
  }, 1000);
},

configurarShadowScroll: function() {
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

atualizarVooAtivoBaseadoNoScroll: function(swipeContainer) {
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
atualizarVooAtivo: function() {
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

// Métodos auxiliares para formatação e extração de informações

formatarPreco: function(preco, moeda = 'BRL') {
  if (typeof preco !== 'number' || isNaN(preco)) return 'N/A';
  
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: moeda, 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(preco);
},

formatarDuracao: function(duracaoMinutos) {
  if (typeof duracaoMinutos !== 'number' || duracaoMinutos < 0) return 'N/A';
  
  const h = Math.floor(duracaoMinutos / 60), m = duracaoMinutos % 60;
  return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
},

obterCompanhiasAereas: function(voo) {
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

// Métodos de navegação de voos

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

// Método de seleção de voo
selecionarVoo: function(vooId) {
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

selecionarVooAtivo: function() {
  if (!this.vooAtivo) {
    console.error('Nenhum voo ativo');
    return;
  }
  
  const vooId = this.vooAtivo.sign || `voo-idx-${this.indexVooAtivo}`;
  this.selecionarVoo(vooId);
},

// Método para exibir toast de notificação
exibirToast: function(mensagem, tipo = 'info') {
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
