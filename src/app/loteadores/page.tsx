import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient, createClientWithAccessToken } from '@/lib/supabase/server';
import { KanbanLoteadoresBoardLoader } from '@/components/kanban-shared/KanbanLoteadoresBoardLoader';
import { fetchKanbanBoardShell } from '@/components/kanban-shared/fetchKanbanBoardSnapshot';
import { KANBAN_NOME_FUNIL_LOTEADORES } from '@/lib/kanban/funil-loteadores';
import { estadoModalDePageSearchParams } from '@/lib/kanban/kanban-url-modal-state';
import { KanbanNotFound } from '@/components/kanban-shared/KanbanNotFound';

export const dynamic = 'force-dynamic';

export default async function LoteadoresKanbanPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const initialUrlState = estadoModalDePageSearchParams(searchParams);
  const tabParam = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;
  const activeTab =
    tabParam === 'painel' && !initialUrlState.cardId ? 'painel' : 'kanban';

  const cookieClient = await createClient();
  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  guardLoginRequired(user);

  const {
    data: { session },
  } = await cookieClient.auth.getSession();
  const accessToken = session?.access_token ?? null;
  const supabase = accessToken ? createClientWithAccessToken(accessToken) : cookieClient;

  const shell = await fetchKanbanBoardShell(supabase, KANBAN_NOME_FUNIL_LOTEADORES, user.id);

  if (!shell.kanban) {
    return (
      <div className="min-h-0 min-w-0 bg-[var(--moni-surface-50)]">
        <KanbanNotFound kanbanNomeDb={KANBAN_NOME_FUNIL_LOTEADORES} />
      </div>
    );
  }

  return (
    <div className="min-h-0 min-w-0 bg-[var(--moni-surface-50)]">
      <KanbanLoteadoresBoardLoader
        userId={user.id}
        activeTab={activeTab}
        kanbanId={shell.kanban.id}
        fases={shell.fases}
        role={shell.role}
        isAdmin={shell.isAdmin}
        accessToken={accessToken}
        initialUrlState={initialUrlState}
      />
    </div>
  );
}
