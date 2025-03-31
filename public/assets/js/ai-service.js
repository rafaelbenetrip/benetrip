// Serviço de IA para o Benetrip - Versão Vercel com Perplexity
window.BENETRIP_AI = {
  // Configurações do serviço
  config: {
    apiEndpoint: '/api/recommendations', // Endpoint Vercel
    apiTimeout: 45000, // 45 segundos de timeout (aumentado para dar mais tempo à IA)
    maxRetries: 3, // Aumentado número máximo de tentativas em caso de falha
    retryDelay: 2000 // Tempo entre tentativas em ms (aumentado)
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
    
    // Se for nulo ou undefined, retorna null para indicar erro
    if (!texto) {
      console.warn('Texto de resposta vazio');
      return null;
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
        
        // Se nada funcionar, retorna null para indicar erro
        console.warn('Não foi possível extrair JSON válido da resposta');
        return null;
      } catch (innerError) {
        console.error('Erro ao extrair JSON do texto:', innerError);
        return null;
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
        
        // Usar backoff exponencial para as tentativas
        const adjustedDelay = this.config.retryDelay * Math.pow(1.5, retryCount);
        console.log(`Aguardando ${adjustedDelay}ms antes da próxima tentativa...`);
        
        await this.sleep(adjustedDelay);
        return this.callVercelAPI(data, retryCount + 1);
      }
      
      // Se for erro de CORS, tentar com abordagem alternativa
      if (error.message.includes('CORS') && retryCount < 1) {
        console.log('Erro de CORS detectado, tentando abordagem alternativa...');
        
        // Tentar com URL absoluta
        try {
          // Criar URL completa para o API Gateway
          const absoluteUrl = window.location.protocol + '//' + window.location.host + this.config.apiEndpoint;
          console.log('Tentando com URL absoluta:', absoluteUrl);
          
          // Ajustar cabeçalhos para contornar problemas de CORS
          const headers = {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          };
          
          const corsResponse = await fetch(absoluteUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data),
            credentials: 'same-origin'
          });
          
          if (!corsResponse.ok) {
            throw new Error(`Erro CORS alternativo: ${corsResponse.status} ${corsResponse.statusText}`);
          }
          
          return await corsResponse.json();
        } catch (corsError) {
          console.error('Erro na abordagem alternativa para CORS:', corsError);
          throw new Error('Falha na comunicação com o servidor após múltiplas tentativas');
        }
      }
      
      // Se todas as tentativas falharem, propagar o erro
      throw new Error('Falha na comunicação com o servidor de IA após múltiplas tentativas');
    }
  },
  
  // Método para validar a estrutura dos dados das recomendações
  validarEstruturaDados(dados) {
    // Verificar se dados é nulo ou undefined
    if (!dados) {
      console.error('Dados de recomendações são nulos ou indefinidos');
      throw new Error('Dados de recomendações inválidos ou ausentes');
    }
    
    // Verificar estrutura básica
    if (!dados.topPick) {
      console.error('Destino principal não encontrado nos dados');
      throw new Error('Estrutura de dados inválida: destino principal ausente');
    }
    
    // Verificar se alternativas existem
    if (!dados.alternativas || !Array.isArray(dados.alternativas) || dados.alternativas.length === 0) {
      console.error('Alternativas não encontradas ou não são um array válido');
      throw new Error('Estrutura de dados inválida: alternativas ausentes ou inválidas');
    }
    
    // Verificar destino surpresa
    if (!dados.surpresa) {
      console.error('Destino surpresa não encontrado');
      throw new Error('Estrutura de dados inválida: destino surpresa ausente');
    }
    
    // Garantir que temos 4 alternativas no máximo para manter a interface uniforme
    if (dados.alternativas.length > 4) {
      console.log('Reduzindo para 4 alternativas para manter a interface uniforme');
      dados.alternativas = dados.alternativas.slice(0, 4);
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
  
  // Método para construir uma estrutura de resposta de erro
  criarRespostaErro(mensagem) {
    return {
      erro: true,
      mensagem: mensagem || 'Ocorreu um erro ao processar sua solicitação',
      timestamp: new Date().toISOString()
    };
  },
  
  // Método para obter recomendações de destinos com IA
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
        
        // Chamar a API do Vercel para processamento com IA
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
          // Verificar se é uma resposta de erro
          if (resposta.erro) {
            throw new Error(resposta.message || 'Erro no serviço de recomendações');
          }
          
          // Extrair conteúdo da resposta
          if (resposta.conteudo) {
            recomendacoes = this.extrairJSON(resposta.conteudo);
            
            // Verificar se a extração foi bem-sucedida
            if (!recomendacoes) {
              throw new Error('Falha ao extrair recomendações da resposta');
            }
            
            console.log('Recomendações extraídas com sucesso:', recomendacoes);
          } else {
            throw new Error('Conteúdo da resposta não encontrado');
          }
        } catch (extractError) {
          console.error('Erro ao extrair JSON da resposta:', extractError);
          throw new Error('Não foi possível obter recomendações válidas. Por favor, tente novamente.');
        }
        
        // Validar e corrigir estrutura das recomendações
        try {
          recomendacoes = this.validarEstruturaDados(recomendacoes);
        } catch (validationError) {
          console.error('Erro na validação dos dados:', validationError);
          throw new Error('Formato de recomendações inválido. Por favor, tente novamente com outras preferências.');
        }
        
        // Reportar progresso final
        this.reportarProgresso('concluido', 100, 'Destinos encontrados!');
        
        // Salvar no localStorage apenas para uso em outras páginas se necessário
        localStorage.setItem('benetrip_recomendacoes', JSON.stringify(recomendacoes));
        
        return recomendacoes;
      } catch (erro) {
        console.error('Erro ao obter recomendações:', erro);
        
        // Notificar o usuário do erro
        this.reportarProgresso('erro', 100, 'Erro ao obter recomendações. Por favor, tente novamente.');
        
        // Propagar o erro
        throw erro;
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
