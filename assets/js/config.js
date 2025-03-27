/**
 * Gerenciamento de credenciais da Benetrip
 * Arquivo para produção - IMPORTANTE: Não compartilhe este arquivo com as chaves reais!
 */

const BENETRIP_CONFIG = {
    // Armazenará nossas credenciais
    credentials: {},
    
    // Inicializa o sistema de configuração
    init() {
        console.log("Carregando configurações...");
        this.loadApiKeys();
        return this;
    },
    
    // Carrega as chaves de API
    loadApiKeys() {
        // Chaves da API - IMPORTANTE: Use suas chaves reais aqui!
        this.credentials = {
            // Para OpenAI - chave formato: sk-... (não use o formato sk-proj-...)
            // A chave deve ser de uma conta ativa e com saldo
            openAI: "", // SUBSTITUA ESTA CHAVE
            
            // Para Unsplash
            unsplash: "", 
            
            // Para Pexels
            pexels: "",
            
            // Para Aviasales
            aviasales: {
                token: "",
                marker: ""
            }
        };
        
        console.log("Credenciais carregadas");
        
        // Verificar se as chaves existem
        this.validateKeys();
    },
    
    // Validar chaves
    validateKeys() {
        // Verificar especificamente a chave da OpenAI
        const openAIKey = this.credentials.openAI;
        
        if (!openAIKey || openAIKey === "") {
            console.error("ERRO: Chave OpenAI não configurada corretamente!");
            alert("ATENÇÃO: A chave da API OpenAI não está configurada. Por favor, edite o arquivo config.js e coloque sua chave real da OpenAI.");
        }
        
        // Verificar formato básico da chave
        if (openAIKey && !openAIKey.startsWith("sk-")) {
            console.error("ERRO: Formato da chave OpenAI parece incorreto. Deve começar com 'sk-'");
            alert("ATENÇÃO: O formato da chave OpenAI parece incorreto. Verifique se está usando uma chave atual da OpenAI.");
        }
    },
    
    // Obtém uma credencial específica
    getApiKey(service) {
        return this.credentials[service];
    }
};

// Exporta o módulo para uso global
window.BENETRIP_CONFIG = BENETRIP_CONFIG;
