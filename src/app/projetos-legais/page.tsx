/**
 * Kanban **Funil Projetos Legais** (`kanbans.nome`): colunas via `KanbanBoard`, modal via `KanbanWrapper` → `KanbanCardModal`.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export default async function ProjetosLegaisKanbanPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Projetos Legais',
    kanbanNomeDisplay: 'Funil Projetos Legais',
    basePath: '/projetos-legais',
    pageTitle: 'Kanban Projetos Legais',
    tabsVariant: 'acoplamento',
    columnAccent: 'var(--moni-navy-700)',
    novoCardApenasStaff: true,
  });
}
