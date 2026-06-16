import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  CHECKLIST_LABEL_LINK_PLANILHA_MAPA,
  isChecklistItemLinkPlanilhaMapa,
} from '@/lib/kanban/gbox-planilha-mapa-labels';
import { resolverProcessoIdDoCard } from '@/lib/kanban/links-bca-acoplamento-sync';
import { MAPA_COMPETIDORES_FASE_SLUGS } from '@/lib/kanban/stepone-fase-slugs';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import 'server-only';

export { CHECKLIST_LABEL_LINK_PLANILHA_MAPA, isChecklistItemLinkPlanilhaMapa };

export type OrigemSyncGboxPlanilhaMapa = 'checklist' | 'painel_negocio';

function normLink(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim();
  return s.length > 0 ? s : null;
}

async function obterItemPlanilhaMapaChecklist(
  db: SupabaseClient,
): Promise<string | null> {
  const { data: fases } = await db
    .from('kanban_fases')
    .select('id, slug')
    .eq('kanban_id', KANBAN_IDS.STEP_ONE)
    .in('slug', [...MAPA_COMPETIDORES_FASE_SLUGS])
    .eq('ativo', true);

  let faseId = '';
  for (const slug of MAPA_COMPETIDORES_FASE_SLUGS) {
    const hit = (fases ?? []).find((f) => String((f as { slug?: string }).slug ?? '') === slug);
    if (hit?.id) {
      faseId = String(hit.id);
      break;
    }
  }
  if (!faseId) return null;

  const { data: itens } = await db
    .from('kanban_fase_checklist_itens')
    .select('id, label')
    .eq('fase_id', faseId);

  for (const it of itens ?? []) {
    const id = String((it as { id?: string }).id ?? '').trim();
    const lab = (it as { label?: string }).label;
    if (id && isChecklistItemLinkPlanilhaMapa(lab)) return id;
  }

  return null;
}

async function lerValorPlanilhaMapaChecklist(
  db: SupabaseClient,
  cardId: string,
): Promise<{ itemId: string | null; valor: string | null }> {
  const itemId = await obterItemPlanilhaMapaChecklist(db);
  if (!itemId) return { itemId: null, valor: null };

  const { data: resp } = await db
    .from('kanban_fase_checklist_respostas')
    .select('valor')
    .eq('card_id', cardId)
    .eq('item_id', itemId)
    .maybeSingle();

  return {
    itemId,
    valor: normLink((resp as { valor?: string | null } | null)?.valor),
  };
}

async function gravarPlanilhaMapaChecklist(
  db: SupabaseClient,
  cardId: string,
  itemId: string,
  valor: string | null,
  usuarioId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db.from('kanban_fase_checklist_respostas').upsert(
    {
      item_id: itemId,
      card_id: cardId,
      valor,
      arquivo_path: null,
      preenchido_por: usuarioId ?? null,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: 'item_id,card_id' },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function gravarLinksPlanilhaMapaProcesso(
  db: SupabaseClient,
  processoId: string,
  link: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db
    .from('processo_step_one')
    .update({
      link_gbox: link,
      link_mapa_competidores: link,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', processoId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Checklist Mapa de Competidores → `processo_step_one.link_gbox`. */
export async function sincronizarPlanilhaMapaChecklistParaGbox(params: {
  cardId: string;
  valorChecklist: string | null;
  processoId?: string | null;
}): Promise<{ ok: true; linkGbox: string | null } | { ok: false; error: string }> {
  const cardId = String(params.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const processoId =
    String(params.processoId ?? '').trim() || (await resolverProcessoIdDoCard(db, cardId));
  if (!processoId) return { ok: false, error: 'Sem processo vinculado.' };

  const linkGbox = normLink(params.valorChecklist);
  const upd = await gravarLinksPlanilhaMapaProcesso(db, processoId, linkGbox);
  if (!upd.ok) return upd;

  return { ok: true, linkGbox };
}

/** Painel Dados do Negócio (`link_gbox`) → checklist Mapa de Competidores. */
export async function sincronizarGboxPainelParaPlanilhaMapaChecklist(params: {
  cardId: string;
  linkGbox: string | null;
  usuarioId?: string | null;
}): Promise<{ ok: true; valorChecklist: string | null } | { ok: false; error: string }> {
  const cardId = String(params.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const itemId = await obterItemPlanilhaMapaChecklist(db);
  if (!itemId) return { ok: false, error: 'Item de checklist não encontrado.' };

  const valorChecklist = normLink(params.linkGbox);
  const upd = await gravarPlanilhaMapaChecklist(db, cardId, itemId, valorChecklist, params.usuarioId);
  if (!upd.ok) return upd;

  return { ok: true, valorChecklist };
}

/**
 * Ao abrir a fase Mapa de Competidores: se só um lado estiver preenchido, espelha no outro.
 * Não sobrescreve quando ambos têm valores diferentes.
 */
export async function reconciliarGboxPlanilhaMapa(params: {
  cardId: string;
  processoId?: string | null;
}): Promise<
  | {
      ok: true;
      linkGbox: string | null;
      valorChecklist: string | null;
      alterado: boolean;
    }
  | { ok: false; error: string }
> {
  const cardId = String(params.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const processoId =
    String(params.processoId ?? '').trim() || (await resolverProcessoIdDoCard(db, cardId));
  if (!processoId) return { ok: false, error: 'Sem processo vinculado.' };

  const [{ data: proc }, checklist] = await Promise.all([
    db
      .from('processo_step_one')
      .select('link_gbox, link_mapa_competidores')
      .eq('id', processoId)
      .maybeSingle(),
    lerValorPlanilhaMapaChecklist(db, cardId),
  ]);

  const linkGbox = normLink((proc as { link_gbox?: string | null } | null)?.link_gbox);
  const linkMapa = normLink(
    (proc as { link_mapa_competidores?: string | null } | null)?.link_mapa_competidores,
  );
  const valorChecklist = checklist.valor;
  const canonicalPainel = linkGbox ?? linkMapa;

  if (linkGbox === valorChecklist && linkMapa === valorChecklist && linkGbox === linkMapa) {
    return { ok: true, linkGbox: canonicalPainel, valorChecklist, alterado: false };
  }

  if (linkGbox && !linkMapa) {
    const upd = await gravarLinksPlanilhaMapaProcesso(db, processoId, linkGbox);
    if (!upd.ok) return upd;
    if (linkGbox === valorChecklist) {
      return { ok: true, linkGbox, valorChecklist, alterado: true };
    }
  } else if (linkMapa && !linkGbox) {
    const upd = await gravarLinksPlanilhaMapaProcesso(db, processoId, linkMapa);
    if (!upd.ok) return upd;
    if (linkMapa === valorChecklist) {
      return { ok: true, linkGbox: linkMapa, valorChecklist, alterado: true };
    }
  }

  if (valorChecklist && !canonicalPainel) {
    const upd = await gravarLinksPlanilhaMapaProcesso(db, processoId, valorChecklist);
    if (!upd.ok) return upd;
    return { ok: true, linkGbox: valorChecklist, valorChecklist, alterado: true };
  }

  if (canonicalPainel && !valorChecklist && checklist.itemId) {
    const upd = await gravarPlanilhaMapaChecklist(db, cardId, checklist.itemId, canonicalPainel);
    if (!upd.ok) return upd;
    return { ok: true, linkGbox: canonicalPainel, valorChecklist: canonicalPainel, alterado: true };
  }

  return { ok: true, linkGbox: canonicalPainel, valorChecklist, alterado: false };
}
