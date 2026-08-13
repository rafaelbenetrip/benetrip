# Alertas de preço — especificação técnica

Status: **não implementado**. Este documento descreve o que precisa existir
antes de a Benetrip prometer "avise-me quando o preço cair". A interface está
preparada e desabilitada por feature flag (`window.BENETRIP_FLAGS.alertasPreco`,
padrão `false`) — nenhum formulário de cadastro é exibido enquanto a
infraestrutura de envio não existir, para não simular um cadastro que não
persiste nem notifica.

## Por que ainda não existe

O que já existe hoje:

- contas de usuário e sessão (`api/auth/`, `public/assets/js/benetrip-auth.js`);
- banco (Supabase) com snapshots diários de preço (`discovery_snapshots`);
- cron diário que atualiza os snapshots (`api/cron/update-discovery.js`).

O que **não** existe e é obrigatório para o recurso:

- canal de envio (e-mail transacional ou push web) com domínio verificado,
  tratamento de bounce e descadastro;
- fila/agendamento para avaliar alertas fora do ciclo de request;
- registro de consentimento e política de frequência (anti-spam).

Sem esses três itens o alerta não é confiável: o usuário cadastra e nunca
recebe, ou recebe em duplicidade.

## Modelo de dados proposto

Tabela `price_alerts`:

| coluna | tipo | observação |
| --- | --- | --- |
| `id` | uuid | pk |
| `user_id` | uuid | fk do usuário autenticado |
| `tipo` | text | `vai-e-vem` \| `destino` \| `origem` |
| `origem` | text | código IATA ou kgmid da cidade |
| `destino` | text | nulo no alerta por origem ("qualquer destino") |
| `dias_ida` | int[] | 0=domingo … 6=sábado (Vai e Vem) |
| `dias_volta` | int[] | idem |
| `janela_meses` | int | horizonte de busca, 1–6 |
| `preco_maximo` | numeric | gatilho |
| `moeda` | text | BRL/USD/EUR |
| `somente_direto` | bool | preferência de escalas |
| `max_paradas` | int | alternativa a `somente_direto` |
| `aeroportos` | text[] | aeroportos aceitos da cidade agregada |
| `estilo` | text | usado no alerta por origem (praia, natureza…) |
| `canal` | text | `email` \| `push` |
| `ativo` | bool | descadastro sem apagar histórico |
| `ultimo_disparo_em` | timestamptz | controle de frequência |
| `criado_em` | timestamptz | |

RLS: cada usuário só enxerga as próprias linhas.

## Fluxo de avaliação

1. O cron de preços termina de gravar os snapshots do dia.
2. Um segundo job lê `price_alerts` ativos e compara com os preços novos:
   - `vai-e-vem`: menor preço das semanas que casam com `dias_ida`/`dias_volta`
     dentro de `janela_meses`;
   - `destino`: menor preço da rota origem→destino;
   - `origem`: qualquer destino abaixo de `preco_maximo` saindo da origem,
     respeitando `estilo` e `somente_direto`.
3. Dispara no máximo **um** e-mail por alerta por dia, e só quando o preço
   estiver **abaixo** do gatilho (não em cada oscilação).
4. Grava `ultimo_disparo_em` e registra o preço que motivou o envio, para o
   e-mail poder dizer a referência ("caiu R$ X em relação à média recente")
   em vez de linguagem de urgência sem base.

## Regras de linguagem no e-mail

Valem as mesmas regras de `api/_lib/tripinha-shared.js`: sem "urgente",
"imperdível" ou "última chance" sem evidência (queda relevante, histórico
suficiente e dado recente). O e-mail sempre informa a data da consulta e o
aeroporto efetivo da tarifa.

## Ativação

Quando os três itens de infraestrutura existirem:

1. criar a tabela e as políticas de RLS;
2. implementar `POST /api/price-alerts` (criar/listar/desativar);
3. implementar o job de avaliação;
4. ligar `window.BENETRIP_FLAGS.alertasPreco = true`.
