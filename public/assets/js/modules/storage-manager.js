// StorageManager - Módulo para gerenciamento de armazenamento local
(function() {
    'use strict';

    // Namespace global
    window.BenetripApp = window.BenetripApp || {};

    const StorageManager = {
        /**
         * Salva um valor no localStorage
         * @param {string} key - Chave para armazenamento
         * @param {*} value - Valor a ser armazenado (será convertido para JSON)
         */
        save: function(key, value) {
            try {
                const jsonValue = JSON.stringify(value);
                localStorage.setItem(`benetrip_${key}`, jsonValue);
                return true;
            } catch (error) {
                console.error('Erro ao salvar dados:', error);
                return false;
            }
        },

        /**
         * Recupera um valor do localStorage
         * @param {string} key - Chave para recuperação
         * @returns {*} Valor armazenado ou null se não existir
         */
        get: function(key) {
            try {
                const jsonValue = localStorage.getItem(`benetrip_${key}`);
                return jsonValue ? JSON.parse(jsonValue) : null;
            } catch (error) {
                console.error('Erro ao recuperar dados:', error);
                return null;
            }
        },

        /**
         * Remove um valor do localStorage
         * @param {string} key - Chave a ser removida
         */
        remove: function(key) {
            try {
                localStorage.removeItem(`benetrip_${key}`);
                return true;
            } catch (error) {
                console.error('Erro ao remover dados:', error);
                return false;
            }
        },

        /**
         * Limpa todos os dados da aplicação no localStorage
         */
        clear: function() {
            try {
                const allKeys = Object.keys(localStorage);
                const benetripKeys = allKeys.filter(key => key.startsWith('benetrip_'));
                
                benetripKeys.forEach(key => {
                    localStorage.removeItem(key);
                });
                
                return true;
            } catch (error) {
                console.error('Erro ao limpar dados:', error);
                return false;
            }
        }
    };

    // Expõe o módulo globalmente
    window.BenetripApp.StorageManager = StorageManager;
})();

