import type { SupabaseClient } from '@supabase/supabase-js';
import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  LOTEADORES_ACOPLAMENTO_MIRROR_VIABILIDADE,
  LOTEADORES_VIABILIDADE_FASE_SLUGS_ORDEM,
  type LoteadorAcoplamentoSyncValor,
} from '@/lib/kanban/loteadores-acoplamento';

/** Labels do checklist da esteira Acoplamento (Modelagem Casa Gbox). */
const CHECKLIST_LABEL_GBOX = 'Gbox';
const CHECKLIST_LABEL_ACOPLAMENTO = 'Acoplamento';

function normLabel(label: string | null | undefined): string {
  return String(label ?? '')
    .trim()
    .toLowerCase();
}

function temConteudo(valor: string | null | undefined, arquivo: string | null | undefined): boolean {
  return Boolean(String(valor ?? '').trim()) || Boolean(String(arquivo ?? '').trim());
}

/** Carrega valores espelhados (Viabilidade + esteira Acoplamento) para a fase Acoplamento do Loteadores. */
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

  if (faseIdsViab.length > 0) {
    const { data: itensViab } = await supabase
      .from('kanban_fase_checklist_itens')
      .select('id, fase_id, campo_slug')
      .in('fase_id', faseIdsViab)
      .in('campo_slug', [...LOTEADORES_ACOPLAMENTO_MIRROR_VIABILIDADE]);

    const itemRows = (itensViab ?? []) as { id: string; fase_id: string; campo_slug: string | null }[];
    const itemIds = itemRows.map((i) => i.id);

    if (itemIds.length > 0) {
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
    }
  }

  let linkGbox: string | null = null;
  let linkAcoplamento: string | null = null;

  const { data: cardRow } = await supabase
    .from('kanban_cards')
    .select('projeto_id')
    .eq('id', cid)
    .maybeSingle();
  const projetoId = String((cardRow as { projeto_id?: string | null } | null)?.projeto_id ?? '').trim();

  if (projetoId) {
    const { data: proc } = await supabase
      .from('processo_step_one')
      .select('link_gbox, link_acoplamento')
      .eq('id', projetoId)
      .maybeSingle();
    linkGbox = String((proc as { link_gbox?: string | null } | null)?.link_gbox ?? '').trim() || null;
    linkAcoplamento =
      String((proc as { link_acoplamento?: string | null } | null)?.link_acoplamento ?? '').trim() || null;
  }

  if (!linkGbox || !linkAcoplamento) {
    const { data: filho } = await supabase
      .from('kanban_cards')
      .select('id')
      .eq('origem_card_id', cid)
      .eq('kanban_id', KANBAN_IDS.ACOPLAMENTO)
      .maybeSingle();
    const filhoId = String((filho as { id?: string } | null)?.id ?? '').trim();

    if (filhoId) {
      const { data: faseModelagem } = await supabase
        .from('kanban_fases')
        .select('id')
        .eq('kanban_id', KANBAN_IDS.ACOPLAMENTO)
        .eq('slug', FASE_SLUGS.MODELAGEM_CASA_GBOX)
        .maybeSingle();
      const faseModelagemId = String((faseModelagem as { id?: string } | null)?.id ?? '').trim();

      if (faseModelagemId) {
        const { data: itensEsteira } = await supabase
          .from('kanban_fase_checklist_itens')
          .select('id, label')
          .eq('fase_id', faseModelagemId);

        let gboxItemId: string | null = null;
        let acoplamentoItemId: string | null = null;
        for (const it of itensEsteira ?? []) {
          const id = String((it as { id?: string }).id ?? '').trim();
          const lab = normLabel((it as { label?: string }).label);
          if (lab === normLabel(CHECKLIST_LABEL_GBOX)) gboxItemId = id;
          if (lab === normLabel(CHECKLIST_LABEL_ACOPLAMENTO)) acoplamentoItemId = id;
        }

        const idsEsteira = [gboxItemId, acoplamentoItemId].filter(Boolean) as string[];
        if (idsEsteira.length > 0) {
          const { data: respsEsteira } = await supabase
            .from('kanban_fase_checklist_respostas')
            .select('item_id, valor')
            .eq('card_id', filhoId)
            .in('item_id', idsEsteira);

          for (const r of (respsEsteira ?? []) as { item_id: string; valor: string | null }[]) {
            const v = String(r.valor ?? '').trim();
            if (!v) continue;
            if (gboxItemId && r.item_id === gboxItemId && !linkGbox) linkGbox = v;
            if (acoplamentoItemId && r.item_id === acoplamentoItemId && !linkAcoplamento) {
              linkAcoplamento = v;
            }
          }
        }
      }
    }
  }

  if (linkAcoplamento) {
    out.set('link_acoplamento', { valor: linkAcoplamento, arquivo_path: null });
  }
  if (linkGbox) {
    out.set('link_gbox', { valor: linkGbox, arquivo_path: null });
  }

  return out;
}
