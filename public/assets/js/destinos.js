/**
 * BENETRIP - Visualização de Destinos Recomendados
 * Controla a exibição e interação dos destinos recomendados pela IA
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
      // Lidar com clique em cartões de destino
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
      if (!dadosString) {
        return null;
      }
      
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
      
      // Verificar se serviço de IA foi inicializado
      if (!window.BENETRIP_AI || !window.BENETRIP_AI.isInitialized()) {
        if (window.BENETRIP_AI && typeof window.BENETRIP_AI.init === 'function') {
          window.BENETRIP_AI.init();
        } else {
          throw new Error('Serviço de IA não disponível');
        }
      }
      
      // Verificar se temos recomendações salvas no localStorage
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
      this.atualizarProgresso('Consultando bancos de dados de viagem...', 40);
      
      // Obter recomendações - usar respostas diretamente, não procurar em dadosUsuario.respostas
      const recomendacoes = await window.BENETRIP_AI.obterRecomendacoes(this.dadosUsuario.respostas);
      console.log('Recomendações obtidas:', recomendacoes);
      
      // Validar recomendações
      if (!recomendacoes || !recomendacoes.topPick) {
        console.error('Recomendações inválidas:', recomendacoes);
        throw new Error('Dados de recomendação inválidos');
      }
      
      return recomendacoes;
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
      // Verificar se há dados de recomendações
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
      
      // Ocultar loader
      const loader = document.querySelector('.loading-container');
      if (loader) {
        loader.style.display = 'none';
      }
      
      // Mostrar conteúdo principal
      const conteudo = document.getElementById('conteudo-recomendacoes');
      if (conteudo) {
        conteudo.classList.remove('hidden');
      } else {
        console.error('Container de conteúdo não encontrado no DOM');
        return;
      }
      
      // Renderizar componentes principais
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
    if (loader) {
      loader.classList.remove('hidden');
    }
    
    const conteudo = document.getElementById('conteudo-recomendacoes');
    if (conteudo) {
      conteudo.classList.add('hidden');
    }
  },
  
  // Exibir mensagem de erro
  mostrarErro(mensagem) {
    // Ocultar loader
    const loader = document.querySelector('.loading-container');
    if (loader) {
      loader.style.display = 'none';
    }
    
    // Mostrar container de erro
    const containerErro = document.getElementById('erro-recomendacoes');
    if (containerErro) {
      const mensagemErro = document.getElementById('mensagem-erro');
      if (mensagemErro) {
        mensagemErro.textContent = mensagem;
      }
      containerErro.classList.remove('hidden');
      
      // Configurar botão tentar novamente
      const btnTentar = document.getElementById('btn-tentar-novamente');
      if (btnTentar) {
        btnTentar.addEventListener('click', () => {
          window.location.reload();
        });
      }
    } else {
      // Se não existir o container de erro, criar um
      const novoContainerErro = document.createElement('div');
      novoContainerErro.id = 'erro-recomendacoes';
      novoContainerErro.className = 'bg-red-100 text-red-700 p-4 rounded-lg my-4 text-center';
      novoContainerErro.innerHTML = `
        <p id="mensagem-erro" class="font-bold">${mensagem}</p>
        <button id="btn-tentar-novamente" class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
          Tentar Novamente
        </button>
      `;
      
      // Adicionar ao DOM
      const container = document.querySelector('.container');
      if (container) {
        container.appendChild(novoContainerErro);
      } else {
        document.body.appendChild(novoContainerErro);
      }
      
      // Configurar evento do botão
      const btnTentarNovamente = document.getElementById('btn-tentar-novamente');
      if (btnTentarNovamente) {
        btnTentarNovamente.addEventListener('click', () => {
          window.location.reload();
        });
      }
    }
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
            Eu farejei por aí e encontrei alguns destinos incríveis para sua aventura! 🐾 Veja minha escolha top — 
            e mais algumas opções se você quiser explorar! Se estiver com vontade de se arriscar, clica em 'Me Surpreenda!' e eu escolho uma joia escondida pra você! 🐕 ✨
          </p>
        </div>
      </div>
    `;
  },
  
  // Renderizar destino destaque (top pick)
  renderizarDestinoDestaque(destino) {
    const container = document.getElementById('destino-destaque');
    if (!container) return;
    
    console.log('Renderizando destino destaque:', destino);
    
    container.innerHTML = `
      <div class="border border-gray-200 rounded-lg overflow-hidden shadow-md">
        <div class="relative">
          <div 
            class="absolute top-0 left-0 py-1 px-3 z-10 font-bold text-white"
            style="background-color: #E87722;">
            Escolha Top da Tripinha!
          </div>
          <div class="grid grid-cols-2 gap-1">
            <div class="bg-gray-200 h-36">
              <img 
                src="https://source.unsplash.com/featured/?${encodeURIComponent(destino.destino)},landmark" 
                alt="${destino.destino}" 
                class="w-full h-full object-cover"
                onerror="this.src='https://placehold.co/200x144?text=${encodeURIComponent(destino.destino)}'">
            </div>
            <div class="bg-gray-200 h-36">
              <img 
                src="https://source.unsplash.com/featured/?${encodeURIComponent(destino.destino)},travel" 
                alt="${destino.destino}" 
                class="w-full h-full object-cover"
                onerror="this.src='https://placehold.co/200x144?text=${encodeURIComponent(destino.destino)}'">
            </div>
          </div>
        </div>
        
        <div class="p-4">
          <div class="flex justify-between items-start">
            <h3 class="text-xl font-bold">${destino.destino}, ${destino.pais}</h3>
            <span 
              class="text-xs font-medium px-1 py-0.5 rounded"
              style="background-color: #E0E0E0;">
              ${destino.codigoPais}
            </span>
          </div>
          
          <div class="mt-3 space-y-2 text-sm">
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center">✈️</span> 
              <span class="font-medium">Estimativa de Voo:</span> 
              <span class="ml-1">R$ ${destino.preco.voo} (ida e volta)</span>
            </p>
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center">🏨</span> 
              <span class="font-medium">Estimativa de Hotel:</span> 
              <span class="ml-1">R$ ${destino.preco.hotel}/noite</span>
            </p>
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center">🗓️</span> 
              <span class="font-medium">Duração da Viagem:</span> 
              <span class="ml-1">${this.obterDatasViagem()}</span>
            </p>
            <p class="flex items-start mt-2">
              <span class="mr-2 w-5 text-center flex-shrink-0">🌆</span> 
              <span>
                <span class="font-medium">Por que ir?:</span> 
                <span class="ml-1">${destino.porque}</span>
              </span>
            </p>
            <p class="flex items-start">
              <span class="mr-2 w-5 text-center flex-shrink-0">⭐</span>
              <span>
                <span class="font-medium">Destaque da Experiência:</span> 
                <span class="ml-1">${destino.destaque}</span>
              </span>
            </p>
          </div>
          
          <div 
            class="mt-3 text-sm italic p-3 rounded"
            style="background-color: rgba(0, 163, 224, 0.1);">
            <p class="flex items-start">
              <span class="mr-2 flex-shrink-0">💬</span>
              <span>"${destino.comentario}"</span>
            </p>
          </div>
          
          <button 
            class="w-full font-bold py-2.5 px-4 rounded mt-4 text-white transition-colors duration-200 hover:opacity-90"
            style="background-color: #E87722;"
            data-destino="${destino.destino}"
            onclick="BENETRIP_DESTINOS.selecionarDestino('${destino.destino}')">
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
    
    // Limpar container
    container.innerHTML = '<h3 class="font-bold text-lg mt-2">Mais Destinos Incríveis</h3>';
    
    // Renderizar cada destino alternativo (limitando a 4)
    const destinosLimitados = destinos.slice(0, 4);
    
    destinosLimitados.forEach(destino => {
      const elementoDestino = document.createElement('div');
      elementoDestino.className = 'card-destino border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 mt-3';
      elementoDestino.dataset.destino = destino.destino;
      
      elementoDestino.innerHTML = `
        <div class="flex">
          <div class="w-1/3">
            <img 
              src="https://source.unsplash.com/featured/?${encodeURIComponent(destino.destino)}" 
              alt="${destino.destino}" 
              class="w-full h-full object-cover"
              onerror="this.src='https://placehold.co/120x120?text=${encodeURIComponent(destino.destino)}'">
          </div>
          <div class="w-2/3 p-3">
            <div class="flex justify-between items-start">
              <h3 class="font-bold">${destino.destino}, ${destino.pais}</h3>
              <span 
                class="text-xs font-medium px-1 py-0.5 rounded"
                style="background-color: #E0E0E0;">
                ${destino.codigoPais}
              </span>
            </div>
            <div class="mt-2 space-y-1 text-xs">
              <p class="flex items-center">
                <span class="mr-1 w-4 text-center">✈️</span> 
                <span class="font-medium">Voo:</span> 
                <span class="ml-1">R$ ${destino.preco.voo}</span>
              </p>
              <p class="flex items-center">
                <span class="mr-1 w-4 text-center">🏨</span> 
                <span class="font-medium">Hotel:</span> 
                <span class="ml-1">R$ ${destino.preco.hotel}/noite</span>
              </p>
              <p class="flex items-start mt-2">
                <span class="mr-1 w-4 text-center flex-shrink-0">💡</span> 
                <span>
                  <span class="font-medium">Por que ir?:</span> 
                  <span class="ml-1">${destino.porque}</span>
                </span>
              </p>
            </div>
          </div>
        </div>
      `;
      
      container.appendChild(elementoDestino);
    });
    
    // Adicionar botão de "Mostrar Mais"
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
      <div 
        class="p-4 rounded-lg mt-2 text-white"
        style="background-color: #E87722;">
        <p class="font-bold text-lg text-center">Ainda não decidiu? Sem problemas! Clique em 'Me Surpreenda!' e eu escolho um lugar baseado nas suas vibes de viagem! 🐾</p>
        <button 
          id="btn-surpresa"
          class="w-full font-bold py-2.5 px-4 rounded mt-3 transition-colors duration-200 hover:bg-blue-600"
          style="background-color: #00A3E0;">
          Me Surpreenda! 🎲
        </button>
      </div>
    `;
  },
  
  // Método para exibir destino surpresa
  mostrarDestinoSurpresa() {
    if (!this.recomendacoes || !this.recomendacoes.surpresa) {
      console.error('Destino surpresa não disponível');
      return;
    }
    
    const destino = this.recomendacoes.surpresa;
    console.log('Mostrando destino surpresa:', destino);
    
    // Criar e exibir o modal de destino surpresa
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
          <div 
            class="absolute top-0 left-0 py-1 px-3 z-10 font-bold text-white"
            style="background-color: #00A3E0;">
            ✨ Destino Surpresa! ✨
          </div>
          <div class="grid grid-cols-1 gap-1">
            <div class="bg-gray-200 h-56">
              <img 
                src="https://source.unsplash.com/featured/?${encodeURIComponent(destino.destino)},landmark" 
                alt="${destino.destino}" 
                class="w-full h-full object-cover"
                onerror="this.src='https://placehold.co/400x224?text=${encodeURIComponent(destino.destino)}'">
            </div>
          </div>
        </div>
        
        <div class="p-4">
          <div class="flex justify-between items-start">
            <h3 class="text-xl font-bold">${destino.destino}, ${destino.pais}</h3>
            <span 
              class="text-xs font-medium px-1 py-0.5 rounded"
              style="background-color: #E0E0E0;">
              ${destino.codigoPais}
            </span>
          </div>
          
          <div class="mt-3 space-y-2 text-sm">
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center">✈️</span> 
              <span class="font-medium">Estimativa de Voo:</span> 
              <span class="ml-1">R$ ${destino.preco.voo} (ida e volta)</span>
            </p>
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center">🏨</span> 
              <span class="font-medium">Estimativa de Hotel:</span> 
              <span class="ml-1">R$ ${destino.preco.hotel}/noite</span>
            </p>
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center">🗓️</span> 
              <span class="font-medium">Duração da Viagem:</span> 
              <span class="ml-1">${this.obterDatasViagem()}</span>
            </p>
            <p class="flex items-start mt-2">
              <span class="mr-2 w-5 text-center flex-shrink-0">🏛️</span> 
              <span>
                <span class="font-medium">Por que ir?:</span> 
                <span class="ml-1">${destino.porque}</span>
              </span>
            </p>
            <p class="flex items-start">
              <span class="mr-2 w-5 text-center flex-shrink-0">⭐</span>
              <span>
                <span class="font-medium">Destaque da Experiência:</span> 
                <span class="ml-1">${destino.destaque}</span>
              </span>
            </p>
          </div>
          
          <div 
            class="mt-3 text-sm p-3 rounded"
            style="background-color: rgba(0, 163, 224, 0.1);">
            <p class="flex items-start font-medium">
              <span class="mr-2 flex-shrink-0">🔮</span>
              <span>Por que é uma descoberta especial?</span>
            </p>
            <p class="mt-2">
              ${destino.destino} é um tesouro escondido que combina perfeitamente com o que você busca! 
              É um lugar menos explorado pelo turismo de massa, mas oferece experiências autênticas e memoráveis.
            </p>
          </div>
          
          <div 
            class="mt-3 text-sm italic p-3 rounded"
            style="background-color: rgba(232, 119, 34, 0.1);">
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
          
          <button 
            class="w-full font-bold py-2.5 px-4 rounded mt-4 text-white transition-colors duration-200 hover:opacity-90"
            style="background-color: #E87722;"
            onclick="BENETRIP_DESTINOS.selecionarDestino('${destino.destino}'); document.getElementById('modal-surpresa').remove()">
            Quero Este Destino Surpresa!
          </button>
          
          <button 
            class="w-full font-medium py-2.5 px-4 rounded border border-gray-300 transition-colors duration-200 hover:bg-gray-100 mt-2"
            onclick="document.getElementById('modal-surpresa').remove()">
            Voltar às Sugestões
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modalContainer);
  },
  
  // Método para mostrar mais opções
  mostrarMaisOpcoes() {
    // Implementação futura para carregar mais destinos
    alert('Esta funcionalidade será implementada em breve!');
  },
  
  // Método para selecionar um destino
  selecionarDestino(nomeDestino) {
    console.log(`Destino selecionado: ${nomeDestino}`);
    
    // Encontrar o destino selecionado
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
    
    // Salvar destino selecionado no localStorage
    localStorage.setItem('benetrip_destino_selecionado', JSON.stringify(destinoSelecionado));
    
    // Exibir confirmação
    this.mostrarConfirmacaoSelecao(destinoSelecionado);
  },
  
  // Método para mostrar confirmação de seleção
  mostrarConfirmacaoSelecao(destino) {
    const modalContainer = document.createElement('div');
    modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modalContainer.id = 'modal-confirmacao';
    
    modalContainer.innerHTML = `
      <div class="bg-white rounded-lg w-full max-w-md p-4">
        <div 
          class="p-4 rounded-lg" 
          style="background-color: rgba(232, 119, 34, 0.1);">
          <div class="flex items-start gap-3">
            <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-orange-100">
              <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/60x60?text=🐶'">
            </div>
            <div>
              <p class="font-bold">Ótima escolha, Triper! 🐾 ${destino.destino} é incrível! Tem certeza que este é o destino certo para sua aventura?</p>
              
              <div class="mt-3">
                <label class="flex items-center space-x-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    id="confirmar-selecao"
                    class="form-checkbox h-5 w-5 rounded"
                    style="color: #E87722;">
                  <span>Sim, tenho certeza!</span>
                </label>
              </div>
              
              <p class="mt-3 text-sm">Só um aviso, Triper! Os preços que você está vendo são estimativas baseadas em buscas recentes. Os preços em tempo real aparecerão quando você escolher seus voos e hotéis.</p>
            </div>
          </div>
        </div>
        
        <div class="flex gap-2 mt-4">
          <button 
            id="btn-cancelar"
            class="flex-1 py-2 px-4 border border-gray-300 rounded hover:bg-gray-100 transition-colors">
            Voltar
          </button>
          <button 
            id="btn-confirmar"
            class="flex-1 py-2 px-4 text-white rounded transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style="background-color: #E87722;"
            disabled>
            Confirmar
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modalContainer);
    
    // Configurar eventos
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
      // Redirecionar para a tela de voos
      window.location.href = 'flights.html';
    });
  },
  
  // Método auxiliar para obter período de datas da viagem
  obterDatasViagem() {
    // Tentar obter dados reais do armazenamento
    try {
      const dadosUsuario = this.dadosUsuario;
      
      if (dadosUsuario && dadosUsuario.respostas && dadosUsuario.respostas.datas) {
        const datas = dadosUsuario.respostas.datas;
        console.log('Datas encontradas:', datas);
        
        // Verificar se é um objeto com dataIda e dataVolta
        if (datas.dataIda && datas.dataVolta) {
          // Formatar as datas para exibição sem criar objeto Date
          // Extrair as partes da data YYYY-MM-DD
          const dataIdaParts = datas.dataIda.split('-');
          const dataVoltaParts = datas.dataVolta.split('-');
          
          if (dataIdaParts.length === 3 && dataVoltaParts.length === 3) {
            // Meses em português
            const meses = [
              'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
            ];
            
            // Formatar no estilo "5 de Agosto a 12 de Agosto, 2025"
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
    
    // Fallback: retornar datas genéricas
    return "5 a 12 de Agosto, 2025";
  }
};

// Inicializar o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar sistema de destinos
  BENETRIP_DESTINOS.init();
});
