/**
 * BENETRIP - Módulo de Interface de Voos
 * 
 * Este arquivo gerencia a interface do usuário para a página de voos,
 * incluindo a navegação entre cards, modais e elementos interativos.
 * Funciona em conjunto com o módulo flights.js que processa os dados.
 * Versão adaptada para layout vertical conforme protótipo.
 */

// ======= UTILITÁRIOS =======

// Funções auxiliares para URLs de logotipos
function getAirlineLogoUrl(iataCode, width = 40, height = 40, retina = false) {
    if (!iataCode || typeof iataCode !== 'string') {
        return `https://pics.avs.io/${width}/${height}/default.png`;
    }
    
    const code = iataCode.trim().toUpperCase();
    const retinaSuffix = retina ? '@2x' : '';
    
    return `https://pics.avs.io/${width}/${height}/${code}${retinaSuffix}.png`;
}

function getAgencyLogoUrl(gateId, width = 110, height = 40, retina = false) {
    if (!gateId) return null;
    
    const retinaSuffix = retina ? '@2x' : '';
    return `https://pics.avs.io/as_gates/${width}/${height}/${gateId}${retinaSuffix}.png`;
}

// Função para formatar duração de voo
function formatarDuracao(minutos) {
    if (typeof minutos !== 'number' || minutos < 0) return 'N/A';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h${mins > 0 ? ` ${mins}m` : ''}`;
}

// Função para formatar data
function formatarData(data) {
    if (!data || !(data instanceof Date) || isNaN(data.getTime())) return 'N/A';
    
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${diasSemana[data.getDay()]}, ${data.getDate()} ${meses[data.getMonth()]}`;
}

/**
 * Aplicar estilos CSS para layout vertical
 */
function aplicarEstilosVerticais() {
    const style = document.createElement('style');
    style.textContent = `
    .voos-swipe-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
      overflow-x: hidden;
      scroll-snap-type: y mandatory;
      padding: 8px 16px 80px;
      margin-bottom: 16px;
      max-height: calc(100vh - 240px);
      scrollbar-width: thin;
      background: none;
    }

    .voo-card {
      flex: 0 0 auto;
      width: 100%;
      max-width: none;
      scroll-snap-align: start;
      min-width: 0;
      margin: 0 0 12px 0;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .customize-search-button {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 10px 16px;
      margin: 12px 16px;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--benetrip-blue);
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .customize-search-button:hover {
      background-color: #f8f9fa;
    }

    .customize-search-button svg {
      margin-right: 6px;
    }

    .pagination-indicator,
    .nav-controls,
    .swipe-hint {
      display: none;
    }

    .choose-flight-button {
      width: 100%;
      background-color: var(--benetrip-orange);
      color: white;
      font-weight: 600;
      border: none;
      border-radius: 4px;
      padding: 10px 16px;
      margin-top: 8px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .choose-flight-button:hover {
      background-color: #d06a1c;
    }

    .modal-backdrop {
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }

    .modal-backdrop.modal-active {
      opacity: 1;
      visibility: visible;
      display: flex !important;
      pointer-events: auto !important;
    }
    `;
    document.head.appendChild(style);
    console.log('Estilos para layout vertical aplicados');
}

/**
 * Adicionar botão de customização
 */
function adicionarBotaoCustomizacao() {
    // Busca o botão existente no HTML
    const existingButton = document.querySelector('.customize-search-button');
    
    if (existingButton) {
        // Se o botão já existe, apenas adiciona o evento de clique
        console.log('Botão de customização encontrado, adicionando evento de clique');
        existingButton.addEventListener('click', function() {
            abrirModalFiltros();
        });
        
        // Adiciona badge de filtros (se não existir)
        if (!existingButton.querySelector('#filtros-badge')) {
            const badge = document.createElement('span');
            badge.id = 'filtros-badge';
            badge.className = 'filtros-badge';
            badge.style.display = 'none';
            badge.textContent = '0';
            existingButton.appendChild(badge);
        }
        
        console.log('Evento adicionado ao botão de customização existente');
        return;
    }
}

// Função para abrir modal de filtros
function abrirModalFiltros() {
    console.log('Tentando abrir modal de filtros...');
    
    // Verificar se o modal existe
    const modal = document.getElementById('modal-filtros');
    if (!modal) {
        console.error('ERRO: Modal de filtros não encontrado!');
        
        // Tentar encontrar se existe algum modal no documento para debug
        const possibleModals = document.querySelectorAll('.modal-backdrop');
        console.log('Modais encontrados:', possibleModals.length);
        
        // Exibir uma mensagem para o usuário
        if (typeof window.showGlobalError === 'function') {
            window.showGlobalError('Erro ao abrir filtros. Tente recarregar a página.');
        } else if (typeof exibirToast === 'function') {
            exibirToast('Erro ao abrir filtros. Tente recarregar a página.', 'error');
        } else {
            alert('Erro ao abrir filtros. Tente recarregar a página.');
        }
        return;
    }
    
    try {
        // Inicializa contadores de resultados
        if (typeof atualizarContadoresResultados === 'function') {
            atualizarContadoresResultados();
        }
        
        // Carregamos os filtros salvos, se existirem
        if (typeof carregarFiltrosSalvos === 'function') {
            carregarFiltrosSalvos();
        }
        
        // Exibimos o modal - garantindo que display está definido
        modal.style.display = 'flex';
        
        // Adicionamos a classe ativa com timeout para permitir a animação
        setTimeout(() => {
            modal.classList.add('modal-active');
            console.log('Modal ativado com sucesso');
            
            // Foca o primeiro elemento focável para acessibilidade
            const primeiroFocavel = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (primeiroFocavel) {
                primeiroFocavel.focus();
            }
        }, 10);
        
        // Configura navegação por teclado dentro do modal
        if (typeof configurarNavegacaoTeclado === 'function') {
            configurarNavegacaoTeclado(modal);
        }
        
        console.log('Modal de filtros aberto com sucesso');
    } catch (erro) {
        console.error('Erro ao abrir modal de filtros:', erro);
        
        // Garante que o modal seja exibido mesmo após erro
        modal.style.display = 'flex';
        modal.classList.add('modal-active');
        
        // Notifica o usuário sobre o erro de maneira não bloqueante
        if (typeof exibirToast === 'function') {
            exibirToast('Algumas opções de filtro podem não estar disponíveis.', 'warning');
        }
    }
}

// Função para configurar navegação por teclado
function configurarNavegacaoTeclado(modal) {
    if (!modal) return;
    
    const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];
    
    // Salva o elemento que estava em foco antes de abrir o modal
    const focoAnterior = document.activeElement;
    
    modal.addEventListener('keydown', function modalKeyHandler(e) {
        if (e.key === 'Escape') {
            fecharModalFiltros();
            
            // Remove o event listener quando o modal é fechado
            modal.removeEventListener('keydown', modalKeyHandler);
        }
        
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    });
    
    // Quando o modal for fechado, restaura o foco para o elemento anterior
    document.addEventListener('modal-fechado', function restoreFocus() {
        if (focoAnterior && typeof focoAnterior.focus === 'function') {
            focoAnterior.focus();
        }
        
        // Remove o event listener após restaurar o foco
        document.removeEventListener('modal-fechado', restoreFocus);
    });
}

// Função para fechar o modal de filtros
function fecharModalFiltros() {
    const modal = document.getElementById('modal-filtros');
    if (modal) {
        modal.classList.remove('modal-active');
        setTimeout(() => {
            modal.style.display = 'none';
            
            // Dispara evento para avisar que o modal foi fechado
            document.dispatchEvent(new CustomEvent('modal-fechado'));
        }, 300);
    }
}

