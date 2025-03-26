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
                this.redirecionarParaInicio();
                return;
            }
            
            // Carregar recomendações
            const recomendacoes = localStorage.getItem('benetrip_recomendacoes');
            if (recomendacoes) {
                this.estado.recomendacoes = JSON.parse(recomendacoes);
                
                // Verificar estrutura das recomendações
                if (!this.estado.recomendacoes.principal) {
                    console.warn("Estrutura de recomendações inválida");
                    this.buscarRecomendacoes();
                    return;
                }
            } else {
                console.warn("Recomendações não encontradas");
                this.buscarRecomendacoes();
                return;
            }
            
            console.log("Dados carregados com sucesso");
        } catch (erro) {
            console.error("Erro ao carregar dados:", erro);
            this.redirecionarParaInicio();
        }
    },

    /**
     * Busca recomendações de destinos usando o serviço de IA
     */
    buscarRecomendacoes() {
        // Verificar se o serviço de IA está disponível
        if (!window.BENETRIP_AI) {
            console.error("Serviço de IA não disponível");
            this.redirecionarParaInicio();
            return;
        }
        
        // Mostrar carregamento
        this.mostrarCarregando("Estou farejando os melhores destinos para você...");
        
        // Obter preferências do usuário
        const preferencias = this.estado.dadosUsuario.respostas;
        
        // Chamar serviço de IA para obter recomendações
        window.BENETRIP_AI.obterRecomendacoes(preferencias)
            .then(recomendacoes => {
                // Salvar recomendações
                this.estado.recomendacoes = recomendacoes;
                localStorage.setItem('benetrip_recomendacoes', JSON.stringify(recomendacoes));
                
                // Renderizar interface com as recomendações
                this.renderizarInterface();
                
                // Remover indicador de carregamento
                this.ocultarCarregando();
            })
            .catch(erro => {
                console.error("Erro ao buscar recomendações:", erro);
                this.mostrarErro("Houve um problema ao buscar recomendações. Por favor, tente novamente.");
                this.ocultarCarregando();
            });
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
            
            // Renderizar a estrutura principal baseada no protótipo
            container.innerHTML = `
                <div class="tripinha-recomendacao">
                    <div class="avatar-tripinha">
                        <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" />
                    </div>
                    <div class="balao-mensagem">
                        <p>Alright, Triper! 🐶 I've sniffed out some incredible destinations that fit your vibe! 🌎🔍 Take a look and tell me where we're heading!</p>
                        <p>I made sure these places match your budget and travel style! If you don't like them, I can fetch more. OR... if you trust my snout, hit 'Surprise Me!' 🎁 and I'll pick an awesome spot for you!</p>
                    </div>
                </div>
                
                <div id="lista-destinos" class="lista-destinos">
                    <!-- Os destinos serão inseridos aqui dinamicamente -->
                </div>
                
                <div class="acoes-destinos">
                    <button id="btn-selecionar-destino" class="btn-principal">Select City</button>
                    <div class="acoes-secundarias">
                        <button id="btn-mais-opcoes" class="btn-secundario">Show More Options</button>
                        <button id="btn-surpresa" class="btn-secundario">Surprise Me! 🎁</button>
                    </div>
                </div>
                
                <div id="confirmacao-destino" class="tripinha-recomendacao" style="display: none;">
                    <div class="avatar-tripinha">
                        <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" />
                    </div>
                    <div class="balao-mensagem">
                        <p>Paw-some choice! 🐾 I LOVE this place—you're gonna have the time of your life! Now, let's sniff out the best way to get there! ✈️</p>
                    </div>
                </div>
                
                <button id="btn-buscar-voos" class="btn-principal" style="display: none;">Find My Flights! ✈️</button>
                
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
        
        // Renderizar destinos alternativos
        alternativos.forEach(destino => {
            this.renderizarCardDestino(container, destino);
        });
    },

    /**
     * Renderiza card individual de destino
     */
    renderizarCardDestino(container, destino) {
        // Formatar valores monetários
        const precoPassagem = this.formatarMoeda(destino.preco_passagem, destino.moeda);
        const precoHospedagem = this.formatarMoeda(destino.preco_hospedagem, destino.moeda);
        const custoTotal = this.formatarMoeda(destino.custo_total, destino.moeda);
        
        // Criar elemento do card
        const card = document.createElement('div');
        card.className = 'destino-card';
        card.dataset.id = destino.id;
        
        // Renderizar o HTML do card conforme o protótipo
        card.innerHTML = `
            <div class="destino-header">
                <img src="${destino.imagens.principal}" alt="${destino.cidade}" class="destino-imagem">
                <div class="destino-titulo">
                    <h3>${destino.cidade}, ${destino.pais} <span class="codigo-pais">${destino.codigo_pais}</span></h3>
                    <p class="destino-descricao">${destino.descricao_curta}</p>
                </div>
            </div>
            
            <div class="destino-info">
                <div class="info-item">
                    <span class="icon">✈️</span>
                    <span class="label">Flight estimate:</span>
                    <span class="valor">${precoPassagem}</span>
                </div>
                
                <div class="info-item">
                    <span class="icon">🏨</span>
                    <span class="label">Hotels:</span>
                    <span class="valor">${precoHospedagem}/night</span>
                </div>
                
                <div class="info-item">
                    <span class="icon">🧩</span>
                    <span class="label">Experiences:</span>
                    <span class="valor">${destino.experiencias}</span>
                </div>
                
                <div class="info-item">
                    <span class="icon">💰</span>
                    <span class="label">Total estimated cost:</span>
                    <span class="valor">${custoTotal}</span>
                </div>
                
                <div class="info-item destaque">
                    <span class="icon">✨</span>
                    <span class="label">Why go?</span>
                    <span class="valor">${destino.porque_ir}</span>
                </div>
            </div>
        `;
        
        // Adicionar o card ao container
        container.appendChild(card);
        
        // Adicionar classe "show" após um breve delay para animação
        setTimeout(() => {
            card.classList.add('show');
        }, 100);
    },
    /**
     * Formata valor monetário
     */
    formatarMoeda(valor, moeda) {
        const simbolo = moeda === 'USD' ? '$' : (moeda === 'EUR' ? '€' : 'R$');
        return `${simbolo} ${valor.toLocaleString('pt-BR')}`;
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
                destinoSelecionado = [principal, ...alternativos, surpresa]
                    .find(d => d.id === idDestino);
                
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
                this.mostrarDestinoSurpresa(surpresa);
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
     * Abre modal de seleção de destino
     */
    abrirModalSelecaoDestino(principal, alternativos) {
        const modal = document.getElementById('modal-destino');
        const lista = document.getElementById('lista-selecao-destinos');
        
        if (!modal || !lista) return;
        
        // Limpar lista
        lista.innerHTML = '';
        
        // Adicionar destino principal
        const itemPrincipal = document.createElement('li');
        itemPrincipal.className = 'item-destino';
        itemPrincipal.dataset.id = principal.id;
        itemPrincipal.innerHTML = `
            <div class="item-info">
                <span class="item-cidade">${principal.cidade}, ${principal.pais}</span>
                <span class="item-preco">${this.formatarMoeda(principal.preco_passagem, principal.moeda)}</span>
            </div>
            <span class="item-badge">Top Pick</span>
        `;
        lista.appendChild(itemPrincipal);
        
        // Adicionar destinos alternativos
        alternativos.forEach(destino => {
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
        });
        
        // Configurar eventos para os itens
        document.querySelectorAll('.item-destino').forEach(item => {
            item.addEventListener('click', () => {
                const idDestino = item.dataset.id;
                const destino = [principal, ...alternativos]
                    .find(d => d.id === idDestino);
                
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
        if (acoesDestinos) acoesDestinos.style.display = 'none';
        
        // Mostrar confirmação
        const confirmacao = document.getElementById('confirmacao-destino');
        const btnBuscarVoos = document.getElementById('btn-buscar-voos');
        
        if (confirmacao) confirmacao.style.display = 'flex';
        if (btnBuscarVoos) btnBuscarVoos.style.display = 'block';
        
        // Rolar para a confirmação
        if (confirmacao) confirmacao.scrollIntoView({ behavior: 'smooth' });
    },

    /**
     * Busca mais opções de destinos
     */
    buscarMaisOpcoes() {
        // Mostrar mensagem de feedback
        this.mostrarToast("Buscando mais opções de destinos...");
        
        // Em um cenário real, faria uma nova chamada à API por mais destinos
        // Para o MVP, vamos simular um recarregamento da página
        setTimeout(() => {
            // Mostrar carregamento
            this.mostrarCarregando("Farejando mais destinos para você...");
            
            // Recarregar página após breve delay
            setTimeout(() => {
                // Em um cenário real, chamaríamos novamente o serviço de IA
                // window.BENETRIP_AI.obterMaisRecomendacoes(...)
                
                // Para o MVP, simplesmente recarregamos a página
                window.location.reload();
            }, 1500);
        }, 500);
    },

    /**
     * Mostra o destino surpresa
     */
    mostrarDestinoSurpresa(surpresa) {
        // Verificar se temos o destino surpresa
        if (!surpresa) {
            this.mostrarErro("Destino surpresa não disponível no momento");
            return;
        }
        
        // Ocultar destinos atuais
        document.querySelectorAll('.destino-card').forEach(card => {
            card.style.display = 'none';
        });
        
        // Criar container para destino surpresa
        const container = document.getElementById('lista-destinos');
        if (!container) return;
        
        // Formatar valores monetários
        const precoPassagem = this.formatarMoeda(surpresa.preco_passagem, surpresa.moeda);
        const precoHospedagem = this.formatarMoeda(surpresa.preco_hospedagem, surpresa.moeda);
        const custoTotal = this.formatarMoeda(surpresa.custo_total, surpresa.moeda);
        
        // Renderizar destino surpresa com destaque especial
        const card = document.createElement('div');
        card.className = 'destino-card destino-surpresa animate-entrada';
        card.dataset.id = surpresa.id;
        
        card.innerHTML = `
            <div class="badge-surpresa">✨ Destino Surpresa! ✨</div>
            
            <div class="destino-header">
                <img src="${surpresa.imagens.principal}" alt="${surpresa.cidade}" class="destino-imagem">
                <div class="destino-titulo">
                    <h3>${surpresa.cidade}, ${surpresa.pais} <span class="codigo-pais">${surpresa.codigo_pais}</span></h3>
                    <p class="destino-descricao">${surpresa.descricao_curta}</p>
                </div>
            </div>
            
            <div class="destino-info">
                <div class="info-item">
                    <span class="icon">✈️</span>
                    <span class="label">Flight estimate:</span>
                    <span class="valor">${precoPassagem}</span>
                </div>
                
                <div class="info-item">
                    <span class="icon">🏨</span>
                    <span class="label">Hotels:</span>
                    <span class="valor">${precoHospedagem}/night</span>
                </div>
                
                <div class="info-item">
                    <span class="icon">🧩</span>
                    <span class="label">Experiences:</span>
                    <span class="valor">${surpresa.experiencias}</span>
                </div>
                
                <div class="info-item">
                    <span class="icon">💰</span>
                    <span class="label">Total estimated cost:</span>
                    <span class="valor">${custoTotal}</span>
                </div>
                
                <div class="info-item destaque">
                    <span class="icon">✨</span>
                    <span class="label">Why go?</span>
                    <span class="valor">${surpresa.porque_ir}</span>
                </div>
                
                <div class="comentario-tripinha">
                    <img src="${this.config.imagePath}tripinha/avatar-normal.png" alt="Tripinha" class="avatar-mini">
                    <p>${surpresa.comentario_tripinha || 'Este é um destino incrível que escolhi especialmente para você! 🐾'}</p>
                </div>
            </div>
        `;
        
        // Limpar container e adicionar card
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
            const btnSelecionar = document.getElementById('btn-selecionar-surpresa');
            const btnVoltar = document.getElementById('btn-voltar');
            
            if (btnSelecionar) {
                btnSelecionar.addEventListener('click', () => {
                    this.confirmarSelecaoDestino(surpresa);
                });
            }
            
            if (btnVoltar) {
                btnVoltar.addEventListener('click', () => {
                    this.voltarSugestoesPrincipais();
                });
            }
        }
        
        // Rolar para o topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Atualizar estado
        this.estado.mostrandoSurpresa = true;
    },

    /**
     * Volta para as sugestões principais
     */
    voltarSugestoesPrincipais() {
        // Recarregar a interface
        this.renderizarInterface();
        
        // Atualizar estado
        this.estado.mostrandoSurpresa = false;
    },

    /**
     * Prossegue para a página de voos
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
     * Exibe um toast informativo
     */
    mostrarToast(mensagem, duracao = 2000) {
        // Criar elemento de toast
        const toast = document.createElement('div');
        toast.className = 'toast-mensagem';
        toast.textContent = mensagem;
        
        // Adicionar ao corpo do documento
        document.body.appendChild(toast);
        
        // Mostrar toast
        setTimeout(() => {
            toast.classList.add('show');
            
            // Ocultar após duração
            setTimeout(() => {
                toast.classList.remove('show');
                
                // Remover do DOM após animação
                setTimeout(() => {
                    if (document.body.contains(toast)) {
                        document.body.removeChild(toast);
                    }
                }, 300);
            }, duracao);
        }, 10);
    },

    /**
     * Mostra indicador de carregamento
     */
    mostrarCarregando(mensagem) {
        // Remover overlay existente se houver
        this.ocultarCarregando();
        
        // Criar overlay de carregamento
        const overlay = document.createElement('div');
        overlay.className = 'overlay-carregamento';
        overlay.id = 'benetrip-loading';
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
     * Oculta indicador de carregamento
     */
    ocultarCarregando() {
        const overlay = document.getElementById('benetrip-loading');
        if (overlay && document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
    },

    /**
     * Mostra mensagem de erro
     */
    mostrarErro(mensagem) {
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
        // Adicionar evento de back/forward do navegador
        window.addEventListener('popstate', () => {
            // Se estiver mostrando o destino surpresa, voltar para as sugestões
            if (this.estado.mostrandoSurpresa) {
                this.voltarSugestoesPrincipais();
                // Prevenir navegação padrão
                history.pushState(null, '', window.location.href);
                return;
            }
        });
        
        // Adicionar estado à history API para gerenciar navegação
        history.pushState({page: 'destinos'}, '', window.location.href);
    }
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    BENETRIP_DESTINOS.init();
});

// Exportar para namespace global
window.BENETRIP_DESTINOS = BENETRIP_DESTINOS;
