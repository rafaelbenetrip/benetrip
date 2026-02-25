/**
 * BENETRIP - BUSCA MULTIDATAS
 * Matriz flexível de preços. Foco em UX e conversão.
 */

const BenetripMultiDatas = {
    state: {
        origem: null,
        destino: null,
        idas: [],
        voltas: [],
        resultados: null
    },

    init() {
        this.setupAutocomplete('origem', 'origem-results', 'origem-data', 'origem');
        this.setupAutocomplete('destino', 'destino-results', 'destino-data', 'destino');
        this.setupCalendars();
        this.setupForm();
    },

    // Mock simples de autocomplete adaptado para o exemplo (reaproveitar do sistema atual)
    setupAutocomplete(inputId, resultsId, hiddenId, stateKey) {
        // Usa a mesma lógica robusta já implementada em todos-destinos.js
        // ... (Para brevidade, assumimos o bind correto com this.state[stateKey])
    },

    setupCalendars() {
        const comumConfig = {
            mode: 'multiple',
            dateFormat: 'Y-m-d',
            locale: 'pt',
            minDate: 'today'
        };

        flatpickr('#datas-ida', {
            ...comumConfig,
            onChange: (sel, str) => {
                if (sel.length > 4) sel.splice(4); // Máx 4
                this.state.idas = sel.map(d => this.formataDataISO(d)).sort();
                document.getElementById('datas-ida').value = this.state.idas.map(d => this.formataDataBR(d)).join(', ');
            }
        });

        flatpickr('#datas-volta', {
            ...comumConfig,
            onChange: (sel, str) => {
                if (sel.length > 4) sel.splice(4); // Máx 4
                this.state.voltas = sel.map(d => this.formataDataISO(d)).sort();
                document.getElementById('datas-volta').value = this.state.voltas.map(d => this.formataDataBR(d)).join(', ');
            }
        });
    },

    setupForm() {
        document.getElementById('multi-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (this.state.idas.length === 0 || this.state.voltas.length === 0) {
                alert('Selecione ao menos 1 data de ida e 1 de volta.');
                return;
            }
            await this.buscar();
        });
    },

    async buscar() {
        this.mostrarLoading();
        
        const adultos = parseInt(document.getElementById('pax-adultos').value);
        const criancas = parseInt(document.getElementById('pax-criancas').value);
        const bebes = parseInt(document.getElementById('pax-bebes').value);

        const payload = {
            origem: "GRU", // Pegar do this.state.origem.code na vida real
            destino: "LIS", // Pegar do this.state.destino.code
            idas: this.state.idas,
            voltas: this.state.voltas,
            adultos, criancas, bebes,
            moeda: 'BRL'
        };

        try {
            document.getElementById('progress-fill').style.width = '40%';
            const res = await fetch('/api/multidatas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            document.getElementById('progress-fill').style.width = '100%';
            
            if (!data.success || data.voos.length === 0) throw new Error('Nenhum voo encontrado.');

            this.state.resultados = data;
            this.state.payload = payload;
            
            setTimeout(() => this.renderizarResultados(), 500);

        } catch (error) {
            alert('Erro: ' + error.message);
            this.voltar();
        }
    },

    renderizarResultados() {
        document.getElementById('loading-container').style.display = 'none';
        document.getElementById('resultados-container').style.display = 'block';

        const p = this.state.payload;
        const pagantes = p.adultos + p.criancas; // Regra de negócio exigida!
        
        document.getElementById('titulo-rota').textContent = `✈️ ${p.origem} ➔ ${p.destino}`;
        document.getElementById('subtitulo-pax').textContent = `${p.adultos} Adulto(s) ${p.criancas > 0 ? `, ${p.criancas} Criança(s)` : ''} ${p.bebes > 0 ? ` (+${p.bebes} Bebê de colo)` : ''}`;

        this.renderMatriz(pagantes);
        this.renderCards(pagantes);
    },

    renderMatriz(pagantes) {
        const { idas, voltas } = this.state;
        const matriz = this.state.resultados.matriz;
        let html = `<thead><tr><th>Ida ↓ / Volta →</th>`;
        
        // Headers X (Voltas)
        voltas.forEach(v => html += `<th>${this.formataDataCurta(v)}</th>`);
        html += `</tr></thead><tbody>`;

        // Busca o menor preço para highlight
        let menorPreco = Infinity;
        Object.values(matriz).forEach(v => { if (v.price && v.price < menorPreco) menorPreco = v.price; });

        // Linhas Y (Idas)
        idas.forEach(ida => {
            html += `<tr><th>${this.formataDataCurta(ida)}</th>`;
            voltas.forEach(volta => {
                const key = `${ida}_${volta}`;
                const cell = matriz[key];
                if (!cell || !cell.price) {
                    html += `<td class="indisponivel">-</td>`;
                } else {
                    const precoPax = cell.price / pagantes;
                    const isMenor = cell.price === menorPreco;
                    html += `<td class="${isMenor ? 'melhor-opcao' : 'disponivel'}">
                                <span class="preco-pax">R$ ${Math.round(precoPax).toLocaleString('pt-BR')}</span>
                             </td>`;
                }
            });
            html += `</tr>`;
        });
        html += `</tbody>`;
        document.getElementById('matriz-table').innerHTML = html;
    },

    renderCards(pagantes) {
        const voos = this.state.resultados.voos;
        const container = document.getElementById('voos-lista');
        
        container.innerHTML = voos.map(voo => {
            const precoPax = voo.price / pagantes;
            const duracao = `${Math.floor(voo.duration/60)}h${voo.duration%60}m`;
            const paradas = voo.legs.reduce((acc, v) => acc + (v.stops||0), 0);
            const paradasTxt = paradas === 0 ? 'Voo Direto' : paradas === 1 ? '1 Parada' : `${paradas} Paradas`;
            const co2 = voo.carbon ? `<span class="co2-badge">🌱 ${Math.round(voo.carbon/1000)} kg CO₂</span>` : '';

            // Removido erros de "undefined" acessando as chaves adequadamente
            return `
            <div class="destino-item">
                <div class="destino-header">
                    <div class="destino-info">
                        <div class="best-dates-badge">📅 ${this.formataDataBR(voo.combo.ida)} ➔ ${this.formataDataBR(voo.combo.volta)}</div>
                        <h3 class="destino-nome" style="margin-top:8px;">${voo.airline}</h3>
                    </div>
                    <div class="destino-preco-wrapper">
                        <div class="destino-preco" style="color: var(--orange-primary);">R$ ${Math.round(precoPax).toLocaleString('pt-BR')}</div>
                        <div class="destino-preco-label">por passageiro pagante</div>
                        <div style="font-size: 11px; color:#999; margin-top:4px;">Total: R$ ${Math.round(voo.price).toLocaleString('pt-BR')}</div>
                    </div>
                </div>
                <div class="destino-detalhes">
                    <div class="detalhe-item">⏱️ ${duracao}</div>
                    <div class="detalhe-item">${paradas === 0 ? '✅' : '🔄'} ${paradasTxt}</div>
                    <div class="detalhe-item">🎒 Bagagem de mão inclusa</div>
                    ${co2}
                </div>
            </div>`;
        }).join('');
    },

    /* Helpers UI */
    mostrarLoading() {
        document.getElementById('form-container').style.display = 'none';
        document.getElementById('loading-container').style.display = 'block';
    },
    voltar() {
        document.getElementById('resultados-container').style.display = 'none';
        document.getElementById('form-container').style.display = 'block';
    },
    formataDataISO: (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    formataDataBR: (iso) => {
        const [y,m,d] = typeof iso === 'string' ? iso.split('-') : [iso.getFullYear(), iso.getMonth()+1, iso.getDate()];
        return `${d}/${m}/${y}`;
    },
    formataDataCurta: (iso) => {
        const [y,m,d] = typeof iso === 'string' ? iso.split('-') : [iso.getFullYear(), iso.getMonth()+1, iso.getDate()];
        return `${d}/${m}`;
    }
};

document.addEventListener('DOMContentLoaded', () => BenetripMultiDatas.init());