// Pré-visualização de resultados filtrados
function atualizarPreviewResultadosFiltrados() {
    // Se não tem dados de voos, não faz nada
    if (!window.BENETRIP_VOOS?.resultadosOriginais?.proposals) {
        return;
    }
    
    // Obtém os filtros atuais
    const filtros = coletarFiltrosAtuais();
    
    // Simula a filtragem para ver quantos resultados seriam encontrados
    const propostas = window.BENETRIP_VOOS.resultadosOriginais.proposals;
    const filtradas = filtrarVoosSimulado(propostas, filtros);
    
    // Atualiza o contador de resultados
    const totalElement = document.getElementById('total-resultados');
    const filtradosElement = document.getElementById('total-resultados-filtrados');
    
    if (totalElement && filtradosElement) {
        totalElement.textContent = propostas.length;
        filtradosElement.textContent = filtradas.length;
    }
}

// Simula filtragem sem alterar resultados reais
function filtrarVoosSimulado(propostas, filtros) {
    if (!propostas || !filtros || !window.BENETRIP_VOOS) {
        return propostas || [];
    }
    
    return propostas.filter(voo => {
        // Filtro de voos diretos
        if (filtros.voosDiretos) {
            const infoIda = window.BENETRIP_VOOS.obterInfoSegmento(voo.segment?.[0]);
            const infoVolta = voo.segment?.length > 1 ? 
                window.BENETRIP_VOOS.obterInfoSegmento(voo.segment[1]) : null;
            
            const ehVooDireto = infoIda?.paradas === 0 && (!infoVolta || infoVolta.paradas === 0);
            if (!ehVooDireto) return false;
        }
        
        // Filtro de horário de partida
        if (filtros.horarioPartida && filtros.horarioPartida.min !== 0 || filtros.horarioPartida.max !== 1439) {
            const infoIda = window.BENETRIP_VOOS.obterInfoSegmento(voo.segment?.[0]);
            if (infoIda && infoIda.horaPartida) {
                const [hora, minuto] = infoIda.horaPartida.split(':').map(Number);
                const minutosTotal = hora * 60 + minuto;
                
                if (minutosTotal < filtros.horarioPartida.min || 
                    minutosTotal > filtros.horarioPartida.max) {
                    return false;
                }
            }
        }
        
        // Filtro de duração máxima
        if (filtros.duracaoMaxima && filtros.duracaoMaxima < 24) {
            const infoIda = window.BENETRIP_VOOS.obterInfoSegmento(voo.segment?.[0]);
            if (infoIda && infoIda.duracao) {
                const duracaoHoras = infoIda.duracao / 60;
                if (duracaoHoras > filtros.duracaoMaxima) {
                    return false;
                }
            }
        }
        
        // Filtro de preço máximo
        if (filtros.precoMaximo && filtros.precoMaximo < 100) {
            const precoVoo = window.BENETRIP_VOOS.obterPrecoVoo(voo);
            const precoMaximoValor = calcularPrecoMaximoReal(filtros.precoMaximo);
            
            if (precoVoo > precoMaximoValor) {
                return false;
            }
        }
        
        // Filtro de companhias aéreas
        if (filtros.companhias && filtros.companhias.length > 0) {
            const companhiasVoo = voo.carriers || [];
            const temCompanhiaFiltrada = companhiasVoo.some(comp => 
                filtros.companhias.includes(comp)
            );
            if (!temCompanhiaFiltrada) return false;
        }
        
        // Filtro de aeroportos
        if (filtros.aeroportos && filtros.aeroportos.length > 0) {
            // Verifica se algum dos aeroportos do voo está na lista de aeroportos filtrados
            const aeroportosVoo = [];
            
            // Adiciona aeroportos de ida
            const segmentoIda = voo.segment?.[0]?.flight || [];
            segmentoIda.forEach(trecho => {
                if (trecho.departure) aeroportosVoo.push(trecho.departure);
                if (trecho.arrival) aeroportosVoo.push(trecho.arrival);
            });
            
            // Adiciona aeroportos de volta
            const segmentoVolta = voo.segment?.[1]?.flight || [];
            segmentoVolta.forEach(trecho => {
                if (trecho.departure) aeroportosVoo.push(trecho.departure);
                if (trecho.arrival) aeroportosVoo.push(trecho.arrival);
            });
            
            // Verifica se pelo menos um aeroporto está na lista de filtrados
            const temAeroportoFiltrado = aeroportosVoo.some(aero => 
                filtros.aeroportos.includes(aero)
            );
            if (!temAeroportoFiltrado) return false;
        }
        
        // Se passou por todos os filtros, inclui o voo
        return true;
    });
}

// Função auxiliar para calcular o preço máximo real com base no percentual do slider
function calcularPrecoMaximoReal(percentual) {
    if (!window.BENETRIP_VOOS?.resultadosOriginais?.proposals) {
        return Infinity;
    }
    
    // Obtém o maior e menor preço disponíveis
    let menorPreco = Infinity;
    let maiorPreco = 0;
    
    window.BENETRIP_VOOS.resultadosOriginais.proposals.forEach(voo => {
        const preco = window.BENETRIP_VOOS.obterPrecoVoo(voo);
        if (preco < menorPreco) menorPreco = preco;
        if (preco > maiorPreco) maiorPreco = preco;
    });
    
    // Calcula o preço máximo com base no percentual
    return menorPreco + ((maiorPreco - menorPreco) * percentual / 100);
}

// NOVA FUNÇÃO: Atualizar slider de horário de chegada
function atualizarSliderChegada() {
    const min = parseInt(document.getElementById('chegada-slider-min').value);
    const max = parseInt(document.getElementById('chegada-slider-max').value);
    
    // Garante que min não ultrapasse max
    if (min > max) {
        document.getElementById('chegada-slider-min').value = max;
    }
    
    // Converte minutos para formato de hora
    const minHora = Math.floor(min / 60).toString().padStart(2, '0');
    const minMinuto = (min % 60).toString().padStart(2, '0');
    
    const maxHora = Math.floor(max / 60).toString().padStart(2, '0');
    const maxMinuto = (max % 60).toString().padStart(2, '0');
    
    // Atualiza os textos
    document.getElementById('chegada-min').textContent = `${minHora}:${minMinuto}`;
    document.getElementById('chegada-max').textContent = `${maxHora}:${maxMinuto}`;
}


// Carrega filtros salvos no localStorage
function carregarFiltrosSalvos() {
    try {
        const filtrosSalvos = JSON.parse(localStorage.getItem('benetrip_filtros_voos') || '{}');
        
        // Voos diretos
        const voosDirectosCheckbox = document.getElementById('filtro-voos-diretos');
        if (voosDirectosCheckbox && filtrosSalvos.voosDiretos) {
            voosDirectosCheckbox.checked = filtrosSalvos.voosDiretos;
        }
        
        // Horário de partida
        const partidaMinSlider = document.getElementById('partida-slider-min');
        const partidaMaxSlider = document.getElementById('partida-slider-max');
        if (partidaMinSlider && partidaMaxSlider && filtrosSalvos.horarioPartida) {
            partidaMinSlider.value = filtrosSalvos.horarioPartida.min || 0;
            partidaMaxSlider.value = filtrosSalvos.horarioPartida.max || 1439;
            atualizarSliderPartida();
        }
        
        // NOVO: Horário de chegada
        const chegadaMinSlider = document.getElementById('chegada-slider-min');
        const chegadaMaxSlider = document.getElementById('chegada-slider-max');
        if (chegadaMinSlider && chegadaMaxSlider && filtrosSalvos.horarioChegada) {
            chegadaMinSlider.value = filtrosSalvos.horarioChegada.min || 0;
            chegadaMaxSlider.value = filtrosSalvos.horarioChegada.max || 1439;
            atualizarSliderChegada();
        }
        
        // Duração
        const duracaoSlider = document.getElementById('duracao-slider');
        if (duracaoSlider && filtrosSalvos.duracaoMaxima) {
            duracaoSlider.value = filtrosSalvos.duracaoMaxima;
            atualizarSliderDuracao();
        }
        
        // Preço máximo
        const precoSlider = document.getElementById('preco-slider');
        if (precoSlider && filtrosSalvos.precoMaximo) {
            precoSlider.value = filtrosSalvos.precoMaximo;
            atualizarSliderPreco();
        }
        
        // Companhias
        if (filtrosSalvos.companhias && filtrosSalvos.companhias.length) {
            setTimeout(() => {
                const companhiasHeader = document.querySelector('[aria-controls="companhias-content"]');
                if (companhiasHeader) {
                    expandirOpcoesFiltro('companhias', companhiasHeader);
                }
                
                setTimeout(() => {
                    document.querySelectorAll('.filtro-companhia').forEach(checkbox => {
                        checkbox.checked = filtrosSalvos.companhias.includes(checkbox.value);
                    });
                }, 300);
            }, 100);
        }
        
        // Aeroportos
        if (filtrosSalvos.aeroportos && filtrosSalvos.aeroportos.length) {
            setTimeout(() => {
                const aeroportosHeader = document.querySelector('[aria-controls="aeroportos-content"]');
                if (aeroportosHeader) {
                    expandirOpcoesFiltro('aeroportos', aeroportosHeader);
                }
                
                setTimeout(() => {
                    document.querySelectorAll('.filtro-aeroporto').forEach(checkbox => {
                        checkbox.checked = filtrosSalvos.aeroportos.includes(checkbox.value);
                    });
                }, 300);
            }, 100);
        }
        
        // Atualiza contador de filtros
        atualizarContadorFiltros();
        
        // Atualiza preview de resultados
        atualizarPreviewResultadosFiltrados();
    } catch (error) {
        console.error('Erro ao carregar filtros salvos:', error);
    }
}


