/**
 * Kanban **Funil Jurídico** (`kanbans.nome`): nativo (`kanban_cards`).
 * Acesso: team e admin (Frank bloqueado pelo middleware / portal).
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { renderKanbanDatabasePage } from '@/components/kanban-shared/renderKanbanDatabasePage';
import { guardLoginRequired } from '@/lib/auth-guard';
import { normalizeAccessRole } from '@/lib/authz';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Funil Jurídico | Hub Fly',
};

export default async function FunilJuridicoPage({
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

  return renderKanbanDatabasePage(searchParams, {
    kanbanNomeDb: 'Funil Jurídico',
    kanbanNomeDisplay: 'Funil Jurídico',
    basePath: '/funil-juridico',
    pageTitle: 'Kanban Funil Jurídico',
    tabsVariant: 'juridico',
    /** Accent do funil (sem prop `corHex` em renderKanbanDatabasePage). */
    columnAccent: '#1E3A5F',
    novoCardApenasStaff: true,
  });
}
