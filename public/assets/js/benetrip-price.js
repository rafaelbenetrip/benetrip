/**
 * BENETRIP PRICE v1.0 — preço por pessoa e total
 *
 * Padrão transversal: sempre deixar claro se o valor é por pessoa ou total,
 * se é ida e volta, e nunca dividir a tarifa pelos bebês de colo.
 *
 * Bebê de colo não é passageiro pagante de tarifa cheia: dividir o total por
 * (adultos + crianças + bebês) reduz artificialmente o "preço por pessoa".
 * A busca clássica fazia isso enquanto o Comparar Voos dividia só pelos
 * pagantes — duas telas mostravam preços diferentes para a mesma família.
 *
 * Exposto em window.BenetripPrice (browser) e module.exports (testes).
 */
(function (root, factory) {
    const mod = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = mod;
    if (root) root.BenetripPrice = mod;
})(typeof window !== 'undefined' ? window : globalThis, function () {

    const SIMBOLOS = { BRL: 'R$', USD: 'US$', EUR: '€' };

    function simbolo(moeda) {
        return SIMBOLOS[moeda] || 'R$';
    }

    // Passageiros que compõem a tarifa: adultos + crianças.
    // Bebês de colo ficam de fora da divisão (viajam com tarifa reduzida ou
    // isenta, dependendo da companhia).
    function paxPagantes({ adultos = 1, criancas = 0 } = {}) {
        return Math.max(1, (parseInt(adultos) || 0) + (parseInt(criancas) || 0));
    }

    /**
     * Converte um preço TOTAL da busca em preço por pessoa.
     * @param {number} total  valor cobrado para todos os passageiros
     */
    function porPessoa(total, pax) {
        const n = paxPagantes(pax);
        if (!(total > 0)) return null;
        return Math.round(total / n);
    }

    function formatar(valor, moeda) {
        if (valor === null || valor === undefined || !Number.isFinite(valor)) return 'não disponível';
        return `${simbolo(moeda)} ${Math.round(valor).toLocaleString('pt-BR')}`;
    }

    /**
     * Rótulo completo e honesto do preço.
     * @returns {{principal:string, rotulo:string, total:string|null, observacao:string|null}}
     */
    function descrever(total, { adultos = 1, criancas = 0, bebes = 0, moeda = 'BRL', idaEVolta = true, tarifaParcial = false } = {}) {
        const pax = paxPagantes({ adultos, criancas });
        const pp = porPessoa(total, { adultos, criancas });

        const partes = ['por pessoa'];
        if (idaEVolta) partes.push('ida e volta');
        if (tarifaParcial) partes.push('tarifa inicial');

        const nBebes = parseInt(bebes) || 0;
        return {
            principal: formatar(pp, moeda),
            rotulo: partes.join(' · '),
            total: pax > 1 ? `Total ${pax} pagantes: ${formatar(total, moeda)}` : null,
            observacao: nBebes > 0
                ? `${nBebes} bebê${nBebes > 1 ? 's' : ''} de colo não entra${nBebes > 1 ? 'm' : ''} nesta divisão`
                : null,
        };
    }

    return { simbolo, paxPagantes, porPessoa, formatar, descrever };
});
