/**
 * Venda Casas Loteadores — Kanban com 3 sub-funis (IMOB / migration 605).
 *
 * Sub-funís selecionáveis via `?subfunil=nao-vendidos|vendidos|showroom`.
 * Cada sub-funil mapeia para um kanban separado no banco com as mesmas 7 fases.
 * O restante da renderização reutiliza `renderKanbanDatabasePage`.
 */
import { Suspense } from 'react';
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { VendaCasasSubfunilTabs, type VclSubfunil } from '@/components/venda-casas-loteadores/VendaCasasSubfunilTabs';
import { ImportarVCLButton } from '@/components/venda-casas-loteadores/ImportarVCLButton';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Venda Casas Loteadores | moni-fly',
};

/** Mapeia o search param para o `kanbans.nome` exato no banco. */
const SUBFUNIL_NOME: Record<VclSubfunil, string> = {
  'nao-vendidos': 'Venda Casas Loteadores - Lotes Não Vendidos',
  'vendidos':     'Venda Casas Loteadores - Lotes Vendidos',
  'showroom':     'Venda Casas Loteadores - Showroom',
};

function resolverSubfunil(raw: string | string[] | undefined): VclSubfunil {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'vendidos' || v === 'showroom') return v;
  return 'nao-vendidos';
}

export default async function VendaCasasLoteadoresPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await requireFunisInternosNegocioAccess();

  const subfunil = resolverSubfunil(searchParams.subfunil);
  const kanbanNomeDb = SUBFUNIL_NOME[subfunil];

  return (
    <div className="min-h-0 min-w-0">
      {/* Abas de sub-funil */}
      <Suspense fallback={null}>
        <VendaCasasSubfunilTabs subfunil={subfunil} />
      </Suspense>

      {/* Botão Importar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '8px 20px 0',
        }}
      >
        <Suspense fallback={null}>
          <ImportarVCLButton subfunil={subfunil} basePath="/venda-casas-loteadores" />
        </Suspense>
      </div>

      {await renderKanbanDatabasePage(searchParams, {
        kanbanNomeDb,
        kanbanNomeDisplay: 'Venda Casas Loteadores',
        basePath: '/venda-casas-loteadores',
        pageTitle: 'Venda Casas Loteadores',
        tabsVariant: 'acoplamento',
        columnAccent: 'var(--moni-kanban-corretores)',
        novoCardApenasStaff: false,
      })}
    </div>
  );
}
