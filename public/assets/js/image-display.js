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
    
    return this;
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

// Expor para uso global em outros scripts
window.ImageDebugTools = window.BENETRIP_IMAGES;
