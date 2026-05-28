/**
 * Kanban **Funil Contratações** (RH): acesso só `admin` ou `cargo = adm`.
 * Sem vínculo com esteiras de Novos Negócios.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunilContratacoesAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export default async function FunilContratacoesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunilContratacoesAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Contratações',
    kanbanNomeDisplay: 'Funil Contratações',
    basePath: '/funil-contratacoes',
    pageTitle: 'Kanban Contratações',
    tabsVariant: 'contratacoes',
    columnAccent: 'var(--moni-navy-700)',
    novoCardApenasStaff: true,
  });
}
