'use client';

import { useEffect, useState } from 'react';
import {
  carregarPracaDadosCidadeChecklist,
  type PracaDadosCidadeChecklistData,
} from '@/lib/actions/kanban-dados-cidade-praca';

export function usePracaDadosCidadeChecklist(
  processoId: string,
  reloadKey = 0,
  opts?: { skip?: boolean },
) {
  const [dados, setDados] = useState<PracaDadosCidadeChecklistData | null>(null);
  const [carregando, setCarregando] = useState(!opts?.skip);

  useEffect(() => {
    if (opts?.skip) {
      setDados(null);
      setCarregando(false);
      return;
    }

    const pid = processoId?.trim();
    if (!pid) {
      setDados({ ok: false, error: 'Processo Step One não vinculado a este card.' });
      setCarregando(false);
      return;
    }

    let cancelado = false;
    void (async () => {
      setCarregando(true);
      try {
        const res = await carregarPracaDadosCidadeChecklist(pid);
        if (!cancelado) setDados(res);
      } catch {
        if (!cancelado) setDados({ ok: false, error: 'Falha ao carregar dados da praça.' });
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [processoId, reloadKey, opts?.skip]);

  return { dados, carregando };
}
