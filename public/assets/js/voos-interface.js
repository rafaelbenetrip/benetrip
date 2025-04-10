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
    
    const code = iataCode.trim().toUpperCase();
    const retinaSuffix = retina ? '@2x' : '';
    
    return `https://pics.avs.io/${width}/${height}/${code}${retinaSuffix}.png`;
}

function getAgencyLogoUrl(gateId, width = 110, height = 40, retina = false) {
    if (!gateId) return null;
    
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
    if (!data || !(data instanceof Date) || isNaN(data.getTime())) return 'N/A';
    
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${diasSemana[data.getDay()]}, ${data.getDate()} ${meses[data.getMonth()]}`;
}

/**
 * Aplicar estilos CSS para layout vertical
 */
function aplicarEstilosVerticais() {
    const style = document.createElement('style');
    style.textContent = `
    .voos-swipe-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
      overflow-x: hidden;
      scroll-snap-type: y mandatory;
      padding: 8px 16px 80px;
      margin-bottom: 16px;
      max-height: calc(100vh - 240px);
      scrollbar-width: thin;
      background: none;
    }

    .voo-card {
      flex: 0 0 auto;
      width: 100%;
      max-width: none;
      scroll-snap-align: start;
      min-width: 0;
      margin: 0 0 12px 0;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

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

    .pagination-indicator,
    .nav-controls,
    .swipe-hint {
      display: none;
    }

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
    `;
    document.head.appendChild(style);
    console.log('Estilos para layout vertical aplicados');
}

/**
 * Adicionar botão de customização
 */
function adicionarBotaoCustomizacao() {
    if (document.querySelector('.customize-search-button')) return;
    
    const header = document.querySelector('.app-header');
    if (!header) return;
    
    const button = document.createElement('button');
    button.className = 'customize-search-button';
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l-.06-.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        Personalizar Minha Busca
    `;
    
    header.parentNode.insertBefore(button, header.nextSibling);
    
    button.addEventListener('click', function() {
        localStorage.setItem('benetrip_customizar_busca', 'true');
        window.location.href = 'index.html';
    });
    
    console.log('Botão de customização adicionado');
}

