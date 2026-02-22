/**
 * ============================================
 * BENETRIP AUTH MODULE - benetrip-auth.js
 * ============================================
 * Módulo global de autenticação para todas as páginas da Benetrip.
 * Utiliza Supabase Auth com suporte a Email/Senha, Google e Facebook.
 * 
 * COMO USAR:
 * 1. Incluir este script em todas as páginas ANTES dos outros scripts
 * 2. Configurar as variáveis de ambiente no Vercel:
 *    - NEXT_PUBLIC_SUPABASE_URL
 *    - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 3. No HTML: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *             <script src="/js/benetrip-auth.js"></script>
 * 
 * API PÚBLICA:
 * - BenetripAuth.init() — inicializa (chamado automaticamente)
 * - BenetripAuth.getUser() — retorna usuário atual ou null
 * - BenetripAuth.isLoggedIn() — boolean
 * - BenetripAuth.signInWithEmail(email, password)
 * - BenetripAuth.signUpWithEmail(email, password, nome)
 * - BenetripAuth.signInWithGoogle()
 * - BenetripAuth.signInWithFacebook()
 * - BenetripAuth.signOut()
 * - BenetripAuth.getProfile() — dados do perfil
 * - BenetripAuth.updateProfile(dados)
 * - BenetripAuth.saveSearch(tipo, parametros, resultados)
 * - BenetripAuth.getSearchHistory(limit, offset)
 * - BenetripAuth.saveDestination(dados)
 * - BenetripAuth.getSavedDestinations()
 * - BenetripAuth.removeDestination(id)
 * - BenetripAuth.saveItinerary(dados)
 * - BenetripAuth.getSavedItineraries()
 * - BenetripAuth.onAuthChange(callback)
 */

