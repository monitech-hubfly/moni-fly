'use server';

import { createHash } from 'node:crypto';
import { getPublicAppUrl } from '@/lib/app-url';
import { normalizeAccessRole } from '@/lib/authz';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { buscarMunicipioIbge } from '@/lib/ibge';
import type { MunicipioIbge } from '@/lib/ibge';
import { mapZapItemToCasa, type ZapListingItem } from '@/lib/apify-zap';
import { applyZapCasasUpdate, verifyProcessoCasasAccess } from '@/lib/zap-save-casas';
import { applyZapLotesSave, verifyProcessoLotesAccess, type ZapLoteItem } from '@/lib/zap-save-lotes';
import type { BcaInputs } from '@/lib/bca-calc';
import { KANBAN_IDS, FASE_SLUGS } from '@/lib/constants/kanban-ids';
import {
  ATRIBUTOS_LOTE,
  type AtributosLoteRespostas,
  type AtributosLoteIds,
  atributosRespostasFromLoteDisponivel,
  parseAtributosLoteRespostas,
} from './REGRAS_BATALHA';
import {
  calcularRankingModelos,
  calcularRankingPreBatalhaPorFaixas,
  flattenRankingPreBatalhaPorFaixas,
  type DadosTerreno,
  type RankingPorFaixaMercado,
} from '@/lib/kanban/pre-batalha-compatibilidade';
import { LOTES_DISPONIVEIS_CHECKBOXES } from '@/lib/kanban/lotes-disponiveis-condominio';
import { parseDecimalInput } from '@/lib/condominios';
import type { LinhaProspectCondominio } from '@/lib/kanban/condominio-prospect-pesquisa';
import {
  PRE_BATALHA_CHECKLIST_LABEL_APLICADA,
  PRE_BATALHA_CHECKLIST_LABEL_RANKING,
  formatPreBatalhaChecklistCompleto,
} from '@/lib/kanban/pre-batalha-checklist';

export type SaveEtapa1Result = { ok: true } | { ok: false; error: string };

/** Fase Lotes Disponíveis (Funil Step One) — PROD UUID; fallback se slug lookup falhar. */
const STEP_ONE_LOTES_DISPONIVEIS_FASE_ID = 'a6afabd9-2409-49a7-ab11-d2df4d3784e7';

/** Checklist legado (label) → id em ATRIBUTOS_LOTE; canônicos vêm de LOTES_DISPONIVEIS_CHECKBOXES. */
const LEGACY_CHECKLIST_LABEL_ALIASES: Record<string, AtributosLoteIds> = {
  'Terreno aclive acentuado': 'aclive',
  'Terreno declive acentuado': 'declive',
  'Fundo mata': 'fundo_mata',
  'Frente mata': 'frente_mata',
  'Fundo lago': 'fundo_lago',
  'Frente lago': 'frente_lago',
  'Perto da portaria': 'portaria',
};

const CHECKLIST_LABEL_TO_ATRIBUTO: Record<string, AtributosLoteIds> = {
  ...Object.fromEntries(LOTES_DISPONIVEIS_CHECKBOXES.map(({ chave, label }) => [label, chave])),
  ...LEGACY_CHECKLIST_LABEL_ALIASES,
};

/**
 * Resolve card_id do Funil Step One a partir de `processo_step_one.id`.
 * - Nativo: `kanban_cards.projeto_id` = processoId → card.id
 * - Legado: `processo_step_one.id` é o próprio card (view `v_processo_como_kanban_cards`)
 */
async function resolveStepOneKanbanCardIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  processoId: string,
): Promise<string[]> {
  const ids = new Set<string>([processoId]);
  const { data: cards } = await supabase
    .from('kanban_cards')
    .select('id')
    .eq('projeto_id', processoId);
  for (const c of cards ?? []) {
    const id = String((c as { id?: string }).id ?? '').trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Pré-preenche Atributos do Lote a partir da fase lotes_disponiveis (Step One). */
export async function getAtributosLoteFromStepOneChecklist(
  processoId: string,
  options?: { cardId?: string },
): Promise<{ ok: true; atributos: AtributosLoteRespostas } | { ok: false; error: string }> {
  const access = await verifyProcessoCasasAccess(processoId);
  if (!access.ok) return { ok: false, error: access.error };
  const supabase = access.supabase;

  const cardIdsSet = new Set(await resolveStepOneKanbanCardIds(supabase, processoId));
  const hint = options?.cardId?.trim();
  if (hint) cardIdsSet.add(hint);
  const cardIds = [...cardIdsSet];
  if (cardIds.length === 0) return { ok: true, atributos: {} };

  const { data: fase } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.STEP_ONE)
    .eq('slug', FASE_SLUGS.LOTES_DISPONIVEIS)
    .maybeSingle();
  const faseId = fase?.id ?? STEP_ONE_LOTES_DISPONIVEIS_FASE_ID;

  const { data: itens, error: errItens } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, ordem, tipo, label')
    .eq('fase_id', faseId);
  if (errItens) return { ok: false, error: errItens.message };

  const itemRows = (itens ?? []) as { id: string; ordem: number; tipo: string; label: string }[];
  const usaLotesPorCondominio = itemRows.some((i) => i.tipo === 'lotes_condominio');

  if (usaLotesPorCondominio) {
    const { carregarLotesCondominioCard } = await import('@/lib/actions/kanban-lotes-disponiveis');
    for (const cardId of cardIds) {
      const loaded = await carregarLotesCondominioCard(cardId);
      if (!loaded.ok) continue;
      for (const linha of loaded.linhas) {
        const escolhido = linha.lote_escolhido_id?.trim()
          ? (linha.lotes_disponiveis ?? []).find((l) => l.lote_id === linha.lote_escolhido_id)
          : null;
        const lotesPrioridade = escolhido
          ? [escolhido]
          : (linha.lotes_disponiveis ?? []);
        for (const lote of lotesPrioridade) {
          const atributos = atributosRespostasFromLoteDisponivel(lote);
          if (Object.keys(atributos).length > 0) return { ok: true, atributos };
        }
      }
    }
    return { ok: true, atributos: {} };
  }

  const legacyItens = itemRows.filter((i) => i.tipo === 'checkbox' && i.label.trim() in CHECKLIST_LABEL_TO_ATRIBUTO);
  const legacyMuro = itemRows.find((i) => i.tipo === 'checkbox' && i.label.trim() === 'Muro');
  if (legacyItens.length === 0 && !legacyMuro) return { ok: true, atributos: {} };

  const itemIds = [...legacyItens.map((i) => i.id), ...(legacyMuro ? [legacyMuro.id] : [])];
  const { data: respostas, error: errResp } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('item_id, valor')
    .in('card_id', cardIds)
    .in('item_id', itemIds);
  if (errResp) return { ok: false, error: errResp.message };

  const valorPorItem = new Map<string, string>();
  for (const r of (respostas ?? []) as { item_id: string; valor: string | null }[]) {
    if (r.valor != null) valorPorItem.set(r.item_id, r.valor);
  }

  const atributos: AtributosLoteRespostas = {};
  for (const item of legacyItens) {
    const atributoId = CHECKLIST_LABEL_TO_ATRIBUTO[item.label.trim()];
    if (!atributoId) continue;
    if (valorPorItem.get(item.id) === 'true') {
      atributos[atributoId] = true;
    }
  }
  if (legacyMuro && valorPorItem.get(legacyMuro.id) === 'true') {
    // TODO: migrar respostas legadas de muro
  }

  return { ok: true, atributos };
}

function parseNumeroTerreno(valor: string | number | null | undefined): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const t = String(valor ?? '').trim();
  if (!t) return null;
  return parseDecimalInput(t) ?? (Number.isFinite(Number(t)) ? Number(t) : null);
}

