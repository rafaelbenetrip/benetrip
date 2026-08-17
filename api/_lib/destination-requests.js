// api/_lib/destination-requests.js — o pedido de país/cidade escrito em texto livre
//
// A Descoberta passou a tratar as observações do viajante como critério de
// seleção, mas critério de prompt é pedido, não garantia: nada impedia o
// modelo de devolver Miami para quem escreveu "quero os EUA, menos Miami".
//
// Aqui o pedido vira dado estruturado e a aplicação é determinística, no mesmo
// lugar e no mesmo formato da trava de escalas para família
// (violaRestricaoObjetiva, em api/_lib/flight-quality.js): promove quem
// respeita o pedido e rebaixa quem não respeita, sem nunca esvaziar a tela.
//
// ESCOPO, E POR QUE ELE É ESTREITO DE PROPÓSITO
//
// Só país e cidade entram: são as duas coisas do texto livre que dá para
// conferir contra um campo que já temos em cada destino (country e name). "Não
// quero lugar frio" e "sem muitas escadas" continuam valendo apenas como
// critério no prompt, porque não existe dado nosso que decida isso — inventar
// um seria pior que não ter.
//
// PRECISÃO ANTES DE COBERTURA
//
// Uma exclusão errada TIRA da tela uma opção válida; um desejo errado só
// reordena. Por isso a janela de proximidade da negação é mais curta que a do
// desejo, e um nome citado sem nenhuma pista em volta é ignorado em vez de
// chutado. O texto livre é livre mesmo: o objetivo é acertar os pedidos claros
// e ficar quieto no resto.

