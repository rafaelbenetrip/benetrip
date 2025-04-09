/**
 * BENETRIP - Módulo de Interface de Voos
 * 
 * Este arquivo gerencia a interface do usuário para a página de voos,
 * incluindo a navegação entre cards, modais e elementos interativos.
 * Funciona em conjunto com o módulo flights.js que processa os dados.
 * Versão adaptada para layout vertical conforme protótipo.
 */

// ======= UTILITÁRIOS =======

// Funções auxiliares para URLs de logotipos
function getAirlineLogoUrl(iataCode, width = 40, height = 40, retina = false) {
    if (!iataCode || typeof iataCode !== 'string') {
        return `https://pics.avs.io/${width}/${height}/default.png`;
    }
    
    // Converte para maiúsculas e remove espaços
    const code = iataCode.trim().toUpperCase();
    
    // Adiciona sufixo @2x para versão retina, se solicitado
    const retinaSuffix = retina ? '@2x' : '';
    
    return `https://pics.avs.io/${width}/${height}/${code}${retinaSuffix}.png`;
}

function getAgencyLogoUrl(gateId, width = 110, height = 40, retina = false) {
    if (!gateId) {
        return null;
    }
    
    // Adiciona sufixo @2x para versão retina, se solicitado
    const retinaSuffix = retina ? '@2x' : '';
    
    return `https://pics.avs.io/as_gates/${width}/${height}/${gateId}${retinaSuffix}.png`;
}

// Função para formatar duração de voo
function formatarDuracao(minutos) {
    if (typeof minutos !== 'number' || minutos < 0) return 'N/A';
    
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    
    return `${horas}h${mins > 0 ? ` ${mins}m` : ''}`;
}

// Função para formatar data
function formatarData(data) {
    if (!data || !(data instanceof Date) || isNaN(data.getTime())) {
        return 'N/A';
    }
    
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    return `${diasSemana[data.getDay()]}, ${data.getDate()} ${meses[data.getMonth()]}`;
}

/**
 * Aplicar estilos CSS para layout vertical
 */
function aplicarEstilosVerticais() {
    // Criar elemento de estilo
    const style = document.createElement('style');
    style.textContent = `
    /* Alteramos o container de swipe para lista vertical */
    .voos-swipe-container {
      display: flex;
      flex-direction: column; /* Alterado de row para column */
      gap: 16px;
      overflow-y: auto; /* Alterado de overflow-x para overflow-y */
      overflow-x: hidden; /* Esconder overflow horizontal */
      scroll-snap-type: y mandatory; /* Alterado de x para y */
      padding: 8px 16px 80px; /* Aumentado o padding inferior para dar espaço */
      margin-bottom: 16px;
      max-height: calc(100vh - 240px); /* Altura máxima para garantir scroll */
      scrollbar-width: thin;
      
      /* Remover gradiente horizontal */
      background: none;
    }

    /* Ajustes para os cards */
    .voo-card {
      flex: 0 0 auto; /* Remover constraint de largura */
      width: 100%; /* Fazer o card ocupar a largura completa */
      max-width: none; /* Remover limitação de largura máxima */
      scroll-snap-align: start; /* Alterado de center para start */
      min-width: 0; /* Remover a largura mínima */
      margin: 0 0 12px 0; /* Ajustar margens para empilhamento vertical */
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    /* Botão de customização da busca */
    .customize-search-button {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 10px 16px;
      margin: 12px 16px;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--benetrip-blue);
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .customize-search-button:hover {
      background-color: #f8f9fa;
    }

    .customize-search-button svg {
      margin-right: 6px;
    }

    /* Remover/ajustar os controles de navegação */
    .pagination-indicator {
      display: none; /* Não precisamos dos pontos de paginação em layout vertical */
    }

    .nav-controls {
      display: none; /* Esconder botões de navegação anterior/próximo */
    }

    /* Novo layout para o botão de escolha */
    .choose-flight-button {
      width: 100%;
      background-color: var(--benetrip-orange);
      color: white;
      font-weight: 600;
      border: none;
      border-radius: 4px;
      padding: 10px 16px;
      margin-top: 8px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .choose-flight-button:hover {
      background-color: #d06a1c;
    }

    /* Corrigir comportamento do modal */
    .modal-backdrop {
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }

    .modal-backdrop.modal-active {
      opacity: 1;
      visibility: visible;
      display: flex !important;
      pointer-events: auto !important;
    }

    /* Remover swipe hint para layout vertical */
    .swipe-hint {
      display: none;
    }
    `;
    
    // Adicionar ao head do documento
    document.head.appendChild(style);
    console.log('Estilos para layout vertical aplicados');
}

