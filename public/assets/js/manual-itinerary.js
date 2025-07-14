// ======================================
// BENETRIP - ROTEIRO MANUAL JAVASCRIPT
// ✅ VERSÃO COMPLETA CORRIGIDA - RESULTADO IDÊNTICO AO ITINERARY.JS
// ======================================

class BenetripManualItinerary {
    constructor() {
        this.form = document.getElementById('itineraryForm');
        this.resultContainer = document.getElementById('itineraryResult');
        this.generateBtn = document.getElementById('generateBtn');
        this.btnText = document.getElementById('btnText');
        this.btnSpinner = document.getElementById('btnSpinner');
        
        // ✅ Sistema de cache de imagens
        this.imagensCache = new Map();
        this.imageObserver = null;
        
        this.init();
        this.setupRoteiroEventListeners();
    }

    init() {
        console.log('🚀 Benetrip Roteiro Manual iniciado');
        
        this.setupEventListeners();
        this.setupDateDefaults();
        this.setupHorarioPreview();
        this.configurarLazyLoading();
    }

    // ✅ Event listeners para roteiro (idêntico ao itinerary.js)
    setupRoteiroEventListeners() {
        document.addEventListener('click', (e) => {
            // Botão ver no mapa
            if (e.target.closest('.btn-ver-mapa-mini')) {
                e.preventDefault();
                const botao = e.target.closest('.btn-ver-mapa-mini');
                const local = botao.getAttribute('data-local');
                if (local) {
                    this.abrirMapa(local);
                }
                return;
            }
        });
    }

