/**
 * Kanban **Funil IMOB** (`kanbans.nome`).
 * Esteira: Novo Loteador (não é conclusão) → Passagem → Reunião inicial e diagnóstico →
 * Definição de produto → Arquitetura e orçamento → Preço e pagamento → Materiais →
 * Treinamento dos corretores → Ativação da base → Operação.
 * Não vincula cards ao Funil Loteadores.
 */
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export default async function FunilImobPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil IMOB',
    kanbanNomeDisplay: 'Funil IMOB',
    basePath: '/funil-imob',
    pageTitle: 'IMOB',
    tabsVariant: 'portfolio',
    columnAccent: 'var(--moni-kanban-corretores)',
    novoCardApenasStaff: true,
  });
}
