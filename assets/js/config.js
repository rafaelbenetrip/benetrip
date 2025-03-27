/**
 * Configurações da Benetrip
 */
const BENETRIP_CONFIG = {
    // Armazenará as credenciais
    credentials: {},
    
    // Inicializa o sistema de configuração
init() {
    console.log("Carregando configurações...");
    
    // Flag para rastrear inicialização
    this.initialized = true;
    
    // Tentar buscar de variáveis de ambiente do Netlify primeiro
    if (this.getNetlifyConfigKey()) {
        console.log("Chave API carregada das variáveis de ambiente do Netlify");
        return this;
    }
    
    // Buscar chave no localStorage
    const savedKey = localStorage.getItem('benetrip_openai_key');
    if (savedKey) {
        this.credentials = {
            openAI: savedKey,
            unsplash: 'x8q70wHdUpQoKmNtBmhfEbatdsxyapgkUEBgxQav708',
            pexels: 'GtZcnoPlphF95dn7SsHt7FewD8YYlDQCkBK2vDD4Z7AUt5flGFFJwMEt',
            aviasales: {
                token: 'e82f7d420689b6124dcfa5921a8c6934',
                marker: '604241'
            }
        };
        console.log("Chave OpenAI carregada do localStorage");
    } else {
        // Se não houver chave salva, exibir formulário
        this.showApiKeyForm();
    }
    
    return this;
},

// Método auxiliar para obter chaves API de variáveis de ambiente do Netlify
getNetlifyConfigKey() {
    try {
        // Verificar se estamos no Netlify e temos variáveis de ambiente
        if (window.ENV || 
            (typeof process !== 'undefined' && process.env) || 
            window.CLAUDE_API_KEY || 
            window.OPENAI_API_KEY || 
            window.AI_API_KEY) {
            
            // Obter a chave da API do ambiente
            const apiKey = window.ENV?.OPENAI_API_KEY || 
                           window.ENV?.CLAUDE_API_KEY || 
                           window.ENV?.AI_API_KEY ||
                           window.CLAUDE_API_KEY ||
                           window.OPENAI_API_KEY ||
                           window.AI_API_KEY ||
                           (process.env?.OPENAI_API_KEY) ||
                           (process.env?.CLAUDE_API_KEY);
            
            if (apiKey) {
                // Configurar credenciais
                this.credentials = {
                    openAI: apiKey,
                    unsplash: window.ENV?.UNSPLASH_ACCESS_KEY || 'x8q70wHdUpQoKmNtBmhfEbatdsxyapgkUEBgxQav708',
                    pexels: window.ENV?.PEXELS_API_KEY || 'GtZcnoPlphF95dn7SsHt7FewD8YYlDQCkBK2vDD4Z7AUt5flGFFJwMEt',
                    aviasales: {
                        token: window.ENV?.AVIASALES_TOKEN || 'e82f7d420689b6124dcfa5921a8c6934',
                        marker: window.ENV?.AVIASALES_MARKER || '604241'
                    }
                };
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error("Erro ao acessar variáveis de ambiente:", error);
        return false;
    }
},
    
    // Exibe formulário para entrada da chave API
    showApiKeyForm() {
        console.log("Exibindo formulário de configuração da API");
        
        // Verificar se o formulário já existe
        if (document.getElementById('api-key-form')) {
            document.getElementById('api-key-form').style.display = 'flex';
            return;
        }
        
        // Criar div para o formulário
        const formContainer = document.createElement('div');
        formContainer.id = 'api-key-form';
        formContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        
        // Criar conteúdo do formulário
        formContainer.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;">
                <h2 style="color: #E87722; margin-top: 0;">Configuração da API</h2>
                
                <p>Para usar as recomendações de destinos, precisamos da sua chave OpenAI:</p>
                
                <p style="font-size: 13px; color: #666;">
                    1. Acesse <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a><br>
                    2. Crie uma chave (ou use uma existente)<br>
                    3. Cole a chave abaixo
                </p>
                
                <input 
                    type="password" 
                    id="api-key-input" 
                    placeholder="Cole sua chave OpenAI (sk-...)" 
                    style="width: 100%; padding: 10px; margin: 15px 0; border: 1px solid #ddd; border-radius: 5px;"
                >
                
                <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                    <button 
                        id="save-api-key-btn" 
                        style="background: #E87722; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;"
                    >
                        Salvar Chave
                    </button>
                    
                    <button 
                        id="cancel-api-key-btn" 
                        style="background: #ccc; color: #333; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;"
                    >
                        Cancelar
                    </button>
                </div>
                
                <p style="font-size: 12px; color: #666; margin-top: 15px;">
                    Sua chave será salva apenas no seu navegador e nunca será enviada para nossos servidores.
                </p>
            </div>
        `;
        
        // Adicionar ao documento
        document.body.appendChild(formContainer);
        
        // Adicionar eventos
        document.getElementById('save-api-key-btn').addEventListener('click', () => {
            const key = document.getElementById('api-key-input').value;
            this.saveApiKey(key);
        });
        
        document.getElementById('cancel-api-key-btn').addEventListener('click', () => {
            formContainer.style.display = 'none';
        });
    },
    
    // Salva a chave API no localStorage
    saveApiKey(key) {
        if (!key) {
            alert('Por favor, insira uma chave API válida');
            return;
        }
        
        if (!key.startsWith('sk-')) {
            alert('A chave API deve começar com "sk-"');
            return;
        }
        
        // Salvar a chave
        localStorage.setItem('benetrip_openai_key', key);
        
        // Atualizar credenciais
        this.credentials.openAI = key;
        
        // Fechar o formulário
        document.getElementById('api-key-form').style.display = 'none';
        
        // Atualizar a página para carregar tudo com a nova chave
        alert('Chave API salva com sucesso! A página será recarregada.');
        location.reload();
    }
};

// Exportar para namespace global
window.BENETRIP_CONFIG = BENETRIP_CONFIG;
