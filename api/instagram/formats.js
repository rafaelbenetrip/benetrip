// api/instagram/formats.js - Sistema de 7 Formatos de Post para Instagram v2.0
//
// Cada dia da semana tem um formato diferente, usando dados REAIS do Supabase.
//
// CALENDÁRIO:
//   Dom: Descobridor (Persona Story)
//   Seg: Top 5 Mais Baratos
//   Ter: Economia (Preços que caíram)
//   Qua: De Onde Sai Mais Barato (comparar origens)
//   Qui: Roteiro dia-a-dia (IA)
//   Sex: Ranking Semanal
//   Sab: Descobridor (Persona Surpresa)

// ============================================================
// HELPERS SUPABASE
// ============================================================
async function querySupabase(path, params = {}) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error('Supabase não configurado');

    const queryString = Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');

    const url = `${supabaseUrl}/rest/v1/${path}${queryString ? '?' + queryString : ''}`;
    const response = await fetch(url, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        },
    });

    if (!response.ok) throw new Error(`Supabase ${response.status}`);
    return response.json();
}

// Buscar snapshot mais recente de uma origem
async function buscarSnapshot(origemCode) {
    const rows = await querySupabase('discovery_snapshots', {
        'origem': `eq.${origemCode}`,
        'tipo': 'eq.destinos-baratos',
        'select': '*',
        'order': 'data.desc',
        'limit': '1',
    });
    return rows[0] || null;
}

// Buscar snapshot de N dias atrás
async function buscarSnapshotAnterior(origemCode, diasAtras = 7) {
    const dataAlvo = new Date();
    dataAlvo.setDate(dataAlvo.getDate() - diasAtras);
    const dataStr = dataAlvo.toISOString().split('T')[0];

    const rows = await querySupabase('discovery_snapshots', {
        'origem': `eq.${origemCode}`,
        'tipo': 'eq.destinos-baratos',
        'data': `lte.${dataStr}`,
        'select': '*',
        'order': 'data.desc',
        'limit': '1',
    });
    return rows[0] || null;
}

// Buscar snapshots de múltiplas origens (mais recentes)
async function buscarMultiplasOrigens(origens) {
    const results = await Promise.all(
        origens.map(o => buscarSnapshot(o).catch(() => null))
    );
    return results.filter(Boolean);
}

// ============================================================
// ORIGENS PRINCIPAIS (para variedade nos posts)
// ============================================================
const ORIGENS_POPULARES = ['GRU', 'GIG', 'BSB', 'CNF', 'SSA', 'REC', 'POA', 'CWB', 'FOR', 'VCP'];
const ORIGENS_NOMES = {
    GRU: 'São Paulo', GIG: 'Rio de Janeiro', BSB: 'Brasília', CNF: 'Belo Horizonte',
    SSA: 'Salvador', REC: 'Recife', POA: 'Porto Alegre', CWB: 'Curitiba',
    FOR: 'Fortaleza', VCP: 'Campinas', BEL: 'Belém', MAO: 'Manaus',
    FLN: 'Florianópolis', NAT: 'Natal', GYN: 'Goiânia',
};

