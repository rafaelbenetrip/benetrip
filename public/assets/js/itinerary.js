/**
 * Benetrip - Sistema de Roteiro Contínuo Otimizado (VERSÃO 8.5)
 * ✅ INTEGRADO COM API /api/itinerary-generator
 * Melhorias: Performance, mobile-first, lazy loading avançado, cache inteligente
 * Características: Roteiro contínuo sem divisões, 100% mobile responsivo
 * Data: 2025
 */

const BENETRIP_ROTEIRO = {
  // ==================== ESTADO GLOBAL ====================
  dadosVoo: null,
  dadosUsuario: null,
  dadosDestino: null,
  roteiroPronto: null,
  estaCarregando: true,
  progressoAtual: 10,
  intervalId: null,
  
  // ==================== OTIMIZAÇÕES AVANÇADAS ====================
  imagensCache: new Map(),           // Cache de imagens
  requestQueue: [],                  // Fila de requisições
  maxConcurrentRequests: 3,          // Limite de requisições simultâneas
  imageObserver: null,               // Intersection Observer para lazy loading
  performanceMetrics: {             // Métricas de performance
    startTime: null,
    imageLoadTime: 0,
    totalLoadTime: 0
  },

  /**
   * ✅ INICIALIZAÇÃO OTIMIZADA
   */
  init() {
    console.log('🚀 Benetrip Roteiro v8.5 - Roteiro Contínuo com API /api/itinerary-generator');
    
    // Iniciar métricas de performance
    this.performanceMetrics.startTime = performance.now();
    
    // Configurar lazy loading antes de qualquer coisa
    this.configurarLazyLoadingAvancado();
    
    // Pipeline de inicialização otimizada
    this.carregarDados()
      .then(() => this.gerarRoteiroOtimizado())
      .catch(erro => {
        console.error('❌ Erro fatal:', erro);
        this.mostrarErro('Erro ao carregar dados. Por favor, tente novamente.');
      });
    
    this.configurarEventosOtimizados();
    this.iniciarAnimacaoProgressoAvancada();
  },

  /**
   * ✅ LAZY LOADING AVANÇADO COM INTERSECTION OBSERVER
   */
  configurarLazyLoadingAvancado() {
    if ('IntersectionObserver' in window) {
      this.imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            this.carregarImagemLazy(img, observer);
          }
        });
      }, {
        rootMargin: '50px 0px',    // Carregar 50px antes de entrar na viewport
        threshold: 0.1
      });
    }
  },

  /**
   * ✅ CARREGAMENTO DE IMAGEM LAZY OTIMIZADA
   */
  async carregarImagemLazy(img, observer) {
    if (!img.dataset.src) return;
    
    const startTime = performance.now();
    
    try {
      // Preload da imagem
      const tempImg = new Image();
      tempImg.onload = () => {
        img.src = img.dataset.src;
        img.classList.add('loaded');
        img.removeAttribute('data-src');
        observer.unobserve(img);
        
        // Atualizar métricas
        this.performanceMetrics.imageLoadTime += performance.now() - startTime;
      };
      
      tempImg.onerror = () => {
        // Aplicar fallback imediatamente
        img.src = this.gerarImagemFallbackInteligente(img.alt, img.dataset.index || 0);
        img.classList.add('loaded', 'fallback');
        observer.unobserve(img);
      };
      
      tempImg.src = img.dataset.src;
      
    } catch (error) {
      console.warn('⚠️ Erro no lazy loading:', error);
      img.src = this.gerarImagemFallbackInteligente(img.alt, 0);
      observer.unobserve(img);
    }
  },

  /**
   * ✅ EVENTOS OTIMIZADOS COM DEBOUNCE
   */
  configurarEventosOtimizados() {
    // Botões principais com debounce
    this.adicionarEventoComDebounce('#btn-compartilhar-roteiro', 'click', () => this.compartilharRoteiro(), 1000);
    this.adicionarEventoComDebounce('#btn-editar-roteiro', 'click', () => this.editarRoteiro(), 500);
    
    // Voltar sem debounce
    document.querySelector('.btn-voltar')?.addEventListener('click', () => history.back());
    
    // Otimização para scroll suave
    this.otimizarScrollPerformance();
    
    // Detecção de erro de imagem global
    this.configurarTratamentoErrosImagem();
  },

  /**
   * ✅ ADICIONAR EVENTO COM DEBOUNCE
   */
  adicionarEventoComDebounce(selector, event, callback, delay) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    let timeout;
    element.addEventListener(event, (e) => {
      e.preventDefault();
      clearTimeout(timeout);
      timeout = setTimeout(callback, delay);
    });
  },

  /**
   * ✅ OTIMIZAR PERFORMANCE DE SCROLL
   */
  otimizarScrollPerformance() {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // Aqui podem ser adicionadas otimizações futuras de scroll
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
  },

  /**
   * ✅ TRATAMENTO GLOBAL DE ERROS DE IMAGEM
   */
  configurarTratamentoErrosImagem() {
    document.addEventListener('error', (e) => {
      if (e.target.tagName === 'IMG' && !e.target.classList.contains('fallback-applied')) {
        e.target.classList.add('fallback-applied');
        e.target.src = this.gerarImagemFallbackInteligente(e.target.alt || 'Imagem', 0);
      }
    }, true);
  },

  /**
   * ✅ CARREGAMENTO DE DADOS COM VALIDAÇÃO ROBUSTA
   */
  async carregarDados() {
    try {
      console.log('📂 Carregando dados salvos...');
      
      // 1. Carregar voo com múltiplas tentativas
      const vooString = localStorage.getItem('benetrip_voo_selecionado');
      if (!vooString) {
        throw new Error('Nenhum voo foi selecionado. Redirecionando...');
      }
      
      this.dadosVoo = JSON.parse(vooString);
      console.log('✈️ Dados do voo carregados:', this.dadosVoo);
      
      // 2. Carregar dados do usuário com fallback
      const usuarioString = localStorage.getItem('benetrip_user_data');
      this.dadosUsuario = usuarioString ? JSON.parse(usuarioString) : {};
      console.log('👤 Dados do usuário carregados:', this.dadosUsuario);
      
      // 3. Resolver destino com múltiplas fontes
      await this.resolverDestinoInteligente();
      
      // 4. Normalizar datas com validação avançada
      await this.normalizarDatasAvancado();
      
      return true;
      
    } catch (erro) {
      console.error('❌ Erro ao carregar dados:', erro);
      
      if (erro.message.includes('voo')) {
        setTimeout(() => window.location.href = '/flights.html', 2000);
      }
      
      throw erro;
    }
  },

  /**
   * ✅ RESOLVER DESTINO COM INTELIGÊNCIA
   */
  async resolverDestinoInteligente() {
    const destinoString = localStorage.getItem('benetrip_destino_selecionado');
    
    if (destinoString) {
      this.dadosDestino = JSON.parse(destinoString);
    } else {
      // Extrair de múltiplas fontes possíveis
      const codigoDestino = this.extrairCodigoDestinoInteligente();
      this.dadosDestino = {
        destino: this.obterNomeDestinoPorCodigo(codigoDestino),
        codigo_iata: codigoDestino,
        pais: this.obterPaisPorCodigo(codigoDestino)
      };
    }
    
    console.log('📍 Destino resolvido:', this.dadosDestino);
  },

  /**
   * ✅ EXTRAÇÃO INTELIGENTE DE CÓDIGO DE DESTINO
   */
  extrairCodigoDestinoInteligente() {
    const fontes = [
      // Fontes primárias
      () => this.dadosVoo?.infoIda?.aeroportoChegada,
      () => this.dadosVoo?.ida?.destino,
      () => this.dadosVoo?.destination,
      
      // Fontes secundárias (estruturas aninhadas)
      () => this.dadosVoo?.voo?.segment?.[0]?.flight?.[0]?.arrival,
      () => this.dadosVoo?.segment?.[0]?.flight?.[0]?.arrival,
      () => this.dadosVoo?.itineraries?.[0]?.segments?.[0]?.arrival?.iataCode,
      
      // Fontes terciárias
      () => this.dadosVoo?.arrival_airport,
      () => this.dadosVoo?.destinationLocationCode
    ];
    
    for (const fonte of fontes) {
      try {
        const codigo = fonte();
        if (codigo && typeof codigo === 'string' && codigo.length === 3) {
          return codigo.toUpperCase();
        }
      } catch (e) {
        // Continuar para próxima fonte
      }
    }
    
    console.warn('⚠️ Código de destino não encontrado, usando padrão');
    return 'GRU';
  },

  /**
   * ✅ NORMALIZAÇÃO AVANÇADA DE DATAS
   */
  async normalizarDatasAvancado() {
    console.log('📅 Normalizando datas com validação avançada...');
    
    try {
      // 1. Extrair datas de múltiplas fontes
      let dataIda = this.extrairDataComValidacao('ida');
      let dataVolta = this.extrairDataComValidacao('volta');
      
      // 2. Fallback para respostas do usuário
      if (!dataIda && this.dadosUsuario?.respostas?.datas) {
        const datasUsuario = this.processarDatasUsuario();
        dataIda = datasUsuario.ida;
        dataVolta = datasUsuario.volta;
      }
      
      // 3. Validação e formatação
      if (!dataIda) {
        throw new Error('Data de ida não encontrada');
      }
      
      dataIda = this.garantirFormatoISOSeguro(dataIda);
      if (dataVolta) {
        dataVolta = this.garantirFormatoISOSeguro(dataVolta);
      }
      
      // 4. Validação lógica
      this.validarLogicaDatas(dataIda, dataVolta);
      
      // 5. Salvar datas normalizadas
      this.salvarDatasNormalizadas(dataIda, dataVolta);
      
      console.log('✅ Datas normalizadas com sucesso:', {
        ida: dataIda,
        volta: dataVolta,
        dias: this.calcularDiasViagem(dataIda, dataVolta)
      });
      
    } catch (erro) {
      console.error('❌ Erro na normalização:', erro);
      this.aplicarDatasSegurancaFallback();
    }
  },

  /**
   * ✅ EXTRAIR DATA COM VALIDAÇÃO
   */
  extrairDataComValidacao(tipo) {
    const fontesPorTipo = {
      ida: [
        () => this.dadosVoo?.infoIda?.dataPartida,
        () => this.dadosVoo?.ida?.dataPartida,
        () => this.dadosVoo?.departure_date,
        () => this.dadosVoo?.departureDate,
        () => this.dadosVoo?.segments?.[0]?.date,
        () => this.dadosVoo?.itineraries?.[0]?.segments?.[0]?.departure?.at?.split('T')[0]
      ],
      volta: [
        () => this.dadosVoo?.infoVolta?.dataPartida,
        () => this.dadosVoo?.volta?.dataPartida,
        () => this.dadosVoo?.return_date,
        () => this.dadosVoo?.returnDate,
        () => this.dadosVoo?.segments?.[1]?.date,
        () => this.dadosVoo?.itineraries?.[1]?.segments?.[0]?.departure?.at?.split('T')[0]
      ]
    };
    
    const fontes = fontesPorTipo[tipo] || [];
    
    for (const fonte of fontes) {
      try {
        const data = fonte();
        if (data && this.isDataValidaSegura(data)) {
          return data;
        }
      } catch (e) {
        // Continuar para próxima fonte
      }
    }
    
    return null;
  },

  /**
   * ✅ VALIDAÇÃO SEGURA DE DATA
   */
  isDataValidaSegura(data) {
    if (!data) return false;
    
    const dataStr = String(data);
    
    // Formatos aceitos
    const formatosValidos = [
      /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/,         // DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}$/,           // DD-MM-YYYY
      /^\d{4}\/\d{2}\/\d{2}$/,         // YYYY/MM/DD
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/ // ISO com hora
    ];
    
    const formatoValido = formatosValidos.some(regex => regex.test(dataStr));
    if (!formatoValido) return false;
    
    // Verificar se a data é parseable
    try {
      const data = new Date(dataStr);
      return !isNaN(data.getTime()) && data.getFullYear() > 2020;
    } catch (e) {
      return false;
    }
  },

  /**
   * ✅ GARANTIR FORMATO ISO SEGURO
   */
  garantirFormatoISOSeguro(dataInput) {
    if (!dataInput) return null;
    
    const dataStr = String(dataInput);
    
    // Já está em ISO correto?
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
      return dataStr;
    }
    
    // Extrair de ISO com hora
    if (/^\d{4}-\d{2}-\d{2}T/.test(dataStr)) {
      return dataStr.split('T')[0];
    }
    
    // Converter formatos brasileiros
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dataStr)) {
      const [dia, mes, ano] = dataStr.split(/[\/\-]/);
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    
    // Tentar parsing direto
    try {
      const data = new Date(dataStr);
      if (!isNaN(data.getTime())) {
        return this.formatarDataISO(data);
      }
    } catch (e) {
      console.warn('⚠️ Não foi possível converter data:', dataStr);
    }
    
    return null;
  },

  /**
   * ✅ GERAÇÃO DE ROTEIRO OTIMIZADA - INTEGRADA COM /api/itinerary-generator
   */
  async gerarRoteiroOtimizado() {
    try {
      console.log('🎯 Gerando roteiro contínuo otimizado com API /api/itinerary-generator...');
      
      const dataIda = this.getDataIda();
      const dataVolta = this.getDataVolta();
      const diasViagem = this.calcularDiasViagem(dataIda, dataVolta);
      
      console.log('📊 Parâmetros do roteiro:', {
        destino: this.dadosDestino,
        dataIda, dataVolta, diasViagem,
        preferencias: this.obterPreferencias()
      });
      
      // Delay otimizado baseado no tamanho da viagem
      await this.delay(Math.min(1500, diasViagem * 200));
      
      // Gerar roteiro contínuo com nova API
      this.roteiroPronto = await this.gerarRoteiroContínuoInteligente(dataIda, dataVolta, diasViagem);
      
      // Executar tarefas em paralelo com controle de qualidade
      await Promise.allSettled([
        this.buscarPrevisaoTempoOtimizada(),
        this.buscarImagensComControleTotalQualidade()
      ]);
      
      // Atualizar UI
      this.atualizarUIContínua();
      
      // Calcular métricas finais
      this.performanceMetrics.totalLoadTime = performance.now() - this.performanceMetrics.startTime;
      console.log('📈 Métricas de performance:', this.performanceMetrics);
      
      console.log('✅ Roteiro contínuo gerado com sucesso!');
      
    } catch (erro) {
      console.error('❌ Erro ao gerar roteiro:', erro);
      this.mostrarErro('Não foi possível gerar seu roteiro. Por favor, tente novamente.');
      throw erro;
    } finally {
      this.finalizarCarregamentoOtimizado();
    }
  },

  /**
   * ✅ GERAÇÃO INTELIGENTE DE ROTEIRO VIA API /api/itinerary-generator
   */
  async gerarRoteiroContínuoInteligente(dataIda, dataVolta, diasViagem) {
    console.log('🤖 Gerando roteiro via API /api/itinerary-generator...');
    
    try {
      // 1. Tentar geração via API primeiro
      const roteiroAPI = await this.chamarAPIGeracaoRoteiro({
        destino: this.dadosDestino.destino,
        pais: this.dadosDestino.pais,
        dataInicio: dataIda,
        dataFim: dataVolta,
        diasViagem,
        horaChegada: this.extrairHorarioChegada(),
        horaSaida: this.extrairHorarioPartida(),
        tipoViagem: this.obterTipoViagem(),
        tipoCompanhia: this.obterTipoCompanhia(),
        preferencias: this.obterPreferenciasDetalhadas()
      });
      
      if (roteiroAPI && roteiroAPI.dias?.length) {
        console.log('✅ Roteiro gerado pela API com sucesso');
        return this.processarRoteiroAPI(roteiroAPI);
      }
      
      throw new Error('API retornou dados inválidos');
      
    } catch (erro) {
      console.warn('⚠️ Erro na geração via API:', erro.message);
      console.log('🔄 Usando fallback de emergência...');
      
      // 2. Fallback: geração básica de emergência
      return this.gerarRoteiroFallbackEmergencia(dataIda, dataVolta, diasViagem);
    }
  },

  /**
   * ✅ CHAMADA PARA API /api/itinerary-generator INTEGRADA
   */
  async chamarAPIGeracaoRoteiro(parametros) {
    const payload = {
      destino: parametros.destino,
      pais: parametros.pais,
      dataInicio: parametros.dataInicio,
      dataFim: parametros.dataFim,
      horaChegada: parametros.horaChegada,
      horaSaida: parametros.horaSaida,
      tipoViagem: parametros.tipoViagem,
      tipoCompanhia: parametros.tipoCompanhia,
      preferencias: parametros.preferencias,
      modeloIA: 'deepseek' // ou 'claude' conforme preferência
    };
    
    console.log('📤 Enviando requisição para /api/itinerary-generator:', payload);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout para API de IA
    
    try {
      const response = await fetch('/api/itinerary-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Request-Source': 'benetrip-roteiro'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro HTTP da API:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const resultado = await response.json();
      
      // Validar estrutura da resposta
      if (!resultado.dias || !Array.isArray(resultado.dias)) {
        console.error('❌ Estrutura inválida da API:', resultado);
        throw new Error('Formato de resposta inválido da API');
      }
      
      return resultado;
      
    } catch (erro) {
      clearTimeout(timeoutId);
      
      if (erro.name === 'AbortError') {
        throw new Error('Timeout na geração do roteiro');
      }
      
      console.error('❌ Erro na chamada à API:', erro);
      throw erro;
    }
  },

  /**
   * ✅ PROCESSAR ROTEIRO RETORNADO PELA API /api/itinerary-generator
   */
  processarRoteiroAPI(roteiroAPI) {
    console.log('🔄 Processando roteiro da API /api/itinerary-generator...');
    
    // Converter estrutura da API (manhã/tarde/noite) para estrutura contínua
    const diasProcessados = [];
    
    roteiroAPI.dias.forEach((dia, diaIndex) => {
      const diaProcessado = {
        data: dia.data,
        descricao: dia.descricao || `Dia ${diaIndex + 1} em ${this.dadosDestino.destino}`,
        atividades: []
      };
      
      // Processar atividades de manhã, tarde e noite
      ['manha', 'tarde', 'noite'].forEach(periodo => {
        if (dia[periodo]?.atividades?.length) {
          // Adicionar horário especial se presente
          if (dia[periodo].horarioEspecial) {
            diaProcessado.atividades.push({
              horario: this.extrairHorarioEspecial(dia[periodo].horarioEspecial),
              local: dia[periodo].horarioEspecial,
              dica: 'Horário importante da sua viagem!',
              tags: ['Especial'],
              isEspecial: true
            });
          }
          
          // Adicionar atividades normais
          dia[periodo].atividades.forEach(atividade => {
            const atividadeProcessada = {
              horario: atividade.horario || this.gerarHorarioPadrao(diaProcessado.atividades.length),
              local: atividade.local,
              dica: atividade.dica || 'Aproveite este momento especial da sua viagem!',
              tags: atividade.tags || ['Recomendado'],
              duracao: atividade.duracao || this.estimarDuracaoInteligente(atividade.local || '')
            };
            
            // Validar e enriquecer dados
            this.validarEEnriquecerAtividade(atividadeProcessada, diaIndex);
            
            diaProcessado.atividades.push(atividadeProcessada);
          });
        }
      });
      
      // Garantir pelo menos uma atividade por dia
      if (diaProcessado.atividades.length === 0) {
        diaProcessado.atividades.push({
          horario: '10:00',
          local: `Exploração livre de ${this.dadosDestino.destino}`,
          dica: 'Descubra por conta própria os encantos da cidade!',
          tags: ['Livre'],
          duracao: '2-3 horas'
        });
      }
      
      // Adicionar observações para primeiro/último dia
      if (diaIndex === 0) {
        diaProcessado.observacao = this.obterObservacaoInteligente('primeiro');
      } else if (diaIndex === roteiroAPI.dias.length - 1) {
        diaProcessado.observacao = this.obterObservacaoInteligente('ultimo');
      }
      
      diasProcessados.push(diaProcessado);
    });
    
    // Adicionar metadata
    const roteiroProcessado = {
      destino: roteiroAPI.destino || `${this.dadosDestino.destino}, ${this.dadosDestino.pais}`,
      dias: diasProcessados,
      metadata: {
        geradoEm: new Date().toISOString(),
        versao: '8.5',
        fonte: 'api-itinerary-generator',
        diasTotal: diasProcessados.length,
        tipoViagem: this.obterTipoViagem(),
        apiUtilizada: '/api/itinerary-generator'
      }
    };
    
    console.log('✅ Roteiro processado com sucesso:', roteiroProcessado);
    return roteiroProcessado;
  },

  /**
   * ✅ EXTRAIR HORÁRIO ESPECIAL (chegada/partida)
   */
  extrairHorarioEspecial(textoEspecial) {
    const match = textoEspecial.match(/(\d{1,2}:\d{2})/);
    return match ? match[1] : '12:00';
  },

  /**
   * ✅ VALIDAR E ENRIQUECER ATIVIDADE
   */
  validarEEnriquecerAtividade(atividade, diaIndex) {
    // Validar horário
    if (!atividade.horario || !/\d{1,2}:\d{2}/.test(atividade.horario)) {
      atividade.horario = this.gerarHorarioPadrao(diaIndex);
    }
    
    // Garantir tags
    if (!atividade.tags || !Array.isArray(atividade.tags)) {
      atividade.tags = this.gerarTagsInteligentes(atividade.local || 'Atividade');
    }
    
    // Garantir duração
    if (!atividade.duracao) {
      atividade.duracao = this.estimarDuracaoInteligente(atividade.local || '');
    }
    
    // Garantir dica
    if (!atividade.dica) {
      atividade.dica = 'Aproveite este momento especial da sua viagem!';
    }
    
    // Adicionar prioridade baseada nas tags
    if (atividade.tags.includes('Imperdível')) {
      atividade.prioridade = 5;
    } else if (atividade.tags.includes('Cultural') || atividade.tags.includes('Histórico')) {
      atividade.prioridade = 4;
    } else {
      atividade.prioridade = 3;
    }
  },

  /**
   * ✅ OBTER PREFERÊNCIAS DETALHADAS PARA API
   */
  obterPreferenciasDetalhadas() {
    const respostas = this.dadosUsuario?.respostas || {};
    
    return {
      tipoViagem: this.obterTipoViagem(),
      tipoCompanhia: this.obterTipoCompanhia(),
      quantidadePessoas: this.obterQuantidadePessoas(),
      orcamento: this.obterNivelOrcamento(),
      itemEssencial: this.obterItemEssencial(),
      famaDestino: this.obterFamaDestino()
    };
  },

  /**
   * ✅ OBTER ITEM ESSENCIAL
   */
  obterItemEssencial() {
    const respostas = this.dadosUsuario?.respostas || {};
    
    if (respostas.item_essencial !== undefined) {
      const itens = ['diversao', 'natureza', 'cultura', 'compras', 'surpresa'];
      return itens[respostas.item_essencial] || 'cultura';
    }
    
    return 'cultura';
  },

  /**
   * ✅ OBTER FAMA DO DESTINO
   */
  obterFamaDestino() {
    const respostas = this.dadosUsuario?.respostas || {};
    
    if (respostas.fama_destino !== undefined) {
      const tipos = ['famoso', 'escondido', 'misto'];
      return tipos[respostas.fama_destino] || 'misto';
    }
    
    return 'misto';
  },

  /**
   * ✅ FALLBACK DE EMERGÊNCIA (apenas estrutura básica)
   */
  gerarRoteiroFallbackEmergencia(dataIda, dataVolta, diasViagem) {
    console.log('🆘 Gerando roteiro básico de emergência...');
    
    const destino = this.dadosDestino.destino;
    const dias = [];
    const dataInicio = new Date(dataIda + 'T12:00:00');
    
    for (let i = 0; i < diasViagem; i++) {
      const dataAtual = new Date(dataInicio);
      dataAtual.setDate(dataInicio.getDate() + i);
      
      const dia = {
        data: this.formatarDataISO(dataAtual),
        descricao: `Explore ${destino} no seu próprio ritmo`,
        atividades: this.gerarAtividadesBasicasEmergencia(i, destino, diasViagem)
      };
      
      if (i === 0) {
        dia.observacao = this.obterObservacaoInteligente('primeiro');
      } else if (i === diasViagem - 1) {
        dia.observacao = this.obterObservacaoInteligente('ultimo');
      }
      
      dias.push(dia);
    }
    
    return {
      destino: `${destino}, ${this.dadosDestino.pais}`,
      dias,
      metadata: {
        geradoEm: new Date().toISOString(),
        versao: '8.5',
        fonte: 'fallback',
        diasTotal: diasViagem,
        tipoViagem: this.obterTipoViagem()
      }
    };
  },

  /**
   * ✅ ATIVIDADES BÁSICAS DE EMERGÊNCIA (mínimo viável)
   */
  gerarAtividadesBasicasEmergencia(diaIndex, destino, totalDias) {
    const horarios = ['09:00', '12:00', '15:00', '18:00'];
    const atividades = [];
    
    // Primeiro dia - mais simples
    if (diaIndex === 0) {
      atividades.push({
        horario: this.extrairHorarioChegada(),
        local: 'Chegada e Check-in',
        dica: 'Deixe as malas e comece a explorar!',
        tags: ['Chegada'],
        duracao: '1 hora',
        isEspecial: true
      });
      
      atividades.push({
        horario: '16:00',
        local: `Centro de ${destino}`,
        dica: 'Primeira exploração da cidade!',
        tags: ['Exploração'],
        duracao: '2-3 horas'
      });
    }
    // Último dia - check-out
    else if (diaIndex === totalDias - 1) {
      atividades.push({
        horario: '09:00',
        local: `Manhã livre em ${destino}`,
        dica: 'Últimos momentos para compras ou relaxar!',
        tags: ['Livre'],
        duracao: '2-3 horas'
      });
      
      if (this.getDataVolta()) {
        atividades.push({
          horario: '15:00',
          local: 'Check-out e Partida',
          dica: 'Hora de se despedir!',
          tags: ['Partida'],
          duracao: '2 horas',
          isEspecial: true
        });
      }
    }
    // Dias do meio - estrutura básica
    else {
      horarios.slice(0, 3).forEach((horario, index) => {
        atividades.push({
          horario,
          local: `Atividade ${index + 1} em ${destino}`,
          dica: 'Descubra este local especial!',
          tags: ['Exploração'],
          duracao: '1-2 horas'
        });
      });
    }
    
    return atividades;
  },

  /**
   * ✅ GERAR HORÁRIO PADRÃO
   */
  gerarHorarioPadrao(index) {
    const horarios = ['09:00', '11:00', '14:00', '16:00', '18:00', '20:00'];
    return horarios[index % horarios.length];
  },

  /**
   * ✅ TAGS INTELIGENTES BASEADAS EM CONTEXTO
   */
  gerarTagsInteligentes(local, prioridade = 3) {
    const tags = [];
    
    // Tags básicas por palavra-chave
    const mapeamentoTags = {
      'Museu': 'Cultural',
      'Torre': 'Vista Panorâmica', 
      'Castelo': 'Histórico',
      'Igreja': 'Religioso',
      'Catedral': 'Religioso',
      'Mercado': 'Gastronomia',
      'Restaurante': 'Gastronomia',
      'Bar': 'Vida Noturna',
      'Teatro': 'Cultural',
      'Parque': 'Natureza',
      'Shopping': 'Compras',
      'Centro': 'Histórico'
    };
    
    // Aplicar tags por palavra-chave
    Object.entries(mapeamentoTags).forEach(([palavra, tag]) => {
      if (local.includes(palavra) && !tags.includes(tag)) {
        tags.push(tag);
      }
    });
    
    // Tag de prioridade
    if (typeof prioridade === 'number' && prioridade >= 5) {
      tags.unshift('Imperdível');
    }
    
    // Garantir pelo menos uma tag
    if (tags.length === 0) {
      tags.push('Recomendado');
    }
    
    return tags.slice(0, 3);
  },

  /**
   * ✅ BUSCA DE IMAGENS COM CONTROLE TOTAL DE QUALIDADE
   */
  async buscarImagensComControleTotalQualidade() {
    try {
      console.log('🖼️ Iniciando busca otimizada de imagens com controle de qualidade...');
      
      if (!this.roteiroPronto?.dias?.length) {
        console.warn('⚠️ Sem roteiro para buscar imagens');
        return;
      }
      
      // 1. Análise e coleta de todos os locais
      const analiseLocais = this.analisarLocaisParaImagens();
      console.log('📊 Análise de locais:', analiseLocais);
      
      // 2. Estratégia de busca baseada na análise
      const estrategia = this.definirEstrategiaBusca(analiseLocais);
      console.log('🎯 Estratégia de busca:', estrategia);
      
      // 3. Executar busca com controle de qualidade
      const resultados = await this.executarBuscaControlada(analiseLocais.locaisUnicos, estrategia);
      
      // 4. Aplicar resultados com fallbacks inteligentes
      this.aplicarImagensComFallbacksInteligentes(resultados, analiseLocais);
      
      console.log('✅ Sistema de imagens otimizado aplicado');
      
    } catch (erro) {
      console.error('❌ Erro no sistema de imagens:', erro);
      this.aplicarFallbacksGlobaisInteligentes();
    }
  },

  /**
   * ✅ ANÁLISE COMPLETA DOS LOCAIS
   */
  analisarLocaisParaImagens() {
    const locaisUnicos = new Map();
    const estatisticas = {
      totalAtividades: 0,
      atividasdesPorDia: [],
      locaisPorCategoria: new Map()
    };
    
    this.roteiroPronto.dias.forEach((dia, diaIndex) => {
      if (dia.atividades?.length) {
        estatisticas.atividasdesPorDia.push(dia.atividades.length);
        
        dia.atividades.forEach((atividade, ativIndex) => {
          if (atividade.local && !atividade.isEspecial) {
            estatisticas.totalAtividades++;
            
            // Mapear local único
            if (!locaisUnicos.has(atividade.local)) {
              locaisUnicos.set(atividade.local, {
                local: atividade.local,
                primeiraOcorrencia: { dia: diaIndex, ativ: ativIndex },
                tags: atividade.tags || [],
                prioridade: atividade.prioridade || 3,
                ocorrencias: 1
              });
            } else {
              locaisUnicos.get(atividade.local).ocorrencias++;
            }
            
            // Categorizar por tags
            (atividade.tags || []).forEach(tag => {
              if (!estatisticas.locaisPorCategoria.has(tag)) {
                estatisticas.locaisPorCategoria.set(tag, 0);
              }
              estatisticas.locaisPorCategoria.set(tag, 
                estatisticas.locaisPorCategoria.get(tag) + 1
              );
            });
          }
        });
      }
    });
    
    return {
      locaisUnicos: Array.from(locaisUnicos.values()),
      estatisticas,
      totalLocaisUnicos: locaisUnicos.size
    };
  },

  /**
   * ✅ DEFINIR ESTRATÉGIA DE BUSCA OTIMIZADA
   */
  definirEstrategiaBusca(analise) {
    const totalLocais = analise.totalLocaisUnicos;
    
    let estrategia = {
      maxBuscas: Math.min(totalLocais, 25),      // Máximo 25 buscas
      maxConcorrencia: 3,                        // 3 simultâneas
      timeoutPorBusca: 8000,                     // 8s por busca
      delayEntreLotes: 400,                      // 400ms entre lotes
      priorizarPorImportancia: true,
      usarCacheAgressivo: true
    };
    
    // Ajustar estratégia baseada no tamanho
    if (totalLocais > 20) {
      estrategia.maxConcorrencia = 2;  // Reduzir concorrência
      estrategia.delayEntreLotes = 600; // Mais delay
    } else if (totalLocais < 10) {
      estrategia.maxConcorrencia = 4;  // Aumentar concorrência
      estrategia.delayEntreLotes = 200; // Menos delay
    }
    
    return estrategia;
  },

  /**
   * ✅ EXECUÇÃO CONTROLADA DE BUSCA
   */
  async executarBuscaControlada(locais, estrategia) {
    console.log(`🔄 Executando busca controlada: ${locais.length} locais`);
    
    // 1. Ordenar por prioridade se configurado
    if (estrategia.priorizarPorImportancia) {
      locais.sort((a, b) => (b.prioridade || 3) - (a.prioridade || 3));
    }
    
    // 2. Selecionar locais para busca
    const locaisParaBusca = locais.slice(0, estrategia.maxBuscas);
    
    // 3. Dividir em lotes
    const lotes = [];
    for (let i = 0; i < locaisParaBusca.length; i += estrategia.maxConcorrencia) {
      lotes.push(locaisParaBusca.slice(i, i + estrategia.maxConcorrencia));
    }
    
    console.log(`📦 Processando ${lotes.length} lotes de imagens...`);
    
    // 4. Processar lotes sequencialmente
    const todasImagensResultado = new Map();
    const inicioTempo = performance.now();
    
    for (let i = 0; i < lotes.length; i++) {
      console.log(`📦 Lote ${i + 1}/${lotes.length}: ${lotes[i].length} locais`);
      
      const promisesLote = lotes[i].map(item => 
        this.buscarImagemComCacheAvancado(item.local, estrategia.timeoutPorBusca)
      );
      
      const resultadosLote = await Promise.allSettled(promisesLote);
      
      // Processar resultados do lote
      resultadosLote.forEach((resultado, index) => {
        const local = lotes[i][index].local;
        
        if (resultado.status === 'fulfilled' && resultado.value.sucesso) {
          todasImagensResultado.set(local, resultado.value.url);
          console.log(`✅ Imagem obtida: ${local}`);
        } else {
          console.warn(`⚠️ Falha na imagem: ${local}`, resultado.reason);
        }
      });
      
      // Delay entre lotes (exceto último)
      if (i < lotes.length - 1) {
        await this.delay(estrategia.delayEntreLotes);
      }
    }
    
    const tempoTotal = performance.now() - inicioTempo;
    const taxaSucesso = todasImagensResultado.size / locaisParaBusca.length;
    
    console.log(`📈 Resultado da busca: ${todasImagensResultado.size}/${locaisParaBusca.length} sucessos (${Math.round(taxaSucesso * 100)}%) em ${Math.round(tempoTotal)}ms`);
    
    return todasImagensResultado;
  },

  /**
   * ✅ BUSCA DE IMAGEM COM CACHE AVANÇADO
   */
  async buscarImagemComCacheAvancado(local, timeout = 8000) {
    // Verificar cache primeiro
    const chaveCache = `${local}_${this.dadosDestino.destino}`;
    if (this.imagensCache.has(chaveCache)) {
      const resultado = this.imagensCache.get(chaveCache);
      console.log(`💾 Cache hit: ${local}`);
      return resultado;
    }
    
    try {
      const query = `${local} ${this.dadosDestino.destino}`.trim();
      const url = `/api/image-search?query=${encodeURIComponent(query)}&perPage=1&source=mixed`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'max-age=3600',
          'X-Request-ID': `benetrip_${Date.now()}`
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const dados = await response.json();
      
      if (dados?.images?.[0]) {
        const imagemUrl = this.extrairMelhorUrlImagem(dados.images[0]);
        if (imagemUrl) {
          const resultado = { sucesso: true, url: imagemUrl, fonte: 'api' };
          this.imagensCache.set(chaveCache, resultado);
          return resultado;
        }
      }
      
      throw new Error('Nenhuma imagem válida na resposta');
      
    } catch (erro) {
      const resultado = { 
        sucesso: false, 
        erro: erro.message,
        fonte: 'erro'
      };
      
      // Cache de erro com TTL menor
      setTimeout(() => this.imagensCache.delete(chaveCache), 300000); // 5 min
      this.imagensCache.set(chaveCache, resultado);
      
      return resultado;
    }
  },

  /**
   * ✅ EXTRAIR MELHOR URL DE IMAGEM
   */
  extrairMelhorUrlImagem(imagemData) {
    // Priorizar URLs por qualidade
    const urls = [
      imagemData.url,
      imagemData.src?.large,
      imagemData.src?.medium,
      imagemData.src?.regular,
      imagemData.src?.small,
      imagemData.webformatURL,
      imagemData.previewURL
    ].filter(Boolean);
    
    // Retornar primeira URL válida
    for (const url of urls) {
      if (typeof url === 'string' && url.startsWith('http')) {
        return url;
      }
    }
    
    return null;
  },

  /**
   * ✅ APLICAR IMAGENS COM FALLBACKS INTELIGENTES
   */
  aplicarImagensComFallbacksInteligentes(resultadosImagens, analise) {
    let imagensAplicadas = 0;
    let fallbacksAplicados = 0;
    
    this.roteiroPronto.dias.forEach((dia, diaIndex) => {
      if (dia.atividades?.length) {
        dia.atividades.forEach((atividade, ativIndex) => {
          if (atividade.local && !atividade.isEspecial) {
            const imagemUrl = resultadosImagens.get(atividade.local);
            
            if (imagemUrl) {
              atividade.imagemUrl = imagemUrl;
              atividade.imagemFonte = 'api';
              imagensAplicadas++;
            } else {
              // Aplicar fallback inteligente
              atividade.imagemUrl = this.gerarFallbackContextual(
                atividade.local, 
                atividade.tags, 
                diaIndex, 
                ativIndex
              );
              atividade.imagemFonte = 'fallback';
              atividade.isFallback = true;
              fallbacksAplicados++;
            }
          }
        });
      }
    });
    
    const total = imagensAplicadas + fallbacksAplicados;
    const taxaSucesso = total > 0 ? (imagensAplicadas / total) * 100 : 0;
    
    console.log(`📊 Aplicação de imagens: ${imagensAplicadas} APIs + ${fallbacksAplicados} fallbacks = ${total} total (${Math.round(taxaSucesso)}% sucesso)`);
    
    // Se taxa de sucesso muito baixa, melhorar fallbacks
    if (taxaSucesso < 40) {
      console.log('🔄 Taxa de sucesso baixa, aplicando fallbacks premium...');
      this.aplicarFallbacksPremium();
    }
  },

  /**
   * ✅ GERAR FALLBACK CONTEXTUAL INTELIGENTE
   */
  gerarFallbackContextual(local, tags = [], diaIndex, ativIndex) {
    // Selecionar serviço baseado no contexto
    const servicos = [
      'unsplash', 'picsum', 'lorem-picsum', 'placeholder'
    ];
    
    const servicoIndex = (diaIndex + ativIndex) % servicos.length;
    const servico = servicos[servicoIndex];
    
    // Gerar query inteligente
    let query = this.gerarQueryInteligente(local, tags);
    
    // URLs por serviço
    const urlsPorServico = {
      unsplash: `https://source.unsplash.com/400x250/?${encodeURIComponent(query)}`,
      picsum: `https://picsum.photos/400/250?random=${diaIndex}${ativIndex}&blur=0`,
      'lorem-picsum': `https://loremflickr.com/400/250/${encodeURIComponent(query)}`,
      placeholder: `https://via.placeholder.com/400x250/E87722/FFFFFF?text=${encodeURIComponent(local.substring(0, 20))}`
    };
    
    return urlsPorServico[servico];
  },

  /**
   * ✅ GERAR QUERY INTELIGENTE PARA FALLBACK
   */
  gerarQueryInteligente(local, tags) {
    // Combinar local com destino e tags relevantes
    let queryParts = [this.dadosDestino.destino];
    
    // Adicionar palavras-chave do local
    const palavrasLocal = local.split(' ').filter(palavra => 
      palavra.length > 3 && !['de', 'do', 'da', 'dos', 'das'].includes(palavra.toLowerCase())
    );
    
    if (palavrasLocal.length > 0) {
      queryParts.push(palavrasLocal[0]);
    }
    
    // Adicionar tag relevante
    const tagsRelevantes = tags.filter(tag => 
      !['Imperdível', 'Recomendado'].includes(tag)
    );
    
    if (tagsRelevantes.length > 0) {
      queryParts.push(tagsRelevantes[0].toLowerCase());
    }
    
    // Adicionar palavra genérica
    queryParts.push('travel');
    
    return queryParts.join(',');
  },

  /**
   * ✅ GERAR FALLBACK INTELIGENTE GLOBAL
   */
  gerarImagemFallbackInteligente(alt, index) {
    const servicosPremium = [
      `https://source.unsplash.com/400x250/?${encodeURIComponent(alt)},travel`,
      `https://picsum.photos/400/250?random=${index + Date.now()}`,
      `https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&h=250&fit=crop`,
      `https://via.placeholder.com/400x250/E87722/FFFFFF?text=${encodeURIComponent(alt.substring(0, 15))}`
    ];
    
    return servicosPremium[index % servicosPremium.length];
  },

  /**
   * ✅ ATUALIZAÇÃO DE UI CONTÍNUA OTIMIZADA
   */
  atualizarUIContínua() {
    console.log('🎨 Atualizando interface contínua otimizada...');
    
    const container = document.querySelector('.roteiro-content');
    if (!container) {
      console.error('❌ Container do roteiro não encontrado');
      return;
    }
    
    // Usar DocumentFragment para performance
    const fragment = document.createDocumentFragment();
    
    // Limpar container eficientemente
    container.innerHTML = '';
    
    // Atualizar título dinamicamente
    this.atualizarTituloPagina();
    
    // Adicionar resumo otimizado
    fragment.appendChild(this.criarResumoOtimizado());
    
    // Adicionar dias com otimização
    this.roteiroPronto.dias.forEach((dia, index) => {
      fragment.appendChild(this.criarElementoDiaContinuo(dia, index + 1));
    });
    
    // Espaçador para botões fixos
    const spacer = document.createElement('div');
    spacer.className = 'spacer-botoes-fixos';
    spacer.style.height = '100px';
    fragment.appendChild(spacer);
    
    // Aplicar tudo de uma vez
    container.appendChild(fragment);
    
    // Configurar eventos após renderização
    this.configurarEventosUIOptimizados();
    
    console.log('✅ Interface contínua atualizada com performance otimizada');
  },

  /**
   * ✅ CRIAR ELEMENTO DE DIA CONTÍNUO OTIMIZADO
   */
  criarElementoDiaContinuo(dia, numeroDia) {
    const elemento = document.createElement('div');
    elemento.className = 'dia-roteiro dia-continuo';
    elemento.setAttribute('data-dia', numeroDia);
    
    const dataFormatada = this.formatarDataCompleta(dia.data);
    const temPrevisao = dia.previsao && numeroDia <= 3;
    
    elemento.innerHTML = `
      <div class="dia-header">
        <div class="dia-numero">${numeroDia}</div>
        <div class="dia-info">
          <span class="dia-titulo">Dia ${numeroDia}</span>
          <span class="dia-data">${dataFormatada}</span>
        </div>
      </div>
      
      <div class="dia-content">
        <p class="dia-descricao">"${dia.descricao}"</p>
        
        ${dia.observacao ? `
          <div class="dia-observacao">
            <span class="icone-obs">💡</span>
            <span>${dia.observacao}</span>
          </div>
        ` : ''}
        
        ${temPrevisao ? this.criarPrevisaoTempo(dia.previsao) : ''}
        
        <div class="atividades-continuas">
          ${this.criarListaAtividadesContínuas(dia.atividades)}
        </div>
      </div>
    `;
    
    return elemento;
  },

  /**
   * ✅ CRIAR LISTA CONTÍNUA DE ATIVIDADES OTIMIZADA
   */
  criarListaAtividadesContínuas(atividades) {
    if (!atividades?.length) {
      return `
        <div class="dia-livre">
          <div class="dia-livre-content">
            <span class="dia-livre-icon">🏖️</span>
            <p>Dia livre para descanso ou atividades opcionais.</p>
          </div>
        </div>
      `;
    }
    
    return atividades.map((ativ, index) => `
      <div class="atividade ${ativ.isEspecial ? 'atividade-especial' : ''}" data-atividade="${index}">
        ${ativ.horario ? `
          <div class="atividade-horario">
            <span class="horario-icon">🕒</span>
            <span class="horario-texto">${ativ.horario}</span>
            ${ativ.duracao ? `<span class="duracao-texto">(${ativ.duracao})</span>` : ''}
          </div>
        ` : ''}
        
        <div class="atividade-local">
          <span class="local-icon">📍</span>
          <div class="local-info">
            <span class="local-nome">${ativ.local}</span>
            ${ativ.tags?.length ? `
              <div class="atividade-badges">
                ${ativ.tags.map(tag => `
                  <span class="badge ${this.getClasseBadge(tag)}">${tag}</span>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
        
        ${ativ.dica ? `
          <div class="tripinha-dica">
            <div class="tripinha-avatar-container">
              <img 
                src="assets/images/tripinha-avatar.png" 
                alt="Tripinha" 
                class="tripinha-avatar"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
              >
              <div class="tripinha-emoji" style="display:none;">🐕</div>
            </div>
            <div class="dica-conteudo">
              <p><strong>Dica da Tripinha:</strong> ${ativ.dica}</p>
            </div>
          </div>
        ` : ''}
        
        ${ativ.imagemUrl && !ativ.isEspecial ? `
          <div class="atividade-imagem">
            <img 
              ${this.imageObserver ? 'data-src' : 'src'}="${ativ.imagemUrl}" 
              alt="${ativ.local}"
              class="atividade-img"
              data-index="${index}"
              loading="lazy"
              onload="this.classList.add('loaded')"
              onerror="this.classList.add('error'); this.src='${this.gerarImagemFallbackInteligente(ativ.local, index)}';"
            >
            ${ativ.isFallback ? '<div class="imagem-fallback-indicator"></div>' : ''}
          </div>
        ` : ''}
        
        ${!ativ.isEspecial ? `
          <button 
            class="btn-ver-mapa" 
            data-local="${ativ.local}"
            aria-label="Ver ${ativ.local} no mapa"
          >
            <svg class="mapa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
            </svg>
            <span>Ver no mapa</span>
          </button>
        ` : ''}
      </div>
    `).join('');
  },

  /**
   * ✅ CONFIGURAR EVENTOS UI OTIMIZADOS
   */
  configurarEventosUIOptimizados() {
    // Configurar botões de mapa com delegação de eventos
    document.addEventListener('click', (e) => {
      if (e.target.closest('.btn-ver-mapa')) {
        e.preventDefault();
        const botao = e.target.closest('.btn-ver-mapa');
        const local = botao.getAttribute('data-local');
        if (local) {
          this.abrirMapa(local);
        }
      }
    });
    
    // Configurar lazy loading se disponível
    if (this.imageObserver) {
      // Usar timeout para garantir que elementos estão no DOM
      setTimeout(() => {
        const imagens = document.querySelectorAll('img[data-src]');
        imagens.forEach(img => this.imageObserver.observe(img));
      }, 100);
    }
  },

  /**
   * ✅ PREVISÃO DO TEMPO OTIMIZADA
   */
  async buscarPrevisaoTempoOtimizada() {
    try {
      console.log('🌤️ Buscando previsão otimizada (3 dias)...');
      
      if (!this.roteiroPronto?.dias?.length) {
        console.warn('⚠️ Sem dias no roteiro para previsão');
        return;
      }
      
      const diasComPrevisao = Math.min(3, this.roteiroPronto.dias.length);
      
      // Tentar API real com timeout
      try {
        const cidade = this.dadosDestino.destino.replace(/\s+Internacional/i, '').trim();
        const url = `/api/weather?city=${encodeURIComponent(cidade)}&days=${diasComPrevisao}`;
        
        const response = await Promise.race([
          fetch(url, { 
            headers: { 'Accept': 'application/json' }
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);
        
        if (response.ok) {
          const previsoes = await response.json();
          
          for (let i = 0; i < diasComPrevisao; i++) {
            this.roteiroPronto.dias[i].previsao = previsoes[i] || 
              this.gerarPrevisaoInteligente(i);
          }
          
          console.log(`✅ Previsão aplicada aos ${diasComPrevisao} primeiros dias`);
          return;
        }
      } catch (erro) {
        console.warn('⚠️ API de clima indisponível:', erro.message);
      }
      
      // Fallback: previsões inteligentes
      for (let i = 0; i < diasComPrevisao; i++) {
        this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoInteligente(i);
      }
      
    } catch (erro) {
      console.error('❌ Erro na previsão:', erro);
    }
  },

  /**
   * ✅ GERAR PREVISÃO INTELIGENTE
   */
  gerarPrevisaoInteligente(diaIndex) {
    // Condições climáticas realistas por região
    const condicoesPorRegiao = {
      'Brasil': [
        { icon: '☀️', condition: 'Ensolarado', tempBase: 28 },
        { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 26 },
        { icon: '☁️', condition: 'Nublado', tempBase: 24 }
      ],
      'Europa': [
        { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 18 },
        { icon: '☁️', condition: 'Nublado', tempBase: 16 },
        { icon: '🌦️', condition: 'Possibilidade de chuva', tempBase: 15 }
      ],
      'default': [
        { icon: '☀️', condition: 'Ensolarado', tempBase: 25 },
        { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 22 },
        { icon: '☁️', condition: 'Nublado', tempBase: 20 }
      ]
    };
    
    const regiao = this.determinarRegiaoClima();
    const condicoes = condicoesPorRegiao[regiao] || condicoesPorRegiao.default;
    const condicao = condicoes[diaIndex % condicoes.length];
    
    // Variação natural da temperatura
    const variacao = Math.floor(Math.random() * 8) - 4; // -4 a +4
    const temperatura = Math.max(10, Math.min(40, condicao.tempBase + variacao));
    
    return {
      icon: condicao.icon,
      temperature: temperatura,
      condition: condicao.condition,
      date: this.roteiroPronto.dias[diaIndex].data
    };
  },

  /**
   * ✅ DETERMINAR REGIÃO PARA CLIMA
   */
  determinarRegiaoClima() {
    const pais = this.dadosDestino.pais?.toLowerCase() || '';
    
    if (['brasil', 'brazil'].includes(pais)) return 'Brasil';
    
    const paisesEuropeus = ['portugal', 'espanha', 'frança', 'itália', 'alemanha', 'reino unido'];
    if (paisesEuropeus.some(p => pais.includes(p))) return 'Europa';
    
    return 'default';
  },

  // ==================== MÉTODOS AUXILIARES OTIMIZADOS ====================

  /**
   * Obtém classe CSS para badges
   */
  getClasseBadge(tag) {
    const classes = {
      'Imperdível': 'badge-destaque',
      'Recomendado': 'badge-recomendado',
      'Cultural': 'badge-cultura',
      'Gastronomia': 'badge-gastronomia',
      'Natureza': 'badge-natureza',
      'Compras': 'badge-compras',
      'Vida Noturna': 'badge-noturno',
      'Vista Panorâmica': 'badge-vista',
      'Histórico': 'badge-historico',
      'Religioso': 'badge-religioso',
      'Local': 'badge-local'
    };
    
    return classes[tag] || 'badge-padrao';
  },

  /**
   * Cria previsão do tempo
   */
  criarPrevisaoTempo(previsao) {
    if (!previsao) return '';
    
    return `
      <div class="previsao-tempo">
        <span class="previsao-icon">${previsao.icon || '🌤️'}</span>
        <span class="previsao-texto">
          <strong>Previsão:</strong> ${previsao.temperature || '--'}°C, ${previsao.condition || 'Indefinido'}
        </span>
      </div>
    `;
  },

  /**
   * ✅ RESUMO OTIMIZADO
   */
  criarResumoOtimizado() {
    const resumo = document.createElement('div');
    resumo.className = 'resumo-viagem resumo-otimizado';
    
    const dataIda = this.formatarData(this.getDataIda());
    const dataVolta = this.getDataVolta() ? this.formatarData(this.getDataVolta()) : null;
    const diasViagem = this.calcularDiasViagem(this.getDataIda(), this.getDataVolta());
    
    resumo.innerHTML = `
      <div class="resumo-header">
        <span class="resumo-icon">📋</span>
        <span class="resumo-titulo">Resumo da Viagem</span>
      </div>
      <div class="resumo-grid">
        <div class="resumo-item">
          <div class="item-icon">🎯</div>
          <div class="item-content">
            <div class="item-label">Destino</div>
            <div class="item-valor">${this.dadosDestino.destino}, ${this.dadosDestino.pais}</div>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="item-icon">📅</div>
          <div class="item-content">
            <div class="item-label">Período</div>
            <div class="item-valor">${dataIda}${dataVolta ? ` até ${dataVolta}` : ''}</div>
            <div class="item-extra">${diasViagem} ${diasViagem === 1 ? 'dia' : 'dias'}</div>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="item-icon">✈️</div>
          <div class="item-content">
            <div class="item-label">Voos</div>
            <div class="item-valor">Chegada: ${this.extrairHorarioChegada()}</div>
            ${this.getDataVolta() ? `<div class="item-extra">Partida: ${this.extrairHorarioPartida()}</div>` : ''}
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="item-icon">${this.obterIconeCompanhia()}</div>
          <div class="item-content">
            <div class="item-label">Companhia</div>
            <div class="item-valor">${this.obterTextoCompanhia()}</div>
          </div>
        </div>
      </div>
    `;
    
    return resumo;
  },

  // ==================== MÉTODOS HELPER MANTIDOS ====================

  delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); },
  
  getDataIda() { return this.dadosVoo?.infoIda?.dataPartida; },
  getDataVolta() { return this.dadosVoo?.infoVolta?.dataPartida; },
  
  calcularDiasViagem(dataIda, dataVolta) {
    if (!dataIda) return 1;
    try {
      const inicio = new Date(dataIda + 'T12:00:00');
      const fim = dataVolta ? new Date(dataVolta + 'T12:00:00') : inicio;
      const diffMs = fim - inicio;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, Math.min(30, diffDias));
    } catch (e) {
      return 1;
    }
  },

  formatarDataISO(data) {
    if (!data) return null;
    const d = data instanceof Date ? data : new Date(data);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  formatarData(dataString) {
    if (!dataString) return 'Data indefinida';
    try {
      const data = new Date(dataString + 'T12:00:00');
      if (isNaN(data.getTime())) return dataString;
      return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return dataString;
    }
  },

  formatarDataCompleta(dataString) {
    if (!dataString) return 'Data indefinida';
    try {
      const data = new Date(dataString + 'T12:00:00');
      if (isNaN(data.getTime())) return dataString;
      const formatada = data.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric'
      });
      return formatada.charAt(0).toUpperCase() + formatada.slice(1);
    } catch (e) {
      return dataString;
    }
  },

  // ==================== AÇÕES FINAIS ====================

  /**
   * Animação de progresso avançada
   */
  iniciarAnimacaoProgressoAvancada() {
    const mensagens = [
      '🔍 Analisando suas preferências...',
      '🤖 Gerando roteiro personalizado com IA...',
      '📸 Otimizando seleção de imagens...',
      '🌤️ Verificando condições climáticas...',
      '⚡ Finalizando roteiro personalizado...'
    ];
    
    let indice = 0;
    
    this.intervalId = setInterval(() => {
      this.progressoAtual = Math.min(this.progressoAtual + 15, 90);
      this.atualizarBarraProgresso(this.progressoAtual, mensagens[indice % mensagens.length]);
      indice++;
      
      if (this.progressoAtual >= 90) {
        clearInterval(this.intervalId);
      }
    }, 1200);
  },

  atualizarBarraProgresso(porcentagem, mensagem) {
    const barra = document.querySelector('.progress-bar');
    const texto = document.querySelector('.loading-text');
    
    if (barra) {
      barra.style.width = `${porcentagem}%`;
      barra.setAttribute('aria-valuenow', porcentagem);
    }
    
    if (texto) {
      texto.textContent = mensagem;
    }
  },

  finalizarCarregamentoOtimizado() {
    clearInterval(this.intervalId);
    this.estaCarregando = false;
    
    this.atualizarBarraProgresso(100, '✨ Roteiro pronto!');
    
    setTimeout(() => {
      const loading = document.querySelector('.loading-container');
      if (loading) {
        loading.classList.add('fade-out');
        setTimeout(() => loading.style.display = 'none', 300);
      }
    }, 500);
  },

  /**
   * Ações do usuário
   */
  abrirMapa(local) {
    const destino = `${this.dadosDestino.destino}, ${this.dadosDestino.pais}`;
    const query = `${local}, ${destino}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  async compartilharRoteiro() {
    const titulo = `Roteiro Benetrip - ${this.dadosDestino.destino}`;
    const texto = `Confira meu roteiro personalizado para ${this.dadosDestino.destino}! 🐕✈️`;
    const url = window.location.href;
    
    if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ title: titulo, text: texto, url });
        this.exibirToast('Roteiro compartilhado!', 'success');
        return;
      } catch (e) {
        console.log('Share cancelado');
      }
    }
    
    try {
      await navigator.clipboard.writeText(url);
      this.exibirToast('Link copiado! Cole onde quiser compartilhar.', 'success');
    } catch (e) {
      this.exibirToast('Link copiado!', 'success');
    }
  },

  editarRoteiro() {
    this.exibirToast('Em breve você poderá personalizar ainda mais seu roteiro! 🚀', 'info');
  },

  exibirToast(mensagem, tipo = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    
    const icones = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    
    toast.innerHTML = `
      <span class="toast-icon">${icones[tipo] || icones.info}</span>
      <span class="toast-message">${mensagem}</span>
    `;
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });
    
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  mostrarErro(mensagem) {
    console.error('❌ Erro exibido ao usuário:', mensagem);
    
    clearInterval(this.intervalId);
    this.estaCarregando = false;
    
    const container = document.querySelector('.roteiro-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="erro-container">
        <div class="erro-icon">
          <img 
            src="assets/images/tripinha-triste.png" 
            alt="Tripinha triste"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
          >
          <div style="display:none; font-size: 72px;">😢</div>
        </div>
        
        <h2 class="erro-titulo">Ops! Algo deu errado...</h2>
        <p class="erro-mensagem">${mensagem}</p>
        
        <div class="erro-acoes">
          <button class="btn btn-principal" onclick="location.reload()">
            🔄 Tentar Novamente
          </button>
          <button class="btn btn-secundario" onclick="history.back()">
            ⬅️ Voltar
          </button>
        </div>
        
        <p class="erro-dica">
          <strong>Dica:</strong> Se o problema persistir, tente limpar o cache do navegador.
        </p>
      </div>
    `;
    
    const loading = document.querySelector('.loading-container');
    if (loading) loading.style.display = 'none';
  },

  // ==================== MÉTODOS COMPLEMENTARES ====================

  /**
   * Métodos auxiliares mantidos por compatibilidade
   */
  extrairHorarioChegada() {
    const possiveis = [
      this.dadosVoo?.infoIda?.horaChegada,
      this.dadosVoo?.ida?.horaChegada,
      this.dadosVoo?.arrival_time
    ];
    
    for (const horario of possiveis) {
      if (horario && /\d{1,2}:\d{2}/.test(horario)) {
        return this.formatarHorario(horario);
      }
    }
    
    return '15:30';
  },

  extrairHorarioPartida() {
    const possiveis = [
      this.dadosVoo?.infoVolta?.horaPartida,
      this.dadosVoo?.volta?.horaPartida,
      this.dadosVoo?.departure_time
    ];
    
    for (const horario of possiveis) {
      if (horario && /\d{1,2}:\d{2}/.test(horario)) {
        return this.formatarHorario(horario);
      }
    }
    
    return '21:00';
  },

  formatarHorario(horario) {
    const match = horario.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const hora = match[1].padStart(2, '0');
      const minuto = match[2];
      return `${hora}:${minuto}`;
    }
    return horario;
  },

  obterPreferencias() {
    return {
      tipoViagem: this.obterTipoViagem(),
      tipoCompanhia: this.obterTipoCompanhia(),
      orcamento: this.obterNivelOrcamento()
    };
  },

  obterTipoViagem() {
    const respostas = this.dadosUsuario?.respostas || {};
    
    if (respostas.tipo_viagem !== undefined) {
      const tipos = ['relaxar', 'aventura', 'cultura', 'urbano'];
      return tipos[respostas.tipo_viagem] || 'cultura';
    }
    
    if (respostas.destino_imaginado !== undefined) {
      const mapa = { 0: 'relaxar', 1: 'aventura', 2: 'urbano', 3: 'cultura' };
      return mapa[respostas.destino_imaginado] || 'cultura';
    }
    
    return 'cultura';
  },

  obterTipoCompanhia() {
    const respostas = this.dadosUsuario?.respostas || {};
    
    if (respostas.companhia !== undefined) {
      const tipos = ['sozinho', 'casal', 'familia', 'amigos'];
      return tipos[respostas.companhia] || 'sozinho';
    }
    
    return 'sozinho';
  },

  obterTextoCompanhia() {
    const quantidade = this.obterQuantidadePessoas();
    const tipo = this.obterTipoCompanhia();
    
    const textos = {
      'sozinho': 'Viagem Solo',
      'casal': 'Casal',
      'familia': `Família (${quantidade} pessoas)`,
      'amigos': `Grupo de Amigos (${quantidade} pessoas)`
    };
    
    return textos[tipo] || 'Viagem Individual';
  },

  obterQuantidadePessoas() {
    const respostas = this.dadosUsuario?.respostas || {};
    return respostas.quantidade_familia || respostas.quantidade_amigos || 
           respostas.adults || 1;
  },

  obterIconeCompanhia() {
    const mapa = {
      'sozinho': '🧳',
      'casal': '❤️',
      'familia': '👨‍👩‍👧‍👦',
      'amigos': '🎉'
    };
    return mapa[this.obterTipoCompanhia()] || '👤';
  },

  obterNivelOrcamento() {
    const respostas = this.dadosUsuario?.respostas || {};
    return respostas.orcamento_valor || 'medio';
  },

  obterNomeDestinoPorCodigo(codigo) {
    const mapeamento = {
      // Brasil
      'GRU': 'São Paulo', 'CGH': 'São Paulo', 'VCP': 'Campinas',
      'GIG': 'Rio de Janeiro', 'SDU': 'Rio de Janeiro',
      'BSB': 'Brasília', 'CNF': 'Belo Horizonte', 'PLU': 'Belo Horizonte',
      
      // Internacional
      'LIS': 'Lisboa', 'OPO': 'Porto',
      'MAD': 'Madri', 'BCN': 'Barcelona',
      'CDG': 'Paris', 'ORY': 'Paris',
      'FCO': 'Roma', 'MXP': 'Milão',
      'LHR': 'Londres', 'LGW': 'Londres',
      'JFK': 'Nova York', 'LAX': 'Los Angeles',
      'EZE': 'Buenos Aires', 'SCL': 'Santiago',
      'LIM': 'Lima', 'BOG': 'Bogotá'
    };
    
    return mapeamento[codigo] || codigo;
  },

  obterPaisPorCodigo(codigo) {
    const paises = {
      'GRU': 'Brasil', 'GIG': 'Brasil', 'BSB': 'Brasil',
      'LIS': 'Portugal', 'MAD': 'Espanha', 'CDG': 'França',
      'FCO': 'Itália', 'LHR': 'Reino Unido', 'JFK': 'Estados Unidos',
      'EZE': 'Argentina', 'SCL': 'Chile', 'LIM': 'Peru', 'BOG': 'Colômbia'
    };
    
    return paises[codigo] || 'Internacional';
  },

  // Métodos de aplicação de dados seguros
  processarDatasUsuario() {
    const datas = this.dadosUsuario?.respostas?.datas;
    if (!datas) return null;
    
    if (typeof datas === 'object' && datas.dataIda) {
      return { ida: datas.dataIda, volta: datas.dataVolta };
    }
    
    if (Array.isArray(datas) && datas.length >= 1) {
      return { ida: datas[0], volta: datas[1] || null };
    }
    
    if (typeof datas === 'string') {
      if (datas.includes(',')) {
        const [ida, volta] = datas.split(',').map(d => d.trim());
        return { ida, volta };
      }
      return { ida: datas, volta: null };
    }
    
    return null;
  },

  validarLogicaDatas(dataIda, dataVolta) {
    if (!dataIda) return;
    
    const ida = new Date(dataIda + 'T12:00:00');
    const volta = dataVolta ? new Date(dataVolta + 'T12:00:00') : null;
    
    if (volta && volta <= ida) {
      console.warn('⚠️ Data de volta anterior à ida, ajustando...');
      volta.setDate(ida.getDate() + 3);
      return this.formatarDataISO(volta);
    }
    
    return dataVolta;
  },

  salvarDatasNormalizadas(dataIda, dataVolta) {
    if (!this.dadosVoo.infoIda) this.dadosVoo.infoIda = {};
    if (!this.dadosVoo.infoVolta) this.dadosVoo.infoVolta = {};
    
    this.dadosVoo.infoIda.dataPartida = dataIda;
    if (dataVolta) {
      this.dadosVoo.infoVolta.dataPartida = dataVolta;
    }
  },

  aplicarDatasSegurancaFallback() {
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + 30);
    
    const ida = this.formatarDataISO(hoje);
    const volta = new Date(hoje);
    volta.setDate(hoje.getDate() + 5);
    
    this.dadosVoo.infoIda = { dataPartida: ida };
    this.dadosVoo.infoVolta = { dataPartida: this.formatarDataISO(volta) };
    
    console.warn('⚠️ Usando datas de segurança:', this.dadosVoo.infoIda, this.dadosVoo.infoVolta);
  },

  atualizarTituloPagina() {
    const header = document.querySelector('.app-header h1');
    if (header) {
      header.textContent = `Seu Roteiro para ${this.dadosDestino.destino}`;
    }
  },

  gerarDescricaoPersonalizada(numeroDia, destino, totalDias) {
    if (numeroDia === 1) {
      return `Chegada e primeiras impressões de ${destino}!`;
    } else if (numeroDia === totalDias) {
      return `Últimos momentos para aproveitar ${destino} antes da partida.`;
    }
    
    const descricoes = [
      `Explorando os tesouros escondidos de ${destino}.`,
      `Dia de imersão cultural em ${destino}.`,
      `Descobrindo a gastronomia e vida local de ${destino}.`,
      `Aventuras inesquecíveis em ${destino}.`,
      `Vivenciando o melhor que ${destino} tem a oferecer.`
    ];
    
    return descricoes[(numeroDia - 2) % descricoes.length];
  },

  obterObservacaoInteligente(tipo) {
    if (tipo === 'primeiro') {
      const hora = parseInt(this.extrairHorarioChegada().split(':')[0]);
      
      if (hora < 8) return "Chegada cedo - aproveite o dia completo!";
      if (hora < 12) return "Chegada pela manhã - tempo de sobra para explorar!";
      if (hora < 16) return "Chegada à tarde - relaxe e prepare-se para amanhã!";
      if (hora < 20) return "Chegada no fim da tarde - conheça a vida noturna!";
      return "Chegada à noite - descanse bem para aproveitar amanhã!";
    }
    
    if (tipo === 'ultimo') {
      const hora = parseInt(this.extrairHorarioPartida().split(':')[0]);
      
      if (hora < 12) return "Voo pela manhã - aproveite a noite anterior!";
      if (hora < 18) return "Voo à tarde - manhã livre para últimas compras!";
      return "Voo à noite - dia completo para aproveitar!";
    }
    
    return null;
  },

  ajustarRoteiroComInteligencia(dias) {
    if (!dias?.length) return;
    
    const horaChegada = this.extrairHorarioChegada();
    const horaPartida = this.extrairHorarioPartida();
    
    // Ajustar primeiro dia
    const primeiroDia = dias[0];
    const horaChegadaNum = parseInt(horaChegada.split(':')[0]);
    
    if (horaChegadaNum >= 20) {
      primeiroDia.atividades = [{
        horario: '21:00',
        local: 'Check-in e Jantar no Hotel',
        dica: 'Descanse para começar bem amanhã!',
        tags: ['Chegada', 'Descanso'],
        isEspecial: true
      }];
    } else if (horaChegadaNum >= 16) {
      primeiroDia.atividades = [
        {
          horario: horaChegada,
          local: 'Check-in no Hotel',
          dica: 'Deixe as malas e saia para explorar!',
          tags: ['Chegada'],
          isEspecial: true
        },
        ...primeiroDia.atividades.slice(0, 2)
      ];
    }
    
    // Ajustar último dia
    if (horaPartida && dias.length > 1) {
      const ultimoDia = dias[dias.length - 1];
      const horaPartidaNum = parseInt(horaPartida.split(':')[0]);
      
      if (horaPartidaNum < 12) {
        ultimoDia.atividades = [{
          horario: '08:00',
          local: 'Check-out e Transfer para Aeroporto',
          dica: 'Chegue ao aeroporto com 2h de antecedência!',
          tags: ['Partida'],
          isEspecial: true
        }];
      } else if (horaPartidaNum < 18) {
        ultimoDia.atividades = [
          ...ultimoDia.atividades.slice(0, 2),
          {
            horario: `${horaPartidaNum - 3}:00`,
            local: 'Transfer para Aeroporto',
            dica: 'Hora de se despedir! Até a próxima!',
            tags: ['Partida'],
            isEspecial: true
          }
        ];
      }
    }
  },

  estimarDuracaoInteligente(local) {
    const duracoes = {
      'museu': '2-3 horas',
      'restaurante': '1-2 horas',
      'passeio': '1-2 horas',
      'mercado': '1 hora',
      'igreja': '30-45 min',
      'mirante': '45 min',
      'show': '2 horas',
      'parque': '1-2 horas',
      'shopping': '2-3 horas'
    };
    
    const localLower = local.toLowerCase();
    
    for (const [tipo, duracao] of Object.entries(duracoes)) {
      if (localLower.includes(tipo)) {
        return duracao;
      }
    }
    
    return '1-2 horas';
  },

  aplicarFallbacksPremium() {
    const palavrasChave = ['travel', 'tourism', 'destination', 'vacation', 'explore', 'adventure'];
    let fallbackIndex = 0;
    
    this.roteiroPronto.dias.forEach((dia, diaIndex) => {
      if (dia.atividades?.length) {
        dia.atividades.forEach((atividade, ativIndex) => {
          if (atividade.isFallback && atividade.local) {
            const palavra = palavrasChave[fallbackIndex % palavrasChave.length];
            atividade.imagemUrl = `https://source.unsplash.com/400x250/?${palavra},${encodeURIComponent(this.dadosDestino.destino)}`;
            fallbackIndex++;
          }
        });
      }
    });
  },

  aplicarFallbacksGlobaisInteligentes() {
    console.log('🔄 Aplicando fallbacks globais inteligentes...');
    
    let index = 0;
    this.roteiroPronto.dias.forEach((dia, diaIndex) => {
      if (dia.atividades?.length) {
        dia.atividades.forEach((atividade) => {
          if (atividade.local && !atividade.isEspecial && !atividade.imagemUrl) {
            atividade.imagemUrl = this.gerarImagemFallbackInteligente(atividade.local, index++);
            atividade.isFallback = true;
          }
        });
      }
    });
  }
};

