// api/_lib/tripinha-shared.js - BENETRIP TRIPINHA SHARED v1.0
// Geração do conteúdo editorial da Tripinha (insight + escolha do dia) via
// Cerebras, com fallback determinístico baseado nos dados.
//
// Usado por:
// - api/cron/update-discovery.js  → pré-gera insight + escolha 1x/dia por cidade
//   e salva no snapshot (custo ~zero, sem latência na página, visível pra SEO)
// - api/tripinha-insight.js       → fallback on-demand para buscas ao vivo e
//   snapshots antigos que ainda não têm insight embutido

function getCerebrasKey() {
    return process.env.CEREBRAS_KEY || process.env.CEREBRAS_API_KEY || null;
}

// ============================================================
// EVIDÊNCIA ANTES DE RETÓRICA
//
// A auditoria pegou a Tripinha chamando uma tarifa de ~R$ 1.544 de
// "baratinha" e "oportunidade urgente" só porque o preço tinha caído.
// Queda de preço, preço absoluto, comparação histórica e aderência ao
// orçamento são coisas diferentes. Palavras como "urgente", "imperdível"
// ou "muito barato" só podem ser usadas quando há evidência:
//   - queda relevante (>= QUEDA_RELEVANTE_PCT)
//   - histórico suficiente para comparar (>= DIAS_HISTORICO_MINIMO)
//   - dado atualizado recentemente
// Sem isso, o texto fica factual: "o preço caiu R$ X em relação à
// referência recente".
// ============================================================
export const QUEDA_RELEVANTE_PCT = 10;
export const DIAS_HISTORICO_MINIMO = 3;
export const DIAS_DADO_RECENTE = 1;

export function avaliarEvidencias(destinos, opts = {}) {
    const { dataSnapshot = null, hoje = new Date() } = opts;
    const lista = destinos || [];

    // Dado recente: snapshot de hoje ou de ontem
    let diasDesdeAtualizacao = null;
    if (dataSnapshot) {
        const d = new Date(`${dataSnapshot}T12:00:00Z`);
        if (!Number.isNaN(d.getTime())) {
            const base = new Date(hoje);
            base.setUTCHours(12, 0, 0, 0);
            diasDesdeAtualizacao = Math.round((base - d) / 86400000);
        }
    }
    const dadoRecente = diasDesdeAtualizacao === null ? false : diasDesdeAtualizacao <= DIAS_DADO_RECENTE;

    // Maior queda com histórico suficiente por trás
    const quedas = lista
        .filter(d => d.variacao?.direcao === 'desceu'
            && (d.variacao.dias || 0) >= DIAS_HISTORICO_MINIMO
            && Math.abs(d.variacao.percentual || 0) >= QUEDA_RELEVANTE_PCT)
        .sort((a, b) => a.variacao.percentual - b.variacao.percentual);

    const quedaRelevante = quedas[0]
        ? {
            nome: quedas[0].nome,
            preco: quedas[0].preco,
            diferenca: Math.abs(quedas[0].variacao.diferenca),
            percentual: Math.abs(quedas[0].variacao.percentual),
            dias: quedas[0].variacao.dias,
            referencia: quedas[0].variacao.preco_anterior,
        }
        : null;

    // Quedas pequenas ou sem histórico: viram fato, não urgência
    const quedaSimples = lista.find(d => d.variacao?.direcao === 'desceu');

    return {
        quedaRelevante,
        quedaSimples: quedaSimples
            ? {
                nome: quedaSimples.nome,
                preco: quedaSimples.preco,
                diferenca: Math.abs(quedaSimples.variacao.diferenca),
                percentual: Math.abs(quedaSimples.variacao.percentual),
                dias: quedaSimples.variacao.dias || 0,
            }
            : null,
        dadoRecente,
        diasDesdeAtualizacao,
        // Urgência exige queda relevante COM histórico E dado recente
        permiteUrgencia: Boolean(quedaRelevante && dadoRecente),
    };
}

// ============================================================
// GERAÇÃO PRINCIPAL
// opts.incluirEscolha: além do insight, pede a "escolha da Tripinha"
// (1 destino + motivo curto). Sempre retorna algo utilizável:
// { insight, escolha: { nome, motivo } | null, modelo }
// ============================================================
export async function gerarConteudoTripinha(origem, destinos, opts = {}) {
    const { incluirEscolha = false, dataSnapshot = null } = opts;
    const evidencias = avaliarEvidencias(destinos, { dataSnapshot });

    if (!getCerebrasKey() || !destinos || destinos.length === 0) {
        return {
            insight: gerarFallbackInsight(origem, destinos, evidencias),
            escolha: incluirEscolha ? gerarFallbackEscolha(destinos, evidencias) : null,
            modelo: 'fallback',
            motivo: 'CEREBRAS_KEY não configurada',
        };
    }

    try {
        return await gerarViaCerebras(origem, destinos, incluirEscolha, evidencias);
    } catch (error) {
        console.error('❌ Tripinha conteúdo erro:', error.message);
        return {
            insight: gerarFallbackInsight(origem, destinos, evidencias),
            escolha: incluirEscolha ? gerarFallbackEscolha(destinos, evidencias) : null,
            modelo: 'fallback',
            motivo: error.message,
        };
    }
}

