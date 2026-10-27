/**
 * Kanban **Funil Showroom** (`kanbans.nome`): IMOB. Campos copiados do Portfólio.
 * Não vincula cards ao Funil Portfólio.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export default async function FunilShowroomPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Showroom',
    kanbanNomeDisplay: 'Funil Showroom',
    basePath: '/funil-showroom',
    pageTitle: 'Showroom',
    tabsVariant: 'portfolio',
    columnAccent: 'var(--moni-kanban-corretores)',
    novoCardApenasStaff: true,
  });
}