/**
 * Inicialização para navegação de voos - função global
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
    
    cards.forEach((card, index) => {
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
        
        newCard.addEventListener('click', function(e) {
            if (e.target.closest('button')) return;
            
            document.querySelectorAll('.voo-card').forEach(c => 
                c.classList.remove('voo-card-ativo')
            );
            this.classList.add('voo-card-ativo');
            
            if (window.BENETRIP_VOOS && window.BENETRIP_VOOS.finalResults?.proposals) {
                const vooIndex = parseInt(this.dataset.vooIndex);
                if (!isNaN(vooIndex)) {
                    window.BENETRIP_VOOS.indexVooAtivo = vooIndex;
                    window.BENETRIP_VOOS.vooAtivo = window.BENETRIP_VOOS.finalResults.proposals[vooIndex];
                    window.BENETRIP_VOOS.atualizarBotaoSelecao();
                }
            }
        });
        
        const btnDetalhes = newCard.querySelector('.btn-detalhes-voo');
        if (btnDetalhes) {
            btnDetalhes.addEventListener('click', function(e) {
                e.stopPropagation();
                const vooId = this.dataset.vooId;
                if (vooId) {
                    mostrarDetalhesVoo(vooId);
                }
            });
        }
    });
    
    // Configurar botões de escolha nos cards
    const chooseButtons = document.querySelectorAll('.choose-flight-button');
    if (chooseButtons.length) {
        chooseButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const vooId = this.dataset.vooId;
                if (vooId && window.BENETRIP_VOOS) {
                    window.BENETRIP_VOOS.selecionarVoo(vooId);
                    
                    // Chamar diretamente o processamento, sem mostrar modal
                    if (window.BENETRIP_REDIRECT && typeof window.BENETRIP_REDIRECT.processarConfirmacao === 'function') {
                        window.BENETRIP_REDIRECT.processarConfirmacao(vooId);
                    } else {
                        // Fallback: ir direto para hotéis
                        window.location.href = 'hotels.html';
                    }
                }
            });
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
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
                cards[newIndex].click();
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
    if (!window.BENETRIP_VOOS || !window.BENETRIP_VOOS.criarCardVoo) {
        console.log('BENETRIP_VOOS ainda não disponível, tentando novamente em 100ms');
        setTimeout(modificarCriarCardVoo, 100);
        return;
    }
    
    const funcaoOriginal = window.BENETRIP_VOOS.criarCardVoo;
    
    window.BENETRIP_VOOS.criarCardVoo = function(voo, index) {
        const cardVoo = funcaoOriginal.call(this, voo, index);
        
        if (cardVoo) {
            const footer = cardVoo.querySelector('.voo-card-footer');
            if (footer) {
                const vooId = voo.sign || `voo-idx-${index}`;
                const chooseButton = document.createElement('button');
                chooseButton.className = 'choose-flight-button';
                chooseButton.textContent = 'Escolher Este Voo';
                chooseButton.dataset.vooId = vooId;
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
    
    modalContainer.innerHTML = `
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
    
    document.getElementById('modal-confirmacao').style.display = 'none';
    document.getElementById('modal-detalhes-voo').style.display = 'none';
    console.log('Templates de modais carregados');
}

// Função para mostrar detalhes do voo em modal
function mostrarDetalhesVoo(vooId) {
    if (!window.BENETRIP_VOOS?.finalResults?.proposals) {
        console.error('Dados de voos não disponíveis');
        return;
    }
    
    const voo = window.BENETRIP_VOOS.finalResults.proposals.find(
        (v, index) => (v.sign || `voo-idx-${index}`) === vooId
    );
    
    if (!voo) {
        console.error(`Voo ${vooId} não encontrado`);
        return;
    }
    
    const preco = window.BENETRIP_VOOS.obterPrecoVoo(voo);
    const moeda = window.BENETRIP_VOOS.finalResults?.meta?.currency || 'BRL';
    const infoIda = window.BENETRIP_VOOS.obterInfoSegmento(voo.segment?.[0]);
    const infoVolta = voo.segment?.length > 1 ? window.BENETRIP_VOOS.obterInfoSegmento(voo.segment[1]) : null;
    const companhiaIATA = voo.carriers?.[0];
    const companhiaAerea = window.BENETRIP_VOOS.obterNomeCompanhiaAerea(companhiaIATA);
    
    const detalhesContent = document.getElementById('detalhes-voo-content');
    if (!detalhesContent) {
        console.error('Container de detalhes não encontrado');
        return;
    }
    
    detalhesContent.innerHTML = `
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
        
        if (!ultimo && voos[i+1]) {
            let tempoConexao = 60;
            if (voo.arrival_time && voos[i+1].departure_time) {
                const [horaC, minC] = voo.arrival_time.split(':').map(Number);
                const [horaP, minP] = voos[i+1].departure_time.split(':').map(Number);
                if (!isNaN(horaC) && !isNaN(minC) && !isNaN(horaP) && !isNaN(minP)) {
                    const minutosC = horaC * 60 + minC;
                    const minutosP = horaP * 60 + minP;
                    tempoConexao = minutosP - minutosC;
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
    const aeroporto = window.BENETRIP_VOOS.accumulatedAirports?.[codigoAeroporto];
    if (aeroporto?.city) return aeroporto.city;
    const finalAeroporto = window.BENETRIP_VOOS.finalResults?.airports?.[codigoAeroporto];
    return finalAeroporto?.city || '';
}

// Função para exibir toasts
function exibirToast(mensagem, tipo = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const existingToasts = toastContainer.querySelectorAll('.toast');
    existingToasts.forEach(toast => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    });
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensagem;
    
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ======= CONFIGURAÇÃO DE EVENTOS =======

// Configurar botões do modal de detalhes do voo
function configurarBotoesDetalhesVoo(vooId) {
    const btnFechar = document.getElementById('btn-fechar-detalhes');
    if (btnFechar) {
        btnFechar.onclick = () => {
            if (typeof window.fecharModal === 'function') {
                window.fecharModal('modal-detalhes-voo');
            }
        };
    }
    
    const btnVoltar = document.getElementById('btn-voltar-lista');
    if (btnVoltar) {
        btnVoltar.onclick = () => {
            if (typeof window.fecharModal === 'function') {
                window.fecharModal('modal-detalhes-voo');
            }
        };
    }
    
    const btnSelecionar = document.getElementById('btn-selecionar-este-voo');
    if (btnSelecionar) {
        btnSelecionar.onclick = () => {
            if (typeof window.fecharModal === 'function') {
                window.fecharModal('modal-detalhes-voo');
            }
            
            if (window.BENETRIP_VOOS && vooId) {
                window.BENETRIP_VOOS.selecionarVoo(vooId);
                if (typeof window.mostrarConfirmacaoSelecao === 'function') {
                    window.mostrarConfirmacaoSelecao();
                }
            }
        };
    }
    
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
    
    const modal = document.getElementById('modal-detalhes-voo');
    if (modal) {
        modal.onclick = function(e) {
            if (e.target === modal) {
                if (typeof window.fecharModal === 'function') {
                    window.fecharModal('modal-detalhes-voo');
                }
            }
        };
    }
}

// Configura eventos gerais da interface
function configurarEventosInterface() {
    const btnVoltar = document.querySelector('.btn-voltar');
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            window.location.href = 'destinos.html';
        });
    }
    
    const btnSelecionar = document.querySelector('.btn-selecionar-voo');
    if (btnSelecionar) {
        btnSelecionar.addEventListener('click', () => {
            if (window.BENETRIP_VOOS?.vooSelecionado) {
                if (typeof window.mostrarConfirmacaoSelecao === 'function') {
                    window.mostrarConfirmacaoSelecao();
                }
            } else if (window.BENETRIP_VOOS?.vooAtivo) {
                window.BENETRIP_VOOS.selecionarVooAtivo();
                if (typeof window.mostrarConfirmacaoSelecao === 'function') {
                    window.mostrarConfirmacaoSelecao();
                }
            } else {
                exibirToast('Selecione um voo primeiro', 'warning');
            }
        });
    }
    
    document.addEventListener('click', (event) => {
        const btnDetalhes = event.target.closest('.btn-detalhes-voo');
        if (btnDetalhes) {
            const vooId = btnDetalhes.dataset.vooId;
            if (vooId) {
                mostrarDetalhesVoo(vooId);
            }
            return;
        }
        
        const vooCard = event.target.closest('.voo-card');
        if (vooCard && !event.target.closest('button')) {
            const vooId = vooCard.dataset.vooId;
            const vooIndex = vooCard.dataset.vooIndex;
            
            document.querySelectorAll('.voo-card').forEach(c => 
                c.classList.remove('voo-card-ativo')
            );
            vooCard.classList.add('voo-card-ativo');
            
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

// Navegação por teclado para acessibilidade
document.addEventListener('keydown', function(event) {
    if (!document.getElementById('voos-swipe-container')) return;
    
    switch(event.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
            if (window.BENETRIP_VOOS) window.BENETRIP_VOOS.vooAnterior();
            break;
        case 'ArrowDown':
        case 'ArrowRight':
            if (window.BENETRIP_VOOS) window.BENETRIP_VOOS.proximoVoo();
            break;
        case 'Enter':
            if (window.BENETRIP_VOOS) window.BENETRIP_VOOS.selecionarVooAtivo();
            break;
    }
});

// ======= INICIALIZAÇÃO =======

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado - inicializando interface de voos com layout vertical...');
    
    aplicarEstilosVerticais();
    adicionarBotaoCustomizacao();
    modificarCriarCardVoo();
    carregarTemplatesModais();
    configurarEventosInterface();
    
    if (typeof window.BENETRIP_VOOS !== 'undefined' && 
        !window.BENETRIP_VOOS.estaCarregando && 
        window.BENETRIP_VOOS.finalResults) {
        console.log('BENETRIP_VOOS já tem resultados - configurando navegação imediatamente');
        configurarNavegacaoCards();
    } else {
        console.log('Aguardando BENETRIP_VOOS carregar dados...');
    }
});
