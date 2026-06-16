'use server';

import type { CasaRow } from '@/app/step-one/[id]/etapa/Etapa4Casas';
import { normalizeAccessRole } from '@/lib/authz';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { resolverProcessoStepOneIdDoCard } from '@/lib/kanban/card-sync-group';
import {
  criarEVincularProcessoStepOneAoCard,
  vincularProcessoStepOneAoCard,
} from '@/lib/kanban/processo-step-one-card';
import {
  CHECKLIST_LABEL_CIDADE,
  CHECKLIST_LABEL_ESTADO,
  inferirChaveLegadoPraca,
  parseChavePracaCidade,
  type PracaCidade,
} from '@/lib/kanban/dados-cidade-praca-multi';
import { parseAreaAtuacao } from '@/lib/rede-area-atuacao';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { verifyProcessoCasasAccess } from '@/lib/zap-save-casas';

const DADOS_CIDADE_SLUGS = [FASE_SLUGS.DADOS_CIDADE, 'stepone_dados_cidade'] as const;

async function buscarFaseIdPorSlugs(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  kanbanId: string,
  slugs: readonly string[],
): Promise<string | null> {
  const { data } = await supabase
    .from('kanban_fases')
    .select('id, slug')
    .eq('kanban_id', kanbanId)
    .in('slug', [...slugs]);
  if (!data?.length) return null;
  for (const slug of slugs) {
    const hit = (data as { id: string; slug: string }[]).find((f) => f.slug === slug);
    if (hit) return hit.id;
  }
  return (data[0] as { id: string }).id;
}

