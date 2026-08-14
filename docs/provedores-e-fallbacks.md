# Provedores externos, cache e fallback

Referência de onde cada afirmação da Benetrip vai buscar sustentação, o que
acontece quando o provedor falha e por quanto tempo a resposta é reaproveitada.

Dois princípios valem para tudo aqui:

1. **Sem dado confiável, a afirmação é omitida ou marcada como não
   verificada.** Nenhuma camada preenche lacuna com o conhecimento do modelo.
2. **Nada externo liga sozinho.** Toda chamada paga exige opt-in explícito por
   variável de ambiente. Ter a credencial não é autorização para gastar.

**Não usamos token do Google em nenhuma destas camadas.** O provedor externo,
quando habilitado, é sempre a SearchAPI.io, a mesma credencial já usada nas
buscas de voo.

## Estado atual: tudo desligado

| Camada | Variável | Padrão | Custo hoje |
|---|---|---|---|
| Sazonalidade da Descoberta | `BENETRIP_GROUNDING_WEB` | desligado | zero |
| Validação de lugares do Roteiro | `ROTEIRO_VALIDAR_LUGARES` | desligado | zero |
| Propostas completas do Comparar Voos | `COMPARE_FLIGHTS_ENRIQUECER` | desligado | zero |

Valores que ligam: `1`, `true`, `on` ou `sim`. Qualquer outra coisa mantém
desligado. Cada flag também exige a credencial correspondente
(`SEARCHAPI_KEY`, ou `AVIASALES_TOKEN`/`AVIASALES_MARKER` no caso do
Comparar Voos).

Verificado em teste: com **todas** as credenciais presentes e nenhuma flag,
nenhuma chamada de rede acontece.

## Como cada ferramenta se mantém correta com tudo desligado

### Descoberta: sazonalidade sem rede

A correção do caso "Lençóis Maranhenses em novembro com as lagoas cheias" não
depende de provedor. São duas camadas, ambas locais:

1. **Prompt** (`INSTRUCOES_SAZONALIDADE`): proíbe afirmar fenômeno sazonal,
   com exemplos de errado e certo, e avisa que a frase será descartada.
2. **Guarda determinística** (`api/_lib/seasonal-claims.js`): depois da
   geração, qualquer frase que afirme nível de água, neve, floração, desova,
   ausência de chuva, clima garantido ou funcionamento sazonal **sem fonte** é
   descartada. O card fica sem comentário de época em vez de exibir uma
   previsão que não sustentamos.

Prompt sozinho não bastaria: prompt reduz frequência, não garante. A guarda é
o que garante. Ela avalia o **tipo de afirmação**, não o destino, então vale
para qualquer lugar do mundo e não é catálogo.

Frases modalizadas passam, porque não são previsão:
"as lagoas costumam encher, mas varia por ano, confirme antes de fechar".

Com `BENETRIP_GROUNDING_WEB` ligado, some uma terceira camada: busca externa
com fonte, e aí a afirmação verificada pode ser exibida com link "Ver fonte".

### Roteiro: lugares sem rede

O que pegou "Café do Forte, se acessível, ou um café similar" foi o filtro
determinístico `ehCandidatoEspeculativo()`, que não usa rede. Continua valendo.
Também são locais: a reconciliação de custo (nada é pago e gratuito ao mesmo
tempo) e a substituição por categoria e região.

Desligado, todo lugar fica `not_verified` e o roteiro sugere
"Pausa para café na região do Comércio. Escolha uma opção aberta no momento."
em vez de um estabelecimento que não conseguimos confirmar. Horário nunca é
afirmado: "Horário não verificado, confirme antes de ir."

Com `ROTEIRO_VALIDAR_LUGARES` ligado, nomes concretos passam a ser resolvidos
na SearchAPI (`engine=google_maps`) e ganham endereço, coordenadas e link.

### Comparar Voos: matriz sem rede extra

A SearchAPI (`engine=google_flights`) é o provedor principal e o único
obrigatório: uma chamada por combinação de datas, como sempre foi.

Desligado o enriquecimento, a matriz permanece indicativa e não elege
vencedor, que já é a leitura honesta de uma tarifa sem trecho de volta. O que
se deixa de ter é a chance de, às vezes, fechar a comparação completa.

## Adapters

| Módulo | Para quê | Provedor | Habilita com |
|---|---|---|---|
| `api/_lib/seasonal-claims.js` | impedir afirmação sazonal sem fonte | **nenhum, é local** | sempre ativo |
| `api/_lib/web-grounding.js` | sustentar afirmação com fonte | SearchAPI (`engine=google`) | `BENETRIP_GROUNDING_WEB` |
| `api/_lib/seasonality.js` | adequação do destino ao mês | grounding acima + `CEREBRAS_KEY` | `BENETRIP_GROUNDING_WEB` |
| `api/_lib/places.js` | existência de lugares do Roteiro | SearchAPI (`engine=google_maps`) | `ROTEIRO_VALIDAR_LUGARES` |
| `api/_lib/travelpayouts.js` | propostas completas de ida e volta | Travelpayouts | `COMPARE_FLIGHTS_ENRIQUECER` |

Os caminhos `engine=google` e `engine=google_maps` da SearchAPI **não foram
exercitados contra a API real** nesta entrega, só o caminho de degradação.
Ligar qualquer um dos dois pede validação em preview antes de produção.

## Fallback por ferramenta

| Ferramenta | Provedor indisponível ou desligado | O que o usuário vê |
|---|---|---|
| Descoberta | sempre, hoje | preço, escalas e duração normais; frase de época só se sobreviver à guarda, rotulada como não verificada |
| Comparar Voos | sempre, hoje | matriz indicativa, sem vencedor, "tarifa inicial encontrada" e CTA "Ver datas no Google Flights" |
| Roteiro | sempre, hoje | roteiro completo, com sugestões por categoria e região em vez de estabelecimento |
| Escapadas / Destinos Baratos / Todos | sem provedor de rotas | o card diz que existe deslocamento terrestre a partir do aeroporto, sem km nem tempo |
| Qualquer uma | fornecedor de voo falha | erro real na tela, com o formulário recuperável |

## Cache

`api/_lib/external-cache.js` guarda **respostas externas** em memória, por
instância, com TTL e teto de 500 entradas. Só entra em uso quando alguma flag
está ligada.

| Chave | TTL |
|---|---|
| busca com grounding | 24 h |
| sazonalidade (destino + país + mês + idioma) | 7 dias |
| lugar (nome + cidade) | 3 dias |
| proposta de ida e volta | 20 min |

Cada entrada carrega `checkedAt` / `verificadoEm`, exibido junto da afirmação.
Nada é editado à mão nem sobrevive ao TTL.

## Volume, se alguma flag for ligada

- sazonalidade: no máximo 6 destinos por busca (os finalistas), concorrência 3;
- lugares: uma resolução por atividade do roteiro, concorrência 4;
- propostas completas: no máximo 16 combinações, concorrência 4, orçamento
  total de 40 s e timeout de 18 s por combinação.
