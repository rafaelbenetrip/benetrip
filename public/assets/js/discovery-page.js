/**
 * BENETRIP DISCOVERY PAGE v3.1
 *
 * v3.1:
 * - Hidrata a partir de window.__DISCOVERY_INITIAL__ (dados renderizados no
 *   servidor por api/destinos-baratos-page.js), sem fetch inicial
 * - Chips de cidade são <a href="/destinos-baratos/{slug}">, com pushState
 *   ao trocar de cidade automática (URL real + suporte a voltar/avançar)
 *
 * v3.0:
 * - 30 cidades automáticas (snapshot diário do cron)
 * - Qualquer cidade: busca ao vivo via /api/search-destinations
 * - Barra de busca de cidade proeminente no hero
 * - Chips rápidos + dropdown com todas as 30 cidades automáticas
 * - Filtros combináveis (multi-select): estilo + preço + escopo
 * - Busca inteligente de destinos via Groq
 * - Cache local (sessionStorage) para buscas manuais
 */

const DiscoveryPage = {
    // ============================================================
    // ESTADO
    // ============================================================
    state: {
        origemAtual: 'GRU',
        origemNome: 'São Paulo',
        origemManual: false,       // true = busca ao vivo, false = snapshot
        destinos: [],
        destinosFiltrados: [],
        dataSnapshot: null,
        insight: null,        // frase da Tripinha pré-gerada no cron (snapshot)
        tripinhaPick: null,   // escolha da Tripinha { nome, motivo } (snapshot)
        carregando: false,
        buscandoIA: false,

        filtros: {
            estilos: [],
            precoMax: null,
            escopo: null,
        },

        buscaQuery: '',
        buscaResultado: null,
        ordenacao: 'preco',
    },

    // Lista de cidades automáticas (carregada do JSON)
    cidadesAutomaticas: [],

    // ============================================================
    // INICIALIZAÇÃO
    // ============================================================
    async init() {
        console.log('🔍 Discovery Page v3.1');
        await this.carregarCidadesAutomaticas();
        this.bindEvents();

        const inicial = window.__DISCOVERY_INITIAL__;
        if (inicial && Array.isArray(inicial.destinos)) {
            this.hidratar(inicial);
        } else {
            this.carregarDestinos(this.state.origemAtual);
        }

        window.addEventListener('popstate', () => this.carregarDestinosFromPath(location.pathname));
    },

    // Preenche o estado com os dados já renderizados no servidor (SSR),
    // evitando um fetch redundante em /api/discovery no primeiro carregamento.
    hidratar(inicial) {
        this.state.origemAtual = inicial.origemAtual;
        this.state.origemNome = inicial.origemNome;
        this.state.origemManual = !!inicial.origemManual;
        this.state.destinos = inicial.destinos || [];
        this.state.dataSnapshot = inicial.dataSnapshot || null;
        this.state.insight = inicial.insight || null;
        this.state.tripinhaPick = inicial.tripinhaPick || null;
        this.state.destinosFiltrados = [...this.state.destinos];
        this.resetarFiltros();

        if (this.state.destinos.length > 0) {
            this.renderizar();
        } else {
            this.mostrarVazio(`Ainda não temos destinos para ${this.state.origemNome}. Tente outra cidade de origem.`);
        }
    },

    // Deriva a origem a partir do path (usado no botão voltar/avançar do navegador)
    carregarDestinosFromPath(pathname) {
        const match = pathname.match(/^\/destinos-baratos\/?([a-z0-9-]+)?\/?$/);
        if (!match) return;
        const slug = match[1] || null;

        if (!slug) {
            const saoPaulo = this.cidadesAutomaticas.find(c => c.codigo === 'GRU');
            this.selecionarCidade('GRU', saoPaulo?.nome || 'São Paulo', false, { pushState: false });
            return;
        }

        const cidade = this.cidadesAutomaticas.find(c => (c.slug || this.slugify(c.nome)) === slug);
        if (cidade) this.selecionarCidade(cidade.codigo, cidade.nome, false, { pushState: false });
    },

    slugify(nome) {
        return String(nome || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-+|-+$)/g, '');
    },

    async carregarCidadesAutomaticas() {
        const inicial = window.__DISCOVERY_INITIAL__;
        if (inicial && Array.isArray(inicial.cidadesAutomaticas) && inicial.cidadesAutomaticas.length > 0) {
            this.cidadesAutomaticas = inicial.cidadesAutomaticas.map(c => ({ ...c, slug: c.slug || this.slugify(c.nome) }));
            return;
        }

        try {
            const response = await fetch('/assets/data/brazilian-airports.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            this.cidadesAutomaticas = (data.cidades || []).map(c => ({ ...c, slug: c.slug || this.slugify(c.nome) }));
        } catch (err) {
            console.warn('Erro ao carregar cidades:', err);
            // Fallback: extrair dos chips do HTML
            this.cidadesAutomaticas = [];
            document.querySelectorAll('.origin-chip[data-origin]').forEach(chip => {
                if (chip.id === 'origin-more-btn') return;
                this.cidadesAutomaticas.push({
                    codigo: chip.dataset.origin,
                    nome: chip.dataset.name,
                    estado: '',
                    regiao: '',
                    slug: this.slugify(chip.dataset.name),
                });
            });
        }
    },

    // ============================================================
    // BIND DE EVENTOS
    // ============================================================
    bindEvents() {
        // === BUSCA DE CIDADE (hero) ===
        const cityInput = document.getElementById('city-search-input');
        const cityClear = document.getElementById('city-search-clear');
        const suggestions = document.getElementById('city-suggestions');

        if (cityInput) {
            cityInput.addEventListener('input', () => {
                const val = cityInput.value.trim();
                if (cityClear) cityClear.style.display = val ? 'flex' : 'none';
                if (val.length >= 2) {
                    this.mostrarSugestoesCidade(val);
                } else if (suggestions) {
                    suggestions.style.display = 'none';
                }
            });

            cityInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = cityInput.value.trim();
                    if (val.length >= 2) this.selecionarCidadeDigitada(val);
                }
            });

            // Fechar sugestões ao clicar fora
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.hero-city-search') && suggestions) {
                    suggestions.style.display = 'none';
                }
            });
        }

        if (cityClear) {
            cityClear.addEventListener('click', () => {
                if (cityInput) cityInput.value = '';
                cityClear.style.display = 'none';
                if (suggestions) suggestions.style.display = 'none';
            });
        }

        if (suggestions) {
            suggestions.addEventListener('click', (e) => {
                const item = e.target.closest('.city-suggestion-item');
                if (!item) return;
                const code = item.dataset.code;
                const name = item.dataset.name;
                const isAuto = item.dataset.auto === 'true';
                if (cityInput) cityInput.value = '';
                if (cityClear) cityClear.style.display = 'none';
                suggestions.style.display = 'none';
                this.selecionarCidade(code, name, !isAuto);
            });
        }

        // === CHIPS DE ORIGEM (rápidos) ===
        document.getElementById('origin-chips')?.addEventListener('click', (e) => {
            const chip = e.target.closest('.origin-chip');
            if (!chip) return;

            if (chip.id === 'origin-more-btn') {
                e.preventDefault();
                this.mostrarTodasCidadesDropdown();
                return;
            }

            const origin = chip.dataset.origin;
            const name = chip.dataset.name;
            if (!origin) return;

            // Chips agora são <a href="/destinos-baratos/{slug}">: intercepta pra
            // trocar via AJAX (como antes), mas com URL real via pushState.
            e.preventDefault();
            this.selecionarCidade(origin, name, false);
        });

        // === FILTROS ===
        document.getElementById('filter-chips')?.addEventListener('click', (e) => {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;
            this.toggleFiltro(chip.dataset.filter, chip.dataset.tipo, chip);
        });

        // === BUSCA INTELIGENTE ===
        const searchInput = document.getElementById('smart-search-input');
        const searchBtn = document.getElementById('smart-search-btn');
        const searchClear = document.getElementById('smart-search-clear');

        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.executarBuscaInteligente(searchInput.value.trim());
                }
            });
            searchInput.addEventListener('input', () => {
                const val = searchInput.value.trim();
                if (searchClear) searchClear.style.display = val ? 'flex' : 'none';
                if (!val && this.state.buscaResultado) this.limparBusca();
            });
        }
        searchBtn?.addEventListener('click', () => {
            const val = searchInput?.value.trim();
            if (val) this.executarBuscaInteligente(val);
        });
        searchClear?.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            searchClear.style.display = 'none';
            this.limparBusca();
        });

        // === ORDENAÇÃO ===
        document.getElementById('sort-select')?.addEventListener('change', (e) => {
            this.state.ordenacao = e.target.value;
            this.aplicarFiltros();
        });

        // === SHARE ===
        document.getElementById('share-fab')?.addEventListener('click', () => {
            this.abrirShareModal();
        });
    },

    // ============================================================
    // BUSCA DE CIDADE (sugestões)
    // ============================================================
    mostrarSugestoesCidade(query) {
        const container = document.getElementById('city-suggestions');
        if (!container) return;

        const normalizado = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const isIATA = /^[A-Z]{3}$/i.test(query.trim());

        // Buscar nas automáticas
        const matches = this.cidadesAutomaticas.filter(c => {
            const nome = c.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const codigo = c.codigo.toLowerCase();
            return nome.includes(normalizado) || codigo.includes(normalizado);
        }).slice(0, 6);

        let html = '';

        if (matches.length > 0) {
            html += '<div class="suggestions-group-label">Cidades com dados diários</div>';
            matches.forEach(c => {
                html += `<button class="city-suggestion-item" data-code="${c.codigo}" data-name="${c.nome}" data-auto="true">
                    <span class="suggestion-name">${c.nome}</span>
                    <span class="suggestion-meta">${c.codigo} · ${c.estado} · <span class="suggestion-badge-auto">Atualizado diariamente</span></span>
                </button>`;
            });
        }

        // Sempre mostrar opção de busca manual
        const nomeExibicao = isIATA ? query.toUpperCase() : query;
        html += `<div class="suggestions-group-label">Buscar ao vivo</div>`;
        html += `<button class="city-suggestion-item suggestion-manual" data-code="${isIATA ? query.toUpperCase() : query}" data-name="${nomeExibicao}" data-auto="false">
            <span class="suggestion-name">Buscar "${nomeExibicao}" ao vivo</span>
            <span class="suggestion-meta">Pesquisa em tempo real · pode demorar alguns segundos</span>
        </button>`;

        container.innerHTML = html;
        container.style.display = 'block';
    },

    selecionarCidadeDigitada(val) {
        const isIATA = /^[A-Z]{3}$/i.test(val.trim());
        const normalizado = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Checar se é uma cidade automática
        const autoMatch = this.cidadesAutomaticas.find(c => {
            const nome = c.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return c.codigo.toLowerCase() === normalizado || nome === normalizado;
        });

        if (autoMatch) {
            this.selecionarCidade(autoMatch.codigo, autoMatch.nome, false);
        } else {
            // Busca manual
            const code = isIATA ? val.toUpperCase() : val;
            this.selecionarCidade(code, val, true);
        }

        const suggestions = document.getElementById('city-suggestions');
        if (suggestions) suggestions.style.display = 'none';
        const cityInput = document.getElementById('city-search-input');
        if (cityInput) cityInput.value = '';
        const cityClear = document.getElementById('city-search-clear');
        if (cityClear) cityClear.style.display = 'none';
    },

    // ============================================================
    // DROPDOWN "MAIS CIDADES"
    // ============================================================
    mostrarTodasCidadesDropdown() {
        const container = document.getElementById('city-suggestions');
        if (!container) return;

        // Agrupar por região
        const regioes = {};
        const nomeRegiao = {
            'sudeste': 'Sudeste', 'sul': 'Sul', 'nordeste': 'Nordeste',
            'centro-oeste': 'Centro-Oeste', 'norte': 'Norte',
        };

        this.cidadesAutomaticas.forEach(c => {
            const r = c.regiao || 'outro';
            if (!regioes[r]) regioes[r] = [];
            regioes[r].push(c);
        });

        let html = '';
        for (const [regiao, cidades] of Object.entries(regioes)) {
            html += `<div class="suggestions-group-label">${nomeRegiao[regiao] || regiao}</div>`;
            cidades.forEach(c => {
                const ativa = c.codigo === this.state.origemAtual ? ' active' : '';
                html += `<button class="city-suggestion-item${ativa}" data-code="${c.codigo}" data-name="${c.nome}" data-auto="true">
                    <span class="suggestion-name">${c.nome}</span>
                    <span class="suggestion-meta">${c.codigo} · ${c.estado}</span>
                </button>`;
            });
        }

        container.innerHTML = html;
        container.style.display = 'block';

        // Scroll até o container e focus no input
        const cityInput = document.getElementById('city-search-input');
        if (cityInput) {
            cityInput.focus();
            cityInput.placeholder = 'Filtrar cidades...';
        }
    },

    // ============================================================
    // SELECIONAR CIDADE (automática ou manual)
    // ============================================================
    selecionarCidade(code, name, isManual, opts = {}) {
        const { pushState = true } = opts;

        // Atualizar chips
        document.querySelectorAll('.origin-chip').forEach(c => c.classList.remove('active'));
        const chipExistente = document.querySelector(`.origin-chip[data-origin="${code}"]`);
        if (chipExistente) chipExistente.classList.add('active');

        this.state.origemAtual = code;
        this.state.origemNome = name;
        this.state.origemManual = isManual;

        if (pushState && !isManual) {
            const cidade = this.cidadesAutomaticas.find(c => c.codigo === code);
            const slug = cidade?.slug || this.slugify(name);
            const path = slug === 'sao-paulo' ? '/destinos-baratos' : `/destinos-baratos/${slug}`;
            if (location.pathname !== path) {
                history.pushState({ origem: code }, '', path);
            }
        }

        if (isManual) {
            this.carregarDestinosAoVivo(code);
        } else {
            this.carregarDestinos(code);
        }
    },

    // ============================================================
    // CARREGAR DESTINOS (snapshot automático)
    // ============================================================
    async carregarDestinos(origem) {
        if (this.state.carregando) return;
        this.state.carregando = true;
        this.resetarFiltros();
        this.mostrarLoading('A Tripinha está buscando os destinos mais baratos...');

        try {
            const response = await fetch(`/api/discovery?origem=${origem}`);

            if (!response.ok) {
                if (response.status === 404) {
                    console.log('Snapshot não encontrado, tentando ao vivo...');
                    this.state.carregando = false;
                    await this.carregarDestinosAoVivo(origem);
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.destinos && data.destinos.length > 0) {
                this.state.destinos = data.destinos;
                this.state.dataSnapshot = data.data;
                this.state.insight = data.insight || null;
                this.state.tripinhaPick = data.tripinha_pick || null;
                this.state.origemManual = false;
                this.state.destinosFiltrados = [...this.state.destinos];
                this.renderizar();
            } else {
                this.state.carregando = false;
                await this.carregarDestinosAoVivo(origem);
            }
        } catch (error) {
            console.error('Erro ao carregar snapshot:', error);
            this.state.carregando = false;
            await this.carregarDestinosAoVivo(origem);
        } finally {
            this.state.carregando = false;
        }
    },

    // ============================================================
    // BUSCA AO VIVO (qualquer cidade)
    // ============================================================
    async carregarDestinosAoVivo(origem) {
        if (this.state.carregando) return;
        this.state.carregando = true;
        this.state.origemManual = true;
        this.state.insight = null;      // busca ao vivo não tem insight pré-gerado
        this.state.tripinhaPick = null;
        this.resetarFiltros();
        this.mostrarLoading(`Buscando voos saindo de ${this.state.origemNome} em tempo real...`);

        // Checar cache
        const cacheKey = `discovery_live_${origem}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp < 10 * 60 * 1000) { // 10 min cache
                    this.state.destinos = data.destinos;
                    this.state.dataSnapshot = new Date().toISOString().split('T')[0];
                    this.state.destinosFiltrados = [...this.state.destinos];
                    this.renderizar();
                    this.state.carregando = false;
                    return;
                }
            } catch (e) { /* cache inválido */ }
        }

        try {
            const response = await fetch('/api/search-destinations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origem: origem,
                    moeda: 'BRL',
                    escopoDestino: 'todos',
                }),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (data.success && data.destinations && data.destinations.length > 0) {
                const destinos = data.destinations
                    .filter(d => d.flight?.price > 0)
                    .sort((a, b) => (a.flight?.price || 0) - (b.flight?.price || 0))
                    .slice(0, 50)
                    .map((d, i) => this.converterDestinoLive(d, i + 1));

                // Salvar no cache
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    destinos,
                    timestamp: Date.now(),
                }));

                this.state.destinos = destinos;
                this.state.dataSnapshot = new Date().toISOString().split('T')[0];
                this.state.destinosFiltrados = [...this.state.destinos];
                this.renderizar();
            } else {
                this.mostrarVazio(`Nenhum destino encontrado saindo de ${this.state.origemNome}. Tente outra cidade.`);
            }
        } catch (error) {
            console.error('Erro na busca ao vivo:', error);
            this.mostrarVazio(`Erro ao buscar destinos de ${this.state.origemNome}. Tente novamente.`);
        } finally {
            this.state.carregando = false;
        }
    },

    converterDestinoLive(dest, posicao) {
        const nome = (dest.name || '').toLowerCase();
        const estilos = [];
        const praiaKw = ['beach', 'praia', 'litoral', 'natal', 'maceió', 'florianópolis', 'cancún', 'punta cana', 'búzios', 'ilha', 'island', 'arraial', 'porto seguro', 'jericoacoara'];
        const natKw = ['serra', 'chapada', 'bonito', 'foz', 'monte verde', 'brotas', 'jalapão'];
        const romKw = ['gramado', 'campos do jordão', 'paris', 'veneza', 'santorini'];
        if (praiaKw.some(k => nome.includes(k))) estilos.push('praia');
        if (natKw.some(k => nome.includes(k))) estilos.push('natureza');
        if (romKw.some(k => nome.includes(k))) estilos.push('romantico');
        if (estilos.length === 0) estilos.push('cidade');

        const isIntl = (dest.country || '').toLowerCase() !== 'brazil' && (dest.country || '').toLowerCase() !== 'brasil';

        return {
            posicao,
            nome: dest.name || '',
            pais: dest.country || '',
            aeroporto: dest.flight?.airport_code || dest.primary_airport || '',
            preco: dest.flight?.price || 0,
            moeda: 'BRL',
            paradas: dest.flight?.stops || 0,
            duracao_voo_min: dest.flight?.flight_duration_minutes || 0,
            cia_aerea: dest.flight?.airline_name || '',
            custo_noite: dest.avg_cost_per_night || 0,
            imagem: dest.image || '',
            estilos,
            duracao_ideal: isIntl ? { min: 7, max: 14, ideal: 10 } : { min: 3, max: 7, ideal: 5 },
            internacional: isIntl,
            data_ida: dest.outbound_date || null,
            data_volta: dest.return_date || null,
            variacao: null,
        };
    },

    // ============================================================
    // FILTROS COMBINÁVEIS
    // ============================================================
    toggleFiltro(filter, tipo, chipEl) {
        if (this.state.buscaResultado) this.limparBusca(false);

        if (filter === 'todos') {
            this.state.filtros = { estilos: [], precoMax: null, escopo: null };
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chipEl.classList.add('active');
        } else if (tipo === 'estilo') {
            const idx = this.state.filtros.estilos.indexOf(filter);
            if (idx >= 0) {
                this.state.filtros.estilos.splice(idx, 1);
                chipEl.classList.remove('active');
            } else {
                this.state.filtros.estilos.push(filter);
                chipEl.classList.add('active');
            }
            document.querySelector('.filter-chip[data-filter="todos"]')?.classList.remove('active');
        } else if (tipo === 'preco') {
            const valor = parseInt(filter);
            if (this.state.filtros.precoMax === valor) {
                this.state.filtros.precoMax = null;
                chipEl.classList.remove('active');
            } else {
                this.state.filtros.precoMax = valor;
                document.querySelectorAll('.filter-chip[data-tipo="preco"]').forEach(c => c.classList.remove('active'));
                chipEl.classList.add('active');
            }
            document.querySelector('.filter-chip[data-filter="todos"]')?.classList.remove('active');
        } else if (tipo === 'escopo') {
            if (this.state.filtros.escopo === filter) {
                this.state.filtros.escopo = null;
                chipEl.classList.remove('active');
            } else {
                this.state.filtros.escopo = filter;
                document.querySelectorAll('.filter-chip[data-tipo="escopo"]').forEach(c => c.classList.remove('active'));
                chipEl.classList.add('active');
            }
            document.querySelector('.filter-chip[data-filter="todos"]')?.classList.remove('active');
        }

        const { estilos, precoMax, escopo } = this.state.filtros;
        if (estilos.length === 0 && !precoMax && !escopo) {
            document.querySelector('.filter-chip[data-filter="todos"]')?.classList.add('active');
        }

        this.aplicarFiltros();
    },

    aplicarFiltros() {
        const { estilos, precoMax, escopo } = this.state.filtros;
        let resultado = [...this.state.destinos];

        if (estilos.length > 0) {
            resultado = resultado.filter(d => (d.estilos || []).some(e => estilos.includes(e)));
        }
        if (precoMax) {
            resultado = resultado.filter(d => d.preco <= precoMax);
        }
        if (escopo === 'nacional') {
            resultado = resultado.filter(d => !d.internacional);
        } else if (escopo === 'internacional') {
            resultado = resultado.filter(d => d.internacional);
        }

        resultado = this.ordenar(resultado);
        this.state.destinosFiltrados = resultado;
        this.renderizarCards();
        this.atualizarContagem();
    },

    ordenar(destinos) {
        const copia = [...destinos];
        switch (this.state.ordenacao) {
            case 'preco': return copia.sort((a, b) => a.preco - b.preco);
            // Maior queda primeiro (percentual mais negativo); sem variação vai pro fim
            case 'queda': return copia.sort((a, b) => (a.variacao?.percentual ?? Infinity) - (b.variacao?.percentual ?? Infinity));
            case 'nome': return copia.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            default: return copia;
        }
    },

    resetarFiltros() {
        this.state.buscaQuery = '';
        this.state.buscaResultado = null;
        this.state.filtros = { estilos: [], precoMax: null, escopo: null };
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        document.querySelector('.filter-chip[data-filter="todos"]')?.classList.add('active');
        const searchInput = document.getElementById('smart-search-input');
        if (searchInput) searchInput.value = '';
        const feedback = document.getElementById('search-feedback');
        if (feedback) feedback.style.display = 'none';
        const clearBtn = document.getElementById('smart-search-clear');
        if (clearBtn) clearBtn.style.display = 'none';
    },

    // ============================================================
    // BUSCA INTELIGENTE (Groq via API)
    // ============================================================
    async executarBuscaInteligente(query) {
        if (!query || this.state.buscandoIA) return;

        this.state.buscandoIA = true;
        this.state.buscaQuery = query;
        this.mostrarBuscaLoading(true);

        try {
            const response = await fetch('/api/discovery-smart-filter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, destinos: this.state.destinos }),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (data.success && data.indices) {
                this.state.buscaResultado = data;
                const resultado = data.indices
                    .filter(i => i >= 0 && i < this.state.destinos.length)
                    .map(i => this.state.destinos[i]);

                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                this.state.filtros = { estilos: [], precoMax: null, escopo: null };

                this.state.destinosFiltrados = resultado;
                this.renderizarCards();
                this.atualizarContagem(data.titulo || `Resultados: "${query}"`);
                this.mostrarBuscaFeedback(data.explicacao, resultado.length);
            }
        } catch (error) {
            console.error('Busca inteligente falhou:', error);
            this.mostrarToast('Erro na busca. Tente novamente.');
        } finally {
            this.state.buscandoIA = false;
            this.mostrarBuscaLoading(false);
        }
    },

    limparBusca(reRender = true) {
        this.state.buscaQuery = '';
        this.state.buscaResultado = null;
        const feedback = document.getElementById('search-feedback');
        if (feedback) feedback.style.display = 'none';

        if (reRender) {
            this.resetarFiltros();
            this.state.destinosFiltrados = [...this.state.destinos];
            this.renderizarCards();
            this.atualizarContagem();
        }
    },

    mostrarBuscaLoading(ativo) {
        const btn = document.getElementById('smart-search-btn');
        const input = document.getElementById('smart-search-input');
        if (btn) {
            btn.disabled = ativo;
            btn.innerHTML = ativo
                ? '<div class="search-spinner"></div>'
                : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
        }
        if (input) input.disabled = ativo;
    },

    mostrarBuscaFeedback(explicacao, count) {
        const feedback = document.getElementById('search-feedback');
        if (!feedback) return;
        feedback.style.display = 'flex';
        feedback.innerHTML = `
            <span class="feedback-icon">&#129302;</span>
            <span class="feedback-text">${explicacao} &middot; ${count} destino${count !== 1 ? 's' : ''}</span>
            <button class="feedback-clear" id="feedback-clear-btn">Limpar</button>
        `;
        document.getElementById('feedback-clear-btn')?.addEventListener('click', () => {
            const input = document.getElementById('smart-search-input');
            if (input) input.value = '';
            const clearBtn = document.getElementById('smart-search-clear');
            if (clearBtn) clearBtn.style.display = 'none';
            this.limparBusca();
        });
    },

    // ============================================================
    // RENDERIZAÇÃO
    // ============================================================
    renderizar() {
        this.atualizarCityBar();
        this.renderizarStats();
        this.renderizarQuedas();
        this.renderizarTripinhaPick();
        this.renderizarCards();
        this.atualizarContagem();
        this.mostrarInsight();

        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('destinations-section').style.display = 'block';
        document.getElementById('filters-section').style.display = 'block';
        document.getElementById('cta-section').style.display = 'block';
        document.getElementById('share-fab').style.display = 'flex';
        document.getElementById('active-city-bar').style.display = 'flex';
    },

    atualizarCityBar() {
        const nameEl = document.getElementById('active-city-name');
        const badgeEl = document.getElementById('active-city-badge');
        const sourceEl = document.getElementById('active-city-source');

        if (nameEl) nameEl.textContent = `${this.state.origemNome} (${this.state.origemAtual})`;

        document.title = `Destinos Baratos Saindo de ${this.state.origemNome} | Benetrip`;

        // Hero é renderizado no servidor com a cidade inicial: precisa
        // acompanhar a troca de cidade feita via JS (pushState)
        const heroTitle = document.getElementById('hero-title');
        if (heroTitle) heroTitle.textContent = `Destinos Baratos Saindo de ${this.state.origemNome}`;
        const heroSubtitle = document.getElementById('hero-subtitle');
        if (heroSubtitle) {
            heroSubtitle.textContent = this.state.origemManual
                ? `A Tripinha está farejando os voos mais baratos partindo de ${this.state.origemNome} (${this.state.origemAtual}) em tempo real.`
                : `A Tripinha farejou os voos mais baratos partindo de ${this.state.origemNome} (${this.state.origemAtual}). Preços reais, atualizados todos os dias.`;
        }

        if (!this.state.origemManual) {
            const cidade = this.cidadesAutomaticas.find(c => c.codigo === this.state.origemAtual);
            const slug = cidade?.slug || this.slugify(this.state.origemNome);
            const path = slug === 'sao-paulo' ? '/destinos-baratos' : `/destinos-baratos/${slug}`;
            const canonical = document.querySelector('link[rel="canonical"]');
            if (canonical) canonical.setAttribute('href', `https://benetrip.com.br${path}`);
        }

        if (this.state.origemManual) {
            if (badgeEl) {
                badgeEl.textContent = 'Busca ao vivo';
                badgeEl.className = 'active-city-badge badge-live';
            }
            if (sourceEl) sourceEl.textContent = 'Dados em tempo real';
        } else {
            if (this.state.dataSnapshot) {
                const dataObj = new Date(this.state.dataSnapshot + 'T12:00:00');
                const hoje = new Date();
                hoje.setHours(12, 0, 0, 0);
                const diffDias = Math.round((hoje - dataObj) / (1000 * 60 * 60 * 24));

                if (badgeEl) {
                    badgeEl.textContent = diffDias === 0 ? 'Atualizado hoje' : diffDias === 1 ? 'Atualizado ontem' : `Há ${diffDias} dias`;
                    badgeEl.className = 'active-city-badge badge-auto';
                }
            }
            if (sourceEl) sourceEl.textContent = 'Dados automáticos';
        }
    },

    renderizarStats() {
        const destinos = this.state.destinos;
        if (destinos.length === 0) return;

        const maisBarato = destinos[0];
        const precos = destinos.filter(d => d.preco > 0).map(d => d.preco);
        const media = precos.length > 0 ? Math.round(precos.reduce((a, b) => a + b, 0) / precos.length) : 0;
        const nacionais = destinos.filter(d => !d.internacional).length;
        const internacionais = destinos.filter(d => d.internacional).length;

        const maiorQueda = this.maioresQuedas(destinos, 1)[0];
        const maiorQuedaHtml = maiorQueda ? `
            <div class="stat-card stat-card-drop">
                <div class="stat-label">Maior queda</div>
                <div class="stat-value stat-value-drop">↓ ${Math.abs(maiorQueda.variacao.percentual)}%</div>
                <div class="stat-detail">${maiorQueda.nome} · agora R$ ${this.fmt(maiorQueda.preco)}</div>
            </div>` : '';

        document.getElementById('stats-bar').innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Mais barato</div>
                <div class="stat-value">R$ ${this.fmt(maisBarato.preco)}</div>
                <div class="stat-detail">${maisBarato.nome}</div>
                ${this.renderVariacao(maisBarato.variacao)}
            </div>${maiorQuedaHtml}
            <div class="stat-card">
                <div class="stat-label">Preço médio</div>
                <div class="stat-value">R$ ${this.fmt(media)}</div>
                <div class="stat-detail">${destinos.length} destinos</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Nacionais</div>
                <div class="stat-value">${nacionais}</div>
                <div class="stat-detail">destinos</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Internacionais</div>
                <div class="stat-value">${internacionais}</div>
                <div class="stat-detail">destinos</div>
            </div>
        `;
    },

    // ============================================================
    // SEÇÃO "MAIORES QUEDAS" + "ESCOLHA DA TRIPINHA"
    // ============================================================
    maioresQuedas(destinos, limite) {
        return (destinos || [])
            .filter(d => d.variacao?.direcao === 'desceu' && Math.abs(d.variacao.percentual) >= 3)
            .sort((a, b) => a.variacao.percentual - b.variacao.percentual)
            .slice(0, limite || 5);
    },

    renderizarQuedas() {
        const section = document.getElementById('quedas-section');
        if (!section) return;

        const quedas = this.maioresQuedas(this.state.destinos, 5);
        if (quedas.length === 0) {
            section.innerHTML = '';
            section.style.display = 'none';
            return;
        }

        const cards = quedas.map(d => {
            const periodo = this.fmtPeriodo(d.data_ida, d.data_volta);
            return `
            <button class="queda-card" data-aeroporto="${d.aeroporto}" data-nome="${d.nome}" data-duracao="${d.duracao_ideal?.ideal ?? ''}" data-ida="${d.data_ida || ''}" data-volta="${d.data_volta || ''}">
                <span class="queda-badge">↓ ${Math.abs(d.variacao.percentual)}%</span>
                <span class="queda-nome">${d.nome}</span>
                <span class="queda-precos"><s>R$ ${this.fmt(d.variacao.preco_anterior)}</s> <strong>R$ ${this.fmt(d.preco)}</strong></span>
                ${periodo ? `<span class="queda-datas">${periodo}</span>` : ''}
            </button>`;
        }).join('');

        section.innerHTML = `
            <div class="quedas-header">
                <h2 class="quedas-title">🔥 Maiores quedas de preço</h2>
                <span class="quedas-sub">comparado à média dos últimos dias</span>
            </div>
            <div class="quedas-row">${cards}</div>`;
        section.style.display = 'block';

        section.querySelectorAll('.queda-card').forEach(card => {
            card.addEventListener('click', () => this.navegarParaVoos(card.dataset));
        });
    },

    renderizarTripinhaPick() {
        const section = document.getElementById('tripinha-pick-section');
        if (!section) return;

        const pick = this.state.tripinhaPick;
        const dest = pick?.nome
            ? this.state.destinos.find(d => (d.nome || '').toLowerCase() === pick.nome.toLowerCase())
            : null;

        if (!dest) {
            section.innerHTML = '';
            section.style.display = 'none';
            return;
        }

        const periodo = this.fmtPeriodo(dest.data_ida, dest.data_volta);
        section.innerHTML = `
            <div class="tripinha-pick-card" data-aeroporto="${dest.aeroporto}" data-nome="${dest.nome}" data-duracao="${dest.duracao_ideal?.ideal ?? ''}" data-ida="${dest.data_ida || ''}" data-volta="${dest.data_volta || ''}">
                <img src="/assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="pick-avatar" onerror="this.style.display='none'">
                <div class="pick-content">
                    <span class="pick-label">🐾 Escolha da Tripinha</span>
                    <span class="pick-destino">${dest.nome} · <strong>R$ ${this.fmt(dest.preco)}</strong>${periodo ? ` <span class="pick-datas">(${periodo})</span>` : ''}</span>
                    ${pick.motivo ? `<span class="pick-motivo">${pick.motivo}</span>` : ''}
                </div>
                <span class="pick-arrow">→</span>
            </div>`;
        section.style.display = 'block';

        section.querySelector('.tripinha-pick-card')?.addEventListener('click', (e) => {
            this.navegarParaVoos(e.currentTarget.dataset);
        });
    },

    // Navega para o calendário de preços já com destino, duração e as datas
    // do preço mostrado (continuidade da oferta que convenceu o clique)
    navegarParaVoos(dataset) {
        const dest = dataset.aeroporto || dataset.nome;
        if (!dest) return;
        const params = new URLSearchParams({
            origem: this.state.origemAtual,
            destino: dest,
            nome: dataset.nome,
        });
        if (dataset.duracao) params.set('duracao', dataset.duracao);
        if (dataset.ida) params.set('data_ida', dataset.ida);
        if (dataset.volta) params.set('data_volta', dataset.volta);
        window.location.href = `/voos-baratos?${params.toString()}`;
    },

    renderizarCards() {
        const grid = document.getElementById('destinations-grid');
        const destinos = this.state.destinosFiltrados;

        if (destinos.length === 0) {
            grid.innerHTML = '';
            document.getElementById('empty-state').style.display = 'block';
            document.getElementById('destinations-section').style.display = 'none';
            return;
        }

        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('destinations-section').style.display = 'block';
        grid.innerHTML = destinos.map(d => this.renderCard(d)).join('');

        grid.querySelectorAll('.dest-card').forEach(card => {
            card.addEventListener('click', () => this.navegarParaVoos(card.dataset));
        });
    },

    renderCard(d) {
        const imgSrc = d.imagem || 'assets/images/tripinha/avatar-pensando.png';
        const estilosTags = (d.estilos || []).map(e =>
            `<span class="dest-tag">${this.capitalize(e)}</span>`
        ).join('');
        const variacaoHtml = d.variacao ? this.renderVariacaoInline(d.variacao) : '';
        const duracaoTexto = d.duracao_ideal ? `<strong>${d.duracao_ideal.min}-${d.duracao_ideal.max}</strong> dias` : '';
        const periodo = this.fmtPeriodo(d.data_ida, d.data_volta);
        const datasHtml = periodo
            ? `<div class="dest-dates" title="Preço encontrado para essas datas — outras datas podem variar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>${periodo}</span>
                </div>`
            : '';
        const quedaDestaque = d.variacao?.direcao === 'desceu' && Math.abs(d.variacao.percentual) >= 5
            ? `<span class="dest-badge-drop">↓ ${Math.abs(d.variacao.percentual)}%</span>`
            : '';

        return `
            <article class="dest-card" data-aeroporto="${d.aeroporto}" data-nome="${d.nome}" data-duracao="${d.duracao_ideal?.ideal || ''}" data-ida="${d.data_ida || ''}" data-volta="${d.data_volta || ''}">
                <div class="dest-card-inner">
                    <div class="dest-image-wrapper">
                        <img class="dest-image" src="${imgSrc}" alt="${d.nome}" loading="lazy"
                             onerror="this.src='assets/images/tripinha/avatar-pensando.png'">
                        <span class="dest-rank">${d.posicao}</span>
                        ${quedaDestaque}
                        ${d.internacional ? '<span class="dest-badge-international">Internacional</span>' : ''}
                    </div>
                    <div class="dest-info">
                        <div class="dest-header">
                            <h3 class="dest-name">${d.nome}</h3>
                            <p class="dest-country">${d.pais}${d.paradas > 0 ? ` · ${d.paradas} parada${d.paradas > 1 ? 's' : ''}` : ' · Direto'}</p>
                        </div>
                        <div class="dest-tags">${estilosTags}</div>
                        ${datasHtml}
                        <div class="dest-footer">
                            <div class="dest-price-block">
                                <span class="dest-price-label">A partir de</span>
                                <span class="dest-price">R$ ${this.fmt(d.preco)}</span>
                                ${variacaoHtml}
                            </div>
                            <div class="dest-duration">${duracaoTexto}</div>
                        </div>
                    </div>
                </div>
            </article>`;
    },

    labelVariacao(v) {
        return v?.referencia === 'ontem' ? 'vs ontem' : 'vs média da semana';
    },

    renderVariacao(v) {
        if (!v) return '';
        if (v.direcao === 'desceu') return `<div class="stat-variation down">↓ ${Math.abs(v.percentual)}% ${this.labelVariacao(v)}</div>`;
        if (v.direcao === 'subiu') return `<div class="stat-variation up">↑ ${Math.abs(v.percentual)}% ${this.labelVariacao(v)}</div>`;
        return `<div class="stat-variation stable">→ Estável</div>`;
    },

    renderVariacaoInline(v) {
        if (!v) return '';
        if (v.direcao === 'desceu') return `<span class="dest-price-variation down">↓ R$ ${this.fmt(Math.abs(v.diferenca))} ${this.labelVariacao(v)}</span>`;
        if (v.direcao === 'subiu') return `<span class="dest-price-variation up">↑ R$ ${this.fmt(Math.abs(v.diferenca))} ${this.labelVariacao(v)}</span>`;
        return '';
    },

    atualizarContagem(tituloOverride) {
        const count = this.state.destinosFiltrados.length;
        document.getElementById('section-count').textContent = `${count} destino${count !== 1 ? 's' : ''}`;

        if (tituloOverride) {
            document.getElementById('section-title').textContent = tituloOverride;
            return;
        }

        const { estilos, precoMax, escopo } = this.state.filtros;
        const temFiltro = estilos.length > 0 || precoMax || escopo;

        if (!temFiltro) {
            document.getElementById('section-title').textContent = `Top Destinos de ${this.state.origemNome}`;
        } else {
            const partes = [];
            if (estilos.length > 0) partes.push(estilos.map(e => this.capitalize(e)).join(' + '));
            if (escopo) partes.push(this.capitalize(escopo));
            if (precoMax) partes.push(`Até R$ ${this.fmt(precoMax)}`);
            document.getElementById('section-title').textContent = partes.join(' · ');
        }
    },

    // ============================================================
    // TRIPINHA INSIGHT (frase sobre os destinos)
    // Caminho principal: insight pré-gerado no cron, já embutido no snapshot
    // (zero latência e zero custo por visitante). A chamada à API só acontece
    // para buscas ao vivo e snapshots antigos sem o campo.
    // ============================================================
    mostrarInsight() {
        const bar = document.getElementById('tripinha-insight-bar');
        const textEl = document.getElementById('tripinha-insight-text');
        if (!bar || !textEl) return;

        if (this.state.insight) {
            textEl.textContent = this.state.insight;
            bar.style.display = 'flex';
            return;
        }

        this.buscarTripinhaInsight();
    },

    async buscarTripinhaInsight() {
        const bar = document.getElementById('tripinha-insight-bar');
        const textEl = document.getElementById('tripinha-insight-text');
        if (!bar || !textEl) return;

        // Esconder enquanto carrega
        bar.style.display = 'none';

        if (this.state.destinos.length === 0) return;

        // Cache por origem (evita chamadas repetidas na mesma sessão)
        const cacheKey = `tripinha_insight_${this.state.origemAtual}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp < 15 * 60 * 1000) {
                    textEl.textContent = data.insight;
                    bar.style.display = 'flex';
                    return;
                }
            } catch (e) { /* cache inválido */ }
        }

        try {
            // Enviar apenas os campos necessários (payload leve)
            const destinosLeves = this.state.destinos.map(d => ({
                nome: d.nome,
                pais: d.pais,
                preco: d.preco,
                internacional: d.internacional,
                estilos: d.estilos,
                variacao: d.variacao,
                paradas: d.paradas,
            }));

            const response = await fetch('/api/tripinha-insight', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origem: this.state.origemNome,
                    origemCodigo: this.state.origemAtual,
                    destinos: destinosLeves,
                }),
            });

            if (!response.ok) return;

            const data = await response.json();
            console.log(`🐶 Tripinha insight [${data.modelo || '?'}]: "${data.insight}"`);
            if (data.motivo) console.warn(`🐶 Tripinha fallback motivo: ${data.motivo}`);
            if (data.success && data.insight) {
                textEl.textContent = data.insight;
                bar.style.display = 'flex';

                // Salvar no cache
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    insight: data.insight,
                    modelo: data.modelo,
                    timestamp: Date.now(),
                }));
            }
        } catch (error) {
            console.warn('Tripinha insight erro:', error.message);
        }
    },

    // ============================================================
    // LOADING / VAZIO
    // ============================================================
    mostrarLoading(msg) {
        document.getElementById('loading-state').style.display = 'block';
        document.getElementById('loading-message').textContent = msg || 'Buscando destinos...';
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('destinations-section').style.display = 'none';
        document.getElementById('filters-section').style.display = 'none';
        document.getElementById('cta-section').style.display = 'none';
        document.getElementById('share-fab').style.display = 'none';
        const quedas = document.getElementById('quedas-section');
        if (quedas) quedas.style.display = 'none';
        const pick = document.getElementById('tripinha-pick-section');
        if (pick) pick.style.display = 'none';
    },

    mostrarVazio(mensagem) {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('destinations-section').style.display = 'none';
        document.getElementById('empty-message').textContent = mensagem;
        document.getElementById('active-city-bar').style.display = 'flex';
        this.atualizarCityBar();
        this.state.carregando = false;
    },

    // ============================================================
    // COMPARTILHAMENTO
    // ============================================================
    abrirShareModal() {
        const destinos = this.state.destinosFiltrados.slice(0, 10);
        if (destinos.length === 0) return;

        const mensagem = this.gerarMensagemShare(destinos);
        const overlay = document.createElement('div');
        overlay.className = 'share-overlay';
        overlay.innerHTML = `
            <div class="share-modal">
                <h3>Compartilhar Destinos</h3>
                <div class="share-preview">${this.escapeHtml(mensagem)}</div>
                <div class="share-buttons">
                    <button class="share-btn whatsapp" data-platform="whatsapp">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                    </button>
                    <button class="share-btn telegram" data-platform="telegram">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                        Telegram
                    </button>
                    <button class="share-btn twitter" data-platform="twitter">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        X / Twitter
                    </button>
                    <button class="share-btn copy" data-platform="copy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        Copiar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.executarShare(btn.dataset.platform, mensagem);
                overlay.remove();
            });
        });
    },

    gerarMensagemShare(destinos) {
        const top = destinos.slice(0, 10);
        const maisBarato = top[0];
        const origem = this.state.origemNome;

        // Insight da Tripinha (do snapshot ou do cache da busca via API)
        let insightLine = '';
        if (this.state.insight) {
            insightLine = `\n🐶 ${this.state.insight}\n`;
        } else {
            const cacheKey = `tripinha_insight_${this.state.origemAtual}`;
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const data = JSON.parse(cached);
                    if (data.insight) insightLine = `\n🐶 ${data.insight}\n`;
                } catch (e) { /* sem insight */ }
            }
        }

        // Destaque de preço: variações
        const desceram = top.filter(d => d.variacao?.direcao === 'desceu');
        let variacaoLine = '';
        if (desceram.length > 0) {
            const destaques = desceram.slice(0, 3).map(d =>
                `${d.nome} ↓R$${Math.abs(d.variacao.diferenca)}`
            ).join(', ');
            variacaoLine = `\n📉 Preços caíram: ${destaques}\n`;
        }

        // Lista de destinos (formatação compacta e atrativa)
        const linhas = top.map((d, i) => {
            const flag = d.internacional ? '🌎' : '🇧🇷';
            const var_emoji = d.variacao?.direcao === 'desceu' ? ' 🔥' : '';
            return `${flag} ${d.nome} — R$ ${this.fmt(d.preco)}${var_emoji}`;
        });

        // Internacionais acessíveis
        const intlBaratos = top.filter(d => d.internacional && d.preco <= 2500);
        let intlLine = '';
        if (intlBaratos.length >= 2) {
            intlLine = `\n🌍 ${intlBaratos.length} destinos internacionais por menos de R$ 2.500!\n`;
        }

        const periodoMaisBarato = this.fmtPeriodo(maisBarato.data_ida, maisBarato.data_volta);
        return `✈️ *Top ${top.length} destinos baratos saindo de ${origem}!*\n` +
            insightLine +
            variacaoLine +
            `\n${linhas.join('\n')}\n` +
            intlLine +
            `\n💡 O mais barato: ${maisBarato.nome} por apenas R$ ${this.fmt(maisBarato.preco)}${periodoMaisBarato ? ` (${periodoMaisBarato})` : ''}` +
            `\n\n🐶 Vem ver na Benetrip! A Tripinha encontra viagens do seu jeito.` +
            `\n👉 https://benetrip.com.br/destinos-baratos`;
    },

    executarShare(platform, mensagem) {
        const url = 'https://benetrip.com.br/destinos-baratos';
        if (platform === 'whatsapp') {
            window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank');
        } else if (platform === 'telegram') {
            window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(mensagem)}`, '_blank');
        } else if (platform === 'twitter') {
            // Twitter tem limite de 280 chars, usar versão curta
            const tweetText = this.gerarMensagemTwitter();
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
        } else if (platform === 'copy') {
            navigator.clipboard.writeText(mensagem).then(() => this.mostrarToast('Copiado!'));
        }
    },

    gerarMensagemTwitter() {
        const maisBarato = this.state.destinosFiltrados[0];
        if (!maisBarato) return '';
        const origem = this.state.origemNome;
        const total = this.state.destinosFiltrados.length;
        return `✈️ ${maisBarato.nome} por R$ ${this.fmt(maisBarato.preco)} saindo de ${origem}! ` +
            `+ ${total - 1} destinos baratos pra viajar agora 🐶\n\n` +
            `👉 https://benetrip.com.br/destinos-baratos`;
    },

    // ============================================================
    // UTILITÁRIOS
    // ============================================================
    fmt(valor) {
        if (!valor) return '0';
        return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

    // "2026-09-12" -> "12 set" (parse manual para não depender de timezone)
    fmtDataCurta(iso) {
        if (!iso || typeof iso !== 'string') return '';
        const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        const [y, m, d] = iso.split('-').map(Number);
        if (!y || !m || !d || m < 1 || m > 12) return '';
        return `${d} ${meses[m - 1]}`;
    },

    fmtPeriodo(dataIda, dataVolta) {
        const ida = this.fmtDataCurta(dataIda);
        if (!ida) return '';
        const volta = this.fmtDataCurta(dataVolta);
        return volta ? `${ida} → ${volta}` : ida;
    },

    capitalize(str) {
        if (!str) return '';
        const map = { romantico: 'Casal', familia: 'Família', aventura: 'Aventura', praia: 'Praia', natureza: 'Natureza', cidade: 'Cidade', nacional: 'Nacional', internacional: 'Internacional' };
        return map[str] || str.charAt(0).toUpperCase() + str.slice(1);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    },

    mostrarToast(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:8px;z-index:999;font-size:13px;';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    },
};

document.addEventListener('DOMContentLoaded', () => DiscoveryPage.init());
