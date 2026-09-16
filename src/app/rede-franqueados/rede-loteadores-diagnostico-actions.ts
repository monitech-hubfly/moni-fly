'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { RedeLoteadorDiagPatch } from '@/lib/rede-loteadores';

export async function salvarDiagnosticoLoteador(
  id: string,
  patch: RedeLoteadorDiagPatch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('rede_loteadores')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/rede-franqueados');
  return { ok: true };
}
