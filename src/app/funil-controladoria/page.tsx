/**
 * Funil Controladoria — Hub Fly / ADM.
 * Dois kanbans independentes (Rotina Contábil + Rotina Fiscal) + aba de Configuração.
 * Acesso: admin ou team (cargo adm).
 * Navegação entre abas via ?aba= (default: contabil).
 */
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { guardLoginRequired } from '@/lib/auth-guard';
import { normalizeAccessRole } from '@/lib/authz';
import { fetchKanbanBoardShell } from '@/components/kanban-shared/fetchKanbanBoardSnapshot';
import { KanbanBoardSkeleton } from '@/components/kanban-shared/KanbanBoardSkeleton';
import { KanbanDatabaseBoardCardsLoader } from '@/components/kanban-shared/KanbanDatabaseBoardCardsLoader';
import { KanbanWrapper } from '@/components/kanban-shared/KanbanWrapper';
import { KanbanNotFound } from '@/components/kanban-shared/KanbanNotFound';
import { ControladoriaTabsNav } from './ControladoriaTabsNav';
import { ConfiguracaoTabClient } from './ConfiguracaoTabClient';
import type { ControladoriaAba } from './ControladoriaTabsNav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Controladoria | Hub Fly',
};

const KANBAN_CONTABIL = 'Funil Controladoria — Rotina Contábil';
const KANBAN_FISCAL   = 'Funil Controladoria — Rotina Fiscal';
const COLUMN_ACCENT   = '#2d3d4a';

function resolveAba(raw: string | string[] | undefined): ControladoriaAba {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'fiscal' || v === 'config') return v;
  return 'contabil';
}

export default async function FunilControladoriaPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = normalizeAccessRole((profile as { role?: string | null } | null)?.role);
  if (role !== 'admin' && role !== 'team') {
    redirect('/hub-funis');
  }

  const isAdmin = role === 'admin' || role === 'team';
  const aba = resolveAba(searchParams.aba);

  // ─── Aba Configuração ────────────────────────────────────────────────────────
  if (aba === 'config') {
    const [{ data: entidades }, { data: profilesRaw }] = await Promise.all([
      supabase
        .from('controladoria_entidades_cfg')
        .select('id, nome, subtipo, tipo, ativo')
        .order('tipo')
        .order('nome'),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .ilike('email', '%@moni.casa')
        .order('full_name'),
    ]);

    // Deduplica por email
    const emailsVistos = new Set<string>();
    const profilesFiscal: { id: string; nome: string; email: string }[] = [];
    for (const p of profilesRaw ?? []) {
      const email = ((p.email as string | null) ?? '').toLowerCase().trim();
      if (!email || emailsVistos.has(email)) continue;
      emailsVistos.add(email);
      profilesFiscal.push({
        id: p.id as string,
        nome: ((p.full_name as string | null) ?? email),
        email,
      });
    }

    return (
      <div className="min-h-0 min-w-0 bg-[var(--moni-surface-50)]">
        <Suspense fallback={null}>
          <ControladoriaTabsNav aba={aba} />
        </Suspense>
        <ConfiguracaoTabClient
          entidades={entidades ?? []}
          profilesFiscal={profilesFiscal}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  // ─── Abas Contábil / Fiscal (kanban board) ───────────────────────────────────
  const kanbanNomeDb =
    aba === 'fiscal' ? KANBAN_FISCAL : KANBAN_CONTABIL;

  const shell = await fetchKanbanBoardShell(supabase, kanbanNomeDb, user.id);

  if (!shell.kanban) {
    return (
      <div className="min-h-0 min-w-0 bg-[var(--moni-surface-50)]">
        <Suspense fallback={null}>
          <ControladoriaTabsNav aba={aba} />
        </Suspense>
        <KanbanNotFound kanbanNomeDb={kanbanNomeDb} />
      </div>
    );
  }

  const modalCardAberto = Boolean(
    (Array.isArray(searchParams.card) ? searchParams.card[0] : searchParams.card) ||
    (Array.isArray(searchParams.kanbanCard) ? searchParams.kanbanCard[0] : searchParams.kanbanCard),
  );
  const activeTab =
    (Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab) === 'painel' &&
    !modalCardAberto
      ? 'painel'
      : 'kanban';

  const config = {
    kanbanNomeDb,
    kanbanNomeDisplay: aba === 'fiscal' ? 'Funil Controladoria — Rotina Fiscal' as const : 'Funil Controladoria — Rotina Contábil' as const,
    basePath: '/funil-controladoria',
    pageTitle: `Controladoria — ${aba === 'fiscal' ? 'Rotina Fiscal' : 'Rotina Contábil'}`,
    tabsVariant: 'controladoria' as const,
    columnAccent: COLUMN_ACCENT,
    novoCardApenasStaff: true,
  };

  return (
    <div className="min-h-0 min-w-0 bg-[var(--moni-surface-50)]">
      <Suspense fallback={null}>
        <ControladoriaTabsNav aba={aba} />
      </Suspense>

      <KanbanWrapper
        basePath="/funil-controladoria"
        isAdmin={isAdmin}
        kanbanId={shell.kanban.id}
        kanbanNome={config.kanbanNomeDisplay}
        fases={shell.fases}
        enableNovoCardModal={isAdmin}
      >
        <Suspense fallback={<KanbanBoardSkeleton />}>
          <KanbanDatabaseBoardCardsLoader
            userId={user.id}
            config={config}
            activeTab={activeTab}
            kanbanId={shell.kanban.id}
            fases={shell.fases}
            isAdmin={isAdmin}
            role={role}
          />
        </Suspense>
      </KanbanWrapper>
    </div>
  );
}
