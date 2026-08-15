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
import {
    INSTRUCOES_SAZONALIDADE,
    aplicarGuardaSazonal,
    TEXTO_SEM_FONTE,
} from './_lib/seasonal-claims.js';

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
        return res.status(200).json(rankByQuality(destinosQualidade, orcamento, perfilVoo));
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
            const aproveitamento = d._quality.aproveitamento != null
                ? `${Math.round(d._quality.aproveitamento * 100)}% do orçamento`
                : 'orçamento não informado';
            return `${i + 1}|${d.name}|${d.country}|${d.primary_airport}|${simboloMoeda}${passagem}|${aproveitamento}|${paradas}paradas|voo ${durTxt}|logística ${d._quality.score}|${fontes}fontes|${hotelTxt}${alertaTxt}`;
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
            ? `\nOBSERVAÇÕES PESSOAIS DO VIAJANTE (MUITO IMPORTANTE: leve em conta na seleção e nos comentários):
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
${cenario === 'abaixo' ? `- NOTA: Poucos destinos dentro do orçamento, valorize os disponíveis` : ''}
${restricoesFamilia}
${observacoesBloco}
DESTINOS PRÉ-FILTRADOS (todos DENTRO do orçamento; nada acima do teto chegou até aqui):
Formato: ID|Nome|País|Aeroporto|Passagem ida+volta|Quanto usa do orçamento|Paradas|Duração do voo|Logística (0-125, maior = melhor)|Fontes|Hotel/noite|Alertas
A lista já está ORDENADA assim: primeiro o quanto a passagem aproveita o orçamento, depois a logística. Um voo com escalas pode aparecer acima de um voo direto por usar melhor o orçamento — isso é intencional.
${listaCompacta}

TAREFA: Com base no PERFIL acima, escolha os melhores destinos:
1. MELHOR DESTINO - o que mais combina com o perfil + melhor custo-benefício
${numAlternativas > 0 ? `2. ${numAlternativas} ALTERNATIVA${numAlternativas > 1 ? 'S' : ''} variada${numAlternativas > 1 ? 's' : ''} (diferentes perfis/países)` : ''}
${temSurpresa ? `3. 1 SURPRESA (inesperado e interessante)` : ''}

CRITÉRIOS DE SELEÇÃO (em ordem de prioridade):
1. ORÇAMENTO PRIMEIRO: o viajante informou ${simboloMoeda} ${orcamento} como o que ACEITA GASTAR na passagem. A lista já vem ordenada por isso. Prefira destinos que aproveitam bem esse valor; uma opção com escalas que usa mais do orçamento PODE ser escolhida à frente de um voo direto bem mais barato.
   Se você escolher uma opção bem mais barata, ela precisa compensar em logística ou em match com o perfil, e a economia deve ser mencionada no "razao" ou no "comentario".
${(criancas > 0 || bebes > 0) ? `   EXCEÇÃO NÃO NEGOCIÁVEL (viagem com crianças/bebês): NÃO escolha como MELHOR DESTINO uma opção com 2 ou mais escalas quando existir opção de até 1 escala com logística igual ou maior. Aqui a logística vem antes do orçamento.` : ''}
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

${INSTRUCOES_SAZONALIDADE}

Preencha "adequacao_epoca" (1 a 2 frases sobre o destino nessas datas, seguindo as regras acima) e "ponto_negativo" (1 ponto de atenção honesto: escalas, chuva, alta temporada, deslocamento etc.) para CADA destino escolhido.

O "ponto_negativo" fala do DESTINO OU DA VIAGEM, nunca dos dados desta lista.
✗ Errado: "a oferta de hotéis não está especificada na lista", "não há alerta de voo", "faltam informações sobre o destino", "o preço não inclui bagagem porque não foi informado"
✓ Certo: "o voo de 7 horas cansa quem viaja sozinho", "em outubro a cidade fica cheia de turistas", "o aeroporto fica longe do centro"
Se não houver ponto de atenção relevante, devolva "ponto_negativo" como string vazia. Vazio é melhor que um comentário sobre a lista.

REGRAS:
✓ Use APENAS IDs da lista (1-${destinos.length})
✓ Escreva "comentario" e "dica" em português brasileiro
✓ NÃO comente a lista, os dados, o formato ou o que falta neles: o viajante não vê nada disso, só o card
✓ O "comentario" deve ser da Tripinha (cachorrinha mascote) falando DIRETAMENTE com o viajante, como amiga animada (ex: "Esse lugar é incrível! Você vai amar as praias de lá...")
✓ A "dica" também deve ter tom da Tripinha (ex: "Fica a dica da Tripinha: reserve o passeio X com antecedência!")
✓ Use no máximo 1 referência canina por destino para não saturar
✓ "razao" e "comentario" aparecem um embaixo do outro no card: não repita a mesma ideia nos dois. A "razao" diz POR QUE este destino foi escolhido para este viajante; o "comentario" descreve COMO é estar lá
✓ NÃO use emoji nos textos (o frontend já cuida disso)
✓ NÃO use travessão (—) nos textos: escreva com vírgula, ponto ou dois-pontos
${observacoes ? '✓ O viajante deixou OBSERVAÇÕES PESSOAIS: faça referência a elas nos comentários e dicas, mostrando que a Tripinha levou em conta o pedido específico dele' : ''}
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
            return res.status(200).json(rankByQuality(destinosQualidade, orcamento, perfilVoo));
        }

        // ============================================================
        // MAPEAR IDs → DADOS REAIS (na ordem enviada ao LLM)
        // ============================================================
        const mapDestino = (item) => {
            if (!item || typeof item.id !== 'number') return null;
            const idx = item.id - 1;
            if (idx < 0 || idx >= destinosQualidade.length) return null;
            const d = destinosQualidade[idx];
            const guardaEpoca = aplicarGuardaSazonal(item.adequacao_epoca, { verificado: false });
            if (guardaEpoca.descartada) {
                console.warn(`🚫 Sazonalidade descartada em ${d.name}: afirmação sem fonte ("${String(item.adequacao_epoca).slice(0, 90)}")`);
            }
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
                // Segunda camada, determinística: o prompt proíbe afirmar
                // fenômeno sazonal, mas prompt não é garantia. Frase que
                // afirme lagoas cheias, neve, floração ou clima garantido sem
                // fonte é DESCARTADA aqui, e o card fica sem comentário de
                // época em vez de exibir uma previsão que não sustentamos.
                adequacao_epoca: guardaEpoca.texto || '',
                adequacao_epoca_descartada: guardaEpoca.descartada,
                adequacao_epoca_substituta: guardaEpoca.descartada ? TEXTO_SEM_FONTE : '',
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
            return res.status(200).json(rankByQuality(destinosQualidade, orcamento, perfilVoo));
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
                console.warn(`⚖️ Top da IA (${resultado.top_destino.name}, ${resultado.top_destino.flight?.stops} escalas) viola restrição objetiva, promovendo ${substituto.name}`);
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
            return res.status(200).json(rankByQuality(ranquearPorQualidade(destinos, perfilVoo), orcamento, perfilVoo));
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
// FALLBACK: Ranking determinístico (sem LLM)
// Recebe a lista JÁ ordenada por ranquearPorQualidade().
//
// A ordenação passou a colocar o orçamento antes da logística, então a
// primeira posição pode ser um voo com 2+ escalas. No caminho com IA, a
// trava de família roda depois da escolha do modelo; aqui não havia
// escolha nenhuma para validar, e o topo saía direto de selected[0].
// Sem este guarda, uma família com crianças receberia como MELHOR
// DESTINO exatamente o que violaRestricaoObjetiva existe para impedir.
// ============================================================
export function rankByQuality(destinosOrdenados, orcamento, perfilVoo = {}) {
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

    // Trava de família: se o primeiro colocado tem 2+ escalas havendo
    // opção equivalente com no máximo 1, promove essa opção ao topo e
    // rebaixa a outra, sem tirá-la da lista.
    if (selected.length > 0 && violaRestricaoObjetiva(selected[0], pool, perfilVoo)) {
        const idx = selected.findIndex(d => !violaRestricaoObjetiva(d, pool, perfilVoo));
        if (idx > 0) {
            const [promovido] = selected.splice(idx, 1);
            selected.unshift(promovido);
        } else if (idx === -1) {
            const doPool = pool.find(d => !violaRestricaoObjetiva(d, pool, perfilVoo));
            if (doPool) selected.unshift(doPool);
        }
    }

    return buildFallbackResult(selected.slice(0, 5), orcamento);
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
