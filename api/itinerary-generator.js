// api/itinerary-generator.js - VERSÃO CORRIGIDA PARA MOBILE
// Corrige problema de sintaxe async e melhora compatibilidade
const https = require('https');
const http = require('http');

// ===================================
// CONFIGURAÇÃO PRINCIPAL
// ===================================
const CONFIG = {
    deepseek: {
        baseURL: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat',
        timeout: 60000,
        maxTokens: 3000,
        temperature: 0.7
    },
    groq: {
        baseURL: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.1-70b-versatile',
        timeout: 45000,
        maxTokens: 2500,
        temperature: 0.6
    },
    retries: 2,
    fallbackEnabled: true
};

// ===================================
// TEMPLATES DE ROTEIRO LOCAIS
// ===================================
const ROTEIROS_TEMPLATE = {
    'Lisboa': {
        dias: [
            {
                periodo: 'manha',
                atividades: [
                    { local: 'Mosteiro dos Jerónimos', horario: '09:00', dica: 'Chegue cedo para evitar multidões! A arquitetura manuelina é impressionante.' },
                    { local: 'Torre de Belém', horario: '11:00', dica: 'Símbolo de Lisboa, perfeita para fotos!' }
                ]
            },
            {
                periodo: 'tarde',
                atividades: [
                    { local: 'Castelo de São Jorge', horario: '14:00', dica: 'Vista incrível de Lisboa, especialmente no fim da tarde!' },
                    { local: 'Bairro de Alfama', horario: '16:30', dica: 'Perca-se nas ruelas históricas e ouça fado!' }
                ]
            }
        ]
    },
    'Paris': {
        dias: [
            {
                periodo: 'manha',
                atividades: [
                    { local: 'Torre Eiffel', horario: '09:00', dica: 'Compre ingressos online para evitar filas!' },
                    { local: 'Champs-Élysées', horario: '11:00', dica: 'Caminhada icônica até o Arco do Triunfo!' }
                ]
            },
            {
                periodo: 'tarde',
                atividades: [
                    { local: 'Museu do Louvre', horario: '14:00', dica: 'Reserve pelo menos 3 horas, é gigante!' },
                    { local: 'Île de la Cité', horario: '17:00', dica: 'Notre-Dame e Sainte-Chapelle!' }
                ]
            }
        ]
    },
    'Roma': {
        dias: [
            {
                periodo: 'manha',
                atividades: [
                    { local: 'Coliseu', horario: '09:00', dica: 'Entre cedo e imagine os gladiadores!' },
                    { local: 'Fórum Romano', horario: '11:00', dica: 'História viva do Império Romano!' }
                ]
            },
            {
                periodo: 'tarde',
                atividades: [
                    { local: 'Vaticano', horario: '14:00', dica: 'Capela Sistina é imperdível!' },
                    { local: 'Fontana di Trevi', horario: '17:00', dica: 'Jogue uma moeda e faça um pedido!' }
                ]
            }
        ]
    }
};

// ===================================
// FUNÇÕES AUXILIARES
// ===================================
function criarClienteHTTP(timeout = 30000) {
    return {
        httpAgent: new http.Agent({ 
            keepAlive: true,
            timeout: timeout
        }),
        httpsAgent: new https.Agent({ 
            keepAlive: true,
            timeout: timeout
        })
    };
}

function validarParametros(params) {
    const erros = [];
    
    if (!params.destino || typeof params.destino !== 'string') {
        erros.push('Destino é obrigatório');
    }
    
    if (!params.dataInicio) {
        erros.push('Data de início é obrigatória');
    }
    
    if (!params.horaChegada) {
        erros.push('Hora de chegada é obrigatória');
    }
    
    return erros;
}

function calcularDuracaoViagem(dataInicio, dataFim) {
    try {
        const inicio = new Date(dataInicio);
        const fim = dataFim ? new Date(dataFim) : inicio;
        
        const diffTime = Math.abs(fim - inicio);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        return Math.min(Math.max(diffDays, 1), 15); // Entre 1 e 15 dias
    } catch (error) {
        console.warn('Erro ao calcular duração:', error);
        return 3; // Fallback para 3 dias
    }
}

