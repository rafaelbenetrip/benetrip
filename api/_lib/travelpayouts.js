// api/_lib/travelpayouts.js - BENETRIP ADAPTER TRAVELPAYOUTS v1.0
//
// Camada de adapter sobre o provedor já configurado na Busca clássica
// (api/flight-search.js + api/flight-results.js). Serve para obter PROPOSTAS
// COMPLETAS de ida e volta — com os dois trechos definidos e link de compra —
// quando o engine de calendário só devolve tarifa inicial.
//
// A interface nunca fala com este módulo diretamente: quem consome é o
// endpoint, que traduz o resultado em metadados de completude
// (api/_lib/quote-completeness.js).
//
// Sem AVIASALES_TOKEN/MARKER configurados o módulo se declara indisponível e
// quem chama cai no modo indicativo — nunca inventa itinerário.

import crypto from 'crypto';
import { getCache, setCache } from './external-cache.js';

const SEARCH_URL = 'https://api.travelpayouts.com/v1/flight_search';
const RESULTS_URL = 'https://api.travelpayouts.com/v1/flight_search_results';

// Cache de propostas por rota+datas+passageiros. Tarifas mudam durante o dia:
// 20 minutos é curto o bastante para não exibir preço velho e longo o bastante
// para o usuário mexer nos filtros sem refazer a busca inteira.
const TTL_PROPOSTAS_MS = 20 * 60 * 1000;

export function travelpayoutsDisponivel() {
    return Boolean(process.env.AVIASALES_TOKEN && process.env.AVIASALES_MARKER);
}

// ============================================================
// ASSINATURA MD5 (mesmo algoritmo de api/flight-search.js)
// ============================================================
function gerarAssinatura(requestData, token) {
    const nested = ['passengers', 'segments'];
    const topLevelKeys = ['host', 'locale', 'marker', 'trip_class', 'user_ip', 'currency', 'know_english', 'only_direct'];
    const topLevel = topLevelKeys.filter((k) => requestData[k] !== undefined);
    const nomes = [...topLevel, ...nested].sort((a, b) => a.localeCompare(b));

    const valores = [];
    for (const nome of nomes) {
        if (nome === 'passengers') {
            valores.push(String(requestData.passengers.adults));
            valores.push(String(requestData.passengers.children));
            valores.push(String(requestData.passengers.infants));
        } else if (nome === 'segments') {
            for (const seg of requestData.segments) {
                valores.push(String(seg.date));
                valores.push(String(seg.destination));
                valores.push(String(seg.origin));
            }
        } else {
            valores.push(String(requestData[nome]));
        }
    }

    return crypto.createHash('md5').update(`${token}:${valores.join(':')}`).digest('hex');
}

// ============================================================
// INICIAR BUSCA
// ============================================================
export async function iniciarBusca({
    origem,
    destino,
    dataIda,
    dataVolta,
    adultos = 1,
    criancas = 0,
    bebes = 0,
    moeda = 'BRL',
    userIp = '127.0.0.1',
    locale = 'pt',
}) {
    const token = process.env.AVIASALES_TOKEN;
    const marker = process.env.AVIASALES_MARKER;
    if (!token || !marker) throw new Error('AVIASALES_TOKEN/AVIASALES_MARKER não configurados');

    const requestData = {
        marker,
        host: process.env.HOST || 'www.benetrip.com.br',
        user_ip: userIp,
        locale,
        trip_class: 'Y',
        passengers: { adults: adultos, children: criancas, infants: bebes },
        segments: [{ origin: origem, destination: destino, date: dataIda }],
    };
    if (dataVolta) {
        requestData.segments.push({ origin: destino, destination: origem, date: dataVolta });
    }
    if (locale.toLowerCase().startsWith('pt')) requestData.know_english = false;
    if (moeda && moeda.length === 3) requestData.currency = moeda.toUpperCase();

    requestData.signature = gerarAssinatura(requestData, token);

    const response = await fetch(SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
        body: JSON.stringify(requestData),
    });

    if (!response.ok) {
        throw new Error(`Travelpayouts respondeu ${response.status} ao iniciar a busca`);
    }
    const data = await response.json();
    if (!data.search_id) throw new Error('Travelpayouts não devolveu search_id');
    return { searchId: data.search_id, currencyRates: data.currency_rates || null };
}

// ============================================================
// LER RESULTADOS DE UM SEARCH_ID
// A API devolve lotes: o chunk "vazio" (só search_id) marca o fim da busca.
// ============================================================
export async function lerResultados(searchId) {
    const response = await fetch(`${RESULTS_URL}?uuid=${encodeURIComponent(searchId)}`, {
        headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip,deflate' },
    });
    if (!response.ok) throw new Error(`Travelpayouts respondeu ${response.status} ao ler resultados`);

    const raw = await response.json();
    if (!Array.isArray(raw)) return { propostas: [], completa: false, segments: [], airlines: {} };

    let propostas = [];
    let completa = false;
    let segments = [];
    const airlines = {};

    for (const chunk of raw) {
        if (!chunk || typeof chunk !== 'object') continue;
        if (chunk.search_id && Object.keys(chunk).length <= 2) { completa = true; continue; }
        if (chunk.airlines) Object.assign(airlines, chunk.airlines);
        if (chunk.segments?.length > 0) segments = chunk.segments;
        if (Array.isArray(chunk.proposals)) propostas = propostas.concat(chunk.proposals);
    }

    return { propostas, completa, segments, airlines };
}

