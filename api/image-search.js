// =============================
// image-display.js - Módulo de exibição de imagens com suporte ao Google Places e Pexels
// =============================

window.BENETRIP_IMAGES = {
  config: {
    placeholderUrl: 'https://via.placeholder.com/',
    sizes: {
      destaque: '400x224',
      alternativa: '120x120',
      surpresa: '400x224'
    },
    cacheDuration: 24 * 60 * 60 * 1000, // 24h
    pontosIconicos: {}
  },

  init() {
    this.initialized = true;
    this.imageCache = this._loadCacheFromStorage() || {};
    this.injectImageCreditsCSS();
    return this;
  },

  injectImageCreditsCSS() {
    const style = document.createElement('style');
    style.textContent = `
      .image-container { position: relative; overflow: hidden; border-radius: 8px; }
      .image-credit { position: absolute; bottom: 0; right: 0; background: rgba(0,0,0,0.6); color: white; font-size: 10px; padding: 4px 8px; opacity: 0; transition: 0.3s ease; }
      .image-container:hover .image-credit { opacity: 1; }
      .tourist-spot-label { position: absolute; top: 10px; left: 10px; background: rgba(232, 119, 34, 0.85); color: white; padding: 4px 8px; font-size: 11px; border-radius: 4px; }
    `;
    document.head.appendChild(style);
  },

  _loadCacheFromStorage() {
    try {
      const cacheStr = localStorage.getItem('benetrip_images_cache');
      if (!cacheStr) return null;
      const cache = JSON.parse(cacheStr);
      if (Date.now() - cache._timestamp > this.config.cacheDuration) {
        localStorage.removeItem('benetrip_images_cache');
        return null;
      }
      return cache;
    } catch {
      return null;
    }
  },

  _saveCacheToStorage() {
    this.imageCache._timestamp = Date.now();
    const keys = Object.keys(this.imageCache).filter(k => k !== '_timestamp');
    if (keys.length > 50) keys.slice(0, keys.length - 50).forEach(k => delete this.imageCache[k]);
    localStorage.setItem('benetrip_images_cache', JSON.stringify(this.imageCache));
  },

  addToCache(key, data) {
    if (!key || !data) return;
    this.imageCache[key] = { data, timestamp: Date.now() };
    clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => this._saveCacheToStorage(), 3000);
  },

  getFromCache(key) {
    const cached = this.imageCache[key];
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.config.cacheDuration) return null;
    return cached.data;
  },

  async getDestinationImageUrl(destino, pais, pontoTuristico = null, size = 'destaque') {
    const cacheKey = `${destino}_${pontoTuristico || 'general'}_${size}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        query: `${destino}, ${pais}`,
        pontosTuristicos: pontoTuristico ? JSON.stringify([pontoTuristico]) : "[]",
        width: this.config.sizes[size].split('x')[0],
        height: this.config.sizes[size].split('x')[1]
      });

      const response = await fetch(`/api/image-search?${params.toString()}`);
      const data = await response.json();
      const image = data.images?.[0]?.url;
      if (image) {
        this.addToCache(cacheKey, image);
        return image;
      }
    } catch (err) {
      console.error('Erro ao buscar imagem:', err);
    }

    return `${this.config.placeholderUrl}${this.config.sizes[size]}?text=${encodeURIComponent(destino)}`;
  },

  renderImage(imageData, container, options = {}) {
    const {
      url, alt, pontoTuristico, source = "google_places"
    } = imageData;

    const { width = '100%', height = 'auto', className = '', showCredits = true } = options;

    const box = document.createElement('div');
    box.className = `image-container ${className}`;
    box.style.width = width;
    box.style.height = height;

    const img = document.createElement('img');
    img.src = url;
    img.alt = alt;
    img.loading = 'lazy';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';

    box.appendChild(img);

    if (pontoTuristico) {
      const label = document.createElement('div');
      label.className = 'tourist-spot-label';
      label.textContent = pontoTuristico;
      box.appendChild(label);
    }

    if (showCredits && source === 'google_places') {
      const credit = document.createElement('div');
      credit.className = 'image-credit';
      credit.textContent = 'Foto via Google Maps';
      box.appendChild(credit);
    }

    if (showCredits && source === 'pexels') {
      const credit = document.createElement('div');
      credit.className = 'image-credit';
      credit.textContent = 'Foto via Pexels';
      box.appendChild(credit);
    }

    if (container) container.appendChild(box);
    return box;
  }
};

// Inicializar no carregamento
window.BENETRIP_IMAGES.init();
