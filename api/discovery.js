// api/discovery.js - BENETRIP DISCOVERY API v1.0
// Endpoint de leitura para as páginas de descoberta
//
// ENDPOINTS:
//   GET /api/discovery?origem=GRU                    → Snapshot mais recente
//   GET /api/discovery?origem=GRU&data=2026-03-10    → Snapshot de uma data específica
//   GET /api/discovery?origem=GRU&historico=7         → Últimos 7 dias (tendência)
//   GET /api/discovery?origens=todas                  → Resumo de todas as origens
//
// FILTROS (query params):
//   estilo=praia,cidade       → Filtrar por estilo
//   preco_max=1500            → Filtrar por preço máximo
//   internacional=true/false  → Apenas internacionais ou nacionais

import {
    fetchSnapshot as fetchSnapshotShared,
    fetchSnapshotComVariacao,
    calcularVariacoes as calcularVariacoesShared,
} from './_lib/discovery-shared.js';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    // Cache por 1 hora no CDN, 5 min no browser
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800, max-age=300');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Apenas GET' });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Supabase não configurado' });
    }

    try {
        const {
            origem,
            origens,
            data,
            historico,
            estilo,
            preco_max,
            internacional,
            tipo = 'destinos-baratos',
        } = req.query;

        // ─── MODO 1: Resumo de todas as origens ───
        if (origens === 'todas') {
            return await handleTodasOrigens(supabaseUrl, supabaseKey, tipo, res);
        }

        // ─── MODO 2: Histórico (tendência de preços) ───
        if (origem && historico) {
            const dias = parseInt(historico) || 7;
            return await handleHistorico(supabaseUrl, supabaseKey, origem, tipo, dias, res);
        }

        // ─── MODO 3: Snapshot específico (por data ou mais recente) ───
        if (origem) {
            let snapshot;
            let destinosComVariacao;

            if (data) {
                // Data específica: variação vs. o dia anterior à data pedida
                snapshot = await fetchSnapshotShared(origem, tipo, data);
                if (snapshot) {
                    const anterior = new Date(data + 'T12:00:00Z');
                    anterior.setUTCDate(anterior.getUTCDate() - 1);
                    const anteriorStr = anterior.toISOString().split('T')[0];
                    const snapshotAnterior = await fetchSnapshotShared(origem, tipo, anteriorStr);
                    const destinos = aplicarFiltros(snapshot.destinos || [], { estilo, preco_max, internacional });
                    destinosComVariacao = calcularVariacoesShared(destinos, snapshotAnterior?.destinos || []);
                }
            } else {
                // Mais recente: variação vs. média dos últimos 7 dias (1 query)
                snapshot = await fetchSnapshotComVariacao(origem, tipo);
                if (snapshot) {
                    destinosComVariacao = aplicarFiltros(snapshot.destinos || [], { estilo, preco_max, internacional });
                }
            }

            if (!snapshot) {
                return res.status(404).json({
                    error: 'Nenhum snapshot encontrado',
                    message: data
                        ? `Nenhum dado para ${origem} em ${data}`
                        : `Nenhum dado para ${origem}. O cron já rodou?`,
                });
            }

            return res.status(200).json({
                success: true,
                origem: snapshot.origem,
                origem_nome: snapshot.origem_nome,
                data: snapshot.data,
                tipo: snapshot.tipo,
                total: destinosComVariacao.length,
                total_original: (snapshot.destinos || []).length,
                destinos: destinosComVariacao,
                insight: snapshot.insight || null,
                tripinha_pick: snapshot.tripinha_pick || null,
                filtros_aplicados: { estilo, preco_max, internacional },
                atualizado_em: snapshot.created_at,
            });
        }

        return res.status(400).json({
            error: 'Parâmetro obrigatório: origem ou origens=todas',
            exemplos: [
                '/api/discovery?origem=GRU',
                '/api/discovery?origem=GRU&estilo=praia&preco_max=1500',
                '/api/discovery?origem=GRU&historico=7',
                '/api/discovery?origens=todas',
            ],
        });
    } catch (error) {
        console.error('❌ Discovery API erro:', error);
        return res.status(500).json({ error: 'Erro interno', message: error.message });
    }
}

