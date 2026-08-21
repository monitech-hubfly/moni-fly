'use server';

import { createClient } from '@/lib/supabase/server';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

export type HubFunisSlaItem = {
  kanbanId: string;
  atrasados: number;
  hoje: number;
  chamados: number;
};

// IDs visíveis no hub
const HUB_KANBAN_IDS = [
  KANBAN_IDS.STEP_ONE,
  KANBAN_IDS.PORTFOLIO,
  KANBAN_IDS.LOTEADORES,
  KANBAN_IDS.ACOPLAMENTO,
  KANBAN_IDS.MOTOR01,
  KANBAN_IDS.MONI_CAPITAL,
  KANBAN_IDS.FUNDING,
  KANBAN_IDS.CONTRATACOES,
  KANBAN_IDS.CREDITO_OBRA,
  KANBAN_IDS.CONTABILIDADE,
  KANBAN_IDS.OPERACOES,
  KANBAN_IDS.PROJETO_LEGAL,
  KANBAN_IDS.PROJETOS_LOCAIS,
  KANBAN_IDS.HDM_PRODUTO,
  KANBAN_IDS.HDM_MODELO_VIRTUAL,
  KANBAN_IDS.HDM_HOMOLOGACOES,
  KANBAN_IDS.MARKETING_GRAVACAO,
  KANBAN_IDS.MARKETING_PROGRAMACAO,
  KANBAN_IDS.MARKETING_INC_TO_FLY,
  KANBAN_IDS.MONI_CARE,
] as const;

const HUB_KANBAN_ID_SET = new Set<string>(HUB_KANBAN_IDS);

/**
 * Conta cards ativos por kanban com SLA vencido ou vencendo hoje,
 * e chamados em aberto vinculados a cards de cada kanban.
 */
export async function fetchHubFunisSla(): Promise<HubFunisSlaItem[]> {
  const supabase = await createClient();

  const [slaResult, chamadosResult] = await Promise.all([
    fetchSlaData(supabase),
    fetchChamadosPorKanban(supabase),
  ]);

  return HUB_KANBAN_IDS.map((id) => ({
    kanbanId: id,
    atrasados: slaResult[id]?.atrasados ?? 0,
    hoje: slaResult[id]?.hoje ?? 0,
    chamados: chamadosResult[id] ?? 0,
  }));
}

// ─── SLA ────────────────────────────────────────────────────────────────────

async function fetchSlaData(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Record<string, { atrasados: number; hoje: number }>> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().split('T')[0];

  const { data: cards, error } = await supabase
    .from('kanban_cards')
    .select('kanban_id, entered_fase_at, fase:fase_id(sla_dias)')
    .eq('arquivado', false)
    .eq('concluido', false)
    .in('kanban_id', HUB_KANBAN_IDS)
    .not('entered_fase_at', 'is', null);

  if (error || !cards) return {};

  const counts: Record<string, { atrasados: number; hoje: number }> = {};

  for (const card of cards) {
    const kid = card.kanban_id as string;
    if (!counts[kid]) counts[kid] = { atrasados: 0, hoje: 0 };

    const fase = card.fase as unknown as { sla_dias: number | null } | null;
    const slaDias = fase?.sla_dias ?? null;
    if (!slaDias || !card.entered_fase_at) continue;

    const entrou = new Date(card.entered_fase_at as string);
    entrou.setHours(0, 0, 0, 0);

    const deadline = new Date(entrou);
    deadline.setDate(deadline.getDate() + slaDias);
    const deadlineIso = deadline.toISOString().split('T')[0];

    if (deadlineIso < todayIso) {
      counts[kid].atrasados++;
    } else if (deadlineIso === todayIso) {
      counts[kid].hoje++;
    }
  }

  return counts;
}

// ─── Chamados em aberto por kanban ──────────────────────────────────────────

const OPEN_STATUSES = ['nao_iniciado', 'em_andamento', 'aguardando_aprovacao_criador'];

async function fetchChamadosPorKanban(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Record<string, number>> {
  // Busca chamados em aberto que têm card_id vinculado a um card de kanban visível
  const { data, error } = await supabase
    .from('sirene_chamados')
    .select('id, card_id, kanban_cards!inner(kanban_id)')
    .in('status', OPEN_STATUSES)
    .not('card_id', 'is', null);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const chamado of data) {
    const kc = chamado.kanban_cards as unknown as { kanban_id: string } | null;
    const kid = kc?.kanban_id;
    if (kid && HUB_KANBAN_ID_SET.has(kid)) {
      counts[kid] = (counts[kid] ?? 0) + 1;
    }
  }
  return counts;
}
