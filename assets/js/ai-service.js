// Serviço de IA para o Benetrip
window.BENETRIP_AI = {
  // Configurações do serviço
  config: {
    cacheDuration: 24 * 60 * 60 * 1000, // 24 horas em ms
    useNetlifyFunctions: true, // Sempre usar Netlify Functions em produção
    fallbackEndpoint: '/.netlify/functions/proxy',
    mockData: { // Dados de exemplo para casos de falha
      "topPick": {
        "destino": "Medellín",
        "pais": "Colômbia",
        "codigoPais": "CO",
        "descricao": "Cidade da eterna primavera com clima perfeito o ano todo",
        "porque": "Clima primaveril o ano todo com paisagens montanhosas deslumbrantes",
        "destaque": "Passeio de teleférico, Comuna 13 e fazendas de café próximas",
        "comentario": "Eu simplesmente AMEI Medellín! É perfeito para quem busca um mix de cultura e natureza! 🐾",
        "preco": {
          "voo": 1800,
          "hotel": 350
        }
      },
      "alternativas": [
        {
          "destino": "Montevidéu",
          "pais": "Uruguai",
          "codigoPais": "UY",
          "porque": "Clima costeiro tranquilo com frutos do mar deliciosos e espaços culturais",
          "preco": {
            "voo": 1500,
            "hotel": 300
          }
        },
        {
          "destino": "Buenos Aires",
          "pais": "Argentina",
          "codigoPais": "AR",
          "porque": "Capital cosmopolita com rica vida cultural, teatros e arquitetura europeia",
          "preco": {
            "voo": 1400,
            "hotel": 280
          }
        },
        {
          "destino": "Santiago",
          "pais": "Chile",
          "codigoPais": "CL",
          "porque": "Moderna capital cercada pela Cordilheira dos Andes com excelentes vinhos",
          "preco": {
            "voo": 1600,
            "hotel": 350
          }
        },
        {
          "destino": "Cusco",
          "pais": "Peru",
          "codigoPais": "PE",
          "porque": "Portal para Machu Picchu com rica história inca e arquitetura colonial",
          "preco": {
            "voo": 1700,
            "hotel": 250
          }
        }
      ],
      "surpresa": {
        "destino": "Cartagena",
        "pais": "Colômbia",
        "codigoPais": "CO",
        "descricao": "Joia colonial no Caribe colombiano com praias paradisíacas",
        "porque": "Cidade murada histórica com ruas coloridas, cultura vibrante e praias maravilhosas",
        "destaque": "Passeio de barco pelas Ilhas do Rosário com águas cristalinas",
        "comentario": "Cartagena é um tesouro escondido que vai te conquistar! As cores, a música e a comida caribenha formam uma experiência inesquecível! 🐾🌴",
        "preco": {
          "voo": 1950,
          "hotel": 320
        }
      }
    }
  },
  
  // Sistema de cache para evitar chamadas repetidas à API
  cache: {
    recommendations: {},
    timestamp: {}
  },
  
  // Inicialização do serviço
  init() {
    console.log('Inicializando serviço de IA do Benetrip');
    this.initialized = true;
    this._ultimaRequisicao = null;
    
    // Carregar cache salvo
    this.loadCacheFromStorage();
    
    // Registrar listener para eventos de progresso
    window.addEventListener('benetrip_progress', (event) => {
      console.log(`Evento de progresso: ${JSON.stringify(event.detail)}`);
    });
    
    return this;
  },
  
  // Verifica se o serviço foi inicializado
  isInitialized() {
    return this.initialized === true;
  },

  // Carrega cache do localStorage
  loadCacheFromStorage() {
    try {
      const cachedData = localStorage.getItem('benetrip_ai_cache');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        this.cache = {...parsed};
        console.log("Cache de IA carregado: ", Object.keys(this.cache.recommendations).length, "recomendações");
      }
    } catch (error) {
      console.warn("Erro ao carregar cache de IA:", error);
      // Inicializar cache vazio em caso de erro
      this.cache = {
        recommendations: {},
        timestamp: {}
      };
    }
  },
  
  // Salva cache no localStorage
  saveCacheToStorage() {
    try {
      localStorage.setItem('benetrip_ai_cache', JSON.stringify(this.cache));
    } catch (error) {
      console.warn("Erro ao salvar cache de IA:", error);
    }
  },
  
  // Gera um ID de cache baseado nas preferências
  generateCacheId(preferences) {
    // Extrair valores relevantes para formar uma chave de cache
    const companhia = preferences.companhia || '0';
    const preferencia = preferences.preferencia_viagem || '0';
    const moeda = preferences.moeda_escolhida || 'BRL';
    const origem = preferences.cidade_partida?.name || 'default';
    
    return `${origem}_${companhia}_${preferencia}_${moeda}`;
  },
  
  // Verifica se há dados em cache válidos
  hasCachedData(cacheId) {
    if (!this.cache.recommendations[cacheId]) return false;
    
    const cacheTime = this.cache.timestamp[cacheId] || 0;
    const now = Date.now();
    
    // Verifica se o cache ainda é válido
    return (now - cacheTime) < this.config.cacheDuration;
  },
  
  // Método para extrair JSON de texto, lidando com diferentes formatos
  extrairJSON(texto) {
    // Se já for um objeto, retornar diretamente
    if (texto && typeof texto === 'object') {
      return texto;
    }
    
    // Primeiro, tenta fazer parse direto
    try {
      return JSON.parse(texto);
    } catch (e) {
      // Se falhar, tenta extrair JSON de bloco de código ou texto
      try {
        // Busca por blocos de código JSON
        const blocoCodigo = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (blocoCodigo && blocoCodigo[1]) {
          return JSON.parse(blocoCodigo[1].trim());
        }
        
        // Busca pela primeira ocorrência de chaves
        const jsonRegex = /{[\s\S]*?}/;
        const match = texto.match(jsonRegex);
        if (match) {
          return JSON.parse(match[0]);
        }
      } catch (innerError) {
        console.error('Erro ao extrair JSON do texto:', innerError);
      }
      
      throw new Error('Não foi possível extrair JSON válido da resposta');
    }
  },
  
  // Método para chamar a função Netlify
  async callNetlifyFunction(data) {
    try {
      console.log(`Chamando função Netlify proxy com dados:`, data);
      
      // Usar a URL relativa para garantir compatibilidade entre ambientes
      const url = this.config.fallbackEndpoint;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = errorData.error || `${response.status} ${response.statusText}`;
        } catch (e) {
          errorText = `${response.status} ${response.statusText}`;
        }
        throw new Error(`Erro no proxy: ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('Resposta da função Netlify:', responseData.tipo);
      
      return responseData;
    } catch (error) {
      console.error('Erro ao chamar função Netlify:', error);
      throw error;
    }
  },
  
  // Método para registrar eventos de progresso
  reportarProgresso(fase, porcentagem, mensagem) {
    const evento = new CustomEvent('benetrip_progress', {
      detail: {
        fase,
        porcentagem,
        mensagem
      }
    });
    
    window.dispatchEvent(evento);
    document.dispatchEvent(evento);
    console.log(`Progresso: ${fase} ${porcentagem}% - ${mensagem}`);
  },
  
  // Método para obter recomendações de destinos
  async obterRecomendacoes(preferenciasUsuario) {
    if (!this.isInitialized()) {
      this.init();
    }
    
    // Validar entrada
    if (!preferenciasUsuario) {
      throw new Error('Preferências de usuário não fornecidas');
    }
    
    // Gerar chave de cache
    const cacheKey = this.generateCacheId(preferenciasUsuario);
    
    // Verificar cache
    if (this.hasCachedData(cacheKey)) {
      console.log('Usando recomendações em cache para:', cacheKey);
      this.reportarProgresso('cache', 100, 'Usando recomendações armazenadas para você...');
      return this.cache.recommendations[cacheKey];
    }
    
    try {
      // Reportar progresso inicial
      this.reportarProgresso('inicializando', 10, 'Preparando recomendações personalizadas...');
      
      // Reportar progresso
      this.reportarProgresso('processando', 30, 'Analisando suas preferências de viagem...');
      
      // Chamar a função proxy no Netlify
      const resposta = await this.callNetlifyFunction(preferenciasUsuario);
      
      // Verificar formato da resposta
      if (!resposta || !resposta.conteudo) {
        throw new Error('Resposta inválida do serviço de IA');
      }
      
      // Reportar progresso
      this.reportarProgresso('finalizando', 70, 'Encontrando os destinos perfeitos para você...');
      
      // Extrair e processar recomendações
      const recomendacoes = this.extrairJSON(resposta.conteudo);
      
      // Validar estrutura básica das recomendações
      if (!recomendacoes.topPick || !Array.isArray(recomendacoes.alternativas)) {
        throw new Error('Formato de recomendações inválido. Dados: ' + JSON.stringify(recomendacoes));
      }
      
      // Garantir que temos 4 alternativas exatamente
      while (recomendacoes.alternativas.length > 4) {
        recomendacoes.alternativas.pop();
      }
      
      // Garantir que temos o destino surpresa
      if (!recomendacoes.surpresa && recomendacoes.alternativas.length > 0) {
        // Usar último alternativo como surpresa
        console.log('Criando destino surpresa a partir de alternativa');
        recomendacoes.surpresa = {
          ...recomendacoes.alternativas.pop(),
          descricao: "Um destino surpreendente que poucos conhecem!",
          destaque: "Experiência única que vai te surpreender",
          comentario: "Este é um destino surpresa especial que farejei só para você! Confie no meu faro! 🐾🎁"
        };
      }
      
      // Se ainda não tivermos surpresa, criar uma fictícia
      if (!recomendacoes.surpresa) {
        console.log('Criando destino surpresa fictício');
        recomendacoes.surpresa = this.config.mockData.surpresa;
      }
      
      // Adicionar alternativas se estiverem faltando
      while (recomendacoes.alternativas.length < 4) {
        const mockAlternativa = this.config.mockData.alternativas[recomendacoes.alternativas.length];
        if (mockAlternativa) {
          console.log('Adicionando alternativa fictícia');
          recomendacoes.alternativas.push(mockAlternativa);
        } else {
          break;
        }
      }
      
      // Reportar progresso final
      this.reportarProgresso('concluido', 100, 'Destinos encontrados!');
      
      // Armazenar no cache
      this.cache.recommendations[cacheKey] = recomendacoes;
      this.cache.timestamp[cacheKey] = Date.now();
      this.saveCacheToStorage();
      
      // Salvar no localStorage para uso em outras páginas também
      localStorage.setItem('benetrip_recomendacoes', JSON.stringify(recomendacoes));
      
      return recomendacoes;
    } catch (erro) {
      console.error('Erro ao obter recomendações:', erro);
      
      // Tentar usar cache mesmo em produção em caso de erro
      if (this.cache.recommendations[cacheKey]) {
        console.warn('Usando cache de emergência devido a erro');
        return this.cache.recommendations[cacheKey];
      }
      
      // Se nenhum cache disponível, usar dados mockados
      console.warn('Usando dados mockados devido a erro e falta de cache');
      
      // Armazenar os dados mockados para uso futuro
      this.cache.recommendations[cacheKey] = this.config.mockData;
      this.cache.timestamp[cacheKey] = Date.now();
      this.saveCacheToStorage();
      
      // Salvar no localStorage também
      localStorage.setItem('benetrip_recomendacoes', JSON.stringify(this.config.mockData));
      
      // Mostrar erro
      throw new Error('Não foi possível gerar recomendações no momento. Por favor, tente novamente mais tarde.');
    }
  }
};

// Inicializar o serviço quando o script for carregado
window.BENETRIP_AI.init();