async function gerarViaCerebras(origem, destinos, incluirEscolha, evidencias) {
    const top5 = destinos.slice(0, 5);
    const total = destinos.length;
    const precos = destinos.filter(d => d.preco > 0).map(d => d.preco);
    const maisBarato = top5[0];
    const media = precos.length > 0 ? Math.round(precos.reduce((a, b) => a + b, 0) / precos.length) : 0;
    const nacionais = destinos.filter(d => !d.internacional).length;
    const internacionais = destinos.filter(d => d.internacional).length;

    const comVariacao = destinos.filter(d => d.variacao);
    const desceram = comVariacao.filter(d => d.variacao?.direcao === 'desceu');
    const subiram = comVariacao.filter(d => d.variacao?.direcao === 'subiu');

    const topDesceram = desceram
        .sort((a, b) => Math.abs(b.variacao?.diferenca || 0) - Math.abs(a.variacao?.diferenca || 0))
        .slice(0, 3)
        .map(d => `${d.nome} caiu R$${Math.abs(d.variacao.diferenca)} (agora R$${d.preco})`)
        .join('; ');

    const intlBaratos = destinos.filter(d => d.internacional && d.preco <= 2500);
    const intlDestaques = intlBaratos.slice(0, 3).map(d => `${d.nome} R$${d.preco}`).join(', ');

    const escolhaInstrucoes = incluirEscolha
        ? `
Além do insight, escolha 1 destino da lista como "escolha da Tripinha" do dia, o melhor achado considerando preço, queda de preço e apelo do destino. Justifique em até 90 caracteres, tom animado mas factual (baseado nos dados, sem inventar clima/eventos).
Retorne APENAS um JSON: { "insight": "sua frase", "escolha": { "nome": "nome EXATO do destino como está na lista", "motivo": "justificativa curta" } }`
        : `
Retorne APENAS um JSON: { "insight": "sua frase aqui" }`;

    // Linguagem de urgência só é liberada com evidência (ver avaliarEvidencias)
    const regrasLinguagem = evidencias.permiteUrgencia
        ? `- Há evidência para destacar oportunidade: ${evidencias.quedaRelevante.nome} caiu ${evidencias.quedaRelevante.percentual}% (R$${evidencias.quedaRelevante.diferenca}) em relação à média dos últimos ${evidencias.quedaRelevante.dias} dias, e o dado é de hoje. Você PODE usar tom de oportunidade, sempre citando a queda como referência.`
        : `- NÃO existe evidência de oportunidade excepcional hoje. É PROIBIDO usar "urgente", "imperdível", "corre", "vai que é agora", "última chance", "baratinho", "quase de graça" ou equivalentes.
- Escreva de forma factual: cite o preço e, se houver queda, diga "caiu R$X em relação à referência recente".
- Você pode dizer que um preço é o menor ENTRE OS DESTINOS PESQUISADOS, nunca que é barato em termos absolutos.`;

    const systemMessage = `Você é a Tripinha, a cachorrinha mascote da Benetrip, uma plataforma de viagens. Você é simpática, animada e fala de forma coloquial em português brasileiro.

Sua tarefa: gerar UMA frase curta e envolvente (máximo 160 caracteres) comentando os destinos baratos disponíveis hoje para quem sai de ${origem}.

Regras:
- Fale como se fosse um tweet/story curto, na primeira pessoa
- Mencione pelo menos 1 destino pelo nome com preço
- Use no máximo 1 emoji no início da frase
- NÃO use hashtags
- NÃO comece com "Ei" ou "Olha"
- NÃO use travessão (—) no texto: escreva com vírgula, ponto ou dois-pontos
- NUNCA invente preço, clima, evento ou disponibilidade: use apenas os números fornecidos
- Queda de preço, preço absoluto e comparação histórica são coisas diferentes, não troque uma pela outra
${regrasLinguagem}${escolhaInstrucoes}`;

    const userMessage = `Dados de hoje para ${origem}:
- Total: ${total} destinos
- Mais barato: ${maisBarato.nome} (${maisBarato.pais}) por R$${maisBarato.preco}
- Preço médio: R$${media}
- Nacionais: ${nacionais} | Internacionais: ${internacionais}
- Top 5: ${top5.map(d => `${d.nome} R$${d.preco}`).join(', ')}
- Variações: ${comVariacao.length > 0 ? `${desceram.length} destinos ficaram mais baratos, ${subiram.length} ficaram mais caros` : 'sem dados de variação hoje'}
${topDesceram ? `- Maiores quedas: ${topDesceram}` : ''}
${intlDestaques ? `- Internacionais acessíveis (<R$2500): ${intlDestaques}` : ''}
- Estilos: ${[...new Set(destinos.flatMap(d => d.estilos || []))].join(', ')}`;

    const models = [process.env.CEREBRAS_MODEL || 'gpt-oss-120b', process.env.CEREBRAS_MODEL_FALLBACK || 'zai-glm-4.7'];
    const erros = [];

    for (const model of models) {
        try {
            const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getCerebrasKey()}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: systemMessage },
                        { role: 'user', content: userMessage },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.9,
                    max_tokens: 1000, // inclui tokens de "thinking" dos modelos de reasoning
                    reasoning_effort: model.startsWith('zai-glm') ? 'none' : 'low',
                }),
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                erros.push(`Cerebras ${model} HTTP ${response.status}: ${body.slice(0, 200)}`);
                continue;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                erros.push(`Cerebras ${model}: resposta vazia`);
                continue;
            }

            const parsed = JSON.parse(content);
            const insightBruto = (parsed.insight || '').trim();
            if (!insightBruto) {
                erros.push(`Cerebras ${model}: JSON sem campo insight`);
                continue;
            }

            // Guarda determinística: urgência sem evidência não passa, mesmo
            // que o prompt tenha proibido e o modelo tenha insistido.
            const insight = aplicarGuardaDeLinguagem(insightBruto, evidencias);
            if (!insight) {
                erros.push(`Cerebras ${model}: urgência sem evidência ("${insightBruto.slice(0, 80)}")`);
                continue;
            }

            let escolha = null;
            if (incluirEscolha) {
                escolha = validarEscolha(parsed.escolha, destinos) || gerarFallbackEscolha(destinos);
            }

            console.log(`✅ Tripinha conteúdo (${model}): "${insight}"${escolha ? ` | escolha: ${escolha.nome}` : ''}`);
            return { insight, escolha, modelo: model };
        } catch (err) {
            erros.push(`Cerebras ${model}: ${err.message}`);
            continue;
        }
    }

    console.warn(`⚠️ Tripinha: todos os modelos falharam. Erros: ${erros.join(' | ')}`);
    return {
        insight: gerarFallbackInsight(origem, destinos),
        escolha: incluirEscolha ? gerarFallbackEscolha(destinos) : null,
        modelo: 'fallback',
        motivo: erros.join(' | '),
    };
}

