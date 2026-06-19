'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPipelineCardsDataset } from '@/lib/actions/pipeline-cards-load';
import type { PipelineCardsDataset, PipelineCardsViewMode } from '@/lib/kanban/pipeline-cards-types';

type Opts = {
  mode: PipelineCardsViewMode;
  franqueadoId?: string;
  enabled: boolean;
};

export function usePipelineDatasetLazy({ mode, franqueadoId, enabled }: Opts) {
  const [dataset, setDataset] = useState<PipelineCardsDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (startedRef.current || loadingRef.current) return;
    startedRef.current = true;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await loadPipelineCardsDataset({ mode, franqueadoId });
      setDataset(data);
    } catch (e) {
      startedRef.current = false;
      setError(e instanceof Error ? e.message : 'Erro ao carregar pipeline.');
      setDataset({ cards: [], franqueados: [] });
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [mode, franqueadoId]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  return { dataset, loading, error, reload: load };
}
