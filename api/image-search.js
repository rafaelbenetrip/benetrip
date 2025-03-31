// api/image-search.js - Endpoint Vercel para busca de imagens
const axios = require('axios');

// Função de logging estruturado
function logEvent(type, message, data = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    message,
    ...data
  };
  
  // Em produção, substituir por um sistema de logging mais robusto
  console.log(JSON.stringify(log));
  
  return log;
}

// Função para buscar imagens do Unsplash
async function fetchUnsplashImages(query, options = {}) {
  const { perPage = 2, orientation = "landscape", quality = "regular" } = options;
  
  try {
    const response = await axios.get(
      'https://api.unsplash.com/search/photos',
      {
        params: {
          query: query,
          per_page: perPage,
          orientation: orientation
        },
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
        }
      }
    );
    
    if (response.data.results && response.data.results.length > 0) {
      return {
        success: true,
        images: response.data.results.map(img => ({
          url: img.urls[quality] || img.urls.regular, // Usa a qualidade especificada
          source: "unsplash",
          photographer: img.user.name,
          alt: img.alt_description || query
        }))
      };
    }
    
    return { success: false, images: [] };
  } catch (error) {
    logEvent('error', 'Erro ao buscar no Unsplash', { 
      query, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    return { success: false, images: [], error };
  }
}

// Função para buscar imagens do Pexels
async function fetchPexelsImages(query, options = {}) {
  const { perPage = 2, orientation = "landscape", quality = "large" } = options;
  
  try {
    const response = await axios.get(
      'https://api.pexels.com/v1/search',
      {
        params: {
          query: query,
          per_page: perPage,
          orientation: orientation
        },
        headers: {
          Authorization: process.env.PEXELS_API_KEY
        }
      }
    );
    
    if (response.data.photos && response.data.photos.length > 0) {
      // Mapeia a qualidade para os tamanhos disponíveis no Pexels
      const sizeMap = {
        small: 'small',
        medium: 'medium',
        large: 'large',
        regular: 'large',
        full: 'original'
      };
      
      const size = sizeMap[quality] || 'large';
      
      return {
        success: true,
        images: response.data.photos.map(img => ({
          url: img.src[size] || img.src.large,
          source: "pexels",
          photographer: img.photographer,
          alt: query
        }))
      };
    }
    
    return { success: false, images: [] };
  } catch (error) {
    logEvent('error', 'Erro ao buscar no Pexels', { 
      query, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    return { success: false, images: [], error };
  }
}

// Função para gerar imagens de placeholder
function getPlaceholderImages(query, options = {}) {
  const { width = 800, height = 600 } = options;
  
  return {
    success: true,
    images: [
      {
        url: `https://via.placeholder.com/${width}x${height}.png?text=${encodeURIComponent(query)}`,
        source: "placeholder",
        photographer: "Placeholder",
        alt: query
      },
      {
        url: `https://via.placeholder.com/${width}x${height}.png?text=${encodeURIComponent(query + ' landmark')}`,
        source: "placeholder",
        photographer: "Placeholder",
        alt: query + " landmark"
      }
    ]
  };
}

module.exports = async function handler(req, res) {
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Lidar com requisições OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Apenas permitir requisições GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Extrair parâmetros da query
  const { 
    query, 
    source, 
    perPage = 2, 
    orientation = "landscape",
    width = 800,
    height = 600,
    quality = "regular" // para Unsplash: regular, small, thumb, etc.
  } = req.query || {};
  
  if (!query) {
    return res.status(400).json({ error: "Parâmetro 'query' é obrigatório" });
  }
  
  try {
    logEvent('info', `Buscando imagens para '${query}'`, { query, source, perPage, orientation });
    
    let images = [];
    let unsplashResult = { success: false, images: [] };
    let pexelsResult = { success: false, images: [] };
    
    // Buscar no Unsplash se solicitado
    if (source === "unsplash" || !source) {
      unsplashResult = await fetchUnsplashImages(query, {
        perPage: parseInt(perPage),
        orientation,
        quality
      });
      
      if (unsplashResult.success) {
        images = unsplashResult.images;
        logEvent('success', 'Imagens do Unsplash obtidas com sucesso', { 
          count: images.length,
          query
        });
      }
    }
    
    // Buscar no Pexels se necessário
    if ((!unsplashResult.success && source !== "unsplash") || source === "pexels") {
      pexelsResult = await fetchPexelsImages(query, {
        perPage: parseInt(perPage),
        orientation,
        quality
      });
      
      if (pexelsResult.success) {
        images = [...images, ...pexelsResult.images];
        logEvent('success', 'Imagens do Pexels obtidas com sucesso', { 
          count: pexelsResult.images.length,
          query
        });
      }
    }
    
    // Se nem Unsplash nem Pexels funcionarem, usar placeholder
    if (!unsplashResult.success && !pexelsResult.success) {
      const placeholderResult = getPlaceholderImages(query, {
        width: parseInt(width),
        height: parseInt(height)
      });
      
      images = placeholderResult.images;
      logEvent('info', 'Utilizando imagens de placeholder', { 
        count: images.length,
        query
      });
    }
    
    // Retornar resultados
    return res.status(200).json({ 
      images,
      cache: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logEvent('error', 'Erro ao buscar imagens', { 
      query, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    return res.status(500).json({ 
      error: error.message,
      images: getPlaceholderImages(query, {
        width: parseInt(width),
        height: parseInt(height)
      }).images
    });
  }
}