// ===========================================
// INICIALIZAÇÃO E CONTROLE GLOBAL
// ===========================================

/**
 * ✅ INICIALIZAÇÃO AUTOMÁTICA COM DETECÇÃO INTELIGENTE
 */
document.addEventListener('DOMContentLoaded', () => {
  // Verificar se estamos na página correta
  const indicadoresPagina = [
    '#roteiro-container',
    '.roteiro-content',
    '[data-page="itinerary"]',
    '.pagina-roteiro'
  ];
  
  const isPaginaRoteiro = indicadoresPagina.some(selector => 
    document.querySelector(selector)
  );
  
  if (isPaginaRoteiro) {
    console.log('📄 Página de roteiro contínuo detectada - Iniciando v8.5 com API /api/itinerary-generator');
    
    // Adicionar classe ao body para estilos específicos
    document.body.classList.add('pagina-roteiro', 'roteiro-continuo');
    
    // Adicionar meta tag para mobile se não existir
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(viewport);
    }
    
    // Inicializar sistema
    try {
      BENETRIP_ROTEIRO.init();
    } catch (erro) {
      console.error('❌ Erro na inicialização:', erro);
      
      // Fallback para erro crítico
      setTimeout(() => {
        if (BENETRIP_ROTEIRO.estaCarregando) {
          BENETRIP_ROTEIRO.mostrarErro('Erro crítico na inicialização. Recarregue a página.');
        }
      }, 10000);
    }
  } else {
    console.log('ℹ️ Página de roteiro não detectada - Sistema não inicializado');
  }
});

