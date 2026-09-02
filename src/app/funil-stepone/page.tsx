import { guardLoginRequired } from '@/lib/auth-guard';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { KanbanStepOneBoardLoader } from '@/components/kanban-shared/KanbanStepOneBoardLoader';
import { KanbanTabs } from './KanbanTabs';

export const dynamic = 'force-dynamic';

function primeiroQuery(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function FunilStepOnePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const activeTab = primeiroQuery(searchParams.tab) || 'kanban';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  return (
    <div className="min-h-0 bg-[var(--moni-surface-50)]">
      <Suspense fallback={null}>
        <KanbanTabs />
      </Suspense>

      <KanbanStepOneBoardLoader userId={user.id} activeTab={activeTab} />
    </div>
  );
}
