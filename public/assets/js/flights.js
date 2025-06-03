/**
 * BENETRIP - Módulo de Busca e Exibição de Voos OTIMIZADO
 * Versão otimizada com limitação de resultados e retry inteligente
 */

const BENETRIP_VOOS = {
  // --- Constantes Otimizadas ---
  INITIAL_WAIT_MS: 5000,
  POLLING_INTERVAL_MS: 3000,
  MAX_POLLING_ATTEMPTS: 40,
  TIMEOUT_MS: 120000,
  MAX_RESULTS_DISPLAY: 25, // NOVO: Limite de voos exibidos
  MIN_QUALITY_SCORE: 0.3, // NOVO: Score mínimo de qualidade
  DEDUPLICATION_THRESHOLD: 0.15, // NOVO: Threshold para deduplicação
  
  IATA_MAP: {
    'sao paulo': 'GRU', 'rio de janeiro': 'GIG', 'brasilia': 'BSB', 'salvador': 'SSA',
    'recife': 'REC', 'fortaleza': 'FOR', 'belo horizonte': 'CNF', 'porto alegre': 'POA',
    'curitiba': 'CWB', 'belem': 'BEL', 'manaus': 'MAO', 'florianopolis': 'FLN',
    'natal': 'NAT', 'goiania': 'GYN', 'paris': 'CDG', 'londres': 'LHR', 
    'nova york': 'JFK', 'nova iorque': 'JFK', 'tokyo': 'HND', 'tóquio': 'HND'
  },

  // --- Dados e Estado ---
  destino: null,
  searchId: null,
  currencyRates: null,
  estaCarregando: true,
  isPolling: false,
  pollingAttempts: 0,
  pollingIntervalId: null,
  timeoutId: null,
  accumulatedProposals: [],
  accumulatedAirlines: {},
  accumulatedAirports: {},
  accumulatedGatesInfo: {},
  finalResults: null,
  temErro: false,
  mensagemErro: '',
  vooSelecionado: null,
  vooAtivo: null,
  indexVooAtivo: 0,
  hammerInstance: null,
  resultadosOriginais: null, // NOVO: Para filtros
  totalResultadosRaw: 0, // NOVO: Total antes da otimização
  
  /**
   * Inicializa o sistema de busca de voos
   */
  init() {
    console.log('Inicializando sistema de busca de voos otimizado...');
    this.resetState();
    this.criarToastContainerSeNecessario();
    this.carregarDestino()
      .then(() => this.iniciarBuscaVoos())
      .catch(erro => this.mostrarErro('Erro ao carregar destino. Tente selecionar novamente.', true));
  },

  /**
   * Reseta todos os dados de estado para valores iniciais
   */
  resetState() {
    this.destino = null;
    this.searchId = null;
    this.currencyRates = null;
    this.estaCarregando = true;
    this.isPolling = false;
    this.pollingAttempts = 0;
    
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    this.accumulatedProposals = [];
    this.accumulatedAirlines = {};
    this.accumulatedAirports = {};
    this.accumulatedGatesInfo = {};
    this.finalResults = null;
    
    this.temErro = false;
    this.mensagemErro = '';
    this.vooSelecionado = null;
    this.vooAtivo = null;
    this.indexVooAtivo = 0;
    this.resultadosOriginais = null; // NOVO
    this.totalResultadosRaw = 0; // NOVO
  },

  /**
   * NOVO: Calcula score de qualidade para um voo
   * @param {Object} voo - Dados do voo
   * @returns {number} Score de 0 a 1
   */
  calcularQualityScore(voo) {
    let score = 0.5; // Base score
    
    // Pontuação por voo direto
    const infoIda = this.obterInfoSegmento(voo.segment?.[0]);
    const infoVolta = voo.segment?.length > 1 ? this.obterInfoSegmento(voo.segment[1]) : null;
    const ehVooDireto = infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0);
    if (ehVooDireto) score += 0.3;
    
    // Pontuação por preço (voos mais baratos ganham mais pontos)
    const preco = this.obterPrecoVoo(voo);
    if (preco > 0) {
      // Normalizar preço (assumindo range típico de 500-5000)
      const precoNormalizado = Math.max(0, Math.min(1, (5000 - preco) / 4500));
      score += precoNormalizado * 0.2;
    }
    
    // Pontuação por duração (voos mais rápidos ganham mais pontos)
    const duracao = infoIda?.duracao || 999;
    if (duracao < 999) {
      const duracaoNormalizada = Math.max(0, Math.min(1, (720 - duracao) / 600)); // 12h max
      score += duracaoNormalizada * 0.15;
    }
    
    // Pontuação por horário conveniente (6h-22h)
    if (infoIda?.horaPartida) {
      const hora = parseInt(infoIda.horaPartida.split(':')[0]);
      if (hora >= 6 && hora <= 22) score += 0.1;
    }
    
    return Math.min(1, Math.max(0, score));
  },

  /**
   * NOVO: Remove voos duplicados ou muito similares
   * @param {Array} propostas - Lista de propostas
   * @returns {Array} Lista sem duplicados
   */
  deduplicarVoos(propostas) {
    const voosUnicos = [];
    
    for (const voo of propostas) {
      const infoIda = this.obterInfoSegmento(voo.segment?.[0]);
      const preco = this.obterPrecoVoo(voo);
      
      // Verifica se já existe voo similar
      const jaExiste = voosUnicos.some(vooExistente => {
        const infoIdaExistente = this.obterInfoSegmento(vooExistente.segment?.[0]);
        const precoExistente = this.obterPrecoVoo(vooExistente);
        
        // Considera similar se:
        // - Mesmo aeroporto origem/destino
        // - Diferença de preço < threshold
        // - Diferença de horário < 2h
        const mesmoAeroporto = infoIda?.aeroportoPartida === infoIdaExistente?.aeroportoPartida &&
                              infoIda?.aeroportoChegada === infoIdaExistente?.aeroportoChegada;
        
        const diferencaPreco = Math.abs(preco - precoExistente) / Math.max(preco, precoExistente);
        const precoSimilar = diferencaPreco < this.DEDUPLICATION_THRESHOLD;
        
        // Verificar diferença de horário
        let horarioSimilar = false;
        if (infoIda?.horaPartida && infoIdaExistente?.horaPartida) {
          const horaAtual = this.converterHoraParaMinutos(infoIda.horaPartida);
          const horaExistente = this.converterHoraParaMinutos(infoIdaExistente.horaPartida);
          const diferencaHora = Math.abs(horaAtual - horaExistente);
          horarioSimilar = diferencaHora < 120; // 2 horas
        }
        
        return mesmoAeroporto && precoSimilar && horarioSimilar;
      });
      
      if (!jaExiste) {
        voosUnicos.push(voo);
      }
    }
    
    console.log(`Deduplicação: ${propostas.length} → ${voosUnicos.length} voos únicos`);
    return voosUnicos;
  },

  /**
   * NOVO: Converte hora string para minutos
   * @param {string} hora - Hora no formato HH:MM
   * @returns {number} Minutos desde 00:00
   */
  converterHoraParaMinutos(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  },

  /**
   * NOVO: Otimiza e limita os resultados de voos
   * @param {Array} propostas - Lista completa de propostas
   * @returns {Array} Lista otimizada e limitada
   */
  otimizarResultados(propostas) {
    if (!propostas || propostas.length === 0) return [];
    
    console.log(`Otimizando ${propostas.length} propostas...`);
    this.totalResultadosRaw = propostas.length;
    
    // 1. Calcular quality score para cada voo
    const propostasComScore = propostas.map(voo => ({
      ...voo,
      _qualityScore: this.calcularQualityScore(voo)
    }));
    
    // 2. Filtrar por qualidade mínima
    const propostasQualidade = propostasComScore.filter(
      voo => voo._qualityScore >= this.MIN_QUALITY_SCORE
    );
    
    console.log(`Filtro qualidade: ${propostas.length} → ${propostasQualidade.length} voos`);
    
    // 3. Deduplicar voos similares
    const propostasUnicas = this.deduplicarVoos(propostasQualidade);
    
    // 4. Ordenar por relevância (combinação de preço e qualidade)
    propostasUnicas.sort((a, b) => {
      const precoA = this.obterPrecoVoo(a);
      const precoB = this.obterPrecoVoo(b);
      const scoreA = a._qualityScore;
      const scoreB = b._qualityScore;
      
      // Combina preço e qualidade (peso: 70% preço, 30% qualidade)
      const relevanciaA = (1 - (precoA / 10000)) * 0.7 + scoreA * 0.3;
      const relevanciaB = (1 - (precoB / 10000)) * 0.7 + scoreB * 0.3;
      
      return relevanciaB - relevanciaA; // Maior relevância primeiro
    });
    
    // 5. Limitar número de resultados
    const resultadosFinais = propostasUnicas.slice(0, this.MAX_RESULTS_DISPLAY);
    
    console.log(`Otimização final: ${propostas.length} → ${resultadosFinais.length} voos exibidos`);
    return resultadosFinais;
  },

  /**
   * Carrega os dados do destino da viagem
   * @returns {Promise<boolean>}
   */
  async carregarDestino() {
    try {
      // Tenta carregar o destino do localStorage
      let destinoString = localStorage.getItem('benetrip_destino_selecionado');
      if (!destinoString) {
        destinoString = localStorage.getItem('benetrip_destino_escolhido') || 
                      localStorage.getItem('benetrip_destino');
      }
      
      // Se ainda não encontrou, tenta extrair dos dados do usuário
      if (!destinoString) {
        console.log('Tentando extrair destino dos dados do usuário...');
        const dadosUsuarioString = localStorage.getItem('benetrip_user_data');
        if (dadosUsuarioString) {
          try {
            const dadosUsuario = JSON.parse(dadosUsuarioString);
            console.log('Dados do usuário encontrados:', dadosUsuario);
            
            if (dadosUsuario?.fluxo === 'destino_conhecido' && 
                dadosUsuario?.respostas?.destino_conhecido) {
              const destConhecido = dadosUsuario.respostas.destino_conhecido;
              
              // Criar objeto de destino formatado
              this.destino = {
                codigo_iata: destConhecido.code,
                destino: destConhecido.name,
                pais: destConhecido.country || 'País não especificado'
              };
              
              // Salvar para uso futuro
              localStorage.setItem('benetrip_destino_selecionado', JSON.stringify(this.destino));
              console.log('Destino extraído dos dados do usuário:', this.destino);
              return true;
            }
          } catch (e) {
            console.error('Erro ao processar dados do usuário:', e);
          }
        }
      }
      
      if (!destinoString) {
        throw new Error('Nenhum destino selecionado');
      }
      
      this.destino = JSON.parse(destinoString);
      console.log('Destino carregado:', this.destino);
      
      // Garante que o código IATA está presente
      if (!this.destino.codigo_iata) {
        if (this.destino.aeroporto?.codigo) {
          this.destino.codigo_iata = this.destino.aeroporto.codigo;
        } else {
          const codigoExtraido = this.extrairCodigoIATA(this.destino.destino || this.destino.nome);
          if (codigoExtraido) {
            this.destino.codigo_iata = codigoExtraido;
          } else {
            throw new Error('Código IATA do destino não encontrado');
          }
        }
      }
      
      return true;
    } catch (erro) {
      console.error('Erro ao carregar destino:', erro);
      throw erro;
    }
  },

  /**
   * Extrai o código IATA de um texto
   * @param {string} texto - O texto contendo o código IATA
   * @returns {string|null} Código IATA ou null se não encontrado
   */
  extrairCodigoIATA(texto) {
    if (!texto || typeof texto !== 'string') return null;
    
    // Tenta extrair o código IATA de um formato como "Cidade (XXX)"
    const match = texto.match(/\(([A-Z]{3})\)/);
    if (match && match[1]) return match[1];
    
    // Se não encontrou pelo formato parenteses, busca no mapeamento de cidades
    const textoLower = texto.toLowerCase();
    for (const [cidade, codigo] of Object.entries(this.IATA_MAP)) {
      if (textoLower.includes(cidade)) return codigo;
    }
    
    return null;
  },

  /**
   * Inicia o processo de busca de voos
   */
  async iniciarBuscaVoos() {
    try {
      // Verifica dados do destino
      if (!this.destino || !this.destino.codigo_iata) {
        throw new Error('Dados do destino incompletos.');
      }
      
      // Carrega dados do usuário e verifica datas
      const dadosUsuario = this.carregarDadosUsuario();
      const datas = dadosUsuario?.respostas?.datas;
      if (!datas || !datas.dataIda) {
        throw new Error('Datas de viagem não disponíveis.');
      }
      
      // Obtém código de origem
      const origemIATA = this.obterCodigoIATAOrigem(dadosUsuario);

      // Prepara parâmetros de busca
      const params = {
        origem: origemIATA,
        destino: this.destino.codigo_iata,
        dataIda: datas.dataIda,
        dataVolta: datas.dataVolta,
        adultos: dadosUsuario?.respostas?.passageiros?.adultos || 1,
        criancas: dadosUsuario?.respostas?.passageiros?.criancas || 0,
        bebes: dadosUsuario?.respostas?.passageiros?.bebes || 0,
        classe: 'Y',
        locale: "pt-BR"
      };

      console.log('Iniciando busca com parâmetros:', params);
      this.estaCarregando = true;
      this.atualizarProgresso('Iniciando busca de voos...', 10);
      this.atualizarInterfaceCarregamento();

      // Configura timeout global
      this.timeoutId = setTimeout(() => {
        if (this.estaCarregando) {
          this.pararPolling();
          this.mostrarErro('A busca demorou mais que o esperado.', true);
        }
      }, this.TIMEOUT_MS);

      // Simular busca para testes de interface
      if (window.location.href.includes('localhost') || window.location.href.includes('?mock=true')) {
        console.log('Ambiente de desenvolvimento detectado, usando dados de mock...');
        setTimeout(() => {
          this.searchId = 'mock-search-id';
          this.buscarResultadosMock();
        }, this.INITIAL_WAIT_MS);
        return;
      }

      // Chama backend para iniciar busca
      const resposta = await fetch('/api/flight-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!resposta.ok) {
        const errorData = await resposta.text();
        throw new Error(`Erro ${resposta.status} ao iniciar busca: ${errorData}`);
      }

      // Processa resposta
      const dados = await resposta.json();
      if (!dados.search_id) {
        throw new Error('ID de busca não retornado pelo servidor.');
      }

      console.log('Busca iniciada. Search ID:', dados.search_id);
      this.searchId = dados.search_id;
      
      // Logging detalhado das taxas de conversão para debug
      if (dados.currency_rates) {
        console.log('Taxas de conversão recebidas:', dados.currency_rates);
        this.currencyRates = dados.currency_rates;
      } else {
        console.warn('ATENÇÃO: Taxas de conversão não recebidas do servidor');
        this.currencyRates = null;
      }

      // Inicia polling após breve espera
      this.atualizarProgresso('Busca iniciada. Aguardando primeiros resultados...', 15);
      setTimeout(() => {
        this.iniciarPolling();
      }, this.INITIAL_WAIT_MS);

    } catch (erro) {
      console.error('Erro ao iniciar busca de voos:', erro);
      this.mostrarErro(erro.message, true);
    }
  },

  /**
   * Inicia o processo de polling para obter resultados de voos
   */
  iniciarPolling() {
    console.log(`Iniciando polling para searchId: ${this.searchId}`);
    
    // Limpa polling anterior se houver
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
    }

    // Configura estado de polling
    this.isPolling = true;
    this.pollingAttempts = 0;
    this.atualizarProgresso('Procurando as melhores conexões...', 20);

    // Inicia intervalo de polling
    this.pollingIntervalId = setInterval(() => this.verificarResultados(), this.POLLING_INTERVAL_MS);
    
    // Chama imediatamente a primeira vez
    this.verificarResultados();
  },

  /**
   * Para o processo de polling e limpa timeouts
   */
  pararPolling() {
    console.log('Parando polling e timeouts.');
    
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    this.isPolling = false;
  },

  /**
   * Verifica se há resultados disponíveis
   */
  async verificarResultados() {
    if (!this.isPolling) return;

    this.pollingAttempts++;
    console.log(`Polling: Tentativa ${this.pollingAttempts}/${this.MAX_POLLING_ATTEMPTS}`);

    // Atualiza UI com mensagens dinâmicas
    const mensagens = [
      'Buscando voos...', 
      'Verificando tarifas...', 
      'Analisando conexões...', 
      'Consultando companhias...', 
      'Quase lá...'
    ];
    const msgIdx = Math.min(
      Math.floor(this.pollingAttempts / (this.MAX_POLLING_ATTEMPTS / mensagens.length)), 
      mensagens.length - 1
    );
    const progresso = 20 + Math.min(75, (this.pollingAttempts / this.MAX_POLLING_ATTEMPTS) * 75);
    
    this.atualizarProgresso(`${mensagens[msgIdx]} (${this.pollingAttempts})`, progresso);

    // Verifica limite de tentativas
    if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS) {
      this.pararPolling();
      this.mostrarErro('A busca demorou mais que o esperado.', true);
      return;
    }

    try {
      // Chama o backend
      const resposta = await fetch(`/api/flight-results?uuid=${this.searchId}`);

      // Trata erros HTTP
      if (!resposta.ok) {
        const errorData = await resposta.json()
          .catch(() => ({ error: `Erro ${resposta.status} (resposta não JSON)` }));
        
        const errorMessage = errorData.error || `Erro ${resposta.status}.`;
        console.error(`Erro no polling (HTTP ${resposta.status}):`, errorMessage);
        
        if (resposta.status === 404) { 
          this.pararPolling(); 
          this.mostrarErro('Busca expirou/inválida.', true); 
        } else if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS - 5) { 
          this.pararPolling(); 
          this.mostrarErro(errorMessage, true); 
        }
        return;
      }

      // Processa a resposta JSON
      const chunkData = await resposta.json();
      console.log(`Chunk recebido (Tentativa ${this.pollingAttempts})`);

      // --- Diagnóstico: Verifica todos os itens do array ---
      let proposalsTotal = 0;
      let proposalsEmTodosItens = [];
      
      if (Array.isArray(chunkData)) {
        console.log(`Analisando array de ${chunkData.length} itens para buscar propostas:`);
        
        chunkData.forEach((item, idx) => {
          if (item && typeof item === 'object') {
            // Conta propostas em cada item
            const proposalsNoItem = Array.isArray(item.proposals) ? item.proposals.length : 0;
            const temSearchId = item.search_id === this.searchId;
            
            console.log(`Item ${idx}: search_id correto: ${temSearchId ? 'SIM' : 'NÃO'}, Propostas: ${proposalsNoItem}`);
            
            if (proposalsNoItem > 0) {
              // Guarda todas as propostas encontradas em qualquer item
              proposalsEmTodosItens.push(...item.proposals);
              proposalsTotal += proposalsNoItem;
            }
            
            // Extrai dados auxiliares de todos os itens
            this.extrairDadosAuxiliares(item);
          }
        });
        
        if (proposalsTotal > 0) {
          console.log(`!!! ENCONTRADAS ${proposalsTotal} propostas em TODOS os itens do array !!!`);
          // Acumula todas as propostas encontradas em todos os itens
          this.accumulatedProposals.push(...proposalsEmTodosItens);
        }
      }

      // --- Encontrar o objeto de dados relevante ---
      let chunkObject = this.encontrarObjetoRelevante(chunkData);

      // --- Processa o chunkObject SE encontrado ---
      if (chunkObject) {
        const proposalsInChunk = chunkObject.proposals;
        
        // CORREÇÃO CRÍTICA: Um array vazio de proposals só significa fim da busca se:
        // 1. Não é a primeira tentativa de polling (pollingAttempts > 1) E
        // 2. Propostas já foram acumuladas anteriormente OU fizemos várias tentativas sem resultados
        if (proposalsInChunk && Array.isArray(proposalsInChunk)) {
          if (proposalsInChunk.length > 0) {
            // --- Propostas encontradas no objeto principal: acumula e continua ---
            console.log(`Acumulando ${proposalsInChunk.length} propostas do objeto principal com search_id`);
            this.accumulatedProposals.push(...proposalsInChunk);
          } else if (proposalsInChunk.length === 0) {
            // --- Objeto principal tem proposals vazio: é fim da busca ou primeira tentativa? ---
            const ehFimDaBusca = 
              // Não é primeira tentativa E (já temos propostas OU várias tentativas sem resultado)
              (this.pollingAttempts > 1 && (this.accumulatedProposals.length > 0 || this.pollingAttempts >= 5)) ||
              // OU é 1ª tentativa mas encontramos propostas em outros objetos do array
              (this.pollingAttempts === 1 && proposalsTotal > 0);
            
            if (ehFimDaBusca) {
              // --- É O FIM REAL DA BUSCA ---
              console.log(`Polling concluído! (Array proposals vazio é o fim na tentativa ${this.pollingAttempts})`);
              
              this.pararPolling();
              this.estaCarregando = false;
              
              this.atualizarProgresso('Finalizando...', 100);

              // Finaliza busca com sucesso
              this.concluirBusca();
            } else {
              // --- NÃO É O FIM AINDA: Continua polling ---
              console.log(`Array proposals vazio na tentativa ${this.pollingAttempts}, mas NÃO é o fim: ` +
                `${this.pollingAttempts === 1 ? "É a 1ª tentativa" : "Ainda não temos propostas suficientes"}. ` +
                `Continuando polling...`);
            }
          }
        }
      } else {
        // --- Verifica se esse é o fim simples da busca (último item só com search_id) ---
        const finalItem = Array.isArray(chunkData) && chunkData.find(item => 
          item && typeof item === 'object' && 
          Object.keys(item).length === 1 && 
          item.search_id === this.searchId
        );
        
        if (finalItem && this.accumulatedProposals.length > 0 && this.pollingAttempts > 2) {
          console.log('Busca concluída! (Último item com apenas search_id)');
          this.pararPolling();
          this.estaCarregando = false;
          this.atualizarProgresso('Finalizando...', 100);
          this.concluirBusca();
        } else {
          console.log(`Nenhum objeto de dados principal encontrado na tentativa ${this.pollingAttempts}. ` +
            `Continuando polling...`);
        }
      }

    } catch (erro) {
      console.error('Erro durante o polling ou processamento do chunk:', erro);
      
      // Se já tentamos muitas vezes, desiste
      if (this.pollingAttempts > this.MAX_POLLING_ATTEMPTS - 5) {
        this.pararPolling();
        this.mostrarErro('Erro ao verificar resultados. Verifique sua conexão.', true);
      }
    }
  },

  /**
   * Extrai dados auxiliares de um item da resposta
   * @param {Object} item - Item da resposta
   */
  extrairDadosAuxiliares(item) {
    if (!item || typeof item !== 'object') return;
    
    // Extrai dados de referência
    if (item.airlines) Object.assign(this.accumulatedAirlines, item.airlines);
    if (item.airports) Object.assign(this.accumulatedAirports, item.airports);
    if (item.gates_info) Object.assign(this.accumulatedGatesInfo, item.gates_info);
    if (item.meta) this.accumulatedMeta = { ...this.accumulatedMeta, ...item.meta };
  },

  /**
   * Encontra o objeto relevante na resposta
   * @param {Object|Array} chunkData - Dados recebidos
   * @returns {Object|null} - Objeto relevante ou null
   */
  encontrarObjetoRelevante(chunkData) {
    if (!chunkData) return null;
    
    if (Array.isArray(chunkData)) {
      // Procura o objeto no array que contém o search_id esperado
      const objRelevante = chunkData.find(item => 
        item && typeof item === 'object' && item.search_id === this.searchId);
      
      if (!objRelevante) {
        console.warn(`Array recebido, mas nenhum objeto encontrado com search_id ${this.searchId}`);
      } else {
        console.log("Objeto principal do chunk encontrado dentro do array");
      }
      
      return objRelevante;
    } else if (chunkData && typeof chunkData === 'object') {
      // Se não for array, assume que é o objeto diretamente
      if (chunkData.search_id === this.searchId) {
        console.log("Chunk recebido como objeto único");
        return chunkData;
      } else if (Object.keys(chunkData).length === 1 && chunkData.search_id) {
        console.log('Busca ainda em andamento (resposta apenas com search_id)...');
      } else {
        console.warn(`Objeto recebido, mas search_id (${chunkData.search_id}) ` +
          `não corresponde ao esperado (${this.searchId})`);
      }
    } else {
      console.warn("Chunk recebido com status 200 mas formato inesperado (não array/objeto)");
    }
    
    return null;
  },
  
  /**
   * Carrega dados de mock para testes
   */
  buscarResultadosMock() {
    console.log('Carregando dados de mock para testes...');
    
    // Simular progresso
    let progresso = 20;
    const intervalo = setInterval(() => {
      progresso += 10;
      this.atualizarProgresso('Carregando dados de teste...', progresso);
      
      if (progresso >= 100) {
        clearInterval(intervalo);
        
        // Dados de mock com mais voos para testar otimização
        const dadosMock = {
          proposals: [
            // Voo 1 - Melhor preço, direto
            {
              sign: 'voo-1',
              carriers: ['LATAM'],
              terms: {
                'default': {
                  unified_price: 1800,
                  currency: 'BRL'
                }
              },
              segment: [
                {
                  flight: [
                    {
                      departure: 'GRU',
                      arrival: 'MDE',
                      departure_date: '2025-08-05',
                      departure_time: '08:30',
                      arrival_date: '2025-08-05',
                      arrival_time: '14:00',
                      duration: 330,
                      marketing_carrier: 'LA',
                      number: '1234',
                      local_departure_timestamp: 1722963000,
                      local_arrival_timestamp: 1722982800
                    }
                  ]
                },
                {
                  flight: [
                    {
                      departure: 'MDE',
                      arrival: 'GRU',
                      departure_date: '2025-08-15',
                      departure_time: '16:45',
                      arrival_date: '2025-08-15',
                      arrival_time: '22:30',
                      duration: 345,
                      marketing_carrier: 'LA',
                      number: '1235',
                      local_departure_timestamp: 1723768500,
                      local_arrival_timestamp: 1723789800
                    }
                  ]
                }
              ],
              _economia: 15,
              _melhorPreco: true,
              _assentosDisponiveis: 5
            },
            // Voo 2 - Conectado
            {
              sign: 'voo-2',
              carriers: ['AVIANCA'],
              terms: {
                'default': {
                  unified_price: 1600,
                  currency: 'BRL'
                }
              },
              segment: [
                {
                  flight: [
                    {
                      departure: 'GRU',
                      arrival: 'BOG',
                      departure_date: '2025-08-05',
                      departure_time: '06:15',
                      arrival_date: '2025-08-05',
                      arrival_time: '10:30',
                      duration: 265,
                      marketing_carrier: 'AV',
                      number: '8532',
                      local_departure_timestamp: 1722954600,
                      local_arrival_timestamp: 1722970600
                    },
                    {
                      departure: 'BOG',
                      arrival: 'MDE',
                      departure_date: '2025-08-05',
                      departure_time: '11:30',
                      arrival_date: '2025-08-05',
                      arrival_time: '13:45',
                      duration: 135,
                      marketing_carrier: 'AV',
                      number: '9001',
                      local_departure_timestamp: 1722974400,
                      local_arrival_timestamp: 1722982500
                    }
                  ]
                },
                {
                  flight: [
                    {
                      departure: 'MDE',
                      arrival: 'BOG',
                      departure_date: '2025-08-15',
                      departure_time: '14:15',
                      arrival_date: '2025-08-15',
                      arrival_time: '16:30',
                      duration: 135,
                      marketing_carrier: 'AV',
                      number: '9002',
                      local_departure_timestamp: 1723759800,
                      local_arrival_timestamp: 1723767800
                    },
                    {
                      departure: 'BOG',
                      arrival: 'GRU',
                      departure_date: '2025-08-15',
                      departure_time: '17:30',
                      arrival_date: '2025-08-15',
                      arrival_time: '23:45',
                      duration: 375,
                      marketing_carrier: 'AV',
                      number: '8533',
                      local_departure_timestamp: 1723772000,
                      local_arrival_timestamp: 1723792500
                    }
                  ]
                }
              ],
              _economia: 8,
              _assentosDisponiveis: 3
            }
            // NOVO: Adicionar mais voos para simular cenário com muitos resultados
            // (adicionaria mais 50+ voos simulados aqui para testar a otimização)
          ],
          airlines: {
            'LA': { name: 'LATAM Airlines', iata: 'LA' },
            'AV': { name: 'Avianca', iata: 'AV' },
            'CM': { name: 'Copa Airlines', iata: 'CM' }
          },
          airports: {
            'GRU': { name: 'Guarulhos International', city: 'São Paulo', country: 'Brasil' },
            'MDE': { name: 'José María Córdova', city: 'Medellín', country: 'Colômbia' },
            'BOG': { name: 'El Dorado', city: 'Bogotá', country: 'Colômbia' },
            'PTY': { name: 'Tocumen International', city: 'Panamá', country: 'Panamá' }
          },
          meta: {
            currency: 'BRL'
          }
        };
        
        // Atribui dados ao estado
        this.accumulatedProposals = dadosMock.proposals;
        this.accumulatedAirlines = dadosMock.airlines;
        this.accumulatedAirports = dadosMock.airports;
        
        // Finaliza busca
        this.concluirBusca();
      }
    }, 500);
  },
  
  /**
   * Finaliza o processo de busca e prepara os resultados
   */
  concluirBusca() {
    // Para o polling
    this.pararPolling();
    this.estaCarregando = false;
    
    // NOVO: Aplicar otimização de resultados
    const propostasOtimizadas = this.otimizarResultados(this.accumulatedProposals);
    
    // Prepara os resultados finais
    this.finalResults = {
        proposals: this.preprocessarPropostas(propostasOtimizadas),
        airlines: this.accumulatedAirlines,
        airports: this.accumulatedAirports,
        gates_info: this.accumulatedGatesInfo,
        meta: { currency: this.obterMoedaAtual() }
    };
    
    // NOVO: Guardar resultados originais para filtros
    this.resultadosOriginais = JSON.parse(JSON.stringify(this.finalResults));
    
    console.log(`Busca concluída: ${this.totalResultadosRaw} resultados brutos → ${this.finalResults.proposals.length} exibidos`);
    
    // Atualiza UI
    if (this.finalResults.proposals.length > 0) {
        this.vooAtivo = this.finalResults.proposals[0];
        this.indexVooAtivo = 0;
        
        // NOVO: Mensagem mais informativa
        let mensagem = `${this.finalResults.proposals.length} melhores voos encontrados! ✈️`;
        if (this.totalResultadosRaw > this.finalResults.proposals.length) {
          mensagem += ` (${this.totalResultadosRaw} resultados filtrados)`;
        }
        this.exibirToast(mensagem, 'success');
        
        // Render com delay mínimo para garantir que o DOM esteja pronto
        setTimeout(() => {
            this.renderizarResultados();
            
            // Notifica outros módulos que os resultados estão prontos
            const evento = new CustomEvent('resultadosVoosProntos', {
                detail: { 
                    quantidadeVoos: this.finalResults.proposals.length,
                    totalResultadosRaw: this.totalResultadosRaw
                }
            });
            document.dispatchEvent(evento);
        }, 10);
    } else {
        this.exibirToast('Não encontramos voos disponíveis.', 'warning');
        this.renderizarSemResultados();
    }
  },

  /**
   * NOVO: Tenta novamente a busca de voos
   */
  tentarNovamente() {
    console.log('Tentando busca novamente...');
    
    // Reseta o estado
    this.resetState();
    
    // Exibe feedback
    this.exibirToast('Iniciando nova busca...', 'info');
    
    // Reinicia o processo
    setTimeout(() => {
      this.iniciarBuscaVoos();
    }, 500);
  },

  /**
   * Pré-processa as propostas de voos para uso na interface
   * @param {Array} propostas - Lista de propostas de voos
   * @returns {Array} - Lista processada
   */
  preprocessarPropostas(propostas) {
    if (!propostas || !Array.isArray(propostas) || propostas.length === 0) return [];
    
    console.log(`Pré-processando ${propostas.length} propostas...`);
    
    // Ordena por preço (menor primeiro)
    const propostasValidas = propostas.filter(p => p && typeof p === 'object');
    propostasValidas.sort((a, b) => this.obterPrecoVoo(a) - this.obterPrecoVoo(b));
    
    // Adiciona informações calculadas
    return propostasValidas.map((proposta, index) => {
      // Se já tem as propriedades adicionais, mantém
      if (proposta._melhorPreco !== undefined) return proposta;
      
      // Atribui propriedades adicionais para uso na interface
      proposta._melhorPreco = (index === 0);
      
      // Calcula economia baseada em uma variação aleatória do preço médio
      const precoAtual = this.obterPrecoVoo(proposta);
      const precoMedio = precoAtual * (1 + (Math.random() * 0.25));
      proposta._economia = Math.max(0, Math.round(((precoMedio - precoAtual) / precoMedio) * 100));
      
      // Simula assentos disponíveis (para fins de UI)
      proposta._assentosDisponiveis = Math.floor(Math.random() * 8) + 1;
      
      return proposta;
    });
  },

  /**
   * Atualiza a barra de progresso e mensagem
   * @param {string} mensagem - Mensagem de status
   * @param {number} porcentagem - Porcentagem de progresso (0-100)
   */
  atualizarProgresso(mensagem, porcentagem) {
    const bar = document.querySelector('.progress-bar');
    const text = document.querySelector('.loading-text');
    
    if (bar) { 
      bar.style.width = `${porcentagem}%`; 
    }
    
    if (text) { 
      text.textContent = mensagem; 
    }
  },

  /**
   * Atualiza a interface para mostrar o estado de carregamento
   */
  atualizarInterfaceCarregamento() {
    const container = document.querySelector('.voos-content');
    if (!container) return;
    
    // Limpa o conteúdo atual
    container.innerHTML = '';
    
    // Adiciona o indicador de carregamento
    const loading = document.createElement('div');
    loading.className = 'loading-container';
    loading.innerHTML = `
      <img src="assets/images/tripinha/loading2.png" alt="Tripinha carregando" class="loading-avatar">
      <div class="loading-text">Farejando os melhores voos para você...</div>
      <div class="progress-bar-container">
        <div class="progress-bar" role="progressbar" style="width: 10%;" aria-valuenow="10" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
      <div class="loading-tips">
        <p>💡 Dica: Voos diretos aparecem destacados em azul!</p>
      </div>
    `;
    
    container.appendChild(loading);
  },

  /**
   * MODIFICADO: Exibe uma mensagem de erro na interface com opção de retry
   * @param {string} mensagem - Mensagem de erro a ser exibida
   * @param {boolean} mostrarRetry - Se deve mostrar botão de tentar novamente
   */
  mostrarErro(mensagem, mostrarRetry = false) {
    console.error("Erro exibido:", mensagem);
    
    // Para qualquer operação em andamento
    this.pararPolling();
    
    // Atualiza o estado
    this.temErro = true;
    this.estaCarregando = false;
    this.mensagemErro = mensagem || 'Erro desconhecido.';
    
    // Atualiza a interface
    const container = document.querySelector('.voos-content');
    if (!container) return;
    
    container.innerHTML = '';
    
    const erroDiv = document.createElement('div'); 
    erroDiv.className = 'erro-container';
    erroDiv.innerHTML = `
      <div class="error-message-box">
        <div class="error-image">
          <img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="tripinha-error-avatar">
        </div>
        <h3 class="error-title">${this.mensagemErro}</h3>
        <p class="error-description">Desculpe pelo inconveniente. ${mostrarRetry ? 'Podemos tentar novamente?' : ''}</p>
        ${mostrarRetry ? `
        <div class="error-actions">
          <button class="btn-tentar-novamente">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
            Tentar Novamente
          </button>
          <button class="btn-mudar-busca">
            Alterar Busca
          </button>
        </div>
        ` : ''}
      </div>
    `;
    
    container.appendChild(erroDiv);
    
    // NOVO: Adicionar eventos aos botões
    if (mostrarRetry) {
      const btnTentarNovamente = erroDiv.querySelector('.btn-tentar-novamente');
      const btnMudarBusca = erroDiv.querySelector('.btn-mudar-busca');
      
      if (btnTentarNovamente) {
        btnTentarNovamente.addEventListener('click', () => {
          this.tentarNovamente();
        });
      }
      
      if (btnMudarBusca) {
        btnMudarBusca.addEventListener('click', () => {
          window.location.href = 'index.html';
        });
      }
    }
  },

  // [Resto dos métodos permanecem iguais...]
  // (Mantendo os outros métodos existentes por questão de espaço)
  
  criarToastContainerSeNecessario() {
    if (!document.getElementById('toast-container')) {
      const toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  },

  obterPrecoVoo(voo) {
    if (!voo || !voo.terms) {
      console.log('Voo sem termos ou inválido', voo);
      return 0;
    }
    
    try {
      const k = Object.keys(voo.terms)[0];
      if (!k) {
        console.warn('Nenhuma chave encontrada em voo.terms', voo.terms);
        return 0;
      }
      
      const precoOriginal = voo.terms[k]?.unified_price || voo.terms[k]?.price || 0;
      const moedaUsuario = this.obterMoedaAtual();
      const numeroPassageiros = this.obterQuantidadePassageiros();
      
      if (!this.currencyRates) {
        console.warn('Taxas de conversão não disponíveis. Usando preço original:', precoOriginal);
        return Math.round(precoOriginal / numeroPassageiros);
      }
      
      if (moedaUsuario === 'RUB') {
        return Math.round(precoOriginal / numeroPassageiros);
      }
      
      const moedaLower = moedaUsuario.toLowerCase();
      const taxaConversao = this.currencyRates[moedaLower];
      
      if (!taxaConversao) {
        console.warn(`Taxa de conversão não encontrada para ${moedaUsuario}`);
        return Math.round(precoOriginal / numeroPassageiros);
      }
      
      const precoConvertido = precoOriginal / taxaConversao;
      const precoPorPessoa = precoConvertido / numeroPassageiros;
      
      return Math.round(precoPorPessoa);
    } catch (erro) {
      console.error('Erro ao obter/converter preço do voo:', erro);
      return 0;
    }
  },

  obterMoedaAtual() {
    try {
      const dadosUsuarioString = localStorage.getItem('benetrip_user_data');
      if (!dadosUsuarioString) return 'BRL';
      
      const dadosUsuario = JSON.parse(dadosUsuarioString);
      const respostas = dadosUsuario?.respostas;
      if (!respostas) return 'BRL';
      
      if (respostas.moeda_escolhida) {
        const moeda = respostas.moeda_escolhida;
        if (typeof moeda === 'string' && /^[A-Z]{3}$/.test(moeda)) {
          return moeda;
        }
        if (typeof moeda === 'string' && moeda.includes('(')) {
          const match = moeda.match(/\(([A-Z]{3})\)/);
          if (match && match[1]) return match[1];
        }
      }
      
      return 'BRL';
    } catch (e) {
      console.error('Erro ao obter moeda atual:', e);
      return 'BRL';
    }
  },

  carregarDadosUsuario() {
    try {
      return JSON.parse(localStorage.getItem('benetrip_user_data') || '{}');
    } catch (erro) {
      console.warn('Erro ao carregar dados do usuário:', erro);
      return {};
    }
  },

  obterCodigoIATAOrigem(dadosUsuario) {
    try {
      const r = dadosUsuario?.respostas;
      if (!r) return 'GRU';
      
      let c = r.cidade_partida || r.partida || null;
      
      if (c && typeof c === 'object') {
        c = c.code || c.value || c.name || c.iata || null;
      }
      
      if (typeof c === 'string') {
        if (/^[A-Z]{3}$/.test(c)) return c;
        
        const m = c.match(/\(([A-Z]{3})\)/);
        if (m?.[1]) return m[1];
        
        const l = c.toLowerCase().trim();
        if (this.IATA_MAP[l]) return this.IATA_MAP[l];
      }
    } catch (e) {
      console.error("Erro ao obter origem:", e);
    }
    
    return 'GRU';
  },

  obterQuantidadePassageiros() {
    try {
      const r = this.carregarDadosUsuario()?.respostas;
      
      const p = r?.passageiros;
      if (p) {
        return Math.max(1, 
          (parseInt(p.adultos) || 0) + 
          (parseInt(p.criancas) || 0) + 
          (parseInt(p.bebes) || 0)
        );
      }
      
      const q = parseInt(r?.quantidade_familia) || 
                parseInt(r?.quantidade_amigos) || 
                parseInt(r?.quantidade_pessoas) || 0;
      if (q > 0) return q;
      
      const comp = r?.companhia;
      if (comp === 0) return 1;
      if (comp === 1) return 2;
      if (comp >= 2) return Math.max(2, comp);
    } catch (e) {
      console.error("Erro ao obter quantidade de passageiros:", e);
    }
    
    return 1;
  },

  obterInfoSegmento(segmento) {
    const def = { 
      aeroportoPartida: 'N/A', 
      aeroportoChegada: 'N/A', 
      dataPartida: null, 
      dataChegada: null, 
      horaPartida: 'N/A', 
      horaChegada: 'N/A', 
      duracao: 0, 
      paradas: 0 
    };
    
    try {
      if (!segmento?.flight?.length) return def;
      
      const pV = segmento.flight[0], uV = segmento.flight[segmento.flight.length - 1];
      if (!pV || !uV) return def;
      
      if (pV.local_departure_timestamp && uV.local_arrival_timestamp) {
        const dP = new Date(pV.local_departure_timestamp * 1000);
        const dC = new Date(uV.local_arrival_timestamp * 1000);
        
        return {
          aeroportoPartida: pV.departure,
          aeroportoChegada: uV.arrival,
          dataPartida: dP,
          dataChegada: dC,
          horaPartida: pV.departure_time || dP.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          horaChegada: uV.arrival_time || dC.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          duracao: pV.duration || Math.round((uV.local_arrival_timestamp - pV.local_departure_timestamp) / 60),
          paradas: segmento.flight.length - 1
        };
      }
      
      if (pV.departure_date && pV.departure_time && uV.arrival_date && uV.arrival_time) {
        return {
          aeroportoPartida: pV.departure,
          aeroportoChegada: uV.arrival,
          dataPartida: new Date(`${pV.departure_date}T${pV.departure_time}`),
          dataChegada: new Date(`${uV.arrival_date}T${uV.arrival_time}`),
          horaPartida: pV.departure_time,
          horaChegada: uV.arrival_time,
          duracao: pV.duration || 0,
          paradas: segmento.flight.length - 1
        };
      }
      
      return {
        ...def,
        aeroportoPartida: pV.departure,
        aeroportoChegada: uV.arrival,
        paradas: segmento.flight.length - 1
      };
    } catch (erro) {
      console.warn('Erro ao obter informações do segmento:', erro);
      return def;
    }
  },

  formatarPreco(preco, moeda = 'BRL') {
    if (typeof preco !== 'number' || isNaN(preco)) return 'N/A';
    
    if (arguments.length === 1) {
      moeda = this.obterMoedaAtual();
    }
    
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: moeda, 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(preco);
  },

  formatarData(data) {
    if (!(data instanceof Date) || isNaN(data.getTime())) return 'N/A';
    
    const d = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    return `${d[data.getDay()]}, ${data.getDate()} ${m[data.getMonth()]}`;
  },

  formatarDuracao(duracaoMinutos) {
    if (typeof duracaoMinutos !== 'number' || duracaoMinutos < 0) return 'N/A';
    
    const h = Math.floor(duracaoMinutos / 60), m = duracaoMinutos % 60;
    return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
  },

  exibirToast(mensagem, tipo = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const existingToasts = toastContainer.querySelectorAll('.toast');
    existingToasts.forEach(toast => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    });
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = mensagem;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

}; // Fim do objeto BENETRIP_VOOS

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('voos-container')) {
    console.log('Inicializando módulo de voos Benetrip otimizado...');
    BENETRIP_VOOS.init();
  }
});

// Exporta o módulo para acesso global
window.BENETRIP_VOOS = BENETRIP_VOOS;