export function normalizar(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

// Como o brasileiro escreve o nome do país versus como ele aparece no dado.
// Tabela curta de propósito: cada entrada é um apelido que realmente aparece
// em pedido de viagem, não uma tradução completa de gentílicos.
export const ALIASES_PAIS = {
    'eua': 'estados unidos',
    'usa': 'estados unidos',
    'estados unidos da america': 'estados unidos',
    'inglaterra': 'reino unido',
    'gra bretanha': 'reino unido',
    'gra-bretanha': 'reino unido',
    'uk': 'reino unido',
    'holanda': 'paises baixos',
    'tchequia': 'republica tcheca',
    'republica checa': 'republica tcheca',
    'emirados arabes unidos': 'emirados arabes',
};

// Pistas de que o nome citado é o que o viajante NÃO quer.
const CUES_NEGATIVOS = [
    'nao', 'exceto', 'menos', 'sem', 'tirando', 'fora', 'evitar', 'evite',
    'evito', 'nada de', 'longe de', 'nem', 'nunca', 'jamais', 'odeio',
    'detesto', 'descarta', 'descartar', 'exceto por', 'sem ser',
];

// Pistas de que o nome citado é o que ele QUER.
const CUES_DESEJO = [
    'quero', 'queria', 'gostaria', 'adoraria', 'adoro', 'amaria', 'sonho',
    'vontade', 'pretendo', 'prefiro', 'interesse', 'interessa', 'conhecer',
    'desejo', 'penso', 'visitar', 'ir para', 'ir pra', 'ir a', 'ir ao',
    'ir aos', 'sempre quis', 'morro de vontade',
];

// Quantas palavras podem separar a pista do nome. A negação é mais curta
// porque errar nela custa mais: "quero gastar menos indo para o Chile" não
// pode virar exclusão do Chile.
const JANELA_NEGACAO = 2;
const JANELA_DESEJO = 4;
// Negação colada no verbo de vontade ("não quero", "nunca quis"). Aqui a
// janela é zero de propósito, e a consequência é NEUTRALIZAR o desejo, não
// virar exclusão: "não quero ir para os EUA" e "não quero gastar muito indo
// para o Chile" têm a mesma cara para uma regex, e significam coisas opostas.
// Diante das duas leituras, a que não age é a única que não erra feio.
const JANELA_NEGACAO_DO_VERBO = 0;

// Nome curto demais casa com pedaço de palavra e com coincidência. Os apelidos
// da tabela acima são exceção: "EUA" é curto e não é ambíguo.
const TAMANHO_MINIMO = 4;

function escaparRegex(t) {
    return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Frases separadas por pontuação. A pista e o nome precisam estar na MESMA
// frase: em "quero os EUA, não quero frio", o "não" da segunda não alcança a
// primeira.
function clausulas(textoNorm) {
    return textoNorm
        .split(/[.,;:!?\n]+/)
        .map(t => t.trim())
        .filter(Boolean);
}

// Posições onde o termo aparece como palavra inteira
function posicoes(texto, termo) {
    const re = new RegExp(`(^|[^a-z0-9])(${escaparRegex(termo)})([^a-z0-9]|$)`, 'g');
    const encontradas = [];
    let m;
    while ((m = re.exec(texto)) !== null) {
        encontradas.push(m.index + m[1].length);
        re.lastIndex = m.index + 1;
    }
    return encontradas;
}

// Onde começam TODAS as pistas da lista que cabem na janela de palavras.
// Todas, e não só a mais próxima: em "não quero ir para os EUA" a pista mais
// próxima do nome é "ir para", e quem carrega a negação é o "quero" atrás
// dela. Olhar só a mais próxima lia esse pedido como vontade de ir.
function acharPistas(trechoAntes, pistas, janela) {
    const achadas = [];
    for (const pista of pistas) {
        let de = trechoAntes.length;
        let idx;
        while ((idx = trechoAntes.lastIndexOf(pista, de - 1)) !== -1) {
            de = idx;
            const anterior = trechoAntes[idx - 1];
            const posterior = trechoAntes[idx + pista.length];
            const palavraInteira =
                (!anterior || !/[a-z0-9]/.test(anterior)) &&
                (!posterior || !/[a-z0-9]/.test(posterior));
            if (palavraInteira) {
                const meio = trechoAntes.slice(idx + pista.length).trim();
                const palavras = meio ? meio.split(/\s+/).length : 0;
                if (palavras <= janela) achadas.push(idx);
            }
            if (idx === 0) break;
        }
    }
    return achadas;
}

// 'excluido' | 'desejado' | null. A exclusão vence: quem escreveu "quero os
// EUA, menos Miami" citou Miami das duas formas, e o que ele quer dizer é que
// não quer Miami.
export function polaridade(textoNorm, termo) {
    let achado = null;
    for (const clausula of clausulas(textoNorm)) {
        for (const pos of posicoes(clausula, termo)) {
            const antes = clausula.slice(0, pos);

            // Negação colada no NOME: "exceto Miami", "nada de Miami".
            if (acharPistas(antes, CUES_NEGATIVOS, JANELA_NEGACAO).length > 0) return 'excluido';

            // Vontade declarada, desde que nenhum dos verbos venha negado
            const desejos = acharPistas(antes, CUES_DESEJO, JANELA_DESEJO);
            const algumNegado = desejos.some(i =>
                acharPistas(antes.slice(0, i), CUES_NEGATIVOS, JANELA_NEGACAO_DO_VERBO).length > 0
            );
            if (desejos.length > 0 && !algumNegado) achado = 'desejado';
        }
    }
    return achado;
}

function apelidosDe(paisNorm) {
    return Object.entries(ALIASES_PAIS)
        .filter(([, canonico]) => canonico === paisNorm)
        .map(([apelido]) => apelido);
}

/**
 * Lê o texto livre e devolve o pedido de país/cidade.
 *
 * `paisesConhecidos` vem de uma lista fixa (não dos candidatos): é o que
 * permite saber que o viajante pediu os Estados Unidos mesmo quando NENHUM
 * destino americano sobreviveu ao orçamento — e é justamente esse caso que a
 * tela precisa contar para ele.
 *
 * As cidades, ao contrário, saem dos próprios candidatos: excluir uma cidade
 * que não está na lista não muda nada, então não há por que carregar um
 * dicionário do mundo inteiro para isso.
 */
export function interpretarPedido(observacoes, { destinos = [], paisesConhecidos = [] } = {}) {
    const pedido = {
        paisesDesejados: [], paisesExcluidos: [],
        cidadesDesejadas: [], cidadesExcluidas: [],
    };
    const texto = normalizar(observacoes);
    if (!texto) return pedido;

    const paises = new Map();
    for (const p of paisesConhecidos) {
        if (p) paises.set(normalizar(p), p);
    }
    for (const d of destinos) {
        if (d?.country) paises.set(normalizar(d.country), d.country);
    }

    for (const [norm] of paises) {
        const termos = [norm, ...apelidosDe(norm)];
        let pol = null;
        for (const termo of termos) {
            const ehApelido = termo !== norm;
            if (!ehApelido && termo.length < TAMANHO_MINIMO) continue;
            const p = polaridade(texto, termo);
            if (p === 'excluido') { pol = 'excluido'; break; }
            if (p === 'desejado') pol = 'desejado';
        }
        if (pol === 'excluido') pedido.paisesExcluidos.push(norm);
        else if (pol === 'desejado') pedido.paisesDesejados.push(norm);
    }

    const cidades = new Set();
    for (const d of destinos) {
        if (d?.name) cidades.add(normalizar(d.name));
    }
    for (const cidade of cidades) {
        if (cidade.length < TAMANHO_MINIMO) continue;
        const pol = polaridade(texto, cidade);
        if (pol === 'excluido') pedido.cidadesExcluidas.push(cidade);
        else if (pol === 'desejado') pedido.cidadesDesejadas.push(cidade);
    }

    return pedido;
}

export function pedidoVazio(pedido) {
    if (!pedido) return true;
    return (
        pedido.paisesDesejados.length === 0 &&
        pedido.paisesExcluidos.length === 0 &&
        pedido.cidadesDesejadas.length === 0 &&
        pedido.cidadesExcluidas.length === 0
    );
}

export function destinoExcluido(destino, pedido) {
    if (!destino || !pedido) return false;
    const pais = normalizar(destino.country);
    const cidade = normalizar(destino.name);
    if (pais && pedido.paisesExcluidos.includes(pais)) return true;
    if (cidade && pedido.cidadesExcluidas.includes(cidade)) return true;
    return false;
}

export function destinoDesejado(destino, pedido) {
    if (!destino || !pedido) return false;
    const pais = normalizar(destino.country);
    const cidade = normalizar(destino.name);
    if (cidade && pedido.cidadesDesejadas.includes(cidade)) return true;
    if (pais && pedido.paisesDesejados.includes(pais)) return true;
    return false;
}

const mesmoDestino = (a, b) =>
    a && b &&
    normalizar(a.name) === normalizar(b.name) &&
    normalizar(a.country) === normalizar(b.country);

/**
 * Aplica o pedido ao resultado já escolhido pela IA.
 *
 * Roda DEPOIS da trava de família, e `permitido` é justamente ela: o pedido do
 * viajante reordena o que sobrou, mas não promove ao topo um voo que a trava
 * de escalas com criança acabou de barrar. Aquela regra é descrita no prompt
 * como não negociável e continua sendo.
 *
 * O que faz, nesta ordem:
 *  1. tira dos resultados os destinos que o viajante pediu para não ver,
 *     repondo cada vaga com o melhor candidato que sobrou;
 *  2. se ele pediu um país e o topo não é de lá, promove o melhor de lá.
 *
 * O que nunca faz: devolver menos destino do que dá para preencher. Quando a
 * lista não tem com o que repor, a vaga fica com quem estava — um resultado
 * contrariando o pedido é ruim, uma tela vazia é pior.
 */
export function aplicarPedido(resultado, pool, pedido, { permitido = () => true } = {}) {
    const relatorio = { ajustado: false, removidos: [], promovido: null, paisesSemDestino: [] };
    if (!resultado || pedidoVazio(pedido)) return relatorio;

    const lista = Array.isArray(pool) ? pool : [];

    // Pedido de país que a busca não tem como atender: nenhum candidato fica
    // lá. Não há o que promover — só o que contar na tela.
    relatorio.paisesSemDestino = pedido.paisesDesejados.filter(
        p => !lista.some(d => normalizar(d.country) === p)
    );

    const embrulhar = (d, razao) => ({
        ...d,
        id: lista.indexOf(d) + 1,
        razao,
        comentario: '',
        dica: '',
        adequacao_epoca: '',
        ponto_negativo: '',
    });

    const emUso = () => [resultado.top_destino, ...(resultado.alternativas || []), resultado.surpresa].filter(Boolean);

    const proximoCandidato = (filtro) => {
        const usados = emUso();
        return lista.find(d =>
            !destinoExcluido(d, pedido) &&
            permitido(d) &&
            !usados.some(u => mesmoDestino(u, d)) &&
            (!filtro || filtro(d))
        ) || null;
    };

    // ─── 1. Fora quem o viajante pediu para não ver ───
    if (destinoExcluido(resultado.top_destino, pedido)) {
        const substituto =
            (resultado.alternativas || []).find(d => !destinoExcluido(d, pedido) && permitido(d)) ||
            (resultado.surpresa && !destinoExcluido(resultado.surpresa, pedido) && permitido(resultado.surpresa) ? resultado.surpresa : null);

        const escolhido = substituto || (() => {
            const doPool = proximoCandidato();
            return doPool ? embrulhar(doPool, 'Melhor opção da busca que respeita o que você pediu.') : null;
        })();

        if (escolhido) {
            relatorio.removidos.push(resultado.top_destino.name);
            relatorio.ajustado = true;
            resultado.alternativas = (resultado.alternativas || []).filter(d => !mesmoDestino(d, escolhido));
            if (resultado.surpresa && mesmoDestino(resultado.surpresa, escolhido)) resultado.surpresa = null;
            resultado.top_destino = escolhido;
        }
    }

    resultado.alternativas = (resultado.alternativas || []).flatMap(d => {
        if (!destinoExcluido(d, pedido)) return [d];
        relatorio.removidos.push(d.name);
        relatorio.ajustado = true;
        const reposicao = proximoCandidato();
        return reposicao ? [embrulhar(reposicao, 'Outra opção da busca que respeita o que você pediu.')] : [];
    });

    if (destinoExcluido(resultado.surpresa, pedido)) {
        relatorio.removidos.push(resultado.surpresa.name);
        relatorio.ajustado = true;
        const reposicao = proximoCandidato();
        resultado.surpresa = reposicao
            ? embrulhar(reposicao, 'Um lugar diferente, dentro do que você pediu!')
            : null;
    }

    // ─── 2. O país pedido ganha o primeiro lugar ───
    const temDesejo = pedido.paisesDesejados.length > 0 || pedido.cidadesDesejadas.length > 0;
    if (temDesejo && resultado.top_destino && !destinoDesejado(resultado.top_destino, pedido)) {
        const daListaEscolhida = [...(resultado.alternativas || []), resultado.surpresa]
            .filter(Boolean)
            .find(d => destinoDesejado(d, pedido) && permitido(d));

        const doPool = daListaEscolhida
            ? null
            : proximoCandidato(d => destinoDesejado(d, pedido));

        const escolhido = daListaEscolhida || (doPool ? embrulhar(doPool, 'É o destino que você pediu, com a melhor combinação de preço e voo da busca.') : null);

        if (escolhido) {
            const antigo = resultado.top_destino;
            resultado.alternativas = (resultado.alternativas || []).filter(d => !mesmoDestino(d, escolhido));
            if (resultado.surpresa && mesmoDestino(resultado.surpresa, escolhido)) resultado.surpresa = null;
            resultado.top_destino = escolhido;
            resultado.alternativas = [antigo, ...resultado.alternativas].slice(0, 3);
            relatorio.promovido = escolhido.name;
            relatorio.ajustado = true;
        }
    }

    return relatorio;
}
