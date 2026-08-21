'use server';

import { revalidatePath } from 'next/cache';
import { type ActionResult } from '@/lib/actions/card-actions';
import { criarCardFilho } from '@/lib/actions/kanban-bastoes';
import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  configTrancheVinculo,
  faseOperacoesPresumePrimeiraTrancheCo,
  indiceTrancheValido,
  OPERACOES_TRANCHE_VINCULOS,
  rolePodeAbrirTrancheVinculosOperacoes,
  type TrancheVinculoIndex,
} from '@/lib/operacoes/tranche-vinculos-config';
import { createAdminClient, tryCreateAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { listarKanbanCardIdsSyncGroup } from '@/lib/kanban/card-sync-group';

export type TrancheVinculoRow = {
  tranche_index: TrancheVinculoIndex;
  concluido_em: string | null;
  credito_obra_card_id: string | null;
};

export type TrancheVinculoListItem = {
  index: TrancheVinculoIndex;
  nome: string;
  tagLabel: string;
  status: 'pendente' | 'concluido';
  concluido_em: string | null;
  filhoCreditoObraId: string | null;
};

function mapRow(row: Record<string, unknown>): TrancheVinculoRow {
  return {
    tranche_index: Number(row.tranche_index) as TrancheVinculoIndex,
    concluido_em: row.concluido_em != null ? String(row.concluido_em) : null,
    credito_obra_card_id:
      row.credito_obra_card_id != null ? String(row.credito_obra_card_id).trim() || null : null,
  };
}

function montarItensTrancheVinculo(porIndex: Map<number, TrancheVinculoRow>): TrancheVinculoListItem[] {
  return OPERACOES_TRANCHE_VINCULOS.map((cfg) => {
    const saved = porIndex.get(cfg.index);
    const filhoId = saved?.credito_obra_card_id ?? null;
    const concluido = Boolean(saved?.concluido_em || filhoId);
    return {
      index: cfg.index,
      nome: cfg.nome,
      tagLabel: cfg.tagLabel,
      status: concluido ? 'concluido' : 'pendente',
      concluido_em: saved?.concluido_em ?? null,
      filhoCreditoObraId: filhoId,
    };
  });
}

function erroTabelaTrancheVinculosAusente(err: { code?: string; message?: string }): boolean {
  const code = String(err.code ?? '').trim();
  const msg = String(err.message ?? '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('kanban_operacoes_tranche_vinculos') ||
    msg.includes('schema cache')
  );
}

function erroConsultaTrancheVinculosIgnoravel(err: { code?: string; message?: string }): boolean {
  if (erroTabelaTrancheVinculosAusente(err)) return true;
  const code = String(err.code ?? '').trim();
  const msg = String(err.message ?? '').toLowerCase();
  return (
    code === '42501' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security policy')
  );
}

function erroUpsertSemUniqueConstraint(err: { message?: string } | null): boolean {
  const msg = String(err?.message ?? '').toLowerCase();
  return msg.includes('no unique or exclusion constraint');
}

type TrancheVinculoPatch = {
  operacoes_card_id: string;
  tranche_index: TrancheVinculoIndex;
  concluido_em: string;
  concluido_por: string;
  credito_obra_card_id: string;
  updated_at: string;
};

type TrancheVinculosDbClient =
  | ReturnType<typeof createAdminClient>
  | Awaited<ReturnType<typeof createClient>>;

function montarDbClientsTrancheVinculos(
  supabase: Awaited<ReturnType<typeof createClient>>,
): TrancheVinculosDbClient[] {
  const dbClients: TrancheVinculosDbClient[] = [];
  const admin = tryCreateAdminClient();
  if (admin) dbClients.push(admin);
  dbClients.push(supabase);
  return dbClients;
}

/** SELECT em kanban_operacoes_tranche_vinculos com fallback service role (como salvar). */
async function consultarTrancheVinculosSalvos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  operacoesCardId: string,
  options?: { trancheIndex?: TrancheVinculoIndex },
): Promise<
  | { ok: true; rows: TrancheVinculoRow[] }
  | { ok: false; error: string; ignoravel: boolean }
