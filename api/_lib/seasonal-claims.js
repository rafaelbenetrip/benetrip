// api/_lib/seasonal-claims.js - GUARDA DE AFIRMAÇÃO SAZONAL v1.0
//
// A auditoria pegou a Descoberta recomendando Lençóis Maranhenses em novembro
// dizendo que as lagoas estariam cheias, contrariando as fontes oficiais.
//
// Melhorar o prompt reduz a frequência disso, mas prompt não é garantia: o
// modelo pode escorregar e ninguém fica olhando cada resposta. Por isso a
// regra é aplicada aqui, de forma determinística, DEPOIS da geração:
//
//   - se a frase afirma um FENÔMENO SAZONAL (lagoas cheias, neve, floração,
//     desova, ausência de chuva, clima garantido) e não existe fonte externa
//     confirmando, a frase é DESCARTADA;
//   - no lugar dela entra uma instrução neutra de conferir antes de decidir;
//   - frases sem fenômeno (ritmo da cidade, alta temporada, movimento) passam,
//     rotuladas como não verificadas.
//
// Sem rede, sem provedor, sem custo. Não depende de tabela de destinos nem de
// meses: o que é avaliado é o TIPO DE AFIRMAÇÃO, então vale para qualquer
// lugar do mundo.

// ============================================================
// FENÔMENOS QUE EXIGEM FONTE
//
// Cada padrão descreve uma condição verificável do mundo físico num período.
// Dizer "as lagoas estarão cheias" é uma previsão factual; dizer "a cidade
// costuma ficar mais movimentada" é uma caracterização. A primeira precisa de
// fonte, a segunda não.
// ============================================================
const FENOMENOS = [
    // Água, cheia e seca
    /\blagoas?\b[^.;]{0,40}\b(cheias?|chei[ao]|com [áa]gua|no auge|form(a|am)|enchem)/i,
    /\b(cheia|seca)\s+d[oa]s?\s+(rio|lagoa|pantanal)/i,
    /\bcachoeiras?\b[^.;]{0,30}\b(cheias?|volumosas?|no auge)/i,

    // Neve e gelo
    /\b(neve|nevando|nevada|nevar[áa]?|coberto de neve|gelo)\b/i,
    /\b(temporada|esta[çc][ãa]o)\s+de\s+esqui\b/i,

    // Fauna e flora
    /\b(desova|migra[çc][ãa]o|avistamento)\b/i,
    /\b(baleias?|tartarugas?|p[áa]ssaros?)\b[^.;]{0,40}\b(aparecem|chegam|podem ser vistas?|est(ão|arão))/i,
    /\b(flora[çc][ãa]o|florid[ao]s?|cerejeiras?|lavandas?|girass[óo]is)\b/i,
    /\bfolhagens?\b[^.;]{0,25}\b(outono|vermelh|dourad)/i,

    // Clima afirmado como certeza
    /\b(sem chuva|nada de chuva|chuva zero)\b/i,
    /\bn[ãa]o\s+(vai\s+|deve\s+)?chove(r|rá|ra)?\b/i,
    /\b(sol|c[ée]u|clima|tempo)\b[^.;]{0,25}\b(garantid[ao]s?|certo|perfeito|impec[áa]vel)\b/i,
    /\b(garantid[ao]s?)\b[^.;]{0,25}\b(sol|neve|chuva|clima|tempo)\b/i,
    /\btemperatura\b[^.;]{0,30}\b(vai ser|ser[áa]|fica em torno de)\b/i,

    // Funcionamento sazonal de atrativo
    // Sem \b depois de vogal acentuada: em JS o \b é ASCII e não reconhece
    // fronteira após "á"/"ã", o que fazia "estará aberto" escapar.
    /(estar[áa]|estar[ãa]o|vai estar|v[ãa]o estar)[^.;]{0,25}\b(abert[ao]s?|funcionando|em opera[çc][ãa]o)\b/i,
    /\btemporada\b[^.;]{0,20}\b(aberta|em alta|no auge)\b/i,
];

