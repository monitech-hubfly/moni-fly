import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { extrairNumeroFranquiaDoTitulo, montarTituloCardSync } from '@/lib/kanban/card-sync-group';
import {
  criarEVincularProcessoStepOneAoCard,
  vincularProcessoStepOneAoCard,
} from '@/lib/kanban/processo-step-one-card';

import { ONBOARDING_FASE_SLUGS } from '@/lib/kanban/stepone-fase-slugs';

const FUNIL_STEP_ONE_NOME = 'Funil Step One';

export type RedeRowForFunilCard = {
  id: string;
  nome_completo?: string | null;
  n_franquia?: string | null;
  processo_id?: string | null;
};

export function tituloFunilFromRedeRow(row: Pick<RedeRowForFunilCard, 'nome_completo' | 'n_franquia'>): string {
  return (
    montarTituloCardSync({
      nFranquia: row.n_franquia,
      nomeFranqueado: row.nome_completo,
    }) ?? 'Franqueado'
  );
}

export type EnsureFunilStepOneCardFromRedeResult =
  | { ok: true; created: boolean; cardId: string | null; repaired?: boolean }
  | { ok: false; error: string };

type VincularProcessoParams = {
  processoStepOneId?: string | null;
  franqueadoUserId: string;
  titulo: string;
  redeFranqueadoId: string;
};

async function resolveOnboardingFaseId(
  db: SupabaseClient,
  kanbanId: string,
): Promise<{ faseId: string } | { error: string }> {
  const { data: fases, error: errFase } = await db
    .from('kanban_fases')
    .select('id, slug')
    .eq('kanban_id', kanbanId)
    .in('slug', [...ONBOARDING_FASE_SLUGS])
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .limit(1);

  if (errFase) return { error: errFase.message };

  if (fases?.[0]?.id) {
    return { faseId: String(fases[0].id) };
  }

  const { data: fallback, error: errFallback } = await db
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .limit(1);

  if (errFallback) return { error: errFallback.message };
  if (!fallback?.[0]?.id) {
    return {
      error: `Nenhuma fase ativa no Funil Step One (Onboarding: ${ONBOARDING_FASE_SLUGS.join(' ou ')}).`,
    };
  }

  return { faseId: String(fallback[0].id) };
}

/** Vincula processo existente (rede) ou cria mínimo; falhas não invalidam o card. */
async function vincularProcessoAoCardSeNecessario(
  db: SupabaseClient,
  cardId: string,
  params: VincularProcessoParams,
): Promise<void> {
  const pidExistente = String(params.processoStepOneId ?? '').trim();
  if (pidExistente) {
    const link = await vincularProcessoStepOneAoCard(db, cardId, pidExistente, {
      redeFranqueadoId: params.redeFranqueadoId,
    });
    if (!link.ok) {
      console.warn('[ensureFunilStepOneCardFromRede] vincular processo existente:', link.error);
    }
    return;
  }

  const numeroFranquia = extrairNumeroFranquiaDoTitulo(params.titulo) || null;
  const processoRes = await criarEVincularProcessoStepOneAoCard(db, {
    cardId,
    userId: params.franqueadoUserId,
    titulo: params.titulo,
    redeFranqueadoId: params.redeFranqueadoId,
    numeroFranquia,
  });
  if (!processoRes.ok) {
    console.warn('[ensureFunilStepOneCardFromRede] criar/vincular processo:', processoRes.error);
  }
}

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
    processoStepOneId?: string | null;
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

  const faseRes = await resolveOnboardingFaseId(db, kanbanId);
  if ('error' in faseRes) return { ok: false, error: faseRes.error };
  const faseId = faseRes.faseId;

  const vincularParams: VincularProcessoParams = {
    processoStepOneId: params.processoStepOneId,
    franqueadoUserId,
    titulo,
    redeFranqueadoId,
  };

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
    const { error: errUp } = await db
      .from('kanban_cards')
      .update({ titulo, fase_id: faseId })
      .eq('id', cardId);
    if (errUp) return { ok: false, error: errUp.message };
    await vincularProcessoAoCardSeNecessario(db, cardId, vincularParams);
    return { ok: true, created: false, cardId };
  }

  // Card órfão do trigger legado (sem rede_franqueado_id): reparar em vez de duplicar.
  const fkNum = extrairNumeroFranquiaDoTitulo(titulo);
  let orfaoQuery = db
    .from('kanban_cards')
    .select('id')
    .eq('kanban_id', kanbanId)
    .is('rede_franqueado_id', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (fkNum) {
    orfaoQuery = orfaoQuery.ilike('titulo', `${fkNum}%`);
  } else {
    orfaoQuery = orfaoQuery.eq('franqueado_id', franqueadoUserId);
  }

  const { data: orfaos, error: errOrfao } = await orfaoQuery;

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
    await vincularProcessoAoCardSeNecessario(db, orfaoId, vincularParams);
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

  const cardId = String(inserido.id);

  await vincularProcessoAoCardSeNecessario(db, cardId, vincularParams);

  if (inserido.rede_franqueado_id == null) {
    return {
      ok: false,
      error: 'Card criado mas rede_franqueado_id permaneceu null (verifique triggers/coluna).',
    };
  }

  return {
    ok: true,
    created: true,
    cardId,
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
 * Auto-cura silenciosa: cria cards ausentes ao carregar o Funil Step One (staff).
 * Idempotente — só executa backfill quando há rede sem card.
 */
export async function autoCurarCardsFunilStepOneAusentes(fallbackUserId: string): Promise<void> {
  const count = await contarRedeSemCardFunilStepOne();
  if (!count.ok || count.total === 0) return;

  const res = await garantirCardsFunilStepOneParaTodaRede(fallbackUserId);
  if (!res.ok) {
    console.error('[autoCurarCardsFunilStepOneAusentes]', res.error);
    return;
  }
  if (res.criados > 0 || res.reparados > 0) {
    console.info(
      `[autoCurarCardsFunilStepOneAusentes] criados=${res.criados} reparados=${res.reparados}`,
    );
  }
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
      processoStepOneId: redeRow.processo_id,
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