function gerarPromptRoteiro(params) {
    const duracao = calcularDuracaoViagem(params.dataInicio, params.dataFim);
    
    return `Crie um roteiro de viagem DETALHADO para ${params.destino} com as seguintes especificações:

INFORMAÇÕES DA VIAGEM:
- Destino: ${params.destino}
- Duração: ${duracao} dias
- Data início: ${params.dataInicio}
- Data fim: ${params.dataFim || 'Não especificada'}
- Hora chegada: ${params.horaChegada}
- Hora saída: ${params.horaSaida || 'Não especificada'}
- Tipo de viagem: ${params.tipoViagem || 'turismo'}
- Companhia: ${params.tipoCompanhia || 'casal'}
- Intensidade: ${params.intensidade || 'moderado'}

INSTRUÇÕES ESPECÍFICAS:
1. Crie um roteiro para EXATAMENTE ${duracao} dias
2. Inclua 4-6 atividades por dia (dependendo da intensidade)
3. Considere os horários de chegada e partida
4. Inclua dicas práticas da "Tripinha" (nossa mascote cachorrinha)
5. Adicione horários específicos para cada atividade

FORMATO DE RESPOSTA (JSON):
{
  "destino": "${params.destino}",
  "duracao": ${duracao},
  "dias": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "Descrição do dia",
      "manha": {
        "atividades": [
          {
            "horario": "09:00",
            "local": "Nome do local",
            "dica": "Dica prática da Tripinha em primeira pessoa"
          }
        ]
      },
      "tarde": {
        "atividades": [
          {
            "horario": "14:00",
            "local": "Nome do local",
            "dica": "Dica prática da Tripinha"
          }
        ]
      },
      "noite": {
        "atividades": [
          {
            "horario": "19:00",
            "local": "Nome do local",
            "dica": "Dica da Tripinha"
          }
        ]
      }
    }
  ]
}

IMPORTANTE: 
- Retorne APENAS o JSON, sem markdown ou texto adicional
- Locais devem ser reais e específicos
- Dicas da Tripinha em primeira pessoa: "Eu adorei quando..."
- Horários realistas e práticos`;
}

// ===================================
// FUNÇÃO PRINCIPAL DE GERAÇÃO (SEM ASYNC NA DECLARAÇÃO)
// ===================================
function gerarRoteiroComDeepseek(params) {
    return new Promise((resolve, reject) => {
        const prompt = gerarPromptRoteiro(params);
        
        const payload = {
            model: CONFIG.deepseek.model,
            messages: [
                {
                    role: "system",
                    content: "Você é um especialista em roteiros de viagem. Retorne sempre JSON válido com roteiros detalhados e práticos."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: CONFIG.deepseek.temperature,
            max_tokens: CONFIG.deepseek.maxTokens
        };

        const options = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: CONFIG.deepseek.timeout
        };

        const req = https.request(CONFIG.deepseek.baseURL, options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (response.choices && response.choices[0]) {
                        const content = response.choices[0].message.content;
                        const roteiro = JSON.parse(content);
                        resolve(roteiro);
                    } else {
                        reject(new Error('Resposta inválida da API DeepSeek'));
                    }
                } catch (error) {
                    console.error('Erro ao processar resposta DeepSeek:', error);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Erro na requisição DeepSeek:', error);
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout na API DeepSeek'));
        });

        req.write(JSON.stringify(payload));
        req.end();
    });
}

// ===================================
// FUNÇÃO GROQ (FALLBACK)
// ===================================
function gerarRoteiroComGroq(params) {
    return new Promise((resolve, reject) => {
        const prompt = gerarPromptRoteiro(params);
        
        const payload = {
            model: CONFIG.groq.model,
            messages: [
                {
                    role: "system",
                    content: "Especialista em roteiros de viagem. Retorne JSON válido."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: CONFIG.groq.temperature,
            max_tokens: CONFIG.groq.maxTokens
        };

        const options = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: CONFIG.groq.timeout
        };

        const req = https.request(CONFIG.groq.baseURL, options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (response.choices && response.choices[0]) {
                        const content = response.choices[0].message.content;
                        const roteiro = JSON.parse(content);
                        resolve(roteiro);
                    } else {
                        reject(new Error('Resposta inválida da API Groq'));
                    }
                } catch (error) {
                    console.error('Erro ao processar resposta Groq:', error);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Erro na requisição Groq:', error);
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout na API Groq'));
        });

        req.write(JSON.stringify(payload));
        req.end();
    });
}

// ===================================
// FUNÇÃO DE FALLBACK LOCAL
// ===================================
function gerarRoteiroFallback(params) {
    console.log('🛡️ Gerando roteiro fallback local para:', params.destino);
    
    const destino = params.destino;
    const duracao = calcularDuracaoViagem(params.dataInicio, params.dataFim);
    
    // Buscar template específico ou usar genérico
    let templateBase = ROTEIROS_TEMPLATE[destino] || ROTEIROS_TEMPLATE['Lisboa'];
    
    // Gerar roteiro baseado no template
    const dias = [];
    const dataInicio = new Date(params.dataInicio);
    
    for (let i = 0; i < duracao; i++) {
        const dataAtual = new Date(dataInicio);
        dataAtual.setDate(dataInicio.getDate() + i);
        
        const diaTemplate = templateBase.dias[i % templateBase.dias.length];
        
        const dia = {
            data: dataAtual.toISOString().split('T')[0],
            descricao: i === 0 ? 
                `Chegada e primeiras impressões de ${destino}!` :
                i === duracao - 1 ?
                `Últimos momentos para aproveitar ${destino}.` :
                `Explorando os tesouros de ${destino}.`,
            manha: {
                atividades: adaptarAtividades(diaTemplate.atividades || [], 'manha', destino)
            },
            tarde: {
                atividades: adaptarAtividades(diaTemplate.atividades || [], 'tarde', destino)
            },
            noite: {
                atividades: adaptarAtividades(diaTemplate.atividades || [], 'noite', destino)
            }
        };
        
        dias.push(dia);
    }
    
    return {
        destino: destino,
        duracao: duracao,
        dias: dias
    };
}

