import type { SupabaseClient } from '@supabase/supabase-js';
import type { FaseChecklistItem } from '@/lib/actions/candidato-actions';

export const FASE_CHECKLIST_ITEM_COLS_FULL =
  'id, fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, template_storage_path, placeholder, campo_slug, config_json, chave_compartilhada, grupo_exclusivo';

export const FASE_CHECKLIST_ITEM_COLS_BASE =
  'id, fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, template_storage_path, placeholder';

function isMissingChecklistMetaColumnError(message: string | undefined): boolean {
  return Boolean(message && /does not exist/i.test(message));
}

function normalizeChecklistItemRows(rows: Record<string, unknown>[]): FaseChecklistItem[] {
  return rows.map((row) => ({
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
