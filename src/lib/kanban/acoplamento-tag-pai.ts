import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { createAdminClient } from '@/lib/supabase/admin';

const FASES_ACOPLAMENTO_CONCLUIDO = new Set<string>([
  FASE_SLUGS.ACOPLAMENTO_APROVADO,
  FASE_SLUGS.ACOPLAMENTO_REPROVADO,
]);

/** Rótulo do chip de Acoplamento no card pai (Portfólio). */
export function labelChipAcoplamentoPai(
  faseNome: string | null | undefined,
  labelsCompletos?: boolean,
): string {
  const n = String(faseNome ?? '').trim();
  if (!n) return labelsCompletos ? 'Acoplamento' : 'Acop.';
  if (labelsCompletos) return `Acoplamento: ${n}`;
  return n.length > 16 ? `Acop.: ${n.slice(0, 14)}…` : `Acop.: ${n}`;
}

/**
 * Quando o card filho no Funil Acoplamento muda de fase, atualiza tag no card pai (Portfólio).
 */
export async function sincronizarTagAcoplamentoPaiDoFilho(
  cardFilhoId: string,
  novaFaseSlug: string,
): Promise<void> {
  const filhoId = String(cardFilhoId ?? '').trim();
  const faseSlug = String(novaFaseSlug ?? '').trim();
  if (!filhoId || !faseSlug) return;

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error('[sincronizarTagAcoplamentoPaiDoFilho] admin client:', e);
    return;
  }

  const { data: filho, error: errFilho } = await db
    .from('kanban_cards')
    .select('id, kanban_id, origem_card_id, fase_id')
    .eq('id', filhoId)
    .maybeSingle();

  if (errFilho || !filho?.id) return;
  if (String(filho.kanban_id ?? '') !== KANBAN_IDS.ACOPLAMENTO) return;

  const paiId = String((filho as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
  if (!paiId) return;

  const { data: faseRow } = await db
    .from('kanban_fases')
    .select('nome, slug')
    .eq('id', String((filho as { fase_id?: string }).fase_id ?? ''))
    .maybeSingle();

  const faseNome = String((faseRow as { nome?: string | null } | null)?.nome ?? '').trim() || faseSlug;
  const patch: Record<string, unknown> = {
    acoplamento_filho_fase_slug: faseSlug,
    acoplamento_filho_fase_nome: faseNome,
  };

  if (FASES_ACOPLAMENTO_CONCLUIDO.has(faseSlug)) {
    patch.acoplamento_concluido = true;
  }

  const { error: errUpd } = await db.from('kanban_cards').update(patch).eq('id', paiId);
  if (errUpd) {
    console.error('[sincronizarTagAcoplamentoPaiDoFilho] update pai:', errUpd.message);
  }
}

type CardKanbanRef = {
  id?: string | null;
  kanban_id?: string | null;
  origem_card_id?: string | null;
  fase_id?: string | null;
};

function unwrapFaseSlug(
  v: { slug?: string | null } | { slug?: string | null }[] | null | undefined,
): string {
  if (Array.isArray(v)) return String(v[0]?.slug ?? '').trim();
  return String(v?.slug ?? '').trim();
}

/**
 * Ao vincular manualmente Portfólio ↔ Funil Acoplamento, persiste tag no card pai.
 * Ignora outros pares de funis.
 */
export async function sincronizarTagAcoplamentoPaiAoVincularCards(
  cardIdA: string,
  cardIdB: string,
): Promise<void> {
  const a = String(cardIdA ?? '').trim();
  const b = String(cardIdB ?? '').trim();
  if (!a || !b || a === b) return;

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error('[sincronizarTagAcoplamentoPaiAoVincularCards] admin client:', e);
    return;
  }

  const { data: rows, error } = await db
    .from('kanban_cards')
    .select('id, kanban_id, origem_card_id, fase_id, kanban_fases ( slug )')
    .in('id', [a, b]);

  if (error || !rows?.length) return;

  const byId = new Map<string, CardKanbanRef & { faseSlug?: string }>();
  for (const row of rows) {
    const id = String((row as CardKanbanRef).id ?? '').trim();
    if (!id) continue;
    byId.set(id, {
      ...(row as CardKanbanRef),
      faseSlug: unwrapFaseSlug(
        (row as { kanban_fases?: { slug?: string | null } | { slug?: string | null }[] | null }).kanban_fases,
      ),
    });
  }

  const cardA = byId.get(a);
  const cardB = byId.get(b);
  if (!cardA?.id || !cardB?.id) return;

  let paiPortfolioId: string | null = null;
  let filhoAcoplamento: (CardKanbanRef & { faseSlug?: string }) | null = null;

  if (String(cardA.kanban_id ?? '') === KANBAN_IDS.PORTFOLIO && String(cardB.kanban_id ?? '') === KANBAN_IDS.ACOPLAMENTO) {
    paiPortfolioId = a;
    filhoAcoplamento = cardB;
  } else if (
    String(cardB.kanban_id ?? '') === KANBAN_IDS.PORTFOLIO &&
    String(cardA.kanban_id ?? '') === KANBAN_IDS.ACOPLAMENTO
  ) {
    paiPortfolioId = b;
    filhoAcoplamento = cardA;
  }

  if (!paiPortfolioId || !filhoAcoplamento?.id) return;

  const filhoId = String(filhoAcoplamento.id);
  const origemId = String(filhoAcoplamento.origem_card_id ?? '').trim();
  if (!origemId) {
    const { error: errOrigem } = await db
      .from('kanban_cards')
      .update({ origem_card_id: paiPortfolioId })
      .eq('id', filhoId)
      .is('origem_card_id', null);
    if (errOrigem) {
      console.error('[sincronizarTagAcoplamentoPaiAoVincularCards] origem_card_id:', errOrigem.message);
    }
  }

  await sincronizarTagAcoplamentoPaiDoFilho(
    filhoId,
    filhoAcoplamento.faseSlug || 'modelagem_terreno',
  );
}
