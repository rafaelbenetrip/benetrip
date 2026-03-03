/**
 * ============================================
 * BENETRIP PREFERENCES INTEGRATION v1.0
 * ============================================
 * Conecta o módulo de preferências ao formulário
 * de descobrir-destinos.html.
 *
 * INCLUA APÓS:
 *   - benetrip-preferences.js
 *   - descobrir-destinos.js
 *
 * FUNCIONALIDADES:
 *   1. Auto-preenche o formulário ao carregar a página
 *   2. Salva preferências automaticamente após cada busca
 *   3. Mostra banner informativo quando há pré-preenchimento
 */

(function () {
    'use strict';

    // Aguardar DOM + scripts carregados
    function whenReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    whenReady(async function () {
        // Aguardar BenetripDiscovery estar disponível
        if (typeof BenetripDiscovery === 'undefined' || typeof BenetripPreferences === 'undefined') {
            console.warn('[PrefsIntegration] BenetripDiscovery ou BenetripPreferences não encontrados');
            return;
        }

        console.log('[PrefsIntegration] Inicializando integração de preferências...');

        // ════════════════════════════════════════
        // 1. AUTO-PREENCHER FORMULÁRIO
        // ════════════════════════════════════════

        try {
            const prefs = await BenetripPreferences.load();

            // Só aplica se tiver pelo menos algo salvo
            if (prefs && prefs._updatedAt) {
                // Pequeno delay para garantir que o DOM do formulário está pronto
                // (flatpickr, autocomplete, etc.)
                setTimeout(() => {
                    BenetripPreferences.applyToDiscoveryForm(prefs, BenetripDiscovery);
                    _showPrefsBanner(prefs);
                    console.log('[PrefsIntegration] ✅ Preferências pré-preenchidas');
                }, 400);
            }
        } catch (e) {
            console.warn('[PrefsIntegration] Erro ao carregar preferências:', e.message);
        }

        // ════════════════════════════════════════
        // 2. INTERCEPTAR BUSCA PARA SALVAR PREFS
        // ════════════════════════════════════════

        // Guardar referência ao método original
        const _originalBuscarDestinos = BenetripDiscovery.buscarDestinos.bind(BenetripDiscovery);

        BenetripDiscovery.buscarDestinos = async function () {
            // Executar busca original
            await _originalBuscarDestinos();

            // Após busca bem-sucedida, salvar preferências
            try {
                const formData = BenetripDiscovery.state.formData;
                if (formData && formData.origem) {
                    const prefsToSave = BenetripPreferences.extractFromFormData(formData);
                    await BenetripPreferences.save(prefsToSave, { silent: true });
                    console.log('[PrefsIntegration] ✅ Preferências atualizadas após busca');
                }
            } catch (e) {
                console.warn('[PrefsIntegration] Erro ao salvar preferências pós-busca:', e.message);
            }
        };

        // ════════════════════════════════════════
        // 3. SINCRONIZAR AO LOGAR
        // ════════════════════════════════════════

        if (typeof BenetripAuth !== 'undefined') {
            BenetripAuth.onAuthChange(async (event, user) => {
                if (event === 'SIGNED_IN' && user) {
                    try {
                        // Ao logar, sincronizar localStorage → Supabase se existir
                        const localPrefs = await BenetripPreferences.load();
                        if (localPrefs && localPrefs._updatedAt) {
                            await BenetripPreferences.save(localPrefs, { silent: true });
                            console.log('[PrefsIntegration] ✅ Preferências sincronizadas após login');
                        }
                    } catch (e) {
                        // Silencioso
                    }
                }
            });
        }
    });

    // ════════════════════════════════════════
    // BANNER DE PRÉ-PREENCHIMENTO
    // ════════════════════════════════════════

    function _showPrefsBanner(prefs) {
        const formContainer = document.getElementById('form-container');
        if (!formContainer) return;

        // Verificar se tem dados relevantes pré-preenchidos
        const hasOrigin = prefs.origem && prefs.origem.code;
        const hasCompanhia = prefs.companhia !== null && prefs.companhia !== undefined;
        const hasPrefs = prefs.preferencias && prefs.preferencias.length > 0;

        if (!hasOrigin && !hasCompanhia && !hasPrefs) return;

        // Não mostrar novamente se já foi descartado nesta sessão
        if (sessionStorage.getItem('benetrip_prefs_banner_dismissed')) return;

        const banner = document.createElement('div');
        banner.id = 'prefs-banner';
        banner.style.cssText = `
            background: linear-gradient(135deg, rgba(232,119,34,0.08), rgba(0,163,224,0.08));
            border: 1.5px solid rgba(232,119,34,0.2);
            border-radius: 12px;
            padding: 14px 16px;
            margin-bottom: 20px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            font-family: 'Montserrat', sans-serif;
            font-size: 13px;
            color: #21272A;
            line-height: 1.5;
            animation: prefsBannerIn 0.4s ease;
        `;

        banner.innerHTML = `
            <span style="font-size: 1.4rem; flex-shrink: 0;">🐕</span>
            <div style="flex: 1;">
                <strong style="font-family: 'Poppins', sans-serif; font-size: 13px;">
                    A Tripinha lembrou suas preferências!
                </strong>
                <br>
                O formulário já foi pré-preenchido com base na sua última busca. 
                Ajuste o que quiser antes de pesquisar.
            </div>
            <button id="prefs-banner-close" style="
                background: none; border: none; cursor: pointer; 
                color: #999; font-size: 18px; padding: 0 4px; 
                line-height: 1; flex-shrink: 0;
            " aria-label="Fechar">×</button>
        `;

        // Inserir no início do formulário
        const form = formContainer.querySelector('#descobrir-form');
        if (form) {
            form.insertBefore(banner, form.firstChild);
        } else {
            formContainer.insertBefore(banner, formContainer.firstChild);
        }

        // Fechar banner
        document.getElementById('prefs-banner-close').addEventListener('click', () => {
            banner.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            banner.style.opacity = '0';
            banner.style.transform = 'translateY(-10px)';
            setTimeout(() => banner.remove(), 300);
            sessionStorage.setItem('benetrip_prefs_banner_dismissed', '1');
        });

        // Adicionar animação CSS
        if (!document.getElementById('prefs-banner-anim')) {
            const style = document.createElement('style');
            style.id = 'prefs-banner-anim';
            style.textContent = `
                @keyframes prefsBannerIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
    }

})();
