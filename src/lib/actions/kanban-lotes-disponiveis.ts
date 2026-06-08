'use server';

import { revalidatePath } from 'next/cache';
import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { carregarProspectsCondominioCard } from '@/lib/actions/kanban-condominio-pesquisa';
import {
  atualizarLinhaNaTabelaMultiPraca,
  CHECKLIST_LABEL_CIDADE,
  CHECKLIST_LABEL_ESTADO,
  inferirChaveLegadoPraca,
  parseLinhasTabelaTodasPracas,
  type PracaCidade,
} from '@/lib/kanban/dados-cidade-praca-multi';
import {
  atualizarLotesPreenchidosEm,
  loteDisponivelParaAtributosBoolean,
  normalizarLinhaLote,
  todasSessoesLotesCompletas,
  type LinhaLoteDisponivel,
} from '@/lib/kanban/lotes-disponiveis-condominio';
import { normalizarLinhaProspect, type LinhaProspectCondominio } from '@/lib/kanban/condominio-prospect-pesquisa';
import { parseDecimalInput } from '@/lib/condominios';
import type { CondominioLotePatch } from '@/lib/condominios-lotes';
import { parseAreaAtuacao } from '@/lib/rede-area-atuacao';
import { createClient } from '@/lib/supabase/server';

export type KanbanLotesDisponiveisResult = { ok: true } | { ok: false; error: string };

const LABEL_LOTES = 'Lotes por condomínio prospectado';

const DADOS_CIDADE_SLUGS = [FASE_SLUGS.DADOS_CIDADE, 'stepone_dados_cidade'] as const;
const LOTES_SLUGS = [FASE_SLUGS.LOTES_DISPONIVEIS, 'stepone_lotes'] as const;

async function buscarFaseIdPorSlugs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kanbanId: string,
  slugs: readonly string[],
): Promise<string | null> {
  const { data } = await supabase.from('kanban_fases').select('id, slug').eq('kanban_id', kanbanId).in('slug', [...slugs]);
  if (!data?.length) return null;
  for (const slug of slugs) {
    const hit = (data as { id: string; slug: string }[]).find((f) => f.slug === slug);
    if (hit) return hit.id;
  }
  return (data[0] as { id: string }).id;
}

async function buscarItemPorLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  faseId: string,
  label: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id')
    .eq('fase_id', faseId)
    .eq('label', label)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

async function buscarValorChecklist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  cardId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('valor')
    .eq('item_id', itemId)
    .eq('card_id', cardId)
    .maybeSingle();
  return (data as { valor?: string | null } | null)?.valor ?? null;
}