> {
  const cid = String(operacoesCardId ?? '').trim();
  let lastErr: { code?: string; message?: string } | null = null;

  for (const db of montarDbClientsTrancheVinculos(supabase)) {
    let query = db
      .from('kanban_operacoes_tranche_vinculos')
      .select('tranche_index, concluido_em, credito_obra_card_id')
      .eq('operacoes_card_id', cid);

    if (options?.trancheIndex != null) {
      query = query.eq('tranche_index', options.trancheIndex);
    }

    const { data: rows, error: rowsErr } = await query;
    if (!rowsErr) {
      const mapped = (rows ?? []).map((r) => mapRow(r as Record<string, unknown>));
      return { ok: true, rows: mapped };
    }

    lastErr = rowsErr;
    if (erroConsultaTrancheVinculosIgnoravel(rowsErr)) continue;
    return { ok: false, error: rowsErr.message, ignoravel: false };
  }

  if (lastErr && erroConsultaTrancheVinculosIgnoravel(lastErr)) {
    return { ok: true, rows: [] };
  }

  return {
    ok: false,
    error: lastErr?.message || 'Não foi possível carregar vínculos de tranche.',
    ignoravel: Boolean(lastErr && erroConsultaTrancheVinculosIgnoravel(lastErr)),
  };
}

/** Persiste vínculo de tranche; upsert com fallback insert/update se UNIQUE ainda não existir. */
async function salvarTrancheVinculoOperacoes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patch: TrancheVinculoPatch,
): Promise<{ error: string | null }> {
  let lastErr: string | null = null;

  for (const db of montarDbClientsTrancheVinculos(supabase)) {
    const { error: upsertError } = await db
      .from('kanban_operacoes_tranche_vinculos')
      .upsert(patch as never, { onConflict: 'operacoes_card_id,tranche_index' });

    if (!upsertError) return { error: null };

    if (erroUpsertSemUniqueConstraint(upsertError)) {
      const { data: existing } = await db
        .from('kanban_operacoes_tranche_vinculos')
        .select('id')
        .eq('operacoes_card_id', patch.operacoes_card_id)
        .eq('tranche_index', patch.tranche_index)
        .maybeSingle();

      if ((existing as { id?: string } | null)?.id) {
        const { error: updateError } = await db
          .from('kanban_operacoes_tranche_vinculos')
          .update(patch as never)
          .eq('id', String((existing as { id: string }).id));
        if (!updateError) return { error: null };
        lastErr = updateError.message;
        if (erroConsultaTrancheVinculosIgnoravel(updateError)) continue;
        return { error: updateError.message };
      }

      const { error: insertError } = await db
        .from('kanban_operacoes_tranche_vinculos')
        .insert(patch as never);
      if (!insertError) return { error: null };
      lastErr = insertError.message;
      if (erroConsultaTrancheVinculosIgnoravel(insertError)) continue;
      return { error: insertError.message };
    }

    lastErr = upsertError.message;
    if (erroConsultaTrancheVinculosIgnoravel(upsertError)) continue;
    return { error: upsertError.message };
  }

  return { error: lastErr || 'Não foi possível salvar o vínculo de tranche.' };
}

async function resolverFaseSlugPorFaseId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  faseId: string | null | undefined,
): Promise<string | null> {
  const fid = String(faseId ?? '').trim();
  if (!fid) return null;
  const { data: faseRow } = await supabase.from('kanban_fases').select('slug').eq('id', fid).maybeSingle();
  return String((faseRow as { slug?: string | null } | null)?.slug ?? '').trim() || null;
}

async function resolverFaseSlugOperacoesCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  operacoesCardId: string,
): Promise<string | null> {
  const cid = String(operacoesCardId ?? '').trim();
  if (!cid) return null;

  const { data: card, error: cardErr } = await supabase
    .from('kanban_cards')
    .select('fase_id')
    .eq('id', cid)
    .maybeSingle();

  if (!cardErr && card) {
    const slug = await resolverFaseSlugPorFaseId(
      supabase,
      (card as { fase_id?: string | null }).fase_id,
    );
    if (slug) return slug;
  }

  const { data: vLeg } = await supabase
    .from('v_processo_como_kanban_cards')
    .select('fase_id')
    .eq('id', cid)
    .maybeSingle();

  return resolverFaseSlugPorFaseId(
    supabase,
    (vLeg as { fase_id?: string | null } | null)?.fase_id,
  );
}

