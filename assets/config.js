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
    
    // Carrega as chaves de API do localStorage ou do código
    loadApiKeys() {
        // Chaves da API
        this.credentials = {
            // Substitua estes valores pelas suas chaves reais
            openAI: "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",
            unsplash: "x8q70wHdUpQoKmNtBmhfEbatdsxyapgkUEBgxQav708", 
            pexels: "GtZcnoPlphF95dn7SsHt7FewD8YYlDQCkBK2vDD4Z7AUt5flGFFJwMEt",
            aviasales: {
                token: "e82f7d420689b6124dcfa5921a8c6934",
                marker: "604241"
            }
        };
        
        console.log("Credenciais carregadas");
    },
    
    // Obtém uma credencial específica
    getApiKey(service) {
        return this.credentials[service];
    }
};

// Exporta o módulo para uso global
window.BENETRIP_CONFIG = BENETRIP_CONFIG;
