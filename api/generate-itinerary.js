// api/generate-itinerary.js - GERADOR DE ROTEIRO v2.1
// v2.1: Fix timeout Vercel + cidades repetidas (roteiro complementar) + max_tokens dinâmico
// v2.0: MULTI-DESTINO + clima previsto + contagem de dias por destino
// Fallback: Groq llama-3.3-70b → llama-3.1-8b → roteiro genérico

export const config = {
    maxDuration: 60,
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
                numDias, mes: mesViagem, estacao: getSeasonContext(mesViagem),
                clima: getClimateHint(dest.destino, mesViagem), dias,
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

        const intensidadeDesc = { 'leve': 'Ritmo leve (2-3 atividades/dia)', 'moderado': 'Ritmo moderado (3-4/dia)', 'intenso': 'Ritmo intenso (5-6/dia)' }[intensidade] || 'Ritmo moderado.';
        const orcamentoDesc = { 'economico': 'ECONÔMICO: atividades gratuitas/baratas.', 'medio': 'MÉDIO: mix gratuito + pago moderado.', 'alto': 'ALTO: experiências premium.' }[orcamentoAtividades] || 'MÉDIO.';

        // === LISTA DE DIAS ===
        let diasListaTexto = '';
        destinosInfo.forEach(dest => {
            const visitaLabel = dest.ehCidadeRepetida ? ` [${dest.numVisita}ª visita]` : '';
            diasListaTexto += `\n📍 ${dest.destino}${visitaLabel} (${dest.numDias} dia${dest.numDias > 1 ? 's' : ''}):\n`;
            if (dest.estacao) diasListaTexto += `   Estação: ${dest.estacao}\n`;
            if (dest.clima) diasListaTexto += `   Clima: ${dest.clima}\n`;
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
            multiDestinoRegras = `\nREGRAS MULTI-DESTINO:\n- Cubra TODOS os destinos na ordem\n- Dias de transição: atividades leves, mencione troca de cidade\n- "destino_atual" indica a cidade de cada dia\n- Se destino tem 1-2 dias, priorize imperdíveis`;
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

        // === CLIMA ===
        let climaBloco = '\nCLIMA POR DESTINO:';
        destinosInfo.forEach(dest => {
            climaBloco += `\n- ${dest.destino}: ${dest.estacao || '?'}`;
            if (dest.clima) climaBloco += ` | ${dest.clima}`;
            climaBloco += ` | ${dest.numDias}d`;
        });
        climaBloco += '\nConsidere clima ao sugerir atividades. Mencione nas dicas quando relevante.';

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
- Companhia: ${companhia || '?'}
- Passageiros: ${passageirosInfo}
- Experiências: ${preferencias || 'Variadas'}
- Ritmo: ${intensidadeDesc}
- Orçamento: ${orcamentoDesc}
${restricoesFamilia}
${multiDestinoRegras}

TAREFA: Roteiro COMPLETO de ${numDiasTotal} dias${isMultiDestino ? `, ${destinosArray.length} paradas` : ''}.

REGRAS:
1. Dia de chegada: atividades leves a partir do horário informado
2. Dia de partida: tempo para aeroporto/rodoviária
3. Períodos: manhã/tarde/noite conforme ritmo
4. google_maps_query = NOME REAL + Cidade + País
5. tags: Imperdível, Ideal para família, Histórico, Gastronômico, Compras, Relaxante, Aventura, Cultural, Gratuito, Vida noturna, Natureza, Romântico
6. Textos em pt-BR. Tripinha: 1ª pessoa, calorosa, max 1 ref canina/dia. SEM emoji.
7. duracao_minutos: 30-240. Locais REAIS. Não repita locais entre dias.
8. destino_atual = cidade exata. clima_previsto = estimativa realista.
9. visita_numero = número da visita àquela cidade (1, 2, 3...)
10. Se cidade repetida: roteiro COMPLEMENTAR, atrações DIFERENTES da visita anterior${observacoesInstrucao}

JSON VÁLIDO apenas, zero texto extra. Estrutura: ${estruturaJSON}`;

        // === TOKENS DINÂMICOS ===
        const tokensEstimados = Math.min(Math.max(numDiasTotal * 800, 6000), 16000);
        console.log(`📊 max_tokens: ${tokensEstimados} para ${numDiasTotal} dias`);

        // === GROQ API ===
        const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        let resultado = null, usedModel = null;

        for (const model of models) {
            try {
                console.log(`🤖 Tentando: ${model}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 50000);

                const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
                    signal: controller.signal,
                    body: JSON.stringify({
                        model,
                        messages: [
                            { role: 'system', content: `Você é a Tripinha, cachorra vira-lata caramelo brasileira especialista em viagens. JSON válido pt-BR. Locais REAIS. Inclua destino_atual, clima_previsto, visita_numero.${temCidadesRepetidas ? ' CIDADES REPETIDAS: 2ª visita = roteiro COMPLEMENTAR, atrações DIFERENTES.' : ''}` },
                            { role: 'user', content: prompt }
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.5,
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

        // === ENRIQUECER ===
        resultado.dias.forEach(dia => {
            if (!dia.visita_numero) dia.visita_numero = 1;
            (dia.periodos || []).forEach(p => {
                (p.atividades || []).forEach(a => {
                    if (a.google_maps_query) a.google_maps_url = `https://maps.google.com/?q=${encodeURIComponent(a.google_maps_query)}`;
                });
            });
        });

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

function getSeasonContext(mes) {
    const m = { 1:'Janeiro: verão sul, inverno norte', 2:'Fevereiro: verão/carnaval sul, inverno norte', 3:'Março: fim verão sul, primavera norte', 4:'Abril: outono sul, primavera norte', 5:'Maio: outono sul, primavera norte', 6:'Junho: inverno sul, verão norte', 7:'Julho: inverno sul, verão norte', 8:'Agosto: inverno sul, verão norte', 9:'Setembro: primavera sul, outono norte', 10:'Outubro: primavera sul, outono norte', 11:'Novembro: pré-verão sul, outono norte', 12:'Dezembro: verão sul, inverno norte' };
    return m[mes] || '';
}

function getClimateHint(destino, mes) {
    const l = (destino || '').toLowerCase();
    const tropicais = ['rio','salvador','recife','fortaleza','natal','cancún','cancun','cartagena','bangkok','bali','phuket','havana','miami'];
    if (tropicais.some(t => l.includes(t))) return [12,1,2,3].includes(mes) ? 'Quente/úmido, chuvas tropicais. 28-35°C.' : [6,7,8].includes(mes) ? 'Agradável 22-30°C.' : 'Quente 25-33°C.';
    const europa = ['lisboa','porto','madrid','barcelona','paris','roma','londres','amsterdam','berlim','praga','viena','atenas','milão','florença','veneza'];
    if (europa.some(t => l.includes(t))) return [6,7,8].includes(mes) ? 'Verão: 25-35°C, dias longos.' : [12,1,2].includes(mes) ? 'Inverno: 0-10°C, dias curtos.' : [3,4,5].includes(mes) ? 'Primavera: 12-22°C.' : 'Outono: 8-18°C.';
    const frio = ['bariloche','ushuaia','patagônia','patagonia'];
    if (frio.some(t => l.includes(t))) return [12,1,2].includes(mes) ? 'Verão: 10-20°C, vento.' : [6,7,8].includes(mes) ? 'Inverno: -5 a 5°C, neve.' : 'Frio 5-15°C.';
    return '';
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