function recuosFromLinhaProspect(linha: LinhaProspectCondominio | null): {
  recuo_frontal_m: number | null;
  recuo_fundo_m: number | null;
  recuo_lateral_m: number | null;
} {
  return {
    recuo_frontal_m: parseNumeroTerreno(linha?.recuo_frontal_m),
    recuo_fundo_m: parseNumeroTerreno(linha?.recuo_fundo_m),
    recuo_lateral_m: parseNumeroTerreno(linha?.recuo_lateral_m),
  };
}

async function buscarRecuosCondominioDb(
  supabase: Awaited<ReturnType<typeof createClient>>,
  condominioId: string | null,
  linha: LinhaProspectCondominio | null,
): Promise<{
  recuo_frontal_m: number | null;
  recuo_fundo_m: number | null;
  recuo_lateral_m: number | null;
}> {
  const fallback = recuosFromLinhaProspect(linha);
  const id = condominioId?.trim();
  if (!id) return fallback;

  const { data, error } = await supabase
    .from('condominios')
    .select('recuo_frontal_m, recuo_fundo_m, recuo_lateral_m')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return fallback;

  const row = data as {
    recuo_frontal_m?: number | null;
    recuo_fundo_m?: number | null;
    recuo_lateral_m?: number | null;
  };

  return {
    recuo_frontal_m: row.recuo_frontal_m ?? fallback.recuo_frontal_m,
    recuo_fundo_m: row.recuo_fundo_m ?? fallback.recuo_fundo_m,
    recuo_lateral_m: row.recuo_lateral_m ?? fallback.recuo_lateral_m,
  };
}

/** Lote escolhido + recuos do condomínio para elegibilidade geométrica na Pré Batalha. */
export async function getDadosTerrenoFromStepOneChecklist(
  processoId: string,
  options?: { cardId?: string },
): Promise<{ ok: true; terreno: DadosTerreno } | { ok: false; error: string }> {
  const access = await verifyProcessoCasasAccess(processoId);
  if (!access.ok) return { ok: false, error: access.error };
  const supabase = access.supabase;

  const cardIdsSet = new Set(await resolveStepOneKanbanCardIds(supabase, processoId));
  const hint = options?.cardId?.trim();
  if (hint) cardIdsSet.add(hint);
  const cardIds = [...cardIdsSet];

  const terrenoVazio: DadosTerreno = {
    dimensao_frente_m: null,
    dimensao_lado_esquerdo_m: null,
    recuo_frontal_m: null,
    recuo_fundo_m: null,
    recuo_lateral_m: null,
  };

  if (cardIds.length === 0) return { ok: true, terreno: terrenoVazio };

  const { carregarLoteEscolhidoCard } = await import('@/lib/actions/kanban-lotes-disponiveis');

  for (const cardId of cardIds) {
    const loaded = await carregarLoteEscolhidoCard(cardId);
    if (!loaded.ok || !loaded.ctx) continue;

    const { lote, linha } = loaded.ctx;
    let dimensao_frente_m = parseNumeroTerreno(lote.dimensao_frente_m);
    let dimensao_lado_esquerdo_m = parseNumeroTerreno(lote.dimensao_lado_esquerdo_m);
    let condominioId = linha.condominio_id?.trim() || null;

    if (lote.cadastro_lote_id?.trim()) {
      const { data: rowLote } = await supabase
        .from('condominios_lotes')
        .select('dimensao_frente_m, dimensao_lado_esquerdo_m, condominio_id')
        .eq('id', lote.cadastro_lote_id.trim())
        .maybeSingle();

      if (rowLote) {
        const db = rowLote as {
          dimensao_frente_m?: number | null;
          dimensao_lado_esquerdo_m?: number | null;
          condominio_id?: string | null;
        };
        dimensao_frente_m = dimensao_frente_m ?? parseNumeroTerreno(db.dimensao_frente_m);
        dimensao_lado_esquerdo_m =
          dimensao_lado_esquerdo_m ?? parseNumeroTerreno(db.dimensao_lado_esquerdo_m);
        condominioId = condominioId ?? db.condominio_id?.trim() ?? null;
      }
    }

    const recuos = await buscarRecuosCondominioDb(supabase, condominioId, linha);

    return {
      ok: true,
      terreno: {
        dimensao_frente_m,
        dimensao_lado_esquerdo_m,
        recuo_frontal_m: recuos.recuo_frontal_m,
        recuo_fundo_m: recuos.recuo_fundo_m,
        recuo_lateral_m: recuos.recuo_lateral_m,
      },
    };
  }

  return { ok: true, terreno: terrenoVazio };
}

const BATALHA_FASE_SLUGS = [FASE_SLUGS.BATALHA, 'stepone_batalha', FASE_SLUGS.PRE_BATALHA] as const;

async function resolveStepOneKanbanCardId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  processoId: string,
): Promise<string> {
  const { data: cardNativo } = await supabase
    .from('kanban_cards')
    .select('id')
    .eq('projeto_id', processoId)
    .eq('kanban_id', KANBAN_IDS.STEP_ONE)
    .limit(1)
    .maybeSingle();
  if (cardNativo?.id) return cardNativo.id as string;

  const { data: cardLegado } = await supabase
    .from('kanban_cards')
    .select('id')
    .eq('id', processoId)
    .maybeSingle();
  return (cardLegado?.id as string | undefined) ?? processoId;
}

async function resolveKanbanCardIdForPreBatalha(
  supabase: Awaited<ReturnType<typeof createClient>>,
  processoId: string,
  cardIdHint?: string,
): Promise<string> {
  const hint = cardIdHint?.trim();
  if (hint) {
    const { data: byHint } = await supabase
      .from('kanban_cards')
      .select('id, projeto_id')
      .eq('id', hint)
      .maybeSingle();
    if (byHint?.id) {
      const projetoId = String((byHint as { projeto_id?: string | null }).projeto_id ?? '').trim();
      if (!projetoId || projetoId === processoId || String(byHint.id) === processoId) {
        return String(byHint.id);
      }
    }
  }
  return resolveStepOneKanbanCardId(supabase, processoId);
}

async function buscarFaseBatalhaId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from('kanban_fases')
    .select('id, slug')
    .eq('kanban_id', KANBAN_IDS.STEP_ONE)
    .in('slug', [...BATALHA_FASE_SLUGS]);
  if (!data?.length) return null;
  for (const slug of BATALHA_FASE_SLUGS) {
    const hit = (data as { id: string; slug: string }[]).find((f) => f.slug === slug);
    if (hit) return hit.id;
  }
  return (data[0] as { id: string }).id;
}

/**
 * Após ranking Pré Batalha: marca checklist da fase batalha e preenche resumo do ranking.
 * Idempotente — checkbox só se ainda não marcado; texto do ranking só se campo vazio.
 */
