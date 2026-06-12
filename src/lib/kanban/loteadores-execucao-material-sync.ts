import type { SupabaseClient } from '@supabase/supabase-js';
import { LOTEADORES_ACOPLAMENTO_FASE_SLUG } from '@/lib/kanban/loteadores-acoplamento';
import { carregarFontesSyncAcoplamentoLoteador } from '@/lib/kanban/loteadores-acoplamento-sync';

/** Link de Acoplamento espelhado da fase Acoplamento (ou esteira). */
export async function carregarLinkAcoplamentoExecucaoMaterial(
  supabase: SupabaseClient,
  cardId: string,
  faseIdExecucao: string,
): Promise<string | null> {
  const cid = cardId.trim();
  if (!cid) return null;

  const { data: faseAtual } = await supabase
    .from('kanban_fases')
    .select('kanban_id')
    .eq('id', faseIdExecucao)
    .maybeSingle();
  const kanbanId = String((faseAtual as { kanban_id?: string } | null)?.kanban_id ?? '').trim();
  if (!kanbanId) return null;

  const { data: faseAcop } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', kanbanId)
    .eq('slug', LOTEADORES_ACOPLAMENTO_FASE_SLUG)
    .maybeSingle();
  const faseAcopId = String((faseAcop as { id?: string } | null)?.id ?? '').trim();

  if (faseAcopId) {
    const { data: itemAcop } = await supabase
      .from('kanban_fase_checklist_itens')
      .select('id')
      .eq('fase_id', faseAcopId)
      .eq('campo_slug', 'link_acoplamento')
      .maybeSingle();
    const itemId = String((itemAcop as { id?: string } | null)?.id ?? '').trim();

    if (itemId) {
      const { data: resp } = await supabase
        .from('kanban_fase_checklist_respostas')
        .select('valor')
        .eq('card_id', cid)
        .eq('item_id', itemId)
        .maybeSingle();
      const v = String((resp as { valor?: string | null } | null)?.valor ?? '').trim();
      if (v) return v;
    }
  }

  const fontes = await carregarFontesSyncAcoplamentoLoteador(supabase, cid, faseIdExecucao);
  const link = fontes.get('link_acoplamento')?.valor?.trim();
  return link || null;
}
