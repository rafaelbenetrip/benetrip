/**
 * ============================================
 * BENETRIP PREFERENCES MODULE v1.0
 * ============================================
 * Persiste preferências de viagem do usuário para
 * pré-preencher formulários automaticamente.
 *
 * Salva no campo `preferencias_viagem` do user_profiles (Supabase)
 * e em localStorage como fallback para usuários não logados.
 *
 * COMO USAR:
 *   Incluir APÓS benetrip-auth.js em páginas que precisam de preferências.
 *
 *   // Salvar preferências após busca
 *   BenetripPreferences.save({ origem, companhia, moeda, ... });
 *
 *   // Carregar preferências salvas
 *   const prefs = await BenetripPreferences.load();
 *
 *   // Aplicar no formulário de descobrir destinos
 *   BenetripPreferences.applyToDiscoveryForm(prefs);
 */

const BenetripPreferences = (function () {
    'use strict';

    const STORAGE_KEY = 'benetrip_user_preferences';
    const VERSION = 1;

    // ================================================================
    // ESTRUTURA PADRÃO DE PREFERÊNCIAS
    // ================================================================
    const DEFAULTS = {
        _version: VERSION,
        _updatedAt: null,

        // Origem
        origem: null, // { code, name, state, country, countryCode, airport }

        // Companhia
        companhia: null, // 0=sozinho, 1=casal, 2=família, 3=amigos
        adultos: 2,
        criancas: 0,
        bebes: 0,
        numPessoas: null, // para amigos

        // Preferências de viagem
        preferencias: '', // "relax,cultura"
        escopoDestino: 'tanto_faz', // "tanto_faz" | "internacional"

        // Financeiro
        moeda: 'BRL',
        orcamento: null,

        // Observações livres
        observacoes: ''
    };

    // ================================================================
    // SALVAR PREFERÊNCIAS
    // ================================================================

    /**
     * Salva as preferências do usuário.
     * @param {Object} prefs - Dados parciais ou completos de preferências
     * @param {Object} options - { silent: true } para não mostrar toast
     */
    async function save(prefs, options = {}) {
        if (!prefs || typeof prefs !== 'object') return;

        // Mesclar com existente (para não perder campos não enviados)
        const existing = _loadFromLocalStorage() || {};
        const merged = {
            ...DEFAULTS,
            ...existing,
            ...prefs,
            _version: VERSION,
            _updatedAt: new Date().toISOString()
        };

        // Limpar campos undefined
        Object.keys(merged).forEach(key => {
            if (merged[key] === undefined) delete merged[key];
        });

        // 1. Sempre salvar em localStorage (funciona offline / sem login)
        _saveToLocalStorage(merged);

        // 2. Se logado, salvar no Supabase
        if (_isLoggedIn()) {
            try {
                await _saveToSupabase(merged);
                _log('✅ Preferências salvas (localStorage + Supabase)');
            } catch (e) {
                _log('⚠️ Salvo em localStorage, erro no Supabase:', e.message);
            }
        } else {
            _log('✅ Preferências salvas (localStorage apenas)');
        }

        if (!options.silent) {
            _showToast('Preferências salvas! 🐾');
        }

        return merged;
    }

    // ================================================================
    // CARREGAR PREFERÊNCIAS
    // ================================================================

    /**
     * Carrega as preferências salvas.
     * Prioridade: Supabase (se logado) > localStorage > defaults
     * @returns {Object} Preferências mescladas
     */
    async function load() {
        let supabasePrefs = null;
        let localPrefs = _loadFromLocalStorage();

        // Tentar Supabase se logado
        if (_isLoggedIn()) {
            try {
                supabasePrefs = await _loadFromSupabase();
            } catch (e) {
                _log('⚠️ Erro ao carregar do Supabase:', e.message);
            }
        }

        // Decidir qual versão usar
        if (supabasePrefs && localPrefs) {
            // Usar a mais recente
            const supaDate = new Date(supabasePrefs._updatedAt || 0).getTime();
            const localDate = new Date(localPrefs._updatedAt || 0).getTime();

            if (supaDate >= localDate) {
                _saveToLocalStorage(supabasePrefs); // sincronizar local
                return { ...DEFAULTS, ...supabasePrefs };
            } else {
                // Local é mais recente — sincronizar para Supabase
                _saveToSupabase(localPrefs).catch(() => {});
                return { ...DEFAULTS, ...localPrefs };
            }
        }

        if (supabasePrefs) {
            _saveToLocalStorage(supabasePrefs);
            return { ...DEFAULTS, ...supabasePrefs };
        }

        if (localPrefs) {
            return { ...DEFAULTS, ...localPrefs };
        }

        return { ...DEFAULTS };
    }

    // ================================================================
    // APLICAR NO FORMULÁRIO DE DESCOBRIR DESTINOS
    // ================================================================

    /**
     * Pré-preenche o formulário de descobrir-destinos.html com as preferências.
     * @param {Object} prefs - Objeto de preferências
     * @param {Object} discoveryInstance - Referência ao BenetripDiscovery (para setar origemSelecionada)
     */
    function applyToDiscoveryForm(prefs, discoveryInstance) {
        if (!prefs) return;

        _log('📝 Aplicando preferências ao formulário...');

        // ── Origem ──
        if (prefs.origem && prefs.origem.code) {
            const input = document.getElementById('origem');
            const hiddenInput = document.getElementById('origem-data');

            if (input && hiddenInput) {
                const cidade = prefs.origem;
                input.value = cidade.airport
                    ? `${cidade.name} — ${cidade.airport} (${cidade.code})`
                    : `${cidade.name} (${cidade.code})`;
                hiddenInput.value = JSON.stringify(cidade);

                if (discoveryInstance) {
                    discoveryInstance.state.origemSelecionada = cidade;
                }
            }
        }

        // ── Companhia ──
        if (prefs.companhia !== null && prefs.companhia !== undefined) {
            _clickButtonOption('companhia', String(prefs.companhia));

            // Mostrar campos condicionais
            const compInput = document.getElementById('companhia');
            if (compInput) {
                compInput.value = String(prefs.companhia);
                compInput.dispatchEvent(new Event('change'));
            }

            // Número de amigos
            if (prefs.companhia === 3 && prefs.numPessoas) {
                const numInput = document.getElementById('num-pessoas');
                if (numInput) numInput.value = prefs.numPessoas;
            }

            // Família
            if (prefs.companhia === 2) {
                _setInputValue('familia-adultos', prefs.adultos || 2);
                _setInputValue('familia-criancas', prefs.criancas || 0);
                _setInputValue('familia-bebes', prefs.bebes || 0);

                // Atualizar total
                if (discoveryInstance && discoveryInstance.atualizarTotalFamilia) {
                    discoveryInstance.atualizarTotalFamilia();
                }
            }
        }

        // ── Preferências de viagem (multi-select) ──
        if (prefs.preferencias) {
            const prefArray = prefs.preferencias.split(',').filter(Boolean);
            const prefGroup = document.querySelector('.button-group[data-field="preferencias"]');
            const prefHidden = document.getElementById('preferencias');

            if (prefGroup && prefHidden) {
                // Limpar seleções anteriores
                prefGroup.querySelectorAll('.btn-option').forEach(btn => btn.classList.remove('active'));

                prefArray.forEach(val => {
                    const btn = prefGroup.querySelector(`.btn-option[data-value="${val}"]`);
                    if (btn) btn.classList.add('active');
                });

                prefHidden.value = prefs.preferencias;
            }
        }

        // ── Escopo destino ──
        if (prefs.escopoDestino) {
            _clickButtonOption('escopo-destino', prefs.escopoDestino);
            _setInputValue('escopo-destino', prefs.escopoDestino);
        }

        // ── Moeda ──
        if (prefs.moeda) {
            _clickButtonOption('moeda', prefs.moeda);
            const moedaInput = document.getElementById('moeda');
            if (moedaInput) {
                moedaInput.value = prefs.moeda;
                moedaInput.dispatchEvent(new Event('change'));
            }
        }

        // ── Orçamento ──
        if (prefs.orcamento) {
            const orcInput = document.getElementById('orcamento');
            if (orcInput) {
                orcInput.value = Math.round(prefs.orcamento).toLocaleString('pt-BR');
            }
        }

        // ── Observações ──
        if (prefs.observacoes) {
            const obsInput = document.getElementById('observacoes');
            const obsCounter = document.getElementById('observacoes-counter');
            if (obsInput) {
                obsInput.value = prefs.observacoes;
                if (obsCounter) obsCounter.textContent = prefs.observacoes.length;
            }
        }

        // NÃO pré-preencher datas — geralmente mudam a cada busca

        _log('✅ Preferências aplicadas ao formulário');
    }

    // ================================================================
    // EXTRAIR PREFERÊNCIAS DO FORMULÁRIO
    // ================================================================

    /**
     * Extrai as preferências atuais do formulário de descobrir-destinos.
     * Chamado após submissão bem-sucedida.
     * @param {Object} formData - Dados já coletados por BenetripDiscovery.coletarDadosFormulario()
     * @returns {Object} Preferências formatadas para salvar
     */
    function extractFromFormData(formData) {
        if (!formData) return null;

        return {
            origem: formData.origem || null,
            companhia: formData.companhia,
            adultos: formData.adultos || 1,
            criancas: formData.criancas || 0,
            bebes: formData.bebes || 0,
            numPessoas: formData.numPessoas || null,
            preferencias: formData.preferencias || '',
            escopoDestino: formData.escopoDestino || 'tanto_faz',
            moeda: formData.moeda || 'BRL',
            orcamento: formData.orcamento || null,
            observacoes: formData.observacoes || ''
        };
    }

    // ================================================================
    // RENDERIZAR RESUMO PARA MINHA CONTA
    // ================================================================

    /**
     * Gera HTML de resumo das preferências para a página Minha Conta.
     * @param {Object} prefs
     * @returns {string} HTML
     */
    function renderSummaryHTML(prefs) {
        if (!prefs || !prefs._updatedAt) {
            return `
                <div style="text-align:center;padding:24px;color:#9E9E9E;">
                    <div style="font-size:2.5rem;margin-bottom:12px;">🐕</div>
                    <p style="font-size:0.9rem;margin-bottom:4px;">Nenhuma preferência salva ainda</p>
                    <p style="font-size:0.8rem;">Faça sua primeira busca em <a href="descobrir-destinos.html" style="color:#E87722;font-weight:600;">Descobrir Destinos</a> e suas preferências serão salvas automaticamente!</p>
                </div>`;
        }

        const COMP_LABELS = {
            0: '🧳 Sozinho(a)',
            1: '❤️ Casal',
            2: '👨‍👩‍👧‍👦 Família',
            3: '🎉 Amigos'
        };
        const PREF_LABELS = {
            'relax': '🌊 Relax total',
            'aventura': '🏔️ Aventura',
            'cultura': '🏛️ Cultura',
            'urbano': '🏙️ Agito urbano'
        };
        const MOEDA_SIMBOLOS = { 'BRL': 'R$', 'USD': 'US$', 'EUR': '€' };

        const origemText = prefs.origem
            ? (prefs.origem.airport
                ? `${prefs.origem.name} — ${prefs.origem.airport} (${prefs.origem.code})`
                : `${prefs.origem.name} (${prefs.origem.code})`)
            : 'Não definida';

        const compText = COMP_LABELS[prefs.companhia] || 'Não definida';

        let passageirosText = '';
        if (prefs.companhia === 2) {
            const parts = [`${prefs.adultos || 2} adulto(s)`];
            if (prefs.criancas > 0) parts.push(`${prefs.criancas} criança(s)`);
            if (prefs.bebes > 0) parts.push(`${prefs.bebes} bebê(s)`);
            passageirosText = parts.join(', ');
        } else if (prefs.companhia === 3 && prefs.numPessoas) {
            passageirosText = `${prefs.numPessoas} pessoas`;
        }

        const prefText = prefs.preferencias
            ? prefs.preferencias.split(',').filter(Boolean).map(p => PREF_LABELS[p] || p).join(', ')
            : 'Não definidas';

        const escopoText = prefs.escopoDestino === 'internacional'
            ? '✈️ Apenas internacionais'
            : '🗺️ Nacionais e internacionais';

        const moedaText = prefs.moeda || 'BRL';
        const simbolo = MOEDA_SIMBOLOS[moedaText] || 'R$';
        const orcText = prefs.orcamento
            ? `${simbolo} ${Math.round(prefs.orcamento).toLocaleString('pt-BR')}`
            : 'Não definido';

        const updatedAt = prefs._updatedAt
            ? new Date(prefs._updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '';

        return `
            <div class="prefs-summary">
                <div class="prefs-item">
                    <span class="prefs-label">📍 Cidade de origem</span>
                    <span class="prefs-value">${origemText}</span>
                </div>
                <div class="prefs-item">
                    <span class="prefs-label">👥 Companhia</span>
                    <span class="prefs-value">${compText}${passageirosText ? ' · ' + passageirosText : ''}</span>
                </div>
                <div class="prefs-item">
                    <span class="prefs-label">🎯 Estilo de viagem</span>
                    <span class="prefs-value">${prefText}</span>
                </div>
                <div class="prefs-item">
                    <span class="prefs-label">🌍 Escopo</span>
                    <span class="prefs-value">${escopoText}</span>
                </div>
                <div class="prefs-item">
                    <span class="prefs-label">💰 Moeda</span>
                    <span class="prefs-value">${moedaText}</span>
                </div>
                <div class="prefs-item">
                    <span class="prefs-label">💸 Orçamento por pessoa</span>
                    <span class="prefs-value">${orcText}</span>
                </div>
                ${prefs.observacoes ? `
                <div class="prefs-item" style="grid-column: 1 / -1;">
                    <span class="prefs-label">💬 Observações</span>
                    <span class="prefs-value">"${prefs.observacoes}"</span>
                </div>` : ''}
                <div class="prefs-updated" style="grid-column: 1 / -1; text-align:right; font-size:0.72rem; color:#9E9E9E; margin-top:8px;">
                    Atualizado em ${updatedAt}
                </div>
            </div>`;
    }

    // ================================================================
    // LIMPAR PREFERÊNCIAS
    // ================================================================

    async function clear() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ok */ }

        if (_isLoggedIn()) {
            try {
                await BenetripAuth.updateProfile({ preferencias_viagem: {} });
            } catch (e) {
                _log('⚠️ Erro ao limpar preferências no Supabase:', e.message);
            }
        }

        _log('🗑️ Preferências limpas');
    }

    // ================================================================
    // FUNÇÕES INTERNAS
    // ================================================================

    function _isLoggedIn() {
        return typeof BenetripAuth !== 'undefined' && BenetripAuth.isLoggedIn();
    }

    function _log(...args) {
        console.log('[Preferences]', ...args);
    }

    // ── localStorage ──

    function _saveToLocalStorage(prefs) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch (e) {
            _log('⚠️ Erro ao salvar em localStorage:', e.message);
        }
    }

    function _loadFromLocalStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    // ── Supabase ──

    async function _saveToSupabase(prefs) {
        if (!_isLoggedIn()) return;
        await BenetripAuth.updateProfile({
            preferencias_viagem: prefs
        });
    }

    async function _loadFromSupabase() {
        if (!_isLoggedIn()) return null;
        const profile = await BenetripAuth.getProfile();
        if (!profile || !profile.preferencias_viagem) return null;

        const pv = profile.preferencias_viagem;
        return (typeof pv === 'object' && pv !== null) ? pv : null;
    }

    // ── DOM Helpers ──

    function _clickButtonOption(fieldName, value) {
        const group = document.querySelector(`.button-group[data-field="${fieldName}"]`);
        if (!group) return;

        const isMulti = group.dataset.multi === 'true';

        if (!isMulti) {
            group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
        }

        const btn = group.querySelector(`.btn-option[data-value="${value}"]`);
        if (btn) {
            btn.classList.add('active');
        }
    }

    function _setInputValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    function _showToast(message) {
        if (typeof BenetripAutoSave !== 'undefined' && BenetripAutoSave.showToast) {
            BenetripAutoSave.showToast(message);
        }
    }

    // ================================================================
    // API PÚBLICA
    // ================================================================

    return {
        save,
        load,
        clear,
        applyToDiscoveryForm,
        extractFromFormData,
        renderSummaryHTML,
        DEFAULTS
    };

})();

window.BenetripPreferences = BenetripPreferences;
