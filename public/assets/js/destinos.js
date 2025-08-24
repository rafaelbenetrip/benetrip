// ============================================================================
// DESTINOS.JS - BENETRIP - VERSÃO OTIMIZADA COM SUPORTE A VIAGEM DE CARRO
// ============================================================================

/**
 * Gerenciador principal da tela de destinos da Benetrip
 * Funcionalidades: Exibição de destinos, seleção, integração com APIs, viagens de carro
 */
const BENETRIP_DESTINOS = {
    // Propriedades principais
    dadosUsuario: null,
    destinosData: [],
    tipoViagem: 'aereo', // aereo, rodoviario, carro
    
    // ========================================================================
    // INICIALIZAÇÃO E CONFIGURAÇÃO
    // ========================================================================
    
    /**
     * Inicializa a tela de destinos
     */
    async init() {
        console.log('🎯 Inicializando tela de destinos...');
        
        try {
            await this.carregarDadosUsuario();
            this.determinarTipoViagem();
            await this.carregarDestinos();
            this.renderizarTela();
            this.configurarEventListeners();
            
            console.log('✅ Tela de destinos inicializada com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            this.exibirErro('Erro ao carregar destinos. Tente novamente.');
        }
    },
    
    /**
     * Carrega dados do usuário salvos no localStorage
     */
    async carregarDadosUsuario() {
        const dados = localStorage.getItem('benetrip_dados_usuario');
        if (!dados) {
            console.error('❌ Dados do usuário não encontrados');
            window.location.href = 'index.html';
            return;
        }
        
        this.dadosUsuario = JSON.parse(dados);
        console.log('📊 Dados do usuário carregados:', this.dadosUsuario);
    },
    
    /**
     * Determina o tipo de viagem baseado nas respostas do usuário
     */
    determinarTipoViagem() {
        const tipoDestino = this.dadosUsuario?.respostas?.tipo_destino;
        const origem = this.dadosUsuario?.respostas?.cidade_partida?.name;
        
        // Lógica para determinar se é viagem de carro (nacional + próximo)
        if (tipoDestino === 0 && origem) { // Nacional
            // Aqui você pode adicionar lógica mais sofisticada para determinar se é carro
            // Por exemplo, baseado na distância ou preferências do usuário
            this.tipoViagem = 'carro'; // Para teste, assumindo carro para viagens nacionais
        } else if (tipoDestino === 0) {
            this.tipoViagem = 'rodoviario';
        } else {
            this.tipoViagem = 'aereo';
        }
        
        console.log('🚛 Tipo de viagem determinado:', this.tipoViagem);
    },
    
    // ========================================================================
    // CARREGAMENTO E PROCESSAMENTO DE DADOS
    // ========================================================================
    
    /**
     * Carrega destinos baseado no tipo de viagem
     */
    async carregarDestinos() {
        console.log('🌍 Carregando destinos...');
        
        switch (this.tipoViagem) {
            case 'carro':
                await this.carregarDestinosCarro();
                break;
            case 'rodoviario':
                await this.carregarDestinosRodoviarios();
                break;
            case 'aereo':
            default:
                await this.carregarDestinosAereos();
                break;
        }
        
        console.log(`📋 ${this.destinosData.length} destinos carregados`);
    },
    
    /**
     * Carrega destinos para viagem de carro
     */
    async carregarDestinosCarro() {
        // Dados simulados para viagens de carro - em produção, integraria com APIs de rota
        this.destinosData = [
            {
                destino: 'Campos do Jordão',
                pais: 'Brasil',
                codigoOrigem: 'SAO',
                codigoDestino: 'CJO',
                distanciaAproximada: '180 km',
                tempoEstimadoViagem: '2h 30min',
                preco: 'R$ 120',
                moeda: 'BRL',
                duracao: '4 dias',
                dataIda: '2025-08-15',
                dataVolta: '2025-08-18',
                imagemUrl: 'https://images.pexels.com/photos/1591373/pexels-photo-1591373.jpeg',
                tags: ['Montanha', 'Romântico', 'Natureza'],
                descricao: 'Destino perfeito para uma road trip relaxante nas montanhas.',
                motivo: 'Paisagens deslumbrantes e clima de montanha a poucos quilômetros de distância.',
                destaque: 'Uma viagem de carro perfeita para relaxar e aproveitar a natureza.',
                combustivelEstimado: 'R$ 80',
                pedagio: 'R$ 40',
                isDestaque: true
            },
            {
                destino: 'Gramado',
                pais: 'Brasil', 
                codigoOrigem: 'SAO',
                codigoDestino: 'GRA',
                distanciaAproximada: '950 km',
                tempoEstimadoViagem: '10h 30min',
                preco: 'R$ 480',
                moeda: 'BRL',
                duracao: '5 dias',
                dataIda: '2025-08-15',
                dataVolta: '2025-08-19',
                imagemUrl: 'https://images.pexels.com/photos/2901134/pexels-photo-2901134.jpeg',
                tags: ['Cultura', 'Gastronomia', 'Romântico'],
                descricao: 'Destino encantador para uma road trip gastronômica e cultural.',
                motivo: 'Arquitetura europeia e gastronomia única no sul do Brasil.',
                destaque: 'Road trip épica pelo interior do Brasil até a serra gaúcha.',
                combustivelEstimado: 'R$ 320',
                pedagio: 'R$ 160',
                isDestaque: false
            },
            {
                destino: 'Paraty',
                pais: 'Brasil',
                codigoOrigem: 'SAO', 
                codigoDestino: 'PAR',
                distanciaAproximada: '250 km',
                tempoEstimadoViagem: '3h 45min',
                preco: 'R$ 180',
                moeda: 'BRL',
                duracao: '4 dias',
                dataIda: '2025-08-15',
                dataVolta: '2025-08-18',
                imagemUrl: 'https://images.pexels.com/photos/2901134/pexels-photo-2901134.jpeg',
                tags: ['História', 'Praia', 'Cultura'],
                descricao: 'Cidade histórica com praias paradisíacas.',
                motivo: 'Centro histórico preservado e praias cristalinas a poucos quilômetros.',
                destaque: 'Combine história colonial com praias deslumbrantes.',
                combustivelEstimado: 'R$ 120',
                pedagio: 'R$ 60',
                isDestaque: false
            }
        ];
    },
    
    /**
     * Carrega destinos rodoviários (mantém funcionalidade existente)
     */
    async carregarDestinosRodoviarios() {
        // Implementação para destinos rodoviários (ônibus)
        this.destinosData = [
            // Dados dos destinos rodoviários...
        ];
    },
    
    /**
     * Carrega destinos aéreos (mantém funcionalidade existente)  
     */
    async carregarDestinosAereos() {
        // Simulação de dados aéreos - em produção integraria com APIs reais
        this.destinosData = [
            {
                destino: 'Lisboa',
                pais: 'Portugal',
                codigoOrigem: 'GRU',
                codigoDestino: 'LIS',
                preco: 'R$ 1.890',
                moeda: 'BRL',
                duracao: '5 dias',
                dataIda: '2025-08-15',
                dataVolta: '2025-08-19',
                imagemUrl: 'https://images.pexels.com/photos/2901134/pexels-photo-2901134.jpeg',
                tags: ['Cultura', 'História', 'Gastronomia'],
                descricao: 'Capital portuguesa cheia de história e charme.',
                motivo: 'Rica história, arquitetura única e gastronomia excepcional.',
                destaque: 'Uma das cidades mais charmosas da Europa.',
                isDestaque: true
            }
            // Mais destinos aéreos...
        ];
    },
    
    // ========================================================================
    // CONSTRUÇÃO DE URLs E LINKS
    // ========================================================================
    
    /**
     * Constrói URL do Google Maps para viagem de carro
     * @param {Object} destinoSelecionado - Objeto com dados do destino
     * @returns {string} URL do Google Maps
     */
    construirURLGoogleMaps(destinoSelecionado) {
        console.log('🚗 Construindo link do Google Maps...');
        
        const origem = this.dadosUsuario?.respostas?.cidade_partida?.name;
        const destino = `${destinoSelecionado.destino}, ${destinoSelecionado.pais}`;
        
        if (!origem) {
            console.error('Cidade de partida não encontrada para criar rota.');
            return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}`;
        }
        
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}&travelmode=driving`;
        console.log('✅ Link do Google Maps:', url);
        
        return url;
    },
    
    /**
     * Constrói URL para busca de voos (mantém funcionalidade existente)
     */
    construirURLVoos(destino) {
        const origem = this.dadosUsuario?.respostas?.cidade_partida?.iataCode || 'GRU';
        const destinoCode = destino.codigoDestino || 'JFK';
        const dataIda = destino.dataIda || '2025-08-15';
        const dataVolta = destino.dataVolta || '2025-08-20';
        const adultos = this.obterNumeroPassageiros();
        
        return `https://www.aviasales.com/?origin_iata=${origem}&destination_iata=${destinoCode}&departure_at=${dataIda}&return_at=${dataVolta}&adults=${adultos}&utm_source=benetrip&utm_medium=referral`;
    },
    
    /**
     * Constrói URL para DeÔnibus (mantém funcionalidade existente)
     */
    construirURLDeOnibus() {
        const origem = this.dadosUsuario?.respostas?.cidade_partida?.name || 'São Paulo';
        return `https://www.deonibus.com.br/?utm_source=benetrip&origem=${encodeURIComponent(origem)}`;
    },
    
    // ========================================================================
    // RENDERIZAÇÃO DA INTERFACE
    // ========================================================================
    
    /**
     * Renderiza a tela completa de destinos
     */
    renderizarTela() {
        console.log('🎨 Renderizando tela de destinos...');
        
        const container = document.querySelector('.destinos-container');
        if (!container) {
            console.error('❌ Container de destinos não encontrado');
            return;
        }
        
        const destaque = this.destinosData.find(d => d.isDestaque) || this.destinosData[0];
        const alternativos = this.destinosData.filter(d => !d.isDestaque).slice(0, 4);
        
        container.innerHTML = `
            ${this.renderizarCabecalho()}
            ${this.renderizarMensagemTripinha()}
            ${destaque ? this.renderizarDestinoDestaque(destaque) : ''}
            ${alternativos.length > 0 ? this.renderizarDestinosAlternativos(alternativos) : ''}
            ${this.renderizarBotoesPrincipais()}
        `;
    },
    
    /**
     * Renderiza o cabeçalho da tela
     */
    renderizarCabecalho() {
        const iconeTransporte = this.obterIconeTransporte();
        const tituloTransporte = this.obterTituloTransporte();
        
        return `
            <div class="text-center mb-4">
                <h1 class="text-xl font-bold text-gray-800 mb-2">
                    ${iconeTransporte} ${tituloTransporte}
                </h1>
                <div class="flex items-center justify-center space-x-2 text-sm text-gray-600">
                    <span>📍 ${this.dadosUsuario?.respostas?.cidade_partida?.name || 'Sua localização'}</span>
                    <span>•</span>
                    <span>📅 ${this.formatarDatas()}</span>
                </div>
            </div>
        `;
    },
    
    /**
     * Renderiza mensagem da Tripinha
     */
    renderizarMensagemTripinha() {
        const mensagem = this.obterMensagemTripinha();
        
        return `
            <div class="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
                <div class="flex items-start gap-3">
                    <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                        <img src="https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&dpr=1" 
                             alt="Tripinha" class="w-full h-full object-cover" />
                    </div>
                    <p class="text-gray-800 leading-relaxed">${mensagem}</p>
                </div>
            </div>
        `;
    },
    
    /**
     * Renderiza o destino em destaque
     */
    renderizarDestinoDestaque(destino) {
        const infoTransporte = this.renderizarInfoTransporte(destino);
        
        return `
            <div class="border border-gray-200 rounded-lg overflow-hidden shadow-md mb-6">
                <div class="relative">
                    <div class="absolute top-0 left-0 py-1 px-3 z-10 font-bold text-white bg-orange-500">
                        ⭐ Escolha Top da Tripinha!
                    </div>
                    <img src="${destino.imagemUrl}" 
                         alt="${destino.destino}" 
                         class="w-full h-48 object-cover" />
                </div>
                
                <div class="p-4">
                    <div class="flex justify-between items-start mb-3">
                        <h3 class="text-xl font-bold">${destino.destino}</h3>
                        <span class="text-xs font-medium px-2 py-1 rounded bg-gray-200">
                            ${destino.pais.substring(0, 3).toUpperCase()}
                        </span>
                    </div>
                    
                    ${infoTransporte}
                    
                    <div class="mt-3 space-y-2 text-sm">
                        <p class="flex items-start">
                            <span class="mr-2 w-5 text-center flex-shrink-0">🌆</span>
                            <span><strong>Por que ir?:</strong> ${destino.motivo}</span>
                        </p>
                        <p class="flex items-start">
                            <span class="mr-2 w-5 text-center flex-shrink-0">⭐</span>
                            <span><strong>Destaque:</strong> ${destino.destaque}</span>
                        </p>
                    </div>
                    
                    ${this.renderizarTags(destino.tags)}
                    
                    <button onclick="BENETRIP_DESTINOS.selecionarDestino('${destino.destino}')" 
                            class="w-full font-bold py-3 px-4 rounded mt-4 text-white transition-colors duration-200 hover:opacity-90 bg-orange-500">
                        ${this.obterTextoBotaoSelecao()}
                    </button>
                </div>
            </div>
        `;
    },
    
    /**
     * Renderiza destinos alternativos
     */
    renderizarDestinosAlternativos(destinos) {
        if (!destinos.length) return '';
        
        return `
            <div class="mb-6">
                <h3 class="font-bold text-lg mb-4">Mais Destinos Incríveis</h3>
                <div class="space-y-4">
                    ${destinos.map(destino => this.renderizarDestinoCompacto(destino)).join('')}
                </div>
            </div>
        `;
    },
    
    /**
     * Renderiza destino em formato compacto
     */
    renderizarDestinoCompacto(destino) {
        const infoTransporte = this.renderizarInfoTransporteCompacto(destino);
        
        return `
            <div class="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
                 onclick="BENETRIP_DESTINOS.selecionarDestino('${destino.destino}')">
                <div class="flex">
                    <div class="w-1/3">
                        <img src="${destino.imagemUrl}" 
                             alt="${destino.destino}" 
                             class="w-full h-24 object-cover" />
                    </div>
                    <div class="w-2/3 p-3">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-bold text-sm">${destino.destino}</h4>
                            <span class="text-xs font-medium px-1 py-0.5 rounded bg-gray-200">
                                ${destino.pais.substring(0, 3).toUpperCase()}
                            </span>
                        </div>
                        ${infoTransporte}
                        <p class="text-xs mt-2 text-gray-600 line-clamp-2">${destino.motivo}</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    // ========================================================================
    // RENDERIZAÇÃO DE COMPONENTES ESPECÍFICOS
    // ========================================================================
    
    /**
     * Renderiza informações de transporte baseado no tipo
     */
    renderizarInfoTransporte(destino) {
        const isCarro = this.tipoViagem === 'carro';
        const isRodoviario = this.tipoViagem === 'rodoviario';
        
        if (isCarro) {
            return `
                <div class="mt-2 bg-green-50 p-3 rounded-lg">
                    <div class="flex items-center mb-2">
                        <span class="text-lg mr-2">🚗</span>
                        <span class="font-medium">Informações da Road Trip</span>
                    </div>
                    ${destino.distanciaAproximada ? `<p class="text-sm"><strong>Distância:</strong> ${destino.distanciaAproximada}</p>` : ''}
                    ${destino.tempoEstimadoViagem ? `<p class="text-sm"><strong>Tempo de viagem:</strong> ${destino.tempoEstimadoViagem}</p>` : ''}
                    ${destino.combustivelEstimado ? `<p class="text-sm"><strong>Combustível estimado:</strong> ${destino.combustivelEstimado}</p>` : ''}
                    ${destino.pedagio ? `<p class="text-sm"><strong>Pedágios:</strong> ${destino.pedagio}</p>` : ''}
                    <p class="text-xs text-green-600 mt-2">✨ Ao escolher, você verá a rota no Google Maps</p>
                </div>
            `;
        } else if (isRodoviario) {
            return `
                <div class="mt-2 bg-blue-50 p-3 rounded-lg">
                    <div class="flex items-center mb-2">
                        <span class="text-lg mr-2">🚌</span>
                        <span class="font-medium">Viagem de Ônibus</span>
                    </div>
                    <p class="text-sm"><strong>A partir de:</strong> ${destino.preco}</p>
                    <p class="text-xs text-blue-600 mt-2">🚌 Conectamos você com nosso parceiro DeÔnibus</p>
                </div>
            `;
        } else {
            return `
                <div class="mt-2 bg-blue-50 p-3 rounded-lg">
                    <div class="flex items-center mb-2">
                        <span class="text-lg mr-2">✈️</span>
                        <span class="font-medium">Voo</span>
                    </div>
                    <p class="text-sm"><strong>Estimativa:</strong> ${destino.preco} (ida e volta)</p>
                    <p class="text-sm"><strong>Duração:</strong> ${destino.duracao}</p>
                    <p class="text-sm"><strong>Datas:</strong> ${this.formatarDatasDestino(destino)}</p>
                </div>
            `;
        }
    },
    
    /**
     * Renderiza informações de transporte em formato compacto
     */
    renderizarInfoTransporteCompacto(destino) {
        const isCarro = this.tipoViagem === 'carro';
        const isRodoviario = this.tipoViagem === 'rodoviario';
        
        if (isCarro) {
            return `
                <div class="text-xs space-y-1">
                    ${destino.distanciaAproximada ? `<p><span class="font-medium">🚗 Distância:</span> ${destino.distanciaAproximada}</p>` : ''}
                    ${destino.tempoEstimadoViagem ? `<p><span class="font-medium">⏱️ Tempo:</span> ${destino.tempoEstimadoViagem}</p>` : ''}
                    ${destino.combustivelEstimado ? `<p><span class="font-medium">⛽ Combustível:</span> ${destino.combustivelEstimado}</p>` : ''}
                </div>
            `;
        } else if (isRodoviario) {
            return `
                <div class="text-xs space-y-1">
                    <p><span class="font-medium">🚌 A partir de:</span> ${destino.preco}</p>
                </div>
            `;
        } else {
            return `
                <div class="text-xs space-y-1">
                    <p><span class="font-medium">✈️ Voo:</span> ${destino.preco}</p>
                    <p><span class="font-medium">📅 Duração:</span> ${destino.duracao}</p>
                </div>
            `;
        }
    },
    
    /**
     * Renderiza tags do destino
     */
    renderizarTags(tags) {
        if (!tags || !tags.length) return '';
        
        return `
            <div class="flex flex-wrap gap-2 mt-3">
                ${tags.map(tag => `
                    <span class="text-xs py-1 px-2 rounded-full bg-orange-100 text-orange-700">
                        ${tag}
                    </span>
                `).join('')}
            </div>
        `;
    },
    
    /**
     * Renderiza botões principais da tela
     */
    renderizarBotoesPrincipais() {
        return `
            <div class="space-y-3 mt-6">
                <button onclick="BENETRIP_DESTINOS.mostrarMaisOpcoes()" 
                        class="w-full font-medium py-3 px-4 rounded transition-colors duration-200 hover:bg-blue-200 bg-blue-100 text-blue-700">
                    Mostrar Mais Opções
                </button>
                
                <div class="p-4 rounded-lg mt-4 text-white bg-orange-500">
                    <p class="font-bold text-lg text-center mb-3">
                        Ainda não decidiu? Clique em 'Me Surpreenda!' e eu escolho um lugar baseado nas suas vibes! 🐾
                    </p>
                    <button onclick="BENETRIP_DESTINOS.destinoSurpresa()" 
                            class="w-full font-bold py-3 px-4 rounded transition-colors duration-200 hover:bg-blue-600 bg-blue-500">
                        Me Surpreenda! 🎲
                    </button>
                </div>
            </div>
        `;
    },
    
    // ========================================================================
    // INTERAÇÕES E SELEÇÕES
    // ========================================================================
    
    /**
     * Seleciona um destino específico
     */
    selecionarDestino(nomeDestino) {
        console.log(`🎯 Selecionando destino: ${nomeDestino}`);
        
        const destino = this.destinosData.find(d => d.destino === nomeDestino);
        if (!destino) {
            console.error('❌ Destino não encontrado:', nomeDestino);
            this.exibirToast('Destino não encontrado', 'error');
            return;
        }
        
        // Padronizar dados do destino
        const destinoPadronizado = this.padronizarDestino(destino);
        
        // Salvar destino selecionado
        localStorage.setItem('benetrip_destino_selecionado', JSON.stringify(destinoPadronizado));
        
        // Atualizar dados do usuário
        this.dadosUsuario.destinoSelecionado = destinoPadronizado;
        localStorage.setItem('benetrip_dados_usuario', JSON.stringify(this.dadosUsuario));
        
        // Mostrar confirmação
        this.mostrarConfirmacaoSelecao(destinoPadronizado);
    },
    
    /**
     * Mostra modal de confirmação da seleção
     */
    mostrarConfirmacaoSelecao(destino) {
        console.log('📋 Mostrando confirmação de seleção...');
        
        const isCarro = this.tipoViagem === 'carro';
        const isRodoviario = this.tipoViagem === 'rodoviario';
        const iconeTransporte = isCarro ? '🚗' : (isRodoviario ? '🚌' : '✈️');
        const tituloTransporte = isCarro ? 'Road Trip' : (isRodoviario ? 'Viagem de Ônibus' : 'Voo');
        
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-lg max-w-md w-full p-6 max-h-96 overflow-y-auto">
                <div class="text-center mb-4">
                    <div class="w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden">
                        <img src="https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg" 
                             alt="Tripinha" class="w-full h-full object-cover" />
                    </div>
                    <h3 class="text-lg font-bold text-gray-800 mb-2">
                        ${iconeTransporte} Confirme sua ${tituloTransporte.toLowerCase()}!
                    </h3>
                </div>
                
                <div class="bg-orange-50 p-4 rounded-lg mb-4">
                    <h4 class="font-bold text-orange-800 mb-2">${destino.destino}, ${destino.pais}</h4>
                    ${this.renderizarResumoDestino(destino)}
                </div>
                
                <div class="bg-orange-50 p-4 rounded-lg mb-4">
                    <div class="flex items-start gap-2">
                        <span class="text-lg">🐕</span>
                        <div>
                            <p class="font-bold text-orange-800">Ótima escolha, Triper! 🐾</p>
                            <p class="text-sm text-gray-700 mt-1">
                                ${isCarro ? 'Preparando sua rota no Google Maps...' : 
                                  isRodoviario ? 'Conectando você com nosso parceiro DeÔnibus...' : 
                                  'Buscando as melhores ofertas de voos...'}
                            </p>
                            <label class="flex items-center space-x-2 cursor-pointer mt-3">
                                <input type="checkbox" class="form-checkbox h-4 w-4 text-orange-500" required />
                                <span class="text-sm">Confirmo que este é meu destino escolhido!</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="flex space-x-3">
                    <button class="flex-1 py-2 px-4 border border-gray-300 rounded hover:bg-gray-50 transition-colors" 
                            onclick="this.closest('.fixed').remove()">
                        Voltar
                    </button>
                    <button class="flex-1 py-2 px-4 bg-orange-500 text-white rounded hover:opacity-90 transition-opacity font-bold" 
                            id="btnConfirmarDestino">
                        ${isCarro ? 'Ver Rota 🚗' : (isRodoviario ? 'Buscar Ônibus 🚌' : 'Buscar Voos ✈️')}
                    </button>
                </div>
            </div>
        `;
        
        // Event listener para confirmação
        const btnConfirmar = modal.querySelector('#btnConfirmarDestino');
        const checkbox = modal.querySelector('input[type="checkbox"]');
        
        btnConfirmar.addEventListener('click', () => {
            if (!checkbox.checked) {
                this.exibirToast('Por favor, confirme sua escolha marcando a caixinha!', 'warning');
                return;
            }
            
            const isCarro = this.tipoViagem === 'carro';
            const isRodoviario = this.tipoViagem === 'rodoviario';
            console.log(`🚀 Redirecionando para ${isCarro ? 'Google Maps' : (isRodoviario ? 'DeÔnibus' : 'voos')}...`);
            
            try {
                let url;
                if (isCarro) {
                    url = this.construirURLGoogleMaps(destino);
                    this.exibirToast('Abrindo rota no Google Maps...', 'info');
                } else if (isRodoviario) {
                    url = this.construirURLDeOnibus();
                    this.exibirToast('Redirecionando para nosso parceiro DeÔnibus...', 'info');
                } else {
                    url = this.construirURLVoos(destino);
                    this.exibirToast('Redirecionando para busca de voos...', 'info');
                }
                
                console.log('🔗 URL construída:', url);
                
                // Salvar no histórico
                this.salvarNoHistorico(destino, url);
                
                // Fechar modal
                modal.remove();
                
                // Redirecionar após pequeno delay
                setTimeout(() => {
                    window.open(url, '_blank');
                }, 500);
                
            } catch (error) {
                console.error('❌ Erro no redirecionamento:', error);
                this.exibirToast('Erro ao processar solicitação. Tente novamente.', 'error');
            }
        });
        
        document.body.appendChild(modal);
    },
    
    // ========================================================================
    // FUNCIONALIDADES AUXILIARES
    // ========================================================================
    
    /**
     * Renderiza resumo do destino para confirmação
     */
    renderizarResumoDestino(destino) {
        const isCarro = this.tipoViagem === 'carro';
        const isRodoviario = this.tipoViagem === 'rodoviario';
        
        if (isCarro) {
            return `
                <div class="text-sm space-y-1">
                    ${destino.distanciaAproximada ? `<p><strong>📏 Distância:</strong> ${destino.distanciaAproximada}</p>` : ''}
                    ${destino.tempoEstimadoViagem ? `<p><strong>⏱️ Tempo estimado:</strong> ${destino.tempoEstimadoViagem}</p>` : ''}
                    ${destino.combustivelEstimado ? `<p><strong>⛽ Combustível:</strong> ${destino.combustivelEstimado}</p>` : ''}
                    ${destino.pedagio ? `<p><strong>🛣️ Pedágios:</strong> ${destino.pedagio}</p>` : ''}
                </div>
            `;
        } else if (isRodoviario) {
            return `
                <div class="text-sm space-y-1">
                    <p><strong>🚌 Preço estimado:</strong> ${destino.preco}</p>
                    <p><strong>📅 Duração:</strong> ${destino.duracao}</p>
                </div>
            `;
        } else {
            return `
                <div class="text-sm space-y-1">
                    <p><strong>✈️ Preço estimado:</strong> ${destino.preco} (ida e volta)</p>
                    <p><strong>📅 Duração:</strong> ${destino.duracao}</p>
                    <p><strong>🗓️ Datas:</strong> ${this.formatarDatasDestino(destino)}</p>
                </div>
            `;
        }
    },
    
    /**
     * Obtém ícone do transporte baseado no tipo
     */
    obterIconeTransporte() {
        switch (this.tipoViagem) {
            case 'carro': return '🚗';
            case 'rodoviario': return '🚌';
            case 'aereo': 
            default: return '✈️';
        }
    },
    
    /**
     * Obtém título do transporte
     */
    obterTituloTransporte() {
        switch (this.tipoViagem) {
            case 'carro': return 'Destinos para Road Trip';
            case 'rodoviario': return 'Destinos de Ônibus';
            case 'aereo':
            default: return 'Destinos de Voo';
        }
    },
    
    /**
     * Obtém mensagem personalizada da Tripinha
     */
    obterMensagemTripinha() {
        switch (this.tipoViagem) {
            case 'carro':
                return `Que tal uma road trip incrível? 🚗✨ Farejei alguns destinos perfeitos para você explorar no seu próprio ritmo! Cada quilômetro será uma nova aventura. Preparei rotas seguras e destinos que vão fazer sua viagem ser inesquecível! 🐾`;
            case 'rodoviario':
                return `Encontrei destinos incríveis para você viajar de ônibus! 🚌 Que tal relaxar durante a viagem e aproveitar cada paisagem pelo caminho? Nosso parceiro DeÔnibus tem as melhores opções para sua aventura! 🐾`;
            case 'aereo':
            default:
                return `Eu farejei por aí e encontrei alguns destinos incríveis para sua aventura! 🐾 Veja minha escolha top — e mais algumas opções se você quiser explorar! Se estiver com vontade de se arriscar, clica em 'Me Surpreenda!' e eu escolho uma joia escondida pra você! 🐕 ✨`;
        }
    },
    
    /**
     * Obtém texto do botão de seleção
     */
    obterTextoBotaoSelecao() {
        switch (this.tipoViagem) {
            case 'carro': return 'Iniciar Road Trip! 🚗';
            case 'rodoviario': return 'Viajar de Ônibus! 🚌';
            case 'aereo':
            default: return 'Escolher Este Destino! ✈️';
        }
    },
    
    /**
     * Padroniza dados do destino
     */
    padronizarDestino(destino) {
        return {
            ...destino,
            dataSelecao: new Date().toISOString(),
            tipoViagem: this.tipoViagem
        };
    },
    
    /**
     * Formata datas para exibição
     */
    formatarDatas() {
        const datas = this.dadosUsuario?.respostas?.datas;
        if (!datas || !datas.dataIda || !datas.dataVolta) return 'Datas flexíveis';
        
        const ida = new Date(datas.dataIda).toLocaleDateString('pt-BR');
        const volta = new Date(datas.dataVolta).toLocaleDateString('pt-BR');
        return `${ida} até ${volta}`;
    },
    
    /**
     * Formata datas específicas do destino
     */
    formatarDatasDestino(destino) {
        if (!destino.dataIda || !destino.dataVolta) return 'Datas flexíveis';
        
        const ida = new Date(destino.dataIda).toLocaleDateString('pt-BR');
        const volta = new Date(destino.dataVolta).toLocaleDateString('pt-BR');
        return `${ida} até ${volta}`;
    },
    
    /**
     * Obtém número de passageiros
     */
    obterNumeroPassageiros() {
        const companhia = this.dadosUsuario?.respostas?.companhia;
        const quantidadeFamilia = this.dadosUsuario?.respostas?.quantidade_familia;
        const quantidadeAmigos = this.dadosUsuario?.respostas?.quantidade_amigos;
        
        if (companhia === 2 && quantidadeFamilia) return quantidadeFamilia;
        if (companhia === 3 && quantidadeAmigos) return quantidadeAmigos;
        if (companhia === 1) return 2; // Romântico
        return 1; // Solo
    },
    
    /**
     * Salva no histórico do usuário
     */
    salvarNoHistorico(destino, url) {
        const historico = JSON.parse(localStorage.getItem('benetrip_historico') || '[]');
        historico.unshift({
            destino: destino.destino,
            pais: destino.pais,
            tipoViagem: this.tipoViagem,
            url: url,
            timestamp: Date.now()
        });
        
        // Manter apenas os últimos 10 registros
        localStorage.setItem('benetrip_historico', JSON.stringify(historico.slice(0, 10)));
    },
    
    // ========================================================================
    // FUNCIONALIDADES ADICIONAIS
    // ========================================================================
    
    /**
     * Mostra mais opções de destinos
     */
    mostrarMaisOpcoes() {
        console.log('📋 Mostrando mais opções...');
        this.exibirToast('Carregando mais destinos...', 'info');
        
        // Aqui você pode implementar lógica para carregar mais destinos
        // Por exemplo, fazer nova chamada para API ou mostrar destinos ocultos
        setTimeout(() => {
            this.exibirToast('Mais opções em breve! 🚀', 'info');
        }, 1000);
    },
    
    /**
     * Seleciona um destino surpresa
     */
    destinoSurpresa() {
        console.log('🎲 Selecionando destino surpresa...');
        
        // Seleciona um destino aleatório que não seja o destaque
        const destinosDisponiveis = this.destinosData.filter(d => !d.isDestaque);
        if (destinosDisponiveis.length === 0) {
            this.exibirToast('Ops! Não há destinos surpresa disponíveis no momento.', 'warning');
            return;
        }
        
        const indiceAleatorio = Math.floor(Math.random() * destinosDisponiveis.length);
        const destinoSurpresa = destinosDisponiveis[indiceAleatorio];
        
        this.exibirToast('🎁 Preparando sua surpresa...', 'info');
        
        setTimeout(() => {
            this.selecionarDestino(destinoSurpresa.destino);
        }, 1500);
    },
    
    /**
     * Configura event listeners globais
     */
    configurarEventListeners() {
        // Listener para voltar à tela anterior
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modals = document.querySelectorAll('.fixed.inset-0');
                if (modals.length > 0) {
                    modals[modals.length - 1].remove();
                }
            }
        });
        
        // Listener para cliques fora do modal
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('bg-black') && e.target.classList.contains('bg-opacity-50')) {
                e.target.remove();
            }
        });
    },
    
    // ========================================================================
    // UTILITÁRIOS E HELPERS
    // ========================================================================
    
    /**
     * Exibe toast de notificação
     */
    exibirToast(mensagem, tipo = 'info') {
        const cores = {
            info: 'bg-blue-500',
            success: 'bg-green-500', 
            warning: 'bg-yellow-500',
            error: 'bg-red-500'
        };
        
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 ${cores[tipo]} text-white px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full`;
        toast.textContent = mensagem;
        
        document.body.appendChild(toast);
        
        // Animação de entrada
        setTimeout(() => toast.classList.remove('translate-x-full'), 100);
        
        // Remoção automática
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    /**
     * Exibe erro genérico
     */
    exibirErro(mensagem) {
        console.error('❌ Erro:', mensagem);
        this.exibirToast(mensagem, 'error');
        
        // Opcional: redirecionar para tela inicial em caso de erro crítico
        setTimeout(() => {
            if (mensagem.includes('carregar destinos')) {
                window.location.href = 'index.html';
            }
        }, 5000);
    }
};

// ============================================================================
// INICIALIZAÇÃO AUTOMÁTICA
// ============================================================================

/**
 * Inicialização automática quando o DOM estiver pronto
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM carregado, inicializando Benetrip Destinos...');
    BENETRIP_DESTINOS.init();
});

// ============================================================================
// EXPORTAÇÃO GLOBAL
// ============================================================================

// Expor globalmente para compatibilidade
window.BENETRIP_DESTINOS = BENETRIP_DESTINOS;
