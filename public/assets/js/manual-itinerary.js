// ======================================
// BENETRIP - ROTEIRO MANUAL COM PRIORIDADE TOTAL PARA LLM
// ✅ FORÇAR USO DA IA - FALLBACK APENAS EM ÚLTIMO CASO
// ======================================

class BenetripManualItinerary {
    constructor() {
        this.form = document.getElementById('itineraryForm');
        this.resultContainer = document.getElementById('itineraryResult');
        this.generateBtn = document.getElementById('generateBtn');
        this.btnText = document.getElementById('btnText');
        this.btnSpinner = document.getElementById('btnSpinner');
        
        this.imagensCache = new Map();
        this.imageObserver = null;
        this.atividadesUtilizadas = new Set();
        
        // ✅ NOVO: Flags de debug para verificar origem do roteiro
        this.roteiroOriginacao = 'desconhecida';
        
        this.init();
        this.setupRoteiroEventListeners();
    }

    init() {
        console.log('🚀 Benetrip Roteiro Manual - PRIORIDADE LLM iniciado');
        
        this.setupEventListeners();
        this.setupDateDefaults();
        this.setupHorarioPreview();
        this.configurarLazyLoading();
    }

    // ✅ Event listeners básicos (mantidos)
    setupRoteiroEventListeners() {
        document.addEventListener('click', (e) => {
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
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
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
        
        document.getElementById('dataIda').min = this.formatDate(hoje);
        document.getElementById('dataVolta').min = this.formatDate(hoje);
    }

    setupHorarioPreview() {
        const horarioChegada = document.getElementById('horarioChegada');
        const horarioPartida = document.getElementById('horarioPartida');
        
        const atualizarPreview = () => {
            document.querySelectorAll('.horario-preview').forEach(el => el.remove());
            
            const horaChegada = parseInt(horarioChegada.value.split(':')[0]);
            const horaPartida = parseInt(horarioPartida.value.split(':')[0]);
            
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
            
            // ✅ NOVO: Mostrar origem do roteiro
            const origemMsg = this.roteiroOriginacao === 'IA' 
                ? 'Roteiro personalizado criado pela IA! 🤖✨' 
                : this.roteiroOriginacao === 'fallback'
                ? 'Roteiro criado com sistema interno! 🛡️'
                : 'Roteiro criado com sucesso! 🎉';
                
            this.showToast(origemMsg, 'success');
            
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
        
        const dataIda = new Date(document.getElementById('dataIda').value);
        const dataVolta = new Date(document.getElementById('dataVolta').value);
        
        if (dataVolta <= dataIda) {
            this.showToast('A data de volta deve ser posterior à data de ida.', 'error');
            return false;
        }
        
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

    // ✅ **MÉTODO PRINCIPAL CORRIGIDO**: Prioridade TOTAL para LLM
    async generateItinerary(formData) {
        console.log('🎯 INICIANDO GERAÇÃO - PRIORIDADE ABSOLUTA PARA LLM');
        
        // ✅ PRIMEIRA TENTATIVA: API da IA com retry
        let roteiroIA = null;
        let tentativasIA = 0;
        const maxTentativasIA = 3;
        
        while (tentativasIA < maxTentativasIA && !roteiroIA) {
            try {
                tentativasIA++;
                console.log(`🤖 Tentativa ${tentativasIA}/${maxTentativasIA} - Chamando API da IA...`);
                
                roteiroIA = await this.chamarAPIRealComTimeout(formData, tentativasIA);
                
                if (roteiroIA) {
                    console.log('✅ SUCESSO! Roteiro recebido da IA:', roteiroIA);
                    this.roteiroOriginacao = 'IA';
                    break;
                }
                
            } catch (erro) {
                console.warn(`⚠️ Tentativa ${tentativasIA} falhou:`, erro.message);
                
                if (tentativasIA < maxTentativasIA) {
                    console.log(`🔄 Aguardando ${tentativasIA * 2}s antes da próxima tentativa...`);
                    await this.delay(tentativasIA * 2000);
                }
            }
        }
        
        let roteiro;
        
        if (roteiroIA) {
            // ✅ SUCESSO COM IA: Converter preservando TUDO da IA
            console.log('🎉 USANDO ROTEIRO DA IA - Convertendo sem perder detalhes...');
            roteiro = this.converterRoteiroIACompleto(roteiroIA, formData);
            
        } else {
            // ❌ FALHA NA IA: Usar fallback melhorado (último recurso)
            console.warn('😞 IA não disponível - Usando sistema interno de última hora...');
            this.roteiroOriginacao = 'fallback';
            this.atividadesUtilizadas.clear();
            roteiro = this.gerarRoteiroFallbackMelhorado(formData);
        }
        
        // ✅ Buscar previsão e imagens em paralelo
        await Promise.all([
            this.buscarPrevisaoTempo(roteiro),
            this.buscarImagensParaRoteiro(roteiro)
        ]);
        
        console.log(`📋 ROTEIRO FINAL gerado via: ${this.roteiroOriginacao.toUpperCase()}`);
        return roteiro;
    }

    // ✅ **NOVO**: Chamada API com timeout escalável e retry
    async chamarAPIRealComTimeout(formData, tentativa) {
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
            
            // ✅ ADICIONAR CONTEXTO EXTRA PARA IA
            contextoExtra: {
                manual: true,
                tentativa: tentativa,
                preferenciaDetalhada: `${formData.tipoViagem} ${formData.intensidade} para ${formData.tipoCompanhia}`,
                solicitacaoEspecial: 'Gere atividades específicas e únicas para cada dia, evitando repetições'
            },
            
            preferencias: {
                intensidade: formData.intensidade,
                nivelOrcamento: formData.nivelOrcamento,
                quantidade: formData.quantidade,
                variedadeMaxima: true,
                detalhamento: 'alto'
            },
            modeloIA: 'deepseek'
        };
        
        console.log('📡 Enviando parâmetros DETALHADOS para IA:', parametrosIA);
        
        // ✅ Timeout escalável: 30s, 45s, 60s
        const timeout = 30000 + (tentativa - 1) * 15000;
        
        const response = await fetch('/api/itinerary-generator', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Request-Attempt': tentativa.toString(),
                'X-Manual-Request': 'true'
            },
            body: JSON.stringify(parametrosIA),
            signal: AbortSignal.timeout(timeout)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const roteiroIA = await response.json();
        
        // ✅ Validação rigorosa da resposta da IA
        if (!this.validarRespostaIA(roteiroIA)) {
            throw new Error('Resposta da IA inválida ou incompleta');
        }
        
        return roteiroIA;
    }

    // ✅ **NOVO**: Validar se resposta da IA está completa
    validarRespostaIA(roteiroIA) {
        if (!roteiroIA || typeof roteiroIA !== 'object') {
            console.error('❌ Resposta da IA não é um objeto válido');
            return false;
        }
        
        if (!roteiroIA.dias || !Array.isArray(roteiroIA.dias) || roteiroIA.dias.length === 0) {
            console.error('❌ Resposta da IA sem dias válidos');
            return false;
        }
        
        const diasComAtividades = roteiroIA.dias.filter(dia => {
            return dia.atividades?.length > 0 || 
                   dia.manha?.atividades?.length > 0 || 
                   dia.tarde?.atividades?.length > 0 || 
                   dia.noite?.atividades?.length > 0;
        });
        
        if (diasComAtividades.length === 0) {
            console.error('❌ Resposta da IA sem atividades em nenhum dia');
            return false;
        }
        
        console.log('✅ Resposta da IA validada:', {
            totalDias: roteiroIA.dias.length,
            diasComAtividades: diasComAtividades.length,
            destino: roteiroIA.destino
        });
        
        return true;
    }

    // ✅ **NOVO**: Converter roteiro da IA preservando TUDO
    converterRoteiroIACompleto(roteiroIA, formData) {
        console.log('🔄 Convertendo roteiro da IA SEM PERDER NENHUM DETALHE...');
        
        const diasContinuos = [];
        
        roteiroIA.dias.forEach((diaIA, index) => {
            const dataAtual = new Date(formData.dataIda);
            dataAtual.setDate(dataAtual.getDate() + index);
            
            const diaContino = {
                data: this.formatDate(dataAtual),
                // ✅ PRESERVAR descrição original da IA
                descricao: diaIA.descricao || diaIA.tema || this.gerarDescricaoGenerica(index + 1, formData.destino),
                atividades: this.extrairTodasAtividadesDaIA(diaIA),
                // ✅ PRESERVAR observações da IA
                observacao: diaIA.observacao || diaIA.dica || null
            };
            
            // ✅ Adicionar observações especiais apenas se a IA não forneceu
            if (!diaContino.observacao) {
                if (index === 0) {
                    diaContino.observacao = this.obterObservacaoPrimeiroDia(formData.horarioChegada);
                } else if (index === roteiroIA.dias.length - 1) {
                    diaContino.observacao = this.obterObservacaoUltimoDia(formData.horarioPartida);
                }
            }
            
            if (index < 3) {
                diaContino.previsao = this.gerarPrevisaoFallback(index, formData.destino);
            }
            
            diasContinuos.push(diaContino);
        });
        
        // ✅ Ajustar apenas horários de chegada/partida, manter atividades da IA
        this.ajustarHorariosVooSemAlterarAtividades(diasContinuos, formData);
        
        return {
            destino: roteiroIA.destino || formData.destino,
            resumo: {
                destino: formData.destino,
                cidadePartida: formData.cidadePartida,
                dataIda: formData.dataIda,
                dataVolta: formData.dataVolta,
                horarioChegada: formData.horarioChegada,
                horarioPartida: formData.horarioPartida,
                diasViagem: this.calcularDiasViagem(formData.dataIda, formData.dataVolta),
                tipoCompanhia: formData.tipoCompanhia,
                quantidade: formData.quantidade,
                tipoViagem: formData.tipoViagem
            },
            dias: diasContinuos,
            // ✅ PRESERVAR metadados da IA
            metadados: {
                geradoPorIA: true,
                modeloIA: roteiroIA.modelo || 'deepseek',
                versaoIA: roteiroIA.versao,
                tempoGeracao: roteiroIA.tempo_geracao
            }
        };
    }

    // ✅ **NOVO**: Extrair TODAS as atividades da IA preservando detalhes
    extrairTodasAtividadesDaIA(diaIA) {
        const atividades = [];
        
        // ✅ MÉTODO 1: Se IA retornou atividades diretas
        if (diaIA.atividades && Array.isArray(diaIA.atividades)) {
            diaIA.atividades.forEach(ativ => {
                atividades.push({
                    horario: ativ.horario || ativ.hora || '09:00',
                    local: ativ.local || ativ.lugar || ativ.atividade || 'Atividade sugerida pela IA',
                    tags: ativ.tags || ativ.categorias || ['Sugestão IA'],
                    dica: ativ.dica || ativ.observacao || ativ.detalhes || 'Recomendação personalizada da IA!',
                    duracao: ativ.duracao || ativ.tempo || this.estimarDuracao(ativ.local || 'atividade'),
                    periodo: this.obterPeriodoPorHorario(ativ.horario || '09:00'),
                    // ✅ PRESERVAR dados originais da IA
                    originalIA: true,
                    dadosOriginais: ativ
                });
            });
        }
        
        // ✅ MÉTODO 2: Se IA estruturou por períodos
        const periodos = ['manha', 'tarde', 'noite'];
        periodos.forEach(periodo => {
            if (diaIA[periodo]?.atividades?.length) {
                diaIA[periodo].atividades.forEach(ativ => {
                    atividades.push({
                        horario: ativ.horario || this.obterHorarioPorPeriodo(periodo),
                        local: ativ.local || ativ.lugar || 'Atividade sugerida pela IA',
                        tags: ativ.tags || [periodo.charAt(0).toUpperCase() + periodo.slice(1)],
                        dica: ativ.dica || 'Sugestão personalizada da IA!',
                        duracao: ativ.duracao || this.estimarDuracao(ativ.local || 'atividade'),
                        periodo: periodo,
                        originalIA: true,
                        dadosOriginais: ativ
                    });
                });
            }
        });
        
        // ✅ MÉTODO 3: Se IA retornou estrutura diferente, tentar extrair
        if (atividades.length === 0) {
            console.warn('⚠️ Estrutura da IA não reconhecida, tentando extrair atividades...', diaIA);
            
            // Procurar por qualquer campo que pareça atividade
            Object.keys(diaIA).forEach(key => {
                if (key.includes('atividade') || key.includes('local') || key.includes('visita')) {
                    const valor = diaIA[key];
                    if (typeof valor === 'string') {
                        atividades.push({
                            horario: '10:00',
                            local: valor,
                            tags: ['Sugestão IA'],
                            dica: 'Atividade extraída da sugestão da IA',
                            duracao: '1-2 horas',
                            periodo: 'manha',
                            originalIA: true
                        });
                    }
                }
            });
        }
        
        // ✅ Se ainda não há atividades, algo deu errado na IA
        if (atividades.length === 0) {
            console.error('❌ Não foi possível extrair atividades da IA, dia:', diaIA);
            atividades.push({
                horario: '09:00',
                local: 'Exploração livre - A IA sugeriu este dia para descobertas pessoais',
                tags: ['Livre', 'IA'],
                dica: 'Use este tempo para explorar por conta própria baseado nas suas preferências!',
                duracao: 'Flexível',
                periodo: 'manha',
                originalIA: false,
                isFallback: true
            });
        }
        
        console.log(`✅ Extraídas ${atividades.length} atividades da IA para este dia`);
        return atividades;
    }

    // ✅ **NOVO**: Ajustar apenas voos sem alterar atividades da IA
    ajustarHorariosVooSemAlterarAtividades(dias, formData) {
        if (!dias || dias.length === 0) return;
        
        const horaChegada = parseInt(formData.horarioChegada.split(':')[0]);
        const horaPartida = parseInt(formData.horarioPartida.split(':')[0]);
        
        console.log(`✈️ Ajustando APENAS voos, preservando atividades da IA`);
        
        // ✅ Primeiro dia: adicionar check-in mas manter atividades da IA
        const primeiroDia = dias[0];
        if (primeiroDia.atividades && primeiroDia.atividades.length > 0) {
            // Adicionar check-in no início, manter resto da IA
            primeiroDia.atividades.unshift({
                horario: formData.horarioChegada,
                local: 'Check-in no Hotel',
                dica: 'Deixe as bagagens e comece a explorar conforme sugerido pela IA!',
                tags: ['Chegada'],
                isEspecial: true,
                duracao: '30 min'
            });
            
            // Se chegada muito tarde, limitar atividades
            if (horaChegada >= 20) {
                primeiroDia.atividades = [primeiroDia.atividades[0]]; // Só check-in
            } else if (horaChegada >= 16) {
                primeiroDia.atividades = primeiroDia.atividades.slice(0, 3); // Limitar a 2 atividades + check-in
            }
        }
        
        // ✅ Último dia: adicionar partida mas manter atividades da IA até então
        if (dias.length > 1) {
            const ultimoDia = dias[dias.length - 1];
            if (ultimoDia.atividades && ultimoDia.atividades.length > 0) {
                // Adicionar partida baseada no horário
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
                    // Manter atividades da manhã da IA, adicionar transfer
                    const atividadesManha = ultimoDia.atividades.filter(a => 
                        parseInt(a.horario.split(':')[0]) < 10
                    );
                    ultimoDia.atividades = [
                        ...atividadesManha,
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
                    // Manter todas as atividades da IA, adicionar transfer tarde
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
        
        console.log('✅ Voos ajustados, atividades da IA preservadas');
    }

    // ============================================
    // FALLBACK APENAS COMO ÚLTIMO RECURSO
    // ============================================

    gerarRoteiroFallbackMelhorado(formData) {
        console.log('🛡️ FALLBACK: Gerando roteiro quando IA não disponível...');
        
        const diasViagem = this.calcularDiasViagem(formData.dataIda, formData.dataVolta);
        const destino = formData.destino;
        
        this.atividadesUtilizadas.clear();
        
        const dias = [];
        for (let i = 0; i < diasViagem; i++) {
            const dataAtual = new Date(formData.dataIda);
            dataAtual.setDate(dataAtual.getDate() + i);
            
            const dia = {
                data: this.formatDate(dataAtual),
                descricao: this.gerarDescricaoGenerica(i + 1, destino, diasViagem, formData),
                atividades: this.gerarAtividadesVariadasPorDia(formData, i, diasViagem)
            };
            
            if (i === 0) {
                dia.observacao = this.obterObservacaoPrimeiroDia(formData.horarioChegada);
            } else if (i === diasViagem - 1) {
                dia.observacao = this.obterObservacaoUltimoDia(formData.horarioPartida);
            }
            
            if (i < 3) {
                dia.previsao = this.gerarPrevisaoFallback(i, destino);
            }
            
            dias.push(dia);
        }
        
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

    gerarAtividadesVariadasPorDia(formData, diaIndex, totalDias) {
        const numAtividades = this.obterNumeroAtividades(formData.intensidade);
        const poolTotal = this.obterPoolMassivoAtividades(formData.destino, formData.tipoViagem);
        
        const atividadesDisponiveis = poolTotal.filter(ativ => 
            !this.atividadesUtilizadas.has(ativ.local)
        );
        
        const atividades = [];
        const horariosBase = ['09:00', '11:30', '14:00', '16:30', '19:00', '21:00'];
        
        for (let i = 0; i < numAtividades && atividadesDisponiveis.length > 0; i++) {
            let atividadeSelecionada;
            
            if (diaIndex === 0 && i === 0) {
                atividadeSelecionada = this.selecionarAtividadePrioridade(atividadesDisponiveis, 'chegada');
            } else if (diaIndex === totalDias - 1 && i === numAtividades - 1) {
                atividadeSelecionada = this.selecionarAtividadePrioridade(atividadesDisponiveis, 'despedida');
            } else {
                const periodoPreferido = this.obterPeriodoPorIndice(i);
                atividadeSelecionada = this.selecionarAtividadePorPeriodo(atividadesDisponiveis, periodoPreferido, formData);
            }
            
            if (!atividadeSelecionada && atividadesDisponiveis.length > 0) {
                const indiceAleatorio = Math.floor(Math.random() * atividadesDisponiveis.length);
                atividadeSelecionada = atividadesDisponiveis[indiceAleatorio];
            }
            
            if (atividadeSelecionada) {
                const atividadeContina = {
                    horario: horariosBase[i % horariosBase.length],
                    local: atividadeSelecionada.local,
                    tags: this.ajustarTagsPorPerfil(atividadeSelecionada.tags, formData),
                    dica: this.personalizarDica(atividadeSelecionada.dica, formData),
                    duracao: this.estimarDuracao(atividadeSelecionada.local),
                    periodo: this.obterPeriodoPorHorario(horariosBase[i % horariosBase.length]),
                    categoria: atividadeSelecionada.categoria || 'geral'
                };
                
                atividades.push(atividadeContina);
                
                this.atividadesUtilizadas.add(atividadeSelecionada.local);
                const indiceParaRemover = atividadesDisponiveis.findIndex(a => a.local === atividadeSelecionada.local);
                if (indiceParaRemover !== -1) {
                    atividadesDisponiveis.splice(indiceParaRemover, 1);
                }
            }
        }
        
        while (atividades.length < numAtividades) {
            const atividadeExtra = this.gerarAtividadeDinamica(diaIndex, atividades.length, formData);
            atividades.push(atividadeExtra);
        }
        
        return atividades;
    }

    // ============================================
    // MÉTODOS AUXILIARES E SUPORTE
    // ============================================

    obterPoolMassivoAtividades(destino, tipoViagem) {
        const destinoLower = destino.toLowerCase();
        
        const atividadesEspecificas = {
            'lisboa': [
                { local: "Torre de Belém", tags: ["Histórico", "Imperdível"], dica: "Chegue antes das 10h para evitar filas!", categoria: "historico" },
                { local: "Mosteiro dos Jerónimos", tags: ["Cultural", "Arquitetura"], dica: "Arquitetura manuelina impressionante!", categoria: "religioso" },
                { local: "Castelo de São Jorge", tags: ["Histórico", "Vista"], dica: "Vista incrível da cidade!", categoria: "historico" },
                { local: "Bairro de Alfama", tags: ["Cultural", "Tradicional"], dica: "Perca-se nas ruelas históricas!", categoria: "cultural" },
                { local: "LX Factory", tags: ["Moderno", "Arte"], dica: "Arte, lojas e cafés descolados!", categoria: "moderno" },
                { local: "Time Out Market", tags: ["Gastronomia", "Popular"], dica: "O melhor da gastronomia local!", categoria: "gastronomia" },
                { local: "Elevador de Santa Justa", tags: ["Vista", "Engenharia"], dica: "Vista panorâmica de 360°!", categoria: "vista" },
                { local: "Miradouro da Senhora do Monte", tags: ["Vista", "Romântico"], dica: "Melhor pôr do sol da cidade!", categoria: "vista" },
                { local: "Oceanário de Lisboa", tags: ["Família", "Educativo"], dica: "Segundo maior aquário da Europa!", categoria: "familia" },
                { local: "Palácio da Pena (Sintra)", tags: ["Histórico", "Colorido"], dica: "Combinar com visita a Sintra!", categoria: "passeio" },
                { local: "Quinta da Regaleira", tags: ["Mistério", "Jardins"], dica: "Explore os túneis secretos!", categoria: "aventura" },
                { local: "Cabo da Roca", tags: ["Natureza", "Extremo"], dica: "Ponto mais ocidental da Europa!", categoria: "natureza" },
                { local: "Pastéis de Belém", tags: ["Gastronomia", "Tradicional"], dica: "Receita secreta centenária!", categoria: "gastronomia" },
                { local: "Fado em Alfama", tags: ["Cultural", "Música"], dica: "Patrimônio da Humanidade!", categoria: "noturno" },
                { local: "Tram 28", tags: ["Transporte", "Panorâmico"], dica: "Tour completo pela cidade!", categoria: "transporte" },
                { local: "Parque Eduardo VII", tags: ["Natureza", "Estufa"], dica: "Estufa fria é imperdível!", categoria: "natureza" },
                { local: "Gulbenkian Museum", tags: ["Arte", "Cultural"], dica: "Coleção de arte impressionante!", categoria: "museu" },
                { local: "Cais do Sodré", tags: ["Moderno", "Vida Noturna"], dica: "Área renovada com bares!", categoria: "noturno" },
                { local: "Mercado da Ribeira", tags: ["Gastronomia", "Local"], dica: "Autêntico mercado lisboeta!", categoria: "gastronomia" },
                { local: "Chiado", tags: ["Compras", "Elegante"], dica: "Área comercial sofisticada!", categoria: "compras" }
            ]
        };

        for (const [cidade, atividades] of Object.entries(atividadesEspecificas)) {
            if (destinoLower.includes(cidade)) {
                return [...atividades, ...this.obterAtividadesGenericasExpandidas(tipoViagem)];
            }
        }
        
        return this.obterAtividadesGenericasExpandidas(tipoViagem);
    }

    obterAtividadesGenericasExpandidas(tipoViagem) {
        const baseGigante = [
            { local: "Centro Histórico", tags: ["Cultural", "Caminhada"], dica: "Comece cedo para evitar multidões!", categoria: "cultural" },
            { local: "Museu Nacional", tags: ["Arte", "História"], dica: "Não perca a exposição principal!", categoria: "museu" },
            { local: "Catedral Principal", tags: ["Religioso", "Arquitetura"], dica: "Arquitetura impressionante!", categoria: "religioso" },
            { local: "Mercado Central", tags: ["Gastronomia", "Local"], dica: "Prove as especialidades locais!", categoria: "gastronomia" },
            { local: "Parque Municipal", tags: ["Natureza", "Caminhada"], dica: "Ótimo para caminhadas!", categoria: "natureza" },
            { local: "Bairro Artístico", tags: ["Arte", "Moderno"], dica: "Galerias e street art incríveis!", categoria: "cultural" },
            { local: "Miradouro da Cidade", tags: ["Vista", "Panorâmico"], dica: "Vista panorâmica espetacular!", categoria: "vista" },
            { local: "Restaurante Típico", tags: ["Gastronomia", "Tradicional"], dica: "Peça o prato da casa!", categoria: "gastronomia" },
            { local: "Centro Comercial", tags: ["Compras", "Moderno"], dica: "Aproveite as promoções!", categoria: "compras" },
            { local: "Tour Gastronômico", tags: ["Gastronomia", "Descoberta"], dica: "Sabores autênticos da região!", categoria: "gastronomia" },
            { local: "Jardim Botânico", tags: ["Natureza", "Educativo"], dica: "Diversidade botânica!", categoria: "natureza" },
            { local: "Teatro Municipal", tags: ["Cultural", "Espetáculo"], dica: "Verifique a programação!", categoria: "cultural" },
            { local: "Feira de Artesanato", tags: ["Artesanato", "Local"], dica: "Produtos únicos locais!", categoria: "compras" },
            { local: "Casa de Fados", tags: ["Música", "Tradicional"], dica: "Música tradicional ao vivo!", categoria: "noturno" },
            { local: "Trilha Ecológica", tags: ["Aventura", "Natureza"], dica: "Contato direto com a natureza!", categoria: "aventura" }
        ];
        
        return baseGigante;
    }

    // ============================================
    // MÉTODOS DE BUSCA DE PREVISÃO E IMAGENS (mantidos)
    // ============================================

    async buscarPrevisaoTempo(roteiro) {
        try {
            if (!roteiro?.dias || roteiro.dias.length === 0) return;
            
            const cidade = roteiro.resumo?.destino || roteiro.destino;
            const dataInicio = roteiro.resumo?.dataIda;
            const dataFim = roteiro.resumo?.dataVolta;
            const diasComPrevisao = Math.min(3, roteiro.dias.length);
            
            try {
                const urlAPI = `/api/weather?city=${encodeURIComponent(cidade)}&start=${dataInicio}&end=${dataFim}`;
                
                const response = await fetch(urlAPI, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(8000)
                });
                
                if (!response.ok) throw new Error(`API de tempo falhou: ${response.status}`);
                
                const dadosTempo = await response.json();
                
                for (let i = 0; i < diasComPrevisao; i++) {
                    if (dadosTempo[i]) {
                        roteiro.dias[i].previsao = {
                            icon: dadosTempo[i].icon || '🌤️',
                            temperature: dadosTempo[i].temperature || 25,
                            condition: dadosTempo[i].condition || 'Tempo agradável',
                            date: dadosTempo[i].date
                        };
                    } else {
                        roteiro.dias[i].previsao = this.gerarPrevisaoFallback(i, cidade);
                    }
                }
                
            } catch (erroAPI) {
                for (let i = 0; i < diasComPrevisao; i++) {
                    roteiro.dias[i].previsao = this.gerarPrevisaoFallback(i, cidade);
                }
            }
            
        } catch (erro) {
            const diasComPrevisao = Math.min(3, roteiro.dias.length);
            for (let i = 0; i < diasComPrevisao; i++) {
                if (!roteiro.dias[i].previsao) {
                    roteiro.dias[i].previsao = this.gerarPrevisaoFallback(i, roteiro.resumo?.destino || 'cidade');
                }
            }
        }
    }

    async buscarImagensParaRoteiro(roteiro) {
        try {
            if (!roteiro.dias || roteiro.dias.length === 0) return;
            
            const todasAtividades = [];
            roteiro.dias.forEach((dia, diaIndex) => {
                if (dia.atividades?.length) {
                    dia.atividades.forEach((atividade, ativIndex) => {
                        if (atividade.local && !atividade.isEspecial && !atividade.isDinamica) {
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
            
        } catch (erro) {
            this.aplicarFallbacksGlobal(roteiro);
        }
    }

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
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
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

    // ============================================
    // MÉTODOS DE DISPLAY E UI (mantidos iguais)
    // ============================================

    displayItinerary(roteiro) {
        const container = this.resultContainer;
        container.innerHTML = '';
        
        container.classList.add('roteiro-content');
        
        container.appendChild(this.criarResumoViagem(roteiro));
        
        roteiro.dias.forEach((dia, index) => {
            container.appendChild(this.criarElementoDiaContinuo(dia, index + 1));
        });
        
        const spacer = document.createElement('div');
        spacer.style.height = '100px';
        container.appendChild(spacer);
        
        this.configurarLazyLoadingParaElementos();
        
        container.classList.add('visible');
        
        setTimeout(() => {
            container.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 300);
    }

    criarResumoViagem(roteiro) {
        const resumo = document.createElement('div');
        resumo.className = 'resumo-viagem';
        
        const dataIda = this.formatarData(roteiro.resumo.dataIda);
        const dataVolta = this.formatarData(roteiro.resumo.dataVolta);
        
        // ✅ Adicionar indicador de origem
        const indicadorOrigem = roteiro.metadados?.geradoPorIA 
            ? '<div class="origem-roteiro ia">🤖 Roteiro criado pela IA</div>'
            : '<div class="origem-roteiro fallback">🛡️ Roteiro do sistema interno</div>';
        
        resumo.innerHTML = `
            ${indicadorOrigem}
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

    criarListaAtividadesContinuas(atividades) {
        if (!atividades?.length) {
            return `
                <div class="dia-livre">
                    <p>🏖️ Dia livre para descanso ou atividades opcionais.</p>
                </div>
            `;
        }
        
        return atividades.map((ativ, index) => `
            <div class="atividade-continua ${ativ.isEspecial ? 'atividade-especial' : ''} ${ativ.originalIA ? 'atividade-ia' : ''}" data-atividade="${index}">
                ${ativ.horario ? `
                    <div class="atividade-horario">
                        <span class="horario-icon">🕒</span>
                        <span class="horario-texto">${ativ.horario}</span>
                        ${ativ.duracao ? `<span class="duracao-texto">(${ativ.duracao})</span>` : ''}
                        ${ativ.originalIA ? '<span class="badge-ia">🤖 IA</span>' : ''}
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
                
                ${ativ.imagemUrl && !ativ.isEspecial && !ativ.isDinamica ? `
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
                
                ${!ativ.isEspecial && !ativ.isDinamica ? `
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

    configurarLazyLoadingParaElementos() {
        if (this.imageObserver) {
            setTimeout(() => {
                const imagens = document.querySelectorAll('img[data-src]');
                imagens.forEach(img => {
                    this.imageObserver.observe(img);
                });
            }, 100);
        }
    }

    // ============================================
    // MÉTODOS AUXILIARES FINAIS (mantidos)
    // ============================================

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
            'alemanha': ['berlim', 'munique', 'hamburgo', 'colônia', 'frankfurt']
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

    gerarDescricaoGenerica(numeroDia, destino, totalDias, formData) {
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
        
        const opcoes = [
            `Explorando os tesouros de ${destino}.`,
            `Imersão na cultura de ${destino}.`,
            `Descobrindo os sabores de ${destino}.`,
            `Aventuras inesquecíveis em ${destino}.`
        ];
        
        return opcoes[(numeroDia - 2) % opcoes.length];
    }

    obterNumeroAtividades(intensidade) {
        const mapa = { leve: 3, moderado: 4, intenso: 5 };
        return mapa[intensidade] || 4;
    }

    obterPeriodoPorIndice(indice) {
        const periodos = ['manha', 'tarde', 'noite'];
        return periodos[indice % periodos.length];
    }

    selecionarAtividadePrioridade(atividades, tipo) {
        const prioridades = {
            'chegada': ['cultural', 'gastronomia', 'vista'],
            'despedida': ['compras', 'gastronomia', 'vista']
        };
        
        const categoriasPreferidas = prioridades[tipo] || [];
        
        for (const categoria of categoriasPreferidas) {
            const encontrada = atividades.find(ativ => ativ.categoria === categoria);
            if (encontrada) return encontrada;
        }
        
        return null;
    }

    selecionarAtividadePorPeriodo(atividades, periodo, formData) {
        const categoriasPorPeriodo = {
            'manha': ['cultural', 'natureza', 'museu', 'educativo'],
            'tarde': ['aventura', 'compras', 'passeio', 'vista'],
            'noite': ['noturno', 'gastronomia', 'cultural']
        };
        
        const categoriasPreferidas = categoriasPorPeriodo[periodo] || [];
        
        for (const categoria of categoriasPreferidas) {
            const encontrada = atividades.find(ativ => ativ.categoria === categoria);
            if (encontrada) return encontrada;
        }
        
        return null;
    }

    gerarAtividadeDinamica(diaIndex, atividadeIndex, formData) {
        const atividadesDinamicas = [
            { local: `Exploração Livre - Zona ${diaIndex + 1}`, categoria: 'livre' },
            { local: `Caminhada Urbana - Rota ${atividadeIndex + 1}`, categoria: 'caminhada' },
            { local: `Pausa para Café Local - ${diaIndex + 1}`, categoria: 'pausa' },
            { local: `Descoberta Pessoal - Área ${diaIndex + 1}`, categoria: 'pessoal' }
        ];
        
        const atividade = atividadesDinamicas[atividadeIndex % atividadesDinamicas.length];
        
        return {
            horario: '15:00',
            local: atividade.local,
            tags: ['Flexível', 'Personalizado'],
            dica: 'Aproveite para descobrir algo especial por conta própria!',
            duracao: '1-2 horas',
            periodo: 'tarde',
            categoria: atividade.categoria,
            isDinamica: true
        };
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
        
        if (formData.nivelOrcamento === 'economico') tags.push('Econômico');
        else if (formData.nivelOrcamento === 'alto') tags.push('Premium');
        
        if (formData.intensidade === 'intenso') tags.push('Ação');
        else if (formData.intensidade === 'leve') tags.push('Relaxante');
        
        return tags.slice(0, 3);
    }

    obterHorarioPorPeriodo(periodo) {
        const horarios = { 'manha': '09:00', 'tarde': '14:00', 'noite': '19:00' };
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
            'museu': '2-3 horas', 'restaurante': '1-2 horas', 'passeio': '1-2 horas',
            'mercado': '1 hora', 'igreja': '30-45 min', 'mirante': '45 min', 'show': '2 horas'
        };
        
        const localLower = local.toLowerCase();
        if (localLower.includes('museu')) return duracoes.museu;
        if (localLower.includes('restaurante')) return duracoes.restaurante;
        return '1-2 horas';
    }

    ajustarAtividadesPorHorariosContinuo(dias, formData) {
        if (!dias || dias.length === 0) return;
        
        const horaChegada = parseInt(formData.horarioChegada.split(':')[0]);
        const horaPartida = parseInt(formData.horarioPartida.split(':')[0]);
        
        const primeiroDia = dias[0];
        if (horaChegada >= 20) {
            primeiroDia.atividades = [{
                horario: formData.horarioChegada,
                local: 'Check-in e Jantar no Hotel',
                dica: 'Descanse para começar bem amanhã!',
                tags: ['Chegada', 'Descanso'],
                isEspecial: true, duracao: '1 hora'
            }];
        } else if (horaChegada >= 16) {
            primeiroDia.atividades = [
                {
                    horario: formData.horarioChegada, local: 'Check-in no Hotel',
                    dica: 'Deixe as malas e saia para explorar!', tags: ['Chegada'],
                    isEspecial: true, duracao: '30 min'
                },
                ...primeiroDia.atividades.slice(0, 3)
            ];
        }
        
        if (dias.length > 1) {
            const ultimoDia = dias[dias.length - 1];
            if (horaPartida <= 12) {
                ultimoDia.atividades.push({
                    horario: `${horaPartida - 3}:00`, local: 'Transfer para Aeroporto',
                    dica: 'Hora de se despedir!', tags: ['Partida'],
                    isEspecial: true, duracao: '2 horas'
                });
            }
        }
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
        const condicoes = [
            { icon: '☀️', condition: 'Ensolarado', tempBase: 24 },
            { icon: '🌤️', condition: 'Parcialmente nublado', tempBase: 22 },
            { icon: '☁️', condition: 'Nublado', tempBase: 20 },
            { icon: '🌦️', condition: 'Possibilidade de chuva', tempBase: 18 }
        ];
        
        const condicao = condicoes[diaIndex % condicoes.length];
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
        let index = 0;
        roteiro.dias.forEach((dia) => {
            if (dia.atividades?.length) {
                dia.atividades.forEach((atividade) => {
                    if (atividade.local && !atividade.isEspecial && !atividade.isDinamica && !atividade.imagemUrl) {
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
            'Imperdível': 'badge-destaque', 'Cultural': 'badge-cultura', 'História': 'badge-cultura',
            'Histórico': 'badge-cultura', 'Arte': 'badge-cultura', 'Gastronomia': 'badge-gastronomia',
            'Natureza': 'badge-natureza', 'Aventura': 'badge-natureza', 'Compras': 'badge-compras',
            'Urbano': 'badge-compras', 'Moderno': 'badge-compras', 'Econômico': 'badge-natureza',
            'Premium': 'badge-destaque', 'Relaxante': 'badge-cultura', 'Ação': 'badge-destaque',
            'Sugestão IA': 'badge-ia'
        };
        return classes[tag] || 'badge-padrao';
    }

    formatarData(dataString) {
        if (!dataString) return 'Data indefinida';
        try {
            const data = new Date(dataString + 'T12:00:00');
            if (isNaN(data.getTime())) return dataString;
            
            const options = { day: 'numeric', month: 'long', year: 'numeric' };
            return data.toLocaleDateString('pt-BR', options);
        } catch (e) {
            return dataString;
        }
    }

    formatarDataCompleta(data) {
        const options = { weekday: 'long', day: 'numeric', month: 'numeric' };
        const formatada = data.toLocaleDateString('pt-BR', options);
        return formatada.charAt(0).toUpperCase() + formatada.slice(1);
    }

    obterIconeCompanhia(tipo) {
        const icones = { sozinho: '🧳', casal: '❤️', familia: '👨‍👩‍👧‍👦', amigos: '🎉' };
        return icones[tipo] || '👤';
    }

    obterTextoCompanhia(tipo, quantidade) {
        const textos = {
            sozinho: 'Viagem Solo', casal: 'Casal',
            familia: `Família (${quantidade} pessoas)`,
            amigos: `Grupo de Amigos (${quantidade} pessoas)`
        };
        return textos[tipo] || 'Viagem Individual';
    }

    obterIconeViagem(tipo) {
        const icones = { relaxar: '🏖️', aventura: '🏔️', cultura: '🏛️', urbano: '🏙️' };
        return icones[tipo] || '✨';
    }

    obterTextoViagem(tipo) {
        const textos = {
            relaxar: 'Relaxamento e Descanso', aventura: 'Aventura e Natureza',
            cultura: 'Cultura e História', urbano: 'Urbano e Moderno'
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
        
        const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        requestAnimationFrame(() => { toast.classList.add('toast-visible'); });
        
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

console.log('🎯 Benetrip Manual Itinerary v3.0 - PRIORIDADE TOTAL PARA LLM!');
