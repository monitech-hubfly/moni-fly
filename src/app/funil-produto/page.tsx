/**
 * Kanban **Funil Produto** (`kanbans.nome`): nativo (`kanban_cards`), mesmos componentes que Funil Acoplamento.
 * Cards manuais: admin/team.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export default async function FunilProdutoPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Produto',
    kanbanNomeDisplay: 'Funil Produto',
    basePath: '/funil-produto',
    pageTitle: 'Kanban Funil Produto',
    tabsVariant: 'acoplamento',
    columnAccent: 'var(--moni-navy-700)',
    novoCardApenasStaff: true,
  });
}
