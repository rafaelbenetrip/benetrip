/**
 * destinos.js
 * Controlador principal da página de destinos recomendados da Benetrip
 * Responsável por carregar, exibir e permitir interação com destinos de viagem
 */

// Namespace para Benetrip - Evita poluição do escopo global
window.BENETRIP = window.BENETRIP || {};

// Controlador de Destinos
BENETRIP.Destinos = (function() {
  'use strict';
  
  // Cache de elementos DOM para melhor performance
  const DOM = {};
  
  // Configurações
  const CONFIG = {
    animationDuration: 300, // ms
    progressUpdateInterval: 300, // ms
    progressInitialValue: 10, // %
    progressMaxValue: 90, // %
    // Imagens locais (usar diretamente o que temos)
    tripinhaImageUrl: '/assets/images/tripinha/avatar-normal.png', 
    dateFormat: { year: 'numeric', month: 'long', day: 'numeric' }
  };
  
  // Estado interno do módulo
  const state = {
    loading: true,
    progress: 0,
    updateInterval: null,
    recomendacoes: null,
    selectedDestination: null
  };
  
  // API pública
  const publicAPI = {
    init: init,
    selecionarDestino: selecionarDestino,
    verSurpresa: verSurpresa,
    fecharModal: fecharModal,
    carregarRecomendacoes: carregarRecomendacoes
  };
  
  /**
   * Inicializa o módulo de destinos
   * @return {Object} API pública do módulo
   */
  function init() {
    cacheElementos();
    registrarEventListeners();
    iniciarCarregamento();
    carregarRecomendacoes();
    
    // Retornar a API pública para encadeamento
    return publicAPI;
  }
  
  /**
   * Armazena referências aos elementos DOM para evitar múltiplas consultas
   */
  function cacheElementos() {
    DOM.containerLoading = document.querySelector('.loading-container');
    DOM.containerConteudo = document.getElementById('conteudo-recomendacoes');
    DOM.containerErro = document.getElementById('erro-recomendacoes');
    DOM.mensagemTripinha = document.getElementById('mensagem-tripinha');
    DOM.destinoDestaque = document.getElementById('destino-destaque');
    DOM.destinosAlternativos = document.getElementById('destinos-alternativos');
    DOM.opcaoSurpresa = document.getElementById('opcao-surpresa');
    DOM.btnVoltar = document.getElementById('btn-voltar');
    DOM.progressBar = document.querySelector('.progress-bar');
    DOM.btnTentarNovamente = document.getElementById('btn-tentar-novamente');
    DOM.modalContainer = document.getElementById('destino-surpresa-modal');
  }
  
  /**
   * Registra todos os event listeners necessários
   */
  function registrarEventListeners() {
    // Navegação e controles
    if (DOM.btnVoltar) {
      DOM.btnVoltar.addEventListener('click', voltarParaChat);
    }
    
    if (DOM.btnTentarNovamente) {
      DOM.btnTentarNovamente.addEventListener('click', carregarRecomendacoes);
    }
    
    // Escutar eventos de progresso da IA
    document.addEventListener('benetrip_progress', handleProgressEvent);
    
    // Listener para fechar modais quando clicar fora
    if (DOM.modalContainer) {
      DOM.modalContainer.addEventListener('click', (e) => {
        if (e.target === DOM.modalContainer) {
          fecharModal();
        }
      });
    }
    
    // Lidar com tecla ESC para fechar modais
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fecharModal();
    });
  }
  
  /**
   * Manipula eventos de progresso da IA
   * @param {Event} event - Evento de progresso
   */
  function handleProgressEvent(event) {
    const { fase, porcentagem, mensagem } = event.detail || {};
    
    if (porcentagem) {
      atualizarBarraProgresso(porcentagem);
    }
    
    if (fase === 'concluido') {
      setTimeout(() => {
        mostrarRecomendacoes();
      }, CONFIG.animationDuration);
    }
  }
  
  /**
   * Inicializa o estado de carregamento
   */
  function iniciarCarregamento() {
    state.loading = true;
    state.progress = CONFIG.progressInitialValue;
    
    atualizarBarraProgresso(state.progress);
    
    // Atualiza a barra de progresso em intervalos regulares
    state.updateInterval = setInterval(() => {
      state.progress += 5;
      atualizarBarraProgresso(Math.min(state.progress, CONFIG.progressMaxValue));
      
      if (state.progress >= CONFIG.progressMaxValue) {
        clearInterval(state.updateInterval);
      }
    }, CONFIG.progressUpdateInterval);
  }
  
  /**
   * Atualiza a barra de progresso para um valor específico
   * @param {number} valor - Porcentagem de progresso (0-100)
   */
  function atualizarBarraProgresso(valor) {
    if (!DOM.progressBar) return;
    
    DOM.progressBar.style.width = `${valor}%`;
    DOM.progressBar.setAttribute('aria-valuenow', valor);
    
    // Adicionar uma descrição da porcentagem para leitores de tela
    DOM.progressBar.setAttribute('aria-valuetext', `${Math.round(valor)}% completo`);
  }
  
  /**
   * Carrega as recomendações de destinos
   */
  async function carregarRecomendacoes() {
    try {
      // Restaurar estado inicial
      mostrarTelaCarregando();
      
      // Verificar se temos recomendações no localStorage
      const recomendacoesStr = localStorage.getItem('benetrip_recomendacoes');
      
      if (recomendacoesStr) {
        try {
          state.recomendacoes = JSON.parse(recomendacoesStr);
          console.log('Recomendações carregadas do localStorage:', state.recomendacoes);
          
          // Simulamos um pequeno atraso para melhor UX
          setTimeout(() => {
            mostrarRecomendacoes();
          }, 1500);
          
        } catch (parseError) {
          console.error('Erro ao processar dados do localStorage:', parseError);
          await obterNovasRecomendacoes();
        }
      } else {
        await obterNovasRecomendacoes();
      }
      
    } catch (error) {
      console.error('Erro ao carregar recomendações:', error);
      mostrarErro('Não foi possível carregar as recomendações. Por favor, tente novamente.');
    }
  }
  
  /**
   * Obtém novas recomendações da API
   */
  async function obterNovasRecomendacoes() {
    try {
      // Verificar se o serviço de IA está disponível
      if (!window.BENETRIP_AI) {
        throw new Error('Serviço de IA não inicializado');
      }
      
      // Buscar preferências do usuário do localStorage
      const preferenciasStr = localStorage.getItem('benetrip_preferencias');
      
      if (!preferenciasStr) {
        throw new Error('Preferências do usuário não encontradas');
      }
      
      const preferencias = JSON.parse(preferenciasStr);
      console.log('Buscando recomendações com preferências:', preferencias);
      
      // Chamar o serviço de IA para obter recomendações
      state.recomendacoes = await window.BENETRIP_AI.obterRecomendacoes(preferencias);
      
      // Salvar recomendações no localStorage para uso futuro
      localStorage.setItem('benetrip_recomendacoes', JSON.stringify(state.recomendacoes));
      
      // Exibir recomendações
      mostrarRecomendacoes();
      
    } catch (error) {
      console.error('Erro ao obter novas recomendações:', error);
      mostrarErro('Não foi possível obter recomendações. Por favor, verifique sua conexão e tente novamente.');
    }
  }
  
  /**
   * Exibe as recomendações na interface
   */
  function mostrarRecomendacoes() {
    // Encerrar o intervalo de atualização de progresso
    if (state.updateInterval) {
      clearInterval(state.updateInterval);
      state.updateInterval = null;
    }
    
    // Finalizar a barra de progresso para 100%
    atualizarBarraProgresso(100);
    
    // Verificar se temos dados válidos
    if (!state.recomendacoes || !state.recomendacoes.topPick) {
      mostrarErro('Dados de recomendações inválidos');
      return;
    }
    
    try {
      // Ocultar loading e mostrar conteúdo com animação
      setTimeout(() => {
        if (DOM.containerLoading) DOM.containerLoading.style.display = 'none';
        if (DOM.containerConteudo) DOM.containerConteudo.classList.remove('hidden');
        
        // Aplicar classe de animação para entrada de conteúdo
        if (DOM.containerConteudo) DOM.containerConteudo.classList.add('fade-in');
        
        // Renderizar todos os componentes
        renderizarMensagemTripinha();
        renderizarDestinoDestaque();
        renderizarDestinosAlternativos();
        renderizarOpcaoSurpresa();
        
        // Atualizar estado
        state.loading = false;
      }, 300);
      
    } catch (renderError) {
      console.error('Erro ao renderizar recomendações:', renderError);
      mostrarErro('Erro ao exibir as recomendações. Por favor, tente novamente.');
    }
  }
  
  /**
   * Mostra a tela de carregamento
   */
  function mostrarTelaCarregando() {
    if (DOM.containerLoading) DOM.containerLoading.style.display = 'block';
    if (DOM.containerConteudo) DOM.containerConteudo.classList.add('hidden');
    if (DOM.containerErro) DOM.containerErro.classList.add('hidden');
    atualizarBarraProgresso(CONFIG.progressInitialValue);
  }
  
  /**
   * Exibe mensagem de erro
   * @param {string} mensagem - Mensagem de erro a ser exibida
   */
  function mostrarErro(mensagem) {
    // Limpar intervalo de atualização se existir
    if (state.updateInterval) {
      clearInterval(state.updateInterval);
      state.updateInterval = null;
    }
    
    // Ocultar carregamento e mostrar erro
    if (DOM.containerLoading) DOM.containerLoading.style.display = 'none';
    if (DOM.containerConteudo) DOM.containerConteudo.classList.add('hidden');
    if (DOM.containerErro) DOM.containerErro.classList.remove('hidden');
    
    // Exibir mensagem de erro
    const mensagemErro = document.getElementById('mensagem-erro');
    if (mensagemErro) {
      mensagemErro.textContent = mensagem || 'Ocorreu um erro inesperado';
    }
  }
  
  /**
   * Sanitiza strings para prevenir XSS
   * @param {string} str - String a ser sanitizada
   * @return {string} String sanitizada
   */
  function sanitizarString(str) {
    if (!str) return '';
    
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
  }
  
  /**
   * Formata uma data para exibição
   * @param {string} dateStr - String de data no formato ISO
   * @return {string} Data formatada para exibição
   */
  function formatarData(dateStr) {
    if (!dateStr) return '';
    
    try {
      const data = new Date(dateStr);
      return data.toLocaleDateString('pt-BR', CONFIG.dateFormat);
    } catch (e) {
      console.error('Erro ao formatar data:', e);
      return dateStr;
    }
  }
  
  /**
   * Verifica se uma imagem existe
   * @param {string} url - URL da imagem a verificar
   * @return {boolean} true se a imagem existe, false caso contrário
   */
  function mostrarIconeDestino(destino) {
    // Criar um elemento div com cor de fundo e estilo
    const iconeTxt = destino.substr(0, 2).toUpperCase();
    return `<div class="bg-blue-500 text-white rounded-full w-full h-full flex items-center justify-center text-xl font-bold">
      ${iconeTxt}
    </div>`;
  }
  
  /**
   * Renderiza a mensagem da Tripinha
   */
  function renderizarMensagemTripinha() {
    if (!DOM.mensagemTripinha) return;
    
    DOM.mensagemTripinha.innerHTML = `
      <div class="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-start gap-3">
          <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-orange-100">
            <img src="${CONFIG.tripinhaImageUrl}" alt="Tripinha animada" class="w-full h-full object-cover" onerror="this.style.display='none'; this.parentNode.innerHTML='🐶';" />
          </div>
          <p class="text-gray-800 leading-relaxed">
            Eu farejei por aí e encontrei alguns destinos incríveis para sua aventura! 🐾 Veja minha escolha top — 
            e mais algumas opções se você quiser explorar! Se estiver com vontade de se arriscar, clica em 'Me Surpreenda!' e eu escolho uma joia escondida pra você! 🐕 ✨
          </p>
        </div>
      </div>
    `;
  }
  
  /**
   * Renderiza o destino em destaque
   */
  function renderizarDestinoDestaque() {
    if (!DOM.destinoDestaque || !state.recomendacoes) return;
    
    const destino = state.recomendacoes.topPick;
    if (!destino) return;
    
    // Data de viagem
    const dataViagem = destino.dataViagem ? 
      formatarData(destino.dataViagem.inicio) + ' a ' + formatarData(destino.dataViagem.fim) : 
      '5 a 9 de Agosto, 2025';
    
    // Criar estrutura HTML do destino destaque
    let html = `
      <div class="border border-gray-200 rounded-lg overflow-hidden shadow-md destino-destaque">
        <div class="relative">
          <div class="absolute top-0 left-0 py-1 px-3 z-10 font-bold text-white" style="background-color: #E87722">
            Escolha Top da Tripinha!
          </div>
          <div class="grid grid-cols-2 gap-1">
    `;
    
    // Adicionar placeholders de imagem (divisão colorida)
    const corFundo1 = 'bg-orange-100';
    const corFundo2 = 'bg-blue-100';
    
    html += `
      <div class="${corFundo1} h-36 flex items-center justify-center">
        <span class="text-lg font-bold">${destino.destino.substr(0, 1)}</span>
      </div>
      <div class="${corFundo2} h-36 flex items-center justify-center">
        <span class="text-lg font-bold">${destino.pais.substr(0, 1)}</span>
      </div>
    `;
    
    // Continuar com as informações do destino
    html += `
          </div>
        </div>
        
        <div class="p-4">
          <div class="flex justify-between items-start">
            <h3 class="text-xl font-bold">${sanitizarString(destino.destino)}, ${sanitizarString(destino.pais)}</h3>
            <span class="text-xs font-medium px-1 py-0.5 rounded" style="background-color: #E0E0E0">
              ${sanitizarString(destino.codigoPais || 'AR')}
            </span>
          </div>
          
          <div class="mt-3 space-y-2 text-sm">
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center" aria-hidden="true">✈️</span> 
              <span class="font-medium">Estimativa de Voo:</span> 
              <span class="ml-1">R$ ${destino.preco?.voo || '1500'} (ida e volta)</span>
            </p>
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center" aria-hidden="true">🏨</span> 
              <span class="font-medium">Estimativa de Hotel:</span> 
              <span class="ml-1">R$ ${destino.preco?.hotel || '300'}/noite</span>
            </p>
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center" aria-hidden="true">🗓️</span> 
              <span class="font-medium">Duração da Viagem:</span> 
              <span class="ml-1">${dataViagem}</span>
            </p>
            <p class="flex items-start mt-2">
              <span class="mr-2 w-5 text-center flex-shrink-0" aria-hidden="true">🌆</span> 
              <span>
                <span class="font-medium">Por que ir?:</span> 
                <span class="ml-1">${sanitizarString(destino.porque || 'Experiência urbana intensa, boas compras e uma das melhores cenas gastronômicas da América Latina.')}</span>
              </span>
            </p>
            <p class="flex items-start">
              <span class="mr-2 w-5 text-center flex-shrink-0" aria-hidden="true">⭐</span>
              <span>
                <span class="font-medium">Destaque da Experiência:</span> 
                <span class="ml-1">${sanitizarString(destino.destaque || 'Visite o Teatro Colón e experimente o famoso asado argentino.')}</span>
              </span>
            </p>
          </div>
          
          <div class="mt-3 text-sm italic p-3 rounded" style="background-color: rgba(0, 163, 224, 0.1)">
            <p class="flex items-start">
              <span class="mr-2 flex-shrink-0" aria-hidden="true">💬</span>
              <span>"${sanitizarString(destino.comentario || 'Vai ser uma aventura incrível, com muita energia e diversão!')}"</span>
            </p>
          </div>
          
          <button 
            class="w-full font-bold py-2.5 px-4 rounded mt-4 text-white transition-colors duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500" 
            style="background-color: #E87722" 
            onclick="BENETRIP.Destinos.selecionarDestino('${destino.destino}', '${destino.pais}')">
            Escolher Este Destino!
          </button>
        </div>
      </div>
    `;
    
    // Inserir HTML no container
    DOM.destinoDestaque.innerHTML = html;
  }
  
  /**
   * Renderiza os destinos alternativos
   */
  function renderizarDestinosAlternativos() {
    if (!DOM.destinosAlternativos || !state.recomendacoes) return;
    
    const alternativas = state.recomendacoes.alternativas || [];
    if (!Array.isArray(alternativas) || alternativas.length === 0) return;
    
    // Limpar container
    DOM.destinosAlternativos.innerHTML = '<h3 class="font-bold text-lg mt-2">Mais Destinos Incríveis</h3>';
    
    // Algumas cores alternadas para os blocos
    const cores = ['bg-blue-100', 'bg-green-100', 'bg-yellow-100', 'bg-purple-100', 'bg-pink-100'];
    
    // Renderizar cada destino alternativo
    alternativas.forEach((destino, index) => {
      const card = document.createElement('div');
      card.className = 'border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 mt-4 destino-card';
      card.setAttribute('data-destino', destino.destino);
      card.setAttribute('data-pais', destino.pais);
      // Melhorar acessibilidade
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Selecionar destino ${destino.destino}, ${destino.pais}`);
      
      // Selecionar uma cor de fundo para este destino
      const corFundo = cores[index % cores.length];
      
      let cardHtml = `
        <div class="flex">
          <div class="w-1/3 ${corFundo} flex items-center justify-center">
            <span class="text-2xl font-bold">${destino.destino.substr(0, 1).toUpperCase()}</span>
          </div>
          <div class="w-2/3 p-3">
            <div class="flex justify-between items-start">
              <h3 class="font-bold">${sanitizarString(destino.destino)}, ${sanitizarString(destino.pais)}</h3>
              <span class="text-xs font-medium px-1 py-0.5 rounded" style="background-color: #E0E0E0">
                ${sanitizarString(destino.codigoPais || 'BR')}
              </span>
            </div>
            <div class="mt-2 space-y-1 text-xs">
              <p class="flex items-center">
                <span class="mr-1 w-4 text-center" aria-hidden="true">✈️</span> 
                <span class="font-medium">Voo:</span> 
                <span class="ml-1">R$ ${destino.preco?.voo || '1200'}</span>
              </p>
              <p class="flex items-center">
                <span class="mr-1 w-4 text-center" aria-hidden="true">🏨</span> 
                <span class="font-medium">Hotel:</span> 
                <span class="ml-1">R$ ${destino.preco?.hotel || '250'}/noite</span>
              </p>
              <p class="flex items-start mt-2">
                <span class="mr-1 w-4 text-center flex-shrink-0" aria-hidden="true">🌆</span> 
                <span>
                  <span class="font-medium">Por que ir?:</span> 
                  <span class="ml-1">${sanitizarString(destino.porque || 'Um destino incrível para sua próxima aventura!')}</span>
                </span>
              </p>
            </div>
          </div>
        </div>
      `;
      
      card.innerHTML = cardHtml;
      
      // Adicionar eventos para melhor acessibilidade
      card.addEventListener('click', () => {
        selecionarDestino(destino.destino, destino.pais);
      });
      
      // Suporte a navegação por teclado
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selecionarDestino(destino.destino, destino.pais);
        }
      });
      
      // Adicionar ao container
      DOM.destinosAlternativos.appendChild(card);
    });
  }
  
  /**
   * Renderiza a opção surpresa
   */
  function renderizarOpcaoSurpresa() {
    if (!DOM.opcaoSurpresa) return;
    
    DOM.opcaoSurpresa.innerHTML = `
      <div class="p-4 rounded-lg mt-4 text-white" style="background-color: #E87722">
        <p class="font-bold text-lg text-center">Ainda não decidiu? Sem problemas! Clique em 'Me Surpreenda!' e eu escolho um lugar baseado nas suas vibes de viagem! 🐾</p>
        <button 
          class="w-full font-bold py-2.5 px-4 rounded mt-3 transition-colors duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" 
          style="background-color: #00A3E0"
          onclick="BENETRIP.Destinos.verSurpresa()">
          Me Surpreenda! 🎲
        </button>
      </div>
    `;
  }
  
  /**
   * Volta para a tela de chat
   */
  function voltarParaChat() {
    // Salvar estado atual (opcional)
    const estadoAtual = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      passo: 'destinos'
    };
    localStorage.setItem('benetrip_navegacao', JSON.stringify(estadoAtual));
    
    // Redirecionar para a tela de chat
    window.location.href = "/chat.html";
  }
  
  /**
   * Fecha o modal de destino surpresa
   */
  function fecharModal() {
    if (!DOM.modalContainer) return;
    
    // Ocultar o modal com transição
    DOM.modalContainer.classList.add('hidden');
    
    // Atualizar atributos de acessibilidade
    DOM.modalContainer.setAttribute('aria-hidden', 'true');
    
    // Devolver o foco ao elemento que abriu o modal
    const btnSurpresa = document.querySelector('[onclick="BENETRIP.Destinos.verSurpresa()"]');
    if (btnSurpresa) {
      btnSurpresa.focus();
    }
  }
  
  /**
   * Seleciona um destino e prossegue para a próxima etapa
   * @param {string} destino - Nome do destino
   * @param {string} pais - Nome do país
   */
  function selecionarDestino(destino, pais) {
    if (!destino || !pais) {
      console.error('Dados de destino inválidos');
      return;
    }
    
    console.log(`Destino selecionado: ${destino}, ${pais}`);
    
    // Salvar destino selecionado no localStorage
    const selecao = {
      destino: destino,
      pais: pais,
      data: new Date().toISOString()
    };
    
    localStorage.setItem('benetrip_destino_selecionado', JSON.stringify(selecao));
    
    // Atualizar estado da aplicação
    state.selectedDestination = selecao;
    
    // Verificar se o módulo de voos está disponível
    if (window.BENETRIP.Voos && typeof window.BENETRIP.Voos.iniciar === 'function') {
      window.BENETRIP.Voos.iniciar(selecao);
      window.location.href = "/voos.html";
    } else {
      // Fallback: mostrar mensagem sobre próximos passos
      mostrarConfirmacaoSelecao(destino, pais);
    }
  }
  
  /**
   * Mostra uma confirmação da seleção de destino
   * @param {string} destino - Nome do destino
   * @param {string} pais - Nome do país
   */
  function mostrarConfirmacaoSelecao(destino, pais) {
    alert(`Você escolheu ${destino}, ${pais}! Em breve você poderá buscar voos para este destino.`);
    
    // Aqui você pode adicionar uma implementação mais elegante,
    // como um modal de confirmação com os próximos passos
  }
  
  /**
   * Exibe o destino surpresa em um modal
   */
  function verSurpresa() {
    console.log('Destino surpresa solicitado');
    renderizarDestinoSurpresa();
  }
  
  /**
   * Renderiza o modal de destino surpresa
   */
  function renderizarDestinoSurpresa() {
    // Verificar se temos dados para o destino surpresa
    if (!state.recomendacoes || !state.recomendacoes.surpresa) {
      alert('Desculpe, não conseguimos encontrar um destino surpresa para você agora.');
      return;
    }
    
    const surpresa = state.recomendacoes.surpresa;
    
    // Criar o modal se não existir
    if (!DOM.modalContainer) {
      DOM.modalContainer = document.createElement('div');
      DOM.modalContainer.id = 'destino-surpresa-modal';
      DOM.modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
      DOM.modalContainer.setAttribute('role', 'dialog');
      DOM.modalContainer.setAttribute('aria-modal', 'true');
      DOM.modalContainer.setAttribute('aria-labelledby', 'modal-title');
      
      document.body.appendChild(DOM.modalContainer);
    }
    
    // Data de viagem
    const dataViagem = surpresa.dataViagem ? 
      formatarData(surpresa.dataViagem.inicio) + ' a ' + formatarData(surpresa.dataViagem.fim) : 
      '5 a 9 de Agosto, 2025';
    
    // Criar conteúdo do modal
    let modalHtml = `
      <div class="bg-white rounded-lg overflow-hidden shadow-xl max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div class="relative">
          <button class="absolute top-2 right-2 text-white bg-gray-800 bg-opacity-50 rounded-full p-1 hover:bg-opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" 
            onclick="BENETRIP.Destinos.fecharModal()" aria-label="Fechar destino surpresa">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
          
          <div class="relative">
            <div class="absolute top-0 left-0 py-1 px-3 z-10 font-bold text-white" style="background-color: #00A3E0">
              ✨ Destino Surpresa! ✨
            </div>
            
            <!-- Usar um bloco de cor em vez de imagem para evitar problemas -->
            <div class="bg-purple-100 h-56 flex items-center justify-center">
              <span class="text-4xl font-bold">${surpresa.destino.substr(0, 1)}${surpresa.pais.substr(0, 1)}</span>
            </div>
          </div>
        </div>
        
        <div class="p-4">
          <div class="flex justify-between items-start">
            <h3 id="modal-title" class="text-xl font-bold">${sanitizarString(surpresa.destino)}, ${sanitizarString(surpresa.pais)}</h3>
            <span class="text-xs font-medium px-1 py-0.5 rounded" style="background-color: #E0E0E0">
              ${sanitizarString(surpresa.codigoPais || 'CL')}
            </span>
          </div>
          
          <div class="mt-3 space-y-2 text-sm">
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center" aria-hidden="true">✈️</span> 
              <span class="font-medium">Estimativa de Voo:</span> 
              <span class="ml-1">R$ ${surpresa.preco?.voo || '1800'} (ida e volta)</span>
            </p>
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center" aria-hidden="true">🏨</span> 
              <span class="font-medium">Estimativa de Hotel:</span> 
              <span class="ml-1">R$ ${surpresa.preco?.hotel || '280'}/noite</span>
            </p>
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center" aria-hidden="true">🗓️</span> 
              <span class="font-medium">Duração da Viagem:</span> 
              <span class="ml-1">${dataViagem}</span>
            </p>
          </div>
          
          <div class="mt-3 text-sm p-3 rounded" style="background-color: rgba(0, 163, 224, 0.1)">
            <p class="flex items-start font-medium">
              <span class="mr-2 flex-shrink-0" aria-hidden="true">🔮</span>
              <span>Por que é uma descoberta especial?</span>
            </p>
            <p class="mt-2">
              ${sanitizarString(surpresa.descricaoEspecial || 'Este é um destino único que combina perfeitamente com o seu estilo de viagem! Com opções de aventuras naturais e cultura vibrante.')}
            </p>
          </div>
          
          <div class="mt-3 text-sm italic p-3 rounded" style="background-color: rgba(232, 119, 34, 0.1)">
            <p class="flex items-start">
              <span class="mr-2 flex-shrink-0" aria-hidden="true">💬</span>
              <span>"${sanitizarString(surpresa.comentario || 'Um destino incrível que vai te surpreender com paisagens de tirar o fôlego e experiências únicas!')}"</span>
            </p>
          </div>
          
          <div class="mt-3 p-3 rounded bg-yellow-50 text-sm">
            <p class="flex items-start">
              <span class="mr-2 flex-shrink-0" aria-hidden="true">🎁</span>
              <span class="font-medium">Curiosidade exclusiva:</span>
              <span class="ml-1">${sanitizarString(surpresa.curiosidade || 'Este destino é conhecido por sua culinária famosa e tradições únicas que datam de séculos!')}</span>
            </p>
          </div>
          
          <div class="flex gap-2 mt-4">
            <button 
              class="flex-1 font-bold py-2.5 px-4 rounded text-white transition-colors duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500" 
              style="background-color: #E87722" 
              onclick="BENETRIP.Destinos.selecionarDestino('${surpresa.destino}', '${surpresa.pais}')">
              Quero Este Destino!
            </button>
            
            <button 
              class="font-medium py-2.5 px-4 rounded border border-gray-300 transition-colors duration-200 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500" 
              onclick="BENETRIP.Destinos.fecharModal()">
              Voltar
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Inserir o conteúdo no modal
    DOM.modalContainer.innerHTML = modalHtml;
    
    // Mostrar o modal
    DOM.modalContainer.classList.remove('hidden');
    
    // Focar o primeiro elemento focável dentro do modal para acessibilidade
    setTimeout(() => {
      const primeiroElementoFocavel = DOM.modalContainer.querySelector('button, [tabindex="0"], a');
      if (primeiroElementoFocavel) {
        primeiroElementoFocavel.focus();
      }
    }, 100);
    
    // Mover o foco para o modal para leitores de tela
    DOM.modalContainer.setAttribute('aria-hidden', 'false');
  }
  
  // Retornar a API pública
  return publicAPI;
})();

// Inicializar estilos CSS adicionais
(function() {
  // Adiciona estilos para os containers de imagens e créditos
  const style = document.createElement('style');
  style.textContent = `
    .fade-in {
      animation: fadeIn 0.5s ease-in-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  
  document.head.appendChild(style);
})();

// Inicializar o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
  // Inicializar o módulo de destinos
  BENETRIP.Destinos.init();
});
