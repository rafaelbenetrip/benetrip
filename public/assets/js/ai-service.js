// Serviço de IA para o Benetrip - Versão Vercel com Perplexity
window.BENETRIP_AI = {
  // Configurações do serviço
  config: {
    apiEndpoint: '/api/recommendations', // Endpoint Vercel
    imageApiEndpoint: '/api/image-search', // Endpoint Vercel para busca de imagens
    apiTimeout: 60000, // 60 segundos de timeout
    maxRetries: 2, // Número máximo de tentativas em caso de falha
    retryDelay: 1000, // Tempo entre tentativas em ms
    mockData: { // Dados de exemplo para casos de falha
      "topPick": {
        "destino": "Medellín",
        "pais": "Colômbia",
        "codigoPais": "CO",
        "descricao": "Cidade da eterna primavera com clima perfeito o ano todo",
        "porque": "Clima primaveril o ano todo com paisagens montanhosas deslumbrantes",
        "destaque": "Passeio de teleférico, Comuna 13 e fazendas de café próximas",
        "comentario": "Eu simplesmente AMEI Medellín! Perfeito para quem busca um mix de cultura e natureza! 🐾",
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
  
  // Inicialização do serviço
  init() {
    console.log('Inicializando serviço de IA do Benetrip');
    this.initialized = true;
    this._ultimaRequisicao = null;
    this._requestsInProgress = {};
    
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

  // Gera um ID de requisição baseado nas preferências
  generateRequestId(preferences) {
    // Extrair valores relevantes para formar uma chave de identificação
    const companhia = preferences.companhia || '0';
    const preferencia = preferences.preferencia_viagem || '0';
    const moeda = preferences.moeda_escolhida || 'BRL';
    const origem = preferences.cidade_partida?.name || 'default';
    
    return `${origem}_${companhia}_${preferencia}_${moeda}`;
  },
  
  // Método para extrair JSON de texto, lidando com diferentes formatos
  extrairJSON(texto) {
    // Se já for um objeto, retornar diretamente
    if (texto && typeof texto === 'object') {
      return texto;
    }
    
    // Se for nulo ou undefined, retorna objeto vazio
    if (!texto) {
      console.warn('Texto de resposta vazio');
      return {};
    }
    
    // Primeiro, tenta fazer parse direto
    try {
      return JSON.parse(texto);
    } catch (e) {
      console.log('Erro ao fazer parse direto, tentando extrair do texto:', e.message);
      
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
        
        // Se nada funcionar, retorna um objeto vazio
        console.warn('Não foi possível extrair JSON válido da resposta, retornando objeto vazio');
        return {};
      } catch (innerError) {
        console.error('Erro ao extrair JSON do texto:', innerError);
        return {};
      }
    }
  },

  // Delay de espera - útil para retries
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Método para chamar a API do Vercel com suporte a retry
  async callVercelAPI(data, retryCount = 0) {
    try {
      console.log(`Chamando API Vercel com dados:`, data);
      
      // URL absoluta da API
      const apiUrl = this.config.apiEndpoint;
      const baseUrl = window.location.origin;
      
      // Criar URL completa se for relativa
      const fullUrl = apiUrl.startsWith('http') ? apiUrl : baseUrl + apiUrl;
      
      console.log('Enviando requisição para:', fullUrl);

      // Criar controller para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.apiTimeout);
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      
      // Limpar timeout
      clearTimeout(timeoutId);
      
      // Verificar se a resposta foi bem-sucedida
      if (!response.ok) {
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = errorData.error || `${response.status} ${response.statusText}`;
        } catch (e) {
          errorText = `${response.status} ${response.statusText}`;
        }
        throw new Error(`Erro na API: ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('Resposta da API Vercel recebida:', responseData.tipo || 'sem tipo');
      
      return responseData;
    } catch (error) {
      console.error('Erro ao chamar API Vercel:', error);
      
      // Verificar se é um erro de timeout ou aborto
      const isTimeoutError = error.name === 'AbortError' || error.message.includes('timeout');
      
      // Tentar novamente se for um erro de rede ou timeout e não exceder o máximo de tentativas
      if ((isTimeoutError || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) 
          && retryCount < this.config.maxRetries) {
        console.log(`Tentativa ${retryCount + 1} falhou. Tentando novamente em ${this.config.retryDelay}ms...`);
        await this.sleep(this.config.retryDelay);
        return this.callVercelAPI(data, retryCount + 1);
      }
      
      // Se for erro de CORS, tentar com formatos alternativos
      if (error.message.includes('CORS') && retryCount < 1) {
        console.log('Erro de CORS detectado, tentando abordagem alternativa...');
        try {
          // Tentar com jsonp ou outro método
          // Esta é apenas uma simulação de resposta para não travar o fluxo
          console.log('Retornando dados simulados devido ao erro de CORS');
          return {
            tipo: "simulado-cors",
            conteudo: JSON.stringify(this.config.mockData)
          };
        } catch (corsError) {
          console.error('Erro na abordagem alternativa para CORS:', corsError);
        }
      }
      
      // Simulação de resposta para não travar o fluxo
      console.log('Retornando dados simulados devido ao erro');
      return {
        tipo: "simulado-error",
        conteudo: JSON.stringify(this.config.mockData)
      };
    }
  },
  
  // NOVA FUNÇÃO: Método para buscar imagens para um destino
  async buscarImagensParaDestino(destino, pais) {
    try {
      const query = `${destino} ${pais} tourism`;
      console.log(`Buscando imagens para: ${query}`);
      
      // URL da API de imagens
      const apiUrl = this.config.imageApiEndpoint;
      const baseUrl = window.location.origin;
      
      // Criar URL completa se for relativa
      const fullUrl = apiUrl.startsWith('http') ? apiUrl : baseUrl + apiUrl;
      
      // Adicionar parâmetros como query string
      const url = new URL(fullUrl);
      url.searchParams.append('query', query);
      
      console.log('Enviando requisição para API de imagens:', url.toString());
      
      // Criar controller para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.apiTimeout);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      // Limpar timeout
      clearTimeout(timeoutId);
      
      // Verificar se a resposta foi bem-sucedida
      if (!response.ok) {
        throw new Error(`Erro ao buscar imagens: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Imagens recebidas para ${destino}:`, data.images?.length || 0);
      
      if (data.images && data.images.length > 0) {
        return data.images;
      } else {
        console.warn(`Nenhuma imagem encontrada para ${destino}, usando placeholders`);
        throw new Error('Nenhuma imagem encontrada');
      }
    } catch (error) {
      console.error(`Erro ao buscar imagens para ${destino}:`, error);
      
      // Retornar imagens placeholder em caso de erro
      return [
        {
          url: `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(destino)}`,
          source: "placeholder",
          photographer: "Placeholder",
          sourceUrl: "#",
          alt: `${destino}, ${pais}`
        },
        {
          url: `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(pais)}`,
          source: "placeholder",
          photographer: "Placeholder",
          sourceUrl: "#",
          alt: `${destino}, ${pais}`
        }
      ];
    }
  },
  
  // NOVA FUNÇÃO: Método para buscar imagens para todos os destinos nas recomendações
  async enriquecerRecomendacoesComImagens(recomendacoes) {
    if (!recomendacoes) return recomendacoes;
    
    this.reportarProgresso('imagens', 80, 'Buscando imagens para os destinos...');
    
    try {
      // Clonar objeto para não modificar o original
      const recomendacoesEnriquecidas = JSON.parse(JSON.stringify(recomendacoes));
      
      // Buscar imagens para o destino principal
      if (recomendacoesEnriquecidas.topPick) {
        const imagens = await this.buscarImagensParaDestino(
          recomendacoesEnriquecidas.topPick.destino,
          recomendacoesEnriquecidas.topPick.pais
        );
        recomendacoesEnriquecidas.topPick.imagens = imagens;
      }
      
      // Buscar imagens para as alternativas (de forma sequencial para evitar sobrecarga)
      if (recomendacoesEnriquecidas.alternativas && Array.isArray(recomendacoesEnriquecidas.alternativas)) {
        for (let i = 0; i < recomendacoesEnriquecidas.alternativas.length; i++) {
          const alternativa = recomendacoesEnriquecidas.alternativas[i];
          
          // Adicionar um pequeno delay para evitar muitas requisições simultâneas
          await this.sleep(300);
          
          const imagens = await this.buscarImagensParaDestino(
            alternativa.destino,
            alternativa.pais
          );
          alternativa.imagens = imagens;
        }
      }
      
      // Buscar imagens para o destino surpresa
      if (recomendacoesEnriquecidas.surpresa) {
        await this.sleep(300);
        const imagens = await this.buscarImagensParaDestino(
          recomendacoesEnriquecidas.surpresa.destino,
          recomendacoesEnriquecidas.surpresa.pais
        );
        recomendacoesEnriquecidas.surpresa.imagens = imagens;
      }
      
      this.reportarProgresso('imagens', 100, 'Imagens carregadas com sucesso!');
      
      console.log('Recomendações enriquecidas com imagens:', recomendacoesEnriquecidas);
      return recomendacoesEnriquecidas;
    } catch (error) {
      console.error('Erro ao enriquecer recomendações com imagens:', error);
      this.reportarProgresso('imagens', 100, 'Erro ao carregar algumas imagens');
      
      // Retornar recomendações originais em caso de erro
      return recomendacoes;
    }
  },
  
  // Método para validar a estrutura dos dados das recomendações
  validarEstruturaDados(dados) {
    // Verificar se dados é nulo ou undefined
    if (!dados) {
      console.error('Dados de recomendações são nulos ou indefinidos');
      return {...this.config.mockData};
    }
    
    // Verificar estrutura básica
    if (!dados.topPick) {
      console.error('Destino principal não encontrado nos dados');
      dados.topPick = this.config.mockData.topPick;
    }
    
    // Verificar se alternativas existem
    if (!dados.alternativas || !Array.isArray(dados.alternativas)) {
      console.error('Alternativas não encontradas ou não são um array');
      dados.alternativas = [...this.config.mockData.alternativas];
    }
    
    // Garantir que haja alternativas suficientes
    if (dados.alternativas.length < 1) {
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
  
  // Método para obter recomendações de destinos com Perplexity
  async obterRecomendacoes(preferenciasUsuario) {
    if (!this.isInitialized()) {
      this.init();
    }
    
    // Validar entrada
    if (!preferenciasUsuario) {
      throw new Error('Preferências de usuário não fornecidas');
    }
    
    console.log('Recebendo pedido de recomendações com preferências:', preferenciasUsuario);
    
    // Gerar ID para rastrear requisições duplicadas
    const requestId = this.generateRequestId(preferenciasUsuario);
    
    // Evitar chamadas duplicadas para o mesmo requestId
    if (this._requestsInProgress[requestId]) {
      console.log('Requisição já em andamento para:', requestId);
      this.reportarProgresso('aguardando', 50, 'Aguardando requisição em andamento...');
      
      // Aguardar a requisição em andamento ser concluída
      try {
        return await this._requestsInProgress[requestId];
      } catch (error) {
        console.error('Erro na requisição em andamento:', error);
        // Continuar com uma nova requisição
      }
    }
    
    // Criar uma promise para esta requisição e armazená-la
    const requestPromise = (async () => {
      try {
        // Reportar progresso inicial
        this.reportarProgresso('inicializando', 10, 'Preparando recomendações personalizadas...');
        
        // Reportar progresso
        this.reportarProgresso('processando', 30, 'Analisando suas preferências de viagem...');
        
        // Chamar a API do Vercel para processamento com Perplexity
        const resposta = await this.callVercelAPI(preferenciasUsuario);
        
        // Verificar formato da resposta
        if (!resposta) {
          throw new Error('Resposta vazia do serviço de IA');
        }
        
        // Reportar progresso
        this.reportarProgresso('finalizando', 70, 'Encontrando os destinos perfeitos para você...');
        
        // Extrair e processar recomendações
        let recomendacoes;
        try {
          // Se for tipo erro mas com dados fallback
          if (resposta.tipo === 'erro' && resposta.conteudo) {
            const conteudoObj = this.extrairJSON(resposta.conteudo);
            if (conteudoObj.data) {
              console.log('Usando dados de fallback da resposta de erro');
              recomendacoes = conteudoObj.data;
            } else {
              throw new Error('Formato inválido nos dados de fallback');
            }
          } else if (resposta.conteudo) {
            recomendacoes = this.extrairJSON(resposta.conteudo);
            console.log('Recomendações extraídas com sucesso:', recomendacoes);
          } else {
            throw new Error('Conteúdo da resposta não encontrado');
          }
        } catch (extractError) {
          console.error('Erro ao extrair JSON da resposta:', extractError);
          console.log('Usando dados mockados devido a erro de extração');
          this.reportarProgresso('fallback', 80, 'Usando dados padrão devido a erro de processamento');
          recomendacoes = {...this.config.mockData};
        }
        
        // Validar e corrigir estrutura das recomendações
        try {
          recomendacoes = this.validarEstruturaDados(recomendacoes);
        } catch (validationError) {
          console.error('Erro na validação dos dados:', validationError);
          console.log('Usando dados mockados devido a erro de validação');
          this.reportarProgresso('fallback', 85, 'Usando dados padrão devido a erro de validação');
          recomendacoes = {...this.config.mockData};
        }
        
        // Garantir que temos 4 alternativas exatamente
        while (recomendacoes.alternativas && recomendacoes.alternativas.length > 4) {
          recomendacoes.alternativas.pop();
        }
        
        // Adicionar alternativas se estiverem faltando
        if (recomendacoes.alternativas) {
          while (recomendacoes.alternativas.length < 4) {
            const mockAlternativa = this.config.mockData.alternativas[recomendacoes.alternativas.length];
            if (mockAlternativa) {
              console.log('Adicionando alternativa fictícia');
              recomendacoes.alternativas.push(mockAlternativa);
            } else {
              break;
            }
          }
        }
        
        // NOVO: Enriquecer com imagens
        this.reportarProgresso('imagens', 85, 'Buscando imagens para os destinos...');
        try {
          recomendacoes = await this.enriquecerRecomendacoesComImagens(recomendacoes);
        } catch (imageError) {
          console.error('Erro ao adicionar imagens às recomendações:', imageError);
          // Continuar com as recomendações sem imagens
        }
        
        // Reportar progresso final
        this.reportarProgresso('concluido', 100, 'Destinos encontrados!');
        
        // Salvar no localStorage apenas para uso em outras páginas se necessário
        localStorage.setItem('benetrip_recomendacoes', JSON.stringify(recomendacoes));
        
        return recomendacoes;
      } catch (erro) {
        console.error('Erro ao obter recomendações:', erro);
        
        // Usar dados mockados em caso de erro
        console.log('Usando dados mockados devido a erro');
        this.reportarProgresso('mockados', 100, 'Usando recomendações padrão devido a erro...');
        
        const dadosMockados = {...this.config.mockData};
        
        // Salvar no localStorage para uso em outras páginas se necessário
        localStorage.setItem('benetrip_recomendacoes', JSON.stringify(dadosMockados));
        
        return dadosMockados;
      } finally {
        // Remover a promise em andamento quando terminar
        delete this._requestsInProgress[requestId];
      }
    })();
    
    // Armazenar a promise para evitar chamadas duplicadas
    this._requestsInProgress[requestId] = requestPromise;
    
    return requestPromise;
  }
};

// Inicializar o serviço quando o script for carregado
window.BENETRIP_AI.init();
