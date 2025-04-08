// voos-interface.js

// Funções auxiliares para logotipos de companhias aéreas
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

// Função para carregar templates de modais dinamicamente
function carregarTemplatesModais() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;
    
    // Carrega os templates de modais
    modalContainer.innerHTML = `
        <!-- Modal de detalhes do voo -->
        <div id="modal-detalhes-voo" class="modal-backdrop" style="display:none;">
            <!-- Conteúdo do modal de detalhes -->
        </div>

        <!-- Modal de confirmação de seleção -->
        <div id="modal-confirmacao" class="modal-backdrop" style="display:none;">
            <!-- Conteúdo do modal de confirmação -->
        </div>
    `;
    
    // Aqui você adicionaria o código completo dos modais
}

// Função para configurar eventos da interface
function configurarEventosInterface() {
    // Configurar botões de ver detalhes
    const botoesDetalhes = document.querySelectorAll('.btn-detalhes-voo');
    if (botoesDetalhes.length > 0) {
        botoesDetalhes.forEach(function(btn) {
            btn.addEventListener('click', function() {
                const vooId = this.dataset.vooId;
                mostrarDetalhesVoo(vooId);
            });
        });
    }
    
    // Configurar botão de selecionar voo
    const btnSelecionar = document.querySelector('.btn-selecionar-voo');
    if (btnSelecionar) {
        btnSelecionar.addEventListener('click', function() {
            mostrarConfirmacaoSelecao();
        });
    }
    
    // Aqui você adicionaria todos os outros eventos da interface
}

// Função para configurar swipe e navegação entre cards
function configurarNavegacaoCards() {
    const swipeContainer = document.getElementById('voos-swipe-container');
    if (!swipeContainer) return;
    
    const cards = swipeContainer.querySelectorAll('.voo-card');
    if (!cards.length) return;
    
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
        
        // Atualiza o texto do botão
        const btnSelectText = document.querySelector('.btn-selecionar-voo span');
        if (btnSelectText && BENETRIP_VOOS.finalResults?.proposals?.length > index) {
            const voo = BENETRIP_VOOS.finalResults.proposals[index];
            const preco = BENETRIP_VOOS.obterPrecoVoo(voo);
            const moeda = BENETRIP_VOOS.finalResults?.meta?.currency || 'BRL';
            btnSelectText.textContent = `Escolher Voo por ${BENETRIP_VOOS.formatarPreco(preco, moeda)}`;
        }
        
        currentCardIndex = index;
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
    }
}

// Inicialização da interface quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    carregarTemplatesModais();
    
    // Verificar se o módulo principal já foi inicializado antes de configurar a interface
    if (typeof BENETRIP_VOOS !== 'undefined') {
        // Configurar interfaces após o carregamento dos dados
        const checkInterval = setInterval(() => {
            if (!BENETRIP_VOOS.estaCarregando && BENETRIP_VOOS.finalResults) {
                configurarEventosInterface();
                configurarNavegacaoCards();
                clearInterval(checkInterval);
            }
        }, 500);
    }
    
    // Esconder dica de swipe após alguns segundos
    setTimeout(() => {
        const swipeHint = document.querySelector('.swipe-hint');
        if (swipeHint) {
            swipeHint.style.opacity = '0';
            setTimeout(() => {
                if (swipeHint.parentNode) swipeHint.parentNode.removeChild(swipeHint);
            }, 1000);
        }
    }, 5000);
});

// Funções para mostrar e gerenciar modais
function mostrarDetalhesVoo(vooId) {
    // Implementação da função...
}

function mostrarConfirmacaoSelecao() {
    // Implementação da função...
}
