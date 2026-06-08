import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

import { DADOS_CANDIDATO_FASE_SLUGS } from '@/lib/kanban/stepone-fase-slugs';

const FUNIL_STEP_ONE_NOME = 'Funil Step One';

export type RedeRowForFunilCard = {
  id: string;
  nome_completo?: string | null;
  n_franquia?: string | null;
  processo_id?: string | null;
};

export function tituloFunilFromRedeRow(row: Pick<RedeRowForFunilCard, 'nome_completo' | 'n_franquia'>): string {
  return (
    String(row.nome_completo ?? '').trim() ||
    String(row.n_franquia ?? '').trim() ||
    'Franqueado'
  );
}

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
    .in('slug', [...DADOS_CANDIDATO_FASE_SLUGS])
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .limit(1);

  if (errFase) return { ok: false, error: errFase.message };
  const fase = fases?.[0] ?? null;
  if (!fase?.id) {
    return {
      ok: false,
      error: `Fase candidato (${DADOS_CANDIDATO_FASE_SLUGS.join(' ou ')}) não encontrada no Funil Step One.`,
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

export type GarantirCardsFunilStepOneResult =
  | {
      ok: true;
      criados: number;
      reparados: number;
      jaExistiam: number;
      ignorados: number;
      erros: string[];
    }
  | { ok: false; error: string };

async function resolveFranqueadoUserIdForRede(
  db: SupabaseClient,
  redeId: string,
  processoId: string | null | undefined,
  fallbackUserId: string,
): Promise<string | null> {
  const { data: prof } = await db
    .from('profiles')
    .select('id')
    .eq('rede_franqueado_id', redeId)
    .limit(1)
    .maybeSingle();
  if (prof?.id) return String(prof.id);

  const pid = String(processoId ?? '').trim();
  if (pid) {
    const { data: proc } = await db.from('processo_step_one').select('user_id').eq('id', pid).maybeSingle();
    if (proc?.user_id) return String(proc.user_id);
  }

  const { data: procOrigem } = await db
    .from('processo_step_one')
    .select('user_id')
    .eq('origem_rede_franqueados_id', redeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (procOrigem?.user_id) return String(procOrigem.user_id);

  const fallback = String(fallbackUserId ?? '').trim();
  return fallback || null;
}

/** Conta linhas da rede sem card vinculado no Funil Step One. */
export async function contarRedeSemCardFunilStepOne(): Promise<
  { ok: true; total: number } | { ok: false; error: string }
> {
  let db: SupabaseClient;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const { data: kanban, error: errKanban } = await db
    .from('kanbans')
    .select('id')
    .eq('nome', FUNIL_STEP_ONE_NOME)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle();
  if (errKanban) return { ok: false, error: errKanban.message };
  if (!kanban?.id) return { ok: true, total: 0 };

  const { data: redeRows, error: errRede } = await db.from('rede_franqueados').select('id');
  if (errRede) return { ok: false, error: errRede.message };

  const { data: cards, error: errCards } = await db
    .from('kanban_cards')
    .select('rede_franqueado_id')
    .eq('kanban_id', String(kanban.id))
    .not('rede_franqueado_id', 'is', null);
  if (errCards) return { ok: false, error: errCards.message };

  const comCard = new Set(
    (cards ?? [])
      .map((c) => String((c as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '').trim())
      .filter(Boolean),
  );
  const total = (redeRows ?? []).filter((r) => !comCard.has(String((r as { id: string }).id))).length;
  return { ok: true, total };
}

/**
 * Garante card no Funil Step One para cada linha de rede_franqueados (idempotente).
 */
export async function garantirCardsFunilStepOneParaTodaRede(
  fallbackUserId: string,
): Promise<GarantirCardsFunilStepOneResult> {
  const fallback = String(fallbackUserId ?? '').trim();
  if (!fallback) {
    return { ok: false, error: 'Usuário responsável é obrigatório para criar cards no funil.' };
  }

  let db: SupabaseClient;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Cliente admin indisponível: ${msg}` };
  }

  const { data: rows, error: errRows } = await db
    .from('rede_franqueados')
    .select('id, nome_completo, n_franquia, processo_id');
  if (errRows) return { ok: false, error: errRows.message };

  let criados = 0;
  let reparados = 0;
  let jaExistiam = 0;
  let ignorados = 0;
  const erros: string[] = [];

  for (const row of rows ?? []) {
    const redeRow = row as RedeRowForFunilCard;
    const redeId = String(redeRow.id ?? '').trim();
    if (!redeId) continue;

    const franqueadoUserId = await resolveFranqueadoUserIdForRede(
      db,
      redeId,
      redeRow.processo_id,
      fallback,
    );
    if (!franqueadoUserId) {
      ignorados += 1;
      erros.push(`Rede ${redeId}: sem usuário vinculado.`);
      continue;
    }

    const res = await ensureFunilStepOneCardFromRede(db, {
      redeFranqueadoId: redeId,
      franqueadoUserId,
      titulo: tituloFunilFromRedeRow(redeRow),
    });

    if (!res.ok) {
      ignorados += 1;
      erros.push(`Rede ${redeId}: ${res.error}`);
      continue;
    }
    if (res.created) criados += 1;
    else if (res.repaired) reparados += 1;
    else jaExistiam += 1;
  }

  return { ok: true, criados, reparados, jaExistiam, ignorados, erros };
}
