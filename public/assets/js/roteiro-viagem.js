/**
 * BENETRIP - ROTEIRO DE VIAGEM
 * v1.1 - Campo de observações + compartilhamento corrigido
 * 
 * Changelog v1.1:
 * - Campo de observações livres do usuário (pedidos especiais)
 * - Contador de caracteres no campo de observações
 * - Exibição de badge quando observações são usadas no resultado
 * - Correção WhatsApp: links Google Maps curtos (maps.app.goo.gl format)
 * - Correção WhatsApp: roteiro completo sem cortes
 * - Compartilhamento dividido em partes se exceder limite do WhatsApp
 */

const BenetripRoteiro = {
    state: {
        formData: {},
        roteiro: null,
        viewingResults: false
    },

    config: {
        debug: true,
        // Limite seguro de caracteres para URL do WhatsApp (~4000 chars encodados)
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
        this.log('🗺️ Benetrip Roteiro v1.1 inicializando...');

        this.setupCalendar();
        this.setupOptionButtons();
        this.setupCompanhiaConditional();
        this.setupFamiliaInputs();
        this.setupNumberInput();
        this.setupFormEvents();
        this.setupHistoryNavigation();
        this.setupObservacoesCounter();

        this.log('✅ Inicialização completa');
    },

    // ================================================================
    // NOVO: Contador de caracteres do campo de observações
    // ================================================================
    setupObservacoesCounter() {
        const textarea = document.getElementById('observacoes-roteiro');
        const counter = document.getElementById('observacoes-count');
        const counterWrapper = textarea?.closest('.form-group')?.querySelector('.observacoes-counter');

        if (!textarea || !counter) return;

        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            counter.textContent = len;

            // Feedback visual conforme se aproxima do limite
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
    // CALENDÁRIO
    // ================================================================
    setupCalendar() {
        const input = document.getElementById('datas-roteiro');
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
                    this.log('📅 Datas:', dataIda.value, '→', dataVolta.value);
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
    // INPUTS DE FAMÍLIA (adultos/crianças/bebês)
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

    validarFormulario() {
        if (!document.getElementById('destino').value.trim()) {
            alert('Por favor, informe o destino da viagem');
            document.getElementById('destino').focus();
            return false;
        }
        if (!document.getElementById('data-ida').value || !document.getElementById('data-volta').value) {
            alert('Por favor, selecione as datas da viagem');
            document.getElementById('datas-roteiro').focus();
            return false;
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

        // NOVO: Coletar observações do usuário
        const observacoes = (document.getElementById('observacoes-roteiro')?.value || '').trim();

        this.state.formData = {
            destino: document.getElementById('destino').value.trim(),
            dataIda: document.getElementById('data-ida').value,
            dataVolta: document.getElementById('data-volta').value,
            horarioChegada: document.getElementById('horario-chegada').value,
            horarioPartida: document.getElementById('horario-partida').value,
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
            observacoes, // NOVO campo
        };

        this.log('📝 Dados coletados:', this.state.formData);
        if (observacoes) {
            this.log('📝 Observações do usuário:', observacoes);
        }
    },

    // ================================================================
    // GERAR ROTEIRO (chamada à API)
    // ================================================================
    async gerarRoteiro() {
        try {
            this.mostrarLoading();
            this.atualizarProgresso(10, '🔍 Pesquisando os melhores lugares...');

            await this.delay(500);
            this.atualizarProgresso(30, '🗺️ Montando o roteiro dia a dia...');

            const response = await fetch('/api/generate-itinerary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.state.formData)
            });

            this.atualizarProgresso(70, '🐕 Tripinha adicionando dicas especiais...');

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Erro ao gerar roteiro');
            }

            const roteiro = await response.json();
            this.state.roteiro = roteiro;

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
    // HELPER: Gera link curto do Google Maps
    // Usa formato https://maps.google.com/?q=QUERY que é mais curto
    // ================================================================
    buildMapsUrl(query) {
        if (!query) return '';
        return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
    },

    // Helper: gera link curto para texto (compartilhamento)
    // Formato minimalista para caber no WhatsApp
    buildMapsUrlShort(query) {
        if (!query) return '';
        // Remove acentos e caracteres especiais para URL mais curta
        return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
    },

    // ================================================================
    // RENDERIZAÇÃO DO ROTEIRO
    // ================================================================
    mostrarRoteiro(roteiro) {
        const container = document.getElementById('resultados-container');
        this.pushResultsState();

        const { destino, dataIda, dataVolta, observacoes } = this.state.formData;
        const idaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        const voltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

        const PERIODO_ICONS = {
            'manhã': '🌅',
            'manha': '🌅',
            'tarde': '☀️',
            'noite': '🌙'
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

        const renderDia = (dia) => {
            return `
                <div class="dia-card">
                    <div class="dia-header">
                        <div class="dia-numero">${dia.dia_numero}</div>
                        <div class="dia-header-info">
                            <div>${dia.titulo || `Dia ${dia.dia_numero}`}</div>
                            <div class="dia-header-data">${dia.dia_semana || ''}, ${dia.data || ''}</div>
                        </div>
                    </div>
                    <div class="dia-body">
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

        // NOVO: Badge indicando que observações foram consideradas
        const observacoesBadge = observacoes ? `
            <div class="observacoes-badge">
                <span>📝</span>
                <span>Seus pedidos especiais foram considerados: <strong>"${observacoes.length > 80 ? observacoes.substring(0, 80) + '...' : observacoes}"</strong></span>
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
                <h1>🗺️ Roteiro para ${destino}</h1>
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
    // COMPARTILHAMENTO - REFATORADO v1.1
    // ================================================================

    /**
     * Gera texto do roteiro para compartilhamento.
     * NOVO: usa links curtos do Google Maps para caber no WhatsApp
     * @param {boolean} compacto - Se true, gera versão mais compacta para WhatsApp
     */
    gerarTextoRoteiro(compacto = false) {
        const roteiro = this.state.roteiro;
        const { destino, dataIda, dataVolta } = this.state.formData;
        if (!roteiro || !roteiro.dias) return '';

        const idaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR');
        const voltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR');

        let texto = `🗺️ *Roteiro para ${destino}*\n`;
        texto += `📅 ${idaBR} → ${voltaBR}\n\n`;

        if (roteiro.resumo_viagem && !compacto) {
            texto += `🐕 ${roteiro.resumo_viagem}\n\n`;
        }

        roteiro.dias.forEach(dia => {
            texto += `━━━━━━━━━━━━━━━\n`;
            texto += `📌 *Dia ${dia.dia_numero} — ${dia.dia_semana}, ${dia.data}*\n`;
            if (dia.titulo) texto += `${dia.titulo}\n`;

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

                    // CORREÇÃO: Link curto do Google Maps
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

    /**
     * CORRIGIDO: Compartilhamento via WhatsApp
     * - Divide em múltiplas mensagens se o roteiro for longo
     * - Usa links curtos do Google Maps
     */
    compartilharWhatsApp() {
        const roteiro = this.state.roteiro;
        const { destino, dataIda, dataVolta } = this.state.formData;
        if (!roteiro || !roteiro.dias) {
            alert('Nenhum roteiro para compartilhar');
            return;
        }

        // Primeiro tenta versão completa
        let texto = this.gerarTextoRoteiro(false);
        let encoded = encodeURIComponent(texto);

        // Se exceder limite, tenta versão compacta
        if (encoded.length > this.config.WHATSAPP_CHAR_LIMIT) {
            this.log('📤 Roteiro longo, usando versão compacta');
            texto = this.gerarTextoRoteiro(true);
            encoded = encodeURIComponent(texto);
        }

        // Se ainda exceder, divide por dias
        if (encoded.length > this.config.WHATSAPP_CHAR_LIMIT) {
            this.log('📤 Roteiro muito longo, dividindo em partes');
            this.compartilharWhatsAppDividido();
            return;
        }

        const url = `https://wa.me/?text=${encoded}`;
        window.open(url, '_blank');
        this.log('📤 Compartilhado via WhatsApp (completo)');
    },

    /**
     * Divide o roteiro em múltiplas mensagens do WhatsApp quando é muito longo
     */
    compartilharWhatsAppDividido() {
        const roteiro = this.state.roteiro;
        const { destino, dataIda, dataVolta } = this.state.formData;
        const idaBR = new Date(dataIda + 'T12:00:00').toLocaleDateString('pt-BR');
        const voltaBR = new Date(dataVolta + 'T12:00:00').toLocaleDateString('pt-BR');
        const totalParts = Math.ceil(roteiro.dias.length / 3);

        // Gera parte 1: Header + primeiros dias
        const partes = [];
        for (let p = 0; p < totalParts; p++) {
            const startIdx = p * 3;
            const endIdx = Math.min(startIdx + 3, roteiro.dias.length);
            const diasParte = roteiro.dias.slice(startIdx, endIdx);

            let texto = '';

            if (p === 0) {
                texto += `🗺️ *Roteiro para ${destino}*\n`;
                texto += `📅 ${idaBR} → ${voltaBR}\n`;
                texto += `📄 Parte ${p + 1}/${totalParts}\n\n`;
            } else {
                texto += `🗺️ *Roteiro ${destino}* — Parte ${p + 1}/${totalParts}\n\n`;
            }

            diasParte.forEach(dia => {
                texto += `━━━━━━━━━━━━━━━\n`;
                texto += `📌 *Dia ${dia.dia_numero} — ${dia.dia_semana}, ${dia.data}*\n`;
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

        // Abre a primeira parte
        const url = `https://wa.me/?text=${encodeURIComponent(partes[0])}`;
        window.open(url, '_blank');

        // Copia as demais partes para o clipboard e avisa o usuário
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
            // Fallback para navegadores sem clipboard API
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
