// netlify/functions/image-search.js
const axios = require("axios");

exports.handler = async function(event, context) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Método não permitido" };
  }

  // Extrair parâmetros da query
  const { query, source } = event.queryStringParameters;
  
  try {
    let images = [];
    
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
        }
      } catch (unsplashError) {
        console.log("Erro ao buscar no Unsplash:", unsplashError.message);
      }
    }
    
    // Buscar no Pexels se não tiver resultados do Unsplash ou se solicitado
    if ((images.length === 0 && source !== "unsplash") || source === "pexels") {
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
        }
      } catch (pexelsError) {
        console.log("Erro ao buscar no Pexels:", pexelsError.message);
      }
    }
    
    // Retornar resultados
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ images })
    };
    
  } catch (error) {
    console.error("Erro ao buscar imagens:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
