import Link from 'next/link';
import { Suspense } from 'react';
import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import type { PainelKanbanTabsVariant } from '@/app/steps-viabilidade/PainelKanbanTabs';
import { KanbanBoard } from './KanbanBoard';
import { KanbanWrapper } from './KanbanWrapper';
import { KanbanPainelTabsShell } from './KanbanPainelTabsShell';
import { fetchKanbanBoardSnapshot } from './fetchKanbanBoardSnapshot';
import { PainelPerformance } from './PainelPerformance';
import type { CamposPorFaseMap, KanbanNomeDisplay } from './types';

export type KanbanDatabasePageConfig = {
  /** Nome exato na tabela `kanbans.nome`. */
  kanbanNomeDb: string;
  kanbanNomeDisplay: KanbanNomeDisplay;
  basePath: string;
  pageTitle: string;
  legacyPanelHref: string;
  tabsVariant: PainelKanbanTabsVariant;
  columnAccent: string;
  /** Checklist / conteúdo por `fase_id` no `KanbanCardModal` (opcional por kanban). */
  camposPorFase?: CamposPorFaseMap;
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

  const { kanban, fases, cards, role, isAdmin } = await fetchKanbanBoardSnapshot(
    supabase,
    config.kanbanNomeDb,
    user.id,
  );

  if (!kanban) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--moni-surface-50)]">
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
      legacyPanelHref={config.legacyPanelHref}
      camposPorFase={config.camposPorFase}
      enableNovoCardModal
    >
      <div className="min-h-screen bg-[var(--moni-surface-50)]">
        <header
          className="border-b bg-white"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-moni-primary hover:underline">
                ← Hub Fly
              </Link>
              <span className="text-stone-400">/</span>
              <h1 className="text-lg font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                {config.pageTitle}
              </h1>
            </div>
            <Link
              href={`${config.basePath}?novo=true`}
              className="rounded-lg px-4 py-2 text-sm font-medium transition hover:bg-stone-100"
              style={{
                background: 'var(--moni-surface-0)',
                color: 'var(--moni-text-primary)',
                border: '0.5px solid var(--moni-border-default)',
              }}
            >
              + Novo card
            </Link>
          </div>
        </header>

        <Suspense fallback={null}>
          <KanbanPainelTabsShell basePath={config.basePath} variant={config.tabsVariant} />
        </Suspense>

        {activeTab === 'kanban' ? (
          <main className="mx-auto max-w-[1600px] overflow-x-auto px-6 py-8">
            <KanbanBoard
              fases={fases ?? []}
              cards={cards}
              basePath={config.basePath}
              userRole={role}
              columnAccent={config.columnAccent}
            />
          </main>
        ) : (
          <main className="mx-auto max-w-[1600px] px-6 py-8">
            <PainelPerformance
              kanbanNome={config.kanbanNomeDisplay}
              kanbanId={kanban.id}
              fases={fases ?? []}
              cards={cards}
              origemCards={cards.some((c) => c.origem === 'legado') ? 'legado' : 'nativo'}
            />
          </main>
        )}
      </div>
    </KanbanWrapper>
  );
}
