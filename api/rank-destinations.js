// api/rank-destinations.js - VERSÃO v4
// ★ Cenário-adaptativo: prompt muda conforme disponibilidade de destinos no orçamento
// ★ Validação HARD: destinos acima do orçamento são substituídos automaticamente
// ★ Fallback em cascata: Groq llama-3.3-70b → llama-3.1-8b → ranking por preço

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { destinos, preferencias, companhia, numPessoas, noites, orcamento, cenario } = req.body;

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
        const orcNum = parseFloat(orcamento) || 0;
        const faixa80 = orcNum * 0.80;
        const faixa60 = orcNum * 0.60;

        console.log(`🤖 Ranqueando ${destinos.length} destinos | Cenário: ${cenario} | ${companhia} | R$${orcamento}`);

        // ==============================================================
        // CLASSIFICAR DESTINOS POR FAIXA
        // ==============================================================
        const listaCompacta = destinos.map((d, i) => {
            const passagem = d.flight?.price || 0;
            const paradas = d.flight?.stops || 0;
            const fontes = d._source_count || 1;
            const hotel = d.avg_cost_per_night || 0;

            let faixa = '⚠️ACIMA';
            if (passagem <= 0) faixa = '?';
            else if (passagem <= faixa60) faixa = 'ECONÔMICO';
            else if (passagem <= faixa80) faixa = 'BOM';
            else if (passagem <= orcNum) faixa = '★IDEAL';

            return `${i + 1}|${d.name}|${d.country}|${d.primary_airport}|R$${passagem}|${paradas}par|${fontes}fontes|Hotel:R$${hotel}/n|${faixa}`;
        }).join('\n');

        // ==============================================================
        // INSTRUÇÃO CONTEXTUAL POR COMPANHIA
        // ==============================================================
        const instrucaoCompanhia = {
            'Viagem em família': 'FAMÍLIA: priorize segurança, infraestrutura, atividades para crianças, praias calmas, parques, facilidade de locomoção',
            'Viagem romântica (casal)': 'CASAL: priorize destinos românticos, gastronomia, cenários bonitos, charme, spas, experiências a dois',
            'Viagem com amigos': 'AMIGOS: priorize diversão, vida noturna, aventuras em grupo, festivais, esportes, experiências coletivas',
            'Viajando sozinho(a)': 'SOLO: priorize segurança, facilidade de locomoção, transporte público, experiências culturais',
        }[companhia] || '';

        // ==============================================================
        // INSTRUÇÃO CONTEXTUAL POR PREFERÊNCIA
        // ==============================================================
        const instrucaoPreferencia = {
            'Relaxamento, praias, descanso e natureza tranquila': 'RELAX: praias, resorts, spas, clima quente, ritmo tranquilo. Evite metrópoles.',
            'Aventura, trilhas, esportes radicais e natureza selvagem': 'AVENTURA: trilhas, cachoeiras, mergulho, montanhas, parques nacionais, ecoturismo.',
            'Cultura, museus, história, gastronomia e arquitetura': 'CULTURA: patrimônio histórico, museus, gastronomia, arquitetura, tradições vivas.',
            'Agito urbano, vida noturna, compras e experiências cosmopolitas': 'URBANO: metrópoles vibrantes, vida noturna, compras, restaurantes, cena cultural.',
        }[preferencias] || '';

        // ==============================================================
        // REGRA DE ORÇAMENTO ADAPTATIVA POR CENÁRIO
        // ==============================================================
        let regraOrcamento = '';

        if (cenario === 'ideal') {
            // Muitos destinos na faixa ideal — priorizá-los
            regraOrcamento = `═══ REGRA DE ORÇAMENTO ═══
★IDEAL (R$${Math.round(faixa80)}-R$${orcNum}): PRIORIZE — aproveita bem o orçamento
BOM (R$${Math.round(faixa60)}-R$${Math.round(faixa80)}): aceitável como alternativa
ECONÔMICO (abaixo de R$${Math.round(faixa60)}): só se for PERFEITO para o perfil
⚠️ACIMA (acima de R$${orcNum}): ❌ PROIBIDO — NÃO SELECIONE

→ Pelo menos 3 dos 5 destinos devem ser ★IDEAL
→ NUNCA selecione ⚠️ACIMA sob nenhuma circunstância`;

        } else if (cenario === 'bom') {
            // Poucos na faixa ideal, mas alguns na faixa 60-100%
            regraOrcamento = `═══ REGRA DE ORÇAMENTO (poucos destinos na faixa ideal) ═══
★IDEAL (R$${Math.round(faixa80)}-R$${orcNum}): PRIORIZE se houver
BOM (R$${Math.round(faixa60)}-R$${Math.round(faixa80)}): boa alternativa — use livremente
ECONÔMICO (abaixo de R$${Math.round(faixa60)}): use se combinar com o perfil
⚠️ACIMA (acima de R$${orcNum}): ❌ PROIBIDO — NÃO SELECIONE

→ Priorize destinos ATÉ R$${orcNum} (★IDEAL e BOM primeiro)
→ NUNCA selecione ⚠️ACIMA sob nenhuma circunstância`;

        } else if (cenario === 'abaixo') {
            // Maioria dos destinos está abaixo do orçamento ou fora
            regraOrcamento = `═══ REGRA DE ORÇAMENTO (destinos fora da faixa ideal) ═══
O orçamento é R$${orcNum}, mas há poucos destinos nessa faixa.
Selecione os destinos com MELHOR custo-benefício, priorizando:
1. Destinos ATÉ R$${orcNum} (qualquer faixa abaixo do orçamento)
2. Se precisar ir acima, escolha o MAIS PRÓXIMO do orçamento
⚠️ACIMA: EVITE ao máximo. Só use se não houver alternativa abaixo de R$${orcNum}

→ Prefira destinos mais BARATOS que aproveitam o dinheiro do viajante
→ O viajante quer o melhor destino POSSÍVEL, não necessariamente o mais caro`;
        }

        // ==============================================================
        // PROMPT PRINCIPAL
        // ==============================================================
        const prompt = `ESPECIALISTA EM TURISMO - Seleção personalizada de destinos

═══ PERFIL DO VIAJANTE ═══
• Companhia: ${companhia || 'Não informado'}
• Pessoas: ${numPessoas || 1}
• Busca: ${preferencias || 'Não informado'}
• Duração: ${noites || '?'} noites
• Orçamento passagens ida+volta/pessoa: R$${orcamento}

${regraOrcamento}

═══ CRITÉRIOS DE SELEÇÃO (ordem de prioridade) ═══
1. ORÇAMENTO (peso 40%): NUNCA ultrapasse R$${orcNum}. Destino acima do orçamento = ERRO.
${instrucaoPreferencia ? `2. MATCH COM PERFIL (peso 30%): ${instrucaoPreferencia}` : '2. MATCH COM PERFIL (peso 30%): diversifique experiências'}
${instrucaoCompanhia ? `   ${instrucaoCompanhia}` : ''}
3. CONFIABILIDADE (peso 15%): destinos com 2-3 fontes > destinos com 1 fonte
4. DIVERSIDADE (peso 15%): máximo 2 destinos do mesmo país

═══ ${destinos.length} DESTINOS DISPONÍVEIS ═══
ID|Nome|País|Aeroporto|Passagem|Paradas|Fontes|Hotel/noite|Faixa
${listaCompacta}

═══ RESPOSTA (APENAS JSON) ═══
Escolha 5 destinos:
1. MELHOR DESTINO - melhor combinação de perfil + orçamento
2. 3 ALTERNATIVAS - variedade de experiências e países
3. 1 SURPRESA - destino inesperado e encantador

{
  "top_destino": {"id": N, "razao": "frase explicando POR QUE combina com este viajante"},
  "alternativas": [{"id": N, "razao": "frase"}, {"id": N, "razao": "frase"}, {"id": N, "razao": "frase"}],
  "surpresa": {"id": N, "razao": "frase surpreendente"}
}

IMPORTANTE: IDs entre 1 e ${destinos.length}. Cada "razao" deve ser personalizada ao perfil.
⚠️ VERIFICAÇÃO FINAL: Antes de responder, confira que NENHUM destino selecionado tem faixa ⚠️ACIMA.`;

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
                                content: `Você é um especialista em turismo. Retorna APENAS JSON válido. Os IDs referem a destinos da lista. REGRA ABSOLUTA: NUNCA selecione destinos com passagem acima de R$${orcNum}. Priorize faixa ★IDEAL.`
                            },
                            { role: 'user', content: prompt }
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.3,
                        max_tokens: 2000,
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
                console.log(`✅ [Groq][${model}] Ranking gerado`);
                break;

            } catch (err) {
                console.error(`[Groq][${model}] Erro:`, err.message);
                continue;
            }
        }

        // ============================================================
        // FALLBACK se LLM falhou
        // ============================================================
        if (!ranking) {
            console.warn('⚠️ Todos os modelos falharam, usando fallback por preço');
            return res.status(200).json(rankByPrice(destinos, orcamento));
        }

        // ============================================================
        // HIDRATAR COM DADOS ORIGINAIS
        // ============================================================
        const classificarFaixa = (preco) => {
            if (!preco || preco <= 0) return 'desconhecido';
            if (preco > orcNum) return 'acima';
            if (preco >= faixa80) return 'ideal';
            if (preco >= faixa60) return 'bom';
            return 'economico';
        };

        const hydrateById = (item, label) => {
            if (!item || !item.id) throw new Error(`${label}: sem ID`);
            const idx = item.id - 1;
            if (idx < 0 || idx >= destinos.length) throw new Error(`${label}: ID ${item.id} fora do range`);

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
                _faixa_orcamento: classificarFaixa(original.flight?.price || 0),
                razao: item.razao || 'Selecionado pela Tripinha 🐶',
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

        // ============================================================
        // ★ VALIDAÇÃO HARD: Substituir destinos acima do orçamento
        // ============================================================
        const todos = [ranking.top_destino, ...ranking.alternativas, ranking.surpresa];
        const idsUsados = new Set(todos.map(d => d.id));

        // Pool de substitutos: destinos dentro do orçamento que não foram selecionados
        const substitutos = destinos
            .map((d, i) => ({ ...d, _idx: i + 1 }))
            .filter(d => (d.flight?.price || 0) > 0 && (d.flight?.price || 0) <= orcNum && !idsUsados.has(d._idx))
            .sort((a, b) => b.flight.price - a.flight.price); // mais caro primeiro (aproveitar orçamento)

        const substituir = (destino, label) => {
            const preco = destino.flight?.price || 0;
            if (preco <= orcNum) return destino; // OK, dentro do orçamento

            // Acima do orçamento — substituir
            if (substitutos.length === 0) {
                console.warn(`⚠️ ${label} acima do orçamento (R$${preco}) mas sem substitutos`);
                return destino; // Sem opção, manter
            }

            const sub = substitutos.shift(); // Pegar o melhor substituto
            console.log(`🔄 ${label}: ${destino.name}(R$${preco}) → ${sub.name}(R$${sub.flight.price})`);

            return {
                id: sub._idx,
                name: sub.name,
                primary_airport: sub.primary_airport,
                country: sub.country,
                coordinates: sub.coordinates,
                image: sub.image,
                flight: sub.flight,
                avg_cost_per_night: sub.avg_cost_per_night,
                outbound_date: sub.outbound_date,
                return_date: sub.return_date,
                _sources: sub._sources,
                _source_count: sub._source_count,
                _faixa_orcamento: classificarFaixa(sub.flight?.price || 0),
                razao: destino.razao, // manter a razão original
                _substituido: true,
            };
        };

        ranking.top_destino = substituir(ranking.top_destino, 'top_destino');
        ranking.alternativas = ranking.alternativas.map((alt, i) => substituir(alt, `alternativa_${i + 1}`));
        ranking.surpresa = substituir(ranking.surpresa, 'surpresa');

        // ============================================================
        // STATS E LOGS
        // ============================================================
        const todosFinais = [ranking.top_destino, ...ranking.alternativas, ranking.surpresa];
        const acima = todosFinais.filter(d => (d.flight?.price || 0) > orcNum);
        const substituidos = todosFinais.filter(d => d._substituido);

        ranking._model = usedModel;
        ranking._totalAnalisados = destinos.length;
        ranking._cenario = cenario;
        ranking._substituicoes = substituidos.length;
        ranking._faixas = {
            ideal: todosFinais.filter(d => d._faixa_orcamento === 'ideal').length,
            bom: todosFinais.filter(d => d._faixa_orcamento === 'bom').length,
            economico: todosFinais.filter(d => d._faixa_orcamento === 'economico').length,
            acima: acima.length,
        };

        console.log(`🏆 ${ranking.top_destino.name} (R$${ranking.top_destino.flight?.price}) [${ranking.top_destino._faixa_orcamento}]`);
        console.log(`📋 ${ranking.alternativas.map(a => `${a.name}(R$${a.flight?.price})[${a._faixa_orcamento}]`).join(', ')}`);
        console.log(`🎁 ${ranking.surpresa.name} (R$${ranking.surpresa.flight?.price}) [${ranking.surpresa._faixa_orcamento}]`);
        console.log(`💰 Faixas: ${ranking._faixas.ideal} ideal | ${ranking._faixas.bom} bom | ${ranking._faixas.economico} eco | ${acima.length} acima`);
        if (substituidos.length > 0) {
            console.log(`🔄 ${substituidos.length} destino(s) substituído(s) por estarem acima do orçamento`);
        }

        return res.status(200).json(ranking);

    } catch (erro) {
        console.error('❌ Erro ranking:', erro);
        return res.status(200).json(rankByPrice(destinos, orcamento));
    }
}

