import { KANBAN_IDS, FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { isPortfolioKanbanRef } from '@/lib/kanban/portfolio-paralelas';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const ERRO_CHECKLIST_LEGAL =
  'Conclua o Checklist Legal do condomínio antes de avançar. Preencha em Dados do Negócio ou use o link público.';

type SupabaseLike = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>;

export async function obterChecklistLegalConcluidoPorCondominio(
  db: SupabaseLike,
  condominioId: string,
): Promise<boolean> {
  const cid = String(condominioId ?? '').trim();
  if (!cid) return false;

  const { data } = await db
    .from('checklist_legal_condominio')
    .select('id')
    .eq('condominio_id', cid)
    .eq('status', 'concluido')
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle();

  return Boolean(data?.id);
}

export async function resolverCondominioIdDoCard(
  db: SupabaseLike,
  cardId: string,
): Promise<string | null> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return null;

  const { data: card } = await db
    .from('kanban_cards')
    .select('condominio_id, projeto_id')
    .eq('id', cid)
    .maybeSingle();

  const direct = String((card as { condominio_id?: string | null } | null)?.condominio_id ?? '').trim();
  if (direct) return direct;

  const projetoId = String((card as { projeto_id?: string | null } | null)?.projeto_id ?? '').trim();
  if (projetoId) {
    const { data: proc } = await db
      .from('processo_step_one')
      .select('condominio_id')
      .eq('id', projetoId)
      .maybeSingle();
    const fromProc = String((proc as { condominio_id?: string | null } | null)?.condominio_id ?? '').trim();
    if (fromProc) return fromProc;
  }

  const { data: procDirect } = await db
    .from('processo_step_one')
    .select('condominio_id')
    .eq('id', cid)
    .maybeSingle();
  return String((procDirect as { condominio_id?: string | null } | null)?.condominio_id ?? '').trim() || null;
}

/** Gate: exige checklist legal concluído para condomínio em movimentos de acoplamento / step_5. */
export async function verificarGateChecklistLegalAcoplamento(
  cardId: string,
  novaFaseId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cid = String(cardId ?? '').trim();
  const fid = String(novaFaseId ?? '').trim();
  if (!cid || !fid) return { ok: true };

  const supabase = await createClient();

  const { data: card } = await supabase
    .from('kanban_cards')
    .select('kanban_id, fase_id')
    .eq('id', cid)
    .maybeSingle();

  if (!card) return { ok: true };

  const faseAtualId = String((card as { fase_id?: string }).fase_id ?? '').trim();
  const [{ data: faseAtualRow }, { data: faseDestRow }] = await Promise.all([
    faseAtualId
      ? supabase.from('kanban_fases').select('slug, ordem').eq('id', faseAtualId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('kanban_fases').select('slug, ordem, kanban_id').eq('id', fid).maybeSingle(),
  ]);

  const kanbanId = String((card as { kanban_id?: string }).kanban_id ?? '').trim();
  const slugAtual = String((faseAtualRow as { slug?: string } | null)?.slug ?? '').trim();
  const slugDest = String((faseDestRow as { slug?: string } | null)?.slug ?? '').trim();
  const ordemAtual = Number((faseAtualRow as { ordem?: number } | null)?.ordem ?? 0);
  const ordemDest = Number((faseDestRow as { ordem?: number } | null)?.ordem ?? 0);

  let exigir = false;

  if (isPortfolioKanbanRef(kanbanId)) {
    if (slugDest === FASE_SLUGS.STEP_5) exigir = true;
    if (slugAtual === FASE_SLUGS.STEP_4 && slugDest === FASE_SLUGS.ACOPLAMENTO) exigir = true;
  }

  if (kanbanId === KANBAN_IDS.ACOPLAMENTO) {
    if (slugDest === FASE_SLUGS.ACOPLAMENTO_REPROVADO) return { ok: true };
    if (ordemDest > ordemAtual) exigir = true;
  }

  if (!exigir) return { ok: true };

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : ERRO_CHECKLIST_LEGAL };
  }

  const condominioId = await resolverCondominioIdDoCard(db, cid);
  if (!condominioId) {
    return {
      ok: false,
      error: 'Vincule o condomínio ao card antes de avançar. O Checklist Legal é obrigatório por condomínio.',
    };
  }

  const concluido = await obterChecklistLegalConcluidoPorCondominio(db, condominioId);
  if (!concluido) return { ok: false, error: ERRO_CHECKLIST_LEGAL };

  return { ok: true };
}

export { ERRO_CHECKLIST_LEGAL };

export { deveExibirChecklistLegalNaFase } from '@/lib/checklist-legal/display';
