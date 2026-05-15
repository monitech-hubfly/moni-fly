'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { CASA0_ID } from '@/lib/casa0-onboarding-setup';

export type Casa0MissaoStatus = 'pendente' | 'enviado' | 'aprovado';

export type Casa0Missao = {
  conteudo: string;
  status: Casa0MissaoStatus;
};

type MissaoRow = {
  conteudo: string | null;
  status: Casa0MissaoStatus;
};

function normalizeMissao(row: MissaoRow | null | undefined): Casa0Missao {
  if (!row) {
    return { conteudo: '', status: 'pendente' };
  }
  const status =
    row.status === 'enviado' || row.status === 'aprovado' || row.status === 'pendente'
      ? row.status
      : 'pendente';
  return { conteudo: row.conteudo ?? '', status };
}

export function useCasa0Missao(userId: string) {
  const key = userId ? (['casa0-onboarding-missao', userId] as const) : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async ([, uid]) => {
      const supabase = createClient();
      const { data: row, error: qErr } = await supabase
        .from('franqueado_onboarding_missao')
        .select('conteudo, status')
        .eq('user_id', uid)
        .eq('casa_id', CASA0_ID)
        .maybeSingle();

      if (qErr) throw qErr;
      return row as MissaoRow | null;
    },
    { revalidateOnFocus: true },
  );

  const missao = useMemo(() => normalizeMissao(data ?? undefined), [data]);

  const missaoConcluida = useMemo(
    () => missao.status === 'enviado' || missao.status === 'aprovado',
    [missao.status],
  );

  const salvarMissao = useCallback(
    async (conteudo: string) => {
      const supabase = createClient();
      const now = new Date().toISOString();

      const { error: upErr } = await supabase.from('franqueado_onboarding_missao').upsert(
        {
          user_id: userId,
          casa_id: CASA0_ID,
          conteudo,
          status: 'enviado',
          submitted_at: now,
        },
        { onConflict: 'user_id,casa_id' },
      );

      if (upErr) throw upErr;
      await mutate();
    },
    [userId, mutate],
  );

  return {
    missao,
    loading: Boolean(userId) && isLoading,
    error: error ?? null,
    salvarMissao,
    missaoConcluida,
    mutate,
  };
}
