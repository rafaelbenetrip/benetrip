// api/image-search.js - Endpoint Vercel para busca de imagens
const axios = require('axios');

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
  const { query, source } = req.query || {};
  
  if (!query) {
    return res.status(400).json({ error: "Parâmetro 'query' é obrigatório" });
  }
  
  try {
    console.log(`Buscando imagens para '${query}' no Vercel`);
    let images = [];
    let unsplashSuccess = false;
    let pexelsSuccess = false;
    
    // Buscar no Unsplash se solicitado
    if (source === "unsplash" || !source) {
      try {
        const unsplashResponse = await axios.get(
          `https://api.unsplash.com/search/photos`,
          {
            params: {
              query: query,
              per_page: 2,
              orientation: "landscape"
            },
            headers: {
              Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
            }
          }
        );
        
        if (unsplashResponse.data.results && unsplashResponse.data.results.length > 0) {
          images = unsplashResponse.data.results.map(img => ({
            url: img.urls.regular,
            source: "unsplash",
            photographer: img.user.name,
            alt: img.alt_description || query
          }));
          unsplashSuccess = true;
        }
      } catch (unsplashError) {
        console.log("Erro ao buscar no Unsplash:", unsplashError.message);
      }
    }
    
    // Buscar no Pexels se não tiver resultados do Unsplash ou se solicitado
    if ((!unsplashSuccess && source !== "unsplash") || source === "pexels") {
      try {
        const pexelsResponse = await axios.get(
          `https://api.pexels.com/v1/search`,
          {
            params: {
              query: query,
              per_page: 2,
              orientation: "landscape"
            },
            headers: {
              Authorization: process.env.PEXELS_API_KEY
            }
          }
        );
        
        if (pexelsResponse.data.photos && pexelsResponse.data.photos.length > 0) {
          const pexelsImages = pexelsResponse.data.photos.map(img => ({
            url: img.src.large,
            source: "pexels",
            photographer: img.photographer,
            alt: query
          }));
          
          images = [...images, ...pexelsImages];
          pexelsSuccess = true;
        }
      } catch (pexelsError) {
        console.log("Erro ao buscar no Pexels:", pexelsError.message);
      }
    }
    
    // Se nem Unsplash nem Pexels funcionarem, usar placeholder
    if (!unsplashSuccess && !pexelsSuccess) {
      images = [
        {
          url: `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(query)}`,
          source: "placeholder",
          photographer: "Placeholder",
          alt: query
        },
        {
          url: `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(query + ' landmark')}`,
          source: "placeholder",
          photographer: "Placeholder",
          alt: query + " landmark"
        }
      ];
    }
    
    // Retornar resultados
    return res.status(200).json({ 
      images,
      cache: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Erro ao buscar imagens no Vercel:", error);
    return res.status(500).json({ 
      error: error.message,
      images: [
        {
          url: `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(query)}`,
          source: "placeholder",
          photographer: "Placeholder",
          alt: query
        }
      ]
    });
  }
}
