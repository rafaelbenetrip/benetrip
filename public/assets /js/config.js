/**
 * Configurações da Benetrip
 */
// config.js linha ~5
const BENETRIP_CONFIG = {
    // Armazenará as credenciais
    credentials: {
        // ...
    },
    initialized: false,
    
    // URLs da API
    apiUrls: {
        production: {
            aiRecommend: '/.netlify/functions/ai-recommend',
            imageSearch: '/.netlify/functions/image-search',
            flightSearch: '/.netlify/functions/flight-search'
        },
        development: {
            aiRecommend: 'https://api.benetrip.com.br/netlify/ai-recommend', // URL do proxy
            imageSearch: 'https://api.benetrip.com.br/netlify/image-search',
            flightSearch: 'https://api.benetrip.com.br/netlify/flight-search'
        }
    },
    
    // Inicializa o sistema de configuração
    init() {
        console.log("Inicializando configurações da Benetrip (modo seguro com Netlify Functions)");
        
        // Detectar ambiente
        this.isProduction = !window.location.hostname.includes('localhost') && 
                            !window.location.hostname.includes('127.0.0.1');
                            
        console.log(`Ambiente detectado: ${this.isProduction ? 'Produção' : 'Desenvolvimento'}`);
        
        this.initialized = true;
        return this;
    },
    
    // Retorna a URL apropriada para o ambiente atual
    getApiUrl(endpoint) {
        const env = this.isProduction ? 'production' : 'development';
        return this.apiUrls[env][endpoint];
    }
};

// Exportar para namespace global
window.BENETRIP_CONFIG = BENETRIP_CONFIG;
