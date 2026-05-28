/**
 * Kanban **Funil Loteadores** (`kanbans.nome`): colunas via `KanbanBoard`, modal via `KanbanWrapper` → `KanbanCardModal`.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';

export const dynamic = 'force-dynamic';

export default async function LoteadoresKanbanPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Loteadores',
    kanbanNomeDisplay: 'Funil Loteadores',
    basePath: '/loteadores',
    pageTitle: 'Kanban Loteadores',
    tabsVariant: 'portfolio',
    columnAccent: 'var(--moni-kanban-stepone)',
  });
}
