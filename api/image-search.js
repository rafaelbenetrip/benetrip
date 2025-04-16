// api/image-search.js - Endpoint Vercel para busca de imagens
const axios = require('axios');

// Chaves de API do Google
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY;

// Adicione este log para diagnóstico (remova após a correção)
console.log('Credenciais Google:', { 
  keyDefined: !!GOOGLE_API_KEY, 
  keyLength: GOOGLE_API_KEY?.length,
  searchEngineIdDefined: !!GOOGLE_SEARCH_ENGINE_ID
});

// Cache temporário para pontos turísticos obtidos via Google Places
const pontosTuristicosCache = new Map();
// Tempo de expiração do cache (24 horas)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

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

// Função para obter pontos turísticos de um destino via Google Places API
async function fetchTouristAttractions(destination) {
  // Verificar se já temos no cache
  const cacheKey = destination.toLowerCase();
  if (pontosTuristicosCache.has(cacheKey)) {
    const cached = pontosTuristicosCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_EXPIRATION) {
      return cached.data;
    }
    // Se expirou, remove do cache
    pontosTuristicosCache.delete(cacheKey);
  }

  try {
    logEvent('info', `Buscando pontos turísticos para ${destination}`, { destination });
    
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      {
        params: {
          query: `top tourist attractions in ${destination}`,
          key: GOOGLE_PLACES_API_KEY,
          language: 'pt' // Pode usar 'en' para resultados em inglês
        }
      }
    );
    
    if (response.data.results && response.data.results.length > 0) {
      // Extrair os nomes dos pontos turísticos
      const attractions = response.data.results
        .slice(0, 5) // Limitar aos 5 principais resultados
        .map(place => place.name);
      
      // Salvar no cache
      pontosTuristicosCache.set(cacheKey, {
        data: attractions,
        timestamp: Date.now()
      });
      
      logEvent('success', `Pontos turísticos encontrados para ${destination}`, { 
        count: attractions.length,
        attractions
      });
      
      return attractions;
    }
    
    return [];
  } catch (error) {
    logEvent('error', `Erro ao buscar pontos turísticos para ${destination}`, {
      error: error.message,
      destination
    });
    return [];
  }
}

// Função para buscar imagens via Google Custom Search API
async function fetchGoogleImages(query, options = {}) {
  const { 
    perPage = 2, 
    orientation = "landscape",
    destination = '',
    country = '',
    pontosTuristicos = []
  } = options;
  
  // Construir uma query otimizada
  let searchQuery = query;
  if (pontosTuristicos && pontosTuristicos.length > 0) {
    // Usar o primeiro ponto turístico na query principal
    const pontoDestaque = pontosTuristicos[0];
    searchQuery = `${pontoDestaque} ${destination} ${country}`;
  }
  
  try {
    logEvent('info', 'Buscando no Google Custom Search', { 
      query: searchQuery,
      destination,
      pontosTuristicos: pontosTuristicos.join(', ')
    });

    // Verificar se as credenciais estão configuradas
    if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
      logEvent('error', 'Credenciais Google não configuradas corretamente');
      return { success: false, images: [], error: { message: 'Credenciais não configuradas' } };
    }
    
    const response = await axios.get(
      'https://www.googleapis.com/customsearch/v1',
      {
        params: {
          q: searchQuery,
          cx: GOOGLE_SEARCH_ENGINE_ID,
          key: GOOGLE_API_KEY,
          searchType: 'image',
          num: perPage,
          imgSize: 'large',
          imgType: 'photo',
          safe: 'active',
          // Adicionar parâmetros para melhorar relevância
          rights: 'cc_publicdomain,cc_attribute,cc_sharealike',
          // Tentar limitar a sites de turismo confiáveis
          siteSearch: 'tripadvisor.com,lonelyplanet.com,booking.com,expedia.com',
          siteSearchFilter: 'i' // Incluir apenas estes sites
        }
      }
    );
    
    if (response.data.items && response.data.items.length > 0) {
      // Extrair dados das imagens
      const pontoTuristico = pontosTuristicos && pontosTuristicos.length > 0 ? pontosTuristicos[0] : null;
      const altText = pontoTuristico 
        ? `${pontoTuristico} em ${destination}` + (country ? `, ${country}` : '')
        : `${destination}` + (country ? `, ${country}` : '');
      
      return {
        success: true,
        images: response.data.items.map(item => ({
          url: item.link,
          source: "google",
          photographer: item.displayLink || 'Google Images',
          photographerId: item.displayLink || 'google',
          photographerUrl: item.image.contextLink || '#',
          sourceUrl: item.image.contextLink || item.link,
          downloadUrl: item.link,
          alt: item.title || altText,
          pontoTuristico: pontoTuristico
        }))
      };
    }
    
    return { success: false, images: [] };
   } catch (error) {
    // Melhor tratamento de erro com detalhes da resposta
    const errorDetails = error.response ? {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data
    } : { message: error.message };
    
    logEvent('error', 'Erro ao buscar no Google Custom Search', { 
      query: searchQuery, 
      error: error.message,
      details: errorDetails
    });
    
    return { success: false, images: [], error };
  }
}

