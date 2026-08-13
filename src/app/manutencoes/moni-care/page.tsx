import type { Metadata } from 'next';
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';
import { KANBAN_NOME_MONI_CARE, MONI_CARE_BASE_PATH } from '@/lib/kanban/funil-moni-care';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export const metadata: Metadata = {
  title: 'Funil Moní Care | Manutenções | Hub de Funis',
};

export default async function MoniCareKanbanPage({ searchParams }: PageProps) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: KANBAN_NOME_MONI_CARE,
    kanbanNomeDisplay: KANBAN_NOME_MONI_CARE,
    basePath: MONI_CARE_BASE_PATH,
    pageTitle: 'Kanban Funil Moní Care',
    tabsVariant: 'portfolio',
    columnAccent: 'var(--moni-kanban-moni-care)',
    novoCardApenasStaff: true,
  });
}
