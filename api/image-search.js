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

// Base de dados de pontos turísticos populares para destinos comuns
const PONTOS_TURISTICOS_POPULARES = {
  // Grandes cidades
  "Paris": ["Torre Eiffel", "Museu do Louvre", "Arco do Triunfo", "Notre Dame", "Montmartre"],
  "Nova York": ["Times Square", "Estátua da Liberdade", "Central Park", "Empire State Building", "Brooklyn Bridge"],
  "Londres": ["London Eye", "Big Ben", "Tower Bridge", "Buckingham Palace", "British Museum"],
  "Roma": ["Coliseu", "Fontana di Trevi", "Vaticano", "Pantheon", "Fórum Romano"],
  "Tóquio": ["Torre de Tóquio", "Templo Senso-ji", "Shibuya Crossing", "Palácio Imperial", "Meiji Shrine"],
  "Rio de Janeiro": ["Cristo Redentor", "Pão de Açúcar", "Praia de Copacabana", "Maracanã", "Escadaria Selarón"],
  "Sydney": ["Opera House", "Harbour Bridge", "Bondi Beach", "Darling Harbour", "Sydney Tower"],
  "Barcelona": ["Sagrada Família", "Park Güell", "La Rambla", "Casa Batlló", "Barri Gòtic"],
  
  // Destinos de praia
  "Bali": ["Tanah Lot", "Uluwatu Temple", "Ubud", "Kuta Beach", "Tegalalang Rice Terraces"],
  "Cancún": ["Chichen Itza", "Isla Mujeres", "Ruínas de Tulum", "Xcaret Park", "Playa Delfines"],
  "Santorini": ["Oia", "Fira", "Red Beach", "Caldera", "Ancient Thera"],
  "Maldivas": ["Male Atoll", "Biyadhoo Island", "Alimatha Island", "Sun Island", "Artificial Beach"],
  
  // Destinos de natureza
  "Yellowstone": ["Old Faithful", "Grand Prismatic Spring", "Yellowstone Lake", "Lamar Valley", "Mammoth Hot Springs"],
  "Banff": ["Lake Louise", "Moraine Lake", "Banff Gondola", "Johnston Canyon", "Columbia Icefield"],
  "Costa Rica": ["Arenal Volcano", "Manuel Antonio National Park", "Monteverde Cloud Forest", "Tortuguero", "Playa Tamarindo"],
  
  // Destinos históricos
  "Atenas": ["Parthenon", "Acropolis", "Temple of Olympian Zeus", "Ancient Agora", "Plaka District"],
  "Cairo": ["Pyramids of Giza", "Sphinx", "Egyptian Museum", "Khan el-Khalili", "Nile River"],
  "Machu Picchu": ["Sun Gate", "Huayna Picchu", "Temple of the Sun", "Intihuatana", "Sacred Valley"],
  
  // América Latina
  "Buenos Aires": ["Casa Rosada", "La Boca", "Recoleta Cemetery", "Teatro Colón", "Plaza de Mayo"],
  "Cidade do México": ["Teotihuacan", "Frida Kahlo Museum", "Zócalo", "Chapultepec Castle", "Xochimilco"],
  "Lima": ["Huaca Pucllana", "Plaza Mayor", "Miraflores", "Larco Museum", "Basilica Cathedral"],
  "Cartagena": ["Ciudad Amurallada", "Castillo San Felipe", "Plaza Santo Domingo", "Las Bóvedas", "Isla Barú"],
  "Medellín": ["Comuna 13", "Parque Arví", "Plaza Botero", "Jardín Botánico", "Pueblito Paisa"],
  "Cusco": ["Sacsayhuamán", "Plaza de Armas", "Qorikancha", "San Blas", "Mercado San Pedro"]
};

