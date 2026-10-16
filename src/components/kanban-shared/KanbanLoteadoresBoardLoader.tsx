import { Suspense } from 'react';
import { KanbanTabs } from '@/app/funil-moni-inc/KanbanTabs';
import {
  isStaffKanbanLoteadores,
  resolverPrimeiraFaseContatoLoteadores,
} from '@/lib/kanban/funil-loteadores';
import type { UrlModalState } from '@/lib/kanban/kanban-url-modal-state';
import { KanbanBoardSkeleton } from './KanbanBoardSkeleton';
import { KanbanLoteadoresBoardCardsLoader } from './KanbanLoteadoresBoardCardsLoader';
import { KanbanWrapper } from './KanbanWrapper';
import type { KanbanFase } from './types';

const BASE_PATH = '/loteadores';

export function KanbanLoteadoresBoardLoader({
  userId,
  activeTab,
  kanbanId,
  fases,
  role,
  isAdmin,
  accessToken,
  initialUrlState,
}: {
  userId: string;
  activeTab: 'kanban' | 'painel';
  kanbanId: string;
  fases: KanbanFase[];
  role: string;
  isAdmin: boolean;
  accessToken: string | null;
  initialUrlState: UrlModalState;
}) {
  const isStaff = isAdmin || isStaffKanbanLoteadores(role);
  const primeiraFaseContatoId = resolverPrimeiraFaseContatoLoteadores(fases ?? []);
  const exibirNovoCard = isStaff && Boolean(primeiraFaseContatoId);

  return (
    <KanbanWrapper
      basePath={BASE_PATH}
      isAdmin={isStaff}
      kanbanId={kanbanId}
      kanbanNome="Funil Loteadores"
      fases={fases ?? []}
      initialUrlState={initialUrlState}
    >
      <Suspense fallback={null}>
        <KanbanTabs
          basePath={BASE_PATH}
          tabsVariant="portfolio"
          kanbanId={kanbanId}
          isAdmin={isStaff}
          primeiraFaseContatoId={primeiraFaseContatoId}
        />
      </Suspense>

      <Suspense fallback={<KanbanBoardSkeleton />}>
        <KanbanLoteadoresBoardCardsLoader
          userId={userId}
          activeTab={activeTab}
          kanbanId={kanbanId}
          fases={fases ?? []}
          role={role}
          exibirNovoCard={exibirNovoCard}
          accessToken={accessToken}
        />
      </Suspense>
    </KanbanWrapper>
  );
}