export async function autoMarcarChecklistPosRankingPreBatalha(
  processoId: string,
  gruposRanking: RankingPorFaixaMercado[],
  options?: { cardId?: string; faseId?: string; forceAtualizarRanking?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const totalItens = gruposRanking.reduce((s, g) => s + g.ranking.length, 0);
  if (totalItens === 0) return { ok: true };

  const access = await verifyProcessoCasasAccess(processoId);
  if (!access.ok) return { ok: false, error: access.error };
  const supabase = access.supabase;

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardId = await resolveKanbanCardIdForPreBatalha(supabase, processoId, options?.cardId);
  const faseId = options?.faseId?.trim() || (await buscarFaseBatalhaId(supabase));
  if (!faseId) {
    console.warn(
      '[pre-batalha] Fase batalha não encontrada no Funil Step One — checklist não atualizado.',
    );
    return { ok: false, error: 'Fase Pré Batalha não encontrada no kanban.' };
  }

  const labels = [PRE_BATALHA_CHECKLIST_LABEL_APLICADA, PRE_BATALHA_CHECKLIST_LABEL_RANKING];
  const { data: itens, error: errItens } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, label, tipo')
    .eq('fase_id', faseId)
    .in('label', labels);
  if (errItens) return { ok: false, error: errItens.message };

  const itemPorLabel = new Map(
    ((itens ?? []) as { id: string; label: string; tipo: string }[]).map((i) => [i.label, i]),
  );

  for (const label of labels) {
    if (!itemPorLabel.has(label)) {
      console.warn(
        `[pre-batalha] Item de checklist "${label}" não encontrado na fase batalha (card ${cardId}).`,
      );
    }
  }

  const itemIds = [...itemPorLabel.values()].map((i) => i.id);
  const valorPorItem = new Map<string, string>();
  if (itemIds.length > 0) {
    const { data: respostas } = await supabase
      .from('kanban_fase_checklist_respostas')
      .select('item_id, valor')
      .eq('card_id', cardId)
      .in('item_id', itemIds);
    for (const r of (respostas ?? []) as { item_id: string; valor: string | null }[]) {
      if (r.valor != null) valorPorItem.set(r.item_id, r.valor);
    }
  }

  const now = new Date().toISOString();

  async function upsertResposta(itemId: string, valor: string): Promise<{ ok: false; error: string } | null> {
    const { error } = await supabase.from('kanban_fase_checklist_respostas').upsert(
      {
        item_id: itemId,
        card_id: cardId,
        valor,
        preenchido_por: user!.id,
        preenchido_em: now,
      },
      { onConflict: 'item_id,card_id' },
    );
    if (error) return { ok: false, error: error.message };
    return null;
  }

  const itemAplicada = itemPorLabel.get(PRE_BATALHA_CHECKLIST_LABEL_APLICADA);
  if (itemAplicada) {
    const atual = valorPorItem.get(itemAplicada.id)?.trim();
    if (atual !== 'true') {
      const err = await upsertResposta(itemAplicada.id, 'true');
      if (err) return err;
    }
  }

  const itemRanking = itemPorLabel.get(PRE_BATALHA_CHECKLIST_LABEL_RANKING);
  if (itemRanking) {
    const atual = valorPorItem.get(itemRanking.id)?.trim();
    const texto = formatPreBatalhaChecklistCompleto(gruposRanking);
    if ((!atual || options?.forceAtualizarRanking) && atual !== texto) {
      const err = await upsertResposta(itemRanking.id, texto);
      if (err) return err;
    }
  }

  return { ok: true };
}

function atributosLoteRespostasVazio(resp: AtributosLoteRespostas): boolean {
  return !ATRIBUTOS_LOTE.some((a) => resp[a.id] === true);
}

/**
 * Calcula ranking Pré Batalha server-side e preenche checklist no modal Kanban.
 * Disparado ao abrir a fase Pré Batalha — idempotente.
 */
export async function sincronizarChecklistPreBatalhaKanban(input: {
  cardId: string;
  processoId: string;
  faseId?: string;
}): Promise<
  | { ok: true; rankingCount: number; grupos: RankingPorFaixaMercado[] }
  | { ok: false; error: string }
> {
  const cardId = input.cardId?.trim();
  const processoId = input.processoId?.trim();
  if (!cardId || !processoId) return { ok: false, error: 'Parâmetros inválidos.' };

  const access = await verifyProcessoCasasAccess(processoId);
  if (!access.ok) return { ok: false, error: access.error };
  const supabase = access.supabase;

  const { data: casasRows, error: errCasas } = await supabase
    .from('listings_casas')
    .select(
      'id, condominio, quartos, banheiros, vagas, preco, area_casa_m2, piscina, marcenaria',
    )
    .eq('processo_id', processoId)
    .order('created_at', { ascending: false });
  if (errCasas) return { ok: false, error: errCasas.message };

  const casas = casasRows ?? [];
  if (casas.length === 0) return { ok: true, rankingCount: 0, grupos: [] };

  const { data: catRows, error: errCat } = await supabase
    .from('catalogo_casas')
    .select(
      'id, nome, quartos, banheiros, vagas, preco_custo, preco_custo_m2, preco_venda_m2, area_m2, preco_venda, topografia, dimensao_x_m, dimensao_y_m, area_perimetro_m2',
    )
    .eq('ativo', true);
  if (errCat) return { ok: false, error: errCat.message };

  const catalogo = catRows ?? [];
  if (catalogo.length === 0) return { ok: true, rankingCount: 0, grupos: [] };

  const attrResult = await getAtributosLoteFromStepOneChecklist(processoId, { cardId });
  const atributos = attrResult.ok ? attrResult.atributos : {};
  const atributosParaRanking = atributosLoteRespostasVazio(atributos) ? {} : atributos;

  const terrenoResult = await getDadosTerrenoFromStepOneChecklist(processoId, { cardId });
  const terreno = terrenoResult.ok ? terrenoResult.terreno : undefined;

  const gruposRanking = calcularRankingPreBatalhaPorFaixas(
    (
      casas as {
        id: string;
        condominio: string | null;
        quartos: number | null;
        banheiros: number | null;
        vagas: number | null;
        preco: number | null;
        area_casa_m2: number | null;
        piscina?: boolean | null;
        marcenaria?: boolean | null;
      }[]
    ).map((c) => ({
      id: c.id,
      condominio: c.condominio,
      quartos: c.quartos,
      banheiros: c.banheiros,
      vagas: c.vagas,
      preco: c.preco,
      area_casa_m2: c.area_casa_m2,
      piscina: c.piscina,
      marcenaria: c.marcenaria,
    })),
    catalogo,
    atributosParaRanking,
    { terreno },
  );

  if (gruposRanking.length === 0) return { ok: true, rankingCount: 0, grupos: [] };

  const mark = await autoMarcarChecklistPosRankingPreBatalha(
    processoId,
    gruposRanking,
    { cardId, faseId: input.faseId, forceAtualizarRanking: true },
  );
  if (!mark.ok) return mark;
  return {
    ok: true,
    rankingCount: flattenRankingPreBatalhaPorFaixas(gruposRanking).length,
    grupos: gruposRanking,
  };
}

export async function saveEtapa1(
  processoId: string,
  data: { narrativa?: string; concluida?: boolean },
): Promise<SaveEtapa1Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar.' };

  const { data: row } = await supabase
    .from('etapa_progresso')
    .select('iniciada_em, dados_json')
    .eq('processo_id', processoId)
    .eq('etapa_id', 1)
    .eq('user_id', user.id)
    .single();

  const currentJson = (row?.dados_json as Record<string, unknown> | null) ?? {};
  const dadosJson =
    data.narrativa !== undefined ? { ...currentJson, narrativa: data.narrativa } : undefined;

  const updates: Record<string, unknown> = {
    status: data.concluida ? 'concluida' : 'em_andamento',
    updated_at: new Date().toISOString(),
  };
  if (dadosJson) updates.dados_json = dadosJson;
  if (data.concluida) updates.concluida_em = new Date().toISOString();
  if (!row?.iniciada_em) updates.iniciada_em = new Date().toISOString();

  const { error } = await supabase
    .from('etapa_progresso')
    .update(updates)
    .eq('processo_id', processoId)
    .eq('etapa_id', 1)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };

  if (data.concluida) {
    await supabase
      .from('processo_step_one')
      .update({ etapa_atual: 2, updated_at: new Date().toISOString() })
      .eq('id', processoId)
      .eq('user_id', user.id);
  }

  return { ok: true };
}

