/**
 * Benetrip - Manual Itinerary v5.1 - FALLBACKS MELHORADOS
 * ✅ Mantém: Origem dos dados do formulário + Extração robusta da IA
 * ✅ Aplica: Performance, eventos, lazy loading, imagens completas, previsão real
 * ✅ NOVO: Fallbacks de imagem específicos por destino (igual ao itinerary.js)
 */

class BenetripManualItinerary {
    constructor() {
        // ✅ Estrutura otimizada igual ao itinerary.js
        this.form = document.getElementById('itineraryForm');
        this.resultContainer = document.getElementById('itineraryResult');
        this.generateBtn = document.getElementById('generateBtn');
        this.btnText = document.getElementById('btnText');
        this.btnSpinner = document.getElementById('btnSpinner');
        
        // ✅ Cache e observers otimizados
        this.imagensCache = new Map();
        this.imageObserver = null;
        this.atividadesUtilizadas = new Set();
        this.roteiroPronto = null;
        this.estaCarregando = false;
        this.progressoAtual = 10;
        this.intervalId = null;
        
        // ✅ Flags de debug
        this.roteiroOriginacao = 'desconhecida';
        
        this.init();
    }

    init() {
        console.log('🚀 Benetrip Manual Itinerary v5.1 - FALLBACKS MELHORADOS');
        
        this.configurarEventosOtimizados();
        this.setupDateDefaults();
        this.setupHorarioPreview();
        this.configurarLazyLoadingOtimizado();
    }

    // ===============================================
    // ✅ EVENTOS OTIMIZADOS (igual itinerary.js)
    // ===============================================

