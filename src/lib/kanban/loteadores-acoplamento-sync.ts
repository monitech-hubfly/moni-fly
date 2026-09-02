import type { SupabaseClient } from '@supabase/supabase-js';
import {
  LOTEADORES_ACOPLAMENTO_MIRROR_VIABILIDADE,
  LOTEADORES_VIABILIDADE_FASE_SLUGS_ORDEM,
  type LoteadorAcoplamentoSyncValor,
} from '@/lib/kanban/loteadores-acoplamento';

function temConteudo(valor: string | null | undefined, arquivo: string | null | undefined): boolean {
  return Boolean(String(valor ?? '').trim()) || Boolean(String(arquivo ?? '').trim());
}

/** Carrega valores espelhados da Viabilidade para a fase Acoplamento do Loteadores. */
export async function carregarFontesSyncAcoplamentoLoteador(
  supabase: SupabaseClient,
  cardId: string,
  faseIdAcoplamento: string,
): Promise<Map<string, LoteadorAcoplamentoSyncValor>> {
  const out = new Map<string, LoteadorAcoplamentoSyncValor>();
  const cid = cardId.trim();
  if (!cid) return out;

  const { data: faseAtual } = await supabase
    .from('kanban_fases')
    .select('kanban_id')
    .eq('id', faseIdAcoplamento)
    .maybeSingle();
  const kanbanId = String((faseAtual as { kanban_id?: string } | null)?.kanban_id ?? '').trim();
  if (!kanbanId) return out;

  const { data: fasesViab } = await supabase
    .from('kanban_fases')
    .select('id, slug')
    .eq('kanban_id', kanbanId)
    .in('slug', [...LOTEADORES_VIABILIDADE_FASE_SLUGS_ORDEM]);

  const faseOrdem = new Map(
    (fasesViab ?? []).map((f) => [
      String((f as { slug?: string }).slug ?? ''),
      String((f as { id?: string }).id ?? ''),
    ]),
  );
  const faseIdsViab = LOTEADORES_VIABILIDADE_FASE_SLUGS_ORDEM.map((s) => faseOrdem.get(s) ?? '').filter(
    Boolean,
  );

  if (faseIdsViab.length === 0) return out;

  const { data: itensViab } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, fase_id, campo_slug')
    .in('fase_id', faseIdsViab)
    .in('campo_slug', [...LOTEADORES_ACOPLAMENTO_MIRROR_VIABILIDADE]);

  const itemRows = (itensViab ?? []) as { id: string; fase_id: string; campo_slug: string | null }[];
  const itemIds = itemRows.map((i) => i.id);

  if (itemIds.length === 0) return out;

  const { data: respsViab } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('item_id, valor, arquivo_path')
    .eq('card_id', cid)
    .in('item_id', itemIds);

  for (const slug of LOTEADORES_ACOPLAMENTO_MIRROR_VIABILIDADE) {
    for (const faseSlug of LOTEADORES_VIABILIDADE_FASE_SLUGS_ORDEM) {
      const faseId = faseOrdem.get(faseSlug);
      if (!faseId) continue;
      const item = itemRows.find((i) => i.fase_id === faseId && i.campo_slug === slug);
      if (!item) continue;
      const resp = (respsViab ?? []).find((x) => (x as { item_id: string }).item_id === item.id) as
        | { valor?: string | null; arquivo_path?: string | null }
        | undefined;
      if (!resp || !temConteudo(resp.valor, resp.arquivo_path)) continue;
      out.set(slug, {
        valor: String(resp.valor ?? ''),
        arquivo_path: resp.arquivo_path ?? null,
      });
      break;
    }
  }

  return out;
}
