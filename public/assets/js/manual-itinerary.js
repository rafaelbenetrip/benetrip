// ======================================
// BENETRIP - ROTEIRO MANUAL JAVASCRIPT
// ✅ VERSÃO CORRIGIDA - Horários e botão "Ver no mapa"
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
    }

    init() {
        console.log('🚀 Benetrip Roteiro Manual iniciado');
        
        this.setupEventListeners();
        this.setupDateDefaults();
        this.setupHorarioPreview();
        this.configurarLazyLoading();
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
            
            // ✅ Buscar imagens para o roteiro
            await this.buscarImagensParaRoteiro(roteiro);
            
            this.displayItinerary(roteiro);
            this.showToast('Roteiro criado com sucesso! 🎉', 'success');
        } catch (error) {
            console.error('Erro ao gerar roteiro:', error);
            this.showToast('Erro ao gerar roteiro. Tente novamente.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // ✅ Buscar imagens para todas as atividades do roteiro
    async buscarImagensParaRoteiro(roteiro) {
        try {
            console.log('🖼️ Buscando imagens para o roteiro...');
            
            if (!roteiro.dias || roteiro.dias.length === 0) {
                console.warn('⚠️ Sem dias no roteiro para buscar imagens');
                return;
            }
            
            // Coletar todas as atividades
            const todasAtividades = [];
            roteiro.dias.forEach((dia, diaIndex) => {
                if (dia.atividades?.length) {
                    dia.atividades.forEach((atividade, ativIndex) => {
                        if (atividade.local && !atividade.isEspecial) {
                            todasAtividades.push({
                                atividade,
                                diaIndex,
                                ativIndex,
                                destino: roteiro.resumo.destino
                            });
                        }
                    });
                }
            });
            
            console.log(`📊 ${todasAtividades.length} atividades encontradas para buscar imagens`);
            
            // Processar em lotes pequenos
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
                
                // Pequena pausa entre lotes
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

    // ✅ Buscar imagem com cache
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

    // ✅ Gerar fallback de imagem
    gerarImagemFallback(local, diaIndex, ativIndex) {
        const fallbacks = [
            `https://picsum.photos/400/250?random=${diaIndex}${ativIndex}${Date.now()}`,
            `https://source.unsplash.com/400x250/?travel`,
            this.criarImagemPlaceholderSVG(local)
        ];
        
        return fallbacks[ativIndex % fallbacks.length];
    }

    // ✅ Aplicar fallbacks globais
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
            
            // ✅ CHAMADA CORRIGIDA - Agora incluindo os horários!
            const parametrosIA = {
                destino: formData.destino,
                pais: this.extrairPais(formData.destino),
                dataInicio: formData.dataIda,
                dataFim: formData.dataVolta,
                horaChegada: formData.horarioChegada,  // ✅ CORRIGIDO!
                horaSaida: formData.horarioPartida,    // ✅ CORRIGIDO!
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
            
            console.log('📡 Enviando para API (CORRIGIDO COM HORÁRIOS):', parametrosIA);
            
            const response = await fetch('/api/itinerary-generator', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(parametrosIA),
                signal: AbortSignal.timeout(30000)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erro da API:', response.status, errorText);
                throw new Error(`API Error ${response.status}: ${errorText}`);
            }
            
            const roteiroIA = await response.json();
            console.log('✅ Roteiro recebido da IA:', roteiroIA);
            
            return this.converterRoteiroParaExibicao(roteiroIA, formData);
            
        } catch (erro) {
            console.error('❌ Erro na API, usando fallback robusto:', erro);
            
            // ✅ FALLBACK MELHORADO
            this.showToast('Gerando roteiro offline - funcionalidade completa!', 'info');
            return this.gerarRoteiroFallbackCompleto(formData);
        }
    }

    // ✅ NOVO: Fallback completo e inteligente COM HORÁRIOS
    gerarRoteiroFallbackCompleto(formData) {
        console.log('🛡️ Gerando roteiro fallback COMPLETO COM HORÁRIOS...');
        
        const diasViagem = this.calcularDiasViagem(formData.dataIda, formData.dataVolta);
        const destino = formData.destino;
        
        const dias = [];
        for (let i = 0; i < diasViagem; i++) {
            const dataAtual = new Date(formData.dataIda);
            dataAtual.setDate(dataAtual.getDate() + i);
            
            dias.push({
                numero: i + 1,
                data: this.formatDate(dataAtual),
                dataFormatada: this.formatarDataCompleta(dataAtual),
                descricao: this.obterDescricaoInteligente(i + 1, destino, diasViagem, formData),
                atividades: this.gerarAtividadesInteligentes(formData, i, diasViagem)
            });
        }
        
        // ✅ AJUSTAR ATIVIDADES POR HORÁRIOS (CORRIGIDO!)
        this.ajustarAtividadesPorHorarios(dias, formData);
        
        return {
            destino: destino,
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

    // ✅ CORRIGIDO: Gerar atividades mais inteligentes baseadas no perfil
    gerarAtividadesInteligentes(formData, diaIndex, totalDias) {
        const numAtividades = this.obterNumeroAtividades(formData.intensidade);
        const atividadesPorTipo = this.obterAtividadesPorDestino(formData.destino, formData.tipoViagem);
        
        const atividades = [];
        const horariosBase = ['09:00', '11:30', '14:00', '16:30', '19:00'];
        
        for (let i = 0; i < numAtividades; i++) {
            const atividadeIndex = (diaIndex * numAtividades + i) % atividadesPorTipo.length;
            const atividade = { ...atividadesPorTipo[atividadeIndex] };
            
            atividade.horario = horariosBase[i % horariosBase.length];
            
            // Personalizar dica baseada no perfil
            atividade.dica = this.personalizarDica(atividade.dica, formData);
            
            // Ajustar tags baseadas no tipo de viagem
            atividade.tags = this.ajustarTagsPorPerfil(atividade.tags, formData);
            
            atividades.push(atividade);
        }
        
        return atividades;
    }

    // ✅ Personalizar dicas baseadas no perfil do usuário
    personalizarDica(dicaOriginal, formData) {
        const personalizado = {
            familia: dicaOriginal + ' Perfeito para toda a família!',
            casal: dicaOriginal + ' Momento romântico garantido!',
            amigos: dicaOriginal + ' Diversão em grupo!',
            sozinho: dicaOriginal + ' Ideal para reflexão e autoconhecimento!'
        };
        
        return personalizado[formData.tipoCompanhia] || dicaOriginal;
    }

    // ✅ Ajustar tags por perfil
    ajustarTagsPorPerfil(tagsOriginais, formData) {
        const tags = [...tagsOriginais];
        
        // Adicionar tag específica para orçamento
        if (formData.nivelOrcamento === 'economico') {
            tags.push('Econômico');
        } else if (formData.nivelOrcamento === 'alto') {
            tags.push('Premium');
        }
        
        // Adicionar tag para intensidade
        if (formData.intensidade === 'intenso') {
            tags.push('Ação');
        } else if (formData.intensidade === 'leve') {
            tags.push('Relaxante');
        }
        
        return tags.slice(0, 3); // Limitar a 3 tags
    }

    // ✅ Obter atividades específicas por destino
    obterAtividadesPorDestino(destino, tipoViagem) {
        const destinoLower = destino.toLowerCase();
        
        // Base de atividades por destino
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
        
        // Procurar atividades específicas do destino
        for (const [cidade, atividades] of Object.entries(atividadesEspecificas)) {
            if (destinoLower.includes(cidade)) {
                return atividades;
            }
        }
        
        // Fallback para atividades genéricas baseadas no tipo de viagem
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

    converterRoteiroParaExibicao(roteiroIA, formData) {
        console.log('🔄 Convertendo roteiro da IA para exibição...');
        
        try {
            if (!roteiroIA.dias || !Array.isArray(roteiroIA.dias)) {
                throw new Error('Estrutura de roteiro inválida da IA');
            }
            
            const diasViagem = this.calcularDiasViagem(formData.dataIda, formData.dataVolta);
            
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
                dias: this.processarDiasIA(roteiroIA.dias, formData)
            };
            
        } catch (erro) {
            console.error('❌ Erro ao converter roteiro da IA:', erro);
            return this.gerarRoteiroFallbackCompleto(formData);
        }
    }

    processarDiasIA(diasIA, formData) {
        const dias = diasIA.map((diaIA, index) => {
            const dataAtual = new Date(formData.dataIda);
            dataAtual.setDate(dataAtual.getDate() + index);
            
            const dia = {
                numero: index + 1,
                data: this.formatDate(dataAtual),
                dataFormatada: this.formatarDataCompleta(dataAtual),
                descricao: diaIA.descricao || this.obterDescricaoInteligente(index + 1, formData.destino, diasIA.length, formData),
                atividades: this.processarAtividadesIA(diaIA, formData)
            };
            
            return dia;
        });
        
        // ✅ GARANTIR QUE OS HORÁRIOS SEJAM APLICADOS
        this.ajustarAtividadesPorHorarios(dias, formData);
        return dias;
    }

    processarAtividadesIA(diaIA, formData) {
        const atividades = [];
        
        // Processar atividades do formato da IA
        if (diaIA.atividades && Array.isArray(diaIA.atividades)) {
            return diaIA.atividades.map(ativ => ({
                horario: ativ.horario || '09:00',
                local: ativ.local || 'Atividade local',
                tags: ativ.tags || ['Recomendado'],
                dica: ativ.dica || 'Aproveite esta experiência única!'
            }));
        }
        
        // Processar formato por períodos
        ['manha', 'tarde', 'noite'].forEach(periodo => {
            if (diaIA[periodo]?.atividades?.length) {
                diaIA[periodo].atividades.forEach(ativ => {
                    atividades.push({
                        horario: ativ.horario || this.obterHorarioPorPeriodo(periodo),
                        local: ativ.local || 'Atividade local',
                        tags: ativ.tags || ['Recomendado'],
                        dica: ativ.dica || 'Aproveite esta experiência única!'
                    });
                });
            }
        });
        
        // Se não temos atividades, gerar básicas
        if (atividades.length === 0) {
            return this.gerarAtividadesInteligentes(formData, 0, 1);
        }
        
        return atividades;
    }

    // ✅ CORRIGIDO: Ajustar atividades por horários de chegada/partida
    ajustarAtividadesPorHorarios(dias, formData) {
        if (dias.length === 0) return;
        
        const horaChegada = parseInt(formData.horarioChegada.split(':')[0]);
        const horaPartida = parseInt(formData.horarioPartida.split(':')[0]);
        
        console.log(`🕒 Ajustando atividades: Chegada ${horaChegada}h, Partida ${horaPartida}h`);
        
        // ✅ Ajustar primeiro dia
        const primeiroDia = dias[0];
        
        if (horaChegada >= 20) {
            // Chegada muito tarde - apenas check-in
            primeiroDia.atividades = [{
                horario: formData.horarioChegada,
                local: 'Chegada e Check-in no Hotel',
                tags: ['Chegada', 'Descanso'],
                dica: 'Chegada tarde - descanse bem para aproveitar amanhã!',
                isEspecial: true
            }];
            primeiroDia.descricao = `Chegada tardia em ${formData.destino} - tempo para descansar.`;
        } else if (horaChegada >= 16) {
            // Chegada tarde - poucas atividades
            primeiroDia.atividades = [
                {
                    horario: formData.horarioChegada,
                    local: 'Chegada e Check-in',
                    tags: ['Chegada'],
                    dica: 'Deixe as bagagens e saia para explorar!',
                    isEspecial: true
                },
                ...primeiroDia.atividades.slice(0, 2).map(ativ => ({
                    ...ativ,
                    horario: this.ajustarHorarioAposChegada(ativ.horario, horaChegada)
                }))
            ];
        } else {
            // Chegada cedo - adicionar atividade de check-in no início
            primeiroDia.atividades = [
                {
                    horario: formData.horarioChegada,
                    local: 'Chegada e Check-in',
                    tags: ['Chegada'],
                    dica: 'Deixe as bagagens e comece a explorar!',
                    isEspecial: true
                },
                ...primeiroDia.atividades
            ];
        }
        
        // ✅ Ajustar último dia
        if (dias.length > 1) {
            const ultimoDia = dias[dias.length - 1];
            
            if (horaPartida <= 8) {
                // Partida muito cedo
                ultimoDia.atividades = [{
                    horario: '06:00',
                    local: 'Check-out e Transfer para Aeroporto',
                    tags: ['Partida', 'Voo Cedo'],
                    dica: 'Voo bem cedo - organize tudo na noite anterior!',
                    isEspecial: true
                }];
                ultimoDia.descricao = `Partida matinal de ${formData.destino} - prepare-se na véspera.`;
            } else if (horaPartida <= 12) {
                // Partida manhã
                ultimoDia.atividades = [
                    ...ultimoDia.atividades.filter(ativ => parseInt(ativ.horario.split(':')[0]) <= 9),
                    {
                        horario: this.calcularHorarioCheckout(horaPartida),
                        local: 'Check-out e Transfer para Aeroporto',
                        tags: ['Partida'],
                        dica: 'Chegue ao aeroporto com 2h de antecedência!',
                        isEspecial: true
                    }
                ];
            } else {
                // Partida tarde/noite - adicionar checkout no final
                ultimoDia.atividades.push({
                    horario: this.calcularHorarioCheckout(horaPartida),
                    local: 'Check-out e Transfer para Aeroporto',
                    tags: ['Partida'],
                    dica: 'Chegue ao aeroporto com 2h de antecedência!',
                    isEspecial: true
                });
            }
        }
        
        console.log(`✅ Atividades ajustadas para ${dias.length} dias`);
    }

    displayItinerary(roteiro) {
        const html = `
            <div class="result-header">
                <div class="tripinha-avatar">🐕</div>
                <h2>Seu Roteiro para ${roteiro.destino}</h2>
            </div>
            
            <div class="resumo-viagem">
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
                        <p class="valor">${this.formatarDataBrasil(roteiro.resumo.dataIda)} até ${this.formatarDataBrasil(roteiro.resumo.dataVolta)}</p>
                    </div>
                </div>
                
                <div class="resumo-item">
                    <div class="icone">✈️</div>
                    <div class="texto">
                        <div class="label">Voos:</div>
                        <p class="valor">Chegada ${roteiro.resumo.horarioChegada} | Partida ${roteiro.resumo.horarioPartida}</p>
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
            
            <div class="roteiro-content">
                ${roteiro.dias.map(dia => this.criarElementoDia(dia)).join('')}
            </div>
        `;
        
        this.resultContainer.innerHTML = html;
        this.resultContainer.classList.add('visible');
        
        // ✅ Configurar lazy loading para imagens inseridas
        this.configurarLazyLoadingParaElementos();
        
        // Scroll suave para o resultado
        setTimeout(() => {
            this.resultContainer.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 300);
    }

    // ✅ Configurar lazy loading para elementos já existentes
    configurarLazyLoadingParaElementos() {
        if (this.imageObserver) {
            const imagens = document.querySelectorAll('img[data-src]');
            imagens.forEach(img => {
                this.imageObserver.observe(img);
            });
            
            console.log(`🖼️ Lazy loading configurado para ${imagens.length} imagens`);
        }
    }

    criarElementoDia(dia) {
        return `
            <div class="dia-roteiro">
                <div class="dia-header">
                    <div class="dia-numero">${dia.numero}</div>
                    <span>Dia ${dia.numero} — ${dia.dataFormatada}</span>
                </div>
                
                <div class="dia-content">
                    <p class="dia-descricao">"${dia.descricao}"</p>
                    
                    <div class="atividades-lista">
                        ${dia.atividades.map(atividade => this.criarElementoAtividade(atividade)).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // ✅ CORRIGIDO: Criar elemento de atividade COM BOTÃO "VER NO MAPA"
    criarElementoAtividade(atividade) {
        return `
            <div class="atividade-item">
                <div class="atividade-horario">
                    <span>🕒</span>
                    <span>${atividade.horario}</span>
                </div>
                
                <div class="atividade-local">${atividade.local}</div>
                
                <div class="atividade-tags">
                    ${atividade.tags.map(tag => `
                        <span class="badge ${this.getClasseBadge(tag)}">${tag}</span>
                    `).join('')}
                </div>
                
                <div class="atividade-dica">
                    <span class="dica-icon">🐕</span>
                    <div class="dica-texto">
                        <strong>Dica da Tripinha:</strong> ${atividade.dica}
                    </div>
                </div>

                ${!atividade.isEspecial ? `
                    <button class="btn-ver-mapa" onclick="window.open('https://www.google.com/maps/search/${encodeURIComponent(atividade.local)}', '_blank')">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        Ver no mapa
                    </button>
                ` : ''}
                
                ${atividade.imagemUrl && !atividade.isEspecial ? `
                    <div class="atividade-imagem-responsiva">
                        <img 
                            ${this.imageObserver ? 'data-src' : 'src'}="${atividade.imagemUrl}" 
                            alt="${atividade.local}"
                            class="imagem-lazy"
                            loading="lazy"
                            style="opacity: 0; transition: opacity 0.3s ease;"
                        >
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ===== MÉTODOS AUXILIARES =====

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

    obterHorarioPorPeriodo(periodo) {
        const horarios = {
            'manha': '09:00',
            'tarde': '14:00',
            'noite': '19:00'
        };
        return horarios[periodo] || '12:00';
    }

    ajustarHorarioAposChegada(horarioOriginal, horaChegada) {
        const [hora] = horarioOriginal.split(':');
        const novaHora = Math.max(parseInt(hora), horaChegada + 2);
        return `${novaHora.toString().padStart(2, '0')}:00`;
    }

    calcularHorarioCheckout(horaPartida) {
        const horarioCheckout = Math.max(6, horaPartida - 3);
        return `${horarioCheckout.toString().padStart(2, '0')}:00`;
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

    formatarDataBrasil(dataStr) {
        const data = new Date(dataStr);
        return data.toLocaleDateString('pt-BR');
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
