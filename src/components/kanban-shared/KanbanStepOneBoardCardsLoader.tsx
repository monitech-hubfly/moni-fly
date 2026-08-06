import { createClient } from '@/lib/supabase/server';
import { KanbanBoard } from './KanbanBoard';
import { fetchKanbanBoardSnapshot } from './fetchKanbanBoardSnapshot';
import { PainelPerformance } from './PainelPerformance';
import type { KanbanCardBrief, KanbanFase } from './types';

/** Só cards/painel — modais ficam no `KanbanWrapper` pai (fora do Suspense). */
export async function KanbanStepOneBoardCardsLoader({
  userId,
  activeTab,
  kanbanId,
  fases,
  role,
  isAdmin,
}: {
  userId: string;
  activeTab: string;
  kanbanId: string;
  fases: KanbanFase[];
  role: string;
  isAdmin: boolean;
}) {
  const supabase = await createClient();
  const { cards, cardsConcluidos, snapshotMode } = await fetchKanbanBoardSnapshot(
    supabase,
    'Funil Step One',
    userId,
  );

  if (activeTab === 'kanban') {
    return (
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
          kanbanId={kanbanId}
          snapshotLean={snapshotMode === 'lean'}
        />
      </main>
    );
  }

  if (activeTab === 'painel') {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <PainelPerformance
          kanbanNome="Funil Step One"
          kanbanId={kanbanId}
          fases={fases}
          cards={cards as KanbanCardBrief[]}
          origemCards="nativo"
        />
      </main>
    );
  }

  return null;
}
