/**
 * BENETRIP - Visualização de Destinos Recomendados
 * Controla a exibição e interação dos destinos recomendados pela IA
 * Versão 2.3 - Layout otimizado, suporte melhorado a dados dinâmicos e experiência do usuário aprimorada
 */

// Módulo de Destinos do Benetrip
const BENETRIP_DESTINOS = {
  // Dados e estado
  recomendacoes: null,
  dadosUsuario: null,
  estaCarregando: true,
  temErro: false,
  mensagemErro: '',
  abaAtiva: 'visao-geral',
  destinoSelecionado: null, // Adicionado para rastrear o destino atual
  
  // Inicialização
  init() {
    console.log('Inicializando sistema de recomendações de destinos...');
    
    // Configurar manipuladores de eventos
    this.configurarEventos();
    
    // Iniciar carregamento dos dados
    this.carregarDados()
      .then(() => {
        this.renderizarInterface();
      })
      .catch(erro => {
        console.error('Erro na inicialização dos destinos:', erro);
        this.mostrarErro('Não foi possível carregar as recomendações. Por favor, tente novamente.');
      });
    
    // Aplicar estilos modernos
    this.aplicarEstilosModernos();
  },
  
  // Configurar eventos da interface
  configurarEventos() {
    // Evento de progresso do carregamento
    document.addEventListener('benetrip_progress', (evento) => {
      this.atualizarProgresso(
        evento.detail.mensagem, 
        evento.detail.porcentagem
      );
    });
    
    // Botão para voltar ao chat
    const btnVoltar = document.getElementById('btn-voltar');
    if (btnVoltar) {
      btnVoltar.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }
    
    // Delegação de eventos para elementos que serão criados dinamicamente
    document.addEventListener('click', (evento) => {
      // Clique em cartões de destino
      if (evento.target.closest('.card-destino')) {
        const card = evento.target.closest('.card-destino');
        const destino = card.dataset.destino;
        if (evento.target.closest('button')) {
          // Evento foi no botão dentro do card, não no card inteiro
          this.selecionarDestino(destino);
          evento.stopPropagation(); // Impede propagação para o card
        }
      }
      
      // Botão "Me Surpreenda"
      if (evento.target.closest('#btn-surpresa')) {
        this.mostrarDestinoSurpresa();
      }
      
      // Botão para mais opções
      if (evento.target.closest('#btn-mais-opcoes')) {
        this.mostrarMaisOpcoes();
      }
    });
  },
  
  // Sistema de abas para destino principal - CORRIGIDO
  trocarAba(novaAba) {
    this.abaAtiva = novaAba;
    
    // Ocultar conteúdo de todas as abas
    document.querySelectorAll('.conteudo-aba').forEach(el => {
      el.classList.add('hidden');
    });
    
    // Mostrar conteúdo da aba selecionada
    const conteudoAba = document.getElementById(`conteudo-${novaAba}`);
    if (conteudoAba) conteudoAba.classList.remove('hidden');
    
    // Atualizar estilo dos botões de aba
    document.querySelectorAll('.botao-aba').forEach(el => {
      el.classList.remove('aba-ativa');
      el.classList.add('aba-inativa');
    });
    
    const botaoAba = document.getElementById(`aba-${novaAba}`);
    if (botaoAba) {
      botaoAba.classList.remove('aba-inativa');
      botaoAba.classList.add('aba-ativa');
    }
  },

  // Função para trocar aba no modal de destino surpresa - CORRIGIDO
  trocarAbaSurpresa(aba) {
    // Ocultar conteúdo de todas as abas
    document.querySelectorAll('.conteudo-aba-surpresa').forEach(el => {
      el.classList.add('hidden');
    });
    
    // Mostrar conteúdo da aba selecionada
    const conteudoAba = document.getElementById(`conteudo-surpresa-${aba}`);
    if (conteudoAba) conteudoAba.classList.remove('hidden');
    
    // Atualizar estilo dos botões de aba
    document.querySelectorAll('.botao-aba').forEach(el => {
      el.classList.remove('aba-ativa');
      el.classList.add('aba-inativa');
    });
    
    const botaoAba = document.getElementById(`aba-surpresa-${aba}`);
    if (botaoAba) {
      botaoAba.classList.remove('aba-inativa');
      botaoAba.classList.add('aba-ativa');
    }
  },
  
  // Carregar dados do usuário e recomendações
  async carregarDados() {
    try {
      // Obter dados do usuário do localStorage
      this.dadosUsuario = this.carregarDadosUsuario();
      
      if (!this.dadosUsuario) {
        throw new Error('Dados do usuário não encontrados');
      }
      
      console.log('Dados do usuário carregados:', this.dadosUsuario);
      
      // Iniciar carregamento das recomendações
      this.atualizarProgresso('Buscando melhores destinos para você...', 10);
      this.recomendacoes = await this.buscarRecomendacoes();
      
      // Buscar imagens para os destinos recomendados
      this.atualizarProgresso('Buscando imagens dos destinos...', 70);
      await this.enriquecerComImagens();
      
      this.estaCarregando = false;
      return true;
    } catch (erro) {
      console.error('Erro ao carregar dados:', erro);
      this.estaCarregando = false;
      this.temErro = true;
      this.mensagemErro = erro.message;
      throw erro;
    }
  },
  
  // Buscar imagens para um destino – VERSÃO OTIMIZADA
async buscarImagensDestino(destino) {
  try {
    if (!destino) return null;
    
    // Verificar se já temos no cache do BENETRIP_IMAGES
    const cacheKey = `${destino.destino}_${destino.pais}_images`;
    const cachedImages = window.BENETRIP_IMAGES.getFromCache(cacheKey);
    if (cachedImages) {
      console.log(`Usando imagens em cache para ${destino.destino}`);
      return cachedImages;
    }
    
    // Construir a query unindo destino e país em uma única string
    let queryCompleta = destino.destino + ' ' + destino.pais;
    let url = `/api/image-search?query=${encodeURIComponent(queryCompleta)}`;
    
    // Adicionar pontos turísticos específicos à query
    if (destino.pontosTuristicos && destino.pontosTuristicos.length > 0) {
      url += `&pontosTuristicos=${encodeURIComponent(JSON.stringify(destino.pontosTuristicos))}`;
    } else if (destino.pontoTuristico) {
      url += `&pontosTuristicos=${encodeURIComponent(JSON.stringify([destino.pontoTuristico]))}`;
    }
    
    console.log(`Buscando imagens para ${destino.destino} com pontos turísticos`, 
      destino.pontosTuristicos || destino.pontoTuristico);
    
    const resposta = await fetch(url);
    const dados = await resposta.json();
    
    if (dados && dados.images && dados.images.length > 0) {
      console.log(`Encontradas ${dados.images.length} imagens para ${destino.destino}`);
      
      // Adicionar ao cache do BENETRIP_IMAGES
      window.BENETRIP_IMAGES.addToCache(cacheKey, dados.images);
      
      return dados.images;
    }
    
    console.warn(`Nenhuma imagem encontrada para ${destino.destino}`);
    return null;
  } catch (erro) {
    console.error(`Erro ao buscar imagens para ${destino.destino}:`, erro);
    return null;
  }
},
  
  // Buscar imagens para todos os destinos - VERSÃO MELHORADA
async enriquecerComImagens() {
  try {
    console.log('Enriquecendo destinos com imagens...');
    
    // Destino principal
    if (this.recomendacoes.topPick) {
      this.recomendacoes.topPick.imagens = 
        await this.buscarImagensDestino(this.recomendacoes.topPick);
        
      // Pré-carregar imagens para melhorar performance
      if (this.recomendacoes.topPick.imagens && this.recomendacoes.topPick.imagens.length > 0) {
        window.BENETRIP_IMAGES.preloadImages({topPick: this.recomendacoes.topPick});
      }
    }
    
    // Destino surpresa (carregar com prioridade mais baixa)
    if (this.recomendacoes.surpresa) {
      this.recomendacoes.surpresa.imagens = 
        await this.buscarImagensDestino(this.recomendacoes.surpresa);
    }
    
    // Alternativas (com pequenas pausas entre requisições)
    if (this.recomendacoes.alternativas && this.recomendacoes.alternativas.length > 0) {
      for (let i = 0; i < this.recomendacoes.alternativas.length; i++) {
        this.recomendacoes.alternativas[i].imagens = 
          await this.buscarImagensDestino(this.recomendacoes.alternativas[i]);
        
        // Pequena pausa para não sobrecarregar a API
        if (i < this.recomendacoes.alternativas.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
    
    // Validar a qualidade das imagens
    if (window.BENETRIP_IMAGES) {
      window.BENETRIP_IMAGES.testImageQuality(this.recomendacoes);
    }
    
    console.log('Destinos enriquecidos com imagens com sucesso');
    return true;
  } catch (erro) {
    console.error('Erro ao enriquecer destinos com imagens:', erro);
    return false;
  }
},
  
  // Carregar dados do usuário do localStorage
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
  
  // Buscar recomendações da IA
  async buscarRecomendacoes() {
    try {
      this.atualizarProgresso('Analisando suas preferências de viagem...', 20);
      
      if (!window.BENETRIP_AI || !window.BENETRIP_AI.isInitialized()) {
        if (window.BENETRIP_AI && typeof window.BENETRIP_AI.init === 'function') {
          window.BENETRIP_AI.init();
        } else {
          throw new Error('Serviço de IA não disponível');
        }
      }
      
      const recomendacoesSalvas = localStorage.getItem('benetrip_recomendacoes');
      if (recomendacoesSalvas) {
        try {
          const parsed = JSON.parse(recomendacoesSalvas);
          if (parsed && parsed.topPick) {
            console.log('Usando recomendações salvas no localStorage');
            return parsed;
          }
        } catch (e) {
          console.warn('Erro ao processar recomendações salvas:', e);
        }
      }
      
      console.log('Buscando novas recomendações com IA');
      this.atualizarProgresso('Consultando serviços de viagem...', 40);
      
      const recomendacoes = await window.BENETRIP_AI.obterRecomendacoes(this.dadosUsuario.respostas);
      
      // Ajusta mensagem de progresso conforme enriquecimento dos preços
      if (recomendacoes && recomendacoes.tipo && (
          recomendacoes.tipo.includes('enriquecido') || 
          recomendacoes.tipo.includes('perplexity-enriquecido') || 
          recomendacoes.tipo.includes('openai-enriquecido') || 
          recomendacoes.tipo.includes('claude-enriquecido')
        )) {
        this.atualizarProgresso('Preços reais de voos obtidos!', 90);
      } else {
        this.atualizarProgresso('Recomendações geradas com preços estimados', 85);
      }
      
      const conteudo = recomendacoes.conteudo || recomendacoes;
      const dados = typeof conteudo === 'string' ? JSON.parse(conteudo) : conteudo;
      console.log('Recomendações obtidas:', dados);
      
      if (!dados || !dados.topPick) {
        console.error('Recomendações inválidas:', dados);
        throw new Error('Dados de recomendação inválidos');
      }
      
      return dados;
    } catch (erro) {
      console.error('Erro ao buscar recomendações:', erro);
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
  
  // Renderizar a interface com os dados obtidos
  renderizarInterface() {
    try {
      if (this.estaCarregando) {
        console.log('Ainda carregando, mostrando estado de carregamento');
        this.renderizarCarregamento();
        return;
      }
      
      if (this.temErro) {
        console.error('Erro encontrado, mostrando mensagem:', this.mensagemErro);
        this.mostrarErro(this.mensagemErro);
        return;
      }
      
      if (!this.recomendacoes || !this.recomendacoes.topPick) {
        console.error('Recomendações não encontradas ou inválidas');
        this.mostrarErro('Não foi possível carregar as recomendações neste momento.');
        return;
      }
      
      console.log('Renderizando interface com recomendações válidas');
      
      // Ocultar loader e mostrar conteúdo principal
      const loader = document.querySelector('.loading-container');
      if (loader) loader.style.display = 'none';
      
      const conteudo = document.getElementById('conteudo-recomendacoes');
      if (conteudo) {
        conteudo.classList.remove('hidden');
      } else {
        console.error('Container de conteúdo não encontrado no DOM');
        return;
      }
      
      this.renderizarMensagemTripinha();
      this.renderizarDestinoDestaque(this.recomendacoes.topPick);
      this.renderizarDestinosAlternativos(this.recomendacoes.alternativas);
      this.renderizarOpcaoSurpresa();
      this.verificarImagensAposRenderizacao();
      
    } catch (erro) {
      console.error('Erro ao renderizar interface:', erro);
      this.mostrarErro('Ocorreu um erro ao exibir as recomendações.');
    }
  },
  
  // Renderizar estado de carregamento
  renderizarCarregamento() {
    const loader = document.querySelector('.loading-container');
    if (loader) loader.classList.remove('hidden');
    
    const conteudo = document.getElementById('conteudo-recomendacoes');
    if (conteudo) conteudo.classList.add('hidden');
  },
  
  // Exibir mensagem de erro
  mostrarErro(mensagem) {
    const loader = document.querySelector('.loading-container');
    if (loader) loader.style.display = 'none';
    
    const containerErro = document.getElementById('erro-recomendacoes');
    if (containerErro) {
      const mensagemErro = document.getElementById('mensagem-erro');
      if (mensagemErro) mensagemErro.textContent = mensagem;
      containerErro.classList.remove('hidden');
      
      const btnTentar = document.getElementById('btn-tentar-novamente');
      if (btnTentar) {
        btnTentar.addEventListener('click', () => window.location.reload());
      }
    } else {
      const novoContainerErro = document.createElement('div');
      novoContainerErro.id = 'erro-recomendacoes';
      novoContainerErro.className = 'bg-red-100 text-red-700 p-4 rounded-lg my-4 text-center';
      novoContainerErro.innerHTML = `
        <p id="mensagem-erro" class="font-bold">${mensagem}</p>
        <button id="btn-tentar-novamente" class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
          Tentar Novamente
        </button>
      `;
      
      const container = document.querySelector('.container');
      if (container) container.appendChild(novoContainerErro);
      else document.body.appendChild(novoContainerErro);
      
      const btnTentarNovamente = document.getElementById('btn-tentar-novamente');
      if (btnTentarNovamente) {
        btnTentarNovamente.addEventListener('click', () => window.location.reload());
      }
    }
  },
  
  // Método para preparar informações de aeroporto
  prepararInformacaoAeroporto(destino) {
    if (!destino || !destino.aeroporto || !destino.aeroporto.codigo) return '';
    
    const { codigo, nome } = destino.aeroporto;
    return `
      <p class="flex items-center mt-2">
        <span class="mr-2 w-5 text-center">🛫</span> 
        <span class="font-medium">Aeroporto:</span> 
        <span class="ml-1">${nome || 'Aeroporto de ' + destino.destino} (${codigo})</span>
      </p>
    `;
  },

  // Método para preparar informações de voo
  prepararInformacoesVoo(destino) {
    if (!destino || !destino.detalhesVoo) return '';
    
    const { companhia = '-', numeroParadas = 0, duracao = 'N/A' } = destino.detalhesVoo;
    let paradasTexto = 'Direto';
    if (numeroParadas === 1) paradasTexto = '1 parada';
    else if (numeroParadas > 1) paradasTexto = `${numeroParadas} paradas`;
    
    const companhiaTexto = companhia !== '-' ? `<span class="font-medium px-1 py-0.5 rounded bg-gray-200">${companhia}</span>` : '';
    
    return `
      <div class="mt-2 p-2 bg-gray-50 rounded-md text-xs">
        <p class="flex items-center justify-between">
          <span class="flex items-center">
            <span class="mr-1">✈️</span>
            <span>${paradasTexto}</span>
          </span>
          <span>${companhiaTexto}</span>
          <span class="flex items-center">
            <span class="mr-1">⏱️</span>
            <span>${duracao}</span>
          </span>
        </p>
      </div>
    `;
  },
  
  // Renderizar mensagem da Tripinha - AJUSTADO TAMANHO DA FOTO
  renderizarMensagemTripinha() {
    const container = document.getElementById('mensagem-tripinha');
    if (!container) return;
    
    container.innerHTML = `
      <div class="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-orange-100 border-2 border-orange-200">
            <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/60x60?text=🐶'">
          </div>
          <p class="text-gray-800 leading-relaxed">
            Eu farejei por aí e encontrei alguns destinos incríveis para sua aventura! 🐾 Veja minha escolha top — e mais algumas opções se você quiser explorar! Se estiver com vontade de se arriscar, clica em 'Me Surpreenda!' e eu escolho uma joia escondida pra você! 🐕 ✨
          </p>
        </div>
      </div>
    `;
  },
  
  // Método auxiliar para renderizar imagem com créditos - VERSÃO CORRIGIDA COMPLETA
// Método auxiliar para renderizar imagem com créditos - COM ÍCONE DE LUPA
renderizarImagemComCreditos(imagem, fallbackText, classes = '', options = {}) {
  // Options para controlar comportamento
  const { 
    isTopChoice = false, 
    isSurpriseDestination = false,
    showPontoTuristico = true
  } = options || {};
  
  if (!imagem) {
    return `
      <div class="bg-gray-200 ${classes}">
        <img src="https://via.placeholder.com/400x224?text=${encodeURIComponent(fallbackText)}" alt="${fallbackText}" class="w-full h-full object-cover">
      </div>
    `;
  }
  
  // HTML para tags de destaque
  let topChoiceTag = '';
  if (isTopChoice) {
    topChoiceTag = `
      <div class="absolute top-0 left-0 py-1 px-3 z-10 font-bold text-white tag-escolha-top" style="background-color: #E87722;">
        Escolha Top da Tripinha!
      </div>
    `;
  }
  
  let surpriseTag = '';
  if (isSurpriseDestination) {
    surpriseTag = `
      <div class="absolute top-0 left-0 py-1 px-3 z-10 font-bold text-white tag-destino-surpresa rounded-br-lg" style="background-color: #00A3E0;">
        ✨ Destino Surpresa!
      </div>
    `;
  }
  
  // HTML para tag de ponto turístico
  let pontoTuristicoTag = '';
  if (showPontoTuristico && imagem.pontoTuristico) {
    pontoTuristicoTag = `
      <div class="tourist-spot-label">
        ${imagem.pontoTuristico}
      </div>
    `;
  }

  // Garantir que temos URLs e textos alternativos
  const imageUrl = imagem.url || `https://via.placeholder.com/400x224?text=${encodeURIComponent(fallbackText)}`;
  const imageAlt = imagem.alt || fallbackText;
  const sourceUrl = imagem.sourceUrl || '#';
  
  // Montar HTML final com ícone de lupa em vez de texto completo
  return `
    <div class="relative ${classes}">
      <img 
        src="${imageUrl}" 
        alt="${imageAlt}" 
        class="w-full h-full object-cover"
        data-ponto-turistico="${imagem.pontoTuristico || ''}"
        onerror="this.onerror=null; this.src='https://via.placeholder.com/400x224?text=${encodeURIComponent(fallbackText)}';"
      >
      ${topChoiceTag}
      ${surpriseTag}
      ${pontoTuristicoTag}
      
      <!-- Ícone de lupa para créditos -->
      <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="absolute bottom-2 right-2 bg-white bg-opacity-80 p-1.5 rounded-full z-10 hover:bg-opacity-100 transition-all">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </a>
    </div>
  `;
},
  
  // Renderizar destino destaque com sistema de abas
renderizarDestinoDestaque(destino) {
    const container = document.getElementById('destino-destaque');
    if (!container) return;
    
    console.log('Renderizando destino destaque:', destino);
    const temImagens = destino.imagens && destino.imagens.length > 0;
    const estacaoAno = this.obterEstacaoAno() || 'primavera';
    
    // Imagem de cabeçalho expandida
    let headerHtml = `
  <div class="relative rounded-t-lg overflow-hidden">
    <div class="h-48">
      ${this.renderizarImagemComCreditos(
        destino.imagens && destino.imagens.length > 0 ? destino.imagens[0] : null,
        destino.destino,
        'h-full w-full',
        { isTopChoice: true }
      )}
    </div>
  </div>
`;
    
    // Cabeçalho com título e país
    let tituloHtml = `
      <div class="p-4 bg-white">
        <div class="flex justify-between items-center">
          <h3 class="text-xl font-bold">${destino.destino}, ${destino.pais}</h3>
          <span class="text-xs font-medium px-2 py-1 rounded-lg" style="background-color: #E0E0E0;">
            ${destino.codigoPais}
          </span>
        </div>
      </div>
    `;
    
    // Sistema de abas
    let abasHtml = `
      <div class="flex border-b border-gray-200 overflow-x-auto">
        <button id="aba-visao-geral" class="botao-aba aba-ativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAba('visao-geral')">
          Visão Geral
        </button>
        <button id="aba-pontos-turisticos" class="botao-aba aba-inativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAba('pontos-turisticos')">
          Pontos Turísticos
        </button>
        <button id="aba-clima" class="botao-aba aba-inativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAba('clima')">
          Clima
        </button>
        <button id="aba-comentarios" class="botao-aba aba-inativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAba('comentarios')">
          Comentários
        </button>
      </div>
    `;
    
    // Conteúdo da aba Visão Geral
    let visaoGeralHtml = `
      <div id="conteudo-visao-geral" class="conteudo-aba p-4">
        <div class="mt-2 bg-gray-50 p-3 rounded-lg">
          <div class="flex items-center mb-2">
            <span class="text-lg mr-2">✈️</span>
            <span class="font-medium">Aeroporto</span>
          </div>
          <p class="font-medium">${destino.aeroporto?.codigo || ''} - ${destino.aeroporto?.nome || `Aeroporto de ${destino.destino}`}</p>
          ${this.prepararInformacoesVoo(destino)}
        </div>
        
        <div class="mt-4 bg-gray-50 p-3 rounded-lg">
          <div class="flex items-center mb-2">
            <span class="text-lg mr-2">🗓️</span>
            <span class="font-medium">Período da Viagem</span>
          </div>
          <p class="font-medium">${this.obterDatasViagem()}</p>
          <p class="text-sm text-gray-600 mt-1">Estação no destino: ${estacaoAno}</p>
        </div>
        
        <div class="mt-4">
          <h4 class="font-medium mb-2">Por que visitar:</h4>
          <p class="text-gray-800">${destino.porque}</p>
        </div>
        
        <div class="mt-4">
          <h4 class="font-medium mb-2">Destaque da experiência:</h4>
          <p class="text-gray-800">${destino.destaque}</p>
        </div>
      </div>
    `;
    
    // Conteúdo da aba Pontos Turísticos
    let pontosTuristicosHtml = `
      <div id="conteudo-pontos-turisticos" class="conteudo-aba p-4 hidden">
        <p class="text-sm text-gray-600 mb-3">Atrações imperdíveis em ${destino.destino}:</p>
        ${destino.pontosTuristicos && destino.pontosTuristicos.length > 0 ? 
          destino.pontosTuristicos.map((ponto, idx) => `
            <div class="bg-white border border-gray-200 rounded-lg p-3 mb-3 shadow-sm hover:shadow-md transition-all">
              <div class="flex items-center">
                <span class="flex items-center justify-center w-8 h-8 rounded-full mr-3 text-white font-bold" style="background-color: #00A3E0;">${idx + 1}</span>
                <h5 class="font-medium">${ponto}</h5>
              </div>
              <p class="text-sm text-gray-600 mt-2 ml-11">
                ${this.gerarDescricaoAutomatica(ponto, destino.destino)}
              </p>
              ${idx === 0 && destino.imagens && destino.imagens.length > 1 ? `
  <div class="mt-2 ml-11 rounded-lg overflow-hidden h-28 ponto-turistico-galeria" 
       data-ponto="${ponto}" data-destino="${destino.destino}">
    <div class="ponto-turistico-image-container">
      ${this.renderizarImagemComCreditos(
        destino.imagens.find(img => img.pontoTuristico === ponto) || destino.imagens[1],
        ponto,
        'h-full w-full'
      )}
    </div>
  </div>
` : ''}
            </div>
          `).join('') : 
          '<p class="text-center text-gray-500 my-6">Informações sobre pontos turísticos não disponíveis</p>'
        }
      </div>
    `;
    
    // Conteúdo da aba Clima - COM DEBUG LOG ADICIONADO
    let climaHtml = `
      <div id="conteudo-clima" class="conteudo-aba p-4 hidden">
        <div class="text-center bg-blue-50 p-4 rounded-lg">
          <h4 class="font-medium text-lg mb-2">Clima durante sua viagem</h4>
          <div class="text-4xl mb-2">
            ${this.obterEmojiClima(estacaoAno)}
          </div>
          <p class="text-lg font-bold">${estacaoAno.charAt(0).toUpperCase() + estacaoAno.slice(1)}</p>
          <p class="text-sm text-gray-600 mt-2">Temperatura média: ${destino.clima && destino.clima.temperatura || this.obterTemperaturaMedia(destino, estacaoAno)}</p>
          ${destino.clima && destino.clima.condicoes ? `<p class="text-sm text-gray-600 mt-1">${destino.clima.condicoes}</p>` : ''}
        </div>
        
        <div class="mt-4 bg-white border border-gray-200 rounded-lg p-3">
          <h5 class="font-medium mb-2">Recomendações para esta estação:</h5>
          <ul class="list-disc pl-5 text-sm text-gray-700 space-y-1">
            ${(destino.clima && destino.clima.recomendacoes ? 
              (Array.isArray(destino.clima.recomendacoes) ? destino.clima.recomendacoes : [destino.clima.recomendacoes]) : 
              this.obterRecomendacoesClima(destino, estacaoAno)
            ).map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
    
    // Conteúdo da aba Comentários - AJUSTADO TAMANHO DA FOTO
    let comentariosHtml = `
      <div id="conteudo-comentarios" class="conteudo-aba p-4 hidden">
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-orange-100 border-2 border-orange-200">
              <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/60x60?text=🐶'">
            </div>
            <div>
              <p class="font-medium text-sm mb-1">Minha experiência em ${destino.destino}:</p>
              <p class="italic">"${destino.comentario || `Eu amei passear por ${destino.destino}! O cheiro das comidas locais fez meu focinho ficar alerta o tempo todo. Especialmente adorei visitar ${destino.pontosTuristicos && destino.pontosTuristicos.length > 0 ? destino.pontosTuristicos[0] : 'os pontos turísticos'} - uma experiência incrível! 🐾`}"</p>
            </div>
          </div>
        </div>
        
        <div class="mt-4 bg-gray-50 p-4 rounded-lg">
          <h4 class="font-medium mb-2">Dicas de outros viajantes:</h4>
          <div class="border-l-2 border-gray-300 pl-3 py-1">
            <p class="italic text-sm">"Adorei ${destino.destino}! A comida é incrível e as pessoas são muito receptivas. Recomendo visitar na ${estacaoAno}."</p>
            <p class="text-xs text-gray-500 mt-1">- Ana S., viajou em 2024</p>
          </div>
        </div>
      </div>
    `;
    
    // Botão de seleção
    let botaoSelecaoHtml = `
      <div class="p-4 border-t border-gray-200">
        <button class="w-full font-bold py-3 px-4 rounded-lg text-white transition-colors duration-200 hover:opacity-90" 
          style="background-color: #E87722;" 
          data-destino="${destino.destino}" 
          onclick="BENETRIP_DESTINOS.selecionarDestino('${destino.destino}')">
          Escolher Este Destino!
        </button>
      </div>
    `;
    
    // Montar o HTML completo
    container.innerHTML = `
      <div class="border border-gray-200 rounded-lg overflow-hidden shadow-md">
        ${headerHtml}
        ${tituloHtml}
        ${abasHtml}
        ${visaoGeralHtml}
        ${pontosTuristicosHtml}
        ${climaHtml}
        ${comentariosHtml}
        ${botaoSelecaoHtml}
      </div>
    `;
  },
  
  // Método para determinar o ícone por tipo de destino
  determinarIconeTipoDestino(destino) {
    // Palavras-chave para categorizar os destinos
    const destinos = {
      praia: ['praia', 'mar', 'oceano', 'costa', 'ilha', 'caribe', 'litoral'],
      montanha: ['montanha', 'montanhas', 'alpes', 'serra', 'cordilheira', 'neve', 'trilha'],
      cidade: ['cidade', 'metrópole', 'capital', 'urbano', 'urbana'],
      cultural: ['histórico', 'história', 'museu', 'arte', 'cultura', 'antigo'],
      natureza: ['parque', 'natureza', 'floresta', 'selva', 'natural', 'flora', 'fauna']
    };
    
    // Combinar todas as informações de texto para análise
    const textoCompleto = `${destino.destino} ${destino.pais} ${destino.porque || ''} ${destino.pontoTuristico || ''}`.toLowerCase();
    
    // Verificar correspondências
    for (const [tipo, palavrasChave] of Object.entries(destinos)) {
      for (const palavra of palavrasChave) {
        if (textoCompleto.includes(palavra)) {
          // Retornar emoji correspondente
          switch (tipo) {
            case 'praia': return '🏖️';
            case 'montanha': return '🏔️';
            case 'cidade': return '🏙️';
            case 'cultural': return '🏛️';
            case 'natureza': return '🌿';
          }
        }
      }
    }
    
    // Emoji padrão se não encontrar correspondência
    return '✈️';
  },

// Renderizar destinos alternativos em grid - MELHORADO COM IDS ÚNICOS E LISTENERS ESPECÍFICOS
renderizarDestinosAlternativos(destinos) {
  const container = document.getElementById('destinos-alternativos');
  if (!container) return;
  
  container.innerHTML = '<h3 class="font-bold text-lg mt-4 mb-3">Mais Destinos Incríveis</h3>';
  
  // Criar container para o grid
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid grid-cols-2 gap-3';
  container.appendChild(gridContainer);
  
  const destinosLimitados = destinos.slice(0, 4);
  destinosLimitados.forEach(destino => {
    const elementoDestino = document.createElement('div');
    elementoDestino.className = 'card-destino border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 bg-white relative';
    elementoDestino.dataset.destino = destino.destino;
    
    // Determinar ícone baseado no tipo de destino
    const iconeTipo = this.determinarIconeTipoDestino(destino);
    
    // ID único para o botão baseado no nome do destino
    const btnId = `btn-destino-${destino.destino.replace(/\s+/g, '-').toLowerCase()}`;
    
    elementoDestino.innerHTML = `
      <div class="relative">
        ${this.renderizarImagemComCreditos(
  destino.imagens && destino.imagens.length > 0 ? destino.imagens[0] : null,
  destino.destino,
  'h-32',
  { showCredits: false }  // Ocultar créditos nos cards pequenos
)}
        <div class="absolute top-2 right-2 bg-white bg-opacity-90 rounded-full p-1 shadow-sm">
          <span class="text-lg">${iconeTipo}</span>
        </div>
      </div>
      <div class="p-3">
        <div class="flex justify-between items-start">
          <h3 class="font-bold text-sm">${destino.destino}</h3>
          <span class="text-xs font-medium px-1 py-0.5 rounded" style="background-color: #E0E0E0;">
            ${destino.codigoPais}
          </span>
        </div>
        <p class="text-xs text-gray-600 mb-2">${destino.pais}</p>
        
        <div class="flex justify-between items-center">
          <span class="text-sm font-medium">
            <span class="mr-1">✈️</span>
            Aeroporto
          </span>
          ${destino.aeroporto && destino.aeroporto.codigo ? 
            `<span class="text-xs text-gray-500">${destino.aeroporto.codigo}</span>` : 
            ''}
        </div>
        
        ${destino.pontoTuristico ? `
          <div class="mt-2">
            <div class="flex items-center">
              <span class="text-xs mr-1">🎯</span>
              <span class="text-xs text-gray-700">Destaque:</span>
            </div>
            <span class="bg-blue-50 text-blue-800 text-xs px-2 py-0.5 rounded-full inline-block max-w-full truncate">
              ${destino.pontoTuristico}
            </span>
          </div>
        ` : ''}
        <button 
          id="${btnId}"
          class="w-full mt-3 py-1.5 px-2 rounded text-white text-sm font-medium transition-colors hover:opacity-90" 
          style="background-color: #E87722;">
          Escolher Este Destino
        </button>
      </div>
    `;
    
    gridContainer.appendChild(elementoDestino);
    
    // Adicionar event listener específico para cada botão após renderizar
    setTimeout(() => {
      const btnDestino = document.getElementById(btnId);
      if (btnDestino) {
        btnDestino.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selecionarDestino(destino.destino);
        });
      }
    }, 0);
  });
},
  
  // Renderizar opção "Me Surpreenda"
  renderizarOpcaoSurpresa() {
    const container = document.getElementById('opcao-surpresa');
    if (!container) return;
    
    container.innerHTML = `
      <div class="p-4 rounded-lg mt-2 text-white" style="background-color: #E87722;">
        <p class="font-bold text-lg text-center">Ainda não decidiu? Sem problemas! Clique em 'Me Surpreenda!' e eu escolho um lugar baseado nas suas vibes de viagem! 🐾</p>
        <button id="btn-surpresa" class="w-full font-bold py-2.5 px-4 rounded mt-3 transition-colors duration-200 hover:bg-blue-600" style="background-color: #00A3E0; color: white;">
          Me Surpreenda! 🎲
        </button>
      </div>
    `;
  },
  
  // Método para mostrar destino surpresa - VERSÃO OTIMIZADA
mostrarDestinoSurpresa() {
  if (!this.recomendacoes || !this.recomendacoes.surpresa) {
    console.error('Destino surpresa não disponível');
    return;
  }
  
  const destino = this.recomendacoes.surpresa;
  console.log('Mostrando destino surpresa:', destino);
  
  // Salvar temporariamente o destino selecionado para clima correto
  this.destinoSelecionado = destino;
  
  const estacaoAno = this.obterEstacaoAno() || 'primavera';
  
  // Criar o container do modal com classe para animação
  const modalContainer = document.createElement('div');
  modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto modal-surpresa-container';
  modalContainer.id = 'modal-surpresa';
  
  // HTML do modal com design inspirado no destino principal
  modalContainer.innerHTML = `
    <div class="bg-white rounded-lg w-full max-w-md relative max-h-[90vh] overflow-hidden transform transition-transform duration-500 modal-surpresa-content">
      <!-- Imagem com banner e botão de fechar -->
      <div class="relative">
        <div class="h-48 bg-gray-200">
  ${this.renderizarImagemComCreditos(
    destino.imagens && destino.imagens.length > 0 ? destino.imagens[0] : null,
    destino.destino,
    'h-full w-full',
    { isSurpriseDestination: true }
  )}
</div>
        
        <!-- Botão de fechar no canto superior direito -->
        <button class="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center text-white bg-black bg-opacity-60 rounded-full hover:bg-opacity-80 transition-all" 
                onclick="document.getElementById('modal-surpresa').remove()">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <!-- Título do destino com bandeira do país -->
      <div class="p-4 bg-white">
        <div class="flex justify-between items-center">
          <h3 class="text-xl font-bold">${destino.destino}, ${destino.pais}</h3>
          <span class="text-xs font-medium px-2 py-1 rounded-lg" style="background-color: #E0E0E0;">
            ${destino.codigoPais || 'BR'}
          </span>
        </div>
      </div>
      
      <!-- Sistema de abas (mesmo estilo do destino principal) -->
      <div class="flex border-b border-gray-200 overflow-x-auto">
        <button id="aba-surpresa-info" class="botao-aba aba-ativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAbaSurpresa('info')">
          Informações
        </button>
        <button id="aba-surpresa-pontos" class="botao-aba aba-inativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAbaSurpresa('pontos')">
          Pontos Turísticos
        </button>
        <button id="aba-surpresa-clima" class="botao-aba aba-inativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAbaSurpresa('clima')">
          Clima
        </button>
        <button id="aba-surpresa-comentarios" class="botao-aba aba-inativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAbaSurpresa('comentarios')">
          Comentários
        </button>
      </div>
      
      <!-- Conteúdo da aba Informações -->
      <div id="conteudo-surpresa-info" class="conteudo-aba-surpresa p-4 overflow-y-auto" style="max-height: calc(90vh - 280px);">
        <div class="bg-gray-50 p-3 rounded-lg">
          <div class="flex items-center mb-2">
            <span class="text-lg mr-2">✈️</span>
            <span class="font-medium">Aeroporto</span>
          </div>
          <p class="font-medium">${destino.aeroporto?.codigo || ''} - ${destino.aeroporto?.nome || `Aeroporto de ${destino.destino}`}</p>
          ${this.prepararInformacoesVoo(destino)}
        </div>
        
        <div class="mt-4 bg-gray-50 p-3 rounded-lg">
          <div class="flex items-center mb-2">
            <span class="text-lg mr-2">🗓️</span>
            <span class="font-medium">Período da Viagem</span>
          </div>
          <p class="font-medium">${this.obterDatasViagem()}</p>
          <p class="text-sm text-gray-600 mt-1">Estação no destino: ${estacaoAno}</p>
        </div>
        
        <div class="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
          <div class="flex items-start">
            <span class="text-lg mr-2">🎁</span>
            <div>
              <h4 class="font-medium mb-1">Por que visitar:</h4>
              <p class="text-gray-800 text-sm">${destino.porque || 'Um destino fascinante com muitas atrações.'}</p>
            </div>
          </div>
        </div>
        
        <div class="mt-4">
          <h4 class="font-medium mb-2">Destaque da experiência:</h4>
          <p class="text-gray-800">${destino.destaque || 'Experiências únicas que você lembrará para sempre.'}</p>
        </div>
        
        ${this.prepararInformacaoAeroporto(destino)}
      </div>
      
      <!-- Conteúdo da aba Pontos Turísticos -->
      <div id="conteudo-surpresa-pontos" class="conteudo-aba-surpresa p-4 overflow-y-auto hidden" style="max-height: calc(90vh - 280px);">
        <p class="text-sm text-gray-600 mb-3">Atrações imperdíveis em ${destino.destino}:</p>
        
        ${destino.pontosTuristicos && destino.pontosTuristicos.length > 0 ? 
          destino.pontosTuristicos.map((ponto, idx) => `
            <div class="bg-white border border-gray-200 rounded-lg p-3 mb-3 shadow-sm hover:shadow-md transition-all">
              <div class="flex items-center">
                <span class="flex items-center justify-center w-8 h-8 rounded-full mr-3 text-white font-bold" style="background-color: #00A3E0;">${idx + 1}</span>
                <h5 class="font-medium">${ponto}</h5>
              </div>
              <p class="text-sm text-gray-600 mt-2 ml-11">
                ${this.gerarDescricaoAutomatica(ponto, destino.destino)}
              </p>
              ${idx === 0 && destino.imagens && destino.imagens.length > 1 ? `
                <div class="mt-2 ml-11 rounded-lg overflow-hidden h-28 ponto-turistico-galeria"
                     data-ponto="${ponto}" data-destino="${destino.destino}">
                  <div class="ponto-turistico-image-container">
                    ${this.renderizarImagemComCreditos(
                      destino.imagens.find(img => img.pontoTuristico === ponto) || destino.imagens[1],
                      ponto,
                      'h-full w-full'
                    )}
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('') : 
          '<p class="text-center text-gray-500 my-6">Informações sobre pontos turísticos não disponíveis</p>'
        }
      </div>
      
      <!-- Conteúdo da aba Clima -->
      <div id="conteudo-surpresa-clima" class="conteudo-aba-surpresa p-4 overflow-y-auto hidden" style="max-height: calc(90vh - 280px);">
        <div class="text-center bg-blue-50 p-4 rounded-lg">
          <h4 class="font-medium text-lg mb-2">Clima durante sua viagem</h4>
          <div class="text-4xl mb-2">
            ${this.obterEmojiClima(estacaoAno)}
          </div>
          <p class="text-lg font-bold">${estacaoAno.charAt(0).toUpperCase() + estacaoAno.slice(1)}</p>
          <p class="text-sm text-gray-600 mt-2">Temperatura média: ${destino.clima && destino.clima.temperatura || this.obterTemperaturaMedia(destino, estacaoAno)}</p>
          ${destino.clima && destino.clima.condicoes ? `<p class="text-sm text-gray-600 mt-1">${destino.clima.condicoes}</p>` : ''}
        </div>
        
        <div class="mt-4 bg-white border border-gray-200 rounded-lg p-3">
          <h5 class="font-medium mb-2">Recomendações para esta estação:</h5>
          <ul class="list-disc pl-5 text-sm text-gray-700 space-y-1">
            ${(destino.clima && destino.clima.recomendacoes ? 
              (Array.isArray(destino.clima.recomendacoes) ? destino.clima.recomendacoes : [destino.clima.recomendacoes]) : 
              this.obterRecomendacoesClima(destino, estacaoAno)
            ).map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      </div>
      
      <!-- Conteúdo da aba Comentários -->
      <div id="conteudo-surpresa-comentarios" class="conteudo-aba-surpresa p-4 overflow-y-auto hidden" style="max-height: calc(90vh - 280px);">
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-orange-100 border-2 border-orange-200">
              <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/60x60?text=🐶'">
            </div>
            <div>
              <p class="font-medium text-sm mb-1">Minha experiência em ${destino.destino}:</p>
              <p class="italic">"${destino.comentario || `Foi incrível explorar ${destino.destino}! ${destino.pontosTuristicos && destino.pontosTuristicos.length > 0 ? 'Especialmente ' + destino.pontosTuristicos[0] + '!' : 'O lugar é maravilhoso!'} 🐾`}"</p>
            </div>
          </div>
        </div>
        
        <div class="mt-4 bg-gray-50 p-4 rounded-lg">
          <h4 class="font-medium mb-2">Dicas de outros viajantes:</h4>
          <div class="border-l-2 border-gray-300 pl-3 py-1">
            <p class="italic text-sm">"Adorei ${destino.destino}! A experiência é incrível e o clima é perfeito na ${estacaoAno}."</p>
            <p class="text-xs text-gray-500 mt-1">- Ana S., viajou em 2024</p>
          </div>
        </div>
      </div>
      
      <!-- Botões de ação -->
      <div class="p-4 border-t border-gray-200">
        <button class="w-full font-bold py-3 px-4 rounded-lg text-white transition-colors duration-200 hover:opacity-90 mb-2" 
          style="background-color: #00A3E0;" 
          onclick="BENETRIP_DESTINOS.selecionarDestino('${destino.destino}'); document.getElementById('modal-surpresa').remove()">
          Quero Este Destino Surpresa!
        </button>
        
        <button class="w-full font-medium py-2.5 px-4 rounded-lg border border-gray-300 transition-colors duration-200 hover:bg-gray-100" 
          onclick="document.getElementById('modal-surpresa').remove()">
          Voltar às Sugestões
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalContainer);
  
  // Adicionar classe para animar entrada após um pequeno delay
  setTimeout(() => {
    const modalContent = document.querySelector('.modal-surpresa-content');
    if (modalContent) {
      modalContent.classList.add('scale-100');
      modalContent.classList.remove('scale-95', 'opacity-0');
    }
  }, 10);
  
  // Fechar modal ao clicar fora
  modalContainer.addEventListener('click', function(e) {
    if (e.target === this) {
      this.remove();
      BENETRIP_DESTINOS.destinoSelecionado = null;
    }
  });
  
  // MELHORIA: Aprimorar qualidade das imagens após renderização do modal
  setTimeout(() => {
    // Melhorar qualidade das imagens no modal surpresa
    if (destino.imagens && destino.imagens.length > 0) {
      const imgContainer = document.querySelector('.modal-surpresa-content .image-container');
      if (imgContainer) {
        const imgElement = imgContainer.querySelector('img');
        if (imgElement) {
          window.BENETRIP_IMAGES.enhanceExistingImage(imgElement, destino.imagens[0]);
        }
      }
      
      // Melhorar imagens de pontos turísticos
      const pontosTuristicosImgs = document.querySelectorAll('.ponto-turistico-galeria img');
      pontosTuristicosImgs.forEach(img => {
        const pontoTuristico = img.closest('.ponto-turistico-galeria').dataset.ponto;
        const imagemPonto = destino.imagens.find(img => img.pontoTuristico === pontoTuristico);
        if (imagemPonto) {
          window.BENETRIP_IMAGES.enhanceExistingImage(img, imagemPonto);
        }
      });
    }
  }, 300);
},
  
  // Método para selecionar um destino - VERSÃO CORRIGIDA E MELHORADA
  selecionarDestino(nomeDestino) {
    console.log(`Destino selecionado: ${nomeDestino}`);
    let destinoSelecionado = null;
    
    // Encontrar o destino pelo nome
    if (this.recomendacoes.topPick.destino === nomeDestino) {
        destinoSelecionado = this.recomendacoes.topPick;
    } else if (this.recomendacoes.surpresa && this.recomendacoes.surpresa.destino === nomeDestino) {
        destinoSelecionado = this.recomendacoes.surpresa;
    } else {
        destinoSelecionado = this.recomendacoes.alternativas.find(d => d.destino === nomeDestino);
    }
    
    if (!destinoSelecionado) {
        console.error(`Destino não encontrado: ${nomeDestino}`);
        alert('Desculpe, não foi possível encontrar informações sobre este destino. Por favor, tente outro.');
        return;
    }
    
    // Padronizar os dados do destino - Muito importante para a busca de voos
    const destinoPadronizado = {
        ...destinoSelecionado,
        // Garantir que o código IATA esteja no formato correto e disponível em local padrão
        codigo_iata: destinoSelecionado.aeroporto?.codigo || 
                      destinoSelecionado.codigo_iata || 
                      this.obterCodigoIATADestino(destinoSelecionado)
    };
    
    // Salvar em formato padronizado
    localStorage.setItem('benetrip_destino_selecionado', JSON.stringify(destinoPadronizado));
    
    // Atualizar os dados do usuário para incluir o destino selecionado
    try {
        const dadosUsuario = JSON.parse(localStorage.getItem('benetrip_user_data') || '{}');
        dadosUsuario.fluxo = 'destino_desconhecido'; // Indicar que é um destino da recomendação
        
        // Incluir código IATA do destino nas respostas
        if (!dadosUsuario.respostas) dadosUsuario.respostas = {};
        dadosUsuario.respostas.destino_escolhido = {
            name: destinoPadronizado.destino,
            pais: destinoPadronizado.pais,
            code: destinoPadronizado.codigo_iata
        };
        
        localStorage.setItem('benetrip_user_data', JSON.stringify(dadosUsuario));
    } catch (e) {
        console.warn('Erro ao atualizar fluxo nos dados do usuário:', e);
    }
    
    this.mostrarConfirmacaoSelecao(destinoPadronizado);
  },
  
  // Método auxiliar para tentar obter código IATA
  obterCodigoIATADestino(destino) {
    // Lista de capitais e cidades principais com seus códigos IATA
    const cidadesComuns = {
        'paris': 'CDG',
        'londres': 'LHR',
        'nova york': 'JFK',
        'roma': 'FCO',
        'tóquio': 'HND',
        'são paulo': 'GRU',
        'rio de janeiro': 'GIG',
        'madri': 'MAD',
        'lisboa': 'LIS',
        'barcelona': 'BCN',
        'miami': 'MIA',
        'orlando': 'MCO'
    };
    
    const nomeLower = destino.destino.toLowerCase();
    
    // Tenta encontrar por nome da cidade
    for (const [cidade, codigo] of Object.entries(cidadesComuns)) {
        if (nomeLower.includes(cidade)) return codigo;
    }
    
    // Se não encontrar, usa a primeira letra do país + primeiras duas letras da cidade
    // Este é apenas um fallback temporário; na versão real precisaria usar uma API
    const primeiraLetraPais = destino.pais.charAt(0).toUpperCase();
    const primeirasLetrasCidade = destino.destino.substring(0, 2).toUpperCase();
    return primeiraLetraPais + primeirasLetrasCidade;
  },
  
  // Método para mostrar confirmação de seleção - AJUSTADO TAMANHO DA FOTO
  // Método para mostrar confirmação de seleção - AJUSTADO TAMANHO DA FOTO
mostrarConfirmacaoSelecao(destino) {
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
            <p class="font-bold">Ótima escolha, Triper! 🐾 ${destino.destino} é incrível! Tem certeza que este é o destino certo para sua aventura?</p>
            <div class="mt-3">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" id="confirmar-selecao" class="form-checkbox h-5 w-5 rounded" style="color: #E87722;">
                <span>Sim, tenho certeza!</span>
              </label>
            </div>
            <p class="mt-3 text-sm">
              Você poderá consultar os preços reais de voos e hospedagens na próxima etapa, com nossos parceiros confiáveis.
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
    window.location.href = 'flights.html';
  });
  
  // Fechar modal ao clicar fora - ADICIONADO
  modalContainer.addEventListener('click', function(e) {
    if (e.target === this) {
      this.remove();
    }
  });
},
  
  // Método auxiliar para obter período de datas da viagem
  obterDatasViagem() {
    try {
      const dadosUsuario = this.dadosUsuario;
      if (dadosUsuario && dadosUsuario.respostas && dadosUsuario.respostas.datas) {
        const datas = dadosUsuario.respostas.datas;
        console.log('Datas encontradas:', datas);
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
  
  // FUNÇÕES PARA INFORMAÇÕES DE CLIMA
  // Função corrigida para considerar hemisférios - ADICIONADO LOG
  obterEstacaoAno() {
    try {
      // Obter estação do ano dos dados da viagem ou determinar por data
      if (this.recomendacoes && this.recomendacoes.estacaoViagem) {
        return this.recomendacoes.estacaoViagem;
      }
      
      // Lógica de fallback para determinar estação
      const dataViagem = this.obterDataIdaObj();
      if (!dataViagem) return 'primavera';
      
      const mes = dataViagem.getMonth();
      let estacao = '';
      
      // Determinar estação para hemisfério norte
      if (mes >= 2 && mes <= 4) estacao = 'primavera';
      else if (mes >= 5 && mes <= 7) estacao = 'verão';
      else if (mes >= 8 && mes <= 10) estacao = 'outono';
      else estacao = 'inverno';
      
      // Verificar se o destino está no hemisfério sul
      const destinoAtual = this.obterDestinoAtual();
      const hemisferio = this.estaNoHemisferioSul(destinoAtual) ? 'sul' : 'norte';
      console.log(`Cálculo de estação para ${destinoAtual?.destino || 'destino desconhecido'} no hemisfério ${hemisferio}`);
      console.log(`Mês da viagem: ${mes}, estação base: ${estacao}`);
      
      if (this.estaNoHemisferioSul(destinoAtual)) {
        // Inverter estações para hemisfério sul
        if (estacao === 'verão') return 'inverno';
        if (estacao === 'inverno') return 'verão';
        if (estacao === 'primavera') return 'outono';
        if (estacao === 'outono') return 'primavera';
      }
      
      return estacao;
    } catch (erro) {
      console.error('Erro ao obter estação do ano:', erro);
      return 'primavera';
    }
  },

  // Obter o destino atual em foco
  obterDestinoAtual() {
    // Retorna o destino atualmente em foco
    if (this.destinoSelecionado) return this.destinoSelecionado;
    if (this.recomendacoes && this.recomendacoes.topPick) return this.recomendacoes.topPick;
    return null;
  },

  // Verifica se um destino está no hemisfério sul
  estaNoHemisferioSul(destino) {
    if (!destino || !destino.pais) return false;
    
    // Lista de países no hemisfério sul
    const paisesHemisferioSul = [
      'Argentina', 'Austrália', 'Bolívia', 'Brasil', 'Chile', 
      'Nova Zelândia', 'Paraguai', 'Peru', 'Uruguai', 'África do Sul'
    ];
    
    return paisesHemisferioSul.some(pais => 
      destino.pais.toLowerCase().includes(pais.toLowerCase())
    );
  },

  obterDataIdaObj() {
    try {
      const dadosUsuario = this.dadosUsuario;
      if (dadosUsuario && dadosUsuario.respostas && dadosUsuario.respostas.datas) {
        const datas = dadosUsuario.respostas.datas;
        if (datas.dataIda) {
          return new Date(datas.dataIda);
        }
      }
      return null;
    } catch (erro) {
      return null;
    }
  },

  obterEmojiClima(estacao) {
    const emojis = {
      'primavera': '🌸',
      'verão': '☀️',
      'outono': '🍂',
      'inverno': '❄️'
    };
    return emojis[estacao] || '🌤️';
  },

  // Método para obter temperatura média - ADICIONADO LOG
  obterTemperaturaMedia(destino, estacao) {
    // Verificar se temos dados de clima da IA
    if (destino && destino.clima && destino.clima.temperatura) {
      console.log(`Usando temperatura da IA para ${destino.destino}: ${destino.clima.temperatura}`);
      return destino.clima.temperatura;
    }
    
    // Log para debug da fonte dos dados climáticos
    console.log(`Fonte de dados climáticos para ${destino.destino}: Fallback local`);
    
    // Fallback apenas se não houver dados da IA
    const temperaturas = {
      'primavera': { 'default': '18°C a 22°C' },
      'verão': { 'default': '25°C a 30°C' },
      'outono': { 'default': '15°C a 20°C' },
      'inverno': { 'default': '5°C a 12°C' }
    };
    
    // Adicionar algumas cidades específicas para demonstração
    temperaturas.verão['Medellín'] = '22°C a 28°C';
    temperaturas.inverno['Medellín'] = '17°C a 22°C';
    
    return temperaturas[estacao][destino.destino] || temperaturas[estacao].default;
  },

  obterRecomendacoesClima(destino, estacao) {
    // Verificar se temos recomendações de clima da IA
    if (destino && destino.clima && destino.clima.recomendacoes) {
      return Array.isArray(destino.clima.recomendacoes) 
        ? destino.clima.recomendacoes 
        : [destino.clima.recomendacoes];
    }
    
    // Fallback apenas se não houver dados da IA
    const recomendacoes = {
      'primavera': [
        'Leve roupas leves mas tenha um casaco para noites mais frias',
        'Prepare-se para chuvas ocasionais',
        'Ótima época para atividades ao ar livre'
      ],
      'verão': [
        'Leve roupas leves e frescas',
        'Protetor solar é essencial',
        'Hidrate-se frequentemente durante passeios'
      ],
      'outono': [
        'Leve camadas de roupas para se adaptar às mudanças de temperatura',
        'Guarda-chuva compacto pode ser útil',
        'Aproveite as cores da estação para fotos'
      ],
      'inverno': [
        'Leve roupas quentes e impermeáveis',
        'Prefira hospedagens com aquecimento',
        'Verifique condições climáticas antes de passeios ao ar livre'
      ]
    };
    
    return recomendacoes[estacao] || recomendacoes.primavera;
  },

  obterMelhorEpocaVisita(destino) {
    // Mapeamento simples de destinos e melhores épocas
    // Em implementação real, isso viria da API
    const melhoresEpocas = {
      'Medellín': 'De dezembro a março (estação seca) ou de julho a agosto (verão do hemisfério norte).',
      'Cartagena': 'De dezembro a abril, quando há menos chuvas e o clima é mais agradável.',
      'default': 'A primavera e o outono costumam oferecer o melhor equilíbrio entre clima agradável e menos turistas.'
    };
    
    return melhoresEpocas[destino] || melhoresEpocas.default;
  },
  
  gerarDescricaoAutomatica(pontoTuristico, destino) {
    // Gera descrições fictícias para pontos turísticos
    // Em uma implementação real, isso viria dos dados da IA
    const descricoes = [
      `Um dos locais mais visitados de ${destino}, perfeito para fotos incríveis.`,
      `Atração imperdível que representa a cultura local de ${destino}.`,
      `Local histórico que conta muito sobre a história de ${destino}.`,
      `Ponto turístico famoso por sua arquitetura e beleza natural.`,
      `Destino popular entre turistas e moradores locais de ${destino}.`
    ];
    
    // Usar o nome do ponto turístico para gerar um índice pseudo-aleatório
    const hash = pontoTuristico.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const index = hash % descricoes.length;
    
    return descricoes[index];
  },

// Método para verificar e corrigir imagens problemáticas após renderização
verificarImagensAposRenderizacao() {
  // Selecionar todas as imagens de destinos
  const imagens = document.querySelectorAll('.image-container img');
  
  imagens.forEach(img => {
    // Verificar se a imagem já carregou corretamente
    if (img.complete && img.naturalWidth === 0) {
      // Imagem com erro de carregamento
      const pontoTuristico = img.dataset.pontoTuristico;
      const alt = img.alt || 'imagem de destino';
      
      // Usar o handler de erro do BENETRIP_IMAGES
      window.BENETRIP_IMAGES.handleImageError(img);
    }
    
    // Adicionar handler para imagens que ainda estão carregando
    img.addEventListener('error', function() {
      window.BENETRIP_IMAGES.handleImageError(this);
    });
  });
},
  
  // Método para aplicar estilos modernos - ADICIONADA ANIMAÇÃO DE LOADING
  aplicarEstilosModernos() {
    // Criar elemento de estilo
    const estiloElement = document.createElement('style');
    estiloElement.textContent = `
      /* Estilos para abas */
      .aba-ativa {
        color: #E87722;
        border-bottom: 2px solid #E87722;
        font-weight: 600;
      }
      
      .aba-inativa {
        color: #6B7280;
        border-bottom: 2px solid transparent;
      }
      
      /* Cards com profundidade */
      .card-destino {
        transition: all 0.3s ease;
        box-shadow: 0 2px 5px rgba(0,0,0,0.08);
      }
      
      .card-destino:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 15px rgba(0,0,0,0.1);
      }
      
      /* Animação para destino surpresa */
      .modal-surpresa-content {
        transform: scale(0.95);
        opacity: 0;
        transition: all 0.3s ease-out;
      }
      
      .modal-surpresa-content.scale-100 {
        transform: scale(1);
        opacity: 1;
      }
      
      /* Melhorias nas imagens */
      .image-container {
        position: relative;
        overflow: hidden;
      }
      
      .image-container img {
        transition: transform 0.5s ease;
      }
      
      .image-container:hover img {
        transform: scale(1.05);
      }
      
      /* Degradês funcionais */
      .gradient-header {
        background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
      }
      
      .gradient-footer {
        background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
      }
      
      /* Melhorias na tipografia */
      h3 {
        letter-spacing: -0.01em;
      }
      
      .text-price {
        font-feature-settings: "tnum";
        font-variant-numeric: tabular-nums;
      }
      
      /* Indicador visual para cards clicáveis */
      .card-destino::after {
        content: "";
        position: absolute;
        bottom: 8px;
        right: 8px;
        width: 20px;
        height: 20px;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="%23888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>');
        background-repeat: no-repeat;
        opacity: 0.7;
        transition: opacity 0.3s ease;
      }
      
      .card-destino:hover::after {
        opacity: 1;
      }
      
      /* Animação de carregamento para imagens */
      .image-container.loading {
        position: relative;
      }
      
      .image-container.loading::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
        animation: loading-shine 1.5s infinite;
      }
      
      @keyframes loading-shine {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `;
    
    // Adicionar ao documento
    document.head.appendChild(estiloElement);
  }
};

// Inicializar o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  // Certificar que os serviços dependentes estão inicializados
  if (!window.BENETRIP_IMAGES || !window.BENETRIP_IMAGES.isInitialized()) {
    console.log('Inicializando serviço de imagens');
    window.BENETRIP_IMAGES = window.BENETRIP_IMAGES || {};
    window.BENETRIP_IMAGES.init();
  }
  
  // Inicializar o módulo de destinos
  BENETRIP_DESTINOS.init();
});
