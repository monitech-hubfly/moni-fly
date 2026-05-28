/**
 * Kanban **Funil Jurídico** (`kanbans.nome`): nativo (`kanban_cards`), mesmos componentes que Funil Acoplamento.
 * Cards manuais: admin/team. Bastões automáticos: `origem_card_id` preenchido.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export default async function FunilJuridicoPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Jurídico',
    kanbanNomeDisplay: 'Funil Jurídico',
    basePath: '/funil-juridico',
    pageTitle: 'Kanban Funil Jurídico',
    tabsVariant: 'juridico',
    columnAccent: 'var(--moni-navy-700)',
    novoCardApenasStaff: true,
  });
}
