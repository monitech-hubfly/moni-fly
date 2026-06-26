import type { SupabaseClient } from '@supabase/supabase-js';
import {
  aplicarDatasManuaisCalculadoraLinhas,
  type CalculadoraFaseLinha,
  type CalculadoraFasesInput,
} from '@/lib/kanban/calculadora-fases';
import { listarKanbanCardIdsSyncGroup } from '@/lib/kanban/card-sync-group';

export type CalculadoraFaseDataManual = {
  dataInicio?: string | null;
  dataFim?: string | null;
};

type CalculadoraFaseDataRow = {
  fase_id: string;
  data_inicio: string | null;
  data_fim: string | null;
};

type CalculadoraFaseDataRowSync = CalculadoraFaseDataRow & {
  card_id: string;
  editado_em: string | null;
};

function toYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const head = String(iso).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

/** Busca overrides manuais de datas por fase para um card. */
export async function buscarDatasManuaisCalculadoraPorFases(
  supabase: SupabaseClient,
  cardId: string,
  faseIds: string[],
): Promise<Map<string, CalculadoraFaseDataManual>> {
  const out = new Map<string, CalculadoraFaseDataManual>();
  const cid = String(cardId ?? '').trim();
  const fids = [...new Set(faseIds.map((f) => String(f ?? '').trim()).filter(Boolean))];
  if (!cid || fids.length === 0) return out;

  const { data, error } = await supabase
    .from('kanban_calculadora_fase_datas')
    .select('fase_id, data_inicio, data_fim')
    .eq('card_id', cid)
    .in('fase_id', fids);

  if (error) {
    console.error('[buscarDatasManuaisCalculadoraPorFases]', error.message);
    return out;
  }

  for (const row of (data ?? []) as CalculadoraFaseDataRow[]) {
    const faseId = String(row.fase_id ?? '').trim();
    if (!faseId) continue;
    const manual: CalculadoraFaseDataManual = {};
    const inicio = toYmd(row.data_inicio);
    const fim = toYmd(row.data_fim);
    if (inicio) manual.dataInicio = inicio;
    if (fim) manual.dataFim = fim;
    if (manual.dataInicio !== undefined || manual.dataFim !== undefined) {
      out.set(faseId, manual);
    }
  }

  return out;
}

function mergeOverridesPorEditadoEm(
  rows: CalculadoraFaseDataRowSync[],
  fids: string[],
): Map<string, CalculadoraFaseDataManual> {
  const out = new Map<string, CalculadoraFaseDataManual>();
  const faseSet = new Set(fids);

  const porFase = new Map<string, CalculadoraFaseDataRowSync[]>();
  for (const row of rows) {
    const faseId = String(row.fase_id ?? '').trim();
    if (!faseId || (fids.length > 0 && !faseSet.has(faseId))) continue;
    const list = porFase.get(faseId) ?? [];
    list.push(row);
    porFase.set(faseId, list);
  }

  for (const [faseId, list] of porFase) {
    const sorted = [...list].sort((a, b) => {
      const ta = a.editado_em ? new Date(a.editado_em).getTime() : 0;
      const tb = b.editado_em ? new Date(b.editado_em).getTime() : 0;
      return tb - ta;
    });
    const row = sorted[0];
    if (!row) continue;
    const manual: CalculadoraFaseDataManual = {};
    const inicio = toYmd(row.data_inicio);
    const fim = toYmd(row.data_fim);
    if (inicio) manual.dataInicio = inicio;
    if (fim) manual.dataFim = fim;
    if (manual.dataInicio !== undefined || manual.dataFim !== undefined) {
      out.set(faseId, manual);
    }
  }

  return out;
}

/** Busca overrides manuais mesclados de todos os cards kanban do grupo de sync. */
export async function buscarDatasManuaisCalculadoraSyncGroup(
  supabase: SupabaseClient,
  cardId: string,
  faseIds: string[],
): Promise<Map<string, CalculadoraFaseDataManual>> {
  const fids = [...new Set(faseIds.map((f) => String(f ?? '').trim()).filter(Boolean))];
  const kanbanCardIds = await listarKanbanCardIdsSyncGroup(supabase, cardId);
  if (kanbanCardIds.length === 0 || fids.length === 0) {
    return buscarDatasManuaisCalculadoraPorFases(supabase, cardId, faseIds);
  }

  const { data, error } = await supabase
    .from('kanban_calculadora_fase_datas')
    .select('card_id, fase_id, data_inicio, data_fim, editado_em')
    .in('card_id', kanbanCardIds)
    .in('fase_id', fids);

  if (error) {
    console.error('[buscarDatasManuaisCalculadoraSyncGroup]', error.message);
    return buscarDatasManuaisCalculadoraPorFases(supabase, cardId, faseIds);
  }

  return mergeOverridesPorEditadoEm((data ?? []) as CalculadoraFaseDataRowSync[], fids);
}

