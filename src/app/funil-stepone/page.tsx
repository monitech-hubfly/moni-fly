import { guardLoginRequired } from '@/lib/auth-guard';
import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { autoCurarCardsFunilStepOneAusentes } from '@/lib/kanban/ensure-funil-stepone-card-from-rede';
import { KanbanBoard } from '@/components/kanban-shared/KanbanBoard';
import { KanbanWrapper } from '@/components/kanban-shared/KanbanWrapper';
import { fetchKanbanBoardSnapshot } from '@/components/kanban-shared/fetchKanbanBoardSnapshot';
import { KanbanTabs } from './KanbanTabs';
import { PainelPerformance } from '@/components/kanban-shared/PainelPerformance';
import type { KanbanCardBrief, KanbanFase } from '@/components/kanban-shared/types';

export const dynamic = 'force-dynamic';

export default async function FunilStepOnePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const activeTab = (searchParams.tab as string) || 'kanban';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { kanban, fases, cards, cardsConcluidos, role, isAdmin, snapshotMode } =
    await fetchKanbanBoardSnapshot(supabase, 'Funil Step One', user.id);

  const isStaff =
    role === 'admin' || role === 'team' || role === 'consultor' || role === 'supervisor';
  if (isStaff) {
    await autoCurarCardsFunilStepOneAusentes(user.id);
  }

  if (!kanban) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="text-center">
          <h1 className="text-xl font-bold text-stone-800">Kanban não encontrado</h1>
          <p className="mt-2 text-sm text-stone-600">
            O Kanban &ldquo;Funil Step One&rdquo; ainda não foi configurado.
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
      basePath="/funil-stepone"
      isAdmin={isAdmin}
      kanbanId={kanban.id}
      kanbanNome="Funil Step One"
      fases={fases}
      enableNovoCardModal
    >
      <div className="min-h-0 bg-stone-50">
        <Suspense fallback={null}>
          <KanbanTabs />
        </Suspense>

        {activeTab === 'kanban' && (
          <main className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8">
            <KanbanBoard
              fases={fases}
              cards={cards}
              cardsConcluidos={cardsConcluidos}
              basePath="/funil-stepone"
              userRole={role}
              columnAccent="var(--moni-kanban-stepone)"
              currentUserId={user.id}
              mostrarLinkNovoCard
              podeCriarCards={isAdmin ? true : undefined}
              kanbanNome="Funil Step One"
              kanbanNomeDb="Funil Step One"
              kanbanId={kanban.id}
              snapshotLean={snapshotMode === 'lean'}
            />
          </main>
        )}

        {activeTab === 'painel' && (
          <main className="mx-auto max-w-[1600px] px-6 py-8">
            <PainelPerformance
              kanbanNome="Funil Step One"
              kanbanId={String(kanban.id)}
              fases={(fases ?? []) as KanbanFase[]}
              cards={cards as KanbanCardBrief[]}
              origemCards="nativo"
            />
          </main>
        )}
      </div>
    </KanbanWrapper>
  );
}
