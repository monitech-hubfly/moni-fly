/**
 * Kanban **Funil Loteadores** (`kanbans.nome`): modal de novo card com condomínio/quadra/lote.
 */
import { guardLoginRequired } from '@/lib/auth-guard';
import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { KanbanBoard } from '@/components/kanban-shared/KanbanBoard';
import { KanbanWrapper } from '@/components/kanban-shared/KanbanWrapper';
import { fetchKanbanBoardSnapshot } from '@/components/kanban-shared/fetchKanbanBoardSnapshot';
import { PainelPerformance } from '@/components/kanban-shared/PainelPerformance';
import { KanbanTabs } from '@/app/funil-moni-inc/KanbanTabs';
import {
  isStaffKanbanLoteadores,
  KANBAN_NOME_FUNIL_LOTEADORES,
  resolverPrimeiraFaseContatoLoteadores,
} from '@/lib/kanban/funil-loteadores';
import type { KanbanCardBrief, KanbanFase } from '@/components/kanban-shared/types';

export const dynamic = 'force-dynamic';

const BASE_PATH = '/loteadores';

function primeiroQuery(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function LoteadoresKanbanPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const modalCardAberto = Boolean(
    primeiroQuery(searchParams.card) || primeiroQuery(searchParams.kanbanCard),
  );
  const activeTab =
    primeiroQuery(searchParams.tab) === 'painel' && !modalCardAberto ? 'painel' : 'kanban';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { kanban, fases, cards, cardsConcluidos, role } = await fetchKanbanBoardSnapshot(
    supabase,
    KANBAN_NOME_FUNIL_LOTEADORES,
    user.id,
  );

  const isStaff = isStaffKanbanLoteadores(role);
  const primeiraFaseContatoId = resolverPrimeiraFaseContatoLoteadores(fases ?? []);
  /** Botão visível para staff; permissão fina (`criar_cards`) validada no client e ao salvar. */
  const exibirNovoCard = isStaff && Boolean(primeiraFaseContatoId);

  if (!kanban) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--moni-surface-50)]">
        <div className="text-center">
          <h1 className="text-xl font-bold" style={{ color: 'var(--moni-text-primary)' }}>
            Kanban não encontrado
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            O kanban &ldquo;{KANBAN_NOME_FUNIL_LOTEADORES}&rdquo; ainda não foi configurado.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-moni-primary hover:underline">
            ← Voltar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <KanbanWrapper
      basePath={BASE_PATH}
      isAdmin={isStaff}
      kanbanId={kanban.id}
      kanbanNome="Funil Loteadores"
      fases={fases ?? []}
    >
      <div className="min-h-screen min-w-0 bg-[var(--moni-surface-50)]">
        <Suspense fallback={null}>
          <KanbanTabs
            basePath={BASE_PATH}
            tabsVariant="portfolio"
            kanbanId={String(kanban.id)}
            isAdmin={isStaff}
            primeiraFaseContatoId={primeiraFaseContatoId}
          />
        </Suspense>

        {activeTab === 'kanban' ? (
          <main className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8">
            <KanbanBoard
              fases={fases ?? []}
              cards={cards}
              cardsConcluidos={cardsConcluidos}
              basePath={BASE_PATH}
              userRole={role}
              columnAccent="var(--moni-kanban-stepone)"
              currentUserId={user.id}
              mostrarLinkNovoCard={exibirNovoCard}
              podeCriarCards={isStaff}
              kanbanNome="Funil Loteadores"
              kanbanId={kanban.id}
            />
          </main>
        ) : (
          <main className="mx-auto max-w-[1600px] px-6 py-8">
            <PainelPerformance
              kanbanNome="Funil Loteadores"
              kanbanId={kanban.id}
              fases={(fases ?? []) as KanbanFase[]}
              cards={cards as KanbanCardBrief[]}
              origemCards={cards.some((c) => c.origem === 'legado') ? 'legado' : 'nativo'}
            />
          </main>
        )}
      </div>
    </KanbanWrapper>
  );
}
