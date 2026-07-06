/**
 * Kanban **Funil Motor 01** (`kanbans.nome`): nativo (`kanban_cards`), mesmos componentes que Funil Portfólio.
 * Cards manuais: admin/team. Staff-only via `requireFunisInternosNegocioAccess`.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export default async function FunilMotor01Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Motor 01',
    kanbanNomeDisplay: 'Funil Motor 01',
    basePath: '/funil-motor01',
    pageTitle: 'Kanban Funil Motor 01',
    tabsVariant: 'portfolio',
    columnAccent: 'var(--moni-kanban-stepone)',
    novoCardApenasStaff: true,
  });
}
