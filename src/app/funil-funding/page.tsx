/**
 * Kanban **Funding** (`kanbans.nome`): nativo (`kanban_cards`), mesmos componentes que Funil Moní Capital.
 * Cards manuais: admin/team. Staff-only via `requireFunisInternosNegocioAccess`.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export default async function FunilFundingPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funding',
    kanbanNomeDisplay: 'Funding',
    basePath: '/funil-funding',
    pageTitle: 'Kanban Funding',
    tabsVariant: 'funding',
    columnAccent: 'var(--moni-navy-700)',
    novoCardApenasStaff: true,
  });
}
