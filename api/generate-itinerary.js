// api/generate-itinerary.js - GERADOR DE ROTEIRO v2.3
// v2.3: Anti-repetição, contagem forçada, clima granular, títulos criativos,
//        dicas proibidas, landmarks obrigatórios, transição melhorada
// v2.2: Tokens dinâmicos por intensidade, timeout adaptativo, atividades por período,
//        instruções para grupos/amigos/casal/solo, hidden gems, temperatura 0.7
// v2.1: Fix timeout Vercel + cidades repetidas (roteiro complementar) + max_tokens dinâmico
// v2.0: MULTI-DESTINO + clima previsto + contagem de dias por destino
// Fallback: Groq llama-3.3-70b → llama-3.1-8b → roteiro genérico

export const config = {
    maxDuration: 300,
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
        destinos, destino, dataIda, dataVolta, horarioChegada, horarioPartida,
        companhia, adultos, criancas, bebes, numPessoas,
        preferencias, intensidade, orcamentoAtividades, observacoes,
    } = req.body;

    let destinosArray = [];
    if (destinos && Array.isArray(destinos) && destinos.length > 0) {
        destinosArray = destinos;
    } else if (destino && dataIda && dataVolta) {
        destinosArray = [{ destino, dataChegada: dataIda, dataSaida: dataVolta, horarioChegada: horarioChegada || '', horarioPartida: horarioPartida || '' }];
    }

    if (destinosArray.length === 0) {
        return res.status(400).json({ error: 'Informe ao menos um destino com datas' });
    }
    for (let i = 0; i < destinosArray.length; i++) {
        const d = destinosArray[i];
        if (!d.destino || !d.dataChegada || !d.dataSaida) {
            return res.status(400).json({ error: `Destino ${i + 1} incompleto` });
        }
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(200).json(buildFallbackItinerary(req.body, destinosArray));
    }

    try {
        const primeiraChegada = new Date(destinosArray[0].dataChegada + 'T12:00:00');
        const ultimaSaida = new Date(destinosArray[destinosArray.length - 1].dataSaida + 'T12:00:00');
        const numDiasTotal = Math.ceil((ultimaSaida - primeiraChegada) / (1000 * 60 * 60 * 24)) + 1;
        const isMultiDestino = destinosArray.length > 1;

        console.log(`🗺️ Gerando roteiro: ${destinosArray.map(d => d.destino).join(' → ')} | ${numDiasTotal} dias`);

        // === DETECTAR CIDADES REPETIDAS ===
        const normalizarCidade = (nome) => (nome || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
        const cidadeOcorrencias = {};
        destinosArray.forEach((d, idx) => {
            const chave = normalizarCidade(d.destino);
            if (!cidadeOcorrencias[chave]) cidadeOcorrencias[chave] = [];
            cidadeOcorrencias[chave].push(idx);
        });
        const cidadesRepetidas = {};
        Object.entries(cidadeOcorrencias).forEach(([chave, indices]) => {
            if (indices.length > 1) cidadesRepetidas[chave] = indices;
        });
        const temCidadesRepetidas = Object.keys(cidadesRepetidas).length > 0;

        const visitaNumero = {};
        const contadorVisitas = {};
        destinosArray.forEach((d, idx) => {
            const chave = normalizarCidade(d.destino);
            if (!contadorVisitas[chave]) contadorVisitas[chave] = 0;
            contadorVisitas[chave]++;
            visitaNumero[idx] = contadorVisitas[chave];
        });

        // === MONTAR DIAS POR DESTINO ===
        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        let diaGlobalCounter = 1;
        const destinosInfo = [];

        for (let idx = 0; idx < destinosArray.length; idx++) {
            const dest = destinosArray[idx];
            const chegada = new Date(dest.dataChegada + 'T12:00:00');
            const saida = new Date(dest.dataSaida + 'T12:00:00');
            const numDias = Math.ceil((saida - chegada) / (1000 * 60 * 60 * 24)) + 1;

            const dias = [];
            for (let i = 0; i < numDias; i++) {
                const data = new Date(chegada);
                data.setDate(data.getDate() + i);
                dias.push({
                    numeroGlobal: diaGlobalCounter++,
                    numeroLocal: i + 1,
                    diaSemana: diasSemana[data.getDay()],
                    dataFormatada: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                    ehPrimeiro: i === 0,
                    ehUltimo: i === numDias - 1
                });
            }

            const chave = normalizarCidade(dest.destino);
            const numVisita = visitaNumero[idx];
            const totalVisitas = cidadeOcorrencias[chave]?.length || 1;

            destinosInfo.push({
                index: idx + 1, arrayIndex: idx, destino: dest.destino,
                dataChegada: dest.dataChegada, dataSaida: dest.dataSaida,
                horarioChegada: dest.horarioChegada || '', horarioPartida: dest.horarioPartida || '',
                numDias, dias,
                ehPrimeiroDestino: idx === 0, ehUltimoDestino: idx === destinosArray.length - 1,
                proximoDestino: idx < destinosArray.length - 1 ? destinosArray[idx + 1].destino : null,
                numVisita, totalVisitas, ehCidadeRepetida: totalVisitas > 1,
            });
        }

        // === PASSAGEIROS ===
        let passageirosInfo = `${numPessoas || 1} pessoa(s)`;
        let restricoesFamilia = '';
        if ((criancas || 0) > 0 || (bebes || 0) > 0) {
            const parts = [`${adultos || 1} adulto(s)`];
            if (criancas > 0) parts.push(`${criancas} criança(s)`);
            if (bebes > 0) parts.push(`${bebes} bebê(s)`);
            passageirosInfo = parts.join(', ');
            restricoesFamilia = `\nATENÇÃO - VIAGEM COM CRIANÇAS/BEBÊS:\n- Atividades adequadas para crianças\n- Pausas e intervalos\n- Horários de refeição e descanso${bebes > 0 ? '\n- BEBÊ(S): tempo extra para logística' : ''}`;
        }

        // v2.3: contagem FORÇADA por período com mínimo explícito
        const intensidadeDesc = {
            'leve': 'Ritmo LEVE: MÍNIMO 2 atividades por período (manhã/tarde/noite). Total MÍNIMO: 6 atividades/dia.',
            'moderado': 'Ritmo MODERADO: MÍNIMO 3 atividades por período (manhã/tarde/noite). Total MÍNIMO: 9 atividades/dia.',
            'intenso': 'Ritmo INTENSO: MÍNIMO 4 atividades por período (manhã/tarde/noite). Total MÍNIMO: 12 atividades/dia. Agenda LOTADA do amanhecer até a madrugada.'
        }[intensidade] || 'Ritmo MODERADO: MÍNIMO 3 atividades por período = 9 atividades/dia.';
        const orcamentoDesc = {
            'economico': 'ECONÔMICO: priorize atividades gratuitas, street food, mercados locais, parques. Evite restaurantes caros.',
            'medio': 'MÉDIO: mix equilibrado gratuito + pago. Restaurantes de preço médio, algumas experiências pagas.',
            'alto': 'ALTO: experiências premium, restaurantes sofisticados, tours exclusivos, ingressos VIP.'
        }[orcamentoAtividades] || 'MÉDIO.';

        // v2.2: instruções específicas para tipo de companhia e tamanho do grupo
        let companhiaInstrucoes = '';
        const numViajantes = parseInt(numPessoas) || 1;
        if (companhia === 'amigos' || companhia === 'Amigos') {
            companhiaInstrucoes = `\n══ VIAGEM COM GRUPO DE ${numViajantes} AMIGOS (PRIORIDADE ALTA) ══
OBRIGATÓRIO em TODOS os dias:
- Pelo menos 1 atividade COLETIVA/INTERATIVA por dia: pub crawl, aula de culinária, degustação de cerveja/vinho, escape room, karaokê, boliche, competição entre amigos
- Vida noturna TODA NOITE: bares locais, rooftops, clubes, pubs com música ao vivo — NÃO apenas "passeio pelo rio"
- Restaurantes com mesas GRANDES e ambiente ANIMADO — nada de restaurantes finos/românticos para mesa de 2
- Para ${numViajantes} pessoas: cite locais que comportem grupos, food halls, cervejarias, biergartens
- Inclua experiências ÚNICAS para amigos: tours de street art, esportes radicais, jogos em grupo, festas locais
- Tom da Tripinha: animado, divertido, como uma amiga que sabe os melhores rolês da cidade`;
        } else if (companhia === 'casal' || companhia === 'Casal') {
            companhiaInstrucoes = `\nVIAGEM ROMÂNTICA A DOIS:
- Inclua experiências românticas: jantares à luz de velas, mirantes ao pôr-do-sol
- Passeios intimistas: jardins, ruelas charmosas, cafés escondidos
- Sugira pelo menos 1 experiência exclusiva (spa, cruzeiro, degustação privada)`;
        } else if (companhia === 'sozinho' || companhia === 'Sozinho') {
            companhiaInstrucoes = `\nVIAGEM SOLO:
- Inclua tours guiados e atividades sociais (free walking tours, hostel events)
- Sugira locais seguros e amigáveis para viajantes solo
- Inclua experiências para conhecer outros viajantes`;
        }

        // === LISTA DE DIAS ===
        let diasListaTexto = '';
        destinosInfo.forEach(dest => {
            const visitaLabel = dest.ehCidadeRepetida ? ` [${dest.numVisita}ª visita]` : '';
            diasListaTexto += `\n📍 ${dest.destino}${visitaLabel} (${dest.numDias} dia${dest.numDias > 1 ? 's' : ''}, ${dest.dataChegada} a ${dest.dataSaida}):\n`;
            dest.dias.forEach(d => {
                let nota = '';
                if (d.ehPrimeiro && dest.horarioChegada) nota = ` (CHEGADA ${dest.horarioChegada}${dest.arrayIndex > 0 ? ' — vindo de ' + destinosArray[dest.arrayIndex - 1].destino : ''})`;
                if (d.ehUltimo && dest.horarioPartida) nota = ` (PARTIDA ${dest.horarioPartida}${dest.proximoDestino ? ' — rumo a ' + dest.proximoDestino : ''})`;
                diasListaTexto += `   Dia ${d.numeroGlobal}: ${d.diaSemana}, ${d.dataFormatada}${nota}\n`;
            });
        });

        // === BLOCO MULTI-DESTINO ===
        let multiDestinoBloco = '', multiDestinoRegras = '';
        if (isMultiDestino) {
            const rotaResumo = destinosArray.map((d, i) => {
                const chave = normalizarCidade(d.destino);
                return (cidadeOcorrencias[chave]?.length || 1) > 1 ? `${d.destino} (${visitaNumero[i]}ª)` : d.destino;
            }).join(' → ');
            multiDestinoBloco = `\n═══════════════════════════════════════════\nVIAGEM MULTI-DESTINO: ${rotaResumo}\nTotal: ${destinosArray.length} paradas em ${numDiasTotal} dias\n═══════════════════════════════════════════`;
            multiDestinoRegras = `\nREGRAS MULTI-DESTINO:\n- Cubra TODOS os destinos na ordem\n- Dias de transição: NÃO desperdiçar. Manhã = última atividade especial na cidade (mirante favorito, café icônico, mercado local). Tarde = viagem. Noite = primeira experiência na nova cidade (jantar típico local, passeio noturno pelo centro)\n- "destino_atual" indica a cidade de cada dia\n- Se destino tem 1-2 dias, priorize LANDMARKS ICÔNICOS imperdíveis\n- PROIBIDO "Visita ao café da estação de trem" como atividade — use locais REAIS com nome`;
        }

        // === BLOCO CIDADES REPETIDAS ===
        let cidadesRepetidasBloco = '';
        if (temCidadesRepetidas) {
            const detalhes = Object.entries(cidadesRepetidas).map(([chave, indices]) => {
                const nome = destinosArray[indices[0]].destino;
                const visitas = indices.map(i => `${visitaNumero[i]}ª: ${destinosInfo.find(d => d.arrayIndex === i).numDias}d`).join(', ');
                return `- ${nome}: ${visitas}`;
            }).join('\n');
            cidadesRepetidasBloco = `
═══════════════════════════════════════════
CIDADES VISITADAS MAIS DE UMA VEZ:
${detalhes}
═══════════════════════════════════════════
REGRAS PARA VISITAS REPETIDAS (PRIORIDADE ALTA):
1. O roteiro da 2ª (ou 3ª) visita DEVE ser COMPLEMENTAR — NÃO repita NENHUMA atração, restaurante, bairro ou atividade da visita anterior
2. Na 2ª visita: sugira bairros locais, experiências gastronômicas diferentes, mercados/feiras/parques novos
3. Na dica da Tripinha, referencie a volta: "Agora que você já conhece o básico, bora explorar o lado B!"
4. No título do dia, indique retorno: "De volta a [cidade] — explorando novos cantos"
5. "destino_atual" = mesmo nome da cidade (sem "2ª visita"). Use "visita_numero" para indicar.`;
        }

        // === CLIMA (inferido pela LLM com base nas datas) ===
        const climaBloco = '\nCLIMA: Com base nas datas da viagem e nos destinos, estime o clima típico de cada cidade nessa época do ano. Use esse conhecimento para adaptar atividades (ex: atividades indoor em dias frios, ao ar livre no verão). Preencha "clima_previsto" com estimativa realista de temperatura e condições.';

        // === OBSERVAÇÕES ===
        let observacoesBloco = '', observacoesInstrucao = '';
        if (observacoes && observacoes.trim()) {
            observacoesBloco = `\n═══════════════════════════════════════════\nPEDIDOS ESPECIAIS DO VIAJANTE:\n"${observacoes.trim()}"\n═══════════════════════════════════════════\nAtenda TODOS os pedidos. Referencie nas dicas da Tripinha. NÃO copie literalmente.`;
            observacoesInstrucao = '\n16. Atenda os PEDIDOS ESPECIAIS do viajante.';
        }

        // === ESTRUTURA JSON ===
        const estruturaJSON = `{"resumo_viagem":"...","destinos_rota":[...],"dias":[{"dia_numero":1,"dia_semana":"...","data":"DD/MM","destino_atual":"Cidade","visita_numero":1,"titulo":"...","resumo_tripinha":"...","clima_previsto":"...","eh_dia_transicao":false,"periodos":[{"periodo":"manhã|tarde|noite","atividades":[{"nome":"...","descricao":"...","dica_tripinha":"...","duracao_minutos":90,"google_maps_query":"Local, Cidade, País","gratuito":true,"tags":["..."]}]}]}]}`;

        // === PROMPT ===
        const destinoPrincipal = isMultiDestino ? destinosArray.map(d => d.destino).join(' → ') : destinosArray[0].destino;
        const prompt = `ESPECIALISTA EM ROTEIROS DE VIAGEM
${multiDestinoBloco}

${isMultiDestino ? 'ROTA' : 'DESTINO'}: ${destinoPrincipal}
PERÍODO: ${destinosArray[0].dataChegada} a ${destinosArray[destinosArray.length - 1].dataSaida} (${numDiasTotal} dias)
${climaBloco}
${cidadesRepetidasBloco}
${observacoesBloco}

DIAS:
${diasListaTexto}

VIAJANTE:
- Companhia: ${companhia || '?'} (${numViajantes} pessoa${numViajantes > 1 ? 's' : ''})
- Passageiros: ${passageirosInfo}
- Experiências: ${preferencias || 'Variadas'}
- Ritmo: ${intensidadeDesc}
- Orçamento: ${orcamentoDesc}
${restricoesFamilia}${companhiaInstrucoes}
${multiDestinoRegras}

TAREFA: Roteiro COMPLETO e DETALHADO de ${numDiasTotal} dias${isMultiDestino ? `, ${destinosArray.length} paradas` : ''}.

═══ REGRAS DE QUANTIDADE (OBRIGATÓRIO) ═══
1. CADA período (manhã/tarde/noite) DEVE ter o MÍNIMO de atividades conforme o ritmo acima. Conte antes de retornar!
2. Dia de chegada: atividades a partir do horário informado (pode ter menos na manhã se chegou tarde)
3. Dia de partida: tempo para aeroporto/rodoviária, mas NÃO desperdiçar a manhã

═══ REGRAS ANTI-REPETIÇÃO (CRÍTICO) ═══
4. PROIBIDO repetir o MESMO local em dias diferentes. ZERO repetição. Cada local aparece UMA VEZ no roteiro inteiro.
5. PROIBIDO usar "café da estação de trem" ou locais genéricos como atividade. Use locais REAIS com nome próprio.
6. Dias de transição entre cidades: inclua atividade específica de despedida (último café famoso, mirante, mercado) — NÃO genéricos.
7. PROIBIDO repetir a mesma estrutura de dia (ex: museu+parque+restaurante+bar) — varie a sequência.

═══ REGRAS DE QUALIDADE ═══
8. google_maps_query = NOME REAL ESPECÍFICO + Cidade + País (ex: "The Nightjar, Londres, Reino Unido")
9. tags: Imperdível, Ideal para família, Histórico, Gastronômico, Compras, Relaxante, Aventura, Cultural, Gratuito, Vida noturna, Natureza, Romântico
10. Textos em pt-BR. Tripinha: 1ª pessoa, calorosa, max 1 ref canina/dia. SEM emoji.
11. duracao_minutos: 30-240. Locais REAIS verificáveis no Google Maps.
12. destino_atual = cidade exata. clima_previsto = estimativa realista baseada no mês.
13. visita_numero = número da visita àquela cidade (1, 2, 3...)

═══ REGRAS DE DIFERENCIAL ═══
14. Inclua os LANDMARKS ICÔNICOS de cada cidade (ex: Big Ben em Londres, Torre Eiffel em Paris, Anne Frank House em Amsterdam). NÃO pule os imperdíveis.
15. MISTURE: 40% atrações clássicas + 30% hidden gems/segredos locais + 30% experiências gastronômicas/noturnas
16. Títulos dos dias devem ser CRIATIVOS e ÚNICOS — NÃO use padrões como "Explorando X", "Aventuras em X", "Cultura em X"
17. dica_tripinha: PROIBIDO frases genéricas como "Aproveite a atmosfera animada", "Aproveite a vista da cidade", "Peça o menu degustação". Cada dica deve ser ÚNICA e ESPECÍFICA: nome do prato, horário ideal, truque local, segredo que só morador sabe.
18. Descrições das atividades devem ser DISTINTAS entre si — PROIBIDO "Um museu com uma vasta coleção de..." repetidamente.
19. Se cidade repetida: roteiro COMPLEMENTAR, atrações DIFERENTES da visita anterior${observacoesInstrucao}

JSON VÁLIDO apenas, zero texto extra. Estrutura: ${estruturaJSON}`;

        // === TOKENS DINÂMICOS ===
        // v2.2: tokens por dia baseado na intensidade para garantir conteúdo rico
        const tokensPorDia = { 'leve': 900, 'moderado': 1200, 'intenso': 1800 }[intensidade] || 1200;
        const tokensEstimados = Math.min(Math.max(numDiasTotal * tokensPorDia, 6000), 32000);
        console.log(`📊 max_tokens: ${tokensEstimados} para ${numDiasTotal} dias (${intensidade || 'moderado'})`);

        // === GROQ API ===
        const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        let resultado = null, usedModel = null;

        for (const model of models) {
            try {
                console.log(`🤖 Tentando: ${model}`);
                const controller = new AbortController();
                // v2.2: timeout dinâmico — 50s base + 3s por dia extra (além de 5 dias)
                const timeoutMs = Math.min(50000 + Math.max(numDiasTotal - 5, 0) * 3000, 120000);
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
                    signal: controller.signal,
                    body: JSON.stringify({
                        model,
                        messages: [
                            { role: 'system', content: `Você é a Tripinha, cachorra vira-lata caramelo brasileira e guia de viagem expert. Gere JSON válido pt-BR com locais REAIS verificáveis no Google Maps. REGRAS CRÍTICAS: (1) NUNCA repita o mesmo local em dias diferentes. (2) Respeite o MÍNIMO de atividades por período conforme a intensidade. (3) Dicas devem ser ESPECÍFICAS e ÚNICAS — proibido "aproveite a atmosfera" ou "peça o menu degustação". (4) Inclua destino_atual, clima_previsto, visita_numero.${temCidadesRepetidas ? ' CIDADES REPETIDAS: 2ª visita = roteiro COMPLEMENTAR, atrações DIFERENTES.' : ''}` },
                            { role: 'user', content: prompt }
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.7,
                        max_tokens: tokensEstimados,
                    })
                });
                clearTimeout(timeoutId);

                if (!groqResponse.ok) { console.error(`[${model}] HTTP ${groqResponse.status}`); continue; }
                const groqData = await groqResponse.json();
                const content = groqData.choices?.[0]?.message?.content;
                if (!content) { console.error(`[${model}] Vazio`); continue; }

                resultado = JSON.parse(content);
                usedModel = model;
                console.log(`✅ [${model}] ${resultado.dias?.length || 0} dias`);
                break;
            } catch (err) {
                console.error(`[${model}] ${err.name === 'AbortError' ? 'Timeout 50s' : err.message}`);
                continue;
            }
        }

        if (!resultado || !resultado.dias || !Array.isArray(resultado.dias)) {
            return res.status(200).json(buildFallbackItinerary(req.body, destinosArray));
        }

        // === ENRIQUECER E VALIDAR ===
        const minAtividadesPorPeriodo = { 'leve': 1, 'moderado': 2, 'intenso': 3 }[intensidade] || 2;
        let totalAtividades = 0;
        resultado.dias.forEach(dia => {
            if (!dia.visita_numero) dia.visita_numero = 1;
            (dia.periodos || []).forEach(p => {
                const atividades = p.atividades || [];
                totalAtividades += atividades.length;
                atividades.forEach(a => {
                    if (a.google_maps_query) a.google_maps_url = `https://maps.google.com/?q=${encodeURIComponent(a.google_maps_query)}`;
                });
            });
        });
        const mediaAtividadesPorDia = totalAtividades / (resultado.dias.length || 1);
        console.log(`📊 Validação: ${totalAtividades} atividades total, média ${mediaAtividadesPorDia.toFixed(1)}/dia, mínimo esperado/período: ${minAtividadesPorPeriodo}`);

        resultado._model = usedModel;
        resultado._numDias = numDiasTotal;
        resultado._destino = destinoPrincipal;
        resultado._destinos = destinosArray.map(d => d.destino);
        resultado._isMultiDestino = isMultiDestino;
        resultado._temCidadesRepetidas = temCidadesRepetidas;
        resultado._geradoEm = new Date().toISOString();
        resultado._observacoesUsadas = !!(observacoes && observacoes.trim());

        return res.status(200).json(resultado);

    } catch (erro) {
        console.error('❌ Erro geral:', erro);
        return res.status(200).json(buildFallbackItinerary(req.body, destinosArray));
    }
}



