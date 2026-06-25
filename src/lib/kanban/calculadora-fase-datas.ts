import type { SupabaseClient } from '@supabase/supabase-js';
import {
  aplicarDatasManuaisCalculadoraLinhas,
  type CalculadoraFaseLinha,
  type CalculadoraFasesInput,
} from '@/lib/kanban/calculadora-fases';

export type CalculadoraFaseDataManual = {
  dataInicio?: string | null;
  dataFim?: string | null;
};

type CalculadoraFaseDataRow = {
  fase_id: string;
  data_inicio: string | null;
  data_fim: string | null;
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

/** Overlay por fase — altera só a linha editada, sem recalcular fases posteriores. */
export function aplicarDatasManuaisCalculadora(
  linhas: CalculadoraFaseLinha[],
  overrides: Map<string, CalculadoraFaseDataManual>,
  card: CalculadoraFasesInput['card'],
  hoje?: Date,
): CalculadoraFaseLinha[] {
  return aplicarDatasManuaisCalculadoraLinhas(linhas, overrides, card, hoje);
}