/**
 * ✅ CONTROLE DE VISIBILIDADE DA PÁGINA (Performance)
 */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Pausar operações pesadas quando página não está visível
    if (BENETRIP_ROTEIRO.intervalId) {
      clearInterval(BENETRIP_ROTEIRO.intervalId);
    }
  } else {
    // Retomar operações quando página volta a ser visível
    if (BENETRIP_ROTEIRO.estaCarregando && !BENETRIP_ROTEIRO.intervalId) {
      BENETRIP_ROTEIRO.iniciarAnimacaoProgressoAvancada();
    }
  }
});

/**
 * ✅ TRATAMENTO GLOBAL DE ERROS NÃO CAPTURADOS
 */
window.addEventListener('error', (evento) => {
  if (evento.filename && evento.filename.includes('itinerary')) {
    console.error('❌ Erro não capturado no sistema de roteiro:', evento.error);
    
    // Se for um erro crítico durante o carregamento
    if (BENETRIP_ROTEIRO.estaCarregando) {
      setTimeout(() => {
        BENETRIP_ROTEIRO.mostrarErro('Erro inesperado. Por favor, recarregue a página.');
      }, 1000);
    }
  }
});

/**
 * ✅ TRATAMENTO DE PROMESSAS REJEITADAS
 */
window.addEventListener('unhandledrejection', (evento) => {
  console.error('❌ Promise rejeitada não tratada:', evento.reason);
  
  // Se for relacionado ao sistema de roteiro
  if (evento.reason && evento.reason.toString().includes('roteiro')) {
    evento.preventDefault(); // Prevenir log no console
    
    if (BENETRIP_ROTEIRO.estaCarregando) {
      BENETRIP_ROTEIRO.exibirToast('Erro na conexão. Tentando novamente...', 'warning');
    }
  }
});