// Função melhorada para classificar destino e obter pontos turísticos
async function classificarDestino(query, descricao = '', pontosTuristicos = []) {
  let cidade = query;
  let pais = '';

  // Separar cidade e país se houver vírgula
  if (query.includes(',')) {
    const partes = query.split(',').map(parte => parte.trim());
    cidade = partes[0];
    pais = partes[1] || '';
  }

  // Normalizar nome da cidade para busca
  const cidadeNormalizada = normalizarNomeDestino(cidade);
  
  // 1. Verificar se temos pontos turísticos específicos fornecidos
  if (pontosTuristicos && pontosTuristicos.length > 0) {
    const pontoAleatorio = pontosTuristicos[Math.floor(Math.random() * pontosTuristicos.length)];
    return {
      tipo: 'ponto_turistico_especifico',
      termo: pontoAleatorio,
      cidade,
      pais
    };
  }
  
  // 2. Verificar pontos turísticos conhecidos na base interna
  const pontosTuristicosConhecidos = PONTOS_TURISTICOS_POPULARES[cidadeNormalizada] || [];
  
  if (pontosTuristicosConhecidos.length > 0) {
    const pontoAleatorio = pontosTuristicosConhecidos[Math.floor(Math.random() * pontosTuristicosConhecidos.length)];
    return {
      tipo: 'ponto_turistico_conhecido',
      termo: pontoAleatorio,
      cidade,
      pais
    };
  }
  
  // 3. Buscar pontos turísticos no Google Places
  const queryDestino = pais ? `${cidade}, ${pais}` : cidade;
  const googlePlacesAttractions = await fetchTouristAttractions(queryDestino);
  
  if (googlePlacesAttractions && googlePlacesAttractions.length > 0) {
    const pontoAleatorio = googlePlacesAttractions[Math.floor(Math.random() * googlePlacesAttractions.length)];
    return {
      tipo: 'ponto_turistico_google',
      termo: pontoAleatorio,
      cidade,
      pais,
      pontosTuristicos: googlePlacesAttractions // Guardar todos os pontos
    };
  }

  // Fallback: usar um termo padrão genérico
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
  
  const classificacao = await classificarDestino(query, descricao, pontosTuristicos);

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
                           classificacao.tipo === 'ponto_turistico_conhecido' ||
                           classificacao.tipo === 'ponto_turistico_google')
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
  
  const classificacao = await classificarDestino(query, descricao, pontosTuristicos);
  
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
                           classificacao.tipo === 'ponto_turistico_conhecido' ||
                           classificacao.tipo === 'ponto_turistico_google')
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
                         classificacao.tipo === 'ponto_turistico_conhecido' ||
                         classificacao.tipo === 'ponto_turistico_google')
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
                         classificacao.tipo === 'ponto_turistico_conhecido' ||
                         classificacao.tipo === 'ponto_turistico_google')
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
    
    // Nova cascata de APIs com prioridade: Google > Pexels > Unsplash > Placeholder
    let images = [];
    let googleResult = { success: false, images: [] };
    let pexelsResult = { success: false, images: [] };
    let unsplashResult = { success: false, images: [] };
    
    // 1. Tentar buscar pontos turísticos via Google Places
    const classificacao = await classificarDestino(query, descricao, pontosTuristicosArray);
    
    // 2. Tentar Google Custom Search primeiro
    if (!source || source === "google") {
      googleResult = await fetchGoogleImages(query, {
        perPage: parseInt(perPage),
        orientation,
        destination: classificacao.cidade,
        country: classificacao.pais,
        pontosTuristicos: classificacao.pontosTuristicos || pontosTuristicosArray
      });
      
      if (googleResult.success && googleResult.images.length > 0) {
        images = googleResult.images;
        logEvent('success', 'Imagens do Google obtidas com sucesso', { 
          count: images.length,
          query,
          classification: classificacao
        });
      }
    }
    
    // 3. Tentar Pexels como segunda opção
    if ((!googleResult.success || images.length < perPage) && (source === "pexels" || !source)) {
      pexelsResult = await fetchPexelsImages(query, {
        perPage: parseInt(perPage) - images.length,
        orientation,
        quality,
        descricao,
        pontosTuristicos: classificacao.pontosTuristicos || pontosTuristicosArray
      });
      
      if (pexelsResult.success) {
        images = [...images, ...pexelsResult.images].slice(0, parseInt(perPage));
        logEvent('success', 'Imagens do Pexels obtidas com sucesso', { 
          count: pexelsResult.images.length,
          query,
          pontosTuristicos: pontosTuristicosArray.join(', ')
        });
      }
    }
    
    // 4. Tentar Unsplash como terceira opção
    if (images.length < perPage && (source === "unsplash" || !source)) {
      unsplashResult = await fetchUnsplashImages(query, {
        perPage: parseInt(perPage) - images.length,
        orientation,
        quality,
        descricao,
        pontosTuristicos: classificacao.pontosTuristicos || pontosTuristicosArray
      });
      
      if (unsplashResult.success) {
        images = [...images, ...unsplashResult.images].slice(0, parseInt(perPage));
        logEvent('success', 'Imagens do Unsplash obtidas com sucesso', { 
          count: unsplashResult.images.length,
          query,
          pontosTuristicos: pontosTuristicosArray.join(', ')
        });
      }
    }
    
    // 5. Se ainda não temos imagens suficientes, usar placeholder
    if (images.length < perPage) {
      const placeholderResult = getPlaceholderImages(query, {
        width: parseInt(width),
        height: parseInt(height),
        descricao,
        pontosTuristicos: classificacao.pontosTuristicos || pontosTuristicosArray
      });
      
      images = [...images, ...placeholderResult.images].slice(0, parseInt(perPage));
      logEvent('info', 'Utilizando imagens de placeholder para complementar', { 
        count: placeholderResult.images.length,
        query,
        pontosTuristicos: pontosTuristicosArray.join(', ')
      });
    }
    
    // Adicionar pontos turísticos obtidos para uso futuro
    const pontosTuristicosResultado = classificacao.pontosTuristicos || pontosTuristicosArray;
    
    return res.status(200).json({ 
      images,
      cache: true,
      timestamp: new Date().toISOString(),
      pontosTuristicos: pontosTuristicosResultado.length > 0 ? pontosTuristicosResultado : undefined,
      source: googleResult.success ? 'google' : (pexelsResult.success ? 'pexels' : (unsplashResult.success ? 'unsplash' : 'placeholder'))
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
