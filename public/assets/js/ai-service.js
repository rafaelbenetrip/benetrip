// Serviço de IA para o Benetrip - Versão com DEBUG detalhado
window.BENETRIP_AI = {
  config: {
    apiEndpoint: '/api/recommendations',
    imageApiEndpoint: '/api/image-search',
    apiTimeout: 90000,
    maxRetries: 2,
    retryDelay: 2000,
    imagensQtdPorTipo: {
      topPick: 2,
      alternativa: 1,
      surpresa: 2
    }
  },
  
  init() {
    console.log('🚀 Inicializando serviço de IA do Benetrip com DEBUG');
    this.initialized = true;
    this._requestsInProgress = {};
    this._cacheImagens = {};
    this._cacheRecomendacoes = {};
    return this;
  },
  
  isInitialized() {
    return this.initialized === true;
  },

  generateRequestId(preferences) {
    const campos = [
      preferences.cidade_partida?.name || preferences.cidade_partida || '',
      preferences.companhia || '0',
      preferences.quantidade_familia || '',
      preferences.quantidade_amigos || '',
      preferences.preferencia_viagem || '0',
      preferences.datas?.dataIda || '',
      preferences.datas?.dataVolta || '',
      preferences.viagem_carro || '0',
      preferences.distancia_maxima || '',
      preferences.moeda_escolhida || 'BRL',
      preferences.orcamento_valor || '',
      JSON.stringify(preferences.datas || {}),
    ].join('_');
    
    return this.simpleHash(campos);
  },
  
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  },
  
  extrairJSON(texto) {
    if (texto && typeof texto === 'object') {
      return texto;
    }
    
    if (!texto) {
      throw new Error('Resposta vazia da LLM - não há dados para processar');
    }
    
    try {
      return JSON.parse(texto);
    } catch (e) {
      try {
        const blocoCodigo = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (blocoCodigo && blocoCodigo[1]) {
          return JSON.parse(blocoCodigo[1].trim());
        }
        
        let depth = 0;
        let start = -1;
        
        for (let i = 0; i < texto.length; i++) {
          if (texto[i] === '{') {
            if (depth === 0) start = i;
            depth++;
          } else if (texto[i] === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
              return JSON.parse(texto.substring(start, i + 1));
            }
          }
        }
        
        const match = texto.match(/(\{[\s\S]*\})/);
        if (match && match[0]) {
          return JSON.parse(match[0]);
        }
        
        throw new Error('Não foi possível extrair JSON válido da resposta da LLM');
      } catch (innerError) {
        throw new Error(`Falha ao processar resposta da LLM: ${innerError.message}`);
      }
    }
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Manter funções auxiliares básicas (código omitido por brevidade)
  getTipoDestinoText(tipoDestino) {
    switch(tipoDestino) {
      case 0: return "Nacional";
      case 1: return "Internacional";
      default: return "Destinos variados";
    }
  },

  getFamaDestinoText(famaDestino) {
    switch(famaDestino) {
      case 0: return "Destinos famosos";
      case 1: return "Destinos alternativos";
      default: return "Mix de destinos";
    }
  },

  calcularDuracaoViagem(dataIda, dataVolta) {
    const ida = new Date(dataIda);
    const volta = new Date(dataVolta);
    const diffTime = Math.abs(volta - ida);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  },

  // Função gerarPromptParaDestinos simplificada para debug
  gerarPromptParaDestinos(dados) {
    const cidadeOrigem = dados.cidade_partida?.name || "São Paulo";
    const dataIda = dados.datas?.dataIda || new Date().toISOString().split('T')[0];
    const dataVolta = dados.datas?.dataVolta || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return `Crie recomendações de viagem para:
- Origem: ${cidadeOrigem}
- Período: ${dataIda} a ${dataVolta}

Retorne apenas JSON válido no formato:
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "descricao": "Descrição do destino",
    "porque": "Por que visitar",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"]
  },
  "alternativas": [
    {
      "destino": "Cidade 1",
      "pais": "País 1", 
      "porque": "Motivo"
    }
  ],
  "surpresa": {
    "destino": "Cidade Surpresa",
    "pais": "País",
    "porque": "Motivo surpresa"
  }
}`;
  },
  
  // 🔍 VERSÃO COM DEBUG DETALHADO da callVercelAPI
  async callVercelAPI(data, retryCount = 0) {
    try {
      console.log('🔍 DEBUG: Iniciando callVercelAPI');
      console.log('📊 DEBUG: Dados recebidos:', {
        cidade_partida: data.cidade_partida,
        companhia: data.companhia,
        datas: data.datas,
        tipo: typeof data
      });
      
      const apiUrl = this.config.apiEndpoint;
      const baseUrl = window.location.origin;
      const fullUrl = apiUrl.startsWith('http') ? apiUrl : baseUrl + apiUrl;
      
      console.log('🌐 DEBUG: URL da API:', fullUrl);
      
      const prompt = this.gerarPromptParaDestinos(data);
      console.log('📝 DEBUG: Prompt gerado (primeiros 200 chars):', prompt.substring(0, 200) + '...');
      
      const requestData = { ...data, prompt: prompt };
      console.log('📤 DEBUG: Request data keys:', Object.keys(requestData));

      let retryDelay = this.config.retryDelay;
      let maxRetries = this.config.maxRetries;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          console.log(`🔄 DEBUG: Tentativa ${attempt} após ${retryDelay}ms...`);
          await this.sleep(retryDelay);
          retryDelay *= 2;
        }

        try {
          console.log(`📡 DEBUG: Enviando requisição (tentativa ${attempt + 1})...`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            console.log('⏰ DEBUG: Timeout atingido!');
            controller.abort();
          }, this.config.apiTimeout);
          
          const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Connection': 'keep-alive'
            },
            body: JSON.stringify(requestData),
            signal: controller.signal,
            keepalive: true
          });
          
          clearTimeout(timeoutId);
          
          console.log('📥 DEBUG: Response status:', response.status);
          console.log('📥 DEBUG: Response headers:', Object.fromEntries(response.headers.entries()));
          
          if (!response.ok) {
            console.log('❌ DEBUG: Response não OK');
            let errorText = '';
            try {
              const errorData = await response.json();
              console.log('📄 DEBUG: Error data:', errorData);
              errorText = errorData.error || `${response.status} ${response.statusText}`;
            } catch (e) {
              console.log('❌ DEBUG: Erro ao ler error data:', e);
              errorText = `${response.status} ${response.statusText}`;
            }
            throw new Error(`Erro na API: ${errorText}`);
          }
          
          // 🔍 DEBUG CRÍTICO: Analisar resposta detalhadamente
          let responseData;
          try {
            const responseText = await response.text();
            console.log('📄 DEBUG: Response text (primeiros 500 chars):', responseText.substring(0, 500));
            console.log('📄 DEBUG: Response text length:', responseText.length);
            console.log('📄 DEBUG: Response text type:', typeof responseText);
            
            if (!responseText || responseText.trim() === '') {
              throw new Error('Response text está vazio');
            }
            
            responseData = JSON.parse(responseText);
            console.log('📊 DEBUG: Response data parsed:', {
              tipo: responseData.tipo,
              hasConteudo: !!responseData.conteudo,
              conteudoLength: responseData.conteudo ? responseData.conteudo.length : 0,
              keys: Object.keys(responseData)
            });
            
          } catch (parseError) {
            console.error('❌ DEBUG: Erro ao fazer parse da resposta:', parseError);
            throw new Error(`Erro ao fazer parse da resposta: ${parseError.message}`);
          }
          
          console.log('✅ DEBUG: Resposta da API processada com sucesso');
          return responseData;
          
        } catch (fetchError) {
          console.error(`❌ DEBUG: Tentativa ${attempt + 1} falhou:`, {
            message: fetchError.message,
            name: fetchError.name,
            stack: fetchError.stack
          });
          
          if (attempt === maxRetries) {
            console.error('🚫 DEBUG: Todas as tentativas esgotadas');
            throw fetchError;
          }
          
          this.reportarProgresso('retry', 50, `Tentando novamente... (${attempt + 1}/${maxRetries})`);
        }
      }
      
    } catch (error) {
      console.error('💥 DEBUG: Erro geral em callVercelAPI:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      throw error;
    }
  },
  
  // Funções de imagem simplificadas para debug
  async buscarImagensParaDestino(destino, pais, descricao = '', porque = '', 
                               pontosTuristicos = [], quantidadeImagens = 2) {
    console.log(`🖼️ DEBUG: Buscando imagens para ${destino}, ${pais}`);
    // Retornar imagens placeholder para não atrapalhar o debug
    return [{
      url: `https://source.unsplash.com/800x600/?${encodeURIComponent(destino)}`,
      alt: `${destino}, ${pais}`,
      source: 'unsplash-debug'
    }];
  },
  
  async enriquecerRecomendacoesComImagens(recomendacoes) {
    console.log('🖼️ DEBUG: Pulando enriquecimento de imagens para debug');
    return recomendacoes;
  },
  
  reportarProgresso(fase, porcentagem, mensagem) {
    console.log(`📈 DEBUG: Progresso - ${fase} ${porcentagem}% - ${mensagem}`);
    const evento = new CustomEvent('benetrip_progress', {
      detail: { fase, porcentagem, mensagem }
    });
    window.dispatchEvent(evento);
  },
  
  // 🔍 VERSÃO COM DEBUG da função principal
  async obterRecomendacoes(preferenciasUsuario) {
    console.log('🚀 DEBUG: Iniciando obterRecomendacoes');
    console.log('📊 DEBUG: Preferências recebidas:', preferenciasUsuario);
    
    if (!this.isInitialized()) {
      console.log('🔧 DEBUG: Inicializando serviço...');
      this.init();
    }
    
    if (!preferenciasUsuario) {
      console.error('❌ DEBUG: Preferências não fornecidas');
      throw new Error('Preferências de usuário não fornecidas');
    }
    
    const requestId = this.generateRequestId(preferenciasUsuario);
    console.log('🔑 DEBUG: Request ID gerado:', requestId);
    
    if (this._cacheRecomendacoes[requestId]) {
      console.log('💾 DEBUG: Encontrou no cache');
      this.reportarProgresso('cache', 100, 'Recomendações encontradas no cache!');
      return this._cacheRecomendacoes[requestId];
    }
    
    if (this._requestsInProgress[requestId]) {
      console.log('⏳ DEBUG: Requisição já em andamento');
      return await this._requestsInProgress[requestId];
    }
    
    const requestPromise = (async () => {
      try {
        console.log('🎯 DEBUG: Iniciando processo de obtenção...');
        this.reportarProgresso('inicializando', 10, 'Preparando recomendações personalizadas...');
        this.reportarProgresso('processando', 30, 'Analisando suas preferências...');
        
        console.log('📞 DEBUG: Chamando API Vercel...');
        const resposta = await this.callVercelAPI(preferenciasUsuario);
        
        console.log('📥 DEBUG: Resposta recebida:', {
          resposta_exists: !!resposta,
          resposta_type: typeof resposta,
          has_conteudo: resposta && !!resposta.conteudo,
          conteudo_type: resposta && typeof resposta.conteudo,
          resposta_keys: resposta ? Object.keys(resposta) : 'N/A'
        });
        
        // 🔍 VERIFICAÇÃO DETALHADA DA RESPOSTA
        if (!resposta) {
          console.error('❌ DEBUG: Resposta é null/undefined');
          throw new Error('API retornou resposta null/undefined');
        }
        
        if (typeof resposta !== 'object') {
          console.error('❌ DEBUG: Resposta não é um objeto:', typeof resposta);
          throw new Error(`API retornou tipo inválido: ${typeof resposta}`);
        }
        
        if (!resposta.conteudo) {
          console.error('❌ DEBUG: Resposta não tem propriedade conteudo');
          console.log('📊 DEBUG: Propriedades disponíveis:', Object.keys(resposta));
          console.log('📄 DEBUG: Resposta completa:', resposta);
          throw new Error(`API retornou resposta sem conteúdo. Propriedades: ${Object.keys(resposta).join(', ')}`);
        }
        
        console.log('✅ DEBUG: Resposta válida encontrada');
        this.reportarProgresso('processando', 70, 'Processando destinos encontrados...');
        
        let recomendacoes;
        try {
          console.log('🔄 DEBUG: Extraindo JSON...');
          recomendacoes = this.extrairJSON(resposta.conteudo);
          console.log('✅ DEBUG: JSON extraído com sucesso');
        } catch (extractError) {
          console.error('❌ DEBUG: Falha ao extrair JSON:', extractError);
          console.log('📄 DEBUG: Conteudo que falhou:', resposta.conteudo);
          throw new Error(`LLM retornou dados inválidos: ${extractError.message}`);
        }
        
        if (!recomendacoes.topPick && !recomendacoes.alternativas) {
          console.error('❌ DEBUG: Dados extraídos não têm estrutura válida');
          console.log('📊 DEBUG: Recomendações recebidas:', recomendacoes);
          throw new Error('LLM não retornou destinos válidos');
        }
        
        console.log('✅ DEBUG: Recomendações válidas encontradas');
        this.reportarProgresso('concluido', 100, 'Destinos encontrados!');
        
        this._cacheRecomendacoes[requestId] = recomendacoes;
        console.log('💾 DEBUG: Salvo no cache');
        
        return recomendacoes;
        
      } catch (erro) {
        console.error('💥 DEBUG: Erro no processo:', {
          message: erro.message,
          name: erro.name,
          stack: erro.stack
        });
        throw erro;
      } finally {
        delete this._requestsInProgress[requestId];
        console.log('🧹 DEBUG: Limpeza concluída');
      }
    })();
    
    this._requestsInProgress[requestId] = requestPromise;
    return requestPromise;
  }
};

console.log('🚀 DEBUG: Inicializando serviço AI...');
window.BENETRIP_AI.init();
