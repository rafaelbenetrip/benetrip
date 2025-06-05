/**
 * Benetrip - Sistema de Roteiro Personalizado (VERSÃO OTIMIZADA)
 * Responsável por gerar e exibir roteiros personalizados de viagem
 * Versão: 5.0 - Otimizada com correções de horários
 */

const BENETRIP_ROTEIRO = {
  // Estado
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
    
    this.configurarEventos();
    this.iniciarAnimacaoProgresso();
  },

  /**
   * Configura eventos dos botões
   */
  configurarEventos() {
    document.getElementById('btn-compartilhar-roteiro')?.addEventListener('click', () => this.compartilharRoteiro());
    document.getElementById('btn-editar-roteiro')?.addEventListener('click', () => this.editarRoteiro());
    document.querySelector('.btn-voltar')?.addEventListener('click', () => history.back());
  },

  /**
   * ✅ FUNÇÃO CORRIGIDA: Carrega os dados necessários para o roteiro
   */
  async carregarDados() {
    try {
      console.log('🔄 Carregando dados para roteiro...');
      
      // Carregar dados do voo selecionado
      const vooString = localStorage.getItem('benetrip_voo_selecionado');
      if (!vooString) throw new Error('Nenhum voo selecionado');
      this.dadosVoo = JSON.parse(vooString);
      
      // Carregar dados do usuário
      const usuarioString = localStorage.getItem('benetrip_user_data');
      this.dadosUsuario = usuarioString ? JSON.parse(usuarioString) : {};
      
      // Carregar dados do destino
      const destinoString = localStorage.getItem('benetrip_destino_selecionado');
      this.dadosDestino = destinoString ? JSON.parse(destinoString) : {
        destino: this.extrairNomeDestino(this.getDestinoCode()),
        codigo_iata: this.getDestinoCode(),
        pais: 'Desconhecido'
      };
      
      this.normalizarDatasVoo();
      this.validarHorariosVoo();
      
      return true;
    } catch (erro) {
      console.error('❌ Erro ao carregar dados:', erro);
      throw erro;
    }
  },

  /**
   * ✅ NOVA FUNÇÃO: Extrai código do destino de forma inteligente
   */
  getDestinoCode() {
    return this.dadosVoo?.infoIda?.aeroportoChegada || 
           this.dadosVoo?.ida?.destino || 
           this.dadosVoo?.voo?.segment?.[0]?.flight?.[0]?.arrival ||
           'Unknown';
  },

  /**
   * ✅ NOVA FUNÇÃO: Extrai horário de chegada de forma inteligente
   */
  extrairHorarioChegada() {
    return this.dadosVoo?.infoIda?.horaChegada ||
           this.dadosVoo?.ida?.horaChegada ||
           this.dadosVoo?.voo?.segment?.[0]?.flight?.[0]?.arrival_time ||
           this.dadosVoo?.segment?.[0]?.flight?.[0]?.arrival_time ||
           '15:30';
  },

  /**
   * ✅ NOVA FUNÇÃO: Extrai horário de partida de forma inteligente
   */
  extrairHorarioPartida() {
    return this.dadosVoo?.infoVolta?.horaPartida ||
           this.dadosVoo?.volta?.horaPartida ||
           this.dadosVoo?.voo?.segment?.[1]?.flight?.[0]?.departure_time ||
           this.dadosVoo?.segment?.[1]?.flight?.[0]?.departure_time ||
           '21:00';
  },

  /**
   * ✅ FUNÇÃO OTIMIZADA: Normaliza as datas do voo
   */
  normalizarDatasVoo() {
    console.log('🔄 Normalizando datas do voo...');
    
    const dataIda = this.dadosVoo?.infoIda?.dataPartida || this.dadosVoo?.ida?.dataPartida;
    const dataVolta = this.dadosVoo?.infoVolta?.dataPartida || this.dadosVoo?.volta?.dataPartida;
    
    if (!dataIda && this.dadosUsuario?.respostas?.datas) {
      const datasUsuario = this.dadosUsuario.respostas.datas;
      let ida, volta;
      
      if (typeof datasUsuario === 'object' && datasUsuario.dataIda) {
        ida = datasUsuario.dataIda;
        volta = datasUsuario.dataVolta;
      } else if (Array.isArray(datasUsuario)) {
        [ida, volta] = datasUsuario;
      } else if (typeof datasUsuario === 'string') {
        [ida, volta] = datasUsuario.split(',').map(d => d.trim());
      }
      
      if (ida) {
        this.dadosVoo = this.dadosVoo || {};
        this.dadosVoo.infoIda = { ...this.dadosVoo.infoIda, dataPartida: this.formatarDataISO(ida) };
        if (volta) {
          this.dadosVoo.infoVolta = { ...this.dadosVoo.infoVolta, dataPartida: this.formatarDataISO(volta) };
        }
      }
    }
    
    if (!this.getDataIda()) {
      throw new Error('Datas de viagem não disponíveis');
    }
  },

  /**
   * Helpers para datas
   */
  getDataIda() {
    return this.dadosVoo?.infoIda?.dataPartida || this.dadosVoo?.ida?.dataPartida;
  },

  getDataVolta() {
    return this.dadosVoo?.infoVolta?.dataPartida || this.dadosVoo?.volta?.dataPartida;
  },

  /**
   * ✅ FUNÇÃO OTIMIZADA: Formata data para ISO
   */
  formatarDataISO(dataInput) {
    if (!dataInput) return null;
    
    if (typeof dataInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataInput)) {
      return dataInput;
    }
    
    if (typeof dataInput === 'string' && dataInput.includes('T')) {
      return dataInput.split('T')[0];
    }
    
    try {
      const data = new Date(dataInput);
      if (isNaN(data.getTime())) return null;
      
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const dia = String(data.getDate()).padStart(2, '0');
      
      return `${ano}-${mes}-${dia}`;
    } catch (e) {
      return null;
    }
  },

  /**
   * Animação de progresso
   */
  iniciarAnimacaoProgresso() {
    const mensagens = [
      'Preparando seu roteiro personalizado...',
      'Analisando seu perfil de viagem...',
      'Buscando pontos turísticos...',
      'Organizando atividades por dias...',
      'Checando previsão do tempo...'
    ];
    
    let indice = 0;
    this.intervalId = setInterval(() => {
      this.progressoAtual += 15;
      if (this.progressoAtual >= 95) {
        clearInterval(this.intervalId);
        return;
      }
      this.atualizarBarraProgresso(this.progressoAtual, mensagens[indice % mensagens.length]);
      indice++;
    }, 800);
  },

  atualizarBarraProgresso(porcentagem, mensagem) {
    const barra = document.querySelector('.progress-bar');
    const texto = document.querySelector('.loading-text');
    
    if (barra) {
      barra.style.width = `${porcentagem}%`;
      barra.setAttribute('aria-valuenow', porcentagem);
    }
    if (texto) texto.textContent = mensagem;
  },

  /**
   * ✅ FUNÇÃO PRINCIPAL: Gera o roteiro personalizado
   */
  async gerarRoteiro() {
    try {
      console.log('🎯 Gerando roteiro...');
      
      const dataIda = this.formatarDataISO(this.getDataIda());
      const dataVolta = this.formatarDataISO(this.getDataVolta());
      const diasReais = this.calcularDiasViagem(dataIda, dataVolta);
      
      const params = {
        destino: this.dadosDestino?.destino || this.extrairNomeDestino(this.getDestinoCode()),
        pais: this.dadosDestino?.pais || 'Desconhecido',
        dataInicio: dataIda,
        dataFim: dataVolta,
        diasViagem: diasReais,
        horaChegada: this.extrairHorarioChegada(),
        horaSaida: this.extrairHorarioPartida(),
        tipoViagem: this.obterTipoViagem(),
        tipoCompanhia: this.obterTipoCompanhia(),
        preferencias: this.obterPreferencias()
      };
      
      // Usar dados dummy ou API real
      if (this.isDesenvolvimento()) {
        await this.delay(2000);
        this.roteiroPronto = this.gerarRoteiroDummy(dataIda, dataVolta, diasReais);
      } else {
        const response = await fetch('/api/itinerary-generator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        this.roteiroPronto = await response.json();
        this.ajustarDatasRoteiro(dataIda, diasReais);
      }
      
      await Promise.all([
        this.buscarPrevisaoTempo(),
        this.buscarImagensLocais()
      ]);
      
      this.atualizarUIComRoteiro();
      
    } catch (erro) {
      console.error('❌ Erro ao gerar roteiro:', erro);
      this.mostrarErro('Não foi possível gerar seu roteiro. Tente novamente.');
    } finally {
      this.finalizarCarregamento();
    }
  },

  isDesenvolvimento() {
    return ['localhost', '127.0.0.1', ''].includes(location.hostname);
  },

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  finalizarCarregamento() {
    clearInterval(this.intervalId);
    this.estaCarregando = false;
    this.atualizarBarraProgresso(100, 'Roteiro pronto!');
    
    setTimeout(() => {
      const loading = document.querySelector('.loading-container');
      if (loading) loading.style.display = 'none';
    }, 500);
  },

  /**
   * ✅ FUNÇÃO OTIMIZADA: Calcula dias de viagem
   */
  calcularDiasViagem(dataIda, dataVolta) {
    if (!dataIda) return 1;
    if (!dataVolta) return 1;
    
    try {
      const inicio = new Date(dataIda + 'T12:00:00');
      const fim = new Date(dataVolta + 'T12:00:00');
      const diffDias = Math.floor((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, diffDias);
    } catch (e) {
      return 1;
    }
  },

  /**
   * ✅ FUNÇÃO CORRIGIDA: Validar horários dos voos
   */
  validarHorariosVoo() {
    const horarioChegada = this.extrairHorarioChegada();
    const horarioPartida = this.extrairHorarioPartida();
    
    console.log(`🛬 Horário de chegada: ${horarioChegada}`);
    console.log(`🛫 Horário de partida: ${horarioPartida}`);
    
    // Validar formato básico
    const formatoHorario = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!formatoHorario.test(horarioChegada)) {
      console.warn(`⚠️ Formato inválido - chegada: ${horarioChegada}`);
    }
    if (horarioPartida && !formatoHorario.test(horarioPartida)) {
      console.warn(`⚠️ Formato inválido - partida: ${horarioPartida}`);
    }
  },

  /**
   * ✅ FUNÇÃO OTIMIZADA: Gera roteiro dummy com horários corretos
   */
  gerarRoteiroDummy(dataIda, dataVolta, diasReais) {
    const dias = [];
    const dataInicio = new Date(dataIda + 'T12:00:00');
    
    for (let i = 0; i < diasReais; i++) {
      const dataAtual = new Date(dataInicio);
      dataAtual.setDate(dataInicio.getDate() + i);
      
      const dataFormatada = dataAtual.toISOString().split('T')[0];
      const diaSemana = dataAtual.getDay();
      
      dias.push({
        data: dataFormatada,
        descricao: this.obterDescricaoDia(i + 1, this.dadosDestino?.destino || 'seu destino'),
        manha: this.gerarAtividadesPeriodo('manha', i + 1),
        tarde: this.gerarAtividadesPeriodo('tarde', i + 1),
        noite: this.gerarAtividadesPeriodo('noite', i + 1)
      });
    }
    
    this.ajustarAtividadesPorHorarios(dias);
    
    return {
      destino: `${this.dadosDestino?.destino || 'Seu Destino'}, ${this.dadosDestino?.pais || 'Mundo'}`,
      dias
    };
  },

  /**
   * ✅ FUNÇÃO OTIMIZADA: Ajusta atividades baseado nos horários do voo
   */
  ajustarAtividadesPorHorarios(dias) {
    if (!dias.length) return;
    
    const horarioChegada = this.extrairHorarioChegada();
    const horarioPartida = this.extrairHorarioPartida();
    
    const horaChegada = parseInt(horarioChegada.split(':')[0]);
    const horaPartida = horarioPartida ? parseInt(horarioPartida.split(':')[0]) : null;
    
    // Ajustar primeiro dia
    if (horaChegada < 8) {
      dias[0].observacao = "Chegada madrugada - dia completo disponível!";
      this.adicionarAtividadeEspecial(dias[0].manha, "Check-in hotel", horarioChegada);
    } else if (horaChegada < 12) {
      dias[0].observacao = "Chegada manhã - aproveite o dia!";
      this.adicionarAtividadeEspecial(dias[0].manha, "Check-in e exploração", horarioChegada);
    } else if (horaChegada < 16) {
      dias[0].observacao = "Chegada meio-dia - tarde livre!";
      this.adicionarAtividadeEspecial(dias[0].tarde, "Check-in e descanso", horarioChegada);
    } else if (horaChegada < 20) {
      dias[0].observacao = "Chegada tarde - explore a noite!";
      this.adicionarAtividadeEspecial(dias[0].tarde, "Check-in", horarioChegada);
    } else {
      dias[0].observacao = "Chegada noturna - descanse!";
      dias[0].noite.atividades = [{
        horario: horarioChegada,
        local: "Hotel",
        dica: "Chegada noturna - foque no descanso!",
        tags: ["Descanso"],
        isEspecial: true
      }];
    }
    
    // Ajustar último dia se houver volta
    if (horaPartida && dias.length > 1) {
      const ultimoDia = dias.length - 1;
      
      if (horaPartida < 8) {
        dias[ultimoDia].observacao = "Partida muito cedo - prepare-se!";
        dias[ultimoDia].noite.atividades = [{
          horario: "22:00",
          local: "Hotel",
          dica: "Prepare bagagens e descanse - voo cedo!",
          tags: ["Preparação"],
          isEspecial: true
        }];
      } else if (horaPartida < 14) {
        dias[ultimoDia].observacao = "Partida manhã - tempo limitado!";
        this.adicionarAtividadeEspecial(dias[ultimoDia].manha, "Check-out e transfer", 
          this.calcularHorarioCheckout(horarioPartida));
      } else if (horaPartida < 20) {
        dias[ultimoDia].observacao = "Partida tarde - manhã livre!";
        this.adicionarAtividadeEspecial(dias[ultimoDia].tarde, "Transfer aeroporto", 
          this.calcularHorarioCheckout(horarioPartida));
      } else {
        dias[ultimoDia].observacao = "Partida noturna - dia completo!";
        this.adicionarAtividadeEspecial(dias[ultimoDia].noite, "Transfer aeroporto", 
          this.calcularHorarioCheckout(horarioPartida));
      }
    }
  },

  adicionarAtividadeEspecial(periodo, descricao, horario) {
    if (!periodo.atividades) periodo.atividades = [];
    periodo.atividades.unshift({
      horario,
      local: descricao,
      dica: "Atividade relacionada ao seu voo!",
      tags: ["Voo"],
      isEspecial: true
    });
  },

  calcularHorarioCheckout(horarioPartida) {
    const hora = parseInt(horarioPartida.split(':')[0]) - 3;
    return `${String(Math.max(6, hora)).padStart(2, '0')}:00`;
  },

  /**
   * ✅ FUNÇÃO OTIMIZADA: Busca previsão do tempo
   */
  async buscarPrevisaoTempo() {
    try {
      if (!this.roteiroPronto?.dias) return;
      
      const cidade = this.dadosDestino.destino.replace(/\s+Internacional/i, '').replace(/\s*,.*$/, '');
      const dataInicio = this.formatarDataISO(this.getDataIda());
      const dataFim = this.formatarDataISO(this.getDataVolta());
      
      const url = `/api/weather?city=${encodeURIComponent(cidade)}&start=${dataInicio}${dataFim ? `&end=${dataFim}` : ''}`;
      
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, { signal: controller.signal });
      
      if (response.ok) {
        const previsoes = await response.json();
        this.roteiroPronto.dias.forEach((dia, index) => {
          dia.previsao = previsoes[index] || this.gerarPrevisaoFicticia(index);
        });
      }
    } catch (e) {
      console.warn('⚠️ Erro ao buscar previsão:', e);
    } finally {
      this.garantirPrevisoesTodosDias();
    }
  },

  garantirPrevisoesTodosDias() {
    if (!this.roteiroPronto?.dias) return;
    this.roteiroPronto.dias.forEach((dia, index) => {
      if (!dia.previsao) {
        dia.previsao = this.gerarPrevisaoFicticia(index);
      }
    });
  },

  gerarPrevisaoFicticia(index) {
    const condicoes = [
      { icon: '☀️', condition: 'Ensolarado', temp: 28 },
      { icon: '🌤️', condition: 'Parcialmente nublado', temp: 25 },
      { icon: '☁️', condition: 'Nublado', temp: 22 }
    ];
    
    const condicao = condicoes[index % condicoes.length];
    const tempVariacao = Math.floor(Math.random() * 6) - 3;
    
    return {
      icon: condicao.icon,
      temperature: Math.max(15, condicao.temp + tempVariacao),
      condition: condicao.condition,
      date: new Date().toISOString().split('T')[0]
    };
  },

  /**
   * Busca imagens para os locais
   */
  async buscarImagensLocais() {
    try {
      if (!this.roteiroPronto?.dias) return;
      
      const pontos = new Set();
      this.roteiroPronto.dias.forEach(dia => {
        ['manha', 'tarde', 'noite'].forEach(periodo => {
          if (dia[periodo]?.atividades) {
            dia[periodo].atividades.forEach(ativ => {
              if (ativ.local) pontos.add(ativ.local);
            });
          }
        });
      });
      
      const imagensPromises = [...pontos].slice(0, 10).map(async (local) => {
        try {
          const response = await fetch(`/api/image-search?query=${encodeURIComponent(local)}&perPage=1`);
          if (response.ok) {
            const dados = await response.json();
            return { local, imagem: dados.images[0]?.url };
          }
        } catch (e) {
          return { local, imagem: null };
        }
      });
      
      const resultados = await Promise.all(imagensPromises);
      const mapaImagens = {};
      resultados.forEach(r => {
        if (r.imagem) mapaImagens[r.local] = r.imagem;
      });
      
      this.roteiroPronto.dias.forEach(dia => {
        ['manha', 'tarde', 'noite'].forEach(periodo => {
          if (dia[periodo]?.atividades) {
            dia[periodo].atividades.forEach(ativ => {
              if (ativ.local && mapaImagens[ativ.local]) {
                ativ.imagemUrl = mapaImagens[ativ.local];
              }
            });
          }
        });
      });
    } catch (e) {
      console.warn('⚠️ Erro ao buscar imagens:', e);
    }
  },

  /**
   * ✅ FUNÇÃO OTIMIZADA: Atualiza a interface
   */
  atualizarUIComRoteiro() {
    const container = document.querySelector('.roteiro-content');
    if (!container) return;
    
    container.innerHTML = '';
    
    const header = document.querySelector('.app-header h1');
    if (header) {
      header.textContent = `Seu Roteiro para ${this.dadosDestino.destino}`;
    }
    
    container.appendChild(this.criarResumoViagem());
    
    this.roteiroPronto.dias.forEach((dia, index) => {
      container.appendChild(this.criarElementoDia(dia, index + 1));
    });
  },

  /**
   * ✅ FUNÇÃO CORRIGIDA: Cria resumo da viagem com horários corretos
   */
  criarResumoViagem() {
    const resumo = document.createElement('div');
    resumo.className = 'resumo-viagem';
    
    const dataIda = this.formatarData(this.getDataIda());
    const dataVolta = this.getDataVolta() ? this.formatarData(this.getDataVolta()) : null;
    const diasViagem = this.calcularDiasViagem(
      this.formatarDataISO(this.getDataIda()), 
      this.formatarDataISO(this.getDataVolta())
    );
    
    const horaChegada = this.extrairHorarioChegada();
    const horaPartida = this.extrairHorarioPartida();
    
    resumo.innerHTML = `
      <div class="resumo-viagem-header">📋 Resumo da Viagem</div>
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
            <p class="valor">Chegada ${horaChegada}${horaPartida !== '21:00' ? ` - Saída ${horaPartida}` : ''}</p>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="icone">${this.obterIconeCompanhia()}</div>
          <div class="texto">
            <div class="label">Grupo:</div>
            <p class="valor">${this.obterTextoCompanhia()}</p>
          </div>
        </div>
        
        <div class="resumo-item">
          <div class="icone">${this.obterIconePreferencia()}</div>
          <div class="texto">
            <div class="label">Preferência:</div>
            <p class="valor">${this.obterTextoPreferencia()}</p>
          </div>
        </div>
      </div>
    `;
    
    return resumo;
  },

  /**
   * ✅ FUNÇÃO OTIMIZADA: Cria elemento de um dia do roteiro
   */
  criarElementoDia(dia, numeroDia) {
    const elemento = document.createElement('div');
    elemento.className = 'dia-roteiro';
    
    const dataFormatada = this.formatarDataCompleta(dia.data);
    const observacao = dia.observacao ? 
      `<div class="dia-observacao"><span>💡</span> ${dia.observacao}</div>` : '';
    
    elemento.innerHTML = `
      <div class="dia-header">
        <div class="dia-numero">${numeroDia}</div>
        <span>Dia ${numeroDia} — ${dataFormatada}</span>
      </div>
      
      <div class="dia-content">
        <p class="dia-descricao">"${dia.descricao}"</p>
        ${observacao}
        ${this.criarPrevisaoTempo(dia.previsao)}
        
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
          ${this.criarConteudoPeriodo(dia.manha)}
        </div>
        
        <div class="periodo-conteudo" id="dia-${numeroDia}-tarde" style="display: none;">
          ${this.criarConteudoPeriodo(dia.tarde)}
        </div>
        
        <div class="periodo-conteudo" id="dia-${numeroDia}-noite" style="display: none;">
          ${this.criarConteudoPeriodo(dia.noite)}
        </div>
      </div>
    `;
    
    setTimeout(() => this.configurarEventosDia(elemento, numeroDia), 100);
    
    return elemento;
  },

  configurarEventosDia(elemento, numeroDia) {
    const tabs = elemento.querySelectorAll('.periodo-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const conteudos = elemento.querySelectorAll('.periodo-conteudo');
        conteudos.forEach(c => c.style.display = 'none');
        
        const periodo = tab.getAttribute('data-periodo');
        const conteudo = document.getElementById(`dia-${numeroDia}-${periodo}`);
        if (conteudo) conteudo.style.display = 'block';
      });
    });
    
    const botoesMapa = elemento.querySelectorAll('.btn-ver-mapa');
    botoesMapa.forEach(botao => {
      botao.addEventListener('click', () => {
        const local = botao.getAttribute('data-local');
        if (local) this.abrirMapa(local);
      });
    });
  },

  criarPrevisaoTempo(previsao) {
    if (!previsao) return '';
    return `
      <div class="previsao-tempo">
        <span>${previsao.icon || '🌤️'}</span>
        <span class="font-medium">Previsão: ${previsao.temperature || '--'}°C, ${previsao.condition || 'Parcialmente nublado'}</span>
      </div>
    `;
  },

  criarConteudoPeriodo(periodo) {
    if (!periodo?.atividades?.length) {
      return '<div class="periodo-vazio"><p>Nenhuma atividade planejada.</p></div>';
    }
    
    return periodo.atividades.map(ativ => `
      <div class="atividade${ativ.isEspecial ? ' atividade-especial' : ''}">
        ${ativ.horario ? `
          <div class="atividade-horario">
            <span>🕒</span> <span>${ativ.horario}</span>
          </div>
        ` : ''}
        
        <div class="atividade-local">
          <span>📍</span>
          <div>
            <span class="nome">${ativ.local}</span>
            ${ativ.tags?.length ? `
              <div class="atividade-badges">
                ${ativ.tags.map(tag => `<span class="badge">${tag}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
        
        ${ativ.dica ? `
          <div class="tripinha-dica">
            <div class="tripinha-dica-conteudo">
              <div class="tripinha-avatar">
                <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha">
              </div>
              <div class="tripinha-texto">
                <strong>Dica da Tripinha:</strong> ${ativ.dica}
              </div>
            </div>
          </div>
        ` : ''}
        
        ${ativ.imagemUrl ? `
          <div class="imagem-local">
            <img src="${ativ.imagemUrl}" alt="${ativ.local}" loading="lazy">
          </div>
        ` : ''}
        
        ${!ativ.isEspecial ? `
          <button class="btn-ver-mapa" data-local="${ativ.local}">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
            </svg>
            Ver no mapa
          </button>
        ` : ''}
      </div>
    `).join('');
  },

  // ===========================================
  // FUNÇÕES DE MAPEAMENTO E HELPERS
  // ===========================================

  obterTipoViagem() {
    const respostas = this.dadosUsuario?.respostas || {};
    
    if (typeof respostas.estilo_viagem_destino === 'number') {
      return ['relaxar', 'aventura', 'cultura', 'urbano'][respostas.estilo_viagem_destino] || 'cultura';
    }
    
    if (typeof respostas.destino_imaginado === 'number') {
      const mapa = { 0: 'relaxar', 1: 'aventura', 2: 'urbano', 3: 'cultura' };
      return mapa[respostas.destino_imaginado] || 'cultura';
    }
    
    return 'cultura';
  },

  obterTipoCompanhia() {
    const respostas = this.dadosUsuario?.respostas || {};
    
    if (typeof respostas.companhia === 'number') {
      return ['sozinho', 'casal', 'familia', 'amigos'][respostas.companhia] || 'sozinho';
    }
    
    return 'sozinho';
  },

  obterPreferencias() {
    return {
      tipoViagem: this.obterTipoViagem(),
      tipoCompanhia: this.obterTipoCompanhia()
    };
  },

  obterTextoPreferencia() {
    const mapa = {
      'relaxar': 'Relaxamento e Praia',
      'aventura': 'Aventura e Natureza', 
      'cultura': 'Cultura e História',
      'urbano': 'Urbano e Vida Noturna'
    };
    return mapa[this.obterTipoViagem()] || 'Cultura e História';
  },

  obterIconePreferencia() {
    const mapa = {
      'relaxar': '🏖️',
      'aventura': '🏔️',
      'cultura': '🏛️', 
      'urbano': '🏙️'
    };
    return mapa[this.obterTipoViagem()] || '🏛️';
  },

  obterTextoCompanhia() {
    const mapa = {
      'sozinho': 'Sozinho(a)',
      'casal': 'Casal',
      'familia': 'Família',
      'amigos': 'Amigos'
    };
    return mapa[this.obterTipoCompanhia()] || 'Sozinho(a)';
  },

  obterIconeCompanhia() {
    const mapa = {
      'sozinho': '🧳',
      'casal': '❤️',
      'familia': '👨‍👩‍👧‍👦',
      'amigos': '🎉'
    };
    return mapa[this.obterTipoCompanhia()] || '🧳';
  },

  extrairNomeDestino(codigo) {
    const mapa = {
      'GRU': 'São Paulo', 'CGH': 'São Paulo',
      'SDU': 'Rio de Janeiro', 'GIG': 'Rio de Janeiro',
      'BSB': 'Brasília', 'LIS': 'Lisboa',
      'LON': 'Londres', 'LHR': 'Londres',
      'CDG': 'Paris', 'JFK': 'Nova York',
      'LAX': 'Los Angeles', 'MIA': 'Miami',
      'MAD': 'Madri', 'BCN': 'Barcelona',
      'FCO': 'Roma', 'MXP': 'Milão',
      'MDE': 'Medellín', 'CWB': 'Curitiba',
      'AEP': 'Buenos Aires'
    };
    return mapa[codigo] || codigo;
  },

  formatarData(dataString) {
    try {
      const data = new Date(dataString + 'T12:00:00');
      return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    } catch (e) {
      return dataString;
    }
  },

  formatarDataCompleta(dataString) {
    try {
      const data = new Date(dataString + 'T12:00:00');
      return data.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric', 
        month: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return dataString;
    }
  },

  obterDescricaoDia(numeroDia, destino) {
    const descricoes = [
      `Primeiro dia para conhecer ${destino} após a chegada!`,
      `Explorando a cultura e história de ${destino}.`,
      `Dia perfeito para atividades ao ar livre em ${destino}.`,
      `Mergulhando na gastronomia local de ${destino}.`,
      `Descobrindo os pontos turísticos principais de ${destino}.`,
      `Aproveitando os últimos momentos em ${destino}.`
    ];
    
    return descricoes[Math.min(numeroDia - 1, descricoes.length - 1)];
  },

  gerarAtividadesPeriodo(periodo, numeroDia) {
    const atividades = {
      manha: [
        { horario: "09:00", local: "Centro da Cidade", dica: "Comece explorando o centro histórico!" },
        { horario: "10:00", local: "Museu Principal", dica: "História local fascinante!" },
        { horario: "09:30", local: "Mercado Local", dica: "Produtos frescos da região!" }
      ],
      tarde: [
        { horario: "14:00", local: "Pontos Turísticos", dica: "Atrações mais famosas!" },
        { horario: "15:00", local: "Bairro Artístico", dica: "Galerias e lojas interessantes!" },
        { horario: "14:30", local: "Jardim Botânico", dica: "Natureza no centro da cidade!" }
      ],
      noite: [
        { horario: "19:00", local: "Restaurante Típico", dica: "Sabores autênticos da região!" },
        { horario: "20:00", local: "Vida Noturna Local", dica: "Experiência noturna autêntica!" },
        { horario: "19:30", local: "Teatro Local", dica: "Cultura e entretenimento!" }
      ]
    };
    
    const lista = atividades[periodo] || [];
    const indice = (numeroDia - 1) % lista.length;
    
    return {
      atividades: [{ 
        ...lista[indice], 
        tags: ["Local", "Recomendado"] 
      }]
    };
  },

  ajustarDatasRoteiro(dataIda, diasReais) {
    if (!this.roteiroPronto?.dias) return;
    
    const dataInicio = new Date(dataIda + 'T12:00:00');
    
    this.roteiroPronto.dias.forEach((dia, index) => {
      const dataDia = new Date(dataInicio);
      dataDia.setDate(dataInicio.getDate() + index);
      dia.data = dataDia.toISOString().split('T')[0];
    });
    
    this.ajustarAtividadesPorHorarios(this.roteiroPronto.dias);
  },

  // ===========================================
  // FUNÇÕES DE INTERAÇÃO
  // ===========================================

  abrirMapa(local) {
    const query = `${local}, ${this.dadosDestino.destino}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  },

  compartilharRoteiro() {
    if (navigator.share) {
      navigator.share({
        title: `Roteiro Benetrip para ${this.dadosDestino.destino}`,
        text: `Confira meu roteiro personalizado para ${this.dadosDestino.destino}!`,
        url: window.location.href
      }).catch(e => console.log('Erro ao compartilhar:', e));
    } else {
      try {
        navigator.clipboard.writeText(window.location.href);
        this.exibirToast('Link copiado!', 'success');
      } catch (e) {
        this.exibirToast('Para compartilhar, copie o link da página!', 'info');
      }
    }
  },

  editarRoteiro() {
    this.exibirToast('Função em desenvolvimento', 'info');
  },

  exibirToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensagem;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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
          <button class="btn-tentar-novamente" onclick="location.reload()">Tentar Novamente</button>
        </div>
      `;
    }
  }
};

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('roteiro-container')) {
    console.log('🚀 Inicializando módulo de roteiro Benetrip...');
    BENETRIP_ROTEIRO.init();
  }
});

// Exportar para acesso global
window.BENETRIP_ROTEIRO = BENETRIP_ROTEIRO;
