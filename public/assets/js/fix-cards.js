// Script de correção de emergência para os cards invisíveis_
(function() {
  // Função para corrigir display dos cards
  function corrigirDisplayCards() {
    console.log("Aplicando correção de emergência para cards...");
    
    // Forçar estilo inline no container de cards
    const container = document.getElementById('voos-swipe-container');
    if (container) {
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '16px';
      container.style.padding = '16px';
      container.style.backgroundColor = '#f5f5f5';
      container.style.minHeight = '300px';
      
      // Verificar se há cards
      const cards = container.querySelectorAll('.voo-card');
      if (cards.length === 0) {
        console.log("Nenhum card encontrado no container!");
        return;
      }
      
      console.log(`Aplicando estilos em ${cards.length} cards...`);
      
      // Corrigir cada card individualmente com estilo inline (máxima prioridade)
      cards.forEach(card => {
        card.style.display = 'block';
        card.style.backgroundColor = 'white';
        card.style.border = '1px solid #e0e0e0';
        card.style.borderRadius = '8px';
        card.style.margin = '0 0 12px 0';
        card.style.opacity = '1';
        card.style.visibility = 'visible';
        card.style.position = 'relative';
        card.style.zIndex = '1';
        card.style.minHeight = '150px';
        card.style.width = '100%';
        card.style.maxWidth = 'none';
      });
    }
  }
  
  // Tentar corrigir imediatamente
  corrigirDisplayCards();
  
  // Tentar novamente após carregamento completo
  window.addEventListener('load', corrigirDisplayCards);
  
  // Tentar novamente após resultados prontos
  document.addEventListener('resultadosVoosProntos', function() {
    setTimeout(corrigirDisplayCards, 100);
  });
  
  // Verificar periodicamente durante 5 segundos
  let attempts = 0;
  const interval = setInterval(function() {
    attempts++;
    corrigirDisplayCards();
    if (attempts >= 10) clearInterval(interval);
  }, 500);
})();
