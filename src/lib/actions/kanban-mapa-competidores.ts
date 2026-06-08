'use server';

import type { CasaRow } from '@/app/step-one/[id]/etapa/Etapa4Casas';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import {
  CHECKLIST_LABEL_CIDADE,
  CHECKLIST_LABEL_ESTADO,
  inferirChaveLegadoPraca,
  parseChavePracaCidade,
  type PracaCidade,
} from '@/lib/kanban/dados-cidade-praca-multi';
import { parseAreaAtuacao } from '@/lib/rede-area-atuacao';
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
    .select('kanban_id, rede_franqueado_id')
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
  processoId: string,
  cardId?: string,
): Promise<MapaCompetidoresChecklistData> {
  const pid = String(processoId ?? '').trim();
  if (!pid) return { ok: false, error: 'Processo Step One não vinculado.' };

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
      'id, cidade, foto_url, status, condominio, localizacao_condominio, quartos, banheiros, vagas, piscina, marcenaria, preco, area_casa_m2, preco_m2, estado, compatibilidade_moni, data_publicacao, data_despublicado, link, manual',
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
