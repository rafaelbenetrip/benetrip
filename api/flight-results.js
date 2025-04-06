// api/flight-results.js - Otimizado para Plano PRO do Vercel
const axios = require('axios');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Obter search_id/uuid da query string
  const { uuid } = req.query;

  if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
    return res.status(400).json({ error: "Parâmetro 'uuid' (search_id) é obrigatório e deve ser válido." });
  }

  console.log(`Verificando resultados para search_id (uuid): ${uuid}`);
  const resultsUrl = `https://api.travelpayouts.com/v1/flight_search_results?uuid=${uuid}`;

  try {
    // Aguardamos um pouco antes de fazer a primeira solicitação para dar tempo à API
    // Isso é importante para evitar obter uma resposta vazia muito cedo
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Com plano PRO podemos usar um timeout maior, mas ainda mantendo margem de segurança
    const resultsResponse = await axios.get(resultsUrl, {
      headers: { 'Accept-Encoding': 'gzip,deflate,sdch' },
      timeout: 45000 // 45 segundos (vs limite de 60s do plano PRO)
    });

    console.log(`Resultados obtidos para ${uuid} - Status Travelpayouts: ${resultsResponse.status}`);
    
    // Analisamos a resposta para estruturar melhor ao frontend
    const data = resultsResponse.data;
    
    // NOVO: Logar estrutura da resposta para diagnóstico
    console.log(`Estrutura da resposta: ${typeof data === 'object' ? 
      (Array.isArray(data) ? 'Array' : 'Objeto') : typeof data}`);
    console.log(`Tamanho da resposta: ${Array.isArray(data) ? data.length : 'N/A'}`);
    
    if (Array.isArray(data) && data.length === 1) {
      console.log(`Conteúdo do primeiro item: ${JSON.stringify(Object.keys(data[0]))}`);
    }
    
    // Verifica se ainda está em andamento (resposta apenas com search_id)
    let searchComplete = true;
    if (Array.isArray(data) && data.length === 1 && 
        Object.keys(data[0]).length === 1 && data[0].search_id === uuid) {
      console.log("Apenas search_id encontrado - resultados ainda não prontos");
      searchComplete = false;
    }
    
    // Estrutura a resposta com formato consistente
    if (!searchComplete) {
      return res.status(200).json({
        search_completed: false,
        search_id: uuid,
        // Podemos adicionar mais informações úteis como timestamp
        timestamp: new Date().toISOString(),
        original_response: data
      });
    }
    
    // Para resposta completa, utilizamos o Array[0] que contém os dados completos
    if (Array.isArray(data) && data.length > 0) {
      // MELHORIA: Verificação explícita para busca completa sem resultados
      const hasProposals = data[0].proposals && Array.isArray(data[0].proposals) && data[0].proposals.length > 0;
      
      console.log(`Propostas encontradas: ${hasProposals ? data[0].proposals.length : 0}`);
      
      // NOVO: Verificar se há metadados de erro nos gates
      if (data[0].meta && data[0].meta.gates) {
        const gates = data[0].meta.gates;
        
        // Verificar se algum gateway reportou erro
        const gatesWithErrors = gates.filter(gate => gate.error && gate.error.code !== 0);
        if (gatesWithErrors.length > 0) {
          console.warn('Alguns gateways reportaram erros:');
          gatesWithErrors.forEach(gate => {
            console.warn(`- Gateway ${gate.id}: Código ${gate.error.code}, Mensagem: ${gate.error.tos || 'Sem mensagem'}`);
          });
        }
        
        // Verificar se algum gateway retornou resultados
        console.log('Estatísticas de gateways:');
        gates.forEach(gate => {
          console.log(`- Gateway ${gate.id}: Total=${gate.count || 0}, Válidos=${gate.good_count || 0}, Tempo=${gate.duration || 0}s`);
        });
      }
      
      if (!hasProposals) {
        console.log("Busca completa, mas sem resultados disponíveis");
        return res.status(200).json({
          search_completed: true,
          has_results: false,
          search_id: uuid,
          timestamp: new Date().toISOString(),
          message: "Nenhum voo encontrado para os critérios especificados",
          ...data[0] // Mantemos os dados originais para análise
        });
      }
      
      return res.status(200).json({
        search_completed: true,
        search_id: uuid,
        has_results: true,
        proposal_count: hasProposals ? data[0].proposals.length : 0,
        timestamp: new Date().toISOString(),
        ...data[0] // Spread todos os dados do primeiro objeto
      });
    }
    
    // Fallback para outros formatos de resposta
    return res.status(200).json({
      search_completed: true, // Assumimos que completou
      search_id: uuid,
      has_results: false,
      timestamp: new Date().toISOString(),
      original_response: data,
      message: "Formato de resposta não esperado da API de voos"
    });

  } catch (error) {
    console.error(`!!! ERRO AO BUSCAR RESULTADOS para ${uuid} !!!`, error);
    
    // Tratamento específico para timeout
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.error(`Timeout ao buscar resultados para ${uuid}:`, error.message);
      return res.status(504).json({ 
        error: "Tempo limite excedido ao buscar resultados. A API externa está demorando mais que o esperado.",
        is_timeout: true,
        search_id: uuid,
        timestamp: new Date().toISOString()
      });
    }
    
    if (error.response) {
      // Erro com resposta da API
      console.error("Erro Axios (Get Results): Status:", error.response.status, "Data:", error.response.data);
      
      // Tratamento especial para 404
      if (error.response.status === 404) {
        return res.status(404).json({
          error: "ID de busca não encontrado ou expirado. Inicie uma nova busca.",
          search_id: uuid,
          timestamp: new Date().toISOString()
        });
      }
      
      return res.status(error.response.status).json({
        error: `Erro ${error.response.status} ao obter resultados da API externa.`,
        details: error.response.data,
        search_id: uuid,
        timestamp: new Date().toISOString()
      });
    } else if (error.request) {
      // Erro sem resposta (timeout, rede)
      console.error(`Erro Axios (Get Results) para ${uuid}: Nenhuma resposta recebida:`, error.message);
      return res.status(504).json({ 
        error: "Nenhuma resposta da API externa ao buscar resultados (Gateway Timeout).",
        search_id: uuid,
        timestamp: new Date().toISOString()
      });
    } else {
      // Outros erros
      console.error(`Erro interno (Get Results) para ${uuid}:`, error.message);
      return res.status(500).json({ 
        error: "Erro interno no servidor ao buscar resultados.", 
        details: error.message,
        search_id: uuid,
        timestamp: new Date().toISOString()
      });
    }
  }
};
