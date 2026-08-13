/**
 * BENETRIP FEATURE FLAGS v1.0
 *
 * Recursos que dependem de infraestrutura ainda inexistente ficam aqui,
 * desligados. Ligar um flag sem a infraestrutura correspondente cria uma
 * promessa que o produto não cumpre.
 *
 * alertasPreco: "avise-me quando esta rota ficar abaixo de R$ X".
 *   Requer canal de envio (e-mail/push), fila de avaliação e persistência.
 *   Especificação em docs/alertas-de-preco.md. Enquanto false, a interface
 *   não exibe formulário de cadastro — nada de simular um alerta que não
 *   seria disparado.
 */
window.BENETRIP_FLAGS = Object.assign({
    alertasPreco: false,
}, window.BENETRIP_FLAGS || {});
