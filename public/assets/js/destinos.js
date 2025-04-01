/**
 * Benetrip - Controlador de Destinos Recomendados
 * 
 * Este arquivo gerencia a exibição e interação da página de destinos 
 * recomendados da Benetrip, incluindo carregamento de dados, renderização
 * de conteúdo e tratamento de interações do usuário.
 */

// Namespace da aplicação para evitar poluição do escopo global
window.BENETRIP = window.BENETRIP || {};

// Controlador da página de destinos recomendados
BENETRIP.Destinos = (function() {
  // Variáveis privadas do módulo
  let elements = {}; // Para armazenar referências aos elementos DOM
  let loadingTimer = null; // Temporizador para simulação de carregamento
  let destinosData = null; // Dados dos destinos recomendados

  /**
   * Inicializa o controlador e seus componentes
   */
  function init() {
    // Carregamos as referências DOM assim que o documento estiver pronto
    document.addEventListener('DOMContentLoaded', function() {
      cacheElementReferences();
      setupEventListeners();
      startLoading();
      carregarRecomendacoes();
    });
  }

  /**
   * Armazena referências aos elementos DOM para uso posterior
   */
  function cacheElementReferences() {
    elements = {
      containerLoading: document.querySelector('.loading-container'),
      containerConteudo: document.getElementById('conteudo-recomendacoes'),
      containerErro: document.getElementById('erro-recomendacoes'),
      mensagemTripinha: document.getElementById('mensagem-tripinha'),
      destinoDestaque: document.getElementById('destino-destaque'),
      destinosAlternativos: document.getElementById('destinos-alternativos'),
      opcaoSurpresa: document.getElementById('opcao-surpresa'),
      btnVoltar: document.getElementById('btn-voltar'),
      progressBar: document.querySelector('.progress-bar'),
      btnTentarNovamente: document.getElementById('btn-tentar-novamente'),
      mensagemErro: document.getElementById('mensagem-erro')
    };

    // Log para depuração dos elementos encontrados
    console.log('Elementos encontrados:', {
      loading: !!elements.containerLoading,
      conteudo: !!elements.containerConteudo,
      erro: !!elements.containerErro,
      destaque: !!elements.destinoDestaque,
      alternativos: !!elements.destinosAlternativos,
      surpresa: !!elements.opcaoSurpresa
    });
  }

  /**
   * Configura todos os event listeners necessários
   */
  function setupEventListeners() {
    // Botões de navegação
    if (elements.btnVoltar) {
      elements.btnVoltar.addEventListener('click', voltarParaChat);
    }

    if (elements.btnTentarNovamente) {
      elements.btnTentarNovamente.addEventListener('click', carregarRecomendacoes);
    }

    // Listener para eventos de progresso da IA
    document.addEventListener('benetrip_progress', handleProgressEvent);
  }

  /**
   * Manipula eventos de progresso emitidos pela IA
   * @param {CustomEvent} event - Evento contendo informações sobre o progresso
   */
  function handleProgressEvent(event) {
    const { fase, porcentagem, mensagem } = event.detail || {};
    
    // Atualizar a barra de progresso se tivermos uma porcentagem
    if (porcentagem && elements.progressBar) {
      updateProgressBar(porcentagem);
    }
    
    // Se concluiu, mostrar as recomendações após um breve atraso
    if (fase === 'concluido') {
      setTimeout(() => {
        mostrarRecomendacoes(destinosData);
      }, 1000);
    }
  }

  /**
   * Inicia o processo de carregamento simulado
   */
  function startLoading() {
    let progress = 10;
    updateProgressBar(progress);
    
    // Limpar qualquer timer existente
    if (loadingTimer) {
      clearInterval(loadingTimer);
    }
    
    // Criar um novo timer para simular progresso
    loadingTimer = setInterval(() => {
      progress += 5;
      
      // Garantir que não passemos de 90% antes do carregamento concluído
      if (progress <= 90) {
        updateProgressBar(progress);
      } else {
        clearInterval(loadingTimer);
        loadingTimer = null;
      }
    }, 300);
  }

  /**
   * Atualiza a barra de progresso para o valor especificado
   * @param {number} value - O valor de progresso (0-100)
   */
  function updateProgressBar(value) {
    if (!elements.progressBar) return;
    
    const safeValue = Math.max(0, Math.min(100, value));
    elements.progressBar.style.width = `${safeValue}%`;
    elements.progressBar.setAttribute('aria-valuenow', safeValue);
  }

  /**
   * Carrega recomendações de destinos do localStorage ou da API
   */
  async function carregarRecomendacoes() {
    try {
      // Reiniciar a UI para o estado de carregamento
      resetUIState();
      
      // Tentar carregar recomendações do localStorage primeiro
      const recomendacoesStr = localStorage.getItem('benetrip_recomendacoes');
      
      if (recomendacoesStr) {
        try {
          destinosData = JSON.parse(recomendacoesStr);
          console.log('Recomendações carregadas do localStorage:', destinosData);
          
          // Simular um pequeno atraso para melhor UX
          updateProgressBar(70);
          setTimeout(() => {
            updateProgressBar(100);
            mostrarRecomendacoes(destinosData);
          }, 1000);
          
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
   * Obtém novas recomendações do serviço de IA
   */
  async function obterNovasRecomendacoes() {
    try {
      updateProgressBar(30);
      
      // Verificar se o serviço de IA está disponível
      if (!window.BENETRIP_AI) {
        initializeFallbackAI();
      }
      
      // Buscar preferências do usuário do localStorage
      const preferenciasStr = localStorage.getItem('benetrip_preferencias');
      
      if (!preferenciasStr) {
        // Se não encontrar preferências, usar dados de exemplo para desenvolvimento
        console.warn('Preferências não encontradas, usando dados de teste');
        destinosData = getDadosExemplo();
        
        updateProgressBar(90);
        setTimeout(() => {
          updateProgressBar(100);
          mostrarRecomendacoes(destinosData);
        }, 500);
        return;
      }
      
      const preferencias = JSON.parse(preferenciasStr);
      console.log('Buscando recomendações com preferências:', preferencias);
      
      // Emitir evento para informar o início da busca
      emitProgressEvent('buscando', 40, 'Buscando destinos que combinam com você...');
      
      // Chamar o serviço de IA para obter recomendações
      destinosData = await window.BENETRIP_AI.obterRecomendacoes(preferencias);
      
      // Salvar no localStorage para uso futuro
      if (destinosData) {
        localStorage.setItem('benetrip_recomendacoes', JSON.stringify(destinosData));
      }
      
      updateProgressBar(90);
      
      // Exibir recomendações
      setTimeout(() => {
        updateProgressBar(100);
        mostrarRecomendacoes(destinosData);
      }, 500);
      
    } catch (error) {
      console.error('Erro ao obter novas recomendações:', error);
      // Em caso de erro, usar dados de exemplo
      destinosData = getDadosExemplo();
      mostrarRecomendacoes(destinosData);
    }
  }

  /**
   * Inicializa um serviço de IA de fallback caso o principal não esteja disponível
   */
  function initializeFallbackAI() {
    // Implementar um serviço de fallback básico
    window.BENETRIP_AI = {
      obterRecomendacoes: async function(preferencias) {
        console.warn('Usando serviço de IA de fallback');
        return getDadosExemplo();
      }
    };
  }

  /**
   * Retorna dados de exemplo para desenvolvimento e fallback
   * @returns {Object} Dados de exemplo para exibição
   */
  function getDadosExemplo() {
    return {
      topPick: {
        destino: "Medellín",
        pais: "Colômbia",
        codigoPais: "CO",
        preco: { voo: "1800", hotel: "350" },
        porque: "Cidade vibrante com teleféricos, fazendas de café e trilhas cênicas.",
        destaque: "Uma mistura perfeita de agito urbano e trilhas na natureza.",
        comentario: "Medellín é um sonho! 🙌 Andei de teleférico até o Parque Arví e assisti ao pôr do sol das montanhas. Você vai adorar o clima descontraído e as vistas épicas! 🌄",
        imagens: [
          {
            url: "assets/images/destinos/medellin1.jpg",
            alt: "Vista panorâmica de Medellín com teleféricos e montanhas ao fundo",
            photographer: "Juan Rodriguez",
            photographerUrl: "https://unsplash.com/@juanrod",
            sourceUrl: "https://unsplash.com/photos/medellin-colombia"
          },
          {
            url: "assets/images/destinos/medellin2.jpg",
            alt: "Fazenda de café tradicional nos arredores de Medellín",
            photographer: "Maria González",
            photographerUrl: "https://unsplash.com/@mariag",
            sourceUrl: "https://unsplash.com/photos/colombia-coffee-farm"
          }
        ]
      },
      alternativas: [
        {
          destino: "Montevidéu",
          pais: "Uruguai",
          codigoPais: "UY",
          preco: { voo: "1500", hotel: "300" },
          porque: "Clima costeiro tranquilo com frutos do mar deliciosos e espaços culturais.",
          imagens: [
            {
              url: "assets/images/destinos/montevideo.jpg",
              alt: "Vista da orla de Montevidéu",
              photographer: "Carlos Silva",
              photographerUrl: "https://unsplash.com/@carlossilva",
              sourceUrl: "https://unsplash.com/photos/montevideo-uruguay"
            }
          ]
        },
        {
          destino: "Santiago",
          pais: "Chile",
          codigoPais: "CL",
          preco: { voo: "1600", hotel: "320" },
          porque: "Mescla de cultura andina com paisagens urbanas modernas e vinícolas famosas.",
          imagens: []
        },
        {
          destino: "Buenos Aires",
          pais: "Argentina",
          codigoPais: "AR",
          preco: { voo: "1450", hotel: "280" },
          porque: "Capital cultural da América do Sul com tangos, arquitetura e gastronomia espetacular.",
          imagens: []
        }
      ],
      surpresa: {
        ativa: true,
        destino: "Cartagena",
        pais: "Colômbia",
        descricao: "Um destino mágico com praias paradisíacas e cidade histórica colorida!"
      }
    };
  }

  /**
   * Emite um evento de progresso para informar sobre o status do processamento
   * @param {string} fase - A fase atual do processamento
   * @param {number} porcentagem - Porcentagem de conclusão (0-100)
   * @param {string} mensagem - Mensagem descritiva opcional
   */
  function emitProgressEvent(fase, porcentagem, mensagem) {
    const event = new CustomEvent('benetrip_progress', {
      detail: {
        fase: fase,
        porcentagem: porcentagem,
        mensagem: mensagem
      }
    });
    
    document.dispatchEvent(event);
  }

  /**
   * Exibe as recomendações na interface
   * @param {Object} recomendacoes - Dados de recomendações a serem exibidos
   */
  function mostrarRecomendacoes(recomendacoes) {
    // Parar o timer de carregamento simulado
    if (loadingTimer) {
      clearInterval(loadingTimer);
      loadingTimer = null;
    }
    
    // Verificar se temos dados válidos
    if (!recomendacoes || !recomendacoes.topPick) {
      mostrarErro('Dados de recomendações inválidos');
      return;
    }
    
    try {
      // Ocultar loading e mostrar conteúdo
      if (elements.containerLoading) {
        elements.containerLoading.style.display = 'none';
      }
      
      if (elements.containerConteudo) {
        elements.containerConteudo.classList.remove('hidden');
      }
      
      console.log('Renderizando destinos com dados:', recomendacoes);
      
      // Renderizar componentes da interface
      renderizarMensagemTripinha();
      renderizarDestinoDestaque(recomendacoes.topPick);
      renderizarDestinosAlternativos(recomendacoes.alternativas || []);
      renderizarOpcaoSurpresa(recomendacoes.surpresa);
      
      // Pré-carregar imagens se o serviço estiver disponível
      if (window.BENETRIP_IMAGES && typeof window.BENETRIP_IMAGES.preloadImages === 'function') {
        window.BENETRIP_IMAGES.preloadImages(recomendacoes);
      }
      
    } catch (renderError) {
      console.error('Erro ao renderizar recomendações:', renderError);
      mostrarErro('Erro ao exibir as recomendações. Por favor, tente novamente.');
    }
  }
  /**
   * Exibe mensagem de erro e oculta outros elementos da interface
   * @param {string} mensagem - Mensagem de erro a ser exibida
   */
  function mostrarErro(mensagem) {
    if (loadingTimer) {
      clearInterval(loadingTimer);
      loadingTimer = null;
    }
    
    if (elements.containerLoading) {
      elements.containerLoading.style.display = 'none';
    }
    
    if (elements.containerConteudo) {
      elements.containerConteudo.classList.add('hidden');
    }
    
    if (elements.containerErro) {
      elements.containerErro.classList.remove('hidden');
    }
    
    if (elements.mensagemErro) {
      elements.mensagemErro.textContent = mensagem || 'Ocorreu um erro inesperado';
    }
  }

  /**
   * Redefine o estado da interface para o estado inicial de carregamento
   */
  function resetUIState() {
    // Reiniciar barra de progresso
    updateProgressBar(10);
    
    // Mostrar loading e ocultar outros contêineres
    if (elements.containerLoading) {
      elements.containerLoading.style.display = 'block';
    }
    
    if (elements.containerConteudo) {
      elements.containerConteudo.classList.add('hidden');
    }
    
    if (elements.containerErro) {
      elements.containerErro.classList.add('hidden');
    }
  }

  /**
   * Renderiza a mensagem de boas-vindas da Tripinha
   */
  function renderizarMensagemTripinha() {
    if (!elements.mensagemTripinha) return;
    
    elements.mensagemTripinha.innerHTML = `
      <div class="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-start gap-3">
          <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
            <img src="assets/images/tripinha/avatar-feliz.png" alt="Tripinha sorrindo" class="w-full h-full object-cover" />
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
   * @param {Object} destino - Dados do destino principal
   */
  function renderizarDestinoDestaque(destino) {
    if (!elements.destinoDestaque || !destino) return;
    
    console.log('Renderizando destino em destaque:', destino);
    
    // Obter imagens do destino ou usar array vazio como fallback
    const imagens = destino.imagens || [];
    
    // Criar estrutura HTML do destino destaque
    let html = `
      <div class="border border-gray-200 rounded-lg overflow-hidden shadow-md destino-destaque">
        <div class="relative">
          <div class="absolute top-0 left-0 py-1 px-3 z-10 font-bold text-white" style="background-color: #E87722">
            Escolha Top da Tripinha!
          </div>
          <div class="grid grid-cols-2 gap-1">
    `;
    
    // Adicionar as duas imagens principais (ou placeholders)
    for (let i = 0; i < 2; i++) {
      if (imagens[i]) {
        html += renderImageWithCredits(
          imagens[i],
          'h-36',
          `${destino.destino}, ${destino.pais}`
        );
      } else {
        // Placeholder apenas com texto do destino
        html += `
          <div class="bg-gray-200 h-36 flex items-center justify-center">
            <span class="text-gray-600 font-medium text-center px-2">
              ${destino.destino}
            </span>
          </div>
        `;
      }
    }
    
    // Continuar com as informações do destino
    html += `
          </div>
        </div>
        
        <div class="p-4">
          <div class="flex justify-between items-start">
            <h3 class="text-xl font-bold">${destino.destino}, ${destino.pais}</h3>
            <span class="text-xs font-medium px-1 py-0.5 rounded" style="background-color: #E0E0E0">
              ${destino.codigoPais || 'N/A'}
            </span>
          </div>
          
          <div class="mt-3 space-y-2 text-sm">
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center" aria-hidden="true">✈️</span> 
              <span class="font-medium">Estimativa de Voo:</span> 
              <span class="ml-1">R$ ${formatarPreco(destino.preco?.voo)} (ida e volta)</span>
            </p>
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center" aria-hidden="true">🏨</span> 
              <span class="font-medium">Estimativa de Hotel:</span> 
              <span class="ml-1">R$ ${formatarPreco(destino.preco?.hotel)}/noite</span>
            </p>
            <p class="flex items-center">
              <span class="mr-2 w-5 text-center" aria-hidden="true">🗓️</span> 
              <span class="font-medium">Duração da Viagem:</span> 
              <span class="ml-1">${destino.datas || '5 a 9 de Agosto, 2025'}</span>
            </p>
            <p class="flex items-start mt-2">
              <span class="mr-2 w-5 text-center flex-shrink-0" aria-hidden="true">🌆</span> 
              <span>
                <span class="font-medium">Por que ir?:</span> 
                <span class="ml-1">${destino.porque || 'Um destino incrível para sua próxima aventura!'}</span>
              </span>
            </p>
            <p class="flex items-start">
              <span class="mr-2 w-5 text-center flex-shrink-0" aria-hidden="true">⭐</span>
              <span>
                <span class="font-medium">Destaque da Experiência:</span> 
                <span class="ml-1">${destino.destaque || 'Experiência única e inesquecível!'}</span>
              </span>
            </p>
          </div>
          
          <div class="mt-3 text-sm italic p-3 rounded" style="background-color: rgba(0, 163, 224, 0.1)">
            <p class="flex items-start">
              <span class="mr-2 flex-shrink-0" aria-hidden="true">💬</span>
              <span>"${destino.comentario || 'Um destino incrível que vai te surpreender!'}"</span>
            </p>
          </div>
          
          <button 
            class="w-full font-bold py-2.5 px-4 rounded mt-4 text-white transition-colors duration-200 hover:opacity-90" 
            style="background-color: #E87722" 
            onclick="BENETRIP.Destinos.selecionarDestino('${encodeURIComponent(destino.destino)}', '${encodeURIComponent(destino.pais)}')"
            aria-label="Escolher ${destino.destino}, ${destino.pais} como seu destino"
          >
            Escolher Este Destino!
          </button>
        </div>
      </div>
    `;
    
    // Inserir HTML no container
    elements.destinoDestaque.innerHTML = html;
  }

  /**
   * Renderiza os destinos alternativos
   * @param {Array} alternativas - Lista de destinos alternativos
   */
  function renderizarDestinosAlternativos(alternativas) {
    if (!elements.destinosAlternativos) {
      console.error('Container de destinos alternativos não encontrado');
      return;
    }
    
    if (!Array.isArray(alternativas)) {
      console.warn('Alternativas não é um array:', alternativas);
      alternativas = [];
    }
    
    console.log('Renderizando destinos alternativos:', alternativas);
    
    // Limpar container e adicionar título
    elements.destinosAlternativos.innerHTML = '<h3 class="font-bold text-lg mt-2">Mais Destinos Incríveis</h3>';
    
    // Se não houver alternativas, exibir mensagem
    if (alternativas.length === 0) {
      elements.destinosAlternativos.innerHTML += `
        <p class="text-center mt-3 p-3 bg-gray-50 rounded">
          Não encontramos destinos alternativos para suas preferências.
        </p>
      `;
      return;
    }
    
    // Renderizar cada destino alternativo
    alternativas.forEach((destino, index) => {
      // Verificar se temos dados válidos
      if (!destino || !destino.destino || !destino.pais) {
        console.warn(`Destino alternativo ${index} inválido:`, destino);
        return;
      }
      
      // Obter a primeira imagem do destino, se disponível
      const imagem = destino.imagens && destino.imagens.length > 0 ? destino.imagens[0] : null;
      
      const card = document.createElement('div');
      card.className = 'border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 mt-4 destino-card';
      card.setAttribute('data-destino', destino.destino);
      card.setAttribute('data-pais', destino.pais);
      
      // Criar conteúdo do card
      let cardHtml = `
        <div class="flex">
          <div class="w-1/3">
      `;
      
      // Adicionar imagem com créditos ou placeholder com texto
      if (imagem) {
        cardHtml += renderImageWithCredits(
          imagem, 
          'h-full', 
          `${destino.destino}, ${destino.pais}`,
          true // Versão compacta para cards menores
        );
      } else {
        // Placeholder apenas com texto do destino
        cardHtml += `
          <div class="bg-gray-200 h-full flex items-center justify-center">
            <span class="text-gray-600 font-medium text-center px-2">
              ${destino.destino}
            </span>
          </div>
        `;
      }
      
      // Continuar com as informações do destino
      cardHtml += `
          </div>
          <div class="w-2/3 p-3">
            <div class="flex justify-between items-start">
              <h3 class="font-bold">${destino.destino}, ${destino.pais}</h3>
              <span class="text-xs font-medium px-1 py-0.5 rounded" style="background-color: #E0E0E0">
                ${destino.codigoPais || 'N/A'}
              </span>
            </div>
            <div class="mt-2 space-y-1 text-xs">
              <p class="flex items-center">
                <span class="mr-1 w-4 text-center" aria-hidden="true">✈️</span> 
                <span class="font-medium">Voo:</span> 
                <span class="ml-1">R$ ${formatarPreco(destino.preco?.voo)}</span>
              </p>
              <p class="flex items-center">
                <span class="mr-1 w-4 text-center" aria-hidden="true">🏨</span> 
                <span class="font-medium">Hotel:</span> 
                <span class="ml-1">R$ ${formatarPreco(destino.preco?.hotel)}/noite</span>
              </p>
              <p class="flex items-start mt-2">
                <span class="mr-1 w-4 text-center flex-shrink-0" aria-hidden="true">${escolherIcone(destino.tipo)}</span> 
                <span>
                  <span class="font-medium">Por que ir?:</span> 
                  <span class="ml-1">${destino.porque || 'Um destino incrível para sua próxima aventura!'}</span>
                </span>
              </p>
            </div>
          </div>
        </div>
      `;
      
      card.innerHTML = cardHtml;
      
      // Adicionar evento de clique
      card.addEventListener('click', () => {
        selecionarDestino(destino.destino, destino.pais);
      });
      
      // Adicionar ao container
      elements.destinosAlternativos.appendChild(card);
    });
  }

  /**
   * Renderiza a opção de destino surpresa
   * @param {Object} surpresa - Dados do destino surpresa (se disponível)
   */
  function renderizarOpcaoSurpresa(surpresa) {
    if (!elements.opcaoSurpresa) {
      console.error('Container de surpresa não encontrado');
      return;
    }
    
    console.log('Renderizando opção surpresa:', surpresa);
    
    // Verificar se a opção surpresa está ativa
    if (surpresa && surpresa.ativa === false) {
      elements.opcaoSurpresa.innerHTML = ''; // Não mostrar se estiver explicitamente desativado
      return;
    }
    
    elements.opcaoSurpresa.innerHTML = `
      <div class="p-4 rounded-lg mt-4 text-white" style="background-color: #E87722">
        <p class="font-bold text-lg text-center">Ainda não decidiu? Sem problemas! Clique em 'Me Surpreenda!' e eu escolho um lugar baseado nas suas vibes de viagem! 🐾</p>
        <button 
          class="w-full font-bold py-2.5 px-4 rounded mt-3 transition-colors duration-200 hover:bg-blue-600" 
          style="background-color: #00A3E0"
          onclick="BENETRIP.Destinos.verSurpresa()"
          aria-label="Ver destino surpresa recomendado"
        >
          Me Surpreenda! 🎲
        </button>
      </div>
    `;
  }

  /**
   * Renderiza uma imagem com seus respectivos créditos
   * @param {Object} imagem - Dados da imagem
   * @param {string} heightClass - Classe CSS para altura
   * @param {string} altFallback - Texto alternativo de fallback
   * @param {boolean} compacto - Se true, usa versão compacta para economizar espaço
   * @returns {string} HTML da imagem com créditos
   */
  function renderImageWithCredits(imagem, heightClass, altFallback, compacto = false) {
    if (!imagem || !imagem.url) {
      return `
        <div class="bg-gray-200 ${heightClass} flex items-center justify-center">
          <span class="text-gray-600 font-medium text-center px-2">
            ${altFallback}
          </span>
        </div>
      `;
    }
    
    // Construir HTML para imagem com créditos
    return `
      <div class="image-container ${heightClass}">
        <a href="${sanitizeURL(imagem.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="image-link">
          <img 
            src="${sanitizeURL(imagem.url)}" 
            alt="${imagem.alt || altFallback}" 
            class="w-full h-full object-cover" 
            loading="lazy"
          />
          <div class="zoom-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              ${!compacto ? '<line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line>' : ''}
            </svg>
          </div>
        </a>
        <div class="image-credit">
          ${compacto ? 'Foto: ' : 'Foto por '}
          <a href="${sanitizeURL(imagem.photographerUrl)}" target="_blank" rel="noopener noreferrer">
            ${imagem.photographer || 'Desconhecido'}
          </a>
        </div>
      </div>
    `;
  }

  /**
   * Formata um preço para exibição
   * @param {string|number} preco - Valor do preço
   * @returns {string} Preço formatado ou '?' se não disponível
   */
  function formatarPreco(preco) {
    if (!preco) return '?';
    
    // Se for string, converter para número se possível
    if (typeof preco === 'string') {
      const precoNumerico = parseFloat(preco.replace(/[^\d,.-]/g, ''));
      if (!isNaN(precoNumerico)) {
        // Formatar com separador de milhares
        return precoNumerico.toLocaleString('pt-BR');
      }
      return preco;
    }
    
    // Se for número, formatar diretamente
    if (typeof preco === 'number') {
      return preco.toLocaleString('pt-BR');
    }
    
    return '?';
  }

  /**
   * Escolhe um ícone baseado no tipo de destino
   * @param {string} tipo - Tipo de destino
   * @returns {string} Emoji correspondente ao tipo
   */
  function escolherIcone(tipo) {
    if (!tipo) return '🌆';
    
    const tipos = {
      'praia': '🏖️',
      'urbano': '🏙️',
      'natureza': '🌿',
      'montanha': '🏔️',
      'cultural': '🏛️',
      'gastronômico': '🍽️',
      'aventura': '🧗‍♂️',
      'relaxamento': '🧘‍♀️'
    };
    
    return tipos[tipo.toLowerCase()] || '🌆';
  }

  /**
   * Sanitiza uma URL para prevenir XSS
   * @param {string} url - URL para sanitizar
   * @returns {string} URL sanitizada ou URL padrão
   */
  function sanitizeURL(url) {
    if (!url) return '#';
    
    try {
      const urlObj = new URL(url);
      // Verificar se é uma URL válida com protocolo http ou https
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        return url;
      }
      throw new Error('Protocolo inválido');
    } catch (e) {
      // Se não for uma URL válida, verificar se é um caminho relativo
      if (url.startsWith('assets/') || url.startsWith('/assets/')) {
        return url;
      }
      return '#';
    }
  }

  /**
   * Navega de volta para a tela de chat
   */
  function voltarParaChat() {
    window.location.href = "chat.html";
  }

  /**
   * Seleciona um destino e prossegue para a próxima etapa
   * @param {string} destino - Nome do destino selecionado
   * @param {string} pais - País do destino
   */
  function selecionarDestino(destino, pais) {
    // Decodificar parâmetros se necessário
    destino = decodeURIComponent(destino);
    pais = decodeURIComponent(pais);
    
    console.log(`Destino selecionado: ${destino}, ${pais}`);
    
    // Salvar destino selecionado no localStorage
    localStorage.setItem('benetrip_destino_selecionado', JSON.stringify({
      destino: destino,
      pais: pais,
      data: new Date().toISOString()
    }));
    
    // Verificar se existe uma página de voos para redirecionamento
    const paginaVoos = document.querySelector('meta[name="pagina-voos"]');
    const urlVoos = paginaVoos ? paginaVoos.getAttribute('content') : 'voos.html';
    
    if (typeof BENETRIP.redirecionar === 'function') {
      // Se existir uma função de redirecionamento global, usar ela
      BENETRIP.redirecionar(urlVoos);
    } else {
      // Verificar se a página está pronta antes de redirecionar
      if (window.BENETRIP_VOOS_READY) {
        window.location.href = urlVoos;
      } else {
        // Por enquanto, apenas mostrar alerta
        alert(`Você escolheu ${destino}, ${pais}! Em breve você poderá buscar voos para este destino.`);
      }
    }
  }

  /**
   * Navega para a tela de destino surpresa
   */
  function verSurpresa() {
    console.log('Destino surpresa solicitado');
    
    // Verificar se existe uma página de surpresa para redirecionamento
    const paginaSurpresa = document.querySelector('meta[name="pagina-surpresa"]');
    const urlSurpresa = paginaSurpresa ? paginaSurpresa.getAttribute('content') : 'surpresa.html';
    
    if (typeof BENETRIP.redirecionar === 'function') {
      // Se existir uma função de redirecionamento global, usar ela
      BENETRIP.redirecionar(urlSurpresa);
    } else {
      // Verificar se a página de surpresa está disponível
      if (window.BENETRIP_SURPRESA_READY) {
        window.location.href = urlSurpresa;
      } else {
        // Por enquanto, apenas mostrar alerta
        alert('Em breve você poderá ver um destino surpresa especial!');
      }
    }
  }

  // Expor interface pública do módulo
  return {
    init: init,
    selecionarDestino: selecionarDestino,
    verSurpresa: verSurpresa,
    carregarRecomendacoes: carregarRecomendacoes
  };
})();

// Inicializar o módulo automaticamente
BENETRIP.Destinos.init();

// Para compatibilidade com código existente que pode chamar estas funções globalmente
function selecionarDestino(destino, pais) {
  BENETRIP.Destinos.selecionarDestino(destino, pais);
}

function verSurpresa() {
  BENETRIP.Destinos.verSurpresa();
}
