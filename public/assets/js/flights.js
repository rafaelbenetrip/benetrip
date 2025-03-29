/**
 * BENETRIP - Visualização de Voos
 * Controla a exibição e interação com os resultados de voos
 */

const BENETRIP_VOOS = {
    /**
     * Configuração do módulo
     */
    config: {
        imagePath: 'assets/images/',
        companhiasLogos: {
            'AA': 'american-airlines.png',
            'LA': 'latam.png',
            'G3': 'gol.png',
            'AD': 'azul.png',
            'CM': 'copa.png',
            'AV': 'avianca.png',
            'UA': 'united.png',
            'DL': 'delta.png',
            'default': 'airline-default.png'
        },
        animationDelay: 300
    },

    /**
     * Estados do módulo
     */
    estado: {
        resultados: null,
        voosSelecionados: [],
        filtros: {
            precoMax: null,
            precoMin: null,
            companhias: [],
            paradas: null,
            duracao: null
        },
        ordenacao: 'preco',
        fluxo: null
    },

    /**
     * Inicializa o módulo de voos
     */
    init() {
        console.log("Inicializando módulo de voos...");
        
        // Carregar dados
        this.carregarDados();
        
        // Renderizar interface
        this.renderizarInterface();
        
        // Configurar eventos
        this.configurarEventos();
        
        return this;
    },

    /**
     * Carrega dados do localStorage
     */
    carregarDados() {
        try {
            // Carregar preferências do usuário
            const dadosUsuario = localStorage.getItem('benetrip_user_data');
            if (dadosUsuario) {
                this.estado.dadosUsuario = JSON.parse(dadosUsuario);
                this.estado.fluxo = this.estado.dadosUsuario.fluxo;
            } else {
                console.warn("Dados do usuário não encontrados");
                this.redirecionarParaInicio();
                return;
            }
            
            // Carregar destino escolhido se estiver no fluxo de recomendação
            if (this.estado.fluxo === 'destino_desconhecido') {
                const destinoEscolhido = localStorage.getItem('benetrip_destino_escolhido');
                if (destinoEscolhido) {
                    this.estado.destinoEscolhido = JSON.parse(destinoEscolhido);
                } else {
                    console.warn("Destino escolhido não encontrado");
                    this.redirecionarParaDestinos();
                    return;
                }
            }
            
            // Carregar resultados de voos
            const resultadosVoos = localStorage.getItem('benetrip_resultados_voos');
            if (resultadosVoos) {
                this.estado.resultados = JSON.parse(resultadosVoos);
                
                // Configurar filtros baseados nos resultados
                this.configurarFiltrosIniciais();
            } else {
                // Se não tiver resultados, buscar voos
                this.buscarVoos();
            }
            
            console.log("Dados carregados com sucesso");
        } catch (erro) {
            console.error("Erro ao carregar dados:", erro);
            this.redirecionarParaInicio();
        }
    },

    /**
     * Configura os filtros iniciais baseados nos resultados
     */
    configurarFiltrosIniciais() {
        if (!this.estado.resultados || !this.estado.resultados.voos) return;
        
        // Obter valores mínimos e máximos de preço
        const precos = this.estado.resultados.voos.map(voo => {
            let valor = 0;
            if (typeof voo.preco.total === 'string') {
                valor = parseFloat(voo.preco.total.replace(/[^0-9.,]/g, '').replace(',', '.'));
            } else {
                valor = voo.preco.total;
            }
            return valor;
        });
        
        this.estado.filtros.precoMin = Math.min(...precos);
        this.estado.filtros.precoMax = Math.max(...precos);
        
        // Obter companhias disponíveis
        const companhias = new Set();
        this.estado.resultados.voos.forEach(voo => {
            voo.companhias.forEach(companhia => {
                companhias.add(companhia);
            });
        });
        
        this.estado.filtros.companhias = Array.from(companhias);
        
        // Obter opções de paradas
        const paradas = new Set();
        this.estado.resultados.voos.forEach(voo => {
            voo.segmentos.forEach(segmento => {
                paradas.add(segmento.paradas);
            });
        });
        
        this.estado.filtros.opcoesParadas = Array.from(paradas).sort();
    },

    /**
     * Redireciona para a página inicial
     */
    redirecionarParaInicio() {
        alert("Precisamos de algumas informações antes de mostrar os voos. Vamos recomeçar!");
        window.location.href = 'index.html';
    },

    /**
     * Redireciona para a página de destinos
     */
    redirecionarParaDestinos() {
        alert("Antes de ver os voos, você precisa escolher um destino!");
        window.location.href = 'destinos.html';
    },

    /**
     * Busca voos usando a API
     */
    buscarVoos() {
        // Mostrar overlay de carregamento
        this.mostrarCarregando(true, "Buscando as melhores opções de voos...");
        
        // Verificar se o serviço API está disponível
        if (!window.BENETRIP_API) {
            console.error("Serviço de API não disponível");
            this.mostrarErro("Serviço de busca não disponível no momento. Tente novamente mais tarde.");
            return;
        }
        
        // Preparar parâmetros para busca
        let params = {};
        
        if (this.estado.fluxo === 'destino_conhecido') {
            // Fluxo onde o usuário já sabia o destino
            const respostas = this.estado.dadosUsuario.respostas;
            
            params = {
                origem: respostas.cidade_partida.code,
                destino: respostas.destino_conhecido.code,
                dataIda: respostas.datas.dataIda,
                dataVolta: respostas.datas.dataVolta,
                adultos: this.getNumeroAdultos(respostas)
            };
        } else {
            // Fluxo de recomendação
            const destino = this.estado.destinoEscolhido;
            const respostas = this.estado.dadosUsuario.respostas;
            
            params = {
                origem: respostas.cidade_partida.code,
                destino: destino.codigo_iata,
                dataIda: respostas.datas.dataIda,
                dataVolta: respostas.datas.dataVolta,
                adultos: this.getNumeroAdultos(respostas)
            };
        }
        
        // Chamar API para busca de voos
        window.BENETRIP_API.buscarVoos(params)
            .then(resultados => {
                // Salvar resultados
                this.estado.resultados = resultados;
                localStorage.setItem('benetrip_resultados_voos', JSON.stringify(resultados));
                
                // Configurar filtros
                this.configurarFiltrosIniciais();
                
                // Atualizar interface
                this.renderizarInterface();
                
                // Esconder overlay de carregamento
                this.mostrarCarregando(false);
            })
            .catch(erro => {
                console.error("Erro ao buscar voos:", erro);
                this.mostrarErro("Ocorreu um erro ao buscar voos. Tente novamente mais tarde.");
                this.mostrarCarregando(false);
            });
    },

    /**
     * Obtém o número total de adultos com base nas respostas
     */
    getNumeroAdultos(respostas) {
        if (respostas.companhia === 0) {
            // Viajando sozinho
            return 1;
        } else if (respostas.companhia === 1) {
            // Viajando em casal
            return 2;
        } else if (respostas.companhia === 2) {
            // Viajando em família
            return respostas.quantidade_familia || 2;
        } else if (respostas.companhia === 3) {
            // Viajando com amigos
            return respostas.quantidade_amigos || 2;
        }
        
        // Valor padrão
        return 1;
    },

    /**
     * Renderiza a interface principal
     */
    renderizarInterface() {
        // Verificar se temos o contêiner principal
        const container = document.getElementById('voos-container');
        if (!container) {
            console.error("Contêiner de voos não encontrado");
            return;
        }
        
        // Verificar se temos resultados
        if (!this.estado.resultados) {
            container.innerHTML = `
                <div class="loading-container">
                    <img src="${this.config.imagePath}tripinha/avatar-pensando.png" alt="Tripinha carregando" class="loading-avatar" />
                    <div class="loading-text">Buscando os melhores voos para você...</div>
                    <div class="loading-spinner"></div>
                </div>
            `;
            return;
        }
        
        // Renderizar estrutura principal
        container.innerHTML = `
            <div class="voos-header">
                <div class="logo-container">
                    <img src="${this.config.imagePath}logo.png" alt="Benetrip" />
                </div>
                <h1>Voos Disponíveis</h1>
            </div>
            
            <div class="tripinha-message">
                <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" />
                <div class="message-bubble">
                    <p>Encontrei os melhores voos para sua viagem! 🐾✈️ Escolha a opção que mais combina com você!</p>
                </div>
            </div>
            
            <div class="voos-content">
                <div class="voos-info">
                    <div class="voos-resumo">
                        <div class="rota">
                            <div class="origem">${this.estado.resultados.origem}</div>
                            <div class="separador">✈️</div>
                            <div class="destino">${this.estado.resultados.destino}</div>
                        </div>
                        <div class="datas">
                            <div class="ida">${this.formatarData(this.estado.resultados.dataIda)}</div>
                            <div class="separador">-</div>
                            <div class="volta">${this.formatarData(this.estado.resultados.dataVolta)}</div>
                        </div>
                        <div class="passageiros">
                            <div class="quantidade">${this.estado.resultados.adultos} ${this.estado.resultados.adultos > 1 ? 'Passageiros' : 'Passageiro'}</div>
                        </div>
                    </div>
                </div>
                
                <div class="voos-filtros-ordenacao">
                    <div class="ordenacao">
                        <label for="ordenar-por">Ordenar por:</label>
                        <select id="ordenar-por">
                            <option value="preco" selected>Menor Preço</option>
                            <option value="duracao">Menor Duração</option>
                            <option value="partida">Horário de Partida</option>
                            <option value="chegada">Horário de Chegada</option>
                        </select>
                    </div>
                    
                    <div class="filtros">
                        <button class="btn-filtro">
                            <span class="filtro-icon">🔍</span> Filtrar Resultados
                        </button>
                    </div>
                </div>
                
                <div id="voos-lista" class="voos-lista"></div>
                
                <div id="sem-resultados" class="sem-resultados" style="display: none;">
                    <div class="icone">😕</div>
                    <h3>Sem resultados para os filtros selecionados</h3>
                    <p>Tente ajustar os filtros para ver mais opções de voos.</p>
                    <button class="btn-limpar-filtros">Limpar Filtros</button>
                </div>
                
                <div id="painel-filtros" class="painel-filtros">
                    <div class="filtros-header">
                        <h3>Filtrar Voos</h3>
                        <button class="btn-fechar-filtros">✕</button>
                    </div>
                    
                    <div class="filtros-content">
                        <div class="filtro-grupo">
                            <h4>Preço</h4>
                            <div class="range-slider-container">
                                <div class="range-values">
                                    <span id="preco-min-value"></span>
                                    <span id="preco-max-value"></span>
                                </div>
                                <div class="range-slider">
                                    <input type="range" id="preco-min" class="range-slider-min">
                                    <input type="range" id="preco-max" class="range-slider-max">
                                </div>
                            </div>
                        </div>
                        
                        <div class="filtro-grupo">
                            <h4>Companhias Aéreas</h4>
                            <div id="companhias-lista" class="checkbox-group"></div>
                        </div>
                        
                        <div class="filtro-grupo">
                            <h4>Paradas</h4>
                            <div id="paradas-lista" class="radio-group"></div>
                        </div>
                        
                        <div class="filtro-grupo">
                            <h4>Duração</h4>
                            <div class="radio-group">
                                <label>
                                    <input type="radio" name="duracao" value="todas" checked>
                                    <span>Qualquer duração</span>
                                </label>
                                <label>
                                    <input type="radio" name="duracao" value="curta">
                                    <span>Até 6 horas</span>
                                </label>
                                <label>
                                    <input type="radio" name="duracao" value="media">
                                    <span>Até 12 horas</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filtros-footer">
                        <button class="btn-limpar-filtros">Limpar Filtros</button>
                        <button class="btn-aplicar-filtros">Aplicar Filtros</button>
                    </div>
                </div>
            </div>
        `;
        
        // Renderizar lista de voos
        this.renderizarVoos();
        
        // Configurar filtros
        this.configurarFiltrosUI();
        
        // Configurar eventos específicos
        this.configurarEventosEspecificos();
    },

    /**
     * Renderiza a lista de voos
     */
    renderizarVoos() {
        // Verificar se temos o contêiner de lista
        const container = document.getElementById('voos-lista');
        if (!container) return;
        
        // Verificar se temos resultados
        if (!this.estado.resultados || !this.estado.resultados.voos || this.estado.resultados.voos.length === 0) {
            container.innerHTML = `
                <div class="sem-voos">
                    <p>Não encontramos voos para esta rota e data. Tente outras opções.</p>
                    <button class="btn-voltar">Voltar</button>
                </div>
            `;
            return;
        }
        
        // Obter voos filtrados e ordenados
        const voos = this.filtrarOrdenarVoos();
        
        // Verificar se temos voos após filtros
        if (voos.length === 0) {
            document.getElementById('sem-resultados').style.display = 'flex';
            container.innerHTML = '';
            return;
        } else {
            document.getElementById('sem-resultados').style.display = 'none';
        }
        
        // Limpar contêiner
        container.innerHTML = '';
        
        // Renderizar cada voo
        voos.forEach((voo, index) => {
            const card = document.createElement('div');
            card.className = 'voo-card';
            card.dataset.id = voo.id;
            
            // HTML para o card de voo
            card.innerHTML = this.criarHTMLCardVoo(voo);
            
            // Adicionar ao contêiner
            container.appendChild(card);
            
            // Animar entrada com delay
            setTimeout(() => {
                card.classList.add('show');
            }, this.config.animationDelay * (index % 5)); // Limite de 5 para não atrasar muito
        });
        
        // Configurar eventos dos cards
        this.configurarEventosCards();
    },

    /**
     * Cria o HTML para um card de voo
     */
    criarHTMLCardVoo(voo) {
        // Processar informações do voo
        const ida = voo.segmentos[0];
        const volta = voo.segmentos.length > 1 ? voo.segmentos[1] : null;
        
        // Formatar preço
        const precoFormatado = this.formatarPreco(voo.preco.total, voo.preco.moeda);
        
        // Obter logo da companhia
        const companhiaPrincipal = voo.companhias[0];
        const logoUrl = this.getCompanhiaLogo(companhiaPrincipal);
        
        // Card básico
        let html = `
            <div class="voo-header">
                <div class="companhia">
                    <img src="${logoUrl}" alt="${companhiaPrincipal}" class="companhia-logo">
                    <span class="companhia-nome">${this.getNomeCompanhia(companhiaPrincipal)}</span>
                </div>
                <div class="voo-preco">
                    <span class="preco-valor">${precoFormatado}</span>
                    <span class="preco-tipo">por pessoa</span>
                </div>
            </div>
            
            <div class="voo-detalhes">
                <div class="segmento ida">
                    <div class="segmento-header">
                        <span class="segmento-tipo">Ida</span>
                        <span class="segmento-data">${this.formatarData(ida.partida.data)}</span>
                    </div>
                    
                    <div class="segmento-info">
                        <div class="horarios">
                            <div class="horario partida">
                                <span class="hora">${ida.partida.hora}</span>
                                <span class="codigo">${ida.partida.aeroporto}</span>
                            </div>
                            <div class="linha-tempo">
                                <div class="duracao">${ida.duracao}</div>
                                <div class="linha"></div>
                                <div class="paradas">${this.getTextoPorParadas(ida.paradas)}</div>
                            </div>
                            <div class="horario chegada">
                                <span class="hora">${ida.chegada.hora}</span>
                                <span class="codigo">${ida.chegada.aeroporto}</span>
                            </div>
                        </div>
                    </div>
                </div>
        `;
        
        // Adicionar segmento de volta se existir
        if (volta) {
            html += `
                <div class="segmento volta">
                    <div class="segmento-header">
                        <span class="segmento-tipo">Volta</span>
                        <span class="segmento-data">${this.formatarData(volta.partida.data)}</span>
                    </div>
                    
                    <div class="segmento-info">
                        <div class="horarios">
                            <div class="horario partida">
                                <span class="hora">${volta.partida.hora}</span>
                                <span class="codigo">${volta.partida.aeroporto}</span>
                            </div>
                            <div class="linha-tempo">
                                <div class="duracao">${volta.duracao}</div>
                                <div class="linha"></div>
                                <div class="paradas">${this.getTextoPorParadas(volta.paradas)}</div>
                            </div>
                            <div class="horario chegada">
                                <span class="hora">${volta.chegada.hora}</span>
                                <span class="codigo">${volta.chegada.aeroporto}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Adicionar informações de bagagem e rodapé
        html += `
                <div class="voo-info-adicionais">
                    <div class="bagagem">
                        <span class="bagagem-icon">🧳</span>
                        <span class="bagagem-texto">${this.getTextoBagagem(voo.bagagem)}</span>
                    </div>
                    
                    <div class="duracao-total">
                        <span class="duracao-icon">⏱️</span>
                        <span class="duracao-texto">Duração total: ${voo.duracaoTotal}</span>
                    </div>
                </div>
            </div>
            
            <div class="voo-footer">
                <button class="btn-detalhes">Ver Detalhes</button>
                <button class="btn-selecionar">Selecionar</button>
            </div>
        `;
        
        return html;
    },

    /**
     * Configura a UI dos filtros
     */
    configurarFiltrosUI() {
        // Configurar slider de preço
        const precoMin = document.getElementById('preco-min');
        const precoMax = document.getElementById('preco-max');
        const precoMinValue = document.getElementById('preco-min-value');
        const precoMaxValue = document.getElementById('preco-max-value');
        
        if (precoMin && precoMax && precoMinValue && precoMaxValue) {
            // Definir valores mínimos e máximos
            const minPreco = this.estado.filtros.precoMin;
            const maxPreco = this.estado.filtros.precoMax;
            
            precoMin.min = minPreco;
            precoMin.max = maxPreco;
            precoMin.value = minPreco;
            
            precoMax.min = minPreco;
            precoMax.max = maxPreco;
            precoMax.value = maxPreco;
            
            // Atualizar exibição
            precoMinValue.textContent = this.formatarPreco(minPreco);
            precoMaxValue.textContent = this.formatarPreco(maxPreco);
            
            // Configurar eventos
            precoMin.addEventListener('input', () => {
                if (parseInt(precoMin.value) > parseInt(precoMax.value)) {
                    precoMin.value = precoMax.value;
                }
                precoMinValue.textContent = this.formatarPreco(precoMin.value);
            });
            
            precoMax.addEventListener('input', () => {
                if (parseInt(precoMax.value) < parseInt(precoMin.value)) {
                    precoMax.value = precoMin.value;
                }
                precoMaxValue.textContent = this.formatarPreco(precoMax.value);
            });
        }
        
        // Configurar lista de companhias
        const companhiasLista = document.getElementById('companhias-lista');
        if (companhiasLista && this.estado.filtros.companhias) {
            // Criar checkbox para cada companhia
            companhiasLista.innerHTML = this.estado.filtros.companhias.map(companhia => {
                return `
                    <label>
                        <input type="checkbox" name="companhia" value="${companhia}" checked>
                        <span>${this.getNomeCompanhia(companhia)}</span>
                    </label>
                `;
            }).join('');
        }
        
        // Configurar opções de paradas
        const paradasLista = document.getElementById('paradas-lista');
        if (paradasLista && this.estado.filtros.opcoesParadas) {
            // Criar radio para cada opção de paradas
            let opcoesHTML = `
                <label>
                    <input type="radio" name="paradas" value="todas" checked>
                    <span>Qualquer número de paradas</span>
                </label>
            `;
            
            // Adicionar direto se disponível
            if (this.estado.filtros.opcoesParadas.includes(0)) {
                opcoesHTML += `
                    <label>
                        <input type="radio" name="paradas" value="0">
                        <span>Apenas voos diretos</span>
                    </label>
                `;
            }
            
            // Adicionar opção de 1 parada
            if (this.estado.filtros.opcoesParadas.includes(1)) {
                opcoesHTML += `
                    <label>
                        <input type="radio" name="paradas" value="1">
                        <span>Máximo 1 parada</span>
                    </label>
                `;
            }
            
            paradasLista.innerHTML = opcoesHTML;
        }
    },

    /**
     * Configura eventos específicos da interface
     */
    configurarEventosEspecificos() {
        // Evento para ordenação
        const selectOrdenacao = document.getElementById('ordenar-por');
        if (selectOrdenacao) {
            selectOrdenacao.addEventListener('change', () => {
                this.estado.ordenacao = selectOrdenacao.value;
                this.renderizarVoos();
            });
        }
        
        // Evento para abrir/fechar painel de filtros
        const btnFiltro = document.querySelector('.btn-filtro');
        const btnFecharFiltros = document.querySelector('.btn-fechar-filtros');
        const painelFiltros = document.getElementById('painel-filtros');
        
        if (btnFiltro && btnFecharFiltros && painelFiltros) {
            btnFiltro.addEventListener('click', () => {
                painelFiltros.classList.add('show');
            });
            
            btnFecharFiltros.addEventListener('click', () => {
                painelFiltros.classList.remove('show');
            });
        }
        
        // Evento para botão de aplicar filtros
        const btnAplicarFiltros = document.querySelector('.btn-aplicar-filtros');
        if (btnAplicarFiltros) {
            btnAplicarFiltros.addEventListener('click', () => {
                this.aplicarFiltros();
                if (painelFiltros) {
                    painelFiltros.classList.remove('show');
                }
            });
        }
        
        // Evento para botão de limpar filtros
        const btnLimparFiltros = document.querySelectorAll('.btn-limpar-filtros');
        if (btnLimparFiltros.length > 0) {
            btnLimparFiltros.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.limparFiltros();
                });
            });
        }
    },

    /**
     * Configura eventos para os cards de voo
     */
    configurarEventosCards() {
        // Eventos para botões de detalhes
        document.querySelectorAll('.btn-detalhes').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.voo-card');
                if (card) {
                    card.classList.toggle('expandido');
                    
                    // Alterar texto do botão
                    if (card.classList.contains('expandido')) {
                        btn.textContent = 'Ocultar Detalhes';
                    } else {
                        btn.textContent = 'Ver Detalhes';
                    }
                }
            });
        });
        
        // Eventos para botões de selecionar
        document.querySelectorAll('.btn-selecionar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.voo-card');
                if (card) {
                    const vooId = card.dataset.id;
                    const voo = this.estado.resultados.voos.find(v => v.id === vooId);
                    
                    if (voo) {
                        this.selecionarVoo(voo);
                    }
                }
            });
        });
    },

    /**
     * Filtra e ordena os voos de acordo com os critérios atuais
     */
    filtrarOrdenarVoos() {
        if (!this.estado.resultados || !this.estado.resultados.voos) {
            return [];
        }
        
        // Clone para não afetar os originais
        let voos = [...this.estado.resultados.voos];
        
        // Aplicar filtros ativos
        if (this.estado.filtrosAtivos) {
            // Filtro de preço
            if (this.estado.filtrosAtivos.precoMin !== undefined && this.estado.filtrosAtivos.precoMax !== undefined) {
                voos = voos.filter(voo => {
                    let preco = 0;
                    if (typeof voo.preco.total === 'string') {
                        preco = parseFloat(voo.preco.total.replace(/[^0-9.,]/g, '').replace(',', '.'));
                    } else {
                        preco = voo.preco.total;
                    }
                    
                    return preco >= this.estado.filtrosAtivos.precoMin && preco <= this.estado.filtrosAtivos.precoMax;
                });
            }
            
            // Filtro de companhias
            if (this.estado.filtrosAtivos.companhias && this.estado.filtrosAtivos.companhias.length > 0) {
                voos = voos.filter(voo => {
                    // Verificar se pelo menos uma companhia do voo está na lista de companhias selecionadas
                    return voo.companhias.some(companhia => this.estado.filtrosAtivos.companhias.includes(companhia));
                });
            }
            
            // Filtro de paradas
            if (this.estado.filtrosAtivos.paradas !== 'todas') {
                const maxParadas = parseInt(this.estado.filtrosAtivos.paradas);
                voos = voos.filter(voo => {
                    return voo.segmentos.every(segmento => segmento.paradas <= maxParadas);
                });
            }
            
            // Filtro de duração
            if (this.estado.filtrosAtivos.duracao !== 'todas') {
                const duracaoMaxMinutos = this.estado.filtrosAtivos.duracao === 'curta' ? 6 * 60 : 12 * 60;
                
                voos = voos.filter(voo => {
                    const duracaoTotal = this.converterDuracaoParaMinutos(voo.duracaoTotal);
                    return duracaoTotal <= duracaoMaxMinutos;
                });
            }
        }
        
        // Ordenar resultados
        voos.sort((a, b) => {
            switch (this.estado.ordenacao) {
                case 'preco':
                    // Ordenar por preço (menor para maior)
                    const precoA = typeof a.preco.total === 'string' 
                        ? parseFloat(a.preco.total.replace(/[^0-9.,]/g, '').replace(',', '.')) 
                        : a.preco.total;
                        
                    const precoB = typeof b.preco.total === 'string'
                        ? parseFloat(b.preco.total.replace(/[^0-9.,]/g, '').replace(',', '.'))
                        : b.preco.total;
                        
                    return precoA - precoB;
                    
                case 'duracao':
                    // Ordenar por duração total (menor para maior)
                    const duracaoA = this.converterDuracaoParaMinutos(a.duracaoTotal);
                    const duracaoB = this.converterDuracaoParaMinutos(b.duracaoTotal);
                    return duracaoA - duracaoB;
                    
                case 'partida':
                    // Ordenar por horário de partida (mais cedo para mais tarde)
                    const partidaA = this.converterHoraParaMinutos(a.segmentos[0].partida.hora);
                    const partidaB = this.converterHoraParaMinutos(b.segmentos[0].partida.hora);
                    return partidaA - partidaB;
                    
                case 'chegada':
                    // Ordenar por horário de chegada (mais cedo para mais tarde)
                    const chegadaA = this.converterHoraParaMinutos(a.segmentos[0].chegada.hora);
                    const chegadaB = this.converterHoraParaMinutos(b.segmentos[0].chegada.hora);
                    return chegadaA - chegadaB;
                    
                default:
                    return 0;
            }
        });
        
        return voos;
    },

    /**
     * Aplica os filtros selecionados
     */
    aplicarFiltros() {
        // Capturar valores dos filtros
        const precoMin = document.getElementById('preco-min');
        const precoMax = document.getElementById('preco-max');
        const checkboxesCompanhias = document.querySelectorAll('input[name="companhia"]:checked');
        const radioParadas = document.querySelector('input[name="paradas"]:checked');
        const radioDuracao = document.querySelector('input[name="duracao"]:checked');
        
        // Criar objeto de filtros ativos
        this.estado.filtrosAtivos = {
            precoMin: precoMin ? parseFloat(precoMin.value) : this.estado.filtros.precoMin,
            precoMax: precoMax ? parseFloat(precoMax.value) : this.estado.filtros.precoMax,
            companhias: Array.from(checkboxesCompanhias).map(cb => cb.value),
            paradas: radioParadas ? radioParadas.value : 'todas',
            duracao: radioDuracao ? radioDuracao.value : 'todas'
        };
        
        // Renderizar voos com os novos filtros
        this.renderizarVoos();
    },

    /**
     * Limpa todos os filtros
     */
    limparFiltros() {
        // Resetar filtros ativos
        this.estado.filtrosAtivos = null;
        
        // Resetar UI de filtros
        const precoMin = document.getElementById('preco-min');
        const precoMax = document.getElementById('preco-max');
        const precoMinValue = document.getElementById('preco-min-value');
        const precoMaxValue = document.getElementById('preco-max-value');
        
        if (precoMin && precoMax && precoMinValue && precoMaxValue) {
            precoMin.value = this.estado.filtros.precoMin;
            precoMax.value = this.estado.filtros.precoMax;
            precoMinValue.textContent = this.formatarPreco(this.estado.filtros.precoMin);
            precoMaxValue.textContent = this.formatarPreco(this.estado.filtros.precoMax);
        }
        
        // Marcar todas as companhias
        document.querySelectorAll('input[name="companhia"]').forEach(cb => {
            cb.checked = true;
        });
        
        // Resetar paradas
        const radioPararasTodas = document.querySelector('input[name="paradas"][value="todas"]');
        if (radioPararasTodas) {
            radioPararasTodas.checked = true;
        }
        
        // Resetar duração
        const radioDuracaoTodas = document.querySelector('input[name="duracao"][value="todas"]');
        if (radioDuracaoTodas) {
            radioDuracaoTodas.checked = true;
        }
        
        // Renderizar voos sem filtros
        this.renderizarVoos();
        
        // Esconder painel de filtros
        const painelFiltros = document.getElementById('painel-filtros');
        if (painelFiltros) {
            painelFiltros.classList.remove('show');
        }
    },

    /**
     * Seleciona um voo e prossegue para a reserva
     */
    selecionarVoo(voo) {
        // Salvar voo selecionado
        localStorage.setItem('benetrip_voo_selecionado', JSON.stringify(voo));
        
        // Exibir mensagem de confirmação
        this.mostrarConfirmacao(voo);
    },

    /**
     * Mostra confirmação de voo selecionado
     */
    mostrarConfirmacao(voo) {
        // Criar overlay de confirmação
        const overlay = document.createElement('div');
        overlay.className = 'confirmacao-overlay';
        
        // Formatar preço total
        const precoUnitario = typeof voo.preco.total === 'string' 
            ? parseFloat(voo.preco.total.replace(/[^0-9.,]/g, '').replace(',', '.')) 
            : voo.preco.total;
            
        const totalPassageiros = this.estado.resultados.adultos;
        const precoTotal = precoUnitario * totalPassageiros;
        
        const precoFormatado = this.formatarPreco(voo.preco.total, voo.preco.moeda);
        const precoTotalFormatado = this.formatarPreco(precoTotal, voo.preco.moeda);
        
        // HTML da confirmação
        overlay.innerHTML = `
            <div class="confirmacao-container">
                <div class="confirmacao-header">
                    <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" class="confirmacao-avatar" />
                    <h3>Voo Selecionado</h3>
                </div>
                
                <div class="confirmacao-content">
                    <p class="confirmacao-mensagem">Ótima escolha, Triper! 🐾 Você selecionou:</p>
                    
                    <div class="confirmacao-voo">
                        <div class="confirmacao-rota">
                            <span class="origem">${this.estado.resultados.origem}</span>
                            <span class="separador">✈️</span>
                            <span class="destino">${this.estado.resultados.destino}</span>
                        </div>
                        
                        <div class="confirmacao-companhia">
                            <img src="${this.getCompanhiaLogo(voo.companhias[0])}" alt="${voo.companhias[0]}" class="companhia-logo small">
                            <span>${this.getNomeCompanhia(voo.companhias[0])}</span>
                        </div>
                        
                        <div class="confirmacao-detalhes">
                            <div class="detalhe">
                                <span class="label">Preço por pessoa:</span>
                                <span class="valor">${precoFormatado}</span>
                            </div>
                            
                            <div class="detalhe">
                                <span class="label">Passageiros:</span>
                                <span class="valor">${totalPassageiros}</span>
                            </div>
                            
                            <div class="detalhe total">
                                <span class="label">Preço Total:</span>
                                <span class="valor">${precoTotalFormatado}</span>
                            </div>
                        </div>
                    </div>
                    
                    <p class="confirmacao-aviso">Vamos prosseguir para a página de reservas para concluir sua compra. Você será redirecionado para nosso parceiro de reservas.</p>
                </div>
                
                <div class="confirmacao-footer">
                    <button class="btn-cancelar">Voltar</button>
                    <button class="btn-confirmar">Continuar para Reserva</button>
                </div>
            </div>
        `;
        
        // Adicionar ao corpo do documento
        document.body.appendChild(overlay);
        
        // Animar entrada
        setTimeout(() => {
            overlay.classList.add('show');
        }, 50);
        
        // Configurar eventos dos botões
        const btnCancelar = overlay.querySelector('.btn-cancelar');
        const btnConfirmar = overlay.querySelector('.btn-confirmar');
        
        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => {
                overlay.classList.remove('show');
                setTimeout(() => {
                    document.body.removeChild(overlay);
                }, 300);
            });
        }
        
        if (btnConfirmar) {
            btnConfirmar.addEventListener('click', () => {
                this.prosseguirParaReserva(voo);
            });
        }
    },

    /**
     * Prossegue para a página de reservas
     */
    prosseguirParaReserva(voo) {
        // Mostrar processamento
        this.mostrarCarregando(true, "Redirecionando para o site de reservas...");
        
        // Gerar link de reserva
        if (window.BENETRIP_API && voo.urlReserva) {
            window.BENETRIP_API.gerarLinkReserva(voo.id, this.estado.resultados.searchId)
                .then(url => {
                    // Salvar URL da reserva
                    localStorage.setItem('benetrip_reserva_url', url);
                    
                    // Redirecionar após breve delay
                    setTimeout(() => {
                        // Na versão real, redirecionaria para parceiro
                        // Para o MVP, vai para página de confirmação
                        window.location.href = 'confirmation.html';
                    }, 1500);
                })
                .catch(erro => {
                    console.error("Erro ao gerar link de reserva:", erro);
                    this.mostrarErro("Ocorreu um erro ao gerar o link de reserva. Tente novamente mais tarde.");
                    this.mostrarCarregando(false);
                });
        } else {
            // Versão simplificada para o MVP
            setTimeout(() => {
                window.location.href = 'confirmation.html';
            }, 1500);
        }
    },

    /**
     * Exibe ou oculta o indicador de carregamento
     */
    mostrarCarregando(estado, mensagem) {
        // Remover overlay existente, se houver
        const overlayExistente = document.querySelector('.loading-overlay');
        if (overlayExistente) {
            document.body.removeChild(overlayExistente);
        }
        
        if (estado) {
            // Criar overlay de carregamento
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            
            overlay.innerHTML = `
                <div class="loading-container">
                    <img src="${this.config.imagePath}tripinha/avatar-pensando.png" alt="Tripinha carregando" class="loading-avatar" />
                    <div class="loading-text">${mensagem || 'Carregando...'}</div>
                    <div class="loading-spinner"></div>
                </div>
            `;
            
            // Adicionar ao corpo do documento
            document.body.appendChild(overlay);
            
            // Animar entrada
            setTimeout(() => {
                overlay.classList.add('show');
            }, 50);
        }
    },

    /**
     * Exibe uma mensagem de erro
     */
    mostrarErro(mensagem) {
        // Criar elemento de erro
        const erro = document.createElement('div');
        erro.className = 'erro-mensagem';
        erro.textContent = mensagem;
        
        // Adicionar ao corpo do documento
        document.body.appendChild(erro);
        
        // Animar entrada
        setTimeout(() => {
            erro.classList.add('show');
        }, 50);
        
        // Remover após alguns segundos
        setTimeout(() => {
            erro.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(erro);
            }, 300);
        }, 5000);
    },

    /**
     * Retorna o logo de uma companhia aérea
     */
    getCompanhiaLogo(iata) {
        // Verificar se temos o logo da companhia
        if (this.config.companhiasLogos[iata]) {
            return `${this.config.imagePath}companhias/${this.config.companhiasLogos[iata]}`;
        }
        
        // Logo padrão
        return `${this.config.imagePath}companhias/${this.config.companhiasLogos.default}`;
    },

    /**
     * Retorna o nome de uma companhia aérea a partir do código IATA
     */
    getNomeCompanhia(iata) {
        // Mapeamento de códigos IATA para nomes de companhias
        const nomes = {
            'AA': 'American Airlines',
            'LA': 'LATAM Airlines',
            'G3': 'Gol Linhas Aéreas',
            'AD': 'Azul Linhas Aéreas',
            'CM': 'Copa Airlines',
            'AV': 'Avianca',
            'UA': 'United Airlines',
            'DL': 'Delta Air Lines',
            'BA': 'British Airways',
            'IB': 'Iberia',
            'LH': 'Lufthansa',
            'AF': 'Air France',
            'KL': 'KLM'
        };
        
        return nomes[iata] || iata;
    },

    /**
     * Retorna o texto para exibição de bagagem
     */
    getTextoBagagem(bagagem) {
        if (!bagagem || bagagem === 'Verificar com a companhia') {
            return 'Verificar com a companhia';
        }
        
        if (bagagem === '0PC' || bagagem === false) {
            return 'Sem bagagem incluída';
        }
        
        if (bagagem === '1PC') {
            return '1 bagagem incluída';
        }
        
        return bagagem;
    },

    /**
     * Retorna o texto para exibição de paradas
     */
    getTextoPorParadas(numParadas) {
        if (numParadas === 0) {
            return 'Voo direto';
        } else if (numParadas === 1) {
            return '1 parada';
        } else {
            return `${numParadas} paradas`;
        }
    },

    /**
     * Formata uma data para exibição
     */
    formatarData(dataISO) {
        if (!dataISO) return '';
        
        const data = new Date(dataISO);
        
        // Verificar se é uma data válida
        if (isNaN(data.getTime())) return dataISO;
        
        return data.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    /**
     * Formata um preço para exibição
     */
    formatarPreco(valor, moeda) {
        if (!valor) return '';
        
        // Converter para número se for string
        let valorNumerico = valor;
        if (typeof valor === 'string') {
            valorNumerico = parseFloat(valor.replace(/[^0-9.,]/g, '').replace(',', '.'));
        }
        
        // Verificar se é um número válido
        if (isNaN(valorNumerico)) return valor;
        
        const simbolo = moeda === 'USD' ? '$' : (moeda === 'EUR' ? '€' : 'R$');
        
        return `${simbolo} ${valorNumerico.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    },

    /**
     * Converte duração em formato texto (ex: "2h 30m") para minutos
     */
    converterDuracaoParaMinutos(duracao) {
        if (!duracao) return 0;
        
        // Se já for número, retornar direto
        if (typeof duracao === 'number') return duracao;
        
        // Expressão regular para extrair horas e minutos
        const match = duracao.match(/(\d+)h(?:\s+(\d+)m)?/);
        
        if (match) {
            const horas = parseInt(match[1] || 0);
            const minutos = parseInt(match[2] || 0);
            
            return horas * 60 + minutos;
        }
        
        return 0;
    },

    /**
     * Converte hora em formato texto (ex: "14:30") para minutos desde meia-noite
     */
    converterHoraParaMinutos(hora) {
        if (!hora) return 0;
        
        // Expressão regular para extrair horas e minutos
        const match = hora.match(/(\d+):(\d+)/);
        
        if (match) {
            const horas = parseInt(match[1] || 0);
            const minutos = parseInt(match[2] || 0);
            
            return horas * 60 + minutos;
        }
        
        return 0;
    },

    /**
     * Configura eventos globais
     */
    configurarEventos() {
        // Eventos globais podem ser configurados aqui
    }
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    BENETRIP_VOOS.init();
});

// Exportar para namespace global
window.BENETRIP_VOOS = BENETRIP_VOOS;
