# TO DO & Planning

> Última atualização: 2026-07-07 | Domínio: 07-carometro

## Funcionalidade

Backlog unificado: atividades do Gantt, cards Kanban pendentes e tópicos Sirene para planejamento.

## Objetivo

Dar visão única do que precisa ser feito, cruzando Kanban, Sirene e planejamento semanal.

## Onde funciona

- Rota: `/carometro/todo-planning`
- Rota auxiliar: `/carometro/todo`

## Banco

| Fonte | Tabela |
|-------|--------|
| Atividades | `gantt_planejamento` |
| Cards backlog | `kanban_cards` + `kanban_fase_checklist_respostas` |
| Sirene | `sirene_topicos` + `kanban_atividades` |

## Próximas melhorias

- [ ] TODO: query exata do backlog (conforme spec da Ingrid)
- [ ] TODO: filtros e priorização na UI
