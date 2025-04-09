// Script de correção de emergência para cards invisíveis
(function() {
  // Função principal de correção dos cards
  function fixCardsEmergencial() {
    console.log("Aplicando correção de emergência para cards...");
    
    // Forçar estilo inline no container de cards
    const container = document.getElementById('voos-swipe-container');
    if (container) {
      container.style.display = 'flex !important';
      container.style.flexDirection = 'column !important';
      container.style.gap = '16px';
      container.style.padding = '16px';
      container.style.backgroundColor = '#f5f5f5';
      container.style.minHeight = '300px';
      container.style.visibility = 'visible !important';
      container.style.opacity = '1 !important';
      
      // Verificar se há cards
      const cards = container.querySelectorAll('.voo-card');
      if (cards.length === 0) {
        console.log("Nenhum card encontrado no container!");
        return;
      }
      
      console.log(`Aplicando estilos em ${cards.length} cards...`);
      
      // Corrigir cada card individualmente com estilo inline (máxima prioridade)
      cards.forEach(card => {
        card.style.display = 'block !important';
        card.style.visibility = 'visible !important';
        card.style.opacity = '1 !important';
        card.style.backgroundColor = 'white !important';
        card.style.minHeight = '150px !important';
        card.style.border = '1px solid #e0e0e0';
        card.style.borderRadius = '8px';
        card.style.margin = '0 0 12px 0';
        card.style.position = 'relative';
        card.style.zIndex = '1';
        card.style.width = '100%';
        card.style.maxWidth = 'none';
      });
    }
  }
  
  // Aplicar correção em vários momentos
  // 1. Ao carregar o DOM
  document.addEventListener('DOMContentLoaded', fixCardsEmergencial);
  
  // 2. Após carregamento completo da página
  window.addEventListener('load', fixCardsEmergencial);
  
  // 3. Após evento personalizado de resultados
  document.addEventListener('resultadosVoosProntos', function() {
    setTimeout(fixCardsEmergencial, 100);
  });
  
  // 4. Verificação periódica durante 5 segundos
  let attempts = 0;
  const interval = setInterval(function() {
    attempts++;
    fixCardsEmergencial();
    if (attempts >= 10) clearInterval(interval);
  }, 500);
})();
