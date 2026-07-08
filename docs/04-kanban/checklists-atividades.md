# Checklists e Atividades

> Domínio: 04-kanban

## Funcionalidade

Checklist por fase (`kanban_fase_checklist_*`) e interações (`kanban_atividades`) com integração Sirene.

## Banco

| Tabela | Uso |
|--------|-----|
| `kanban_fase_checklist_itens` | Template por fase |
| `kanban_fase_checklist_respostas` | Respostas por card |
| `kanban_atividades` | Interações, chamados, subinterações |

## Componentes

| Arquivo | Papel |
|---------|-------|
| `src/components/kanban-shared/FaseChecklistCard.tsx` | UI checklist |
| `src/components/kanban-shared/ProximaAtividadeDot.tsx` | Bolinha próxima atividade |
| `atividade-times-responsaveis.ts` | Filtros de times/responsáveis nas atividades |
| `src/app/steps-viabilidade/tarefas/TarefasPainelConteudo.tsx` | Painel atividades |

## Responsável por fase

`src/lib/kanban/responsavel-fase-checklist.ts`


