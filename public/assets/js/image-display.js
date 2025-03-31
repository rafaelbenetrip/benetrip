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
    }
  },
  
  // Inicialização do serviço
  init() {
    console.log('Inicializando serviço de imagens Benetrip');
    this.initialized = true;
    
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
    `;
    
    document.head.appendChild(style);
  },
  
  // Verificar se o serviço foi inicializado
  isInitialized() {
    return this.initialized === true;
  },
  
  // Tratar erro de carregamento de imagem
  handleImageError(imgElement) {
    // Verificar se a imagem já tem um fallback aplicado
    if (imgElement.dataset.fallback === 'applied') {
      return; // Evitar loop infinito de fallbacks
    }
    
    const alt = imgElement.alt || 'imagem';
    const size = imgElement.dataset.size || '400x224';
    
    // Tentar Unsplash como segunda opção
    try {
      imgElement.dataset.fallback = 'applied';
      imgElement.src = `${this.config.unsplashBaseUrl}?${encodeURIComponent(alt)}`;
      imgElement.onerror = () => {
        // Se Unsplash falhar, usar placeholder
        imgElement.src = `${this.config.placeholderUrl}${size}?text=${encodeURIComponent(alt)}`;
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
  
  // Obter URL de imagem de destino com fallbacks
  async getDestinationImageUrl(destination, country, size = 'destaque', index = 0) {
    // Verificar se temos imagens no objeto de destino
    if (destination.imagens && destination.imagens.length > index) {
      const imageUrl = destination.imagens[index].url;
      const imageExists = await this.checkImageExists(imageUrl);
      
      if (imageExists) {
        return imageUrl;
      }
    }
    
    // Fallback para Unsplash
    const unsplashUrl = `${this.config.unsplashBaseUrl}?${encodeURIComponent(destination.destino + ' ' + destination.pais)}`;
    const unsplashExists = await this.checkImageExists(unsplashUrl);
    
    if (unsplashExists) {
      return unsplashUrl;
    }
    
    // Último recurso: placeholder
    return `${this.config.placeholderUrl}${this.config.sizes[size]}?text=${encodeURIComponent(destination.destino)}`;
  },
  
  // Renderiza uma imagem com créditos
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
      sourceUrl = '#'
    } = imageData;
    
    // Opções padrão
    const { 
      width = '100%',
      height = 'auto',
      showCredits = true,
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
  
  // Renderiza múltiplas imagens em uma galeria
  renderImagesGallery(imagesData, container, options = {}) {
    if (!Array.isArray(imagesData) || imagesData.length === 0) {
      console.error('Dados de imagem não fornecidos ou inválidos');
      return null;
    }
    
    // Opções padrão
    const { 
      cols = 2,
      gap = '8px',
      aspectRatio = '16/9',
      className = ''
    } = options;
    
    // Criar container de galeria
    const galleryContainer = document.createElement('div');
    galleryContainer.className = 'images-gallery ' + className;
    galleryContainer.style.display = 'grid';
    galleryContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    galleryContainer.style.gap = gap;
    
    // Renderizar cada imagem
    imagesData.forEach(imageData => {
      this.renderImageWithCredits(imageData, galleryContainer, {
        ...options,
        width: '100%',
        height: 'auto',
        aspectRatio
      });
    });
    
    // Adicionar ao container fornecido
    container.appendChild(galleryContainer);
    
    return galleryContainer;
  },

  // Adiciona funcionalidade de renderização direta na imagem do HTML
  enhanceExistingImage(imgElement, imageData) {
    if (!imgElement || !imageData) {
      console.error('Elemento de imagem ou dados não fornecidos');
      return;
    }
    
    // Substituir src para usar URL da melhor imagem
    imgElement.src = imageData.url;
    imgElement.alt = imageData.alt || imgElement.alt;
    
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
        resultados.topPick.push({url: imagem.url, existe});
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
            resultadosAlt.push({url: imagem.url, existe});
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
        resultados.surpresa.push({url: imagem.url, existe});
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