// A escolha só vale se apontar para um destino que existe na lista
// (proteção contra alucinação de destino inexistente)
function validarEscolha(escolha, destinos) {
    if (!escolha || !escolha.nome) return null;
    const nome = String(escolha.nome).trim().toLowerCase();
    const dest = destinos.find(d => (d.nome || '').toLowerCase() === nome);
    if (!dest) return null;
    return {
        nome: dest.nome,
        motivo: String(escolha.motivo || '').trim().slice(0, 120),
    };
}

// ============================================================
// GUARDA DE LINGUAGEM (determinística)
//
// O prompt proíbe urgência sem evidência, mas prompt não é garantia: o
// modelo pode escorregar e os snapshots antigos, gerados antes da regra,
// continuam guardados no banco. Esta guarda roda na GERAÇÃO e também na
// RENDERIZAÇÃO, então a página nunca exibe "corre que é oportunidade
// urgente" só porque um preço caiu.
//
// Não é censura de estilo: é a diferença entre afirmar escassez (que não
// medimos) e relatar variação de preço (que medimos).
// ============================================================
const TERMOS_URGENCIA = [
    'urgente', 'urgência', 'corre ', 'corra', 'correndo pra', 'última chance',
    'ultima chance', 'vai acabar', 'acaba hoje', 'imperdível', 'imperdivel',
    'baratinh', 'quase de graça', 'quase de graca', 'pechinch', 'não perca',
    'nao perca', 'aproveite agora', 'só hoje', 'so hoje', 'agora ou nunca',
    'vai que é agora', 'queda forte', 'despencou', 'preço absurdo',
];

export function contemUrgencia(texto) {
    const t = String(texto || '').toLowerCase();
    return TERMOS_URGENCIA.some((termo) => t.includes(termo));
}

// Devolve o texto quando ele é aceitável, ou null quando a afirmação de
// urgência não tem evidência por trás. Quem chama substitui pelo fallback
// factual em vez de exibir a frase original.
export function aplicarGuardaDeLinguagem(texto, { permiteUrgencia = false } = {}) {
    if (!texto) return null;
    if (!contemUrgencia(texto)) return texto;
    if (permiteUrgencia) return texto;
    return null;
}