// Modalizadores que transformam a afirmação em expectativa. "As lagoas
// costumam encher" não é a mesma coisa que "as lagoas estarão cheias".
const MODALIZADORES = /\b(costum(a|am)|geralmente|normalmente|em geral|pode|podem|talvez|nem sempre|varia|variam|tende a|tendem a|verifique|confirme|consulte|n[ãa]o [ée] garantido|sem garantia)\b/i;

export const TEXTO_SEM_FONTE =
    'As condições variam conforme o período. Confirme em fonte oficial do destino antes de decidir.';

/**
 * A frase afirma um fenômeno sazonal como fato?
 * Modalizada ("costuma encher", "confirme antes") não conta como afirmação.
 */
export function afirmaFenomenoSazonal(texto) {
    const t = String(texto || '');
    if (!t.trim()) return false;
    // Avalia oração a oração: um "confirme antes de ir" no fim da frase não
    // deve absolver uma afirmação categórica feita no começo.
    return t.split(/[.;]/).some((oracao) => {
        if (!FENOMENOS.some((re) => re.test(oracao))) return false;
        return !MODALIZADORES.test(oracao);
    });
}

/**
 * Aplica a guarda a uma frase de adequação à época.
 *
 * @param {string} texto  a frase gerada pelo modelo
 * @param {boolean} verificado  existe fonte externa confirmando?
 * @returns {{texto: string|null, descartada: boolean, motivo: string|null}}
 *          texto null = a interface não deve exibir a frase original
 */
export function aplicarGuardaSazonal(texto, { verificado = false } = {}) {
    const t = String(texto || '').trim();
    if (!t) return { texto: null, descartada: false, motivo: null };

    // Com fonte, a afirmação é sustentada: passa como veio
    if (verificado) return { texto: t, descartada: false, motivo: null };

    if (afirmaFenomenoSazonal(t)) {
        return { texto: null, descartada: true, motivo: 'fenomeno_sem_fonte' };
    }

    return { texto: t, descartada: false, motivo: null };
}

// ============================================================
// INSTRUÇÕES PARA O PROMPT
//
// Primeira camada da defesa: reduzir a frequência do erro na origem. A guarda
// acima é a segunda camada, que não depende de o modelo obedecer.
// ============================================================
export const INSTRUCOES_SAZONALIDADE = `REGRAS DE SAZONALIDADE (uma violação aqui invalida o campo inteiro):

O campo "adequacao_epoca" descreve o que o viajante deve ESPERAR E CONFERIR, não o que vai acontecer.

É PROIBIDO afirmar como fato, para qualquer destino:
- nível de água: lagoas cheias, cachoeiras volumosas, rio na cheia ou na seca
- neve, gelo, temporada de esqui
- floração, folhagem de outono, desova, migração, avistamento de animais
- ausência de chuva, sol garantido, clima perfeito, temperatura específica
- que um atrativo sazonal estará aberto ou funcionando

Essas condições dependem do ano e não temos fonte para confirmá-las. Uma frase
que as afirme será DESCARTADA automaticamente e o destino ficará sem
comentário de época.

COMO ESCREVER CORRETAMENTE:
- Errado: "Em novembro as lagoas estarão cheias, ideal para banho."
- Certo:  "Novembro fica perto do fim do período de chuvas da região, e o nível das lagoas varia bastante de ano para ano. Confirme as condições antes de fechar."
- Errado: "Clima perfeito, sem chuva no período."
- Certo:  "É verão na região, com calor e pancadas de chuva possíveis à tarde."
- Errado: "A temporada de baleias estará aberta."
- Certo:  "A região costuma ter observação de baleias em alguns meses do ano. Verifique o calendário da temporada antes de programar o passeio."

Use "costuma", "geralmente", "varia", "confirme", "verifique". Prefira falar de
movimento turístico, preços e ritmo da cidade, que não dependem de fenômeno
natural, a arriscar uma previsão que não podemos sustentar.`;
