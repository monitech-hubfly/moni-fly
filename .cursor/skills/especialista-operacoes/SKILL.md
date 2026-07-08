---
name: especialista-operacoes
description: >-
  Especialista nos funis operacionais Casa Moní: Step One, Portfólio, Acoplamento,
  Projeto Legal, Crédito Obra, Operações, Contabilidade, Loteadores (Motor 01),
  Moní Capital, Obra e pós-obra. Use ao implementar ou debugar fluxos de negócio,
  bastões entre funis, flags paralelas ou fases específicas.
---

# Especialista Operações

## Quando usar

- Rotas `/funil-*`, `/portfolio`, `/operacoes`, `/loteadores`
- Bastões spawn, flags `*_ok` no card pai Portfólio
- Gates (ex.: Comitê exige Acoplamento)
- Step One: kanban + processo legado 11 etapas

## Constantes

`src/lib/constants/kanban-ids.ts` — `KANBAN_IDS`, `FASE_SLUGS`

| Funil | Rota | ID constante |
|-------|------|--------------|
| Step One | `/funil-stepone` | `STEP_ONE` |
| Portfólio | `/portfolio` | `PORTFOLIO` |
| Acoplamento | `/funil-acoplamento` | `ACOPLAMENTO` |
| Crédito Obra | `/funil-credito-obra` | `CREDITO_OBRA` |
| Operações | `/operacoes` | `OPERACOES` |
| Loteadores | `/loteadores` | `LOTEADORES` |
| Moní Capital | `/funil-moni-capital` | `MONI_CAPITAL` |

## Inventário completo

Ler [docs/inventario-kanban-funil-completo.md](../../docs/inventario-kanban-funil-completo.md) para tabelas, fases, gates e diagramas.

## Docs por módulo

[docs/02-operacoes/](../../docs/02-operacoes/)

## Padrão novo funil

Migration modelo: `419_kanban_funding.sql` + registrar slugs em `kanban-ids.ts`

