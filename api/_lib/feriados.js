// api/_lib/feriados.js - FERIADOS NACIONAIS DO BRASIL v1.0
// Calcula feriados nacionais de qualquer ano por código (fixos + móveis via
// data da Páscoa), sem lista mantida à mão. Usado pela página /escapadas e
// pelo cron update-escapadas para montar janelas de viagem em feriados.
//
// Todas as datas são strings 'YYYY-MM-DD' manipuladas via Date UTC ao meio-dia
// para nunca depender do timezone do servidor.

// ============================================================
// HELPERS DE DATA (UTC, sem timezone)
// ============================================================
export function dataISO(ano, mes, dia) {
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function paraDate(iso) {
    return new Date(iso + 'T12:00:00Z');
}

export function somarDias(iso, dias) {
    const d = paraDate(iso);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().split('T')[0];
}

// 0 = domingo ... 6 = sábado
export function diaDaSemana(iso) {
    return paraDate(iso).getUTCDay();
}

export function diffDias(isoA, isoB) {
    return Math.round((paraDate(isoB) - paraDate(isoA)) / 86400000);
}

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const DIAS_SEMANA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function nomeDiaSemana(iso, curto = false) {
    return (curto ? DIAS_SEMANA_CURTO : DIAS_SEMANA)[diaDaSemana(iso)];
}

// ============================================================
// PÁSCOA (algoritmo de Meeus/Jones/Butcher, calendário gregoriano)
// ============================================================
export function calcularPascoa(ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return dataISO(ano, mes, dia);
}

// ============================================================
// FERIADOS NACIONAIS DE UM ANO
// Lei 662/1949, 6.802/1980, 10.607/2002 e 14.759/2023 (Consciência Negra).
// Carnaval e Corpus Christi não são feriados nacionais por lei, mas são
// folga generalizada no país inteiro — entram marcados como 'facultativo'.
// ============================================================
export function feriadosDoAno(ano) {
    const pascoa = calcularPascoa(ano);
    const feriados = [
        { slug: 'confraternizacao', nome: 'Confraternização Universal', data: dataISO(ano, 1, 1), oficial: true },
        { slug: 'carnaval', nome: 'Carnaval', data: somarDias(pascoa, -47), oficial: false },
        { slug: 'sexta-santa', nome: 'Sexta-feira Santa', data: somarDias(pascoa, -2), oficial: true },
        { slug: 'tiradentes', nome: 'Tiradentes', data: dataISO(ano, 4, 21), oficial: true },
        { slug: 'dia-do-trabalho', nome: 'Dia do Trabalho', data: dataISO(ano, 5, 1), oficial: true },
        { slug: 'corpus-christi', nome: 'Corpus Christi', data: somarDias(pascoa, 60), oficial: false },
        { slug: 'independencia', nome: 'Independência do Brasil', data: dataISO(ano, 9, 7), oficial: true },
        { slug: 'aparecida', nome: 'Nossa Senhora Aparecida', data: dataISO(ano, 10, 12), oficial: true },
        { slug: 'finados', nome: 'Finados', data: dataISO(ano, 11, 2), oficial: true },
        { slug: 'proclamacao', nome: 'Proclamação da República', data: dataISO(ano, 11, 15), oficial: true },
        { slug: 'consciencia-negra', nome: 'Dia da Consciência Negra', data: dataISO(ano, 11, 20), oficial: true },
        { slug: 'natal', nome: 'Natal', data: dataISO(ano, 12, 25), oficial: true },
    ];
    return feriados
        .map((f) => ({ ...f, ano, diaSemana: diaDaSemana(f.data) }))
        .sort((a, b) => a.data.localeCompare(b.data));
}

// Próximos feriados a partir de uma data (inclui o ano seguinte na virada)
export function proximosFeriados(aPartirDe, limite = 3, minDiasAntecedencia = 0) {
    const ano = Number(aPartirDe.slice(0, 4));
    const todos = [...feriadosDoAno(ano), ...feriadosDoAno(ano + 1)];
    return todos
        .filter((f) => diffDias(aPartirDe, f.data) >= minDiasAntecedencia)
        .slice(0, limite);
}

// ============================================================
// JANELA DE ESCAPADA DE UM FERIADO
// Retorna a janela de viagem "sem tirar férias": ida/volta coladas no bloco
// de dias não úteis, e quantos dias de folga a emenda exige (0 = nenhum).
// ============================================================
export function janelaDoFeriado(feriado) {
    const dow = feriado.diaSemana;
    const d = feriado.data;
    let ida, volta, folga;

    switch (dow) {
        case 1: // segunda: sáb -> seg, 3 dias sem folga
            ida = somarDias(d, -2); volta = d; folga = 0; break;
        case 2: // terça: sáb -> ter emendando a segunda
            ida = somarDias(d, -3); volta = d; folga = 1; break;
        case 3: // quarta: qua -> dom emendando qui+sex
            ida = d; volta = somarDias(d, 4); folga = 2; break;
        case 4: // quinta: qui -> dom emendando a sexta
            ida = d; volta = somarDias(d, 3); folga = 1; break;
        case 5: // sexta: sex -> dom, 3 dias sem folga
            ida = d; volta = somarDias(d, 2); folga = 0; break;
        case 6: // sábado: fim de semana normal
            ida = somarDias(d, -1); volta = somarDias(d, 1); folga = 0; break;
        default: // domingo: fim de semana normal terminando no feriado
            ida = somarDias(d, -2); volta = d; folga = 0; break;
    }

    return {
        ida,
        volta,
        folga,
        noites: diffDias(ida, volta),
        diasLivres: diffDias(ida, volta) + 1,
    };
}

// Frase curta sobre a emenda, usada na barra de feriados da página
export function descricaoEmenda(feriado) {
    const janela = janelaDoFeriado(feriado);
    const dia = nomeDiaSemana(feriado.data);
    if (feriado.diaSemana === 6 || feriado.diaSemana === 0) {
        return `cai no ${dia} — rende um fim de semana de ${janela.diasLivres} dias`;
    }
    if (janela.folga === 0) {
        return `cai numa ${dia} — ${janela.diasLivres} dias de viagem sem pedir folga`;
    }
    return `cai numa ${dia} — emendando ${janela.folga} dia${janela.folga > 1 ? 's' : ''} rende ${janela.diasLivres} dias de viagem`;
}
