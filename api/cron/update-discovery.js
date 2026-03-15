// api/cron/update-discovery.js - BENETRIP DISCOVERY CRON v1.0
// Roda automaticamente via Vercel Cron (todo dia às 6h BRT)
// Busca destinos baratos para as principais cidades brasileiras
// e salva snapshots no Supabase para consulta rápida + histórico
//
// COMO FUNCIONA:
// 1. Para cada cidade de origem, chama a SearchAPI (google_travel_explore)
// 2. Formata os top destinos com preço, duração, estilo
// 3. Salva no Supabase (tabela discovery_snapshots)
// 4. O snapshot anterior permanece = histórico automático
//
// TRIGGER: Vercel Cron configurado em vercel.json
// MANUAL:  GET /api/cron/update-discovery?key=CRON_SECRET

import { readFileSync } from 'fs';
import { join } from 'path';

export const maxDuration = 300; // 5 minutos (busca múltiplas cidades)

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const ORIGENS = [
    { codigo: 'GRU', nome: 'São Paulo', kgmid: '/m/022pfm' },
    { codigo: 'GIG', nome: 'Rio de Janeiro', kgmid: '/m/06gmr' },
    { codigo: 'BSB', nome: 'Brasília', kgmid: '/m/01ky2c' },
    { codigo: 'CNF', nome: 'Belo Horizonte', kgmid: '/m/01nmhq' },
    { codigo: 'SSA', nome: 'Salvador', kgmid: '' },
    { codigo: 'REC', nome: 'Recife', kgmid: '' },
    { codigo: 'POA', nome: 'Porto Alegre', kgmid: '' },
    { codigo: 'CWB', nome: 'Curitiba', kgmid: '' },
    { codigo: 'FOR', nome: 'Fortaleza', kgmid: '' },
    { codigo: 'VCP', nome: 'Campinas', kgmid: '' },
];

const MAX_DESTINOS_POR_ORIGEM = 20;

// Categorias de estilo baseadas em keywords do destino
const ESTILOS = {
    praia: ['beach', 'praia', 'litoral', 'costa', 'island', 'ilha', 'cabo', 'porto seguro', 'florianópolis', 'natal', 'maceió', 'cancún', 'punta cana', 'cartagena'],
    natureza: ['nature', 'natureza', 'serra', 'chapada', 'foz', 'bonito', 'amazônia', 'pantanal', 'lençóis', 'jalapão', 'monte verde'],
    cidade: ['city', 'cidade', 'urban', 'buenos aires', 'santiago', 'lima', 'montevideo', 'bogotá', 'são paulo', 'new york', 'paris', 'london', 'lisboa', 'madrid', 'barcelona'],
    romantico: ['romantic', 'gramado', 'campos do jordão', 'paris', 'veneza', 'venice', 'santorini', 'maldivas'],
    aventura: ['adventure', 'aventura', 'trekking', 'dive', 'surf', 'rapids'],
    familia: ['family', 'família', 'disney', 'orlando', 'parque', 'theme park'],
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
// BUSCA DE DESTINOS (reutiliza lógica do search-destinations)
// ============================================================
async function buscarDestinosParaOrigem(origemCode) {
    const apiKey = process.env.SEARCHAPI_KEY;
    if (!apiKey) throw new Error('SEARCHAPI_KEY não configurada');

    const params = {
        engine: 'google_travel_explore',
        api_key: apiKey,
        departure_id: origemCode,
        interests: 'popular',
        currency: 'BRL',
        gl: 'br',
        hl: 'pt-BR',
    };

    const queryParts = Object.entries(params).map(([k, v]) => {
        return `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`;
    });
    const url = `https://www.searchapi.io/api/v1/search?${queryParts.join('&')}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Discovery][${origemCode}] HTTP ${response.status}: ${errorText.substring(0, 200)}`);
        return [];
    }

    const data = await response.json();
    return data.destinations || [];
}

// ============================================================
// CLASSIFICAR ESTILO DO DESTINO
// ============================================================
function classificarEstilo(destino) {
    const nome = (destino.name || '').toLowerCase();
    const pais = (destino.country || '').toLowerCase();
    const texto = `${nome} ${pais}`;

    const estilosEncontrados = [];
    for (const [estilo, keywords] of Object.entries(ESTILOS)) {
        if (keywords.some(kw => texto.includes(kw))) {
            estilosEncontrados.push(estilo);
        }
    }

    // Default: se não identificou, assume "cidade"
    return estilosEncontrados.length > 0 ? estilosEncontrados : ['cidade'];
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
function formatarDestino(destino, posicao, origemPais) {
    const estilos = classificarEstilo(destino);
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

        // Ordenar por preço (menor primeiro), remover sem preço
        const comPreco = destinosRaw.filter(d => d.flight?.price > 0);
        comPreco.sort((a, b) => (a.flight?.price || 0) - (b.flight?.price || 0));

        // Pegar os top N
        const topDestinos = comPreco
            .slice(0, MAX_DESTINOS_POR_ORIGEM)
            .map((d, i) => formatarDestino(d, i + 1, 'brasil'));

        console.log(`✅ [${origem.codigo}] ${topDestinos.length} destinos formatados (${elapsed}ms) | Mais barato: R$${topDestinos[0]?.preco || '?'}`);

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

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 DISCOVERY CRON - Início: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}`);

    const startTime = Date.now();
    const resultados = { sucesso: 0, falha: 0, detalhes: [] };

    // Processar todas as origens em paralelo (máx 3 por vez para não sobrecarregar)
    const batchSize = 3;
    for (let i = 0; i < ORIGENS.length; i += batchSize) {
        const batch = ORIGENS.slice(i, i + batchSize);
        const promises = batch.map(origem => processarOrigem(origem));
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
    console.log(`✅ DISCOVERY CRON - Completo em ${totalTime}ms`);
    console.log(`   Sucesso: ${resultados.sucesso} | Falha: ${resultados.falha}`);
    console.log(`${'='.repeat(60)}\n`);

    return res.status(200).json({
        success: true,
        message: `Discovery atualizado: ${resultados.sucesso} origens processadas`,
        totalTime,
        resultados,
    });
}
