import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

async function resolveAutorNomePainel(
  supabase: SupabaseClient,
  userId: string,
  fallbackEmail?: string,
): Promise<string> {
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
  const nome = (profile?.full_name as string | null | undefined)?.trim();
  if (nome) return nome;
  const fallback = fallbackEmail?.split('@')?.[0]?.trim();
  return fallback || 'Usuário';
}

export type PainelDbAuthOk = {
  ok: true;
  supabase: SupabaseClient;
  user: User;
  userId: string;
  autorNome: string;
  isServiceRole: false;
};

export type PainelDbAuth = PainelDbAuthOk | { ok: false; error: string };

/** Cliente Supabase + utilizador autenticado (RLS). */
export async function getPainelDbForPublicEdit(): Promise<PainelDbAuth> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Faça login.' };
  }
  const autorNome = await resolveAutorNomePainel(supabase, user.id, user.email ?? undefined);
  return { ok: true, supabase, user, userId: user.id, autorNome, isServiceRole: false };
}
