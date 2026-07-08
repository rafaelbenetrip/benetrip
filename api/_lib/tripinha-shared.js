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
// GERAÇÃO PRINCIPAL
// opts.incluirEscolha: além do insight, pede a "escolha da Tripinha"
// (1 destino + motivo curto). Sempre retorna algo utilizável:
// { insight, escolha: { nome, motivo } | null, modelo }
// ============================================================
export async function gerarConteudoTripinha(origem, destinos, opts = {}) {
    const { incluirEscolha = false } = opts;

    if (!getCerebrasKey() || !destinos || destinos.length === 0) {
        return {
            insight: gerarFallbackInsight(origem, destinos),
            escolha: incluirEscolha ? gerarFallbackEscolha(destinos) : null,
            modelo: 'fallback',
            motivo: 'CEREBRAS_KEY não configurada',
        };
    }

    try {
        return await gerarViaCerebras(origem, destinos, incluirEscolha);
    } catch (error) {
        console.error('❌ Tripinha conteúdo erro:', error.message);
        return {
            insight: gerarFallbackInsight(origem, destinos),
            escolha: incluirEscolha ? gerarFallbackEscolha(destinos) : null,
            modelo: 'fallback',
            motivo: error.message,
        };
    }
}

async function gerarViaCerebras(origem, destinos, incluirEscolha) {
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
Além do insight, escolha 1 destino da lista como "escolha da Tripinha" do dia — o melhor achado considerando preço, queda de preço e apelo do destino. Justifique em até 90 caracteres, tom animado mas factual (baseado nos dados, sem inventar clima/eventos).
Retorne APENAS um JSON: { "insight": "sua frase", "escolha": { "nome": "nome EXATO do destino como está na lista", "motivo": "justificativa curta" } }`
        : `
Retorne APENAS um JSON: { "insight": "sua frase aqui" }`;

    const systemMessage = `Você é a Tripinha, a cachorrinha mascote da Benetrip — uma plataforma de viagens. Você é simpática, animada e fala de forma coloquial em português brasileiro.

Sua tarefa: gerar UMA frase curta e envolvente (máximo 160 caracteres) comentando os destinos baratos disponíveis hoje para quem sai de ${origem}.

Regras:
- Fale como se fosse um tweet/story curto, na primeira pessoa
- PRIORIZE variações de preço: se destinos ficaram mais baratos, destaque como OPORTUNIDADE URGENTE
- Se preços caíram, mencione o destino específico que caiu e quanto (ex: "Salvador caiu R$120!")
- Se preços subiram, sugira alternativas baratas
- Se há internacionais abaixo de R$2.500, destaque como achado
- Mencione pelo menos 1 destino pelo nome com preço
- Use no máximo 1 emoji no início da frase
- NÃO use hashtags
- NÃO comece com "Ei" ou "Olha"
- Seja criativa, varie o estilo, gere urgência positiva (tipo "corre!", "vai que é agora")${escolhaInstrucoes}`;

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
            const insight = (parsed.insight || '').trim();
            if (!insight) {
                erros.push(`Cerebras ${model}: JSON sem campo insight`);
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
// FALLBACKS DETERMINÍSTICOS (sem IA, baseados nos dados)
// ============================================================
export function gerarFallbackEscolha(destinos) {
    if (!destinos || destinos.length === 0) return null;

    // Prioridade: maior queda de preço; senão, o mais barato da lista
    const desceram = destinos.filter(d => d.variacao?.direcao === 'desceu');
    const maiorQueda = desceram.sort((a, b) => (a.variacao?.percentual || 0) - (b.variacao?.percentual || 0))[0];

    if (maiorQueda) {
        return {
            nome: maiorQueda.nome,
            motivo: `Caiu ${Math.abs(maiorQueda.variacao.percentual)}% — melhor oportunidade de hoje!`,
        };
    }

    const maisBarato = destinos[0];
    return {
        nome: maisBarato.nome,
        motivo: `O voo mais barato de hoje: R$${maisBarato.preco}. Bom demais pra deixar passar!`,
    };
}

export function gerarFallbackInsight(origem, destinos) {
    if (!destinos || destinos.length === 0) return `✈️ Buscando as melhores ofertas de ${origem} pra você!`;

    const maisBarato = destinos[0];
    const segundo = destinos[1];
    const total = destinos.length;
    const precos = destinos.filter(d => d.preco > 0).map(d => d.preco);
    const media = precos.length > 0 ? Math.round(precos.reduce((a, b) => a + b, 0) / precos.length) : 0;
    const nacionais = destinos.filter(d => !d.internacional);
    const internacionais = destinos.filter(d => d.internacional);
    const intlBaratos = internacionais.filter(d => d.preco <= 2500);

    // Variações
    const desceram = destinos.filter(d => d.variacao?.direcao === 'desceu');
    const maiorQueda = desceram.sort((a, b) => Math.abs(b.variacao?.diferenca || 0) - Math.abs(a.variacao?.diferenca || 0))[0];

    // Pool de frases contextuais — escolha baseada no hash do dia + origem
    const hoje = new Date().getDate();
    const seed = (hoje + origem.length + total) % 20;

    // Prioridade 1: variação de preço
    if (maiorQueda) {
        const queda = Math.abs(maiorQueda.variacao.diferenca);
        const frases = [
            `📉 ${maiorQueda.nome} caiu R$${queda} e tá custando R$${maiorQueda.preco} — vai que é agora!`,
            `🔥 Preço despencou! ${maiorQueda.nome} por R$${maiorQueda.preco} (caiu R$${queda}) saindo de ${origem}`,
            `💸 ${maiorQueda.nome} ficou R$${queda} mais barato hoje! Tá R$${maiorQueda.preco} saindo de ${origem}`,
        ];
        return frases[seed % frases.length];
    }

    // Prioridade 2: pechincha (preço muito baixo)
    if (maisBarato.preco <= 400) {
        const frases = [
            `🔥 ${maisBarato.nome} por R$${maisBarato.preco}?! Isso é preço de rodoviária, não de avião! Corre!`,
            `✈️ R$${maisBarato.preco} pra ${maisBarato.nome} saindo de ${origem} — tá praticamente de graça!`,
            `💰 Achei ${maisBarato.nome} por R$${maisBarato.preco}! Preço assim some rápido, bora?`,
        ];
        return frases[seed % frases.length];
    }

    // Prioridade 3: internacionais baratos
    if (intlBaratos.length >= 3) {
        const dest = intlBaratos[0];
        const frases = [
            `🌎 ${intlBaratos.length} destinos internacionais abaixo de R$2.500! ${dest.nome} por R$${dest.preco} tá imperdível`,
            `✈️ Quer sair do Brasil? ${dest.nome} por R$${dest.preco} e mais ${intlBaratos.length - 1} opções baratas saindo de ${origem}!`,
            `🌍 ${dest.nome} a R$${dest.preco} saindo de ${origem}! E tem mais ${intlBaratos.length - 1} internacionais acessíveis`,
        ];
        return frases[seed % frases.length];
    }

    // Prioridade 4: bom preço geral
    if (maisBarato.preco <= 800) {
        const frases = [
            `✈️ ${maisBarato.nome} por R$${maisBarato.preco} é o destino mais barato de ${origem} hoje — corre!`,
            `🐶 Farejei ${total} destinos de ${origem} e o campeão é ${maisBarato.nome} por R$${maisBarato.preco}!`,
            `💡 De ${origem} pra ${maisBarato.nome} por R$${maisBarato.preco}${segundo ? ` ou ${segundo.nome} por R$${segundo.preco}` : ''} — qual você escolhe?`,
        ];
        return frases[seed % frases.length];
    }

    // Prioridade 5: muitas opções
    if (total >= 20) {
        const frases = [
            `✈️ ${total} destinos saindo de ${origem}! O mais em conta é ${maisBarato.nome} por R$${maisBarato.preco}`,
            `🗺️ Tem ${nacionais.length} nacionais e ${internacionais.length} internacionais de ${origem} — ${maisBarato.nome} lidera com R$${maisBarato.preco}`,
            `🐶 Fuçando ${total} opções de ${origem}! Preço médio R$${media}, mas tem ${maisBarato.nome} por R$${maisBarato.preco}`,
        ];
        return frases[seed % frases.length];
    }

    // Default variado
    const frases = [
        `✈️ ${maisBarato.nome} por R$${maisBarato.preco} é a melhor pedida saindo de ${origem} hoje!`,
        `🐶 O melhor que achei de ${origem}: ${maisBarato.nome} por R$${maisBarato.preco}${segundo ? ` e ${segundo.nome} por R$${segundo.preco}` : ''}`,
        `💡 Saindo de ${origem}? ${maisBarato.nome} tá R$${maisBarato.preco} — preço médio dos ${total} destinos é R$${media}`,
        `✈️ Top 1 de ${origem}: ${maisBarato.nome} a R$${maisBarato.preco}! Tem ${total} destinos pra explorar`,
    ];
    return frases[seed % frases.length];
}
