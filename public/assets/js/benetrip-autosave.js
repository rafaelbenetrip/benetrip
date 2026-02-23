/**
 * ============================================
 * BENETRIP AUTO-SAVE MODULE - benetrip-autosave.js
 * ============================================
 * Salva automaticamente pesquisas, destinos e roteiros
 * quando o usuário está logado. Zero fricção — sem botões "Salvar".
 * 
 * COMO USAR:
 * 1. Incluir APÓS benetrip-auth.js em cada página
 * 2. Chamar os métodos nos pontos corretos de cada página:
 *    - BenetripAutoSave.salvarBuscaDestinos(formData, resultados)
 *    - BenetripAutoSave.salvarBuscaTodosDestinos(formData, destinos)
 *    - BenetripAutoSave.salvarBuscaVoos(formData, resultados)
 *    - BenetripAutoSave.salvarRoteiro(dadosRoteiro)
 * 
 * O módulo verifica internamente se o usuário está logado.
 * Se não estiver, simplesmente ignora (sem erros, sem prompts).
 */

const BenetripAutoSave = (function () {
    'use strict';

    // ── Controle de duplicatas ──
    // Evita salvar a mesma busca/resultado mais de uma vez na sessão
    const _savedHashes = new Set();

    function _hash(obj) {
        try {
            const str = JSON.stringify(obj);
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash |= 0; // Convert to 32bit int
            }
            return hash.toString(36);
        } catch {
            return Date.now().toString(36);
        }
    }

    function _isDuplicate(key) {
        if (_savedHashes.has(key)) return true;
        _savedHashes.add(key);
        return false;
    }

    // ── Verificação de auth ──
    function _isLoggedIn() {
        return typeof BenetripAuth !== 'undefined' && BenetripAuth.isLoggedIn();
    }

    // ── Logger ──
    function _log(...args) {
        console.log('[AutoSave]', ...args);
    }

    // ==========================================
    // 1. DESCOBRIR DESTINOS (descobrir-destinos.html)
    // ==========================================
    // Chamado após mostrarResultados() com sucesso
    async function salvarBuscaDestinos(formData, resultados) {
        if (!_isLoggedIn()) return null;

        const hashKey = `destinos_${_hash({
            origem: formData.origem?.code,
            dataIda: formData.dataIda,
            dataVolta: formData.dataVolta,
            preferencias: formData.preferencias
        })}`;

        if (_isDuplicate(hashKey)) {
            _log('⏭️ Busca de destinos já salva nesta sessão');
            return null;
        }

        try {
            // Salvar busca no histórico
            const resumoResultados = {
                top_destino: resultados.top_destino ? {
                    name: resultados.top_destino.name,
                    country: resultados.top_destino.country,
                    price: resultados.top_destino.flight?.price,
                    airport: resultados.top_destino.primary_airport
                } : null,
                alternativas: (resultados.alternativas || []).map(d => ({
                    name: d.name,
                    country: d.country,
                    price: d.flight?.price,
                    airport: d.primary_airport
                })),
                surpresa: resultados.surpresa ? {
                    name: resultados.surpresa.name,
                    country: resultados.surpresa.country,
                    price: resultados.surpresa.flight?.price,
                    airport: resultados.surpresa.primary_airport
                } : null,
                total_analisados: resultados._totalAnalisados || 0,
                model: resultados._model || ''
            };

            const result = await BenetripAuth.saveSearch('descobrir_destinos', {
                origem: formData.origem,
                dataIda: formData.dataIda,
                dataVolta: formData.dataVolta,
                companhia: formData.companhia,
                adultos: formData.adultos,
                criancas: formData.criancas,
                bebes: formData.bebes,
                preferencias: formData.preferencias,
                escopoDestino: formData.escopoDestino,
                moeda: formData.moeda,
                orcamento: formData.orcamento
            }, resumoResultados);

            _log('✅ Busca "Descobrir Destinos" salva automaticamente');

            // Salvar o top destino como destino salvo automaticamente
            if (resultados.top_destino) {
                await _salvarDestinoAutomatico(resultados.top_destino, formData, 'top_destino');
            }

            return result;
        } catch (e) {
            _log('⚠️ Erro ao auto-salvar busca destinos:', e.message);
            return null;
        }
    }

    // ==========================================
    // 2. TODOS OS DESTINOS (todos-destinos.html)
    // ==========================================
    async function salvarBuscaTodosDestinos(formData, destinos) {
        if (!_isLoggedIn()) return null;

        const hashKey = `todos_${_hash({
            origem: formData.origem?.code,
            dataIda: formData.dataIda,
            dataVolta: formData.dataVolta,
            moeda: formData.moeda
        })}`;

        if (_isDuplicate(hashKey)) {
            _log('⏭️ Busca "Todos Destinos" já salva nesta sessão');
            return null;
        }

        try {
            const top10 = destinos.slice(0, 10).map(d => ({
                name: d.name,
                country: d.country,
                price: d.flight?.price,
                airport: d.primary_airport || d.flight?.airport_code,
                stops: d.flight?.stops
            }));

            const result = await BenetripAuth.saveSearch('todos_destinos', {
                origem: formData.origem,
                dataIda: formData.dataIda,
                dataVolta: formData.dataVolta,
                modoData: formData.modoData,
                combinacoes: formData.combinacoes?.length || 1,
                moeda: formData.moeda,
                escopo: formData.escopo,
                orcamento: formData.orcamento
            }, {
                total_encontrados: destinos.length,
                dentro_orcamento: destinos.filter(d => d.flight?.price <= formData.orcamento).length,
                top_10: top10,
                preco_min: destinos.length > 0 ? Math.min(...destinos.map(d => d.flight?.price || Infinity)) : 0,
                preco_max: destinos.length > 0 ? Math.max(...destinos.map(d => d.flight?.price || 0)) : 0
            });

            _log('✅ Busca "Todos Destinos" salva automaticamente');
            return result;
        } catch (e) {
            _log('⚠️ Erro ao auto-salvar busca todos destinos:', e.message);
            return null;
        }
    }

    // ==========================================
    // 3. BUSCA DE VOOS (voos.html)
    // ==========================================
    async function salvarBuscaVoos(parametros, resultados) {
        if (!_isLoggedIn()) return null;

        const hashKey = `voos_${_hash({
            origem: parametros.origem,
            destino: parametros.destino,
            dataIda: parametros.dataIda
        })}`;

        if (_isDuplicate(hashKey)) {
            _log('⏭️ Busca de voos já salva nesta sessão');
            return null;
        }

        try {
            const resumo = {
                total_resultados: resultados?.length || resultados?.total || 0,
                melhor_preco: resultados?.melhor_preco || (Array.isArray(resultados) && resultados.length > 0
                    ? Math.min(...resultados.map(r => r.price || r.total || Infinity))
                    : null
                )
            };

            const result = await BenetripAuth.saveSearch('busca_voos', parametros, resumo);

            _log('✅ Busca de voos salva automaticamente');
            return result;
        } catch (e) {
            _log('⚠️ Erro ao auto-salvar busca voos:', e.message);
            return null;
        }
    }

    // ==========================================
    // 4. VOOS BARATOS (voos-baratos.html)
    // ==========================================
    async function salvarBuscaVoosBaratos(parametros, resultados) {
        if (!_isLoggedIn()) return null;

        const hashKey = `voos_baratos_${_hash({
            origem: parametros.origem,
            destino: parametros.destino
        })}`;

        if (_isDuplicate(hashKey)) return null;

        try {
            const result = await BenetripAuth.saveSearch('voos_baratos', parametros, {
                total: resultados?.length || 0,
                melhor_preco: resultados?.[0]?.price || null
            });
            _log('✅ Busca de voos baratos salva');
            return result;
        } catch (e) {
            _log('⚠️ Erro ao salvar voos baratos:', e.message);
            return null;
        }
    }

    // ==========================================
    // 5. ROTEIRO / ITINERÁRIO (itinerary2.html)
    // ==========================================
    async function salvarRoteiro(dados) {
        if (!_isLoggedIn()) return null;

        const hashKey = `roteiro_${_hash({
            destino: dados.destino_nome,
            dataIda: dados.data_ida,
            dataVolta: dados.data_volta
        })}`;

        if (_isDuplicate(hashKey)) {
            _log('⏭️ Roteiro já salvo nesta sessão');
            return null;
        }

        try {
            const result = await BenetripAuth.saveItinerary({
                destino_nome: dados.destino_nome,
                destino_pais: dados.destino_pais || '',
                data_ida: dados.data_ida,
                data_volta: dados.data_volta,
                num_dias: dados.num_dias || 0,
                dados_roteiro: dados.dados_roteiro || dados
            });

            _log('✅ Roteiro salvo automaticamente');

            // Mostrar toast discreto para o usuário
            _showSaveToast('Roteiro salvo automaticamente! 🐾');

            return result;
        } catch (e) {
            _log('⚠️ Erro ao salvar roteiro:', e.message);
            return null;
        }
    }

    // ==========================================
    // HELPER: Salvar destino automaticamente
    // ==========================================
    async function _salvarDestinoAutomatico(destino, formData, tipo) {
        if (!_isLoggedIn() || !destino) return;

        try {
            await BenetripAuth.saveDestination({
                destino_nome: destino.name || '',
                destino_pais: destino.country || '',
                iata_code: destino.primary_airport || '',
                preco_encontrado: destino.flight?.price || 0,
                moeda_preco: formData.moeda || 'BRL',
                imagem_url: destino.image_url || '',
                dados_busca: {
                    tipo: tipo,
                    origem: formData.origem?.code,
                    dataIda: formData.dataIda,
                    dataVolta: formData.dataVolta,
                    razao: destino.razao || '',
                    comentario: destino.comentario || '',
                    stops: destino.flight?.stops
                },
                notas: `${tipo === 'top_destino' ? '🏆 Top Pick' : tipo === 'surpresa' ? '🎁 Surpresa' : '📋 Alternativa'} — auto-salvo`
            });
            _log(`✅ Destino "${destino.name}" salvo automaticamente`);
        } catch (e) {
            // Pode dar erro de duplicata, ignorar
            _log(`⚠️ Destino "${destino.name}" já salvo ou erro:`, e.message);
        }
    }

    // ==========================================
    // SALVAR DESTINO MANUALMENTE (botão)
    // ==========================================
    async function salvarDestino(destino, formData) {
        if (!_isLoggedIn()) {
            // Abrir modal de login
            if (typeof BenetripLoginModal !== 'undefined') {
                BenetripLoginModal.open();
            } else {
                alert('Faça login para salvar destinos!');
            }
            return null;
        }

        try {
            const result = await BenetripAuth.saveDestination({
                destino_nome: destino.name || '',
                destino_pais: destino.country || '',
                iata_code: destino.primary_airport || destino.iata || '',
                preco_encontrado: destino.flight?.price || destino.price || 0,
                moeda_preco: formData?.moeda || 'BRL',
                imagem_url: destino.image_url || '',
                dados_busca: {
                    origem: formData?.origem?.code,
                    dataIda: formData?.dataIda,
                    dataVolta: formData?.dataVolta,
                    razao: destino.razao || '',
                    stops: destino.flight?.stops
                },
                notas: ''
            });

            _showSaveToast(`${destino.name} salvo! 🐾`);
            return result;
        } catch (e) {
            if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
                _showSaveToast(`${destino.name} já está salvo! ✅`);
            } else {
                _showSaveToast('Erro ao salvar. Tente novamente.');
            }
            return null;
        }
    }

    // ==========================================
    // TOAST NOTIFICATION (discreto)
    // ==========================================
    function _showSaveToast(message) {
        // Remover toast anterior se existir
        const existing = document.getElementById('benetrip-save-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'benetrip-save-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: #21272A;
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            font-family: 'Montserrat', sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 10001;
            opacity: 0;
            transition: all 0.3s ease;
            pointer-events: none;
            white-space: nowrap;
        `;

        document.body.appendChild(toast);

        // Animar entrada
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });

        // Animar saída
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================
    return {
        salvarBuscaDestinos,
        salvarBuscaTodosDestinos,
        salvarBuscaVoos,
        salvarBuscaVoosBaratos,
        salvarRoteiro,
        salvarDestino,
        // Helpers para uso externo
        isLoggedIn: _isLoggedIn,
        showToast: _showSaveToast
    };

})();

window.BenetripAutoSave = BenetripAutoSave;
