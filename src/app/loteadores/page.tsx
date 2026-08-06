import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { KanbanLoteadoresBoardLoader } from '@/components/kanban-shared/KanbanLoteadoresBoardLoader';

export const dynamic = 'force-dynamic';

function primeiroQuery(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function LoteadoresKanbanPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
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
      <KanbanLoteadoresBoardLoader userId={user.id} activeTab={activeTab} />
    </div>
  );
}
