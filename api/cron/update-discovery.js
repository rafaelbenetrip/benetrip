// api/cron/update-discovery.js - BENETRIP DISCOVERY CRON v2.0
// Roda automaticamente via Vercel Cron (7x ao dia, a cada ~3h)
// Busca destinos baratos para 100 cidades brasileiras usando lotes rotativos
// e salva snapshots no Supabase para consulta rápida + histórico
//
// v2.0: Lotes rotativos (15 cidades por execução)
//       Classificação de estilos via Groq
//       100 cidades carregadas de brazilian-airports.json
//
// COMO FUNCIONA:
// 1. Carrega lista de 100 cidades de brazilian-airports.json
// 2. Determina qual lote processar (baseado na hora do dia)
// 3. Para cada cidade do lote, chama a SearchAPI (google_travel_explore)
// 4. Classifica estilos via Groq (batch) com fallback keywords
// 5. Salva no Supabase (tabela discovery_snapshots)
//
// TRIGGER: Vercel Cron configurado em vercel.json (7x/dia)
// MANUAL:  GET /api/cron/update-discovery?key=CRON_SECRET
// FORÇAR LOTE: GET /api/cron/update-discovery?key=CRON_SECRET&lote=3

import { readFileSync } from 'fs';
import { join } from 'path';

export const maxDuration = 300; // 5 minutos

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const CIDADES_POR_LOTE = 15;     // Quantas cidades processar por execução
const LOTES_POR_DIA = 2;         // Cron roda 2x/dia (30 cidades / 15 por lote)

// Carregar cidades do JSON
function carregarCidades() {
    try {
        const filePath = join(process.cwd(), 'api', 'data', 'brazilian-airports.json');
        const raw = readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        // Ordenar por prioridade (1 = mais importante, processa primeiro)
        return (data.cidades || []).sort((a, b) => a.prioridade - b.prioridade);
    } catch (err) {
        console.warn('⚠️ Erro ao carregar brazilian-airports.json, usando fallback');
        return [
            { codigo: 'GRU', nome: 'São Paulo (Guarulhos)', estado: 'SP', regiao: 'sudeste', prioridade: 1 },
            { codigo: 'GIG', nome: 'Rio de Janeiro (Galeão)', estado: 'RJ', regiao: 'sudeste', prioridade: 1 },
            { codigo: 'BSB', nome: 'Brasília', estado: 'DF', regiao: 'centro-oeste', prioridade: 1 },
            { codigo: 'CNF', nome: 'Belo Horizonte', estado: 'MG', regiao: 'sudeste', prioridade: 1 },
            { codigo: 'SSA', nome: 'Salvador', estado: 'BA', regiao: 'nordeste', prioridade: 1 },
            { codigo: 'REC', nome: 'Recife', estado: 'PE', regiao: 'nordeste', prioridade: 1 },
            { codigo: 'POA', nome: 'Porto Alegre', estado: 'RS', regiao: 'sul', prioridade: 1 },
            { codigo: 'CWB', nome: 'Curitiba', estado: 'PR', regiao: 'sul', prioridade: 1 },
            { codigo: 'FOR', nome: 'Fortaleza', estado: 'CE', regiao: 'nordeste', prioridade: 1 },
            { codigo: 'VCP', nome: 'Campinas', estado: 'SP', regiao: 'sudeste', prioridade: 1 },
        ];
    }
}

// Determinar qual lote processar baseado na hora UTC
function calcularLote(totalCidades, forcarLote) {
    if (forcarLote !== undefined && forcarLote !== null) {
        const lote = parseInt(forcarLote);
        if (!isNaN(lote) && lote >= 0) return lote;
    }

    // Baseado na hora UTC: cada execução pega o próximo lote
    const hora = new Date().getUTCHours();
    const execucao = Math.floor(hora / 3); // 0-7
    const totalLotes = Math.ceil(totalCidades / CIDADES_POR_LOTE);
    return execucao % totalLotes;
}

const MAX_DESTINOS_POR_ORIGEM = 50;