async function buscarItemChecklistPorLabel(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
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
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
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

async function resolverPracaCard(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  cardId: string,
): Promise<PracaCidade | null> {
  const cardIdTrim = cardId.trim();
  if (!cardIdTrim) return null;

  const { data: cardRow } = await supabase
    .from('kanban_cards')
    .select('kanban_id, rede_franqueado_id, condominio_id')
    .eq('id', cardIdTrim)
    .maybeSingle();

  const kanbanId = String((cardRow as { kanban_id?: string } | null)?.kanban_id ?? '').trim();
  if (!kanbanId) return null;

  const faseCidadeId = await buscarFaseIdPorSlugs(supabase, kanbanId, DADOS_CIDADE_SLUGS);
  if (!faseCidadeId) return null;

  let areaAtuacao: string | null = null;
  const redeId = String(
    (cardRow as { rede_franqueado_id?: string | null } | null)?.rede_franqueado_id ?? '',
  ).trim();
  if (redeId) {
    const { data: redeRow } = await supabase
      .from('rede_franqueados')
      .select('area_atuacao')
      .eq('id', redeId)
      .maybeSingle();
    areaAtuacao = (redeRow as { area_atuacao?: string | null } | null)?.area_atuacao ?? null;
  }

  // Prioridade 1: cidade/estado do condomínio vinculado ao card
  const condominioId = String(
    (cardRow as { condominio_id?: string | null } | null)?.condominio_id ?? '',
  ).trim();
  if (condominioId) {
    const { data: condRow } = await supabase
      .from('condominios')
      .select('cidade, estado')
      .eq('id', condominioId)
      .maybeSingle();
    const condCidade = (condRow as { cidade?: string | null } | null)?.cidade?.trim() ?? '';
    const condEstado =
      (condRow as { estado?: string | null } | null)?.estado?.trim().toUpperCase().slice(0, 2) ?? '';
    if (condCidade && condEstado) return { cidade: condCidade, uf: condEstado };
  }

  const areas = parseAreaAtuacao(areaAtuacao);
  const cidadeItemId = await buscarItemChecklistPorLabel(supabase, faseCidadeId, CHECKLIST_LABEL_CIDADE);
  const estadoItemId = await buscarItemChecklistPorLabel(supabase, faseCidadeId, CHECKLIST_LABEL_ESTADO);
  const cidadeVal = cidadeItemId ? ((await buscarValorChecklist(supabase, cidadeItemId, cardIdTrim)) ?? '') : '';
  const estadoVal = estadoItemId ? ((await buscarValorChecklist(supabase, estadoItemId, cardIdTrim)) ?? '') : '';

  const chaveLegado = inferirChaveLegadoPraca(areas, cidadeVal, estadoVal);
  const pracaChecklist = parseChavePracaCidade(chaveLegado ?? '');
  if (pracaChecklist) return pracaChecklist;

  const uf = estadoVal.trim().toUpperCase();
  const cidade = cidadeVal.trim();
  if (cidade && uf.length === 2) return { uf, cidade };

  return areas[0] ?? null;
}

type SupabaseDb = Awaited<ReturnType<typeof createClient>>;

/** Processo Step One do card (hierarquia canônica via `resolverProcessoStepOneIdDoCard`). */
export async function resolverProcessoIdViaRedeFranqueado(
  supabase: SupabaseDb,
  cardId: string,
): Promise<string | null> {
  const cid = cardId.trim();
  if (!cid) return null;

  const { data: card } = await supabase
    .from('kanban_cards')
    .select('processo_step_one_id, projeto_id, rede_franqueado_id, titulo')
    .eq('id', cid)
    .maybeSingle();

  if (!card) return null;

  const row = card as {
    processo_step_one_id?: string | null;
    projeto_id?: string | null;
    rede_franqueado_id?: string | null;
    titulo?: string | null;
  };

  return resolverProcessoStepOneIdDoCard(supabase, {
    cardProcessoStepOneId: row.processo_step_one_id,
    cardProjetoId: row.projeto_id,
    redeFranqueadoId: row.rede_franqueado_id,
    cardTitulo: row.titulo,
  });
}

/**
 * Garante `processo_step_one` para cards nativos do Kanban sem vínculo.
 * Cria registro mínimo e preenche `kanban_cards.processo_step_one_id`.
 */
export async function ensureProcessoStepOneForKanbanCard(
  cardId: string,
): Promise<{ ok: true; processoId: string } | { ok: false; error: string }> {
  const cid = cardId.trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  const { data: card, error: errCard } = await admin
    .from('kanban_cards')
    .select(
      'id, processo_step_one_id, projeto_id, franqueado_id, rede_franqueado_id, titulo, condominio_id, nome_condominio, quadra, lote',
    )
    .eq('id', cid)
    .maybeSingle();

  if (errCard) return { ok: false, error: errCard.message };
  if (!card) return { ok: false, error: 'Card não encontrado.' };

  const row = card as {
    id: string;
    processo_step_one_id?: string | null;
    projeto_id?: string | null;
    franqueado_id?: string | null;
    rede_franqueado_id?: string | null;
    titulo?: string | null;
    condominio_id?: string | null;
    nome_condominio?: string | null;
    quadra?: string | null;
    lote?: string | null;
  };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const accessRole = normalizeAccessRole((profile as { role?: string } | null)?.role);
  const franqueadoId = String(row.franqueado_id ?? '').trim();
  if (accessRole !== 'admin' && accessRole !== 'team' && franqueadoId !== user.id) {
    return { ok: false, error: 'Sem permissão para este card.' };
  }

  const direto = String(row.processo_step_one_id ?? '').trim();
  if (direto) return { ok: true, processoId: direto };

  const existente = await resolverProcessoStepOneIdDoCard(admin, {
    cardProcessoStepOneId: row.processo_step_one_id,
    cardProjetoId: row.projeto_id,
    redeFranqueadoId: row.rede_franqueado_id,
    cardTitulo: row.titulo,
  });

  if (existente) {
    const link = await vincularProcessoStepOneAoCard(admin, cid, existente, {
      nomeCondominio: row.nome_condominio,
      quadra: row.quadra,
      lote: row.lote,
    });
    if (!link.ok) return link;
    return { ok: true, processoId: existente };
  }

  const praca = await resolverPracaCard(admin, cid);
  let nomeCondominio = row.nome_condominio?.trim() || null;
  const condominioId = String(row.condominio_id ?? '').trim() || null;
  if (!nomeCondominio && condominioId) {
    const { data: condRow } = await admin
      .from('condominios')
      .select('nome')
      .eq('id', condominioId)
      .maybeSingle();
    nomeCondominio = (condRow as { nome?: string | null } | null)?.nome?.trim() || null;
  }

  const criado = await criarEVincularProcessoStepOneAoCard(admin, {
    cardId: cid,
    userId: franqueadoId || user.id,
    titulo: row.titulo ?? undefined,
    cidade: praca?.cidade ?? undefined,
    estado: praca?.uf ?? undefined,
    nomeCondominio,
    quadra: row.quadra,
    lote: row.lote,
    redeFranqueadoId: row.rede_franqueado_id,
  });

  if (!criado.ok) return criado;
  return { ok: true, processoId: criado.processoId };
}

async function resolverProcessoIdParaMapa(
  processoId: string | null | undefined,
  cardId: string | undefined,
  supabase: SupabaseDb,
): Promise<{ ok: true; processoId: string } | { ok: false; error: string }> {
  let pid = String(processoId ?? '').trim();

  if (!pid && cardId?.trim()) {
    const viaRede = await resolverProcessoIdViaRedeFranqueado(supabase, cardId.trim());
    if (viaRede) pid = viaRede;
  }

  if (!pid) {
    const cid = cardId?.trim();
    if (!cid) return { ok: false, error: 'Processo Step One não vinculado.' };
    const ensured = await ensureProcessoStepOneForKanbanCard(cid);
    if (!ensured.ok) return ensured;
    pid = ensured.processoId;
  } else if (cardId?.trim()) {
    const { data: cardRow } = await supabase
      .from('kanban_cards')
      .select('processo_step_one_id, projeto_id')
      .eq('id', cardId.trim())
      .maybeSingle();
    const row = cardRow as { processo_step_one_id?: string | null; projeto_id?: string | null } | null;
    const projetoId = String(row?.processo_step_one_id ?? row?.projeto_id ?? '').trim();
    if (!projetoId) {
      const ensured = await ensureProcessoStepOneForKanbanCard(cardId.trim());
      if (ensured.ok) pid = ensured.processoId;
    }
  }

  return { ok: true, processoId: pid };
}

export type MapaCompetidoresChecklistData =
  | {
      ok: true;
      processoId: string;
      casas: CasaRow[];
      cidadeInicial: string;
      estadoInicial: string;
      ultimaValidacaoCasasManuaisEm: string | null;
    }
  | { ok: false; error: string };

export async function carregarMapaCompetidoresChecklist(
  processoId: string | null | undefined,
  cardId?: string,
): Promise<MapaCompetidoresChecklistData> {
  const supabase = await createClient();
  const resolved = await resolverProcessoIdParaMapa(processoId, cardId, supabase);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const pid = resolved.processoId;
  const access = await verifyProcessoCasasAccess(pid);
  if (!access.ok) return { ok: false, error: access.error };

  const { data: processo, error: errProc } = await access.supabase
    .from('processo_step_one')
    .select('id, cidade, estado, ultima_validacao_casas_manuais_em')
    .eq('id', pid)
    .maybeSingle();

  if (errProc) return { ok: false, error: errProc.message };
  if (!processo) return { ok: false, error: 'Processo não encontrado.' };

  const { data: casasData, error: errCasas } = await access.supabase
    .from('listings_casas')
    .select(
      'id, cidade, foto_url, status, condominio, localizacao_condominio, quartos, banheiros, vagas, piscina, marcenaria, preco, area_casa_m2, preco_m2, estado, compatibilidade_moni, data_publicacao, data_despublicado, link, manual, importado',
    )
    .eq('processo_id', pid)
    .order('created_at', { ascending: false });

  if (errCasas) return { ok: false, error: errCasas.message };

  const p = processo as {
    id: string;
    cidade: string | null;
    estado: string | null;
    ultima_validacao_casas_manuais_em: string | null;
  };

  const pracaCard = cardId?.trim() ? await resolverPracaCard(access.supabase, cardId) : null;
  const cidadeInicial = (pracaCard?.cidade ?? p.cidade ?? '').trim();
  const estadoInicial = (pracaCard?.uf ?? p.estado ?? '').trim().toUpperCase().slice(0, 2);

  return {
    ok: true,
    processoId: p.id,
    casas: (casasData ?? []) as CasaRow[],
    cidadeInicial,
    estadoInicial,
    ultimaValidacaoCasasManuaisEm: p.ultima_validacao_casas_manuais_em ?? null,
  };
}
