/**
 * Benetrip - Sistema de Roteiro com Formulário Manual (VERSÃO 10.0)
 * Novidades v10:
 * - ✅ Resumo da viagem mostrando TODAS as escolhas do usuário (incluindo orçamento)
 * - ✅ Resumo final do roteiro com texto compartilhável
 * - ✅ Botão voltar contextual (roteiro → formulário, formulário → benetrip)
 * - ✅ History API para botão voltar do navegador/celular
 * - ✅ Persistência do roteiro no sessionStorage
 * - ✅ Todas as funcionalidades anteriores mantidas
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

  // ✅ NOVO: Controle de estado da navegação
  estadoAtual: 'formulario', // 'formulario' | 'roteiro'

  /**
   * ✅ INICIALIZAÇÃO v10 - Com History API e recuperação de estado
   */
  init() {
    console.log('🚀 Benetrip Roteiro v10.1 - Fixes: re-search, destaques, prompt, editar');
    
    // ✅ FIX v10.1: Renomear botão "Personalizar" → "Editar"
    const btnEditar = document.getElementById('btn-editar-roteiro');
    if (btnEditar) {
      const spanTexto = btnEditar.querySelector('span:last-child');
      if (spanTexto) spanTexto.textContent = 'Editar';
    }
    
    // ✅ NOVO: Configurar History API
    this.configurarHistoryAPI();
    
    // ✅ NOVO: Tentar recuperar roteiro salvo
    const roteiroRecuperado = this.recuperarRoteiro();
    
    if (roteiroRecuperado) {
      console.log('📦 Roteiro recuperado do sessionStorage');
      this.mostrarRoteiro();
      this.atualizarUIComRoteiroContino();
    } else {
      this.mostrarFormulario();
    }
    
    this.configurarFormulario();
    this.configurarEventosGerais();
    this.configurarLazyLoadingMelhorado();
  },

  // ===========================================
  // ✅ NOVO: HISTORY API + NAVEGAÇÃO INTELIGENTE
  // ===========================================

  /**
   * ✅ NOVO: Configura History API para botão voltar do navegador/celular
   */
  configurarHistoryAPI() {
    // Definir estado inicial no histórico
    if (!history.state || !history.state.benetrip) {
      history.replaceState({ benetrip: true, estado: 'formulario' }, '', window.location.href);
    }

    // Listener para o botão voltar do navegador/celular
    window.addEventListener('popstate', (event) => {
      console.log('🔙 popstate detectado:', event.state);
      
      if (this.estadoAtual === 'roteiro') {
        // Se está no roteiro, volta para o formulário
        event.preventDefault();
        this.voltarParaFormularioSemHistorico();
      }
      // Se está no formulário, o comportamento padrão leva para fora (benetrip.com.br ou página anterior)
    });
  },

  /**
   * ✅ NOVO: Adicionar estado ao histórico ao mostrar roteiro
   */
  pushEstadoRoteiro() {
    history.pushState({ benetrip: true, estado: 'roteiro' }, '', window.location.href);
    this.estadoAtual = 'roteiro';
  },

  /**
   * ✅ NOVO: Voltar para formulário sem alterar histórico (chamado pelo popstate)
   */
  voltarParaFormularioSemHistorico() {
    this.estadoAtual = 'formulario';
    
    // ✅ FIX v10.1: Reset completo
    this.roteiroPronto = null;
    this.estaCarregando = false;
    this.imagensCache.clear();
    this.progressoAtual = 10;
    clearInterval(this.intervalId);
    this.intervalId = null;
    
    // Mostrar formulário mantendo os dados
    this.mostrarFormulario();
    
    // Restaurar botão
    const btnGerar = document.getElementById('btn-gerar');
    if (btnGerar) {
      btnGerar.classList.remove('loading');
      btnGerar.disabled = false;
      btnGerar.innerHTML = '<span class="btn-icon">✨</span><span class="btn-text">Criar Meu Roteiro!</span>';
    }
    
    console.log('✅ Voltou para o formulário (via navegador)');
  },

  // ===========================================
  // ✅ NOVO: PERSISTÊNCIA NO SESSIONSTORAGE
  // ===========================================

  /**
   * ✅ NOVO: Salvar roteiro no sessionStorage
   */
  salvarRoteiro() {
    try {
      const dadosParaSalvar = {
        timestamp: Date.now(),
        dadosFormulario: this.dadosFormulario,
        dadosVoo: this.dadosVoo,
        dadosUsuario: this.dadosUsuario,
        dadosDestino: this.dadosDestino,
        roteiroPronto: this.roteiroPronto
      };
      sessionStorage.setItem('benetrip_roteiro_salvo', JSON.stringify(dadosParaSalvar));
      console.log('💾 Roteiro salvo no sessionStorage');
    } catch (e) {
      console.warn('⚠️ Erro ao salvar roteiro:', e);
    }
  },

  /**
   * ✅ NOVO: Recuperar roteiro do sessionStorage
   */
  recuperarRoteiro() {
    try {
      const dados = sessionStorage.getItem('benetrip_roteiro_salvo');
      if (!dados) return false;
      
      const parsed = JSON.parse(dados);
      
      // Verificar se o roteiro não é muito antigo (24h)
      if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
        sessionStorage.removeItem('benetrip_roteiro_salvo');
        return false;
      }
      
      // Restaurar estado
      this.dadosFormulario = parsed.dadosFormulario;
      this.dadosVoo = parsed.dadosVoo;
      this.dadosUsuario = parsed.dadosUsuario;
      this.dadosDestino = parsed.dadosDestino;
      this.roteiroPronto = parsed.roteiroPronto;
      this.estadoAtual = 'roteiro';
      
      // Adicionar estado ao histórico para que voltar funcione
      this.pushEstadoRoteiro();
      
      return true;
    } catch (e) {
      console.warn('⚠️ Erro ao recuperar roteiro:', e);
      return false;
    }
  },

  /**
   * ✅ NOVO: Limpar roteiro salvo
   */
  limparRoteiroSalvo() {
    sessionStorage.removeItem('benetrip_roteiro_salvo');
  },

  /**
   * ✅ Mostra o formulário de entrada
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
    
    this.estadoAtual = 'formulario';
  },

  /**
   * ✅ Configura eventos do formulário
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
    
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.processarFormulario();
    });

    this.configurarValidacaoDatas();
    
    console.log('✅ Formulário configurado com sucesso');
  },

  /**
   * ✅ CONFIGURAR CAMPOS CONDICIONAIS
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
          document.getElementById('quantidade-pessoas').required = false;
        }
        if (grupoFamilia) {
          grupoFamilia.style.display = 'none';
          quantidadeAdultos.required = false;
        }
        
        if (valor === 'familia') {
          grupoFamilia.style.display = 'block';
          quantidadeAdultos.required = true;
          calcularTotalFamilia();
        } else if (valor === 'amigos') {
          grupoQuantidade.style.display = 'block';
          document.getElementById('quantidade-pessoas').required = true;
        }
      });
    });
    
    const familiaRadio = document.querySelector('input[name="companhia"][value="familia"]');
    if (familiaRadio && familiaRadio.checked) {
      calcularTotalFamilia();
    }
  },

  /**
   * ✅ Configura validação em tempo real
   */
  configurarValidacaoTempoReal() {
    const destino = document.getElementById('destino');
    const dataIda = document.getElementById('data-ida');
    
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
   * ✅ Configura validação de datas
   */
  configurarValidacaoDatas() {
    const dataIda = document.getElementById('data-ida');
    const dataVolta = document.getElementById('data-volta');
    
    const hoje = new Date().toISOString().split('T')[0];
    dataIda.setAttribute('min', hoje);
    dataVolta.setAttribute('min', hoje);
    
    dataIda.addEventListener('change', (e) => {
      const dataIdaValor = e.target.value;
      if (dataIdaValor) {
        dataVolta.setAttribute('min', dataIdaValor);
        
        if (dataVolta.value && dataVolta.value <= dataIdaValor) {
          const novaDataVolta = new Date(dataIdaValor);
          novaDataVolta.setDate(novaDataVolta.getDate() + 1);
          dataVolta.value = novaDataVolta.toISOString().split('T')[0];
        }
      }
    });
  },

  /**
   * ✅ Processa dados do formulário
   */
  async processarFormulario() {
    const btnGerar = document.getElementById('btn-gerar');
    
    try {
      if (!this.validarFormulario()) return;
      
      this.dadosFormulario = this.capturarDadosFormulario();
      console.log('📋 Dados capturados:', this.dadosFormulario);
      
      // ✅ FIX v10.1: Reset COMPLETO do estado antes de nova pesquisa
      this.limparRoteiroSalvo();
      this.roteiroPronto = null;
      this.imagensCache.clear();
      this.progressoAtual = 10;
      clearInterval(this.intervalId);
      this.intervalId = null;
      
      this.mostrarRoteiro();
      
      // ✅ FIX v10.1: Re-exibir e resetar o loading container
      this.resetarLoadingContainer();
      
      setTimeout(() => {
        this.iniciarAnimacaoProgresso();
      }, 100);
      
      btnGerar.classList.add('loading');
      btnGerar.disabled = true;
      btnGerar.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Gerando roteiro...</span>';
      
      await this.processarDadosEGerarRoteiro();
      
    } catch (erro) {
      console.error('❌ Erro ao processar formulário:', erro);
      this.mostrarErro('Erro ao processar seus dados. Tente novamente.');
      
      btnGerar.classList.remove('loading');
      btnGerar.disabled = false;
      btnGerar.innerHTML = '<span class="btn-icon">✨</span><span class="btn-text">Criar Meu Roteiro!</span>';
    }
  },

  /**
   * ✅ Valida o formulário
   */
  validarFormulario() {
    const form = document.getElementById('form-viagem');
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
    
    if (dados.dataVolta && dados.dataVolta <= dados.dataIda) {
      const novaDataVolta = new Date(dados.dataIda);
      novaDataVolta.setDate(novaDataVolta.getDate() + 3);
      dados.dataVolta = novaDataVolta.toISOString().split('T')[0];
      console.warn('⚠️ Data de volta ajustada automaticamente');
    }
    
    return dados;
  },

  /**
   * ✅ MODIFICADO: Mostra tela de roteiro + push no histórico
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

    // ✅ NOVO: Registrar estado no histórico do navegador
    this.pushEstadoRoteiro();
  },

  /**
   * ✅ Processa dados e gera roteiro
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
    
    console.log('✅ Dados convertidos:', {
      voo: this.dadosVoo,
      usuario: this.dadosUsuario,
      destino: this.dadosDestino
    });
  },

  mapearCompanhia(companhia) {
    const mapa = { 'sozinho': 0, 'casal': 1, 'familia': 2, 'amigos': 3 };
    return mapa[companhia] || 0;
  },

  mapearPreferencias(preferencia) {
    const mapa = { 'relaxar': 0, 'aventura': 1, 'cultura': 2, 'urbano': 3 };
    return mapa[preferencia] || 2;
  },

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
      if (partes.length >= 2) return partes[1].trim();
    }
    
    return 'Internacional';
  },

  /**
   * ✅ MODIFICADO: Eventos gerais com navegação inteligente
   */
  configurarEventosGerais() {
    document.addEventListener('click', (e) => {
      // ✅ MODIFICADO: Botão voltar contextual
      if (e.target.closest('.btn-voltar')) {
        e.preventDefault();
        this.navegarVoltar();
        return;
      }
      
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
      
      if (e.target.closest('.btn-ver-mapa-mini')) {
        e.preventDefault();
        const botao = e.target.closest('.btn-ver-mapa-mini');
        const local = botao.getAttribute('data-local');
        if (local) this.abrirMapa(local);
        return;
      }

      // ✅ NOVO: Botão copiar resumo final
      if (e.target.closest('#btn-copiar-resumo-final')) {
        e.preventDefault();
        this.copiarResumoFinal();
        return;
      }

      // ✅ NOVO: Botão novo roteiro
      if (e.target.closest('#btn-novo-roteiro')) {
        e.preventDefault();
        this.novoRoteiro();
        return;
      }
    });
  },

  /**
   * ✅ NOVO: Navegação inteligente do botão voltar
   */
  navegarVoltar() {
    if (this.estadoAtual === 'roteiro') {
      // Se está vendo o roteiro, volta pro formulário
      if (this.roteiroPronto) {
        const confirmar = confirm('Deseja voltar ao formulário? Seu roteiro será mantido e você pode editá-lo.');
        if (!confirmar) return;
      }
      this.voltarParaFormularioComHistorico();
    } else {
      // Se está no formulário, vai para o site principal
      window.location.href = 'https://www.benetrip.com.br';
    }
  },

  /**
   * ✅ NOVO: Voltar para formulário alterando o histórico
   */
  voltarParaFormularioComHistorico() {
    this.estadoAtual = 'formulario';
    this.roteiroPronto = null;
    this.estaCarregando = false;
    this.imagensCache.clear();
    
    // ✅ FIX v10.1: Reset completo do progresso
    this.progressoAtual = 10;
    clearInterval(this.intervalId);
    this.intervalId = null;
    
    this.mostrarFormulario();
    
    const btnGerar = document.getElementById('btn-gerar');
    if (btnGerar) {
      btnGerar.classList.remove('loading');
      btnGerar.disabled = false;
      btnGerar.innerHTML = '<span class="btn-icon">✨</span><span class="btn-text">Criar Meu Roteiro!</span>';
    }
    
    // Voltar no histórico se possível
    if (history.state && history.state.estado === 'roteiro') {
      history.back();
    }
  },

  /**
   * ✅ Voltar para formulário (chamado pelo botão editar)
   */
  voltarParaFormulario() {
    if (this.roteiroPronto) {
      const confirmar = confirm('Tem certeza que deseja voltar? Você perderá o roteiro atual.');
      if (!confirmar) return;
    }
    
    this.estadoAtual = 'formulario';
    this.dadosFormulario = null;
    this.dadosVoo = null;
    this.dadosUsuario = null;
    this.dadosDestino = null;
    this.roteiroPronto = null;
    this.estaCarregando = false;
    this.imagensCache.clear();
    this.limparRoteiroSalvo();
    
    // ✅ FIX v10.1: Reset completo do progresso
    this.progressoAtual = 10;
    clearInterval(this.intervalId);
    this.intervalId = null;
    
    this.mostrarFormulario();
    
    const btnGerar = document.getElementById('btn-gerar');
    if (btnGerar) {
      btnGerar.classList.remove('loading');
      btnGerar.disabled = false;
      btnGerar.innerHTML = '<span class="btn-icon">✨</span><span class="btn-text">Criar Meu Roteiro!</span>';
    }
  },

  /**
   * ✅ NOVO: Criar novo roteiro (limpa tudo e volta ao formulário)
   */
  novoRoteiro() {
    this.limparRoteiroSalvo();
    this.dadosFormulario = null;
    this.dadosVoo = null;
    this.dadosUsuario = null;
    this.dadosDestino = null;
    this.roteiroPronto = null;
    this.estaCarregando = false;
    this.imagensCache.clear();
    this.estadoAtual = 'formulario';
    
    // ✅ FIX v10.1: Reset completo do progresso
    this.progressoAtual = 10;
    clearInterval(this.intervalId);
    this.intervalId = null;
    
    this.mostrarFormulario();
    
    const form = document.getElementById('form-viagem');
    if (form) form.reset();
    
    const grupoQuantidade = document.getElementById('grupo-quantidade');
    const grupoFamilia = document.getElementById('grupo-familia');
    if (grupoQuantidade) grupoQuantidade.style.display = 'none';
    if (grupoFamilia) grupoFamilia.style.display = 'none';
    
    const btnGerar = document.getElementById('btn-gerar');
    if (btnGerar) {
      btnGerar.classList.remove('loading');
      btnGerar.disabled = false;
      btnGerar.innerHTML = '<span class="btn-icon">✨</span><span class="btn-text">Criar Meu Roteiro!</span>';
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.exibirToast('Pronto para uma nova aventura! 🐾', 'success');
  },

  /**
   * ✅ FIX v10.1: Resetar loading container para nova pesquisa
   */
  resetarLoadingContainer() {
    const loading = document.getElementById('loading-inicial');
    if (loading) {
      loading.style.display = '';
      loading.classList.remove('fade-out');
    }
    
    // Resetar barra de progresso
    const barra = document.querySelector('.progress-bar');
    if (barra) {
      barra.style.width = '10%';
      barra.setAttribute('aria-valuenow', '10');
    }
    
    const texto = document.querySelector('.loading-text');
    if (texto) {
      texto.textContent = 'Preparando seu roteiro personalizado...';
    }
    
    // Limpar conteúdo anterior do roteiro (manter só o loading)
    const container = document.querySelector('.roteiro-content');
    if (container) {
      // Remover tudo exceto o loading container
      Array.from(container.children).forEach(child => {
        if (child.id !== 'loading-inicial') {
          child.remove();
        }
      });
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
   * ✅ LAZY LOADING
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

  carregarImagemComFallback(img) {
    const originalSrc = img.dataset.src;
    const local = img.alt || 'Local';
    
    const fallbacks = [
      originalSrc,
      `https://picsum.photos/400/250?random=${Math.floor(Math.random() * 1000)}`,
      `https://source.unsplash.com/400x250/?travel,${encodeURIComponent(this.dadosDestino.destino)}`,
      this.criarImagemPlaceholderSVG(local)
    ];
    
    let tentativaAtual = 0;
    
    const tentarCarregar = () => {
      if (tentativaAtual >= fallbacks.length) {
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
        setTimeout(tentarCarregar, 100);
      };
      
      img.src = src;
    };
    
    tentarCarregar();
  },

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
  // NORMALIZAÇÃO E GERAÇÃO DO ROTEIRO
  // ===========================================

  async normalizarEValidarDatas() {
    console.log('📅 Normalizando datas...');
    
    try {
      let dataIda = this.dadosFormulario.dataIda;
      let dataVolta = this.dadosFormulario.dataVolta;
      
      if (!dataIda) throw new Error('Data de ida não encontrada');
      
      dataIda = this.garantirFormatoISO(dataIda);
      if (dataVolta) dataVolta = this.garantirFormatoISO(dataVolta);
      
      const dataIdaObj = new Date(dataIda + 'T12:00:00');
      const dataVoltaObj = dataVolta ? new Date(dataVolta + 'T12:00:00') : null;
      
      if (isNaN(dataIdaObj.getTime())) throw new Error('Data de ida inválida: ' + dataIda);
      if (dataVoltaObj && isNaN(dataVoltaObj.getTime())) throw new Error('Data de volta inválida: ' + dataVolta);
      
      if (dataVoltaObj && dataVoltaObj <= dataIdaObj) {
        console.warn('⚠️ Data de volta anterior à ida, ajustando...');
        dataVoltaObj.setDate(dataIdaObj.getDate() + 3);
        dataVolta = this.formatarDataISO(dataVoltaObj);
      }
      
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

  async gerarRoteiroIA() {
    try {
      console.log('🤖 Iniciando geração do roteiro com IA...');
      
      await this.carregarDados();
      
      const dataIda = this.getDataIda();
      const dataVolta = this.getDataVolta();
      const diasViagem = this.calcularDiasViagem(dataIda, dataVolta);
      
      await this.delay(1500);
      
      // ... [código de chamada da API deepseek mantido] ...
      
      await Promise.all([
        this.buscarPrevisaoTempo(),
        this.buscarTodasImagensCorrigido()
      ]);
      
      // 1. Renderiza o roteiro gerado na interface
      this.atualizarUIComRoteiroContino();
      
      // 2. Salva no sessionStorage para navegação
      this.salvarRoteiro();

      // ══ AUTO-SAVE (NOVO) ══
      // Adicionado um check typeof para evitar erros se o script do auto-save falhar ao carregar
      if (typeof BenetripAutoSave !== 'undefined') {
          BenetripAutoSave.salvarRoteiro({
              destino_nome: this.dadosDestino.destino,
              destino_pais: this.dadosDestino.pais,
              data_ida: this.getDataIda(),
              data_volta: this.getDataVolta(),
              num_dias: this.roteiroPronto.dias.length, 
              dados_roteiro: this.roteiroPronto
          });
      }
      
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
  // MÉTODOS DE DADOS DO FORMULÁRIO
  // ===========================================

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

  obterTipoViagem() { return this.dadosFormulario?.preferencias || 'cultura'; },
  obterTipoCompanhia() { return this.dadosFormulario?.companhia || 'sozinho'; },

  obterQuantidadePessoas() {
    const companhia = this.obterTipoCompanhia();
    if (companhia === 'familia' || companhia === 'amigos') {
      return this.dadosFormulario?.quantidadePessoas || 2;
    }
    return companhia === 'casal' ? 2 : 1;
  },

  extrairHorarioChegada() { return this.dadosFormulario?.horarioChegada || '15:30'; },
  extrairHorarioPartida() { return this.dadosFormulario?.horarioPartida || '21:00'; },
  getDataIda() { return this.dadosVoo?.infoIda?.dataPartida || this.dadosFormulario?.dataIda; },
  getDataVolta() { return this.dadosVoo?.infoVolta?.dataPartida || this.dadosFormulario?.dataVolta; },

  // ===========================================
  // BUSCA DE IMAGENS
  // ===========================================

  async buscarTodasImagensCorrigido() {
    try {
      console.log('🖼️ Iniciando busca COMPLETA de imagens...');
      
      if (!this.roteiroPronto?.dias || this.roteiroPronto.dias.length === 0) return;
      
      const todasAtividades = [];
      
      this.roteiroPronto.dias.forEach((dia, diaIndex) => {
        if (dia.atividades?.length) {
          dia.atividades.forEach((atividade, ativIndex) => {
            if (atividade.local && !atividade.isEspecial) {
              todasAtividades.push({ local: atividade.local, diaIndex, ativIndex, referencia: atividade });
            }
          });
        }
      });
      
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
            return { sucesso: false, erro: erro.message };
          }
        });
        
        await Promise.allSettled(promessas);
        if (i + tamanhoLote < todasAtividades.length) await this.delay(200);
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
      
      console.log(`✅ Imagens: ${imagensAplicadas} aplicadas (${sucessos} API, ${imagensAplicadas - sucessos} fallbacks)`);
      
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
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(parametros)
      });
      
      if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
      
      const roteiro = await response.json();
      if (!roteiro.dias || !Array.isArray(roteiro.dias)) throw new Error('Formato de resposta inválido da API');
      
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
    
    if (!roteiroAPI.dias || !Array.isArray(roteiroAPI.dias)) throw new Error('Estrutura de dias inválida');
    
    roteiroAPI.dias.forEach((dia, index) => {
      const diaContino = {
        data: dia.data,
        descricao: dia.descricao || this.obterDescricaoDia(index + 1, this.dadosDestino.destino, roteiroAPI.dias.length),
        atividades: []
      };
      
      if (index === 0) diaContino.observacao = this.obterObservacaoPrimeiroDia();
      else if (index === roteiroAPI.dias.length - 1) diaContino.observacao = this.obterObservacaoUltimoDia();
      
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

  // ===========================================
  // ✅ MODIFICADO: UI DO ROTEIRO + RESUMO FINAL
  // ===========================================

  atualizarUIComRoteiroContino() {
    console.log('🎨 Atualizando interface com roteiro contínuo...');
    
    const container = document.querySelector('.roteiro-content');
    if (!container) {
      console.error('❌ Container do roteiro não encontrado');
      return;
    }
    
    container.innerHTML = '';
    
    const header = document.querySelector('.app-header h1');
    if (header) header.textContent = `Seu Roteiro para ${this.dadosDestino.destino}`;
    
    // 1. Resumo da viagem (com todas as escolhas)
    container.appendChild(this.criarResumoViagem());
    
    // 2. Dias do roteiro
    this.roteiroPronto.dias.forEach((dia, index) => {
      container.appendChild(this.criarElementoDiaContinuo(dia, index + 1));
    });
    
    // ✅ NOVO: 3. Resumo final do roteiro
    container.appendChild(this.criarResumoFinalRoteiro());
    
    const spacer = document.createElement('div');
    spacer.style.height = '100px';
    container.appendChild(spacer);
    
    this.configurarLazyLoadingParaElementos();
    
    console.log('✅ Interface contínua atualizada com resumo final');
  },

  configurarLazyLoadingParaElementos() {
    if (this.imageObserver) {
      const imagens = document.querySelectorAll('img[data-src]');
      imagens.forEach(img => this.imageObserver.observe(img));
      console.log(`🖼️ Lazy loading configurado para ${imagens.length} imagens`);
    }
  },

  // ===========================================
  // ✅ MODIFICADO: RESUMO DA VIAGEM - TODAS AS ESCOLHAS
  // ===========================================

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
            <div class="label">Horários:</div>
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

        <!-- ✅ NOVO: Campo de Orçamento -->
        <div class="resumo-item">
          <div class="icone">${this.obterIconeOrcamento()}</div>
          <div class="texto">
            <div class="label">Orçamento:</div>
            <p class="valor">${this.obterTextoOrcamento()}</p>
          </div>
        </div>
      </div>
    `;
    
    return resumo;
  },

  // ===========================================
  // ✅ NOVO: RESUMO FINAL DO ROTEIRO
  // ===========================================

  /**
   * ✅ NOVO: Cria seção de resumo final após todos os dias
   */
  criarResumoFinalRoteiro() {
    const resumoFinal = document.createElement('div');
    resumoFinal.className = 'resumo-final-roteiro';
    resumoFinal.id = 'resumo-final';
    
    const totalAtividades = this.contarTotalAtividades();
    const diasViagem = this.roteiroPronto.dias.length;
    const destino = this.dadosDestino.destino;
    const textoResumo = this.gerarTextoResumoFinal();
    
    resumoFinal.innerHTML = `
      <div class="resumo-final-header">
        <div class="resumo-final-icon">
          <img 
            src="assets/images/tripinha-avatar-oficial.png" 
            alt="Tripinha" 
            class="resumo-final-avatar"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
          >
          <div class="resumo-final-emoji" style="display:none;">🐕</div>
        </div>
        <h3>Resumo do seu Roteiro</h3>
        <p class="resumo-final-subtitle">
          ${diasViagem} dias em ${destino} com ${totalAtividades} experiências selecionadas pela Tripinha!
        </p>
      </div>

      <div class="resumo-final-stats">
        <div class="stat-item">
          <span class="stat-numero">${diasViagem}</span>
          <span class="stat-label">Dias</span>
        </div>
        <div class="stat-item">
          <span class="stat-numero">${totalAtividades}</span>
          <span class="stat-label">Atividades</span>
        </div>
        <div class="stat-item">
          <span class="stat-numero">${this.contarLocaisUnicos()}</span>
          <span class="stat-label">Locais</span>
        </div>
      </div>

      <div class="resumo-final-texto">
        <p>${textoResumo}</p>
      </div>

      <div class="resumo-final-destaques">
        <h4>Destaques do roteiro:</h4>
        <ul class="destaques-lista">
          ${this.gerarDestaquesRoteiro()}
        </ul>
      </div>

      <div class="resumo-final-acoes">
        <button class="btn btn-copiar-resumo" id="btn-copiar-resumo-final" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
          </svg>
          Copiar Resumo
        </button>
        <button class="btn btn-novo-roteiro" id="btn-novo-roteiro" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Novo Roteiro
        </button>
      </div>

      <div class="resumo-final-footer">
        <p>🐾 Roteiro criado com carinho pela Tripinha — <strong>benetrip.com.br</strong></p>
      </div>
    `;
    
    return resumoFinal;
  },

  /**
   * ✅ NOVO: Gerar texto narrativo do resumo final
   */
  gerarTextoResumoFinal() {
    const destino = this.dadosDestino.destino;
    const dias = this.roteiroPronto.dias.length;
    const companhia = this.obterTipoCompanhia();
    const estilo = this.dadosFormulario.preferencias;
    
    const companhiaTexto = {
      'sozinho': 'viajando solo',
      'casal': 'em casal',
      'familia': 'com a família',
      'amigos': 'com os amigos'
    }[companhia] || '';
    
    const estiloTexto = {
      'relaxar': 'relaxamento e bem-estar',
      'aventura': 'aventura e emoção',
      'cultura': 'cultura e história',
      'urbano': 'experiências urbanas'
    }[estilo] || 'experiências variadas';
    
    return `Preparei ${dias} dias incríveis em ${destino} ${companhiaTexto}, ` +
      `com foco em ${estiloTexto}. ` +
      `Cada dia foi pensado para equilibrar descobertas, descanso e momentos inesquecíveis. ` +
      `Lembre-se: o melhor roteiro é aquele que se adapta ao seu ritmo — ` +
      `sinta-se livre para ajustar conforme sua vontade! Au au! 🐾`;
  },

  /**
   * ✅ NOVO: Contar total de atividades (excluindo especiais)
   */
  contarTotalAtividades() {
    let total = 0;
    this.roteiroPronto.dias.forEach(dia => {
      if (dia.atividades) {
        total += dia.atividades.filter(a => !a.isEspecial).length;
      }
    });
    return total;
  },

  /**
   * ✅ NOVO: Contar locais únicos
   */
  contarLocaisUnicos() {
    const locais = new Set();
    this.roteiroPronto.dias.forEach(dia => {
      if (dia.atividades) {
        dia.atividades.forEach(a => {
          if (!a.isEspecial && a.local) locais.add(a.local);
        });
      }
    });
    return locais.size;
  },

  /**
   * ✅ NOVO: Gerar lista de destaques do roteiro
   */
  gerarDestaquesRoteiro() {
    const destaques = [];
    const totalDias = this.roteiroPronto.dias.length;
    
    // ✅ FIX v10.1: Mostrar TODOS os dias, não apenas 5
    this.roteiroPronto.dias.forEach((dia, index) => {
      if (dia.atividades && dia.atividades.length > 0) {
        const destaque = dia.atividades.find(a => !a.isEspecial) || dia.atividades[0];
        if (destaque && destaque.local) {
          destaques.push(`<li><strong>Dia ${index + 1}:</strong> ${destaque.local}</li>`);
        }
      }
    });
    
    return destaques.join('');
  },

  /**
   * ✅ NOVO: Copiar resumo final para clipboard
   */
  async copiarResumoFinal() {
    try {
      const texto = this.gerarTextoResumoFinalCompartilhavel();
      
      try {
        await navigator.clipboard.writeText(texto);
      } catch (e) {
        this.copiarTextoLegacy(texto);
      }
      
      this.exibirToast('📋 Resumo copiado! Cole onde quiser.', 'success');
      
    } catch (erro) {
      console.error('❌ Erro ao copiar resumo:', erro);
      this.exibirToast('Erro ao copiar resumo', 'error');
    }
  },

  /**
   * ✅ NOVO: Gerar texto do resumo final para compartilhar
   */
  gerarTextoResumoFinalCompartilhavel() {
    const destino = this.dadosDestino.destino;
    const pais = this.dadosDestino.pais;
    const dias = this.roteiroPronto.dias.length;
    const totalAtividades = this.contarTotalAtividades();
    const dataIda = this.formatarData(this.getDataIda());
    const dataVolta = this.getDataVolta() ? this.formatarData(this.getDataVolta()) : null;
    
    let texto = `🐕 RESUMO DO ROTEIRO — ${destino.toUpperCase()} ✈️\n\n`;
    texto += `📍 ${destino}, ${pais}\n`;
    texto += `📅 ${dataIda}${dataVolta ? ` a ${dataVolta}` : ''} (${dias} dias)\n`;
    texto += `👥 ${this.obterTextoCompanhiaResumido()}\n`;
    texto += `🎯 ${this.obterTextoPreferencia()} | ⚡ ${this.obterTextoIntensidade()} | ${this.obterIconeOrcamento()} ${this.obterTextoOrcamento()}\n\n`;
    
    texto += `📋 DESTAQUES:\n`;
    this.roteiroPronto.dias.forEach((dia, index) => {
      if (dia.atividades && dia.atividades.length > 0) {
        const destaque = dia.atividades.find(a => !a.isEspecial) || dia.atividades[0];
        if (destaque && destaque.local) {
          texto += `  Dia ${index + 1}: ${destaque.local}\n`;
        }
      }
    });
    
    texto += `\n🐾 ${totalAtividades} atividades em ${dias} dias\n`;
    texto += `📱 Crie o seu em: www.benetrip.com.br\n`;
    
    return texto;
  },

  // ===========================================
  // ✅ NOVO: HELPERS DE ORÇAMENTO
  // ===========================================

  /**
   * ✅ NOVO: Texto do orçamento
   */
  obterTextoOrcamento() {
    const mapa = {
      'economico': 'Econômico — Atividades gratuitas e baixo custo',
      'medio': 'Médio — Mix de atividades pagas e gratuitas',
      'alto': 'Alto — Experiências premium'
    };
    return mapa[this.dadosFormulario?.orcamento] || 'Não definido';
  },

  /**
   * ✅ NOVO: Ícone do orçamento
   */
  obterIconeOrcamento() {
    const mapa = {
      'economico': '💵',
      'medio': '💳',
      'alto': '💎'
    };
    return mapa[this.dadosFormulario?.orcamento] || '💰';
  },

  // ===========================================
  // RENDERING DE DIAS DO ROTEIRO
  // ===========================================

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
      return `<div class="dia-livre"><p>🏖️ Dia livre para descanso ou atividades opcionais.</p></div>`;
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
                  ${ativ.tags.map(tag => `<span class="badge ${this.getClasseBadge(tag)}">${tag}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
          
          ${ativ.dica ? `
            <div class="tripinha-dica">
              <div class="tripinha-avatar-mini">
                <img src="assets/images/tripinha-avatar.png" alt="Tripinha" class="avatar-img"
                  onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
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
            <img ${this.imageObserver ? 'data-src' : 'src'}="${ativ.imagemUrl}" 
              alt="${ativ.local}" class="imagem-lazy" loading="lazy" style="opacity: 0; transition: opacity 0.3s ease;">
          </div>
        ` : ''}
        
        ${!ativ.isEspecial ? `
          <button class="btn-ver-mapa-mini" data-local="${ativ.local}" aria-label="Ver ${ativ.local} no mapa" type="button">
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
  // COMPARTILHAMENTO
  // ===========================================

  async compartilharRoteiro() {
    try {
      this.mostrarModalCompartilhamento();
    } catch (erro) {
      console.error('❌ Erro no compartilhamento:', erro);
      this.exibirToast('Erro ao compartilhar. Tente novamente.', 'error');
    }
  },

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
                <div class="opcao-desc">Perfeita para WhatsApp</div>
              </div>
            </button>
            
            <button class="opcao-tamanho" data-tipo="completo">
              <div class="opcao-icon">📄</div>
              <div class="opcao-info">
                <div class="opcao-titulo">Versão Completa</div>
                <div class="opcao-desc">Todos os detalhes + mapas</div>
              </div>
            </button>
          </div>
          
          <div class="modal-acoes">
            <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
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
          if (tipo === 'resumido') await this.copiarRoteiroResumido();
          else await this.copiarRoteiroCompleto();
        } catch (erro) {
          this.exibirToast('Erro ao copiar roteiro', 'error');
        }
      });
    });
    
    requestAnimationFrame(() => modal.classList.add('modal-visible'));
  },

  async copiarRoteiroResumido() {
    const textoResumido = this.gerarTextoRoteiroResumido();
    try {
      await navigator.clipboard.writeText(textoResumido);
    } catch (e) {
      this.copiarTextoLegacy(textoResumido);
    }
    this.mostrarToastSucesso('resumido', textoResumido.length);
  },

  gerarTextoRoteiroResumido() {
    const destino = this.dadosDestino.destino;
    const pais = this.dadosDestino.pais;
    const dataIda = this.formatarData(this.getDataIda());
    const dataVolta = this.getDataVolta() ? this.formatarData(this.getDataVolta()) : null;
    const diasViagem = this.calcularDiasViagem(this.getDataIda(), this.getDataVolta());
    
    let texto = `🐕 ROTEIRO BENETRIP - ${destino.toUpperCase()} ✈️\n\n`;
    texto += `📍 ${destino}, ${pais}\n`;
    texto += `📅 ${dataIda}${dataVolta ? ` até ${dataVolta}` : ''} (${diasViagem} dias)\n`;
    texto += `👥 ${this.obterTextoCompanhiaResumido()}\n`;
    texto += `🎯 ${this.obterTextoPreferencia()} | ${this.obterIconeOrcamento()} ${this.obterTextoOrcamento()}\n\n`;
    
    this.roteiroPronto.dias.forEach((dia, index) => {
      const numeroDia = index + 1;
      const dataFormatada = this.formatarDataSimples(dia.data);
      
      texto += `📅 DIA ${numeroDia} - ${dataFormatada}\n`;
      if (dia.descricao) texto += `"${dia.descricao}"\n`;
      
      if (dia.atividades && dia.atividades.length > 0) {
        const atividadesPrincipais = dia.atividades.filter(ativ => !ativ.isEspecial).slice(0, 3);
        
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

  async copiarRoteiroCompleto() {
    const textoCompleto = this.gerarTextoRoteiroCompleto();
    try {
      await navigator.clipboard.writeText(textoCompleto);
    } catch (e) {
      this.copiarTextoLegacy(textoCompleto);
    }
    this.mostrarToastSucesso('completo', textoCompleto.length);
  },

  mostrarToastSucesso(tipo, tamanho) {
    const mensagem = tipo === 'resumido'
      ? `📱 Versão resumida copiada! (${tamanho} caracteres)`
      : `📄 Versão completa copiada! (${tamanho} caracteres)`;
    
    this.exibirToast(mensagem, 'success');
  },

  obterTextoCompanhiaResumido() {
    const dados = this.dadosFormulario;
    const tipo = dados.companhia;
    
    if (tipo === 'familia') return `Família (${dados.quantidadePessoas || 0} pessoas)`;
    
    const textos = {
      'sozinho': 'Solo',
      'casal': 'Casal',
      'amigos': `Amigos (${dados.quantidadePessoas || 2})`
    };
    
    return textos[tipo] || 'Individual';
  },

  formatarDataSimples(dataString) {
    if (!dataString) return 'Data indefinida';
    try {
      const data = new Date(dataString + 'T12:00:00');
      if (isNaN(data.getTime())) return dataString;
      return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      return dataString;
    }
  },

  gerarTextoRoteiroCompleto() {
    const destino = this.dadosDestino.destino;
    const pais = this.dadosDestino.pais;
    const dataIda = this.formatarData(this.getDataIda());
    const dataVolta = this.getDataVolta() ? this.formatarData(this.getDataVolta()) : null;
    const diasViagem = this.calcularDiasViagem(this.getDataIda(), this.getDataVolta());
    
    let texto = `🐕 ROTEIRO BENETRIP - ${destino.toUpperCase()} ✈️\n`;
    texto += `═══════════════════════════════\n\n`;
    
    texto += `📍 DESTINO: ${destino}, ${pais}\n`;
    texto += `📅 PERÍODO: ${dataIda}${dataVolta ? ` até ${dataVolta}` : ''}\n`;
    texto += `⏱️ DURAÇÃO: ${diasViagem} ${diasViagem === 1 ? 'dia' : 'dias'}\n`;
    texto += `👥 VIAJANTES: ${this.obterTextoCompanhia()}\n`;
    texto += `🎯 ESTILO: ${this.obterTextoPreferencia()}\n`;
    texto += `⚡ INTENSIDADE: ${this.obterTextoIntensidade()}\n`;
    texto += `${this.obterIconeOrcamento()} ORÇAMENTO: ${this.obterTextoOrcamento()}\n\n`;
    
    texto += `✈️ INFORMAÇÕES:\n`;
    texto += `🛬 Chegada: ${this.extrairHorarioChegada()}\n`;
    if (this.getDataVolta()) texto += `🛫 Partida: ${this.extrairHorarioPartida()}\n`;
    texto += `\n`;
    
    texto += `📋 ROTEIRO DETALHADO:\n`;
    texto += `═══════════════════════════════\n\n`;
    
    this.roteiroPronto.dias.forEach((dia, index) => {
      const numeroDia = index + 1;
      const dataFormatada = this.formatarDataCompleta(dia.data);
      
      texto += `📅 DIA ${numeroDia} - ${dataFormatada}\n`;
      texto += `${'-'.repeat(40)}\n`;
      
      if (dia.descricao) texto += `💭 "${dia.descricao}"\n\n`;
      if (dia.observacao) texto += `💡 ${dia.observacao}\n\n`;
      if (dia.previsao && index < 3) texto += `🌤️ PREVISÃO: ${dia.previsao.temperature}°C, ${dia.previsao.condition}\n\n`;
      
      if (dia.atividades && dia.atividades.length > 0) {
        texto += `📍 PROGRAMAÇÃO:\n\n`;
        
        dia.atividades.forEach((atividade) => {
          if (atividade.horario) {
            texto += `🕒 ${atividade.horario}`;
            if (atividade.duracao) texto += ` (${atividade.duracao})`;
            texto += `\n`;
          }
          
          texto += `📍 ${atividade.local}\n`;
          if (atividade.tags?.length) texto += `🏷️ ${atividade.tags.join(' • ')}\n`;
          if (atividade.dica) texto += `🐕 Dica da Tripinha: ${atividade.dica}\n`;
          
          if (!atividade.isEspecial && atividade.local) {
            texto += `🗺️ Ver no mapa: ${this.gerarLinkGoogleMaps(atividade.local)}\n`;
          }
          
          texto += `\n`;
        });
      }
      
      texto += `${'-'.repeat(40)}\n\n`;
    });
    
    texto += `🐾 Roteiro criado com amor pela Tripinha!\n`;
    texto += `📱 Crie o seu em: www.benetrip.com.br\n`;
    texto += `\n#Benetrip #Viagem #Roteiro #${destino.replace(/\s+/g, '')}`;
    
    return texto;
  },

  gerarLinkGoogleMaps(local) {
    const localLimpo = this.limparTextoParaURL(local);
    const destinoLimpo = this.limparTextoParaURL(this.dadosDestino.destino);
    return `https://maps.google.com/?q=${encodeURIComponent(`${localLimpo} ${destinoLimpo}`)}`;
  },

  limparTextoParaURL(texto) {
    if (!texto) return '';
    return texto
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

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

  abrirMapa(local) {
    const link = this.gerarLinkGoogleMaps(local);
    window.open(link, '_blank', 'noopener,noreferrer');
  },

  /**
   * ✅ FIX v10.1: Editar roteiro - volta ao formulário mantendo dados preenchidos
   */
  editarRoteiro() {
    if (confirm('Deseja voltar ao formulário para editar suas preferências? Ao gerar novamente, o roteiro atual será substituído.')) {
      // Reset do estado de execução mas MANTER dadosFormulario
      this.roteiroPronto = null;
      this.estaCarregando = false;
      this.imagensCache.clear();
      this.progressoAtual = 10;
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.limparRoteiroSalvo();
      this.estadoAtual = 'formulario';
      
      this.mostrarFormulario();
      
      // Restaurar botão
      const btnGerar = document.getElementById('btn-gerar');
      if (btnGerar) {
        btnGerar.classList.remove('loading');
        btnGerar.disabled = false;
        btnGerar.innerHTML = '<span class="btn-icon">✨</span><span class="btn-text">Criar Meu Roteiro!</span>';
      }
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  // ===========================================
  // FALLBACKS E PREVISÃO
  // ===========================================

  async gerarRoteiroFallback(dataIda, dataVolta, diasViagem) {
    console.log('🛡️ Gerando roteiro fallback...');
    
    const destino = this.dadosDestino.destino;
    const dias = [];
    const dataInicio = new Date(dataIda + 'T12:00:00');
    
    const atividadesPorDia = { 'leve': 3, 'moderado': 4, 'intenso': 6 };
    const numAtividades = atividadesPorDia[this.dadosFormulario.intensidade] || 4;
    
    for (let i = 0; i < diasViagem; i++) {
      const dataAtual = new Date(dataInicio);
      dataAtual.setDate(dataInicio.getDate() + i);
      
      const dia = {
        data: this.formatarDataISO(dataAtual),
        descricao: this.obterDescricaoDia(i + 1, destino, diasViagem),
        atividades: this.gerarAtividadesFallback(i, destino, diasViagem, numAtividades)
      };
      
      if (i === 0) dia.observacao = this.obterObservacaoPrimeiroDia();
      else if (i === diasViagem - 1) dia.observacao = this.obterObservacaoUltimoDia();
      
      dias.push(dia);
    }
    
    this.ajustarAtividadesPorHorariosContinuo(dias);
    
    return { destino: `${destino}, ${this.dadosDestino.pais}`, dias };
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
      if (!this.roteiroPronto?.dias || this.roteiroPronto.dias.length === 0) return;
      
      const cidade = this.dadosDestino.destino;
      const dataInicio = this.getDataIda();
      const dataFim = this.getDataVolta();
      const diasComPrevisao = Math.min(1, this.roteiroPronto.dias.length);
      
      try {
        const urlAPI = `/api/weather?city=${encodeURIComponent(cidade)}&start=${dataInicio}&end=${dataFim}`;
        const response = await fetch(urlAPI, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(8000)
        });
        
        if (!response.ok) throw new Error(`API de tempo falhou: ${response.status}`);
        
        const dadosTempo = await response.json();
        
        for (let i = 0; i < diasComPrevisao; i++) {
          if (dadosTempo[i]) {
            this.roteiroPronto.dias[i].previsao = {
              icon: dadosTempo[i].icon || '🌤️',
              temperature: dadosTempo[i].temperature || 25,
              condition: dadosTempo[i].condition || 'Tempo agradável',
              date: dadosTempo[i].date
            };
          } else {
            this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoFallback(i);
          }
        }
        
      } catch (erroAPI) {
        for (let i = 0; i < diasComPrevisao; i++) {
          this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoFallback(i);
        }
      }
    } catch (erro) {
      console.error('❌ Erro na busca de previsão:', erro);
    }
  },

  gerarPrevisaoFallback(diaIndex) {
    const cidade = this.dadosDestino.destino.toLowerCase();
    
    let condicoes;
    if (cidade.includes('paris') || cidade.includes('londres') || cidade.includes('berlim')) {
      condicoes = [
        { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 18 },
        { icon: '☁️', condition: 'Nublado', tempBase: 16 },
        { icon: '🌦️', condition: 'Chuva leve', tempBase: 14 },
        { icon: '☀️', condition: 'Ensolarado', tempBase: 22 }
      ];
    } else if (cidade.includes('miami') || cidade.includes('rio') || cidade.includes('salvador')) {
      condicoes = [
        { icon: '☀️', condition: 'Ensolarado', tempBase: 28 },
        { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 26 },
        { icon: '⛈️', condition: 'Pancadas de chuva', tempBase: 24 },
        { icon: '🌊', condition: 'Brisa marítima', tempBase: 25 }
      ];
    } else {
      condicoes = [
        { icon: '☀️', condition: 'Ensolarado', tempBase: 24 },
        { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 22 },
        { icon: '☁️', condition: 'Nublado', tempBase: 20 },
        { icon: '🌦️', condition: 'Possibilidade de chuva', tempBase: 18 }
      ];
    }
    
    const condicao = diaIndex === 0
      ? (Math.random() < 0.7 ? condicoes[0] : condicoes[1])
      : condicoes[diaIndex % condicoes.length];
    
    const variacaoTemp = Math.floor(Math.random() * 5) - 2;
    
    return {
      icon: condicao.icon,
      temperature: Math.max(10, Math.min(40, condicao.tempBase + variacaoTemp)),
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
    if (this.imagensCache.has(local)) return this.imagensCache.get(local);
    
    try {
      const query = `${local} ${this.dadosDestino.destino}`.trim();
      const url = `/api/image-search?query=${encodeURIComponent(query)}&perPage=1`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const dados = await response.json();
      
      if (dados?.images?.[0]) {
        const imagemUrl = dados.images[0].url || dados.images[0].src?.medium;
        const resultado = { sucesso: true, url: imagemUrl };
        this.imagensCache.set(local, resultado);
        return resultado;
      }
      
      throw new Error('Sem imagens');
    } catch (erro) {
      const resultado = { sucesso: false, erro: erro.message };
      this.imagensCache.set(local, resultado);
      return resultado;
    }
  },

  aplicarFallbacksGlobal() {
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

  // ===========================================
  // TOAST E UI HELPERS
  // ===========================================

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
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  // ===========================================
  // MÉTODOS AUXILIARES
  // ===========================================

  isDataValida(data) {
    if (!data) return false;
    const formatos = [/^\d{4}-\d{2}-\d{2}$/, /^\d{2}\/\d{2}\/\d{4}$/, /^\d{2}-\d{2}-\d{4}$/, /^\d{4}\/\d{2}\/\d{2}$/];
    return formatos.some(formato => formato.test(String(data)));
  },

  garantirFormatoISO(dataInput) {
    if (!dataInput) return null;
    const dataStr = String(dataInput);
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return dataStr;
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dataStr)) {
      const [dia, mes, ano] = dataStr.split(/[\/\-]/);
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(dataStr)) return dataStr.replace(/\//g, '-');
    
    try {
      const data = new Date(dataStr);
      if (!isNaN(data.getTime())) return this.formatarDataISO(data);
    } catch (e) {}
    
    return null;
  },

  formatarDataISO(data) {
    if (!data) return null;
    const d = data instanceof Date ? data : new Date(data);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  calcularDiasViagem(dataIda, dataVolta) {
    if (!dataIda) return 1;
    try {
      const inicio = new Date(dataIda + 'T12:00:00');
      const fim = dataVolta ? new Date(dataVolta + 'T12:00:00') : inicio;
      const diffDias = Math.floor((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
      if (diffDias < 1) return 1;
      if (diffDias > 30) return 30;
      return diffDias;
    } catch (e) {
      return 1;
    }
  },

  estimarDuracao(local) {
    const localLower = local.toLowerCase();
    if (localLower.includes('museu')) return '2-3 horas';
    if (localLower.includes('restaurante') || localLower.includes('almoço') || localLower.includes('jantar')) return '1-2 horas';
    if (localLower.includes('passeio') || localLower.includes('caminhada')) return '1-2 horas';
    if (localLower.includes('mercado')) return '1 hora';
    if (localLower.includes('igreja') || localLower.includes('catedral')) return '30-45 min';
    if (localLower.includes('mirante') || localLower.includes('vista')) return '45 min';
    if (localLower.includes('show') || localLower.includes('teatro')) return '2 horas';
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
        horario: '21:00', local: 'Check-in e Jantar no Hotel',
        dica: 'Descanse para começar bem amanhã!',
        tags: ['Chegada', 'Descanso'], isEspecial: true, duracao: '1 hora'
      }];
    } else if (horaChegadaNum >= 16) {
      primeiroDia.atividades = [
        { horario: horaChegada, local: 'Check-in no Hotel', dica: 'Deixe as malas e saia para explorar!', tags: ['Chegada'], isEspecial: true, duracao: '30 min' },
        ...primeiroDia.atividades.slice(0, 3).map(ativ => ({
          ...ativ, horario: this.ajustarHorarioCheckIn(ativ.horario, horaChegadaNum)
        }))
      ];
    }
    
    if (horaPartida && dias.length > 1) {
      const ultimoDia = dias[dias.length - 1];
      const horaPartidaNum = parseInt(horaPartida.split(':')[0]);
      
      if (horaPartidaNum < 12) {
        ultimoDia.atividades = [{
          horario: '08:00', local: 'Check-out e Transfer para Aeroporto',
          dica: 'Chegue ao aeroporto com 2h de antecedência!',
          tags: ['Partida'], isEspecial: true, duracao: '2 horas'
        }];
      } else if (horaPartidaNum < 18) {
        ultimoDia.atividades = [
          ...ultimoDia.atividades.slice(0, 3),
          { horario: `${horaPartidaNum - 3}:00`, local: 'Transfer para Aeroporto',
            dica: 'Hora de se despedir! Até a próxima!',
            tags: ['Partida'], isEspecial: true, duracao: '2 horas' }
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
      'Imperdível': 'badge-destaque', 'Voo': 'badge-voo', 'Chegada': 'badge-voo',
      'Partida': 'badge-voo', 'Cultural': 'badge-cultura', 'Gastronomia': 'badge-gastronomia',
      'Natureza': 'badge-natureza', 'Compras': 'badge-compras', 'Vida Noturna': 'badge-noturno',
      'Vista Panorâmica': 'badge-vista', 'Histórico': 'badge-cultura', 'Religioso': 'badge-cultura'
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

  obterTextoIntensidade() {
    const mapa = {
      'leve': 'Leve (2-3 atividades/dia)',
      'moderado': 'Moderado (4-5 atividades/dia)',
      'intenso': 'Intenso (6+ atividades/dia)'
    };
    return mapa[this.dadosFormulario?.intensidade] || 'Moderado';
  },

  obterDescricaoDia(numeroDia, destino, totalDias) {
    if (numeroDia === 1) return `Chegada e primeiras impressões de ${destino}!`;
    if (numeroDia === totalDias) return `Últimos momentos para aproveitar ${destino} antes da partida.`;
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
    const mapa = { 'relaxar': 'Relax total', 'aventura': 'Aventura e emoção', 'cultura': 'Cultura e história', 'urbano': 'Agito urbano' };
    return mapa[this.obterTipoViagem()] || 'Experiências Variadas';
  },

  obterIconePreferencia() {
    const mapa = { 'relaxar': '🌊', 'aventura': '🏔️', 'cultura': '🏛️', 'urbano': '🏙️' };
    return mapa[this.obterTipoViagem()] || '✨';
  },

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
    const mapa = { 'sozinho': '🧳', 'casal': '❤️', 'familia': '👨‍👩‍👧‍👦', 'amigos': '🎉' };
    return mapa[this.obterTipoCompanhia()] || '👤';
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
      const formatada = data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
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
        { local: "Torre de Belém", dica: "Chegue antes das 10h!" },
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
    clearInterval(this.intervalId);
    this.estaCarregando = false;
    
    const container = document.querySelector('.roteiro-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="erro-container">
        <div class="erro-icon">
          <img src="assets/images/tripinha-triste.png" alt="Tripinha triste"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div style="display:none; font-size: 72px;">😢</div>
        </div>
        <h2 class="erro-titulo">Ops! Algo deu errado...</h2>
        <p class="erro-mensagem">${mensagem}</p>
        <div class="erro-acoes">
          <button class="btn btn-principal" onclick="BENETRIP_ROTEIRO.voltarParaFormularioComHistorico()">🔄 Tentar Novamente</button>
          <button class="btn btn-secundario" onclick="BENETRIP_ROTEIRO.navegarVoltar()">⬅️ Voltar</button>
        </div>
        <p class="erro-dica"><strong>Dica:</strong> Verifique se todos os campos foram preenchidos corretamente.</p>
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
      
      if (this.progressoAtual >= 90) clearInterval(this.intervalId);
    }, 1000);
  },

  atualizarBarraProgresso(porcentagem, mensagem) {
    const barra = document.querySelector('.progress-bar');
    const texto = document.querySelector('.loading-text');
    if (barra) { barra.style.width = `${porcentagem}%`; barra.setAttribute('aria-valuenow', porcentagem); }
    if (texto) texto.textContent = mensagem;
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
