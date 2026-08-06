import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { autoCurarCardsFunilStepOneAusentes } from '@/lib/kanban/ensure-funil-stepone-card-from-rede';
import { KanbanBoard } from './KanbanBoard';
import { KanbanWrapper } from './KanbanWrapper';
import { fetchKanbanBoardSnapshot } from './fetchKanbanBoardSnapshot';
import { PainelPerformance } from './PainelPerformance';
import type { KanbanCardBrief, KanbanFase } from './types';

export async function KanbanStepOneBoardLoader({
  userId,
  activeTab,
}: {
  userId: string;
  activeTab: string;
}) {
  const supabase = await createClient();
  const { kanban, fases, cards, cardsConcluidos, role, isAdmin, snapshotMode } =
    await fetchKanbanBoardSnapshot(supabase, 'Funil Step One', userId);

  const isStaff =
    role === 'admin' || role === 'team' || role === 'consultor' || role === 'supervisor';
  if (isStaff) {
    await autoCurarCardsFunilStepOneAusentes(userId);
  }

  if (!kanban) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--moni-surface-50)]">
        <div className="text-center">
          <h1 className="text-xl font-bold" style={{ color: 'var(--moni-text-primary)' }}>
            Kanban não encontrado
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
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
      {activeTab === 'kanban' && (
        <main className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8">
          <KanbanBoard
            fases={fases}
            cards={cards}
            cardsConcluidos={cardsConcluidos}
            basePath="/funil-stepone"
            userRole={role}
            columnAccent="var(--moni-kanban-stepone)"
            currentUserId={userId}
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
    </KanbanWrapper>
  );
}