    configurarEventosOtimizados() {
        // ✅ Event delegation otimizado
        document.addEventListener('click', (e) => {
            // Botão gerar roteiro
            if (e.target.closest('#generateBtn')) {
                e.preventDefault();
                this.handleSubmit(e);
                return;
            }
            
            // Botão compartilhar
            if (e.target.closest('#btn-compartilhar-roteiro')) {
                e.preventDefault();
                this.compartilharRoteiro();
                return;
            }
            
            // Botão editar
            if (e.target.closest('#btn-editar-roteiro')) {
                e.preventDefault();
                this.editarRoteiro();
                return;
            }
            
            // Botões de mapa
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

        // ✅ Form submission otimizado
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // ✅ Mudança de companhia otimizada
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

    // ===============================================
    // ✅ LAZY LOADING OTIMIZADO (igual itinerary.js)
    // ===============================================

    configurarLazyLoadingOtimizado() {
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            this.carregarImagemComFallbackOtimizado(img);
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

    /**
     * ✅ CARREGAMENTO COM FALLBACK MELHORADO (igual ao itinerary.js)
     */
    carregarImagemComFallbackOtimizado(img) {
        const originalSrc = img.dataset.src;
        const local = img.alt || 'Local';
        
        // ✅ MUDANÇA: Usar destino específico nos fallbacks
        const destino = this.roteiroPronto?.resumo?.destino || this.roteiroPronto?.destino || 'Brasil';
        
        // Fallbacks melhorados (igual ao itinerary.js)
        const fallbacks = [
            originalSrc,
            `https://picsum.photos/400/250?random=${Math.floor(Math.random() * 1000)}`,
            `https://source.unsplash.com/400x250/?travel,${encodeURIComponent(destino)}`, // <- ESPECÍFICO
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

    // ===============================================
    // ✅ FORM SETUP (mantido do manual)
    // ===============================================

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
                    font-size: 12px; color: #666; margin-top: 4px; padding: 4px 8px;
                    background: rgba(232, 119, 34, 0.1); border-radius: 4px;
                    border-left: 2px solid var(--primary-color);
                `;
                previewEl.textContent = previewChegada;
                horarioChegada.parentNode.appendChild(previewEl);
            }
            
            if (previewPartida) {
                const previewEl = document.createElement('div');
                previewEl.className = 'horario-preview';
                previewEl.style.cssText = `
                    font-size: 12px; color: #666; margin-top: 4px; padding: 4px 8px;
                    background: rgba(0, 163, 224, 0.1); border-radius: 4px;
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

    // ===============================================
    // ✅ SUBMISSION OTIMIZADO
    // ===============================================

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            this.exibirToast('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }
        
        this.iniciarCarregamentoOtimizado();
        
        try {
            const formData = this.getFormData();
            await this.gerarRoteiroOtimizado(formData);
            
            // ✅ Origem do roteiro com métricas
            const origemMsg = this.roteiroOriginacao === 'IA' 
                ? `Roteiro personalizado criado pela IA! 🤖✨` 
                : this.roteiroOriginacao === 'fallback'
                ? 'Roteiro criado com sistema interno! 🛡️'
                : 'Roteiro criado com sucesso! 🎉';
                
            this.exibirToast(origemMsg, 'success');
            
        } catch (error) {
            console.error('Erro ao gerar roteiro:', error);
            this.exibirToast('Erro ao gerar roteiro. Tente novamente.', 'error');
        } finally {
            this.finalizarCarregamento();
        }
    }

    // ===============================================
    // ✅ GERAÇÃO DE ROTEIRO OTIMIZADA
    // ===============================================

    async gerarRoteiroOtimizado(formData) {
        console.log('🎯 GERAÇÃO OTIMIZADA - PRIORIDADE ABSOLUTA PARA LLM');
        
        // ✅ Tentar IA com retry otimizado
        let roteiroIA = null;
        let tentativasIA = 0;
        const maxTentativasIA = 3;
        
        while (tentativasIA < maxTentativasIA && !roteiroIA) {
            try {
                tentativasIA++;
                console.log(`🤖 Tentativa ${tentativasIA}/${maxTentativasIA} - Chamando API da IA...`);
                
                roteiroIA = await this.chamarAPIRealOtimizada(formData, tentativasIA);
                
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
        
        if (roteiroIA) {
            // ✅ SUCESSO COM IA: Converter preservando TUDO da IA
            console.log('🎉 USANDO ROTEIRO DA IA - Convertendo para formato otimizado...');
            this.roteiroPronto = this.converterRoteiroIAOtimizado(roteiroIA, formData);
            
        } else {
            // ❌ FALLBACK: Sistema interno otimizado
            console.warn('😞 IA não disponível - Usando sistema interno otimizado...');
            this.roteiroOriginacao = 'fallback';
            this.atividadesUtilizadas.clear();
            this.roteiroPronto = this.gerarRoteiroFallbackOtimizado(formData);
        }
        
        // ✅ Buscar previsão e imagens em paralelo (otimizado)
        await Promise.all([
            this.buscarPrevisaoTempoOtimizada(),
            this.buscarTodasImagensOtimizado() // <- MÉTODO OTIMIZADO
        ]);
        
        this.atualizarUIComRoteiroOtimizada();
        
        console.log(`📋 ROTEIRO FINAL gerado via: ${this.roteiroOriginacao.toUpperCase()}`);
    }

    // ===============================================
    // ✅ API CALL OTIMIZADA
    // ===============================================

    async chamarAPIRealOtimizada(formData, tentativa) {
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
                quantidade: formData.quantidade,
                variedadeMaxima: true,
                detalhamento: 'alto'
            },
            modeloIA: 'deepseek'
        };
        
        console.log('📡 Parâmetros para IA otimizados:', parametrosIA);
        
        // ✅ Timeout escalável otimizado
        const timeout = 90000 + (tentativa - 1) * 15000;
        
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
        
        // ✅ Validação otimizada
        if (!this.validarRespostaIA(roteiroIA)) {
            throw new Error('Resposta da IA inválida ou incompleta');
        }
        
        return roteiroIA;
    }

    validarRespostaIA(roteiroIA) {
        if (!roteiroIA || typeof roteiroIA !== 'object') {
            console.error('❌ Resposta da IA não é um objeto válido');
            return false;
        }
        
        if (!roteiroIA.dias || !Array.isArray(roteiroIA.dias) || roteiroIA.dias.length === 0) {
            console.error('❌ Resposta da IA sem dias válidos');
            return false;
        }
        
        return true;
    }

    // ===============================================
    // ✅ CONVERSÃO OTIMIZADA (mantém extração robusta)
    // ===============================================

    converterRoteiroIAOtimizado(roteiroIA, formData) {
        console.log('🔄 Conversão OTIMIZADA mantendo extração robusta...');
        
        const diasContinuos = [];
        
        roteiroIA.dias.forEach((diaIA, index) => {
            const dataAtual = new Date(formData.dataIda);
            dataAtual.setDate(dataAtual.getDate() + index);
            
            const diaContino = {
                data: this.formatDate(dataAtual),
                // ✅ MANTÉM: Extração robusta de descrição
                descricao: this.extrairDescricaoCompleta(diaIA, index + 1, formData.destino, formData),
                // ✅ OTIMIZA: Extração de atividades mais eficiente
                atividades: this.extrairAtividadesOtimizado(diaIA),
                // ✅ MANTÉM: Observação completa
                observacao: this.extrairObservacaoCompleta(diaIA)
            };
            
            // Observações especiais
            if (!diaContino.observacao) {
                if (index === 0) {
                    diaContino.observacao = this.obterObservacaoPrimeiroDia(formData.horarioChegada);
                } else if (index === roteiroIA.dias.length - 1) {
                    diaContino.observacao = this.obterObservacaoUltimoDia(formData.horarioPartida);
                }
            }
            
            diasContinuos.push(diaContino);
        });
        
        this.ajustarAtividadesPorHorariosOtimizado(diasContinuos, formData);
        
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
            metadados: {
                geradoPorIA: true,
                modeloIA: roteiroIA.modelo || 'deepseek',
                versaoIA: roteiroIA.versao,
                tempoGeracao: roteiroIA.tempo_geracao
            }
        };
    }

    // ✅ MANTÉM: Extração robusta de descrição
    extrairDescricaoCompleta(diaIA, numeroDia, destino, formData) {
        const possiveisDescricoes = [
            // Português
            diaIA.descricao, diaIA.tema, diaIA.titulo, diaIA.resumo, diaIA.introducao,
            diaIA.contexto, diaIA.resumo_dia, diaIA.tema_dia, diaIA.foco_dia,
            // Inglês
            diaIA.description, diaIA.summary, diaIA.theme, diaIA.title, diaIA.intro,
            diaIA.context, diaIA.day_summary, diaIA.day_theme, diaIA.day_description,
            // Campos compostos
            diaIA.dia?.descricao, diaIA.dia?.tema, diaIA.info?.descricao
        ];
        
        // Busca descrição rica
        for (const desc of possiveisDescricoes) {
            if (desc && typeof desc === 'string' && desc.trim().length >= 20) {
                console.log(`✅ Descrição IA capturada (Dia ${numeroDia}): "${desc.substring(0, 50)}..."`);
                return desc.trim();
            }
        }
        
        // Fallback melhorado
        return this.gerarDescricaoGenericaMelhorada(numeroDia, destino, formData);
    }

    extrairObservacaoCompleta(diaIA) {
        const possiveisObservacoes = [
            diaIA.observacao, diaIA.dica, diaIA.nota, diaIA.aviso,
            diaIA.observation, diaIA.tip, diaIA.note, diaIA.hint,
            diaIA.dia?.observacao, diaIA.info?.observacao
        ];
        
        for (const obs of possiveisObservacoes) {
            if (obs && typeof obs === 'string' && obs.trim().length >= 10) {
                console.log(`✅ Observação IA capturada: "${obs.substring(0, 30)}..."`);
                return obs.trim();
            }
        }
        
        return null;
    }

    // ✅ OTIMIZADO: Extração de atividades mais eficiente
    extrairAtividadesOtimizado(diaIA) {
        const atividades = [];
        
        // Método 1: Atividades diretas
        if (diaIA.atividades && Array.isArray(diaIA.atividades)) {
            diaIA.atividades.forEach(ativ => {
                atividades.push({
                    horario: ativ.horario || ativ.hora || '09:00',
                    local: ativ.local || ativ.lugar || ativ.atividade || 'Atividade sugerida pela IA',
                    tags: ativ.tags || ativ.categorias || ['Sugestão IA'],
                    dica: ativ.dica || ativ.observacao || ativ.detalhes || 'Recomendação personalizada da IA!',
                    duracao: ativ.duracao || ativ.tempo || this.estimarDuracao(ativ.local || 'atividade'),
                    periodo: this.obterPeriodoPorHorario(ativ.horario || '09:00'),
                    originalIA: true,
                    dadosOriginais: ativ
                });
            });
        }
        
        // Método 2: Por períodos
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
        
        // Fallback se nada encontrado
        if (atividades.length === 0) {
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

    // ===============================================
    // ✅ BUSCA DE IMAGENS OTIMIZADA (com fallbacks melhorados)
    // ===============================================

    async buscarTodasImagensOtimizado() {
        try {
            console.log('🖼️ Busca OTIMIZADA de imagens para TODOS os dias...');
            
            if (!this.roteiroPronto?.dias || this.roteiroPronto.dias.length === 0) {
                console.warn('⚠️ Sem roteiro para buscar imagens');
                return;
            }
            
            // ✅ Coletar TODAS as atividades (sem limite)
            const todasAtividades = [];
            let totalAtividades = 0;
            
            this.roteiroPronto.dias.forEach((dia, diaIndex) => {
                if (dia.atividades?.length) {
                    dia.atividades.forEach((atividade, ativIndex) => {
                        if (atividade.local && !atividade.isEspecial) {
                            todasAtividades.push({
                                local: atividade.local,
                                diaIndex,
                                ativIndex,
                                referencia: atividade
                            });
                            totalAtividades++;
                        }
                    });
                }
            });
            
            console.log(`📊 Estatísticas OTIMIZADAS: ${totalAtividades} atividades para buscar`);
            
            // ✅ Buscar imagens para TODAS as atividades
            const imagensMap = new Map();
            let sucessos = 0;
            
            // Processar em lotes otimizados
            const tamanhoLote = 3;
            for (let i = 0; i < todasAtividades.length; i += tamanhoLote) {
                const lote = todasAtividades.slice(i, i + tamanhoLote);
                
                const promessas = lote.map(async (ativInfo) => {
                    try {
                        const resultado = await this.buscarImagemComCache(ativInfo.local);
                        
                        if (resultado.sucesso) {
                            imagensMap.set(ativInfo.local, resultado.url);
                            sucessos++;
                        }
                        
                        return resultado;
                    } catch (erro) {
                        console.warn(`⚠️ Erro na busca de imagem para ${ativInfo.local}:`, erro);
                        return { sucesso: false, erro: erro.message };
                    }
                });
                
                await Promise.allSettled(promessas);
                
                if (i + tamanhoLote < todasAtividades.length) {
                    await this.delay(200);
                }
            }
            
            // ✅ Aplicar imagens OU fallbacks para TODAS as atividades
            let imagensAplicadas = 0;
            this.roteiroPronto.dias.forEach((dia, diaIndex) => {
                if (dia.atividades?.length) {
                    dia.atividades.forEach((atividade, ativIndex) => {
                        if (atividade.local && !atividade.isEspecial) {
                            const imagemUrl = imagensMap.get(atividade.local);
                            
                            if (imagemUrl) {
                                atividade.imagemUrl = imagemUrl;
                            } else {
                                atividade.imagemUrl = this.gerarImagemFallbackOtimizado(atividade.local, diaIndex, ativIndex);
                                atividade.isFallback = true;
                            }
                            
                            imagensAplicadas++;
                        }
                    });
                }
            });
            
            console.log(`✅ Imagens OTIMIZADAS: ${imagensAplicadas}/${totalAtividades} (${sucessos} da API, ${imagensAplicadas - sucessos} fallbacks)`);
            
        } catch (erro) {
            console.error('❌ Erro ao buscar imagens:', erro);
            this.aplicarFallbacksGlobal();
        }
    }

    /**
     * ✅ FALLBACK PARA ATIVIDADES MELHORADO (igual ao itinerary.js)
     */
    gerarImagemFallbackOtimizado(local, diaIndex, ativIndex) {
        // ✅ MUDANÇA: Usar destino específico
        const destino = this.roteiroPronto?.resumo?.destino || this.roteiroPronto?.destino || 'Brasil';
        
        // Fallbacks funcionais com destino específico
        const fallbacks = [
            `https://picsum.photos/400/250?random=${diaIndex}${ativIndex}${Date.now()}`,
            `https://source.unsplash.com/400x250/?travel,${encodeURIComponent(destino)}`, // <- ESPECÍFICO
            this.criarImagemPlaceholderSVG(local)
        ];
        
        return fallbacks[ativIndex % fallbacks.length];
    }

    /**
     * ✅ BUSCA DE IMAGEM COM CACHE MELHORADA (igual ao itinerary.js)
     */
    async buscarImagemComCache(local) {
        if (this.imagensCache.has(local)) {
            return this.imagensCache.get(local);
        }
        
        try {
            // ✅ MUDANÇA: Query mais específica incluindo o destino
            const destino = this.roteiroPronto?.resumo?.destino || this.roteiroPronto?.destino || 'Brasil';
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
                this.imagensCache.set(local, resultado);
                return resultado;
            }
            
            throw new Error('Sem imagens na resposta');
            
        } catch (erro) {
            const resultado = { sucesso: false, erro: erro.message };
            this.imagensCache.set(local, resultado);
            return resultado;
        }
    }

    // ===============================================
    // ✅ PREVISÃO DO TEMPO OTIMIZADA (igual itinerary.js)
    // ===============================================

    async buscarPrevisaoTempoOtimizada() {
        try {
            console.log('🌤️ Busca OTIMIZADA de previsão do tempo...');
            
            if (!this.roteiroPronto?.dias || this.roteiroPronto.dias.length === 0) {
                console.warn('⚠️ Sem dias no roteiro para buscar previsão');
                return;
            }
            
            // ✅ Preparar parâmetros para API
            const cidade = this.roteiroPronto.resumo?.destino || this.roteiroPronto.destino;
            const dataInicio = this.roteiroPronto.resumo?.dataIda;
            const dataFim = this.roteiroPronto.resumo?.dataVolta;
            const diasComPrevisao = Math.min(3, this.roteiroPronto.dias.length);
            
            console.log(`📊 Buscando previsão para: ${cidade} (${diasComPrevisao} dias)`);
            
            try {
                // ✅ CHAMADA REAL para API de tempo
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
                
                // ✅ Aplicar previsões reais aos primeiros dias
                let aplicados = 0;
                for (let i = 0; i < diasComPrevisao; i++) {
                    if (dadosTempo[i]) {
                        this.roteiroPronto.dias[i].previsao = {
                            icon: dadosTempo[i].icon || '🌤️',
                            temperature: dadosTempo[i].temperature || 25,
                            condition: dadosTempo[i].condition || 'Tempo agradável',
                            date: dadosTempo[i].date
                        };
                        aplicados++;
                    } else {
                        this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoFallbackOtimizada(i);
                    }
                }
                
                console.log(`✅ Previsão REAL aplicada a ${aplicados}/${diasComPrevisao} dias`);
                
            } catch (erroAPI) {
                console.warn('⚠️ Erro na API de tempo, usando fallback:', erroAPI.message);
                
                for (let i = 0; i < diasComPrevisao; i++) {
                    this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoFallbackOtimizada(i);
                }
                
                console.log(`🛡️ Previsão FALLBACK aplicada aos primeiros ${diasComPrevisao} dias`);
            }
            
        } catch (erro) {
            console.error('❌ Erro geral na busca de previsão:', erro);
            
            const diasComPrevisao = Math.min(3, this.roteiroPronto.dias.length);
            for (let i = 0; i < diasComPrevisao; i++) {
                if (!this.roteiroPronto.dias[i].previsao) {
                    this.roteiroPronto.dias[i].previsao = this.gerarPrevisaoFallbackOtimizada(i);
                }
            }
        }
    }

    gerarPrevisaoFallbackOtimizada(diaIndex) {
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
        const dataInicio = new Date(this.roteiroPronto.resumo?.dataIda + 'T12:00:00');
        const dataAlvo = new Date(dataInicio);
        dataAlvo.setDate(dataInicio.getDate() + diaIndex);
        
        return this.formatDate(dataAlvo);
    }

    // ===============================================
    // ✅ UI OTIMIZADA (igual itinerary.js)
    // ===============================================

    atualizarUIComRoteiroOtimizada() {
        console.log('🎨 Atualizando UI OTIMIZADA...');
        
        const container = this.resultContainer;
        if (!container) {
            console.error('❌ Container do roteiro não encontrado');
            return;
        }
        
        container.innerHTML = '';
        container.classList.add('roteiro-content');
        
        container.appendChild(this.criarResumoViagemOtimizado());
        
        this.roteiroPronto.dias.forEach((dia, index) => {
            container.appendChild(this.criarElementoDiaContinuoOtimizado(dia, index + 1));
        });
        
        const spacer = document.createElement('div');
        spacer.style.height = '100px';
        container.appendChild(spacer);
        
        // ✅ Configurar lazy loading APÓS inserir elementos
        this.configurarLazyLoadingParaElementos();
        
        container.classList.add('visible');
        
        setTimeout(() => {
            container.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 300);
        
        console.log('✅ Interface OTIMIZADA atualizada');
    }

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

    criarResumoViagemOtimizado() {
        const resumo = document.createElement('div');
        resumo.className = 'resumo-viagem';
        
        const dataIda = this.formatarData(this.roteiroPronto.resumo.dataIda);
        const dataVolta = this.formatarData(this.roteiroPronto.resumo.dataVolta);
        
        // ✅ Indicador de origem otimizado
        const indicadorOrigem = this.roteiroPronto.metadados?.geradoPorIA 
            ? `<div class="origem-roteiro ia">🤖 Roteiro criado pela IA</div>`
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
                        <p class="valor">${this.roteiroPronto.resumo.destino}</p>
                    </div>
                </div>
                
                <div class="resumo-item">
                    <div class="icone">📅</div>
                    <div class="texto">
                        <div class="label">Período:</div>
                        <p class="valor">${dataIda} até ${dataVolta}</p>
                        <p class="valor-secundario">${this.roteiroPronto.resumo.diasViagem} ${this.roteiroPronto.resumo.diasViagem === 1 ? 'dia' : 'dias'} de viagem</p>
                    </div>
                </div>
                
                <div class="resumo-item">
                    <div class="icone">✈️</div>
                    <div class="texto">
                        <div class="label">Voos:</div>
                        <p class="valor">Chegada: ${this.roteiroPronto.resumo.horarioChegada}</p>
                        <p class="valor">Partida: ${this.roteiroPronto.resumo.horarioPartida}</p>
                    </div>
                </div>
                
                <div class="resumo-item">
                    <div class="icone">${this.obterIconeCompanhia(this.roteiroPronto.resumo.tipoCompanhia)}</div>
                    <div class="texto">
                        <div class="label">Viajando:</div>
                        <p class="valor">${this.obterTextoCompanhia(this.roteiroPronto.resumo.tipoCompanhia, this.roteiroPronto.resumo.quantidade)}</p>
                    </div>
                </div>
                
                <div class="resumo-item">
                    <div class="icone">${this.obterIconeViagem(this.roteiroPronto.resumo.tipoViagem)}</div>
                    <div class="texto">
                        <div class="label">Estilo:</div>
                        <p class="valor">${this.obterTextoViagem(this.roteiroPronto.resumo.tipoViagem)}</p>
                    </div>
                </div>
            </div>
        `;
        
        return resumo;
    }

    criarElementoDiaContinuoOtimizado(dia, numeroDia) {
        const elemento = document.createElement('div');
        elemento.className = 'dia-roteiro continuo';
        elemento.setAttribute('data-dia', numeroDia);
        
        const dataFormatada = this.formatarDataCompleta(new Date(dia.data));
        const temPrevisao = dia.previsao && numeroDia <= 3;
        
        elemento.innerHTML = `
            <div class="dia-header">
                <div class="dia-numero">${numeroDia}</div>
                <span>Dia ${numeroDia} · ${dataFormatada}</span>
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
                    ${this.criarListaAtividadesContinuasOtimizada(dia.atividades)}
                </div>
            </div>
        `;
        
        return elemento;
    }

    criarListaAtividadesContinuasOtimizada(atividades) {
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

    // ===============================================
    // ✅ CARREGAMENTO OTIMIZADO (igual itinerary.js)
    // ===============================================

    iniciarCarregamentoOtimizado() {
        this.estaCarregando = true;
        this.progressoAtual = 10;
        
        this.showLoading(true);
        this.iniciarAnimacaoProgressoOtimizada();
    }

    iniciarAnimacaoProgressoOtimizada() {
        const mensagens = [
            '🤖 Consultando IA para seu roteiro personalizado...',
            '🗺️ Mapeando pontos turísticos especiais...',
            '📸 Buscando imagens dos locais...',
            '🌤️ Checando previsão do tempo...',
            '📝 Finalizando seu roteiro perfeito...'
        ];
        
        let indice = 0;
        
        this.intervalId = setInterval(() => {
            this.progressoAtual = Math.min(this.progressoAtual + 12, 90);
            this.atualizarTextoCarregamento(mensagens[indice % mensagens.length]);
            indice++;
            
            if (this.progressoAtual >= 90) {
                clearInterval(this.intervalId);
            }
        }, 1000);
    }

    atualizarTextoCarregamento(mensagem) {
        if (this.btnText) {
            this.btnText.textContent = mensagem;
        }
    }

    finalizarCarregamento() {
        clearInterval(this.intervalId);
        this.estaCarregando = false;
        this.showLoading(false);
    }

    // ===============================================
    // ✅ FALLBACK OTIMIZADO
    // ===============================================

    gerarRoteiroFallbackOtimizado(formData) {
        console.log('🛡️ Gerando roteiro fallback OTIMIZADO...');
        
        const diasViagem = this.calcularDiasViagem(formData.dataIda, formData.dataVolta);
        const destino = formData.destino;
        
        this.atividadesUtilizadas.clear();
        
        const dias = [];
        for (let i = 0; i < diasViagem; i++) {
            const dataAtual = new Date(formData.dataIda);
            dataAtual.setDate(dataAtual.getDate() + i);
            
            const dia = {
                data: this.formatDate(dataAtual),
                descricao: this.gerarDescricaoGenericaMelhorada(i + 1, destino, formData),
                atividades: this.gerarAtividadesVariadasPorDia(formData, i, diasViagem)
            };
            
            if (i === 0) {
                dia.observacao = this.obterObservacaoPrimeiroDia(formData.horarioChegada);
            } else if (i === diasViagem - 1) {
                dia.observacao = this.obterObservacaoUltimoDia(formData.horarioPartida);
            }
            
            if (i < 3) {
                dia.previsao = this.gerarPrevisaoFallbackOtimizada(i);
            }
            
            dias.push(dia);
        }
        
        this.ajustarAtividadesPorHorariosOtimizado(dias, formData);
        
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

    // ===============================================
    // ✅ AÇÕES DE USUÁRIO OTIMIZADAS (igual itinerary.js)
    // ===============================================

    async compartilharRoteiro() {
        const titulo = `Roteiro Benetrip - ${this.roteiroPronto.resumo.destino}`;
        const texto = `Confira meu roteiro personalizado para ${this.roteiroPronto.resumo.destino}! 🐕✈️`;
        const url = window.location.href;
        
        if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
            try {
                await navigator.share({ title: titulo, text: texto, url });
                this.exibirToast('Roteiro compartilhado!', 'success');
                return;
            } catch (e) {
                console.log('Share cancelado');
            }
        }
        
        try {
            await navigator.clipboard.writeText(url);
            this.exibirToast('Link copiado! Cole onde quiser compartilhar.', 'success');
        } catch (e) {
            this.exibirToast('Link copiado!', 'success');
        }
    }

    editarRoteiro() {
        this.exibirToast('Em breve você poderá personalizar ainda mais seu roteiro! 🚀', 'info');
    }

    abrirMapa(local) {
        const destino = this.roteiroPronto?.resumo?.destino || this.roteiroPronto?.destino || 'Brasil';
        const query = `${local}, ${destino}`;
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    // ===============================================
    // ✅ TOASTS OTIMIZADOS (igual itinerary.js)
    // ===============================================

    exibirToast(mensagem, tipo = 'info') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${tipo}`;
        
        const icones = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icones[tipo] || icones.info}</span>
            <span class="toast-message">${mensagem}</span>
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

    // ===============================================
    // ✅ MÉTODOS AUXILIARES (mantidos essenciais)
    // ===============================================

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
            this.exibirToast('A data de volta deve ser posterior à data de ida.', 'error');
            return false;
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

    calcularDiasViagem(dataIda, dataVolta) {
        const ida = new Date(dataIda);
        const volta = new Date(dataVolta);
        const diffTime = Math.abs(volta - ida);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
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

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    aplicarFallbacksGlobal() {
        console.log('🔄 Aplicando fallbacks globais...');
        
        let index = 0;
        this.roteiroPronto.dias.forEach((dia) => {
            if (dia.atividades?.length) {
                dia.atividades.forEach((atividade) => {
                    if (atividade.local && !atividade.isEspecial && !atividade.imagemUrl) {
                        atividade.imagemUrl = this.gerarImagemFallbackOtimizado(atividade.local, 0, index++);
                        atividade.isFallback = true;
                    }
                });
            }
        });
    }

    // Métodos auxiliares essenciais
    extrairPais(destino) {
        if (destino.includes(',')) {
            return destino.split(',')[1].trim();
        }
        return 'Internacional';
    }

    gerarDescricaoGenericaMelhorada(numeroDia, destino, formData) {
        if (numeroDia === 1) {
            return `Chegada e primeiras impressões de ${destino}!`;
        } else if (numeroDia === formData.diasViagem) {
            return `Últimos momentos preciosos em ${destino} antes da partida.`;
        }
        
        const descricoes = [
            `Explorando os tesouros de ${destino}.`,
            `Imersão cultural em ${destino}.`,
            `Descobrindo os sabores de ${destino}.`,
            `Aventuras inesquecíveis em ${destino}.`
        ];
        
        return descricoes[(numeroDia - 2) % descricoes.length];
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

    ajustarAtividadesPorHorariosOtimizado(dias, formData) {
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
                isEspecial: true,
                duracao: '1 hora'
            }];
        } else if (horaChegada >= 16) {
            primeiroDia.atividades.unshift({
                horario: formData.horarioChegada,
                local: 'Check-in no Hotel',
                dica: 'Deixe as malas e saia para explorar!',
                tags: ['Chegada'],
                isEspecial: true,
                duracao: '30 min'
            });
            primeiroDia.atividades = primeiroDia.atividades.slice(0, 3);
        }
        
        if (dias.length > 1) {
            const ultimoDia = dias[dias.length - 1];
            if (horaPartida <= 12) {
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

    obterPeriodoPorHorario(horario) {
        const hora = parseInt(horario.split(':')[0]);
        if (hora < 12) return 'manha';
        if (hora < 18) return 'tarde';
        return 'noite';
    }

    obterHorarioPorPeriodo(periodo) {
        const horarios = { 'manha': '09:00', 'tarde': '14:00', 'noite': '19:00' };
        return horarios[periodo] || '12:00';
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
        if (localLower.includes('restaurante')) return duracoes.restaurante;
        return '1-2 horas';
    }

    gerarAtividadesVariadasPorDia(formData, diaIndex, totalDias) {
        const atividadesBase = [
            { local: "Centro Histórico", dica: "Comece cedo para evitar multidões!" },
            { local: "Museu Nacional", dica: "Não perca a exposição principal!" },
            { local: "Mercado Central", dica: "Prove as especialidades locais!" },
            { local: "Catedral Principal", dica: "Arquitetura impressionante!" },
            { local: "Parque Municipal", dica: "Ótimo para caminhadas!" },
            { local: "Bairro Artístico", dica: "Galerias e street art incríveis!" },
            { local: "Mirante da Cidade", dica: "Vista panorâmica espetacular!" },
            { local: "Restaurante Típico", dica: "Peça o prato da casa!" }
        ];
        
        const atividades = [];
        const numAtividades = 3 + (diaIndex % 2);
        const horariosBase = ['09:00', '11:30', '14:00', '16:30', '19:00'];
        
        for (let i = 0; i < numAtividades; i++) {
            const index = (diaIndex * 4 + i) % atividadesBase.length;
            const atividade = { ...atividadesBase[index] };
            
            atividade.horario = horariosBase[i % horariosBase.length];
            atividade.tags = ['Recomendado'];
            atividade.duracao = this.estimarDuracao(atividade.local);
            
            atividades.push(atividade);
        }
        
        return atividades;
    }

    getClasseBadge(tag) {
        const classes = {
            'Imperdível': 'badge-destaque',
            'Cultural': 'badge-cultura',
            'Gastronomia': 'badge-gastronomia',
            'Natureza': 'badge-natureza',
            'Compras': 'badge-compras',
            'Sugestão IA': 'badge-ia'
        };
        return classes[tag] || 'badge-padrao';
    }

    obterIconeCompanhia(tipo) {
        const icones = { sozinho: '🧳', casal: '❤️', familia: '👨‍👩‍👧‍👦', amigos: '🎉' };
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
        const icones = { relaxar: '🏖️', aventura: '🏔️', cultura: '🏛️', urbano: '🏙️' };
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
}

// ✅ INICIALIZAÇÃO OTIMIZADA
document.addEventListener('DOMContentLoaded', () => {
    new BenetripManualItinerary();
});

console.log('🎯 Benetrip Manual Itinerary v5.1 - FALLBACKS MELHORADOS IGUAL AO ITINERARY.JS!');