// Categorias de estilo baseadas em keywords do destino (fallback quando Groq falha)
const ESTILOS_KEYWORDS = {
    praia: ['beach', 'praia', 'litoral', 'costa', 'island', 'ilha', 'cabo', 'porto seguro', 'florianópolis', 'natal', 'maceió', 'cancún', 'punta cana', 'cartagena', 'búzios', 'guarujá', 'ubatuba', 'ilhabela', 'jericoacoara', 'arraial', 'trancoso', 'noronha', 'maragogi', 'san andrés', 'aruba', 'curaçao', 'varadero', 'playa', 'riviera maya', 'bahamas', 'barbados', 'cabo frio'],
    natureza: ['nature', 'natureza', 'serra', 'chapada', 'foz', 'bonito', 'amazônia', 'pantanal', 'lençóis', 'jalapão', 'monte verde', 'brotas', 'socorro', 'urubici', 'patagônia', 'machu picchu', 'galapagos', 'atacama', 'iguaçu', 'falls', 'cachoeira'],
    cidade: ['city', 'cidade', 'urban', 'buenos aires', 'santiago', 'lima', 'montevideo', 'bogotá', 'são paulo', 'new york', 'paris', 'london', 'lisboa', 'madrid', 'barcelona', 'roma', 'milão', 'berlim', 'amsterdam', 'tokyo', 'bangkok'],
    romantico: ['romantic', 'gramado', 'campos do jordão', 'paris', 'veneza', 'venice', 'santorini', 'maldivas', 'monte verde', 'são miguel dos milagres', 'fernando de noronha', 'búzios', 'trancoso'],
    aventura: ['adventure', 'aventura', 'trekking', 'dive', 'surf', 'rapids', 'brotas', 'socorro', 'jalapão', 'chapada', 'rapel', 'trilha'],
    familia: ['family', 'família', 'disney', 'orlando', 'parque', 'theme park', 'resort', 'beto carrero', 'hot park', 'beach park', 'gramado'],
};

// ============================================================
// SUPABASE CLIENT (via REST API, sem SDK adicional)
// ============================================================
async function supabaseInsert(tableName, data) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY)');
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'resolution=merge-duplicates',  // UPSERT: se já existir snapshot do dia, atualiza
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase insert falhou (${response.status}): ${errorText}`);
    }

    return true;
}

// ============================================================
// BUSCA DE DESTINOS — 2 buscas: GLOBAL + PAÍS (Brasil)
// Garante mix balanceado de destinos nacionais e internacionais
// ============================================================
const BRASIL_KGMID = '/m/015fr';
const AMERICA_SUL_KGMID = '/m/0dg3n1';

async function buscarUma(params, label) {
    const queryParts = Object.entries(params).map(([k, v]) => {
        return `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`;
    });
    const url = `https://www.searchapi.io/api/v1/search?${queryParts.join('&')}`;
    const startTime = Date.now();

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });
        const elapsed = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Discovery][${label}] HTTP ${response.status} (${elapsed}ms): ${errorText.substring(0, 200)}`);
            return [];
        }

        const data = await response.json();
        console.log(`[Discovery][${label}] ${(data.destinations || []).length} destinos (${elapsed}ms)`);
        return data.destinations || [];
    } catch (err) {
        console.error(`[Discovery][${label}] Erro: ${err.message}`);
        return [];
    }
}

async function buscarDestinosParaOrigem(origemCode) {
    const apiKey = process.env.SEARCHAPI_KEY;
    if (!apiKey) throw new Error('SEARCHAPI_KEY não configurada');

    const baseParams = {
        engine: 'google_travel_explore',
        api_key: apiKey,
        departure_id: origemCode,
        interests: 'popular',
        currency: 'BRL',
        gl: 'br',
        hl: 'pt-BR',
    };

    // 3 buscas paralelas: GLOBAL + BRASIL + AMÉRICA DO SUL
    const [global, brasil, amSul] = await Promise.all([
        buscarUma(baseParams, `${origemCode}/GLOBAL`),
        buscarUma({ ...baseParams, arrival_id: BRASIL_KGMID }, `${origemCode}/BRASIL`),
        buscarUma({ ...baseParams, arrival_id: AMERICA_SUL_KGMID }, `${origemCode}/AM_SUL`),
    ]);

    // Deduplicar por nome+país, mantendo menor preço
    const map = new Map();
    for (const dest of [...global, ...brasil, ...amSul]) {
        if (!dest?.name || !dest?.country) continue;
        const key = `${dest.name.toLowerCase()}_${dest.country.toLowerCase()}`;
        const price = dest.flight?.price ?? 0;
        if (!map.has(key) || (price > 0 && (map.get(key).flight?.price === 0 || price < map.get(key).flight?.price))) {
            map.set(key, dest);
        }
    }

    console.log(`[Discovery][${origemCode}] Consolidado: ${map.size} únicos (GLOBAL: ${global.length}, BRASIL: ${brasil.length}, AM_SUL: ${amSul.length})`);
    return Array.from(map.values());
}

// ============================================================
// CLASSIFICAR ESTILO DO DESTINO (keyword-based fallback)
// ============================================================
function classificarEstiloKeywords(destino) {
    const nome = (destino.name || '').toLowerCase();
    const pais = (destino.country || '').toLowerCase();
    const texto = `${nome} ${pais}`;

    const estilosEncontrados = [];
    for (const [estilo, keywords] of Object.entries(ESTILOS_KEYWORDS)) {
        if (keywords.some(kw => texto.includes(kw))) {
            estilosEncontrados.push(estilo);
        }
    }

    return estilosEncontrados.length > 0 ? estilosEncontrados : ['cidade'];
}

// ============================================================
// CLASSIFICAR ESTILOS VIA GROQ (batch de destinos)
// ============================================================
async function classificarEstilosGroq(destinosFormatados) {
    if (!process.env.GROQ_API_KEY || destinosFormatados.length === 0) {
        return null; // vai usar fallback keyword
    }

    const lista = destinosFormatados.map((d, i) =>
        `${i}|${d.nome}|${d.pais}|${d.internacional ? 'intl' : 'nac'}`
    ).join('\n');

    const systemMessage = `Você é um classificador de destinos turísticos. Para cada destino, atribua 1-3 estilos da lista:
