'use server';

import { verifyProcessoCasasAccess } from '@/lib/zap-save-casas';

export type PracaDadosCidadeChecklistData =
  | { ok: true; processoId: string; cidade: string; estado: string | null }
  | { ok: false; error: string };

export async function carregarPracaDadosCidadeChecklist(
  processoId: string,
): Promise<PracaDadosCidadeChecklistData> {
  const pid = String(processoId ?? '').trim();
  if (!pid) return { ok: false, error: 'Processo Step One não vinculado.' };

  const access = await verifyProcessoCasasAccess(pid);
  if (!access.ok) return { ok: false, error: access.error };

  const { data: processo, error: errProc } = await access.supabase
    .from('processo_step_one')
    .select('id, cidade, estado')
    .eq('id', pid)
    .maybeSingle();

  if (errProc) return { ok: false, error: errProc.message };
  if (!processo) return { ok: false, error: 'Processo não encontrado.' };

  const p = processo as { id: string; cidade: string | null; estado: string | null };

  return {
    ok: true,
    processoId: p.id,
    cidade: p.cidade ?? '',
    estado: p.estado ?? null,
  };
}