/** Busca dados do IBGE para a praça e grava em etapa_progresso (etapa 1). */
export async function fetchAndSaveDadosIbgeEtapa1(
  processoId: string,
  cidade: string,
  estado: string | null,
): Promise<SaveEtapa1Result & { data?: MunicipioIbge }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const result = await buscarMunicipioIbge(cidade, estado);
  if (!result.ok) return result;

  const { data: row } = await supabase
    .from('etapa_progresso')
    .select('dados_json, iniciada_em')
    .eq('processo_id', processoId)
    .eq('etapa_id', 1)
    .eq('user_id', user.id)
    .single();

  const currentJson = (row?.dados_json as Record<string, unknown> | null) ?? {};
  const updates: Record<string, unknown> = {
    dados_json: { ...currentJson, analise_ibge: result.data },
    updated_at: new Date().toISOString(),
  };
  if (!row?.iniciada_em) updates.iniciada_em = new Date().toISOString();

  const { error } = await supabase
    .from('etapa_progresso')
    .update(updates)
    .eq('processo_id', processoId)
    .eq('etapa_id', 1)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: result.data };
}

export type AnexoEtapa1 = { url: string; nome: string };

/** Etapa 1 — Dados da cidade: salva observações, anexos, código IBGE e/ou URL do PDF. */
export async function saveEtapa1Praca(
  processoId: string,
  data: {
    observacoes_praca?: string | null;
    cidade_ibge_cod?: string | null;
    anexos_etapa1?: AnexoEtapa1[] | null;
    pdf_url_etapa1?: string | null;
  },
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.observacoes_praca !== undefined) updates.observacoes_praca = data.observacoes_praca;
  if (data.cidade_ibge_cod !== undefined) updates.cidade_ibge_cod = data.cidade_ibge_cod;
  if (data.anexos_etapa1 !== undefined) updates.anexos_etapa1 = data.anexos_etapa1;
  if (data.pdf_url_etapa1 !== undefined) updates.pdf_url_etapa1 = data.pdf_url_etapa1;

  const { error } = await supabase
    .from('processo_step_one')
    .update(updates)
    .eq('id', processoId)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// --- Etapa 2: Condomínios e checklist ---

export type CondominioEtapa2 = {
  id: string;
  nome: string;
  qtd_casas: number | null;
  preco_medio: number | null;
  m2_medio: number | null;
};

export type ChecklistCondominioInput = {
  lotes_total?: number | null;
  lotes_disponiveis?: number | null;
  lotes_tamanho_medio?: number | null;
  lotes_preco_m2?: number | null;
  lotes_area_valorizada?: string | null;
  casas_prontas?: number | null;
  casas_construindo?: number | null;
  casas_construindo_venda?: number | null;
  casas_construindo_cliente?: number | null;
  casas_para_venda?: number | null;
  casas_preco_m2?: number | null;
  casas_tempo_medio_venda?: number | null;
  casas_vendidas_12m?: number | null;
  casas_remanescentes_motivo?: string | null;
  casas_impacto_negativo?: string | null;
  casas_erros_projeto?: string | null;
  casas_caracteristicas_elogiadas?: string | null;
  casas_caracteristicas_buscadas?: string | null;
  locacao_exemplos?: string | null;
};

export async function buscarCondominiosViaZap(processoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: processo } = await supabase
    .from('processo_step_one')
    .select('cidade, estado')
    .eq('id', processoId)
    .eq('user_id', user.id)
    .single();

  if (!processo) return { ok: false, error: 'Processo não encontrado.' };
  const cidade = (processo.cidade as string | null) ?? '';
  const estado = (processo.estado as string | null) ?? '';
  if (!cidade.trim() || !estado.trim()) {
    return { ok: false, error: 'Cidade e estado são obrigatórios para buscar condomínios no ZAP.' };
  }

  const baseUrl = getPublicAppUrl();
  const url = new URL('/api/apify-zap', baseUrl).toString();
  console.log('[Etapa2] Chamando /api/apify-zap:', url, { cidade, estado });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cidade, estado }),
  });
  const json = (await res.json()) as { ok?: boolean; error?: string; items?: ZapListingItem[] };
  if (!json.ok || !Array.isArray(json.items)) {
    return { ok: false, error: json.error || 'Falha ao buscar dados no ZAP.' };
  }

  const casas = json.items.map((item) => mapZapItemToCasa(item, cidade, estado));
  const byCondo = new Map<
    string,
    { qtd: number; somaPreco: number; somaM2: number; qtdComPreco: number; qtdComM2: number }
  >();

  for (const casa of casas) {
    const nome = (casa.condominio || '').trim();
    if (!nome) continue;
    let agg = byCondo.get(nome);
    if (!agg) {
      agg = { qtd: 0, somaPreco: 0, somaM2: 0, qtdComPreco: 0, qtdComM2: 0 };
      byCondo.set(nome, agg);
    }
    agg.qtd += 1;
    if (casa.preco != null) {
      agg.somaPreco += casa.preco;
      agg.qtdComPreco += 1;
    }
    if (casa.area_casa_m2 != null) {
      agg.somaM2 += casa.area_casa_m2;
      agg.qtdComM2 += 1;
    }
  }

  console.log('[Etapa2] condomínios agregados:', byCondo.size);

  // Limpa registros anteriores deste processo para manter lista consistente
  const { error: delErrChecklist } = await supabase
    .from('checklist_condominios')
    .delete()
    .eq('processo_id', processoId);
  if (delErrChecklist) {
    console.log('[Etapa2] Erro ao limpar checklist_condominios:', delErrChecklist.message);
  }
  const { error: delErrCond } = await supabase
    .from('condominios_etapa2')
    .delete()
    .eq('processo_id', processoId);
  if (delErrCond) {
    console.log('[Etapa2] Erro ao limpar condominios_etapa2:', delErrCond.message);
  }

  if (byCondo.size === 0) {
    return {
      ok: false,
      error: 'Nenhum condomínio encontrado na ZAP para esta cidade (casas acima de 5 MM).',
    };
  }

  const rows = Array.from(byCondo.entries()).map(([nome, agg]) => ({
    processo_id: processoId,
    nome,
    qtd_casas: agg.qtd,
    preco_medio: agg.qtdComPreco > 0 ? agg.somaPreco / agg.qtdComPreco : null,
    m2_medio: agg.qtdComM2 > 0 ? agg.somaM2 / agg.qtdComM2 : null,
  }));

  const { error } = await supabase.from('condominios_etapa2').insert(rows);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

