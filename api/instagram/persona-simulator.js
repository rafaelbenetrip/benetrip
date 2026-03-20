// api/instagram/persona-simulator.js - Simulador de Personas v1.0
// Gera personas aleatórias que simulam usuários reais do descobridor de destinos
// Cada persona tem: origem, companhia de viagem, preferências, orçamento, etc.

// Principais cidades de origem (mesmas do descobridor)
const ORIGENS = [
    { code: 'GRU', name: 'São Paulo', state: 'SP' },
    { code: 'GIG', name: 'Rio de Janeiro', state: 'RJ' },
    { code: 'BSB', name: 'Brasília', state: 'DF' },
    { code: 'CNF', name: 'Belo Horizonte', state: 'MG' },
    { code: 'SSA', name: 'Salvador', state: 'BA' },
    { code: 'REC', name: 'Recife', state: 'PE' },
    { code: 'POA', name: 'Porto Alegre', state: 'RS' },
    { code: 'CWB', name: 'Curitiba', state: 'PR' },
    { code: 'FOR', name: 'Fortaleza', state: 'CE' },
    { code: 'VCP', name: 'Campinas', state: 'SP' },
    { code: 'BEL', name: 'Belém', state: 'PA' },
    { code: 'MAO', name: 'Manaus', state: 'AM' },
    { code: 'FLN', name: 'Florianópolis', state: 'SC' },
    { code: 'NAT', name: 'Natal', state: 'RN' },
    { code: 'GYN', name: 'Goiânia', state: 'GO' },
];

// Tipos de companhia (espelhando o descobridor)
const COMPANHIAS = [
    { id: 0, nome: 'solo', label: 'Viajante Solo', emoji: '🎒' },
    { id: 1, nome: 'casal', label: 'Casal', emoji: '💑' },
    { id: 2, nome: 'familia', label: 'Família', emoji: '👨‍👩‍👧‍👦' },
    { id: 3, nome: 'amigos', label: 'Grupo de Amigos', emoji: '👯' },
];

// Preferências de viagem (espelhando o descobridor)
const PREFERENCIAS = ['relax', 'aventura', 'cultura', 'urbano'];

// Nomes fictícios para dar personalidade
const NOMES = [
    'Ana', 'Pedro', 'Mariana', 'Lucas', 'Julia', 'Rafael', 'Beatriz', 'Carlos',
    'Fernanda', 'Thiago', 'Camila', 'Bruno', 'Larissa', 'Diego', 'Gabriela',
    'Matheus', 'Isabella', 'Leonardo', 'Amanda', 'Rodrigo', 'Letícia', 'Gustavo',
    'Daniela', 'André', 'Natália', 'Felipe', 'Priscila', 'Vinícius', 'Patrícia', 'Henrique',
];

// Profissões para contexto
const PROFISSOES = [
    'designer', 'professor(a)', 'engenheiro(a)', 'médico(a)', 'advogado(a)',
    'programador(a)', 'jornalista', 'arquiteto(a)', 'nutricionista', 'fotógrafo(a)',
    'empreendedor(a)', 'estudante', 'publicitário(a)', 'enfermeiro(a)', 'psicólogo(a)',
    'contador(a)', 'músico(a)', 'chef de cozinha', 'veterinário(a)', 'farmacêutico(a)',
];

// Faixas de orçamento por pessoa
const ORCAMENTOS = [
    { min: 500, max: 1000, label: 'econômico' },
    { min: 1000, max: 2000, label: 'moderado' },
    { min: 2000, max: 3500, label: 'confortável' },
    { min: 3500, max: 6000, label: 'premium' },
];

// Observações temáticas (simulando o campo livre do descobridor)
const OBSERVACOES_TEMPLATES = {
    solo: [
        'Quero conhecer pessoas novas e ter experiências únicas',
        'Preciso de um tempo para mim, desconectar do trabalho',
        'Amo fazer trilhas e explorar a cidade a pé',
        'Gosto de hostel com boa vibe social',
        'Quero praticar outro idioma e conhecer a cultura local',
    ],
    casal: [
        'Queremos um lugar romântico para comemorar nosso aniversário',
        'Procuramos um destino com boa gastronomia e vinho',
        'Lua de mel! Queremos algo especial e inesquecível',
        'Gostamos de praia e passeios tranquilos juntos',
        'Buscamos aventura a dois, algo diferente do usual',
    ],
    familia: [
        'Viajando com crianças pequenas, precisa ter estrutura',
        'Queremos um lugar seguro e com atividades para todas as idades',
        'As crianças adoram praia e parques aquáticos',
        'Buscamos um resort all-inclusive para relaxar em família',
        'Primeira viagem internacional com os filhos',
    ],
    amigos: [
        'Grupo de 4 amigos querendo curtir muito!',
        'Viagem de formatura, queremos festa e praia',
        'Amigos de infância se reunindo, algo épico!',
        'Buscamos aventura e vida noturna',
        'Queremos um destino com esportes radicais e diversão',
    ],
};

// Escopos de destino
const ESCOPOS = ['tanto_faz', 'nacional', 'internacional'];

function escolherAleatorio(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function escolherMultiplos(arr, min = 1, max = 3) {
    const quantidade = min + Math.floor(Math.random() * (max - min + 1));
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(quantidade, arr.length));
}

/**
 * Gera uma persona aleatória que simula um usuário do descobridor de destinos.
 * @returns {Object} Persona com todos os campos do questionário do descobridor
 */
