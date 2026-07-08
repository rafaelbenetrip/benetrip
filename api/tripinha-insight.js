// api/tripinha-insight.js - BENETRIP TRIPINHA INSIGHT v3.0
// Gera uma frase curta da Tripinha interpretando os destinos baratos.
//
// v3.0: geração movida para api/_lib/tripinha-shared.js. O caminho principal
// agora é o insight pré-gerado pelo cron e embutido no snapshot; este endpoint
// fica como fallback para buscas ao vivo e snapshots antigos sem insight.
//
// POST /api/tripinha-insight
// Body: { origem: "São Paulo", origemCodigo: "GRU", destinos: [...] }
// Response: { success: true, insight: "Hoje tem voo pra..." }

import { gerarConteudoTripinha } from './_lib/tripinha-shared.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    const { origem, destinos } = req.body;

    if (!origem || !destinos || !Array.isArray(destinos) || destinos.length === 0) {
        return res.status(400).json({
            error: 'Parâmetros obrigatórios: origem (string) e destinos (array)',
        });
    }

    console.log(`🐶 Tripinha: gerando insight para ${origem} (${destinos.length} destinos)`);
    const resultado = await gerarConteudoTripinha(origem, destinos);

    return res.status(200).json({
        success: true,
        insight: resultado.insight,
        modelo: resultado.modelo,
        ...(resultado.motivo ? { motivo: resultado.motivo } : {}),
    });
}
