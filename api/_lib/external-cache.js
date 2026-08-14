// api/_lib/external-cache.js - BENETRIP CACHE TÉCNICO v1.0
//
// Cache em memória (por instância serverless) de RESPOSTAS EXTERNAS.
// Existe para reduzir custo e latência de chamadas a APIs de lugares,
// geocodificação, rotas, clima, busca com grounding e propostas de voo.
//
// Regra de produto: isto NÃO é uma base curada. Toda entrada tem TTL, carrega
// a data da verificação e é descartada ao expirar. Nada aqui é editado à mão
// nem vira fonte de verdade — se o provedor externo não responder e o cache
// estiver vazio, a informação é omitida.

const store = new Map();

// Teto de entradas para não vazar memória entre invocações reaproveitadas.
const MAX_ENTRADAS = 500;

export function getCache(chave) {
    const entrada = store.get(chave);
    if (!entrada) return null;
    if (Date.now() > entrada.expiraEm) {
        store.delete(chave);
        return null;
    }
    return entrada.valor;
}

export function setCache(chave, valor, ttlMs) {
    if (store.size >= MAX_ENTRADAS) {
        // Descarte simples do mais antigo inserido (Map preserva ordem)
        const primeira = store.keys().next().value;
        if (primeira !== undefined) store.delete(primeira);
    }
    store.set(chave, { valor, expiraEm: Date.now() + ttlMs, gravadoEm: Date.now() });
    return valor;
}

// Envelope comum: executa `fn` quando não há cache válido.
export async function comCache(chave, ttlMs, fn) {
    const cacheado = getCache(chave);
    if (cacheado !== null) return cacheado;
    const valor = await fn();
    if (valor !== undefined && valor !== null) setCache(chave, valor, ttlMs);
    return valor;
}

export function limparCache() {
    store.clear();
}

export function tamanhoCache() {
    return store.size;
}
