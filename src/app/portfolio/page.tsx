/**
 * Kanban **Portfolio** (`kanbans.nome`): colunas via `KanbanBoard`, modal via `KanbanWrapper` → `KanbanCardModal`.
 * Checklist por fase: passe `camposPorFase` em `renderKanbanDatabasePage` (mapa `fase_id` → ReactNode).
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';

export const dynamic = 'force-dynamic';

export default async function PortfolioKanbanPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Portfólio',
    kanbanNomeDisplay: 'Funil Portfólio',
    basePath: '/portfolio',
    pageTitle: 'Kanban Portfolio',
    tabsVariant: 'portfolio',
    columnAccent: 'var(--moni-kanban-stepone)',
  });
}
