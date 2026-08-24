/**
 * Kanban **Funil Obra** (`kanbans.nome`): nativo (`kanban_cards`).
 * Entrada via bastão de Pré Obra (pre_mobilizacao); saída obra_entrega → Moní Care.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Funil Obra | moni-fly',
};

export default async function FunilObraPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Obra',
    kanbanNomeDisplay: 'Funil Obra',
    basePath: '/obra',
    pageTitle: 'Kanban Funil Obra',
    tabsVariant: 'acoplamento',
    columnAccent: 'var(--moni-navy-700)',
    novoCardApenasStaff: true,
  });
}
