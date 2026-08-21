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
    kanbanNomeDisplay: 'Funil Pré Obra e Obra',
    basePath: '/operacoes',
    pageTitle: 'Funil Pré Obra e Obra',
    tabsVariant: 'operacoes',
    columnAccent: 'var(--moni-kanban-stepone)',
  });
}