/**
 * Adicionar botão de customização
 */
function adicionarBotaoCustomizacao() {
    // Se já existe, não adicionar novamente
    if (document.querySelector('.customize-search-button')) return;
    
    const header = document.querySelector('.app-header');
    if (!header) return;
    
    const button = document.createElement('button');
    button.className = 'customize-search-button';
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        Personalizar Minha Busca
    `;
    
    // Inserir logo após o header
    header.parentNode.insertBefore(button, header.nextSibling);
    
    // Adicionar evento de clique
    button.addEventListener('click', function() {
        localStorage.setItem('benetrip_customizar_busca', 'true');
        window.location.href = 'index.html';
    });
    
    console.log('Botão de customização adicionado');
}

/**
 * Inicialização para navegação de voos - função global para ser chamada por outros módulos
 */
window.inicializarNavegacaoVoos = function() {
    console.log('Inicializando navegação de voos (função global)...');
    configurarNavegacaoCards();
};

/**
 * Função para configurar navegação entre cards de voo
 */
function configurarNavegacaoCards() {
    console.log('Configurando navegação de cards (layout vertical)...');
    const container = document.getElementById('voos-swipe-container');
    if (!container) {
        console.error('Container de voos não encontrado');
        return;
    }
    
    const cards = container.querySelectorAll('.voo-card');
    if (!cards.length) {
        console.error('Nenhum card de voo encontrado para configurar navegação');
        return;
    }
    
    // Limpar eventos existentes e configurar novos
    cards.forEach((card, index) => {
        // Remover handlers existentes para evitar duplicação
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
        
        // Adicionar evento de clique no card
        newCard.addEventListener('click', function(e) {
            // Ignorar se o clique foi em um botão
            if (e.target.closest('button')) return;
            
            // Atualizar card ativo
            document.querySelectorAll('.voo-card').forEach(c => 
                c.classList.remove('voo-card-ativo')
            );
            this.classList.add('voo-card-ativo');
            
            // Atualizar o voo ativo no módulo principal
            if (window.BENETRIP_VOOS && window.BENETRIP_VOOS.finalResults?.proposals) {
                const vooIndex = parseInt(this.dataset.vooIndex);
                if (!isNaN(vooIndex)) {
                    window.BENETRIP_VOOS.indexVooAtivo = vooIndex;
                    window.BENETRIP_VOOS.vooAtivo = window.BENETRIP_VOOS.finalResults.proposals[vooIndex];
                    window.BENETRIP_VOOS.atualizarBotaoSelecao();
                }
            }
        });
        
        // Configurar botão de detalhes dentro do card
        const btnDetalhes = newCard.querySelector('.btn-detalhes-voo');
        if (btnDetalhes) {
            btnDetalhes.addEventListener('click', function(e) {
                e.stopPropagation(); // Evitar que o clique afete o card
                const vooId = this.dataset.vooId;
                if (vooId) {
                    mostrarDetalhesVoo(vooId);
                }
            });
        }
    });
    
    // Verificar se temos botões de escolha direta
    const chooseButtons = document.querySelectorAll('.choose-flight-button');
    if (chooseButtons.length) {
        chooseButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation(); // Evitar que o clique afete o card
                const vooId = this.dataset.vooId;
                if (vooId && window.BENETRIP_VOOS) {
                    window.BENETRIP_VOOS.selecionarVoo(vooId);
                    mostrarConfirmacaoSelecao();
                }
            });
        });
    }
    
    // Configurar navegação por teclado
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault(); // Evitar scroll padrão
            
            const activeCard = document.querySelector('.voo-card-ativo');
            if (!activeCard) return;
            
            const currentIndex = Array.from(cards).indexOf(activeCard);
            let newIndex = currentIndex;
            
            if (e.key === 'ArrowUp' && currentIndex > 0) {
                newIndex = currentIndex - 1;
            } else if (e.key === 'ArrowDown' && currentIndex < cards.length - 1) {
                newIndex = currentIndex + 1;
            }
            
            if (newIndex !== currentIndex) {
                // Simular clique no novo card
                cards[newIndex].click();
                
                // Garantir que o card seja visível
                cards[newIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    });
}

// ======= GESTÃO DE MODAIS =======

/**
 * Modificar a função do BENETRIP_VOOS para adicionar botão de escolha nos cards
 */
function modificarCriarCardVoo() {
    // Verificar se o objeto BENETRIP_VOOS existe
    if (!window.BENETRIP_VOOS || !window.BENETRIP_VOOS.criarCardVoo) {
        console.log('BENETRIP_VOOS ainda não disponível, tentando novamente em 100ms');
        setTimeout(modificarCriarCardVoo, 100);
        return;
    }
    
    // Guardar referência à função original
    const funcaoOriginal = window.BENETRIP_VOOS.criarCardVoo;
    
    // Sobrescrever com nova função
    window.BENETRIP_VOOS.criarCardVoo = function(voo, index) {
        // Chamar função original para criar o card base
        const cardVoo = funcaoOriginal.call(this, voo, index);
        
        if (cardVoo) {
            // Substituir o footer do card com o botão de escolha
            const footer = cardVoo.querySelector('.voo-card-footer');
            if (footer) {
                const vooId = voo.sign || `voo-idx-${index}`;
                
                // Criar o botão de escolha
                const chooseButton = document.createElement('button');
                chooseButton.className = 'choose-flight-button';
                chooseButton.textContent = 'Escolher Este Voo';
                chooseButton.dataset.vooId = vooId;
                
                // Substituir o conteúdo do footer
                footer.innerHTML = '';
                footer.appendChild(chooseButton);
            }
        }
        
        return cardVoo;
    };
    
    console.log('Função criarCardVoo modificada para incluir botão de escolha');
}

// Função para carregar templates de modais dinamicamente
function carregarTemplatesModais() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;
    
    // Carrega os templates de modais
    modalContainer.innerHTML = `
        <!-- Modal de detalhes do voo -->
        <div id="modal-detalhes-voo" class="modal-backdrop" style="display:none;">
            <div class="modal-content modal-detalhes-voo">
                <div class="modal-header">
                    <h3 class="modal-title">Detalhes do Voo</h3>
                    <button id="btn-fechar-detalhes" class="btn-fechar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <div class="detalhes-content" id="detalhes-voo-content">
                    <!-- Conteúdo preenchido dinamicamente -->
                </div>
                
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-secondary" id="btn-voltar-lista">
                        Voltar
                    </button>
                    <button class="modal-btn modal-btn-primary" id="btn-selecionar-este-voo">
                        Selecionar Voo
                    </button>
                </div>
            </div>
        </div>

        <!-- Modal de confirmação de seleção -->
        <div id="modal-confirmacao" class="modal-backdrop" style="display:none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Confirmar Seleção</h3>
                    <button id="btn-fechar-modal" class="btn-fechar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <div class="confirmacao-tripinha">
                    <div class="confirmacao-avatar">
                        <img src="assets/images/tripinha/avatar-normal.png" alt="Tripinha">
                    </div>
                    <div class="confirmacao-content">
                        <p class="confirmacao-titulo">Ótima escolha!</p>
                        
                        <div id="resumo-valores" class="confirmacao-resumo">
                            <!-- Resumo de valores preenchido dinamicamente -->
                        </div>
                        
                        <div class="confirmacao-checkbox">
                            <input type="checkbox" id="confirmar-selecao">
                            <label for="confirmar-selecao">Confirmo que desejo prosseguir com este voo</label>
                        </div>
                        
                        <p class="confirmacao-aviso">
                            <span class="icon-info">ℹ️</span> 
                            Após a confirmação, você será direcionado para selecionar sua hospedagem.
                        </p>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-secondary" id="btn-continuar-buscando">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"></path>
                        </svg>
                        Voltar aos Voos
                    </button>
                    <button class="modal-btn modal-btn-primary" id="btn-confirmar" disabled>
                        Confirmar e Prosseguir
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Garantir que os modais estão ocultos
    document.getElementById('modal-confirmacao').style.display = 'none';
    document.getElementById('modal-detalhes-voo').style.display = 'none';
    console.log('Templates de modais carregados');
}

