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
