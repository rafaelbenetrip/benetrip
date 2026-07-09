// api/cron/update-escapadas.js - BENETRIP ESCAPADAS CRON v1.0
// Roda 2x/dia via Vercel Cron (7h e 19h UTC, deslocado do update-discovery).
// Para cada cidade do lote, busca voos com DATAS FIXAS para cada janela de
// escapada ativa (3 fins de semana rolantes + próximos feriados nacionais)
// e salva um snapshot por janela no Supabase.
//
// Snapshots na tabela discovery_snapshots, um `tipo` por janela:
//   fds-2026-07-10, feriado-independencia-2026, ...
// A página /escapadas (api/escapadas-page.js) lê esses tipos.
//
// CUSTO DE API: fim de semana = 1 busca (só Brasil: escapada de 2 noites é
// doméstica); feriado = 2 buscas (Brasil + América do Sul, 3+ dias viabilizam
// Buenos Aires, Santiago etc). ~9 buscas/cidade/dia com 6 janelas ativas.
//
// TRIGGER: Vercel Cron configurado em vercel.json
// MANUAL:  GET /api/cron/update-escapadas?key=CRON_SECRET
// FORÇAR LOTE: GET /api/cron/update-escapadas?key=CRON_SECRET&lote=1

import { readFileSync } from 'fs';
import { join } from 'path';
import { janelasAtivas, hojeISO, buscarDestinosJanela, selecionarEFormatarDestinos } from '../_lib/escapadas-shared.js';

export const maxDuration = 300; // 5 minutos

// 8 cidades x ~9 buscas por execução: cabe com folga nos 300s da função.
// Com 15 cidades a execução estourava o maxDuration (FUNCTION_INVOCATION_TIMEOUT)
// com a latência real da SearchAPI. 4 execuções/dia cobrem as 30 cidades
// com o mesmo custo diário de API (cada cidade continua 1x/dia).
const CIDADES_POR_LOTE = 8;
const LOTES_POR_DIA = 4;

// ============================================================
// CIDADES E LOTE (mesma mecânica do update-discovery)
// ============================================================
function carregarCidades() {
    const filePath = join(process.cwd(), 'api', 'data', 'brazilian-airports.json');
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return (data.cidades || []).sort((a, b) => (a.prioridade || 99) - (b.prioridade || 99));
}

function calcularLote(totalCidades, forcarLote, horaUTC = new Date().getUTCHours()) {
    if (forcarLote !== undefined && forcarLote !== null) {
        const lote = parseInt(forcarLote);
        if (!isNaN(lote) && lote >= 0) return lote;
    }
    const execucao = Math.floor(horaUTC / (24 / LOTES_POR_DIA)); // 1h -> 0, 7h -> 1, 13h -> 2, 19h -> 3
    const totalLotes = Math.ceil(totalCidades / CIDADES_POR_LOTE);
    return execucao % totalLotes;
}

// ============================================================
// SUPABASE (escrita via service role, upsert por data+origem+tipo)
// ============================================================
async function supabaseInsert(tableName, data) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY)');
    }

    // on_conflict é obrigatório: sem ele o PostgREST resolve merge-duplicates
    // pela chave primária (id), e re-execuções no mesmo dia dão 409 na
    // constraint UNIQUE (data, origem, tipo) em vez de atualizar o snapshot.
    const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?on_conflict=data,origem,tipo`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase insert falhou (${response.status}): ${errorText}`);
    }
    return true;
}

