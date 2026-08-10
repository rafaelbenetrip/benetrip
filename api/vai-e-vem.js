// api/vai-e-vem.js - BENETRIP VAI E VEM v1.0
// Busca de preços para rotas recorrentes (visita à família, relacionamento à
// distância, trabalho/estudo em outra cidade): o usuário escolhe os dias da
// semana de ida e de volta e o horizonte em meses, e a busca varre todas as
// ocorrências desse padrão usando o engine google_flights_calendar.
//
// Regra de pareamento implícita: cada ida pareia com a PRIMEIRA ocorrência
// seguinte de cada dia de volta selecionado (a viagem daquela semana),
// portanto todo par ida/volta tem entre 1 e 7 noites.
//
// POST /api/vai-e-vem
// Body: { origem, destino, diasIda: [4,5], diasVolta: [0,1], meses: 3, moeda }
// (dias da semana: 0 = domingo ... 6 = sábado)

import { feriadosDoAno, diaDaSemana, nomeDiaSemana } from './_lib/feriados.js';

const MAX_COMBOS_PER_REQUEST = 200;
const MAX_WINDOW_DAYS = 14;
const ENRICH_TOP_N = 3;

// ============================================================
// HELPERS DE DATA
// ============================================================
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function addDaysISO(iso, days) {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
}

function diffDays(isoA, isoB) {
    const d1 = new Date(isoA + 'T00:00:00Z');
    const d2 = new Date(isoB + 'T00:00:00Z');
    return Math.round((d2 - d1) / 86400000);
}

// Segunda-feira da semana da data (para agrupar combos por semana)
function mondayOfWeek(iso) {
    const dow = diaDaSemana(iso); // 0 = dom ... 6 = sáb
    return addDaysISO(iso, -((dow + 6) % 7));
}

// ============================================================
// PADRÃO IDA/VOLTA
// Noites entre um dia de ida e a PRIMEIRA ocorrência seguinte do
// dia de volta: sempre entre 1 e 7 (mesmo dia = semana seguinte).
// ============================================================
function noitesEntreDias(diaIda, diaVolta) {
    return ((diaVolta - diaIda + 6) % 7) + 1;
}