// Lista expandida de keywords para diferentes tipos de destinos
const CATEGORIAS_DESTINO = {
  praia: {
    keywords: ['praia', 'beach', 'mar', 'ocean', 'ilha', 'island', 'caribe', 'caribbean', 'costa', 'shore', 
               'sand', 'areia', 'sol', 'sun', 'tropical', 'resort', 'bay', 'baía', 'cove', 'enseada', 
               'snorkel', 'mergulho', 'diving', 'surfe', 'surf'],
    termos_busca: ['beach paradise', 'tropical beach', 'coastline view', 'beach resort', 'ocean view']
  },
  montanha: {
    keywords: ['montanha', 'mountain', 'serra', 'cordilheira', 'alpe', 'alpes', 'pico', 'peak', 'vale', 'valley', 
               'hill', 'colina', 'highlands', 'snow', 'neve', 'altitude', 'trekking', 'hiking', 'alpinismo', 
               'mountaineering', 'escalada', 'climbing', 'summit', 'cume'],
    termos_busca: ['mountain landscape', 'mountain peak', 'mountain view', 'scenic mountains', 'hiking trails']
  },
  cidade: {
    keywords: ['cidade', 'city', 'urbano', 'urban', 'metrópole', 'metropolis', 'capital', 'downtown', 'centro', 
               'skyline', 'arranha-céu', 'skyscraper', 'avenida', 'avenue', 'boulevard', 'street', 'rua', 
               'plaza', 'praça', 'square'],
    termos_busca: ['city skyline', 'urban landscape', 'city streets', 'downtown view', 'city center']
  },
  historico: {
    keywords: ['histórico', 'historic', 'antigo', 'ancient', 'ruína', 'ruins', 'colonial', 'medieval', 'castle', 
               'castelo', 'palácio', 'palace', 'monumento', 'monument', 'heritage', 'patrimônio', 'archaeology', 
               'arqueologia', 'cathedral', 'catedral', 'igreja', 'church', 'temple', 'templo'],
    termos_busca: ['historic site', 'ancient ruins', 'historical landmark', 'old town', 'cultural heritage']
  },
  natureza: {
    keywords: ['natureza', 'nature', 'parque', 'park', 'nacional', 'national', 'floresta', 'forest', 'selvagem', 
               'wild', 'wilderness', 'reserva', 'reserve', 'ecológico', 'ecological', 'fauna', 'flora', 'wildlife', 
               'vida selvagem', 'biodiversity', 'biodiversidade', 'pristine', 'intocado'],
    termos_busca: ['nature landscape', 'national park', 'wildlife preserve', 'natural scenery', 'wilderness']
  },
  deserto: {
    keywords: ['deserto', 'desert', 'duna', 'dune', 'areia', 'sand', 'oásis', 'oasis', 'cactus', 'cacto', 
               'sahara', 'mojave', 'atacama', 'namib', 'gobi', 'kalahari'],
    termos_busca: ['desert landscape', 'sand dunes', 'vast desert', 'desert oasis', 'desert sunset']
  },
  gastronomia: {
    keywords: ['gastronomia', 'gastronomy', 'comida', 'food', 'culinária', 'culinary', 'restaurante', 'restaurant', 
               'cozinha', 'kitchen', 'tradicional', 'traditional', 'mercado', 'market', 'café', 'coffee', 'wine', 
               'vinho', 'cerveja', 'beer', 'street food', 'comida de rua'],
    termos_busca: ['local cuisine', 'traditional food', 'food market', 'gastronomy scene', 'culinary experience']
  },
  rural: {
    keywords: ['rural', 'campo', 'countryside', 'fazenda', 'farm', 'vineyard', 'vinhedo', 'plantation', 'plantação', 
               'agricultural', 'agrícola', 'village', 'vila', 'cottage', 'chalé', 'barn', 'celeiro', 'pastoral'],
    termos_busca: ['rural landscape', 'countryside view', 'farm scenery', 'village life', 'pastoral landscape']
  },
  aventura: {
    keywords: ['aventura', 'adventure', 'adrenalina', 'adrenaline', 'radical', 'extreme', 'rafting', 'canoagem', 
               'canyoning', 'kayak', 'caiaque', 'zip line', 'tirolesa', 'bungee', 'paragliding', 'parapente', 
               'safari', 'expedição', 'expedition'],
    termos_busca: ['adventure activity', 'extreme sports', 'adventure landscape', 'outdoor adventure', 'adrenaline sports']
  },
  inverno: {
    keywords: ['inverno', 'winter', 'neve', 'snow', 'ski', 'esqui', 'snowboard', 'geleira', 'glacier', 'gelo', 
               'ice', 'frio', 'cold', 'estação de esqui', 'ski resort', 'ártico', 'arctic', 'alpino', 'alpine'],
    termos_busca: ['winter landscape', 'snowy mountains', 'ski resort', 'winter wonderland', 'snow-covered']
  },
  tropical: {
    keywords: ['tropical', 'rainforest', 'floresta tropical', 'jungle', 'selva', 'amazon', 'amazônia', 'equatorial', 
               'equator', 'equador', 'humid', 'úmido', 'exotic', 'exótico', 'paradise', 'paraíso'],
    termos_busca: ['tropical landscape', 'rainforest view', 'jungle scenery', 'tropical paradise', 'exotic nature']
  },
  cultural: {
    keywords: ['cultural', 'culture', 'tradição', 'tradition', 'festival', 'celebração', 'celebration', 'arte', 
               'art', 'museu', 'museum', 'gallery', 'galeria', 'theatre', 'teatro', 'ethnic', 'étnico', 
               'indigenous', 'indígena', 'folk', 'popular'],
    termos_busca: ['cultural site', 'traditional festival', 'cultural heritage', 'local traditions', 'cultural landmark']
  }
};

