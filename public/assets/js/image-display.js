/**
 * BENETRIP - Módulo de exibição e gerenciamento de imagens
 * Utilitários para carregar, exibir e verificar imagens dos destinos
 */

// Utilitário para tratar e exibir imagens de destinos
window.BENETRIP_IMAGES = {
  // Configurações do serviço
  config: {
    // URLs base para imagens de fallback
    placeholderUrl: 'https://via.placeholder.com/',
    unsplashBaseUrl: 'https://source.unsplash.com/featured/',
    // Tempo máximo para verificar se uma imagem existe
    timeoutVerify: 5000,
    // Opções de tamanhos para diferentes contextos
    sizes: {
      destaque: '400x224',
      alternativa: '120x120',
      surpresa: '400x224'
    },
    // Cache para pontos turísticos populares
    cacheDuration: 24 * 60 * 60 * 1000, // 24 horas em milissegundos
    // Mapeamento de pontos turísticos para URLs de imagens específicas de alta qualidade
    pontosIconicos: {
      "Cristo Redentor": "https://source.unsplash.com/featured/?christ+redeemer+rio",
      "Torre Eiffel": "https://source.unsplash.com/featured/?eiffel+tower+paris",
      "Coliseu": "https://source.unsplash.com/featured/?colosseum+rome",
      "Machu Picchu": "https://source.unsplash.com/featured/?machu+picchu",
      "Taj Mahal": "https://source.unsplash.com/featured/?taj+mahal",
      "Times Square": "https://source.unsplash.com/featured/?times+square+new+york",
      "Sagrada Família": "https://source.unsplash.com/featured/?sagrada+familia+barcelona"
    }
  },
  
  // Inicialização do serviço
  init() {
    console.log('Inicializando serviço de imagens Benetrip');
    this.initialized = true;
    
    // Inicializar cache
    this.imageCache = this._loadCacheFromStorage() || {};
    
    // Adicionar handler global para erros de imagem
    document.addEventListener('error', (event) => {
      if (event.target.tagName.toLowerCase() === 'img') {
        this.handleImageError(event.target);
      }
    }, true); // Usar fase de captura para pegar erros antes de chegarem ao elemento
    
    // Injetar CSS para créditos de imagens
    this.injectImageCreditsCSS();
    
    return this;
  },
  
  // Injetar CSS para os créditos de imagens
  injectImageCreditsCSS() {
    const style = document.createElement('style');
    style.textContent = `
      /* Estilos para créditos de imagens */
      .image-container {
        position: relative;
        overflow: hidden;
        border-radius: 8px;
      }

      .image-credit {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background-color: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 4px 8px;
        font-size: 10px;
        transition: opacity 0.3s ease;
        opacity: 0;
        text-align: right;
      }

      .image-container:hover .image-credit {
        opacity: 1;
      }

      .image-credit a {
        color: #ffffff;
        text-decoration: underline;
      }

      .image-link {
        display: block;
        position: relative;
        cursor: pointer;
        width: 100%;
        height: 100%;
      }

      .image-link::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.1);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .image-link:hover::after {
        opacity: 1;
      }

      .zoom-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(255, 255, 255, 0.7);
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .image-link:hover .zoom-icon {
        opacity: 1;
      }
      
      /* Estilos para rótulos de pontos turísticos */
      .tourist-spot-label {
        position: absolute;
        top: 10px;
        left: 10px;
        background-color: rgba(232, 119, 34, 0.85);
        color: white;
        padding: 4px 8px;
        font-size: 11px;
        border-radius: 4px;
        max-width: 90%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        z-index: 5;
      }
      
      /* Galeria com imagens variáveis */
      .images-gallery-variable {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }
      
      .images-gallery-variable.has-multiple {
        grid-template-columns: repeat(2, 1fr);
      }
      
      @media (max-width: 480px) {
        .images-gallery-variable.has-multiple {
          grid-template-columns: 1fr;
        }
      }
    `;
    
    document.head.appendChild(style);
  },
  
  // Verificar se o serviço foi inicializado
  isInitialized() {
    return this.initialized === true;
  },
  
  // Carregar cache de imagens do localStorage
  _loadCacheFromStorage() {
    try {
      const cacheStr = localStorage.getItem('benetrip_images_cache');
      if (!cacheStr) return null;
      
      const cache = JSON.parse(cacheStr);
      
      // Verificar se o cache expirou
      if (cache._timestamp && (Date.now() - cache._timestamp > this.config.cacheDuration)) {
        console.log('Cache de imagens expirado, resetando');
        localStorage.removeItem('benetrip_images_cache');
        return null;
      }
      
      return cache;
    } catch (error) {
      console.error('Erro ao carregar cache de imagens:', error);
      return null;
    }
  },
  
  // Salvar cache de imagens no localStorage
  _saveCacheToStorage() {
    try {
      // Adicionar timestamp para controle de expiração
      this.imageCache._timestamp = Date.now();
      
      // Limitar o tamanho do cache (apenas 50 entradas mais recentes)
      const keys = Object.keys(this.imageCache).filter(k => k !== '_timestamp');
      if (keys.length > 50) {
        const keysToRemove = keys.slice(0, keys.length - 50);
        keysToRemove.forEach(key => delete this.imageCache[key]);
      }
      
      localStorage.setItem('benetrip_images_cache', JSON.stringify(this.imageCache));
    } catch (error) {
      console.error('Erro ao salvar cache de imagens:', error);
    }
  },
  
  // Adicionar imagem ao cache
  addToCache(key, imageData) {
    if (!key || !imageData) return;
    
    this.imageCache[key] = {
      data: imageData,
      timestamp: Date.now()
    };
    
    // Salvar no localStorage periodicamente (evitar sobrecarga)
    if (!this._saveTimeout) {
      this._saveTimeout = setTimeout(() => {
        this._saveCacheToStorage();
        this._saveTimeout = null;
      }, 5000);
    }
  },
  
  // Obter imagem do cache
  getFromCache(key) {
    if (!key || !this.imageCache[key]) return null;
    
    // Verificar validade do cache
    const entry = this.imageCache[key];
    if (Date.now() - entry.timestamp > this.config.cacheDuration) {
      delete this.imageCache[key];
      return null;
    }
    
    return entry.data;
  },
  
  // Tratar erro de carregamento de imagem com suporte a pontos turísticos
  handleImageError(imgElement) {
    // Verificar se a imagem já tem um fallback aplicado
    if (imgElement.dataset.fallback === 'applied') {
      return; // Evitar loop infinito de fallbacks
    }
    
    const alt = imgElement.alt || 'imagem';
    const size = imgElement.dataset.size || '400x224';
    const pontoTuristico = imgElement.dataset.pontoTuristico;
    
    // Verificar se temos um ponto turístico icônico
    if (pontoTuristico && this.config.pontosIconicos[pontoTuristico]) {
      imgElement.dataset.fallback = 'applied';
      imgElement.src = this.config.pontosIconicos[pontoTuristico];
      return;
    }
    
    // Tentar Unsplash como segunda opção
    try {
      imgElement.dataset.fallback = 'applied';
      let query = alt;
      
      // Se temos um ponto turístico, usá-lo na consulta
      if (pontoTuristico) {
        query = `${pontoTuristico} ${alt}`;
      }
      
      imgElement.src = `${this.config.unsplashBaseUrl}?${encodeURIComponent(query)}`;
      imgElement.onerror = () => {
        // Se Unsplash falhar, usar placeholder
        imgElement.src = `${this.config.placeholderUrl}${size}?text=${encodeURIComponent(query)}`;
      };
    } catch (error) {
      console.error('Erro ao aplicar fallback de imagem:', error);
      imgElement.src = `${this.config.placeholderUrl}${size}?text=${encodeURIComponent(alt)}`;
    }
  },
  
  // Verificar se uma imagem existe e pode ser carregada
  checkImageExists(url, timeout = this.config.timeoutVerify) {
    return new Promise((resolve) => {
      if (!url || url.includes('undefined')) {
        resolve(false);
        return;
      }
      
      const img = new Image();
      
      // Definir timeout
      const timer = setTimeout(() => {
        img.src = '';  // Aborta carregamento
        resolve(false);
      }, timeout);
      
      img.onload = function() {
        clearTimeout(timer);
        resolve(true);
      };
      
      img.onerror = function() {
        clearTimeout(timer);
        resolve(false);
      };
      
      img.src = url;
    });
  },
  
  // Obter URL de imagem de destino com fallbacks e suporte a pontos turísticos
  async getDestinationImageUrl(destination, country, size = 'destaque', index = 0) {
    // Verificar se temos pontos turísticos específicos
    const pontoTuristico = destination.pontosTuristicos && destination.pontosTuristicos.length > index 
                          ? destination.pontosTuristicos[index] 
                          : null;
    
    // Verificar se temos a imagem no cache
    const cacheKey = `${destination.destino}_${pontoTuristico || 'general'}_${size}`;
    const cachedImage = this.getFromCache(cacheKey);
    if (cachedImage) {
      return cachedImage;
    }
    
    // Verificar se temos um ponto turístico icônico mapeado
    if (pontoTuristico && this.config.pontosIconicos[pontoTuristico]) {
      const iconicUrl = this.config.pontosIconicos[pontoTuristico];
      this.addToCache(cacheKey, iconicUrl);
      return iconicUrl;
    }
    
    // Verificar se temos imagens no objeto de destino
    if (destination.imagens && destination.imagens.length > index) {
      const imageUrl = destination.imagens[index].url;
      const imageExists = await this.checkImageExists(imageUrl);
      
      if (imageExists) {
        this.addToCache(cacheKey, imageUrl);
        return imageUrl;
      }
    }
    
    // Fallback para Unsplash com ponto turístico
    let unsplashQuery = `${destination.destino} ${destination.pais}`;
    if (pontoTuristico) {
      unsplashQuery = `${pontoTuristico} ${destination.destino}`;
    }
    
    const unsplashUrl = `${this.config.unsplashBaseUrl}?${encodeURIComponent(unsplashQuery)}`;
    const unsplashExists = await this.checkImageExists(unsplashUrl);
    
    if (unsplashExists) {
      this.addToCache(cacheKey, unsplashUrl);
      return unsplashUrl;
    }
    
    // Último recurso: placeholder
    const placeholderText = pontoTuristico 
                          ? `${pontoTuristico} em ${destination.destino}` 
                          : destination.destino;
    
    const placeholderUrl = `${this.config.placeholderUrl}${this.config.sizes[size]}?text=${encodeURIComponent(placeholderText)}`;
    return placeholderUrl;
  },
  
  // Renderiza uma imagem com créditos e ponto turístico (quando disponível)
  renderImageWithCredits(imageData, container, options = {}) {
    if (!imageData) {
      console.error('Dados de imagem não fornecidos');
      return null;
    }
    
    const { 
      url, 
      alt, 
      photographer, 
      photographerUrl = '#',
      sourceUrl = '#',
      pontoTuristico = null
    } = imageData;
    
    // Opções padrão
    const { 
      width = '100%',
      height = 'auto',
      showCredits = true,
      showPontoTuristico = true,
      clickable = true,
      aspectRatio = '16/9',
      className = ''
    } = options;
    
    // Criar elemento container
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-container ' + className;
    imageContainer.style.width = width;
    imageContainer.style.height = height;
    imageContainer.style.aspectRatio = aspectRatio;
    
    // Criar link para a fonte original
    const link = document.createElement('a');
    link.href = sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'image-link';
    link.setAttribute('aria-label', `Ver imagem original de ${alt} por ${photographer}`);
    
    // Criar elemento de imagem
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt || 'Imagem do destino';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.loading = 'lazy';
    img.dataset.photographer = photographer;
    img.dataset.source = sourceUrl;
    
    // Adicionar o ponto turístico como dataset para uso em fallbacks
    if (pontoTuristico) {
      img.dataset.pontoTuristico = pontoTuristico;
    }
    
    // Adicionar ícone de zoom se clicável
    if (clickable) {
      const zoomIcon = document.createElement('div');
      zoomIcon.className = 'zoom-icon';
      zoomIcon.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="11" y1="8" x2="11" y2="14"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
      `;
      link.appendChild(zoomIcon);
    }
    
    // Adicionar imagem ao link
    link.appendChild(img);
    
    // Adicionar link ao container
    imageContainer.appendChild(link);
    
    // Adicionar rótulo de ponto turístico se disponível e solicitado
    if (showPontoTuristico && pontoTuristico) {
      const labelElement = document.createElement('div');
      labelElement.className = 'tourist-spot-label';
      labelElement.textContent = pontoTuristico;
      imageContainer.appendChild(labelElement);
    }
    
    // Adicionar elemento de créditos se solicitado
    if (showCredits && photographer) {
      const creditElement = document.createElement('div');
      creditElement.className = 'image-credit';
      
      if (photographerUrl && photographerUrl !== '#') {
        creditElement.innerHTML = `Foto por <a href="${photographerUrl}" target="_blank" rel="noopener noreferrer">${photographer}</a>`;
      } else {
        creditElement.textContent = `Foto por ${photographer}`;
      }
      
      imageContainer.appendChild(creditElement);
    }
    
    // Adicionar ao container fornecido
    if (container) {
      container.appendChild(imageContainer);
    }
    
    return imageContainer;
  },
  
  // Renderiza múltiplas imagens em uma galeria, com quantidade variável
  renderImagesGallery(imagesData, container, options = {}) {
    if (!Array.isArray(imagesData)) {
      console.error('Dados de imagem não fornecidos ou inválidos');
      return null;
    }
    
    // Filtrar para remover imagens inválidas
    const validImages = imagesData.filter(img => img && img.url);
    
    if (validImages.length === 0) {
      console.warn('Nenhuma imagem válida para exibir');
      return null;
    }
    
    // Opções padrão
    const { 
      gap = '8px',
      aspectRatio = '16/9',
      className = '',
      showPontosTuristicos = true
    } = options;
    
    // Criar container de galeria
    const galleryContainer = document.createElement('div');
    galleryContainer.className = `images-gallery-variable ${className} ${validImages.length > 1 ? 'has-multiple' : ''}`;
    galleryContainer.style.gap = gap;
    
    // Renderizar cada imagem
    validImages.forEach((imageData, index) => {
      this.renderImageWithCredits(imageData, galleryContainer, {
        ...options,
        width: '100%',
        height: 'auto',
        aspectRatio,
        showPontoTuristico: showPontosTuristicos && imageData.pontoTuristico
      });
    });
    
    // Adicionar ao container fornecido
    if (container) {
      container.appendChild(galleryContainer);
    }
    
    return galleryContainer;
  },

  // Adiciona funcionalidade de renderização direta na imagem do HTML
  // com suporte a pontos turísticos
  enhanceExistingImage(imgElement, imageData) {
    if (!imgElement || !imageData) {
      console.error('Elemento de imagem ou dados não fornecidos');
      return;
    }
    
    // Substituir src para usar URL da melhor imagem
    imgElement.src = imageData.url;
    imgElement.alt = imageData.alt || imgElement.alt;
    
    // Adicionar o ponto turístico como dataset para uso em fallbacks
    if (imageData.pontoTuristico) {
      imgElement.dataset.pontoTuristico = imageData.pontoTuristico;
    }
    
    // Verificar se a imagem já está em um container
    let container = imgElement.parentElement;
    const alreadyEnhanced = container.classList.contains('image-container');
    
    // Se não estiver em um container com a classe correta, criar um novo
    if (!alreadyEnhanced) {
      // Criar novo container mantendo características do img existente
      const width = imgElement.style.width || imgElement.width || '100%';
      const height = imgElement.style.height || imgElement.height || 'auto';
      
      // Substituir a imagem por uma versão melhorada
      const newContainer = document.createElement('div');
      newContainer.className = 'image-container';
      newContainer.style.width = width;
      newContainer.style.height = height;
      
      // Criar link
      const link = document.createElement('a');
      link.href = imageData.sourceUrl || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'image-link';
      
      // Mover a imagem para o link
      container.replaceChild(newContainer, imgElement);
      link.appendChild(imgElement);
      newContainer.appendChild(link);
      
      container = newContainer;
      
      // Adicionar ícone de zoom
      const zoomIcon = document.createElement('div');
      zoomIcon.className = 'zoom-icon';
      zoomIcon.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="11" y1="8" x2="11" y2="14"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
      `;
      link.appendChild(zoomIcon);
    }
    
    // Adicionar rótulo de ponto turístico se disponível
    if (imageData.pontoTuristico) {
      // Verificar se já existe um rótulo
      let labelElement = container.querySelector('.tourist-spot-label');
      
      if (!labelElement) {
        labelElement = document.createElement('div');
        labelElement.className = 'tourist-spot-label';
        container.appendChild(labelElement);
      }
      
      labelElement.textContent = imageData.pontoTuristico;
    }
    
    // Adicionar créditos
    if (imageData.photographer) {
      let creditElement = container.querySelector('.image-credit');
      
      if (!creditElement) {
        creditElement = document.createElement('div');
        creditElement.className = 'image-credit';
        container.appendChild(creditElement);
      }
      
      if (imageData.photographerUrl && imageData.photographerUrl !== '#') {
        creditElement.innerHTML = `Foto por <a href="${imageData.photographerUrl}" target="_blank" rel="noopener noreferrer">${imageData.photographer}</a>`;
      } else {
        creditElement.textContent = `Foto por ${imageData.photographer}`;
      }
    }
    
    return container;
  },
  
  // Verificar imagens de todos os destinos nas recomendações
  async checkAllDestinationImages(recomendacoes) {
    console.log("Verificando imagens de todos os destinos...");
    const resultados = {
      topPick: [],
      alternativas: [],
      surpresa: []
    };
    
    // Verificar destino principal
    if (recomendacoes.topPick?.imagens) {
      console.log(`Verificando ${recomendacoes.topPick.imagens.length} imagens para ${recomendacoes.topPick.destino}`);
      for (const imagem of recomendacoes.topPick.imagens) {
        const existe = await this.checkImageExists(imagem.url);
        resultados.topPick.push({
          url: imagem.url, 
          existe,
          pontoTuristico: imagem.pontoTuristico
        });
      }
    } else {
      console.log("Destino principal não tem imagens");
    }
    
    // Verificar alternativas
    if (recomendacoes.alternativas) {
      for (const alt of recomendacoes.alternativas) {
        if (alt.imagens) {
          console.log(`Verificando ${alt.imagens.length} imagens para ${alt.destino}`);
          const resultadosAlt = [];
          for (const imagem of alt.imagens) {
            const existe = await this.checkImageExists(imagem.url);
            resultadosAlt.push({
              url: imagem.url, 
              existe,
              pontoTuristico: imagem.pontoTuristico
            });
          }
          resultados.alternativas.push({
            destino: alt.destino,
            resultados: resultadosAlt
          });
        } else {
          console.log(`Alternativa ${alt.destino} não tem imagens`);
        }
      }
    }
    
    // Verificar surpresa
    if (recomendacoes.surpresa?.imagens) {
      console.log(`Verificando ${recomendacoes.surpresa.imagens.length} imagens para ${recomendacoes.surpresa.destino}`);
      for (const imagem of recomendacoes.surpresa.imagens) {
        const existe = await this.checkImageExists(imagem.url);
        resultados.surpresa.push({
          url: imagem.url, 
          existe,
          pontoTuristico: imagem.pontoTuristico
        });
      }
    } else {
      console.log("Destino surpresa não tem imagens");
    }
    
    console.log("Resultados da verificação de imagens:", resultados);
    return resultados;
  },
  
  // Pré-carregar imagens para melhorar performance
  preloadImages(recomendacoes) {
    if (!recomendacoes) return;
    
    const imageUrls = [];
    
    // Coletar URLs de imagens do destino principal
    if (recomendacoes.topPick?.imagens) {
      recomendacoes.topPick.imagens.forEach(img => {
        if (img.url) imageUrls.push(img.url);
      });
    }
    
    // Coletar URLs de imagens das alternativas
    if (recomendacoes.alternativas) {
      recomendacoes.alternativas.forEach(alt => {
        if (alt.imagens) {
          alt.imagens.forEach(img => {
            if (img.url) imageUrls.push(img.url);
          });
        }
      });
    }
    
    // Coletar URLs de imagens do destino surpresa
    if (recomendacoes.surpresa?.imagens) {
      recomendacoes.surpresa.imagens.forEach(img => {
        if (img.url) imageUrls.push(img.url);
      });
    }
    
    // Pré-carregar imagens
    if (imageUrls.length > 0) {
      console.log(`Pré-carregando ${imageUrls.length} imagens...`);
      imageUrls.forEach(url => {
        const img = new Image();
        img.src = url;
      });
    }
  },
  
  // NOVA FUNÇÃO: Renderizar um destino com suas imagens de pontos turísticos
  renderDestinationWithImages(destination, container, options = {}) {
    if (!destination || !container) {
      console.error('Destino ou container não fornecidos');
      return null;
    }
    
    // Opções padrão
    const {
      showImagens = true,
      maxImagens = 2, // Por padrão, exibir até 2 imagens
      className = '',
      aspectRatio = '16/9'
    } = options;
    
    // Criar container para o destino
    const destinationContainer = document.createElement('div');
    destinationContainer.className = `destination-container ${className}`;
    
    // Adicionar informações do destino
    const infoContainer = document.createElement('div');
    infoContainer.className = 'destination-info';
    infoContainer.innerHTML = `
      <h3>${destination.destino}, ${destination.pais}</h3>
      <p class="description">${destination.descricao || destination.porque || ''}</p>
    `;
    
    destinationContainer.appendChild(infoContainer);
    
    // Adicionar imagens se disponíveis e solicitadas
    if (showImagens && destination.imagens && destination.imagens.length > 0) {
      const imagesToShow = destination.imagens.slice(0, maxImagens);
      
      this.renderImagesGallery(imagesToShow, destinationContainer, {
        aspectRatio,
        showPontosTuristicos: true
      });
    }
    
    // Adicionar ao container fornecido
    container.appendChild(destinationContainer);
    
    return destinationContainer;
  },
  
  // Método para adicionar botão de debug na interface
  addDebugButton() {
    const btn = document.createElement('button');
    btn.textContent = '🔍 Debug Imagens';
    btn.style.position = 'fixed';
    btn.style.bottom = '10px';
    btn.style.left = '10px';
    btn.style.zIndex = '9999';
    btn.style.background = '#E87722';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '4px';
    btn.style.padding = '8px';
    btn.style.fontSize = '12px';
    btn.style.cursor = 'pointer';
    
    btn.addEventListener('click', async () => {
      // Buscar recomendações do localStorage
      try {
        const recomendacoesStr = localStorage.getItem('benetrip_recomendacoes');
        if (recomendacoesStr) {
          const recomendacoes = JSON.parse(recomendacoesStr);
          await this.checkAllDestinationImages(recomendacoes);
          alert('Verificação de imagens concluída, verifique o console!');
        } else {
          alert('Nenhuma recomendação encontrada no localStorage!');
        }
      } catch (e) {
        console.error('Erro ao debugar imagens:', e);
        alert('Erro ao verificar imagens: ' + e.message);
      }
    });
    
    document.body.appendChild(btn);
  }
};

// Inicializar o serviço de imagens
window.BENETRIP_IMAGES.init();

// Adicionar o botão de debug em ambiente de desenvolvimento
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  document.addEventListener('DOMContentLoaded', () => {
    window.BENETRIP_IMAGES.addDebugButton();
  });
}

// Compatibilidade com BENETRIP_IMAGE_DISPLAY para métodos já implementados
window.BENETRIP_IMAGE_DISPLAY = {
  init() {
    // Já foi inicializado pelo BENETRIP_IMAGES
    return window.BENETRIP_IMAGES;
  },
  
  // Repassar métodos para BENETRIP_IMAGES
  renderImageWithCredits(imageData, container, options = {}) {
    return window.BENETRIP_IMAGES.renderImageWithCredits(imageData, container, options);
  },
  
  renderImagesGallery(imagesData, container, options = {}) {
    return window.BENETRIP_IMAGES.renderImagesGallery(imagesData, container, options);
  },
  
  isInitialized() {
    return window.BENETRIP_IMAGES.isInitialized();
  }
};

// Expor para uso global em outros scripts
window.ImageDebugTools = window.BENETRIP_IMAGES;