/**
 * ✅ EXPORTAÇÃO GLOBAL E VERIFICAÇÃO DE CONFLITOS
 */
if (window.BENETRIP_ROTEIRO && window.BENETRIP_ROTEIRO_LOADED) {
  console.warn('⚠️ Sistema de roteiro já foi carregado anteriormente');
  
  // Verificar se é uma versão mais antiga
  const versaoAtual = '8.5';
  const versaoExistente = window.BENETRIP_ROTEIRO.versao || '0.0';
  
  if (versaoAtual > versaoExistente) {
    console.log(`🔄 Atualizando sistema de roteiro: ${versaoExistente} → ${versaoAtual}`);
    window.BENETRIP_ROTEIRO = BENETRIP_ROTEIRO;
    window.BENETRIP_ROTEIRO.versao = versaoAtual;
  } else {
    console.log('✅ Versão atual é igual ou superior - Mantendo sistema existente');
  }
} else {
  // Primeira carga
  window.BENETRIP_ROTEIRO = BENETRIP_ROTEIRO;
  window.BENETRIP_ROTEIRO.versao = '8.5';
  window.BENETRIP_ROTEIRO_LOADED = true;
  
  console.log('✅ Sistema de roteiro v8.5 integrado com /api/itinerary-generator carregado com sucesso');
}