// Coleta os filtros atuais do modal
function coletarFiltrosAtuais() {
    try {
        // Coleta os valores dos filtros
        const voosDiretos = document.getElementById('filtro-voos-diretos')?.checked || false;
        
        const partidaMin = parseInt(document.getElementById('partida-slider-min')?.value || 0);
        const partidaMax = parseInt(document.getElementById('partida-slider-max')?.value || 1439);
        
        // NOVO: Coletar valores do horário de chegada
        const chegadaMin = parseInt(document.getElementById('chegada-slider-min')?.value || 0);
        const chegadaMax = parseInt(document.getElementById('chegada-slider-max')?.value || 1439);
        
        const duracaoMaxima = parseInt(document.getElementById('duracao-slider')?.value || 24);
        
        const precoMaximo = parseInt(document.getElementById('preco-slider')?.value || 100);
        
        const companhias = Array.from(document.querySelectorAll('.filtro-companhia:checked'))
            .map(checkbox => checkbox.value);
            
        const aeroportos = Array.from(document.querySelectorAll('.filtro-aeroporto:checked'))
            .map(checkbox => checkbox.value);
        
        // Cria objeto com os filtros
        return {
            voosDiretos,
            horarioPartida: { min: partidaMin, max: partidaMax },
            horarioChegada: { min: chegadaMin, max: chegadaMax }, // NOVO
            duracaoMaxima,
            precoMaximo,
            companhias,
            aeroportos
        };
    } catch (error) {
        console.error('Erro ao coletar filtros atuais:', error);
        return {};
    }
}

// Salva os filtros atuais no localStorage
function salvarFiltrosAtuais() {
    try {
        const filtros = coletarFiltrosAtuais();
        
        // Salva no localStorage
        localStorage.setItem('benetrip_filtros_voos', JSON.stringify(filtros));
        
        // Atualiza badge no botão de filtros
        atualizarBadgeFiltros();
        
        return filtros;
    } catch (error) {
        console.error('Erro ao salvar filtros:', error);
        return {};
    }
}

// Atualiza o contador de filtros ativos
function atualizarContadorFiltros() {
    const countElement = document.getElementById('filtros-count');
    if (!countElement) return;
    
    // Coleta os filtros atuais
    const filtros = coletarFiltrosAtuais();
    
    let count = 0;
    
    // Conta os filtros ativos
    if (filtros.voosDiretos) count++;
    
    if (filtros.horarioPartida.min > 0 || filtros.horarioPartida.max < 1439) count++;
    
    // NOVO: Contar filtro de horário de chegada
    if (filtros.horarioChegada.min > 0 || filtros.horarioChegada.max < 1439) count++;
    
    if (filtros.duracaoMaxima < 24) count++;
    
    if (filtros.precoMaximo < 100) count++;
    
    if (filtros.companhias.length > 0) count++;
    
    if (filtros.aeroportos.length > 0) count++;
    
    // Atualiza o contador
    countElement.textContent = count;
    
    // Também atualiza a pré-visualização dos resultados
    atualizarPreviewResultadosFiltrados();
}

// Atualiza o badge no botão de filtros
function atualizarBadgeFiltros() {
    const badge = document.getElementById('filtros-badge');
    if (!badge) return;
    
    try {
        const filtros = JSON.parse(localStorage.getItem('benetrip_filtros_voos') || '{}');
        
        let count = 0;
        if (filtros.voosDiretos) count++;
        if (filtros.horarioPartida && (filtros.horarioPartida.min > 0 || filtros.horarioPartida.max < 1439)) count++;
        if (filtros.horarioChegada && (filtros.horarioChegada.min > 0 || filtros.horarioChegada.max < 1439)) count++;
        if (filtros.duracaoMaxima && filtros.duracaoMaxima < 24) count++;
        if (filtros.precoMaximo && filtros.precoMaximo < 100) count++;
        if (filtros.companhias && filtros.companhias.length) count++;
        if (filtros.aeroportos && filtros.aeroportos.length) count++;
        
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Erro ao atualizar badge de filtros:', error);
        badge.style.display = 'none';
    }
}

// Atualiza os contadores de resultados totais
function atualizarContadoresResultados() {
    if (!window.BENETRIP_VOOS?.finalResults?.proposals) {
        return;
    }
    
    const totalElement = document.getElementById('total-resultados');
    const filtradosElement = document.getElementById('total-resultados-filtrados');
    
    if (totalElement && filtradosElement) {
        const total = window.BENETRIP_VOOS.resultadosOriginais?.proposals?.length || 
                     window.BENETRIP_VOOS.finalResults.proposals.length;
                     
        totalElement.textContent = total;
        filtradosElement.textContent = window.BENETRIP_VOOS.finalResults.proposals.length;
    }
}

// Funções para os sliders
function atualizarSliderPartida() {
    const min = parseInt(document.getElementById('partida-slider-min').value);
    const max = parseInt(document.getElementById('partida-slider-max').value);
    
    // Garante que min não ultrapasse max
    if (min > max) {
        document.getElementById('partida-slider-min').value = max;
    }
    
    // Converte minutos para formato de hora
    const minHora = Math.floor(min / 60).toString().padStart(2, '0');
    const minMinuto = (min % 60).toString().padStart(2, '0');
    
    const maxHora = Math.floor(max / 60).toString().padStart(2, '0');
    const maxMinuto = (max % 60).toString().padStart(2, '0');
    
    // Atualiza os textos
    document.getElementById('partida-min').textContent = `${minHora}:${minMinuto}`;
    document.getElementById('partida-max').textContent = `${maxHora}:${maxMinuto}`;
}

function atualizarSliderDuracao() {
    const valor = parseInt(document.getElementById('duracao-slider').value);
    
    if (valor >= 24) {
        document.getElementById('duracao-valor').textContent = 'Qualquer';
    } else {
        document.getElementById('duracao-valor').textContent = `Até ${valor}h`;
    }
}