export async function saveChecklistCondominio(
  processoId: string,
  condominioId: string,
  input: ChecklistCondominioInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const payload: Record<string, unknown> = { processo_id: processoId, condominio_id: condominioId };
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) payload[key] = value;
  }

  const { data: existing, error: selErr } = await supabase
    .from('checklist_condominios')
    .select('id')
    .eq('processo_id', processoId)
    .eq('condominio_id', condominioId)
    .maybeSingle();
  if (selErr) return { ok: false, error: selErr.message };

  if (existing?.id) {
    const { error } = await supabase
      .from('checklist_condominios')
      .update(payload)
      .eq('id', existing.id as string);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('checklist_condominios').insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function saveEtapa2(
  processoId: string,
  data: { concluida?: boolean },
): Promise<SaveEtapa1Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: row } = await supabase
    .from('etapa_progresso')
    .select('iniciada_em')
    .eq('processo_id', processoId)
    .eq('etapa_id', 2)
    .eq('user_id', user.id)
    .single();

  const updates: Record<string, unknown> = {
    status: data.concluida ? 'concluida' : 'em_andamento',
    updated_at: new Date().toISOString(),
  };
  if (data.concluida) updates.concluida_em = new Date().toISOString();
  if (!row?.iniciada_em) updates.iniciada_em = new Date().toISOString();

  const { error } = await supabase
    .from('etapa_progresso')
    .update(updates)
    .eq('processo_id', processoId)
    .eq('etapa_id', 2)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  if (data.concluida) {
    await supabase
      .from('processo_step_one')
      .update({ etapa_atual: 3, updated_at: new Date().toISOString() })
      .eq('id', processoId)
      .eq('user_id', user.id);
  }
  return { ok: true };
}

// --- Etapa 3: Tabela resumo e conclusão ---
export type ResumoCondominioRow = {
  estoque_casas?: string;
  ticket_lote?: string;
  ticket_casas?: string;
  ticket_casas_m2?: string;
  estimativa_vendidas_ano?: string;
};
export type ConclusaoEtapa3 = {
  mais_promissores?: string;
  faixa_preco?: string;
  produto_mais_vende?: string;
  erros?: string;
  oportunidade?: string;
};

export async function saveEtapa3(
  processoId: string,
  data: {
    resumo_condominios?: Record<string, ResumoCondominioRow>;
    conclusao?: ConclusaoEtapa3;
    concluida?: boolean;
  },
): Promise<SaveEtapa1Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: row } = await supabase
    .from('etapa_progresso')
    .select('iniciada_em, dados_json')
    .eq('processo_id', processoId)
    .eq('etapa_id', 3)
    .eq('user_id', user.id)
    .single();

  const currentJson = (row?.dados_json as Record<string, unknown> | null) ?? {};
  const updates: Record<string, unknown> = {
    status: data.concluida ? 'concluida' : 'em_andamento',
    updated_at: new Date().toISOString(),
  };
  if (data.resumo_condominios !== undefined || data.conclusao !== undefined) {
    updates.dados_json = {
      ...currentJson,
      ...(data.resumo_condominios !== undefined && { resumo_condominios: data.resumo_condominios }),
      ...(data.conclusao !== undefined && { conclusao: data.conclusao }),
    };
  }
  if (data.concluida) updates.concluida_em = new Date().toISOString();
  if (!row?.iniciada_em) updates.iniciada_em = new Date().toISOString();

  const { error } = await supabase
    .from('etapa_progresso')
    .update(updates)
    .eq('processo_id', processoId)
    .eq('etapa_id', 3)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  if (data.concluida) {
    await supabase
      .from('processo_step_one')
      .update({ etapa_atual: 4, updated_at: new Date().toISOString() })
      .eq('id', processoId)
      .eq('user_id', user.id);
  }
  return { ok: true };
}

