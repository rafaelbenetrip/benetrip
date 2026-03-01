/**
 * BENETRIP - ROTEIRO DE VIAGEM (Formulário)
 * Versão 2.1 - Com campo de observações livres
 * 
 * Coleta preferências do formulário e chama a API /api/generate-itinerary
 * para gerar o roteiro personalizado dia a dia.
 */

const BenetripRoteiroForm = {
    state: {
        formData: {},
        roteiroGerado: null,
        isSubmitting: false
    },

    config: {
        debug: true,
        apiEndpoint: '/api/generate-itinerary'
    },

    log(...args) {
        if (this.config.debug) console.log('[BenetripRoteiro]', ...args);
    },

    error(...args) {
        console.error('[BenetripRoteiro ERROR]', ...args);
    },

    // ================================================================
    // INICIALIZAÇÃO
    // ================================================================
    init() {
        this.log('🗺️ Benetrip Roteiro v2.1 (Observações Livres) inicializando...');

        this.setupCalendar();
        this.setupOptionButtons();
        this.setupCompanhiaConditional();
        this.setupNumberInputs();
        this.setupFamiliaInputs();
        this.setupFormEvents();
        this.setupObservacoesCounter();

        this.log('✅ Inicialização completa');
    },

    // ================================================================
    // CONTADOR DE CARACTERES DO CAMPO OBSERVAÇÕES
    // ================================================================
    setupObservacoesCounter() {
        const obsInput = document.getElementById('observacoes-roteiro');
        const obsCount = document.getElementById('observacoes-roteiro-count');
        if (obsInput && obsCount) {
            obsInput.addEventListener('input', () => {
                obsCount.textContent = obsInput.value.length;
            });
        }
    },

    // ================================================================
    // CALENDÁRIO (Flatpickr)
    // ================================================================
    setupCalendar() {
        const input = document.getElementById('datas-roteiro');
        const dataIda = document.getElementById('data-ida');
        const dataVolta = document.getElementById('data-volta');

        if (!input) return;

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
                        group.querySelectorAll('.btn-option.active').forEach(b => {
                            selected.push(b.dataset.value);
                        });
                        hiddenInput.value = selected.join(',');
                        this.log(`✅ ${field} (multi):`, selected);
                    } else {
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

    // ================================================================
    // COMPANHIA CONDICIONAL (família / amigos)
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
    // NUMBER INPUTS (amigos)
    // ================================================================
    setupNumberInputs() {
        document.querySelectorAll('.btn-number').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.targetNum;
                if (!targetId) return;
                const input = document.getElementById(targetId);
                if (!input) return;

                const value = parseInt(input.value);
                const min = parseInt(input.min);
                const max = parseInt(input.max);
                const action = btn.dataset.action;

                if (action === 'increment' && value < max) input.value = value + 1;
                if (action === 'decrement' && value > min) input.value = value - 1;
            });
        });
    },

    // ================================================================
    // FAMÍLIA INPUTS (adultos, crianças, bebês)
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
                if (action === 'decrement' && value > min) input.value = value - 1;

                this.validarFamilia();
                this.atualizarTotalFamilia();
            });
        });

        this.atualizarTotalFamilia();
    },

    validarFamilia() {
        const adultos = parseInt(document.getElementById('rot-adultos')?.value || 2);
        const bebes = parseInt(document.getElementById('rot-bebes')?.value || 0);
        if (bebes > adultos) {
            document.getElementById('rot-bebes').value = adultos;
        }
    },

    atualizarTotalFamilia() {
        const adultos = parseInt(document.getElementById('rot-adultos')?.value || 2);
        const criancas = parseInt(document.getElementById('rot-criancas')?.value || 0);
        const bebes = parseInt(document.getElementById('rot-bebes')?.value || 0);
        const total = adultos + criancas + bebes;

        const hint = document.getElementById('rot-familia-total-hint');
        if (hint) {
            const parts = [];
            parts.push(`${adultos} adulto${adultos > 1 ? 's' : ''}`);
            if (criancas > 0) parts.push(`${criancas} criança${criancas > 1 ? 's' : ''}`);
            if (bebes > 0) parts.push(`${bebes} bebê${bebes > 1 ? 's' : ''}`);
            hint.textContent = `Total: ${total} passageiro${total > 1 ? 's' : ''} (${parts.join(', ')})`;
        }
    },

    // ================================================================
    // FORMULÁRIO
    // ================================================================
    setupFormEvents() {
        const form = document.getElementById('roteiro-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (this.state.isSubmitting) return;

            if (!this.validarFormulario()) return;

            this.coletarDadosFormulario();
            await this.gerarRoteiro();
        });
    },

    validarFormulario() {
        const destino = document.getElementById('destino').value.trim();
        if (!destino) {
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
            alert('Por favor, escolha o nível de orçamento para atividades');
            return false;
        }

        return true;
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

        this.state.formData = {
            destino: document.getElementById('destino').value.trim(),
            dataIda: document.getElementById('data-ida').value,
            dataVolta: document.getElementById('data-volta').value,
            horarioChegada: document.getElementById('horario-chegada').value || '14:00',
            horarioPartida: document.getElementById('horario-partida').value || '18:00',
            companhia: companhia,
            adultos: adultos,
            criancas: criancas,
            bebes: bebes,
            numPessoas: numPessoas,
            preferencias: prefString,
            preferenciasArray: prefString.split(',').filter(Boolean),
            intensidade: document.getElementById('intensidade-roteiro').value,
            orcamentoAtividades: document.getElementById('orcamento-roteiro').value,
            observacoes: (document.getElementById('observacoes-roteiro')?.value || '').trim(),
        };

        this.log('📝 Dados do roteiro:', this.state.formData);
        if (this.state.formData.observacoes) {
            this.log('💬 Observações do viajante:', this.state.formData.observacoes);
        }
    },

    // ================================================================
    // LABELS
    // ================================================================
    COMPANHIA_MAP: {
        0: 'Viajando sozinho(a)',
        1: 'Viagem romântica (casal)',
        2: 'Viagem em família',
        3: 'Viagem com amigos'
    },

    PREFERENCIAS_MAP: {
        'relax': 'Relaxamento e descanso',
        'aventura': 'Aventura e esportes',
        'cultura': 'Cultura e história',
        'urbano': 'Agito urbano e vida noturna'
    },

    calcularNoites(dataIda, dataVolta) {
        const ida = new Date(dataIda);
        const volta = new Date(dataVolta);
        return Math.ceil((volta - ida) / (1000 * 60 * 60 * 24));
    },

    // ================================================================
    // GERAR ROTEIRO (chamada à API)
    // ================================================================
    async gerarRoteiro() {
        try {
            this.state.isSubmitting = true;
            this.mostrarLoading();

            const fd = this.state.formData;
            const noites = this.calcularNoites(fd.dataIda, fd.dataVolta);

            // Descrição da companhia
            let companhiaDesc = this.COMPANHIA_MAP[fd.companhia] || 'Não informado';
            if (fd.companhia === 2) {
                const parts = [`${fd.adultos} adulto(s)`];
                if (fd.criancas > 0) parts.push(`${fd.criancas} criança(s) de 2-11 anos`);
                if (fd.bebes > 0) parts.push(`${fd.bebes} bebê(s) de 0-1 ano`);
                companhiaDesc = `Viagem em família: ${parts.join(', ')}`;
            }

            // Preferências em texto
            const preferenciasTexto = fd.preferenciasArray
                .map(p => this.PREFERENCIAS_MAP[p] || p)
                .join(' + ');

            this.atualizarProgresso(20, '🐕 Tripinha está montando seu roteiro...');

            const response = await fetch(this.config.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destino: fd.destino,
                    dataIda: fd.dataIda,
                    dataVolta: fd.dataVolta,
                    horarioChegada: fd.horarioChegada,
                    horarioPartida: fd.horarioPartida,
                    companhia: companhiaDesc,
                    numPessoas: fd.numPessoas,
                    adultos: fd.adultos,
                    criancas: fd.criancas,
                    bebes: fd.bebes,
                    noites: noites,
                    preferencias: preferenciasTexto,
                    intensidade: fd.intensidade,
                    orcamentoAtividades: fd.orcamentoAtividades,
                    observacoes: fd.observacoes || ''
                })
            });

            this.atualizarProgresso(70, '✨ Finalizando detalhes...');

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || `Erro ${response.status}`);
            }

            const resultado = await response.json();
            this.state.roteiroGerado = resultado;

            this.atualizarProgresso(100, '🎉 Roteiro pronto!');
            await this.delay(500);

            this.mostrarResultados(resultado);

        } catch (erro) {
            this.error('Erro ao gerar roteiro:', erro);
            alert(`Erro: ${erro.message}. Tente novamente.`);
            this.esconderLoading();
        } finally {
            this.state.isSubmitting = false;
        }
    },

    // ================================================================
    // UI HELPERS
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
        const fill = document.getElementById('progress-fill');
        const message = document.getElementById('loading-message');
        if (fill) fill.style.width = `${pct}%`;
        if (message) message.textContent = msg;
    },

    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    },

    mostrarResultados(resultado) {
        const container = document.getElementById('resultados-container');

        // O resultado vem da API como JSON com o roteiro dia a dia
        // A renderização depende da estrutura retornada pelo generate-itinerary
        // Aqui montamos o HTML baseado na resposta
        
        let html = `
            <button class="btn-voltar-topo" onclick="BenetripRoteiroForm.voltarAoFormulario()">
                ← Nova busca
            </button>
            <div class="roteiro-resultado">
                <h2>🗺️ Roteiro para ${this.state.formData.destino}</h2>
                <p class="roteiro-periodo">${this.state.formData.dataIda} → ${this.state.formData.dataVolta}</p>
        `;

        if (resultado.roteiro && Array.isArray(resultado.roteiro.dias)) {
            resultado.roteiro.dias.forEach(dia => {
                html += `
                    <div class="roteiro-dia">
                        <h3>${dia.titulo || 'Dia ' + dia.numero}</h3>
                        ${dia.resumo_tripinha ? `<p class="tripinha-resumo">${dia.resumo_tripinha}</p>` : ''}
                        <div class="atividades">
                            ${(dia.atividades || []).map(a => `
                                <div class="atividade-item">
                                    <span class="horario">${a.horario || ''}</span>
                                    <div class="atividade-info">
                                        <strong>${a.local || a.nome || ''}</strong>
                                        <p>${a.descricao || ''}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        ${dia.dica_tripinha ? `<div class="dica-tripinha">💡 ${dia.dica_tripinha}</div>` : ''}
                    </div>
                `;
            });
        } else if (typeof resultado === 'string') {
            html += `<div class="roteiro-texto">${resultado}</div>`;
        } else {
            html += `<pre>${JSON.stringify(resultado, null, 2)}</pre>`;
        }

        html += `
            </div>
            <button class="btn-submit" onclick="BenetripRoteiroForm.voltarAoFormulario()">
                ✏️ Ajustar e Gerar Novo Roteiro
            </button>
        `;

        container.innerHTML = html;
        document.getElementById('loading-container').style.display = 'none';
        container.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    voltarAoFormulario() {
        document.getElementById('resultados-container').style.display = 'none';
        document.getElementById('resultados-container').innerHTML = '';
        document.getElementById('form-container').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('progress-fill').style.width = '0%';
        this.log('🔄 Voltou ao formulário');
    }
};

document.addEventListener('DOMContentLoaded', () => BenetripRoteiroForm.init());