function atualizarSliderPreco() {
    const valor = parseInt(document.getElementById('preco-slider').value);
    const precoElement = document.getElementById('preco-valor');
    
    if (!precoElement) return;
    
    if (valor >= 100) {
        precoElement.textContent = 'Qualquer';
    } else {
        // Se temos dados de voos, calcula o preço real
        if (window.BENETRIP_VOOS?.resultadosOriginais?.proposals) {
            const precoReal = calcularPrecoMaximoReal(valor);
            const moeda = window.BENETRIP_VOOS.obterMoedaAtual();
            
            const formattedPrice = new Intl.NumberFormat('pt-BR', { 
                style: 'currency', 
                currency: moeda, 
                minimumFractionDigits: 0, 
                maximumFractionDigits: 0 
            }).format(precoReal);
            
            precoElement.textContent = `Até ${formattedPrice}`;
        } else {
            // Valor estimado quando não temos dados
            // Criamos um range de preço aproximado baseado na porcentagem
            const precoBase = 10000; // Valor base aproximado
            const precoEstimado = precoBase * (valor / 100);
            const moeda = 'BRL'; // Moeda padrão
            
            const formattedPrice = new Intl.NumberFormat('pt-BR', { 
                style: 'currency', 
                currency: moeda, 
                minimumFractionDigits: 0, 
                maximumFractionDigits: 0 
            }).format(precoEstimado);
            
            precoElement.textContent = `Aprox. ${formattedPrice}`;
        }
    }
}

// Funções para expandir painéis de filtro
let debouncedSearchTimer;

function expandirOpcoesFiltro(tipo, header) {
    // Referências aos elementos
    const content = document.getElementById(`${tipo}-content`);
    const toggle = header.querySelector('.filtro-toggle');
    
    if (!content || !toggle) return;
    
    // Se já está expandido, colapsa
    if (header.getAttribute('aria-expanded') === 'true') {
        content.style.maxHeight = null;
        toggle.textContent = '▼';
        header.setAttribute('aria-expanded', 'false');
        return;
    }
    
    // Expande o painel
    header.setAttribute('aria-expanded', 'true');
    toggle.textContent = '▲';
    
    // Verifica se já está carregado
    if (content.dataset.carregado === "true") {
        content.style.maxHeight = content.scrollHeight + 'px';
        return;
    }
    
    // Mostra loader
    content.innerHTML = `
        <div class="loading-placeholder">
            <span class="loading-spinner"></span>
            Carregando opções...
        </div>
    `;
    
    // Carrega as opções
    if (tipo === 'companhias') {
        // Carrega com pequeno delay para mostrar o loading
        setTimeout(() => {
            preencherOpcoesCompanhias();
            content.dataset.carregado = "true";
            
            // Ajusta altura após o preenchimento
            setTimeout(() => {
                content.style.maxHeight = content.scrollHeight + 'px';
                
                // Configura busca para companhias, se tiver muitas opções
                if (content.querySelectorAll('.checkbox-item').length > 10) {
                    adicionarBuscaFiltro(content, 'companhias');
                }
            }, 50);
        }, 300);
    } else if (tipo === 'aeroportos') {
        setTimeout(() => {
            preencherOpcoesAeroportos();
            content.dataset.carregado = "true";
            
            // Ajusta altura após o preenchimento
            setTimeout(() => {
                content.style.maxHeight = content.scrollHeight + 'px';
                
                // Adiciona busca para aeroportos
                adicionarBuscaFiltro(content, 'aeroportos');
            }, 50);
        }, 300);
    }
}

// Adiciona campo de busca para filtros extensos
function adicionarBuscaFiltro(container, tipo) {
    // Verifica se já existe
    if (container.querySelector('.filtro-search')) return;
    
    // Cria o campo de busca
    const searchDiv = document.createElement('div');
    searchDiv.className = 'filtro-search';
    searchDiv.innerHTML = `
        <span class="filtro-search-icon">🔍</span>
        <input type="search" class="filtro-search-input" placeholder="Buscar..." 
               aria-label="Buscar ${tipo === 'companhias' ? 'companhias aéreas' : 'aeroportos'}">
    `;
    
    // Insere no início do container
    container.insertBefore(searchDiv, container.firstChild);
    
    // Atualiza a altura máxima
    container.style.maxHeight = container.scrollHeight + 'px';
    
    // Configura o evento de busca
    const searchInput = searchDiv.querySelector('.filtro-search-input');
    searchInput.addEventListener('input', function() {
        clearTimeout(debouncedSearchTimer);
        const valorBusca = this.value.toLowerCase();
        
        debouncedSearchTimer = setTimeout(() => {
            const itens = container.querySelectorAll('.checkbox-item');
            
            // Se não tem valor, mostra todos
            if (!valorBusca) {
                itens.forEach(item => {
                    item.style.display = 'block';
                });
                return;
            }
            
            // Filtra os itens
            itens.forEach(item => {
                const texto = item.textContent.toLowerCase();
                item.style.display = texto.includes(valorBusca) ? 'block' : 'none';
            });
        }, 300);
    });
}

// Preenche as opções de companhias aéreas
function preencherOpcoesCompanhias() {
    if (!window.BENETRIP_VOOS?.finalResults?.airlines) {
        console.log('Dados de companhias aéreas não disponíveis ainda');
        return;
    }
    
    const container = document.getElementById('companhias-content');
    if (!container) return;
    
    const airlines = window.BENETRIP_VOOS.finalResults.airlines;
    const airlinesList = Object.keys(airlines).map(code => ({
        code: code,
        name: airlines[code].name || code
    }));
    
    // Ordena por nome
    airlinesList.sort((a, b) => a.name.localeCompare(b.name));
    
    // Limpa o conteúdo atual
    container.innerHTML = '';
    
    // Se não houver companhias, mostra mensagem
    if (airlinesList.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhuma companhia disponível</div>';
        return;
    }
    
    // Preenche com as companhias disponíveis
    airlinesList.forEach(airline => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        item.innerHTML = `
            <label class="checkbox-label">
                <input type="checkbox" class="filtro-companhia" value="${airline.code}" 
                       aria-label="Companhia ${airline.name}">
                <span class="checkbox-text">
                    <img src="${getAirlineLogoUrl(airline.code, 16, 16)}" alt="" 
                         class="mini-logo" onerror="this.style.display='none'">
                    ${airline.name}
                </span>
            </label>
        `;
        container.appendChild(item);
    });
    
    // Configura eventos dos checkboxes
    container.querySelectorAll('.filtro-companhia').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            atualizarContadorFiltros();
        });
    });
}

// Preenche as opções de aeroportos
function preencherOpcoesAeroportos() {
    if (!window.BENETRIP_VOOS?.finalResults?.airports) {
        console.log('Dados de aeroportos não disponíveis ainda');
        return;
    }
    
    const container = document.getElementById('aeroportos-content');
    if (!container) return;
    
    const airports = window.BENETRIP_VOOS.finalResults.airports;
    const airportsList = Object.keys(airports).map(code => ({
        code: code,
        name: airports[code].name || code,
        city: airports[code].city || ''
    }));
    
    // Ordena por código IATA
    airportsList.sort((a, b) => a.code.localeCompare(b.code));
    
    // Limpa o conteúdo atual
    container.innerHTML = '';
    
    // Se não houver aeroportos, mostra mensagem
    if (airportsList.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum aeroporto disponível</div>';
        return;
    }
    
    // Preenche com os aeroportos disponíveis
    airportsList.forEach(airport => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        item.innerHTML = `
            <label class="checkbox-label">
                <input type="checkbox" class="filtro-aeroporto" value="${airport.code}"
                       aria-label="Aeroporto ${airport.code}">
                <span class="checkbox-text">
                    <strong>${airport.code}</strong> - ${airport.name}
                    ${airport.city ? `(${airport.city})` : ''}
                </span>
            </label>
        `;
        container.appendChild(item);
    });
    
    // Configura eventos dos checkboxes
    container.querySelectorAll('.filtro-aeroporto').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            atualizarContadorFiltros();
        });
    });
}

