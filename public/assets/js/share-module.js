/**
 * BENETRIP - Módulo de Compartilhamento de Destinos
 * Versão 1.0 - Sistema de compartilhamento personalizado
 * 
 * Funcionalidades:
 * - Compartilhamento de todos os destinos
 * - Compartilhamento da escolha TOP
 * - Compartilhamento do destino surpresa
 * - Mensagens personalizadas por perfil
 * - Suporte para múltiplas plataformas
 */

const BenetripShare = {
    // Configuração
    config: {
        baseUrl: 'https://benetrip.com.br',
        utm: {
            source: 'share',
            medium: 'social',
            campaign: 'destinos_personalizados'
        },
        maxMessageLength: {
            twitter: 280,
            whatsapp: 1000,
            facebook: 500
        }
    },

    // Dados do usuário e destinos
    userData: null,
    destinations: null,
    
    // Inicialização
    init() {
        console.log('🚀 Inicializando módulo de compartilhamento...');
        
        this.loadUserData();
        this.loadDestinations();
        this.setupShareButtons();
        this.injectShareUI();
        
        // Adicionar listener para mudanças nos dados
        document.addEventListener('benetrip_destinos_loaded', (e) => {
            this.destinations = e.detail;
            this.updateShareButtons();
        });
    },

    // Carregar dados do usuário
    loadUserData() {
        try {
            const storedData = localStorage.getItem('benetrip_user_data');
            if (storedData) {
                this.userData = JSON.parse(storedData);
                console.log('📋 Dados do usuário carregados:', this.userData);
            }
        } catch (error) {
            console.error('Erro ao carregar dados do usuário:', error);
        }
    },

    // Carregar destinos recomendados
    loadDestinations() {
        try {
            const storedDestinations = localStorage.getItem('benetrip_recomendacoes');
            if (storedDestinations) {
                this.destinations = JSON.parse(storedDestinations);
                console.log('🗺️ Destinos carregados:', this.destinations);
            }
        } catch (error) {
            console.error('Erro ao carregar destinos:', error);
        }
    },

    // Injetar UI de compartilhamento na página
    injectShareUI() {
        // Botão flutuante de compartilhamento
        const floatingButton = document.createElement('div');
        floatingButton.id = 'share-floating-button';
        floatingButton.className = 'share-floating-button';
        floatingButton.innerHTML = `
            <button class="share-fab" aria-label="Compartilhar destinos">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
            </button>
        `;
        document.body.appendChild(floatingButton);

        // Modal de compartilhamento
        const modal = document.createElement('div');
        modal.id = 'share-modal';
        modal.className = 'share-modal hidden';
        modal.innerHTML = this.generateModalContent();
        document.body.appendChild(modal);

        // Event listeners
        floatingButton.addEventListener('click', () => this.openShareModal());
        
        // Fechar modal ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeShareModal();
            }
        });
    },

    // Gerar conteúdo do modal
    generateModalContent() {
        return `
            <div class="share-modal-content">
                <div class="share-modal-header">
                    <h3>Compartilhe sua Aventura! 🐾</h3>
                    <button class="share-modal-close" onclick="BenetripShare.closeShareModal()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <div class="share-modal-body">
                    <!-- Opções de compartilhamento -->
                    <div class="share-options">
                        <!-- Compartilhar todos os destinos -->
                        <div class="share-option-card">
                            <div class="share-option-header">
                                <span class="share-option-icon">🌍</span>
                                <h4>Todos os Destinos</h4>
                            </div>
                            <p class="share-option-description">
                                Compartilhe todas as sugestões personalizadas da Tripinha
                            </p>
                            <div class="share-buttons">
                                <button class="share-btn whatsapp" onclick="BenetripShare.shareAllDestinations('whatsapp')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.149-.67.149-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.123-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                    </svg>
                                    WhatsApp
                                </button>
                                <button class="share-btn twitter" onclick="BenetripShare.shareAllDestinations('twitter')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                    </svg>
                                    X
                                </button>
                                <button class="share-btn facebook" onclick="BenetripShare.shareAllDestinations('facebook')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                    </svg>
                                    Facebook
                                </button>
                                <button class="share-btn copy" onclick="BenetripShare.shareAllDestinations('copy')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    Copiar
                                </button>
                            </div>
                        </div>

                        <!-- Compartilhar escolha TOP -->
                        <div class="share-option-card">
                            <div class="share-option-header">
                                <span class="share-option-icon">⭐</span>
                                <h4>Escolha TOP da Tripinha</h4>
                            </div>
                            <p class="share-option-description">
                                Compartilhe apenas o destino principal recomendado
                            </p>
                            <div class="share-buttons">
                                <button class="share-btn whatsapp" onclick="BenetripShare.shareTopPick('whatsapp')">
                                    WhatsApp
                                </button>
                                <button class="share-btn twitter" onclick="BenetripShare.shareTopPick('twitter')">
                                    X
                                </button>
                                <button class="share-btn facebook" onclick="BenetripShare.shareTopPick('facebook')">
                                    Facebook
                                </button>
                                <button class="share-btn copy" onclick="BenetripShare.shareTopPick('copy')">
                                    Copiar
                                </button>
                            </div>
                        </div>

                        <!-- Compartilhar destino surpresa -->
                        <div class="share-option-card">
                            <div class="share-option-header">
                                <span class="share-option-icon">🎲</span>
                                <h4>Destino Surpresa</h4>
                            </div>
                            <p class="share-option-description">
                                Compartilhe o destino especial e inesperado
                            </p>
                            <div class="share-buttons">
                                <button class="share-btn whatsapp" onclick="BenetripShare.shareSurprise('whatsapp')">
                                    WhatsApp
                                </button>
                                <button class="share-btn twitter" onclick="BenetripShare.shareSurprise('twitter')">
                                    X
                                </button>
                                <button class="share-btn facebook" onclick="BenetripShare.shareSurprise('facebook')">
                                    Facebook
                                </button>
                                <button class="share-btn copy" onclick="BenetripShare.shareSurprise('copy')">
                                    Copiar
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Preview da mensagem -->
                    <div class="share-preview hidden">
                        <h4>Preview da Mensagem:</h4>
                        <div class="share-preview-content">
                            <p id="share-preview-text"></p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Configurar botões de compartilhamento nas cards
    setupShareButtons() {
        // Adicionar botões de compartilhamento nas cards existentes
        setTimeout(() => {
            this.addShareButtonToCards();
        }, 1000);
    },

    // Adicionar botões às cards
    addShareButtonToCards() {
        // Adicionar ao destino destaque
        const destaqueCard = document.querySelector('#destino-destaque .border');
        if (destaqueCard && !destaqueCard.querySelector('.inline-share-button')) {
            const shareBtn = this.createInlineShareButton('top');
            const header = destaqueCard.querySelector('.p-4');
            if (header) {
                header.appendChild(shareBtn);
            }
        }

        // Adicionar aos destinos alternativos
        const alternativeCards = document.querySelectorAll('#destinos-alternativos .card-destino');
        alternativeCards.forEach((card, index) => {
            if (!card.querySelector('.inline-share-button')) {
                const shareBtn = this.createInlineShareButton('alternative', index);
                card.appendChild(shareBtn);
            }
        });
    },

    // Criar botão inline para cards
    createInlineShareButton(type, index = 0) {
        const button = document.createElement('button');
        button.className = 'inline-share-button';
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
        `;
        
        button.onclick = (e) => {
            e.stopPropagation();
            if (type === 'top') {
                this.quickShare('top');
            } else if (type === 'alternative') {
                this.quickShare('alternative', index);
            }
        };
        
        return button;
    },

    // Compartilhamento rápido
    quickShare(type, index = 0) {
        if (navigator.share && this.isMobile()) {
            // Usar Web Share API no mobile
            const shareData = this.getShareData(type, index);
            navigator.share({
                title: shareData.title,
                text: shareData.text,
                url: shareData.url
            }).catch(err => console.log('Erro ao compartilhar:', err));
        } else {
            // Abrir modal no desktop
            this.openShareModal(type, index);
        }
    },

    // Abrir modal de compartilhamento
    openShareModal(preselectedType = null, index = 0) {
        const modal = document.getElementById('share-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            
            // Se houver tipo pré-selecionado, destacar
            if (preselectedType) {
                this.highlightShareOption(preselectedType);
            }
        }
    },

    // Fechar modal
    closeShareModal() {
        const modal = document.getElementById('share-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    },

    // Gerar dados de compartilhamento
    getShareData(type, index = 0) {
        const profile = this.getUserProfile();
        const dates = this.getTravelDates();
        const baseUrl = this.config.baseUrl;
        
        let title, text, destinations;

        switch(type) {
            case 'all':
                destinations = this.getAllDestinations();
                title = `🐾 A Tripinha encontrou ${destinations.length} destinos perfeitos para ${profile.who}!`;
                text = this.generateAllDestinationsMessage(profile, destinations, dates);
                break;
                
            case 'top':
                const topPick = this.destinations?.topPick;
                if (topPick) {
                    title = `⭐ Destino TOP: ${topPick.destino}, ${topPick.pais}`;
                    text = this.generateTopPickMessage(profile, topPick, dates);
                }
                break;
                
            case 'surprise':
                const surprise = this.destinations?.surpresa;
                if (surprise) {
                    title = `🎲 Destino Surpresa: ${surprise.destino}, ${surprise.pais}`;
                    text = this.generateSurpriseMessage(profile, surprise, dates);
                }
                break;
                
            case 'alternative':
                const alternative = this.destinations?.alternativas?.[index];
                if (alternative) {
                    title = `✈️ Destino Recomendado: ${alternative.destino}, ${alternative.pais}`;
                    text = this.generateAlternativeMessage(profile, alternative, dates);
                }
                break;
        }

        // Adicionar call to action e link
        const utm = `utm_source=${this.config.utm.source}&utm_medium=${this.config.utm.medium}&utm_campaign=${this.config.utm.campaign}`;
        const url = `${baseUrl}?${utm}&ref=${this.generateReferralCode()}`;
        
        text += `\n\n🐶 Descubra seu destino ideal com a Benetrip!\n${url}`;

        return { title, text, url };
    },

    // Obter perfil do usuário
    getUserProfile() {
        const respostas = this.userData?.respostas || {};
        
        // Tipo de companhia
        let who = 'mim';
        let travelType = 'aventura';
        let mood = 'explorar';
        
        if (respostas.companhia !== undefined) {
            const companhia = parseInt(respostas.companhia);
            switch(companhia) {
                case 0: 
                    who = 'minha viagem solo';
                    mood = 'descobrir';
                    break;
                case 1: 
                    who = 'nossa viagem romântica';
                    mood = 'curtir a dois';
                    break;
                case 2: 
                    who = 'nossa viagem em família';
                    mood = 'criar memórias';
                    break;
                case 3: 
                    who = 'nossa trip com amigos';
                    mood = 'curtir muito';
                    break;
            }
        }

        // Tipo de destino
        if (respostas.destino_imaginado !== undefined) {
            const destino = parseInt(respostas.destino_imaginado);
            switch(destino) {
                case 0: travelType = 'praia e sol'; break;
                case 1: travelType = 'natureza e aventura'; break;
                case 2: travelType = 'cidade vibrante'; break;
                case 3: travelType = 'experiência única'; break;
            }
        }

        // Ritmo da viagem
        let pace = 'equilibrado';
        if (respostas.tipo_viagem !== undefined) {
            const tipo = parseInt(respostas.tipo_viagem);
            switch(tipo) {
                case 0: pace = 'relaxante'; break;
                case 1: pace = 'exploratório'; break;
                case 2: pace = 'radical'; break;
                case 3: pace = 'cultural'; break;
            }
        }

        return { who, travelType, mood, pace };
    },

    // Obter datas da viagem
    getTravelDates() {
        const datas = this.userData?.respostas?.datas;
        if (datas?.dataIda && datas?.dataVolta) {
            const options = { day: 'numeric', month: 'short' };
            const ida = new Date(datas.dataIda).toLocaleDateString('pt-BR', options);
            const volta = new Date(datas.dataVolta).toLocaleDateString('pt-BR', options);
            return `${ida} a ${volta}`;
        }
        return 'em breve';
    },

    // Mensagens personalizadas
    generateAllDestinationsMessage(profile, destinations, dates) {
        const destList = destinations.slice(0, 3).map(d => `${d.destino}`).join(', ');
        
        const messages = [
            `Procurando ${profile.travelType} para ${profile.mood}? 🌎\n\nA Tripinha farejou os melhores destinos:\n📍 ${destList}\n\n📅 Período: ${dates}\n✨ Vibe: ${profile.pace}`,
            
            `Destinos personalizados para ${profile.who}! 🐾\n\n${destList} estão te esperando!\n\nTudo pronto para ${profile.mood} de ${dates}`,
            
            `Que tal esses destinos incríveis? ✈️\n\n${destList}\n\nPerfeitos para ${profile.travelType} com vibe ${profile.pace}!`
        ];
        
        return messages[Math.floor(Math.random() * messages.length)];
    },

    generateTopPickMessage(profile, destination, dates) {
        const messages = [
            `A escolha perfeita para ${profile.who}! ⭐\n\n📍 ${destination.destino}, ${destination.pais}\n${destination.porque || ''}\n\n📅 ${dates}\n✨ Ideal para ${profile.mood}`,
            
            `${destination.destino} te espera! 🌟\n\n${destination.destaque || `Perfeito para ${profile.travelType}`}\n\nViagem de ${dates}`,
            
            `Destino TOP encontrado! 🎯\n\n${destination.destino} - ${destination.comentario || `O lugar ideal para ${profile.mood}`}`
        ];
        
        return messages[Math.floor(Math.random() * messages.length)];
    },

    generateSurpriseMessage(profile, destination, dates) {
        return `🎲 Que tal uma surpresa?\n\n${destination.destino}, ${destination.pais} é uma joia escondida perfeita para ${profile.who}!\n\n${destination.porque || 'Um destino único e especial'}\n\n📅 ${dates}`;
    },

    generateAlternativeMessage(profile, destination, dates) {
        return `Olha essa opção incrível! ✈️\n\n${destination.destino}, ${destination.pais}\n${destination.pontoTuristico || ''}\n\nPerfeito para ${profile.travelType} de ${dates}`;
    },

    // Compartilhar todos os destinos
    shareAllDestinations(platform) {
        const data = this.getShareData('all');
        this.share(platform, data);
    },

    // Compartilhar escolha TOP
    shareTopPick(platform) {
        const data = this.getShareData('top');
        this.share(platform, data);
    },

    // Compartilhar surpresa
    shareSurprise(platform) {
        const data = this.getShareData('surprise');
        this.share(platform, data);
    },

    // Executar compartilhamento
    share(platform, data) {
        const { title, text, url } = data;
        
        switch(platform) {
            case 'whatsapp':
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
                window.open(whatsappUrl, '_blank');
                this.trackShare('whatsapp', 'all');
                break;
                
            case 'twitter':
                const tweetText = text.length > 250 ? text.substring(0, 247) + '...' : text;
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(url)}`;
                window.open(twitterUrl, '_blank');
                this.trackShare('twitter', 'all');
                break;
                
            case 'facebook':
                const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
                window.open(facebookUrl, '_blank');
                this.trackShare('facebook', 'all');
                break;
                
            case 'copy':
                this.copyToClipboard(text);
                this.showToast('Link copiado! 📋');
                this.trackShare('copy', 'all');
                break;
                
            default:
                if (navigator.share && this.isMobile()) {
                    navigator.share({ title, text, url })
                        .then(() => this.trackShare('native', 'all'))
                        .catch(err => console.log('Erro ao compartilhar:', err));
                }
        }
        
        // Fechar modal após compartilhar
        setTimeout(() => this.closeShareModal(), 500);
    },

    // Copiar para clipboard
    copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
        } else {
            // Fallback para browsers antigos
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Erro ao copiar:', err);
            }
            document.body.removeChild(textArea);
        }
    },

    // Mostrar toast de notificação
    showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'share-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, duration);
    },

    // Tracking de compartilhamentos
    trackShare(platform, type) {
        // Analytics tracking
        if (typeof gtag !== 'undefined') {
            gtag('event', 'share', {
                'event_category': 'engagement',
                'event_label': platform,
                'value': type
            });
        }
        
        // Salvar estatísticas locais
        const stats = JSON.parse(localStorage.getItem('benetrip_share_stats') || '{}');
        const key = `${platform}_${type}`;
        stats[key] = (stats[key] || 0) + 1;
        stats.lastShare = new Date().toISOString();
        localStorage.setItem('benetrip_share_stats', JSON.stringify(stats));
        
        console.log(`📊 Compartilhamento trackado: ${platform} - ${type}`);
    },

    // Gerar código de referência único
    generateReferralCode() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 7);
        return `${timestamp}${random}`;
    },

    // Verificar se é mobile
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // Obter todos os destinos
    getAllDestinations() {
        const destinations = [];
        
        if (this.destinations?.topPick) {
            destinations.push(this.destinations.topPick);
        }
        
        if (this.destinations?.alternativas) {
            destinations.push(...this.destinations.alternativas);
        }
        
        if (this.destinations?.surpresa) {
            destinations.push(this.destinations.surpresa);
        }
        
        return destinations;
    },

    // Destacar opção de compartilhamento
    highlightShareOption(type) {
        const cards = document.querySelectorAll('.share-option-card');
        cards.forEach(card => card.classList.remove('highlighted'));
        
        let selector;
        switch(type) {
            case 'top':
                selector = '.share-option-card:nth-child(2)';
                break;
            case 'surprise':
                selector = '.share-option-card:nth-child(3)';
                break;
            default:
                selector = '.share-option-card:first-child';
        }
        
        const targetCard = document.querySelector(selector);
        if (targetCard) {
            targetCard.classList.add('highlighted');
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    // Atualizar botões quando dados mudarem
    updateShareButtons() {
        this.addShareButtonToCards();
    }
};

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BenetripShare.init());
} else {
    BenetripShare.init();
}

// Exportar para uso global
window.BenetripShare = BenetripShare;
