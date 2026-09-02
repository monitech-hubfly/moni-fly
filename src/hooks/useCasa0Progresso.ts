'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { CASA0_ID, CASA0_ITEM_IDS, type Casa0ItemId } from '@/lib/casa0-onboarding-setup';

export { CASA0_ID, CASA0_ITEM_IDS, type Casa0ItemId };

export type Casa0ItemStatus = 'pendente' | 'em_andamento' | 'concluido';

export type Casa0ItensMap = Record<string, Casa0ItemStatus>;

type ProgressoRow = {
  item_id: string;
  status: Casa0ItemStatus;
};

function rowsToItens(rows: ProgressoRow[] | undefined): Casa0ItensMap {
  const out: Casa0ItensMap = {};
  for (const id of CASA0_ITEM_IDS) {
    out[id] = 'pendente';
  }
  for (const row of rows ?? []) {
    if (row.item_id && (row.status === 'pendente' || row.status === 'em_andamento' || row.status === 'concluido')) {
      out[row.item_id] = row.status;
    }
  }
  return out;
}

/**
 * Progresso do onboarding Casa 0 (`franqueado_onboarding_progresso`, `casa_id = casa0`).
 * Com `userId` vazio não há fetch (SWR `key = null`).
 */
export function useCasa0Progresso(userId: string) {
  const key = userId ? (['casa0-onboarding-progresso', userId] as const) : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async ([, uid]) => {
      const supabase = createClient();
      const { data: rows, error: qErr } = await supabase
        .from('franqueado_onboarding_progresso')
        .select('item_id, status')
        .eq('user_id', uid)
        .eq('casa_id', CASA0_ID);

      if (qErr) throw qErr;
      return (rows ?? []) as ProgressoRow[];
    },
    { revalidateOnFocus: true },
  );

  const itens = useMemo(() => rowsToItens(data), [data]);

  const progresso = useMemo(() => {
    const concluidos = CASA0_ITEM_IDS.filter((id) => itens[id] === 'concluido').length;
    return (concluidos / CASA0_ITEM_IDS.length) * 100;
  }, [itens]);

  const tudoConcluido = useMemo(
    () => CASA0_ITEM_IDS.every((id) => itens[id] === 'concluido'),
    [itens],
  );

  const updateItem = useCallback(
    async (itemId: string, status: Casa0ItemStatus) => {
      const supabase = createClient();
      const now = new Date().toISOString();
      const completed_at = status === 'concluido' ? now : null;

      const { error: upErr } = await supabase.from('franqueado_onboarding_progresso').upsert(
        {
          user_id: userId,
          casa_id: CASA0_ID,
          item_id: itemId,
          status,
          completed_at,
          updated_at: now,
        },
        { onConflict: 'user_id,casa_id,item_id' },
      );

      if (upErr) throw upErr;
      await mutate();
    },
    [userId, mutate],
  );

  return {
    itens,
    loading: Boolean(userId) && isLoading,
    error: error ?? null,
    updateItem,
    progresso,
    tudoConcluido,
  };
}
