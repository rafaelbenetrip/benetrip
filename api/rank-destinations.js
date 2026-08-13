// api/rank-destinations.js - v5.1 (Cerebras + camada determinística)
// Vercel Serverless Function
// Recebe destinos pré-filtrados (orçamento é TETO, filtrado no frontend),
// aplica score determinístico de qualidade de voo (escalas, duração, perfil)
// e usa LLM apenas para explicar e desempatar — nunca para violar limites objetivos.

import {
    ranquearPorQualidade,
    violaRestricaoObjetiva,
    descreverPenalidades,
} from './_lib/flight-quality.js';

function getCerebrasKey() {
    return process.env.CEREBRAS_KEY || process.env.CEREBRAS_API_KEY || null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
        destinos, preferencias, companhia, numPessoas,
        adultos, criancas, bebes,
        noites, orcamento, moeda, dataIda, dataVolta,
        cenario,
        observacoes
    } = req.body;

    if (!destinos || !Array.isArray(destinos) || destinos.length === 0) {
        return res.status(400).json({
            error: 'Lista de destinos obrigatória',
            received: { destinos: destinos?.length, preferencias, orcamento }
        });
    }

    // ============================================================
    // v5.1: CAMADA DETERMINÍSTICA — score de qualidade de voo
    // Calculada antes da IA; a lista enviada ao LLM já vem ordenada
    // por qualidade e o resultado da IA é validado contra ela.
    // ============================================================
    const noitesNum = parseInt(noites) || 7;
    const perfilVoo = {
        orcamento: parseFloat(orcamento) || 0,
        criancas: parseInt(criancas) || 0,
        bebes: parseInt(bebes) || 0,
        noites: noitesNum,
    };
    const destinosQualidade = ranquearPorQualidade(destinos, perfilVoo);

    if (!getCerebrasKey()) {
        console.warn('⚠️ CEREBRAS_KEY não configurada, usando fallback determinístico');
        return res.status(200).json(rankByQuality(destinosQualidade, orcamento));
    }

    try {
        console.log(`🤖 Ranqueando ${destinos.length} destinos | ${companhia} | ${preferencias} | ${moeda} ${orcamento}`);
        if (observacoes) console.log(`💬 Observações do viajante: "${observacoes}"`);

        // ============================================================
        // CALCULAR ESTRUTURA DE RESULTADOS
        // ============================================================
        const totalDestinos = destinos.length;
        const numAlternativas = Math.min(3, Math.max(0, totalDestinos - 2));
        const temSurpresa = totalDestinos >= 3 ? 1 : 0;
        const totalSelecionados = 1 + numAlternativas + (temSurpresa ? 1 : 0);
        const poucosResultados = totalDestinos < 5;

        console.log(`📊 Estrutura: top(1) + alt(${numAlternativas}) + surpresa(${temSurpresa ? 1 : 0}) = ${totalSelecionados} de ${totalDestinos} disponíveis`);

        // ============================================================
        // DETECTAR ESTAÇÃO DO ANO / CONTEXTO SAZONAL COM DATAS REAIS
        // ============================================================
        const mesViagem = dataIda ? new Date(dataIda + 'T12:00:00').getMonth() + 1 : null;
        const estacaoInfo = mesViagem ? getSeasonContext(mesViagem) : '';
        const nomeMesViagem = mesViagem
            ? ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][mesViagem - 1]
            : null;

        // ============================================================
        // SÍMBOLO DA MOEDA
        // ============================================================
        const simboloMoeda = { 'BRL': 'R$', 'USD': 'US$', 'EUR': '€' }[moeda] || 'R$';
        const nomeMoeda = { 'BRL': 'reais', 'USD': 'dólares', 'EUR': 'euros' }[moeda] || 'reais';

        // ============================================================
        // FORMATO COMPACTO PARA O LLM
        // v5.1: lista já ordenada pelo score determinístico, com duração
        // e alertas objetivos por destino visíveis para a IA
        // ============================================================
        const listaCompacta = destinosQualidade.map((d, i) => {
            const passagem = d.flight?.price || 0;
            const paradas = d.flight?.stops || 0;
            const fontes = d._source_count || 1;
            const hotel = d.avg_cost_per_night || 0;
            const durMin = d.flight?.flight_duration_minutes || 0;
            const durTxt = durMin > 0 ? `${Math.floor(durMin / 60)}h${String(durMin % 60).padStart(2, '0')}` : '?';
            const hotelTxt = hotel > 0 ? `Hotel:${simboloMoeda}${hotel}/noite` : 'Hotel:sem dado';
            const alertas = descreverPenalidades(d._quality);
            const alertaTxt = alertas.length > 0 ? `|ALERTA: ${alertas.join('; ')}` : '';
            return `${i + 1}|${d.name}|${d.country}|${d.primary_airport}|${simboloMoeda}${passagem}|${paradas}paradas|voo ${durTxt}|score ${d._quality.score}|${fontes}fontes|${hotelTxt}${alertaTxt}`;
        }).join('\n');

        // ============================================================
        // CONTEXTO DE PASSAGEIROS (famílias com crianças/bebês)
        // ============================================================
        let passageirosInfo = `${numPessoas || 1} pessoa(s)`;
        let restricoesFamilia = '';

        if ((criancas || 0) > 0 || (bebes || 0) > 0) {
            const parts = [`${adultos || 1} adulto(s)`];
            if (criancas > 0) parts.push(`${criancas} criança(s) de 2-11 anos`);
            if (bebes > 0) parts.push(`${bebes} bebê(s) de 0-1 ano`);
            passageirosInfo = parts.join(', ');

            restricoesFamilia = `
ATENÇÃO ESPECIAL - VIAGEM COM CRIANÇAS/BEBÊS:
- Priorize destinos com BOA INFRAESTRUTURA para famílias com crianças pequenas
- Evite destinos que exigem longas caminhadas ou acesso difícil com carrinhos
- Considere destinos com hospitais/clínicas acessíveis
- Voos diretos ou com poucas paradas são PREFERÍVEIS (viagem longa com crianças é cansativa)
${bebes > 0 ? '- BEBÊ(S) NO COLO: priorize destinos com boa estrutura de saúde e clima ameno' : ''}
${criancas > 0 ? '- CRIANÇAS: considere destinos com atividades infantis, parques, praias calmas' : ''}`;
        }

        // ============================================================
        // v4.3: BLOCO DE OBSERVAÇÕES DO VIAJANTE
        // ============================================================
        const observacoesBloco = observacoes
            ? `\nOBSERVAÇÕES PESSOAIS DO VIAJANTE (MUITO IMPORTANTE — leve em conta na seleção e nos comentários):
"${observacoes}"
`
            : '';

        // ============================================================
        // PROMPT COMPLETO
        // ============================================================
        const prompt = `ESPECIALISTA EM TURISMO - Seleção personalizada de destinos

PERFIL DO VIAJANTE:
- Companhia: ${companhia || 'Não informado'}
- Passageiros: ${passageirosInfo}
- O que busca: ${preferencias || 'Não informado'}
- Duração: ${noites || '?'} noites
- Período: ${dataIda || '?'} a ${dataVolta || '?'}
${estacaoInfo ? `- Contexto sazonal: ${estacaoInfo}` : ''}
- Orçamento PASSAGENS (ida+volta/pessoa): ${simboloMoeda} ${orcamento} ${nomeMoeda}
${cenario === 'abaixo' ? `- NOTA: Poucos destinos dentro do orçamento — valorize os disponíveis` : ''}
${restricoesFamilia}
${observacoesBloco}
DESTINOS PRÉ-FILTRADOS (todos DENTRO do orçamento — o orçamento é um TETO, opções mais baratas são tão válidas quanto as próximas do limite):
Formato: ID|Nome|País|Aeroporto|Passagem ida+volta|Paradas|Duração do voo|Score objetivo (0-125, maior = melhor logística)|Fontes|Hotel/noite|Alertas
A lista já está ORDENADA pelo score objetivo (preço, escalas, duração do voo vs. duração da viagem, perfil dos passageiros).
${listaCompacta}

TAREFA: Com base no PERFIL acima, escolha os melhores destinos:
1. MELHOR DESTINO - o que mais combina com o perfil + melhor custo-benefício
${numAlternativas > 0 ? `2. ${numAlternativas} ALTERNATIVA${numAlternativas > 1 ? 'S' : ''} variada${numAlternativas > 1 ? 's' : ''} (diferentes perfis/países)` : ''}
${temSurpresa ? `3. 1 SURPRESA (inesperado e interessante)` : ''}

CRITÉRIOS DE SELEÇÃO (em ordem de prioridade):
1. RESTRIÇÕES OBJETIVAS (NÃO NEGOCIÁVEL): você pode desempatar entre destinos de score parecido, mas NÃO pode escolher como MELHOR DESTINO uma opção com ALERTA de escalas/duração quando existir opção sem alerta de score igual ou maior. Um destino mais barato que o orçamento NUNCA é motivo de rejeição.
2. MATCH COM PERFIL: O destino combina com "${preferencias}"? É adequado para ${companhia}?
   - Família com crianças → segurança, infraestrutura, atividades para crianças, voos curtos
   - Família com bebês → infraestrutura de saúde, clima ameno, facilidade de acesso
   - Casal → romance, gastronomia, cenários bonitos
   - Amigos → diversão, vida noturna, aventuras em grupo
   - Sozinho → segurança, facilidade, experiências culturais
3. ADEQUAÇÃO À ÉPOCA: a viagem é de ${dataIda || '?'} a ${dataVolta || '?'}${nomeMesViagem ? ` (${nomeMesViagem})` : ''}. Avalie se o destino é bom NESSAS datas.
4. FONTES: Destinos com 2-3 fontes são mais confiáveis
5. CUSTO TOTAL: passagem + hotel × ${noites || 7} noites
6. DIVERSIDADE: Não repita países
${(criancas > 0 || bebes > 0) ? '7. LOGÍSTICA FAMILIAR: Prefira voos diretos ou com menos paradas' : ''}

REGRAS DE SAZONALIDADE (OBRIGATÓRIO):
✓ NUNCA apresente fenômeno sazonal (lagoas cheias, neve, floração, desova, clima perfeito) como GARANTIDO
✓ Se a experiência típica do destino depende da época e ${nomeMesViagem || 'o mês da viagem'} está fora do período mais favorável, diga isso em "adequacao_epoca" (ex: "fora do período mais favorável para as lagoas — confirme as condições antes da viagem")
✓ Use expressões como "costuma", "geralmente", "as condições variam nesta época", nunca certezas
✓ Preencha "adequacao_epoca" (1 frase sobre o destino nessas datas) e "ponto_negativo" (1 ponto de atenção honesto: escalas, chuva, alta temporada, deslocamento etc.) para CADA destino escolhido

REGRAS:
✓ Use APENAS IDs da lista (1-${destinos.length})
✓ Escreva "comentario" e "dica" em português brasileiro
✓ O "comentario" deve ser da Tripinha (cachorrinha mascote) falando DIRETAMENTE com o viajante, como amiga animada (ex: "Esse lugar é incrível! Você vai amar as praias de lá...")
✓ A "dica" também deve ter tom da Tripinha (ex: "Fica a dica da Tripinha: reserve o passeio X com antecedência!")
✓ Use no máximo 1 referência canina por destino para não saturar
✓ NÃO use emoji nos textos (o frontend já cuida disso)
${observacoes ? '✓ O viajante deixou OBSERVAÇÕES PESSOAIS — faça referência a elas nos comentários e dicas, mostrando que a Tripinha levou em conta o pedido específico dele' : ''}
✓ Retorne APENAS JSON válido, sem markdown

JSON:
{
  "top_destino": {"id":1,"razao":"frase curta","comentario":"2-3 frases descritivas da Tripinha","dica":"dica prática da Tripinha","adequacao_epoca":"1 frase honesta sobre a época","ponto_negativo":"1 ponto de atenção"},
  "alternativas": [${numAlternativas > 0 ? '\n    {"id":2,"razao":"frase","comentario":"descrição","dica":"dica","adequacao_epoca":"...","ponto_negativo":"..."}' : ''}${numAlternativas > 1 ? ',\n    {"id":3,"razao":"frase","comentario":"descrição","dica":"dica","adequacao_epoca":"...","ponto_negativo":"..."}' : ''}${numAlternativas > 2 ? ',\n    {"id":4,"razao":"frase","comentario":"descrição","dica":"dica","adequacao_epoca":"...","ponto_negativo":"..."}' : ''}\n  ],
  "surpresa": ${temSurpresa ? '{"id":5,"razao":"frase surpreendente","comentario":"descrição","dica":"dica","adequacao_epoca":"...","ponto_negativo":"..."}' : 'null'}
}`;

        // ============================================================
        // TENTAR MODELOS EM CASCATA
        // ============================================================
        const models = [process.env.CEREBRAS_MODEL || 'gpt-oss-120b', process.env.CEREBRAS_MODEL_FALLBACK || 'zai-glm-4.7'];
        let ranking = null;
        let usedModel = null;

        for (const model of models) {
            try {
                const aiResponse = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getCerebrasKey()}`
                    },
                    body: JSON.stringify({
                        model,
                        messages: [
                            {
                                role: 'system',
                                content: 'Você é a Tripinha, uma cachorrinha vira-lata caramelo que é especialista em turismo. Retorna APENAS JSON válido em português do Brasil. Zero texto extra. IDs referem a destinos da lista fornecida. Seus comentários são entusiasmados mas informativos, como uma amiga animada dando dicas de viagem. Quando a viagem inclui crianças ou bebês, sempre considere segurança e praticidade nas recomendações.'
                            },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.4,
                        max_tokens: 4000, // inclui tokens de "thinking" dos modelos de reasoning
                        reasoning_effort: model.startsWith('zai-glm') ? 'none' : 'low',
                        response_format: { type: 'json_object' }
                    })
                });

                if (!aiResponse.ok) {
                    const errText = await aiResponse.text();
                    console.warn(`⚠️ Modelo ${model} falhou: ${aiResponse.status} - ${errText}`);
                    continue;
                }

                const aiData = await aiResponse.json();
                const content = aiData.choices?.[0]?.message?.content;

                if (!content) {
                    console.warn(`⚠️ Modelo ${model}: resposta vazia`);
                    continue;
                }

                const parsed = JSON.parse(content);

                if (!parsed.top_destino || typeof parsed.top_destino.id !== 'number') {
                    console.warn(`⚠️ Modelo ${model}: JSON inválido`);
                    continue;
                }

                ranking = parsed;
                usedModel = model;
                console.log(`✅ Sucesso com ${model}`);
                break;

            } catch (modelErr) {
                console.warn(`⚠️ Erro no modelo ${model}:`, modelErr.message);
                continue;
            }
        }

        // ============================================================
        // FALLBACK: Ranking determinístico (sem LLM)
        // ============================================================
        if (!ranking) {
            console.warn('⚠️ Todos os modelos falharam, usando fallback determinístico');
            return res.status(200).json(rankByQuality(destinosQualidade, orcamento));
        }

        // ============================================================
        // MAPEAR IDs → DADOS REAIS (na ordem enviada ao LLM)
        // ============================================================
        const mapDestino = (item) => {
            if (!item || typeof item.id !== 'number') return null;
            const idx = item.id - 1;
            if (idx < 0 || idx >= destinosQualidade.length) return null;
            const d = destinosQualidade[idx];
            return {
                id: item.id,
                name: d.name,
                primary_airport: d.primary_airport,
                country: d.country,
                coordinates: d.coordinates,
                image: d.image,
                flight: d.flight,
                avg_cost_per_night: d.avg_cost_per_night,
                outbound_date: d.outbound_date,
                return_date: d.return_date,
                _sources: d._sources,
                _source_count: d._source_count,
                _quality: d._quality,
                razao: item.razao || '',
                comentario: item.comentario || '',
                dica: item.dica || '',
                adequacao_epoca: item.adequacao_epoca || '',
                ponto_negativo: item.ponto_negativo || '',
            };
        };

        const resultado = {
            top_destino: mapDestino(ranking.top_destino),
            alternativas: (ranking.alternativas || []).map(mapDestino).filter(Boolean),
            surpresa: mapDestino(ranking.surpresa),
            _model: usedModel,
            _totalAnalisados: destinos.length,
            _poucosResultados: poucosResultados,
        };

        if (!resultado.top_destino) {
            console.warn('⚠️ top_destino inválido após mapeamento, usando fallback');
            return res.status(200).json(rankByQuality(destinosQualidade, orcamento));
        }

        // ============================================================
        // v5.1: VALIDAÇÃO DETERMINÍSTICA PÓS-IA
        // Se o top_destino da IA viola restrição objetiva (família + 2 ou
        // mais escalas havendo opção melhor), promove a melhor alternativa
        // que respeita a restrição e rebaixa a escolha da IA.
        // ============================================================
        if (violaRestricaoObjetiva(resultado.top_destino, destinosQualidade, perfilVoo)) {
            const candidatos = [
                ...resultado.alternativas,
                ...(resultado.surpresa ? [resultado.surpresa] : []),
            ].filter(d => d && !violaRestricaoObjetiva(d, destinosQualidade, perfilVoo));

            let substituto = candidatos[0] || null;
            if (!substituto) {
                // Nenhuma escolha da IA respeita a restrição: usa o melhor do score
                const melhor = destinosQualidade.find(d => !violaRestricaoObjetiva(d, destinosQualidade, perfilVoo));
                if (melhor) {
                    substituto = {
                        ...melhor,
                        id: destinosQualidade.indexOf(melhor) + 1,
                        razao: 'Melhor combinação objetiva de preço, escalas e duração para o seu grupo.',
                        comentario: '',
                        dica: '',
                        adequacao_epoca: '',
                        ponto_negativo: '',
                    };
                }
            }

            if (substituto) {
                console.warn(`⚖️ Top da IA (${resultado.top_destino.name}, ${resultado.top_destino.flight?.stops} escalas) viola restrição objetiva — promovendo ${substituto.name}`);
                const antigoTop = resultado.top_destino;
                resultado.top_destino = substituto;
                resultado.alternativas = [
                    antigoTop,
                    ...resultado.alternativas.filter(d => d !== substituto),
                ].slice(0, 3);
                if (resultado.surpresa === substituto) resultado.surpresa = null;
                resultado._ajusteDeterministico = true;
            }
        }

        return res.status(200).json(resultado);

    } catch (erro) {
        console.error('❌ Erro no ranking:', erro);

        try {
            return res.status(200).json(rankByQuality(ranquearPorQualidade(destinos, perfilVoo), orcamento));
        } catch (fallbackErr) {
            return res.status(500).json({
                error: 'Erro interno no ranking',
                message: erro.message
            });
        }
    }
}

// ============================================================
// UTILIDADE: Contexto sazonal por mês
// ============================================================
function getSeasonContext(mes) {
    const info = {
        1:  'Janeiro: verão no sul (alta temporada, praias), inverno no norte (neve, frio)',
        2:  'Fevereiro: verão no sul (carnaval, calor), inverno no norte (esqui, frio)',
        3:  'Março: fim do verão no sul, início da primavera no norte',
        4:  'Abril: outono no sul, primavera no norte (flores, clima ameno)',
        5:  'Maio: outono no sul (temperaturas caindo), primavera no norte (agradável)',
        6:  'Junho: início inverno no sul (festas juninas), verão no norte (calor, festivais)',
        7:  'Julho: inverno no sul (férias escolares), verão no norte (alta temporada, praias)',
        8:  'Agosto: inverno no sul (seco em muitas regiões), verão no norte (calor, festivais)',
        9:  'Setembro: início da primavera no sul (flores, temperaturas subindo), início do outono no norte (folhagem)',
        10: 'Outubro: primavera no sul (bom clima), outono no norte (folhagem colorida, Oktoberfest)',
        11: 'Novembro: primavera/pré-verão no sul, outono tardio no norte (pré-inverno, Black Friday)',
        12: 'Dezembro: verão/festas no sul (alta temporada), inverno no norte (natal, mercados natalinos, neve)',
    };
    return info[mes] || '';
}

// ============================================================
// FALLBACK: Ranking determinístico por score de qualidade (sem LLM)
// Recebe a lista JÁ ordenada por ranquearPorQualidade().
// ============================================================
function rankByQuality(destinosOrdenados, orcamento) {
    const pool = destinosOrdenados.filter(d => d.flight?.price > 0);
    if (pool.length === 0) {
        return buildFallbackResult(destinosOrdenados.slice(0, 5), orcamento);
    }

    const selected = [];
    const usedNames = new Set();

    for (const d of pool) {
        if (selected.length >= 5) break;
        const key = `${(d.name || '').toLowerCase()}_${(d.country || '').toLowerCase()}`;
        if (usedNames.has(key)) continue;

        const countryCount = selected.filter(s => s.country === d.country).length;
        if (countryCount < 2) {
            selected.push(d);
            usedNames.add(key);
        }
    }

    if (selected.length < 5) {
        for (const d of pool) {
            if (selected.length >= 5) break;
            const key = `${(d.name || '').toLowerCase()}_${(d.country || '').toLowerCase()}`;
            if (!usedNames.has(key)) {
                selected.push(d);
                usedNames.add(key);
            }
        }
    }

    return buildFallbackResult(selected, orcamento);
}

function buildFallbackResult(selected, orcamento) {
    const wrap = (d, razao) => ({
        id: 0,
        name: d.name,
        primary_airport: d.primary_airport,
        country: d.country,
        coordinates: d.coordinates,
        image: d.image,
        flight: d.flight,
        avg_cost_per_night: d.avg_cost_per_night,
        outbound_date: d.outbound_date,
        return_date: d.return_date,
        _sources: d._sources,
        _source_count: d._source_count,
        _quality: d._quality || null,
        razao,
        comentario: '',
        dica: '',
        adequacao_epoca: '',
        ponto_negativo: '',
    });

    const totalDisponivel = selected.length;
    const poucosResultados = totalDisponivel < 5;

    return {
        top_destino: selected[0] ? wrap(selected[0], 'Melhor combinação de preço, escalas e duração entre as opções pesquisadas.') : null,
        alternativas: selected.slice(1, Math.min(4, totalDisponivel)).map(d => wrap(d, 'Outra opção com boa relação preço e logística.')),
        surpresa: (totalDisponivel >= 5 && selected[4]) ? wrap(selected[4], 'Um lugar diferente entre as opções pesquisadas!') : null,
        _model: 'fallback_quality',
        _totalAnalisados: totalDisponivel,
        _poucosResultados: poucosResultados,
    };
}