// ============================================================
// BUSCA NO SEARCHAPI (engine calendar)
// ============================================================
async function searchFlightsCalendar(params, label) {
    const fullParams = {
        engine: 'google_flights_calendar',
        api_key: process.env.SEARCHAPI_KEY,
        ...params,
    };

    // Query string manual para preservar vírgulas literais (multi-IATA)
    const queryParts = [];
    Object.entries(fullParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
            const encodedKey = encodeURIComponent(k);
            const encodedValue = encodeURIComponent(String(v)).replace(/%2C/gi, ',');
            queryParts.push(`${encodedKey}=${encodedValue}`);
        }
    });
    const urlString = `https://www.searchapi.io/api/v1/search?${queryParts.join('&')}`;

    const startTime = Date.now();
    try {
        const response = await fetch(urlString, { method: 'GET', headers: { 'Accept': 'application/json' } });
        const elapsed = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[VaiEVem][${label}] HTTP ${response.status} (${elapsed}ms):`, errorText.substring(0, 200));
            return { calendar: [], error: `HTTP ${response.status}`, errorDetail: errorText.substring(0, 200) };
        }

        const data = await response.json();
        console.log(`[VaiEVem][${label}] ${(data.calendar || []).length} resultados (${elapsed}ms)`);
        return { calendar: data.calendar || [], error: null };
    } catch (err) {
        console.error(`[VaiEVem][${label}] Erro:`, err.message);
        return { calendar: [], error: err.message };
    }
}

// ============================================================
// ENRIQUECIMENTO (engine google_flights numa data específica)
// Traz detalhes do voo + price_insights (faixa típica do Google)
// ============================================================
async function enrichFlightDetails(origemCode, destinoCode, departDate, returnDate, currencyCode, locale, label) {
    const params = {
        engine: 'google_flights',
        api_key: process.env.SEARCHAPI_KEY,
        departure_id: origemCode,
        arrival_id: destinoCode,
        outbound_date: departDate,
        return_date: returnDate,
        flight_type: 'round_trip',
        currency: currencyCode,
        gl: locale.gl,
        hl: locale.hl,
        adults: '1',
    };

    const queryParts = [];
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
            const encodedKey = encodeURIComponent(k);
            const encodedValue = encodeURIComponent(String(v)).replace(/%2C/gi, ',');
            queryParts.push(`${encodedKey}=${encodedValue}`);
        }
    });
    const urlString = `https://www.searchapi.io/api/v1/search?${queryParts.join('&')}`;

    try {
        const response = await fetch(urlString, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (!response.ok) {
            console.error(`[VaiEVem][Enrich][${label}] HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();
        const bestFlight = (data.best_flights && data.best_flights[0])
            || (data.other_flights && data.other_flights[0]);
        if (!bestFlight) return null;

        const flights = bestFlight.flights || [];
        const airlines = new Set();
        const airlineLogos = new Set();
        flights.forEach(leg => {
            if (leg.airline) airlines.add(leg.airline);
            if (leg.airline_logo) airlineLogos.add(leg.airline_logo);
        });

        const priceInsights = data.price_insights ? {
            lowest_price: data.price_insights.lowest_price || null,
            price_level: data.price_insights.price_level || null,
            typical_price_range: data.price_insights.typical_price_range || null,
        } : null;

        return {
            total_duration: bestFlight.total_duration || 0,
            stops: (bestFlight.layovers || []).length,
            airlines: Array.from(airlines),
            airline_logos: Array.from(airlineLogos),
            price: bestFlight.price || 0,
            price_insights: priceInsights,
        };
    } catch (err) {
        console.error(`[VaiEVem][Enrich][${label}] Erro:`, err.message);
        return null;
    }
}

// ============================================================
// JANELAS DE BUSCA
// O engine calendar aceita intervalos de ida e de volta, com no máximo
// MAX_COMBOS_PER_REQUEST combinações (dias de ida × dias de volta).
// O intervalo de volta acompanha o de ida deslocado por [minNoites, maxNoites],
// então: windowSize × (windowSize + gapSpan) <= 200.
// ============================================================
function generateSearchWindows(startDate, totalDays, minNoites, maxNoites) {
    const gapSpan = maxNoites - minNoites;
    let windowSize = MAX_WINDOW_DAYS;
    while (windowSize > 1 && windowSize * (windowSize + gapSpan) > MAX_COMBOS_PER_REQUEST) {
        windowSize--;
    }

    const windows = [];
    const endDate = addDays(startDate, totalDays);
    let windowStart = new Date(startDate);

    while (windowStart < endDate) {
        let windowEnd = addDays(windowStart, windowSize - 1);
        if (windowEnd > endDate) windowEnd = endDate;

        windows.push({
            outbound_date: formatDate(windowStart),
            outbound_date_start: formatDate(windowStart),
            outbound_date_end: formatDate(windowEnd),
            return_date: formatDate(addDays(windowStart, minNoites)),
            return_date_start: formatDate(addDays(windowStart, minNoites)),
            return_date_end: formatDate(addDays(windowEnd, maxNoites)),
        });

        windowStart = addDays(windowEnd, 1);
    }

    return windows;
}

// ============================================================
// FERIADOS DENTRO DE UM PERÍODO [ida, volta]
// ============================================================
function feriadosNoPeriodo(todosFeriados, ida, volta) {
    return todosFeriados
        .filter(f => f.data >= ida && f.data <= volta)
        .map(f => ({ nome: f.nome, data: f.data, oficial: f.oficial }));
}

// ============================================================
// CLASSIFICAÇÃO DE PREÇO
// Preferência: faixa típica do Google (price_insights). Sem ela,
// fallback por quartis dos próprios resultados.
// ============================================================
function criarClassificador(faixaTipica, precosOrdenados) {
    if (faixaTipica && faixaTipica.length === 2 && faixaTipica[0] > 0) {
        const [low, high] = faixaTipica;
        return {
            fonte: 'google',
            faixa: { low, high },
            classificar: (preco) => (preco <= low ? 'barato' : preco <= high ? 'normal' : 'caro'),
        };
    }

    const p25 = precosOrdenados[Math.floor(precosOrdenados.length * 0.25)];
    const p75 = precosOrdenados[Math.floor(precosOrdenados.length * 0.75)];
    return {
        fonte: 'quartis',
        faixa: { low: p25, high: p75 },
        classificar: (preco) => (preco <= p25 ? 'barato' : preco <= p75 ? 'normal' : 'caro'),
    };
}

// ============================================================
// TRIPINHA: insight interpretando o panorama + escolha do melhor achado.
// Números sempre determinísticos; a IA só editorializa. Fallback sem IA.
// ============================================================
function getCerebrasKey() {
    return process.env.CEREBRAS_KEY || process.env.CEREBRAS_API_KEY || null;
}

function fmtBR(iso) {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
}

function gerarFallbackTripinha(contexto) {
    const { simbolo, maisBarato, maisCaro, totalViagens, mesMaisBarato, comFeriado } = contexto;
    const economia = maisCaro.price - maisBarato.price;

    const escolha = {
        ida: maisBarato.ida,
        volta: maisBarato.volta,
        motivo: `A viagem mais barata do período: ${simbolo} ${maisBarato.price.toLocaleString('pt-BR')} indo ${nomeDiaSemana(maisBarato.ida, true)} e voltando ${nomeDiaSemana(maisBarato.volta, true)}!`,
    };

    if (economia > 0 && maisBarato.price > 0 && economia / maisBarato.price >= 0.3) {
        return {
            insight: `🐶 Farejei ${totalViagens} viagens na sua rota: indo ${fmtBR(maisBarato.ida)} você paga ${simbolo} ${maisBarato.price.toLocaleString('pt-BR')} — ${simbolo} ${economia.toLocaleString('pt-BR')} a menos que na semana mais cara!`,
            escolha,
        };
    }
    if (mesMaisBarato) {
        return {
            insight: `✈️ Na sua rota, ${mesMaisBarato.nome} é o mês mais em conta: dá pra ir por ${simbolo} ${mesMaisBarato.preco.toLocaleString('pt-BR')}. Já deixa marcado no calendário!`,
            escolha,
        };
    }
    if (comFeriado > 0) {
        return {
            insight: `📅 Achei ${totalViagens} opções de ida e volta na sua rota, ${comFeriado} pegando feriado — a mais barata sai por ${simbolo} ${maisBarato.price.toLocaleString('pt-BR')}!`,
            escolha,
        };
    }
    return {
        insight: `🐾 Sua rota tem ${totalViagens} idas e voltas nos próximos meses — a mais barata custa ${simbolo} ${maisBarato.price.toLocaleString('pt-BR')}, saindo ${fmtBR(maisBarato.ida)}. Bora matar a saudade?`,
        escolha,
    };
}

function validarEscolhaTripinha(escolha, viagens) {
    if (!escolha || !escolha.ida || !escolha.volta) return null;
    const hit = viagens.find(v => v.ida === escolha.ida && v.volta === escolha.volta);
    if (!hit) return null;
    return {
        ida: hit.ida,
        volta: hit.volta,
        motivo: String(escolha.motivo || '').trim().slice(0, 140),
    };
}

async function gerarTripinha(contexto, viagensTop) {
    const fallback = gerarFallbackTripinha(contexto);
    if (!getCerebrasKey()) return { ...fallback, modelo: 'fallback' };

    const { rotaLabel, simbolo, totalViagens, maisBarato, maisCaro, media, porMesResumo, feriadosResumo, faixaResumo, padraoLabel } = contexto;

    const systemMessage = `Você é a Tripinha, a cachorrinha mascote da Benetrip — uma plataforma de viagens. Você é simpática, animada e fala de forma coloquial em português brasileiro.

Contexto: a página "Vai e Vem" ajuda quem faz sempre a MESMA rota (visitar a família em outra cidade, namoro à distância, trabalho ou estudo longe de casa) a descobrir em quais semanas a passagem está mais barata, sem pesquisar manualmente toda hora.

Sua tarefa: gerar UMA frase curta e acolhedora (máximo 180 caracteres) interpretando o panorama de preços da rota — destaque o padrão mais útil (mês/semana mais barata, economia vs. semana cara, feriado que vale a pena). Tom de quem entende a saudade de casa.

Regras:
- Fale na primeira pessoa, como um story curto
- Use os NÚMEROS EXATOS fornecidos, nunca invente preços ou datas
- Use no máximo 1 emoji no início
- NÃO use hashtags, NÃO comece com "Ei" ou "Olha"

Além do insight, escolha 1 viagem da lista como "escolha da Tripinha" — o melhor custo-benefício considerando preço e feriados. Justifique em até 110 caracteres, factual.
Retorne APENAS um JSON: { "insight": "sua frase", "escolha": { "ida": "YYYY-MM-DD exato da lista", "volta": "YYYY-MM-DD exato da lista", "motivo": "justificativa curta" } }`;

    const userMessage = `Rota: ${rotaLabel} (${padraoLabel})
- Total de idas e voltas encontradas: ${totalViagens}
- Mais barata: ${simbolo} ${maisBarato.price.toLocaleString('pt-BR')} (ida ${maisBarato.ida} ${nomeDiaSemana(maisBarato.ida, true)}, volta ${maisBarato.volta} ${nomeDiaSemana(maisBarato.volta, true)})
- Mais cara: ${simbolo} ${maisCaro.price.toLocaleString('pt-BR')} (ida ${maisCaro.ida})
- Preço médio: ${simbolo} ${media.toLocaleString('pt-BR')}
- Por mês (mais barato de cada): ${porMesResumo}
${faixaResumo ? `- Faixa típica do Google para a rota: ${faixaResumo}` : ''}
${feriadosResumo ? `- Viagens pegando feriado: ${feriadosResumo}` : ''}
- Candidatas à escolha (as 8 mais baratas): ${viagensTop.map(v => `ida ${v.ida} volta ${v.volta} ${simbolo}${v.price}${v.feriados.length ? ` (${v.feriados[0].nome})` : ''}`).join('; ')}`;

    const models = [process.env.CEREBRAS_MODEL || 'gpt-oss-120b', process.env.CEREBRAS_MODEL_FALLBACK || 'zai-glm-4.7'];

    for (const model of models) {
        try {
            const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getCerebrasKey()}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: systemMessage },
                        { role: 'user', content: userMessage },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.9,
                    max_tokens: 1000,
                    reasoning_effort: model.startsWith('zai-glm') ? 'none' : 'low',
                }),
                signal: AbortSignal.timeout(8000),
            });

            if (!response.ok) continue;
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) continue;

            const parsed = JSON.parse(content);
            const insight = (parsed.insight || '').trim();
            if (!insight) continue;

            const escolha = validarEscolhaTripinha(parsed.escolha, viagensTop) || fallback.escolha;
            console.log(`✅ Tripinha VaiEVem (${model}): "${insight}"`);
            return { insight, escolha, modelo: model };
        } catch (err) {
            console.warn(`⚠️ Tripinha VaiEVem ${model}:`, err.message);
            continue;
        }
    }

    return { ...fallback, modelo: 'fallback' };
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    try {
        const { origem, destino, diasIda, diasVolta, meses, moeda } = req.body;

        const isValidCode = (code) => {
            const raw = String(code || '').trim();
            return raw.startsWith('/m/') || /^[A-Z]{3}$/i.test(raw) || /^[A-Z]{3}(,[A-Z]{3})+$/i.test(raw);
        };

        if (!origem || !isValidCode(origem)) {
            return res.status(400).json({ error: 'Origem inválida', message: 'Use código IATA (ex: GRU), múltiplos (GRU,CGH) ou kgmid (/m/02cft)' });
        }
        if (!destino || !isValidCode(destino)) {
            return res.status(400).json({ error: 'Destino inválido', message: 'Use código IATA (ex: REC), múltiplos ou kgmid' });
        }

        const isValidDias = (arr) => Array.isArray(arr) && arr.length > 0 && arr.length <= 7
            && arr.every(d => Number.isInteger(d) && d >= 0 && d <= 6);

        if (!isValidDias(diasIda)) {
            return res.status(400).json({ error: 'Dias de ida inválidos', message: 'Envie ao menos 1 dia da semana (0 = domingo ... 6 = sábado)' });
        }
        if (!isValidDias(diasVolta)) {
            return res.status(400).json({ error: 'Dias de volta inválidos', message: 'Envie ao menos 1 dia da semana (0 = domingo ... 6 = sábado)' });
        }

        const mesesNum = parseInt(meses);
        if (isNaN(mesesNum) || mesesNum < 1 || mesesNum > 6) {
            return res.status(400).json({ error: 'Meses inválidos', message: 'Escolha entre 1 e 6 meses' });
        }

        if (!process.env.SEARCHAPI_KEY) {
            return res.status(500).json({ error: 'SEARCHAPI_KEY não configurada' });
        }

        const formatCode = (code) => code.trim().startsWith('/m/') ? code.trim() : code.trim().toUpperCase();
        const origemCode = formatCode(origem);
        const destinoCode = formatCode(destino);
        const currencyCode = (moeda && /^[A-Z]{3}$/.test(moeda)) ? moeda.toUpperCase() : 'BRL';

        const localeMap = {
            'BRL': { gl: 'br', hl: 'pt-BR' },
            'USD': { gl: 'us', hl: 'en' },
            'EUR': { gl: 'de', hl: 'en' },
        };
        const locale = localeMap[currencyCode] || localeMap['BRL'];
        const simbolo = { 'BRL': 'R$', 'USD': 'US$', 'EUR': '€' }[currencyCode] || currencyCode;

        const setIda = new Set(diasIda);
        const setVolta = new Set(diasVolta);

        // Noites possíveis do padrão (define o deslocamento das janelas de volta)
        const noitesPossiveis = [];
        setIda.forEach(i => setVolta.forEach(v => noitesPossiveis.push(noitesEntreDias(i, v))));
        const minNoites = Math.min(...noitesPossiveis);
        const maxNoites = Math.max(...noitesPossiveis);

        console.log(`🔁 VaiEVem: ${origemCode} → ${destinoCode} | ida [${[...setIda]}] volta [${[...setVolta]}] | ${mesesNum} meses | noites ${minNoites}-${maxNoites}`);

        // ============================================================
        // BUSCA NAS JANELAS
        // ============================================================
        const startTime = Date.now();
        const startDate = addDays(new Date(), 1);
        const windows = generateSearchWindows(startDate, mesesNum * 30, minNoites, maxNoites);

        const results = await Promise.all(windows.map((window, idx) =>
            searchFlightsCalendar({
                flight_type: 'round_trip',
                departure_id: origemCode,
                arrival_id: destinoCode,
                currency: currencyCode,
                gl: locale.gl,
                hl: locale.hl,
                ...window,
            }, `Janela ${idx + 1}/${windows.length}`)
        ));

        // ============================================================
        // FILTRO PELO PADRÃO (dias da semana + primeira ocorrência)
        // ============================================================
        const horizonteFim = formatDate(addDays(startDate, mesesNum * 30));
        const unique = new Map();
        let errorsCount = 0;
        const errorDetails = [];
        let entradasComPreco = 0;
        const dowsIdaDisponiveis = new Set();
        const dowsVoltaDisponiveis = new Set();

        results.forEach(result => {
            if (result.error) {
                errorsCount++;
                if (result.errorDetail && errorDetails.length < 3) errorDetails.push(result.errorDetail);
                return;
            }
            result.calendar.forEach(entry => {
                if (entry.has_no_flights || !entry.price || !entry.departure || !entry.return) return;
                if (entry.departure > horizonteFim) return;

                const dowIda = diaDaSemana(entry.departure);
                const dowVolta = diaDaSemana(entry.return);
                entradasComPreco++;
                dowsIdaDisponiveis.add(dowIda);
                dowsVoltaDisponiveis.add(dowVolta);
                if (!setIda.has(dowIda) || !setVolta.has(dowVolta)) return;

                const noites = diffDays(entry.departure, entry.return);
                // 1..7 noites = a volta é a primeira ocorrência daquele dia após a ida
                if (noites < 1 || noites > 7) return;

                const key = `${entry.departure}_${entry.return}`;
                if (!unique.has(key) || entry.price < unique.get(key).price) {
                    unique.set(key, { ida: entry.departure, volta: entry.return, price: entry.price, noites });
                }
            });
        });

        const viagens = Array.from(unique.values()).sort((a, b) => a.price - b.price);

        if (viagens.length === 0) {
            // Todas as janelas falharam: problema no buscador (chave/cota do
            // SearchAPI, instabilidade), não ausência de voos — não confundir o usuário
            if (errorsCount === windows.length) {
                console.error(`❌ VaiEVem: todas as ${windows.length} janelas falharam. Amostra:`, errorDetails[0] || 'sem detalhe');
                return res.status(503).json({
                    error: 'Busca temporariamente indisponível',
                    message: 'Nosso buscador de preços está temporariamente indisponível. Tenta de novo em alguns minutos? 🐕',
                    _debug: { windows: windows.length, errorsCount, errorDetails },
                });
            }

            // A rota tem voos, mas nenhum nos dias escolhidos: dizer QUAIS dias têm voo
            // (rotas regionais muitas vezes só operam em dias específicos)
            if (entradasComPreco > 0) {
                const nomesDias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
                const listaDias = (set) => [...set].sort().map(d => nomesDias[d]).join(', ');
                return res.status(404).json({
                    error: 'Nenhum voo nos dias escolhidos',
                    message: `Essa rota tem voos, mas não achei combinações nos dias que você escolheu. Nos próximos ${mesesNum} meses, os voos de ida saem ${listaDias(dowsIdaDisponiveis)} e os de volta ${listaDias(dowsVoltaDisponiveis)}. Ajusta os dias e tenta de novo!`,
                    diasComVoo: { ida: [...dowsIdaDisponiveis].sort(), volta: [...dowsVoltaDisponiveis].sort() },
                });
            }

            return res.status(404).json({
                error: 'Nenhum voo encontrado',
                message: `O Google Flights não retornou preços de ${origemCode} para ${destinoCode} nos próximos ${mesesNum} meses. Se a rota é atendida por outro aeroporto da mesma cidade (ex.: em São Paulo, muitos voos regionais saem de Viracopos), tente buscar pela cidade em vez do aeroporto específico.`,
                _debug: { windows: windows.length, errorsCount, errorDetails },
            });
        }

        // ============================================================
        // FERIADOS NO PERÍODO DE CADA VIAGEM
        // ============================================================
        const anoAtual = new Date().getFullYear();
        const todosFeriados = [...feriadosDoAno(anoAtual), ...feriadosDoAno(anoAtual + 1)];
        viagens.forEach(v => {
            v.feriados = feriadosNoPeriodo(todosFeriados, v.ida, v.volta);
        });

        // ============================================================
        // ENRIQUECIMENTO (top N) + FAIXA TÍPICA DO GOOGLE
        // ============================================================
        const toEnrich = viagens.slice(0, ENRICH_TOP_N);
        const enrichResults = await Promise.all(toEnrich.map((v, idx) =>
            enrichFlightDetails(origemCode, destinoCode, v.ida, v.volta, currencyCode, locale, `#${idx + 1} ${v.ida}`)
        ));

        let faixaTipica = null;
        toEnrich.forEach((v, idx) => {
            const details = enrichResults[idx];
            if (details) {
                v.flight_details = details;
                if (!faixaTipica && details.price_insights?.typical_price_range) {
                    faixaTipica = details.price_insights.typical_price_range;
                }
            }
        });

        // ============================================================
        // CLASSIFICAÇÃO barato / normal / caro
        // ============================================================
        const precosOrdenados = viagens.map(v => v.price).sort((a, b) => a - b);
        const classificador = criarClassificador(faixaTipica, precosOrdenados);
        viagens.forEach(v => { v.classe = classificador.classificar(v.price); });

        // ============================================================
        // AGRUPAR POR SEMANA (segunda-feira da semana da ida)
        // ============================================================
        const porSemana = new Map();
        viagens.forEach(v => {
            const key = mondayOfWeek(v.ida);
            if (!porSemana.has(key)) porSemana.set(key, []);
            porSemana.get(key).push(v);
        });

        const semanas = Array.from(porSemana.entries())
            .map(([inicioSemana, opcoes]) => {
                const ordenadas = [...opcoes].sort((a, b) => a.price - b.price);
                return {
                    inicioSemana,
                    opcoes: ordenadas.sort((a, b) => a.ida.localeCompare(b.ida) || a.volta.localeCompare(b.volta)),
                    maisBarata: ordenadas.reduce((best, o) => (o.price < best.price ? o : best), ordenadas[0]),
                    temFeriado: ordenadas.some(o => o.feriados.length > 0),
                };
            })
            .sort((a, b) => a.inicioSemana.localeCompare(b.inicioSemana));

        // ============================================================
        // ESTATÍSTICAS + RESUMO POR MÊS
        // ============================================================
        const soma = viagens.reduce((acc, v) => acc + v.price, 0);
        const stats = {
            maisBarata: viagens[0],
            maisCara: viagens[viagens.length - 1],
            media: Math.round(soma / viagens.length),
            totalViagens: viagens.length,
            totalSemanas: semanas.length,
        };

        const nomesMes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        const porMes = new Map();
        viagens.forEach(v => {
            const mesKey = v.ida.slice(0, 7);
            if (!porMes.has(mesKey) || v.price < porMes.get(mesKey).price) {
                porMes.set(mesKey, { mes: mesKey, price: v.price, ida: v.ida, volta: v.volta });
            }
        });
        const mesesResumo = Array.from(porMes.values()).sort((a, b) => a.mes.localeCompare(b.mes));

        // ============================================================
        // TRIPINHA (insight + escolha) — com fallback determinístico
        // ============================================================
        const mesMaisBaratoEntry = [...mesesResumo].sort((a, b) => a.price - b.price)[0];
        const comFeriado = viagens.filter(v => v.feriados.length > 0).length;

        const diasLabel = (set) => [...set].sort().map(d => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d]).join('/');
        const contexto = {
            rotaLabel: `${origemCode} → ${destinoCode}`,
            padraoLabel: `ida ${diasLabel(setIda)}, volta ${diasLabel(setVolta)}, próximos ${mesesNum} meses`,
            simbolo,
            totalViagens: stats.totalViagens,
            maisBarato: stats.maisBarata,
            maisCaro: stats.maisCara,
            media: stats.media,
            porMesResumo: mesesResumo.map(m => `${nomesMes[parseInt(m.mes.slice(5)) - 1]} ${simbolo}${m.price}`).join(', '),
            mesMaisBarato: mesMaisBaratoEntry
                ? { nome: nomesMes[parseInt(mesMaisBaratoEntry.mes.slice(5)) - 1], preco: mesMaisBaratoEntry.price }
                : null,
            comFeriado,
            feriadosResumo: comFeriado > 0
                ? `${comFeriado} (ex.: ${viagens.find(v => v.feriados.length > 0).feriados[0].nome})`
                : null,
            faixaResumo: classificador.fonte === 'google'
                ? `${simbolo} ${classificador.faixa.low.toLocaleString('pt-BR')} a ${simbolo} ${classificador.faixa.high.toLocaleString('pt-BR')}`
                : null,
        };

        const tripinha = await gerarTripinha(contexto, viagens.slice(0, 8));

        const totalTime = Date.now() - startTime;
        console.log(`✅ VaiEVem completo em ${totalTime}ms | ${viagens.length} viagens em ${semanas.length} semanas | mais barata: ${simbolo} ${stats.maisBarata.price}`);

        return res.status(200).json({
            success: true,
            origem: origemCode,
            destino: destinoCode,
            moeda: currencyCode,
            meses: mesesNum,
            diasIda: [...setIda].sort(),
            diasVolta: [...setVolta].sort(),
            classificacao: { fonte: classificador.fonte, faixa: classificador.faixa },
            stats,
            semanas,
            mesesResumo,
            tripinha,
            _meta: {
                totalTime,
                windows: windows.length,
                errorsCount,
            },
        });

    } catch (error) {
        console.error('❌ Erro VaiEVem:', error);
        return res.status(500).json({ error: 'Erro ao buscar voos', message: error.message });
    }
}