// Função para mostrar detalhes do voo em modal
function mostrarDetalhesVoo(vooId) {
    // Verifica se o módulo BENETRIP_VOOS está disponível e inicializado
    if (!window.BENETRIP_VOOS?.finalResults?.proposals) {
        console.error('Dados de voos não disponíveis');
        return;
    }
    
    // Encontra o voo pelo ID
    const voo = window.BENETRIP_VOOS.finalResults.proposals.find(
        (v, index) => (v.sign || `voo-idx-${index}`) === vooId
    );
    
    if (!voo) {
        console.error(`Voo ${vooId} não encontrado`);
        return;
    }
    
    // Prepara dados do voo
    const preco = window.BENETRIP_VOOS.obterPrecoVoo(voo);
    const moeda = window.BENETRIP_VOOS.finalResults?.meta?.currency || 'BRL';
    const infoIda = window.BENETRIP_VOOS.obterInfoSegmento(voo.segment?.[0]);
    const infoVolta = voo.segment?.length > 1 ? window.BENETRIP_VOOS.obterInfoSegmento(voo.segment[1]) : null;
    const companhiaIATA = voo.carriers?.[0];
    const companhiaAerea = window.BENETRIP_VOOS.obterNomeCompanhiaAerea(companhiaIATA);
    const ehVooDireto = infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0);
    
    // Obter container de conteúdo do modal
    const detalhesContent = document.getElementById('detalhes-voo-content');
    if (!detalhesContent) {
        console.error('Container de detalhes não encontrado');
        return;
    }
    
    // Gerar HTML do conteúdo
    detalhesContent.innerHTML = `
        <!-- Resumo de preço e companhia -->
        <div class="detalhes-sumario">
            <div class="detalhes-preco">
                <div class="preco-valor">${window.BENETRIP_VOOS.formatarPreco(preco, moeda)}</div>
                <div class="preco-info">Por pessoa, ida${infoVolta ? ' e volta' : ''}</div>
            </div>
            <div class="detalhes-companhia">
                <div class="companhia-logo">
                    <img src="${getAirlineLogoUrl(companhiaIATA, 60, 60)}" 
                         alt="${companhiaAerea}" 
                         onerror="this.src='${getAirlineLogoUrl('default', 60, 60)}'">
                </div>
                <div class="companhia-nome">${companhiaAerea}</div>
            </div>
        </div>
        
        <!-- Visualização da rota com timeline - IDA -->
        <div class="detalhes-secao">
            <div class="secao-header">
                <h4 class="secao-titulo">Ida • ${formatarData(infoIda?.dataPartida)}</h4>
                ${infoIda?.paradas === 0 ? `
                <div class="secao-etiqueta voo-direto">
                    <span class="etiqueta-icone">✈️</span>
                    <span>Voo Direto</span>
                </div>` : ''}
            </div>
            
            ${renderizarTimelineVoo(voo.segment?.[0]?.flight)}
        </div>
        
        ${infoVolta ? `
        <!-- Visualização da rota com timeline - VOLTA -->
        <div class="detalhes-secao">
            <div class="secao-header">
                <h4 class="secao-titulo">Volta • ${formatarData(infoVolta.dataPartida)}</h4>
                ${infoVolta.paradas === 0 ? `
                <div class="secao-etiqueta voo-direto">
                    <span class="etiqueta-icone">✈️</span>
                    <span>Voo Direto</span>
                </div>` : ''}
            </div>
            
            ${renderizarTimelineVoo(voo.segment?.[1]?.flight)}
        </div>
        ` : ''}
        
        <!-- Serviços e bagagem -->
        <div class="detalhes-secao">
            <h4 class="secao-titulo">Serviços Incluídos</h4>
            <div class="servicos-grid">
                <div class="servico-item incluido">
                    <span class="servico-icone">🧳</span>
                    <span class="servico-nome">1 Bagagem de Mão</span>
                </div>
                <div class="servico-item incluido">
                    <span class="servico-icone">🍽️</span>
                    <span class="servico-nome">Refeição a Bordo</span>
                </div>
                <div class="servico-item incluido">
                    <span class="servico-icone">🔄</span>
                    <span class="servico-nome">Remarcação Flexível</span>
                </div>
                <div class="servico-item opcional">
                    <span class="servico-icone">💼</span>
                    <span class="servico-nome">Bagagem Despachada</span>
                </div>
                <div class="servico-item opcional">
                    <span class="servico-icone">🪑</span>
                    <span class="servico-nome">Escolha de Assento</span>
                </div>
            </div>
        </div>
        
        <!-- Política de cancelamento -->
        <div class="detalhes-secao">
            <div class="secao-header">
                <h4 class="secao-titulo">Política de Cancelamento</h4>
                <div class="politica-toggle">
                    <span class="politica-icone">▼</span>
                </div>
            </div>
            <div class="politica-conteudo">
                <p class="politica-texto">
                    Cancelamento até 24h antes da partida: cobrança de taxa de ${window.BENETRIP_VOOS.formatarPreco(350, moeda)} por passageiro.
                    Cancelamento em menos de 24h: não reembolsável.
                </p>
            </div>
        </div>
    `;
    
    // Mostra o modal
    const modal = document.getElementById('modal-detalhes-voo');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('modal-active');
        }, 10);
        configurarBotoesDetalhesVoo(vooId);
    }
}

