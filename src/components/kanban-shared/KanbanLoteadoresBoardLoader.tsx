import { Suspense } from 'react';
import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { KanbanTabs } from '@/app/funil-moni-inc/KanbanTabs';
import {
  isStaffKanbanLoteadores,
  KANBAN_NOME_FUNIL_LOTEADORES,
  resolverPrimeiraFaseContatoLoteadores,
} from '@/lib/kanban/funil-loteadores';
import { KanbanLoteadoresBoardCardsLoader } from './KanbanLoteadoresBoardCardsLoader';
import { KanbanNotFound } from './KanbanNotFound';
import { KanbanWrapper } from './KanbanWrapper';
import { fetchKanbanBoardShell } from './fetchKanbanBoardSnapshot';

const BASE_PATH = '/loteadores';

export async function KanbanLoteadoresBoardLoader({
  userId,
  activeTab,
}: {
  userId: string;
  activeTab: 'kanban' | 'painel';
}) {
  const supabase = await createClient();
  const shell = await fetchKanbanBoardShell(supabase, KANBAN_NOME_FUNIL_LOTEADORES, userId);

  if (!shell.kanban) {
    return <KanbanNotFound kanbanNomeDb={KANBAN_NOME_FUNIL_LOTEADORES} />;
  }

  const isStaff = shell.isAdmin || isStaffKanbanLoteadores(shell.role);
  const primeiraFaseContatoId = resolverPrimeiraFaseContatoLoteadores(shell.fases ?? []);
  const exibirNovoCard = isStaff && Boolean(primeiraFaseContatoId);

  return (
    <KanbanWrapper
      basePath={BASE_PATH}
      isAdmin={isStaff}
      kanbanId={shell.kanban.id}
      kanbanNome="Funil Loteadores"
      fases={shell.fases ?? []}
    >
      <Suspense fallback={null}>
        <KanbanTabs
          basePath={BASE_PATH}
          tabsVariant="portfolio"
          kanbanId={shell.kanban.id}
          isAdmin={isStaff}
          primeiraFaseContatoId={primeiraFaseContatoId}
        />
      </Suspense>

      <Suspense fallback={null}>
        <KanbanLoteadoresBoardCardsLoader
          userId={userId}
          activeTab={activeTab}
          kanbanId={shell.kanban.id}
          fases={shell.fases ?? []}
          role={shell.role}
          exibirNovoCard={exibirNovoCard}
        />
      </Suspense>
    </KanbanWrapper>
  );
}
