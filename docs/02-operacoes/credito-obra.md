# Funil Crédito Obra

> Domínio: 02-operacoes

## Funcionalidade

Financiamento de obra via Cash Me: 25 fases, tranches 2ª–6ª, SLA pausado em documentação.

## Onde funciona

`/funil-credito-obra`

**UUID:** `6463af1d-850d-4958-b74c-404f8d668e21` (`KANBAN_IDS.CREDITO_OBRA`)

## Banco

Colunas: `alvara_url`, `docs_terreno_url`, `sla_iniciado_em`

**Migration:** `229_kanban_credito_obra_documentacao_sla.sql`

## Componentes

`src/lib/kanban/kanban-card-sla.ts` — tag `Aguardando Documentação` (`moni-tag-atencao`)

Fases: slugs `co_*` em `FASE_SLUGS` — ver `.cursor/rules/funil-credito-obra-prompts.mdc`

## Próximas melhorias

- [ ] Mapa completo tranches × Operações