// Função para renderizar timeline do voo
function renderizarTimelineVoo(voos) {
    if (!voos || !Array.isArray(voos) || voos.length === 0) {
        return '<p>Informações de voo não disponíveis</p>';
    }
    
    let html = '';
    
    // Processa cada trecho de voo
    for (let i = 0; i < voos.length; i++) {
        const voo = voos[i];
        const ultimo = i === voos.length - 1;
        
        html += `
            <div class="timeline-voo">
                <div class="timeline-item">
                    <div class="timeline-ponto partida">
                        <div class="timeline-tempo">${voo.departure_time || '--:--'}</div>
                        <div class="timeline-local">
                            <div class="timeline-codigo">${voo.departure || '---'}</div>
                            <div class="timeline-cidade">${obterNomeCidade(voo.departure) || 'Origem'}</div>
                        </div>
                    </div>
                    <div class="timeline-linha">
                        <div class="duracao-badge">${formatarDuracao(voo.duration || 0)}</div>
                    </div>
                    <div class="timeline-ponto chegada">
                        <div class="timeline-tempo">${voo.arrival_time || '--:--'}</div>
                        <div class="timeline-local">
                            <div class="timeline-codigo">${voo.arrival || '---'}</div>
                            <div class="timeline-cidade">${obterNomeCidade(voo.arrival) || 'Destino'}</div>
                        </div>
                    </div>
                </div>
                
                <div class="voo-info">
                    <div class="info-item">
                        <span class="info-icone">🛫</span>
                        <span class="info-texto">
                            <img src="${getAirlineLogoUrl(voo.marketing_carrier, 16, 16)}" 
                                 alt="" class="inline-airline-logo">
                            Voo ${voo.marketing_carrier || ''}${voo.number || ''}
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-icone">🪑</span>
                        <span class="info-texto">Classe Econômica</span>
                    </div>
                    ${voo.aircraft ? `
                    <div class="info-item">
                        <span class="info-icone">✓</span>
                        <span class="info-texto">Aeronave: ${voo.aircraft}</span>
                    </div>` : ''}
                </div>
            </div>
        `;
        
        // Adiciona informação de conexão entre trechos
        if (!ultimo && voos[i+1]) {
            // Calcula tempo de conexão (usando strings de hora)
            let tempoConexao = 60; // Valor padrão
            
            if (voo.arrival_time && voos[i+1].departure_time) {
                const [horaC, minC] = voo.arrival_time.split(':').map(Number);
                const [horaP, minP] = voos[i+1].departure_time.split(':').map(Number);
                
                if (!isNaN(horaC) && !isNaN(minC) && !isNaN(horaP) && !isNaN(minP)) {
                    const minutosC = horaC * 60 + minC;
                    const minutosP = horaP * 60 + minP;
                    tempoConexao = minutosP - minutosC;
                    
                    // Se negativo, assume que é no dia seguinte
                    if (tempoConexao < 0) tempoConexao += 24 * 60;
                }
            }
            
            html += `
                <div style="text-align: center; margin: 8px 0; color: #E87722; font-size: 0.8rem; font-weight: 500;">
                    <span>⏱️</span> Conexão em ${voo.arrival} • ${formatarDuracao(tempoConexao)}
                </div>
            `;
        }
    }
    
    return html;
}

