'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';

export type AtualizarSlaFaseResult = { ok: true } | { ok: false; error: string };

async function assertAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (normalizeAccessRole((me as { role?: string } | null)?.role) !== 'admin') {
    return { ok: false, error: 'Apenas administradores podem alterar o SLA das fases.' };
  }
  return { ok: true };
}

/**
 * Atualiza `sla_dias` da fase via RPC (validação 1–365 no banco).
 */
export async function atualizarSlaFase(faseId: string, slaDias: number): Promise<AtualizarSlaFaseResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const id = String(faseId ?? '').trim();
  if (!id) return { ok: false, error: 'Fase inválida.' };

  const n = Number(slaDias);
  if (!Number.isFinite(n) || n < 1 || n > 365) {
    return { ok: false, error: 'SLA deve ser um número entre 1 e 365.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('fn_atualizar_sla_fase', {
    p_fase_id: id,
    p_sla_dias: Math.trunc(n),
  } as never);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/sla');
  return { ok: true };
}

/** Form action: campos `fase_id` (hidden) e `sla_dias` (number). */
export async function salvarSlaFaseFormAction(formData: FormData): Promise<void> {
  const faseId = String(formData.get('fase_id') ?? '').trim();
  const raw = formData.get('sla_dias');
  const slaDias = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  const r = await atualizarSlaFase(faseId, slaDias);
  if (!r.ok) {
    redirect(`/admin/sla?err=${encodeURIComponent(r.error)}`);
  }
  redirect('/admin/sla?saved=1');
}