/**
 * ✅ UTILITÁRIOS DE DEBUG (apenas em desenvolvimento)
 */
if (location.hostname === 'localhost' || location.hostname.startsWith('192.168.')) {
  window.BENETRIP_DEBUG = {
    roteiro: () => BENETRIP_ROTEIRO,
    dados: () => ({
      voo: BENETRIP_ROTEIRO.dadosVoo,
      usuario: BENETRIP_ROTEIRO.dadosUsuario,
      destino: BENETRIP_ROTEIRO.dadosDestino,
      roteiro: BENETRIP_ROTEIRO.roteiroPronto
    }),
    metricas: () => BENETRIP_ROTEIRO.performanceMetrics,
    cache: () => BENETRIP_ROTEIRO.imagensCache,
    recarregar: () => {
      BENETRIP_ROTEIRO.estaCarregando = true;
      BENETRIP_ROTEIRO.init();
    },
    limparCache: () => {
      BENETRIP_ROTEIRO.imagensCache.clear();
      localStorage.removeItem('benetrip_image_cache');
      console.log('🗑️ Cache de imagens limpo');
    },
    testarAPI: async (destino = 'Lisboa', pais = 'Portugal') => {
      const resultado = await BENETRIP_ROTEIRO.chamarAPIGeracaoRoteiro({
        destino,
        pais,
        dataInicio: '2025-08-01',
        dataFim: '2025-08-05',
        horaChegada: '15:30',
        horaSaida: '21:00',
        tipoViagem: 'cultura',
        tipoCompanhia: 'familia',
        preferencias: { itemEssencial: 'cultura' }
      });
      console.log('🧪 Teste de API:', resultado);
      return resultado;
    }
  };
  
  console.log('🔧 Utilitários de debug disponíveis em window.BENETRIP_DEBUG');
  console.log('🧪 Para testar a API: BENETRIP_DEBUG.testarAPI("Lisboa", "Portugal")');
}

