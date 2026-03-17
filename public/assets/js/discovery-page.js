/**
 * BENETRIP DISCOVERY PAGE v2.0
 *
 * Melhorias v2.0:
 * - Filtros combináveis (multi-select): estilo + preço + escopo simultaneamente
 * - Busca inteligente via Groq (linguagem natural)
 * - Ordenação por relevância, preço, nome
 * - UX melhorada com feedback visual
 *
 * FLUXO:
 * 1. Página carrega → busca snapshot da origem padrão (GRU)
 * 2. Usuário clica em outra cidade → busca snapshot daquela origem
 * 3. Usuário combina filtros → filtra destinos no client-side
 * 4. Usuário digita busca → chama Groq via /api/discovery-smart-filter
 * 5. Botão share → gera mensagem e abre modal de compartilhamento
 */

const DiscoveryPage = {
    // ============================================================
    // ESTADO
    // ============================================================
    state: {
        origemAtual: 'GRU',
        origemNome: 'São Paulo',
        destinos: [],              // Todos os destinos do snapshot
        destinosFiltrados: [],     // Destinos após filtros combinados
        dataSnapshot: null,
        carregando: false,
        buscandoIA: false,

        // Filtros combináveis (múltiplos ativos ao mesmo tempo)
        filtros: {
            estilos: [],           // ['praia', 'natureza'] — OR entre si
            precoMax: null,        // 1000, 2000, 3000 ou null
            escopo: null,          // 'nacional', 'internacional' ou null
        },

        // Busca inteligente
        buscaQuery: '',
        buscaResultado: null,      // Resultado do Groq
        ordenacao: 'preco',        // 'preco', 'nome'
    },

    // ============================================================
    // INICIALIZAÇÃO
    // ============================================================
    init() {
        console.log('🔍 Discovery Page v2.0 inicializando...');
        this.bindEvents();
        this.carregarDestinos(this.state.origemAtual);
    },

    // ============================================================
    // BIND DE EVENTOS
    // ============================================================
    bindEvents() {
        // Chips de origem
        document.getElementById('origin-chips').addEventListener('click', (e) => {
            const chip = e.target.closest('.origin-chip');
            if (!chip) return;

            const origin = chip.dataset.origin;
            const name = chip.dataset.name;

            document.querySelectorAll('.origin-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            this.state.origemAtual = origin;
            this.state.origemNome = name;
            this.carregarDestinos(origin);
        });

        // Chips de filtro (multi-select)
        document.getElementById('filter-chips').addEventListener('click', (e) => {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;

            const filter = chip.dataset.filter;
            const tipo = chip.dataset.tipo;

            this.toggleFiltro(filter, tipo, chip);
        });

        // Busca inteligente
        const searchInput = document.getElementById('smart-search-input');
        const searchBtn = document.getElementById('smart-search-btn');
        const searchClear = document.getElementById('smart-search-clear');

        if (searchInput) {
            let debounceTimer = null;

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(debounceTimer);
                    this.executarBuscaInteligente(searchInput.value.trim());
                }
            });

            searchInput.addEventListener('input', () => {
                const val = searchInput.value.trim();
                if (searchClear) searchClear.style.display = val ? 'flex' : 'none';

                // Se apagou tudo, volta aos filtros normais
                if (!val && this.state.buscaResultado) {
                    this.limparBusca();
                }
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const val = searchInput?.value.trim();
                if (val) this.executarBuscaInteligente(val);
            });
        }

        if (searchClear) {
            searchClear.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                searchClear.style.display = 'none';
                this.limparBusca();
            });
        }

        // Ordenação
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.state.ordenacao = e.target.value;
                this.aplicarFiltros();
            });
        }

        // FAB de compartilhamento
        document.getElementById('share-fab').addEventListener('click', () => {
            this.abrirShareModal();
        });
    },

    // ============================================================
    // TOGGLE DE FILTRO (multi-select combinável)
    // ============================================================
    toggleFiltro(filter, tipo, chipEl) {
        // Limpar busca IA quando usa filtros manuais
        if (this.state.buscaResultado) {
            this.limparBusca(false); // false = não re-renderizar ainda
        }

        if (filter === 'todos') {
            // "Todos" limpa todos os filtros
            this.state.filtros = { estilos: [], precoMax: null, escopo: null };
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chipEl.classList.add('active');
        } else if (tipo === 'estilo') {
            // Estilos: toggle individual (OR entre si)
            const idx = this.state.filtros.estilos.indexOf(filter);
            if (idx >= 0) {
                this.state.filtros.estilos.splice(idx, 1);
                chipEl.classList.remove('active');
            } else {
                this.state.filtros.estilos.push(filter);
                chipEl.classList.add('active');
            }
            // Remover "Todos" quando qualquer filtro estiver ativo
            document.querySelector('.filter-chip[data-filter="todos"]')?.classList.remove('active');
        } else if (tipo === 'preco') {
            const valor = parseInt(filter);
            if (this.state.filtros.precoMax === valor) {
                // Desativar mesmo preço
                this.state.filtros.precoMax = null;
                chipEl.classList.remove('active');
            } else {
                // Trocar preço (só um por vez)
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

        // Se nenhum filtro ativo, ativar "Todos"
        const { estilos, precoMax, escopo } = this.state.filtros;
        if (estilos.length === 0 && !precoMax && !escopo) {
            document.querySelector('.filter-chip[data-filter="todos"]')?.classList.add('active');
        }

        this.aplicarFiltros();
    },

    // ============================================================
    // APLICAR FILTROS COMBINADOS (client-side)
    // ============================================================
    aplicarFiltros() {
        const { estilos, precoMax, escopo } = this.state.filtros;
        let resultado = [...this.state.destinos];

        // Filtro por estilos (OR: pelo menos um estilo deve bater)
        if (estilos.length > 0) {
            resultado = resultado.filter(d =>
                (d.estilos || []).some(e => estilos.includes(e))
            );
        }

        // Filtro por preço máximo
        if (precoMax) {
            resultado = resultado.filter(d => d.preco <= precoMax);
        }

        // Filtro por escopo (nacional/internacional)
        if (escopo === 'nacional') {
            resultado = resultado.filter(d => !d.internacional);
        } else if (escopo === 'internacional') {
            resultado = resultado.filter(d => d.internacional);
        }

        // Ordenação
        resultado = this.ordenar(resultado);

        this.state.destinosFiltrados = resultado;
        this.renderizarCards();
        this.atualizarContagem();
    },

    // ============================================================
    // ORDENAÇÃO
    // ============================================================
    ordenar(destinos) {
        const tipo = this.state.ordenacao;
        const copia = [...destinos];

        switch (tipo) {
            case 'preco':
                return copia.sort((a, b) => a.preco - b.preco);
            case 'nome':
                return copia.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            default:
                return copia;
        }
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
                body: JSON.stringify({
                    query,
                    destinos: this.state.destinos,
                }),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (data.success && data.indices) {
                this.state.buscaResultado = data;

                // Mapear índices para destinos
                const resultado = data.indices
                    .filter(i => i >= 0 && i < this.state.destinos.length)
                    .map(i => this.state.destinos[i]);

                // Limpar chips de filtro visual
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                this.state.filtros = { estilos: [], precoMax: null, escopo: null };

                this.state.destinosFiltrados = resultado;
                this.renderizarCards();
                this.atualizarContagem(data.titulo || `Resultados: "${query}"`);
                this.mostrarBuscaFeedback(data.explicacao, resultado.length);
            }
        } catch (error) {
            console.error('❌ Busca inteligente falhou:', error);
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
            // Reativar "Todos"
            this.state.filtros = { estilos: [], precoMax: null, escopo: null };
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            document.querySelector('.filter-chip[data-filter="todos"]')?.classList.add('active');

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
    // CARREGAR DESTINOS DA API
    // ============================================================
    async carregarDestinos(origem) {
        if (this.state.carregando) return;
        this.state.carregando = true;

        this.mostrarLoading();

        // Limpar busca e filtros ao trocar cidade
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

        try {
            const response = await fetch(`/api/discovery?origem=${origem}`);

            if (!response.ok) {
                if (response.status === 404) {
                    console.log('📡 Snapshot não encontrado, tentando busca ao vivo...');
                    await this.buscarAoVivo(origem);
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.destinos) {
                this.state.destinos = data.destinos;
                this.state.dataSnapshot = data.data;
                this.state.destinosFiltrados = [...this.state.destinos];
                this.renderizar();
            } else {
                this.mostrarVazio('Nenhum destino encontrado para esta cidade.');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar destinos:', error);
            await this.buscarAoVivo(origem);
        } finally {
            this.state.carregando = false;
        }
    },

    // ============================================================
    // BUSCA AO VIVO (fallback quando cron não rodou ainda)
    // ============================================================
    async buscarAoVivo(origem) {
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

            if (data.success && data.destinations) {
                this.state.destinos = data.destinations
                    .filter(d => d.flight?.price > 0)
                    .sort((a, b) => (a.flight?.price || 0) - (b.flight?.price || 0))
                    .slice(0, 50)
                    .map((d, i) => this.converterDestinoLive(d, i + 1));

                this.state.dataSnapshot = new Date().toISOString().split('T')[0];
                this.state.destinosFiltrados = [...this.state.destinos];
                this.renderizar();
            } else {
                this.mostrarVazio('Nenhum destino disponível no momento. Tente novamente mais tarde.');
            }
        } catch (error) {
            console.error('❌ Erro na busca ao vivo:', error);
            this.mostrarVazio('Erro ao buscar destinos. Tente novamente em alguns instantes.');
        }
    },

    converterDestinoLive(dest, posicao) {
        const nome = (dest.name || '').toLowerCase();
        const estilos = [];
        const praiaKw = ['beach', 'praia', 'litoral', 'natal', 'maceió', 'florianópolis', 'cancún', 'punta cana'];
        const natKw = ['serra', 'chapada', 'bonito', 'foz', 'monte verde'];
        if (praiaKw.some(k => nome.includes(k))) estilos.push('praia');
        if (natKw.some(k => nome.includes(k))) estilos.push('natureza');
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
    // RENDERIZAR TUDO
    // ============================================================
    renderizar() {
        this.atualizarHero();
        this.renderizarStats();
        this.renderizarCards();
        this.atualizarContagem();

        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('destinations-section').style.display = 'block';
        document.getElementById('cta-section').style.display = 'block';
        document.getElementById('share-fab').style.display = 'flex';
    },

    // ============================================================
    // ATUALIZAR HERO
    // ============================================================
    atualizarHero() {
        document.getElementById('hero-city').textContent = this.state.origemNome;
        document.title = `Destinos Baratos Saindo de ${this.state.origemNome} Hoje | Benetrip`;

        if (this.state.dataSnapshot) {
            const dataObj = new Date(this.state.dataSnapshot + 'T12:00:00');
            const hoje = new Date();
            hoje.setHours(12, 0, 0, 0);

            const diffDias = Math.round((hoje - dataObj) / (1000 * 60 * 60 * 24));

            if (diffDias === 0) {
                document.getElementById('hero-update-text').textContent = 'Atualizado hoje';
            } else if (diffDias === 1) {
                document.getElementById('hero-update-text').textContent = 'Atualizado ontem';
            } else {
                document.getElementById('hero-update-text').textContent = `Atualizado há ${diffDias} dias`;
            }
        }
    },

    // ============================================================
    // RENDERIZAR STATS
    // ============================================================
    renderizarStats() {
        const destinos = this.state.destinos;
        if (destinos.length === 0) return;

        const maisBarato = destinos[0];
        const precos = destinos.filter(d => d.preco > 0).map(d => d.preco);
        const media = precos.length > 0 ? Math.round(precos.reduce((a, b) => a + b, 0) / precos.length) : 0;
        const nacionais = destinos.filter(d => !d.internacional).length;
        const internacionais = destinos.filter(d => d.internacional).length;

        const statsBar = document.getElementById('stats-bar');
        statsBar.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Mais barato</div>
                <div class="stat-value">R$ ${this.formatarPreco(maisBarato.preco)}</div>
                <div class="stat-detail">${maisBarato.nome}</div>
                ${this.renderVariacao(maisBarato.variacao)}
            </div>
            <div class="stat-card">
                <div class="stat-label">Preço médio</div>
                <div class="stat-value">R$ ${this.formatarPreco(media)}</div>
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
    // RENDERIZAR CARDS
    // ============================================================
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
            card.addEventListener('click', () => {
                const aeroporto = card.dataset.aeroporto;
                const nome = card.dataset.nome;
                const duracao = card.dataset.duracao;
                const destino = aeroporto || nome;
                if (destino) {
                    const params = new URLSearchParams({
                        origem: this.state.origemAtual,
                        destino: destino,
                        nome: nome,
                    });
                    if (duracao) params.set('duracao', duracao);
                    window.location.href = `/voos-baratos?${params.toString()}`;
                }
            });
        });
    },

    // ============================================================
    // RENDER DE UM CARD
    // ============================================================
    renderCard(d) {
        const imgSrc = d.imagem || 'assets/images/tripinha/avatar-pensando.png';
        const estilosTags = (d.estilos || []).map(e =>
            `<span class="dest-tag">${this.capitalize(e)}</span>`
        ).join('');

        const variacaoHtml = d.variacao ? this.renderVariacaoInline(d.variacao) : '';

        const duracaoTexto = d.duracao_ideal
            ? `<strong>${d.duracao_ideal.min}-${d.duracao_ideal.max}</strong> dias`
            : '';

        const duracaoIdeal = d.duracao_ideal ? d.duracao_ideal.ideal : '';

        return `
            <article class="dest-card" data-aeroporto="${d.aeroporto}" data-nome="${d.nome}" data-duracao="${duracaoIdeal}">
                <div class="dest-card-inner">
                    <div class="dest-image-wrapper">
                        <img class="dest-image" src="${imgSrc}" alt="${d.nome}"
                             loading="lazy"
                             onerror="this.src='assets/images/tripinha/avatar-pensando.png'">
                        <span class="dest-rank">${d.posicao}</span>
                        ${d.internacional ? '<span class="dest-badge-international">Internacional</span>' : ''}
                    </div>
                    <div class="dest-info">
                        <div class="dest-header">
                            <h3 class="dest-name">${d.nome}</h3>
                            <p class="dest-country">${d.pais}${d.paradas > 0 ? ` · ${d.paradas} parada${d.paradas > 1 ? 's' : ''}` : ' · Direto'}</p>
                        </div>
                        <div class="dest-tags">${estilosTags}</div>
                        <div class="dest-footer">
                            <div class="dest-price-block">
                                <span class="dest-price-label">A partir de</span>
                                <span class="dest-price">R$ ${this.formatarPreco(d.preco)}</span>
                                ${variacaoHtml}
                            </div>
                            <div class="dest-duration">
                                ${duracaoTexto}
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        `;
    },

    // ============================================================
    // VARIAÇÃO DE PREÇO
    // ============================================================
    renderVariacao(variacao) {
        if (!variacao) return '';
        const { direcao, percentual } = variacao;
        if (direcao === 'desceu') {
            return `<div class="stat-variation down">↓ ${Math.abs(percentual)}% vs ontem</div>`;
        }
        if (direcao === 'subiu') {
            return `<div class="stat-variation up">↑ ${Math.abs(percentual)}% vs ontem</div>`;
        }
        return `<div class="stat-variation stable">→ Estável</div>`;
    },

    renderVariacaoInline(variacao) {
        if (!variacao) return '';
        const { direcao, diferenca } = variacao;
        if (direcao === 'desceu') {
            return `<span class="dest-price-variation down">↓ R$ ${Math.abs(diferenca)} vs ontem</span>`;
        }
        if (direcao === 'subiu') {
            return `<span class="dest-price-variation up">↑ R$ ${Math.abs(diferenca)} vs ontem</span>`;
        }
        return '';
    },

    // ============================================================
    // CONTAGEM
    // ============================================================
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
            document.getElementById('section-title').textContent =
                `Top Destinos Saindo de ${this.state.origemNome}`;
        } else {
            const partes = [];
            if (estilos.length > 0) partes.push(estilos.map(e => this.capitalize(e)).join(' + '));
            if (escopo) partes.push(this.capitalize(escopo));
            if (precoMax) partes.push(`Até R$ ${this.formatarPreco(precoMax)}`);
            document.getElementById('section-title').textContent = partes.join(' · ');
        }
    },

    // ============================================================
    // LOADING / VAZIO
    // ============================================================
    mostrarLoading() {
        document.getElementById('loading-state').style.display = 'block';
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('destinations-section').style.display = 'none';
        document.getElementById('cta-section').style.display = 'none';
        document.getElementById('share-fab').style.display = 'none';
    },

    mostrarVazio(mensagem) {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('destinations-section').style.display = 'none';
        document.getElementById('empty-message').textContent = mensagem;
        this.state.carregando = false;
    },

    // ============================================================
    // COMPARTILHAMENTO
    // ============================================================
    abrirShareModal() {
        const destinos = this.state.destinosFiltrados.slice(0, 5);
        if (destinos.length === 0) return;

        const mensagem = this.gerarMensagemShare(destinos);

        const overlay = document.createElement('div');
        overlay.className = 'share-overlay';
        overlay.innerHTML = `
            <div class="share-modal">
                <h3>Compartilhar Destinos</h3>
                <div class="share-buttons">
                    <button class="share-btn whatsapp" data-platform="whatsapp">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                    </button>
                    <button class="share-btn facebook" data-platform="facebook">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        Facebook
                    </button>
                    <button class="share-btn twitter" data-platform="twitter">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        X
                    </button>
                    <button class="share-btn copy" data-platform="copy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg>
                        Copiar
                    </button>
                </div>
                <div class="share-preview">${this.escapeHtml(mensagem)}</div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        overlay.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.executarShare(btn.dataset.platform, mensagem);
                overlay.remove();
            });
        });
    },

    gerarMensagemShare(destinos) {
        const top = destinos.slice(0, 5);
        const linhas = top.map(d =>
            `${d.posicao}. ${d.nome} (${d.pais}) - R$ ${this.formatarPreco(d.preco)}`
        );

        return `✈️ Destinos baratos saindo de ${this.state.origemNome} hoje!\n\n` +
            linhas.join('\n') +
            `\n\n🐶 Atualizado diariamente pela Tripinha\n` +
            `🔗 https://benetrip.com.br/destinos-baratos`;
    },

    executarShare(platform, mensagem) {
        const url = 'https://benetrip.com.br/destinos-baratos?utm_source=share&utm_medium=' + platform;

        switch (platform) {
            case 'whatsapp':
                window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank');
                break;
            case 'facebook':
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
                break;
            case 'twitter': {
                const tweet = mensagem.length > 250 ? mensagem.substring(0, 247) + '...' : mensagem;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, '_blank');
                break;
            }
            case 'copy':
                navigator.clipboard.writeText(mensagem).then(() => {
                    this.mostrarToast('Link copiado!');
                });
                break;
        }
    },

    // ============================================================
    // UTILITÁRIOS
    // ============================================================
    formatarPreco(valor) {
        if (!valor) return '0';
        return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

    capitalize(str) {
        if (!str) return '';
        const map = { romantico: 'Casal', familia: 'Família', aventura: 'Aventura', praia: 'Praia', natureza: 'Natureza', cidade: 'Cidade' };
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

// ============================================================
// INICIALIZAR
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    DiscoveryPage.init();
});
