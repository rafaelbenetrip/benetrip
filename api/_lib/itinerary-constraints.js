// api/_lib/itinerary-constraints.js - RESTRIÇÕES DO ROTEIRO v1.0
//
// A auditoria encontrou um roteiro que dizia respeitar "evitar deslocamentos
// longos e atividades noturnas" e mesmo assim entregava quatro atividades
// noturnas. Prompt sozinho não garante nada: aqui as observações livres viram
// restrições ESTRUTURADAS, usadas em duas camadas —
//   1. instruções explícitas no prompt de geração;
//   2. validação determinística do resultado, que remove o que violou.
//
// Funções puras (sem rede) para permitir teste unitário.

// ============================================================
// CATÁLOGO DE RESTRIÇÕES
// `obrigatoria: true` = violação é removida do roteiro.
// ============================================================
export const RESTRICOES = {
    evitar_noturnas: {
        obrigatoria: true,
        rotulo: 'Sem atividades noturnas',
        instrucao: 'PROIBIDO incluir qualquer atividade no período "noite". Encerre os dias no fim da tarde. O array "periodos" de cada dia deve conter apenas "manhã" e "tarde".',
    },
    evitar_deslocamentos_longos: {
        obrigatoria: false,
        rotulo: 'Sem deslocamentos longos',
        instrucao: 'Mantenha as atividades de cada dia na MESMA região da cidade. Nada de atravessar a cidade entre atividades nem bate-volta para outra cidade.',
    },
    mobilidade_reduzida: {
        obrigatoria: true,
        rotulo: 'Mobilidade reduzida',
        instrucao: 'Somente locais acessíveis: sem trilhas, escadarias longas, terrenos irregulares ou caminhadas extensas. Prefira locais com acesso adaptado.',
    },
    evitar_escadas: {
        obrigatoria: true,
        rotulo: 'Sem escadas',
        instrucao: 'Evite locais cujo acesso principal seja por escadaria (ladeiras íngremes, mirantes sem elevador).',
    },
    criancas_pequenas: {
        obrigatoria: false,
        rotulo: 'Crianças pequenas',
        instrucao: 'Atividades adequadas para crianças pequenas, com pausas, banheiro por perto e sem exigir longas caminhadas.',
    },
    bebe: {
        obrigatoria: false,
        rotulo: 'Bebê no grupo',
        instrucao: 'Considere tempo extra de logística, locais com fraldário e horários compatíveis com soneca.',
    },
    ritmo_leve: {
        obrigatoria: false,
        rotulo: 'Ritmo leve',
        instrucao: 'Poucas atividades por período, com intervalos folgados entre elas.',
    },
    restricao_alimentar: {
        obrigatoria: false,
        rotulo: 'Restrição alimentar',
        instrucao: 'Nas sugestões de comida, priorize lugares com opções que atendam a restrição alimentar informada.',
    },
};

// ============================================================
// DETECÇÃO A PARTIR DO TEXTO LIVRE
// Casa expressões comuns em pt-BR; o texto original segue para o prompt,
// então uma expressão não reconhecida não é perdida — apenas não vira
// regra determinística.
// ============================================================
// Palavras que indicam intenção de EVITAR algo
const NEGACAO = /\b(evitar|evite|sem|nada de|nao|não|nenhum[ao]?|pouc[ao]s?|prefiro n(ã|a)o)\b/i;
// Palavras que indicam o oposto — se aparecerem entre a negação e o termo,
// a negação provavelmente se referia a outra coisa
// ("evitar museus e incluir vida noturna")
const INTENCAO_POSITIVA = /\b(quero|queremos|gosto|gostamos|adoro|adoramos|incluir|inclua|com muita|bastante|curtir|aproveitar)\b/i;

// "não quero", "não gosto": o verbo positivo já está negado, então não conta
// como intenção positiva
const POSITIVO_NEGADO = /\b(n(ã|a)o|nunca)\s+(quero|queremos|gosto|gostamos|adoro|adoramos|curto|pretendo|pretendemos)\b/gi;

