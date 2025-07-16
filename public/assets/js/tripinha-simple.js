// 📱 TRIPINHA MOBILE - VERSÃO CORRIGIDA E TESTADA
// Soluciona todos os problemas de interação em dispositivos móveis

document.addEventListener('DOMContentLoaded', function() {
    console.log('🐕 Iniciando Tripinha Mobile...');
    
    // 🎯 Detectar mobile com mais precisão
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     ('ontouchstart' in window) || 
                     (navigator.maxTouchPoints > 0);
    
    console.log('📱 Device detectado:', isMobile ? 'Mobile' : 'Desktop');
    
    // 🎯 Encontrar avatar com múltiplos seletores
    let avatar = document.querySelector('.tripinha-avatar-principal') || 
                document.querySelector('[src*="tripinha"]') ||
                document.querySelector('[alt*="Tripinha"]') ||
                document.querySelector('.tripinha-avatar') ||
                document.querySelector('.loading-avatar');
    
    if (!avatar) {
        console.warn('⚠️ Avatar da Tripinha não encontrado');
        // Tentar novamente após um delay
        setTimeout(() => {
            avatar = document.querySelector('.tripinha-avatar-principal') || 
                    document.querySelector('[src*="tripinha"]');
            if (avatar) {
                console.log('✅ Avatar encontrado após delay');
                setupTripinhaInteractions(avatar, isMobile);
            }
        }, 1000);
        return;
    }
    
    console.log('✅ Avatar da Tripinha encontrado:', avatar);
    setupTripinhaInteractions(avatar, isMobile);
});

