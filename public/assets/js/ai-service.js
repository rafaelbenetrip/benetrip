// Serviço de IA para o Benetrip - SEM projeções climáticas
window.BENETRIP_AI = {
  config: {
    apiEndpoint: '/api/recommendations',
    imageApiEndpoint: '/api/image-search',
    apiTimeout: 90000,
    maxRetries: 2,
    retryDelay: 2000,
    imagensQtdPorTipo: {
      topPick: 2,
      alternativa: 1,
      surpresa: 2
    }
  },
  
  init() {
    console.log('Inicializando serviço de IA do Benetrip - SEM projeções climáticas');
    this.initialized = true;
    this._requestsInProgress = {};
    this._cacheImagens = {};
    this._cacheRecomendacoes = {};
    return this;
  },
  
  isInitialized() {
    return this.initialized === true;
  },

  generateRequestId(preferences) {
    const campos = [
      preferences.cidade_partida?.name || preferences.cidade_partida || '',
      preferences.companhia || '0',
      preferences.quantidade_familia || '',
      preferences.quantidade_amigos || '',
      preferences.preferencia_viagem || '0',
      preferences.datas?.dataIda || '',
      preferences.datas?.dataVolta || '',
      preferences.viagem_carro || '0',
      preferences.distancia_maxima || '',
      preferences.moeda_escolhida || 'BRL',
      preferences.orcamento_valor || '',
      JSON.stringify(preferences.datas || {}),
    ].join('_');
    
    return this.simpleHash(campos);
  },
  
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  },
  
  extrairJSON(texto) {
    if (texto && typeof texto === 'object') {
      return texto;
    }
    
    if (!texto) {
      throw new Error('Resposta vazia da LLM - não há dados para processar');
    }
    
    try {
      return JSON.parse(texto);
    } catch (e) {
      try {
        const blocoCodigo = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (blocoCodigo && blocoCodigo[1]) {
          return JSON.parse(blocoCodigo[1].trim());
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
              return JSON.parse(texto.substring(start, i + 1));
            }
          }
        }
        
        const match = texto.match(/(\{[\s\S]*\})/);
        if (match && match[0]) {
          return JSON.parse(match[0]);
        }
        
        throw new Error('Não foi possível extrair JSON válido da resposta da LLM');
      } catch (innerError) {
        throw new Error(`Falha ao processar resposta da LLM: ${innerError.message}`);
      }
    }
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // ❌ REMOVIDO: determinarEstacaoDoAno - deixar LLM decidir
  // ❌ REMOVIDO: todas as funções de projeção climática
  
  // Manter apenas funções auxiliares básicas
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

  calcularDuracaoViagem(dataIda, dataVolta) {
    const ida = new Date(dataIda);
    const volta = new Date(dataVolta);
    const diffTime = Math.abs(volta - ida);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  },

  // ✅ CORRIGIDO: Prompt SEM projeções climáticas
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
      conhece_destino = 0,
      viagem_carro = 0,
      distancia_maxima = '500'
    } = dados;

    const cidadeOrigem = cidade_partida?.name || "Cidade não especificada";
    const moeda = moeda_escolhida;
    const orcamento = orcamento_valor ? parseInt(orcamento_valor, 10) : 2500;
    const isViagemCarro = parseInt(viagem_carro, 10) === 1;
    const distanciaMax = distancia_maxima || '500';
    
    // ✅ CORRIGIDO: Apenas data, SEM determinar estação
    const dataIda = datas.dataIda || new Date().toISOString().split('T')[0];
    const dataVolta = datas.dataVolta || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const duracaoViagem = this.calcularDuracaoViagem(dataIda, dataVolta);
    
    // ❌ REMOVIDO: const estacaoViagem = this.determinarEstacaoDoAno(dataIda);
    
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
    if (isViagemCarro) {
      mensagemOrcamento = `🚗 VIAGEM DE CARRO SELECIONADA:
- O usuário prefere viajar de carro/road trip
- Distância máxima desejada: ${distanciaMax} quilômetros de ${cidadeOrigem}
- IMPORTANTE: Todos os destinos DEVEM estar dentro do raio de ${distanciaMax}km
- Considere estradas em bom estado e infraestrutura adequada
- Inclua informações sobre rotas, paradas estratégicas e tempo de viagem
- Destinos DEVEM ser acessíveis por estrada a partir de ${cidadeOrigem}`;
    } else {
      if (orcamento < 1000) {
        mensagemOrcamento = `Orçamento muito restrito de ${orcamento} ${moeda} por pessoa para voos (ida e volta). Priorize destinos próximos e econômicos.`;
      } else if (orcamento < 2000) {
        mensagemOrcamento = `Orçamento econômico de ${orcamento} ${moeda} por pessoa para voos (ida e volta). Foque em opções com boa relação custo-benefício.`;
      } else if (orcamento < 4000) {
        mensagemOrcamento = `Orçamento moderado de ${orcamento} ${moeda} por pessoa para voos (ida e volta). Pode incluir destinos de médio alcance com preços acessíveis.`;
      } else {
        mensagemOrcamento = `Orçamento confortável de ${orcamento} ${moeda} por pessoa para voos (ida e volta). Pode incluir destinos mais distantes e premium.`;
      }
    }

    // ✅ CORRIGIDO: Prompt básico SEM projeções climáticas
    const promptBase = `Crie recomendações de viagem que respeitam ESTRITAMENTE as preferências do usuário:
${mensagemOrcamento}

PERFIL DO VIAJANTE:
- Partindo de: ${cidadeOrigem} ${sugestaoDistancia}
- Tipo de transporte: ${isViagemCarro ? `🚗 CARRO (máx ${distanciaMax}km)` : '✈️ AVIÃO'}
- Viajando: ${companheiroTexto}
- Número de pessoas: ${quantidadePessoas}
- Atividades preferidas: ${preferenciaTexto} e ${atracaoTexto}
- Período da viagem: ${dataIda} a ${dataVolta} (${duracaoViagem} dias)
- Experiência como viajante: ${conhece_destino === 1 ? 'Com experiência' : 'Iniciante'} 
- Preferência por destinos: ${this.getTipoDestinoText(tipo_destino)}
- Popularidade do destino: ${this.getFamaDestinoText(fama_destino)}`;

    let instrucoesTipoTransporte = "";
    if (isViagemCarro) {
      instrucoesTipoTransporte = `
INSTRUÇÕES ESPECIAIS PARA ROAD TRIP:
1. TODOS os destinos DEVEM estar dentro do raio de ${distanciaMax}km de ${cidadeOrigem}
2. Considere apenas destinos acessíveis por estradas em bom estado
3. Inclua tempo estimado de viagem de carro para cada destino
4. Mencione rodovias/estradas principais para chegar ao destino
5. Considere infraestrutura para viajantes (postos, restaurantes, hotéis na rota)
6. Para CADA destino, inclua: distanciaRodoviaria, tempoViagem, rotaRecomendada
7. Evite destinos que exijam travessia de fronteiras complexas
8. Priorize destinos com estacionamento fácil nos pontos turísticos`;
    } else {
      instrucoesTipoTransporte = `
INSTRUÇÕES PARA VIAGENS AÉREAS:
1. O preço do VOO de CADA destino DEVE ser MENOR que o orçamento máximo de ${orcamento} ${moeda}
2. Para CADA destino, inclua o código IATA (3 letras) do aeroporto principal
3. Considere conexões e tempo de voo a partir de ${cidadeOrigem}
4. Inclua estimativas realistas de preços para voos (ida e volta)`;
    }

    // ✅ CORRIGIDO: Instruções SEM projeções climáticas específicas
    const instrucoesFinal = `
INSTRUÇÕES GERAIS:
1. INCLUA ESTIMATIVAS REALISTAS de preços para ${isViagemCarro ? 'combustível/pedágios' : 'voos'} e hospedagem por noite para TODOS os destinos
2. Para as datas ${dataIda} a ${dataVolta}, VOCÊ MESMO determine as condições climáticas apropriadas para cada destino sugerido
3. Forneça um mix equilibrado: inclua tanto destinos populares quanto alternativas
4. Forneça EXATAMENTE 4 destinos alternativos diferentes entre si
5. Considere as datas da viagem para sugerir destinos com clima e condições adequadas
6. Inclua destinos de diferentes regiões/estados
7. Para CADA destino, INCLUA PONTOS TURÍSTICOS ESPECÍFICOS E CONHECIDOS
8. Os comentários da Tripinha DEVEM mencionar pelo menos um dos pontos turísticos do destino e ser escritos em primeira pessoa
9. IMPORTANTE: Determine VOCÊ MESMO a estação do ano e condições climáticas para cada destino nas datas especificadas

Forneça no formato JSON exato abaixo, SEM formatação markdown:`;

    // Formato JSON mantido, mas sem referências a estações pré-determinadas
    const formatoJSON = isViagemCarro ? `
{
  "tipoTransporte": "carro",
  "topPick": {
    "destino": "Nome da Cidade",
    "estado": "Nome do Estado",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "distanciaRodoviaria": "${distanciaMax}km ou menos",
    "tempoViagem": "X horas de carro",
    "rotaRecomendada": "Principal rodovia/estrada para chegar",
    "descricao": "Breve descrição do destino",
    "porque": "Razão específica para visitar de carro",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário da Tripinha em primeira pessoa sobre a road trip",
    "pontosTuristicos": ["Nome do Primeiro Ponto Turístico", "Nome do Segundo Ponto Turístico"],
    "clima": {
      "temperatura": "Faixa de temperatura que VOCÊ determinou para ${dataIda} a ${dataVolta}",
      "condicoes": "Condições climáticas que VOCÊ avaliou para o período",
      "recomendacoes": "Suas recomendações baseadas no clima esperado"
    },
    "infraestrutura": {
      "estacionamento": "Informações sobre estacionamento nos pontos turísticos",
      "rota": "Detalhes da melhor rota de carro"
    },
    "preco": {
      "combustivel": número_estimado_combustivel_ida_volta,
      "pedagios": número_estimado_pedagios,
      "hotel": número_por_noite
    }
  },
  "alternativas": [
    {
      "destino": "Nome da Cidade 1",
      "estado": "Nome do Estado 1",
      "pais": "Nome do País 1", 
      "codigoPais": "XX",
      "distanciaRodoviaria": "XXXkm",
      "tempoViagem": "X horas",
      "rotaRecomendada": "Rodovia principal",
      "porque": "Razão específica para visitar",
      "pontosTuristicos": ["Ponto 1", "Ponto 2"],
      "clima": { "temperatura": "Temperatura que VOCÊ determinou para o período" },
      "preco": { "combustivel": número, "pedagios": número, "hotel": número }
    }
  ],
  "surpresa": {
    "destino": "Nome da Cidade",
    "estado": "Nome do Estado",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "distanciaRodoviaria": "XXXkm",
    "tempoViagem": "X horas",
    "rotaRecomendada": "Rodovia principal",
    "descricao": "Breve descrição do destino",
    "porque": "Razão para visitar, destacando o fator surpresa",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário da Tripinha sobre esta road trip surpresa",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"],
    "clima": {
      "temperatura": "Temperatura que VOCÊ avaliou para ${dataIda} a ${dataVolta}",
      "condicoes": "Condições climáticas que VOCÊ determinou",
      "recomendacoes": "Suas recomendações climáticas"
    },
    "infraestrutura": {
      "estacionamento": "Informações sobre estacionamento",
      "rota": "Detalhes da rota"
    },
    "preco": {
      "combustivel": número,
      "pedagios": número,
      "hotel": número
    }
  },
  "dicasRoadTrip": "Dicas específicas para esta road trip"
}` : `
{
  "tipoTransporte": "aviao",
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão específica para visitar",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário da Tripinha em primeira pessoa",
    "pontosTuristicos": ["Nome do Primeiro Ponto Turístico", "Nome do Segundo Ponto Turístico"],
    "clima": {
      "temperatura": "Temperatura que VOCÊ determinou para ${dataIda} a ${dataVolta}",
      "condicoes": "Condições climáticas que VOCÊ avaliou para o período",
      "recomendacoes": "Suas recomendações baseadas no clima"
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
      "pontosTuristicos": ["Ponto 1", "Ponto 2"],
      "clima": { "temperatura": "Temperatura que VOCÊ determinou" },
      "aeroporto": { "codigo": "XYZ", "nome": "Nome do Aeroporto" },
      "preco": { "voo": número, "hotel": número }
    }
  ],
  "surpresa": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino",
    "porque": "Razão para visitar, destacando o fator surpresa",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Comentário da Tripinha em primeira pessoa",
    "pontosTuristicos": ["Ponto 1", "Ponto 2"],
    "clima": {
      "temperatura": "Temperatura que VOCÊ avaliou para ${dataIda} a ${dataVolta}",
      "condicoes": "Condições climáticas que VOCÊ determinou",
      "recomendacoes": "Suas recomendações climáticas"
    },
    "aeroporto": {
      "codigo": "XYZ",
      "nome": "Nome do Aeroporto"
    },
    "preco": {
      "voo": número,
      "hotel": número
    }
  }
}`;

    return promptBase + instrucoesTipoTransporte + instrucoesFinal + formatoJSON;
  },
  
  // Resto das funções mantidas...
  async callVercelAPI(data, retryCount = 0) {
    // [Código mantido da versão anterior]
  },
  
  // Funções de imagem mantidas...
  extrairPontosTuristicos(texto, destino) {
    // [Código mantido]
  },
  
  async buscarImagensParaDestino(destino, pais, descricao = '', porque = '', 
                               pontosTuristicos = [], quantidadeImagens = 2) {
    // [Código mantido]
  },
  
  async enriquecerRecomendacoesComImagens(recomendacoes) {
    // [Código mantido]
  },
  
  reportarProgresso(fase, porcentagem, mensagem) {
    const evento = new CustomEvent('benetrip_progress', {
      detail: { fase, porcentagem, mensagem }
    });
    window.dispatchEvent(evento);
    console.log(`Progresso: ${fase} ${porcentagem}% - ${mensagem}`);
  },
  
  async obterRecomendacoes(preferenciasUsuario) {
    if (!this.isInitialized()) {
      this.init();
    }
    
    if (!preferenciasUsuario) {
      throw new Error('Preferências de usuário não fornecidas');
    }
    
    console.log('Obtendo recomendações - SEM projeções climáticas:', preferenciasUsuario);
    
    const requestId = this.generateRequestId(preferenciasUsuario);
    
    if (this._cacheRecomendacoes[requestId]) {
      console.log('Usando recomendações do cache para:', requestId);
      this.reportarProgresso('cache', 100, 'Recomendações encontradas no cache!');
      return this._cacheRecomendacoes[requestId];
    }
    
    if (this._requestsInProgress[requestId]) {
      console.log('Aguardando requisição em andamento...');
      return await this._requestsInProgress[requestId];
    }
    
    const requestPromise = (async () => {
      try {
        this.reportarProgresso('inicializando', 10, 'Preparando recomendações personalizadas...');
        this.reportarProgresso('processando', 30, 'Analisando suas preferências...');
        
        const resposta = await this.callVercelAPI(preferenciasUsuario);
        
        if (!resposta || !resposta.conteudo) {
          throw new Error('API retornou resposta vazia ou inválida');
        }
        
        this.reportarProgresso('processando', 70, 'Processando destinos encontrados...');
        
        let recomendacoes;
        try {
          recomendacoes = this.extrairJSON(resposta.conteudo);
        } catch (extractError) {
          console.error('Falha ao extrair JSON da LLM:', extractError);
          throw new Error(`LLM retornou dados inválidos: ${extractError.message}`);
        }
        
        if (!recomendacoes.topPick && !recomendacoes.alternativas) {
          throw new Error('LLM não retornou destinos válidos');
        }
        
        this.reportarProgresso('imagens', 85, 'Buscando imagens para os destinos...');
        
        try {
          recomendacoes = await this.enriquecerRecomendacoesComImagens(recomendacoes);
        } catch (imageError) {
          console.warn('Erro ao adicionar imagens:', imageError);
        }
        
        this.reportarProgresso('concluido', 100, 'Destinos encontrados!');
        
        this._cacheRecomendacoes[requestId] = recomendacoes;
        
        return recomendacoes;
        
      } catch (erro) {
        console.error('Erro ao obter recomendações:', erro);
        throw erro;
      } finally {
        delete this._requestsInProgress[requestId];
      }
    })();
    
    this._requestsInProgress[requestId] = requestPromise;
    return requestPromise;
  }
};

window.BENETRIP_AI.init();
