import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { KanbanTabs } from '@/app/funil-moni-inc/KanbanTabs';
import {
  isStaffKanbanLoteadores,
  KANBAN_NOME_FUNIL_LOTEADORES,
  resolverPrimeiraFaseContatoLoteadores,
} from '@/lib/kanban/funil-loteadores';
import { KanbanBoard } from './KanbanBoard';
import { KanbanWrapper } from './KanbanWrapper';
import { fetchKanbanBoardSnapshot } from './fetchKanbanBoardSnapshot';
import { PainelPerformance } from './PainelPerformance';
import type { KanbanCardBrief, KanbanFase } from './types';

const BASE_PATH = '/loteadores';

export async function KanbanLoteadoresBoardLoader({
  userId,
  activeTab,
}: {
  userId: string;
  activeTab: 'kanban' | 'painel';
}) {
  const supabase = await createClient();
  const { kanban, fases, cards, cardsConcluidos, role, isAdmin, snapshotMode } =
    await fetchKanbanBoardSnapshot(supabase, KANBAN_NOME_FUNIL_LOTEADORES, userId);

  const isStaff = isAdmin || isStaffKanbanLoteadores(role);
  const primeiraFaseContatoId = resolverPrimeiraFaseContatoLoteadores(fases ?? []);
  const exibirNovoCard = isStaff && Boolean(primeiraFaseContatoId);

  if (!kanban) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--moni-surface-50)]">
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
            currentUserId={userId}
            mostrarLinkNovoCard={exibirNovoCard}
            podeCriarCards={exibirNovoCard ? true : false}
            kanbanNome="Funil Loteadores"
            kanbanNomeDb={KANBAN_NOME_FUNIL_LOTEADORES}
            kanbanId={kanban.id}
            snapshotLean={snapshotMode === 'lean'}
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
    </KanbanWrapper>
  );
}
