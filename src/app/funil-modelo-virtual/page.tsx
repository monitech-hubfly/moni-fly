/**
 * Kanban **Funil Modelo Virtual** (`kanbans.nome`): nativo (`kanban_cards`), mesmos componentes que Funil Acoplamento.
 * Cards manuais: admin/team.
 * Bastão: Funil Produto (prod_publicado) → mv_modelagem_casa.
 *
 * TODO card fechado: badges "Bruna", "Aguardando Boss Panel" e "Pode repetir" por slug —
 * hoje usa título/fase/SLA padrão do board (sem customização por funil).
 * cor_hex por fase não existe em kanban_fases neste ambiente — accent único via columnAccent.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Funil Modelo Virtual | moni-fly',
};

export default async function FunilModeloVirtualPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Modelo Virtual',
    kanbanNomeDisplay: 'Funil Modelo Virtual',
    basePath: '/funil-modelo-virtual',
    pageTitle: 'Kanban Funil Modelo Virtual',
    tabsVariant: 'acoplamento',
    columnAccent: 'var(--moni-navy-700)',
    novoCardApenasStaff: true,
  });
}
