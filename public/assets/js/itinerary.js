/**
 * Benetrip - Sistema de Roteiro Personalizado (VERSÃO COMPLETA COM HORÁRIOS INTELIGENTES)
 * Responsável por gerar e exibir roteiros personalizados de viagem
 * Versão: 4.0 - Com correções de datas + horários inteligentes de voo
 */

// Inicialização do módulo de roteiro
const BENETRIP_ROTEIRO = {
  // --- Constantes ---
  PERIODO_MANHA_INICIO: 6,
  PERIODO_MANHA_FIM: 12,
  PERIODO_TARDE_INICIO: 12,
  PERIODO_TARDE_FIM: 18,
  PERIODO_NOITE_INICIO: 18,
  PERIODO_NOITE_FIM: 23,
  MAX_DIAS_VIAGEM: 30,
  
  // --- Estado ---
  dadosVoo: null,
  dadosUsuario: null,
  dadosDestino: null,
  roteiroPronto: null,
  estaCarregando: true,
  progressoAtual: 10,
  intervalId: null,
  
  /**
   * Inicializa o sistema de roteiro
   */
  init() {
    console.log('🚀 Inicializando sistema de roteiro...');
    this.carregarDados()
      .then(() => this.gerarRoteiro())
      .catch(erro => {
        console.error('❌ Erro ao inicializar roteiro:', erro);
        this.mostrarErro('Erro ao carregar dados. Tente novamente mais tarde.');
      });
    
    // Configurar botões
    document.getElementById('btn-compartilhar-roteiro')?.addEventListener('click', () => this.compartilharRoteiro());
    document.getElementById('btn-editar-roteiro')?.addEventListener('click', () => this.editarRoteiro());
    document.querySelector('.btn-voltar')?.addEventListener('click', () => history.back());
    
    // Iniciar animação de progresso simulado
    this.iniciarAnimacaoProgresso();
  },
  
  /**
   * ✅ FUNÇÃO CORRIGIDA: Carrega os dados necessários para o roteiro
   */
  async carregarDados() {
    try {
      console.log('🔄 Carregando dados para roteiro...');
      
      // 1. PRIORIDADE: Carregar dados do voo selecionado
      const vooString = localStorage.getItem('benetrip_voo_selecionado');
      if (!vooString) {
        throw new Error('Nenhum voo selecionado. Selecione um voo primeiro.');
      }
      
      this.dadosVoo = JSON.parse(vooString);
      console.log('✅ Dados do voo carregados:', this.dadosVoo);
      
      // 2. Carregar dados do usuário
      const usuarioString = localStorage.getItem('benetrip_user_data');
      if (usuarioString) {
        this.dadosUsuario = JSON.parse(usuarioString);
        console.log('✅ Dados do usuário carregados:', this.dadosUsuario);
      } else {
        console.warn('⚠️ Dados do usuário não encontrados.');
        this.dadosUsuario = {};
      }
      
      // 3. Carregar dados do destino
      const destinoString = localStorage.getItem('benetrip_destino_selecionado');
      if (destinoString) {
        this.dadosDestino = JSON.parse(destinoString);
      } else {
        // Extrair do voo como fallback
        this.dadosDestino = {
          destino: this.extrairNomeDestino(this.dadosVoo?.ida?.destino),
          codigo_iata: this.dadosVoo?.ida?.destino,
          pais: 'Desconhecido'
        };
      }
      
      console.log('✅ Dados do destino carregados:', this.dadosDestino);
      
      // 4. NOVA LÓGICA: Validar e normalizar datas dos voos
      this.normalizarDatasVoo();
      
      // 5. ✅ NOVO: Validar horários dos voos
      this.validarHorariosVoo();
      
      return true;
    } catch (erro) {
      console.error('❌ Erro ao carregar dados:', erro);
      throw erro;
    }
  },

  /**
   * ✅ NOVA FUNÇÃO: Normaliza as datas do voo para formato consistente
   */
  normalizarDatasVoo() {
    console.log('🔄 Normalizando datas do voo...');
    console.log('📊 Dados originais do voo:', JSON.stringify(this.dadosVoo, null, 2));
    
    // Se dados do voo estão corretos, usar como estão
    if (this.dadosVoo?.ida?.dataPartida && this.isValidDate(this.dadosVoo.ida.dataPartida)) {
      console.log('✅ Datas do voo já estão corretas');
      return;
    }
    
    // Tentar extrair datas dos dados do usuário como BACKUP (não prioridade)
    const datasUsuario = this.dadosUsuario?.respostas?.datas;
    if (datasUsuario && !this.dadosVoo?.ida?.dataPartida) {
      console.log('⚠️ Usando datas do usuário como backup:', datasUsuario);
      
      let dataIda, dataVolta;
      
      // Diferentes formatos possíveis
      if (typeof datasUsuario === 'object' && datasUsuario.dataIda) {
        dataIda = datasUsuario.dataIda;
        dataVolta = datasUsuario.dataVolta;
      } else if (Array.isArray(datasUsuario) && datasUsuario.length >= 2) {
        dataIda = datasUsuario[0];
        dataVolta = datasUsuario[1];
      } else if (typeof datasUsuario === 'string') {
        if (datasUsuario.includes(',')) {
          [dataIda, dataVolta] = datasUsuario.split(',').map(d => d.trim());
        } else {
          dataIda = datasUsuario;
        }
      }
      
      // Atualizar dados do voo com datas normalizadas
      if (dataIda) {
        this.dadosVoo = this.dadosVoo || {};
        this.dadosVoo.ida = this.dadosVoo.ida || {};
        this.dadosVoo.ida.dataPartida = this.formatarDataISO(dataIda);
        this.dadosVoo.ida.horaChegada = this.dadosVoo.ida.horaChegada || '15:30';
        
        if (dataVolta) {
          this.dadosVoo.volta = this.dadosVoo.volta || {};
          this.dadosVoo.volta.dataPartida = this.formatarDataISO(dataVolta);
          this.dadosVoo.volta.horaPartida = this.dadosVoo.volta.horaPartida || '21:00';
        }
      }
    }
    
    // Verificação final
    if (!this.dadosVoo?.ida?.dataPartida) {
      console.error('❌ Não foi possível normalizar datas do voo');
      throw new Error('Datas de viagem não disponíveis');
    }
    
    console.log('✅ Datas normalizadas:', {
      ida: this.dadosVoo.ida.dataPartida,
      volta: this.dadosVoo.volta?.dataPartida
    });
  },

  /**
   * ✅ NOVA FUNÇÃO: Valida se uma data é válida
   */
  isValidDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date.getFullYear() > 2020;
  },

  /**
   * ✅ NOVA FUNÇÃO: Cria uma data local segura sem problemas de timezone
   */
  criarDataLocal(dataString) {
    if (!dataString) return null;
    
    try {
      const partes = dataString.split('-');
      if (partes.length !== 3) return null;
      
      // Criar data no horário local (meio-dia para evitar problemas de timezone)
      return new Date(
        parseInt(partes[0]), // ano
        parseInt(partes[1]) - 1, // mês (0-indexed)
        parseInt(partes[2]), // dia
        12, 0, 0, 0 // meio-dia
      );
    } catch (e) {
      console.warn('⚠️ Erro ao criar data local:', e);
      return null;
    }
  },

  /**
   * ✅ FUNÇÃO CORRIGIDA: Formata data para ISO sem problemas de timezone
   */
  formatarDataISO(dataInput) {
    if (!dataInput) return null;
    
    try {
      // Se já está no formato ISO correto
      if (typeof dataInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataInput)) {
        return dataInput;
      }
      
      // Se contém 'T' (formato ISO completo), extrair apenas a data
      if (typeof dataInput === 'string' && dataInput.includes('T')) {
        return dataInput.split('T')[0];
      }
      
      // Converter para Date
      const data = new Date(dataInput);
      if (isNaN(data.getTime())) {
        console.warn('⚠️ Data inválida:', dataInput);
        return null;
      }
      
      // ✅ CORREÇÃO: Usar dados locais em vez de UTC
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const dia = String(data.getDate()).padStart(2, '0');
      
      const dataFormatada = `${ano}-${mes}-${dia}`;
      console.log(`📅 Data formatada (local): ${dataInput} -> ${dataFormatada}`);
      
      return dataFormatada;
    } catch (e) {
      console.warn('⚠️ Erro ao formatar data:', e);
      return null;
    }
  },
  
  /**
   * Inicia uma animação de progresso simulado
   */
  iniciarAnimacaoProgresso() {
    this.progressoAtual = 10;
    this.atualizarBarraProgresso(this.progressoAtual, 'Preparando seu roteiro personalizado...');
    
    this.intervalId = setInterval(() => {
      this.progressoAtual += 5;
      
      if (this.progressoAtual < 30) {
        this.atualizarBarraProgresso(this.progressoAtual, 'Analisando seu perfil de viagem...');
      } else if (this.progressoAtual < 50) {
        this.atualizarBarraProgresso(this.progressoAtual, 'Buscando pontos turísticos...');
      } else if (this.progressoAtual < 70) {
        this.atualizarBarraProgresso(this.progressoAtual, 'Organizando atividades por dias...');
      } else if (this.progressoAtual < 90) {
        this.atualizarBarraProgresso(this.progressoAtual, 'Checando previsão do tempo...');
      } else if (this.progressoAtual >= 95) {
        clearInterval(this.intervalId);
      }
    }, 800);
  },
  
  /**
   * Atualiza a barra de progresso visual
   */
  atualizarBarraProgresso(porcentagem, mensagem) {
    const barraProgresso = document.querySelector('.progress-bar');
    const textoCarregamento = document.querySelector('.loading-text');
    
    if (barraProgresso) {
      barraProgresso.style.width = `${porcentagem}%`;
      barraProgresso.setAttribute('aria-valuenow', porcentagem);
    }
    
    if (textoCarregamento && mensagem) {
      textoCarregamento.textContent = mensagem;
    }
  },
  
  /**
   * ✅ FUNÇÃO CORRIGIDA: Gera o roteiro personalizado com validação completa
   */
  async gerarRoteiro() {
    try {
      console.log('🎯 Gerando roteiro com dados validados...');
      
      // Debug inicial
      this.debugDatas();
      
      // Extrair datas já normalizadas
      const dataIda = this.formatarDataISO(this.dadosVoo.ida.dataPartida);
      const dataVolta = this.dadosVoo.volta?.dataPartida ? 
        this.formatarDataISO(this.dadosVoo.volta.dataPartida) : null;
      
      if (!dataIda) {
        throw new Error('Data de ida não disponível');
      }
      
      console.log('📊 Datas extraídas e formatadas:');
      console.log(`   Data ida: ${dataIda}`);
      console.log(`   Data volta: ${dataVolta || 'N/A'}`);
      
      // Calcular número real de dias da viagem
      const diasReais = this.calcularDiasViagemCorreto(dataIda, dataVolta);
      console.log(`🗓️ Dias reais de viagem calculados: ${diasReais}`);
      
      // Preparar parâmetros para a API
      const params = {
        destino: this.dadosDestino?.destino || this.extrairNomeDestino(this.dadosVoo.ida?.destino),
        pais: this.dadosDestino?.pais || 'Desconhecido',
        dataInicio: dataIda,
        dataFim: dataVolta,
        diasViagem: diasReais,
        horaChegada: this.dadosVoo.ida?.horaChegada || '12:00',
        horaSaida: this.dadosVoo.volta?.horaPartida || '14:00',
        tipoViagem: this.obterTipoViagem(),
        tipoCompanhia: this.obterTipoCompanhia(),
        preferencias: this.obterPreferencias(),
        modeloIA: "deepseekai"
      };
      
      console.log('📋 Parâmetros finais para geração de roteiro:', params);
      
      // Chamar a API ou usar dados dummy em desenvolvimento
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '') {
        console.log('🔧 Modo desenvolvimento - usando roteiro dummy com datas corretas');
        await this.simularDelayDev(3000);
        this.roteiroPronto = this.obterRoteiroDummyCorreto(dataIda, dataVolta, diasReais);
      } else {
        console.log('🌐 Modo produção - chamando API real');
        const response = await fetch('/api/itinerary-generator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params)
        });
        
        if (!response.ok) {
          throw new Error(`Erro ${response.status} ao gerar roteiro: ${await response.text()}`);
        }
        
        this.roteiroPronto = await response.json();
        
        // Garantir que as datas do roteiro correspondem às datas reais
        this.ajustarDatasRoteiro(dataIda, diasReais);
      }
      
      console.log('🎉 Roteiro gerado, validando consistência...');
      
      // Validar consistência de datas
      this.validarConsistenciaDatas();
      
      // Debug final
      this.debugDatas();
      
      // Buscar previsão do tempo e imagens
      await this.buscarPrevisaoTempo();
      await this.buscarImagensLocais();
      
      // Atualizar UI
      this.atualizarUIComRoteiro();
      
    } catch (erro) {
      console.error('❌ Erro ao gerar roteiro:', erro);
      this.mostrarErro('Não foi possível gerar seu roteiro personalizado. Tente novamente.');
    } finally {
      clearInterval(this.intervalId);
      this.estaCarregando = false;
      this.atualizarBarraProgresso(100, 'Roteiro pronto!');
      
      setTimeout(() => {
        const loadingContainer = document.querySelector('.loading-container');
        if (loadingContainer) {
          loadingContainer.style.display = 'none';
        }
      }, 500);
    }
  },

  /**
   * ✅ NOVA FUNÇÃO: Calcula corretamente os dias de viagem
   */
  calcularDiasViagemCorreto(dataIda, dataVolta) {
    try {
      if (!dataIda) {
        console.warn('⚠️ Data de ida não fornecida');
        return 1;
      }
      
      const inicio = this.criarDataLocal(dataIda);
      
      if (!dataVolta) {
        console.log('📅 Viagem só de ida - 1 dia');
        return 1;
      }
      
      const fim = this.criarDataLocal(dataVolta);
      
      // Calcular diferença em dias (incluindo dia de chegada e saída)
      const diffTempo = fim.getTime() - inicio.getTime();
      const diffDias = Math.floor(diffTempo / (1000 * 60 * 60 * 24)) + 1;
      
      // Garantir que seja pelo menos 1 dia
      const diasFinais = Math.max(1, diffDias);
      
      console.log(`📊 Cálculo de dias: ${dataIda} até ${dataVolta} = ${diasFinais} dias`);
      
      return diasFinais;
    } catch (e) {
      console.error('❌ Erro ao calcular dias de viagem:', e);
      return 1;
    }
  },

  /**
   * ✅ FUNÇÃO CORRIGIDA: Gera roteiro dummy com datas corretas
   */
  obterRoteiroDummyCorreto(dataIda, dataVolta, diasReais) {
    console.log(`🏗️ Gerando roteiro dummy para ${diasReais} dias`);
    console.log(`📅 De ${dataIda} até ${dataVolta || 'N/A'}`);
    
    const dias = [];
    
    // ✅ CORREÇÃO: Criar data com components locais para evitar timezone
    const partesDataIda = dataIda.split('-');
    const dataInicio = new Date(
      parseInt(partesDataIda[0]), // ano
      parseInt(partesDataIda[1]) - 1, // mês (0-indexed)
      parseInt(partesDataIda[2]), // dia
      12, 0, 0 // meio-dia para evitar problemas de timezone
    );
    
    console.log(`📅 Data de início normalizada: ${dataInicio.toDateString()}`);
    
    // Gerar exatamente o número de dias calculado
    for (let i = 0; i < diasReais; i++) {
      const dataAtual = new Date(dataInicio);
      dataAtual.setDate(dataInicio.getDate() + i);
      
      // ✅ CORREÇÃO: Usar componentes locais em vez de toISOString
      const ano = dataAtual.getFullYear();
      const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
      const dia = String(dataAtual.getDate()).padStart(2, '0');
      const dataFormatada = `${ano}-${mes}-${dia}`;
      
      const diaSemana = dataAtual.getDay();
      
      const diaRoteiro = {
        data: dataFormatada,
        descricao: this.obterDescricaoDia(diaSemana, i + 1, this.dadosDestino?.destino || 'seu destino'),
        manha: this.gerarAtividadesPeriodo('manha', diaSemana, i + 1, this.dadosDestino?.destino || 'seu destino'),
        tarde: this.gerarAtividadesPeriodo('tarde', diaSemana, i + 1, this.dadosDestino?.destino || 'seu destino'),
        noite: this.gerarAtividadesPeriodo('noite', diaSemana, i + 1, this.dadosDestino?.destino || 'seu destino')
      };
      
      dias.push(diaRoteiro);
      
      console.log(`📅 Dia ${i + 1}/${diasReais}: ${dataFormatada} (${dataAtual.toDateString()})`);
    }
    
    // ✅ ATUALIZADO: Usar função melhorada para adicionar informações de voo
    this.adicionarInformacoesVooMelhorada(dias);
    
    console.log(`✅ Roteiro dummy criado com ${dias.length} dias corretos`);
    
    return {
      destino: `${this.dadosDestino?.destino || 'Seu Destino'}, ${this.dadosDestino?.pais || 'Mundo'}`,
      dias
    };
  },

  // ===========================================
  // ✅ NOVAS FUNÇÕES DE HORÁRIOS INTELIGENTES
  // ===========================================

  /**
   * ✅ NOVA FUNÇÃO: Analisa e ajusta atividades baseado nos horários de voo
   */
  ajustarAtividadesPorHorarios(dias) {
    if (!dias || dias.length === 0) return;
    
    // Analisar horário de chegada no primeiro dia
    const horarioChegada = this.dadosVoo?.ida?.horaChegada || '15:30';
    const horaChegada = parseInt(horarioChegada.split(':')[0]);
    const minutoChegada = parseInt(horarioChegada.split(':')[1]);
    
    console.log(`🛬 Analisando chegada às ${horarioChegada} (${horaChegada}:${minutoChegada})`);
    
    // Ajustar primeiro dia baseado no horário de chegada
    if (horaChegada < 10) {
      // Chegada muito cedo - dia completo disponível
      dias[0].observacao = "Chegada cedo - dia completo para explorar!";
      this.adicionarAtividadeEspecial(dias[0].manha, "Check-in no hotel", horarioChegada);
    } else if (horaChegada >= 10 && horaChegada < 14) {
      // Chegada meio do dia - tarde/noite disponível
      dias[0].observacao = "Chegada no meio do dia - aproveite a tarde!";
      this.adicionarAtividadeEspecial(dias[0].tarde, "Check-in e instalação", horarioChegada);
    } else if (horaChegada >= 14 && horaChegada < 18) {
      // Chegada à tarde - noite disponível
      dias[0].observacao = "Chegada à tarde - explore a vida noturna!";
      this.adicionarAtividadeEspecial(dias[0].tarde, "Check-in e descanso", horarioChegada);
    } else {
      // Chegada muito tarde - só descanso
      dias[0].observacao = "Chegada noturna - descanse para começar bem amanhã!";
      dias[0].noite.atividades = [{
        horario: horarioChegada,
        local: "Hotel",
        dica: "Chegada noturna - foque no descanso para aproveitar os próximos dias!",
        tags: ["Descanso", "Chegada"]
      }];
    }
    
    // Analisar horário de partida no último dia (se houver)
    if (this.dadosVoo?.volta && dias.length > 1) {
      const horarioPartida = this.dadosVoo.volta.horaPartida || '21:00';
      const horaPartida = parseInt(horarioPartida.split(':')[0]);
      const ultimoDia = dias.length - 1;
      
      console.log(`🛫 Analisando partida às ${horarioPartida} (${horaPartida}:00)`);
      
      if (horaPartida < 8) {
        // Partida muito cedo - último dia limitado
        dias[ultimoDia].observacao = "Partida cedo - programe atividades leves!";
        dias[ultimoDia].manha.atividades = [{
          horario: "06:00",
          local: "Hotel",
          dica: "Check-out cedo e transfer para o aeroporto. Prepare-se na noite anterior!",
          tags: ["Check-out", "Transfer"]
        }];
      } else if (horaPartida >= 8 && horaPartida < 14) {
        // Partida manhã/meio-dia - manhã limitada
        dias[ultimoDia].observacao = "Partida pela manhã - aproveite para últimas compras!";
        this.adicionarAtividadeEspecial(dias[ultimoDia].manha, "Check-out e últimas atividades", 
          this.calcularHorarioCheckout(horarioPartida));
      } else if (horaPartida >= 14 && horaPartida < 20) {
        // Partida à tarde - manhã completa disponível
        dias[ultimoDia].observacao = "Partida à tarde - manhã completa para aproveitar!";
        this.adicionarAtividadeEspecial(dias[ultimoDia].tarde, "Check-out e transfer", 
          this.calcularHorarioCheckout(horarioPartida));
      } else {
        // Partida noturna - dia quase completo
        dias[ultimoDia].observacao = "Partida noturna - dia quase completo disponível!";
        this.adicionarAtividadeEspecial(dias[ultimoDia].noite, "Transfer para aeroporto", 
          this.calcularHorarioCheckout(horarioPartida));
      }
    }
    
    console.log('✅ Atividades ajustadas baseadas nos horários de voo');
  },

  /**
   * ✅ NOVA FUNÇÃO: Adiciona atividade especial relacionada ao voo
   */
  adicionarAtividadeEspecial(periodo, descricao, horario) {
    if (!periodo.atividades) {
      periodo.atividades = [];
    }
    
    // Adicionar no início da lista
    periodo.atividades.unshift({
      horario: horario,
      local: descricao,
      dica: "Atividade relacionada ao seu voo - importante não perder!",
      tags: ["Voo", "Importante"],
      isEspecial: true
    });
  },

  /**
   * ✅ NOVA FUNÇÃO: Calcula horário ideal para check-out baseado na partida
   */
  calcularHorarioCheckout(horarioPartida) {
    const horaPartida = parseInt(horarioPartida.split(':')[0]);
    const minutoPartida = parseInt(horarioPartida.split(':')[1]);
    
    // Calcular 3 horas antes da partida para check-out
    let horaCheckout = horaPartida - 3;
    let minutoCheckout = minutoPartida;
    
    // Ajustar se ficar negativo
    if (horaCheckout < 0) {
      horaCheckout = 6; // Mínimo 6h da manhã
      minutoCheckout = 0;
    }
    
    return `${String(horaCheckout).padStart(2, '0')}:${String(minutoCheckout).padStart(2, '0')}`;
  },

  /**
   * ✅ NOVA FUNÇÃO: Analisa compatibilidade de horários com atividades
   */
  analisarCompatibilidadeHorarios() {
    const horarioChegada = this.dadosVoo?.ida?.horaChegada || '15:30';
    const horarioPartida = this.dadosVoo?.volta?.horaPartida || '21:00';
    
    const horaChegada = parseInt(horarioChegada.split(':')[0]);
    const horaPartida = parseInt(horarioPartida.split(':')[0]);
    
    const alertas = [];
    
    // Verificar chegada muito tarde
    if (horaChegada >= 22) {
      alertas.push({
        tipo: 'warning',
        icone: '🌙',
        titulo: 'Chegada Noturna',
        mensagem: 'Sua chegada é muito tarde. O primeiro dia será focado no descanso.'
      });
    }
    
    // Verificar partida muito cedo
    if (horaPartida <= 6) {
      alertas.push({
        tipo: 'warning',
        icone: '🌅',
        titulo: 'Partida Madrugada',
        mensagem: 'Sua partida é muito cedo. Prepare-se na noite anterior!'
      });
    }
    
    // Verificar se há tempo suficiente
    const diasViagem = this.calcularDiasViagemCorreto(
      this.formatarDataISO(this.dadosVoo.ida?.dataPartida),
      this.formatarDataISO(this.dadosVoo.volta?.dataPartida)
    );
    
    if (diasViagem === 1 && (horaChegada >= 18 || horaPartida <= 10)) {
      alertas.push({
        tipo: 'info',
        icone: '⏰',
        titulo: 'Viagem Rápida',
        mensagem: 'Com apenas 1 dia e horários apertados, foque em atividades próximas!'
      });
    }
    
    // Sugestões baseadas nos horários
    if (horaChegada <= 10 && horaPartida >= 20) {
      alertas.push({
        tipo: 'success',
        icone: '🎉',
        titulo: 'Horários Ideais',
        mensagem: 'Seus horários permitem aproveitar o dia completo!'
      });
    }
    
    return alertas;
  },

  /**
   * ✅ NOVA FUNÇÃO: Cria elemento visual para alertas de horário
   */
  criarElementoAlertasHorario(alertas) {
    if (!alertas || alertas.length === 0) return '';
    
    return alertas.map(alerta => `
      <div class="alerta-horario alerta-${alerta.tipo}">
        <div class="alerta-icone">${alerta.icone}</div>
        <div class="alerta-conteudo">
          <div class="alerta-titulo">${alerta.titulo}</div>
          <div class="alerta-mensagem">${alerta.mensagem}</div>
        </div>
      </div>
    `).join('');
  },

  /**
   * ✅ FUNÇÃO ATUALIZADA: Adicionar informações de voo com mais detalhes
   */
  adicionarInformacoesVooMelhorada(dias) {
    if (!dias || dias.length === 0) return;
    
    // Primeiro, aplicar ajustes baseados nos horários
    this.ajustarAtividadesPorHorarios(dias);
    
    // Analisar compatibilidade e gerar alertas
    const alertas = this.analisarCompatibilidadeHorarios();
    
    // Adicionar alertas ao primeiro dia se houver
    if (alertas.length > 0) {
      dias[0].alertasHorario = alertas;
    }
    
    console.log('✅ Informações detalhadas de voo adicionadas ao roteiro');
  },

  /**
   * ✅ FUNÇÃO ATUALIZADA: Validar horários dos voos
   */
  validarHorariosVoo() {
    console.log('🔍 Validando horários dos voos...');
    
    const horarioChegada = this.dadosVoo?.ida?.horaChegada;
    const horarioPartida = this.dadosVoo?.volta?.horaPartida;
    
    console.log(`🛬 Horário de chegada: ${horarioChegada || 'Não definido'}`);
    console.log(`🛫 Horário de partida: ${horarioPartida || 'Não definido'}`);
    
    // Validar formato dos horários
    const formatoHorario = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (horarioChegada && !formatoHorario.test(horarioChegada)) {
      console.warn(`⚠️ Formato inválido para horário de chegada: ${horarioChegada}`);
    }
    
    if (horarioPartida && !formatoHorario.test(horarioPartida)) {
      console.warn(`⚠️ Formato inválido para horário de partida: ${horarioPartida}`);
    }
    
    // Verificar se os horários fazem sentido
    if (horarioChegada && horarioPartida) {
      const [horaC, minC] = horarioChegada.split(':').map(Number);
      const [horaP, minP] = horarioPartida.split(':').map(Number);
      
      const minutosChegada = horaC * 60 + minC;
      const minutosPartida = horaP * 60 + minP;
      
      // Para viagens de 1 dia, verificar se há tempo suficiente
      const diasViagem = this.calcularDiasViagemCorreto(
        this.formatarDataISO(this.dadosVoo.ida?.dataPartida),
        this.formatarDataISO(this.dadosVoo.volta?.dataPartida)
      );
      
      if (diasViagem === 1 && minutosPartida <= minutosChegada + 120) {
        console.warn('⚠️ Tempo muito curto entre chegada e partida (menos de 2 horas)');
      }
    }
    
    console.log('✅ Validação de horários concluída');
  },

  /**
   * ✅ FUNÇÃO CORRIGIDA: Ajusta datas do roteiro para corresponder às datas reais
   */
  ajustarDatasRoteiro(dataIda, diasReais) {
    if (!this.roteiroPronto || !this.roteiroPronto.dias) return;
    
    console.log('🔄 Ajustando datas do roteiro para corresponder às datas reais...');
    
    // ✅ CORREÇÃO: Criar data com components locais
    const partesDataIda = dataIda.split('-');
    const dataInicio = new Date(
      parseInt(partesDataIda[0]), // ano
      parseInt(partesDataIda[1]) - 1, // mês (0-indexed)
      parseInt(partesDataIda[2]), // dia
      12, 0, 0 // meio-dia para evitar problemas de timezone
    );
    
    // Garantir que temos exatamente o número correto de dias
    if (this.roteiroPronto.dias.length !== diasReais) {
      console.log(`⚠️ Ajustando número de dias de ${this.roteiroPronto.dias.length} para ${diasReais}`);
      
      if (this.roteiroPronto.dias.length > diasReais) {
        // Remover dias extras
        this.roteiroPronto.dias = this.roteiroPronto.dias.slice(0, diasReais);
      } else {
        // Adicionar dias faltantes (duplicar último dia como template)
        const ultimoDia = this.roteiroPronto.dias[this.roteiroPronto.dias.length - 1];
        while (this.roteiroPronto.dias.length < diasReais) {
          const novoDay = JSON.parse(JSON.stringify(ultimoDia));
          novoDay.descricao = `Aproveite mais um dia explorando!`;
          this.roteiroPronto.dias.push(novoDay);
        }
      }
    }
    
    // Ajustar datas de cada dia
    this.roteiroPronto.dias.forEach((dia, index) => {
      const dataDia = new Date(dataInicio);
      dataDia.setDate(dataInicio.getDate() + index);
      
      // ✅ CORREÇÃO: Usar componentes locais em vez de toISOString
      const ano = dataDia.getFullYear();
      const mes = String(dataDia.getMonth() + 1).padStart(2, '0');
      const diaNum = String(dataDia.getDate()).padStart(2, '0');
      dia.data = `${ano}-${mes}-${diaNum}`;
      
      console.log(`📅 Dia ${index + 1} ajustado para: ${dia.data} (${dataDia.toDateString()})`);
    });
    
    // ✅ ATUALIZADO: Usar função melhorada para adicionar informações de voo
    this.adicionarInformacoesVooMelhorada(this.roteiroPronto.dias);
    
    console.log('✅ Datas do roteiro ajustadas com sucesso');
  },

  /**
   * ✅ FUNÇÃO SIMPLIFICADA: Busca previsão do tempo para os dias do roteiro
   */
  async buscarPrevisaoTempo() {
    try {
      if (!this.roteiroPronto || !this.roteiroPronto.dias || !this.dadosDestino) {
        console.warn('⚠️ Dados insuficientes para buscar previsão do tempo');
        this.garantirPrevisoesTodosDias();
        return;
      }
      
      const dataInicio = this.formatarDataISO(this.dadosVoo.ida?.dataPartida);
      const dataFim = this.formatarDataISO(this.dadosVoo.volta?.dataPartida);
      
      if (!dataInicio) {
        console.warn('⚠️ Data de início não disponível para previsão do tempo');
        this.garantirPrevisoesTodosDias();
        return;
      }
      
      // Usar apenas o nome da cidade
      const cidadeLimpa = this.dadosDestino.destino
        .replace(/\s+Internacional/i, '')
        .replace(/\s*,.*$/, '')
        .trim();
      
      console.log(`🌤️ Buscando previsão para ${cidadeLimpa} de ${dataInicio} a ${dataFim || 'N/A'}`);
      
      // Construir URL da API
      const apiUrl = `/api/weather?city=${encodeURIComponent(cidadeLimpa)}&start=${dataInicio}${dataFim ? `&end=${dataFim}` : ''}`;
      console.log('🔗 URL da API de clima:', apiUrl);
      
      // Fazer requisição com timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`📡 Resposta da API de clima: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro ${response.status} na API de clima:`, errorText);
        this.garantirPrevisoesTodosDias();
        return;
      }
      
      const previsoes = await response.json();
      console.log('✅ Previsões do tempo recebidas:', previsoes);
      
      // Verificar se recebemos dados válidos
      if (!previsoes || typeof previsoes !== 'object') {
        console.warn('⚠️ Formato inválido de previsões do tempo');
        this.garantirPrevisoesTodosDias();
        return;
      }
      
      // Adicionar previsões aos dias do roteiro
      let previsoesAdicionadas = 0;
      
      if (this.roteiroPronto.dias) {
        this.roteiroPronto.dias.forEach((dia, index) => {
          if (previsoes[index]) {
            dia.previsao = {
              temperature: previsoes[index].temperature || 22,
              condition: previsoes[index].condition || 'Parcialmente nublado',
              icon: previsoes[index].icon || '🌤️',
              date: previsoes[index].date || dia.data
            };
            previsoesAdicionadas++;
            console.log(`🌡️ Previsão adicionada ao dia ${index + 1}:`, dia.previsao);
          } else {
            // Criar previsão fictícia se não houver dados para esse dia
            dia.previsao = this.gerarPrevisaoFicticia(index);
            console.log(`🎲 Previsão fictícia criada para dia ${index + 1}:`, dia.previsao);
          }
        });
      }
      
      console.log(`✅ Previsões processadas: ${previsoesAdicionadas}/${this.roteiroPronto.dias.length} dias`);
      
    } catch (erro) {
      console.warn('⚠️ Erro ao buscar previsão do tempo:', erro);
      
      if (erro.name === 'AbortError') {
        console.warn('⏱️ Timeout na requisição de previsão do tempo');
      }
    } finally {
      // SEMPRE garantir que todos os dias tenham previsão
      this.garantirPrevisoesTodosDias();
    }
  },

  /**
   * ✅ FUNÇÃO SIMPLIFICADA: Garante que todos os dias tenham previsão
   */
  garantirPrevisoesTodosDias() {
    if (!this.roteiroPronto?.dias) return;
    
    this.roteiroPronto.dias.forEach((dia, index) => {
      if (!dia.previsao) {
        dia.previsao = this.gerarPrevisaoFicticia(index);
      }
    });
    
    console.log(`✅ Previsões garantidas para todos os ${this.roteiroPronto.dias.length} dias`);
  },

  /**
   * Gera uma previsão fictícia para um dia
   */
  gerarPrevisaoFicticia(index) {
    const condicoes = [
      { icon: '☀️', condition: 'Ensolarado', tempBase: 28 },
      { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 25 },
      { icon: '☁️', condition: 'Nublado', tempBase: 22 },
      { icon: '🌧️', condition: 'Chuvoso', tempBase: 20 },
      { icon: '⛈️', condition: 'Tempestade', tempBase: 18 },
      { icon: '🌫️', condition: 'Neblina', tempBase: 19 }
    ];
    
    // Escolher condição com distribuição mais realista
    let conditionIndex;
    if (index < 3) {
      // Primeiros dias: mais chance de tempo bom
      conditionIndex = Math.floor(Math.random() * 3);
    } else {
      // Outros dias: condições variadas
      conditionIndex = Math.floor(Math.random() * condicoes.length);
    }
    
    const condition = condicoes[conditionIndex];
    
    // Adicionar variação de temperatura (-3 a +5 graus)
    const tempVariation = Math.floor(Math.random() * 9) - 3;
    const finalTemp = Math.max(15, Math.min(35, condition.tempBase + tempVariation));
    
    // Gerar data para o dia
    const hoje = new Date();
    const dataDia = new Date(hoje);
    dataDia.setDate(hoje.getDate() + index);
    
    return {
      icon: condition.icon,
      temperature: finalTemp,
      condition: condition.condition,
      date: dataDia.toISOString().split('T')[0]
    };
  },

  /**
   * Busca imagens para os locais no roteiro
   */
  async buscarImagensLocais() {
    try {
      if (!this.roteiroPronto || !this.roteiroPronto.dias) {
        console.warn('⚠️ Não há roteiro para buscar imagens');
        return;
      }
      
      // Obter lista de pontos turísticos únicos
      const pontosTuristicos = new Set();
      
      this.roteiroPronto.dias.forEach(dia => {
        ['manha', 'tarde', 'noite'].forEach(periodo => {
          if (dia[periodo] && Array.isArray(dia[periodo].atividades)) {
            dia[periodo].atividades.forEach(atividade => {
              if (atividade.local) {
                pontosTuristicos.add(atividade.local);
              }
            });
          }
        });
      });
      
      console.log('🖼️ Pontos turísticos para buscar imagens:', [...pontosTuristicos]);
      
      // Buscar imagens para cada ponto turístico
      const imagensPromises = [...pontosTuristicos].map(async (local) => {
        try {
          const response = await fetch(`/api/image-search?query=${encodeURIComponent(local)}&perPage=1&descricao=${encodeURIComponent(this.dadosDestino.destino)}`);
          
          if (!response.ok) {
            throw new Error(`Erro ${response.status} ao buscar imagem`);
          }
          
          const dados = await response.json();
          return { local, imagem: dados.images[0]?.url || null };
        } catch (e) {
          console.warn(`⚠️ Erro ao buscar imagem para ${local}:`, e);
          return { local, imagem: null };
        }
      });
      
      const resultadosImagens = await Promise.all(imagensPromises);
      console.log('✅ Resultados de imagens:', resultadosImagens);
      
      // Criar mapa de local -> URL da imagem
      const mapaImagens = {};
      resultadosImagens.forEach(resultado => {
        if (resultado.imagem) {
          mapaImagens[resultado.local] = resultado.imagem;
        }
      });
      
      // Adicionar URLs de imagens às atividades no roteiro
      this.roteiroPronto.dias.forEach(dia => {
        ['manha', 'tarde', 'noite'].forEach(periodo => {
          if (dia[periodo] && Array.isArray(dia[periodo].atividades)) {
            dia[periodo].atividades.forEach(atividade => {
              if (atividade.local && mapaImagens[atividade.local]) {
                atividade.imagemUrl = mapaImagens[atividade.local];
              }
            });
          }
        });
      });
      
      console.log('✅ Imagens integradas ao roteiro');
      
    } catch (erro) {
      console.warn('⚠️ Erro ao buscar imagens para locais:', erro);
    }
  },

  /**
   * Atualiza a interface com o roteiro gerado
   */
  atualizarUIComRoteiro() {
    console.log('🎨 Atualizando interface com roteiro...');
    
    if (!this.roteiroPronto) {
      console.error('❌ Não há roteiro para exibir');
      return;
    }
    
    const container = document.querySelector('.roteiro-content');
    if (!container) {
      console.error('❌ Container de roteiro não encontrado');
      return;
    }
    
    // Limpar conteúdo existente
    container.innerHTML = '';
    
    // Renderizar cabeçalho com destino
    const header = document.querySelector('.app-header h1');
    if (header) {
      header.textContent = `Seu Roteiro para ${this.dadosDestino.destino}`;
    }
    
    // Renderizar resumo da viagem
    container.appendChild(this.criarElementoResumoViagem());
    
    // Renderizar cada dia do roteiro
    this.roteiroPronto.dias.forEach((dia, index) => {
      container.appendChild(this.criarElementoDiaRoteiro(dia, index + 1));
    });
    
    console.log('✅ Interface atualizada com sucesso');
  },

  /**
   * Cria o elemento de resumo da viagem
   */
  criarElementoResumoViagem() {
    const resumoViagem = document.createElement('div');
    resumoViagem.className = 'resumo-viagem';
    
    const dataIda = this.formatarData(this.dadosVoo.ida?.dataPartida);
    const dataVolta = this.dadosVoo.volta?.dataPartida ? this.formatarData(this.dadosVoo.volta.dataPartida) : null;
    
    const diasViagem = this.calcularDiasViagemCorreto(
      this.formatarDataISO(this.dadosVoo.ida?.dataPartida), 
      this.formatarDataISO(this.dadosVoo.volta?.dataPartida)
    );
    
    const companhiaTexto = this.obterTextoCompanhia();
    const horaChegada = this.dadosVoo.ida?.horaChegada || '17:05';
    const horaPartida = this.dadosVoo.volta?.horaPartida || '07:15';
    
    resumoViagem.innerHTML = `
      <div class="resumo-viagem-header">
        📋 Resumo da Viagem
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
            <div class="label">Datas:</div>
            <p class="valor">${dataIda}${dataVolta ? ` a ${dataVolta}` : ''} (${diasViagem} dias)</p>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="icone">✈️</div>
          <div class="texto">
            <div class="label">Horários dos voos:</div>
            <p class="valor">Chegada ${horaChegada}${dataVolta ? ` - Saída ${horaPartida}` : ''}</p>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="icone">${this.obterIconeCompanhia()}</div>
          <div class="texto">
            <div class="label">Grupo:</div>
            <p class="valor">${companhiaTexto}</p>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="icone">${this.obterIconePreferencia()}</div>
          <div class="texto">
            <div class="label">Preferência:</div>
            <p class="valor">${this.obterTextoPreferencia()}</p>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="icone">🛫</div>
          <div class="texto">
            <div class="label">Cidade de partida:</div>
            <p class="valor">${this.extrairNomeDestino(this.dadosVoo.ida?.origem || 'CGH')}</p>
          </div>
        </div>
      </div>
    `;
    
    return resumoViagem;
  },

  /**
   * ✅ FUNÇÃO ATUALIZADA: Cria o elemento de um dia do roteiro com alertas de horário
   */
  criarElementoDiaRoteiro(dia, numeroDia) {
    const diaRoteiro = document.createElement('div');
    diaRoteiro.className = 'dia-roteiro';
    
    const dataFormatada = this.formatarDataCompleta(dia.data);
    
    // Criar alertas de horário se existirem
    const alertasHTML = dia.alertasHorario ? 
      this.criarElementoAlertasHorario(dia.alertasHorario) : '';
    
    // Criar observação se existir
    const observacaoHTML = dia.observacao ? 
      `<div class="dia-observacao">
         <span class="icone">💡</span>
         <span>${dia.observacao}</span>
       </div>` : '';
    
    diaRoteiro.innerHTML = `
      <div class="dia-header">
        <div class="dia-numero">${numeroDia}</div>
        <span>Dia ${numeroDia} — ${dataFormatada}</span>
      </div>
      
      <div class="dia-content">
        <p class="dia-descricao">
          "${dia.descricao || 'Explore e aproveite seu dia!'}"
        </p>
        
        ${observacaoHTML}
        ${alertasHTML}
        ${this.criarElementoPrevisaoTempo(dia.previsao)}
        
        <div class="periodos-tabs">
          <div class="periodo-tab active" data-periodo="manha" data-dia="${numeroDia}">
            <span>🌅</span> Manhã
          </div>
          <div class="periodo-tab" data-periodo="tarde" data-dia="${numeroDia}">
            <span>☀️</span> Tarde
          </div>
          <div class="periodo-tab" data-periodo="noite" data-dia="${numeroDia}">
            <span>🌙</span> Noite
          </div>
        </div>
        
        <div class="periodo-conteudo" id="dia-${numeroDia}-manha">
          ${this.criarElementoPeriodo(dia.manha, 'manha')}
        </div>
        
        <div class="periodo-conteudo" id="dia-${numeroDia}-tarde" style="display: none;">
          ${this.criarElementoPeriodo(dia.tarde, 'tarde')}
        </div>
        
        <div class="periodo-conteudo" id="dia-${numeroDia}-noite" style="display: none;">
          ${this.criarElementoPeriodo(dia.noite, 'noite')}
        </div>
      </div>
    `;
    
    // Adicionar eventos após inserção no DOM
    setTimeout(() => {
      const tabs = diaRoteiro.querySelectorAll('.periodo-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          const periodosConteudo = diaRoteiro.querySelectorAll('.periodo-conteudo');
          periodosConteudo.forEach(p => {
            p.style.display = 'none';
          });
          
          const diaSelecionado = tab.getAttribute('data-dia');
          const periodoSelecionado = tab.getAttribute('data-periodo');
          const conteudoSelecionado = document.getElementById(`dia-${diaSelecionado}-${periodoSelecionado}`);
          
          if (conteudoSelecionado) {
            conteudoSelecionado.style.display = 'block';
          }
        });
      });
      
      const botoesVerMapa = diaRoteiro.querySelectorAll('.btn-ver-mapa');
      botoesVerMapa.forEach(botao => {
        botao.addEventListener('click', () => {
          const local = botao.getAttribute('data-local');
          if (local) {
            this.abrirMapa(local);
          }
        });
      });
    }, 100);
    
    return diaRoteiro;
  },

  /**
   * Cria o elemento HTML para a previsão do tempo
   */
  criarElementoPrevisaoTempo(previsao) {
    if (!previsao) {
      return '';
    }
    
    return `
      <div class="previsao-tempo">
        <span class="icone">${previsao.icon || '🌤️'}</span>
        <span class="font-medium">Previsão: ${previsao.temperature || '--'}°C, ${previsao.condition || 'Parcialmente nublado'}</span>
      </div>
    `;
  },

  /**
   * ✅ FUNÇÃO ATUALIZADA: Cria o elemento HTML para um período do dia
   */
  criarElementoPeriodo(periodo, nomePeriodo) {
    if (!periodo || !periodo.atividades || periodo.atividades.length === 0) {
      return `
        <div class="periodo-vazio">
          <p>Nenhuma atividade planejada para este período.</p>
        </div>
      `;
    }
    
    let html = '';
    
    if (periodo.horarioEspecial) {
      html += `
        <div class="atividade-horario">
          <span class="icone">✈️</span>
          <span>${periodo.horarioEspecial}</span>
        </div>
      `;
    }
    
    periodo.atividades.forEach(atividade => {
      // ✅ NOVO: Classe especial para atividades de voo
      const classeEspecial = atividade.isEspecial ? ' atividade-especial' : '';
      
      html += `
        <div class="atividade${classeEspecial}">
          ${atividade.horario ? `
            <div class="atividade-horario">
              <span class="icone">🕒</span>
              <span>${atividade.horario}</span>
            </div>
          ` : ''}
          
          <div class="atividade-local">
            <span class="icone">📍</span>
            <div>
              <span class="nome">${atividade.local}</span>
              
              ${atividade.tags && atividade.tags.length > 0 ? `
                <div class="atividade-badges">
                  ${atividade.tags.map(tag => `
                    <span class="badge ${this.obterClasseBadge(tag)}">${tag}</span>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
          
          ${atividade.dica ? `
            <div class="tripinha-dica">
              <div class="tripinha-dica-conteudo">
                <div class="tripinha-avatar">
                  <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha">
                </div>
                <div class="tripinha-texto">
                  <strong>Dica da Tripinha:</strong> ${atividade.dica}
                </div>
              </div>
            </div>
          ` : ''}
          
          ${atividade.imagemUrl ? `
            <div class="imagem-local">
              <img src="${atividade.imagemUrl}" alt="${atividade.local}" loading="lazy">
            </div>
          ` : ''}
          
          ${!atividade.isEspecial ? `
            <button class="btn-ver-mapa" data-local="${atividade.local}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
              </svg>
              Ver no mapa
            </button>
          ` : ''}
        </div>
      `;
    });
    
    return html;
  },

  // ===========================================
  // FUNÇÕES DE DEBUG E VALIDAÇÃO
  // ===========================================

  /**
   * ✅ NOVA FUNÇÃO: Debug para verificar processamento de datas
   */
  debugDatas() {
    console.log('🔍 DEBUG - Verificação de datas:');
    console.log('📊 Dados do voo:', {
      ida: this.dadosVoo?.ida,
      volta: this.dadosVoo?.volta
    });
    
    console.log('📊 Dados do usuário (datas):', this.dadosUsuario?.respostas?.datas);
    
    if (this.roteiroPronto?.dias) {
      console.log('📊 Datas no roteiro gerado:');
      this.roteiroPronto.dias.forEach((dia, index) => {
        console.log(`  Dia ${index + 1}: ${dia.data}`);
      });
    }
  },

  /**
   * ✅ NOVA FUNÇÃO: Validar consistência de datas entre voo e roteiro
   */
  validarConsistenciaDatas() {
    const dataIdaVoo = this.formatarDataISO(this.dadosVoo?.ida?.dataPartida);
    const dataVoltaVoo = this.formatarDataISO(this.dadosVoo?.volta?.dataPartida);
    
    console.log('🔍 Validação de consistência:');
    console.log(`📅 Data ida do voo: ${dataIdaVoo}`);
    console.log(`📅 Data volta do voo: ${dataVoltaVoo}`);
    
    if (this.roteiroPronto?.dias?.length > 0) {
      const primeiroDiaRoteiro = this.roteiroPronto.dias[0].data;
      const ultimoDiaRoteiro = this.roteiroPronto.dias[this.roteiroPronto.dias.length - 1].data;
      
      console.log(`📅 Primeiro dia do roteiro: ${primeiroDiaRoteiro}`);
      console.log(`📅 Último dia do roteiro: ${ultimoDiaRoteiro}`);
      
      // Verificar se as datas coincidem
      if (dataIdaVoo !== primeiroDiaRoteiro) {
        console.error('❌ INCONSISTÊNCIA: Data de ida do voo não coincide com primeiro dia do roteiro!');
        console.error(`   Voo: ${dataIdaVoo} vs Roteiro: ${primeiroDiaRoteiro}`);
        return false;
      }
      
      if (dataVoltaVoo && dataVoltaVoo !== ultimoDiaRoteiro) {
        console.warn('⚠️ AVISO: Data de volta do voo não coincide com último dia do roteiro');
        console.warn(`   Voo: ${dataVoltaVoo} vs Roteiro: ${ultimoDiaRoteiro}`);
      }
      
      console.log('✅ Datas do voo e roteiro estão consistentes');
      return true;
    }
    
    return false;
  },

  /**
   * ✅ NOVA FUNÇÃO: Teste de datas para desenvolvimento
   */
  testarDatas() {
    console.log('🧪 TESTE DE DATAS:');
    
    // Testar diferentes formatos de data
    const testeDataInput = '2025-03-15';
    const dataFormatada = this.formatarDataISO(testeDataInput);
    const dataLocal = this.criarDataLocal(testeDataInput);
    
    console.log(`   Input: ${testeDataInput}`);
    console.log(`   Formatada: ${dataFormatada}`);
    console.log(`   Data local: ${dataLocal?.toDateString()}`);
    console.log(`   ISO nativo: ${dataLocal?.toISOString().split('T')[0]}`);
    
    // Testar timezone
    const agora = new Date();
    console.log(`   Timezone offset: ${agora.getTimezoneOffset()} minutos`);
    console.log(`   Fuso horário: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  },

  // ===========================================
  // FUNÇÕES DE MAPEAMENTO DE PREFERÊNCIAS (CORRIGIDAS)
  // ===========================================

  /**
   * ✅ FUNÇÃO CORRIGIDA: Obtém os dados de tipo de viagem 
   */
  obterTipoViagem() {
    if (!this.dadosUsuario || !this.dadosUsuario.respostas) {
      console.warn('⚠️ Dados do usuário não encontrados, usando padrão: cultura');
      return 'cultura';  // Default
    }
    
    const respostas = this.dadosUsuario.respostas;
    console.log('🔍 Analisando respostas para tipo de viagem:', respostas);
    
    // 1. VERIFICAR estilo_viagem_destino (campo específico do fluxo atual)
    if (typeof respostas.estilo_viagem_destino === 'number') {
      const mapeamento = ['relaxar', 'aventura', 'cultura', 'urbano'];
      const tipoViagem = mapeamento[respostas.estilo_viagem_destino] || 'cultura';
      console.log(`✅ Tipo de viagem via estilo_viagem_destino[${respostas.estilo_viagem_destino}]: ${tipoViagem}`);
      return tipoViagem;
    }
    
    // 2. VERIFICAR preferencia_viagem (campo alternativo)
    if (typeof respostas.preferencia_viagem === 'number') {
      const mapeamento = ['relaxar', 'aventura', 'cultura', 'urbano'];
      const tipoViagem = mapeamento[respostas.preferencia_viagem] || 'cultura';
      console.log(`✅ Tipo de viagem via preferencia_viagem[${respostas.preferencia_viagem}]: ${tipoViagem}`);
      return tipoViagem;
    }
    
    // 3. VERIFICAR destino_imaginado (campo do questionário original)
    if (typeof respostas.destino_imaginado === 'number') {
      const mapeamento = ['praia', 'natureza', 'urbano', 'surpresa'];
      const destino = mapeamento[respostas.destino_imaginado];
      
      if (destino === 'praia') return 'relaxar';
      if (destino === 'natureza') return 'aventura';
      if (destino === 'urbano') return 'urbano';
      if (destino === 'surpresa') return 'cultura';
      
      console.log(`✅ Tipo de viagem via destino_imaginado[${respostas.destino_imaginado}]: ${destino} -> mapeado`);
    }
    
    // 4. BUSCAR em texto (fallback)
    const respostasTexto = JSON.stringify(respostas).toLowerCase();
    if (respostasTexto.includes('urban') || respostasTexto.includes('urbano')) {
      console.log('✅ Tipo de viagem via texto: urbano');
      return 'urbano';
    }
    if (respostasTexto.includes('relax')) {
      console.log('✅ Tipo de viagem via texto: relaxar');
      return 'relaxar';
    }
    if (respostasTexto.includes('aventura')) {
      console.log('✅ Tipo de viagem via texto: aventura');
      return 'aventura';
    }
    if (respostasTexto.includes('cultura')) {
      console.log('✅ Tipo de viagem via texto: cultura');
      return 'cultura';
    }
    
    console.warn('⚠️ Nenhum tipo de viagem encontrado, usando padrão: cultura');
    return 'cultura';  // Default final
  },

  /**
   * ✅ FUNÇÃO CORRIGIDA: Obtém o texto do tipo de preferência 
   */
  obterTextoPreferencia() {
    const tipo = this.obterTipoViagem();
    const mapeamento = {
      'relaxar': 'Relaxamento e Praia',
      'aventura': 'Aventura e Natureza',
      'cultura': 'Cultura e História',
      'urbano': 'Urbano e Vida Noturna'
    };
    
    const texto = mapeamento[tipo] || 'Cultura e História';
    console.log(`🏷️ Texto de preferência: ${tipo} -> ${texto}`);
    return texto;
  },

  /**
   * ✅ FUNÇÃO CORRIGIDA: Obtém o ícone para o tipo de preferência 
   */
  obterIconePreferencia() {
    const tipo = this.obterTipoViagem();
    const mapeamento = {
      'relaxar': '🏖️',
      'aventura': '🏔️',
      'cultura': '🏛️',
      'urbano': '🏙️'
    };
    
    const icone = mapeamento[tipo] || '🏛️';
    console.log(`🎯 Ícone de preferência: ${tipo} -> ${icone}`);
    return icone;
  },

  /**
   * ✅ FUNÇÃO CORRIGIDA: Obtém o tipo de companhia 
   */
  obterTipoCompanhia() {
    if (!this.dadosUsuario || !this.dadosUsuario.respostas) {
      console.warn('⚠️ Dados do usuário não encontrados, usando padrão: sozinho');
      return 'sozinho';  // Default
    }
    
    const respostas = this.dadosUsuario.respostas;
    console.log('🔍 Analisando respostas para tipo de companhia:', respostas);
    
    // 1. VERIFICAR companhia (campo principal)
    if (typeof respostas.companhia === 'number') {
      const mapeamento = ['sozinho', 'casal', 'familia', 'amigos'];
      const tipoCompanhia = mapeamento[respostas.companhia] || 'sozinho';
      console.log(`✅ Tipo de companhia via companhia[${respostas.companhia}]: ${tipoCompanhia}`);
      return tipoCompanhia;
    }
    
    // 2. BUSCAR em texto (fallback)
    const respostasTexto = JSON.stringify(respostas).toLowerCase();
    if (respostasTexto.includes('sozinho') || respostasTexto.includes('alone')) {
      console.log('✅ Tipo de companhia via texto: sozinho');
      return 'sozinho';
    }
    if (respostasTexto.includes('romantic') || respostasTexto.includes('casal') || respostasTexto.includes('couple')) {
      console.log('✅ Tipo de companhia via texto: casal');
      return 'casal';
    }
    if (respostasTexto.includes('famil') || respostasTexto.includes('family')) {
      console.log('✅ Tipo de companhia via texto: familia');
      return 'familia';
    }
    if (respostasTexto.includes('amigos') || respostasTexto.includes('friends')) {
      console.log('✅ Tipo de companhia via texto: amigos');
      return 'amigos';
    }
    
    console.warn('⚠️ Nenhum tipo de companhia encontrado, usando padrão: sozinho');
    return 'sozinho';  // Default final
  },

  /**
   * ✅ FUNÇÃO CORRIGIDA: Obtém as preferências do usuário 
   */
  obterPreferencias() {
    const tipoViagem = this.obterTipoViagem();
    const tipoCompanhia = this.obterTipoCompanhia();
    
    console.log('📋 Preferências finais:', { tipoViagem, tipoCompanhia });
    
    // Criar objeto de preferências baseado nos dados disponíveis
    return {
      tipoViagem: tipoViagem,
      tipoCompanhia: tipoCompanhia,
      descricaoViagem: this.obterTextoPreferencia(),
      iconeViagem: this.obterIconePreferencia(),
      iconeCompanhia: this.obterIconeCompanhia(),
      // Adicionar detalhes específicos para orientar a IA
      focoPrincipal: this.obterFocoPrincipal(tipoViagem),
      atividadesPreferidas: this.obterAtividadesPreferidas(tipoViagem, tipoCompanhia)
    };
  },

  /**
   * ✅ NOVA FUNÇÃO: Obtém o foco principal baseado no tipo de viagem
   */
  obterFocoPrincipal(tipoViagem) {
    const focos = {
      'relaxar': 'praias, spas, descanso e tranquilidade',
      'aventura': 'trilhas, esportes radicais, natureza e adrenalina',
      'cultura': 'museus, história, arte e patrimônio cultural',
      'urbano': 'vida noturna, compras, restaurantes modernos e experiências urbanas'
    };
    
    return focos[tipoViagem] || focos['cultura'];
  },

  /**
   * ✅ NOVA FUNÇÃO: Obtém atividades preferidas baseadas no perfil
   */
  obterAtividadesPreferidas(tipoViagem, tipoCompanhia) {
    const atividadesPorTipo = {
      'relaxar': ['spas', 'praia', 'parques tranquilos', 'cafeterias aconchegantes'],
      'aventura': ['trilhas', 'esportes radicais', 'parques nacionais', 'atividades ao ar livre'],
      'cultura': ['museus', 'monumentos históricos', 'teatros', 'centros culturais'],
      'urbano': ['rooftops', 'vida noturna', 'compras', 'restaurantes modernos', 'bares', 'clubes']
    };
    
    const atividadesPorCompanhia = {
      'sozinho': ['cafés', 'museus', 'caminhadas urbanas', 'observação da cidade'],
      'casal': ['restaurantes românticos', 'vistas panorâmicas', 'passeios noturnos'],
      'familia': ['parques', 'atividades educativas', 'entretenimento familiar'],
      'amigos': ['bares', 'vida noturna', 'atividades em grupo', 'experiências divertidas']
    };
    
    return [
      ...(atividadesPorTipo[tipoViagem] || []),
      ...(atividadesPorCompanhia[tipoCompanhia] || [])
    ];
  },

  // ===========================================
  // FUNÇÕES AUXILIARES MANTIDAS
  // ===========================================

  obterTextoCompanhia() {
    const tipo = this.obterTipoCompanhia();
    const mapeamento = {
      'sozinho': 'Sozinho(a)',
      'casal': 'Casal',
      'familia': 'Família',
      'amigos': 'Amigos'
    };
    
    const respostas = this.dadosUsuario?.respostas || {};
    
    if (tipo === 'familia' && respostas.quantidade_familia) {
      return `Família (${respostas.quantidade_familia} pessoas)`;
    }
    
    if (tipo === 'amigos' && respostas.quantidade_amigos) {
      return `Amigos (${respostas.quantidade_amigos} pessoas)`;
    }
    
    return mapeamento[tipo] || 'Sozinho(a)';
  },

  obterIconeCompanhia() {
    const tipo = this.obterTipoCompanhia();
    const mapeamento = {
      'sozinho': '🧳',
      'casal': '❤️',
      'familia': '👨‍👩‍👧‍👦',
      'amigos': '🎉'
    };
    
    return mapeamento[tipo] || '🧳';
  },

  extrairNomeDestino(codigoIATA) {
    if (!codigoIATA) return 'Desconhecido';
    
    const mapeamento = {
      'GRU': 'São Paulo',
      'CGH': 'São Paulo',
      'SDU': 'Rio de Janeiro',
      'GIG': 'Rio de Janeiro',
      'BSB': 'Brasília',
      'LIS': 'Lisboa',
      'LON': 'Londres',
      'LHR': 'Londres',
      'CDG': 'Paris',
      'JFK': 'Nova York',
      'LAX': 'Los Angeles',
      'MIA': 'Miami',
      'MAD': 'Madri',
      'BCN': 'Barcelona',
      'FCO': 'Roma',
      'MXP': 'Milão',
      'MDE': 'Medellín',
      'CWB': 'Curitiba'
    };
    
    return mapeamento[codigoIATA] || codigoIATA;
  },

  /**
   * ✅ FUNÇÃO ATUALIZADA: Formatar data para exibição usando data local
   */
  formatarData(dataString) {
    try {
      const dataLocal = this.criarDataLocal(dataString);
      if (!dataLocal) return dataString;
      
      return dataLocal.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long'
      });
    } catch (e) {
      console.warn('⚠️ Erro ao formatar data:', e);
      return dataString;
    }
  },

  /**
   * ✅ FUNÇÃO ATUALIZADA: Formatar data completa usando data local
   */
  formatarDataCompleta(dataString) {
    try {
      const dataLocal = this.criarDataLocal(dataString);
      if (!dataLocal) return dataString;
      
      return dataLocal.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      console.warn('⚠️ Erro ao formatar data completa:', e);
      return dataString;
    }
  },

  obterClasseBadge(tag) {
    tag = tag.toLowerCase();
    
    if (tag.includes('imperd') || tag.includes('obrigat')) return '';
    if (tag.includes('famil') || tag.includes('criança')) return 'badge-green';
    if (tag.includes('histór') || tag.includes('cultur')) return 'badge-blue';
    if (tag.includes('compra') || tag.includes('loja')) return 'badge-purple';
    if (tag.includes('voo') || tag.includes('importante')) return 'badge-red';
    
    return '';
  },

  abrirMapa(local) {
    const query = `${local}, ${this.dadosDestino.destino}, ${this.dadosDestino.pais}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  },

  compartilharRoteiro() {
    if (navigator.share) {
      navigator.share({
        title: `Roteiro Benetrip para ${this.dadosDestino.destino}`,
        text: `Confira meu roteiro personalizado de viagem para ${this.dadosDestino.destino} gerado pela Benetrip!`,
        url: window.location.href
      })
      .then(() => console.log('✅ Roteiro compartilhado com sucesso'))
      .catch((error) => console.log('❌ Erro ao compartilhar:', error));
    } else {
      this.exibirToast('Para compartilhar, copie o link da página e envie para seus amigos!', 'info');
      
      try {
        navigator.clipboard.writeText(window.location.href);
        this.exibirToast('Link copiado para a área de transferência!', 'success');
      } catch (e) {
        console.warn('⚠️ Erro ao copiar para área de transferência:', e);
      }
    }
  },

  editarRoteiro() {
    this.exibirToast('Função de personalização em desenvolvimento', 'info');
  },

  exibirToast(mensagem, tipo = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensagem;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('toast-visible');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  },

  mostrarErro(mensagem) {
    this.exibirToast(mensagem, 'error');
    
    clearInterval(this.intervalId);
    
    const container = document.querySelector('.roteiro-content');
    if (container) {
      container.innerHTML = `
        <div class="erro-container">
          <img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="tripinha-erro">
          <h3 class="erro-titulo">${mensagem}</h3>
          <p class="erro-descricao">Desculpe pelo inconveniente.</p>
          <button class="btn-tentar-novamente">Tentar Novamente</button>
        </div>
      `;
      
      document.querySelector('.btn-tentar-novamente')?.addEventListener('click', () => {
        location.reload();
      });
    }
  },

  // Funções auxiliares...
  simularDelayDev(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  obterDescricaoDia(diaSemana, numeroDia, destino = "Orlando") {
    const descricoes = [
      `Início perfeito em ${destino}! Primeiro dia para conhecer a cidade.`,
      `Explorando a cultura e história de ${destino}.`,
      `Dia perfeito para atividades ao ar livre em ${destino}.`,
      `Mergulhando na gastronomia local de ${destino}.`,
      `Descobrindo os pontos turísticos principais de ${destino}.`,
      `Dia para relaxar e curtir os encantos de ${destino}.`,
      `Explorando os bairros e a vida local de ${destino}.`,
      `Aventuras e experiências únicas em ${destino}.`,
      `Momentos especiais e memórias inesquecíveis em ${destino}.`,
      `Aproveitando os últimos momentos em ${destino}.`
    ];
    
    if (numeroDia === 1) {
      return `Primeiro dia para conhecer ${destino} após a chegada!`;
    }
    
    const indice = (numeroDia - 2) % descricoes.length;
    
    if (numeroDia > 10) {
      return descricoes[descricoes.length - 1];
    }
    
    return descricoes[indice];
  },

  gerarAtividadesPeriodo(periodo, diaSemana, numeroDia, destino = "Orlando") {
    const atividadesGenericas = {
      manha: [
        { horario: "09:00", local: "Centro da Cidade", dica: "Comece o dia explorando o centro histórico!" },
        { horario: "10:00", local: "Museu Principal", dica: "Ótima oportunidade para conhecer a história local!" },
        { horario: "09:30", local: "Mercado Local", dica: "Experimente os produtos frescos da região!" },
        { horario: "10:30", local: "Igreja/Catedral Principal", dica: "Arquitetura impressionante e história fascinante!" },
        { horario: "09:00", local: "Parque Central", dica: "Perfeito para uma caminhada matinal relaxante!" },
        { horario: "10:00", local: "Centro Cultural", dica: "Exposições interessantes sobre a cultura local!" },
        { horario: "09:30", local: "Bairro Histórico", dica: "Ruas cheias de charme e história!" },
        { horario: "10:30", local: "Praça Principal", dica: "Coração da cidade, sempre vibrante!" }
      ],
      tarde: [
        { horario: "14:00", local: "Pontos Turísticos Principais", dica: "As atrações mais famosas esperam por você!" },
        { horario: "15:00", local: "Bairro Artístico", dica: "Galerias de arte e lojas interessantes!" },
        { horario: "14:30", local: "Jardim Botânico", dica: "Natureza exuberante no centro da cidade!" },
        { horario: "15:30", local: "Centro de Compras", dica: "Ótimo lugar para souvenirs e compras!" },
        { horario: "14:00", local: "Área Gastronômica", dica: "Prove a culinária local autêntica!" },
        { horario: "15:00", local: "Vista Panorâmica", dica: "As melhores vistas da cidade!" },
        { horario: "14:30", local: "Bairro Moderno", dica: "Arquitetura contemporânea e lifestyle urbano!" },
        { horario: "15:30", local: "Área de Lazer", dica: "Relaxe e aproveite o ambiente local!" }
      ],
      noite: [
        { horario: "19:00", local: "Restaurante Típico", dica: "Jantar com os sabores autênticos da região!" },
        { horario: "20:00", local: "Vida Noturna Local", dica: "Experiência noturna autêntica!" },
        { horario: "19:30", local: "Teatro/Casa de Shows", dica: "Cultura e entretenimento noturno!" },
        { horario: "20:30", local: "Bar com Vista", dica: "Perfeito para relaxar com vistas incríveis!" },
        { horario: "19:00", local: "Food Street", dica: "Variedade gastronômica em ambiente animado!" },
        { horario: "20:00", local: "Passeio Noturno", dica: "A cidade tem um charme especial à noite!" },
        { horario: "19:30", local: "Rooftop Bar", dica: "Vista privilegiada e drinks especiais!" },
        { horario: "20:30", local: "Área Cultural", dica: "Eventos culturais e artisticos noturnos!" }
      ]
    };
    
    const atividadesPersonalizadas = atividadesGenericas[periodo].map(ativ => ({
      horario: ativ.horario,
      local: ativ.local.replace(/Centro da Cidade|Museu Principal|Igreja\/Catedral Principal/g, (match) => {
        if (destino.toLowerCase().includes('paulo')) {
          if (match === "Centro da Cidade") return "Centro Histórico de SP";
          if (match === "Museu Principal") return "MASP";
          if (match === "Igreja/Catedral Principal") return "Catedral da Sé";
        }
        return match + ` de ${destino}`;
      }),
      dica: ativ.dica,
      tags: ["Local", "Recomendado"]
    }));
    
    let atividades = [];
    const indice = (numeroDia + diaSemana) % atividadesPersonalizadas.length;
    atividades = [atividadesPersonalizadas[indice]];
    
    if (numeroDia > 1 && numeroDia % 3 === 0) {
      const segundoIndice = (indice + 1) % atividadesPersonalizadas.length;
      atividades.push(atividadesPersonalizadas[segundoIndice]);
    }
    
    return { atividades };
  }
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('roteiro-container')) {
    console.log('🚀 Inicializando módulo de roteiro Benetrip...');
    BENETRIP_ROTEIRO.init();
  }
});

// Exportar para acesso global
window.BENETRIP_ROTEIRO = BENETRIP_ROTEIRO;
