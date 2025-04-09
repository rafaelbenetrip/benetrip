/**
 * BENETRIP - Redirecionamento para compra de voos e página de hotéis
 */

// Objeto para gerenciar o redirecionamento
const BENETRIP_REDIRECT = {
    
    // Configurações
    config: {
        apiBase: 'https://api.travelpayouts.com/v1',
        marker: '604241', // Seu AffiliateMarker
        redirectTemplate: 'redirect.html'
    },
    
    /**
     * Inicializa os eventos de redirecionamento
     */
    init: function() {
        console.log('Inicializando handlers de redirecionamento de voos...');
        
        // Adiciona listener para o botão principal
        const btnSelecionar = document.querySelector('.btn-selecionar-voo');
        if (btnSelecionar) {
            btnSelecionar.addEventListener('click', this.handleBotaoSelecionar.bind(this));
        }
        
        // Adiciona listeners para botões nos cards
        document.addEventListener('click', (e) => {
            // Verificar se é um botão de "Escolher Este Voo"
            const btnCard = e.target.closest('.choose-flight-button, .voo-card button');
            if (btnCard) {
                const vooId = btnCard.dataset.vooId;
                if (vooId && window.BENETRIP_VOOS) {
                    e.preventDefault();
                    // Seleciona o voo e mostra confirmação
                    window.BENETRIP_VOOS.selecionarVoo(vooId);
                    this.mostrarConfirmacaoComRedirecionamento(vooId);
                }
            }
        });
        
        // Configura o modal de confirmação
        this.configurarModalConfirmacao();
    },
    
    /**
     * Trata o clique no botão principal de seleção
     */
    handleBotaoSelecionar: function(e) {
        e.preventDefault();
        
        if (!window.BENETRIP_VOOS) {
            console.error('Módulo BENETRIP_VOOS não disponível');
            return;
        }
        
        // Verifica se um voo foi selecionado
        const voo = window.BENETRIP_VOOS.vooSelecionado || window.BENETRIP_VOOS.vooAtivo;
        if (!voo) {
            alert('Por favor, selecione um voo primeiro');
            return;
        }
        
        const vooId = voo.sign || `voo-idx-${window.BENETRIP_VOOS.indexVooAtivo}`;
        this.mostrarConfirmacaoComRedirecionamento(vooId);
    },
    
    /**
     * Exibe o modal de confirmação e configura o redirecionamento
     */
    mostrarConfirmacaoComRedirecionamento: function(vooId) {
        // Se a função original mostrarConfirmacaoSelecao existir, usa ela
        if (typeof window.mostrarConfirmacaoSelecao === 'function') {
            window.mostrarConfirmacaoSelecao();
        } else if (window.BENETRIP_VOOS && typeof window.BENETRIP_VOOS.mostrarConfirmacaoSelecao === 'function') {
            window.BENETRIP_VOOS.mostrarConfirmacaoSelecao();
        } else {
            // Fallback caso a função não exista
            const modal = document.getElementById('modal-confirmacao');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.add('modal-active');
            }
        }
        
        // Configura o botão confirmar para redirecionar
        const btnConfirmar = document.getElementById('btn-confirmar');
        if (btnConfirmar) {
            // Remove event listeners anteriores
            const btnClone = btnConfirmar.cloneNode(true);
            btnConfirmar.parentNode.replaceChild(btnClone, btnConfirmar);
            
            // Adiciona novo event listener
            btnClone.addEventListener('click', () => {
                this.processarConfirmacao(vooId);
            });
        }
    },
    
    /**
     * Configura o comportamento do modal de confirmação
     */
    configurarModalConfirmacao: function() {
        // Checkbox de confirmação
        const checkbox = document.getElementById('confirmar-selecao');
        const btnConfirmar = document.getElementById('btn-confirmar');
        
        if (checkbox && btnConfirmar) {
            checkbox.addEventListener('change', function() {
                btnConfirmar.disabled = !this.checked;
            });
        }
        
        // Botão para fechar o modal
        const btnFechar = document.getElementById('btn-fechar-modal');
        if (btnFechar) {
            btnFechar.addEventListener('click', () => this.fecharModal('modal-confirmacao'));
        }
        
        // Botão para continuar buscando
        const btnContinuar = document.getElementById('btn-continuar-buscando');
        if (btnContinuar) {
            btnContinuar.addEventListener('click', () => this.fecharModal('modal-confirmacao'));
        }
    },
    
    /**
     * Processa a confirmação e redireciona o usuário
     */
    processarConfirmacao: function(vooId) {
        if (!window.BENETRIP_VOOS) {
            console.error('Módulo BENETRIP_VOOS não disponível');
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
        
        // Exibe indicador de carregamento no botão
        const btnConfirmar = document.getElementById('btn-confirmar');
        if (btnConfirmar) {
            btnConfirmar.innerHTML = '<span class="spinner"></span> Processando...';
            btnConfirmar.disabled = true;
        }
        
        // Salva os dados do voo selecionado
        this.salvarDadosVoo(voo);
        
        // Obtém o link de redirecionamento e processa
        this.obterLinkRedirecionamento(voo)
            .then(redirectData => {
                // Abre o link do parceiro em nova aba
                if (redirectData && redirectData.url) {
                    this.redirecionarParaParceiro(redirectData);
                } else {
                    console.error('Dados de redirecionamento inválidos', redirectData);
                }
                
                // Redireciona para a página de hotéis
                setTimeout(() => {
                    window.location.href = 'hotels.html';
                }, 1000);
            })
            .catch(error => {
                console.error('Erro ao obter link de redirecionamento:', error);
                alert('Ocorreu um erro ao processar sua solicitação. Tente novamente.');
                
                // Restaura o botão
                if (btnConfirmar) {
                    btnConfirmar.innerHTML = 'Confirmar e Prosseguir';
                    btnConfirmar.disabled = false;
                }
            });
    },
    
    /**
     * Salva os dados do voo selecionado
     */
    salvarDadosVoo: function(voo) {
        try {
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
            
            localStorage.setItem('benetrip_voo_selecionado', JSON.stringify(dadosVoo));
            console.log('Dados do voo salvos com sucesso');
            
        } catch (erro) {
            console.error('Erro ao salvar dados do voo:', erro);
        }
    },
    
    /**
     * Obtém o link de redirecionamento da API
     */
    obterLinkRedirecionamento: function(voo) {
        // Obter o search_id e o URL do termo dos dados do voo
        const searchId = window.BENETRIP_VOOS.searchId;
        
        // Encontrar o termo (url) do voo selecionado
        let termUrl = null;
        try {
            // Obter a primeira chave de voo.terms
            const termsKey = Object.keys(voo.terms)[0];
            termUrl = voo.terms[termsKey].url;
        } catch (e) {
            console.error('Erro ao obter URL do termo:', e);
        }
        
        if (!searchId || !termUrl) {
            console.error('searchId ou termUrl não disponíveis', { searchId, termUrl });
            return Promise.reject(new Error('Dados insuficientes para redirecionamento'));
        }
        
        // Construir URL da API
        const apiUrl = `${this.config.apiBase}/flight_searches/${searchId}/clicks/${termUrl}.json?marker=${this.config.marker}`;
        
        // PARA TESTE: se estamos em ambiente de desenvolvimento, simular resposta
        if (window.location.href.includes('localhost') || window.location.href.includes('127.0.0.1')) {
            console.log('Ambiente de desenvolvimento detectado, retornando URL simulada');
            return Promise.resolve({
                gate_id: 112,
                click_id: Date.now(),
                str_click_id: Date.now().toString(),
                url: "https://www.example.com/flights?mock=true",
                method: "GET",
                params: {}
            });
        }
        
        // Fazer a requisição à API
        return fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status}`);
                }
                return response.json();
            });
    },
    
    /**
     * Redireciona o usuário para o site do parceiro
     */
    redirecionarParaParceiro: function(redirectData) {
        if (redirectData.method === 'GET') {
            // Para método GET, simplesmente abre a URL em nova aba
            window.open(redirectData.url, '_blank');
        } else if (redirectData.method === 'POST') {
            // Para método POST, precisa criar um formulário
            this.redirecionarViaPost(redirectData);
        }
    },
    
    /**
     * Redireciona via POST usando um formulário dinâmico
     */
    redirecionarViaPost: function(redirectData) {
        // Cria um iframe oculto
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        // Cria o documento dentro do iframe
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        
        // Constrói o HTML do formulário
        let formHtml = `
            <form id="redirect_form" method="POST" action="${redirectData.url}" target="_blank">
        `;
        
        // Adiciona os campos do formulário
        for (const [key, value] of Object.entries(redirectData.params || {})) {
            formHtml += `<input type="hidden" name="${key}" value="${value}">`;
        }
        
        formHtml += `</form>
            <img width="0" height="0" id="pixel" src="//yasen.aviasales.com/adaptors/pixel_click.png?click_id=${redirectData.click_id}&gate_id=${redirectData.gate_id}">
            <script>
                document.getElementById('redirect_form').submit();
            </script>
        `;
        
        // Escreve e fecha o documento
        iframeDoc.write(formHtml);
        iframeDoc.close();
    },
    
    /**
     * Fecha um modal
     */
    fecharModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.remove('modal-active');
        
        setTimeout(() => {
            if (!modal.classList.contains('modal-active')) {
                modal.style.display = 'none';
            }
        }, 300);
    }
};

// Inicializa o redirecionamento quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    BENETRIP_REDIRECT.init();
});

// Também inicializa quando o módulo principal estiver carregado
if (window.BENETRIP_VOOS) {
    BENETRIP_REDIRECT.init();
} else {
    // Aguarda o carregamento do módulo principal
    document.addEventListener('resultadosVoosProntos', function() {
        BENETRIP_REDIRECT.init();
    });
}
