'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchPipelineCards } from '@/lib/kanban/fetch-pipeline-cards';
import type { PipelineCardsDataset, PipelineCardsViewMode } from '@/lib/kanban/pipeline-cards-types';

export async function loadPipelineCardsDataset(opts: {
  mode: PipelineCardsViewMode;
  franqueadoId?: string;
}): Promise<PipelineCardsDataset> {
  const supabase = await createClient();
  return fetchPipelineCards(supabase, {
    mode: opts.mode,
    franqueadoId: opts.franqueadoId,
    comEnrichment: true,
  });
}