// Limpa todos os filtros
function limparFiltros() {
    // Reseta todos os filtros
    document.getElementById('filtro-voos-diretos').checked = false;
    
    document.getElementById('partida-slider-min').value = 0;
    document.getElementById('partida-slider-max').value = 1439;
    atualizarSliderPartida();
    
    // NOVO: Limpar horário de chegada
    document.getElementById('chegada-slider-min').value = 0;
    document.getElementById('chegada-slider-max').value = 1439;
    atualizarSliderChegada();
    
    document.getElementById('duracao-slider').value = 24;
    atualizarSliderDuracao();
    
    document.getElementById('preco-slider').value = 100;
    atualizarSliderPreco();
    
    document.querySelectorAll('.filtro-companhia, .filtro-aeroporto').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Remove os filtros rápidos ativos
    document.querySelectorAll('.filtro-rapido.active').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Atualiza contador
    atualizarContadorFiltros();
}

// Mostra estado de "sem resultados"
function mostrarEstadoSemResultados() {
    // Verifica se o template existe
    const template = document.getElementById('template-sem-resultados');
    if (!template) return;
    
    // Cria um clone do template
    const semResultados = document.importNode(template.content, true);
    
    // Adiciona evento ao botão de limpar filtros
    const btnLimpar = semResultados.querySelector('.btn-limpar-filtros-todos');
    if (btnLimpar) {
        btnLimpar.addEventListener('click', function() {
            limparFiltros();
            aplicarFiltros();
        });
    }
    
    // Adiciona ao container de voos
    const container = document.querySelector('.voos-content');
    if (container) {
        // Remove elemento anterior se existir
        const anterior = container.querySelector('.filtro-sem-resultados');
        if (anterior) {
            anterior.remove();
        }
        
        container.appendChild(semResultados);
    }
}

// Aplica os filtros nos resultados
function aplicarFiltros() {
    // Salva os filtros
    const filtros = salvarFiltrosAtuais();
    
    // Verifica se temos filtros para aplicar
    const temFiltros = (
        filtros.voosDiretos || 
        filtros.horarioPartida.min > 0 || 
        filtros.horarioPartida.max < 1439 ||
        filtros.horarioChegada.min > 0 || 
        filtros.horarioChegada.max < 1439 ||
        filtros.duracaoMaxima < 24 ||
        filtros.precoMaximo < 100 ||
        filtros.companhias.length > 0 ||
        filtros.aeroportos.length > 0
    );
    
    // Se não tem filtros, simplesmente restaura resultados originais
    if (!temFiltros) {
        if (window.BENETRIP_VOOS?.restaurarResultadosOriginais) {
            window.BENETRIP_VOOS.restaurarResultadosOriginais();
            exibirToast('Filtros removidos. Mostrando todos os voos.', 'info');
        }
        fecharModalFiltros();
        return;
    }
    
    // Aplica os filtros nos resultados
    if (window.BENETRIP_VOOS?.filtrarResultados) {
        const resultadosAntes = window.BENETRIP_VOOS.finalResults.proposals.length;
        
        window.BENETRIP_VOOS.filtrarResultados(filtros);
        
        const resultadosDepois = window.BENETRIP_VOOS.finalResults.proposals.length;
        
        // Fecha o modal
        fecharModalFiltros();
        
        // Se não encontrou resultados, mostra estado vazio
        if (resultadosDepois === 0) {
            mostrarEstadoSemResultados();
            exibirToast('Nenhum voo corresponde aos filtros selecionados.', 'warning');
        } else {
            // Exibe mensagem de confirmação
            const numFiltros = parseInt(document.getElementById('filtros-count').textContent);
            exibirToast(`${resultadosDepois} de ${resultadosAntes} voos correspondem aos filtros.`, 'success');
        }
    } else {
        fecharModalFiltros();
        exibirToast('Erro ao aplicar filtros. Tente novamente.', 'error');
    }
}

// Inicializa filtros rápidos
function inicializarFiltrosRapidos() {
    document.querySelectorAll('.filtro-rapido').forEach(btn => {
        btn.addEventListener('click', function() {
            const tipo = this.dataset.tipo;
            
            // Toggle do estado ativo
            this.classList.toggle('active');
            
            // Aplica o filtro rápido
            switch (tipo) {
                case 'diretos':
                    document.getElementById('filtro-voos-diretos').checked = this.classList.contains('active');
                    break;
                    
                case 'manha':
                    // Define horário de partida matinal (4:00-12:00)
                    if (this.classList.contains('active')) {
                        document.getElementById('partida-slider-min').value = 4 * 60;  // 4:00
                        document.getElementById('partida-slider-max').value = 12 * 60; // 12:00
                        atualizarSliderPartida();
                    } else {
                        document.getElementById('partida-slider-min').value = 0;
                        document.getElementById('partida-slider-max').value = 1439;
                        atualizarSliderPartida();
                    }
                    break;
                    
                case 'economicos':
                    // Define preço máximo na metade do range
                    if (this.classList.contains('active')) {
                        document.getElementById('preco-slider').value = 50;
                        atualizarSliderPreco();
                    } else {
                        document.getElementById('preco-slider').value = 100;
                        atualizarSliderPreco();
                    }
                    break;
            }
            
            // Atualiza contador de filtros
            atualizarContadorFiltros();
        });
    });
}

// Configurar eventos dos filtros
function configurarEventosFiltros() {
    // Filtros rápidos
    inicializarFiltrosRapidos();
    
    // Sliders de horário de partida
    const partidaMinSlider = document.getElementById('partida-slider-min');
    const partidaMaxSlider = document.getElementById('partida-slider-max');
    
    if (partidaMinSlider && partidaMaxSlider) {
        // Função com debounce para evitar excesso de atualizações
        let debouncedTimerPartida;
        
        const atualizarComDebounce = () => {
            // Atualiza UI imediatamente
            atualizarSliderPartida();
            
            // Debounce para atualizar contador
            clearTimeout(debouncedTimerPartida);
            debouncedTimerPartida = setTimeout(() => {
                atualizarContadorFiltros();
            }, 300);
        };
        
        partidaMinSlider.addEventListener('input', atualizarComDebounce);
        partidaMaxSlider.addEventListener('input', atualizarComDebounce);
    }
    
    // Slider de duração
    const duracaoSlider = document.getElementById('duracao-slider');
    if (duracaoSlider) {
        let debouncedTimerDuracao;
        
        duracaoSlider.addEventListener('input', () => {
            // Atualiza UI imediatamente
            atualizarSliderDuracao();
            
            // Debounce para atualizar contador
            clearTimeout(debouncedTimerDuracao);
            debouncedTimerDuracao = setTimeout(() => {
                atualizarContadorFiltros();
            }, 300);
        });
    }

    // NOVO: Sliders de horário de chegada
    const chegadaMinSlider = document.getElementById('chegada-slider-min');
    const chegadaMaxSlider = document.getElementById('chegada-slider-max');
    
    if (chegadaMinSlider && chegadaMaxSlider) {
        // Função com debounce para evitar excesso de atualizações
        let debouncedTimerChegada;
        
        const atualizarComDebounce = () => {
            // Atualiza UI imediatamente
            atualizarSliderChegada();
            
            // Debounce para atualizar contador
            clearTimeout(debouncedTimerChegada);
            debouncedTimerChegada = setTimeout(() => {
                atualizarContadorFiltros();
            }, 300);
        };
        
        chegadaMinSlider.addEventListener('input', atualizarComDebounce);
        chegadaMaxSlider.addEventListener('input', atualizarComDebounce);
    }
    
    // Slider de preço
    const precoSlider = document.getElementById('preco-slider');
    if (precoSlider) {
        let debouncedTimerPreco;
        
        precoSlider.addEventListener('input', () => {
            // Atualiza UI imediatamente
            atualizarSliderPreco();
            
            // Debounce para atualizar contador
            clearTimeout(debouncedTimerPreco);
            debouncedTimerPreco = setTimeout(() => {
                atualizarContadorFiltros();
            }, 300);
        });
    }
    
    // Toggle de voos diretos
    document.getElementById('filtro-voos-diretos')?.addEventListener('change', atualizarContadorFiltros);
    
    // Expandíveis
    document.querySelectorAll('.filtro-expandivel .filtro-header').forEach(header => {
        header.addEventListener('click', function() {
            const tipo = this.getAttribute('aria-controls').replace('-content', '');
            expandirOpcoesFiltro(tipo, this);
        });
    });
    
    // Botões de ação
    document.getElementById('btn-fechar-filtros')?.addEventListener('click', fecharModalFiltros);
    document.getElementById('btn-limpar-filtros')?.addEventListener('click', limparFiltros);
    document.getElementById('btn-aplicar-filtros')?.addEventListener('click', aplicarFiltros);
    
    // Botão de refazer busca
    document.getElementById('btn-refazer-busca')?.addEventListener('click', () => {
        const filtros = coletarFiltrosAtuais();
        
        // Salva os filtros atualizados
        localStorage.setItem('benetrip_filtros_voos', JSON.stringify(filtros));
        
        // Volta para a página inicial com flag para mostrar formulário
        localStorage.setItem('benetrip_refazer_busca', 'true');
        window.location.href = 'index.html';
    });
}

