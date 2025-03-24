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
        recomendacoes: [],
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
                this.redirecionarParaInicio();
                return;
            }
            
            // Carregar recomendações
            const recomendacoes = localStorage.getItem('benetrip_recomendacoes');
            if (recomendacoes) {
                this.estado.recomendacoes = JSON.parse(recomendacoes);
                
                // Separar destino surpresa (último da lista)
                if (this.estado.recomendacoes.length > 0) {
                    this.estado.destinoSurpresa = this.estado.recomendacoes[this.estado.recomendacoes.length - 1];
                }
            } else {
                console.warn("Recomendações não encontradas");
                this.redirecionarParaInicio();
                return;
            }
            
            console.log("Dados carregados com sucesso");
        } catch (erro) {
            console.error("Erro ao carregar dados:", erro);
            this.redirecionarParaInicio();
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
                <div class="loading-text">Preparando destinos incríveis para você...</div>
                <div class="loading-spinner"></div>
            </div>
        `;
        
        // Simular carregamento para efeito visual
        setTimeout(() => {
            // Renderizar estrutura principal
            container.innerHTML = `
                <div class="destinos-header">
                    <div class="logo-container">
                        <img src="${this.config.imagePath}logo.png" alt="Benetrip" />
                    </div>
                    <h1>Destinos Recomendados</h1>
                </div>
                
                <div class="tripinha-message">
                    <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" />
                    <div class="message-bubble">
                        <p>Eu farejei por aí e encontrei alguns destinos incríveis que combinam com você! 🐾 Veja minhas sugestões e escolha a que mais te encantou!</p>
                    </div>
                </div>
                
                <div class="destinos-content">
                    <div id="destino-principal" class="destino-principal"></div>
                    
                    <div class="destinos-alternativos-header">
                        <h2>Mais Opções Incríveis</h2>
                        <div class="filtros-container">
                            <button class="filtro-btn active" data-filtro="todos">Todos</button>
                            <button class="filtro-btn" data-filtro="praia">Praias</button>
                            <button class="filtro-btn" data-filtro="aventura">Aventura</button>
                            <button class="filtro-btn" data-filtro="cultura">Cultura</button>
                        </div>
                    </div>
                    
                    <div id="destinos-alternativos" class="destinos-alternativos"></div>
                    
                    <div class="destino-surpresa-wrapper">
                        <button id="btn-surpresa" class="btn-surpresa">
                            <span class="emoji">🎲</span>
                            Me Surpreenda!
                        </button>
                        <div id="destino-surpresa" class="destino-surpresa"></div>
                    </div>
                </div>
                
                <div id="modal-confirmacao" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" />
                            <h3>Confirmar Escolha</h3>
                        </div>
                        <div class="modal-body">
                            <p>Você escolheu <span id="destino-selecionado-nome">Destino</span>! Ótima escolha, Triper! 🐾</p>
                            <p>Vamos buscar os melhores voos para sua viagem?</p>
                        </div>
                        <div class="modal-footer">
                            <button id="btn-voltar" class="btn-secondary">Voltar</button>
                            <button id="btn-confirmar" class="btn-primary">Buscar Voos</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Renderizar destinos
            this.renderizarDestinoPrincipal();
            this.renderizarDestinosAlternativos();
            
            // Configurar eventos específicos
            this.configurarEventosEspecificos();
            
        }, 1500); // Delay para simular carregamento
    },

    /**
     * Renderiza o destino principal (destaque)
     */
    renderizarDestinoPrincipal() {
        // Verificar se temos recomendações
        if (this.estado.recomendacoes.length === 0) {
            console.warn("Sem recomendações para exibir");
            return;
        }
        
        // Obter o primeiro destino (melhor recomendação)
        const destino = this.estado.recomendacoes[0];
        
        // Obter contêiner
        const container = document.getElementById('destino-principal');
        if (!container) return;
        
        // Formatar preços
        const formatarPreco = (valor, moeda) => {
            const simbolo = moeda === 'USD' ? '$' : (moeda === 'EUR' ? '€' : 'R$');
            return `${simbolo} ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        };
        
        // Renderizar HTML
        container.innerHTML = `
            <div class="destino-card principal" data-id="${destino.id}">
                <div class="destino-badge">Escolha Top da Tripinha!</div>
                
                <div class="destino-imagens">
                    <div class="imagem-principal" style="background-image: url('${destino.imagens.principal}')"></div>
                    <div class="imagem-secundaria" style="background-image: url('${destino.imagens.secundaria}')"></div>
                </div>
                
                <div class="destino-info">
                    <div class="destino-header">
                        <h3>${destino.cidade}, ${destino.pais}</h3>
                        <span class="destino-codigo">${destino.codigo_iata}</span>
                    </div>
                    
                    <div class="destino-detalhes">
                        <div class="detalhe">
                            <span class="emoji">✈️</span>
                            <span class="label">Passagem:</span>
                            <span class="valor">${formatarPreco(destino.preco_passagem, destino.moeda)}</span>
                        </div>
                        
                        <div class="detalhe">
                            <span class="emoji">🏨</span>
                            <span class="label">Hospedagem:</span>
                            <span class="valor">${formatarPreco(destino.preco_hospedagem, destino.moeda)}/noite</span>
                        </div>
                        
                        <div class="detalhe">
                            <span class="emoji">🗓️</span>
                            <span class="label">Melhor época:</span>
                            <span class="valor">Atual</span>
                        </div>
                        
                        <div class="detalhe full">
                            <span class="emoji">🌆</span>
                            <div class="detalhe-texto">
                                <span class="label">Por que visitar:</span>
                                <span class="valor">${destino.descricao}</span>
                            </div>
                        </div>
                        
                        <div class="detalhe full">
                            <span class="emoji">⭐</span>
                            <div class="detalhe-texto">
                                <span class="label">Curiosidade:</span>
                                <span class="valor">${destino.curiosidade}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="destino-comentario">
                        <span class="emoji">💬</span>
                        <p>${destino.comentario_tripinha}</p>
                    </div>
                    
                    <button class="btn-escolher-destino">Escolher Este Destino!</button>
                </div>
            </div>
        `;
        
        // Animar entrada
        setTimeout(() => {
            container.querySelector('.destino-card').classList.add('show');
        }, this.config.animationDelay);
    },

    /**
     * Renderiza os destinos alternativos
     */
    renderizarDestinosAlternativos() {
        // Verificar se temos recomendações suficientes
        if (this.estado.recomendacoes.length <= 1) {
            console.warn("Sem recomendações alternativas para exibir");
            return;
        }
        
        // Obter as recomendações alternativas (excluindo a principal e a surpresa)
        const alternativas = this.estado.recomendacoes.slice(1, -1);
        
        // Obter contêiner
        const container = document.getElementById('destinos-alternativos');
        if (!container) return;
        
        // Formatar preços
        const formatarPreco = (valor, moeda) => {
            const simbolo = moeda === 'USD' ? '$' : (moeda === 'EUR' ? '€' : 'R$');
            return `${simbolo} ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        };
        
        // Limpar contêiner
        container.innerHTML = '';
        
        // Renderizar cada destino alternativo
        alternativas.forEach((destino, index) => {
            const card = document.createElement('div');
            card.className = 'destino-card alternativo';
            card.dataset.id = destino.id;
            card.dataset.tag = destino.tag.toLowerCase().replace('#', '');
            
            card.innerHTML = `
                <div class="alternativo-wrapper">
                    <div class="alternativo-imagem" style="background-image: url('${destino.imagens.principal}')"></div>
                    
                    <div class="alternativo-info">
                        <div class="destino-header">
                            <h3>${destino.cidade}, ${destino.pais}</h3>
                            <span class="destino-codigo">${destino.codigo_iata}</span>
                        </div>
                        
                        <div class="destino-detalhes compacto">
                            <div class="detalhe">
                                <span class="emoji">✈️</span>
                                <span class="label">Passagem:</span>
                                <span class="valor">${formatarPreco(destino.preco_passagem, destino.moeda)}</span>
                            </div>
                            
                            <div class="detalhe">
                                <span class="emoji">🏨</span>
                                <span class="label">Hospedagem:</span>
                                <span class="valor">${formatarPreco(destino.preco_hospedagem, destino.moeda)}/noite</span>
                            </div>
                            
                            <div class="detalhe full">
                                <span class="emoji">${this.getEmojiForTag(destino.tag)}</span>
                                <div class="detalhe-texto">
                                    <span class="valor" style="font-size: 0.9em;">${destino.descricao}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Adicionar ao contêiner
            container.appendChild(card);
            
            // Animar entrada com delay
            setTimeout(() => {
                card.classList.add('show');
            }, this.config.animationDelay * (index + 1));
        });
        
        // Adicionar botão "Ver mais" se tiver muitos destinos
        if (alternativas.length > this.config.maxAlternativos) {
            const verMaisBtn = document.createElement('button');
            verMaisBtn.className = 'btn-ver-mais';
            verMaisBtn.textContent = 'Ver Mais Opções';
            
            // Adicionar ao contêiner
            container.appendChild(verMaisBtn);
            
            // Configurar evento
            verMaisBtn.addEventListener('click', () => {
                this.expandirAlternativos();
            });
        }
    },

    /**
     * Renderiza o destino surpresa
     */
    renderizarDestinoSurpresa() {
        // Verificar se temos destino surpresa
        if (!this.estado.destinoSurpresa) {
            console.warn("Destino surpresa não encontrado");
            return;
        }
        
        // Obter o destino surpresa
        const destino = this.estado.destinoSurpresa;
        
        // Obter contêiner
        const container = document.getElementById('destino-surpresa');
        if (!container) return;
        
        // Formatar preços
        const formatarPreco = (valor, moeda) => {
            const simbolo = moeda === 'USD' ? '$' : (moeda === 'EUR' ? '€' : 'R$');
            return `${simbolo} ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        };
        
        // Renderizar HTML
        container.innerHTML = `
            <div class="destino-card surpresa" data-id="${destino.id}">
                <div class="destino-badge surpresa">✨ Destino Surpresa! ✨</div>
                
                <div class="destino-imagens">
                    <div class="imagem-principal full" style="background-image: url('${destino.imagens.principal}')"></div>
                </div>
                
                <div class="destino-info">
                    <div class="destino-header">
                        <h3>${destino.cidade}, ${destino.pais}</h3>
                        <span class="destino-codigo">${destino.codigo_iata}</span>
                    </div>
                    
                    <div class="destino-detalhes">
                        <div class="detalhe">
                            <span class="emoji">✈️</span>
                            <span class="label">Passagem:</span>
                            <span class="valor">${formatarPreco(destino.preco_passagem, destino.moeda)}</span>
                        </div>
                        
                        <div class="detalhe">
                            <span class="emoji">🏨</span>
                            <span class="label">Hospedagem:</span>
                            <span class="valor">${formatarPreco(destino.preco_hospedagem, destino.moeda)}/noite</span>
                        </div>
                        
                        <div class="detalhe full">
                            <span class="emoji">🌆</span>
                            <div class="detalhe-texto">
                                <span class="label">Por que visitar:</span>
                                <span class="valor">${destino.descricao}</span>
                            </div>
                        </div>
                        
                        <div class="detalhe full">
                            <span class="emoji">🔮</span>
                            <div class="detalhe-texto">
                                <span class="label">Por que é uma descoberta especial:</span>
                                <span class="valor">Este destino combina perfeitamente com seu perfil de viajante, mas é menos conhecido! Uma joia rara que vai te surpreender!</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="destino-comentario">
                        <span class="emoji">💬</span>
                        <p>${destino.comentario_tripinha}</p>
                    </div>
                    
                    <div class="destino-curiosidade">
                        <span class="emoji">🎁</span>
                        <p><strong>Curiosidade exclusiva:</strong> ${destino.curiosidade}</p>
                    </div>
                    
                    <button class="btn-escolher-destino">Quero Este Destino Surpresa!</button>
                </div>
            </div>
        `;
    },

    /**
     * Configura eventos específicos da interface
     */
    configurarEventosEspecificos() {
        // Eventos para escolha de destino principal
        const btnPrincipal = document.querySelector('#destino-principal .btn-escolher-destino');
        if (btnPrincipal) {
            btnPrincipal.addEventListener('click', () => {
                const destino = this.estado.recomendacoes[0];
                this.selecionarDestino(destino);
            });
        }
        
        // Eventos para destinos alternativos
        document.querySelectorAll('#destinos-alternativos .destino-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const destino = this.estado.recomendacoes.find(d => d.id === id);
                if (destino) {
                    this.selecionarDestino(destino);
                }
            });
        });
        
        // Evento para botão surpresa
        const btnSurpresa = document.getElementById('btn-surpresa');
        if (btnSurpresa) {
            btnSurpresa.addEventListener('click', () => {
                this.mostrarDestinoSurpresa();
            });
        }
        
        // Eventos para botões de filtro
        document.querySelectorAll('.filtro-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filtro = btn.dataset.filtro;
                this.filtrarDestinos(filtro);
                
                // Atualizar classe ativa
                document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Eventos para modal de confirmação
        const btnVoltar = document.getElementById('btn-voltar');
        const btnConfirmar = document.getElementById('btn-confirmar');
        const modal = document.getElementById('modal-confirmacao');
        
        if (btnVoltar && btnConfirmar && modal) {
            btnVoltar.addEventListener('click', () => {
                modal.classList.remove('show');
            });
            
            btnConfirmar.addEventListener('click', () => {
                this.confirmarDestino();
            });
        }
    },

    /**
     * Mostra o destino surpresa
     */
    mostrarDestinoSurpresa() {
        // Verificar se já está mostrando
        if (this.estado.mostrandoSurpresa) return;
        
        // Renderizar destino surpresa
        this.renderizarDestinoSurpresa();
        
        // Animar transição
        const surpresaWrapper = document.querySelector('.destino-surpresa-wrapper');
        const btnSurpresa = document.getElementById('btn-surpresa');
        const destinoSurpresa = document.getElementById('destino-surpresa');
        
        if (surpresaWrapper && btnSurpresa && destinoSurpresa) {
            // Animar botão saindo
            btnSurpresa.classList.add('hide');
            
            // Mostrar destino surpresa
            setTimeout(() => {
                destinoSurpresa.classList.add('show');
                
                // Configurar evento para o botão de escolha
                const btnEscolher = destinoSurpresa.querySelector('.btn-escolher-destino');
                if (btnEscolher) {
                    btnEscolher.addEventListener('click', () => {
                        this.selecionarDestino(this.estado.destinoSurpresa);
                    });
                }
                
                // Atualizar estado
                this.estado.mostrandoSurpresa = true;
                
                // Rolar para o destino surpresa
                surpresaWrapper.scrollIntoView({ behavior: 'smooth' });
            }, 400);
        }
    },

    /**
     * Filtra os destinos alternativos por tag
     */
    filtrarDestinos(filtro) {
        // Atualizar estado
        this.estado.filtroAtivo = filtro;
        
        // Obter todos os cards
        const cards = document.querySelectorAll('#destinos-alternativos .destino-card');
        
        // Aplicar filtro
        cards.forEach(card => {
            if (filtro === 'todos') {
                card.classList.remove('hidden');
            } else {
                const tag = card.dataset.tag;
                if (tag && tag.includes(filtro)) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            }
        });
    },

    /**
     * Expande a visualização de destinos alternativos
     */
    expandirAlternativos() {
        // Remover limite de exibição
        document.querySelectorAll('#destinos-alternativos .destino-card').forEach(card => {
            card.classList.add('show');
        });
        
        // Remover botão "Ver mais"
        const btnVerMais = document.querySelector('.btn-ver-mais');
        if (btnVerMais) {
            btnVerMais.remove();
        }
    },

    /**
     * Seleciona um destino para confirmação
     */
    selecionarDestino(destino) {
        // Atualizar estado
        this.estado.destinoSelecionado = destino;
        
        // Atualizar nome do destino no modal
        const nomeDestino = document.getElementById('destino-selecionado-nome');
        if (nomeDestino) {
            nomeDestino.textContent = `${destino.cidade}`;
        }
        
        // Mostrar modal de confirmação
        const modal = document.getElementById('modal-confirmacao');
        if (modal) {
            modal.classList.add('show');
        }
    },

    /**
     * Confirma a escolha do destino e prossegue para busca de voos
     */
    confirmarDestino() {
        // Verificar se há destino selecionado
        if (!this.estado.destinoSelecionado) return;
        
        // Salvar destino escolhido
        localStorage.setItem('benetrip_destino_escolhido', JSON.stringify(this.estado.destinoSelecionado));
        
        // Exibir mensagem de processamento
        this.mostrarProcessamento("Preparando busca de voos...");
        
        // Redirecionar para página de voos
        setTimeout(() => {
            window.location.href = 'flights.html';
        }, 1500);
    },

    /**
     * Mostra mensagem de processamento
     */
    mostrarProcessamento(mensagem) {
        // Criar overlay de processamento
        const overlay = document.createElement('div');
        overlay.className = 'processing-overlay';
        
        overlay.innerHTML = `
            <div class="processing-container">
                <img src="${this.config.imagePath}tripinha/avatar-pensando.png" alt="Tripinha processando" class="processing-avatar" />
                <div class="processing-text">${mensagem}</div>
                <div class="processing-spinner"></div>
            </div>
        `;
        
        // Adicionar ao corpo do documento
        document.body.appendChild(overlay);
        
        // Animar entrada
        setTimeout(() => {
            overlay.classList.add('show');
        }, 50);
    },

    /**
     * Retorna o emoji correspondente a uma tag
     */
    getEmojiForTag(tag) {
        const tagLower = tag.toLowerCase().replace('#', '');
        
        const emojiMap = {
            'praia': '🏖️',
            'mar': '🌊',
            'natureza': '🌿',
            'aventura': '🏔️',
            'cultural': '🏛️',
            'histórico': '🏰',
            'urbano': '🏙️',
            'romântico': '❤️',
            'família': '👨‍👩‍👧‍👦',
            'luxo': '💎',
            'econômico': '💰',
            'relax': '🧘‍♀️',
            'gastronomia': '🍽️'
        };
        
        // Verificar cada chave parcial
        for (const key in emojiMap) {
            if (tagLower.includes(key)) {
                return emojiMap[key];
            }
        }
        
        // Emoji padrão
        return '🌍';
    },

    /**
     * Configura eventos globais
     */
    configurarEventos() {
        // Eventos globais podem ser configurados aqui
        
        // Evento para fechar modal clicando fora
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('modal-confirmacao');
            if (modal && e.target === modal) {
                modal.classList.remove('show');
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
