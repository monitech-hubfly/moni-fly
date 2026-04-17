import { createClient } from '@/lib/supabase/server';
import { carregarPermissoesUsuario } from '@/lib/permissoes-load';
import type { Permissao, PermissoesPode } from '@/lib/permissoes-types';

export type { Permissao, PermissoesPode };

export async function getPermissoes(userId: string): Promise<PermissoesPode> {
  const supabase = await createClient();
  return carregarPermissoesUsuario(supabase, userId);
}