// Função simplificada para extrair pontos turísticos
function classificarDestino(query, descricao = '', pontosTuristicos = []) {
  // Extrair país e cidade da query se possível
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
  
  // Verificar pontos turísticos específicos primeiro
  const pontosTuristicosConhecidos = PONTOS_TURISTICOS_POPULARES[cidadeNormalizada] || [];
  
  // Se temos pontos turísticos específicos fornecidos, usá-los
  if (pontosTuristicos && pontosTuristicos.length > 0) {
    // Escolher um ponto turístico aleatório da lista fornecida
    const pontoAleatorio = pontosTuristicos[Math.floor(Math.random() * pontosTuristicos.length)];
    return {
      tipo: 'ponto_turistico_especifico',
      termo: pontoAleatorio,
      cidade: cidade,
      pais: pais
    };
  }
  
  // Se temos pontos turísticos conhecidos para este destino, usar um deles
  if (pontosTuristicosConhecidos.length > 0) {
    // Escolher um ponto turístico aleatório da lista conhecida
    const pontoAleatorio = pontosTuristicosConhecidos[Math.floor(Math.random() * pontosTuristicosConhecidos.length)];
    return {
      tipo: 'ponto_turistico_conhecido',
      termo: pontoAleatorio,
      cidade: cidade,
      pais: pais
    };
  }
  
  // Se não temos pontos turísticos específicos, usar um termo genérico
  return {
    tipo: 'landmark',
    termo: 'landmark',
    cidade: cidade,
    pais: pais
  };
}

// Função para normalizar nome de destino para correspondência com a base de dados
function normalizarNomeDestino(destino) {
  // Lista de substituições comuns
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
  
  // Normalizar para minúsculas
  const nomeNormalizado = destino.toLowerCase();
  
  // Verificar substituições
  for (const [abreviacao, nomeCompleto] of Object.entries(substituicoes)) {
    if (nomeNormalizado.includes(abreviacao)) {
      return nomeCompleto;
    }
  }
  
  // Tentar encontrar correspondência parcial na base de dados
  for (const nomeDestino of Object.keys(PONTOS_TURISTICOS_POPULARES)) {
    if (nomeDestino.toLowerCase().includes(nomeNormalizado) || 
        nomeNormalizado.includes(nomeDestino.toLowerCase())) {
      return nomeDestino;
    }
  }
  
  // Se não encontrar, retornar o destino original com a primeira letra maiúscula
  return destino.charAt(0).toUpperCase() + destino.slice(1);
}

