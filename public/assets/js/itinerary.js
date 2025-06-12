/**
 * Benetrip - Sistema de Roteiro Personalizado (VERSÃO 7.0 - OTIMIZADA)
 * Corrige: datas inválidas, imagens limitadas e previsão do tempo
 * Data: 2025
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
  imagensCache: new Map(), // Cache de imagens para evitar requisições duplicadas

  /**
   * Inicializa o sistema de roteiro
   */
  init() {
    console.log('🚀 Benetrip Roteiro v7.0 - Inicializando...');
    
    this.carregarDados()
      .then(() => this.gerarRoteiro())
      .catch(erro => {
        console.error('❌ Erro fatal:', erro);
        this.mostrarErro('Erro ao carregar dados. Por favor, tente novamente.');
      });
    
    this.configurarEventos();
    this.iniciarAnimacaoProgresso();
  },

  /**
   * Configura eventos dos botões
   */
  configurarEventos() {
    // Botões principais
    document.getElementById('btn-compartilhar-roteiro')?.addEventListener('click', () => this.compartilharRoteiro());
    document.getElementById('btn-editar-roteiro')?.addEventListener('click', () => this.editarRoteiro());
    document.querySelector('.btn-voltar')?.addEventListener('click', () => history.back());
    
    // Prevenir erros de imagem no console
    document.addEventListener('error', (e) => {
      if (e.target.tagName === 'IMG') {
        console.warn('⚠️ Imagem falhou:', e.target.src);
      }
    }, true);
  },

  /**
   * ✅ CORRIGIDO: Carrega e valida dados do localStorage
   */
  async carregarDados() {
    try {
      console.log('📂 Carregando dados salvos...');
      
      // 1. Carregar voo selecionado
      const vooString = localStorage.getItem('benetrip_voo_selecionado');
      if (!vooString) {
        throw new Error('Nenhum voo foi selecionado. Redirecionando...');
      }
      
      this.dadosVoo = JSON.parse(vooString);
      console.log('✈️ Dados do voo carregados:', this.dadosVoo);
      
      // 2. Carregar dados do usuário
      const usuarioString = localStorage.getItem('benetrip_user_data');
      this.dadosUsuario = usuarioString ? JSON.parse(usuarioString) : {};
      console.log('👤 Dados do usuário carregados:', this.dadosUsuario);
      
      // 3. Carregar destino
      const destinoString = localStorage.getItem('benetrip_destino_selecionado');
      if (destinoString) {
        this.dadosDestino = JSON.parse(destinoString);
      } else {
        // Fallback: criar destino baseado no voo
        const codigoDestino = this.extrairCodigoDestino();
        this.dadosDestino = {
          destino: this.obterNomeDestinoPorCodigo(codigoDestino),
          codigo_iata: codigoDestino,
          pais: this.obterPaisPorCodigo(codigoDestino)
        };
      }
      console.log('📍 Destino definido:', this.dadosDestino);
      
      // 4. Normalizar e validar datas
      await this.normalizarEValidarDatas();
      
      return true;
      
    } catch (erro) {
      console.error('❌ Erro ao carregar dados:', erro);
      
      // Se não houver dados essenciais, redirecionar
      if (erro.message.includes('voo')) {
        setTimeout(() => {
          window.location.href = '/flights.html';
        }, 2000);
      }
      
      throw erro;
    }
  },

  /**
   * ✅ NOVO: Extrai código do destino de múltiplas fontes possíveis
   */
  extrairCodigoDestino() {
    // Tentar múltiplas fontes de dados
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
    return 'GRU'; // São Paulo como padrão
  },

  /**
   * ✅ CORRIGIDO: Normaliza e valida datas com múltiplos formatos
   */
  async normalizarEValidarDatas() {
    console.log('📅 Normalizando datas...');
    
    try {
      // 1. Tentar extrair datas do voo
      let dataIda = this.extrairDataIda();
      let dataVolta = this.extrairDataVolta();
      
      // 2. Se não houver no voo, tentar das respostas do usuário
      if (!dataIda && this.dadosUsuario?.respostas?.datas) {
        const datasRespostas = this.extrairDatasRespostas();
        if (datasRespostas) {
          dataIda = datasRespostas.ida;
          dataVolta = datasRespostas.volta;
        }
      }
      
      // 3. Validar e formatar datas
      if (!dataIda) {
        throw new Error('Data de ida não encontrada');
      }
      
      // Garantir formato ISO correto
      dataIda = this.garantirFormatoISO(dataIda);
      if (dataVolta) {
        dataVolta = this.garantirFormatoISO(dataVolta);
      }
      
      // 4. Validar se as datas são válidas
      const dataIdaObj = new Date(dataIda + 'T12:00:00');
      const dataVoltaObj = dataVolta ? new Date(dataVolta + 'T12:00:00') : null;
      
      if (isNaN(dataIdaObj.getTime())) {
        throw new Error('Data de ida inválida: ' + dataIda);
      }
      
      if (dataVoltaObj && isNaN(dataVoltaObj.getTime())) {
        throw new Error('Data de volta inválida: ' + dataVolta);
      }
      
      // 5. Validar lógica das datas
      if (dataVoltaObj && dataVoltaObj <= dataIdaObj) {
        console.warn('⚠️ Data de volta anterior à ida, ajustando...');
        dataVoltaObj.setDate(dataIdaObj.getDate() + 3);
        dataVolta = this.formatarDataISO(dataVoltaObj);
      }
      
      // 6. Salvar datas normalizadas
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
      
      // Fallback: usar datas padrão
      const hoje = new Date();
      hoje.setDate(hoje.getDate() + 30); // 30 dias no futuro
      
      const ida = this.formatarDataISO(hoje);
      const volta = new Date(hoje);
      volta.setDate(hoje.getDate() + 5);
      
      this.dadosVoo.infoIda = { dataPartida: ida };
      this.dadosVoo.infoVolta = { dataPartida: this.formatarDataISO(volta) };
      
      console.warn('⚠️ Usando datas padrão:', this.dadosVoo.infoIda, this.dadosVoo.infoVolta);
    }
  },

  /**
   * ✅ NOVO: Extrai datas de múltiplas fontes
   */
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

  /**
   * ✅ NOVO: Extrai data de volta
   */
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

  /**
   * ✅ NOVO: Extrai datas das respostas do usuário
   */
  extrairDatasRespostas() {
    const datas = this.dadosUsuario?.respostas?.datas;
    if (!datas) return null;
    
    // Caso 1: Objeto com dataIda e dataVolta
    if (typeof datas === 'object' && datas.dataIda) {
      return {
        ida: datas.dataIda,
        volta: datas.dataVolta
      };
    }
    
    // Caso 2: Array [ida, volta]
    if (Array.isArray(datas) && datas.length >= 1) {
      return {
        ida: datas[0],
        volta: datas[1] || null
      };
    }
    
    // Caso 3: String "ida,volta"
    if (typeof datas === 'string' && datas.includes(',')) {
      const [ida, volta] = datas.split(',').map(d => d.trim());
      return { ida, volta };
    }
    
    // Caso 4: String única (só ida)
    if (typeof datas === 'string') {
      return {
        ida: datas,
        volta: null
      };
    }
    
    return null;
  },

  /**
   * ✅ NOVO: Valida se uma data é válida
   */
  isDataValida(data) {
    if (!data) return false;
    
    // Aceitar diferentes formatos
    const formatos = [
      /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/,         // DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}$/,           // DD-MM-YYYY
      /^\d{4}\/\d{2}\/\d{2}$/          // YYYY/MM/DD
    ];
    
    const dataStr = String(data);
    return formatos.some(formato => formato.test(dataStr));
  },

  /**
   * ✅ CORRIGIDO: Garante formato ISO YYYY-MM-DD
   */
  garantirFormatoISO(dataInput) {
    if (!dataInput) return null;
    
    const dataStr = String(dataInput);
    
    // Já está em ISO?
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
      return dataStr;
    }
    
    // DD/MM/YYYY ou DD-MM-YYYY
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dataStr)) {
      const [dia, mes, ano] = dataStr.split(/[\/\-]/);
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    
    // YYYY/MM/DD
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(dataStr)) {
      return dataStr.replace(/\//g, '-');
    }
    
    // Tentar criar Date
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
   * ✅ MELHORADO: Formata Date para ISO
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
   * Helpers para acessar datas
   */
  getDataIda() {
    return this.dadosVoo?.infoIda?.dataPartida;
  },

  getDataVolta() {
    return this.dadosVoo?.infoVolta?.dataPartida;
  },

  /**
   * ✅ MELHORADO: Calcula dias de viagem com validação
   */
  calcularDiasViagem(dataIda, dataVolta) {
    if (!dataIda) return 1;
    
    try {
      const inicio = new Date(dataIda + 'T12:00:00');
      const fim = dataVolta ? new Date(dataVolta + 'T12:00:00') : inicio;
      
      const diffMs = fim - inicio;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
      
      // Validações
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

  /**
   * Animação de progresso
   */
  iniciarAnimacaoProgresso() {
    const mensagens = [
      '🔍 Analisando seu perfil de viagem...',
      '🗺️ Mapeando pontos turísticos...',
      '📸 Buscando imagens dos locais...',
      '🌤️ Checando previsão do tempo...',
      '📝 Organizando seu roteiro perfeito...'
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

  /**
   * ✅ OTIMIZADO: Gera o roteiro com validações melhoradas
   */
  async gerarRoteiro() {
    try {
      console.log('🎯 Iniciando geração do roteiro...');
      
      const dataIda = this.getDataIda();
      const dataVolta = this.getDataVolta();
      const diasViagem = this.calcularDiasViagem(dataIda, dataVolta);
      
      console.log('📊 Parâmetros do roteiro:', {
        destino: this.dadosDestino,
        dataIda,
        dataVolta,
        diasViagem,
        preferencias: this.obterPreferencias()
      });
      
      // Simular delay para UX
      await this.delay(1500);
      
      // Gerar roteiro (usando dados dummy em desenvolvimento)
      if (this.isDesenvolvimento()) {
        this.roteiroPronto = await this.gerarRoteiroDummy(dataIda, dataVolta, diasViagem);
      } else {
        this.roteiroPronto = await this.chamarAPIRoteiro({
          destino: this.dadosDestino.destino,
          pais: this.dadosDestino.pais,
          dataInicio: dataIda,
          dataFim: dataVolta,
          diasViagem,
          horaChegada: this.extrairHorarioChegada(),
          horaSaida: this.extrairHorarioPartida(),
          preferencias: this.obterPreferencias()
        });
      }
      
      // Executar tarefas em paralelo
      await Promise.all([
        this.buscarPrevisaoTempo(),
        this.buscarTodasImagensOtimizado()
      ]);
      
      // Atualizar UI
      this.atualizarUIComRoteiro();
      
      console.log('✅ Roteiro gerado com sucesso!');
      
    } catch (erro) {
      console.error('❌ Erro ao gerar roteiro:', erro);
      this.mostrarErro('Não foi possível gerar seu roteiro. Por favor, tente novamente.');
      throw erro;
    } finally {
      this.finalizarCarregamento();
    }
  },

  /**
   * Verificar se está em desenvolvimento
   */
  isDesenvolvimento() {
    return ['localhost', '127.0.0.1', ''].includes(location.hostname) || 
           location.hostname.startsWith('192.168.');
  },

  /**
   * Delay auxiliar
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Finalizar carregamento
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
   * ✅ MELHORADO: Gera roteiro dummy com dados realistas
   */
  async gerarRoteiroDummy(dataIda, dataVolta, diasViagem) {
    console.log('🏗️ Gerando roteiro dummy...');
    
    const destino = this.dadosDestino.destino;
    const dias = [];
    const dataInicio = new Date(dataIda + 'T12:00:00');
    
    // Base de atividades por tipo de destino
    const atividadesBase = this.obterAtividadesBase(destino);
    
    for (let i = 0; i < diasViagem; i++) {
      const dataAtual = new Date(dataInicio);
      dataAtual.setDate(dataInicio.getDate() + i);
      
      const dia = {
        data: this.formatarDataISO(dataAtual),
        descricao: this.obterDescricaoDia(i + 1, destino, diasViagem),
        manha: this.gerarPeriodoCompleto('manha', i, atividadesBase),
        tarde: this.gerarPeriodoCompleto('tarde', i, atividadesBase),
        noite: this.gerarPeriodoCompleto('noite', i, atividadesBase)
      };
      
      // Adicionar observação especial para primeiro e último dia
      if (i === 0) {
        dia.observacao = this.obterObservacaoPrimeiroDia();
      } else if (i === diasViagem - 1) {
        dia.observacao = this.obterObservacaoUltimoDia();
      }
      
      dias.push(dia);
    }
    
    // Ajustar atividades baseado nos horários dos voos
    this.ajustarAtividadesPorHorarios(dias);
    
    return {
      destino: `${destino}, ${this.dadosDestino.pais}`,
      dias
    };
  },

  /**
   * ✅ NOVO: Obtém atividades base por destino
   */
  obterAtividadesBase(destino) {
    // Atividades genéricas que funcionam para qualquer destino
    const generico = {
      manha: [
        { local: "Centro Histórico", dica: "Comece cedo para evitar multidões!" },
        { local: "Museu Nacional", dica: "Não perca a exposição principal!" },
        { local: "Mercado Central", dica: "Prove as especialidades locais!" },
        { local: "Catedral Principal", dica: "Arquitetura impressionante!" },
        { local: "Parque Municipal", dica: "Ótimo para caminhadas matinais!" }
      ],
      tarde: [
        { local: "Bairro Artístico", dica: "Galerias e street art incríveis!" },
        { local: "Mirante da Cidade", dica: "Vista panorâmica espetacular!" },
        { local: "Passeio de Barco", dica: "Perspectiva única da cidade!" },
        { local: "Shopping Local", dica: "Artesanato e lembranças!" },
        { local: "Tour Gastronômico", dica: "Sabores autênticos da região!" }
      ],
      noite: [
        { local: "Restaurante Típico", dica: "Peça o prato da casa!" },
        { local: "Show Cultural", dica: "Música e dança tradicional!" },
        { local: "Bar com Vista", dica: "Drinks especiais ao pôr do sol!" },
        { local: "Teatro Municipal", dica: "Verifique a programação!" },
        { local: "Rua Gastronômica", dica: "Vida noturna animada!" }
      ]
    };
    
    // Personalizar por destino conhecido
    const especificos = {
      'Lisboa': {
        manha: [
          { local: "Torre de Belém", dica: "Chegue antes das 10h para evitar filas!" },
          { local: "Mosteiro dos Jerónimos", dica: "Arquitetura manuelina impressionante!" },
          { local: "Castelo de São Jorge", dica: "Vista incrível da cidade!" }
        ],
        tarde: [
          { local: "Bairro de Alfama", dica: "Perca-se nas ruelas históricas!" },
          { local: "Elevador de Santa Justa", dica: "Vista 360° de Lisboa!" },
          { local: "LX Factory", dica: "Arte, lojas e cafés descolados!" }
        ],
        noite: [
          { local: "Casa de Fado", dica: "Experiência musical única!" },
          { local: "Time Out Market", dica: "O melhor da gastronomia local!" },
          { local: "Bairro Alto", dica: "Vida noturna vibrante!" }
        ]
      },
      'Paris': {
        manha: [
          { local: "Torre Eiffel", dica: "Compre ingressos online!" },
          { local: "Museu do Louvre", dica: "Reserve meio dia inteiro!" },
          { local: "Notre-Dame", dica: "Em restauração, mas vale a visita externa!" }
        ]
      }
      // Adicionar mais destinos conforme necessário
    };
    
    // Retornar específico se existir, senão genérico
    return especificos[destino] || generico;
  },

  /**
   * ✅ NOVO: Gera período completo com múltiplas atividades
   */
  gerarPeriodoCompleto(periodo, diaIndex, atividadesBase) {
    const atividades = [];
    const listaBase = atividadesBase[periodo] || [];
    
    // Horários padrão por período
    const horarios = {
      manha: ['09:00', '10:30', '11:30'],
      tarde: ['14:00', '15:30', '17:00'],
      noite: ['19:00', '20:30', '22:00']
    };
    
    // Número de atividades por período (varia por dia)
    const numAtividades = (diaIndex % 2 === 0) ? 2 : 3;
    
    for (let i = 0; i < numAtividades && i < listaBase.length; i++) {
      const atividadeIndex = (diaIndex * 3 + i) % listaBase.length;
      const atividade = { ...listaBase[atividadeIndex] };
      
      atividade.horario = horarios[periodo][i];
      atividade.tags = this.gerarTagsAtividade(atividade.local, periodo);
      
      atividades.push(atividade);
    }
    
    return { atividades };
  },

  /**
   * ✅ NOVO: Gera tags relevantes para atividade
   */
  gerarTagsAtividade(local, periodo) {
    const tags = [];
    
    // Tags por palavra-chave no local
    if (local.includes('Museu')) tags.push('Cultural');
    if (local.includes('Restaurante') || local.includes('Gastronôm')) tags.push('Gastronomia');
    if (local.includes('Parque') || local.includes('Jardim')) tags.push('Natureza');
    if (local.includes('Shopping') || local.includes('Mercado')) tags.push('Compras');
    if (local.includes('Igreja') || local.includes('Catedral')) tags.push('Religioso');
    if (local.includes('Bar') || local.includes('Noturna')) tags.push('Vida Noturna');
    if (local.includes('Mirante') || local.includes('Vista')) tags.push('Vista Panorâmica');
    
    // Tag por período
    if (periodo === 'manha') tags.push('Matinal');
    if (periodo === 'noite') tags.push('Noturno');
    
    // Sempre adicionar pelo menos uma tag
    if (tags.length === 0) tags.push('Recomendado');
    
    // Adicionar "Imperdível" aleatoriamente (30% de chance)
    if (Math.random() < 0.3) tags.unshift('Imperdível');
    
    return tags.slice(0, 3); // Máximo 3 tags
  },

  /**
   * ✅ MELHORADO: Ajusta atividades do primeiro e último dia
   */
  ajustarAtividadesPorHorarios(dias) {
    if (!dias || dias.length === 0) return;
    
    const horaChegada = this.extrairHorarioChegada();
    const horaPartida = this.extrairHorarioPartida();
    
    // Ajustar primeiro dia baseado no horário de chegada
    const primeiroDia = dias[0];
    const horaChegadaNum = parseInt(horaChegada.split(':')[0]);
    
    if (horaChegadaNum >= 20) {
      // Chegada muito tarde - só jantar/descanso
      primeiroDia.manha.atividades = [];
      primeiroDia.tarde.atividades = [];
      primeiroDia.noite.atividades = [{
        horario: '21:00',
        local: 'Check-in e Jantar no Hotel',
        dica: 'Descanse para começar bem amanhã!',
        tags: ['Chegada', 'Descanso'],
        isEspecial: true
      }];
    } else if (horaChegadaNum >= 16) {
      // Chegada à tarde - sem manhã
      primeiroDia.manha.atividades = [];
      primeiroDia.tarde.atividades = [{
        horario: horaChegada,
        local: 'Check-in no Hotel',
        dica: 'Deixe as malas e saia para explorar!',
        tags: ['Chegada'],
        isEspecial: true
      }];
    } else if (horaChegadaNum >= 12) {
      // Chegada meio-dia
      primeiroDia.manha.atividades = [];
      if (primeiroDia.tarde.atividades.length > 0) {
        primeiroDia.tarde.atividades[0] = {
          horario: `${horaChegadaNum + 1}:00`,
          local: 'Check-in e Almoço',
          dica: 'Experimente a culinária local!',
          tags: ['Chegada', 'Gastronomia'],
          isEspecial: true
        };
      }
    }
    
    // Ajustar último dia se houver partida
    if (horaPartida && dias.length > 1) {
      const ultimoDia = dias[dias.length - 1];
      const horaPartidaNum = parseInt(horaPartida.split(':')[0]);
      
      if (horaPartidaNum < 12) {
        // Partida de manhã
        ultimoDia.tarde.atividades = [];
        ultimoDia.noite.atividades = [];
        ultimoDia.manha.atividades = [{
          horario: '08:00',
          local: 'Check-out e Transfer para Aeroporto',
          dica: 'Chegue ao aeroporto com 2h de antecedência!',
          tags: ['Partida'],
          isEspecial: true
        }];
      } else if (horaPartidaNum < 18) {
        // Partida à tarde
        ultimoDia.noite.atividades = [];
        if (ultimoDia.tarde.atividades.length > 0) {
          ultimoDia.tarde.atividades[ultimoDia.tarde.atividades.length - 1] = {
            horario: `${horaPartidaNum - 3}:00`,
            local: 'Transfer para Aeroporto',
            dica: 'Hora de se despedir! Até a próxima!',
            tags: ['Partida'],
            isEspecial: true
          };
        }
      }
    }
  },

  /**
   * ✅ CORRIGIDO: Busca previsão do tempo apenas para os 3 primeiros dias
   */
  async buscarPrevisaoTempo() {
    try {
      console.log('🌤️ Buscando previsão do tempo (limitada a 3 dias)...');
      
      if (!this.roteiroPronto?.dias || this.roteiroPronto.dias.length === 0) {
        console.warn('⚠️ Sem dias no roteiro para buscar previsão');
        return;
      }
      
      // IMPORTANTE: Limitar a 3 dias
      const diasComPrevisao = Math.min(3, this.roteiroPronto.dias.length);
      const cidade = this.dadosDestino.destino.replace(/\s+Internacional/i, '').trim();
      
      // Tentar buscar previsão real
      try {
        const url = `/api/weather?city=${encodeURIComponent(cidade)}&days=${diasComPrevisao}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const previsoes = await response.json();
          
          // Aplicar previsões apenas aos primeiros 3 dias
          for (let i = 0; i < diasComPrevisao; i++) {
            if (previsoes[i]) {
              this.roteiroPronto.dias[i].previsao = previsoes[i];
            } else {
              this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoAleatoria(i);
            }
          }
          
          console.log(`✅ Previsão aplicada aos primeiros ${diasComPrevisao} dias`);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        
      } catch (erro) {
        console.warn('⚠️ Erro ao buscar previsão real:', erro.message);
        
        // Fallback: previsões aleatórias para os 3 primeiros dias
        for (let i = 0; i < diasComPrevisao; i++) {
          this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoAleatoria(i);
        }
      }
      
      // IMPORTANTE: Garantir que dias > 3 não tenham previsão
      for (let i = 3; i < this.roteiroPronto.dias.length; i++) {
        delete this.roteiroPronto.dias[i].previsao;
      }
      
    } catch (erro) {
      console.error('❌ Erro geral na previsão:', erro);
    }
  },

  /**
   * ✅ NOVO: Gera previsão aleatória realista
   */
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
      condition: condicao.condition,
      date: this.roteiroPronto.dias[diaIndex].data
    };
  },

  /**
   * ✅ CORRIGIDO: Busca imagens para TODOS os dias com otimização
   */
  async buscarTodasImagensOtimizado() {
    try {
      console.log('🖼️ Iniciando busca otimizada de imagens...');
      
      if (!this.roteiroPronto?.dias || this.roteiroPronto.dias.length === 0) {
        console.warn('⚠️ Sem roteiro para buscar imagens');
        return;
      }
      
      // 1. Coletar TODOS os locais únicos
      const locaisUnicos = new Map();
      let totalAtividades = 0;
      
      this.roteiroPronto.dias.forEach((dia, diaIndex) => {
        ['manha', 'tarde', 'noite'].forEach(periodo => {
          if (dia[periodo]?.atividades?.length) {
            dia[periodo].atividades.forEach(atividade => {
              if (atividade.local && !atividade.isEspecial) {
                // Usar Map para evitar duplicatas
                locaisUnicos.set(atividade.local, {
                  local: atividade.local,
                  primeiraOcorrencia: { dia: diaIndex, periodo }
                });
                totalAtividades++;
              }
            });
          }
        });
      });
      
      console.log(`📊 Estatísticas de busca:
        - Total de atividades: ${totalAtividades}
        - Locais únicos: ${locaisUnicos.size}
        - Dias no roteiro: ${this.roteiroPronto.dias.length}`);
      
      // 2. Estratégia de busca inteligente
      const locaisArray = Array.from(locaisUnicos.values());
      const maxBuscasSimultaneas = 3; // Limitar requisições simultâneas
      const maxTotalBuscas = Math.min(locaisArray.length, 20); // Limite máximo de 20 buscas
      
      // 3. Dividir em lotes para não sobrecarregar
      const lotes = [];
      for (let i = 0; i < maxTotalBuscas; i += maxBuscasSimultaneas) {
        lotes.push(locaisArray.slice(i, i + maxBuscasSimultaneas));
      }
      
      console.log(`🔄 Processando ${lotes.length} lotes de imagens...`);
      
      // 4. Processar lotes sequencialmente
      const todasImagens = new Map();
      
      for (let i = 0; i < lotes.length; i++) {
        console.log(`📦 Processando lote ${i + 1}/${lotes.length}...`);
        
        const promises = lotes[i].map(item => 
          this.buscarImagemComCache(item.local)
        );
        
        const resultados = await Promise.all(promises);
        
        // Armazenar resultados
        resultados.forEach((resultado, index) => {
          const local = lotes[i][index].local;
          if (resultado.sucesso) {
            todasImagens.set(local, resultado.url);
            console.log(`✅ Imagem encontrada: ${local}`);
          } else {
            console.warn(`⚠️ Sem imagem: ${local}`);
          }
        });
        
        // Delay entre lotes para evitar rate limit
        if (i < lotes.length - 1) {
          await this.delay(500);
        }
      }
      
      console.log(`📸 Total de imagens encontradas: ${todasImagens.size}`);
      
      // 5. Aplicar imagens a TODAS as atividades
      let imagensAplicadas = 0;
      
      this.roteiroPronto.dias.forEach((dia, diaIndex) => {
        ['manha', 'tarde', 'noite'].forEach(periodo => {
          if (dia[periodo]?.atividades?.length) {
            dia[periodo].atividades.forEach((atividade, ativIndex) => {
              if (atividade.local && !atividade.isEspecial) {
                const imagemUrl = todasImagens.get(atividade.local);
                
                if (imagemUrl) {
                  atividade.imagemUrl = imagemUrl;
                  imagensAplicadas++;
                } else {
                  // Aplicar fallback
                  atividade.imagemUrl = this.gerarImagemFallback(atividade.local, diaIndex, ativIndex);
                  atividade.isFallback = true;
                }
              }
            });
          }
        });
      });
      
      console.log(`✅ Imagens aplicadas: ${imagensAplicadas}/${totalAtividades}`);
      
      // 6. Se muitas falhas, aplicar fallbacks adicionais
      const taxaSucesso = imagensAplicadas / totalAtividades;
      if (taxaSucesso < 0.5) {
        console.log('🔄 Taxa de sucesso baixa, melhorando fallbacks...');
        this.melhorarFallbacks();
      }
      
    } catch (erro) {
      console.error('❌ Erro ao buscar imagens:', erro);
      this.aplicarFallbacksGlobal();
    }
  },

  /**
   * ✅ NOVO: Busca imagem com cache
   */
  async buscarImagemComCache(local) {
    // Verificar cache primeiro
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
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'max-age=3600'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const dados = await response.json();
      
      if (dados?.images?.[0]) {
        const imagemUrl = dados.images[0].url || dados.images[0].src?.medium;
        const resultado = { sucesso: true, url: imagemUrl };
        
        // Salvar no cache
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
   * ✅ NOVO: Gera imagem de fallback melhorada
   */
  gerarImagemFallback(local, diaIndex, ativIndex) {
    // Lista expandida de imagens de fallback
    const fallbacks = [
      `https://picsum.photos/400/250?random=${diaIndex}${ativIndex}`,
      `https://source.unsplash.com/400x250/?${encodeURIComponent(local)},travel`,
      `https://loremflickr.com/400/250/${encodeURIComponent(local)}`,
      `https://placeimg.com/400/250/arch?t=${Date.now()}`,
      `https://via.placeholder.com/400x250/E87722/FFFFFF?text=${encodeURIComponent(local)}`
    ];
    
    // Selecionar fallback baseado no índice
    const indice = (diaIndex * 10 + ativIndex) % fallbacks.length;
    
    return fallbacks[indice];
  },

  /**
   * ✅ NOVO: Melhora fallbacks existentes
   */
  melhorarFallbacks() {
    const palavrasChave = ['travel', 'tourism', 'destination', 'vacation', 'explore', 'adventure'];
    let fallbackIndex = 0;
    
    this.roteiroPronto.dias.forEach((dia, diaIndex) => {
      ['manha', 'tarde', 'noite'].forEach(periodo => {
        if (dia[periodo]?.atividades?.length) {
          dia[periodo].atividades.forEach((atividade, ativIndex) => {
            if (atividade.isFallback && atividade.local) {
              const palavra = palavrasChave[fallbackIndex % palavrasChave.length];
              atividade.imagemUrl = `https://source.unsplash.com/400x250/?${palavra},${encodeURIComponent(this.dadosDestino.destino)}`;
              fallbackIndex++;
            }
          });
        }
      });
    });
  },

  /**
   * ✅ NOVO: Aplica fallbacks global em caso de erro total
   */
  aplicarFallbacksGlobal() {
    console.log('🔄 Aplicando fallbacks globais...');
    
    let index = 0;
    this.roteiroPronto.dias.forEach((dia, diaIndex) => {
      ['manha', 'tarde', 'noite'].forEach(periodo => {
        if (dia[periodo]?.atividades?.length) {
          dia[periodo].atividades.forEach((atividade) => {
            if (atividade.local && !atividade.isEspecial && !atividade.imagemUrl) {
              atividade.imagemUrl = `https://picsum.photos/400/250?random=${index++}`;
              atividade.isFallback = true;
            }
          });
        }
      });
    });
  },

  /**
   * ✅ MELHORADO: Atualiza UI com o roteiro
   */
  atualizarUIComRoteiro() {
    console.log('🎨 Atualizando interface...');
    
    const container = document.querySelector('.roteiro-content');
    if (!container) {
      console.error('❌ Container do roteiro não encontrado');
      return;
    }
    
    // Limpar conteúdo
    container.innerHTML = '';
    
    // Atualizar título
    const header = document.querySelector('.app-header h1');
    if (header) {
      header.textContent = `Seu Roteiro para ${this.dadosDestino.destino}`;
    }
    
    // Adicionar resumo
    container.appendChild(this.criarResumoViagem());
    
    // Adicionar dias
    this.roteiroPronto.dias.forEach((dia, index) => {
      container.appendChild(this.criarElementoDia(dia, index + 1));
    });
    
    // Adicionar espaço no final para os botões fixos
    const spacer = document.createElement('div');
    spacer.style.height = '100px';
    container.appendChild(spacer);
    
    console.log('✅ Interface atualizada');
  },

  /**
   * ✅ MELHORADO: Cria elemento do resumo da viagem
   */
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

  /**
   * ✅ MELHORADO: Cria elemento de um dia com validações
   */
  criarElementoDia(dia, numeroDia) {
    const elemento = document.createElement('div');
    elemento.className = 'dia-roteiro';
    elemento.setAttribute('data-dia', numeroDia);
    
    const dataFormatada = this.formatarDataCompleta(dia.data);
    const temPrevisao = dia.previsao && numeroDia <= 3; // Previsão só para 3 primeiros dias
    
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
        
        <div class="periodos-tabs">
          <button class="periodo-tab active" data-periodo="manha" data-dia="${numeroDia}">
            <span class="tab-icon">🌅</span>
            <span class="tab-text">Manhã</span>
          </button>
          <button class="periodo-tab" data-periodo="tarde" data-dia="${numeroDia}">
            <span class="tab-icon">☀️</span>
            <span class="tab-text">Tarde</span>
          </button>
          <button class="periodo-tab" data-periodo="noite" data-dia="${numeroDia}">
            <span class="tab-icon">🌙</span>
            <span class="tab-text">Noite</span>
          </button>
        </div>
        
        <div class="periodos-container">
          <div class="periodo-conteudo active" id="dia-${numeroDia}-manha">
            ${this.criarConteudoPeriodo(dia.manha, 'manha')}
          </div>
          
          <div class="periodo-conteudo" id="dia-${numeroDia}-tarde">
            ${this.criarConteudoPeriodo(dia.tarde, 'tarde')}
          </div>
          
          <div class="periodo-conteudo" id="dia-${numeroDia}-noite">
            ${this.criarConteudoPeriodo(dia.noite, 'noite')}
          </div>
        </div>
      </div>
    `;
    
    // Configurar eventos após inserir no DOM
    setTimeout(() => this.configurarEventosDia(elemento, numeroDia), 0);
    
    return elemento;
  },

  /**
   * Cria elemento de previsão do tempo
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
   * ✅ MELHORADO: Cria conteúdo do período com melhor tratamento de imagens
   */
  criarConteudoPeriodo(periodo, nomePeriodo) {
    if (!periodo?.atividades?.length) {
      return `
        <div class="periodo-vazio">
          <p>Período livre para descanso ou atividades opcionais.</p>
        </div>
      `;
    }
    
    return periodo.atividades.map((ativ, index) => `
      <div class="atividade ${ativ.isEspecial ? 'atividade-especial' : ''}">
        ${ativ.horario ? `
          <div class="atividade-horario">
            <span class="horario-icon">🕒</span>
            <span class="horario-texto">${ativ.horario}</span>
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
              src="${ativ.imagemUrl}" 
              alt="${ativ.local}"
              loading="lazy"
              onerror="this.onerror=null; this.src='https://via.placeholder.com/400x250/E87722/FFFFFF?text=${encodeURIComponent(ativ.local)}';"
            >
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
   * ✅ NOVO: Retorna classe CSS apropriada para badge
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
      'Vista Panorâmica': 'badge-vista'
    };
    
    return classes[tag] || 'badge-padrao';
  },

  /**
   * ✅ MELHORADO: Configura eventos do dia com melhor performance
   */
  configurarEventosDia(elemento, numeroDia) {
    // Tabs de período
    const tabs = elemento.querySelectorAll('.periodo-tab');
    const conteudos = elemento.querySelectorAll('.periodo-conteudo');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remover active de todos
        tabs.forEach(t => t.classList.remove('active'));
        conteudos.forEach(c => c.classList.remove('active'));
        
        // Adicionar active ao clicado
        tab.classList.add('active');
        const periodo = tab.getAttribute('data-periodo');
        const conteudo = elemento.querySelector(`#dia-${numeroDia}-${periodo}`);
        if (conteudo) {
          conteudo.classList.add('active');
        }
      });
    });
    
    // Botões de mapa
    const botoesMapa = elemento.querySelectorAll('.btn-ver-mapa');
    botoesMapa.forEach(botao => {
      botao.addEventListener('click', (e) => {
        e.preventDefault();
        const local = botao.getAttribute('data-local');
        if (local) {
          this.abrirMapa(local);
        }
      });
    });
  },

  // ===========================================
  // HELPERS E UTILIDADES
  // ===========================================

  /**
   * ✅ MELHORADO: Extrai horários com mais fallbacks
   */
  extrairHorarioChegada() {
    const possiveis = [
      this.dadosVoo?.infoIda?.horaChegada,
      this.dadosVoo?.ida?.horaChegada,
      this.dadosVoo?.ida?.horario,
      this.dadosVoo?.voo?.segment?.[0]?.flight?.[0]?.arrival_time,
      this.dadosVoo?.segment?.[0]?.flight?.[0]?.arrival_time,
      this.dadosVoo?.arrival_time
    ];
    
    for (const horario of possiveis) {
      if (horario && /\d{1,2}:\d{2}/.test(horario)) {
        return this.formatarHorario(horario);
      }
    }
    
    return '15:30'; // Padrão
  },

  extrairHorarioPartida() {
    const possiveis = [
      this.dadosVoo?.infoVolta?.horaPartida,
      this.dadosVoo?.volta?.horaPartida,
      this.dadosVoo?.volta?.horario,
      this.dadosVoo?.voo?.segment?.[1]?.flight?.[0]?.departure_time,
      this.dadosVoo?.segment?.[1]?.flight?.[0]?.departure_time,
      this.dadosVoo?.departure_time
    ];
    
    for (const horario of possiveis) {
      if (horario && /\d{1,2}:\d{2}/.test(horario)) {
        return this.formatarHorario(horario);
      }
    }
    
    return '21:00'; // Padrão
  },

  /**
   * ✅ NOVO: Formata horário para padrão HH:MM
   */
  formatarHorario(horario) {
    const match = horario.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const hora = match[1].padStart(2, '0');
      const minuto = match[2];
      return `${hora}:${minuto}`;
    }
    return horario;
  },

  /**
   * Obtém descrição personalizada do dia
   */
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

  /**
   * Observações especiais
   */
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

  /**
   * Mapeamentos de preferências
   */
  obterPreferencias() {
    return {
      tipoViagem: this.obterTipoViagem(),
      tipoCompanhia: this.obterTipoCompanhia(),
      orcamento: this.obterNivelOrcamento()
    };
  },

  obterTipoViagem() {
    const respostas = this.dadosUsuario?.respostas || {};
    
    // Mapear diferentes formatos de resposta
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

  obterNivelOrcamento() {
    const orcamento = this.dadosUsuario?.respostas?.orcamento_valor;
    if (!orcamento) return 'medio';
    
    const valor = parseInt(orcamento);
    if (valor < 1000) return 'economico';
    if (valor < 3000) return 'medio';
    return 'luxo';
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

  /**
   * ✅ MELHORADO: Mapeamento de destinos expandido
   */
  obterNomeDestinoPorCodigo(codigo) {
    const mapeamento = {
      // Brasil
      'GRU': 'São Paulo', 'CGH': 'São Paulo', 'VCP': 'Campinas',
      'GIG': 'Rio de Janeiro', 'SDU': 'Rio de Janeiro',
      'BSB': 'Brasília', 'CNF': 'Belo Horizonte', 'PLU': 'Belo Horizonte',
      'CWB': 'Curitiba', 'POA': 'Porto Alegre', 'FLN': 'Florianópolis',
      'SSA': 'Salvador', 'REC': 'Recife', 'FOR': 'Fortaleza',
      'MAO': 'Manaus', 'BEL': 'Belém', 'GYN': 'Goiânia',
      
      // América do Sul
      'EZE': 'Buenos Aires', 'AEP': 'Buenos Aires',
      'SCL': 'Santiago', 'LIM': 'Lima', 'BOG': 'Bogotá',
      'MDE': 'Medellín', 'CTG': 'Cartagena',
      'CCS': 'Caracas', 'UIO': 'Quito', 'LPB': 'La Paz',
      'MVD': 'Montevidéu', 'ASU': 'Assunção',
      
      // América do Norte
      'JFK': 'Nova York', 'EWR': 'Nova York', 'LGA': 'Nova York',
      'LAX': 'Los Angeles', 'SFO': 'São Francisco',
      'ORD': 'Chicago', 'MIA': 'Miami', 'MCO': 'Orlando',
      'LAS': 'Las Vegas', 'SEA': 'Seattle', 'BOS': 'Boston',
      'ATL': 'Atlanta', 'DFW': 'Dallas', 'IAH': 'Houston',
      'YYZ': 'Toronto', 'YVR': 'Vancouver', 'YUL': 'Montreal',
      'MEX': 'Cidade do México', 'CUN': 'Cancún',
      
      // Europa
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
      
      // Ásia
      'NRT': 'Tóquio', 'HND': 'Tóquio',
      'ICN': 'Seul', 'PEK': 'Pequim', 'PVG': 'Xangai',
      'HKG': 'Hong Kong', 'SIN': 'Singapura',
      'BKK': 'Bangkok', 'KUL': 'Kuala Lumpur',
      'DXB': 'Dubai', 'DOH': 'Doha',
      'DEL': 'Nova Délhi', 'BOM': 'Mumbai',
      
      // Oceania
      'SYD': 'Sydney', 'MEL': 'Melbourne',
      'AKL': 'Auckland', 'CHC': 'Christchurch',
      
      // África
      'JNB': 'Joanesburgo', 'CPT': 'Cidade do Cabo',
      'CAI': 'Cairo', 'CMN': 'Casablanca',
      'NBO': 'Nairóbi', 'ADD': 'Adis Abeba'
    };
    
    return mapeamento[codigo] || codigo;
  },

  /**
   * ✅ NOVO: Obtém país por código IATA
   */
  obterPaisPorCodigo(codigo) {
    const paises = {
      // Brasil
      'GRU': 'Brasil', 'CGH': 'Brasil', 'GIG': 'Brasil', 'SDU': 'Brasil',
      'BSB': 'Brasil', 'CNF': 'Brasil', 'CWB': 'Brasil', 'POA': 'Brasil',
      
      // América do Sul
      'EZE': 'Argentina', 'AEP': 'Argentina',
      'SCL': 'Chile', 'LIM': 'Peru', 'BOG': 'Colômbia',
      'MDE': 'Colômbia', 'UIO': 'Equador', 'CCS': 'Venezuela',
      'MVD': 'Uruguai', 'ASU': 'Paraguai', 'LPB': 'Bolívia',
      
      // América do Norte
      'JFK': 'Estados Unidos', 'LAX': 'Estados Unidos', 'MIA': 'Estados Unidos',
      'YYZ': 'Canadá', 'YVR': 'Canadá',
      'MEX': 'México', 'CUN': 'México',
      
      // Europa
      'LHR': 'Reino Unido', 'CDG': 'França', 'MAD': 'Espanha',
      'FCO': 'Itália', 'FRA': 'Alemanha', 'AMS': 'Holanda',
      'LIS': 'Portugal', 'BRU': 'Bélgica', 'VIE': 'Áustria',
      
      // Ásia
      'NRT': 'Japão', 'ICN': 'Coreia do Sul', 'PEK': 'China',
      'HKG': 'Hong Kong', 'SIN': 'Singapura', 'BKK': 'Tailândia',
      'DXB': 'Emirados Árabes', 'DEL': 'Índia',
      
      // Oceania
      'SYD': 'Austrália', 'AKL': 'Nova Zelândia',
      
      // África
      'JNB': 'África do Sul', 'CAI': 'Egito', 'CMN': 'Marrocos'
    };
    
    return paises[codigo] || 'Internacional';
  },

  /**
   * ✅ MELHORADO: Formata data com validação
   */
  formatarData(dataString) {
    if (!dataString) return 'Data indefinida';
    
    try {
      const data = new Date(dataString + 'T12:00:00');
      if (isNaN(data.getTime())) {
        return dataString; // Retornar como está se não conseguir formatar
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
      // Capitalizar primeira letra
      return formatada.charAt(0).toUpperCase() + formatada.slice(1);
    } catch (e) {
      return dataString;
    }
  },

  // ===========================================
  // AÇÕES E INTERAÇÕES
  // ===========================================

  /**
   * Abre local no Google Maps
   */
  abrirMapa(local) {
    const destino = `${this.dadosDestino.destino}, ${this.dadosDestino.pais}`;
    const query = `${local}, ${destino}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  /**
   * Compartilha roteiro
   */
  async compartilharRoteiro() {
    const titulo = `Roteiro Benetrip - ${this.dadosDestino.destino}`;
    const texto = `Confira meu roteiro personalizado para ${this.dadosDestino.destino}! 🐕✈️`;
    const url = window.location.href;
    
    // Tentar Web Share API
    if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ title: titulo, text: texto, url });
        this.exibirToast('Roteiro compartilhado!', 'success');
        return;
      } catch (e) {
        console.log('Share cancelado ou não suportado');
      }
    }
    
    // Fallback: copiar link
    try {
      await navigator.clipboard.writeText(url);
      this.exibirToast('Link copiado! Cole onde quiser compartilhar.', 'success');
    } catch (e) {
      // Fallback do fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      this.exibirToast('Link copiado!', 'success');
    }
  },

  /**
   * Editar roteiro (futuro)
   */
  editarRoteiro() {
    this.exibirToast('Em breve você poderá personalizar ainda mais seu roteiro! 🚀', 'info');
  },

  /**
   * ✅ MELHORADO: Sistema de toast notifications
   */
  exibirToast(mensagem, tipo = 'info') {
    // Criar container se não existir
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    
    // Criar toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    
    // Ícone por tipo
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
    
    // Animar entrada
    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });
    
    // Remover após 4 segundos
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  /**
   * ✅ MELHORADO: Mostra erro com opções
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
          <button class="btn btn-primary" onclick="location.reload()">
            🔄 Tentar Novamente
          </button>
          <button class="btn btn-secondary" onclick="history.back()">
            ⬅️ Voltar
          </button>
        </div>
        
        <p class="erro-dica">
          <strong>Dica:</strong> Se o problema persistir, tente limpar o cache do navegador ou usar outro navegador.
        </p>
      </div>
    `;
    
    // Ocultar loading se ainda estiver visível
    const loading = document.querySelector('.loading-container');
    if (loading) loading.style.display = 'none';
  },

  /**
   * ✅ NOVO: Chama API real de roteiro (para produção)
   */
  async chamarAPIRoteiro(params) {
    try {
      const response = await fetch('/api/itinerary-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }
      
      const roteiro = await response.json();
      
      // Validar resposta
      if (!roteiro.dias || !Array.isArray(roteiro.dias)) {
        throw new Error('Formato de resposta inválido');
      }
      
      return roteiro;
      
    } catch (erro) {
      console.error('❌ Erro ao chamar API:', erro);
      
      // Fallback para dados dummy
      return this.gerarRoteiroDummy(
        params.dataInicio,
        params.dataFim,
        params.diasViagem
      );
    }
  }
};

// ===========================================
// INICIALIZAÇÃO
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  // Verificar se estamos na página correta
  if (document.getElementById('roteiro-container') || 
      document.querySelector('.roteiro-content')) {
    
    console.log('📄 Página de roteiro detectada');
    
    // Adicionar classe ao body para estilos específicos
    document.body.classList.add('pagina-roteiro');
    
    // Inicializar sistema
    BENETRIP_ROTEIRO.init();
  }
});

// Exportar para acesso global se necessário
window.BENETRIP_ROTEIRO = BENETRIP_ROTEIRO;

// Prevenir erros se o módulo for carregado múltiplas vezes
if (window.BENETRIP_ROTEIRO_LOADED) {
  console.warn('⚠️ Módulo de roteiro já foi carregado');
} else {
  window.BENETRIP_ROTEIRO_LOADED = true;
}