/**
 * ✅ CLEANUP AO SAIR DA PÁGINA
 */
window.addEventListener('beforeunload', () => {
  // Limpar intervalos ativos
  if (BENETRIP_ROTEIRO.intervalId) {
    clearInterval(BENETRIP_ROTEIRO.intervalId);
  }
  
  // Limpar observers
  if (BENETRIP_ROTEIRO.imageObserver) {
    BENETRIP_ROTEIRO.imageObserver.disconnect();
  }
  
  // Salvar métricas de performance se necessário
  if (BENETRIP_ROTEIRO.performanceMetrics.totalLoadTime > 0) {
    const metricas = {
      loadTime: BENETRIP_ROTEIRO.performanceMetrics.totalLoadTime,
      imageLoadTime: BENETRIP_ROTEIRO.performanceMetrics.imageLoadTime,
      timestamp: Date.now(),
      apiUtilizada: '/api/itinerary-generator'
    };
    
    try {
      localStorage.setItem('benetrip_last_performance', JSON.stringify(metricas));
    } catch (e) {
      // Ignorar erros de localStorage
    }
  }
});

/**
 * ✅ POLYFILLS PARA COMPATIBILIDADE
 */
(function() {
  // Polyfill para Promise.allSettled se não existir
  if (!Promise.allSettled) {
    Promise.allSettled = function(promises) {
      return Promise.all(promises.map(promise =>
        Promise.resolve(promise)
          .then(value => ({ status: 'fulfilled', value }))
          .catch(reason => ({ status: 'rejected', reason }))
      ));
    };
  }
  
  // Polyfill para IntersectionObserver básico se não existir
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      constructor(callback) {
        this.callback = callback;
        this.elements = new Set();
      }
      
      observe(element) {
        this.elements.add(element);
        // Simular intersection imediata
        setTimeout(() => {
          this.callback([{
            target: element,
            isIntersecting: true
          }], this);
        }, 100);
      }
      
      unobserve(element) {
        this.elements.delete(element);
      }
      
      disconnect() {
        this.elements.clear();
      }
    };
  }
})();

