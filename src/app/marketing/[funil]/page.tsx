import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';
import { isMarketingFunilSlug, marketingFunilPorSlug } from '@/lib/kanban/funis-marketing';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: { funil: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export function generateMetadata({ params }: { params: { funil: string } }): Metadata {
  const def = marketingFunilPorSlug(params.funil);
  if (!def) return { title: 'Funil não encontrado | Hub de Funis' };
  return { title: `${def.titulo} | Hub de Funis` };
}

export default async function MarketingFunilKanbanPage({ params, searchParams }: PageProps) {
  if (!isMarketingFunilSlug(params.funil)) notFound();
  const def = marketingFunilPorSlug(params.funil);
  if (!def) notFound();

  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: def.kanbanNomeDb,
    kanbanNomeDisplay: def.kanbanNomeDb,
    basePath: `/marketing/${def.slug}`,
    pageTitle: `Kanban ${def.titulo}`,
    tabsVariant: 'portfolio',
    columnAccent: 'var(--moni-kanban-marketing)',
    novoCardApenasStaff: true,
  });
}
