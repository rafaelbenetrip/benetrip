/**
 * Benetrip - Formulário Manual CORRIGIDO
 * Versão: 2.0 - Integração REAL com itinerary.js
 * 
 * CORREÇÃO: Este arquivo agora foca APENAS no formulário
 * e usa o sistema completo do itinerary.js para gerar o roteiro
 */

const BENETRIP_MANUAL_FORM = {
  // Estado do formulário
  form: null,
  isSubmitting: false,
  
  /**
   * ✅ INICIALIZAÇÃO SIMPLES
   */
  init() {
    console.log('🚀 Benetrip Manual Form v2.0 - Integração Real');
    
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
    
    // Campo quantidade condicional
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
    
    dataIda?.addEventListener('change', this.validarDatas.bind(this));
    dataVolta?.addEventListener('change', this.validarDatas.bind(this));
  },
  
  /**
   * ✅ CONFIGURAÇÃO DE VALIDAÇÕES
   */
  configurarValidacoes() {
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    
    const dataIda = document.getElementById('data-ida');
    const dataVolta = document.getElementById('data-volta');
    
    if (dataIda) dataIda.min = amanha.toISOString().split('T')[0];
    if (dataVolta) dataVolta.min = amanha.toISOString().split('T')[0];
  },
  
  /**
   * ✅ PROCESSAR SUBMIT - VERSÃO CORRIGIDA
   */
  async processarSubmit() {
    console.log('📝 Processando submit do formulário...');
    
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
      
      // 1️⃣ COLETAR dados do formulário
      const dadosFormulario = this.coletarDadosFormulario();
      console.log('✅ Dados coletados:', dadosFormulario);
      
      // 2️⃣ CONVERTER para formato esperado pelo sistema
      const dadosConvertidos = this.converterParaFormatoSistema(dadosFormulario);
      console.log('✅ Dados convertidos:', dadosConvertidos);
      
      // 3️⃣ SALVAR no localStorage
      this.salvarDadosNoLocalStorage(dadosConvertidos);
      console.log('✅ Dados salvos no localStorage');
      
      // 4️⃣ ESCONDER formulário
      this.esconderFormulario();
      
      // 5️⃣ ✨ USAR O SISTEMA REAL do itinerary.js ✨
      await this.iniciarSistemaRoteiroReal();
      
    } catch (erro) {
      console.error('❌ Erro ao processar formulário:', erro);
      this.exibirToast('Ocorreu um erro ao criar seu roteiro. Tente novamente.', 'error');
      this.isSubmitting = false;
      this.mostrarFormulario();
    }
  },
  
  /**
   * ✅ ✨ INICIAR SISTEMA REAL - CORREÇÃO PRINCIPAL ✨
   */
  async iniciarSistemaRoteiroReal() {
    try {
      console.log('🚀 Iniciando sistema REAL de roteiro...');
      
      // Verificar se o sistema de roteiro está disponível
      if (typeof window.BENETRIP_ROTEIRO === 'undefined') {
        throw new Error('Sistema de roteiro não carregado. Inclua itinerary.js');
      }
      
      // Resetar estado do sistema de roteiro
      window.BENETRIP_ROTEIRO.estaCarregando = true;
      window.BENETRIP_ROTEIRO.progressoAtual = 10;
      window.BENETRIP_ROTEIRO.roteiroPronto = null;
      
      // ✨ INICIAR O SISTEMA COMPLETO ✨
      // Isso vai usar todas as 1621 linhas do itinerary.js:
      // - Buscar imagens reais via API
      // - Gerar roteiro com IA
      // - Aplicar previsão do tempo
      // - Renderizar UI completa
      // - Sistema de cache e lazy loading
      await window.BENETRIP_ROTEIRO.init();
      
      console.log('✅ Sistema REAL de roteiro iniciado com sucesso');
      
      // Mostrar botões de ação após roteiro estar pronto
      setTimeout(() => {
        const botoesAcao = document.querySelector('.botao-acoes-fixo');
        if (botoesAcao) {
          botoesAcao.style.display = 'flex';
        }
      }, 3000);
      
    } catch (erro) {
      console.error('❌ Erro ao iniciar sistema de roteiro:', erro);
      this.exibirToast('Erro interno do sistema. Recarregue a página.', 'error');
      throw erro;
    } finally {
      this.isSubmitting = false;
    }
  },
  
  /**
   * ✅ COLETAR DADOS DO FORMULÁRIO (sem mudanças)
   */
  coletarDadosFormulario() {
    const formData = new FormData(this.form);
    const dados = {};
    
    dados.destino = formData.get('destino')?.trim();
    dados.dataIda = formData.get('data_ida');
    dados.dataVolta = formData.get('data_volta') || null;
    dados.horarioChegada = formData.get('horario_chegada');
    dados.horarioPartida = formData.get('horario_partida') || '21:00';
    dados.companhia = parseInt(formData.get('companhia'));
    dados.preferencias = parseInt(formData.get('preferencias'));
    dados.intensidade = formData.get('intensidade');
    dados.orcamento = formData.get('orcamento');
    dados.quantidade = formData.get('quantidade') ? parseInt(formData.get('quantidade')) : 1;
    
    return dados;
  },
  
  /**
   * ✅ CONVERTER PARA FORMATO DO SISTEMA (sem mudanças)
   */
  converterParaFormatoSistema(dados) {
    const destinoPartes = this.extrairCidadePais(dados.destino);
    
    const dadosVoo = {
      infoIda: {
        dataPartida: dados.dataIda,
        horaChegada: dados.horarioChegada,
        aeroportoChegada: this.tentarExtrairCodigoIATA(destinoPartes.cidade)
      },
      infoVolta: dados.dataVolta ? {
        dataPartida: dados.dataVolta,
        horaPartida: dados.horarioPartida,
        aeroportoPartida: this.tentarExtrairCodigoIATA(destinoPartes.cidade)
      } : null,
      origem: 'Manual',
      destino: destinoPartes.cidade
    };
    
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
    
    const dadosDestino = {
      destino: destinoPartes.cidade,
      pais: destinoPartes.pais,
      codigo_iata: this.tentarExtrairCodigoIATA(destinoPartes.cidade),
      origem: 'manual'
    };
    
    return {
      voo: dadosVoo,
      usuario: dadosUsuario,
      destino: dadosDestino
    };
  },
  
  /**
   * ✅ TENTAR EXTRAIR CÓDIGO IATA (melhorado)
   */
  tentarExtrairCodigoIATA(cidade) {
    const mapeamento = {
      'lisboa': 'LIS',
      'porto': 'OPO', 
      'madrid': 'MAD',
      'barcelona': 'BCN',
      'paris': 'CDG',
      'londres': 'LHR',
      'roma': 'FCO',
      'amsterdam': 'AMS',
      'berlin': 'BER',
      'munique': 'MUC',
      'viena': 'VIE',
      'zurich': 'ZUR',
      'dublin': 'DUB',
      'estocolmo': 'ARN',
      'copenhague': 'CPH',
      'oslo': 'OSL',
      'helsinque': 'HEL',
      'praga': 'PRG',
      'budapeste': 'BUD',
      'varsovia': 'WAW',
      'sao paulo': 'GRU',
      'rio de janeiro': 'GIG',
      'brasilia': 'BSB',
      'salvador': 'SSA',
      'recife': 'REC',
      'fortaleza': 'FOR',
      'belo horizonte': 'CNF',
      'curitiba': 'CWB',
      'porto alegre': 'POA',
      'florianopolis': 'FLN',
      'nova york': 'JFK',
      'los angeles': 'LAX',
      'chicago': 'ORD',
      'miami': 'MIA',
      'toronto': 'YYZ',
      'mexico': 'MEX',
      'buenos aires': 'EZE',
      'santiago': 'SCL',
      'lima': 'LIM',
      'bogota': 'BOG',
      'caracas': 'CCS',
      'montevideu': 'MVD',
      'toquio': 'NRT',
      'pequim': 'PEK',
      'xangai': 'PVG',
      'hong kong': 'HKG',
      'singapura': 'SIN',
      'bangkok': 'BKK',
      'dubai': 'DXB',
      'sidney': 'SYD',
      'melbourne': 'MEL'
    };
    
    const cidadeLower = cidade.toLowerCase()
      .replace(/á/g, 'a').replace(/ã/g, 'a').replace(/â/g, 'a')
      .replace(/é/g, 'e').replace(/ê/g, 'e')
      .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ô/g, 'o')
      .replace(/ú/g, 'u').replace(/ç/g, 'c');
    
    return mapeamento[cidadeLower] || 'XXX';
  },
  
  /**
   * ✅ SALVAR DADOS NO LOCALSTORAGE (sem mudanças)
   */
  salvarDadosNoLocalStorage(dados) {
    try {
      localStorage.setItem('benetrip_voo_selecionado', JSON.stringify(dados.voo));
      localStorage.setItem('benetrip_user_data', JSON.stringify(dados.usuario));
      localStorage.setItem('benetrip_destino_selecionado', JSON.stringify(dados.destino));
      localStorage.setItem('benetrip_origem_manual', 'true');
      
      console.log('✅ Dados salvos no localStorage com sucesso');
    } catch (erro) {
      console.error('❌ Erro ao salvar no localStorage:', erro);
      throw new Error('Falha ao salvar dados localmente');
    }
  },
  
  /**
   * ✅ ESCONDER FORMULÁRIO (simplificado)
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
   * ✅ MOSTRAR FORMULÁRIO (caso de erro)
   */
  mostrarFormulario() {
    const formularioContainer = document.querySelector('.formulario-container');
    if (formularioContainer) {
      formularioContainer.classList.remove('hidden');
    }
    
    const titulo = document.querySelector('.app-header h1');
    if (titulo) {
      titulo.textContent = 'Criar Roteiro';
    }
  },
  
  // ===============================================
  // MÉTODOS DE VALIDAÇÃO (sem mudanças significativas)
  // ===============================================
  
  atualizarCampoQuantidade() {
    const companhiaSelecionada = document.querySelector('input[name="companhia"]:checked');
    const quantidadeGroup = document.getElementById('quantidade-group');
    const quantidadeSelect = document.getElementById('quantidade');
    
    if (!companhiaSelecionada || !quantidadeGroup) return;
    
    const valor = parseInt(companhiaSelecionada.value);
    
    if (valor === 2 || valor === 3) {
      quantidadeGroup.style.display = 'block';
      quantidadeGroup.classList.add('show');
      quantidadeSelect.required = true;
    } else {
      quantidadeGroup.style.display = 'none';
      quantidadeGroup.classList.remove('show');
      quantidadeSelect.required = false;
    }
  },
  
  validarDatas() {
    const dataIda = document.getElementById('data-ida');
    const dataVolta = document.getElementById('data-volta');
    
    if (!dataIda.value) return true;
    
    const hoje = new Date();
    const dataIdaObj = new Date(dataIda.value);
    
    if (dataIdaObj < hoje) {
      this.mostrarErro('datas', 'A data de ida não pode ser no passado.');
      return false;
    }
    
    if (dataIda.value) {
      const dataIdaPlus1 = new Date(dataIdaObj);
      dataIdaPlus1.setDate(dataIdaObj.getDate() + 1);
      dataVolta.min = dataIdaPlus1.toISOString().split('T')[0];
    }
    
    if (dataVolta.value) {
      const dataVoltaObj = new Date(dataVolta.value);
      
      if (dataVoltaObj <= dataIdaObj) {
        this.mostrarErro('datas', 'A data de volta deve ser posterior à data de ida.');
        return false;
      }
      
      const diffDias = Math.ceil((dataVoltaObj - dataIdaObj) / (1000 * 60 * 60 * 24));
      if (diffDias > 30) {
        this.mostrarErro('datas', 'A viagem não pode ter mais de 30 dias.');
        return false;
      }
    }
    
    this.limparErro(dataIda);
    return true;
  },
  
  validarFormulario() {
    let formularioValido = true;
    
    // Validar destino
    const destino = document.getElementById('destino').value.trim();
    if (!destino || destino.length < 3) {
      this.mostrarErro('destino', 'Por favor, informe um destino válido.');
      formularioValido = false;
    }
    
    // Validar data de ida
    const dataIda = document.getElementById('data-ida').value;
    if (!dataIda) {
      this.mostrarErro('datas', 'Por favor, informe a data de ida.');
      formularioValido = false;
    } else if (!this.validarDatas()) {
      formularioValido = false;
    }
    
    // Validar radio buttons
    const gruposRadio = ['companhia', 'preferencias', 'intensidade', 'orcamento'];
    gruposRadio.forEach(grupo => {
      const selecionado = document.querySelector(`input[name="${grupo}"]:checked`);
      if (!selecionado) {
        this.mostrarErro(grupo, `Por favor, selecione uma opção.`);
        formularioValido = false;
      }
    });
    
    return formularioValido;
  },
  
  // ===============================================
  // MÉTODOS AUXILIARES (mantidos)
  // ===============================================
  
  extrairCidadePais(destinoCompleto) {
    const partes = destinoCompleto.split(',').map(p => p.trim());
    
    if (partes.length >= 2) {
      return {
        cidade: partes[0],
        pais: partes.slice(1).join(', ')
      };
    }
    
    return {
      cidade: destinoCompleto,
      pais: 'Internacional'
    };
  },
  
  estimarOrcamentoValor(nivelOrcamento) {
    const valores = {
      'economico': 500,
      'medio': 1500,
      'alto': 5000
    };
    return valores[nivelOrcamento] || 1500;
  },
  
  validarCampo(campo) {
    // Implementação simplificada de validação individual
    const nome = campo.name || campo.id;
    this.limparErro(campo);
    return true;
  },
  
  mostrarErro(campo, mensagem) {
    const errorElement = document.getElementById(`${campo}-error`);
    if (errorElement) {
      errorElement.textContent = mensagem;
      errorElement.classList.add('show');
    }
  },
  
  limparErro(campo) {
    const nome = campo.name || campo.id;
    const errorElement = document.getElementById(`${nome}-error`) || 
                        document.getElementById(`${nome.replace('_', '')}-error`);
    
    if (errorElement) {
      errorElement.classList.remove('show');
    }
  },
  
  exibirToast(mensagem, tipo = 'info') {
    // Implementação simplificada de toast
    console.log(`${tipo.toUpperCase()}: ${mensagem}`);
    
    // Criar toast se não existir sistema
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
        z-index: 1000; width: 90%; max-width: 400px; pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    const icones = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    
    toast.style.cssText = `
      background: white; padding: 16px; margin-bottom: 8px; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 12px;
      border-left: 4px solid ${tipo === 'error' ? '#f44336' : '#2196F3'};
      opacity: 0; transform: translateY(-20px); transition: all 0.3s ease;
      pointer-events: auto; font-size: 14px; color: #333;
    `;
    
    toast.innerHTML = `
      <span style="font-size: 18px;">${icones[tipo] || icones.info}</span>
      <span>${mensagem}</span>
    `;
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};

// ===========================================
// INICIALIZAÇÃO DO SISTEMA
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('form-roteiro-manual')) {
    console.log('📄 Página de formulário manual detectada');
    document.body.classList.add('pagina-formulario-manual');
    BENETRIP_MANUAL_FORM.init();
  }
});

window.BENETRIP_MANUAL_FORM = BENETRIP_MANUAL_FORM;
