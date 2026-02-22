/**
 * ============================================
 * BENETRIP AUTH MODULE - benetrip-auth.js
 * ============================================
 * Módulo global de autenticação para todas as páginas da Benetrip.
 * Utiliza Supabase Auth com suporte a Email/Senha, Google e Facebook.
 * 
 * COMO USAR:
 * 1. Incluir este script em todas as páginas ANTES dos outros scripts
 * 2. No HTML, adicionar meta tags:
 *    <meta name="supabase-url" content="https://SEU-PROJETO.supabase.co">
 *    <meta name="supabase-anon-key" content="SUA_ANON_KEY">
 * 3. No HTML: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *             <script src="assets/js/benetrip-auth.js"></script>
 */

// ============================================================
// MONKEY-PATCH: navigator.locks
// ============================================================
// O Supabase JS v2 usa navigator.locks.request() internamente
// para coordenar acesso à sessão entre abas. Porém, locks
// "fantasma" de sessões anteriores ficam presos e causam
// timeout de 10 s — mesmo quando a opção `lock` é passada no
// config (várias versões do SDK ignoram essa opção).
//
// A solução mais robusta é substituir navigator.locks.request()
// GLOBALMENTE, antes que qualquer client Supabase seja criado.
// Em aba única (caso predominante) o pior cenário é um refresh
// de token redundante; em múltiplas abas o risco é mínimo.
// ============================================================
(function _patchNavigatorLocks() {
    'use strict';

    const _activeLocks = new Map();

    /**
     * Implementação simplificada de lock baseada em Promises.
     * Aceita a mesma assinatura que navigator.locks.request().
     */
    async function _simpleLockRequest(name, optionsOrFn, maybeFn) {
        // navigator.locks.request(name, fn)  OU
        // navigator.locks.request(name, options, fn)
        let fn;
        let acquireTimeout = 10000; // fallback

        if (typeof optionsOrFn === 'function') {
            fn = optionsOrFn;
        } else {
            fn = maybeFn;
            // Se o Supabase passar { mode, ifAvailable, ... } ignoramos — não precisamos
        }

        if (typeof fn !== 'function') {
            // Fallback: se por algum motivo fn não for função, resolve vazio
            return undefined;
        }

        // Se já existe lock ativo com este nome, esperar (com timeout)
        const existing = _activeLocks.get(name);
        if (existing) {
            try {
                await Promise.race([
                    existing,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('lock timeout')), acquireTimeout)
                    )
                ]);
            } catch (_e) {
                // Timeout ou erro do lock anterior — prosseguir mesmo assim
            }
        }

        // Executar a função e registrar como lock ativo
        const promise = (async () => {
            try {
                return await fn({ name, mode: 'exclusive' });
            } catch (err) {
                // Supabase às vezes lança dentro do callback; não travar
                console.warn('[BenetripAuth][Lock] Erro dentro do lock callback:', err?.message || err);
                return undefined;
            }
        })();

        _activeLocks.set(name, promise);

        try {
            return await promise;
        } finally {
            if (_activeLocks.get(name) === promise) {
                _activeLocks.delete(name);
            }
        }
    }

    // Substituir globalmente via Object.defineProperty
    // (navigator.locks é read-only getter, não aceita atribuição direta)
    if (typeof navigator !== 'undefined') {
        try {
            Object.defineProperty(navigator, 'locks', {
                value: {
                    request: _simpleLockRequest,
                    query: async () => ({ held: [], pending: [] })
                },
                writable: true,
                configurable: true
            });
            console.log('[BenetripAuth] navigator.locks substituído por lock customizado.');
        } catch (e) {
            console.warn('[BenetripAuth] Não foi possível substituir navigator.locks:', e.message);
        }
    }
})();


