'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { RedeLoteadorDiagPatch } from '@/lib/rede-loteadores';

export async function salvarDiagnosticoLoteador(
  id: string,
  patch: RedeLoteadorDiagPatch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  // Registrar quem fez a avaliação
  let avaliado_por: string | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();
    avaliado_por = (profile as { full_name?: string | null; email?: string | null } | null)?.full_name
      || (profile as { full_name?: string | null; email?: string | null } | null)?.email
      || user.email
      || null;
  }

  const { error } = await supabase
    .from('rede_loteadores')
    .update({
      ...patch,
      diag_avaliado_por: avaliado_por,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/rede-franqueados');
  return { ok: true };
}
