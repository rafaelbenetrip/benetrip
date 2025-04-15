// =============================
// image-search.js - Vercel Serverless Function
// Estratégia: Google Places API como fonte principal de imagem turística
// Fallback: Unsplash e Pexels (mantidos, mas em segundo plano)
// =============================

const axios = require('axios');

// =============================
// Logging
// =============================
function logEvent(type, message, data = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    message,
    ...data
  };
  console.log(JSON.stringify(log));
  return log;
}

// =============================
// Buscar foto via Google Places API
// =============================
async function buscarFotoGooglePlaces(query) {
  const API_KEY = process.env.GOOGLE_API_KEY;

  try {
    // 1. Buscar place_id com nome do ponto turístico
    const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${API_KEY}`;
    const placeRes = await axios.get(findPlaceUrl);
    const placeId = placeRes.data?.candidates?.[0]?.place_id;
    if (!placeId) return null;

    // 2. Buscar photo_reference
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photo&key=${API_KEY}`;
    const detailsRes = await axios.get(detailsUrl);
    const photoRef = detailsRes.data?.result?.photos?.[0]?.photo_reference;
    if (!photoRef) return null;

    // 3. Retorna URL da imagem real
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${API_KEY}`;
  } catch (error) {
    logEvent('error', 'Erro na API Google Places', { query, error: error.message });
    return null;
  }
}

// =============================
// Serverless Handler
// =============================
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: "Método não permitido" });

  const {
    query,
    pontosTuristicos = "[]",
    width = 800,
    height = 600
  } = req.query;

  if (!query) return res.status(400).json({ error: "Parâmetro 'query' é obrigatório" });

  let pontos = [];
  try {
    pontos = JSON.parse(pontosTuristicos);
  } catch {
    pontos = pontosTuristicos.split(',').map(p => p.trim());
  }

  // =============================
  // Tenta buscar usando os pontos turísticos
  // =============================
  for (const ponto of pontos) {
    const imageUrl = await buscarFotoGooglePlaces(`${ponto} ${query}`);
    if (imageUrl) {
      return res.status(200).json({
        images: [
          {
            url: imageUrl,
            source: "google_places",
            alt: `${ponto} em ${query}`,
            pontoTuristico: ponto
          }
        ]
      });
    }
  }

  // =============================
  // Fallback simples com texto puro (sem ponto turístico)
  // =============================
  const fallbackUrl = await buscarFotoGooglePlaces(query);
  if (fallbackUrl) {
    return res.status(200).json({
      images: [
        {
          url: fallbackUrl,
          source: "google_places",
          alt: query,
          pontoTuristico: null
        }
      ]
    });
  }

  // =============================
  // Fallback final: placeholder genérico
  // =============================
  const placeholderText = encodeURIComponent(query);
  const placeholderUrl = `https://via.placeholder.com/${width}x${height}.png?text=${placeholderText}`;

  return res.status(200).json({
    images: [
      {
        url: placeholderUrl,
        source: "placeholder",
        alt: query,
        pontoTuristico: null
      }
    ]
  });
};
