// api/_lib/seasonality.js - BENETRIP VALIDAÇÃO SAZONAL v1.0
//
// A Descoberta pode dizer "vale ir a este lugar nestas datas" — mas só se a
// afirmação tiver fonte. Na auditoria, Lençóis Maranhenses foi recomendado em
// novembro com a alegação de que as lagoas estariam cheias, contrariando as
// fontes oficiais de turismo.
//
// Este módulo NÃO tem tabela de destinos, meses ou climas. Ele:
//   1. monta uma consulta a partir do destino e do mês da viagem;
//   2. busca em provedor global com grounding (api/_lib/web-grounding.js);
//   3. pede ao modelo que EXTRAIA o que os trechos dizem — proibido usar
//      conhecimento próprio;
//   4. devolve status verified | conflicting_sources | unavailable.
//
// Regra dura: sem trecho que sustente a frase, o status é `unavailable` e a
// interface omite a alegação sazonal (ou a marca como não verificada).
// Nenhum estado equivale a "o modelo acha que sim".

import { buscarNaWeb, ordenarPorCredibilidade, groundingDisponivel, credibilidadeDaFonte } from './web-grounding.js';
import { comCache } from './external-cache.js';

const TTL_SAZONALIDADE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias por destino/mês

export const STATUS = {
    VERIFICADO: 'verified',
    CONFLITANTE: 'conflicting_sources',
    INDISPONIVEL: 'unavailable',
};

export const ADEQUACAO = {
    ALTA: 'high',
    MEDIA: 'medium',
    BAIXA: 'low',
    DESCONHECIDA: 'unknown',
};

export const TEXTO_CONFLITO =
    'As condições variam e as fontes consultadas não são conclusivas. Confirme antes de decidir.';

const MESES_PT = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Quantos destinos validamos por vez. Só os FINALISTAS (os que serão
// exibidos), nunca centenas de opções: é o que mantém custo e latência sob
// controle.
export const MAX_DESTINOS_VALIDADOS = 6;
export const CONCORRENCIA = 3;

function getCerebrasKey() {
    return process.env.CEREBRAS_KEY || process.env.CEREBRAS_API_KEY || null;
}

function resultadoIndisponivel(destino, mes, motivo) {
    return {
        status: STATUS.INDISPONIVEL,
        destination: destino,
        travelMonth: mes,
        summary: null,
        suitability: ADEQUACAO.DESCONHECIDA,
        sourceName: null,
        sourceUrl: null,
        checkedAt: new Date().toISOString(),
        reason: motivo,
    };
}

// ============================================================
// CONSULTA
// Genérica por construção: funciona para qualquer lugar do mundo.
// ============================================================
export function montarConsulta({ destino, pais, mes }) {
    const nomeMes = MESES_PT[mes - 1] || '';
    const lugar = [destino, pais].filter(Boolean).join(' ');
    return `${lugar} em ${nomeMes} clima melhor época para visitar condições`;
}

// ============================================================
// EXTRAÇÃO A PARTIR DOS TRECHOS
// O modelo é usado como extrator, não como fonte. O prompt proíbe
// explicitamente completar com conhecimento próprio e exige que a frase saia
// dos trechos fornecidos.
// ============================================================
async function extrairDosTrechos({ destino, pais, mes, resultados }) {
    const key = getCerebrasKey();
    if (!key) return null;

    const nomeMes = MESES_PT[mes - 1] || String(mes);
    const trechos = resultados
        .map((r, i) => `[${i + 1}] ${r.dominio} | ${r.titulo}\n${r.trecho}`)
        .join('\n\n');

    const prompt = `Você recebe TRECHOS DE PÁGINAS DA WEB sobre um destino e um mês. Sua tarefa é EXTRAIR o que esses trechos dizem sobre viajar para lá nesse mês.

DESTINO: ${destino}${pais ? `, ${pais}` : ''}
MÊS DA VIAGEM: ${nomeMes}

TRECHOS:
${trechos}

REGRAS ABSOLUTAS:
1. Use SOMENTE informação presente nos trechos. É PROIBIDO usar seu conhecimento próprio.
2. Se os trechos não falarem do mês ${nomeMes} ou não permitirem concluir nada, responda status "unavailable".
3. Se os trechos se contradisserem (um diz que é boa época, outro diz o contrário), responda status "conflicting_sources".
4. Nunca afirme fenômeno sazonal como garantido (lagoas cheias, neve, floração, desova, ausência de chuva). Descreva o que costuma acontecer, conforme os trechos.
5. O resumo deve ter no máximo 2 frases, em português do Brasil, sem emoji e sem travessão.
6. "sourceIndex" deve ser o número do trecho que sustenta o resumo.

Responda APENAS com JSON:
{"status":"verified|conflicting_sources|unavailable","summary":"...","suitability":"high|medium|low|unknown","sourceIndex":1}`;

    const models = [process.env.CEREBRAS_MODEL || 'gpt-oss-120b', process.env.CEREBRAS_MODEL_FALLBACK || 'zai-glm-4.7'];

    for (const model of models) {
        try {
            const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                body: JSON.stringify({
                    model,
                    messages: [
                        {
                            role: 'system',
                            content: 'Você é um extrator de informação. Responde apenas com JSON válido. Nunca inventa: se os trechos não sustentam a resposta, devolve status "unavailable".',
                        },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.1,
                    max_tokens: 700,
                    reasoning_effort: model.startsWith('zai-glm') ? 'none' : 'low',
                    response_format: { type: 'json_object' },
                }),
            });
            if (!resp.ok) continue;
            const data = await resp.json();
            const conteudo = data.choices?.[0]?.message?.content;
            if (!conteudo) continue;
            const parsed = JSON.parse(conteudo);
            if (!parsed.status) continue;
            return parsed;
        } catch (err) {
            console.warn(`[Sazonalidade] Modelo ${model} falhou: ${err.message}`);
        }
    }
    return null;
}

