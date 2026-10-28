/**
 * Kanban **Operações** (`kanbans.nome`): mesmos componentes compartilhados que Portfolio/Funil.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { garantirPreObraCreditoAprovadoPendentes } from '@/lib/actions/kanban-bastoes';

export const dynamic = 'force-dynamic';

export default async function OperacoesKanbanPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  try {
    await garantirPreObraCreditoAprovadoPendentes();
  } catch (e) {
    console.error('[operacoes] crédito aprovado pendente:', e);
  }
  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Operações',
    kanbanNomeDisplay: 'Funil Pré Obra e Obra',
    basePath: '/operacoes',
    pageTitle: 'Funil Pré Obra e Obra',
    tabsVariant: 'operacoes',
    columnAccent: 'var(--moni-kanban-stepone)',
  });
}
