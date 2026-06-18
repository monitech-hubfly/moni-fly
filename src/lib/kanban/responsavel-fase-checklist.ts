import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanCardBrief } from '@/components/kanban-shared/types';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

/** Slug estável do campo «Responsável da fase» em todo kanban. */
export const CAMPO_SLUG_RESPONSAVEL_FASE = 'responsavel_fase';

export const RESPONSAVEL_FASE_CHECKLIST_LABEL = 'Responsável da fase';

/** Slugs legados de responsável (Loteadores) — lidos ao propagar da fase anterior. */
export const CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO = [
  CAMPO_SLUG_RESPONSAVEL_FASE,
  'responsavel_contato',
  'responsavel_revisao',
] as const;

export function isKanbanFunilStepOneId(kanbanId: string | null | undefined): boolean {
  return String(kanbanId ?? '').trim() === KANBAN_IDS.STEP_ONE;
}

/** Funil Step One: responsável da fase = `kanban_cards.franqueado_id`. */
export async function buscarFranqueadoIdResponsavelStepOne(
  supabase: SupabaseClient,
  cardId: string,
): Promise<string | null> {
  const cid = cardId.trim();
  if (!cid) return null;

  const { data: card } = await supabase
    .from('kanban_cards')
    .select('franqueado_id, kanban_id')
    .eq('id', cid)
    .maybeSingle();
  if (!card) return null;

  const kanbanId = String((card as { kanban_id?: string | null }).kanban_id ?? '').trim();
  if (!isKanbanFunilStepOneId(kanbanId)) return null;

  return valorResponsavelValido((card as { franqueado_id?: string | null } | null)?.franqueado_id);
}

type FaseOrdemRow = { id: string; ordem: number; slug?: string | null };

type ChecklistItemResponsavelRow = {
  id: string;
  campo_slug?: string | null;
  label?: string | null;
  tipo?: string | null;
};

function normalizarLabelResponsavelFase(label: string | null | undefined): boolean {
  const t = String(label ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return t === 'responsavel da fase';
}

/** Item de checklist que representa o responsável da fase (slug, label ou legado). */
export function isChecklistItemResponsavelFase(item: ChecklistItemResponsavelRow): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if ((CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO as readonly string[]).includes(slug as (typeof CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO)[number])) {
    return true;
  }
  if (normalizarLabelResponsavelFase(item.label)) return true;
  const label = String(item.label ?? '').trim().toLowerCase();
  return item.tipo === 'usuario' && label.includes('respons') && label.includes('fase');
}

export function escolherItemResponsavelFaseCanonico(rows: ChecklistItemResponsavelRow[]): string | null {
  if (rows.length === 0) return null;
  const bySlug = rows.find((r) => String(r.campo_slug ?? '').trim() === CAMPO_SLUG_RESPONSAVEL_FASE);
  if (bySlug?.id) return String(bySlug.id);
  const byLabel = rows.find((r) => normalizarLabelResponsavelFase(r.label));
  if (byLabel?.id) return String(byLabel.id);
  return String(rows[0]?.id ?? '').trim() || null;
}

/** Resolve o item editável de responsável da fase (sidebar / upsert). */
export async function buscarItemIdResponsavelFaseEdicao(
  supabase: SupabaseClient,
  faseId: string,
): Promise<string | null> {
  const fid = faseId.trim();
  if (!fid) return null;

  const { data: rowsSlug } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, campo_slug, label, tipo')
    .eq('fase_id', fid)
    .in('campo_slug', [...CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO]);

  let rows = (rowsSlug ?? []) as ChecklistItemResponsavelRow[];
  if (rows.length === 0) {
    const { data: rowsLabel } = await supabase
      .from('kanban_fase_checklist_itens')
      .select('id, campo_slug, label, tipo')
      .eq('fase_id', fid)
      .eq('label', RESPONSAVEL_FASE_CHECKLIST_LABEL);
    rows = (rowsLabel ?? []) as ChecklistItemResponsavelRow[];
  }
  if (rows.length === 0) {
    const { data: rowsUsuario } = await supabase
      .from('kanban_fase_checklist_itens')
      .select('id, campo_slug, label, tipo')
      .eq('fase_id', fid)
      .eq('tipo', 'usuario');
    rows = ((rowsUsuario ?? []) as ChecklistItemResponsavelRow[]).filter(isChecklistItemResponsavelFase);
  }

  return escolherItemResponsavelFaseCanonico(rows);
}

