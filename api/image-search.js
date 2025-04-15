// =============================
// image-search.js - Vercel Serverless Function (BACKEND)
// Busca imagens via Google Places e fallback Pexels
// Suporta srcset e tamanhos dinâmicos para mobile
// =============================

const axios = require('axios');

async function buscarFotoGooglePlaces(query, width = 800) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  try {
    const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${API_KEY}`;
    const placeRes = await axios.get(findPlaceUrl);
    const placeId = placeRes.data?.candidates?.[0]?.place_id;
    if (!placeId) return null;

    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photo&key=${API_KEY}`;
    const detailsRes = await axios.get(detailsUrl);
    const photoRef = detailsRes.data?.result?.photos?.[0]?.photo_reference;
    if (!photoRef) return null;

    return {
      url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${width}&photo_reference=${photoRef}&key=${API_KEY}`,
      srcset: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${width * 1.5}&photo_reference=${photoRef}&key=${API_KEY} 1.5x, https://maps.googleapis.com/maps/api/place/photo?maxwidth=${width * 2}&photo_reference=${photoRef}&key=${API_KEY} 2x`
    };
  } catch (error) {
    console.error('Google Places API error:', error.message);
    return null;
  }
}

async function buscarFotoPexels(query, width = 800) {
  const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
  try {
    const res = await axios.get(`https://api.pexels.com/v1/search`, {
      headers: { Authorization: PEXELS_API_KEY },
      params: {
        query,
        orientation: 'landscape',
        per_page: 1,
        size: width >= 1000 ? 'large' : width >= 600 ? 'medium' : 'small'
      }
    });
    const photo = res.data?.photos?.[0];
    if (!photo) return null;
    return {
      url: photo.src.large || photo.src.medium,
      srcset: `${photo.src.medium} 1x, ${photo.src.large} 2x`
    };
  } catch (error) {
    console.error('Pexels API error:', error.message);
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const {
    query,
    pontosTuristicos = "[]",
    width = 800,
    height = 600
  } = req.query;
  if (!query) return res.status(400).json({ error: "Query obrigatória" });

  let pontos = [];
  try {
    pontos = JSON.parse(pontosTuristicos);
  } catch {
    pontos = pontosTuristicos.split(',').map(p => p.trim());
  }

  for (const ponto of pontos) {
    const imageData = await buscarFotoGooglePlaces(`${ponto} ${query}`, width);
    if (imageData) {
      return res.status(200).json({
        images: [{
          url: imageData.url,
          srcset: imageData.srcset,
          source: "google_places",
          alt: `${ponto} em ${query}`,
          pontoTuristico: ponto
        }]
      });
    }
  }

  const fallbackGoogle = await buscarFotoGooglePlaces(query, width);
  if (fallbackGoogle) {
    return res.status(200).json({
      images: [{
        url: fallbackGoogle.url,
        srcset: fallbackGoogle.srcset,
        source: "google_places",
        alt: query,
        pontoTuristico: null
      }]
    });
  }

  const fallbackPexels = await buscarFotoPexels(query, width);
  if (fallbackPexels) {
    return res.status(200).json({
      images: [{
        url: fallbackPexels.url,
        srcset: fallbackPexels.srcset,
        source: "pexels",
        alt: query,
        pontoTuristico: null
      }]
    });
  }

  const placeholderUrl = `https://via.placeholder.com/${width}x${height}.png?text=${encodeURIComponent(query)}`;
  return res.status(200).json({
    images: [{
      url: placeholderUrl,
      source: "placeholder",
      alt: query,
      pontoTuristico: null
    }]
  });
};