// A negação e o termo precisam estar na MESMA oração (sem . ou ;) e a
// negação vem antes, sem intenção positiva no meio.
function negadoNaMesmaOracao(texto, termoRegex) {
    for (const oracao of String(texto).split(/[.;\n]/)) {
        const alvo = oracao.search(termoRegex);
        if (alvo < 0) continue;
        const antes = oracao.slice(0, alvo);
        if (!NEGACAO.test(antes)) continue;
        // trecho entre a última negação e o termo
        const ultimaNegacao = antes.toLowerCase().lastIndexOf(antes.match(NEGACAO)[0].toLowerCase());
        const meio = antes.slice(ultimaNegacao).replace(POSITIVO_NEGADO, ' ');
        if (INTENCAO_POSITIVA.test(meio)) continue;
        return true;
    }
    return false;
}

const TERMO_NOTURNO = /(noturn|à noite|a noite|de noite|vida noturna|balada)/i;
const TERMO_DESLOCAMENTO = /(deslocamento|distancia|distância|translado|viagem longa|percurso longo)/i;
const TERMO_ESCADA = /(escada|ladeira|subida)/i;

const PADROES = [
    { chave: 'evitar_noturnas', match: (t) => negadoNaMesmaOracao(t, TERMO_NOTURNO) },
    { chave: 'evitar_noturnas', regex: /(dormir cedo|voltar cedo|programa(ç|c)ão diurna)/i },
    { chave: 'evitar_deslocamentos_longos', match: (t) => negadoNaMesmaOracao(t, TERMO_DESLOCAMENTO) },
    { chave: 'evitar_deslocamentos_longos', regex: /(tudo|coisas|lugares)[^.;]{0,20}(perto|pr(ó|o)xim)/i },
    { chave: 'mobilidade_reduzida', regex: /(mobilidade reduzida|cadeirante|cadeira de rodas|dificuldade (para|de) (andar|caminhar)|acessibilidade)/i },
    { chave: 'evitar_escadas', match: (t) => negadoNaMesmaOracao(t, TERMO_ESCADA) },
    { chave: 'criancas_pequenas', regex: /(crian(ç|c)a|filho pequeno|filhos pequenos)/i },
    { chave: 'bebe', regex: /(beb(ê|e)|carrinho de beb|rec(é|e)m.?nascido)/i },
    { chave: 'ritmo_leve', regex: /(ritmo leve|sem correria|com calma|tranquil|relax|descansad)/i },
    { chave: 'restricao_alimentar', regex: /(vegetarian|vegan|sem gl(ú|u)ten|cel(í|i)ac|intoler(â|a)ncia|alergia alimentar|sem lactose|kosher|halal)/i },
];

/**
 * Extrai restrições estruturadas das observações livres + dados do formulário.
 * @returns {{chaves: string[], obrigatorias: string[], detalhes: object[]}}
 */
export function extrairRestricoes({ observacoes = '', criancas = 0, bebes = 0, intensidade = '' } = {}) {
    const chaves = new Set();
    const texto = String(observacoes || '');

    for (const { chave, regex, match } of PADROES) {
        if (regex ? regex.test(texto) : match(texto)) chaves.add(chave);
    }

    // Restrições que vêm dos campos estruturados do formulário
    if ((criancas || 0) > 0) chaves.add('criancas_pequenas');
    if ((bebes || 0) > 0) chaves.add('bebe');
    if (intensidade === 'leve') chaves.add('ritmo_leve');

    const lista = [...chaves];
    return {
        chaves: lista,
        obrigatorias: lista.filter(c => RESTRICOES[c]?.obrigatoria),
        detalhes: lista.map(c => ({ chave: c, ...RESTRICOES[c] })),
    };
}

// Bloco de regras para o prompt de geração
export function blocoInstrucoes(restricoes) {
    if (!restricoes?.chaves?.length) return '';
    const linhas = restricoes.detalhes.map((r, i) =>
        `${i + 1}. [${r.obrigatoria ? 'OBRIGATÓRIO' : 'PREFERÊNCIA'}] ${r.rotulo}: ${r.instrucao}`
    );
    return `\n═══ RESTRIÇÕES DO VIAJANTE (VERIFICADAS DEPOIS DA GERAÇÃO) ═══
As regras marcadas como OBRIGATÓRIO são conferidas automaticamente: o que violar é REMOVIDO do roteiro entregue. Cumpra-as na geração.
${linhas.join('\n')}`;
}

// ============================================================
// VALIDAÇÃO DETERMINÍSTICA DO RESULTADO
// ============================================================
const PERIODO_NOTURNO = /noite|noturn/i;

