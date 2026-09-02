---
name: especialista-hub-fly-kanban
description: >-
  Especialista no motor Kanban Hub Fly: cards, fases, comentários, checklists,
  próxima atividade, SLA e bolinhas, dashboard de tarefas, arquivar, mover fase,
  permissões por card, tags, vínculos, chamados Sirene no card e timeline. Use
  para CardDetalheModal, card-actions, painel de atividades ou qualquer tabela
  kanban_*.
---

# Especialista Hub Fly Kanban

## Arquivos obrigatórios

| Arquivo | Uso |
|---------|-----|
| `src/components/kanban-shared/KanbanCardModal.tsx` | Modal detalhe |
| `src/lib/actions/card-actions.ts` | Arquivar, mover, excluir |
| `src/lib/kanban/kanban-card-sla.ts` | SLA e tags |
| `src/lib/kanban/kanban-card-href.ts` | Deep links |
| `src/lib/kanban/responsavel-fase-checklist.ts` | Responsável fase |
| `src/app/steps-viabilidade/tarefas/TarefasPainelConteudo.tsx` | Painel atividades |

## Tabelas

`kanbans`, `kanban_fases`, `kanban_cards`, `kanban_fase_checklist_*`, `kanban_atividades`, `kanban_card_comentarios`, `kanban_historico`, `kanban_tags`

## SLA

- Cálculo: `calcularStatusSLAPorTipo` (`dias-uteis.ts`)
- Classes: `moni-tag-atencao`, `moni-tag-atrasado`
- Pausa documentação: Crédito Obra `co_documentacao_alvara`

## Bolinhas

`ProximaAtividadeDot.tsx`, `FundingAtividadeDot.tsx`

## Docs

[docs/04-kanban/](../../docs/04-kanban/) + [inventario-kanban-funil-completo.md](../../docs/inventario-kanban-funil-completo.md)

## Ao editar UI

Só visual: trocar hex por tokens `moni-tokens.css`. Não alterar lógica de negócio sem pedido explícito.

