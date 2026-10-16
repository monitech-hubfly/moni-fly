'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadPipelineCardsDataset,
  loadPipelineEsteiraCalculadora,
  loadPipelineEsteiraHistorico,
} from '@/lib/actions/pipeline-cards-load';
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
  const [esteiraCalculadoraCarregando, setEsteiraCalculadoraCarregando] = useState(false);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  const startedRef = useRef(false);
  const loadingRef = useRef(false);
  const calcStartedRef = useRef(false);
  const histStartedRef = useRef(false);

  const adiarComplemento = mode === 'franqueadora' || mode === 'rede';

  const load = useCallback(async () => {
    if (startedRef.current || loadingRef.current) return;
    startedRef.current = true;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await loadPipelineCardsDataset({
        mode,
        franqueadoId,
        comCalculadoraEsteira: !adiarComplemento,
        comHistoricoEsteira: !adiarComplemento,
      });
      setDataset(data);
    } catch (e) {
      startedRef.current = false;
      setError(e instanceof Error ? e.message : 'Erro ao carregar pipeline.');
      setDataset({ cards: [], franqueados: [] });
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [mode, franqueadoId, adiarComplemento]);

  const ensureCalculadora = useCallback(() => {
    if (!adiarComplemento || calcStartedRef.current) return;
    calcStartedRef.current = true;
    setEsteiraCalculadoraCarregando(true);
    void loadPipelineEsteiraCalculadora({ mode, franqueadoId })
      .then((esteiraCalculadora) => {
        setDataset((prev) => (prev ? { ...prev, esteiraCalculadora } : prev));
      })
      .catch(() => {
        calcStartedRef.current = false;
      })
      .finally(() => setEsteiraCalculadoraCarregando(false));
  }, [adiarComplemento, mode, franqueadoId]);

  const ensureHistorico = useCallback(() => {
    if (!adiarComplemento || histStartedRef.current) return;
    histStartedRef.current = true;
    setHistoricoCarregando(true);
    void loadPipelineEsteiraHistorico({ mode, franqueadoId })
      .then((historico) => {
        setDataset((prev) => (prev ? { ...prev, historico } : prev));
      })
      .catch(() => {
        histStartedRef.current = false;
      })
      .finally(() => setHistoricoCarregando(false));
  }, [adiarComplemento, mode, franqueadoId]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  return {
    dataset,
    loading,
    error,
    reload: load,
    ensureCalculadora,
    ensureHistorico,
    esteiraCalculadoraCarregando,
    historicoCarregando,
  };
}
