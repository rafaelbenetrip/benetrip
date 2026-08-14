// api/seasonality.js - BENETRIP VALIDAÇÃO SAZONAL (endpoint)
//
// POST /api/seasonality
// {
//   "mes": 11,
//   "destinos": [{ "destino": "Lençóis Maranhenses", "pais": "Brasil" }, ...]
// }
//
// Resposta:
// {
//   "success": true,
//   "resultados": [{ status, destination, travelMonth, summary, suitability,
//                    sourceName, sourceUrl, checkedAt }],
//   "_meta": { grounding, validados, tempoMs }
// }
//
// Este endpoint é uma MELHORIA PROGRESSIVA: a Descoberta mostra preço,
// escalas e duração sem esperar por ele. Se o grounding falhar, a resposta vem
// com status "unavailable" para cada destino e a interface simplesmente omite
// a alegação sazonal.

import {
    validarSazonalidadeEmLote,
    MAX_DESTINOS_VALIDADOS,
} from './_lib/seasonality.js';
import { groundingDisponivel, provedoresDisponiveis } from './_lib/web-grounding.js';

export const maxDuration = 60;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    try {
        const { destinos, mes, idioma } = req.body || {};

        if (!Array.isArray(destinos) || destinos.length === 0) {
            return res.status(400).json({ error: 'Informe ao menos um destino' });
        }
        const mesNum = parseInt(mes, 10);
        if (!(mesNum >= 1 && mesNum <= 12)) {
            return res.status(400).json({ error: 'Mês da viagem inválido (1 a 12)' });
        }

        const inicio = Date.now();
        const alvos = destinos.slice(0, MAX_DESTINOS_VALIDADOS).map((d) => ({
            destino: String(d?.destino || d?.name || '').slice(0, 120),
            pais: String(d?.pais || d?.country || '').slice(0, 80),
        })).filter((d) => d.destino);

        if (alvos.length === 0) {
            return res.status(400).json({ error: 'Nenhum destino válido informado' });
        }

        const resultados = await validarSazonalidadeEmLote(alvos, {
            mes: mesNum,
            idioma: typeof idioma === 'string' ? idioma : 'pt-BR',
        });

        const tempoMs = Date.now() - inicio;
        const verificados = resultados.filter((r) => r?.status === 'verified').length;
        console.log(`🗓️ Sazonalidade: ${verificados}/${alvos.length} verificados em ${tempoMs}ms (mês ${mesNum})`);

        // Cache de borda curto: a mesma combinação destino+mês é estável
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

        return res.status(200).json({
            success: true,
            mes: mesNum,
            resultados,
            _meta: {
                grounding: groundingDisponivel(),
                provedores: provedoresDisponiveis(),
                validados: alvos.length,
                verificados,
                tempoMs,
            },
        });
    } catch (error) {
        console.error('❌ Erro na validação sazonal:', error);
        // Falha aqui NUNCA derruba a Descoberta: o cliente trata como
        // "informação indisponível" e segue com preço, escalas e duração.
        return res.status(200).json({
            success: false,
            resultados: [],
            error: 'Não foi possível verificar a época nos destinos agora',
        });
    }
}