// --- Sprint 4: Etapa 4 (lotes), 5 (casas), 7 (lote escolhido) ---

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addCasaListing(
  processoId: string,
  data: {
    cidade?: string;
    estado?: string;
    status?: 'a_venda' | 'despublicado';
    condominio?: string;
    localizacao_condominio?: string;
    area_lote_m2?: number;
    area_casa_m2?: number;
    quartos?: number;
    suites?: number;
    banheiros?: number;
    vagas?: number;
    piscina?: boolean;
    marcenaria?: boolean;
    preco?: number;
    preco_m2?: number;
    compatibilidade_moni?: string;
    data_coleta?: string;
    link?: string;
  },
): Promise<ActionResult> {
  const access = await verifyProcessoCasasAccess(processoId);
  if (!access.ok) return { ok: false, error: access.error };
  const { error } = await access.supabase.from('listings_casas').insert({
    processo_id: processoId,
    manual: true,
    cidade: data.cidade || null,
    estado: data.estado || null,
    status: data.status ?? 'a_venda',
    condominio: data.condominio || null,
    localizacao_condominio: data.localizacao_condominio || null,
    area_lote_m2: data.area_lote_m2 ?? null,
    area_casa_m2: data.area_casa_m2 ?? null,
    quartos: data.quartos ?? null,
    suites: data.suites ?? null,
    banheiros: data.banheiros ?? null,
    vagas: data.vagas ?? null,
    piscina: data.piscina ?? false,
    marcenaria: data.marcenaria ?? false,
    preco: data.preco ?? null,
    preco_m2: data.preco_m2 ?? null,
    compatibilidade_moni: data.compatibilidade_moni || null,
    data_coleta: data.data_coleta || null,
    link: data.link || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type RunZapEtapa4Result =
  | { ok: true; inserted: number; updated: number; despublicados: number }
  | { ok: false; error: string };

/**
 * Persiste os itens retornados pela API /api/apify-zap.
 * - Itens já existentes (por link) são atualizados; novos são inseridos. Registros manuais não são alterados.
 * - Itens que estavam no processo e não vêm mais na ZAP são marcados como despublicado (não removidos).
 */
export async function saveZapItemsEtapa4(
  processoId: string,
  items: ZapListingItem[],
  cidade: string,
  estado: string,
): Promise<RunZapEtapa4Result> {
  const access = await verifyProcessoCasasAccess(processoId);
  if (!access.ok) return { ok: false, error: access.error };

  const { inserted, updated, despublicados } = await applyZapCasasUpdate(
    access.supabase,
    processoId,
    items,
    cidade,
    estado,
  );
  return { ok: true, inserted, updated, despublicados };
}

export async function updateCasaCompatibilidadeMoni(
  casaId: string,
  compatibilidade_moni: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { error } = await supabase
    .from('listings_casas')
    .update({ compatibilidade_moni: compatibilidade_moni || null })
    .eq('id', casaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Atualiza apenas o status de uma casa (uso: casas manuais — só o status é editável). */
export async function updateCasaStatus(
  casaId: string,
  status: 'a_venda' | 'despublicado',
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  let processoId: string | null = null;
  const { data: casa } = await supabase
    .from('listings_casas')
    .select('processo_id')
    .eq('id', casaId)
    .maybeSingle();
  processoId = (casa as { processo_id?: string } | null)?.processo_id ?? null;

  if (!processoId) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const accessRole = normalizeAccessRole((profile as { role?: string } | null)?.role);
    if (accessRole === 'admin' || accessRole === 'team') {
      try {
        const admin = createAdminClient();
        const { data: casaAdmin } = await admin
          .from('listings_casas')
          .select('processo_id')
          .eq('id', casaId)
          .maybeSingle();
        processoId = (casaAdmin as { processo_id?: string } | null)?.processo_id ?? null;
      } catch {
        /* fallback abaixo */
      }
    }
  }

  if (!processoId) return { ok: false, error: 'Casa não encontrada.' };

  const access = await verifyProcessoCasasAccess(processoId);
  if (!access.ok) return { ok: false, error: access.error };

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await access.supabase
    .from('listings_casas')
    .update({
      status,
      data_despublicado: status === 'despublicado' ? today : null,
    })
    .eq('id', casaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Marca que o franqueado validou o status das casas manuais hoje (dispensa alerta mensal). */
export async function validarStatusCasasManuais(processoId: string): Promise<ActionResult> {
  const access = await verifyProcessoCasasAccess(processoId);
  if (!access.ok) return { ok: false, error: access.error };
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await access.supabase
    .from('processo_step_one')
    .update({ ultima_validacao_casas_manuais_em: today })
    .eq('id', processoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type RunZapEtapa5Result = { ok: true; inserted: number } | { ok: false; error: string };

/**
 * Persiste os itens retornados pela API /api/apify-zap-lotes: deleta todos os lotes do processo e insere os novos (etapa 4 - listagem de lotes).
 */
export async function saveZapItemsEtapa5(
  processoId: string,
  items: ZapLoteItem[],
): Promise<RunZapEtapa5Result> {
  const access = await verifyProcessoLotesAccess(processoId);
  if (!access.ok) return { ok: false, error: access.error };

  try {
    const { inserted } = await applyZapLotesSave(access.supabase, processoId, items);
    return { ok: true, inserted };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function addLoteListing(
  processoId: string,
  data: {
    condominio?: string;
    area_lote_m2?: number;
    preco?: number;
    link?: string;
    valor_condominio?: number;
    iptu?: number;
    caracteristicas_condominio?: string;
  },
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { error } = await supabase.from('listings_lotes').insert({
    processo_id: processoId,
    condominio: data.condominio || null,
    area_lote_m2: data.area_lote_m2 ?? null,
    preco: data.preco ?? null,
    link: data.link || null,
    valor_condominio: data.valor_condominio ?? null,
    iptu: data.iptu ?? null,
    caracteristicas_condominio: data.caracteristicas_condominio ?? null,
    manual: true,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type CasaEscolhidaEtapa5 = {
  id: string;
  catalogo_casa_id: string;
};

export type BatalhaCasaRow = {
  casa_escolhida_id: string;
  listing_id: string;
  nota_preco: number;
  nota_produto: number;
  nota_localizacao: number;
  nota_final: number;
  /** Respostas SIM/NÃO dos atributos do lote (nota_localizacao = soma dos scores) */
  atributos_lote_json?: Record<string, boolean> | null;
  /** Checklist reforma, sub-notas D/E/I/P, custo_construcao do configurador, etc. */
  preco_dados_json?: Record<string, unknown> | null;
  produto_dados_json?: Record<string, unknown> | null;
};

/** Custos de construção da fase Escolha (checklist "Custo de construção — Casa N"), keyed by ordem 1–3. */
export async function getCustosConstrucaoEscolhaChecklist(
  processoId: string,
): Promise<Record<number, number | null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { KANBAN_IDS, FASE_SLUGS } = await import('@/lib/constants/kanban-ids');
  const { parseOrdemCustoConstrucaoEscolha } = await import('./REGRAS_BATALHA');

  const { data: fase } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.STEP_ONE)
    .eq('slug', FASE_SLUGS.ESCOLHA)
    .maybeSingle();

  if (!fase?.id) return {};

  const { data: itens } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, label')
    .eq('fase_id', fase.id)
    .like('label', 'Custo de construção — Casa %');

  if (!itens?.length) return {};

  let cardId = processoId;
  const { data: cardNativo } = await supabase
    .from('kanban_cards')
    .select('id')
    .eq('projeto_id', processoId)
    .eq('kanban_id', KANBAN_IDS.STEP_ONE)
    .limit(1)
    .maybeSingle();
  if (cardNativo?.id) cardId = cardNativo.id;

  const itemIds = itens.map((i) => i.id);
  const { data: respostas } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('item_id, valor')
    .eq('card_id', cardId)
    .in('item_id', itemIds);

  const valorPorItem = new Map<string, string>();
  for (const r of respostas ?? []) {
    if (r.valor) valorPorItem.set(r.item_id, r.valor);
  }

  const out: Record<number, number | null> = {};
  for (const item of itens) {
    const ordem = parseOrdemCustoConstrucaoEscolha(item.label);
    if (ordem == null) continue;
    const raw = valorPorItem.get(item.id);
    if (raw == null || raw.trim() === '') {
      out[ordem] = null;
      continue;
    }
    const s = raw.trim();
    const v = s.includes(',')
      ? parseFloat(s.replace(/\./g, '').replace(',', '.'))
      : parseFloat(s);
    out[ordem] = Number.isFinite(v) ? v : null;
  }
  return out;
}

/** Salva modelos do catálogo Moní para batalha na Etapa 5 (limpa escolhas e batalhas anteriores). */
export async function saveCasasEscolhidasEtapa5(
  processoId: string,
  catalogoCasaIds: string[],
  opts?: { limiteMaximo?: number | null },
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const ids = Array.from(new Set(catalogoCasaIds)).filter(Boolean);
  if (ids.length === 0) {
    return { ok: false, error: 'Nenhum modelo do catálogo para a batalha.' };
  }
  const limite = opts?.limiteMaximo === undefined ? 3 : opts.limiteMaximo;
  if (limite != null && ids.length > limite) {
    return {
      ok: false,
      error: `Selecione no máximo ${limite} modelos do catálogo para a batalha.`,
    };
  }

  const { error: delEscolhidas } = await supabase
    .from('casas_escolhidas_etapa5')
    .delete()
    .eq('processo_id', processoId);
  if (delEscolhidas) return { ok: false, error: delEscolhidas.message };

  const inserts = ids.map((catalogo_casa_id) => ({
    processo_id: processoId,
    catalogo_casa_id,
  }));
  const { error: insEscolhidas } = await supabase.from('casas_escolhidas_etapa5').insert(inserts);
  if (insEscolhidas) return { ok: false, error: insEscolhidas.message };

  const { error: delBatalhas } = await supabase
    .from('batalha_casas')
    .delete()
    .eq('processo_id', processoId);
  if (delBatalhas) return { ok: false, error: delBatalhas.message };

  return { ok: true };
}

/** Salva as notas de batalha da Etapa 5 (substitui todas as linhas anteriores do processo). */
export async function saveBatalhaCasasEtapa5(
  processoId: string,
  rows: BatalhaCasaRow[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cleaned = rows.filter(
    (r) =>
      r.atributos_lote_json != null ||
      r.preco_dados_json != null ||
      r.produto_dados_json != null ||
      Number.isFinite(r.nota_localizacao),
  );
  if (cleaned.length === 0) {
    return {
      ok: false,
      error:
        'Preencha pelo menos um critério (Atributos do Lote, Preço ou Produto) antes de salvar a batalha.',
    };
  }

  const { error: del } = await supabase
    .from('batalha_casas')
    .delete()
    .eq('processo_id', processoId);
  if (del) return { ok: false, error: del.message };

  const payloads = cleaned.map((r) => ({
    processo_id: processoId,
    casa_escolhida_id: r.casa_escolhida_id,
    listing_id: r.listing_id,
    nota_preco: r.nota_preco,
    nota_produto: r.nota_produto,
    nota_localizacao: r.nota_localizacao,
    nota_final: r.nota_final,
    ...(r.atributos_lote_json !== undefined && { atributos_lote_json: r.atributos_lote_json }),
    ...(r.preco_dados_json !== undefined && { preco_dados_json: r.preco_dados_json }),
    ...(r.produto_dados_json !== undefined && { produto_dados_json: r.produto_dados_json }),
  }));

  const { error: ins } = await supabase.from('batalha_casas').insert(payloads);
  if (ins) return { ok: false, error: ins.message };

  return { ok: true };
}

/** Armazena a URL do PDF Score & Batalha na etapa 6 (Listagem, modelo e batalha). */
export async function saveScoreBatalhaPdfUrl(
  processoId: string,
  pdfUrl: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: row } = await supabase
    .from('etapa_progresso')
    .select('id, dados_json')
    .eq('processo_id', processoId)
    .eq('etapa_id', 6)
    .eq('user_id', user.id)
    .maybeSingle();

  const currentJson = (row?.dados_json as Record<string, unknown> | null) ?? {};
  const newJson = { ...currentJson, pdf_url: pdfUrl, pdf_created_at: new Date().toISOString() };

  if (row) {
    const { error } = await supabase
      .from('etapa_progresso')
      .update({ dados_json: newJson, updated_at: new Date().toISOString() })
      .eq('processo_id', processoId)
      .eq('etapa_id', 6)
      .eq('user_id', user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('etapa_progresso').insert({
      processo_id: processoId,
      etapa_id: 6,
      user_id: user.id,
      status: 'em_andamento',
      iniciada_em: new Date().toISOString(),
      dados_json: newJson,
    });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Exclui um lote apenas se for manual (lotes da ZAP não podem ser alterados). */
export async function deleteLoteListing(processoId: string, loteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { data: row } = await supabase
    .from('listings_lotes')
    .select('id, manual')
    .eq('id', loteId)
    .eq('processo_id', processoId)
    .single();
  if (!row) return { ok: false, error: 'Lote não encontrado.' };
  if (row.manual !== true)
    return { ok: false, error: 'Só é possível excluir lotes adicionados manualmente.' };
  const { error } = await supabase
    .from('listings_lotes')
    .delete()
    .eq('id', loteId)
    .eq('processo_id', processoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Etapa 4: define o lote escolhido (1 por processo) na listagem de lotes. */
export async function saveLoteEscolhidoEtapa4(
  processoId: string,
  listingLoteId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { data: existing } = await supabase
    .from('lote_escolhido')
    .select('id')
    .eq('processo_id', processoId)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from('lote_escolhido')
      .update({ listing_lote_id: listingLoteId, updated_at: new Date().toISOString() })
      .eq('processo_id', processoId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('lote_escolhido').insert({
      processo_id: processoId,
      listing_lote_id: listingLoteId,
    });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function saveLoteEscolhido(
  processoId: string,
  data: {
    cidade?: string;
    condominio?: string;
    recuos_permitidos?: string;
    localizacao_condominio?: string;
    area_lote_m2?: number;
    topografia?: string;
    frente_m?: number;
    fundo_m?: number;
    preco?: number;
    preco_m2?: number;
  },
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { data: existing } = await supabase
    .from('lote_escolhido')
    .select('listing_lote_id')
    .eq('processo_id', processoId)
    .maybeSingle();
  const row = {
    processo_id: processoId,
    cidade: data.cidade || null,
    condominio: data.condominio || null,
    recuos_permitidos: data.recuos_permitidos || null,
    localizacao_condominio: data.localizacao_condominio || null,
    area_lote_m2: data.area_lote_m2 ?? null,
    topografia: data.topografia || null,
    frente_m: data.frente_m ?? null,
    fundo_m: data.fundo_m ?? null,
    preco: data.preco ?? null,
    preco_m2: data.preco_m2 ?? null,
    ...(existing?.listing_lote_id != null && { listing_lote_id: existing.listing_lote_id }),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('lote_escolhido').upsert(row, {
    onConflict: 'processo_id',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// --- Etapa 8: Batalhas ---
export async function saveBatalha(
  processoId: string,
  listingCasaId: string,
  catalogoCasaId: string,
  data: { nota_preco?: number; nota_produto?: number; nota_localizacao?: number },
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const row = {
    processo_id: processoId,
    listing_casa_id: listingCasaId,
    catalogo_casa_id: catalogoCasaId,
    nota_preco: data.nota_preco ?? null,
    nota_produto: data.nota_produto ?? null,
    nota_localizacao: data.nota_localizacao ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('batalhas').upsert(row, {
    onConflict: 'processo_id,listing_casa_id,catalogo_casa_id',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// --- Escolher 3 modelos do catálogo Moní (batalham com todas as casas ZAP e usados no BCA) ---
export async function saveCatalogoEscolhidos(
  processoId: string,
  catalogoCasaIds: [string, string, string],
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const uniq = [...new Set(catalogoCasaIds)];
  if (uniq.length !== 3)
    return { ok: false, error: 'Selecione exatamente 3 modelos do catálogo diferentes.' };

  await supabase.from('catalogo_escolhidos').delete().eq('processo_id', processoId);
  const { error } = await supabase.from('catalogo_escolhidos').insert([
    { processo_id: processoId, catalogo_casa_id: catalogoCasaIds[0], ordem: 1 },
    { processo_id: processoId, catalogo_casa_id: catalogoCasaIds[1], ordem: 2 },
    { processo_id: processoId, catalogo_casa_id: catalogoCasaIds[2], ordem: 3 },
  ]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// --- Etapa 5: Justificativas do ranking final (por modelo) ---
export async function saveEtapa5JustificativasRanking(
  processoId: string,
  justificativasPorModelo: Record<string, string>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: row } = await supabase
    .from('etapa_progresso')
    .select('id, iniciada_em, dados_json')
    .eq('processo_id', processoId)
    .eq('etapa_id', 5)
    .eq('user_id', user.id)
    .maybeSingle();

  const currentJson = (row?.dados_json as Record<string, unknown> | null) ?? {};
  const newJson = { ...currentJson, justificativas_ranking: justificativasPorModelo };

  if (row) {
    const { error } = await supabase
      .from('etapa_progresso')
      .update({
        dados_json: newJson,
        updated_at: new Date().toISOString(),
        ...(!row.iniciada_em && { iniciada_em: new Date().toISOString(), status: 'em_andamento' }),
      })
      .eq('processo_id', processoId)
      .eq('etapa_id', 5)
      .eq('user_id', user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('etapa_progresso').insert({
      processo_id: processoId,
      etapa_id: 5,
      user_id: user.id,
      status: 'em_andamento',
      iniciada_em: new Date().toISOString(),
      dados_json: newJson,
    });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

// --- Etapa 9: Ranking do catálogo ---
export async function saveEtapa9(
  processoId: string,
  data: { justificativas?: Record<string, string>; concluida?: boolean },
): Promise<SaveEtapa1Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: row } = await supabase
    .from('etapa_progresso')
    .select('iniciada_em, dados_json')
    .eq('processo_id', processoId)
    .eq('etapa_id', 9)
    .eq('user_id', user.id)
    .single();

  const currentJson = (row?.dados_json as Record<string, unknown> | null) ?? {};
  const updates: Record<string, unknown> = {
    status: data.concluida ? 'concluida' : 'em_andamento',
    updated_at: new Date().toISOString(),
  };
  if (data.justificativas !== undefined)
    updates.dados_json = { ...currentJson, justificativas: data.justificativas };
  if (data.concluida) updates.concluida_em = new Date().toISOString();
  if (!row?.iniciada_em) updates.iniciada_em = new Date().toISOString();

  const { error } = await supabase
    .from('etapa_progresso')
    .update(updates)
    .eq('processo_id', processoId)
    .eq('etapa_id', 9)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  if (data.concluida) {
    await supabase
      .from('processo_step_one')
      .update({ etapa_atual: 10, updated_at: new Date().toISOString() })
      .eq('id', processoId)
      .eq('user_id', user.id);
  }
  return { ok: true };
}

// --- Etapa 10: BCA (3 opções) ---
export type BcaOpcao = { catalogo_casa_id: string; titulo: string; descricao?: string };
export async function saveEtapa10(
  processoId: string,
  data: { opcoes?: BcaOpcao[]; concluida?: boolean },
): Promise<SaveEtapa1Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: row } = await supabase
    .from('etapa_progresso')
    .select('iniciada_em, dados_json')
    .eq('processo_id', processoId)
    .eq('etapa_id', 10)
    .eq('user_id', user.id)
    .single();

  const currentJson = (row?.dados_json as Record<string, unknown> | null) ?? {};
  const updates: Record<string, unknown> = {
    status: data.concluida ? 'concluida' : 'em_andamento',
    updated_at: new Date().toISOString(),
  };
  if (data.opcoes !== undefined) updates.dados_json = { ...currentJson, opcoes: data.opcoes };
  if (data.concluida) updates.concluida_em = new Date().toISOString();
  if (!row?.iniciada_em) updates.iniciada_em = new Date().toISOString();

  const { error } = await supabase
    .from('etapa_progresso')
    .update(updates)
    .eq('processo_id', processoId)
    .eq('etapa_id', 10)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  if (data.concluida) {
    await supabase
      .from('processo_step_one')
      .update({ etapa_atual: 11, updated_at: new Date().toISOString() })
      .eq('id', processoId)
      .eq('user_id', user.id);
  }
  return { ok: true };
}

// --- BCA inputs (tabela bca_inputs; obra_mes8 e vgv_planta não são salvos) ---
export async function getBcaInputs(processoId: string): Promise<Partial<BcaInputs> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('bca_inputs')
    .select('*')
    .eq('processo_id', processoId)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const out: Partial<BcaInputs> = {};
  const keys: (keyof BcaInputs)[] = [
    'nome_condominio',
    'nome_casa',
    'area_vendas_m2',
    'custo_terreno',
    'itbi_percentual',
    'custo_casa',
    'mes_inicio_obra',
    'obra_mes1',
    'obra_mes2',
    'obra_mes3',
    'obra_mes4',
    'obra_mes5',
    'obra_mes6',
    'obra_mes7',
    'obra_mes9',
    'obra_mes10',
    'comissao_vendas',
    'impostos',
    'taxa_plataforma',
    'taxa_gestao_frank',
    'projetos_taxa_obra',
    'capital_giro_inicial',
    'vgv_target',
    'vgv_liquidacao',
    'vgv_recompra',
    'permuta_planta',
    'permuta_target',
    'permuta_liquidacao',
    'permuta_recompra',
    'percentual_funding',
    'cdi_an',
  ];
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null)
      (out as Record<string, unknown>)[k] = Number(row[k]) === row[k] ? Number(row[k]) : row[k];
  }
  return out;
}

export async function saveBcaInputs(
  processoId: string,
  inputs: Partial<BcaInputs>,
): Promise<SaveEtapa1Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const row: Record<string, unknown> = {
    processo_id: processoId,
    updated_at: new Date().toISOString(),
  };
  const keys: (keyof BcaInputs)[] = [
    'nome_condominio',
    'nome_casa',
    'area_vendas_m2',
    'custo_terreno',
    'itbi_percentual',
    'custo_casa',
    'mes_inicio_obra',
    'obra_mes1',
    'obra_mes2',
    'obra_mes3',
    'obra_mes4',
    'obra_mes5',
    'obra_mes6',
    'obra_mes7',
    'obra_mes9',
    'obra_mes10',
    'comissao_vendas',
    'impostos',
    'taxa_plataforma',
    'taxa_gestao_frank',
    'projetos_taxa_obra',
    'capital_giro_inicial',
    'vgv_target',
    'vgv_liquidacao',
    'vgv_recompra',
    'permuta_planta',
    'permuta_target',
    'permuta_liquidacao',
    'permuta_recompra',
    'percentual_funding',
    'cdi_an',
  ];
  for (const k of keys) {
    if (inputs[k] !== undefined) row[k] = inputs[k];
  }

  const { error } = await supabase.from('bca_inputs').upsert(row, {
    onConflict: 'processo_id',
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// --- Etapa 11: PDF de hipóteses ---
export async function saveEtapa11(
  processoId: string,
  data: { concluida?: boolean },
): Promise<SaveEtapa1Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: row } = await supabase
    .from('etapa_progresso')
    .select('iniciada_em')
    .eq('processo_id', processoId)
    .eq('etapa_id', 11)
    .eq('user_id', user.id)
    .single();

  const updates: Record<string, unknown> = {
    status: data.concluida ? 'concluida' : 'em_andamento',
    updated_at: new Date().toISOString(),
  };
  if (data.concluida) updates.concluida_em = new Date().toISOString();
  if (!row?.iniciada_em) updates.iniciada_em = new Date().toISOString();

  const { error } = await supabase
    .from('etapa_progresso')
    .update(updates)
    .eq('processo_id', processoId)
    .eq('etapa_id', 11)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Marca o processo Step 1 como concluído (finalizado). Só estudos finalizados podem ser usados no Step 2. */
export async function finalizarEstudoStep1(processoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para finalizar.' };

  const { error } = await supabase
    .from('processo_step_one')
    .update({ status: 'concluido', updated_at: new Date().toISOString() })
    .eq('id', processoId)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Cancela o processo (a partir do Step 2). Só o dono pode cancelar. */
export async function cancelarProcesso(processoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: row } = await supabase
    .from('processo_step_one')
    .select('id, user_id, step_atual, status, cancelado_em')
    .eq('id', processoId)
    .single();

  if (!row || row.user_id !== user.id) return { ok: false, error: 'Processo não encontrado.' };
  const stepAtual = (row as { step_atual?: number }).step_atual ?? 1;
  if (stepAtual < 2)
    return { ok: false, error: 'Cancelamento permitido apenas a partir do Step 2.' };
  if ((row as { cancelado_em?: string }).cancelado_em)
    return { ok: false, error: 'Processo já está cancelado.' };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('processo_step_one')
    .update({ status: 'cancelado', cancelado_em: now, updated_at: now })
    .eq('id', processoId)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Avançar para o próximo Step (ex.: ao concluir última etapa do Step 2, ir para Step 3). */
export async function avancarParaProximoStep(
  processoId: string,
  proximoStep: number,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { error } = await supabase
    .from('processo_step_one')
    .update({
      step_atual: proximoStep,
      updated_at: new Date().toISOString(),
    })
    .eq('id', processoId)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export async function registerPdfExport(
  processoId: string,
  payload: { hipotese?: string; modelo_escolhido?: string },
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const now = new Date().toISOString();
  const payloadStr = `${processoId}|${user.id}|${now}|${payload.hipotese ?? ''}|${payload.modelo_escolhido ?? ''}`;
  const file_hash = sha256Hex(payloadStr);

  const { error } = await supabase.from('pdf_exports').insert({
    user_id: user.id,
    processo_id: processoId,
    hipotese: payload.hipotese ?? 'Hipótese Step One',
    modelo_escolhido: payload.modelo_escolhido ?? null,
    file_hash,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
