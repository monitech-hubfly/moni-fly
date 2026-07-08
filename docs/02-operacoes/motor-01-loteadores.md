# Motor 01 — Funil Loteadores

> Domínio: 02-operacoes

## Funcionalidade

Relação com loteadores: viabilidade, comitê, diligência, contrato parceria, link externo.

## Onde funciona

`/loteadores`, `/funil-moni-inc`

**Kanban:** `Funil Loteadores` — gate Comitê exige Acoplamento aprovado

## Banco

`rede_loteador_id`, `kanban_loteador_externo_tokens`

**Migrations:** `181_rename_kanban_funil_loteadores`, `311_funil_loteadores_contrato_parceria`, `335_funil_loteadores_fase_diligencia`, `317_funil_loteadores_sla_justificativa`

## Componentes

`src/lib/kanban/funil-loteadores.ts`


