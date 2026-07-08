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
    const dow = diaDaSemana(hoje);
    let proximaSexta = somarDias(hoje, (5 - dow + 7) % 7); // sexta desta semana ou a próxima
    if (diffDias(hoje, proximaSexta) < MIN_DIAS_ATE_SEXTA) {
        proximaSexta = somarDias(proximaSexta, 7);
    }

    for (let i = 0; i < FDS_ATIVOS; i++) {
        const ida = somarDias(proximaSexta, i * 7);
        const volta = somarDias(ida, 2);
        janelas.push({
            id: `fds-${ida}`,
            categoria: 'fds',
            rotulo: i === 0 ? 'Este fim de semana' : i === 1 ? 'Próximo fim de semana' : 'Em 2 semanas',
            rotuloDatas: `${fmtCurta(ida)}–${fmtCurta(volta)}`,
            ida,
            volta,
            noites: 2,
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
