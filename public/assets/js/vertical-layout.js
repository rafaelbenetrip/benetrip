/**
 * BENETRIP - Script de layout vertical para voos
 * Este script aplica as alterações de layout sem modificar a lógica existente
 */

// Injetar o CSS em uma tag de estilo para evitar modificar o arquivo CSS original
function injetarCSSVertical() {
    const estiloVertical = `
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

    /* Ajustar a altura do container para permitir scroll adequado */
    #voos-container {
      padding-bottom: 100px; /* Espaço para o botão fixo */
      overflow-y: auto;
    }

    /* Ajustes para o layout de cards com companhia aérea alinhada ao preço */
    .voo-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
    }

    /* Remover/ajustar os controles de navegação */
    .pagination-indicator {
      display: none; /* Não precisamos dos pontos de paginação em layout vertical */
    }

    .nav-controls {
      display: none; /* Esconder botões de navegação anterior/próximo */
    }

    /* Ajustar o toast para não ser cortado pelo botão fixo */
    #toast-container {
      bottom: 100px; /* Aumentar espaço para o botão fixo */
    }

    /* Botão Selecionar Voo customizado como no protótipo */
    .btn-selecionar-voo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
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

    /* Remover swipe hint para layout vertical */
    .swipe-hint {
      display: none;
    }
    `;

    // Criar elemento de estilo e inserir na head
    const style = document.createElement('style');
    style.textContent = estiloVertical;
    document.head.appendChild(style);
    
    console.log('Estilos CSS para layout vertical aplicados');
}

// Adicionar botão de customização se não existir
function adicionarBotaoCustomizacao() {
    if (document.querySelector('.customize-search-button')) return;
    
    const appHeader = document.querySelector('.app-header');
    if (!appHeader) return;
    
    const btnCustomizar = document.createElement('button');
    btnCustomizar.className = 'customize-search-button';
    btnCustomizar.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        Personalizar Minha Busca
    `;
    
    // Adicionar após o header
    appHeader.parentNode.insertBefore(btnCustomizar, appHeader.nextSibling);
    
    // Adicionar evento de clique
    btnCustomizar.addEventListener('click', function() {
        // Armazenar que o usuário quer customizar a busca
        localStorage.setItem('benetrip_customizar_busca', 'true');
        
        // Redirecionar para a página inicial
        window.location.href = 'index.html';
    });
    
    console.log('Botão de customização adicionado');
}

// Modificar função de criação de cards
function modificarCriacaoCards() {
    // Verificar se o objeto BENETRIP_VOOS está disponível
    if (!window.BENETRIP_VOOS || !window.BENETRIP_VOOS.criarCardVoo) {
        console.log('BENETRIP_VOOS não disponível, tentando novamente em 100ms...');
        setTimeout(modificarCriacaoCards, 100);
        return;
    }
    
    // Backup da função original
    const funcaoOriginal = window.BENETRIP_VOOS.criarCardVoo;
    
    // Sobrescrever com nova função
    window.BENETRIP_VOOS.criarCardVoo = function(voo, index) {
        // Chamar função original para manter a lógica existente
        const cardVoo = funcaoOriginal.call(this, voo, index);
        
        if (cardVoo) {
            // Adicionar botão "Choose This Flight" no rodapé do card
            const footer = cardVoo.querySelector('.voo-card-footer');
            if (footer) {
                const vooId = voo.sign || `voo-idx-${index}`;
                
                // Criar o botão
                const chooseButton = document.createElement('button');
                chooseButton.className = 'choose-flight-button';
                chooseButton.textContent = 'Escolher Este Voo';
                chooseButton.dataset.vooId = vooId;
                
                // Substituir o rodapé existente
                footer.innerHTML = '';
                footer.appendChild(chooseButton);
            }
        }
        
        return cardVoo;
    };
    
    console.log('Função criarCardVoo modificada para incluir botão de escolha');
}

// Corrigir comportamento dos modais
function corrigirComportamentoModais() {
    // Se as funções já foram redefinidas, não redefina novamente
    if (window._modalCorrigido) return;
    
    // Redefinir função de mostrar confirmação
    if (window.mostrarConfirmacaoSelecao) {
        const funcaoOriginal = window.mostrarConfirmacaoSelecao;
        
        window.mostrarConfirmacaoSelecao = function() {
            // Chamar função original
            funcaoOriginal.apply(this, arguments);
            
            // Adicionar classe modal-active após curto delay
            setTimeout(() => {
                const modal = document.getElementById('modal-confirmacao');
                if (modal) {
                    modal.classList.add('modal-active');
                }
            }, 10);
        };
    }
    
    // Redefinir função de fechar modal
    if (window.fecharModal) {
        const funcaoOriginalFechar = window.fecharModal;
        
        window.fecharModal = function(modalId) {
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
        };
    }
    
    window._modalCorrigido = true;
    console.log('Comportamento dos modais corrigido');
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('Aplicando modificações de layout vertical...');
    
    // Aplicar CSS
    injetarCSSVertical();
    
    // Adicionar botão de customização
    adicionarBotaoCustomizacao();
    
    // Modificar criação de cards
    modificarCriacaoCards();
    
    // Corrigir comportamento dos modais
    corrigirComportamentoModais();
    
    console.log('Todas as modificações de layout aplicadas');
});

// Também aplicar quando os resultados estiverem prontos
document.addEventListener('resultadosVoosProntos', function() {
    console.log('Resultados prontos, atualizando layout...');
    
    // Garantir que todas as modificações foram aplicadas
    injetarCSSVertical();
    adicionarBotaoCustomizacao();
    corrigirComportamentoModais();
    
    // Remover qualquer hint de swipe que possa existir
    const swipeHint = document.querySelector('.swipe-hint');
    if (swipeHint && swipeHint.parentNode) {
        swipeHint.parentNode.removeChild(swipeHint);
    }
});
