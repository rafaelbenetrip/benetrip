/**
 * Benetrip - Sistema de Roteiro Personalizado
 * Responsável por gerar e exibir roteiros personalizados de viagem
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
MAX_DIAS_VIAGEM: 30, // Aumentado para suportar viagens mais longas
DIAS_SIMULACAO_DEV: 30, // Máximo de dias para roteiro dummy em desenvolvimento
  
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
    console.log('Inicializando sistema de roteiro...');
    this.carregarDados()
      .then(() => this.gerarRoteiro())
      .catch(erro => {
        console.error('Erro ao inicializar roteiro:', erro);
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
   * Carrega os dados necessários para o roteiro
   */
  async carregarDados() {
    try {
      // Carregar dados do voo selecionado
      const vooString = localStorage.getItem('benetrip_voo_selecionado');
      if (!vooString) {
        throw new Error('Nenhum voo selecionado. Selecione um voo primeiro.');
      }
      this.dadosVoo = JSON.parse(vooString);
      console.log('Dados do voo carregados:', this.dadosVoo);
      
      // Carregar dados do usuário
      const usuarioString = localStorage.getItem('benetrip_user_data');
      if (usuarioString) {
        this.dadosUsuario = JSON.parse(usuarioString);
        console.log('Dados do usuário carregados:', this.dadosUsuario);
      } else {
        console.warn('Dados do usuário não encontrados.');
        this.dadosUsuario = {}; // Objeto vazio como fallback
      }
      
      // Carregar dados do destino
      const destinoString = localStorage.getItem('benetrip_destino_selecionado');
      if (destinoString) {
        this.dadosDestino = JSON.parse(destinoString);
        console.log('Dados do destino carregados:', this.dadosDestino);
      } else {
        // Se não tiver dados do destino, tenta extrair do voo
        this.dadosDestino = {
          destino: this.extrairNomeDestino(this.dadosVoo?.ida?.destino),
          codigo_iata: this.dadosVoo?.ida?.destino,
          pais: 'Desconhecido' // Idealmente seria determinado a partir do código IATA
        };
        console.log('Dados do destino extraídos do voo:', this.dadosDestino);
      }
      
      return true;
    } catch (erro) {
      console.error('Erro ao carregar dados:', erro);
      throw erro;
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
 * Gera o roteiro personalizado via API
 */
async gerarRoteiro() {
  try {
    console.log('Estrutura real dos dadosVoo:', JSON.stringify(this.dadosVoo));
    console.log('Dados do usuário completos:', JSON.stringify(this.dadosUsuario));
    
    // Primeiro, verificar se temos as datas do usuário diretamente das respostas do questionário
    let datasDoUsuario = this.dadosUsuario?.respostas?.datas;
    if (datasDoUsuario) {
      console.log('Datas encontradas nas respostas do usuário:', datasDoUsuario);
      
      // Formatar as datas conforme necessário
      let dataIda, dataVolta;
      
      // Se datasDoUsuario for um objeto com dataIda e dataVolta
      if (typeof datasDoUsuario === 'object' && datasDoUsuario.dataIda) {
        dataIda = datasDoUsuario.dataIda;
        dataVolta = datasDoUsuario.dataVolta;
      } 
      // Se for um array com duas datas
      else if (Array.isArray(datasDoUsuario) && datasDoUsuario.length >= 2) {
        dataIda = datasDoUsuario[0];
        dataVolta = datasDoUsuario[1];
      }
      // Se for uma string no formato "dataIda,dataVolta"
      else if (typeof datasDoUsuario === 'string' && datasDoUsuario.includes(',')) {
        [dataIda, dataVolta] = datasDoUsuario.split(',');
      }
      
      // Se conseguimos extrair as datas, sobrescrevemos no dadosVoo
      if (dataIda) {
        console.log(`Usando datas do usuário: Ida=${dataIda}, Volta=${dataVolta}`);
        
        // Criar ou atualizar estrutura de dadosVoo
        if (!this.dadosVoo) this.dadosVoo = {};
        if (!this.dadosVoo.ida) this.dadosVoo.ida = {};
        
        this.dadosVoo.ida.dataPartida = dataIda;
        
        if (dataVolta) {
          if (!this.dadosVoo.volta) this.dadosVoo.volta = {};
          this.dadosVoo.volta.dataPartida = dataVolta;
        }
      }
    }
    
    // Verificar e adaptar dados em diferentes formatos possíveis
    if (this.dadosVoo) {
      // Se os dados estiverem em um formato diferente, adapte-os para o formato esperado
      if (!this.dadosVoo.ida && this.dadosVoo.voo) {
        console.log('Adaptando formato dos dados de voo...');
        this.dadosVoo.ida = {
          dataPartida: this.dadosVoo.voo.dataIda || this.dadosVoo.dataIda || this.dadosVoo.voo.data,
          horaChegada: this.dadosVoo.voo.horaChegada || '12:00',
          destino: this.dadosVoo.voo.destino || this.dadosDestino?.codigo_iata
        };
        
        // Se tiver data de volta, cria objeto volta também
        if (this.dadosVoo.voo.dataVolta || this.dadosVoo.dataVolta) {
          this.dadosVoo.volta = {
            dataPartida: this.dadosVoo.voo.dataVolta || this.dadosVoo.dataVolta,
            horaPartida: this.dadosVoo.voo.horaPartida || '14:00'
          };
        }
        
        console.log('Dados adaptados:', this.dadosVoo);
      }
    }
    
    // Verificação mais flexível
    const temDataPartida = (this.dadosVoo?.ida?.dataPartida) || 
                           (this.dadosVoo?.voo?.dataIda) || 
                           (this.dadosVoo?.dataIda) ||
                           (this.dadosVoo?.data);
    
    if (!this.dadosVoo || !temDataPartida) {
      // Tentar extrair do objeto de datas do usuário
      if (this.dadosUsuario?.respostas?.datas) {
        const datas = this.dadosUsuario.respostas.datas;
        console.log('Tentando extrair datas do objeto:', datas);
        
        let dataIda, dataVolta;
        
        // Tentar diferentes formatos possíveis
        if (typeof datas === 'object') {
          dataIda = datas.dataIda || datas.ida;
          dataVolta = datas.dataVolta || datas.volta;
        } else if (typeof datas === 'string') {
          const partes = datas.split(',');
          dataIda = partes[0];
          dataVolta = partes[1];
        }
        
        if (dataIda) {
          this.dadosVoo = {
            ida: {
              dataPartida: dataIda,
              horaChegada: '12:00',
              destino: this.dadosDestino?.codigo_iata || 'CWB'
            }
          };
          
          if (dataVolta) {
            this.dadosVoo.volta = {
              dataPartida: dataVolta,
              horaPartida: '14:00'
            };
          }
          
          console.log('Dados de voo criados a partir de datas do usuário:', this.dadosVoo);
        }
      }
      
      // Se ainda não tiver dados suficientes, tentar a partir do destino
      if (!this.dadosVoo || !this.dadosVoo.ida || !this.dadosVoo.ida.dataPartida) {
        if (this.dadosDestino) {
          console.log('Criando dados de voo a partir do destino...');
          
          // Criar um objeto de voo mínimo para prosseguir
          const hoje = new Date();
          const dataIda = new Date(hoje);
          dataIda.setDate(hoje.getDate() + 30); // 30 dias no futuro
          
          const dataVolta = new Date(dataIda);
          dataVolta.setDate(dataIda.getDate() + 5); // 5 dias após ida
          
          this.dadosVoo = {
            ida: {
              dataPartida: dataIda.toISOString(),
              horaChegada: '12:00',
              destino: this.dadosDestino.codigo_iata || 'CWB',
              origem: 'GRU'
            },
            volta: {
              dataPartida: dataVolta.toISOString(),
              horaPartida: '14:00',
              destino: 'GRU',
              origem: this.dadosDestino.codigo_iata || 'CWB'
            }
          };
          
          console.log('Dados de voo gerados como último recurso:', this.dadosVoo);
        } else {
          throw new Error('Dados insuficientes para gerar o roteiro.');
        }
      }
    }
    
    // Preparar os parâmetros para a API
    const params = {
      destino: this.dadosDestino?.destino || this.extrairNomeDestino(this.dadosVoo.ida?.destino),
      pais: this.dadosDestino?.pais || 'Desconhecido',
      dataInicio: this.extrairDataFormatada(this.dadosVoo.ida?.dataPartida || this.dadosVoo.dataIda),
      dataFim: this.extrairDataFormatada(this.dadosVoo.volta?.dataPartida || this.dadosVoo.dataVolta),
      horaChegada: this.dadosVoo.ida?.horaChegada || '12:00',
      horaSaida: this.dadosVoo.volta?.horaPartida || '14:00',
      tipoViagem: this.obterTipoViagem(),
      tipoCompanhia: this.obterTipoCompanhia(),
      preferencias: this.obterPreferencias(),
      modeloIA: "deepseekai" // ou outra IA conforme recomendação
    };
    
    console.log('Parâmetros para geração de roteiro:', params);
    
    // Chamar a API
    // Simular delay para desenvolvimento
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '') {
      await this.simularDelayDev(3000);
      this.roteiroPronto = this.obterRoteiroDummy();
      
      // Ajusta as datas do roteiro dummy para usar as datas reais escolhidas pelo usuário
      if (this.roteiroPronto && this.roteiroPronto.dias && this.roteiroPronto.dias.length > 0) {
        const dataInicio = new Date(this.dadosVoo.ida.dataPartida);
        
        // Atualiza as datas em cada dia do roteiro
        this.roteiroPronto.dias.forEach((dia, index) => {
          const dataDia = new Date(dataInicio);
          dataDia.setDate(dataInicio.getDate() + index);
          dia.data = dataDia.toISOString().split('T')[0];
        });
        
        console.log('Roteiro dummy ajustado com datas reais do usuário:', this.roteiroPronto);
// Verificação final após ajustes
console.log(`=== VERIFICAÇÃO FINAL ===`);
console.log(`Total de dias no roteiro final: ${this.roteiroPronto.dias.length}`);
console.log(`Primeira data: ${this.roteiroPronto.dias[0]?.data}`);
console.log(`Última data: ${this.roteiroPronto.dias[this.roteiroPronto.dias.length - 1]?.data}`);
console.log(`=== FIM VERIFICAÇÃO ===`);
        
      }
    } else {
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
    }
    
    console.log('Roteiro gerado:', this.roteiroPronto);
    
    // Buscar previsão do tempo para os dias do roteiro
    await this.buscarPrevisaoTempo();
    
    // Buscar imagens para os pontos turísticos
    await this.buscarImagensLocais();
    
    // Atualizar UI
    console.log(`Roteiro gerado com ${this.roteiroPronto.dias?.length || 0} dias`);
console.log('Dias do roteiro:', this.roteiroPronto.dias?.map(dia => dia.data) || []);
    this.atualizarUIComRoteiro();
    
  } catch (erro) {
    console.error('Erro ao gerar roteiro:', erro);
    this.mostrarErro('Não foi possível gerar seu roteiro personalizado. Tente novamente.');
  } finally {
    // Parar animação de progresso
    clearInterval(this.intervalId);
    this.estaCarregando = false;
    
    // Completar a barra de progresso
    this.atualizarBarraProgresso(100, 'Roteiro pronto!');
    
    // Remover container de carregamento
    setTimeout(() => {
      const loadingContainer = document.querySelector('.loading-container');
      if (loadingContainer) {
        loadingContainer.style.display = 'none';
      }
    }, 500);
  }
},

/**
 * Extrai a data formatada de uma string ISO ou outros formatos possíveis
 * @param {string} dataString - String de data
 * @returns {string} Data formatada como YYYY-MM-DD
 */
extrairDataFormatada(dataString) {
  if (!dataString) return null;
  
  try {
    // Se já for um formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
      return dataString;
    }
    
    // Se for uma data ISO completa
    if (dataString.includes('T')) {
      return dataString.split('T')[0];
    }
    
    // Se for outro formato de data
    const data = new Date(dataString);
    if (!isNaN(data.getTime())) {
      return data.toISOString().split('T')[0];
    }
    
    return null;
  } catch (e) {
    console.warn('Erro ao extrair data formatada:', e);
    return null;
  }
},
  
  /**
   * Busca previsão do tempo para os dias do roteiro
   */
  async buscarPrevisaoTempo() {
  try {
    if (!this.roteiroPronto || !this.roteiroPronto.dias || !this.dadosDestino) {
      console.warn('Dados insuficientes para buscar previsão do tempo');
      return;
    }
    
    const dataInicio = this.extrairDataFormatada(this.dadosVoo.ida?.dataPartida || this.dadosVoo.infoIda?.dataPartida);
    const dataFim = this.extrairDataFormatada(this.dadosVoo.volta?.dataPartida || this.dadosVoo.infoVolta?.dataPartida);
    
    if (!dataInicio) {
      console.warn('Data de início não disponível para previsão do tempo');
      this.adicionarPrevisoesFictícias();
      return;
    }
    
    // Usar apenas o nome da cidade, sem adicionar "Internacional"
    const cidadeLimpa = this.dadosDestino.destino
      .replace(/\s+Internacional/i, '')
      .replace(/\s*,.*$/, '') // Remove país se estiver junto
      .trim();
    
    console.log(`Buscando previsão do tempo para ${cidadeLimpa} de ${dataInicio} a ${dataFim || 'N/A'}`);
    
    // Construir URL da API
    const apiUrl = `/api/weather?city=${encodeURIComponent(cidadeLimpa)}&start=${dataInicio}${dataFim ? `&end=${dataFim}` : ''}`;
    console.log('URL da API de clima:', apiUrl);
    
    // Fazer requisição com timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log(`Resposta da API de clima: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erro ${response.status} na API de clima:`, errorText);
      
      // Em caso de erro, usar dados fictícios
      this.adicionarPrevisoesFictícias();
      return;
    }
    
    const previsoes = await response.json();
    console.log('Previsões do tempo recebidas:', previsoes);
    
    // Verificar se recebemos dados válidos
    if (!previsoes || typeof previsoes !== 'object') {
      console.warn('Formato inválido de previsões do tempo');
      this.adicionarPrevisoesFictícias();
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
        } else {
          // Criar previsão fictícia se não houver dados para esse dia
          dia.previsao = this.gerarPrevisaoFicticia(index);
        }
      });
    }
    
    console.log(`Previsões adicionadas: ${previsoesAdicionadas}/${this.roteiroPronto.dias.length} dias`);
    
  } catch (erro) {
    console.warn('Erro ao buscar previsão do tempo:', erro);
    
    // Se der qualquer erro, incluindo timeout ou abort
    if (erro.name === 'AbortError') {
      console.warn('Timeout na requisição de previsão do tempo');
    }
    
    // Sempre adicionar previsões fictícias como fallback
    this.adicionarPrevisoesFictícias();
  }
},
  
  /**
   * Busca imagens para os locais no roteiro
   */
  async buscarImagensLocais() {
    try {
      if (!this.roteiroPronto || !this.roteiroPronto.dias) {
        return;
      }
      
      // Obter lista de pontos turísticos únicos de todos os dias
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
      
      console.log('Pontos turísticos para buscar imagens:', [...pontosTuristicos]);
      
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
          console.warn(`Erro ao buscar imagem para ${local}:`, e);
          return { local, imagem: null };
        }
      });
      
      const resultadosImagens = await Promise.all(imagensPromises);
      console.log('Resultados de imagens:', resultadosImagens);
      
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
      
    } catch (erro) {
      console.warn('Erro ao buscar imagens para locais:', erro);
      // Falha nas imagens não é crítica, apenas log
    }
  },
  
  /**
   * Atualiza a interface com o roteiro gerado
   */
  atualizarUIComRoteiro() {
    if (!this.roteiroPronto) {
      return;
    }
    
    const container = document.querySelector('.roteiro-content');
    if (!container) {
      console.error('Container de roteiro não encontrado');
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
  },
  
  /**
   * Cria o elemento de resumo da viagem
   * @returns {HTMLElement} Elemento de resumo
   */
  criarElementoResumoViagem() {
  const resumoViagem = document.createElement('div');
  resumoViagem.className = 'resumo-viagem';
  
  // Calcular datas formatadas
  const dataIda = this.formatarData(this.dadosVoo.ida?.dataPartida || this.dadosVoo.infoIda?.dataPartida);
  const dataVolta = this.dadosVoo.volta?.dataPartida ? 
                    this.formatarData(this.dadosVoo.volta.dataPartida) : 
                    (this.dadosVoo.infoVolta?.dataPartida ? this.formatarData(this.dadosVoo.infoVolta.dataPartida) : null);
  
  // Calcular duração da viagem
  const diasViagem = this.calcularDiasViagem(
    this.dadosVoo.ida?.dataPartida || this.dadosVoo.infoIda?.dataPartida, 
    this.dadosVoo.volta?.dataPartida || this.dadosVoo.infoVolta?.dataPartida
  );
  
  // Determinar texto para companhia
  const companhiaTexto = this.obterTextoCompanhia();
  
  // Obter horários de voo, verificando diferentes formatos possíveis
  const horaChegada = this.dadosVoo.ida?.horaChegada || 
                      this.dadosVoo.infoIda?.horaChegada || 
                      '17:05';
  
  const horaPartida = this.dadosVoo.volta?.horaPartida || 
                      this.dadosVoo.infoVolta?.horaPartida || 
                      '07:15';
  
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
          <p class="valor">${this.extrairNomeDestino(this.dadosVoo.ida?.origem || this.dadosVoo.infoIda?.aeroportoPartida || 'CGH')}</p>
        </div>
      </div>
    </div>
  `;
  
  return resumoViagem;
},
  
  /**
   * Cria o elemento de um dia do roteiro
   * @param {Object} dia - Dados do dia
   * @param {number} numeroDia - Número do dia no roteiro
   * @returns {HTMLElement} Elemento do dia
   */
  criarElementoDiaRoteiro(dia, numeroDia) {
    const diaRoteiro = document.createElement('div');
    diaRoteiro.className = 'dia-roteiro';
    
    // Calcular a data formatada
    const dataFormatada = this.formatarDataCompleta(dia.data);
    
    diaRoteiro.innerHTML = `
      <div class="dia-header">
        <div class="dia-numero">${numeroDia}</div>
        <span>Dia ${numeroDia} — ${dataFormatada}</span>
      </div>
      
      <div class="dia-content">
        <p class="dia-descricao">
          "${dia.descricao || 'Explore e aproveite seu dia!'}"
        </p>
        
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
    
    // Adicionar evento de mudança de período
    setTimeout(() => {
      const tabs = diaRoteiro.querySelectorAll('.periodo-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          // Remover classe ativa de todas as tabs
          tabs.forEach(t => t.classList.remove('active'));
          
          // Adicionar classe ativa à tab clicada
          tab.classList.add('active');
          
          // Esconder todos os conteúdos de período
          const periodosConteudo = diaRoteiro.querySelectorAll('.periodo-conteudo');
          periodosConteudo.forEach(p => {
            p.style.display = 'none';
          });
          
          // Mostrar o conteúdo do período selecionado
          const diaSelecionado = tab.getAttribute('data-dia');
          const periodoSelecionado = tab.getAttribute('data-periodo');
          const conteudoSelecionado = document.getElementById(`dia-${diaSelecionado}-${periodoSelecionado}`);
          
          if (conteudoSelecionado) {
            conteudoSelecionado.style.display = 'block';
          }
        });
      });
      
      // Adicionar eventos para botões Ver no Mapa
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
   * @param {Object|null} previsao - Dados da previsão
   * @returns {string} HTML da previsão
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
   * Cria o elemento HTML para um período do dia
   * @param {Object} periodo - Dados do período
   * @param {string} nomePeriodo - Nome do período (manha, tarde, noite)
   * @returns {string} HTML do período
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
    
    // Se temos horário especial (para chegada/partida)
    if (periodo.horarioEspecial) {
      html += `
        <div class="atividade-horario">
          <span class="icone">✈️</span>
          <span>${periodo.horarioEspecial}</span>
        </div>
      `;
    }
    
    // Renderizar cada atividade
    periodo.atividades.forEach(atividade => {
      html += `
        <div class="atividade">
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
          
          <button class="btn-ver-mapa" data-local="${atividade.local}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
            </svg>
            Ver no mapa
          </button>
        </div>
      `;
    });
    
    return html;
  },
  
  /**
   * Abrir mapa com o local
   * @param {string} local - Nome do local
   */
  abrirMapa(local) {
    const query = `${local}, ${this.dadosDestino.destino}, ${this.dadosDestino.pais}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  },
  
  /**
   * Compartilhar o roteiro
   */
  compartilharRoteiro() {
    // Verificar se a API Web Share está disponível
    if (navigator.share) {
      navigator.share({
        title: `Roteiro Benetrip para ${this.dadosDestino.destino}`,
        text: `Confira meu roteiro personalizado de viagem para ${this.dadosDestino.destino} gerado pela Benetrip!`,
        url: window.location.href
      })
      .then(() => console.log('Roteiro compartilhado com sucesso'))
      .catch((error) => console.log('Erro ao compartilhar:', error));
    } else {
      // Fallback para navegadores que não suportam a API Web Share
      this.exibirToast('Para compartilhar, copie o link da página e envie para seus amigos!', 'info');
      
      // Tentar copiar URL para a área de transferência
      try {
        navigator.clipboard.writeText(window.location.href);
        this.exibirToast('Link copiado para a área de transferência!', 'success');
      } catch (e) {
        console.warn('Erro ao copiar para área de transferência:', e);
      }
    }
  },
  
  /**
   * Editar o roteiro
   */
  editarRoteiro() {
    // Modal de edição (implementação básica)
    this.exibirToast('Função de personalização em desenvolvimento', 'info');
    
    // Exemplo de modal simples (expandir conforme necessidade)
    const modal = `
      <div class="modal-backdrop modal-active">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Personalizar Roteiro</h3>
            <button class="btn-fechar" id="btn-fechar-modal">×</button>
          </div>
          <div class="modal-body">
            <p>Funcionalidade em desenvolvimento.</p>
            <p>Em breve você poderá personalizar ainda mais seu roteiro!</p>
          </div>
          <div class="modal-footer">
            <button class="modal-btn modal-btn-primary">Entendi</button>
          </div>
        </div>
      </div>
    `;
    
    // Adicionar modal ao container
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
      modalContainer.innerHTML = modal;
      
      // Configurar eventos
      document.getElementById('btn-fechar-modal')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });
      
      document.querySelector('.modal-btn-primary')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });
    }
  },
  
  /**
   * Exibe mensagem toast
   * @param {string} mensagem - Mensagem a exibir
   * @param {string} tipo - Tipo de toast (info, success, warning, error)
   */
  exibirToast(mensagem, tipo = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensagem;
    
    toastContainer.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => {
      toast.classList.add('toast-visible');
    }, 10);
    
    // Remover após alguns segundos
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  },
  
  /**
   * Exibe mensagem de erro
   * @param {string} mensagem - Mensagem de erro
   */
  mostrarErro(mensagem) {
    this.exibirToast(mensagem, 'error');
    
    // Parar animação de progresso
    clearInterval(this.intervalId);
    
    // Atualizar UI para mostrar erro
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
      
      // Configurar botão de tentar novamente
      document.querySelector('.btn-tentar-novamente')?.addEventListener('click', () => {
        location.reload();
      });
    }
  },
  
  // --- Funções Auxiliares ---
  
  /**
   * Simula um delay para desenvolvimento
   * @param {number} ms - Milissegundos de delay
   * @returns {Promise} Promise que resolve após o delay
   */
  simularDelayDev(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  /**
   * Obtém os dados de tipo de viagem
   * @returns {string} Tipo de viagem
   */
  obterTipoViagem() {
    if (!this.dadosUsuario || !this.dadosUsuario.respostas) {
      return 'cultura';  // Default
    }
    
    const respostas = this.dadosUsuario.respostas;
    
    // Verificar diferentes campos possíveis
    if (typeof respostas.preferencia_viagem === 'number') {
      const mapeamento = ['relaxar', 'aventura', 'cultura', 'urbano'];
      return mapeamento[respostas.preferencia_viagem] || 'cultura';
    }
    
    if (typeof respostas.tipo_viagem === 'number') {
      const mapeamento = ['relaxar', 'aventura', 'cultural', 'urbano'];
      return mapeamento[respostas.tipo_viagem] || 'cultural';
    }
    
    // Buscar em texto
    const respostasTexto = JSON.stringify(respostas).toLowerCase();
    if (respostasTexto.includes('relax')) return 'relaxar';
    if (respostasTexto.includes('aventura')) return 'aventura';
    if (respostasTexto.includes('cultura')) return 'cultura';
    if (respostasTexto.includes('urbano')) return 'urbano';
    
    return 'cultura';  // Default
  },
  
  /**
   * Obtém o texto do tipo de preferência
   * @returns {string} Texto de preferência
   */
  obterTextoPreferencia() {
    const tipo = this.obterTipoViagem();
    const mapeamento = {
      'relaxar': 'Relaxamento',
      'aventura': 'Aventura',
      'cultura': 'Cultura',
      'urbano': 'Urbano'
    };
    
    return mapeamento[tipo] || 'Cultura';
  },
  
  /**
   * Obtém o ícone para o tipo de preferência
   * @returns {string} Emoji de ícone
   */
  obterIconePreferencia() {
    const tipo = this.obterTipoViagem();
    const mapeamento = {
      'relaxar': '🏖️',
      'aventura': '🏔️',
      'cultura': '🏛️',
      'urbano': '🛍️'
    };
    
    return mapeamento[tipo] || '🏛️';
  },
  
  /**
   * Obtém o tipo de companhia
   * @returns {string} Tipo de companhia
   */
  obterTipoCompanhia() {
    if (!this.dadosUsuario || !this.dadosUsuario.respostas) {
      return 'sozinho';  // Default
    }
    
    const respostas = this.dadosUsuario.respostas;
    
    // Verificar diferentes campos possíveis
    if (typeof respostas.companhia === 'number') {
      const mapeamento = ['sozinho', 'casal', 'familia', 'amigos'];
      return mapeamento[respostas.companhia] || 'sozinho';
    }
    
    // Buscar em texto
    const respostasTexto = JSON.stringify(respostas).toLowerCase();
    if (respostasTexto.includes('sozinho')) return 'sozinho';
    if (respostasTexto.includes('romantic') || respostasTexto.includes('casal')) return 'casal';
    if (respostasTexto.includes('famil')) return 'familia';
    if (respostasTexto.includes('amigos')) return 'amigos';
    
    return 'sozinho';  // Default
  },
  
  /**
   * Obtém o texto do tipo de companhia
   * @returns {string} Texto de companhia
   */
  obterTextoCompanhia() {
    const tipo = this.obterTipoCompanhia();
    const mapeamento = {
      'sozinho': 'Sozinho(a)',
      'casal': 'Casal',
      'familia': 'Família',
      'amigos': 'Amigos'
    };
    
    // Se tiver informação de quantidade de pessoas
    const respostas = this.dadosUsuario?.respostas || {};
    
    if (tipo === 'familia' && respostas.quantidade_familia) {
      return `Família (${respostas.quantidade_familia} pessoas)`;
    }
    
    if (tipo === 'amigos' && respostas.quantidade_amigos) {
      return `Amigos (${respostas.quantidade_amigos} pessoas)`;
    }
    
    return mapeamento[tipo] || 'Sozinho(a)';
  },
  
  /**
   * Obtém o ícone para o tipo de companhia
   * @returns {string} Emoji de ícone
   */
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
  
  /**
   * Obtém as preferências do usuário
   * @returns {Object} Objeto com preferências
   */
  obterPreferencias() {
    // Criar objeto de preferências baseado nos dados disponíveis
    return {
      tipoViagem: this.obterTipoViagem(),
      tipoCompanhia: this.obterTipoCompanhia(),
      // Adicionar outras preferências conforme necessário
    };
  },
  
  /**
   * Extrai nome do destino a partir do código IATA
   * @param {string} codigoIATA - Código IATA
   * @returns {string} Nome do destino
   */
  extrairNomeDestino(codigoIATA) {
    if (!codigoIATA) return 'Desconhecido';
    
    // Mapeamento básico (expandir conforme necessário)
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
      'MDE': 'Medellín'
    };
    
    return mapeamento[codigoIATA] || codigoIATA;
  },
  
  /**
   * Formata uma data
   * @param {string} dataString - String de data ISO
   * @returns {string} Data formatada
   */
  formatarData(dataString) {
    try {
      const data = new Date(dataString);
      return data.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long'
      });
    } catch (e) {
      console.warn('Erro ao formatar data:', e);
      return dataString;
    }
  },
  
  /**
   * Formata uma data completa com dia da semana
   * @param {string} dataString - String de data ISO
   * @returns {string} Data formatada completa
   */
  formatarDataCompleta(dataString) {
    try {
      const data = new Date(dataString);
      return data.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      console.warn('Erro ao formatar data completa:', e);
      return dataString;
    }
  },
  
  /**
   * Calcula o número de dias na viagem
   * @param {string} dataInicio - Data de início ISO
   * @param {string} dataFim - Data de fim ISO
   * @returns {number} Número de dias
   */
  calcularDiasViagem(dataInicio, dataFim) {
  try {
    if (!dataInicio) {
      console.warn('Data de início não fornecida');
      return 1;
    }
    
    const inicio = new Date(dataInicio);
    
    // Se não tiver data fim, assume 1 dia
    if (!dataFim) {
      console.warn('Data de fim não fornecida, assumindo 1 dia');
      return 1;
    }
    
    const fim = new Date(dataFim);
    const diffTempo = Math.abs(fim.getTime() - inicio.getTime());
    const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir o dia de chegada
    
    console.log(`Calculando dias: de ${dataInicio} até ${dataFim} = ${diffDias} dias`);
    
    return diffDias;
  } catch (e) {
    console.error('Erro ao calcular dias de viagem:', e);
    return 1;
  }
},
  
  /**
   * Obtém a classe CSS para uma badge
   * @param {string} tag - Nome da tag/badge
   * @returns {string} Classe CSS
   */
  obterClasseBadge(tag) {
    tag = tag.toLowerCase();
    
    if (tag.includes('imperd') || tag.includes('obrigat')) return '';  // Default (laranja)
    if (tag.includes('famil') || tag.includes('criança')) return 'badge-green';
    if (tag.includes('histór') || tag.includes('cultur')) return 'badge-blue';
    if (tag.includes('compra') || tag.includes('loja')) return 'badge-purple';
    
    return '';  // Default (laranja)
  },
  
  /**
   * Retorna um roteiro dummy para desenvolvimento
   * @returns {Object} Roteiro de exemplo
   */
  /**
 * Retorna um roteiro dummy para desenvolvimento
 * @returns {Object} Roteiro de exemplo
 */
obterRoteiroDummy() {
  // Datas da viagem a partir dos dados do usuário
  const dataInicioStr = this.extrairDataFormatada(this.dadosVoo.ida?.dataPartida) || 
                       (this.dadosUsuario?.respostas?.datas?.dataIda);
  const dataFimStr = this.extrairDataFormatada(this.dadosVoo.volta?.dataPartida) || 
                    (this.dadosUsuario?.respostas?.datas?.dataVolta);
  
  console.log(`=== INÍCIO obterRoteiroDummy ===`);
  console.log(`Data início String: ${dataInicioStr}`);
  console.log(`Data fim String: ${dataFimStr}`);
  
  if (!dataInicioStr || !dataFimStr) {
    console.warn('Datas não encontradas para gerar roteiro dummy');
    // Usar datas padrão se não encontrar
    const hoje = new Date();
    const dataInicio = new Date(hoje);
    dataInicio.setDate(hoje.getDate() + 1);
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataInicio.getDate() + 5);
    return this.gerarRoteiroPadrao(dataInicio, dataFim);
  }
  
  // Converter strings para objetos Date
  const dataInicio = new Date(dataInicioStr);
  const dataFim = new Date(dataFimStr);
  
  // Calcular número real de dias
  const diffTempo = Math.abs(dataFim.getTime() - dataInicio.getTime());
  const numeroRealDeDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;
  
  console.log(`=== CÁLCULO DE DIAS ===`);
  console.log(`Data início: ${dataInicio}`);
  console.log(`Data fim: ${dataFim}`);
  console.log(`Diferença em milissegundos: ${diffTempo}`);
  console.log(`Número real de dias calculado: ${numeroRealDeDias}`);
  console.log(`=== FIM CÁLCULO ===`);
  
  // FORÇAR o número correto de dias
  const roteiro = this.gerarRoteiroPadrao(dataInicio, dataFim, numeroRealDeDias);
  
  console.log(`=== RESULTADO obterRoteiroDummy ===`);
  console.log(`Dias no roteiro gerado: ${roteiro.dias?.length || 0}`);
  console.log(`=== FIM obterRoteiroDummy ===`);
  
  return roteiro;
},

/**
 * Gera um roteiro padrão com todos os dias entre as datas fornecidas
 * @param {Date} dataInicio - Data de início
 * @param {Date} dataFim - Data de fim
 * @returns {Object} Roteiro completo
 */
gerarRoteiroPadrao(dataInicio, dataFim, numeroEspecificoDeDias = null) {
  console.log(`=== INÍCIO gerarRoteiroPadrao ===`);
  console.log(`Parâmetros recebidos:`);
  console.log(`- dataInicio: ${dataInicio}`);
  console.log(`- dataFim: ${dataFim}`);
  console.log(`- numeroEspecificoDeDias: ${numeroEspecificoDeDias}`);
  
  // Gerar array de dias
  const dias = [];
  let dataAtual = new Date(dataInicio);
  
  // SEMPRE usar o número específico de dias se fornecido
  let totalDias;
  if (numeroEspecificoDeDias && numeroEspecificoDeDias > 0) {
    totalDias = numeroEspecificoDeDias;
    console.log(`*** USANDO número específico: ${totalDias} dias ***`);
  } else {
    // Calcular a diferença de dias apenas se não tiver número específico
    const diffTempo = Math.abs(dataFim.getTime() - dataInicio.getTime());
    totalDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;
    console.log(`*** CALCULANDO: ${totalDias} dias ***`);
  }
  
  console.log(`*** GERANDO EXATAMENTE ${totalDias} DIAS ***`);
  
  // Loop para criar TODOS os dias
  for (let i = 0; i < totalDias; i++) {
    const diaSemana = dataAtual.getDay();
    const descricao = this.obterDescricaoDia(diaSemana, i + 1, this.dadosDestino?.destino || 'Orlando');
    
    const diaRoteiro = {
      data: dataAtual.toISOString().split('T')[0],
      descricao,
      manha: this.gerarAtividadesPeriodo('manha', diaSemana, i + 1, this.dadosDestino?.destino || 'Orlando'),
      tarde: this.gerarAtividadesPeriodo('tarde', diaSemana, i + 1, this.dadosDestino?.destino || 'Orlando'),
      noite: this.gerarAtividadesPeriodo('noite', diaSemana, i + 1, this.dadosDestino?.destino || 'Orlando')
    };
    
    dias.push(diaRoteiro);
    
    // Log para os primeiros 3 dias, alguns intermediários e último
    if (i < 3 || i === Math.floor(totalDias/2) || i === totalDias - 1) {
      console.log(`Dia ${i + 1}/${totalDias} criado: ${diaRoteiro.data} - ${descricao}`);
    }
    
    // Avançar para o próximo dia
    dataAtual.setDate(dataAtual.getDate() + 1);
  }
  
  // Adicionar informações especiais de chegada e partida
  if (dias.length > 0) {
    // Primeiro dia - chegada
    const horarioChegada = this.dadosVoo?.ida?.horaChegada || '17:05';
    const horaChegada = parseInt(horarioChegada.split(':')[0]);
    
    if (horaChegada >= 6 && horaChegada < 12) {
      dias[0].manha.horarioEspecial = `Chegada às ${horarioChegada}`;
    } else if (horaChegada >= 12 && horaChegada < 18) {
      dias[0].tarde.horarioEspecial = `Chegada às ${horarioChegada}`;
    } else {
      dias[0].noite.horarioEspecial = `Chegada às ${horarioChegada}`;
    }
    
    // Último dia - partida
    const horarioPartida = this.dadosVoo?.volta?.horaPartida || '07:15';
    const horaPartida = parseInt(horarioPartida.split(':')[0]);
    const ultimoDia = dias.length - 1;
    
    if (horaPartida >= 6 && horaPartida < 12) {
      dias[ultimoDia].manha.horarioEspecial = `Partida às ${horarioPartida}`;
    } else if (horaPartida >= 12 && horaPartida < 18) {
      dias[ultimoDia].tarde.horarioEspecial = `Partida às ${horarioPartida}`;
    } else {
      dias[ultimoDia].noite.horarioEspecial = `Partida às ${horarioPartida}`;
    }
  }
  
  console.log(`=== RESULTADO gerarRoteiroPadrao ===`);
  console.log(`Total de dias criados: ${dias.length}`);
  console.log(`Primeiro dia: ${dias[0]?.data}`);
  console.log(`Último dia: ${dias[dias.length - 1]?.data}`);
  console.log(`=== FIM gerarRoteiroPadrao ===`);
  
  return {
    destino: `${this.dadosDestino?.destino || 'Orlando'}, ${this.dadosDestino?.pais || 'EUA'}`,
    dias
  };
},

/**
 * Gera uma descrição apropriada para o dia
 */
obterDescricaoDia(diaSemana, numeroDia, destino = "Orlando") {
  // Manter descrições genéricas para usar em qualquer destino
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
  
  // Usar modulo para rotacionar as descrições
  const indice = (numeroDia - 2) % descricoes.length;
  
  // Se for o último dia (quando maior que 10), usar descrição específica
  if (numeroDia > 10) {
    return descricoes[descricoes.length - 1];
  }
  
  return descricoes[indice];
},

/**
 * Gera atividades para um período específico
 */
gerarAtividadesPeriodo(periodo, diaSemana, numeroDia, destino = "Orlando") {
  // Atividades genéricas que podem ser adaptadas a qualquer cidade
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
  
  // Personalize os locais para o destino específico
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
  
  // Escolher atividades baseado no dia e período
  let atividades = [];
  const indice = (numeroDia + diaSemana) % atividadesPersonalizadas.length;
  atividades = [atividadesPersonalizadas[indice]];
  
  // Adicionar mais atividades se for um dia normal (não primeiro ou último)
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
    console.log('Inicializando módulo de roteiro Benetrip...');
    BENETRIP_ROTEIRO.init();
  }
});

// Exporta o módulo para acesso global
window.BENETRIP_ROTEIRO = BENETRIP_ROTEIRO;

