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

export type SincronizarPracaResult = { ok: true } | { ok: false; error: string };

/** Atualiza cidade/UF do processo a partir do checklist Dados da Cidade (IBGE + mapa). */
export async function sincronizarPracaChecklistComProcesso(input: {
  processoId: string;
  cidade: string;
  estado: string;
}): Promise<SincronizarPracaResult> {
  const pid = String(input.processoId ?? '').trim();
  const cidade = String(input.cidade ?? '').trim();
  const estado = String(input.estado ?? '').trim().toUpperCase().slice(0, 2);
  if (!pid) return { ok: false, error: 'Processo Step One não vinculado.' };
  if (!cidade || estado.length !== 2) return { ok: false, error: 'Cidade e estado inválidos.' };

  const access = await verifyProcessoCasasAccess(pid);
  if (!access.ok) return { ok: false, error: access.error };

  const { error } = await access.supabase
    .from('processo_step_one')
    .update({ cidade, estado, updated_at: new Date().toISOString() })
    .eq('id', pid);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
