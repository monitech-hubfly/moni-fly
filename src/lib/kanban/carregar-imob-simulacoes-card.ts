import type { SupabaseClient } from '@supabase/supabase-js';
import {
  emptyImobCardModeloDraft,
  mapImobCardEmpreendimentoRow,
  mapImobCardModeloRow,
  rowToImobDraft,
  rowToImobModeloDraft,
  type ImobCardEmpreendimentoDraft,
  type ImobCardModeloDraft,
} from '@/lib/kanban/imob-simulacoes-card';

function tabelaImobAusente(message: string): boolean {
  return /imob_card_empreendimentos|imob_card_modelo|schema cache|does not exist|could not find the table/i.test(
    message,
  );
}

/** maybeSingle com 0 ou N linhas, ou coluna da 550 ainda ausente. */
function imobConsultaIgnoravel(message: string): boolean {
  return (
    tabelaImobAusente(message) ||
    /PGRST116|0 rows|multiple \(or no\) rows|parcela_unica|simulacao_pagamento_id/i.test(message)
  );
}

export async function carregarImobSimulacoesCard(
  supabase: SupabaseClient,
  cardId: string,
): Promise<
  | { ok: true; itens: ImobCardEmpreendimentoDraft[]; modelo: ImobCardModeloDraft }
  | { ok: false; error: string }
> {
  const id = String(cardId ?? '').trim();
  if (!id) return { ok: true, itens: [], modelo: emptyImobCardModeloDraft() };

  const [empRes, modeloRes] = await Promise.all([
    supabase
      .from('imob_card_empreendimentos')
      .select('*')
      .eq('card_id', id)
      .order('ordem', { ascending: true }),
    supabase.from('imob_card_modelo').select('*').eq('card_id', id).maybeSingle(),
  ]);

  if (empRes.error) {
    if (imobConsultaIgnoravel(empRes.error.message)) {
      return { ok: true, itens: [], modelo: emptyImobCardModeloDraft() };
    }
    return { ok: false, error: empRes.error.message };
  }

  let modelo = emptyImobCardModeloDraft();
  if (modeloRes.error) {
    if (!imobConsultaIgnoravel(modeloRes.error.message)) {
      return { ok: false, error: modeloRes.error.message };
    }
  } else if (modeloRes.data) {
    modelo = rowToImobModeloDraft(mapImobCardModeloRow(modeloRes.data as Record<string, unknown>));
  }

  const itens = (empRes.data ?? []).map((r) =>
    rowToImobDraft(mapImobCardEmpreendimentoRow(r as Record<string, unknown>)),
  );
  return { ok: true, itens, modelo };
}