// ============================================================
// FALLBACKS DETERMINÍSTICOS (sem IA, baseados nos dados)
// ============================================================
export function gerarFallbackEscolha(destinos, evidencias = null) {
    if (!destinos || destinos.length === 0) return null;
    const ev = evidencias || avaliarEvidencias(destinos);

    // Queda com histórico suficiente: pode falar em oportunidade
    if (ev.quedaRelevante) {
        const q = ev.quedaRelevante;
        return {
            nome: q.nome,
            motivo: `Caiu ${q.percentual}% em relação à média dos últimos ${q.dias} dias: agora R$${q.preco}.`,
        };
    }

    // Queda sem histórico suficiente: fato, sem adjetivo
    if (ev.quedaSimples) {
        const q = ev.quedaSimples;
        return {
            nome: q.nome,
            motivo: `O preço caiu R$${q.diferenca} em relação à referência recente: agora R$${q.preco}.`,
        };
    }

    const maisBarato = destinos[0];
    return {
        nome: maisBarato.nome,
        motivo: `Menor preço entre os ${destinos.length} destinos pesquisados hoje: R$${maisBarato.preco}.`,
    };
}

export function gerarFallbackInsight(origem, destinos, evidencias = null) {
    if (!destinos || destinos.length === 0) return `✈️ Buscando as melhores ofertas de ${origem} pra você!`;

    const ev = evidencias || avaliarEvidencias(destinos);
    const maisBarato = destinos[0];
    const segundo = destinos[1];
    const total = destinos.length;
    const precos = destinos.filter(d => d.preco > 0).map(d => d.preco);
    const media = precos.length > 0 ? Math.round(precos.reduce((a, b) => a + b, 0) / precos.length) : 0;
    const nacionais = destinos.filter(d => !d.internacional);
    const internacionais = destinos.filter(d => d.internacional);

    // Pool de frases contextuais — escolha baseada no hash do dia + origem
    const hoje = new Date().getDate();
    const seed = (hoje + origem.length + total) % 20;

    // Prioridade 1: queda com histórico suficiente — única situação em que
    // a Tripinha pode falar em oportunidade
    if (ev.quedaRelevante) {
        const q = ev.quedaRelevante;
        const frases = [
            `📉 ${q.nome} caiu ${q.percentual}% em relação à média dos últimos ${q.dias} dias: agora R$${q.preco}`,
            `💸 ${q.nome} está R$${q.diferenca} mais barato que a média recente: R$${q.preco} saindo de ${origem}`,
            `🔎 Boa hora pra olhar ${q.nome}: R$${q.preco}, ${q.percentual}% abaixo da referência dos últimos ${q.dias} dias`,
        ];
        return frases[seed % frases.length];
    }

    // Prioridade 2: houve queda, mas sem histórico suficiente para chamar de
    // oportunidade — vira fato, sem adjetivo
    if (ev.quedaSimples) {
        const q = ev.quedaSimples;
        return `📉 O preço de ${q.nome} caiu R$${q.diferenca} em relação à referência recente: agora R$${q.preco} saindo de ${origem}`;
    }

    // Prioridade 3: comparações RELATIVAS ao conjunto pesquisado
    if (internacionais.length >= 3) {
        const dest = internacionais[0];
        return `🌎 Entre os destinos pesquisados hoje saindo de ${origem}, ${dest.nome} é o internacional mais em conta: R$${dest.preco}`;
    }

    if (total >= 20) {
        const frases = [
            `✈️ ${total} destinos pesquisados saindo de ${origem}. O menor preço é ${maisBarato.nome}, R$${maisBarato.preco}`,
            `🗺️ ${nacionais.length} nacionais e ${internacionais.length} internacionais saindo de ${origem}, e ${maisBarato.nome} lidera com R$${maisBarato.preco}`,
            `🐶 Farejei ${total} opções de ${origem}: média R$${media}, e ${maisBarato.nome} sai por R$${maisBarato.preco}`,
        ];
        return frases[seed % frases.length];
    }

    const frases = [
        `✈️ Menor preço entre os destinos pesquisados hoje saindo de ${origem}: ${maisBarato.nome}, R$${maisBarato.preco}`,
        `🐶 De ${origem}, achei ${maisBarato.nome} por R$${maisBarato.preco}${segundo ? ` e ${segundo.nome} por R$${segundo.preco}` : ''}`,
        `💡 Saindo de ${origem}: ${maisBarato.nome} está R$${maisBarato.preco}; a média dos ${total} destinos é R$${media}`,
    ];
    return frases[seed % frases.length];
}
