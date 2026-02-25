# Análise dos JSONs de cidades + proposta ideal para busca de passagens

## Diagnóstico da base atual

Arquivos analisados:
- `cidades_global_iata_v3.json`
- `cidades_global_iata_v4.json`
- `cidades_global_iata_v5.json`
- `cidades_global_iata_v6.json`
- `cidades_global_iata_v7.json`
- `cidades_global_iata_v7_radius500.json`
- `iata_geo_lookup.json`

Resumo objetivo:
- As versões `v3` a `v7` são listas de **cidades mapeadas para um IATA** (não são uma lista limpa de aeroportos).
- Isso gera muita duplicidade por aeroporto (um mesmo IATA aparece em dezenas/centenas de cidades do entorno).
- Para busca de passagens, o ideal é inverter o modelo para **aeroporto como entidade principal**.
- Foi identificado e corrigido um erro de sintaxe no `v7_radius500` (`"iata": null"`).

## Nova proposta de arquivo (ideal para busca)

Arquivo gerado: `cidades_aeroportos_search_v1.json`

Estrutura:
- `metadata`: versão, origem, contagens e timestamp.
- `airports[]`: índice por aeroporto (IATA único), com:
  - país/continente,
  - cidade principal (quando inferência tem confiança mínima),
  - amostra de cidades atendidas,
  - termos normalizados de busca,
  - agregadores metropolitanos aos quais pertence.
- `metro_aggregators[]`: grupos de busca por código metropolitano, ex.:
  - `SAO` → `GRU`, `CGH`, `VCP`
  - `RIO` → `GIG`, `SDU`
  - `NYC` → `JFK`, `LGA`, `EWR`

## Como usar no produto

Fluxo recomendado da busca:
1. Usuário digita termo.
2. Buscar primeiro em `metro_aggregators.search_terms`.
3. Em paralelo buscar em `airports.search_terms`.
4. Unificar resultados:
   - resultado de agregador retorna múltiplos aeroportos,
   - resultado de aeroporto retorna 1 IATA.
5. Entregar payload final de `airport_codes[]` para o provedor de voos.

## Observações

- A base original (`v7`) não contém nome oficial de aeroporto; por isso o índice prioriza IATA + termos de cidade/normalização.
- Os agregadores metropolitanos são curados (explícitos), para garantir códigos esperados no mercado (`SAO`, `RIO`, `NYC`, etc.).
