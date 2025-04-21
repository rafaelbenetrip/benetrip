// EventEmitter - Módulo para gerenciamento de eventos personalizados
(function() {
    'use strict';

    // Namespace global
    window.BenetripApp = window.BenetripApp || {};

    const EventEmitter = {
        events: {},

        /**
         * Registra um manipulador de evento
         * @param {string} eventName - Nome do evento
         * @param {Function} handler - Função manipuladora
         */
        on: function(eventName, handler) {
            if (!this.events[eventName]) {
                this.events[eventName] = [];
            }
            this.events[eventName].push(handler);
        },

        /**
         * Remove um manipulador de evento
         * @param {string} eventName - Nome do evento
         * @param {Function} handler - Função a remover (ou null para remover todos)
         */
        off: function(eventName, handler) {
            if (!this.events[eventName]) return;
            
            if (!handler) {
                // Remove todos os manipuladores deste evento
                delete this.events[eventName];
                return;
            }
            
            // Remove apenas o manipulador específico
            this.events[eventName] = this.events[eventName].filter(
                h => h !== handler
            );
        },

        /**
         * Emite um evento com dados opcionais
         * @param {string} eventName - Nome do evento
         * @param {*} data - Dados a serem passados para os manipuladores
         */
        emit: function(eventName, data) {
            if (!this.events[eventName]) return;
            
            this.events[eventName].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Erro ao executar manipulador para evento ${eventName}:`, error);
                }
            });
        },

        /**
         * Registra um manipulador para ser executado apenas uma vez
         * @param {string} eventName - Nome do evento
         * @param {Function} handler - Função manipuladora
         */
        once: function(eventName, handler) {
            const onceHandler = (data) => {
                handler(data);
                this.off(eventName, onceHandler);
            };
            
            this.on(eventName, onceHandler);
        }
    };

    // Expõe o módulo globalmente
    window.BenetripApp.EventEmitter = EventEmitter;
})();
