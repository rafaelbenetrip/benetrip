/**
 * Benetrip - Sistema de Roteiro com Formulário Manual (VERSÃO 9.0)
 * Novidades:
 * - ✅ Formulário manual para entrada de dados
 * - ✅ Validação completa de campos
 * - ✅ Manutenção de toda lógica existente de roteiro
 * - ✅ Interface responsiva e otimizada
 */

const BENETRIP_ROTEIRO = {
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
   * ✅ INICIALIZAÇÃO MODIFICADA - Mostra formulário primeiro
   */
  init() {
    console.log('🚀 Benetrip Roteiro v9.0 - Versão com Formulário Manual');
    
    this.mostrarFormulario();
    this.configurarFormulario();
    this.configurarEventosGerais();
    this.configurarLazyLoadingMelhorado();
  },

  /**
   * ✅ NOVO: Mostra o formulário de entrada
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
   * ✅ NOVO: Configura eventos do formulário
   */
  configurarFormulario() {
    const form = document.getElementById('form-viagem');
    const btnGerar = document.getElementById('btn-gerar');
    
    if (!form) {
      console.error('❌ Formulário não encontrado');
      return;
    }

    // Configurar campos condicionais
    this.configurarCamposCondicionais();
    
    // Validação em tempo real
    this.configurarValidacaoTempoReal();
    
    // Submissão do formulário
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.processarFormulario();
    });

    // Validação de datas
    this.configurarValidacaoDatas();
    
    console.log('✅ Formulário configurado com sucesso');
  },

  /**
 * ✅ CONFIGURAR CAMPOS CONDICIONAIS - VERSÃO EXPANDIDA
 */