// ===========================================
// ESTILOS CSS CRÍTICOS INJETADOS
// ===========================================

/**
 * ✅ INJEÇÃO DE ESTILOS CRÍTICOS PARA MOBILE
 */
(function injetarEstilosCriticos() {
  if (document.querySelector('#benetrip-roteiro-styles')) return;
  
  const estilosCriticos = `
    <style id="benetrip-roteiro-styles">
      /* Estilos críticos para roteiro contínuo mobile */
      .pagina-roteiro {
        font-size: 14px;
        line-height: 1.4;
      }
      
      .roteiro-content {
        max-width: 480px;
        margin: 0 auto;
        padding: 16px;
        background: #fff;
      }
      
      .dia-roteiro.dia-continuo {
        margin-bottom: 24px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        overflow: hidden;
      }
      
      .dia-header {
        background: linear-gradient(135deg, #E87722 0%, #FF8C42 100%);
        color: white;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .dia-numero {
        width: 32px;
        height: 32px;
        background: rgba(255,255,255,0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 16px;
      }
      
      .atividades-continuas {
        padding: 16px;
      }
      
      .atividade {
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid #f0f0f0;
      }
      
      .atividade:last-child {
        border-bottom: none;
        margin-bottom: 0;
      }
      
      .atividade-imagem {
        margin: 12px 0;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .atividade-img {
        width: 100%;
        height: 200px;
        object-fit: cover;
        transition: opacity 0.3s ease;
        opacity: 0;
      }
      
      .atividade-img.loaded {
        opacity: 1;
      }
      
      .btn-ver-mapa {
        width: 100%;
        padding: 8px 12px;
        background: rgba(0, 163, 224, 0.1);
        border: 1px solid #00A3E0;
        color: #00A3E0;
        border-radius: 6px;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin-top: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .btn-ver-mapa:hover {
        background: rgba(0, 163, 224, 0.2);
      }
      
      .mapa-icon {
        width: 16px;
        height: 16px;
      }
      
      .loading-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      }
      
      .progress-bar {
        width: 80%;
        max-width: 320px;
        height: 4px;
        background: #E87722;
        border-radius: 2px;
        transition: width 0.3s ease;
      }
      
      .loading-text {
        margin-top: 16px;
        color: #666;
        font-size: 14px;
        text-align: center;
      }
      
      .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
      }
      
      .toast {
        background: white;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 8px;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
        max-width: 300px;
      }
      
      .toast.toast-visible {
        transform: translateX(0);
        opacity: 1;
      }
      
      .toast-success {
        border-left: 4px solid #28a745;
      }
      
      .toast-error {
        border-left: 4px solid #dc3545;
      }
      
      .toast-warning {
        border-left: 4px solid #ffc107;
      }
      
      .toast-info {
        border-left: 4px solid #17a2b8;
      }
      
      .resumo-viagem {
        background: #f8f9fa;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 24px;
        border: 1px solid #e9ecef;
      }
      
      .resumo-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        font-weight: bold;
        color: #E87722;
      }
      
      .resumo-grid {
        display: grid;
        gap: 12px;
      }
      
      .resumo-item {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      
      .item-icon {
        font-size: 20px;
        width: 24px;
        text-align: center;
        flex-shrink: 0;
      }
      
      .item-label {
        font-size: 12px;
        color: #666;
        margin-bottom: 2px;
      }
      
      .item-valor {
        font-weight: 500;
        color: #333;
      }
      
      .item-extra {
        font-size: 12px;
        color: #666;
        margin-top: 2px;
      }
      
      .atividade-horario {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        font-size: 13px;
        color: #00A3E0;
        font-weight: 500;
      }
      
      .atividade-local {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .local-nome {
        font-weight: 500;
        color: #333;
      }
      
      .atividade-badges {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        margin-top: 4px;
      }
      
      .badge {
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
      }
      
      .badge-destaque {
        background: #E87722;
        color: white;
      }
      
      .badge-cultura {
        background: #6f42c1;
        color: white;
      }
      
      .badge-gastronomia {
        background: #fd7e14;
        color: white;
      }
      
      .badge-natureza {
        background: #28a745;
        color: white;
      }
      
      .badge-padrao {
        background: #6c757d;
        color: white;
      }
      
      .tripinha-dica {
        background: rgba(232, 119, 34, 0.1);
        border-radius: 8px;
        padding: 12px;
        margin: 8px 0;
        display: flex;
        gap: 8px;
      }
      
      .tripinha-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      
      .tripinha-emoji {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
      }
      
      .dica-conteudo {
        flex: 1;
        font-size: 13px;
        line-height: 1.4;
      }
      
      .previsao-tempo {
        background: rgba(0, 163, 224, 0.1);
        border-radius: 6px;
        padding: 8px 12px;
        margin: 12px 0;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }
      
      .dia-observacao {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 6px;
        padding: 8px 12px;
        margin: 12px 0;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }
      
      .fade-out {
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      @media (max-width: 480px) {
        .roteiro-content {
          padding: 12px;
        }
        
        .dia-header {
          padding: 10px 12px;
        }
        
        .atividades-continuas {
          padding: 12px;
        }
        
        .toast {
          right: 12px;
          max-width: calc(100vw - 24px);
        }
        
        .resumo-grid {
          gap: 8px;
        }
        
        .resumo-item {
          gap: 8px;
        }
      }
    </style>
  `;
  
  document.head.insertAdjacentHTML('beforeend', estilosCriticos);
})();

