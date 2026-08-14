# Provedores externos, cache e fallback

Referência de onde cada afirmação da Benetrip vai buscar sustentação, o que
acontece quando o provedor falha e por quanto tempo a resposta é reaproveitada.

Princípio que vale para todos: **sem dado confiável, a afirmação é omitida ou
marcada como não verificada.** Nenhuma camada preenche lacuna com o
conhecimento do modelo, e nenhuma delas mantém uma base local curada — todo
cache é temporário e some sozinho.

## Adapters

| Módulo | Para quê | Provedor | Variáveis |
|---|---|---|---|
| `api/_lib/web-grounding.js` | sustentar afirmação factual com fonte | Google Custom Search; SearchAPI (`engine=google`) | `GOOGLE_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID`; `SEARCHAPI_KEY` |
| `api/_lib/seasonality.js` | adequação do destino ao mês da viagem | grounding acima + extração por LLM | as acima + `CEREBRAS_KEY` |
| `api/_lib/places.js` | existência e funcionamento de lugares do Roteiro | Google Places (Text Search) | `GOOGLE_PLACES_API_KEY` ou `GOOGLE_API_KEY` |
| `api/_lib/geo-routes.js` ⚠️ **não ligado** | coordenadas e deslocamento aeroporto→destino | Google Geocoding; Google Directions | `GOOGLE_PLACES_API_KEY` ou `GOOGLE_API_KEY` |
| `api/_lib/travelpayouts.js` | propostas completas de ida e volta | Travelpayouts (o mesmo da Busca clássica) | `AVIASALES_TOKEN` + `AVIASALES_MARKER` |

Nenhuma variável nova é obrigatória: todas já existiam no projeto. O que muda
é que agora cada uma tem um caminho de degradação explícito.

**`geo-routes.js` está escrito mas não é chamado por nenhum endpoint.** O
componente de aeroporto funciona sem ele, exibindo apenas "pode exigir
deslocamento terrestre", sem km nem tempo. Ligar o módulo significa habilitar
as APIs Geocoding e Directions no Google Cloud, que são cobradas à parte:
é uma decisão de custo em aberto, não um item entregue.

## Fallback por ferramenta

| Ferramenta | Provedor indisponível | O que o usuário vê |
|---|---|---|
| Descoberta | grounding sazonal falha | preço, escalas e duração normalmente; a frase sobre a época some ou aparece como "informação não verificada" |
| Comparar Voos | Travelpayouts sem propostas completas | matriz em modo indicativo, sem vencedor, com "tarifa inicial encontrada" e CTA "Ver datas no Google Flights" |
| Roteiro | Places indisponível | roteiro sai igual, mas as sugestões viram categoria e região ("pausa para café na região do Comércio"), sem nome de estabelecimento |
| Escapadas / Destinos Baratos / Todos | Geocoding/Directions **não ligados hoje** | o card diz que existe deslocamento terrestre a partir do aeroporto, sem número de km nem tempo (comportamento atual, não fallback) |
| Qualquer uma | fornecedor de voo falha | erro real na tela, com o formulário recuperável (sem lista vazia silenciosa) |

## Cache

`api/_lib/external-cache.js` guarda **respostas externas** em memória, por
instância, com TTL e teto de 500 entradas.

| Chave | TTL | Motivo |
|---|---|---|
| busca com grounding | 24 h | conteúdo editorial muda devagar |
| sazonalidade (destino + país + mês + idioma) | 7 dias | a resposta é sobre um mês inteiro |
| lugar (nome + cidade) | 3 dias | endereço e existência são estáveis |
| geocodificação | 7 dias | coordenadas quase não mudam (módulo inativo) |
| rota terrestre | 24 h | trânsito muda, a rota não (módulo inativo) |
| proposta de ida e volta | 20 min | tarifa aérea envelhece rápido |

Cada entrada carrega `checkedAt` / `verificadoEm`, exibido junto da afirmação.
Nada aqui é editado à mão nem sobrevive ao TTL: se o provedor cair e o cache
expirar, a informação simplesmente deixa de ser exibida.

## Custo

As chamadas externas acontecem **só para o que vai aparecer na tela**:

- sazonalidade: no máximo 6 destinos por busca (os finalistas), concorrência 3;
- lugares: uma resolução por atividade do roteiro, concorrência 4;
- propostas completas: no máximo 16 combinações, concorrência 4, com orçamento
  total de 40 s e timeout de 18 s por combinação.

## Atenção: o enriquecimento do Comparar Voos ativa sozinho

A SearchAPI continua sendo o provedor principal e o único obrigatório do
Comparar Voos. A Travelpayouts só entra quando a tarifa ficou incompleta
(sem trecho de volta) **e** `AVIASALES_TOKEN`/`AVIASALES_MARKER` existem.

Como é a mesma credencial que a Busca de Voos já usa, em produção essa etapa
liga automaticamente. Se a preferência for manter o Comparar Voos 100%
SearchAPI, o caminho é adicionar uma guarda de flag em
`enriquecerComPropostasCompletas` (`api/compare-flights.js`): sem o
enriquecimento, a matriz simplesmente permanece indicativa e não elege
vencedor, que já é o comportamento correto do ponto de vista de dado.