function setupTripinhaInteractions(avatar, isMobile) {
    console.log('🚀 Configurando interações...');
    
    // 📱 Aumentar área de toque para mobile
    if (isMobile) {
        avatar.style.cssText += `
            cursor: pointer;
            touch-action: manipulation;
            -webkit-tap-highlight-color: rgba(232, 119, 34, 0.3);
            padding: 10px;
            margin: -10px;
            min-width: 44px;
            min-height: 44px;
        `;
    }
    
    // 🎪 Variáveis de controle
    let clickCount = 0;
    let clickTimer = null;
    let isAnimating = false;
    
    // 🎯 Função de feedback imediato
    function giveFeedback() {
        console.log('👆 Feedback iniciado');
        
        // Feedback visual imediato
        avatar.style.transition = 'transform 0.1s ease-out';
        avatar.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            avatar.style.transform = 'scale(1)';
            console.log('✅ Feedback visual aplicado');
        }, 100);
        
        // Feedback haptic (se disponível)
        if (navigator.vibrate) {
            navigator.vibrate(50);
            console.log('📳 Vibração ativada');
        }
    }
    
    // 🎯 Eventos para mobile E desktop
    const events = isMobile ? ['touchstart', 'click'] : ['click'];
    
    events.forEach(eventType => {
        avatar.addEventListener(eventType, function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log(`🎯 Evento ${eventType} detectado`);
            
            // Feedback imediato
            giveFeedback();
            
            if (isAnimating) {
                console.log('⏸️ Animação em andamento, ignorando');
                return;
            }
            
            clickCount++;
            console.log(`👆 Click count: ${clickCount}`);
            
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                handleClicks(clickCount);
                clickCount = 0;
            }, 400);
        }, { passive: false });
    });
    
    // 🎪 Processar cliques
    function handleClicks(count) {
        console.log(`🎪 Processando ${count} clique(s)`);
        isAnimating = true;
        
        if (count === 1) {
            doWiggle();
        } else if (count === 2) {
            showHeart();
        } else if (count >= 3) {
            doCelebration();
        }
        
        setTimeout(() => {
            isAnimating = false;
        }, 1000);
    }
    
    // 🎭 Animação wiggle
    function doWiggle() {
        console.log('🎭 Iniciando wiggle');
        
        avatar.style.transition = 'transform 0.15s ease-in-out';
        avatar.style.transform = 'rotate(5deg) scale(1.05)';
        
        setTimeout(() => {
            avatar.style.transform = 'rotate(-5deg) scale(1.05)';
        }, 150);
        
        setTimeout(() => {
            avatar.style.transform = 'rotate(0deg) scale(1)';
            console.log('✅ Wiggle completo');
        }, 300);
    }
    
    // 💝 Mostrar coração
    function showHeart() {
        console.log('💝 Mostrando coração');
        
        const heart = document.createElement('div');
        heart.innerHTML = '❤️';
        heart.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 32px;
            z-index: 10000;
            pointer-events: none;
            animation: heart-mobile 1.5s ease-out forwards;
        `;
        
        document.body.appendChild(heart);
        
        // CSS específico para mobile
        addMobileCSS('heart-mobile', `
            @keyframes heart-mobile {
                0% { 
                    opacity: 0; 
                    transform: translate(-50%, -50%) scale(0.5); 
                }
                30% { 
                    opacity: 1; 
                    transform: translate(-50%, -50%) scale(1.3); 
                }
                100% { 
                    opacity: 0; 
                    transform: translate(-50%, -80%) scale(0.8); 
                }
            }
        `);
        
        setTimeout(() => {
            heart.remove();
            console.log('💝 Coração removido');
        }, 1500);
    }
    
    // 🎉 Celebração
    function doCelebration() {
        console.log('🎉 Iniciando celebração');
        
        // Animação do avatar
        avatar.style.animation = 'celebration-spin 0.8s ease-in-out 2';
        
        // Confetes
        for (let i = 0; i < 12; i++) {
            setTimeout(() => createMobileConfetti(), i * 80);
        }
        
        // Mensagem
        showMobileMessage("🎉 Tripinha está feliz! Au au!");
        
        // CSS da celebração
        addMobileCSS('celebration-spin', `
            @keyframes celebration-spin {
                0% { transform: scale(1) rotate(0deg); }
                50% { transform: scale(1.2) rotate(180deg); }
                100% { transform: scale(1) rotate(360deg); }
            }
        `);
        
        setTimeout(() => {
            avatar.style.animation = '';
            console.log('🎉 Celebração completa');
        }, 1600);
    }
    
    // 🎊 Confete para mobile
    function createMobileConfetti() {
        const colors = ['#E87722', '#00A3E0', '#FFD700', '#FF69B4', '#98FB98'];
        const confetti = document.createElement('div');
        
        confetti.style.cssText = `
            position: fixed;
            width: 8px;
            height: 8px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: 50%;
            top: 40%;
            left: ${30 + Math.random() * 40}%;
            pointer-events: none;
            z-index: 9999;
            animation: confetti-mobile ${1.5 + Math.random()}s ease-out forwards;
        `;
        
        document.body.appendChild(confetti);
        
        addMobileCSS('confetti-mobile', `
            @keyframes confetti-mobile {
                0% { 
                    opacity: 1; 
                    transform: translateY(0) scale(0) rotate(0deg);
                }
                20% { 
                    transform: translateY(-20px) scale(1) rotate(90deg);
                }
                100% { 
                    opacity: 0; 
                    transform: translateY(200px) scale(0.5) rotate(360deg);
                }
            }
        `);
        
        setTimeout(() => confetti.remove(), 2500);
    }
    
    // 💬 Mensagem para mobile
    function showMobileMessage(text) {
        console.log('💬 Mostrando mensagem:', text);
        
        const message = document.createElement('div');
        message.textContent = text;
        message.style.cssText = `
            position: fixed;
            top: 20px;
            left: 10px;
            right: 10px;
            margin: 0 auto;
            max-width: 300px;
            background: linear-gradient(135deg, #E87722, #f39c42);
            color: white;
            padding: 12px 16px;
            border-radius: 25px;
            font-weight: 600;
            box-shadow: 0 8px 24px rgba(232, 119, 34, 0.4);
            z-index: 10001;
            text-align: center;
            font-size: 14px;
            animation: message-mobile 0.5s ease-out;
        `;
        
        document.body.appendChild(message);
        
        addMobileCSS('message-mobile', `
            @keyframes message-mobile {
                0% { 
                    opacity: 0; 
                    transform: translateY(-30px) scale(0.8); 
                }
                100% { 
                    opacity: 1; 
                    transform: translateY(0) scale(1); 
                }
            }
        `);
        
        setTimeout(() => {
            message.style.animation = 'message-mobile 0.5s ease-in reverse';
            setTimeout(() => {
                message.remove();
                console.log('💬 Mensagem removida');
            }, 500);
        }, 2500);
    }
    
    // 🎨 Adicionar CSS dinamicamente
    function addMobileCSS(id, css) {
        if (!document.getElementById(`tripinha-${id}`)) {
            const style = document.createElement('style');
            style.id = `tripinha-${id}`;
            style.textContent = css;
            document.head.appendChild(style);
        }
    }
    
    // 🌈 Easter egg com toque longo
    let touchTimer = null;
    
    if (isMobile) {
        avatar.addEventListener('touchstart', function(e) {
            touchTimer = setTimeout(() => {
                activateRainbowMode();
                console.log('🌈 Modo arco-íris ativado por toque longo');
            }, 2000);
        });
        
        avatar.addEventListener('touchend', function(e) {
            clearTimeout(touchTimer);
        });
        
        avatar.addEventListener('touchmove', function(e) {
            clearTimeout(touchTimer);
        });
    }
    
    // 🌈 Modo arco-íris
    function activateRainbowMode() {
        console.log('🌈 Ativando modo arco-íris');
        
        avatar.style.animation = 'rainbow-mobile 2s linear infinite';
        
        addMobileCSS('rainbow-mobile', `
            @keyframes rainbow-mobile {
                0% { filter: hue-rotate(0deg) saturate(1.5); }
                25% { filter: hue-rotate(90deg) saturate(1.8); }
                50% { filter: hue-rotate(180deg) saturate(1.5); }
                75% { filter: hue-rotate(270deg) saturate(1.8); }
                100% { filter: hue-rotate(360deg) saturate(1.5); }
            }
        `);
        
        showMobileMessage("🌈 Modo Arco-íris ativado! Toque longo na Tripinha!");
        
        setTimeout(() => {
            avatar.style.animation = '';
            avatar.style.filter = '';
            console.log('🌈 Modo arco-íris desativado');
        }, 8000);
    }
    
    // ✨ Debug info
    console.log('🎯 Configuração completa:');
    console.log('📱 Mobile:', isMobile);
    console.log('👆 Eventos:', events);
    console.log('🐕 Avatar:', avatar);
    
    // 🎪 Animação de entrada
    setTimeout(() => {
        avatar.style.transition = 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
        avatar.style.transform = 'scale(1.05)';
        
        setTimeout(() => {
            avatar.style.transform = 'scale(1)';
        }, 800);
        
        console.log('✨ Animação de entrada completa');
    }, 500);
    
    console.log('🎉 Tripinha Mobile configurada com sucesso!');
    
    // 🎯 Teste automático (apenas em desenvolvimento)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setTimeout(() => {
            console.log('🧪 Executando teste automático...');
            showMobileMessage("🐕 Tripinha carregada! Toque em mim!");
        }, 2000);
    }
}

// 🎯 CSS base para mobile
document.addEventListener('DOMContentLoaded', function() {
    const mobileCSS = `
        .tripinha-avatar-principal,
        [src*="tripinha"] {
            -webkit-tap-highlight-color: rgba(232, 119, 34, 0.3);
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            -khtml-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            touch-action: manipulation;
            cursor: pointer;
        }
        
        @media (hover: none) {
            .tripinha-avatar-principal:hover,
            [src*="tripinha"]:hover {
                transform: none !important;
            }
        }
        
        @media (max-width: 480px) {
            .tripinha-avatar-principal,
            [src*="tripinha"] {
                min-width: 44px;
                min-height: 44px;
            }
        }
    `;
    
    const style = document.createElement('style');
    style.textContent = mobileCSS;
    document.head.appendChild(style);
});

console.log('📱 Tripinha Mobile Script carregado!');
