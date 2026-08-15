// api/_lib/family-claims.js - CRITÉRIO DE SELEÇÃO x TEXTO DO CARD v1.0
//
// Numa busca com crianças ou bebês, o prompt do ranqueador injeta um bloco de
// ATENÇÃO ESPECIAL pedindo que a IA considere, entre outras coisas, "destinos
// com hospitais/clínicas acessíveis". O bloco existe para orientar a ESCOLHA
// dos destinos. Nada dizia isso ao modelo, e o resultado apareceu na tela:
// todos os cards, de todas as cidades, gastando o pouco espaço que têm para
// falar dos hospitais do lugar.
//
// São dois problemas de uma vez, e o segundo é o grave:
//
//   1. Espaço. O card tem uma frase de razão, duas ou três de comentário e
//      uma dica. Uma delas descrevendo a rede de saúde é uma frase a menos
//      sobre o destino, repetida em todos os cards.
//
//   2. Veracidade. Não temos NENHUM dado sobre hospitais, clínicas ou
//      atendimento médico de destino nenhum. "Tem boa estrutura de saúde" é
//      afirmação factual sem fonte — a mesma categoria que
//      seasonal-claims.js descarta —, e aqui ela é pior: quem lê está
//      decidindo para onde levar um bebê de colo.
//
// Mesma divisão de camadas do resto do projeto:
//
//   1. blocoRestricoesFamilia(): o prompt passa a separar CRITÉRIO DE ESCOLHA
//      de ASSUNTO DO TEXTO, e proíbe explicitamente falar de saúde.
//   2. removerAfirmacoesDeSaude(): determinística, roda depois da geração e
//      não depende de o modelo obedecer.
//
// Sem rede, sem provedor, sem custo. O que é avaliado é o TIPO DE AFIRMAÇÃO,
// não o destino, então vale para qualquer lugar do mundo.

// ============================================================
// AFIRMAÇÕES SOBRE INFRAESTRUTURA DE SAÚDE
//
// Nunca um /saúde/ solto: "turismo de saúde" e "spa" são categoria de
// passeio, não alegação sobre rede hospitalar. Só compostos que descrevem
// atendimento médico entram.
// ============================================================
const AFIRMACOES_SAUDE = [
    /\bhospita(l|is|lar|lares)\b/i,
    /\bcl[íi]nicas?\b/i,
    /\bpronto[-\s]socorro/i,
    /\bposto de sa[úu]de/i,
    /\bemerg[êe]ncias?\s+m[ée]dicas?/i,
    /\b(atendimento|assist[êe]ncia|servi[çc]os?|rede|infraestrutura|estrutura|suporte|cuidados?)\s+(m[ée]dic[oa]s?|hospitalar(es)?|de sa[úu]de)/i,
    /\b(sa[úu]de|m[ée]dic[oa]s?)\s+(de qualidade|acess[íi]v(el|eis)|pr[óo]xim[oa]s?|confi[áa]v(el|eis))/i,
];

export function afirmaInfraestruturaDeSaude(texto) {
    const t = String(texto || '');
    if (!t.trim()) return false;
    return AFIRMACOES_SAUDE.some((re) => re.test(t));
}

/**
 * Remove do texto as ORAÇÕES que falam de infraestrutura de saúde,
 * preservando o resto.
 *
 * Diferente da guarda sazonal, que descarta o campo inteiro: aqui a menção
 * costuma ser uma frase no meio do comentário, e jogar fora o comentário
 * todo deixaria o card mudo por causa de uma frase.
 *
 * O corte é por oração inteira, nunca por vírgula: recortar "é seguro, tem
 * bons hospitais e fica perto do mar" no meio produz frase quebrada. Quando
 * a menção está grudada por vírgula no resto, a oração inteira cai — texto
 * a menos é melhor que texto truncado.
 *
 * @returns {{texto: string, removidas: number}}
 */
export function removerAfirmacoesDeSaude(texto) {
    const t = String(texto || '').trim();
    if (!t) return { texto: '', removidas: 0 };

    const oracoes = t.match(/[^.;!?]+[.;!?]*/g) || [];
    const mantidas = [];
    let removidas = 0;

    for (const oracao of oracoes) {
        if (!oracao.trim()) continue;
        if (afirmaInfraestruturaDeSaude(oracao)) {
            removidas++;
            continue;
        }
        mantidas.push(oracao.trim());
    }

    return { texto: mantidas.join(' ').trim(), removidas };
}

// Aplica a guarda a todos os campos de texto de um destino escolhido.
// Campo que fica vazio simplesmente some do card (comentarioHtml e dicaHtml
// já não renderizam string vazia).
export const CAMPOS_TEXTO = ['razao', 'comentario', 'dica', 'ponto_negativo', 'adequacao_epoca'];

export function limparAfirmacoesDeSaude(destino, campos = CAMPOS_TEXTO) {
    const d = { ...(destino || {}) };
    let removidas = 0;

    for (const campo of campos) {
        if (typeof d[campo] !== 'string' || !d[campo]) continue;
        const r = removerAfirmacoesDeSaude(d[campo]);
        if (r.removidas > 0) {
            d[campo] = r.texto;
            removidas += r.removidas;
        }
    }

    return { destino: d, removidas };
}

// ============================================================
// BLOCO DE FAMÍLIA NO PROMPT
//
// A separação que faltava: o que orienta a ESCOLHA não é o que se escreve.
// Um critério de seleção narrado vira frase repetida em todos os cards.
// ============================================================
export function blocoRestricoesFamilia({ criancas = 0, bebes = 0 } = {}) {
    const temCriancas = Number(criancas) > 0;
    const temBebes = Number(bebes) > 0;
    if (!temCriancas && !temBebes) return '';

    return `
ATENÇÃO ESPECIAL - VIAGEM COM CRIANÇAS/BEBÊS:

Isto é CRITÉRIO DE ESCOLHA, não assunto para os textos. Use para decidir
QUAIS destinos entram; não escreva sobre estes itens nos campos de texto.
- Priorize destinos com BOA INFRAESTRUTURA para famílias com crianças pequenas
- Evite destinos que exigem longas caminhadas ou acesso difícil com carrinhos
- Voos diretos ou com poucas paradas são PREFERÍVEIS (viagem longa com crianças é cansativa)
${temBebes ? '- BEBÊ(S) NO COLO: prefira clima ameno e acesso fácil' : ''}
${temCriancas ? '- CRIANÇAS: considere destinos com atividades infantis, parques, praias calmas' : ''}

PROIBIDO FALAR DE SAÚDE. Não escreva sobre hospitais, clínicas, pronto-socorro,
atendimento médico, rede de saúde ou estrutura médica em NENHUM campo de texto.
Não temos dado nenhum sobre isso, e uma família decidindo para onde levar um
bebê não pode receber palpite nosso como se fosse informação. Frase que
mencione esses assuntos será DESCARTADA automaticamente.
- Errado: "A cidade tem bons hospitais e clínicas acessíveis, ideal com crianças."
- Certo:  "O centro é plano e curto, dá para andar com carrinho sem sufoco."
- Errado: "Boa estrutura de saúde para quem viaja com bebê."
- Certo:  "O voo curto ajuda muito com bebê no colo."

O espaço do card é pequeno: cada frase gasta com um item desta lista é uma
frase a menos sobre COMO É o destino, que é o que o viajante veio ler.`;
}
