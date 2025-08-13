/**
 * Benetrip - Sistema de Roteiro com Formulário Manual (VERSÃO 10.1 - CORRIGIDA)
 * ✅ CORREÇÕES APLICADAS:
 * - Integração correta com itinerary-generator.js
 * - Método obterDescricaoDia adicionado
 * - Estrutura de dados da API corrigida
 * - Tratamento de erros melhorado
 * - Todos os métodos auxiliares incluídos
 */

const BENETRIP_ROTEIRO = {
  // ✅ CONFIGURAÇÃO MANTIDA
  CONFIG: {
    LIMITE_DIAS_MINIMO: 1,
    LIMITE_DIAS_MAXIMO: 30,
    LIMITE_PREVISAO_DIAS: 5,
    LIMITE_ATIVIDADES_POR_DIA: {
      'leve': 3,
      'moderado': 5,
      'intenso': 7
    },
    TIMEOUT_API: 30000,
    CACHE_IMAGENS_LIMITE: 100
  },

  // Estado global
  dadosFormulario: null,
  dadosVoo: null,
  dadosUsuario: null,
  dadosDestino: null,
  roteiroPronto: null,
  estaCarregando: false,
  progressoAtual: 10,
  intervalId: null,
  imagensCache: new Map(),
  imageObserver: null,

  /**
   * ✅ INICIALIZAÇÃO
   */
  init() {
    console.log('🚀 Benetrip Roteiro v10.1 - Versão Corrigida com API Integration');
    console.log('⚙️ Configuração:', this.CONFIG);
    
    this.mostrarFormulario();
    this.configurarFormulario();
    this.configurarEventosGerais();
    this.configurarLazyLoadingMelhorado();
  },

  /**
   * ✅ MOSTRAR FORMULÁRIO
   */
  mostrarFormulario() {
    const formulario = document.getElementById('formulario-dados');
    const roteiro = document.getElementById('roteiro-content');
    const acoes = document.getElementById('acoes-roteiro');
    const header = document.querySelector('.app-header h1');
    
    if (formulario) formulario.style.display = 'block';
    if (roteiro) roteiro.style.display = 'none';
    if (acoes) acoes.style.display = 'none';
    if (header) header.textContent = 'Faça seu roteiro ideal';
  },

  /**
   * ✅ CONFIGURAÇÃO DO FORMULÁRIO
   */
  configurarFormulario() {
    const form = document.getElementById('form-viagem');
    const btnGerar = document.getElementById('btn-gerar');
    
    if (!form) {
      console.error('❌ Formulário não encontrado');
      return;
    }

    this.configurarCamposCondicionais();
    this.configurarValidacaoTempoReal();
    this.configurarValidacaoDatasAtualizada();
    
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.processarFormulario();
    });
    
    console.log('✅ Formulário configurado com sucesso');
  },

  /**
   * ✅ CAMPOS CONDICIONAIS
   */
  configurarCamposCondicionais() {
    const radioCompanhia = document.querySelectorAll('input[name="companhia"]');
    const grupoQuantidade = document.getElementById('grupo-quantidade');
    const grupoFamilia = document.getElementById('grupo-familia');
    
    const quantidadeAdultos = document.getElementById('quantidade-adultos');
    const quantidadeCriancas = document.getElementById('quantidade-criancas');
    const quantidadeBebes = document.getElementById('quantidade-bebes');
    const totalFamilia = document.getElementById('total-familia');
    
    const calcularTotalFamilia = () => {
        if (!quantidadeAdultos || !quantidadeCriancas || !quantidadeBebes) return;
        
        const adultos = parseInt(quantidadeAdultos.value) || 0;
        const criancas = parseInt(quantidadeCriancas.value) || 0;
        const bebes = parseInt(quantidadeBebes.value) || 0;
        const total = adultos + criancas + bebes;
        
        if (totalFamilia) {
            totalFamilia.value = `${total} pessoa${total !== 1 ? 's' : ''}`;
        }
        
        if (total > 10) {
            this.exibirToast('Máximo de 10 pessoas por grupo familiar.', 'warning');
            return false;
        }
        
        if (adultos === 0) {
            this.exibirToast('É necessário pelo menos 1 adulto.', 'warning');
            return false;
        }
        
        return true;
    };
    
    if (quantidadeAdultos) quantidadeAdultos.addEventListener('input', calcularTotalFamilia);
    if (quantidadeCriancas) quantidadeCriancas.addEventListener('input', calcularTotalFamilia);
    if (quantidadeBebes) quantidadeBebes.addEventListener('input', calcularTotalFamilia);
    
    radioCompanhia.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const valor = e.target.value;
            
            if (grupoQuantidade) {
                grupoQuantidade.style.display = 'none';
                const quantidadePessoas = document.getElementById('quantidade-pessoas');
                if (quantidadePessoas) quantidadePessoas.required = false;
            }
            if (grupoFamilia) {
                grupoFamilia.style.display = 'none';
                if (quantidadeAdultos) quantidadeAdultos.required = false;
            }
            
            if (valor === 'familia') {
                if (grupoFamilia) grupoFamilia.style.display = 'block';
                if (quantidadeAdultos) quantidadeAdultos.required = true;
                calcularTotalFamilia();
            } else if (valor === 'amigos') {
                if (grupoQuantidade) grupoQuantidade.style.display = 'block';
                const quantidadePessoas = document.getElementById('quantidade-pessoas');
                if (quantidadePessoas) quantidadePessoas.required = true;
            }
        });
    });
    
    const familiaRadio = document.querySelector('input[name="companhia"][value="familia"]');
    if (familiaRadio && familiaRadio.checked) {
        calcularTotalFamilia();
    }
  },

  /**
   * ✅ VALIDAÇÃO EM TEMPO REAL
   */
  configurarValidacaoTempoReal() {
    const destino = document.getElementById('destino');
    const dataIda = document.getElementById('data-ida');
    
    if (destino) {
      destino.addEventListener('input', (e) => {
        const valor = e.target.value.trim();
        const error = document.getElementById('destino-error');
        
        if (valor.length < 2) {
          if (error) error.textContent = 'Digite pelo menos 2 caracteres';
          e.target.setCustomValidity('Destino muito curto');
        } else {
          if (error) error.textContent = '';
          e.target.setCustomValidity('');
        }
      });
    }

    if (dataIda) {
      dataIda.addEventListener('change', (e) => {
        const valor = e.target.value;
        const hoje = new Date();
        const dataEscolhida = new Date(valor);
        const error = document.getElementById('data-ida-error');
        
        if (dataEscolhida < hoje) {
          if (error) error.textContent = 'A data de ida não pode ser no passado';
          e.target.setCustomValidity('Data inválida');
        } else {
          if (error) error.textContent = '';
          e.target.setCustomValidity('');
        }
      });
    }
  },

  /**
   * ✅ VALIDAÇÃO DE DATAS ATUALIZADA
   */
  configurarValidacaoDatasAtualizada() {
    const dataIda = document.getElementById('data-ida');
    const dataVolta = document.getElementById('data-volta');
    
    if (!dataIda || !dataVolta) return;
    
    const hoje = new Date().toISOString().split('T')[0];
    dataIda.setAttribute('min', hoje);
    dataVolta.setAttribute('min', hoje);
    
    const umAno = new Date();
    umAno.setFullYear(umAno.getFullYear() + 1);
    const dataMax = umAno.toISOString().split('T')[0];
    dataIda.setAttribute('max', dataMax);
    dataVolta.setAttribute('max', dataMax);
    
    dataIda.addEventListener('change', (e) => {
      const dataIdaValor = e.target.value;
      if (dataIdaValor) {
        dataVolta.setAttribute('min', dataIdaValor);
        
        if (dataVolta.value && dataVolta.value !== dataIdaValor) {
          const dias = this.calcularDiasEntreDatas(dataIdaValor, dataVolta.value);
          
          if (dias > this.CONFIG.LIMITE_DIAS_MAXIMO) {
            this.exibirToast(`⚠️ Máximo de ${this.CONFIG.LIMITE_DIAS_MAXIMO} dias permitido. Ajustando data de volta.`, 'warning');
            
            const novaDataVolta = new Date(dataIdaValor);
            novaDataVolta.setDate(novaDataVolta.getDate() + this.CONFIG.LIMITE_DIAS_MAXIMO - 1);
            dataVolta.value = novaDataVolta.toISOString().split('T')[0];
          }
        }
      }
    });
    
    dataVolta.addEventListener('change', (e) => {
      const dataIdaValor = dataIda.value;
      const dataVoltaValor = e.target.value;
      
      if (dataIdaValor && dataVoltaValor) {
        if (dataVoltaValor < dataIdaValor) {
          this.exibirToast('Data de volta não pode ser anterior à data de ida', 'warning');
          e.target.value = dataIdaValor;
          return;
        }
        
        const dias = this.calcularDiasEntreDatas(dataIdaValor, dataVoltaValor);
        
        if (dias > this.CONFIG.LIMITE_DIAS_MAXIMO) {
          this.exibirToast(`⚠️ Máximo de ${this.CONFIG.LIMITE_DIAS_MAXIMO} dias permitido. Ajustando data de volta.`, 'warning');
          
          const novaDataVolta = new Date(dataIdaValor);
          novaDataVolta.setDate(novaDataVolta.getDate() + this.CONFIG.LIMITE_DIAS_MAXIMO - 1);
          e.target.value = novaDataVolta.toISOString().split('T')[0];
        }
      }
    });
  },

  /**
   * ✅ CALCULAR DIAS ENTRE DATAS
   */
  calcularDiasEntreDatas(dataInicio, dataFim) {
    if (!dataInicio || !dataFim) return 0;
    
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    
    if (dataInicio === dataFim) return 1;
    
    const diffTime = Math.abs(fim - inicio);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays === 0 ? 1 : diffDays;
  },

  /**
   * ✅ PROCESSAMENTO DO FORMULÁRIO
   */
  async processarFormulario() {
    const btnGerar = document.getElementById('btn-gerar');
    
    try {
      if (!this.validarFormulario()) {
        return;
      }
      
      this.dadosFormulario = this.capturarDadosFormulario();
      console.log('📋 Dados capturados:', this.dadosFormulario);
      
      const diasViagem = this.calcularDiasViagem(this.dadosFormulario.dataIda, this.dadosFormulario.dataVolta);
      
      if (diasViagem > this.CONFIG.LIMITE_DIAS_MAXIMO) {
        this.exibirToast(`⚠️ Máximo de ${this.CONFIG.LIMITE_DIAS_MAXIMO} dias de viagem permitido.`, 'error');
        return;
      }
      
      if (diasViagem >= 20) {
        this.exibirToast('💡 Viagens longas podem ter sugestões menos detalhadas.', 'info');
      }
      
      this.mostrarRoteiro();
      
      setTimeout(() => {
        this.iniciarAnimacaoProgresso();
      }, 100);
      
      if (btnGerar) {
        btnGerar.classList.add('loading');
        btnGerar.disabled = true;
        btnGerar.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Gerando roteiro...</span>';
      }
      
      await this.processarDadosEGerarRoteiro();
      
    } catch (erro) {
      console.error('❌ Erro ao processar formulário:', erro);
      this.mostrarErro('Erro ao processar seus dados. Tente novamente.');
      
      if (btnGerar) {
        btnGerar.classList.remove('loading');
        btnGerar.disabled = false;
        btnGerar.innerHTML = '<span class="btn-icon">✨</span><span class="btn-text">Criar Meu Roteiro!</span>';
      }
    }
  },

  /**
   * ✅ VALIDAÇÃO DO FORMULÁRIO
   */
  validarFormulario() {
    const form = document.getElementById('form-viagem');
    if (!form) return false;
    
    const isValid = form.checkValidity();
    
    if (!isValid) {
      const primeiroErro = form.querySelector(':invalid');
      if (primeiroErro) {
        primeiroErro.focus();
        primeiroErro.reportValidity();
      }
      
      this.exibirToast('Por favor, preencha todos os campos obrigatórios.', 'warning');
      return false;
    }
    
    return true;
  },

  /**
   * ✅ CAPTURAR DADOS DO FORMULÁRIO
   */
  capturarDadosFormulario() {
    const formData = new FormData(document.getElementById('form-viagem'));
    
    const dados = {
        destino: formData.get('destino')?.trim() || '',
        dataIda: formData.get('data-ida') || '',
        horarioChegada: formData.get('horario-chegada') || '15:30',
        dataVolta: formData.get('data-volta') || null,
        horarioPartida: formData.get('horario-partida') || '21:00',
        companhia: formData.get('companhia') || 'sozinho',
        preferencias: formData.get('preferencias') || 'cultura',
        intensidade: formData.get('intensidade') || 'moderado',
        orcamento: formData.get('orcamento') || 'medio'
    };
    
    if (dados.companhia === 'familia') {
        dados.quantidadeAdultos = parseInt(formData.get('quantidade-adultos')) || 2;
        dados.quantidadeCriancas = parseInt(formData.get('quantidade-criancas')) || 0;
        dados.quantidadeBebes = parseInt(formData.get('quantidade-bebes')) || 0;
        dados.quantidadePessoas = dados.quantidadeAdultos + dados.quantidadeCriancas + dados.quantidadeBebes;
    } else if (dados.companhia === 'amigos') {
        dados.quantidadePessoas = parseInt(formData.get('quantidade-pessoas')) || 2;
        dados.quantidadeAdultos = dados.quantidadePessoas;
        dados.quantidadeCriancas = 0;
        dados.quantidadeBebes = 0;
    } else if (dados.companhia === 'casal') {
        dados.quantidadePessoas = 2;
        dados.quantidadeAdultos = 2;
        dados.quantidadeCriancas = 0;
        dados.quantidadeBebes = 0;
    } else {
        dados.quantidadePessoas = 1;
        dados.quantidadeAdultos = 1;
        dados.quantidadeCriancas = 0;
        dados.quantidadeBebes = 0;
    }
    
    if (dados.companhia === 'familia') {
        if (dados.quantidadeAdultos === 0) {
            throw new Error('É necessário pelo menos 1 adulto na família.');
        }
        if (dados.quantidadePessoas > 10) {
            throw new Error('Máximo de 10 pessoas por grupo familiar.');
        }
    }
    
    if (dados.dataVolta === dados.dataIda) {
        console.log('✅ Viagem de 1 dia detectada');
    } else if (dados.dataVolta && dados.dataVolta < dados.dataIda) {
        const novaDataVolta = new Date(dados.dataIda);
        novaDataVolta.setDate(novaDataVolta.getDate() + 3);
        dados.dataVolta = novaDataVolta.toISOString().split('T')[0];
        console.warn('⚠️ Data de volta ajustada automaticamente');
    }
    
    return dados;
  },

  /**
   * ✅ MOSTRAR ROTEIRO
   */
  mostrarRoteiro() {
    const formulario = document.getElementById('formulario-dados');
    const roteiro = document.getElementById('roteiro-content');
    const acoes = document.getElementById('acoes-roteiro');
    const header = document.querySelector('.app-header h1');
    
    if (formulario) formulario.style.display = 'none';
    if (roteiro) roteiro.style.display = 'block';
    if (acoes) acoes.style.display = 'flex';
    if (header) header.textContent = `Seu Roteiro para ${this.dadosFormulario?.destino || 'Destino'}`;
  },

  /**
   * ✅ PROCESSAMENTO DE DADOS
   */
  async processarDadosEGerarRoteiro() {
    try {
      this.converterDadosFormulario();
      await this.gerarRoteiroIA();
    } catch (erro) {
      console.error('❌ Erro ao gerar roteiro:', erro);
      throw erro;
    }
  },

  /**
   * ✅ CONVERSÃO DE DADOS
   */
  converterDadosFormulario() {
    const dados = this.dadosFormulario;
    
    let dataVolta = dados.dataVolta;
    if (dataVolta === dados.dataIda) {
        console.log('✅ Viagem de 1 dia detectada, mantendo estrutura apropriada');
    }
    
    this.dadosVoo = {
        infoIda: {
            dataPartida: dados.dataIda,
            horaChegada: dados.horarioChegada,
            aeroportoChegada: 'INT'
        },
        infoVolta: (dataVolta && dataVolta !== dados.dataIda) ? {
            dataPartida: dataVolta,
            horaPartida: dados.horarioPartida
        } : null
    };
    
    this.dadosUsuario = {
        respostas: {
            companhia: this.mapearCompanhia(dados.companhia),
            quantidade_familia: dados.companhia === 'familia' ? dados.quantidadePessoas : null,
            quantidade_amigos: dados.companhia === 'amigos' ? dados.quantidadePessoas : null,
            quantidade_adultos: dados.quantidadeAdultos,
            quantidade_criancas: dados.quantidadeCriancas,
            quantidade_bebes: dados.quantidadeBebes,
            tipo_viagem: this.mapearPreferencias(dados.preferencias),
            intensidade_roteiro: dados.intensidade,
            orcamento_nivel: dados.orcamento
        }
    };
    
    this.dadosDestino = {
        destino: dados.destino,
        codigo_iata: 'INT',
        pais: this.extrairPais(dados.destino)
    };
    
    const diasCalculados = this.calcularDiasViagem(dados.dataIda, dataVolta);
    console.log(`✅ Dados convertidos para viagem de ${diasCalculados} dia(s):`, {
        voo: this.dadosVoo,
        usuario: this.dadosUsuario,
        destino: this.dadosDestino
    });
  },

  /**
   * ✅ MAPEAR COMPANHIA
   */
  mapearCompanhia(companhia) {
    const mapa = {
      'sozinho': 0,
      'casal': 1,
      'familia': 2,
      'amigos': 3
    };
    return mapa[companhia] || 0;
  },

  /**
   * ✅ MAPEAR PREFERÊNCIAS
   */
  mapearPreferencias(preferencia) {
    const mapa = {
      'relaxar': 0,
      'aventura': 1,
      'cultura': 2,
      'urbano': 3
    };
    return mapa[preferencia] || 2;
  },

  /**
   * ✅ EXTRAIR PAÍS
   */
  extrairPais(destino) {
    const destinoLower = destino.toLowerCase();
    
    if (destinoLower.includes('paris') || destinoLower.includes('frança')) return 'França';
    if (destinoLower.includes('lisboa') || destinoLower.includes('portugal')) return 'Portugal';
    if (destinoLower.includes('madrid') || destinoLower.includes('espanha')) return 'Espanha';
    if (destinoLower.includes('roma') || destinoLower.includes('itália')) return 'Itália';
    if (destinoLower.includes('londres') || destinoLower.includes('inglaterra')) return 'Reino Unido';
    if (destinoLower.includes('berlim') || destinoLower.includes('alemanha')) return 'Alemanha';
    if (destinoLower.includes('amsterdam') || destinoLower.includes('holanda')) return 'Holanda';
    if (destinoLower.includes('tóquio') || destinoLower.includes('japão')) return 'Japão';
    if (destinoLower.includes('nova york') || destinoLower.includes('eua')) return 'Estados Unidos';
    
    if (destino.includes(',')) {
      const partes = destino.split(',');
      if (partes.length >= 2) {
        return partes[1].trim();
      }
    }
    
    return 'Internacional';
  },

  /**
   * ✅ CONFIGURAÇÃO DE EVENTOS GERAIS
   */
  configurarEventosGerais() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-compartilhar-roteiro')) {
        e.preventDefault();
        this.compartilharRoteiro();
        return;
      }
      
      if (e.target.closest('#btn-editar-roteiro')) {
        e.preventDefault();
        this.editarRoteiro();
        return;
      }
      
      if (e.target.closest('.btn-voltar')) {
        e.preventDefault();
        window.location.href = 'https://www.benetrip.com.br';
        return;
      }
      
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
  },

  /**
   * ✅ VOLTAR PARA FORMULÁRIO
   */
  voltarParaFormulario() {
    if (this.roteiroPronto) {
      const confirmar = confirm('Tem certeza que deseja voltar? Você perderá o roteiro atual.');
      if (!confirmar) return;
    }
    
    this.dadosFormulario = null;
    this.dadosVoo = null;
    this.dadosUsuario = null;
    this.dadosDestino = null;
    this.roteiroPronto = null;
    this.estaCarregando = false;
    
    this.imagensCache.clear();
    this.mostrarFormulario();
    
    const btnGerar = document.getElementById('btn-gerar');
    if (btnGerar) {
      btnGerar.classList.remove('loading');
      btnGerar.disabled = false;
      btnGerar.innerHTML = '<span class="btn-icon">✨</span><span class="btn-text">Criar Meu Roteiro!</span>';
    }
  },

  /**
   * ✅ CARREGAMENTO DE DADOS
   */
  async carregarDados() {
    try {
      console.log('📂 Usando dados do formulário...');
      
      if (!this.dadosFormulario) {
        throw new Error('Dados do formulário não encontrados');
      }
      
      console.log('✅ Dados carregados do formulário');
      await this.normalizarEValidarDatas();
      return true;
      
    } catch (erro) {
      console.error('❌ Erro ao carregar dados:', erro);
      throw erro;
    }
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
   * ✅ CARREGAMENTO DE IMAGEM COM FALLBACK
   */
  carregarImagemComFallback(img) {
    const originalSrc = img.dataset.src;
    const local = img.alt || 'Local';
    
    const fallbacks = [
      originalSrc,
      `https://picsum.photos/400/250?random=${Math.floor(Math.random() * 1000)}`,
      `https://source.unsplash.com/400x250/?travel,${encodeURIComponent(this.dadosDestino?.destino || 'travel')}`,
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
   * ✅ PLACEHOLDER SVG
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
   * ✅ NORMALIZAÇÃO DE DATAS
   */
  async normalizarEValidarDatas() {
    console.log('📅 Normalizando datas...');
    
    try {
      let dataIda = this.dadosFormulario.dataIda;
      let dataVolta = this.dadosFormulario.dataVolta;
      
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
      
      if (dataVoltaObj && dataVoltaObj < dataIdaObj) {
        console.warn('⚠️ Data de volta anterior à ida, ajustando...');
        dataVoltaObj.setDate(dataIdaObj.getDate() + 3);
        dataVolta = this.formatarDataISO(dataVoltaObj);
      } else if (dataVolta === dataIda) {
        console.log('✅ Viagem de 1 dia confirmada');
      }
      
      this.dadosVoo.infoIda.dataPartida = dataIda;
      if (dataVolta && dataVolta !== dataIda && this.dadosVoo.infoVolta) {
        this.dadosVoo.infoVolta.dataPartida = dataVolta;
      }
      
      const diasCalculados = this.calcularDiasViagem(dataIda, dataVolta);
      console.log('✅ Datas normalizadas:', {
        ida: dataIda,
        volta: dataVolta,
        diasViagem: diasCalculados,
        tipoViagem: diasCalculados === 1 ? 'Bate e volta' : `${diasCalculados} dias`
      });
      
    } catch (erro) {
      console.error('❌ Erro ao normalizar datas:', erro);
      throw erro;
    }
  },

  /**
   * ✅ GERAÇÃO DE ROTEIRO COM IA (CORRIGIDA)
   */
  async gerarRoteiroIA() {
    try {
      console.log('🤖 Iniciando geração do roteiro com IA...');
      
      await this.carregarDados();
      
      const dataIda = this.getDataIda();
      const dataVolta = this.getDataVolta();
      const diasViagem = this.calcularDiasViagem(dataIda, dataVolta);
      
      if (diasViagem > this.CONFIG.LIMITE_DIAS_MAXIMO) {
        throw new Error(`Viagem de ${diasViagem} dias excede o limite de ${this.CONFIG.LIMITE_DIAS_MAXIMO} dias`);
      }
      
      console.log('📊 Parâmetros para IA:', {
        destino: this.dadosDestino,
        dataIda,
        dataVolta,
        diasViagem,
        intensidade: this.dadosFormulario.intensidade,
        preferencias: this.obterPreferenciasCompletas(),
        limites: this.CONFIG
      });
      
      await this.delay(1500);
      
      // ✅ CORRIGIDO: Estrutura de parâmetros compatível com itinerary-generator.js
      const parametrosIA = {
        destino: this.dadosDestino.destino,
        pais: this.dadosDestino.pais,
        dataInicio: dataIda,
        dataFim: (dataVolta !== dataIda) ? dataVolta : null,
        horaChegada: this.extrairHorarioChegada(),
        horaSaida: this.extrairHorarioPartida(),
        tipoViagem: this.obterTipoViagem(),
        tipoCompanhia: this.obterTipoCompanhia(),
        preferencias: this.obterPreferenciasCompletas(),
        testMode: false
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
      
      await Promise.all([
        this.buscarPrevisaoTempo(),
        this.buscarTodasImagensCorrigido()
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
   * ✅ CHAMAR API ROTEIRO REAL (CORRIGIDA)
   */
  async chamarAPIRoteiroReal(parametros) {
    try {
      const response = await fetch('/api/itinerary-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(parametros),
        signal: AbortSignal.timeout(this.CONFIG.TIMEOUT_API)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na API: ${response.status} - ${errorText}`);
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
   * ✅ CONVERTER ROTEIRO PARA CONTÍNUO
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
      
      if (roteiroAPI.dias.length === 1) {
        diaContino.observacao = 'Viagem de 1 dia - aproveite cada momento!';
      } else if (index === 0) {
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
   * ✅ GERAR ROTEIRO FALLBACK (CORRIGIDO - Método obterDescricaoDia adicionado)
   */
  async gerarRoteiroFallback(dataIda, dataVolta, diasViagem) {
    console.log(`🛡️ Gerando roteiro fallback para ${diasViagem} dia(s)...`);
    
    const destino = this.dadosDestino.destino;
    const dias = [];
    const dataInicio = new Date(dataIda + 'T12:00:00');
    
    const intensidade = this.dadosFormulario.intensidade;
    const atividadesPorDia = this.CONFIG.LIMITE_ATIVIDADES_POR_DIA[intensidade] || 4;
    
    const numAtividades = diasViagem === 1 ? 
      Math.min(atividadesPorDia, 4) : 
      atividadesPorDia;
    
    for (let i = 0; i < diasViagem; i++) {
      const dataAtual = new Date(dataInicio);
      dataAtual.setDate(dataInicio.getDate() + i);
      
      const dia = {
        data: this.formatarDataISO(dataAtual),
        descricao: this.obterDescricaoDia(i + 1, destino, diasViagem),
        atividades: this.gerarAtividadesFallback(i, destino, diasViagem, numAtividades)
      };
      
      if (diasViagem === 1) {
        dia.observacao = 'Viagem de 1 dia - aproveite intensamente cada momento!';
      } else if (i === 0) {
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

  /**
   * ✅ NOVO: MÉTODO OBTER DESCRIÇÃO DIA (CORRIGIDO)
   */
  obterDescricaoDia(numeroDia, destino, totalDias) {
    if (totalDias === 1) {
      return `Um dia intenso e inesquecível em ${destino}!`;
    }
    
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

  /**
   * ✅ GERAR ATIVIDADES FALLBACK
   */
  gerarAtividadesFallback(diaIndex, destino, totalDias, numAtividades) {
    const atividadesBase = this.obterAtividadesBasePorDestino(destino);
    const atividades = [];
    
    if (totalDias === 1) {
      const principaisAtracoes = atividadesBase.slice(0, Math.min(numAtividades, 4));
      
      principaisAtracoes.forEach((atividade, i) => {
        const atividadeCopia = { ...atividade };
        atividadeCopia.horario = this.calcularHorarioAtividade(i);
        atividadeCopia.tags = ['Imperdível', ...this.gerarTagsAtividade(atividadeCopia.local)];
        atividadeCopia.duracao = this.estimarDuracao(atividadeCopia.local);
        
        atividades.push(atividadeCopia);
      });
    } else {
      for (let i = 0; i < numAtividades; i++) {
        const index = (diaIndex * 4 + i) % atividadesBase.length;
        const atividade = { ...atividadesBase[index] };
        
        atividade.horario = this.calcularHorarioAtividade(i);
        atividade.tags = this.gerarTagsAtividade(atividade.local);
        atividade.duracao = this.estimarDuracao(atividade.local);
        
        atividades.push(atividade);
      }
    }
    
    return atividades;
  },

  /**
   * ✅ CALCULAR HORÁRIO ATIVIDADE
   */
  calcularHorarioAtividade(indice) {
    const horariosBase = ['09:00', '11:30', '14:00', '16:30', '19:00', '21:00'];
    return horariosBase[indice % horariosBase.length];
  },

  /**
   * ✅ OBTER ATIVIDADES BASE POR DESTINO
   */
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

  // =====================================
  // MÉTODOS AUXILIARES COMPLETOS
  // =====================================

  /**
   * ✅ OBTER PREFERÊNCIAS COMPLETAS
   */
  obterPreferenciasCompletas() {
    return {
      tipoViagem: this.obterTipoViagem(),
      tipoCompanhia: this.obterTipoCompanhia(),
      quantidade: this.obterQuantidadePessoas(),
      intensidade: this.dadosFormulario?.intensidade || 'moderado',
      orcamento: this.dadosFormulario?.orcamento || 'medio',
      destino_preferido: this.dadosFormulario?.preferencias || 'cultura'
    };
  },

  /**
   * ✅ OBTER TIPO DE VIAGEM
   */
  obterTipoViagem() {
    return this.dadosFormulario?.preferencias || 'cultura';
  },

  /**
   * ✅ OBTER TIPO DE COMPANHIA
   */
  obterTipoCompanhia() {
    return this.dadosFormulario?.companhia || 'sozinho';
  },

  /**
   * ✅ OBTER QUANTIDADE DE PESSOAS
   */
  obterQuantidadePessoas() {
    const companhia = this.obterTipoCompanhia();
    if (companhia === 'familia' || companhia === 'amigos') {
      return this.dadosFormulario?.quantidadePessoas || 2;
    }
    return companhia === 'casal' ? 2 : 1;
  },

  /**
   * ✅ EXTRAIR HORÁRIO DE CHEGADA
   */
  extrairHorarioChegada() {
    return this.dadosFormulario?.horarioChegada || '15:30';
  },

  /**
   * ✅ EXTRAIR HORÁRIO DE PARTIDA
   */
  extrairHorarioPartida() {
    return this.dadosFormulario?.horarioPartida || '21:00';
  },

  /**
   * ✅ GET DATA IDA
   */
  getDataIda() {
    return this.dadosVoo?.infoIda?.dataPartida || this.dadosFormulario?.dataIda;
  },

  /**
   * ✅ GET DATA VOLTA
   */
  getDataVolta() {
    const dataVolta = this.dadosVoo?.infoVolta?.dataPartida || this.dadosFormulario?.dataVolta;
    const dataIda = this.getDataIda();
    
    if (dataVolta === dataIda) {
      return null;
    }
    
    return dataVolta;
  },

  /**
   * ✅ GARANTIR FORMATO ISO
   */
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

  /**
   * ✅ FORMATAR DATA ISO
   */
  formatarDataISO(data) {
    if (!data) return null;
    
    const d = data instanceof Date ? data : new Date(data);
    if (isNaN(d.getTime())) return null;
    
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    
    return `${ano}-${mes}-${dia}`;
  },

  /**
   * ✅ CALCULAR DIAS VIAGEM
   */
  calcularDiasViagem(dataIda, dataVolta) {
    if (!dataIda) return 1;
    
    try {
      const inicio = new Date(dataIda + 'T12:00:00');
      
      if (!dataVolta || dataVolta === dataIda) return 1;
      
      const fim = new Date(dataVolta + 'T12:00:00');
      const diffMs = fim - inicio;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDias <= 0) return 1;
      
      if (diffDias > this.CONFIG.LIMITE_DIAS_MAXIMO) {
        console.warn(`⚠️ Viagem muito longa, limitando a ${this.CONFIG.LIMITE_DIAS_MAXIMO} dias`);
        this.exibirToast(`⚠️ Roteiros limitados a ${this.CONFIG.LIMITE_DIAS_MAXIMO} dias para melhor qualidade!`, 'warning');
        return this.CONFIG.LIMITE_DIAS_MAXIMO;
      }
      
      return diffDias;
      
    } catch (e) {
      console.error('❌ Erro ao calcular dias:', e);
      return 1;
    }
  },

  /**
   * ✅ ESTIMAR DURAÇÃO
   */
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

  /**
   * ✅ GERAR TAGS ATIVIDADE
   */
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

  /**
   * ✅ AJUSTAR ATIVIDADES POR HORÁRIOS
   */
  ajustarAtividadesPorHorariosContinuo(dias) {
    if (!dias || dias.length === 0) return;
    
    const horaChegada = this.extrairHorarioChegada();
    const horaPartida = this.extrairHorarioPartida();
    
    const primeiroDia = dias[0];
    const horaChegadaNum = parseInt(horaChegada.split(':')[0]);
    
    if (dias.length === 1) {
      const horaPartidaNum = parseInt(horaPartida.split(':')[0]);
      const tempoDisponivel = horaPartidaNum - horaChegadaNum;
      
      if (tempoDisponivel < 4) {
        primeiroDia.atividades = [
          {
            horario: this.calcularHorarioOtimizado(horaChegadaNum, 0),
            local: 'Principal atração da cidade',
            dica: 'Foque no que há de mais importante para ver!',
            tags: ['Imperdível', 'Rápido'],
            isEspecial: false,
            duracao: '2 horas'
          },
          {
            horario: this.calcularHorarioOtimizado(horaChegadaNum, 1),
            local: 'Experiência gastronômica local',
            dica: 'Prove o prato típico da região!',
            tags: ['Gastronomia', 'Cultural'],
            isEspecial: false,
            duracao: '1 hora'
          }
        ];
      } else {
        primeiroDia.atividades.forEach((ativ, index) => {
          if (!ativ.isEspecial) {
            ativ.horario = this.calcularHorarioOtimizado(horaChegadaNum, index);
          }
        });
      }
      
      primeiroDia.atividades.unshift({
        horario: horaChegada,
        local: 'Chegada ao destino',
        dica: 'Comece sua aventura!',
        tags: ['Chegada'],
        isEspecial: true,
        duracao: '30 min'
      });
      
      primeiroDia.atividades.push({
        horario: `${horaPartidaNum - 1}:00`,
        local: 'Preparação para partida',
        dica: 'Hora de se despedir! Até a próxima!',
        tags: ['Partida'],
        isEspecial: true,
        duracao: '1 hora'
      });
      
      return;
    }
    
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

  /**
   * ✅ CALCULAR HORÁRIO OTIMIZADO
   */
  calcularHorarioOtimizado(horaChegada, indiceAtividade) {
    const horaBase = horaChegada + 1 + (indiceAtividade * 2);
    const hora = Math.min(horaBase, 20);
    return `${hora.toString().padStart(2, '0')}:00`;
  },

  /**
   * ✅ AJUSTAR HORÁRIO CHECK-IN
   */
  ajustarHorarioCheckIn(horarioOriginal, horaChegada) {
    const [hora] = horarioOriginal.split(':');
    const novaHora = Math.max(parseInt(hora), horaChegada + 2);
    return `${novaHora.toString().padStart(2, '0')}:00`;
  },

  /**
   * ✅ OBTER OBSERVAÇÃO PRIMEIRO DIA
   */
  obterObservacaoPrimeiroDia() {
    const hora = parseInt(this.extrairHorarioChegada().split(':')[0]);
    
    if (hora < 8) return "Chegada cedo - aproveite o dia completo!";
    if (hora < 12) return "Chegada pela manhã - tempo de sobra para explorar!";
    if (hora < 16) return "Chegada à tarde - relaxe e prepare-se para amanhã!";
    if (hora < 20) return "Chegada no fim da tarde - conheça a vida noturna!";
    return "Chegada à noite - descanse bem para aproveitar amanhã!";
  },

  /**
   * ✅ OBTER OBSERVAÇÃO ÚLTIMO DIA
   */
  obterObservacaoUltimoDia() {
    const hora = parseInt(this.extrairHorarioPartida().split(':')[0]);
    
    if (hora < 12) return "Voo pela manhã - aproveite a noite anterior!";
    if (hora < 18) return "Voo à tarde - manhã livre para últimas compras!";
    return "Voo à noite - dia completo para aproveitar!";
  },

  // =====================================
  // MÉTODOS DE UI E COMPARTILHAMENTO
  // =====================================

  /**
   * ✅ ATUALIZAR UI COM ROTEIRO
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
      header.textContent = `Seu Roteiro para ${this.dadosDestino?.destino || 'Destino'}`;
    }
    
    container.appendChild(this.criarResumoViagem());
    
    this.roteiroPronto.dias.forEach((dia, index) => {
      container.appendChild(this.criarElementoDiaContinuo(dia, index + 1));
    });
    
    const spacer = document.createElement('div');
    spacer.style.height = '100px';
    container.appendChild(spacer);
    
    this.configurarLazyLoadingParaElementos();
    
    console.log('✅ Interface contínua atualizada');
  },

  /**
   * ✅ CONFIGURAR LAZY LOADING PARA ELEMENTOS
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
   * ✅ CRIAR ELEMENTO DIA CONTÍNUO
   */
  criarElementoDiaContinuo(dia, numeroDia) {
    const elemento = document.createElement('div');
    elemento.className = 'dia-roteiro continuo';
    elemento.setAttribute('data-dia', numeroDia);
    
    const dataFormatada = this.formatarDataCompleta(dia.data);
    
    const temPrevisao = dia.previsao && numeroDia <= this.CONFIG.LIMITE_PREVISAO_DIAS;
    
    elemento.innerHTML = `
      <div class="dia-header">
        <div class="dia-numero">${numeroDia}</div>
        <span>Dia ${numeroDia} — ${dataFormatada}</span>
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
   * ✅ CRIAR LISTA ATIVIDADES CONTÍNUAS
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
                <div class="avatar-emoji">🐕</div>
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

  /**
   * ✅ GET CLASSE BADGE
   */
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

  /**
   * ✅ CRIAR PREVISÃO TEMPO
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
   * ✅ CRIAR RESUMO VIAGEM
   */
  criarResumoViagem() {
    const resumo = document.createElement('div');
    resumo.className = 'resumo-viagem';
    
    const dataIda = this.formatarData(this.getDataIda());
    const dataVolta = this.getDataVolta() ? this.formatarData(this.getDataVolta()) : null;
    const diasViagem = this.calcularDiasViagem(this.getDataIda(), this.getDataVolta());
    
    const textoData = diasViagem === 1 ? 
      `${dataIda} (bate e volta)` : 
      `${dataIda}${dataVolta ? ` até ${dataVolta}` : ''}`;
    
    const textoDuracao = diasViagem === 1 ? 
      'Viagem de 1 dia' : 
      `${diasViagem} dias de viagem`;
    
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
            <p class="valor">${this.dadosDestino?.destino || 'Destino'}, ${this.dadosDestino?.pais || 'País'}</p>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="icone">📅</div>
          <div class="texto">
            <div class="label">Período:</div>
            <p class="valor">${textoData}</p>
            <p class="valor-secundario">${textoDuracao}</p>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="icone">✈️</div>
          <div class="texto">
            <div class="label">Horários:</div>
            <p class="valor">Chegada: ${this.extrairHorarioChegada()}</p>
            ${this.getDataVolta() ? `<p class="valor">Partida: ${this.extrairHorarioPartida()}</p>` : '<p class="valor-secundario">Partida: ' + this.extrairHorarioPartida() + '</p>'}
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
        
        <div class="resumo-item">
          <div class="icone">⚡</div>
          <div class="texto">
            <div class="label">Intensidade:</div>
            <p class="valor">${this.obterTextoIntensidade()}</p>
          </div>
        </div>
      </div>
    `;
    
    return resumo;
  },

  // =====================================
  // MÉTODOS AUXILIARES DE FORMATAÇÃO
  // =====================================

  /**
   * ✅ OBTER TEXTO INTENSIDADE
   */
  obterTextoIntensidade() {
    const mapa = {
      'leve': 'Leve (2-3 atividades/dia)',
      'moderado': 'Moderado (4-5 atividades/dia)',
      'intenso': 'Intenso (6+ atividades/dia)'
    };
    return mapa[this.dadosFormulario?.intensidade] || 'Moderado';
  },

  /**
   * ✅ OBTER TEXTO PREFERÊNCIA
   */
  obterTextoPreferencia() {
    const mapa = {
      'relaxar': 'Relaxamento e Descanso',
      'aventura': 'Aventura e Natureza',
      'cultura': 'Cultura e História',
      'urbano': 'Urbano e Moderno'
    };
    return mapa[this.obterTipoViagem()] || 'Experiências Variadas';
  },

  /**
   * ✅ OBTER ÍCONE PREFERÊNCIA
   */
  obterIconePreferencia() {
    const mapa = {
      'relaxar': '🏖️',
      'aventura': '🏔️',
      'cultura': '🏛️',
      'urbano': '🏙️'
    };
    return mapa[this.obterTipoViagem()] || '✨';
  },

  /**
   * ✅ OBTER TEXTO COMPANHIA
   */
  obterTextoCompanhia() {
    const dados = this.dadosFormulario;
    const tipo = dados?.companhia;
    
    if (tipo === 'familia') {
        const adultos = dados.quantidadeAdultos || 0;
        const criancas = dados.quantidadeCriancas || 0;
        const bebes = dados.quantidadeBebes || 0;
        const total = dados.quantidadePessoas || 0;
        
        let detalhes = [`${total} pessoas`];
        if (adultos > 0) detalhes.push(`${adultos} adulto${adultos > 1 ? 's' : ''}`);
        if (criancas > 0) detalhes.push(`${criancas} criança${criancas > 1 ? 's' : ''}`);
        if (bebes > 0) detalhes.push(`${bebes} bebê${bebes > 1 ? 's' : ''}`);
        
        return `Família (${detalhes.join(', ')})`;
    }
    
    const textos = {
        'sozinho': 'Viagem Solo',
        'casal': 'Casal',
        'amigos': `Grupo de Amigos (${dados?.quantidadePessoas || 2} pessoas)`
    };
    
    return textos[tipo] || 'Viagem Individual';
  },

  /**
   * ✅ OBTER ÍCONE COMPANHIA
   */
  obterIconeCompanhia() {
    const mapa = {
      'sozinho': '🧳',
      'casal': '❤️',
      'familia': '👨‍👩‍👧‍👦',
      'amigos': '🎉'
    };
    return mapa[this.obterTipoCompanhia()] || '👤';
  },

  /**
   * ✅ FORMATAR DATA
   */
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

  /**
   * ✅ FORMATAR DATA COMPLETA
   */
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

  // =====================================
  // MÉTODOS DE BUSCA DE DADOS EXTERNOS
  // =====================================

  /**
   * ✅ BUSCAR TODAS IMAGENS
   */
  async buscarTodasImagensCorrigido() {
    try {
      console.log('🖼️ Iniciando busca COMPLETA de imagens...');
      
      if (!this.roteiroPronto?.dias || this.roteiroPronto.dias.length === 0) {
        console.warn('⚠️ Sem roteiro para buscar imagens');
        return;
      }
      
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
      
      console.log(`📊 Estatísticas: ${totalAtividades} atividades, ${todasAtividades.length} locais para buscar`);
      
      const imagensMap = new Map();
      let sucessos = 0;
      
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
        
        if (i + tamanhoLote < todasAtividades.length) {
          await this.delay(200);
        }
      }
      
      let imagensAplicadas = 0;
      this.roteiroPronto.dias.forEach((dia, diaIndex) => {
        if (dia.atividades?.length) {
          dia.atividades.forEach((atividade, ativIndex) => {
            if (atividade.local && !atividade.isEspecial) {
              const imagemUrl = imagensMap.get(atividade.local);
              
              if (imagemUrl) {
                atividade.imagemUrl = imagemUrl;
              } else {
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
   * ✅ BUSCAR IMAGEM COM CACHE
   */
  async buscarImagemComCache(local) {
    if (this.imagensCache.has(local)) {
      return this.imagensCache.get(local);
    }
    
    try {
      const query = `${local} ${this.dadosDestino?.destino || ''}`.trim();
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

  /**
   * ✅ GERAR IMAGEM FALLBACK
   */
  gerarImagemFallbackCorrigido(local, diaIndex, ativIndex) {
    const fallbacks = [
      `https://picsum.photos/400/250?random=${diaIndex}${ativIndex}${Date.now()}`,
      `https://source.unsplash.com/400x250/?travel,${encodeURIComponent(this.dadosDestino?.destino || 'travel')}`,
      this.criarImagemPlaceholderSVG(local)
    ];
    
    return fallbacks[ativIndex % fallbacks.length];
  },

  /**
   * ✅ APLICAR FALLBACKS GLOBAL
   */
  aplicarFallbacksGlobal() {
    console.log('🔄 Aplicando fallbacks globais...');
    
    let index = 0;
    this.roteiroPronto?.dias?.forEach((dia) => {
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

  /**
   * ✅ BUSCAR PREVISÃO DO TEMPO
   */
  async buscarPrevisaoTempo() {
    try {
      console.log('🌤️ Buscando previsão do tempo via API...');
      
      if (!this.roteiroPronto?.dias || this.roteiroPronto.dias.length === 0) {
        console.warn('⚠️ Sem dias no roteiro para buscar previsão');
        return;
      }
      
      const cidade = this.dadosDestino?.destino || '';
      const dataInicio = this.getDataIda();
      const dataFim = this.getDataVolta();
      
      const diasComPrevisao = Math.min(this.roteiroPronto.dias.length, this.CONFIG.LIMITE_PREVISAO_DIAS);
      
      console.log(`📊 Buscando previsão para: ${cidade} (${diasComPrevisao} dias)`);
      
      try {
        const urlAPI = `/api/weather?city=${encodeURIComponent(cidade)}&start=${dataInicio}&end=${dataFim || dataInicio}`;
        
        const response = await fetch(urlAPI, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(8000)
        });
        
        if (!response.ok) {
          throw new Error(`API de tempo falhou: ${response.status}`);
        }
        
        const dadosTempo = await response.json();
        console.log('✅ Dados de tempo recebidos:', dadosTempo);
        
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
            this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoFallback(i);
          }
        }
        
        console.log(`✅ Previsão REAL aplicada a ${aplicados}/${diasComPrevisao} dias`);
        
      } catch (erroAPI) {
        console.warn('⚠️ Erro na API de tempo, usando fallback:', erroAPI.message);
        
        for (let i = 0; i < diasComPrevisao; i++) {
          this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoFallback(i);
        }
        
        console.log(`🛡️ Previsão FALLBACK aplicada aos primeiros ${diasComPrevisao} dias`);
      }
      
    } catch (erro) {
      console.error('❌ Erro geral na busca de previsão:', erro);
      
      const diasComPrevisao = Math.min(this.roteiroPronto.dias.length, this.CONFIG.LIMITE_PREVISAO_DIAS);
      for (let i = 0; i < diasComPrevisao; i++) {
        if (!this.roteiroPronto.dias[i].previsao) {
          this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoFallback(i);
        }
      }
    }
  },

  /**
   * ✅ GERAR PREVISÃO FALLBACK
   */
  gerarPrevisaoFallback(diaIndex) {
    const cidade = this.dadosDestino?.destino?.toLowerCase() || '';
    
    let condicoesPrincipais;
    
    if (cidade.includes('paris') || cidade.includes('londres') || cidade.includes('berlim')) {
      condicoesPrincipais = [
        { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 18 },
        { icon: '☁️', condition: 'Nublado', tempBase: 16 },
        { icon: '🌦️', condition: 'Chuva leve', tempBase: 14 },
        { icon: '☀️', condition: 'Ensolarado', tempBase: 22 }
      ];
    } else if (cidade.includes('miami') || cidade.includes('rio') || cidade.includes('salvador')) {
      condicoesPrincipais = [
        { icon: '☀️', condition: 'Ensolarado', tempBase: 28 },
        { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 26 },
        { icon: '⛈️', condition: 'Pancadas de chuva', tempBase: 24 },
        { icon: '🌊', condition: 'Brisa marítima', tempBase: 25 }
      ];
    } else {
      condicoesPrincipais = [
        { icon: '☀️', condition: 'Ensolarado', tempBase: 24 },
        { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 22 },
        { icon: '☁️', condition: 'Nublado', tempBase: 20 },
        { icon: '🌦️', condition: 'Possibilidade de chuva', tempBase: 18 }
      ];
    }
    
    let condicao;
    if (diaIndex === 0) {
      condicao = Math.random() < 0.7 ? condicoesPrincipais[0] : condicoesPrincipais[1];
    } else {
      condicao = condicoesPrincipais[diaIndex % condicoesPrincipais.length];
    }
    
    const variacaoTemp = Math.floor(Math.random() * 5) - 2;
    const temperaturaFinal = Math.max(10, Math.min(40, condicao.tempBase + variacaoTemp));
    
    return {
      icon: condicao.icon,
      temperature: temperaturaFinal,
      condition: condicao.condition,
      date: this.calcularDataDia(diaIndex)
    };
  },

  /**
   * ✅ CALCULAR DATA DIA
   */
  calcularDataDia(diaIndex) {
    const dataInicio = new Date(this.getDataIda() + 'T12:00:00');
    const dataAlvo = new Date(dataInicio);
    dataAlvo.setDate(dataInicio.getDate() + diaIndex);
    
    return this.formatarDataISO(dataAlvo);
  },

  // =====================================
  // MÉTODOS DE COMPARTILHAMENTO
  // =====================================

  /**
   * ✅ COMPARTILHAR ROTEIRO
   */
  async compartilharRoteiro() {
    try {
      this.mostrarModalCompartilhamento();
    } catch (erro) {
      console.error('❌ Erro no compartilhamento:', erro);
      this.exibirToast('Erro ao compartilhar. Tente novamente.', 'error');
    }
  },

  /**
   * ✅ MODAL COMPARTILHAMENTO
   */
  mostrarModalCompartilhamento() {
    const modalExistente = document.getElementById('modal-compartilhar');
    if (modalExistente) modalExistente.remove();
    
    const modal = document.createElement('div');
    modal.id = 'modal-compartilhar';
    modal.className = 'modal-overlay';
    
    modal.innerHTML = `
      <div class="modal-content modal-compartilhar">
        <div class="modal-header">
          <h3>📤 Copiar Roteiro</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        
        <div class="modal-body">
          <div class="compartilhar-info">
            <div class="info-icon">📋</div>
            <div class="info-texto">
              <h4>Vamos copiar seu roteiro!</h4>
              <p>Escolha o formato e depois cole onde quiser: WhatsApp, email, notas...</p>
            </div>
          </div>
          
          <div class="opcoes-tamanho">
            <button class="opcao-tamanho opcao-destaque" data-tipo="resumido">
              <div class="opcao-icon">📱</div>
              <div class="opcao-info">
                <div class="opcao-titulo">Versão Resumida</div>
                <div class="opcao-desc">Perfeita para WhatsApp • Principais pontos</div>
                <div class="opcao-preview">✅ Roteiro + mapas + 2.000 caracteres</div>
              </div>
            </button>
            
            <button class="opcao-tamanho" data-tipo="completo">
              <div class="opcao-icon">📄</div>
              <div class="opcao-info">
                <div class="opcao-titulo">Versão Completa</div>
                <div class="opcao-desc">Todos os detalhes • Para documentos</div>
                <div class="opcao-preview">📋 Tudo incluso: dicas + previsão + mapas</div>
              </div>
            </button>
          </div>
          
          <div class="dica-compartilhamento">
            <div class="dica-icon">💡</div>
            <div class="dica-texto">
              <strong>Dica:</strong> Após copiar, cole no app que você preferir. A versão completa funciona melhor em documentos e emails!
            </div>
          </div>
          
          <div class="modal-acoes">
            <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    modal.querySelectorAll('.opcao-tamanho').forEach(opcao => {
      opcao.addEventListener('click', async (e) => {
        const tipo = opcao.dataset.tipo;
        modal.remove();
        
        try {
          if (tipo === 'resumido') {
            await this.copiarRoteiroResumido();
          } else {
            await this.copiarRoteiroCompleto();
          }
        } catch (erro) {
          console.error('❌ Erro na cópia:', erro);
          this.exibirToast('Erro ao copiar roteiro', 'error');
        }
      });
    });
    
    requestAnimationFrame(() => {
      modal.classList.add('modal-visible');
    });
  },

  /**
   * ✅ COPIAR ROTEIRO RESUMIDO
   */
  async copiarRoteiroResumido() {
    try {
      this.exibirToast('📱 Preparando versão resumida...', 'info');
      
      const textoResumido = this.gerarTextoRoteiroResumido();
      
      try {
        await navigator.clipboard.writeText(textoResumido);
        this.mostrarToastSucesso('resumido', textoResumido.length);
      } catch (e) {
        this.copiarTextoLegacy(textoResumido);
        this.mostrarToastSucesso('resumido', textoResumido.length);
      }
      
    } catch (erro) {
      console.error('❌ Erro ao copiar versão resumida:', erro);
      this.exibirToast('❌ Erro ao preparar versão resumida.', 'error');
    }
  },

  /**
   * ✅ GERAR TEXTO RESUMIDO
   */
  gerarTextoRoteiroResumido() {
    const destino = this.dadosDestino?.destino || 'Destino';
    const pais = this.dadosDestino?.pais || 'País';
    const dataIda = this.formatarData(this.getDataIda());
    const dataVolta = this.getDataVolta() ? this.formatarData(this.getDataVolta()) : null;
    const diasViagem = this.calcularDiasViagem(this.getDataIda(), this.getDataVolta());
    
    let texto = `🐕 ROTEIRO BENETRIP - ${destino.toUpperCase()} ✈️\n\n`;
    
    texto += `📍 ${destino}, ${pais}\n`;
    
    if (diasViagem === 1) {
      texto += `📅 ${dataIda} (bate e volta)\n`;
    } else {
      texto += `📅 ${dataIda}${dataVolta ? ` até ${dataVolta}` : ''} (${diasViagem} dias)\n`;
    }
    
    texto += `👥 ${this.obterTextoCompanhiaResumido()}\n`;
    texto += `🎯 ${this.obterTextoPreferencia()}\n\n`;
    
    this.roteiroPronto?.dias?.forEach((dia, index) => {
      const numeroDia = index + 1;
      const dataFormatada = this.formatarDataSimples(dia.data);
      
      if (diasViagem === 1) {
        texto += `📅 ${dataFormatada} - BATE E VOLTA\n`;
      } else {
        texto += `📅 DIA ${numeroDia} - ${dataFormatada}\n`;
      }
      
      if (dia.descricao) {
        texto += `"${dia.descricao}"\n`;
      }
      
      if (dia.atividades && dia.atividades.length > 0) {
        const atividadesPrincipais = dia.atividades
          .filter(ativ => !ativ.isEspecial)
          .slice(0, 3);
        
        atividadesPrincipais.forEach((atividade) => {
          texto += `${atividade.horario || ''} 📍 ${atividade.local}\n`;
          
          const linkMapa = this.gerarLinkGoogleMaps(atividade.local);
          texto += `🗺️ ${linkMapa}\n`;
        });
      }
      
      texto += `\n`;
    });
    
    texto += `🐾 Roteiro criado com amor pela Tripinha!\n`;
    texto += `📱 Crie o seu em: www.benetrip.com.br\n`;
    
    return texto;
  },

  /**
   * ✅ COPIAR ROTEIRO COMPLETO
   */
  async copiarRoteiroCompleto() {
    try {
      this.exibirToast('📄 Preparando versão completa...', 'info');
      
      const textoCompleto = this.gerarTextoRoteiroCompleto();
      
      try {
        await navigator.clipboard.writeText(textoCompleto);
        this.mostrarToastSucesso('completo', textoCompleto.length);
      } catch (e) {
        this.copiarTextoLegacy(textoCompleto);
        this.mostrarToastSucesso('completo', textoCompleto.length);
      }
      
    } catch (erro) {
      console.error('❌ Erro ao copiar versão completa:', erro);
      this.exibirToast('❌ Erro ao preparar versão completa.', 'error');
    }
  },

  /**
   * ✅ GERAR TEXTO COMPLETO
   */
  gerarTextoRoteiroCompleto() {
    const destino = this.dadosDestino?.destino || 'Destino';
    const pais = this.dadosDestino?.pais || 'País';
    const dataIda = this.formatarData(this.getDataIda());
    const dataVolta = this.getDataVolta() ? this.formatarData(this.getDataVolta()) : null;
    const diasViagem = this.calcularDiasViagem(this.getDataIda(), this.getDataVolta());
    
    let texto = `🐕 ROTEIRO BENETRIP - ${destino.toUpperCase()} ✈️\n`;
    texto += `═══════════════════════════════\n\n`;
    
    texto += `📍 DESTINO: ${destino}, ${pais}\n`;
    
    if (diasViagem === 1) {
      texto += `📅 DATA: ${dataIda} (bate e volta)\n`;
      texto += `⏱️ TIPO: Viagem de 1 dia\n`;
    } else {
      texto += `📅 PERÍODO: ${dataIda}${dataVolta ? ` até ${dataVolta}` : ''}\n`;
      texto += `⏱️ DURAÇÃO: ${diasViagem} ${diasViagem === 1 ? 'dia' : 'dias'}\n`;
    }
    
    texto += `👥 VIAJANTES: ${this.obterTextoCompanhia()}\n`;
    texto += `🎯 ESTILO: ${this.obterTextoPreferencia()}\n`;
    texto += `⚡ INTENSIDADE: ${this.obterTextoIntensidade()}\n\n`;
    
    texto += `✈️ INFORMAÇÕES DE VIAGEM:\n`;
    texto += `🛬 Chegada: ${this.extrairHorarioChegada()}\n`;
    
    if (diasViagem === 1) {
      texto += `🛫 Partida: ${this.extrairHorarioPartida()}\n`;
      texto += `⏰ Tempo total: ${this.calcularTempoTotalDia()}\n`;
    } else if (this.getDataVolta()) {
      texto += `🛫 Partida: ${this.extrairHorarioPartida()}\n`;
    }
    texto += `\n`;
    
    if (diasViagem === 1) {
      texto += `📋 ROTEIRO DO DIA:\n`;
    } else {
      texto += `📋 ROTEIRO DETALHADO:\n`;
    }
    texto += `═══════════════════════════════\n\n`;
    
    this.roteiroPronto?.dias?.forEach((dia, index) => {
      const numeroDia = index + 1;
      const dataFormatada = this.formatarDataCompleta(dia.data);
      
      if (diasViagem === 1) {
        texto += `📅 ${dataFormatada} - BATE E VOLTA\n`;
      } else {
        texto += `📅 DIA ${numeroDia} - ${dataFormatada}\n`;
      }
      texto += `${'-'.repeat(40)}\n`;
      
      if (dia.descricao) {
        texto += `💭 "${dia.descricao}"\n\n`;
      }
      
      if (dia.observacao) {
        texto += `💡 ${dia.observacao}\n\n`;
      }
      
      if (dia.previsao && index < this.CONFIG.LIMITE_PREVISAO_DIAS) {
        texto += `🌤️ PREVISÃO: ${dia.previsao.temperature}°C, ${dia.previsao.condition}\n\n`;
      }
      
      if (dia.atividades && dia.atividades.length > 0) {
        texto += `📍 PROGRAMAÇÃO:\n\n`;
        
        dia.atividades.forEach((atividade, ativIndex) => {
          if (atividade.horario) {
            texto += `🕒 ${atividade.horario}`;
            if (atividade.duracao) {
              texto += ` (${atividade.duracao})`;
            }
            texto += `\n`;
          }
          
          texto += `📍 ${atividade.local}\n`;
          
          if (atividade.tags && atividade.tags.length > 0) {
            texto += `🏷️ ${atividade.tags.join(' • ')}\n`;
          }
          
          if (atividade.dica) {
            texto += `🐕 Dica da Tripinha: ${atividade.dica}\n`;
          }
          
          if (!atividade.isEspecial && atividade.local) {
            const linkMapa = this.gerarLinkGoogleMaps(atividade.local);
            texto += `🗺️ Ver no mapa: ${linkMapa}\n`;
          }
          
          texto += `\n`;
        });
      } else {
        texto += `🏖️ Dia livre para descanso ou atividades opcionais.\n\n`;
      }
      
      texto += `${'-'.repeat(40)}\n\n`;
    });
    
    texto += `🐾 Roteiro criado com amor pela Tripinha!\n`;
    texto += `📱 Crie o seu em: www.benetrip.com.br\n`;
    
    const hashtag = diasViagem === 1 ? 'BateEVolta' : 'Viagem';
    texto += `\n#Benetrip #${hashtag} #Roteiro #${destino.replace(/\s+/g, '')}`;
    
    return texto;
  },

  /**
   * ✅ CALCULAR TEMPO TOTAL DO DIA
   */
  calcularTempoTotalDia() {
    const chegada = this.extrairHorarioChegada();
    const partida = this.extrairHorarioPartida();
    
    const [horaChegada, minutoChegada] = chegada.split(':').map(Number);
    const [horaPartida, minutoPartida] = partida.split(':').map(Number);
    
    const totalMinutos = (horaPartida * 60 + minutoPartida) - (horaChegada * 60 + minutoChegada);
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    
    return `${horas}h${minutos > 0 ? minutos.toString().padStart(2, '0') : ''}`;
  },

  /**
   * ✅ GERAR LINK GOOGLE MAPS
   */
  gerarLinkGoogleMaps(local) {
    const localLimpo = this.limparTextoParaURL(local);
    const destinoLimpo = this.limparTextoParaURL(this.dadosDestino?.destino || '');
    
    const query = `${localLimpo} ${destinoLimpo}`;
    return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
  },

  /**
   * ✅ LIMPAR TEXTO PARA URL
   */
  limparTextoParaURL(texto) {
    if (!texto) return '';
    
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[ñ]/g, 'n')
      .replace(/[^a-zA-Z0-9\s\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * ✅ TEXTO COMPANHIA RESUMIDO
   */
  obterTextoCompanhiaResumido() {
    const dados = this.dadosFormulario;
    const tipo = dados?.companhia;
    
    if (tipo === 'familia') {
      return `Família (${dados.quantidadePessoas || 0} pessoas)`;
    }
    
    const textos = {
      'sozinho': 'Solo',
      'casal': 'Casal',
      'amigos': `Amigos (${dados?.quantidadePessoas || 2})`
    };
    
    return textos[tipo] || 'Individual';
  },

  /**
   * ✅ FORMATAR DATA SIMPLES
   */
  formatarDataSimples(dataString) {
    if (!dataString) return 'Data indefinida';
    
    try {
      const data = new Date(dataString + 'T12:00:00');
      if (isNaN(data.getTime())) {
        return dataString;
      }
      
      const options = { 
        day: '2-digit', 
        month: '2-digit'
      };
      
      return data.toLocaleDateString('pt-BR', options);
    } catch (e) {
      return dataString;
    }
  },

  /**
   * ✅ TOAST DE SUCESSO
   */
  mostrarToastSucesso(tipo, tamanho) {
    const isMobile = /mobile|android|iphone/i.test(navigator.userAgent);
    
    let mensagem, dica;
    
    if (tipo === 'resumido') {
      mensagem = `📱 Versão resumida copiada! (${tamanho} caracteres)`;
      dica = isMobile ? 
        '💡 Perfeita para WhatsApp! Pode colar diretamente.' :
        '💡 Ideal para WhatsApp e redes sociais!';
    } else {
      mensagem = `📄 Versão completa copiada! (${tamanho} caracteres)`;
      dica = isMobile ?
        '💡 Melhor para documentos ou email. No WhatsApp, prefira a versão resumida.' :
        '💡 Ideal para salvar em documentos ou enviar por email!';
    }
    
    this.exibirToast(mensagem, 'success');
    
    setTimeout(() => {
      this.exibirToast(dica, 'info');
    }, 1500);
  },

  /**
   * ✅ COPIAR TEXTO LEGACY
   */
  copiarTextoLegacy(texto) {
    const textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  },

  // =====================================
  // MÉTODOS DE INTERAÇÃO
  // =====================================

  /**
   * ✅ ABRIR MAPA
   */
  abrirMapa(local) {
    const destino = `${this.dadosDestino?.destino || ''}, ${this.dadosDestino?.pais || ''}`;
    const query = `${local}, ${destino}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  /**
   * ✅ EDITAR ROTEIRO
   */
  editarRoteiro() {
    if (confirm('Deseja voltar ao formulário para editar suas preferências?')) {
      this.voltarParaFormulario();
    }
  },

  // =====================================
  // MÉTODOS DE CONTROLE DE ESTADO
  // =====================================

  /**
   * ✅ MOSTRAR ERRO
   */
  mostrarErro(mensagem) {
    console.error('❌ Erro exibido ao usuário:', mensagem);
    
    clearInterval(this.intervalId);
    this.estaCarregando = false;
    
    const container = document.querySelector('.roteiro-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="erro-container">
        <div class="erro-icon">
          <div style="font-size: 72px;">😢</div>
        </div>
        
        <h2 class="erro-titulo">Ops! Algo deu errado...</h2>
        <p class="erro-mensagem">${mensagem}</p>
        
        <div class="erro-acoes">
          <button class="btn btn-principal" onclick="BENETRIP_ROTEIRO.voltarParaFormulario()">
            🔄 Tentar Novamente
          </button>
          <button class="btn btn-secundario" onclick="history.back()">
            ⬅️ Voltar
          </button>
        </div>
        
        <p class="erro-dica">
          <strong>Dica:</strong> Verifique se todos os campos foram preenchidos corretamente.
        </p>
      </div>
    `;
    
    const loading = document.querySelector('.loading-container');
    if (loading) loading.style.display = 'none';
  },

  /**
   * ✅ INICIAR ANIMAÇÃO PROGRESSO
   */
  iniciarAnimacaoProgresso() {
    const mensagens = [
      '🐾 Revirando minhas memórias dos lugares que já farejei...',
      '📸 Procurando as fotos mais fofas que tirei nessa aventura...',
      '🗺️ Lembrando dos cantinhos secretos que descobri...',
      '🌤️ Checando se o tempo vai estar bom pro passeio...',
      '💭 Organizando minhas dicas especiais pra você...',
      '📝 Preparando seu roteiro com todo carinho! 🐕'
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

  /**
   * ✅ ATUALIZAR BARRA PROGRESSO
   */
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

  /**
   * ✅ FINALIZAR CARREGAMENTO
   */
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

  /**
   * ✅ EXIBIR TOAST
   */
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

  /**
   * ✅ DELAY
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// ===========================================
// INICIALIZAÇÃO
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('roteiro-container') || 
      document.querySelector('.formulario-container')) {
    
    console.log('📄 Página de planejamento de viagem detectada');
    
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