// ============================================================
// MÓDULO PRINCIPAL
// ============================================================
const BenetripAuth = (function () {
    'use strict';

    const CONFIG = {
        supabaseUrl: '',
        supabaseAnonKey: '',
        redirectUrl: window.location.origin,
        maxSearchHistory: 100,
    };

    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let authChangeCallbacks = [];
    let initialized = false;

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================

    async function init() {
        if (initialized) return;

        try {
            // ── Ler configuração de meta tags no HTML ──
            const metaUrl = document.querySelector('meta[name="supabase-url"]');
            const metaKey = document.querySelector('meta[name="supabase-anon-key"]');

            if (metaUrl && metaKey) {
                CONFIG.supabaseUrl = metaUrl.content.trim();
                CONFIG.supabaseAnonKey = metaKey.content.trim();
            }

            // Fallback: tentar API route
            if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) {
                try {
                    const configResponse = await fetch('/api/auth/config');
                    if (configResponse.ok) {
                        const config = await configResponse.json();
                        CONFIG.supabaseUrl = config.supabaseUrl || '';
                        CONFIG.supabaseAnonKey = config.supabaseAnonKey || '';
                    }
                } catch (e) { /* sem problema */ }
            }

            if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) {
                console.warn('[BenetripAuth] Supabase não configurado. Auth desabilitado.');
                initialized = true;
                _updateUI(null);
                return;
            }

            if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
                console.error('[BenetripAuth] Supabase JS SDK não encontrado.');
                initialized = true;
                _updateUI(null);
                return;
            }

            // ── Inicializar Supabase client ──
            // navigator.locks já foi substituído globalmente acima,
            // então NÃO precisamos mais da opção `lock` aqui.
            // flowType: 'implicit' → tokens vêm no hash, sem code exchange
            supabase = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true,
                    flowType: 'implicit'
                }
            });

            // Escutar mudanças de autenticação
            supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('[BenetripAuth] Auth event:', event);

                if (session?.user) {
                    currentUser = session.user;
                    await _loadProfile();
                } else {
                    currentUser = null;
                    currentProfile = null;
                }

                _updateUI(currentUser);
                _notifyCallbacks(event, currentUser);
            });

            // Verificar sessão existente (com timeout de segurança)
            // Pula se onAuthStateChange já capturou o usuário
            if (!currentUser) {
                try {
                    const sessionResult = await Promise.race([
                        supabase.auth.getSession(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('getSession timeout')), 5000)
                        )
                    ]);

                    if (sessionResult?.data?.session?.user) {
                        currentUser = sessionResult.data.session.user;
                        await _loadProfile();
                    }
                } catch (sessionError) {
                    console.warn('[BenetripAuth] getSession falhou (prosseguindo sem sessão):', sessionError.message);
                }
            }

            initialized = true;
            _updateUI(currentUser);
            console.log('[BenetripAuth] Inicializado com sucesso.', currentUser ? `Usuário: ${currentUser.email}` : 'Sem sessão ativa.');

        } catch (error) {
            console.error('[BenetripAuth] Erro na inicialização:', error);
            initialized = true;
            _updateUI(null);
        }
    }

    // ==========================================
    // AUTENTICAÇÃO
    // ==========================================

    async function signInWithEmail(email, password) {
        _ensureInitialized();
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(), password
        });
        if (error) throw _translateError(error);
        return data;
    }

    async function signUpWithEmail(email, password, nome) {
        _ensureInitialized();
        const { data, error } = await supabase.auth.signUp({
            email: email.trim().toLowerCase(), password,
            options: {
                data: { full_name: nome, name: nome },
                emailRedirectTo: `${CONFIG.redirectUrl}/auth-callback.html`
            }
        });
        if (error) throw _translateError(error);
        return data;
    }

    async function signInWithGoogle() {
        _ensureInitialized();
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${CONFIG.redirectUrl}/auth-callback.html`,
                queryParams: { access_type: 'offline', prompt: 'consent' }
            }
        });
        if (error) throw _translateError(error);
        return data;
    }

    async function signInWithFacebook() {
        _ensureInitialized();
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'facebook',
            options: {
                redirectTo: `${CONFIG.redirectUrl}/auth-callback.html`,
                scopes: 'email,public_profile'
            }
        });
        if (error) throw _translateError(error);
        return data;
    }

    async function signOut() {
        _ensureInitialized();
        const { error } = await supabase.auth.signOut();
        if (error) throw _translateError(error);
        currentUser = null;
        currentProfile = null;
        _updateUI(null);
    }

    async function resetPassword(email) {
        _ensureInitialized();
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: `${CONFIG.redirectUrl}/auth-callback.html?type=recovery`
        });
        if (error) throw _translateError(error);
    }

    // ==========================================
    // PERFIL DO USUÁRIO
    // ==========================================

    async function getProfile() {
        if (!currentUser) return null;
        if (currentProfile) return currentProfile;
        await _loadProfile();
        return currentProfile;
    }

    async function updateProfile(dados) {
        _ensureInitialized();
        if (!currentUser) throw new Error('Usuário não logado');
        const { data, error } = await supabase
            .from('user_profiles')
            .update({
                nome_exibicao: dados.nome_exibicao,
                moeda_preferida: dados.moeda_preferida,
                cidade_origem_padrao: dados.cidade_origem_padrao,
                cidade_origem_nome: dados.cidade_origem_nome,
                pais: dados.pais,
                preferencias_viagem: dados.preferencias_viagem
            })
            .eq('user_id', currentUser.id)
            .select().single();
        if (error) throw error;
        currentProfile = data;
        return data;
    }

    // ==========================================
    // HISTÓRICO DE BUSCAS
    // ==========================================

    async function saveSearch(tipo, parametros, resultados) {
        if (!currentUser || !supabase) return null;
        try {
            const { data, error } = await supabase
                .from('search_history')
                .insert({
                    user_id: currentUser.id,
                    tipo_busca: tipo,
                    parametros: parametros || {},
                    resultados_resumo: resultados || {}
                })
                .select().single();
            if (error) { console.warn('[BenetripAuth] Erro ao salvar busca:', error.message); return null; }
            _cleanOldSearches();
            return data;
        } catch (e) { console.warn('[BenetripAuth] Erro ao salvar busca:', e); return null; }
    }

    async function getSearchHistory(limit = 20, offset = 0, tipo = null) {
        _ensureInitialized();
        if (!currentUser) return [];
        let query = supabase.from('search_history').select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (tipo) query = query.eq('tipo_busca', tipo);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async function deleteSearch(searchId) {
        _ensureInitialized();
        if (!currentUser) return;
        const { error } = await supabase.from('search_history').delete()
            .eq('id', searchId).eq('user_id', currentUser.id);
        if (error) throw error;
    }

    async function clearSearchHistory() {
        _ensureInitialized();
        if (!currentUser) return;
        const { error } = await supabase.from('search_history').delete()
            .eq('user_id', currentUser.id);
        if (error) throw error;
    }

    // ==========================================
    // DESTINOS SALVOS
    // ==========================================

    async function saveDestination(dados) {
        _ensureInitialized();
        if (!currentUser) throw new Error('Faça login para salvar destinos');
        const { data, error } = await supabase
            .from('saved_destinations')
            .insert({
                user_id: currentUser.id,
                destino_nome: dados.destino_nome,
                destino_pais: dados.destino_pais,
                iata_code: dados.iata_code,
                preco_encontrado: dados.preco_encontrado,
                moeda_preco: dados.moeda_preco || 'BRL',
                imagem_url: dados.imagem_url,
                dados_busca: dados.dados_busca || {},
                notas: dados.notas
            })
            .select().single();
        if (error) throw error;
        return data;
    }

    async function getSavedDestinations() {
        _ensureInitialized();
        if (!currentUser) return [];
        const { data, error } = await supabase.from('saved_destinations').select('*')
            .eq('user_id', currentUser.id).order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    async function removeDestination(id) {
        _ensureInitialized();
        if (!currentUser) return;
        const { error } = await supabase.from('saved_destinations').delete()
            .eq('id', id).eq('user_id', currentUser.id);
        if (error) throw error;
    }

    // ==========================================
    // ROTEIROS SALVOS
    // ==========================================

    async function saveItinerary(dados) {
        _ensureInitialized();
        if (!currentUser) throw new Error('Faça login para salvar roteiros');
        const { data, error } = await supabase
            .from('saved_itineraries')
            .insert({
                user_id: currentUser.id,
                destino_nome: dados.destino_nome,
                destino_pais: dados.destino_pais,
                data_ida: dados.data_ida,
                data_volta: dados.data_volta,
                num_dias: dados.num_dias,
                dados_roteiro: dados.dados_roteiro || {}
            })
            .select().single();
        if (error) throw error;
        return data;
    }

    async function getSavedItineraries() {
        _ensureInitialized();
        if (!currentUser) return [];
        const { data, error } = await supabase.from('saved_itineraries').select('*')
            .eq('user_id', currentUser.id).order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    async function shareItinerary(itineraryId) {
        _ensureInitialized();
        if (!currentUser) throw new Error('Faça login para compartilhar');
        const shareToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        const { data, error } = await supabase.from('saved_itineraries')
            .update({ compartilhado: true, share_token: shareToken })
            .eq('id', itineraryId).eq('user_id', currentUser.id)
            .select().single();
        if (error) throw error;
        return `${CONFIG.redirectUrl}/roteiro-compartilhado.html?t=${shareToken}`;
    }

    async function getSharedItinerary(shareToken) {
        _ensureInitialized();
        const { data, error } = await supabase.from('saved_itineraries')
            .select('destino_nome, destino_pais, data_ida, data_volta, num_dias, dados_roteiro, created_at')
            .eq('share_token', shareToken).eq('compartilhado', true).single();
        if (error) throw error;
        return data;
    }

    async function removeItinerary(id) {
        _ensureInitialized();
        if (!currentUser) return;
        const { error } = await supabase.from('saved_itineraries').delete()
            .eq('id', id).eq('user_id', currentUser.id);
        if (error) throw error;
    }

    // ==========================================
    // UTILIDADES / GETTERS
    // ==========================================

    function getUser() { return currentUser; }
    function isLoggedIn() { return currentUser !== null; }

    function getUserDisplayName() {
        if (currentProfile?.nome_exibicao) return currentProfile.nome_exibicao;
        if (currentUser?.user_metadata?.full_name) return currentUser.user_metadata.full_name;
        if (currentUser?.user_metadata?.name) return currentUser.user_metadata.name;
        if (currentUser?.email) return currentUser.email.split('@')[0];
        return 'Viajante';
    }

    function getUserAvatar() {
        if (currentProfile?.avatar_url) return currentProfile.avatar_url;
        if (currentUser?.user_metadata?.avatar_url) return currentUser.user_metadata.avatar_url;
        if (currentUser?.user_metadata?.picture) return currentUser.user_metadata.picture;
        return null;
    }

    function onAuthChange(callback) {
        if (typeof callback === 'function') authChangeCallbacks.push(callback);
    }

    // ==========================================
    // FUNÇÕES INTERNAS
    // ==========================================

    function _ensureInitialized() {
        if (!supabase) throw new Error('BenetripAuth não inicializado ou Supabase não configurado.');
    }

    async function _loadProfile() {
        if (!currentUser || !supabase) return;
        try {
            const { data, error } = await supabase.from('user_profiles').select('*')
                .eq('user_id', currentUser.id).single();
            if (error) { console.warn('[BenetripAuth] Perfil não encontrado.'); return; }
            currentProfile = data;
        } catch (e) { console.warn('[BenetripAuth] Erro ao carregar perfil:', e); }
    }

    async function _cleanOldSearches() {
        if (!currentUser || !supabase) return;
        try {
            const { count } = await supabase.from('search_history')
                .select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
            if (count > CONFIG.maxSearchHistory) {
                const excess = count - CONFIG.maxSearchHistory;
                const { data: old } = await supabase.from('search_history').select('id')
                    .eq('user_id', currentUser.id).order('created_at', { ascending: true }).limit(excess);
                if (old?.length) {
                    await supabase.from('search_history').delete().in('id', old.map(s => s.id));
                }
            }
        } catch (e) { /* silencioso */ }
    }

    function _notifyCallbacks(event, user) {
        authChangeCallbacks.forEach(cb => {
            try { cb(event, user); } catch (e) { console.error('[BenetripAuth] Erro em callback:', e); }
        });
    }

    function _translateError(error) {
        const messages = {
            'Invalid login credentials': 'Email ou senha incorretos.',
            'Email not confirmed': 'Confirme seu email antes de fazer login. Verifique sua caixa de entrada.',
            'User already registered': 'Este email já está cadastrado. Tente fazer login.',
            'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
            'Unable to validate email address: invalid format': 'Formato de email inválido.',
            'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos.',
            'Signup requires a valid password': 'Digite uma senha válida.',
            'To signup, please provide your email': 'Digite um email válido.',
        };
        const translated = new Error(messages[error.message] || error.message);
        translated.originalError = error;
        translated.status = error.status;
        return translated;
    }

    function _updateUI(user) {
        const loginBtn = document.querySelector('[data-auth="login-btn"]');
        const userMenu = document.querySelector('[data-auth="user-menu"]');
        const userName = document.querySelector('[data-auth="user-name"]');
        const userAvatar = document.querySelector('[data-auth="user-avatar"]');
        const logoutBtn = document.querySelector('[data-auth="logout-btn"]');

        if (user) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (userMenu) userMenu.style.display = 'flex';
            if (userName) userName.textContent = getUserDisplayName();
            if (userAvatar) {
                const avatarUrl = getUserAvatar();
                if (avatarUrl) {
                    userAvatar.src = avatarUrl;
                    userAvatar.style.display = 'block';
                } else {
                    userAvatar.style.display = 'none';
                    const initialsEl = document.querySelector('[data-auth="user-initials"]');
                    if (initialsEl) {
                        initialsEl.textContent = getUserDisplayName().charAt(0).toUpperCase();
                        initialsEl.style.display = 'flex';
                    }
                }
            }
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await signOut();
                });
            }
        } else {
            if (loginBtn) loginBtn.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
        }

        document.querySelectorAll('[data-auth-show="logged-in"]').forEach(el => {
            el.style.display = user ? '' : 'none';
        });
        document.querySelectorAll('[data-auth-show="logged-out"]').forEach(el => {
            el.style.display = user ? 'none' : '';
        });
    }

    // ==========================================
    // AUTO-INICIALIZAÇÃO
    // ==========================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================

    return {
        init, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithFacebook,
        signOut, resetPassword, getUser, isLoggedIn, getProfile, updateProfile,
        getUserDisplayName, getUserAvatar, onAuthChange, saveSearch, getSearchHistory,
        deleteSearch, clearSearchHistory, saveDestination, getSavedDestinations,
        removeDestination, saveItinerary, getSavedItineraries, shareItinerary,
        getSharedItinerary, removeItinerary,
    };

})();

window.BenetripAuth = BenetripAuth;
