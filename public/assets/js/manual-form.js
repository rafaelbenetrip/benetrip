/**
 * Benetrip - Sistema de Formulário Manual para Roteiros
 * Versão: 1.0 - Integração com sistema de roteiro existente
 */

const BENETRIP_MANUAL_FORM = {
  // Estado do formulário
  form: null,
  isSubmitting: false,
  
  /**
   * ✅ INICIALIZAÇÃO
   */
  init() {
    console.log('🚀 Benetrip Manual Form v1.0 - Iniciando');
    
    this.form = document.getElementById('form-roteiro-manual');
    if (!this.form) {
      console.warn('⚠️ Formulário não encontrado');
      return;
    }
    
    this.configurarEventos();
    this.configurarValidacoes();
    console.log('✅ Formulário manual configurado');
  },
  
  /**
   * ✅ CONFIGURAÇÃO DE EVENTOS
   */
  configurarEventos() {
    // Submit do formulário
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.processarSubmit();
    });
    
    // Mostrar/esconder campo quantidade baseado na companhia
    const companhiaRadios = document.querySelectorAll('input[name="companhia"]');
    companhiaRadios.forEach(radio => {
      radio.addEventListener('change', this.atualizarCampoQuantidade.bind(this));
    });
    
    // Validação em tempo real
    const inputs = this.form.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('blur', () => this.validarCampo(input));
      input.addEventListener('input', () => this.limparErro(input));
    });
    
    // Validação de datas
    const dataIda = document.getElementById('data-ida');
    const dataVolta = document.getElementById('data-volta');
    
    dataIda.addEventListener('change', this.validarDatas.bind(this));
    dataVolta.addEventListener('change', this.validarDatas.bind(this));
    
    // Botão voltar
    const btnVoltar = document.querySelector('.btn-voltar');
    if (btnVoltar) {
      btnVoltar.addEventListener('click', () => {
        if (this.isSubmitting) {
          const confirm = window.confirm('Você tem certeza? Seu roteiro será perdido.');
          if (!confirm) return;
        }
        history.back();
      });
    }
  },
  
  /**
   * ✅ CONFIGURAÇÃO DE VALIDAÇÕES
   */
  configurarValidacoes() {
    // Configurar datas mínimas
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    
    const dataIda = document.getElementById('data-ida');
    const dataVolta = document.getElementById('data-volta');
    
    if (dataIda) {
      dataIda.min = amanha.toISOString().split('T')[0];
    }
    
    if (dataVolta) {
      dataVolta.min = amanha.toISOString().split('T')[0];
    }
  },
  
  /**
   * ✅ ATUALIZAR CAMPO QUANTIDADE
   */
  atualizarCampoQuantidade() {
    const companhiaSelecionada = document.querySelector('input[name="companhia"]:checked');
    const quantidadeGroup = document.getElementById('quantidade-group');
    const quantidadeSelect = document.getElementById('quantidade');
    
    if (!companhiaSelecionada || !quantidadeGroup) return;
    
    const valor = parseInt(companhiaSelecionada.value);
    
    // Mostrar quantidade para família (2) e amigos (3)
    if (valor === 2 || valor === 3) {
      quantidadeGroup.style.display = 'block';
      quantidadeGroup.classList.add('show');
      quantidadeSelect.required = true;
      
      // Ajustar opções baseado no tipo
      if (valor === 2) { // Família
        quantidadeSelect.innerHTML = `
          <option value="2">2 pessoas</option>
          <option value="3">3 pessoas</option>
          <option value="4" selected>4 pessoas</option>
          <option value="5">5 pessoas</option>
          <option value="6">6 pessoas</option>
          <option value="7">7 pessoas</option>
          <option value="8">8 pessoas</option>
        `;
      } else { // Amigos
        quantidadeSelect.innerHTML = `
          <option value="2">2 pessoas</option>
          <option value="3">3 pessoas</option>
          <option value="4">4 pessoas</option>
          <option value="5">5 pessoas</option>
          <option value="6">6 pessoas</option>
          <option value="7">7 pessoas</option>
          <option value="8">8 pessoas</option>
          <option value="9">9 pessoas</option>
          <option value="10" selected>10 pessoas</option>
        `;
      }
    } else {
      quantidadeGroup.style.display = 'none';
      quantidadeGroup.classList.remove('show');
      quantidadeSelect.required = false;
    }
  },
  
  /**
   * ✅ VALIDAR DATAS
   */
  validarDatas() {
    const dataIda = document.getElementById('data-ida');
    const dataVolta = document.getElementById('data-volta');
    
    if (!dataIda.value) return;
    
    const hoje = new Date();
    const dataIdaObj = new Date(dataIda.value);
    
    // Validar se data de ida não é no passado
    if (dataIdaObj < hoje) {
      this.mostrarErro('datas', 'A data de ida não pode ser no passado.');
      return false;
    }
    
    // Ajustar data mínima de volta
    if (dataIda.value) {
      const dataIdaPlus1 = new Date(dataIdaObj);
      dataIdaPlus1.setDate(dataIdaObj.getDate() + 1);
      dataVolta.min = dataIdaPlus1.toISOString().split('T')[0];
    }
    
    // Validar se data de volta é posterior à ida
    if (dataVolta.value) {
      const dataVoltaObj = new Date(dataVolta.value);
      
      if (dataVoltaObj <= dataIdaObj) {
        this.mostrarErro('datas', 'A data de volta deve ser posterior à data de ida.');
        return false;
      }
      
      // Verificar se viagem não é muito longa (máximo 30 dias)
      const diffDias = Math.ceil((dataVoltaObj - dataIdaObj) / (1000 * 60 * 60 * 24));
      if (diffDias > 30) {
        this.mostrarErro('datas', 'A viagem não pode ter mais de 30 dias.');
        return false;
      }
    }
    
    this.limparErro(dataIda);
    return true;
  },
  
  /**
   * ✅ VALIDAR CAMPO INDIVIDUAL
   */
  validarCampo(campo) {
    const nome = campo.name || campo.id;
    let valido = true;
    
    // Limpar erro anterior
    this.limparErro(campo);
    
    // Validações específicas
    switch (nome) {
      case 'destino':
        if (!campo.value.trim()) {
          this.mostrarErro(nome, 'Por favor, informe o destino da viagem.');
          valido = false;
        } else if (campo.value.trim().length < 3) {
          this.mostrarErro(nome, 'O destino deve ter pelo menos 3 caracteres.');
          valido = false;
        }
        break;
        
      case 'data_ida':
        if (!campo.value) {
          this.mostrarErro('datas', 'Por favor, informe a data de ida.');
          valido = false;
        } else {
          valido = this.validarDatas();
        }
        break;
        
      case 'horario_chegada':
        if (!campo.value) {
          this.mostrarErro('datas', 'Por favor, informe o horário de chegada.');
          valido = false;
        }
        break;
        
      case 'companhia':
        const companhiaSelecionada = document.querySelector('input[name="companhia"]:checked');
        if (!companhiaSelecionada) {
          this.mostrarErro('companhia', 'Por favor, selecione com quem você vai viajar.');
          valido = false;
        }
        break;
        
      case 'preferencias':
        const preferenciasSelecionada = document.querySelector('input[name="preferencias"]:checked');
        if (!preferenciasSelecionada) {
          this.mostrarErro('preferencias', 'Por favor, selecione suas preferências de viagem.');
          valido = false;
        }
        break;
        
      case 'intensidade':
        const intensidadeSelecionada = document.querySelector('input[name="intensidade"]:checked');
        if (!intensidadeSelecionada) {
          this.mostrarErro('intensidade', 'Por favor, selecione a intensidade do roteiro.');
          valido = false;
        }
        break;
        
      case 'orcamento':
        const orcamentoSelecionado = document.querySelector('input[name="orcamento"]:checked');
        if (!orcamentoSelecionado) {
          this.mostrarErro('orcamento', 'Por favor, selecione seu orçamento.');
          valido = false;
        }
        break;
    }
    
    // Adicionar classe visual
    if (valido) {
      campo.classList.remove('invalid');
      campo.classList.add('valid');
    } else {
      campo.classList.remove('valid');
      campo.classList.add('invalid');
    }
    
    return valido;
  },
  
  /**
   * ✅ VALIDAR FORMULÁRIO COMPLETO
   */
  validarFormulario() {
    let formularioValido = true;
    
    // Validar campos obrigatórios
    const camposObrigatorios = [
      'destino',
      'data_ida',
      'horario_chegada'
    ];
    
    camposObrigatorios.forEach(nome => {
      const campo = document.querySelector(`[name="${nome}"], #${nome}`);
      if (campo && !this.validarCampo(campo)) {
        formularioValido = false;
      }
    });
    
    // Validar radio buttons
    const gruposRadio = ['companhia', 'preferencias', 'intensidade', 'orcamento'];
    
    gruposRadio.forEach(grupo => {
      const selecionado = document.querySelector(`input[name="${grupo}"]:checked`);
      if (!selecionado) {
        this.mostrarErro(grupo, `Por favor, selecione uma opção para ${grupo}.`);
        formularioValido = false;
      }
    });
    
    // Validar quantidade se necessário
    const companhiaSelecionada = document.querySelector('input[name="companhia"]:checked');
    if (companhiaSelecionada) {
      const valor = parseInt(companhiaSelecionada.value);
      if ((valor === 2 || valor === 3)) {
        const quantidade = document.getElementById('quantidade');
        if (!quantidade.value) {
          this.mostrarErro('companhia', 'Por favor, informe a quantidade de pessoas.');
          formularioValido = false;
        }
      }
    }
    
    return formularioValido;
  },
  
  /**
   * ✅ MOSTRAR ERRO
   */
  mostrarErro(campo, mensagem) {
    const errorElement = document.getElementById(`${campo}-error`);
    if (errorElement) {
      errorElement.textContent = mensagem;
      errorElement.classList.add('show');
    }
    
    // Adicionar classe visual aos radio groups
    if (['companhia', 'preferencias', 'intensidade', 'orcamento'].includes(campo)) {
      const radioGroup = document.querySelector(`input[name="${campo}"]`)?.closest('.radio-group');
      if (radioGroup) {
        radioGroup.classList.add('invalid');
      }
    }
  },
  
  /**
   * ✅ LIMPAR ERRO
   */
  limparErro(campo) {
    const nome = campo.name || campo.id;
    const errorElement = document.getElementById(`${nome}-error`) || 
                        document.getElementById(`${nome.replace('_', '')}-error`);
    
    if (errorElement) {
      errorElement.classList.remove('show');
    }
    
    // Remover classe visual dos radio groups
    const radioGroup = campo.closest?.('.radio-group');
    if (radioGroup) {
      radioGroup.classList.remove('invalid');
    }
  },
  
  /**
   * ✅ PROCESSAR SUBMIT DO FORMULÁRIO
   */
  async processarSubmit() {
    console.log('📝 Processando submit do formulário...');
    
    // Prevenir múltiplos submits
    if (this.isSubmitting) {
      console.warn('⚠️ Formulário já está sendo processado');
      return;
    }
    
    // Validar formulário
    if (!this.validarFormulario()) {
      console.warn('⚠️ Formulário inválido');
      this.exibirToast('Por favor, corrija os erros antes de continuar.', 'error');
      return;
    }
    
    try {
      this.isSubmitting = true;
      this.mostrarCarregamento();
      
      // Coletar dados do formulário
      const dadosFormulario = this.coletarDadosFormulario();
      console.log('✅ Dados coletados:', dadosFormulario);
      
      // Converter para formato esperado pelo sistema
      const dadosConvertidos = this.converterParaFormatoSistema(dadosFormulario);
      console.log('✅ Dados convertidos:', dadosConvertidos);
      
      // Salvar no localStorage
      this.salvarDadosNoLocalStorage(dadosConvertidos);
      console.log('✅ Dados salvos no localStorage');
      
      // Aguardar um pouco para mostrar o loading
      await this.delay(1000);
      
      // Esconder formulário e iniciar geração de roteiro
      this.esconderFormulario();
      
      // Aguardar mais um pouco antes de iniciar o roteiro
      await this.delay(500);
      
      // Iniciar sistema de roteiro
      this.iniciarSistemaRoteiro();
      
    } catch (erro) {
      console.error('❌ Erro ao processar formulário:', erro);
      this.exibirToast('Ocorreu um erro ao criar seu roteiro. Tente novamente.', 'error');
      this.esconderCarregamento();
      this.isSubmitting = false;
    }
  },
  
  /**
   * ✅ COLETAR DADOS DO FORMULÁRIO
   */
  coletarDadosFormulario() {
    const formData = new FormData(this.form);
    const dados = {};
    
    // Campos básicos
    dados.destino = formData.get('destino')?.trim();
    dados.dataIda = formData.get('data_ida');
    dados.dataVolta = formData.get('data_volta') || null;
    dados.horarioChegada = formData.get('horario_chegada');
    dados.horarioPartida = formData.get('horario_partida') || '21:00';
    
    // Radio buttons
    dados.companhia = parseInt(formData.get('companhia'));
    dados.preferencias = parseInt(formData.get('preferencias'));
    dados.intensidade = formData.get('intensidade');
    dados.orcamento = formData.get('orcamento');
    
    // Quantidade condicional
    dados.quantidade = formData.get('quantidade') ? parseInt(formData.get('quantidade')) : 1;
    
    return dados;
  },
  
  /**
   * ✅ CONVERTER PARA FORMATO DO SISTEMA
   */
  converterParaFormatoSistema(dados) {
    // Extrair cidade e país do destino
    const destinoPartes = this.extrairCidadePais(dados.destino);
    
    // Dados do voo (simulados baseados no input do usuário)
    const dadosVoo = {
      infoIda: {
        dataPartida: dados.dataIda,
        horaChegada: dados.horarioChegada,
        aeroportoChegada: 'XXX' // Será resolvido pelo sistema
      },
      infoVolta: dados.dataVolta ? {
        dataPartida: dados.dataVolta,
        horaPartida: dados.horarioPartida,
        aeroportoPartida: 'XXX'
      } : null,
      origem: 'Manual',
      destino: destinoPartes.cidade
    };
    
    // Dados do usuário
    const dadosUsuario = {
      respostas: {
        companhia: dados.companhia,
        quantidade_familia: dados.companhia === 2 ? dados.quantidade : undefined,
        quantidade_amigos: dados.companhia === 3 ? dados.quantidade : undefined,
        estilo_viagem_destino: dados.preferencias,
        preferencia_viagem: dados.preferencias,
        tipo_viagem: dados.preferencias,
        intensidade_roteiro: dados.intensidade,
        orcamento_nivel: dados.orcamento,
        orcamento_valor: this.estimarOrcamentoValor(dados.orcamento),
        datas: {
          dataIda: dados.dataIda,
          dataVolta: dados.dataVolta
        }
      }
    };
    
    // Dados do destino
    const dadosDestino = {
      destino: destinoPartes.cidade,
      pais: destinoPartes.pais,
      codigo_iata: 'XXX', // Será resolvido pelo sistema
      origem: 'manual'
    };
    
    return {
      voo: dadosVoo,
      usuario: dadosUsuario,
      destino: dadosDestino
    };
  },
  
  /**
   * ✅ EXTRAIR CIDADE E PAÍS DO DESTINO
   */
  extrairCidadePais(destinoCompleto) {
    // Tentar extrair cidade e país do formato "Cidade, País"
    const partes = destinoCompleto.split(',').map(p => p.trim());
    
    if (partes.length >= 2) {
      return {
        cidade: partes[0],
        pais: partes.slice(1).join(', ')
      };
    }
    
    // Se não tiver vírgula, assumir que é só a cidade
    return {
      cidade: destinoCompleto,
      pais: 'Internacional'
    };
  },
  
  /**
   * ✅ ESTIMAR ORÇAMENTO VALOR
   */
  estimarOrcamentoValor(nivelOrcamento) {
    const valores = {
      'economico': 500,
      'medio': 1500,
      'alto': 5000
    };
    
    return valores[nivelOrcamento] || 1500;
  },
  
  /**
   * ✅ SALVAR DADOS NO LOCALSTORAGE
   */
  salvarDadosNoLocalStorage(dados) {
    try {
      localStorage.setItem('benetrip_voo_selecionado', JSON.stringify(dados.voo));
      localStorage.setItem('benetrip_user_data', JSON.stringify(dados.usuario));
      localStorage.setItem('benetrip_destino_selecionado', JSON.stringify(dados.destino));
      
      // Adicionar flag indicando origem manual
      localStorage.setItem('benetrip_origem_manual', 'true');
      
      console.log('✅ Dados salvos no localStorage com sucesso');
    } catch (erro) {
      console.error('❌ Erro ao salvar no localStorage:', erro);
      throw new Error('Falha ao salvar dados localmente');
    }
  },
  
  /**
   * ✅ MOSTRAR CARREGAMENTO
   */
  mostrarCarregamento() {
    const btnSubmit = document.getElementById('btn-criar-roteiro');
    const loading = document.getElementById('loading-inicial');
    
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.classList.add('loading');
    }
    
    // Mostrar loading principal após um delay para transição suave
    setTimeout(() => {
      if (loading) {
        loading.style.display = 'flex';
      }
    }, 500);
  },
  
  /**
   * ✅ ESCONDER CARREGAMENTO
   */
  esconderCarregamento() {
    const btnSubmit = document.getElementById('btn-criar-roteiro');
    const loading = document.getElementById('loading-inicial');
    
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove('loading');
    }
    
    if (loading) {
      loading.style.display = 'none';
    }
  },
  
  /**
   * ✅ ESCONDER FORMULÁRIO
   */
  esconderFormulario() {
    const formularioContainer = document.querySelector('.formulario-container');
    
    if (formularioContainer) {
      formularioContainer.classList.add('hidden');
    }
    
    // Atualizar título da página
    const titulo = document.querySelector('.app-header h1');
    if (titulo) {
      const destino = document.getElementById('destino').value.split(',')[0].trim();
      titulo.textContent = `Seu Roteiro para ${destino}`;
    }
  },
  
  /**
   * ✅ INICIAR SISTEMA DE ROTEIRO
   */
  iniciarSistemaRoteiro() {
    try {
      console.log('🚀 Iniciando sistema de roteiro...');
      
      // Verificar se o sistema de roteiro está disponível
      if (typeof window.BENETRIP_ROTEIRO !== 'undefined') {
        // Resetar estado do sistema de roteiro
        window.BENETRIP_ROTEIRO.estaCarregando = true;
        window.BENETRIP_ROTEIRO.progressoAtual = 10;
        
        // Iniciar o sistema
        window.BENETRIP_ROTEIRO.init();
        
        console.log('✅ Sistema de roteiro iniciado com sucesso');
        
        // Mostrar botões de ação
        setTimeout(() => {
          const botoesAcao = document.querySelector('.botao-acoes-fixo');
          if (botoesAcao) {
            botoesAcao.style.display = 'flex';
          }
        }, 3000);
        
      } else {
        throw new Error('Sistema de roteiro não encontrado');
      }
      
    } catch (erro) {
      console.error('❌ Erro ao iniciar sistema de roteiro:', erro);
      this.exibirToast('Erro interno do sistema. Recarregue a página.', 'error');
    } finally {
      this.isSubmitting = false;
    }
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
   * ✅ DELAY HELPER
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// ===========================================
// INICIALIZAÇÃO DO SISTEMA
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  // Verificar se estamos na página correta
  if (document.getElementById('form-roteiro-manual')) {
    console.log('📄 Página de formulário manual detectada');
    
    // Adicionar classe ao body
    document.body.classList.add('pagina-formulario-manual');
    
    // Iniciar sistema de formulário
    BENETRIP_MANUAL_FORM.init();
  }
});

// Tornar disponível globalmente para debug
window.BENETRIP_MANUAL_FORM = BENETRIP_MANUAL_FORM;

// Prevenir carregamento duplo
if (window.BENETRIP_MANUAL_FORM_LOADED) {
  console.warn('⚠️ Módulo de formulário manual já foi carregado');
} else {
  window.BENETRIP_MANUAL_FORM_LOADED = true;
}
