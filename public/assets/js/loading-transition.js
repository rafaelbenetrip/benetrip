/**
 * BENETRIP - Animação Interativa de Transição
 * Melhora a experiência de espera entre o chat e os destinos recomendados
 * Versão 1.6 - Com mapa SVG corrigido e posicionamento otimizado
 */

(function() {
  console.log('🐾 Inicializando módulo de animação de transição Benetrip...');
  
  // Referência ao objeto BENETRIP original
  const originalBENETRIP = window.BENETRIP || {};
  
  // Configurações da animação de carregamento
  const LOADING_ANIMATION = {
    // Estado e configurações
    state: {
      currentTip: 0,
      currentPosition: 0,
      discoveredCount: 0,
      progress: 0,
      isActive: false,
      dataLoaded: false,  // Flag para verificar se os dados dos destinos estão carregados
      pendingRedirect: false  // Flag para indicar redirecionamento pendente
    },
    destinations: [
      { name: 'Paris', emoji: '🗼', x: 48, y: 35 },        // Europa
      { name: 'New York', emoji: '🗽', x: 22, y: 40 },     // América do Norte
      { name: 'Tokyo', emoji: '🏯', x: 85, y: 45 },        // Ásia (Japão)
      { name: 'Rio', emoji: '🏖️', x: 32, y: 75 },         // América do Sul  
      { name: 'Cape Town', emoji: '🏔️', x: 52, y: 85 },   // África do Sul
      { name: 'Sydney', emoji: '🏄', x: 82, y: 82 },       // Oceania/Austrália
      { name: 'Bangkok', emoji: '🛕', x: 72, y: 55 },      // Ásia (Tailândia)
      { name: 'Rome', emoji: '🏛️', x: 50, y: 42 },        // Europa (Itália)
    ],
    travelTips: [
      "Sabia que as pessoas fazem mais de 1 bilhão de viagens internacionais por ano? 🌍",
      "A maioria das pessoas decide o destino de viagem em apenas 3 dias! ⏱️",
      "O Brasil tem mais de 2.000 praias ao longo de sua costa! 🏝️",
      "Paris recebe mais de 30 milhões de turistas por ano! 🗼",
      "O avião comercial mais rápido pode voar a 955 km/h! ✈️",
      "Os melhores preços de passagens costumam aparecer entre 3 e 4 meses antes da viagem! 💰",
      "As férias perfeitas duram entre 7 e 11 dias, segundo estudos! 📊"
    ],
    searchPhrases: [
      "Farejar destinos é minha especialidade! 🐕",
      "Hmmm... sinto o cheiro de praias paradisíacas! 🏝️",
      "Estou analisando as melhores opções para você! 🔍",
      "Achei um lugar incrível! Vamos ver se tem mais... 🌟",
      "Uau! Quanta coisa legal estou encontrando! 🤩"
    ],
    loadingPhases: [
      { threshold: 0, message: "Analisando suas preferências..." },
      { threshold: 30, message: "Consultando bases de dados de viagem..." },
      { threshold: 60, message: "Encontrando preços e disponibilidade..." },
      { threshold: 85, message: "Aguardando carregamento completo..." },
      { threshold: 90, message: "Organizando os resultados para você!" }
    ],
    timers: {
      progressTimer: null,
      tipTimer: null,
      positionTimer: null,
      bubbleTimer: null
    },
    
    /**
     * Exibe a animação de carregamento no chat
     */
    showLoadingAnimation() {
      console.log('🐾 Iniciando animação de carregamento...');
      
      // Se já estiver ativo, não iniciar novamente
      if (this.state.isActive) {
        console.log('🐾 Animação já está ativa, não iniciando novamente');
        return;
      }
      this.state.isActive = true;
      
      // Preservar a rolagem atual
      this.saveScrollPosition();
      
      // Criar e adicionar o container da animação
      const loadingContainer = document.createElement('div');
      loadingContainer.id = 'loading-animation-container';
      loadingContainer.className = 'loading-animation-container';
      loadingContainer.innerHTML = this.createAnimationHTML();
      
      // Adicionar os estilos CSS necessários
      this.addAnimationStyles();
      
      // Adicionar o container ao DOM
      document.body.appendChild(loadingContainer);
      console.log('🐾 Container de animação adicionado ao DOM');
      
      // Iniciar os timers de animação
      this.startAnimationTimers();
      
      // Iniciar o progresso simulado
      this.startSimulatedProgress();
      
      // Renderizar destinos no mapa
      setTimeout(() => {
        this.renderDestinationsOnMap();
      }, 100);
      
      // Detectar se está em mobile e ajustar a interface se necessário
      this.checkAndApplyMobileOptimizations();
      
      // Usar a imagem correta da Tripinha
      this.checkAndUpdateTripihaImage();
    },
    
    /**
     * Verifica e atualiza a imagem da Tripinha para garantir transparência
     */
    checkAndUpdateTripihaImage() {
      // Lista de possíveis imagens da Tripinha (em ordem de preferência)
      const possibleImages = [
        'assets/images/tripinha/avatar-farejando.png',
        'assets/images/tripinha/avatar-farejando.png',
        'assets/images/tripinha/tripinha.png',
        'assets/images/tripinha/avatar.png',
        'assets/images/avatar-tripinha.png',
        'assets/images/tripinha.png'
      ];
      
      // Testar cada imagem
      const testImage = (index) => {
        if (index >= possibleImages.length) return;
        
        const img = new Image();
        img.onload = () => {
          console.log(`🐾 Imagem encontrada: ${possibleImages[index]}`);
          // Atualizar a imagem atual
          const tripihaImage = document.querySelector('.tripinha-character img');
          if (tripihaImage) {
            tripihaImage.src = possibleImages[index];
            
            // Garantir estilos para transparência
            tripihaImage.style.objectFit = 'contain';
            tripihaImage.style.backgroundColor = 'transparent';
          }
        };
        img.onerror = () => testImage(index + 1);
        img.src = possibleImages[index];
      };
      
      // Iniciar teste de imagens
      testImage(0);
    },

    /**
     * Gera o HTML para a animação
     */
    createAnimationHTML() {
      return `
        <div class="loading-animation-inner bg-gray-50 p-4 rounded-lg shadow">
          <h2 class="text-xl font-bold text-center mb-4">A Tripinha está farejando seu próximo destino!</h2>
          
          <!-- Indicador de progresso (apenas número) -->
          <div class="progress-container mb-6">
            <div class="flex justify-between mb-1">
              <span class="loading-text text-sm font-medium">Iniciando busca...</span>
              <span class="progress-percentage text-xl font-bold" style="color: #E87722;">0%</span>
            </div>
          </div>
          
          <!-- Contador de destinos -->
          <div class="text-center mb-4">
            <span class="destinations-counter bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              0 destinos explorados
            </span>
          </div>
          
          <!-- Mapa interativo com a Tripinha -->
          <div class="world-map relative w-full h-48 bg-blue-50 rounded-lg mb-4 overflow-hidden">
            <!-- Mapa do mundo com SVG -->
            <svg class="map-background absolute inset-0 w-full h-full" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
              <!-- Oceano de fundo -->
              <rect width="400" height="200" fill="#e0f2fe"/>
              
              <!-- América do Norte -->
              <path d="M20 40 L70 35 L75 45 L90 42 L95 55 L85 65 L70 70 L50 75 L35 65 L25 50 Z" 
                    fill="#a7f3d0" stroke="#34d399" stroke-width="1"/>
              
              <!-- América do Sul -->
              <path d="M55 85 L70 80 L75 95 L72 120 L65 135 L58 140 L50 135 L48 120 L52 100 Z" 
                    fill="#a7f3d0" stroke="#34d399" stroke-width="1"/>
              
              <!-- Europa -->
              <path d="M180 45 L200 40 L210 50 L205 60 L190 65 L175 55 Z" 
                    fill="#a7f3d0" stroke="#34d399" stroke-width="1"/>
              
              <!-- África -->
              <path d="M185 70 L210 65 L215 85 L220 110 L210 130 L190 135 L175 120 L180 95 Z" 
                    fill="#a7f3d0" stroke="#34d399" stroke-width="1"/>
              
              <!-- Ásia -->
              <path d="M220 35 L280 30 L320 40 L330 55 L315 70 L290 75 L260 65 L235 55 Z" 
                    fill="#a7f3d0" stroke="#34d399" stroke-width="1"/>
              
              <!-- Oceania/Austrália -->
              <path d="M300 120 L330 115 L340 125 L335 135 L315 140 L305 130 Z" 
                    fill="#a7f3d0" stroke="#34d399" stroke-width="1"/>
              
              <!-- Algumas ilhas decorativas -->
              <circle cx="140" cy="90" r="3" fill="#a7f3d0"/>
              <circle cx="150" cy="85" r="2" fill="#a7f3d0"/>
              <circle cx="280" cy="100" r="2.5" fill="#a7f3d0"/>
            </svg>
            
            <!-- Destinos no mapa -->
            <div class="destinations-container"></div>
            
            <!-- Tripinha se movendo pelo mapa -->
            <div class="tripinha-character absolute w-12 h-12 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-in-out"
                 style="left: 50%; top: 50%; background-color: transparent;">
              <img src="assets/images/tripinha/avatar-farejando.png" 
                   alt="Tripinha farejando" 
                   class="w-full h-full object-contain"
                   style="background-color: transparent;"
                   onerror="this.onerror=null; this.src='https://placehold.co/48x48?text=🐕'">
              
              <!-- Balão de fala (inicialmente escondido) -->
              <div class="speech-bubble hidden absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white p-2 rounded-lg shadow text-xs min-w-32 text-center">
                Farejar destinos é minha especialidade! 🐕
              </div>
            </div>
          </div>
          
          <!-- Dicas de viagem -->
          <div class="travel-tip-container bg-white p-3 rounded-lg shadow-sm mb-4 min-h-16 flex items-center text-sm">
            <span class="mr-2 text-xl">💡</span>
            <p class="travel-tip">${this.travelTips[0]}</p>
          </div>
          
          <!-- Status atual -->
          <div class="loading-phase text-center text-sm text-gray-600">
            Analisando suas preferências...
          </div>
          
          <!-- Ação "Continuar no chat" -->
          <div class="mt-4 text-center text-xs text-gray-500">
            Não se preocupe, quando encontrar os melhores destinos, você será
            redirecionado automaticamente. Explorando com a Tripinha! 🐾
          </div>
        </div>
      `;
    },

    /**
     * Adiciona os estilos CSS necessários
     */
    addAnimationStyles() {
      // Verificar se os estilos já existem
      if (document.getElementById('loading-animation-styles')) return;
      
      // Criar elemento de estilo
      const style = document.createElement('style');
      style.id = 'loading-animation-styles';
      style.textContent = `
        /* Contêiner de animação */
        .loading-animation-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255, 255, 255, 0.95);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          font-family: 'Poppins', sans-serif;
          animation: fade-in 0.3s ease;
          overflow-y: auto;
        }
        
        .loading-animation-inner {
          max-width: 480px;
          width: 100%;
          overflow: hidden;
          border-radius: 16px;
        }
        
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        /* Porcentagem de progresso */
        .progress-percentage {
          color: #E87722;
          font-size: 1.5rem;
          font-weight: bold;
          transition: transform 0.2s ease;
        }
        
        /* Mapa do mundo */
        .world-map {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        
        /* Mapa com imagem */
        .map-background {
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
          border-radius: 12px;
        }
        
        /* Garantir que a imagem do mapa seja responsiva */
        .world-map img {
          border-radius: 12px;
          object-fit: cover;
          width: 100%;
          height: 100%;
        }
        
        /* Destinos no mapa */
        .destination-point {
          position: absolute;
          font-size: 20px;
          transform: translate(-50%, -50%);
          transition: all 0.5s ease;
          cursor: pointer;
          z-index: 5;
          text-shadow: 0 2px 4px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.6);
          filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));
          background: rgba(255,255,255,0.1);
          border-radius: 50%;
          padding: 2px;
          backdrop-filter: blur(2px);
        }
        
        .destination-point:hover {
          transform: translate(-50%, -50%) scale(1.2);
        }
        
        /* Animação de pulso para destinos destacados */
        .highlight-pulse {
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            text-shadow: 0 2px 4px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.6);
            background: rgba(255,255,255,0.1);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            text-shadow: 0 3px 6px rgba(255,255,255,1), 0 0 12px rgba(255,255,255,0.8);
            background: rgba(255,255,255,0.2);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            text-shadow: 0 2px 4px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.6);
            background: rgba(255,255,255,0.1);
          }
        }
        
        /* Tripinha no mapa */
        .tripinha-character {
          position: absolute;
          transition: all 1s cubic-bezier(0.68, -0.55, 0.27, 1.55);
          z-index: 10;
          background-color: transparent !important;
          /* Ajustado para um tamanho maior */
          width: calc(36px + 0.3vw);
          height: calc(36px + 0.3vw);
          min-width: 36px;
          min-height: 36px;
          max-width: 68px;
          max-height: 68px;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
        }
        
        /* Animação para a Tripinha "farejando" */
        .tripinha-character img {
          animation: sniff 1s infinite alternate;
          object-fit: contain !important;
          background-color: transparent !important;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          /* Garantir que a imagem ocupe todo o espaço disponível */
          width: 100%;
          height: 100%;
        }
        
        @keyframes sniff {
          0% {
            transform: rotate(-5deg);
          }
          100% {
            transform: rotate(5deg);
          }
        }
        
        /* Balão de fala */
        .speech-bubble {
          position: absolute;
          background-color: white;
          border-radius: 12px;
          padding: 8px 12px;
          min-width: 140px;
          text-align: center;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          z-index: 20;
          font-size: 12px;
          animation: pop-in 0.3s ease;
        }
        
        .speech-bubble::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 8px solid white;
        }
        
        @keyframes pop-in {
          0% {
            opacity: 0;
            transform: translateX(-50%) scale(0.8);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) scale(1);
          }
        }
        
        /* Dicas de viagem */
        .travel-tip-container {
          min-height: 70px;
          display: flex;
          align-items: center;
        }
        
        .travel-tip {
          transition: opacity 0.5s ease;
          animation: fade-in 0.5s ease;
        }
        
        /* Contador de destinos */
        .destinations-counter {
          display: inline-block;
          background-color: rgba(0, 163, 224, 0.1);
          color: #00A3E0;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        
        /* Ajuste do tamanho da Tripinha baseado no contador de destinos */
        .active-search .tripinha-character {
          /* Aumenta o tamanho após descobrir destinos */
          width: calc(32px + 0.5vw + 0.6vmin * var(--discovered-count, 0));
          height: calc(32px + 0.5vw + 0.6vmin * var(--discovered-count, 0));
          transition: width 0.5s ease, height 0.5s ease, left 1s cubic-bezier(0.68, -0.55, 0.27, 1.55), top 1s cubic-bezier(0.68, -0.55, 0.27, 1.55);
        }
        
        /* Mobile optimizations */
        @media (max-width: 480px) {
          .loading-animation-container {
            /* Garantir que cobre toda a visualização em dispositivos móveis */
            padding: 0;
            z-index: 2000;
          }
          
          .loading-animation-inner {
            /* Ajustes para telas pequenas */
            border-radius: 0;
            height: 100%;
            display: flex;
            flex-direction: column;
            padding: 1rem;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
          
          .world-map {
            /* Mapa menor em mobile para não ocupar muito espaço vertical */
            height: 35vh;
            max-height: 200px;
          }
          
          .travel-tip-container {
            /* Texto menor nas dicas */
            font-size: 13px;
          }
          
          .tripinha-character {
            /* Tripinha tamanho em mobile */
            width: calc(32px + 0.3vw);
            height: calc(32px + 0.3vw);
            max-width: 52px;
            max-height: 52px;
          }
          
          .speech-bubble {
            /* Balão de fala menor */
            min-width: 120px;
            padding: 6px 10px;
            font-size: 11px;
          }
          
          .destination-point {
            /* Destinos um pouco menores */
            font-size: 18px;
          }
        }
        
        /* Utility classes */
        .bg-gray-50 { background-color: #f9fafb; }
        .bg-gray-200 { background-color: #e5e7eb; }
        .bg-blue-50 { background-color: #f0f9ff; }
        .bg-blue-100 { background-color: #e0f2fe; }
        .bg-blue-200 { background-color: #bae6fd; }
        .bg-green-200 { background-color: #bbf7d0; }
        .bg-white { background-color: white; }
        .bg-gradient-to-b { background-image: linear-gradient(to bottom, var(--tw-gradient-stops)); }
        .from-blue-100 { --tw-gradient-from: #e0f2fe; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(224, 242, 254, 0)); }
        .to-blue-200 { --tw-gradient-to: #bae6fd; }
        
        .text-center { text-align: center; }
        .text-gray-600 { color: #4b5563; }
        .text-gray-500 { color: #6b7280; }
        .text-blue-800 { color: #1e40af; }
        .text-sm { font-size: 0.875rem; }
        .text-xs { font-size: 0.75rem; }
        .text-xl { font-size: 1.25rem; }
        
        .font-bold { font-weight: 700; }
        .font-medium { font-weight: 500; }
        
        .p-4 { padding: 1rem; }
        .p-3 { padding: 0.75rem; }
        .p-2 { padding: 0.5rem; }
        .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
        .px-2\\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mr-2 { margin-right: 0.5rem; }
        .mt-4 { margin-top: 1rem; }
        
        .w-full { width: 100%; }
        .h-3 { height: 0.75rem; }
        .h-48 { height: 12rem; }
        .min-h-16 { min-height: 4rem; }
        
        .rounded-lg { border-radius: 0.5rem; }
        .rounded-full { border-radius: 9999px; }
        .rounded-xl { border-radius: 0.75rem; }
        
        .shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
        .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
        
        .flex { display: flex; }
        .items-center { align-items: center; }
        .justify-between { justify-content: space-between; }
        
        .relative { position: relative; }
        .absolute { position: absolute; }
        .hidden { display: none; }
        .flex { display: flex; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .justify-between { justify-content: space-between; }
        .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
        
        .transform { transform: translateX(-50%) translateY(-50%); }
        .transition-all { transition-property: all; }
        .duration-500 { transition-duration: 500ms; }
        .duration-1000 { transition-duration: 1000ms; }
        .ease-out { transition-timing-function: cubic-bezier(0, 0, 0.2, 1); }
      `;
      
      document.head.appendChild(style);
    },

    /**
     * Salva a posição de rolagem atual para restaurar depois
     */
    saveScrollPosition() {
      this.state.scrollPosition = window.scrollY || window.pageYOffset;
      // Impede rolagem durante a animação
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${this.state.scrollPosition}px`;
      document.body.style.width = '100%';
    },

    /**
     * Restaura a posição de rolagem quando a animação é removida
     */
    restoreScrollPosition() {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, this.state.scrollPosition || 0);
    },

    /**
     * Verifica e aplica otimizações para mobile
     */
    checkAndApplyMobileOptimizations() {
      // Verificar se é um dispositivo mobile
      const isMobile = window.innerWidth <= 768;
      const isSmallHeight = window.innerHeight <= 600;
      
      if (isMobile || isSmallHeight) {
        const container = document.getElementById('loading-animation-container');
        if (container) {
          container.classList.add('mobile-view');
        }
      }
    },

    /**
     * Inicia os timers para as animações
     */
    startAnimationTimers() {
      // Timer para atualizar dicas de viagem
      this.timers.tipTimer = setInterval(() => {
        this.state.currentTip = (this.state.currentTip + 1) % this.travelTips.length;
        this.updateTravelTip();
      }, 5000);
      
      // Timer para mover a Tripinha pelo mapa
      this.timers.positionTimer = setInterval(() => {
        this.moveTripihaToNewPosition();
      }, 3000);
    },

    /**
     * Atualiza dica de viagem exibida
     */
    updateTravelTip() {
      const tipElement = document.querySelector('.travel-tip');
      if (tipElement) {
        // Animar a transição
        tipElement.style.opacity = '0';
        setTimeout(() => {
          tipElement.textContent = this.travelTips[this.state.currentTip];
          tipElement.style.opacity = '1';
        }, 300);
      }
    },

    /**
     * Simula o progresso da animação
     * Versão otimizada para evitar problemas com o progresso recuando
     */
    startSimulatedProgress() {
      let progress = 0;
      const totalTime = 20000; // 20 segundos total
      const updateInterval = 300;
      const steps = totalTime / updateInterval;
      const increment = 100 / steps;
      
      // Limite para progresso simulado - nunca ultrapassar 85% automaticamente
      const maxSimulatedProgress = 85;
      
      this.timers.progressTimer = setInterval(() => {
        // Incrementar progresso até o limite máximo simulado
        progress = Math.min(progress + increment, maxSimulatedProgress);
        
        // Se os dados estiverem prontos, permitir avançar para 100%
        if (this.state.dataLoaded && progress >= maxSimulatedProgress) {
          progress = 100;
          clearInterval(this.timers.progressTimer);
          
          setTimeout(() => {
            if (document.getElementById('loading-animation-container')) {
              this.redirectToDestinations();
            }
          }, 1500);
        }
        
        this.updateProgress(progress);
        
        // Verificar sinais externos de progresso
        if (this.state.progress > progress && this.state.progress <= maxSimulatedProgress) {
          progress = this.state.progress;
        }
        
        // Nunca permitir que o progresso simulado ultrapasse o limite se os dados não estiverem prontos
        if (!this.state.dataLoaded && progress >= maxSimulatedProgress) {
          progress = maxSimulatedProgress;
          
          // Atualizar mensagem para indicar que estamos aguardando os dados
          this.updateLoadingPhase(progress);
        }
      }, updateInterval);
    },

    /**
     * Renderiza os destinos no mapa
     */
    renderDestinationsOnMap() {
      const destinationsContainer = document.querySelector('.destinations-container');
      if (!destinationsContainer) return;
      
      destinationsContainer.innerHTML = '';
      
      this.destinations.forEach((dest, index) => {
        const destElement = document.createElement('div');
        destElement.className = 'destination-point';
        destElement.style.left = `${dest.x}%`;
        destElement.style.top = `${dest.y}%`;
        destElement.style.opacity = '0.3';
        destElement.style.transition = 'opacity 0.5s ease';
        destElement.innerHTML = `<span role="img" aria-label="${dest.name}">${dest.emoji}</span>`;
        
        destinationsContainer.appendChild(destElement);
      });
      
      // Ativar classe para controle de tamanho da Tripinha
      const worldMap = document.querySelector('.world-map');
      if (worldMap) {
        worldMap.classList.add('active-search');
      }
      
      // Definir posição inicial da Tripinha
      this.state.currentPosition = Math.floor(Math.random() * this.destinations.length);
      this.moveTripihaToInitialPosition();
    },

    /**
     * Posiciona a Tripinha na posição inicial
     */
    moveTripihaToInitialPosition() {
      const tripinhaElement = document.querySelector('.tripinha-character');
      if (!tripinhaElement) return;
      
      const dest = this.destinations[this.state.currentPosition];
      
      // Posicionar a Tripinha próximo ao destino
      const offsetX = 3; // Deslocamento menor para ficar próximo ao destino
      const offsetY = -2; // Pequeno deslocamento vertical para parecer mais natural
      tripinhaElement.style.left = `${dest.x + offsetX}%`;
      tripinhaElement.style.top = `${dest.y + offsetY}%`;
      
      // Ajustar o tamanho proporcionalmente à quantidade de destinos descobertos
      this.updateTripihaSize();
    },

    /**
     * Move a Tripinha para uma nova posição no mapa
     * Modificado para posicionar próximo aos destinos
     */
    moveTripihaToNewPosition() {
      // Escolher uma nova posição aleatória (diferente da atual)
      let newPosition;
      do {
        newPosition = Math.floor(Math.random() * this.destinations.length);
      } while (newPosition === this.state.currentPosition && this.destinations.length > 1);
      
      this.state.currentPosition = newPosition;
      
      // Atualizar posição do elemento da Tripinha
      const tripinhaElement = document.querySelector('.tripinha-character');
      if (tripinhaElement) {
        const dest = this.destinations[this.state.currentPosition];
        
        // Posicionar a Tripinha próximo ao destino, mas um pouco deslocada
        const offsetX = 3; // Deslocamento menor para ficar próximo ao destino
        const offsetY = -2; // Pequeno deslocamento vertical para parecer mais natural
        tripinhaElement.style.left = `${dest.x + offsetX}%`;
        tripinhaElement.style.top = `${dest.y + offsetY}%`;
        
        // Animar balão de fala
        this.showSpeechBubble();
        
        // Incrementar contador de destinos descobertos se o progresso for suficiente
        if (this.state.progress > 20) {
          this.incrementDiscoveredDestinations();
        }
        
        // Destacar o destino atual
        this.highlightCurrentDestination();
        
        // Atualizar o tamanho da Tripinha
        this.updateTripihaSize();
      }
    },

    /**
     * Atualiza o tamanho da Tripinha com base no número de destinos descobertos
     */
    updateTripihaSize() {
      const worldMap = document.querySelector('.world-map');
      if (worldMap) {
        // Definir uma variável CSS personalizada para controlar o tamanho
        worldMap.style.setProperty('--discovered-count', Math.min(this.state.discoveredCount / 5, 3));
      }
    },

    /**
     * Exibe o balão de fala com uma frase aleatória
     */
    showSpeechBubble() {
      const bubble = document.querySelector('.speech-bubble');
      if (!bubble) return;
      
      // Escolher uma frase aleatória
      const randomPhrase = this.searchPhrases[
        Math.floor(Math.random() * this.searchPhrases.length)
      ];
      
      // Atualizar e mostrar o balão
      bubble.textContent = randomPhrase;
      bubble.classList.remove('hidden');
      
      // Configurar timer para esconder o balão após 2 segundos
      clearTimeout(this.timers.bubbleTimer);
      this.timers.bubbleTimer = setTimeout(() => {
        bubble.classList.add('hidden');
      }, 2000);
    },

    /**
     * Destaca o destino atual no mapa
     */
    highlightCurrentDestination() {
      const destinationPoints = document.querySelectorAll('.destination-point');
      if (!destinationPoints.length) return;
      
      // Reset de todos os pontos
      destinationPoints.forEach((point, index) => {
        if (this.state.progress > 30) {
          point.style.opacity = '0.6';
        } else {
          point.style.opacity = '0.3';
        }
        point.classList.remove('highlight-pulse');
      });
      
      // Destacar o ponto atual
      if (destinationPoints[this.state.currentPosition]) {
        destinationPoints[this.state.currentPosition].style.opacity = '1';
        destinationPoints[this.state.currentPosition].classList.add('highlight-pulse');
      }
    },

    /**
     * Incrementa o contador de destinos descobertos
     * Corrigido para usar forma singular quando count=1
     */
    incrementDiscoveredDestinations() {
      this.state.discoveredCount = Math.min(this.state.discoveredCount + 1, 30);
      
      const counterElement = document.querySelector('.destinations-counter');
      if (counterElement) {
        // Usar forma singular quando count=1
        const text = this.state.discoveredCount === 1 
          ? "1 destino explorado" 
          : `${this.state.discoveredCount} destinos explorados`;
        
        counterElement.textContent = text;
      }
      
      // Atualizar o tamanho da Tripinha quando novos destinos são descobertos
      this.updateTripihaSize();
    },

    /**
     * Atualiza o progresso da animação
     * Modificado para evitar recuar o progresso
     * @param {number} progress - Valor do progresso (0-100)
     * @param {string} message - Mensagem de status opcional
     * @param {boolean} dataReady - Indica se os dados dos destinos estão prontos
     */
    updateProgress(progress, message, dataReady) {
      // Se os dados estiverem prontos, atualizar o estado
      if (dataReady === true) {
        this.state.dataLoaded = true;
        console.log('🐾 Dados dos destinos carregados com sucesso!');
        
        // Se houver um redirecionamento pendente, executá-lo agora
        if (this.state.pendingRedirect && progress >= 100) {
          setTimeout(() => {
            this.redirectToDestinations();
          }, 800);
        }
      }
      
      // Nunca permitir que o progresso recue
      if (progress < this.state.progress) {
        console.log(`🐾 Evitando recuo de progresso: ${progress}% < ${this.state.progress}%`);
        return;
      }
      
      // Limitar progresso a 85% se os dados não estiverem prontos
      if (!this.state.dataLoaded && progress > 85) {
        progress = 85;
        message = message || "Aguardando carregamento completo...";
      }
      
      // Atualizar estado
      this.state.progress = progress;
      
      // Atualizar elementos visuais
      const progressPercentage = document.querySelector('.progress-percentage');
      
      if (progressPercentage) {
        progressPercentage.textContent = `${Math.round(progress)}%`;
        
        // Animar a mudança de tamanho para dar destaque à porcentagem
        progressPercentage.style.transform = 'scale(1.1)';
        setTimeout(() => {
          progressPercentage.style.transform = 'scale(1)';
        }, 200);
      }
      
      console.log(`🐾 Progresso atualizado para ${progress}%`);
      
      // Atualizar mensagem, se fornecida
      if (message) {
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
          loadingText.textContent = message;
        }
      }
      
      // Atualizar fase de carregamento com base no threshold
      this.updateLoadingPhase(progress);
      
      // Atualizar opacidade dos destinos com base no progresso
      this.updateDestinationsVisibility(progress);
    },

    /**
     * Atualiza a fase de carregamento com base no progresso
     */
    updateLoadingPhase(progress) {
      const phaseElement = document.querySelector('.loading-phase');
      if (!phaseElement) return;
      
      // Encontrar a fase atual com base no threshold
      let currentPhase = this.loadingPhases[0];
      for (const phase of this.loadingPhases) {
        if (progress >= phase.threshold) {
          currentPhase = phase;
        }
      }
      
      phaseElement.textContent = currentPhase.message;
    },

    /**
     * Atualiza a visibilidade dos destinos no mapa com base no progresso
     */
    updateDestinationsVisibility(progress) {
      const destinationPoints = document.querySelectorAll('.destination-point');
      
      destinationPoints.forEach(point => {
        // Os destinos ficam mais visíveis à medida que o progresso avança
        if (progress > 30) {
          point.style.opacity = '0.6';
        } else {
          point.style.opacity = '0.3';
        }
      });
      
      // Destacar o ponto atual
      this.highlightCurrentDestination();
    },

    /**
     * Limpa todos os timers e finaliza a animação
     */
    clearTimers() {
      // Limpar todos os timers
      clearInterval(this.timers.tipTimer);
      clearInterval(this.timers.positionTimer);
      clearInterval(this.timers.progressTimer);
      clearTimeout(this.timers.bubbleTimer);
    },

    /**
     * Redireciona para a página de destinos apenas quando os dados estiverem prontos
     * Corrigido para evitar problemas com redirecionamento prematuro
     */
    redirectToDestinations() {
      // Garantir que redirecionamos apenas quando os dados estiverem realmente prontos
      if (!this.state.dataLoaded) {
        console.log('🐾 Tentativa de redirecionamento, mas os dados ainda não estão prontos. Aguardando...');
        this.state.pendingRedirect = true;
        
        // Manter a barra em 85% e adicionar mensagem explicativa
        this.updateProgress(85, "Aguardando carregamento dos dados...");
        return;
      }
      
      console.log('🐾 Redirecionando para a página de destinos...');
      
      // Antes de redirecionar, garantir que o progresso está em 100%
      this.updateProgress(100, "Redirecionando...");
      
      // Animar a saída
      const container = document.getElementById('loading-animation-container');
      if (container) {
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.5s ease';
      }
      
      // Limpar todos os timers
      this.clearTimers();
      
      // Restaurar o scroll e propriedades do body
      this.restoreScrollPosition();
      
      // Redirecionar após a animação de saída
      setTimeout(() => {
        window.location.href = 'destinos.html';
      }, 500);
    },

    /**
     * Remove a animação e limpa os recursos
     */
    removeAnimation() {
      // Se não estiver ativo, não fazer nada
      if (!this.state.isActive) return;
      
      this.clearTimers();
      
      // Restaurar o scroll
      this.restoreScrollPosition();
      
      const container = document.getElementById('loading-animation-container');
      if (container) {
        container.remove();
      }
      
      this.state.isActive = false;
    }
  };

  // Método para lidar com eventos de progresso
  const handleProgressEvent = function(evento) {
    if (!LOADING_ANIMATION || !document.getElementById('loading-animation-container')) return;
    
    const progress = evento.detail.progress || evento.detail.porcentagem || 0;
    const message = evento.detail.message || evento.detail.mensagem || '';
    const dataReady = evento.detail.dataReady || evento.detail.dadosProntos || false;
    
    // Se os dados estão prontos, atualizar estado interno
    if (dataReady) {
      LOADING_ANIMATION.state.dataLoaded = true;
      
      // Se o progresso já está em 100%, redirecionar após um curto delay
      if (LOADING_ANIMATION.state.progress >= 100) {
        setTimeout(() => {
          LOADING_ANIMATION.redirectToDestinations();
        }, 800);
      }
    }
    
    // Limitar o progresso a 85% enquanto os dados não estiverem prontos
    // Isso evita que a barra chegue a 100% e depois recue
    let adjustedProgress = progress;
    if (!LOADING_ANIMATION.state.dataLoaded && progress > 85) {
      adjustedProgress = 85;
      console.log('🐾 Limitando progresso a 85% enquanto aguarda dados');
    }
    
    LOADING_ANIMATION.updateProgress(adjustedProgress, message, dataReady);
  };

  // =============== MELHORIAS PARA DETECÇÃO MAIS PRECISA ===============

  // Lista de possíveis métodos que podem finalizar o questionário
  const possibleMethods = [
    'finalizarChat',
    'enviarRespostas', 
    'processarRespostasFinal',
    'responderPergunta',
    'processarRespostaFinal',
    'finalizarQuestionario',
    'enviarQuestionario',
    'concluirChat',
    'salvarRespostas',
    'iniciarBuscaDestinos'
  ];

  // Adicionar método explícito para iniciar a animação
  originalBENETRIP.iniciarAnimacaoTransicao = function() {
    console.log('🐾 Iniciando animação de transição manualmente');
    LOADING_ANIMATION.showLoadingAnimation();
    window.addEventListener('benetrip_progress', handleProgressEvent);
  };
  
  // Método para notificar que os dados dos destinos estão prontos
  originalBENETRIP.notificarDadosProntos = function() {
    console.log('🐾 Dados dos destinos carregados externamente');
    if (LOADING_ANIMATION && document.getElementById('loading-animation-container')) {
      // Disparar evento com dados atualizados e progresso de 100%
      const evento = new CustomEvent('benetrip_progress', {
        detail: {
          progress: 100,
          message: "Dados carregados! Redirecionando...",
          dataReady: true
        }
      });
      window.dispatchEvent(evento);
      
      // Se existe redirecionamento pendente e animação está ativa, executar
      if (LOADING_ANIMATION.state.pendingRedirect) {
        setTimeout(() => {
          LOADING_ANIMATION.redirectToDestinations();
        }, 800);
      }
    }
  };

  // Verificar quais métodos existem no objeto BENETRIP
  let methodFound = false;
  for (const methodName of possibleMethods) {
    if (typeof originalBENETRIP[methodName] === 'function') {
      console.log(`🐾 Método encontrado para sobrescrever: ${methodName}`);
      const originalMethod = originalBENETRIP[methodName];
      
      // Sobrescrever o método
      originalBENETRIP[methodName] = function() {
        console.log(`🐾 Método ${methodName} interceptado! Iniciando transição...`);
        
        // Exibir a animação de carregamento
        LOADING_ANIMATION.showLoadingAnimation();
        
        // Registrar listener para eventos de progresso
        window.addEventListener('benetrip_progress', handleProgressEvent);
        
        // Chamar a função original
        return originalMethod.apply(originalBENETRIP, arguments);
      };
      
      methodFound = true;
      break;
    }
  }

  // Se nenhum método conhecido for encontrado, adicionar hooks aos elementos do DOM
  if (!methodFound) {
    console.log('🐾 Nenhum método conhecido encontrado. Adicionando hooks aos elementos do DOM.');
    
    // Função para observar o DOM e detectar o fim do questionário
    const observeQuizCompletion = function() {
      // Verificar se a última pergunta foi respondida
      document.addEventListener('click', function(event) {
        // Procurar por cliques em botões de confirmação ou botões de última pergunta
        const button = event.target.closest('button');
        if (!button) return;
        
        const isConfirmButton = (
          button.classList.contains('confirm-button') || 
          button.classList.contains('confirm-text') || 
          button.classList.contains('confirm-currency') || 
          button.classList.contains('confirm-number') ||
          button.classList.contains('confirm-autocomplete') ||
          button.classList.contains('action-button-large')
        );
        
        if (isConfirmButton) {
          console.log('🐾 Clique em botão de confirmação detectado!');
          
          // Verificar se este é o último item do questionário
          // Podemos verificar se há mais perguntas pendentes ou se o questionário está concluído
          setTimeout(function() {
            // Se não aparecer uma nova pergunta após 500ms, provavelmente é a última
            const typingIndicator = document.getElementById('typing-indicator');
            const loadingIndicator = document.getElementById('loading-indicator');
            
            if ((typingIndicator && typingIndicator.style.display === 'none') || 
                (loadingIndicator && loadingIndicator.style.display !== 'none')) {
              console.log('🐾 Possível conclusão do questionário detectada!');
              
              // Verificar após um tempo maior se o estado continua indicando término
              setTimeout(function() {
                if (!LOADING_ANIMATION.state.isActive && 
                    ((loadingIndicator && loadingIndicator.style.display !== 'none') || 
                     document.querySelector('.loading-container'))) {
                  console.log('🐾 Questionário concluído! Iniciando animação de transição.');
                  originalBENETRIP.iniciarAnimacaoTransicao();
                }
              }, 1000);
            }
          }, 500);
        }
      });
    };
    
    // Iniciar observação quando o DOM estiver pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observeQuizCompletion);
    } else {
      observeQuizCompletion();
    }
  }

  // Adicionar trigger para eventos do carregador padrão
  document.addEventListener('DOMContentLoaded', function() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      // Criar um observador para detectar quando o indicador de carregamento fica visível
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes' && 
              mutation.attributeName === 'style' &&
              loadingIndicator.style.display !== 'none' &&
              !LOADING_ANIMATION.state.isActive) {
            console.log('🐾 Indicador de carregamento ativado! Iniciando animação de transição.');
            originalBENETRIP.iniciarAnimacaoTransicao();
          }
        });
      });
      
      observer.observe(loadingIndicator, { attributes: true });
    }
  });

  // Atualizar a referência global
  window.BENETRIP = originalBENETRIP;
  
  // Verificar se estamos em uma tela com tamanho que muda (como mudança de orientação)
  window.addEventListener('resize', function() {
    if (LOADING_ANIMATION.state.isActive) {
      LOADING_ANIMATION.checkAndApplyMobileOptimizations();
    }
  });
  
  console.log('🐾 Animação de transição inicializada com sucesso!');
})();
