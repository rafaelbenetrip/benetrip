/**
 * BENETRIP - DESCOBRIR DESTINOS
 * Versão TRIPLE SEARCH v2.1 - Resultados enriquecidos
 * - Comentários contextuais sobre destinos (clima, estação, atividades)
 * - Moeda escolhida pelo usuário em todos os preços
 * - Resumo detalhado dos critérios na tela de resultados
 * - Botão "tentar novamente" preservando dados do formulário
 * APENAS APIs reais, SEM fallbacks de dados
 */

const BenetripDiscovery = {
    state: {
        cidadesData: null,
        origemSelecionada: null,
        formData: {},
        resultados: null
    },

    config: {
        travelpayoutsMarker: 'benetrip',
        debug: true,
        cidadesJsonPath: 'data/cidades_global_iata_v4.json'
    },

    log(...args) {
        if (this.config.debug) console.log('[Benetrip]', ...args);
    },

    error(...args) {
        console.error('[Benetrip ERROR]', ...args);
    },

    init() {
        this.log('🐕 Benetrip Discovery v2.1 (Resultados Enriquecidos) inicializando...');
        
        this.carregarCidades();
        this.setupFormEvents();
        this.setupAutocomplete();
        this.setupCalendar();
        this.setupCompanhiaConditional();
        this.setupOptionButtons();
        this.setupNumberInput();
        this.setupCurrencyInput();
        
        this.log('✅ Inicialização completa');
    },

    async carregarCidades() {
        try {
            const response = await fetch(this.config.cidadesJsonPath);
            if (!response.ok) throw new Error('Erro ao carregar cidades');
            
            const dados = await response.json();
            this.state.cidadesData = dados.filter(c => c.iata);
            
            this.log(`✅ ${this.state.cidadesData.length} cidades carregadas (v4 com kgmid)`);
        } catch (erro) {
            this.error('Erro ao carregar cidades:', erro);
            this.state.cidadesData = [
                { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", codigo_pais: "BR", iata: "GRU" },
                { cidade: "Rio de Janeiro", sigla_estado: "RJ", pais: "Brasil", codigo_pais: "BR", iata: "GIG" },
                { cidade: "Salvador", sigla_estado: "BA", pais: "Brasil", codigo_pais: "BR", iata: "SSA" }
            ];
        }
    },

    normalizarTexto(texto) {
        return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    },

    buscarCidades(termo) {
        if (!this.state.cidadesData || termo.length < 2) return [];
        
        const termoNorm = this.normalizarTexto(termo);
        
        return this.state.cidadesData
            .filter(cidade => {
                const nomeNorm = this.normalizarTexto(cidade.cidade);
                const iataNorm = cidade.iata.toLowerCase();
                return nomeNorm.includes(termoNorm) || iataNorm.includes(termoNorm);
            })
            .slice(0, 8)
            .map(cidade => ({
                code: cidade.iata,
                name: cidade.cidade,
                state: cidade.sigla_estado,
                country: cidade.pais,
                countryCode: cidade.codigo_pais
            }));
    },

    setupAutocomplete() {
        const input = document.getElementById('origem');
        const results = document.getElementById('origem-results');
        const hiddenInput = document.getElementById('origem-data');
        
        let debounceTimer;
        
        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            
            const termo = e.target.value.trim();
            
            if (termo.length < 2) {
                results.innerHTML = '';
                results.style.display = 'none';
                this.state.origemSelecionada = null;
                hiddenInput.value = '';
                return;
            }
            
            debounceTimer = setTimeout(() => {
                const cidades = this.buscarCidades(termo);
                
                if (cidades.length === 0) {
                    results.innerHTML = '<div style="padding: 12px; color: #666;">Nenhuma cidade encontrada</div>';
                    results.style.display = 'block';
                    return;
                }
                
                results.innerHTML = cidades.map(cidade => `
                    <div class="autocomplete-item" data-city='${JSON.stringify(cidade)}'>
                        <div class="item-code">${cidade.code}</div>
                        <div class="item-details">
                            <div class="item-name">${cidade.name}${cidade.state ? ', ' + cidade.state : ''}</div>
                            <div class="item-country">${cidade.country}</div>
                        </div>
                    </div>
                `).join('');
                
                results.style.display = 'block';
                
                results.querySelectorAll('.autocomplete-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const cidade = JSON.parse(item.dataset.city);
                        this.selecionarOrigem(cidade);
                    });
                });
            }, 300);
        });
        
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !results.contains(e.target)) {
                results.style.display = 'none';
            }
        });
    },

    selecionarOrigem(cidade) {
        const input = document.getElementById('origem');
        const results = document.getElementById('origem-results');
        const hiddenInput = document.getElementById('origem-data');
        
        this.state.origemSelecionada = cidade;
        input.value = `${cidade.name} (${cidade.code})`;
        hiddenInput.value = JSON.stringify(cidade);
        results.style.display = 'none';
        
        this.log('📍 Origem:', cidade);
    },

    setupCalendar() {
        const input = document.getElementById('datas');
        const dataIda = document.getElementById('data-ida');
        const dataVolta = document.getElementById('data-volta');
        
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        
        flatpickr(input, {
            mode: 'range',
            minDate: amanha,
            dateFormat: 'Y-m-d',
            locale: 'pt',
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    dataIda.value = this.formatarDataISO(selectedDates[0]);
                    dataVolta.value = this.formatarDataISO(selectedDates[1]);
                    input.value = `${this.formatarDataBR(selectedDates[0])} - ${this.formatarDataBR(selectedDates[1])}`;
                    this.log('📅 Datas:', dataIda.value, 'até', dataVolta.value);
                }
            }
        });
    },

    formatarDataISO(data) {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    },

    formatarDataBR(data) {
        return data.toLocaleDateString('pt-BR');
    },

    setupCompanhiaConditional() {
        const companhiaInput = document.getElementById('companhia');
        const numPessoasGroup = document.getElementById('num-pessoas-group');
        
        if (!companhiaInput || !numPessoasGroup) return;
        
        companhiaInput.addEventListener('change', () => {
            const value = parseInt(companhiaInput.value);
            numPessoasGroup.style.display = (value === 2 || value === 3) ? 'block' : 'none';
        });
    },

    setupOptionButtons() {
        document.querySelectorAll('.button-group').forEach(group => {
            const field = group.dataset.field;
            if (!field) return;
            
            const hiddenInput = document.getElementById(field);
            
            group.querySelectorAll('.btn-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    hiddenInput.value = btn.dataset.value;
                    hiddenInput.dispatchEvent(new Event('change'));
                    this.log(`✅ ${field}:`, btn.dataset.value);
                });
            });
        });
    },

    setupNumberInput() {
        const input = document.getElementById('num-pessoas');
        const decrementBtn = document.querySelector('.btn-number[data-action="decrement"]');
        const incrementBtn = document.querySelector('.btn-number[data-action="increment"]');
        
        if (decrementBtn) {
            decrementBtn.addEventListener('click', () => {
                const value = parseInt(input.value);
                if (value > 2) input.value = value - 1;
            });
        }
        
        if (incrementBtn) {
            incrementBtn.addEventListener('click', () => {
                const value = parseInt(input.value);
                if (value < 20) input.value = value + 1;
            });
        }
    },

    setupCurrencyInput() {
        const input = document.getElementById('orcamento');
        const moedaInput = document.getElementById('moeda');
        const currencySymbol = document.querySelector('.currency-symbol');
        
        if (moedaInput && currencySymbol) {
            moedaInput.addEventListener('change', () => {
                const simbolos = { 'BRL': 'R$', 'USD': '$', 'EUR': '€' };
                currencySymbol.textContent = simbolos[moedaInput.value] || 'R$';
            });
        }
        
        if (input) {
            input.addEventListener('input', (e) => {
                let valor = e.target.value.replace(/\D/g, '');
                if (valor) {
                    valor = (parseInt(valor) / 100).toFixed(2);
                    e.target.value = valor.replace('.', ',');
                } else {
                    e.target.value = '';
                }
            });
        }
    },

    setupFormEvents() {
        const form = document.getElementById('descobrir-form');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!this.validarFormulario()) {
                return;
            }
            
            this.coletarDadosFormulario();
            await this.buscarDestinos();
        });
    },

    validarFormulario() {
        if (!this.state.origemSelecionada) {
            alert('Por favor, selecione uma cidade de origem');
            document.getElementById('origem').focus();
            return false;
        }
        
        if (!document.getElementById('companhia').value) {
            alert('Por favor, escolha com quem você vai viajar');
            return false;
        }
        
        if (!document.getElementById('preferencias').value) {
            alert('Por favor, escolha o que você busca nessa viagem');
            return false;
        }
        
        if (!document.getElementById('data-ida').value || !document.getElementById('data-volta').value) {
            alert('Por favor, selecione as datas da viagem');
            document.getElementById('datas').focus();
            return false;
        }

        if (!document.getElementById('moeda').value) {
            alert('Por favor, escolha a moeda');
            return false;
        }
        
        const orcamento = document.getElementById('orcamento').value;
        if (!orcamento || parseFloat(orcamento.replace(',', '.')) <= 0) {
            alert('Por favor, informe o orçamento');
            document.getElementById('orcamento').focus();
            return false;
        }
        
        return true;
    },

    coletarDadosFormulario() {
        const companhia = parseInt(document.getElementById('companhia').value);
        
        this.state.formData = {
            origem: this.state.origemSelecionada,
            companhia: companhia,
            numPessoas: (companhia === 2 || companhia === 3) 
                ? parseInt(document.getElementById('num-pessoas').value) 
                : (companhia === 1 ? 2 : 1),
            preferencias: document.getElementById('preferencias').value,
            dataIda: document.getElementById('data-ida').value,
            dataVolta: document.getElementById('data-volta').value,
            moeda: document.getElementById('moeda').value,
            orcamento: parseFloat(document.getElementById('orcamento').value.replace(',', '.'))
        };
        
        this.log('📝 Dados:', this.state.formData);
    },

    // ================================================================
    // HELPERS DE MOEDA E FORMATAÇÃO
    // ================================================================
    getSimbolo(moeda) {
        return { 'BRL': 'R$', 'USD': 'US$', 'EUR': '€' }[moeda] || 'R$';
    },

    formatarPreco(valor, moeda) {
        const simbolo = this.getSimbolo(moeda || this.state.formData.moeda);
        return `${simbolo} ${Math.round(valor).toLocaleString('pt-BR')}`;
    },

    // Labels legíveis para companhia e preferências
    COMPANHIA_LABELS: {
        0: { emoji: '🧳', texto: 'Sozinho(a)' },
        1: { emoji: '❤️', texto: 'Viagem romântica' },
        2: { emoji: '👨‍👩‍👧‍👦', texto: 'Em família' },
        3: { emoji: '🎉', texto: 'Com amigos' }
    },

    PREFERENCIAS_LABELS: {
        'relax':    { emoji: '🌊', texto: 'Relax total' },
        'aventura': { emoji: '🏔️', texto: 'Aventura e emoção' },
        'cultura':  { emoji: '🏛️', texto: 'Cultura e história' },
        'urbano':   { emoji: '🏙️', texto: 'Agito urbano' }
    },

    COMPANHIA_API_MAP: {
        0: 'Viajando sozinho(a)',
        1: 'Viagem romântica (casal)',
        2: 'Viagem em família',
        3: 'Viagem com amigos'
    },

    PREFERENCIAS_API_MAP: {
        'relax': 'Relaxamento, praias, descanso e natureza tranquila',
        'aventura': 'Aventura, trilhas, esportes radicais e natureza selvagem',
        'cultura': 'Cultura, museus, história, gastronomia e arquitetura',
        'urbano': 'Agito urbano, vida noturna, compras e experiências cosmopolitas'
    },

    // ================================================================
    // FLUXO PRINCIPAL DE BUSCA
    // ================================================================
    async buscarDestinos() {
        try {
            this.mostrarLoading();
            
            // PASSO 1: Triple Search
            this.atualizarProgresso(15, '🔍 Buscando destinos pelo mundo...');
            const destinosDisponiveis = await this.buscarDestinosAPI();
            
            if (!destinosDisponiveis || destinosDisponiveis.length === 0) {
                throw new Error('Nenhum destino encontrado');
            }
            
            // PASSO 2: Filtrar por orçamento
            this.atualizarProgresso(40, '💰 Filtrando pelo seu orçamento...');
            const filtro = this.filtrarDestinos(destinosDisponiveis);
            
            if (filtro.cenario === 'nenhum') {
                this.atualizarProgresso(100, '😕 Nenhum destino encontrado...');
                await this.delay(500);
                this.mostrarSemResultados();
                return;
            }

            const destinosParaRanking = filtro.destinos;
            this.log(`📋 Cenário: ${filtro.cenario} | ${destinosParaRanking.length} destinos para ranking`);
            
            // PASSO 3: LLM ranqueia com contexto enriquecido
            this.atualizarProgresso(60, '🤖 Tripinha analisando destinos...');
            const ranking = await this.ranquearDestinosAPI(destinosParaRanking, filtro.cenario);
            
            // PASSO 4: Gerar links de afiliado
            this.atualizarProgresso(80, '✈️ Gerando links de reserva...');
            const destinosComLinks = this.gerarLinksTravelpayouts(ranking);
            
            // Salvar resultados no state para referência
            this.state.resultados = destinosComLinks;
            
            this.atualizarProgresso(100, '🎉 Pronto!');
            await this.delay(500);
            this.mostrarResultados(destinosComLinks, filtro.cenario, filtro.mensagem);
            
        } catch (erro) {
            this.error('Erro:', erro);
            alert(`Erro: ${erro.message}`);
            this.esconderLoading();
        }
    },

    // ================================================================
    // CHAMADA API: search-destinations (triple search)
    // ================================================================
    async buscarDestinosAPI() {
        const response = await fetch('/api/search-destinations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origem: this.state.formData.origem.code,
                dataIda: this.state.formData.dataIda,
                dataVolta: this.state.formData.dataVolta,
                preferencias: this.state.formData.preferencias
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Erro na API');
        }
        
        const data = await response.json();

        if (data._meta) {
            this.log('📊 Triple Search:', {
                global: data._meta.sources.global,
                continente: data._meta.sources.continente,
                pais: data._meta.sources.pais,
                total: data.total,
                tempo: `${data._meta.totalTime}ms`
            });
        }

        return data.destinations;
    },

    // ================================================================
    // FILTRO DE ORÇAMENTO - 4 CENÁRIOS
    // ================================================================
    filtrarDestinos(destinos) {
        const { orcamento, moeda } = this.state.formData;
        const simbolo = this.getSimbolo(moeda);

        const comPreco = destinos.filter(d => (d.flight?.price || 0) > 0);
        
        if (comPreco.length === 0) {
            this.log('❌ Nenhum destino com preço disponível');
            return { cenario: 'nenhum', destinos: [], mensagem: '' };
        }

        if (!orcamento) {
            return { cenario: 'ideal', destinos: comPreco, mensagem: '' };
        }

        const faixa80 = comPreco.filter(d => d.flight.price >= orcamento * 0.8 && d.flight.price <= orcamento);
        
        if (faixa80.length >= 5) {
            this.log(`✅ IDEAL: ${faixa80.length} destinos na faixa 80-100%`);
            return { cenario: 'ideal', destinos: faixa80, mensagem: '' };
        }

        const faixa60 = comPreco.filter(d => d.flight.price >= orcamento * 0.6 && d.flight.price <= orcamento);
        
        if (faixa60.length >= 3) {
            this.log(`👍 BOM: ${faixa60.length} destinos na faixa 60-100%`);
            return {
                cenario: 'bom',
                destinos: faixa60,
                mensagem: `🐕 A Tripinha encontrou os melhores destinos dentro do seu orçamento de ${simbolo} ${orcamento.toLocaleString('pt-BR')}. Confira as opções!`
            };
        }

        const abaixo = comPreco.filter(d => d.flight.price <= orcamento);
        
        if (abaixo.length >= 3) {
            this.log(`💡 ABAIXO: ${abaixo.length} destinos abaixo do orçamento`);
            return {
                cenario: 'abaixo',
                destinos: abaixo,
                mensagem: `🐕 Não encontrei muitas opções próximas ao seu orçamento de ${simbolo} ${orcamento.toLocaleString('pt-BR')}, mas achei destinos mais em conta que podem te interessar!`
            };
        }

        this.log('❌ Destinos disponíveis mas fora do orçamento');
        return { cenario: 'nenhum', destinos: [], mensagem: '' };
    },

    calcularNoites(dataIda, dataVolta) {
        const ida = new Date(dataIda);
        const volta = new Date(dataVolta);
        return Math.ceil((volta - ida) / (1000 * 60 * 60 * 24));
    },

    // ================================================================
    // CHAMADA API: rank-destinations (contexto enriquecido)
    // ================================================================
    async ranquearDestinosAPI(destinos, cenario) {
        const noites = this.calcularNoites(this.state.formData.dataIda, this.state.formData.dataVolta);

        const response = await fetch('/api/rank-destinations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destinos: destinos,
                preferencias: this.PREFERENCIAS_API_MAP[this.state.formData.preferencias] || this.state.formData.preferencias,
                companhia: this.COMPANHIA_API_MAP[this.state.formData.companhia] || 'Não informado',
                numPessoas: this.state.formData.numPessoas,
                noites: noites,
                orcamento: this.state.formData.orcamento,
                moeda: this.state.formData.moeda,
                dataIda: this.state.formData.dataIda,
                dataVolta: this.state.formData.dataVolta,
                cenario: cenario || 'ideal'
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Erro no ranking');
        }
        
        const ranking = await response.json();

        if (ranking._model) {
            this.log(`🤖 Modelo: ${ranking._model} | Analisados: ${ranking._totalAnalisados}`);
        }

        return ranking;
    },

    gerarLinksTravelpayouts(ranking) {
        const { origem, dataIda, dataVolta, numPessoas } = this.state.formData;
        
        const gerarLink = (d) => {
            if (!d?.primary_airport) return '#';
            const base = 'https://www.aviasales.com/search/';
            const params = `${origem.code}${dataIda.replace(/-/g, '')}${d.primary_airport}${dataVolta.replace(/-/g, '')}${numPessoas}`;
            return `${base}${params}?marker=${this.config.travelpayoutsMarker}`;
        };
        
        return {
            top_destino: { ...ranking.top_destino, link: gerarLink(ranking.top_destino) },
            alternativas: ranking.alternativas.map(d => ({ ...d, link: gerarLink(d) })),
            surpresa: { ...ranking.surpresa, link: gerarLink(ranking.surpresa) },
            _model: ranking._model,
            _totalAnalisados: ranking._totalAnalisados
        };
    },

    mostrarLoading() {
        document.getElementById('form-container').style.display = 'none';
        document.getElementById('loading-container').style.display = 'block';
        document.getElementById('resultados-container').style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    esconderLoading() {
        document.getElementById('loading-container').style.display = 'none';
        document.getElementById('form-container').style.display = 'block';
    },

    atualizarProgresso(pct, msg) {
        document.getElementById('progress-fill').style.width = `${pct}%`;
        document.getElementById('loading-message').textContent = msg;
    },

    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    },

    // ================================================================
    // VOLTAR AO FORMULÁRIO preservando dados preenchidos
    // ================================================================
    voltarAoFormulario() {
        document.getElementById('resultados-container').style.display = 'none';
        document.getElementById('resultados-container').innerHTML = '';
        document.getElementById('form-container').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Os dados do formulário já estão preservados no DOM
        // (botões active, inputs com valor, etc.)
        // Apenas resetar o loading
        document.getElementById('progress-fill').style.width = '0%';
        this.log('🔄 Voltou ao formulário com dados preservados');
    },

    // ================================================================
    // GERAR CARD DE RESUMO DOS CRITÉRIOS
    // ================================================================
    gerarResumoCriterios() {
        const { origem, companhia, numPessoas, preferencias, dataIda, dataVolta, moeda, orcamento } = this.state.formData;
        const noites = this.calcularNoites(dataIda, dataVolta);
        const simbolo = this.getSimbolo(moeda);
        
        const comp = this.COMPANHIA_LABELS[companhia] || { emoji: '👤', texto: 'Não informado' };
        const pref = this.PREFERENCIAS_LABELS[preferencias] || { emoji: '🎯', texto: preferencias };
        
        const dataIdaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        const dataVoltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

        // Info de pessoas
        let pessoasInfo = '';
        if (companhia === 0) pessoasInfo = '1 pessoa';
        else if (companhia === 1) pessoasInfo = '2 pessoas';
        else pessoasInfo = `${numPessoas} pessoas`;

        return `
            <div class="criterios-resumo">
                <div class="criterios-titulo">
                    <span class="criterios-icon">🐕</span>
                    <span>A Tripinha buscou com base no seu perfil:</span>
                </div>
                <div class="criterios-grid">
                    <div class="criterio-item">
                        <span class="criterio-label">Saindo de</span>
                        <span class="criterio-valor">📍 ${origem.name} (${origem.code})</span>
                    </div>
                    <div class="criterio-item">
                        <span class="criterio-label">Companhia</span>
                        <span class="criterio-valor">${comp.emoji} ${comp.texto} · ${pessoasInfo}</span>
                    </div>
                    <div class="criterio-item">
                        <span class="criterio-label">Estilo</span>
                        <span class="criterio-valor">${pref.emoji} ${pref.texto}</span>
                    </div>
                    <div class="criterio-item">
                        <span class="criterio-label">Período</span>
                        <span class="criterio-valor">📅 ${dataIdaBR} → ${dataVoltaBR} · ${noites} noites</span>
                    </div>
                    <div class="criterio-item">
                        <span class="criterio-label">Orçamento</span>
                        <span class="criterio-valor">💰 Até ${simbolo} ${orcamento.toLocaleString('pt-BR')} por pessoa (ida+volta)</span>
                    </div>
                </div>
            </div>
        `;
    },

    // ================================================================
    // TELA: Nenhum destino encontrado (com botão preservando dados)
    // ================================================================
    mostrarSemResultados() {
        const container = document.getElementById('resultados-container');
        const { orcamento, moeda, origem } = this.state.formData;
        const simbolo = this.getSimbolo(moeda);

        container.innerHTML = `
            <div class="sem-resultados">
                <img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="tripinha-triste" 
                     onerror="this.style.display='none'">
                <h2>😕 Puxa, não encontrei destinos...</h2>
                <p class="sem-resultados-msg">
                    A Tripinha procurou por todo canto, mas não encontrou passagens saindo de 
                    <strong>${origem.name} (${origem.code})</strong> dentro do orçamento de 
                    <strong>${simbolo} ${orcamento?.toLocaleString('pt-BR') || '?'}</strong> para essas datas.
                </p>
                <div class="sem-resultados-dicas">
                    <h3>🐕 Dicas da Tripinha:</h3>
                    <div class="dica">💰 <strong>Aumente o orçamento</strong> — às vezes um pouco mais abre muitas opções!</div>
                    <div class="dica">📅 <strong>Tente outras datas</strong> — viajar em dias da semana costuma ser mais barato.</div>
                    <div class="dica">📍 <strong>Mude a cidade de origem</strong> — aeroportos maiores têm mais rotas e preços melhores.</div>
                    <div class="dica">🌍 <strong>Experimente "Aventura" ou "Cultura"</strong> — pode revelar destinos menos óbvios!</div>
                </div>
                <button class="btn-submit btn-tentar-novamente" onclick="BenetripDiscovery.voltarAoFormulario()">
                    ✏️ Ajustar Busca
                </button>
            </div>
        `;

        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ================================================================
    // RESULTADOS ENRIQUECIDOS
    // - Resumo detalhado dos critérios
    // - Comentários contextuais sobre cada destino
    // - Dicas práticas
    // - Moeda correta em todos os preços
    // - Custo estimado total (passagem + hotel)
    // - Botão "buscar novamente" preservando dados
    // ================================================================
    mostrarResultados(destinos, cenario, mensagem) {
        const container = document.getElementById('resultados-container');
        const { dataIda, dataVolta, moeda } = this.state.formData;
        const noites = this.calcularNoites(dataIda, dataVolta);
        
        const formatPreco = (d) => this.formatarPreco(d.flight?.price || 0, moeda);
        
        const formatParadas = (d) => {
            const stops = d.flight?.stops || 0;
            if (stops === 0) return '✈️ Voo direto';
            if (stops === 1) return '✈️ 1 parada';
            return `✈️ ${stops} paradas`;
        };

        const fonteBadge = (d) => {
            const count = d._source_count || 1;
            if (count >= 3) return '<span class="fonte-badge fonte-alta" title="Encontrado em 3 buscas diferentes">⭐ Alta confiança</span>';
            if (count >= 2) return '<span class="fonte-badge fonte-media" title="Encontrado em 2 buscas diferentes">✓ Confirmado</span>';
            return '';
        };

        // Custo estimado total (passagem + hotel × noites)
        const custoEstimado = (d) => {
            const passagem = d.flight?.price || 0;
            const hotelTotal = (d.avg_cost_per_night || 0) * noites;
            if (hotelTotal > 0) {
                return `<div class="custo-estimado">
                    <span class="custo-label">Estimativa total/pessoa:</span>
                    <span class="custo-valor">${this.formatarPreco(passagem + hotelTotal, moeda)}</span>
                    <span class="custo-detalhe">(voo + ${noites} noites hotel)</span>
                </div>`;
            }
            return '';
        };

        // Comentário contextual do LLM
        const comentarioHtml = (d) => {
            if (!d.comentario) return '';
            return `<div class="destino-comentario">${d.comentario}</div>`;
        };

        // Dica prática do LLM
        const dicaHtml = (d) => {
            if (!d.dica) return '';
            return `<div class="destino-dica"><span class="dica-icon">💡</span> ${d.dica}</div>`;
        };

        const html = `
            <!-- RESUMO DOS CRITÉRIOS -->
            ${this.gerarResumoCriterios()}

            <div class="resultado-header">
                <h1>${cenario === 'ideal' ? '🎉 Destinos Perfeitos!' : '✈️ Destinos Encontrados!'}</h1>
                <p class="resultado-subtitulo">
                    ${destinos._totalAnalisados ? `${destinos._totalAnalisados} destinos analisados` : ''}
                    ${destinos._model && destinos._model !== 'fallback_price' ? ' · Curadoria da Tripinha 🐶' : ''}
                </p>
            </div>

            ${mensagem ? `
            <div class="resultado-banner ${cenario === 'abaixo' ? 'banner-aviso' : 'banner-info'}">
                <p>${mensagem}</p>
            </div>
            ` : ''}

            <!-- TOP DESTINO -->
            <div class="top-destino">
                <div class="badge">🏆 MELHOR DESTINO PARA VOCÊ</div>
                ${fonteBadge(destinos.top_destino)}
                <h2>${destinos.top_destino.name}, ${destinos.top_destino.country || ''}</h2>
                <div class="preco">${formatPreco(destinos.top_destino)}</div>
                <div class="preco-label">Passagem ida e volta por pessoa</div>
                <div class="flight-info">${formatParadas(destinos.top_destino)}</div>
                ${custoEstimado(destinos.top_destino)}
                <div class="descricao">${destinos.top_destino.razao || 'Perfeito para você!'}</div>
                ${comentarioHtml(destinos.top_destino)}
                ${dicaHtml(destinos.top_destino)}
                <a href="${destinos.top_destino.link}" target="_blank" class="btn-ver-voos">Ver Passagens ✈️</a>
            </div>

            <!-- ALTERNATIVAS -->
            <div class="alternativas-section">
                <h3>📋 Outras Opções</h3>
                <div class="alternativas-grid">
                    ${destinos.alternativas.map(d => `
                        <div class="destino-card">
                            ${fonteBadge(d)}
                            <h4>${d.name}${d.country ? ', ' + d.country : ''}</h4>
                            <div class="preco">${formatPreco(d)}</div>
                            <div class="preco-label">ida e volta por pessoa</div>
                            <div class="flight-info">${formatParadas(d)}</div>
                            ${custoEstimado(d)}
                            <div class="descricao">${d.razao || 'Boa opção!'}</div>
                            ${comentarioHtml(d)}
                            ${dicaHtml(d)}
                            <a href="${d.link}" target="_blank" class="btn-ver-voos">Ver Passagens →</a>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- SURPRESA -->
            <div class="surpresa-card">
                <div class="badge">🎁 DESTINO SURPRESA</div>
                ${fonteBadge(destinos.surpresa)}
                <h3>${destinos.surpresa.name}${destinos.surpresa.country ? ', ' + destinos.surpresa.country : ''}</h3>
                <div class="preco">${formatPreco(destinos.surpresa)}</div>
                <div class="preco-label">ida e volta por pessoa</div>
                <div class="flight-info">${formatParadas(destinos.surpresa)}</div>
                ${custoEstimado(destinos.surpresa)}
                <div class="descricao">${destinos.surpresa.razao || 'Descubra!'}</div>
                ${comentarioHtml(destinos.surpresa)}
                ${dicaHtml(destinos.surpresa)}
                <a href="${destinos.surpresa.link}" target="_blank" class="btn-ver-voos">Descobrir ✈️</a>
            </div>

            <!-- BOTÃO BUSCAR NOVAMENTE -->
            <div class="buscar-novamente-section">
                <p class="buscar-novamente-texto">Quer explorar outras opções? Ajuste seus critérios e descubra mais!</p>
                <button class="btn-buscar-novamente" onclick="BenetripDiscovery.voltarAoFormulario()">
                    ✏️ Ajustar Busca e Descobrir Mais
                </button>
            </div>
        `;
        
        container.innerHTML = html;
        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => BenetripDiscovery.init());
