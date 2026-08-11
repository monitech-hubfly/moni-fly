import type { SupabaseClient } from '@supabase/supabase-js';
import type { RedeFranqueadoDbKey } from '@/lib/rede-franqueados';
import {
  patchLimparAnexosRedeFranqueado,
  REDE_SUBSTITUICAO_SNAPSHOT_VINCULOS_KEY,
  type RedeSubstituicaoSnapshotVinculos,
} from '@/lib/rede-franqueado-anexos-colunas';
import { isRedeStatusEmTransferencia } from '@/lib/rede-franqueado-form-options';

export type RedeSubstituicaoRow = {
  id: string;
  rede_franqueado_id: string;
  snapshot: Record<string, unknown>;
  processo_step_one_id: string | null;
  substituido_em: string;
  substituido_por: string | null;
  nome_anterior: string | null;
  n_franquia_anterior: string | null;
};

export function isRedeFranqueadoEmTransferencia(status: string | null | undefined): boolean {
  return isRedeStatusEmTransferencia(status);
}

/** Arquiva vínculos operacionais do franqueado anterior e grava snapshot. */
export async function arquivarHistoricoSubstituicao(
  supabase: SupabaseClient,
  redeId: string,
  substituidoPor: string | null,
): Promise<{ ok: true; substituicaoId: string } | { ok: false; error: string }> {
  const { data: row, error: errRow } = await supabase.from('rede_franqueados').select('*').eq('id', redeId).maybeSingle();
  if (errRow) return { ok: false, error: errRow.message };
  if (!row) return { ok: false, error: 'Franqueado não encontrado.' };

  const status = (row as { status_franquia?: string | null }).status_franquia;
  if (!isRedeFranqueadoEmTransferencia(status)) {
    return { ok: false, error: 'Só é possível substituir franqueados com status Em Transferência.' };
  }

  const [{ data: spes }, { data: empresas }] = await Promise.all([
    supabase.from('franqueado_spe').select('*').eq('rede_franqueado_id', redeId),
    supabase.from('franqueado_empresas').select('*').eq('rede_franqueado_id', redeId),
  ]);

  const vinculos: RedeSubstituicaoSnapshotVinculos = {
    franqueado_spe: (spes ?? []) as Record<string, unknown>[],
    franqueado_empresas: (empresas ?? []) as Record<string, unknown>[],
  };

  const snapshot: Record<string, unknown> = {
    ...(row as Record<string, unknown>),
    [REDE_SUBSTITUICAO_SNAPSHOT_VINCULOS_KEY]: vinculos,
  };
  const processoId = (row as { processo_id?: string | null }).processo_id ?? null;
  const nomeAnterior = String((row as { nome_completo?: string | null }).nome_completo ?? '').trim() || null;
  const nAnterior = String((row as { n_franquia?: string | null }).n_franquia ?? '').trim() || null;

  const { data: sub, error: errSub } = await supabase
    .from('rede_franqueado_substituicoes')
    .insert({
      rede_franqueado_id: redeId,
      snapshot,
      processo_step_one_id: processoId,
      substituido_por: substituidoPor,
      nome_anterior: nomeAnterior,
      n_franquia_anterior: nAnterior,
    })
    .select('id')
    .single();

  if (errSub || !sub?.id) {
    return { ok: false, error: errSub?.message ?? 'Erro ao registrar histórico de substituição.' };
  }

  const substituicaoId = String(sub.id);

  await supabase
    .from('kanban_cards')
    .update({ rede_substituicao_id: substituicaoId })
    .eq('rede_franqueado_id', redeId)
    .is('rede_substituicao_id', null);

  if (processoId) {
    await supabase.from('rede_franqueados').update({ processo_id: null }).eq('id', redeId);
  }

  if (vinculos.franqueado_spe.length) {
    await supabase.from('franqueado_spe').delete().eq('rede_franqueado_id', redeId);
  }
  if (vinculos.franqueado_empresas.length) {
    await supabase.from('franqueado_empresas').delete().eq('rede_franqueado_id', redeId);
  }

  return { ok: true, substituicaoId };
}

/** Monta patch de atualização preservando n_franquia e ordem da linha em transferência. */
export function buildPatchSubstituicao(
  targetRow: Record<string, unknown>,
  input: Partial<Record<RedeFranqueadoDbKey, string | null>>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    ...patchLimparAnexosRedeFranqueado(),
    updated_at: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(input)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    patch[k] = s;
  }
  patch.n_franquia = (targetRow.n_franquia as string | null) ?? patch.n_franquia;
  patch.ordem = targetRow.ordem;
  patch.status_franquia = 'Em Operação';
  return patch;
}
