/**
 * BENETRIP - Sistema de Chat
 * Controla a interação do chat com o usuário
 */

const BENETRIP_CHAT = {
    /**
     * Configuração do chat
     */
    config: {
        typingDelay: 50, // Delay em ms entre caracteres ao digitar
        messageDelay: 800, // Delay em ms entre mensagens
        imagePath: 'assets/images/',
    },

    /**
     * Inicializa o sistema de chat
     */
    init() {
        console.log("Sistema de chat inicializado");
        return this;
    },

    /**
     * Adiciona uma mensagem da Tripinha ao chat
     */
    addTripinhaMessage(text, options = {}) {
        return new Promise((resolve) => {
            // Criar elemento de mensagem
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message tripinha';
            
            // Definir o avatar baseado no estado (pensando ou normal)
            const avatarSrc = options.thinking ? 
                `${this.config.imagePath}tripinha/avatar-pensando.png` : 
                `${this.config.imagePath}tripinha/avatar-normal.png`;
            
            // HTML da mensagem
            messageDiv.innerHTML = `
                <div class="avatar">
                    <img src="${avatarSrc}" alt="Tripinha" />
                </div>
                <div class="message">
                    ${options.thinking ? 
                        '<div class="thinking-dots"><span></span><span></span><span></span></div>' : 
                        `<p>${text}</p>`}
                    ${options.html || ''}
                </div>
            `;
            
            // Adicionar ao chat
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.appendChild(messageDiv);
            
            // Rolar para a mensagem
            this.scrollToBottom();
            
            // Se estiver em modo "pensando", resolver a promessa imediatamente
            if (options.thinking) {
                resolve(messageDiv);
                return;
            }
            
            // Simular efeito de digitação se texto for string
            if (typeof text === 'string') {
                const paragraph = messageDiv.querySelector('p');
                const fullText = text;
                paragraph.textContent = '';
                
                // Efeito de digitação
                let i = 0;
                const typeWriter = () => {
                    if (i < fullText.length) {
                        paragraph.textContent += fullText.charAt(i);
                        i++;
                        setTimeout(typeWriter, this.config.typingDelay);
                    } else {
                        // Terminou de digitar, resolver a promessa
                        resolve(messageDiv);
                    }
                };
                
                typeWriter();
            } else {
                // Se não for texto simples, resolver imediatamente
                resolve(messageDiv);
            }
        });
    },

    /**
     * Adiciona uma mensagem do usuário ao chat
     */
    addUserMessage(text) {
        // Criar elemento de mensagem
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user';
        
        messageDiv.innerHTML = `
            <div class="message">
                <p>${text}</p>
            </div>
        `;
        
        // Adicionar ao chat
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.appendChild(messageDiv);
        
        // Rolar para a mensagem
        this.scrollToBottom();
        
        return messageDiv;
    },

    /**
     * Mostra a Tripinha "pensando"
     */
    showThinking() {
        return this.addTripinhaMessage('', { thinking: true });
    },

    /**
     * Esconde o indicador de "pensando"
     */
    hideThinking(thinkingElement) {
        if (thinkingElement && thinkingElement.parentNode) {
            thinkingElement.parentNode.removeChild(thinkingElement);
        }
    },

    /**
     * Rola o chat para a última mensagem
     */
    scrollToBottom() {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
};

// Exportar para namespace global
window.BENETRIP_CHAT = BENETRIP_CHAT;
