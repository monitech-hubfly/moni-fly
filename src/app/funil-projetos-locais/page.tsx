/**
 * Kanban **Funil Projetos Locais** (`kanbans.nome`): nativo (`kanban_cards`), mesmos componentes que Funil Acoplamento.
 * Cards manuais: admin/team.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export default async function FunilProjetosLocaisPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Projetos Locais',
    kanbanNomeDisplay: 'Funil Projetos Locais',
    basePath: '/funil-projetos-locais',
    pageTitle: 'Kanban Funil Projetos Locais',
    tabsVariant: 'acoplamento',
    columnAccent: 'var(--moni-navy-700)',
    novoCardApenasStaff: true,
  });
}
