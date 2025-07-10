// Serviço de IA para o Benetrip - Versão Otimizada para Deepseek R1
window.BENETRIP_AI = {
  // Configurações do serviço
  config: {
    apiEndpoint: '/api/recommendations',
    imageApiEndpoint: '/api/image-search',
    apiTimeout: 300000, // 5 minutos - ajustado para Deepseek R1 Reasoner
    maxRetries: 2, // Reduzido já que a API tem seu próprio retry
    retryDelay: 3000, // Aumentado para dar tempo ao R1 processar
    imagensQtdPorTipo: {
      topPick: 2,
      alternativa: 1,
      surpresa: 2
    },
    // Mock data simplificado e mais compatível
    mockData: {
      "topPick": {
        "destino": "Lisboa",
        "pais": "Portugal",
        "codigoPais": "PT",
        "descricao": "Capital histórica com vista para o rio Tejo",
        "porque": "Excelente custo-benefício, rica gastronomia e cultura acessível",
        "destaque": "Explorar os bairros históricos ao pôr do sol",
        "comentario": "Lisboa me encantou! Os miradouros têm vistas de tirar o fôlego e explorar a Torre de Belém foi uma aventura e tanto! 🐾",
        "pontosTuristicos": ["Torre de Belém", "Alfama"],
        "clima": {
          "temperatura": "16°C-26°C",
          "condicoes": "Clima mediterrâneo com muitos dias ensolarados",
          "recomendacoes": "Roupas leves e um casaco fino para as noites"
        },
        "aeroporto": {
          "codigo": "LIS",
          "nome": "Aeroporto Humberto Delgado"
        },
        "preco": {
          "voo": 2400,
          "hotel": 250
        }
      },
      "alternativas": [
        {
          "destino": "Porto",
          "pais": "Portugal",
          "codigoPais": "PT",
          "porque": "Cidade histórica à beira do Rio Douro",
          "pontoTuristico": "Vale do Douro",
          "aeroporto": {
            "codigo": "OPO",
            "nome": "Aeroporto Francisco Sá Carneiro"
          },
          "preco": {
            "voo": 2200,
            "hotel": 180
          }
        },
        {
          "destino": "Santiago",
          "pais": "Chile",
          "codigoPais": "CL",
          "porque": "Cidade moderna cercada por montanhas",
          "pontoTuristico": "Cerro San Cristóbal",
          "aeroporto": {
            "codigo": "SCL",
            "nome": "Aeroporto de Santiago"
          },
          "preco": {
            "voo": 2500,
            "hotel": 200
          }
        },
        {
          "destino": "Cidade do México",
          "pais": "México",
          "codigoPais": "MX",
          "porque": "Rica cultura e gastronomia única",
          "pontoTuristico": "Teotihuacán",
          "aeroporto": {
            "codigo": "MEX",
            "nome": "Aeroporto da Cidade do México"
          },
          "preco": {
            "voo": 2300,
            "hotel": 190
          }
        }
      ],
      "surpresa": {
        "destino": "Montevidéu",
        "pais": "Uruguai",
        "codigoPais": "UY",
        "descricao": "Capital tranquila com praias urbanas",
        "porque": "Destino menos procurado com rica cultura e gastronomia",
        "destaque": "Degustar carnes uruguaias premium",
        "comentario": "Montevidéu é uma descoberta incrível! Passeei pelo Mercado del Puerto, onde os aromas das parrillas me deixaram babando! A Rambla é maravilhosa! 🐾",
        "pontosTuristicos": ["Mercado del Puerto", "Rambla de Montevidéu"],
        "clima": {
          "temperatura": "15°C-22°C",
          "condicoes": "Temperado com brisa marítima",
          "recomendacoes": "Casaco leve para as noites"
        },
        "aeroporto": {
          "codigo": "MVD",
          "nome": "Aeroporto de Montevidéu"
        },
        "preco": {
          "voo": 2100,
          "hotel": 170
        }
      }
    }
  },
  
  // Inicialização do serviço
  init() {
    console.log('🚀 Inicializando serviço de IA Benetrip (Deepseek R1 Ready)');
    this.initialized = true;
    this._requestsInProgress = {};
    this._cacheImagens = {};
    
    window.addEventListener('benetrip_progress', (event) => {
      console.log(`📊 Progresso: ${JSON.stringify(event.detail)}`);
    });
    
    return this;
  },
  
  isInitialized() {
    return this.initialized === true;
  },

  generateRequestId(preferences) {
    const companhia = preferences.companhia || '0';
    const preferencia = preferences.preferencia_viagem || '0';
    const origem = preferences.cidade_partida?.name || 'default';
    const orcamento = preferences.orcamento_valor || '3000';
    
    return `${origem}_${companhia}_${preferencia}_${orcamento}`;
  },
  
  // Método simplificado para extrair JSON
  extrairJSON(texto) {
    if (texto && typeof texto === 'object') return texto;
    if (!texto) return {};
    
    try {
      return JSON.parse(texto);
    } catch (e) {
      // Busca por JSON em blocos de código
      const blocoCodigo = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (blocoCodigo && blocoCodigo[1]) {
        try {
          return JSON.parse(blocoCodigo[1].trim());
        } catch (parseError) {
          console.warn('Erro ao fazer parse do bloco de código');
        }
      }
      
      // Busca por JSON no texto
      const match = texto.match(/(\{[\s\S]*\})/);
      if (match && match[0]) {
        try {
          return JSON.parse(match[0]);
        } catch (parseError) {
          console.warn('Erro ao fazer parse do JSON encontrado');
        }
      }
      
      console.warn('Não foi possível extrair JSON válido, retornando dados mock');
      return this.config.mockData;
    }
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Método otimizado para chamar a API Vercel (sem gerar prompt no frontend)
  async callVercelAPI(data, retryCount = 0) {
    try {
      console.log(`🔥 Chamando API Vercel (Deepseek R1) com dados:`, data);
      
      const apiUrl = this.config.apiEndpoint;
      const baseUrl = window.location.origin;
      const fullUrl = apiUrl.startsWith('http') ? apiUrl : baseUrl + apiUrl;
      
      console.log('📡 Enviando requisição para:', fullUrl);

      // ✅ REMOVIDO: Não gera prompt no frontend, deixa a API fazer isso
      const requestData = data; // Envia dados direto, sem adicionar prompt

      // Implementar retry com backoff exponencial
      let retryDelay = this.config.retryDelay;
      let maxRetries = this.config.maxRetries;
      let lastError = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          console.log(`🔄 Tentativa ${attempt} de ${maxRetries} após ${retryDelay}ms...`);
          this.reportarProgresso('retry', 30 + (attempt * 20), `Tentando novamente... (${attempt}/${maxRetries})`);
          await this.sleep(retryDelay);
          retryDelay *= 1.5; // Backoff mais suave para R1
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.config.apiTimeout);
          
          const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(requestData),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
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
          console.log('✅ Resposta da API recebida:', responseData.tipo || 'sem tipo');
          
          return responseData;
          
        } catch (fetchError) {
          lastError = fetchError;
          console.warn(`❌ Tentativa ${attempt + 1} falhou:`, fetchError.message);
          
          if (attempt < maxRetries) {
            continue;
          } else {
            throw fetchError;
          }
        }
      }
      
      throw lastError || new Error('Falha em todas as tentativas de conexão');
      
    } catch (error) {
      console.error('❌ Erro ao chamar API Vercel:', error);
      
      // Fallback mais robusto
      console.log('🆘 Retornando dados mock devido ao erro');
      return {
        tipo: "mock-error",
        conteudo: JSON.stringify(this.config.mockData)
      };
    }
  },
  
  // Método otimizado para buscar imagens
  async buscarImagensParaDestino(destino, pais, descricao = '', porque = '', 
                               pontosTuristicos = [], quantidadeImagens = 2) {
    try {
      const cacheKey = `${destino}_${pontosTuristicos.join('_')}`;
      if (this._cacheImagens[cacheKey]) {
        return this._cacheImagens[cacheKey].slice(0, quantidadeImagens);
      }
      
      if (typeof pontosTuristicos === 'string') {
        pontosTuristicos = [pontosTuristicos];
      }
      
      const query = `${destino} ${pais}`;
      console.log(`📸 Buscando imagens para: ${query}`);
      
      const apiUrl = this.config.imageApiEndpoint;
      const baseUrl = window.location.origin;
      const fullUrl = apiUrl.startsWith('http') ? apiUrl : baseUrl + apiUrl;
      
      const url = new URL(fullUrl);
      url.searchParams.append('query', query);
      url.searchParams.append('perPage', quantidadeImagens);
      url.searchParams.append('descricao', `${descricao} ${porque}`.trim());
      
      if (pontosTuristicos && pontosTuristicos.length > 0) {
        url.searchParams.append('pontosTuristicos', JSON.stringify(pontosTuristicos));
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data.images && data.images.length > 0) {
          this._cacheImagens[cacheKey] = data.images;
          return data.images.slice(0, quantidadeImagens);
        }
      }
      
      throw new Error('Nenhuma imagem encontrada');
      
    } catch (error) {
      console.warn(`⚠️ Erro ao buscar imagens para ${destino}:`, error.message);
      
      // Fallback robusto
      const fallbackImages = [];
      for (let i = 0; i < quantidadeImagens; i++) {
        const searchTerm = i === 0 ? 
          `${destino} ${pais}` : 
          `${destino} ${pontosTuristicos[i] || 'tourism'}`;
        
        fallbackImages.push({
          url: `https://source.unsplash.com/800x600/?${encodeURIComponent(searchTerm)}`,
          source: "unsplash-fallback",
          photographer: "Unsplash",
          photographerUrl: "https://unsplash.com",
          downloadUrl: `https://source.unsplash.com/800x600/?${encodeURIComponent(searchTerm)}`,
          alt: `${destino}, ${pais}`,
          pontoTuristico: pontosTuristicos[i] || null
        });
      }
      
      return fallbackImages;
    }
  },
  
  // Método otimizado para enriquecer com imagens
  async enriquecerRecomendacoesComImagens(recomendacoes) {
    if (!recomendacoes) return recomendacoes;
    
    this.reportarProgresso('imagens', 80, 'Buscando imagens para os destinos...');
    
    try {
      const recomendacoesEnriquecidas = JSON.parse(JSON.stringify(recomendacoes));
      const promessasImagens = [];
      
      // TopPick
      if (recomendacoesEnriquecidas.topPick) {
        const pontos = recomendacoesEnriquecidas.topPick.pontosTuristicos || [];
        promessasImagens.push(
          this.buscarImagensParaDestino(
            recomendacoesEnriquecidas.topPick.destino,
            recomendacoesEnriquecidas.topPick.pais,
            recomendacoesEnriquecidas.topPick.descricao,
            recomendacoesEnriquecidas.topPick.porque,
            pontos,
            this.config.imagensQtdPorTipo.topPick
          ).then(imagens => {
            recomendacoesEnriquecidas.topPick.imagens = imagens;
          }).catch(err => console.warn('Erro imagem topPick:', err))
        );
      }
      
      // Alternativas
      if (recomendacoesEnriquecidas.alternativas?.length) {
        recomendacoesEnriquecidas.alternativas.forEach((alt, index) => {
          const pontos = alt.pontosTuristicos || [alt.pontoTuristico].filter(Boolean) || [];
          promessasImagens.push(
            this.buscarImagensParaDestino(
              alt.destino,
              alt.pais,
              "",
              alt.porque,
              pontos,
              this.config.imagensQtdPorTipo.alternativa
            ).then(imagens => {
              recomendacoesEnriquecidas.alternativas[index].imagens = imagens;
            }).catch(err => console.warn(`Erro imagem alternativa ${index}:`, err))
          );
        });
      }
      
      // Surpresa
      if (recomendacoesEnriquecidas.surpresa) {
        const pontos = recomendacoesEnriquecidas.surpresa.pontosTuristicos || [];
        promessasImagens.push(
          this.buscarImagensParaDestino(
            recomendacoesEnriquecidas.surpresa.destino,
            recomendacoesEnriquecidas.surpresa.pais,
            recomendacoesEnriquecidas.surpresa.descricao,
            recomendacoesEnriquecidas.surpresa.porque,
            pontos,
            this.config.imagensQtdPorTipo.surpresa
          ).then(imagens => {
            recomendacoesEnriquecidas.surpresa.imagens = imagens;
          }).catch(err => console.warn('Erro imagem surpresa:', err))
        );
      }
      
      // Aguardar todas as imagens com timeout
      await Promise.race([
        Promise.allSettled(promessasImagens),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout imagens')), 45000)
        )
      ]);
      
      this.reportarProgresso('imagens', 100, 'Imagens carregadas!');
      return recomendacoesEnriquecidas;
      
    } catch (error) {
      console.error('❌ Erro ao enriquecer com imagens:', error);
      return recomendacoes;
    }
  },
  
  // Validação simplificada
  validarEstruturaDados(dados) {
    if (!dados) return {...this.config.mockData};
    
    // Garantir estrutura básica
    if (!dados.topPick) dados.topPick = this.config.mockData.topPick;
    if (!dados.alternativas || !Array.isArray(dados.alternativas)) {
      dados.alternativas = [...this.config.mockData.alternativas];
    }
    if (!dados.surpresa) dados.surpresa = this.config.mockData.surpresa;
    
    // Garantir pontosTuristicos como array
    [dados.topPick, dados.surpresa, ...dados.alternativas].forEach(item => {
      if (item && !item.pontosTuristicos) {
        item.pontosTuristicos = [];
      }
    });
    
    // Limitar alternativas a 3 para compatibilidade
    if (dados.alternativas.length > 3) {
      dados.alternativas = dados.alternativas.slice(0, 3);
    }
    
    return dados;
  },
  
  reportarProgresso(fase, porcentagem, mensagem) {
    const evento = new CustomEvent('benetrip_progress', {
      detail: { fase, porcentagem, mensagem }
    });
    
    window.dispatchEvent(evento);
    console.log(`📊 Progresso: ${fase} ${porcentagem}% - ${mensagem}`);
  },
  
  // Método principal otimizado
  async obterRecomendacoes(preferenciasUsuario) {
    if (!this.isInitialized()) this.init();
    
    if (!preferenciasUsuario) {
      throw new Error('Preferências de usuário não fornecidas');
    }
    
    console.log('🎯 Obtendo recomendações com Deepseek R1:', preferenciasUsuario);
    
    const requestId = this.generateRequestId(preferenciasUsuario);
    
    // Evitar chamadas duplicadas
    if (this._requestsInProgress[requestId]) {
      console.log('⏳ Aguardando requisição em andamento...');
      return await this._requestsInProgress[requestId];
    }
    
    const requestPromise = (async () => {
      try {
        this.reportarProgresso('inicializando', 10, 'Preparando recomendações personalizadas...');
        
        this.reportarProgresso('processando', 30, 'Analisando com Deepseek R1 Reasoner...');
        
        // Chamar API otimizada
        const resposta = await this.callVercelAPI(preferenciasUsuario);
        
        if (!resposta) {
          throw new Error('Resposta vazia do serviço de IA');
        }
        
        this.reportarProgresso('finalizando', 70, 'Processando destinos encontrados...');
        
        // Extrair recomendações
        let recomendacoes;
        try {
          if (resposta.conteudo) {
            recomendacoes = this.extrairJSON(resposta.conteudo);
            console.log('✅ Recomendações extraídas:', Object.keys(recomendacoes));
          } else {
            throw new Error('Conteúdo da resposta não encontrado');
          }
        } catch (extractError) {
          console.error('❌ Erro ao extrair JSON:', extractError);
          recomendacoes = {...this.config.mockData};
        }
        
        // Validar estrutura
        recomendacoes = this.validarEstruturaDados(recomendacoes);
        
        // Enriquecer com imagens
        this.reportarProgresso('imagens', 85, 'Buscando imagens...');
        try {
          recomendacoes = await this.enriquecerRecomendacoesComImagens(recomendacoes);
        } catch (imageError) {
          console.warn('⚠️ Erro ao adicionar imagens:', imageError);
        }
        
        this.reportarProgresso('concluido', 100, 'Destinos encontrados!');
        
        // Salvar resultado
        localStorage.setItem('benetrip_recomendacoes', JSON.stringify(recomendacoes));
        
        return recomendacoes;
        
      } catch (erro) {
        console.error('❌ Erro ao obter recomendações:', erro);
        
        this.reportarProgresso('fallback', 100, 'Usando recomendações padrão...');
        
        const dadosMockados = {...this.config.mockData};
        localStorage.setItem('benetrip_recomendacoes', JSON.stringify(dadosMockados));
        
        return dadosMockados;
      } finally {
        delete this._requestsInProgress[requestId];
      }
    })();
    
    this._requestsInProgress[requestId] = requestPromise;
    return requestPromise;
  }
};

// Inicializar o serviço
window.BENETRIP_AI.init();
