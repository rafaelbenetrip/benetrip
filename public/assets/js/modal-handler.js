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
        
        // Carregar os templates de modais (apenas modal de detalhes)
        document.getElementById('modal-container').innerHTML = `
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
            
            if (btnClicado.id === 'btn-fechar-detalhes' || btnClicado.id === 'btn-voltar-lista') {
                this.fecharModal('modal-detalhes-voo');
            } else if (btnClicado.id === 'btn-selecionar-este-voo') {
                this.selecionarVooDosDetalhes();
            }
        });
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
        
        // Redirecionar diretamente
        if (window.BENETRIP_REDIRECT && typeof window.BENETRIP_REDIRECT.processarConfirmacao === 'function') {
            window.BENETRIP_REDIRECT.processarConfirmacao(vooId);
        } else {
            // Fallback
            setTimeout(() => {
                window.location.href = 'hotels.html';
            }, 1500);
        }
    }
};

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    BENETRIP_MODAL.init();
});

// Expor funções globalmente
window.mostrarConfirmacaoSelecao = function() {
    console.log('Função de confirmação desativada - redirecionando diretamente');
    
    // Se temos BENETRIP_VOOS, pegamos o voo atual e processamos
    if (window.BENETRIP_VOOS) {
        const voo = window.BENETRIP_VOOS.vooSelecionado || window.BENETRIP_VOOS.vooAtivo;
        if (voo) {
            const vooId = voo.sign || `voo-idx-${window.BENETRIP_VOOS.indexVooAtivo}`;
            
            if (window.BENETRIP_REDIRECT && typeof window.BENETRIP_REDIRECT.processarConfirmacao === 'function') {
                window.BENETRIP_REDIRECT.processarConfirmacao(vooId);
            }
        }
    }
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
            console.log('Função de confirmação desativada - redirecionando diretamente');
            if (window.BENETRIP_REDIRECT && typeof window.BENETRIP_REDIRECT.processarConfirmacao === 'function') {
                window.BENETRIP_REDIRECT.processarConfirmacao(vooId);
            }
        };
    }
});
