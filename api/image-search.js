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
  console.log(JSON.stringify(log));
  return log;
}

// Base de dados de pontos turísticos populares para destinos comuns
const PONTOS_TURISTICOS_POPULARES = {
  "Paris": ["Torre Eiffel", "Museu do Louvre", "Arco do Triunfo", "Notre Dame", "Montmartre"],
  "Nova York": ["Times Square", "Estátua da Liberdade", "Central Park", "Empire State Building", "Brooklyn Bridge"],
  "Londres": ["London Eye", "Big Ben", "Tower Bridge", "Buckingham Palace", "British Museum"],
  "Roma": ["Coliseu", "Fontana di Trevi", "Vaticano", "Pantheon", "Fórum Romano"],
  "Tóquio": ["Torre de Tóquio", "Templo Senso-ji", "Shibuya Crossing", "Palácio Imperial", "Meiji Shrine"],
  "Rio de Janeiro": ["Cristo Redentor", "Pão de Açúcar", "Praia de Copacabana", "Maracanã", "Escadaria Selarón"],
  "Sydney": ["Opera House", "Harbour Bridge", "Bondi Beach", "Darling Harbour", "Sydney Tower"],
  "Barcelona": ["Sagrada Família", "Park Güell", "La Rambla", "Casa Batlló", "Barri Gòtic"]
  // ...outros destinos, se houver...
};

// Lista expandida de keywords para diferentes tipos de destinos
const CATEGORIAS_DESTINO = {
  // (Mantido igual ao original)
};

// Função simplificada para extrair pontos turísticos
function classificarDestino(query, descricao = '', pontosTuristicos = []) {
  let cidade = query;
  let pais = '';

  // Tentar separar cidade e país se houver vírgula
  if (query.includes(',')) {
    const partes = query.split(',').map(parte => parte.trim());
    cidade = partes[0];
    pais = partes[1] || '';
  }

  // Normalizar nome da cidade para busca no banco de dados
  const cidadeNormalizada = normalizarNomeDestino(cidade);

  // Verificar pontos turísticos conhecidos para este destino
  const pontosTuristicosConhecidos = PONTOS_TURISTICOS_POPULARES[cidadeNormalizada] || [];

  // Se temos pontos turísticos específicos fornecidos (ex: sugerido pela IA), usar esse array
  if (pontosTuristicos && pontosTuristicos.length > 0) {
    const pontoAleatorio = pontosTuristicos[Math.floor(Math.random() * pontosTuristicos.length)];
    return {
      tipo: 'ponto_turistico_especifico',
      termo: pontoAleatorio,
      cidade,
      pais
    };
  }

  // Se há pontos turísticos conhecidos na base interna, usa um deles
  if (pontosTuristicosConhecidos.length > 0) {
    const pontoAleatorio = pontosTuristicosConhecidos[Math.floor(Math.random() * pontosTuristicosConhecidos.length)];
    return {
      tipo: 'ponto_turistico_conhecido',
      termo: pontoAleatorio,
      cidade,
      pais
    };
  }

  // Fallback: usar um termo padrão mais significativo
  return {
    tipo: 'landmark',
    termo: 'Ponto Turístico',
    cidade,
    pais
  };
}

// Função para normalizar nome de destino para correspondência com a base de dados
function normalizarNomeDestino(destino) {
  const substituicoes = {
    'nyc': 'Nova York',
    'new york': 'Nova York',
    'ny': 'Nova York',
    'rio': 'Rio de Janeiro',
    'cdmx': 'Cidade do México',
    'mexico city': 'Cidade do México',
    'la': 'Los Angeles',
    'sf': 'San Francisco',
    'sp': 'São Paulo',
    'tokyo': 'Tóquio',
    'bsas': 'Buenos Aires',
    'london': 'Londres',
    'paris': 'Paris',
    'rome': 'Roma'
  };

  const nomeNormalizado = destino.toLowerCase();
  for (const [abreviacao, nomeCompleto] of Object.entries(substituicoes)) {
    if (nomeNormalizado.includes(abreviacao)) {
      return nomeCompleto;
    }
  }
  for (const nomeDestino of Object.keys(PONTOS_TURISTICOS_POPULARES)) {
    if (nomeDestino.toLowerCase().includes(nomeNormalizado) ||
        nomeNormalizado.includes(nomeDestino.toLowerCase())) {
      return nomeDestino;
    }
  }
  return destino.charAt(0).toUpperCase() + destino.slice(1);
}