function buildFallbackItinerary(params, destinosArray) {
    const diasSemana = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const dias = []; let diaGlobal = 1;
    for (const dest of destinosArray) {
        const chegada = new Date(dest.dataChegada + 'T12:00:00');
        const saida = new Date(dest.dataSaida + 'T12:00:00');
        const numDias = Math.ceil((saida - chegada) / (1000 * 60 * 60 * 24)) + 1;
        for (let i = 0; i < numDias; i++) {
            const data = new Date(chegada); data.setDate(data.getDate() + i);
            dias.push({ dia_numero: diaGlobal, dia_semana: diasSemana[data.getDay()], data: data.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}), destino_atual: dest.destino, visita_numero: 1, titulo: i===0?`Chegada em ${dest.destino}`:`Dia ${diaGlobal} em ${dest.destino}`, resumo_tripinha: `Explore ${dest.destino}!`, clima_previsto:'', eh_dia_transicao:false, periodos:[{periodo:'manhã',atividades:[{nome:`Explorar ${dest.destino}`,descricao:'Caminhe pelas ruas principais.',dica_tripinha:'Comece sem pressa!',duracao_minutos:120,google_maps_query:`Centro, ${dest.destino}`,google_maps_url:`https://maps.google.com/?q=${encodeURIComponent('Centro, '+dest.destino)}`,gratuito:true,tags:['Cultural']}]}] });
            diaGlobal++;
        }
    }
    const p = destinosArray.length > 1 ? destinosArray.map(d=>d.destino).join(' → ') : destinosArray[0].destino;
    const c1 = new Date(destinosArray[0].dataChegada+'T12:00:00'), c2 = new Date(destinosArray[destinosArray.length-1].dataSaida+'T12:00:00');
    return { resumo_viagem:`Roteiro base para ${p}!`, destinos_rota:destinosArray.map(d=>d.destino), dias, _model:'fallback', _numDias:Math.ceil((c2-c1)/(86400000))+1, _destino:p, _destinos:destinosArray.map(d=>d.destino), _isMultiDestino:destinosArray.length>1, _temCidadesRepetidas:false, _geradoEm:new Date().toISOString(), _observacoesUsadas:false };
}
