import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const MSG_GATE_JURIDICO_RETROALIMENTAR =
  'Defina se há necessidade de retroalimentação do padrão antes de concluir (campo obrigatório na Fase 7).';

type GateResult = { ok: true } | { ok: false; error: string };

/**
 * Gate: Pós-Assinatura (07) → Atendimentos Concluídos (08).
 * Exige decisão em `juridico_retroalimentar` (true/false) — não pode ficar null.
 */
export async function verificarGateJuridicoRetroalimentar(
  cardId: string,
  novaFaseId: string,
): Promise<GateResult> {
  const cid = String(cardId ?? '').trim();
  const fid = String(novaFaseId ?? '').trim();
  if (!cid || !fid) return { ok: true };

  const supabase = await createClient();

  const { data: card } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id, fase_id, juridico_retroalimentar')
    .eq('id', cid)
    .maybeSingle();

  if (!card?.id) return { ok: true };
  if (String((card as { kanban_id?: string }).kanban_id ?? '') !== KANBAN_IDS.JURIDICO) {
    return { ok: true };
  }

  const [{ data: faseAtual }, { data: faseDest }] = await Promise.all([
    supabase
      .from('kanban_fases')
      .select('slug')
      .eq('id', String((card as { fase_id?: string | null }).fase_id ?? ''))
      .maybeSingle(),
    supabase.from('kanban_fases').select('slug').eq('id', fid).maybeSingle(),
  ]);

  const slugAtual = String((faseAtual as { slug?: string | null } | null)?.slug ?? '').trim();
  const slugDest = String((faseDest as { slug?: string | null } | null)?.slug ?? '').trim();

  if (slugAtual !== FASE_SLUGS.JURIDICO_POS_ASSINATURA) return { ok: true };
  if (slugDest !== FASE_SLUGS.JURIDICO_ATENDIMENTOS_CONCLUIDOS) return { ok: true };

  const flag = (card as { juridico_retroalimentar?: boolean | null }).juridico_retroalimentar;
  if (flag === true || flag === false) return { ok: true };

  return { ok: false, error: MSG_GATE_JURIDICO_RETROALIMENTAR };
}

/**
 * Automação: ao entrar em Demanda Concluída (08), forka para 09 ou 10
 * conforme `juridico_retroalimentar`.
 */
export async function executarForkJuridicoDemandaConcluida(cardId: string): Promise<void> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return;

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error('[forkJuridico] admin client:', e);
    return;
  }

  const { data: card, error: errCard } = await db
    .from('kanban_cards')
    .select('id, kanban_id, fase_id, juridico_retroalimentar')
    .eq('id', cid)
    .maybeSingle();

  if (errCard) {
    console.error('[forkJuridico] card:', errCard.message);
    return;
  }
  if (!card?.id) return;
  if (String((card as { kanban_id?: string }).kanban_id ?? '') !== KANBAN_IDS.JURIDICO) return;

  const faseAtualId = String((card as { fase_id?: string | null }).fase_id ?? '').trim();
  if (!faseAtualId) return;

  const { data: faseAtual } = await db
    .from('kanban_fases')
    .select('slug')
    .eq('id', faseAtualId)
    .maybeSingle();

  if (
    String((faseAtual as { slug?: string | null } | null)?.slug ?? '').trim() !==
    FASE_SLUGS.JURIDICO_DEMANDA_CONCLUIDA
  ) {
    return;
  }

  const flag = (card as { juridico_retroalimentar?: boolean | null }).juridico_retroalimentar;
  if (flag !== true && flag !== false) return;

  const destinoSlug =
    flag === true
      ? FASE_SLUGS.JURIDICO_RETROALIMENTACAO
      : FASE_SLUGS.JURIDICO_ATENDIMENTOS_CONCLUIDOS;

  const { data: faseDest, error: errFase } = await db
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.JURIDICO)
    .eq('slug', destinoSlug)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (errFase) {
    console.error('[forkJuridico] fase destino:', errFase.message);
    return;
  }
  const faseDestId = String((faseDest as { id?: string } | null)?.id ?? '').trim();
  if (!faseDestId) {
    console.error('[forkJuridico] fase destino não encontrada:', destinoSlug);
    return;
  }

  const { error: errUpd } = await db
    .from('kanban_cards')
    .update({ fase_id: faseDestId } as never)
    .eq('id', cid);

  if (errUpd) {
    console.error('[forkJuridico] update:', errUpd.message);
    return;
  }

  try {
    const { aplicarResponsavelFasePadraoAoCard, aplicarResponsavelDaFasePadraoSeVazio } =
      await import('@/lib/kanban/responsavel-fase-checklist');
    await aplicarResponsavelFasePadraoAoCard(db, cid, faseDestId, KANBAN_IDS.JURIDICO, null);
    await aplicarResponsavelDaFasePadraoSeVazio(db, cid, faseDestId, null);
  } catch (e) {
    console.error('[forkJuridico] responsavel fase:', e);
  }
}
