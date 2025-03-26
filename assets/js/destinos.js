/**
 * BENETRIP - Visualização de Destinos Recomendados
 * Controla a exibição e interação dos destinos recomendados pela IA
 */

const BENETRIP_DESTINOS = {
    /**
     * Configuração do módulo
     */
    config: {
        imagePath: 'assets/images/',
        maxDestacados: 1,
        maxAlternativos: 4,
        animationDelay: 300
    },

    /**
     * Estados do módulo
     */
    estado: {
        recomendacoes: null,
        destinoSelecionado: null,
        mostrandoSurpresa: false,
        destinoSurpresa: null,
        filtroAtivo: 'todos'
    },

    /**
     * Inicializa o módulo de destinos
     */
    init() {
        console.log("Inicializando módulo de destinos...");
        
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
            } else {
                console.warn("Dados do usuário não encontrados");
                // Criar dados mínimos para o formulário de busca
                this.estado.dadosUsuario = {
                    companhia: 0,
                    preferencia_viagem: 0,
                    moeda_escolhida: 'BRL'
                };
            }
            
            // Carregar recomendações
            const recomendacoes = localStorage.getItem('benetrip_recomendacoes');
            if (recomendacoes) {
                this.estado.recomendacoes = JSON.parse(recomendacoes);
            } else {
                console.warn("Recomendações não encontradas, buscando novas recomendações");
                this.buscarRecomendacoes();
                return;
            }
            
            // Verificar estrutura correta
            if (!this.validarEstrutura(this.estado.recomendacoes)) {
                console.warn("Estrutura de recomendações inválida");
                this.buscarRecomendacoes();
                return;
            }
            
            console.log("Dados carregados com sucesso");
        } catch (erro) {
            console.error("Erro ao carregar dados:", erro);
            this.buscarRecomendacoes();
        }
    },
    
    /**
     * Valida a estrutura das recomendações
     */
    validarEstrutura(recomendacoes) {
        // Verificar estrutura principal
        if (!recomendacoes) return false;
        
        // Verificar se tem as propriedades necessárias
        if (!recomendacoes.principal || !recomendacoes.alternativos || !recomendacoes.surpresa) {
            return false;
        }
        
        // Verificar se tem pelo menos um destino alternativo
        if (!Array.isArray(recomendacoes.alternativos) || recomendacoes.alternativos.length === 0) {
            return false;
        }
        
        return true;
    },
    
    /**
     * Busca novas recomendações da IA
     */
    async buscarRecomendacoes() {
        try {
            this.mostrarCarregando("Buscando recomendações de destinos...");
            
            // Verificar se o serviço de IA está disponível
            if (!window.BENETRIP_AI) {
                console.error("Serviço de IA não disponível");
                this.mostrarErro("Não foi possível carregar o serviço de recomendação. Tente recarregar a página.");
                return;
            }
            
            // Inicializar o serviço se necessário
            if (typeof window.BENETRIP_AI.init === 'function' && !window.BENETRIP_AI.initialized) {
                window.BENETRIP_AI.init();
            }
            
            // Buscar recomendações
            const recomendacoes = await window.BENETRIP_AI.obterRecomendacoes(this.estado.dadosUsuario);
            
            // Armazenar estado
            this.estado.recomendacoes = recomendacoes;
            
            // Renderizar interface
            this.renderizarInterface();
        } catch (erro) {
            console.error("Erro ao buscar recomendações:", erro);
            this.mostrarErro("Não foi possível obter recomendações de destinos: " + erro.message);
            
            // Voltar para a tela inicial em caso de erro crítico
            setTimeout(() => {
                this.redirecionarParaInicio();
            }, 5000);
        }
    },

    /**
     * Redireciona para a página inicial
     */
    redirecionarParaInicio() {
        alert("Precisamos de algumas informações antes de mostrar os destinos. Vamos recomeçar!");
        window.location.href = 'index.html';
    },

    /**
     * Renderiza a interface principal
     */
    renderizarInterface() {
        // Verificar se temos o contêiner principal
        const container = document.getElementById('destinos-container');
        if (!container) {
            console.error("Contêiner de destinos não encontrado");
            return;
        }
        
        // Mostrar carregamento
        container.innerHTML = `
            <div class="loading-container">
                <img src="${this.config.imagePath}tripinha/avatar-pensando.png" alt="Tripinha carregando" class="loading-avatar" />
                <div class="loading-text">Farejando destinos incríveis para você...</div>
                <div class="loading-spinner"></div>
            </div>
        `;
        
        // Simular carregamento para efeito visual
        setTimeout(() => {
            // Verificar se temos recomendações
            if (!this.estado.recomendacoes) {
                console.error("Recomendações não encontradas");
                this.mostrarErro("Não foi possível carregar recomendações. Tente novamente.");
                return;
            }
            
            // Extrair os destinos das recomendações
            const destinoPrincipal = this.estado.recomendacoes.principal;
            const destinosAlternativos = this.estado.recomendacoes.alternativos;
            const destinoSurpresa = this.estado.recomendacoes.surpresa;
            
            // Verificar se temos pelo menos um destino
            if (!destinoPrincipal) {
                console.error("Destino principal não encontrado");
                this.mostrarErro("Não foi possível carregar destinos. Tente novamente.");
                return;
            }
            
            // Renderizar a estrutura principal baseada no protótipo
            container.innerHTML = `
                <div class="tripinha-recomendacao">
                    <div class="avatar-tripinha">
                        <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" />
                    </div>
                    <div class="balao-mensagem">
                        <p>Alright, Triper! 🐶 Eu farejei alguns destinos incríveis que combinam com seu estilo! 🌎🔍 Dê uma olhada e me diga para onde vamos!</p>
                        <p>Garanti que esses lugares respeitam seu orçamento e estilo de viagem! Se não gostar deles, posso buscar mais. OU... se confiar no meu faro, clique em 'Me Surpreenda!' 🎁 e escolherei um lugar incrível para você!</p>
                    </div>
                </div>
                
                <div id="lista-destinos" class="lista-destinos">
                    <!-- Os destinos serão inseridos aqui dinamicamente -->
                </div>
                
                <div class="acoes-destinos">
                    <button id="btn-selecionar-destino" class="btn-principal">Escolher Cidade</button>
                    <div class="acoes-secundarias">
                        <button id="btn-mais-opcoes" class="btn-secundario">Mostrar Mais Opções</button>
                        <button id="btn-surpresa" class="btn-secundario">Me Surpreenda! 🎁</button>
                    </div>
                </div>
                
                <div id="confirmacao-destino" class="tripinha-recomendacao" style="display: none;">
                    <div class="avatar-tripinha">
                        <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" />
                    </div>
                    <div class="balao-mensagem">
                        <p>Paw-some escolha! 🐾 Eu ADORO esse lugar—você vai ter momentos incríveis! Agora, vamos encontrar o melhor jeito de chegar lá! ✈️</p>
                    </div>
                </div>
                
                <button id="btn-buscar-voos" class="btn-principal" style="display: none;">Encontrar Meus Voos! ✈️</button>
                
                <div id="modal-destino" class="modal-destino">
                    <div class="modal-conteudo">
                        <div class="modal-header">
                            <h3>Escolha um destino</h3>
                            <button class="btn-fechar">×</button>
                        </div>
                        <div class="modal-body">
                            <ul id="lista-selecao-destinos" class="lista-selecao-destinos">
                                <!-- A lista de seleção será populada dinamicamente -->
                            </ul>
                        </div>
                    </div>
                </div>
            `;
            
            // Renderizar cada destino
            this.renderizarDestinos(destinoPrincipal, destinosAlternativos);
            
            // Configurar eventos
            this.configurarEventosDestinos(destinoPrincipal, destinosAlternativos, destinoSurpresa);
            
        }, 1500); // Delay para simular carregamento
    },

    /**
     * Renderiza os destinos no novo formato
     */
    renderizarDestinos(principal, alternativos) {
        const container = document.getElementById('lista-destinos');
        if (!container) return;
        
        // Limpar qualquer conteúdo existente
        container.innerHTML = '';
        
        // Renderizar o destino principal
        this.renderizarCardDestino(container, principal);
        
        // Renderizar destinos alternativos (garantindo que é um array)
        if (Array.isArray(alternativos)) {
            alternativos.forEach(destino => {
                if (destino) {  // Verificar se o destino existe
                    this.renderizarCardDestino(container, destino);
                }
            });
        } else if (alternativos) {
            // Se alternativos não for um array mas existir, tratá-lo como um único destino
            this.renderizarCardDestino(container, alternativos);
        }
    },

    /**
     * Renderiza um card de destino
     */
    renderizarCardDestino(container, destino) {
        // Verificar se o destino existe
        if (!destino) {
            console.warn("Tentativa de renderizar destino indefinido");
            return;
        }
        
        // Verificar se temos propriedades essenciais
        if (!destino.cidade || !destino.pais) {
            console.warn("Destino inválido:", destino);
            return;
        }
        
        // Garantir que valores monetários existam
        const preco_passagem = destino.preco_passagem || 0;
        const preco_hospedagem = destino.preco_hospedagem || 0;
        const custo_total = destino.custo_total || 0;
        
        // Garantir que imagens existam
        const imagens = destino.imagens || {
            principal: "https://source.unsplash.com/1600x900/?travel,city",
            secundaria: "https://source.unsplash.com/1600x900/?landmark"
        };
        
        // Formatar valores monetários
        const precoPassagem = this.formatarMoeda(preco_passagem, destino.moeda);
        const precoHospedagem = this.formatarMoeda(preco_hospedagem, destino.moeda);
        const custoTotal = this.formatarMoeda(custo_total, destino.moeda);
        
        // Criar elemento do card
        const card = document.createElement('div');
        card.className = 'destino-card';
        card.dataset.id = destino.id || `dest-${Math.random().toString(36).substring(2, 9)}`;
        
        // Renderizar o HTML do card conforme o protótipo
        card.innerHTML = `
            <div class="destino-header">
                <img src="${imagens.principal}" alt="${destino.cidade}" class="destino-imagem">
                <div class="destino-titulo">
                    <h3>${destino.cidade}, ${destino.pais} <span class="codigo-pais">${destino.codigo_pais || ''}</span></h3>
                    <p class="destino-descricao">${destino.descricao_curta || 'Um destino incrível para explorar!'}</p>
                </div>
            </div>
            
            <div class="destino-info">
                <div class="info-item">
                    <span class="icon">✈️</span>
                    <span class="label">Valor da passagem:</span>
                    <span class="valor">${precoPassagem}</span>
                </div>
                
                <div class="info-item">
                    <span class="icon">🏨</span>
                    <span class="label">Hotéis:</span>
                    <span class="valor">${precoHospedagem}/noite</span>
                </div>
                
                <div class="info-item">
                    <span class="icon">🧩</span>
                    <span class="label">Experiências:</span>
                    <span class="valor">${destino.experiencias || 'Explorar a cidade e conhecer atrações locais'}</span>
                </div>
                
                <div class="info-item">
                    <span class="icon">💰</span>
                    <span class="label">Custo total estimado:</span>
                    <span class="valor">${custoTotal}</span>
                </div>
                
                <div class="info-item destaque">
                    <span class="icon">✨</span>
                    <span class="label">Por que ir?</span>
                    <span class="valor">${destino.porque_ir || 'Uma experiência única!'}</span>
                </div>
            </div>
        `;
        
        // Adicionar o card ao container
        container.appendChild(card);
    },

    /**
     * Formata um valor monetário
     */
    formatarMoeda(valor, moeda) {
        // Garantir que valor seja um número
        const valorNumerico = Number(valor) || 0;
        
        const simbolo = moeda === 'USD' ? '$' : (moeda === 'EUR' ? '€' : 'R$');
        return `${simbolo} ${valorNumerico.toLocaleString('pt-BR')}`;
    },
    
    /**
     * Configura eventos para os destinos
     */
    configurarEventosDestinos(principal, alternativos, surpresa) {
        // Referências aos elementos
        const btnSelecionar = document.getElementById('btn-selecionar-destino');
        const btnMaisOpcoes = document.getElementById('btn-mais-opcoes');
        const btnSurpresa = document.getElementById('btn-surpresa');
        const btnBuscarVoos = document.getElementById('btn-buscar-voos');
        const modalDestino = document.getElementById('modal-destino');
        const btnFecharModal = modalDestino?.querySelector('.btn-fechar');
        const listaSelecao = document.getElementById('lista-selecao-destinos');
        
        // Variável para armazenar o destino selecionado
        let destinoSelecionado = null;
        
        // Evento para clicar em um destino
        document.querySelectorAll('.destino-card').forEach(card => {
            card.addEventListener('click', () => {
                // Remover seleção anterior
                document.querySelectorAll('.destino-card.selecionado').forEach(c => 
                    c.classList.remove('selecionado'));
                
                // Adicionar seleção ao card atual
                card.classList.add('selecionado');
                
                // Atualizar destino selecionado
                const idDestino = card.dataset.id;
                let todosDestinos = [principal];
                
                if (Array.isArray(alternativos)) {
                    todosDestinos = [...todosDestinos, ...alternativos];
                } else if (alternativos) {
                    todosDestinos.push(alternativos);
                }
                
                if (surpresa) {
                    todosDestinos.push(surpresa);
                }
                
                destinoSelecionado = todosDestinos.find(d => d && d.id === idDestino);
                
                // Habilitar botão de seleção
                if (btnSelecionar) btnSelecionar.disabled = false;
            });
        });
        
        // Evento para botão de selecionar destino
        if (btnSelecionar) {
            btnSelecionar.addEventListener('click', () => {
                if (destinoSelecionado) {
                    this.confirmarSelecaoDestino(destinoSelecionado);
                } else {
                    // Se não houver destino selecionado, mostrar modal
                    this.abrirModalSelecaoDestino(principal, alternativos);
                }
            });
        }
        
        // Evento para botão de mostrar mais opções
        if (btnMaisOpcoes) {
            btnMaisOpcoes.addEventListener('click', () => {
                this.buscarMaisOpcoes();
            });
        }
        
        // Evento para botão de destino surpresa
        if (btnSurpresa) {
            btnSurpresa.addEventListener('click', () => {
                if (surpresa) {
                    this.mostrarDestinoSurpresa(surpresa);
                } else {
                    this.mostrarErro("Destino surpresa não disponível no momento.");
                }
            });
        }
        
        // Evento para botão de buscar voos
        if (btnBuscarVoos) {
            btnBuscarVoos.addEventListener('click', () => {
                this.prosseguirParaVoos();
            });
        }
        
        // Eventos para o modal
        if (btnFecharModal) {
            btnFecharModal.addEventListener('click', () => {
                modalDestino.style.display = 'none';
            });
        }
        
        // Fechar modal ao clicar fora
        window.addEventListener('click', (e) => {
            if (e.target === modalDestino) {
                modalDestino.style.display = 'none';
            }
        });
    },

    /**
     * Abre o modal de seleção de destino
     */
    abrirModalSelecaoDestino(principal, alternativos) {
        const modal = document.getElementById('modal-destino');
        const lista = document.getElementById('lista-selecao-destinos');
        
        if (!modal || !lista) return;
        
        // Limpar lista
        lista.innerHTML = '';
        
        // Adicionar destino principal
        if (principal) {
            const itemPrincipal = document.createElement('li');
            itemPrincipal.className = 'item-destino';
            itemPrincipal.dataset.id = principal.id;
            itemPrincipal.innerHTML = `
                <div class="item-info">
                    <span class="item-cidade">${principal.cidade}, ${principal.pais}</span>
                    <span class="item-preco">${this.formatarMoeda(principal.preco_passagem, principal.moeda)}</span>
                </div>
                <span class="item-badge">Escolha Principal</span>
            `;
            lista.appendChild(itemPrincipal);
        }
        
        // Adicionar destinos alternativos
        if (Array.isArray(alternativos)) {
            alternativos.forEach(destino => {
                if (destino) {  // Verificar se o destino existe
                    const item = document.createElement('li');
                    item.className = 'item-destino';
                    item.dataset.id = destino.id;
                    item.innerHTML = `
                        <div class="item-info">
                            <span class="item-cidade">${destino.cidade}, ${destino.pais}</span>
                            <span class="item-preco">${this.formatarMoeda(destino.preco_passagem, destino.moeda)}</span>
                        </div>
                    `;
                    lista.appendChild(item);
                }
            });
        }
        
        // Configurar eventos para os itens
        document.querySelectorAll('.item-destino').forEach(item => {
            item.addEventListener('click', () => {
                const idDestino = item.dataset.id;
                
                let todosDestinos = [principal];
                if (Array.isArray(alternativos)) {
                    todosDestinos = [...todosDestinos, ...alternativos];
                } else if (alternativos) {
                    todosDestinos.push(alternativos);
                }
                
                const destino = todosDestinos.find(d => d && d.id === idDestino);
                
                if (destino) {
                    modal.style.display = 'none';
                    this.confirmarSelecaoDestino(destino);
                }
            });
        });
        
        // Mostrar modal
        modal.style.display = 'flex';
    },

    /**
     * Confirma a seleção de um destino
     */
    confirmarSelecaoDestino(destino) {
        // Salvar destino selecionado
        localStorage.setItem('benetrip_destino_escolhido', JSON.stringify(destino));
        this.estado.destinoSelecionado = destino;
        
        // Atualizar interface
        document.querySelectorAll('.destino-card').forEach(card => {
            if (card.dataset.id !== destino.id) {
                card.classList.add('nao-selecionado');
            } else {
                card.classList.add('destino-escolhido');
            }
        });
        
        // Ocultar botões de ação
        const acoesDestinos = document.querySelector('.acoes-destinos');
        if (acoesDestinos) {
            acoesDestinos.style.display = 'none';
        }
        
        // Mostrar confirmação
        const confirmacao = document.getElementById('confirmacao-destino');
        const btnBuscarVoos = document.getElementById('btn-buscar-voos');
        
        if (confirmacao) confirmacao.style.display = 'flex';
        if (btnBuscarVoos) btnBuscarVoos.style.display = 'block';
        
        // Rolar para a confirmação
        if (confirmacao) {
            confirmacao.scrollIntoView({ behavior: 'smooth' });
        }
    },

    /**
     * Mostra o destino surpresa
     */
    mostrarDestinoSurpresa(surpresa) {
        // Garantir que o destino surpresa existe
        if (!surpresa) {
            this.mostrarErro("Destino surpresa não disponível");
            return;
        }
        
        // Verificar propriedades essenciais
        if (!surpresa.cidade || !surpresa.pais) {
            this.mostrarErro("Informações incompletas para o destino surpresa");
            return;
        }
        
        // Garantir que imagens existam
        const imagens = surpresa.imagens || {
            principal: "https://source.unsplash.com/1600x900/?surprise,travel",
            secundaria: "https://source.unsplash.com/1600x900/?landmark"
        };
        
        // Ocultar destinos atuais
        document.querySelectorAll('.destino-card').forEach(card => {
            card.style.display = 'none';
        });
        
        // Criar container para destino surpresa
        const container = document.getElementById('lista-destinos');
        if (!container) return;
        
        // Formatar valores monetários
        const precoPassagem = this.formatarMoeda(surpresa.preco_passagem || 0, surpresa.moeda);
        const precoHospedagem = this.formatarMoeda(surpresa.preco_hospedagem || 0, surpresa.moeda);
        const custoTotal = this.formatarMoeda(surpresa.custo_total || 0, surpresa.moeda);
        
        // Renderizar destino surpresa com destaque especial
        const card = document.createElement('div');
        card.className = 'destino-card destino-surpresa animate-entrada';
        card.dataset.id = surpresa.id || `surpresa-${Math.random().toString(36).substring(2, 9)}`;
        
        card.innerHTML = `
            <div class="badge-surpresa">✨ Destino Surpresa! ✨</div>
            
            <div class="destino-header">
                <img src="${imagens.principal}" alt="${surpresa.cidade}" class="destino-imagem">
                <div class="destino-titulo">
                    <h3>${surpresa.cidade}, ${surpresa.pais} <span class="codigo-pais">${surpresa.codigo_pais || ''}</span></h3>
                    <p class="destino-descricao">${surpresa.descricao_curta || 'Um destino surpresa esperando por você!'}</p>
                </div>
            </div>
            
            <div class="destino-info">
                <div class="info-item">
                    <span class="icon">✈️</span>
                    <span class="label">Valor da passagem:</span>
                    <span class="valor">${precoPassagem}</span>
                </div>
                
                <div class="info-item">
                    <span class="icon">🏨</span>
                    <span class="label">Hotéis:</span>
                    <span class="valor">${precoHospedagem}/noite</span>
                </div>
                
                <div class="info-item">
                    <span class="icon">🧩</span>
                    <span class="label">Experiências:</span>
                    <span class="valor">${surpresa.experiencias || 'Explorar a cidade e conhecer atrações locais'}</span>
                </div>
                
                <div class="info-item">
                    <span class="icon">💰</span>
                    <span class="label">Custo total estimado:</span>
                    <span class="valor">${custoTotal}</span>
                </div>
                
                <div class="info-item destaque">
                    <span class="icon">✨</span>
                    <span class="label">Por que ir?</span>
                    <span class="valor">${surpresa.porque_ir || 'Uma experiência única e surpreendente!'}</span>
                </div>
                
                <div class="comentario-tripinha">
                    <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" class="avatar-mini">
                    <p>${surpresa.comentario_tripinha || "Uau! Este é meu destino surpresa favorito! Confie no meu faro! 🐾🎁"}</p>
                </div>
            </div>
        `;
        
        // Adicionar ao container
        container.innerHTML = '';
        container.appendChild(card);
        
        // Atualizar botões
        const acoesDestinos = document.querySelector('.acoes-destinos');
        if (acoesDestinos) {
            acoesDestinos.innerHTML = `
                <button id="btn-selecionar-surpresa" class="btn-principal">Escolher Este Destino!</button>
                <button id="btn-voltar" class="btn-secundario">Voltar às Sugestões</button>
            `;
            
            // Configurar novos eventos
            document.getElementById('btn-selecionar-surpresa')?.addEventListener('click', () => {
                this.confirmarSelecaoDestino(surpresa);
            });
            
            document.getElementById('btn-voltar')?.addEventListener('click', () => {
                this.voltarSugestoesPrincipais();
            });
        }
        
        // Rolar para o topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Busca mais opções de destinos
     */
    buscarMaisOpcoes() {
        this.mostrarCarregando("Buscando mais destinos que combinam com você...");
        
        setTimeout(() => {
            // Buscar novas recomendações da API
            this.buscarRecomendacoes();
        }, 1000);
    },

    /**
     * Volta para as sugestões principais
     */
    voltarSugestoesPrincipais() {
        // Recarregar a interface com as sugestões originais
        this.renderizarInterface();
    },

    /**
     * Prossegue para a etapa de busca de voos
     */
    prosseguirParaVoos() {
        // Verificar se há destino selecionado
        if (!this.estado.destinoSelecionado) {
            this.mostrarErro("Por favor, selecione um destino primeiro");
            return;
        }
        
        // Mostrar carregamento
        this.mostrarCarregando("Preparando busca de voos...");
        
        // Redirecionar para a página de voos
        setTimeout(() => {
            window.location.href = 'flights.html';
        }, 1000);
    },

    /**
     * Mostra um indicador de carregamento
     */
    mostrarCarregando(mensagem) {
        // Verificar se já existe um overlay
        const overlayExistente = document.querySelector('.overlay-carregamento');
        if (overlayExistente) {
            const mensagemElement = overlayExistente.querySelector('p');
            if (mensagemElement) {
                mensagemElement.textContent = mensagem || 'Carregando...';
            }
            return;
        }
        
        // Criar overlay de carregamento
        const overlay = document.createElement('div');
        overlay.className = 'overlay-carregamento';
        overlay.innerHTML = `
            <div class="container-carregamento">
                <img src="${this.config.imagePath}tripinha/avatar-pensando.png" alt="Tripinha" class="avatar-carregamento">
                <p>${mensagem || 'Carregando...'}</p>
                <div class="spinner"></div>
            </div>
        `;
        
        // Adicionar ao documento
        document.body.appendChild(overlay);
    },
    
    /**
     * Remove o indicador de carregamento
     */
    ocultarCarregando() {
        const overlay = document.querySelector('.overlay-carregamento');
        if (overlay) {
            document.body.removeChild(overlay);
        }
    },

    /**
     * Mostra uma mensagem de erro
     */
    mostrarErro(mensagem) {
        // Ocultar carregamento se estiver visível
        this.ocultarCarregando();
        
        // Criar elemento para mensagem de erro
        const erro = document.createElement('div');
        erro.className = 'mensagem-erro';
        erro.innerHTML = `
            <div class="erro-conteudo">
                <span class="erro-icone">⚠️</span>
                <p>${mensagem}</p>
                <button class="btn-fechar-erro">OK</button>
            </div>
        `;
        
        // Adicionar ao documento
        document.body.appendChild(erro);
        
        // Configurar evento para fechar
        erro.querySelector('.btn-fechar-erro').addEventListener('click', () => {
            document.body.removeChild(erro);
        });
        
        // Fechar automaticamente após alguns segundos
        setTimeout(() => {
            if (document.body.contains(erro)) {
                document.body.removeChild(erro);
            }
        }, 5000);
    },

    /**
     * Configura eventos globais
     */
    configurarEventos() {
        // Configurar eventos para mostrar/ocultar o carregamento
        window.addEventListener('benetrip_progress', (event) => {
            const { progress, message } = event.detail;
            
            if (progress < 100) {
                this.mostrarCarregando(message);
            } else {
                setTimeout(() => {
                    this.ocultarCarregando();
                }, 500);
            }
        });
    }
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    BENETRIP_DESTINOS.init();
});

// Exportar para namespace global
window.BENETRIP_DESTINOS = BENETRIP_DESTINOS;
