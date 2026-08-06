import { Suspense } from 'react';
import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import type { PainelKanbanTabsVariant } from '@/app/steps-viabilidade/PainelKanbanTabs';
import { KanbanDatabaseBoardCardsLoader } from './KanbanDatabaseBoardCardsLoader';
import { KanbanNotFound } from './KanbanNotFound';
import { KanbanPainelTabsShell } from './KanbanPainelTabsShell';
import { KanbanWrapper } from './KanbanWrapper';
import { fetchKanbanBoardShell } from './fetchKanbanBoardSnapshot';
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

  const shell = await fetchKanbanBoardShell(supabase, config.kanbanNomeDb, user.id);
  if (!shell.kanban) {
    return (
      <div className="min-h-0 min-w-0 bg-[var(--moni-surface-50)]">
        <KanbanNotFound kanbanNomeDb={config.kanbanNomeDb} />
      </div>
    );
  }

  const exibirNovoCard = config.novoCardApenasStaff ? shell.isAdmin : true;

  return (
    <div className="min-h-0 min-w-0 bg-[var(--moni-surface-50)]">
      <Suspense fallback={null}>
        <KanbanPainelTabsShell basePath={config.basePath} variant={config.tabsVariant} />
      </Suspense>

      {/*
        Wrapper + modais FORA do Suspense dos cards: `router.refresh()` só remonta o board,
        sem fechar/reabrir pop-ups (?card= / ?novo=).
      */}
      <KanbanWrapper
        basePath={config.basePath}
        isAdmin={shell.isAdmin}
        kanbanId={shell.kanban.id}
        kanbanNome={config.kanbanNomeDisplay}
        fases={shell.fases}
        camposPorFase={config.camposPorFase}
        enableNovoCardModal={exibirNovoCard}
      >
        <Suspense fallback={null}>
          <KanbanDatabaseBoardCardsLoader
            userId={user.id}
            config={config}
            activeTab={activeTab}
            kanbanId={shell.kanban.id}
            fases={shell.fases}
            isAdmin={shell.isAdmin}
            role={shell.role}
          />
        </Suspense>
      </KanbanWrapper>
    </div>
  );
}