// ============================================================
// FALLBACK: Ranking por preço (sem LLM)
// ============================================================
function rankByPrice(destinos, orcamento) {
    const orcNum = parseFloat(orcamento) || 99999;
    const faixa80 = orcNum * 0.80;

    // SOMENTE destinos dentro do orçamento
    const comPreco = destinos.filter(d => d.flight?.price > 0 && d.flight.price <= orcNum);

    // Se nenhum dentro do orçamento, pegar os mais baratos
    const pool = comPreco.length > 0
        ? comPreco
        : destinos.filter(d => d.flight?.price > 0).sort((a, b) => a.flight.price - b.flight.price).slice(0, 10);

    if (pool.length === 0) {
        return buildFallbackResult(destinos.slice(0, 5), orcNum);
    }

    // Priorizar faixa ideal, depois bom, depois econômico
    const ideais = pool.filter(d => d.flight.price >= faixa80 && d.flight.price <= orcNum).sort((a, b) => b.flight.price - a.flight.price);
    const outros = pool.filter(d => d.flight.price < faixa80).sort((a, b) => b.flight.price - a.flight.price);
    const sorted = [...ideais, ...outros];

    // Diversificar países
    const selected = [];
    const usedCountries = new Map();

    for (const d of sorted) {
        if (selected.length >= 5) break;
        const count = usedCountries.get(d.country) || 0;
        if (count < 2) {
            selected.push(d);
            usedCountries.set(d.country, count + 1);
        }
    }

    // Preencher se faltou
    for (const d of sorted) {
        if (selected.length >= 5) break;
        if (!selected.includes(d)) selected.push(d);
    }

    return buildFallbackResult(selected, orcNum);
}

function buildFallbackResult(selected, orcamento) {
    const faixa80 = orcamento * 0.80;
    const faixa60 = orcamento * 0.60;

    const wrap = (d, razao) => {
        const preco = d?.flight?.price || 0;
        let faixa = 'desconhecido';
        if (preco > orcamento) faixa = 'acima';
        else if (preco >= faixa80) faixa = 'ideal';
        else if (preco >= faixa60) faixa = 'bom';
        else if (preco > 0) faixa = 'economico';

        return {
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
            _faixa_orcamento: faixa,
            razao,
        };
    };

    return {
        top_destino: selected[0] ? wrap(selected[0], 'Melhor opção encontrada para o seu orçamento! 🐶') : null,
        alternativas: selected.slice(1, 4).map(d => wrap(d, 'Boa opção dentro do orçamento')),
        surpresa: selected[4] ? wrap(selected[4], 'Uma descoberta diferente! 🎁') : (selected[0] ? wrap(selected[0], 'Opção disponível') : null),
        _model: 'fallback_price',
        _totalAnalisados: selected.length,
    };
}
