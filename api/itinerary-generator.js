/**
 * API para geração de roteiro personalizado
 * Usa IA para sugerir atividades com base nas preferências do usuário
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const imageSearch = require('./image-search');

// Chave da API para IA
const AI_API_KEY = process.env.AI_API_KEY || '';

/**
 * Endpoint para geração de roteiro
 * POST /api/itinerary-generator
 */
router.post('/', async (req, res) => {
    try {
        // Extrai dados da requisição
        const { destination, preferences, flight, dates } = req.body;
        
        if (!destination || !preferences || !flight) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }
        
        // Gera roteiro com IA
        const itinerary = await generateItineraryWithAI(destination, preferences, flight, dates);
        
        // Adiciona imagens às atividades
        const itineraryWithImages = await addImagesToActivities(itinerary, destination);
        
        res.json(itineraryWithImages);
        
    } catch (error) {
        console.error('Erro ao gerar roteiro:', error);
        res.status(500).json({ error: 'Falha ao gerar roteiro' });
    }
});

/**
 * Gera roteiro usando IA
 */
async function generateItineraryWithAI(destination, preferences, flight, dates) {
    // Formata datas para cálculo do número de dias
    const departureDate = new Date(flight.departureDate);
    const returnDate = new Date(flight.returnDate);
    const totalDays = Math.ceil((returnDate - departureDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Mapeia tipo de companhia
    let companhiaTexto = 'Sozinho(a)';
    let qtdPessoas = 1;
    
    if (preferences.companhia === 1) {
        companhiaTexto = 'Casal';
        qtdPessoas = 2;
    } else if (preferences.companhia === 2) {
        companhiaTexto = 'Família';
        qtdPessoas = preferences.quantidade_familia || 'múltiplas';
    } else if (preferences.companhia === 3) {
        companhiaTexto = 'Grupo de amigos';
        qtdPessoas = preferences.quantidade_amigos || 'múltiplas';
    }
    
    // Mapeia preferência de viagem
    let tipoPreferencia = 'relaxamento';
    
    if (preferences.preferencia_viagem === 1) {
        tipoPreferencia = 'aventura';
    } else if (preferences.preferencia_viagem === 2) {
        tipoPreferencia = 'cultura';
    } else if (preferences.preferencia_viagem === 3) {
        tipoPreferencia = 'vida urbana';
    }
    
    // Formata as datas para exibição
    const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    
    // Prepara os dias da viagem
    const diasViagem = [];
    
    for (let i = 0; i < totalDays; i++) {
        const diaAtual = new Date(departureDate);
        diaAtual.setDate(departureDate.getDate() + i);
        
        diasViagem.push({
            numero: i + 1,
            data: diaAtual.toISOString().split('T')[0],
            diaSemana: diasSemana[diaAtual.getDay()],
            diaFormatado: `${diaAtual.getDate()}/${diaAtual.getMonth() + 1}`
        });
    }
    
    // Constrói prompt para a IA
    const prompt = `
        Crie um roteiro de viagem detalhado para ${destination.city}, ${destination.country} com as seguintes características:
        
        - Duração: ${totalDays} dias (${diasViagem[0].diaFormatado} a ${diasViagem[totalDays-1].diaFormatado})
        - Companhia: ${companhiaTexto} (${qtdPessoas} pessoas)
        - Preferência: ${tipoPreferencia}
        - Origem: ${preferences.cidade_partida}
        - Chegada: ${flight.arrivalTime || 'manhã'} (dia 1)
        - Partida: ${flight.departureTime || 'tarde'} (dia ${totalDays})
        
        Para cada dia, inclua:
        1. Uma breve descrição do dia
        2. Uma dica personalizada como se fosse a mascote Tripinha (um cachorro caramelo guia de viagens, descontraído)
        3. Principal atividade recomendada com local específico
        
        Formate a resposta como um JSON com a seguinte estrutura:
        {
            "days": [
                {
                    "description": "Descrição do dia 1",
                    "tip": "Dica da Tripinha para o dia 1",
                    "activities": [
                        {
                            "time": "Horário da atividade",
                            "location": "Local específico, com nome da atração",
                            "description": "Breve descrição da atividade"
                        }
                    ]
                }
            ]
        }
        
        Importante:
        - Inclua apenas UMA atividade principal por dia
        - Seja específico com nomes de locais reais
        - Considere horários de chegada/partida nos dias 1 e ${totalDays}
        - Adapte as atividades ao perfil ${companhiaTexto} com foco em ${tipoPreferencia}
        - As dicas da Tripinha devem ser amigáveis e específicas para o grupo
    `;
    
    try {
        // Chamada à API de IA (modifique conforme a API que estiver usando)
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                { 
                    role: 'system', 
                    content: 'Você é um especialista em turismo que cria roteiros personalizados. Responda apenas com o JSON solicitado.'
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_API_KEY}`
            }
        });
        
        // Extrai e parse o JSON da resposta
        const content = response.data.choices[0].message.content;
        let itinerary;
        
        try {
            // Tenta fazer parse do JSON da resposta
            itinerary = JSON.parse(content);
        } catch (e) {
            // Se falhar, extrai o JSON do texto (caso a IA adicione texto antes/depois)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                itinerary = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Falha ao extrair JSON da resposta da IA');
            }
        }
        
        return itinerary;
        
    } catch (error) {
        console.error('Erro na chamada à IA:', error);
        throw error;
    }
}

/**
 * Adiciona imagens às atividades do roteiro
 */
async function addImagesToActivities(itinerary, destination) {
    if (!itinerary || !itinerary.days) {
        return itinerary;
    }
    
    // Para cada dia do roteiro
    for (let i = 0; i < itinerary.days.length; i++) {
        const day = itinerary.days[i];
        
        // Para cada atividade do dia
        if (day.activities && day.activities.length > 0) {
            for (let j = 0; j < day.activities.length; j++) {
                const activity = day.activities[j];
                
                try {
                    // Busca imagem para a atividade
                    const searchQuery = `${activity.location} ${destination.city} ${destination.country}`;
                    const imageUrl = await imageSearch.searchImage(searchQuery);
                    
                    // Adiciona URL da imagem à atividade
                    activity.image = imageUrl;
                    activity.imageAlt = `Imagem de ${activity.location} em ${destination.city}`;
                    
                } catch (error) {
                    console.warn('Erro ao buscar imagem para atividade:', error);
                    // Usa imagem padrão em caso de erro
                    activity.image = '/public/assets/images/default-location.jpg';
                    activity.imageAlt = `Imagem de ${destination.city}`;
                }
            }
        }
    }
    
    return itinerary;
}

module.exports = router;
