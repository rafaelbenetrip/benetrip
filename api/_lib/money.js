// api/_lib/money.js - BENETRIP NORMALIZAÇÃO MONETÁRIA v1.0
//
// Método único de arredondamento e formatação. A auditoria encontrou o mesmo
// valor exibido como R$ 786 em um ponto e R$ 787 em outro: isso acontece
// quando cada tela arredonda o preço por pessoa do seu jeito (Math.round de um
// total já arredondado, Math.floor, toFixed em cadeia).
//
// Regra: TODO valor exibido passa por normalizarValor(). Divisões por número
// de passageiros passam por precoPorPessoa(), que sempre arredonda a partir do
// valor bruto (nunca de um valor já arredondado).

export const MOEDAS = {
    BRL: { simbolo: 'R$', locale: 'pt-BR' },
    USD: { simbolo: 'US$', locale: 'pt-BR' },
    EUR: { simbolo: '€', locale: 'pt-BR' },
};

export function simboloMoeda(moeda) {
    return MOEDAS[String(moeda || '').toUpperCase()]?.simbolo || 'R$';
}

// Um único ponto de arredondamento: meio para cima, sem casas decimais.
// Valores não numéricos viram null (ausência de dado), nunca 0.
export function normalizarValor(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    let n;
    if (typeof valor === 'number') {
        n = valor;
    } else {
        const limpo = String(valor).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
        // String sem dígito nenhum é ausência de dado, não zero
        n = /\d/.test(limpo) ? Number(limpo) : NaN;
    }
    if (!Number.isFinite(n)) return null;
    return Math.round(n);
}

// Zero sem fonte confirmada NÃO é "de graça": é dado ausente.
// Usado para custo de hospedagem, taxas e qualquer valor opcional.
export function normalizarValorOpcional(valor) {
    const n = normalizarValor(valor);
    if (n === null || n <= 0) return null;
    return n;
}

// Preço por pessoa a partir SEMPRE do total bruto (evita a divergência de
// arredondamento entre telas que dividiam valores já arredondados).
export function precoPorPessoa(total, pax) {
    const bruto = typeof total === 'number' ? total : Number(total);
    if (!Number.isFinite(bruto)) return null;
    const pessoas = Math.max(1, Math.round(Number(pax) || 1));
    return Math.round(bruto / pessoas);
}

export function formatarValor(valor) {
    const n = normalizarValor(valor);
    if (n === null) return '';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatarPreco(valor, moeda = 'BRL') {
    const texto = formatarValor(valor);
    if (!texto) return '';
    return `${simboloMoeda(moeda)} ${texto}`;
}

// Comparação de preços exibidos: dois valores que aparecem iguais na tela
// precisam ser tratados como iguais (empate de menor preço, por exemplo).
export function mesmoValorExibido(a, b) {
    const na = normalizarValor(a);
    const nb = normalizarValor(b);
    return na !== null && nb !== null && na === nb;
}
