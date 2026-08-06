import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { KanbanBoard } from './KanbanBoard';
import { KanbanWrapper } from './KanbanWrapper';
import { fetchKanbanBoardSnapshot } from './fetchKanbanBoardSnapshot';
import { PainelPerformance } from './PainelPerformance';
import type { KanbanDatabasePageConfig } from './renderKanbanDatabasePage';

export type KanbanDatabaseBoardLoaderProps = {
  userId: string;
  config: KanbanDatabasePageConfig;
  activeTab: 'kanban' | 'painel';
  modalCardAberto: boolean;
};

/** Carrega snapshot pesado fora do shell — permite streaming imediato das abas. */
export async function KanbanDatabaseBoardLoader({
  userId,
  config,
  activeTab,
  modalCardAberto,
}: KanbanDatabaseBoardLoaderProps) {
  const supabase = await createClient();
  const { kanban, fases, cards, cardsConcluidos, role, isAdmin, snapshotMode } =
    await fetchKanbanBoardSnapshot(supabase, config.kanbanNomeDb, userId, {
      skipCalculadoraSlaEnrich: modalCardAberto,
      deferBoardEnrichments: !modalCardAberto,
    });

  const exibirNovoCard = config.novoCardApenasStaff ? isAdmin : true;

  if (!kanban) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--moni-surface-50)]">
        <div className="text-center">
          <h1 className="text-xl font-bold" style={{ color: 'var(--moni-text-primary)' }}>
            Kanban não encontrado
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            O kanban &ldquo;{config.kanbanNomeDb}&rdquo; ainda não está cadastrado (migration 111 ou seed).
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
      basePath={config.basePath}
      isAdmin={isAdmin}
      kanbanId={kanban.id}
      kanbanNome={config.kanbanNomeDisplay}
      fases={fases ?? []}
      camposPorFase={config.camposPorFase}
      enableNovoCardModal={exibirNovoCard}
    >
      {activeTab === 'kanban' ? (
        <main className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8">
          <KanbanBoard
            fases={fases ?? []}
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
            kanbanId={kanban.id}
            snapshotLean={snapshotMode === 'lean'}
            deferEnrichments={!modalCardAberto}
          />
        </main>
      ) : (
        <main className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8">
          <PainelPerformance
            kanbanNome={config.kanbanNomeDisplay}
            kanbanId={kanban.id}
            fases={fases ?? []}
            cards={cards}
            origemCards={cards.some((c) => c.origem === 'legado') ? 'legado' : 'nativo'}
          />
        </main>
      )}
    </KanbanWrapper>
  );
}
