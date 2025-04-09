/**
 * BENETRIP - CORREÇÃO DE EMERGÊNCIA
 * Este script resolve problemas críticos com cards, modais e redirecionamento,
 * complementando (não substituindo) os scripts existentes.
 */

(function() {
  console.log("🚨 Iniciando correção de emergência Benetrip");
  
  // ===== CORREÇÃO DE CARDS =====
  function corrigirCardsVisiveis() {
    console.log("🔧 Aplicando correção de cards invisíveis...");
    
    // Corrigir container de swipe
    const container = document.getElementById('voos-swipe-container');
    if (container) {
      Object.assign(container.style, {
        display: 'flex',
        flexDirection: 'column',
        visibility: 'visible',
        opacity: '1',
        minHeight: '300px'
      });
      
      // Força o container a ser visível
      container.setAttribute('style', container.getAttribute('style') + 
        '; display: flex !important; visibility: visible !important; opacity: 1 !important;');
    }
    
    // Corrigir cards
    const cards = document.querySelectorAll('.voo-card');
    cards.forEach(card => {
      Object.assign(card.style, {
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        minHeight: '150px',
        position: 'relative',
        zIndex: '1'
      });
      
      // Força o card a ser visível
      card.setAttribute('style', card.getAttribute('style') + 
        '; display: block !important; visibility: visible !important; opacity: 1 !important;');
    });
    
    // Corrigir botão fixo
    const botaoFixo = document.querySelector('.botao-selecao-fixo');
    if (botaoFixo) {
      Object.assign(botaoFixo.style, {
        display: 'flex',
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        zIndex: '999'
      });
    }
  }
  
  // ===== CORREÇÃO DE MODAL =====
  function corrigirModal() {
    // Verifica se o modal está sendo exibido corretamente quando solicitado
    const modalOriginal = window.mostrarConfirmacaoSelecao;
    
    if (typeof modalOriginal === 'function') {
      window.mostrarConfirmacaoSelecao = function() {
        // Chama função original primeiro
        try {
          modalOriginal.apply(this, arguments);
        } catch (err) {
          console.error("❌ Erro na função original de modal:", err);
        }
        
        // Garante que o modal seja exibido
        setTimeout(() => {
          const modal = document.getElementById('modal-confirmacao');
          if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('modal-active');
            
            // Configura o botão de confirmação
            configurarBotaoConfirmacao();
          }
        }, 100);
      };
    }
    
    // Corrige a função de fechamento do modal
    const closeModalOriginal = window.fecharModal;
    
    if (typeof closeModalOriginal === 'function') {
      window.fecharModal = function(modalId) {
        try {
          closeModalOriginal.apply(this, arguments);
        } catch (err) {
          console.error("❌ Erro na função original de fechar modal:", err);
        }
        
        // Garantir que o modal seja fechado
        const modal = document.getElementById(modalId);
        if (modal) {
          modal.classList.remove('modal-active');
          
          setTimeout(() => {
            if (!modal.classList.contains('modal-active')) {
              modal.style.display = 'none';
            }
          }, 300);
        }
      };
    }
  }
  
  // Configura o botão de confirmação no modal
  function configurarBotaoConfirmacao() {
    const btnConfirmar = document.getElementById('btn-confirmar');
    if (!btnConfirmar) return;
    
    // Remove event listeners existentes
    const btnClone = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(btnClone, btnConfirmar);
    
    // Verifica o checkbox
    const checkbox = document.getElementById('confirmar-selecao');
    if (checkbox) {
      checkbox.checked = false;
      checkbox.onchange = function() {
        btnClone.disabled = !this.checked;
      };
    }
    
    // Adiciona event listener robusto
    btnClone.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Atualizar visual do botão
      this.innerHTML = '<span class="spinner"></span> Processando...';
      this.disabled = true;
      
      // Obter ID do voo selecionado
      let vooId = null;
      if (window.BENETRIP_VOOS) {
        const voo = window.BENETRIP_VOOS.vooSelecionado || window.BENETRIP_VOOS.vooAtivo;
        vooId = voo ? (voo.sign || `voo-idx-${window.BENETRIP_VOOS.indexVooAtivo || 0}`) : null;
      }
      
      // Tentar usar o método oficial primeiro
      if (window.BENETRIP_REDIRECT && typeof window.BENETRIP_REDIRECT.processarConfirmacao === 'function') {
        try {
          window.BENETRIP_REDIRECT.processarConfirmacao(vooId);
        } catch (err) {
          console.error("❌ Erro ao processar confirmação oficial:", err);
          redirecionarManual(vooId);
        }
      } else {
        console.warn("⚠️ Método oficial não disponível, usando método manual");
        redirecionarManual(vooId);
      }
    });
  }
  
  // ===== CORREÇÃO DE REDIRECIONAMENTO =====
  function corrigirRedirecionamento() {
    if (!window.BENETRIP_REDIRECT) {
      console.log("🛠️ BENETRIP_REDIRECT não existe, criando...");
      window.BENETRIP_REDIRECT = {};
    }
    
    // Preserva a implementação original se existir
    const redirectOriginal = window.BENETRIP_REDIRECT.processarConfirmacao;
    
    // Implementa versão robusta
    window.BENETRIP_REDIRECT.processarConfirmacao = function(vooId) {
      console.log("✈️ Processando confirmação para voo:", vooId);
      
      // Tenta usar método original primeiro
      if (typeof redirectOriginal === 'function') {
        try {
          redirectOriginal.call(window.BENETRIP_REDIRECT, vooId);
          return; // Se funcionou, retorna
        } catch (err) {
          console.error("❌ Erro no redirecionamento original:", err);
          // Continua para método manual
        }
      }
      
      // Usa método manual
      redirecionarManual(vooId);
    };
  }
  
  // Função de redirecionamento manual
  function redirecionarManual(vooId) {
    console.log("🔄 Iniciando redirecionamento manual para voo:", vooId);
    
    try {
      // Abre janela imediatamente (antes do fetch para evitar bloqueio de popup)
      const janela = window.open('about:blank', '_blank');
      
      if (!janela || janela.closed) {
        console.error("❌ Popup bloqueado pelo navegador");
        alert("A janela para o site do parceiro foi bloqueada. Por favor, permita popups para este site.");
        
        // Redireciona para hotéis como fallback
        setTimeout(() => {
          window.location.href = 'hotels.html';
        }, 1000);
        return;
      }
      
      // Exibir página de carregamento na janela
      janela.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Redirecionando para parceiro - Benetrip</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; flex-direction: column; }
            .progress { width: 80%; height: 20px; background-color: #f3f3f3; border-radius: 10px; margin: 20px 0; overflow: hidden; }
            .bar { height: 100%; width: 0; background-color: #E87722; animation: fill 3s linear forwards; }
            @keyframes fill { to { width: 100%; } }
            .message { text-align: center; max-width: 80%; }
            .logo { max-width: 200px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <img src="${window.location.origin}/assets/images/logo.png" alt="Benetrip" class="logo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjUwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiIGZpbGw9IiNFODc3MjIiLz48dGV4dCB4PSI1MCIgeT0iMjUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPkJlbmV0cmlwPC90ZXh0Pjwvc3ZnPg=='">
          <div class="message">
            <h2>Redirecionando para parceiro Benetrip</h2>
            <p>Você está sendo redirecionado para o site do parceiro para finalizar sua reserva de voo.</p>
            <p>Por favor, <strong>não feche</strong> esta janela até ser redirecionado.</p>
          </div>
          <div class="progress">
            <div class="bar"></div>
          </div>
        </body>
        </html>
      `);
      
      // Determinar o URL destino (usando mock para teste/desenvolvimento)
      const isTesting = window.location.href.includes('localhost') || 
                       window.location.href.includes('127.0.0.1') || 
                       window.location.href.includes('?test=true');
      
      if (isTesting) {
        // Ambiente de teste - usar URL simulado após delay
        setTimeout(() => {
          try {
            const mockUrl = "https://www.example.com/flights?mock=true&voo=" + (vooId || "unknown");
            janela.location.href = mockUrl;
          } catch (err) {
            console.error("❌ Erro ao redirecionar janela:", err);
          }
        }, 3000);
      } else {
        // Ambiente de produção - tentar obter URL real
        // Buscar dados do voo e search_id
        let searchId = null;
        let termUrl = null;
        
        if (window.BENETRIP_VOOS) {
          searchId = window.BENETRIP_VOOS.searchId;
          
          // Buscar termUrl do voo
          const voo = window.BENETRIP_VOOS.vooSelecionado || window.BENETRIP_VOOS.vooAtivo;
          if (voo && voo.terms) {
            try {
              const termsKey = Object.keys(voo.terms)[0];
              termUrl = voo.terms[termsKey].url;
            } catch (err) {
              console.error("❌ Erro ao obter URL do termo:", err);
            }
          }
        }
        
        // Se temos os dados necessários, chamar API
        if (searchId && termUrl) {
          // Chamar API de redirecionamento via proxy local
          fetch(`/api/flight-redirect?search_id=${encodeURIComponent(searchId)}&term_url=${encodeURIComponent(termUrl)}&marker=604241`)
            .then(response => {
              if (!response.ok) {
                throw new Error(`Erro ${response.status} na API`);
              }
              return response.json();
            })
            .then(data => {
              if (data && data.url) {
                // Redirecionar para URL do parceiro
                try {
                  janela.location.href = data.url;
                } catch (err) {
                  console.error("❌ Erro ao redirecionar janela:", err);
                }
              } else {
                throw new Error("Dados de redirecionamento inválidos");
              }
            })
            .catch(err => {
              console.error("❌ Erro no redirecionamento:", err);
              
              // Redirecionar para uma página de fallback
              try {
                janela.location.href = "https://www.example.com/flights?error=true";
              } catch (err2) {
                console.error("❌ Erro no redirecionamento fallback:", err2);
              }
            });
        } else {
          // Dados insuficientes, usar URL de fallback
          setTimeout(() => {
            try {
              janela.location.href = "https://www.example.com/flights?missing_data=true";
            } catch (err) {
              console.error("❌ Erro ao redirecionar janela:", err);
            }
          }, 3000);
        }
      }
      
      // Redirecionar para hotéis após delay
      setTimeout(() => {
        localStorage.setItem('benetrip_reserva_pendente', 'true');
        window.location.href = 'hotels.html';
      }, 3000);
      
    } catch (err) {
      console.error("❌ Erro geral no redirecionamento manual:", err);
      
      // Fallback final: ir direto para hotéis
      setTimeout(() => {
        localStorage.setItem('benetrip_reserva_pendente', 'true');
        window.location.href = 'hotels.html';
      }, 1000);
    }
  }
  
  // ===== CORREÇÃO PARA BOTÕES DOS CARDS =====
  function corrigirBotoesCards() {
    document.addEventListener('click', function(e) {
      // Verificar clique em botão de card
      const btnCard = e.target.closest('.choose-flight-button, .voo-card button');
      if (btnCard) {
        const vooId = btnCard.dataset.vooId;
        if (!vooId) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        console.log("🎯 Clique em botão de card detectado, ID:", vooId);
        
        // Selecionar o voo
        if (window.BENETRIP_VOOS && typeof window.BENETRIP_VOOS.selecionarVoo === 'function') {
          window.BENETRIP_VOOS.selecionarVoo(vooId);
        }
        
        // Mostrar confirmação
        if (typeof window.mostrarConfirmacaoSelecao === 'function') {
          window.mostrarConfirmacaoSelecao();
        }
      }
      
      // Verificar clique no botão principal
      const btnPrincipal = e.target.closest('.btn-selecionar-voo');
      if (btnPrincipal && !e._handled) {
        e.preventDefault();
        e._handled = true; // Evitar múltiplo processamento
        
        console.log("🎯 Clique em botão principal detectado");
        
        if (window.BENETRIP_VOOS) {
          // Selecionar voo ativo se necessário
          if (!window.BENETRIP_VOOS.vooSelecionado && window.BENETRIP_VOOS.vooAtivo) {
            window.BENETRIP_VOOS.selecionarVooAtivo();
          }
        }
        
        // Mostrar confirmação
        if (typeof window.mostrarConfirmacaoSelecao === 'function') {
          window.mostrarConfirmacaoSelecao();
        }
      }
    }, true); // Usar fase de captura para pegar eventos antes de outros listeners
  }
  
  // ===== INJEÇÃO DE ESTILOS CRÍTICOS =====
  function injetarEstilosCriticos() {
    if (document.getElementById('emergency-css')) return;
    
    const style = document.createElement('style');
    style.id = 'emergency-css';
    style.textContent = `
      /* Correções críticas para visibilidade */
      .voos-swipe-container {
        display: flex !important;
        flex-direction: column !important;
        visibility: visible !important;
        opacity: 1 !important;
        min-height: 300px !important;
      }
      
      .voo-card {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        background-color: white !important;
        border: 1px solid #e0e0e0 !important;
        border-radius: 8px !important;
        margin: 0 0 16px 0 !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
        min-height: 150px !important;
        position: relative !important;
        z-index: 1 !important;
      }
      
      .botao-selecao-fixo {
        display: flex !important;
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 999 !important;
        background-color: white !important;
      }
      
      .modal-backdrop.modal-active {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 9999 !important;
      }
      
      /* Estilos para o spinner */
      .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 0.8s linear infinite;
        margin-right: 8px;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    
    document.head.appendChild(style);
  }
  
  // ===== INICIALIZAÇÃO =====
  
  // Aplicar correções imediatamente
  injetarEstilosCriticos();
  corrigirCardsVisiveis();
  corrigirModal();
  corrigirRedirecionamento();
  corrigirBotoesCards();
  
  // Aplicar correções quando o DOM estiver carregado
  document.addEventListener('DOMContentLoaded', function() {
    console.log("🔄 DOM carregado - aplicando correções...");
    
    injetarEstilosCriticos();
    corrigirCardsVisiveis();
    corrigirModal();
    corrigirRedirecionamento();
    corrigirBotoesCards();
    
    // Tentar novamente após um breve delay
    setTimeout(function() {
      corrigirCardsVisiveis();
    }, 500);
  });
  
  // Aplicar correções quando os resultados estiverem prontos
  document.addEventListener('resultadosVoosProntos', function() {
    console.log("✅ Resultados prontos - aplicando correções...");
    
    corrigirCardsVisiveis();
    corrigirBotoesCards();
    
    // Tentar novamente após um breve delay
    setTimeout(function() {
      corrigirCardsVisiveis();
    }, 100);
  });
  
  // Verificar periodicamente a visibilidade dos cards (5 tentativas)
  let tentativas = 0;
  const intervalId = setInterval(function() {
    corrigirCardsVisiveis();
    tentativas++;
    
    if (tentativas >= 5) {
      clearInterval(intervalId);
    }
  }, 1000);
  
  console.log("✅ Correção de emergência Benetrip inicializada");
})();
