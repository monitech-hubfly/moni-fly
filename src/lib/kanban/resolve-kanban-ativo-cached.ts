import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { KANBAN_ID_BY_NOME } from '@/lib/constants/kanban-ids';
import { tryCreateAdminClient } from '@/lib/supabase/admin';

async function resolveKanbanIdViaAdmin(kanbanNomeDb: string): Promise<string | null> {
  const admin = tryCreateAdminClient();
  if (!admin) return null;

  const canonicalId = KANBAN_ID_BY_NOME[kanbanNomeDb];
  if (canonicalId) {
    const { data } = await admin
      .from('kanbans')
      .select('id')
      .eq('id', canonicalId)
      .eq('ativo', true)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  const { data: kanbans } = await admin
    .from('kanbans')
    .select('id')
    .eq('nome', kanbanNomeDb)
    .eq('ativo', true)
    .limit(1);

  const row = kanbans?.[0];
  return row?.id ? String(row.id) : null;
}

const kanbanAtivoCacheByNome = new Map<string, Promise<string | null>>();

async function resolveKanbanAtivoDirect(
  supabase: SupabaseClient,
  kanbanNomeDb: string,
): Promise<{ id: string } | null> {
  const canonicalId = KANBAN_ID_BY_NOME[kanbanNomeDb];
  if (canonicalId) {
    const { data } = await supabase
      .from('kanbans')
      .select('id')
      .eq('id', canonicalId)
      .eq('ativo', true)
      .maybeSingle();
    if (data?.id) return { id: String(data.id) };
  }

  const { data: kanbans } = await supabase
    .from('kanbans')
    .select('id')
    .eq('nome', kanbanNomeDb)
    .eq('ativo', true)
    .limit(1);

  const row = kanbans?.[0];
  return row?.id ? { id: String(row.id) } : null;
}

/** Metadados do kanban — cache 5 min (sem cookies); fallback: client do caller com RLS. */
export async function resolveKanbanAtivoCached(
  supabase: SupabaseClient,
  kanbanNomeDb: string,
): Promise<{ id: string } | null> {
  const nome = String(kanbanNomeDb ?? '').trim();
  if (!nome) return null;

  let cachedPromise = kanbanAtivoCacheByNome.get(nome);
  if (!cachedPromise) {
    cachedPromise = unstable_cache(
      () => resolveKanbanIdViaAdmin(nome),
      ['kanban-ativo-id', nome],
      { revalidate: 300, tags: [`kanban-ativo-${nome}`] },
    )();
    kanbanAtivoCacheByNome.set(nome, cachedPromise);
  }

  const cachedId = await cachedPromise;
  if (cachedId) return { id: cachedId };
  return resolveKanbanAtivoDirect(supabase, nome);
}