- praia (destinos litorâneos, ilhas, balneários)
- natureza (serra, parques, ecoturismo, cachoeiras, trilhas)
- cidade (centros urbanos, capitais, cultura, gastronomia, compras)
- romantico (destinos para casais, lua de mel, charme)
- aventura (esportes radicais, trilhas, mergulho, escalada)
- familia (parques temáticos, resorts, praias calmas, atrações para crianças)

Retorne APENAS um JSON: { "classificacoes": [[estilos_destino_0], [estilos_destino_1], ...] }
Cada item é um array de strings. Mantenha a mesma ordem dos destinos.
Se não conhecer o destino, use ["cidade"] como default.`;

    const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

    for (const model of models) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: systemMessage },
                        { role: 'user', content: `Classifique estes ${destinosFormatados.length} destinos:\n${lista}` },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.2,
                    max_tokens: 4000,
                }),
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) {
                console.warn(`⚠️ Groq classificação ${model} HTTP ${response.status}`);
                continue;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) continue;

            const parsed = JSON.parse(content);
            const classificacoes = parsed.classificacoes;

            if (Array.isArray(classificacoes) && classificacoes.length === destinosFormatados.length) {
                console.log(`✅ Groq classificou ${classificacoes.length} destinos (${model})`);
                return classificacoes;
            }

            console.warn(`⚠️ Groq retornou ${classificacoes?.length || 0} classificações, esperava ${destinosFormatados.length}`);
        } catch (err) {
            console.warn(`⚠️ Groq classificação ${model} erro:`, err.message);
        }
    }

    return null; // fallback para keywords
}

// ============================================================
// CALCULAR FAIXA DE DURAÇÃO IDEAL
// ============================================================
function calcularDuracaoIdeal(destino, origemPais) {
    const destinoPais = (destino.country || '').toLowerCase();
    const isInternacional = destinoPais !== origemPais;
    const preco = destino.flight?.price || 0;

    if (isInternacional) {
        return { min: 7, max: 14, ideal: 10 };
    }
    if (preco < 500) {
        return { min: 3, max: 5, ideal: 4 };
    }
    return { min: 5, max: 7, ideal: 7 };
}

// ============================================================
// FORMATAR DESTINO PARA O SNAPSHOT
// ============================================================
function formatarDestino(destino, posicao, origemPais, estilosOverride) {
    const estilos = estilosOverride || classificarEstiloKeywords(destino);
    const duracao = calcularDuracaoIdeal(destino, origemPais);
    const preco = destino.flight?.price || 0;
    const isInternacional = (destino.country || '').toLowerCase() !== origemPais;

    return {
        posicao,
        nome: destino.name || '',
        pais: destino.country || '',
        aeroporto: destino.flight?.airport_code || destino.primary_airport || '',
        preco,
        moeda: 'BRL',
        paradas: destino.flight?.stops || 0,
        duracao_voo_min: destino.flight?.flight_duration_minutes || 0,
        cia_aerea: destino.flight?.airline_name || '',
        custo_noite: destino.avg_cost_per_night || 0,
        imagem: destino.image || '',
        estilos,
        duracao_ideal: duracao,
        internacional: isInternacional,
        data_ida: destino.outbound_date || null,
        data_volta: destino.return_date || null,
    };
}

// ============================================================
// PROCESSAR UMA CIDADE DE ORIGEM
// ============================================================
async function processarOrigem(origem) {
    const startTime = Date.now();
    console.log(`\n🔍 [${origem.codigo}] Buscando destinos para ${origem.nome}...`);

    try {
        const destinosRaw = await buscarDestinosParaOrigem(origem.codigo);
        const elapsed = Date.now() - startTime;

        if (destinosRaw.length === 0) {
            console.log(`⚠️ [${origem.codigo}] Nenhum destino encontrado (${elapsed}ms)`);
            return null;
        }

        // Separar nacionais e internacionais, ambos ordenados por preço
        const comPreco = destinosRaw.filter(d => d.flight?.price > 0);
        const nacionais = comPreco
            .filter(d => (d.country || '').toLowerCase() === 'brasil')
            .sort((a, b) => a.flight.price - b.flight.price);
        const internacionais = comPreco
            .filter(d => (d.country || '').toLowerCase() !== 'brasil')
            .sort((a, b) => a.flight.price - b.flight.price);

        // Garantir mínimo de 10 nacionais (ou todos disponíveis se < 10)
        const MIN_NACIONAIS = 10;
        const nacReservados = nacionais.slice(0, MIN_NACIONAIS);
        const nacRestantes = nacionais.slice(MIN_NACIONAIS);

        // Preencher o resto com os mais baratos (nacionais restantes + internacionais)
        const vagasRestantes = MAX_DESTINOS_POR_ORIGEM - nacReservados.length;
        const pool = [...nacRestantes, ...internacionais]
            .sort((a, b) => a.flight.price - b.flight.price)
            .slice(0, vagasRestantes);

        // Juntar e ordenar tudo por preço
        const selecionados = [...nacReservados, ...pool]
            .sort((a, b) => a.flight.price - b.flight.price);

        // Primeiro formata com keywords (fallback)
        let topDestinos = selecionados.map((d, i) => formatarDestino(d, i + 1, 'brasil'));

        // Tenta classificar via Groq (batch) — muito mais preciso
        try {
            const classificacoesGroq = await classificarEstilosGroq(topDestinos);
            if (classificacoesGroq) {
                const estilosValidos = ['praia', 'natureza', 'cidade', 'romantico', 'aventura', 'familia'];
                topDestinos = topDestinos.map((d, i) => {
                    const estilosGroq = (classificacoesGroq[i] || []).filter(e => estilosValidos.includes(e));
                    return { ...d, estilos: estilosGroq.length > 0 ? estilosGroq : d.estilos };
                });
                console.log(`🧠 [${origem.codigo}] Estilos classificados via Groq`);
            }
        } catch (groqErr) {
            console.warn(`⚠️ [${origem.codigo}] Groq classificação falhou, usando keywords:`, groqErr.message);
        }

        const totalNac = topDestinos.filter(d => !d.internacional).length;
        const totalIntl = topDestinos.filter(d => d.internacional).length;

        console.log(`✅ [${origem.codigo}] ${topDestinos.length} destinos (${totalNac} nacionais, ${totalIntl} internacionais) (${elapsed}ms) | Mais barato: R$${topDestinos[0]?.preco || '?'}`);

        // Montar snapshot
        const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return {
            data: hoje,
            origem: origem.codigo,
            origem_nome: origem.nome,
            tipo: 'destinos-baratos',
            destinos: topDestinos,
            total_destinos: topDestinos.length,
            moeda: 'BRL',
        };
    } catch (error) {
        console.error(`❌ [${origem.codigo}] Erro:`, error.message);
        return null;
    }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Segurança: verificar CRON_SECRET para chamadas manuais
    // Vercel Cron envia automaticamente o header correto
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;

    // Permitir acesso via: Vercel Cron (auth header) OU query param (?key=xxx)
    const queryKey = req.query?.key;
    const isVercelCron = authHeader === `Bearer ${cronSecret}`;
    const isManualWithKey = queryKey && queryKey === cronSecret;

    if (cronSecret && !isVercelCron && !isManualWithKey) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    // Carregar cidades e calcular lote
    const todasCidades = carregarCidades();
    const loteForcar = req.query?.lote;
    const loteIndex = calcularLote(todasCidades.length, loteForcar);
    const inicio = loteIndex * CIDADES_POR_LOTE;
    const cidadesDoLote = todasCidades.slice(inicio, inicio + CIDADES_POR_LOTE);
    const totalLotes = Math.ceil(todasCidades.length / CIDADES_POR_LOTE);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 DISCOVERY CRON v2.0 - Início: ${new Date().toISOString()}`);
    console.log(`📦 Lote ${loteIndex + 1}/${totalLotes} (cidades ${inicio + 1}-${inicio + cidadesDoLote.length} de ${todasCidades.length})`);
    console.log(`🏙️ Cidades: ${cidadesDoLote.map(c => c.codigo).join(', ')}`);
    console.log(`${'='.repeat(60)}`);

    if (cidadesDoLote.length === 0) {
        return res.status(200).json({
            success: true,
            message: `Lote ${loteIndex + 1} vazio (total: ${todasCidades.length} cidades)`,
        });
    }

    const startTime = Date.now();
    const resultados = { sucesso: 0, falha: 0, detalhes: [], lote: loteIndex + 1, totalLotes };

    // Processar cidades do lote em paralelo (máx 3 por vez para não sobrecarregar)
    const batchSize = 3;
    for (let i = 0; i < cidadesDoLote.length; i += batchSize) {
        const batch = cidadesDoLote.slice(i, i + batchSize);
        const promises = batch.map(cidade => processarOrigem(cidade));
        const snapshots = await Promise.all(promises);

        // Salvar no Supabase
        for (const snapshot of snapshots) {
            if (!snapshot) {
                resultados.falha++;
                continue;
            }

            try {
                await supabaseInsert('discovery_snapshots', snapshot);
                resultados.sucesso++;
                resultados.detalhes.push({
                    origem: snapshot.origem,
                    destinos: snapshot.total_destinos,
                    status: 'ok',
                });
                console.log(`💾 [${snapshot.origem}] Salvo no Supabase (${snapshot.total_destinos} destinos)`);
            } catch (error) {
                resultados.falha++;
                resultados.detalhes.push({
                    origem: snapshot.origem,
                    status: 'erro',
                    mensagem: error.message,
                });
                console.error(`❌ [${snapshot.origem}] Erro ao salvar:`, error.message);
            }
        }
    }

    const totalTime = Date.now() - startTime;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ DISCOVERY CRON v2.0 - Lote ${loteIndex + 1}/${totalLotes} completo em ${totalTime}ms`);
    console.log(`   Sucesso: ${resultados.sucesso} | Falha: ${resultados.falha}`);
    console.log(`${'='.repeat(60)}\n`);

    return res.status(200).json({
        success: true,
        message: `Lote ${loteIndex + 1}/${totalLotes}: ${resultados.sucesso} origens processadas`,
        totalTime,
        resultados,
    });
}
