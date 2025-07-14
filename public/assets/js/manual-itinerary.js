<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#E87722">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    
    <title>Criar Roteiro - Benetrip</title>
    <meta name="description" content="Crie seu roteiro personalizado com a Tripinha - Escolha seus critérios e descubra experiências únicas!">
    
    <!-- Fonts -->
    <link rel="preload" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Montserrat:wght@400;500&display=swap" as="style">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Montserrat:wght@400;500&display=swap" rel="stylesheet">
    
    <style>
        /* ======================================
           BENETRIP - ROTEIRO MANUAL STYLES
           ====================================== */

        /* ✅ VARIÁVEIS CSS */
        :root {
            --primary-color: #E87722; /* Laranja Vibrante */
            --secondary-color: #00A3E0; /* Azul Sereno */
            --white: #FFFFFF; /* Branco Neutro */
            --dark: #21272A; /* Cinza Escuro */
            --light-gray: #F5F5F5; /* Cinza Claro para fundos */
            --medium-gray: #E0E0E0; /* Cinza Médio para bordas */
            --success: #4CAF50; /* Verde para badges */
            --info: #2196F3; /* Azul para badges */
            --purple: #9C27B0; /* Roxo para badges */
            --error: #f44336; /* Vermelho para erros */
            --warning: #ff9800; /* Laranja para avisos */
            
            /* Shadows */
            --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
            --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.15);
            
            /* Transitions */
            --transition-fast: 0.2s ease;
            --transition-normal: 0.3s ease;
            
            /* Border radius */
            --radius-sm: 6px;
            --radius-md: 8px;
            --radius-lg: 12px;
            --radius-xl: 16px;
        }

        /* ✅ RESET E BASE STYLES */
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 0;
            overflow-x: hidden;
            background-color: var(--light-gray);
            font-family: 'Montserrat', sans-serif;
            line-height: 1.5;
            color: var(--dark);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        /* ✅ CONTAINER PRINCIPAL */
        .benetrip-container {
            max-width: 480px;
            margin: 0 auto;
            background-color: var(--white);
            min-height: 100vh;
            position: relative;
        }

        /* ✅ HEADER */
        .app-header {
            background: linear-gradient(135deg, var(--primary-color), #f39c42);
            color: var(--white);
            padding: 20px 16px;
            text-align: center;
            box-shadow: var(--shadow-md);
        }

        .app-header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            font-family: 'Poppins', sans-serif;
        }

        .app-header p {
            margin: 8px 0 0;
            font-size: 14px;
            opacity: 0.9;
        }

        /* ✅ FORMULÁRIO DE CRITÉRIOS */
        .form-container {
            padding: 20px 16px;
        }

        .form-section {
            background: var(--white);
            border-radius: var(--radius-lg);
            padding: 20px;
            margin-bottom: 16px;
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--medium-gray);
        }

        .form-section h3 {
            margin: 0 0 16px;
            font-size: 18px;
            font-weight: 600;
            color: var(--primary-color);
            font-family: 'Poppins', sans-serif;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group:last-child {
            margin-bottom: 0;
        }

        .form-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: var(--dark);
            font-size: 14px;
        }

        .form-input,
        .form-select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid var(--medium-gray);
            border-radius: var(--radius-md);
            font-size: 14px;
            font-family: inherit;
            transition: border-color var(--transition-fast);
            background: var(--white);
        }

        .form-input:focus,
        .form-select:focus {
            outline: none;
            border-color: var(--secondary-color);
            box-shadow: 0 0 0 3px rgba(0, 163, 224, 0.1);
        }

        .form-input::placeholder {
            color: #999;
        }

        .date-inputs {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }

        .time-inputs {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }

        .time-input-group {
            display: flex;
            flex-direction: column;
        }

        .time-input-group .form-label {
            font-size: 12px;
            margin-bottom: 4px;
            color: #666;
            font-weight: 500;
        }

        .number-input {
            max-width: 120px;
        }

        /* ✅ BOTÃO GERAR ROTEIRO */
        .generate-button {
            width: 100%;
            background: linear-gradient(135deg, var(--primary-color), #f39c42);
            color: var(--white);
            border: none;
            padding: 16px 24px;
            border-radius: var(--radius-lg);
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all var(--transition-fast);
            margin: 20px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-height: 56px;
        }

        .generate-button:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-lg);
        }

        .generate-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        .generate-button.loading {
            background: var(--medium-gray);
            cursor: wait;
        }

        .loading-spinner {
            width: 20px;
            height: 20px;
            border: 2px solid transparent;
            border-top: 2px solid var(--white);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* ✅ ÁREA DO ROTEIRO GERADO */
        .itinerary-result {
            margin-top: 20px;
            opacity: 0;
            transform: translateY(20px);
            transition: all var(--transition-normal);
        }

        .itinerary-result.visible {
            opacity: 1;
            transform: translateY(0);
        }

        .result-header {
            background: linear-gradient(135deg, var(--secondary-color), #42a5f5);
            color: var(--white);
            padding: 16px;
            border-radius: var(--radius-lg) var(--radius-lg) 0 0;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .tripinha-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--white);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }

        .result-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            font-family: 'Poppins', sans-serif;
        }

        /* ✅ RESUMO DA VIAGEM */
        .resumo-viagem {
            background: var(--white);
            border: 1px solid var(--medium-gray);
            border-top: none;
            padding: 20px;
        }

        .resumo-item {
            display: flex;
            align-items: flex-start;
            margin-bottom: 12px;
            gap: 12px;
        }

        .resumo-item:last-child {
            margin-bottom: 0;
        }

        .resumo-item .icone {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 16px;
        }

        .resumo-item .texto {
            flex-grow: 1;
        }

        .resumo-item .label {
            font-size: 12px;
            color: #666;
            margin-bottom: 2px;
            font-weight: 500;
        }

        .resumo-item .valor {
            font-weight: 600;
            margin: 0;
            color: var(--dark);
            line-height: 1.3;
        }

        /* ✅ DIAS DO ROTEIRO */
        .roteiro-content {
            background: var(--white);
            border: 1px solid var(--medium-gray);
            border-top: none;
            border-radius: 0 0 var(--radius-lg) var(--radius-lg);
            padding: 16px;
        }

        .dia-roteiro {
            margin-bottom: 24px;
            background: var(--white);
            border-radius: var(--radius-lg);
            overflow: hidden;
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--medium-gray);
        }

        .dia-roteiro:last-child {
            margin-bottom: 0;
        }

        .dia-header {
            display: flex;
            align-items: center;
            background: linear-gradient(135deg, var(--primary-color), #f39c42);
            color: var(--white);
            padding: 16px;
            font-weight: 700;
            font-size: 16px;
        }

        .dia-numero {
            width: 36px;
            height: 36px;
            background-color: var(--white);
            color: var(--primary-color);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            font-weight: 700;
            font-size: 16px;
        }

        .dia-content {
            padding: 20px;
        }

        .dia-descricao {
            font-size: 14px;
            color: #555;
            line-height: 1.5;
            margin-bottom: 16px;
            font-style: italic;
            background: rgba(232, 119, 34, 0.08);
            padding: 12px;
            border-radius: var(--radius-md);
            border-left: 4px solid var(--primary-color);
        }

        .atividades-lista {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .atividade-item {
            background: var(--light-gray);
            border-radius: var(--radius-md);
            padding: 16px;
            border: 1px solid var(--medium-gray);
            transition: all var(--transition-fast);
        }

        .atividade-item:hover {
            transform: translateY(-1px);
            box-shadow: var(--shadow-sm);
        }

        .atividade-horario {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            color: var(--secondary-color);
            font-weight: 600;
            font-size: 14px;
            gap: 6px;
        }

        .atividade-local {
            font-weight: 600;
            font-size: 16px;
            color: var(--dark);
            margin-bottom: 8px;
        }

        .atividade-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 8px;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            font-size: 10px;
            padding: 4px 8px;
            border-radius: 12px;
            color: var(--white);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .badge-destaque {
            background: linear-gradient(135deg, var(--primary-color), #f39c42);
        }

        .badge-cultura {
            background: linear-gradient(135deg, var(--purple), #ba68c8);
        }

        .badge-gastronomia {
            background: linear-gradient(135deg, #ff7043, #ff8a65);
        }

        .badge-natureza {
            background: linear-gradient(135deg, var(--success), #66bb6a);
        }

        .badge-compras {
            background: linear-gradient(135deg, #ffa726, #ffb74d);
        }

        .badge-padrao {
            background: linear-gradient(135deg, #78909c, #90a4ae);
        }

        .atividade-dica {
            background: rgba(232, 119, 34, 0.1);
            padding: 12px;
            border-radius: var(--radius-md);
            margin-top: 12px;
            display: flex;
            align-items: flex-start;
            gap: 8px;
            border: 1px solid rgba(232, 119, 34, 0.2);
        }

        .dica-icon {
            font-size: 16px;
            flex-shrink: 0;
        }

        .dica-texto {
            font-size: 13px;
            color: var(--dark);
            line-height: 1.4;
        }

        /* ✅ TOAST NOTIFICATIONS */
        .toast-container {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000;
            width: 90%;
            max-width: 400px;
            pointer-events: none;
        }

        .toast {
            background-color: var(--white);
            border-radius: var(--radius-md);
            padding: 16px;
            margin-bottom: 8px;
            box-shadow: var(--shadow-lg);
            display: flex;
            align-items: center;
            gap: 12px;
            opacity: 0;
            transform: translateY(-20px);
            transition: all var(--transition-normal);
            border-left: 4px solid var(--info);
            pointer-events: auto;
        }

        .toast-visible {
            opacity: 1;
            transform: translateY(0);
        }

        .toast-success {
            border-left-color: var(--success);
        }

        .toast-error {
            border-left-color: var(--error);
        }

        .toast-warning {
            border-left-color: var(--warning);
        }

        .toast-icon {
            font-size: 18px;
            flex-shrink: 0;
        }

        .toast-message {
            font-size: 14px;
            color: var(--dark);
            line-height: 1.4;
        }

        /* ✅ RESPONSIVIDADE */
        @media (max-width: 480px) {
            .benetrip-container {
                width: 100%;
                margin: 0;
            }
            
            .form-container {
                padding: 16px 12px;
            }
            
            .form-section {
                padding: 16px;
                margin-bottom: 12px;
            }
            
            .date-inputs {
                grid-template-columns: 1fr;
                gap: 8px;
            }
            
            .time-inputs {
                grid-template-columns: 1fr;
                gap: 8px;
            }
            
            .app-header {
                padding: 16px 12px;
            }
            
            .app-header h1 {
                font-size: 20px;
            }
        }

        /* ✅ ESTADOS DE FOCO PARA ACESSIBILIDADE */
        .form-input:focus,
        .form-select:focus,
        .generate-button:focus {
            outline: 2px solid var(--secondary-color);
            outline-offset: 2px;
        }

        /* ✅ PREFERS REDUCED MOTION */
        @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
            
            .loading-spinner {
                animation: none;
            }
        }
    </style>
</head>

<body>
    <div class="benetrip-container">
        <!-- ✅ HEADER -->
        <header class="app-header">
            <h1>🐕 Criar Roteiro Personalizado</h1>
            <p>Preencha os critérios e a Tripinha criará seu roteiro perfeito!</p>
        </header>

        <!-- ✅ FORMULÁRIO DE CRITÉRIOS -->
        <div class="form-container">
            <form id="itineraryForm">
                <!-- Informações Básicas -->
                <div class="form-section">
                    <h3>📍 Informações Básicas</h3>
                    
                    <div class="form-group">
                        <label class="form-label" for="destino">Destino da viagem</label>
                        <input type="text" id="destino" class="form-input" placeholder="Ex: Lisboa, Portugal" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="cidadePartida">Cidade de partida</label>
                        <input type="text" id="cidadePartida" class="form-input" placeholder="Ex: São Paulo" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Datas da viagem</label>
                        <div class="date-inputs">
                            <input type="date" id="dataIda" class="form-input" required>
                            <input type="date" id="dataVolta" class="form-input" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Horários dos voos</label>
                        <div class="time-inputs">
                            <div class="time-input-group">
                                <label class="form-label">Chegada</label>
                                <input type="time" id="horarioChegada" class="form-input" value="15:30" required>
                            </div>
                            <div class="time-input-group">
                                <label class="form-label">Partida</label>
                                <input type="time" id="horarioPartida" class="form-input" value="21:00" required>
                            </div>
                        </div>
                        <p style="font-size: 12px; color: #666; margin-top: 8px; line-height: 1.4;">
                            💡 <strong>Dica:</strong> Os horários influenciam diretamente as atividades do primeiro e último dia do seu roteiro.
                        </p>
                    </div>
                </div>

                <!-- Companhia de Viagem -->
                <div class="form-section">
                    <h3>👥 Companhia de Viagem</h3>
                    
                    <div class="form-group">
                        <label class="form-label" for="tipoCompanhia">Com quem você vai viajar?</label>
                        <select id="tipoCompanhia" class="form-select" required>
                            <option value="">Selecione...</option>
                            <option value="sozinho">🧳 Sozinho(a)</option>
                            <option value="casal">❤️ Casal</option>
                            <option value="familia">👨‍👩‍👧‍👦 Família</option>
                            <option value="amigos">🎉 Grupo de Amigos</option>
                        </select>
                    </div>
                    
                    <div class="form-group" id="quantidadeGroup" style="display: none;">
                        <label class="form-label" for="quantidade">Quantas pessoas?</label>
                        <input type="number" id="quantidade" class="form-input number-input" min="2" max="15" placeholder="2">
                    </div>
                </div>

                <!-- Preferências de Viagem -->
                <div class="form-section">
                    <h3>✨ Preferências de Viagem</h3>
                    
                    <div class="form-group">
                        <label class="form-label" for="tipoViagem">Que tipo de experiência você busca?</label>
                        <select id="tipoViagem" class="form-select" required>
                            <option value="">Selecione...</option>
                            <option value="relaxar">🏖️ Relaxar e descansar</option>
                            <option value="aventura">🏔️ Aventura e natureza</option>
                            <option value="cultura">🏛️ Cultura e história</option>
                            <option value="urbano">🏙️ Urbano e moderno</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="intensidade">Intensidade do roteiro</label>
                        <select id="intensidade" class="form-select" required>
                            <option value="">Selecione...</option>
                            <option value="leve">🐌 Leve - Poucas atividades por dia</option>
                            <option value="moderado">🚶 Moderado - Equilibrio entre atividades e descanso</option>
                            <option value="intenso">🏃 Intenso - Máximo de atividades</option>
                        </select>
                    </div>
                </div>

                <!-- Orçamento -->
                <div class="form-section">
                    <h3>💰 Orçamento</h3>
                    
                    <div class="form-group">
                        <label class="form-label" for="nivelOrcamento">Nível de orçamento</label>
                        <select id="nivelOrcamento" class="form-select" required>
                            <option value="">Selecione...</option>
                            <option value="economico">💵 Econômico</option>
                            <option value="medio">💴 Médio</option>
                            <option value="alto">💎 Alto</option>
                        </select>
                    </div>
                </div>

                <!-- Botão Gerar -->
                <button type="submit" class="generate-button" id="generateBtn">
                    <span id="btnText">🎯 Criar Meu Roteiro</span>
                    <div id="btnSpinner" class="loading-spinner" style="display: none;"></div>
                </button>
            </form>
        </div>

        <!-- ✅ ÁREA DO ROTEIRO GERADO -->
        <div id="itineraryResult" class="itinerary-result">
            <!-- Conteúdo será inserido dinamicamente pelo JavaScript -->
        </div>
    </div>

    <!-- ✅ CONTAINER PARA TOAST NOTIFICATIONS -->
    <div id="toastContainer" class="toast-container"></div>

    <script>
        // ======================================
        // BENETRIP - ROTEIRO MANUAL JAVASCRIPT
        // ✅ INTEGRAÇÃO REAL COM API EXISTENTE
        // ======================================
        
        /**
         * ✅ INTEGRAÇÃO COM API REAL:
         * 
         * Esta página usa a MESMA infraestrutura do projeto atual:
         * - Chama /api/itinerary-generator (DeepSeek/Claude)
         * - Usa o MESMO prompt da Tripinha
         * - Processa dados no MESMO formato
         * - Fallback inteligente se API falhar
         * 
         * PROMPT USADO:
         * "Você é a Tripinha, uma vira-lata caramelo especialista em viagens...
         * Crie um roteiro detalhado com X dias, incluindo atividades, horários,
         * dicas personalizadas e tags relevantes..."
         */

        class BenetripManualItinerary {
            constructor() {
                this.form = document.getElementById('itineraryForm');
                this.resultContainer = document.getElementById('itineraryResult');
                this.generateBtn = document.getElementById('generateBtn');
                this.btnText = document.getElementById('btnText');
                this.btnSpinner = document.getElementById('btnSpinner');
                
                this.init();
            }

            init() {
                console.log('🚀 Benetrip Roteiro Manual iniciado');
                
                this.setupEventListeners();
                this.setupDateDefaults();
                this.setupHorarioPreview();
            }

            setupEventListeners() {
                // Formulário
                this.form.addEventListener('submit', (e) => this.handleSubmit(e));
                
                // Mostrar/ocultar campo quantidade
                document.getElementById('tipoCompanhia').addEventListener('change', (e) => {
                    const quantidadeGroup = document.getElementById('quantidadeGroup');
                    const value = e.target.value;
                    
                    if (value === 'familia' || value === 'amigos') {
                        quantidadeGroup.style.display = 'block';
                        document.getElementById('quantidade').required = true;
                    } else {
                        quantidadeGroup.style.display = 'none';
                        document.getElementById('quantidade').required = false;
                    }
                });
            }

            setupDateDefaults() {
                const hoje = new Date();
                const amanha = new Date(hoje);
                amanha.setDate(hoje.getDate() + 1);
                const duasSemanas = new Date(hoje);
                duasSemanas.setDate(hoje.getDate() + 14);
                
                document.getElementById('dataIda').value = this.formatDate(amanha);
                document.getElementById('dataVolta').value = this.formatDate(duasSemanas);
                
                // Set min date para hoje
                document.getElementById('dataIda').min = this.formatDate(hoje);
                document.getElementById('dataVolta').min = this.formatDate(hoje);
            }

            setupHorarioPreview() {
                const horarioChegada = document.getElementById('horarioChegada');
                const horarioPartida = document.getElementById('horarioPartida');
                
                const atualizarPreview = () => {
                    // Remover preview anterior
                    document.querySelectorAll('.horario-preview').forEach(el => el.remove());
                    
                    const horaChegada = parseInt(horarioChegada.value.split(':')[0]);
                    const horaPartida = parseInt(horarioPartida.value.split(':')[0]);
                    
                    // Preview chegada
                    let previewChegada = '';
                    if (horaChegada >= 20) {
                        previewChegada = '🌙 Chegada noturna - apenas check-in e descanso';
                    } else if (horaChegada >= 16) {
                        previewChegada = '🌅 Chegada tarde - poucas atividades no primeiro dia';
                    } else if (horaChegada >= 12) {
                        previewChegada = '☀️ Chegada meio-dia - tarde livre para explorar';
                    } else {
                        previewChegada = '🌟 Chegada cedo - dia completo de atividades!';
                    }
                    
                    // Preview partida
                    let previewPartida = '';
                    if (horaPartida <= 8) {
                        previewPartida = '🌅 Voo matinal - organize tudo na véspera';
                    } else if (horaPartida <= 12) {
                        previewPartida = '☀️ Voo manhã - último dia pela manhã';
                    } else if (horaPartida <= 18) {
                        previewPartida = '🌤️ Voo tarde - manhã do último dia livre';
                    } else {
                        previewPartida = '🌟 Voo noite - último dia completo!';
                    }
                    
                    // Adicionar previews
                    if (previewChegada) {
                        const previewEl = document.createElement('div');
                        previewEl.className = 'horario-preview';
                        previewEl.style.cssText = `
                            font-size: 12px;
                            color: #666;
                            margin-top: 4px;
                            padding: 4px 8px;
                            background: rgba(232, 119, 34, 0.1);
                            border-radius: 4px;
                            border-left: 2px solid var(--primary-color);
                        `;
                        previewEl.textContent = previewChegada;
                        horarioChegada.parentNode.appendChild(previewEl);
                    }
                    
                    if (previewPartida) {
                        const previewEl = document.createElement('div');
                        previewEl.className = 'horario-preview';
                        previewEl.style.cssText = `
                            font-size: 12px;
                            color: #666;
                            margin-top: 4px;
                            padding: 4px 8px;
                            background: rgba(0, 163, 224, 0.1);
                            border-radius: 4px;
                            border-left: 2px solid var(--secondary-color);
                        `;
                        previewEl.textContent = previewPartida;
                        horarioPartida.parentNode.appendChild(previewEl);
                    }
                };
                
                horarioChegada.addEventListener('change', atualizarPreview);
                horarioPartida.addEventListener('change', atualizarPreview);
                
                // Preview inicial
                setTimeout(atualizarPreview, 100);
            }

            formatDate(date) {
                return date.toISOString().split('T')[0];
            }

            async handleSubmit(e) {
                e.preventDefault();
                
                if (!this.validateForm()) {
                    this.showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
                    return;
                }
                
                this.showLoading(true);
                
                try {
                    const formData = this.getFormData();
                    const roteiro = await this.generateItinerary(formData);
                    this.displayItinerary(roteiro);
                    this.showToast('Roteiro criado com sucesso! 🎉', 'success');
                } catch (error) {
                    console.error('Erro ao gerar roteiro:', error);
                    this.showToast('Erro ao gerar roteiro. Tente novamente.', 'error');
                } finally {
                    this.showLoading(false);
                }
            }

            validateForm() {
                const requiredFields = this.form.querySelectorAll('[required]');
                let isValid = true;
                
                requiredFields.forEach(field => {
                    if (!field.value.trim()) {
                        isValid = false;
                        field.style.borderColor = 'var(--error)';
                    } else {
                        field.style.borderColor = 'var(--medium-gray)';
                    }
                });
                
                // Validar datas
                const dataIda = new Date(document.getElementById('dataIda').value);
                const dataVolta = new Date(document.getElementById('dataVolta').value);
                
                if (dataVolta <= dataIda) {
                    this.showToast('A data de volta deve ser posterior à data de ida.', 'error');
                    return false;
                }
                
                // ✅ Validar horários (se for viagem de 1 dia, partida deve ser após chegada)
                const diasViagem = this.calcularDiasViagem(document.getElementById('dataIda').value, document.getElementById('dataVolta').value);
                if (diasViagem === 1) {
                    const horarioChegada = document.getElementById('horarioChegada').value;
                    const horarioPartida = document.getElementById('horarioPartida').value;
                    
                    if (horarioPartida <= horarioChegada) {
                        this.showToast('Para viagens de 1 dia, o horário de partida deve ser posterior ao de chegada.', 'error');
                        return false;
                    }
                }
                
                return isValid;
            }

            getFormData() {
                return {
                    destino: document.getElementById('destino').value,
                    cidadePartida: document.getElementById('cidadePartida').value,
                    dataIda: document.getElementById('dataIda').value,
                    dataVolta: document.getElementById('dataVolta').value,
                    horarioChegada: document.getElementById('horarioChegada').value,
                    horarioPartida: document.getElementById('horarioPartida').value,
                    tipoCompanhia: document.getElementById('tipoCompanhia').value,
                    quantidade: document.getElementById('quantidade').value || 1,
                    tipoViagem: document.getElementById('tipoViagem').value,
                    intensidade: document.getElementById('intensidade').value,
                    nivelOrcamento: document.getElementById('nivelOrcamento').value
                };
            }

            async generateItinerary(formData) {
                try {
                    console.log('🤖 Chamando API real de roteiro...', formData);
                    
                    // ✅ CHAMADA REAL para a mesma API do projeto atual
                    const parametrosIA = {
                        destino: formData.destino,
                        pais: this.extrairPais(formData.destino),
                        dataInicio: formData.dataIda,
                        dataFim: formData.dataVolta,
                        horaChegada: formData.horarioChegada,
                        horaSaida: formData.horarioPartida,
                        tipoViagem: formData.tipoViagem,
                        tipoCompanhia: formData.tipoCompanhia,
                        preferencias: {
                            intensidade: formData.intensidade,
                            nivelOrcamento: formData.nivelOrcamento,
                            quantidade: formData.quantidade
                        },
                        modeloIA: 'deepseek' // Usar DeepSeek como padrão
                    };
                    
                    console.log('📡 Enviando para API:', parametrosIA);
                    
                    const response = await fetch('/api/itinerary-generator', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(parametrosIA)
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
                    }
                    
                    const roteiroIA = await response.json();
                    console.log('✅ Roteiro recebido da IA:', roteiroIA);
                    
                    // ✅ Converter para formato de exibição (igual ao modelo atual)
                    return this.converterRoteiroParaExibicao(roteiroIA, formData);
                    
                } catch (erro) {
                    console.error('❌ Erro na API, usando fallback:', erro);
                    
                    // ✅ FALLBACK: Se API falhar, gerar roteiro básico
                    this.showToast('API indisponível. Gerando roteiro básico...', 'warning');
                    return this.gerarRoteiroFallback(formData);
                }
            }

            extrairPais(destino) {
                // ✅ Extração inteligente do país baseada no destino
                const destinoLower = destino.toLowerCase();
                
                // Principais destinos por país
                const mapeamentoPaises = {
                    'portugal': ['lisboa', 'porto', 'coimbra', 'faro', 'braga'],
                    'espanha': ['madrid', 'barcelona', 'sevilla', 'valencia', 'bilbao'],
                    'frança': ['paris', 'nice', 'lyon', 'marseille', 'bordeaux'],
                    'itália': ['roma', 'milão', 'veneza', 'florença', 'nápoles'],
                    'alemanha': ['berlim', 'munique', 'hamburgo', 'colônia', 'frankfurt'],
                    'holanda': ['amsterdã', 'roterdã', 'haia', 'utrecht'],
                    'reino unido': ['londres', 'edimburgo', 'manchester', 'liverpool'],
                    'argentina': ['buenos aires', 'córdoba', 'mendoza', 'rosário'],
                    'chile': ['santiago', 'valparaíso', 'antofagasta', 'viña del mar'],
                    'uruguai': ['montevidéu', 'punta del este', 'colonia'],
                    'peru': ['lima', 'cusco', 'arequipa', 'trujillo'],
                    'colômbia': ['bogotá', 'medellín', 'cartagena', 'cali'],
                    'estados unidos': ['nova york', 'los angeles', 'miami', 'chicago', 'orlando'],
                    'canadá': ['toronto', 'vancouver', 'montreal', 'ottawa']
                };
                
                // Buscar país baseado na cidade
                for (const [pais, cidades] of Object.entries(mapeamentoPaises)) {
                    if (cidades.some(cidade => destinoLower.includes(cidade))) {
                        return pais.charAt(0).toUpperCase() + pais.slice(1);
                    }
                }
                
                // Se contém vírgula, extrair parte após vírgula
                if (destino.includes(',')) {
                    return destino.split(',')[1].trim();
                }
                
                return 'Internacional'; // Fallback
            }

            converterRoteiroParaExibicao(roteiroIA, formData) {
                console.log('🔄 Convertendo roteiro da IA para exibição...');
                
                try {
                    // ✅ Garantir que temos a estrutura correta
                    if (!roteiroIA.dias || !Array.isArray(roteiroIA.dias)) {
                        throw new Error('Estrutura de roteiro inválida da IA');
                    }
                    
                    const diasViagem = this.calcularDiasViagem(formData.dataIda, formData.dataVolta);
                    
                    return {
                        destino: roteiroIA.destino || formData.destino,
                        resumo: {
                            destino: formData.destino,
                            cidadePartida: formData.cidadePartida,
                            dataIda: formData.dataIda,
                            dataVolta: formData.dataVolta,
                            horarioChegada: formData.horarioChegada,
                            horarioPartida: formData.horarioPartida,
                            diasViagem: diasViagem,
                            tipoCompanhia: formData.tipoCompanhia,
                            quantidade: formData.quantidade,
                            tipoViagem: formData.tipoViagem
                        },
                        dias: this.processarDiasIA(roteiroIA.dias, formData)
                    };
                    
                } catch (erro) {
                    console.error('❌ Erro ao converter roteiro da IA:', erro);
                    return this.gerarRoteiroFallback(formData);
                }
            }

            processarDiasIA(diasIA, formData) {
                const dias = diasIA.map((diaIA, index) => {
                    const dataAtual = new Date(formData.dataIda);
                    dataAtual.setDate(dataAtual.getDate() + index);
                    
                    const dia = {
                        numero: index + 1,
                        data: this.formatDate(dataAtual),
                        dataFormatada: this.formatarDataCompleta(dataAtual),
                        descricao: diaIA.descricao || this.obterDescricaoDia(index + 1, formData.destino, diasIA.length),
                        atividades: this.processarAtividadesIA(diaIA, formData)
                    };
                    
                    return dia;
                });
                
                // ✅ Ajustar primeiro e último dia baseado nos horários de voo
                this.ajustarAtividadesPorHorarios(dias, formData);
                
                return dias;
            }

            ajustarAtividadesPorHorarios(dias, formData) {
                if (dias.length === 0) return;
                
                const horaChegada = parseInt(formData.horarioChegada.split(':')[0]);
                const horaPartida = parseInt(formData.horarioPartida.split(':')[0]);
                
                // ✅ AJUSTAR PRIMEIRO DIA
                const primeiroDia = dias[0];
                
                if (horaChegada >= 20) {
                    // Chegada muito tarde - apenas check-in
                    primeiroDia.atividades = [{
                        horario: formData.horarioChegada,
                        local: 'Chegada e Check-in no Hotel',
                        tags: ['Chegada', 'Descanso'],
                        dica: 'Chegada tarde - descanse bem para aproveitar amanhã!'
                    }];
                    primeiroDia.descricao = `Chegada tardia em ${formData.destino} - tempo para descansar.`;
                } else if (horaChegada >= 16) {
                    // Chegada à tarde - poucas atividades
                    primeiroDia.atividades = [
                        {
                            horario: formData.horarioChegada,
                            local: 'Chegada e Check-in',
                            tags: ['Chegada'],
                            dica: 'Deixe as bagagens e saia para explorar!'
                        },
                        ...primeiroDia.atividades.slice(0, 2).map(ativ => ({
                            ...ativ,
                            horario: this.ajustarHorarioAposChegada(ativ.horario, horaChegada)
                        }))
                    ];
                } else if (horaChegada >= 12) {
                    // Chegada meio-dia - atividades da tarde
                    primeiroDia.atividades = [
                        {
                            horario: formData.horarioChegada,
                            local: 'Chegada e Check-in',
                            tags: ['Chegada'],
                            dica: 'Chegada na hora certa para aproveitar a tarde!'
                        },
                        ...primeiroDia.atividades.filter(ativ => parseInt(ativ.horario.split(':')[0]) >= 14)
                    ];
                } else {
                    // Chegada manhã - dia completo
                    primeiroDia.atividades = [
                        {
                            horario: formData.horarioChegada,
                            local: 'Chegada - Dia completo pela frente!',
                            tags: ['Chegada', 'Dia Completo'],
                            dica: 'Chegada cedo - aproveite o dia inteiro!'
                        },
                        ...primeiroDia.atividades
                    ];
                }
                
                // ✅ AJUSTAR ÚLTIMO DIA
                if (dias.length > 1) {
                    const ultimoDia = dias[dias.length - 1];
                    
                    if (horaPartida <= 8) {
                        // Voo muito cedo - check-out apenas
                        ultimoDia.atividades = [{
                            horario: '06:00',
                            local: 'Check-out e Transfer para Aeroporto',
                            tags: ['Partida', 'Voo Cedo'],
                            dica: 'Voo bem cedo - organize tudo na noite anterior!'
                        }];
                        ultimoDia.descricao = `Partida matinal de ${formData.destino} - prepare-se na véspera.`;
                    } else if (horaPartida <= 12) {
                        // Voo manhã - poucas atividades
                        ultimoDia.atividades = [
                            ...ultimoDia.atividades.filter(ativ => parseInt(ativ.horario.split(':')[0]) <= 9),
                            {
                                horario: this.calcularHorarioCheckout(horaPartida),
                                local: 'Check-out e Transfer para Aeroporto',
                                tags: ['Partida'],
                                dica: 'Chegue ao aeroporto com 2h de antecedência!'
                            }
                        ];
                    } else if (horaPartida <= 18) {
                        // Voo tarde - manhã livre
                        ultimoDia.atividades = [
                            ...ultimoDia.atividades.filter(ativ => parseInt(ativ.horario.split(':')[0]) <= 14),
                            {
                                horario: this.calcularHorarioCheckout(horaPartida),
                                local: 'Transfer para Aeroporto',
                                tags: ['Partida'],
                                dica: 'Última chance de comprar lembranças!'
                            }
                        ];
                    } else {
                        // Voo noite - dia quase completo
                        ultimoDia.atividades = [
                            ...ultimoDia.atividades,
                            {
                                horario: this.calcularHorarioCheckout(horaPartida),
                                local: 'Transfer para Aeroporto',
                                tags: ['Partida'],
                                dica: 'Voo noturno - aproveite o dia completo!'
                            }
                        ];
                    }
                }
            }

            ajustarHorarioAposChegada(horarioOriginal, horaChegada) {
                const [hora] = horarioOriginal.split(':');
                const novaHora = Math.max(parseInt(hora), horaChegada + 2);
                return `${novaHora.toString().padStart(2, '0')}:00`;
            }

            calcularHorarioCheckout(horaPartida) {
                const horarioCheckout = Math.max(6, horaPartida - 3);
                return `${horarioCheckout.toString().padStart(2, '0')}:00`;
            }

            processarAtividadesIA(diaIA, formData) {
                const atividades = [];
                
                // ✅ Processar atividades do formato da IA
                if (diaIA.atividades && Array.isArray(diaIA.atividades)) {
                    // Formato contínuo (atual)
                    return diaIA.atividades.map(ativ => ({
                        horario: ativ.horario || '09:00',
                        local: ativ.local || 'Atividade local',
                        tags: ativ.tags || ['Recomendado'],
                        dica: ativ.dica || 'Aproveite esta experiência única!'
                    }));
                }
                
                // ✅ Processar formato por períodos (manhã, tarde, noite)
                ['manha', 'tarde', 'noite'].forEach(periodo => {
                    if (diaIA[periodo]?.atividades?.length) {
                        diaIA[periodo].atividades.forEach(ativ => {
                            atividades.push({
                                horario: ativ.horario || this.obterHorarioPorPeriodo(periodo),
                                local: ativ.local || 'Atividade local',
                                tags: ativ.tags || ['Recomendado'],
                                dica: ativ.dica || 'Aproveite esta experiência única!'
                            });
                        });
                    }
                });
                
                // ✅ Se não temos atividades, gerar básicas
                if (atividades.length === 0) {
                    return this.gerarAtividadesFallback(formData, 0);
                }
                
                return atividades;
            }

            obterHorarioPorPeriodo(periodo) {
                const horarios = {
                    'manha': '09:00',
                    'tarde': '14:00',
                    'noite': '19:00'
                };
                return horarios[periodo] || '12:00';
            }

            gerarRoteiroFallback(formData) {
                console.log('🛡️ Gerando roteiro fallback...');
                
                const diasViagem = this.calcularDiasViagem(formData.dataIda, formData.dataVolta);
                
                const dias = [];
                for (let i = 0; i < diasViagem; i++) {
                    const dataAtual = new Date(formData.dataIda);
                    dataAtual.setDate(dataAtual.getDate() + i);
                    
                    dias.push({
                        numero: i + 1,
                        data: this.formatDate(dataAtual),
                        dataFormatada: this.formatarDataCompleta(dataAtual),
                        descricao: this.obterDescricaoDia(i + 1, formData.destino, diasViagem),
                        atividades: this.gerarAtividadesFallback(formData, i)
                    });
                }
                
                // ✅ Aplicar ajustes de horário também no fallback
                this.ajustarAtividadesPorHorarios(dias, formData);
                
                return {
                    destino: formData.destino,
                    resumo: {
                        destino: formData.destino,
                        cidadePartida: formData.cidadePartida,
                        dataIda: formData.dataIda,
                        dataVolta: formData.dataVolta,
                        horarioChegada: formData.horarioChegada,
                        horarioPartida: formData.horarioPartida,
                        diasViagem: diasViagem,
                        tipoCompanhia: formData.tipoCompanhia,
                        quantidade: formData.quantidade,
                        tipoViagem: formData.tipoViagem
                    },
                    dias: dias
                };
            }

            gerarAtividadesFallback(formData, diaIndex) {
                const atividadesPorTipo = {
                    relaxar: [
                        { local: "Spa ou centro de bem-estar", tags: ["Relaxante", "Bem-estar"], dica: "Reserve com antecedência para garantir!" },
                        { local: "Praia ou parque tranquilo", tags: ["Natureza", "Relaxante"], dica: "Leve protetor solar e água!" },
                        { local: "Café com vista panorâmica", tags: ["Gastronomia", "Vista"], dica: "Ideal para contemplar o pôr do sol!" },
                        { local: "Jardim botânico local", tags: ["Natureza", "Paz"], dica: "Perfeito para um passeio contemplativo!" }
                    ],
                    aventura: [
                        { local: "Trilha ou caminhada local", tags: ["Aventura", "Natureza"], dica: "Leve água, lanche e use calçado adequado!" },
                        { local: "Atividade radical (rapel, escalada)", tags: ["Aventura", "Radical"], dica: "Verifique as condições climáticas!" },
                        { local: "Passeio de bike pela cidade", tags: ["Aventura", "Esporte"], dica: "Explore pontos que não chegaria a pé!" },
                        { local: "Esporte aquático (kayak, stand up)", tags: ["Aventura", "Água"], dica: "Experiência refrescante e divertida!" }
                    ],
                    cultura: [
                        { local: "Museu principal da cidade", tags: ["Cultural", "História"], dica: "Chegue cedo para evitar filas!" },
                        { local: "Centro histórico", tags: ["Cultural", "Arquitetura"], dica: "Faça um tour guiado para mais contexto!" },
                        { local: "Teatro ou casa de espetáculos", tags: ["Cultural", "Arte"], dica: "Verifique a programação local!" },
                        { local: "Mercado tradicional", tags: ["Cultural", "Gastronomia"], dica: "Prove especialidades locais!" }
                    ],
                    urbano: [
                        { local: "Shopping ou centro comercial", tags: ["Compras", "Urbano"], dica: "Aproveite as promoções locais!" },
                        { local: "Bairro moderno da cidade", tags: ["Urbano", "Arquitetura"], dica: "Ótimo para fotos e selfies!" },
                        { local: "Rooftop bar ou restaurante", tags: ["Urbano", "Vida Noturna"], dica: "Vista incrível da cidade!" },
                        { local: "Food hall ou praça gastronômica", tags: ["Gastronomia", "Urbano"], dica: "Diversidade culinária em um só lugar!" }
                    ]
                };
                
                const atividades = atividadesPorTipo[formData.tipoViagem] || atividadesPorTipo.cultura;
                const numAtividades = this.obterNumeroAtividades(formData.intensidade);
                const horarios = ['09:00', '11:30', '14:00', '16:30', '19:00'];
                
                const atividadesDia = [];
                for (let i = 0; i < numAtividades; i++) {
                    const atividadeIndex = (diaIndex * numAtividades + i) % atividades.length;
                    const atividade = { ...atividades[atividadeIndex] };
                    atividade.horario = horarios[i % horarios.length];
                    atividadesDia.push(atividade);
                }
                
                return atividadesDia;
            }

            calcularDiasViagem(dataIda, dataVolta) {
                const ida = new Date(dataIda);
                const volta = new Date(dataVolta);
                const diffTime = Math.abs(volta - ida);
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            }

            gerarDiasRoteiro(formData, diasViagem) {
                const dias = [];
                const dataInicio = new Date(formData.dataIda);
                
                for (let i = 0; i < diasViagem; i++) {
                    const dataAtual = new Date(dataInicio);
                    dataAtual.setDate(dataInicio.getDate() + i);
                    
                    const dia = {
                        numero: i + 1,
                        data: this.formatDate(dataAtual),
                        dataFormatada: this.formatarDataCompleta(dataAtual),
                        descricao: this.obterDescricaoDia(i + 1, formData.destino, diasViagem),
                        atividades: this.gerarAtividades(formData, i, diasViagem)
                    };
                    
                    dias.push(dia);
                }
                
                return dias;
            }

            obterDescricaoDia(numeroDia, destino, totalDias) {
                const descricoes = {
                    1: `Chegada e primeiras impressões de ${destino}!`,
                    [`${totalDias}`]: `Últimos momentos para aproveitar ${destino} antes da partida.`
                };
                
                if (descricoes[numeroDia]) {
                    return descricoes[numeroDia];
                }
                
                const genéricas = [
                    `Explorando os tesouros escondidos de ${destino}.`,
                    `Dia de imersão cultural em ${destino}.`,
                    `Descobrindo a gastronomia e vida local de ${destino}.`,
                    `Aventuras inesquecíveis em ${destino}.`,
                    `Vivenciando o melhor que ${destino} tem a oferecer.`
                ];
                
                return genéricas[(numeroDia - 2) % genéricas.length];
            }

            gerarAtividades(formData, diaIndex, totalDias) {
                const atividadesPorTipo = {
                    relaxar: [
                        { local: "Spa local", tags: ["Relaxante", "Bem-estar"], dica: "Reserve com antecedência!" },
                        { local: "Praia próxima", tags: ["Natureza", "Relaxante"], dica: "Vá cedo para pegar um bom local!" },
                        { local: "Parque municipal", tags: ["Natureza", "Caminhada"], dica: "Perfeito para um piquenique!" },
                        { local: "Café com vista", tags: ["Gastronomia", "Vista"], dica: "Ideal para o pôr do sol!" }
                    ],
                    aventura: [
                        { local: "Trilha local", tags: ["Aventura", "Natureza"], dica: "Leve água e protetor solar!" },
                        { local: "Escalada indoor", tags: ["Aventura", "Esporte"], dica: "Atividade para todas as idades!" },
                        { local: "Passeio de bike", tags: ["Aventura", "Esporte"], dica: "Explore a cidade de forma divertida!" },
                        { local: "Rafting no rio", tags: ["Aventura", "Radical"], dica: "Experiência inesquecível!" }
                    ],
                    cultura: [
                        { local: "Museu principal", tags: ["Cultural", "História"], dica: "Chegue cedo para evitar filas!" },
                        { local: "Centro histórico", tags: ["Cultural", "História"], dica: "Faça um tour guiado!" },
                        { local: "Teatro local", tags: ["Cultural", "Arte"], dica: "Verifique a programação!" },
                        { local: "Galeria de arte", tags: ["Cultural", "Arte"], dica: "Exposições temporárias são imperdíveis!" }
                    ],
                    urbano: [
                        { local: "Shopping center", tags: ["Compras", "Urbano"], dica: "Aproveite as promoções!" },
                        { local: "Bairro moderno", tags: ["Urbano", "Arquitetura"], dica: "Ótimo para fotos!" },
                        { local: "Bar na cobertura", tags: ["Urbano", "Vida Noturna"], dica: "Vista incrível da cidade!" },
                        { local: "Mercado gastronômico", tags: ["Gastronomia", "Urbano"], dica: "Prove pratos locais!" }
                    ]
                };
                
                const atividades = atividadesPorTipo[formData.tipoViagem] || atividadesPorTipo.cultura;
                const numAtividades = this.obterNumeroAtividades(formData.intensidade);
                
                const atividadesDia = [];
                const horarios = ['09:00', '11:30', '14:00', '16:30', '19:00'];
                
                for (let i = 0; i < numAtividades; i++) {
                    const atividadeIndex = (diaIndex * numAtividades + i) % atividades.length;
                    const atividade = { ...atividades[atividadeIndex] };
                    atividade.horario = horarios[i % horarios.length];
                    
                    atividadesDia.push(atividade);
                }
                
                return atividadesDia;
            }

            obterNumeroAtividades(intensidade) {
                const mapa = {
                    leve: 2,
                    moderado: 3,
                    intenso: 4
                };
                return mapa[intensidade] || 3;
            }

            displayItinerary(roteiro) {
                const html = `
                    <div class="result-header">
                        <div class="tripinha-avatar">🐕</div>
                        <h2>Seu Roteiro para ${roteiro.destino}</h2>
                    </div>
                    
                    <div class="resumo-viagem">
                        <div class="resumo-item">
                            <div class="icone">🎯</div>
                            <div class="texto">
                                <div class="label">Destino:</div>
                                <p class="valor">${roteiro.resumo.destino}</p>
                            </div>
                        </div>
                        
                        <div class="resumo-item">
                            <div class="icone">📅</div>
                            <div class="texto">
                                <div class="label">Período:</div>
                                <p class="valor">${this.formatarDataBrasil(roteiro.resumo.dataIda)} até ${this.formatarDataBrasil(roteiro.resumo.dataVolta)}</p>
                            </div>
                        </div>
                        
                        <div class="resumo-item">
                            <div class="icone">${this.obterIconeCompanhia(roteiro.resumo.tipoCompanhia)}</div>
                            <div class="texto">
                                <div class="label">Viajando:</div>
                                <p class="valor">${this.obterTextoCompanhia(roteiro.resumo.tipoCompanhia, roteiro.resumo.quantidade)}</p>
                            </div>
                        </div>
                        
                        <div class="resumo-item">
                            <div class="icone">${this.obterIconeViagem(roteiro.resumo.tipoViagem)}</div>
                            <div class="texto">
                                <div class="label">Estilo:</div>
                                <p class="valor">${this.obterTextoViagem(roteiro.resumo.tipoViagem)}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="roteiro-content">
                        ${roteiro.dias.map(dia => this.criarElementoDia(dia)).join('')}
                    </div>
                `;
                
                this.resultContainer.innerHTML = html;
                this.resultContainer.classList.add('visible');
                
                // Scroll suave para o resultado
                setTimeout(() => {
                    this.resultContainer.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                }, 300);
            }

            criarElementoDia(dia) {
                return `
                    <div class="dia-roteiro">
                        <div class="dia-header">
                            <div class="dia-numero">${dia.numero}</div>
                            <span>Dia ${dia.numero} — ${dia.dataFormatada}</span>
                        </div>
                        
                        <div class="dia-content">
                            <p class="dia-descricao">"${dia.descricao}"</p>
                            
                            <div class="atividades-lista">
                                ${dia.atividades.map(atividade => this.criarElementoAtividade(atividade)).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }

            criarElementoAtividade(atividade) {
                return `
                    <div class="atividade-item">
                        <div class="atividade-horario">
                            <span>🕒</span>
                            <span>${atividade.horario}</span>
                        </div>
                        
                        <div class="atividade-local">${atividade.local}</div>
                        
                        <div class="atividade-tags">
                            ${atividade.tags.map(tag => `
                                <span class="badge ${this.getClasseBadge(tag)}">${tag}</span>
                            `).join('')}
                        </div>
                        
                        <div class="atividade-dica">
                            <span class="dica-icon">🐕</span>
                            <div class="dica-texto">
                                <strong>Dica da Tripinha:</strong> ${atividade.dica}
                            </div>
                        </div>
                    </div>
                `;
            }

            getClasseBadge(tag) {
                const classes = {
                    'Imperdível': 'badge-destaque',
                    'Cultural': 'badge-cultura',
                    'História': 'badge-cultura',
                    'Arte': 'badge-cultura',
                    'Gastronomia': 'badge-gastronomia',
                    'Natureza': 'badge-natureza',
                    'Aventura': 'badge-natureza',
                    'Compras': 'badge-compras',
                    'Urbano': 'badge-compras'
                };
                
                return classes[tag] || 'badge-padrao';
            }

            formatarDataBrasil(dataStr) {
                const data = new Date(dataStr);
                return data.toLocaleDateString('pt-BR');
            }

            formatarDataCompleta(data) {
                const options = {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'numeric'
                };
                
                const formatada = data.toLocaleDateString('pt-BR', options);
                return formatada.charAt(0).toUpperCase() + formatada.slice(1);
            }

            obterIconeCompanhia(tipo) {
                const icones = {
                    sozinho: '🧳',
                    casal: '❤️',
                    familia: '👨‍👩‍👧‍👦',
                    amigos: '🎉'
                };
                return icones[tipo] || '👤';
            }

            obterTextoCompanhia(tipo, quantidade) {
                const textos = {
                    sozinho: 'Viagem Solo',
                    casal: 'Casal',
                    familia: `Família (${quantidade} pessoas)`,
                    amigos: `Grupo de Amigos (${quantidade} pessoas)`
                };
                return textos[tipo] || 'Viagem Individual';
            }

            obterIconeViagem(tipo) {
                const icones = {
                    relaxar: '🏖️',
                    aventura: '🏔️',
                    cultura: '🏛️',
                    urbano: '🏙️'
                };
                return icones[tipo] || '✨';
            }

            obterTextoViagem(tipo) {
                const textos = {
                    relaxar: 'Relaxamento e Descanso',
                    aventura: 'Aventura e Natureza',
                    cultura: 'Cultura e História',
                    urbano: 'Urbano e Moderno'
                };
                return textos[tipo] || 'Experiências Variadas';
            }

            showLoading(show) {
                if (show) {
                    this.generateBtn.disabled = true;
                    this.generateBtn.classList.add('loading');
                    this.btnText.textContent = 'Criando roteiro...';
                    this.btnSpinner.style.display = 'block';
                } else {
                    this.generateBtn.disabled = false;
                    this.generateBtn.classList.remove('loading');
                    this.btnText.textContent = '🎯 Criar Meu Roteiro';
                    this.btnSpinner.style.display = 'none';
                }
            }

            showToast(message, type = 'info') {
                const container = document.getElementById('toastContainer');
                
                const toast = document.createElement('div');
                toast.className = `toast toast-${type}`;
                
                const icons = {
                    success: '✅',
                    error: '❌',
                    info: 'ℹ️',
                    warning: '⚠️'
                };
                
                toast.innerHTML = `
                    <span class="toast-icon">${icons[type] || icons.info}</span>
                    <span class="toast-message">${message}</span>
                `;
                
                container.appendChild(toast);
                
                requestAnimationFrame(() => {
                    toast.classList.add('toast-visible');
                });
                
                setTimeout(() => {
                    toast.classList.remove('toast-visible');
                    setTimeout(() => toast.remove(), 300);
                }, 4000);
            }

            delay(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }
        }

        // ✅ INICIALIZAÇÃO
        document.addEventListener('DOMContentLoaded', () => {
            new BenetripManualItinerary();
        });
    </script>
</body>
</html>
