/**
 * BENETRIP - DESCOBRIR DESTINOS
 * Versão TRIPLE SEARCH v2 - Sem opção de transporte (apenas voos)
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
        this.log('🐕 Benetrip Discovery v2 (Triple Search) inicializando...');
        
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

    // Apenas condicional do número de pessoas (família/amigos)
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

    // Validação simplificada (sem transporte)
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

    // Coleta simplificada (sem tipoViagem/distância)
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
    // FLUXO PRINCIPAL DE BUSCA
    // ================================================================
    async buscarDestinos() {
        try {
            this.mostrarLoading();
            
            // PASSO 1: Triple Search (3 buscas paralelas no backend)
            this.atualizarProgresso(15, '🔍 Buscando destinos pelo mundo...');
            const destinosDisponiveis = await this.buscarDestinosAPI();
            
            if (!destinosDisponiveis || destinosDisponiveis.length === 0) {
                throw new Error('Nenhum destino encontrado');
            }
            
            // PASSO 2: Filtrar por orçamento (com cenários)
            this.atualizarProgresso(40, '💰 Filtrando pelo seu orçamento...');
            const filtro = this.filtrarDestinos(destinosDisponiveis);
            
            // CENÁRIO 4: Nenhum destino encontrado
            if (filtro.cenario === 'nenhum') {
                this.atualizarProgresso(100, '😕 Nenhum destino encontrado...');
                await this.delay(500);
                this.mostrarSemResultados();
                return;
            }

            const destinosParaRanking = filtro.destinos;
            this.log(`📋 Cenário: ${filtro.cenario} | ${destinosParaRanking.length} destinos para ranking`);
            
            // PASSO 3: LLM ranqueia
            this.atualizarProgresso(60, '🤖 Tripinha selecionando os melhores...');
            const ranking = await this.ranquearDestinosAPI(destinosParaRanking);
            
            // PASSO 4: Gerar links de afiliado
            this.atualizarProgresso(80, '✈️ Gerando links de reserva...');
            const destinosComLinks = this.gerarLinksTravelpayouts(ranking);
            
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

        // Log metadados do triple search
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
    // 1. IDEAL:  5+ destinos na faixa 80-100% → sem mensagem
    // 2. BOM:    destinos na faixa 60-100%    → mensagem suave
    // 3. ABAIXO: só destinos abaixo de 60%    → mensagem sobre opções baratas
    // 4. NENHUM: 0 destinos com preço         → tela de erro
    // ================================================================
    filtrarDestinos(destinos) {
        const { orcamento, moeda } = this.state.formData;
        const simbolo = { 'BRL': 'R$', 'USD': '$', 'EUR': '€' }[moeda] || 'R$';

        // Todos os destinos com preço válido
        const comPreco = destinos.filter(d => (d.flight?.price || 0) > 0);
        
        if (comPreco.length === 0) {
            this.log('❌ Nenhum destino com preço disponível');
            return { cenario: 'nenhum', destinos: [], mensagem: '' };
        }

        if (!orcamento) {
            return { cenario: 'ideal', destinos: comPreco, mensagem: '' };
        }

        // Faixa ideal: 80-100% do orçamento
        const faixa80 = comPreco.filter(d => d.flight.price >= orcamento * 0.8 && d.flight.price <= orcamento);
        
        if (faixa80.length >= 5) {
            this.log(`✅ IDEAL: ${faixa80.length} destinos na faixa 80-100%`);
            return { cenario: 'ideal', destinos: faixa80, mensagem: '' };
        }

        // Faixa expandida: 60-100% do orçamento
        const faixa60 = comPreco.filter(d => d.flight.price >= orcamento * 0.6 && d.flight.price <= orcamento);
        
        if (faixa60.length >= 3) {
            this.log(`👍 BOM: ${faixa60.length} destinos na faixa 60-100%`);
            return {
                cenario: 'bom',
                destinos: faixa60,
                mensagem: `🐕 A Tripinha encontrou os melhores destinos dentro do seu orçamento de ${simbolo} ${orcamento.toLocaleString('pt-BR')}. Confira as opções!`
            };
        }

        // Abaixo do orçamento: destinos até 100% mas abaixo de 60%
        const abaixo = comPreco.filter(d => d.flight.price <= orcamento);
        
        if (abaixo.length >= 3) {
            this.log(`💡 ABAIXO: ${abaixo.length} destinos abaixo do orçamento`);
            return {
                cenario: 'abaixo',
                destinos: abaixo,
                mensagem: `🐕 Não encontrei muitas opções próximas ao seu orçamento de ${simbolo} ${orcamento.toLocaleString('pt-BR')}, mas achei destinos mais em conta que podem te interessar!`
            };
        }

        // Último recurso: qualquer destino com preço (pode estar acima)
        if (comPreco.length >= 3) {
            this.log(`⚠️ FORA: destinos disponíveis mas fora do orçamento`);
            return {
                cenario: 'abaixo',
                destinos: comPreco.slice(0, 30), // limitar para não sobrecarregar LLM
                mensagem: `🐕 Os destinos disponíveis estão fora da faixa de ${simbolo} ${orcamento.toLocaleString('pt-BR')}. Mostrando as opções mais próximas do seu orçamento.`
            };
        }

        // Realmente nenhum destino viável
        this.log('❌ Pouquíssimos destinos disponíveis');
        return { cenario: 'nenhum', destinos: [], mensagem: '' };
    },

    calcularNoites(dataIda, dataVolta) {
        const ida = new Date(dataIda);
        const volta = new Date(dataVolta);
        return Math.ceil((volta - ida) / (1000 * 60 * 60 * 24));
    },

    // ================================================================
    // CHAMADA API: rank-destinations (contexto rico)
    // ================================================================
    async ranquearDestinosAPI(destinos) {
        const COMPANHIA_MAP = {
            0: 'Viajando sozinho(a)',
            1: 'Viagem romântica (casal)',
            2: 'Viagem em família',
            3: 'Viagem com amigos'
        };
        const PREFERENCIAS_MAP = {
            'relax': 'Relaxamento, praias, descanso e natureza tranquila',
            'aventura': 'Aventura, trilhas, esportes radicais e natureza selvagem',
            'cultura': 'Cultura, museus, história, gastronomia e arquitetura',
            'urbano': 'Agito urbano, vida noturna, compras e experiências cosmopolitas'
        };

        const noites = this.calcularNoites(this.state.formData.dataIda, this.state.formData.dataVolta);

        const response = await fetch('/api/rank-destinations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destinos: destinos,
                preferencias: PREFERENCIAS_MAP[this.state.formData.preferencias] || this.state.formData.preferencias,
                companhia: COMPANHIA_MAP[this.state.formData.companhia] || 'Não informado',
                numPessoas: this.state.formData.numPessoas,
                noites: noites,
                orcamento: this.state.formData.orcamento
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
            surpresa: { ...ranking.surpresa, link: gerarLink(ranking.surpresa) }
        };
    },

    mostrarLoading() {
        document.getElementById('form-container').style.display = 'none';
        document.getElementById('loading-container').style.display = 'block';
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

    formatarPreco(valor, moeda) {
        const simbolos = { 'BRL': 'R$', 'USD': '$', 'EUR': '€' };
        const simbolo = simbolos[moeda] || 'R$';
        return `${simbolo} ${Math.round(valor).toLocaleString('pt-BR')}`;
    },

    // ================================================================
    // TELA: Nenhum destino encontrado
    // ================================================================
    mostrarSemResultados() {
        const container = document.getElementById('resultados-container');
        const { orcamento, moeda, origem } = this.state.formData;
        const simbolo = { 'BRL': 'R$', 'USD': '$', 'EUR': '€' }[moeda] || 'R$';

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
                <button class="btn-submit btn-tentar-novamente" onclick="location.reload()">
                    🔄 Tentar Novamente
                </button>
            </div>
        `;

        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ================================================================
    // RESULTADOS com badges de confiabilidade + banner de cenário
    // ================================================================
    mostrarResultados(destinos, cenario, mensagem) {
        const container = document.getElementById('resultados-container');
        const { dataIda, dataVolta, preferencias, moeda } = this.state.formData;
        const noites = this.calcularNoites(dataIda, dataVolta);
        
        const dataIdaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR');
        const dataVoltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR');
        
        const formatPreco = (d) => this.formatarPreco(d.flight?.price || 0, moeda);
        
        const formatParadas = (d) => {
            const stops = d.flight?.stops || 0;
            if (stops === 0) return 'Direto';
            if (stops === 1) return '1 parada';
            return `${stops} paradas`;
        };

        const fonteBadge = (d) => {
            const count = d._source_count || 1;
            if (count >= 3) return '<span class="fonte-badge fonte-alta" title="Encontrado em 3 buscas diferentes">⭐ Alta confiança</span>';
            if (count >= 2) return '<span class="fonte-badge fonte-media" title="Encontrado em 2 buscas diferentes">✓ Confirmado</span>';
            return '';
        };

        const html = `
            <div class="resultado-header">
                <h1>${cenario === 'ideal' ? '🎉 Destinos Perfeitos!' : '✈️ Destinos Encontrados!'}</h1>
                <p>Baseado em: ${preferencias} | ${dataIdaBR} - ${dataVoltaBR} (${noites} noites)</p>
            </div>

            ${mensagem ? `
            <div class="resultado-banner ${cenario === 'abaixo' ? 'banner-aviso' : 'banner-info'}">
                <p>${mensagem}</p>
            </div>
            ` : ''}

            <div class="top-destino">
                <div class="badge">🏆 MELHOR DESTINO</div>
                ${fonteBadge(destinos.top_destino)}
                <h2>${destinos.top_destino.name}, ${destinos.top_destino.country || ''}</h2>
                <div class="preco">${formatPreco(destinos.top_destino)}</div>
                <div class="preco-label">Passagem ida e volta por pessoa</div>
                <div class="flight-info">${formatParadas(destinos.top_destino)}</div>
                <div class="descricao">${destinos.top_destino.razao || 'Perfeito para você!'}</div>
                <a href="${destinos.top_destino.link}" target="_blank" class="btn-ver-voos">Ver Passagens ✈️</a>
            </div>

            <div class="alternativas-section">
                <h3>📋 Outras Opções</h3>
                <div class="alternativas-grid">
                    ${destinos.alternativas.map(d => `
                        <div class="destino-card">
                            ${fonteBadge(d)}
                            <h4>${d.name}${d.country ? ', ' + d.country : ''}</h4>
                            <div class="preco">${formatPreco(d)}</div>
                            <div class="preco-label">ida e volta</div>
                            <div class="flight-info">${formatParadas(d)}</div>
                            <div class="descricao">${d.razao || 'Boa opção!'}</div>
                            <a href="${d.link}" target="_blank" class="btn-ver-voos">Ver Passagens →</a>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="surpresa-card">
                <div class="badge">🎁 SURPRESA</div>
                ${fonteBadge(destinos.surpresa)}
                <h3>${destinos.surpresa.name}${destinos.surpresa.country ? ', ' + destinos.surpresa.country : ''}</h3>
                <div class="preco">${formatPreco(destinos.surpresa)}</div>
                <div class="preco-label">ida e volta por pessoa</div>
                <div class="flight-info">${formatParadas(destinos.surpresa)}</div>
                <div class="descricao">${destinos.surpresa.razao || 'Descubra!'}</div>
                <a href="${destinos.surpresa.link}" target="_blank" class="btn-ver-voos">Descobrir ✈️</a>
            </div>
        `;
        
        container.innerHTML = html;
        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

document.addEventListener('DOMContentLoaded', () => BenetripDiscovery.init());