async function upsertChecklistValor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  cardId: string,
  valor: string | null,
  userId: string,
): Promise<KanbanLotesDisponiveisResult> {
  const { error } = await supabase.from('kanban_fase_checklist_respostas').upsert(
    {
      item_id: itemId,
      card_id: cardId,
      valor,
      preenchido_por: userId,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: 'item_id,card_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function buscarContextoPracaCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
  faseCidadeId: string,
): Promise<{ areas: PracaCidade[]; chaveLegado: string | null }> {
  const { data: cardRow } = await supabase
    .from('kanban_cards')
    .select('rede_franqueado_id')
    .eq('id', cardId)
    .maybeSingle();

  let areaAtuacao: string | null = null;
  const redeId = String((cardRow as { rede_franqueado_id?: string | null } | null)?.rede_franqueado_id ?? '').trim();
  if (redeId) {
    const { data: redeRow } = await supabase
      .from('rede_franqueados')
      .select('area_atuacao')
      .eq('id', redeId)
      .maybeSingle();
    areaAtuacao = (redeRow as { area_atuacao?: string | null } | null)?.area_atuacao ?? null;
  }

  const areas = parseAreaAtuacao(areaAtuacao);
  const cidadeItemId = await buscarItemPorLabel(supabase, faseCidadeId, CHECKLIST_LABEL_CIDADE);
  const estadoItemId = await buscarItemPorLabel(supabase, faseCidadeId, CHECKLIST_LABEL_ESTADO);
  const cidadeVal = cidadeItemId ? ((await buscarValorChecklist(supabase, cidadeItemId, cardId)) ?? '') : '';
  const estadoVal = estadoItemId ? ((await buscarValorChecklist(supabase, estadoItemId, cardId)) ?? '') : '';

  return { areas, chaveLegado: inferirChaveLegadoPraca(areas, cidadeVal, estadoVal) };
}

function parseNumero(valor: string | null | undefined): number | null {
  const t = String(valor ?? '').trim();
  if (!t) return null;
  return parseDecimalInput(t) ?? (Number.isFinite(Number(t)) ? Number(t) : null);
}

async function sincronizarLotesComCadastro(
  supabase: Awaited<ReturnType<typeof createClient>>,
  condominioId: string,
  lotes: LinhaLoteDisponivel[],
  userId: string,
): Promise<LinhaLoteDisponivel[]> {
  const atualizados = lotes.map((l) => ({ ...l }));

  for (const lote of atualizados) {
    const quadra = lote.quadra.trim() || null;
    const loteNum = lote.lote.trim() || null;
    if (!quadra && !loteNum) continue;

    const patch: CondominioLotePatch = {
      condominio_id: condominioId,
      quadra,
      lote: loteNum,
      area_m2: parseNumero(lote.area_m2),
      valor: parseNumero(lote.valor),
      situacao_documental: lote.situacao_documental.trim() || null,
      fotos_path: lote.fotos_path.trim() || null,
      observacoes: lote.observacoes.trim() || null,
      kanban_card_id: null,
      ...loteDisponivelParaAtributosBoolean(lote),
    };

    const row = { ...patch, updated_at: new Date().toISOString(), criado_por: userId };

    if (lote.cadastro_lote_id) {
      await supabase.from('condominios_lotes').update(row as never).eq('id', lote.cadastro_lote_id);
      continue;
    }

    const { data: existente } = await supabase
      .from('condominios_lotes')
      .select('id')
      .eq('condominio_id', condominioId)
      .eq('quadra', quadra ?? '')
      .eq('lote', loteNum ?? '')
      .maybeSingle();

    if (existente?.id) {
      await supabase.from('condominios_lotes').update(row as never).eq('id', existente.id);
      lote.cadastro_lote_id = existente.id as string;
    } else {
      const { data: inserted } = await supabase
        .from('condominios_lotes')
        .insert(row as never)
        .select('id')
        .maybeSingle();
      if (inserted?.id) lote.cadastro_lote_id = inserted.id as string;
    }
  }

  return atualizados;
}

type ContextoSalvar =
  | { ok: false; error: string }
  | {
      ok: true;
      userId: string;
      tabelaItemId: string;
      lotesItemId: string | null;
      valorRaw: string | null;
      ctx: { areas: PracaCidade[]; chaveLegado: string | null };
      linhas: LinhaProspectCondominio[];
    };

async function carregarContextoSalvar(cardId: string): Promise<ContextoSalvar> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const loaded = await carregarProspectsCondominioCard(cardId);
  if (!loaded.ok) return loaded;

  const { data: cardRow } = await supabase.from('kanban_cards').select('kanban_id').eq('id', cardId).maybeSingle();
  const kanbanId = String((cardRow as { kanban_id?: string } | null)?.kanban_id ?? '').trim() || KANBAN_IDS.STEP_ONE;

  const faseLotesId = await buscarFaseIdPorSlugs(supabase, kanbanId, LOTES_SLUGS);
  const lotesItemId = faseLotesId ? await buscarItemPorLabel(supabase, faseLotesId, LABEL_LOTES) : null;

  const valorRaw = await buscarValorChecklist(supabase, loaded.tabelaItemId!, cardId);

  const faseCidadeId = await buscarFaseIdPorSlugs(supabase, kanbanId, DADOS_CIDADE_SLUGS);
  const ctx =
    faseCidadeId != null
      ? await buscarContextoPracaCard(supabase, cardId, faseCidadeId)
      : { areas: [] as PracaCidade[], chaveLegado: null };

  return {
    ok: true,
    userId: user.id,
    tabelaItemId: loaded.tabelaItemId!,
    lotesItemId,
    valorRaw,
    ctx,
    linhas: loaded.linhas,
  };
}

async function persistirLotesLinha(input: {
  cardId: string;
  rowId: string;
  lotes: LinhaLoteDisponivel[];
  ctxSalvar: Extract<ContextoSalvar, { ok: true }>;
  condominioId?: string | null;
}): Promise<KanbanLotesDisponiveisResult> {
  const supabase = await createClient();
  let lotesNorm = input.lotes.map((l, i) => normalizarLinhaLote(l, i));

  if (input.condominioId?.trim()) {
    lotesNorm = await sincronizarLotesComCadastro(supabase, input.condominioId.trim(), lotesNorm, input.ctxSalvar.userId);
  }

  const json = atualizarLinhaNaTabelaMultiPraca(
    input.ctxSalvar.valorRaw,
    input.ctxSalvar.ctx.chaveLegado,
    input.rowId,
    (linhas) => {
      const idx = linhas.findIndex((l) => l.row_id === input.rowId);
      if (idx < 0) return linhas;
      const atual = normalizarLinhaProspect(linhas[idx]);
      const merged = atualizarLotesPreenchidosEm({ ...atual, lotes_disponiveis: lotesNorm });
      const novas = [...linhas];
      novas[idx] = merged;
      return novas;
    },
  );

  const saveTabela = await upsertChecklistValor(
    supabase,
    input.ctxSalvar.tabelaItemId,
    input.cardId,
    json,
    input.ctxSalvar.userId,
  );
  if (!saveTabela.ok) return saveTabela;

  if (input.ctxSalvar.lotesItemId) {
    const todasLinhas = parseLinhasTabelaTodasPracas(json, input.ctxSalvar.ctx.chaveLegado);
    const valorLotes = todasSessoesLotesCompletas(todasLinhas) ? 'true' : '';
    const saveLotes = await upsertChecklistValor(
      supabase,
      input.ctxSalvar.lotesItemId,
      input.cardId,
      valorLotes,
      input.ctxSalvar.userId,
    );
    if (!saveLotes.ok) return saveLotes;
  }

  revalidatePath('/rede-franqueados');
  return { ok: true };
}

export async function salvarLotesCondominioDisponivel(input: {
  cardId: string;
  rowId: string;
  lotes: LinhaLoteDisponivel[];
}): Promise<KanbanLotesDisponiveisResult> {
  const cardId = String(input.cardId ?? '').trim();
  const rowId = String(input.rowId ?? '').trim();
  if (!cardId || !rowId) return { ok: false, error: 'Card e condomínio são obrigatórios.' };

  const ctxSalvar = await carregarContextoSalvar(cardId);
  if (!ctxSalvar.ok) return ctxSalvar;

  const atual = ctxSalvar.linhas.find((l) => l.row_id === rowId);
  if (!atual) return { ok: false, error: 'Condomínio não encontrado na tabela de prospects.' };

  return persistirLotesLinha({
    cardId,
    rowId,
    lotes: input.lotes,
    ctxSalvar,
    condominioId: atual.condominio_id,
  });
}

export async function salvarCampoLoteCondominio(input: {
  cardId: string;
  rowId: string;
  loteId: string;
  chave: keyof Omit<LinhaLoteDisponivel, 'lote_id' | 'cadastro_lote_id'>;
  valor: string;
}): Promise<KanbanLotesDisponiveisResult> {
  const ctxSalvar = await carregarContextoSalvar(input.cardId);
  if (!ctxSalvar.ok) return ctxSalvar;

  const linha = ctxSalvar.linhas.find((l) => l.row_id === input.rowId);
  if (!linha) return { ok: false, error: 'Condomínio não encontrado.' };

  const lotes = [...(linha.lotes_disponiveis ?? [])];
  const idx = lotes.findIndex((l) => l.lote_id === input.loteId);
  if (idx < 0) return { ok: false, error: 'Lote não encontrado.' };

  lotes[idx] = { ...lotes[idx], [input.chave]: input.valor };

  return persistirLotesLinha({
    cardId: input.cardId,
    rowId: input.rowId,
    lotes,
    ctxSalvar,
    condominioId: linha.condominio_id,
  });
}

export type CarregarLotesCondominioResult =
  | { ok: true; linhas: LinhaProspectCondominio[] }
  | { ok: false; error: string };

export async function carregarLotesCondominioCard(cardId: string): Promise<CarregarLotesCondominioResult> {
  const res = await carregarProspectsCondominioCard(cardId);
  if (!res.ok) return res;
  return { ok: true, linhas: res.linhas };
}