function valorResponsavelValido(valor: string | null | undefined): string | null {
  const v = String(valor ?? '').trim();
  return v || null;
}

async function buscarRespostaValor(
  supabase: SupabaseClient,
  cardId: string,
  itemIds: string[],
): Promise<string | null> {
  if (itemIds.length === 0) return null;
  const { data } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('item_id, valor')
    .eq('card_id', cardId)
    .in('item_id', itemIds);
  for (const row of data ?? []) {
    const v = valorResponsavelValido((row as { valor?: string | null }).valor);
    if (v) return v;
  }
  return null;
}

async function itemIdsResponsavelPorFase(
  supabase: SupabaseClient,
  faseId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, campo_slug')
    .eq('fase_id', faseId)
    .in('campo_slug', [...CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO]);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/**
 * Valor de responsável da fase imediatamente anterior (por ordem do kanban).
 * Na 1ª fase, usa `kanban_cards.franqueado_id` quando ainda não há resposta.
 */
export async function buscarValorResponsavelFaseAnterior(
  supabase: SupabaseClient,
  cardId: string,
  faseIdAtual: string,
): Promise<string | null> {
  const cid = cardId.trim();
  const fid = faseIdAtual.trim();
  if (!cid || !fid) return null;

  const { data: faseAtual } = await supabase
    .from('kanban_fases')
    .select('id, kanban_id, ordem')
    .eq('id', fid)
    .maybeSingle();
  if (!faseAtual?.id) return null;

  const kanbanId = String((faseAtual as { kanban_id?: string }).kanban_id ?? '').trim();
  const ordemAtual = Number((faseAtual as { ordem?: number }).ordem ?? 0);
  if (!kanbanId) return null;

  if (isKanbanFunilStepOneId(kanbanId)) {
    return buscarFranqueadoIdResponsavelStepOne(supabase, cid);
  }

  const { data: fases } = await supabase
    .from('kanban_fases')
    .select('id, ordem, slug')
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  const lista = (fases ?? []) as FaseOrdemRow[];
  const anteriores = lista.filter((f) => f.ordem < ordemAtual).sort((a, b) => b.ordem - a.ordem);

  for (const fase of anteriores) {
    const itemIds = await itemIdsResponsavelPorFase(supabase, fase.id);
    const valor = await buscarRespostaValor(supabase, cid, itemIds);
    if (valor) return valor;
  }

  const { data: card } = await supabase
    .from('kanban_cards')
    .select('franqueado_id')
    .eq('id', cid)
    .maybeSingle();
  return valorResponsavelValido((card as { franqueado_id?: string | null } | null)?.franqueado_id);
}

/** Preenche o campo responsavel_fase da nova fase a partir da fase anterior (se ainda vazio). */
export async function propagarResponsavelFaseAoEntrarFase(
  supabase: SupabaseClient,
  cardId: string,
  novaFaseId: string,
  preenchidoPor?: string | null,
): Promise<void> {
  const cid = cardId.trim();
  const fid = novaFaseId.trim();
  if (!cid || !fid) return;

  const { data: itemDestino } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id')
    .eq('fase_id', fid)
    .eq('campo_slug', CAMPO_SLUG_RESPONSAVEL_FASE)
    .maybeSingle();

  let itemId = String((itemDestino as { id?: string } | null)?.id ?? '').trim();
  if (!itemId) {
    itemId = (await buscarItemIdResponsavelFaseEdicao(supabase, fid)) ?? '';
  }
  if (!itemId) return;

  const { data: faseRow } = await supabase
    .from('kanban_fases')
    .select('kanban_id')
    .eq('id', fid)
    .maybeSingle();
  const kanbanId = String((faseRow as { kanban_id?: string | null } | null)?.kanban_id ?? '').trim();
  const stepOne = isKanbanFunilStepOneId(kanbanId);

  const { data: respAtual } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('valor')
    .eq('card_id', cid)
    .eq('item_id', itemId)
    .maybeSingle();

  let valorDestino: string | null = null;
  if (stepOne) {
    valorDestino = await buscarFranqueadoIdResponsavelStepOne(supabase, cid);
  } else {
    if (valorResponsavelValido((respAtual as { valor?: string | null } | null)?.valor)) return;
    valorDestino = await buscarValorResponsavelFaseAnterior(supabase, cid, fid);
  }

  if (!valorDestino) return;

  const valorAtual = valorResponsavelValido((respAtual as { valor?: string | null } | null)?.valor);
  if (valorAtual === valorDestino) return;

  await supabase.from('kanban_fase_checklist_respostas').upsert(
    {
      item_id: itemId,
      card_id: cid,
      valor: valorDestino,
      preenchido_por: preenchidoPor ?? null,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: 'item_id,card_id' },
  );
}

function resolverItemResponsavelPorFase(
  rows: { id: string; fase_id: string; campo_slug: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const faseId = String(row.fase_id ?? '').trim();
    const itemId = String(row.id ?? '').trim();
    if (!faseId || !itemId) continue;
    if (row.campo_slug === CAMPO_SLUG_RESPONSAVEL_FASE) {
      map.set(faseId, itemId);
    } else if (!map.has(faseId)) {
      map.set(faseId, itemId);
    }
  }
  return map;
}

/** Enriquece cards do board com responsável da fase atual (para avatar no card fechado). */
export async function enrichCardsComResponsavelFase(
  supabase: SupabaseClient,
  cards: KanbanCardBrief[],
): Promise<KanbanCardBrief[]> {
  if (cards.length === 0) return cards;

  const faseIds = [...new Set(cards.map((c) => String(c.fase_id ?? '').trim()).filter(Boolean))];
  if (faseIds.length === 0) return cards;

  const { data: itens } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, fase_id, campo_slug')
    .in('fase_id', faseIds)
    .in('campo_slug', [...CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO]);

  const itemPorFase = resolverItemResponsavelPorFase(
    (itens ?? []) as { id: string; fase_id: string; campo_slug: string }[],
  );
  const itemIds = [...new Set([...itemPorFase.values()])];
  if (itemIds.length === 0) return cards;

  const cardIds = cards.map((c) => c.id);
  const { data: respostas } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('card_id, item_id, valor')
    .in('card_id', cardIds)
    .in('item_id', itemIds);

  const respPorCardItem = new Map<string, string>();
  for (const row of respostas ?? []) {
    const cid = String((row as { card_id?: string }).card_id ?? '').trim();
    const iid = String((row as { item_id?: string }).item_id ?? '').trim();
    const v = valorResponsavelValido((row as { valor?: string | null }).valor);
    if (cid && iid && v) respPorCardItem.set(`${cid}:${iid}`, v);
  }

  const userIdPorCard = new Map<string, string>();
  for (const card of cards) {
    if (isKanbanFunilStepOneId(card.kanban_id)) {
      const fid = valorResponsavelValido(card.franqueado_id);
      if (fid) userIdPorCard.set(card.id, fid);
      continue;
    }
    const itemId = itemPorFase.get(String(card.fase_id ?? '').trim());
    if (!itemId) continue;
    const uid = respPorCardItem.get(`${card.id}:${itemId}`);
    if (uid) userIdPorCard.set(card.id, uid);
  }

  if (userIdPorCard.size === 0) return cards;

  const userIds = [...new Set([...userIdPorCard.values()])];
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
  const nomePorUserId = new Map<string, string>();
  for (const p of profiles ?? []) {
    const id = String((p as { id?: string }).id ?? '').trim();
    const nome = String((p as { full_name?: string | null }).full_name ?? '').trim();
    if (id) nomePorUserId.set(id, nome || id.slice(0, 8));
  }

  return cards.map((c) => {
    const uid = userIdPorCard.get(c.id);
    if (!uid) return c;
    return {
      ...c,
      responsavel_fase_id: uid,
      responsavel_fase_nome: nomePorUserId.get(uid) ?? null,
    };
  });
}