// Função para obter nome da cidade a partir do código do aeroporto
function obterNomeCidade(codigoAeroporto) {
    if (!codigoAeroporto || !window.BENETRIP_VOOS) return '';
    
    // Tenta obter do objeto cached
    const aeroporto = window.BENETRIP_VOOS.accumulatedAirports?.[codigoAeroporto];
    if (aeroporto?.city) return aeroporto.city;
    
    // Tenta obter do finalResults
    const finalAeroporto = window.BENETRIP_VOOS.finalResults?.airports?.[codigoAeroporto];
    return finalAeroporto?.city || '';
}

// Função para mostrar confirmação de seleção - MODIFICADA para resolver problemas de modal
function mostrarConfirmacaoSelecao() {
    // Verifica se o módulo está disponível
    if (!window.BENETRIP_VOOS) {
        console.error('Módulo BENETRIP_VOOS não disponível');
        return;
    }
    
    // CORREÇÃO: Verifica explicitamente se um voo foi selecionado
    const voo = window.BENETRIP_VOOS.vooSelecionado || window.BENETRIP_VOOS.vooAtivo;
    if (!voo) {
        exibirToast('Selecione um voo primeiro', 'warning');
        return;
    }
    
    // Prepara dados do voo
    const preco = window.BENETRIP_VOOS.obterPrecoVoo(voo);
    const moeda = window.BENETRIP_VOOS.finalResults?.meta?.currency || 'BRL';
    const precoFormatado = window.BENETRIP_VOOS.formatarPreco(preco, moeda);
    const numPassageiros = window.BENETRIP_VOOS.obterQuantidadePassageiros();
    const precoTotal = preco * numPassageiros;
    const precoTotalFormatado = window.BENETRIP_VOOS.formatarPreco(precoTotal, moeda);
    
    // Preenche o resumo de valores
    const resumoContainer = document.getElementById('resumo-valores');
    if (resumoContainer) {
        if (numPassageiros > 1) {
            resumoContainer.innerHTML = `
                <div class="resumo-item">
                    <span class="resumo-label">Preço por pessoa:</span>
                    <span class="resumo-valor">${precoFormatado}</span>
                </div>
                <div class="resumo-item">
                    <span class="resumo-label">Total (${numPassageiros} pessoas):</span>
                    <span class="resumo-valor destaque">${precoTotalFormatado}</span>
                </div>
            `;
        } else {
            resumoContainer.innerHTML = `
                <div class="resumo-item">
                    <span class="resumo-label">Preço total:</span>
                    <span class="resumo-valor destaque">${precoFormatado}</span>
                </div>
            `;
        }
    }
    
    // CORREÇÃO: Exibir o modal com a classe modal-active
    const modal = document.getElementById('modal-confirmacao');
    if (modal) {
        // Resetar o estado do modal para garantir que ele esteja fechado antes de abrir
        modal.style.display = 'flex';
        
        // Timeout para garantir que o display:flex seja aplicado antes de adicionar a classe
        setTimeout(() => {
            modal.classList.add('modal-active');
        }, 10);
        
        configurarBotoesConfirmacao();
    }
}

