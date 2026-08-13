// api/_lib/smart-filter.js - FILTRO EM LINGUAGEM NATURAL v1.0
//
// O filtro inteligente pedia ao LLM uma lista de índices e confiava nela.
// Isso não garante o pedido: "praia para família, sem escalas, até R$ 1.500"
// podia voltar com destino de 2 escalas ou acima do teto.
//
// Aqui a IA interpreta o pedido em FILTROS ESTRUTURADOS e a aplicação desses
// filtros é determinística. A IA continua ordenando por relevância, mas não
// consegue furar um critério objetivo. Os filtros interpretados também voltam
// para a tela, para o usuário ver como foi entendido e poder ajustar.

export const CAMPOS_FILTRO = [
    'precoMax', 'precoMin', 'estilos', 'pais', 'internacional',
    'direto', 'maxParadas', 'duracaoMaxMin', 'familia', 'aeroporto', 'periodo',
];

// Normaliza o objeto vindo da IA, descartando o que não for reconhecido
export function normalizarFiltros(bruto) {
    const f = bruto && typeof bruto === 'object' ? bruto : {};
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
    const bool = (v) => (typeof v === 'boolean' ? v : null);
    const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

    const estilos = Array.isArray(f.estilos)
        ? f.estilos.filter(e => typeof e === 'string' && e.trim()).map(e => e.trim().toLowerCase())
        : [];

    return {
        precoMax: num(f.precoMax),
        precoMin: num(f.precoMin),
        estilos,
        pais: str(f.pais),
        internacional: bool(f.internacional),
        direto: bool(f.direto),
        maxParadas: typeof f.maxParadas === 'number' && f.maxParadas >= 0 ? f.maxParadas : null,
        duracaoMaxMin: num(f.duracaoMaxMin),
        familia: bool(f.familia),
        aeroporto: str(f.aeroporto) ? str(f.aeroporto).toUpperCase() : null,
        periodo: str(f.periodo),
    };
}

// Aplicação determinística: um destino só passa se atender TODOS os critérios
// explícitos. Critério não informado não filtra nada.
export function aplicarFiltrosEstruturados(destinos, filtros) {
    const f = normalizarFiltros(filtros);
    const indices = [];

    (destinos || []).forEach((d, i) => {
        if (f.precoMax !== null && !(d.preco > 0 && d.preco <= f.precoMax)) return;
        if (f.precoMin !== null && !(d.preco >= f.precoMin)) return;

        if (f.estilos.length > 0) {
            const estilosDestino = (d.estilos || []).map(e => String(e).toLowerCase());
            if (!f.estilos.some(e => estilosDestino.includes(e))) return;
        }
        // "para família" é um estilo declarado, não uma suposição
        if (f.familia === true) {
            const estilosDestino = (d.estilos || []).map(e => String(e).toLowerCase());
            if (!estilosDestino.includes('familia')) return;
        }

        if (f.pais !== null && String(d.pais || '').toLowerCase() !== f.pais.toLowerCase()) return;
        if (f.internacional !== null && Boolean(d.internacional) !== f.internacional) return;

        // Voo direto: só passa quando o dado existe e é zero
        if (f.direto === true && (d.paradas ?? null) !== 0) return;
        if (f.maxParadas !== null && !((d.paradas ?? Infinity) <= f.maxParadas)) return;

        // Duração ausente (null) não pode passar por um filtro de duração
        if (f.duracaoMaxMin !== null) {
            const dur = d.duracao_voo_min;
            if (!(typeof dur === 'number' && dur > 0 && dur <= f.duracaoMaxMin)) return;
        }

        if (f.aeroporto !== null && String(d.aeroporto || '').toUpperCase() !== f.aeroporto) return;

        if (f.periodo !== null) {
            const ida = String(d.data_ida || '');
            if (!ida.startsWith(f.periodo)) return;
        }

        indices.push(i);
    });

    return indices;
}

/**
 * Combina a ordem de relevância sugerida pela IA com os filtros objetivos.
 * Só entram destinos que passaram nos filtros; a ordem da IA é respeitada
 * para os que ela citou, e o restante segue por preço.
 */
export function combinarComRelevancia(destinos, filtros, indicesIA, limite = 20) {
    const permitidos = new Set(aplicarFiltrosEstruturados(destinos, filtros));
    const ordenados = [];

    for (const i of indicesIA || []) {
        if (permitidos.has(i) && !ordenados.includes(i)) ordenados.push(i);
    }
    const restantes = [...permitidos]
        .filter(i => !ordenados.includes(i))
        .sort((a, b) => (destinos[a].preco || 0) - (destinos[b].preco || 0));

    return [...ordenados, ...restantes].slice(0, limite);
}

// Frase legível do que foi entendido — mostrada na tela para o usuário
// conferir e ajustar.
export function descreverFiltros(filtros) {
    const f = normalizarFiltros(filtros);
    const partes = [];
    if (f.estilos.length > 0) partes.push(`estilo: ${f.estilos.join(', ')}`);
    if (f.familia === true) partes.push('para família');
    if (f.precoMax !== null) partes.push(`até R$ ${f.precoMax.toLocaleString('pt-BR')}`);
    if (f.precoMin !== null) partes.push(`a partir de R$ ${f.precoMin.toLocaleString('pt-BR')}`);
    if (f.direto === true) partes.push('somente voo direto');
    else if (f.maxParadas !== null) partes.push(`até ${f.maxParadas} parada${f.maxParadas !== 1 ? 's' : ''}`);
    if (f.duracaoMaxMin !== null) partes.push(`voo de até ${Math.round(f.duracaoMaxMin / 60)}h`);
    if (f.internacional === true) partes.push('destinos internacionais');
    if (f.internacional === false) partes.push('destinos nacionais');
    if (f.pais !== null) partes.push(`país: ${f.pais}`);
    if (f.aeroporto !== null) partes.push(`aeroporto ${f.aeroporto}`);
    if (f.periodo !== null) partes.push(`período: ${f.periodo}`);
    return partes;
}
