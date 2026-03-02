/**
 * ============================================
 * BENETRIP AUTO-SAVE MODULE v2.0
 * ============================================
 * Salva automaticamente TODAS as simulações do usuário
 * em cada uma das 6 ferramentas da Benetrip.
 *
 * FERRAMENTAS COBERTAS:
 *  1. Descobrir Destinos  (descobrir-destinos.html)
 *  2. Todos os Destinos   (todos-destinos.html)
 *  3. Comparar Voos       (comparar-voos.html)   ← NOVO
 *  4. Voos Baratos        (voos-baratos.html)
 *  5. Busca de Voos       (voos.html)
 *  6. Roteiro de Viagem   (roteiro-viagem.html)
 *
 * COMO USAR:
 *  Incluir APÓS benetrip-auth.js em cada página.
 *  Chamar o método correspondente no callback de sucesso de cada ferramenta.
 *
 * O módulo verifica internamente se o usuário está logado.
 * Se não estiver, simplesmente ignora (zero fricção).
 */

const BenetripAutoSave = (function () {
    'use strict';

    // ── Controle de duplicatas por sessão ──
    const _savedHashes = new Set();

    function _hash(obj) {
        try {
            const str = JSON.stringify(obj);
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash |= 0;
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

    function _isLoggedIn() {
        return typeof BenetripAuth !== 'undefined' && BenetripAuth.isLoggedIn();
    }

    function _log(...args) {
        console.log('[AutoSave]', ...args);
    }

    // ================================================================
    // 1. DESCOBRIR DESTINOS (descobrir-destinos.html)
    // ================================================================
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
            const _mapDestino = (d) => d ? {
                name: d.name || '',
                country: d.country || '',
                price: d.flight?.price || null,
                airport: d.primary_airport || d.flight?.airport_code || '',
                stops: d.flight?.stops ?? null,
                razao: d.razao || '',
                comentario: d.comentario || '',
                destaque: d.destaque || '',
                image_url: d.image_url || ''
            } : null;

            const resumoResultados = {
                top_destino: _mapDestino(resultados.top_destino),
                alternativas: (resultados.alternativas || []).map(_mapDestino),
                surpresa: _mapDestino(resultados.surpresa),
                total_analisados: resultados._totalAnalisados || 0,
                model: resultados._model || '',
                timestamp: new Date().toISOString()
            };

            const result = await BenetripAuth.saveSearch('descobrir_destinos', {
                origem: formData.origem,
                dataIda: formData.dataIda,
                dataVolta: formData.dataVolta,
                companhia: formData.companhia,
                adultos: formData.adultos || 1,
                criancas: formData.criancas || 0,
                bebes: formData.bebes || 0,
                preferencias: formData.preferencias,
                escopoDestino: formData.escopoDestino || 'tanto_faz',
                moeda: formData.moeda || 'BRL',
                orcamento: formData.orcamento,
                observacoes: formData.observacoes || ''
            }, resumoResultados);

            _log('✅ Busca "Descobrir Destinos" salva automaticamente');

            if (resultados.top_destino) {
                await _salvarDestinoAutomatico(resultados.top_destino, formData, 'top_destino');
            }

            return result;
        } catch (e) {
            _log('⚠️ Erro ao auto-salvar busca destinos:', e.message);
            return null;
        }
    }

    // ================================================================
    // 2. TODOS OS DESTINOS (todos-destinos.html)
    // ================================================================
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
            const allDestinos = destinos || [];
            const top20 = allDestinos.slice(0, 20).map(d => ({
                name: d.name || d.destination || '',
                country: d.country || '',
                price: d.flight?.price || d.price || null,
                airport: d.primary_airport || d.flight?.airport_code || d.iata || '',
                stops: d.flight?.stops ?? null,
                departure_date: d.flight?.departure_date || '',
                return_date: d.flight?.return_date || ''
            }));

            const result = await BenetripAuth.saveSearch('todos_destinos', {
                origem: formData.origem,
                dataIda: formData.dataIda,
                dataVolta: formData.dataVolta,
                datasIda: formData.datasIda || [],
                datasVolta: formData.datasVolta || [],
                modoData: formData.modoData || 'unica',
                combinacoes: formData.combinacoes?.length || 1,
                moeda: formData.moeda || 'BRL',
                escopo: formData.escopo || 'todos',
                orcamento: formData.orcamento
            }, {
                total_encontrados: allDestinos.length,
                dentro_orcamento: allDestinos.filter(d =>
                    (d.flight?.price || d.price || Infinity) <= formData.orcamento
                ).length,
                top_20: top20,
                preco_min: allDestinos.length > 0
                    ? Math.min(...allDestinos.map(d => d.flight?.price || d.price || Infinity))
                    : 0,
                preco_max: allDestinos.length > 0
                    ? Math.max(...allDestinos.map(d => d.flight?.price || d.price || 0))
                    : 0,
                timestamp: new Date().toISOString()
            });

            _log('✅ Busca "Todos Destinos" salva automaticamente');
            return result;
        } catch (e) {
            _log('⚠️ Erro ao auto-salvar busca todos destinos:', e.message);
            return null;
        }
    }

    // ================================================================
    // 3. COMPARAR VOOS (comparar-voos.html)  ← NOVO
    // ================================================================
    async function salvarCompararVoos(formData, resultados) {
        if (!_isLoggedIn()) return null;

        const hashKey = `comparar_${_hash({
            origem: formData.origem?.code || formData.origem,
            destino: formData.destino?.code || formData.destino,
            datasIda: formData.datasIda,
            datasVolta: formData.datasVolta
        })}`;

        if (_isDuplicate(hashKey)) {
            _log('⏭️ Comparação de voos já salva nesta sessão');
            return null;
        }

        try {
            const combos = (resultados.combinacoes || []).map(c => ({
                dataIda: c.dataIda || c.departure || '',
                dataVolta: c.dataVolta || c.return || '',
                preco: c.preco || c.price || null,
                duracao_ida: c.duracao_ida || c.outbound_duration || '',
                duracao_volta: c.duracao_volta || c.return_duration || '',
                paradas_ida: c.paradas_ida ?? c.outbound_stops ?? null,
                paradas_volta: c.paradas_volta ?? c.return_stops ?? null,
                companhias: c.companhias || c.airlines || [],
                link: c.link || c.booking_url || ''
            }));

            const melhor = resultados.melhor || (combos.length > 0
                ? combos.reduce((a, b) => (a.preco || Infinity) < (b.preco || Infinity) ? a : b)
                : null);

            const precos = combos.map(c => c.preco).filter(p => p != null && isFinite(p));

            const result = await BenetripAuth.saveSearch('comparar_voos', {
                origem: formData.origem,
                destino: formData.destino,
                datasIda: formData.datasIda || [],
                datasVolta: formData.datasVolta || [],
                adultos: formData.adultos || 1,
                criancas: formData.criancas || 0,
                bebes: formData.bebes || 0,
                moeda: formData.moeda || 'BRL',
                total_combinacoes: (formData.datasIda?.length || 0) * (formData.datasVolta?.length || 0)
            }, {
                combinacoes: combos,
                melhor_combo: melhor ? {
                    dataIda: melhor.dataIda || melhor.departure || '',
                    dataVolta: melhor.dataVolta || melhor.return || '',
                    preco: melhor.preco || melhor.price || null
                } : null,
                total_resultados: combos.length,
                preco_min: precos.length > 0 ? Math.min(...precos) : null,
                preco_max: precos.length > 0 ? Math.max(...precos) : null,
                economia: precos.length > 1 ? (Math.max(...precos) - Math.min(...precos)) : 0,
                timestamp: new Date().toISOString()
            });

            _log('✅ Comparação de voos salva automaticamente');
            return result;
        } catch (e) {
            _log('⚠️ Erro ao auto-salvar comparação de voos:', e.message);
            return null;
        }
    }

    // ================================================================
    // 4. VOOS BARATOS (voos-baratos.html)
    // ================================================================
    async function salvarBuscaVoosBaratos(formData, resultados) {
        if (!_isLoggedIn()) return null;

        const hashKey = `voos_baratos_${_hash({
            origem: formData.origem?.code || formData.origem,
            destino: formData.destino?.code || formData.destino,
            duracao: formData.duracao
        })}`;

        if (_isDuplicate(hashKey)) return null;

        try {
            const periodos = (resultados || []).map(r => ({
                dataIda: r.dataIda || r.departureDate || r.departure || '',
                dataVolta: r.dataVolta || r.returnDate || r.return || '',
                preco: r.preco || r.price || null,
                companhia: r.companhia || r.airline || '',
                link: r.link || r.booking_url || ''
            }));

            const melhor = periodos.length > 0
                ? periodos.reduce((a, b) => (a.preco || Infinity) < (b.preco || Infinity) ? a : b)
                : null;

            const precos = periodos.map(p => p.preco).filter(p => p != null && isFinite(p));

            const result = await BenetripAuth.saveSearch('voos_baratos', {
                origem: formData.origem,
                destino: formData.destino,
                duracao: formData.duracao || 7,
                moeda: formData.moeda || 'BRL'
            }, {
                total_periodos: periodos.length,
                periodos: periodos.slice(0, 30),
                melhor_periodo: melhor,
                preco_min: precos.length > 0 ? Math.min(...precos) : null,
                preco_max: precos.length > 0 ? Math.max(...precos) : null,
                timestamp: new Date().toISOString()
            });

            _log('✅ Busca de voos baratos salva');
            return result;
        } catch (e) {
            _log('⚠️ Erro ao salvar voos baratos:', e.message);
            return null;
        }
    }

    // ================================================================
    // 5. BUSCA DE VOOS (voos.html)
    // ================================================================
    async function salvarBuscaVoos(formData, resultados) {
        if (!_isLoggedIn()) return null;

        const hashKey = `voos_${_hash({
            origem: formData.origemCode || formData.origem,
            destino: formData.destinoCode || formData.destino,
            dataIda: formData.dataIda
        })}`;

        if (_isDuplicate(hashKey)) {
            _log('⏭️ Busca de voos já salva nesta sessão');
            return null;
        }

        try {
            const voos = Array.isArray(resultados) ? resultados : (resultados?.data || []);

            const top10 = voos.slice(0, 10).map(v => ({
                preco: v.price || v.total || null,
                companhias: v.airlines || v.carriers || [],
                paradas_ida: v.outbound_stops ?? v.stops_go ?? null,
                paradas_volta: v.return_stops ?? v.stops_ret ?? null,
                duracao_ida: v.outbound_duration || v.duration_go || '',
                duracao_volta: v.return_duration || v.duration_ret || '',
                partida_ida: v.outbound_departure || '',
                chegada_ida: v.outbound_arrival || '',
                link: v.link || v.booking_url || v.deep_link || ''
            }));

            const precos = voos.map(v => v.price || v.total).filter(p => p != null && isFinite(p));
            const melhorPreco = precos.length > 0 ? Math.min(...precos) : null;

            const result = await BenetripAuth.saveSearch('busca_voos', {
                origem: formData.origem || '',
                origemCode: formData.origemCode || '',
                destino: formData.destino || '',
                destinoCode: formData.destinoCode || '',
                dataIda: formData.dataIda,
                dataVolta: formData.dataVolta || '',
                adultos: formData.adultos || 1,
                criancas: formData.criancas || 0,
                bebes: formData.bebes || 0,
                moeda: formData.moeda || 'BRL'
            }, {
                total_resultados: voos.length,
                melhor_preco: melhorPreco,
                top_10_voos: top10,
                companhias_encontradas: [...new Set(voos.flatMap(v => v.airlines || v.carriers || []))],
                tem_direto: voos.some(v => (v.outbound_stops || v.stops_go || 0) === 0),
                timestamp: new Date().toISOString()
            });

            _log('✅ Busca de voos salva automaticamente');
            return result;
        } catch (e) {
            _log('⚠️ Erro ao auto-salvar busca voos:', e.message);
            return null;
        }
    }

    // ================================================================
    // 6. ROTEIRO DE VIAGEM (roteiro-viagem.html)
    // ================================================================
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
            const itinerary = await BenetripAuth.saveItinerary({
                destino_nome: dados.destino_nome || '',
                destino_pais: dados.destino_pais || '',
                data_ida: dados.data_ida,
                data_volta: dados.data_volta,
                num_dias: dados.num_dias || 0,
                dados_roteiro: dados.dados_roteiro || dados
            });

            // Também salvar no histórico para feed unificado
            await BenetripAuth.saveSearch('roteiro', {
                destino: dados.destino_nome || '',
                pais: dados.destino_pais || '',
                dataIda: dados.data_ida,
                dataVolta: dados.data_volta,
                numDias: dados.num_dias || 0,
                companhia: dados.companhia || '',
                preferencias: dados.preferencias || '',
                intensidade: dados.intensidade || '',
                orcamento: dados.orcamento || '',
                observacoes: dados.observacoes || ''
            }, {
                num_dias: dados.num_dias || 0,
                destino: dados.destino_nome || '',
                pais: dados.destino_pais || '',
                dias: _extrairResumoDias(dados.dados_roteiro),
                itinerary_id: itinerary?.id || null,
                timestamp: new Date().toISOString()
            });

            _log('✅ Roteiro salvo automaticamente');
            _showSaveToast('Roteiro salvo automaticamente! 🐾');
            return itinerary;
        } catch (e) {
            _log('⚠️ Erro ao salvar roteiro:', e.message);
            return null;
        }
    }

    // ================================================================
    // HELPERS
    // ================================================================

    function _extrairResumoDias(dadosRoteiro) {
        if (!dadosRoteiro) return [];
        try {
            const dias = dadosRoteiro.dias || dadosRoteiro.days || dadosRoteiro.itinerario || [];
            if (!Array.isArray(dias)) return [];
            return dias.map((dia, i) => ({
                dia: dia.dia || dia.day || (i + 1),
                titulo: dia.titulo || dia.title || '',
                locais: (dia.locais || dia.locations || dia.atividades || [])
                    .slice(0, 3)
                    .map(l => typeof l === 'string' ? l : (l.nome || l.name || l.local || ''))
                    .filter(Boolean),
                resumo: dia.resumo || dia.summary || ''
            }));
        } catch { return []; }
    }

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
                    tipo, origem: formData.origem?.code,
                    dataIda: formData.dataIda, dataVolta: formData.dataVolta,
                    razao: destino.razao || '', comentario: destino.comentario || '',
                    stops: destino.flight?.stops
                },
                notas: `${tipo === 'top_destino' ? '🏆 Top Pick' : tipo === 'surpresa' ? '🎁 Surpresa' : '📋 Alternativa'} — auto-salvo`
            });
            _log(`✅ Destino "${destino.name}" salvo automaticamente`);
        } catch (e) {
            _log(`⚠️ Destino "${destino.name}" já salvo ou erro:`, e.message);
        }
    }

    async function salvarDestino(destino, formData) {
        if (!_isLoggedIn()) {
            if (typeof BenetripLoginModal !== 'undefined') BenetripLoginModal.open();
            else alert('Faça login para salvar destinos!');
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
                    origem: formData?.origem?.code, dataIda: formData?.dataIda,
                    dataVolta: formData?.dataVolta, razao: destino.razao || '',
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

    function _showSaveToast(message) {
        const existing = document.getElementById('benetrip-save-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'benetrip-save-toast';
        toast.textContent = message;
        toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#21272A;color:white;padding:12px 24px;border-radius:12px;font-family:'Montserrat',sans-serif;font-size:14px;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:10001;opacity:0;transition:all 0.3s ease;pointer-events:none;white-space:nowrap;`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(20px)'; setTimeout(() => toast.remove(), 300); }, 2500);
    }

    return {
        salvarBuscaDestinos,
        salvarBuscaTodosDestinos,
        salvarCompararVoos,
        salvarBuscaVoosBaratos,
        salvarBuscaVoos,
        salvarRoteiro,
        salvarDestino,
        isLoggedIn: _isLoggedIn,
        showToast: _showSaveToast
    };
})();

window.BenetripAutoSave = BenetripAutoSave;
