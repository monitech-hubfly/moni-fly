# Estrutura de Cards

> Domínio: 04-kanban

## Funcionalidade

Entidade central `kanban_cards` com vínculos a franqueado, rede, condomínio, processo e card pai.

## Banco — colunas principais

| Coluna | Significado |
|--------|-------------|
| `franqueado_id` | Dono — base RLS |
| `rede_franqueado_id` | Rede; sync group |
| `fase_id` | Coluna atual |
| `origem_card_id` | Bastão spawn |
| `arquivado`, `concluido` | Estados terminais |
| `entered_fase_at`, `sla_iniciado_em` | SLA |

Ver inventário §2.2 completo.

## Componentes

| Arquivo | Papel |
|---------|-------|
| `src/components/kanban-shared/KanbanCardModal.tsx` | Modal detalhe |
| `src/app/steps-viabilidade/CardDetalheModal.tsx` | Variante legado |
| `src/lib/actions/card-actions.ts` | Ações servidor |

## Constantes

`src/lib/constants/kanban-ids.ts` — `KANBAN_IDS`, `FASE_SLUGS`, `FASE_IDS`


