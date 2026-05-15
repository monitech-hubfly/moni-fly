'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';

export const CASA1_ID = 'casa1' as const;

/** Linha auxiliar: nota do quiz (0–100) em `conteudo`, não entra nos 14 itens do checklist. */
export const CASA1_QUIZ_SCORE_ITEM_ID = 'quiz_score' as const;

/** 14 itens obrigatórios Casa 1 — progresso = (concluídos / 14) * 100. */
export const CASA1_ITEM_IDS = [
  'modulo1',
  'modulo2',
  'modulo3',
  'modulo4',
  'modulo5',
  'modulo6',
  'modulo7',
  'modulo8',
  'modulo9',
  'modulo10',
  'modulo11',
  'modulo12',
  'cenarios',
  'quiz',
] as const;

export type Casa1ItemId = (typeof CASA1_ITEM_IDS)[number];

export type Casa1ItemStatus = 'pendente' | 'em_andamento' | 'concluido';

type ProgressoRow = {
  item_id: string;
  status: Casa1ItemStatus;
  conteudo: string | null;
};

const CASA1_ITEM_ID_SET = new Set<string>(CASA1_ITEM_IDS);

function parseScore0a100(raw: string | null | undefined): number {
  if (raw == null || String(raw).trim() === '') return 0;
  const n = Number.parseFloat(String(raw).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function rowsToItens(rows: ProgressoRow[] | undefined): Record<string, Casa1ItemStatus> {
  const out: Record<string, Casa1ItemStatus> = {};
  for (const id of CASA1_ITEM_IDS) {
    out[id] = 'pendente';
  }
  for (const row of rows ?? []) {
    if (!row.item_id || !CASA1_ITEM_ID_SET.has(row.item_id)) continue;
    if (row.status === 'pendente' || row.status === 'em_andamento' || row.status === 'concluido') {
      out[row.item_id] = row.status;
    }
  }
  return out;
}

function rowQuizScore(rows: ProgressoRow[] | undefined): number {
  const row = rows?.find((r) => r.item_id === CASA1_QUIZ_SCORE_ITEM_ID);
  return parseScore0a100(row?.conteudo);
}

/** Mesmo critério de `tudoConcluido` no hook — para sidebar e leituras pontuais sem SWR. */
export function computeCasa1TudoConcluido(
  rows: Pick<ProgressoRow, 'item_id' | 'status' | 'conteudo'>[] | null | undefined,
): boolean {
  const typed = rows as ProgressoRow[] | undefined;
  const itens = rowsToItens(typed);
  const quizScore = rowQuizScore(typed);
  const quizAprovado = quizScore >= 80;
  return CASA1_ITEM_IDS.every((id) => itens[id] === 'concluido') && quizAprovado;
}

export function useCasa1Progresso(userId: string) {
  const key = userId ? (['casa1-onboarding-progresso', userId] as const) : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async ([, uid]) => {
      const supabase = createClient();
      const { data: rows, error: qErr } = await supabase
        .from('franqueado_onboarding_progresso')
        .select('item_id, status, conteudo')
        .eq('user_id', uid)
        .eq('casa_id', CASA1_ID);

      if (qErr) throw qErr;
      return (rows ?? []) as ProgressoRow[];
    },
    { revalidateOnFocus: true },
  );

  const itens = useMemo(() => rowsToItens(data), [data]);

  const quizScore = useMemo(() => rowQuizScore(data), [data]);

  const quizAprovado = useMemo(() => quizScore >= 80, [quizScore]);

  const progresso = useMemo(() => {
    const concluidos = CASA1_ITEM_IDS.filter((id) => itens[id] === 'concluido').length;
    return (concluidos / CASA1_ITEM_IDS.length) * 100;
  }, [itens]);

  const tudoConcluido = useMemo(() => computeCasa1TudoConcluido(data), [data]);

  const updateItem = useCallback(
    async (itemId: string, status: Casa1ItemStatus) => {
      if (itemId === CASA1_QUIZ_SCORE_ITEM_ID) {
        throw new Error('Use updateQuizScore para o item quiz_score.');
      }
      const supabase = createClient();
      const now = new Date().toISOString();
      const completed_at = status === 'concluido' ? now : null;

      const { error: upErr } = await supabase.from('franqueado_onboarding_progresso').upsert(
        {
          user_id: userId,
          casa_id: CASA1_ID,
          item_id: itemId,
          status,
          completed_at,
          updated_at: now,
          conteudo: null,
        },
        { onConflict: 'user_id,casa_id,item_id' },
      );

      if (upErr) throw upErr;
      await mutate();
    },
    [userId, mutate],
  );

  const updateQuizScore = useCallback(
    async (score: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(Number(score))));
      const supabase = createClient();
      const now = new Date().toISOString();

      const { error: upErr } = await supabase.from('franqueado_onboarding_progresso').upsert(
        {
          user_id: userId,
          casa_id: CASA1_ID,
          item_id: CASA1_QUIZ_SCORE_ITEM_ID,
          status: 'concluido',
          conteudo: String(clamped),
          completed_at: now,
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
    updateQuizScore,
    progresso,
    tudoConcluido,
    quizScore,
    quizAprovado,
    mutate,
  };
}
