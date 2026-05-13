'use server';

import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function marcarAlertaLido(alertaId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { error } = await supabase
    .from('alertas')
    .update({ lido: true })
    .eq('id', alertaId)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