// Função para fechar modais - MODIFICADA
function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Remover a classe modal-active
    modal.classList.remove('modal-active');
    
    // Aguardar a animação terminar antes de setar display: none
    setTimeout(() => {
        if (!modal.classList.contains('modal-active')) {
            modal.style.display = 'none';
        }
    }, 300); // Mesmo tempo da transição CSS
}

// Função para exibir toasts (mensagens temporárias)
function exibirToast(mensagem, tipo = 'info') {
    // Cria container se não existir
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Remove toasts existentes
    const existingToasts = toastContainer.querySelectorAll('.toast');
    existingToasts.forEach(toast => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    });
    
    // Cria novo toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensagem;
    
    // Adiciona ao container e anima
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    
    // Remove após alguns segundos
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ======= CONFIGURAÇÃO DE EVENTOS =======

// Configurar botões do modal de detalhes do voo
function configurarBotoesDetalhesVoo(vooId) {
    // Botão para fechar modal
    const btnFechar = document.getElementById('btn-fechar-detalhes');
    if (btnFechar) {
        btnFechar.onclick = () => fecharModal('modal-detalhes-voo');
    }
    
    // Botão para voltar à lista
    const btnVoltar = document.getElementById('btn-voltar-lista');
    if (btnVoltar) {
        btnVoltar.onclick = () => fecharModal('modal-detalhes-voo');
    }
    
    // Botão para selecionar o voo
    const btnSelecionar = document.getElementById('btn-selecionar-este-voo');
    if (btnSelecionar) {
        btnSelecionar.onclick = () => {
            // Fechar modal de detalhes
            fecharModal('modal-detalhes-voo');
            
            // Selecionar o voo se o módulo estiver disponível
            if (window.BENETRIP_VOOS && vooId) {
                window.BENETRIP_VOOS.selecionarVoo(vooId);
                
                // Exibir confirmação
                mostrarConfirmacaoSelecao();
            }
        };
    }
    
    // Configurar toggle da política de cancelamento
    const politicaToggle = document.querySelector('.politica-toggle');
    const politicaConteudo = document.querySelector('.politica-conteudo');
    
    if (politicaToggle && politicaConteudo) {
        politicaToggle.onclick = function() {
            const icone = this.querySelector('.politica-icone');
            
            if (politicaConteudo.style.display === 'none') {
                politicaConteudo.style.display = 'block';
                icone.textContent = '▼';
            } else {
                politicaConteudo.style.display = 'none';
                icone.textContent = '▶';
            }
        };
    }
    
    // Fechar modal ao clicar fora
    const modal = document.getElementById('modal-detalhes-voo');
    if (modal) {
        modal.onclick = function(e) {
            if (e.target === modal) {
                fecharModal('modal-detalhes-voo');
            }
        };
    }
}

