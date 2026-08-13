/**
 * BENETRIP ANALYTICS v1.0 — eventos das ferramentas
 *
 * Envia para o Vercel Analytics (window.va), já presente nas páginas. Sem
 * ferramenta configurada, os eventos só aparecem no console em modo debug —
 * nada quebra.
 *
 * REGRA: nenhum dado pessoal. Observações livres do usuário, e-mail, nome e
 * texto de busca NUNCA são enviados; do texto livre vai apenas o comprimento
 * e se ele existia, o que basta para medir uso sem expor conteúdo.
 *
 * Exposto em window.BenetripAnalytics (browser) e module.exports (testes).
 */
(function (root, factory) {
    const mod = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = mod;
    if (root) root.BenetripAnalytics = mod;
})(typeof window !== 'undefined' ? window : globalThis, function () {

    const EVENTOS = [
        'tool_viewed',
        'search_submitted',
        'search_completed',
        'search_failed',
        'empty_result',
        'filters_applied',
        'result_clicked',
        'external_flight_clicked',
        'alert_requested',
        'itinerary_generated',
        'itinerary_constraint_violation',
    ];

    // Campos que jamais podem sair daqui, mesmo que alguém os passe por engano
    const CAMPOS_PROIBIDOS = [
        'observacoes', 'observacao', 'query', 'texto', 'email', 'nome', 'name',
        'user', 'usuario', 'telefone', 'cpf', 'token', 'password', 'senha',
    ];

    function sanitizar(props) {
        const saida = {};
        for (const [chave, valor] of Object.entries(props || {})) {
            if (CAMPOS_PROIBIDOS.includes(chave.toLowerCase())) continue;
            if (valor === null || valor === undefined) continue;
            // Só tipos primitivos curtos viram propriedade de evento
            if (typeof valor === 'number' || typeof valor === 'boolean') {
                saida[chave] = valor;
            } else if (typeof valor === 'string') {
                saida[chave] = valor.slice(0, 60);
            }
        }
        return saida;
    }

    function track(evento, props = {}) {
        if (!EVENTOS.includes(evento)) {
            console.warn(`[Analytics] Evento desconhecido: ${evento}`);
            return null;
        }
        const payload = sanitizar(props);
        try {
            if (typeof window !== 'undefined' && typeof window.va === 'function') {
                window.va('event', { name: evento, ...payload });
            }
        } catch (err) {
            // Analytics nunca pode derrubar a página
            console.warn('[Analytics] Falha ao enviar evento:', err.message);
        }
        return { evento, props: payload };
    }

    // Atalhos com os campos que a auditoria pediu por evento
    return {
        EVENTOS,
        sanitizar,
        track,
        toolViewed: (ferramenta) => track('tool_viewed', { ferramenta }),
        searchSubmitted: (ferramenta, dados) => track('search_submitted', { ferramenta, ...dados }),
        searchCompleted: (ferramenta, { duracaoMs, resultados, escopo, flexivel } = {}) =>
            track('search_completed', { ferramenta, duracao_ms: duracaoMs, resultados, escopo, flexivel }),
        searchFailed: (ferramenta, { duracaoMs, motivo } = {}) =>
            track('search_failed', { ferramenta, duracao_ms: duracaoMs, motivo }),
        emptyResult: (ferramenta, dados) => track('empty_result', { ferramenta, ...dados }),
        filtersApplied: (ferramenta, { filtro, valor } = {}) =>
            track('filters_applied', { ferramenta, filtro, valor }),
        resultClicked: (ferramenta, { posicao, tipo } = {}) =>
            track('result_clicked', { ferramenta, posicao, tipo }),
        externalFlightClicked: (ferramenta, { destino, aeroporto } = {}) =>
            track('external_flight_clicked', { ferramenta, destino, aeroporto }),
        alertRequested: (ferramenta, dados) => track('alert_requested', { ferramenta, ...dados }),
        itineraryGenerated: (dados) => track('itinerary_generated', dados),
        itineraryConstraintViolation: (dados) => track('itinerary_constraint_violation', dados),
    };
});
