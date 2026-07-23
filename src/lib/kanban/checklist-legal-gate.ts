import { resolverProcessoStepOneIdDoCard } from '@/lib/kanban/card-sync-group';
import { createClient } from '@/lib/supabase/server';

const ERRO_CHECKLIST_LEGAL =
  'Conclua o Checklist Legal do condomínio antes de avançar. Preencha em Dados do Negócio ou use o link público.';

type SupabaseLike = Pick<Awaited<ReturnType<typeof createClient>>, 'from' | 'rpc'>;

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
    .select('condominio_id, projeto_id, rede_franqueado_id, titulo')
    .eq('id', cid)
    .maybeSingle();

  const row = card as {
    condominio_id?: string | null;
    projeto_id?: string | null;
    rede_franqueado_id?: string | null;
    titulo?: string | null;
  } | null;

  const direct = String(row?.condominio_id ?? '').trim();
  if (direct) return direct;

  const processoId = await resolverProcessoStepOneIdDoCard(db, {
    cardProjetoId: row?.projeto_id,
    redeFranqueadoId: row?.rede_franqueado_id,
    cardTitulo: row?.titulo,
  });
  if (processoId) {
    const { data: proc } = await db
      .from('processo_step_one')
      .select('condominio_id')
      .eq('id', processoId)
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

/** Gate opcional: checklist legal não bloqueia avanço de fase (mantido para reativar se necessário). */
export async function verificarGateChecklistLegalAcoplamento(
  _cardId: string,
  _novaFaseId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return { ok: true };
}

export { ERRO_CHECKLIST_LEGAL };

export { deveExibirChecklistLegalNaFase } from '@/lib/checklist-legal/display';