// Configura botões do modal de confirmação
function configurarBotoesConfirmacao() {
    // Checkbox de confirmação
    const checkbox = document.getElementById('confirmar-selecao');
    const btnConfirmar = document.getElementById('btn-confirmar');
    
    if (checkbox && btnConfirmar) {
        // Reset do estado
        checkbox.checked = false;
        btnConfirmar.disabled = true;
        
        // Configurar evento de alteração
        checkbox.onchange = function() {
            btnConfirmar.disabled = !this.checked;
        };
    }
    
    // Botão de fechar modal
    const btnFechar = document.getElementById('btn-fechar-modal');
    if (btnFechar) {
        btnFechar.onclick = () => fecharModal('modal-confirmacao');
    }
    
    // Botão para continuar buscando
    const btnContinuar = document.getElementById('btn-continuar-buscando');
    if (btnContinuar) {
        btnContinuar.onclick = () => fecharModal('modal-confirmacao');
    }
    
    // Botão de confirmar seleção
    if (btnConfirmar) {
        btnConfirmar.onclick = function() {
            if (window.BENETRIP_VOOS && window.BENETRIP_VOOS.vooSelecionado) {
                // Adiciona efeito de loading
                this.innerHTML = `
                    <span class="spinner"></span>
                    Processando...
                `;
                this.disabled = true;
                
                // Salvar dados
                const voo = window.BENETRIP_VOOS.vooSelecionado;
                const preco = window.BENETRIP_VOOS.obterPrecoVoo(voo);
                const moeda = window.BENETRIP_VOOS.finalResults?.meta?.currency || 'BRL';
                const numPassageiros = window.BENETRIP_VOOS.obterQuantidadePassageiros();
                const precoTotal = preco * numPassageiros;
                
                const dadosVoo = { 
                    voo, 
                    preco, 
                    precoTotal, 
                    moeda, 
                    numPassageiros, 
                    infoIda: window.BENETRIP_VOOS.obterInfoSegmento(voo.segment?.[0]), 
                    infoVolta: voo.segment?.length > 1 ? 
                        window.BENETRIP_VOOS.obterInfoSegmento(voo.segment[1]) : null, 
                    companhiaAerea: window.BENETRIP_VOOS.obterNomeCompanhiaAerea(voo.carriers?.[0]), 
                    dataSelecao: new Date().toISOString() 
                };
                
                try {
                    localStorage.setItem('benetrip_voo_selecionado', JSON.stringify(dadosVoo));
                    exibirToast('Voo selecionado! Redirecionando...', 'success');
                    
                    // Redireciona após breve espera
                    setTimeout(() => {
                        window.location.href = 'hotels.html';
                    }, 1500);
                } catch (erro) {
                    console.error('Erro ao salvar seleção de voo:', erro);
                    exibirToast('Erro ao processar seleção', 'error');
                    this.disabled = false;
                    this.innerHTML = 'Confirmar e Prosseguir';
                }
            }
        };
    }
    
    // Fechar modal ao clicar fora
    const modal = document.getElementById('modal-confirmacao');
    if (modal) {
        modal.onclick = function(e) {
            if (e.target === modal) {
                fecharModal('modal-confirmacao');
            }
        };
    }
}