// Ouvir evento quando resultados estiverem prontos
document.addEventListener('resultadosVoosProntos', function(event) {
    console.log(`Evento recebido: resultadosVoosProntos - ${event.detail.quantidadeVoos} voos`);
    
    // Verifica se há filtros salvos para aplicar automaticamente
    setTimeout(() => {
        const filtrosSalvos = JSON.parse(localStorage.getItem('benetrip_filtros_voos') || '{}');
        
        // Verifica se há filtros ativos
        const temFiltros = (
            filtrosSalvos.voosDiretos || 
            (filtrosSalvos.horarioPartida && (filtrosSalvos.horarioPartida.min > 0 || filtrosSalvos.horarioPartida.max < 1439)) ||
            (filtrosSalvos.horarioChegada && (filtrosSalvos.horarioChegada.min > 0 || filtrosSalvos.horarioChegada.max < 1439)) ||
            (filtrosSalvos.duracaoMaxima && filtrosSalvos.duracaoMaxima < 24) ||
            (filtrosSalvos.precoMaximo && filtrosSalvos.precoMaximo < 100) ||
            (filtrosSalvos.companhias && filtrosSalvos.companhias.length > 0) ||
            (filtrosSalvos.aeroportos && filtrosSalvos.aeroportos.length > 0)
        );
        
        if (temFiltros) {
            // Atualiza o badge no botão de filtros
            atualizarBadgeFiltros();
            
            // Aplica os filtros automaticamente
            if (window.BENETRIP_VOOS?.filtrarResultados) {
                window.BENETRIP_VOOS.filtrarResultados(filtrosSalvos);
                
                const numFiltros = Object.values(filtrosSalvos).filter(v => 
                    v === true || 
                    (Array.isArray(v) && v.length > 0) || 
                    (typeof v === 'object' && Object.values(v).some(x => x !== 0 && x !== 1439))
                ).length;
                
                // Mostra mensagem de filtros aplicados
                if (numFiltros > 0) {
                    setTimeout(() => {
                        exibirToast(`${numFiltros} filtros aplicados automaticamente`, 'info');
                    }, 1000);
                }
            }
        }
        
        // ADICIONAR AQUI: Atualiza os sliders com dados reais
        if (document.getElementById('preco-slider')) {
            setTimeout(() => {
                atualizarSliderPreco();
                console.log('Slider de preço atualizado com dados reais');
            }, 100);
        }
    }, 500);
});

/**
 * Inicialização para navegação de voos - função global
 */
window.inicializarNavegacaoVoos = function() {
    console.log('Inicializando navegação de voos (função global)...');
    configurarNavegacaoCards();
};

/**
 * Função para configurar navegação entre cards de voo
 */
function configurarNavegacaoCards() {
    console.log('Configurando navegação de cards (layout vertical)...');
    const container = document.getElementById('voos-swipe-container');
    if (!container) {
        console.error('Container de voos não encontrado');
        return;
    }
    
    const cards = container.querySelectorAll('.voo-card');
    if (!cards.length) {
        console.error('Nenhum card de voo encontrado para configurar navegação');
        return;
    }
    
    cards.forEach((card, index) => {
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
        
        newCard.addEventListener('click', function(e) {
            if (e.target.closest('button')) return;
            
            document.querySelectorAll('.voo-card').forEach(c => 
                c.classList.remove('voo-card-ativo')
            );
            this.classList.add('voo-card-ativo');
            
            if (window.BENETRIP_VOOS && window.BENETRIP_VOOS.finalResults?.proposals) {
                const vooIndex = parseInt(this.dataset.vooIndex);
                if (!isNaN(vooIndex)) {
                    window.BENETRIP_VOOS.indexVooAtivo = vooIndex;
                    window.BENETRIP_VOOS.vooAtivo = window.BENETRIP_VOOS.finalResults.proposals[vooIndex];
                    window.BENETRIP_VOOS.atualizarBotaoSelecao();
                }
            }
        });
        
        const btnDetalhes = newCard.querySelector('.btn-detalhes-voo');
        if (btnDetalhes) {
            btnDetalhes.addEventListener('click', function(e) {
                e.stopPropagation();
                const vooId = this.dataset.vooId;
                if (vooId) {
                    mostrarDetalhesVoo(vooId);
                }
            });
        }
    });
    
    // Configurar botões de escolha nos cards
    const chooseButtons = document.querySelectorAll('.choose-flight-button');
    if (chooseButtons.length) {
        chooseButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const vooId = this.dataset.vooId;
                if (vooId && window.BENETRIP_VOOS) {
                    window.BENETRIP_VOOS.selecionarVoo(vooId);
                    
                    // Chamar diretamente o processamento, sem mostrar modal
                    if (window.BENETRIP_REDIRECT && typeof window.BENETRIP_REDIRECT.processarConfirmacao === 'function') {
                        window.BENETRIP_REDIRECT.processarConfirmacao(vooId);
                    } else {
                        // Fallback: ir direto para hotéis
                        window.location.href = 'hotels.html';
                    }
                }
            });
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const activeCard = document.querySelector('.voo-card-ativo');
            if (!activeCard) return;
            
            const currentIndex = Array.from(cards).indexOf(activeCard);
            let newIndex = currentIndex;
            
            if (e.key === 'ArrowUp' && currentIndex > 0) {
                newIndex = currentIndex - 1;
            } else if (e.key === 'ArrowDown' && currentIndex < cards.length - 1) {
                newIndex = currentIndex + 1;
            }
            
            if (newIndex !== currentIndex) {
                cards[newIndex].click();
                cards[newIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    });
}

// ======= GESTÃO DE MODAIS =======

/**
 * Modificar a função do BENETRIP_VOOS para adicionar botão de escolha nos cards
 */
function modificarCriarCardVoo() {
    if (!window.BENETRIP_VOOS || !window.BENETRIP_VOOS.criarCardVoo) {
        console.log('BENETRIP_VOOS ainda não disponível, tentando novamente em 100ms');
        setTimeout(modificarCriarCardVoo, 100);
        return;
    }
    
    const funcaoOriginal = window.BENETRIP_VOOS.criarCardVoo;
    
    window.BENETRIP_VOOS.criarCardVoo = function(voo, index) {
        const cardVoo = funcaoOriginal.call(this, voo, index);
        
        if (cardVoo) {
            const footer = cardVoo.querySelector('.voo-card-footer');
            if (footer) {
                const vooId = voo.sign || `voo-idx-${index}`;
                const chooseButton = document.createElement('button');
                chooseButton.className = 'choose-flight-button';
                chooseButton.textContent = 'Escolher Este Voo';
                chooseButton.dataset.vooId = vooId;
                footer.innerHTML = '';
                footer.appendChild(chooseButton);
            }
        }
        
        return cardVoo;
    };
    console.log('Função criarCardVoo modificada para incluir botão de escolha');
}

