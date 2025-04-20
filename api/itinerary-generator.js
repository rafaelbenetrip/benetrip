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
    // Implementação conforme já descrita no guia...
    // Código anterior mantido
}

/**
 * Adiciona imagens às atividades do roteiro
 * Utiliza o módulo de busca de imagens existente
 */
async function addImagesToActivities(itinerary, destination) {
    if (!itinerary || !itinerary.days) {
        return itinerary;
    }
    
    // Buscar todos os pontos turísticos primeiro para melhorar resultado
    let touristAttractions = [];
    try {
        touristAttractions = await imageSearch.getTouristAttractions(destination.city);
    } catch (error) {
        console.warn('Erro ao buscar pontos turísticos:', error);
    }
    
    // Para cada dia do roteiro
    for (let i = 0; i < itinerary.days.length; i++) {
        const day = itinerary.days[i];
        
        // Para cada atividade do dia
        if (day.activities && day.activities.length > 0) {
            for (let j = 0; j < day.activities.length; j++) {
                const activity = day.activities[j];
                
                try {
                    // Busca imagem para a atividade usando o módulo existente
                    const imageUrl = await imageSearch.searchAttractionImage(
                        activity.location,
                        destination.city,
                        destination.country
                    );
                    
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
