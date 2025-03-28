// netlify/functions/image-search.js
const axios = require("axios");

exports.handler = async function(event, context) {
  // Permitir requisições OPTIONS (preflight CORS)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "GET") {
    return { 
      statusCode: 405, 
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: "Método não permitido" })
    };
  }

  // Extrair parâmetros da query
  const { query, source } = event.queryStringParameters || {};
  
  if (!query) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: "Parâmetro 'query' é obrigatório" })
    };
  }
  
  try {
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
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400" // Cachear por 24 horas
      },
      body: JSON.stringify({ images })
    };
    
  } catch (error) {
    console.error("Erro ao buscar imagens:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ 
        error: error.message,
        images: [
          {
            url: `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(query)}`,
            source: "placeholder",
            photographer: "Placeholder",
            alt: query
          }
        ]
      })
    };
  }
};
