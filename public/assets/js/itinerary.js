/**
 * Benetrip - Sistema de Roteiro Personalizado (CORRIGIDO)
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
  MAX_DIAS_VIAGEM: 30,
  DIAS_SIMULACAO_DEV: 30,
  
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
      console.log('✅ Dados do voo carregados:', this.dadosVoo);
      
      // Carregar dados do usuário
      const usuarioString = localStorage.getItem('benetrip_user_data');
      if (usuarioString) {
        this.dadosUsuario = JSON.parse(usuarioString);
        console.log('✅ Dados do usuário carregados:', this.dadosUsuario);
      } else {
        console.warn('⚠️ Dados do usuário não encontrados.');
        this.dadosUsuario = {};
      }
      
      // Carregar dados do destino
      const destinoString = localStorage.getItem('benetrip_destino_selecionado');
      if (destinoString) {
        this.dadosDestino = JSON.parse(destinoString);
        console.log('✅ Dados do destino carregados:', this.dadosDestino);
      } else {
        this.dadosDestino = {
          destino: this.extrairNomeDestino(this.dadosVoo?.ida?.destino),
          codigo_iata: this.dadosVoo?.ida?.destino,
          pais: 'Desconhecido'
        };
        console.log('✅ Dados do destino extraídos do voo:', this.dadosDestino);
      }
      
      return true;
    } catch (erro) {
      console.error('❌ Erro ao carregar dados:', erro);
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
      console.log('🎯 Estrutura real dos dadosVoo:', JSON.stringify(this.dadosVoo));
      console.log('👤 Dados do usuário completos:', JSON.stringify(this.dadosUsuario));
      
      // Verificar e adaptar dados de datas
      let datasDoUsuario = this.dadosUsuario?.respostas?.datas;
      if (datasDoUsuario) {
        console.log('📅 Datas encontradas nas respostas do usuário:', datasDoUsuario);
        
        let dataIda, dataVolta;
        
        if (typeof datasDoUsuario === 'object' && datasDoUsuario.dataIda) {
          dataIda = datasDoUsuario.dataIda;
          dataVolta = datasDoUsuario.dataVolta;
        } else if (Array.isArray(datasDoUsuario) && datasDoUsuario.length >= 2) {
          dataIda = datasDoUsuario[0];
          dataVolta = datasDoUsuario[1];
        } else if (typeof datasDoUsuario === 'string' && datasDoUsuario.includes(',')) {
          [dataIda, dataVolta] = datasDoUsuario.split(',');
        }
        
        if (dataIda) {
          console.log(`📊 Usando datas do usuário: Ida=${dataIda}, Volta=${dataVolta}`);
          
          if (!this.dadosVoo) this.dadosVoo = {};
          if (!this.dadosVoo.ida) this.dadosVoo.ida = {};
          
          this.dadosVoo.ida.dataPartida = dataIda;
          
          if (dataVolta) {
            if (!this.dadosVoo.volta) this.dadosVoo.volta = {};
            this.dadosVoo.volta.dataPartida = dataVolta;
          }
        }
      }
      
      // Verificar e adaptar formato dos dados
      if (this.dadosVoo && !this.dadosVoo.ida && this.dadosVoo.voo) {
        console.log('🔄 Adaptando formato dos dados de voo...');
        this.dadosVoo.ida = {
          dataPartida: this.dadosVoo.voo.dataIda || this.dadosVoo.dataIda || this.dadosVoo.voo.data,
          horaChegada: this.dadosVoo.voo.horaChegada || '12:00',
          destino: this.dadosVoo.voo.destino || this.dadosDestino?.codigo_iata
        };
        
        if (this.dadosVoo.voo.dataVolta || this.dadosVoo.dataVolta) {
          this.dadosVoo.volta = {
            dataPartida: this.dadosVoo.voo.dataVolta || this.dadosVoo.dataVolta,
            horaPartida: this.dadosVoo.voo.horaPartida || '14:00'
          };
        }
        
        console.log('✅ Dados adaptados:', this.dadosVoo);
      }
      
      // Verificação final dos dados
      const temDataPartida = (this.dadosVoo?.ida?.dataPartida) || 
                             (this.dadosVoo?.voo?.dataIda) || 
                             (this.dadosVoo?.dataIda) ||
                             (this.dadosVoo?.data);
      
      if (!this.dadosVoo || !temDataPartida) {
        if (this.dadosUsuario?.respostas?.datas) {
          const datas = this.dadosUsuario.respostas.datas;
          console.log('🔍 Tentando extrair datas do objeto:', datas);
          
          let dataIda, dataVolta;
          
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
            
            console.log('🆕 Dados de voo criados a partir de datas do usuário:', this.dadosVoo);
          }
        }
        
        // Último recurso - criar dados mínimos
        if (!this.dadosVoo || !this.dadosVoo.ida || !this.dadosVoo.ida.dataPartida) {
          if (this.dadosDestino) {
            console.log('⚠️ Criando dados de voo como último recurso...');
            
            const hoje = new Date();
            const dataIda = new Date(hoje);
            dataIda.setDate(hoje.getDate() + 30);
            
            const dataVolta = new Date(dataIda);
            dataVolta.setDate(dataIda.getDate() + 5);
            
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
            
            console.log('🆘 Dados de voo gerados como último recurso:', this.dadosVoo);
          } else {
            throw new Error('Dados insuficientes para gerar o roteiro.');
          }
        }
      }
      
      // Preparar parâmetros para a API
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
        modeloIA: "deepseekai"
      };
      
      console.log('📋 Parâmetros para geração de roteiro:', params);
      
      // Chamar a API ou usar dados dummy em desenvolvimento
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '') {
        console.log('🔧 Modo desenvolvimento - usando roteiro dummy');
        await this.simularDelayDev(3000);
        this.roteiroPronto = this.obterRoteiroDummy();
        
        // Ajustar datas do roteiro dummy
        if (this.roteiroPronto && this.roteiroPronto.dias && this.roteiroPronto.dias.length > 0) {
          const dataInicio = new Date(this.dadosVoo.ida.dataPartida);
          
          this.roteiroPronto.dias.forEach((dia, index) => {
            const dataDia = new Date(dataInicio);
            dataDia.setDate(dataInicio.getDate() + index);
            dia.data = dataDia.toISOString().split('T')[0];
          });
          
          console.log('✅ Roteiro dummy ajustado com datas reais:', this.roteiroPronto);
        }
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
      }
      
      console.log('🎉 Roteiro gerado:', this.roteiroPronto);
      
      // Buscar previsão do tempo e imagens
      console.log('🌤️ Buscando previsão do tempo...');
      await this.buscarPrevisaoTempo();
      
      console.log('🖼️ Buscando imagens para locais...');
      await this.buscarImagensLocais();
      
      // Atualizar UI
      console.log(`✨ Finalizando roteiro com ${this.roteiroPronto.dias?.length || 0} dias`);
      this.atualizarUIComRoteiro();
      
    } catch (erro) {
      console.error('❌ Erro ao gerar roteiro:', erro);
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
   * FUNÇÃO CORRIGIDA: Busca previsão do tempo para os dias do roteiro
   */
  async buscarPrevisaoTempo() {
    try {
      if (!this.roteiroPronto || !this.roteiroPronto.dias || !this.dadosDestino) {
        console.warn('⚠️ Dados insuficientes para buscar previsão do tempo');
        this.adicionarPrevisoesFictícias();
        return;
      }
      
      const dataInicio = this.extrairDataFormatada(this.dadosVoo.ida?.dataPartida);
      const dataFim = this.extrairDataFormatada(this.dadosVoo.volta?.dataPartida);
      
      if (!dataInicio) {
        console.warn('⚠️ Data de início não disponível para previsão do tempo');
        this.adicionarPrevisoesFictícias();
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
        this.adicionarPrevisoesFictícias();
        return;
      }
      
      const previsoes = await response.json();
      console.log('✅ Previsões do tempo recebidas:', previsoes);
      
      // Verificar se recebemos dados válidos
      if (!previsoes || typeof previsoes !== 'object') {
        console.warn('⚠️ Formato inválido de previsões do tempo');
        this.adicionarPrevisoesFictícias();
        return;
      }
      
      // CORREÇÃO: Adicionar previsões aos dias do roteiro
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
      
      // Sempre adicionar previsões fictícias como fallback
      this.adicionarPrevisoesFictícias();
    }
  },

  /**
   * NOVA FUNÇÃO: Adiciona previsões fictícias a todos os dias
   */
  adicionarPrevisoesFictícias() {
    console.log('🎲 Adicionando previsões fictícias...');
    
    if (!this.roteiroPronto || !this.roteiroPronto.dias) {
      console.warn('⚠️ Não há dias no roteiro para adicionar previsões');
      return;
    }
    
    this.roteiroPronto.dias.forEach((dia, index) => {
      if (!dia.previsao) {
        dia.previsao = this.gerarPrevisaoFicticia(index);
      }
    });
    
    console.log(`✅ Previsões fictícias adicionadas a ${this.roteiroPronto.dias.length} dias`);
  },

  /**
   * NOVA FUNÇÃO: Gera uma previsão fictícia para um dia
   * @param {number} index - Índice do dia
   * @returns {Object} Objeto de previsão
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
   * Extrai a data formatada de uma string ISO ou outros formatos possíveis
   * @param {string} dataString - String de data
   * @returns {string} Data formatada como YYYY-MM-DD
   */
  extrairDataFormatada(dataString) {
    if (!dataString) return null;
    
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
        return dataString;
      }
      
      if (dataString.includes('T')) {
        return dataString.split('T')[0];
      }
      
      const data = new Date(dataString);
      if (!isNaN(data.getTime())) {
        return data.toISOString().split('T')[0];
      }
      
      return null;
    } catch (e) {
      console.warn('⚠️ Erro ao extrair data formatada:', e);
      return null;
    }
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
    
    const diasViagem = this.calcularDiasViagem(
      this.dadosVoo.ida?.dataPartida, 
      this.dadosVoo.volta?.dataPartida
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
   * Cria o elemento de um dia do roteiro
   */
  criarElementoDiaRoteiro(dia, numeroDia) {
    const diaRoteiro = document.createElement('div');
    diaRoteiro.className = 'dia-roteiro';
    
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
   * Cria o elemento HTML para um período do dia
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

  // ===========================================
  // FUNÇÕES CORRIGIDAS PARA MAPEAMENTO DE PREFERÊNCIAS
  // ===========================================

  /**
   * FUNÇÃO CORRIGIDA: Obtém os dados de tipo de viagem 
   * @returns {string} Tipo de viagem
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
    
    // 2. VERIFICAR destino_imaginado (campo do questionário original)
    if (typeof respostas.destino_imaginado === 'number') {
      const mapeamento = ['praia', 'natureza', 'urbano', 'surpresa'];
      const destino = mapeamento[respostas.destino_imaginado];
      
      if (destino === 'praia') return 'relaxar';
      if (destino === 'natureza') return 'aventura';
      if (destino === 'urbano') return 'urbano';
      if (destino === 'surpresa') return 'cultura';
      
      console.log(`✅ Tipo de viagem via destino_imaginado[${respostas.destino_imaginado}]: ${destino} -> mapeado`);
    }
    
    // 3. VERIFICAR tipo_viagem (campo genérico)
    if (typeof respostas.tipo_viagem === 'number') {
      const mapeamento = ['relaxar', 'aventura', 'cultura', 'urbano'];
      const tipoViagem = mapeamento[respostas.tipo_viagem] || 'cultura';
      console.log(`✅ Tipo de viagem via tipo_viagem[${respostas.tipo_viagem}]: ${tipoViagem}`);
      return tipoViagem;
    }
    
    // 4. VERIFICAR preferencia_viagem (campo alternativo)
    if (typeof respostas.preferencia_viagem === 'number') {
      const mapeamento = ['relaxar', 'aventura', 'cultura', 'urbano'];
      const tipoViagem = mapeamento[respostas.preferencia_viagem] || 'cultura';
      console.log(`✅ Tipo de viagem via preferencia_viagem[${respostas.preferencia_viagem}]: ${tipoViagem}`);
      return tipoViagem;
    }
    
    // 5. BUSCAR em texto (fallback)
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
   * FUNÇÃO CORRIGIDA: Obtém o texto do tipo de preferência 
   * @returns {string} Texto de preferência
   */
  obterTextoPreferencia() {
    const tipo = this.obterTipoViagem();
    const mapeamento = {
      'relaxar': 'Relaxamento e Praia',
      'aventura': 'Aventura e Natureza',
      'cultura': 'Cultura e História',
      'urbano': 'Urbano e Vida Noturna'  // ← CORRIGIDO
    };
    
    const texto = mapeamento[tipo] || 'Cultura e História';
    console.log(`🏷️ Texto de preferência: ${tipo} -> ${texto}`);
    return texto;
  },

  /**
   * FUNÇÃO CORRIGIDA: Obtém o ícone para o tipo de preferência 
   * @returns {string} Emoji de ícone
   */
  obterIconePreferencia() {
    const tipo = this.obterTipoViagem();
    const mapeamento = {
      'relaxar': '🏖️',
      'aventura': '🏔️',
      'cultura': '🏛️',
      'urbano': '🏙️'  // ← CORRIGIDO
    };
    
    const icone = mapeamento[tipo] || '🏛️';
    console.log(`🎯 Ícone de preferência: ${tipo} -> ${icone}`);
    return icone;
  },

  /**
   * FUNÇÃO CORRIGIDA: Obtém o tipo de companhia 
   * @returns {string} Tipo de companhia
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
   * FUNÇÃO CORRIGIDA: Obtém as preferências do usuário 
   * @returns {Object} Objeto com preferências detalhadas
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
   * NOVA FUNÇÃO: Obtém o foco principal baseado no tipo de viagem
   * @param {string} tipoViagem - Tipo de viagem
   * @returns {string} Foco principal
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
   * NOVA FUNÇÃO: Obtém atividades preferidas baseadas no perfil
   * @param {string} tipoViagem - Tipo de viagem
   * @param {string} tipoCompanhia - Tipo de companhia
   * @returns {Array} Lista de atividades preferidas
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
      'MDE': 'Medellín'
    };
    
    return mapeamento[codigoIATA] || codigoIATA;
  },

  formatarData(dataString) {
    try {
      const data = new Date(dataString);
      return data.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long'
      });
    } catch (e) {
      console.warn('⚠️ Erro ao formatar data:', e);
      return dataString;
    }
  },

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
      console.warn('⚠️ Erro ao formatar data completa:', e);
      return dataString;
    }
  },

  calcularDiasViagem(dataInicio, dataFim) {
    try {
      if (!dataInicio) {
        console.warn('⚠️ Data de início não fornecida');
        return 1;
      }
      
      const inicio = new Date(dataInicio);
      
      if (!dataFim) {
        console.warn('⚠️ Data de fim não fornecida, assumindo 1 dia');
        return 1;
      }
      
      const fim = new Date(dataFim);
      const diffTempo = Math.abs(fim.getTime() - inicio.getTime());
      const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;
      
      console.log(`📊 Calculando dias: de ${dataInicio} até ${dataFim} = ${diffDias} dias`);
      
      return diffDias;
    } catch (e) {
      console.error('❌ Erro ao calcular dias de viagem:', e);
      return 1;
    }
  },

  obterClasseBadge(tag) {
    tag = tag.toLowerCase();
    
    if (tag.includes('imperd') || tag.includes('obrigat')) return '';
    if (tag.includes('famil') || tag.includes('criança')) return 'badge-green';
    if (tag.includes('histór') || tag.includes('cultur')) return 'badge-blue';
    if (tag.includes('compra') || tag.includes('loja')) return 'badge-purple';
    
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

  obterRoteiroDummy() {
    const dataInicioStr = this.extrairDataFormatada(this.dadosVoo.ida?.dataPartida) || 
                         (this.dadosUsuario?.respostas?.datas?.dataIda);
    const dataFimStr = this.extrairDataFormatada(this.dadosVoo.volta?.dataPartida) || 
                      (this.dadosUsuario?.respostas?.datas?.dataVolta);
    
    console.log(`📊 Gerando roteiro dummy: ${dataInicioStr} até ${dataFimStr}`);
    
    if (!dataInicioStr || !dataFimStr) {
      console.warn('⚠️ Datas não encontradas para gerar roteiro dummy');
      const hoje = new Date();
      const dataInicio = new Date(hoje);
      dataInicio.setDate(hoje.getDate() + 1);
      const dataFim = new Date(dataInicio);
      dataFim.setDate(dataInicio.getDate() + 5);
      return this.gerarRoteiroPadrao(dataInicio, dataFim);
    }
    
    const dataInicio = new Date(dataInicioStr);
    const dataFim = new Date(dataFimStr);
    
    const diffTempo = Math.abs(dataFim.getTime() - dataInicio.getTime());
    const numeroRealDeDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;
    
    console.log(`📅 Número real de dias calculado: ${numeroRealDeDias}`);
    
    const roteiro = this.gerarRoteiroPadrao(dataInicio, dataFim, numeroRealDeDias);
    
    console.log(`✅ Roteiro dummy gerado com ${roteiro.dias?.length || 0} dias`);
    
    return roteiro;
  },

  gerarRoteiroPadrao(dataInicio, dataFim, numeroEspecificoDeDias = null) {
    console.log(`🏗️ Gerando roteiro padrão...`);
    
    const dias = [];
    let dataAtual = new Date(dataInicio);
    
    let totalDias;
    if (numeroEspecificoDeDias && numeroEspecificoDeDias > 0) {
      totalDias = numeroEspecificoDeDias;
      console.log(`🎯 Usando número específico: ${totalDias} dias`);
    } else {
      const diffTempo = Math.abs(dataFim.getTime() - dataInicio.getTime());
      totalDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24)) + 1;
      console.log(`🧮 Calculando: ${totalDias} dias`);
    }
    
    console.log(`🏗️ Gerando exatamente ${totalDias} dias`);
    
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
      
      if (i < 3 || i === Math.floor(totalDias/2) || i === totalDias - 1) {
        console.log(`📅 Dia ${i + 1}/${totalDias} criado: ${diaRoteiro.data}`);
      }
      
      dataAtual.setDate(dataAtual.getDate() + 1);
    }
    
    // Adicionar informações de chegada e partida
    if (dias.length > 0) {
      const horarioChegada = this.dadosVoo?.ida?.horaChegada || '17:05';
      const horaChegada = parseInt(horarioChegada.split(':')[0]);
      
      if (horaChegada >= 6 && horaChegada < 12) {
        dias[0].manha.horarioEspecial = `Chegada às ${horarioChegada}`;
      } else if (horaChegada >= 12 && horaChegada < 18) {
        dias[0].tarde.horarioEspecial = `Chegada às ${horarioChegada}`;
      } else {
        dias[0].noite.horarioEspecial = `Chegada às ${horarioChegada}`;
      }
      
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
    
    console.log(`✅ Roteiro padrão criado com ${dias.length} dias`);
    
    return {
      destino: `${this.dadosDestino?.destino || 'Orlando'}, ${this.dadosDestino?.pais || 'EUA'}`,
      dias
    };
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
