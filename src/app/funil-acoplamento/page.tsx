/**
 * Kanban **Funil Acoplamento** (`kanbans.nome`): nativo (`kanban_cards`), mesmos componentes que Portfolio/Operações.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';

export const dynamic = 'force-dynamic';

export default async function FunilAcoplamentoPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Acoplamento',
    kanbanNomeDisplay: 'Funil Acoplamento',
    basePath: '/funil-acoplamento',
    pageTitle: 'Kanban Funil Acoplamento',
    tabsVariant: 'acoplamento',
    columnAccent: 'var(--moni-navy-700)',
  });
}
