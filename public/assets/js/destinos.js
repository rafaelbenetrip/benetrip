/**
 * BENETRIP - SISTEMA DE DESTINOS OTIMIZADO
 * Versão com suporte completo a viagens de carro, ônibus e avião
 * Integração com Google Maps, APIs de voo e sistema de recomendações
 */

const BENETRIP_DESTINOS = {
    // Configurações e constantes
    config: {
        // Cores da identidade visual Benetrip
        cores: {
            primary: '#E87722',    // Laranja Vibrante
            secondary: '#00A3E0',  // Azul Sereno
            white: '#FFFFFF',      // Branco Neutro
            dark: '#21272A',       // Cinza Escuro
            lightGray: '#F5F5F5',
            mediumGray: '#E0E0E0'
        },
        // URLs das APIs
        apis: {
            aviasalesAutocomplete: 'https://autocomplete.travelpayouts.com/places2',
            aviasalesFlightSearch: 'https://api.travelpayouts.com/v1/flight_search',
            pixabay: 'https://pixabay.com/api/',
            amadeus: 'https://test.api.amadeus.com/v2/shopping/flight-offers'
        },
        // Configurações de exibição
        maxDestinosExibidos: 6,
        toastDuration: 3000
    },

    // Estado da aplicação
    state: {
        dadosUsuario: null,
        destinosCarregados: [],
        tipoViagem: null,
        carregando: false,
        destinoSelecionado: null
    },

    /**
     * INICIALIZAÇÃO DO SISTEMA
     */
    async inicializar() {
        console.log('🚀 Iniciando sistema de destinos Benetrip...');
        
        try {
            this.carregarDadosUsuario();
            this.determinarTipoViagem();
            await this.carregarDestinos();
            this.configurarEventListeners();
            this.exibirInterface();
            
            console.log('✅ Sistema inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            this.exibirErro('Ops! Algo deu errado. Tente novamente.');
        }
    },

    /**
     * CARREGAMENTO E PROCESSAMENTO DE DADOS
     */
    carregarDadosUsuario() {
        const dadosString = localStorage.getItem('benetrip_dados_usuario');
        this.state.dadosUsuario = dadosString ? JSON.parse(dadosString) : null;
        
        if (!this.state.dadosUsuario) {
            console.warn('⚠️ Dados do usuário não encontrados');
            // Redirecionar para o chat se necessário
            window.location.href = 'index.html';
            return;
        }
        
        console.log('📊 Dados do usuário carregados:', this.state.dadosUsuario);
    },

    /**
     * Determina o tipo de viagem com base nas preferências do usuário
     */
    determinarTipoViagem() {
        const respostas = this.state.dadosUsuario?.respostas || {};
        
        // Verifica se há preferência explícita por tipo de destino
        const tipoDestino = respostas.tipo_destino?.value;
        const destinoImaginado = respostas.destino_imaginado?.value;
        
        // Lógica para determinar tipo de viagem
        if (tipoDestino === 0) { // Destinos nacionais
            // Para destinos nacionais, priorizar carro para destinos próximos
            this.state.tipoViagem = 'carro';
        } else if (tipoDestino === 1) { // Destinos internacionais
            this.state.tipoViagem = 'aviao';
        } else {
            // Determinar com base em outras preferências
            if (destinoImaginado === 0 || destinoImaginado === 1) { // Praia ou natureza
                this.state.tipoViagem = Math.random() > 0.6 ? 'carro' : 'aviao';
            } else {
                this.state.tipoViagem = 'aviao';
            }
        }
        
        console.log(`🎯 Tipo de viagem determinado: ${this.state.tipoViagem}`);
    },

    /**
     * Carrega destinos baseados no perfil do usuário
     */
    async carregarDestinos() {
        this.state.carregando = true;
        this.mostrarCarregamento();
        
        try {
            // Simular carregamento para UX
            await this.delay(1500);
            
            const destinos = await this.gerarDestinosPersonalizados();
            this.state.destinosCarregados = destinos;
            
            console.log(`✅ ${destinos.length} destinos carregados`);
        } catch (error) {
            console.error('❌ Erro ao carregar destinos:', error);
            this.exibirErro('Não conseguimos carregar os destinos. Tente novamente.');
        } finally {
            this.state.carregando = false;
            this.ocultarCarregamento();
        }
    },

    /**
     * Gera destinos personalizados com base no perfil do usuário
     */
    async gerarDestinosPersonalizados() {
        const respostas = this.state.dadosUsuario?.respostas || {};
        const tipoViagem = this.state.tipoViagem;
        
        let destinos = [];
        
        if (tipoViagem === 'carro') {
            destinos = this.obterDestinosCarro(respostas);
        } else if (tipoViagem === 'rodoviario') {
            destinos = this.obterDestinosRodoviarios(respostas);
        } else {
            destinos = this.obterDestinosAereos(respostas);
        }
        
        // Enriquecer com imagens
        for (let destino of destinos) {
            try {
                destino.imagem = await this.buscarImagemDestino(destino.destino);
            } catch (error) {
                console.warn(`⚠️ Não foi possível carregar imagem para ${destino.destino}`);
                destino.imagem = '/api/placeholder/300/200';
            }
        }
        
        return destinos;
    },

    /**
     * Obtém destinos para viagens de carro
     */
    obterDestinosCarro(respostas) {
        const destinosBase = [
            {
                destino: 'Campos do Jordão',
                pais: 'Brasil',
                estado: 'São Paulo',
                descricao: 'Charme europeu na serra paulista com clima frio e arquitetura única.',
                precoEstimado: 'R$ 400-800',
                moeda: 'BRL',
                distanciaAproximada: '180km de SP',
                tempoEstimadoViagem: '2h30min',
                tipoDestino: 'nacional',
                categoria: ['natureza', 'romance', 'familia'],
                destaque: 'Vila com clima de montanha e deliciosos fondues!'
            },
            {
                destino: 'Paraty',
                pais: 'Brasil',
                estado: 'Rio de Janeiro',
                descricao: 'Centro histórico preservado entre montanhas e mar cristalino.',
                precoEstimado: 'R$ 600-1200',
                moeda: 'BRL',
                distanciaAproximada: '250km do RJ',
                tempoEstimadoViagem: '3h',
                tipoDestino: 'nacional',
                categoria: ['praia', 'cultura', 'historia'],
                destaque: 'Casarões coloniais e praias paradisíacas numa só viagem!'
            },
            {
                destino: 'Gramado',
                pais: 'Brasil',
                estado: 'Rio Grande do Sul',
                descricao: 'Destino romântico famoso pelo Natal Luz e culinária alemã.',
                precoEstimado: 'R$ 800-1500',
                moeda: 'BRL',
                distanciaAproximada: '115km de Porto Alegre',
                tempoEstimadoViagem: '1h45min',
                tipoDestino: 'nacional',
                categoria: ['romance', 'familia', 'cultura'],
                destaque: 'Magia natalina o ano todo e chocolates artesanais irresistíveis!'
            },
            {
                destino: 'Bonito',
                pais: 'Brasil',
                estado: 'Mato Grosso do Sul',
                descricao: 'Ecoturismo de classe mundial com águas cristalinas e cavernas.',
                precoEstimado: 'R$ 1000-2000',
                moeda: 'BRL',
                distanciaAproximada: '300km de Campo Grande',
                tempoEstimadoViagem: '4h',
                tipoDestino: 'nacional',
                categoria: ['natureza', 'aventura', 'familia'],
                destaque: 'Flutuação em rios de água cristalina - experiência única no mundo!'
            },
            {
                destino: 'Serra da Canastra',
                pais: 'Brasil',
                estado: 'Minas Gerais',
                descricao: 'Cachoeiras impressionantes e o famoso queijo canastra.',
                precoEstimado: 'R$ 500-900',
                moeda: 'BRL',
                distanciaAproximada: '350km de BH',
                tempoEstimadoViagem: '4h30min',
                tipoDestino: 'nacional',
                categoria: ['natureza', 'aventura', 'gastronomia'],
                destaque: 'Cachoeira Casca d\'Anta e o autêntico queijo canastra!'
            }
        ];
        
        return this.filtrarDestinos(destinosBase, respostas);
    },

    /**
     * Obtém destinos para viagens rodoviárias
     */
    obterDestinosRodoviarios(respostas) {
        const destinosBase = [
            {
                destino: 'Florianópolis',
                pais: 'Brasil',
                estado: 'Santa Catarina',
                descricao: 'Ilha da Magia com mais de 40 praias e vida noturna agitada.',
                precoEstimado: 'R$ 800-1500',
                precoTransporte: 'R$ 180-320',
                tempoViagem: '12h de SP',
                tipoDestino: 'nacional',
                categoria: ['praia', 'festa', 'natureza']
            },
            {
                destino: 'Salvador',
                pais: 'Brasil',
                estado: 'Bahia',
                descricao: 'Centro histórico colonial e praias paradisíacas.',
                precoEstimado: 'R$ 700-1300',
                precoTransporte: 'R$ 450-680',
                tempoViagem: '24h de SP',
                tipoDestino: 'nacional',
                categoria: ['cultura', 'praia', 'historia']
            }
        ];
        
        return this.filtrarDestinos(destinosBase, respostas);
    },

    /**
     * Obtém destinos para viagens aéreas
     */
    obterDestinosAereos(respostas) {
        const destinosBase = [
            {
                destino: 'Lisboa',
                pais: 'Portugal',
                descricao: 'Charme europeu com história, fado e pastéis de nata.',
                precoEstimado: 'R$ 2500-4000',
                precoVoo: 'R$ 1800-2800',
                tipoDestino: 'internacional',
                categoria: ['cultura', 'historia', 'gastronomia'],
                destaque: 'Europa acessível com a hospitalidade portuguesa!'
            },
            {
                destino: 'Buenos Aires',
                pais: 'Argentina',
                descricao: 'Paris sul-americana com tango, carne e vida noturna intensa.',
                precoEstimado: 'R$ 2000-3500',
                precoVoo: 'R$ 1200-2200',
                tipoDestino: 'internacional',
                categoria: ['cultura', 'festa', 'gastronomia'],
                destaque: 'Tango, bife de chorizo e arquitetura europeia!'
            },
            {
                destino: 'Montevidéu',
                pais: 'Uruguai',
                descricao: 'Tranquilidade costeira com charme e cultura rica.',
                precoEstimado: 'R$ 1800-3000',
                precoVoo: 'R$ 1000-1800',
                tipoDestino: 'internacional',
                categoria: ['cultura', 'praia', 'tranquilo'],
                destaque: 'Destino charmoso e acessível na América do Sul!'
            }
        ];
        
        return this.filtrarDestinos(destinosBase, respostas);
    },

    /**
     * Filtra destinos baseado nas preferências do usuário
     */
    filtrarDestinos(destinos, respostas) {
        const destinoImaginado = respostas.destino_imaginado?.value;
        const tipoViagem = respostas.tipo_viagem?.value;
        const itemEssencial = respostas.item_essencial?.value;
        
        // Aplicar filtros baseados nas respostas
        let destinosFiltrados = destinos.slice();
        
        // Filtro por tipo de destino imaginado
        if (destinoImaginado === 0) { // Praia
            destinosFiltrados = destinosFiltrados.filter(d => 
                d.categoria?.includes('praia')
            );
        } else if (destinoImaginado === 1) { // Natureza
            destinosFiltrados = destinosFiltrados.filter(d => 
                d.categoria?.includes('natureza') || d.categoria?.includes('aventura')
            );
        } else if (destinoImaginado === 2) { // Urbano
            destinosFiltrados = destinosFiltrados.filter(d => 
                d.categoria?.includes('cultura') || d.categoria?.includes('festa')
            );
        }
        
        // Se filtrou muito, voltar com todos
        if (destinosFiltrados.length < 3) {
            destinosFiltrados = destinos;
        }
        
        // Embaralhar e limitar
        return this.embaralharArray(destinosFiltrados)
            .slice(0, this.config.maxDestinosExibidos);
    },

    /**
     * FUNÇÕES DE URL E INTEGRAÇÃO
     */

    /**
     * Constrói URL do Google Maps para rota de carro
     */
    construirURLGoogleMaps(destinoSelecionado) {
        console.log('🚗 Construindo link do Google Maps...');
        
        const origem = this.state.dadosUsuario?.respostas?.cidade_partida?.name || 
                      this.state.dadosUsuario?.respostas?.cidade_partida;
        const destino = `${destinoSelecionado.destino}, ${destinoSelecionado.estado || destinoSelecionado.pais}`;
        
        if (!origem) {
            console.error('❌ Cidade de partida não encontrada para criar rota.');
            return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}`;
        }
        
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}&travelmode=driving`;
        
        console.log('✅ Link do Google Maps gerado:', url);
        return url;
    },

    /**
     * Constrói URL para busca de ônibus
     */
    construirURLDeOnibus() {
        const origem = this.state.dadosUsuario?.respostas?.cidade_partida?.name || 'São Paulo';
        const destino = this.state.destinoSelecionado?.destino || '';
        
        // URL do parceiro de ônibus (exemplo)
        return `https://www.clickbus.com.br/onibus/passagem-${origem.toLowerCase()}-${destino.toLowerCase()}`;
    },

    /**
     * Constrói URL para busca de voos
     */
    construirURLVoos(destino) {
        const origem = this.state.dadosUsuario?.respostas?.cidade_partida?.iata || 'SAO';
        const dataIda = this.state.dadosUsuario?.respostas?.datas?.ida || '2025-08-15';
        const dataVolta = this.state.dadosUsuario?.respostas?.datas?.volta || '2025-08-22';
        const adultos = this.state.dadosUsuario?.respostas?.quantidade_familia || 1;
        
        // URL do parceiro de voos (Aviasales/Jetradar)
        const params = new URLSearchParams({
            origin_iata: origem,
            destination_name: destino.destino,
            depart_date: dataIda,
            return_date: dataVolta,
            adults: adultos,
            currency: 'BRL'
        });
        
        return `https://www.jetradar.com.br/flights/${origem}?${params.toString()}`;
    },

    /**
     * FUNÇÕES DE INTERFACE
     */

    /**
     * Exibe a interface principal de destinos
     */
    exibirInterface() {
        const container = document.getElementById('destinos-container');
        if (!container) {
            console.error('❌ Container de destinos não encontrado');
            return;
        }
        
        container.innerHTML = this.gerarHTMLInterface();
        this.configurarEventListenersInterface();
    },

    /**
     * Gera HTML da interface principal
     */
    gerarHTMLInterface() {
        const destinos = this.state.destinosCarregados;
        const tipoViagem = this.state.tipoViagem;
        
        return `
            <!-- Cabeçalho -->
            ${this.gerarHTMLCabecalho()}
            
            <!-- Mensagem da Tripinha -->
            ${this.gerarHTMLMensagemTripinha(tipoViagem)}
            
            <!-- Destino em Destaque -->
            ${destinos.length > 0 ? this.renderizarDestinoDestaque(destinos[0]) : ''}
            
            <!-- Outros Destinos -->
            ${destinos.length > 1 ? this.renderizarDestinosAlternativos(destinos.slice(1)) : ''}
            
            <!-- Botão Me Surpreenda -->
            ${this.gerarHTMLBotaoSurpresa()}
            
            <!-- Loading Overlay -->
            <div id="loading-overlay" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg p-6 text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p class="text-gray-700">Carregando destinos incríveis...</p>
                </div>
            </div>
        `;
    },

    /**
     * Gera HTML do cabeçalho
     */
    gerarHTMLCabecalho() {
        return `
            <div class="bg-white shadow-sm sticky top-0 z-10">
                <div class="max-w-md mx-auto flex items-center p-3">
                    <button id="btn-voltar" class="mr-3 p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                        </svg>
                    </button>
                    <h1 class="text-xl font-bold text-gray-800 flex-1 text-center">Destinos Personalizados</h1>
                    <div class="w-10"></div> <!-- Spacer -->
                </div>
            </div>
        `;
    },

    /**
     * Gera mensagem personalizada da Tripinha
     */
    gerarHTMLMensagemTripinha(tipoViagem) {
        let mensagem = '';
        let emoji = '🐕';
        
        switch(tipoViagem) {
            case 'carro':
                mensagem = 'Eu farejei destinos incríveis para sua road trip! 🚗 Lugares que você pode chegar dirigindo e curtir cada quilômetro da jornada! Se estiver com vontade de se arriscar, clica em "Me Surpreenda!" 🐾 ✨';
                emoji = '🚗';
                break;
            case 'rodoviario':
                mensagem = 'Encontrei destinos perfeitos para uma viagem de ônibus confortável! 🚌 Relaxe e aproveite a paisagem enquanto chega ao seu destino dos sonhos! 🐾 ✨';
                emoji = '🚌';
                break;
            default:
                mensagem = 'Eu farejei por aí e encontrei alguns destinos incríveis para sua aventura! 🐾 Veja minha escolha top — e mais algumas opções se você quiser explorar! Se estiver com vontade de se arriscar, clica em "Me Surpreenda!" 🐕 ✨';
                emoji = '✈️';
        }
        
        return `
            <div class="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 mx-4 mt-4">
                <div class="flex items-start gap-3">
                    <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                        <img src="/api/placeholder/60/60" alt="Tripinha" class="w-full h-full object-cover" />
                    </div>
                    <p class="text-gray-800 leading-relaxed">
                        <span class="text-2xl mr-2">${emoji}</span>
                        ${mensagem}
                    </p>
                </div>
            </div>
        `;
    },

    /**
     * Renderiza o destino em destaque
     */
    renderizarDestinoDestaque(destino) {
        return `
            <div class="mx-4 mt-4">
                <div class="border border-gray-200 rounded-lg overflow-hidden shadow-md">
                    <div class="relative">
                        <div class="absolute top-0 left-0 py-1 px-3 z-10 font-bold text-white" 
                             style="background-color: ${this.config.cores.primary}">
                            🌟 Escolha Top da Tripinha!
                        </div>
                        <img src="${destino.imagem}" alt="${destino.destino}" 
                             class="w-full h-48 object-cover" />
                    </div>
                    
                    <div class="p-4">
                        <div class="flex justify-between items-start mb-3">
                            <h3 class="text-xl font-bold">${destino.destino}</h3>
                            <span class="text-xs font-medium px-2 py-1 rounded bg-gray-200">
                                ${destino.estado || destino.pais}
                            </span>
                        </div>
                        
                        <p class="text-sm text-gray-600 mb-3">${destino.descricao}</p>
                        
                        ${this.renderizarInfoTransporte(destino)}
                        
                        ${destino.destaque ? `
                            <div class="mt-3 text-sm italic p-3 rounded" 
                                 style="background-color: rgba(0, 163, 224, 0.1)">
                                <p class="flex items-start">
                                    <span class="mr-2 flex-shrink-0">💬</span>
                                    <span>"${destino.destaque}"</span>
                                </p>
                            </div>
                        ` : ''}
                        
                        <button class="btn-selecionar w-full font-bold py-2.5 px-4 rounded mt-4 text-white transition-colors duration-200 hover:opacity-90"
                                style="background-color: ${this.config.cores.primary}"
                                data-destino='${JSON.stringify(destino)}'>
                            Escolher Este Destino!
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Renderiza informações de transporte baseadas no tipo de viagem
     */
    renderizarInfoTransporte(destino) {
        const tipoViagem = this.state.tipoViagem;
        
        if (tipoViagem === 'carro') {
            return `
                <div class="mt-2 bg-green-50 p-3 rounded-lg border border-green-200">
                    <div class="flex items-center mb-2">
                        <span class="text-lg mr-2">🚗</span>
                        <span class="font-medium text-green-800">Road Trip</span>
                    </div>
                    ${destino.distanciaAproximada ? `
                        <p class="text-sm text-green-700">
                            <strong>Distância:</strong> ${destino.distanciaAproximada}
                        </p>
                    ` : ''}
                    ${destino.tempoEstimadoViagem ? `
                        <p class="text-sm text-green-700">
                            <strong>Tempo de viagem:</strong> ${destino.tempoEstimadoViagem}
                        </p>
                    ` : ''}
                    <p class="text-xs text-green-600 mt-2 flex items-center">
                        <span class="mr-1">✨</span>
                        Ao escolher, você verá a rota no Google Maps
                    </p>
                </div>
            `;
        } else if (tipoViagem === 'rodoviario') {
            return `
                <div class="mt-2 bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div class="flex items-center mb-2">
                        <span class="text-lg mr-2">🚌</span>
                        <span class="font-medium text-blue-800">Viagem de Ônibus</span>
                    </div>
                    ${destino.precoTransporte ? `
                        <p class="text-sm text-blue-700">
                            <strong>Passagem:</strong> ${destino.precoTransporte}
                        </p>
                    ` : ''}
                    ${destino.tempoViagem ? `
                        <p class="text-sm text-blue-700">
                            <strong>Tempo de viagem:</strong> ${destino.tempoViagem}
                        </p>
                    ` : ''}
                    <p class="text-xs text-blue-600 mt-2 flex items-center">
                        <span class="mr-1">✨</span>
                        Ao escolher, você será direcionado ao nosso parceiro
                    </p>
                </div>
            `;
        } else {
            return `
                <div class="mt-2 bg-orange-50 p-3 rounded-lg border border-orange-200">
                    <div class="flex items-center mb-2">
                        <span class="text-lg mr-2">✈️</span>
                        <span class="font-medium text-orange-800">Estimativa de Voo</span>
                    </div>
                    ${destino.precoVoo ? `
                        <p class="text-sm text-orange-700">
                            <strong>Passagem:</strong> ${destino.precoVoo}
                        </p>
                    ` : ''}
                    ${destino.precoEstimado ? `
                        <p class="text-sm text-orange-700">
                            <strong>Total estimado:</strong> ${destino.precoEstimado}
                        </p>
                    ` : ''}
                    <p class="text-xs text-orange-600 mt-2 flex items-center">
                        <span class="mr-1">✨</span>
                        Preços em tempo real após seleção
                    </p>
                </div>
            `;
        }
    },

    /**
     * Renderiza destinos alternativos
     */
    renderizarDestinosAlternativos(destinos) {
        if (destinos.length === 0) return '';
        
        return `
            <div class="mx-4 mt-6">
                <h3 class="font-bold text-lg mb-4">Mais Destinos Incríveis</h3>
                <div class="space-y-3">
                    ${destinos.map(destino => `
                        <div class="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                            <div class="flex">
                                <div class="w-1/3">
                                    <img src="${destino.imagem}" alt="${destino.destino}" 
                                         class="w-full h-24 object-cover" />
                                </div>
                                <div class="w-2/3 p-3 flex flex-col justify-between">
                                    <div>
                                        <div class="flex justify-between items-start mb-2">
                                            <h4 class="font-bold text-sm">${destino.destino}</h4>
                                            <span class="text-xs font-medium px-1 py-0.5 rounded bg-gray-200">
                                                ${destino.estado || destino.pais}
                                            </span>
                                        </div>
                                        <p class="text-xs text-gray-600 line-clamp-2">${destino.descricao}</p>
                                    </div>
                                    <button class="btn-selecionar mt-2 px-3 py-1 text-xs font-medium rounded border transition-colors"
                                            style="border-color: ${this.config.cores.secondary}; color: ${this.config.cores.secondary}"
                                            data-destino='${JSON.stringify(destino)}'>
                                        Ver Destino
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Gera botão "Me Surpreenda"
     */
    gerarHTMLBotaoSurpresa() {
        return `
            <div class="mx-4 mt-6 p-4 rounded-lg text-white" 
                 style="background-color: ${this.config.cores.primary}">
                <p class="font-bold text-lg text-center mb-3">
                    Ainda não decidiu? Sem problemas! Clique em "Me Surpreenda!" e eu escolho um lugar baseado nas suas vibes de viagem! 🐾
                </p>
                <button id="btn-surpresa" 
                        class="w-full font-bold py-2.5 px-4 rounded text-white transition-colors duration-200 hover:bg-blue-600"
                        style="background-color: ${this.config.cores.secondary}">
                    Me Surpreenda! 🎲
                </button>
            </div>
        `;
    },

    /**
     * EVENTOS E INTERAÇÕES
     */

    /**
     * Configura event listeners globais
     */
    configurarEventListeners() {
        // Event listener para voltar
        document.addEventListener('click', (e) => {
            if (e.target.id === 'btn-voltar') {
                this.voltarParaChat();
            }
        });
    },

    /**
     * Configura event listeners da interface
     */
    configurarEventListenersInterface() {
        // Botões de seleção de destino
        document.querySelectorAll('.btn-selecionar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const destinoData = JSON.parse(e.target.dataset.destino);
                this.selecionarDestino(destinoData);
            });
        });

        // Botão surpresa
        const btnSurpresa = document.getElementById('btn-surpresa');
        if (btnSurpresa) {
            btnSurpresa.addEventListener('click', () => {
                this.escolherDestinoSurpresa();
            });
        }
    },

    /**
     * Seleciona um destino e mostra confirmação
     */
    async selecionarDestino(destino) {
        console.log('🎯 Destino selecionado:', destino);
        
        this.state.destinoSelecionado = destino;
        
        // Salvar no localStorage
        localStorage.setItem('benetrip_destino_selecionado', JSON.stringify(destino));
        
        // Atualizar dados do usuário
        this.state.dadosUsuario.destinoSelecionado = destino;
        localStorage.setItem('benetrip_dados_usuario', JSON.stringify(this.state.dadosUsuario));
        
        // Mostrar confirmação
        this.mostrarConfirmacaoSelecao(destino);
    },

    /**
     * Mostra modal de confirmação de seleção
     */
    mostrarConfirmacaoSelecao(destino) {
        const modalHTML = `
            <div id="modal-confirmacao" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                    <div class="p-4 border-b">
                        <h2 class="text-xl font-bold text-center">Confirmar Destino</h2>
                    </div>
                    
                    <div class="p-4">
                        <div class="text-center mb-4">
                            <img src="${destino.imagem}" alt="${destino.destino}" 
                                 class="w-full h-32 object-cover rounded-lg mb-3" />
                            <h3 class="text-lg font-bold">${destino.destino}, ${destino.estado || destino.pais}</h3>
                            <p class="text-sm text-gray-600 mt-2">${destino.descricao}</p>
                        </div>
                        
                        ${this.renderizarInfoTransporte(destino)}
                        
                        <div class="mt-4 p-3 rounded" style="background-color: rgba(232, 119, 34, 0.1)">
                            <div class="flex items-start gap-3">
                                <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                                    <img src="/api/placeholder/32/32" alt="Tripinha" class="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <p class="text-sm font-bold">Ótima escolha, Triper! 🐾</p>
                                    <p class="text-sm mt-1">Tem certeza que este é o destino certo para sua aventura?</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="p-4 border-t flex gap-3">
                        <button id="btn-cancelar" 
                                class="flex-1 py-2 px-4 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button id="btn-confirmar" 
                                class="flex-1 py-2 px-4 rounded text-white font-bold"
                                style="background-color: ${this.config.cores.primary}">
                            Sim, Confirmar!
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Event listeners do modal
        document.getElementById('btn-cancelar').addEventListener('click', () => {
            document.getElementById('modal-confirmacao').remove();
        });
        
        document.getElementById('btn-confirmar').addEventListener('click', () => {
            this.confirmarSelecaoDestino(destino);
            document.getElementById('modal-confirmacao').remove();
        });
    },

    /**
     * Confirma seleção e redireciona
     */
    confirmarSelecaoDestino(destino) {
        const tipoViagem = this.state.tipoViagem;
        
        console.log(`🚀 Redirecionando para ${tipoViagem}...`);
        
        try {
            let url;
            let mensagemToast;
            
            if (tipoViagem === 'carro') {
                url = this.construirURLGoogleMaps(destino);
                mensagemToast = 'Abrindo rota no Google Maps...';
            } else if (tipoViagem === 'rodoviario') {
                url = this.construirURLDeOnibus();
                mensagemToast = 'Redirecionando para busca de ônibus...';
            } else {
                url = this.construirURLVoos(destino);
                mensagemToast = 'Redirecionando para busca de voos...';
            }
            
            this.exibirToast(mensagemToast, 'success');
            
            // Pequeno delay para o usuário ver o toast
            setTimeout(() => {
                window.open(url, '_blank');
            }, 1000);
            
            // Opcional: redirecionar para página de roteiro após 3 segundos
            setTimeout(() => {
                window.location.href = 'roteiro.html';
            }, 3000);
            
        } catch (error) {
            console.error('❌ Erro ao confirmar destino:', error);
            this.exibirToast('Erro ao processar seleção. Tente novamente.', 'error');
        }
    },

    /**
     * Escolhe destino surpresa aleatório
     */
    escolherDestinoSurpresa() {
        const destinos = this.state.destinosCarregados;
        
        if (destinos.length === 0) {
            this.exibirToast('Nenhum destino disponível no momento', 'error');
            return;
        }
        
        const destinoSurpresa = destinos[Math.floor(Math.random() * destinos.length)];
        
        this.exibirToast('🎲 Surpresa preparada pela Tripinha!', 'info');
        
        setTimeout(() => {
            this.selecionarDestino(destinoSurpresa);
        }, 1500);
    },

    /**
     * FUNÇÕES AUXILIARES
     */

    /**
     * Busca imagem do destino via API
     */
    async buscarImagemDestino(nomeDestino) {
        try {
            // Usar Pixabay como exemplo (substitua pela API real)
            const apiKey = '49362381-a41d711f264bb410498a060a0'; // Demo key
            const query = encodeURIComponent(nomeDestino);
            const url = `${this.config.apis.pixabay}?key=${apiKey}&q=${query}&image_type=photo&category=travel&per_page=3`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.hits && data.hits.length > 0) {
                return data.hits[0].webformatURL;
            }
            
            return '/api/placeholder/400/300';
        } catch (error) {
            console.warn('⚠️ Erro ao buscar imagem:', error);
            return '/api/placeholder/400/300';
        }
    },

    /**
     * Exibe toast notification
     */
    exibirToast(mensagem, tipo = 'info') {
        const cores = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500',
            warning: 'bg-yellow-500'
        };
        
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 ${cores[tipo]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300`;
        toast.textContent = mensagem;
        
        document.body.appendChild(toast);
        
        // Animar entrada
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // Remover após delay
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, this.config.toastDuration);
    },

    /**
     * Exibe erro genérico
     */
    exibirErro(mensagem) {
        const container = document.getElementById('destinos-container');
        if (container) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                    <div class="text-6xl mb-4">😵</div>
                    <h2 class="text-xl font-bold text-gray-800 mb-2">Oops!</h2>
                    <p class="text-gray-600 mb-6">${mensagem}</p>
                    <button onclick="location.reload()" 
                            class="px-6 py-2 rounded text-white font-medium"
                            style="background-color: ${this.config.cores.primary}">
                        Tentar Novamente
                    </button>
                </div>
            `;
        }
    },

    /**
     * Mostra indicador de carregamento
     */
    mostrarCarregamento() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    },

    /**
     * Oculta indicador de carregamento
     */
    ocultarCarregamento() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    },

    /**
     * Volta para o chat
     */
    voltarParaChat() {
        window.location.href = 'index.html';
    },

    /**
     * Utility: embaralha array
     */
    embaralharArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    /**
     * Utility: delay para promises
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

/**
 * INICIALIZAÇÃO AUTOMÁTICA
 * Inicia o sistema quando o DOM estiver carregado
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 Benetrip Destinos - Iniciando...');
    BENETRIP_DESTINOS.inicializar();
});

/**
 * EXPOSIÇÃO GLOBAL
 * Torna o objeto disponível globalmente para debug e extensões
 */
window.BENETRIP_DESTINOS = BENETRIP_DESTINOS;