console.log('🎯 Benetrip Roteiro Contínuo v8.5 - Sistema completo integrado com /api/itinerary-generator carregado e pronto!');

/* 
 * ==========================================
 * FIM DO ARQUIVO - BENETRIP ROTEIRO v8.5 INTEGRADO
 * ==========================================
 * 
 * Principais melhorias implementadas:
 * ✅ Integração completa com /api/itinerary-generator
 * ✅ Suporte para DeepSeek e Claude APIs
 * ✅ Conversão de estrutura manhã/tarde/noite para contínua
 * ✅ Geração de roteiro 100% via IA real
 * ✅ Roteiro contínuo sem divisões de período
 * ✅ Lazy loading avançado com Intersection Observer
 * ✅ Sistema de cache inteligente para imagens
 * ✅ Performance otimizada para mobile-first
 * ✅ Controle de qualidade em busca de imagens
 * ✅ Fallbacks inteligentes contextuais
 * ✅ Tratamento robusto de erros
 * ✅ Métricas de performance integradas
 * ✅ Estilos CSS críticos injetados
 * ✅ Compatibilidade total com sistema existente
 * ✅ Fallback de emergência se API falhar
 * ✅ Utilitários de debug para desenvolvimento
 * 
 * FLUXO PRINCIPAL:
 * 1. Chama /api/itinerary-generator com parâmetros
 * 2. API usa DeepSeek ou Claude para gerar roteiro
 * 3. Sistema converte estrutura para formato contínuo
 * 4. Aplica otimizações e busca imagens
 * 5. Fallback básico se API não funcionar
 * 
 * APIs NECESSÁRIAS:
 * - /api/itinerary-generator (IA para roteiros) ✅ INTEGRADA
 * - /api/image-search (busca de imagens)
 * - /api/weather (previsão do tempo)
 * 
 * VARIÁVEIS DE AMBIENTE NECESSÁRIAS:
 * - DEEPSEEK_API_KEY (obrigatória)
 * - CLAUDE_API_KEY (opcional)
 * 
 * Compatibilidade: 100% com APIs e localStorage existentes
 * Performance: Otimizada para carregamento < 3s
 * Mobile: Design responsivo 480px mobile-first
 * IA: Roteiros personalizados por DeepSeek/Claude
 * 
 */