function adaptarAtividades(atividadesBase, periodo, destino) {
    const horarios = {
        'manha': ['09:00', '10:30'],
        'tarde': ['14:00', '16:00'],
        'noite': ['19:00', '21:00']
    };
    
    const atividades = [];
    const horariosDisp = horarios[periodo] || ['10:00'];
    
    for (let i = 0; i < Math.min(2, horariosDisp.length); i++) {
        if (atividadesBase[i]) {
            atividades.push({
                horario: horariosDisp[i],
                local: atividadesBase[i].local || `Atração Local ${i + 1}`,
                dica: atividadesBase[i].dica || `Eu adorei este lugar em ${destino}! Vale muito a pena conhecer!`
            });
        }
    }
    
    return atividades;
}

// ===================================
// HANDLER PRINCIPAL (SEM ASYNC)
// ===================================
function handler(req, res) {
    let responseHandled = false;
    
    // Timeout de segurança
    const timeoutId = setTimeout(() => {
        if (!responseHandled) {
            responseHandled = true;
            console.error('⏰ Timeout do servidor atingido');
            res.status(500).json({
                error: 'Timeout na geração do roteiro',
                fallback: true
            });
        }
    }, 120000); // 2 minutos

    // Headers CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        clearTimeout(timeoutId);
        responseHandled = true;
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        clearTimeout(timeoutId);
        responseHandled = true;
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        console.log('🚀 === BENETRIP ITINERARY GENERATOR v3.0 ===');
        
        const params = req.body;
        
        // Validar parâmetros
        const erros = validarParametros(params);
        if (erros.length > 0) {
            clearTimeout(timeoutId);
            responseHandled = true;
            return res.status(400).json({
                error: 'Parâmetros inválidos',
                details: erros
            });
        }

        console.log('📊 Parâmetros recebidos:', {
            destino: params.destino,
            dataInicio: params.dataInicio,
            dataFim: params.dataFim,
            duracao: calcularDuracaoViagem(params.dataInicio, params.dataFim)
        });

        // Função para finalizar resposta
        function finalizarResposta(roteiro, fonte, tentativa = 1) {
            if (responseHandled) return;
            
            clearTimeout(timeoutId);
            responseHandled = true;
            
            console.log(`✅ Roteiro gerado com sucesso via ${fonte} (tentativa ${tentativa})`);
            console.log(`📋 Roteiro: ${roteiro.dias?.length || 0} dias para ${roteiro.destino}`);
            
            res.status(200).json({
                ...roteiro,
                fonte: fonte,
                tentativa: tentativa,
                timestamp: new Date().toISOString()
            });
        }

        function tentarProximaOpcao(tentativa) {
            if (responseHandled) return;
            
            console.log(`🔄 Tentativa ${tentativa}...`);
            
            if (tentativa === 1 && process.env.DEEPSEEK_API_KEY) {
                // Primeira tentativa: DeepSeek
                gerarRoteiroComDeepseek(params)
                    .then(roteiro => finalizarResposta(roteiro, 'DeepSeek', tentativa))
                    .catch(error => {
                        console.warn(`❌ DeepSeek falhou (tentativa ${tentativa}):`, error.message);
                        tentarProximaOpcao(tentativa + 1);
                    });
                    
            } else if (tentativa === 2 && process.env.GROQ_API_KEY) {
                // Segunda tentativa: Groq
                gerarRoteiroComGroq(params)
                    .then(roteiro => finalizarResposta(roteiro, 'Groq', tentativa))
                    .catch(error => {
                        console.warn(`❌ Groq falhou (tentativa ${tentativa}):`, error.message);
                        tentarProximaOpcao(tentativa + 1);
                    });
                    
            } else {
                // Fallback local
                try {
                    const roteiroFallback = gerarRoteiroFallback(params);
                    finalizarResposta(roteiroFallback, 'Fallback Local', tentativa);
                } catch (error) {
                    console.error('❌ Até o fallback falhou:', error);
                    
                    if (!responseHandled) {
                        clearTimeout(timeoutId);
                        responseHandled = true;
                        res.status(500).json({
                            error: 'Não foi possível gerar o roteiro',
                            details: error.message
                        });
                    }
                }
            }
        }

        // Iniciar processo
        tentarProximaOpcao(1);

    } catch (error) {
        console.error('💥 Erro global:', error);
        
        if (!responseHandled) {
            clearTimeout(timeoutId);
            responseHandled = true;
            res.status(500).json({
                error: 'Erro interno do servidor',
                details: error.message
            });
        }
    }
}

// ===================================
// EXPORTAÇÃO (COMPATÍVEL COM VERCEL)
// ===================================
module.exports = handler;

// Manter compatibilidade para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
    module.exports.handler = handler;
    module.exports.gerarRoteiroFallback = gerarRoteiroFallback;
}
