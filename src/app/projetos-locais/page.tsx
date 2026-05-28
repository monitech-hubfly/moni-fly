/**
 * Kanban **Funil Projetos Locais** (`kanbans.nome`): colunas via `KanbanBoard`, modal via `KanbanWrapper` → `KanbanCardModal`.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export default async function ProjetosLocaisKanbanPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Projetos Locais',
    kanbanNomeDisplay: 'Funil Projetos Locais',
    basePath: '/projetos-locais',
    pageTitle: 'Kanban Projetos Locais',
    tabsVariant: 'acoplamento',
    columnAccent: 'var(--moni-navy-700)',
    novoCardApenasStaff: true,
  });
}
