// api/generate-itinerary.js - v2.1 (Observações Livres)
// Vercel Serverless Function
// Gera roteiro de viagem personalizado dia a dia usando LLM

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
        destino,
        dataIda, dataVolta,
        horarioChegada, horarioPartida,
        companhia, numPessoas,
        adultos, criancas, bebes,
        noites,
        preferencias,
        intensidade,
        orcamentoAtividades,
        observacoes
    } = req.body;

    if (!destino || !dataIda) {
        return res.status(400).json({
            error: 'Destino e data de ida são obrigatórios',
            received: { destino, dataIda }
        });
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });
    }

    try {
        const diasViagem = noites ? parseInt(noites) + 1 : calcularDias(dataIda, dataVolta);

        console.log(`🗺️ Gerando roteiro: ${destino} | ${diasViagem} dias | ${companhia} | ${preferencias}`);
        if (observacoes) console.log(`💬 Observações do viajante: "${observacoes}"`);

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
ATENÇÃO ESPECIAL - VIAGEM COM CRIANÇAS/BEBÊS:
- Inclua atividades adequadas para crianças em TODOS os dias
- Sugira restaurantes family-friendly
- Evite longas caminhadas sem pausas
- Inclua áreas verdes, parques, playgrounds quando possível
${bebes > 0 ? '- BEBÊ(S): sugira horários flexíveis, evite atividades muito cedo ou muito tarde' : ''}
${criancas > 0 ? '- CRIANÇAS: inclua pelo menos 1 atividade divertida para elas por dia' : ''}`;
        }

        // ============================================================
        // v2.1: BLOCO DE OBSERVAÇÕES DO VIAJANTE
        // ============================================================
        const observacoesBloco = observacoes
            ? `\nOBSERVAÇÕES PESSOAIS DO VIAJANTE (MUITO IMPORTANTE — adapte o roteiro conforme solicitado):
"${observacoes}"
`
            : '';

        // ============================================================
        // INTENSIDADE DO ROTEIRO
        // ============================================================
        const intensidadeDesc = {
            'leve': 'Ritmo leve e tranquilo — 2-3 atividades por dia, bastante tempo livre',
            'moderado': 'Ritmo moderado — 3-4 atividades por dia, bom equilíbrio entre passeios e descanso',
            'intenso': 'Ritmo intenso — 4-6 atividades por dia, aproveitar ao máximo cada momento'
        }[intensidade] || 'Ritmo moderado';

        // ============================================================
        // ORÇAMENTO DE ATIVIDADES
        // ============================================================
        const orcamentoDesc = {
            'economico': 'Econômico — priorize atividades gratuitas e baratas, parques, mirantes, mercados',
            'medio': 'Médio — mix de atividades gratuitas e pagas, museus, tours guiados acessíveis',
            'alto': 'Alto — experiências premium, restaurantes renomados, tours exclusivos, shows'
        }[orcamentoAtividades] || 'Médio';

        // ============================================================
        // DATAS DETALHADAS
        // ============================================================
        const datasDetalhadas = gerarDatasDetalhadas(dataIda, diasViagem);

        // ============================================================
        // PROMPT COMPLETO
        // ============================================================
        const prompt = `ESPECIALISTA EM TURISMO - Roteiro personalizado dia a dia

DESTINO: ${destino}
PERÍODO: ${dataIda} a ${dataVolta || 'não definido'} (${diasViagem} dias, ${noites || diasViagem - 1} noites)
DATAS: ${datasDetalhadas}

PERFIL DO VIAJANTE:
- Companhia: ${companhia || 'Não informado'}
- Passageiros: ${passageirosInfo}
- O que busca: ${preferencias || 'Não informado'}
- Ritmo: ${intensidadeDesc}
- Orçamento atividades: ${orcamentoDesc}
${horarioChegada ? `- Chegada no destino: ${horarioChegada}` : ''}
${horarioPartida ? `- Partida do destino: ${horarioPartida}` : ''}
${restricoesFamilia}
${observacoesBloco}
TAREFA: Gere um roteiro COMPLETO dia a dia para ${destino}, respeitando o perfil acima.

REGRAS:
1. Crie atividades REAIS e específicas para ${destino} — nomes reais de lugares
2. No DIA 1, considere que o viajante chega às ${horarioChegada || '14:00'} — NÃO agende atividades antes disso
3. No ÚLTIMO DIA, considere partida às ${horarioPartida || '18:00'} — atividades só de manhã/início da tarde
4. Inclua horários realistas para cada atividade
5. Varie entre cultura, gastronomia, natureza, pontos turísticos conforme preferências
6. Sugira restaurantes REAIS para almoço/jantar quando apropriado
7. O "resumo_tripinha" é um texto curto e animado da Tripinha (cachorrinha mascote) apresentando o dia
8. A "dica_tripinha" é um conselho prático da Tripinha para aquele dia
9. Use tom amigável, direto, como uma amiga dando dicas
10. NÃO use emoji nos textos (o frontend cuida disso)
11. Use no máximo 1 referência canina por dia para não saturar
12. Evite repetir locais entre dias diferentes
${observacoes ? '13. O viajante deixou OBSERVAÇÕES PESSOAIS — adapte atividades, restaurantes e dicas conforme o pedido dele. Nos textos da Tripinha (resumo_tripinha e dica_tripinha), faça referência ao que ele pediu, mostrando que foi considerado.' : ''}

RESPONDA APENAS com JSON válido neste formato:

{
  "roteiro": {
    "destino": "${destino}",
    "dias": [
      {
        "numero": 1,
        "data": "YYYY-MM-DD",
        "dia_semana": "segunda-feira",
        "titulo": "Dia 1 — Chegada e primeiras impressões",
        "resumo_tripinha": "Texto curto da Tripinha sobre o dia",
        "atividades": [
          {
            "horario": "15:00",
            "nome": "Nome do local/atividade",
            "local": "Endereço ou região",
            "descricao": "O que fazer e por que vale a pena",
            "tipo": "cultura|gastronomia|natureza|compras|lazer",
            "custo_estimado": "Gratuito / €10 / $$",
            "duracao_minutos": 60
          }
        ],
        "dica_tripinha": "Dica prática da Tripinha para o dia",
        "restaurante_sugerido": {
          "nome": "Nome real do restaurante",
          "tipo": "almoço ou jantar",
          "descricao": "Breve descrição",
          "faixa_preco": "$ / $$ / $$$"
        }
      }
    ]
  }
}`;

        // ============================================================
        // CHAMADA AO LLM
        // ============================================================
        const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        let resultado = null;
        let usedModel = null;

        for (const model of models) {
            try {
                console.log(`🤖 Tentando modelo ${model}...`);

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
                                content: 'Você é a Tripinha, uma cachorrinha vira-lata caramelo especialista em turismo e criadora de roteiros de viagem. Retorna APENAS JSON válido em português do Brasil. Cria roteiros com atividades reais, horários realistas e dicas práticas. Tom animado mas informativo.'
                            },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.5,
                        max_tokens: 4000,
                        response_format: { type: 'json_object' }
                    })
                });

                if (!groqResponse.ok) {
                    const errText = await groqResponse.text();
                    console.warn(`⚠️ Modelo ${model} falhou: ${groqResponse.status} - ${errText}`);
                    continue;
                }

                const groqData = await groqResponse.json();
                const content = groqData.choices?.[0]?.message?.content;

                if (!content) {
                    console.warn(`⚠️ Modelo ${model}: resposta vazia`);
                    continue;
                }

                const parsed = JSON.parse(content);

                // Validar estrutura mínima
                if (!parsed.roteiro || !Array.isArray(parsed.roteiro.dias) || parsed.roteiro.dias.length === 0) {
                    console.warn(`⚠️ Modelo ${model}: estrutura de roteiro inválida`);
                    continue;
                }

                resultado = parsed;
                usedModel = model;
                console.log(`✅ Roteiro gerado com ${model} — ${parsed.roteiro.dias.length} dias`);
                break;

            } catch (modelErr) {
                console.warn(`⚠️ Erro no modelo ${model}:`, modelErr.message);
                continue;
            }
        }

        if (!resultado) {
            console.error('❌ Todos os modelos falharam para gerar roteiro');
            return res.status(500).json({
                error: 'Não foi possível gerar o roteiro. Tente novamente.',
                fallback: true
            });
        }

        return res.status(200).json({
            ...resultado,
            _model: usedModel,
            _destino: destino,
            _dias: diasViagem
        });

    } catch (erro) {
        console.error('❌ Erro ao gerar roteiro:', erro);
        return res.status(500).json({
            error: 'Erro interno ao gerar roteiro',
            message: erro.message
        });
    }
}

// ============================================================
// UTILITÁRIOS
// ============================================================

function calcularDias(dataIda, dataVolta) {
    if (!dataIda || !dataVolta) return 3; // fallback
    const ida = new Date(dataIda);
    const volta = new Date(dataVolta);
    return Math.ceil((volta - ida) / (1000 * 60 * 60 * 24)) + 1;
}

function gerarDatasDetalhadas(dataIda, diasViagem) {
    const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

    try {
        const partes = [];
        for (let i = 0; i < diasViagem; i++) {
            const data = new Date(dataIda + 'T12:00:00');
            data.setDate(data.getDate() + i);
            const diaSemana = diasSemana[data.getDay()];
            const dia = data.getDate();
            const mes = meses[data.getMonth()];
            partes.push(`Dia ${i + 1}: ${diaSemana}, ${dia} de ${mes}`);
        }
        return partes.join(' | ');
    } catch {
        return `${diasViagem} dias a partir de ${dataIda}`;
    }
}
