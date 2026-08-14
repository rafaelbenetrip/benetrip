// api/_lib/escapadas-shared.js - BENETRIP ESCAPADAS SHARED v1.0
// Fonte única das JANELAS de escapada (fins de semana rolantes + próximos
// feriados nacionais) usada pelo cron api/cron/update-escapadas.js (escrita)
// e pela página api/escapadas-page.js (leitura/SSR).
//
// Cada janela vira um snapshot próprio na tabela discovery_snapshots,
// identificado pela coluna `tipo`:
//   fds-2026-07-10             -> fim de semana com ida na sexta 10/jul
//   feriado-independencia-2026 -> janela do feriado de 7 de setembro
// A constraint UNIQUE (data, origem, tipo) já cobre isso sem migração.

import {
    somarDias,
    diaDaSemana,
    diffDias,
    nomeDiaSemana,
    proximosFeriados,
    janelaDoFeriado,
    descricaoEmenda,
} from './feriados.js';
import { calcularVariacoesHistorico } from './discovery-shared.js';
import { avaliarViabilidade, NIVEL } from './travel-viability.js';

// Quantas janelas de cada tipo ficam vivas
export const FDS_ATIVOS = 3;
export const FERIADOS_ATIVOS = 3;

// Um fim de semana só vale a pena ser exibido/pesquisado se a sexta ainda
// estiver a pelo menos 2 dias: na quinta a janela "este fds" rola pra frente
// (preço de última hora ficaria enganoso no snapshot).
const MIN_DIAS_ATE_SEXTA = 2;

// Feriado entra na lista com pelo menos 10 dias de antecedência (antes disso
// a janela do feriado praticamente coincide com um fds já pesquisado) e até
// ~5 meses à frente (limite prático de antecedência de compra).
const MIN_DIAS_FERIADO = 10;
const MAX_DIAS_FERIADO = 150;

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function fmtCurta(iso) {
    const [, m, d] = iso.split('-').map(Number);
    return `${d} ${MESES_CURTOS[m - 1]}`;
}

export function hojeISO() {
    return new Date().toISOString().split('T')[0];
}

// ============================================================
// JANELAS ATIVAS
// Retorna a lista ordenada por data de ida:
// { id, categoria: 'fds'|'feriado', rotulo, rotuloDatas, ida, volta, noites,
//   feriado?: { nome, data, diaSemana, folga, emenda } }
// ============================================================
export function janelasAtivas(hoje = hojeISO()) {
    const janelas = [];

    // --- Fins de semana rolantes (sex -> dom, 2 noites) ---
    //
    // Rótulo cronológico honesto: "Este fim de semana" só vale para o fim de
    // semana IMEDIATO. Quando ele foi descartado por antecedência mínima
    // (comprar na quinta para sexta gera preço de última hora, que envelhece
    // mal no snapshot), a primeira janela passa a se chamar "Próximo fim de
    // semana com tarifas disponíveis" e a omissão é explicada na interface.
    const dow = diaDaSemana(hoje);
    const sextaImediata = somarDias(hoje, (5 - dow + 7) % 7);
    const diasAteSextaImediata = diffDias(hoje, sextaImediata);
    const fdsImediatoOmitido = diasAteSextaImediata < MIN_DIAS_ATE_SEXTA;
    const proximaSexta = fdsImediatoOmitido ? somarDias(sextaImediata, 7) : sextaImediata;

    for (let i = 0; i < FDS_ATIVOS; i++) {
        const ida = somarDias(proximaSexta, i * 7);
        const volta = somarDias(ida, 2);
        // O rótulo é curto de propósito: ele aparece no chip, na barra da
        // janela ativa e no título da lista, sempre ao lado das datas. Quando
        // o fds imediato sai, quem explica a omissão é `omitidoPorAntecedencia`
        // logo abaixo, não o rótulo.
        let rotulo;
        if (i === 0) {
            rotulo = fdsImediatoOmitido ? 'Próximo fim de semana' : 'Este fim de semana';
        } else if (i === 1) {
            rotulo = fdsImediatoOmitido ? 'Em 2 semanas' : 'Próximo fim de semana';
        } else {
            rotulo = fdsImediatoOmitido ? 'Em 3 semanas' : 'Em 2 semanas';
        }
        janelas.push({
            id: `fds-${ida}`,
            categoria: 'fds',
            rotulo,
            rotuloDatas: `${fmtCurta(ida)}–${fmtCurta(volta)}`,
            ida,
            volta,
            noites: 2,
            // A interface usa isto para explicar por que o fds mais próximo
            // não aparece, em vez de simplesmente sumir com ele.
            omitidoPorAntecedencia: i === 0 && fdsImediatoOmitido
                ? {
                    ida: sextaImediata,
                    volta: somarDias(sextaImediata, 2),
                    diasAte: diasAteSextaImediata,
                    explicacao: `O fim de semana de ${fmtCurta(sextaImediata)} ficou de fora: falta menos de ${MIN_DIAS_ATE_SEXTA} dias e o preço de última hora muda rápido demais.`,
                }
                : null,
        });
    }

    // --- Próximos feriados nacionais ---
    for (const feriado of proximosFeriados(hoje, FERIADOS_ATIVOS, MIN_DIAS_FERIADO)) {
        if (diffDias(hoje, feriado.data) > MAX_DIAS_FERIADO) continue;
        const j = janelaDoFeriado(feriado);
        janelas.push({
            id: `feriado-${feriado.slug}-${feriado.ano}`,
            categoria: 'feriado',
            rotulo: feriado.nome,
            rotuloDatas: `${fmtCurta(j.ida)}–${fmtCurta(j.volta)}`,
            ida: j.ida,
            volta: j.volta,
            noites: j.noites,
            feriado: {
                nome: feriado.nome,
                data: feriado.data,
                diaSemana: nomeDiaSemana(feriado.data),
                diasAte: diffDias(hoje, feriado.data),
                folga: j.folga,
                diasLivres: j.diasLivres,
                // Feriado em sábado/domingo não acrescenta dia livre nenhum
                estendeFimDeSemana: j.estendeFimDeSemana,
                emenda: descricaoEmenda(feriado),
            },
        });
    }

    // Feriado na sexta gera janela idêntica à do fds (ex.: 1/jan numa sexta):
    // mantém só a versão "feriado", que carrega o contexto da emenda.
    const idasDeFeriado = new Set(
        janelas.filter((j) => j.categoria === 'feriado').map((j) => `${j.ida}_${j.volta}`)
    );
    const dedup = janelas.filter(
        (j) => j.categoria !== 'fds' || !idasDeFeriado.has(`${j.ida}_${j.volta}`)
    );

    return dedup.sort((a, b) => a.ida.localeCompare(b.ida));
}

