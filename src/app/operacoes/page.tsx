/**
 * Kanban **Operações** (`kanbans.nome`): mesmos componentes compartilhados que Portfolio/Funil.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';

export const dynamic = 'force-dynamic';

export default async function OperacoesKanbanPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Operações',
    kanbanNomeDisplay: 'Funil Operações',
    basePath: '/operacoes',
    pageTitle: 'Kanban Operações',
    tabsVariant: 'operacoes',
    columnAccent: 'var(--moni-kanban-stepone)',
  });
}