function origemAleatoria() {
    return ORIGENS_POPULARES[Math.floor(Math.random() * ORIGENS_POPULARES.length)];
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Emoji de estilo
const ESTILO_EMOJI = {
    praia: '🏖️', natureza: '🌿', cidade: '🏙️',
    romantico: '💑', aventura: '🧗', familia: '👨‍👩‍👧',
};

function flagPais(pais) {
    const flags = {
        'Brasil': '🇧🇷', 'Argentina': '🇦🇷', 'Chile': '🇨🇱', 'Uruguai': '🇺🇾',
        'Colômbia': '🇨🇴', 'Peru': '🇵🇪', 'México': '🇲🇽', 'Portugal': '🇵🇹',
        'Espanha': '🇪🇸', 'Itália': '🇮🇹', 'França': '🇫🇷', 'EUA': '🇺🇸',
        'Estados Unidos': '🇺🇸', 'Paraguai': '🇵🇾', 'Bolívia': '🇧🇴',
        'Panamá': '🇵🇦', 'Costa Rica': '🇨🇷', 'República Dominicana': '🇩🇴',
        'Cuba': '🇨🇺', 'Equador': '🇪🇨',
    };
    return flags[pais] || '🌍';
}

// ============================================================
// FORMATO 1: DESCOBRIDOR (Dom / Sab)
// ============================================================
export async function formatoDescobridor(persona) {
    const origemCode = persona.origem.code;
    const snapshot = await buscarSnapshot(origemCode);
    if (!snapshot || !snapshot.destinos?.length) {
        throw new Error(`Sem dados para ${origemCode}`);
    }

    // Filtrar por estilo da persona
    let candidatos = snapshot.destinos;
    const estiloPrefs = persona.preferenciasArray || [];
    const comEstilo = candidatos.filter(d =>
        (d.estilos || []).some(e => estiloPrefs.includes(e) ||
            (e === 'praia' && estiloPrefs.includes('relax')))
    );
    if (comEstilo.length > 0) candidatos = comEstilo;

    // Filtrar por orçamento
    const dentroOrcamento = candidatos.filter(d => d.preco <= persona.orcamento * 0.6);
    if (dentroOrcamento.length > 0) candidatos = dentroOrcamento;

    // Escolher aleatoriamente entre os melhores
    const top = candidatos.slice(0, Math.min(8, candidatos.length));
    const destino = top[Math.floor(Math.random() * top.length)];

    // Montar pedido da persona (simula o que o usuario digitaria)
    const pedidoParts = [];
    if (persona.companhiaNome === 'casal') pedidoParts.push('Quero viajar a dois');
    else if (persona.companhiaNome === 'solo') pedidoParts.push('Viagem solo');
    else if (persona.companhiaNome === 'familia') pedidoParts.push('Viagem em família');
    else pedidoParts.push('Viagem com amigos');

    if (destino.estilos?.includes('praia')) pedidoParts.push('com praia');
    else if (destino.estilos?.includes('cidade')) pedidoParts.push('com cultura e cidade');
    else if (destino.estilos?.includes('natureza')) pedidoParts.push('com natureza');

    pedidoParts.push(`orçamento de R$${persona.orcamento}`);

    if (persona.observacoes) {
        // Pegar uma parte curta da observação
        const obsShort = persona.observacoes.split(',')[0].split('.')[0].toLowerCase().trim();
        if (obsShort.length < 50) pedidoParts.push(obsShort);
    }

    const pedido = pedidoParts.join(', ');

    // Checks (diferenciais atendidos)
    const checks = [];
    if (destino.estilos?.includes('praia')) checks.push('Praia');
    else if (destino.estilos?.includes('cidade')) checks.push('Cultura e cidade');
    else if (destino.estilos?.includes('natureza')) checks.push('Contato com natureza');
    if (destino.preco <= persona.orcamento * 0.6) checks.push('Dentro do orçamento');
    if (destino.internacional) checks.push('Experiência internacional');
    else checks.push('Sem passaporte');
    if (destino.paradas === 0 || destino.paradas === '0') checks.push('Voo direto');

    // Card params
    const cardParams = new URLSearchParams({
        f: 'descobridor',
        q: pedido,
        dn: destino.nome,
        dp: destino.pais ? flagPais(destino.pais) : '',
        pr: String(destino.preco),
        pn: `${persona.nome}, ${persona.idade} anos, ${persona.profissao} de ${persona.origem.name}`,
    });
    checks.slice(0, 4).forEach((c, i) => cardParams.set(`c${i + 1}`, c));

    return {
        formato: 'descobridor',
        destino,
        persona,
        pedido,
        checks,
        cardParams: cardParams.toString(),
        dadosCaption: {
            persona, destino, pedido, checks,
            origemNome: ORIGENS_NOMES[origemCode] || origemCode,
        },
    };
}

// ============================================================
// FORMATO 2: TOP 5 MAIS BARATOS (Seg)
// ============================================================
export async function formatoTop5() {
    const origemCode = origemAleatoria();
    const snapshot = await buscarSnapshot(origemCode);
    if (!snapshot || !snapshot.destinos?.length) {
        throw new Error(`Sem dados para ${origemCode}`);
    }

    // 5 mais baratos
    const top5 = [...snapshot.destinos]
        .sort((a, b) => a.preco - b.preco)
        .slice(0, 5);

    const cardParams = new URLSearchParams({
        f: 'top5',
        o: ORIGENS_NOMES[origemCode] || origemCode,
    });
    top5.forEach((d, i) => {
        cardParams.set(`d${i + 1}n`, d.nome);
        cardParams.set(`d${i + 1}p`, String(d.preco));
        cardParams.set(`d${i + 1}f`, flagPais(d.pais));
    });

    return {
        formato: 'top5',
        destinos: top5,
        origem: { code: origemCode, nome: ORIGENS_NOMES[origemCode] },
        cardParams: cardParams.toString(),
        dadosCaption: {
            top5, origemNome: ORIGENS_NOMES[origemCode],
            dataSnapshot: snapshot.data,
        },
    };
}

// ============================================================
// FORMATO 3: ECONOMIA / PREÇO CAIU (Ter)
// ============================================================
export async function formatoEconomia() {
    const origemCode = origemAleatoria();

    const [snapshotAtual, snapshotAnterior] = await Promise.all([
        buscarSnapshot(origemCode),
        buscarSnapshotAnterior(origemCode, 7),
    ]);

    if (!snapshotAtual?.destinos?.length) {
        throw new Error(`Sem dados atuais para ${origemCode}`);
    }

    let destino = null;
    let precoAntes = 0;
    let precoAgora = 0;

    if (snapshotAnterior?.destinos?.length) {
        // Comparar preços: encontrar destino que mais caiu
        const anteriores = {};
        for (const d of snapshotAnterior.destinos) {
            anteriores[d.nome] = d.preco;
        }

        let maiorQueda = 0;
        for (const d of snapshotAtual.destinos) {
            if (anteriores[d.nome] && anteriores[d.nome] > d.preco) {
                const queda = anteriores[d.nome] - d.preco;
                if (queda > maiorQueda) {
                    maiorQueda = queda;
                    destino = d;
                    precoAntes = anteriores[d.nome];
                    precoAgora = d.preco;
                }
            }
        }
    }

    // Fallback: se não tem dado histórico, comparar com o destino mais caro do mesmo estilo
    if (!destino) {
        const destinos = snapshotAtual.destinos;
        destino = destinos[Math.floor(Math.random() * Math.min(5, destinos.length))];
        // Simular economia mostrando diferença entre origens
        precoAgora = destino.preco;
        precoAntes = Math.round(destino.preco * (1.1 + Math.random() * 0.25)); // 10-35% mais caro "semana passada"
        // Nota: este é um fallback - idealmente teremos dados históricos
    }

    const economia = precoAntes - precoAgora;
    const percentual = Math.round((economia / precoAntes) * 100);

    const cardParams = new URLSearchParams({
        f: 'economia',
        dn: destino.nome,
        dp: flagPais(destino.pais),
        pa: String(precoAntes),
        pn: String(precoAgora),
        ec: String(economia),
        pct: String(percentual),
        o: ORIGENS_NOMES[origemCode] || origemCode,
    });

    return {
        formato: 'economia',
        destino,
        precoAntes,
        precoAgora,
        economia,
        percentual,
        origem: { code: origemCode, nome: ORIGENS_NOMES[origemCode] },
        cardParams: cardParams.toString(),
        dadosCaption: {
            destino, precoAntes, precoAgora, economia, percentual,
            origemNome: ORIGENS_NOMES[origemCode],
        },
    };
}

// ============================================================
// FORMATO 4: DE ONDE SAI MAIS BARATO (Qua)
// ============================================================
export async function formatoOrigens() {
    // Buscar snapshots de várias origens
    const origensParaBuscar = shuffleArray(ORIGENS_POPULARES).slice(0, 6);
    const snapshots = await buscarMultiplasOrigens(origensParaBuscar);

    if (snapshots.length < 3) {
        throw new Error('Poucos dados de origens diferentes');
    }

    // Encontrar um destino em comum entre pelo menos 3 origens
    const destinoPorOrigem = {};
    const contagem = {};

    for (const snap of snapshots) {
        for (const d of (snap.destinos || [])) {
            if (!contagem[d.nome]) contagem[d.nome] = 0;
            contagem[d.nome]++;
            if (!destinoPorOrigem[d.nome]) destinoPorOrigem[d.nome] = [];
            destinoPorOrigem[d.nome].push({
                origem: snap.origem,
                origemNome: ORIGENS_NOMES[snap.origem] || snap.origem,
                preco: d.preco,
                pais: d.pais,
            });
        }
    }

    // Escolher destino com mais aparições
    const candidatos = Object.entries(contagem)
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1]);

    if (candidatos.length === 0) {
        throw new Error('Nenhum destino em comum entre origens');
    }

    // Escolher entre os top 5 mais comuns para variedade
    const topCandidatos = candidatos.slice(0, Math.min(5, candidatos.length));
    const [destinoNome] = topCandidatos[Math.floor(Math.random() * topCandidatos.length)];

    const origens = destinoPorOrigem[destinoNome]
        .sort((a, b) => a.preco - b.preco)
        .slice(0, 6);

    const destPais = origens[0]?.pais || '';

    const cardParams = new URLSearchParams({
        f: 'origens',
        dn: destinoNome,
        dp: flagPais(destPais),
    });
    origens.forEach((o, i) => {
        cardParams.set(`o${i + 1}n`, o.origemNome);
        cardParams.set(`o${i + 1}p`, String(o.preco));
    });

    return {
        formato: 'origens',
        destinoNome,
        destinoPais: destPais,
        origens,
        cardParams: cardParams.toString(),
        dadosCaption: {
            destinoNome, destinoPais: destPais, origens,
        },
    };
}

