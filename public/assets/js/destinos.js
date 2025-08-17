/**
 * BENETRIP - Visualização de Destinos Recomendados 
 * Versão 6.0 - SUPORTE A VIAGENS RODOVIÁRIAS E AÉREAS
 * Adaptado para mostrar informações de ônibus (< R$ 401) e avião (>= R$ 401)
 */

const BENETRIP_DESTINOS = {
  // Dados e estado
  recomendacoes: null,
  dadosUsuario: null,
  estaCarregando: true,
  temErro: false,
  mensagemErro: '',
  abaAtiva: 'visao-geral',
  tipoViagem: 'aereo', // 'aereo' ou 'rodoviario'
  
  // Inicialização
  init() {
    console.log('Inicializando sistema de recomendações (rodoviárias + aéreas)...');
    
    this.configurarEventos();
    this.carregarDados()
      .then(() => {
        this.renderizarInterface();
      })
      .catch(erro => {
        console.error('Erro na inicialização dos destinos:', erro);
        this.mostrarErro('Não foi possível carregar as recomendações. Por favor, tente novamente.');
      });
    
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
        window.location.href = 'chat.html';
      });
    }
    
    // Delegação de eventos para elementos dinâmicos
    document.addEventListener('click', (evento) => {
      // Clique em botões de destino
      if (evento.target.closest('.btn-selecionar-destino')) {
        const destino = evento.target.closest('.btn-selecionar-destino').dataset.destino;
        this.selecionarDestino(destino);
        evento.stopPropagation();
      }
      
      // Botão "Me Surpreenda"
      if (evento.target.closest('#btn-surpresa')) {
        this.mostrarDestinoSurpresa();
      }
    });
  },
  
  // Sistema de abas
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

  // Trocar aba no modal de destino surpresa
  trocarAbaSurpresa(aba) {
    document.querySelectorAll('.conteudo-aba-surpresa').forEach(el => {
      el.classList.add('hidden');
    });
    
    const conteudoAba = document.getElementById(`conteudo-surpresa-${aba}`);
    if (conteudoAba) conteudoAba.classList.remove('hidden');
    
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
      this.dadosUsuario = this.carregarDadosUsuario();
      
      if (!this.dadosUsuario) {
        throw new Error('Dados do usuário não encontrados');
      }
      
      console.log('Dados do usuário carregados:', this.dadosUsuario);
      
      this.atualizarProgresso('Buscando melhores destinos para você...', 10);
      this.recomendacoes = await this.buscarRecomendacoes();
      
      // Detectar tipo de viagem baseado nos dados retornados
      this.tipoViagem = this.recomendacoes.tipoViagem || 'aereo';
      console.log(`🚌✈️ Tipo de viagem detectado: ${this.tipoViagem.toUpperCase()}`);
      
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
      
      // Verificar se há recomendações salvas
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
      
      console.log('Buscando novas recomendações com IA (suporte rodoviário + aéreo)');
      this.atualizarProgresso('Consultando serviços de viagem...', 40);
      
      const recomendacoes = await window.BENETRIP_AI.obterRecomendacoes(this.dadosUsuario.respostas);
      
      // Atualizar progresso baseado no tipo de resposta
      if (recomendacoes && recomendacoes.tipo) {
        if (recomendacoes.tipo.includes('no_fallback')) {
          this.atualizarProgresso('Dados climáticos obtidos da IA especializada!', 90);
        } else if (recomendacoes.tipo.includes('enriquecido')) {
          this.atualizarProgresso('Preços reais de voos obtidos!', 90);
        } else {
          this.atualizarProgresso('Recomendações geradas com preços estimados', 85);
        }
      }
      
      const conteudo = recomendacoes.conteudo || recomendacoes;
      const dados = typeof conteudo === 'string' ? JSON.parse(conteudo) : conteudo;
      console.log('Recomendações obtidas (rodoviário + aéreo):', dados);
      
      if (!dados || !dados.topPick) {
        throw new Error('Dados de recomendação inválidos');
      }
      
      return dados;
    } catch (erro) {
      console.error('Erro ao buscar recomendações:', erro);
      throw erro;
    }
  },
  
  // Buscar imagens para um destino
  async buscarImagensDestino(destino) {
    try {
      if (!destino || !destino.destino) return null;
      
      // Verificar cache
      const cacheKey = `${destino.destino}_${destino.pais}_images`;
      const cachedImages = window.BENETRIP_IMAGES?.getFromCache?.(cacheKey);
      if (cachedImages) {
        console.log(`Usando imagens em cache para ${destino.destino}`);
        return cachedImages;
      }
      
      // Construir query para busca de imagens
      let queryCompleta = `${destino.destino} ${destino.pais}`;
      let url = `/api/image-search?query=${encodeURIComponent(queryCompleta)}`;
      
      // Adicionar pontos turísticos específicos
      const pontos = destino.pontosTuristicos || (destino.pontoTuristico ? [destino.pontoTuristico] : []);
      if (pontos.length > 0) {
        url += `&pontosTuristicos=${encodeURIComponent(JSON.stringify(pontos))}`;
        url += `&perPage=${pontos.length}`;
      }
      
      console.log(`Buscando imagens para ${destino.destino} com pontos turísticos`, pontos);
      
      const resposta = await fetch(url);
      const dados = await resposta.json();
      
      if (dados && dados.images && dados.images.length > 0) {
        console.log(`Encontradas ${dados.images.length} imagens para ${destino.destino}`);
        
        // Adicionar ao cache se disponível
        if (window.BENETRIP_IMAGES?.addToCache) {
          window.BENETRIP_IMAGES.addToCache(cacheKey, dados.images);
        }
        
        return dados.images;
      }
      
      console.warn(`Nenhuma imagem encontrada para ${destino.destino}`);
      return null;
    } catch (erro) {
      console.error(`Erro ao buscar imagens para ${destino.destino}:`, erro);
      return null;
    }
  },
  
  // Enriquecer destinos com imagens
  async enriquecerComImagens() {
    try {
      console.log('Enriquecendo destinos com imagens...');
      
      // Destino principal
      if (this.recomendacoes.topPick) {
        this.recomendacoes.topPick.imagens = 
          await this.buscarImagensDestino(this.recomendacoes.topPick);
      }
      
      // Destino surpresa
      if (this.recomendacoes.surpresa) {
        this.recomendacoes.surpresa.imagens = 
          await this.buscarImagensDestino(this.recomendacoes.surpresa);
      }
      
      // Alternativas
      if (this.recomendacoes.alternativas && this.recomendacoes.alternativas.length > 0) {
        for (let i = 0; i < this.recomendacoes.alternativas.length; i++) {
          this.recomendacoes.alternativas[i].imagens = 
            await this.buscarImagensDestino(this.recomendacoes.alternativas[i]);
          
          // Pausa entre requisições
          if (i < this.recomendacoes.alternativas.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }
      
      console.log('Destinos enriquecidos com imagens com sucesso');
      return true;
    } catch (erro) {
      console.error('Erro ao enriquecer destinos com imagens:', erro);
      return false;
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
  
  // Renderizar a interface principal
  renderizarInterface() {
    try {
      if (this.estaCarregando) {
        this.renderizarCarregamento();
        return;
      }
      
      if (this.temErro) {
        this.mostrarErro(this.mensagemErro);
        return;
      }
      
      if (!this.recomendacoes || !this.recomendacoes.topPick) {
        this.mostrarErro('Não foi possível carregar as recomendações neste momento.');
        return;
      }
      
      console.log(`Renderizando interface para viagens ${this.tipoViagem.toUpperCase()}`);
      
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
      this.renderizarDestinosAlternativos(this.recomendacoes.alternativas || []);
      this.renderizarOpcaoSurpresa();
      
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
  
  // Renderizar imagem com créditos
  renderizarImagemComCreditos(imagem, fallbackText, classes = '', options = {}) {
    const { 
      isTopChoice = false, 
      isSurpriseDestination = false,
      showPontoTuristico = true
    } = options || {};
    
    if (!imagem) {
      return `
        <div class="bg-gray-200 ${classes} flex items-center justify-center">
          <span class="text-gray-400">${fallbackText}</span>
        </div>
      `;
    }
    
    // Tags de destaque
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
    
    // Tag de ponto turístico
    let pontoTuristicoTag = '';
    if (showPontoTuristico && imagem.pontoTuristico) {
      pontoTuristicoTag = `
        <div class="tourist-spot-label">
          ${imagem.pontoTuristico}
        </div>
      `;
    }

    const imageUrl = imagem.url || `https://via.placeholder.com/400x224?text=${encodeURIComponent(fallbackText)}`;
    const imageAlt = imagem.alt || fallbackText;
    const sourceUrl = imagem.sourceUrl || '#';
    
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
        
        <!-- Ícone de créditos -->
        <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="absolute bottom-2 right-2 bg-white bg-opacity-80 p-1.5 rounded-full z-10 hover:bg-opacity-100 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </a>
      </div>
    `;
  },
  
  // Renderizar mensagem da Tripinha adaptada ao tipo de viagem
  renderizarMensagemTripinha() {
    const container = document.getElementById('mensagem-tripinha');
    if (!container) return;
    
    const isRodoviario = this.tipoViagem === 'rodoviario';
    const mensagem = isRodoviario 
      ? "Farejei umas rotas incríveis de ônibus pra você! 🚌🐾 Achei destinos próximos e econômicos que vão ser uma delícia explorar. Dá uma olhada nas minhas sugestões e, se quiser uma surpresa pertinho de casa, clica em 'Me Surpreenda!' 💫"
      : "Dei uma boa farejada por aí e encontrei destinos incríveis pra sua próxima aventura! 🐾 Dá uma olhada na minha escolha TOP e em outras opções cheias de potencial! Quer sair do óbvio? Confia na Tripinha: clica em 'Me Surpreenda!' e deixa que eu te levo pra um lugar especial e inesperado! 💫🐶";
    
    container.innerHTML = `
      <div class="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-orange-100 border-2 border-orange-200">
            <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/60x60?text=🐶'">
          </div>
          <p class="text-gray-800 leading-relaxed">
            ${mensagem}
          </p>
        </div>
      </div>
    `;
  },
  
  // Renderizar informações de transporte (aeroporto ou rodoviária)
  renderizarInfoTransporte(destino) {
    const isRodoviario = this.tipoViagem === 'rodoviario';
    
    if (isRodoviario) {
  return `
    <!-- Informações simplificadas para rodoviário -->
    ${destino.distanciaRodoviaria || destino.tempoViagem ? `
      <div class="mt-2 bg-blue-50 p-3 rounded-lg">
        <div class="flex items-center mb-2">
          <span class="text-lg mr-2">🛣️</span>
          <span class="font-medium">Informações da Viagem</span>
        </div>
        ${destino.distanciaRodoviaria ? `
          <p class="text-sm"><strong>Distância:</strong> ${destino.distanciaRodoviaria}</p>
        ` : ''}
        ${destino.tempoViagem ? `
          <p class="text-sm"><strong>Tempo de viagem:</strong> ${destino.tempoViagem}</p>
        ` : ''}
      </div>
    ` : ''}
        
        ${destino.distanciaRodoviaria || destino.tempoViagem ? `
          <div class="mt-4 bg-blue-50 p-3 rounded-lg">
            <div class="flex items-center mb-2">
              <span class="text-lg mr-2">🛣️</span>
              <span class="font-medium">Informações da Viagem</span>
            </div>
            ${destino.distanciaRodoviaria ? `
              <p class="text-sm"><strong>Distância:</strong> ${destino.distanciaRodoviaria}</p>
            ` : ''}
            ${destino.tempoViagem ? `
              <p class="text-sm"><strong>Tempo estimado:</strong> ${destino.tempoViagem}</p>
            ` : ''}
          </div>
        ` : ''}
      `;
    } else {
      return `
        <div class="mt-2 bg-gray-50 p-3 rounded-lg">
          <div class="flex items-center mb-2">
            <span class="text-lg mr-2">✈️</span>
            <span class="font-medium">Aeroporto</span>
          </div>
          <p class="font-medium">${destino.aeroporto?.codigo || 'N/A'} - ${destino.aeroporto?.nome || `Aeroporto de ${destino.destino}`}</p>
        </div>
      `;
    }
  },
  
  // Renderizar destino destaque com sistema de abas adaptado
  renderizarDestinoDestaque(destino) {
    const container = document.getElementById('destino-destaque');
    if (!container) return;
    
    console.log('Renderizando destino destaque:', destino);
    
    // Imagem de cabeçalho
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
            ${destino.codigoPais || 'XX'}
          </span>
        </div>
      </div>
    `;
    
    // Sistema de abas adaptado
    let abasHtml = `
      <div class="flex border-b border-gray-200 overflow-x-auto">
        <button id="aba-visao-geral" class="botao-aba aba-ativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAba('visao-geral')">
          Visão Geral
        </button>
        <button id="aba-pontos-turisticos" class="botao-aba aba-inativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAba('pontos-turisticos')">
          Pontos Turísticos
        </button>
        ${destino.clima && destino.clima.temperatura ? `
          <button id="aba-clima" class="botao-aba aba-inativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAba('clima')">
            Clima
          </button>
        ` : ''}
        <button id="aba-comentarios" class="botao-aba aba-inativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAba('comentarios')">
          Comentários
        </button>
      </div>
    `;
    
    // Conteúdo da aba Visão Geral (adaptado)
    let visaoGeralHtml = `
      <div id="conteudo-visao-geral" class="conteudo-aba p-4">
        ${this.renderizarInfoTransporte(destino)}
        
        <div class="mt-4 bg-gray-50 p-3 rounded-lg">
          <div class="flex items-center mb-2">
            <span class="text-lg mr-2">🗓️</span>
            <span class="font-medium">Período da Viagem</span>
          </div>
          <p class="font-medium">${this.obterDatasViagem()}</p>
        </div>
        
        ${destino.porque ? `
          <div class="mt-4">
            <h4 class="font-medium mb-2">Por que visitar:</h4>
            <p class="text-gray-800">${destino.porque}</p>
          </div>
        ` : ''}
        
        ${destino.destaque ? `
          <div class="mt-4">
            <h4 class="font-medium mb-2">Destaque da experiência:</h4>
            <p class="text-gray-800">${destino.destaque}</p>
          </div>
        ` : ''}
      </div>
    `;
    
    // Conteúdo da aba Pontos Turísticos
    let pontosTuristicosHtml = `
      <div id="conteudo-pontos-turisticos" class="conteudo-aba p-4 hidden">
        ${destino.pontosTuristicos && destino.pontosTuristicos.length > 0 ? 
          destino.pontosTuristicos.map((ponto, idx) => {
            const imagem = this.encontrarImagemParaPontoTuristico(destino.imagens, ponto, idx);
            return `
              <div class="bg-white border border-gray-200 rounded-lg p-3 mb-3 shadow-sm">
                <div class="flex items-center">
                  <span class="flex items-center justify-center w-8 h-8 rounded-full mr-3 text-white font-bold" style="background-color: #00A3E0;">${idx + 1}</span>
                  <h5 class="font-medium">${ponto}</h5>
                </div>
                
                ${imagem ? `
                  <div class="mt-2 ml-11 rounded-lg overflow-hidden h-28">
                    ${this.renderizarImagemComCreditos(imagem, ponto, 'h-full w-full', { showPontoTuristico: false })}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('') : 
          '<p class="text-center text-gray-500 my-6">Informações sobre pontos turísticos não disponíveis</p>'
        }
      </div>
    `;
    
    // Conteúdo da aba Clima
    let climaHtml = '';
    if (destino.clima && destino.clima.temperatura) {
      climaHtml = `
        <div id="conteudo-clima" class="conteudo-aba p-4 hidden">
          <div class="text-center bg-blue-50 p-4 rounded-lg">
            <h4 class="font-medium text-lg mb-2">Clima durante sua viagem</h4>
            <div class="text-4xl mb-2">🌤️</div>
            
            ${destino.clima.estacao ? `
              <p class="text-lg font-bold">${destino.clima.estacao}</p>
            ` : ''}
            
            ${destino.clima.temperatura ? `
              <p class="text-sm text-gray-600 mt-2">Temperatura: ${destino.clima.temperatura}</p>
            ` : ''}
            
            ${destino.clima.condicoes ? `
              <p class="text-sm text-gray-600 mt-1">${destino.clima.condicoes}</p>
            ` : ''}
          </div>
          
          ${destino.clima.recomendacoes ? `
            <div class="mt-4 bg-white border border-gray-200 rounded-lg p-3">
              <h5 class="font-medium mb-2">Recomendações:</h5>
              ${Array.isArray(destino.clima.recomendacoes) ? 
                `<ul class="list-disc pl-5 text-sm text-gray-700 space-y-1">
                  ${destino.clima.recomendacoes.map(rec => `<li>${rec}</li>`).join('')}
                </ul>` :
                `<p class="text-sm text-gray-700">${destino.clima.recomendacoes}</p>`
              }
            </div>
          ` : ''}
          
          <div class="mt-4 bg-green-50 p-3 rounded-lg border border-green-200">
            <div class="flex items-center">
              <span class="text-lg mr-2">🤖</span>
              <span class="text-sm font-medium text-green-800">Informações climáticas fornecidas pela IA especializada</span>
            </div>
          </div>
        </div>
      `;
    }
    
    // Conteúdo da aba Comentários
    let comentariosHtml = `
      <div id="conteudo-comentarios" class="conteudo-aba p-4 hidden">
        ${destino.comentario ? `
          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-orange-100 border-2 border-orange-200">
                <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/60x60?text=🐶'">
              </div>
              <div>
                <p class="font-medium text-sm mb-1">Minha experiência em ${destino.destino}:</p>
                <p class="italic">"${destino.comentario}"</p>
              </div>
            </div>
          </div>
        ` : ''}
        
        ${destino.eventos && destino.eventos.length > 0 ? `
          <div class="mt-4 bg-yellow-50 p-4 rounded-lg">
            <h4 class="font-medium mb-2">Eventos especiais durante sua viagem:</h4>
            <ul class="list-disc pl-5 text-sm text-gray-700 space-y-1">
              ${destino.eventos.map(evento => `<li>${evento}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
    
    // Botão de seleção adaptado
    const isRodoviario = this.tipoViagem === 'rodoviario';
    let botaoSelecaoHtml = `
      <div class="p-4 border-t border-gray-200">
        <button class="btn-selecionar-destino w-full font-bold py-3 px-4 rounded-lg text-white transition-colors duration-200 hover:opacity-90" 
          style="background-color: #E87722;" 
          data-destino="${destino.destino}">
          ${isRodoviario ? 'Escolher Esta Viagem de Ônibus!' : 'Escolher Este Destino!'}
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
        ${transporteHtml}
        ${comentariosHtml}
        ${botaoSelecaoHtml}
      </div>
    `;
  },
  
  // Renderizar destinos alternativos adaptado
  renderizarDestinosAlternativos(destinos) {
    const container = document.getElementById('destinos-alternativos');
    if (!container || !destinos || destinos.length === 0) {
      if (container) {
        const isRodoviario = this.tipoViagem === 'rodoviario';
        container.innerHTML = `<p class="text-center text-gray-500 my-6">Nenhum ${isRodoviario ? 'destino rodoviário' : 'destino'} alternativo disponível.</p>`;
      }
      return;
    }
    
    const isRodoviario = this.tipoViagem === 'rodoviario';
    container.innerHTML = `<h3 class="font-bold text-lg mt-4 mb-3">${isRodoviario ? 'Mais Destinos de Ônibus' : 'Mais Destinos Incríveis'}</h3>`;
    
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid grid-cols-2 gap-3';
    container.appendChild(gridContainer);
    
    const destinosLimitados = destinos.slice(0, 4);
    destinosLimitados.forEach(destino => {
      const elementoDestino = document.createElement('div');
      elementoDestino.className = 'card-destino border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 bg-white';
      
      // Informações de transporte adaptadas
      let infoTransporte = '';
      if (isRodoviario) {
        if (destino.distanciaRodoviaria) {
          infoTransporte += `
            <div class="flex justify-between items-center mt-1">
              <span class="text-sm font-medium">
                <span class="mr-1">🛣️</span>
                Distância
              </span>
              <span class="text-xs text-gray-500">${destino.distanciaRodoviaria}</span>
            </div>
          `;
        }
        if (destino.tempoViagem) {
          infoTransporte += `
            <div class="flex justify-between items-center mt-1">
              <span class="text-sm font-medium">
                <span class="mr-1">⏰</span>
                Tempo
              </span>
              <span class="text-xs text-gray-500">${destino.tempoViagem}</span>
            </div>
          `;
        }
      } else {
        if (destino.aeroporto && destino.aeroporto.codigo) {
          infoTransporte = `
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium">
                <span class="mr-1">✈️</span>
                Aeroporto
              </span>
              <span class="text-xs text-gray-500">${destino.aeroporto.codigo}</span>
            </div>
          `;
        }
      }
      
      elementoDestino.innerHTML = `
        <div class="relative">
          ${this.renderizarImagemComCreditos(
            destino.imagens && destino.imagens.length > 0 ? destino.imagens[0] : null,
            destino.destino,
            'h-32'
          )}
        </div>
        <div class="p-3">
          <div class="flex justify-between items-start">
            <h3 class="font-bold text-sm">${destino.destino}</h3>
            <span class="text-xs font-medium px-1 py-0.5 rounded" style="background-color: #E0E0E0;">
              ${destino.codigoPais || 'XX'}
            </span>
          </div>
          <p class="text-xs text-gray-600 mb-2">${destino.pais}</p>
          
          ${infoTransporte}
          
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
          
          ${destino.clima && destino.clima.temperatura ? `
            <div class="mt-2">
              <div class="flex items-center">
                <span class="text-xs mr-1">🌡️</span>
                <span class="text-xs text-gray-700">Clima:</span>
              </div>
              <span class="bg-green-50 text-green-800 text-xs px-2 py-0.5 rounded-full inline-block max-w-full truncate">
                ${destino.clima.temperatura}
              </span>
            </div>
          ` : ''}
          
          <button class="btn-selecionar-destino w-full mt-3 py-1.5 px-2 rounded text-white text-sm font-medium transition-colors hover:opacity-90" 
            style="background-color: #E87722;"
            data-destino="${destino.destino}">
            ${isRodoviario ? 'Escolher Ônibus' : 'Escolher Destino'}
          </button>
        </div>
      `;
      
      gridContainer.appendChild(elementoDestino);
    });
  },
  
  // Renderizar opção "Me Surpreenda" adaptada
  renderizarOpcaoSurpresa() {
    const container = document.getElementById('opcao-surpresa');
    if (!container) return;
    
    if (!this.recomendacoes.surpresa) {
      container.innerHTML = '<p class="text-center text-gray-500 my-6">Opção surpresa não disponível.</p>';
      return;
    }
    
    const isRodoviario = this.tipoViagem === 'rodoviario';
    const mensagem = isRodoviario 
      ? "Ainda não decidiu? Sem problemas! Clique em 'Me Surpreenda!' e eu escolho um destino de ônibus especial baseado nas suas vibes de viagem! 🚌🐾"
      : "Ainda não decidiu? Sem problemas! Clique em 'Me Surpreenda!' e eu escolho um lugar baseado nas suas vibes de viagem! 🐾";
    
    container.innerHTML = `
      <div class="p-4 rounded-lg mt-2 text-white" style="background-color: #E87722;">
        <p class="font-bold text-lg text-center">${mensagem}</p>
        <button id="btn-surpresa" class="w-full font-bold py-2.5 px-4 rounded mt-3 transition-colors duration-200 hover:bg-blue-600" style="background-color: #00A3E0; color: white;">
          Me Surpreenda! 🎲
        </button>
      </div>
    `;
  },
  
  // Mostrar destino surpresa adaptado
  mostrarDestinoSurpresa() {
    if (!this.recomendacoes || !this.recomendacoes.surpresa) {
      console.error('Destino surpresa não disponível');
      return;
    }
    
    const destino = this.recomendacoes.surpresa;
    const isRodoviario = this.tipoViagem === 'rodoviario';
    console.log(`Mostrando destino surpresa ${isRodoviario ? 'rodoviário' : 'aéreo'}:`, destino);
    
    const modalContainer = document.createElement('div');
    modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-start z-50 modal-surpresa-container';
    modalContainer.id = 'modal-surpresa';
    modalContainer.style.overflowY = 'auto';
    modalContainer.style.padding = '1rem 0';
    
    // Abas adaptadas para tipo de viagem
    let abasTransporteHtml = '';
    
    let conteudoTransporteHtml = '';
    
    modalContainer.innerHTML = `
      <div class="bg-white rounded-lg w-full max-w-md relative mx-auto my-4 transform transition-transform duration-500 modal-surpresa-content">
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
          
          <button class="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center text-white bg-black bg-opacity-60 rounded-full hover:bg-opacity-80 transition-all" 
                  onclick="document.getElementById('modal-surpresa').remove()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Título do destino -->
        <div class="p-4 bg-white">
          <div class="flex justify-between items-center">
            <h3 class="text-xl font-bold">${destino.destino}, ${destino.pais}</h3>
            <span class="text-xs font-medium px-2 py-1 rounded-lg" style="background-color: #E0E0E0;">
              ${destino.codigoPais || 'XX'}
            </span>
          </div>
        </div>
        
        <!-- Sistema de abas adaptado -->
        <div class="flex border-b border-gray-200 overflow-x-auto">
          <button id="aba-surpresa-info" class="botao-aba aba-ativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAbaSurpresa('info')">
            Visão Geral
          </button>
          <button id="aba-surpresa-pontos" class="botao-aba aba-inativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAbaSurpresa('pontos')">
            Pontos Turísticos
          </button>
          ${destino.clima && destino.clima.temperatura ? `
            <button id="aba-surpresa-clima" class="botao-aba aba-inativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAbaSurpresa('clima')">
              Clima
            </button>
          ` : ''}
          ${abasTransporteHtml}
          <button id="aba-surpresa-comentarios" class="botao-aba aba-inativa px-4 py-2 text-sm font-medium" onclick="BENETRIP_DESTINOS.trocarAbaSurpresa('comentarios')">
            Comentários
          </button>
        </div>
        
        <!-- Conteúdo da aba Informações -->
        <div id="conteudo-surpresa-info" class="conteudo-aba-surpresa p-4">
          ${this.renderizarInfoTransporte(destino)}
          
          <div class="mt-4 bg-gray-50 p-3 rounded-lg">
            <div class="flex items-center mb-2">
              <span class="text-lg mr-2">🗓️</span>
              <span class="font-medium">Período da Viagem</span>
            </div>
            <p class="font-medium">${this.obterDatasViagem()}</p>
          </div>
          
          ${destino.porque ? `
            <div class="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
              <div class="flex items-start">
                <span class="text-lg mr-2">🎁</span>
                <div>
                  <h4 class="font-medium mb-1">Por que visitar:</h4>
                  <p class="text-gray-800 text-sm">${destino.porque}</p>
                </div>
              </div>
            </div>
          ` : ''}
          
          ${destino.destaque ? `
            <div class="mt-4">
              <h4 class="font-medium mb-2">Destaque da experiência:</h4>
              <p class="text-gray-800">${destino.destaque}</p>
            </div>
          ` : ''}
        </div>
        
        <!-- Conteúdo da aba Pontos Turísticos -->
        <div id="conteudo-surpresa-pontos" class="conteudo-aba-surpresa p-4 hidden">
          ${destino.pontosTuristicos && destino.pontosTuristicos.length > 0 ? 
            destino.pontosTuristicos.map((ponto, idx) => {
              const imagem = this.encontrarImagemParaPontoTuristico(destino.imagens, ponto, idx);
              return `
                <div class="bg-white border border-gray-200 rounded-lg p-3 mb-3 shadow-sm">
                  <div class="flex items-center">
                    <span class="flex items-center justify-center w-8 h-8 rounded-full mr-3 text-white font-bold" style="background-color: #00A3E0;">${idx + 1}</span>
                    <h5 class="font-medium">${ponto}</h5>
                  </div>
                  
                  ${imagem ? `
                    <div class="mt-2 ml-11 rounded-lg overflow-hidden h-28">
                      ${this.renderizarImagemComCreditos(imagem, ponto, 'h-full w-full', { showPontoTuristico: false })}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('') : 
            '<p class="text-center text-gray-500 my-6">Informações sobre pontos turísticos não disponíveis</p>'
          }
        </div>
        
        ${destino.clima && destino.clima.temperatura ? `
          <!-- Conteúdo da aba Clima -->
          <div id="conteudo-surpresa-clima" class="conteudo-aba-surpresa p-4 hidden">
            <div class="text-center bg-blue-50 p-4 rounded-lg">
              <h4 class="font-medium text-lg mb-2">Clima durante sua viagem</h4>
              <div class="text-4xl mb-2">🌤️</div>
              
              ${destino.clima.estacao ? `
                <p class="text-lg font-bold">${destino.clima.estacao}</p>
              ` : ''}
              
              ${destino.clima.temperatura ? `
                <p class="text-sm text-gray-600 mt-2">Temperatura: ${destino.clima.temperatura}</p>
              ` : ''}
              
              ${destino.clima.condicoes ? `
                <p class="text-sm text-gray-600 mt-1">${destino.clima.condicoes}</p>
              ` : ''}
            </div>
            
            ${destino.clima.recomendacoes ? `
              <div class="mt-4 bg-white border border-gray-200 rounded-lg p-3">
                <h5 class="font-medium mb-2">Recomendações:</h5>
                ${Array.isArray(destino.clima.recomendacoes) ? 
                  `<ul class="list-disc pl-5 text-sm text-gray-700 space-y-1">
                    ${destino.clima.recomendacoes.map(rec => `<li>${rec}</li>`).join('')}
                  </ul>` :
                  `<p class="text-sm text-gray-700">${destino.clima.recomendacoes}</p>`
                }
              </div>
            ` : ''}
            
            <div class="mt-4 bg-green-50 p-3 rounded-lg border border-green-200">
              <div class="flex items-center">
                <span class="text-lg mr-2">🤖</span>
                <span class="text-sm font-medium text-green-800">Informações climáticas fornecidas pela IA especializada</span>
              </div>
            </div>
          </div>
        ` : ''}
        
        ${conteudoTransporteHtml}
        
        <!-- Conteúdo da aba Comentários -->
        <div id="conteudo-surpresa-comentarios" class="conteudo-aba-surpresa p-4 hidden">
          ${destino.comentario ? `
            <div class="bg-gray-50 p-4 rounded-lg">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-orange-100 border-2 border-orange-200">
                  <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/60x60?text=🐶'">
                </div>
                <div>
                  <p class="font-medium text-sm mb-1">Minha experiência em ${destino.destino}:</p>
                  <p class="italic">"${destino.comentario}"</p>
                </div>
              </div>
            </div>
          ` : `
            <div class="bg-gray-50 p-4 rounded-lg text-center">
              <div class="w-10 h-10 rounded-full overflow-hidden mx-auto mb-2 bg-orange-100 border-2 border-orange-200">
                <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/60x60?text=🐶'">
              </div>
              <p class="text-gray-500">A Tripinha ainda não visitou este destino, mas está animada para descobrir junto com você! 🐾✨</p>
            </div>
          `}
          
          ${destino.eventos && destino.eventos.length > 0 ? `
            <div class="mt-4 bg-yellow-50 p-4 rounded-lg">
              <h4 class="font-medium mb-2">Eventos especiais durante sua viagem:</h4>
              <ul class="list-disc pl-5 text-sm text-gray-700 space-y-1">
                ${destino.eventos.map(evento => `<li>${evento}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
        
        <!-- Botões de ação -->
        <div class="p-4 border-t border-gray-200">
          <button class="btn-selecionar-destino w-full font-bold py-3 px-4 rounded-lg text-white transition-colors duration-200 hover:opacity-90 mb-2" 
            style="background-color: #00A3E0;" 
            data-destino="${destino.destino}"
            onclick="document.getElementById('modal-surpresa').remove()">
            ${isRodoviario ? 'Quero Esta Viagem de Ônibus!' : 'Quero Este Destino Surpresa!'}
          </button>
          
          <button class="w-full font-medium py-2.5 px-4 rounded-lg border border-gray-300 transition-colors duration-200 hover:bg-gray-100" 
            onclick="document.getElementById('modal-surpresa').remove()">
            Voltar às Sugestões
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modalContainer);
    
    // Fechar modal ao clicar fora
    modalContainer.addEventListener('click', function(e) {
      if (e.target === this) {
        this.remove();
      }
    });
  },
  
  // Selecionar um destino (adaptado para rodoviário/aéreo)
  selecionarDestino(nomeDestino) {
    console.log(`Destino selecionado: ${nomeDestino}`);
    let destinoSelecionado = null;
    
    // Encontrar o destino pelo nome
    if (this.recomendacoes.topPick.destino === nomeDestino) {
        destinoSelecionado = this.recomendacoes.topPick;
    } else if (this.recomendacoes.surpresa && this.recomendacoes.surpresa.destino === nomeDestino) {
        destinoSelecionado = this.recomendacoes.surpresa;
    } else {
        destinoSelecionado = this.recomendacoes.alternativas?.find(d => d.destino === nomeDestino);
    }
    
    if (!destinoSelecionado) {
        console.error(`Destino não encontrado: ${nomeDestino}`);
        alert('Desculpe, não foi possível encontrar informações sobre este destino. Por favor, tente outro.');
        return;
    }
    
    // Padronizar os dados do destino baseado no tipo de viagem
    const isRodoviario = this.tipoViagem === 'rodoviario';
    const destinoPadronizado = {
        ...destinoSelecionado,
        codigo_iata: isRodoviario ? null : (destinoSelecionado.aeroporto?.codigo || 'XXX'),
        terminal_rodoviario: isRodoviario ? (destinoSelecionado.rodoviaria?.nome || `Terminal de ${destinoSelecionado.destino}`) : null,
        tipo_viagem: this.tipoViagem
    };
    
    // Salvar destino selecionado
    localStorage.setItem('benetrip_destino_selecionado', JSON.stringify(destinoPadronizado));
    
    // Atualizar os dados do usuário
    try {
        const dadosUsuario = JSON.parse(localStorage.getItem('benetrip_user_data') || '{}');
        dadosUsuario.fluxo = 'destino_desconhecido';
        
        if (!dadosUsuario.respostas) dadosUsuario.respostas = {};
        dadosUsuario.respostas.destino_escolhido = {
            name: destinoPadronizado.destino,
            pais: destinoPadronizado.pais,
            code: destinoPadronizado.codigo_iata,
            tipo_viagem: this.tipoViagem
        };
        
        localStorage.setItem('benetrip_user_data', JSON.stringify(dadosUsuario));
    } catch (e) {
        console.warn('Erro ao atualizar dados do usuário:', e);
    }
    
    this.mostrarConfirmacaoSelecao(destinoPadronizado);
  },
  
  // Encontrar imagem para ponto turístico
  encontrarImagemParaPontoTuristico(imagens, pontoTuristico, indice = 0) {
    if (!imagens || imagens.length === 0) return null;
    
    // Buscar imagem que corresponde ao ponto turístico
    const imagemExata = imagens.find(img => 
      img.pontoTuristico && 
      img.pontoTuristico.toLowerCase() === pontoTuristico.toLowerCase()
    );
    if (imagemExata) return imagemExata;
    
    // Buscar por nome similar
    const imagemSimilar = imagens.find(img => 
      img.pontoTuristico && 
      img.pontoTuristico.toLowerCase().includes(pontoTuristico.toLowerCase())
    );
    if (imagemSimilar) return imagemSimilar;
    
    // Usar imagem por índice
    const indiceImagem = indice % imagens.length;
    return {
      ...imagens[indiceImagem],
      pontoTuristico: pontoTuristico
    };
  },
  
  // ========== FUNCIONALIDADE: CONSTRUIR URL WHITELABEL (ADAPTADA) ==========
  
  /**
   * Constrói a URL da whitelabel Benetrip com os parâmetros de busca
   * Para AÉREO: https://voos.benetrip.com.br/?flightSearch=SAO1208RIO22081
   * Para RODOVIÁRIO: https://onibus.benetrip.com.br/?busSearch=SAO1208RIO22081
   */
  construirURLWhitelabel(destinoSelecionado) {
    try {
      const isRodoviario = this.tipoViagem === 'rodoviario';
      console.log(`🔧 Construindo URL da whitelabel ${isRodoviario ? 'RODOVIÁRIA' : 'AÉREA'}...`);
      console.log('📍 Destino selecionado:', destinoSelecionado);
      console.log('👤 Dados do usuário:', this.dadosUsuario);
      
      // Obter dados necessários
      const dadosUsuario = this.dadosUsuario;
      const respostas = dadosUsuario?.respostas;
      
      if (!respostas) {
        throw new Error('Dados do usuário não encontrados');
      }
      
      // ===== ORIGEM =====
      let codigoOrigem = 'SAO'; // Padrão São Paulo
      
      if (respostas.cidade_partida) {
        const cidadePartida = respostas.cidade_partida;
        
        if (typeof cidadePartida === 'string') {
          // Extrair código IATA se estiver no formato "Cidade (XXX)"
          const match = cidadePartida.match(/\(([A-Z]{3})\)/);
          if (match && match[1]) {
            codigoOrigem = match[1];
          } else {
            // Buscar no mapeamento por nome da cidade
            const cidadeLower = cidadePartida.toLowerCase();
            const mapeamentoCidades = {
              'são paulo': 'SAO', 'sao paulo': 'SAO',
              'rio de janeiro': 'RIO', 
              'brasilia': 'BSB', 'brasília': 'BSB',
              'salvador': 'SSA', 'belo horizonte': 'CNF',
              'recife': 'REC', 'fortaleza': 'FOR',
              'porto alegre': 'POA', 'curitiba': 'CWB'
            };
            codigoOrigem = mapeamentoCidades[cidadeLower] || 'SAO';
          }
        } else if (typeof cidadePartida === 'object' && cidadePartida.code) {
          codigoOrigem = cidadePartida.code;
        }
      }
      
      // ===== DESTINO =====
      let codigoDestino;
      
      if (isRodoviario) {
        // Para rodoviário, usar código da cidade ou criar um baseado no nome
        codigoDestino = destinoSelecionado.codigoPais || 
                       destinoSelecionado.destino.substring(0, 3).toUpperCase();
      } else {
        // Para aéreo, usar código IATA do aeroporto
        codigoDestino = destinoSelecionado.codigo_iata || 
                       destinoSelecionado.aeroporto?.codigo || 
                       'XXX';
      }
      
      // ===== DATAS =====
      const datas = respostas.datas;
      if (!datas || !datas.dataIda) {
        throw new Error('Datas de viagem não encontradas');
      }
      
      // Processar data de ida (formato YYYY-MM-DD)
      const [anoIda, mesIda, diaIda] = datas.dataIda.split('-');
      const diaIdaFormatado = diaIda.padStart(2, '0');
      const mesIdaFormatado = mesIda.padStart(2, '0');
      
      // Processar data de volta (se existir)
      let diaVoltaFormatado = diaIdaFormatado;
      let mesVoltaFormatado = mesIdaFormatado;
      
      if (datas.dataVolta) {
        const [anoVolta, mesVolta, diaVolta] = datas.dataVolta.split('-');
        diaVoltaFormatado = diaVolta.padStart(2, '0');
        mesVoltaFormatado = mesVolta.padStart(2, '0');
      }
      
      // ===== QUANTIDADE DE PASSAGEIROS =====
      let quantidadePassageiros = 1;
      
      // Verificar diferentes campos onde a quantidade pode estar
      if (respostas.passageiros?.adultos) {
        quantidadePassageiros = parseInt(respostas.passageiros.adultos) || 1;
      } else if (respostas.quantidade_familia) {
        quantidadePassageiros = parseInt(respostas.quantidade_familia) || 1;
      } else if (respostas.quantidade_amigos) {
        quantidadePassageiros = parseInt(respostas.quantidade_amigos) || 1;
      } else if (respostas.companhia !== undefined) {
        // Mapear tipo de companhia para quantidade
        const companhia = parseInt(respostas.companhia);
        switch (companhia) {
          case 0: quantidadePassageiros = 1; break; // Sozinho
          case 1: quantidadePassageiros = 2; break; // Casal
          case 2: quantidadePassageiros = 3; break; // Família (estimativa)
          case 3: quantidadePassageiros = 4; break; // Amigos (estimativa)
          default: quantidadePassageiros = 1;
        }
      }
      
      // ===== CONSTRUIR PARÂMETRO DE BUSCA =====
      const searchParam = 
        `${codigoOrigem}${diaIdaFormatado}${mesIdaFormatado}${codigoDestino}${diaVoltaFormatado}${mesVoltaFormatado}${quantidadePassageiros}`;
      
      // ===== URL FINAL (DIFERENTE PARA CADA TIPO) =====
      let urlWhitelabel;
      
      if (isRodoviario) {
        // Para viagens rodoviárias, usar domínio de ônibus
        urlWhitelabel = `https://onibus.benetrip.com.br/?busSearch=${searchParam}`;
      } else {
        // Para viagens aéreas, usar domínio de voos
        urlWhitelabel = `https://voos.benetrip.com.br/?flightSearch=${searchParam}`;
      }
      
      console.log(`✅ URL ${isRodoviario ? 'RODOVIÁRIA' : 'AÉREA'} construída com sucesso:`);
      console.log(`🔗 ${urlWhitelabel}`);
      console.log('📊 Parâmetros utilizados:', {
        tipoViagem: this.tipoViagem,
        origem: codigoOrigem,
        destino: codigoDestino,
        dataIda: `${diaIdaFormatado}/${mesIdaFormatado}`,
        dataVolta: `${diaVoltaFormatado}/${mesVoltaFormatado}`,
        passageiros: quantidadePassageiros,
        parametroCompleto: searchParam
      });
      
      return urlWhitelabel;
      
    } catch (erro) {
      console.error('❌ Erro ao construir URL da whitelabel:', erro);
      // URL de fallback baseada no tipo de viagem
      const isRodoviario = this.tipoViagem === 'rodoviario';
      return isRodoviario ? 'https://onibus.benetrip.com.br/' : 'https://voos.benetrip.com.br/';
    }
  },
  
  // Mostrar confirmação de seleção (adaptado para ambos os tipos)
  mostrarConfirmacaoSelecao(destino) {
    const isRodoviario = this.tipoViagem === 'rodoviario';
    
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
              <p class="font-bold">
                ${isRodoviario 
                  ? `Ótima escolha, Triper! 🚌🐾 ${destino.destino} é perfeito para uma viagem de ônibus! Tem certeza que quer essa aventura rodoviária?` 
                  : `Ótima escolha, Triper! 🐾 ${destino.destino} é incrível! Tem certeza que este é o destino certo para sua aventura?`
                }
              </p>
              <div class="mt-3">
                <label class="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" id="confirmar-selecao" class="form-checkbox h-5 w-5 rounded" style="color: #E87722;">
                  <span>Sim, tenho certeza!</span>
                </label>
              </div>
              <p class="mt-3 text-sm">
                Você será direcionado para a Benetrip onde poderá consultar preços reais de ${isRodoviario ? 'passagens de ônibus' : 'passagens aéreas'} e finalizar sua reserva com nossos parceiros confiáveis.
              </p>
            </div>
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button id="btn-cancelar" class="flex-1 py-2 px-4 border border-gray-300 rounded hover:bg-gray-100 transition-colors">
            Voltar
          </button>
          <button id="btn-confirmar" class="flex-1 py-2 px-4 text-white rounded transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" style="background-color: #E87722;" disabled>
            ${isRodoviario ? 'Buscar Ônibus 🚌' : 'Buscar Voos ✈️'}
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
    
    // Redirecionar para whitelabel adaptada
    btnConfirmar.addEventListener('click', () => {
      console.log(`🚀 Redirecionando para a whitelabel Benetrip ${isRodoviario ? 'RODOVIÁRIA' : 'AÉREA'}...`);
      
      try {
        // Construir URL da whitelabel (adaptada)
        const urlWhitelabel = this.construirURLWhitelabel(destino);
        
        // Mostrar toast de confirmação
        this.exibirToast(`Redirecionando para ${isRodoviario ? 'busca de ônibus' : 'busca de voos'}...`, 'info');
        
        // Aguardar um pouco e redirecionar
        setTimeout(() => {
          window.open(urlWhitelabel, '_blank');
          
          // Fechar o modal
          document.getElementById('modal-confirmacao').remove();
          
          // Mostrar mensagem de sucesso
          this.exibirToast(`Boa viagem! ${isRodoviario ? '🚌' : '🛫'}`, 'success');
        }, 1000);
        
      } catch (erro) {
        console.error('❌ Erro ao redirecionar:', erro);
        this.exibirToast('Erro ao redirecionar. Tente novamente.', 'error');
      }
    });
    
    // Fechar modal ao clicar fora
    modalContainer.addEventListener('click', function(e) {
      if (e.target === this) {
        this.remove();
      }
    });
  },
  
  // ========== UTILITÁRIOS AUXILIARES ==========
  
  /**
   * Exibe uma mensagem toast
   */
  exibirToast(mensagem, tipo = 'info') {
    // Criar container se não existir
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        pointer-events: none;
      `;
      document.body.appendChild(toastContainer);
    }
    
    // Criar toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.style.cssText = `
      background: ${tipo === 'success' ? '#10B981' : tipo === 'error' ? '#EF4444' : tipo === 'warning' ? '#F59E0B' : '#3B82F6'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 8px;
      font-weight: 500;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      pointer-events: auto;
    `;
    toast.textContent = mensagem;
    
    toastContainer.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Remover após tempo
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
  
  // Obter período de datas da viagem
  obterDatasViagem() {
    try {
      const dadosUsuario = this.dadosUsuario;
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
    return "Datas não informadas";
  },
  
  // Aplicar estilos modernos
  aplicarEstilosModernos() {
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
      
      /* Estilo para tags de pontos turísticos */
      .tourist-spot-label {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
        max-width: calc(100% - 16px);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      /* Toast container e estilos */
      #toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        pointer-events: none;
      }
      
      .toast {
        pointer-events: auto;
        margin-bottom: 8px;
        border-radius: 8px;
        padding: 12px 20px;
        color: white;
        font-weight: 500;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
      }
      
      .toast-success { background-color: #10B981; }
      .toast-error { background-color: #EF4444; }
      .toast-warning { background-color: #F59E0B; }
      .toast-info { background-color: #3B82F6; }
      
      /* Indicadores visuais para tipo de viagem */
      .rodoviario-indicator {
        background: linear-gradient(45deg, #22C55E, #16A34A);
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: bold;
      }
      
      .aereo-indicator {
        background: linear-gradient(45deg, #3B82F6, #2563EB);
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: bold;
      }
    `;
    
    document.head.appendChild(estiloElement);
  }
};

// Inicializar o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  // Certificar que os serviços dependentes estão inicializados
  if (!window.BENETRIP_IMAGES || !window.BENETRIP_IMAGES.isInitialized()) {
    console.log('Inicializando serviço de imagens');
    if (window.BENETRIP_IMAGES && typeof window.BENETRIP_IMAGES.init === 'function') {
      window.BENETRIP_IMAGES.init();
    }
  }
  
  BENETRIP_DESTINOS.init();
});
