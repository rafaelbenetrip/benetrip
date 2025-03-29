// api/recommendations.js
import { OpenAI } from 'openai';

export default async function handler(req, res) {
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Lidar com requisições OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Apenas permitir requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    // Log para debugging
    console.log('Recebendo requisição para recomendações');
    
    // Extrair dados da requisição
    const requestData = req.body;
    console.log('Dados recebidos:', JSON.stringify(requestData).substring(0, 200) + '...');
    
    // Verificar se temos informações suficientes
    if (!requestData) {
      throw new Error("Dados de preferências não fornecidos");
    }
    
    // Gerar prompt baseado nos dados do usuário
    const prompt = gerarPromptParaDestinos(requestData);
    
    // Inicializar a API OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    console.log('Enviando requisição para OpenAI...');
    
    // Fazer a chamada para a API da OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Você é a Tripinha, uma cachorra vira-lata caramelo especialista em viagens da Benetrip."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });
    
    console.log('Resposta recebida da OpenAI');
    
    // Retornar a resposta formatada
    return res.status(200).json({
      tipo: "openai",
      conteudo: completion.choices[0].message.content
    });
    
  } catch (error) {
    console.error('Erro na API de recomendações:', error);
    
    return res.status(500).json({ 
      error: "Erro ao processar solicitação de IA",
      message: error.message
    });
  }
}

// Função para gerar prompt adequado para a IA
function gerarPromptParaDestinos(dados) {
  // Extrair informações relevantes dos dados recebidos
  const companhia = getCompanhiaText(dados.companhia);
  const preferencia = getPreferenciaText(dados.preferencia_viagem);
  const cidadeOrigem = dados.cidade_partida?.name || 'origem não especificada';
  const orcamento = dados.orcamento_valor || 'flexível';
  const moeda = dados.moeda_escolhida || 'BRL';
  
  // Datas de viagem
  let dataIda = 'não especificada';
  let dataVolta = 'não especificada';
  
  if (dados.datas) {
    if (typeof dados.datas === 'string' && dados.datas.includes(',')) {
      const partes = dados.datas.split(',');
      dataIda = partes[0];
      dataVolta = partes[1];
    } else if (dados.datas.dataIda && dados.datas.dataVolta) {
      dataIda = dados.datas.dataIda;
      dataVolta = dados.datas.dataVolta;
    }
  }

  // Construir prompt detalhado
  return `Preciso que recomende destinos de viagem baseados nestas preferências do usuário:

- Partindo de: ${cidadeOrigem}
- Viajando: ${companhia}
- Buscando principalmente: ${preferencia}
- Orçamento para passagens: ${orcamento} ${moeda}
- Período: ${dataIda} a ${dataVolta}

Forneça EXATAMENTE o seguinte formato JSON, sem texto adicional antes ou depois:
{
  "topPick": {
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX", // código de 2 letras do país
    "descricao": "Breve descrição do destino com até 100 caracteres",
    "porque": "Razão principal para visitar, relacionada às preferências do usuário",
    "destaque": "Uma experiência única neste destino",
    "comentario": "Um comentário animado da Tripinha, como se você fosse um cachorro entusiasmado",
    "preco": {
      "voo": número, // valor estimado em ${moeda}
      "hotel": número // valor por noite estimado em ${moeda}
    }
  },
  "alternativas": [
    // EXATAMENTE 4 destinos alternativos, cada um com:
    {
      "destino": "Nome da Cidade",
      "pais": "Nome do País", 
      "codigoPais": "XX",
      "porque": "Razão principal para visitar",
      "preco": {
        "voo": número,
        "hotel": número
      }
    }
  ],
  "surpresa": {
    // Um destino surpresa menos óbvio mas que também combine com as preferências
    "destino": "Nome da Cidade",
    "pais": "Nome do País",
    "codigoPais": "XX",
    "descricao": "Breve descrição do destino com até 100 caracteres",
    "porque": "Razão principal para visitar, destacando o fator surpresa",
    "destaque": "Uma experiência única e surpreendente neste destino",
    "comentario": "Um comentário animado da Tripinha sobre este destino surpresa",
    "preco": {
      "voo": número,
      "hotel": número
    }
  }
}

Cada destino DEVE ser realista e ter preços estimados plausíveis. Não inclua texto explicativo antes ou depois do JSON.`;
}

// Função auxiliar para obter texto de companhia
function getCompanhiaText(value) {
  const options = {
    0: "sozinho(a)",
    1: "em casal (viagem romântica)",
    2: "em família",
    3: "com amigos"
  };
  return options[value] || "sozinho(a)";
}

// Função auxiliar para obter texto de preferência
function getPreferenciaText(value) {
  const options = {
    0: "relaxamento e descanso (praias, resorts tranquilos, spas)",
    1: "aventura e atividades ao ar livre (trilhas, esportes, natureza)",
    2: "cultura, história e gastronomia (museus, centros históricos, culinária local)",
    3: "experiência urbana, compras e vida noturna (centros urbanos, lojas, restaurantes)"
  };
  return options[value] || "experiências diversificadas de viagem";
}
