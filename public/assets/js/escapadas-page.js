/**
 * BENETRIP ESCAPADAS PAGE v1.0
 *
 * Página /escapadas: fins de semana e feriados nacionais com preços por
 * janela de datas. Hidrata de window.__ESCAPADAS_INITIAL__ (todas as janelas
 * já vêm no HTML do servidor): trocar de janela NÃO faz fetch, só re-renderiza.
 * Troca de cidade é navegação real (chips são <a href="/escapadas/:slug">).
 */

const EscapadasPage = {
    state: {
        origemAtual: 'GRU',
        origemNome: 'São Paulo',
        origemManual: false,   // true = cidade fora das 30, busca ao vivo
        janelas: [],
        janelaAtiva: null,     // objeto da janela ativa
        liveDestinos: {},      // { janelaId: [...] } resultados da busca ao vivo
        destinosFiltrados: [],
        carregandoLive: false,
        filtros: { estilos: [], precoMax: null, voo: [] },
        ordenacao: 'preco',
    },

    cidadesAutomaticas: [],

    init() {
        const inicial = window.__ESCAPADAS_INITIAL__;
        if (!inicial || !Array.isArray(inicial.janelas)) return;

        this.state.origemAtual = inicial.origemAtual;
        this.state.origemNome = inicial.origemNome;
        this.state.origemSlug = inicial.origemSlug || null;
        this.state.janelas = inicial.janelas;
        this.state.janelaAtiva = inicial.janelas.find(j => j.id === inicial.janelaAtiva) || inicial.janelas[0] || null;
        this.state.destinosFiltrados = [...(this.state.janelaAtiva?.destinos || [])];
        this.cidadesAutomaticas = inicial.cidadesAutomaticas || [];

        this.bindEvents();

        // Deep link de busca ao vivo (?origem=RAO): links compartilhados de
        // cidades fora das 30 reconstroem a busca ao abrir
        const origemParam = new URLSearchParams(location.search).get('origem');
        if (origemParam && /^[a-z]{3}$/i.test(origemParam)) {
            const code = origemParam.toUpperCase();
            const isAuto = this.cidadesAutomaticas.some(c => c.codigo === code);
            if (!isAuto) this.selecionarCidadeLive(code);
        }
    },

    // Destinos da janela ativa, respeitando o modo (snapshot ou ao vivo)
    destinosAtivos() {
        const janela = this.state.janelaAtiva;
        if (!janela) return [];
        return this.state.origemManual
            ? (this.state.liveDestinos[janela.id] || [])
            : (janela.destinos || []);
    },

    bindEvents() {
        // === BUSCA DE CIDADE (hero) ===
        const cityInput = document.getElementById('city-search-input');
        const cityClear = document.getElementById('city-search-clear');
        const suggestions = document.getElementById('city-suggestions');

        if (cityInput) {
            cityInput.addEventListener('input', () => {
                const val = cityInput.value.trim();
                if (cityClear) cityClear.style.display = val ? 'flex' : 'none';
                if (val.length >= 2) this.mostrarSugestoesCidade(val);
                else if (suggestions) suggestions.style.display = 'none';
            });
            cityInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = cityInput.value.trim();
                    if (val.length >= 2) this.selecionarCidadeDigitada(val);
                }
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.hero-city-search') && suggestions) suggestions.style.display = 'none';
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
                if (!item || item.disabled) return;
                if (cityInput) cityInput.value = '';
                if (cityClear) cityClear.style.display = 'none';
                suggestions.style.display = 'none';
                if (item.dataset.auto === 'true') {
                    const slug = item.dataset.slug;
                    window.location.href = slug === 'sao-paulo' ? '/escapadas' : `/escapadas/${slug}`;
                } else {
                    this.selecionarCidadeLive(item.dataset.code);
                }
            });
        }

        // === SELETOR DE JANELA ===
        document.getElementById('janela-selector')?.addEventListener('click', (e) => {
            const chip = e.target.closest('.janela-chip');
            if (!chip) return;
            this.selecionarJanela(chip.dataset.janela);
        });

        // Links "ver voos" da barra de feriado e do calendário
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.feriado-bar-link, .feriado-item-link');
            if (!link || !link.dataset.janela) return;
            this.selecionarJanela(link.dataset.janela);
            document.getElementById('janela-selector')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        // === FILTROS ===
        document.getElementById('filter-chips')?.addEventListener('click', (e) => {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;
            this.toggleFiltro(chip.dataset.filter, chip.dataset.tipo, chip);
        });

        // === ORDENAÇÃO ===
        document.getElementById('sort-select')?.addEventListener('change', (e) => {
            this.state.ordenacao = e.target.value;
            this.aplicarFiltros();
        });

        // === COMPARTILHAR (FAB da janela + botão do card) ===
        document.getElementById('share-fab')?.addEventListener('click', () => this.compartilharJanela());
        document.getElementById('destinations-grid')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.dest-share-btn');
            if (!btn) return;
            // o card é um <a>: sem isso o clique no share abriria o Google Flights
            e.preventDefault();
            e.stopPropagation();
            this.compartilharDestino(btn.dataset.shareNome);
        });
    },

    // ============================================================
    // BUSCA DE CIDADE (30 automáticas + qualquer aeroporto ao vivo)
    // ============================================================
    normalizar(s) {
        return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    },

    mostrarSugestoesCidade(query) {
        const container = document.getElementById('city-suggestions');
        if (!container) return;

        const q = this.normalizar(query);
        const isIATA = /^[a-z]{3}$/i.test(query.trim());
        const matches = this.cidadesAutomaticas.filter(c =>
            this.normalizar(c.nome).includes(q) || c.codigo.toLowerCase().includes(q)
        ).slice(0, 6);

        let html = '';
        if (matches.length > 0) {
            html += '<div class="suggestions-group-label">Cidades com preços diários</div>';
            matches.forEach(c => {
                html += `<button class="city-suggestion-item" data-auto="true" data-slug="${c.slug}" data-code="${c.codigo}">
                    <span class="suggestion-name">${c.nome}</span>
                    <span class="suggestion-meta">${c.codigo} · ${c.estado} · <span class="suggestion-badge-auto">Atualizado diariamente</span></span>
                </button>`;
            });
        }

        html += '<div class="suggestions-group-label">Buscar ao vivo</div>';
        if (isIATA) {
            const code = query.trim().toUpperCase();
            html += `<button class="city-suggestion-item suggestion-manual" data-auto="false" data-code="${code}">
                <span class="suggestion-name">Buscar escapadas saindo de ${code}</span>
                <span class="suggestion-meta">Pesquisa em tempo real nas datas da janela · alguns segundos</span>
            </button>`;
        } else {
            html += `<button class="city-suggestion-item suggestion-manual" disabled style="opacity:.65;cursor:default;">
                <span class="suggestion-name">Para outras cidades, digite o código do aeroporto</span>
                <span class="suggestion-meta">Ex.: RAO (Ribeirão Preto), UDI (Uberlândia), XAP (Chapecó)</span>
            </button>`;
        }

        container.innerHTML = html;
        container.style.display = 'block';
    },

    selecionarCidadeDigitada(val) {
        const q = this.normalizar(val);
        const auto = this.cidadesAutomaticas.find(c =>
            c.codigo.toLowerCase() === q || this.normalizar(c.nome) === q
        );
        const suggestions = document.getElementById('city-suggestions');
        if (suggestions) suggestions.style.display = 'none';

        if (auto) {
            window.location.href = auto.slug === 'sao-paulo' ? '/escapadas' : `/escapadas/${auto.slug}`;
        } else if (/^[a-z]{3}$/i.test(val.trim())) {
            this.selecionarCidadeLive(val.trim().toUpperCase());
        } else {
            this.mostrarSugestoesCidade(val); // mantém a dica do código IATA visível
        }
    },

    // ============================================================
    // BUSCA AO VIVO (cidade fora das 30: /api/escapadas-live por janela)
    // ============================================================
    selecionarCidadeLive(iata) {
        this.state.origemManual = true;
        this.state.origemAtual = iata;
        this.state.origemNome = iata;
        this.state.liveDestinos = {};

        document.querySelectorAll('.origin-chip').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.janela-chip-preco').forEach(el => { el.textContent = 'buscar'; el.classList.add('janela-chip-preco-vazio'); });

        const heroTitle = document.getElementById('hero-title');
        if (heroTitle) heroTitle.textContent = `Escapadas de Fim de Semana Saindo de ${iata}`;
        const heroSub = document.getElementById('hero-subtitle');
        if (heroSub) heroSub.textContent = `Busca em tempo real saindo de ${iata}, nas datas exatas de cada janela. Preços de agora, direto da fonte.`;

        this.buscarLive(this.state.janelaAtiva);
    },

    async buscarLive(janela) {
        if (!janela || this.state.carregandoLive) return;
        this.state.carregandoLive = true;
        this.resetarFiltros();

        // Cache de sessão (10 min) por origem+janela
        const cacheKey = `escapadas_live_${this.state.origemAtual}_${janela.id}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp < 10 * 60 * 1000) {
                    this.state.liveDestinos[janela.id] = data.destinos;
                    this.state.carregandoLive = false;
                    this.renderizar();
                    return;
                }
            } catch (e) { /* cache inválido */ }
        }

        this.mostrarLoading(`Buscando voos de ${this.state.origemAtual} para ${janela.rotuloDatas}...`);

        try {
            const resp = await fetch(`/api/escapadas-live?origem=${encodeURIComponent(this.state.origemAtual)}&janela=${encodeURIComponent(janela.id)}`);
            const data = resp.ok ? await resp.json() : null;

            if (data?.success) {
                this.state.liveDestinos[janela.id] = data.destinos || [];
                sessionStorage.setItem(cacheKey, JSON.stringify({ destinos: data.destinos || [], timestamp: Date.now() }));
            } else {
                this.state.liveDestinos[janela.id] = [];
            }
        } catch (err) {
            console.warn('Busca ao vivo falhou:', err.message);
            this.state.liveDestinos[janela.id] = [];
        } finally {
            this.state.carregandoLive = false;
            this.renderizar();
        }
    },

    mostrarLoading(msg) {
        const loading = document.getElementById('loading-state');
        if (loading) loading.style.display = 'block';
        const msgEl = document.getElementById('loading-message');
        if (msgEl) msgEl.textContent = msg;
        document.getElementById('destinations-section').style.display = 'none';
        document.getElementById('filters-section').style.display = 'none';
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('stats-bar').innerHTML = '';
    },

    // ============================================================
    // TROCA DE JANELA (snapshot: sem fetch; ao vivo: busca a janela)
    // ============================================================
    selecionarJanela(janelaId) {
        const janela = this.state.janelas.find(j => j.id === janelaId);
        if (!janela || janela.id === this.state.janelaAtiva?.id) return;

        this.state.janelaAtiva = janela;
        this.resetarFiltros();

        // Chips
        document.querySelectorAll('.janela-chip').forEach(c => {
            const ativo = c.dataset.janela === janelaId;
            c.classList.toggle('active', ativo);
            if (ativo) c.setAttribute('aria-current', 'true');
            else c.removeAttribute('aria-current');
        });

        // URL compartilhável (?janela=...) sem recarregar
        const url = new URL(location.href);
        url.searchParams.set('janela', janelaId);
        history.replaceState(null, '', url.pathname + url.search);

        if (this.state.origemManual && !this.state.liveDestinos[janela.id]) {
            this.buscarLive(janela);
        } else {
            this.renderizar();
        }
    },

    // ============================================================
    // FILTROS
    // ============================================================
    toggleFiltro(filter, tipo, chipEl) {
        const f = this.state.filtros;

        if (filter === 'todos') {
            this.state.filtros = { estilos: [], precoMax: null, voo: [] };
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chipEl.classList.add('active');
        } else if (tipo === 'estilo') {
            const idx = f.estilos.indexOf(filter);
            if (idx >= 0) { f.estilos.splice(idx, 1); chipEl.classList.remove('active'); }
            else { f.estilos.push(filter); chipEl.classList.add('active'); }
        } else if (tipo === 'voo') {
            const idx = f.voo.indexOf(filter);
            if (idx >= 0) { f.voo.splice(idx, 1); chipEl.classList.remove('active'); }
            else { f.voo.push(filter); chipEl.classList.add('active'); }
        } else if (tipo === 'preco') {
            const valor = parseInt(filter);
            if (f.precoMax === valor) { f.precoMax = null; chipEl.classList.remove('active'); }
            else {
                f.precoMax = valor;
                document.querySelectorAll('.filter-chip[data-tipo="preco"]').forEach(c => c.classList.remove('active'));
                chipEl.classList.add('active');
            }
        }

        document.querySelector('.filter-chip[data-filter="todos"]')?.classList.toggle(
            'active',
            f.estilos.length === 0 && !f.precoMax && f.voo.length === 0
        );

        this.aplicarFiltros();
    },

    aplicarFiltros() {
        const { estilos, precoMax, voo } = this.state.filtros;
        let resultado = [...this.destinosAtivos()];

        if (estilos.length > 0) {
            resultado = resultado.filter(d => (d.estilos || []).some(e => estilos.includes(e)));
        }
        if (precoMax) {
            resultado = resultado.filter(d => d.preco <= precoMax);
        }
        if (voo.includes('direto')) {
            resultado = resultado.filter(d => !d.paradas);
        }
        if (voo.includes('curto')) {
            resultado = resultado.filter(d => d.duracao_voo_min > 0 && d.duracao_voo_min <= 120);
        }

        this.state.destinosFiltrados = this.ordenar(resultado);
        this.renderizarCards();
        this.atualizarContagem();
    },

    ordenar(destinos) {
        const copia = [...destinos];
        switch (this.state.ordenacao) {
            case 'preco': return copia.sort((a, b) => a.preco - b.preco);
            case 'voo': return copia.sort((a, b) => (a.duracao_voo_min || Infinity) - (b.duracao_voo_min || Infinity));
            case 'queda': return copia.sort((a, b) => (a.variacao?.percentual ?? Infinity) - (b.variacao?.percentual ?? Infinity));
            case 'nome': return copia.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            default: return copia;
        }
    },

    resetarFiltros() {
        this.state.filtros = { estilos: [], precoMax: null, voo: [] };
        this.state.ordenacao = 'preco';
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        document.querySelector('.filter-chip[data-filter="todos"]')?.classList.add('active');
        const sort = document.getElementById('sort-select');
        if (sort) sort.value = 'preco';
    },

    // ============================================================
    // RENDERIZAÇÃO
    // ============================================================
    renderizar() {
        const janela = this.state.janelaAtiva;
        const destinos = this.destinosAtivos();
        const temDestinos = destinos.length > 0;
        this.state.destinosFiltrados = [...destinos];

        const loading = document.getElementById('loading-state');
        if (loading) loading.style.display = 'none';

        // Barra da janela ativa
        const nomeEl = document.getElementById('janela-ativa-nome');
        if (nomeEl && janela) nomeEl.textContent = `${janela.rotulo} · ${janela.rotuloDatas}`;
        const badgeEl = document.getElementById('janela-ativa-badge');
        if (badgeEl) {
            badgeEl.textContent = this.state.origemManual
                ? 'Busca ao vivo'
                : (janela?.dataSnapshot ? this.badgeAtualizacao(janela.dataSnapshot) : 'Aguardando preços');
        }
        const sourceEl = document.querySelector('.active-city-source');
        if (sourceEl) sourceEl.textContent = `ida e volta · ${this.state.origemNome}`;

        // No modo ao vivo, o chip da janela mostra o menor preço encontrado
        if (this.state.origemManual && janela) {
            const chipPreco = document.querySelector(`.janela-chip[data-janela="${janela.id}"] .janela-chip-preco`);
            if (chipPreco) {
                if (temDestinos) {
                    chipPreco.textContent = `a partir de R$ ${this.fmt(destinos[0].preco)}`;
                    chipPreco.classList.remove('janela-chip-preco-vazio');
                } else {
                    chipPreco.textContent = 'sem voos';
                }
            }
        }

        // Stats
        document.getElementById('stats-bar').innerHTML = temDestinos ? this.renderStats(destinos) : '';

        // Título da seção
        const titulo = document.getElementById('section-title');
        if (titulo && janela) {
            titulo.textContent = janela.categoria === 'feriado'
                ? `${janela.feriado.nome}: escapadas de ${this.state.origemNome}`
                : `${janela.rotulo} saindo de ${this.state.origemNome}`;
        }

        document.getElementById('filters-section').style.display = temDestinos ? 'block' : 'none';
        document.getElementById('destinations-section').style.display = temDestinos ? 'block' : 'none';
        document.getElementById('empty-state').style.display = temDestinos ? 'none' : 'block';
        const shareFab = document.getElementById('share-fab');
        if (shareFab) shareFab.style.display = temDestinos ? 'flex' : 'none';

        this.renderizarCards();
        this.atualizarContagem();
    },

    renderizarCards() {
        const grid = document.getElementById('destinations-grid');
        if (!grid) return;
        grid.innerHTML = this.state.destinosFiltrados.map(d => this.renderCard(d)).join('');
    },

    // O card é um <a target="_blank"> direto pro Google Flights com as datas
    // da janela (link real: imune a bloqueio de popup, funciona com clique do
    // meio). Sem código IATA cai no calendário interno de preços.
    hrefDoDestino(d) {
        if (d.aeroporto && d.data_ida && d.data_volta) {
            return this.buildGoogleFlightsUrl(this.state.origemAtual, d.aeroporto, d.data_ida, d.data_volta);
        }
        const params = new URLSearchParams({
            origem: this.state.origemAtual,
            destino: d.aeroporto || d.nome,
            nome: d.nome,
        });
        if (d.data_ida) params.set('data_ida', d.data_ida);
        if (d.data_volta) params.set('data_volta', d.data_volta);
        return `/voos-baratos?${params.toString()}`;
    },

    // ============================================================
    // GOOGLE FLIGHTS URL (mesmo encoding tfs/tfu do descobrir-destinos.js:
    // protobuf em base64url, abre direto nos resultados de ida e volta)
    // ============================================================
    _protoVarint(value) {
        const bytes = [];
        let v = value >>> 0;
        while (v > 0x7f) { bytes.push((v & 0x7f) | 0x80); v >>>= 7; }
        bytes.push(v & 0x7f);
        return bytes;
    },
    _protoVarintField(fieldNumber, value) {
        return [...this._protoVarint((fieldNumber << 3) | 0), ...this._protoVarint(value)];
    },
    _protoStringField(fieldNumber, str) {
        const encoded = new TextEncoder().encode(str);
        return [...this._protoVarint((fieldNumber << 3) | 2), ...this._protoVarint(encoded.length), ...encoded];
    },
    _protoMessageField(fieldNumber, messageBytes) {
        return [...this._protoVarint((fieldNumber << 3) | 2), ...this._protoVarint(messageBytes.length), ...messageBytes];
    },
    _toBase64Url(bytes) {
        return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    _buildAirport(iataCode) {
        return [...this._protoVarintField(1, 1), ...this._protoStringField(2, iataCode)];
    },
    _buildFlightLeg(date, originIata, destIata) {
        return [
            ...this._protoStringField(2, date),
            ...this._protoMessageField(13, this._buildAirport(originIata)),
            ...this._protoMessageField(14, this._buildAirport(destIata)),
        ];
    },
    buildGoogleFlightsUrl(originIata, destIata, departDate, returnDate) {
        const tfs = this._toBase64Url([
            ...this._protoVarintField(1, 28),
            ...this._protoVarintField(2, 2),
            ...this._protoMessageField(3, this._buildFlightLeg(departDate, originIata, destIata)),
            ...this._protoMessageField(3, this._buildFlightLeg(returnDate, destIata, originIata)),
            ...this._protoVarintField(14, 1),
        ]);
        const tfu = this._toBase64Url(this._protoMessageField(2, [
            ...this._protoVarintField(1, 1),
            ...this._protoVarintField(2, 0),
            ...this._protoVarintField(3, 0),
        ]));
        const params = new URLSearchParams();
        params.set('tfs', tfs);
        params.set('tfu', tfu);
        params.set('curr', 'BRL');
        params.set('hl', 'pt-BR');
        params.set('gl', 'br');
        return `https://www.google.com/travel/flights/search?${params.toString()}`;
    },

    renderCard(d) {
        const imgSrc = d.imagem || '/assets/images/tripinha/avatar-pensando.png';
        const estilosTags = (d.estilos || []).map(e => `<span class="dest-tag">${this.capitalize(e)}</span>`).join('');
        const variacaoHtml = d.variacao ? this.renderVariacaoInline(d.variacao) : '';
        const periodo = this.fmtPeriodo(d.data_ida, d.data_volta);
        const noites = this.state.janelaAtiva?.noites;
        const vooTexto = d.duracao_voo_min ? `${Math.floor(d.duracao_voo_min / 60)}h${String(d.duracao_voo_min % 60).padStart(2, '0')} de voo` : '';
        const quedaDestaque = d.variacao?.direcao === 'desceu' && Math.abs(d.variacao.percentual) >= 5
            ? `<span class="dest-badge-drop">↓ ${Math.abs(d.variacao.percentual)}%</span>`
            : '';

        return `
            <a class="dest-card" href="${this.hrefDoDestino(d)}" target="_blank" rel="noopener nofollow" data-aeroporto="${d.aeroporto}" data-nome="${d.nome}" data-duracao="${noites || ''}" data-ida="${d.data_ida || ''}" data-volta="${d.data_volta || ''}">
                <div class="dest-card-inner">
                    <div class="dest-image-wrapper">
                        <img class="dest-image" src="${imgSrc}" alt="${d.nome}" loading="lazy"
                             onerror="this.src='/assets/images/tripinha/avatar-pensando.png'">
                        <span class="dest-rank">${d.posicao}</span>
                        ${quedaDestaque}
                        ${d.internacional ? '<span class="dest-badge-international">Internacional</span>' : ''}
                        <button class="dest-share-btn" data-share-nome="${d.nome}" title="Compartilhar ${d.nome}" aria-label="Compartilhar ${d.nome}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        </button>
                    </div>
                    <div class="dest-info">
                        <div class="dest-header">
                            <h3 class="dest-name">${d.nome}</h3>
                            <p class="dest-country">${d.pais}${d.paradas > 0 ? ` · ${d.paradas} parada${d.paradas > 1 ? 's' : ''}` : ' · Direto'}${vooTexto ? ` · ${vooTexto}` : ''}</p>
                        </div>
                        <div class="dest-tags">${estilosTags}</div>
                        ${periodo ? `<div class="dest-dates" title="Ida e volta nas datas da janela selecionada">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            <span>${periodo}</span>
                        </div>` : ''}
                        <div class="dest-footer">
                            <div class="dest-price-block">
                                <span class="dest-price-label">Ida e volta</span>
                                <span class="dest-price">R$ ${this.fmt(d.preco)}</span>
                                ${variacaoHtml}
                            </div>
                            <div class="dest-duration">${noites ? `<strong>${noites}</strong> noite${noites !== 1 ? 's' : ''}` : ''}</div>
                        </div>
                    </div>
                </div>
            </a>`;
    },

    renderStats(destinos) {
        const maisBarato = destinos[0];
        const precos = destinos.filter(d => d.preco > 0).map(d => d.preco);
        const media = precos.length > 0 ? Math.round(precos.reduce((a, b) => a + b, 0) / precos.length) : 0;
        const diretos = destinos.filter(d => !d.paradas).length;
        const maiorQueda = destinos
            .filter(d => d.variacao?.direcao === 'desceu' && Math.abs(d.variacao.percentual) >= 3)
            .sort((a, b) => a.variacao.percentual - b.variacao.percentual)[0];

        const maiorQuedaHtml = maiorQueda ? `
            <div class="stat-card stat-card-drop">
                <div class="stat-label">Maior queda</div>
                <div class="stat-value stat-value-drop">↓ ${Math.abs(maiorQueda.variacao.percentual)}%</div>
                <div class="stat-detail">${maiorQueda.nome} · agora R$ ${this.fmt(maiorQueda.preco)}</div>
            </div>` : '';

        return `
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
                <div class="stat-label">Voos diretos</div>
                <div class="stat-value">${diretos}</div>
                <div class="stat-detail">destinos</div>
            </div>`;
    },

    atualizarContagem() {
        const count = this.state.destinosFiltrados.length;
        const el = document.getElementById('section-count');
        if (el) el.textContent = `${count} destino${count !== 1 ? 's' : ''}`;
    },

    // ============================================================
    // COMPARTILHAMENTO
    // A URL sempre carrega a janela (?janela=) e, em busca ao vivo, a
    // origem (?origem=RAO): quem abre o link cai exatamente na mesma tela.
    // ============================================================
    urlCompartilhavel() {
        const base = this.state.origemManual || !this.state.origemSlug
            ? 'https://benetrip.com.br/escapadas'
            : (this.state.origemSlug === 'sao-paulo'
                ? 'https://benetrip.com.br/escapadas'
                : `https://benetrip.com.br/escapadas/${this.state.origemSlug}`);
        const params = new URLSearchParams();
        if (this.state.janelaAtiva) params.set('janela', this.state.janelaAtiva.id);
        if (this.state.origemManual) params.set('origem', this.state.origemAtual);
        const qs = params.toString();
        return qs ? `${base}?${qs}` : base;
    },

    tituloJanela() {
        const j = this.state.janelaAtiva;
        if (!j) return 'Escapadas';
        return j.categoria === 'feriado'
            ? `Escapadas pro ${j.feriado.nome}`
            : `Escapadas de fim de semana (${j.rotuloDatas})`;
    },

    hojeCurto() {
        const agora = new Date();
        const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        return `${agora.getDate()} ${meses[agora.getMonth()]}`;
    },

    gerarMensagemJanela() {
        const j = this.state.janelaAtiva;
        const destinos = this.state.destinosFiltrados.slice(0, 8);
        if (!j || destinos.length === 0) return null;

        const linhas = destinos.map(d => {
            const flag = d.internacional ? '🌎' : '🇧🇷';
            return `${flag} ${d.nome} — R$ ${this.fmt(d.preco)}${d.paradas === 0 ? ' · direto' : ''}`;
        });

        const cabecalho = j.categoria === 'feriado'
            ? `✈️ *${this.tituloJanela()} saindo de ${this.state.origemNome}!*\n🗓️ ${j.rotuloDatas} · ${j.feriado.emenda}`
            : `✈️ *${this.tituloJanela()} saindo de ${this.state.origemNome}!*\n🗓️ ida e volta · ${j.noites} noite${j.noites > 1 ? 's' : ''}`;

        return `${cabecalho}\n\n${linhas.join('\n')}\n\n💡 Preços de ida e volta encontrados hoje (${this.hojeCurto()}) — podem mudar.` +
            `\n\n🐶 Vem ver na Benetrip:\n${this.urlCompartilhavel()}`;
    },

    gerarMensagemDestino(d) {
        const j = this.state.janelaAtiva;
        const periodo = this.fmtPeriodo(d.data_ida, d.data_volta);
        const contexto = j?.categoria === 'feriado' ? ` no ${j.feriado.nome}` : ' no fim de semana';
        return `✈️ Achei ${d.nome} por *R$ ${this.fmt(d.preco)}* ida e volta saindo de ${this.state.origemNome}${contexto}!` +
            `\n🗓️ ${periodo}${j ? ` · ${j.noites} noite${j.noites > 1 ? 's' : ''}` : ''}${d.paradas === 0 ? ' · voo direto' : ''}` +
            `\n\n🐶 Vê os detalhes na Benetrip:\n${this.urlCompartilhavel()}`;
    },

    compartilharJanela() {
        const mensagem = this.gerarMensagemJanela();
        if (mensagem) this.compartilhar(mensagem);
    },

    compartilharDestino(nome) {
        const d = this.destinosAtivos().find(x => x.nome === nome);
        if (d) this.compartilhar(this.gerarMensagemDestino(d));
    },

    compartilhar(mensagem) {
        // Mobile: folha de compartilhamento nativa (um toque, qualquer app)
        if (navigator.share) {
            navigator.share({ text: mensagem }).catch(() => { /* usuário cancelou */ });
            return;
        }
        this.abrirShareModal(mensagem);
    },

    abrirShareModal(mensagem) {
        const overlay = document.createElement('div');
        overlay.className = 'share-overlay';
        overlay.innerHTML = `
            <div class="share-modal">
                <h3>Compartilhar</h3>
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
            </div>`;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.executarShare(btn.dataset.platform, mensagem);
                overlay.remove();
            });
        });
    },

    executarShare(platform, mensagem) {
        const url = this.urlCompartilhavel();
        if (platform === 'whatsapp') {
            window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank');
        } else if (platform === 'telegram') {
            window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(mensagem)}`, '_blank');
        } else if (platform === 'twitter') {
            const destinos = this.state.destinosFiltrados;
            const top = destinos[0];
            const tweet = top
                ? `✈️ ${top.nome} por R$ ${this.fmt(top.preco)} ida e volta saindo de ${this.state.origemNome} (${this.state.janelaAtiva?.rotuloDatas || ''}) 🐶\n\n👉 ${url}`
                : `${this.tituloJanela()} saindo de ${this.state.origemNome} 🐶\n\n👉 ${url}`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, '_blank');
        } else if (platform === 'copy') {
            navigator.clipboard.writeText(mensagem).then(() => this.mostrarToast('Copiado!'));
        }
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

    // ============================================================
    // UTILITÁRIOS (mesmos formatos da discovery-page)
    // ============================================================
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

    badgeAtualizacao(dataSnapshot) {
        const dataObj = new Date(dataSnapshot + 'T12:00:00');
        const hoje = new Date();
        hoje.setHours(12, 0, 0, 0);
        const diffDias = Math.round((hoje - dataObj) / (1000 * 60 * 60 * 24));
        if (diffDias === 0) return 'Atualizado hoje';
        if (diffDias === 1) return 'Atualizado ontem';
        return `Há ${diffDias} dias`;
    },

    fmt(valor) {
        if (!valor) return '0';
        return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

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
        const map = { romantico: 'Casal', familia: 'Família', aventura: 'Aventura', praia: 'Praia', natureza: 'Natureza', cidade: 'Cidade' };
        return map[str] || str.charAt(0).toUpperCase() + str.slice(1);
    },
};

document.addEventListener('DOMContentLoaded', () => EscapadasPage.init());
