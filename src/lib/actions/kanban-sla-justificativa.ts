'use server';

import { revalidatePath } from 'next/cache';
import { calcularSlaKanbanCard } from '@/lib/kanban/kanban-card-sla';
import {
  MSG_GATE_JUSTIFICATIVA_SLA,
  cardPrecisaJustificativaSla,
  deveExibirModalJustificativaSla,
  isMovimentoParaFasePosterior,
} from '@/lib/kanban/kanban-sla-justificativa';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './card-actions';

type CardSlaGateRow = {
  kanban_id?: string | null;
  fase_id?: string | null;
  created_at?: string | null;
  entered_fase_at?: string | null;
  sla_iniciado_em?: string | null;
  alvara_url?: string | null;
  docs_terreno_url?: string | null;
};

type FaseSlaGateRow = {
  id?: string | null;
  slug?: string | null;
  nome?: string | null;
  ordem?: number | null;
  sla_dias?: number | null;
  sla_tipo?: 'uteis' | 'corridos' | null;
};

type JustificativaRow = {
  justificativa?: string | null;
  updated_at?: string | null;
};

async function carregarJustificativaFase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
  faseId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('kanban_card_sla_justificativas')
    .select('justificativa')
    .eq('card_id', cardId)
    .eq('fase_id', faseId)
    .maybeSingle();
  if (error) {
    if (/does not exist|schema cache|could not find|pgrst204/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  const texto = String((data as JustificativaRow | null)?.justificativa ?? '').trim();
  return texto || null;
}

async function carregarCardFaseSlaGate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<{ card: CardSlaGateRow | null; fase: FaseSlaGateRow | null; error?: string }> {
  const selectCard =
    'kanban_id, fase_id, created_at, entered_fase_at, sla_iniciado_em, alvara_url, docs_terreno_url';
  const cardRes = await supabase.from('kanban_cards').select(selectCard).eq('id', cardId).maybeSingle();
  if (cardRes.error) return { card: null, fase: null, error: cardRes.error.message };
  const card = (cardRes.data ?? null) as CardSlaGateRow | null;
  if (!card?.fase_id) return { card, fase: null };

  const { data: faseRow, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('id, slug, nome, ordem, sla_dias, sla_tipo')
    .eq('id', String(card.fase_id))
    .maybeSingle();
  if (faseErr) return { card, fase: null, error: faseErr.message };
  return { card, fase: (faseRow ?? null) as FaseSlaGateRow | null };
}

async function carregarFaseDestino(
  supabase: Awaited<ReturnType<typeof createClient>>,
  faseId: string,
): Promise<FaseSlaGateRow | null> {
  const { data, error } = await supabase
    .from('kanban_fases')
    .select('id, slug, nome, ordem, sla_dias, sla_tipo')
    .eq('id', faseId)
    .maybeSingle();
  if (error || !data) return null;
  return data as FaseSlaGateRow;
}

function calcularSlaFaseCard(card: CardSlaGateRow, fase: FaseSlaGateRow) {
  return calcularSlaKanbanCard({
    created_at: String(card.created_at ?? ''),
    entered_fase_at: card.entered_fase_at,
    sla_iniciado_em: card.sla_iniciado_em,
    faseSlug: fase.slug,
    alvara_url: card.alvara_url,
    docs_terreno_url: card.docs_terreno_url,
    sla_dias: fase.sla_dias,
    sla_tipo: fase.sla_tipo,
  });
}

export async function obterJustificativaSlaFase(
  cardId: string,
  faseId: string,
): Promise<{ ok: true; justificativa: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  const id = String(cardId ?? '').trim();
  const fId = String(faseId ?? '').trim();
  if (!id || !fId) return { ok: false, error: 'Dados inválidos.' };
  try {
    const justificativa = await carregarJustificativaFase(supabase, id, fId);
    return { ok: true, justificativa };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}

export async function cardPrecisaJustificativaSlaQuebrado(
  cardId: string,
  novaFaseId?: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { card, fase } = await carregarCardFaseSlaGate(supabase, cardId);
  if (!card || !fase?.id) return false;

  let movimentoPosterior = true;
  if (novaFaseId) {
    const destino = await carregarFaseDestino(supabase, novaFaseId);
    if (!destino) return false;
    movimentoPosterior = isMovimentoParaFasePosterior(
      Number(fase.ordem ?? 0),
      Number(destino.ordem ?? 0),
    );
  }

  const sla = calcularSlaFaseCard(card, fase);
  const justificativaExistente = await carregarJustificativaFase(supabase, cardId, String(fase.id));

  return cardPrecisaJustificativaSla({
    slaStatus: sla.status,
    sla_dias: fase.sla_dias,
    justificativaExistente,
    movimentoPosterior,
  });
}

export async function salvarJustificativaSla(input: {
  cardId: string;
  faseId: string;
  justificativa: string;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar a justificativa.' };

  const cardId = String(input.cardId ?? '').trim();
  const faseId = String(input.faseId ?? '').trim();
  const justificativa = String(input.justificativa ?? '').trim();
  if (!cardId || !faseId) return { ok: false, error: 'Dados inválidos.' };
  if (!justificativa) return { ok: false, error: 'Informe a justificativa da quebra de SLA.' };

  const { card, fase, error } = await carregarCardFaseSlaGate(supabase, cardId);
  if (error) return { ok: false, error };
  if (!card?.fase_id || !fase) return { ok: false, error: 'Card ou fase não encontrados.' };
  if (String(card.fase_id) !== faseId) {
    return { ok: false, error: 'A justificativa deve ser registrada para a fase atual do card.' };
  }

  const sla = calcularSlaFaseCard(card, fase);
  if (
    !deveExibirModalJustificativaSla({
      slaStatus: sla.status,
      sla_dias: fase.sla_dias,
      movimentoPosterior: true,
    })
  ) {
    return { ok: false, error: 'Justificativa só é necessária quando o SLA está vencido.' };
  }

  const existente = await carregarJustificativaFase(supabase, cardId, faseId);
  if (existente && existente === justificativa) {
    const basePath = String(input.basePath ?? '').trim();
    if (basePath) revalidatePath(basePath);
    return { ok: true };
  }

  const admin = createAdminClient();
  const agora = new Date().toISOString();
  if (existente) {
    const { error: updErr } = await admin
      .from('kanban_card_sla_justificativas')
      .update({ justificativa, updated_at: agora } as never)
      .eq('card_id', cardId)
      .eq('fase_id', faseId);
    if (updErr) return { ok: false, error: updErr.message };
  } else {
    const { error: insErr } = await admin.from('kanban_card_sla_justificativas').insert({
      card_id: cardId,
      fase_id: faseId,
      justificativa,
      created_by: user.id,
    } as never);
    if (insErr) return { ok: false, error: insErr.message };
  }

  const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const usuarioNome = String((prof as { full_name?: string | null } | null)?.full_name ?? '').trim() || null;

  await admin.from('kanban_historico').insert({
    card_id: cardId,
    usuario_id: user.id,
    usuario_nome: usuarioNome,
    acao: 'sla_justificado',
    detalhe: {
      fase_id: faseId,
      fase_nome: fase.nome ?? '',
      fase_slug: fase.slug ?? '',
      justificativa,
      append: Boolean(existente),
    },
  } as never);

  const basePath = String(input.basePath ?? '').trim();
  if (basePath) revalidatePath(basePath);
  return { ok: true };
}

/** Gate ao sair de fase com SLA vencido (avanço para fase posterior). */
export async function verificarGateJustificativaSla(
  cardId: string,
  novaFaseId: string,
  justificativaInformada?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { card, fase, error } = await carregarCardFaseSlaGate(supabase, cardId);
  if (error) return { ok: false, error };
  if (!card || !fase?.id) return { ok: true };

  const destino = await carregarFaseDestino(supabase, novaFaseId);
  if (!destino) return { ok: false, error: 'Fase de destino não encontrada.' };

  const movimentoPosterior = isMovimentoParaFasePosterior(
    Number(fase.ordem ?? 0),
    Number(destino.ordem ?? 0),
  );
  if (!movimentoPosterior) return { ok: true };

  const sla = calcularSlaFaseCard(card, fase);
  const justificativaExistente = await carregarJustificativaFase(
    supabase,
    cardId,
    String(fase.id),
  );

  const precisa = cardPrecisaJustificativaSla({
    slaStatus: sla.status,
    sla_dias: fase.sla_dias,
    justificativaExistente,
    movimentoPosterior,
  });

  const textoInformado = String(justificativaInformada ?? '').trim();
  if (!precisa) {
    if (textoInformado && textoInformado !== justificativaExistente) {
      return salvarJustificativaSla({
        cardId,
        faseId: String(fase.id),
        justificativa: textoInformado,
      });
    }
    return { ok: true };
  }

  if (!textoInformado) {
    return { ok: false, error: MSG_GATE_JUSTIFICATIVA_SLA };
  }

  return salvarJustificativaSla({
    cardId,
    faseId: String(fase.id),
    justificativa: textoInformado,
  });
}
