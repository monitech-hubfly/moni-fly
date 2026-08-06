import { createClient } from '@/lib/supabase/server';
import { KANBAN_NOME_FUNIL_LOTEADORES } from '@/lib/kanban/funil-loteadores';
import { KanbanBoard } from './KanbanBoard';
import { fetchKanbanBoardSnapshot, KANBAN_BOARD_DEFERRED_FETCH_OPTS } from './fetchKanbanBoardSnapshot';
import { PainelPerformance } from './PainelPerformance';
import type { KanbanCardBrief, KanbanFase } from './types';

/** Só cards/painel — modais ficam no `KanbanWrapper` pai (fora do Suspense). */
export async function KanbanLoteadoresBoardCardsLoader({
  userId,
  activeTab,
  kanbanId,
  fases,
  role,
  exibirNovoCard,
}: {
  userId: string;
  activeTab: 'kanban' | 'painel';
  kanbanId: string;
  fases: KanbanFase[];
  role: string;
  exibirNovoCard: boolean;
}) {
  const supabase = await createClient();
  const { cards, cardsConcluidos, snapshotMode } = await fetchKanbanBoardSnapshot(
    supabase,
    KANBAN_NOME_FUNIL_LOTEADORES,
    userId,
    KANBAN_BOARD_DEFERRED_FETCH_OPTS,
  );

  if (activeTab === 'kanban') {
    return (
      <main className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8">
        <KanbanBoard
          fases={fases}
          cards={cards}
          cardsConcluidos={cardsConcluidos}
          basePath="/loteadores"
          userRole={role}
          columnAccent="var(--moni-kanban-stepone)"
          currentUserId={userId}
          mostrarLinkNovoCard={exibirNovoCard}
          podeCriarCards={exibirNovoCard ? true : false}
          kanbanNome="Funil Loteadores"
          kanbanNomeDb={KANBAN_NOME_FUNIL_LOTEADORES}
          kanbanId={kanbanId}
          snapshotLean={snapshotMode === 'lean'}
          deferEnrichments={true}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8">
      <PainelPerformance
        kanbanNome="Funil Loteadores"
        kanbanId={kanbanId}
        fases={fases as KanbanFase[]}
        cards={cards as KanbanCardBrief[]}
        origemCards={cards.some((c) => c.origem === 'legado') ? 'legado' : 'nativo'}
      />
    </main>
  );
}
