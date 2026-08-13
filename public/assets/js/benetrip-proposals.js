/**
 * BENETRIP PROPOSALS v1.0 — consolidação de resultados de busca
 *
 * A busca de voos da Travelpayouts entrega os resultados em LOTES: cada
 * polling traz o que as agências responderam desde a consulta anterior, não
 * um retrato completo da busca. Substituir a lista a cada polling (o que a
 * interface fazia) fazia ofertas sumirem sem explicação — foi assim que uma
 * busca caiu de 3.280 ofertas / R$ 1.091 para 2.134 ofertas / R$ 1.122.
 *
 * Aqui as propostas são acumuladas num Map:
 *  - chave estável: `sign` do fornecedor; sem ele, assinatura derivada de
 *    agência, companhia, voos, aeroportos, datas e horários;
 *  - um lote novo MESCLA (agências novas entram, preço melhor atualiza);
 *  - ausência num lote NÃO remove nada — o lote é parcial, não um snapshot;
 *  - propostas sem link de compra válido são descartadas (não dá para
 *    mostrar uma oferta que ninguém consegue abrir).
 *
 * Exposto em window.BenetripProposals (browser) e module.exports (testes).
 */
(function (root, factory) {
    const mod = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = mod;
    if (root) root.BenetripProposals = mod;
})(typeof window !== 'undefined' ? window : globalThis, function () {

    // Assinatura estável de uma proposta sem `sign` do fornecedor:
    // itinerário completo (voo, aeroportos, datas e horários por trecho).
    function signatureOf(proposal) {
        if (proposal.sign) return `sign:${proposal.sign}`;
        const segs = (proposal.segments || []).map(seg =>
            (seg.flights || []).map(f =>
                [f.flight_number, f.departure_airport, f.arrival_airport,
                 f.departure_date, f.departure_time, f.arrival_date, f.arrival_time].join('~')
            ).join('|')
        ).join('→');
        return `itin:${segs}`;
    }

    function hasValidUrl(proposal) {
        if (proposal.terms_url) return true;
        return (proposal.all_terms || []).some(t => t && t.url);
    }

    // Mescla as ofertas de agências (all_terms) de duas propostas iguais,
    // mantendo o menor preço válido por agência.
    function mergeTerms(existingTerms, incomingTerms) {
        const byGate = new Map();
        for (const t of existingTerms || []) {
            if (t && t.url) byGate.set(t.gate_id, t);
        }
        for (const t of incomingTerms || []) {
            if (!t || !t.url) continue;
            const prev = byGate.get(t.gate_id);
            if (!prev || t.price < prev.price) byGate.set(t.gate_id, t);
        }
        return Array.from(byGate.values()).sort((a, b) => a.price - b.price);
    }

    /**
     * Aplica um lote de propostas sobre o acumulado.
     * @param {Map} store  Map de assinatura -> proposta consolidada
     * @param {Array} batch propostas do polling atual
     * @param {number} timestamp Date.now() do lote
     * @returns {{added:number, updated:number, skipped:number, total:number}}
     */
    function mergeBatch(store, batch, timestamp = Date.now()) {
        let added = 0, updated = 0, skipped = 0;

        for (const incoming of batch || []) {
            if (!incoming || !hasValidUrl(incoming)) { skipped++; continue; }

            const key = signatureOf(incoming);
            const existing = store.get(key);

            if (!existing) {
                store.set(key, { ...incoming, _key: key, _firstSeen: timestamp, _lastSeen: timestamp });
                added++;
                continue;
            }

            // Mesma proposta vista de novo: consolida agências e preço
            const allTerms = mergeTerms(existing.all_terms, incoming.all_terms);
            const merged = {
                ...existing,
                ...incoming,
                _key: key,
                _firstSeen: existing._firstSeen,
                _lastSeen: timestamp,
                all_terms: allTerms,
            };

            // O preço exibido é sempre o da melhor agência válida consolidada
            const melhor = allTerms[0];
            if (melhor) {
                merged.price = melhor.price;
                merged.price_raw_rub = melhor.price_rub ?? merged.price_raw_rub;
                merged.gate_id = melhor.gate_id;
                merged.gate_name = melhor.gate_name;
                merged.terms_url = melhor.url;
                merged.term_currency = melhor.original_currency ?? merged.term_currency;
            }

            store.set(key, merged);
            updated++;
        }

        return { added, updated, skipped, total: store.size };
    }

    /**
     * Lista consolidada, ordenada por preço.
     * Propostas que perderam o link de compra saem da lista (expiraram do
     * lado do fornecedor); ausência num lote, por si só, nunca remove.
     */
    function toList(store) {
        return Array.from(store.values())
            .filter(hasValidUrl)
            .sort((a, b) => a.price - b.price);
    }

    /**
     * REGRA DE EXPIRAÇÃO DE LINKS (documentada)
     *
     * O link de compra do fornecedor tem validade curta: abrir um link velho
     * leva a "oferta indisponível". A regra é:
     *   - uma proposta vista pela última vez há mais de VALIDADE_LINK_MS é
     *     considerada com link expirado;
     *   - expirado NÃO é o mesmo que inexistente: a oferta continua na lista,
     *     marcada como `_linkExpirado`, para o usuário saber que precisa
     *     refazer a busca em vez de a lista encolher sem explicação;
     *   - só a ausência de link válido (nunca a ausência num lote parcial)
     *     remove de fato uma proposta.
     */
    var VALIDADE_LINK_MS = 15 * 60 * 1000;

    function marcarLinksExpirados(store, agora) {
        var t = agora || Date.now();
        var expirados = 0;
        store.forEach(function (p, key) {
            var expirado = (t - (p._lastSeen || t)) > VALIDADE_LINK_MS;
            // O campo é sempre gravado (inclusive false): a interface precisa
            // distinguir "link vigente" de "ainda não avaliado".
            if (p._linkExpirado !== expirado) {
                store.set(key, Object.assign({}, p, { _linkExpirado: expirado }));
            }
            if (expirado) expirados++;
        });
        return expirados;
    }

    /**
     * Resumo do ciclo de busca, para registro e para a interface.
     * Inicial, final, adicionadas, atualizadas, descartadas sem link e tempo.
     */
    function resumoDaBusca(estado) {
        var e = estado || {};
        return {
            quantidadeInicial: e.quantidadeInicial || 0,
            quantidadeFinal: e.quantidadeFinal || 0,
            adicionadas: e.adicionadas || 0,
            atualizadas: e.atualizadas || 0,
            descartadasSemLink: e.descartadasSemLink || 0,
            lotes: e.lotes || 0,
            tempoTotalMs: e.tempoTotalMs || 0,
        };
    }

    return {
        signatureOf: signatureOf,
        mergeBatch: mergeBatch,
        toList: toList,
        mergeTerms: mergeTerms,
        hasValidUrl: hasValidUrl,
        marcarLinksExpirados: marcarLinksExpirados,
        resumoDaBusca: resumoDaBusca,
        VALIDADE_LINK_MS: VALIDADE_LINK_MS,
    };
});
