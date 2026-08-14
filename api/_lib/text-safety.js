// api/_lib/text-safety.js - BENETRIP TEXT SAFETY v1.0
//
// Fonte única de escaping/sanitização para todo texto que não foi escrito por
// nós: observações do usuário, nomes e descrições geradas por IA, nomes de
// lugares, companhias e agências, textos de APIs externas.
//
// Regra do projeto: NADA vindo de modelo ou fornecedor entra em innerHTML sem
// passar por aqui. URLs externas passam por safeExternalUrl antes de virar
// href — protocolo `javascript:` e afins são descartados.

// ============================================================
// ESCAPE DE HTML
// ============================================================
export function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Texto livre vindo de IA/usuário: além de escapar, corta tamanho e remove
// caracteres de controle que quebram o layout.
export function sanitizeText(text, { maxLength = 600 } = {}) {
    const bruto = String(text ?? '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const cortado = bruto.length > maxLength ? `${bruto.slice(0, maxLength - 1)}…` : bruto;
    return escapeHtml(cortado);
}

// ============================================================
// URLs EXTERNAS
// Só https: (e mailto:) viram href. Qualquer outra coisa devolve null e a
// interface deve simplesmente não renderizar o link.
// ============================================================
const PROTOCOLOS_PERMITIDOS = new Set(['https:', 'mailto:']);

export function safeExternalUrl(url, { permitirHttp = false } = {}) {
    const bruto = String(url ?? '').trim();
    if (!bruto) return null;

    // Caminho relativo do próprio site é sempre aceitável
    if (bruto.startsWith('/') && !bruto.startsWith('//')) return bruto;

    let parsed;
    try {
        parsed = new URL(bruto);
    } catch {
        return null;
    }

    const permitidos = permitirHttp
        ? new Set([...PROTOCOLOS_PERMITIDOS, 'http:'])
        : PROTOCOLOS_PERMITIDOS;

    if (!permitidos.has(parsed.protocol)) return null;
    return parsed.toString();
}

// href pronto para template: já escapado, ou string vazia se a URL não passou
export function safeHref(url, opts) {
    const limpa = safeExternalUrl(url, opts);
    return limpa ? escapeHtml(limpa) : '';
}

// Domínio legível para o rótulo "Ver fonte" (sem www.)
export function nomeDoDominio(url) {
    const limpa = safeExternalUrl(url);
    if (!limpa) return '';
    try {
        return new URL(limpa).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

// Serializa JSON para uso seguro dentro de <script>
export function jsonLdSafe(obj) {
    return JSON.stringify(obj)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
}
