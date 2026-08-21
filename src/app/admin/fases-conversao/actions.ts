'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';

export type AtualizarFaseConversaoResult = { ok: true } | { ok: false; error: string };

async function assertAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (normalizeAccessRole((me as { role?: string } | null)?.role) !== 'admin') {
    return { ok: false, error: 'Apenas administradores podem marcar fases de conversão.' };
  }
  return { ok: true };
}

export async function atualizarFaseConversao(
  faseId: string,
  faseConversao: boolean,
): Promise<AtualizarFaseConversaoResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const id = String(faseId ?? '').trim();
  if (!id) return { ok: false, error: 'Fase inválida.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('kanban_fases')
    .update({ fase_conversao: Boolean(faseConversao) } as never)
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/fases-conversao');
  return { ok: true };
}

/** Form action: campos `fase_id` (hidden) e `fase_conversao` (checkbox, on/off). */
export async function salvarFaseConversaoFormAction(formData: FormData): Promise<void> {
  const faseId = String(formData.get('fase_id') ?? '').trim();
  const marcada = formData.get('fase_conversao') === 'on';
  const r = await atualizarFaseConversao(faseId, marcada);
  if (!r.ok) {
    redirect(`/admin/fases-conversao?err=${encodeURIComponent(r.error)}`);
  }
  redirect('/admin/fases-conversao?saved=1');
}
