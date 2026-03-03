/**
 * ============================================
 * BENETRIP MINHA CONTA - PREFERÊNCIAS v2.0
 * ============================================
 * Integra preferências de viagem DENTRO da aba Perfil existente.
 * Não cria tab separada — expande o Perfil com seção de preferências.
 *
 * DEPENDE DE:
 *  - benetrip-auth.js
 *  - benetrip-preferences.js (core save/load/sync)
 *
 * COMO USAR:
 *  1. Incluir APÓS benetrip-preferences.js em minha-conta.html
 *  2. Chamar MinhaContaPrefs.init() no MinhaConta.init()
 *     Ele injeta a seção de preferências no #panel-perfil,
 *     DEPOIS do formulário de dados básicos e ANTES do botão logout.
 */

const MinhaContaPrefs = (function () {
    'use strict';

    const THEME = {
        orange: '#E87722',
        blue: '#00A3E0',
        dark: '#21272A',
        gray100: '#F5F5F5',
        gray200: '#E8E8E8',
        gray400: '#9E9E9E',
        gray600: '#616161',
        green: '#43A047',
        red: '#E53935'
    };

    let cidadesData = null;
    let currentPrefs = null;
    let isEditing = false;

    // ================================================================
    // INIT — injeta seção de preferências no painel Perfil
    // ================================================================

    function init() {
        _injectStyles();
        _injectPrefsSection();
        _loadCidades();
        loadAndRender();
    }

    // ================================================================
    // CARREGAR E RENDERIZAR PREFERÊNCIAS
    // ================================================================

    async function loadAndRender() {
        if (typeof BenetripPreferences === 'undefined') return;

        try {
            currentPrefs = await BenetripPreferences.load();
        } catch (e) {
            console.warn('[MinhaContaPrefs] Erro ao carregar:', e);
            currentPrefs = null;
        }

        if (!isEditing) {
            renderViewMode();
        }
    }

    // ================================================================
    // VIEW MODE — mostra resumo das preferências
    // ================================================================

    function renderViewMode() {
        isEditing = false;
        const container = document.getElementById('prefs-content');
        if (!container) return;

        if (!currentPrefs || !_hasAnyPreference(currentPrefs)) {
            container.innerHTML = `
                <div class="prefs-empty">
                    <div class="prefs-empty-icon">🎯</div>
                    <p class="prefs-empty-text">Nenhuma preferência salva ainda.</p>
                    <p class="prefs-empty-hint">Faça uma busca em <a href="descobrir-destinos.html" style="color:${THEME.orange};font-weight:600;">Descobrir Destinos</a> 
                    e suas preferências serão salvas automaticamente, ou configure aqui!</p>
                    <button class="prefs-btn-edit" onclick="MinhaContaPrefs.enterEditMode()">
                        ✏️ Configurar Preferências
                    </button>
                </div>`;
            return;
        }

        const p = currentPrefs;
        const COMP_LABELS = {
            0: '🧳 Sozinho(a)',
            1: '❤️ Viagem romântica (casal)',
            2: '👨‍👩‍👧‍👦 Em família',
            3: '🎉 Com amigos'
        };
        const PREF_LABELS = {
            'relax': '🌊 Relax total',
            'aventura': '🏔️ Aventura',
            'cultura': '🏛️ Cultura',
            'urbano': '🏙️ Agito urbano'
        };
        const ESCOPO_LABELS = {
            'tanto_faz': '🗺️ Nacional e internacional',
            'internacional': '✈️ Apenas internacionais'
        };
        const MOEDA_LABELS = {
            'BRL': '💰 Real (BRL)',
            'USD': '💵 Dólar (USD)',
            'EUR': '💶 Euro (EUR)'
        };
        const simbolo = { 'BRL': 'R$', 'USD': 'US$', 'EUR': '€' }[p.moeda] || 'R$';

        // Origem
        let origemText = '—';
        if (p.origem && p.origem.name) {
            origemText = p.origem.airport
                ? `${p.origem.name} — ${p.origem.airport} (${p.origem.code})`
                : `${p.origem.name} (${p.origem.code})`;
        }

        // Companhia + detalhes
        let compText = COMP_LABELS[p.companhia] || '—';
        if (p.companhia === 2) {
            const parts = [`${p.adultos || 2} adulto(s)`];
            if (p.criancas > 0) parts.push(`${p.criancas} criança(s)`);
            if (p.bebes > 0) parts.push(`${p.bebes} bebê(s)`);
            compText += ` · ${parts.join(', ')}`;
        } else if (p.companhia === 3 && p.numPessoas) {
            compText += ` · ${p.numPessoas} pessoas`;
        }

        // Preferências
        let prefsText = '—';
        if (p.preferencias) {
            prefsText = p.preferencias.split(',')
                .filter(Boolean)
                .map(k => PREF_LABELS[k.trim()] || k.trim())
                .join(' + ');
        }

        const updated = p._updatedAt
            ? new Date(p._updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '';

        container.innerHTML = `
            <div class="prefs-summary">
                <div class="prefs-grid">
                    <div class="prefs-item">
                        <span class="prefs-label">Cidade de origem</span>
                        <span class="prefs-value">📍 ${origemText}</span>
                    </div>
                    <div class="prefs-item">
                        <span class="prefs-label">Companhia</span>
                        <span class="prefs-value">${compText}</span>
                    </div>
                    <div class="prefs-item">
                        <span class="prefs-label">Estilo de viagem</span>
                        <span class="prefs-value">${prefsText}</span>
                    </div>
                    <div class="prefs-item">
                        <span class="prefs-label">Destinos</span>
                        <span class="prefs-value">${ESCOPO_LABELS[p.escopoDestino] || '—'}</span>
                    </div>
                    <div class="prefs-item">
                        <span class="prefs-label">Moeda</span>
                        <span class="prefs-value">${MOEDA_LABELS[p.moeda] || '—'}</span>
                    </div>
                    <div class="prefs-item">
                        <span class="prefs-label">Orçamento passagens</span>
                        <span class="prefs-value">${p.orcamento ? `${simbolo} ${Math.round(p.orcamento).toLocaleString('pt-BR')} por pessoa` : '—'}</span>
                    </div>
                    ${p.observacoes ? `
                    <div class="prefs-item prefs-item-full">
                        <span class="prefs-label">Dicas pra Tripinha</span>
                        <span class="prefs-value">💬 "${p.observacoes}"</span>
                    </div>` : ''}
                </div>
                ${updated ? `<p class="prefs-updated">Atualizado em ${updated}</p>` : ''}
                <div class="prefs-actions">
                    <button class="prefs-btn-edit" onclick="MinhaContaPrefs.enterEditMode()">✏️ Editar Preferências</button>
                    <button class="prefs-btn-clear" onclick="MinhaContaPrefs.confirmarLimpar()">🗑️ Limpar</button>
                </div>
            </div>`;
    }

    // ================================================================
    // EDIT MODE — formulário completo de preferências
    // ================================================================

    function enterEditMode() {
        isEditing = true;
        const container = document.getElementById('prefs-content');
        if (!container) return;

        const p = currentPrefs || {};

        // Origem formatada
        let origemDisplay = '';
        if (p.origem && p.origem.name) {
            origemDisplay = p.origem.airport
                ? `${p.origem.name} — ${p.origem.airport} (${p.origem.code})`
                : `${p.origem.name} (${p.origem.code})`;
        }

        const moedaSimbolos = { 'BRL': 'R$', 'USD': '$', 'EUR': '€' };

        container.innerHTML = `
            <div class="prefs-edit-form">

                <!-- Origem -->
                <div class="pref-field">
                    <label class="pref-label">📍 Cidade de origem padrão</label>
                    <div class="pref-autocomplete-wrapper">
                        <input type="text" id="pref-origem" class="pref-input" 
                               placeholder="Ex: São Paulo, Rio de Janeiro..." 
                               value="${origemDisplay}" autocomplete="off">
                        <div id="pref-origem-results" class="pref-autocomplete-results"></div>
                    </div>
                    <input type="hidden" id="pref-origem-data" value='${p.origem ? JSON.stringify(p.origem) : ''}'>
                </div>

                <!-- Companhia -->
                <div class="pref-field">
                    <label class="pref-label">👥 Com quem você costuma viajar?</label>
                    <div class="pref-chips" id="pref-companhia-chips">
                        <button type="button" class="pref-chip ${p.companhia === 0 ? 'active' : ''}" data-value="0">🧳 Sozinho(a)</button>
                        <button type="button" class="pref-chip ${p.companhia === 1 ? 'active' : ''}" data-value="1">❤️ Casal</button>
                        <button type="button" class="pref-chip ${p.companhia === 2 ? 'active' : ''}" data-value="2">👨‍👩‍👧‍👦 Família</button>
                        <button type="button" class="pref-chip ${p.companhia === 3 ? 'active' : ''}" data-value="3">🎉 Amigos</button>
                    </div>
                </div>

                <!-- Família detalhes (condicional) -->
                <div class="pref-field pref-conditional" id="pref-familia-group" style="display:${p.companhia === 2 ? 'block' : 'none'};">
                    <label class="pref-label">Composição da família</label>
                    <div class="pref-number-grid">
                        <div class="pref-number-row">
                            <span>🧑 Adultos (12+)</span>
                            <div class="pref-number-ctrl">
                                <button type="button" class="pref-num-btn" data-target="pref-adultos" data-action="dec">−</button>
                                <input type="number" id="pref-adultos" value="${p.adultos || 2}" min="1" max="9" readonly>
                                <button type="button" class="pref-num-btn" data-target="pref-adultos" data-action="inc">+</button>
                            </div>
                        </div>
                        <div class="pref-number-row">
                            <span>👧 Crianças (2–11)</span>
                            <div class="pref-number-ctrl">
                                <button type="button" class="pref-num-btn" data-target="pref-criancas" data-action="dec">−</button>
                                <input type="number" id="pref-criancas" value="${p.criancas || 0}" min="0" max="6" readonly>
                                <button type="button" class="pref-num-btn" data-target="pref-criancas" data-action="inc">+</button>
                            </div>
                        </div>
                        <div class="pref-number-row">
                            <span>👶 Bebês (0–1)</span>
                            <div class="pref-number-ctrl">
                                <button type="button" class="pref-num-btn" data-target="pref-bebes" data-action="dec">−</button>
                                <input type="number" id="pref-bebes" value="${p.bebes || 0}" min="0" max="4" readonly>
                                <button type="button" class="pref-num-btn" data-target="pref-bebes" data-action="inc">+</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Amigos detalhes (condicional) -->
                <div class="pref-field pref-conditional" id="pref-amigos-group" style="display:${p.companhia === 3 ? 'block' : 'none'};">
                    <label class="pref-label">Quantas pessoas na turma?</label>
                    <div class="pref-number-ctrl" style="justify-content:flex-start;">
                        <button type="button" class="pref-num-btn" data-target="pref-num-amigos" data-action="dec">−</button>
                        <input type="number" id="pref-num-amigos" value="${p.numPessoas || 3}" min="2" max="20" readonly>
                        <button type="button" class="pref-num-btn" data-target="pref-num-amigos" data-action="inc">+</button>
                    </div>
                </div>

                <!-- Preferências de viagem (multi-select) -->
                <div class="pref-field">
                    <label class="pref-label">🎯 Estilo de viagem preferido</label>
                    <p class="pref-hint">Escolha uma ou mais opções</p>
                    <div class="pref-chips pref-chips-multi" id="pref-estilo-chips">
                        <button type="button" class="pref-chip ${_prefIncludes(p.preferencias, 'relax') ? 'active' : ''}" data-value="relax">🌊 Relax total</button>
                        <button type="button" class="pref-chip ${_prefIncludes(p.preferencias, 'aventura') ? 'active' : ''}" data-value="aventura">🏔️ Aventura</button>
                        <button type="button" class="pref-chip ${_prefIncludes(p.preferencias, 'cultura') ? 'active' : ''}" data-value="cultura">🏛️ Cultura</button>
                        <button type="button" class="pref-chip ${_prefIncludes(p.preferencias, 'urbano') ? 'active' : ''}" data-value="urbano">🏙️ Agito urbano</button>
                    </div>
                </div>

                <!-- Escopo destino -->
                <div class="pref-field">
                    <label class="pref-label">🌍 Destinos internacionais ou nacionais?</label>
                    <div class="pref-chips" id="pref-escopo-chips">
                        <button type="button" class="pref-chip ${(p.escopoDestino || 'tanto_faz') === 'tanto_faz' ? 'active' : ''}" data-value="tanto_faz">🗺️ Tanto faz</button>
                        <button type="button" class="pref-chip ${p.escopoDestino === 'internacional' ? 'active' : ''}" data-value="internacional">✈️ Só internacionais</button>
                    </div>
                </div>

                <!-- Moeda -->
                <div class="pref-field">
                    <label class="pref-label">💰 Moeda preferida</label>
                    <div class="pref-chips" id="pref-moeda-chips">
                        <button type="button" class="pref-chip ${(p.moeda || 'BRL') === 'BRL' ? 'active' : ''}" data-value="BRL">💰 Real</button>
                        <button type="button" class="pref-chip ${p.moeda === 'USD' ? 'active' : ''}" data-value="USD">💵 Dólar</button>
                        <button type="button" class="pref-chip ${p.moeda === 'EUR' ? 'active' : ''}" data-value="EUR">💶 Euro</button>
                    </div>
                </div>

                <!-- Orçamento -->
                <div class="pref-field">
                    <label class="pref-label">💸 Orçamento padrão para passagens (por pessoa)</label>
                    <div class="pref-currency-wrapper">
                        <span class="pref-currency-symbol" id="pref-currency-symbol">${moedaSimbolos[p.moeda] || 'R$'}</span>
                        <input type="text" id="pref-orcamento" class="pref-input" 
                               inputmode="numeric" placeholder="2.000"
                               value="${p.orcamento ? Math.round(p.orcamento).toLocaleString('pt-BR') : ''}">
                    </div>
                </div>

                <!-- Observações -->
                <div class="pref-field">
                    <label class="pref-label">💬 Dicas extras para a Tripinha <small style="font-weight:400;color:#999;">(opcional)</small></label>
                    <textarea id="pref-observacoes" class="pref-textarea" rows="3" maxlength="500"
                              placeholder="Ex: Prefiro praias calmas, adoro gastronomia, não gosto de frio...">${p.observacoes || ''}</textarea>
                    <p class="pref-obs-counter"><span id="pref-obs-count">${(p.observacoes || '').length}</span>/500</p>
                </div>

                <!-- Ações -->
                <div class="prefs-edit-actions">
                    <button class="prefs-btn-save" onclick="MinhaContaPrefs.salvar()">💾 Salvar Preferências</button>
                    <button class="prefs-btn-cancel" onclick="MinhaContaPrefs.cancelar()">Cancelar</button>
                </div>
            </div>`;

        _bindEditEvents();
    }

    // ================================================================
    // BIND EVENTS DO FORMULÁRIO DE EDIÇÃO
    // ================================================================

    function _bindEditEvents() {
        // Autocomplete de origem
        const origemInput = document.getElementById('pref-origem');
        const origemResults = document.getElementById('pref-origem-results');
        let debounce;

        if (origemInput) {
            origemInput.addEventListener('input', () => {
                clearTimeout(debounce);
                const termo = origemInput.value.trim();
                if (termo.length < 2) {
                    origemResults.style.display = 'none';
                    return;
                }
                debounce = setTimeout(() => {
                    const cidades = _buscarCidades(termo);
                    if (cidades.length === 0) {
                        origemResults.innerHTML = '<div class="pref-ac-empty">Nenhuma cidade encontrada</div>';
                        origemResults.style.display = 'block';
                        return;
                    }
                    origemResults.innerHTML = cidades.map(c => `
                        <div class="pref-ac-item" data-city='${JSON.stringify(c).replace(/'/g, '&#39;')}'>
                            <strong>${c.code}</strong> ${c.name}${c.state ? ', ' + c.state : ''}${c.airport ? ' — ' + c.airport : ''}
                            <small>${c.country}</small>
                        </div>`).join('');
                    origemResults.style.display = 'block';

                    origemResults.querySelectorAll('.pref-ac-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const city = JSON.parse(item.dataset.city.replace(/&#39;/g, "'"));
                            origemInput.value = city.airport
                                ? `${city.name} — ${city.airport} (${city.code})`
                                : `${city.name} (${city.code})`;
                            document.getElementById('pref-origem-data').value = JSON.stringify(city);
                            origemResults.style.display = 'none';
                        });
                    });
                }, 250);
            });

            document.addEventListener('click', (e) => {
                if (!origemInput.contains(e.target) && !origemResults.contains(e.target)) {
                    origemResults.style.display = 'none';
                }
            });
        }

        // Chips single-select (companhia, escopo, moeda)
        ['pref-companhia-chips', 'pref-escopo-chips', 'pref-moeda-chips'].forEach(groupId => {
            const group = document.getElementById(groupId);
            if (!group) return;
            group.querySelectorAll('.pref-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    group.querySelectorAll('.pref-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');

                    // Companhia: mostrar/esconder campos condicionais
                    if (groupId === 'pref-companhia-chips') {
                        const val = parseInt(chip.dataset.value);
                        const familiaGroup = document.getElementById('pref-familia-group');
                        const amigosGroup = document.getElementById('pref-amigos-group');
                        if (familiaGroup) familiaGroup.style.display = val === 2 ? 'block' : 'none';
                        if (amigosGroup) amigosGroup.style.display = val === 3 ? 'block' : 'none';
                    }

                    // Moeda: atualizar símbolo
                    if (groupId === 'pref-moeda-chips') {
                        const simbolos = { 'BRL': 'R$', 'USD': '$', 'EUR': '€' };
                        const sym = document.getElementById('pref-currency-symbol');
                        if (sym) sym.textContent = simbolos[chip.dataset.value] || 'R$';
                    }
                });
            });
        });

        // Chips multi-select (estilo)
        const estiloGroup = document.getElementById('pref-estilo-chips');
        if (estiloGroup) {
            estiloGroup.querySelectorAll('.pref-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    chip.classList.toggle('active');
                });
            });
        }

        // Number controls
        document.querySelectorAll('.pref-num-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.target);
                if (!input) return;
                const val = parseInt(input.value);
                const min = parseInt(input.min);
                const max = parseInt(input.max);
                if (btn.dataset.action === 'inc' && val < max) input.value = val + 1;
                if (btn.dataset.action === 'dec' && val > min) input.value = val - 1;
            });
        });

        // Orçamento mask
        const orcInput = document.getElementById('pref-orcamento');
        if (orcInput) {
            orcInput.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (val) {
                    e.target.value = parseInt(val).toLocaleString('pt-BR');
                } else {
                    e.target.value = '';
                }
            });
        }

        // Observações counter
        const obsTextarea = document.getElementById('pref-observacoes');
        const obsCount = document.getElementById('pref-obs-count');
        if (obsTextarea && obsCount) {
            obsTextarea.addEventListener('input', () => {
                obsCount.textContent = obsTextarea.value.length;
            });
        }
    }

    // ================================================================
    // SALVAR PREFERÊNCIAS
    // ================================================================

    async function salvar() {
        if (typeof BenetripPreferences === 'undefined') {
            alert('Módulo de preferências não carregado.');
            return;
        }

        // Coletar dados
        const origemDataRaw = document.getElementById('pref-origem-data')?.value;
        let origem = null;
        try { origem = origemDataRaw ? JSON.parse(origemDataRaw) : null; } catch (e) {}

        const compChip = document.querySelector('#pref-companhia-chips .pref-chip.active');
        const companhia = compChip ? parseInt(compChip.dataset.value) : null;

        const adultos = parseInt(document.getElementById('pref-adultos')?.value) || 2;
        const criancas = parseInt(document.getElementById('pref-criancas')?.value) || 0;
        const bebes = parseInt(document.getElementById('pref-bebes')?.value) || 0;
        const numPessoas = parseInt(document.getElementById('pref-num-amigos')?.value) || 3;

        const estiloChips = document.querySelectorAll('#pref-estilo-chips .pref-chip.active');
        const preferencias = Array.from(estiloChips).map(c => c.dataset.value).join(',');

        const escopoChip = document.querySelector('#pref-escopo-chips .pref-chip.active');
        const escopoDestino = escopoChip ? escopoChip.dataset.value : 'tanto_faz';

        const moedaChip = document.querySelector('#pref-moeda-chips .pref-chip.active');
        const moeda = moedaChip ? moedaChip.dataset.value : 'BRL';

        const orcRaw = document.getElementById('pref-orcamento')?.value || '';
        const orcamento = parseFloat(orcRaw.replace(/\./g, '')) || null;

        const observacoes = (document.getElementById('pref-observacoes')?.value || '').trim();

        const prefs = {
            origem, companhia, adultos, criancas, bebes,
            numPessoas, preferencias, escopoDestino,
            moeda, orcamento, observacoes
        };

        try {
            currentPrefs = await BenetripPreferences.save(prefs);

            // Sincronizar dados do perfil Supabase também
            if (typeof BenetripAuth !== 'undefined' && BenetripAuth.isLoggedIn()) {
                try {
                    const updateData = {
                        moeda_preferida: moeda,
                        preferencias_viagem: currentPrefs
                    };
                    if (origem) {
                        updateData.cidade_origem_padrao = origem.code;
                        updateData.cidade_origem_nome = origem.name;
                    }
                    // Sincronizar nome do perfil se existir no form de perfil
                    const nomeInput = document.getElementById('input-nome');
                    if (nomeInput && nomeInput.value.trim()) {
                        updateData.nome_exibicao = nomeInput.value.trim();
                    }
                    await BenetripAuth.updateProfile(updateData);

                    // Atualizar campos do formulário de perfil básico para manter consistência
                    const inputMoeda = document.getElementById('input-moeda');
                    if (inputMoeda) inputMoeda.value = moeda;
                    const inputCidade = document.getElementById('input-cidade-origem');
                    if (inputCidade && origem) inputCidade.value = origem.code;
                } catch (e) {
                    console.warn('[MinhaContaPrefs] Perfil Supabase:', e.message);
                }
            }

            _showToast('Preferências salvas! 🐾');
            renderViewMode();
        } catch (e) {
            console.error('[MinhaContaPrefs] Erro ao salvar:', e);
            alert('Erro ao salvar preferências. Tente novamente.');
        }
    }

    // ================================================================
    // CANCELAR / LIMPAR
    // ================================================================

    function cancelar() {
        renderViewMode();
    }

    function confirmarLimpar() {
        if (typeof MinhaConta !== 'undefined' && MinhaConta.fecharConfirm) {
            document.getElementById('confirm-title').textContent = '🗑️ Limpar preferências?';
            document.getElementById('confirm-message').textContent = 'Isso removerá todas as suas preferências de viagem salvas. Seus dados de perfil (nome, etc.) não serão afetados.';
            document.getElementById('btn-confirm-action').onclick = async () => {
                await _executarLimpeza();
                MinhaConta.fecharConfirm();
            };
            document.getElementById('confirm-overlay').classList.add('active');
        } else {
            if (confirm('Limpar todas as preferências de viagem?')) {
                _executarLimpeza();
            }
        }
    }

    async function _executarLimpeza() {
        if (typeof BenetripPreferences !== 'undefined') {
            await BenetripPreferences.clear();
        }
        currentPrefs = null;
        _showToast('Preferências removidas! 🗑️');
        renderViewMode();
    }

    // ================================================================
    // INJETAR SEÇÃO NO HTML (dentro do #panel-perfil existente)
    // ================================================================

    function _injectPrefsSection() {
        const perfilPanel = document.getElementById('panel-perfil');
        if (!perfilPanel) return;

        // Procurar o container .profile-form dentro do panel-perfil
        const profileForm = perfilPanel.querySelector('.profile-form');
        if (!profileForm) return;

        // Inserir seção de preferências ANTES do botão de logout
        const logoutBtn = profileForm.querySelector('.btn-logout');
        const prefsSection = document.createElement('div');
        prefsSection.id = 'prefs-section';
        prefsSection.innerHTML = `
            <div class="prefs-separator"></div>
            <div class="prefs-section-header">
                <span class="prefs-section-icon">🎯</span>
                <div>
                    <h3 class="prefs-section-title">Preferências de Viagem</h3>
                    <p class="prefs-section-subtitle">Suas preferências pré-preenchem o formulário de busca automaticamente</p>
                </div>
            </div>
            <div id="prefs-content">
                <div class="prefs-loading">Carregando preferências...</div>
            </div>
        `;

        if (logoutBtn) {
            profileForm.insertBefore(prefsSection, logoutBtn);
        } else {
            profileForm.appendChild(prefsSection);
        }
    }

    // ================================================================
    // CARREGAR CIDADES
    // ================================================================

    async function _loadCidades() {
        try {
            const resp = await fetch('data/cidades_global_iata_v6.json');
            if (!resp.ok) throw new Error('Erro ao carregar');
            const data = await resp.json();
            cidadesData = data.filter(c => c.iata);
        } catch (e) {
            console.warn('[MinhaContaPrefs] Cidades não carregadas:', e.message);
            cidadesData = [];
        }
    }

    function _buscarCidades(termo) {
        if (!cidadesData || termo.length < 2) return [];
        const norm = termo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return cidadesData
            .filter(c => {
                const nome = c.cidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const iata = c.iata.toLowerCase();
                const aero = c.aeroporto ? c.aeroporto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
                return nome.includes(norm) || iata.includes(norm) || aero.includes(norm);
            })
            .slice(0, 8)
            .map(c => ({
                code: c.iata,
                name: c.cidade,
                state: c.sigla_estado,
                country: c.pais,
                countryCode: c.codigo_pais,
                airport: c.aeroporto || null
            }));
    }

    // ================================================================
    // HELPERS
    // ================================================================

    function _hasAnyPreference(p) {
        if (!p) return false;
        return !!(p.origem || p.companhia !== null || p.preferencias || p.orcamento || p.observacoes);
    }

    function _prefIncludes(str, val) {
        if (!str) return false;
        return str.split(',').map(s => s.trim()).includes(val);
    }

    function _showToast(msg) {
        if (typeof BenetripAutoSave !== 'undefined' && BenetripAutoSave.showToast) {
            BenetripAutoSave.showToast(msg);
            return;
        }
        const existing = document.getElementById('prefs-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'prefs-toast';
        toast.textContent = msg;
        toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#21272A;color:white;padding:12px 24px;border-radius:12px;font-family:"Montserrat",sans-serif;font-size:14px;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:10001;opacity:0;transition:all 0.3s ease;pointer-events:none;';
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(20px)'; setTimeout(() => toast.remove(), 300); }, 2500);
    }

    // ================================================================
    // ESTILOS CSS
    // ================================================================

    function _injectStyles() {
        if (document.getElementById('minha-conta-prefs-styles')) return;
        const style = document.createElement('style');
        style.id = 'minha-conta-prefs-styles';
        style.textContent = `
            /* Separador */
            .prefs-separator {
                height: 1px;
                background: var(--gray-200, #E8E8E8);
                margin: 28px 0;
            }

            /* Header da seção */
            .prefs-section-header {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                margin-bottom: 20px;
            }
            .prefs-section-icon {
                font-size: 1.6rem;
                flex-shrink: 0;
                margin-top: 2px;
            }
            .prefs-section-title {
                font-family: 'Poppins', sans-serif;
                font-size: 1rem;
                font-weight: 700;
                color: var(--dark, #21272A);
                margin: 0 0 2px;
            }
            .prefs-section-subtitle {
                font-size: 0.78rem;
                color: var(--gray-600, #616161);
                margin: 0;
                line-height: 1.4;
            }

            /* Loading */
            .prefs-loading {
                text-align: center;
                padding: 24px;
                color: var(--gray-400, #9E9E9E);
                font-size: 0.85rem;
            }

            /* Empty state */
            .prefs-empty { text-align: center; padding: 20px 0; }
            .prefs-empty-icon { font-size: 2.5rem; margin-bottom: 8px; }
            .prefs-empty-text { font-size: 0.9rem; font-weight: 600; color: var(--dark); margin: 0 0 4px; }
            .prefs-empty-hint { font-size: 0.8rem; color: var(--gray-600); margin: 0 0 16px; line-height: 1.5; }

            /* View mode — grid */
            .prefs-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }
            @media (max-width: 480px) {
                .prefs-grid { grid-template-columns: 1fr; }
            }
            .prefs-item {
                padding: 10px 12px;
                background: var(--gray-50, #FAFAFA);
                border-radius: 10px;
                border: 1px solid var(--gray-200, #E8E8E8);
            }
            .prefs-item-full { grid-column: 1 / -1; }
            .prefs-label {
                display: block;
                font-size: 0.7rem;
                font-weight: 600;
                color: var(--gray-400, #9E9E9E);
                text-transform: uppercase;
                letter-spacing: 0.3px;
                margin-bottom: 4px;
            }
            .prefs-value {
                font-size: 0.82rem;
                font-weight: 500;
                color: var(--dark);
                line-height: 1.4;
            }
            .prefs-updated {
                font-size: 0.72rem;
                color: var(--gray-400);
                text-align: right;
                margin-top: 12px;
            }

            /* Botões view mode */
            .prefs-actions { display: flex; gap: 10px; margin-top: 16px; }
            .prefs-btn-edit {
                flex: 1;
                padding: 11px 16px;
                background: ${THEME.orange};
                color: white;
                border: none;
                border-radius: 10px;
                font-family: 'Poppins', sans-serif;
                font-size: 0.85rem;
                font-weight: 600;
                cursor: pointer;
                transition: 0.2s;
            }
            .prefs-btn-edit:hover { background: #D06A1D; }
            .prefs-btn-clear {
                padding: 11px 16px;
                background: none;
                border: 1.5px solid ${THEME.red};
                color: ${THEME.red};
                border-radius: 10px;
                font-family: 'Poppins', sans-serif;
                font-size: 0.85rem;
                font-weight: 600;
                cursor: pointer;
                transition: 0.2s;
            }
            .prefs-btn-clear:hover { background: #FFEBEE; }

            /* Edit mode */
            .pref-field { margin-bottom: 18px; }
            .pref-label {
                display: block;
                font-size: 0.82rem;
                font-weight: 600;
                color: var(--dark, #21272A);
                margin-bottom: 6px;
            }
            .pref-hint {
                font-size: 0.75rem;
                color: var(--gray-400, #9E9E9E);
                margin: -2px 0 8px;
            }
            .pref-input {
                width: 100%;
                padding: 11px 14px;
                border: 1.5px solid var(--gray-200, #E8E8E8);
                border-radius: 10px;
                font-family: 'Montserrat', sans-serif;
                font-size: 0.9rem;
                color: var(--dark);
                outline: none;
                transition: 0.2s;
                box-sizing: border-box;
            }
            .pref-input:focus { border-color: ${THEME.blue}; box-shadow: 0 0 0 3px rgba(0,163,224,0.1); }
            .pref-textarea {
                width: 100%;
                padding: 11px 14px;
                border: 1.5px solid var(--gray-200, #E8E8E8);
                border-radius: 10px;
                font-family: 'Montserrat', sans-serif;
                font-size: 0.9rem;
                color: var(--dark);
                outline: none;
                transition: 0.2s;
                resize: vertical;
                min-height: 70px;
                line-height: 1.5;
                box-sizing: border-box;
            }
            .pref-textarea:focus { border-color: ${THEME.blue}; box-shadow: 0 0 0 3px rgba(0,163,224,0.1); }
            .pref-obs-counter { text-align: right; font-size: 0.72rem; color: var(--gray-400); margin-top: 4px; }

            /* Autocomplete */
            .pref-autocomplete-wrapper { position: relative; }
            .pref-autocomplete-results {
                display: none;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid var(--gray-200);
                border-radius: 10px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.12);
                z-index: 100;
                max-height: 240px;
                overflow-y: auto;
            }
            .pref-ac-item {
                padding: 10px 14px;
                cursor: pointer;
                font-size: 0.82rem;
                transition: 0.15s;
                border-bottom: 1px solid var(--gray-100, #F5F5F5);
            }
            .pref-ac-item:hover { background: var(--gray-100); }
            .pref-ac-item strong { color: ${THEME.orange}; margin-right: 6px; }
            .pref-ac-item small { display: block; color: var(--gray-400); font-size: 0.72rem; margin-top: 2px; }
            .pref-ac-empty { padding: 12px 14px; color: var(--gray-400); font-size: 0.82rem; }

            /* Chips */
            .pref-chips { display: flex; flex-wrap: wrap; gap: 8px; }
            .pref-chip {
                padding: 8px 14px;
                background: var(--gray-100, #F5F5F5);
                border: 1.5px solid var(--gray-200, #E8E8E8);
                border-radius: 20px;
                font-family: 'Montserrat', sans-serif;
                font-size: 0.8rem;
                font-weight: 500;
                color: var(--gray-600, #616161);
                cursor: pointer;
                transition: 0.2s;
            }
            .pref-chip:hover { border-color: var(--gray-300, #D0D0D0); background: var(--gray-200); }
            .pref-chip.active {
                background: rgba(232, 119, 34, 0.12);
                border-color: ${THEME.orange};
                color: ${THEME.orange};
                font-weight: 600;
            }

            /* Conditional */
            .pref-conditional {
                padding: 14px;
                background: var(--gray-50, #FAFAFA);
                border-radius: 10px;
                border: 1px solid var(--gray-200, #E8E8E8);
            }

            /* Number controls */
            .pref-number-grid { display: flex; flex-direction: column; gap: 10px; }
            .pref-number-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 0.85rem;
            }
            .pref-number-ctrl {
                display: flex;
                align-items: center;
                gap: 0;
                border: 1.5px solid var(--gray-200, #E8E8E8);
                border-radius: 10px;
                overflow: hidden;
            }
            .pref-num-btn {
                width: 36px;
                height: 36px;
                background: var(--gray-100, #F5F5F5);
                border: none;
                cursor: pointer;
                font-size: 1.1rem;
                font-weight: 600;
                color: var(--dark);
                transition: 0.15s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .pref-num-btn:hover { background: var(--gray-200); }
            .pref-number-ctrl input {
                width: 40px;
                text-align: center;
                border: none;
                font-family: 'Poppins', sans-serif;
                font-size: 0.9rem;
                font-weight: 600;
                color: var(--dark);
                background: white;
            }

            /* Currency wrapper */
            .pref-currency-wrapper { position: relative; }
            .pref-currency-symbol {
                position: absolute;
                left: 14px;
                top: 50%;
                transform: translateY(-50%);
                font-weight: 600;
                color: var(--gray-600, #616161);
                font-size: 0.9rem;
            }
            .pref-currency-wrapper .pref-input { padding-left: 42px; }

            /* Edit actions */
            .prefs-edit-actions { display: flex; gap: 10px; margin-top: 24px; }
            .prefs-btn-save {
                flex: 1;
                padding: 13px 16px;
                background: ${THEME.orange};
                color: white;
                border: none;
                border-radius: 10px;
                font-family: 'Poppins', sans-serif;
                font-size: 0.9rem;
                font-weight: 600;
                cursor: pointer;
                transition: 0.2s;
            }
            .prefs-btn-save:hover { background: #D06A1D; }
            .prefs-btn-cancel {
                padding: 13px 20px;
                background: var(--gray-100, #F5F5F5);
                border: none;
                border-radius: 10px;
                font-family: 'Montserrat', sans-serif;
                font-size: 0.85rem;
                font-weight: 600;
                color: var(--gray-600, #616161);
                cursor: pointer;
                transition: 0.2s;
            }
            .prefs-btn-cancel:hover { background: var(--gray-200); }
        `;
        document.head.appendChild(style);
    }

    // ================================================================
    // API PÚBLICA
    // ================================================================

    return {
        init,
        loadAndRender,
        renderViewMode,
        enterEditMode,
        salvar,
        cancelar,
        confirmarLimpar
    };

})();

window.MinhaContaPrefs = MinhaContaPrefs;
