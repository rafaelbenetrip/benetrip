// Serviço de IA para o Benetrip
window.BENETRIP_AI = {
  // Configurações do serviço
  config: {
    cacheDuration: 24 * 60 * 60 * 1000, // 24 horas em ms
    apiEndpoint: '/api/recommendations',
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
      console.log('Erro ao fazer parse direto, tentando extrair do texto');
      
      // Se falhar, tenta extrair JSON de bloco de código ou texto
      try {
        // Busca por blocos de código JSON
        const blocoCodigo = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (blocoCodigo && blocoCodigo[1]) {
          const jsonLimpo = blocoCodigo[1].trim();
          console.log('JSON extraído de bloco de código:', jsonLimpo.substring(0, 100) + '...');
          return JSON.parse(jsonLimpo);
        }
        
        // Busca pela primeira ocorrência de chaves balanceadas
        let depth = 0;
        let start = -1;
        
        for (let i = 0; i < texto.length; i++) {
          if (texto[i] === '{') {
            if (depth === 0) start = i;
            depth++;
          } else if (texto[i] === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
              const jsonStr = texto.substring(start, i + 1);
              console.log('JSON extraído do texto usando análise de profundidade:', jsonStr.substring(0, 100) + '...');
              return JSON.parse(jsonStr);
            }
          }
        }
        
        // Último recurso: busca por regex simples
        const match = texto.match(/(\{[\s\S]*\})/);
        if (match && match[0]) {
          const jsonPotencial = match[0];
          console.log('JSON extraído de texto usando regex:', jsonPotencial.substring(0, 100) + '...');
          return JSON.parse(jsonPotencial);
        }
        
        throw new Error('Não foi possível extrair JSON válido da resposta');
      } catch (innerError) {
        console.error('Erro ao extrair JSON do texto:', innerError);
        throw new Error('Não foi possível extrair JSON válido da resposta');
      }
    }
  },
  
  // Método para chamar a função Netlify
  async callNetlifyFunction(data) {
    try {
      console.log(`Chamando função Netlify proxy com dados:`, data);
      
      // Usar URL absoluta para garantir compatibilidade entre ambientes
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
  
  // Método para validar a estrutura dos dados das recomendações
  validarEstruturaDados(dados) {
    // Verificar estrutura básica
    if (!dados.topPick || !Array.isArray(dados.alternativas)) {
      console.error('Estrutura básica de dados inválida:', dados);
      throw new Error('Formato de dados inválido');
    }
    
    // Garantir que haja alternativas suficientes
    if (!dados.alternativas || dados.alternativas.length < 1) {
      console.warn('Alternativas insuficientes, adicionando dados fictícios');
      dados.alternativas = [...this.config.mockData.alternativas];
    }
    
    // Garantir que temos o destino surpresa
    if (!dados.surpresa && dados.alternativas.length > 0) {
      console.log('Destino surpresa não encontrado, criando a partir de alternativa');
      dados.surpresa = {
        ...dados.alternativas.pop(),
        descricao: "Um destino surpreendente que poucos conhecem!",
        destaque: "Experiência única que vai te surpreender",
        comentario: "Este é um destino surpresa especial que farejei só para você! Confie no meu faro! 🐾🎁"
      };
    }
    
    // Se ainda não tivermos surpresa, criar uma fictícia
    if (!dados.surpresa) {
      console.log('Criando destino surpresa fictício');
      dados.surpresa = this.config.mockData.surpresa;
    }
    
    return dados;
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
    
    console.log('Recebendo pedido de recomendações com preferências:', preferenciasUsuario);
    
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
      let recomendacoes;
      try {
        recomendacoes = this.extrairJSON(resposta.conteudo);
        console.log('Recomendações extraídas com sucesso:', recomendacoes);
      } catch (extractError) {
        console.error('Erro ao extrair JSON da resposta:', extractError);
        console.log('Usando dados mockados devido a erro de extração');
        this.reportarProgresso('fallback', 80, 'Usando dados mockados devido a erro e falta de cache');
        recomendacoes = {...this.config.mockData};
      }
      
      // Validar e corrigir estrutura das recomendações
      try {
        recomendacoes = this.validarEstruturaDados(recomendacoes);
      } catch (validationError) {
        console.error('Erro na validação dos dados:', validationError);
        console.log('Usando dados mockados devido a erro de validação');
        this.reportarProgresso('fallback', 85, 'Usando dados mockados devido a erro de validação');
        recomendacoes = {...this.config.mockData};
      }
      
      // Garantir que temos 4 alternativas exatamente
      while (recomendacoes.alternativas.length > 4) {
        recomendacoes.alternativas.pop();
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
      
      // Tentar usar cache mesmo que seja antigo
      if (this.cache.recommendations[cacheKey]) {
        console.warn('Usando cache de emergência devido a erro');
        this.reportarProgresso('cache-emergencia', 100, 'Usando recomendações armazenadas (emergência)...');
        return this.cache.recommendations[cacheKey];
      }
      
      // Se não tiver cache, usar dados mockados
      console.log('Usando dados mockados devido a erro e falta de cache');
      this.reportarProgresso('mockados', 100, 'Usando recomendações padrão devido a erro...');
      
      const dadosMockados = {...this.config.mockData};
      
      // Armazenar no cache para futuras requisições
      this.cache.recommendations[cacheKey] = dadosMockados;
      this.cache.timestamp[cacheKey] = Date.now();
      this.saveCacheToStorage();
      
      // Salvar no localStorage para uso em outras páginas também
      localStorage.setItem('benetrip_recomendacoes', JSON.stringify(dadosMockados));
      
      return dadosMockados;
    }
  }
};

// Inicializar o serviço quando o script for carregado
window.BENETRIP_AI.init();
