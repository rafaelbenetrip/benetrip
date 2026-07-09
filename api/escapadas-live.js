// api/escapadas-live.js - BENETRIP ESCAPADAS AO VIVO v1.0
// Busca escapadas em tempo real para QUALQUER cidade de origem (fora das 30
// com snapshot diário), sempre presa a uma janela ativa (fds ou feriado).
//
// GET /api/escapadas-live?origem=RAO&janela=fds-2026-07-10
//
// Regras:
// - `janela` PRECISA ser uma janela ativa (janelasAtivas): impede o uso do
//   endpoint como API genérica de voos com data arbitrária.
// - `origem` só aceita código IATA (3 letras) — o explore não resolve texto
//   livre de forma confiável.
// - Cache agressivo na CDN (30 min por origem+janela): buscas repetidas da
//   mesma cidade não gastam SearchAPI.
// - Mesma lógica de busca/formatação do cron (escapadas-shared), então os
//   cards ficam idênticos aos das cidades automáticas.

import { janelasAtivas, hojeISO, buscarDestinosJanela, selecionarEFormatarDestinos } from './_lib/escapadas-shared.js';

export const maxDuration = 60;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ success: false, error: 'Método não permitido' });
    }

    const origem = String(req.query?.origem || '').toUpperCase().trim();
    const janelaId = String(req.query?.janela || '').trim();

    if (!/^[A-Z]{3}$/.test(origem)) {
        return res.status(400).json({ success: false, error: 'origem deve ser um código IATA de 3 letras (ex.: RAO)' });
    }

    const janelas = janelasAtivas(hojeISO());
    const janela = janelas.find((j) => j.id === janelaId);
    if (!janela) {
        return res.status(400).json({
            success: false,
            error: 'janela inválida ou não está mais ativa',
            janelasAtivas: janelas.map((j) => j.id),
        });
    }

    try {
        const destinosRaw = await buscarDestinosJanela(origem, janela);
        const destinos = selecionarEFormatarDestinos(destinosRaw, janela);

        // Mesma janela+origem muda pouco dentro de um dia: CDN segura 30 min
        // e serve stale por mais 1h enquanto revalida em background.
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=3600');
        return res.status(200).json({
            success: true,
            origem,
            janela: { id: janela.id, rotulo: janela.rotulo, ida: janela.ida, volta: janela.volta, noites: janela.noites },
            destinos,
            total: destinos.length,
        });
    } catch (err) {
        console.error(`[escapadas-live][${origem}/${janelaId}] Erro:`, err.message);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(500).json({ success: false, error: 'Falha ao buscar voos agora. Tente novamente em instantes.' });
    }
}