// ============================================================
// TODAS AS ORIGENS (resumo)
// ============================================================
async function handleTodasOrigens(supabaseUrl, supabaseKey, tipo, res) {
    // Buscar o snapshot mais recente de cada origem
    // Usamos uma query que pega os registros mais recentes
    const hoje = new Date().toISOString().split('T')[0];
    const url = `${supabaseUrl}/rest/v1/discovery_snapshots?tipo=eq.${tipo}&data=eq.${hoje}&select=origem,origem_nome,data,total_destinos,destinos&order=origem.asc`;

    const response = await fetch(url, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        },
    });

    if (!response.ok) {
        return res.status(500).json({ error: 'Erro ao buscar origens' });
    }

    const rows = await response.json();

    // Se não encontrou dados de hoje, buscar os mais recentes
    if (rows.length === 0) {
        const fallbackUrl = `${supabaseUrl}/rest/v1/discovery_snapshots?tipo=eq.${tipo}&select=origem,origem_nome,data,total_destinos,destinos&order=data.desc&limit=20`;
        const fallbackResponse = await fetch(fallbackUrl, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
            },
        });

        if (!fallbackResponse.ok) {
            return res.status(500).json({ error: 'Erro ao buscar origens (fallback)' });
        }

        const fallbackRows = await fallbackResponse.json();

        // Deduplicar por origem (manter mais recente)
        const porOrigem = new Map();
        for (const row of fallbackRows) {
            if (!porOrigem.has(row.origem)) {
                porOrigem.set(row.origem, row);
            }
        }

        const resumo = Array.from(porOrigem.values()).map(formatarResumoOrigem);
        return res.status(200).json({ success: true, origens: resumo, data: 'mais_recente' });
    }

    const resumo = rows.map(formatarResumoOrigem);
    return res.status(200).json({ success: true, origens: resumo, data: hoje });
}

function formatarResumoOrigem(row) {
    const destinos = row.destinos || [];
    const maisBarato = destinos.length > 0 ? destinos[0] : null;
    return {
        origem: row.origem,
        origem_nome: row.origem_nome,
        data: row.data,
        total_destinos: row.total_destinos,
        destino_mais_barato: maisBarato ? {
            nome: maisBarato.nome,
            pais: maisBarato.pais,
            preco: maisBarato.preco,
        } : null,
    };
}

// ============================================================
// HISTÓRICO (tendência de preços)
// ============================================================
async function handleHistorico(supabaseUrl, supabaseKey, origem, tipo, dias, res) {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const dataInicioStr = dataInicio.toISOString().split('T')[0];

    const url = `${supabaseUrl}/rest/v1/discovery_snapshots?origem=eq.${origem}&tipo=eq.${tipo}&data=gte.${dataInicioStr}&select=data,total_destinos,destinos&order=data.asc`;

    const response = await fetch(url, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        },
    });

    if (!response.ok) {
        return res.status(500).json({ error: 'Erro ao buscar histórico' });
    }

    const rows = await response.json();

    // Extrair tendência: preço do destino mais barato por dia
    const tendencia = rows.map(row => {
        const destinos = row.destinos || [];
        const maisBarato = destinos.length > 0 ? destinos[0] : null;
        return {
            data: row.data,
            total_destinos: row.total_destinos,
            preco_mais_barato: maisBarato?.preco || null,
            destino_mais_barato: maisBarato?.nome || null,
            top3: destinos.slice(0, 3).map(d => ({
                nome: d.nome,
                preco: d.preco,
                pais: d.pais,
            })),
        };
    });

    return res.status(200).json({
        success: true,
        origem,
        dias,
        total_snapshots: tendencia.length,
        tendencia,
    });
}

// ============================================================
// APLICAR FILTROS NOS DESTINOS
// ============================================================
function aplicarFiltros(destinos, filtros) {
    let resultado = [...destinos];

    // Filtrar por estilo
    if (filtros.estilo) {
        const estilosFiltro = filtros.estilo.split(',').map(s => s.trim().toLowerCase());
        resultado = resultado.filter(d => {
            const estilosDestino = (d.estilos || []).map(e => e.toLowerCase());
            return estilosFiltro.some(ef => estilosDestino.includes(ef));
        });
    }

    // Filtrar por preço máximo
    if (filtros.preco_max) {
        const max = parseFloat(filtros.preco_max);
        if (!isNaN(max)) {
            resultado = resultado.filter(d => d.preco <= max);
        }
    }

    // Filtrar por internacional/nacional
    if (filtros.internacional !== undefined) {
        const querInternacional = filtros.internacional === 'true';
        resultado = resultado.filter(d => d.internacional === querInternacional);
    }

    return resultado;
}