async function resolverFilhoCreditoObraExiste(
  supabase: Awaited<ReturnType<typeof createClient>>,
  operacoesCardId: string,
): Promise<boolean> {
  const cid = String(operacoesCardId ?? '').trim();
  if (!cid) return false;

  const readers: TrancheVinculosDbClient[] = [];
  const admin = tryCreateAdminClient();
  if (admin) readers.push(admin);
  readers.push(supabase);

  for (const db of readers) {
    const { data: direct, error: directErr } = await db
      .from('kanban_cards')
      .select('id')
      .eq('origem_card_id', cid)
      .eq('kanban_id', KANBAN_IDS.CREDITO_OBRA)
      .eq('arquivado', false)
      .limit(1)
      .maybeSingle();

    if (!directErr && direct?.id) return true;
    if (directErr && !erroConsultaTrancheVinculosIgnoravel(directErr)) continue;
  }

  const consultaIds = await listarKanbanCardIdsSyncGroup(supabase, cid);
  for (const db of readers) {
    const { data: filhos, error: rpcErr } = await db.rpc('kanban_filhos_paralelas_por_pais', {
      p_pai_ids: consultaIds.length > 0 ? consultaIds : [cid],
    });

    if (rpcErr) {
      if (erroConsultaTrancheVinculosIgnoravel(rpcErr)) continue;
      return false;
    }

    const achou = (filhos ?? []).some((row: unknown) => {
      const kid = String((row as { filho_kanban_id?: string | null }).filho_kanban_id ?? '').trim();
      const arquivado = Boolean((row as { arquivado?: boolean | null }).arquivado);
      return kid === KANBAN_IDS.CREDITO_OBRA && !arquivado;
    });
    if (achou) return true;
  }

  return false;
}

async function resolverPrimeiroCardCreditoObraDisponivel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  operacoesCardId: string,
): Promise<boolean> {
  const faseSlug = await resolverFaseSlugOperacoesCard(supabase, operacoesCardId);
  if (faseOperacoesPresumePrimeiraTrancheCo(faseSlug)) return true;
  return resolverFilhoCreditoObraExiste(supabase, operacoesCardId);
}

/** Lista os vínculos 2ª–6ª tranche com status. */
export async function listarTrancheVinculosOperacoes(
  operacoesCardId: string,
): Promise<
  | { ok: true; items: TrancheVinculoListItem[]; temPrimeiroCardCreditoObra: boolean }
  | { ok: false; error: string }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Faça login.' };

    const cid = String(operacoesCardId ?? '').trim();
    if (!cid) return { ok: false, error: 'Card inválido.' };

    const cardOk = await resolverOperacoesCard(supabase, cid);
    if (!cardOk.ok) return cardOk;

    const temPrimeiroCard = await resolverPrimeiroCardCreditoObraDisponivel(supabase, cid);

    const consulta = await consultarTrancheVinculosSalvos(supabase, cid);
    if (!consulta.ok) {
      if (consulta.ignoravel) {
        return {
          ok: true,
          items: montarItensTrancheVinculo(new Map()),
          temPrimeiroCardCreditoObra: temPrimeiroCard,
        };
      }
      return { ok: false, error: consulta.error };
    }

    const porIndex = new Map<number, TrancheVinculoRow>();
    for (const mapped of consulta.rows) {
      porIndex.set(mapped.tranche_index, mapped);
    }

    return {
      ok: true,
      items: montarItensTrancheVinculo(porIndex),
      temPrimeiroCardCreditoObra: temPrimeiroCard,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || 'Erro ao carregar vínculos.' };
  }
}

type LegadoOperacoesMeta = {
  id: string;
  kanban_id: string;
  fase_id: string;
  titulo: string | null;
  responsavel_id: string;
};

type OperacoesCardResolvido = {
  cardId: string;
  origem: 'nativo' | 'legado';
  legadoMeta?: LegadoOperacoesMeta;
};

