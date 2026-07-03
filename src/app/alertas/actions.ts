'use server';

import { createClient } from '@/lib/supabase/server';
import { categorizarAlerta } from './categorizar';

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

export async function marcarTodosLido(categoriaAtiva: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  if (categoriaAtiva === 'todos') {
    const { error } = await supabase
      .from('alertas')
      .update({ lido: true })
      .eq('user_id', user.id)
      .eq('lido', false);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { data: naoLidos } = await supabase
    .from('alertas')
    .select('id, tipo')
    .eq('user_id', user.id)
    .eq('lido', false);

  const ids = (naoLidos ?? [])
    .filter(a => categorizarAlerta(String(a.tipo ?? '')) === categoriaAtiva)
    .map(a => a.id);

  if (!ids.length) return { ok: true };

  const { error } = await supabase.from('alertas').update({ lido: true }).in('id', ids);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
