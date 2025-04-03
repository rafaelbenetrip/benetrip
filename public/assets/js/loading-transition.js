/**
 * BENETRIP - Animação Interativa de Transição
 * Melhora a experiência de espera entre o chat e os destinos recomendados
 * Versão 1.1 - Otimizada para dispositivos móveis
 */

(function() {
  // Referência ao objeto BENETRIP original
  const originalBENETRIP = window.BENETRIP || {};
  
  // Encontrar o método correto para sobrescrever
  // Poderia ser finalizarChat, enviarRespostas, processarRespostasFinal, etc.
  const originalMethod = originalBENETRIP.finalizarChat || 
                         originalBENETRIP.enviarRespostas || 
                         originalBENETRIP.processarRespostasFinal || 
                         function() { 
                           console.warn("Método de finalização não encontrado!"); 
                           window.location.href = 'destinos.html';
                         };
  
  // Configurações da animação de carregamento
  const LOADING_ANIMATION = {
    // Destinos que aparecem no mapa
    destinations: [
      { name: 'Paris', emoji: '🗼', x: 48, y: 22 },
      { name: 'New York', emoji: '🗽', x: 25, y: 28 },
      { name: 'Tokyo', emoji: '🏯', x: 82, y: 30 },
      { name: 'Rio', emoji: '🏖️', x: 35, y: 70 },
      { name: 'Cape Town', emoji: '🏔️', x: 52, y: 80 },
      { name: 'Sydney', emoji: '🏄', x: 85, y: 78 },
      { name: 'Bangkok', emoji: '🛕', x: 75, y: 45 },
      { name: 'Rome', emoji: '🏛️', x: 52, y: 32 },
    ],
    
    // Dicas divertidas de viagem
    travelTips: [
      "Sabia que as pessoas fazem mais de 1 bilhão de viagens internacionais por ano? 🌍",
      "A maioria das pessoas decide o destino de viagem em apenas 3 dias! ⏱️",
      "O Brasil tem mais de 2.000 praias ao longo de sua costa! 🏝️",
      "Paris recebe mais de 30 milhões de turistas por ano! 🗼",
      "O avião comercial mais rápido pode voar a 955 km/h! ✈️",
      "Os melhores preços de passagens costumam aparecer entre 3 e 4 meses antes da viagem! 💰",
      "As férias perfeitas duram entre 7 e 11 dias, segundo estudos! 📊"
    ],
    
    // Frases da Tripinha durante a busca
    searchPhrases: [
      "Farejar destinos é minha especialidade! 🐕",
      "Hmmm... sinto o cheiro de praias paradisíacas! 🏝️",
      "Estou analisando as melhores opções para você! 🔍",
      "Achei um lugar incrível! Vamos ver se tem mais... 🌟",
      "Uau! Quanta coisa legal estou encontrando! 🤩"
    ],
    
    // Fases de carregamento
    loadingPhases: [
      { threshold: 0, message: "Analisando suas preferências..." },
      { threshold: 30, message: "Consultando bases de dados de viagem..." },
      { threshold: 60, message: "Encontrando preços e disponibilidade..." },
      { threshold: 90, message: "Organizando os resultados para você!" }
    ],
    
    // Estado da animação
    state: {
      currentTip: 0,
      currentPosition: 0,
      discoveredCount: 0,
      progress: 0,
      isActive: false
    },
    
    // Referências para timers
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
      // Se já estiver ativo, não iniciar novamente
      if (this.state.isActive) return;
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
        
        // Ajustar tamanho da Tripinha
        const tripinha = document.querySelector('.tripinha-character');
        if (tripinha) {
          if (window.innerWidth <= 320) {
            tripinha.style.width = '36px';
            tripinha.style.height = '36px';
          } else {
            tripinha.style.width = '42px';
            tripinha.style.height = '42px';
          }
        }
        
        // Ajustar tamanho do mapa
        const worldMap = document.querySelector('.world-map');
        if (worldMap) {
          // Em modo paisagem em devices pequenos, ajustar layout
          if (isSmallHeight && window.innerWidth > window.innerHeight) {
            worldMap.style.height = '150px';
          } else if (window.innerHeight <= 568) { // iPhone SE e similares
            worldMap.style.height = '130px';
          }
        }
      }
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
     * Cria o HTML para a animação
     */
    createAnimationHTML() {
      return `
        <div class="loading-animation-inner bg-gray-50 p-4 rounded-lg shadow">
          <h2 class="text-xl font-bold text-center mb-4">A Tripinha está farejando seu próximo destino!</h2>
          
          <!-- Barra de progresso -->
          <div class="progress-container mb-6">
            <div class="flex justify-between mb-1">
              <span class="loading-text text-sm font-medium">Iniciando busca...</span>
              <span class="progress-percentage text-sm font-medium">0%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 progress-bar-container">
              <div class="progress-bar h-3 rounded-full transition-all duration-500 ease-out" 
                   style="width: 0%; background-color: #E87722;"></div>
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
            <!-- Mapa do mundo simplificado (simulado com gradientes) -->
            <div class="map-background absolute inset-0 bg-gradient-to-b from-blue-100 to-blue-200">
              <!-- Silhuetas de continentes (simuladas com elementos div) -->
              <div class="continent absolute left-[20%] top-[25%] w-[25%] h-[30%] bg-green-200 rounded-xl"></div>
              <div class="continent absolute left-[50%] top-[20%] w-[30%] h-[25%] bg-green-200 rounded-xl"></div>
              <div class="continent absolute left-[30%] top-[60%] w-[15%] h-[20%] bg-green-200 rounded-xl"></div>
              <div class="continent absolute left-[80%] top-[40%] w-[15%] h-[30%] bg-green-200 rounded-xl"></div>
              <div class="continent absolute left-[70%] top-[70%] w-[20%] h-[15%] bg-green-200 rounded-xl"></div>
            </div>
            
            <!-- Destinos no mapa -->
            <div class="destinations-container"></div>
            
            <!-- Tripinha se movendo pelo mapa -->
            <div class="tripinha-character absolute w-12 h-12 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-in-out"
                 style="left: 50%; top: 50%;">
              <img src="assets/images/tripinha/avatar-farejando.png" 
                   alt="Tripinha farejando" 
                   class="w-full h-full object-contain"
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
        
        /* Barra de progresso */
        .progress-bar-container {
          height: 12px;
          border-radius: 6px;
          overflow: hidden;
          background-color: #f1f1f1;
        }
        
        .progress-bar {
          background-color: #E87722;
          transition: width 0.5s ease-out;
          height: 100%;
          border-radius: 6px;
        }
        
        /* Mapa do mundo */
        .world-map {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        
        .map-background {
          background: linear-gradient(to bottom, #cfe7ff, #a1cfff);
        }
        
        .continent {
          background-color: rgba(144, 238, 144, 0.6);
          border-radius: 12px;
          position: absolute;
        }
        
        /* Destinos no mapa */
        .destination-point {
          position: absolute;
          font-size: 22px;
          transform: translate(-50%, -50%);
          transition: all 0.5s ease;
          cursor: pointer;
          z-index: 1;
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
            text-shadow: 0 0 0 rgba(0,0,0,0);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            text-shadow: 0 0 10px rgba(255,255,255,0.7);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            text-shadow: 0 0 0 rgba(0,0,0,0);
          }
        }
        
        /* Tripinha no mapa */
        .tripinha-character {
          position: absolute;
          transition: all 1s cubic-bezier(0.68, -0.55, 0.27, 1.55);
          z-index: 10;
        }
        
        /* Animação para a Tripinha "farejando" */
        .tripinha-character img {
          animation: sniff 1s infinite alternate;
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
            /* Tripinha um pouco menor */
            width: 10vw;
            height: 10vw;
            max-width: 48px;
            max-height: 48px;
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
        
        /* Ajustes para telas muito pequenas */
        @media (max-width: 320px) {
          .text-xl {
            font-size: 1.1rem;
          }
          
          .loading-animation-inner {
            padding: 0.75rem;
          }
          
          .world-map {
            height: 32vh;
            max-height: 160px;
          }
        }
        
        /* Estilos para garantir visibilidade em orientação landscape */
        @media (max-height: 480px) and (orientation: landscape) {
          .loading-animation-inner {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-gap: 0.75rem;
            align-items: start;
            height: auto;
          }
          
          .text-xl {
            font-size: 1rem;
            margin-bottom: 0.5rem;
          }
          
          .world-map {
            height: 60vh;
            grid-row: span 3;
          }
          
          .travel-tip-container, .progress-container {
            grid-column: 2;
            margin-bottom: 0.5rem;
          }
          
          .loading-phase, .destinations-counter {
            grid-column: 2;
          }
        }
        
        /* Ajustes para problemas de notch em iPhones */
        @supports (padding-top: env(safe-area-inset-top)) {
          .loading-animation-container {
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
            padding-left: env(safe-area-inset-left);
            padding-right: env(safe-area-inset-right);
          }
        }
        
        /* Área de toque maior */
        .destination-point {
          padding: 10px;
          margin: -10px;
        }
        
        /* Animações mais eficientes para dispositivos móveis */
        @media (prefers-reduced-motion: reduce) {
          .tripinha-character {
            transition: all 0.5s ease-out;
          }
          
          .tripinha-character img {
            animation: none;
          }
          
          .highlight-pulse {
            animation: none;
            transform: scale(1.2);
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
     * Simula o progresso da animação
     */
    startSimulatedProgress() {
      // Definir um limite de tempo total para o processo (20 segundos)
      const totalTime = 20000; 
      const updateInterval = 300; // Atualizar a cada 300ms
      const steps = totalTime / updateInterval;
      const increment = 100 / steps;
      
      let progress = 0;
      
      this.timers.progressTimer = setInterval(() => {
        // Ajuste para tornar o progresso mais realista
        // Mais rápido no início, desacelera no meio, acelera no final
        let newIncrement = increment;
        
        if (progress < 30) {
          // Fase inicial: progresso mais rápido
          newIncrement = increment * 1.5;
        } else if (progress >= 30 && progress < 70) {
          // Fase intermediária: progresso mais lento
          newIncrement = increment * 0.7;
        } else {
          // Fase final: progresso mais rápido novamente
          newIncrement = increment * 1.2;
        }
        
        progress = Math.min(progress + newIncrement, 100);
        this.updateProgress(progress);
        
        // Verificar se recebemos atualizações externas de progresso
        if (this.state.progress > progress) {
          progress = this.state.progress;
        }
        
        // Se chegou a 100%, manter por 1.5 segundos e depois redirecionar
        if (progress >= 100) {
          clearInterval(this.timers.progressTimer);
          
          setTimeout(() => {
            // Verificar se o redirecionamento já não aconteceu
            if (document.getElementById('loading-animation-container')) {
              this.redirectToDestinations();
            }
          }, 1500);
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
      
      // Definir posição inicial da Tripinha
      this.state.currentPosition = Math.floor(Math.random() * this.destinations.length);
      const tripinhaElement = document.querySelector('.tripinha-character');
      if (tripinhaElement) {
        const dest = this.destinations[this.state.currentPosition];
        tripinhaElement.style.left = `${dest.x}%`;
        tripinhaElement.style.top = `${dest.y}%`;
      }
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
     * Move a Tripinha para uma nova posição no mapa
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
        tripinhaElement.style.left = `${dest.x}%`;
        tripinhaElement.style.top = `${dest.y}%`;
        
        // Animar balão de fala
        this.showSpeechBubble();
        
        // Incrementar contador de destinos descobertos se o progresso for suficiente
        if (this.state.progress > 20) {
          this.incrementDiscoveredDestinations();
        }
        
        // Destacar o destino atual
        this.highlightCurrentDestination();
      }
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
     * Incrementa o contador de destinos descobertos
     */
    incrementDiscoveredDestinations() {
      this.state.discoveredCount = Math.min(this.state.discoveredCount + 1, 30);
      
      const counterElement = document.querySelector('.destinations-counter');
      if (counterElement) {
        counterElement.textContent = `${this.state.discoveredCount} destinos explorados`;
      }
    },
    
    /**
     * Atualiza o progresso da animação
     * @param {number} progress - Valor do progresso (0-100)
     * @param {string} message - Mensagem de status opcional
     */
    updateProgress(progress, message) {
      // Atualizar estado
      this.state.progress = progress;
      
      // Atualizar elementos visuais
      const progressBar = document.querySelector('.progress-bar');
      const progressPercentage = document.querySelector('.progress-percentage');
      
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
      
      if (progressPercentage) {
        progressPercentage.textContent = `${Math.round(progress)}%`;
      }
      
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
     * Redireciona para a página de destinos
     */
    redirectToDestinations() {
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
    
    LOADING_ANIMATION.updateProgress(progress, message);
  };
  
  // Procura pela função correta para sobrescrever
  let methodName = '';
  if (typeof originalBENETRIP.finalizarChat === 'function') {
    methodName = 'finalizarChat';
  } else if (typeof originalBENETRIP.enviarRespostas === 'function') {
    methodName = 'enviarRespostas';
  } else if (typeof originalBENETRIP.processarRespostasFinal === 'function') {
    methodName = 'processarRespostasFinal';
  }
  
  // Sobrescrever o método encontrado
  if (methodName) {
    console.log(`Sobrescrevendo método ${methodName} para adicionar animação de transição`);
    
    originalBENETRIP[methodName] = function() {
      console.log('Iniciando transição para página de destinos...');
      
      // Exibir a animação de carregamento
      LOADING_ANIMATION.showLoadingAnimation();
      
      // Registrar listener para eventos de progresso
      window.addEventListener('benetrip_progress', handleProgressEvent);
      
      // Chamar a função original após um pequeno delay para permitir que a animação seja exibida
      setTimeout(() => {
        originalMethod.apply(originalBENETRIP, arguments);
      }, 500);
    };
  } else {
    console.warn('Não foi possível encontrar um método adequado para sobrescrever. Adicionando método independente.');
    
    // Adicionar um método independente se não encontrar um para sobrescrever
    originalBENETRIP.iniciarAnimacaoTransicao = function() {
      LOADING_ANIMATION.showLoadingAnimation();
      window.addEventListener('benetrip_progress', handleProgressEvent);
    };
  }
  
  // Método para remover a animação manualmente, se necessário
  originalBENETRIP.removerAnimacaoTransicao = function() {
    LOADING_ANIMATION.removeAnimation();
    window.removeEventListener('benetrip_progress', handleProgressEvent);
  };
  
  // Método para verificar se a animação está ativa
  originalBENETRIP.animacaoTransicaoAtiva = function() {
    return LOADING_ANIMATION.state.isActive;
  };
  
  // Atualizar a referência global
  window.BENETRIP = originalBENETRIP;
  
  // Verificar se estamos em uma tela com tamanho que muda (como mudança de orientação)
  window.addEventListener('resize', function() {
    if (LOADING_ANIMATION.state.isActive) {
      LOADING_ANIMATION.checkAndApplyMobileOptimizations();
    }
  });
  
  console.log('Animação de transição inicializada com sucesso!');
})();
