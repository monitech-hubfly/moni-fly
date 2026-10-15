'use server';

import { createClient } from '@/lib/supabase/server';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { fetchHistoricoEsteiraCards, fetchPipelineCards } from '@/lib/kanban/fetch-pipeline-cards';
import { fetchPipelineEsteiraCalculadoraAtivos } from '@/lib/kanban/fetch-pipeline-esteira-calculadora';
import type {
  PipelineCardsDataset,
  PipelineCardsViewMode,
  PipelineEsteiraHistoricoPorCard,
} from '@/lib/kanban/pipeline-cards-types';
import type { PipelineEsteiraCalculadoraPorGrupo } from '@/lib/kanban/fetch-pipeline-esteira-calculadora';

const ESTEIRA_KANBAN_IDS = [KANBAN_IDS.STEP_ONE, KANBAN_IDS.PORTFOLIO, KANBAN_IDS.OPERACOES];

export async function loadPipelineCardsDataset(opts: {
  mode: PipelineCardsViewMode;
  franqueadoId?: string;
  comCalculadoraEsteira?: boolean;
  comHistoricoEsteira?: boolean;
}): Promise<PipelineCardsDataset> {
  const supabase = await createClient();
  return fetchPipelineCards(supabase, {
    mode: opts.mode,
    franqueadoId: opts.franqueadoId,
    comEnrichment: true,
    comCalculadoraEsteira: opts.comCalculadoraEsteira,
    comHistoricoEsteira: opts.comHistoricoEsteira,
  });
}

/** Calculadora da esteira, separada da primeira carga do dashboard. */
export async function loadPipelineEsteiraCalculadora(opts: {
  mode: PipelineCardsViewMode;
  franqueadoId?: string;
}): Promise<PipelineEsteiraCalculadoraPorGrupo> {
  const supabase = await createClient();
  return fetchPipelineEsteiraCalculadoraAtivos(supabase, opts);
}

/** Histórico de avanço de fase da esteira, separado da primeira carga. */
export async function loadPipelineEsteiraHistorico(opts: {
  mode: PipelineCardsViewMode;
  franqueadoId?: string;
}): Promise<PipelineEsteiraHistoricoPorCard> {
  const supabase = await createClient();
  let q = supabase
    .from('kanban_cards')
    .select('id')
    .eq('status', 'ativo')
    .eq('arquivado', false)
    .eq('concluido', false)
    .in('kanban_id', ESTEIRA_KANBAN_IDS);

  if (opts.mode === 'unidade') {
    if (!opts.franqueadoId) return {};
    q = q.eq('rede_franqueado_id', opts.franqueadoId);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((row) => String((row as { id?: string }).id ?? '')).filter(Boolean);
  return fetchHistoricoEsteiraCards(supabase, ids);
}
