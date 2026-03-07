/**
 * BENETRIP - ROTEIRO DE VIAGEM
 * v2.1 - Calendário encadeado + cidades repetidas + timeout awareness
 * 
 * Changelog v2.1:
 * - FIX: Calendário de destino N+1 inicia a partir da data de saída do destino N
 * - FIX: Ao mudar datas de um destino, atualiza minDate do próximo
 * - FIX: Mensagens de loading mais longas para roteiros grandes
 * - NEW: Exibição de "Xª visita" para cidades repetidas no resultado
 * - NEW: Separador visual diferenciado para retorno a cidade já visitada
 * 
 * Changelog v2.0:
 * - Suporte a múltiplos destinos na mesma viagem
 * - Compartilhamento WhatsApp adaptado para multi-destino
 */

const BenetripRoteiro = {
    state: {
        formData: {},
        roteiro: null,
        viewingResults: false,
        destinoCount: 1,
        maxDestinos: 6,
        flatpickrInstances: {},
    },

    config: {
        debug: true,
        WHATSAPP_CHAR_LIMIT: 3500
    },

    log(...args) { if (this.config.debug) console.log('[Roteiro]', ...args); },
    error(...args) { console.error('[Roteiro ERROR]', ...args); },

    // ================================================================
    // INICIALIZAÇÃO
    // ================================================================
    init() {
        this.log('🗺️ Benetrip Roteiro v2.1 inicializando...');
        this.setupOptionButtons();
        this.setupCompanhiaConditional();
        this.setupFamiliaInputs();
        this.setupNumberInput();
        this.setupFormEvents();
        this.setupHistoryNavigation();
        this.setupObservacoesCounter();
        this.setupCalendarForDestino(1);
        this.setupAdicionarDestino();
        this.log('✅ Inicialização completa');
    },

    // ================================================================
    // v2.1: HELPER — Obter data de saída do destino anterior
    // Percorre os cards DOM na ordem visual para achar o card anterior
    // ================================================================
    getDataSaidaDestinoAnterior(currentIndex) {
        const cards = document.querySelectorAll('#destinos-container .destino-card');
        let previousCard = null;

        for (let i = 0; i < cards.length; i++) {
            const cardIndex = cards[i].dataset.index;
            if (String(cardIndex) === String(currentIndex)) {
                // Achamos o card atual — o anterior é cards[i-1]
                if (i > 0) previousCard = cards[i - 1];
                break;
            }
        }

        if (!previousCard) return null;

        const prevIndex = previousCard.dataset.index;
        const dataSaidaInput = document.getElementById(`data-saida-${prevIndex}`);
        if (dataSaidaInput && dataSaidaInput.value) {
            return dataSaidaInput.value; // formato YYYY-MM-DD
        }
        return null;
    },

    // ================================================================
    // v2.1: HELPER — Atualizar minDate do próximo destino
    // Chamada quando o usuário muda as datas de um destino
    // ================================================================
    atualizarMinDateProximoDestino(currentIndex) {
        const cards = document.querySelectorAll('#destinos-container .destino-card');
        let foundCurrent = false;
        let nextIndex = null;

        for (let i = 0; i < cards.length; i++) {
            if (String(cards[i].dataset.index) === String(currentIndex)) {
                foundCurrent = true;
                continue;
            }
            if (foundCurrent) {
                nextIndex = cards[i].dataset.index;
                break;
            }
        }

        if (!nextIndex) return; // Não há próximo destino

        const dataSaida = document.getElementById(`data-saida-${currentIndex}`)?.value;
        if (!dataSaida) return;

        const instance = this.state.flatpickrInstances[nextIndex];
        if (instance) {
            // A data mínima do próximo é a data de saída do atual
            const minDate = new Date(dataSaida + 'T12:00:00');
            instance.set('minDate', minDate);

            // Se as datas já selecionadas no próximo são anteriores, limpar
            const chegadaProximo = document.getElementById(`data-chegada-${nextIndex}`)?.value;
            if (chegadaProximo && new Date(chegadaProximo + 'T12:00:00') < minDate) {
                instance.clear();
                document.getElementById(`data-chegada-${nextIndex}`).value = '';
                document.getElementById(`data-saida-${nextIndex}`).value = '';
                document.getElementById(`datas-roteiro-${nextIndex}`).value = '';
            }

            this.log(`📅 MinDate destino ${nextIndex} atualizado para ${dataSaida}`);
        }
    },

    // ================================================================
    // SISTEMA MULTI-DESTINO
    // ================================================================
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
            if (this.state.destinoCount >= this.state.maxDestinos) btn.style.display = 'none';
            this.atualizarLabelsDestino();
            this.log(`➕ Destino ${this.state.destinoCount} adicionado`);
        });
    },

    adicionarDestinoCard(index) {
        const container = document.getElementById('destinos-container');

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
        requestAnimationFrame(() => card.classList.add('destino-card-visible'));

        // v2.1: Inicializar calendário COM base no destino anterior
        this.setupCalendarForDestino(index);

        setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    },

    removerDestino(index) {
        if (this.state.destinoCount <= 1) return;
        const card = document.getElementById(`destino-card-${index}`);
        if (!card) return;

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
            if (this.state.flatpickrInstances[index]) {
                this.state.flatpickrInstances[index].destroy();
                delete this.state.flatpickrInstances[index];
            }
            const btn = document.getElementById('btn-adicionar-destino');
            if (btn && this.state.destinoCount < this.state.maxDestinos) btn.style.display = '';
            this.renumerarDestinos();
            this.atualizarLabelsDestino();
            this.log(`➖ Destino ${index} removido. Total: ${this.state.destinoCount}`);
        }, 400);
    },

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

    atualizarLabelsDestino() {
        const cards = document.querySelectorAll('#destinos-container .destino-card');
        cards.forEach((card, i) => {
            const title = card.querySelector('.destino-card-title');
            const removeBtn = card.querySelector('.destino-card-remove');
            if (title) title.textContent = this.state.destinoCount > 1 ? `Destino ${i + 1}` : 'Destino';
            if (removeBtn) removeBtn.style.display = this.state.destinoCount > 1 ? '' : 'none';
        });
        const addHint = document.getElementById('adicionar-destino-hint');
        if (addHint) {
            addHint.textContent = this.state.destinoCount > 1
                ? `${this.state.destinoCount} destinos adicionados`
                : 'Viagem com parada em mais de uma cidade? Adicione!';
        }
    },

    // ================================================================
    // v2.1: CALENDÁRIO (encadeado entre destinos)
    // ================================================================
    setupCalendarForDestino(index) {
        const input = document.getElementById(`datas-roteiro-${index}`);
        const dataChegada = document.getElementById(`data-chegada-${index}`);
        const dataSaida = document.getElementById(`data-saida-${index}`);
        if (!input || !dataChegada || !dataSaida) return;

        // v2.1: Determinar minDate baseado no destino anterior
        let minDate;
        const dataSaidaAnterior = this.getDataSaidaDestinoAnterior(index);

        if (dataSaidaAnterior) {
            // Próximo destino começa a partir da saída do anterior
            minDate = new Date(dataSaidaAnterior + 'T12:00:00');
            this.log(`📅 Destino ${index}: minDate = ${dataSaidaAnterior} (baseado no destino anterior)`);
        } else {
            // Primeiro destino: amanhã
            minDate = new Date();
            minDate.setDate(minDate.getDate() + 1);
        }

        const instance = flatpickr(input, {
            mode: 'range',
            minDate: minDate,
            defaultDate: dataSaidaAnterior ? [minDate] : undefined,
            dateFormat: 'Y-m-d',
            locale: 'pt',
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    dataChegada.value = this.formatarDataISO(selectedDates[0]);
                    dataSaida.value = this.formatarDataISO(selectedDates[1]);
                    input.value = `${this.formatarDataBR(selectedDates[0])} → ${this.formatarDataBR(selectedDates[1])}`;
                    this.log(`📅 Destino ${index}:`, dataChegada.value, '→', dataSaida.value);

                    // v2.1: Propagar a data de saída para o próximo destino
                    this.atualizarMinDateProximoDestino(index);
                }
            }
        });

        this.state.flatpickrInstances[index] = instance;
    },

    setupCalendar() { /* Legacy — não faz nada */ },

    formatarDataISO(data) {
        return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
    },

    formatarDataBR(data) {
        return data.toLocaleDateString('pt-BR');
    },

    // ================================================================
    // OBSERVAÇÕES
    // ================================================================
    setupObservacoesCounter() {
        const textarea = document.getElementById('observacoes-roteiro');
        const counter = document.getElementById('observacoes-count');
        const wrapper = textarea?.closest('.form-group')?.querySelector('.observacoes-counter');
        if (!textarea || !counter) return;
        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            counter.textContent = len;
            if (wrapper) {
                wrapper.classList.remove('near-limit', 'at-limit');
                if (len >= 800) wrapper.classList.add('at-limit');
                else if (len >= 650) wrapper.classList.add('near-limit');
            }
        });
    },

    // ================================================================
    // HISTÓRICO
    // ================================================================
    setupHistoryNavigation() {
        window.addEventListener('popstate', () => {
            if (this.state.viewingResults) {
                this.log('🔙 Voltar interceptado');
                this.voltarAoFormulario(true);
            }
        });
    },

    pushResultsState() {
        history.pushState({ benetripView: 'roteiro' }, '', '');
        this.state.viewingResults = true;
    },

    // ================================================================
    // BOTÕES DE OPÇÃO
    // ================================================================
    setupOptionButtons() {
        document.querySelectorAll('.button-group').forEach(group => {
            const field = group.dataset.field;
            if (!field) return;
            const hidden = document.getElementById(field);
            const isMulti = group.dataset.multi === 'true';
            group.querySelectorAll('.btn-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (isMulti) {
                        btn.classList.toggle('active');
                        const sel = [];
                        group.querySelectorAll('.btn-option.active').forEach(b => sel.push(b.dataset.value));
                        hidden.value = sel.join(',');
                    } else {
                        group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        hidden.value = btn.dataset.value;
                    }
                    hidden.dispatchEvent(new Event('change'));
                });
            });
        });
    },

    setupCompanhiaConditional() {
        const input = document.getElementById('companhia-roteiro');
        if (!input) return;
        input.addEventListener('change', () => {
            const v = parseInt(input.value);
            document.getElementById('num-pessoas-roteiro-group').style.display = v === 3 ? 'block' : 'none';
            document.getElementById('familia-roteiro-group').style.display = v === 2 ? 'block' : 'none';
        });
    },

    setupFamiliaInputs() {
        document.querySelectorAll('.btn-number-sm').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.target);
                if (!input) return;
                const val = parseInt(input.value), min = parseInt(input.min), max = parseInt(input.max);
                if (btn.dataset.action === 'increment' && val < max) input.value = val + 1;
                else if (btn.dataset.action === 'decrement' && val > min) input.value = val - 1;
                this.validarFamilia();
                this.atualizarTotalFamilia();
            });
        });
        this.atualizarTotalFamilia();
    },

    validarFamilia() {
        const a = parseInt(document.getElementById('rot-adultos').value);
        const b = parseInt(document.getElementById('rot-bebes').value);
        if (b > a) document.getElementById('rot-bebes').value = a;
    },

    atualizarTotalFamilia() {
        const a = parseInt(document.getElementById('rot-adultos')?.value || 2);
        const c = parseInt(document.getElementById('rot-criancas')?.value || 0);
        const b = parseInt(document.getElementById('rot-bebes')?.value || 0);
        const total = a + c + b;
        const hint = document.getElementById('rot-familia-total-hint');
        if (hint) {
            const parts = [`${a} adulto${a > 1 ? 's' : ''}`];
            if (c > 0) parts.push(`${c} criança${c > 1 ? 's' : ''}`);
            if (b > 0) parts.push(`${b} bebê${b > 1 ? 's' : ''}`);
            hint.textContent = `Total: ${total} passageiro${total > 1 ? 's' : ''} (${parts.join(', ')})`;
        }
    },

    setupNumberInput() {
        document.querySelectorAll('.btn-number[data-target-num]').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.targetNum);
                if (!input) return;
                const val = parseInt(input.value);
                if (btn.dataset.action === 'increment' && val < 20) input.value = val + 1;
                else if (btn.dataset.action === 'decrement' && val > 2) input.value = val - 1;
            });
        });
    },

    // ================================================================
    // FORM
    // ================================================================
    setupFormEvents() {
        document.getElementById('roteiro-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.validarFormulario()) return;
            this.coletarDadosFormulario();
            await this.gerarRoteiro();
        });
    },

    validarFormulario() {
        const cards = document.querySelectorAll('#destinos-container .destino-card');
        let datasAnteriorSaida = null;

        for (let i = 0; i < cards.length; i++) {
            const idx = cards[i].dataset.index;
            const dest = document.getElementById(`destino-${idx}`);
            const dc = document.getElementById(`data-chegada-${idx}`);
            const ds = document.getElementById(`data-saida-${idx}`);

            if (!dest?.value.trim()) {
                alert(`Informe o destino ${cards.length > 1 ? (i + 1) : 'da viagem'}`);
                dest?.focus();
                return false;
            }
            if (!dc?.value || !ds?.value) {
                alert(`Selecione as datas ${cards.length > 1 ? 'do destino ' + (i + 1) : 'da viagem'}`);
                return false;
            }
            if (datasAnteriorSaida && cards.length > 1) {
                const chegada = new Date(dc.value + 'T12:00:00');
                const saidaAnt = new Date(datasAnteriorSaida + 'T12:00:00');
                if (chegada < saidaAnt) {
                    alert(`Destino ${i + 1}: a chegada deve ser no mesmo dia ou após a saída do destino anterior.`);
                    return false;
                }
            }
            datasAnteriorSaida = ds.value;
        }

        if (!document.getElementById('companhia-roteiro').value) { alert('Escolha com quem vai viajar'); return false; }
        if (!document.getElementById('preferencias-roteiro').value) { alert('Escolha ao menos uma experiência'); return false; }
        if (!document.getElementById('intensidade-roteiro').value) { alert('Escolha o ritmo'); return false; }
        if (!document.getElementById('orcamento-roteiro').value) { alert('Escolha o orçamento'); return false; }
        return true;
    },

    COMPANHIA_MAP: { 0: 'Sozinho(a)', 1: 'Casal', 2: 'Família', 3: 'Amigos' },
    PREFERENCIAS_MAP: { 'relax': 'Relaxamento e praias', 'aventura': 'Aventura e trilhas', 'cultura': 'Cultura e gastronomia', 'urbano': 'Agito urbano e compras' },

    coletarDadosFormulario() {
        const companhia = parseInt(document.getElementById('companhia-roteiro').value);
        let adultos = 1, criancas = 0, bebes = 0, numPessoas = 1;
        switch (companhia) {
            case 0: break;
            case 1: adultos = 2; numPessoas = 2; break;
            case 2:
                adultos = parseInt(document.getElementById('rot-adultos').value) || 2;
                criancas = parseInt(document.getElementById('rot-criancas').value) || 0;
                bebes = parseInt(document.getElementById('rot-bebes').value) || 0;
                numPessoas = adultos + criancas + bebes; break;
            case 3:
                adultos = parseInt(document.getElementById('num-pessoas-roteiro').value) || 2;
                numPessoas = adultos; break;
        }

        const prefStr = document.getElementById('preferencias-roteiro').value;
        const prefArr = prefStr.split(',').filter(Boolean);
        const prefDesc = prefArr.map(p => this.PREFERENCIAS_MAP[p] || p).join(' + ');
        let compDesc = this.COMPANHIA_MAP[companhia] || '?';
        if (companhia === 2) compDesc = `Família: ${adultos}ad ${criancas}cr ${bebes}bb`;

        const observacoes = (document.getElementById('observacoes-roteiro')?.value || '').trim();

        const destinos = [];
        document.querySelectorAll('#destinos-container .destino-card').forEach(card => {
            const idx = card.dataset.index;
            destinos.push({
                destino: document.getElementById(`destino-${idx}`)?.value.trim() || '',
                dataChegada: document.getElementById(`data-chegada-${idx}`)?.value || '',
                dataSaida: document.getElementById(`data-saida-${idx}`)?.value || '',
                horarioChegada: document.getElementById(`horario-chegada-${idx}`)?.value || '',
                horarioPartida: document.getElementById(`horario-partida-${idx}`)?.value || '',
            });
        });

        this.state.formData = {
            destinos,
            destino: destinos.map(d => d.destino).join(' → '),
            dataIda: destinos[0]?.dataChegada || '',
            dataVolta: destinos[destinos.length - 1]?.dataSaida || '',
            companhia: compDesc, companhiaCode: companhia,
            adultos, criancas, bebes, numPessoas,
            preferencias: prefDesc, preferenciasArray: prefArr,
            intensidade: document.getElementById('intensidade-roteiro').value,
            orcamentoAtividades: document.getElementById('orcamento-roteiro').value,
            observacoes,
        };
        this.log('📝 Dados:', this.state.formData);
    },

    // ================================================================
    // GERAR ROTEIRO
    // ================================================================
    async gerarRoteiro() {
        try {
            this.mostrarLoading();
            const isMulti = this.state.formData.destinos.length > 1;
            const numDest = this.state.formData.destinos.length;

            this.atualizarProgresso(10, isMulti ? '🔍 Pesquisando lugares em cada cidade...' : '🔍 Pesquisando os melhores lugares...');
            await this.delay(500);
            this.atualizarProgresso(25, '🗺️ Montando o roteiro dia a dia...');

            const response = await fetch('/api/generate-itinerary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.state.formData)
            });

            this.atualizarProgresso(60, isMulti
                ? `🐕 Tripinha conectando ${numDest} destinos...`
                : '🐕 Tripinha adicionando dicas especiais...');

            if (!response.ok) throw new Error((await response.json()).message || 'Erro');

            const roteiro = await response.json();
            this.state.roteiro = roteiro;

            if (typeof BenetripAutoSave !== 'undefined') {
                BenetripAutoSave.salvarRoteiro({
                    destino_nome: this.state.formData.destino,
                    data_ida: this.state.formData.dataIda,
                    data_volta: this.state.formData.dataVolta,
                    num_dias: roteiro.dias?.length || 0,
                    companhia: this.state.formData.companhia,
                    preferencias: this.state.formData.preferencias,
                    intensidade: this.state.formData.intensidade,
                    orcamento: this.state.formData.orcamentoAtividades,
                    observacoes: this.state.formData.observacoes,
                    destinos: this.state.formData.destinos,
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

    buildMapsUrl(q) { return q ? `https://maps.google.com/?q=${encodeURIComponent(q)}` : ''; },

    // ================================================================
    // RENDERIZAÇÃO (v2.1: visita_numero + cidades repetidas)
    // ================================================================
    mostrarRoteiro(roteiro) {
        const container = document.getElementById('resultados-container');
        this.pushResultsState();

        const { destino, dataIda, dataVolta, observacoes, destinos } = this.state.formData;
        const idaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        const voltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
        const isMulti = destinos && destinos.length > 1;

        const PERIODO_ICONS = { 'manhã': '🌅', 'manha': '🌅', 'tarde': '☀️', 'noite': '🌙' };
        const TAG_CLASSES = {
            'Imperdível': 'tag-imperdivel', 'Ideal para família': 'tag-familia', 'Histórico': 'tag-historico',
            'Gastronômico': 'tag-gastronomico', 'Compras': 'tag-compras', 'Relaxante': 'tag-relaxante',
            'Aventura': 'tag-aventura', 'Cultural': 'tag-cultural', 'Gratuito': 'tag-gratuito',
            'Vida noturna': 'tag-noturna', 'Natureza': 'tag-natureza', 'Romântico': 'tag-romantico',
        };

        const self = this;

        const renderAtividade = (ativ) => {
            const mapsUrl = self.buildMapsUrl(ativ.google_maps_query || ativ.nome);
            return `
                <div class="atividade-card">
                    <div class="atividade-nome">📍 ${ativ.nome}</div>
                    <div class="atividade-desc">${ativ.descricao || ''}</div>
                    ${(ativ.tags?.length) ? `<div class="atividade-tags">${ativ.tags.map(t => `<span class="tag ${TAG_CLASSES[t]||'tag-default'}">${t}</span>`).join('')}${ativ.gratuito ? '<span class="tag tag-gratuito">Gratuito</span>' : ''}</div>` : ''}
                    <div class="atividade-meta">
                        ${ativ.duracao_minutos ? `<span>🕐 ~${ativ.duracao_minutos}min</span>` : ''}
                        ${ativ.gratuito === false ? '<span>💰 Pago</span>' : ''}
                    </div>
                    ${ativ.dica_tripinha ? `<div class="atividade-dica"><span class="dica-icon">💡</span><p><strong>Dica da Tripinha:</strong> ${ativ.dica_tripinha}</p></div>` : ''}
                    <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-maps">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Ver no Google Maps
                    </a>
                </div>`;
        };

        const renderPeriodo = (p) => {
            const icon = PERIODO_ICONS[p.periodo?.toLowerCase()] || '📌';
            const label = (p.periodo || '').charAt(0).toUpperCase() + (p.periodo || '').slice(1);
            return `<div class="periodo-section"><div class="periodo-label">${icon} ${label}</div>${(p.atividades || []).map(renderAtividade).join('')}</div>`;
        };

        // v2.1: Rastrear destino+visita para separadores inteligentes
        let chaveAnterior = '';

        const renderDia = (dia) => {
            const dest = dia.destino_atual || '';
            const visita = dia.visita_numero || 1;
            const chaveAtual = `${dest}::${visita}`;
            let separador = '';

            if (isMulti && dest && chaveAtual !== chaveAnterior) {
                // v2.1: Mostrar "Xª visita" se visita > 1
                const visitaLabel = visita > 1 ? ` — ${visita}ª visita` : '';
                const isRetorno = visita > 1;

                separador = `
                    <div class="destino-separator">
                        <div class="destino-separator-line${isRetorno ? ' retorno' : ''}"></div>
                        <div class="destino-separator-badge${isRetorno ? ' retorno' : ''}">
                            <span>${isRetorno ? '🔄' : '📍'}</span>
                            <span>${dest}${visitaLabel}</span>
                        </div>
                        <div class="destino-separator-line${isRetorno ? ' retorno' : ''}"></div>
                    </div>`;
                chaveAnterior = chaveAtual;
            }

            const transicao = dia.eh_dia_transicao ? `<div class="transicao-badge">✈️ Dia de deslocamento entre cidades</div>` : '';
            const clima = dia.clima_previsto ? `<div class="clima-badge"><span>🌤️</span><span>${dia.clima_previsto}</span></div>` : '';

            return `
                ${separador}
                <div class="dia-card">
                    <div class="dia-header">
                        <div class="dia-numero">${dia.dia_numero}</div>
                        <div class="dia-header-info">
                            <div>${dia.titulo || `Dia ${dia.dia_numero}`}</div>
                            <div class="dia-header-data">${dia.dia_semana || ''}, ${dia.data || ''}${isMulti && dest ? ` · ${dest}${visita > 1 ? ` (${visita}ª)` : ''}` : ''}</div>
                        </div>
                    </div>
                    <div class="dia-body">
                        ${transicao}${clima}
                        ${dia.resumo_tripinha ? `<div class="dia-resumo-tripinha"><img src="assets/images/tripinha/avatar-pensando.png" alt="Tripinha" class="avatar-mini" onerror="this.style.display='none'"><p>${dia.resumo_tripinha}</p></div>` : ''}
                        ${(dia.periodos || []).map(renderPeriodo).join('')}
                    </div>
                </div>`;
        };

        const obsBadge = observacoes ? `<div class="observacoes-badge"><span>📝</span><span>Pedidos especiais considerados: <strong>"${observacoes.length > 80 ? observacoes.substring(0, 80) + '...' : observacoes}"</strong></span></div>` : '';

        const rotaVisual = isMulti ? `<div class="rota-visual">${destinos.map((d, i) => `<span class="rota-cidade">${d.destino}</span>${i < destinos.length - 1 ? '<span class="rota-seta">→</span>' : ''}`).join('')}</div>` : '';

        container.innerHTML = `
            <button class="btn-voltar-topo" onclick="BenetripRoteiro.voltarAoFormulario()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                Novo roteiro
            </button>
            <div class="roteiro-header">
                <h1>🗺️ ${isMulti ? 'Roteiro Multi-Destino' : `Roteiro para ${destino}`}</h1>
                ${rotaVisual}
                <div class="subtitulo">${idaBR} → ${voltaBR} · ${roteiro._numDias || roteiro.dias?.length || '?'} dias${roteiro._model && roteiro._model !== 'fallback' ? ' · Curadoria da Tripinha 🐶' : ''}</div>
                ${obsBadge}
            </div>
            ${roteiro.resumo_viagem ? `<div class="roteiro-resumo"><div class="roteiro-resumo-titulo"><span>🐕</span><span>Recado da Tripinha</span></div><div class="roteiro-resumo-texto">${roteiro.resumo_viagem}</div></div>` : ''}
            ${(roteiro.dias || []).map(renderDia).join('')}
            <div class="compartilhar-section">
                <h3>📤 Compartilhe seu roteiro!</h3>
                <p>Envie para quem vai viajar com você</p>
                <div class="compartilhar-btns">
                    <button class="btn-compartilhar btn-whatsapp" onclick="BenetripRoteiro.compartilharWhatsApp()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                    </button>
                    <button class="btn-compartilhar btn-copiar" onclick="BenetripRoteiro.copiarRoteiro()">📋 Copiar texto</button>
                </div>
            </div>
            <div class="compartilhar-section" style="margin-top:16px;">
                <p>Quer ajustar? Mude preferências e gere um novo!</p>
                <button class="btn-ajustar" onclick="BenetripRoteiro.voltarAoFormulario()">✏️ Ajustar e Gerar Novo Roteiro</button>
            </div>`;

        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ================================================================
    // COMPARTILHAMENTO
    // ================================================================
    gerarTextoRoteiro(compacto = false) {
        const roteiro = this.state.roteiro;
        const { destino, dataIda, dataVolta, destinos } = this.state.formData;
        if (!roteiro?.dias) return '';

        const idaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR');
        const voltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR');
        const isMulti = destinos?.length > 1;

        let texto = `🗺️ *${isMulti ? 'Roteiro Multi-Destino' : `Roteiro para ${destino}`}*\n`;
        if (isMulti) texto += `📍 ${destinos.map(d => d.destino).join(' → ')}\n`;
        texto += `📅 ${idaBR} → ${voltaBR}\n\n`;
        if (roteiro.resumo_viagem && !compacto) texto += `🐕 ${roteiro.resumo_viagem}\n\n`;

        let destAnterior = '';
        roteiro.dias.forEach(dia => {
            const destAtual = dia.destino_atual || '';
            const visita = dia.visita_numero || 1;
            const chave = `${destAtual}::${visita}`;
            if (isMulti && destAtual && chave !== destAnterior) {
                const label = visita > 1 ? ` (${visita}ª visita)` : '';
                texto += `\n🏙️ *═══ ${destAtual}${label} ═══*\n\n`;
                destAnterior = chave;
            }
            texto += `━━━━━━━━━━━━━━━\n📌 *Dia ${dia.dia_numero} — ${dia.dia_semana}, ${dia.data}*\n`;
            if (dia.titulo) texto += `${dia.titulo}\n`;
            if (dia.clima_previsto && !compacto) texto += `🌤️ ${dia.clima_previsto}\n`;
            if (dia.resumo_tripinha && !compacto) texto += `🐕 ${dia.resumo_tripinha}\n`;
            texto += '\n';

            (dia.periodos || []).forEach(p => {
                const icons = { 'manhã': '🌅', 'manha': '🌅', 'tarde': '☀️', 'noite': '🌙' };
                texto += `${icons[p.periodo?.toLowerCase()] || '📌'} *${(p.periodo || '').charAt(0).toUpperCase() + (p.periodo || '').slice(1)}*\n`;
                (p.atividades || []).forEach(a => {
                    texto += `  📍 ${a.nome}${a.duracao_minutos ? ` (~${a.duracao_minutos}min)` : ''}\n`;
                    if (a.descricao && !compacto) texto += `     ${a.descricao}\n`;
                    if (a.dica_tripinha && !compacto) texto += `     💡 ${a.dica_tripinha}\n`;
                    texto += `     📍 ${this.buildMapsUrl(a.google_maps_query || a.nome)}\n\n`;
                });
            });
        });
        texto += `━━━━━━━━━━━━━━━\n✨ Roteiro por Benetrip — benetrip.com.br\n🐕 Feito com carinho pela Tripinha!`;
        return texto;
    },

    compartilharWhatsApp() {
        if (!this.state.roteiro?.dias) { alert('Nenhum roteiro'); return; }
        let texto = this.gerarTextoRoteiro(false);
        let enc = encodeURIComponent(texto);
        if (enc.length > this.config.WHATSAPP_CHAR_LIMIT) {
            texto = this.gerarTextoRoteiro(true);
            enc = encodeURIComponent(texto);
        }
        if (enc.length > this.config.WHATSAPP_CHAR_LIMIT) { this.compartilharWhatsAppDividido(); return; }
        window.open(`https://wa.me/?text=${enc}`, '_blank');
    },

    compartilharWhatsAppDividido() {
        const r = this.state.roteiro, { destino, dataIda, dataVolta, destinos } = this.state.formData;
        const idaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR');
        const voltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR');
        const isMulti = destinos?.length > 1;
        const totalParts = Math.ceil(r.dias.length / 3);
        const partes = [];
        for (let p = 0; p < totalParts; p++) {
            const dias = r.dias.slice(p * 3, Math.min((p + 1) * 3, r.dias.length));
            let t = p === 0 ? `🗺️ *${isMulti ? 'Multi-Destino' : destino}*\n📅 ${idaBR} → ${voltaBR}\n📄 ${p + 1}/${totalParts}\n\n` : `🗺️ *Roteiro* — ${p + 1}/${totalParts}\n\n`;
            dias.forEach(dia => {
                t += `━━━━━━━━━━━━━━━\n📌 *Dia ${dia.dia_numero} — ${dia.dia_semana}, ${dia.data}*${dia.destino_atual ? ` (${dia.destino_atual})` : ''}\n${dia.titulo || ''}\n\n`;
                (dia.periodos || []).forEach(per => {
                    t += `${{'manhã':'🌅','tarde':'☀️','noite':'🌙'}[per.periodo?.toLowerCase()] || '📌'} *${(per.periodo||'').charAt(0).toUpperCase()+(per.periodo||'').slice(1)}*\n`;
                    (per.atividades || []).forEach(a => { t += `  📍 ${a.nome}${a.duracao_minutos ? ` (~${a.duracao_minutos}min)` : ''}\n     📍 ${this.buildMapsUrl(a.google_maps_query || a.nome)}\n\n`; });
                });
            });
            if (p === totalParts - 1) t += `━━━━━━━━━━━━━━━\n✨ Benetrip — benetrip.com.br`;
            partes.push(t);
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(partes[0])}`, '_blank');
        if (partes.length > 1) {
            navigator.clipboard.writeText(partes.slice(1).join('\n\n')).catch(() => {});
            setTimeout(() => alert(`📋 Roteiro em ${partes.length} partes. Parte 1 no WhatsApp, restante copiado — cole com Ctrl+V!`), 500);
        }
    },

    async copiarRoteiro() {
        const t = this.gerarTextoRoteiro(false);
        if (!t) { alert('Nenhum roteiro'); return; }
        try { await navigator.clipboard.writeText(t); } catch { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
        this.mostrarFeedbackBotao('.btn-copiar', '✅ Copiado!');
    },

    mostrarFeedbackBotao(sel, msg) {
        const b = document.querySelector(sel);
        if (b) { const o = b.innerHTML; b.innerHTML = msg; setTimeout(() => b.innerHTML = o, 2000); }
    },

    // ================================================================
    // UTILS
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

    delay(ms) { return new Promise(r => setTimeout(r, ms)); },

    voltarAoFormulario(fromPopstate) {
        document.getElementById('resultados-container').style.display = 'none';
        document.getElementById('resultados-container').innerHTML = '';
        document.getElementById('form-container').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('progress-fill').style.width = '0%';
        this.state.viewingResults = false;
        if (!fromPopstate && history.state?.benetripView === 'roteiro') history.back();
        this.log('🔄 Voltou ao formulário');
    }
};

document.addEventListener('DOMContentLoaded', () => BenetripRoteiro.init());