configurarCamposCondicionais() {
    const radioCompanhia = document.querySelectorAll('input[name="companhia"]');
    const grupoQuantidade = document.getElementById('grupo-quantidade');
    const grupoFamilia = document.getElementById('grupo-familia');
    
    // Campos de família
    const quantidadeAdultos = document.getElementById('quantidade-adultos');
    const quantidadeCriancas = document.getElementById('quantidade-criancas');
    const quantidadeBebes = document.getElementById('quantidade-bebes');
    const totalFamilia = document.getElementById('total-familia');
    
    // Função para calcular total da família
    const calcularTotalFamilia = () => {
        if (!quantidadeAdultos || !quantidadeCriancas || !quantidadeBebes) return;
        
        const adultos = parseInt(quantidadeAdultos.value) || 0;
        const criancas = parseInt(quantidadeCriancas.value) || 0;
        const bebes = parseInt(quantidadeBebes.value) || 0;
        const total = adultos + criancas + bebes;
        
        if (totalFamilia) {
            totalFamilia.value = `${total} pessoa${total !== 1 ? 's' : ''}`;
        }
        
        // Validação
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
    
    // Event listeners para campos de família
    if (quantidadeAdultos) {
        quantidadeAdultos.addEventListener('input', calcularTotalFamilia);
    }
    if (quantidadeCriancas) {
        quantidadeCriancas.addEventListener('input', calcularTotalFamilia);
    }
    if (quantidadeBebes) {
        quantidadeBebes.addEventListener('input', calcularTotalFamilia);
    }
    
    // Event listeners para radio buttons
    radioCompanhia.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const valor = e.target.value;
            
            // Ocultar todos os campos condicionais primeiro
            if (grupoQuantidade) {
                grupoQuantidade.style.display = 'none';
                document.getElementById('quantidade-pessoas').required = false;
            }
            if (grupoFamilia) {
                grupoFamilia.style.display = 'none';
                quantidadeAdultos.required = false;
            }
            
            // Mostrar campos apropriados
            if (valor === 'familia') {
                grupoFamilia.style.display = 'block';
                quantidadeAdultos.required = true;
                calcularTotalFamilia(); // Calcular total inicial
            } else if (valor === 'amigos') {
                grupoQuantidade.style.display = 'block';
                document.getElementById('quantidade-pessoas').required = true;
            }
        });
    });
    
    // Calcular total inicial se família já estiver selecionada
    const familiaRadio = document.querySelector('input[name="companhia"][value="familia"]');
    if (familiaRadio && familiaRadio.checked) {
        calcularTotalFamilia();
    }
},

  /**
   * ✅ NOVO: Configura validação em tempo real
   */
  configurarValidacaoTempoReal() {
    const destino = document.getElementById('destino');
    const dataIda = document.getElementById('data-ida');
    
    // Validação do destino
    destino.addEventListener('input', (e) => {
      const valor = e.target.value.trim();
      const error = document.getElementById('destino-error');
      
      if (valor.length < 2) {
        error.textContent = 'Digite pelo menos 2 caracteres';
        e.target.setCustomValidity('Destino muito curto');
      } else {
        error.textContent = '';
        e.target.setCustomValidity('');
      }
    });

    // Validação da data de ida
    dataIda.addEventListener('change', (e) => {
      const valor = e.target.value;
      const hoje = new Date();
      const dataEscolhida = new Date(valor);
      const error = document.getElementById('data-ida-error');
      
      if (dataEscolhida < hoje) {
        error.textContent = 'A data de ida não pode ser no passado';
        e.target.setCustomValidity('Data inválida');
      } else {
        error.textContent = '';
        e.target.setCustomValidity('');
      }
    });
  },

  /**
   * ✅ NOVO: Configura validação de datas
   */
  configurarValidacaoDatas() {
    const dataIda = document.getElementById('data-ida');
    const dataVolta = document.getElementById('data-volta');
    
    // Define data mínima como hoje
    const hoje = new Date().toISOString().split('T')[0];
    dataIda.setAttribute('min', hoje);
    dataVolta.setAttribute('min', hoje);
    
    // Atualizar data mínima da volta quando ida mudar
    dataIda.addEventListener('change', (e) => {
      const dataIdaValor = e.target.value;
      if (dataIdaValor) {
        dataVolta.setAttribute('min', dataIdaValor);
        
        // Validar se volta não é anterior à ida
        if (dataVolta.value && dataVolta.value <= dataIdaValor) {
          const novaDataVolta = new Date(dataIdaValor);
          novaDataVolta.setDate(novaDataVolta.getDate() + 1);
          dataVolta.value = novaDataVolta.toISOString().split('T')[0];
        }
      }
    });
  },

  /**
   * ✅ NOVO: Processa dados do formulário
   */
  async processarFormulario() {
    const btnGerar = document.getElementById('btn-gerar');
    
    try {
      // Validar formulário
      if (!this.validarFormulario()) {
        return;
      }
      
      // Capturar dados
      this.dadosFormulario = this.capturarDadosFormulario();
      console.log('📋 Dados capturados:', this.dadosFormulario);
      
      // Mostrar loading e ocultar formulário
      this.mostrarRoteiro();
      
      // ✅ CORREÇÃO: Iniciar animação do progresso APÓS mostrar o loading
      setTimeout(() => {
        this.iniciarAnimacaoProgresso();
      }, 100);
      
      // Atualizar botão
      btnGerar.classList.add('loading');
      btnGerar.disabled = true;
      btnGerar.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Gerando roteiro...</span>';
      
      // Processar dados e gerar roteiro
      await this.processarDadosEGerarRoteiro();
      
    } catch (erro) {
      console.error('❌ Erro ao processar formulário:', erro);
      this.mostrarErro('Erro ao processar seus dados. Tente novamente.');
      
      // Restaurar botão
      btnGerar.classList.remove('loading');
      btnGerar.disabled = false;
      btnGerar.innerHTML = '<span class="btn-icon">✨</span><span class="btn-text">Criar Meu Roteiro!</span>';
    }
  },

  /**
   * ✅ NOVO: Valida o formulário
   */
  validarFormulario() {
    const form = document.getElementById('form-viagem');
    const isValid = form.checkValidity();
    
    if (!isValid) {
      // Mostrar primeira mensagem de erro
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
 * ✅ CAPTURAR DADOS DO FORMULÁRIO - VERSÃO EXPANDIDA
 */
capturarDadosFormulario() {
    const formData = new FormData(document.getElementById('form-viagem'));
    
    const dados = {
        destino: formData.get('destino').trim(),
        dataIda: formData.get('data-ida'),
        horarioChegada: formData.get('horario-chegada'),
        dataVolta: formData.get('data-volta') || null,
        horarioPartida: formData.get('horario-partida'),
        companhia: formData.get('companhia'),
        preferencias: formData.get('preferencias'),
        intensidade: formData.get('intensidade'),
        orcamento: formData.get('orcamento')
    };
    
    // ✅ NOVO: Processar dados específicos por tipo de companhia
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
    
    // Validar dados de família
    if (dados.companhia === 'familia') {
        if (dados.quantidadeAdultos === 0) {
            throw new Error('É necessário pelo menos 1 adulto na família.');
        }
        if (dados.quantidadePessoas > 10) {
            throw new Error('Máximo de 10 pessoas por grupo familiar.');
        }
    }
    
    // Validar e ajustar dados de data
    if (dados.dataVolta && dados.dataVolta <= dados.dataIda) {
        const novaDataVolta = new Date(dados.dataIda);
        novaDataVolta.setDate(novaDataVolta.getDate() + 3);
        dados.dataVolta = novaDataVolta.toISOString().split('T')[0];
        console.warn('⚠️ Data de volta ajustada automaticamente');
    }
    
    return dados;
},

  /**
   * ✅ NOVO: Mostra tela de roteiro
   */
  mostrarRoteiro() {
    const formulario = document.getElementById('formulario-dados');
    const roteiro = document.getElementById('roteiro-content');
    const acoes = document.getElementById('acoes-roteiro');
    const header = document.querySelector('.app-header h1');
    
    if (formulario) formulario.style.display = 'none';
    if (roteiro) roteiro.style.display = 'block';
    if (acoes) acoes.style.display = 'flex';
    if (header) header.textContent = `Seu Roteiro para ${this.dadosFormulario.destino}`;
  },

  /**
   * ✅ NOVO: Processa dados e gera roteiro
   */
  async processarDadosEGerarRoteiro() {
    try {
      // Converter dados do formulário para formato esperado
      this.converterDadosFormulario();
      
      // Gerar roteiro usando lógica existente
      await this.gerarRoteiroIA();
      
    } catch (erro) {
      console.error('❌ Erro ao gerar roteiro:', erro);
      throw erro;
    }
  },

  /**
 * ✅ CONVERSÃO DE DADOS - VERSÃO EXPANDIDA
 */
converterDadosFormulario() {
    const dados = this.dadosFormulario;
    
    // Criar estrutura de voo simulada
    this.dadosVoo = {
        infoIda: {
            dataPartida: dados.dataIda,
            horaChegada: dados.horarioChegada,
            aeroportoChegada: 'INT'
        },
        infoVolta: dados.dataVolta ? {
            dataPartida: dados.dataVolta,
            horaPartida: dados.horarioPartida
        } : null
    };
    
    // ✅ NOVO: Estrutura expandida de usuário
    this.dadosUsuario = {
        respostas: {
            companhia: this.mapearCompanhia(dados.companhia),
            quantidade_familia: dados.companhia === 'familia' ? dados.quantidadePessoas : null,
            quantidade_amigos: dados.companhia === 'amigos' ? dados.quantidadePessoas : null,
            // ✅ NOVO: Campos específicos
            quantidade_adultos: dados.quantidadeAdultos,
            quantidade_criancas: dados.quantidadeCriancas,
            quantidade_bebes: dados.quantidadeBebes,
            tipo_viagem: this.mapearPreferencias(dados.preferencias),
            intensidade_roteiro: dados.intensidade,
            orcamento_nivel: dados.orcamento
        }
    };
    
    // Criar estrutura de destino
    this.dadosDestino = {
        destino: dados.destino,
        codigo_iata: 'INT',
        pais: this.extrairPais(dados.destino)
    };
    
    console.log('✅ Dados convertidos:', {
        voo: this.dadosVoo,
        usuario: this.dadosUsuario,
        destino: this.dadosDestino
    });
},

  /**
   * ✅ NOVO: Mapear companhia para índice
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
   * ✅ NOVO: Mapear preferências para índice
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
   * ✅ NOVO: Extrair país do destino
   */
  extrairPais(destino) {
    // Lógica simples para detectar país
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
    
    // Tentar detectar se tem vírgula (Cidade, País)
    if (destino.includes(',')) {
      const partes = destino.split(',');
      if (partes.length >= 2) {
        return partes[1].trim();
      }
    }
    
    return 'Internacional';
  },

  /**
   * ✅ CONFIGURAÇÃO DE EVENTOS GERAIS (mantido)
   */
  configurarEventosGerais() {
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
  // Redireciona para a página principal
  window.location.href = 'https://www.benetrip.com.br';
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
  },

  /**
   * ✅ NOVO: Voltar para formulário
   */
  voltarParaFormulario() {
    // Confirmar se realmente quer voltar
    if (this.roteiroPronto) {
      const confirmar = confirm('Tem certeza que deseja voltar? Você perderá o roteiro atual.');
      if (!confirmar) return;
    }
    
    // Resetar estado
    this.dadosFormulario = null;
    this.dadosVoo = null;
    this.dadosUsuario = null;
    this.dadosDestino = null;
    this.roteiroPronto = null;
    this.estaCarregando = false;
    
    // Limpar cache
    this.imagensCache.clear();
    
    // Mostrar formulário
    this.mostrarFormulario();
    
    // Resetar botão de gerar
    const btnGerar = document.getElementById('btn-gerar');
    if (btnGerar) {
      btnGerar.classList.remove('loading');
      btnGerar.disabled = false;
      btnGerar.innerHTML = '<span class="btn-icon">✨</span><span class="btn-text">Criar Meu Roteiro!</span>';
    }
  },

  /**
   * ✅ CARREGAMENTO DE DADOS ADAPTADO
   */
  async carregarDados() {
    try {
      console.log('📂 Usando dados do formulário...');
      
      if (!this.dadosFormulario) {
        throw new Error('Dados do formulário não encontrados');
      }
      
      // Dados já foram convertidos em converterDadosFormulario()
      console.log('✅ Dados carregados do formulário');
      
      await this.normalizarEValidarDatas();
      return true;
      
    } catch (erro) {
      console.error('❌ Erro ao carregar dados:', erro);
      throw erro;
    }
  },

  /**
   * ✅ LAZY LOADING MELHORADO (mantido)
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
   * ✅ CARREGAMENTO DE IMAGEM COM FALLBACK ROBUSTO (mantido)
   */
  carregarImagemComFallback(img) {
    const originalSrc = img.dataset.src;
    const local = img.alt || 'Local';
    
    // Fallbacks robustos
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
   * ✅ CRIA PLACEHOLDER SVG (mantido)
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

  // ===========================================
  // TODOS OS MÉTODOS EXISTENTES MANTIDOS
  // Apenas adaptando os métodos de obtenção de dados
  // ===========================================

  /**
   * ✅ NORMALIZAÇÃO DE DATAS ADAPTADA
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
      
      if (dataVoltaObj && dataVoltaObj <= dataIdaObj) {
        console.warn('⚠️ Data de volta anterior à ida, ajustando...');
        dataVoltaObj.setDate(dataIdaObj.getDate() + 3);
        dataVolta = this.formatarDataISO(dataVoltaObj);
      }
      
      // Atualizar estruturas
      this.dadosVoo.infoIda.dataPartida = dataIda;
      if (dataVolta && this.dadosVoo.infoVolta) {
        this.dadosVoo.infoVolta.dataPartida = dataVolta;
      }
      
      console.log('✅ Datas normalizadas:', {
        ida: dataIda,
        volta: dataVolta,
        diasViagem: this.calcularDiasViagem(dataIda, dataVolta)
      });
      
    } catch (erro) {
      console.error('❌ Erro ao normalizar datas:', erro);
      throw erro;
    }
  },

  /**
   * ✅ GERAÇÃO DE ROTEIRO COM API REAL (mantido com pequenos ajustes)
   */
  async gerarRoteiroIA() {
    try {
      console.log('🤖 Iniciando geração do roteiro com IA...');
      
      // Primeiro carregar dados
      await this.carregarDados();
      
      const dataIda = this.getDataIda();
      const dataVolta = this.getDataVolta();
      const diasViagem = this.calcularDiasViagem(dataIda, dataVolta);
      
      console.log('📊 Parâmetros para IA:', {
        destino: this.dadosDestino,
        dataIda,
        dataVolta,
        diasViagem,
        intensidade: this.dadosFormulario.intensidade,
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
        intensidade: this.dadosFormulario.intensidade,
        orcamento: this.dadosFormulario.orcamento,
        preferencias: this.obterPreferenciasCompletas(),
        modeloIA: 'deepseek'
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
      
      // Executar tarefas em paralelo
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

  // ===========================================
  // MÉTODOS ADAPTADOS PARA DADOS DO FORMULÁRIO
  // ===========================================

  /**
   * ✅ OBTER PREFERÊNCIAS COMPLETAS ADAPTADO
   */
  obterPreferenciasCompletas() {
    return {
      tipoViagem: this.obterTipoViagem(),
      tipoCompanhia: this.obterTipoCompanhia(),
      quantidade: this.obterQuantidadePessoas(),
      intensidade: this.dadosFormulario.intensidade,
      orcamento: this.dadosFormulario.orcamento,
      destino_preferido: this.dadosFormulario.preferencias
    };
  },

  /**
   * ✅ OBTER TIPO DE VIAGEM ADAPTADO
   */
  obterTipoViagem() {
    return this.dadosFormulario?.preferencias || 'cultura';
  },

  /**
   * ✅ OBTER TIPO DE COMPANHIA ADAPTADO
   */
  obterTipoCompanhia() {
    return this.dadosFormulario?.companhia || 'sozinho';
  },

  /**
   * ✅ OBTER QUANTIDADE DE PESSOAS ADAPTADO
   */
  obterQuantidadePessoas() {
    const companhia = this.obterTipoCompanhia();
    if (companhia === 'familia' || companhia === 'amigos') {
      return this.dadosFormulario?.quantidadePessoas || 2;
    }
    return companhia === 'casal' ? 2 : 1;
  },

  /**
   * ✅ EXTRAIR HORÁRIO DE CHEGADA ADAPTADO
   */
  extrairHorarioChegada() {
    return this.dadosFormulario?.horarioChegada || '15:30';
  },

  /**
   * ✅ EXTRAIR HORÁRIO DE PARTIDA ADAPTADO
   */
  extrairHorarioPartida() {
    return this.dadosFormulario?.horarioPartida || '21:00';
  },

  /**
   * ✅ GET DATA IDA ADAPTADO
   */
  getDataIda() {
    return this.dadosVoo?.infoIda?.dataPartida || this.dadosFormulario?.dataIda;
  },

  /**
   * ✅ GET DATA VOLTA ADAPTADO
   */
  getDataVolta() {
    return this.dadosVoo?.infoVolta?.dataPartida || this.dadosFormulario?.dataVolta;
  },

  // ===========================================
  // TODOS OS OUTROS MÉTODOS MANTIDOS INTEGRALMENTE
  // (Copiando do código original...)
  // ===========================================

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

  gerarImagemFallbackCorrigido(local, diaIndex, ativIndex) {
    const fallbacks = [
      `https://picsum.photos/400/250?random=${diaIndex}${ativIndex}${Date.now()}`,
      `https://source.unsplash.com/400x250/?travel,${encodeURIComponent(this.dadosDestino.destino)}`,
      this.criarImagemPlaceholderSVG(local)
    ];
    
    return fallbacks[ativIndex % fallbacks.length];
  },

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
    
    this.configurarLazyLoadingParaElementos();
    
    console.log('✅ Interface contínua atualizada');
  },

  configurarLazyLoadingParaElementos() {
    if (this.imageObserver) {
      const imagens = document.querySelectorAll('img[data-src]');
      imagens.forEach(img => {
        this.imageObserver.observe(img);
      });
      
      console.log(`🖼️ Lazy loading configurado para ${imagens.length} imagens`);
    }
  },

  criarElementoDiaContinuo(dia, numeroDia) {
    const elemento = document.createElement('div');
    elemento.className = 'dia-roteiro continuo';
    elemento.setAttribute('data-dia', numeroDia);
    
    const dataFormatada = this.formatarDataCompleta(dia.data);
    const temPrevisao = dia.previsao && numeroDia <= 3;
    
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
  // MÉTODOS AUXILIARES (mantidos integralmente)
  // ===========================================

  async gerarRoteiroFallback(dataIda, dataVolta, diasViagem) {
    console.log('🛡️ Gerando roteiro fallback...');
    
    const destino = this.dadosDestino.destino;
    const dias = [];
    const dataInicio = new Date(dataIda + 'T12:00:00');
    
    // Ajustar número de atividades baseado na intensidade
    const intensidade = this.dadosFormulario.intensidade;
    const atividadesPorDia = {
      'leve': 3,
      'moderado': 4,
      'intenso': 6
    };
    
    const numAtividades = atividadesPorDia[intensidade] || 4;
    
    for (let i = 0; i < diasViagem; i++) {
      const dataAtual = new Date(dataInicio);
      dataAtual.setDate(dataInicio.getDate() + i);
      
      const dia = {
        data: this.formatarDataISO(dataAtual),
        descricao: this.obterDescricaoDia(i + 1, destino, diasViagem),
        atividades: this.gerarAtividadesFallback(i, destino, diasViagem, numAtividades)
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

  gerarAtividadesFallback(diaIndex, destino, totalDias, numAtividades) {
    const atividadesBase = this.obterAtividadesBasePorDestino(destino);
    const atividades = [];
    
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
    const horariosBase = ['09:00', '11:30', '14:00', '16:30', '19:00', '21:00'];
    return horariosBase[indice % horariosBase.length];
  },

  async buscarPrevisaoTempo() {
    try {
      console.log('🌤️ Buscando previsão do tempo via API...');
      
      if (!this.roteiroPronto?.dias || this.roteiroPronto.dias.length === 0) {
        console.warn('⚠️ Sem dias no roteiro para buscar previsão');
        return;
      }
      
      const cidade = this.dadosDestino.destino;
      const dataInicio = this.getDataIda();
      const dataFim = this.getDataVolta();
      const diasComPrevisao = Math.min(3, this.roteiroPronto.dias.length);
      
      console.log(`📊 Buscando previsão para: ${cidade} (${diasComPrevisao} dias)`);
      
      try {
        const urlAPI = `/api/weather?city=${encodeURIComponent(cidade)}&start=${dataInicio}&end=${dataFim}`;
        
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
      
      const diasComPrevisao = Math.min(3, this.roteiroPronto.dias.length);
      for (let i = 0; i < diasComPrevisao; i++) {
        if (!this.roteiroPronto.dias[i].previsao) {
          this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoFallback(i);
        }
      }
    }
  },

  gerarPrevisaoFallback(diaIndex) {
    const cidade = this.dadosDestino.destino.toLowerCase();
    
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

  /**
 * ✅ MODIFICAÇÕES PARA COMPARTILHAMENTO COMO IMAGEM
 * Adicionar estes métodos ao objeto BENETRIP_ROTEIRO
 */

// ==========================================
// COMPARTILHAMENTO COMO IMAGEM - NOVO
// ==========================================

/**
 * ✅ COMPARTILHAR ROTEIRO - VERSÃO EXPANDIDA COM IMAGEM
 */
async compartilharRoteiro() {
  try {
    // Verificar se html2canvas está disponível
    if (typeof html2canvas === 'undefined') {
      console.warn('⚠️ html2canvas não encontrado, usando compartilhamento básico');
      return this.compartilharLink();
    }
    
    // Mostrar modal de opções
    this.mostrarModalCompartilhamento();
    
  } catch (erro) {
    console.error('❌ Erro no compartilhamento:', erro);
    this.exibirToast('Erro ao compartilhar. Tente novamente.', 'error');
  }
},

/**
 * ✅ NOVO: Modal de opções de compartilhamento
 */
mostrarModalCompartilhamento() {
  // Remover modal existente se houver
  const modalExistente = document.getElementById('modal-compartilhar');
  if (modalExistente) modalExistente.remove();
  
  // Criar modal
  const modal = document.createElement('div');
  modal.id = 'modal-compartilhar';
  modal.className = 'modal-overlay';
  
  modal.innerHTML = `
    <div class="modal-content modal-compartilhar">
      <div class="modal-header">
        <h3>📤 Compartilhar Roteiro</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      
      <div class="modal-body">
        <div class="opcoes-compartilhamento">
          <button class="opcao-compartilhar opcao-destaque" data-tipo="imagem">
            <div class="opcao-icon">📸</div>
            <div class="opcao-info">
              <div class="opcao-titulo">Imagem</div>
              <div class="opcao-desc">Perfeito para redes sociais</div>
            </div>
          </button>
          
          <button class="opcao-compartilhar" data-tipo="link">
            <div class="opcao-icon">🔗</div>
            <div class="opcao-info">
              <div class="opcao-titulo">Link</div>
              <div class="opcao-desc">Copiar link da página</div>
            </div>
          </button>
          
          <button class="opcao-compartilhar" data-tipo="texto">
            <div class="opcao-icon">📋</div>
            <div class="opcao-info">
              <div class="opcao-titulo">Texto</div>
              <div class="opcao-desc">Resumo do roteiro</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Adicionar eventos
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  modal.querySelectorAll('.opcao-compartilhar').forEach(opcao => {
    opcao.addEventListener('click', async (e) => {
      const tipo = opcao.dataset.tipo;
      modal.remove();
      
      // Desabilitar botão temporariamente
      opcao.disabled = true;
      
      try {
        switch (tipo) {
          case 'imagem':
            await this.gerarImagemRoteiro();
            break;
          case 'link':
            await this.compartilharLink();
            break;
          case 'texto':
            await this.compartilharTexto();
            break;
        }
      } catch (erro) {
        console.error('❌ Erro na ação de compartilhamento:', erro);
        this.exibirToast('Erro ao processar compartilhamento', 'error');
      }
    });
  });
  
  // Animação de entrada
  requestAnimationFrame(() => {
    modal.classList.add('modal-visible');
  });
},

/**
 * ✅ NOVO: Gerar imagem do roteiro
 */
async gerarImagemRoteiro() {
  try {
    console.log('📸 Iniciando geração da imagem...');
    
    // Mostrar loading
    this.exibirToast('📸 Gerando imagem do roteiro...', 'info');
    
    // Preparar elemento para captura
    const elemento = await this.prepararElementoParaCaptura();
    
    // Configurações otimizadas do html2canvas
    const opcoes = {
      scale: 2, // Alta qualidade
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: elemento.offsetWidth,
      height: elemento.offsetHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: elemento.offsetWidth,
      windowHeight: elemento.offsetHeight,
      onclone: (clonedDoc) => {
        // Ajustar estilos no clone
        this.ajustarEstilosParaImagem(clonedDoc);
      }
    };
    
    console.log('🎨 Capturando elemento...', opcoes);
    
    // Gerar canvas
    const canvas = await html2canvas(elemento, opcoes);
    
    console.log('✅ Canvas gerado:', canvas.width, 'x', canvas.height);
    
    // Processar e compartilhar imagem
    await this.processarECompartilharImagem(canvas);
    
  } catch (erro) {
    console.error('❌ Erro ao gerar imagem:', erro);
    this.exibirToast('❌ Erro ao gerar imagem. Tente novamente.', 'error');
  }
},

/**
 * ✅ NOVO: Preparar elemento para captura
 */
async prepararElementoParaCaptura() {
  // Elemento principal do roteiro
  let elemento = document.querySelector('.roteiro-content');
  
  if (!elemento) {
    throw new Error('Elemento do roteiro não encontrado');
  }
  
  // Aguardar imagens carregarem
  await this.aguardarImagensCarregarem(elemento);
  
  // Garantir que está visível
  elemento.style.display = 'block';
  elemento.style.visibility = 'visible';
  
  return elemento;
},

/**
 * ✅ NOVO: Aguardar todas as imagens carregarem
 */
async aguardarImagensCarregarem(elemento) {
  const imagens = elemento.querySelectorAll('img');
  const promessas = Array.from(imagens).map(img => {
    return new Promise((resolve) => {
      if (img.complete) {
        resolve();
      } else {
        img.onload = resolve;
        img.onerror = resolve; // Resolve mesmo com erro
        // Timeout de segurança
        setTimeout(resolve, 3000);
      }
    });
  });
  
  await Promise.all(promessas);
  console.log(`✅ ${imagens.length} imagens processadas para captura`);
},

/**
 * ✅ NOVO: Ajustar estilos para imagem
 */
ajustarEstilosParaImagem(clonedDoc) {
  const elemento = clonedDoc.querySelector('.roteiro-content');
  
  if (elemento) {
    // Garantir fundo branco
    elemento.style.backgroundColor = '#ffffff';
    elemento.style.padding = '20px';
    elemento.style.margin = '0';
    
    // Ajustar fontes e cores
    const textos = elemento.querySelectorAll('*');
    textos.forEach(el => {
      // Garantir contraste
      if (window.getComputedStyle(el).color === 'rgb(255, 255, 255)') {
        el.style.color = '#333333';
      }
      
      // Ajustar tamanhos de fonte muito pequenos
      const fontSize = window.getComputedStyle(el).fontSize;
      if (fontSize && parseInt(fontSize) < 12) {
        el.style.fontSize = '12px';
      }
    });
    
    // Garantir que badges sejam visíveis
    const badges = elemento.querySelectorAll('.badge');
    badges.forEach(badge => {
      badge.style.fontWeight = 'bold';
      badge.style.padding = '4px 8px';
    });
  }
},

/**
 * ✅ NOVO: Processar e compartilhar imagem
 */
async processarECompartilharImagem(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      try {
        if (!blob) {
          throw new Error('Falha ao gerar blob da imagem');
        }
        
        console.log('📦 Blob gerado:', blob.size, 'bytes');
        
        const nomeArquivo = `roteiro-${this.dadosDestino.destino.toLowerCase().replace(/[^a-z0-9]/g, '-')}-benetrip.png`;
        
        // Tentar compartilhamento nativo primeiro (mobile)
        if (this.podeCompartilharArquivos()) {
          try {
            const arquivo = new File([blob], nomeArquivo, { type: 'image/png' });
            
            await navigator.share({
              title: `Roteiro Benetrip - ${this.dadosDestino.destino}`,
              text: `Confira meu roteiro personalizado para ${this.dadosDestino.destino}! 🐕✈️`,
              files: [arquivo]
            });
            
            this.exibirToast('📤 Imagem compartilhada!', 'success');
            resolve();
            return;
          } catch (erroShare) {
            console.log('ℹ️ Compartilhamento nativo falhou, usando download:', erroShare.message);
          }
        }
        
        // Fallback: Download da imagem
        this.baixarImagem(blob, nomeArquivo);
        this.exibirToast('📸 Imagem salva! Compartilhe onde quiser.', 'success');
        resolve();
        
      } catch (erro) {
        console.error('❌ Erro ao processar imagem:', erro);
        reject(erro);
      }
    }, 'image/png', 0.95);
  });
},

/**
 * ✅ NOVO: Verificar se pode compartilhar arquivos
 */
podeCompartilharArquivos() {
  return (
    navigator.share && 
    navigator.canShare && 
    /mobile|android|iphone|ipad/i.test(navigator.userAgent)
  );
},

/**
 * ✅ NOVO: Baixar imagem
 */
baixarImagem(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Liberar memória
  setTimeout(() => URL.revokeObjectURL(url), 1000);
},

/**
 * ✅ MELHORADO: Compartilhar link (mantido como fallback)
 */
async compartilharLink() {
  const titulo = `Roteiro Benetrip - ${this.dadosDestino.destino}`;
  const texto = `Confira meu roteiro personalizado para ${this.dadosDestino.destino}! 🐕✈️`;
  const url = window.location.href;
  
  // Tentar compartilhamento nativo
  if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ title: titulo, text: texto, url });
      this.exibirToast('🔗 Link compartilhado!', 'success');
      return;
    } catch (e) {
      console.log('ℹ️ Share cancelado ou falhou');
    }
  }
  
  // Fallback: Copiar para clipboard
  try {
    await navigator.clipboard.writeText(url);
    this.exibirToast('🔗 Link copiado! Cole onde quiser compartilhar.', 'success');
  } catch (e) {
    // Fallback do fallback
    this.copiarTextoLegacy(url);
    this.exibirToast('🔗 Link copiado!', 'success');
  }
},

/**
 * ✅ NOVO: Compartilhar como texto
 */
async compartilharTexto() {
  const texto = this.gerarTextoRoteiro();
  
  if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
    try {
      await navigator.share({
        title: `Roteiro para ${this.dadosDestino.destino}`,
        text: texto
      });
      this.exibirToast('📋 Texto compartilhado!', 'success');
      return;
    } catch (e) {
      console.log('ℹ️ Share de texto cancelado');
    }
  }
  
  // Fallback: Copiar texto
  try {
    await navigator.clipboard.writeText(texto);
    this.exibirToast('📋 Texto do roteiro copiado!', 'success');
  } catch (e) {
    this.copiarTextoLegacy(texto);
    this.exibirToast('📋 Texto copiado!', 'success');
  }
},

/**
 * ✅ NOVO: Gerar texto do roteiro
 */
gerarTextoRoteiro() {
  const destino = this.dadosDestino.destino;
  const dataIda = this.formatarData(this.getDataIda());
  const dataVolta = this.getDataVolta() ? this.formatarData(this.getDataVolta()) : null;
  
  let texto = `🐕 ROTEIRO BENETRIP - ${destino.toUpperCase()} ✈️\n\n`;
  texto += `📅 ${dataIda}${dataVolta ? ` até ${dataVolta}` : ''}\n`;
  texto += `👥 ${this.obterTextoCompanhia()}\n\n`;
  
  this.roteiroPronto.dias.forEach((dia, index) => {
    texto += `📍 DIA ${index + 1} - ${this.formatarDataCompleta(dia.data)}\n`;
    if (dia.descricao) texto += `"${dia.descricao}"\n\n`;
    
    dia.atividades.forEach(ativ => {
      if (!ativ.isEspecial) {
        texto += `${ativ.horario || ''} • ${ativ.local}\n`;
        if (ativ.dica) texto += `💡 ${ativ.dica}\n`;
        texto += '\n';
      }
    });
    
    texto += '---\n\n';
  });
  
  texto += '🐾 Criado com amor pela Tripinha em benetrip.com.br';
  
  return texto;
},

/**
 * ✅ NOVO: Copiar texto (método legacy)
 */
copiarTextoLegacy(texto) {
  const textarea = document.createElement('textarea');
  textarea.value = texto;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
},

  editarRoteiro() {
    if (confirm('Deseja voltar ao formulário para editar suas preferências?')) {
      this.voltarParaFormulario();
    }
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
  // MÉTODOS AUXILIARES ADICIONAIS (mantidos)
  // =====================================

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

  obterTextoIntensidade() {
    const mapa = {
      'leve': 'Leve (2-3 atividades/dia)',
      'moderado': 'Moderado (4-5 atividades/dia)',
      'intenso': 'Intenso (6+ atividades/dia)'
    };
    return mapa[this.dadosFormulario?.intensidade] || 'Moderado';
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

  /**
 * ✅ OBTER TEXTO DA COMPANHIA - VERSÃO EXPANDIDA
 */
obterTextoCompanhia() {
    const dados = this.dadosFormulario;
    const tipo = dados.companhia;
    
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
        'amigos': `Grupo de Amigos (${dados.quantidadePessoas || 2} pessoas)`
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