// Função para buscar imagens do Pexels
async function fetchPexelsImages(query, options = {}) {
  const { 
    perPage = 2, 
    orientation = "landscape", 
    quality = "large",
    descricao = "",
    pontosTuristicos = []
  } = options;
  
  const classificacao = classificarDestino(query, descricao, pontosTuristicos);

  // Monta a query sempre como: [termo] [cidade] [país]
  let searchQuery = `${classificacao.termo} ${classificacao.cidade}`;
  if (classificacao.pais) {
    searchQuery += ` ${classificacao.pais}`;
  }

  try {
    logEvent('info', 'Buscando no Pexels', { 
      query: searchQuery, 
      orientation,
      classificacao
    });
    
    const response = await axios.get(
      'https://api.pexels.com/v1/search',
      {
        params: {
          query: searchQuery,
          per_page: perPage,
          orientation: orientation,
          size: "large" // Prioriza imagens de alta qualidade
        },
        headers: {
          Authorization: process.env.PEXELS_API_KEY
        }
      }
    );
    
    if (response.data.photos && response.data.photos.length > 0) {
      const sizeMap = {
        small: 'small',
        medium: 'medium',
        large: 'large',
        regular: 'large',
        full: 'original'
      };
      const size = sizeMap[quality] || 'large';
      const altText = `${classificacao.termo} em ${classificacao.cidade}` + (classificacao.pais ? `, ${classificacao.pais}` : '');
      
      return {
        success: true,
        images: response.data.photos.map(img => ({
          url: img.src[size] || img.src.large,
          source: "pexels",
          photographer: img.photographer,
          photographerId: img.photographer_id,
          photographerUrl: img.photographer_url,
          sourceUrl: img.url,
          downloadUrl: img.src.original,
          alt: altText,
          pontoTuristico: (classificacao.tipo === 'ponto_turistico_especifico' ||
                           classificacao.tipo === 'ponto_turistico_conhecido')
                           ? classificacao.termo : null
        }))
      };
    }
    return { success: false, images: [] };
  } catch (error) {
    logEvent('error', 'Erro ao buscar no Pexels', { 
      query: searchQuery, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    return { success: false, images: [], error };
  }
}

// Função para buscar imagens do Unsplash
async function fetchUnsplashImages(query, options = {}) {
  const { 
    perPage = 2, 
    orientation = "landscape", 
    quality = "regular",
    descricao = "",
    pontosTuristicos = []
  } = options;
  
  const classificacao = classificarDestino(query, descricao, pontosTuristicos);
  
  let searchQuery = `${classificacao.termo} ${classificacao.cidade}`;
  if (classificacao.pais) {
    searchQuery += ` ${classificacao.pais}`;
  }
  
  try {
    logEvent('info', 'Buscando no Unsplash', { 
      query: searchQuery, 
      orientation,
      classificacao
    });
    
    const response = await axios.get(
      'https://api.unsplash.com/search/photos',
      {
        params: {
          query: searchQuery,
          per_page: perPage,
          orientation: orientation,
          order_by: "relevant"
        },
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
        }
      }
    );
    
    if (response.data.results && response.data.results.length > 0) {
      const altText = `${classificacao.termo} em ${classificacao.cidade}` + (classificacao.pais ? `, ${classificacao.pais}` : '');
      
      return {
        success: true,
        images: response.data.results.map(img => ({
          url: img.urls[quality] || img.urls.regular,
          source: "unsplash",
          photographer: img.user.name,
          photographerId: img.user.username,
          photographerUrl: img.user.links.html,
          sourceUrl: img.links.html,
          downloadUrl: img.links.download,
          alt: img.alt_description || altText,
          pontoTuristico: (classificacao.tipo === 'ponto_turistico_especifico' ||
                           classificacao.tipo === 'ponto_turistico_conhecido')
                           ? classificacao.termo : null
        }))
      };
    }
    return { success: false, images: [] };
  } catch (error) {
    logEvent('error', 'Erro ao buscar no Unsplash', { 
      query: searchQuery, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    return { success: false, images: [], error };
  }
}

// Função para gerar imagens de placeholder
function getPlaceholderImages(query, options = {}) {
  const { width = 800, height = 600, descricao = "", pontosTuristicos = [] } = options;
  const classificacao = classificarDestino(query, descricao, pontosTuristicos);
  
  let placeholderText = `${classificacao.termo} em ${classificacao.cidade}`;
  if (classificacao.pais) {
    placeholderText += `, ${classificacao.pais}`;
  }
  
  return {
    success: true,
    images: [
      {
        url: `https://via.placeholder.com/${width}x${height}.png?text=${encodeURIComponent(placeholderText)}`,
        source: "placeholder",
        photographer: "Placeholder",
        photographerId: "placeholder",
        photographerUrl: "#",
        sourceUrl: "#",
        downloadUrl: `https://via.placeholder.com/${width}x${height}.png?text=${encodeURIComponent(placeholderText)}`,
        alt: placeholderText,
        pontoTuristico: (classificacao.tipo === 'ponto_turistico_especifico' ||
                         classificacao.tipo === 'ponto_turistico_conhecido')
                         ? classificacao.termo : null
      },
      {
        url: `https://via.placeholder.com/${width}x${height}.png?text=${encodeURIComponent(placeholderText + ' - Vista 2')}`,
        source: "placeholder",
        photographer: "Placeholder",
        photographerId: "placeholder",
        photographerUrl: "#",
        sourceUrl: "#",
        downloadUrl: `https://via.placeholder.com/${width}x${height}.png?text=${encodeURIComponent(placeholderText)}`,
        alt: `${placeholderText} - Vista alternativa`,
        pontoTuristico: (classificacao.tipo === 'ponto_turistico_especifico' ||
                         classificacao.tipo === 'ponto_turistico_conhecido')
                         ? classificacao.termo : null
      }
    ]
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { 
    query, 
    source, 
    perPage = 2, 
    orientation = "landscape",
    width = 800,
    height = 600,
    quality = "regular",
    descricao = "",
    pontosTuristicos = ""
  } = req.query || {};
  
  if (!query) {
    return res.status(400).json({ error: "Parâmetro 'query' é obrigatório" });
  }
  
  try {
    let pontosTuristicosArray = [];
    if (pontosTuristicos) {
      try {
        if (pontosTuristicos.startsWith('[')) {
          pontosTuristicosArray = JSON.parse(pontosTuristicos);
        } else {
          pontosTuristicosArray = pontosTuristicos.split(',').map(p => p.trim());
        }
      } catch (e) {
        pontosTuristicosArray = [pontosTuristicos];
      }
    }
    
    logEvent('info', `Buscando imagens para '${query}'`, { 
      query, 
      source, 
      perPage, 
      orientation, 
      descricao,
      pontosTuristicosArray
    });
    
    let images = [];
    let pexelsResult = { success: false, images: [] };
    let unsplashResult = { success: false, images: [] };
    
    if (source === "pexels" || !source) {
      pexelsResult = await fetchPexelsImages(query, {
        perPage: parseInt(perPage),
        orientation,
        quality,
        descricao,
        pontosTuristicos: pontosTuristicosArray
      });
      
      if (pexelsResult.success) {
        images = pexelsResult.images;
        logEvent('success', 'Imagens do Pexels obtidas com sucesso', { 
          count: images.length,
          query,
          pontosTuristicos: pontosTuristicosArray.join(', ')
        });
      }
    }
    
    if ((!pexelsResult.success && source !== "pexels") || source === "unsplash") {
      unsplashResult = await fetchUnsplashImages(query, {
        perPage: parseInt(perPage),
        orientation,
        quality,
        descricao,
        pontosTuristicos: pontosTuristicosArray
      });
      
      if (unsplashResult.success) {
        images = [...images, ...unsplashResult.images];
        logEvent('success', 'Imagens do Unsplash obtidas com sucesso', { 
          count: unsplashResult.images.length,
          query,
          pontosTuristicos: pontosTuristicosArray.join(', ')
        });
      }
    }
    
    if (!pexelsResult.success && !unsplashResult.success) {
      const placeholderResult = getPlaceholderImages(query, {
        width: parseInt(width),
        height: parseInt(height),
        descricao,
        pontosTuristicos: pontosTuristicosArray
      });
      
      images = placeholderResult.images;
      logEvent('info', 'Utilizando imagens de placeholder', { 
        count: images.length,
        query,
        pontosTuristicos: pontosTuristicosArray.join(', ')
      });
    }
    
    return res.status(200).json({ 
      images,
      cache: true,
      timestamp: new Date().toISOString(),
      pontosTuristicos: pontosTuristicosArray.length > 0 ? pontosTuristicosArray : undefined
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
        height: parseInt(height),
        descricao
      }).images
    });
  }
};
