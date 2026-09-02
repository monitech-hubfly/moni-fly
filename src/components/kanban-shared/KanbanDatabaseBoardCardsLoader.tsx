import { createClient } from '@/lib/supabase/server';
import { KanbanBoard } from './KanbanBoard';
import { fetchKanbanBoardSnapshot, KANBAN_BOARD_DEFERRED_FETCH_OPTS } from './fetchKanbanBoardSnapshot';
import { PainelPerformance } from './PainelPerformance';
import type { KanbanDatabasePageConfig } from './renderKanbanDatabasePage';
import type { KanbanFase } from './types';

export type KanbanDatabaseBoardCardsLoaderProps = {
  userId: string;
  config: KanbanDatabasePageConfig;
  activeTab: 'kanban' | 'painel';
  kanbanId: string;
  fases: KanbanFase[];
  isAdmin: boolean;
  role: string;
};

/** Só cards/painel — vive dentro do Suspense; modais ficam no `KanbanWrapper` pai. */
export async function KanbanDatabaseBoardCardsLoader({
  userId,
  config,
  activeTab,
  kanbanId,
  fases,
  isAdmin,
  role,
}: KanbanDatabaseBoardCardsLoaderProps) {
  const supabase = await createClient();
  const { cards, cardsConcluidos, snapshotMode } = await fetchKanbanBoardSnapshot(
    supabase,
    config.kanbanNomeDb,
    userId,
    KANBAN_BOARD_DEFERRED_FETCH_OPTS,
  );

  const exibirNovoCard = config.novoCardApenasStaff ? isAdmin : true;

  if (activeTab === 'kanban') {
    return (
      <main className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8">
        <KanbanBoard
          fases={fases}
          cards={cards}
          cardsConcluidos={cardsConcluidos}
          basePath={config.basePath}
          userRole={role}
          columnAccent={config.columnAccent}
          currentUserId={userId}
          mostrarLinkNovoCard={exibirNovoCard}
          podeCriarCards={exibirNovoCard ? true : false}
          kanbanNome={config.kanbanNomeDisplay}
          kanbanNomeDb={config.kanbanNomeDb}
          kanbanId={kanbanId}
          snapshotLean={snapshotMode === 'lean'}
          deferEnrichments={true}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8">
      <PainelPerformance
        kanbanNome={config.kanbanNomeDisplay}
        kanbanId={kanbanId}
        fases={fases}
        cards={cards}
        origemCards={cards.some((c) => c.origem === 'legado') ? 'legado' : 'nativo'}
      />
    </main>
  );
}