// Sinais de que uma atividade é noturna mesmo fora do período "noite"
const SINAIS_NOTURNOS = /\b(balada|bar\b|pub\b|boate|night|show noturno|vida noturna|jantar\s+.{0,20}(show|noturno)|p(ô|o)r do sol.{0,20}(bar|drink)|rooftop|casa noturna|discoteca)\b/i;

const SINAIS_ESCADA = /\b(escadaria|escadão|escadao|ladeira|degraus|subida íngreme|subida ingreme)\b/i;
const SINAIS_ESFORCO = /\b(trilha|trekking|caminhada longa|escalada|rapel|cachoeira de dif|percurso íngreme)\b/i;

function ehAtividadeNoturna(periodo, atividade) {
    if (PERIODO_NOTURNO.test(periodo || '')) return true;
    const texto = `${atividade?.nome || ''} ${atividade?.descricao || ''} ${(atividade?.tags || []).join(' ')}`;
    return SINAIS_NOTURNOS.test(texto);
}

function violaRestricao(chave, periodo, atividade) {
    const texto = `${atividade?.nome || ''} ${atividade?.descricao || ''} ${(atividade?.tags || []).join(' ')}`;
    switch (chave) {
        case 'evitar_noturnas':
            return ehAtividadeNoturna(periodo, atividade);
        case 'evitar_escadas':
            return SINAIS_ESCADA.test(texto);
        case 'mobilidade_reduzida':
            return SINAIS_ESCADA.test(texto) || SINAIS_ESFORCO.test(texto);
        default:
            return false;
    }
}

/**
 * Lista as violações de restrições OBRIGATÓRIAS num roteiro gerado.
 * @returns {Array<{dia:number, periodo:string, atividade:string, restricao:string}>}
 */
export function validarRoteiro(roteiro, restricoes) {
    const violacoes = [];
    const obrigatorias = restricoes?.obrigatorias || [];
    if (obrigatorias.length === 0) return violacoes;

    for (const dia of roteiro?.dias || []) {
        for (const periodo of dia?.periodos || []) {
            for (const atividade of periodo?.atividades || []) {
                for (const chave of obrigatorias) {
                    if (violaRestricao(chave, periodo.periodo, atividade)) {
                        violacoes.push({
                            dia: dia.dia_numero,
                            periodo: periodo.periodo,
                            atividade: atividade.nome || '(sem nome)',
                            restricao: chave,
                        });
                    }
                }
            }
        }
    }
    return violacoes;
}

/**
 * Remove do roteiro tudo que viola restrição obrigatória.
 * Períodos que ficam vazios são descartados; o roteiro nunca é entregue
 * afirmando que respeitou algo que não respeitou.
 * @returns {{roteiro:object, removidas:Array}}
 */
export function aplicarRestricoes(roteiro, restricoes) {
    const obrigatorias = restricoes?.obrigatorias || [];
    if (obrigatorias.length === 0 || !roteiro?.dias) return { roteiro, removidas: [] };

    const removidas = [];
    const dias = roteiro.dias.map(dia => {
        const periodos = (dia.periodos || []).map(periodo => {
            const atividades = (periodo.atividades || []).filter(atividade => {
                const violada = obrigatorias.find(chave => violaRestricao(chave, periodo.periodo, atividade));
                if (violada) {
                    removidas.push({
                        dia: dia.dia_numero,
                        periodo: periodo.periodo,
                        atividade: atividade.nome || '(sem nome)',
                        restricao: violada,
                    });
                    return false;
                }
                return true;
            });
            return { ...periodo, atividades };
        }).filter(p => (p.atividades || []).length > 0);

        return { ...dia, periodos };
    });

    return { roteiro: { ...roteiro, dias }, removidas };
}

// ============================================================
// CLIMA: previsão x clima típico
// Só é "previsão" se houver integração real e a data estiver dentro do
// horizonte da fonte. Fora disso é clima típico do período.
// ============================================================
export const HORIZONTE_PREVISAO_DIAS = 14;

export function tipoDeClima(dataViagem, hoje = new Date()) {
    if (!dataViagem) return 'tipico';
    const alvo = new Date(`${dataViagem}T12:00:00Z`);
    if (Number.isNaN(alvo.getTime())) return 'tipico';
    const dias = Math.round((alvo - hoje) / 86400000);
    return dias >= 0 && dias <= HORIZONTE_PREVISAO_DIAS ? 'previsao' : 'tipico';
}

export function rotuloClima(tipo) {
    return tipo === 'previsao' ? 'Previsão do tempo' : 'Clima típico para o período';
}
