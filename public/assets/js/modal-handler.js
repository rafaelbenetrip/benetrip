/**
 * Modal Handler - Gerenciador unificado de modais para a Benetrip
 * Este arquivo centraliza toda a lógica relacionada aos modais para evitar conflitos
 */

// Namespace para gerenciamento de modais
const BENETRIP_MODAL = {
    // Estado dos modais
    modals: {
        confirmacao: {
            id: 'modal-confirmacao',
            isOpen: false,
            currentVooId: null
        },
        detalhes: {
            id: 'modal-detalhes-voo',
            isOpen: false,
            currentVooId: null
        }
    },
    
    /**
     * Inicializa o gerenciador de modais
     */
    init: function() {
        console.log('Inicializando gerenciador de modais...');
        this.carregarTemplates();
        this.configurarEventos();
    },
    
    /**
     * Carrega os templates HTML dos modais
     */
    carregarTemplates: function() {
        console.log('Carregando templates de modais...');
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) {
            const container = document.createElement('div');
            container.id = 'modal-container';
            document.body.appendChild(container);
            console.log('Container de modais criado');
        }
        
        // Carregar os templates de modais
        document.getElementById('modal-container').innerHTML = `
            <!-- Modal de confirmação -->
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
            
            <!-- Modal de detalhes de voo -->
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
        `;
        
        console.log('Templates de modais carregados');
    },
    
    /**
     * Configurar eventos dos modais
     */
    configurarEventos: function() {
        document.addEventListener('click', (e) => {
            // Fechar modal ao clicar fora
            if (e.target.classList.contains('modal-backdrop')) {
                const modalId = e.target.id;
                this.fecharModal(modalId);
            }
            
            // Botões específicos por delegação de eventos
            const btnClicado = e.target.closest('button');
            if (!btnClicado) return;
            
            if (btnClicado.id === 'btn-fechar-modal' || btnClicado.id === 'btn-continuar-buscando') {
                this.fecharModal('modal-confirmacao');
            } else if (btnClicado.id === 'btn-fechar-detalhes' || btnClicado.id === 'btn-voltar-lista') {
                this.fecharModal('modal-detalhes-voo');
            } else if (btnClicado.id === 'btn-confirmar') {
                this.processarConfirmacao();
            } else if (btnClicado.id === 'btn-selecionar-este-voo') {
                this.selecionarVooDosDetalhes();
            }
        });
        
        // Evento de mudança para checkbox
        document.addEventListener('change', (e) => {
            if (e.target.id === 'confirmar-selecao') {
                const btnConfirmar = document.getElementById('btn-confirmar');
                if (btnConfirmar) {
                    btnConfirmar.disabled = !e.target.checked;
                }
            }
        });
    },
    
    /**
     * Mostrar modal de confirmação
     */
    mostrarConfirmacao: function() {
        // Verificar se o módulo BENETRIP_VOOS está disponível
        if (!window.BENETRIP_VOOS) {
            console.error('Módulo BENETRIP_VOOS não disponível');
            return;
        }
        
        // Verificar se temos um voo selecionado
        const voo = window.BENETRIP_VOOS.vooSelecionado || window.BENETRIP_VOOS.vooAtivo;
        if (!voo) {
            console.error('Nenhum voo selecionado ou ativo');
            return;
        }
        
        // Guardar o ID do voo atual
        this.modals.confirmacao.currentVooId = voo.sign || `voo-idx-${window.BENETRIP_VOOS.indexVooAtivo}`;
        
        // Preparar dados para o modal
        const preco = window.BENETRIP_VOOS.obterPrecoVoo(voo);
        const moeda = window.BENETRIP_VOOS.finalResults?.meta?.currency || 'BRL';
        const precoFormatado = window.BENETRIP_VOOS.formatarPreco(preco, moeda);
        const numPassageiros = window.BENETRIP_VOOS.obterQuantidadePassageiros();
        const precoTotal = preco * numPassageiros;
        const precoTotalFormatado = window.BENETRIP_VOOS.formatarPreco(precoTotal, moeda);
        
        // Preencher resumo de valores
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
        
        // Resetar o checkbox
        const checkbox = document.getElementById('confirmar-selecao');
        if (checkbox) checkbox.checked = false;
        
        // Resetar o botão confirmar
        const btnConfirmar = document.getElementById('btn-confirmar');
        if (btnConfirmar) btnConfirmar.disabled = true;
        
        // Mostrar o modal
        this.abrirModal('modal-confirmacao');
    },
    
    /**
     * Processar a confirmação do voo
     */
    processarConfirmacao: function() {
        const vooId = this.modals.confirmacao.currentVooId;
        if (!vooId) {
            console.error('ID do voo não disponível para processamento');
            return;
        }
        
        // Atualizar UI
        const btnConfirmar = document.getElementById('btn-confirmar');
        if (btnConfirmar) {
            btnConfirmar.innerHTML = '<span class="spinner"></span> Processando...';
            btnConfirmar.disabled = true;
        }
        
        // Delegar para o módulo BENETRIP_REDIRECT se disponível
        if (window.BENETRIP_REDIRECT && typeof window.BENETRIP_REDIRECT.processarConfirmacao === 'function') {
            window.BENETRIP_REDIRECT.processarConfirmacao(vooId);
        } else {
            console.error('Módulo BENETRIP_REDIRECT não disponível para processamento');
            // Redirecionar para hotéis como fallback
            setTimeout(() => {
                window.location.href = 'hotels.html';
            }, 1500);
        }
    },
    
    /**
     * Abrir modal por ID
     */
    abrirModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal ${modalId} não encontrado`);
            return;
        }
        
        // Atualizar estado
        if (this.modals[modalId]) {
            this.modals[modalId].isOpen = true;
        }
        
        // Mostrar o modal com animação
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('modal-active');
        }, 10);
    },
    
    /**
     * Fechar modal por ID
     */
    fecharModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        // Atualizar estado
        if (this.modals[modalId]) {
            this.modals[modalId].isOpen = false;
        }
        
        // Fechar com animação
        modal.classList.remove('modal-active');
        setTimeout(() => {
            if (!modal.classList.contains('modal-active')) {
                modal.style.display = 'none';
            }
        }, 300);
    },
    
    /**
     * Selecionar voo a partir do modal de detalhes
     */
    selecionarVooDosDetalhes: function() {
        const vooId = this.modals.detalhes.currentVooId;
        if (!vooId || !window.BENETRIP_VOOS) return;
        
        // Fechar modal de detalhes
        this.fecharModal('modal-detalhes-voo');
        
        // Selecionar o voo
        window.BENETRIP_VOOS.selecionarVoo(vooId);
        
        // Mostrar modal de confirmação
        setTimeout(() => this.mostrarConfirmacao(), 350);
    }
};

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    BENETRIP_MODAL.init();
});

// Expor funções globalmente
window.mostrarConfirmacaoSelecao = function() {
    BENETRIP_MODAL.mostrarConfirmacao();
};

window.fecharModal = function(modalId) {
    BENETRIP_MODAL.fecharModal(modalId);
};

window.mostrarDetalhesVoo = function(vooId) {
    // Implementação simplificada
    BENETRIP_MODAL.modals.detalhes.currentVooId = vooId;
    BENETRIP_MODAL.abrirModal('modal-detalhes-voo');
};

// Garantir compatibilidade com código existente
document.addEventListener('DOMContentLoaded', function() {
    if (window.BENETRIP_VOOS) {
        window.BENETRIP_VOOS.mostrarModalConfirmacao = window.mostrarConfirmacaoSelecao;
    }
    
    if (window.BENETRIP_REDIRECT) {
        window.BENETRIP_REDIRECT.mostrarConfirmacaoComRedirecionamento = function(vooId) {
            BENETRIP_MODAL.modals.confirmacao.currentVooId = vooId;
            window.mostrarConfirmacaoSelecao();
        };
    }
});

// Garantir funcionamento do modal de confirmação
(function() {
  const garantirVisibilidadeModal = function() {
    const btnConfirmar = document.getElementById('btn-confirmar');
    if (btnConfirmar) {
      const novoBtn = btnConfirmar.cloneNode(true);
      btnConfirmar.parentNode.replaceChild(novoBtn, btnConfirmar);
      
      novoBtn.addEventListener('click', function() {
        const checkbox = document.getElementById('confirmar-selecao');
        if (checkbox && !checkbox.checked) {
          alert('Por favor, confirme sua seleção marcando a caixa');
          return;
        }
        
        this.innerHTML = '<span class="spinner"></span> Processando...';
        this.disabled = true;
        
        if (window.BENETRIP_REDIRECT && typeof window.BENETRIP_REDIRECT.processarConfirmacao === 'function') {
          let vooId = null;
          if (window.BENETRIP_VOOS) {
            const voo = window.BENETRIP_VOOS.vooSelecionado || window.BENETRIP_VOOS.vooAtivo;
            if (voo) {
              vooId = voo.sign || `voo-idx-${window.BENETRIP_VOOS.indexVooAtivo || 0}`;
            }
          }
经理          window.BENETRIP_REDIRECT.processarConfirmacao(vooId);
        } else {
          // Fallback
          setTimeout(() => {
            localStorage.setItem('benetrip_reserva_pendente', 'true');
            window.location.href = 'hotels.html';
          }, 2000);
        }
      });
    }
  };
  
  // Aplicar quando modal for aberto
  const originalMostrarConfirmacao = window.mostrarConfirmacaoSelecao;
  if (originalMostrarConfirmacao) {
    window.mostrarConfirmacaoSelecao = function() {
      originalMostrarConfirmacao.apply(this, arguments);
      setTimeout(garantirVisibilidadeModal, 100);
      
      // Garantir visibilidade do modal
      setTimeout(() => {
        const modal = document.getElementById('modal-confirmacao');
        if (modal) {
          modal.style.display = 'flex';
          modal.classList.add('modal-active');
        }
      }, 50);
    };
  }
})();
