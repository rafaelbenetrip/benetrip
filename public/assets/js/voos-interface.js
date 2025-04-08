/**
 * BENETRIP - Módulo de Interface de Voos
 * 
 * Este arquivo gerencia a interface do usuário para a página de voos,
 * incluindo a navegação entre cards, modais e elementos interativos.
 * Funciona em conjunto com o módulo flights.js que processa os dados.
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

// ======= CARREGAMENTO DE TEMPLATES =======

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
}

// ======= CONFIGURAÇÃO DE NAVEGAÇÃO =======

// Função para configurar navegação entre cards de voo
function configurarNavegacaoCards() {
    console.log('Configurando navegação dos cards de voo...');
    const swipeContainer = document.getElementById('voos-swipe-container');
    if (!swipeContainer) {
        console.warn('Container de swipe não encontrado');
        return;
    }
    
    const cards = swipeContainer.querySelectorAll('.voo-card');
    if (!cards.length) {
        console.warn('Nenhum card de voo encontrado');
        return;
    }
    
    console.log(`${cards.length} cards de voo encontrados`);
    
    const paginationDots = document.querySelectorAll('.pagination-dot');
    let currentCardIndex = 0;
    
    // Função para atualizar o card ativo
    function updateActiveCard(index) {
        cards.forEach((card, i) => {
            card.classList.toggle('voo-card-ativo', i === index);
        });
        
        if (paginationDots.length) {
            paginationDots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
        }
        
        // Atualiza o texto do botão se o módulo BENETRIP_VOOS estiver disponível
        const btnSelectText = document.querySelector('.btn-selecionar-voo span');
        if (btnSelectText && window.BENETRIP_VOOS?.finalResults?.proposals?.length > index) {
            const voo = window.BENETRIP_VOOS.finalResults.proposals[index];
            const preco = window.BENETRIP_VOOS.obterPrecoVoo(voo);
            const moeda = window.BENETRIP_VOOS.finalResults?.meta?.currency || 'BRL';
            btnSelectText.textContent = `Escolher Voo por ${window.BENETRIP_VOOS.formatarPreco(preco, moeda)}`;
        }
        
        currentCardIndex = index;
        
        // Se o BENETRIP_VOOS estiver disponível, atualiza o voo ativo
        if (window.BENETRIP_VOOS && window.BENETRIP_VOOS.finalResults?.proposals) {
            window.BENETRIP_VOOS.vooAtivo = window.BENETRIP_VOOS.finalResults.proposals[index];
            window.BENETRIP_VOOS.indexVooAtivo = index;
        }
    }
    
    // Configurar botões de navegação
    const btnNext = document.querySelector('.next-btn');
    const btnPrev = document.querySelector('.prev-btn');
    
    if (btnNext) {
        btnNext.addEventListener('click', function() {
            if (currentCardIndex < cards.length - 1) {
                updateActiveCard(currentCardIndex + 1);
                cards[currentCardIndex].scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest', 
                    inline: 'center' 
                });
            }
        });
    }
    
    if (btnPrev) {
        btnPrev.addEventListener('click', function() {
            if (currentCardIndex > 0) {
                updateActiveCard(currentCardIndex - 1);
                cards[currentCardIndex].scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest', 
                    inline: 'center' 
                });
            }
        });
    }
    
    // Configurar clique nas bolinhas de paginação
    if (paginationDots.length) {
        paginationDots.forEach((dot, index) => {
            dot.addEventListener('click', function() {
                updateActiveCard(index);
                cards[index].scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest', 
                    inline: 'center' 
                });
            });
        });
    }
    
    // Configurar swipe com Hammer.js
    if (typeof Hammer !== 'undefined') {
        const hammerInstance = new Hammer(swipeContainer);
        hammerInstance.on('swipeleft', () => {
            if (currentCardIndex < cards.length - 1) {
                updateActiveCard(currentCardIndex + 1);
                cards[currentCardIndex].scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest', 
                    inline: 'center' 
                });
            }
        });
        
        hammerInstance.on('swiperight', () => {
            if (currentCardIndex > 0) {
                updateActiveCard(currentCardIndex - 1);
                cards[currentCardIndex].scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest', 
                    inline: 'center' 
                });
            }
        });
    } else {
        console.warn('Hammer.js não encontrado. Funcionalidade de swipe desativada.');
    }
    
    // Configurar detecção de scroll para atualizar card ativo
    let scrollTimeoutId = null;
    swipeContainer.addEventListener('scroll', () => {
        clearTimeout(scrollTimeoutId);
        scrollTimeoutId = setTimeout(() => {
            // Encontra o card no centro da visualização
            const containerRect = swipeContainer.getBoundingClientRect();
            const containerCenter = containerRect.left + containerRect.width / 2;
            
            let closestCard = null;
            let closestDistance = Infinity;
            
            cards.forEach((card, index) => {
                const cardRect = card.getBoundingClientRect();
                const cardCenter = cardRect.left + cardRect.width / 2;
                const distance = Math.abs(containerCenter - cardCenter);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestCard = card;
                }
            });
            
            if (closestCard) {
                const index = Array.from(cards).indexOf(closestCard);
                if (index !== -1 && index !== currentCardIndex) {
                    updateActiveCard(index);
                }
            }
        }, 150);
    });
    
    // Configurar clique nos cards
    cards.forEach((card, index) => {
        card.addEventListener('click', (e) => {
            // Ignora cliques em botões dentro do card
            if (!e.target.closest('.btn-detalhes-voo')) {
                updateActiveCard(index);
            }
        });
    });
    
    console.log('Navegação de cards configurada com sucesso');
}

// ======= GESTÃO DE MODAIS =======

// Função para mostrar detalhes do voo em modal
function mostrarDetalhesVoo(vooId) {
    console.log(`Mostrando detalhes do voo: ${vooId}`);
    
    // Verifica se o módulo BENETRIP_VOOS está disponível e inicializado
    if (!window.BENETRIP_VOOS?.finalResults?.proposals) {
        console.error('Dados de voos não disponíveis');
        exibirToast('Erro ao carregar detalhes do voo', 'error');
        return;
    }
    
    // Encontra o voo pelo ID
    const voo = window.BENETRIP_VOOS.finalResults.proposals.find(
        (v, index) => (v.sign || `voo-idx-${index}`) === vooId
    );
    
    if (!voo) {
        console.error(`Voo ${vooId} não encontrado`);
        exibirToast('Voo não encontrado', 'error');
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

// Função para mostrar confirmação de seleção
function mostrarConfirmacaoSelecao() {
    console.log('Mostrando confirmação de seleção');
    
    // Verifica se o módulo está disponível
    if (!window.BENETRIP_VOOS) {
        console.error('Módulo BENETRIP_VOOS não disponível');
        exibirToast('Erro ao carregar dados do voo', 'error');
        return;
    }
    
    // Obtém o voo selecionado ou ativo
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
    
    // Exibe o modal
    const modal = document.getElementById('modal-confirmacao');
    if (modal) {
        modal.style.display = 'flex';
        configurarBotoesConfirmacao();
    }
}

// Função para fechar modais
function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
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
    console.log('Configurando eventos de interface...');
    
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
        if (vooCard && !event.target.closest('.btn-detalhes-voo')) {
            const vooId = vooCard.dataset.vooId;
            if (vooId && window.BENETRIP_VOOS) {
                window.BENETRIP_VOOS.selecionarVoo(vooId);
            }
        }
    });
    
    console.log('Eventos de interface configurados com sucesso');
}

// Função para verificar se os dados de voo estão disponíveis
function verificarDadosDisponiveisEConfigurar() {
    console.log('Verificando disponibilidade de dados de voo...');
    
    // Verifica se o módulo principal já existe
    if (typeof window.BENETRIP_VOOS !== 'undefined') {
        // Verifica status de carregamento
        if (!window.BENETRIP_VOOS.estaCarregando && window.BENETRIP_VOOS.finalResults) {
            console.log('Dados de voo já disponíveis, configurando interface...');
            configurarNavegacaoCards();
            return true;
        } else {
            console.log('Módulo existe mas ainda está carregando dados...');
            return false;
        }
    } else {
        console.warn('Módulo BENETRIP_VOOS não encontrado');
        return false;
    }
}

// ======= INICIALIZAÇÃO =======

// Inicialização principal
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, inicializando interface de voos...');
    
    // Carrega os templates dos modais
    carregarTemplatesModais();
    
    // Configura eventos gerais da interface
    configurarEventosInterface();
    
    // Esconder dica de swipe após alguns segundos
    setTimeout(() => {
        const swipeHint = document.querySelector('.swipe-hint');
        if (swipeHint) {
            swipeHint.style.opacity = '0';
            setTimeout(() => {
                if (swipeHint && swipeHint.parentNode) swipeHint.parentNode.removeChild(swipeHint);
            }, 1000);
        }
    }, 5000);
    
    // Verifica e configura ou espera por dados
    if (!verificarDadosDisponiveisEConfigurar()) {
        console.log('Aguardando carregamento de dados de voo...');
        
        // Configurar verificação periódica por dados
        const maxTentativas = 20;
        let tentativas = 0;
        
        const intervaloVerificacao = setInterval(() => {
            tentativas++;
            console.log(`Verificação ${tentativas}/${maxTentativas} por dados disponíveis...`);
            
            // Se conseguir configurar ou tentar muitas vezes, para de verificar
            if (verificarDadosDisponiveisEConfigurar() || tentativas >= maxTentativas) {
                clearInterval(intervaloVerificacao);
                
                if (tentativas >= maxTentativas && !window.BENETRIP_VOOS?.finalResults) {
                    console.warn(`Dados não disponíveis após ${maxTentativas} tentativas`);
                    
                    // Verifica se o módulo BENETRIP_VOOS foi inicializado corretamente
                    if (!window.BENETRIP_VOOS) {
                        console.error('Módulo BENETRIP_VOOS não encontrado após espera. Verificando scripts...');
                        
                        // Verifica se o script foi carregado
                        const scriptElement = document.querySelector('script[src*="flights.js"]');
                        if (!scriptElement) {
                            console.error('Script flights.js não encontrado na página!');
                            
                            // Tentar carregar o script manualmente
                            const script = document.createElement('script');
                            script.src = 'assets/js/flights.js';
                            script.onload = () => {
                                console.log('Script flights.js carregado manualmente, iniciando...');
                                if (window.BENETRIP_VOOS) {
                                    window.BENETRIP_VOOS.init();
                                }
                            };
                            document.body.appendChild(script);
                        }
                    }
                }
            }
        }, 500);
    }
});

// Expõe funções importantes globalmente
window.mostrarDetalhesVoo = mostrarDetalhesVoo;
window.mostrarConfirmacaoSelecao = mostrarConfirmacaoSelecao;
window.configurarNavegacaoCards = configurarNavegacaoCards;
window.exibirToast = exibirToast;