async function resolverOperacoesCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  operacoesCardId: string,
): Promise<{ ok: true; card: OperacoesCardResolvido } | { ok: false; error: string }> {
  const cid = String(operacoesCardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const { data: card, error } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id')
    .eq('id', cid)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (card?.id) {
    if (String(card.kanban_id ?? '') !== KANBAN_IDS.OPERACOES) {
      return { ok: false, error: 'Disponível apenas no Funil Pré Obra e Obra.' };
    }
    return { ok: true, card: { cardId: String(card.id), origem: 'nativo' } };
  }

  const { data: vLeg, error: vErr } = await supabase
    .from('v_processo_como_kanban_cards')
    .select('id, kanban_id, fase_id, titulo, responsavel_id')
    .eq('id', cid)
    .maybeSingle();

  if (vErr) return { ok: false, error: vErr.message };
  if (!vLeg?.id) return { ok: false, error: 'Card não encontrado.' };

  const kid = String((vLeg as { kanban_id?: string | null }).kanban_id ?? '').trim();
  if (kid !== KANBAN_IDS.OPERACOES) {
    return { ok: false, error: 'Disponível apenas no Funil Pré Obra e Obra.' };
  }

  const fid = String((vLeg as { fase_id?: string | null }).fase_id ?? '').trim();
  const franq = String((vLeg as { responsavel_id?: string | null }).responsavel_id ?? '').trim();
  if (!fid || !franq) {
    return { ok: false, error: 'Dados incompletos do processo (fase/franqueado).' };
  }

  return {
    ok: true,
    card: {
      cardId: cid,
      origem: 'legado',
      legadoMeta: {
        id: cid,
        kanban_id: kid,
        fase_id: fid,
        titulo: (vLeg as { titulo?: string | null }).titulo ?? null,
        responsavel_id: franq,
      },
    },
  };
}

async function garantirShadowKanbanCardLegado(meta: LegadoOperacoesMeta): Promise<ActionResult> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Serviço indisponível: ${msg}` };
  }

  const { data: existing } = await admin.from('kanban_cards').select('id').eq('id', meta.id).maybeSingle();
  if (existing?.id) return { ok: true };

  const { error } = await admin.from('kanban_cards').insert({
    id: meta.id,
    kanban_id: meta.kanban_id,
    fase_id: meta.fase_id,
    franqueado_id: meta.responsavel_id,
    titulo: String(meta.titulo ?? '').trim() || 'Sem título',
    status: 'ativo',
    concluido: false,
  } as never);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function validarCardOperacoes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  operacoesCardId: string,
  options?: { garantirShadowLegado?: boolean },
): Promise<{ ok: false; error: string } | (OperacoesCardResolvido & { ok: true })> {
  const resolved = await resolverOperacoesCard(supabase, operacoesCardId);
  if (!resolved.ok) return resolved;

  if (resolved.card.origem === 'legado' && options?.garantirShadowLegado && resolved.card.legadoMeta) {
    const shadow = await garantirShadowKanbanCardLegado(resolved.card.legadoMeta);
    if (!shadow.ok) return shadow;
  }

  return { ok: true, ...resolved.card };
}

/** Cria card filho no Crédito Obra com tag da tranche (2ª–6ª) e registra o vínculo. */
export async function abrirTrancheVinculoOperacoes(input: {
  operacoesCardId: string;
  trancheIndex: number;
  basePath?: string;
}): Promise<ActionResult & { creditoObraCardId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const pode = await perfilPodeAbrirTrancheOperacoes(supabase, user.id);
  if (!pode) return { ok: false, error: 'Sem permissão para abrir tranches.' };

  const cid = String(input.operacoesCardId ?? '').trim();
  const idx = Number(input.trancheIndex);
  if (!cid || !indiceTrancheValido(idx)) return { ok: false, error: 'Dados inválidos.' };

  const cfg = configTrancheVinculo(idx);
  if (!cfg) return { ok: false, error: 'Vínculo inválido.' };

  const cardOk = await validarCardOperacoes(supabase, cid, { garantirShadowLegado: true });
  if (!cardOk.ok) return cardOk;

  const operacoesId = cardOk.cardId;

  const consultaExistente = await consultarTrancheVinculosSalvos(supabase, operacoesId, {
    trancheIndex: idx,
  });
  if (!consultaExistente.ok) {
    return { ok: false, error: consultaExistente.error };
  }

  const row = consultaExistente.rows[0] ?? null;
  if (row?.concluido_em || row?.credito_obra_card_id) {
    return { ok: false, error: 'Este vínculo já foi concluído.' };
  }

  const temPrimeiroCard = await resolverPrimeiroCardCreditoObraDisponivel(supabase, operacoesId);
  if (!temPrimeiroCard) {
    return {
      ok: false,
      error:
        'Abra o primeiro card no Funil Crédito Obra (1ª tranche) antes de solicitar tranches adicionais.',
    };
  }

  const paiRes = await buscarCardOperacoesPai(supabase, operacoesId);
  if (!paiRes.ok) return paiRes;
  const paiRow = paiRes.row;

  const faseOrigemSlug =
    (await resolverFaseSlugPorFaseId(supabase, paiRow.fase_id)) || 'operacoes';

  let novoFilhoId: string;
  try {
    const criado = await criarCardFilho({
      cardPaiId: operacoesId,
      kanbanDestinoId: KANBAN_IDS.CREDITO_OBRA,
      faseDestinoSlug: cfg.faseDestinoSlug,
      titulo: String(paiRow.titulo ?? '').trim() || 'Card',
      projetoId: String(paiRow.projeto_id ?? '').trim() || null,
      redeFranqueadoId: String(paiRow.rede_franqueado_id ?? '').trim() || null,
      kanbanOrigemSlug: 'operacoes',
      faseOrigemSlug,
      creditoObraTranche: cfg.tagTranche,
    });

    if (!criado?.id) {
      return { ok: false, error: 'Não foi possível criar o card no Funil Crédito Obra.' };
    }
    novoFilhoId = String(criado.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || 'Erro ao criar card Crédito Obra.' };
  }

  const now = new Date().toISOString();
  const patchVinculo = {
    operacoes_card_id: operacoesId,
    tranche_index: idx,
    concluido_em: now,
    concluido_por: user.id,
    credito_obra_card_id: novoFilhoId,
    updated_at: now,
  };

  const { error: salvarErr } = await salvarTrancheVinculoOperacoes(supabase, patchVinculo);
  if (salvarErr) return { ok: false, error: salvarErr };

  revalidatePath(input.basePath?.trim() || '/operacoes');
  revalidatePath('/funil-credito-obra');
  return { ok: true, creditoObraCardId: novoFilhoId };
}

async function perfilPodeAbrirTrancheOperacoes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
  return rolePodeAbrirTrancheVinculosOperacoes(
    (profile as { role?: string } | null)?.role ?? '',
  );
}

async function buscarCardOperacoesPai(
  supabase: Awaited<ReturnType<typeof createClient>>,
  operacoesId: string,
): Promise<
  | {
      ok: true;
      row: {
        id: string;
        titulo: string | null;
        projeto_id: string | null;
        rede_franqueado_id: string | null;
        fase_id: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const selectPai = async (
    db: TrancheVinculosDbClient,
  ) =>
    db
      .from('kanban_cards')
      .select('id, titulo, projeto_id, rede_franqueado_id, fase_id')
      .eq('id', operacoesId)
      .maybeSingle();

  for (const db of montarDbClientsTrancheVinculos(supabase)) {
    const { data: paiRow, error: errPai } = await selectPai(db);
    if (!errPai && paiRow?.id) {
      return { ok: true, row: paiRow as typeof paiRow & { id: string } };
    }
    if (errPai && !erroConsultaTrancheVinculosIgnoravel(errPai)) {
      return { ok: false, error: errPai.message };
    }
  }

  return { ok: false, error: 'Card de Operações não encontrado.' };
}

/** Slugs usados nos testes / documentação. */
export const TRANCHE_VINCULO_SLUGS_REF = {
  destino: OPERACOES_TRANCHE_VINCULOS.map((v) => v.faseDestinoSlug),
  creditoObraKanban: KANBAN_IDS.CREDITO_OBRA,
  documentacaoAlvara: FASE_SLUGS.CO_DOCUMENTACAO_ALVARA,
} as const;
