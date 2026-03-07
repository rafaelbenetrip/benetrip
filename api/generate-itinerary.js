// api/generate-itinerary.js - GERADOR DE ROTEIRO v2.0
// Gera roteiro dia a dia personalizado via Groq LLM
// v2.0: MULTI-DESTINO + clima previsto + contagem de dias por destino
// v1.1: Campo de observações do usuário + Google Maps URLs curtas
// Fallback: Groq llama-3.3-70b → llama-3.1-8b → roteiro genérico

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
        // NOVO v2.0: array de destinos (multi-cidade)
        destinos,
        // LEGADO: campos únicos mantidos para compatibilidade
        destino,
        dataIda,
        dataVolta,
        horarioChegada,
        horarioPartida,
        // Comum
        companhia,
        adultos,
        criancas,
        bebes,
        numPessoas,
        preferencias,
        intensidade,
        orcamentoAtividades,
        observacoes,
    } = req.body;

    // ============================================================
    // NORMALIZAR: converter formato legado para multi-destino
    // ============================================================
    let destinosArray = [];

    if (destinos && Array.isArray(destinos) && destinos.length > 0) {
        // v2.0: já veio como array de destinos
        destinosArray = destinos;
    } else if (destino && dataIda && dataVolta) {
        // Legado: converter para array de 1 destino
        destinosArray = [{
            destino: destino,
            dataChegada: dataIda,
            dataSaida: dataVolta,
            horarioChegada: horarioChegada || '',
            horarioPartida: horarioPartida || ''
        }];
    }

    // ============================================================
    // VALIDAÇÃO
    // ============================================================
    if (destinosArray.length === 0) {
        return res.status(400).json({
            error: 'Informe ao menos um destino com datas',
            received: { destinos, destino, dataIda, dataVolta }
        });
    }

    for (let i = 0; i < destinosArray.length; i++) {
        const d = destinosArray[i];
        if (!d.destino || !d.dataChegada || !d.dataSaida) {
            return res.status(400).json({
                error: `Destino ${i + 1} incompleto: necessário destino, dataChegada e dataSaida`,
                received: d
            });
        }
    }

    if (!process.env.GROQ_API_KEY) {
        console.warn('⚠️ GROQ_API_KEY não configurada, retornando fallback');
        return res.status(200).json(buildFallbackItinerary(req.body, destinosArray));
    }

    try {
        // ============================================================
        // CALCULAR DIAS TOTAIS E POR DESTINO
        // ============================================================
        const primeiraChegada = new Date(destinosArray[0].dataChegada + 'T12:00:00');
        const ultimaSaida = new Date(destinosArray[destinosArray.length - 1].dataSaida + 'T12:00:00');
        const numDiasTotal = Math.ceil((ultimaSaida - primeiraChegada) / (1000 * 60 * 60 * 24)) + 1;

        const isMultiDestino = destinosArray.length > 1;

        console.log(`🗺️ Gerando roteiro: ${destinosArray.map(d => d.destino).join(' → ')} | ${numDiasTotal} dias | ${companhia} | ${preferencias}`);
        if (observacoes) {
            console.log(`📝 Observações do usuário: ${observacoes}`);
        }

        // ============================================================
        // MONTAR INFORMAÇÕES DE CADA DESTINO COM DIAS REAIS
        // ============================================================
        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        let diaGlobalCounter = 1;
        const destinosInfo = [];

        for (let idx = 0; idx < destinosArray.length; idx++) {
            const dest = destinosArray[idx];
            const chegada = new Date(dest.dataChegada + 'T12:00:00');
            const saida = new Date(dest.dataSaida + 'T12:00:00');
            const numDias = Math.ceil((saida - chegada) / (1000 * 60 * 60 * 24)) + 1;
            const mesViagem = chegada.getMonth() + 1;

            const dias = [];
            for (let i = 0; i < numDias; i++) {
                const data = new Date(chegada);
                data.setDate(data.getDate() + i);
                dias.push({
                    numeroGlobal: diaGlobalCounter++,
                    numeroLocal: i + 1,
                    diaSemana: diasSemana[data.getDay()],
                    dataFormatada: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                    dataISO: formatDateISO(data),
                    ehPrimeiro: i === 0,
                    ehUltimo: i === numDias - 1
                });
            }

            destinosInfo.push({
                index: idx + 1,
                destino: dest.destino,
                dataChegada: dest.dataChegada,
                dataSaida: dest.dataSaida,
                horarioChegada: dest.horarioChegada || '',
                horarioPartida: dest.horarioPartida || '',
                numDias,
                mes: mesViagem,
                estacao: getSeasonContext(mesViagem),
                clima: getClimateHint(dest.destino, mesViagem),
                dias,
                ehPrimeiroDestino: idx === 0,
                ehUltimoDestino: idx === destinosArray.length - 1,
                proximoDestino: idx < destinosArray.length - 1 ? destinosArray[idx + 1].destino : null
            });
        }

        // ============================================================
        // CONTEXTO DE PASSAGEIROS
        // ============================================================
        let passageirosInfo = `${numPessoas || 1} pessoa(s)`;
        let restricoesFamilia = '';

        if ((criancas || 0) > 0 || (bebes || 0) > 0) {
            const parts = [`${adultos || 1} adulto(s)`];
            if (criancas > 0) parts.push(`${criancas} criança(s) de 2-11 anos`);
            if (bebes > 0) parts.push(`${bebes} bebê(s) de 0-1 ano`);
            passageirosInfo = parts.join(', ');

            restricoesFamilia = `
ATENÇÃO - VIAGEM COM CRIANÇAS/BEBÊS:
- Sugerir atividades adequadas para crianças e que divirtam toda a família
- Incluir pausas e intervalos no roteiro (crianças cansam rápido)
- Evitar atividades que exijam longas caminhadas sem descanso
- Considerar horários de refeição e descanso das crianças
${bebes > 0 ? '- BEBÊ(S): incluir tempo extra para logística, evitar atividades muito longas seguidas' : ''}`;
        }

        // ============================================================
        // MAPEAR INTENSIDADE
        // ============================================================
        const intensidadeDesc = {
            'leve': 'Ritmo leve e relaxado. Poucas atividades por dia (2-3), com bastante tempo livre para descansar e explorar sem pressa.',
            'moderado': 'Ritmo moderado e equilibrado. Atividades pela manhã e tarde (3-4 por dia), com intervalos confortáveis.',
            'intenso': 'Ritmo intenso, aproveitar cada minuto. Muitas atividades por dia (5-6), agenda bem preenchida para não perder nada.'
        }[intensidade] || 'Ritmo moderado e equilibrado.';

        // ============================================================
        // MAPEAR ORÇAMENTO ATIVIDADES
        // ============================================================
        const orcamentoDesc = {
            'economico': 'ECONÔMICO: priorizar atividades gratuitas ou muito baratas. Parques, mirantes, praias, caminhadas, mercados públicos, free walking tours.',
            'medio': 'MÉDIO: mistura de atividades gratuitas e pagas moderadas. Museus, passeios de barco, tours guiados acessíveis.',
            'alto': 'ALTO: incluir experiências premium sem restrição. Restaurantes renomados, passeios exclusivos, spas, tours VIP.'
        }[orcamentoAtividades] || 'MÉDIO: mistura de atividades gratuitas e pagas.';

        // ============================================================
        // GERAR LISTA DE DIAS COMPLETA PARA O PROMPT
        // ============================================================
        let diasListaTexto = '';
        destinosInfo.forEach(dest => {
            diasListaTexto += `\n📍 ${dest.destino} (${dest.numDias} dia${dest.numDias > 1 ? 's' : ''}):\n`;
            if (dest.estacao) diasListaTexto += `   Estação: ${dest.estacao}\n`;
            if (dest.clima) diasListaTexto += `   Clima esperado: ${dest.clima}\n`;
            dest.dias.forEach(d => {
                let nota = '';
                if (d.ehPrimeiro && dest.horarioChegada) nota = ` (CHEGADA às ${dest.horarioChegada}${!dest.ehPrimeiroDestino ? ' — vindo de ' + destinosArray[dest.index - 2].destino : ''})`;
                if (d.ehUltimo && dest.horarioPartida) nota = ` (PARTIDA às ${dest.horarioPartida}${dest.proximoDestino ? ' — rumo a ' + dest.proximoDestino : ''})`;
                diasListaTexto += `   Dia ${d.numeroGlobal}: ${d.diaSemana}, ${d.dataFormatada}${nota}\n`;
            });
        });

        // ============================================================
        // BLOCO MULTI-DESTINO PARA O PROMPT
        // ============================================================
        let multiDestinoBloco = '';
        let multiDestinoRegras = '';

        if (isMultiDestino) {
            const rotaResumo = destinosArray.map(d => d.destino).join(' → ');
            multiDestinoBloco = `
═══════════════════════════════════════════
VIAGEM MULTI-DESTINO: ${rotaResumo}
Total: ${destinosArray.length} cidades em ${numDiasTotal} dias
═══════════════════════════════════════════`;

            multiDestinoRegras = `
REGRAS ESPECIAIS PARA VIAGEM MULTI-DESTINO:
- O roteiro deve cobrir TODOS os destinos na ordem listada
- No dia de transição entre cidades (último dia em uma cidade / primeiro na próxima), considere:
  * O viajante precisa fazer check-out, se deslocar (voo/ônibus/carro) e fazer check-in
  * Planeje atividades mais leves nos dias de transição
  * Mencione na dica da Tripinha que é dia de troca de cidade
- Cada destino deve ter seu bloco de dias claramente identificado
- O campo "destino_atual" em cada dia indica em qual cidade o viajante está
- Adapte as sugestões ao CLIMA e ESTAÇÃO específicos de cada destino (podem ser diferentes!)
- Se um destino tem poucos dias (1-2), priorize os destaques imperdíveis daquele lugar`;
        }

        // ============================================================
        // BLOCO DE CLIMA E ESTAÇÃO
        // ============================================================
        let climaBloco = '\nCONTEXTO CLIMÁTICO POR DESTINO:';
        destinosInfo.forEach(dest => {
            climaBloco += `\n- ${dest.destino}: ${dest.estacao || 'Estação não determinada'}`;
            if (dest.clima) climaBloco += ` | ${dest.clima}`;
            climaBloco += ` | ${dest.numDias} dia(s)`;
        });
        climaBloco += `\n\nINSTRUÇÃO SOBRE CLIMA: Para cada dia, considere o clima esperado do destino naquela época do ano. Sugira atividades adequadas ao clima (ex: se chove muito, tenha plano B indoor; se faz muito calor, evite atividades ao ar livre no pico do sol de 12h-15h). Nas dicas da Tripinha, mencione o clima quando relevante (ex: "Leve protetor solar, faz bastante sol nessa época!" ou "Pode chover à tarde, leve um guarda-chuva na mochila!").`;

        // ============================================================
        // BLOCO DE OBSERVAÇÕES DO USUÁRIO
        // ============================================================
        let observacoesBloco = '';
        let observacoesInstrucao = '';

        if (observacoes && observacoes.trim()) {
            observacoesBloco = `
═══════════════════════════════════════════
PEDIDOS ESPECIAIS DO VIAJANTE (PRIORIDADE ALTA):
"${observacoes.trim()}"
═══════════════════════════════════════════
INSTRUÇÃO: O viajante fez pedidos especiais acima. Você DEVE:
1. Levar em conta TODAS as preferências, restrições e pedidos descritos acima ao montar o roteiro
2. Se o viajante pediu para INCLUIR algo, garanta que isso apareça no roteiro
3. Se o viajante pediu para EXCLUIR algo, NÃO inclua isso de forma alguma
4. Nas "dica_tripinha" de atividades relevantes, faça referências naturais aos pedidos
5. No "resumo_viagem", mencione brevemente que os pedidos especiais foram considerados
6. NÃO copie o texto do viajante literalmente — absorva as informações e demonstre que entendeu adaptando o roteiro`;

            observacoesInstrucao = '\n15. O viajante fez PEDIDOS ESPECIAIS — leia a seção correspondente e garanta que cada solicitação foi atendida no roteiro.';
        }

        // ============================================================
        // ESTRUTURA JSON ESPERADA (v2.0 com destino_atual)
        // ============================================================
        const estruturaJSON = `{
  "resumo_viagem": "Frase curta e animada da Tripinha resumindo a vibe da viagem${isMultiDestino ? ' multi-destino' : ''}${observacoes ? ' (mencione que os pedidos especiais foram considerados)' : ''}",
  "destinos_rota": ["${destinosArray.map(d => d.destino).join('", "')}"],
  "dias": [
    {
      "dia_numero": 1,
      "dia_semana": "Quarta-feira",
      "data": "10/07",
      "destino_atual": "Nome da cidade onde o viajante está neste dia",
      "titulo": "Título curto e criativo para o dia",
      "resumo_tripinha": "Frase da Tripinha descrevendo o dia (2-3 frases, descontraída). Mencione clima se relevante.",
      "clima_previsto": "Ex: Ensolarado, ~28°C",
      "eh_dia_transicao": false,
      "periodos": [
        {
          "periodo": "manhã|tarde|noite",
          "atividades": [
            {
              "nome": "Nome do local ou atividade",
              "descricao": "Descrição curta da atividade (1-2 frases)",
              "dica_tripinha": "Dica prática da Tripinha sobre esse local",
              "duracao_minutos": 90,
              "google_maps_query": "Nome do Local, Cidade, País",
              "gratuito": true,
              "tags": ["Imperdível", "Ideal para família"]
            }
          ]
        }
      ]
    }
  ]
}`;

        // ============================================================
        // PROMPT PRINCIPAL v2.0
        // ============================================================
        const destinoPrincipal = isMultiDestino
            ? destinosArray.map(d => d.destino).join(' → ')
            : destinosArray[0].destino;

        const prompt = `ESPECIALISTA EM ROTEIROS DE VIAGEM - Planejamento dia a dia personalizado
${multiDestinoBloco}

${isMultiDestino ? 'ROTA' : 'DESTINO'}: ${destinoPrincipal}
PERÍODO TOTAL: ${destinosArray[0].dataChegada} a ${destinosArray[destinosArray.length - 1].dataSaida} (${numDiasTotal} dias)
${climaBloco}
${observacoesBloco}

DIAS DA VIAGEM:
${diasListaTexto}

PERFIL DO VIAJANTE:
- Companhia: ${companhia || 'Não informado'}
- Passageiros: ${passageirosInfo}
- Experiências buscadas: ${preferencias || 'Variadas'}
- Ritmo: ${intensidadeDesc}
- Orçamento atividades: ${orcamentoDesc}
${restricoesFamilia}
${multiDestinoRegras}

TAREFA: Gere um roteiro COMPLETO de ${numDiasTotal} dias${isMultiDestino ? ` cobrindo ${destinosArray.length} destinos na ordem listada` : ` para ${destinosArray[0].destino}`}, cobrindo TODOS os dias listados acima.

REGRAS IMPORTANTES:
1. Cada dia de chegada em um destino deve considerar o horário de chegada informado — comece com atividades leves de ambientação
2. Cada dia de partida de um destino deve considerar o horário de partida — o viajante precisa de tempo para ir ao aeroporto/rodoviária
3. Cada dia DEVE ter atividades distribuídas por períodos (manhã, tarde, noite) conforme o ritmo escolhido
4. "google_maps_query" deve ser o NOME REAL DO LOCAL + Cidade + País para funcionar no Google Maps
5. "tags" podem ser: "Imperdível", "Ideal para família", "Histórico", "Gastronômico", "Compras", "Relaxante", "Aventura", "Cultural", "Gratuito", "Vida noturna", "Natureza", "Romântico"
6. "gratuito" deve ser true se a atividade é gratuita ou false se normalmente é paga
7. Escreva TODOS os textos em português brasileiro
8. Tom dos textos: Tripinha é uma cachorra vira-lata caramelo, fala em 1ª pessoa, descontraída, calorosa, amiga do viajante. Pode usar referência canina sutil mas SEM exagerar — no máximo 1 por dia.
9. NÃO use emoji nos textos (o frontend adiciona)
10. "duracao_minutos" é o tempo estimado naquela atividade (mínimo 30, máximo 240)
11. Priorize LOCAIS REAIS e POPULARES que existem de fato no destino
12. Evite repetir locais entre dias diferentes
13. "destino_atual" deve indicar EXATAMENTE em qual cidade o viajante está naquele dia
14. "clima_previsto" deve ser uma estimativa realista do clima para aquele destino naquela época do ano. Considere estação, latitude, altitude e padrões típicos. Adapte as sugestões ao clima.${observacoesInstrucao}

Retorne APENAS o JSON válido, sem texto extra.

ESTRUTURA JSON:
${estruturaJSON}`;

        // ============================================================
        // TENTAR MODELOS EM CASCATA
        // ============================================================
        const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        let resultado = null;
        let usedModel = null;

        for (const model of models) {
            try {
                console.log(`🤖 Tentando modelo: ${model}`);
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
                                content: `Você é a Tripinha, uma cachorra vira-lata caramelo brasileira especialista em viagens. Crie roteiros detalhados e personalizados. Retorne APENAS JSON válido em português do Brasil. Zero texto extra fora do JSON. Todos os locais devem ser REAIS e existir de fato no destino. O campo google_maps_query deve conter o nome real do local para funcionar no Google Maps. IMPORTANTE: para cada dia inclua "destino_atual" (cidade atual) e "clima_previsto" (estimativa realista do clima para o destino naquela época).${observacoes ? ' O viajante fez pedidos especiais — demonstre nas suas dicas que você levou tudo em conta.' : ''}${isMultiDestino ? ' Esta é uma viagem MULTI-DESTINO — cubra todos os destinos na ordem correta, com dias de transição realistas.' : ''}`
                            },
                            { role: 'user', content: prompt }
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.5,
                        max_tokens: 8000,
                    })
                });

                if (!groqResponse.ok) {
                    const errText = await groqResponse.text();
                    console.error(`[Groq][${model}] HTTP ${groqResponse.status}: ${errText}`);
                    continue;
                }

                const groqData = await groqResponse.json();
                const content = groqData.choices?.[0]?.message?.content;

                if (!content) {
                    console.error(`[Groq][${model}] Resposta vazia`);
                    continue;
                }

                resultado = JSON.parse(content);
                usedModel = model;
                console.log(`✅ [Groq][${model}] Roteiro gerado com sucesso`);
                break;

            } catch (err) {
                console.error(`[Groq][${model}] Erro:`, err.message);
                continue;
            }
        }

        // ============================================================
        // FALLBACK se LLM falhou
        // ============================================================
        if (!resultado) {
            console.warn('⚠️ Todos os modelos falharam, usando fallback');
            return res.status(200).json(buildFallbackItinerary(req.body, destinosArray));
        }

        // ============================================================
        // VALIDAÇÃO E ENRIQUECIMENTO
        // ============================================================
        if (!resultado.dias || !Array.isArray(resultado.dias)) {
            console.error('❌ Resposta sem array de dias');
            return res.status(200).json(buildFallbackItinerary(req.body, destinosArray));
        }

        // Garantir Google Maps links para cada atividade
        resultado.dias.forEach(dia => {
            if (dia.periodos && Array.isArray(dia.periodos)) {
                dia.periodos.forEach(periodo => {
                    if (periodo.atividades && Array.isArray(periodo.atividades)) {
                        periodo.atividades.forEach(ativ => {
                            if (ativ.google_maps_query) {
                                ativ.google_maps_url = `https://maps.google.com/?q=${encodeURIComponent(ativ.google_maps_query)}`;
                            }
                        });
                    }
                });
            }
        });

        resultado._model = usedModel;
        resultado._numDias = numDiasTotal;
        resultado._destino = destinoPrincipal;
        resultado._destinos = destinosArray.map(d => d.destino);
        resultado._isMultiDestino = isMultiDestino;
        resultado._geradoEm = new Date().toISOString();
        resultado._observacoesUsadas = !!(observacoes && observacoes.trim());

        console.log(`🗺️ Roteiro completo: ${resultado.dias.length} dias para ${destinoPrincipal}`);

        return res.status(200).json(resultado);

    } catch (erro) {
        console.error('❌ Erro geral:', erro);
        return res.status(200).json(buildFallbackItinerary(req.body, destinosArray));
    }
}

