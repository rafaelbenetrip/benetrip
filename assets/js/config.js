/**
 * Configurações da Benetrip
 */
const BENETRIP_CONFIG = {
    // Armazenará as credenciais (valores padrão que serão usados apenas para desenvolvimento)
    credentials: {
        // Estas credenciais são placeholders para uso local - não são mais usadas em produção
        openAI: "sk-placeholder-for-development-only",
        unsplash: "placeholder-for-development-only",
        pexels: "placeholder-for-development-only",
        aviasales: {
            token: "placeholder-for-development-only",
            marker: "placeholder-for-development-only"
        }
    },
    initialized: false,
    
    // Inicializa o sistema de configuração
    init() {
        console.log("Inicializando configurações da Benetrip (modo seguro com Netlify Functions)");
        this.initialized = true;
        return this;
    }
};

// Exportar para namespace global
window.BENETRIP_CONFIG = BENETRIP_CONFIG;
