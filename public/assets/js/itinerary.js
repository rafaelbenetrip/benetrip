/**
 * Benetrip - Sistema de Roteiro Contínuo Otimizado (VERSÃO 8.2 - CORRIGIDA)
 * Correções aplicadas:
 * - ✅ Imagens para TODOS os dias (removida limitação de 15)
 * - ✅ Event listeners corrigidos (página totalmente clicável)
 * - ✅ Fallbacks de imagem funcionais
 * - ✅ Performance otimizada
 */

const BENETRIP_ROTEIRO = {
  // Estado global
  dadosVoo: null,
  dadosUsuario: null,
  dadosDestino: null,
  roteiroPronto: null,
  estaCarregando: true,
  progressoAtual: 10,
  intervalId: null,
  imagensCache: new Map(),
  imageObserver: null,

  /**
   * ✅ INICIALIZAÇÃO OTIMIZADA
   */
  init() {
    console.log('🚀 Benetrip Roteiro v8.2 - Versão Corrigida');
    
    this.carregarDados()
      .then(() => this.gerarRoteiroIA())
      .catch(erro => {
        console.error('❌ Erro fatal:', erro);
        this.mostrarErro('Erro ao carregar dados. Por favor, tente novamente.');
      });
    
    this.configurarEventos();
    this.iniciarAnimacaoProgresso();
  },

  /**
   * ✅ CONFIGURAÇÃO DE EVENTOS CORRIGIDA
   */
  configurarEventos() {
    // Event delegation para elementos dinâmicos
    document.addEventListener('click', (e) => {
      // Botão compartilhar
      if (e.target.closest('#btn-compartilhar-roteiro')) {
        e.preventDefault();
        this.compartilharRoteiro();
        return;
      }
      
      // Botão editar
      if (e.target.closest('#btn-editar-roteiro')) {
        e.preventDefault();
        this.editarRoteiro();
        return;
      }
      
      // Botão voltar
      if (e.target.closest('.btn-voltar')) {
        e.preventDefault();
        history.back();
        return;
      }
      
      // Botões de mapa
      if (e.target.closest('.btn-ver-mapa-mini')) {
        e.preventDefault();
        const botao = e.target.closest('.btn-ver-mapa-mini');
        const local = botao.getAttribute('data-local');
        if (local) {
          this.abrirMapa(local);
        }
        return;
      }
    });
    
    // Configurar Intersection Observer melhorado
    this.configurarLazyLoadingMelhorado();
  },

  /**
   * ✅ LAZY LOADING MELHORADO
   */
  configurarLazyLoadingMelhorado() {
    if ('IntersectionObserver' in window) {
      this.imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              this.carregarImagemComFallback(img);
              this.imageObserver.unobserve(img);
            }
          }
        });
      }, {
        rootMargin: '100px 0px',
        threshold: 0.01
      });
    }
  },

  /**
   * ✅ CARREGAMENTO DE IMAGEM COM FALLBACK ROBUSTO
   */
  carregarImagemComFallback(img) {
    const originalSrc = img.dataset.src;
    const local = img.alt || 'Local';
    
    // Fallbacks robustos (sem via.placeholder.com)
    const fallbacks = [
      originalSrc,
      `https://picsum.photos/400/250?random=${Math.floor(Math.random() * 1000)}`,
      `https://source.unsplash.com/400x250/?travel,${encodeURIComponent(this.dadosDestino.destino)}`,
      this.criarImagemPlaceholderSVG(local)
    ];
    
    let tentativaAtual = 0;
    
    const tentarCarregar = () => {
      if (tentativaAtual >= fallbacks.length) {
        console.warn('⚠️ Todos os fallbacks falharam para:', local);
        img.style.display = 'none';
        return;
      }
      
      const src = fallbacks[tentativaAtual];
      
      img.onload = () => {
        img.style.opacity = '1';
        img.classList.add('loaded');
      };
      
      img.onerror = () => {
        tentativaAtual++;
        console.warn(`⚠️ Falha na imagem ${tentativaAtual}/${fallbacks.length} para:`, local);
        setTimeout(tentarCarregar, 100);
      };
      
      img.src = src;
    };
    
    tentarCarregar();
  },

  /**
   * ✅ NOVO: Cria placeholder SVG como último fallback
   */
  criarImagemPlaceholderSVG(texto) {
    const svg = `<svg width="400" height="250" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#E87722"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" 
            fill="white" text-anchor="middle" dominant-baseline="middle">
        ${texto}
      </text>
    </svg>`;
    
    return 'data:image/svg+xml;base64,' + btoa(svg);
  },

  /**
   * ✅ CARREGAMENTO DE DADOS (mantido)
   */
  async carregarDados() {
    try {
      console.log('📂 Carregando dados salvos...');
      
      const vooString = localStorage.getItem('benetrip_voo_selecionado');
      if (!vooString) {
        throw new Error('Nenhum voo foi selecionado. Redirecionando...');
      }
      
      this.dadosVoo = JSON.parse(vooString);
      console.log('✈️ Dados do voo carregados:', this.dadosVoo);
      
      const usuarioString = localStorage.getItem('benetrip_user_data');
      this.dadosUsuario = usuarioString ? JSON.parse(usuarioString) : {};
      console.log('👤 Dados do usuário carregados:', this.dadosUsuario);
      
      const destinoString = localStorage.getItem('benetrip_destino_selecionado');
      if (destinoString) {
        this.dadosDestino = JSON.parse(destinoString);
      } else {
        const codigoDestino = this.extrairCodigoDestino();
        this.dadosDestino = {
          destino: this.obterNomeDestinoPorCodigo(codigoDestino),
          codigo_iata: codigoDestino,
          pais: this.obterPaisPorCodigo(codigoDestino)
        };
      }
      console.log('📍 Destino definido:', this.dadosDestino);
      
      await this.normalizarEValidarDatas();
      return true;
      
    } catch (erro) {
      console.error('❌ Erro ao carregar dados:', erro);
      
      if (erro.message.includes('voo')) {
        setTimeout(() => {
          window.location.href = '/flights.html';
        }, 2000);
      }
      
      throw erro;
    }
  },

  /**
   * ✅ NORMALIZAÇÃO DE DATAS (mantido)
   */
  async normalizarEValidarDatas() {
    console.log('📅 Normalizando datas...');
    
    try {
      let dataIda = this.extrairDataIda();
      let dataVolta = this.extrairDataVolta();
      
      if (!dataIda && this.dadosUsuario?.respostas?.datas) {
        const datasRespostas = this.extrairDatasRespostas();
        if (datasRespostas) {
          dataIda = datasRespostas.ida;
          dataVolta = datasRespostas.volta;
        }
      }
      
      if (!dataIda) {
        throw new Error('Data de ida não encontrada');
      }
      
      dataIda = this.garantirFormatoISO(dataIda);
      if (dataVolta) {
        dataVolta = this.garantirFormatoISO(dataVolta);
      }
      
      const dataIdaObj = new Date(dataIda + 'T12:00:00');
      const dataVoltaObj = dataVolta ? new Date(dataVolta + 'T12:00:00') : null;
      
      if (isNaN(dataIdaObj.getTime())) {
        throw new Error('Data de ida inválida: ' + dataIda);
      }
      
      if (dataVoltaObj && isNaN(dataVoltaObj.getTime())) {
        throw new Error('Data de volta inválida: ' + dataVolta);
      }
      
      if (dataVoltaObj && dataVoltaObj <= dataIdaObj) {
        console.warn('⚠️ Data de volta anterior à ida, ajustando...');
        dataVoltaObj.setDate(dataIdaObj.getDate() + 3);
        dataVolta = this.formatarDataISO(dataVoltaObj);
      }
      
      if (!this.dadosVoo.infoIda) this.dadosVoo.infoIda = {};
      if (!this.dadosVoo.infoVolta) this.dadosVoo.infoVolta = {};
      
      this.dadosVoo.infoIda.dataPartida = dataIda;
      if (dataVolta) {
        this.dadosVoo.infoVolta.dataPartida = dataVolta;
      }
      
      console.log('✅ Datas normalizadas:', {
        ida: dataIda,
        volta: dataVolta,
        diasViagem: this.calcularDiasViagem(dataIda, dataVolta)
      });
      
    } catch (erro) {
      console.error('❌ Erro ao normalizar datas:', erro);
      
      const hoje = new Date();
      hoje.setDate(hoje.getDate() + 30);
      
      const ida = this.formatarDataISO(hoje);
      const volta = new Date(hoje);
      volta.setDate(hoje.getDate() + 5);
      
      this.dadosVoo.infoIda = { dataPartida: ida };
      this.dadosVoo.infoVolta = { dataPartida: this.formatarDataISO(volta) };
      
      console.warn('⚠️ Usando datas padrão:', this.dadosVoo.infoIda, this.dadosVoo.infoVolta);
    }
  },

  /**
   * ✅ GERAÇÃO DE ROTEIRO COM API REAL
   */
  async gerarRoteiroIA() {
    try {
      console.log('🤖 Iniciando geração do roteiro com IA...');
      
      const dataIda = this.getDataIda();
      const dataVolta = this.getDataVolta();
      const diasViagem = this.calcularDiasViagem(dataIda, dataVolta);
      
      console.log('📊 Parâmetros para IA:', {
        destino: this.dadosDestino,
        dataIda,
        dataVolta,
        diasViagem,
        preferencias: this.obterPreferenciasCompletas()
      });
      
      await this.delay(1500);
      
      const parametrosIA = {
        destino: this.dadosDestino.destino,
        pais: this.dadosDestino.pais,
        dataInicio: dataIda,
        dataFim: dataVolta,
        horaChegada: this.extrairHorarioChegada(),
        horaSaida: this.extrairHorarioPartida(),
        tipoViagem: this.obterTipoViagem(),
        tipoCompanhia: this.obterTipoCompanhia(),
        preferencias: this.obterPreferenciasCompletas(),
        modeloIA: 'claude'
      };
      
      console.log('🚀 Chamando API de roteiro...', parametrosIA);
      
      try {
        const roteiroIA = await this.chamarAPIRoteiroReal(parametrosIA);
        this.roteiroPronto = this.converterRoteiroParaContinuo(roteiroIA);
        console.log('✅ Roteiro da IA convertido para formato contínuo');
      } catch (erroAPI) {
        console.warn('⚠️ Erro na API, usando fallback:', erroAPI.message);
        this.roteiroPronto = await this.gerarRoteiroFallback(dataIda, dataVolta, diasViagem);
      }
      
      // ✅ CORREÇÃO: Executar tarefas em paralelo
      await Promise.all([
        this.buscarPrevisaoTempo(),
        this.buscarTodasImagensCorrigido() // <- MÉTODO CORRIGIDO
      ]);
      
      this.atualizarUIComRoteiroContino();
      
      console.log('✅ Roteiro contínuo gerado com sucesso!');
      
    } catch (erro) {
      console.error('❌ Erro ao gerar roteiro:', erro);
      this.mostrarErro('Não foi possível gerar seu roteiro. Por favor, tente novamente.');
      throw erro;
    } finally {
      this.finalizarCarregamento();
    }
  },

  /**
   * ✅ CORREÇÃO PRINCIPAL: Busca imagens para TODOS os dias/atividades
   */
  async buscarTodasImagensCorrigido() {
    try {
      console.log('🖼️ Iniciando busca COMPLETA de imagens...');
      
      if (!this.roteiroPronto?.dias || this.roteiroPronto.dias.length === 0) {
        console.warn('⚠️ Sem roteiro para buscar imagens');
        return;
      }
      
      // ✅ Coletar TODAS as atividades (sem limite)
      const todasAtividades = [];
      let totalAtividades = 0;
      
      this.roteiroPronto.dias.forEach((dia, diaIndex) => {
        if (dia.atividades?.length) {
          dia.atividades.forEach((atividade, ativIndex) => {
            if (atividade.local && !atividade.isEspecial) {
              todasAtividades.push({
                local: atividade.local,
                diaIndex,
                ativIndex,
                referencia: atividade
              });
              totalAtividades++;
            }
          });
        }
      });
      
      console.log(`📊 Estatísticas CORRIGIDAS: ${totalAtividades} atividades, ${todasAtividades.length} locais para buscar`);
      
      // ✅ REMOVIDA LIMITAÇÃO - buscar imagens para TODAS as atividades
      const imagensMap = new Map();
      let sucessos = 0;
      
      // Processar em lotes pequenos para não sobrecarregar
      const tamanhoLote = 3;
      for (let i = 0; i < todasAtividades.length; i += tamanhoLote) {
        const lote = todasAtividades.slice(i, i + tamanhoLote);
        
        const promessas = lote.map(async (ativInfo) => {
          try {
            const resultado = await this.buscarImagemComCache(ativInfo.local);
            
            if (resultado.sucesso) {
              imagensMap.set(ativInfo.local, resultado.url);
              sucessos++;
            }
            
            return resultado;
          } catch (erro) {
            console.warn(`⚠️ Erro na busca de imagem para ${ativInfo.local}:`, erro);
            return { sucesso: false, erro: erro.message };
          }
        });
        
        await Promise.allSettled(promessas);
        
        // Pequena pausa entre lotes
        if (i + tamanhoLote < todasAtividades.length) {
          await this.delay(200);
        }
      }
      
      // ✅ Aplicar imagens OU fallbacks para TODAS as atividades
      let imagensAplicadas = 0;
      this.roteiroPronto.dias.forEach((dia, diaIndex) => {
        if (dia.atividades?.length) {
          dia.atividades.forEach((atividade, ativIndex) => {
            if (atividade.local && !atividade.isEspecial) {
              const imagemUrl = imagensMap.get(atividade.local);
              
              if (imagemUrl) {
                atividade.imagemUrl = imagemUrl;
              } else {
                // ✅ Fallback melhorado para atividades sem imagem
                atividade.imagemUrl = this.gerarImagemFallbackCorrigido(atividade.local, diaIndex, ativIndex);
                atividade.isFallback = true;
              }
              
              imagensAplicadas++;
            }
          });
        }
      });
      
      console.log(`✅ Imagens aplicadas: ${imagensAplicadas}/${totalAtividades} (${sucessos} da API, ${imagensAplicadas - sucessos} fallbacks)`);
      
    } catch (erro) {
      console.error('❌ Erro ao buscar imagens:', erro);
      this.aplicarFallbacksGlobal();
    }
  },

  /**
   * ✅ FALLBACK DE IMAGEM CORRIGIDO
   */
  gerarImagemFallbackCorrigido(local, diaIndex, ativIndex) {
    // ✅ Fallbacks funcionais (sem via.placeholder.com)
    const fallbacks = [
      `https://picsum.photos/400/250?random=${diaIndex}${ativIndex}${Date.now()}`,
      `https://source.unsplash.com/400x250/?travel,${encodeURIComponent(this.dadosDestino.destino)}`,
      this.criarImagemPlaceholderSVG(local)
    ];
    
    return fallbacks[ativIndex % fallbacks.length];
  },

  /**
   * ✅ CHAMA API REAL DE ROTEIRO (mantido)
   */
  async chamarAPIRoteiroReal(parametros) {
    try {
      const response = await fetch('/api/itinerary-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(parametros)
      });
      
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }
      
      const roteiro = await response.json();
      
      if (!roteiro.dias || !Array.isArray(roteiro.dias)) {
        throw new Error('Formato de resposta inválido da API');
      }
      
      console.log('📋 Roteiro recebido da API:', roteiro);
      return roteiro;
      
    } catch (erro) {
      console.error('❌ Erro ao chamar API de roteiro:', erro);
      throw erro;
    }
  },

  /**
   * ✅ CONVERTE ROTEIRO PARA FORMATO CONTÍNUO (mantido)
   */
  converterRoteiroParaContinuo(roteiroAPI) {
    console.log('🔄 Convertendo roteiro para formato contínuo...');
    
    const diasContinuos = [];
    
    if (!roteiroAPI.dias || !Array.isArray(roteiroAPI.dias)) {
      throw new Error('Estrutura de dias inválida');
    }
    
    roteiroAPI.dias.forEach((dia, index) => {
      const diaContino = {
        data: dia.data,
        descricao: dia.descricao || this.obterDescricaoDia(index + 1, this.dadosDestino.destino, roteiroAPI.dias.length),
        atividades: []
      };
      
      if (index === 0) {
        diaContino.observacao = this.obterObservacaoPrimeiroDia();
      } else if (index === roteiroAPI.dias.length - 1) {
        diaContino.observacao = this.obterObservacaoUltimoDia();
      }
      
      ['manha', 'tarde', 'noite'].forEach(periodo => {
        if (dia[periodo]?.atividades?.length) {
          dia[periodo].atividades.forEach(atividade => {
            const atividadeContina = {
              ...atividade,
              periodo: periodo,
              duracao: this.estimarDuracao(atividade.local),
              tags: atividade.tags || this.gerarTagsAtividade(atividade.local, periodo)
            };
            
            if (atividade.local?.includes('Check-in') || 
                atividade.local?.includes('Transfer') ||
                atividade.local?.includes('Chegada') ||
                atividade.local?.includes('Partida')) {
              atividadeContina.isEspecial = true;
            }
            
            diaContino.atividades.push(atividadeContina);
          });
        }
      });
      
      if (diaContino.atividades.length === 0) {
        diaContino.atividades.push({
          horario: '09:00',
          local: 'Dia livre para atividades opcionais',
          dica: 'Aproveite para relaxar ou explorar por conta própria!',
          tags: ['Livre', 'Descanso'],
          isEspecial: true
        });
      }
      
      diasContinuos.push(diaContino);
    });
    
    return {
      destino: roteiroAPI.destino || `${this.dadosDestino.destino}, ${this.dadosDestino.pais}`,
      dias: diasContinuos
    };
  },

  /**
   * ✅ ATUALIZAÇÃO DA UI CORRIGIDA
   */
  atualizarUIComRoteiroContino() {
    console.log('🎨 Atualizando interface com roteiro contínuo...');
    
    const container = document.querySelector('.roteiro-content');
    if (!container) {
      console.error('❌ Container do roteiro não encontrado');
      return;
    }
    
    container.innerHTML = '';
    
    const header = document.querySelector('.app-header h1');
    if (header) {
      header.textContent = `Seu Roteiro para ${this.dadosDestino.destino}`;
    }
    
    container.appendChild(this.criarResumoViagem());
    
    this.roteiroPronto.dias.forEach((dia, index) => {
      container.appendChild(this.criarElementoDiaContinuo(dia, index + 1));
    });
    
    const spacer = document.createElement('div');
    spacer.style.height = '100px';
    container.appendChild(spacer);
    
    // ✅ CORREÇÃO: Configurar lazy loading APÓS inserir elementos
    this.configurarLazyLoadingParaElementos();
    
    console.log('✅ Interface contínua atualizada');
  },

  /**
   * ✅ NOVO: Configura lazy loading para elementos já existentes
   */
  configurarLazyLoadingParaElementos() {
    if (this.imageObserver) {
      const imagens = document.querySelectorAll('img[data-src]');
      imagens.forEach(img => {
        this.imageObserver.observe(img);
      });
      
      console.log(`🖼️ Lazy loading configurado para ${imagens.length} imagens`);
    }
  },

  /**
   * ✅ CRIA ELEMENTO DE DIA CONTÍNUO (melhorado)
   */
  criarElementoDiaContinuo(dia, numeroDia) {
    const elemento = document.createElement('div');
    elemento.className = 'dia-roteiro continuo';
    elemento.setAttribute('data-dia', numeroDia);
    
    const dataFormatada = this.formatarDataCompleta(dia.data);
    const temPrevisao = dia.previsao && numeroDia <= 3;
    
    elemento.innerHTML = `
      <div class="dia-header">
        <div class="dia-numero">${numeroDia}</div>
        <span>Dia ${numeroDia} · ${dataFormatada}</span>
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
          ${this.criarListaAtividadesContinuas(dia.atividades)}
        </div>
      </div>
    `;
    
    return elemento;
  },

  /**
   * ✅ CRIA LISTA DE ATIVIDADES CONTÍNUAS (melhorado)
   */
  criarListaAtividadesContinuas(atividades) {
    if (!atividades?.length) {
      return `
        <div class="dia-livre">
          <p>🏖️ Dia livre para descanso ou atividades opcionais.</p>
        </div>
      `;
    }
    
    return atividades.map((ativ, index) => `
      <div class="atividade-continua ${ativ.isEspecial ? 'atividade-especial' : ''}" data-atividade="${index}">
        ${ativ.horario ? `
          <div class="atividade-horario">
            <span class="horario-icon">🕒</span>
            <span class="horario-texto">${ativ.horario}</span>
            ${ativ.duracao ? `<span class="duracao-texto">(${ativ.duracao})</span>` : ''}
          </div>
        ` : ''}
        
        <div class="atividade-info">
          <div class="atividade-local">
            <span class="local-icon">📍</span>
            <div class="local-detalhes">
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
              <div class="tripinha-avatar-mini">
                <img 
                  src="assets/images/tripinha-avatar.png" 
                  alt="Tripinha" 
                  class="avatar-img"
                  onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
                >
                <div class="avatar-emoji" style="display:none;">🐕</div>
              </div>
              <div class="dica-texto">
                <p><strong>Dica da Tripinha:</strong> ${ativ.dica}</p>
              </div>
            </div>
          ` : ''}
        </div>
        
        ${ativ.imagemUrl && !ativ.isEspecial ? `
          <div class="atividade-imagem-responsiva">
            <img 
              ${this.imageObserver ? 'data-src' : 'src'}="${ativ.imagemUrl}" 
              alt="${ativ.local}"
              class="imagem-lazy"
              loading="lazy"
              style="opacity: 0; transition: opacity 0.3s ease;"
            >
          </div>
        ` : ''}
        
        ${!ativ.isEspecial ? `
          <button 
            class="btn-ver-mapa-mini" 
            data-local="${ativ.local}"
            aria-label="Ver ${ativ.local} no mapa"
            type="button"
          >
            <svg class="icon-mapa" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
            </svg>
            Ver no mapa
          </button>
        ` : ''}
      </div>
    `).join('');
  },

  // ===========================================
  // MÉTODOS AUXILIARES (mantidos com algumas melhorias)
  // ===========================================

  async gerarRoteiroFallback(dataIda, dataVolta, diasViagem) {
    console.log('🛡️ Gerando roteiro fallback...');
    
    const destino = this.dadosDestino.destino;
    const dias = [];
    const dataInicio = new Date(dataIda + 'T12:00:00');
    
    for (let i = 0; i < diasViagem; i++) {
      const dataAtual = new Date(dataInicio);
      dataAtual.setDate(dataInicio.getDate() + i);
      
      const dia = {
        data: this.formatarDataISO(dataAtual),
        descricao: this.obterDescricaoDia(i + 1, destino, diasViagem),
        atividades: this.gerarAtividadesFallback(i, destino, diasViagem)
      };
      
      if (i === 0) {
        dia.observacao = this.obterObservacaoPrimeiroDia();
      } else if (i === diasViagem - 1) {
        dia.observacao = this.obterObservacaoUltimoDia();
      }
      
      dias.push(dia);
    }
    
    this.ajustarAtividadesPorHorariosContinuo(dias);
    
    return {
      destino: `${destino}, ${this.dadosDestino.pais}`,
      dias
    };
  },

  gerarAtividadesFallback(diaIndex, destino, totalDias) {
    const atividadesBase = this.obterAtividadesBasePorDestino(destino);
    const atividades = [];
    
    const numAtividades = 3 + (diaIndex % 3);
    
    for (let i = 0; i < numAtividades; i++) {
      const index = (diaIndex * 4 + i) % atividadesBase.length;
      const atividade = { ...atividadesBase[index] };
      
      atividade.horario = this.calcularHorarioAtividade(i);
      atividade.tags = this.gerarTagsAtividade(atividade.local);
      atividade.duracao = this.estimarDuracao(atividade.local);
      
      atividades.push(atividade);
    }
    
    return atividades;
  },

  calcularHorarioAtividade(indice) {
    const horariosBase = ['09:00', '11:30', '14:00', '16:30', '19:00'];
    return horariosBase[indice % horariosBase.length];
  },

  /**
 * ✅ CORREÇÃO: Integração real com API de previsão do tempo
 * Substitua o método buscarPrevisaoTempo() no arquivo itinerary.js
 */

async buscarPrevisaoTempo() {
  try {
    console.log('🌤️ Buscando previsão do tempo via API...');
    
    if (!this.roteiroPronto?.dias || this.roteiroPronto.dias.length === 0) {
      console.warn('⚠️ Sem dias no roteiro para buscar previsão');
      return;
    }
    
    // ✅ Preparar parâmetros para API
    const cidade = this.dadosDestino.destino;
    const dataInicio = this.getDataIda();
    const dataFim = this.getDataVolta();
    const diasComPrevisao = Math.min(3, this.roteiroPronto.dias.length);
    
    console.log(`📊 Buscando previsão para: ${cidade} (${diasComPrevisao} dias)`);
    
    try {
      // ✅ CHAMADA REAL para API de tempo
      const urlAPI = `/api/weather?city=${encodeURIComponent(cidade)}&start=${dataInicio}&end=${dataFim}`;
      
      const response = await fetch(urlAPI, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        // Timeout de 8 segundos
        signal: AbortSignal.timeout(8000)
      });
      
      if (!response.ok) {
        throw new Error(`API de tempo falhou: ${response.status}`);
      }
      
      const dadosTempo = await response.json();
      console.log('✅ Dados de tempo recebidos:', dadosTempo);
      
      // ✅ Aplicar previsões reais aos primeiros dias
      let aplicados = 0;
      for (let i = 0; i < diasComPrevisao; i++) {
        if (dadosTempo[i]) {
          this.roteiroPronto.dias[i].previsao = {
            icon: dadosTempo[i].icon || '🌤️',
            temperature: dadosTempo[i].temperature || 25,
            condition: dadosTempo[i].condition || 'Tempo agradável',
            date: dadosTempo[i].date
          };
          aplicados++;
        } else {
          // Fallback se não tiver dados para este dia
          this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoFallback(i);
        }
      }
      
      console.log(`✅ Previsão REAL aplicada a ${aplicados}/${diasComPrevisao} dias`);
      
    } catch (erroAPI) {
      console.warn('⚠️ Erro na API de tempo, usando fallback:', erroAPI.message);
      
      // ✅ Fallback: gerar previsões realistas se API falhar
      for (let i = 0; i < diasComPrevisao; i++) {
        this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoFallback(i);
      }
      
      console.log(`🛡️ Previsão FALLBACK aplicada aos primeiros ${diasComPrevisao} dias`);
    }
    
  } catch (erro) {
    console.error('❌ Erro geral na busca de previsão:', erro);
    
    // Garantir que pelo menos temos algo
    const diasComPrevisao = Math.min(3, this.roteiroPronto.dias.length);
    for (let i = 0; i < diasComPrevisao; i++) {
      if (!this.roteiroPronto.dias[i].previsao) {
        this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoFallback(i);
      }
    }
  }
},

/**
 * ✅ NOVO: Gera previsão de fallback mais realista
 */
gerarPrevisaoFallback(diaIndex) {
  // Condições mais realistas baseadas no destino
  const cidade = this.dadosDestino.destino.toLowerCase();
  
  // Ajustar condições por região/clima
  let condicoesPrincipais;
  
  if (cidade.includes('paris') || cidade.includes('londres') || cidade.includes('berlim')) {
    // Clima temperado europeu
    condicoesPrincipais = [
      { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 18 },
      { icon: '☁️', condition: 'Nublado', tempBase: 16 },
      { icon: '🌦️', condition: 'Chuva leve', tempBase: 14 },
      { icon: '☀️', condition: 'Ensolarado', tempBase: 22 }
    ];
  } else if (cidade.includes('miami') || cidade.includes('rio') || cidade.includes('salvador')) {
    // Clima tropical
    condicoesPrincipais = [
      { icon: '☀️', condition: 'Ensolarado', tempBase: 28 },
      { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 26 },
      { icon: '⛈️', condition: 'Pancadas de chuva', tempBase: 24 },
      { icon: '🌊', condition: 'Brisa marítima', tempBase: 25 }
    ];
  } else {
    // Clima geral
    condicoesPrincipais = [
      { icon: '☀️', condition: 'Ensolarado', tempBase: 24 },
      { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 22 },
      { icon: '☁️', condition: 'Nublado', tempBase: 20 },
      { icon: '🌦️', condition: 'Possibilidade de chuva', tempBase: 18 }
    ];
  }
  
  // Padrão mais realista: primeiros dias tendem a ter tempo melhor
  let condicao;
  if (diaIndex === 0) {
    // Primeiro dia: 70% chance de tempo bom
    condicao = Math.random() < 0.7 ? condicoesPrincipais[0] : condicoesPrincipais[1];
  } else {
    // Outros dias: distribuição normal
    condicao = condicoesPrincipais[diaIndex % condicoesPrincipais.length];
  }
  
  // Variação mais sutil de temperatura
  const variacaoTemp = Math.floor(Math.random() * 5) - 2; // -2 a +2 graus
  const temperaturaFinal = Math.max(10, Math.min(40, condicao.tempBase + variacaoTemp));
  
  return {
    icon: condicao.icon,
    temperature: temperaturaFinal,
    condition: condicao.condition,
    date: this.calcularDataDia(diaIndex)
  };
},

/**
 * ✅ NOVO: Calcula data para dia específico do roteiro
 */
calcularDataDia(diaIndex) {
  const dataInicio = new Date(this.getDataIda() + 'T12:00:00');
  const dataAlvo = new Date(dataInicio);
  dataAlvo.setDate(dataInicio.getDate() + diaIndex);
  
  return this.formatarDataISO(dataAlvo);
},

  async buscarImagemComCache(local) {
    if (this.imagensCache.has(local)) {
      return this.imagensCache.get(local);
    }
    
    try {
      const query = `${local} ${this.dadosDestino.destino}`.trim();
      const url = `/api/image-search?query=${encodeURIComponent(query)}&perPage=1`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const dados = await response.json();
      
      if (dados?.images?.[0]) {
        const imagemUrl = dados.images[0].url || dados.images[0].src?.medium;
        const resultado = { sucesso: true, url: imagemUrl };
        this.imagensCache.set(local, resultado);
        return resultado;
      }
      
      throw new Error('Sem imagens na resposta');
      
    } catch (erro) {
      const resultado = { sucesso: false, erro: erro.message };
      this.imagensCache.set(local, resultado);
      return resultado;
    }
  },

  aplicarFallbacksGlobal() {
    console.log('🔄 Aplicando fallbacks globais...');
    
    let index = 0;
    this.roteiroPronto.dias.forEach((dia) => {
      if (dia.atividades?.length) {
        dia.atividades.forEach((atividade) => {
          if (atividade.local && !atividade.isEspecial && !atividade.imagemUrl) {
            atividade.imagemUrl = this.gerarImagemFallbackCorrigido(atividade.local, 0, index++);
            atividade.isFallback = true;
          }
        });
      }
    });
  },

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
    
    const icones = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    };
    
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

  // =====================================
  // MÉTODOS AUXILIARES ADICIONAIS
  // =====================================

  obterPreferenciasCompletas() {
  const respostas = this.dadosUsuario?.respostas || {};
  
  return {
    tipoViagem: this.obterTipoViagem(),
    tipoCompanhia: this.obterTipoCompanhia(),
    quantidade: this.obterQuantidadePessoas(),
    orcamento: this.obterNivelOrcamento(),
    destino_tipo: respostas.tipo_destino || 'ambos',
    item_essencial: respostas.item_essencial || 'cultura',
    // ✅ NOVO: Adicionar dados brutos para debug
    raw_estilo_destino: respostas.estilo_viagem_destino,
    raw_preferencia: respostas.preferencia_viagem,
    conhece_destino: respostas.conhece_destino
  };
},

  obterTipoViagem() {
  const respostas = this.dadosUsuario?.respostas || {};
  
  // ✅ CORREÇÃO: Verificar as chaves corretas do questionário
  let tipoViagem = null;
  
  // Caso 1: Usuário conhece o destino (usa estilo_viagem_destino)
  if (respostas.estilo_viagem_destino !== undefined) {
    tipoViagem = respostas.estilo_viagem_destino;
  }
  // Caso 2: Usuário não conhece destino (usa preferencia_viagem)  
  else if (respostas.preferencia_viagem !== undefined) {
    tipoViagem = respostas.preferencia_viagem;
  }
  // Caso 3: Fallback para campo antigo
  else if (respostas.tipo_viagem !== undefined) {
    tipoViagem = respostas.tipo_viagem;
  }
  
  if (tipoViagem !== null) {
    const tipos = ['relaxar', 'aventura', 'cultura', 'urbano'];
    return tipos[tipoViagem] || 'cultura';
  }
  
  // Fallback antigo baseado em destino_imaginado
  if (respostas.destino_imaginado !== undefined) {
    const mapa = { 0: 'relaxar', 1: 'aventura', 2: 'urbano', 3: 'cultura' };
    return mapa[respostas.destino_imaginado] || 'cultura';
  }
  
  console.warn('⚠️ Tipo de viagem não encontrado, usando padrão: cultura');
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

  obterQuantidadePessoas() {
    const respostas = this.dadosUsuario?.respostas || {};
    return respostas.quantidade_familia || respostas.quantidade_amigos || 1;
  },

  obterNivelOrcamento() {
    const orcamento = this.dadosUsuario?.respostas?.orcamento_valor;
    if (!orcamento) return 'medio';
    
    const valor = parseInt(orcamento);
    if (valor < 1000) return 'economico';
    if (valor < 3000) return 'medio';
    return 'luxo';
  },

  extrairCodigoDestino() {
    const possiveis = [
      this.dadosVoo?.infoIda?.aeroportoChegada,
      this.dadosVoo?.ida?.destino,
      this.dadosVoo?.voo?.segment?.[0]?.flight?.[0]?.arrival,
      this.dadosVoo?.segment?.[0]?.flight?.[0]?.arrival,
      this.dadosVoo?.destination,
      this.dadosVoo?.arrival_airport
    ];
    
    for (const codigo of possiveis) {
      if (codigo && codigo.length === 3) {
        return codigo.toUpperCase();
      }
    }
    
    console.warn('⚠️ Código de destino não encontrado, usando padrão');
    return 'GRU';
  },

  extrairDataIda() {
    const possiveis = [
      this.dadosVoo?.infoIda?.dataPartida,
      this.dadosVoo?.ida?.dataPartida,
      this.dadosVoo?.ida?.data,
      this.dadosVoo?.departure_date,
      this.dadosVoo?.departureDate,
      this.dadosVoo?.segments?.[0]?.date
    ];
    
    for (const data of possiveis) {
      if (data && this.isDataValida(data)) {
        return data;
      }
    }
    
    return null;
  },

  extrairDataVolta() {
    const possiveis = [
      this.dadosVoo?.infoVolta?.dataPartida,
      this.dadosVoo?.volta?.dataPartida,
      this.dadosVoo?.volta?.data,
      this.dadosVoo?.return_date,
      this.dadosVoo?.returnDate,
      this.dadosVoo?.segments?.[1]?.date
    ];
    
    for (const data of possiveis) {
      if (data && this.isDataValida(data)) {
        return data;
      }
    }
    
    return null;
  },

  extrairDatasRespostas() {
    const datas = this.dadosUsuario?.respostas?.datas;
    if (!datas) return null;
    
    if (typeof datas === 'object' && datas.dataIda) {
      return { ida: datas.dataIda, volta: datas.dataVolta };
    }
    
    if (Array.isArray(datas) && datas.length >= 1) {
      return { ida: datas[0], volta: datas[1] || null };
    }
    
    if (typeof datas === 'string' && datas.includes(',')) {
      const [ida, volta] = datas.split(',').map(d => d.trim());
      return { ida, volta };
    }
    
    if (typeof datas === 'string') {
      return { ida: datas, volta: null };
    }
    
    return null;
  },

  isDataValida(data) {
    if (!data) return false;
    
    const formatos = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{2}-\d{2}-\d{4}$/,
      /^\d{4}\/\d{2}\/\d{2}$/
    ];
    
    const dataStr = String(data);
    return formatos.some(formato => formato.test(dataStr));
  },

  garantirFormatoISO(dataInput) {
    if (!dataInput) return null;
    
    const dataStr = String(dataInput);
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
      return dataStr;
    }
    
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dataStr)) {
      const [dia, mes, ano] = dataStr.split(/[\/\-]/);
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(dataStr)) {
      return dataStr.replace(/\//g, '-');
    }
    
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

  formatarDataISO(data) {
    if (!data) return null;
    
    const d = data instanceof Date ? data : new Date(data);
    if (isNaN(d.getTime())) return null;
    
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    
    return `${ano}-${mes}-${dia}`;
  },

  getDataIda() {
    return this.dadosVoo?.infoIda?.dataPartida;
  },

  getDataVolta() {
    return this.dadosVoo?.infoVolta?.dataPartida;
  },

  calcularDiasViagem(dataIda, dataVolta) {
    if (!dataIda) return 1;
    
    try {
      const inicio = new Date(dataIda + 'T12:00:00');
      const fim = dataVolta ? new Date(dataVolta + 'T12:00:00') : inicio;
      
      const diffMs = fim - inicio;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
      
      if (diffDias < 1) return 1;
      if (diffDias > 30) {
        console.warn('⚠️ Viagem muito longa, limitando a 30 dias');
        return 30;
      }
      
      return diffDias;
      
    } catch (e) {
      console.error('❌ Erro ao calcular dias:', e);
      return 1;
    }
  },

  extrairHorarioChegada() {
    const possiveis = [
      this.dadosVoo?.infoIda?.horaChegada,
      this.dadosVoo?.ida?.horaChegada,
      this.dadosVoo?.ida?.horario,
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

  estimarDuracao(local) {
    const duracoes = {
      'museu': '2-3 horas',
      'restaurante': '1-2 horas',
      'passeio': '1-2 horas',
      'mercado': '1 hora',
      'igreja': '30-45 min',
      'mirante': '45 min',
      'show': '2 horas'
    };
    
    const localLower = local.toLowerCase();
    
    if (localLower.includes('museu')) return duracoes.museu;
    if (localLower.includes('restaurante') || localLower.includes('almoço') || localLower.includes('jantar')) return duracoes.restaurante;
    if (localLower.includes('passeio') || localLower.includes('caminhada')) return duracoes.passeio;
    if (localLower.includes('mercado')) return duracoes.mercado;
    if (localLower.includes('igreja') || localLower.includes('catedral')) return duracoes.igreja;
    if (localLower.includes('mirante') || localLower.includes('vista')) return duracoes.mirante;
    if (localLower.includes('show') || localLower.includes('teatro')) return duracoes.show;
    
    return '1-2 horas';
  },

  gerarTagsAtividade(local, periodo) {
    const tags = [];
    
    if (local.includes('Museu')) tags.push('Cultural');
    if (local.includes('Restaurante') || local.includes('Almoço') || local.includes('Jantar')) tags.push('Gastronomia');
    if (local.includes('Parque') || local.includes('Jardim')) tags.push('Natureza');
    if (local.includes('Shopping') || local.includes('Mercado')) tags.push('Compras');
    if (local.includes('Igreja') || local.includes('Catedral')) tags.push('Religioso');
    if (local.includes('Bar') || local.includes('Noturna') || local.includes('Show')) tags.push('Vida Noturna');
    if (local.includes('Mirante') || local.includes('Vista') || local.includes('Torre')) tags.push('Vista Panorâmica');
    if (local.includes('Centro') || local.includes('Histórico')) tags.push('Histórico');
    
    if (tags.length === 0) tags.push('Recomendado');
    
    if (Math.random() < 0.3) tags.unshift('Imperdível');
    
    return tags.slice(0, 3);
  },

  ajustarAtividadesPorHorariosContinuo(dias) {
    if (!dias || dias.length === 0) return;
    
    const horaChegada = this.extrairHorarioChegada();
    const horaPartida = this.extrairHorarioPartida();
    
    const primeiroDia = dias[0];
    const horaChegadaNum = parseInt(horaChegada.split(':')[0]);
    
    if (horaChegadaNum >= 20) {
      primeiroDia.atividades = [{
        horario: '21:00',
        local: 'Check-in e Jantar no Hotel',
        dica: 'Descanse para começar bem amanhã!',
        tags: ['Chegada', 'Descanso'],
        isEspecial: true,
        duracao: '1 hora'
      }];
    } else if (horaChegadaNum >= 16) {
      primeiroDia.atividades = [
        {
          horario: horaChegada,
          local: 'Check-in no Hotel',
          dica: 'Deixe as malas e saia para explorar!',
          tags: ['Chegada'],
          isEspecial: true,
          duracao: '30 min'
        },
        ...primeiroDia.atividades.slice(0, 3).map(ativ => ({
          ...ativ,
          horario: this.ajustarHorarioCheckIn(ativ.horario, horaChegadaNum)
        }))
      ];
    }
    
    if (horaPartida && dias.length > 1) {
      const ultimoDia = dias[dias.length - 1];
      const horaPartidaNum = parseInt(horaPartida.split(':')[0]);
      
      if (horaPartidaNum < 12) {
        ultimoDia.atividades = [{
          horario: '08:00',
          local: 'Check-out e Transfer para Aeroporto',
          dica: 'Chegue ao aeroporto com 2h de antecedência!',
          tags: ['Partida'],
          isEspecial: true,
          duracao: '2 horas'
        }];
      } else if (horaPartidaNum < 18) {
        ultimoDia.atividades = [
          ...ultimoDia.atividades.slice(0, 3),
          {
            horario: `${horaPartidaNum - 3}:00`,
            local: 'Transfer para Aeroporto',
            dica: 'Hora de se despedir! Até a próxima!',
            tags: ['Partida'],
            isEspecial: true,
            duracao: '2 horas'
          }
        ];
      }
    }
  },

  ajustarHorarioCheckIn(horarioOriginal, horaChegada) {
    const [hora] = horarioOriginal.split(':');
    const novaHora = Math.max(parseInt(hora), horaChegada + 2);
    return `${novaHora.toString().padStart(2, '0')}:00`;
  },

  gerarPrevisaoAleatoria(diaIndex) {
    const condicoes = [
      { icon: '☀️', condition: 'Ensolarado', tempBase: 28 },
      { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 25 },
      { icon: '☁️', condition: 'Nublado', tempBase: 22 },
      { icon: '🌦️', condition: 'Chuvas esparsas', tempBase: 20 }
    ];
    
    const condicao = condicoes[diaIndex % condicoes.length];
    const variacaoTemp = Math.floor(Math.random() * 6) - 3;
    
    return {
      icon: condicao.icon,
      temperature: Math.max(15, Math.min(35, condicao.tempBase + variacaoTemp)),
      condition: condicao.condition
    };
  },

  getClasseBadge(tag) {
    const classes = {
      'Imperdível': 'badge-destaque',
      'Voo': 'badge-voo',
      'Chegada': 'badge-voo',
      'Partida': 'badge-voo',
      'Cultural': 'badge-cultura',
      'Gastronomia': 'badge-gastronomia',
      'Natureza': 'badge-natureza',
      'Compras': 'badge-compras',
      'Vida Noturna': 'badge-noturno',
      'Vista Panorâmica': 'badge-vista',
      'Histórico': 'badge-cultura',
      'Religioso': 'badge-cultura'
    };
    
    return classes[tag] || 'badge-padrao';
  },

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

  criarResumoViagem() {
    const resumo = document.createElement('div');
    resumo.className = 'resumo-viagem';
    
    const dataIda = this.formatarData(this.getDataIda());
    const dataVolta = this.getDataVolta() ? this.formatarData(this.getDataVolta()) : null;
    const diasViagem = this.calcularDiasViagem(this.getDataIda(), this.getDataVolta());
    
    resumo.innerHTML = `
      <div class="resumo-viagem-header">
        <span class="icone-header">📋</span>
        <span>Resumo da Viagem</span>
      </div>
      <div class="resumo-viagem-content">
        <div class="resumo-item">
          <div class="icone">🎯</div>
          <div class="texto">
            <div class="label">Destino:</div>
            <p class="valor">${this.dadosDestino.destino}, ${this.dadosDestino.pais}</p>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="icone">📅</div>
          <div class="texto">
            <div class="label">Período:</div>
            <p class="valor">${dataIda}${dataVolta ? ` até ${dataVolta}` : ''}</p>
            <p class="valor-secundario">${diasViagem} ${diasViagem === 1 ? 'dia' : 'dias'} de viagem</p>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="icone">✈️</div>
          <div class="texto">
            <div class="label">Voos:</div>
            <p class="valor">Chegada: ${this.extrairHorarioChegada()}</p>
            ${this.getDataVolta() ? `<p class="valor">Partida: ${this.extrairHorarioPartida()}</p>` : ''}
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="icone">${this.obterIconeCompanhia()}</div>
          <div class="texto">
            <div class="label">Viajando:</div>
            <p class="valor">${this.obterTextoCompanhia()}</p>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="icone">${this.obterIconePreferencia()}</div>
          <div class="texto">
            <div class="label">Estilo:</div>
            <p class="valor">${this.obterTextoPreferencia()}</p>
          </div>
        </div>
      </div>
    `;
    
    return resumo;
  },

  obterDescricaoDia(numeroDia, destino, totalDias) {
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

  obterObservacaoPrimeiroDia() {
    const hora = parseInt(this.extrairHorarioChegada().split(':')[0]);
    
    if (hora < 8) return "Chegada cedo - aproveite o dia completo!";
    if (hora < 12) return "Chegada pela manhã - tempo de sobra para explorar!";
    if (hora < 16) return "Chegada à tarde - relaxe e prepare-se para amanhã!";
    if (hora < 20) return "Chegada no fim da tarde - conheça a vida noturna!";
    return "Chegada à noite - descanse bem para aproveitar amanhã!";
  },

  obterObservacaoUltimoDia() {
    const hora = parseInt(this.extrairHorarioPartida().split(':')[0]);
    
    if (hora < 12) return "Voo pela manhã - aproveite a noite anterior!";
    if (hora < 18) return "Voo à tarde - manhã livre para últimas compras!";
    return "Voo à noite - dia completo para aproveitar!";
  },

  obterTextoPreferencia() {
    const mapa = {
      'relaxar': 'Relaxamento e Descanso',
      'aventura': 'Aventura e Natureza',
      'cultura': 'Cultura e História',
      'urbano': 'Urbano e Moderno'
    };
    return mapa[this.obterTipoViagem()] || 'Experiências Variadas';
  },

  obterIconePreferencia() {
    const mapa = {
      'relaxar': '🏖️',
      'aventura': '🏔️',
      'cultura': '🏛️',
      'urbano': '🏙️'
    };
    return mapa[this.obterTipoViagem()] || '✨';
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

  obterIconeCompanhia() {
    const mapa = {
      'sozinho': '🧳',
      'casal': '❤️',
      'familia': '👨‍👩‍👧‍👦',
      'amigos': '🎉'
    };
    return mapa[this.obterTipoCompanhia()] || '👤';
  },

  obterNomeDestinoPorCodigo(codigo) {
    const mapeamento = {
      'GRU': 'São Paulo', 'CGH': 'São Paulo', 'VCP': 'Campinas',
      'GIG': 'Rio de Janeiro', 'SDU': 'Rio de Janeiro',
      'BSB': 'Brasília', 'CNF': 'Belo Horizonte', 'PLU': 'Belo Horizonte',
      'CWB': 'Curitiba', 'POA': 'Porto Alegre', 'FLN': 'Florianópolis',
      'SSA': 'Salvador', 'REC': 'Recife', 'FOR': 'Fortaleza',
      'MAO': 'Manaus', 'BEL': 'Belém', 'GYN': 'Goiânia',
      'EZE': 'Buenos Aires', 'AEP': 'Buenos Aires',
      'SCL': 'Santiago', 'LIM': 'Lima', 'BOG': 'Bogotá',
      'MDE': 'Medellín', 'CTG': 'Cartagena',
      'CCS': 'Caracas', 'UIO': 'Quito', 'LPB': 'La Paz',
      'MVD': 'Montevidéu', 'ASU': 'Assunção',
      'JFK': 'Nova York', 'EWR': 'Nova York', 'LGA': 'Nova York',
      'LAX': 'Los Angeles', 'SFO': 'São Francisco',
      'ORD': 'Chicago', 'MIA': 'Miami', 'MCO': 'Orlando',
      'LAS': 'Las Vegas', 'SEA': 'Seattle', 'BOS': 'Boston',
      'ATL': 'Atlanta', 'DFW': 'Dallas', 'IAH': 'Houston',
      'YYZ': 'Toronto', 'YVR': 'Vancouver', 'YUL': 'Montreal',
      'MEX': 'Cidade do México', 'CUN': 'Cancún',
      'LHR': 'Londres', 'LGW': 'Londres', 'LCY': 'Londres',
      'CDG': 'Paris', 'ORY': 'Paris',
      'MAD': 'Madri', 'BCN': 'Barcelona',
      'FCO': 'Roma', 'MXP': 'Milão', 'VCE': 'Veneza',
      'FRA': 'Frankfurt', 'MUC': 'Munique', 'BER': 'Berlim',
      'AMS': 'Amsterdã', 'BRU': 'Bruxelas',
      'LIS': 'Lisboa', 'OPO': 'Porto',
      'ATH': 'Atenas', 'IST': 'Istambul',
      'CPH': 'Copenhague', 'ARN': 'Estocolmo',
      'OSL': 'Oslo', 'HEL': 'Helsinque',
      'VIE': 'Viena', 'PRG': 'Praga',
      'BUD': 'Budapeste', 'WAW': 'Varsóvia',
      'NRT': 'Tóquio', 'HND': 'Tóquio',
      'ICN': 'Seul', 'PEK': 'Pequim', 'PVG': 'Xangai',
      'HKG': 'Hong Kong', 'SIN': 'Singapura',
      'BKK': 'Bangkok', 'KUL': 'Kuala Lumpur',
      'DXB': 'Dubai', 'DOH': 'Doha',
      'DEL': 'Nova Délhi', 'BOM': 'Mumbai',
      'SYD': 'Sydney', 'MEL': 'Melbourne',
      'AKL': 'Auckland', 'CHC': 'Christchurch',
      'JNB': 'Joanesburgo', 'CPT': 'Cidade do Cabo',
      'CAI': 'Cairo', 'CMN': 'Casablanca',
      'NBO': 'Nairóbi', 'ADD': 'Adis Abeba'
    };
    
    return mapeamento[codigo] || codigo;
  },

  obterPaisPorCodigo(codigo) {
    const paises = {
      'GRU': 'Brasil', 'CGH': 'Brasil', 'GIG': 'Brasil', 'SDU': 'Brasil',
      'BSB': 'Brasil', 'CNF': 'Brasil', 'CWB': 'Brasil', 'POA': 'Brasil',
      'EZE': 'Argentina', 'AEP': 'Argentina',
      'SCL': 'Chile', 'LIM': 'Peru', 'BOG': 'Colômbia',
      'MDE': 'Colômbia', 'UIO': 'Equador', 'CCS': 'Venezuela',
      'MVD': 'Uruguai', 'ASU': 'Paraguai', 'LPB': 'Bolívia',
      'JFK': 'Estados Unidos', 'LAX': 'Estados Unidos', 'MIA': 'Estados Unidos',
      'YYZ': 'Canadá', 'YVR': 'Canadá',
      'MEX': 'México', 'CUN': 'México',
      'LHR': 'Reino Unido', 'CDG': 'França', 'MAD': 'Espanha',
      'FCO': 'Itália', 'FRA': 'Alemanha', 'AMS': 'Holanda',
      'LIS': 'Portugal', 'BRU': 'Bélgica', 'VIE': 'Áustria',
      'NRT': 'Japão', 'ICN': 'Coreia do Sul', 'PEK': 'China',
      'HKG': 'Hong Kong', 'SIN': 'Singapura', 'BKK': 'Tailândia',
      'DXB': 'Emirados Árabes', 'DEL': 'Índia',
      'SYD': 'Austrália', 'AKL': 'Nova Zelândia',
      'JNB': 'África do Sul', 'CAI': 'Egito', 'CMN': 'Marrocos'
    };
    
    return paises[codigo] || 'Internacional';
  },

  formatarData(dataString) {
    if (!dataString) return 'Data indefinida';
    
    try {
      const data = new Date(dataString + 'T12:00:00');
      if (isNaN(data.getTime())) {
        return dataString;
      }
      
      const options = { 
        day: 'numeric', 
        month: 'long',
        year: 'numeric'
      };
      
      return data.toLocaleDateString('pt-BR', options);
    } catch (e) {
      return dataString;
    }
  },

  formatarDataCompleta(dataString) {
    if (!dataString) return 'Data indefinida';
    
    try {
      const data = new Date(dataString + 'T12:00:00');
      if (isNaN(data.getTime())) {
        return dataString;
      }
      
      const options = {
        weekday: 'long',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
      };
      
      const formatada = data.toLocaleDateString('pt-BR', options);
      return formatada.charAt(0).toUpperCase() + formatada.slice(1);
    } catch (e) {
      return dataString;
    }
  },

  obterAtividadesBasePorDestino(destino) {
    const generico = [
      { local: "Centro Histórico", dica: "Comece cedo para evitar multidões!" },
      { local: "Museu Nacional", dica: "Não perca a exposição principal!" },
      { local: "Mercado Central", dica: "Prove as especialidades locais!" },
      { local: "Catedral Principal", dica: "Arquitetura impressionante!" },
      { local: "Parque Municipal", dica: "Ótimo para caminhadas!" },
      { local: "Bairro Artístico", dica: "Galerias e street art incríveis!" },
      { local: "Mirante da Cidade", dica: "Vista panorâmica espetacular!" },
      { local: "Restaurante Típico", dica: "Peça o prato da casa!" },
      { local: "Shopping Local", dica: "Artesanato e lembranças!" },
      { local: "Tour Gastronômico", dica: "Sabores autênticos da região!" }
    ];
    
    const especificos = {
      'Lisboa': [
        { local: "Torre de Belém", dica: "Chegue antes das 10h para evitar filas!" },
        { local: "Mosteiro dos Jerónimos", dica: "Arquitetura manuelina impressionante!" },
        { local: "Castelo de São Jorge", dica: "Vista incrível da cidade!" },
        { local: "Bairro de Alfama", dica: "Perca-se nas ruelas históricas!" },
        { local: "Elevador de Santa Justa", dica: "Vista 360° de Lisboa!" },
        { local: "LX Factory", dica: "Arte, lojas e cafés descolados!" },
        { local: "Casa de Fado", dica: "Experiência musical única!" },
        { local: "Time Out Market", dica: "O melhor da gastronomia local!" },
        { local: "Bairro Alto", dica: "Vida noturna vibrante!" }
      ],
      'Paris': [
        { local: "Torre Eiffel", dica: "Compre ingressos online!" },
        { local: "Museu do Louvre", dica: "Reserve meio dia inteiro!" },
        { local: "Notre-Dame", dica: "Em restauração, mas vale a visita externa!" },
        { local: "Champs-Élysées", dica: "Caminhada icônica!" },
        { local: "Montmartre", dica: "Atmosfera boêmia única!" }
      ]
    };
    
    return especificos[destino] || generico;
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

  iniciarAnimacaoProgresso() {
    const mensagens = [
      '🤖 Consultando IA para seu roteiro personalizado...',
      '🗺️ Mapeando pontos turísticos especiais...',
      '📸 Buscando imagens dos locais...',
      '🌤️ Checando previsão do tempo...',
      '📝 Finalizando seu roteiro perfeito...'
    ];
    
    let indice = 0;
    
    this.intervalId = setInterval(() => {
      this.progressoAtual = Math.min(this.progressoAtual + 12, 90);
      this.atualizarBarraProgresso(this.progressoAtual, mensagens[indice % mensagens.length]);
      indice++;
      
      if (this.progressoAtual >= 90) {
        clearInterval(this.intervalId);
      }
    }, 1000);
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

  finalizarCarregamento() {
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

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// ===========================================
// INICIALIZAÇÃO
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('roteiro-container') || 
      document.querySelector('.roteiro-content')) {
    
    console.log('📄 Página de roteiro contínuo detectada');
    
    document.body.classList.add('pagina-roteiro');
    BENETRIP_ROTEIRO.init();
  }
});

window.BENETRIP_ROTEIRO = BENETRIP_ROTEIRO;

if (window.BENETRIP_ROTEIRO_LOADED) {
  console.warn('⚠️ Módulo de roteiro já foi carregado');
} else {
  window.BENETRIP_ROTEIRO_LOADED = true;
}