// ============================================================
// PROPOSTA COMPLETA DE IDA E VOLTA
//
// Inicia a busca e faz polling controlado até:
//   - a busca terminar; ou
//   - estourar o orçamento de tempo (timeoutMs).
// Devolve a proposta mais barata que tenha OS DOIS trechos e link de compra.
// Sem isso, devolve { encontrada: false } — quem chama mantém o modo
// indicativo em vez de fabricar uma tarifa fechada.
// ============================================================
export async function buscarPropostaIdaEVolta(params, { timeoutMs = 25000, intervaloMs = 2500 } = {}) {
    const chave = [
        'tp-rt',
        params.origem,
        params.destino,
        params.dataIda,
        params.dataVolta,
        params.adultos || 1,
        params.criancas || 0,
        params.bebes || 0,
        params.moeda || 'BRL',
    ].join('|');

    const emCache = getCache(chave);
    if (emCache) return { ...emCache, doCache: true };

    const inicio = Date.now();
    let searchId;
    try {
        ({ searchId } = await iniciarBusca(params));
    } catch (err) {
        console.warn(`[Travelpayouts] Falha ao iniciar busca ${chave}: ${err.message}`);
        return { encontrada: false, motivo: 'erro_ao_iniciar', erro: err.message };
    }

    // Acumula entre lotes: uma proposta vista num lote não desaparece porque o
    // lote seguinte veio menor.
    const acumuladas = new Map();
    let completa = false;

    while (Date.now() - inicio < timeoutMs) {
        await new Promise((r) => setTimeout(r, intervaloMs));
        let lote;
        try {
            lote = await lerResultados(searchId);
        } catch (err) {
            console.warn(`[Travelpayouts] Erro no polling de ${searchId}: ${err.message}`);
            break;
        }
        for (const p of lote.propostas) {
            const id = p.sign || JSON.stringify(p.segment || []).slice(0, 120);
            if (!acumuladas.has(id)) acumuladas.set(id, p);
        }
        if (lote.completa) { completa = true; break; }
    }

    const candidatas = Array.from(acumuladas.values()).filter(propostaTemIdaEVolta);
    if (candidatas.length === 0) {
        const resultado = { encontrada: false, motivo: completa ? 'sem_proposta_completa' : 'timeout', propostas: acumuladas.size };
        setCache(chave, resultado, TTL_PROPOSTAS_MS);
        return resultado;
    }

    candidatas.sort((a, b) => precoDaProposta(a) - precoDaProposta(b));
    const melhor = candidatas[0];
    const resultado = {
        encontrada: true,
        preco: precoDaProposta(melhor),
        moeda: (params.moeda || 'BRL').toUpperCase(),
        temLinkDeCompra: Boolean(melhor.terms && Object.keys(melhor.terms).length > 0),
        trechosIda: melhor.segment?.[0]?.flight?.length || 0,
        trechosVolta: melhor.segment?.[1]?.flight?.length || 0,
        buscaCompleta: completa,
        propostasAvaliadas: acumuladas.size,
        verificadoEm: new Date().toISOString(),
    };
    setCache(chave, resultado, TTL_PROPOSTAS_MS);
    return resultado;
}

function propostaTemIdaEVolta(p) {
    const segs = p?.segment;
    if (!Array.isArray(segs) || segs.length < 2) return false;
    return (segs[0]?.flight?.length || 0) > 0 && (segs[1]?.flight?.length || 0) > 0;
}

function precoDaProposta(p) {
    const terms = p?.terms ? Object.values(p.terms) : [];
    const precos = terms.map((t) => Number(t?.unified_price ?? t?.price)).filter((n) => Number.isFinite(n) && n > 0);
    return precos.length > 0 ? Math.min(...precos) : Infinity;
}

// ============================================================
// EXECUÇÃO COM LIMITE DE CONCORRÊNCIA
// Usada para enriquecer várias combinações sem estourar o fornecedor.
// ============================================================
export async function comLimiteDeConcorrencia(itens, limite, tarefa) {
    const resultados = new Array(itens.length);
    let cursor = 0;

    async function worker() {
        while (cursor < itens.length) {
            const idx = cursor++;
            try {
                resultados[idx] = await tarefa(itens[idx], idx);
            } catch (err) {
                resultados[idx] = { erro: err.message };
            }
        }
    }

    const workers = Array.from({ length: Math.max(1, Math.min(limite, itens.length)) }, worker);
    await Promise.all(workers.map((w) => w()));
    return resultados;
}
