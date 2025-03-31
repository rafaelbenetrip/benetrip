/**
 * Componente para exibição de imagens com créditos
 * Inclua este código no seu arquivo principal de JavaScript ou em um arquivo separado
 */
window.BENETRIP_IMAGES = {
  init() {
    // Inicializar listeners para modal de imagens
    this.setupImageModals();
    return this;
  },

  // Configurar modais de imagem e exibição de créditos
  setupImageModals() {
    // Adicionar evento de clique para todas as imagens de destino
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // Verificar se o elemento clicado é uma imagem de destino
      if (target.classList.contains('destino-img')) {
        event.preventDefault();
        
        // Extrair informações de crédito da imagem
        const imageUrl = target.getAttribute('src');
        const photographer = target.getAttribute('data-photographer') || 'Fotógrafo não especificado';
        const source = target.getAttribute('data-source') || 'Fonte desconhecida';
        const sourceUrl = target.getAttribute('data-source-url') || '#';
        const alt = target.getAttribute('alt') || 'Imagem de destino';
        
        // Exibir modal ou popup com a imagem ampliada e créditos
        this.showImageModal(imageUrl, photographer, source, sourceUrl, alt);
      }
    });
    
    // Adicionar evento para fechar modal ao clicar fora
    document.addEventListener('click', (event) => {
      const modal = document.getElementById('benetrip-image-modal');
      if (modal && event.target.id === 'benetrip-image-modal') {
        this.closeImageModal();
      }
    });
    
    // Adicionar evento para fechar modal com tecla ESC
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.closeImageModal();
      }
    });
  },
  
  // Exibir modal com imagem ampliada e créditos
  showImageModal(imageUrl, photographer, source, sourceUrl, alt) {
    // Remover modal existente se houver
    this.closeImageModal();
    
    // Criar elemento de modal
    const modal = document.createElement('div');
    modal.id = 'benetrip-image-modal';
    modal.classList.add('benetrip-modal');
    
    // Adicionar estilos inline
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';
    
    // Criar container para imagem e créditos
    const container = document.createElement('div');
    container.classList.add('modal-container');
    container.style.maxWidth = '80%';
    container.style.maxHeight = '80%';
    container.style.position = 'relative';
    
    // Adicionar imagem
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = alt;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '80vh';
    img.style.objectFit = 'contain';
    
    // Adicionar botão de fechar
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '10px';
    closeBtn.style.right = '10px';
    closeBtn.style.backgroundColor = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = 'white';
    closeBtn.style.fontSize = '30px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => this.closeImageModal();
    
    // Adicionar créditos
    const credits = document.createElement('div');
    credits.classList.add('image-credits');
    credits.style.color = 'white';
    credits.style.padding = '10px';
    credits.style.textAlign = 'center';
    credits.style.marginTop = '10px';
    
    // Formatar os créditos
    if (source.toLowerCase() === 'unsplash' || source.toLowerCase() === 'pexels') {
      // Adicionar link para a origem se for Unsplash ou Pexels
      credits.innerHTML = `Foto por <strong>${photographer}</strong> via <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" style="color: #e87722; text-decoration: underline;">${source}</a>`;
    } else {
      // Sem link para outras fontes
      credits.innerHTML = `Foto por <strong>${photographer}</strong> via ${source}`;
    }
    
    // Montar o modal
    container.appendChild(img);
    container.appendChild(closeBtn);
    modal.appendChild(container);
    modal.appendChild(credits);
    
    // Adicionar ao documento
    document.body.appendChild(modal);
    
    // Impedir rolagem da página enquanto o modal estiver aberto
    document.body.style.overflow = 'hidden';
  },
  
  // Fechar modal de imagem
  closeImageModal() {
    const modal = document.getElementById('benetrip-image-modal');
    if (modal) {
      modal.remove();
      document.body.style.overflow = '';
    }
  },
  
  // Adicionar créditos de imagem em um elemento
  addImageCredits(containerEl, images) {
    if (!containerEl || !images || !images.length) return;
    
    // Remover créditos anteriores se existirem
    const existingCredits = containerEl.querySelector('.image-credits-footer');
    if (existingCredits) {
      existingCredits.remove();
    }
    
    // Criar elemento para créditos
    const credits = document.createElement('div');
    credits.classList.add('image-credits-footer');
    credits.style.fontSize = '0.7rem';
    credits.style.color = '#666';
    credits.style.marginTop = '5px';
    credits.style.textAlign = 'right';
    
    // Adicionar texto de crédito para a primeira imagem
    if (images[0]) {
      const { photographer, source } = images[0];
      credits.textContent = `Foto: ${photographer} via ${source}`;
    }
    
    // Adicionar ao container
    containerEl.appendChild(credits);
  },
  
  // Renderizar imagens para um destino específico
  renderDestinationImages(containerEl, images, destino) {
    if (!containerEl || !images || !images.length) return;
    
    // Limpar container
    containerEl.innerHTML = '';
    
    // Determinar quantas imagens mostrar
    const numImages = Math.min(images.length, 2); // Mostrar até 2 imagens
    
    // Criar wrapper de imagens
    const imagesWrapper = document.createElement('div');
    imagesWrapper.classList.add('destination-images');
    imagesWrapper.style.position = 'relative';
    imagesWrapper.style.overflow = 'hidden';
    imagesWrapper.style.borderRadius = '8px';
    
    // Adicionar imagens
    for (let i = 0; i < numImages; i++) {
      const imageData = images[i];
      if (!imageData) continue;
      
      const imgContainer = document.createElement('div');
      imgContainer.style.position = numImages > 1 ? 'relative' : 'block';
      imgContainer.style.width = numImages > 1 ? '50%' : '100%';
      imgContainer.style.height = numImages > 1 ? '200px' : '250px';
      imgContainer.style.display = 'inline-block';
      imgContainer.style.overflow = 'hidden';
      
      const img = document.createElement('img');
      img.classList.add('destino-img');
      img.src = imageData.url;
      img.alt = imageData.alt || `${destino}`;
      img.setAttribute('data-photographer', imageData.photographer || 'Desconhecido');
      img.setAttribute('data-source', imageData.source || 'Desconhecido');
      img.setAttribute('data-source-url', imageData.sourceUrl || '#');
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.cursor = 'pointer';
      
      imgContainer.appendChild(img);
      imagesWrapper.appendChild(imgContainer);
    }
    
    // Adicionar ao container
    containerEl.appendChild(imagesWrapper);
    
    // Adicionar créditos em rodapé pequeno
    this.addImageCredits(containerEl, images);
    
    return containerEl;
  }
};

// Inicializar o serviço quando o script for carregado
document.addEventListener('DOMContentLoaded', () => {
  window.BENETRIP_IMAGES.init();
});

// Adicionar estilos necessários
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .destino-img {
      transition: transform 0.3s ease;
    }
    
    .destino-img:hover {
      transform: scale(1.05);
    }
    
    .image-credits-footer {
      opacity: 0.7;
      transition: opacity 0.3s ease;
    }
    
    .destination-images:hover .image-credits-footer {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
})();
