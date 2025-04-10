/**
 * BENETRIP - Sistema de Redirecionamento para Parceiros de Voos
 * Versão: 2.0.0 (Otimizada e em conformidade com as diretrizes da API)
 */

/**
 * Módulo global de redirecionamento
 */
window.BENETRIP_REDIRECT = {
    // Configurações
    config: {
        apiBase: 'https://api.travelpayouts.com/v1',
        marker: '604241', // AffiliateMarker conforme documentação
        redirectTemplate: 'redirect.html',
        pixelTrackingUrl: '//yasen.aviasales.com/adaptors/pixel_click.png',
        linkLifetimeMs: 15 * 60 * 1000, // 15 minutos em milissegundos
        retryAttempts: 3,
        retryDelay: 1000,
        requestTimeout: 10000
    },
    
    /**
     * Inicializa o módulo de redirecionamento
     */
    init: function() {
        console.log('Inicializando sistema de redirecionamento de voos...');
        
        // Limpa dados anteriores
        this.clearCachedLinks();
        
        // Configura eventos básicos
        this.setupButtonListeners();
        this.setupCardListeners();
        
        // Notificar inicialização
        console.log('Sistema de redirecionamento inicializado com sucesso');
        document.dispatchEvent(new CustomEvent('benetrip_redirect_ready'));
    },
    
    /**
     * Configura event listeners para botões principais
     */
    setupButtonListeners: function() {
        // Botão principal de seleção
        const btnSelecionar = document.querySelector('.btn-selecionar-voo');
        if (btnSelecionar) {
            console.log('Botão principal encontrado, configurando listener');
            
            // Clone o botão para remover listeners antigos
            const btnClone = btnSelecionar.cloneNode(true);
            btnSelecionar.parentNode.replaceChild(btnClone, btnSelecionar);
            
            // Adiciona novo evento
            btnClone.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Botão principal de seleção clicado');
                
                // Verifica se um voo foi selecionado
                if (!window.BENETRIP_VOOS) {
                    console.error('Módulo BENETRIP_VOOS não disponível');
                    this.showErrorMessage('Sistema de voos não inicializado corretamente');
                    return;
                }
                
                const voo = window.BENETRIP_VOOS.vooSelecionado || window.BENETRIP_VOOS.vooAtivo;
                if (!voo) {
                    console.warn('Nenhum voo selecionado');
                    this.showErrorMessage('Por favor, selecione um voo primeiro');
                    return;
                }
                
                // Processa o voo selecionado
                const vooId = voo.sign || `voo-idx-${window.BENETRIP_VOOS.indexVooAtivo}`;
                this.processarConfirmacao(vooId);
            });
        } else {
            console.warn('Botão principal de seleção não encontrado');
        }
        
        // Botão de confirmação no modal (se existir)
        const btnConfirmar = document.getElementById('btn-confirmar');
        if (btnConfirmar) {
            console.log('Botão de confirmação encontrado, configurando listener');
            
            // Clone o botão para remover listeners antigos
            const btnClone = btnConfirmar.cloneNode(true);
            btnConfirmar.parentNode.replaceChild(btnClone, btnConfirmar);
            
            // Adiciona novo evento
            btnClone.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Botão de confirmação clicado');
                
                // Verifica checkbox
                const checkbox = document.getElementById('confirmar-selecao');
                if (checkbox && !checkbox.checked) {
                    this.showErrorMessage('Por favor, confirme sua seleção marcando a caixa');
                    return;
                }
                
                // Obtém o voo selecionado
                if (!window.BENETRIP_VOOS) {
                    console.error('Módulo BENETRIP_VOOS não disponível');
                    this.showErrorMessage('Sistema de voos não inicializado corretamente');
                    return;
                }
                
                const voo = window.BENETRIP_VOOS.vooSelecionado || window.BENETRIP_VOOS.vooAtivo;
                if (!voo) {
                    console.warn('Nenhum voo selecionado');
                    this.showErrorMessage('Nenhum voo selecionado para confirmação');
                    return;
                }
                
                // Atualiza visual do botão
                btnClone.innerHTML = '<span class="spinner"></span> Processando...';
                btnClone.disabled = true;
                
                // Processa o voo selecionado
                const vooId = voo.sign || `voo-idx-${window.BENETRIP_VOOS.indexVooAtivo}`;
                this.processarConfirmacao(vooId);
            });
        }
    },
    
    /**
     * Configura event listeners para cards de voos
     */
    setupCardListeners: function() {
        document.addEventListener('click', (e) => {
            // Verifica se é um botão de escolha de voo
            const btnCard = e.target.closest('.choose-flight-button, .voo-card button, .escolher-este-voo');
            if (btnCard) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Botão de card de voo clicado');
                const vooId = btnCard.dataset.vooId;
                
                if (vooId && window.BENETRIP_VOOS) {
                    // Seleciona o voo
                    window.BENETRIP_VOOS.selecionarVoo(vooId);
                    
                    // Processa a seleção
                    this.processarConfirmacao(vooId);
                } else {
                    console.warn('ID do voo não encontrado ou BENETRIP_VOOS indisponível');
                    this.showErrorMessage('Não foi possível identificar o voo selecionado');
                }
            }
        });
    },
    
    /**
     * Processa a confirmação do voo e redireciona para o parceiro
     * @param {string} vooId - ID do voo selecionado
     */
    processarConfirmacao: function(vooId) {
        console.log('Processando confirmação para voo:', vooId);
        
        // Verificações de voo
        if (!window.BENETRIP_VOOS) {
            console.error('Módulo BENETRIP_VOOS não disponível');
            this.showErrorMessage('Sistema de voos não inicializado corretamente');
            return;
        }
        
        // Encontra o voo pelo ID
        const voo = this.encontrarVooPorId(vooId);
        if (!voo) {
            console.error(`Voo com ID ${vooId} não encontrado`);
            this.showErrorMessage('Voo selecionado não encontrado');
            return;
        }
        
        // Verifica se o voo tem os dados necessários
        if (!voo.terms || !Object.keys(voo.terms).length) {
            console.error('Voo sem informações de termos necessárias para redirecionamento');
            this.showErrorMessage('Informações insuficientes para prosseguir com a reserva');
            return;
        }
        
        // Salva dados do voo
        try {
            this.salvarDadosVoo(voo);
        } catch (err) {
            console.warn('Erro ao salvar dados do voo:', err);
        }
        
        // IMPORTANTE: Abre nova janela antes do fetch (evita bloqueio de popups)
        console.log('Abrindo janela para redirecionamento...');
        const partnerWindow = window.open('about:blank', '_blank');
        
        // Verifica se a janela foi bloqueada
        if (!partnerWindow || partnerWindow.closed) {
            console.error('Popup bloqueado pelo navegador');
            this.showErrorMessage('A janela para o site do parceiro foi bloqueada. Por favor, permita popups para este site.');
            
            // Fallback para a página de hotéis
            this.redirecionarParaHoteis(3000);
            return;
        }
        
        // Exibe página de carregamento na nova janela
        this.mostrarPaginaCarregamento(partnerWindow);
        
        // Verifica se já temos o link em cache
        const linkCached = this.getCachedLink(vooId);
        if (linkCached && !this.isLinkExpired(linkCached)) {
            console.log('Link em cache encontrado e ainda válido, usando-o diretamente');
            this.redirecionarPartner(partnerWindow, linkCached);
            this.redirecionarParaHoteis(2000);
            return;
        }
        
        // Obtém o link de redirecionamento
        console.log('Obtendo link de redirecionamento da API...');
        this.obterLinkRedirecionamento(voo)
            .then(redirectData => {
                console.log('Link de redirecionamento obtido com sucesso:', 
                    redirectData.url ? redirectData.url.substring(0, 50) + '...' : 'N/A');
                
                // Salva o link em cache
                this.cacheLink(vooId, redirectData);
                
                // Redireciona para o parceiro
                this.redirecionarPartner(partnerWindow, redirectData);
                
                // Redireciona para hotéis após delay
                this.redirecionarParaHoteis(2000);
            })
            .catch(error => {
                console.error('Erro ao obter link de redirecionamento:', error);
                
                // Exibe erro na janela do parceiro
                this.mostrarErroNaJanela(partnerWindow, error.message || 'Erro ao processar redirecionamento');
                
                // Redireciona para hotéis após delay
                this.redirecionarParaHoteis(3000);
            });
    },
    
    /**
     * Encontra um voo pelo ID
     * @param {string} vooId - ID do voo
     * @returns {Object|null} Objeto do voo ou null se não encontrado
     */
    encontrarVooPorId: function(vooId) {
        if (!window.BENETRIP_VOOS?.finalResults?.proposals) {
            return null;
        }
        
        return window.BENETRIP_VOOS.finalResults.proposals.find(
            (v, index) => (v.sign || `voo-idx-${index}`) === vooId
        );
    },
    
    /**
     * Exibe uma mensagem de erro ao usuário
     * @param {string} message - Mensagem de erro
     */
    showErrorMessage: function(message) {
        if (typeof window.BENETRIP_VOOS?.exibirToast === 'function') {
            window.BENETRIP_VOOS.exibirToast(message, 'error');
        } else {
            alert(message);
        }
    },
    
    /**
     * Mostra uma página de carregamento na janela do parceiro
     * @param {Window} window - Referência à janela aberta
     */
    mostrarPaginaCarregamento: function(window) {
        if (!window || window.closed) return;
        
        try {
            const logoUrl = this.getAssetUrl('logo.png');
            window.document.write(`
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
                    <img src="${logoUrl}" alt="Benetrip" class="logo">
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
    },
    
    /**
     * Exibe mensagem de erro na janela do parceiro
     * @param {Window} window - Referência à janela aberta
     * @param {string} message - Mensagem de erro
     */
    mostrarErroNaJanela: function(window, message) {
        if (!window || window.closed) return;
        
        try {
            const logoUrl = this.getAssetUrl('logo.png');
            window.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Erro de Redirecionamento - Benetrip</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .error { color: #e74c3c; margin: 20px 0; padding: 15px; background-color: #fdf1f0; border-radius: 5px; }
                        .logo { max-width: 180px; margin-bottom: 30px; }
                    </style>
                </head>
                <body>
                    <img src="${logoUrl}" alt="Benetrip" class="logo">
                    <h2>Erro de Redirecionamento</h2>
                    <div class="error">${message}</div>
                    <p>Você pode fechar esta janela e continuar o processo de reserva na Benetrip.</p>
                    <button onclick="window.close()" style="padding: 10px 20px; background-color: #E87722; color: white; border: none; border-radius: 5px; cursor: pointer;">Fechar Janela</button>
                </body>
                </html>
            `);
        } catch (err) {
            console.error('Erro ao exibir mensagem de erro na janela:', err);
            try {
                window.close();
            } catch (closeErr) {
                console.error('Erro ao fechar janela:', closeErr);
            }
        }
    },
    
    /**
     * Redireciona a janela do parceiro para o destino
     * @param {Window} window - Referência à janela aberta
     * @param {Object} redirectData - Dados de redirecionamento
     */
    redirecionarPartner: function(window, redirectData) {
        if (!window || window.closed) {
            console.warn('Janela do parceiro foi fechada pelo usuário');
            return false;
        }
        
        try {
            if (redirectData.method === 'GET') {
                // Redirecionamento GET simples
                console.log('Redirecionando via GET para:', redirectData.url.substring(0, 50) + '...');
                window.location.href = redirectData.url;
                return true;
            } else if (redirectData.method === 'POST') {
                // Redirecionamento via página de redirecionamento para lidar com POST
                const redirectUrl = this.construirUrlRedirecao(redirectData);
                console.log('Redirecionando via POST para página intermediária');
                window.location.href = redirectUrl;
                return true;
            } else {
                console.error('Método de redirecionamento desconhecido:', redirectData.method);
                this.mostrarErroNaJanela(window, `Método de redirecionamento não suportado: ${redirectData.method}`);
                return false;
            }
        } catch (err) {
            console.error('Erro ao redirecionar para parceiro:', err);
            this.mostrarErroNaJanela(window, 'Erro ao redirecionar para o parceiro');
            return false;
        }
    },
    
    /**
     * Redireciona para a página de hotéis após um delay
     * @param {number} delay - Delay em milissegundos
     */
    redirecionarParaHoteis: function(delay = 2000) {
        console.log(`Redirecionando para hotéis em ${delay}ms...`);
        
        setTimeout(() => {
            try {
                localStorage.setItem('benetrip_reserva_pendente', 'true');
                window.location.href = 'hotels.html';
            } catch (err) {
                console.error('Erro ao redirecionar para hotéis:', err);
                // Tentativa direta
                window.location.href = 'hotels.html';
            }
        }, delay);
    },
    
    /**
     * Obtém o link de redirecionamento da API
     * @param {Object} voo - Objeto do voo
     * @returns {Promise<Object>} Dados de redirecionamento
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
    
    // ALTERAÇÃO CRÍTICA: Corrigir URL da API para ambiente de produção
    // Construir URL para API usando URL relativa ou API externa conforme ambiente
    let apiUrl;
    
    // Verificar se estamos em ambiente de desenvolvimento
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        apiUrl = `/api/flight-redirect?search_id=${encodeURIComponent(searchId)}&term_url=${encodeURIComponent(termUrl)}&marker=${encodeURIComponent(this.config.marker)}`;
        console.log('Usando endpoint de desenvolvimento:', apiUrl);
    } else {
        // SOLUÇÃO: Fazer a chamada diretamente para a API da Travelpayouts em produção
        apiUrl = `https://api.travelpayouts.com/v1/flight_searches/${encodeURIComponent(searchId)}/clicks/${encodeURIComponent(termUrl)}.json?marker=${encodeURIComponent(this.config.marker)}`;
        console.log('Usando endpoint de produção:', apiUrl);
    }

    console.log('Chamando API para redirecionamento:', apiUrl);
    
    // Implementa fetch com timeout para evitar bloqueio
    return new Promise((resolve, reject) => {
        // Configura timeout
        const timeoutId = setTimeout(() => {
            console.warn('Timeout ao obter link de redirecionamento');
            reject(new Error('Tempo limite excedido ao tentar obter link de redirecionamento'));
        }, 8000);
        
        // Faz a requisição
        fetch(apiUrl)
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Link de redirecionamento obtido com sucesso:', data);
                resolve(data);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                console.error('Erro ao obter link de redirecionamento:', error);
                reject(error);
            });
    });
},
    
    /**
     * Implementação robusta de fetch com retry e timeout
     * @param {string} url - URL para requisição
     * @param {number} maxRetries - Número máximo de tentativas
     * @param {number} retryDelay - Delay entre tentativas em ms
     * @param {number} timeoutMs - Timeout da requisição em ms
     * @returns {Promise<Object>} Dados da resposta
     */
    fetchWithRetry: function(url, maxRetries = 2, retryDelay = 1000, timeoutMs = 8000) {
        let attempts = 0;
        
        const attemptFetch = () => {
            attempts++;
            console.log(`Tentativa ${attempts}/${maxRetries+1} para: ${url}`);
            
            return new Promise((resolve, reject) => {
                // Configura timeout
                const controller = new AbortController();
                const signal = controller.signal;
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                
                fetch(url, { signal })
                    .then(response => {
                        clearTimeout(timeoutId);
                        
                        if (!response.ok) {
                            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                        }
                        
                        return response.json();
                    })
                    .then(data => {
                        // Validar resposta
                        if (!data || !data.url) {
                            throw new Error('Resposta inválida: URL de redirecionamento ausente');
                        }
                        
                        resolve(data);
                    })
                    .catch(error => {
                        clearTimeout(timeoutId);
                        
                        if (error.name === 'AbortError') {
                            console.error('Timeout excedido ao buscar link de redirecionamento');
                            reject(new Error('Tempo limite excedido ao buscar dados do parceiro'));
                        } else {
                            console.error(`Erro na tentativa ${attempts}:`, error);
                            
                            if (attempts <= maxRetries) {
                                setTimeout(() => attemptFetch().then(resolve).catch(reject), retryDelay);
                            } else {
                                reject(error);
                            }
                        }
                    });
            });
        };
        
        return attemptFetch();
    },
    
    /**
     * Construir URL para redirecionamento via página redirect.html
     * @param {Object} redirectData - Dados de redirecionamento
     * @returns {string} URL para redirecionamento
     */
    construirUrlRedirecao: function(redirectData) {
        // Codificar os parâmetros para URL
        const paramsEncoded = encodeURIComponent(JSON.stringify(redirectData.params || {}));
        const gateName = redirectData.gate_name || this.obterNomeAgencia(redirectData.gate_id) || 'Parceiro';
        
        // Construir URL para página redirect.html
        return `${this.config.redirectTemplate}?` +
               `click_id=${encodeURIComponent(redirectData.click_id || '')}&` +
               `gate_id=${encodeURIComponent(redirectData.gate_id || '')}&` +
               `url=${encodeURIComponent(redirectData.url)}&` +
               `method=${encodeURIComponent(redirectData.method)}&` +
               `params=${paramsEncoded}&` +
               `partner=${encodeURIComponent(gateName)}`;
    },
    
    /**
     * Obter nome da agência a partir do ID
     * @param {string|number} gateId - ID da agência
     * @returns {string} Nome da agência ou valor default
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
     * @param {Object} voo - Dados do voo
     */
    salvarDadosVoo: function(voo) {
        if (!window.BENETRIP_VOOS) {
            console.warn('BENETRIP_VOOS não disponível, não foi possível salvar dados completos do voo');
            localStorage.setItem('benetrip_voo_selecionado', JSON.stringify({
                voo,
                dataSelecao: new Date().toISOString()
            }));
            return;
        }
        
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
            // Tenta salvar versão simplificada
            localStorage.setItem('benetrip_voo_selecionado', JSON.stringify({
                voo,
                dataSelecao: new Date().toISOString()
            }));
        }
    },
    
    /**
     * Obtém URL de um asset
     * @param {string} filename - Nome do arquivo
     * @returns {string} URL completa do asset
     */
    getAssetUrl: function(filename) {
        try {
            return `${window.location.origin}/assets/images/${filename}`;
        } catch (e) {
            return `assets/images/${filename}`;
        }
    },
    
    /**
     * Coloca um link de redirecionamento em cache
     * @param {string} vooId - ID do voo
     * @param {Object} redirectData - Dados de redirecionamento
     */
    cacheLink: function(vooId, redirectData) {
        if (!vooId || !redirectData || !redirectData.url) return;
        
        try {
            const cacheItem = {
                data: redirectData,
                timestamp: Date.now(),
                expires: Date.now() + this.config.linkLifetimeMs
            };
            
            localStorage.setItem(`benetrip_redirect_${vooId}`, JSON.stringify(cacheItem));
            console.log(`Link para voo ${vooId} salvo em cache (válido por 15 minutos)`);
        } catch (err) {
            console.warn('Erro ao salvar link em cache:', err);
        }
    },
    
    /**
     * Obtém um link de redirecionamento do cache
     * @param {string} vooId - ID do voo
     * @returns {Object|null} Dados de redirecionamento ou null
     */
    getCachedLink: function(vooId) {
        if (!vooId) return null;
        
        try {
            const cacheJson = localStorage.getItem(`benetrip_redirect_${vooId}`);
            if (!cacheJson) return null;
            
            const cache = JSON.parse(cacheJson);
            if (!cache || !cache.data || !cache.expires) return null;
            
            // Verifica se não expirou
            if (cache.expires < Date.now()) {
                console.log(`Link em cache para voo ${vooId} expirou`);
                localStorage.removeItem(`benetrip_redirect_${vooId}`);
                return null;
            }
            
            console.log(`Link em cache para voo ${vooId} encontrado (expira em ${Math.round((cache.expires - Date.now()) / 1000)}s)`);
            return cache.data;
        } catch (err) {
            console.warn('Erro ao recuperar link do cache:', err);
            return null;
        }
    },
    
    /**
     * Verifica se um link está expirado
     * @param {Object} redirectData - Dados de redirecionamento
     * @returns {boolean} true se expirado, false caso contrário
     */
    isLinkExpired: function(redirectData) {
        // Links da API têm validade de 15 minutos
        // Verifica quando o link foi obtido através do timestamp do cache
        try {
            const cacheJson = localStorage.getItem(`benetrip_redirect_${redirectData.vooId}`);
            if (!cacheJson) return true;
            
            const cache = JSON.parse(cacheJson);
            if (!cache || !cache.timestamp) return true;
            
            const age = Date.now() - cache.timestamp;
            return age > this.config.linkLifetimeMs;
        } catch (err) {
            console.warn('Erro ao verificar expiração do link:', err);
            return true; // Em caso de dúvida, considera expirado
        }
    },
    
    /**
     * Limpa links em cache
     */
    clearCachedLinks: function() {
        try {
            const keysToRemove = [];
            
            // Encontra todas as chaves de links em cache
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('benetrip_redirect_')) {
                    keysToRemove.push(key);
                }
            }
            
            // Remove as chaves
            keysToRemove.forEach(key => localStorage.removeItem(key));
            
            if (keysToRemove.length > 0) {
                console.log(`${keysToRemove.length} links de redirecionamento removidos do cache`);
            }
        } catch (err) {
            console.warn('Erro ao limpar links em cache:', err);
        }
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
console.log('BENETRIP_REDIRECT carregado - Versão 2.0.0 (Otimizada e em conformidade com as diretrizes da API)');
