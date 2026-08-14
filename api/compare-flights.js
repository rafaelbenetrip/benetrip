// api/compare-flights.js - BENETRIP COMPARAR VOOS v2.2
// v2.2: Suporte a aeroportos agrupados via kgmid (SAO, RIO, NYC, etc.)
//       SearchAPI aceita tanto IATA codes (GRU) quanto kgmid (/m/022pfm) como departure_id/arrival_id
// v2.1: cheaper_alternatives, fare_type, baggage_allowance_links (SearchAPI update)
// Suporte a adultos, crianças (2-11) e bebês (0-2)

import { analisarItinerario } from './_lib/roundtrip.js';
import {
    QUOTE_TYPE,
    CELL_STATE,
    avaliarCompletudeTarifa,
    avaliarCompletudeCombinacao,
    avaliarComparabilidade,
    descreverBebes,
} from './_lib/quote-completeness.js';
import {
    travelpayoutsDisponivel,
    buscarPropostaIdaEVolta,
    comLimiteDeConcorrencia,
} from './_lib/travelpayouts.js';

export const maxDuration = 60;

const MAX_IDAS = 4;
const MAX_VOLTAS = 4;
const MAX_PAX_TOTAL = 9;
const BATCH_SIZE = 4;

// A auditoria limita a comparação a 16 combinações (4 idas x 4 voltas).
const MAX_COMBINACOES = MAX_IDAS * MAX_VOLTAS;

// Enriquecimento com propostas completas de ida e volta (Travelpayouts):
// concorrência baixa para não estourar o fornecedor e orçamento de tempo
// global para caber no maxDuration da função.
const ENRIQUECIMENTO = {
    concorrencia: 4,
    timeoutPorCombinacaoMs: 18000,
    orcamentoTotalMs: 40000,
};