// Função simplificada para buscar imagens do Pexels
async function fetchPexelsImages(query, options = {}) {
  const { 
    perPage = 2, 
    orientation = "landscape", 
    quality = "large",
    descricao = "",
    pontosTuristicos = []
  } = options;
  
  // Classificar o destino para obter pontos turísticos
  const classificacao = classificarDestino(query, descricao, pontosTuristicos);
  
  // Construir query simplificada: ponto turístico + cidade + país
  let searchQuery = '';
  
  if (classificacao.tipo === 'ponto_turistico_especifico' || classificacao.tipo === 'ponto_turistico_conhecido') {
    // Formato: "Torre Eiffel Paris França"
    searchQuery = `${classificacao.termo} ${classificacao.cidade}`;
    if (classificacao.pais) {
      searchQuery += ` ${classificacao.pais}`;
    }
  } else {
    // Sem ponto turístico, usar apenas cidade e país
    searchQuery = classificacao.cidade;
    if (classificacao.pais) {
      searchQuery += ` ${classificacao.pais}`;
    }
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
          size: "large" // Preferir imagens de alta qualidade
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
      
      const altText = classificacao.tipo === 'ponto_turistico_especifico' || 
                      classificacao.tipo === 'ponto_turistico_conhecido' ?
                      `${classificacao.termo} em ${classificacao.cidade}` :
                      `${classificacao.cidade}, ${classificacao.pais}`;
      
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
          pontoTuristico: classificacao.tipo === 'ponto_turistico_especifico' || 
                          classificacao.tipo === 'ponto_turistico_conhecido' ? 
                          classificacao.termo : null
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

// Função simplificada para buscar imagens do Unsplash
async function fetchUnsplashImages(query, options = {}) {
  const { 
    perPage = 2, 
    orientation = "landscape", 
    quality = "regular",
    descricao = "",
    pontosTuristicos = []
  } = options;
  
  // Classificar o destino para obter pontos turísticos
  const classificacao = classificarDestino(query, descricao, pontosTuristicos);
  
  // Construir query simplificada: ponto turístico + cidade + país
  let searchQuery = '';
  
  if (classificacao.tipo === 'ponto_turistico_especifico' || classificacao.tipo === 'ponto_turistico_conhecido') {
    // Formato: "Torre Eiffel Paris França"
    searchQuery = `${classificacao.termo} ${classificacao.cidade}`;
    if (classificacao.pais) {
      searchQuery += ` ${classificacao.pais}`;
    }
  } else {
    // Sem ponto turístico, usar apenas cidade e país
    searchQuery = classificacao.cidade;
    if (classificacao.pais) {
      searchQuery += ` ${classificacao.pais}`;
    }
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
      const altText = classificacao.tipo === 'ponto_turistico_especifico' || 
                      classificacao.tipo === 'ponto_turistico_conhecido' ?
                      `${classificacao.termo} em ${classificacao.cidade}` :
                      `${classificacao.cidade}, ${classificacao.pais}`;
      
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
          pontoTuristico: classificacao.tipo === 'ponto_turistico_especifico' || 
                          classificacao.tipo === 'ponto_turistico_conhecido' ? 
                          classificacao.termo : null
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

// Função simplificada para gerar imagens de placeholder
function getPlaceholderImages(query, options = {}) {
  const { width = 800, height = 600, descricao = "", pontosTuristicos = [] } = options;
  
  // Classificar o destino para obter pontos turísticos
  const classificacao = classificarDestino(query, descricao, pontosTuristicos);
  
  // Texto para placeholder
  let placeholderText = '';
  if (classificacao.tipo === 'ponto_turistico_especifico' || classificacao.tipo === 'ponto_turistico_conhecido') {
    placeholderText = `${classificacao.termo} em ${classificacao.cidade}`;
    if (classificacao.pais) {
      placeholderText += `, ${classificacao.pais}`;
    }
  } else {
    placeholderText = classificacao.cidade;
    if (classificacao.pais) {
      placeholderText += `, ${classificacao.pais}`;
    }
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
        pontoTuristico: classificacao.tipo === 'ponto_turistico_especifico' || 
                        classificacao.tipo === 'ponto_turistico_conhecido' ? 
                        classificacao.termo : null
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
        pontoTuristico: classificacao.tipo === 'ponto_turistico_especifico' || 
                        classificacao.tipo === 'ponto_turistico_conhecido' ? 
                        classificacao.termo : null
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
    quality = "regular",
    descricao = "",
    pontosTuristicos = ""
  } = req.query || {};
  
  if (!query) {
    return res.status(400).json({ error: "Parâmetro 'query' é obrigatório" });
  }
  
  try {
    // Processar pontosTuristicos se fornecido como string
    let pontosTuristicosArray = [];
    if (pontosTuristicos) {
      try {
        // Tentar interpretá-lo como JSON
        if (pontosTuristicos.startsWith('[')) {
          pontosTuristicosArray = JSON.parse(pontosTuristicos);
        } else {
          // Caso contrário, dividir por vírgulas
          pontosTuristicosArray = pontosTuristicos.split(',').map(p => p.trim());
        }
      } catch (e) {
        // Em caso de erro, considerar como string única
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
    
    // Buscar no Pexels primeiro (agora é a fonte principal)
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
    
    // Buscar no Unsplash apenas se o Pexels falhar ou se for especificamente solicitado
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
    
    // Se nem Pexels nem Unsplash funcionarem, usar placeholder
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
    
    // Retornar resultados
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
}
