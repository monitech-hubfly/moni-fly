/**
 * Kanban **Funil Corretores** (`kanbans.nome`): leads via formulário público.
 * Entrada: /formulario-corretor/[token] → fase cor_oportunidade.
 * Terminais: Convertido / Perdido arquivam automaticamente (sem bastão por enquanto).
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';
import { GerarLinkCorretorButton } from './GerarLinkCorretorButton';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Funil Corretores | moni-fly',
};

export default async function FunilCorretoresPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return (
    <div className="min-h-0 min-w-0">
      <div className="flex justify-end px-4 pt-3 sm:px-6">
        <GerarLinkCorretorButton />
      </div>
      {/* TODO métricas: total ativos, convertidos/perdidos no mês, taxa, top 3 corretores — quando houver painel configurável no renderKanbanDatabasePage */}
      {await renderKanbanDatabasePage(searchParams, {
        kanbanNomeDb: 'Funil Corretores',
        kanbanNomeDisplay: 'Funil Corretores',
        basePath: '/corretores',
        pageTitle: 'Kanban Funil Corretores',
        tabsVariant: 'acoplamento',
        columnAccent: 'var(--moni-kanban-corretores)',
        novoCardApenasStaff: true,
      })}
    </div>
  );
}
