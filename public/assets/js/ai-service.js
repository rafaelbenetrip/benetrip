// Serviço de IA para o Benetrip - Versão atualizada
window.BENETRIP_AI = {
  // Configurações do serviço
  config: {
    apiEndpoint: '/api/recommendations', // Endpoint Vercel
    apiTimeout: 90000, // 90 segundos de timeout (aumentado de 60s para 90s)
    maxRetries: 3, // Número máximo de tentativas em caso de falha (aumentado de 2 para 3)
    retryDelay: 2000, // Tempo entre tentativas em ms (aumentado para melhor backoff)
    mockData: { // Dados de exemplo para casos de falha
      "topPick": {
        "destino": "Medellín",
        "pais": "Colômbia",
        "codigoPais": "CO",
        "descricao": "Cidade da eterna primavera com clima perfeito o ano todo",
        "porque": "Clima primaveril o ano todo com paisagens montanhosas deslumbrantes",
        "destaque": "Passeio de teleférico, Comuna 13 e fazendas de café próximas",
        "comentario": "Eu simplesmente AMEI Medellín! Perfeito para quem busca um mix de cultura e natureza! 🐾",
        "pontosTuristicos": ["Comuna 13", "Parque Arví"],
        "clima": {
          "temperatura": "20-25°C durante todo o ano",
          "condicoes": "Clima primaveril constante com sol e chuvas ocasionais",
          "recomendacoes": "Leve roupas leves e um casaco leve para as noites"
        },
        "aeroporto": {
          "codigo": "MDE",
          "nome": "Aeroporto Internacional José María Córdova"
        },
        "preco": {
          "voo": 1800,
          "hotel": 350
        }
      },
      "alternativas": [
        {
          "destino": "Montevidéu",
          "pais": "Uruguai",
          "codigoPais": "UY",
          "porque": "Clima costeiro tranquilo com frutos do mar deliciosos e espaços culturais",
          "pontosTuristicos": ["Rambla de Montevideo", "Ciudad Vieja"],
          "clima": {
            "temperatura": "15-25°C dependendo da estação"
          },
          "aeroporto": {
            "codigo": "MVD",
            "nome": "Aeroporto Internacional de Carrasco"
          },
          "preco": {
            "voo": 1500,
            "hotel": 300
          }
        },
        {
          "destino": "Buenos Aires",
          "pais": "Argentina",
          "codigoPais": "AR",
          "porque": "Capital cosmopolita com rica vida cultural, teatros e arquitetura europeia",
          "pontosTuristicos": ["Teatro Colón", "La Boca"],
          "clima": {
            "temperatura": "15-30°C dependendo da estação"
          },
          "aeroporto": {
            "codigo": "EZE",
            "nome": "Aeroporto Internacional Ministro Pistarini"
          },
          "preco": {
            "voo": 1400,
            "hotel": 280
          }
        },
        {
          "destino": "Santiago",
          "pais": "Chile",
          "codigoPais": "CL",
          "porque": "Moderna capital cercada pela Cordilheira dos Andes com excelentes vinhos",
          "pontosTuristicos": ["Santa Lucía Hill", "La Moneda"],
          "clima": {
            "temperatura": "10-30°C dependendo da estação"
          },
          "aeroporto": {
            "codigo": "SCL",
            "nome": "Aeroporto Internacional Arturo Merino Benítez"
          },
          "preco": {
            "voo": 1600,
            "hotel": 350
          }
        },
        {
          "destino": "Cusco",
          "pais": "Peru",
          "codigoPais": "PE",
          "porque": "Portal para Machu Picchu com rica história inca e arquitetura colonial",
          "pontosTuristicos": ["Sacsayhuamán", "Machu Picchu"],
          "clima": {
            "temperatura": "10-20°C durante o dia, mais frio à noite"
          },
          "aeroporto": {
            "codigo": "CUZ",
            "nome": "Aeroporto Internacional Alejandro Velasco Astete"
          },
          "preco": {
            "voo": 1700,
            "hotel": 250
          }
        }
      ],
      "surpresa": {
        "destino": "Cartagena",
        "pais": "Colômbia",
        "codigoPais": "CO",
        "descricao": "Joia colonial no Caribe colombiano com praias paradisíacas",
        "porque": "Cidade murada histórica com ruas coloridas, cultura vibrante e praias maravilhosas",
        "destaque": "Passeio de barco pelas Ilhas do Rosário com águas cristalinas",
        "comentario": "Cartagena é um tesouro escondido que vai te conquistar! As cores, a música e a comida caribenha formam uma experiência inesquecível! 🐾🌴",
        "pontosTuristicos": ["Ciudad Amurallada", "Castillo San Felipe"],
        "clima": {
          "temperatura": "27-32°C durante todo o ano",
          "condicoes": "Quente e úmido com brisa do mar, clima tropical perfeito para praia",
          "recomendacoes": "Leve roupas muito leves, protetor solar e chapéu"
        },
        "aeroporto": {
          "codigo": "CTG",
          "nome": "Aeroporto Internacional Rafael Núñez"
        },
        "preco": {
          "voo": 1950,
          "hotel": 320
        }
      }
    }
  },
  
  // Inicialização do serviço
  init() {
    console.log('Inicializando serviço de IA do Benetrip');
    this.initialized = true;
    this._ultimaRequisicao = null;
    this._requestsInProgress = {};
    // Registrar listener para eventos de progresso
    window.addEventListener('benetrip_progress', (event) => {
      console.log(`Evento de progresso: ${JSON.stringify(event.detail)}`);
    });
    return this;
  },
  
  // Verifica se o serviço foi inicializado
  isInitialized() {
    return this.initialized === true;
  },

  // Gera um ID de requisição baseado nas preferências
  generateRequestId(preferences) {
    const companhia = preferences.companhia || '0';
    const preferencia = preferences.preferencia_viagem || '0';
    const moeda = preferences.moeda_escolhida || 'BRL';
    const origem = preferences.cidade_partida?.name || 'default';
    return `${origem}_${companhia}_${preferencia}_${moeda}`;
  },
  
  // Método para extrair JSON de texto, lidando com diferentes formatos
  extrairJSON(texto) {
    if (texto && typeof texto === 'object') {
      return texto;
    }
    if (!texto) {
      console.warn('Texto de resposta vazio');
      return {};
    }
    try {
      return JSON.parse(texto);
    } catch (e) {
      console.log('Erro ao fazer parse direto, tentando extrair do texto:', e.message);
      try {
        const blocoCodigo = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (blocoCodigo && blocoCodigo[1]) {
          const jsonLimpo = blocoCodigo[1].trim();
          console.log('JSON extraído de bloco de código:', jsonLimpo.substring(0, 100) + '...');
          return JSON.parse(jsonLimpo);
        }
        let depth = 0;
        let start = -1;
        for (let i = 0; i < texto.length; i++) {
          if (texto[i] === '{') {
            if (depth === 0) start = i;
            depth++;
          } else if (texto[i] === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
              const jsonStr = texto.substring(start, i + 1);
              console.log('JSON extraído do texto usando análise de profundidade:', jsonStr.substring(0, 100) + '...');
              return JSON.parse(jsonStr);
            }
          }
        }
        const match = texto.match(/(\{[\s\S]*\})/);
        if (match && match[0]) {
          const jsonPotencial = match[0];
          console.log('JSON extraído de texto usando regex:', jsonPotencial.substring(0, 100) + '...');
          return JSON.parse(jsonPotencial);
        }
        console.warn('Não foi possível extrair JSON válido da resposta, retornando objeto vazio');
        return {};
      } catch (innerError) {
        console.error('Erro ao extrair JSON do texto:', innerError);
        return {};
      }
    }
  },

  // Delay de espera - útil para retries
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Funções auxiliares para formatação do prompt
  getTipoDestinoText(tipoDestino) {
    switch(tipoDestino) {
      case 0: return "Nacional - Prefere viajar dentro do próprio país";
      case 1: return "Internacional - Prefere viajar para fora do país";
      default: return "Destinos nacionais ou internacionais";
    }
  },

  getFamaDestinoText(famaDestino) {
    switch(famaDestino) {
      case 0: return "Destinos famosos e populares";
      case 1: return "Destinos menos conhecidos e alternativos";
      default: return "Mix de destinos populares e alternativos";
    }
  },

  determinarEstacaoDoAno(data, hemisferio = 'sul') {
    const mes = new Date(data).getMonth();
    if (hemisferio === 'sul') {
      if (mes >= 2 && mes <= 4) return 'Outono';
      if (mes >= 5 && mes <= 7) return 'Inverno';
      if (mes >= 8 && mes <= 10) return 'Primavera';
      return 'Verão';
    } else {
      if (mes >= 2 && mes <= 4) return 'Primavera';
      if (mes >= 5 && mes <= 7) return 'Verão';
      if (mes >= 8 && mes <= 10) return 'Outono';
      return 'Inverno';
    }
  },

  calcularDuracaoViagem(dataIda, dataVolta) {
    const ida = new Date(dataIda);
    const volta = new Date(dataVolta);
    const diffTime = Math.abs(volta - ida);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  },

  // Gerar prompt aprimorado para recomendações de destinos com ênfase no equilíbrio orçamentário e empatia
  gerarPromptParaDestinos(dados) {
    const {
      cidade_partida,
      moeda_escolhida = 'BRL',
      orcamento_valor,
      datas = {},
      companhia = 0,
      destino_imaginado = 2,
      tipo_viagem = 1,
      fama_destino = 2,
      tipo_destino = 2,
      item_essencial = 4,
      quantidade_familia = 0,
      quantidade_amigos = 0,
      conhece_destino = 0
    } = dados;

    const cidadeOrigem = cidade_partida?.name || "Cidade não especificada";
    const moeda = moeda_escolhida;
    const orcamento = orcamento_valor ? parseInt(orcamento_valor, 10) : 2500;
    
    const dataIda = datas.dataIda || new Date().toISOString().split('T')[0];
    const dataVolta = datas.dataVolta || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const duracaoViagem = this.calcularDuracaoViagem(dataIda, dataVolta);
    const estacaoViagem = this.determinarEstacaoDoAno(dataIda);
    
    let quantidadePessoas = 1;
    if (companhia === 1) quantidadePessoas = 2; 
    else if (companhia === 2) quantidadePessoas = parseInt(quantidade_familia, 10) || 3;
    else if (companhia === 3) quantidadePessoas = parseInt(quantidade_amigos, 10) || 4;
    
    let companheiroTexto;
    switch(companhia) {
      case 0: companheiroTexto = "Sozinho"; break;
      case 1: companheiroTexto = "Em casal"; break;
      case 2: companheiroTexto = "Em família"; break;
      case 3: companheiroTexto = "Com amigos"; break;
      default: companheiroTexto = "Sozinho";
    }
    
    let preferenciaTexto;
    switch(tipo_viagem) {
      case 0: preferenciaTexto = "relaxamento e tranquilidade"; break;
      case 1: preferenciaTexto = "exploração e descoberta"; break;
      case 2: preferenciaTexto = "aventura e adrenalina"; break;
      case 3: preferenciaTexto = "cultura, gastronomia e experiências locais"; break;
      default: preferenciaTexto = "experiências variadas";
    }
    
    let atracaoTexto;
    switch(item_essencial) {
      case 0: atracaoTexto = "diversão e entretenimento"; break;
      case 1: atracaoTexto = "natureza e atividades ao ar livre"; break;
      case 2: atracaoTexto = "cultura, história e museus"; break;
      case 3: atracaoTexto = "compras e vida urbana"; break;
      default: atracaoTexto = "experiências variadas";
    }
    
    let sugestaoDistancia = "";
    if (tipo_destino === 0) {
      sugestaoDistancia = "(buscar destinos domésticos)";
    } else if (tipo_destino === 1) {
      sugestaoDistancia = "(buscar destinos internacionais)";
    }
    
    let mensagemOrcamento;
    if (orcamento < 1000) {
      mensagemOrcamento = `Orçamento muito restrito de ${orcamento} ${moeda} por pessoa para voos (ida e volta). Considere o orçamento informado como teto máximo, priorize destinos com o menor custo possível que se encaixem nas preferências do usuário. Se o orçamento for muito baixo, retorne opções realistas e explique com empatia que as alternativas são limitadas.`;
    } else if (orcamento < 2000) {
      mensagemOrcamento = `Orçamento econômico de ${orcamento} ${moeda} por pessoa para voos (ida e volta). Considere o orçamento como teto máximo, buscando opções com ótima relação custo-benefício e mantendo um equilíbrio cuidadoso.`;
    } else if (orcamento < 4000) {
      mensagemOrcamento = `Orçamento moderado de ${orcamento} ${moeda} por pessoa para voos (ida e volta). Busque destinos que se encaixem bem nas preferências do usuário, sem comprometer a experiência, respeitando o teto informado.`;
    } else {
      mensagemOrcamento = `Orçamento confortável de ${orcamento} ${moeda} por pessoa para voos (ida e volta). Evite destinos excessivamente baratos, a menos que ofereçam experiências realmente incríveis, optando por destinos entre 70% e 100% do valor informado.`;
    }
    
    return `Crie recomendações de viagem que respeitem ESTRITAMENTE o orçamento do usuário:
${mensagemOrcamento}
PERFIL DO VIAJANTE:
- Partindo de: ${cidadeOrigem} ${sugestaoDistancia}
- Viajando: ${companheiroTexto}
- Número de pessoas: ${quantidadePessoas}
- Atividades preferidas: ${preferenciaTexto} e ${atracaoTexto}
- Período da viagem: ${dataIda} a ${dataVolta} (${duracaoViagem} dias)
- Estação do ano na viagem: ${estacaoViagem}
- Experiência como viajante: ${conhece_destino === 1 ? 'Com experiência' : 'Iniciante'} 
- Preferência por destinos: ${this.getTipoDestinoText(tipo_destino)}
- Popularidade do destino: ${this.getFamaDestinoText(fama_destino)}

IMPORTANTE:
1. Considere o orçamento informado como teto máximo para os voos.
2. O preço do VOO de cada destino deve ser MENOR que o orçamento máximo de ${orcamento} ${moeda}.
3. INCLUA estimativas realistas de preços para voos (ida e volta) e hospedagem por noite para todos os destinos.
4. FORNEÇA informações climáticas detalhadas para o destino na época da viagem (temperatura, condições e recomendações).
5. Ofereça um mix equilibrado, incluindo tanto destinos populares quanto alternativas, garantindo exatamente 4 destinos alternativos diferentes.
6. Considere a ÉPOCA DO ANO (${estacaoViagem}) para sugerir destinos com clima adequado.
7. Inclua destinos de diferentes continentes/regiões.
8. Garanta que os preços sejam realistas para voos de ida e volta partindo de ${cidadeOrigem}.
9. Para cada destino, INCLUA o código IATA (3 letras) do aeroporto principal.
10. Para cada destino, INCLUA pontos turísticos específicos e conhecidos.
11. Priorize destinos com o menor custo possível que se encaixam no perfil do usuário; se o orçamento for muito baixo, explique com empatia e mostre o melhor que dá para fazer.
12. Quando o orçamento for alto, evite destinos excessivamente baratos, a menos que proporcionem experiências incríveis, preferindo destinos entre 70% e 100% do valor informado.
13. Os comentários da Tripinha devem mencionar pelo menos um dos pontos turísticos do destino e ser escritos em primeira pessoa, como se ela tivesse visitado o local.

Forneça no formato JSON exato abaixo, SEM formatação markdown:
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão específica para visitar",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário da Tripinha em primeira pessoa, mencionando pelo menos um ponto turístico como se ela tivesse visitado o local",
    "pontosTuristicos": [
      "Nome do Primeiro Ponto Turístico", 
      "Nome do Segundo Ponto Turístico"
    ],
    "clima": {
      "temperatura": "Faixa de temperatura média esperada",
      "condicoes": "Descrição das condições climáticas esperadas",
      "recomendacoes": "Dicas relacionadas ao clima"
    },
    "aeroporto": {
      "codigo": "XYZ",
      "nome": "Nome do Aeroporto Principal"
    },
    "preco": {
      "voo": número,
      "hotel": número
    }
  },
  "alternativas": [
    {
      "destino": "Nome da Cidade 1",
      "pais": "Nome do País 1", 
      "codigoPais": "XX",
      "porque": "Razão específica para visitar",
      "pontosTuristicos": ["Nome do Primeiro Ponto Turístico", "Nome do Segundo Ponto Turístico"],
      "clima": {
        "temperatura": "Faixa de temperatura média esperada"
      },
      "aeroporto": {
        "codigo": "XYZ",
        "nome": "Nome do Aeroporto Principal"
      },
      "preco": {
        "voo": número,
        "hotel": número
      }
    },
    ...
  ],
  "surpresa": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão para visitar, destacando o fator surpresa",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário da Tripinha em primeira pessoa, mencionando pelo menos um ponto turístico como se ela tivesse visitado o local",
    "pontosTuristicos": [
      "Nome do Primeiro Ponto Turístico", 
      "Nome do Segundo Ponto Turístico"
    ],
    "clima": {
      "temperatura": "Faixa de temperatura média esperada",
      "condicoes": "Descrição das condições climáticas esperadas",
      "recomendacoes": "Dicas relacionadas ao clima"
    },
    "aeroporto": {
      "codigo": "XYZ",
      "nome": "Nome do Aeroporto Principal"
    },
    "preco": {
      "voo": número,
      "hotel": número
    }
  },
  "estacaoViagem": "${estacaoViagem}"
}`;
  },
  
  // Método para registrar eventos de progresso
  reportarProgresso(fase, porcentagem, mensagem) {
    const evento = new CustomEvent('benetrip_progress', {
      detail: {
        fase,
        porcentagem,
        mensagem
      }
    });
    window.dispatchEvent(evento);
    document.dispatchEvent(evento);
    console.log(`Progresso: ${fase} ${porcentagem}% - ${mensagem}`);
  },
  
  // Método para chamar a API do Vercel com suporte a retry e exponential backoff
  async callVercelAPI(data, retryCount = 0) {
    try {
      console.log(`Chamando API Vercel com dados:`, data);
      
      const apiUrl = this.config.apiEndpoint;
      const baseUrl = window.location.origin;
      const fullUrl = apiUrl.startsWith('http') ? apiUrl : baseUrl + apiUrl;
      console.log('Enviando requisição para:', fullUrl);

      // Gerar o prompt otimizado para recomendações
      const prompt = this.gerarPromptParaDestinos(data);
      
      // Seleção do modelo com fallback:
      let selectedModel;
      if (process.env.OPENAI_API_KEY) {
        selectedModel = "gpt-3.5-turbo";
      } else if (process.env.CLAUDE_API_KEY) {
        selectedModel = "claude";
      } else if (process.env.PERPLEXITY_API_KEY) {
        selectedModel = "perplexity";
      } else {
        selectedModel = "gpt-3.5-turbo"; // fallback default
      }
      
      const requestData = {
        ...data,
        prompt: prompt,
        model: selectedModel
      };

      let retryDelay = this.config.retryDelay;
      let maxRetries = this.config.maxRetries;
      let lastError = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          console.log(`Tentativa ${attempt} de ${maxRetries} após ${retryDelay}ms...`);
          await this.sleep(retryDelay);
          retryDelay *= 2;
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.config.apiTimeout);
          const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Connection': 'keep-alive',
              'Keep-Alive': 'timeout=90'
            },
            body: JSON.stringify(requestData),
            signal: controller.signal,
            keepalive: true
          });
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            let errorText = '';
            try {
              const errorData = await response.json();
              errorText = errorData.error || `${response.status} ${response.statusText}`;
            } catch (e) {
              errorText = `${response.status} ${response.statusText}`;
            }
            throw new Error(`Erro na API: ${errorText}`);
          }
          
          const responseData = await response.json();
          console.log('Resposta da API Vercel recebida:', responseData.tipo || 'sem tipo');
          return responseData;
          
        } catch (fetchError) {
          lastError = fetchError;
          console.warn(`Tentativa ${attempt + 1} falhou:`, fetchError.message);
          const isTimeoutError = fetchError.name === 'AbortError' || fetchError.message.includes('timeout');
          if (attempt < maxRetries) {
            this.reportarProgresso('retry', 50, `Tentando novamente... (${attempt + 1}/${maxRetries})`);
            continue;
          } else {
            throw fetchError;
          }
        }
      }
      throw lastError || new Error('Falha em todas as tentativas de conexão');
      
    } catch (error) {
      console.error('Erro ao chamar API Vercel:', error);
      if (error.message.includes('CORS') && retryCount < 1) {
        console.log('Erro de CORS detectado, tentando abordagem alternativa...');
        try {
          console.log('Retornando dados simulados devido ao erro de CORS');
          return {
            tipo: "simulado-cors",
            conteudo: JSON.stringify(this.config.mockData)
          };
        } catch (corsError) {
          console.error('Erro na abordagem alternativa para CORS:', corsError);
        }
      }
      console.log('Retornando dados simulados devido ao erro');
      return {
        tipo: "simulado-error",
        conteudo: JSON.stringify(this.config.mockData)
      };
    }
  },
  
  // Método para validar a estrutura dos dados das recomendações
  validarEstruturaDados(dados) {
    if (!dados) {
      console.error('Dados de recomendações são nulos ou indefinidos');
      return { ...this.config.mockData };
    }
    if (!dados.topPick) {
      console.error('Destino principal não encontrado nos dados');
      dados.topPick = this.config.mockData.topPick;
    }
    if (!dados.alternativas || !Array.isArray(dados.alternativas)) {
      console.error('Alternativas não encontradas ou não são um array');
      dados.alternativas = [...this.config.mockData.alternativas];
    }
    if (dados.alternativas.length < 1) {
      console.warn('Alternativas insuficientes, adicionando dados fictícios');
      dados.alternativas = [...this.config.mockData.alternativas];
    }
    if (!dados.surpresa && dados.alternativas.length > 0) {
      console.log('Destino surpresa não encontrado, criando a partir de alternativa');
      dados.surpresa = {
        ...dados.alternativas.pop(),
        descricao: "Um destino surpreendente que poucos conhecem!",
        destaque: "Experiência única que vai te surpreender",
        comentario: "Este é um destino surpresa especial que farejei só para você! Confie no meu faro! 🐾🎁"
      };
    }
    if (!dados.surpresa) {
      console.log('Criando destino surpresa fictício');
      dados.surpresa = this.config.mockData.surpresa;
    }
    if (!dados.topPick.pontosTuristicos) {
      dados.topPick.pontosTuristicos = [];
    }
    if (dados.alternativas) {
      dados.alternativas.forEach(alt => {
        if (!alt.pontosTuristicos) {
          alt.pontosTuristicos = [];
        }
      });
    }
    if (!dados.surpresa.pontosTuristicos) {
      dados.surpresa.pontosTuristicos = [];
    }
    if (!dados.topPick.clima) {
      dados.topPick.clima = {
        temperatura: "Indisponível",
        condicoes: "Informações climáticas não disponíveis",
        recomendacoes: "Consulte a previsão do tempo antes de viajar"
      };
    }
    if (dados.alternativas) {
      dados.alternativas.forEach(alt => {
        if (!alt.clima) {
          alt.clima = {
            temperatura: "Indisponível"
          };
        }
      });
    }
    if (!dados.surpresa.clima) {
      dados.surpresa.clima = {
        temperatura: "Indisponível",
        condicoes: "Informações climáticas não disponíveis",
        recomendacoes: "Consulte a previsão do tempo antes de viajar"
      };
    }
    return dados;
  },
  
  // Método para obter recomendações de destinos com fallback e progressão
  async obterRecomendacoes(preferenciasUsuario) {
    if (!this.isInitialized()) {
      this.init();
    }
    if (!preferenciasUsuario) {
      throw new Error('Preferências de usuário não fornecidas');
    }
    console.log('Recebendo pedido de recomendações com preferências:', preferenciasUsuario);
    const requestId = this.generateRequestId(preferenciasUsuario);
    if (this._requestsInProgress[requestId]) {
      console.log('Requisição já em andamento para:', requestId);
      this.reportarProgresso('aguardando', 50, 'Aguardando requisição em andamento...');
      try {
        return await this._requestsInProgress[requestId];
      } catch (error) {
        console.error('Erro na requisição em andamento:', error);
      }
    }
    
    const requestPromise = (async () => {
      try {
        this.reportarProgresso('inicializando', 10, 'Preparando recomendações personalizadas...');
        this.reportarProgresso('processando', 30, 'Analisando suas preferências de viagem...');
        
        const resposta = await this.callVercelAPI(preferenciasUsuario);
        if (!resposta) {
          throw new Error('Resposta vazia do serviço de IA');
        }
        this.reportarProgresso('finalizando', 70, 'Encontrando os destinos perfeitos para você...');
        
        let recomendacoes;
        try {
          if (resposta.tipo === 'erro' && resposta.conteudo) {
            const conteudoObj = this.extrairJSON(resposta.conteudo);
            if (conteudoObj.data) {
              console.log('Usando dados de fallback da resposta de erro');
              recomendacoes = conteudoObj.data;
            } else {
              throw new Error('Formato inválido nos dados de fallback');
            }
          } else if (resposta.conteudo) {
            recomendacoes = this.extrairJSON(resposta.conteudo);
            console.log('Recomendações extraídas com sucesso:', recomendacoes);
          } else {
            throw new Error('Conteúdo da resposta não encontrado');
          }
        } catch (extractError) {
          console.error('Erro ao extrair JSON da resposta:', extractError);
          console.log('Usando dados mockados devido a erro de extração');
          this.reportarProgresso('fallback', 80, 'Usando dados padrão devido a erro de processamento');
          recomendacoes = { ...this.config.mockData };
        }
        
        try {
          recomendacoes = this.validarEstruturaDados(recomendacoes);
        } catch (validationError) {
          console.error('Erro na validação dos dados:', validationError);
          console.log('Usando dados mockados devido a erro de validação');
          this.reportarProgresso('fallback', 85, 'Usando dados padrão devido a erro de validação');
          recomendacoes = { ...this.config.mockData };
        }
        
        while (recomendacoes.alternativas && recomendacoes.alternativas.length > 4) {
          recomendacoes.alternativas.pop();
        }
        if (recomendacoes.alternativas) {
          while (recomendacoes.alternativas.length < 4) {
            const mockAlternativa = this.config.mockData.alternativas[recomendacoes.alternativas.length];
            if (mockAlternativa) {
              console.log('Adicionando alternativa fictícia');
              recomendacoes.alternativas.push(mockAlternativa);
            } else {
              break;
            }
          }
        }
        
        this.reportarProgresso('concluido', 100, 'Destinos encontrados!');
        localStorage.setItem('benetrip_recomendacoes', JSON.stringify(recomendacoes));
        return recomendacoes;
      } catch (erro) {
        console.error('Erro ao obter recomendações:', erro);
        console.log('Usando dados mockados devido a erro');
        this.reportarProgresso('mockados', 100, 'Usando recomendações padrão devido a erro...');
        const dadosMockados = { ...this.config.mockData };
        localStorage.setItem('benetrip_recomendacoes', JSON.stringify(dadosMockados));
        return dadosMockados;
      } finally {
        delete this._requestsInProgress[requestId];
      }
    })();
    
    this._requestsInProgress[requestId] = requestPromise;
    return requestPromise;
  }
};

// Inicializar o serviço quando o script for carregado
window.BENETRIP_AI.init();
