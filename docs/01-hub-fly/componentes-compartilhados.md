# Componentes Compartilhados

> Domínio: 01-hub-fly

## Funcionalidade

Biblioteca de UI e helpers reutilizados entre funis, Sirene e portal.

## Objetivo

Evitar duplicação; manter padrão visual Moní.

## Componentes-chave

| Caminho | Uso |
|---------|-----|
| `src/components/PortalSidebar.tsx` | Menu lateral |
| `src/components/kanban-shared/*` | Modal, checklist, SLA dots, filtros |
| `src/components/carometro/*` | Carômetro / Gantt / TO DO |
| `src/hooks/useAuditLog.js` | Auditoria |
| `src/utils/periodos.js` | Semanas ISO |
| `src/utils/semaforoFaixas.js` | Semáforo metas |

## Kanban shared (amostra)

- `KanbanCardModal.tsx` — modal de detalhe do card
- `FaseChecklistCard.tsx` — checklist por fase
- `ProximaAtividadeDot.tsx`, `FundingAtividadeDot.tsx` — bolinhas de atividade
- `ChamadoAtividadesPanel.tsx` — painel Sirene no card

## Lib de ações

| Arquivo | Ações |
|---------|-------|
| `src/lib/actions/card-actions.ts` | Arquivar, excluir, mover fase |
| `src/lib/actions/kanban-sla-justificativa.ts` | Justificativa SLA |

## Próximas melhorias

- [ ] Mapa de dependências entre kanban-shared e funis