// ============================================================
// VALIDAÇÃO DE UM DESTINO
// ============================================================
export async function validarSazonalidade({ destino, pais = '', mes, idioma = 'pt-BR' }) {
    const nome = String(destino || '').trim();
    const mesNum = parseInt(mes, 10);
    if (!nome || !(mesNum >= 1 && mesNum <= 12)) {
        return resultadoIndisponivel(nome, mesNum || null, 'parametros_invalidos');
    }
    if (!groundingDisponivel()) {
        return resultadoIndisponivel(nome, mesNum, 'grounding_indisponivel');
    }

    // Cache por destino, país, mês, idioma (a data da verificação vai no
    // próprio objeto). É cache técnico de resposta externa, não base curada.
    const chave = `sazonalidade|${nome.toLowerCase()}|${pais.toLowerCase()}|${mesNum}|${idioma}`;

    return comCache(chave, TTL_SAZONALIDADE_MS, async () => {
        const brutos = await buscarNaWeb(montarConsulta({ destino: nome, pais, mes: mesNum }), { idioma, limite: 6 });
        if (!brutos || brutos.length === 0) {
            return resultadoIndisponivel(nome, mesNum, 'sem_resultados');
        }

        // Fontes oficiais e reconhecidas primeiro
        const resultados = ordenarPorCredibilidade(brutos).slice(0, 5);
        const extraido = await extrairDosTrechos({ destino: nome, pais, mes: mesNum, resultados });

        if (!extraido) {
            return resultadoIndisponivel(nome, mesNum, 'extracao_indisponivel');
        }
        if (extraido.status === STATUS.CONFLITANTE) {
            const fonte = resultados[0];
            return {
                status: STATUS.CONFLITANTE,
                destination: nome,
                travelMonth: mesNum,
                summary: TEXTO_CONFLITO,
                suitability: ADEQUACAO.DESCONHECIDA,
                sourceName: fonte?.dominio || null,
                sourceUrl: fonte?.url || null,
                checkedAt: new Date().toISOString(),
            };
        }
        if (extraido.status !== STATUS.VERIFICADO || !extraido.summary) {
            return resultadoIndisponivel(nome, mesNum, 'sem_evidencia');
        }

        // A frase precisa apontar para um trecho real. Índice inválido =
        // afirmação sem lastro = descartada.
        const idx = parseInt(extraido.sourceIndex, 10) - 1;
        const fonte = resultados[idx];
        if (!fonte || !fonte.url) {
            return resultadoIndisponivel(nome, mesNum, 'fonte_nao_identificada');
        }

        const suitability = [ADEQUACAO.ALTA, ADEQUACAO.MEDIA, ADEQUACAO.BAIXA].includes(extraido.suitability)
            ? extraido.suitability
            : ADEQUACAO.DESCONHECIDA;

        return {
            status: STATUS.VERIFICADO,
            destination: nome,
            travelMonth: mesNum,
            summary: String(extraido.summary).slice(0, 400),
            suitability,
            sourceName: fonte.dominio,
            sourceUrl: fonte.url,
            sourceCredibility: credibilidadeDaFonte(fonte.dominio),
            checkedAt: new Date().toISOString(),
        };
    });
}

// ============================================================
// VALIDAÇÃO EM LOTE (só os finalistas), com limite de concorrência
// ============================================================
export async function validarSazonalidadeEmLote(destinos, { mes, idioma = 'pt-BR' } = {}) {
    const alvos = (destinos || []).slice(0, MAX_DESTINOS_VALIDADOS);
    const saida = new Array(alvos.length);
    let cursor = 0;

    async function worker() {
        while (cursor < alvos.length) {
            const i = cursor++;
            const d = alvos[i];
            try {
                saida[i] = await validarSazonalidade({ destino: d.destino ?? d.name, pais: d.pais ?? d.country ?? '', mes, idioma });
            } catch (err) {
                console.warn(`[Sazonalidade] Falha em ${d.destino || d.name}: ${err.message}`);
                saida[i] = resultadoIndisponivel(d.destino || d.name, mes, 'erro_interno');
            }
        }
    }

    await Promise.all(
        Array.from({ length: Math.max(1, Math.min(CONCORRENCIA, alvos.length)) }, () => worker())
    );
    return saida;
}