async function searchFlights(params, label) {
    const url = new URL('https://www.searchapi.io/api/v1/search');

    const fullParams = {
        engine: 'google_flights',
        api_key: process.env.SEARCHAPI_KEY,
        ...params,
    };

    Object.entries(fullParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });

    const startTime = Date.now();

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const elapsed = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Flights][${label}] HTTP ${response.status} (${elapsed}ms):`, errorText.substring(0, 300));
            return { flights: [], error: `HTTP ${response.status}`, elapsed };
        }

        const data = await response.json();
        const bestFlights = data.best_flights || [];
        const otherFlights = data.other_flights || [];
        const allFlights = [...bestFlights, ...otherFlights];
        const priceInsights = data.price_insights || null;

        // v2.1: capturar cheaper_alternatives retornadas pela API
        const cheaperAlternatives = data.cheaper_alternatives || [];

        console.log(`[Flights][${label}] ${allFlights.length} voos (${bestFlights.length} best + ${otherFlights.length} other) | ${cheaperAlternatives.length} alternativas mais baratas (${elapsed}ms)`);

        return { flights: allFlights, priceInsights, cheaperAlternatives, error: null, elapsed, isBest: bestFlights.length };
    } catch (err) {
        const elapsed = Date.now() - startTime;
        console.error(`[Flights][${label}] Erro (${elapsed}ms):`, err.message);
        return { flights: [], error: err.message, elapsed };
    }
}

function extractFlightDetails(flight, isBestFlight, rota = {}) {
    const legs = flight.flights || [];
    const layovers = flight.layovers || [];

    const airlines = new Map();
    legs.forEach(leg => {
        if (leg.airline) airlines.set(leg.airline, { name: leg.airline, logo: leg.airline_logo || '' });
    });

    const flightLegs = legs.map(leg => ({
        departure_airport: {
            id: leg.departure_airport?.id || '',
            name: leg.departure_airport?.name || '',
            time: leg.departure_airport?.time || '',
        },
        arrival_airport: {
            id: leg.arrival_airport?.id || '',
            name: leg.arrival_airport?.name || '',
            time: leg.arrival_airport?.time || '',
        },
        airline: leg.airline || '',
        airline_logo: leg.airline_logo || '',
        flight_number: leg.flight_number || '',
        duration: leg.duration || 0,
        airplane: leg.airplane || '',
        travel_class: leg.travel_class || 'Economy',
        legroom: leg.legroom || '',
        extensions: leg.extensions || [],
        often_delayed_by_over_30_min: leg.often_delayed_by_over_30_min || false,
    }));

    const layoverDetails = layovers.map(l => ({
        airport: l.name || '',
        airport_id: l.id || '',
        duration: l.duration || 0,
        overnight: l.overnight || false,
    }));

    // O engine devolve a tarifa de ida e volta, mas normalmente só os trechos
    // da IDA — a volta é escolhida depois no Google Flights. Aqui olhamos os
    // trechos reais para a interface não vender itinerário que não existe.
    const itinerario = analisarItinerario(flightLegs, rota);

    // Aeroportos EFETIVOS da tarifa (numa busca por cidade agregada o
    // resultado pode sair de VCP em vez de GRU)
    const aeroportoOrigemReal = flightLegs[0]?.departure_airport?.id || null;
    const aeroportoDestinoReal = (itinerario.ida[itinerario.ida.length - 1]?.arrival_airport?.id)
        || flightLegs[flightLegs.length - 1]?.arrival_airport?.id
        || null;

    return {
        price: flight.price || 0,
        total_duration: flight.total_duration || 0,
        stops: layovers.length,
        airlines: Array.from(airlines.values()),
        legs: flightLegs,
        layovers: layoverDetails,
        is_best: isBestFlight,
        itinerario_completo: itinerario.completo,
        trechos_ida: itinerario.ida.length,
        trechos_volta: itinerario.volta.length,
        aeroporto_origem: aeroportoOrigemReal,
        aeroporto_destino: aeroportoDestinoReal,
        carbon_emissions: flight.carbon_emissions?.this_flight
            ? Math.round(flight.carbon_emissions.this_flight / 1000)
            : null,
        booking_token: flight.booking_token || null,
        type: flight.type || 'round_trip',
        extensions: flight.extensions || [],
        // v2.1: novos campos da SearchAPI
        fare_type: flight.fare_type || null,
        baggage_allowance_links: flight.baggage_allowance_links || null,
    };
}

// ════════════════════════════════════════════════════════════
// ENRIQUECIMENTO COM PROPOSTAS COMPLETAS DE IDA E VOLTA
//
// O engine de calendário devolve tarifa inicial. Para poder eleger um
// vencedor precisamos de propostas com os DOIS trechos definidos, e essas
// vêm do provedor da Busca clássica (Travelpayouts), reaproveitado aqui com:
// limite de concorrência, timeout por combinação, orçamento total de tempo,
// acumulação de propostas entre lotes e cache por rota/passageiros/datas.
//
// Nada é presumido: se o provedor não devolver a viagem completa, a célula
// continua indicativa.
// ════════════════════════════════════════════════════════════
async function enriquecerComPropostasCompletas({
    combinacoesResult, origemCode, destinoCode, adultos, criancas, bebes, moeda, userIp,
}) {
    const pendentes = combinacoesResult.filter(
        c => c.melhorPreco && c.completude?.quoteType === QUOTE_TYPE.INDICATIVE
    );

    if (pendentes.length === 0) {
        return { tentado: false, motivo: 'nada_pendente', resolvidas: 0 };
    }
    if (!travelpayoutsDisponivel()) {
        console.log('ℹ️ Propostas completas indisponíveis (AVIASALES_TOKEN/MARKER ausentes): matriz permanece indicativa');
        return { tentado: false, motivo: 'provedor_indisponivel', resolvidas: 0 };
    }

    // O provedor exige IATA de 3 letras. Numa busca por cidade agregada usamos
    // o aeroporto EFETIVO da tarifa mais barata de cada combinação.
    const alvos = pendentes.slice(0, MAX_COMBINACOES).map(c => {
        const maisBarato = (c.voos || [])[0] || null;
        return {
            combo: c,
            origem: iataValido(maisBarato?.aeroporto_origem) || iataValido(origemCode),
            destino: iataValido(maisBarato?.aeroporto_destino) || iataValido(destinoCode),
        };
    }).filter(a => a.origem && a.destino);

    if (alvos.length === 0) {
        return { tentado: false, motivo: 'sem_iata_resolvido', resolvidas: 0 };
    }

    const inicio = Date.now();
    let resolvidas = 0;

    await comLimiteDeConcorrencia(alvos, ENRIQUECIMENTO.concorrencia, async (alvo) => {
        // Orçamento global: quem não coube fica indicativo, sem travar a resposta
        const restante = ENRIQUECIMENTO.orcamentoTotalMs - (Date.now() - inicio);
        if (restante < 5000) return null;

        const proposta = await buscarPropostaIdaEVolta(
            {
                origem: alvo.origem,
                destino: alvo.destino,
                dataIda: alvo.combo.dataIda,
                dataVolta: alvo.combo.dataVolta,
                adultos, criancas, bebes, moeda, userIp,
            },
            { timeoutMs: Math.min(ENRIQUECIMENTO.timeoutPorCombinacaoMs, restante) }
        );

        if (!proposta?.encontrada || !proposta.temLinkDeCompra) {
            alvo.combo.propostaCompleta = { encontrada: false, motivo: proposta?.motivo || 'sem_proposta' };
            return null;
        }

        alvo.combo.propostaCompleta = proposta;
        alvo.combo.melhorPreco = proposta.preco;
        alvo.combo.completude = {
            ...avaliarCompletudeTarifa(
                {
                    trechos_ida: proposta.trechosIda,
                    trechos_volta: proposta.trechosVolta,
                    itinerario_completo: true,
                    booking_token: 'travelpayouts',
                },
                { buscaIdaEVolta: true, verificadoEm: proposta.verificadoEm }
            ),
            estado: CELL_STATE.COMPLETA,
            voosComVolta: 1,
            voosTotal: (alvo.combo.voos || []).length,
            fonte: 'busca_completa',
        };
        resolvidas++;
        return proposta;
    });

    const info = {
        tentado: true,
        motivo: null,
        pendentes: pendentes.length,
        consultadas: alvos.length,
        resolvidas,
        tempoMs: Date.now() - inicio,
    };
    console.log(`🔎 Propostas completas: ${resolvidas}/${alvos.length} resolvidas em ${info.tempoMs}ms`);
    return info;
}

function iataValido(code) {
    return /^[A-Z]{3}$/i.test(String(code || '')) ? String(code).toUpperCase() : null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    try {
        const { origem, destino, origemDisplay, destinoDisplay, origemIsCityCode, destinoIsCityCode, origemAeroportos, destinoAeroportos, datasIda, datasVolta, moeda, adultos, criancas, bebes } = req.body;

        // v2.2: Validação aceita IATA (3 letras) ou kgmid (/m/...)
        const isValidCode = (code) => /^[A-Z]{3}$/i.test(code) || /^\/m\/[a-z0-9_]+$/i.test(code);

        if (!origem || !isValidCode(origem))
            return res.status(400).json({ error: 'Origem inválida (IATA 3 letras ou código de cidade)' });
        if (!destino || !isValidCode(destino))
            return res.status(400).json({ error: 'Destino inválido (IATA 3 letras ou código de cidade)' });
        if (!Array.isArray(datasIda) || datasIda.length === 0 || datasIda.length > MAX_IDAS)
            return res.status(400).json({ error: `Informe 1 a ${MAX_IDAS} datas de ida` });
        if (!Array.isArray(datasVolta) || datasVolta.length === 0 || datasVolta.length > MAX_VOLTAS)
            return res.status(400).json({ error: `Informe 1 a ${MAX_VOLTAS} datas de volta` });

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        for (const d of [...datasIda, ...datasVolta]) {
            if (!dateRegex.test(d))
                return res.status(400).json({ error: `Data inválida: ${d} (use YYYY-MM-DD)` });
        }

        if (!process.env.SEARCHAPI_KEY)
            return res.status(500).json({ error: 'SEARCHAPI_KEY não configurada' });

        // v2.2: kgmid codes (/m/...) são enviados tal qual para a SearchAPI
        // IATA codes são normalizados para uppercase
        const origemCode = origem.startsWith('/m/') ? origem.trim() : origem.toUpperCase().trim();
        const destinoCode = destino.startsWith('/m/') ? destino.trim() : destino.toUpperCase().trim();
        const origemLabel = origemDisplay || origemCode;
        const destinoLabel = destinoDisplay || destinoCode;
        const currencyCode = (moeda && /^[A-Z]{3}$/.test(moeda)) ? moeda : 'BRL';

        // ── Passageiros ──────────────────────────────────────────────
        const numAdultos = Math.min(Math.max(parseInt(adultos) || 1, 1), MAX_PAX_TOTAL);
        const numCriancas = Math.min(Math.max(parseInt(criancas) || 0, 0), MAX_PAX_TOTAL);
        const numBebes = Math.min(Math.max(parseInt(bebes) || 0, 0), 4);

        const totalPagantes = Math.min(numAdultos + numCriancas, MAX_PAX_TOTAL);
        const adultosFinal = Math.min(numAdultos, MAX_PAX_TOTAL);
        const criancasFinal = Math.max(0, totalPagantes - adultosFinal);
        const paxParaPreco = adultosFinal + criancasFinal;

        const combinacoes = [];
        for (const ida of datasIda)
            for (const volta of datasVolta)
                if (volta > ida) combinacoes.push({ dataIda: ida, dataVolta: volta });

        if (combinacoes.length === 0)
            return res.status(400).json({
                error: 'Nenhuma combinação válida',
                message: 'As datas de volta devem ser posteriores às de ida',
            });

        console.log(`✈️ Compare Flights v2.2: ${origemLabel}(${origemCode})→${destinoLabel}(${destinoCode}) | ${combinacoes.length} combos | ${adultosFinal}A/${criancasFinal}C/${numBebes}B | ${currencyCode}`);

        const localeMap = {
            'BRL': { gl: 'br', hl: 'pt-BR' },
            'USD': { gl: 'us', hl: 'en' },
            'EUR': { gl: 'de', hl: 'en' },
        };
        const locale = localeMap[currencyCode] || localeMap['BRL'];

        const startTime = Date.now();
        const allResults = [];

        for (let i = 0; i < combinacoes.length; i += BATCH_SIZE) {
            const batch = combinacoes.slice(i, i + BATCH_SIZE);

            const promises = batch.map((combo, idx) => {
                const label = `${combo.dataIda}→${combo.dataVolta} (#${i + idx + 1})`;
                const params = {
                    departure_id: origemCode,
                    arrival_id: destinoCode,
                    outbound_date: combo.dataIda,
                    return_date: combo.dataVolta,
                    flight_type: 'round_trip',
                    currency: currencyCode,
                    gl: locale.gl,
                    hl: locale.hl,
                    adults: String(adultosFinal),
                };
                if (criancasFinal > 0) params.children = String(criancasFinal);
                if (numBebes > 0) params.infants_on_lap = String(numBebes);

                return searchFlights(params, label).then(result => ({ combo, ...result }));
            });

            const batchResults = await Promise.all(promises);
            allResults.push(...batchResults);
        }

        const totalTime = Date.now() - startTime;

        const combinacoesResult = [];
        const todasCompanhias = new Map();
        let globalCheapest = Infinity;
        let globalCheapestCombo = null;

        // v2.1: acumular cheaper_alternatives de todas as buscas
        const searchedKeys = new Set(combinacoes.map(c => `${c.dataIda}_${c.dataVolta}`));
        const rawCheaperAlts = new Map(); // key -> {departure, return, price}

        for (const result of allResults) {
            const { combo, flights, priceInsights, cheaperAlternatives, error, elapsed } = result;
            const d1 = new Date(combo.dataIda + 'T00:00:00Z');
            const d2 = new Date(combo.dataVolta + 'T00:00:00Z');
            const noites = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));

            // v2.1: coletar alternativas mais baratas retornadas pela API para essa busca
            if (cheaperAlternatives && cheaperAlternatives.length > 0) {
                cheaperAlternatives.forEach(alt => {
                    if (!alt.departure_date || !alt.return_date || !alt.price) return;
                    const altKey = `${alt.departure_date}_${alt.return_date}`;
                    // Ignorar datas que já foram pesquisadas
                    if (searchedKeys.has(altKey)) return;
                    if (!rawCheaperAlts.has(altKey) || alt.price < rawCheaperAlts.get(altKey).price) {
                        rawCheaperAlts.set(altKey, {
                            departure: alt.departure_date,
                            return: alt.return_date,
                            price: alt.price,
                        });
                    }
                });
            }

            if (error || !flights.length) {
                combinacoesResult.push({ dataIda: combo.dataIda, dataVolta: combo.dataVolta, noites, voos: [], melhorPreco: null, priceInsights: null, error: error || 'Sem voos', elapsed });
                continue;
            }

            const voosDetalhados = flights.map((f, idx) => {
                // Cidade agregada: a rota aceita qualquer aeroporto do grupo
                const details = extractFlightDetails(f, idx < result.isBest, {
                    origem: (origemIsCityCode && Array.isArray(origemAeroportos) && origemAeroportos.length)
                        ? origemAeroportos : origemCode,
                    destino: (destinoIsCityCode && Array.isArray(destinoAeroportos) && destinoAeroportos.length)
                        ? destinoAeroportos : destinoCode,
                });
                details.airlines.forEach(a => { if (!todasCompanhias.has(a.name)) todasCompanhias.set(a.name, a); });
                return details;
            });

            voosDetalhados.sort((a, b) => a.price - b.price);
            const melhorPreco = voosDetalhados[0]?.price || null;

            if (melhorPreco && melhorPreco < globalCheapest) {
                globalCheapest = melhorPreco;
                globalCheapestCombo = combo;
            }

            combinacoesResult.push({
                dataIda: combo.dataIda,
                dataVolta: combo.dataVolta,
                noites,
                voos: voosDetalhados,
                melhorPreco,
                totalVoos: voosDetalhados.length,
                priceInsights,
                error: null,
                elapsed,
            });
        }

        // v2.1: filtrar e ordenar alternativas — só manter as mais baratas que o globalCheapest
        const cheaperAlternativesFinal = Array.from(rawCheaperAlts.values())
            .filter(alt => alt.price < globalCheapest)
            .sort((a, b) => a.price - b.price)
            .slice(0, 5);

        if (cheaperAlternativesFinal.length > 0) {
            console.log(`💡 ${cheaperAlternativesFinal.length} alternativas mais baratas encontradas | Mais barata: ${cheaperAlternativesFinal[0].price} ${currencyCode} (${cheaperAlternativesFinal[0].departure}→${cheaperAlternativesFinal[0].return})`);
        }

        const precosValidos = combinacoesResult.filter(c => c.melhorPreco).map(c => c.melhorPreco);

        if (!precosValidos.length) {
            return res.status(404).json({
                error: 'Nenhum voo encontrado',
                message: `Não foram encontrados voos de ${origemLabel} para ${destinoLabel} nas datas selecionadas.`,
                combinacoesTestadas: combinacoes.length,
            });
        }

        // ════════════════════════════════════════════════════════════
        // COMPLETUDE DA TARIFA (P0)
        // O engine devolve o preço da tarifa de ida e volta mas normalmente só
        // os trechos da IDA. Antes de dizer qual combinação é mais barata é
        // preciso saber o que cada preço representa.
        // ════════════════════════════════════════════════════════════
        combinacoesResult.forEach(c => {
            c.completude = avaliarCompletudeCombinacao(c, { buscaIdaEVolta: true });
        });

        // Solução preferencial: buscar propostas COMPLETAS de ida e volta no
        // provedor da Busca clássica para as combinações que ficaram apenas
        // indicativas. Falha, timeout ou provedor indisponível mantêm o modo
        // indicativo — nunca fabricamos um itinerário fechado.
        const enriquecimento = await enriquecerComPropostasCompletas({
            combinacoesResult,
            origemCode,
            destinoCode,
            adultos: adultosFinal,
            criancas: criancasFinal,
            bebes: numBebes,
            moeda: currencyCode,
            userIp: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '127.0.0.1',
        });

        const matrizPrecos = {};
        combinacoesResult.forEach(c => {
            matrizPrecos[`${c.dataIda}_${c.dataVolta}`] = {
                dataIda: c.dataIda, dataVolta: c.dataVolta, noites: c.noites,
                melhorPreco: c.melhorPreco, totalVoos: c.totalVoos || 0, error: c.error,
                estado: c.completude.estado,
                quoteType: c.completude.quoteType,
                priceIncludesReturn: c.completude.priceIncludesReturn,
                hasBookableProposal: c.completude.hasBookableProposal,
                priceVerifiedAt: c.completude.priceVerifiedAt,
            };
        });

        // Só é possível eleger vencedor quando todas as células com preço
        // representam a viagem completa e há diferença real entre elas.
        const comparabilidade = avaliarComparabilidade(
            combinacoesResult.map(c => ({ preco: c.melhorPreco, quoteType: c.completude.quoteType }))
        );

        // O enriquecimento pode ter trocado o preço de uma célula pela proposta
        // completa: as estatísticas são recalculadas sobre os valores finais.
        const precosFinais = combinacoesResult.filter(c => c.melhorPreco).map(c => c.melhorPreco);
        const comboMaisBarata = combinacoesResult
            .filter(c => c.melhorPreco)
            .reduce((menor, c) => (!menor || c.melhorPreco < menor.melhorPreco ? c : menor), null);

        const sum = precosFinais.reduce((a, b) => a + b, 0);
        const stats = {
            cheapest: comboMaisBarata ? comboMaisBarata.melhorPreco : globalCheapest,
            cheapestCombo: comboMaisBarata
                ? { dataIda: comboMaisBarata.dataIda, dataVolta: comboMaisBarata.dataVolta }
                : globalCheapestCombo,
            average: Math.round(sum / precosFinais.length),
            mostExpensive: Math.max(...precosFinais),
            totalCombinacoes: combinacoes.length,
            combinacoesComVoo: precosFinais.length,
            combinacoesSemVoo: combinacoes.length - precosFinais.length,
            // A interface só pode destacar vencedor/economia com isto ligado
            comparavel: comparabilidade.comparavel,
        };

        // A busca só entrega itinerário fechado se TODOS os voos exibidos
        // trouxerem o trecho de volta; senão o preço é tarifa inicial.
        const todosOsVoos = combinacoesResult.flatMap(c => c.voos || []);
        const comItinerarioCompleto = todosOsVoos.filter(v => v.itinerario_completo).length;
        const celulasComPreco = combinacoesResult.filter(c => c.melhorPreco);
        const itinerarioInfo = {
            completo: celulasComPreco.length > 0
                && celulasComPreco.every(c => c.completude.quoteType === QUOTE_TYPE.BOOKABLE),
            voosComVolta: comItinerarioCompleto,
            voosTotal: todosOsVoos.length,
            celulasCompletas: celulasComPreco.filter(c => c.completude.estado === CELL_STATE.COMPLETA).length,
            celulasIndicativas: celulasComPreco.filter(c => c.completude.estado === CELL_STATE.INDICATIVA).length,
        };
        console.log(`🔁 Itinerário: ${comItinerarioCompleto}/${todosOsVoos.length} voos com trecho de volta | células completas: ${itinerarioInfo.celulasCompletas}/${celulasComPreco.length} | comparável: ${comparabilidade.comparavel}`);

        console.log(`✅ Completo em ${totalTime}ms | ${origemLabel}→${destinoLabel} | Mais barato: ${stats.cheapest} ${currencyCode} | Pax: ${adultosFinal}A/${criancasFinal}C/${numBebes}B | Alternativas: ${cheaperAlternativesFinal.length}`);

        return res.status(200).json({
            success: true,
            origem: origemCode,
            destino: destinoCode,
            origemDisplay: origemLabel,
            destinoDisplay: destinoLabel,
            origemIsCityCode: origemIsCityCode || false,
            destinoIsCityCode: destinoIsCityCode || false,
            moeda: currencyCode,
            adultos: adultosFinal,
            criancas: criancasFinal,
            bebes: numBebes,
            paxParaPreco,
            // Bebê de colo não é "grátis" por regra universal: o aviso depende
            // de o fornecedor ter precificado o bebê nesta busca.
            bebesInfo: descreverBebes({ bebes: numBebes, precoInclui: false }),
            datasIda,
            datasVolta,
            stats,
            itinerario: itinerarioInfo,
            comparabilidade,
            matrizPrecos,
            combinacoes: combinacoesResult,
            companhias: Array.from(todasCompanhias.values()),
            // v2.1: alternativas mais baratas fora das datas pesquisadas
            cheaperAlternatives: cheaperAlternativesFinal,
            _meta: {
                totalTime,
                totalCombinacoes: combinacoes.length,
                batchSize: BATCH_SIZE,
                enriquecimento,
            },
        });

    } catch (error) {
        console.error('❌ Erro geral:', error);
        return res.status(500).json({ error: 'Erro ao comparar voos', message: error.message });
    }
}