export function gerarPersona() {
    const companhia = escolherAleatorio(COMPANHIAS);
    const orcamento = escolherAleatorio(ORCAMENTOS);
    const nome = escolherAleatorio(NOMES);
    const profissao = escolherAleatorio(PROFISSOES);
    const origem = escolherAleatorio(ORIGENS);
    const preferencias = escolherMultiplos(PREFERENCIAS, 1, 2);
    const escopo = escolherAleatorio(ESCOPOS);
    const observacao = escolherAleatorio(OBSERVACOES_TEMPLATES[companhia.nome]);

    // Gerar número de viajantes baseado na companhia
    let adultos = 1, criancas = 0, bebes = 0;
    switch (companhia.id) {
        case 0: // solo
            adultos = 1;
            break;
        case 1: // casal
            adultos = 2;
            break;
        case 2: // familia
            adultos = 2;
            criancas = 1 + Math.floor(Math.random() * 3); // 1-3 crianças
            bebes = Math.random() > 0.7 ? 1 : 0;
            break;
        case 3: // amigos
            adultos = 3 + Math.floor(Math.random() * 4); // 3-6 amigos
            break;
    }

    // Gerar datas de viagem (próximos 30-90 dias)
    const diasAteIda = 30 + Math.floor(Math.random() * 60);
    const duracaoViagem = companhia.id === 2 ? 7 + Math.floor(Math.random() * 7) : 5 + Math.floor(Math.random() * 10);
    const dataIda = new Date();
    dataIda.setDate(dataIda.getDate() + diasAteIda);
    const dataVolta = new Date(dataIda);
    dataVolta.setDate(dataVolta.getDate() + duracaoViagem);

    return {
        // Identidade da persona
        nome,
        profissao,
        idade: 22 + Math.floor(Math.random() * 40), // 22-61 anos

        // Campos do questionário do descobridor
        origem: {
            code: origem.code,
            name: origem.name,
            state: origem.state,
        },
        companhia: companhia.id,
        companhiaNome: companhia.nome,
        companhiaLabel: companhia.label,
        companhiaEmoji: companhia.emoji,
        adultos,
        criancas,
        bebes,
        numPessoas: adultos + criancas + bebes,
        preferencias: preferencias.join(','),
        preferenciasArray: preferencias,
        escopoDestino: escopo,
        moeda: 'BRL',
        orcamento: orcamento.min + Math.floor(Math.random() * (orcamento.max - orcamento.min)),
        orcamentoLabel: orcamento.label,
        observacoes: observacao,

        // Datas
        dataIda: dataIda.toISOString().split('T')[0],
        dataVolta: dataVolta.toISOString().split('T')[0],
        duracaoViagem,

        // Metadados
        geradoEm: new Date().toISOString(),
    };
}

/**
 * Gera uma persona com tendência para um estilo específico.
 * Útil para variar os posts ao longo da semana.
 * @param {string} estiloPreferido - 'praia', 'cidade', 'natureza', 'aventura', etc.
 * @returns {Object} Persona orientada para o estilo
 */
export function gerarPersonaComEstilo(estiloPreferido) {
    const persona = gerarPersona();

    // Ajustar preferências baseado no estilo
    const mapeamento = {
        praia: ['relax'],
        natureza: ['aventura'],
        cidade: ['cultura', 'urbano'],
        romantico: ['relax', 'cultura'],
        aventura: ['aventura'],
        familia: ['relax'],
    };

    const prefsDoEstilo = mapeamento[estiloPreferido] || ['cultura'];
    persona.preferencias = prefsDoEstilo.join(',');
    persona.preferenciasArray = prefsDoEstilo;
    persona.estiloForçado = estiloPreferido;

    // Se é romântico, forçar casal
    if (estiloPreferido === 'romantico') {
        const casal = COMPANHIAS[1];
        persona.companhia = casal.id;
        persona.companhiaNome = casal.nome;
        persona.companhiaLabel = casal.label;
        persona.companhiaEmoji = casal.emoji;
        persona.adultos = 2;
        persona.criancas = 0;
        persona.bebes = 0;
        persona.numPessoas = 2;
        persona.observacoes = escolherAleatorio(OBSERVACOES_TEMPLATES.casal);
    }

    // Se é família, forçar família
    if (estiloPreferido === 'familia') {
        const familia = COMPANHIAS[2];
        persona.companhia = familia.id;
        persona.companhiaNome = familia.nome;
        persona.companhiaLabel = familia.label;
        persona.companhiaEmoji = familia.emoji;
        persona.adultos = 2;
        persona.criancas = 1 + Math.floor(Math.random() * 2);
        persona.bebes = 0;
        persona.numPessoas = persona.adultos + persona.criancas;
        persona.observacoes = escolherAleatorio(OBSERVACOES_TEMPLATES.familia);
    }

    return persona;
}

// Rotação de estilos por dia da semana para variedade nos posts
const ESTILOS_POR_DIA = [
    'praia',      // Domingo
    'cidade',     // Segunda
    'natureza',   // Terça
    'romantico',  // Quarta
    'aventura',   // Quinta
    'familia',    // Sexta
    'praia',      // Sábado
];

/**
 * Retorna o estilo sugerido para hoje (rotação semanal).
 */
export function estiloDodia() {
    const dia = new Date().getDay();
    return ESTILOS_POR_DIA[dia];
}
