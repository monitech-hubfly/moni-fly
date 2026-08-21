/**
 * Kanban **Funil Projeto Legal** (`kanbans.nome`): nativo (`kanban_cards`), mesmos componentes que Funil Acoplamento.
 * Cards manuais: admin/team.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export default async function FunilProjetoLegalPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Projeto Legal',
    kanbanNomeDisplay: 'Funil Projeto Legal',
    basePath: '/funil-projeto-legal',
    pageTitle: 'Kanban Funil Projeto Legal',
    tabsVariant: 'acoplamento',
    columnAccent: 'var(--moni-navy-700)',
    novoCardApenasStaff: true,
  });
}
