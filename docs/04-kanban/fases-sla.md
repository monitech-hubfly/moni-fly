# Fases e SLA

> Domínio: 04-kanban

## Funcionalidade

Cada `kanban_fases` define `sla_dias`, `sla_tipo` (úteis/corridos). Cards calculam status ok/atencao/atrasado.

## Componentes

`src/lib/kanban/kanban-card-sla.ts` — `tagSlaKanbanParaExibicao`, `indicadorBolinhaSlaKanban`

`src/lib/dias-uteis.ts` — `calcularStatusSLAPorTipo`

## Classes visuais

- Atenção: `moni-tag-atencao`
- Atrasado: `moni-tag-atrasado`

## SLA pausado

Crédito Obra fase `co_documentacao_alvara`: pausa até `alvara_url` e `docs_terreno_url` preenchidos.

## Justificativa

`src/lib/actions/kanban-sla-justificativa.ts` — `317_funil_loteadores_sla_justificativa.sql`