// Função para carregar templates de modais dinamicamente
function carregarTemplatesModais() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) {
        console.error('Container de modais não encontrado! Criando um novo...');
        const newContainer = document.createElement('div');
        newContainer.id = 'modal-container';
        document.body.appendChild(newContainer);
        modalContainer = newContainer;
    }
    
    console.log('Carregando templates de modais...');
    
    modalContainer.innerHTML = `
        <!-- Templates de modais aqui (sem alteração) -->
        <div id="modal-detalhes-voo" class="modal-backdrop" style="display:none;">
            <!-- conteúdo existente... -->
        </div>

        <div id="modal-confirmacao" class="modal-backdrop" style="display:none;">
            <!-- conteúdo existente... -->
        </div>
    `;
    
    // Verificar se o modal de filtros existe
    if (!document.getElementById('modal-filtros')) {
        console.error('Modal de filtros não encontrado! Verifique o HTML da página.');
    } else {
        console.log('Modal de filtros encontrado, configurando eventos...');
        
        // Configurar eventos dos filtros APÓS carregar os templates
        configurarEventosFiltros();
    }
    
    document.getElementById('modal-confirmacao').style.display = 'none';
    document.getElementById('modal-detalhes-voo').style.display = 'none';
    console.log('Templates de modais carregados e eventos configurados');
}

// Função para mostrar detalhes do voo em modal
function mostrarDetalhesVoo(vooId) {
    if (!window.BENETRIP_VOOS?.finalResults?.proposals) {
        console.error('Dados de voos não disponíveis');
        return;
    }
    
    const voo = window.BENETRIP_VOOS.finalResults.proposals.find(
        (v, index) => (v.sign || `voo-idx-${index}`) === vooId
    );
    
    if (!voo) {
        console.error(`Voo ${vooId} não encontrado`);
        return;
    }
    
    const preco = window.BENETRIP_VOOS.obterPrecoVoo(voo);
    const moeda = window.BENETRIP_VOOS.finalResults?.meta?.currency || 'BRL';
    const infoIda = window.BENETRIP_VOOS.obterInfoSegmento(voo.segment?.[0]);
    const infoVolta = voo.segment?.length > 1 ? window.BENETRIP_VOOS.obterInfoSegmento(voo.segment[1]) : null;
    const companhiaIATA = voo.carriers?.[0];
    const companhiaAerea = window.BENETRIP_VOOS.obterNomeCompanhiaAerea(companhiaIATA);
    
    const detalhesContent = document.getElementById('detalhes-voo-content');
    if (!detalhesContent) {
        console.error('Container de detalhes não encontrado');
        return;
    }
    
    detalhesContent.innerHTML = `
        <div class="detalhes-sumario">
            <div class="detalhes-preco">
                <div class="preco-valor">${window.BENETRIP_VOOS.formatarPreco(preco, moeda)}</div>
                <div class="preco-info">Por pessoa, ida${infoVolta ? ' e volta' : ''}</div>
            </div>
            <div class="detalhes-companhia">
                <div class="companhia-logo">
                    <img src="${getAirlineLogoUrl(companhiaIATA, 60, 60)}" 
                         alt="${companhiaAerea}" 
                         onerror="this.src='${getAirlineLogoUrl('default', 60, 60)}'">
                </div>
                <div class="companhia-nome">${companhiaAerea}</div>
            </div>
        </div>
        <div class="detalhes-secao">
            <div class="secao-header">
                <h4 class="secao-titulo">Ida • ${formatarData(infoIda?.dataPartida)}</h4>
                ${infoIda?.paradas === 0 ? `
                <div class="secao-etiqueta voo-direto">
                    <span class="etiqueta-icone">✈️</span>
                    <span>Voo Direto</span>
                </div>` : ''}
            </div>
            ${renderizarTimelineVoo(voo.segment?.[0]?.flight)}
        </div>
        ${infoVolta ? `
        <div class="detalhes-secao">
            <div class="secao-header">
                <h4 class="secao-titulo">Volta • ${formatarData(infoVolta.dataPartida)}</h4>
                ${infoVolta.paradas === 0 ? `
                <div class="secao-etiqueta voo-direto">
                    <span class="etiqueta-icone">✈️</span>
                    <span>Voo Direto</span>
                </div>` : ''}
            </div>
            ${renderizarTimelineVoo(voo.segment?.[1]?.flight)}
        </div>
        ` : ''}
        <div class="detalhes-secao">
            <h4 class="secao-titulo">Serviços Incluídos</h4>
            <div class="servicos-grid">
                <div class="servico-item incluido">
                    <span class="servico-icone">🧳</span>
                    <span class="servico-nome">1 Bagagem de Mão</span>
                </div>
                <div class="servico-item incluido">
                    <span class="servico-icone">🍽️</span>
                    <span class="servico-nome">Refeição a Bordo</span>
                </div>
                <div class="servico-item incluido">
                    <span class="servico-icone">🔄</span>
                    <span class="servico-nome">Remarcação Flexível</span>
                </div>
                <div class="servico-item opcional">
                    <span class="servico-icone">💼</span>
                    <span class="servico-nome">Bagagem Despachada</span>
                </div>
                <div class="servico-item opcional">
                    <span class="servico-icone">🪑</span>
                    <span class="servico-nome">Escolha de Assento</span>
                </div>
            </div>
        </div>
        <div class="detalhes-secao">
            <div class="secao-header">
                <h4 class="secao-titulo">Política de Cancelamento</h4>
                <div class="politica-toggle">
                    <span class="politica-icone">▼</span>
                </div>
            </div>
            <div class="politica-conteudo">
                <p class="politica-texto">
                    Cancelamento até 24h antes da partida: cobrança de taxa de ${window.BENETRIP_VOOS.formatarPreco(350, moeda)} por passageiro.
                    Cancelamento em menos de 24h: não reembolsável.
                </p>
            </div>
        </div>
    `;
    
    const modal = document.getElementById('modal-detalhes-voo');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('modal-active');
        }, 10);
        configurarBotoesDetalhesVoo(vooId);
    }
}

// Função para renderizar timeline do voo
function renderizarTimelineVoo(voos) {
    if (!voos || !Array.isArray(voos) || voos.length === 0) {
        return '<p>Informações de voo não disponíveis</p>';
    }
    
    let html = '';
    for (let i = 0; i < voos.length; i++) {
        const voo = voos[i];
        const ultimo = i === voos.length - 1;
        
        html += `
            <div class="timeline-voo">
                <div class="timeline-item">
                    <div class="timeline-ponto partida">
                        <div class="timeline-tempo">${voo.departure_time || '--:--'}</div>
                        <div class="timeline-local">
                            <div class="timeline-codigo">${voo.departure || '---'}</div>
                            <div class="timeline-cidade">${obterNomeCidade(voo.departure) || 'Origem'}</div>
                        </div>
                    </div>
                    <div class="timeline-linha">
                        <div class="duracao-badge">${formatarDuracao(voo.duration || 0)}</div>
                    </div>
                    <div class="timeline-ponto chegada">
                        <div class="timeline-tempo">${voo.arrival_time || '--:--'}</div>
                        <div class="timeline-local">
                            <div class="timeline-codigo">${voo.arrival || '---'}</div>
                            <div class="timeline-cidade">${obterNomeCidade(voo.arrival) || 'Destino'}</div>
                        </div>
                    </div>
                </div>
                <div class="voo-info">
                    <div class="info-item">
                        <span class="info-icone">🛫</span>
                        <span class="info-texto">
                            <img src="${getAirlineLogoUrl(voo.marketing_carrier, 16, 16)}" 
                                 alt="" class="inline-airline-logo">
                            Voo ${voo.marketing_carrier || ''}${voo.number || ''}
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-icone">🪑</span>
                        <span class="info-texto">Classe Econômica</span>
                    </div>
                    ${voo.aircraft ? `
                    <div class="info-item">
                        <span class="info-icone">✓</span>
                        <span class="info-texto">Aeronave: ${voo.aircraft}</span>
                    </div>` : ''}
                </div>
            </div>
        `;
        
        if (!ultimo && voos[i+1]) {
            let tempoConexao = 60;
            if (voo.arrival_time && voos[i+1].departure_time) {
                const [horaC, minC] = voo.arrival_time.split(':').map(Number);
                const [horaP, minP] = voos[i+1].departure_time.split(':').map(Number);
                if (!isNaN(horaC) && !isNaN(minC) && !isNaN(horaP) && !isNaN(minP)) {
                    const minutosC = horaC * 60 + minC;
                    const minutosP = horaP * 60 + minP;
                    tempoConexao = minutosP - minutosC;
                    if (tempoConexao < 0) tempoConexao += 24 * 60;
                }
            }
            html += `
                <div style="text-align: center; margin: 8px 0; color: #E87722; font-size: 0.8rem; font-weight: 500;">
                    <span>⏱️</span> Conexão em ${voo.arrival} • ${formatarDuracao(tempoConexao)}
                </div>
            `;
        }
    }
    return html;
}

