import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export async function getLoggedUserDisplayName(
  supabase: SupabaseClient,
  user: User,
): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const fromProfile = (profile as { full_name?: string | null } | null)?.full_name?.trim();
  if (fromProfile) return fromProfile;
  return user.email?.split('@')[0]?.trim() || 'Usuário';
}

export async function resolveResponsavelNomeFromArea(
  supabase: SupabaseClient,
  areaId: string | null,
  user: User,
): Promise<{ responsavel_id: string | null; responsavel_nome: string | null }> {
  const displayName = await getLoggedUserDisplayName(supabase, user);
  if (!areaId) {
    return { responsavel_id: null, responsavel_nome: displayName };
  }

  const { data: pessoas } = await supabase
    .from('area_pessoas')
    .select('id, nome')
    .eq('area_id', areaId)
    .eq('ativo', true);

  const lista = (pessoas ?? []) as { id: string; nome: string }[];
  const meNorm = displayName.toLocaleLowerCase('pt-BR');
  const match = lista.find(
    (p) => p.nome.trim().toLocaleLowerCase('pt-BR') === meNorm,
  );

  if (match) {
    return { responsavel_id: match.id, responsavel_nome: match.nome };
  }

  return { responsavel_id: null, responsavel_nome: displayName };
}
