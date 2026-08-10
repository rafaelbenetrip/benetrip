// api/_lib/cron-lotes.js - Rodízio de lotes dos crons (discovery e escapadas)
//
// Os crons processam as cidades em lotes rotativos. O índice do lote é
// derivado do dia (UTC) + do horário da execução, então o rodízio continua
// avançando mesmo com poucas execuções por dia: com 1 execução/dia o lote
// muda a cada dia e todas as cidades seguem sendo atualizadas, só que em
// dias alternados.
//
// COMO ESCALAR A FREQUÊNCIA:
// 1. Adicionar horários no cron correspondente em vercel.json
//    (ex.: "0 6,18 * * *" para 2 execuções/dia)
// 2. Definir a env var do cron com o MESMO número de execuções
//    (DISCOVERY_EXECUCOES_POR_DIA=2 / ESCAPADAS_EXECUCOES_POR_DIA=2)
// Os dois PRECISAM andar juntos: a env var diz ao cálculo de lote quantos
// slots o dia tem. Env var maior que o número real de execuções faz o
// rodízio pular lotes; menor faz a mesma execução repetir lote (gastando
// SearchAPI à toa nas mesmas cidades).

// Lê quantas execuções por dia o cron faz (mínimo 1).
export function lerExecucoesPorDia(envValue) {
    const n = parseInt(envValue, 10);
    return Number.isInteger(n) && n >= 1 ? n : 1;
}

// Calcula o lote da execução atual.
// - totalLotes: ceil(totalCidades / cidadesPorLote)
// - execPorDia: quantas vezes o cron roda por dia (ver lerExecucoesPorDia)
// - forcarLote: override manual via query (?lote=N)
// - agora: injetável para teste
export function calcularLote(totalLotes, execPorDia, forcarLote, agora = new Date()) {
    if (forcarLote !== undefined && forcarLote !== null) {
        const lote = parseInt(forcarLote);
        if (!isNaN(lote) && lote >= 0) return lote;
    }
    if (totalLotes <= 0) return 0;

    // Slot do dia: divide as 24h em execPorDia janelas iguais (6h -> slot 0
    // com 2 execuções; 18h -> slot 1). Com 1 execução/dia o slot é sempre 0.
    const slot = Math.min(execPorDia - 1, Math.floor(agora.getUTCHours() / (24 / execPorDia)));

    // Contador global de execuções desde a época: garante que o rodízio
    // avança entre dias (dia N processa o lote seguinte ao do dia N-1).
    const diasUTC = Math.floor(agora.getTime() / 86400000);
    return (diasUTC * execPorDia + slot) % totalLotes;
}