    // ✅ Configurar Intersection Observer para lazy loading
    configurarLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            this.carregarImagemComFallback(img);
                            this.imageObserver.unobserve(img);
                        }
                    }
                });
            }, {
                rootMargin: '100px 0px',
                threshold: 0.01
            });
        }
    }

    // ✅ Carregamento de imagem com fallback robusto
    carregarImagemComFallback(img) {
        const originalSrc = img.dataset.src;
        const local = img.alt || 'Local';
        
        const fallbacks = [
            originalSrc,
            `https://picsum.photos/400/250?random=${Math.floor(Math.random() * 1000)}`,
            `https://source.unsplash.com/400x250/?travel`,
            this.criarImagemPlaceholderSVG(local)
        ];
        
        let tentativaAtual = 0;
        
        const tentarCarregar = () => {
            if (tentativaAtual >= fallbacks.length) {
                console.warn('⚠️ Todos os fallbacks falharam para:', local);
                img.style.display = 'none';
                return;
            }
            
            const src = fallbacks[tentativaAtual];
            
            img.onload = () => {
                img.style.opacity = '1';
                img.classList.add('loaded');
            };
            
            img.onerror = () => {
                tentativaAtual++;
                console.warn(`⚠️ Falha na imagem ${tentativaAtual}/${fallbacks.length} para:`, local);
                setTimeout(tentarCarregar, 100);
            };
            
            img.src = src;
        };
        
        tentarCarregar();
    }

    // ✅ Cria placeholder SVG
    criarImagemPlaceholderSVG(texto) {
        const svg = `<svg width="400" height="250" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#E87722"/>
            <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" 
                  fill="white" text-anchor="middle" dominant-baseline="middle">
                ${texto}
            </text>
        </svg>`;
        
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    setupEventListeners() {
        // Formulário
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Mostrar/ocultar campo quantidade
        document.getElementById('tipoCompanhia').addEventListener('change', (e) => {
            const quantidadeGroup = document.getElementById('quantidadeGroup');
            const value = e.target.value;
            
            if (value === 'familia' || value === 'amigos') {
                quantidadeGroup.style.display = 'block';
                document.getElementById('quantidade').required = true;
            } else {
                quantidadeGroup.style.display = 'none';
                document.getElementById('quantidade').required = false;
            }
        });
    }

    setupDateDefaults() {
        const hoje = new Date();
        const amanha = new Date(hoje);
        amanha.setDate(hoje.getDate() + 1);
        const duasSemanas = new Date(hoje);
        duasSemanas.setDate(hoje.getDate() + 14);
        
        document.getElementById('dataIda').value = this.formatDate(amanha);
        document.getElementById('dataVolta').value = this.formatDate(duasSemanas);
        
        // Set min date para hoje
        document.getElementById('dataIda').min = this.formatDate(hoje);
        document.getElementById('dataVolta').min = this.formatDate(hoje);
    }

    setupHorarioPreview() {
        const horarioChegada = document.getElementById('horarioChegada');
        const horarioPartida = document.getElementById('horarioPartida');
        
        const atualizarPreview = () => {
            // Remover preview anterior
            document.querySelectorAll('.horario-preview').forEach(el => el.remove());
            
            const horaChegada = parseInt(horarioChegada.value.split(':')[0]);
            const horaPartida = parseInt(horarioPartida.value.split(':')[0]);
            
            // Preview chegada
            let previewChegada = '';
            if (horaChegada >= 20) {
                previewChegada = '🌙 Chegada noturna - apenas check-in e descanso';
            } else if (horaChegada >= 16) {
                previewChegada = '🌅 Chegada tarde - poucas atividades no primeiro dia';
            } else if (horaChegada >= 12) {
                previewChegada = '☀️ Chegada meio-dia - tarde livre para explorar';
            } else {
                previewChegada = '🌟 Chegada cedo - dia completo de atividades!';
            }
            
            // Preview partida
            let previewPartida = '';
            if (horaPartida <= 8) {
                previewPartida = '🌅 Voo matinal - organize tudo na véspera';
            } else if (horaPartida <= 12) {
                previewPartida = '☀️ Voo manhã - último dia pela manhã';
            } else if (horaPartida <= 18) {
                previewPartida = '🌤️ Voo tarde - manhã do último dia livre';
            } else {
                previewPartida = '🌟 Voo noite - último dia completo!';
            }
            
            // Adicionar previews
            if (previewChegada) {
                const previewEl = document.createElement('div');
                previewEl.className = 'horario-preview';
                previewEl.style.cssText = `
                    font-size: 12px;
                    color: #666;
                    margin-top: 4px;
                    padding: 4px 8px;
                    background: rgba(232, 119, 34, 0.1);
                    border-radius: 4px;
                    border-left: 2px solid var(--primary-color);
                `;
                previewEl.textContent = previewChegada;
                horarioChegada.parentNode.appendChild(previewEl);
            }
            
            if (previewPartida) {
                const previewEl = document.createElement('div');
                previewEl.className = 'horario-preview';
                previewEl.style.cssText = `
                    font-size: 12px;
                    color: #666;
                    margin-top: 4px;
                    padding: 4px 8px;
                    background: rgba(0, 163, 224, 0.1);
                    border-radius: 4px;
                    border-left: 2px solid var(--secondary-color);
                `;
                previewEl.textContent = previewPartida;
                horarioPartida.parentNode.appendChild(previewEl);
            }
        };
        
        horarioChegada.addEventListener('change', atualizarPreview);
        horarioPartida.addEventListener('change', atualizarPreview);
        
        // Preview inicial
        setTimeout(atualizarPreview, 100);
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            this.showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const formData = this.getFormData();
            const roteiro = await this.generateItinerary(formData);
            
            this.displayItinerary(roteiro);
            this.showToast('Roteiro criado com sucesso! 🎉', 'success');
        } catch (error) {
            console.error('Erro ao gerar roteiro:', error);
            this.showToast('Erro ao gerar roteiro. Tente novamente.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    validateForm() {
        const requiredFields = this.form.querySelectorAll('[required]');
        let isValid = true;
        
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                field.style.borderColor = 'var(--error)';
            } else {
                field.style.borderColor = 'var(--medium-gray)';
            }
        });
        
        // Validar datas
        const dataIda = new Date(document.getElementById('dataIda').value);
        const dataVolta = new Date(document.getElementById('dataVolta').value);
        
        if (dataVolta <= dataIda) {
            this.showToast('A data de volta deve ser posterior à data de ida.', 'error');
            return false;
        }
        
        // Validar horários (se for viagem de 1 dia)
        const diasViagem = this.calcularDiasViagem(document.getElementById('dataIda').value, document.getElementById('dataVolta').value);
        if (diasViagem === 1) {
            const horarioChegada = document.getElementById('horarioChegada').value;
            const horarioPartida = document.getElementById('horarioPartida').value;
            
            if (horarioPartida <= horarioChegada) {
                this.showToast('Para viagens de 1 dia, o horário de partida deve ser posterior ao de chegada.', 'error');
                return false;
            }
        }
        
        return isValid;
    }

    getFormData() {
        return {
            destino: document.getElementById('destino').value,
            cidadePartida: document.getElementById('cidadePartida').value,
            dataIda: document.getElementById('dataIda').value,
            dataVolta: document.getElementById('dataVolta').value,
            horarioChegada: document.getElementById('horarioChegada').value,
            horarioPartida: document.getElementById('horarioPartida').value,
            tipoCompanhia: document.getElementById('tipoCompanhia').value,
            quantidade: document.getElementById('quantidade').value || 1,
            tipoViagem: document.getElementById('tipoViagem').value,
            intensidade: document.getElementById('intensidade').value,
            nivelOrcamento: document.getElementById('nivelOrcamento').value
        };
    }

    async generateItinerary(formData) {
        try {
            console.log('🤖 Tentando API real de roteiro...', formData);
            
            const parametrosIA = {
                destino: formData.destino,
                pais: this.extrairPais(formData.destino),
                dataInicio: formData.dataIda,
                dataFim: formData.dataVolta,
                horaChegada: formData.horarioChegada,
                horaSaida: formData.horarioPartida,
                tipoViagem: formData.tipoViagem,
                tipoCompanhia: formData.tipoCompanhia,
                quantidade: parseInt(formData.quantidade) || 1,
                intensidade: formData.intensidade,
                nivelOrcamento: formData.nivelOrcamento,
                preferencias: {
                    intensidade: formData.intensidade,
                    nivelOrcamento: formData.nivelOrcamento,
                    quantidade: formData.quantidade
                },
                modeloIA: 'deepseek'
            };
            
            console.log('📡 Enviando para API...', parametrosIA);
            
            const response = await fetch('/api/itinerary-generator', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(parametrosIA),
                signal: AbortSignal.timeout(30000)
            });
            
            let roteiro;
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erro da API:', response.status, errorText);
                throw new Error(`API Error ${response.status}: ${errorText}`);
            }
            
            const roteiroIA = await response.json();
            console.log('✅ Roteiro recebido da IA:', roteiroIA);
            
            roteiro = this.converterRoteiroParaExibicao(roteiroIA, formData);
            
            // ✅ BUSCAR PREVISÃO E IMAGENS EM PARALELO
            await Promise.all([
                this.buscarPrevisaoTempo(roteiro),
                this.buscarImagensParaRoteiro(roteiro)
            ]);
            
            return roteiro;
            
        } catch (erro) {
            console.error('❌ Erro na API, usando fallback robusto:', erro);
            this.showToast('Gerando roteiro offline - funcionalidade completa!', 'info');
            
            const roteiro = this.gerarRoteiroFallbackCompleto(formData);
            
            await Promise.all([
                this.buscarPrevisaoTempo(roteiro),
                this.buscarImagensParaRoteiro(roteiro)
            ]);
            
            return roteiro;
        }
    }

    // ✅ BUSCAR PREVISÃO DO TEMPO (idêntico ao itinerary.js)
    async buscarPrevisaoTempo(roteiro) {
        try {
            console.log('🌤️ Buscando previsão do tempo via API...');
            
            if (!roteiro?.dias || roteiro.dias.length === 0) {
                console.warn('⚠️ Sem dias no roteiro para buscar previsão');
                return;
            }
            
            const cidade = roteiro.resumo?.destino || roteiro.destino;
            const dataInicio = roteiro.resumo?.dataIda;
            const dataFim = roteiro.resumo?.dataVolta;
            const diasComPrevisao = Math.min(3, roteiro.dias.length);
            
            console.log(`📊 Buscando previsão para: ${cidade} (${diasComPrevisao} dias)`);
            
            try {
                const urlAPI = `/api/weather?city=${encodeURIComponent(cidade)}&start=${dataInicio}&end=${dataFim}`;
                
                const response = await fetch(urlAPI, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    signal: AbortSignal.timeout(8000)
                });
                
                if (!response.ok) {
                    throw new Error(`API de tempo falhou: ${response.status}`);
                }
                
                const dadosTempo = await response.json();
                console.log('✅ Dados de tempo recebidos:', dadosTempo);
                
                let aplicados = 0;
                for (let i = 0; i < diasComPrevisao; i++) {
                    if (dadosTempo[i]) {
                        roteiro.dias[i].previsao = {
                            icon: dadosTempo[i].icon || '🌤️',
                            temperature: dadosTempo[i].temperature || 25,
                            condition: dadosTempo[i].condition || 'Tempo agradável',
                            date: dadosTempo[i].date
                        };
                        aplicados++;
                    } else {
                        roteiro.dias[i].previsao = this.gerarPrevisaoFallback(i, cidade);
                    }
                }
                
                console.log(`✅ Previsão REAL aplicada a ${aplicados}/${diasComPrevisao} dias`);
                
            } catch (erroAPI) {
                console.warn('⚠️ Erro na API de tempo, usando fallback:', erroAPI.message);
                
                for (let i = 0; i < diasComPrevisao; i++) {
                    roteiro.dias[i].previsao = this.gerarPrevisaoFallback(i, cidade);
                }
                
                console.log(`🛡️ Previsão FALLBACK aplicada aos primeiros ${diasComPrevisao} dias`);
            }
            
        } catch (erro) {
            console.error('❌ Erro geral na busca de previsão:', erro);
            
            const diasComPrevisao = Math.min(3, roteiro.dias.length);
            for (let i = 0; i < diasComPrevisao; i++) {
                if (!roteiro.dias[i].previsao) {
                    roteiro.dias[i].previsao = this.gerarPrevisaoFallback(i, roteiro.resumo?.destino || 'cidade');
                }
            }
        }
    }

    // ✅ BUSCAR IMAGENS PARA ROTEIRO (estrutura contínua)
    async buscarImagensParaRoteiro(roteiro) {
        try {
            console.log('🖼️ Buscando imagens para roteiro CONTÍNUO...');
            
            if (!roteiro.dias || roteiro.dias.length === 0) {
                console.warn('⚠️ Sem dias no roteiro para buscar imagens');
                return;
            }
            
            // ✅ Coletar TODAS as atividades da estrutura contínua
            const todasAtividades = [];
            roteiro.dias.forEach((dia, diaIndex) => {
                if (dia.atividades?.length) {
                    dia.atividades.forEach((atividade, ativIndex) => {
                        if (atividade.local && !atividade.isEspecial) {
                            todasAtividades.push({
                                atividade,
                                diaIndex,
                                ativIndex,
                                destino: roteiro.resumo?.destino || roteiro.destino
                            });
                        }
                    });
                }
            });
            
            console.log(`📊 ${todasAtividades.length} atividades encontradas para buscar imagens`);
            
            // ✅ Processar em lotes
            const tamanhoLote = 3;
            let sucessos = 0;
            
            for (let i = 0; i < todasAtividades.length; i += tamanhoLote) {
                const lote = todasAtividades.slice(i, i + tamanhoLote);
                
                const promessas = lote.map(async (item) => {
                    try {
                        const resultado = await this.buscarImagemComCache(item.atividade.local, item.destino);
                        
                        if (resultado.sucesso) {
                            item.atividade.imagemUrl = resultado.url;
                            sucessos++;
                        } else {
                            item.atividade.imagemUrl = this.gerarImagemFallback(item.atividade.local, item.diaIndex, item.ativIndex);
                            item.atividade.isFallback = true;
                        }
                        
                        return resultado;
                    } catch (erro) {
                        console.warn(`⚠️ Erro na busca de imagem para ${item.atividade.local}:`, erro);
                        item.atividade.imagemUrl = this.gerarImagemFallback(item.atividade.local, item.diaIndex, item.ativIndex);
                        item.atividade.isFallback = true;
                        return { sucesso: false, erro: erro.message };
                    }
                });
                
                await Promise.allSettled(promessas);
                
                if (i + tamanhoLote < todasAtividades.length) {
                    await this.delay(200);
                }
            }
            
            console.log(`✅ Imagens processadas: ${sucessos} da API, ${todasAtividades.length - sucessos} fallbacks`);
            
        } catch (erro) {
            console.error('❌ Erro ao buscar imagens:', erro);
            this.aplicarFallbacksGlobal(roteiro);
        }
    }

    // ✅ BUSCAR IMAGEM COM CACHE
    async buscarImagemComCache(local, destino) {
        const chaveCache = `${local}-${destino}`;
        
        if (this.imagensCache.has(chaveCache)) {
            return this.imagensCache.get(chaveCache);
        }
        
        try {
            const query = `${local} ${destino}`.trim();
            const url = `/api/image-search?query=${encodeURIComponent(query)}&perPage=1`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const dados = await response.json();
            
            if (dados?.images?.[0]) {
                const imagemUrl = dados.images[0].url || dados.images[0].src?.medium;
                const resultado = { sucesso: true, url: imagemUrl };
                this.imagensCache.set(chaveCache, resultado);
                return resultado;
            }
            
            throw new Error('Sem imagens na resposta');
            
        } catch (erro) {
            const resultado = { sucesso: false, erro: erro.message };
            this.imagensCache.set(chaveCache, resultado);
            return resultado;
        }
    }

    // ✅ GERAR ROTEIRO FALLBACK COMPLETO (estrutura contínua)
    gerarRoteiroFallbackCompleto(formData) {
        console.log('🛡️ Gerando roteiro fallback COMPLETO COM ESTRUTURA CONTÍNUA...');
        
        const diasViagem = this.calcularDiasViagem(formData.dataIda, formData.dataVolta);
        const destino = formData.destino;
        
        const dias = [];
        for (let i = 0; i < diasViagem; i++) {
            const dataAtual = new Date(formData.dataIda);
            dataAtual.setDate(dataAtual.getDate() + i);
            
            const dia = {
                data: this.formatDate(dataAtual),
                descricao: this.obterDescricaoInteligente(i + 1, destino, diasViagem, formData),
                atividades: this.gerarAtividadesFormatoContinuo(formData, i, diasViagem)
            };
            
            // ✅ Adicionar observações especiais
            if (i === 0) {
                dia.observacao = this.obterObservacaoPrimeiroDia(formData.horarioChegada);
            } else if (i === diasViagem - 1) {
                dia.observacao = this.obterObservacaoUltimoDia(formData.horarioPartida);
            }
            
            // ✅ Adicionar previsão do tempo para primeiros 3 dias
            if (i < 3) {
                dia.previsao = this.gerarPrevisaoFallback(i, destino);
            }
            
            dias.push(dia);
        }
        
        // ✅ AJUSTAR ATIVIDADES POR HORÁRIOS
        this.ajustarAtividadesPorHorariosContinuo(dias, formData);
        
        return {
            destino: `${destino}`,
            resumo: {
                destino: destino,
                cidadePartida: formData.cidadePartida,
                dataIda: formData.dataIda,
                dataVolta: formData.dataVolta,
                horarioChegada: formData.horarioChegada,
                horarioPartida: formData.horarioPartida,
                diasViagem: diasViagem,
                tipoCompanhia: formData.tipoCompanhia,
                quantidade: formData.quantidade,
                tipoViagem: formData.tipoViagem
            },
            dias: dias
        };
    }

    // ✅ GERAR ATIVIDADES FORMATO CONTÍNUO
    gerarAtividadesFormatoContinuo(formData, diaIndex, totalDias) {
        const numAtividades = this.obterNumeroAtividades(formData.intensidade);
        const atividadesPorTipo = this.obterAtividadesPorDestino(formData.destino, formData.tipoViagem);
        
        const atividades = [];
        const horariosBase = ['09:00', '11:30', '14:00', '16:30', '19:00'];
        
        for (let i = 0; i < numAtividades; i++) {
            const atividadeIndex = (diaIndex * numAtividades + i) % atividadesPorTipo.length;
            const atividade = { ...atividadesPorTipo[atividadeIndex] };
            
            const atividadeContina = {
                horario: horariosBase[i % horariosBase.length],
                local: atividade.local,
                tags: this.ajustarTagsPorPerfil(atividade.tags, formData),
                dica: this.personalizarDica(atividade.dica, formData),
                duracao: this.estimarDuracao(atividade.local),
                periodo: this.obterPeriodoPorHorario(horariosBase[i % horariosBase.length])
            };
            
            atividades.push(atividadeContina);
        }
        
        return atividades;
    }

    // ✅ CONVERTER ROTEIRO PARA EXIBIÇÃO (estrutura contínua)
    converterRoteiroParaExibicao(roteiroIA, formData) {
        console.log('🔄 Convertendo roteiro da IA para formato CONTÍNUO...');
        
        try {
            if (!roteiroIA.dias || !Array.isArray(roteiroIA.dias)) {
                throw new Error('Estrutura de roteiro inválida da IA');
            }
            
            const diasViagem = this.calcularDiasViagem(formData.dataIda, formData.dataVolta);
            const diasContinuos = this.converterDiasParaContinuo(roteiroIA.dias, formData);
            
            return {
                destino: roteiroIA.destino || formData.destino,
                resumo: {
                    destino: formData.destino,
                    cidadePartida: formData.cidadePartida,
                    dataIda: formData.dataIda,
                    dataVolta: formData.dataVolta,
                    horarioChegada: formData.horarioChegada,
                    horarioPartida: formData.horarioPartida,
                    diasViagem: diasViagem,
                    tipoCompanhia: formData.tipoCompanhia,
                    quantidade: formData.quantidade,
                    tipoViagem: formData.tipoViagem
                },
                dias: diasContinuos
            };
            
        } catch (erro) {
            console.error('❌ Erro ao converter roteiro da IA:', erro);
            return this.gerarRoteiroFallbackCompleto(formData);
        }
    }

    // ✅ CONVERTER DIAS PARA CONTÍNUO
    converterDiasParaContinuo(diasIA, formData) {
        const diasContinuos = [];
        
        diasIA.forEach((diaIA, index) => {
            const dataAtual = new Date(formData.dataIda);
            dataAtual.setDate(dataAtual.getDate() + index);
            
            const diaContino = {
                data: this.formatDate(dataAtual),
                descricao: diaIA.descricao || this.obterDescricaoInteligente(index + 1, formData.destino, diasIA.length, formData),
                atividades: this.converterAtividadesParaContinuo(diaIA, formData)
            };
            
            if (index === 0) {
                diaContino.observacao = this.obterObservacaoPrimeiroDia(formData.horarioChegada);
            } else if (index === diasIA.length - 1) {
                diaContino.observacao = this.obterObservacaoUltimoDia(formData.horarioPartida);
            }
            
            if (index < 3) {
                diaContino.previsao = this.gerarPrevisaoFallback(index, formData.destino);
            }
            
            diasContinuos.push(diaContino);
        });
        
        this.ajustarAtividadesPorHorariosContinuo(diasContinuos, formData);
        return diasContinuos;
    }

    // ✅ CONVERTER ATIVIDADES PARA CONTÍNUO
    converterAtividadesParaContinuo(diaIA, formData) {
        const atividades = [];
        
        if (diaIA.atividades && Array.isArray(diaIA.atividades)) {
            return diaIA.atividades.map(ativ => ({
                horario: ativ.horario || '09:00',
                local: ativ.local || 'Atividade local',
                tags: ativ.tags || ['Recomendado'],
                dica: ativ.dica || 'Aproveite esta experiência única!',
                duracao: this.estimarDuracao(ativ.local || 'Atividade'),
                periodo: this.obterPeriodoPorHorario(ativ.horario || '09:00')
            }));
        }
        
        ['manha', 'tarde', 'noite'].forEach(periodo => {
            if (diaIA[periodo]?.atividades?.length) {
                diaIA[periodo].atividades.forEach(ativ => {
                    const atividadeContina = {
                        horario: ativ.horario || this.obterHorarioPorPeriodo(periodo),
                        local: ativ.local || 'Atividade local',
                        tags: ativ.tags || ['Recomendado'],
                        dica: ativ.dica || 'Aproveite esta experiência única!',
                        duracao: this.estimarDuracao(ativ.local || 'Atividade'),
                        periodo: periodo
                    };
                    
                    if (ativ.local?.includes('Check-in') || 
                        ativ.local?.includes('Transfer') ||
                        ativ.local?.includes('Chegada') ||
                        ativ.local?.includes('Partida')) {
                        atividadeContina.isEspecial = true;
                    }
                    
                    atividades.push(atividadeContina);
                });
            }
        });
        
        if (atividades.length === 0) {
            return this.gerarAtividadesFormatoContinuo(formData, 0, 1);
        }
        
        return atividades;
    }

    // ✅ AJUSTAR ATIVIDADES POR HORÁRIOS CONTÍNUO (idêntico ao itinerary.js)
    ajustarAtividadesPorHorariosContinuo(dias, formData) {
        if (!dias || dias.length === 0) return;
        
        const horaChegada = parseInt(formData.horarioChegada.split(':')[0]);
        const horaPartida = parseInt(formData.horarioPartida.split(':')[0]);
        
        console.log(`🕒 Ajustando atividades CONTÍNUAS: Chegada ${horaChegada}h, Partida ${horaPartida}h`);
        
        // ✅ Ajustar primeiro dia
        const primeiroDia = dias[0];
        
        if (horaChegada >= 20) {
            primeiroDia.atividades = [{
                horario: formData.horarioChegada,
                local: 'Check-in e Jantar no Hotel',
                dica: 'Descanse para começar bem amanhã!',
                tags: ['Chegada', 'Descanso'],
                isEspecial: true,
                duracao: '1 hora'
            }];
        } else if (horaChegada >= 16) {
            primeiroDia.atividades = [
                {
                    horario: formData.horarioChegada,
                    local: 'Check-in no Hotel',
                    dica: 'Deixe as malas e saia para explorar!',
                    tags: ['Chegada'],
                    isEspecial: true,
                    duracao: '30 min'
                },
                ...primeiroDia.atividades.slice(0, 3).map(ativ => ({
                    ...ativ,
                    horario: this.ajustarHorarioCheckIn(ativ.horario, horaChegada)
                }))
            ];
        } else {
            primeiroDia.atividades.unshift({
                horario: formData.horarioChegada,
                local: 'Check-in no Hotel',
                dica: 'Deixe as bagagens e comece a explorar!',
                tags: ['Chegada'],
                isEspecial: true,
                duracao: '30 min'
            });
        }
        
        // ✅ Ajustar último dia
        if (dias.length > 1) {
            const ultimoDia = dias[dias.length - 1];
            
            if (horaPartida <= 8) {
                ultimoDia.atividades = [{
                    horario: '06:00',
                    local: 'Check-out e Transfer para Aeroporto',
                    dica: 'Chegue ao aeroporto com 2h de antecedência!',
                    tags: ['Partida'],
                    isEspecial: true,
                    duracao: '2 horas'
                }];
            } else if (horaPartida <= 12) {
                ultimoDia.atividades = [
                    ...ultimoDia.atividades.slice(0, 3),
                    {
                        horario: `${horaPartida - 3}:00`,
                        local: 'Transfer para Aeroporto',
                        dica: 'Hora de se despedir! Até a próxima!',
                        tags: ['Partida'],
                        isEspecial: true,
                        duracao: '2 horas'
                    }
                ];
            } else {
                ultimoDia.atividades.push({
                    horario: `${horaPartida - 3}:00`,
                    local: 'Transfer para Aeroporto',
                    dica: 'Hora de se despedir! Até a próxima!',
                    tags: ['Partida'],
                    isEspecial: true,
                    duracao: '2 horas'
                });
            }
        }
    }

    // ✅ DISPLAY ITINERARY (estrutura idêntica ao itinerary.js)
    displayItinerary(roteiro) {
        const container = this.resultContainer;
        container.innerHTML = '';
        
        // ✅ Adicionar classe para compatibilidade CSS
        container.classList.add('roteiro-content');
        
        // ✅ USAR OS MESMOS MÉTODOS DO ITINERARY.JS
        container.appendChild(this.criarResumoViagem(roteiro));
        
        roteiro.dias.forEach((dia, index) => {
            container.appendChild(this.criarElementoDiaContinuo(dia, index + 1));
        });
        
        // ✅ Espaçador final
        const spacer = document.createElement('div');
        spacer.style.height = '100px';
        container.appendChild(spacer);
        
        // ✅ Configurar lazy loading APÓS inserir elementos
        this.configurarLazyLoadingParaElementos();
        
        // ✅ Mostrar resultado e scroll
        container.classList.add('visible');
        
        setTimeout(() => {
            container.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 300);
    }

    // ✅ CRIAR RESUMO VIAGEM (idêntico ao itinerary.js)
    criarResumoViagem(roteiro) {
        const resumo = document.createElement('div');
        resumo.className = 'resumo-viagem';
        
        const dataIda = this.formatarData(roteiro.resumo.dataIda);
        const dataVolta = this.formatarData(roteiro.resumo.dataVolta);
        
        resumo.innerHTML = `
            <div class="resumo-viagem-header">
                <span class="icone-header">📋</span>
                <span>Resumo da Viagem</span>
            </div>
            <div class="resumo-viagem-content">
                <div class="resumo-item">
                    <div class="icone">🎯</div>
                    <div class="texto">
                        <div class="label">Destino:</div>
                        <p class="valor">${roteiro.resumo.destino}</p>
                    </div>
                </div>
                
                <div class="resumo-item">
                    <div class="icone">📅</div>
                    <div class="texto">
                        <div class="label">Período:</div>
                        <p class="valor">${dataIda} até ${dataVolta}</p>
                        <p class="valor-secundario">${roteiro.resumo.diasViagem} ${roteiro.resumo.diasViagem === 1 ? 'dia' : 'dias'} de viagem</p>
                    </div>
                </div>
                
                <div class="resumo-item">
                    <div class="icone">✈️</div>
                    <div class="texto">
                        <div class="label">Voos:</div>
                        <p class="valor">Chegada: ${roteiro.resumo.horarioChegada}</p>
                        <p class="valor">Partida: ${roteiro.resumo.horarioPartida}</p>
                    </div>
                </div>
                
                <div class="resumo-item">
                    <div class="icone">${this.obterIconeCompanhia(roteiro.resumo.tipoCompanhia)}</div>
                    <div class="texto">
                        <div class="label">Viajando:</div>
                        <p class="valor">${this.obterTextoCompanhia(roteiro.resumo.tipoCompanhia, roteiro.resumo.quantidade)}</p>
                    </div>
                </div>
                
                <div class="resumo-item">
                    <div class="icone">${this.obterIconeViagem(roteiro.resumo.tipoViagem)}</div>
                    <div class="texto">
                        <div class="label">Estilo:</div>
                        <p class="valor">${this.obterTextoViagem(roteiro.resumo.tipoViagem)}</p>
                    </div>
                </div>
            </div>
        `;
        
        return resumo;
    }

    // ✅ CRIAR ELEMENTO DIA CONTÍNUO (idêntico ao itinerary.js)
    criarElementoDiaContinuo(dia, numeroDia) {
        const elemento = document.createElement('div');
        elemento.className = 'dia-roteiro continuo';
        elemento.setAttribute('data-dia', numeroDia);
        
        const dataFormatada = this.formatarDataCompleta(new Date(dia.data));
        const temPrevisao = dia.previsao && numeroDia <= 3;
        
        elemento.innerHTML = `
            <div class="dia-header">
                <div class="dia-numero">${numeroDia}</div>
                <span>Dia ${numeroDia} — ${dataFormatada}</span>
            </div>
            
            <div class="dia-content">
                <p class="dia-descricao">"${dia.descricao}"</p>
                
                ${dia.observacao ? `
                    <div class="dia-observacao">
                        <span class="icone-obs">💡</span>
                        <span>${dia.observacao}</span>
                    </div>
                ` : ''}
                
                ${temPrevisao ? this.criarPrevisaoTempo(dia.previsao) : ''}
                
                <div class="atividades-continuas">
                    ${this.criarListaAtividadesContinuas(dia.atividades)}
                </div>
            </div>
        `;
        
        return elemento;
    }

    // ✅ CRIAR LISTA ATIVIDADES CONTÍNUAS (idêntico ao itinerary.js)
    criarListaAtividadesContinuas(atividades) {
        if (!atividades?.length) {
            return `
                <div class="dia-livre">
                    <p>🏖️ Dia livre para descanso ou atividades opcionais.</p>
                </div>
            `;
        }
        
        return atividades.map((ativ, index) => `
            <div class="atividade-continua ${ativ.isEspecial ? 'atividade-especial' : ''}" data-atividade="${index}">
                ${ativ.horario ? `
                    <div class="atividade-horario">
                        <span class="horario-icon">🕒</span>
                        <span class="horario-texto">${ativ.horario}</span>
                        ${ativ.duracao ? `<span class="duracao-texto">(${ativ.duracao})</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="atividade-info">
                    <div class="atividade-local">
                        <span class="local-icon">📍</span>
                        <div class="local-detalhes">
                            <span class="local-nome">${ativ.local}</span>
                            ${ativ.tags?.length ? `
                                <div class="atividade-badges">
                                    ${ativ.tags.map(tag => `
                                        <span class="badge ${this.getClasseBadge(tag)}">${tag}</span>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${ativ.dica ? `
                        <div class="tripinha-dica">
                            <div class="tripinha-avatar-mini">
                                <img 
                                    src="assets/images/tripinha-avatar.png" 
                                    alt="Tripinha" 
                                    class="avatar-img"
                                    onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
                                >
                                <div class="avatar-emoji" style="display:none;">🐕</div>
                            </div>
                            <div class="dica-texto">
                                <p><strong>Dica da Tripinha:</strong> ${ativ.dica}</p>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                ${ativ.imagemUrl && !ativ.isEspecial ? `
                    <div class="atividade-imagem-responsiva">
                        <img 
                            ${this.imageObserver ? 'data-src' : 'src'}="${ativ.imagemUrl}" 
                            alt="${ativ.local}"
                            class="imagem-lazy"
                            loading="lazy"
                            style="opacity: 0; transition: opacity 0.3s ease;"
                        >
                    </div>
                ` : ''}
                
                ${!ativ.isEspecial ? `
                    <button 
                        class="btn-ver-mapa-mini" 
                        data-local="${ativ.local}"
                        aria-label="Ver ${ativ.local} no mapa"
                        type="button"
                    >
                        <svg class="icon-mapa" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                        </svg>
                        Ver no mapa
                    </button>
                ` : ''}
            </div>
        `).join('');
    }

    // ✅ CRIAR PREVISÃO TEMPO (idêntico ao itinerary.js)
    criarPrevisaoTempo(previsao) {
        if (!previsao) return '';
        
        return `
            <div class="previsao-tempo">
                <span class="previsao-icon">${previsao.icon || '🌤️'}</span>
                <span class="previsao-texto">
                    <strong>Previsão:</strong> ${previsao.temperature || '--'}°C, ${previsao.condition || 'Indefinido'}
                </span>
            </div>
        `;
    }

    // ✅ CONFIGURAR LAZY LOADING PARA ELEMENTOS
    configurarLazyLoadingParaElementos() {
        if (this.imageObserver) {
            setTimeout(() => {
                const imagens = document.querySelectorAll('img[data-src]');
                imagens.forEach(img => {
                    this.imageObserver.observe(img);
                });
                
                console.log(`🖼️ Lazy loading configurado para ${imagens.length} imagens`);
            }, 100);
        }
    }

    // ===========================================
    // MÉTODOS AUXILIARES
    // ===========================================

    calcularDiasViagem(dataIda, dataVolta) {
        const ida = new Date(dataIda);
        const volta = new Date(dataVolta);
        const diffTime = Math.abs(volta - ida);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    extrairPais(destino) {
        const destinoLower = destino.toLowerCase();
        
        const mapeamentoPaises = {
            'portugal': ['lisboa', 'porto', 'coimbra', 'faro', 'braga'],
            'espanha': ['madrid', 'barcelona', 'sevilla', 'valencia', 'bilbao'],
            'frança': ['paris', 'nice', 'lyon', 'marseille', 'bordeaux'],
            'itália': ['roma', 'milão', 'veneza', 'florença', 'nápoles'],
            'alemanha': ['berlim', 'munique', 'hamburgo', 'colônia', 'frankfurt'],
            'argentina': ['buenos aires', 'córdoba', 'mendoza', 'rosário'],
            'chile': ['santiago', 'valparaíso', 'antofagasta', 'viña del mar'],
            'peru': ['lima', 'cusco', 'arequipa', 'trujillo'],
            'colômbia': ['bogotá', 'medellín', 'cartagena', 'cali'],
            'estados unidos': ['nova york', 'los angeles', 'miami', 'chicago', 'orlando'],
            'canadá': ['toronto', 'vancouver', 'montreal', 'ottawa']
        };
        
        for (const [pais, cidades] of Object.entries(mapeamentoPaises)) {
            if (cidades.some(cidade => destinoLower.includes(cidade))) {
                return pais.charAt(0).toUpperCase() + pais.slice(1);
            }
        }
        
        if (destino.includes(',')) {
            return destino.split(',')[1].trim();
        }
        
        return 'Internacional';
    }

    obterDescricaoInteligente(numeroDia, destino, totalDias, formData) {
        if (numeroDia === 1) {
            const personalizada = {
                familia: `Chegada em família em ${destino} - aventuras para todos!`,
                casal: `Chegada romântica em ${destino} - momentos especiais!`,
                amigos: `Chegada da turma em ${destino} - diversão garantida!`,
                sozinho: `Chegada solo em ${destino} - liberdade total!`
            };
            return personalizada[formData.tipoCompanhia] || `Chegada e primeiras impressões de ${destino}!`;
        } else if (numeroDia === totalDias) {
            return `Últimos momentos para aproveitar ${destino} antes da partida.`;
        }
        
        const tipoDescricoes = {
            relaxar: [
                `Dia de relaxamento e contemplação em ${destino}.`,
                `Momentos de paz e tranquilidade em ${destino}.`,
                `Experiências zen e revigorantes em ${destino}.`
            ],
            aventura: [
                `Aventuras emocionantes em ${destino}.`,
                `Explorando a natureza selvagem de ${destino}.`,
                `Adrenalina e descobertas em ${destino}.`
            ],
            cultura: [
                `Imersão cultural profunda em ${destino}.`,
                `Descobrindo a rica história de ${destino}.`,
                `Explorando tradições e arte de ${destino}.`
            ],
            urbano: [
                `Explorando a vida urbana vibrante de ${destino}.`,
                `Descobrindo a modernidade de ${destino}.`,
                `Entre arranha-céus e vida cosmopolita de ${destino}.`
            ]
        };
        
        const opcoes = tipoDescricoes[formData.tipoViagem] || tipoDescricoes.cultura;
        return opcoes[(numeroDia - 2) % opcoes.length];
    }

    obterNumeroAtividades(intensidade) {
        const mapa = {
            leve: 2,
            moderado: 3,
            intenso: 4
        };
        return mapa[intensidade] || 3;
    }

    obterAtividadesPorDestino(destino, tipoViagem) {
        const destinoLower = destino.toLowerCase();
        
        const atividadesEspecificas = {
            'lisboa': [
                { local: "Torre de Belém", tags: ["Histórico", "Imperdível"], dica: "Chegue antes das 10h para evitar filas!" },
                { local: "Mosteiro dos Jerónimos", tags: ["Cultural", "Arquitetura"], dica: "Arquitetura manuelina impressionante!" },
                { local: "Castelo de São Jorge", tags: ["Histórico", "Vista"], dica: "Vista incrível da cidade!" },
                { local: "Bairro de Alfama", tags: ["Cultural", "Tradicional"], dica: "Perca-se nas ruelas históricas!" },
                { local: "LX Factory", tags: ["Moderno", "Arte"], dica: "Arte, lojas e cafés descolados!" },
                { local: "Time Out Market", tags: ["Gastronomia", "Popular"], dica: "O melhor da gastronomia local!" }
            ],
            'paris': [
                { local: "Torre Eiffel", tags: ["Icônico", "Imperdível"], dica: "Compre ingressos online!" },
                { local: "Museu do Louvre", tags: ["Cultural", "Arte"], dica: "Reserve meio dia inteiro!" },
                { local: "Champs-Élysées", tags: ["Compras", "Famoso"], dica: "Caminhada icônica!" },
                { local: "Montmartre", tags: ["Artístico", "Boêmio"], dica: "Atmosfera boêmia única!" },
                { local: "Notre-Dame", tags: ["Histórico", "Religioso"], dica: "Em restauração, mas vale a visita!" }
            ],
            'roma': [
                { local: "Coliseu", tags: ["Histórico", "Imperdível"], dica: "Reserve entrada sem fila!" },
                { local: "Fontana di Trevi", tags: ["Famoso", "Tradição"], dica: "Jogue uma moeda e faça um pedido!" },
                { local: "Vaticano", tags: ["Religioso", "Arte"], dica: "Vista a Capela Sistina!" },
                { local: "Pantheon", tags: ["Histórico", "Arquitetura"], dica: "Entrada gratuita!" }
            ]
        };
        
        for (const [cidade, atividades] of Object.entries(atividadesEspecificas)) {
            if (destinoLower.includes(cidade)) {
                return atividades;
            }
        }
        
        return this.obterAtividadesGenericasPorTipo(tipoViagem);
    }

    obterAtividadesGenericasPorTipo(tipoViagem) {
        const atividadesPorTipo = {
            relaxar: [
                { local: "Spa e centro de bem-estar", tags: ["Relaxante", "Bem-estar"], dica: "Reserve com antecedência!" },
                { local: "Praia ou lago tranquilo", tags: ["Natureza", "Paz"], dica: "Leve protetor solar!" },
                { local: "Jardim botânico", tags: ["Natureza", "Contemplativo"], dica: "Perfeito para meditação!" },
                { local: "Café com vista", tags: ["Gastronomia", "Relaxante"], dica: "Ideal para o pôr do sol!" }
            ],
            aventura: [
                { local: "Trilha local", tags: ["Aventura", "Natureza"], dica: "Leve água e calçado adequado!" },
                { local: "Escalada ou rapel", tags: ["Aventura", "Radical"], dica: "Verifique as condições climáticas!" },
                { local: "Passeio de bike", tags: ["Aventura", "Esporte"], dica: "Explore novos caminhos!" },
                { local: "Esporte aquático", tags: ["Aventura", "Água"], dica: "Experiência refrescante!" }
            ],
            cultura: [
                { local: "Museu principal", tags: ["Cultural", "História"], dica: "Chegue cedo para evitar multidões!" },
                { local: "Centro histórico", tags: ["Cultural", "Arquitetura"], dica: "Faça um tour guiado!" },
                { local: "Teatro local", tags: ["Cultural", "Arte"], dica: "Verifique a programação!" },
                { local: "Mercado tradicional", tags: ["Cultural", "Gastronomia"], dica: "Prove especialidades locais!" }
            ],
            urbano: [
                { local: "Centro comercial", tags: ["Compras", "Moderno"], dica: "Aproveite as promoções!" },
                { local: "Bairro moderno", tags: ["Urbano", "Arquitetura"], dica: "Ótimo para fotos!" },
                { local: "Rooftop bar", tags: ["Urbano", "Vista"], dica: "Vista incrível da cidade!" },
                { local: "Food hall", tags: ["Gastronomia", "Moderno"], dica: "Diversidade culinária!" }
            ]
        };
        
        return atividadesPorTipo[tipoViagem] || atividadesPorTipo.cultura;
    }

    personalizarDica(dicaOriginal, formData) {
        const personalizado = {
            familia: dicaOriginal + ' Perfeito para toda a família!',
            casal: dicaOriginal + ' Momento romântico garantido!',
            amigos: dicaOriginal + ' Diversão em grupo!',
            sozinho: dicaOriginal + ' Ideal para reflexão e autoconhecimento!'
        };
        
        return personalizado[formData.tipoCompanhia] || dicaOriginal;
    }

    ajustarTagsPorPerfil(tagsOriginais, formData) {
        const tags = [...tagsOriginais];
        
        if (formData.nivelOrcamento === 'economico') {
            tags.push('Econômico');
        } else if (formData.nivelOrcamento === 'alto') {
            tags.push('Premium');
        }
        
        if (formData.intensidade === 'intenso') {
            tags.push('Ação');
        } else if (formData.intensidade === 'leve') {
            tags.push('Relaxante');
        }
        
        return tags.slice(0, 3);
    }

    obterHorarioPorPeriodo(periodo) {
        const horarios = {
            'manha': '09:00',
            'tarde': '14:00',
            'noite': '19:00'
        };
        return horarios[periodo] || '12:00';
    }

    obterPeriodoPorHorario(horario) {
        const hora = parseInt(horario.split(':')[0]);
        
        if (hora < 12) return 'manha';
        if (hora < 18) return 'tarde';
        return 'noite';
    }

    estimarDuracao(local) {
        const duracoes = {
            'museu': '2-3 horas',
            'restaurante': '1-2 horas',
            'passeio': '1-2 horas',
            'mercado': '1 hora',
            'igreja': '30-45 min',
            'mirante': '45 min',
            'show': '2 horas'
        };
        
        const localLower = local.toLowerCase();
        
        if (localLower.includes('museu')) return duracoes.museu;
        if (localLower.includes('restaurante') || localLower.includes('almoço') || localLower.includes('jantar')) return duracoes.restaurante;
        if (localLower.includes('passeio') || localLower.includes('caminhada')) return duracoes.passeio;
        if (localLower.includes('mercado')) return duracoes.mercado;
        if (localLower.includes('igreja') || localLower.includes('catedral')) return duracoes.igreja;
        if (localLower.includes('mirante') || localLower.includes('vista')) return duracoes.mirante;
        if (localLower.includes('show') || localLower.includes('teatro')) return duracoes.show;
        
        return '1-2 horas';
    }

    ajustarHorarioCheckIn(horarioOriginal, horaChegada) {
        const [hora] = horarioOriginal.split(':');
        const novaHora = Math.max(parseInt(hora), horaChegada + 2);
        return `${novaHora.toString().padStart(2, '0')}:00`;
    }

    obterObservacaoPrimeiroDia(horarioChegada) {
        const hora = parseInt(horarioChegada.split(':')[0]);
        
        if (hora < 8) return "Chegada cedo - aproveite o dia completo!";
        if (hora < 12) return "Chegada pela manhã - tempo de sobra para explorar!";
        if (hora < 16) return "Chegada à tarde - relaxe e prepare-se para amanhã!";
        if (hora < 20) return "Chegada no fim da tarde - conheça a vida noturna!";
        return "Chegada à noite - descanse bem para aproveitar amanhã!";
    }

    obterObservacaoUltimoDia(horarioPartida) {
        const hora = parseInt(horarioPartida.split(':')[0]);
        
        if (hora < 12) return "Voo pela manhã - aproveite a noite anterior!";
        if (hora < 18) return "Voo à tarde - manhã livre para últimas compras!";
        return "Voo à noite - dia completo para aproveitar!";
    }

    gerarPrevisaoFallback(diaIndex, destino) {
        const cidade = destino.toLowerCase();
        
        let condicoesPrincipais;
        
        if (cidade.includes('paris') || cidade.includes('londres') || cidade.includes('berlim')) {
            condicoesPrincipais = [
                { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 18 },
                { icon: '☁️', condition: 'Nublado', tempBase: 16 },
                { icon: '🌦️', condition: 'Chuva leve', tempBase: 14 },
                { icon: '☀️', condition: 'Ensolarado', tempBase: 22 }
            ];
        } else if (cidade.includes('lisboa') || cidade.includes('madrid') || cidade.includes('roma')) {
            condicoesPrincipais = [
                { icon: '☀️', condition: 'Ensolarado', tempBase: 26 },
                { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 24 },
                { icon: '☁️', condition: 'Nublado', tempBase: 22 },
                { icon: '🌦️', condition: 'Possibilidade de chuva', tempBase: 20 }
            ];
        } else {
            condicoesPrincipais = [
                { icon: '☀️', condition: 'Ensolarado', tempBase: 24 },
                { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 22 },
                { icon: '☁️', condition: 'Nublado', tempBase: 20 },
                { icon: '🌦️', condition: 'Possibilidade de chuva', tempBase: 18 }
            ];
        }
        
        const condicao = condicoesPrincipais[diaIndex % condicoesPrincipais.length];
        const variacaoTemp = Math.floor(Math.random() * 5) - 2;
        const temperaturaFinal = Math.max(10, Math.min(40, condicao.tempBase + variacaoTemp));
        
        return {
            icon: condicao.icon,
            temperature: temperaturaFinal,
            condition: condicao.condition,
            date: this.calcularDataDia(diaIndex)
        };
    }

    calcularDataDia(diaIndex) {
        const dataInicio = new Date();
        const dataAlvo = new Date(dataInicio);
        dataAlvo.setDate(dataInicio.getDate() + diaIndex);
        
        return this.formatDate(dataAlvo);
    }

    gerarImagemFallback(local, diaIndex, ativIndex) {
        const fallbacks = [
            `https://picsum.photos/400/250?random=${diaIndex}${ativIndex}${Date.now()}`,
            `https://source.unsplash.com/400x250/?travel`,
            this.criarImagemPlaceholderSVG(local)
        ];
        
        return fallbacks[ativIndex % fallbacks.length];
    }

    aplicarFallbacksGlobal(roteiro) {
        console.log('🔄 Aplicando fallbacks globais...');
        
        let index = 0;
        roteiro.dias.forEach((dia) => {
            if (dia.atividades?.length) {
                dia.atividades.forEach((atividade) => {
                    if (atividade.local && !atividade.isEspecial && !atividade.imagemUrl) {
                        atividade.imagemUrl = this.gerarImagemFallback(atividade.local, 0, index++);
                        atividade.isFallback = true;
                    }
                });
            }
        });
    }

    abrirMapa(local) {
        const query = `${local}`;
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    getClasseBadge(tag) {
        const classes = {
            'Imperdível': 'badge-destaque',
            'Cultural': 'badge-cultura',
            'História': 'badge-cultura',
            'Histórico': 'badge-cultura',
            'Arte': 'badge-cultura',
            'Gastronomia': 'badge-gastronomia',
            'Natureza': 'badge-natureza',
            'Aventura': 'badge-natureza',
            'Compras': 'badge-compras',
            'Urbano': 'badge-compras',
            'Moderno': 'badge-compras',
            'Econômico': 'badge-natureza',
            'Premium': 'badge-destaque',
            'Relaxante': 'badge-cultura',
            'Ação': 'badge-destaque'
        };
        
        return classes[tag] || 'badge-padrao';
    }

    formatarData(dataString) {
        if (!dataString) return 'Data indefinida';
        
        try {
            const data = new Date(dataString + 'T12:00:00');
            if (isNaN(data.getTime())) {
                return dataString;
            }
            
            const options = { 
                day: 'numeric', 
                month: 'long',
                year: 'numeric'
            };
            
            return data.toLocaleDateString('pt-BR', options);
        } catch (e) {
            return dataString;
        }
    }

    formatarDataCompleta(data) {
        const options = {
            weekday: 'long',
            day: 'numeric',
            month: 'numeric'
        };
        
        const formatada = data.toLocaleDateString('pt-BR', options);
        return formatada.charAt(0).toUpperCase() + formatada.slice(1);
    }

    obterIconeCompanhia(tipo) {
        const icones = {
            sozinho: '🧳',
            casal: '❤️',
            familia: '👨‍👩‍👧‍👦',
            amigos: '🎉'
        };
        return icones[tipo] || '👤';
    }

    obterTextoCompanhia(tipo, quantidade) {
        const textos = {
            sozinho: 'Viagem Solo',
            casal: 'Casal',
            familia: `Família (${quantidade} pessoas)`,
            amigos: `Grupo de Amigos (${quantidade} pessoas)`
        };
        return textos[tipo] || 'Viagem Individual';
    }

    obterIconeViagem(tipo) {
        const icones = {
            relaxar: '🏖️',
            aventura: '🏔️',
            cultura: '🏛️',
            urbano: '🏙️'
        };
        return icones[tipo] || '✨';
    }

    obterTextoViagem(tipo) {
        const textos = {
            relaxar: 'Relaxamento e Descanso',
            aventura: 'Aventura e Natureza',
            cultura: 'Cultura e História',
            urbano: 'Urbano e Moderno'
        };
        return textos[tipo] || 'Experiências Variadas';
    }

    showLoading(show) {
        if (show) {
            this.generateBtn.disabled = true;
            this.generateBtn.classList.add('loading');
            this.btnText.textContent = 'Criando roteiro...';
            this.btnSpinner.style.display = 'block';
        } else {
            this.generateBtn.disabled = false;
            this.generateBtn.classList.remove('loading');
            this.btnText.textContent = '🎯 Criar Meu Roteiro';
            this.btnSpinner.style.display = 'none';
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });
        
        setTimeout(() => {
            toast.classList.remove('toast-visible');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ✅ INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    new BenetripManualItinerary();
});
