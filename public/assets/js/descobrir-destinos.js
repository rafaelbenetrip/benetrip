/**
 * BENETRIP - DESCOBRIR DESTINOS
 * Versão TRIPLE SEARCH v3.1.2
 * NOVIDADES v3.1.2:
 * - Campo de orçamento agora aceita valores inteiros com separador de milhar
 * - Sem centavos (,00) — mais intuitivo para o usuário
 * - Placeholder atualizado para "2.000"
 * NOVIDADES v3.1.1:
 * - Custo de hotel dividido pelo número de pessoas (quarto compartilhado)
 * - Texto explicativo mostra divisão quando viagem em grupo
 * NOVIDADES v3.1:
 * - Não repete destinos nos resultados
 * - Degrada graciosamente quando menos de 5 destinos disponíveis
 * - Mensagem informativa quando poucos resultados encontrados
 * - Esconde seção surpresa/alternativas quando não há dados
 * NOVIDADES v3.0:
 * - Família: adultos, crianças (2-11) e bebês (0-1) separados
 * - Links Benetrip Voos com passageiros detalhados (adultos/crianças/bebês)
 * - Filtro internacional: busca apenas destinos internacionais se solicitado
 * - Multi-select de preferências (1 ou mais estilos de viagem)
 * - Ranking LLM recebe info de crianças/bebês para sugestões adequadas
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
        debug: true,
        cidadesJsonPath: 'data/cidades_global_iata_v5.json'
    },

    log(...args) {
        if (this.config.debug) console.log('[Benetrip]', ...args);
    },

    error(...args) {
        console.error('[Benetrip ERROR]', ...args);
    },

    init() {
        this.log('🐕 Benetrip Discovery v3.1.2 inicializando...');
        
        this.carregarCidades();
        this.setupFormEvents();
        this.setupAutocomplete();
        this.setupCalendar();
        this.setupCompanhiaConditional();
        this.setupOptionButtons();
        this.setupNumberInput();
        this.setupFamiliaInputs();
        this.setupCurrencyInput();
        
        this.log('✅ Inicialização completa');
    },

    async carregarCidades() {
        try {
            const response = await fetch(this.config.cidadesJsonPath);
            if (!response.ok) throw new Error('Erro ao carregar cidades');
            
            const dados = await response.json();
            this.state.cidadesData = dados.filter(c => c.iata);
            
            this.log(`✅ ${this.state.cidadesData.length} cidades carregadas (v5 com aeroportos reais)`);
        } catch (erro) {
            this.error('Erro ao carregar cidades:', erro);
            this.state.cidadesData = [
                { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", codigo_pais: "BR", iata: "GRU", aeroporto: "Aeroporto de Guarulhos" },
                { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", codigo_pais: "BR", iata: "CGH", aeroporto: "Aeroporto de Congonhas" },
                { cidade: "São Paulo", sigla_estado: "SP", pais: "Brasil", codigo_pais: "BR", iata: "VCP", aeroporto: "Aeroporto de Viracopos" },
                { cidade: "Rio de Janeiro", sigla_estado: "RJ", pais: "Brasil", codigo_pais: "BR", iata: "GIG", aeroporto: "Aeroporto do Galeão" },
                { cidade: "Rio de Janeiro", sigla_estado: "RJ", pais: "Brasil", codigo_pais: "BR", iata: "SDU", aeroporto: "Aeroporto Santos Dumont" },
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
                const aeroNorm = cidade.aeroporto ? this.normalizarTexto(cidade.aeroporto) : '';
                return nomeNorm.includes(termoNorm) || iataNorm.includes(termoNorm) || aeroNorm.includes(termoNorm);
            })
            .slice(0, 8)
            .map(cidade => ({
                code: cidade.iata,
                name: cidade.cidade,
                state: cidade.sigla_estado,
                country: cidade.pais,
                countryCode: cidade.codigo_pais,
                airport: cidade.aeroporto || null
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
                            <div class="item-name">${cidade.name}${cidade.state ? ', ' + cidade.state : ''}${cidade.airport ? ' — ' + cidade.airport : ''}</div>
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
        input.value = cidade.airport 
            ? `${cidade.name} — ${cidade.airport} (${cidade.code})`
            : `${cidade.name} (${cidade.code})`;
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

    // ================================================================
    // CONDICIONAL: Mostrar campos corretos por tipo de companhia
    // ================================================================
    setupCompanhiaConditional() {
        const companhiaInput = document.getElementById('companhia');
        const numPessoasGroup = document.getElementById('num-pessoas-group');
        const familiaGroup = document.getElementById('familia-group');
        
        if (!companhiaInput) return;
        
        companhiaInput.addEventListener('change', () => {
            const value = parseInt(companhiaInput.value);
            
            // Amigos → mostra contador simples
            numPessoasGroup.style.display = (value === 3) ? 'block' : 'none';
            
            // Família → mostra adultos/crianças/bebês
            familiaGroup.style.display = (value === 2) ? 'block' : 'none';
        });
    },

    // ================================================================
    // FAMÍLIA: Inputs de adultos, crianças e bebês
    // ================================================================
    setupFamiliaInputs() {
        document.querySelectorAll('.btn-number-sm').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const action = btn.dataset.action;
                const input = document.getElementById(targetId);
                if (!input) return;

                const value = parseInt(input.value);
                const min = parseInt(input.min);
                const max = parseInt(input.max);

                if (action === 'increment' && value < max) {
                    input.value = value + 1;
                } else if (action === 'decrement' && value > min) {
                    input.value = value - 1;
                }

                // Validar: bebês não podem exceder adultos
                this.validarFamilia();
                this.atualizarTotalFamilia();
            });
        });

        // Inicializar o total
        this.atualizarTotalFamilia();
    },

    validarFamilia() {
        const adultos = parseInt(document.getElementById('familia-adultos').value);
        const bebes = parseInt(document.getElementById('familia-bebes').value);
        
        // Regra: máximo 1 bebê por adulto (no colo)
        if (bebes > adultos) {
            document.getElementById('familia-bebes').value = adultos;
        }
    },

    atualizarTotalFamilia() {
        const adultos = parseInt(document.getElementById('familia-adultos')?.value || 2);
        const criancas = parseInt(document.getElementById('familia-criancas')?.value || 0);
        const bebes = parseInt(document.getElementById('familia-bebes')?.value || 0);
        const total = adultos + criancas + bebes;
        
        const hint = document.getElementById('familia-total-hint');
        if (hint) {
            const parts = [];
            parts.push(`${adultos} adulto${adultos > 1 ? 's' : ''}`);
            if (criancas > 0) parts.push(`${criancas} criança${criancas > 1 ? 's' : ''}`);
            if (bebes > 0) parts.push(`${bebes} bebê${bebes > 1 ? 's' : ''}`);
            hint.textContent = `Total: ${total} passageiro${total > 1 ? 's' : ''} (${parts.join(', ')})`;
        }
    },

    // ================================================================
    // BOTÕES DE OPÇÃO (single-select e multi-select)
    // ================================================================
    setupOptionButtons() {
        document.querySelectorAll('.button-group').forEach(group => {
            const field = group.dataset.field;
            if (!field) return;
            
            const hiddenInput = document.getElementById(field);
            const isMulti = group.dataset.multi === 'true';
            
            group.querySelectorAll('.btn-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (isMulti) {
                        // MULTI-SELECT: toggle individual
                        btn.classList.toggle('active');
                        
                        // Coletar todos os valores selecionados
                        const selected = [];
                        group.querySelectorAll('.btn-option.active').forEach(b => {
                            selected.push(b.dataset.value);
                        });
                        hiddenInput.value = selected.join(',');
                        this.log(`✅ ${field} (multi):`, selected);
                    } else {
                        // SINGLE-SELECT: limpa outros
                        group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        hiddenInput.value = btn.dataset.value;
                        this.log(`✅ ${field}:`, btn.dataset.value);
                    }
                    
                    hiddenInput.dispatchEvent(new Event('change'));
                });
            });
        });
    },

    setupNumberInput() {
        const input = document.getElementById('num-pessoas');
        const decrementBtn = document.querySelector('#num-pessoas-group .btn-number[data-action="decrement"]');
        const incrementBtn = document.querySelector('#num-pessoas-group .btn-number[data-action="increment"]');
        
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

    // ================================================================
    // CURRENCY INPUT — v3.1.2: Valores inteiros com separador de milhar
    // ================================================================
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
                    // Remover zeros à esquerda e formatar com pontos de milhar
                    valor = parseInt(valor).toString();
                    e.target.value = parseInt(valor).toLocaleString('pt-BR');
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

    // ================================================================
    // VALIDAÇÃO — v3.1.2: Parsing corrigido para formato sem centavos
    // ================================================================
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
            alert('Por favor, escolha ao menos um estilo de viagem');
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
        if (!orcamento || parseFloat(orcamento.replace(/\./g, '')) <= 0) {
            alert('Por favor, informe o orçamento');
            document.getElementById('orcamento').focus();
            return false;
        }
        
        return true;
    },

    // ================================================================
    // COLETA DE DADOS — v3.1.2: Parsing corrigido para formato sem centavos
    // Inclui adultos/crianças/bebês e multi-prefs
    // ================================================================
    coletarDadosFormulario() {
        const companhia = parseInt(document.getElementById('companhia').value);
        
        // Calcular passageiros baseado no tipo de companhia
        let adultos = 1;
        let criancas = 0;
        let bebes = 0;
        let numPessoas = 1;

        switch (companhia) {
            case 0: // Sozinho
                adultos = 1;
                numPessoas = 1;
                break;
            case 1: // Casal
                adultos = 2;
                numPessoas = 2;
                break;
            case 2: // Família
                adultos = parseInt(document.getElementById('familia-adultos').value) || 2;
                criancas = parseInt(document.getElementById('familia-criancas').value) || 0;
                bebes = parseInt(document.getElementById('familia-bebes').value) || 0;
                numPessoas = adultos + criancas + bebes;
                break;
            case 3: // Amigos
                adultos = parseInt(document.getElementById('num-pessoas').value) || 2;
                numPessoas = adultos;
                break;
        }

        // Multi-select de preferências: pode ser "relax,cultura" etc.
        const prefString = document.getElementById('preferencias').value;
        const preferenciasArray = prefString.split(',').filter(Boolean);

        // Escopo de destino (internacional ou tanto faz)
        const escopoDestino = document.getElementById('escopo-destino').value || 'tanto_faz';

        this.state.formData = {
            origem: this.state.origemSelecionada,
            companhia: companhia,
            adultos: adultos,
            criancas: criancas,
            bebes: bebes,
            numPessoas: numPessoas,
            preferencias: prefString,           // string "relax,cultura"
            preferenciasArray: preferenciasArray, // array ["relax", "cultura"]
            escopoDestino: escopoDestino,        // "tanto_faz" ou "internacional"
            dataIda: document.getElementById('data-ida').value,
            dataVolta: document.getElementById('data-volta').value,
            moeda: document.getElementById('moeda').value,
            orcamento: parseFloat(document.getElementById('orcamento').value.replace(/\./g, ''))
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
    // GERAR DESCRIÇÃO DE PREFERÊNCIAS (multi-select)
    // ================================================================
    getPreferenciasDescricao(prefArray) {
        if (!prefArray || prefArray.length === 0) return 'Não informado';
        return prefArray
            .map(p => this.PREFERENCIAS_API_MAP[p] || p)
            .join(' + ');
    },

    getPreferenciasResumo(prefArray) {
        if (!prefArray || prefArray.length === 0) return { emoji: '🎯', texto: 'Não informado' };
        const partes = prefArray.map(p => this.PREFERENCIAS_LABELS[p] || { emoji: '🎯', texto: p });
        return {
            emoji: partes.map(p => p.emoji).join(''),
            texto: partes.map(p => p.texto).join(' + ')
        };
    },

    // ================================================================
    // FLUXO PRINCIPAL DE BUSCA
    // ================================================================
    async buscarDestinos() {
        try {
            this.mostrarLoading();
            
            // PASSO 1: Triple Search (ou Double se internacional only)
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
            
            // PASSO 4: Gerar links para voos.benetrip.com.br
            this.atualizarProgresso(80, '✈️ Gerando links de reserva...');
            const destinosComLinks = this.gerarLinksBenetrip(ranking);
            
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
    // Passa escopoDestino para filtrar internacional
    // Passa preferências como array para interests combinados
    // ================================================================
    async buscarDestinosAPI() {
        const response = await fetch('/api/search-destinations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origem: this.state.formData.origem.code,
                dataIda: this.state.formData.dataIda,
                dataVolta: this.state.formData.dataVolta,
                preferencias: this.state.formData.preferenciasArray, // array agora
                moeda: this.state.formData.moeda,
                escopoDestino: this.state.formData.escopoDestino    // "tanto_faz" ou "internacional"
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
                tempo: `${data._meta.totalTime}ms`,
                moeda: data._meta.currency || 'BRL',
                escopo: data._meta.escopoDestino || 'tanto_faz'
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
    // CHAMADA API: rank-destinations
    // Agora inclui adultos/crianças/bebês + preferências múltiplas
    // ================================================================
    async ranquearDestinosAPI(destinos, cenario) {
        const { formData } = this.state;
        const noites = this.calcularNoites(formData.dataIda, formData.dataVolta);

        // Descrição de companhia enriquecida para família
        let companhiaDesc = this.COMPANHIA_API_MAP[formData.companhia] || 'Não informado';
        if (formData.companhia === 2) {
            const parts = [`${formData.adultos} adulto(s)`];
            if (formData.criancas > 0) parts.push(`${formData.criancas} criança(s) de 2-11 anos`);
            if (formData.bebes > 0) parts.push(`${formData.bebes} bebê(s) de 0-1 ano`);
            companhiaDesc = `Viagem em família: ${parts.join(', ')}`;
        }

        const response = await fetch('/api/rank-destinations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destinos: destinos,
                preferencias: this.getPreferenciasDescricao(formData.preferenciasArray),
                companhia: companhiaDesc,
                numPessoas: formData.numPessoas,
                adultos: formData.adultos,
                criancas: formData.criancas,
                bebes: formData.bebes,
                noites: noites,
                orcamento: formData.orcamento,
                moeda: formData.moeda,
                dataIda: formData.dataIda,
                dataVolta: formData.dataVolta,
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

    // ================================================================
    // GERAR LINKS PARA voos.benetrip.com.br
    // Agora trata surpresa null e alternativas variáveis
    // ================================================================
    gerarLinksBenetrip(ranking) {
        const { origem, dataIda, dataVolta, adultos, criancas, bebes } = this.state.formData;
        
        const formatDDMM = (isoDate) => {
            const [, mes, dia] = isoDate.split('-');
            return `${dia}${mes}`;
        };

        // Construir string de passageiros
        let passageirosStr;
        if (criancas > 0 || bebes > 0) {
            passageirosStr = `${adultos}${criancas}${bebes}`;
        } else {
            passageirosStr = `${adultos}`;
        }
        
        const gerarLink = (d) => {
            if (!d?.primary_airport) return '#';
            const flightSearch = `${origem.code}${formatDDMM(dataIda)}${d.primary_airport}${formatDDMM(dataVolta)}${passageirosStr}`;
            return `https://voos.benetrip.com.br/?flightSearch=${flightSearch}&destination_airports=1&origin_airports=0`;
        };
        
        return {
            top_destino: { ...ranking.top_destino, link: gerarLink(ranking.top_destino) },
            alternativas: (ranking.alternativas || []).map(d => ({ ...d, link: gerarLink(d) })),
            surpresa: ranking.surpresa ? { ...ranking.surpresa, link: gerarLink(ranking.surpresa) } : null,
            _model: ranking._model,
            _totalAnalisados: ranking._totalAnalisados,
            _poucosResultados: ranking._poucosResultados || false,
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

    voltarAoFormulario() {
        document.getElementById('resultados-container').style.display = 'none';
        document.getElementById('resultados-container').innerHTML = '';
        document.getElementById('form-container').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('progress-fill').style.width = '0%';
        this.log('🔄 Voltou ao formulário com dados preservados');
    },

    // ================================================================
    // RESUMO DOS CRITÉRIOS (atualizado para família detalhada + multi-pref)
    // ================================================================
    gerarResumoCriterios() {
        const { origem, companhia, adultos, criancas, bebes, numPessoas, preferenciasArray, escopoDestino, dataIda, dataVolta, moeda, orcamento } = this.state.formData;
        const noites = this.calcularNoites(dataIda, dataVolta);
        const simbolo = this.getSimbolo(moeda);
        
        const comp = this.COMPANHIA_LABELS[companhia] || { emoji: '👤', texto: 'Não informado' };
        const pref = this.getPreferenciasResumo(preferenciasArray);
        
        const dataIdaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        const dataVoltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

        // Info de pessoas detalhada
        let pessoasInfo = '';
        if (companhia === 0) {
            pessoasInfo = '1 adulto';
        } else if (companhia === 1) {
            pessoasInfo = '2 adultos';
        } else if (companhia === 2) {
            const parts = [`${adultos} adulto${adultos > 1 ? 's' : ''}`];
            if (criancas > 0) parts.push(`${criancas} criança${criancas > 1 ? 's' : ''}`);
            if (bebes > 0) parts.push(`${bebes} bebê${bebes > 1 ? 's' : ''}`);
            pessoasInfo = parts.join(', ');
        } else {
            pessoasInfo = `${numPessoas} adultos`;
        }

        const origemDisplay = origem.airport 
            ? `${origem.name} — ${origem.airport} (${origem.code})`
            : `${origem.name} (${origem.code})`;

        const escopoLabel = escopoDestino === 'internacional' 
            ? '✈️ Apenas internacionais' 
            : '🗺️ Nacionais e internacionais';

        return `
            <div class="criterios-resumo">
                <div class="criterios-titulo">
                    <span class="criterios-icon">🐕</span>
                    <span>A Tripinha buscou com base no seu perfil:</span>
                </div>
                <div class="criterios-grid">
                    <div class="criterio-item">
                        <span class="criterio-label">Saindo de</span>
                        <span class="criterio-valor">📍 ${origemDisplay}</span>
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
                        <span class="criterio-label">Destinos</span>
                        <span class="criterio-valor">${escopoLabel}</span>
                    </div>
                    <div class="criterio-item">
                        <span class="criterio-label">Período</span>
                        <span class="criterio-valor">📅 ${dataIdaBR} → ${dataVoltaBR} · ${noites} noites</span>
                    </div>
                    <div class="criterio-item">
                        <span class="criterio-label">Orçamento</span>
                        <span class="criterio-valor">💰 Até ${simbolo} ${orcamento.toLocaleString('pt-BR')} por adulto (ida+volta)</span>
                    </div>
                </div>
            </div>
        `;
    },

    // ================================================================
    // TELA: Nenhum destino encontrado
    // ================================================================
    mostrarSemResultados() {
        const container = document.getElementById('resultados-container');
        const { orcamento, moeda, origem, escopoDestino } = this.state.formData;
        const simbolo = this.getSimbolo(moeda);

        const isInternacional = escopoDestino === 'internacional';

        container.innerHTML = `
            <div class="sem-resultados">
                <img src="assets/images/tripinha/avatar-triste.png" alt="Tripinha triste" class="tripinha-triste" 
                     onerror="this.style.display='none'">
                <h2>😕 Puxa, não encontrei destinos...</h2>
                <p class="sem-resultados-msg">
                    A Tripinha procurou por todo canto, mas não encontrou passagens 
                    ${isInternacional ? '<strong>internacionais</strong>' : ''} 
                    saindo de <strong>${origem.name} (${origem.code})</strong> dentro do orçamento de 
                    <strong>${simbolo} ${orcamento?.toLocaleString('pt-BR') || '?'}</strong> para essas datas.
                </p>
                <div class="sem-resultados-dicas">
                    <h3>🐕 Dicas da Tripinha:</h3>
                    <div class="dica">💰 <strong>Aumente o orçamento</strong> — às vezes um pouco mais abre muitas opções!</div>
                    <div class="dica">📅 <strong>Tente outras datas</strong> — viajar em dias da semana costuma ser mais barato.</div>
                    ${isInternacional ? '<div class="dica">🗺️ <strong>Inclua destinos nacionais</strong> — selecione "Tanto faz" para mais opções!</div>' : ''}
                    <div class="dica">📍 <strong>Mude a cidade de origem</strong> — aeroportos maiores têm mais rotas e preços melhores.</div>
                    <div class="dica">🌍 <strong>Experimente outros estilos</strong> — pode revelar destinos menos óbvios!</div>
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
    // v3.1.1: Custo de hotel dividido pelo número de pessoas
    // v3.1: Degrada graciosamente quando poucos destinos
    // - Sem surpresa se não houver
    // - Sem alternativas se não houver
    // - Mensagem informativa sobre poucos resultados
    // ================================================================
    mostrarResultados(destinos, cenario, mensagem) {
        const container = document.getElementById('resultados-container');
        const { dataIda, dataVolta, moeda, numPessoas } = this.state.formData;
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

        const custoEstimado = (d) => {
            const passagem = d.flight?.price || 0;
            const hotelTotalQuarto = (d.avg_cost_per_night || 0) * noites; // Custo total do quarto
            
            if (hotelTotalQuarto > 0) {
                // Dividir custo do hotel pelo número de pessoas (quarto compartilhado)
                const hotelPorPessoa = numPessoas > 1 
                    ? hotelTotalQuarto / numPessoas 
                    : hotelTotalQuarto;
                
                const custoTotal = passagem + hotelPorPessoa;
                
                // Texto adaptado para grupos
                let detalheTexto = `(voo + ${noites} noites hotel`;
                if (numPessoas > 1) {
                    detalheTexto += ` ÷ ${numPessoas} pessoas`;
                }
                detalheTexto += ')';
                
                return `<div class="custo-estimado">
                    <span class="custo-label">Estimativa total/pessoa:</span>
                    <span class="custo-valor">${this.formatarPreco(custoTotal, moeda)}</span>
                    <span class="custo-detalhe">${detalheTexto}</span>
                </div>`;
            }
            return '';
        };

        const comentarioHtml = (d) => {
            if (!d.comentario) return '';
            return `<div class="destino-comentario">${d.comentario}</div>`;
        };

        const dicaHtml = (d) => {
            if (!d.dica) return '';
            return `<div class="destino-dica"><span class="dica-icon">💡</span> ${d.dica}</div>`;
        };

        // ============================================================
        // CONTAR TOTAL DE DESTINOS ÚNICOS EXIBIDOS
        // ============================================================
        const totalExibidos = 1 
            + (destinos.alternativas?.length || 0) 
            + (destinos.surpresa ? 1 : 0);
        const poucosResultados = destinos._poucosResultados || totalExibidos < 5;

        // ============================================================
        // MENSAGEM DE POUCOS RESULTADOS
        // ============================================================
        let bannerPoucosResultados = '';
        if (poucosResultados) {
            bannerPoucosResultados = `
                <div class="resultado-banner banner-poucos-resultados">
                    <p>🐕 A Tripinha encontrou ${totalExibidos === 1 ? 'apenas 1 destino que se encaixa' : `apenas ${totalExibidos} destinos que se encaixam`} no seu perfil e orçamento. 
                    ${totalExibidos === 1 ? 'Mas é uma ótima opção!' : 'São poucas opções, mas todas combinam com o que você busca!'}
                    Experimente ajustar datas ou orçamento para mais resultados.</p>
                </div>
            `;
        }

        // ============================================================
        // SEÇÃO DE ALTERNATIVAS (condicional)
        // ============================================================
        let alternativasHtml = '';
        if (destinos.alternativas && destinos.alternativas.length > 0) {
            alternativasHtml = `
                <div class="alternativas-section">
                    <h3>📋 Outras Opções</h3>
                    <div class="alternativas-grid">
                        ${destinos.alternativas.map(d => `
                            <div class="destino-card">
                                ${fonteBadge(d)}
                                <h4>${d.name}${d.country ? ', ' + d.country : ''}</h4>
                                <div class="preco">${formatPreco(d)}</div>
                                <div class="preco-label">ida e volta por adulto</div>
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
            `;
        }

        // ============================================================
        // SEÇÃO SURPRESA (condicional)
        // ============================================================
        let surpresaHtml = '';
        if (destinos.surpresa) {
            surpresaHtml = `
                <div class="surpresa-card">
                    <div class="badge">🎁 DESTINO SURPRESA</div>
                    ${fonteBadge(destinos.surpresa)}
                    <h3>${destinos.surpresa.name}${destinos.surpresa.country ? ', ' + destinos.surpresa.country : ''}</h3>
                    <div class="preco">${formatPreco(destinos.surpresa)}</div>
                    <div class="preco-label">ida e volta por adulto</div>
                    <div class="flight-info">${formatParadas(destinos.surpresa)}</div>
                    ${custoEstimado(destinos.surpresa)}
                    <div class="descricao">${destinos.surpresa.razao || 'Descubra!'}</div>
                    ${comentarioHtml(destinos.surpresa)}
                    ${dicaHtml(destinos.surpresa)}
                    <a href="${destinos.surpresa.link}" target="_blank" class="btn-ver-voos">Descobrir ✈️</a>
                </div>
            `;
        }

        // ============================================================
        // MONTAR HTML FINAL
        // ============================================================
        const html = `
            ${this.gerarResumoCriterios()}

            <div class="resultado-header">
                <h1>${cenario === 'ideal' && !poucosResultados ? '🎉 Destinos Perfeitos!' : poucosResultados ? '✈️ Destinos Encontrados' : '✈️ Destinos Encontrados!'}</h1>
                <p class="resultado-subtitulo">
                    ${destinos._totalAnalisados ? `${destinos._totalAnalisados} destinos analisados` : ''}
                    ${destinos._model && destinos._model !== 'fallback_price' ? ' · Curadoria da Tripinha 🐶' : ''}
                </p>
            </div>

            ${bannerPoucosResultados}

            ${mensagem && !poucosResultados ? `
            <div class="resultado-banner ${cenario === 'abaixo' ? 'banner-aviso' : 'banner-info'}">
                <p>${mensagem}</p>
            </div>
            ` : ''}

            <div class="top-destino">
                <div class="badge">🏆 ${totalExibidos === 1 ? 'DESTINO ENCONTRADO' : 'MELHOR DESTINO PARA VOCÊ'}</div>
                ${fonteBadge(destinos.top_destino)}
                <h2>${destinos.top_destino.name}, ${destinos.top_destino.country || ''}</h2>
                <div class="preco">${formatPreco(destinos.top_destino)}</div>
                <div class="preco-label">Passagem ida e volta por adulto</div>
                <div class="flight-info">${formatParadas(destinos.top_destino)}</div>
                ${custoEstimado(destinos.top_destino)}
                <div class="descricao">${destinos.top_destino.razao || 'Perfeito para você!'}</div>
                ${comentarioHtml(destinos.top_destino)}
                ${dicaHtml(destinos.top_destino)}
                <a href="${destinos.top_destino.link}" target="_blank" class="btn-ver-voos">Ver Passagens ✈️</a>
            </div>

            ${alternativasHtml}

            ${surpresaHtml}

            <div class="buscar-novamente-section">
                <p class="buscar-novamente-texto">
                    ${poucosResultados 
                        ? 'Quer ver mais opções? Ajuste datas, orçamento ou estilo de viagem para descobrir mais destinos!' 
                        : 'Quer explorar outras opções? Ajuste seus critérios e descubra mais!'}
                </p>
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

document.addEventListener('DOMContentLoaded', () => BenetripDiscovery.init());