/** Upsert de override manual para uma fase (sem propagar para as demais). */
export async function salvarDataManualCalculadora(
  supabase: SupabaseClient,
  cardId: string,
  faseId: string,
  patch: { dataInicio?: string | null; dataFim?: string | null },
  userId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const cid = String(cardId ?? '').trim();
  const fid = String(faseId ?? '').trim();
  if (!cid || !fid) return { ok: false, error: 'Card ou fase inválidos.' };

  const payload: Record<string, unknown> = {
    card_id: cid,
    fase_id: fid,
    editado_em: new Date().toISOString(),
  };
  if (userId) payload.editado_por = userId;

  if ('dataInicio' in patch) {
    payload.data_inicio = patch.dataInicio ? toYmd(patch.dataInicio) : null;
  }
  if ('dataFim' in patch) {
    payload.data_fim = patch.dataFim ? toYmd(patch.dataFim) : null;
  }

  const { error } = await supabase
    .from('kanban_calculadora_fase_datas')
    .upsert(payload, { onConflict: 'card_id,fase_id' });

  if (error) {
    console.error('[salvarDataManualCalculadora]', error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Propaga override manual para todos os cards kanban do grupo de sync. */
export async function salvarDataManualCalculadoraSyncGroup(
  supabase: SupabaseClient,
  cardId: string,
  faseId: string,
  patch: { dataInicio?: string | null; dataFim?: string | null },
  userId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const kanbanCardIds = await listarKanbanCardIdsSyncGroup(supabase, cardId);
  if (kanbanCardIds.length === 0) {
    return salvarDataManualCalculadora(supabase, cardId, faseId, patch, userId);
  }

  const editadoEm = new Date().toISOString();
  for (const cid of kanbanCardIds) {
    const result = await salvarDataManualCalculadora(supabase, cid, faseId, patch, userId);
    if (!result.ok) return result;
    await supabase
      .from('kanban_calculadora_fase_datas')
      .update({ editado_em: editadoEm } as never)
      .eq('card_id', cid)
      .eq('fase_id', faseId);
  }

  return { ok: true };
}

/** Remove overrides manuais das fases indicadas (ex.: após editar Passagem para Wayser). */
export async function limparDatasManuaisCalculadoraPorFases(
  supabase: SupabaseClient,
  cardId: string,
  faseIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const cid = String(cardId ?? '').trim();
  const fids = [...new Set(faseIds.map((f) => String(f ?? '').trim()).filter(Boolean))];
  if (!cid || fids.length === 0) return { ok: true };

  const { error } = await supabase
    .from('kanban_calculadora_fase_datas')
    .delete()
    .eq('card_id', cid)
    .in('fase_id', fids);

  if (error) {
    console.error('[limparDatasManuaisCalculadoraPorFases]', error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Remove overrides manuais das fases em todos os cards kanban do grupo de sync. */
export async function limparDatasManuaisCalculadoraSyncGroup(
  supabase: SupabaseClient,
  cardId: string,
  faseIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const kanbanCardIds = await listarKanbanCardIdsSyncGroup(supabase, cardId);
  if (kanbanCardIds.length === 0) {
    return limparDatasManuaisCalculadoraPorFases(supabase, cardId, faseIds);
  }

  const fids = [...new Set(faseIds.map((f) => String(f ?? '').trim()).filter(Boolean))];
  if (fids.length === 0) return { ok: true };

  const { error } = await supabase
    .from('kanban_calculadora_fase_datas')
    .delete()
    .in('card_id', kanbanCardIds)
    .in('fase_id', fids);

  if (error) {
    console.error('[limparDatasManuaisCalculadoraSyncGroup]', error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Slug da fase que, ao ser editada manualmente, propaga recálculo para as posteriores. */
export const CALCULADORA_FASE_SLUG_PROPAGA_FORWARD = 'passagem_wayser';

/** Overlay por fase; Passagem para Wayser propaga recálculo forward. */
export function aplicarDatasManuaisCalculadora(
  linhas: CalculadoraFaseLinha[],
  overrides: Map<string, CalculadoraFaseDataManual>,
  card: CalculadoraFasesInput['card'],
  hoje?: Date,
): CalculadoraFaseLinha[] {
  return aplicarDatasManuaisCalculadoraLinhas(linhas, overrides, card, hoje);
}