// ============================================================
// LEITURA DOS SNAPSHOTS DE UMA ORIGEM PARA TODAS AS JANELAS
// Uma query por janela seria 6 round-trips; aqui é UMA query com tipo=in.(...)
// e o snapshot mais recente de cada tipo é escolhido em memória. A variação
// de preço é calculada por janela (comparando snapshots do MESMO tipo).
// ============================================================
export async function fetchSnapshotsEscapadas(origem, janelas) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
    }

    const tipos = janelas.map((j) => j.id);
    const tipoIn = `in.(${tipos.map((t) => `"${t}"`).join(',')})`;
    const url = `${supabaseUrl}/rest/v1/discovery_snapshots?origem=eq.${encodeURIComponent(origem)}&tipo=${encodeURIComponent(tipoIn)}&select=*&order=data.desc&limit=${tipos.length * 8}`;

    const response = await fetch(url, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Supabase respondeu ${response.status} ao buscar escapadas de ${origem}: ${errorText.slice(0, 300)}`);
    }

    const rows = await response.json();
    const porTipo = new Map();
    for (const row of rows) {
        if (!porTipo.has(row.tipo)) porTipo.set(row.tipo, []);
        porTipo.get(row.tipo).push(row); // já vem em ordem data desc
    }

    const resultado = new Map();
    for (const janela of janelas) {
        const doTipo = porTipo.get(janela.id) || [];
        if (doTipo.length === 0) continue;
        const snapshot = doTipo[0];
        const destinos = calcularVariacoesHistorico(snapshot.destinos || [], doTipo.slice(1));
        resultado.set(janela.id, { ...snapshot, destinos });
    }
    return resultado;
}

// ============================================================
// BUSCA DE DESTINOS POR JANELA (SearchAPI google_travel_explore)
// Usada pelo cron api/cron/update-escapadas.js (snapshots das 30 cidades)
// e pelo endpoint api/escapadas-live.js (qualquer cidade, sob demanda).
// fds = 1 busca só Brasil (escapada de 2 noites é doméstica);
// feriado = Brasil + América do Sul (3+ dias viabilizam Buenos Aires etc).
// ============================================================
const BRASIL_KGMID = '/m/015fr';
const AMERICA_SUL_KGMID = '/m/0dg3n1';
export const MAX_DESTINOS_POR_JANELA = 30;
const MIN_NACIONAIS = 10; // reserva de nacionais nas janelas de feriado

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

export async function buscarDestinosJanela(origemCode, janela) {
    const apiKey = process.env.SEARCHAPI_KEY;
    if (!apiKey) throw new Error('SEARCHAPI_KEY não configurada');

    // Datas fixas no explore vão em time_period=IDA..VOLTA (round-trip).
    // outbound_date/return_date NÃO são parâmetros deste engine e eram
    // ignorados silenciosamente, devolvendo preços de "qualquer data".
    const baseParams = {
        engine: 'google_travel_explore',
        api_key: apiKey,
        departure_id: origemCode,
        time_period: `${janela.ida}..${janela.volta}`,
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

// ---- Classificação de estilo por keywords (mesmos estilos do discovery;
// sem IA aqui: o volume de janelas tornaria o batch via Cerebras caro
// sem ganho proporcional nos filtros) ----
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
// VIABILIDADE DA ESCAPADA
// A regra vive em api/_lib/travel-viability.js, compartilhada com as demais
// ferramentas: aqui ficou só o adaptador do shape dos snapshots.
// ============================================================
export { REGRAS_VIABILIDADE as VIABILIDADE_REGRAS, separarPorViabilidade } from './travel-viability.js';

export function classificarViabilidade({ duracaoVooMin, paradas, noites, deslocamentoTerrestreMin = null }) {
    return avaliarViabilidade({ noites, duracaoVooMin, paradas, deslocamentoTerrestreMin });
}

function formatarDestino(destino, posicao, janela) {
    const isInternacional = (destino.country || '').toLowerCase() !== 'brasil';
    // Fonte da verdade das datas é a resposta da API; a janela é o fallback.
    const dataIda = destino.outbound_date || janela.ida;
    const dataVolta = destino.return_date || janela.volta;
    if (destino.outbound_date && destino.outbound_date !== janela.ida) {
        console.warn(`⚠️ [Escapadas] Engine devolveu ida ${destino.outbound_date} para janela ${janela.id} (${destino.name})`);
    }

    const duracaoVooMin = destino.flight?.flight_duration_minutes || 0;
    const paradas = destino.flight?.stops || 0;
    // Zero sem fonte confirmada = dado ausente, não hospedagem grátis.
    const custoNoite = destino.avg_cost_per_night > 0 ? destino.avg_cost_per_night : null;

    return {
        posicao,
        nome: destino.name || '',
        pais: destino.country || '',
        aeroporto: destino.flight?.airport_code || destino.primary_airport || '',
        preco: destino.flight?.price || 0,
        moeda: 'BRL',
        paradas,
        duracao_voo_min: duracaoVooMin || null,
        cia_aerea: destino.flight?.airline_name || '',
        custo_noite: custoNoite,
        imagem: destino.image || '',
        estilos: classificarEstilos(destino),
        duracao_ideal: { min: janela.noites, max: janela.noites, ideal: janela.noites },
        internacional: isInternacional,
        data_ida: dataIda,
        data_volta: dataVolta,
        viabilidade: classificarViabilidade({ duracaoVooMin, paradas, noites: janela.noites }),
    };
}

// Seleciona (reserva de nacionais + mais baratos) e formata os destinos
// crus da SearchAPI no shape dos snapshots. Retorna [] se nada com preço.
// Destinos inviáveis para a janela (voo longo demais para o número de
// noites) não são removidos, mas vão para o FIM da lista — a auditoria
// pediu que não apareçam entre as melhores escapadas, sem esconder a opção.
export function selecionarEFormatarDestinos(destinosRaw, janela) {
    const comPreco = destinosRaw
        .filter((d) => d.flight?.price > 0)
        .sort((a, b) => a.flight.price - b.flight.price);
    if (comPreco.length === 0) return [];

    const nacionais = comPreco.filter((d) => (d.country || '').toLowerCase() === 'brasil');
    const internacionais = comPreco.filter((d) => (d.country || '').toLowerCase() !== 'brasil');
    const reservados = nacionais.slice(0, MIN_NACIONAIS);
    const pool = [...nacionais.slice(MIN_NACIONAIS), ...internacionais]
        .sort((a, b) => a.flight.price - b.flight.price)
        .slice(0, MAX_DESTINOS_POR_JANELA - reservados.length);

    const formatados = [...reservados, ...pool]
        .sort((a, b) => a.flight.price - b.flight.price)
        .map((d, i) => formatarDestino(d, i + 1, janela));

    return ordenarPorViabilidade(formatados);
}

// Reordena: recomendáveis (por preço) primeiro, depois os de viabilidade
// desconhecida e por último os inviáveis. Reatribui `posicao` para bater com
// a ordem exibida. A separação em duas listas (principal x seção fechada)
// acontece na renderização, via separarPorViabilidade().
export function ordenarPorViabilidade(destinos) {
    const peso = { [NIVEL.BOA]: 0, [NIVEL.ACEITAVEL]: 1, [NIVEL.DESCONHECIDA]: 2, [NIVEL.INVIAVEL]: 3 };
    return [...destinos]
        .sort((a, b) => {
            const pa = peso[a.viabilidade?.nivel] ?? 2;
            const pb = peso[b.viabilidade?.nivel] ?? 2;
            return pa - pb || (a.preco || 0) - (b.preco || 0);
        })
        .map((d, i) => ({ ...d, posicao: i + 1 }));
}
