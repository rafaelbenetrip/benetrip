/**
 * BENETRIP FLIGHT LINKS v1.0 — módulo compartilhado
 *
 * Regra transversal da auditoria: o link externo deve usar o aeroporto REAL
 * da tarifa encontrada. Quando a busca foi feita por cidade agregada (SAO,
 * RIO...) e o aeroporto da tarifa é conhecido (ex.: menor preço saiu de VCP),
 * o CTA abre exatamente esse aeroporto — nunca "o primeiro da lista" (GRU).
 * Quando o aeroporto real NÃO é conhecido, o link codifica TODOS os
 * aeroportos do grupo (o formato tfs do Google Flights aceita campos
 * repetidos por trecho), preservando a busca agregada.
 *
 * Exposto em window.BenetripFlightLinks (browser) e module.exports (testes).
 */
(function (root, factory) {
    const mod = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = mod;
    if (root) root.BenetripFlightLinks = mod;
})(typeof window !== 'undefined' ? window : globalThis, function () {

    // ── Protobuf helpers (mesmo encoding tfs/tfu já usado nas páginas) ──
    function varint(n) {
        const bytes = [];
        let v = n >>> 0;
        while (v > 127) { bytes.push((v & 0x7f) | 0x80); v >>>= 7; }
        bytes.push(v & 0x7f);
        return bytes;
    }
    function tag(field, wire) { return varint((field << 3) | wire); }
    function varintField(field, value) { return [...tag(field, 0), ...varint(value)]; }
    function stringField(field, str) {
        const enc = typeof TextEncoder !== 'undefined'
            ? new TextEncoder().encode(str)
            : Uint8Array.from(Buffer.from(str, 'utf-8'));
        return [...tag(field, 2), ...varint(enc.length), ...enc];
    }
    function messageField(field, bytes) { return [...tag(field, 2), ...varint(bytes.length), ...bytes]; }
    function toBase64Url(bytes) {
        const bin = String.fromCharCode(...bytes);
        const b64 = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function airportMsg(iata) { return [...varintField(1, 1), ...stringField(2, iata)]; }

    // Um trecho com 1..N aeroportos de origem e 1..N de destino
    function legMsg(date, originIatas, destIatas) {
        const bytes = [...stringField(2, date)];
        for (const o of originIatas) bytes.push(...messageField(13, airportMsg(o)));
        for (const d of destIatas) bytes.push(...messageField(14, airportMsg(d)));
        return bytes;
    }

    function normList(value) {
        const arr = Array.isArray(value) ? value : [value];
        return arr.filter(v => typeof v === 'string' && /^[A-Z]{3}$/i.test(v.trim()))
            .map(v => v.trim().toUpperCase());
    }

    /**
     * Resolve os aeroportos a usar no link.
     * @param {object|string} lugar  objeto de cidade do autocomplete
     *        ({code, isCityCode, aeroportosIncluidos}) ou IATA string
     * @param {string|null} aeroportoReal  aeroporto efetivo da tarifa, se conhecido
     * @returns {{codes: string[], resolvido: 'tarifa'|'grupo'|'unico'|null}}
     */
    function resolveAirports(lugar, aeroportoReal) {
        if (aeroportoReal && /^[A-Z]{3}$/i.test(aeroportoReal)) {
            return { codes: [aeroportoReal.toUpperCase()], resolvido: 'tarifa' };
        }
        if (typeof lugar === 'string') {
            const codes = normList(lugar.split(','));
            return { codes, resolvido: codes.length > 1 ? 'grupo' : 'unico' };
        }
        if (lugar && lugar.isCityCode && Array.isArray(lugar.aeroportosIncluidos) && lugar.aeroportosIncluidos.length > 0) {
            return { codes: normList(lugar.aeroportosIncluidos), resolvido: 'grupo' };
        }
        if (lugar && lugar.code && /^[A-Z]{3}$/i.test(lugar.code)) {
            return { codes: [lugar.code.toUpperCase()], resolvido: 'unico' };
        }
        return { codes: [], resolvido: null };
    }

    /**
     * Monta a URL do Google Flights.
     * origins/destinations aceitam string IATA ou array de IATAs.
     */
    function buildUrl({ origins, destinations, departDate, returnDate, adults = 1, children = 0, infants = 0, currency = 'BRL' }) {
        const o = normList(origins);
        const d = normList(destinations);
        if (o.length === 0 || d.length === 0 || !departDate) return null;

        const tfsBytes = [
            ...varintField(1, 28),
            ...varintField(2, returnDate ? 2 : 1),
            ...messageField(3, legMsg(departDate, o, d)),
        ];
        if (returnDate) tfsBytes.push(...messageField(3, legMsg(returnDate, d, o)));
        tfsBytes.push(...varintField(14, 1));

        const tfu = toBase64Url(messageField(2, [
            ...varintField(1, Math.max(1, adults | 0)),
            ...varintField(2, Math.max(0, children | 0)),
            ...varintField(3, Math.max(0, infants | 0)),
        ]));

        const currMap = { BRL: 'BRL', USD: 'USD', EUR: 'EUR' };
        const hlMap = { BRL: 'pt-BR', USD: 'en', EUR: 'en' };
        const glMap = { BRL: 'br', USD: 'us', EUR: 'de' };
        const params = new URLSearchParams();
        params.set('tfs', toBase64Url(tfsBytes));
        params.set('tfu', tfu);
        params.set('curr', currMap[currency] || 'BRL');
        params.set('hl', hlMap[currency] || 'pt-BR');
        params.set('gl', glMap[currency] || 'br');
        return `https://www.google.com/travel/flights/search?${params.toString()}`;
    }

    return { resolveAirports, buildUrl, _internals: { varint, legMsg, toBase64Url } };
});
