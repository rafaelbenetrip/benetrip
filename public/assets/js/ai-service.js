// Serviço de IA para o Benetrip - Versão Vercel com Perplexity
window.BENETRIP_AI = {
  // Configurações do serviço
  config: {
    apiEndpoint: '/api/recommendations', // Endpoint Vercel
    imageApiEndpoint: '/api/image-search', // Endpoint Vercel para busca de imagens
    apiTimeout: 90000, // 90 segundos de timeout (aumentado de 60s para 90s)
    maxRetries: 3, // Número máximo de tentativas em caso de falha (aumentado de 2 para 3)
    retryDelay: 2000, // Tempo entre tentativas em ms (aumentado para melhor backoff)
    // Configuração de imagens por tipo de destino
    imagensQtdPorTipo: {
      topPick: 2,
      alternativa: 1,
      surpresa: 2
    },
    mockData: { // Dados de exemplo para casos de falha
      "topPick": {
        "destino": "Medellín",
        "pais": "Colômbia",
        "codigoPais": "CO",
        "descricao": "Cidade da eterna primavera com clima perfeito o ano todo",
        "porque": "Clima primaveril o ano todo com paisagens montanhosas deslumbrantes",
        "destaque": "Passeio de teleférico, Comuna 13 e fazendas de café próximas",
        "comentario": "Eu simplesmente AMEI Medellín! Perfeito para quem busca um mix de cultura e natureza! 🐾",
        "pontosTuristicos": ["Comuna 13", "Parque Arví", "Plaza Botero", "Pueblito Paisa"],
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
          "pontosTuristicos": ["Rambla de Montevideo", "Ciudad Vieja", "Mercado del Puerto"],
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
          "pontosTuristicos": ["Teatro Colón", "La Boca", "Recoleta"],
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
          "pontosTuristicos": ["Santa Lucía Hill", "La Moneda", "Sky Costanera"],
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
          "pontosTuristicos": ["Sacsayhuamán", "Plaza de Armas", "Machu Picchu"],
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
        "pontosTuristicos": ["Ciudad Amurallada", "Castillo San Felipe", "Islas del Rosario", "Plaza Santo Domingo"],
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
    this._cacheImagens = {};
    
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
    // Extrair valores relevantes para formar uma chave de identificação
    const companhia = preferences.companhia || '0';
    const preferencia = preferences.preferencia_viagem || '0';
    const moeda = preferences.moeda_escolhida || 'BRL';
    const origem = preferences.cidade_partida?.name || 'default';
    
    return `${origem}_${companhia}_${preferencia}_${moeda}`;
  },
  
  // Método para extrair JSON de texto, lidando com diferentes formatos
  extrairJSON(texto) {
    // Se já for um objeto, retornar diretamente
    if (texto && typeof texto === 'object') {
      return texto;
    }
    
    // Se for nulo ou undefined, retorna objeto vazio
    if (!texto) {
      console.warn('Texto de resposta vazio');
      return {};
    }
    
    // Primeiro, tenta fazer parse direto
    try {
      return JSON.parse(texto);
    } catch (e) {
      console.log('Erro ao fazer parse direto, tentando extrair do texto:', e.message);
      
      // Se falhar, tenta extrair JSON de bloco de código ou texto
      try {
        // Busca por blocos de código JSON
        const blocoCodigo = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (blocoCodigo && blocoCodigo[1]) {
          const jsonLimpo = blocoCodigo[1].trim();
          console.log('JSON extraído de bloco de código:', jsonLimpo.substring(0, 100) + '...');
          return JSON.parse(jsonLimpo);
        }
        
        // Busca pela primeira ocorrência de chaves balanceadas
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
        
        // Último recurso: busca por regex simples
        const match = texto.match(/(\{[\s\S]*\})/);
        if (match && match[0]) {
          const jsonPotencial = match[0];
          console.log('JSON extraído de texto usando regex:', jsonPotencial.substring(0, 100) + '...');
          return JSON.parse(jsonPotencial);
        }
        
        // Se nada funcionar, retorna um objeto vazio
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

  // Função para determinar a estação do ano em uma data
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

  // Função para calcular a duração da viagem em dias
  calcularDuracaoViagem(dataIda, dataVolta) {
    const ida = new Date(dataIda);
    const volta = new Date(dataVolta);
    const diffTime = Math.abs(volta - ida);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  },

  // Gerar prompt aprimorado para recomendações de destinos
  gerarPromptParaDestinos(dados) {
    // Extrair dados relevantes das preferências
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

    // Valores formatados para uso no prompt
    const cidadeOrigem = cidade_partida?.name || "Cidade não especificada";
    const moeda = moeda_escolhida;
    const orcamento = orcamento_valor ? parseInt(orcamento_valor, 10) : 2500;
    
    // Tratar datas e calcular duração
    const dataIda = datas.dataIda || new Date().toISOString().split('T')[0];
    const dataVolta = datas.dataVolta || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const duracaoViagem = this.calcularDuracaoViagem(dataIda, dataVolta);
    
    // Determinar estação do ano
    const estacaoViagem = this.determinarEstacaoDoAno(dataIda);
    
    // Calcular número de pessoas
    let quantidadePessoas = 1;
    if (companhia === 1) quantidadePessoas = 2; // Casal
    else if (companhia === 2) quantidadePessoas = parseInt(quantidade_familia, 10) || 3; // Família
    else if (companhia === 3) quantidadePessoas = parseInt(quantidade_amigos, 10) || 4; // Amigos
    
    // Formatar preferência de companhia
    let companheiroTexto;
    switch(companhia) {
      case 0: companheiroTexto = "Sozinho"; break;
      case 1: companheiroTexto = "Em casal"; break;
      case 2: companheiroTexto = "Em família"; break;
      case 3: companheiroTexto = "Com amigos"; break;
      default: companheiroTexto = "Sozinho";
    }
    
    // Formatar preferência de viagem
    let preferenciaTexto;
    switch(tipo_viagem) {
      case 0: preferenciaTexto = "relaxamento e tranquilidade"; break;
      case 1: preferenciaTexto = "exploração e descoberta"; break;
      case 2: preferenciaTexto = "aventura e adrenalina"; break;
      case 3: preferenciaTexto = "cultura, gastronomia e experiências locais"; break;
      default: preferenciaTexto = "experiências variadas";
    }
    
    // Formatar preferência de atrações
    let atracaoTexto;
    switch(item_essencial) {
      case 0: atracaoTexto = "diversão e entretenimento"; break;
      case 1: atracaoTexto = "natureza e atividades ao ar livre"; break;
      case 2: atracaoTexto = "cultura, história e museus"; break;
      case 3: atracaoTexto = "compras e vida urbana"; break;
      default: atracaoTexto = "experiências variadas";
    }
    
    // Sugestão de distância baseada no tipo de destino
    let sugestaoDistancia = "";
    if (tipo_destino === 0) {
      sugestaoDistancia = "(buscar destinos domésticos)";
    } else if (tipo_destino === 1) {
      sugestaoDistancia = "(buscar destinos internacionais)";
    }
    
    // Mensagem específica para orçamento
    let mensagemOrcamento;
    if (orcamento < 1000) {
      mensagemOrcamento = `Orçamento muito restrito de ${orcamento} ${moeda} por pessoa para voos (ida e volta). Priorize destinos próximos e econômicos.`;
    } else if (orcamento < 2000) {
      mensagemOrcamento = `Orçamento econômico de ${orcamento} ${moeda} por pessoa para voos (ida e volta). Foque em opções com boa relação custo-benefício.`;
    } else if (orcamento < 4000) {
      mensagemOrcamento = `Orçamento moderado de ${orcamento} ${moeda} por pessoa para voos (ida e volta). Pode incluir destinos de médio alcance com preços acessíveis.`;
    } else {
      mensagemOrcamento = `Orçamento confortável de ${orcamento} ${moeda} por pessoa para voos (ida e volta). Pode incluir destinos mais distantes e premium.`;
    }

    return `Crie recomendações de viagem que respeitam ESTRITAMENTE o orçamento do usuário:
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
1. O preço do VOO de CADA destino DEVE ser MENOR que o orçamento máximo de ${orcamento} ${moeda}.
2. INCLUA ESTIMATIVAS REALISTAS de preços para voos (ida e volta) e hospedagem por noite para TODOS os destinos.
3. FORNEÇA INFORMAÇÕES CLIMÁTICAS detalhadas para o destino na época da viagem (temperatura, condições e recomendações).
4. Forneça um mix equilibrado: inclua tanto destinos populares quanto alternativas.
5. Forneça EXATAMENTE 4 destinos alternativos diferentes entre si.
6. Considere a ÉPOCA DO ANO (${estacaoViagem}) para sugerir destinos com clima adequado.
7. Inclua destinos de diferentes continentes/regiões.
8. Garanta que os preços sejam realistas para voos de ida e volta partindo de ${cidadeOrigem}.
9. Para CADA destino, inclua o código IATA (3 letras) do aeroporto principal.
10. Para cada destino, INCLUA PONTOS TURÍSTICOS ESPECÍFICOS E CONHECIDOS.
11. Os comentários da Tripinha DEVEM mencionar pelo menos um dos pontos turísticos do destino e ser escritos em primeira pessoa, como se ela tivesse visitado o local.

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
  
  // NOVA FUNÇÃO: Extrair pontos turísticos do texto
  extrairPontosTuristicos(texto, destino) {
    if (!texto || typeof texto !== 'string') return [];
    
    const pontosTuristicos = [];
    const textoLower = texto.toLowerCase();
    const destinoLower = destino.toLowerCase();
    
    // Lista de palavras-chave que podem indicar pontos turísticos
    const keywords = [
      'visite', 'visitar', 'conhecer', 'explorar', 'turismo', 'turístico', 'atração', 
      'atrações', 'monumento', 'museu', 'parque', 'catedral', 'igreja', 'templo', 
      'palácio', 'castelo', 'jardim', 'plaza', 'praça', 'mercado', 'feira', 'torre',
      'ponte', 'praia', 'montanha', 'lago', 'rio', 'passeio', 'tour', 'excursão'
    ];
    
    // Expressões regulares para encontrar pontos turísticos
    
    // 1. Nomes próprios entre aspas
    const aspasRegex = /"([^"]+)"/g;
    let match;
    while ((match = aspasRegex.exec(texto)) !== null) {
      const ponto = match[1].trim();
      if (ponto.length > 3 && !pontosTuristicos.includes(ponto) && !ponto.toLowerCase().includes(destinoLower)) {
        pontosTuristicos.push(ponto);
      }
    }
    
    // 2. Nomes com letra maiúscula seguidos por nomes de locais
    const nomesPropriosRegex = /\b([A-Z][a-zÀ-ú]+(?: [A-Z][a-zÀ-ú]+)*) (?:Park|Museum|Cathedral|Castle|Beach|Palace|Temple|Church|Bridge|Tower|Plaza|Square|Market|Garden|Mountain|Lake|Island|Falls)/g;
    while ((match = nomesPropriosRegex.exec(texto)) !== null) {
      const ponto = match[0].trim();
      if (ponto.length > 3 && !pontosTuristicos.includes(ponto) && !ponto.toLowerCase().includes(destinoLower)) {
        pontosTuristicos.push(ponto);
      }
    }
    
    // 3. No campo "destaque", geralmente o primeiro item mencionado é um ponto turístico
    if (texto.length < 100) {  // Provavelmente é um campo curto como "destaque"
      // Tentar extrair lugares específicos que estão entre vírgulas ou no início
      const destaquesRegex = /^([^,]+)|(?:, ?| e )([^,]+)/g;
      while ((match = destaquesRegex.exec(texto)) !== null) {
        const ponto = (match[1] || match[2])?.trim();
        if (ponto && ponto.length > 3 && !pontosTuristicos.includes(ponto) && !ponto.toLowerCase().includes(destinoLower)) {
          // Verificar se não é apenas uma frase genérica
          const palavrasGenéricas = ['passeio', 'visita', 'experiência', 'tour', 'excursão', 'atividade'];
          if (!palavrasGenéricas.some(palavra => ponto.toLowerCase().startsWith(palavra))) {
            pontosTuristicos.push(ponto);
          }
        }
      }
    }
    
    // 4. Frases com palavras-chave seguidas por nomes próprios
    for (const keyword of keywords) {
      const keywordRegex = new RegExp(`${keyword} (?:a|o|as|os|ao|à|do|da|no|na|pelo|pela)? ([A-Z][a-zÀ-ú]+(?: [A-Z][a-zÀ-ú]+){0,4})`, 'g');
      while ((match = keywordRegex.exec(texto)) !== null) {
        const ponto = match[1].trim();
        if (ponto.length > 3 && !pontosTuristicos.includes(ponto) && !ponto.toLowerCase().includes(destinoLower)) {
          pontosTuristicos.push(ponto);
        }
      }
    }
    
    // 5. Se já temos o campo pontosTuristicos no JSON, usá-lo diretamente
    if (typeof texto === 'object' && texto.pontosTuristicos && Array.isArray(texto.pontosTuristicos)) {
      for (const ponto of texto.pontosTuristicos) {
        if (!pontosTuristicos.includes(ponto)) {
          pontosTuristicos.push(ponto);
        }
      }
    }
    
    // Limitar a quantidade de pontos turísticos para não sobrecarregar
    return pontosTuristicos.slice(0, 5);
  },
  
  // Método para chamar a API do Vercel com suporte a retry e exponential backoff
  async callVercelAPI(data, retryCount = 0) {
    try {
      console.log(`Chamando API Vercel com dados:`, data);
      
      // URL absoluta da API
      const apiUrl = this.config.apiEndpoint;
      const baseUrl = window.location.origin;
      
      // Criar URL completa se for relativa
      const fullUrl = apiUrl.startsWith('http') ? apiUrl : baseUrl + apiUrl;
      
      console.log('Enviando requisição para:', fullUrl);

      // Gerar o prompt otimizado para recomendações
      const prompt = this.gerarPromptParaDestinos(data);
      
      // Adicionar o prompt aos dados
      const requestData = {
        ...data,
        prompt: prompt
      };

      // Implementar retry automático com exponential backoff
      let retryDelay = this.config.retryDelay;
      let maxRetries = this.config.maxRetries;
      let lastError = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          console.log(`Tentativa ${attempt} de ${maxRetries} após ${retryDelay}ms...`);
          await this.sleep(retryDelay);
          retryDelay *= 2; // Backoff exponencial
        }

        try {
          // Criar controller para timeout
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
            // Adicionando keepalive para manter conexão
            keepalive: true
          });
          
          // Limpar timeout
          clearTimeout(timeoutId);
          
          // Verificar se a resposta foi bem-sucedida
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
          
          // Verificar se é um erro de timeout ou aborto
          const isTimeoutError = fetchError.name === 'AbortError' || fetchError.message.includes('timeout');
          
          // Verificar se temos mais tentativas disponíveis
          if (attempt < maxRetries) {
            // Continuar para próxima tentativa
            this.reportarProgresso('retry', 50, `Tentando novamente... (${attempt + 1}/${maxRetries})`);
            continue;
          } else {
            // Se for a última tentativa, lançar o erro
            throw fetchError;
          }
        }
      }
      
      // Se chegou aqui, todas as tentativas falharam
      throw lastError || new Error('Falha em todas as tentativas de conexão');
      
    } catch (error) {
      console.error('Erro ao chamar API Vercel:', error);
      
      // Se for erro de CORS, tentar com formatos alternativos
      if (error.message.includes('CORS') && retryCount < 1) {
        console.log('Erro de CORS detectado, tentando abordagem alternativa...');
        try {
          // Tentar com jsonp ou outro método
          // Esta é apenas uma simulação de resposta para não travar o fluxo
          console.log('Retornando dados simulados devido ao erro de CORS');
          return {
            tipo: "simulado-cors",
            conteudo: JSON.stringify(this.config.mockData)
          };
        } catch (corsError) {
          console.error('Erro na abordagem alternativa para CORS:', corsError);
        }
      }
      
      // Simulação de resposta para não travar o fluxo
      console.log('Retornando dados simulados devido ao erro');
      return {
        tipo: "simulado-error",
        conteudo: JSON.stringify(this.config.mockData)
      };
    }
  },
  
  // Método atualizado para buscar imagens para um destino, utilizando pontos turísticos
  async buscarImagensParaDestino(destino, pais, descricao = '', porque = '', 
                               pontosTuristicos = [], quantidadeImagens = 2) {
    try {
      // Verificar se já temos no cache para este destino e ponto turístico
      const cacheKey = `${destino}_${pontosTuristicos.join('_')}`;
      if (this._cacheImagens[cacheKey]) {
        console.log(`Usando imagens em cache para: ${destino}`);
        // Selecionar apenas a quantidade solicitada
        return this._cacheImagens[cacheKey].slice(0, quantidadeImagens);
      }
      
      // Se não temos pontos turísticos explícitos, tentar extraí-los do texto
      if (!pontosTuristicos || pontosTuristicos.length === 0) {
        // Combinar descrição e motivo para melhorar a extração
        const textoCompleto = `${descricao} ${porque}`.trim();
        pontosTuristicos = this.extrairPontosTuristicos(textoCompleto, destino);
        console.log(`Pontos turísticos extraídos para ${destino}:`, pontosTuristicos);
      }
      
      // Tratar o caso em que pontosTuristicos é uma string única
      if (typeof pontosTuristicos === 'string') {
        pontosTuristicos = [pontosTuristicos];
      }
      
      // Combinar descrição e motivo para melhorar a consulta
      const descricaoCompleta = `${descricao} ${porque}`.trim();
      const query = `${destino} ${pais}`;
      
      console.log(`Buscando imagens para: ${query} com pontos turísticos:`, pontosTuristicos);
      
      // URL da API de imagens
      const apiUrl = this.config.imageApiEndpoint;
      const baseUrl = window.location.origin;
      
      // Criar URL completa se for relativa
      const fullUrl = apiUrl.startsWith('http') ? apiUrl : baseUrl + apiUrl;
      
      // Adicionar parâmetros como query string
      const url = new URL(fullUrl);
      url.searchParams.append('query', query);
      url.searchParams.append('perPage', quantidadeImagens); // Usar a quantidade solicitada
      url.searchParams.append('descricao', descricaoCompleta);
      
      // Adicionar pontos turísticos se existirem
      if (pontosTuristicos && pontosTuristicos.length > 0) {
        url.searchParams.append('pontosTuristicos', JSON.stringify(pontosTuristicos));
      }
      
      console.log('Enviando requisição para API de imagens:', url.toString());
      
      // Implementar retry automático com exponential backoff
      let retryDelay = this.config.retryDelay;
      let maxRetries = 2; // Menos tentativas para imagens
      let lastError = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          console.log(`Tentativa de imagem ${attempt} de ${maxRetries} após ${retryDelay}ms...`);
          await this.sleep(retryDelay);
          retryDelay *= 2; // Backoff exponencial
        }

        try {
          // Criar controller para timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // Timeout mais curto para imagens
          
          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            },
            signal: controller.signal,
            keepalive: true
          });
          
          // Limpar timeout
          clearTimeout(timeoutId);
          
          // Verificar se a resposta foi bem-sucedida
          if (!response.ok) {
            throw new Error(`Erro ao buscar imagens: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          console.log(`Imagens recebidas para ${destino}:`, data.images?.length || 0);
          
          if (data.images && data.images.length > 0) {
            // Verificar e completar metadados se estiverem faltando
            data.images = data.images.map(img => ({
              ...img,
              photographerUrl: img.photographerUrl || '#',
              sourceUrl: img.sourceUrl || '#',
              alt: img.alt || `${destino}, ${pais}`,
              photographerId: img.photographerId || 'unknown',
              pontoTuristico: img.pontoTuristico || (pontosTuristicos.length > 0 ? pontosTuristicos[0] : null)
            }));
            
            // Salvar no cache
            this._cacheImagens[cacheKey] = data.images;
            
            return data.images.slice(0, quantidadeImagens);
          } else {
            throw new Error('Nenhuma imagem encontrada');
          }
          
        } catch (fetchError) {
          lastError = fetchError;
          console.warn(`Tentativa de imagem ${attempt + 1} falhou:`, fetchError.message);
          
          // Continuar para próxima tentativa exceto na última
          if (attempt === maxRetries) throw fetchError;
        }
      }
      
      // Se chegou aqui, todas as tentativas falharam
      throw lastError || new Error('Falha em todas as tentativas de busca de imagens');
      
    } catch (error) {
      console.error(`Erro ao buscar imagens para ${destino}:`, error);
      
      // Retornar imagens FALLBACK mais robustas usando múltiplas estratégias
      const fallbackImages = [
        {
          url: `https://source.unsplash.com/featured/?${encodeURIComponent(destino + ' ' + pais)}`,
          source: "unsplash-fallback",
          photographer: "Unsplash",
          photographerId: "unsplash",
          photographerUrl: "https://unsplash.com",
          sourceUrl: `https://unsplash.com/s/photos/${encodeURIComponent(destino)}`,
          downloadUrl: `https://source.unsplash.com/featured/?${encodeURIComponent(destino + ' ' + pais)}`,
          alt: `${destino}, ${pais}`,
          pontoTuristico: pontosTuristicos.length > 0 ? pontosTuristicos[0] : null
        }
      ];
      
      // Adicionar uma segunda imagem se necessário
      if (quantidadeImagens > 1) {
        fallbackImages.push({
          url: `https://source.unsplash.com/featured/?${encodeURIComponent(destino + ' tourism')}`,
          source: "unsplash-fallback",
          photographer: "Unsplash",
          photographerId: "unsplash",
          photographerUrl: "https://unsplash.com",
          sourceUrl: `https://unsplash.com/s/photos/${encodeURIComponent(destino + '-tourism')}`,
          downloadUrl: `https://source.unsplash.com/featured/?${encodeURIComponent(destino + ' tourism')}`,
          alt: `${destino}, ${pais} - Atrações turísticas`,
          pontoTuristico: pontosTuristicos.length > 1 ? pontosTuristicos[1] : (pontosTuristicos.length > 0 ? pontosTuristicos[0] : null)
        });
      }
      
      // Adicionar placeholder como último recurso se necessário
      if (fallbackImages.length < quantidadeImagens) {
        fallbackImages.push({
          url: `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(destino)}`,
          source: "placeholder",
          photographer: "Placeholder",
          photographerId: "placeholder",
          photographerUrl: "#",
          sourceUrl: "#",
          downloadUrl: `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(destino)}`,
          alt: `${destino}, ${pais}`,
          pontoTuristico: null
        });
      }
      
      return fallbackImages.slice(0, quantidadeImagens);
    }
  },
  
  // Método atualizado para buscar imagens para todos os destinos nas recomendações
  async enriquecerRecomendacoesComImagens(recomendacoes) {
    if (!recomendacoes) return recomendacoes;
    
    this.reportarProgresso('imagens', 80, 'Buscando imagens para os destinos...');
    
    try {
      // Clonar objeto para não modificar o original
      const recomendacoesEnriquecidas = JSON.parse(JSON.stringify(recomendacoes));
      
      // Array de promessas para buscar todas as imagens em paralelo
      const promessasImagens = [];
      
      // Buscar imagens para o destino principal (2 imagens)
      if (recomendacoesEnriquecidas.topPick) {
        // Extrair pontos turísticos do topPick
        let pontosTuristicos = [];
        
        // Verificar se já temos pontos turísticos explícitos
        if (recomendacoesEnriquecidas.topPick.pontosTuristicos && 
            Array.isArray(recomendacoesEnriquecidas.topPick.pontosTuristicos)) {
          pontosTuristicos = recomendacoesEnriquecidas.topPick.pontosTuristicos;
        } else {
          // Combinar todos os campos de texto para extração
          const textoCompleto = `${recomendacoesEnriquecidas.topPick.descricao || ''} 
                             ${recomendacoesEnriquecidas.topPick.porque || ''} 
                             ${recomendacoesEnriquecidas.topPick.destaque || ''}`.trim();
          
          pontosTuristicos = this.extrairPontosTuristicos(textoCompleto, recomendacoesEnriquecidas.topPick.destino);
          
          // Guardar os pontos turísticos extraídos no objeto
          recomendacoesEnriquecidas.topPick.pontosTuristicos = pontosTuristicos;
        }
        
        promessasImagens.push(
          this.buscarImagensParaDestino(
            recomendacoesEnriquecidas.topPick.destino,
            recomendacoesEnriquecidas.topPick.pais,
            recomendacoesEnriquecidas.topPick.descricao,
            recomendacoesEnriquecidas.topPick.porque,
            pontosTuristicos,
            this.config.imagensQtdPorTipo.topPick
          ).then(imagens => {
            recomendacoesEnriquecidas.topPick.imagens = imagens;
          })
        );
      }
      
      // Buscar imagens para as alternativas (1 imagem por alternativa)
      if (recomendacoesEnriquecidas.alternativas && Array.isArray(recomendacoesEnriquecidas.alternativas)) {
        recomendacoesEnriquecidas.alternativas.forEach((alternativa, index) => {
          // Extrair pontos turísticos de cada alternativa
          let pontosTuristicos = [];
          
          // Verificar se já temos pontos turísticos explícitos
          if (alternativa.pontosTuristicos && Array.isArray(alternativa.pontosTuristicos)) {
            pontosTuristicos = alternativa.pontosTuristicos;
          } else {
            // Usar o campo "porque" para extrair pontos turísticos
            pontosTuristicos = this.extrairPontosTuristicos(alternativa.porque || '', alternativa.destino);
            
            // Guardar os pontos turísticos extraídos no objeto
            alternativa.pontosTuristicos = pontosTuristicos;
          }
          
          promessasImagens.push(
            this.buscarImagensParaDestino(
              alternativa.destino,
              alternativa.pais,
              "", // Sem descrição dedicada
              alternativa.porque, // Usar o campo "porque" como descrição
              pontosTuristicos,
              this.config.imagensQtdPorTipo.alternativa
            ).then(imagens => {
              recomendacoesEnriquecidas.alternativas[index].imagens = imagens;
            })
          );
        });
      }
      
      // Buscar imagens para o destino surpresa (2 imagens)
      if (recomendacoesEnriquecidas.surpresa) {
        // Extrair pontos turísticos da surpresa
        let pontosTuristicos = [];
        
        // Verificar se já temos pontos turísticos explícitos
        if (recomendacoesEnriquecidas.surpresa.pontosTuristicos && 
            Array.isArray(recomendacoesEnriquecidas.surpresa.pontosTuristicos)) {
          pontosTuristicos = recomendacoesEnriquecidas.surpresa.pontosTuristicos;
        } else {
          // Combinar todos os campos de texto para extração
          const textoCompleto = `${recomendacoesEnriquecidas.surpresa.descricao || ''} 
                             ${recomendacoesEnriquecidas.surpresa.porque || ''} 
                             ${recomendacoesEnriquecidas.surpresa.destaque || ''}`.trim();
          
          pontosTuristicos = this.extrairPontosTuristicos(textoCompleto, recomendacoesEnriquecidas.surpresa.destino);
          
          // Guardar os pontos turísticos extraídos no objeto
          recomendacoesEnriquecidas.surpresa.pontosTuristicos = pontosTuristicos;
        }
        
        promessasImagens.push(
          this.buscarImagensParaDestino(
            recomendacoesEnriquecidas.surpresa.destino,
            recomendacoesEnriquecidas.surpresa.pais,
            recomendacoesEnriquecidas.surpresa.descricao,
            recomendacoesEnriquecidas.surpresa.porque,
            pontosTuristicos,
            this.config.imagensQtdPorTipo.surpresa
          ).then(imagens => {
            recomendacoesEnriquecidas.surpresa.imagens = imagens;
          })
        );
      }
      
      // Aguardar todas as promessas com um timeout geral
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao buscar imagens')), 45000)
      );
      
      // Race entre o timeout e todas as promessas de imagens
      await Promise.race([
        // allSettled permite que algumas falhem sem interromper todo o processo
        Promise.allSettled(promessasImagens),
        timeoutPromise
      ]);
      
      this.reportarProgresso('imagens', 100, 'Imagens carregadas com sucesso!');
      
      console.log('Recomendações enriquecidas com imagens:', recomendacoesEnriquecidas);
      return recomendacoesEnriquecidas;
    } catch (error) {
      console.error('Erro ao enriquecer recomendações com imagens:', error);
      this.reportarProgresso('imagens', 100, 'Erro ao carregar algumas imagens');
      
      // Retornar recomendações originais em caso de erro
      return recomendacoes;
    }
  },
  
  // Método para validar a estrutura dos dados das recomendações
  validarEstruturaDados(dados) {
    // Verificar se dados é nulo ou undefined
    if (!dados) {
      console.error('Dados de recomendações são nulos ou indefinidos');
      return {...this.config.mockData};
    }
    
    // Verificar estrutura básica
    if (!dados.topPick) {
      console.error('Destino principal não encontrado nos dados');
      dados.topPick = this.config.mockData.topPick;
    }
    
    // Verificar se alternativas existem
    if (!dados.alternativas || !Array.isArray(dados.alternativas)) {
      console.error('Alternativas não encontradas ou não são um array');
      dados.alternativas = [...this.config.mockData.alternativas];
    }
    
    // Garantir que haja alternativas suficientes
    if (dados.alternativas.length < 1) {
      console.warn('Alternativas insuficientes, adicionando dados fictícios');
      dados.alternativas = [...this.config.mockData.alternativas];
    }
    
    // Garantir que temos o destino surpresa
    if (!dados.surpresa && dados.alternativas.length > 0) {
      console.log('Destino surpresa não encontrado, criando a partir de alternativa');
      dados.surpresa = {
        ...dados.alternativas.pop(),
        descricao: "Um destino surpreendente que poucos conhecem!",
        destaque: "Experiência única que vai te surpreender",
        comentario: "Este é um destino surpresa especial que farejei só para você! Confie no meu faro! 🐾🎁"
      };
    }
    
    // Se ainda não tivermos surpresa, criar uma fictícia
    if (!dados.surpresa) {
      console.log('Criando destino surpresa fictício');
      dados.surpresa = this.config.mockData.surpresa;
    }
    
    // Verificar e adicionar pontos turísticos se estiverem faltando
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
    
    // Verificar e adicionar informações climáticas se estiverem faltando
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
  
  // Método para obter recomendações de destinos com Perplexity
  async obterRecomendacoes(preferenciasUsuario) {
    if (!this.isInitialized()) {
      this.init();
    }
    
    // Validar entrada
    if (!preferenciasUsuario) {
      throw new Error('Preferências de usuário não fornecidas');
    }
    
    console.log('Recebendo pedido de recomendações com preferências:', preferenciasUsuario);
    
    // Gerar ID para rastrear requisições duplicadas
    const requestId = this.generateRequestId(preferenciasUsuario);
    
    // Evitar chamadas duplicadas para o mesmo requestId
    if (this._requestsInProgress[requestId]) {
      console.log('Requisição já em andamento para:', requestId);
      this.reportarProgresso('aguardando', 50, 'Aguardando requisição em andamento...');
      
      // Aguardar a requisição em andamento ser concluída
      try {
        return await this._requestsInProgress[requestId];
      } catch (error) {
        console.error('Erro na requisição em andamento:', error);
        // Continuar com uma nova requisição
      }
    }
    
    // Criar uma promise para esta requisição e armazená-la
    const requestPromise = (async () => {
      try {
        // Reportar progresso inicial
        this.reportarProgresso('inicializando', 10, 'Preparando recomendações personalizadas...');
        
        // Reportar progresso
        this.reportarProgresso('processando', 30, 'Analisando suas preferências de viagem...');
        
        // Chamar a API do Vercel para processamento com IA
        const resposta = await this.callVercelAPI(preferenciasUsuario);
        
        // Verificar formato da resposta
        if (!resposta) {
          throw new Error('Resposta vazia do serviço de IA');
        }
        
        // Reportar progresso
        this.reportarProgresso('finalizando', 70, 'Encontrando os destinos perfeitos para você...');
        
        // Extrair e processar recomendações
        let recomendacoes;
        try {
          // Se for tipo erro mas com dados fallback
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
          recomendacoes = {...this.config.mockData};
        }
        
        // Validar e corrigir estrutura das recomendações
        try {
          recomendacoes = this.validarEstruturaDados(recomendacoes);
        } catch (validationError) {
          console.error('Erro na validação dos dados:', validationError);
          console.log('Usando dados mockados devido a erro de validação');
          this.reportarProgresso('fallback', 85, 'Usando dados padrão devido a erro de validação');
          recomendacoes = {...this.config.mockData};
        }
        
        // Garantir que temos 4 alternativas exatamente
        while (recomendacoes.alternativas && recomendacoes.alternativas.length > 4) {
          recomendacoes.alternativas.pop();
        }
        
        // Adicionar alternativas se estiverem faltando
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
        
        // Enriquecer com imagens
        this.reportarProgresso('imagens', 85, 'Buscando imagens para os destinos...');
        try {
          recomendacoes = await this.enriquecerRecomendacoesComImagens(recomendacoes);
        } catch (imageError) {
          console.error('Erro ao adicionar imagens às recomendações:', imageError);
          // Continuar com as recomendações sem imagens
        }
        
        // Reportar progresso final
        this.reportarProgresso('concluido', 100, 'Destinos encontrados!');
        
        // Salvar no localStorage apenas para uso em outras páginas se necessário
        localStorage.setItem('benetrip_recomendacoes', JSON.stringify(recomendacoes));
        
        return recomendacoes;
      } catch (erro) {
        console.error('Erro ao obter recomendações:', erro);
        
        // Usar dados mockados em caso de erro
        console.log('Usando dados mockados devido a erro');
        this.reportarProgresso('mockados', 100, 'Usando recomendações padrão devido a erro...');
        
        const dadosMockados = {...this.config.mockData};
        
        // Salvar no localStorage para uso em outras páginas se necessário
        localStorage.setItem('benetrip_recomendacoes', JSON.stringify(dadosMockados));
        
        return dadosMockados;
      } finally {
        // Remover a promise em andamento quando terminar
        delete this._requestsInProgress[requestId];
      }
    })();
    
    // Armazenar a promise para evitar chamadas duplicadas
    this._requestsInProgress[requestId] = requestPromise;
    
    return requestPromise;
  }
};

// Inicializar o serviço quando o script for carregado
window.BENETRIP_AI.init();
