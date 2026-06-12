'use server';

import { revalidatePath } from 'next/cache';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  MSG_GATE_JUSTIFICATIVA_SLA_LOTEADORES,
  calcularSlaCardLoteadores,
  cardLoteadoresPrecisaJustificativaSla,
  deveExibirSecaoQuebraSlaLoteadores,
  faseLoteadoresExigeJustificativaSla,
} from '@/lib/kanban/loteadores-sla-justificativa';
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
  sla_justificativa?: string | null;
};

type FaseSlaGateRow = {
  slug?: string | null;
  nome?: string | null;
  sla_dias?: number | null;
};

async function carregarCardFaseSlaGate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<{ card: CardSlaGateRow | null; fase: FaseSlaGateRow | null; error?: string }> {
  const selectComJustificativa =
    'kanban_id, fase_id, created_at, entered_fase_at, sla_iniciado_em, alvara_url, docs_terreno_url, sla_justificativa';
  let cardRes = await supabase.from('kanban_cards').select(selectComJustificativa).eq('id', cardId).maybeSingle();
  if (cardRes.error && /does not exist/i.test(cardRes.error.message)) {
    cardRes = await supabase
      .from('kanban_cards')
      .select('kanban_id, fase_id, created_at, entered_fase_at, sla_iniciado_em, alvara_url, docs_terreno_url')
      .eq('id', cardId)
      .maybeSingle();
  }
  if (cardRes.error) return { card: null, fase: null, error: cardRes.error.message };
  const card = (cardRes.data ?? null) as CardSlaGateRow | null;
  if (!card?.fase_id) return { card, fase: null };

  const { data: faseRow, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('slug, nome, sla_dias')
    .eq('id', String(card.fase_id))
    .maybeSingle();
  if (faseErr) return { card, fase: null, error: faseErr.message };
  return { card, fase: (faseRow ?? null) as FaseSlaGateRow | null };
}

export async function cardPrecisaJustificativaSlaQuebrado(cardId: string): Promise<boolean> {
  const supabase = await createClient();
  const { card, fase } = await carregarCardFaseSlaGate(supabase, cardId);
  if (!card || !fase) return false;

  const sla = calcularSlaCardLoteadores({
    created_at: String(card.created_at ?? ''),
    entered_fase_at: card.entered_fase_at,
    sla_iniciado_em: card.sla_iniciado_em,
    faseSlug: fase.slug,
    alvara_url: card.alvara_url,
    docs_terreno_url: card.docs_terreno_url,
    sla_dias: fase.sla_dias,
  });

  return cardLoteadoresPrecisaJustificativaSla({
    kanbanId: card.kanban_id,
    faseSlug: fase.slug,
    slaStatus: sla.status,
    slaJustificativa: card.sla_justificativa,
    sla_dias: fase.sla_dias,
  });
}

export async function salvarJustificativaSlaLoteadores(input: {
  cardId: string;
  justificativa: string;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar a justificativa.' };

  const cardId = String(input.cardId ?? '').trim();
  const justificativa = String(input.justificativa ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };
  if (!justificativa) return { ok: false, error: 'Informe a justificativa da quebra de SLA.' };

  const { card, fase, error } = await carregarCardFaseSlaGate(supabase, cardId);
  if (error) return { ok: false, error };
  if (!card?.fase_id || !fase) return { ok: false, error: 'Card ou fase não encontrados.' };
  if (String(card.kanban_id ?? '') !== KANBAN_IDS.LOTEADORES) {
    return { ok: false, error: 'Justificativa de SLA disponível apenas no Funil Loteadores.' };
  }
  if (!faseLoteadoresExigeJustificativaSla(fase.slug)) {
    return { ok: false, error: 'Esta fase não exige justificativa de quebra de SLA.' };
  }

  const sla = calcularSlaCardLoteadores({
    created_at: String(card.created_at ?? ''),
    entered_fase_at: card.entered_fase_at,
    sla_iniciado_em: card.sla_iniciado_em,
    faseSlug: fase.slug,
    alvara_url: card.alvara_url,
    docs_terreno_url: card.docs_terreno_url,
    sla_dias: fase.sla_dias,
  });
  if (!deveExibirSecaoQuebraSlaLoteadores({
    kanbanId: card.kanban_id,
    faseSlug: fase.slug,
    slaStatus: sla.status,
    sla_dias: fase.sla_dias,
  })) {
    return { ok: false, error: 'Justificativa só é necessária quando o SLA está vencido.' };
  }

  const admin = createAdminClient();
  const agora = new Date().toISOString();
  const { error: updErr } = await admin
    .from('kanban_cards')
    .update({
      sla_justificativa: justificativa,
      sla_justificativa_em: agora,
      sla_justificativa_por: user.id,
    } as never)
    .eq('id', cardId);
  if (updErr) return { ok: false, error: updErr.message };

  const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const usuarioNome = String((prof as { full_name?: string | null } | null)?.full_name ?? '').trim() || null;

  await admin.from('kanban_historico').insert({
    card_id: cardId,
    usuario_id: user.id,
    usuario_nome: usuarioNome,
    acao: 'sla_justificado',
    detalhe: {
      fase_id: card.fase_id,
      fase_nome: fase.nome ?? '',
      fase_slug: fase.slug ?? '',
      justificativa,
    },
  } as never);

  const basePath = String(input.basePath ?? '').trim();
  if (basePath) revalidatePath(basePath);
  return { ok: true };
}

/** Gate ao sair de fase com SLA vencido no Funil Loteadores. */
export async function verificarGateJustificativaSlaLoteadores(
  cardId: string,
  justificativaInformada?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { card, fase, error } = await carregarCardFaseSlaGate(supabase, cardId);
  if (error) return { ok: false, error };
  if (!card || !fase) return { ok: true };

  const sla = calcularSlaCardLoteadores({
    created_at: String(card.created_at ?? ''),
    entered_fase_at: card.entered_fase_at,
    sla_iniciado_em: card.sla_iniciado_em,
    faseSlug: fase.slug,
    alvara_url: card.alvara_url,
    docs_terreno_url: card.docs_terreno_url,
    sla_dias: fase.sla_dias,
  });

  const precisa = cardLoteadoresPrecisaJustificativaSla({
    kanbanId: card.kanban_id,
    faseSlug: fase.slug,
    slaStatus: sla.status,
    slaJustificativa: card.sla_justificativa,
    sla_dias: fase.sla_dias,
  });
  if (!precisa) return { ok: true };

  const justificativa = String(justificativaInformada ?? '').trim();
  if (!justificativa) {
    return { ok: false, error: MSG_GATE_JUSTIFICATIVA_SLA_LOTEADORES };
  }

  return salvarJustificativaSlaLoteadores({ cardId, justificativa });
}
