'use server';

import { revalidatePath } from 'next/cache';
import { moverCardParaFase, type ActionResult } from '@/lib/actions/card-actions';
import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  configTrancheVinculo,
  indiceTrancheValido,
  OPERACOES_TRANCHE_VINCULOS,
  type TrancheVinculoIndex,
} from '@/lib/operacoes/tranche-vinculos-config';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type TrancheVinculoRow = {
  tranche_index: TrancheVinculoIndex;
  pct_fisico_financeiro: number | null;
  nfts_url: string | null;
  evidencias_url: string | null;
  concluido_em: string | null;
};

export type TrancheVinculoListItem = {
  index: TrancheVinculoIndex;
  nome: string;
  status: 'pendente' | 'concluido';
  pct_fisico_financeiro: number | null;
  nfts_url: string | null;
  evidencias_url: string | null;
  concluido_em: string | null;
  filhoCreditoObraId: string | null;
  filhoFaseSlug: string | null;
  filhoFaseNome: string | null;
};

async function perfilEhAdminOuTeam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
  const role = String((profile as { role?: string } | null)?.role ?? '').toLowerCase();
  return role === 'admin' || role === 'team';
}

async function resolverFilhoCreditoObra(
  supabase: Awaited<ReturnType<typeof createClient>>,
  operacoesCardId: string,
): Promise<{
  id: string;
  faseSlug: string;
  faseNome: string;
} | null> {
  const { data, error } = await supabase
    .from('kanban_cards')
    .select('id, kanban_fases ( slug, nome )')
    .eq('origem_card_id', operacoesCardId)
    .eq('kanban_id', KANBAN_IDS.CREDITO_OBRA)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;

  const faseEmbed = (data as { kanban_fases?: { slug?: string; nome?: string } | { slug?: string; nome?: string }[] | null })
    .kanban_fases;
  const faseNode = Array.isArray(faseEmbed) ? faseEmbed[0] : faseEmbed;

  return {
    id: String(data.id),
    faseSlug: String(faseNode?.slug ?? '').trim(),
    faseNome: String(faseNode?.nome ?? '').trim() || '—',
  };
}

async function resolverFaseIdCreditoObra(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.CREDITO_OBRA)
    .eq('slug', slug)
    .eq('ativo', true)
    .maybeSingle();

  if (error || !data?.id) return null;
  return String(data.id);
}

function mapRow(row: Record<string, unknown>): TrancheVinculoRow {
  const pctRaw = row.pct_fisico_financeiro;
  let pct: number | null = null;
  if (pctRaw != null && pctRaw !== '') {
    const n = Number(pctRaw);
    if (!Number.isNaN(n) && Number.isFinite(n)) pct = n;
  }
  return {
    tranche_index: Number(row.tranche_index) as TrancheVinculoIndex,
    pct_fisico_financeiro: pct,
    nfts_url: row.nfts_url != null ? String(row.nfts_url) : null,
    evidencias_url: row.evidencias_url != null ? String(row.evidencias_url) : null,
    concluido_em: row.concluido_em != null ? String(row.concluido_em) : null,
  };
}

