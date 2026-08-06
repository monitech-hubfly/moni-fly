import { Suspense } from 'react';
import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import type { PainelKanbanTabsVariant } from '@/app/steps-viabilidade/PainelKanbanTabs';
import { KanbanBoardStreamFallback } from './KanbanBoardStreamFallback';
import { KanbanDatabaseBoardLoader } from './KanbanDatabaseBoardLoader';
import { KanbanPainelTabsShell } from './KanbanPainelTabsShell';
import type { CamposPorFaseMap, KanbanNomeDisplay } from './types';

export type KanbanDatabasePageConfig = {
  /** Nome exato na tabela `kanbans.nome`. */
  kanbanNomeDb: string;
  kanbanNomeDisplay: KanbanNomeDisplay;
  basePath: string;
  pageTitle: string;
  tabsVariant: PainelKanbanTabsVariant;
  columnAccent: string;
  /** Checklist / conteúdo por `fase_id` no `KanbanCardModal` (opcional por kanban). */
  camposPorFase?: CamposPorFaseMap;
  /** Quando true, oculta "+ Novo card" e `?novo=true` para frank/franqueado (só admin/team). */
  novoCardApenasStaff?: boolean;
};

function primeiroQuery(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export async function renderKanbanDatabasePage(
  searchParams: { [key: string]: string | string[] | undefined },
  config: KanbanDatabasePageConfig,
) {
  /** Com `?tab=painel` + `?card=` o RSC não montava o board; o modal fechava ao falhar o load. */
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

  return (
    <div className="min-h-0 min-w-0 bg-[var(--moni-surface-50)]">
      <Suspense fallback={null}>
        <KanbanPainelTabsShell basePath={config.basePath} variant={config.tabsVariant} />
      </Suspense>

      <Suspense fallback={<KanbanBoardStreamFallback columnAccent={config.columnAccent} />}>
        <KanbanDatabaseBoardLoader
          userId={user.id}
          config={config}
          activeTab={activeTab}
          modalCardAberto={modalCardAberto}
        />
      </Suspense>
    </div>
  );
}