// Configura eventos gerais da interface
function configurarEventosInterface() {
    // Botão de voltar
    const btnVoltar = document.querySelector('.btn-voltar');
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            window.location.href = 'destinos.html';
        });
    }
    
    // Botão de selecionar voo
    const btnSelecionar = document.querySelector('.btn-selecionar-voo');
    if (btnSelecionar) {
        btnSelecionar.addEventListener('click', () => {
            if (window.BENETRIP_VOOS?.vooSelecionado) {
                mostrarConfirmacaoSelecao();
            } else if (window.BENETRIP_VOOS?.vooAtivo) {
                window.BENETRIP_VOOS.selecionarVooAtivo();
                mostrarConfirmacaoSelecao();
            } else {
                exibirToast('Selecione um voo primeiro', 'warning');
            }
        });
    }
    
    // Delegação de eventos para botões de detalhes dos voos
    document.addEventListener('click', (event) => {
        // Botões de detalhes
        const btnDetalhes = event.target.closest('.btn-detalhes-voo');
        if (btnDetalhes) {
            const vooId = btnDetalhes.dataset.vooId;
            if (vooId) {
                mostrarDetalhesVoo(vooId);
            }
            return;
        }
        
        // Clique em cards de voo
        const vooCard = event.target.closest('.voo-card');
        if (vooCard && !event.target.closest('button')) {
            const vooId = vooCard.dataset.vooId;
            const vooIndex = vooCard.dataset.vooIndex;
            
            // Atualizar UI
            document.querySelectorAll('.voo-card').forEach(c => 
                c.classList.remove('voo-card-ativo')
            );
            vooCard.classList.add('voo-card-ativo');
            
            // Atualizar estado no módulo BENETRIP_VOOS
            if (window.BENETRIP_VOOS && window.BENETRIP_VOOS.finalResults?.proposals) {
                const index = parseInt(vooIndex);
                if (!isNaN(index)) {
                    window.BENETRIP_VOOS.indexVooAtivo = index;
                    window.BENETRIP_VOOS.vooAtivo = window.BENETRIP_VOOS.finalResults.proposals[index];
                    window.BENETRIP_VOOS.atualizarBotaoSelecao();
                }
            }
        }
    });
}

// Adicionar eventos para ouvir quando os resultados estiverem prontos
document.addEventListener('resultadosVoosProntos', function(event) {
    console.log(`Evento recebido: resultadosVoosProntos - ${event.detail.quantidadeVoos} voos`);
    // Espera um pouco para garantir que os elementos DOM estejam completos
    setTimeout(() => {
        configurarNavegacaoCards();
    }, 100);
});

// Adicionar evento para mostrar detalhes do voo
document.addEventListener('mostrarDetalhesVoo', function(event) {
    const vooId = event.detail.vooId;
    if (vooId) {
        mostrarDetalhesVoo(vooId);
    }
});

// Também adicionar navegação por teclado para acessibilidade
document.addEventListener('keydown', function(event) {
    // Verificar se estamos na tela de voos
    if (!document.getElementById('voos-swipe-container')) return;
    
    switch(event.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
            // Navegar para o cartão anterior
            if (window.BENETRIP_VOOS) {
                window.BENETRIP_VOOS.vooAnterior();
            }
            break;
        case 'ArrowDown':
        case 'ArrowRight':
            // Navegar para o próximo cartão
            if (window.BENETRIP_VOOS) {
                window.BENETRIP_VOOS.proximoVoo();
            }
            break;
        case 'Enter':
            // Selecionar o voo atual
            if (window.BENETRIP_VOOS) {
                window.BENETRIP_VOOS.selecionarVooAtivo();
            }
            break;
    }
});

// ======= INICIALIZAÇÃO =======

// Inicialização principal
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado - inicializando interface de voos com layout vertical...');
    
    // Aplicar estilos para layout vertical
    aplicarEstilosVerticais();
    
    // Adicionar botão de customização
    adicionarBotaoCustomizacao();
    
    // Modificar criação de cards
    modificarCriarCardVoo();
    
    // Carrega os templates dos modais
    carregarTemplatesModais();
    
    // Configura eventos gerais da interface
    configurarEventosInterface();
    
    // Verifica se o módulo principal já foi carregado e tem resultados
    if (typeof window.BENETRIP_VOOS !== 'undefined' && 
        !window.BENETRIP_VOOS.estaCarregando && 
        window.BENETRIP_VOOS.finalResults) {
        
        console.log('BENETRIP_VOOS já tem resultados - configurando navegação imediatamente');
        configurarNavegacaoCards();
    } else {
        console.log('Aguardando BENETRIP_VOOS carregar dados...');
        // Será acionado pelo evento 'resultadosVoosProntos'
    }
});
