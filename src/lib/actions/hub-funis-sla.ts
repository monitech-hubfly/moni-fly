'use server';

import { createClient } from '@/lib/supabase/server';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

export type HubFunisSlaItem = {
  kanbanId: string;
  atrasados: number;
  hoje: number;
};

/**
 * Conta cards ativos por kanban com SLA vencido ou vencendo hoje.
 * Usa dias corridos como aproximação para exibição no hub.
 */
export async function fetchHubFunisSla(): Promise<HubFunisSlaItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('hub_funis_sla_contagem');

  if (error || !data) {
    // Fallback: query manual se a RPC não existir ainda
    return fetchHubFunisSlaFallback();
  }

  return (data as Array<{ kanban_id: string; atrasados: number; hoje: number }>).map((row) => ({
    kanbanId: row.kanban_id,
    atrasados: Number(row.atrasados),
    hoje: Number(row.hoje),
  }));
}

async function fetchHubFunisSlaFallback(): Promise<HubFunisSlaItem[]> {
  const supabase = await createClient();

  // IDs visíveis no hub (exclui funis puramente internos)
  const kanbanIds = [
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
    KANBAN_IDS.JURIDICO,
    KANBAN_IDS.OPERACOES,
    KANBAN_IDS.PROJETO_LEGAL,
    KANBAN_IDS.PROJETOS_LOCAIS,
    KANBAN_IDS.HDM_PRODUTO,
    KANBAN_IDS.HDM_MODELO_VIRTUAL,
    KANBAN_IDS.HDM_HOMOLOGACOES,
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().split('T')[0];

  const { data: cards, error } = await supabase
    .from('kanban_cards')
    .select('kanban_id, entered_fase_at, fase:fase_id(sla_dias)')
    .eq('arquivado', false)
    .eq('concluido', false)
    .in('kanban_id', kanbanIds)
    .not('entered_fase_at', 'is', null);

  if (error || !cards) return [];

  const counts: Record<string, { atrasados: number; hoje: number }> = {};

  for (const card of cards) {
    const kid = card.kanban_id as string;
    if (!counts[kid]) counts[kid] = { atrasados: 0, hoje: 0 };

    const fase = card.fase as unknown as { sla_dias: number | null } | null;
    const slaDias = fase?.sla_dias ?? null;
    if (!slaDias || !card.entered_fase_at) continue;

    const entrou = new Date(card.entered_fase_at as string);
    entrou.setHours(0, 0, 0, 0);

    // prazo em dias corridos (aproximação do hub)
    const deadline = new Date(entrou);
    deadline.setDate(deadline.getDate() + slaDias);
    const deadlineIso = deadline.toISOString().split('T')[0];

    if (deadlineIso < todayIso) {
      counts[kid].atrasados++;
    } else if (deadlineIso === todayIso) {
      counts[kid].hoje++;
    }
  }

  return kanbanIds.map((id) => ({
    kanbanId: id,
    atrasados: counts[id]?.atrasados ?? 0,
    hoje: counts[id]?.hoje ?? 0,
  }));
}
