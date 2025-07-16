// 🐕 INTERAÇÕES RÁPIDAS DA TRIPINHA - IMPLEMENTAÇÃO IMEDIATA

document.addEventListener('DOMContentLoaded', function() {
    const avatar = document.querySelector('.tripinha-avatar-principal');
    
    if (!avatar) return;
    
    // ✨ Animação de entrada com delay
    setTimeout(() => {
        avatar.style.animation = 'tripinha-entrada-suave 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }, 300);
    
    // 🎯 Interação de clique/toque
    let clickCount = 0;
    let clickTimer = null;
    
    avatar.addEventListener('click', function(e) {
        e.preventDefault();
        clickCount++;
        
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
            handleTripinhaClicks(clickCount);
            clickCount = 0;
        }, 400);
    });
    
    // 🎪 Processar cliques
    function handleTripinhaClicks(count) {
        if (count === 1) {
            // Clique simples - wiggle
            avatar.style.animation = 'tripinha-wiggle 0.6s ease-in-out';
            setTimeout(() => {
                avatar.style.animation = '';
            }, 600);
        } 
        else if (count === 2) {
            // Clique duplo - coração
            showHeart();
        } 
        else if (count >= 3) {
            // Triplo clique - celebração
            startCelebration();
        }
    }
    
    // 💝 Mostrar coração
    function showHeart() {
        const heart = document.createElement('div');
        heart.innerHTML = '❤️';
        heart.style.cssText = `
            position: absolute;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 24px;
            animation: heart-float 1.5s ease-out forwards;
            pointer-events: none;
            z-index: 1000;
        `;
        
        avatar.parentElement.style.position = 'relative';
        avatar.parentElement.appendChild(heart);
        
        // Adicionar CSS da animação
        if (!document.getElementById('heart-animation')) {
            const style = document.createElement('style');
            style.id = 'heart-animation';
            style.textContent = `
                @keyframes heart-float {
                    0% { opacity: 0; transform: translateX(-50%) translateY(0) scale(0.5); }
                    50% { opacity: 1; transform: translateX(-50%) translateY(-20px) scale(1.2); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-40px) scale(0.8); }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => heart.remove(), 1500);
    }
    
    // 🎉 Iniciar celebração
    function startCelebration() {
        avatar.classList.add('tripinha-celebration-mode');
        
        // Criar confetes
        for (let i = 0; i < 8; i++) {
            setTimeout(() => createConfetti(), i * 100);
        }
        
        // Mostrar mensagem
        showMessage("🎉 Tripinha está feliz! Au au!");
        
        setTimeout(() => {
            avatar.classList.remove('tripinha-celebration-mode');
        }, 2000);
    }
    
    // 🎊 Criar confete
    function createConfetti() {
        const colors = ['#E87722', '#00A3E0', '#FFD700', '#FF69B4', '#98FB98'];
        const confetti = document.createElement('div');
        
        confetti.style.cssText = `
            position: absolute;
            width: 6px;
            height: 6px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: 50%;
            top: 50%;
            left: 50%;
            pointer-events: none;
            animation: confetti-fall ${1 + Math.random()}s ease-out forwards;
            z-index: 999;
        `;
        
        avatar.parentElement.appendChild(confetti);
        
        // CSS do confete
        if (!document.getElementById('confetti-animation')) {
            const style = document.createElement('style');
            style.id = 'confetti-animation';
            style.textContent = `
                @keyframes confetti-fall {
                    0% { 
                        opacity: 1; 
                        transform: translate(-50%, -50%) scale(0);
                    }
                    20% { 
                        transform: translate(-50%, -50%) scale(1);
                    }
                    100% { 
                        opacity: 0; 
                        transform: translate(
                            calc(-50% + ${(Math.random() - 0.5) * 100}px), 
                            calc(-50% + ${50 + Math.random() * 50}px)
                        ) scale(0.5);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => confetti.remove(), 2000);
    }
    
    // 💬 Mostrar mensagem
    function showMessage(text) {
        const message = document.createElement('div');
        message.textContent = text;
        message.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #E87722, #f39c42);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-weight: 600;
            box-shadow: 0 8px 24px rgba(232, 119, 34, 0.3);
            z-index: 10000;
            animation: message-slide 0.5s ease-out;
            font-size: 14px;
        `;
        
        document.body.appendChild(message);
        
        // CSS da mensagem
        if (!document.getElementById('message-animation')) {
            const style = document.createElement('style');
            style.id = 'message-animation';
            style.textContent = `
                @keyframes message-slide {
                    from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => {
            message.style.animation = 'message-slide 0.5s ease-in reverse';
            setTimeout(() => message.remove(), 500);
        }, 2500);
    }
    
    // 🌟 Easter egg com teclado
    let sequence = [];
    const target = ['t', 'r', 'i', 'p', 'i', 'n', 'h', 'a'];
    
    document.addEventListener('keydown', function(e) {
        sequence.push(e.key.toLowerCase());
        
        if (sequence.length > target.length) {
            sequence.shift();
        }
        
        if (JSON.stringify(sequence) === JSON.stringify(target)) {
            activateRainbowMode();
            sequence = [];
        }
    });
    
    // 🌈 Modo arco-íris
    function activateRainbowMode() {
        avatar.style.filter = 'hue-rotate(0deg)';
        avatar.style.animation = 'tripinha-rainbow 2s linear infinite';
        
        showMessage("🌈 Modo Arco-íris ativado! Digite 'tripinha' novamente!");
        
        // CSS do arco-íris
        if (!document.getElementById('rainbow-animation')) {
            const style = document.createElement('style');
            style.id = 'rainbow-animation';
            style.textContent = `
                @keyframes tripinha-rainbow {
                    0% { filter: hue-rotate(0deg); }
                    100% { filter: hue-rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => {
            avatar.style.filter = '';
            avatar.style.animation = '';
        }, 10000);
    }
    
    console.log('🐕 Tripinha interativa carregada! Clique nela ou digite "tripinha"');
});

// 🎯 Adicionar CSS de entrada se não existir
if (!document.getElementById('tripinha-entrance-styles')) {
    const style = document.createElement('style');
    style.id = 'tripinha-entrance-styles';
    style.textContent = `
        @keyframes tripinha-entrada-suave {
            0% {
                opacity: 0;
                transform: scale(0.3) translateY(-30px) rotate(-15deg);
            }
            60% {
                opacity: 0.8;
                transform: scale(1.1) translateY(-5px) rotate(3deg);
            }
            100% {
                opacity: 1;
                transform: scale(1) translateY(0) rotate(0deg);
            }
        }
        
        @keyframes tripinha-wiggle {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(3deg) scale(1.02); }
            75% { transform: rotate(-3deg) scale(1.02); }
        }
        
        .tripinha-celebration-mode {
            animation: tripinha-party 0.5s ease-in-out infinite !important;
        }
        
        @keyframes tripinha-party {
            0% { filter: hue-rotate(0deg) saturate(1.5); }
            25% { filter: hue-rotate(90deg) saturate(1.8); }
            50% { filter: hue-rotate(180deg) saturate(1.5); }
            75% { filter: hue-rotate(270deg) saturate(1.8); }
            100% { filter: hue-rotate(360deg) saturate(1.5); }
        }
        
        .tripinha-avatar-principal {
            cursor: pointer;
            transition: transform 0.2s ease;
        }
        
        .tripinha-avatar-principal:hover {
            transform: scale(1.05);
        }
        
        .tripinha-avatar-principal:active {
            transform: scale(0.95);
        }
    `;
    document.head.appendChild(style);
}
