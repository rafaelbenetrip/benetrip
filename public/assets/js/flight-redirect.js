/**
 * BENETRIP - Redirecionamento para compra de voos e página de hotéis
 * Versão corrigida para resolver problemas de redirecionamento
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
                    // Seleciona o voo e mostra confirmação
                    window.BENETRIP_VOOS.selecionarVoo(vooId);
                    this.mostrarConfirmacaoComRedirecionamento(vooId);
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
        
        // Configura o modal de confirmação
        this.configurarModalConfirmacao();
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
        
        const vooId = voo.sign || `voo-idx-${window.BENETRIP_VOOS.indexVooAtivo}`;
        this.mostrarConfirmacaoComRedirecionamento(vooId);
    },
    
    /**
     * Exibe o modal de confirmação e configura o redirecionamento
     */
    mostrarConfirmacaoComRedirecionamento: function(vooId) {
        console.log('Mostrando confirmação para voo:', vooId);
        
        try {
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
                    setTimeout(() => {
                        modal.classList.add('modal-active');
                    }, 10);
                } else {
                    console.error('Modal de confirmação não encontrado');
                }
            }
            
            // Configura o botão confirmar para redirecionar
            const btnConfirmar = document.getElementById('btn-confirmar');
            if (btnConfirmar) {
                console.log('Configurando botão de confirmação');
                // Remove event listeners anteriores
                const btnClone = btnConfirmar.cloneNode(true);
                btnConfirmar.parentNode.replaceChild(btnClone, btnConfirmar);
                
                // Adiciona novo event listener
                btnClone.addEventListener('click', () => {
                    console.log('Botão confirmar clicado para voo:', vooId);
                    this.processarConfirmacao(vooId);
                });
            } else {
                console.error('Botão de confirmação não encontrado');
            }
        } catch (error) {
            console.error('Erro ao mostrar confirmação:', error);
            // Fallback em caso de erro: processar diretamente
            this.processarConfirmacao(vooId);
        }
    },
    
    /**
     * Configura o comportamento do modal de confirmação
     */
    configurarModalConfirmacao: function() {
        try {
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
        } catch (error) {
            console.error('Erro ao configurar modal:', error);
        }
    },
    
    /**
     * Processa a confirmação e redireciona o usuário
     */
    processarConfirmacao: function(vooId) {
        console.log('Processando confirmação para voo:', vooId);
        
        if (!window.BENETRIP_VOOS) {
            console.error('Módulo BENETRIP_VOOS não disponível');
            window.location.href = 'hotels.html';
            return;
        }
        
        // Encontra o voo pelo ID
        const voo = window.BENETRIP_VOOS.finalResults?.proposals?.find(
            (v, index) => (v.sign || `voo-idx-${index}`) === vooId
        );
        
        if (!voo) {
            console.error(`Voo ${vooId} não encontrado`);
            window.location.href = 'hotels.html';
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
        
        // IMPORTANTE: Abrir nova janela antes do fetch (para evitar bloqueio de popups)
        // Janela em branco que será preenchida posteriormente com o link do parceiro
        const partnerWindow = window.open('about:blank', '_blank');
        
        // Obtém o link de redirecionamento e processa
        this.obterLinkRedirecionamento(voo)
            .then(redirectData => {
                console.log('Dados de redirecionamento recebidos:', redirectData);
                
                // Abre o link do parceiro na janela já aberta
                if (redirectData && redirectData.url) {
                    // Redirecionar a janela aberta para o URL do parceiro
                    if (partnerWindow && !partnerWindow.closed) {
                        if (redirectData.method === 'GET') {
                            partnerWindow.location.href = redirectData.url;
                        } else if (redirectData.method === 'POST') {
                            // Para POST, redirecionar para a página de redirecionamento
                            const redirectUrl = this.construirUrlRedirecao(redirectData);
                            partnerWindow.location.href = redirectUrl;
                        }
                    } else {
                        console.warn('Janela de parceiro foi fechada ou bloqueada');
                        // Tentar abrir novamente
                        this.redirecionarParaParceiro(redirectData);
                    }
                } else {
                    console.error('Dados de redirecionamento inválidos', redirectData);
                    if (partnerWindow && !partnerWindow.closed) {
                        partnerWindow.close();
                    }
                }
                
                // Redireciona para a página de hotéis após um delay maior
                setTimeout(() => {
                    window.location.href = 'hotels.html';
                }, 1500);
            })
            .catch(error => {
                console.error('Erro ao obter link de redirecionamento:', error);
                
                // Fecha a janela em branco se ocorrer um erro
                if (partnerWindow && !partnerWindow.closed) {
                    partnerWindow.close();
                }
                
                // Alerta o usuário e continua para hotéis
                alert('Ocorreu um erro ao processar a compra com o parceiro. Você será redirecionado para selecionar seu hotel.');
                
                // Restaura o botão
                if (btnConfirmar) {
                    btnConfirmar.innerHTML = 'Confirmar e Prosseguir';
                    btnConfirmar.disabled = false;
                }
                
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
 */
obterLinkRedirecionamento: function(voo) {
    console.log('Obtendo link de redirecionamento para voo:', voo.sign);
    
    // Obter o search_id e o URL do termo dos dados do voo
    const searchId = window.BENETRIP_VOOS.searchId;
    
    // Encontrar o termo (url) do voo selecionado
    let termUrl = null;
    try {
        // Obter a primeira chave de voo.terms
        const termsKey = Object.keys(voo.terms)[0];
        termUrl = voo.terms[termsKey].url;
        console.log('Term URL encontrada:', termUrl);
    } catch (e) {
        console.error('Erro ao obter URL do termo:', e);
    }
    
    if (!searchId || !termUrl) {
        console.error('searchId ou termUrl não disponíveis', { searchId, termUrl });
        return Promise.reject(new Error('Dados insuficientes para redirecionamento'));
    }
    
    // Em vez de chamar a API externa diretamente, chama o proxy da nossa API
    const apiUrl = `/api/flight-redirect?search_id=${encodeURIComponent(searchId)}&term_url=${encodeURIComponent(termUrl)}&marker=${encodeURIComponent(this.config.marker)}`;
    console.log('Chamando API proxy para redirecionamento:', apiUrl);
    
    // PARA TESTE: simular resposta em desenvolvimento
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
    
    // Fazer a requisição ao nosso proxy da API
    return fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status}`);
            }
            return response.json();
        });
},
        
        // Tenta fazer uma chamada JSONP para evitar problemas de CORS
        return this.fetchJsonp(apiUrl)
            .then(data => {
                console.log('Dados recebidos da API via JSONP:', data);
                return data;
            })
            .catch(error => {
                console.error('Erro no JSONP, tentando fetch normal:', error);
                
                // Tenta com fetch normal como fallback
                return fetch(apiUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Erro na requisição: ${response.status}`);
                        }
                        return response.json();
                    });
            });
    },
    
    /**
     * JSONP workaround para problemas de CORS
     */
    fetchJsonp: function(url) {
        return new Promise((resolve, reject) => {
            // Criar um ID único para a callback
            const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
            
            // Adicionar a callback ao objeto window
            window[callbackName] = function(data) {
                // Limpar o timeout
                clearTimeout(jsonpTimeout);
                
                // Remover o script
                document.body.removeChild(script);
                
                // Resolver a Promise com os dados
                resolve(data);
                
                // Limpar a função de callback
                delete window[callbackName];
            };
            
            // Adicionar o parâmetro de callback à URL
            const jsonpUrl = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
            
            // Criar e adicionar o script
            const script = document.createElement('script');
            script.src = jsonpUrl;
            script.onerror = function() {
                // Limpar o timeout
                clearTimeout(jsonpTimeout);
                
                // Remover o script
                document.body.removeChild(script);
                
                // Rejeitar a Promise
                reject(new Error('Erro ao carregar o script JSONP'));
                
                // Limpar a função de callback
                delete window[callbackName];
            };
            document.body.appendChild(script);
            
            // Configurar um timeout para rejeitar a Promise se demorar muito
            const jsonpTimeout = setTimeout(function() {
                // Remover o script
                if (script.parentNode) document.body.removeChild(script);
                
                // Rejeitar a Promise
                reject(new Error('Timeout para JSONP'));
                
                // Limpar a função de callback
                delete window[callbackName];
            }, 10000); // 10 segundos de timeout
        });
    },
    
    /**
     * Redireciona o usuário para o site do parceiro
     */
    redirecionarParaParceiro: function(redirectData) {
        console.log('Redirecionando para parceiro:', redirectData);
        
        try {
            if (redirectData.method === 'GET') {
                // Para método GET, simplesmente abre a URL em nova aba
                window.open(redirectData.url, '_blank');
            } else if (redirectData.method === 'POST') {
                // Para método POST, usa a página de redirecionamento
                const redirectUrl = this.construirUrlRedirecao(redirectData);
                window.open(redirectUrl, '_blank');
            }
        } catch (error) {
            console.error('Erro ao redirecionar para parceiro:', error);
        }
    },
    
    /**
     * Redireciona via POST usando um formulário dinâmico
     * (Mantido como fallback, mas substituído pelo método do redirect.html)
     */
    redirecionarViaPost: function(redirectData) {
        console.log('Redirecionando via POST:', redirectData);
        
        try {
            // Cria um iframe oculto
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.name = 'partner_iframe';
            document.body.appendChild(iframe);
            
            // Cria o formulário
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = redirectData.url;
            form.target = 'partner_iframe';
            
            // Adiciona os campos do formulário
            for (const [key, value] of Object.entries(redirectData.params || {})) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = value;
                form.appendChild(input);
            }
            
            // Adiciona o pixel de rastreamento
            const img = document.createElement('img');
            img.width = 0;
            img.height = 0;
            img.src = `//yasen.aviasales.com/adaptors/pixel_click.png?click_id=${redirectData.click_id}&gate_id=${redirectData.gate_id}`;
            form.appendChild(img);
            
            // Adiciona ao documento e submete
            document.body.appendChild(form);
            form.submit();
            
            console.log('Formulário POST submetido com sucesso');
        } catch (error) {
            console.error('Erro ao redirecionar via POST:', error);
        }
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
    BENETRIP_REDIRECT.init();
});

// Também inicializa quando o módulo principal estiver carregado
if (window.BENETRIP_VOOS) {
    console.log('BENETRIP_VOOS já disponível - Inicializando redirecionamento');
    BENETRIP_REDIRECT.init();
} else {
    // Aguarda o carregamento do módulo principal
    document.addEventListener('resultadosVoosProntos', function() {
        console.log('Evento resultadosVoosProntos recebido - Inicializando redirecionamento');
        BENETRIP_REDIRECT.init();
    });
}

// Reportar versão do script
console.log('BENETRIP_REDIRECT carregado - Versão 1.2');