// ============================================================
// HELPER: formatar data ISO
// ============================================================
function formatDateISO(date) {
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// ============================================================
// CONTEXTO SAZONAL
// ============================================================
function getSeasonContext(mes) {
    const info = {
        1:  'Janeiro: verão no hemisfério sul, inverno no hemisfério norte',
        2:  'Fevereiro: verão/carnaval no hemisfério sul, inverno no hemisfério norte',
        3:  'Março: final do verão no sul, início da primavera no norte',
        4:  'Abril: outono no hemisfério sul, primavera no norte',
        5:  'Maio: outono no sul, primavera plena no norte',
        6:  'Junho: início do inverno no sul, início do verão no norte',
        7:  'Julho: inverno no sul, auge do verão no norte',
        8:  'Agosto: inverno no sul, verão no norte',
        9:  'Setembro: início da primavera no sul, início do outono no norte',
        10: 'Outubro: primavera no sul, outono no norte',
        11: 'Novembro: primavera/pré-verão no sul, outono tardio no norte',
        12: 'Dezembro: verão/festas no sul, inverno no norte',
    };
    return info[mes] || '';
}

// ============================================================
// DICAS DE CLIMA POR DESTINO (heurística baseada em padrões)
// ============================================================
function getClimateHint(destino, mes) {
    // Dica genérica baseada no mês — a LLM vai refinar com base no destino real
    const lower = (destino || '').toLowerCase();

    // Destinos tropicais
    const tropicais = ['rio', 'salvador', 'recife', 'fortaleza', 'natal', 'cancún', 'cancun', 'cartagena', 'bangkok', 'bali', 'phuket', 'havana', 'miami'];
    if (tropicais.some(t => lower.includes(t))) {
        if ([12, 1, 2, 3].includes(mes)) return 'Quente e úmido, possibilidade de chuvas tropicais. Temperaturas entre 28-35°C.';
        if ([6, 7, 8].includes(mes)) return 'Temperatura agradável entre 22-30°C, menos chuvas.';
        return 'Clima quente, entre 25-33°C. Possibilidade de chuvas rápidas.';
    }

    // Europa
    const europa = ['lisboa', 'porto', 'madrid', 'barcelona', 'paris', 'roma', 'londres', 'amsterdam', 'berlim', 'praga', 'viena', 'atenas', 'milão'];
    if (europa.some(t => lower.includes(t))) {
        if ([6, 7, 8].includes(mes)) return 'Verão europeu: quente e ensolarado, 25-35°C. Dias longos.';
        if ([12, 1, 2].includes(mes)) return 'Inverno europeu: frio, 0-10°C. Dias curtos, possibilidade de neve em algumas cidades.';
        if ([3, 4, 5].includes(mes)) return 'Primavera europeia: temperaturas amenas 12-22°C, possibilidade de chuva.';
        return 'Outono europeu: temperaturas amenas 8-18°C, folhagem colorida, possibilidade de chuva.';
    }

    // Patagônia / Sul
    const frio = ['bariloche', 'ushuaia', 'patagônia', 'patagonia', 'torres del paine'];
    if (frio.some(t => lower.includes(t))) {
        if ([12, 1, 2].includes(mes)) return 'Verão patagônico: ameno, 10-20°C. Dias longos, vento forte.';
        if ([6, 7, 8].includes(mes)) return 'Inverno patagônico: muito frio, -5 a 5°C. Neve, dias curtos.';
        return 'Clima frio e ventoso, 5-15°C. Leve roupas em camadas.';
    }

    // Fallback genérico
    return '';
}

// ============================================================
// FALLBACK: Roteiro genérico sem LLM (v2.0 multi-destino)
// ============================================================
function buildFallbackItinerary(params, destinosArray) {
    const { observacoes } = params;
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

    const dias = [];
    let diaGlobal = 1;

    for (const dest of destinosArray) {
        const chegada = new Date(dest.dataChegada + 'T12:00:00');
        const saida = new Date(dest.dataSaida + 'T12:00:00');
        const numDias = Math.ceil((saida - chegada) / (1000 * 60 * 60 * 24)) + 1;

        for (let i = 0; i < numDias; i++) {
            const data = new Date(chegada);
            data.setDate(data.getDate() + i);

            const ehPrimeiro = i === 0;
            const ehUltimo = i === numDias - 1;

            let titulo = `Dia ${diaGlobal} em ${dest.destino}`;
            let resumo = `Explore ${dest.destino} no seu ritmo!`;

            if (ehPrimeiro) {
                titulo = `Chegada em ${dest.destino}`;
                resumo = `Bem-vindo a ${dest.destino}! Hora de se ambientar.`;
            } else if (ehUltimo) {
                titulo = `Último dia em ${dest.destino}`;
                resumo = `Aproveite os últimos momentos em ${dest.destino}!`;
            }

            dias.push({
                dia_numero: diaGlobal,
                dia_semana: diasSemana[data.getDay()],
                data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                destino_atual: dest.destino,
                titulo,
                resumo_tripinha: resumo,
                clima_previsto: '',
                eh_dia_transicao: false,
                periodos: [
                    {
                        periodo: ehPrimeiro && dest.horarioChegada && parseInt(dest.horarioChegada) >= 14 ? 'tarde' : 'manhã',
                        atividades: [
                            {
                                nome: `Explorar o centro de ${dest.destino}`,
                                descricao: `Caminhe pelas ruas principais e sinta a energia do lugar.`,
                                dica_tripinha: 'Comece sem pressa, aproveite para pegar o mapa no posto de informação turística!',
                                duracao_minutos: 120,
                                google_maps_query: `Centro, ${dest.destino}`,
                                google_maps_url: `https://maps.google.com/?q=${encodeURIComponent('Centro, ' + dest.destino)}`,
                                gratuito: true,
                                tags: ['Cultural']
                            }
                        ]
                    }
                ]
            });

            diaGlobal++;
        }
    }

    const destinoPrincipal = destinosArray.length > 1
        ? destinosArray.map(d => d.destino).join(' → ')
        : destinosArray[0].destino;

    const primeiraChegada = new Date(destinosArray[0].dataChegada + 'T12:00:00');
    const ultimaSaida = new Date(destinosArray[destinosArray.length - 1].dataSaida + 'T12:00:00');
    const numDiasTotal = Math.ceil((ultimaSaida - primeiraChegada) / (1000 * 60 * 60 * 24)) + 1;

    let resumoViagem = `A Tripinha preparou um roteiro base para ${destinoPrincipal}! Personalize como quiser.`;
    if (observacoes && observacoes.trim()) {
        resumoViagem += ' Recebi seus pedidos especiais e vou considerar tudo quando o roteiro completo for gerado.';
    }

    return {
        resumo_viagem: resumoViagem,
        destinos_rota: destinosArray.map(d => d.destino),
        dias,
        _model: 'fallback',
        _numDias: numDiasTotal,
        _destino: destinoPrincipal,
        _destinos: destinosArray.map(d => d.destino),
        _isMultiDestino: destinosArray.length > 1,
        _geradoEm: new Date().toISOString(),
        _observacoesUsadas: !!(observacoes && observacoes.trim())
    };
}