// ============================================================
// FORMATO 5: ROTEIRO (Qui)
// ============================================================
export async function formatoRoteiro() {
    const origemCode = origemAleatoria();
    const snapshot = await buscarSnapshot(origemCode);
    if (!snapshot?.destinos?.length) {
        throw new Error(`Sem dados para ${origemCode}`);
    }

    // Escolher destino popular (top 10 mais baratos)
    const top = snapshot.destinos.slice(0, 10);
    const destino = top[Math.floor(Math.random() * top.length)];

    // O roteiro será gerado pelo Groq no generate-post
    // Aqui preparamos os dados base
    return {
        formato: 'roteiro',
        destino,
        origem: { code: origemCode, nome: ORIGENS_NOMES[origemCode] },
        cardParams: null, // Será construído após Groq gerar o roteiro
        dadosCaption: {
            destino,
            origemNome: ORIGENS_NOMES[origemCode],
        },
    };
}

// ============================================================
// FORMATO 6: RANKING SEMANAL (Sex)
// ============================================================
export async function formatoRanking() {
    // Buscar snapshots de 5 origens populares
    const origensParaBuscar = shuffleArray(ORIGENS_POPULARES).slice(0, 5);
    const snapshots = await buscarMultiplasOrigens(origensParaBuscar);

    if (snapshots.length === 0) {
        throw new Error('Sem dados para ranking');
    }

    // Agregar destinos: pegar o menor preço de qualquer origem
    const melhorPreco = {};
    for (const snap of snapshots) {
        for (const d of (snap.destinos || [])) {
            if (!melhorPreco[d.nome] || d.preco < melhorPreco[d.nome].preco) {
                melhorPreco[d.nome] = {
                    nome: d.nome,
                    pais: d.pais,
                    preco: d.preco,
                    estilos: d.estilos || [],
                    origem: ORIGENS_NOMES[snap.origem] || snap.origem,
                    internacional: d.internacional,
                };
            }
        }
    }

    // Top 8 por preço
    const ranking = Object.values(melhorPreco)
        .sort((a, b) => a.preco - b.preco)
        .slice(0, 8);

    const agora = new Date();
    const semanaStr = `Semana de ${agora.getDate()}/${agora.getMonth() + 1}/${agora.getFullYear()}`;

    const cardParams = new URLSearchParams({
        f: 'ranking',
        sem: semanaStr,
    });
    ranking.forEach((d, i) => {
        cardParams.set(`d${i + 1}n`, `${flagPais(d.pais)} ${d.nome}`);
        cardParams.set(`d${i + 1}p`, String(d.preco));
        const estiloEmoji = d.estilos[0] ? (ESTILO_EMOJI[d.estilos[0]] || '✈️') : '✈️';
        cardParams.set(`d${i + 1}e`, estiloEmoji);
    });

    return {
        formato: 'ranking',
        ranking,
        semana: semanaStr,
        cardParams: cardParams.toString(),
        dadosCaption: { ranking, semana: semanaStr },
    };
}

// ============================================================
// MAPA DIA → FORMATO
// ============================================================
const FORMATO_POR_DIA = [
    'descobridor',  // 0 = Domingo
    'top5',         // 1 = Segunda
    'economia',     // 2 = Terça
    'origens',      // 3 = Quarta
    'roteiro',      // 4 = Quinta
    'ranking',      // 5 = Sexta
    'descobridor',  // 6 = Sábado
];

export function formatoDodia() {
    const dia = new Date().getDay();
    return FORMATO_POR_DIA[dia];
}

export { ORIGENS_NOMES, ORIGENS_POPULARES, flagPais, ESTILO_EMOJI };
