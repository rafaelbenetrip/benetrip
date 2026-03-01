// api/generate-itinerary.js - GERADOR DE ROTEIRO v1.1
// Gera roteiro dia a dia personalizado via Groq LLM
// v1.1: Campo de observações do usuário + Google Maps URLs curtas
// Fallback: Groq llama-3.3-70b → llama-3.1-8b → roteiro genérico

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
        destino,
        dataIda,
        dataVolta,
        horarioChegada,
        horarioPartida,
        companhia,
        adultos,
        criancas,
        bebes,
        numPessoas,
        preferencias,
        intensidade,
        orcamentoAtividades,
        observacoes,  // NOVO: campo de observações livres do usuário
    } = req.body;

    // ============================================================
    // VALIDAÇÃO
    // ============================================================
    if (!destino || !dataIda || !dataVolta) {
        return res.status(400).json({
            error: 'Campos obrigatórios: destino, dataIda, dataVolta',
            received: { destino, dataIda, dataVolta }
        });
    }

    if (!process.env.GROQ_API_KEY) {
        console.warn('⚠️ GROQ_API_KEY não configurada, retornando fallback');
        return res.status(200).json(buildFallbackItinerary(req.body));
    }

    try {
        // ============================================================
        // CALCULAR DIAS DA VIAGEM
        // ============================================================
        const ida = new Date(dataIda + 'T12:00:00');
        const volta = new Date(dataVolta + 'T12:00:00');
        const numDias = Math.ceil((volta - ida) / (1000 * 60 * 60 * 24)) + 1;

        console.log(`🗺️ Gerando roteiro: ${destino} | ${numDias} dias | ${companhia} | ${preferencias}`);
        if (observacoes) {
            console.log(`📝 Observações do usuário: ${observacoes}`);
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
            'economico': 'ECONÔMICO: priorizar atividades gratuitas ou muito baratas. Parques, mirantes, praias, caminhadas, mercados públicos, free walking tours. Quando sugerir algo pago, avisar que é pago.',
            'medio': 'MÉDIO: mistura de atividades gratuitas e pagas moderadas. Museus, passeios de barco, tours guiados acessíveis, restaurantes com bom custo-benefício.',
            'alto': 'ALTO: incluir experiências premium sem restrição. Restaurantes renomados, passeios exclusivos, spas, shows, experiências gastronômicas, tours VIP.'
        }[orcamentoAtividades] || 'MÉDIO: mistura de atividades gratuitas e pagas.';

        // ============================================================
        // GERAR LISTA DE DIAS COM DATAS REAIS
        // ============================================================
        const diasInfo = [];
        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        for (let i = 0; i < numDias; i++) {
            const data = new Date(ida);
            data.setDate(data.getDate() + i);
            const diaSemana = diasSemana[data.getDay()];
            const dataFormatada = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            diasInfo.push({
                numero: i + 1,
                diaSemana,
                dataFormatada,
                ehPrimeiro: i === 0,
                ehUltimo: i === numDias - 1
            });
        }

        const diasListaTexto = diasInfo.map(d => {
            let nota = '';
            if (d.ehPrimeiro && horarioChegada) nota = ` (CHEGADA às ${horarioChegada})`;
            if (d.ehUltimo && horarioPartida) nota = ` (PARTIDA às ${horarioPartida})`;
            return `Dia ${d.numero}: ${d.diaSemana}, ${d.dataFormatada}${nota}`;
        }).join('\n');

        // ============================================================
        // DETECTAR ESTAÇÃO DO ANO
        // ============================================================
        const mesViagem = ida.getMonth() + 1;
        const estacaoInfo = getSeasonContext(mesViagem);

        // ============================================================
        // NOVO: BLOCO DE OBSERVAÇÕES DO USUÁRIO PARA O PROMPT
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
4. Nas "dica_tripinha" de atividades relevantes, faça referências naturais aos pedidos (ex: "Como você pediu, separei um restaurante vegetariano aqui perto!" ou "Sei que você queria evitar museus longos, então esse é rápido e interativo!")
5. No "resumo_viagem", mencione brevemente que os pedidos especiais foram considerados, de forma natural e calorosa
6. NÃO copie o texto do viajante literalmente — absorva as informações e demonstre que entendeu adaptando o roteiro`;

            observacoesInstrucao = '\n14. O viajante fez PEDIDOS ESPECIAIS — leia com atenção a seção "PEDIDOS ESPECIAIS DO VIAJANTE" e garanta que cada solicitação foi atendida no roteiro. Demonstre nas dicas da Tripinha que os pedidos foram levados em conta.';
        }

        // ============================================================
        // ESTRUTURA JSON ESPERADA
        // ============================================================
        const estruturaJSON = `{
  "resumo_viagem": "Frase curta e animada da Tripinha resumindo a vibe da viagem${observacoes ? ' (mencione que os pedidos especiais foram considerados)' : ''}",
  "dias": [
    {
      "dia_numero": 1,
      "dia_semana": "Quarta-feira",
      "data": "10/07",
      "titulo": "Título curto e criativo para o dia (ex: 'Chegada e primeiras impressões')",
      "resumo_tripinha": "Frase da Tripinha descrevendo o dia (2-3 frases, descontraída)",
      "periodos": [
        {
          "periodo": "manhã|tarde|noite",
          "atividades": [
            {
              "nome": "Nome do local ou atividade",
              "descricao": "Descrição curta da atividade (1-2 frases)",
              "dica_tripinha": "Dica prática da Tripinha sobre esse local${observacoes ? ' (referencie pedidos do viajante quando relevante)' : ''}",
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
        // PROMPT PRINCIPAL
        // ============================================================
        const prompt = `ESPECIALISTA EM ROTEIROS DE VIAGEM - Planejamento dia a dia personalizado

DESTINO: ${destino}
PERÍODO: ${dataIda} a ${dataVolta} (${numDias} dias)
${estacaoInfo ? `CONTEXTO SAZONAL: ${estacaoInfo}` : ''}
${observacoesBloco}

DIAS DA VIAGEM:
${diasListaTexto}

PERFIL DO VIAJANTE:
- Companhia: ${companhia || 'Não informado'}
- Passageiros: ${passageirosInfo}
- Experiências buscadas: ${preferencias || 'Variadas'}
- Ritmo: ${intensidadeDesc}
- Orçamento atividades: ${orcamentoDesc}
${horarioChegada ? `- Chegada no destino: ${horarioChegada}` : ''}
${horarioPartida ? `- Partida do destino: ${horarioPartida}` : ''}
${restricoesFamilia}

TAREFA: Gere um roteiro COMPLETO de ${numDias} dias para ${destino}, cobrindo TODOS os dias listados acima.

REGRAS IMPORTANTES:
1. O DIA 1 ${horarioChegada ? `começa a partir das ${horarioChegada} (hora de chegada no destino)` : 'é o dia de chegada — comece com atividades leves de ambientação'}
2. O ÚLTIMO DIA ${horarioPartida ? `deve considerar partida às ${horarioPartida} — o viajante precisa de tempo para ir ao aeroporto/rodoviária` : 'é o dia de partida — sugira atividades de manhã e organização para partida'}
3. Cada dia DEVE ter atividades distribuídas por períodos (manhã, tarde, noite) conforme o ritmo escolhido
4. "google_maps_query" deve ser o NOME REAL DO LOCAL + Cidade + País, para funcionar numa busca do Google Maps (ex: "Torre Eiffel, Paris, França"). Use nomes curtos e diretos.
5. "tags" podem ser: "Imperdível", "Ideal para família", "Histórico", "Gastronômico", "Compras", "Relaxante", "Aventura", "Cultural", "Gratuito", "Vida noturna", "Natureza", "Romântico"
6. "gratuito" deve ser true se a atividade é gratuita (parques, praias, mirantes, caminhar por bairros) ou false se normalmente é paga
7. Escreva TODOS os textos em português brasileiro
8. Tom dos textos: Tripinha é uma cachorra vira-lata caramelo, fala em 1ª pessoa, descontraída, calorosa, amiga do viajante. Pode usar referência canina sutil (farejar, explorar) mas SEM exagerar — no máximo 1 por dia.
9. NÃO use emoji nos textos (o frontend adiciona)
10. "duracao_minutos" é o tempo estimado naquela atividade (mínimo 30, máximo 240)
11. Priorize LOCAIS REAIS e POPULARES que existem de fato no destino
12. Evite repetir locais entre dias diferentes
13. Para o dia de chegada e o dia de partida, ajuste o número de atividades ao tempo disponível${observacoesInstrucao}

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
                                content: `Você é a Tripinha, uma cachorra vira-lata caramelo brasileira especialista em viagens. Crie roteiros detalhados e personalizados. Retorne APENAS JSON válido em português do Brasil. Zero texto extra fora do JSON. Todos os locais devem ser REAIS e existir de fato no destino. O campo google_maps_query deve conter o nome real do local para funcionar no Google Maps.${observacoes ? ' IMPORTANTE: O viajante fez pedidos especiais — demonstre nas suas dicas que você levou tudo em conta, de forma natural e acolhedora.' : ''}`
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
            return res.status(200).json(buildFallbackItinerary(req.body));
        }

        // ============================================================
        // VALIDAÇÃO E ENRIQUECIMENTO
        // ============================================================
        if (!resultado.dias || !Array.isArray(resultado.dias)) {
            console.error('❌ Resposta sem array de dias');
            return res.status(200).json(buildFallbackItinerary(req.body));
        }

        // Garantir Google Maps links curtos para cada atividade
        resultado.dias.forEach(dia => {
            if (dia.periodos && Array.isArray(dia.periodos)) {
                dia.periodos.forEach(periodo => {
                    if (periodo.atividades && Array.isArray(periodo.atividades)) {
                        periodo.atividades.forEach(ativ => {
                            if (ativ.google_maps_query) {
                                // CORRIGIDO: URL mais curta para compartilhamento
                                ativ.google_maps_url = `https://maps.google.com/?q=${encodeURIComponent(ativ.google_maps_query)}`;
                            }
                        });
                    }
                });
            }
        });

        resultado._model = usedModel;
        resultado._numDias = numDias;
        resultado._destino = destino;
        resultado._geradoEm = new Date().toISOString();
        // NOVO: flag indicando se observações foram usadas
        resultado._observacoesUsadas = !!(observacoes && observacoes.trim());

        console.log(`🗺️ Roteiro completo: ${resultado.dias.length} dias para ${destino}`);

        return res.status(200).json(resultado);

    } catch (erro) {
        console.error('❌ Erro geral:', erro);
        return res.status(200).json(buildFallbackItinerary(req.body));
    }
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
// FALLBACK: Roteiro genérico sem LLM
// ============================================================
function buildFallbackItinerary(params) {
    const { destino, dataIda, dataVolta, horarioChegada, horarioPartida, observacoes } = params;
    const ida = new Date(dataIda + 'T12:00:00');
    const volta = new Date(dataVolta + 'T12:00:00');
    const numDias = Math.ceil((volta - ida) / (1000 * 60 * 60 * 24)) + 1;
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

    const dias = [];
    for (let i = 0; i < numDias; i++) {
        const data = new Date(ida);
        data.setDate(data.getDate() + i);

        const ehPrimeiro = i === 0;
        const ehUltimo = i === numDias - 1;

        let titulo = `Dia ${i + 1} em ${destino}`;
        let resumo = `Explore ${destino} no seu ritmo!`;

        if (ehPrimeiro) {
            titulo = `Chegada em ${destino}`;
            resumo = `Bem-vindo a ${destino}! Hora de se ambientar e curtir as primeiras impressões.`;
        } else if (ehUltimo) {
            titulo = `Despedida de ${destino}`;
            resumo = `Último dia! Aproveite cada minuto antes de partir.`;
        }

        dias.push({
            dia_numero: i + 1,
            dia_semana: diasSemana[data.getDay()],
            data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            titulo,
            resumo_tripinha: resumo,
            periodos: [
                {
                    periodo: ehPrimeiro && horarioChegada && parseInt(horarioChegada) >= 14 ? 'tarde' : 'manhã',
                    atividades: [
                        {
                            nome: `Explorar o centro de ${destino}`,
                            descricao: `Caminhe pelas ruas principais e sinta a energia do lugar.`,
                            dica_tripinha: 'Comece sem pressa, aproveite para pegar o mapa no posto de informação turística!',
                            duracao_minutos: 120,
                            google_maps_query: `Centro, ${destino}`,
                            google_maps_url: `https://maps.google.com/?q=${encodeURIComponent('Centro, ' + destino)}`,
                            gratuito: true,
                            tags: ['Cultural']
                        }
                    ]
                }
            ]
        });
    }

    let resumoViagem = `A Tripinha preparou um roteiro base para ${destino}! Personalize como quiser.`;
    if (observacoes && observacoes.trim()) {
        resumoViagem = `A Tripinha preparou um roteiro base para ${destino}! Recebi seus pedidos especiais e vou considerar tudo quando o roteiro completo for gerado. Por enquanto, aqui vai uma versão inicial.`;
    }

    return {
        resumo_viagem: resumoViagem,
        dias,
        _model: 'fallback',
        _numDias: numDias,
        _destino: destino,
        _geradoEm: new Date().toISOString(),
        _observacoesUsadas: !!(observacoes && observacoes.trim())
    };
}