const BenetripAuth = (function () {
    'use strict';

    // ==========================================
    // CONFIGURAÇÃO
    // ==========================================

    // As variáveis são injetadas pelo build ou lidas de meta tags
    const CONFIG = {
        supabaseUrl: '',
        supabaseAnonKey: '',
        redirectUrl: window.location.origin,
        maxSearchHistory: 100, // máximo de buscas no histórico
    };

    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let authChangeCallbacks = [];
    let initialized = false;

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================

    /**
     * Inicializa o módulo de autenticação
     * Busca config do servidor e configura o Supabase client
     */
    async function init() {
        if (initialized) return;

        try {
            // Buscar configuração do servidor (seguro)
            const configResponse = await fetch('/api/auth/config');
            if (configResponse.ok) {
                const config = await configResponse.json();
                CONFIG.supabaseUrl = config.supabaseUrl;
                CONFIG.supabaseAnonKey = config.supabaseAnonKey;
            } else {
                // Fallback: ler de meta tags no HTML
                const metaUrl = document.querySelector('meta[name="supabase-url"]');
                const metaKey = document.querySelector('meta[name="supabase-anon-key"]');
                if (metaUrl && metaKey) {
                    CONFIG.supabaseUrl = metaUrl.content;
                    CONFIG.supabaseAnonKey = metaKey.content;
                }
            }

            if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) {
                console.warn('[BenetripAuth] Supabase não configurado. Auth desabilitado.');
                initialized = true;
                _updateUI(null);
                return;
            }

            // Inicializar Supabase client
            supabase = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true,
                    flowType: 'pkce' // mais seguro para SPA
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

            // Verificar sessão existente
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                currentUser = session.user;
                await _loadProfile();
            }

            initialized = true;
            _updateUI(currentUser);
            console.log('[BenetripAuth] Inicializado.', currentUser ? `Usuário: ${currentUser.email}` : 'Sem sessão.');

        } catch (error) {
            console.error('[BenetripAuth] Erro na inicialização:', error);
            initialized = true;
            _updateUI(null);
        }
    }

    // ==========================================
    // AUTENTICAÇÃO
    // ==========================================

    /**
     * Login com email e senha
     */
    async function signInWithEmail(email, password) {
        _ensureInitialized();
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password
        });

        if (error) {
            throw _translateError(error);
        }

        return data;
    }

    /**
     * Cadastro com email, senha e nome
     */
    async function signUpWithEmail(email, password, nome) {
        _ensureInitialized();

        const { data, error } = await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
                data: {
                    full_name: nome,
                    name: nome
                },
                emailRedirectTo: `${CONFIG.redirectUrl}/auth-callback.html`
            }
        });

        if (error) {
            throw _translateError(error);
        }

        return data;
    }

    /**
     * Login com Google (OAuth)
     */
    async function signInWithGoogle() {
        _ensureInitialized();

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${CONFIG.redirectUrl}/auth-callback.html`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        });

        if (error) {
            throw _translateError(error);
        }

        return data;
    }

    /**
     * Login com Facebook (OAuth)
     */
    async function signInWithFacebook() {
        _ensureInitialized();

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'facebook',
            options: {
                redirectTo: `${CONFIG.redirectUrl}/auth-callback.html`,
                scopes: 'email,public_profile'
            }
        });

        if (error) {
            throw _translateError(error);
        }

        return data;
    }

    /**
     * Logout
     */
    async function signOut() {
        _ensureInitialized();

        const { error } = await supabase.auth.signOut();
        if (error) {
            throw _translateError(error);
        }

        currentUser = null;
        currentProfile = null;
        _updateUI(null);
    }

    /**
     * Recuperação de senha
     */
    async function resetPassword(email) {
        _ensureInitialized();

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: `${CONFIG.redirectUrl}/auth-callback.html?type=recovery`
        });

        if (error) {
            throw _translateError(error);
        }
    }

    // ==========================================
    // PERFIL DO USUÁRIO
    // ==========================================

    /**
     * Retorna o perfil completo do usuário
     */
    async function getProfile() {
        if (!currentUser) return null;
        if (currentProfile) return currentProfile;
        await _loadProfile();
        return currentProfile;
    }

    /**
     * Atualiza dados do perfil
     */
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
            .select()
            .single();

        if (error) throw error;

        currentProfile = data;
        return data;
    }

    // ==========================================
    // HISTÓRICO DE BUSCAS
    // ==========================================

    /**
     * Salva uma busca no histórico (chamado automaticamente pelas páginas)
     * @param {string} tipo - tipo da busca (descobrir_destinos, voos, etc.)
     * @param {object} parametros - dados do formulário de busca
     * @param {object} resultados - resumo dos resultados
     */
    async function saveSearch(tipo, parametros, resultados) {
        if (!currentUser || !supabase) return null; // silencioso se não logado

        try {
            const { data, error } = await supabase
                .from('search_history')
                .insert({
                    user_id: currentUser.id,
                    tipo_busca: tipo,
                    parametros: parametros || {},
                    resultados_resumo: resultados || {}
                })
                .select()
                .single();

            if (error) {
                console.warn('[BenetripAuth] Erro ao salvar busca:', error.message);
                return null;
            }

            // Limpar histórico antigo se excedeu o limite
            _cleanOldSearches();

            return data;
        } catch (e) {
            console.warn('[BenetripAuth] Erro ao salvar busca:', e);
            return null;
        }
    }

    /**
     * Retorna histórico de buscas do usuário
     */
    async function getSearchHistory(limit = 20, offset = 0, tipo = null) {
        _ensureInitialized();
        if (!currentUser) return [];

        let query = supabase
            .from('search_history')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (tipo) {
            query = query.eq('tipo_busca', tipo);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data || [];
    }

    /**
     * Deleta uma busca do histórico
     */
    async function deleteSearch(searchId) {
        _ensureInitialized();
        if (!currentUser) return;

        const { error } = await supabase
            .from('search_history')
            .delete()
            .eq('id', searchId)
            .eq('user_id', currentUser.id);

        if (error) throw error;
    }

    /**
     * Limpa todo o histórico de buscas
     */
    async function clearSearchHistory() {
        _ensureInitialized();
        if (!currentUser) return;

        const { error } = await supabase
            .from('search_history')
            .delete()
            .eq('user_id', currentUser.id);

        if (error) throw error;
    }

    // ==========================================
    // DESTINOS SALVOS
    // ==========================================

    /**
     * Salva um destino como favorito
     */
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
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Lista destinos salvos
     */
    async function getSavedDestinations() {
        _ensureInitialized();
        if (!currentUser) return [];

        const { data, error } = await supabase
            .from('saved_destinations')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Remove um destino salvo
     */
    async function removeDestination(id) {
        _ensureInitialized();
        if (!currentUser) return;

        const { error } = await supabase
            .from('saved_destinations')
            .delete()
            .eq('id', id)
            .eq('user_id', currentUser.id);

        if (error) throw error;
    }

    // ==========================================
    // ROTEIROS SALVOS
    // ==========================================

    /**
     * Salva um roteiro completo
     */
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
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Lista roteiros salvos
     */
    async function getSavedItineraries() {
        _ensureInitialized();
        if (!currentUser) return [];

        const { data, error } = await supabase
            .from('saved_itineraries')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Compartilha um roteiro (gera link público)
     */
    async function shareItinerary(itineraryId) {
        _ensureInitialized();
        if (!currentUser) throw new Error('Faça login para compartilhar');

        // Gerar token único
        const shareToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        const { data, error } = await supabase
            .from('saved_itineraries')
            .update({
                compartilhado: true,
                share_token: shareToken
            })
            .eq('id', itineraryId)
            .eq('user_id', currentUser.id)
            .select()
            .single();

        if (error) throw error;
        return `${CONFIG.redirectUrl}/roteiro-compartilhado.html?t=${shareToken}`;
    }

    /**
     * Busca roteiro compartilhado por token (público)
     */
    async function getSharedItinerary(shareToken) {
        _ensureInitialized();

        const { data, error } = await supabase
            .from('saved_itineraries')
            .select('destino_nome, destino_pais, data_ida, data_volta, num_dias, dados_roteiro, created_at')
            .eq('share_token', shareToken)
            .eq('compartilhado', true)
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Remove um roteiro salvo
     */
    async function removeItinerary(id) {
        _ensureInitialized();
        if (!currentUser) return;

        const { error } = await supabase
            .from('saved_itineraries')
            .delete()
            .eq('id', id)
            .eq('user_id', currentUser.id);

        if (error) throw error;
    }

    // ==========================================
    // UTILIDADES / GETTERS
    // ==========================================

    function getUser() {
        return currentUser;
    }

    function isLoggedIn() {
        return currentUser !== null;
    }

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

    /**
     * Registra callback para mudanças de autenticação
     * @param {function} callback - function(event, user)
     */
    function onAuthChange(callback) {
        if (typeof callback === 'function') {
            authChangeCallbacks.push(callback);
        }
    }

    // ==========================================
    // FUNÇÕES INTERNAS
    // ==========================================

    function _ensureInitialized() {
        if (!supabase) {
            throw new Error('BenetripAuth não inicializado ou Supabase não configurado.');
        }
    }

    async function _loadProfile() {
        if (!currentUser || !supabase) return;

        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', currentUser.id)
                .single();

            if (error) {
                // Perfil pode não existir ainda (race condition com trigger)
                console.warn('[BenetripAuth] Perfil não encontrado, será criado automaticamente.');
                return;
            }

            currentProfile = data;
        } catch (e) {
            console.warn('[BenetripAuth] Erro ao carregar perfil:', e);
        }
    }

    async function _cleanOldSearches() {
        if (!currentUser || !supabase) return;

        try {
            // Contar buscas
            const { count } = await supabase
                .from('search_history')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id);

            if (count > CONFIG.maxSearchHistory) {
                // Buscar IDs das buscas mais antigas para deletar
                const excess = count - CONFIG.maxSearchHistory;
                const { data: oldSearches } = await supabase
                    .from('search_history')
                    .select('id')
                    .eq('user_id', currentUser.id)
                    .order('created_at', { ascending: true })
                    .limit(excess);

                if (oldSearches?.length) {
                    const idsToDelete = oldSearches.map(s => s.id);
                    await supabase
                        .from('search_history')
                        .delete()
                        .in('id', idsToDelete);
                }
            }
        } catch (e) {
            // Silencioso - limpeza é não-crítica
        }
    }

    function _notifyCallbacks(event, user) {
        authChangeCallbacks.forEach(cb => {
            try {
                cb(event, user);
            } catch (e) {
                console.error('[BenetripAuth] Erro em callback:', e);
            }
        });
    }

    /**
     * Traduz erros do Supabase para mensagens em português
     */
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

        const translatedMessage = messages[error.message] || error.message;

        const translatedError = new Error(translatedMessage);
        translatedError.originalError = error;
        translatedError.status = error.status;
        return translatedError;
    }

    /**
     * Atualiza elementos de UI em todas as páginas
     * Procura elementos com data-attributes específicos
     */
    function _updateUI(user) {
        // Elementos do header
        const loginBtn = document.querySelector('[data-auth="login-btn"]');
        const userMenu = document.querySelector('[data-auth="user-menu"]');
        const userName = document.querySelector('[data-auth="user-name"]');
        const userAvatar = document.querySelector('[data-auth="user-avatar"]');
        const logoutBtn = document.querySelector('[data-auth="logout-btn"]');

        if (user) {
            // Logado
            if (loginBtn) loginBtn.style.display = 'none';
            if (userMenu) userMenu.style.display = 'flex';
            if (userName) userName.textContent = getUserDisplayName();
            if (userAvatar) {
                const avatarUrl = getUserAvatar();
                if (avatarUrl) {
                    userAvatar.src = avatarUrl;
                    userAvatar.style.display = 'block';
                } else {
                    // Avatar padrão com iniciais
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
            // Não logado
            if (loginBtn) loginBtn.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
        }

        // Atualizar elementos condicionais
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

    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================

    return {
        init,
        // Auth
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithFacebook,
        signOut,
        resetPassword,
        // User
        getUser,
        isLoggedIn,
        getProfile,
        updateProfile,
        getUserDisplayName,
        getUserAvatar,
        onAuthChange,
        // Search History
        saveSearch,
        getSearchHistory,
        deleteSearch,
        clearSearchHistory,
        // Destinations
        saveDestination,
        getSavedDestinations,
        removeDestination,
        // Itineraries
        saveItinerary,
        getSavedItineraries,
        shareItinerary,
        getSharedItinerary,
        removeItinerary,
    };

})();

// Exportar globalmente
window.BenetripAuth = BenetripAuth;
