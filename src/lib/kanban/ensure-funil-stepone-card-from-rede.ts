import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

const FUNIL_STEP_ONE_NOME = 'Funil Step One';
/** PROD: dados_candidato; DEV: stepone_dados_candidato (migration 148). */
const FASE_CANDIDATO_SLUGS = ['dados_candidato', 'stepone_dados_candidato'] as const;

export type EnsureFunilStepOneCardFromRedeResult =
  | { ok: true; created: boolean; cardId: string | null; repaired?: boolean }
  | { ok: false; error: string };

/**
 * Garante um card nativo no Funil Step One para uma linha da rede (idempotente por rede + kanban).
 * Escritas via service role para não perder rede_franqueado_id por RLS/trigger legado.
 */
export async function ensureFunilStepOneCardFromRede(
  _supabase: SupabaseClient,
  params: {
    redeFranqueadoId: string;
    franqueadoUserId: string;
    titulo: string;
  },
): Promise<EnsureFunilStepOneCardFromRedeResult> {
  const redeFranqueadoId = String(params.redeFranqueadoId ?? '').trim();
  const franqueadoUserId = String(params.franqueadoUserId ?? '').trim();
  const titulo = String(params.titulo ?? '').trim() || 'Franqueado';

  if (!redeFranqueadoId || !franqueadoUserId) {
    return { ok: false, error: 'redeFranqueadoId e franqueadoUserId são obrigatórios.' };
  }

  let db: SupabaseClient;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Cliente admin indisponível: ${msg}` };
  }

  const { data: kanban, error: errKanban } = await db
    .from('kanbans')
    .select('id')
    .eq('nome', FUNIL_STEP_ONE_NOME)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle();

  if (errKanban) return { ok: false, error: errKanban.message };
  if (!kanban?.id) {
    return { ok: false, error: `Kanban "${FUNIL_STEP_ONE_NOME}" não encontrado ou inativo.` };
  }

  const kanbanId = String(kanban.id);

  const { data: fases, error: errFase } = await db
    .from('kanban_fases')
    .select('id, slug')
    .eq('kanban_id', kanbanId)
    .in('slug', [...FASE_CANDIDATO_SLUGS])
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .limit(1);

  if (errFase) return { ok: false, error: errFase.message };
  const fase = fases?.[0] ?? null;
  if (!fase?.id) {
    return {
      ok: false,
      error: `Fase candidato (${FASE_CANDIDATO_SLUGS.join(' ou ')}) não encontrada no Funil Step One.`,
    };
  }

  const faseId = String(fase.id);

  const { data: existente, error: errExiste } = await db
    .from('kanban_cards')
    .select('id, fase_id')
    .eq('kanban_id', kanbanId)
    .eq('rede_franqueado_id', redeFranqueadoId)
    .limit(1)
    .maybeSingle();

  if (errExiste) return { ok: false, error: errExiste.message };

  if (existente?.id) {
    const cardId = String(existente.id);
    if (String(existente.fase_id) !== faseId) {
      const { error: errUp } = await db
        .from('kanban_cards')
        .update({ fase_id: faseId, titulo })
        .eq('id', cardId);
      if (errUp) return { ok: false, error: errUp.message };
      return { ok: true, created: false, cardId, repaired: true };
    }
    return { ok: true, created: false, cardId };
  }

  // Card órfão do trigger legado (sem rede_franqueado_id): reparar em vez de duplicar.
  const { data: orfaos, error: errOrfao } = await db
    .from('kanban_cards')
    .select('id')
    .eq('kanban_id', kanbanId)
    .eq('franqueado_id', franqueadoUserId)
    .is('rede_franqueado_id', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (errOrfao) return { ok: false, error: errOrfao.message };

  const orfaoId = orfaos?.[0]?.id != null ? String(orfaos[0].id) : null;
  if (orfaoId) {
    const { error: errRepair } = await db
      .from('kanban_cards')
      .update({
        rede_franqueado_id: redeFranqueadoId,
        fase_id: faseId,
        titulo,
      })
      .eq('id', orfaoId);
    if (errRepair) return { ok: false, error: errRepair.message };
    return { ok: true, created: false, cardId: orfaoId, repaired: true };
  }

  const { data: inserido, error: errInsert } = await db
    .from('kanban_cards')
    .insert({
      kanban_id: kanbanId,
      fase_id: faseId,
      franqueado_id: franqueadoUserId,
      rede_franqueado_id: redeFranqueadoId,
      titulo,
      status: 'ativo',
    })
    .select('id, rede_franqueado_id, fase_id')
    .single();

  if (errInsert) return { ok: false, error: errInsert.message };

  if (!inserido?.id) {
    return { ok: false, error: 'Insert do card não retornou id.' };
  }

  if (inserido.rede_franqueado_id == null) {
    return {
      ok: false,
      error: 'Card criado mas rede_franqueado_id permaneceu null (verifique triggers/coluna).',
    };
  }

  return {
    ok: true,
    created: true,
    cardId: String(inserido.id),
  };
}