// ============================================================
// PROCESSAR UMA (CIDADE, JANELA) -> SNAPSHOT
// ============================================================
async function processarJanela(origem, janela, hoje) {
    try {
        const destinosRaw = await buscarDestinosJanela(origem.codigo, janela);
        const destinos = selecionarEFormatarDestinos(destinosRaw, janela);

        if (destinos.length === 0) {
            console.log(`⚠️ [${origem.codigo}/${janela.id}] Nenhum destino com preço`);
            return null;
        }

        console.log(`✅ [${origem.codigo}/${janela.id}] ${destinos.length} destinos | Mais barato: R$${destinos[0]?.preco || '?'}`);

        return {
            data: hoje,
            origem: origem.codigo,
            origem_nome: origem.nome,
            tipo: janela.id,
            destinos,
            total_destinos: destinos.length,
            moeda: 'BRL',
        };
    } catch (error) {
        console.error(`❌ [${origem.codigo}/${janela.id}] Erro:`, error.message);
        return null;
    }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    const queryKey = req.query?.key;
    const isVercelCron = authHeader === `Bearer ${cronSecret}`;
    const isManualWithKey = queryKey && queryKey === cronSecret;
    if (cronSecret && !isVercelCron && !isManualWithKey) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    let todasCidades;
    try {
        todasCidades = carregarCidades();
    } catch (err) {
        console.error('Erro ao carregar brazilian-airports.json:', err.message);
        return res.status(500).json({ error: 'Falha ao carregar lista de cidades' });
    }

    const loteIndex = calcularLote(todasCidades.length, req.query?.lote);
    const inicio = loteIndex * CIDADES_POR_LOTE;
    const cidadesDoLote = todasCidades.slice(inicio, inicio + CIDADES_POR_LOTE);
    const totalLotes = Math.ceil(todasCidades.length / CIDADES_POR_LOTE);

    const hoje = hojeISO();
    const janelas = janelasAtivas(hoje);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏖️ ESCAPADAS CRON v1.0 - Início: ${new Date().toISOString()}`);
    console.log(`📦 Lote ${loteIndex + 1}/${totalLotes} (${cidadesDoLote.map((c) => c.codigo).join(', ')})`);
    console.log(`📅 Janelas: ${janelas.map((j) => j.id).join(', ')}`);
    console.log(`${'='.repeat(60)}`);

    if (cidadesDoLote.length === 0 || janelas.length === 0) {
        return res.status(200).json({ success: true, message: 'Nada a processar', lote: loteIndex + 1 });
    }

    const startTime = Date.now();
    const resultados = { sucesso: 0, falha: 0, detalhes: [], lote: loteIndex + 1, totalLotes, janelas: janelas.map((j) => j.id) };

    // 2 cidades por vez; janelas de cada cidade em paralelo
    // (~9-12 chamadas simultâneas à SearchAPI no pico)
    const batchSize = 2;
    for (let i = 0; i < cidadesDoLote.length; i += batchSize) {
        const batch = cidadesDoLote.slice(i, i + batchSize);
        const porCidade = await Promise.all(
            batch.map((cidade) => Promise.all(janelas.map((janela) => processarJanela(cidade, janela, hoje))))
        );

        for (const snapshots of porCidade) {
            for (const snapshot of snapshots) {
                if (!snapshot) {
                    resultados.falha++;
                    continue;
                }
                try {
                    await supabaseInsert('discovery_snapshots', snapshot);
                    resultados.sucesso++;
                    resultados.detalhes.push({ origem: snapshot.origem, tipo: snapshot.tipo, destinos: snapshot.total_destinos, status: 'ok' });
                } catch (error) {
                    resultados.falha++;
                    resultados.detalhes.push({ origem: snapshot.origem, tipo: snapshot.tipo, status: 'erro', mensagem: error.message });
                    console.error(`❌ [${snapshot.origem}/${snapshot.tipo}] Erro ao salvar:`, error.message);
                }
            }
        }
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ ESCAPADAS CRON - Lote ${loteIndex + 1}/${totalLotes} completo em ${totalTime}ms | Sucesso: ${resultados.sucesso} | Falha: ${resultados.falha}\n`);

    return res.status(200).json({
        success: true,
        message: `Lote ${loteIndex + 1}/${totalLotes}: ${resultados.sucesso} snapshots salvos`,
        totalTime,
        resultados,
    });
}
