import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mapImobCardEmpreendimentoRow,
  rowToImobDraft,
  type ImobCardEmpreendimentoDraft,
} from '@/lib/kanban/imob-simulacoes-card';

function tabelaImobAusente(message: string): boolean {
  return /imob_card_empreendimentos|schema cache|does not exist|could not find the table/i.test(
    message,
  );
}

export async function carregarImobSimulacoesCard(
  supabase: SupabaseClient,
  cardId: string,
): Promise<{ ok: true; itens: ImobCardEmpreendimentoDraft[] } | { ok: false; error: string }> {
  const id = String(cardId ?? '').trim();
  if (!id) return { ok: true, itens: [] };

  const { data, error } = await supabase
    .from('imob_card_empreendimentos')
    .select('*')
    .eq('card_id', id)
    .order('ordem', { ascending: true });

  if (error) {
    if (tabelaImobAusente(error.message)) {
      return { ok: true, itens: [] };
    }
    return { ok: false, error: error.message };
  }

  const itens = (data ?? []).map((r) => rowToImobDraft(mapImobCardEmpreendimentoRow(r as Record<string, unknown>)));
  return { ok: true, itens };
}
