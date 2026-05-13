import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cargoParaMatrizPermissoes,
  mapPermissoesParaPode,
  permissoesLinhasParaMap,
  roleParaMatrizPermissoes,
  type PermissoesPode,
} from '@/lib/permissoes-types';

/** Mapa cru `permissao -> valor` (útil no client com `useCallback` estável). */
export async function carregarPermissoesMap(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, boolean>> {
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('role, cargo')
    .eq('id', userId)
    .maybeSingle();
  if (pErr || !profile) return new Map();

  const roleKey = roleParaMatrizPermissoes((profile as { role?: string | null }).role);
  const cargo = cargoParaMatrizPermissoes((profile as { cargo?: string | null }).cargo);

  const { data: rows, error: rErr } = await supabase
    .from('permissoes_perfil')
    .select('permissao, valor')
    .eq('role', roleKey)
    .eq('cargo', cargo);

  if (rErr) return new Map();
  return permissoesLinhasParaMap(rows);
}

/** Lê `profiles` + `permissoes_perfil` e monta `{ pode }`. */
export async function carregarPermissoesUsuario(
  supabase: SupabaseClient,
  userId: string,
): Promise<PermissoesPode> {
  const map = await carregarPermissoesMap(supabase, userId);
  return mapPermissoesParaPode(map);
}
