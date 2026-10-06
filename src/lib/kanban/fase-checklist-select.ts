import type { SupabaseClient } from '@supabase/supabase-js';
import type { FaseChecklistItem } from '@/lib/actions/candidato-actions';

export const FASE_CHECKLIST_ITEM_COLS_FULL =
  'id, fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, template_storage_path, placeholder, campo_slug, config_json, chave_compartilhada, grupo_exclusivo';

export const FASE_CHECKLIST_ITEM_COLS_BASE =
  'id, fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, template_storage_path, placeholder';

function isMissingChecklistMetaColumnError(message: string | undefined): boolean {
  return Boolean(message && /does not exist/i.test(message));
}

const JURIDICO_ANALISE_INICIAL_FORA_DO_FLUXO = new Set([
  'juridico_documento_correto',
  'juridico_partes_identificadas',
  'juridico_minuta_identificada',
  'juridico_tipo_contrato_confirmado',
]);

/** Retroalimentação antiga da Pós-Assinatura. O item e as respostas ficam no banco. */
export const CHECKLIST_JURIDICO_POS_ASSINATURA_LEGADO = new Set([
  'juridico_retroalimentar_checklist',
  'juridico_pontos_retroalimentar',
  'juridico_template_atualizado',
  'juridico_faq_atualizada',
]);

function itemJuridicoForaDoFluxo(row: Record<string, unknown>): boolean {
  const slug = String(row.campo_slug ?? '').trim();
  if (!JURIDICO_ANALISE_INICIAL_FORA_DO_FLUXO.has(slug)) return false;
  const cfg = row.config_json;
  if (!cfg || typeof cfg !== 'object') return false;
  return (cfg as { oculto_ui?: unknown }).oculto_ui === true;
}

function itemJuridicoPosAssinaturaLegado(row: Record<string, unknown>): boolean {
  return CHECKLIST_JURIDICO_POS_ASSINATURA_LEGADO.has(String(row.campo_slug ?? '').trim());
}

function normalizeChecklistItemRows(rows: Record<string, unknown>[]): FaseChecklistItem[] {
  return rows
    .filter((row) => !itemJuridicoForaDoFluxo(row) && !itemJuridicoPosAssinaturaLegado(row))
    .map((row) => ({
    ...(row as FaseChecklistItem),
    campo_slug: (row.campo_slug as string | null | undefined) ?? null,
    config_json: (row.config_json as Record<string, unknown> | null | undefined) ?? {},
    chave_compartilhada: (row.chave_compartilhada as string | null | undefined) ?? null,
    grupo_exclusivo: (row.grupo_exclusivo as string | null | undefined) ?? null,
  }));
}

/** Carrega itens de checklist da fase; fallback sem meta colunas (DEV sem migration 340). */
export async function fetchFaseChecklistItens(
  supabase: SupabaseClient,
  faseId: string,
): Promise<{ data: FaseChecklistItem[]; error: string | null }> {
  const fid = faseId.trim();
  if (!fid) return { data: [], error: 'Fase inválida.' };

  const full = await supabase
    .from('kanban_fase_checklist_itens')
    .select(FASE_CHECKLIST_ITEM_COLS_FULL)
    .eq('fase_id', fid)
    .order('ordem', { ascending: true });

  if (!full.error) {
    return { data: normalizeChecklistItemRows((full.data ?? []) as Record<string, unknown>[]), error: null };
  }

  if (!isMissingChecklistMetaColumnError(full.error.message)) {
    return { data: [], error: full.error.message };
  }

  const base = await supabase
    .from('kanban_fase_checklist_itens')
    .select(FASE_CHECKLIST_ITEM_COLS_BASE)
    .eq('fase_id', fid)
    .order('ordem', { ascending: true });

  if (base.error) return { data: [], error: base.error.message };
  return {
    data: normalizeChecklistItemRows((base.data ?? []) as Record<string, unknown>[]),
    error: null,
  };
}

export async function fetchFaseChecklistItensIn(
  supabase: SupabaseClient,
  faseIds: string[],
): Promise<{ data: FaseChecklistItem[]; error: string | null }> {
  const ids = [...new Set(faseIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return { data: [], error: null };

  const full = await supabase
    .from('kanban_fase_checklist_itens')
    .select(FASE_CHECKLIST_ITEM_COLS_FULL)
    .in('fase_id', ids)
    .order('ordem', { ascending: true });

  if (!full.error) {
    return { data: normalizeChecklistItemRows((full.data ?? []) as Record<string, unknown>[]), error: null };
  }

  if (!isMissingChecklistMetaColumnError(full.error.message)) {
    return { data: [], error: full.error.message };
  }

  const base = await supabase
    .from('kanban_fase_checklist_itens')
    .select(FASE_CHECKLIST_ITEM_COLS_BASE)
    .in('fase_id', ids)
    .order('ordem', { ascending: true });

  if (base.error) return { data: [], error: base.error.message };
  return {
    data: normalizeChecklistItemRows((base.data ?? []) as Record<string, unknown>[]),
    error: null,
  };
}