/** Lista os 5 vínculos preset com status e dados salvos. */
export async function listarTrancheVinculosOperacoes(
  operacoesCardId: string,
): Promise<{ ok: true; items: TrancheVinculoListItem[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cid = String(operacoesCardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const cardOk = await resolverOperacoesCard(supabase, cid);
  if (!cardOk.ok) return cardOk;

  const { data: rows, error: rowsErr } = await supabase
    .from('kanban_operacoes_tranche_vinculos')
    .select('tranche_index, pct_fisico_financeiro, nfts_url, evidencias_url, concluido_em')
    .eq('operacoes_card_id', cid);

  if (rowsErr) return { ok: false, error: rowsErr.message };

  const porIndex = new Map<number, TrancheVinculoRow>();
  for (const r of rows ?? []) {
    const mapped = mapRow(r as Record<string, unknown>);
    porIndex.set(mapped.tranche_index, mapped);
  }

  const filho = await resolverFilhoCreditoObra(supabase, cid);

  const items: TrancheVinculoListItem[] = OPERACOES_TRANCHE_VINCULOS.map((cfg) => {
    const saved = porIndex.get(cfg.index);
    return {
      index: cfg.index,
      nome: cfg.nome,
      status: saved?.concluido_em ? 'concluido' : 'pendente',
      pct_fisico_financeiro: saved?.pct_fisico_financeiro ?? null,
      nfts_url: saved?.nfts_url ?? null,
      evidencias_url: saved?.evidencias_url ?? null,
      concluido_em: saved?.concluido_em ?? null,
      filhoCreditoObraId: filho?.id ?? null,
      filhoFaseSlug: filho?.faseSlug ?? null,
      filhoFaseNome: filho?.faseNome ?? null,
    };
  });

  return { ok: true, items };
}

function normalizarPct(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

function normalizarUrl(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim();
  return s || null;
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
      return { ok: false, error: 'Disponível apenas no Funil Operações.' };
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
    return { ok: false, error: 'Disponível apenas no Funil Operações.' };
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

/** Salva rascunho dos campos sem concluir o vínculo. */
export async function salvarTrancheVinculoOperacoes(input: {
  operacoesCardId: string;
  trancheIndex: number;
  pct_fisico_financeiro: number | string | null;
  nfts_url: string | null;
  evidencias_url: string | null;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const pode = await perfilEhAdminOuTeam(supabase, user.id);
  if (!pode) return { ok: false, error: 'Sem permissão para editar vínculos.' };

  const cid = String(input.operacoesCardId ?? '').trim();
  const idx = Number(input.trancheIndex);
  if (!cid || !indiceTrancheValido(idx)) return { ok: false, error: 'Dados inválidos.' };

  const cardOk = await validarCardOperacoes(supabase, cid, { garantirShadowLegado: true });
  if (!cardOk.ok) return cardOk;

  const pct = normalizarPct(input.pct_fisico_financeiro);
  const patch = {
    operacoes_card_id: cardOk.cardId,
    tranche_index: idx,
    pct_fisico_financeiro: pct,
    nfts_url: normalizarUrl(input.nfts_url),
    evidencias_url: normalizarUrl(input.evidencias_url),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('kanban_operacoes_tranche_vinculos')
    .upsert(patch as never, { onConflict: 'operacoes_card_id,tranche_index' });

  if (error) return { ok: false, error: error.message };

  revalidatePath(input.basePath?.trim() || '/operacoes');
  return { ok: true };
}

/** Persiste dados e move o card filho Crédito Obra para a fase de destino da tranche. */
export async function concluirTrancheVinculoOperacoes(input: {
  operacoesCardId: string;
  trancheIndex: number;
  pct_fisico_financeiro: number | string | null;
  nfts_url: string | null;
  evidencias_url: string | null;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const pode = await perfilEhAdminOuTeam(supabase, user.id);
  if (!pode) return { ok: false, error: 'Sem permissão para concluir vínculos.' };

  const cid = String(input.operacoesCardId ?? '').trim();
  const idx = Number(input.trancheIndex);
  if (!cid || !indiceTrancheValido(idx)) return { ok: false, error: 'Dados inválidos.' };

  const cfg = configTrancheVinculo(idx);
  if (!cfg) return { ok: false, error: 'Vínculo inválido.' };

  const cardOk = await validarCardOperacoes(supabase, cid, { garantirShadowLegado: true });
  if (!cardOk.ok) return cardOk;

  const operacoesId = cardOk.cardId;

  const { data: existente } = await supabase
    .from('kanban_operacoes_tranche_vinculos')
    .select('concluido_em')
    .eq('operacoes_card_id', operacoesId)
    .eq('tranche_index', idx)
    .maybeSingle();

  if ((existente as { concluido_em?: string | null } | null)?.concluido_em) {
    return { ok: false, error: 'Este vínculo já foi concluído.' };
  }

  const pct = normalizarPct(input.pct_fisico_financeiro);
  const nfts = normalizarUrl(input.nfts_url);
  const evidencias = normalizarUrl(input.evidencias_url);

  if (pct == null) return { ok: false, error: 'Informe o % físico financeiro (0–100).' };
  if (!nfts) return { ok: false, error: 'Informe o link das NFs.' };
  if (!evidencias) return { ok: false, error: 'Informe o link de evidências/fotos da obra.' };

  const filho = await resolverFilhoCreditoObra(supabase, operacoesId);
  if (!filho) {
    return {
      ok: false,
      error: 'Não há card filho no Funil Crédito Obra vinculado a este card de Operações.',
    };
  }

  const faseDestinoId = await resolverFaseIdCreditoObra(supabase, cfg.faseDestinoSlug);
  if (!faseDestinoId) {
    return { ok: false, error: `Fase de destino "${cfg.faseDestinoLabel}" não encontrada no funil.` };
  }

  const now = new Date().toISOString();
  const { error: upsertErr } = await supabase.from('kanban_operacoes_tranche_vinculos').upsert(
    {
      operacoes_card_id: operacoesId,
      tranche_index: idx,
      pct_fisico_financeiro: pct,
      nfts_url: nfts,
      evidencias_url: evidencias,
      concluido_em: now,
      concluido_por: user.id,
      updated_at: now,
    } as never,
    { onConflict: 'operacoes_card_id,tranche_index' },
  );

  if (upsertErr) return { ok: false, error: upsertErr.message };

  const jaNaFaseDestino = filho.faseSlug === cfg.faseDestinoSlug;

  if (!jaNaFaseDestino) {
    const moveRes = await moverCardParaFase({
      cardId: filho.id,
      novaFaseId: faseDestinoId,
      basePath: '/funil-credito-obra',
      kanbanNome: 'Funil Crédito Obra',
    });

    if (!moveRes.ok) {
      await supabase
        .from('kanban_operacoes_tranche_vinculos')
        .update({ concluido_em: null, concluido_por: null, updated_at: now } as never)
        .eq('operacoes_card_id', operacoesId)
        .eq('tranche_index', idx);

      return {
        ok: false,
        error: moveRes.error ?? 'Não foi possível mover o card Crédito Obra.',
      };
    }
  }

  revalidatePath(input.basePath?.trim() || '/operacoes');
  revalidatePath('/funil-credito-obra');
  return { ok: true };
}

/** Slugs usados nos testes / documentação. */
export const TRANCHE_VINCULO_SLUGS_REF = {
  destino: OPERACOES_TRANCHE_VINCULOS.map((v) => v.faseDestinoSlug),
  creditoObraKanban: KANBAN_IDS.CREDITO_OBRA,
  documentacaoAlvara: FASE_SLUGS.CO_DOCUMENTACAO_ALVARA,
} as const;
