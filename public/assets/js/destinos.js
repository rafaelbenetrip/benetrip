/**
 * BENETRIP - Visualização de Destinos Recomendados
 * Controla a exibição e interação dos destinos recomendados pela IA
 * Versão 2.1 - Integração com API Amadeus para preços reais e melhoria na montagem da query de imagens
 */

// Módulo de Destinos do Benetrip
const BENETRIP_DESTINOS = {
  // Dados e estado
  recomendacoes: null,
  dadosUsuario: null,
  estaCarregando: true,
  temErro: false,
  mensagemErro: '',
  
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
        this.selecionarDestino(destino);
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
  
  // Buscar imagens para um destino – melhoria na montagem da URL
  async buscarImagensDestino(destino) {
    try {
      if (!destino) return null;
      
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
      console.log('URL construída:', url);
      
      const resposta = await fetch(url);
      const dados = await resposta.json();
      
      if (dados && dados.images && dados.images.length > 0) {
        console.log(`Encontradas ${dados.images.length} imagens para ${destino.destino}`);
        return dados.images;
      }
      
      console.warn(`Nenhuma imagem encontrada para ${destino.destino}`);
      return null;
    } catch (erro) {
      console.error(`Erro ao buscar imagens para ${destino.destino}:`, erro);
      return null;
    }
  },
  
  // Buscar imagens para todos os destinos
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
          
          // Pequena pausa para não sobrecarregar a API
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
  
  // Renderizar mensagem da Tripinha
  renderizarMensagemTripinha() {
    const container = document.getElementById('mensagem-tripinha');
    if (!container) return;
    
    container.innerHTML = `
      <div class="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-start gap-3">
          <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-orange-100">
            <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/60x60?text=🐶'">
          </div>
          <p class="text-gray-800 leading-relaxed">
            Eu farejei por aí e encontrei alguns destinos incríveis para sua aventura! 🐾 Veja minha escolha top — e mais algumas opções se você quiser explorar! Se estiver com vontade de se arriscar, clica em 'Me Surpreenda!' e eu escolho uma joia escondida pra você! 🐕 ✨
          </p>
        </div>
      </div>
    `;
  },
  
  // Método auxiliar para renderizar imagem com créditos
  renderizarImagemComCreditos(imagem, fallbackText, classes = '') {
    if (!imagem) {
      return `
        <div class="bg-gray-200 ${classes}">
          <img src="https://via.placeholder.com/400x224?text=${encodeURIComponent(fallbackText)}" alt="${fallbackText}" class="w-full h-full object-cover">
        </div>
      `;
    }
    
    return `
      <div class="image-container bg-gray-200 ${classes} relative">
        <a href="${imagem.sourceUrl || '#'}" target="_blank" rel="noopener noreferrer" class="image-link block h-full">
          <img src="${imagem.url}" alt="${imagem.alt || fallbackText}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='https://via.placeholder.com/400x224?text=${encodeURIComponent(fallbackText)}'">
          <div class="zoom-icon absolute top-2 right-2 bg-white bg-opacity-70 p-1 rounded-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
        </a>
        <div class="image-credit absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 truncate">
          Foto por <a href="${imagem.photographerUrl || '#'}" target="_blank" rel="noopener noreferrer" class="underline">${imagem.photographer || 'Desconhecido'}</a>
        </div>
      </div>
    `;
  },
  
  // Renderizar destino destaque (topPick)
  renderizarDestinoDestaque(destino) {
    const container = document.getElementById('destino-destaque');
    if (!container) return;
    
    console.log('Renderizando destino destaque:', destino);
    const temImagens = destino.imagens && destino.imagens.length > 0;
    const precoReal = destino.detalhesVoo ? true : false;
    const precoClasse = precoReal ? 'text-green-700 font-semibold' : '';
    const precoIcone = precoReal ? '🔍 ' : '';
    
    container.innerHTML = `
      <div class="border border-gray-200 rounded-lg overflow-hidden shadow-md">
        <div class="relative">
          <div class="absolute top-0 left-0 py-1 px-3 z-10 font-bold text-white" style="background-color: #E87722;">
            Escolha Top da Tripinha!
          </div>
          <div class="grid grid-cols-2 gap-1">
            ${this.renderizarImagemComCreditos(
              destino.imagens && destino.imagens.length > 0 ? destino.imagens[0] : null,
              destino.destino,
              'h-36'
            )}
            ${this.renderizarImagemComCreditos(
              destino.imagens && destino.imagens.length > 1 ? destino.imagens[1] : null,
              destino.pais,
              'h-36'
            )}
          </div>
        </div>
        <div class="p-4">
          <div class="flex justify-between items-start">
            <h3 class="text-xl font-bold">${destino.destino}, ${destino.pais}</h3>
            <span class="text-xs font-medium px-1 py-0.5 rounded" style="background-color: #E0E0E0;">
              ${destino.codigoPais}
            </span>
          </div>
          <div class="mt-3 space-y-1 text-sm">
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center">✈️</span>
              <span class="font-medium">Preço de Voo:</span>
              <span class="ml-1 ${precoClasse}">${precoIcone}R$ ${destino.preco.voo} (ida e volta)</span>
            </p>
            ${this.prepararInformacoesVoo(destino)}
            ${this.prepararInformacaoAeroporto(destino)}
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center">🏨</span>
              <span class="font-medium">Hotel:</span>
              <span class="ml-1">R$ ${destino.preco.hotel}/noite</span>
            </p>
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center">🗓️</span>
              <span class="font-medium">Duração da Viagem:</span>
              <span class="ml-1">${this.obterDatasViagem()}</span>
            </p>
            <p class="flex items-start mt-2">
              <span class="mr-2 w-5 text-center flex-shrink-0">🌆</span>
              <span><span class="font-medium">Por que ir?:</span> <span class="ml-1">${destino.porque}</span></span>
            </p>
            <p class="flex items-start">
              <span class="mr-2 w-5 text-center flex-shrink-0">⭐</span>
              <span><span class="font-medium">Destaque da Experiência:</span> <span class="ml-1">${destino.destaque}</span></span>
            </p>
            <div class="flex flex-wrap gap-1 mt-2">
              ${destino.pontosTuristicos ? destino.pontosTuristicos.map(ponto => `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">${ponto}</span>`).join('') : ''}
            </div>
          </div>
          <div class="mt-3 text-sm italic p-3 rounded" style="background-color: rgba(0, 163, 224, 0.1);">
            <p class="flex items-start">
              <span class="mr-2 flex-shrink-0">💬</span>
              <span>"${destino.comentario}"</span>
            </p>
          </div>
          <button class="w-full font-bold py-2.5 px-4 rounded mt-4 text-white transition-colors duration-200 hover:opacity-90" style="background-color: #E87722;" data-destino="${destino.destino}" onclick="BENETRIP_DESTINOS.selecionarDestino('${destino.destino}')">
            Escolher Este Destino!
          </button>
        </div>
      </div>
    `;
  },
  
  // Renderizar destinos alternativos
  renderizarDestinosAlternativos(destinos) {
    const container = document.getElementById('destinos-alternativos');
    if (!container) return;
    
    container.innerHTML = '<h3 class="font-bold text-lg mt-2">Mais Destinos Incríveis</h3>';
    
    const destinosLimitados = destinos.slice(0, 4);
    destinosLimitados.forEach(destino => {
      const precoReal = destino.detalhesVoo ? true : false;
      const precoClasse = precoReal ? 'text-green-700 font-semibold' : '';
      const precoIcone = precoReal ? '🔍 ' : '';
      
      const elementoDestino = document.createElement('div');
      elementoDestino.className = 'card-destino border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 mt-3';
      elementoDestino.dataset.destino = destino.destino;
      
      elementoDestino.innerHTML = `
        <div class="flex">
          <div class="w-1/3">
            ${this.renderizarImagemComCreditos(
              destino.imagens && destino.imagens.length > 0 ? destino.imagens[0] : null,
              destino.destino,
              'h-full'
            )}
          </div>
          <div class="w-2/3 p-3">
            <div class="flex justify-between items-start">
              <h3 class="font-bold">${destino.destino}, ${destino.pais}</h3>
              <span class="text-xs font-medium px-1 py-0.5 rounded" style="background-color: #E0E0E0;">
                ${destino.codigoPais}
              </span>
            </div>
            <div class="mt-2 space-y-1 text-xs">
              <p class="flex items-center">
                <span class="mr-1 w-4 text-center">✈️</span>
                <span class="font-medium">Voo:</span>
                <span class="ml-1 ${precoClasse}">${precoIcone}R$ ${destino.preco.voo}</span>
              </p>
              ${destino.detalhesVoo ? `
                <p class="flex items-center justify-between bg-gray-50 px-1 py-0.5 rounded">
                  <span>${destino.detalhesVoo.numeroParadas === 0 ? 'Direto' : destino.detalhesVoo.numeroParadas === 1 ? '1 parada' : `${destino.detalhesVoo.numeroParadas} paradas`}</span>
                  <span>${destino.detalhesVoo.duracao || ''}</span>
                </p>
              ` : ''}
              ${destino.aeroporto && destino.aeroporto.codigo ? `
                <p class="flex items-center text-gray-600">
                  <span class="mr-1 w-4 text-center">🛫</span>
                  <span>${destino.aeroporto.codigo}</span>
                </p>
              ` : ''}
              <p class="flex items-center">
                <span class="mr-1 w-4 text-center">🏨</span>
                <span class="font-medium">Hotel:</span>
                <span class="ml-1">R$ ${destino.preco.hotel}/noite</span>
              </p>
              <p class="flex items-start mt-2">
                <span class="mr-1 w-4 text-center flex-shrink-0">💡</span>
                <span><span class="font-medium">Por que ir?:</span> <span class="ml-1">${destino.porque}</span></span>
              </p>
              ${destino.pontoTuristico ? `
                <p class="mt-1">
                  <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">${destino.pontoTuristico}</span>
                </p>
              ` : ''}
            </div>
          </div>
        </div>
      `;
      
      container.appendChild(elementoDestino);
    });
    
    // Botão "Mostrar Mais"
    const btnMaisOpcoes = document.createElement('button');
    btnMaisOpcoes.id = 'btn-mais-opcoes';
    btnMaisOpcoes.className = 'w-full font-medium py-3 px-4 rounded transition-colors duration-200 hover:bg-blue-200 mt-3';
    btnMaisOpcoes.style.backgroundColor = 'rgba(0, 163, 224, 0.15)';
    btnMaisOpcoes.style.color = '#00A3E0';
    btnMaisOpcoes.textContent = 'Mostrar Mais Opções';
    container.appendChild(btnMaisOpcoes);
  },
  
  // Renderizar opção "Me Surpreenda"
  renderizarOpcaoSurpresa() {
    const container = document.getElementById('opcao-surpresa');
    if (!container) return;
    
    container.innerHTML = `
      <div class="p-4 rounded-lg mt-2 text-white" style="background-color: #E87722;">
        <p class="font-bold text-lg text-center">Ainda não decidiu? Sem problemas! Clique em 'Me Surpreenda!' e eu escolho um lugar baseado nas suas vibes de viagem! 🐾</p>
        <button id="btn-surpresa" class="w-full font-bold py-2.5 px-4 rounded mt-3 transition-colors duration-200 hover:bg-blue-600" style="background-color: #00A3E0;">
          Me Surpreenda! 🎲
        </button>
      </div>
    `;
  },
  
  // Método para mostrar destino surpresa
  mostrarDestinoSurpresa() {
    if (!this.recomendacoes || !this.recomendacoes.surpresa) {
      console.error('Destino surpresa não disponível');
      return;
    }
    
    const destino = this.recomendacoes.surpresa;
    console.log('Mostrando destino surpresa:', destino);
    
    const precoReal = destino.detalhesVoo ? true : false;
    const precoClasse = precoReal ? 'text-green-700 font-semibold' : '';
    const precoIcone = precoReal ? '🔍 ' : '';
    
    const modalContainer = document.createElement('div');
    modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto';
    modalContainer.id = 'modal-surpresa';
    
    modalContainer.innerHTML = `
      <div class="bg-white rounded-lg w-full max-w-md relative max-h-[90vh] overflow-y-auto">
        <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 z-10" onclick="document.getElementById('modal-surpresa').remove()">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div class="relative">
          <div class="absolute top-0 left-0 py-1 px-3 z-10 font-bold text-white" style="background-color: #00A3E0;">
            ✨ Destino Surpresa! ✨
          </div>
          <div class="grid grid-cols-1 gap-1">
            ${this.renderizarImagemComCreditos(
              destino.imagens && destino.imagens.length > 0 ? destino.imagens[0] : null,
              destino.destino,
              'h-56'
            )}
          </div>
        </div>
        <div class="p-4">
          <div class="flex justify-between items-start">
            <h3 class="text-xl font-bold">${destino.destino}, ${destino.pais}</h3>
            <span class="text-xs font-medium px-1 py-0.5 rounded" style="background-color: #E0E0E0;">
              ${destino.codigoPais}
            </span>
          </div>
          <div class="mt-3 space-y-1 text-sm">
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center">✈️</span>
              <span class="font-medium">Preço de Voo:</span>
              <span class="ml-1 ${precoClasse}">${precoIcone}R$ ${destino.preco.voo} (ida e volta)</span>
            </p>
            ${this.prepararInformacoesVoo(destino)}
            ${this.prepararInformacaoAeroporto(destino)}
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center">🏨</span>
              <span class="font-medium">Hotel:</span>
              <span class="ml-1">R$ ${destino.preco.hotel}/noite</span>
            </p>
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center">🗓️</span>
              <span class="font-medium">Duração da Viagem:</span>
              <span class="ml-1">${this.obterDatasViagem()}</span>
            </p>
            <p class="flex items-start mt-2">
              <span class="mr-2 w-5 text-center flex-shrink-0">🏛️</span>
              <span><span class="font-medium">Por que ir?:</span> <span class="ml-1">${destino.porque}</span></span>
            </p>
            <p class="flex items-start">
              <span class="mr-2 w-5 text-center flex-shrink-0">⭐</span>
              <span><span class="font-medium">Destaque da Experiência:</span> <span class="ml-1">${destino.destaque}</span></span>
            </p>
            <div class="flex flex-wrap gap-1 mt-2">
              ${destino.pontosTuristicos ? destino.pontosTuristicos.map(ponto => `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">${ponto}</span>`).join('') : ''}
            </div>
          </div>
          <div class="mt-3 text-sm p-3 rounded" style="background-color: rgba(0, 163, 224, 0.1);">
            <p class="flex items-start font-medium">
              <span class="mr-2 flex-shrink-0">🔮</span>
              <span>Por que é uma descoberta especial?</span>
            </p>
            <p class="mt-2">
              ${destino.destino} é um tesouro escondido que combina perfeitamente com o que você busca! É um lugar menos explorado pelo turismo de massa, mas oferece experiências autênticas e memoráveis.
            </p>
          </div>
          <div class="mt-3 text-sm italic p-3 rounded" style="background-color: rgba(232, 119, 34, 0.1);">
            <p class="flex items-start">
              <span class="mr-2 flex-shrink-0">💬</span>
              <span>"${destino.comentario}"</span>
            </p>
          </div>
          <div class="mt-3 p-3 rounded bg-yellow-50 text-sm">
            <p class="flex items-start">
              <span class="mr-2 flex-shrink-0">🎁</span>
              <span class="font-medium">Curiosidade exclusiva:</span>
              <span class="ml-1">Sabia que ${destino.destino} é um dos destinos mais autênticos para experimentar a cultura de ${destino.pais}? Poucos turistas conhecem todos os seus segredos!</span>
            </p>
          </div>
          <button class="w-full font-bold py-2.5 px-4 rounded mt-4 text-white transition-colors duration-200 hover:opacity-90" style="background-color: #E87722;" onclick="BENETRIP_DESTINOS.selecionarDestino('${destino.destino}'); document.getElementById('modal-surpresa').remove()">
            Quero Este Destino Surpresa!
          </button>
          <button class="w-full font-medium py-2.5 px-4 rounded border border-gray-300 transition-colors duration-200 hover:bg-gray-100 mt-2" onclick="document.getElementById('modal-surpresa').remove()">
            Voltar às Sugestões
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modalContainer);
  },
  
  // Método para mostrar mais opções
  mostrarMaisOpcoes() {
    alert('Esta funcionalidade será implementada em breve!');
  },
  
  // Método para selecionar um destino
  selecionarDestino(nomeDestino) {
    console.log(`Destino selecionado: ${nomeDestino}`);
    let destinoSelecionado = null;
    if (this.recomendacoes.topPick.destino === nomeDestino) {
      destinoSelecionado = this.recomendacoes.topPick;
    } else if (this.recomendacoes.surpresa.destino === nomeDestino) {
      destinoSelecionado = this.recomendacoes.surpresa;
    } else {
      destinoSelecionado = this.recomendacoes.alternativas.find(d => d.destino === nomeDestino);
    }
    if (!destinoSelecionado) {
      console.error(`Destino não encontrado: ${nomeDestino}`);
      return;
    }
    localStorage.setItem('benetrip_destino_selecionado', JSON.stringify(destinoSelecionado));
    this.mostrarConfirmacaoSelecao(destinoSelecionado);
  },
  
  // Método para mostrar confirmação de seleção
  mostrarConfirmacaoSelecao(destino) {
    const precoReal = destino.detalhesVoo ? true : false;
    const precoTipo = precoReal ? 'preço real' : 'estimativa';
    const modalContainer = document.createElement('div');
    modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modalContainer.id = 'modal-confirmacao';
    modalContainer.innerHTML = `
      <div class="bg-white rounded-lg w-full max-w-md p-4">
        <div class="p-4 rounded-lg" style="background-color: rgba(232, 119, 34, 0.1);">
          <div class="flex items-start gap-3">
            <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-orange-100">
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
                Triper, o preço de voo mostrado (R$ ${destino.preco.voo}) é baseado em ${precoTipo} ${precoReal ? 'obtido em tempo real através da API da Amadeus' : 'e pode variar na etapa de reserva'}. ${destino.aeroporto ? `O voo considerado é para o aeroporto ${destino.aeroporto.nome} (${destino.aeroporto.codigo}).` : ''}
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
  }
};

// Inicializar o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  BENETRIP_DESTINOS.init();
});
