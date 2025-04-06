// api/flight-results.js - Otimizado para Plano PRO do Vercel
const axios = require('axios');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Restrinja em produção
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
    // AJUSTE: Removido o setTimeout inicial do backend.
    // A lógica de espera inicial deve ser implementada no frontend antes da primeira chamada a este endpoint.

    // Com plano PRO podemos usar um timeout maior, mas ainda mantendo margem de segurança
    const resultsResponse = await axios.get(resultsUrl, {
      headers: { 'Accept-Encoding': 'gzip,deflate,sdch' },
      timeout: 45000 // 45 segundos (vs limite de 60s do plano PRO) - Mantenha ou ajuste conforme necessário
    });

    console.log(`Resultados obtidos para ${uuid} - Status Travelpayouts: ${resultsResponse.status}`);

    // Analisamos a resposta para estruturar melhor ao frontend
    const data = resultsResponse.data;

    // NOVO: Logar estrutura da resposta para diagnóstico
    console.log(`Estrutura da resposta: ${typeof data === 'object' ?
      (Array.isArray(data) ? 'Array' : 'Objeto') : typeof data}`);
    if (Array.isArray(data)) {
        console.log(`Tamanho do array da resposta: ${data.length}`);
        if (data.length > 0) {
            console.log(`Chaves do primeiro item do array: ${JSON.stringify(Object.keys(data[0]))}`);
        }
    }


    // Verifica se ainda está em andamento (resposta é um array com um objeto contendo apenas search_id)
    let searchComplete = true;
    if (Array.isArray(data) && data.length === 1 &&
        Object.keys(data[0]).length === 1 && data[0].search_id === uuid) {
      console.log(`Resultados para ${uuid} ainda não estão prontos (resposta contém apenas search_id).`);
      searchComplete = false;
    }

    // Estrutura a resposta com formato consistente
    if (!searchComplete) {
      return res.status(200).json({
        search_completed: false,
        search_id: uuid,
        timestamp: new Date().toISOString(),
        // Mantém a resposta original caso o frontend precise dela
        original_response: data
      });
    }

    // Para resposta completa, esperamos um Array contendo um objeto com os dados (proposals, meta, etc.)
    // A lógica original que acessa data[0] parece correta com base na verificação de conclusão acima.
    if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object' && data[0].search_id === uuid ) { // Verifica se o objeto existe e tem search_id
      const resultsData = data[0]; // O objeto principal com os resultados
      const hasProposals = resultsData.proposals && Array.isArray(resultsData.proposals) && resultsData.proposals.length > 0;

      console.log(`Propostas encontradas para ${uuid}: ${hasProposals ? resultsData.proposals.length : 0}`);

      // NOVO: Verificar se há metadados de erro nos gates (opcional, mas útil para debug)
      if (resultsData.meta && resultsData.meta.gates) {
        const gates = resultsData.meta.gates;

        // Verificar se algum gateway reportou erro
        const gatesWithErrors = gates.filter(gate => gate.error && gate.error.code !== 0);
        if (gatesWithErrors.length > 0) {
          console.warn(`Alguns gateways reportaram erros para ${uuid}:`);
          gatesWithErrors.forEach(gate => {
            console.warn(`- Gateway ${gate.id}: Código ${gate.error.code}, Mensagem: ${gate.error.tos || 'Sem mensagem'}`);
          });
        }

        // Verificar estatísticas dos gateways
        console.log(`Estatísticas de gateways para ${uuid}:`);
        gates.forEach(gate => {
          console.log(`- Gateway ${gate.id}: Total=${gate.count || 0}, Válidos=${gate.good_count || 0}, Tempo=${gate.duration || 0}s`);
        });
      }

      if (!hasProposals) {
        console.log(`Busca completa para ${uuid}, mas sem resultados disponíveis.`);
        return res.status(200).json({
          search_completed: true,
          has_results: false,
          search_id: uuid,
          timestamp: new Date().toISOString(),
          message: "Nenhum voo encontrado para os critérios especificados.",
          ...resultsData // Mantemos os dados originais (meta, etc.) para análise
        });
      }

      // Retorna os resultados completos
      return res.status(200).json({
        search_completed: true,
        search_id: uuid,
        has_results: true,
        proposal_count: hasProposals ? resultsData.proposals.length : 0,
        timestamp: new Date().toISOString(),
        ...resultsData // Spread todos os dados do objeto de resultados (proposals, meta, etc.)
      });
    }

    // Fallback para outros formatos de resposta inesperados
    console.warn(`Formato de resposta inesperado para ${uuid}. Resposta:`, JSON.stringify(data));
    return res.status(200).json({
      search_completed: true, // Assumimos que completou, mas o formato é estranho
      search_id: uuid,
      has_results: false, // Não podemos garantir que há resultados
      timestamp: new Date().toISOString(),
      original_response: data,
      message: "Formato de resposta não esperado da API de voos."
    });

  } catch (error) {
    console.error(`!!! ERRO AO BUSCAR RESULTADOS para ${uuid} !!!`);

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
      console.error(`Erro Axios (Get Results) para ${uuid}: Status:`, error.response.status, "Data:", error.response.data);

      // Tratamento especial para 404
      if (error.response.status === 404) {
        return res.status(404).json({
          error: "ID de busca não encontrado ou expirado. Inicie uma nova busca.",
          search_id: uuid,
          timestamp: new Date().toISOString()
        });
      }

      // Outros erros da API
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
      // Outros erros internos
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
