/**
 * BENETRIP - ROTEIRO DE VIAGEM
 * v2.0 - MULTI-DESTINO + clima previsto + contagem de dias
 * 
 * Changelog v2.0:
 * - Suporte a múltiplos destinos na mesma viagem
 * - Cada destino com suas próprias datas e horários de chegada/partida
 * - Exibição de destino atual e clima previsto por dia no resultado
 * - Badge visual de transição entre cidades
 * - Separadores visuais por destino no roteiro gerado
 * - Compartilhamento WhatsApp adaptado para multi-destino
 * 
 * Changelog v1.1:
 * - Campo de observações livres do usuário (pedidos especiais)
 * - Correção WhatsApp: links Google Maps curtos
 * - Compartilhamento dividido em partes se exceder limite do WhatsApp
 */

const BenetripRoteiro = {
    state: {
        formData: {},
        roteiro: null,
        viewingResults: false,
        destinoCount: 1,          // v2.0: quantidade de destinos
        maxDestinos: 6,           // v2.0: limite máximo de destinos
        flatpickrInstances: {},   // v2.0: instâncias do calendário por destino
    },

    config: {
        debug: true,
        WHATSAPP_CHAR_LIMIT: 3500
    },

    log(...args) {
        if (this.config.debug) console.log('[Roteiro]', ...args);
    },

    error(...args) {
        console.error('[Roteiro ERROR]', ...args);
    },

    // ================================================================
    // INICIALIZAÇÃO
    // ================================================================
    init() {
        this.log('🗺️ Benetrip Roteiro v2.0 (Multi-Destino) inicializando...');

        this.setupOptionButtons();
        this.setupCompanhiaConditional();
        this.setupFamiliaInputs();
        this.setupNumberInput();
        this.setupFormEvents();
        this.setupHistoryNavigation();
        this.setupObservacoesCounter();

        // v2.0: Inicializar calendário do primeiro destino
        this.setupCalendarForDestino(1);

        // v2.0: Botão adicionar destino
        this.setupAdicionarDestino();

        this.log('✅ Inicialização completa');
    },

    // ================================================================
    // v2.0: SISTEMA MULTI-DESTINO
    // ================================================================

    /**
     * Configura o botão "Adicionar outro destino"
     */
    setupAdicionarDestino() {
        const btn = document.getElementById('btn-adicionar-destino');
        if (!btn) return;

        btn.addEventListener('click', () => {
            if (this.state.destinoCount >= this.state.maxDestinos) {
                alert(`Máximo de ${this.state.maxDestinos} destinos por viagem!`);
                return;
            }

            this.state.destinoCount++;
            this.adicionarDestinoCard(this.state.destinoCount);

            // Atualizar visibilidade do botão
            if (this.state.destinoCount >= this.state.maxDestinos) {
                btn.style.display = 'none';
            }

            // Atualizar label do primeiro destino se agora é multi
            this.atualizarLabelsDestino();

            this.log(`➕ Destino ${this.state.destinoCount} adicionado`);
        });
    },

    /**
     * Cria e insere um novo card de destino no formulário
     */
    adicionarDestinoCard(index) {
        const container = document.getElementById('destinos-container');
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);

        const card = document.createElement('div');
        card.className = 'destino-card';
        card.id = `destino-card-${index}`;
        card.dataset.index = index;

        card.innerHTML = `
            <div class="destino-card-header">
                <div class="destino-card-badge">${index}</div>
                <span class="destino-card-title">Destino ${index}</span>
                <button type="button" class="destino-card-remove" onclick="BenetripRoteiro.removerDestino(${index})" title="Remover destino">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            <div class="destino-card-body">
                <div class="form-group" style="margin-bottom:16px;">
                    <label for="destino-${index}">📍 Cidade e país</label>
                    <input type="text" id="destino-${index}" class="text-input" placeholder="Ex: Roma, Itália" required autocomplete="off">
                </div>

                <div class="form-group" style="margin-bottom:16px;">
                    <label for="datas-roteiro-${index}">📅 Datas neste destino</label>
                    <input type="text" id="datas-roteiro-${index}" class="text-input" placeholder="Clique para selecionar" readonly required>
                    <input type="hidden" id="data-chegada-${index}">
                    <input type="hidden" id="data-saida-${index}">
                </div>

                <div class="time-row">
                    <div class="time-field">
                        <label for="horario-chegada-${index}">🛬 Chegada</label>
                        <input type="time" id="horario-chegada-${index}" class="time-input" value="14:00">
                    </div>
                    <div class="time-field">
                        <label for="horario-partida-${index}">🛫 Partida</label>
                        <input type="time" id="horario-partida-${index}" class="time-input" value="18:00">
                    </div>
                </div>
            </div>
        `;

        container.appendChild(card);

        // Animar entrada
        requestAnimationFrame(() => {
            card.classList.add('destino-card-visible');
        });

        // Inicializar calendário deste destino
        this.setupCalendarForDestino(index);

        // Scroll suave até o novo card
        setTimeout(() => {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    },

    /**
     * Remove um destino do formulário
     */
    removerDestino(index) {
        if (this.state.destinoCount <= 1) return;

        const card = document.getElementById(`destino-card-${index}`);
        if (!card) return;

        // Animar saída
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        card.style.maxHeight = card.scrollHeight + 'px';

        setTimeout(() => {
            card.style.maxHeight = '0';
            card.style.padding = '0';
            card.style.margin = '0';
            card.style.overflow = 'hidden';
        }, 200);

        setTimeout(() => {
            card.remove();
            this.state.destinoCount--;

            // Destruir instância flatpickr
            if (this.state.flatpickrInstances[index]) {
                this.state.flatpickrInstances[index].destroy();
                delete this.state.flatpickrInstances[index];
            }

            // Reexibir botão de adicionar
            const btn = document.getElementById('btn-adicionar-destino');
            if (btn && this.state.destinoCount < this.state.maxDestinos) {
                btn.style.display = '';
            }

            // Renumerar cards visíveis
            this.renumerarDestinos();
            this.atualizarLabelsDestino();

            this.log(`➖ Destino ${index} removido. Total: ${this.state.destinoCount}`);
        }, 400);
    },

    /**
     * Renumera os badges e títulos dos destinos após remoção
     */
    renumerarDestinos() {
        const cards = document.querySelectorAll('#destinos-container .destino-card');
        cards.forEach((card, i) => {
            const num = i + 1;
            const badge = card.querySelector('.destino-card-badge');
            const title = card.querySelector('.destino-card-title');
            if (badge) badge.textContent = num;
            if (title) title.textContent = this.state.destinoCount > 1 ? `Destino ${num}` : 'Destino';
        });
    },

    /**
     * Atualiza labels dos destinos (mostra "Destino 1" só se houver múltiplos)
     */
    atualizarLabelsDestino() {
        const cards = document.querySelectorAll('#destinos-container .destino-card');
        cards.forEach((card, i) => {
            const title = card.querySelector('.destino-card-title');
            const removeBtn = card.querySelector('.destino-card-remove');
            if (title) {
                title.textContent = this.state.destinoCount > 1 ? `Destino ${i + 1}` : 'Destino';
            }
            // Mostrar botão remover apenas se houver >1 destino
            if (removeBtn) {
                removeBtn.style.display = this.state.destinoCount > 1 ? '' : 'none';
            }
        });

        // Atualizar hint do botão adicionar
        const addHint = document.getElementById('adicionar-destino-hint');
        if (addHint) {
            addHint.textContent = this.state.destinoCount > 1
                ? `${this.state.destinoCount} destinos adicionados`
                : 'Viagem com parada em mais de uma cidade? Adicione!';
        }
    },

    // ================================================================
    // CALENDÁRIO (por destino)
    // ================================================================
    setupCalendarForDestino(index) {
        const input = document.getElementById(`datas-roteiro-${index}`);
        const dataChegada = document.getElementById(`data-chegada-${index}`);
        const dataSaida = document.getElementById(`data-saida-${index}`);

        if (!input || !dataChegada || !dataSaida) return;

        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);

        const instance = flatpickr(input, {
            mode: 'range',
            minDate: amanha,
            dateFormat: 'Y-m-d',
            locale: 'pt',
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    dataChegada.value = this.formatarDataISO(selectedDates[0]);
                    dataSaida.value = this.formatarDataISO(selectedDates[1]);
                    input.value = `${this.formatarDataBR(selectedDates[0])} → ${this.formatarDataBR(selectedDates[1])}`;
                    this.log(`📅 Destino ${index}:`, dataChegada.value, '→', dataSaida.value);
                }
            }
        });

        this.state.flatpickrInstances[index] = instance;
    },

    // ================================================================
    // LEGACY: setupCalendar para compatibilidade (redireciona para destino 1)
    // ================================================================
    setupCalendar() {
        // Não faz nada — setupCalendarForDestino(1) é chamado no init
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
    // CONTADOR DE OBSERVAÇÕES
    // ================================================================
    setupObservacoesCounter() {
        const textarea = document.getElementById('observacoes-roteiro');
        const counter = document.getElementById('observacoes-count');
        const counterWrapper = textarea?.closest('.form-group')?.querySelector('.observacoes-counter');

        if (!textarea || !counter) return;

        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            counter.textContent = len;

            if (counterWrapper) {
                counterWrapper.classList.remove('near-limit', 'at-limit');
                if (len >= 800) {
                    counterWrapper.classList.add('at-limit');
                } else if (len >= 650) {
                    counterWrapper.classList.add('near-limit');
                }
            }
        });
    },

    // ================================================================
    // HISTÓRICO (botão voltar do celular)
    // ================================================================
    setupHistoryNavigation() {
        window.addEventListener('popstate', () => {
            if (this.state.viewingResults) {
                this.log('🔙 Botão voltar interceptado');
                this.voltarAoFormulario(true);
            }
        });
    },

    pushResultsState() {
        history.pushState({ benetripView: 'roteiro' }, '', '');
        this.state.viewingResults = true;
    },

    // ================================================================
    // BOTÕES DE OPÇÃO (single e multi-select)
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
                        btn.classList.toggle('active');
                        const selected = [];
                        group.querySelectorAll('.btn-option.active').forEach(b => selected.push(b.dataset.value));
                        hiddenInput.value = selected.join(',');
                    } else {
                        group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        hiddenInput.value = btn.dataset.value;
                    }
                    hiddenInput.dispatchEvent(new Event('change'));
                });
            });
        });
    },

    // ================================================================
    // CONDICIONAL: COMPANHIA → FAMÍLIA / AMIGOS
    // ================================================================
    setupCompanhiaConditional() {
        const companhiaInput = document.getElementById('companhia-roteiro');
        const numPessoasGroup = document.getElementById('num-pessoas-roteiro-group');
        const familiaGroup = document.getElementById('familia-roteiro-group');

        if (!companhiaInput) return;

        companhiaInput.addEventListener('change', () => {
            const value = parseInt(companhiaInput.value);
            numPessoasGroup.style.display = (value === 3) ? 'block' : 'none';
            familiaGroup.style.display = (value === 2) ? 'block' : 'none';
        });
    },

    // ================================================================
    // INPUTS DE FAMÍLIA
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

                if (action === 'increment' && value < max) input.value = value + 1;
                else if (action === 'decrement' && value > min) input.value = value - 1;

                this.validarFamilia();
                this.atualizarTotalFamilia();
            });
        });
        this.atualizarTotalFamilia();
    },

    validarFamilia() {
        const adultos = parseInt(document.getElementById('rot-adultos').value);
        const bebes = parseInt(document.getElementById('rot-bebes').value);
        if (bebes > adultos) document.getElementById('rot-bebes').value = adultos;
    },

    atualizarTotalFamilia() {
        const adultos = parseInt(document.getElementById('rot-adultos')?.value || 2);
        const criancas = parseInt(document.getElementById('rot-criancas')?.value || 0);
        const bebes = parseInt(document.getElementById('rot-bebes')?.value || 0);
        const total = adultos + criancas + bebes;

        const hint = document.getElementById('rot-familia-total-hint');
        if (hint) {
            const parts = [`${adultos} adulto${adultos > 1 ? 's' : ''}`];
            if (criancas > 0) parts.push(`${criancas} criança${criancas > 1 ? 's' : ''}`);
            if (bebes > 0) parts.push(`${bebes} bebê${bebes > 1 ? 's' : ''}`);
            hint.textContent = `Total: ${total} passageiro${total > 1 ? 's' : ''} (${parts.join(', ')})`;
        }
    },

    // ================================================================
    // INPUT NUMÉRICO (amigos)
    // ================================================================
    setupNumberInput() {
        document.querySelectorAll('.btn-number[data-target-num]').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.targetNum;
                const action = btn.dataset.action;
                const input = document.getElementById(targetId);
                if (!input) return;
                const value = parseInt(input.value);
                if (action === 'increment' && value < 20) input.value = value + 1;
                else if (action === 'decrement' && value > 2) input.value = value - 1;
            });
        });
    },

    // ================================================================
    // FORM SUBMIT
    // ================================================================
    setupFormEvents() {
        const form = document.getElementById('roteiro-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.validarFormulario()) return;
            this.coletarDadosFormulario();
            await this.gerarRoteiro();
        });
    },

    /**
     * v2.0: Validação atualizada para multi-destino
     */
    validarFormulario() {
        // Validar cada destino
        const cards = document.querySelectorAll('#destinos-container .destino-card');
        let datasAnterior = null;

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const index = card.dataset.index || (i + 1);
            const destinoInput = card.querySelector(`#destino-${index}`);
            const dataChegada = card.querySelector(`#data-chegada-${index}`);
            const dataSaida = card.querySelector(`#data-saida-${index}`);

            if (!destinoInput || !destinoInput.value.trim()) {
                alert(`Por favor, informe o destino ${cards.length > 1 ? (i + 1) : 'da viagem'}`);
                destinoInput?.focus();
                return false;
            }

            if (!dataChegada?.value || !dataSaida?.value) {
                alert(`Por favor, selecione as datas ${cards.length > 1 ? 'do destino ' + (i + 1) : 'da viagem'}`);
                return false;
            }

            // Verificar se as datas são sequenciais (para multi-destino)
            if (datasAnterior && cards.length > 1) {
                const chegadaAtual = new Date(dataChegada.value + 'T12:00:00');
                const saidaAnterior = new Date(datasAnterior + 'T12:00:00');
                if (chegadaAtual < saidaAnterior) {
                    alert(`As datas do destino ${i + 1} devem ser após as datas do destino ${i}. A chegada no destino ${i + 1} deve ser no mesmo dia ou após a saída do destino anterior.`);
                    return false;
                }
            }
            datasAnterior = dataSaida.value;
        }

        if (!document.getElementById('companhia-roteiro').value) {
            alert('Por favor, escolha com quem você vai viajar');
            return false;
        }
        if (!document.getElementById('preferencias-roteiro').value) {
            alert('Por favor, escolha ao menos um tipo de experiência');
            return false;
        }
        if (!document.getElementById('intensidade-roteiro').value) {
            alert('Por favor, escolha o ritmo do roteiro');
            return false;
        }
        if (!document.getElementById('orcamento-roteiro').value) {
            alert('Por favor, escolha o nível de orçamento');
            return false;
        }
        return true;
    },

    COMPANHIA_MAP: {
        0: 'Viajando sozinho(a)',
        1: 'Viagem romântica (casal)',
        2: 'Viagem em família',
        3: 'Viagem com amigos'
    },

    PREFERENCIAS_MAP: {
        'relax': 'Relaxamento, praias, descanso e natureza tranquila',
        'aventura': 'Aventura, trilhas, esportes radicais e natureza selvagem',
        'cultura': 'Cultura, museus, história, gastronomia e arquitetura',
        'urbano': 'Agito urbano, vida noturna, compras e experiências cosmopolitas'
    },

    /**
     * v2.0: Coleta dados de múltiplos destinos
     */
    coletarDadosFormulario() {
        const companhia = parseInt(document.getElementById('companhia-roteiro').value);

        let adultos = 1, criancas = 0, bebes = 0, numPessoas = 1;
        switch (companhia) {
            case 0: adultos = 1; numPessoas = 1; break;
            case 1: adultos = 2; numPessoas = 2; break;
            case 2:
                adultos = parseInt(document.getElementById('rot-adultos').value) || 2;
                criancas = parseInt(document.getElementById('rot-criancas').value) || 0;
                bebes = parseInt(document.getElementById('rot-bebes').value) || 0;
                numPessoas = adultos + criancas + bebes;
                break;
            case 3:
                adultos = parseInt(document.getElementById('num-pessoas-roteiro').value) || 2;
                numPessoas = adultos;
                break;
        }

        const prefString = document.getElementById('preferencias-roteiro').value;
        const prefArray = prefString.split(',').filter(Boolean);
        const preferenciasDescricao = prefArray.map(p => this.PREFERENCIAS_MAP[p] || p).join(' + ');

        let companhiaDesc = this.COMPANHIA_MAP[companhia] || 'Não informado';
        if (companhia === 2) {
            const parts = [`${adultos} adulto(s)`];
            if (criancas > 0) parts.push(`${criancas} criança(s) de 2-11 anos`);
            if (bebes > 0) parts.push(`${bebes} bebê(s) de 0-1 ano`);
            companhiaDesc = `Viagem em família: ${parts.join(', ')}`;
        }

        const observacoes = (document.getElementById('observacoes-roteiro')?.value || '').trim();

        // v2.0: Coletar dados de todos os destinos
        const destinos = [];
        const cards = document.querySelectorAll('#destinos-container .destino-card');

        cards.forEach((card) => {
            const index = card.dataset.index;
            destinos.push({
                destino: document.getElementById(`destino-${index}`)?.value.trim() || '',
                dataChegada: document.getElementById(`data-chegada-${index}`)?.value || '',
                dataSaida: document.getElementById(`data-saida-${index}`)?.value || '',
                horarioChegada: document.getElementById(`horario-chegada-${index}`)?.value || '',
                horarioPartida: document.getElementById(`horario-partida-${index}`)?.value || '',
            });
        });

        this.state.formData = {
            // v2.0: array de destinos
            destinos,
            // Legado: primeiro e último destino para exibição
            destino: destinos.map(d => d.destino).join(' → '),
            dataIda: destinos[0]?.dataChegada || '',
            dataVolta: destinos[destinos.length - 1]?.dataSaida || '',
            // Comum
            companhia: companhiaDesc,
            companhiaCode: companhia,
            adultos,
            criancas,
            bebes,
            numPessoas,
            preferencias: preferenciasDescricao,
            preferenciasArray: prefArray,
            intensidade: document.getElementById('intensidade-roteiro').value,
            orcamentoAtividades: document.getElementById('orcamento-roteiro').value,
            observacoes,
        };

        this.log('📝 Dados coletados:', this.state.formData);
        this.log(`📍 ${destinos.length} destino(s):`, destinos.map(d => d.destino));
    },

    // ================================================================
    // GERAR ROTEIRO (chamada à API)
    // ================================================================
    async gerarRoteiro() {
        try {
            this.mostrarLoading();
            const isMulti = this.state.formData.destinos.length > 1;
            const msgPesquisa = isMulti
                ? '🔍 Pesquisando os melhores lugares em cada cidade...'
                : '🔍 Pesquisando os melhores lugares...';

            this.atualizarProgresso(10, msgPesquisa);

            await this.delay(500);
            this.atualizarProgresso(30, '🗺️ Montando o roteiro dia a dia...');

            const response = await fetch('/api/generate-itinerary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.state.formData)
            });

            this.atualizarProgresso(70, isMulti
                ? '🐕 Tripinha conectando os destinos com dicas especiais...'
                : '🐕 Tripinha adicionando dicas especiais...'
            );

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Erro ao gerar roteiro');
            }

            const roteiro = await response.json();
            this.state.roteiro = roteiro;

            if (typeof BenetripAutoSave !== 'undefined') {
                BenetripAutoSave.salvarRoteiro({
                    destino_nome:  this.state.formData.destino,
                    destino_pais:  roteiro.pais || '',
                    data_ida:      this.state.formData.dataIda,
                    data_volta:    this.state.formData.dataVolta,
                    num_dias:      roteiro.dias?.length || 0,
                    companhia:     this.state.formData.companhia,
                    preferencias:  this.state.formData.preferencias,
                    intensidade:   this.state.formData.intensidade,
                    orcamento:     this.state.formData.orcamentoAtividades,
                    observacoes:   this.state.formData.observacoes,
                    destinos:      this.state.formData.destinos,
                    dados_roteiro: roteiro
                });
            }

            this.atualizarProgresso(90, '✨ Finalizando...');
            await this.delay(400);
            this.atualizarProgresso(100, '🎉 Pronto!');
            await this.delay(300);

            this.mostrarRoteiro(roteiro);
        } catch (erro) {
            this.error('Erro:', erro);
            alert(`Erro ao gerar roteiro: ${erro.message}`);
            this.esconderLoading();
        }
    },

    // ================================================================
    // HELPER: Google Maps URL
    // ================================================================
    buildMapsUrl(query) {
        if (!query) return '';
        return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
    },

    buildMapsUrlShort(query) {
        if (!query) return '';
        return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
    },

    // ================================================================
    // RENDERIZAÇÃO DO ROTEIRO (v2.0: multi-destino + clima)
    // ================================================================
    mostrarRoteiro(roteiro) {
        const container = document.getElementById('resultados-container');
        this.pushResultsState();

        const { destino, dataIda, dataVolta, observacoes, destinos } = this.state.formData;
        const idaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        const voltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
        const isMulti = destinos && destinos.length > 1;

        const PERIODO_ICONS = {
            'manhã': '🌅', 'manha': '🌅', 'tarde': '☀️', 'noite': '🌙'
        };

        const TAG_CLASSES = {
            'Imperdível': 'tag-imperdivel',
            'Ideal para família': 'tag-familia',
            'Histórico': 'tag-historico',
            'Gastronômico': 'tag-gastronomico',
            'Compras': 'tag-compras',
            'Relaxante': 'tag-relaxante',
            'Aventura': 'tag-aventura',
            'Cultural': 'tag-cultural',
            'Gratuito': 'tag-gratuito',
            'Vida noturna': 'tag-noturna',
            'Natureza': 'tag-natureza',
            'Romântico': 'tag-romantico',
        };

        const renderTag = (tag) => {
            const cls = TAG_CLASSES[tag] || 'tag-default';
            return `<span class="tag ${cls}">${tag}</span>`;
        };

        const self = this;

        const renderAtividade = (ativ) => {
            const mapsQuery = ativ.google_maps_query || (ativ.nome + ', ' + destino);
            const mapsUrl = self.buildMapsUrl(mapsQuery);

            return `
                <div class="atividade-card">
                    <div class="atividade-nome">📍 ${ativ.nome}</div>
                    <div class="atividade-desc">${ativ.descricao || ''}</div>
                    
                    ${(ativ.tags && ativ.tags.length > 0) ? `
                        <div class="atividade-tags">
                            ${ativ.tags.map(renderTag).join('')}
                            ${ativ.gratuito ? '<span class="tag tag-gratuito">Gratuito</span>' : ''}
                        </div>
                    ` : ''}
                    
                    <div class="atividade-meta">
                        ${ativ.duracao_minutos ? `<span>🕐 ~${ativ.duracao_minutos}min</span>` : ''}
                        ${ativ.gratuito === false ? '<span>💰 Pago</span>' : ''}
                    </div>

                    ${ativ.dica_tripinha ? `
                        <div class="atividade-dica">
                            <span class="dica-icon">💡</span>
                            <p><strong>Dica da Tripinha:</strong> ${ativ.dica_tripinha}</p>
                        </div>
                    ` : ''}

                    <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-maps">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        Ver no Google Maps
                    </a>
                </div>
            `;
        };

        const renderPeriodo = (periodo) => {
            const icon = PERIODO_ICONS[periodo.periodo?.toLowerCase()] || '📌';
            const label = (periodo.periodo || '').charAt(0).toUpperCase() + (periodo.periodo || '').slice(1);
            return `
                <div class="periodo-section">
                    <div class="periodo-label">${icon} ${label}</div>
                    ${(periodo.atividades || []).map(renderAtividade).join('')}
                </div>
            `;
        };

        // v2.0: Rastrear destino atual para inserir separadores visuais
        let destinoAnterior = '';

        const renderDia = (dia) => {
            let separadorDestino = '';
            const destinoAtual = dia.destino_atual || '';

            if (isMulti && destinoAtual && destinoAtual !== destinoAnterior) {
                separadorDestino = `
                    <div class="destino-separator">
                        <div class="destino-separator-line"></div>
                        <div class="destino-separator-badge">
                            <span>📍</span>
                            <span>${destinoAtual}</span>
                        </div>
                        <div class="destino-separator-line"></div>
                    </div>
                `;
                destinoAnterior = destinoAtual;
            }

            // v2.0: Badge de transição
            const transicaoBadge = dia.eh_dia_transicao ? `
                <div class="transicao-badge">
                    ✈️ Dia de deslocamento entre cidades
                </div>
            ` : '';

            // v2.0: Clima previsto
            const climaBadge = dia.clima_previsto ? `
                <div class="clima-badge">
                    <span>🌤️</span>
                    <span>${dia.clima_previsto}</span>
                </div>
            ` : '';

            return `
                ${separadorDestino}
                <div class="dia-card">
                    <div class="dia-header">
                        <div class="dia-numero">${dia.dia_numero}</div>
                        <div class="dia-header-info">
                            <div>${dia.titulo || `Dia ${dia.dia_numero}`}</div>
                            <div class="dia-header-data">
                                ${dia.dia_semana || ''}, ${dia.data || ''}
                                ${isMulti && destinoAtual ? ` · ${destinoAtual}` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="dia-body">
                        ${transicaoBadge}
                        ${climaBadge}

                        ${dia.resumo_tripinha ? `
                            <div class="dia-resumo-tripinha">
                                <img src="assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="avatar-mini"
                                     onerror="this.style.display='none'">
                                <p>${dia.resumo_tripinha}</p>
                            </div>
                        ` : ''}
                        ${(dia.periodos || []).map(renderPeriodo).join('')}
                    </div>
                </div>
            `;
        };

        // Badge de observações
        const observacoesBadge = observacoes ? `
            <div class="observacoes-badge">
                <span>📝</span>
                <span>Seus pedidos especiais foram considerados: <strong>"${observacoes.length > 80 ? observacoes.substring(0, 80) + '...' : observacoes}"</strong></span>
            </div>
        ` : '';

        // v2.0: Rota visual dos destinos
        const rotaVisual = isMulti ? `
            <div class="rota-visual">
                ${destinos.map((d, i) => `
                    <span class="rota-cidade">${d.destino}</span>
                    ${i < destinos.length - 1 ? '<span class="rota-seta">→</span>' : ''}
                `).join('')}
            </div>
        ` : '';

        const html = `
            <button class="btn-voltar-topo" onclick="BenetripRoteiro.voltarAoFormulario()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
                </svg>
                Novo roteiro
            </button>

            <div class="roteiro-header">
                <h1>🗺️ ${isMulti ? 'Roteiro Multi-Destino' : `Roteiro para ${destino}`}</h1>
                ${rotaVisual}
                <div class="subtitulo">${idaBR} → ${voltaBR} · ${roteiro._numDias || roteiro.dias?.length || '?'} dias
                    ${roteiro._model && roteiro._model !== 'fallback' ? ' · Curadoria da Tripinha 🐶' : ''}</div>
                ${observacoesBadge}
            </div>

            ${roteiro.resumo_viagem ? `
                <div class="roteiro-resumo">
                    <div class="roteiro-resumo-titulo">
                        <span>🐕</span>
                        <span>Recado da Tripinha</span>
                    </div>
                    <div class="roteiro-resumo-texto">${roteiro.resumo_viagem}</div>
                </div>
            ` : ''}

            ${(roteiro.dias || []).map(renderDia).join('')}

            <div class="compartilhar-section">
                <h3>📤 Compartilhe seu roteiro!</h3>
                <p>Envie para quem vai viajar com você</p>
                <div class="compartilhar-btns">
                    <button class="btn-compartilhar btn-whatsapp" onclick="BenetripRoteiro.compartilharWhatsApp()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                    </button>
                    <button class="btn-compartilhar btn-copiar" onclick="BenetripRoteiro.copiarRoteiro()">
                        📋 Copiar texto
                    </button>
                </div>
            </div>

            <div class="compartilhar-section" style="margin-top: 16px;">
                <p>Quer ajustar algo? Mude suas preferências e gere um novo roteiro!</p>
                <button class="btn-ajustar" onclick="BenetripRoteiro.voltarAoFormulario()">
                    ✏️ Ajustar e Gerar Novo Roteiro
                </button>
            </div>
        `;

        container.innerHTML = html;
        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ================================================================
    // COMPARTILHAMENTO (v2.0: multi-destino aware)
    // ================================================================
    gerarTextoRoteiro(compacto = false) {
        const roteiro = this.state.roteiro;
        const { destino, dataIda, dataVolta, destinos } = this.state.formData;
        if (!roteiro || !roteiro.dias) return '';

        const idaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR');
        const voltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR');
        const isMulti = destinos && destinos.length > 1;

        let texto = `🗺️ *${isMulti ? 'Roteiro Multi-Destino' : `Roteiro para ${destino}`}*\n`;
        if (isMulti) {
            texto += `📍 ${destinos.map(d => d.destino).join(' → ')}\n`;
        }
        texto += `📅 ${idaBR} → ${voltaBR}\n\n`;

        if (roteiro.resumo_viagem && !compacto) {
            texto += `🐕 ${roteiro.resumo_viagem}\n\n`;
        }

        let destinoAnterior = '';

        roteiro.dias.forEach(dia => {
            // Separador de destino para multi-destino
            if (isMulti && dia.destino_atual && dia.destino_atual !== destinoAnterior) {
                texto += `\n🏙️ *═══ ${dia.destino_atual} ═══*\n\n`;
                destinoAnterior = dia.destino_atual;
            }

            texto += `━━━━━━━━━━━━━━━\n`;
            texto += `📌 *Dia ${dia.dia_numero} — ${dia.dia_semana}, ${dia.data}*\n`;
            if (dia.titulo) texto += `${dia.titulo}\n`;
            if (dia.clima_previsto && !compacto) texto += `🌤️ ${dia.clima_previsto}\n`;

            if (dia.resumo_tripinha && !compacto) {
                texto += `🐕 ${dia.resumo_tripinha}\n`;
            }
            texto += `\n`;

            (dia.periodos || []).forEach(periodo => {
                const icons = { 'manhã': '🌅', 'manha': '🌅', 'tarde': '☀️', 'noite': '🌙' };
                const icon = icons[periodo.periodo?.toLowerCase()] || '📌';
                texto += `${icon} *${(periodo.periodo || '').charAt(0).toUpperCase() + (periodo.periodo || '').slice(1)}*\n`;

                (periodo.atividades || []).forEach(ativ => {
                    texto += `  📍 ${ativ.nome}`;
                    if (ativ.duracao_minutos) texto += ` (~${ativ.duracao_minutos}min)`;
                    texto += `\n`;

                    if (ativ.descricao && !compacto) {
                        texto += `     ${ativ.descricao}\n`;
                    }

                    if (ativ.dica_tripinha && !compacto) {
                        texto += `     💡 ${ativ.dica_tripinha}\n`;
                    }

                    const mapsQuery = ativ.google_maps_query || ativ.nome;
                    const mapsUrl = this.buildMapsUrlShort(mapsQuery);
                    texto += `     📍 ${mapsUrl}\n`;
                    texto += `\n`;
                });
            });
        });

        texto += `━━━━━━━━━━━━━━━\n`;
        texto += `✨ Roteiro gerado por Benetrip — benetrip.com.br\n`;
        texto += `🐕 Feito com carinho pela Tripinha!`;

        return texto;
    },

    compartilharWhatsApp() {
        const roteiro = this.state.roteiro;
        if (!roteiro || !roteiro.dias) {
            alert('Nenhum roteiro para compartilhar');
            return;
        }

        let texto = this.gerarTextoRoteiro(false);
        let encoded = encodeURIComponent(texto);

        if (encoded.length > this.config.WHATSAPP_CHAR_LIMIT) {
            this.log('📤 Roteiro longo, usando versão compacta');
            texto = this.gerarTextoRoteiro(true);
            encoded = encodeURIComponent(texto);
        }

        if (encoded.length > this.config.WHATSAPP_CHAR_LIMIT) {
            this.log('📤 Roteiro muito longo, dividindo em partes');
            this.compartilharWhatsAppDividido();
            return;
        }

        const url = `https://wa.me/?text=${encoded}`;
        window.open(url, '_blank');
        this.log('📤 Compartilhado via WhatsApp (completo)');
    },

    compartilharWhatsAppDividido() {
        const roteiro = this.state.roteiro;
        const { destino, dataIda, dataVolta, destinos } = this.state.formData;
        const idaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR');
        const voltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR');
        const isMulti = destinos && destinos.length > 1;
        const totalParts = Math.ceil(roteiro.dias.length / 3);

        const partes = [];
        for (let p = 0; p < totalParts; p++) {
            const startIdx = p * 3;
            const endIdx = Math.min(startIdx + 3, roteiro.dias.length);
            const diasParte = roteiro.dias.slice(startIdx, endIdx);

            let texto = '';

            if (p === 0) {
                texto += `🗺️ *${isMulti ? 'Roteiro Multi-Destino' : `Roteiro para ${destino}`}*\n`;
                if (isMulti) texto += `📍 ${destinos.map(d => d.destino).join(' → ')}\n`;
                texto += `📅 ${idaBR} → ${voltaBR}\n`;
                texto += `📄 Parte ${p + 1}/${totalParts}\n\n`;
            } else {
                texto += `🗺️ *Roteiro ${isMulti ? 'Multi-Destino' : destino}* — Parte ${p + 1}/${totalParts}\n\n`;
            }

            diasParte.forEach(dia => {
                texto += `━━━━━━━━━━━━━━━\n`;
                texto += `📌 *Dia ${dia.dia_numero} — ${dia.dia_semana}, ${dia.data}*`;
                if (dia.destino_atual) texto += ` (${dia.destino_atual})`;
                texto += `\n`;
                if (dia.titulo) texto += `${dia.titulo}\n\n`;

                (dia.periodos || []).forEach(periodo => {
                    const icons = { 'manhã': '🌅', 'manha': '🌅', 'tarde': '☀️', 'noite': '🌙' };
                    const icon = icons[periodo.periodo?.toLowerCase()] || '📌';
                    texto += `${icon} *${(periodo.periodo || '').charAt(0).toUpperCase() + (periodo.periodo || '').slice(1)}*\n`;

                    (periodo.atividades || []).forEach(ativ => {
                        texto += `  📍 ${ativ.nome}`;
                        if (ativ.duracao_minutos) texto += ` (~${ativ.duracao_minutos}min)`;
                        texto += `\n`;
                        const mapsQuery = ativ.google_maps_query || ativ.nome;
                        texto += `     📍 ${this.buildMapsUrlShort(mapsQuery)}\n\n`;
                    });
                });
            });

            if (p === totalParts - 1) {
                texto += `━━━━━━━━━━━━━━━\n`;
                texto += `✨ Roteiro por Benetrip — benetrip.com.br`;
            }

            partes.push(texto);
        }

        const url = `https://wa.me/?text=${encodeURIComponent(partes[0])}`;
        window.open(url, '_blank');

        if (partes.length > 1) {
            const restante = partes.slice(1).join('\n\n');
            navigator.clipboard.writeText(restante).catch(() => {});

            setTimeout(() => {
                alert(
                    `📋 Seu roteiro foi dividido em ${partes.length} partes.\n\n` +
                    `A parte 1 foi aberta no WhatsApp.\n` +
                    `As partes restantes foram copiadas para sua área de transferência — ` +
                    `basta colar (Ctrl+V) na conversa do WhatsApp!`
                );
            }, 500);
        }

        this.log(`📤 Compartilhado via WhatsApp em ${partes.length} parte(s)`);
    },

    async copiarRoteiro() {
        const texto = this.gerarTextoRoteiro(false);
        if (!texto) {
            alert('Nenhum roteiro para copiar');
            return;
        }

        try {
            await navigator.clipboard.writeText(texto);
            this.mostrarFeedbackBotao('.btn-copiar', '✅ Copiado!');
            this.log('📋 Roteiro copiado');
        } catch (err) {
            const textarea = document.createElement('textarea');
            textarea.value = texto;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.mostrarFeedbackBotao('.btn-copiar', '✅ Copiado!');
        }
    },

    mostrarFeedbackBotao(selector, mensagem) {
        const btn = document.querySelector(selector);
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = mensagem;
            setTimeout(() => { btn.innerHTML = original; }, 2000);
        }
    },

    // ================================================================
    // UTILS: LOADING, NAVEGAÇÃO
    // ================================================================
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

    voltarAoFormulario(fromPopstate) {
        document.getElementById('resultados-container').style.display = 'none';
        document.getElementById('resultados-container').innerHTML = '';
        document.getElementById('form-container').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('progress-fill').style.width = '0%';

        this.state.viewingResults = false;

        if (!fromPopstate) {
            if (history.state && history.state.benetripView === 'roteiro') {
                history.back();
            }
        }

        this.log('🔄 Voltou ao formulário');
    }
};

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => BenetripRoteiro.init());
