// api/rank-destinations.js - VERSÃO TRIPLE SEARCH v3.0
// Recebe destinos consolidados e ranqueia com LLM
// NOVO v3.0:
// - Recebe adultos/crianças/bebês separados → prompt adaptado para famílias
// - Preferências múltiplas → prompt combina estilos de viagem
// - Comentários ricos com contexto de datas/estação, dicas práticas
// Fallback: Groq llama-3.3-70b → llama-3.1-8b → ranking por preço

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { 
        destinos, preferencias, companhia, numPessoas, 
        adultos, criancas, bebes,
        noites, orcamento, moeda, dataIda, dataVolta 
    } = req.body;

    if (!destinos || !Array.isArray(destinos) || destinos.length === 0) {
        return res.status(400).json({
            error: 'Lista de destinos obrigatória',
            received: { destinos: destinos?.length, preferencias, orcamento }
        });
    }

    if (!process.env.GROQ_API_KEY) {
        console.warn('⚠️ GROQ_API_KEY não configurada, usando fallback por preço');
        return res.status(200).json(rankByPrice(destinos, orcamento));
    }

    try {
        console.log(`🤖 Ranqueando ${destinos.length} destinos | ${companhia} | ${preferencias} | ${moeda || 'BRL'} ${orcamento}`);
        if (criancas > 0 || bebes > 0) {
            console.log(`👨‍👩‍👧‍👦 Família: ${adultos} adultos, ${criancas} crianças, ${bebes} bebês`);
        }

        // ============================================================
        // DETECTAR ESTAÇÃO DO ANO
        // ============================================================
        const mesViagem = dataIda ? new Date(dataIda + 'T12:00:00').getMonth() + 1 : null;
        const estacaoInfo = mesViagem ? getSeasonContext(mesViagem) : '';

        // ============================================================
        // SÍMBOLO DA MOEDA
        // ============================================================
        const simboloMoeda = { 'BRL': 'R$', 'USD': 'US$', 'EUR': '€' }[moeda] || 'R$';
        const nomeMoeda = { 'BRL': 'reais', 'USD': 'dólares', 'EUR': 'euros' }[moeda] || 'reais';

        // ============================================================
        // FORMATO COMPACTO PARA O LLM
        // ============================================================
        const listaCompacta = destinos.map((d, i) => {
            const passagem = d.flight?.price || 0;
            const paradas = d.flight?.stops || 0;
            const fontes = d._source_count || 1;
            const hotel = d.avg_cost_per_night || 0;
            return `${i + 1}|${d.name}|${d.country}|${d.primary_airport}|${simboloMoeda}${passagem}|${paradas}paradas|${fontes}fontes|Hotel:${simboloMoeda}${hotel}/noite`;
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
${criancas > 0 ? '- CRIANÇAS: considere destinos com atividades interativas e parques' : ''}`;
        }

        // ============================================================
        // PROMPT ENRIQUECIDO
        // ============================================================
        const prompt = `ESPECIALISTA EM TURISMO - Seleção personalizada de destinos

PERFIL DO VIAJANTE:
- Companhia: ${companhia || 'Não informado'}
- Passageiros: ${passageirosInfo}
- O que busca: ${preferencias || 'Não informado'}
- Duração: ${noites || '?'} noites
- Orçamento PASSAGENS (ida+volta/adulto): ${simboloMoeda} ${orcamento}
- Moeda: ${nomeMoeda}
${dataIda ? `- Período: ${dataIda} a ${dataVolta || '?'}` : ''}
${estacaoInfo ? `- Contexto sazonal: ${estacaoInfo}` : ''}
${restricoesFamilia}

DESTINOS PRÉ-FILTRADOS (já dentro do orçamento):
Formato: ID|Nome|País|Aeroporto|Passagem ida+volta|Paradas|Fontes|Hotel/noite
${listaCompacta}

TAREFA: Com base no PERFIL, escolha os 5 que MAIS combinam com este viajante.

Para CADA destino selecionado, gere:
1. "razao": frase curta (1 linha) explicando POR QUE combina com este viajante
2. "comentario": texto de 2-3 frases descrevendo o destino considerando:
   - A estação do ano / clima esperado no período da viagem
   - Atividades e experiências alinhadas com "${preferencias}"
   - Adequação para ${companhia}${(criancas > 0 || bebes > 0) ? ' (com crianças/bebês!)' : ''}
   - Use tom amigável e entusiasmado (estilo guia de viagens descolado)
3. "dica": uma dica prática e útil para quem vai viajar para lá nesse período
   ${(criancas > 0 || bebes > 0) ? '(inclua dicas relevantes para viagem com crianças quando pertinente)' : ''}

ESTRUTURA DE SELEÇÃO:
1. MELHOR DESTINO - melhor match com perfil + custo-benefício
2. 3 ALTERNATIVAS - diversifique países e experiências
3. 1 SURPRESA - destino inesperado que encantaria este viajante

CRITÉRIOS (ordem de prioridade):
1. MATCH COM PERFIL: Combina com "${preferencias}"? Adequado para ${companhia}?
   - Família com crianças → segurança, infraestrutura, atividades para crianças, voos curtos
   - Família com bebês → infraestrutura de saúde, clima ameno, facilidade de acesso
   - Casal → romance, gastronomia, cenários bonitos
   - Amigos → diversão, vida noturna, aventuras em grupo
   - Sozinho → segurança, facilidade, experiências culturais
2. CLIMA NO PERÍODO: O destino é bom para visitar nessas datas?
3. FONTES: Destinos com 2-3 fontes são mais confiáveis
4. CUSTO TOTAL: passagem + hotel × ${noites || 7} noites
5. DIVERSIDADE: Não repita países
${(criancas > 0 || bebes > 0) ? '6. LOGÍSTICA FAMILIAR: Prefira voos diretos ou com menos paradas' : ''}

REGRAS:
✓ Use APENAS IDs da lista (1-${destinos.length})
✓ Escreva "comentario" e "dica" em português brasileiro
✓ Retorne APENAS JSON válido

JSON:
{
  "top_destino": {"id":1,"razao":"frase curta","comentario":"2-3 frases descritivas","dica":"dica prática"},
  "alternativas": [
    {"id":2,"razao":"frase","comentario":"descrição","dica":"dica"},
    {"id":3,"razao":"frase","comentario":"descrição","dica":"dica"},
    {"id":4,"razao":"frase","comentario":"descrição","dica":"dica"}
  ],
  "surpresa": {"id":5,"razao":"frase surpreendente","comentario":"descrição","dica":"dica"}
}`;

        // ============================================================
        // TENTAR MODELOS EM CASCATA
        // ============================================================
        const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        let ranking = null;
        let usedModel = null;

        for (const model of models) {
            try {
                const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                    },
                    body: JSON.stringify({
                        model,
                        messages: [
                            {
                                role: 'system',
                                content: 'Você é um especialista em turismo brasileiro. Retorna APENAS JSON válido em português do Brasil. Zero texto extra. IDs referem a destinos da lista fornecida. Seus comentários são entusiasmados mas informativos, como um guia de viagens descolado. Quando a viagem inclui crianças ou bebês, sempre considere segurança e praticidade nas recomendações.'
                            },
                            { role: 'user', content: prompt }
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.3,
                        max_tokens: 3000,
                    })
                });

                if (!groqResponse.ok) {
                    console.error(`[Groq][${model}] HTTP ${groqResponse.status}`);
                    continue;
                }

                const groqData = await groqResponse.json();
                const content = groqData.choices?.[0]?.message?.content;

                if (!content) {
                    console.error(`[Groq][${model}] Resposta vazia`);
                    continue;
                }

                ranking = JSON.parse(content);
                usedModel = model;
                console.log(`✅ [Groq][${model}] Ranking gerado com sucesso`);
                break;

            } catch (err) {
                console.error(`[Groq][${model}] Erro:`, err.message);
                continue;
            }
        }

        // ============================================================
        // FALLBACK: ranking por preço se LLM falhou
        // ============================================================
        if (!ranking) {
            console.warn('⚠️ Todos os modelos falharam, usando fallback por preço');
            return res.status(200).json(rankByPrice(destinos, orcamento));
        }

        // ============================================================
        // VALIDAR E HIDRATAR COM DADOS ORIGINAIS
        // ============================================================
        const hydrateById = (item, label) => {
            if (!item || !item.id) throw new Error(`${label}: sem ID`);

            const idx = item.id - 1;
            if (idx < 0 || idx >= destinos.length) {
                throw new Error(`${label}: ID ${item.id} fora do range (máx: ${destinos.length})`);
            }

            const original = destinos[idx];
            return {
                id: item.id,
                name: original.name,
                primary_airport: original.primary_airport,
                country: original.country,
                coordinates: original.coordinates,
                image: original.image,
                flight: original.flight,
                avg_cost_per_night: original.avg_cost_per_night,
                outbound_date: original.outbound_date,
                return_date: original.return_date,
                _sources: original._sources,
                _source_count: original._source_count,
                razao: item.razao || 'Selecionado pela Tripinha 🐶',
                comentario: item.comentario || '',
                dica: item.dica || '',
            };
        };

        try {
            ranking.top_destino = hydrateById(ranking.top_destino, 'top_destino');
            ranking.surpresa = hydrateById(ranking.surpresa, 'surpresa');

            if (!Array.isArray(ranking.alternativas) || ranking.alternativas.length < 3) {
                throw new Error('Mínimo 3 alternativas');
            }
            ranking.alternativas = ranking.alternativas.slice(0, 3).map((alt, i) =>
                hydrateById(alt, `alternativa ${i + 1}`)
            );
        } catch (validationError) {
            console.error('❌ Validação falhou:', validationError.message);
            return res.status(200).json(rankByPrice(destinos, orcamento));
        }

        ranking._model = usedModel;
        ranking._totalAnalisados = destinos.length;

        console.log(`🏆 ${ranking.top_destino.name} (${simboloMoeda}${ranking.top_destino.flight?.price}) [${ranking.top_destino._source_count} fontes]`);
        console.log(`📋 ${ranking.alternativas.map(a => `${a.name}(${simboloMoeda}${a.flight?.price})`).join(', ')}`);
        console.log(`🎁 ${ranking.surpresa.name} (${simboloMoeda}${ranking.surpresa.flight?.price})`);

        return res.status(200).json(ranking);

    } catch (erro) {
        console.error('❌ Erro ranking:', erro);
        return res.status(200).json(rankByPrice(destinos, orcamento));
    }
}

// ============================================================
// CONTEXTO SAZONAL
// ============================================================
function getSeasonContext(mes) {
    const info = {
        1:  'Janeiro: verão no hemisfério sul (praias lotadas, férias escolares), inverno rigoroso no hemisfério norte (neve, esportes de inverno)',
        2:  'Fevereiro: verão/carnaval no hemisfério sul, inverno no hemisfério norte (ainda frio, bom para neve)',
        3:  'Março: final do verão no sul (menos turistas, bom preço), início da primavera no norte (temperaturas amenas)',
        4:  'Abril: outono no hemisfério sul (clima agradável), primavera no norte (floração, eventos culturais)',
        5:  'Maio: outono no sul (temperaturas caindo), primavera plena no norte (excelente para turismo)',
        6:  'Junho: início do inverno no sul (festas juninas), início do verão no norte (dias longos, festivais)',
        7:  'Julho: inverno/férias escolares no sul, auge do verão no norte (alta temporada, praias)',
        8:  'Agosto: inverno no sul (seco em muitas regiões), verão no norte (calor, festivais)',
        9:  'Setembro: início da primavera no sul (flores, temperaturas subindo), início do outono no norte (folhagem)',
        10: 'Outubro: primavera no sul (bom clima), outono no norte (folhagem colorida, Oktoberfest)',
        11: 'Novembro: primavera/pré-verão no sul, outono tardio no norte (pré-inverno, Black Friday)',
        12: 'Dezembro: verão/festas no sul (alta temporada), inverno no norte (natal, mercados natalinos, neve)',
    };
    return info[mes] || '';
}

// ============================================================
// FALLBACK: Ranking simples por preço (sem LLM)
// ============================================================
function rankByPrice(destinos, orcamento) {
    const comPreco = destinos.filter(d => d.flight?.price > 0);

    if (comPreco.length === 0) {
        const top5 = destinos.slice(0, 5);
        return buildFallbackResult(top5, orcamento);
    }

    const dentroOrcamento = comPreco.filter(d => d.flight.price <= orcamento);
    const pool = dentroOrcamento.length >= 5 ? dentroOrcamento : comPreco;

    pool.sort((a, b) => a.flight.price - b.flight.price);

    const selected = [];
    const usedCountries = new Set();

    for (const d of pool) {
        if (selected.length >= 5) break;
        const countryCount = selected.filter(s => s.country === d.country).length;
        if (countryCount < 2) {
            selected.push(d);
            usedCountries.add(d.country);
        }
    }

    if (selected.length < 5) {
        for (const d of pool) {
            if (selected.length >= 5) break;
            if (!selected.includes(d)) selected.push(d);
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
        razao,
        comentario: '',
        dica: '',
    });

    return {
        top_destino: selected[0] ? wrap(selected[0], 'Melhor preço encontrado! 🐶') : null,
        alternativas: selected.slice(1, 4).map(d => wrap(d, 'Boa opção de preço')),
        surpresa: selected[4] ? wrap(selected[4], 'Uma opção diferente para explorar! 🎁') : (selected[0] ? wrap(selected[0], 'Única opção disponível') : null),
        _model: 'fallback_price',
        _totalAnalisados: selected.length,
    };
}