// Função para obter nome da cidade a partir do código do aeroporto
function obterNomeCidade(codigoAeroporto) {
    if (!codigoAeroporto || !window.BENETRIP_VOOS) return '';
    const aeroporto = window.BENETRIP_VOOS.accumulatedAirports?.[codigoAeroporto];
    if (aeroporto?.city) return aeroporto.city;
    const finalAeroporto = window.BENETRIP_VOOS.finalResults?.airports?.[codigoAeroporto];
    return finalAeroporto?.city || '';
}

// Função para exibir toasts
function exibirToast(mensagem, tipo = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const existingToasts = toastContainer.querySelectorAll('.toast');
    existingToasts.forEach(toast => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    });
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensagem;
    
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ======= CONFIGURAÇÃO DE EVENTOS =======

// Configurar botões do modal de detalhes do voo
function configurarBotoesDetalhesVoo(vooId) {
    const btnFechar = document.getElementById('btn-fechar-detalhes');
    if (btnFechar) {
        btnFechar.onclick = () => {
            if (typeof window.fecharModal === 'function') {
                window.fecharModal('modal-detalhes-voo');
            }
        };
    }
    
    const btnVoltar = document.getElementById('btn-voltar-lista');
    if (btnVoltar) {
        btnVoltar.onclick = () => {
            if (typeof window.fecharModal === 'function') {
                window.fecharModal('modal-detalhes-voo');
            }
        };
    }
    
    const btnSelecionar = document.getElementById('btn-selecionar-este-voo');
    if (btnSelecionar) {
        btnSelecionar.onclick = () => {
            if (typeof window.fecharModal === 'function') {
                window.fecharModal('modal-detalhes-voo');
            }
            
            if (window.BENETRIP_VOOS && vooId) {
                window.BENETRIP_VOOS.selecionarVoo(vooId);
                if (typeof window.mostrarConfirmacaoSelecao === 'function') {
                    window.mostrarConfirmacaoSelecao();
                }
            }
        };
    }
    
    const politicaToggle = document.querySelector('.politica-toggle');
    const politicaConteudo = document.querySelector('.politica-conteudo');
    if (politicaToggle && politicaConteudo) {
        politicaToggle.onclick = function() {
            const icone = this.querySelector('.politica-icone');
            if (politicaConteudo.style.display === 'none') {
                politicaConteudo.style.display = 'block';
                icone.textContent = '▼';
            } else {
                politicaConteudo.style.display = 'none';
                icone.textContent = '▶';
            }
        };
    }
    
    const modal = document.getElementById('modal-detalhes-voo');
    if (modal) {
        modal.onclick = function(e) {
            if (e.target === modal) {
                if (typeof window.fecharModal === 'function') {
                    window.fecharModal('modal-detalhes-voo');
                }
            }
        };
    }
}

// Configura eventos gerais da interface
function configurarEventosInterface() {
    const btnVoltar = document.querySelector('.btn-voltar');
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            window.location.href = 'destinos.html';
        });
    }
    
    const btnSelecionar = document.querySelector('.btn-selecionar-voo');
    if (btnSelecionar) {
        btnSelecionar.addEventListener('click', () => {
            if (window.BENETRIP_VOOS?.vooSelecionado) {
                if (typeof window.mostrarConfirmacaoSelecao === 'function') {
                    window.mostrarConfirmacaoSelecao();
                }
            } else if (window.BENETRIP_VOOS?.vooAtivo) {
                window.BENETRIP_VOOS.selecionarVooAtivo();
                if (typeof window.mostrarConfirmacaoSelecao === 'function') {
                    window.mostrarConfirmacaoSelecao();
                }
            } else {
                exibirToast('Selecione um voo primeiro', 'warning');
            }
        });
    }
    
    document.addEventListener('click', (event) => {
        const btnDetalhes = event.target.closest('.btn-detalhes-voo');
        if (btnDetalhes) {
            const vooId = btnDetalhes.dataset.vooId;
            if (vooId) {
                mostrarDetalhesVoo(vooId);
            }
            return;
        }
        
        const vooCard = event.target.closest('.voo-card');
        if (vooCard && !event.target.closest('button')) {
            const vooId = vooCard.dataset.vooId;
            const vooIndex = vooCard.dataset.vooIndex;
            
            document.querySelectorAll('.voo-card').forEach(c => 
                c.classList.remove('voo-card-ativo')
            );
            vooCard.classList.add('voo-card-ativo');
            
            if (window.BENETRIP_VOOS && window.BENETRIP_VOOS.finalResults?.proposals) {
                const index = parseInt(vooIndex);
                if (!isNaN(index)) {
                    window.BENETRIP_VOOS.indexVooAtivo = index;
                    window.BENETRIP_VOOS.vooAtivo = window.BENETRIP_VOOS.finalResults.proposals[index];
                    window.BENETRIP_VOOS.atualizarBotaoSelecao();
                }
            }
        }
    });
}

// Adicionar eventos para ouvir quando os resultados estiverem prontos
document.addEventListener('resultadosVoosProntos', function(event) {
    console.log(`Evento recebido: resultadosVoosProntos - ${event.detail.quantidadeVoos} voos`);
    setTimeout(() => {
        configurarNavegacaoCards();
    }, 100);
});

// Adicionar evento para mostrar detalhes do voo
document.addEventListener('mostrarDetalhesVoo', function(event) {
    const vooId = event.detail.vooId;
    if (vooId) {
        mostrarDetalhesVoo(vooId);
    }
});

// Navegação por teclado para acessibilidade
document.addEventListener('keydown', function(event) {
    if (!document.getElementById('voos-swipe-container')) return;
    
    switch(event.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
            if (window.BENETRIP_VOOS) window.BENETRIP_VOOS.vooAnterior();
            break;
        case 'ArrowDown':
        case 'ArrowRight':
            if (window.BENETRIP_VOOS) window.BENETRIP_VOOS.proximoVoo();
            break;
        case 'Enter':
            if (window.BENETRIP_VOOS) window.BENETRIP_VOOS.selecionarVooAtivo();
            break;
    }
});

// ======= INICIALIZAÇÃO =======

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado - inicializando interface de voos com layout vertical...');
    
    aplicarEstilosVerticais();
    adicionarBotaoCustomizacao();
    modificarCriarCardVoo();
    carregarTemplatesModais();
    configurarEventosInterface();
    
    if (typeof window.BENETRIP_VOOS !== 'undefined' && 
        !window.BENETRIP_VOOS.estaCarregando && 
        window.BENETRIP_VOOS.finalResults) {
        console.log('BENETRIP_VOOS já tem resultados - configurando navegação imediatamente');
        configurarNavegacaoCards();
    } else {
        console.log('Aguardando BENETRIP_VOOS carregar dados...');
    }
    
    // Inicializa o contador de filtros
    atualizarBadgeFiltros();
});
