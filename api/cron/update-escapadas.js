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
import { janelasAtivas, hojeISO } from '../_lib/escapadas-shared.js';

export const maxDuration = 300; // 5 minutos

// 8 cidades x ~9 buscas por execução: cabe com folga nos 300s da função.
// Com 15 cidades a execução estourava o maxDuration (FUNCTION_INVOCATION_TIMEOUT)
// com a latência real da SearchAPI. 4 execuções/dia cobrem as 30 cidades
// com o mesmo custo diário de API (cada cidade continua 1x/dia).
const CIDADES_POR_LOTE = 8;
const LOTES_POR_DIA = 4;
const MAX_DESTINOS_POR_JANELA = 30;
const MIN_NACIONAIS = 10; // reserva de nacionais nas janelas de feriado

const BRASIL_KGMID = '/m/015fr';
const AMERICA_SUL_KGMID = '/m/0dg3n1';

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
// BUSCA COM DATAS FIXAS (google_travel_explore + outbound/return_date)
// ============================================================
async function buscarUma(params, label) {
    const query = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
    const startTime = Date.now();

    try {
        const response = await fetch(`https://www.searchapi.io/api/v1/search?${query}`, {
            headers: { 'Accept': 'application/json' },
        });
        const elapsed = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Escapadas][${label}] HTTP ${response.status} (${elapsed}ms): ${errorText.substring(0, 200)}`);
            return [];
        }

        const data = await response.json();
        console.log(`[Escapadas][${label}] ${(data.destinations || []).length} destinos (${elapsed}ms)`);
        return data.destinations || [];
    } catch (err) {
        console.error(`[Escapadas][${label}] Erro: ${err.message}`);
        return [];
    }
}

async function buscarJanela(origemCode, janela) {
    const apiKey = process.env.SEARCHAPI_KEY;
    if (!apiKey) throw new Error('SEARCHAPI_KEY não configurada');

    const baseParams = {
        engine: 'google_travel_explore',
        api_key: apiKey,
        departure_id: origemCode,
        outbound_date: janela.ida,
        return_date: janela.volta,
        interests: 'popular',
        currency: 'BRL',
        gl: 'br',
        hl: 'pt-BR',
    };

    const buscas = [buscarUma({ ...baseParams, arrival_id: BRASIL_KGMID }, `${origemCode}/${janela.id}/BR`)];
    if (janela.categoria === 'feriado') {
        buscas.push(buscarUma({ ...baseParams, arrival_id: AMERICA_SUL_KGMID }, `${origemCode}/${janela.id}/AMSUL`));
    }
    const resultados = await Promise.all(buscas);

    // Deduplicar por nome+país mantendo o menor preço
    const map = new Map();
    for (const dest of resultados.flat()) {
        if (!dest?.name || !dest?.country) continue;
        const key = `${dest.name.toLowerCase()}_${dest.country.toLowerCase()}`;
        const price = dest.flight?.price ?? 0;
        if (!map.has(key) || (price > 0 && (map.get(key).flight?.price === 0 || price < map.get(key).flight?.price))) {
            map.set(key, dest);
        }
    }
    return Array.from(map.values());
}

// ============================================================
// CLASSIFICAÇÃO DE ESTILO (keywords; mesmos estilos do discovery)
// Sem chamada de IA aqui: com ~6 janelas x 15 cidades por execução, o batch
// via Cerebras multiplicaria as chamadas sem ganho proporcional nos filtros.
// ============================================================
const ESTILOS_KEYWORDS = {
    praia: ['beach', 'praia', 'litoral', 'costa', 'ilha', 'island', 'porto seguro', 'florianópolis', 'natal', 'maceió', 'búzios', 'guarujá', 'ubatuba', 'ilhabela', 'jericoacoara', 'arraial', 'trancoso', 'noronha', 'maragogi', 'cabo frio', 'balneário'],
    natureza: ['serra', 'chapada', 'foz', 'bonito', 'pantanal', 'lençóis', 'jalapão', 'monte verde', 'brotas', 'socorro', 'urubici', 'iguaçu', 'cachoeira', 'gramado', 'canela'],
    cidade: ['são paulo', 'rio de janeiro', 'belo horizonte', 'curitiba', 'brasília', 'buenos aires', 'santiago', 'montevideo', 'montevidéu', 'lima', 'bogotá', 'assunção', 'goiânia', 'recife', 'salvador', 'fortaleza', 'porto alegre'],
    romantico: ['gramado', 'campos do jordão', 'monte verde', 'búzios', 'trancoso', 'noronha', 'milagres'],
    familia: ['orlando', 'parque', 'resort', 'beto carrero', 'hot park', 'beach park', 'gramado', 'olímpia', 'caldas novas'],
};

function classificarEstilos(destino) {
    const texto = `${destino.name || ''} ${destino.country || ''}`.toLowerCase();
    const estilos = [];
    for (const [estilo, keywords] of Object.entries(ESTILOS_KEYWORDS)) {
        if (keywords.some((kw) => texto.includes(kw))) estilos.push(estilo);
    }
    return estilos.length > 0 ? estilos.slice(0, 3) : ['cidade'];
}

// ============================================================
// FORMATAR DESTINO (mesmo shape dos snapshots de destinos-baratos,
// para reaproveitar renderCardHtml e o histórico de variações)
// ============================================================
function formatarDestino(destino, posicao, janela) {
    const isInternacional = (destino.country || '').toLowerCase() !== 'brasil';
    // Fonte da verdade das datas é a resposta da API; a janela é o fallback.
    const dataIda = destino.outbound_date || janela.ida;
    const dataVolta = destino.return_date || janela.volta;
    if (destino.outbound_date && destino.outbound_date !== janela.ida) {
        console.warn(`⚠️ [Escapadas] Engine devolveu ida ${destino.outbound_date} para janela ${janela.id} (${destino.name})`);
    }

    return {
        posicao,
        nome: destino.name || '',
        pais: destino.country || '',
        aeroporto: destino.flight?.airport_code || destino.primary_airport || '',
        preco: destino.flight?.price || 0,
        moeda: 'BRL',
        paradas: destino.flight?.stops || 0,
        duracao_voo_min: destino.flight?.flight_duration_minutes || 0,
        cia_aerea: destino.flight?.airline_name || '',
        custo_noite: destino.avg_cost_per_night || 0,
        imagem: destino.image || '',
        estilos: classificarEstilos(destino),
        duracao_ideal: { min: janela.noites, max: janela.noites, ideal: janela.noites },
        internacional: isInternacional,
        data_ida: dataIda,
        data_volta: dataVolta,
    };
}

// ============================================================
// PROCESSAR UMA (CIDADE, JANELA) -> SNAPSHOT
// ============================================================
async function processarJanela(origem, janela, hoje) {
    try {
        const destinosRaw = await buscarJanela(origem.codigo, janela);
        const comPreco = destinosRaw
            .filter((d) => d.flight?.price > 0)
            .sort((a, b) => a.flight.price - b.flight.price);

        if (comPreco.length === 0) {
            console.log(`⚠️ [${origem.codigo}/${janela.id}] Nenhum destino com preço`);
            return null;
        }

        // Reserva de nacionais (só relevante nas janelas de feriado, que
        // misturam América do Sul; nas de fds tudo já é nacional)
        const nacionais = comPreco.filter((d) => (d.country || '').toLowerCase() === 'brasil');
        const internacionais = comPreco.filter((d) => (d.country || '').toLowerCase() !== 'brasil');
        const reservados = nacionais.slice(0, MIN_NACIONAIS);
        const pool = [...nacionais.slice(MIN_NACIONAIS), ...internacionais]
            .sort((a, b) => a.flight.price - b.flight.price)
            .slice(0, MAX_DESTINOS_POR_JANELA - reservados.length);

        const selecionados = [...reservados, ...pool].sort((a, b) => a.flight.price - b.flight.price);
        const destinos = selecionados.map((d, i) => formatarDestino(d, i + 1, janela));

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
