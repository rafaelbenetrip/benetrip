/**
 * BENETRIP - Redirecionamento para compra de voos e página de hotéis
 * Versão corrigida para resolver problemas de redirecionamento
 * Data: 10/04/2025
 */

/**
 * IMPORTANTE: Garantir que BENETRIP_REDIRECT seja disponibilizado globalmente
 */

// Declaração explícita no escopo global
window.BENETRIP_REDIRECT = {
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
            console.log('Botão principal encontrado, configurando listener');
            // Clone o botão para remover listeners antigos
            const btnClone = btnSelecionar.cloneNode(true);
            btnSelecionar.parentNode.replaceChild(btnClone, btnSelecionar);
            btnClone.addEventListener('click', this.handleBotaoSelecionar.bind(this));
        } else {
            console.error('Botão principal não encontrado');
        }
        
        // Adiciona listeners para botões nos cards
        document.addEventListener('click', (e) => {
            // Verificar se é um botão de "Escolher Este Voo"
            const btnCard = e.target.closest('.choose-flight-button, .voo-card button, .escolher-este-voo');
            if (btnCard) {
                console.log('Clique em botão de card detectado:', btnCard);
                e.preventDefault();
                e.stopPropagation();
                
                const vooId = btnCard.dataset.vooId;
                if (vooId && window.BENETRIP_VOOS) {
                    // Seleciona o voo e processa diretamente
                    window.BENETRIP_VOOS.selecionarVoo(vooId);
                    this.processarConfirmacao(vooId);
                } else {
                    console.log('ID do voo não encontrado ou BENETRIP_VOOS indisponível');
                    // Fallback: redirecionamento direto
                    const voo = window.BENETRIP_VOOS?.vooAtivo || window.BENETRIP_VOOS?.finalResults?.proposals?.[0];
                    if (voo) {
                        this.processarConfirmacao(voo.sign || 'voo-0');
                    } else {
                        // Último recurso: ir direto para hotéis
                        window.location.href = 'hotels.html';
                    }
                }
            }
        });
        
        // Notificar que a inicialização foi concluída
        console.log('BENETRIP_REDIRECT inicializado com sucesso e disponível globalmente');
        
        // Simular um "ready event" para notificar que o módulo está pronto
        document.dispatchEvent(new CustomEvent('benetrip_redirect_ready'));
    },
    
    /**
     * Trata o clique no botão principal de seleção
     */
    handleBotaoSelecionar: function(e) {
        console.log('Botão principal clicado');
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        if (!window.BENETRIP_VOOS) {
            console.error('Módulo BENETRIP_VOOS não disponível');
            // Fallback: ir direto para hotéis
            window.location.href = 'hotels.html';
            return;
        }
        
        // Verifica se um voo foi selecionado
        const voo = window.BENETRIP_VOOS.vooSelecionado || window.BENETRIP_VOOS.vooAtivo;
        if (!voo) {
            console.warn('Nenhum voo selecionado');
            alert('Por favor, selecione um voo primeiro');
            return;
        }
        
        // Processar diretamente, sem mostrar o modal de confirmação
        const vooId = voo.sign || `voo-idx-${window.BENETRIP_VOOS.indexVooAtivo}`;
        this.processarConfirmacao(vooId);
    },
    
    /**
     * Processa a confirmação e redireciona o usuário
     * Versão simplificada e mais robusta
     */
    processarConfirmacao: function(vooId) {
        console.log('Processando confirmação para voo:', vooId);
        
        // MODIFICAÇÃO: Sempre tratar como se temos objeto local BENETRIP_VOOS para fallback
        const localBeneTripVoos = window.BENETRIP_VOOS;
        
        // Encontra o voo pelo ID (com mais proteções contra falhas)
        let voo;
        if (localBeneTripVoos && localBeneTripVoos.finalResults && localBeneTripVoos.finalResults.proposals) {
            voo = localBeneTripVoos.finalResults.proposals.find(
                (v, index) => (v.sign || `voo-idx-${index}`) === vooId
            );
        }
        
        // Se não encontrou pelos proposals, tenta outros lugares
        if (!voo) {
            voo = localBeneTripVoos?.vooSelecionado || localBeneTripVoos?.vooAtivo;
        }
        
        // Se mesmo assim não encontrou, cria um mock para evitar erro
        if (!voo) {
            console.warn(`Voo ${vooId} não encontrado, usando mock para evitar erro`);
            voo = {
                sign: vooId || 'mock-voo',
                terms: {'default': {url: '123456'}}
            };
        }
        
        // Exibe indicador de carregamento no botão
        const btnConfirmar = document.getElementById('btn-confirmar');
        if (btnConfirmar) {
            btnConfirmar.innerHTML = '<span class="spinner"></span> Processando...';
            btnConfirmar.disabled = true;
        }
        
        // Tenta salvar dados do voo, mas não falha se erro
        try {
            if (localBeneTripVoos) {
                this.salvarDadosVoo(voo);
            }
        } catch (err) {
            console.warn('Erro ao salvar dados do voo (não crítico):', err);
        }
        
        // IMPORTANTE: Abrir nova janela antes do fetch (para evitar bloqueio de popups)
        console.log('Abrindo janela para redirecionamento...');
        const partnerWindow = window.open('about:blank', '_blank');
        
        // Se a janela foi bloqueada, notificar
        if (!partnerWindow || partnerWindow.closed) {
            console.error('Popup bloqueado pelo navegador');
            alert('A janela para o site do parceiro foi bloqueada. Por favor, permita popups para este site.');
            
            // Redirecionar para hotéis como fallback
            setTimeout(() => {
                window.location.href = 'hotels.html';
            }, 1000);
            return;
        }
        
        // Exibir página de carregamento na nova janela
        try {
            partnerWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Redirecionando para parceiro - Benetrip</title>
                    <style>
                        body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; flex-direction: column; }
                        .progress { width: 80%; height: 20px; background-color: #f3f3f3; border-radius: 10px; margin: 20px 0; overflow: hidden; }
                        .bar { height: 100%; width: 0; background-color: #E87722; animation: fill 3s linear forwards; }
                        @keyframes fill { to { width: 100%; } }
                        .message { text-align: center; max-width: 80%; }
                        .logo { max-width: 200px; margin-bottom: 20px; }
                    </style>
                </head>
                <body>
                    <img src="${window.location.origin}/assets/images/logo.png" alt="Benetrip" class="logo">
                    <div class="message">
                        <h2>Redirecionando para parceiro Benetrip</h2>
                        <p>Você está sendo redirecionado para o site do parceiro para finalizar sua reserva de voo.</p>
                        <p>Por favor, <strong>não feche</strong> esta janela até ser redirecionado.</p>
                    </div>
                    <div class="progress">
                        <div class="bar"></div>
                    </div>
                </body>
                </html>
            `);
        } catch (err) {
            console.error('Erro ao escrever na janela do parceiro:', err);
        }
        
        // Obtém o link de redirecionamento
        console.log('Obtendo link de redirecionamento...');
        this.obterLinkRedirecionamento(voo)
            .then(redirectData => {
                console.log('Dados de redirecionamento recebidos:', redirectData);
                
                if (redirectData && redirectData.url) {
                    // Redirecionar a janela aberta para o URL do parceiro
                    if (partnerWindow && !partnerWindow.closed) {
                        console.log('Redirecionando janela para:', 
                            redirectData.method === 'GET' ? redirectData.url : 'página de redirect (POST)');
                        
                        try {
                            if (redirectData.method === 'GET') {
                                partnerWindow.location.href = redirectData.url;
                            } else if (redirectData.method === 'POST') {
                                // Para POST, redirecionar para a página de redirecionamento
                                const redirectUrl = this.construirUrlRedirecao(redirectData);
                                partnerWindow.location.href = redirectUrl;
                            }
                        } catch (err) {
                            console.error('Erro ao redirecionar janela:', err);
                            
                            // Tentar escrever formulário diretamente na janela aberta
                            try {
                                partnerWindow.document.write(`
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                        <title>Redirecionando...</title>
                                    </head>
                                    <body>
                                        <h2>Redirecionando para o parceiro...</h2>
                                        <form id="redirectForm" method="${redirectData.method}" action="${redirectData.url}">
                                        </form>
                                        <script>
                                            document.getElementById('redirectForm').submit();
                                        </script>
                                    </body>
                                    </html>
                                `);
                            } catch (err2) {
                                console.error('Tentativa de fallback também falhou:', err2);
                            }
                        }
                    } else {
                        console.warn('Janela do parceiro foi fechada pelo usuário');
                        alert('A janela do parceiro foi fechada. Você será redirecionado para a página de hotéis.');
                    }
                } else {
                    console.error('Dados de redirecionamento inválidos', redirectData);
                    if (partnerWindow && !partnerWindow.closed) {
                        // Exibir mensagem de erro na janela aberta
                        try {
                            partnerWindow.document.write(`
                                <!DOCTYPE html>
                                <html>
                                <head>
                                    <title>Erro de Redirecionamento - Benetrip</title>
                                    <style>
                                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                                        .error { color: #e74c3c; margin: 20px 0; }
                                    </style>
                                </head>
                                <body>
                                    <h2>Erro de Redirecionamento</h2>
                                    <p class="error">Não foi possível obter os dados para redirecionamento.</p>
                                    <p>Você pode fechar esta janela e continuar o processo de reserva na Benetrip.</p>
                                    <button onclick="window.close()">Fechar Janela</button>
                                </body>
                                </html>
                            `);
                        } catch (err) {
                            console.error('Erro ao exibir mensagem de erro na janela:', err);
                            partnerWindow.close();
                        }
                    }
                }
                
                // Redireciona para a página de hotéis após um delay
                setTimeout(() => {
                    window.location.href = 'hotels.html';
                }, 2000);
            })
            .catch(error => {
                console.error('Erro ao obter link de redirecionamento:', error);
                
                // Exibir mensagem de erro na janela aberta
                if (partnerWindow && !partnerWindow.closed) {
                    try {
                        partnerWindow.document.write(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>Erro de Redirecionamento - Benetrip</title>
                                <style>
                                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                                    .error { color: #e74c3c; margin: 20px 0; }
                                </style>
                            </head>
                            <body>
                                <h2>Erro de Redirecionamento</h2>
                                <p class="error">Ocorreu um erro ao processar o redirecionamento para o parceiro.</p>
                                <p>Erro: ${error.message || 'Erro desconhecido'}</p>
                                <p>Você pode fechar esta janela e continuar o processo de reserva na Benetrip.</p>
                                <button onclick="window.close()">Fechar Janela</button>
                            </body>
                            </html>
                        `);
                    } catch (err) {
                        console.error('Erro ao exibir mensagem de erro na janela:', err);
                        partnerWindow.close();
                    }
                }
                
                // Restaura o botão
                if (btnConfirmar) {
                    btnConfirmar.innerHTML = 'Confirmar e Prosseguir';
                    btnConfirmar.disabled = false;
                }
                
                // Mostrar alerta
                alert('Ocorreu um erro ao processar a reserva com o parceiro. Você será redirecionado para selecionar seu hotel.');
                
                // Redireciona para a página de hotéis mesmo em caso de erro
                setTimeout(() => {
                    window.location.href = 'hotels.html';
                }, 1000);
            });
    },
    
    /**
     * Construir URL para a página de redirecionamento
     */
    construirUrlRedirecao: function(redirectData) {
        // Codificar os parâmetros para URL
        const paramsEncoded = encodeURIComponent(JSON.stringify(redirectData.params || {}));
        const gateName = redirectData.gate_name || this.obterNomeAgencia(redirectData.gate_id) || 'Parceiro';
        
        // Construir URL para página redirect.html
        return `${this.config.redirectTemplate}?` +
               `click_id=${redirectData.click_id || ''}&` +
               `gate_id=${redirectData.gate_id || ''}&` +
               `url=${encodeURIComponent(redirectData.url)}&` +
               `method=${redirectData.method}&` +
               `params=${paramsEncoded}&` +
               `partner=${encodeURIComponent(gateName)}`;
    },
    
    /**
     * Obter nome da agência a partir do ID
     */
    obterNomeAgencia: function(gateId) {
        if (!gateId) return 'Parceiro';
        
        // Tenta obter do objeto BENETRIP_VOOS
        const gateInfo = window.BENETRIP_VOOS?.accumulatedGatesInfo?.[gateId] || 
                         window.BENETRIP_VOOS?.finalResults?.gates_info?.[gateId];
        
        return gateInfo?.label || `Agência ${gateId}`;
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
     * VERSÃO CORRIGIDA: Acessa diretamente a API Travelpayouts em produção
     */
    obterLinkRedirecionamento: function(voo) {
        console.log('Obtendo link de redirecionamento para voo:', voo.sign);
        
        // Obter o search_id e o URL do termo dos dados do voo
        const searchId = window.BENETRIP_VOOS?.searchId;
        
        // Encontrar o termo (url) do voo selecionado
        let termUrl = null;
        try {
            // Obter a primeira chave de voo.terms
            if (voo.terms) {
                const termsKey = Object.keys(voo.terms)[0];
                termUrl = voo.terms[termsKey].url;
                console.log('Term URL encontrada:', termUrl);
            }
        } catch (e) {
            console.error('Erro ao obter URL do termo:', e);
        }
        
        // Validação básica dos dados necessários
        if (!searchId || !termUrl) {
            return Promise.reject(new Error('Dados insuficientes para obter link de redirecionamento (searchId ou termUrl ausentes)'));
        }
        
        // Determinar o endpoint correto baseado no ambiente
        let apiUrl;
        
        // Em ambiente de desenvolvimento, usa o endpoint local
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            apiUrl = `/api/flight-redirect?search_id=${encodeURIComponent(searchId)}&term_url=${encodeURIComponent(termUrl)}&marker=${encodeURIComponent(this.config.marker)}`;
            console.log('Ambiente de desenvolvimento, usando API local:', apiUrl);
        } 
        // Em ambiente de produção, chama diretamente a API da Travelpayouts
        else {
            apiUrl = `https://api.travelpayouts.com/v1/flight_searches/${encodeURIComponent(searchId)}/clicks/${encodeURIComponent(termUrl)}.json?marker=${encodeURIComponent(this.config.marker)}`;
            console.log('Ambiente de produção, acessando API Travelpayouts diretamente:', apiUrl);
        }
        
        // Implementa fetch com timeout e retry para maior confiabilidade
        return this.fetchWithRetry(apiUrl, 2, 1000);
    },
    
    /**
     * Implementação de fetch com retry para maior confiabilidade
     */
    fetchWithRetry: function(url, maxRetries = 3, retryDelay = 1000) {
        console.log(`Tentativa de fetch para: ${url}`);
        let attempts = 0;
        
        const attemptFetch = () => {
            attempts++;
            console.log(`Tentativa ${attempts}/${maxRetries+1} para obter link`);
            
            return new Promise((resolve, reject) => {
                // Configura timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                    console.warn('Fetch timeout atingido');
                }, 8000);
                
                // Executa fetch com timeout
                fetch(url, {
                    signal: controller.signal,
                    method: 'GET',
                    credentials: 'omit',
                    headers: {
                        'Accept': 'application/json'
                    }
                })
                .then(response => {
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        console.error(`Resposta com erro ${response.status}: ${response.statusText}`);
                        throw new Error(`Erro ${response.status} ao obter link de redirecionamento`);
                    }
                    
                    return response.json();
                })
                .then(data => {
                    // Valida a resposta - deve ter URL
                    if (!data || typeof data !== 'object' || !data.url) {
                        console.error('Resposta recebida sem URL:', data);
                        throw new Error('Resposta inválida da API: URL ausente');
                    }
                    
                    // Log do sucesso
                    console.log(`Link obtido com sucesso. Método: ${data.method || 'GET'}`);
                    resolve(data);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    
                    // Verifica se é um erro de timeout
                    if (error.name === 'AbortError') {
                        console.error('Timeout ao tentar obter link');
                        error.message = 'Tempo limite excedido ao tentar obter link de redirecionamento';
                    }
                    
                    // Decide se tenta novamente
                    if (attempts <= maxRetries) {
                        console.warn(`Erro na tentativa ${attempts}, tentando novamente após ${retryDelay}ms:`, error.message);
                        setTimeout(() => {
                            attemptFetch()
                                .then(resolve)
                                .catch(reject);
                        }, retryDelay);
                    } else {
                        console.error(`Falha após ${attempts} tentativas:`, error);
                        reject(error);
                    }
                });
            });
        };
        
        return attemptFetch();
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
    console.log('DOM carregado - Inicializando BENETRIP_REDIRECT');
    window.BENETRIP_REDIRECT.init();
});

// Também inicializa quando o módulo principal estiver carregado
if (window.BENETRIP_VOOS) {
    console.log('BENETRIP_VOOS já disponível - Inicializando redirecionamento');
    window.BENETRIP_REDIRECT.init();
} else {
    // Aguarda o carregamento do módulo principal
    document.addEventListener('resultadosVoosProntos', function() {
        console.log('Evento resultadosVoosProntos recebido - Inicializando redirecionamento');
        window.BENETRIP_REDIRECT.init();
    });
}

// Reportar versão do script
console.log('BENETRIP_REDIRECT carregado - Versão 2.0 (Correção Acesso Direto API)');

// Muito importante: tornar a função disponível globalmente
console.log('Garantindo acesso global a BENETRIP_REDIRECT:', typeof window.BENETRIP_REDIRECT);
