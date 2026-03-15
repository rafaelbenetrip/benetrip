/**
 * ============================================
 * BENETRIP LOGIN MODAL - benetrip-login-modal.js v2.0
 * ============================================
 * Modal de login/cadastro reutilizavel.
 * Segue identidade visual da Benetrip.
 *
 * NOVIDADES v2.0:
 * - Magic link (login sem senha)
 * - Validacao de senha em tempo real com checklist
 * - Redirect para URL original apos login
 * - Onboarding pos-registro
 * - Cooldown contra brute force
 * - Melhor feedback de erros
 *
 * COMO USAR:
 * BenetripLoginModal.open()             - abre o modal (login)
 * BenetripLoginModal.open('signup')     - abre direto no cadastro
 * BenetripLoginModal.open('login', '/minha-conta.html') - abre com redirect
 * BenetripLoginModal.close()            - fecha o modal
 */

const BenetripLoginModal = (function () {
    'use strict';

    const THEME = {
        primary: '#E87722',
        primaryHover: '#D06A1D',
        secondary: '#00A3E0',
        secondaryHover: '#008FC4',
        dark: '#21272A',
        white: '#FFFFFF',
        lightGray: '#F5F5F5',
        mediumGray: '#E0E0E0',
        error: '#E53935',
        success: '#43A047',
    };

    let modalElement = null;
    let currentView = 'login'; // 'login' | 'signup' | 'forgot' | 'magic' | 'onboarding'
    let isLoading = false;
    let redirectAfterLogin = null;
    let failedAttempts = 0;
    let cooldownUntil = 0;

    // ==========================================
    // CRIAR MODAL HTML
    // ==========================================

    function _createModal() {
        if (modalElement) return;

        const modal = document.createElement('div');
        modal.id = 'benetrip-auth-modal';
        modal.innerHTML = `
            <div class="benetrip-modal-overlay" id="benetrip-modal-overlay">
                <div class="benetrip-modal-container">
                    <!-- Header com Tripinha -->
                    <div class="benetrip-modal-header">
                        <button class="benetrip-modal-close" id="benetrip-modal-close" aria-label="Fechar">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                        <div class="benetrip-modal-mascot">
                            <img src="assets/tripinha-avatar.png" alt="Tripinha" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                            <div class="benetrip-modal-mascot-fallback" style="display:none;">&#x1F415;</div>
                        </div>
                        <h2 class="benetrip-modal-title" id="benetrip-modal-title">Bem-vindo!!</h2>
                        <p class="benetrip-modal-subtitle" id="benetrip-modal-subtitle">
                            A Tripinha guardou seu lugar!
                        </p>
                    </div>

                    <!-- Mensagem de feedback -->
                    <div class="benetrip-modal-message" id="benetrip-modal-message" style="display:none;"></div>

                    <!-- Conteudo do modal -->
                    <div class="benetrip-modal-body" id="benetrip-modal-body">

                        <!-- ===== VIEW: LOGIN ===== -->
                        <div class="benetrip-auth-view" id="benetrip-view-login">
                            <!-- Social Login -->
                            <div class="benetrip-social-buttons">
                                <button class="benetrip-btn-social benetrip-btn-google" id="benetrip-btn-google">
                                    <svg width="20" height="20" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    <span>Continuar com Google</span>
                                </button>
                                <button class="benetrip-btn-social benetrip-btn-facebook" id="benetrip-btn-facebook">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                    </svg>
                                    <span>Continuar com Facebook</span>
                                </button>
                            </div>

                            <div class="benetrip-divider">
                                <span>ou entre com email</span>
                            </div>

                            <!-- Email/Password Form -->
                            <form class="benetrip-form" id="benetrip-form-login" novalidate>
                                <div class="benetrip-input-group">
                                    <label for="benetrip-login-email">Email</label>
                                    <input type="email" id="benetrip-login-email"
                                           placeholder="seu@email.com"
                                           autocomplete="email" required />
                                </div>
                                <div class="benetrip-input-group">
                                    <label for="benetrip-login-password">
                                        Senha
                                        <a href="#" class="benetrip-link-forgot" id="benetrip-link-forgot">Esqueci minha senha</a>
                                    </label>
                                    <div class="benetrip-password-wrapper">
                                        <input type="password" id="benetrip-login-password"
                                               placeholder="Sua senha"
                                               autocomplete="current-password" required />
                                        <button type="button" class="benetrip-password-toggle" data-target="benetrip-login-password" aria-label="Mostrar senha">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                <circle cx="12" cy="12" r="3"></circle>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" class="benetrip-btn-primary" id="benetrip-btn-login">
                                    <span class="benetrip-btn-text">Entrar</span>
                                    <span class="benetrip-btn-loading" style="display:none;">
                                        <svg class="benetrip-spinner" width="20" height="20" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" stroke="white" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-linecap="round">
                                                <animateTransform attributeName="transform" type="rotate" dur="0.8s" from="0 12 12" to="360 12 12" repeatCount="indefinite"/>
                                            </circle>
                                        </svg>
                                    </span>
                                </button>
                            </form>

                            <div class="benetrip-magic-link-area">
                                <button class="benetrip-btn-magic" id="benetrip-btn-magic-link">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                    </svg>
                                    Entrar com link magico (sem senha)
                                </button>
                            </div>

                            <p class="benetrip-switch-view">
                                Nao tem uma conta? <a href="#" id="benetrip-link-signup">Criar conta</a>
                            </p>
                        </div>

                        <!-- ===== VIEW: SIGNUP ===== -->
                        <div class="benetrip-auth-view" id="benetrip-view-signup" style="display:none;">
                            <div class="benetrip-social-buttons">
                                <button class="benetrip-btn-social benetrip-btn-google" id="benetrip-btn-google-signup">
                                    <svg width="20" height="20" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    <span>Criar conta com Google</span>
                                </button>
                                <button class="benetrip-btn-social benetrip-btn-facebook" id="benetrip-btn-facebook-signup">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                    </svg>
                                    <span>Criar conta com Facebook</span>
                                </button>
                            </div>

                            <div class="benetrip-divider">
                                <span>ou cadastre com email</span>
                            </div>

                            <form class="benetrip-form" id="benetrip-form-signup" novalidate>
                                <div class="benetrip-input-group">
                                    <label for="benetrip-signup-name">Seu nome</label>
                                    <input type="text" id="benetrip-signup-name"
                                           placeholder="Como a Tripinha te chama?"
                                           autocomplete="name" required />
                                </div>
                                <div class="benetrip-input-group">
                                    <label for="benetrip-signup-email">Email</label>
                                    <input type="email" id="benetrip-signup-email"
                                           placeholder="seu@email.com"
                                           autocomplete="email" required />
                                </div>
                                <div class="benetrip-input-group">
                                    <label for="benetrip-signup-password">Senha</label>
                                    <div class="benetrip-password-wrapper">
                                        <input type="password" id="benetrip-signup-password"
                                               placeholder="Crie uma senha forte"
                                               autocomplete="new-password"
                                               minlength="6" required />
                                        <button type="button" class="benetrip-password-toggle" data-target="benetrip-signup-password" aria-label="Mostrar senha">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                <circle cx="12" cy="12" r="3"></circle>
                                            </svg>
                                        </button>
                                    </div>
                                    <div class="benetrip-password-strength" id="benetrip-password-strength"></div>
                                    <div class="benetrip-password-checklist" id="benetrip-password-checklist">
                                        <div class="benetrip-check-item" data-check="length">
                                            <span class="benetrip-check-icon">&#x25CB;</span>
                                            Pelo menos 6 caracteres
                                        </div>
                                        <div class="benetrip-check-item" data-check="uppercase">
                                            <span class="benetrip-check-icon">&#x25CB;</span>
                                            Uma letra maiuscula
                                        </div>
                                        <div class="benetrip-check-item" data-check="number">
                                            <span class="benetrip-check-icon">&#x25CB;</span>
                                            Um numero
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" class="benetrip-btn-primary" id="benetrip-btn-signup">
                                    <span class="benetrip-btn-text">Criar conta gratuita</span>
                                    <span class="benetrip-btn-loading" style="display:none;">
                                        <svg class="benetrip-spinner" width="20" height="20" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" stroke="white" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-linecap="round">
                                                <animateTransform attributeName="transform" type="rotate" dur="0.8s" from="0 12 12" to="360 12 12" repeatCount="indefinite"/>
                                            </circle>
                                        </svg>
                                    </span>
                                </button>
                            </form>

                            <p class="benetrip-switch-view">
                                Ja tem uma conta? <a href="#" id="benetrip-link-login">Fazer login</a>
                            </p>
                        </div>

                        <!-- ===== VIEW: FORGOT PASSWORD ===== -->
                        <div class="benetrip-auth-view" id="benetrip-view-forgot" style="display:none;">
                            <form class="benetrip-form" id="benetrip-form-forgot" novalidate>
                                <div class="benetrip-input-group">
                                    <label for="benetrip-forgot-email">Email cadastrado</label>
                                    <input type="email" id="benetrip-forgot-email"
                                           placeholder="seu@email.com"
                                           autocomplete="email" required />
                                </div>
                                <button type="submit" class="benetrip-btn-primary" id="benetrip-btn-forgot">
                                    <span class="benetrip-btn-text">Enviar link de recuperacao</span>
                                    <span class="benetrip-btn-loading" style="display:none;">
                                        <svg class="benetrip-spinner" width="20" height="20" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" stroke="white" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-linecap="round">
                                                <animateTransform attributeName="transform" type="rotate" dur="0.8s" from="0 12 12" to="360 12 12" repeatCount="indefinite"/>
                                            </circle>
                                        </svg>
                                    </span>
                                </button>
                            </form>

                            <p class="benetrip-switch-view">
                                <a href="#" id="benetrip-link-back-login">&larr; Voltar para o login</a>
                            </p>
                        </div>

                        <!-- ===== VIEW: MAGIC LINK ===== -->
                        <div class="benetrip-auth-view" id="benetrip-view-magic" style="display:none;">
                            <div class="benetrip-magic-info">
                                <p>Enviaremos um link para seu email. Clique nele para entrar sem precisar de senha!</p>
                            </div>
                            <form class="benetrip-form" id="benetrip-form-magic" novalidate>
                                <div class="benetrip-input-group">
                                    <label for="benetrip-magic-email">Seu email</label>
                                    <input type="email" id="benetrip-magic-email"
                                           placeholder="seu@email.com"
                                           autocomplete="email" required />
                                </div>
                                <button type="submit" class="benetrip-btn-primary benetrip-btn-magic-submit">
                                    <span class="benetrip-btn-text">Enviar link magico</span>
                                    <span class="benetrip-btn-loading" style="display:none;">
                                        <svg class="benetrip-spinner" width="20" height="20" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" stroke="white" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-linecap="round">
                                                <animateTransform attributeName="transform" type="rotate" dur="0.8s" from="0 12 12" to="360 12 12" repeatCount="indefinite"/>
                                            </circle>
                                        </svg>
                                    </span>
                                </button>
                            </form>

                            <p class="benetrip-switch-view">
                                <a href="#" id="benetrip-link-back-login-magic">&larr; Voltar para o login</a>
                            </p>
                        </div>

                        <!-- ===== VIEW: ONBOARDING POS-REGISTRO ===== -->
                        <div class="benetrip-auth-view" id="benetrip-view-onboarding" style="display:none;">
                            <div class="benetrip-onboarding-content">
                                <div class="benetrip-onboarding-welcome">
                                    <h3>Conta criada com sucesso!</h3>
                                    <p>Conte para a Tripinha: como voce gosta de viajar?</p>
                                </div>
                                <form class="benetrip-form" id="benetrip-form-onboarding">
                                    <div class="benetrip-input-group">
                                        <label>Estilo de viagem preferido</label>
                                        <div class="benetrip-option-grid" id="benetrip-travel-style">
                                            <button type="button" class="benetrip-option-btn" data-value="relax">&#x1F3D6;&#xFE0F; Relaxar</button>
                                            <button type="button" class="benetrip-option-btn" data-value="aventura">&#x26F0;&#xFE0F; Aventura</button>
                                            <button type="button" class="benetrip-option-btn" data-value="cultura">&#x1F3DB;&#xFE0F; Cultura</button>
                                            <button type="button" class="benetrip-option-btn" data-value="urbano">&#x1F3D9;&#xFE0F; Urbano</button>
                                        </div>
                                    </div>
                                    <div class="benetrip-input-group">
                                        <label>Quem viaja com voce?</label>
                                        <div class="benetrip-option-grid" id="benetrip-travel-companion">
                                            <button type="button" class="benetrip-option-btn" data-value="solo">&#x1F9D1; Sozinho(a)</button>
                                            <button type="button" class="benetrip-option-btn" data-value="casal">&#x1F491; Casal</button>
                                            <button type="button" class="benetrip-option-btn" data-value="familia">&#x1F46A; Familia</button>
                                            <button type="button" class="benetrip-option-btn" data-value="amigos">&#x1F46B; Amigos</button>
                                        </div>
                                    </div>
                                    <button type="submit" class="benetrip-btn-primary">
                                        <span class="benetrip-btn-text">Pronto! Vamos viajar</span>
                                    </button>
                                    <button type="button" class="benetrip-btn-skip" id="benetrip-btn-skip-onboarding">
                                        Pular por enquanto
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="benetrip-modal-footer">
                        <p>Ao continuar, voce aceita os <a href="/termos.html" target="_blank">Termos de Uso</a> e a <a href="/privacidade.html" target="_blank">Politica de Privacidade</a> da Benetrip.</p>
                    </div>
                </div>
            </div>
        `;

        _injectStyles();
        document.body.appendChild(modal);
        modalElement = modal;
        _bindEvents();
    }

    // ==========================================
    // ESTILOS CSS
    // ==========================================

    function _injectStyles() {
        if (document.getElementById('benetrip-auth-styles')) return;

        const style = document.createElement('style');
        style.id = 'benetrip-auth-styles';
        style.textContent = `
            /* Overlay */
            .benetrip-modal-overlay {
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                opacity: 0;
                transition: opacity 0.25s ease;
            }
            .benetrip-modal-overlay.active { opacity: 1; }

            /* Container */
            .benetrip-modal-container {
                background: ${THEME.white};
                border-radius: 16px;
                width: 100%;
                max-width: 420px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                transform: translateY(20px) scale(0.95);
                transition: transform 0.3s ease;
                position: relative;
            }
            .benetrip-modal-overlay.active .benetrip-modal-container {
                transform: translateY(0) scale(1);
            }

            /* Header */
            .benetrip-modal-header {
                text-align: center;
                padding: 24px 24px 16px;
                position: relative;
            }
            .benetrip-modal-close {
                position: absolute;
                top: 12px; right: 12px;
                background: none; border: none;
                cursor: pointer; padding: 8px;
                border-radius: 50%; color: #666;
                transition: all 0.2s;
            }
            .benetrip-modal-close:hover {
                background: ${THEME.lightGray};
                color: ${THEME.dark};
            }
            .benetrip-modal-mascot {
                width: 64px; height: 64px;
                margin: 0 auto 12px;
            }
            .benetrip-modal-mascot img {
                width: 100%; height: 100%;
                object-fit: cover; border-radius: 50%;
            }
            .benetrip-modal-mascot-fallback {
                width: 64px; height: 64px;
                background: ${THEME.primary};
                border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                font-size: 32px;
            }
            .benetrip-modal-title {
                font-family: 'Poppins', sans-serif;
                font-size: 22px; font-weight: 700;
                color: ${THEME.dark}; margin: 0 0 4px;
            }
            .benetrip-modal-subtitle {
                font-family: 'Montserrat', sans-serif;
                font-size: 14px; color: #666; margin: 0;
            }

            /* Feedback Message */
            .benetrip-modal-message {
                margin: 0 24px;
                padding: 10px 14px;
                border-radius: 8px;
                font-size: 13px;
                font-family: 'Montserrat', sans-serif;
            }
            .benetrip-modal-message.error {
                background: #FFEBEE;
                color: ${THEME.error};
                border: 1px solid #FFCDD2;
            }
            .benetrip-modal-message.success {
                background: #E8F5E9;
                color: ${THEME.success};
                border: 1px solid #C8E6C9;
            }
            .benetrip-modal-message.info {
                background: #E3F2FD;
                color: #1565C0;
                border: 1px solid #BBDEFB;
            }

            /* Body */
            .benetrip-modal-body { padding: 0 24px; }

            /* Social Buttons */
            .benetrip-social-buttons {
                display: flex; flex-direction: column;
                gap: 10px; margin-bottom: 16px;
            }
            .benetrip-btn-social {
                display: flex; align-items: center; justify-content: center;
                gap: 10px; width: 100%;
                padding: 11px 16px; border-radius: 10px;
                border: 1.5px solid ${THEME.mediumGray};
                background: ${THEME.white}; cursor: pointer;
                font-family: 'Montserrat', sans-serif;
                font-size: 14px; font-weight: 500;
                color: ${THEME.dark}; transition: all 0.2s;
            }
            .benetrip-btn-social:hover {
                border-color: #bbb;
                background: ${THEME.lightGray};
            }
            .benetrip-btn-social:active { transform: scale(0.98); }

            /* Divider */
            .benetrip-divider {
                display: flex; align-items: center;
                margin: 16px 0; gap: 12px;
            }
            .benetrip-divider::before,
            .benetrip-divider::after {
                content: ''; flex: 1; height: 1px;
                background: ${THEME.mediumGray};
            }
            .benetrip-divider span {
                font-family: 'Montserrat', sans-serif;
                font-size: 12px; color: #999; white-space: nowrap;
            }

            /* Form */
            .benetrip-form {
                display: flex; flex-direction: column; gap: 14px;
            }
            .benetrip-input-group {
                display: flex; flex-direction: column; gap: 4px;
            }
            .benetrip-input-group label {
                font-family: 'Montserrat', sans-serif;
                font-size: 13px; font-weight: 600;
                color: ${THEME.dark};
                display: flex; justify-content: space-between; align-items: center;
            }
            .benetrip-link-forgot {
                font-size: 12px; font-weight: 400;
                color: ${THEME.secondary}; text-decoration: none;
            }
            .benetrip-link-forgot:hover { text-decoration: underline; }
            .benetrip-input-group input {
                width: 100%; padding: 11px 14px;
                border: 1.5px solid ${THEME.mediumGray};
                border-radius: 10px;
                font-family: 'Montserrat', sans-serif;
                font-size: 14px; color: ${THEME.dark};
                transition: border-color 0.2s;
                outline: none; box-sizing: border-box;
            }
            .benetrip-input-group input:focus {
                border-color: ${THEME.secondary};
                box-shadow: 0 0 0 3px rgba(0, 163, 224, 0.1);
            }
            .benetrip-input-group input::placeholder { color: #aaa; }

            /* Password wrapper */
            .benetrip-password-wrapper { position: relative; }
            .benetrip-password-wrapper input { padding-right: 44px; }
            .benetrip-password-toggle {
                position: absolute; right: 10px; top: 50%;
                transform: translateY(-50%);
                background: none; border: none;
                cursor: pointer; color: #999; padding: 4px;
            }
            .benetrip-password-toggle:hover { color: ${THEME.dark}; }

            /* Password strength bar */
            .benetrip-password-strength {
                height: 3px; border-radius: 3px;
                margin-top: 4px; transition: all 0.3s;
            }

            /* Password checklist */
            .benetrip-password-checklist {
                display: flex; flex-direction: column;
                gap: 4px; margin-top: 6px;
            }
            .benetrip-check-item {
                font-family: 'Montserrat', sans-serif;
                font-size: 12px; color: #999;
                display: flex; align-items: center; gap: 6px;
                transition: color 0.2s;
            }
            .benetrip-check-item.valid {
                color: ${THEME.success};
            }
            .benetrip-check-item.valid .benetrip-check-icon::after {
                content: '\\2713';
            }
            .benetrip-check-icon {
                font-size: 12px; width: 14px; text-align: center;
            }
            .benetrip-check-item.valid .benetrip-check-icon {
                color: ${THEME.success}; font-weight: 700;
            }

            /* Primary button */
            .benetrip-btn-primary {
                width: 100%; padding: 13px 16px;
                border: none; border-radius: 10px;
                background: ${THEME.primary};
                color: ${THEME.white};
                font-family: 'Poppins', sans-serif;
                font-size: 15px; font-weight: 600;
                cursor: pointer; transition: all 0.2s;
                display: flex; align-items: center; justify-content: center;
                gap: 8px; margin-top: 4px;
            }
            .benetrip-btn-primary:hover { background: ${THEME.primaryHover}; }
            .benetrip-btn-primary:active { transform: scale(0.98); }
            .benetrip-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

            /* Magic link button */
            .benetrip-magic-link-area {
                margin-top: 12px; text-align: center;
            }
            .benetrip-btn-magic {
                display: inline-flex; align-items: center; gap: 6px;
                background: none; border: none;
                font-family: 'Montserrat', sans-serif;
                font-size: 12px; color: ${THEME.secondary};
                cursor: pointer; padding: 6px 12px;
                border-radius: 8px; transition: all 0.2s;
            }
            .benetrip-btn-magic:hover {
                background: rgba(0, 163, 224, 0.08);
                color: ${THEME.secondaryHover};
            }

            /* Magic link info */
            .benetrip-magic-info {
                background: rgba(0, 163, 224, 0.06);
                border-radius: 10px; padding: 14px;
                margin-bottom: 16px;
            }
            .benetrip-magic-info p {
                font-family: 'Montserrat', sans-serif;
                font-size: 13px; color: #555;
                margin: 0; line-height: 1.5;
            }

            /* Skip button */
            .benetrip-btn-skip {
                width: 100%; padding: 10px;
                background: none; border: none;
                font-family: 'Montserrat', sans-serif;
                font-size: 13px; color: #999;
                cursor: pointer; transition: color 0.2s;
            }
            .benetrip-btn-skip:hover { color: ${THEME.dark}; }

            /* Onboarding */
            .benetrip-onboarding-welcome {
                text-align: center; margin-bottom: 16px;
            }
            .benetrip-onboarding-welcome h3 {
                font-family: 'Poppins', sans-serif;
                font-size: 16px; font-weight: 600;
                color: ${THEME.success}; margin: 0 0 4px;
            }
            .benetrip-onboarding-welcome p {
                font-family: 'Montserrat', sans-serif;
                font-size: 13px; color: #666; margin: 0;
            }

            /* Option grid */
            .benetrip-option-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px; margin-top: 4px;
            }
            .benetrip-option-btn {
                padding: 10px 8px;
                border: 1.5px solid ${THEME.mediumGray};
                border-radius: 10px;
                background: ${THEME.white};
                font-family: 'Montserrat', sans-serif;
                font-size: 13px; font-weight: 500;
                color: ${THEME.dark};
                cursor: pointer; transition: all 0.2s;
                text-align: center;
            }
            .benetrip-option-btn:hover {
                border-color: ${THEME.primary};
                background: rgba(232, 119, 34, 0.04);
            }
            .benetrip-option-btn.selected {
                border-color: ${THEME.primary};
                background: rgba(232, 119, 34, 0.1);
                color: ${THEME.primary};
                font-weight: 600;
            }

            /* Cooldown warning */
            .benetrip-cooldown-msg {
                font-family: 'Montserrat', sans-serif;
                font-size: 12px; color: ${THEME.error};
                text-align: center; margin-top: 4px;
            }

            /* Switch view */
            .benetrip-switch-view {
                text-align: center;
                font-family: 'Montserrat', sans-serif;
                font-size: 13px; color: #666; margin: 16px 0 0;
            }
            .benetrip-switch-view a {
                color: ${THEME.primary};
                font-weight: 600; text-decoration: none;
            }
            .benetrip-switch-view a:hover { text-decoration: underline; }

            /* Footer */
            .benetrip-modal-footer {
                padding: 16px 24px 20px; text-align: center;
            }
            .benetrip-modal-footer p {
                font-family: 'Montserrat', sans-serif;
                font-size: 11px; color: #999;
                margin: 0; line-height: 1.5;
            }
            .benetrip-modal-footer a {
                color: ${THEME.secondary}; text-decoration: none;
            }
            .benetrip-modal-footer a:hover { text-decoration: underline; }

            /* Responsive */
            @media (max-width: 480px) {
                .benetrip-modal-overlay {
                    padding: 0; align-items: flex-end;
                }
                .benetrip-modal-container {
                    border-radius: 16px 16px 0 0;
                    max-height: 95vh;
                }
            }
        `;

        document.head.appendChild(style);
    }

    // ==========================================
    // EVENTOS
    // ==========================================

    function _bindEvents() {
        // Fechar modal
        document.getElementById('benetrip-modal-close').addEventListener('click', close);
        document.getElementById('benetrip-modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) close();
        });

        // Trocar views
        document.getElementById('benetrip-link-signup').addEventListener('click', (e) => {
            e.preventDefault();
            _switchView('signup');
        });
        document.getElementById('benetrip-link-login').addEventListener('click', (e) => {
            e.preventDefault();
            _switchView('login');
        });
        document.getElementById('benetrip-link-forgot').addEventListener('click', (e) => {
            e.preventDefault();
            _switchView('forgot');
        });
        document.getElementById('benetrip-link-back-login').addEventListener('click', (e) => {
            e.preventDefault();
            _switchView('login');
        });
        document.getElementById('benetrip-link-back-login-magic').addEventListener('click', (e) => {
            e.preventDefault();
            _switchView('login');
        });

        // Magic link
        document.getElementById('benetrip-btn-magic-link').addEventListener('click', () => {
            _switchView('magic');
        });

        // Google login
        document.getElementById('benetrip-btn-google').addEventListener('click', _handleGoogleLogin);
        document.getElementById('benetrip-btn-google-signup').addEventListener('click', _handleGoogleLogin);

        // Facebook login
        document.getElementById('benetrip-btn-facebook').addEventListener('click', _handleFacebookLogin);
        document.getElementById('benetrip-btn-facebook-signup').addEventListener('click', _handleFacebookLogin);

        // Email login form
        document.getElementById('benetrip-form-login').addEventListener('submit', _handleEmailLogin);

        // Signup form
        document.getElementById('benetrip-form-signup').addEventListener('submit', _handleEmailSignup);

        // Forgot password form
        document.getElementById('benetrip-form-forgot').addEventListener('submit', _handleForgotPassword);

        // Magic link form
        document.getElementById('benetrip-form-magic').addEventListener('submit', _handleMagicLink);

        // Onboarding form
        document.getElementById('benetrip-form-onboarding').addEventListener('submit', _handleOnboarding);
        document.getElementById('benetrip-btn-skip-onboarding').addEventListener('click', () => {
            _finishLogin();
        });

        // Option grid buttons (onboarding)
        document.querySelectorAll('.benetrip-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const grid = btn.closest('.benetrip-option-grid');
                grid.querySelectorAll('.benetrip-option-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        // Password toggles
        document.querySelectorAll('.benetrip-password-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.target);
                if (input) {
                    input.type = input.type === 'password' ? 'text' : 'password';
                }
            });
        });

        // Password strength and checklist
        const signupPassword = document.getElementById('benetrip-signup-password');
        if (signupPassword) {
            signupPassword.addEventListener('input', _updatePasswordStrength);
        }

        // Fechar com Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalElement?.style.display !== 'none') {
                close();
            }
        });
    }

    // ==========================================
    // HANDLERS
    // ==========================================

    function _checkCooldown() {
        if (Date.now() < cooldownUntil) {
            const secsLeft = Math.ceil((cooldownUntil - Date.now()) / 1000);
            _showMessage(`Muitas tentativas. Aguarde ${secsLeft}s antes de tentar novamente.`, 'error');
            return true;
        }
        return false;
    }

    function _registerFailedAttempt() {
        failedAttempts++;
        if (failedAttempts >= 5) {
            // 30 second cooldown after 5 failed attempts
            cooldownUntil = Date.now() + 30000;
            failedAttempts = 0;
        }
    }

    async function _handleGoogleLogin() {
        if (isLoading) return;
        _setLoading(true);
        _hideMessage();

        try {
            await BenetripAuth.signInWithGoogle();
        } catch (error) {
            _showMessage(error.message, 'error');
            _setLoading(false);
        }
    }

    async function _handleFacebookLogin() {
        if (isLoading) return;
        _setLoading(true);
        _hideMessage();

        try {
            await BenetripAuth.signInWithFacebook();
        } catch (error) {
            _showMessage(error.message, 'error');
            _setLoading(false);
        }
    }

    async function _handleEmailLogin(e) {
        e.preventDefault();
        if (isLoading) return;
        if (_checkCooldown()) return;

        const email = document.getElementById('benetrip-login-email').value;
        const password = document.getElementById('benetrip-login-password').value;

        if (!email || !password) {
            _showMessage('Preencha todos os campos.', 'error');
            return;
        }

        _setLoading(true);
        _hideMessage();

        try {
            await BenetripAuth.signInWithEmail(email, password);
            failedAttempts = 0;
            _showMessage('Login realizado com sucesso!', 'success');
            setTimeout(() => _finishLogin(), 800);
        } catch (error) {
            _registerFailedAttempt();
            _showMessage(error.message, 'error');
        } finally {
            _setLoading(false);
        }
    }

    async function _handleEmailSignup(e) {
        e.preventDefault();
        if (isLoading) return;

        const nome = document.getElementById('benetrip-signup-name').value;
        const email = document.getElementById('benetrip-signup-email').value;
        const password = document.getElementById('benetrip-signup-password').value;

        if (!nome || !email || !password) {
            _showMessage('Preencha todos os campos.', 'error');
            return;
        }

        if (password.length < 6) {
            _showMessage('A senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }

        _setLoading(true);
        _hideMessage();

        try {
            const data = await BenetripAuth.signUpWithEmail(email, password, nome);

            if (data.user && !data.session) {
                _showMessage('Conta criada! Verifique seu email para confirmar o cadastro.', 'success');
            } else {
                // Show onboarding
                _switchView('onboarding');
            }
        } catch (error) {
            _showMessage(error.message, 'error');
        } finally {
            _setLoading(false);
        }
    }

    async function _handleForgotPassword(e) {
        e.preventDefault();
        if (isLoading) return;

        const email = document.getElementById('benetrip-forgot-email').value;

        if (!email) {
            _showMessage('Digite seu email.', 'error');
            return;
        }

        _setLoading(true);
        _hideMessage();

        try {
            await BenetripAuth.resetPassword(email);
            _showMessage('Se este email estiver cadastrado, voce recebera um link de recuperacao.', 'success');
        } catch (error) {
            _showMessage(error.message, 'error');
        } finally {
            _setLoading(false);
        }
    }

    async function _handleMagicLink(e) {
        e.preventDefault();
        if (isLoading) return;

        const email = document.getElementById('benetrip-magic-email').value;

        if (!email) {
            _showMessage('Digite seu email.', 'error');
            return;
        }

        _setLoading(true);
        _hideMessage();

        try {
            if (typeof BenetripAuth !== 'undefined' && BenetripAuth.signInWithMagicLink) {
                await BenetripAuth.signInWithMagicLink(email);
            } else {
                // Fallback: use Supabase OTP directly if method not yet available
                _showMessage('Magic link ainda nao configurado. Use email e senha.', 'info');
                _setLoading(false);
                return;
            }
            _showMessage('Link magico enviado! Verifique seu email para entrar.', 'success');
        } catch (error) {
            _showMessage(error.message, 'error');
        } finally {
            _setLoading(false);
        }
    }

    async function _handleOnboarding(e) {
        e.preventDefault();

        const styleBtn = document.querySelector('#benetrip-travel-style .benetrip-option-btn.selected');
        const companionBtn = document.querySelector('#benetrip-travel-companion .benetrip-option-btn.selected');

        const preferences = {};
        if (styleBtn) preferences.estilo = styleBtn.dataset.value;
        if (companionBtn) preferences.companhia = companionBtn.dataset.value;

        // Save preferences if BenetripPreferences is available
        if (typeof BenetripPreferences !== 'undefined' && Object.keys(preferences).length > 0) {
            try {
                await BenetripPreferences.save({
                    preferencias: preferences.estilo,
                    companhia: preferences.companhia === 'solo' ? 0 :
                              preferences.companhia === 'casal' ? 1 :
                              preferences.companhia === 'familia' ? 2 : 3,
                });
            } catch (e) {
                // Non-critical, continue
            }
        }

        _finishLogin();
    }

    function _finishLogin() {
        close();
        if (redirectAfterLogin) {
            const url = redirectAfterLogin;
            redirectAfterLogin = null;
            window.location.href = url;
        }
    }

    // ==========================================
    // UI HELPERS
    // ==========================================

    function _switchView(view) {
        currentView = view;
        _hideMessage();

        document.querySelectorAll('.benetrip-auth-view').forEach(el => {
            el.style.display = 'none';
        });

        const viewEl = document.getElementById(`benetrip-view-${view}`);
        if (viewEl) viewEl.style.display = 'block';

        const titleEl = document.getElementById('benetrip-modal-title');
        const subtitleEl = document.getElementById('benetrip-modal-subtitle');

        switch (view) {
            case 'login':
                titleEl.textContent = 'Bem-vindo!!';
                subtitleEl.textContent = 'A Tripinha guardou seu lugar!';
                break;
            case 'signup':
                titleEl.textContent = 'Crie sua conta';
                subtitleEl.textContent = 'A Tripinha quer conhecer voce!';
                break;
            case 'forgot':
                titleEl.textContent = 'Recuperar senha';
                subtitleEl.textContent = 'A Tripinha vai te ajudar!';
                break;
            case 'magic':
                titleEl.textContent = 'Link magico';
                subtitleEl.textContent = 'Entre sem precisar de senha!';
                break;
            case 'onboarding':
                titleEl.textContent = 'Quase la!';
                subtitleEl.textContent = 'So mais um pouquinho...';
                break;
        }
    }

    function _showMessage(text, type) {
        const msgEl = document.getElementById('benetrip-modal-message');
        if (!msgEl) return;
        msgEl.textContent = text;
        msgEl.className = `benetrip-modal-message ${type}`;
        msgEl.style.display = 'block';
    }

    function _hideMessage() {
        const msgEl = document.getElementById('benetrip-modal-message');
        if (msgEl) msgEl.style.display = 'none';
    }

    function _setLoading(loading) {
        isLoading = loading;

        document.querySelectorAll('.benetrip-btn-primary').forEach(btn => {
            btn.disabled = loading;
            const textEl = btn.querySelector('.benetrip-btn-text');
            const loadingEl = btn.querySelector('.benetrip-btn-loading');
            if (textEl) textEl.style.display = loading ? 'none' : '';
            if (loadingEl) loadingEl.style.display = loading ? 'flex' : 'none';
        });

        document.querySelectorAll('.benetrip-btn-social').forEach(btn => {
            btn.disabled = loading;
            btn.style.opacity = loading ? '0.6' : '1';
        });
    }

    function _updatePasswordStrength() {
        const password = document.getElementById('benetrip-signup-password').value;
        const strengthEl = document.getElementById('benetrip-password-strength');

        // Update checklist
        const checks = {
            length: password.length >= 6,
            uppercase: /[A-Z]/.test(password),
            number: /\d/.test(password),
        };

        document.querySelectorAll('.benetrip-check-item').forEach(item => {
            const check = item.dataset.check;
            if (checks[check]) {
                item.classList.add('valid');
            } else {
                item.classList.remove('valid');
            }
        });

        // Update strength bar
        if (!strengthEl) return;
        let strength = 0;
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        const colors = ['#E53935', '#FF9800', '#FFC107', '#8BC34A', '#43A047'];
        const widths = ['20%', '40%', '60%', '80%', '100%'];

        const level = Math.min(strength, 4);
        strengthEl.style.background = password.length > 0 ? colors[level] : 'transparent';
        strengthEl.style.width = password.length > 0 ? widths[level] : '0';
    }

    // ==========================================
    // API PUBLICA
    // ==========================================

    function open(view = 'login', redirectUrl = null) {
        _createModal();
        _switchView(view);
        _hideMessage();
        _setLoading(false);

        // Store redirect URL
        redirectAfterLogin = redirectUrl || null;

        modalElement.style.display = '';
        requestAnimationFrame(() => {
            document.getElementById('benetrip-modal-overlay').classList.add('active');
        });

        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            const firstInput = document.querySelector(`#benetrip-view-${view} input`);
            if (firstInput) firstInput.focus();
        }, 300);
    }

    function close() {
        if (!modalElement) return;

        const overlay = document.getElementById('benetrip-modal-overlay');
        overlay.classList.remove('active');

        setTimeout(() => {
            modalElement.style.display = 'none';
            document.body.style.overflow = '';
            document.querySelectorAll('.benetrip-form').forEach(form => form.reset());
            // Reset checklist
            document.querySelectorAll('.benetrip-check-item').forEach(item => item.classList.remove('valid'));
            const strengthEl = document.getElementById('benetrip-password-strength');
            if (strengthEl) { strengthEl.style.width = '0'; strengthEl.style.background = 'transparent'; }
        }, 300);
    }

    return { open, close };
})();

window.BenetripLoginModal = BenetripLoginModal;
